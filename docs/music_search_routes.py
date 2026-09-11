"""Unified Music search — Radio stations + Listen (ytmusicapi) entities."""
from __future__ import annotations

import asyncio
import os
import re
import time
from typing import Any

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

from . import music_ytm_client as ytm
from . import radio_browser as rb
from . import radio_dial as rd

router = APIRouter(tags=["music-search"])

_CLIENT_RPS = float(os.environ.get("MUSIC_SEARCH_CLIENT_RPS", "6"))
_CLIENT_BURST = int(os.environ.get("MUSIC_SEARCH_CLIENT_BURST", "16"))
_UNIFIED_CACHE_TTL = float(os.environ.get("MUSIC_SEARCH_CACHE_TTL", "45"))
_PREVIEW_DEFAULT = 6

_BAD_TITLES = {"", "untitled", "unknown", "artist", "song", "track", "video", "album", "playlist", "n/a", "null"}

_unified_cache: dict[str, tuple[float, dict[str, Any]]] = {}


class _IpBucket:
    __slots__ = ("tokens", "updated")

    def __init__(self) -> None:
        self.tokens = float(_CLIENT_BURST)
        self.updated = 0.0


_ip_buckets: dict[str, _IpBucket] = {}


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-real-ip") or request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _allow_client(ip: str) -> bool:
    now = time.monotonic()
    b = _ip_buckets.get(ip)
    if b is None:
        b = _IpBucket()
        b.updated = now
        b.tokens = float(_CLIENT_BURST)
        _ip_buckets[ip] = b
    elapsed = now - b.updated
    b.updated = now
    b.tokens = min(float(_CLIENT_BURST), b.tokens + elapsed * _CLIENT_RPS)
    if b.tokens >= 1.0:
        b.tokens -= 1.0
        return True
    return False


def _rate_limited(request: Request) -> JSONResponse | None:
    if not _allow_client(_client_ip(request)):
        return JSONResponse(
            status_code=429,
            content={"error": "rate_limit_exceeded", "retry_after_seconds": 1},
            headers={"Retry-After": "1"},
        )
    return None


def _norm(s: Any) -> str:
    return re.sub(r"\s+", " ", str(s or "").strip().lower())


def _tokens(q: str) -> list[str]:
    return [t for t in re.split(r"\s+", _norm(q)) if len(t) > 1]


def _name_match_score(title: str, query: str, tokens: list[str]) -> float:
    tl = _norm(title)
    ql = _norm(query)
    if not tl or not ql:
        return 0.0
    if tl == ql:
        return 100.0
    # Phrase containment beats loose prefix of longer fan names
    if re.search(rf"(^|[\s·\-_]){re.escape(ql)}([\s·\-_]|$)", tl):
        # Closer when few extra tokens
        extra = max(0, len(tl.split()) - len(ql.split()))
        return 90.0 - min(20.0, extra * 4.0)
    if tl.startswith(ql + " ") or tl.startswith(ql):
        extra = max(0, len(tl) - len(ql))
        return 80.0 - min(25.0, extra * 0.6)
    if ql.startswith(tl) and len(tl) >= 3:
        return 72.0
    if re.search(rf"\b{re.escape(ql)}\b", tl):
        return 70.0
    if ql in tl:
        return 55.0
    if tokens and all(t in tl for t in tokens):
        word = sum(1 for t in tokens if re.search(rf"\b{re.escape(t)}\b", tl))
        return 40.0 + min(25.0, word * 8.0)
    if tokens:
        partial = sum(1 for t in tokens if t in tl)
        if partial:
            return 12.0 + (partial / len(tokens)) * 22.0
    return 0.0


def _parse_taste(raw: str | None) -> list[str]:
    if not raw:
        return []
    out: list[str] = []
    seen: set[str] = set()
    for part in str(raw).split(","):
        n = _norm(part)
        if not n or n in seen or len(n) < 2:
            continue
        seen.add(n)
        out.append(n)
        if len(out) >= 12:
            break
    return out


def _taste_boost(hit: dict[str, Any], taste_artists: list[str], taste_genres: list[str]) -> float:
    if not taste_artists and not taste_genres:
        return 0.0
    blob = _norm(
        " ".join(
            [
                hit.get("title") or "",
                hit.get("subtitle") or "",
                " ".join(hit.get("artists") or []),
                (hit.get("station") or {}).get("genre") or "",
                (hit.get("station") or {}).get("tags") or "",
            ]
        )
    )
    boost = 0.0
    for a in taste_artists:
        if a in blob:
            boost += 14.0 if blob.startswith(a) or f" {a}" in f" {blob}" else 8.0
    for g in taste_genres:
        if g in blob:
            boost += 6.0
    return min(28.0, boost)


def _station_hit(st: dict[str, Any]) -> dict[str, Any]:
    title = (st.get("display_name") or st.get("name") or "Station").strip() or "Station"
    subtitle = " · ".join(
        [
            x
            for x in [
                st.get("city"),
                st.get("state"),
                st.get("dial_segment") or st.get("band"),
                (f"{st.get('dial')}" if st.get("dial") else None),
                st.get("genre"),
            ]
            if x
        ]
    )
    uid = str(st.get("stationuuid") or "")
    return {
        "kind": "station",
        "id": uid,
        "title": title,
        "subtitle": subtitle,
        "thumb": st.get("favicon") or "",
        "station": st,
        "playable": bool(st.get("playable") and st.get("stream_url")),
        "votes": int(st.get("votes") or 0),
        "clickcount": int(st.get("clickcount") or 0),
    }


def _clean_title(raw: Any, fallback: str = "") -> str:
    t = str(raw or "").strip()
    if _norm(t) in _BAD_TITLES:
        return fallback
    return t


def _listen_hit(item: dict[str, Any]) -> dict[str, Any] | None:
    if not item:
        return None
    kind = str(item.get("kind") or "").lower()
    if kind == "song":
        kind = "track"
    if kind not in {"track", "video", "artist", "album", "playlist", "mood"}:
        if item.get("videoId"):
            kind = "track"
        elif item.get("playlistId"):
            kind = "playlist"
        elif item.get("browseId") and str(item.get("browseId")).startswith("UC"):
            kind = "artist"
        elif item.get("browseId") and str(item.get("browseId")).startswith("MPRE"):
            kind = "album"
        elif item.get("browseId"):
            kind = "album"
        else:
            return None

    artists = item.get("artists") or []
    if not isinstance(artists, list):
        artists = [str(artists)] if artists else []
    artists = [str(a).strip() for a in artists if str(a).strip() and _norm(a) not in _BAD_TITLES]

    title = _clean_title(item.get("title"))
    if not title and kind == "artist" and artists:
        title = artists[0]
    if not title:
        title = _clean_title(item.get("name")) or _clean_title(item.get("artist"))
    if not title or _norm(title) in _BAD_TITLES:
        # Unusable card
        return None
    if kind == "artist" and _norm(title) in _BAD_TITLES:
        return None

    subtitle = item.get("subtitle")
    if isinstance(subtitle, str):
        subtitle = subtitle.strip()
    else:
        subtitle = ""
    if not subtitle or _norm(subtitle) in _BAD_TITLES | {"track", "video", "artist", "album", "playlist"}:
        subtitle = (
            ", ".join(artists)
            or (item.get("duration") and str(item.get("duration")))
            or (item.get("year") and str(item.get("year")))
            or ""
        )
    # Artist cards: avoid title duplicated as subtitle
    if kind == "artist" and _norm(subtitle) == _norm(title):
        subtitle = item.get("subscribers") or "Artist"

    video_id = item.get("videoId")
    browse_id = item.get("browseId")
    playlist_id = item.get("playlistId")
    stable = video_id or browse_id or playlist_id or item.get("params") or ""
    if not stable:
        stable = f"{kind}:{_norm(title)}"

    thumb = item.get("thumb") or item.get("artwork") or ""
    return {
        "kind": kind,
        "id": str(stable),
        "title": title,
        "subtitle": subtitle or kind,
        "thumb": thumb,
        "videoId": video_id,
        "browseId": browse_id,
        "playlistId": playlist_id,
        "artists": artists,
        "duration": item.get("duration"),
        "item": item,
    }


def _q_match(st: dict[str, Any], q: str) -> bool:
    needle = _norm(q)
    if not needle:
        return False
    blob = " ".join(
        str(x or "")
        for x in [
            st.get("display_name"),
            st.get("name"),
            st.get("raw_name"),
            st.get("callsign"),
            st.get("brand"),
            st.get("dial"),
            st.get("genre"),
            st.get("city"),
            st.get("tags"),
        ]
    ).lower()
    return needle in blob or all(tok in blob for tok in needle.split() if len(tok) > 1)


def _station_score(hit: dict[str, Any], query: str, tokens: list[str], taste_artists: list[str], taste_genres: list[str]) -> float:
    st = hit.get("station") or {}
    title = hit.get("title") or ""
    score = _name_match_score(title, query, tokens)
    # Also score callsign / brand / raw name
    for field in (st.get("callsign"), st.get("brand"), st.get("name"), st.get("raw_name")):
        if field:
            score = max(score, _name_match_score(str(field), query, tokens) * 0.95)
    # Strong boost when full query phrase is in the station title (Hot 97)
    if _norm(query) and _norm(query) in _norm(title):
        score += 16.0
    # Dial match only for multi-digit dials that look intentional (97.1, 101.1)
    dial = str(st.get("dial") or "").strip()
    ql = _norm(query)
    if dial and (dial in ql or ql in dial):
        score += 20.0
    elif dial and any(tok == dial for tok in tokens):
        score += 12.0
    votes = int(st.get("votes") or hit.get("votes") or 0)
    clicks = int(st.get("clickcount") or hit.get("clickcount") or 0)
    score += min(22.0, (votes ** 0.5) * 1.6) + min(12.0, (clicks ** 0.35) * 0.8)
    if st.get("playable") and st.get("stream_url"):
        score += 4.0
    if hit.get("thumb"):
        score += 1.5
    score += _taste_boost(hit, taste_artists, taste_genres)
    hit["score"] = round(score, 2)
    return score


def _listen_score(hit: dict[str, Any], query: str, tokens: list[str], taste_artists: list[str], taste_genres: list[str]) -> float:
    title = hit.get("title") or ""
    score = _name_match_score(title, query, tokens)
    artists = hit.get("artists") or []
    for a in artists[:3]:
        score = max(score, _name_match_score(str(a), query, tokens) * 0.92)
    # Artist exact match is gold for artist queries
    if hit.get("kind") == "artist":
        nt = _norm(title)
        nq = _norm(query)
        if nt == nq:
            score += 45.0
        elif nt.startswith(nq + " ") or nt.startswith(nq):
            # Prefer short canonical names (Lofi Girl > Lofi Chill Beats to Relax)
            extra_words = max(0, len(nt.split()) - len(nq.split()))
            score += max(0.0, 16.0 - extra_words * 5.0)
        # Prefer real channel ids
        bid = str(hit.get("browseId") or "")
        if bid.startswith("UC"):
            score += 8.0
        # Penalize emoji-heavy fan pages slightly
        if re.search(r"[\U0001F300-\U0001FAFF]", title):
            score -= 12.0
        # Slight preference for shorter display names
        score -= min(8.0, max(0, len(title) - len(query)) * 0.15)
    if hit.get("kind") == "track":
        # Track where artist matches query
        if any(_norm(a) == _norm(query) for a in artists):
            score += 22.0
        elif any(_norm(query) in _norm(a) for a in artists):
            score += 10.0
    if hit.get("kind") in {"album", "playlist"} and _norm(query) in _norm(title):
        score += 6.0
    if hit.get("thumb"):
        score += 2.0
    else:
        score -= 3.0
    # Prefer rows with real ids
    if hit.get("videoId") or hit.get("browseId") or hit.get("playlistId"):
        score += 3.0
    # ytmusic typed-search position as popularity prior (0 = top hit)
    raw = hit.get("item") or {}
    yt_rank = raw.get("_yt_rank")
    yt_filter = raw.get("_yt_filter")
    if isinstance(yt_rank, int) and yt_rank >= 0:
        # Stronger prior for the matching entity filter
        kind = hit.get("kind")
        matched = (
            (kind == "artist" and yt_filter == "artists")
            or (kind == "track" and yt_filter == "songs")
            or (kind == "album" and yt_filter == "albums")
            or (kind == "playlist" and yt_filter == "playlists")
            or (kind == "video" and yt_filter == "videos")
        )
        prior = 18.0 if matched else 8.0
        score += max(0.0, prior - yt_rank * 1.5)
    score += _taste_boost(hit, taste_artists, taste_genres)
    hit["score"] = round(score, 2)
    return score


def _dedupe_by_title(items: list[dict[str, Any]], *, kind: str) -> list[dict[str, Any]]:
    """Collapse identical display titles (e.g. multiple Drake channel mirrors)."""
    if kind not in {"artist", "album", "playlist"}:
        return items
    best: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for hit in items:
        key = _norm(hit.get("title") or "")
        if not key:
            key = str(hit.get("id") or id(hit))
        prev = best.get(key)
        if prev is None:
            best[key] = hit
            order.append(key)
            continue
        if float(hit.get("score") or 0) > float(prev.get("score") or 0):
            best[key] = hit
        elif float(hit.get("score") or 0) == float(prev.get("score") or 0):
            # Prefer UC browseId / longer id stability
            if str(hit.get("browseId") or "").startswith("UC") and not str(prev.get("browseId") or "").startswith("UC"):
                best[key] = hit
    return [best[k] for k in order]


async def _stations_for_query(
    q: str,
    *,
    lat: float | None,
    lon: float | None,
    countrycode: str | None,
    state: str | None,
    city: str | None,
    limit: int,
    offset: int = 0,
) -> list[dict[str, Any]]:
    hits: list[dict[str, Any]] = []
    seen: set[str] = set()
    soft_best: dict[str, tuple[float, dict[str, Any]]] = {}
    need = max(limit, offset + limit)

    def _pop(st: dict[str, Any]) -> float:
        return float(st.get("votes") or 0) * 10 + float(st.get("clickcount") or 0) * 0.01

    def _add(st: dict[str, Any], *, force: bool = False) -> None:
        uid = st.get("stationuuid")
        if not uid:
            return
        key = str(uid)
        if key in seen:
            return
        if not force and not _q_match(st, q) and q.lower() not in str(st.get("display_name") or "").lower():
            if not st.get("_from_rb_name") and not st.get("_from_rb_tag"):
                return
        call_brand = f"{_norm(st.get('callsign') or '')}|{_norm(st.get('brand') or st.get('display_name') or st.get('name') or '')}"
        if call_brand not in {"|", ""}:
            prev = soft_best.get(call_brand)
            if prev and _pop(st) <= prev[0] and prev[1].get("stationuuid") != uid:
                return
            soft_best[call_brand] = (_pop(st), st)
        seen.add(key)
        hits.append(_station_hit(st))

    # Prefer dial/home locals first (seeded flagships) — only on first page
    if offset <= 0:
        try:
            near = await rb.near_you(
                lat=lat,
                lon=lon,
                countrycode=countrycode,
                state=state,
                city=city,
                limit=max(36, need),
            )
            dial = rd.build_dial_list(
                near=near.get("near") or [],
                commercial=near.get("commercial") or [],
                internet=near.get("internet") or [],
                limit_internet=48,
            )
            for st in dial.get("dial") or []:
                if _q_match(st, q):
                    _add(st, force=True)
        except Exception:
            pass

    async def _rb_name():
        try:
            # Radio Browser supports native offset; over-fetch slightly for soft-dedupe headroom
            return await rb.search_stations(
                name=q,
                limit=max(need, 24),
                offset=max(0, offset),
                order="clickcount",
            )
        except Exception:
            return []

    async def _rb_tag():
        # Tag fan-out helps genre-ish queries (lofi, jazz) when name search is thin
        tag = q.strip().lower().replace(" ", "")
        if len(tag) < 3:
            return []
        try:
            return await rb.search_stations(
                tag=tag,
                limit=max(12, need // 2),
                offset=max(0, offset // 2),
                order="votes",
            )
        except Exception:
            return []

    remote_name, remote_tag = await asyncio.gather(_rb_name(), _rb_tag())
    for st in remote_name or []:
        st = dict(st)
        st["_from_rb_name"] = True
        _add(st, force=True)
    for st in remote_tag or []:
        st = dict(st)
        st["_from_rb_tag"] = True
        _add(st)

    # Rebuild hits preferring soft_best winners (drop weaker clones)
    if soft_best:
        prefer_uids = {str(v[1].get("stationuuid")) for v in soft_best.values()}
        filtered: list[dict[str, Any]] = []
        seen2: set[str] = set()
        for h in hits:
            st = h.get("station") or {}
            uid = str(st.get("stationuuid") or h.get("id") or "")
            call_brand = f"{_norm(st.get('callsign') or '')}|{_norm(st.get('brand') or st.get('display_name') or st.get('name') or '')}"
            if call_brand not in {"|", ""} and uid not in prefer_uids:
                continue
            if uid in seen2:
                continue
            seen2.add(uid)
            filtered.append(h)
        hits = filtered

    return hits


def _cache_key(query: str, limit: int, offset: int, geo: tuple, taste: tuple) -> str:
    return f"{query.lower()}|{limit}|{offset}|{geo}|{taste}"


def _cache_get(key: str) -> dict[str, Any] | None:
    hit = _unified_cache.get(key)
    if not hit:
        return None
    ts, val = hit
    if time.monotonic() - ts > _UNIFIED_CACHE_TTL:
        _unified_cache.pop(key, None)
        return None
    return val


def _cache_set(key: str, val: dict[str, Any]) -> dict[str, Any]:
    _unified_cache[key] = (time.monotonic(), val)
    if len(_unified_cache) > 128:
        items = sorted(_unified_cache.items(), key=lambda kv: kv[1][0])
        for k, _ in items[: len(items) // 2]:
            _unified_cache.pop(k, None)
    return val


@router.get("/api/music/search")
async def music_unified_search(
    request: Request,
    q: str = Query(..., min_length=1, max_length=120),
    lat: float | None = None,
    lon: float | None = None,
    countrycode: str | None = None,
    state: str | None = None,
    city: str | None = None,
    limit: int = Query(18, ge=4, le=40),
    offset: int = Query(0, ge=0, le=200),
    taste_artists: str | None = Query(None, max_length=400),
    taste_genres: str | None = Query(None, max_length=240),
):
    limited = _rate_limited(request)
    if limited:
        return limited

    query = q.strip()
    if not query:
        return {
            "ok": True,
            "q": "",
            "groups": {},
            "counts": {},
            "total": 0,
            "preview": _PREVIEW_DEFAULT,
            "offset": 0,
            "limit": limit,
            "has_more": False,
            "has_more_by_kind": {},
        }

    page = max(4, min(int(limit or 18), 40))
    off = max(0, min(int(offset or 0), 200))
    # Fetch a pool large enough to slice after rank/dedupe
    need = min(80, off + page)

    t_artists = _parse_taste(taste_artists)
    t_genres = _parse_taste(taste_genres)
    geo = (lat, lon, countrycode, state, city)
    ckey = _cache_key(query, page, off, geo, (tuple(t_artists), tuple(t_genres)))
    cached = _cache_get(ckey)
    if cached is not None:
        out = dict(cached)
        out["cached"] = True
        return out

    tokens = _tokens(query)

    async def _ytm():
        try:
            return await asyncio.to_thread(ytm.search_fanout, query, need, 0)
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "error": str(exc), "items": []}

    async def _radio():
        try:
            # Fetch a contiguous pool from 0..(offset+page) so dial+rank stay stable across pages
            return await _stations_for_query(
                query,
                lat=lat,
                lon=lon,
                countrycode=countrycode,
                state=state,
                city=city,
                limit=need,
                offset=0,
            )
        except Exception:
            return []

    listen_data, stations = await asyncio.gather(_ytm(), _radio())
    items = (listen_data or {}).get("items") or []

    groups: dict[str, list[dict[str, Any]]] = {
        "station": [],
        "track": [],
        "video": [],
        "artist": [],
        "album": [],
        "playlist": [],
    }
    seen_ids: dict[str, set[str]] = {k: set() for k in groups}

    # Stations: score + sort — build full ranked pool then page
    scored_stations: list[tuple[float, dict[str, Any]]] = []
    for st_hit in stations:
        sc = _station_score(st_hit, query, tokens, t_artists, t_genres)
        scored_stations.append((sc, st_hit))
    scored_stations.sort(key=lambda x: (-x[0], (x[1].get("title") or "").lower()))
    station_pool: list[dict[str, Any]] = []
    for sc, hit in scored_stations:
        hid = str(hit.get("id") or "")
        if not hid or hid in seen_ids["station"]:
            continue
        seen_ids["station"].add(hid)
        station_pool.append(hit)
        if len(station_pool) >= need:
            break

    for raw in items:
        hit = _listen_hit(raw)
        if not hit:
            continue
        bucket = hit["kind"]
        if bucket == "mood":
            bucket = "playlist"
            hit["kind"] = "playlist"
        if bucket not in groups:
            continue
        hid = str(hit.get("id") or "")
        if hid and hid in seen_ids[bucket]:
            continue
        if hid:
            seen_ids[bucket].add(hid)
        _listen_score(hit, query, tokens, t_artists, t_genres)
        groups[bucket].append(hit)

    # Rank each listen bucket (full pool), then page
    has_more_by_kind: dict[str, bool] = {}
    pool_counts: dict[str, int] = {}

    station_ranked = station_pool
    pool_counts["station"] = len(station_ranked)
    groups["station"] = station_ranked[off : off + page]
    has_more_by_kind["station"] = len(station_ranked) > off + page or (
        len(groups["station"]) >= page and len(station_ranked) >= need
    )

    for bucket in ("track", "video", "artist", "album", "playlist"):
        groups[bucket].sort(
            key=lambda h: (-float(h.get("score") or 0), len(h.get("title") or ""), (h.get("title") or "").lower())
        )
        ranked = _dedupe_by_title(groups[bucket], kind=bucket)
        pool_counts[bucket] = len(ranked)
        page_items = ranked[off : off + page]
        has_more_by_kind[bucket] = len(ranked) > off + page or (
            len(page_items) >= page and len(ranked) >= need
        )
        groups[bucket] = page_items

    order = ["station", "track", "artist", "album", "playlist", "video"]
    counts = {k: len(groups.get(k) or []) for k in order}
    # Chip counts prefer pool size on first page so UI shows full availability
    display_counts = {
        k: (pool_counts.get(k) or 0) if off == 0 else (counts.get(k) or 0) for k in order
    }
    # truncated flags for UX "See all" (first page only)
    truncated = {k: (pool_counts.get(k) or 0) > _PREVIEW_DEFAULT for k in order}
    has_more = any(has_more_by_kind.get(k) for k in order)

    result = {
        "ok": True,
        "q": query,
        "groups": groups,
        "order": order,
        "counts": display_counts if off == 0 else counts,
        "pool_counts": pool_counts,
        "total": sum(display_counts.values()) if off == 0 else sum(counts.values()),
        "preview": _PREVIEW_DEFAULT,
        "truncated": truncated,
        "offset": off,
        "limit": page,
        "has_more": has_more,
        "has_more_by_kind": has_more_by_kind,
        "listen_ok": bool((listen_data or {}).get("ok", True)),
        "listen_error": (listen_data or {}).get("error"),
        "fanout": (listen_data or {}).get("by_filter"),
        "cached": False,
    }
    return _cache_set(ckey, result)
