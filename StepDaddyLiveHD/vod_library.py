"""Local VOD library (watched, favorites, bookmarks, recents, reminders) with optional Trakt sync."""

from __future__ import annotations

import json
import os
import threading
import time
from pathlib import Path
from typing import Any

import httpx

from .trakt_auth import get_access_token as trakt_get_access_token

LIBRARY_PATH = Path(os.environ.get("VOD_LIBRARY_PATH", "data/vod_library.json"))
TRAKT_CLIENT_ID = os.environ.get("TRAKT_CLIENT_ID", "").strip()
TRAKT_ACCESS_TOKEN = os.environ.get("TRAKT_ACCESS_TOKEN", "").strip()
TRAKT_API = "https://api.trakt.tv"
MAX_RECENTS = int(os.environ.get("VOD_LIBRARY_RECENTS_MAX", "40"))

_lock = threading.Lock()
_store: dict[str, Any] | None = None


def _default_store() -> dict[str, Any]:
    return {"items": {}, "updated_at": None}


def _load() -> dict[str, Any]:
    global _store
    if _store is not None:
        return _store
    if LIBRARY_PATH.exists():
        try:
            data = json.loads(LIBRARY_PATH.read_text(encoding="utf-8"))
            if isinstance(data, dict) and isinstance(data.get("items"), dict):
                _store = data
                return _store
        except Exception:
            pass
    _store = _default_store()
    return _store


def _save(data: dict[str, Any]) -> None:
    global _store
    data["updated_at"] = time.time()
    LIBRARY_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = LIBRARY_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    tmp.replace(LIBRARY_PATH)
    _store = data


def item_key(media_type: str, tmdb_id: int | str) -> str:
    mt = "tv" if str(media_type) == "tv" else "movie"
    return f"{mt}:{int(tmdb_id)}"


def trakt_configured(session_id: str | None = None) -> bool:
    if session_id and trakt_get_access_token(session_id):
        return True
    return bool(TRAKT_CLIENT_ID and TRAKT_ACCESS_TOKEN)


def _trakt_headers(session_id: str | None = None) -> dict[str, str]:
    token = trakt_get_access_token(session_id or "") if session_id else TRAKT_ACCESS_TOKEN
    if not token:
        token = TRAKT_ACCESS_TOKEN
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "trakt-api-version": "2",
        "trakt-api-key": TRAKT_CLIENT_ID,
        "User-Agent": "StepDaddyLiveHD/1.0",
    }


def _trakt_payload(media_type: str, tmdb_id: int) -> dict[str, Any]:
    mt = "tv" if media_type == "tv" else "movie"
    return {mt + "s": [{"ids": {"tmdb": int(tmdb_id)}}]}


def _trakt_request(method: str, path: str, payload: dict | None = None, session_id: str | None = None) -> dict[str, Any]:
    if not trakt_configured(session_id):
        return {"ok": False, "error": "trakt_not_configured"}
    try:
        with httpx.Client(timeout=12.0) as client:
            r = client.request(method, TRAKT_API + path, headers=_trakt_headers(session_id), json=payload or {})
        if r.status_code >= 400:
            return {"ok": False, "error": "trakt_http_" + str(r.status_code), "detail": r.text[:200]}
        return {"ok": True, "status": r.status_code}
    except Exception as exc:
        return {"ok": False, "error": "trakt_request_failed", "detail": str(exc)[:200]}


def _sync_trakt(
    media_type: str,
    tmdb_id: int,
    item: dict[str, Any],
    prev: dict[str, Any],
    session_id: str | None = None,
) -> dict[str, Any]:
    if not trakt_configured(session_id):
        return {"trakt": "disabled"}
    results: dict[str, Any] = {}
    mt = "tv" if media_type == "tv" else "movie"
    payload = _trakt_payload(mt, tmdb_id)

    if item.get("watched") and not prev.get("watched"):
        results["history"] = _trakt_request("POST", "/sync/history", payload, session_id)
    elif not item.get("watched") and prev.get("watched"):
        results["history_remove"] = _trakt_request("POST", "/sync/history/remove", payload, session_id)

    if item.get("bookmark") and not prev.get("bookmark"):
        results["watchlist"] = _trakt_request("POST", "/sync/watchlist", payload, session_id)
    elif not item.get("bookmark") and prev.get("bookmark"):
        results["watchlist_remove"] = _trakt_request("POST", "/sync/watchlist/remove", payload, session_id)

    return results


def _normalize_item(raw: dict[str, Any] | None) -> dict[str, Any]:
    raw = raw or {}
    return {
        "tmdb_id": raw.get("tmdb_id"),
        "type": raw.get("type") or "movie",
        "title": raw.get("title") or "",
        "poster_url": raw.get("poster_url"),
        "year": raw.get("year"),
        "watched": bool(raw.get("watched")),
        "favorite": bool(raw.get("favorite")),
        "bookmark": bool(raw.get("bookmark")),
        "reminder_at": raw.get("reminder_at"),
        "last_viewed": raw.get("last_viewed"),
        "updated_at": raw.get("updated_at"),
        "progress_seconds": float(raw.get("progress_seconds") or 0),
        "duration_seconds": float(raw.get("duration_seconds") or 0),
        "percent": float(raw.get("percent") or 0),
        "season": raw.get("season"),
        "episode": raw.get("episode"),
        "progress_updated_at": raw.get("progress_updated_at"),
    }


def get_item(media_type: str, tmdb_id: int) -> dict[str, Any]:
    data = _load()
    key = item_key(media_type, tmdb_id)
    item = _normalize_item(data["items"].get(key))
    item["tmdb_id"] = int(tmdb_id)
    item["type"] = "tv" if media_type == "tv" else "movie"
    return item


def upsert_item(
    media_type: str,
    tmdb_id: int,
    patch: dict[str, Any],
    *,
    meta: dict[str, Any] | None = None,
    sync_trakt: bool = True,
    session_id: str | None = None,
) -> dict[str, Any]:
    with _lock:
        data = _load()
        key = item_key(media_type, tmdb_id)
        prev = _normalize_item(data["items"].get(key))
        item = dict(prev)
        item["tmdb_id"] = int(tmdb_id)
        item["type"] = "tv" if media_type == "tv" else "movie"
        if meta:
            for field in ("title", "poster_url", "year"):
                if meta.get(field) is not None:
                    item[field] = meta[field]
        for field in ("watched", "favorite", "bookmark", "reminder_at"):
            if field in patch:
                item[field] = patch[field]
        if item.get("reminder_at") in ("", None):
            item["reminder_at"] = None
        item["updated_at"] = time.time()
        trakt_result = _sync_trakt(item["type"], tmdb_id, item, prev, session_id) if sync_trakt else {"trakt": "skipped"}
        data["items"][key] = item
        _save(data)
        out = dict(item)
        out["trakt"] = trakt_result
        return out


def touch_recent(media_type: str, tmdb_id: int, meta: dict[str, Any] | None = None) -> dict[str, Any]:
    with _lock:
        data = _load()
        key = item_key(media_type, tmdb_id)
        item = _normalize_item(data["items"].get(key))
        item["tmdb_id"] = int(tmdb_id)
        item["type"] = "tv" if media_type == "tv" else "movie"
        if meta:
            for field in ("title", "poster_url", "year"):
                if meta.get(field) is not None:
                    item[field] = meta[field]
        item["last_viewed"] = time.time()
        item["updated_at"] = time.time()
        data["items"][key] = item
        recents = sorted(
            data["items"].values(),
            key=lambda x: float(x.get("last_viewed") or 0),
            reverse=True,
        )
        keep = {item_key(i.get("type", "movie"), i.get("tmdb_id")) for i in recents[:MAX_RECENTS]}
        for k in list(data["items"].keys()):
            if k not in keep and not any(
                data["items"][k].get(flag) for flag in ("watched", "favorite", "bookmark", "reminder_at")
            ):
                if data["items"][k].get("last_viewed") and k not in keep:
                    del data["items"][k]
        _save(data)
        return item


def list_items(kind: str = "all", limit: int = 50) -> list[dict[str, Any]]:
    data = _load()
    items = [_normalize_item(v) for v in data["items"].values()]
    kind = (kind or "all").lower()
    now = time.time()

    if kind == "recents":
        items = [i for i in items if i.get("last_viewed")]
        items.sort(key=lambda x: float(x.get("last_viewed") or 0), reverse=True)
    elif kind == "favorites":
        items = [i for i in items if i.get("favorite")]
        items.sort(key=lambda x: float(x.get("updated_at") or 0), reverse=True)
    elif kind == "bookmarks":
        items = [i for i in items if i.get("bookmark")]
        items.sort(key=lambda x: float(x.get("updated_at") or 0), reverse=True)
    elif kind == "watched":
        items = [i for i in items if i.get("watched")]
        items.sort(key=lambda x: float(x.get("updated_at") or 0), reverse=True)
    elif kind == "reminders":
        items = [i for i in items if i.get("reminder_at")]
        items.sort(key=lambda x: str(x.get("reminder_at") or ""))
    else:
        items.sort(key=lambda x: float(x.get("updated_at") or 0), reverse=True)

    out = []
    for item in items[: max(1, min(int(limit or 50), 100))]:
        if kind == "reminders" and item.get("reminder_at"):
            try:
                due = time.mktime(time.strptime(item["reminder_at"][:16], "%Y-%m-%dT%H:%M"))
                item = dict(item)
                item["reminder_due"] = due <= now
            except Exception:
                pass
        out.append(item)
    return out


def trakt_status(session_id: str | None = None) -> dict[str, Any]:
    from .trakt_auth import status as trakt_auth_status

    if session_id:
        st = trakt_auth_status(session_id)
        st["configured"] = st.get("connected") or trakt_configured(session_id)
        return st
    return {
        "configured": trakt_configured(None),
        "has_client_id": bool(TRAKT_CLIENT_ID),
        "has_access_token": bool(TRAKT_ACCESS_TOKEN),
    }


def _trakt_scrobble_payload(
    media_type: str,
    tmdb_id: int,
    progress: float,
    *,
    season: int | None = None,
    episode: int | None = None,
) -> dict[str, Any]:
    mt = "tv" if media_type == "tv" else "movie"
    body: dict[str, Any] = {"progress": max(0.0, min(100.0, float(progress)))}
    if mt == "movie":
        body["movie"] = {"ids": {"tmdb": int(tmdb_id)}}
    else:
        body["show"] = {"ids": {"tmdb": int(tmdb_id)}}
        if season is not None and episode is not None:
            body["episode"] = {"season": int(season), "number": int(episode)}
    return body


def trakt_scrobble(
    action: str,
    media_type: str,
    tmdb_id: int,
    progress: float,
    *,
    season: int | None = None,
    episode: int | None = None,
    session_id: str | None = None,
) -> dict[str, Any]:
    action = (action or "pause").strip().lower()
    if action not in ("start", "pause", "stop"):
        return {"ok": False, "error": "invalid_action"}
    if not trakt_configured(session_id):
        return {"ok": False, "error": "trakt_not_configured"}
    payload = _trakt_scrobble_payload(
        media_type, tmdb_id, progress, season=season, episode=episode
    )
    return _trakt_request("POST", f"/scrobble/{action}", payload, session_id)


def update_progress(
    media_type: str,
    tmdb_id: int,
    *,
    progress_seconds: float,
    duration_seconds: float = 0,
    season: int | None = None,
    episode: int | None = None,
    meta: dict[str, Any] | None = None,
    scrobble: str | None = None,
    session_id: str | None = None,
) -> dict[str, Any]:
    progress_seconds = max(0.0, float(progress_seconds or 0))
    duration_seconds = max(0.0, float(duration_seconds or 0))
    percent = 0.0
    if duration_seconds > 1:
        percent = round(min(100.0, (progress_seconds / duration_seconds) * 100.0), 2)
    with _lock:
        data = _load()
        key = item_key(media_type, tmdb_id)
        item = _normalize_item(data["items"].get(key))
        item["tmdb_id"] = int(tmdb_id)
        item["type"] = "tv" if media_type == "tv" else "movie"
        if meta:
            for field in ("title", "poster_url", "year"):
                if meta.get(field) is not None:
                    item[field] = meta[field]
        item["progress_seconds"] = progress_seconds
        item["duration_seconds"] = duration_seconds
        item["percent"] = percent
        if season is not None:
            item["season"] = int(season)
        if episode is not None:
            item["episode"] = int(episode)
        now = time.time()
        item["progress_updated_at"] = now
        item["last_viewed"] = now
        item["updated_at"] = now
        if percent >= 95:
            item["watched"] = True
        data["items"][key] = item
        _save(data)
        out = dict(item)
    if scrobble:
        out["trakt_scrobble"] = trakt_scrobble(
            scrobble,
            media_type,
            tmdb_id,
            percent,
            season=season,
            episode=episode,
            session_id=session_id,
        )
    return out


def list_continue_watching(limit: int = 24) -> list[dict[str, Any]]:
    data = _load()
    items = [_normalize_item(v) for v in data["items"].values()]
    cont = []
    for item in items:
        pct = float(item.get("percent") or 0)
        if pct < 2 or pct >= 95:
            continue
        if float(item.get("progress_seconds") or 0) < 5:
            continue
        cont.append(item)
    cont.sort(
        key=lambda x: float(x.get("progress_updated_at") or x.get("last_viewed") or 0),
        reverse=True,
    )
    return cont[: max(1, min(int(limit or 24), 40))]
