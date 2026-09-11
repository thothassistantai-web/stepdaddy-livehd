"""Music library + playlist API — light server sync for public/collaborative/listening-party.

Local-first clients own private data in IndexedDB/localStorage. This module stores
shareable playlists (public discover, invite-code join, collaborative upsert).
"""
from __future__ import annotations

import json
import os
import re
import threading
import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(tags=["music-library"])

_CODE_RE = re.compile(r"^[A-Z0-9]{4,12}$")
_LOCK = threading.Lock()

_DATA_DIR = Path(
    os.environ.get(
        "MUSIC_LIBRARY_DATA_DIR",
        str(Path(__file__).resolve().parent.parent / "data" / "music_library"),
    )
)
_PLAYLISTS_PATH = _DATA_DIR / "playlists.json"


def _empty() -> dict[str, Any]:
    return {"v": 1, "playlists": {}, "updatedAt": time.time()}


def _load() -> dict[str, Any]:
    try:
        if _PLAYLISTS_PATH.exists():
            raw = json.loads(_PLAYLISTS_PATH.read_text(encoding="utf-8"))
            if isinstance(raw, dict) and isinstance(raw.get("playlists"), dict):
                return raw
    except Exception:
        pass
    return _empty()


def _save(data: dict[str, Any]) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = _PLAYLISTS_PATH.with_suffix(".tmp")
    data["updatedAt"] = time.time()
    tmp.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp.replace(_PLAYLISTS_PATH)


def _slim(pl: dict[str, Any]) -> dict[str, Any]:
    tracks = pl.get("tracks") or []
    if not isinstance(tracks, list):
        tracks = []
    tracks = tracks[:250]
    return {
        "id": pl.get("id"),
        "title": (pl.get("title") or "Playlist")[:80],
        "description": (pl.get("description") or "")[:240],
        "visibility": pl.get("visibility") if pl.get("visibility") in ("public", "private") else "private",
        "collaborative": bool(pl.get("collaborative")),
        "listeningParty": bool(pl.get("listeningParty")),
        "inviteCode": str(pl.get("inviteCode") or "").upper()[:12],
        "ownerId": str(pl.get("ownerId") or "")[:64],
        "trackCount": len(tracks),
        "tracks": tracks,
        "cover": pl.get("cover") or "",
        "updatedAt": pl.get("updatedAt") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "partyActive": bool(pl.get("partyActive")),
        "createdAt": pl.get("createdAt") or "",
    }


def _can_view(pl: dict[str, Any], owner_id: str | None = None) -> bool:
    vis = pl.get("visibility") or "private"
    if vis == "public" or pl.get("collaborative") or pl.get("listeningParty"):
        return True
    if owner_id and owner_id == pl.get("ownerId"):
        return True
    return False


@router.get("/api/music/library/status")
async def library_status() -> dict[str, Any]:
    with _LOCK:
        data = _load()
        n = len(data.get("playlists") or {})
    return {"ok": True, "playlists": n, "localFirst": True}


@router.post("/api/music/library/sync")
async def library_sync(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "invalid_json"}, status_code=400)
    owner = str((body or {}).get("ownerId") or "")[:64]
    pls = (body or {}).get("playlists") or []
    if not isinstance(pls, list):
        return JSONResponse({"error": "invalid_playlists"}, status_code=400)
    saved = 0
    with _LOCK:
        data = _load()
        store: dict[str, Any] = data.setdefault("playlists", {})
        for raw in pls[:40]:
            if not isinstance(raw, dict) or not raw.get("id"):
                continue
            pl = _slim(raw)
            if owner:
                pl["ownerId"] = owner
            # Only persist shareable playlists
            if pl["visibility"] != "public" and not pl["collaborative"] and not pl["listeningParty"]:
                continue
            if not pl["inviteCode"]:
                continue
            store[str(pl["id"])] = pl
            saved += 1
        _save(data)
    return JSONResponse({"ok": True, "saved": saved})


@router.post("/api/music/playlist/upsert")
async def playlist_upsert(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "invalid_json"}, status_code=400)
    if not isinstance(body, dict) or not body.get("id"):
        return JSONResponse({"error": "missing_id"}, status_code=400)
    pl = _slim(body)
    if pl["visibility"] != "public" and not pl["collaborative"] and not pl["listeningParty"]:
        return JSONResponse({"error": "private_local_only", "hint": "private playlists stay on-device"}, status_code=400)
    if not pl["inviteCode"] or not _CODE_RE.match(pl["inviteCode"]):
        return JSONResponse({"error": "invite_required"}, status_code=400)
    with _LOCK:
        data = _load()
        data.setdefault("playlists", {})[str(pl["id"])] = pl
        _save(data)
    return JSONResponse({"ok": True, "playlist": pl})


@router.get("/api/music/playlist/public")
async def playlist_public(limit: int = 24) -> dict[str, Any]:
    limit = max(1, min(int(limit or 24), 48))
    with _LOCK:
        data = _load()
        items = []
        for pl in (data.get("playlists") or {}).values():
            if not isinstance(pl, dict):
                continue
            if pl.get("visibility") == "public" or pl.get("listeningParty"):
                items.append(
                    {
                        "id": pl.get("id"),
                        "title": pl.get("title"),
                        "description": pl.get("description"),
                        "cover": pl.get("cover"),
                        "trackCount": pl.get("trackCount") or len(pl.get("tracks") or []),
                        "inviteCode": pl.get("inviteCode"),
                        "listeningParty": bool(pl.get("listeningParty")),
                        "collaborative": bool(pl.get("collaborative")),
                        "partyActive": bool(pl.get("partyActive")),
                        "updatedAt": pl.get("updatedAt"),
                    }
                )
        items.sort(key=lambda x: str(x.get("updatedAt") or ""), reverse=True)
    return {"playlists": items[:limit]}


@router.get("/api/music/playlist/join/{code}")
async def playlist_join(code: str) -> JSONResponse:
    code = (code or "").strip().upper()
    if not _CODE_RE.match(code):
        return JSONResponse({"error": "invalid_code"}, status_code=400)
    with _LOCK:
        data = _load()
        hit = None
        for pl in (data.get("playlists") or {}).values():
            if isinstance(pl, dict) and str(pl.get("inviteCode") or "").upper() == code:
                hit = pl
                break
    if not hit:
        return JSONResponse({"error": "not_found"}, status_code=404)
    if not _can_view(hit):
        return JSONResponse({"error": "private"}, status_code=403)
    return JSONResponse(_slim(hit))


@router.get("/api/music/playlist/{playlist_id}")
async def playlist_get(playlist_id: str, ownerId: str | None = None) -> JSONResponse:
    with _LOCK:
        data = _load()
        pl = (data.get("playlists") or {}).get(playlist_id)
    if not pl:
        return JSONResponse({"error": "not_found"}, status_code=404)
    if not _can_view(pl, ownerId):
        return JSONResponse({"error": "private"}, status_code=403)
    return JSONResponse(_slim(pl))


@router.delete("/api/music/playlist/{playlist_id}")
async def playlist_delete(playlist_id: str, ownerId: str | None = None) -> JSONResponse:
    with _LOCK:
        data = _load()
        store = data.setdefault("playlists", {})
        pl = store.get(playlist_id)
        if not pl:
            return JSONResponse({"ok": True, "deleted": False})
        if ownerId and pl.get("ownerId") and ownerId != pl.get("ownerId"):
            return JSONResponse({"error": "forbidden"}, status_code=403)
        store.pop(playlist_id, None)
        _save(data)
    return JSONResponse({"ok": True, "deleted": True})
