"""Unified search across channels, EPG schedule, and VOD catalog."""

from __future__ import annotations

import re
from datetime import datetime, timezone

_GENRE_CACHE: dict[str, dict[int, str]] = {}


def _tokens(query: str) -> list[str]:
    return [t for t in re.split(r"\s+", (query or "").lower().strip()) if t]


def _match_score(text: str, tokens: list[str], full_query: str) -> float:
    if not text:
        return 0.0
    tl = text.lower()
    ql = (full_query or "").lower().strip()
    if not ql and not tokens:
        return 0.0
    if ql and tl == ql:
        return 100.0
    if ql and tl.startswith(ql):
        return 92.0
    if ql and ql in tl:
        return 78.0
    if tokens and all(t in tl for t in tokens):
        bonus = sum(8.0 for t in tokens if re.search(rf"\b{re.escape(t)}\b", tl))
        return 55.0 + min(25.0, bonus)
    if tokens:
        partial = sum(1 for t in tokens if t in tl)
        if partial:
            return 20.0 + (partial / len(tokens)) * 25.0
    return 0.0


def _genre_names(vod_catalog, media_type: str, genre_ids: list[int] | None) -> list[str]:
    if not genre_ids or not vod_catalog or not getattr(vod_catalog, "enabled", False):
        return []
    key = "tv" if media_type == "tv" else "movie"
    if key not in _GENRE_CACHE:
        mp: dict[int, str] = {}
        try:
            for g in vod_catalog.genres(key):
                gid = g.get("id")
                name = g.get("name")
                if gid and name:
                    mp[int(gid)] = str(name)
        except Exception:
            pass
        _GENRE_CACHE[key] = mp
    mp = _GENRE_CACHE[key]
    return [mp[i] for i in genre_ids if i in mp][:3]


def _schedule_status(start_ts: float, stop_ts: float, now_ts: float) -> dict:
    if start_ts <= now_ts < stop_ts:
        elapsed = max(0.0, now_ts - start_ts)
        total = max(1.0, stop_ts - start_ts)
        return {
            "air_status": "live",
            "air_label": "Live now",
            "progress_pct": round(min(100.0, (elapsed / total) * 100.0), 1),
        }
    if start_ts > now_ts:
        mins = int((start_ts - now_ts) // 60)
        if mins < 60:
            label = f"In {mins}m"
        elif mins < 24 * 60:
            hrs = mins // 60
            label = f"In {hrs}h" if mins % 60 < 15 else f"In {hrs}h {mins % 60}m"
        else:
            label = "Upcoming"
        return {"air_status": "upcoming", "air_label": label, "progress_pct": 0.0}
    return {"air_status": "past", "air_label": "Earlier", "progress_pct": 100.0}


def _enrich_vod_item(vod_catalog, item: dict) -> dict:
    out = dict(item)
    mt = out.get("type") or "movie"
    names = _genre_names(vod_catalog, mt, out.get("genre_ids") or [])
    if names:
        out["genres"] = names
    overview = (out.get("overview") or "").strip()
    if overview:
        out["overview_short"] = overview[:120] + ("…" if len(overview) > 120 else "")
    return out


def search_channels(get_channels_fn, epg, query: str, limit: int = 12) -> list[dict]:
    ql = (query or "").strip()
    tokens = _tokens(ql)
    if not tokens and not ql:
        return []

    scored: list[tuple[float, dict]] = []
    now_ts = datetime.now(timezone.utc).timestamp()

    for c in get_channels_fn(include_dead=True):
        name = c.name or ""
        score = _match_score(name, tokens, ql)
        if score <= 0:
            tag_hay = " ".join(getattr(c, "tags", None) or [])
            score = _match_score(tag_hay, tokens, ql) * 0.85
        if score <= 0:
            continue

        item: dict = {
            "id": c.id,
            "name": name,
            "logo": getattr(c, "logo", None),
            "tags": list(getattr(c, "tags", None) or [])[:4],
            "epg_has_data": bool(getattr(c, "epg_has_data", False)),
            "dead": bool(getattr(c, "dead", False)),
            "match_score": round(score, 2),
        }

        tvg_id = getattr(c, "tvg_id", None)
        if tvg_id and epg and not getattr(epg, "disabled", False):
            try:
                epg.ensure_refresh_async()
                nn = epg.get_now_next(tvg_id)
                now_prog = (nn or {}).get("now")
                if now_prog and now_prog.get("title"):
                    item["now_playing"] = {
                        "title": now_prog.get("title"),
                        "subtitle": now_prog.get("subtitle"),
                        "start": now_prog.get("start"),
                        "stop": now_prog.get("stop"),
                    }
                    if ql.lower() in (now_prog.get("title") or "").lower():
                        score += 12.0
            except Exception:
                pass

        scored.append((score, item))

    scored.sort(key=lambda x: (-x[0], (x[1].get("name") or "").lower()))
    return [item for _, item in scored[:limit]]


def search_epg_schedule(epg, get_channels_fn, query: str, limit: int = 12) -> list[dict]:
    ql = (query or "").strip()
    tokens = _tokens(ql)
    if (not tokens and not ql) or getattr(epg, "disabled", False):
        return []

    epg.ensure_refresh_async()
    prog_by_ch = getattr(epg, "_programmes_by_channel", None)
    if not prog_by_ch:
        return []

    now_ts = datetime.now(timezone.utc).timestamp()
    window_start = now_ts - 6 * 3600
    window_end = now_ts + 72 * 3600
    by_tvg = {c.tvg_id: c for c in get_channels_fn(include_dead=True) if c.tvg_id}
    scored: list[tuple[float, str, dict]] = []

    for tvg_id, rows in prog_by_ch.items():
        ch = by_tvg.get(tvg_id)
        if not ch:
            continue
        for prog in rows:
            if prog.stop_ts <= window_start or prog.start_ts >= window_end:
                continue
            title = prog.title or ""
            subtitle = getattr(prog, "subtitle", None) or ""
            category = getattr(prog, "category", None) or ""
            cats = " ".join(getattr(prog, "categories", None) or [])
            hay = f"{title} {subtitle} {category} {cats}"
            score = _match_score(hay, tokens, ql)
            if score <= 0:
                continue

            status = _schedule_status(prog.start_ts, prog.stop_ts, now_ts)
            if status["air_status"] == "live":
                score += 120.0
            elif status["air_status"] == "upcoming" and prog.start_ts - now_ts < 7200:
                score += 40.0
            elif status["air_status"] == "past":
                score -= 15.0

            if title.lower().startswith(ql.lower()):
                score += 15.0

            if hasattr(epg, "_programme_to_api"):
                item = epg._programme_to_api(prog)
            else:
                item = {
                    "title": title,
                    "subtitle": subtitle or None,
                    "start": datetime.fromtimestamp(prog.start_ts, timezone.utc).isoformat(),
                    "stop": datetime.fromtimestamp(prog.stop_ts, timezone.utc).isoformat(),
                    "category": category or "EPG",
                }
            item["channel_id"] = ch.id
            item["channel_name"] = ch.name
            item["channel_logo"] = getattr(ch, "logo", None)
            item.update(status)
            item["match_score"] = round(score, 2)
            scored.append((score, item.get("start", ""), item))

    scored.sort(key=lambda x: (-x[0], x[1]))
    return [item for _, _, item in scored[:limit]]


def search_vod(vod_catalog, query: str, limit: int = 12) -> tuple[list[dict], list[dict]]:
    ql = (query or "").strip()
    if not ql or not vod_catalog.enabled:
        return [], []
    data = vod_catalog.search(ql, "multi", 1)
    movies: list[dict] = []
    tv: list[dict] = []
    for item in data.get("items") or []:
        enriched = _enrich_vod_item(vod_catalog, item)
        if enriched.get("type") == "tv":
            tv.append(enriched)
        else:
            movies.append(enriched)
    return movies[:limit], tv[:limit]


def unified_search(epg, vod_catalog, get_channels_fn, query: str, limit: int = 12) -> dict:
    ql = (query or "").strip()
    limit = max(1, min(int(limit or 12), 30))
    if not ql:
        return {
            "query": "",
            "totals": {"channels": 0, "schedule": 0, "vod_movies": 0, "vod_tv": 0, "all": 0},
            "channels": [],
            "schedule": [],
            "vod_movies": [],
            "vod_tv": [],
        }

    channels = search_channels(get_channels_fn, epg, ql, limit)
    schedule = search_epg_schedule(epg, get_channels_fn, ql, limit)
    movies, tv = search_vod(vod_catalog, ql, limit)

    totals = {
        "channels": len(channels),
        "schedule": len(schedule),
        "vod_movies": len(movies),
        "vod_tv": len(tv),
        "all": len(channels) + len(schedule) + len(movies) + len(tv),
    }

    return {
        "query": ql,
        "totals": totals,
        "channels": channels,
        "schedule": schedule,
        "vod_movies": movies,
        "vod_tv": tv,
    }
