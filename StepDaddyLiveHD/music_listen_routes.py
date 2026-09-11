"""Music Listen API — ytmusicapi catalog + ephemeral stream proxy under /api/music/listen/..."""
from __future__ import annotations

import asyncio
import os
from typing import Any

import httpx
from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse, Response, StreamingResponse

from . import music_stream as stream
from . import music_ytm_client as ytm

router = APIRouter(tags=["music-listen"])

_CLIENT_RPS = float(os.environ.get("MUSIC_LISTEN_CLIENT_RPS", "6"))
_CLIENT_BURST = int(os.environ.get("MUSIC_LISTEN_CLIENT_BURST", "16"))


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
    import time

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


async def _run(fn, *args, **kwargs):
    return await asyncio.to_thread(fn, *args, **kwargs)


_LRCLIB = "https://lrclib.net/api"
_LYRICS_UA = "StepDaddyLiveHD/music-lyrics (stream-through; +https://sdgateway.duckdns.org)"


def _parse_lrc(synced: str | None) -> list[dict[str, Any]]:
    """Parse LRC `[mm:ss.xx]text` lines into {t, text} for karaoke scroll."""
    import re

    out: list[dict[str, Any]] = []
    if not synced:
        return out
    for line in str(synced).splitlines():
        m = re.match(r"\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$", line.strip())
        if not m:
            continue
        mins, secs, frac, text = m.group(1), m.group(2), m.group(3) or "0", (m.group(4) or "").strip()
        if not text:
            continue
        frac = (frac + "000")[:3]
        t = int(mins) * 60 + int(secs) + int(frac) / 1000.0
        out.append({"t": round(t, 3), "text": text})
    return out


@router.get("/api/music/lyrics")
async def music_lyrics(
    request: Request,
    artist: str | None = Query(None, max_length=120),
    title: str | None = Query(None, max_length=160),
    album: str | None = Query(None, max_length=160),
    duration: float | None = Query(None, ge=1, le=3600),
):
    """Synced lyrics via LRCLIB (public, no download farms). Degrades gracefully."""
    limited = _rate_limited(request)
    if limited:
        return limited
    title = (title or "").strip()
    artist = (artist or "").strip()
    if not title:
        return {"ok": False, "available": False, "reason": "missing_title", "lines": [], "plain": None}
    try:
        params: dict[str, Any] = {"track_name": title}
        if artist:
            params["artist_name"] = artist
        if album:
            params["album_name"] = album
        async with httpx.AsyncClient(timeout=8.0, headers={"User-Agent": _LYRICS_UA}) as client:
            r = await client.get(f"{_LRCLIB}/search", params=params)
            if r.status_code != 200:
                return {
                    "ok": False,
                    "available": False,
                    "reason": f"lrclib_http_{r.status_code}",
                    "lines": [],
                    "plain": None,
                    "provider": "lrclib",
                }
            hits = r.json() if r.content else []
        if not isinstance(hits, list) or not hits:
            return {
                "ok": True,
                "available": False,
                "reason": "not_found",
                "lines": [],
                "plain": None,
                "provider": "lrclib",
            }
        best = hits[0]
        if duration and len(hits) > 1:
            try:
                best = min(
                    hits,
                    key=lambda h: abs(float(h.get("duration") or 0) - float(duration)),
                )
            except Exception:
                best = hits[0]
        synced = best.get("syncedLyrics") or ""
        plain = best.get("plainLyrics") or ""
        lines = _parse_lrc(synced)
        if not lines and plain:
            lines = [{"t": None, "text": ln} for ln in plain.splitlines() if ln.strip()]
        return {
            "ok": True,
            "available": bool(lines or plain),
            "synced": bool(synced and any(x.get("t") is not None for x in lines)),
            "lines": lines[:400],
            "plain": plain or None,
            "provider": "lrclib",
            "meta": {
                "id": best.get("id"),
                "trackName": best.get("trackName") or best.get("name"),
                "artistName": best.get("artistName"),
                "albumName": best.get("albumName"),
                "duration": best.get("duration"),
                "instrumental": bool(best.get("instrumental")),
            },
            "doc": "LRCLIB public search; stream-through only — no lyric download farms.",
        }
    except Exception as exc:  # noqa: BLE001
        return JSONResponse(
            {
                "ok": False,
                "available": False,
                "reason": str(exc)[:200],
                "lines": [],
                "plain": None,
                "provider": "lrclib",
            },
            status_code=502,
        )


@router.get("/api/music/listen/health")
async def music_listen_health(
    request: Request,
    probe: int = Query(0, ge=0, le=1),
):
    limited = _rate_limited(request)
    if limited:
        return limited
    try:
        data = await _run(ytm.health)
        data["stream"] = "ephemeral_proxy_or_yt_embed"
        data["disk_archive"] = False
        data["proxy"] = stream.proxy_status()
        data["client_embed"] = stream.client_embed_enabled()
        data["laptop_proxy_required"] = False
        # Default: do not block health on a slow YouTube probe; ?probe=1 for ops.
        if probe:
            extract = await _run(stream.probe_extract)
            data["extract"] = extract
            data["extract_ok"] = bool(extract.get("ok"))
        else:
            data["extract_ok"] = None
            data["extract"] = {"ok": None, "skipped": True, "hint": "pass probe=1"}
        # Listen is ready without home SOCKS when client embed is on OR server extract works.
        data["listen_ready"] = bool(data.get("ok")) and (
            data["client_embed"] or data.get("extract_ok") is True
        )
        return data
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=502)


@router.get("/api/music/listen/home")
async def music_listen_home(
    request: Request,
    limit: int = Query(6, ge=1, le=12),
):
    limited = _rate_limited(request)
    if limited:
        return limited
    try:
        return await _run(ytm.home, limit)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=502)


@router.get("/api/music/listen/search")
async def music_listen_search(
    request: Request,
    q: str = Query(..., min_length=1, max_length=120),
    filter: str | None = Query(None, alias="filter"),
    limit: int = Query(24, ge=1, le=50),
):
    limited = _rate_limited(request)
    if limited:
        return limited
    filt = filter if filter in (None, "songs", "albums", "artists", "playlists", "videos") else None
    try:
        return await _run(ytm.search, q.strip(), filt, limit)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=502)


@router.get("/api/music/listen/album/{browse_id}")
async def music_listen_album(browse_id: str, request: Request):
    limited = _rate_limited(request)
    if limited:
        return limited
    try:
        return await _run(ytm.album, browse_id)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=502)


@router.get("/api/music/listen/playlist/{playlist_id}")
async def music_listen_playlist(
    playlist_id: str,
    request: Request,
    limit: int = Query(100, ge=1, le=200),
):
    limited = _rate_limited(request)
    if limited:
        return limited
    try:
        return await _run(ytm.playlist, playlist_id, limit)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=502)


@router.get("/api/music/listen/artist/{channel_id}")
async def music_listen_artist(channel_id: str, request: Request):
    limited = _rate_limited(request)
    if limited:
        return limited
    try:
        return await _run(ytm.artist, channel_id)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=502)


@router.get("/api/music/listen/artists/directory")
async def music_listen_artists_directory(
    request: Request,
    letter: str | None = Query(None, max_length=2),
    sort: str = Query("name", max_length=24),
    limit: int = Query(60, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, max_length=80),
):
    """A–Z artists directory: letter index, sort, pagination (cached pool)."""
    limited = _rate_limited(request)
    if limited:
        return limited
    try:
        return await _run(ytm.artists_directory, letter, sort, limit, offset, q)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=502)


@router.get("/api/music/listen/tracks/directory")
async def music_listen_tracks_directory(
    request: Request,
    letter: str | None = Query(None, max_length=2),
    sort: str = Query("hot", max_length=24),
    limit: int = Query(60, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, max_length=80),
):
    """Tracks directory: trending + A–Z + search (cached pool)."""
    limited = _rate_limited(request)
    if limited:
        return limited
    try:
        return await _run(ytm.tracks_directory, letter, sort, limit, offset, q)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=502)


@router.get("/api/music/listen/albums/directory")
async def music_listen_albums_directory(
    request: Request,
    letter: str | None = Query(None, max_length=2),
    sort: str = Query("hot", max_length=24),
    limit: int = Query(60, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, max_length=80),
):
    """Albums directory: enriched, sortable, letter index."""
    limited = _rate_limited(request)
    if limited:
        return limited
    try:
        return await _run(ytm.albums_directory, letter, sort, limit, offset, q)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=502)


@router.get("/api/music/listen/playlists/directory")
async def music_listen_playlists_directory(
    request: Request,
    letter: str | None = Query(None, max_length=2),
    sort: str = Query("hot", max_length=24),
    limit: int = Query(60, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, max_length=80),
):
    """Playlists directory: mood/public discover (client merges user playlists)."""
    limited = _rate_limited(request)
    if limited:
        return limited
    try:
        return await _run(ytm.playlists_directory, letter, sort, limit, offset, q)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=502)


@router.get("/api/music/listen/videos/directory")
async def music_listen_videos_directory(
    request: Request,
    letter: str | None = Query(None, max_length=2),
    sort: str = Query("hot", max_length=24),
    limit: int = Query(60, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, max_length=80),
):
    """Videos directory: chart videos + searchable pool."""
    limited = _rate_limited(request)
    if limited:
        return limited
    try:
        return await _run(ytm.videos_directory, letter, sort, limit, offset, q)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=502)


@router.get("/api/music/listen/artists")
async def music_listen_artists(
    request: Request,
    limit: int = Query(24, ge=4, le=40),
):
    """Home Artists directory — hot/trending + latest-release artist cards."""
    limited = _rate_limited(request)
    if limited:
        return limited
    try:
        return await _run(ytm.artists_feed, limit)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=502)


@router.get("/api/music/listen/mood")
async def music_listen_mood(
    request: Request,
    params: str = Query(..., min_length=4, max_length=200),
):
    limited = _rate_limited(request)
    if limited:
        return limited
    try:
        return await _run(ytm.mood_playlists, params)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=502)


@router.get("/api/music/listen/watch")
async def music_listen_watch(
    request: Request,
    videoId: str | None = None,
    playlistId: str | None = None,
    limit: int = Query(25, ge=1, le=50),
):
    limited = _rate_limited(request)
    if limited:
        return limited
    if not videoId and not playlistId:
        return JSONResponse({"ok": False, "error": "videoId_or_playlistId_required"}, status_code=400)
    try:
        return await _run(ytm.watch, videoId, playlistId, limit)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=502)


@router.get("/api/music/listen/stream/{video_id}")
async def music_listen_stream(video_id: str, request: Request):
    """Resolve ephemeral audio and return same-origin proxy URL (no disk write)."""
    limited = _rate_limited(request)
    if limited:
        return limited
    try:
        return await _run(stream.create_session, video_id)
    except ValueError as exc:
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=400)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)[:240]}, status_code=502)


async def _close_upstream(upstream: httpx.Response) -> None:
    await upstream.aclose()
    owns = getattr(upstream, "_sd_owns_client", None)
    if owns:
        await owns.aclose()


@router.api_route("/api/music/listen/proxy/{token}", methods=["GET", "HEAD"])
async def music_listen_proxy(token: str, request: Request):
    """Byte-stream proxy for <audio> — Range supported, never archived to disk."""
    session = stream.get_session(token)
    if not session:
        return JSONResponse({"ok": False, "error": "stream_expired"}, status_code=404)

    range_header = request.headers.get("range")
    try:
        upstream = await stream.open_upstream(session, range_header)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)[:200]}, status_code=502)

    # Stale googlevideo URL → force re-resolve once (common on VPS egress).
    if upstream.status_code in (403, 404, 410) and session.get("videoId"):
        await _close_upstream(upstream)
        try:
            meta = await _run(stream.resolve_audio, session["videoId"], force=True)
            stream.update_session_upstream(token, meta)
            session = stream.get_session(token) or session
            upstream = await stream.open_upstream(session, range_header)
        except Exception as exc:  # noqa: BLE001
            return JSONResponse({"ok": False, "error": f"reresolve_failed:{exc}"[:240]}, status_code=502)

    if upstream.status_code not in (200, 206):
        code = upstream.status_code
        await _close_upstream(upstream)
        return JSONResponse({"ok": False, "error": f"upstream_http_{code}"}, status_code=502)

    headers = stream.session_headers(upstream, session.get("mime"))
    media_type = headers.get("Content-Type") or session.get("mime") or "audio/mp4"

    if request.method == "HEAD":
        await _close_upstream(upstream)
        return Response(status_code=upstream.status_code, headers=headers, media_type=media_type)

    async def _iter():
        try:
            async for chunk in upstream.aiter_bytes(65536):
                if chunk:
                    yield chunk
        finally:
            await _close_upstream(upstream)

    return StreamingResponse(
        _iter(),
        status_code=upstream.status_code,
        media_type=media_type,
        headers=headers,
    )
