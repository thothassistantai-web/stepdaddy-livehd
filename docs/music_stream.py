"""Ephemeral YouTube Music audio resolve + same-origin byte proxy (no disk archive)."""
from __future__ import annotations

import os
import secrets
import threading
import time
from typing import Any
from urllib.parse import urlparse

import httpx

# In-memory sessions only — never write ripped files to disk.
_SESSION_TTL = int(os.environ.get("MUSIC_LISTEN_STREAM_TTL", "900"))
_RESOLVE_TTL = int(os.environ.get("MUSIC_LISTEN_RESOLVE_TTL", "240"))
_lock = threading.Lock()
_sessions: dict[str, dict[str, Any]] = {}
_resolve_cache: dict[str, tuple[float, dict[str, Any]]] = {}

_UA = (
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
)

# Prefer single clients — multi-client lists can trip bot gates on datacenter IPs.
# Android / android_music / tv_embedded often return progressive playable URLs via SOCKS.
_PLAYER_CLIENT_TRIES = (
    ["android"],
    ["android_music"],
    ["tv_embedded"],
    ["ios"],
    ["mweb"],
    ["tv"],
)


def _purge() -> None:
    now = time.monotonic()
    dead = [k for k, s in _sessions.items() if now - s.get("created", 0) > _SESSION_TTL]
    for k in dead:
        _sessions.pop(k, None)
    dead_r = [k for k, (ts, _) in _resolve_cache.items() if now - ts > _RESOLVE_TTL]
    for k in dead_r:
        _resolve_cache.pop(k, None)


def _pick_video_preview(info: dict) -> dict | None:
    """Lowest practical progressive A/V for muted art-area loop (optional)."""
    formats = info.get("formats") or []
    progressive = [
        f
        for f in formats
        if f.get("url")
        and f.get("acodec") not in (None, "none")
        and f.get("vcodec") not in (None, "none")
        and str(f.get("ext") or "").lower() in {"mp4", "m4v", "webm", "mov"}
    ]
    if not progressive:
        return None
    progressive.sort(
        key=lambda f: (
            int(f.get("height") or 9999),
            float(f.get("tbr") or f.get("abr") or 9999),
        )
    )
    best = progressive[0]
    # Cap ~480p for art preview bandwidth
    if int(best.get("height") or 0) > 480:
        under = [f for f in progressive if int(f.get("height") or 0) <= 480]
        if under:
            best = under[0]
    ext = (best.get("ext") or "mp4").lower()
    return {
        "url": best["url"],
        "ext": ext,
        "height": best.get("height"),
        "mime": "video/mp4" if ext in {"mp4", "m4v"} else f"video/{ext}",
        "format_id": best.get("format_id"),
        "http_headers": best.get("http_headers") or info.get("http_headers") or {},
    }


def _pick_audio(info: dict) -> dict | None:
    formats = info.get("formats") or []
    # Prefer pure audio; fall back to progressive A/V (itag 18) which <audio> can play.
    audio_only = [
        f
        for f in formats
        if f.get("url")
        and (f.get("vcodec") in (None, "none"))
        and (f.get("acodec") not in (None, "none"))
    ]
    progressive = [
        f
        for f in formats
        if f.get("url")
        and f.get("acodec") not in (None, "none")
        and f.get("vcodec") not in (None, "none")
    ]
    pool = audio_only or progressive
    if not pool and info.get("url"):
        return {
            "url": info["url"],
            "ext": info.get("ext") or "m4a",
            "abr": info.get("abr"),
            "mime": "audio/mp4",
            "http_headers": info.get("http_headers") or {},
        }
    if not pool:
        return None
    pool.sort(key=lambda f: float(f.get("abr") or f.get("tbr") or 0), reverse=True)
    best = pool[0]
    ext = (best.get("ext") or "m4a").lower()
    mime = best.get("http_headers", {}).get("Accept")  # unused
    if "webm" in (best.get("mime") or "") or ext == "webm":
        mime = "audio/webm"
    elif best.get("vcodec") not in (None, "none"):
        mime = "video/mp4" if ext in ("mp4", "m4a", "m4v") else f"video/{ext}"
    else:
        mime = "audio/mp4"
    return {
        "url": best["url"],
        "ext": ext,
        "abr": best.get("abr") or best.get("tbr"),
        "mime": mime,
        "format_id": best.get("format_id"),
        "http_headers": best.get("http_headers") or info.get("http_headers") or {},
    }


def _proxy_url() -> str | None:
    raw = (os.environ.get("MUSIC_LISTEN_PROXY") or os.environ.get("VOD_SOCKS5") or os.environ.get("SOCKS5") or "").strip()
    if not raw:
        return None
    # Skip dead local tunnel quietly — callers fall back to direct egress.
    if raw in ("127.0.0.1:11080", "socks5://127.0.0.1:11080", "socks5h://127.0.0.1:11080"):
        import socket

        try:
            with socket.create_connection(("127.0.0.1", 11080), timeout=0.3):
                pass
        except OSError:
            return None
    return raw if "://" in raw else f"socks5://{raw}"


def _cookiefile() -> str | None:
    """Optional Netscape cookie jar for stubborn YouTube bot gates."""
    for key in ("MUSIC_LISTEN_COOKIES", "YTDLP_COOKIES", "YOUTUBE_COOKIES"):
        path = (os.environ.get(key) or "").strip()
        if path and os.path.isfile(path):
            return path
    return None


def proxy_status() -> dict[str, Any]:
    """Ops probe: whether Listen resolve will egress via residential SOCKS."""
    raw = (os.environ.get("MUSIC_LISTEN_PROXY") or os.environ.get("VOD_SOCKS5") or os.environ.get("SOCKS5") or "").strip()
    active = _proxy_url()
    return {
        "env_set": bool(raw),
        "active": bool(active),
        "cookiefile": bool(_cookiefile()),
    }


def _extract_with_clients(vid: str, clients: list[str]) -> dict:
    import yt_dlp

    # Prefer bestaudio, but fall through to progressive A/V (itag 18) — android /
    # SABR sessions often expose only progressive HTTPS URLs.
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
        "format": "bestaudio/best/worst",
        "extractor_args": {"youtube": {"player_client": list(clients)}},
    }
    proxy = _proxy_url()
    if proxy:
        ydl_opts["proxy"] = proxy
    cookies = _cookiefile()
    if cookies:
        ydl_opts["cookiefile"] = cookies
    url = f"https://www.youtube.com/watch?v={vid}"
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        return ydl.extract_info(url, download=False)


def resolve_audio(video_id: str, *, force: bool = False) -> dict[str, Any]:
    """Extract ephemeral audio URL via yt-dlp (download=False). Never writes files."""
    vid = (video_id or "").strip()
    if not vid or len(vid) > 32 or not all(c.isalnum() or c in "-_" for c in vid):
        raise ValueError("invalid_video_id")

    with _lock:
        _purge()
        if not force:
            hit = _resolve_cache.get(vid)
            if hit and time.monotonic() - hit[0] < _RESOLVE_TTL:
                return dict(hit[1])

    last_err: Exception | None = None
    info = None
    for clients in _PLAYER_CLIENT_TRIES:
        try:
            info = _extract_with_clients(vid, clients)
            if info:
                break
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            continue
    if not info:
        raise RuntimeError(str(last_err)[:240] if last_err else "resolve_empty")

    picked = _pick_audio(info)
    if not picked or not picked.get("url"):
        raise RuntimeError("no_audio_format")

    headers = dict(picked.get("http_headers") or {})
    headers.setdefault("User-Agent", _UA)
    headers.setdefault("Referer", "https://www.youtube.com/")
    headers.setdefault("Origin", "https://www.youtube.com")

    video_prev = _pick_video_preview(info)
    video_meta = None
    if video_prev and video_prev.get("url"):
        vheaders = dict(video_prev.get("http_headers") or {})
        vheaders.setdefault("User-Agent", _UA)
        vheaders.setdefault("Referer", "https://www.youtube.com/")
        vheaders.setdefault("Origin", "https://www.youtube.com")
        video_meta = {
            "upstream_url": video_prev["url"],
            "mime": video_prev.get("mime") or "video/mp4",
            "http_headers": vheaders,
            "format_id": video_prev.get("format_id"),
            "height": video_prev.get("height"),
        }

    meta = {
        "videoId": vid,
        "title": info.get("title") or vid,
        "uploader": info.get("uploader") or info.get("channel"),
        "duration": info.get("duration"),
        "thumb": info.get("thumbnail"),
        "ext": picked.get("ext"),
        "abr": picked.get("abr"),
        "mime": picked.get("mime") or "audio/mp4",
        "upstream_url": picked["url"],
        "format_id": picked.get("format_id"),
        "http_headers": headers,
        "video_preview": video_meta,
    }
    with _lock:
        _resolve_cache[vid] = (time.monotonic(), meta)
    return dict(meta)


def create_session(video_id: str, *, force: bool = False) -> dict[str, Any]:
    meta = resolve_audio(video_id, force=force)
    token = secrets.token_urlsafe(16)
    video_token = None
    with _lock:
        _purge()
        _sessions[token] = {
            "created": time.monotonic(),
            "videoId": meta["videoId"],
            "upstream_url": meta["upstream_url"],
            "mime": meta.get("mime") or "audio/mp4",
            "title": meta.get("title"),
            "http_headers": meta.get("http_headers") or {},
            "referer": (meta.get("http_headers") or {}).get("Referer") or "https://www.youtube.com/",
        }
        vp = meta.get("video_preview")
        if vp and vp.get("upstream_url"):
            # Reuse audio token when same progressive URL; else dedicated preview session
            if vp["upstream_url"] == meta["upstream_url"]:
                video_token = token
            else:
                video_token = secrets.token_urlsafe(16)
                _sessions[video_token] = {
                    "created": time.monotonic(),
                    "videoId": meta["videoId"],
                    "upstream_url": vp["upstream_url"],
                    "mime": vp.get("mime") or "video/mp4",
                    "title": meta.get("title"),
                    "http_headers": vp.get("http_headers") or {},
                    "referer": (vp.get("http_headers") or {}).get("Referer") or "https://www.youtube.com/",
                    "preview": True,
                }
    out = {
        "ok": True,
        "videoId": meta["videoId"],
        "title": meta.get("title"),
        "uploader": meta.get("uploader"),
        "duration": meta.get("duration"),
        "thumb": meta.get("thumb"),
        "mime": meta.get("mime"),
        "ext": meta.get("ext"),
        "abr": meta.get("abr"),
        "stream_url": f"/api/music/listen/proxy/{token}",
        "expires_in": _SESSION_TTL,
    }
    if video_token:
        out["video_stream_url"] = f"/api/music/listen/proxy/{video_token}"
    return out


def get_session(token: str) -> dict | None:
    with _lock:
        _purge()
        return _sessions.get(token)


def update_session_upstream(token: str, meta: dict) -> None:
    with _lock:
        sess = _sessions.get(token)
        if not sess:
            return
        sess["upstream_url"] = meta["upstream_url"]
        sess["http_headers"] = meta.get("http_headers") or sess.get("http_headers") or {}
        sess["mime"] = meta.get("mime") or sess.get("mime")
        sess["created"] = time.monotonic()


def session_headers(upstream: httpx.Response, mime_fallback: str | None = None) -> dict[str, str]:
    headers: dict[str, str] = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
    }
    ctype = upstream.headers.get("content-type") or mime_fallback
    if ctype:
        headers["Content-Type"] = ctype
    clen = upstream.headers.get("content-length")
    if clen:
        headers["Content-Length"] = clen
    crange = upstream.headers.get("content-range")
    if crange:
        headers["Content-Range"] = crange
    return headers


async def open_upstream(
    session: dict,
    range_header: str | None,
    client: httpx.AsyncClient | None = None,
) -> httpx.Response:
    url = session["upstream_url"]
    headers = {
        "User-Agent": _UA,
        "Referer": "https://www.youtube.com/",
        "Origin": "https://www.youtube.com",
        "Accept": "*/*",
    }
    stored = session.get("http_headers") or {}
    for k, v in stored.items():
        if v:
            headers[k] = v
    if range_header:
        headers["Range"] = range_header

    owns = client is None
    proxy = _proxy_url()
    hc = client or httpx.AsyncClient(
        timeout=httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=5.0),
        follow_redirects=True,
        http2=False,
        proxy=proxy,
    )
    try:
        resp = await hc.send(hc.build_request("GET", url, headers=headers), stream=True)
        if owns:
            resp._sd_owns_client = hc  # type: ignore[attr-defined]
        return resp
    except Exception:
        if owns:
            await hc.aclose()
        raise
