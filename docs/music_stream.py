"""Ephemeral YouTube Music audio resolve + same-origin byte proxy (no disk archive).

VPS-autonomous design (Oracle DC IP is bot-gated for most videos):
1. Try direct yt-dlp with JS-less clients (no cookies — android* rejects cookies).
2. Try web clients with optional cookie jar on VPS.
3. Optional residential SOCKS (MUSIC_LISTEN_PROXY / VOD_SOCKS5) if the tunnel is up —
   soft-deprecated for Music; not required when client embed fallback is enabled.
4. If all server extracts fail with a bot-gate, callers may return yt_embed mode so the
   browser plays via YouTube IFrame API (client residential/mobile IP).
"""
from __future__ import annotations

import os
import secrets
import socket
import threading
import time
from typing import Any

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

# Probe video for health (popular; fails on DC IP without egress — expected).
_HEALTH_PROBE_ID = (os.environ.get("MUSIC_LISTEN_PROBE_ID") or "kJQP7kiw5Fk").strip()

# Prefer single clients — multi-client lists can trip bot gates on datacenter IPs.
# android* must run WITHOUT cookies (yt-dlp skips them when a cookiefile is set).
_DIRECT_CLIENT_TRIES = (
    ["android"],
    ["android_music"],
    ["tv_embedded"],
    ["ios"],
)
_COOKIE_CLIENT_TRIES = (
    ["web"],
    ["mweb"],
    ["web_safari"],
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


def _proxy_candidates() -> list[str]:
    """Optional egress list. Dead local :11080 is skipped (no laptop required)."""
    raw = (
        os.environ.get("MUSIC_LISTEN_PROXY")
        or os.environ.get("VOD_SOCKS5")
        or os.environ.get("SOCKS5")
        or ""
    ).strip()
    if not raw:
        return []
    if raw in ("127.0.0.1:11080", "socks5://127.0.0.1:11080", "socks5h://127.0.0.1:11080"):
        try:
            with socket.create_connection(("127.0.0.1", 11080), timeout=0.3):
                pass
        except OSError:
            return []
    return [raw if "://" in raw else f"socks5://{raw}"]


def _proxy_url() -> str | None:
    cands = _proxy_candidates()
    return cands[0] if cands else None


def _default_cookie_paths() -> list[str]:
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    return [
        os.path.join(root, "data", "youtube.cookies.txt"),
        os.path.join(root, "config", "youtube.cookies.txt"),
    ]


def _cookiefile() -> str | None:
    """Netscape cookie jar — one-time browser export stored on VPS (not a laptop tunnel)."""
    for key in ("MUSIC_LISTEN_COOKIES", "YTDLP_COOKIES", "YOUTUBE_COOKIES"):
        path = (os.environ.get(key) or "").strip()
        if path and os.path.isfile(path):
            return path
    for path in _default_cookie_paths():
        if os.path.isfile(path):
            return path
    return None


def client_embed_enabled() -> bool:
    """Browser YouTube IFrame fallback — VPS-autonomous when Oracle IP is gated."""
    raw = (os.environ.get("MUSIC_LISTEN_CLIENT_EMBED") or "1").strip().lower()
    return raw not in ("0", "false", "no", "off")


def is_bot_gate_error(exc: BaseException | str) -> bool:
    msg = str(exc).lower()
    needles = (
        "sign in to confirm",
        "not a bot",
        "login_required",
        "confirm you're not a bot",
        "confirm you’re not a bot",
    )
    return any(n in msg for n in needles)


def yt_embed_session(video_id: str, *, title: str | None = None, meta: dict | None = None) -> dict[str, Any]:
    """Same-shape stream session that the player fulfills via YouTube IFrame API."""
    vid = (video_id or "").strip()
    base = meta or {}
    return {
        "ok": True,
        "mode": "yt_embed",
        "videoId": vid,
        "title": title or base.get("title") or vid,
        "uploader": base.get("uploader"),
        "duration": base.get("duration"),
        "thumb": base.get("thumb") or (f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg" if vid else None),
        "mime": "video/youtube",
        "ext": "embed",
        "abr": None,
        "stream_url": f"ytembed:{vid}",
        "expires_in": _SESSION_TTL,
        "server_extract": False,
        "laptop_proxy_required": False,
    }


def proxy_status() -> dict[str, Any]:
    """Ops probe — proxy is optional; Listen readiness is extract_ok OR client_embed."""
    raw = (
        os.environ.get("MUSIC_LISTEN_PROXY")
        or os.environ.get("VOD_SOCKS5")
        or os.environ.get("SOCKS5")
        or ""
    ).strip()
    active = _proxy_url()
    cookies = _cookiefile()
    return {
        "env_set": bool(raw),
        "active": bool(active),
        "cookiefile": bool(cookies),
        "cookiefile_path": cookies if cookies else None,
        "required_for_listen": False,
        "deprecated_for_music": True,
        "note": "Music Listen no longer requires home pproxy/ssh -R; SOCKS is optional acceleration only.",
    }


def _extract_with_clients(
    vid: str,
    clients: list[str],
    *,
    proxy: str | None = None,
    cookies: str | None = None,
) -> dict:
    import yt_dlp

    ydl_opts: dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
        "format": "bestaudio/best/worst",
        "extractor_args": {"youtube": {"player_client": list(clients)}},
        "socket_timeout": 20,
    }
    if proxy:
        ydl_opts["proxy"] = proxy
    if cookies:
        ydl_opts["cookiefile"] = cookies
    url = f"https://www.youtube.com/watch?v={vid}"
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        return ydl.extract_info(url, download=False)


def _attempts(vid: str) -> list[tuple[str, list[str], str | None, str | None]]:
    """Ordered extract attempts: (label, clients, proxy, cookies)."""
    cookies = _cookiefile()
    out: list[tuple[str, list[str], str | None, str | None]] = []
    # 1) Direct android* — never attach cookies (yt-dlp would skip these clients).
    for clients in _DIRECT_CLIENT_TRIES:
        out.append((f"direct:{'+'.join(clients)}", clients, None, None))
    # 2) Direct web* + cookies (VPS jar from one-time browser export).
    if cookies:
        for clients in _COOKIE_CLIENT_TRIES:
            out.append((f"cookies:{'+'.join(clients)}", clients, None, cookies))
    # 3) Optional SOCKS (laptop tunnel or other) — soft-deprecated.
    for proxy in _proxy_candidates():
        for clients in _DIRECT_CLIENT_TRIES:
            out.append((f"socks:{'+'.join(clients)}", clients, proxy, None))
        if cookies:
            for clients in _COOKIE_CLIENT_TRIES:
                out.append((f"socks+cookies:{'+'.join(clients)}", clients, proxy, cookies))
    return out


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
    used_label = None
    for label, clients, proxy, cookies in _attempts(vid):
        try:
            info = _extract_with_clients(vid, clients, proxy=proxy, cookies=cookies)
            if info and (_pick_audio(info) or info.get("url")):
                used_label = label
                break
            info = None
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
        "extract_via": used_label,
    }
    with _lock:
        _resolve_cache[vid] = (time.monotonic(), meta)
    return dict(meta)


def probe_extract(video_id: str | None = None) -> dict[str, Any]:
    """Health probe: does server-side extract work without requiring proxy.active?"""
    vid = (video_id or _HEALTH_PROBE_ID).strip() or _HEALTH_PROBE_ID
    t0 = time.monotonic()
    try:
        meta = resolve_audio(vid, force=True)
        return {
            "ok": True,
            "videoId": vid,
            "title": (meta.get("title") or "")[:80],
            "extract_via": meta.get("extract_via"),
            "ms": int((time.monotonic() - t0) * 1000),
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "ok": False,
            "videoId": vid,
            "error": str(exc)[:240],
            "bot_gate": is_bot_gate_error(exc),
            "ms": int((time.monotonic() - t0) * 1000),
        }


def create_session(video_id: str, *, force: bool = False) -> dict[str, Any]:
    vid = (video_id or "").strip()
    if not vid or len(vid) > 32 or not all(c.isalnum() or c in "-_" for c in vid):
        raise ValueError("invalid_video_id")

    try:
        meta = resolve_audio(vid, force=force)
    except Exception as exc:  # noqa: BLE001
        if client_embed_enabled() and (is_bot_gate_error(exc) or "no_audio_format" in str(exc).lower() or "resolve_empty" in str(exc).lower() or "format is not available" in str(exc).lower()):
            return yt_embed_session(vid)
        raise

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
        "mode": "server_proxy",
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
        "extract_via": meta.get("extract_via"),
        "server_extract": True,
        "laptop_proxy_required": False,
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
