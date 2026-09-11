"""Thin ytmusicapi wrapper for Music Listen (unauthenticated public browse)."""
from __future__ import annotations

import os
import re
import threading
import time
from typing import Any

_CACHE_TTL = float(os.environ.get("MUSIC_LISTEN_CACHE_TTL", "300"))
_HOME_LIMIT = int(os.environ.get("MUSIC_LISTEN_HOME_ROWS", "6"))

_lock = threading.Lock()
_yt = None
_cache: dict[str, tuple[float, Any]] = {}


def _client():
    global _yt
    with _lock:
        if _yt is None:
            from ytmusicapi import YTMusic

            _yt = YTMusic()
        return _yt


def _cache_get(key: str) -> Any | None:
    hit = _cache.get(key)
    if not hit:
        return None
    ts, val = hit
    if time.monotonic() - ts > _CACHE_TTL:
        _cache.pop(key, None)
        return None
    return val


def _cache_set(key: str, val: Any) -> Any:
    _cache[key] = (time.monotonic(), val)
    if len(_cache) > 256:
        # Drop oldest half
        items = sorted(_cache.items(), key=lambda kv: kv[1][0])
        for k, _ in items[: len(items) // 2]:
            _cache.pop(k, None)
    return val


def _thumb(thumbs: Any) -> str | None:
    if not thumbs or not isinstance(thumbs, list):
        return None
    best = thumbs[-1] if thumbs else None
    if isinstance(best, dict):
        return best.get("url")
    return None


def _artists(item: dict) -> list[str]:
    arts = item.get("artists") or []
    if isinstance(arts, list):
        names = []
        for a in arts:
            if isinstance(a, dict) and a.get("name"):
                names.append(str(a["name"]))
            elif isinstance(a, str):
                names.append(a)
        return names
    return []


def normalize_item(raw: dict | None) -> dict | None:
    """Normalize ytmusicapi result into a stable Listen card shape."""
    if not raw or not isinstance(raw, dict):
        return None
    video_id = raw.get("videoId")
    browse_id = raw.get("browseId")
    playlist_id = raw.get("playlistId")
    result_type = (raw.get("resultType") or raw.get("type") or "").lower() or None

    kind = "unknown"
    if video_id and (result_type in ("song", "video", None) or raw.get("album") is not None):
        kind = "song" if result_type != "video" else "video"
        if not result_type and video_id:
            kind = "song"
    if browse_id and str(browse_id).startswith("MPRE"):
        kind = "album"
    elif browse_id and str(browse_id).startswith("UC"):
        kind = "artist"
    if playlist_id and not video_id:
        kind = "playlist"
    if result_type in ("album", "artist", "playlist", "song", "video"):
        kind = result_type

    # Artist search hits use `artist` (not title/name) in ytmusicapi.
    artist_name = raw.get("artist") if isinstance(raw.get("artist"), str) else None
    title = raw.get("title") or raw.get("name") or artist_name or "Untitled"
    if kind == "artist" and (not title or title == "Untitled") and artist_name:
        title = artist_name
    artists = _artists(raw)
    if kind == "artist" and artist_name and artist_name not in artists:
        artists = [artist_name] + artists
    subtitle = raw.get("subscribers") or raw.get("year") or raw.get("description")
    if not subtitle and artists:
        subtitle = ", ".join(artists)
    if isinstance(raw.get("album"), dict) and raw["album"].get("name"):
        if artists:
            subtitle = f"{', '.join(artists)} · {raw['album']['name']}"
        else:
            subtitle = raw["album"]["name"]

    out = {
        "kind": kind,
        "title": title,
        "subtitle": subtitle,
        "artists": artists,
        "videoId": video_id,
        "browseId": browse_id,
        "playlistId": playlist_id,
        "thumb": _thumb(raw.get("thumbnails") or raw.get("thumbnail")),
        "duration": raw.get("duration") or raw.get("length"),
    }
    # Album / artist ids for player deep-links (ytmusicapi song shape).
    album_obj = raw.get("album") if isinstance(raw.get("album"), dict) else None
    album_id = (album_obj or {}).get("id") or (album_obj or {}).get("browseId")
    if album_id:
        out["albumId"] = str(album_id)
        out["albumTitle"] = (album_obj or {}).get("name") or out.get("albumTitle")
    artist_ids: list[str] = []
    for a in raw.get("artists") or []:
        if isinstance(a, dict) and a.get("id"):
            artist_ids.append(str(a["id"]))
    if kind == "artist" and browse_id and str(browse_id).startswith("UC"):
        if str(browse_id) not in artist_ids:
            artist_ids.insert(0, str(browse_id))
    if artist_ids:
        out["artistIds"] = artist_ids
        out["artistId"] = artist_ids[0]
    year = raw.get("year") or (album_obj or {}).get("year")
    if year:
        out["year"] = str(year)
    return out


def _normalize_shelf(title: str, contents: list) -> dict:
    items = []
    for c in contents or []:
        n = normalize_item(c if isinstance(c, dict) else None)
        if n:
            items.append(n)
    return {"title": title or "Shelf", "items": items}


def _normalize_chart_artist(raw: dict | None) -> dict | None:
    """Charts 'artists' rows are often album-shaped; prefer channel browseId + name.

    ytmusicapi quirk: album-shaped chart artists use title=album, subscribers=artist
    (not a subscriber count), browseId=MPRE… .
    """
    if not raw or not isinstance(raw, dict):
        return None
    name = None
    channel = None
    album_title = None
    if isinstance(raw.get("artist"), str) and raw["artist"].strip():
        name = raw["artist"].strip()
    for a in raw.get("artists") or []:
        if not isinstance(a, dict):
            continue
        aid = str(a.get("id") or a.get("browseId") or "")
        if aid.startswith("UC"):
            channel = aid
        if a.get("name") and not name:
            name = str(a["name"])
    bid = str(raw.get("browseId") or "")
    if bid.startswith("UC"):
        channel = bid
    # Album-shaped chart rows: title=album, subscribers=artist name.
    if bid.startswith("MPRE"):
        album_title = (raw.get("title") or "").strip() or None
        sub_field = raw.get("subscribers")
        if isinstance(sub_field, str) and sub_field.strip() and not any(ch.isdigit() for ch in sub_field[:1]):
            # Prefer non-count-looking subscribers strings ("Rod", "KAROL").
            if not re_match_subscribers_count(sub_field):
                name = sub_field.strip()
        if not name and isinstance(raw.get("subtitle"), str) and raw["subtitle"].strip():
            name = raw["subtitle"].strip()
    if not name:
        name = (raw.get("name") or "").strip() or None
    if not name and not bid.startswith("MPRE"):
        name = (raw.get("title") or raw.get("subtitle") or "").strip() or None
    if not name:
        return None
    thumb = _thumb(raw.get("thumbnails") or raw.get("thumbnail"))
    trend = raw.get("trend")
    sub_bits = []
    if album_title:
        sub_bits.append(album_title[:42])
    elif isinstance(raw.get("subscribers"), str) and re_match_subscribers_count(raw["subscribers"]):
        sub_bits.append(raw["subscribers"])
    if trend and trend not in ("neutral",):
        sub_bits.append(str(trend))
    if not sub_bits:
        sub_bits.append("Trending")
    out = {
        "kind": "artist",
        "title": name,
        "subtitle": " · ".join(sub_bits),
        "artists": [name],
        "videoId": None,
        "browseId": channel,
        "playlistId": None,
        "thumb": thumb,
        "duration": None,
    }
    if not channel:
        out["_q"] = name
    return out


def re_match_subscribers_count(s: str) -> bool:
    """True when string looks like '15.7M' / '1.2K' subscriber counts."""
    return bool(re.match(r"^\d", str(s or "").strip())) or bool(
        re.search(r"\d+(\.\d+)?\s*[KMB]$", str(s or "").strip(), re.I)
    )


def _artists_from_albums(items: list, subtitle_prefix: str = "Latest") -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for it in items or []:
        if not isinstance(it, dict):
            continue
        names = _artists(it)
        if not names and isinstance(it.get("subtitle"), str):
            names = [it["subtitle"]]
        album = it.get("title") or ""
        thumb = _thumb(it.get("thumbnails") or it.get("thumbnail")) or it.get("thumb")
        year = it.get("year")
        for name in names:
            key = name.strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            channel = None
            for a in it.get("artists") or []:
                if isinstance(a, dict) and str(a.get("name") or "").lower() == key:
                    aid = str(a.get("id") or a.get("browseId") or "")
                    if aid.startswith("UC"):
                        channel = aid
                        break
            sub_bits = [subtitle_prefix]
            if album:
                sub_bits.append(str(album)[:48])
            if year:
                sub_bits.append(str(year))
            out.append(
                {
                    "kind": "artist",
                    "title": name,
                    "subtitle": " · ".join(sub_bits),
                    "artists": [name],
                    "videoId": None,
                    "browseId": channel,
                    "playlistId": None,
                    "thumb": thumb,
                    "duration": None,
                    "year": year,
                    "_q": None if channel else name,
                }
            )
    return out


def run_sync(fn, *args, **kwargs):
    """Call blocking ytmusicapi in a worker (caller should use asyncio.to_thread)."""
    return fn(*args, **kwargs)


def health() -> dict:
    try:
        yt = _client()
        # Light touch — search is cheaper than home for health.
        yt.search("a", filter="songs", limit=1)
        return {"ok": True, "auth": "anonymous", "cache_ttl_sec": _CACHE_TTL}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)[:200]}


def search(q: str, filter_: str | None = None, limit: int = 24, offset: int = 0) -> dict:
    """Search YTM. offset is emulated (fetch offset+limit, then slice) — ytmusicapi has no native offset."""
    off = max(0, min(int(offset or 0), 200))
    lim = max(1, min(int(limit or 24), 40))
    need = min(off + lim, 80)
    key = f"search:{filter_ or 'all'}:{need}:{q.strip().lower()}"
    cached = _cache_get(key)
    if cached is not None:
        items = (cached.get("items") or [])[off : off + lim]
        out = dict(cached)
        out["items"] = items
        out["count"] = len(items)
        out["offset"] = off
        out["limit"] = lim
        out["has_more"] = len(cached.get("items") or []) > off + lim
        return out
    yt = _client()
    kwargs: dict[str, Any] = {"limit": need}
    if filter_:
        kwargs["filter"] = filter_
    raw = yt.search(q, **kwargs) or []
    items = []
    for r in raw:
        n = normalize_item(r)
        if n:
            items.append(n)
    full = _cache_set(
        key,
        {"ok": True, "q": q, "filter": filter_, "items": items, "count": len(items)},
    )
    page = items[off : off + lim]
    return {
        "ok": True,
        "q": q,
        "filter": filter_,
        "items": page,
        "count": len(page),
        "offset": off,
        "limit": lim,
        "has_more": len(items) > off + lim,
        "_pool": len(items),
    }


def search_fanout(q: str, limit: int = 16, offset: int = 0) -> dict:
    """Parallel-ish typed searches so each entity bucket can populate.

    ytmusicapi unfiltered search often under-fills artists/albums/playlists and
    buries exact artist matches. Fan-out by filter, merge, and dedupe.
    offset is emulated via larger fetch + slice (no native YTM page token here).
    """
    query = (q or "").strip()
    off = max(0, min(int(offset or 0), 200))
    lim = max(4, min(int(limit or 16), 40))
    need = min(off + lim, 80)
    key = f"search_fanout:{need}:{query.lower()}"
    cached = _cache_get(key)
    if cached is not None:
        return cached
    if not query:
        return {
            "ok": True,
            "q": "",
            "items": [],
            "count": 0,
            "by_filter": {},
            "offset": off,
            "limit": lim,
            "has_more": False,
        }

    # Per-type limits: fetch a bit more than UI needs for ranking headroom.
    per = {
        None: max(12, need),
        "songs": max(10, need),
        "artists": max(8, need),
        "albums": max(8, need),
        "playlists": max(8, need),
        "videos": max(8, need),
    }
    by_filter: dict[str, list] = {}
    items: list[dict] = []
    seen: set[str] = set()
    err: str | None = None

    def _stable_key(it: dict) -> str:
        kind = str(it.get("kind") or "")
        for k in ("videoId", "browseId", "playlistId"):
            v = it.get(k)
            if v:
                return f"{kind}:{v}"
        return f"{kind}:{(it.get('title') or '').strip().lower()}"

    for filt, n in per.items():
        try:
            # Request full pool (offset=0); routes slice after rank/dedupe.
            res = search(query, filt, n, 0)
            bucket = []
            for idx, it in enumerate(res.get("items") or []):
                if not isinstance(it, dict):
                    continue
                # Force kind from filter when yt leaves resultType ambiguous
                if filt == "songs" and it.get("videoId"):
                    it = dict(it)
                    it["kind"] = "song"
                elif filt == "videos" and it.get("videoId"):
                    it = dict(it)
                    it["kind"] = "video"
                elif filt == "artists":
                    it = dict(it)
                    it["kind"] = "artist"
                elif filt == "albums":
                    it = dict(it)
                    it["kind"] = "album"
                elif filt == "playlists":
                    it = dict(it)
                    it["kind"] = "playlist"
                else:
                    it = dict(it)
                # Preserve source rank from typed search (popularity prior)
                it["_yt_filter"] = filt or "all"
                it["_yt_rank"] = idx
                sk = _stable_key(it)
                if sk in seen:
                    # Keep best (lowest) rank if duplicate across filters
                    continue
                seen.add(sk)
                bucket.append(it)
                items.append(it)
            by_filter[filt or "all"] = bucket
        except Exception as exc:  # noqa: BLE001
            err = str(exc)[:200]
            by_filter[filt or "all"] = []

    out = {
        "ok": err is None or bool(items),
        "q": query,
        "items": items,
        "count": len(items),
        "by_filter": {k: len(v) for k, v in by_filter.items()},
        "error": err,
        "pool": need,
        "offset": off,
        "limit": lim,
    }
    return _cache_set(key, out)


def home(limit: int | None = None) -> dict:
    rows = limit or _HOME_LIMIT
    key = f"home:{rows}"
    cached = _cache_get(key)
    if cached is not None:
        return cached
    yt = _client()
    shelves = []
    try:
        for row in yt.get_home(limit=rows) or []:
            shelves.append(_normalize_shelf(row.get("title") or "For you", row.get("contents") or []))
    except Exception:  # noqa: BLE001
        shelves = []

    # Charts + moods always available without personalization.
    try:
        charts = yt.get_charts(country=os.environ.get("MUSIC_LISTEN_CHART_COUNTRY", "US"))
        if isinstance(charts, dict):
            for label, key_name in (("Chart videos", "videos"), ("Chart genres", "genres")):
                items = charts.get(key_name) or []
                if items:
                    shelves.append(_normalize_shelf(label, items[:16]))
            artists_raw = charts.get("artists") or []
            artists = []
            for a in artists_raw[:24]:
                n = _normalize_chart_artist(a if isinstance(a, dict) else None)
                if n:
                    artists.append(n)
            if artists:
                shelves.append({"title": "Trending artists", "items": artists[:16]})
    except Exception:  # noqa: BLE001
        pass

    try:
        moods = yt.get_mood_categories() or {}
        mood_cards = []
        for cat, entries in moods.items():
            for e in (entries or [])[:6]:
                if isinstance(e, dict):
                    mood_cards.append(
                        {
                            "kind": "mood",
                            "title": e.get("title") or "Mood",
                            "subtitle": cat,
                            "artists": [],
                            "videoId": None,
                            "browseId": None,
                            "playlistId": None,
                            "params": e.get("params"),
                            "thumb": None,
                            "duration": None,
                        }
                    )
        if mood_cards:
            shelves.append({"title": "Moods & genres", "items": mood_cards[:24]})
    except Exception:  # noqa: BLE001
        pass

    return _cache_set(key, {"ok": True, "shelves": shelves})


def album(browse_id: str) -> dict:
    key = f"album:{browse_id}"
    cached = _cache_get(key)
    if cached is not None:
        return cached
    yt = _client()
    raw = yt.get_album(browse_id) or {}
    artist_ids: list[str] = []
    for a in raw.get("artists") or []:
        if isinstance(a, dict) and a.get("id"):
            aid = str(a["id"])
            if aid not in artist_ids:
                artist_ids.append(aid)
    year = raw.get("year")
    tracks = []
    for t in raw.get("tracks") or []:
        n = normalize_item(t)
        if not n:
            continue
        # Stamp album + primary artist channel onto tracks for ecosystem queue.
        n["albumId"] = n.get("albumId") or browse_id
        n["albumTitle"] = n.get("albumTitle") or raw.get("title")
        if year and not n.get("year"):
            n["year"] = year
        if artist_ids:
            existing = list(n.get("artistIds") or [])
            for aid in artist_ids:
                if aid not in existing:
                    existing.append(aid)
            n["artistIds"] = existing
            n["artistId"] = n.get("artistId") or artist_ids[0]
        tracks.append(n)
    return _cache_set(
        key,
        {
            "ok": True,
            "kind": "album",
            "title": raw.get("title"),
            "artists": _artists(raw) or [a.get("name") for a in (raw.get("artists") or []) if isinstance(a, dict)],
            "artistIds": artist_ids,
            "artistId": artist_ids[0] if artist_ids else None,
            "year": year,
            "thumb": _thumb(raw.get("thumbnails")),
            "browseId": browse_id,
            "tracks": tracks,
            "trackCount": len(tracks),
        },
    )


def playlist(playlist_id: str, limit: int = 100) -> dict:
    key = f"playlist:{playlist_id}:{limit}"
    cached = _cache_get(key)
    if cached is not None:
        return cached
    yt = _client()
    raw = yt.get_playlist(playlist_id, limit=limit) or {}
    tracks = []
    for t in raw.get("tracks") or []:
        n = normalize_item(t)
        if n:
            tracks.append(n)
    return _cache_set(
        key,
        {
            "ok": True,
            "kind": "playlist",
            "title": raw.get("title"),
            "description": raw.get("description"),
            "thumb": _thumb(raw.get("thumbnails")),
            "playlistId": playlist_id,
            "tracks": tracks,
            "trackCount": len(tracks),
        },
    )


def artist(channel_id: str) -> dict:
    key = f"artist:{channel_id}"
    cached = _cache_get(key)
    if cached is not None:
        return cached
    yt = _client()
    try:
        raw = yt.get_artist(channel_id) or {}
    except Exception as exc:  # noqa: BLE001 — ytmusicapi KeyError on some channels
        return {"ok": False, "error": str(exc)[:200], "browseId": channel_id, "shelves": []}
    if not isinstance(raw, dict) or not (raw.get("name") or raw.get("songs") or raw.get("albums")):
        return {"ok": False, "error": "artist_unavailable", "browseId": channel_id, "shelves": []}
    shelves = []
    for section_key, title in (
        ("songs", "Songs"),
        ("albums", "Albums"),
        ("singles", "Singles"),
        ("videos", "Videos"),
        ("related", "Related"),
    ):
        block = raw.get(section_key)
        if isinstance(block, dict):
            contents = block.get("results") or []
            if contents:
                shelves.append(_normalize_shelf(title, contents))
    return _cache_set(
        key,
        {
            "ok": True,
            "kind": "artist",
            "title": raw.get("name"),
            "description": (raw.get("description") or "")[:400],
            "thumb": _thumb(raw.get("thumbnails")),
            "browseId": channel_id,
            "shelves": shelves,
        },
    )


def watch(video_id: str | None = None, playlist_id: str | None = None, limit: int = 25) -> dict:
    key = f"watch:{video_id}:{playlist_id}:{limit}"
    cached = _cache_get(key)
    if cached is not None:
        return cached
    yt = _client()
    raw = yt.get_watch_playlist(videoId=video_id, playlistId=playlist_id, limit=limit) or {}
    tracks = []
    for t in raw.get("tracks") or []:
        n = normalize_item(t)
        if n:
            tracks.append(n)
    return _cache_set(
        key,
        {
            "ok": True,
            "playlistId": raw.get("playlistId"),
            "lyrics": raw.get("lyrics"),
            "related": raw.get("related"),
            "tracks": tracks,
        },
    )


def artists_feed(limit: int = 24) -> dict:
    """Directory feed for Home Artists: hot / latest / charts (cold-start friendly)."""
    lim = max(4, min(int(limit or 24), 40))
    key = f"artists_feed:{lim}"
    cached = _cache_get(key)
    if cached is not None:
        return cached
    yt = _client()
    hot: list[dict] = []
    latest: list[dict] = []
    try:
        charts = yt.get_charts(country=os.environ.get("MUSIC_LISTEN_CHART_COUNTRY", "US"))
        if isinstance(charts, dict):
            for a in charts.get("artists") or []:
                n = _normalize_chart_artist(a if isinstance(a, dict) else None)
                if n:
                    hot.append(n)
            # Album charts → latest-ish artists when present
            for key_name in ("albums", "songs", "videos"):
                block = charts.get(key_name) or []
                if block and not latest:
                    latest = _artists_from_albums(block[:20], "Chart")
    except Exception:  # noqa: BLE001
        pass

    # New releases from home rows (best-effort; need enough rows to reach the shelf).
    try:
        for row in yt.get_home(limit=8) or []:
            title = (row.get("title") or "").lower()
            if "new release" in title or "new album" in title or title.startswith("new "):
                latest = _artists_from_albums(row.get("contents") or [], "Latest") or latest
                break
    except Exception:  # noqa: BLE001
        pass

    if not hot and latest:
        hot = list(latest)
    return _cache_set(
        key,
        {
            "ok": True,
            "hot": hot[:lim],
            "latest": latest[:lim],
            "count": min(lim, max(len(hot), len(latest))),
        },
    )


def mood_playlists(params: str) -> dict:
    key = f"mood:{params}"
    cached = _cache_get(key)
    if cached is not None:
        return cached
    yt = _client()
    raw = yt.get_mood_playlists(params) or []
    items = []
    for r in raw:
        n = normalize_item(r)
        if n:
            items.append(n)
    return _cache_set(key, {"ok": True, "items": items, "count": len(items)})


_DIR_TTL = float(os.environ.get("MUSIC_ARTISTS_DIR_TTL", "1800"))
_LETTERS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ") + ["#"]


def _cache_get_ttl(key: str, ttl: float) -> Any | None:
    hit = _cache.get(key)
    if not hit:
        return None
    ts, val = hit
    if time.monotonic() - ts > ttl:
        _cache.pop(key, None)
        return None
    return val


def _letter_of(name: str) -> str:
    ch = (name or "").strip()[:1].upper()
    if len(ch) == 1 and "A" <= ch <= "Z":
        return ch
    return "#"


def _dir_add(bucket: dict[str, dict], raw: dict | None, hot_score: int = 0) -> None:
    if not raw or not isinstance(raw, dict):
        return
    item = raw
    if item.get("kind") != "artist":
        item = _normalize_chart_artist(raw) or normalize_item(raw)
    if not item or item.get("kind") != "artist":
        return
    title = str(item.get("title") or item.get("name") or "").strip()
    if not title:
        return
    browse = str(item.get("browseId") or item.get("channelId") or "").strip()
    if browse.startswith("MPRE"):
        browse = ""
    key = browse if browse.startswith("UC") else "t:" + title.lower()
    prev = bucket.get(key)
    hot = max(int(item.get("_hot") or 0), int(hot_score or 0))
    listeners = item.get("listeners") or item.get("subscribers") or None
    subtitle = item.get("subtitle") or ""
    if isinstance(raw.get("subscribers"), str) and re_match_subscribers_count(raw["subscribers"]):
        listeners = raw["subscribers"]
        if not subtitle or subtitle in ("Artist", "Trending"):
            subtitle = raw["subscribers"]
    row = {
        "kind": "artist",
        "title": title,
        "subtitle": subtitle or ("Artist" if not listeners else str(listeners)),
        "artists": [title],
        "browseId": browse or None,
        "channelId": browse or None,
        "thumb": item.get("thumb") or item.get("artwork"),
        "artwork": item.get("artwork") or item.get("thumb"),
        "listeners": listeners,
        "letter": _letter_of(title),
        "_hot": hot,
        "_q": None if browse else title,
    }
    if not prev or (browse and not prev.get("browseId")) or hot > int(prev.get("_hot") or 0):
        if prev and prev.get("thumb") and not row.get("thumb"):
            row["thumb"] = prev["thumb"]
            row["artwork"] = prev.get("artwork") or prev["thumb"]
        bucket[key] = row
    elif prev and row.get("thumb") and not prev.get("thumb"):
        prev["thumb"] = row["thumb"]
        prev["artwork"] = row["artwork"]


def _build_artists_directory_pool() -> list[dict]:
    """Cold-start A–Z pool from charts + sparse letter-seeded search (cached)."""
    bucket: dict[str, dict] = {}
    try:
        feed = artists_feed(40)
        for i, a in enumerate(feed.get("hot") or []):
            _dir_add(bucket, a if isinstance(a, dict) else None, 2000 - i)
        for i, a in enumerate(feed.get("latest") or []):
            _dir_add(bucket, a if isinstance(a, dict) else None, 1200 - i)
    except Exception:  # noqa: BLE001
        pass

    def letter_counts() -> dict[str, int]:
        counts = {L: 0 for L in _LETTERS}
        for row in bucket.values():
            L = row.get("letter") or "#"
            if L not in counts:
                L = "#"
            counts[L] += 1
        return counts

    yt = _client()
    searches = 0
    max_searches = 16
    # Prefer filling sparse letters; stop early once pool is dense enough.
    for letter in _LETTERS[:-1]:
        if searches >= max_searches:
            break
        if letter_counts().get(letter, 0) >= 3:
            continue
        try:
            results = yt.search(letter, filter="artists", limit=8) or []
            searches += 1
            for j, r in enumerate(results):
                if isinstance(r, dict):
                    _dir_add(bucket, r, 800 - searches - j)
        except Exception:  # noqa: BLE001
            continue

    if letter_counts().get("#", 0) < 3 and searches < max_searches:
        for q in ("0", "1", "2", "the", "$"):
            if searches >= max_searches:
                break
            try:
                results = yt.search(q, filter="artists", limit=6) or []
                searches += 1
                for j, r in enumerate(results):
                    if isinstance(r, dict):
                        _dir_add(bucket, r, 400 - j)
            except Exception:  # noqa: BLE001
                continue

    return list(bucket.values())


def artists_directory(
    letter: str | None = None,
    sort: str = "name",
    limit: int = 60,
    offset: int = 0,
    q: str | None = None,
) -> dict:
    """Enriched A–Z artists directory with letter index + sort + pagination."""
    pool_key = "artists_directory_pool_v2"
    pool = _cache_get_ttl(pool_key, _DIR_TTL)
    if pool is None:
        pool = _build_artists_directory_pool()
        _cache_set(pool_key, pool)

    letter_norm = None
    if letter:
        L = str(letter).strip().upper()[:1]
        if L == "#" or L == "0":
            letter_norm = "#"
        elif "A" <= L <= "Z":
            letter_norm = L

    q_norm = (q or "").strip().lower()
    items = []
    for row in pool:
        if letter_norm and row.get("letter") != letter_norm:
            continue
        if q_norm and q_norm not in str(row.get("title") or "").lower():
            continue
        items.append(row)

    sort_key = (sort or "name").strip().lower().replace("-", "_")
    if sort_key in ("name_desc", "za", "z_a"):
        items.sort(key=lambda r: str(r.get("title") or "").lower(), reverse=True)
        sort_out = "name_desc"
    elif sort_key in ("hot", "popular", "popularity"):
        items.sort(
            key=lambda r: (-int(r.get("_hot") or 0), str(r.get("title") or "").lower())
        )
        sort_out = "hot"
    else:
        items.sort(key=lambda r: str(r.get("title") or "").lower())
        sort_out = "name"

    total = len(items)
    lim = max(1, min(int(limit or 60), 200))
    off = max(0, int(offset or 0))
    page = items[off : off + lim]

    letter_counts: dict[str, int] = {L: 0 for L in _LETTERS}
    for row in pool:
        L = row.get("letter") or "#"
        if L not in letter_counts:
            L = "#"
        letter_counts[L] += 1

    # Strip internal scores from response copies
    out_items = []
    for r in page:
        out_items.append(
            {
                "kind": "artist",
                "title": r.get("title"),
                "subtitle": r.get("subtitle"),
                "artists": r.get("artists") or [r.get("title")],
                "browseId": r.get("browseId"),
                "channelId": r.get("channelId") or r.get("browseId"),
                "thumb": r.get("thumb"),
                "artwork": r.get("artwork") or r.get("thumb"),
                "listeners": r.get("listeners"),
                "letter": r.get("letter") or _letter_of(str(r.get("title") or "")),
                "_q": r.get("_q"),
                "_hot": r.get("_hot"),
            }
        )

    return {
        "ok": True,
        "sort": sort_out,
        "letter": letter_norm,
        "q": q or None,
        "offset": off,
        "limit": lim,
        "total": total,
        "pool_size": len(pool),
        "letters": [{"id": L, "count": letter_counts.get(L, 0)} for L in _LETTERS],
        "items": out_items,
        "has_more": off + lim < total,
    }


# --- Entity directories (tracks / albums / playlists / videos) -----------------

_ENTITY_DIR_SPECS: dict[str, dict[str, Any]] = {
    "track": {
        "kind": "song",
        "kinds": ("song", "track"),
        "yt_filter": "songs",
        "chart_keys": ("songs",),
        "id_fields": ("videoId",),
        "pool_key": "tracks_directory_pool_v1",
        "square_art": True,
    },
    "album": {
        "kind": "album",
        "kinds": ("album",),
        "yt_filter": "albums",
        "chart_keys": ("albums",),
        "id_fields": ("browseId",),
        "pool_key": "albums_directory_pool_v1",
        "square_art": True,
    },
    "playlist": {
        "kind": "playlist",
        "kinds": ("playlist",),
        "yt_filter": "playlists",
        "chart_keys": (),
        "id_fields": ("playlistId",),
        "pool_key": "playlists_directory_pool_v1",
        "square_art": True,
        "seed_queries": ("top hits", "chill", "workout", "party", "focus", "indie"),
    },
    "video": {
        "kind": "video",
        "kinds": ("video", "song"),
        "yt_filter": "videos",
        "chart_keys": ("videos",),
        "id_fields": ("videoId",),
        "pool_key": "videos_directory_pool_v1",
        "square_art": True,
        "prefer_video_kind": True,
    },
}


def _entity_row_key(kind: str, item: dict) -> str | None:
    spec = _ENTITY_DIR_SPECS.get(kind) or {}
    for f in spec.get("id_fields") or ():
        v = item.get(f)
        if v:
            return f"{f}:{v}"
    title = str(item.get("title") or "").strip().lower()
    if not title:
        return None
    return f"t:{title}"


def _entity_dir_add(bucket: dict[str, dict], kind: str, raw: dict | None, hot_score: int = 0) -> None:
    if not raw or not isinstance(raw, dict):
        return
    spec = _ENTITY_DIR_SPECS.get(kind) or {}
    item = normalize_item(raw) if raw.get("kind") not in (spec.get("kinds") or ()) else raw
    if not item:
        return
    allowed = set(spec.get("kinds") or (spec.get("kind"),))
    ik = item.get("kind")
    if kind == "video":
        # Charts/search may label music videos as songs — keep if videoId present.
        if not item.get("videoId"):
            return
        if ik not in ("video", "song"):
            return
        item = dict(item)
        item["kind"] = "video"
    elif ik not in allowed:
        # Accept chart rows that normalize oddly when ids match.
        if kind == "track" and item.get("videoId"):
            item = dict(item)
            item["kind"] = "song"
        elif kind == "album" and str(item.get("browseId") or "").startswith("MPRE"):
            item = dict(item)
            item["kind"] = "album"
        elif kind == "playlist" and item.get("playlistId"):
            item = dict(item)
            item["kind"] = "playlist"
        else:
            return
    title = str(item.get("title") or "").strip()
    if not title:
        return
    key = _entity_row_key(kind, item)
    if not key:
        return
    prev = bucket.get(key)
    hot = max(int(item.get("_hot") or 0), int(hot_score or 0))
    subtitle = item.get("subtitle") or ""
    artists = item.get("artists") or []
    if not subtitle and artists:
        subtitle = ", ".join(artists) if isinstance(artists, list) else str(artists)
    row = {
        "kind": item.get("kind") or spec.get("kind"),
        "title": title,
        "subtitle": subtitle or (spec.get("kind") or kind).title(),
        "artists": artists if isinstance(artists, list) else [],
        "videoId": item.get("videoId"),
        "browseId": item.get("browseId"),
        "playlistId": item.get("playlistId"),
        "albumId": item.get("albumId"),
        "artistId": item.get("artistId"),
        "artistIds": item.get("artistIds"),
        "thumb": item.get("thumb") or item.get("artwork"),
        "artwork": item.get("artwork") or item.get("thumb"),
        "duration": item.get("duration"),
        "year": item.get("year"),
        "letter": _letter_of(title),
        "_hot": hot,
    }
    if not prev or hot > int(prev.get("_hot") or 0):
        if prev and prev.get("thumb") and not row.get("thumb"):
            row["thumb"] = prev["thumb"]
            row["artwork"] = prev.get("artwork") or prev["thumb"]
        bucket[key] = row
    elif prev and row.get("thumb") and not prev.get("thumb"):
        prev["thumb"] = row["thumb"]
        prev["artwork"] = row["artwork"]


def _seed_queries_for_kind(kind: str) -> list[str]:
    spec = _ENTITY_DIR_SPECS.get(kind) or {}
    extra = list(spec.get("seed_queries") or [])
    # Letter seeds + common digraphs for denser A–Z coverage.
    letters = [L.lower() for L in _LETTERS[:-1]]
    return extra + letters


def _build_entity_directory_pool(kind: str) -> list[dict]:
    spec = _ENTITY_DIR_SPECS.get(kind)
    if not spec:
        return []
    bucket: dict[str, dict] = {}
    yt = _client()

    # Charts first (hot).
    try:
        charts = yt.get_charts(country=os.environ.get("MUSIC_LISTEN_CHART_COUNTRY", "US"))
        if isinstance(charts, dict):
            for ck in spec.get("chart_keys") or ():
                for i, raw in enumerate(charts.get(ck) or []):
                    if isinstance(raw, dict):
                        _entity_dir_add(bucket, kind, raw, 2000 - i)
    except Exception:  # noqa: BLE001
        pass

    # Home shelves that match the entity.
    try:
        for row in yt.get_home(limit=8) or []:
            title = (row.get("title") or "").lower()
            contents = row.get("contents") or []
            boost = 900
            if kind == "track" and any(w in title for w in ("song", "hit", "mix", "listen", "quick")):
                boost = 1400
            if kind == "album" and any(w in title for w in ("album", "release", "new")):
                boost = 1400
            if kind == "playlist" and any(w in title for w in ("playlist", "mix", "mood", "radio")):
                boost = 1400
            if kind == "video" and "video" in title:
                boost = 1400
            for i, raw in enumerate(contents[:18]):
                if isinstance(raw, dict):
                    _entity_dir_add(bucket, kind, raw, boost - i)
    except Exception:  # noqa: BLE001
        pass

    # Mood playlists for playlist directory.
    if kind == "playlist":
        try:
            moods = yt.get_mood_categories() or {}
            taken = 0
            for _cat, entries in moods.items():
                for e in (entries or [])[:4]:
                    if not isinstance(e, dict) or not e.get("params"):
                        continue
                    try:
                        pls = yt.get_mood_playlists(e["params"]) or []
                    except Exception:  # noqa: BLE001
                        continue
                    for j, pl in enumerate(pls[:8]):
                        if isinstance(pl, dict):
                            _entity_dir_add(bucket, kind, pl, 1100 - taken - j)
                    taken += 1
                    if taken >= 6:
                        break
                if taken >= 6:
                    break
        except Exception:  # noqa: BLE001
            pass

    def letter_counts() -> dict[str, int]:
        counts = {L: 0 for L in _LETTERS}
        for row in bucket.values():
            L = row.get("letter") or "#"
            if L not in counts:
                L = "#"
            counts[L] += 1
        return counts

    yt_filter = spec.get("yt_filter")
    searches = 0
    max_searches = 18
    for q in _seed_queries_for_kind(kind):
        if searches >= max_searches:
            break
        # Skip dense letters once we have enough coverage (letter seeds only).
        if len(q) == 1 and "a" <= q <= "z" and letter_counts().get(q.upper(), 0) >= 4:
            continue
        try:
            results = yt.search(q, filter=yt_filter, limit=8) or []
            searches += 1
            for j, r in enumerate(results):
                if isinstance(r, dict):
                    _entity_dir_add(bucket, kind, r, 700 - searches - j)
        except Exception:  # noqa: BLE001
            continue

    if letter_counts().get("#", 0) < 2 and searches < max_searches:
        for q in ("0", "1", "the", "$"):
            if searches >= max_searches:
                break
            try:
                results = yt.search(q, filter=yt_filter, limit=6) or []
                searches += 1
                for j, r in enumerate(results):
                    if isinstance(r, dict):
                        _entity_dir_add(bucket, kind, r, 350 - j)
            except Exception:  # noqa: BLE001
                continue

    return list(bucket.values())


def entity_directory(
    kind: str,
    letter: str | None = None,
    sort: str = "hot",
    limit: int = 60,
    offset: int = 0,
    q: str | None = None,
) -> dict:
    """Enriched directory for tracks / albums / playlists / videos."""
    kind_norm = (kind or "").strip().lower()
    if kind_norm in ("tracks", "songs", "song"):
        kind_norm = "track"
    elif kind_norm in ("albums",):
        kind_norm = "album"
    elif kind_norm in ("playlists",):
        kind_norm = "playlist"
    elif kind_norm in ("videos",):
        kind_norm = "video"
    spec = _ENTITY_DIR_SPECS.get(kind_norm)
    if not spec:
        return {"ok": False, "error": "unknown_kind", "kind": kind}

    pool_key = str(spec["pool_key"])
    pool = _cache_get_ttl(pool_key, _DIR_TTL)
    if pool is None:
        pool = _build_entity_directory_pool(kind_norm)
        _cache_set(pool_key, pool)

    letter_norm = None
    if letter:
        L = str(letter).strip().upper()[:1]
        if L == "#" or L == "0":
            letter_norm = "#"
        elif "A" <= L <= "Z":
            letter_norm = L

    q_norm = (q or "").strip().lower()
    items = []
    for row in pool:
        if letter_norm and row.get("letter") != letter_norm:
            continue
        if q_norm:
            hay = " ".join(
                [
                    str(row.get("title") or ""),
                    str(row.get("subtitle") or ""),
                    " ".join(row.get("artists") or []),
                ]
            ).lower()
            if q_norm not in hay:
                continue
        items.append(row)

    sort_key = (sort or "hot").strip().lower().replace("-", "_")
    if sort_key in ("name", "az", "a_z", "title"):
        items.sort(key=lambda r: str(r.get("title") or "").lower())
        sort_out = "name"
    elif sort_key in ("name_desc", "za", "z_a"):
        items.sort(key=lambda r: str(r.get("title") or "").lower(), reverse=True)
        sort_out = "name_desc"
    else:
        items.sort(
            key=lambda r: (-int(r.get("_hot") or 0), str(r.get("title") or "").lower())
        )
        sort_out = "hot"

    total = len(items)
    lim = max(1, min(int(limit or 60), 200))
    off = max(0, int(offset or 0))
    page = items[off : off + lim]

    letter_counts: dict[str, int] = {L: 0 for L in _LETTERS}
    for row in pool:
        L = row.get("letter") or "#"
        if L not in letter_counts:
            L = "#"
        letter_counts[L] += 1

    out_items = []
    for r in page:
        out_items.append(
            {
                "kind": r.get("kind"),
                "title": r.get("title"),
                "subtitle": r.get("subtitle"),
                "artists": r.get("artists") or [],
                "videoId": r.get("videoId"),
                "browseId": r.get("browseId"),
                "playlistId": r.get("playlistId"),
                "albumId": r.get("albumId"),
                "artistId": r.get("artistId"),
                "artistIds": r.get("artistIds"),
                "thumb": r.get("thumb"),
                "artwork": r.get("artwork") or r.get("thumb"),
                "duration": r.get("duration"),
                "year": r.get("year"),
                "letter": r.get("letter") or _letter_of(str(r.get("title") or "")),
                "_hot": r.get("_hot"),
            }
        )

    return {
        "ok": True,
        "kind": kind_norm,
        "sort": sort_out,
        "letter": letter_norm,
        "q": q or None,
        "offset": off,
        "limit": lim,
        "total": total,
        "pool_size": len(pool),
        "letters": [{"id": L, "count": letter_counts.get(L, 0)} for L in _LETTERS],
        "items": out_items,
        "has_more": off + lim < total,
    }


def tracks_directory(
    letter: str | None = None,
    sort: str = "hot",
    limit: int = 60,
    offset: int = 0,
    q: str | None = None,
) -> dict:
    return entity_directory("track", letter, sort, limit, offset, q)


def albums_directory(
    letter: str | None = None,
    sort: str = "hot",
    limit: int = 60,
    offset: int = 0,
    q: str | None = None,
) -> dict:
    return entity_directory("album", letter, sort, limit, offset, q)


def playlists_directory(
    letter: str | None = None,
    sort: str = "hot",
    limit: int = 60,
    offset: int = 0,
    q: str | None = None,
) -> dict:
    return entity_directory("playlist", letter, sort, limit, offset, q)


def videos_directory(
    letter: str | None = None,
    sort: str = "hot",
    limit: int = 60,
    offset: int = 0,
    q: str | None = None,
) -> dict:
    return entity_directory("video", letter, sort, limit, offset, q)
