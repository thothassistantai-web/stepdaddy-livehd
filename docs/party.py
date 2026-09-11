"""Household watch-party rooms: chat, reactions, remote, HLS clock sync."""

from __future__ import annotations

import asyncio
import hashlib
import os
import re
import secrets
import time
import urllib.parse
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse

from StepDaddyLiveHD.party_pages import render_party_join_page

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 5
MAX_MEMBERS = 8
NAME_MAX = 64
IDLE_MS = 30 * 60 * 1000
CHAT_MAX = 200
REACTION_COOLDOWN_MS = 400
REMOTE_TOKEN_TTL = 15 * 60
PARTY_REACTIONS = frozenset({"👍", "👎", "❤️", "😂", "😮", "👏", "🎉", "🔥", "😢"})
UPLOAD_MAX_BYTES = int(os.environ.get("PARTY_UPLOAD_MAX_BYTES", str(2 * 1024 * 1024)))
UPLOAD_DIR = Path(os.environ.get("PARTY_UPLOAD_DIR", str(Path(__file__).resolve().parent / "player_assets" / "party_uploads")))
FEATURE_KEYS = (
    "chat_text",
    "chat_gif",
    "chat_voice_note",
    "av_voice",
    "av_video",
    "sync_vod",
    "sync_wait_buffering",
)
DEFAULT_FEATURES: dict[str, bool] = {
    "chat_text": True,
    "chat_gif": True,
    "chat_voice_note": True,
    "av_voice": True,
    "av_video": True,
    "sync_vod": True,
    "sync_wait_buffering": False,
}
SYNC_LIVE_MODES = frozenset({"off", "content", "catchup", "lag", "pdt"})
DEFAULT_SYNC_LIVE_MODE = "content"
LAN_PRESENCE_TTL_S = 75.0
LAN_HEARTBEAT_MIN_S = 8.0
LAN_FP_RE = re.compile(r"^[a-f0-9]{8,64}$", re.I)
LAN_KEY_RE = re.compile(r"^[A-Z0-9]{4,6}$")
_GIF_URL_OK = re.compile(r"^https://[^\s<>\"']+\.(?:gif|webp|mp4)(?:\?[^\s<>\"']*)?$", re.I)
_GIF_HOST_OK = re.compile(
    r"^https://(?:media\d*\.giphy\.com|i\.giphy\.com|media\.tenor\.com|c\.tenor\.com|media1\.tenor\.com)/",
    re.I,
)

router = APIRouter()


@dataclass
class Member:
    id: str
    display_name: str
    kind: str  # player | companion | remote
    role: str  # host | guest
    ws: WebSocket
    buffering: bool = False
    client_id: str = ""


@dataclass
class Room:
    code: str
    host_id: str
    host_key: str
    content: dict[str, Any]
    clock: dict[str, Any]
    members: dict[str, Member] = field(default_factory=dict)
    chat: list[dict[str, Any]] = field(default_factory=list)
    last_active: float = field(default_factory=time.time)
    password_hash: str | None = None
    name: str = ""
    is_public: bool = False
    room_number: int = 0
    admins: set[str] = field(default_factory=set)  # member ids; host is always admin
    features: dict[str, bool] = field(default_factory=lambda: dict(DEFAULT_FEATURES))
    sync_live_mode: str = DEFAULT_SYNC_LIVE_MODE
    catchup_url: str | None = None
    wait_for_buffering: bool = False


def _normalize_sync_live_mode(raw: Any) -> str:
    mode = str(raw or DEFAULT_SYNC_LIVE_MODE).strip().lower()
    if mode in SYNC_LIVE_MODES:
        return mode
    return DEFAULT_SYNC_LIVE_MODE


_rooms: dict[str, Room] = {}
_remote_tokens: dict[str, dict[str, Any]] = {}
_reaction_at: dict[str, float] = {}
# LAN / nearby presence beacons (server-assisted same-network discovery).
# code -> {code, name, title, watchPath, locked, public, networkFingerprint, publicIpHash, lanKey, ts, hostKey}
_lan_presence: dict[str, dict[str, Any]] = {}
_lan_heartbeat_at: dict[str, float] = {}
_member_seq = 0
_room_number_seq = 100
_lock = asyncio.Lock()
# channelId -> logo URL (best-effort; filled lazily from catalog)
_channel_logo_cache: dict[str, str | None] = {}
_channel_logo_cache_ts: float = 0.0
_CHANNEL_LOGO_CACHE_TTL_S = 120.0


def _refresh_channel_logo_cache(force: bool = False) -> None:
    """Best-effort map of live channel ids → logo paths for party cards."""
    global _channel_logo_cache, _channel_logo_cache_ts
    now = time.time()
    if (
        not force
        and _channel_logo_cache
        and (now - _channel_logo_cache_ts) < _CHANNEL_LOGO_CACHE_TTL_S
    ):
        return
    logos: dict[str, str | None] = {}
    try:
        from StepDaddyLiveHD.backend import get_channels

        for ch in get_channels(include_dead=True, force_refresh=False) or []:
            cid = str(getattr(ch, "id", "") or "").strip()
            if not cid:
                continue
            logo = getattr(ch, "logo", None)
            logos[cid] = str(logo).strip() if logo else None
    except Exception:
        try:
            from StepDaddyLiveHD import step_daddy

            for ch in getattr(step_daddy, "channels", []) or []:
                cid = str(getattr(ch, "id", "") or "").strip()
                if not cid:
                    continue
                logo = getattr(ch, "logo", None)
                logos[cid] = str(logo).strip() if logo else None
        except Exception:
            return
    _channel_logo_cache = logos
    _channel_logo_cache_ts = now


def _lookup_channel_logo(channel_id: Any) -> str | None:
    cid = str(channel_id or "").strip()
    if not cid:
        return None
    _refresh_channel_logo_cache()
    logo = _channel_logo_cache.get(cid)
    return logo if logo else None


def _usable_art_url(raw: Any) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s or s.lower() in {"null", "undefined", "none"}:
        return None
    return s


def _content_logo_path(content: dict[str, Any] | None) -> str | None:
    c = content if isinstance(content, dict) else {}
    direct = _usable_art_url(c.get("logoPath") or c.get("logo_path") or c.get("logo"))
    if direct:
        return direct
    return _lookup_channel_logo(c.get("channelId") or c.get("channel_id"))


def _content_poster_path(content: dict[str, Any] | None) -> str | None:
    """Poster for cards: VOD poster → explicit logo → channel catalog logo."""
    c = content if isinstance(content, dict) else {}
    poster = _usable_art_url(
        c.get("posterPath") or c.get("poster_url") or c.get("poster_path") or c.get("image")
    )
    if poster:
        return poster
    return _content_logo_path(c)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-real-ip") or request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host or "unknown"
    return "unknown"


def _public_ip_hash(ip: str) -> str:
    raw = (ip or "unknown").strip().lower()
    return hashlib.sha256(f"pubip:{raw}".encode("utf-8")).hexdigest()[:24]


def _normalize_fp(raw: Any) -> str:
    fp = str(raw or "").strip().lower()
    if not LAN_FP_RE.match(fp):
        return ""
    return fp[:64]


def _normalize_lan_key(raw: Any) -> str:
    key = str(raw or "").strip().upper()
    if not LAN_KEY_RE.match(key):
        return ""
    return key


def _new_lan_key() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(4))


def _purge_lan_presence(now: float | None = None) -> None:
    ts = now if now is not None else time.time()
    dead = [c for c, row in _lan_presence.items() if ts - float(row.get("ts") or 0) > LAN_PRESENCE_TTL_S]
    for c in dead:
        _lan_presence.pop(c, None)
        _lan_heartbeat_at.pop(c, None)


def _nearby_card(row: dict[str, Any]) -> dict[str, Any]:
    """Public nearby card — never includes passwords or host keys."""
    age = max(0, int(time.time() - float(row.get("ts") or 0)))
    content = row.get("content") if isinstance(row.get("content"), dict) else {}
    code = str(row.get("code") or "")
    room = _rooms.get(code) if code else None
    if room and isinstance(room.content, dict):
        content = room.content
    channel_id = (
        row.get("channelId")
        or content.get("channelId")
        or content.get("channel_id")
    )
    poster = _usable_art_url(row.get("posterPath")) or _content_poster_path(content)
    logo = _usable_art_url(row.get("logoPath")) or _content_logo_path(content)
    return {
        "code": row.get("code"),
        "name": row.get("name") or "Watch Party",
        "title": row.get("title") or "",
        "watchPath": row.get("watchPath") or "/tv/",
        "locked": bool(row.get("locked")),
        "public": bool(row.get("public")),
        "lanKey": row.get("lanKey") or None,
        "memberCount": row.get("memberCount"),
        "ageSeconds": age,
        "match": row.get("match") or "network",
        "posterPath": poster,
        "logoPath": logo,
        "channelId": channel_id,
        "mediaType": content.get("mediaType") or row.get("mediaType") or None,
    }


def _default_features() -> dict[str, bool]:
    return dict(DEFAULT_FEATURES)


def _normalize_features(raw: dict[str, Any] | None) -> dict[str, bool]:
    out = _default_features()
    if not isinstance(raw, dict):
        return out
    for key in FEATURE_KEYS:
        if key in raw:
            out[key] = bool(raw[key])
    return out


def _feature_on(room: Room, key: str) -> bool:
    feats = room.features or DEFAULT_FEATURES
    if key in feats:
        return bool(feats[key])
    return bool(DEFAULT_FEATURES.get(key, False))


def _is_admin(room: Room, me: Member | None) -> bool:
    if not me:
        return False
    if me.role == "host" or me.id == room.host_id:
        return True
    return me.id in (room.admins or set())


def _admin_ids(room: Room) -> list[str]:
    ids = set(room.admins or set())
    if room.host_id:
        ids.add(room.host_id)
    return sorted(ids)


def _code() -> str:
    for _ in range(30):
        c = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
        if c not in _rooms:
            return c
    return secrets.token_hex(3).upper()


def _next_room_number() -> int:
    global _room_number_seq
    _room_number_seq += 1
    return _room_number_seq


def _default_room_name(content: dict[str, Any] | None, room_number: int, code: str) -> str:
    title = str((content or {}).get("title") or "").strip() or "Watch Party"
    # Keep titles readable; always append a room number (not the short invite code alone).
    base = f"{title} · Room {room_number}"
    if len(base) > NAME_MAX:
        keep = max(12, NAME_MAX - len(f" · Room {room_number}") - 1)
        base = f"{title[:keep].rstrip()}… · Room {room_number}"
    return base[:NAME_MAX]


def _sanitize_name(name: str | None, fallback: str) -> str:
    cleaned = " ".join(str(name or "").split()).strip()
    if len(cleaned) < 3:
        return fallback[:NAME_MAX]
    return cleaned[:NAME_MAX]


def _public_member(m: Member) -> dict[str, Any]:
    return {
        "id": m.id,
        "displayName": m.display_name,
        "kind": m.kind,
        "role": m.role,
        "buffering": m.buffering,
        "clientId": m.client_id or None,
    }


def _normalize_content(raw: dict[str, Any] | None) -> dict[str, Any]:
    c = raw if isinstance(raw, dict) else {}
    channel_id = c.get("channelId") or c.get("channel_id")
    poster = _usable_art_url(
        c.get("posterPath") or c.get("poster_url") or c.get("poster_path") or c.get("image")
    )
    logo = _usable_art_url(c.get("logoPath") or c.get("logo_path") or c.get("logo"))
    if not logo and channel_id:
        logo = _lookup_channel_logo(channel_id)
    if not poster:
        poster = logo
    return {
        "tmdbId": c.get("tmdbId") or c.get("tmdb_id"),
        "mediaType": c.get("mediaType") or c.get("type") or "movie",
        "title": str(c.get("title") or "Untitled")[:200],
        "posterPath": poster,
        "logoPath": logo,
        "season": c.get("season"),
        "episode": c.get("episode"),
        "channelId": channel_id,
        "hls": bool(c.get("hls")),
    }


def _member_count(room: Room) -> int:
    return sum(1 for m in room.members.values() if m.kind != "remote")


def _public_room(room: Room) -> dict[str, Any]:
    return {
        "code": room.code,
        "name": room.name or _default_room_name(room.content, room.room_number or 0, room.code),
        "roomNumber": room.room_number,
        "hostId": room.host_id,
        "content": room.content,
        "clock": room.clock,
        "members": [_public_member(m) for m in room.members.values()],
        "memberCount": _member_count(room),
        "chat": room.chat[-50:],
        "locked": bool(room.password_hash),
        "public": bool(room.is_public),
        "admins": _admin_ids(room),
        "features": _normalize_features(room.features),
        "syncLiveMode": _normalize_sync_live_mode(room.sync_live_mode),
        "catchupUrl": room.catchup_url,
        "waitForBuffering": bool(room.wait_for_buffering or _feature_on(room, "sync_wait_buffering")),
    }


def _list_card(room: Room) -> dict[str, Any]:
    content = room.content or {}
    media = str(content.get("mediaType") or "movie").lower()
    channel_id = content.get("channelId") or content.get("channel_id")
    poster = _content_poster_path(content)
    logo = _content_logo_path(content)
    return {
        "code": room.code,
        "name": room.name or _default_room_name(content, room.room_number or 0, room.code),
        "roomNumber": room.room_number,
        "title": content.get("title") or "",
        "posterPath": poster,
        "logoPath": logo,
        "mediaType": media,
        "channelId": channel_id,
        "memberCount": _member_count(room),
        "locked": bool(room.password_hash),
        "watchPath": _content_watch_path(content),
    }


async def _broadcast(room: Room, msg: dict[str, Any], except_id: str | None = None) -> None:
    dead: list[str] = []
    for mid, m in room.members.items():
        if except_id and mid == except_id:
            continue
        try:
            await m.ws.send_json(msg)
        except Exception:
            dead.append(mid)
    for mid in dead:
        room.members.pop(mid, None)


def _purge_idle() -> None:
    now = time.time() * 1000
    dead = [c for c, r in _rooms.items() if now - r.last_active * 1000 > IDLE_MS and not r.members]
    for c in dead:
        _rooms.pop(c, None)
        _lan_presence.pop(c, None)
        _lan_heartbeat_at.pop(c, None)
    expired = [t for t, meta in _remote_tokens.items() if meta.get("exp", 0) < time.time()]
    for t in expired:
        _remote_tokens.pop(t, None)
    _purge_lan_presence()


def create_remote_token(host_session: str, channel_id: str | None = None, room_code: str | None = None) -> dict[str, Any]:
    _purge_idle()
    token = secrets.token_urlsafe(18)
    _remote_tokens[token] = {
        "host_session": host_session,
        "channel_id": channel_id or "",
        "room_code": (room_code or "").upper(),
        "exp": time.time() + REMOTE_TOKEN_TTL,
    }
    return {"token": token, "expires_in": REMOTE_TOKEN_TTL}


def remote_token_ok(token: str) -> dict[str, Any] | None:
    meta = _remote_tokens.get(token or "")
    if not meta or meta.get("exp", 0) < time.time():
        return None
    return meta


def _content_watch_path(content: dict[str, Any] | None) -> str:
    """Build in-app path for room content (VOD or live channel)."""
    c = content or {}
    tmdb = c.get("tmdbId") or c.get("tmdb_id")
    channel = c.get("channelId") or c.get("channel_id")
    media = str(c.get("mediaType") or c.get("type") or "movie").lower()
    # Live channel parties follow the channel, not a leftover VOD id.
    if media in ("live", "channel", "tv-live") or (channel and not tmdb):
        if channel:
            return f"/tv/{channel}"
        return "/tv/"
    if tmdb:
        imdb = str(c.get("imdbId") or c.get("imdb_id") or "").strip()
        if media in ("tv", "series", "show"):
            path = f"/vod/tv/{int(tmdb)}"
            qs = []
            if imdb.startswith("tt"):
                qs.append(f"imdb={urllib.parse.quote(imdb)}")
            if c.get("season"):
                qs.append(f"season={int(c['season'])}")
            if c.get("episode"):
                qs.append(f"episode={int(c['episode'])}")
            return path + (("?" + "&".join(qs)) if qs else "")
        path = f"/vod/movie/{int(tmdb)}"
        if imdb.startswith("tt"):
            return path + "?imdb=" + urllib.parse.quote(imdb)
        return path
    if channel:
        return f"/tv/{channel}"
    return "/tv/"


def _hash_password(pwd: str) -> str:
    return hashlib.sha256(pwd.encode("utf-8")).hexdigest()


@router.post("/party/create")
async def party_create(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}
    content = _normalize_content(body.get("content") if isinstance(body.get("content"), dict) else {})
    code = _code()
    host_key = secrets.token_urlsafe(12)
    room_number = _next_room_number()
    fallback = _default_room_name(content, room_number, code)
    room = Room(
        code=code,
        host_id="",
        host_key=host_key,
        content=content,
        clock={"positionSeconds": 0, "paused": True, "updatedAt": int(time.time() * 1000)},
        name=_sanitize_name(body.get("name"), fallback),
        is_public=bool(body.get("public") or body.get("is_public")),
        room_number=room_number,
    )
    pwd = str(body.get("password") or "").strip()
    if pwd:
        room.password_hash = _hash_password(pwd)
    _rooms[code] = room
    join_path = f"/party/join/{code}"
    return {
        "ok": True,
        "code": code,
        "hostKey": host_key,
        "name": room.name,
        "roomNumber": room.room_number,
        "public": room.is_public,
        "join_path": join_path,
        "watch_path": _content_watch_path(room.content),
        "qr_payload": join_path,
        "room": _public_room(room),
    }


@router.get("/party/public")
async def party_public_list():
    """Discoverable public rooms (still PIN-gated by middleware)."""
    _purge_idle()
    rooms = [
        _list_card(r)
        for r in sorted(_rooms.values(), key=lambda x: (-_member_count(x), -x.last_active))
        if r.is_public and _member_count(r) > 0
    ]
    private_rooms = sum(1 for r in _rooms.values() if not r.is_public and _member_count(r) > 0)
    return {"ok": True, "rooms": rooms[:40], "privateRooms": private_rooms}


@router.get("/catchup/{party_code}/index.m3u8")
async def catchup_playlist(party_code: str):
    from StepDaddyLiveHD import catchup as catchup_mod
    from fastapi.responses import FileResponse

    code = (party_code or "").upper()
    catchup_mod.touch(code)
    path = catchup_mod.playlist_path(code)
    if not path.exists():
        return JSONResponse({"ok": False, "error": "not_ready"}, status_code=404)
    return FileResponse(path, media_type="application/vnd.apple.mpegurl")


@router.get("/catchup/{party_code}/{segment}")
async def catchup_segment(party_code: str, segment: str):
    from StepDaddyLiveHD import catchup as catchup_mod
    from fastapi.responses import FileResponse

    code = (party_code or "").upper()
    if "/" in segment or "\\" in segment or ".." in segment:
        return JSONResponse({"ok": False, "error": "bad_segment"}, status_code=400)
    catchup_mod.touch(code)
    path = catchup_mod._session_dir(code) / segment
    if not path.exists() or not path.is_file():
        return JSONResponse({"ok": False, "error": "missing"}, status_code=404)
    ctype = "video/mp2t" if segment.endswith(".ts") else "application/octet-stream"
    return FileResponse(path, media_type=ctype)


@router.get("/party/presence")
async def party_presence():
    """Lightweight who’s-online across rooms (PIN-gated). Private codes are not leaked."""
    _purge_idle()
    online: list[dict[str, Any]] = []
    for room in sorted(_rooms.values(), key=lambda x: -_member_count(x)):
        for m in room.members.values():
            if m.kind == "remote":
                continue
            content = room.content if isinstance(room.content, dict) else {}
            card: dict[str, Any] = {
                "displayName": m.display_name,
                "title": content.get("title") or "",
                "public": bool(room.is_public),
                "roomName": room.name
                if room.is_public
                else (room.name or "Private room"),
                "posterPath": _content_poster_path(content),
                "logoPath": _content_logo_path(content),
                "channelId": content.get("channelId") or content.get("channel_id"),
            }
            if room.is_public:
                card["code"] = room.code
                card["watchPath"] = _content_watch_path(room.content)
            online.append(card)
    private_rooms = sum(1 for r in _rooms.values() if not r.is_public and _member_count(r) > 0)
    return {
        "ok": True,
        "online": online[:60],
        "inParties": len(online),
        "privateRooms": private_rooms,
    }


@router.post("/party/presence/lan")
async def party_presence_lan(request: Request):
    """Host heartbeat: announce this party as discoverable on the same Wi‑Fi / household.

    Clients send a networkFingerprint (hash of local RFC1918 /24) when WebRTC/LAN
    probe works. Server also records a hash of the public client IP so guests behind
    the same NAT can discover without a LAN probe. Never stores or returns passwords.
    """
    _purge_idle()
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}

    code = str(body.get("code") or "").strip().upper()
    if not code or code not in _rooms:
        return JSONResponse({"ok": False, "error": "not_found"}, status_code=404)
    room = _rooms[code]
    host_key = str(body.get("hostKey") or body.get("host_key") or "").strip()
    if not host_key or host_key != room.host_key:
        return JSONResponse({"ok": False, "error": "forbidden"}, status_code=403)

    visible = body.get("visible")
    if visible is None:
        visible = body.get("appearNearby", True)
    if not bool(visible):
        _lan_presence.pop(code, None)
        _lan_heartbeat_at.pop(code, None)
        return {"ok": True, "visible": False, "cleared": True}

    now = time.time()
    last = float(_lan_heartbeat_at.get(code) or 0)
    if now - last < LAN_HEARTBEAT_MIN_S and code in _lan_presence:
        row = _lan_presence[code]
        return {
            "ok": True,
            "visible": True,
            "throttled": True,
            "lanKey": row.get("lanKey"),
            "expiresIn": max(0, int(LAN_PRESENCE_TTL_S - (now - float(row.get("ts") or now)))),
        }

    fp = _normalize_fp(body.get("networkFingerprint") or body.get("fingerprint"))
    lan_key = _normalize_lan_key(body.get("lanKey") or body.get("lan_key"))
    existing = _lan_presence.get(code) or {}
    if not lan_key:
        lan_key = _normalize_lan_key(existing.get("lanKey")) or _new_lan_key()

    pub_hash = _public_ip_hash(_client_ip(request))
    title = str(body.get("title") or (room.content or {}).get("title") or "")[:200]
    name = _sanitize_name(body.get("name"), room.name or _default_room_name(room.content, room.room_number or 0, code))
    watch = str(body.get("watchPath") or body.get("watch_path") or _content_watch_path(room.content) or "/tv/")[:240]

    content = room.content if isinstance(room.content, dict) else {}
    _lan_presence[code] = {
        "code": code,
        "name": name,
        "title": title,
        "watchPath": watch,
        "locked": bool(room.password_hash),
        "public": bool(room.is_public),
        "networkFingerprint": fp or existing.get("networkFingerprint") or "",
        "publicIpHash": pub_hash,
        "lanKey": lan_key,
        "memberCount": _member_count(room),
        "posterPath": _content_poster_path(content),
        "logoPath": _content_logo_path(content),
        "channelId": content.get("channelId") or content.get("channel_id"),
        "mediaType": content.get("mediaType"),
        "ts": now,
    }
    _lan_heartbeat_at[code] = now
    return {
        "ok": True,
        "visible": True,
        "lanKey": lan_key,
        "hasFingerprint": bool(_lan_presence[code].get("networkFingerprint")),
        "expiresIn": int(LAN_PRESENCE_TTL_S),
        "ttlSeconds": int(LAN_PRESENCE_TTL_S),
    }


@router.get("/party/nearby")
async def party_nearby(
    request: Request,
    fp: str = "",
    fingerprint: str = "",
    lanKey: str = "",
    lan_key: str = "",
):
    """List parties visible on this Wi‑Fi / household (PIN-gated like /party/presence)."""
    _purge_idle()
    guest_fp = _normalize_fp(fp or fingerprint)
    guest_key = _normalize_lan_key(lanKey or lan_key)
    guest_pub = _public_ip_hash(_client_ip(request))
    now = time.time()
    matches: list[dict[str, Any]] = []

    for row in _lan_presence.values():
        age = now - float(row.get("ts") or 0)
        if age > LAN_PRESENCE_TTL_S:
            continue
        code = str(row.get("code") or "")
        room = _rooms.get(code)
        if room:
            row["locked"] = bool(room.password_hash)
            row["public"] = bool(room.is_public)
            row["name"] = room.name or row.get("name")
            row["title"] = (room.content or {}).get("title") or row.get("title") or ""
            row["watchPath"] = _content_watch_path(room.content)
            row["memberCount"] = _member_count(room)
            row["posterPath"] = _content_poster_path(room.content)
            row["logoPath"] = _content_logo_path(room.content)
            row["channelId"] = (room.content or {}).get("channelId") or (room.content or {}).get("channel_id")
        host_fp = _normalize_fp(row.get("networkFingerprint"))
        host_pub = str(row.get("publicIpHash") or "")
        host_lan = _normalize_lan_key(row.get("lanKey"))
        match_kind = ""
        if guest_key and host_lan and guest_key == host_lan:
            match_kind = "lanKey"
        elif guest_fp and host_fp and guest_fp == host_fp:
            match_kind = "fingerprint"
        elif (not guest_fp or not host_fp) and host_pub and guest_pub == host_pub:
            # Soft household match when LAN probe unavailable on either side.
            match_kind = "publicIp"
        elif guest_fp and host_fp and guest_fp != host_fp:
            # Explicit fingerprint disagreement — do not fall back to public IP.
            match_kind = ""
        if not match_kind:
            continue
        card = _nearby_card(row)
        card["match"] = match_kind
        # Never echo lanKey unless the guest already supplied the matching key
        # (avoids leaking the short Wi‑Fi code to random household PIN users).
        if match_kind != "lanKey":
            card.pop("lanKey", None)
        matches.append(card)

    matches.sort(key=lambda c: (0 if c.get("match") == "lanKey" else 1 if c.get("match") == "fingerprint" else 2, -(c.get("memberCount") or 0)))
    return {
        "ok": True,
        "rooms": matches[:40],
        "count": len(matches),
        "ttlSeconds": int(LAN_PRESENCE_TTL_S),
        "hasFingerprint": bool(guest_fp),
    }


RESERVED_PARTY_CODES = frozenset(
    {
        "HOME",
        "PUBLIC",
        "PRESENCE",
        "NEARBY",
        "CREATE",
        "JOIN",
        "GIFS",
        "UPLOAD",
        "REMOTE-TOKEN",
    }
)


@router.get("/party/gifs")
async def party_gifs(q: str = "", limit: int = 24):
    """GIF search: Tenor/Giphy if API key in env, else curated sticker URLs + paste hint.

    Registered before `/party/{code}` so `gifs` is not captured as a room code.
    """
    limit = max(1, min(40, int(limit or 24)))
    query = (q or "party").strip()[:64] or "party"
    giphy_key = os.environ.get("GIPHY_API_KEY") or os.environ.get("GIPHY_KEY") or ""
    tenor_key = os.environ.get("TENOR_API_KEY") or os.environ.get("TENOR_KEY") or ""
    results: list[dict[str, str]] = []

    try:
        import httpx

        if tenor_key:
            url = "https://tenor.googleapis.com/v2/search"
            params = {"q": query, "key": tenor_key, "limit": limit, "media_filter": "gif,tinygif"}
            async with httpx.AsyncClient(timeout=8.0) as client:
                r = await client.get(url, params=params)
                data = r.json() if r.status_code == 200 else {}
            for item in data.get("results") or []:
                media = (item.get("media_formats") or {})
                gif = (media.get("gif") or media.get("tinygif") or {}).get("url")
                preview = (media.get("tinygif") or media.get("gif") or {}).get("url") or gif
                if gif:
                    results.append({"url": gif, "preview": preview or gif, "id": str(item.get("id") or "")})
        elif giphy_key:
            url = "https://api.giphy.com/v1/gifs/search"
            params = {"q": query, "api_key": giphy_key, "limit": limit, "rating": "pg-13"}
            async with httpx.AsyncClient(timeout=8.0) as client:
                r = await client.get(url, params=params)
                data = r.json() if r.status_code == 200 else {}
            for item in data.get("data") or []:
                images = item.get("images") or {}
                gif = (images.get("fixed_height") or images.get("original") or {}).get("url")
                preview = (images.get("fixed_height_small") or images.get("preview_gif") or {}).get("url") or gif
                if gif:
                    results.append({"url": gif, "preview": preview or gif, "id": str(item.get("id") or "")})
    except Exception:
        results = []

    if not results:
        # Offline / no-key fallback: emoji-as-sticker “GIFs” via Twemoji CDN (static PNG)
        stickers = ["1f389", "1f525", "1f602", "2764-fe0f", "1f44d", "1f440", "1f3ac", "1f37f"]
        for i, code in enumerate(stickers[:limit]):
            u = f"https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/{code}.png"
            results.append({"url": u, "preview": u, "id": f"sticker-{i}"})

    return {
        "ok": True,
        "query": query,
        "provider": "tenor" if tenor_key else ("giphy" if giphy_key else "stickers"),
        "results": results,
    }


@router.get("/party", response_class=HTMLResponse)
@router.get("/party/home", response_class=HTMLResponse)
async def party_home_page():
    """PIN-gated Watch Party home — same TV shell as /vod; client opens slide-up sheet."""
    from StepDaddyLiveHD.advanced_player_template import render_advanced_tv_page

    return HTMLResponse(render_advanced_tv_page(None))


@router.get("/party/{code}")
async def party_get(code: str):
    code_u = (code or "").upper()
    if code_u in RESERVED_PARTY_CODES:
        return JSONResponse({"ok": False, "error": "not_found"}, status_code=404)
    room = _rooms.get(code_u)
    if not room:
        return JSONResponse({"ok": False, "error": "not_found"}, status_code=404)
    out = _public_room(room)
    out["watchPath"] = _content_watch_path(room.content)
    return {"ok": True, "room": out}


@router.post("/party/remote-token")
async def party_remote_token(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}
    host_session = str(body.get("session") or "anon")
    return {
        "ok": True,
        **create_remote_token(
            host_session,
            body.get("channel_id"),
            body.get("room_code") or body.get("code"),
        ),
    }


def _ensure_upload_dir() -> Path:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return UPLOAD_DIR


@router.post("/party/upload")
async def party_upload(request: Request):
    """Upload a short voice note (or small media). Cap ~1–2MB. Returns /tv-assets URL.

    Accepts multipart if python-multipart is installed, otherwise JSON:
    { code, kind, contentType, data: base64 or data-URL }.
    """
    import base64

    _purge_idle()
    room_code = ""
    kind = "voice"
    data = b""
    content_type = "application/octet-stream"

    ctype = (request.headers.get("content-type") or "").lower()
    if "multipart/form-data" in ctype:
        try:
            form = await request.form()
            room_code = str(form.get("code") or "").upper()
            kind = str(form.get("kind") or "voice")
            upload = form.get("file")
            if upload is not None and hasattr(upload, "read"):
                data = await upload.read()
                content_type = getattr(upload, "content_type", None) or content_type
        except Exception:
            return JSONResponse(
                {"ok": False, "error": "multipart_unavailable", "hint": "send JSON base64 body"},
                status_code=400,
            )
    else:
        try:
            body = await request.json()
        except Exception:
            body = {}
        if not isinstance(body, dict):
            body = {}
        room_code = str(body.get("code") or request.query_params.get("code") or "").upper()
        kind = str(body.get("kind") or kind)
        content_type = str(body.get("contentType") or body.get("mime") or content_type)
        raw = body.get("data") or body.get("base64") or ""
        if isinstance(raw, str) and raw:
            if "," in raw and raw.strip().lower().startswith("data:"):
                header, raw = raw.split(",", 1)
                if ";" in header:
                    content_type = header.split(";", 1)[0].split(":", 1)[-1] or content_type
            try:
                data = base64.b64decode(raw, validate=False)
            except Exception:
                return JSONResponse({"ok": False, "error": "bad_data"}, status_code=400)

    if room_code and room_code not in _rooms:
        return JSONResponse({"ok": False, "error": "not_found"}, status_code=404)
    if room_code:
        room = _rooms[room_code]
        if kind == "voice" and not _feature_on(room, "chat_voice_note"):
            return JSONResponse({"ok": False, "error": "feature_disabled"}, status_code=403)
        if kind == "gif" and not _feature_on(room, "chat_gif"):
            return JSONResponse({"ok": False, "error": "feature_disabled"}, status_code=403)

    if not data:
        return JSONResponse({"ok": False, "error": "empty"}, status_code=400)
    if len(data) > UPLOAD_MAX_BYTES:
        return JSONResponse({"ok": False, "error": "too_large", "max": UPLOAD_MAX_BYTES}, status_code=413)

    ext = "webm"
    if "ogg" in content_type:
        ext = "ogg"
    elif "mp4" in content_type or "m4a" in content_type:
        ext = "m4a"
    elif "mpeg" in content_type or "mp3" in content_type:
        ext = "mp3"
    elif "gif" in content_type:
        ext = "gif"
    elif "png" in content_type:
        ext = "png"
    elif "jpeg" in content_type or "jpg" in content_type:
        ext = "jpg"
    elif "webp" in content_type:
        ext = "webp"

    name = f"{secrets.token_hex(8)}.{ext}"
    path = _ensure_upload_dir() / name
    path.write_bytes(data)
    url = f"/tv-assets/party_uploads/{name}"
    return {"ok": True, "url": url, "bytes": len(data), "contentType": content_type, "kind": kind}


REMOTE_HTML = """<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Remote — StepDaddyLiveHD</title>
<style>
body{margin:0;min-height:100vh;background:#0b0d12;color:#eee;font-family:system-ui,sans-serif;
display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:20px}
h1{font-size:18px;margin:0 0 8px;color:#93c5fd}
.grid{display:grid;grid-template-columns:repeat(3,72px);gap:10px}
button{width:72px;height:72px;border-radius:16px;border:1px solid rgba(255,255,255,.14);
background:rgba(255,255,255,.08);color:#fff;font-size:22px;font-weight:700;cursor:pointer}
button.wide{width:100%;max-width:236px;height:52px;font-size:14px}
#status{font-size:12px;color:#9aa;min-height:18px}
</style></head><body>
<h1>Phone remote</h1>
<p id="status">Connecting…</p>
<div class="grid">
<button data-cmd="up">▲</button>
<button data-cmd="mute">🔇</button>
<button data-cmd="info">i</button>
<button data-cmd="left">◀</button>
<button data-cmd="ok">OK</button>
<button data-cmd="right">▶</button>
<button data-cmd="prev">⏮</button>
<button data-cmd="down">▼</button>
<button data-cmd="next">⏭</button>
</div>
<button class="wide" data-cmd="playpause">Play / Pause</button>
button class="wide" data-cmd="guide">Toggle guide</button>
<script>
const token = new URLSearchParams(location.search).get("token") || "";
const status = document.getElementById("status");
let ws;
function connect(){
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(proto + "://" + location.host + "/ws/party?token=" + encodeURIComponent(token) + "&kind=remote");
  ws.onopen = () => { status.textContent = "Connected"; };
  ws.onclose = () => { status.textContent = "Disconnected — retrying…"; setTimeout(connect, 1500); };
  ws.onerror = () => { status.textContent = "Error"; };
}
document.body.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-cmd]");
  if (!btn || !ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ type: "remote", cmd: btn.dataset.cmd }));
});
connect();
</script>
<script src="/tv-assets/pull_reload.js" defer></script>
</body></html>
""".replace(
    "button class=\"wide\" data-cmd=\"guide\">Toggle guide</button>",
    '<button class="wide" data-cmd="guide">Toggle guide</button>',
)


@router.get("/remote", response_class=HTMLResponse)
async def remote_page(token: str = ""):
    if not remote_token_ok(token):
        return HTMLResponse("<h1>Invalid or expired remote link</h1>", status_code=403)
    return HTMLResponse(REMOTE_HTML)


def _join_meta_payload(code: str, room: Room | None) -> dict[str, Any]:
    if not room:
        return {"ok": False, "error": "not_found", "code": code}
    content = room.content if isinstance(room.content, dict) else {}
    return {
        "ok": True,
        "code": code,
        "name": room.name or _default_room_name(content, room.room_number or 0, code),
        "title": str(content.get("title") or "")[:120],
        "posterPath": _content_poster_path(content),
        "logoPath": _content_logo_path(content),
        "locked": bool(room.password_hash),
        "memberCount": _member_count(room),
        "channelId": content.get("channelId") or content.get("channel_id"),
        "mediaType": content.get("mediaType") or "movie",
        "watchPath": _content_watch_path(content),
        "public": bool(room.is_public),
    }


@router.get("/party/join/{code}/meta")
async def party_join_meta(code: str):
    """Public room card for invite landing (no member list / no private secrets)."""
    code = (code or "").upper()
    _purge_idle()
    return _join_meta_payload(code, _rooms.get(code))


@router.get("/party/join/{code}", response_class=HTMLResponse)
async def party_join_page(code: str):
    code = (code or "").upper()
    _purge_idle()
    room = _rooms.get(code)
    meta = _join_meta_payload(code, room)
    return HTMLResponse(
        render_party_join_page(
            code,
            watch=str(meta.get("watchPath") or "/tv/"),
            locked=bool(meta.get("locked")),
            title=str(meta.get("title") or ""),
            room_name=str(meta.get("name") or ""),
            member_count=int(meta.get("memberCount") or 0),
            exists=bool(meta.get("ok")),
            poster_path=meta.get("posterPath"),
            channel_id=meta.get("channelId"),
        )
    )


@router.websocket("/ws/party")
async def party_ws(websocket: WebSocket):
    global _member_seq
    await websocket.accept()
    _purge_idle()
    q = websocket.query_params
    kind = (q.get("kind") or "player").lower()
    token = q.get("token") or ""
    room: Room | None = None
    member_id = ""

    try:
        # Player sockets require an active PIN session (middleware skips /ws).
        if kind != "remote":
            try:
                from StepDaddyLiveHD.pin_auth import (
                    SESSION_COOKIE,
                    auth_is_enabled,
                    get_session,
                )

                if auth_is_enabled():
                    sess = get_session(websocket.cookies.get(SESSION_COOKIE))
                    if not sess:
                        await websocket.send_json({"type": "error", "error": "auth_required"})
                        await websocket.close()
                        return
            except Exception:
                await websocket.send_json({"type": "error", "error": "auth_required"})
                await websocket.close()
                return

        if kind == "remote":
            meta = remote_token_ok(token)
            if not meta:
                await websocket.send_json({"type": "error", "error": "bad_token"})
                await websocket.close()
                return
            host_room = None
            want = str(meta.get("room_code") or "").upper()
            if want:
                host_room = _rooms.get(want)
            if not host_room:
                for r in _rooms.values():
                    if r.members:
                        host_room = r
                        break
            if not host_room:
                await websocket.send_json({"type": "error", "error": "no_host"})
                await websocket.close()
                return
            room = host_room
            _member_seq += 1
            member_id = f"r{_member_seq}"
            room.members[member_id] = Member(
                id=member_id, display_name="Remote", kind="remote", role="guest", ws=websocket
            )
            await websocket.send_json({"type": "joined", "memberId": member_id, "room": _public_room(room)})
        else:
            # First message must be create or join
            raw = await websocket.receive_json()
            msg_type = (raw.get("type") or "").lower()
            display = str(raw.get("displayName") or raw.get("name") or "Guest")[:32]
            client_id = str(raw.get("clientId") or raw.get("client_id") or "")[:64]
            _member_seq += 1
            member_id = f"m{_member_seq}"

            if msg_type == "create":
                code = _code()
                content = _normalize_content(raw.get("content") if isinstance(raw.get("content"), dict) else {})
                room_number = _next_room_number()
                fallback = _default_room_name(content, room_number, code)
                room = Room(
                    code=code,
                    host_id=member_id,
                    host_key=secrets.token_urlsafe(10),
                    content=content,
                    clock={
                        "positionSeconds": float(raw.get("position") or 0),
                        "paused": True,
                        "updatedAt": int(time.time() * 1000),
                    },
                    name=_sanitize_name(raw.get("name"), fallback),
                    is_public=bool(raw.get("public") or raw.get("is_public")),
                    room_number=room_number,
                )
                pwd = str(raw.get("password") or "").strip()
                if pwd:
                    room.password_hash = _hash_password(pwd)
                _rooms[code] = room
                room.members[member_id] = Member(
                    id=member_id,
                    display_name=display,
                    kind=kind,
                    role="host",
                    ws=websocket,
                    client_id=client_id,
                )
                await websocket.send_json(
                    {
                        "type": "created",
                        "memberId": member_id,
                        "hostKey": room.host_key,
                        "room": _public_room(room),
                        "watchPath": _content_watch_path(room.content),
                    }
                )
            elif msg_type == "join":
                code = str(raw.get("code") or "").upper()
                room = _rooms.get(code)
                if not room:
                    await websocket.send_json({"type": "error", "error": "not_found"})
                    await websocket.close()
                    return
                if room.password_hash:
                    supplied = str(raw.get("password") or "")
                    if _hash_password(supplied) != room.password_hash:
                        await websocket.send_json({"type": "error", "error": "bad_password"})
                        await websocket.close()
                        return
                if len(room.members) >= MAX_MEMBERS:
                    await websocket.send_json({"type": "error", "error": "full"})
                    await websocket.close()
                    return
                # Drop stale socket for same client_id (refresh / reclaim)
                if client_id:
                    stale = [mid for mid, m in room.members.items() if m.client_id and m.client_id == client_id]
                    for mid in stale:
                        old = room.members.pop(mid, None)
                        if old:
                            try:
                                await old.ws.close()
                            except Exception:
                                pass
                role = "guest"
                reclaim_key = str(raw.get("hostKey") or raw.get("host_key") or "")
                can_reclaim = False
                if reclaim_key and room.host_key:
                    try:
                        can_reclaim = secrets.compare_digest(reclaim_key, room.host_key)
                    except Exception:
                        can_reclaim = reclaim_key == room.host_key
                if can_reclaim:
                    role = "host"
                    for m in room.members.values():
                        if m.role == "host":
                            m.role = "guest"
                    room.host_id = member_id
                elif not room.host_id or not any(m.role == "host" for m in room.members.values()):
                    role = "host"
                    room.host_id = member_id
                room.members[member_id] = Member(
                    id=member_id,
                    display_name=display,
                    kind=kind,
                    role=role,
                    ws=websocket,
                    client_id=client_id,
                )
                await websocket.send_json(
                    {
                        "type": "joined",
                        "memberId": member_id,
                        "hostKey": room.host_key if role == "host" else None,
                        "room": _public_room(room),
                        "watchPath": _content_watch_path(room.content),
                    }
                )
                await _broadcast(
                    room,
                    {"type": "member", "members": [_public_member(m) for m in room.members.values()]},
                    member_id,
                )
            else:
                await websocket.send_json({"type": "error", "error": "expected_create_or_join"})
                await websocket.close()
                return

        assert room is not None
        while True:
            raw = await websocket.receive_json()
            room.last_active = time.time()
            t = (raw.get("type") or "").lower()
            me = room.members.get(member_id)
            if not me:
                break

            if t == "ping":
                client_t = raw.get("t")
                await websocket.send_json(
                    {
                        "type": "pong",
                        "t": time.time(),
                        "clientT": client_t,
                        "serverTime": int(time.time() * 1000),
                    }
                )
            elif t == "chat":
                msg_kind = str(raw.get("msgType") or raw.get("kind") or "text").lower()
                if msg_kind not in ("text", "gif", "voice"):
                    msg_kind = "text"
                if msg_kind == "text" and not _feature_on(room, "chat_text"):
                    await websocket.send_json({"type": "error", "error": "feature_disabled", "feature": "chat_text"})
                    continue
                if msg_kind == "gif" and not _feature_on(room, "chat_gif"):
                    await websocket.send_json({"type": "error", "error": "feature_disabled", "feature": "chat_gif"})
                    continue
                if msg_kind == "voice" and not _feature_on(room, "chat_voice_note"):
                    await websocket.send_json({"type": "error", "error": "feature_disabled", "feature": "chat_voice_note"})
                    continue

                text = str(raw.get("text") or "").strip()[:280]
                url = str(raw.get("url") or "").strip()[:500]
                duration_ms = int(raw.get("durationMs") or raw.get("duration") or 0)
                if msg_kind == "text":
                    if not text:
                        continue
                    url = ""
                elif msg_kind == "gif":
                    if not url:
                        continue
                    if not (_GIF_URL_OK.match(url) or _GIF_HOST_OK.match(url) or url.startswith("/tv-assets/")):
                        # allow https gif/webp hosts or local uploads; reject others
                        if not (url.startswith("https://") and len(url) < 500):
                            await websocket.send_json({"type": "error", "error": "bad_gif_url"})
                            continue
                    text = text[:80]
                elif msg_kind == "voice":
                    if not url or not (url.startswith("/tv-assets/party_uploads/") or url.startswith("https://")):
                        await websocket.send_json({"type": "error", "error": "bad_voice_url"})
                        continue
                    text = text[:40]
                    duration_ms = max(0, min(duration_ms, 120_000))

                entry = {
                    "id": secrets.token_hex(4),
                    "memberId": member_id,
                    "displayName": me.display_name,
                    "text": text,
                    "ts": int(time.time() * 1000),
                    "msgType": msg_kind,
                }
                if url:
                    entry["url"] = url
                if msg_kind == "voice" and duration_ms:
                    entry["durationMs"] = duration_ms
                room.chat.append(entry)
                room.chat = room.chat[-CHAT_MAX:]
                await _broadcast(room, {"type": "chat", "message": entry})
            elif t == "set_features":
                if not _is_admin(room, me):
                    await websocket.send_json({"type": "error", "error": "admin_required"})
                    continue
                patch = raw.get("features") if isinstance(raw.get("features"), dict) else raw
                merged = _normalize_features(room.features)
                for key in FEATURE_KEYS:
                    if key in patch:
                        merged[key] = bool(patch[key])
                room.features = merged
                room.wait_for_buffering = bool(merged.get("sync_wait_buffering"))
                await _broadcast(room, {"type": "room_meta", "room": _public_room(room)})
            elif t == "set_sync_live":
                if not _is_admin(room, me):
                    await websocket.send_json({"type": "error", "error": "admin_required"})
                    continue
                mode = _normalize_sync_live_mode(raw.get("mode") or raw.get("syncLiveMode"))
                room.sync_live_mode = mode
                # Start/stop catchup ring when mode changes
                try:
                    from StepDaddyLiveHD import catchup as catchup_mod

                    ch = (room.content or {}).get("channelId") or (room.content or {}).get("channel_id")
                    if mode == "catchup" and ch:
                        info = await catchup_mod.ensure_catchup(str(ch), room.code)
                        room.catchup_url = info.get("url")
                    else:
                        catchup_mod.release_catchup(room.code)
                        room.catchup_url = None
                except Exception:
                    if mode == "catchup":
                        room.sync_live_mode = "content"
                        room.catchup_url = None
                        await websocket.send_json({"type": "error", "error": "catchup_unavailable"})
                await _broadcast(room, {"type": "room_meta", "room": _public_room(room)})
            elif t == "grant_admin":
                if me.role != "host" and me.id != room.host_id:
                    await websocket.send_json({"type": "error", "error": "host_required"})
                    continue
                target = str(raw.get("memberId") or raw.get("id") or "")
                if not target or target not in room.members:
                    continue
                room.admins.add(target)
                await _broadcast(room, {"type": "room_meta", "room": _public_room(room)})
            elif t == "revoke_admin":
                if me.role != "host" and me.id != room.host_id:
                    await websocket.send_json({"type": "error", "error": "host_required"})
                    continue
                target = str(raw.get("memberId") or raw.get("id") or "")
                if not target or target == room.host_id:
                    continue
                room.admins.discard(target)
                await _broadcast(room, {"type": "room_meta", "room": _public_room(room)})
            elif t == "reaction":
                emoji = str(raw.get("emoji") or "")
                if emoji not in PARTY_REACTIONS:
                    continue
                key = f"{room.code}:{member_id}"
                now = time.time() * 1000
                if now - _reaction_at.get(key, 0) < REACTION_COOLDOWN_MS:
                    continue
                _reaction_at[key] = now
                await _broadcast(
                    room,
                    {
                        "type": "reaction",
                        "emoji": emoji,
                        "memberId": member_id,
                        "displayName": me.display_name,
                        "ts": int(now),
                    },
                )
            elif t == "clock":
                if me.role != "host":
                    continue
                if not _feature_on(room, "sync_vod") and not room.catchup_url:
                    # Still allow live lag metrics broadcast when sync_live is lag/pdt
                    if room.sync_live_mode not in ("lag", "pdt", "catchup"):
                        continue
                room.clock = {
                    "positionSeconds": float(raw.get("positionSeconds") or raw.get("position") or 0),
                    "paused": bool(raw.get("paused")),
                    "updatedAt": int(time.time() * 1000),
                    "playbackRate": float(raw.get("playbackRate") or 1.0),
                    "serverTime": int(time.time() * 1000),
                    "liveEdgeOffset": raw.get("liveEdgeOffset"),
                    "hasPdt": bool(raw.get("hasPdt")),
                    "programDateTime": raw.get("programDateTime"),
                }
                # Optional wait-for-group: force pause while any peer buffers
                if _feature_on(room, "sync_wait_buffering") and any(
                    m.buffering and m.kind != "remote" for m in room.members.values()
                ):
                    room.clock["paused"] = True
                    room.wait_for_buffering = True
                else:
                    room.wait_for_buffering = bool(_feature_on(room, "sync_wait_buffering"))
                await _broadcast(room, {"type": "clock", "clock": room.clock}, member_id)
            elif t == "content":
                if me.role != "host":
                    continue
                if isinstance(raw.get("content"), dict):
                    room.content = _normalize_content(raw["content"])
                    await _broadcast(
                        room,
                        {
                            "type": "content",
                            "content": room.content,
                            "watchPath": _content_watch_path(room.content),
                        },
                        member_id,
                    )
            elif t == "rename":
                if me.role != "host":
                    continue
                fallback = room.name or _default_room_name(room.content, room.room_number, room.code)
                room.name = _sanitize_name(raw.get("name"), fallback)
                await _broadcast(room, {"type": "room_meta", "room": _public_room(room)})
            elif t == "set_public":
                if me.role != "host":
                    continue
                room.is_public = bool(raw.get("public") if "public" in raw else raw.get("is_public"))
                await _broadcast(room, {"type": "room_meta", "room": _public_room(room)})
            elif t == "force_sync":
                if me.role != "host":
                    continue
                await _broadcast(
                    room,
                    {
                        "type": "force_sync",
                        "clock": room.clock,
                        "content": room.content,
                        "watchPath": _content_watch_path(room.content),
                    },
                    member_id,
                )
            elif t == "kick":
                if me.role != "host":
                    continue
                target = str(raw.get("memberId") or raw.get("id") or "")
                if not target or target == member_id:
                    continue
                victim = room.members.pop(target, None)
                if victim:
                    try:
                        await victim.ws.send_json({"type": "kicked", "reason": "host"})
                    except Exception:
                        pass
                    try:
                        await victim.ws.close()
                    except Exception:
                        pass
                    await _broadcast(
                        room,
                        {"type": "member", "members": [_public_member(m) for m in room.members.values()]},
                    )
            elif t == "remote":
                await _broadcast(
                    room,
                    {"type": "remote", "cmd": raw.get("cmd"), "from": member_id},
                    member_id,
                )
            elif t == "buffering":
                me.buffering = bool(raw.get("buffering"))
                await _broadcast(
                    room,
                    {"type": "member", "members": [_public_member(m) for m in room.members.values()]},
                )
                if _feature_on(room, "sync_wait_buffering") and me.buffering and room.host_id:
                    # Nudge room toward pause while someone buffers
                    room.clock = dict(room.clock or {})
                    room.clock["paused"] = True
                    room.clock["updatedAt"] = int(time.time() * 1000)
                    room.clock["serverTime"] = room.clock["updatedAt"]
                    room.wait_for_buffering = True
                    await _broadcast(room, {"type": "clock", "clock": room.clock})
            elif t in ("webrtc_offer", "webrtc_answer", "webrtc_ice"):
                # Peer-to-peer WebRTC signaling relay (built-in party AV).
                target = str(raw.get("to") or raw.get("target") or "")
                if not target or target == member_id:
                    continue
                peer = room.members.get(target)
                if not peer:
                    continue
                payload: dict[str, Any] = {
                    "type": t,
                    "from": member_id,
                    "to": target,
                }
                if t in ("webrtc_offer", "webrtc_answer"):
                    sdp = raw.get("sdp")
                    if not isinstance(sdp, dict):
                        continue
                    payload["sdp"] = sdp
                else:
                    cand = raw.get("candidate")
                    if cand is None:
                        continue
                    payload["candidate"] = cand
                try:
                    await peer.ws.send_json(payload)
                except Exception:
                    pass
            elif t == "webrtc_hangup":
                target = str(raw.get("to") or raw.get("target") or "")
                payload = {
                    "type": "webrtc_hangup",
                    "from": member_id,
                    "to": target or None,
                }
                if target and target in room.members:
                    try:
                        await room.members[target].ws.send_json(payload)
                    except Exception:
                        pass
                else:
                    await _broadcast(room, payload, member_id)
            elif t == "av_state":
                # Presence for built-in AV (in call, mute/cam). Broadcast to room.
                mode = str(raw.get("mode") or "voice").lower()
                if mode not in ("voice", "video", "hybrid", "text"):
                    mode = "voice"
                payload = {
                    "type": "av_state",
                    "from": member_id,
                    "displayName": me.display_name,
                    "inCall": bool(raw.get("inCall")),
                    "mode": mode,
                    "muted": bool(raw.get("muted")),
                    "camOff": bool(raw.get("camOff")),
                }
                await _broadcast(room, payload, member_id)
            elif t == "leave":
                break
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if room and member_id and member_id in room.members:
            was_host = room.members[member_id].role == "host"
            room.members.pop(member_id, None)
            if was_host and room.members:
                nxt = next((m for m in room.members.values() if m.kind != "remote"), None)
                if not nxt:
                    nxt = next(iter(room.members.values()))
                nxt.role = "host"
                room.host_id = nxt.id
                try:
                    await nxt.ws.send_json({"type": "host", "memberId": nxt.id, "hostKey": room.host_key})
                except Exception:
                    pass
            try:
                if room.members:
                    await _broadcast(
                        room,
                        {
                            "type": "webrtc_hangup",
                            "from": member_id,
                            "to": None,
                            "reason": "left",
                        },
                    )
                    await _broadcast(
                        room, {"type": "member", "members": [_public_member(m) for m in room.members.values()]}
                    )
            except Exception:
                pass
            if not room.members:
                # Keep HTTP-created invite rooms until idle purge so late joiners work.
                room.last_active = time.time()
                room.host_id = ""
                try:
                    from StepDaddyLiveHD import catchup as catchup_mod

                    catchup_mod.release_catchup(room.code)
                    room.catchup_url = None
                except Exception:
                    pass
        try:
            await websocket.close()
        except Exception:
            pass
