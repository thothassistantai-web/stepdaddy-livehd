import os
from pathlib import Path
import asyncio
import httpx
import secrets
import time as _time
import re
from urllib.parse import quote, unquote
import urllib.error
import urllib.request
from StepDaddyLiveHD.step_daddy import StepDaddy, Channel
from StepDaddyLiveHD.epg import EpgService
from StepDaddyLiveHD.title_metadata import TitleMetadataService
from StepDaddyLiveHD.vod_sources import list_sources, sources_as_dicts, preferred_embed_url
from StepDaddyLiveHD.vod_resolver import VodResolver, VodResolveResult, pick_best_result, HLS_PROVIDER_IDS
from StepDaddyLiveHD import omss_client
from StepDaddyLiveHD.vod_catalog import VodCatalogService
from StepDaddyLiveHD.vod_library import (
    get_item,
    list_continue_watching,
    list_items,
    touch_recent,
    trakt_status,
    update_progress,
    upsert_item,
)
from StepDaddyLiveHD import subtitle_service
from StepDaddyLiveHD.party import router as party_router
from StepDaddyLiveHD.trakt_auth import device_poll, device_start, logout as trakt_logout, session_id_from_request
from fastapi import Response, status, FastAPI, Request, Body
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from datetime import datetime, timezone
import hmac
import hashlib
import base64
import json
import time
from .utils import urlsafe_base64, urlsafe_base64_decode
from .stability_routes import router as stability_router
from .free_tier_routes import router as free_tier_router
from .channel_report_routes import router as channel_report_router
from .rate_limit import StreamRateLimitMiddleware
from .play_template import render_play_page
from .play_directory_template import render_play_directory_page
from .advanced_player_template import render_advanced_tv_page
from .health_visual_template import render_health_visual_page
from .unified_search import unified_search
from StepDaddyLiveHD.supplements import get_catalog, get_settings
from StepDaddyLiveHD.supplements import dulo as dulo_mod
from StepDaddyLiveHD.supplements.taxonomy import genre_group_title, normalize_channel_taxonomy


fastapi_app = FastAPI()
fastapi_app.add_middleware(StreamRateLimitMiddleware)
step_daddy = StepDaddy()
epg = EpgService()
title_meta = TitleMetadataService()
vod_resolver = VodResolver()
vod_catalog = VodCatalogService()
_vod_sessions: dict[str, dict] = {}
_VOD_SESSION_TTL = int(os.environ.get("VOD_SESSION_TTL", "3600"))
HTTPX_LIMITS = httpx.Limits(max_keepalive_connections=8, max_connections=16, keepalive_expiry=45.0)
HTTPX_TIMEOUT = httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=5.0)
client = httpx.AsyncClient(http2=True, timeout=HTTPX_TIMEOUT, verify=False, limits=HTTPX_LIMITS)
dead_channels: set[str] = set()
fastapi_app.include_router(stability_router)
fastapi_app.include_router(free_tier_router)
fastapi_app.include_router(channel_report_router)
fastapi_app.include_router(party_router)

_channels_cache: list[Channel] | None = None
_channels_cache_ts: float = 0.0
CHANNELS_CACHE_TTL = int(os.environ.get("CHANNELS_CACHE_TTL", "120"))
_IDENTITY_OVERRIDES_PATH = (
    Path(__file__).resolve().parent.parent / "assets" / "channel_identity_overrides.json"
)
_identity_overrides_cache: dict[str, dict] | None = None
_identity_overrides_mtime: float = 0.0
# DaddyLive household default ON; USE_DADDYLIVE env can force on/off.
get_settings()  # load + apply USE_DADDYLIVE env / data/household_settings.json
# Oracle VPS IPs are often CF-blocked on workers.dev segment CDNs.
# Sticky flags are informational only — clients always try /live/{id}.m3u8 HLS first.
_cdn_blocked_until: float = 0.0
_CDN_BLOCK_TTL_SEC = int(os.environ.get("LIVE_CDN_BLOCK_TTL_SEC", "600"))
# CF ToS takedown of upstream workers.dev zone (not IP-reputation — no egress helps).
_cdn_tos_blocked_until: float = 0.0
_CDN_TOS_BLOCK_TTL_SEC = int(os.environ.get("LIVE_CDN_TOS_BLOCK_TTL_SEC", "3600"))
_CDN_TOS_MARKERS = (
    "terms of service violations",
    "website access blocked",
    "affected zone is",
)
_LIVE_EMBED_AD_HOST_RE = re.compile(
    r"<script[^>]+src=[\"'][^\"']*(?:spikertrepan|adex|popads|propeller|histats|clickaine|adnxs)[^\"']*[\"'][^>]*>\s*</script>",
    re.I,
)
_LIVE_EMBED_INJECT = """
<script>
(function(){
  try {
    var _open = window.open;
    window.open = function(){ return null; };
    document.addEventListener("click", function(e){
      var a = e.target && e.target.closest ? e.target.closest("a[target=_blank],a[target='_blank']") : null;
      if (a) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  } catch (e) {}
})();
</script>
"""


def mark_live_cdn_blocked() -> None:
    global _cdn_blocked_until
    _cdn_blocked_until = _time.time() + max(60, _CDN_BLOCK_TTL_SEC)


def mark_live_cdn_tos_blocked() -> None:
    """Upstream segment zone banned by Cloudflare ToS — residential/SOCKS will not help."""
    global _cdn_tos_blocked_until, _cdn_blocked_until
    _cdn_tos_blocked_until = _time.time() + max(300, _CDN_TOS_BLOCK_TTL_SEC)
    # Informational sticky: playlist may still resolve while segments are dead.
    _cdn_blocked_until = max(_cdn_blocked_until, _cdn_tos_blocked_until)


def live_cdn_is_blocked() -> bool:
    return _time.time() < _cdn_blocked_until


def live_cdn_tos_is_blocked() -> bool:
    return _time.time() < _cdn_tos_blocked_until


def _content_proxy_is_daddylive(host_token: str | None) -> bool:
    """True only when /content host token looks like DaddyLive embed/CDN referer.

    Supplement playlists also rewrite through /content/ — their 403s must not
    sticky-mark household DaddyLive CDN / gray the guide.
    """
    if not host_token:
        return True  # legacy DDL calls sometimes omit host
    try:
        from StepDaddyLiveHD.utils import decrypt

        ref = decrypt(host_token).lower()
    except Exception:
        ref = str(host_token).lower()
    if any(
        x in ref
        for x in (
            "github.com",
            "adultswim",
            "turner.com",
            "ntv.cx",
            "dulo.cx",
            "hesgoales",
            "iptv-org",
            "jsdelivr",
            "direct",
        )
    ):
        return False
    # DaddyLive / DLHD style hosts
    if any(x in ref for x in ("daddylive", "dlhd", "dlstreams", "newkso", "workers.dev", "cdn")):
        return True
    # Unknown host with explicit token — treat as supplement-safe (no sticky)
    return False


def live_stream_path(channel_id: str) -> str:
    """Encode colon-prefixed supplement ids in /live/...m3u8 paths."""
    return f"/live/{quote(str(channel_id), safe='')}.m3u8"


def _normalize_channel_id(channel_id: str) -> str:
    return unquote(str(channel_id or "")).strip()


def _body_looks_like_cf_tos_block(body: bytes | str | None) -> bool:
    if not body:
        return False
    if isinstance(body, bytes):
        try:
            text = body[:8000].decode("utf-8", errors="ignore").lower()
        except Exception:
            return False
    else:
        text = str(body)[:8000].lower()
    return any(m in text for m in _CDN_TOS_MARKERS)


def _live_watch_referer(channel_id: str, embed_url: str | None = None) -> str:
    """Referer the upstream embed expects (watch page), not our gateway origin."""
    cid = str(channel_id).strip()
    bases = list(getattr(step_daddy, "_relay_hosts", []) or []) + list(
        getattr(step_daddy, "_mirrors", []) or []
    )
    base = (getattr(step_daddy, "_base_url", None) or "https://dlhd.st").rstrip("/")
    for b in bases:
        if b:
            base = str(b).rstrip("/")
            break
    return f"{base}/watch/stream-{cid}.php"


def _sanitize_live_embed_html(html: str, channel_id: str) -> str:
    """Strip ads and force Clappr onto same-origin embed playlist.

    Upstream atob() URLs are minted for the VPS IP and require the embed-host
    Referer. In our iframe the browser sends sdgateway → Invalid Referer / Token
    (hls:networkError_manifestLoadError). /live/{id}/embed.m3u8 is fetched by
    the gateway with the correct Referer and leaves absolute segment URLs for
    browser/P2P (VPS /content is often CF-blocked on workers.dev).
    """
    cid = str(channel_id).strip()
    out = _LIVE_EMBED_AD_HOST_RE.sub("", html or "")
    # Protocol-relative CDN/script URLs → https (mixed content safe in our https iframe).
    out = re.sub(r"""(src|href)=(["'])//""", r"""\1=\2https://""", out, flags=re.I)
    # Soften blank-target hijack links.
    out = re.sub(r"""\starget=(["'])_blank\1""", " rel=\"noopener\"", out, flags=re.I)
    embed_src = f"/live/{cid}/embed.m3u8"
    src_js = json.dumps(embed_src)
    replaced = False
    for pat in (
        r"source\s*:\s*window\.atob\('([^']+)'\)",
        r"source\s*:\s*atob\('([^']+)'\)",
        r"source\s*:\s*['\"]https?://[^'\"]+['\"]",
    ):
        new_out, n = re.subn(pat, f"source: {src_js}", out, count=1, flags=re.I)
        if n:
            out = new_out
            replaced = True
            break
    if not replaced:
        # Last resort: prepend assignment if Clappr is constructed later without a match.
        inject_src = (
            f"<script>window.__SD_LIVE_EMBED_SRC={src_js};</script>"
        )
        out = inject_src + out
    if "</head>" in out.lower():
        out = re.sub(r"(?i)</head>", _LIVE_EMBED_INJECT + "</head>", out, count=1)
    else:
        out = _LIVE_EMBED_INJECT + out
    return out


async def _fetch_upstream_live_embed(channel_id: str) -> tuple[str, str]:
    """Return (html, upstream_embed_url). Raises on failure."""
    cid = str(channel_id)
    cached = await step_daddy._ensure_stream_cache(cid)
    referer = str(cached.get("referer") or "")
    if referer and "://" not in referer:
        try:
            referer = unquote(referer)
        except Exception:
            pass
    if not referer.startswith("http"):
        raise ValueError("no_embed_url")
    watch_ref = _live_watch_referer(cid, referer)
    headers = step_daddy._headers(watch_ref)
    resp = await step_daddy._session.get(referer, headers=headers, timeout=20.0, follow_redirects=True)
    if resp.status_code != 200 or not (resp.text or "").strip():
        raise ValueError(f"embed_http_{resp.status_code}")
    return _sanitize_live_embed_html(resp.text, cid), referer




def _sync_epg_catalog():
    if getattr(epg, 'disabled', False):
        return
    try:
        epg.set_catalog([(ch.id, ch.name, ch.tags) for ch in get_channels(include_dead=True, force_refresh=False)])
        epg.ensure_refresh_async()
    except Exception:
        pass

def invalidate_channels_cache():
    global _channels_cache, _channels_cache_ts
    _channels_cache = None
    _channels_cache_ts = 0.0


# After EPG rebuilds programmes, drop channel list so epg_has_data/tvg_id refresh.
epg.on_refresh_done = invalidate_channels_cache


def _daddylive_enabled() -> bool:
    return bool(get_settings().use_daddylive)


def _channel_order_ids() -> list[str]:
    seen: set[str] = set()
    ids: list[str] = []
    for ch in get_channels(include_dead=True):
        cid = str(ch.id)
        if cid in seen:
            continue
        seen.add(cid)
        ids.append(cid)
    return ids


def _channel_index(channel_id: str) -> int | None:
    ids = _channel_order_ids()
    try:
        return ids.index(str(channel_id))
    except ValueError:
        return None


def _hls_error_manifest(message: str) -> str:
    safe = (message or "upstream_error").replace("\n", " ")[:200]
    return f"#EXTM3U\n#EXT-X-ERROR:{safe}\n"

@fastapi_app.on_event("startup")
async def _startup_epg_refresh():
    # Defer so uvicorn can bind; avoid racing catalog.ensure_loaded in startup.
    async def _deferred():
        await asyncio.sleep(2.0)
        try:
            channels = list(step_daddy.channels) or get_channels(include_dead=True, force_refresh=False)
            epg.set_catalog([(ch.id, ch.name, getattr(ch, "tags", None) or []) for ch in channels])
            epg.ensure_refresh_async()
        except Exception:
            pass

    asyncio.create_task(_deferred())



def _hls_headers(filename: str | None = None, cache_control: str = "no-cache") -> dict:
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Cache-Control": cache_control,
    }
    if filename:
        headers["Content-Disposition"] = f"inline; filename={filename}"
    return headers


def _segment_headers() -> dict:
    return _hls_headers(cache_control="public, max-age=8")


def _playlist_cache_headers(filename: str | None = None) -> dict:
    headers = _hls_headers(filename, cache_control="no-cache, no-store, must-revalidate, max-age=0")
    headers["Pragma"] = "no-cache"
    headers["Expires"] = "0"
    return headers


async def _build_stream_response(channel_id: str) -> Response:
    cid = str(channel_id)
    catalog = get_catalog()
    if catalog.is_supplement_id(cid):
        return await _build_supplement_stream_response(cid)
    if not _daddylive_enabled():
        return Response(
            content=_hls_error_manifest("daddylive_disabled"),
            media_type="application/vnd.apple.mpegurl",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            headers=_hls_headers(f"{cid}.m3u8"),
        )
    try:
        content = await step_daddy.stream(channel_id)
        dead_channels.discard(cid)
        return Response(
            content=content,
            media_type="application/vnd.apple.mpegurl",
            headers=_hls_headers(f"{cid}.m3u8"),
        )
    except IndexError:
        dead_channels.add(cid)
        return JSONResponse(content={"error": "Stream not found"}, status_code=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        dead_channels.add(cid)
        return JSONResponse(content={"error": str(e)}, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


async def _build_supplement_stream_response(channel_id: str) -> Response:
    """FreeTV / iptv / ntv / dulo / adultswim — never CDN TOS JSON or DDL sticky marks."""
    catalog = get_catalog()
    cid = _normalize_channel_id(channel_id)
    try:
        await catalog.ensure_loaded()
        content = await catalog.resolve_playlist(cid)
        dead_channels.discard(cid)
        return Response(
            content=content,
            media_type="application/vnd.apple.mpegurl",
            headers=_playlist_cache_headers(f"{cid}-live.m3u8"),
        )
    except Exception as e:
        msg = str(e)
        # Never map supplement upstream failures to HTTP 401 — that falsely trips
        # the TV client's handleAuthFailure / PIN sheet (e.g. "unauthorized" CDN text).
        code = status.HTTP_502_BAD_GATEWAY
        # Do not sticky-mark supplements as dead (that used to gray rows via CDN styling).
        # Do not emit cdn_blocked / cdn_tos_blocked — those are DaddyLive /content only.
        return Response(
            content=_hls_error_manifest(msg),
            media_type="application/vnd.apple.mpegurl",
            status_code=code,
            headers=_playlist_cache_headers(f"{cid}-live.m3u8"),
        )


def _head_from_response(resp: Response) -> Response:
    headers = dict(resp.headers)
    headers.pop("content-length", None)
    return Response(status_code=resp.status_code, headers=headers, media_type=resp.media_type)


@fastapi_app.get("/stream/{channel_id}.m3u8")
async def stream(channel_id: str):
    return await _build_stream_response(channel_id)


@fastapi_app.head("/stream/{channel_id}.m3u8")
async def stream_head(channel_id: str):
    return _head_from_response(await _build_stream_response(channel_id))


@fastapi_app.options("/stream/{channel_id}.m3u8")
async def stream_options(channel_id: str):
    return Response(status_code=204, headers=_hls_headers(f"{channel_id}.m3u8"))


async def _build_live_stream_response(channel_id: str) -> Response:
    cid = _normalize_channel_id(channel_id)
    catalog = get_catalog()
    if catalog.is_supplement_id(cid):
        return await _build_supplement_stream_response(cid)
    if not _daddylive_enabled():
        return Response(
            content=_hls_error_manifest("daddylive_disabled — enable Use DaddyLive in Settings"),
            media_type="application/vnd.apple.mpegurl",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            headers=_playlist_cache_headers(f"{cid}-live.m3u8"),
        )
    try:
        content = await step_daddy.media_stream(channel_id)
        dead_channels.discard(cid)
        return Response(
            content=content,
            media_type="application/vnd.apple.mpegurl",
            headers=_playlist_cache_headers(f"{cid}-live.m3u8"),
        )
    except IndexError:
        dead_channels.add(cid)
        return JSONResponse(content={"error": "Stream not found"}, status_code=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        dead_channels.add(cid)
        return JSONResponse(content={"error": str(e)}, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@fastapi_app.get("/live/{channel_id}.m3u8")
async def live_stream(channel_id: str):
    """Stable media playlist URL for continuous browser playback."""
    return await _build_live_stream_response(channel_id)


@fastapi_app.head("/live/{channel_id}.m3u8")
async def live_stream_head(channel_id: str):
    return _head_from_response(await _build_live_stream_response(channel_id))


@fastapi_app.options("/live/{channel_id}.m3u8")
async def live_stream_options(channel_id: str):
    return Response(status_code=204, headers=_playlist_cache_headers(f"{channel_id}-live.m3u8"))


@fastapi_app.get("/live/{channel_id}/meta")
async def live_stream_meta(channel_id: str):
    """Playlist + optional same-origin embed (manual/debug only).

    prefer_embed is always false — clients must try /live/{id}.m3u8 HLS first.
    cdn_blocked / cdn_tos_blocked are informational sticky flags only.
    """
    cid = _normalize_channel_id(channel_id)
    catalog = get_catalog()
    if catalog.is_supplement_id(cid):
        ch = catalog.get(cid)
        stream = (ch.stream_url if ch and ch.stream_url else live_stream_path(cid))
        return {
            "ok": True,
            "channel_id": cid,
            "stream_url": stream,
            "embed_url": None,
            "embed_playlist_url": None,
            "upstream_embed_url": None,
            "prefer_embed": False,
            "cdn_blocked": False,
            "cdn_tos_blocked": False,
            "source": ch.source if ch else "supplement",
            "provider": ch.provider if ch else None,
            "cdn_note": "Supplement / open IPTV source — no DaddyLive CDN.",
        }
    if not _daddylive_enabled():
        return {
            "ok": False,
            "channel_id": cid,
            "stream_url": live_stream_path(cid),
            "prefer_embed": False,
            "cdn_blocked": True,
            "cdn_tos_blocked": True,
            "error": "daddylive_disabled",
            "cdn_note": "DaddyLive disabled — use Free-TV / iptv-org / Dulo / ntv channels.",
        }
    cdn_blocked = live_cdn_is_blocked()
    tos_blocked = live_cdn_tos_is_blocked()
    cached = step_daddy._stream_cache.get(cid)
    if not cached:
        try:
            cached = await step_daddy._ensure_stream_cache(cid)
        except Exception as e:
            # Still return stream_url + optional embed path when resolve is flaky.
            return {
                "ok": True,
                "channel_id": cid,
                "stream_url": live_stream_path(cid),
                "embed_url": f"/live/{quote(cid, safe='')}/embed",
                "embed_playlist_url": f"/live/{quote(cid, safe='')}/embed.m3u8",
                "upstream_embed_url": None,
                "prefer_embed": False,
                "cdn_blocked": True,
                "cdn_tos_blocked": tos_blocked,
                "error": str(e),
                "cdn_note": "CDN/meta degraded — try /live/{id}.m3u8; /embed is manual/debug only.",
            }
    referer = str((cached or {}).get("referer") or "")
    if referer and "://" not in referer:
        try:
            referer = unquote(referer)
        except Exception:
            pass
    upstream_embed = referer if referer.startswith("http") else None
    if tos_blocked:
        cdn_note = (
            "Upstream workers.dev zone ToS-blocked by Cloudflare — "
            "waiting on upstream CDN rotate; SOCKS/IP change will not help. "
            "Client should fail-fast on HLS (no auto-embed)."
        )
    elif cdn_blocked:
        cdn_note = (
            "VPS /content recently blocked (informational). "
            "Client still tries /live/{id}.m3u8 first; /embed is manual/debug only."
        )
    else:
        cdn_note = "Primary path is /live/{id}.m3u8 HLS; /embed is manual/debug only."
    return {
        "ok": True,
        "channel_id": cid,
        "stream_url": live_stream_path(cid),
        # Same-origin sanitized Clappr page — manual/debug; not driven by prefer_embed.
        "embed_url": f"/live/{quote(cid, safe='')}/embed",
        "embed_playlist_url": f"/live/{quote(cid, safe='')}/embed.m3u8",
        "upstream_embed_url": upstream_embed,
        "referer_host": (cached or {}).get("referer_host"),
        "prefer_embed": False,
        "cdn_blocked": cdn_blocked or tos_blocked,
        "cdn_tos_blocked": tos_blocked,
        "cdn_note": cdn_note,
    }


@fastapi_app.get("/live/{channel_id}/embed")
async def live_stream_embed(channel_id: str):
    """Same-origin live player page (sanitized upstream Clappr) for CDN-blocked HLS."""
    try:
        html, _upstream = await _fetch_upstream_live_embed(str(channel_id))
    except Exception as e:
        return JSONResponse(
            content={"ok": False, "error": str(e), "channel_id": str(channel_id)},
            status_code=status.HTTP_502_BAD_GATEWAY,
        )
    headers = {
        "Cache-Control": "private, max-age=30",
        "Content-Security-Policy": "frame-ancestors 'self'",
        "X-Frame-Options": "SAMEORIGIN",
        # Playlist is same-origin; absolute CDN segments may omit Referer (safer than wrong host).
        "Referrer-Policy": "no-referrer",
    }
    return Response(content=html, media_type="text/html; charset=utf-8", headers=headers)


async def _build_live_embed_playlist_response(channel_id: str) -> Response:
    """Media playlist with absolute upstream segment URLs for backup Clappr/P2P."""
    try:
        content = await step_daddy.media_stream(channel_id, direct_segments=True)
        dead_channels.discard(str(channel_id))
        return Response(
            content=content,
            media_type="application/vnd.apple.mpegurl",
            headers=_playlist_cache_headers(f"{channel_id}-live-embed.m3u8"),
        )
    except IndexError:
        dead_channels.add(str(channel_id))
        return JSONResponse(content={"error": "Stream not found"}, status_code=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        dead_channels.add(str(channel_id))
        return JSONResponse(content={"error": str(e)}, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@fastapi_app.get("/live/{channel_id}/embed.m3u8")
async def live_embed_playlist(channel_id: str):
    """Backup-player playlist: gateway resolves auth; browser loads CDN segments directly."""
    return await _build_live_embed_playlist_response(channel_id)


@fastapi_app.head("/live/{channel_id}/embed.m3u8")
async def live_embed_playlist_head(channel_id: str):
    return _head_from_response(await _build_live_embed_playlist_response(channel_id))


@fastapi_app.options("/live/{channel_id}/embed.m3u8")
async def live_embed_playlist_options(channel_id: str):
    return Response(status_code=204, headers=_playlist_cache_headers(f"{channel_id}-live-embed.m3u8"))


@fastapi_app.get("/key/{url}/{host}")
async def key(url: str, host: str):
    try:
        headers = _hls_headers("key")
        return Response(
            content=await step_daddy.key(url, host),
            media_type="application/octet-stream",
            headers=headers,
        )
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


async def _content_response(path: str, host: str | None = None):
    kind, media_type, upstream_status, payload = await step_daddy.fetch_content(path, host)
    if upstream_status != 200:
        # Cloudflare often blocks Oracle VPS IPs on workers.dev segment hosts (403).
        # Also detect zone-wide ToS takedowns (residential egress cannot bypass).
        tos = False
        if upstream_status in (403, 429) and isinstance(payload, (bytes, bytearray, str)):
            tos = _body_looks_like_cf_tos_block(payload)
        # FreeTV/iptv/Adult Swim / ntv / dulo also use /content/ after playlist rewrite.
        # Never sticky-mark household DaddyLive CDN from those referers.
        sticky = _content_proxy_is_daddylive(host)
        if sticky:
            if tos:
                mark_live_cdn_tos_blocked()
            elif upstream_status in (403, 429):
                mark_live_cdn_blocked()
        code = status.HTTP_502_BAD_GATEWAY
        return JSONResponse(
            content={
                "error": f"upstream_http_{upstream_status}",
                "cdn_blocked": sticky and upstream_status in (403, 429),
                "cdn_tos_blocked": sticky and (tos or live_cdn_tos_is_blocked()),
                "hint": "live_unavailable_upstream_cdn" if sticky else "supplement_upstream_http",
            },
            status_code=code,
            headers=_hls_headers(),
        )
    if kind == "playlist":
        headers = _playlist_cache_headers("playlist.m3u8")
        return Response(content=payload, media_type=media_type, headers=headers)
    headers = _segment_headers()
    async def _iter_bytes():
        async for chunk in payload:
            yield chunk
    return StreamingResponse(_iter_bytes(), media_type=media_type, headers=headers)


@fastapi_app.get("/content/{path}/{host}")
@fastapi_app.get("/content/{path}")
async def content(path: str, host: str | None = None):
    """Proxy CDN playlists/segments. Host token carries the iframe referer required by the CDN."""
    try:
        return await _content_response(path, host)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@fastapi_app.head("/content/{path}/{host}")
@fastapi_app.head("/content/{path}")
async def content_head(path: str, host: str | None = None):
    headers = _segment_headers()
    headers["Content-Type"] = "video/mp2t"
    return Response(status_code=200, headers=headers)


@fastapi_app.options("/content/{path}/{host}")
@fastapi_app.options("/content/{path}")
async def content_options(path: str, host: str | None = None):
    return Response(status_code=204, headers=_hls_headers("segment.ts"))


def _load_identity_overrides() -> dict[str, dict]:
    """Gateway-id → display_name / logo / call_sign overrides (visual repairs)."""
    global _identity_overrides_cache, _identity_overrides_mtime
    path = _IDENTITY_OVERRIDES_PATH
    try:
        mtime = path.stat().st_mtime if path.exists() else 0.0
    except OSError:
        mtime = 0.0
    if _identity_overrides_cache is not None and mtime == _identity_overrides_mtime:
        return _identity_overrides_cache
    data: dict[str, dict] = {}
    if path.exists():
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                data = {str(k): v for k, v in raw.items() if isinstance(v, dict)}
        except Exception:
            data = {}
    _identity_overrides_cache = data
    _identity_overrides_mtime = mtime
    return data


def _apply_identity_override(ch_id: str, name: str, logo: str | None) -> tuple[str, str | None]:
    ov = _load_identity_overrides().get(str(ch_id)) or {}
    out_name = str(ov.get("display_name") or name or "").strip() or name
    out_logo = logo
    raw_logo = (ov.get("logo") or "").strip()
    if raw_logo:
        if raw_logo.startswith("http://") or raw_logo.startswith("https://"):
            api = (os.environ.get("API_URL") or "").rstrip("/")
            encoded = urlsafe_base64(raw_logo)
            out_logo = f"{api}/logo/{encoded}" if api else f"/logo/{encoded}"
        else:
            out_logo = raw_logo
    return out_name, out_logo


async def update_channels():
    while True:
        try:
            if _daddylive_enabled():
                await step_daddy.load_channels()
            else:
                # Keep empty DDL catalog while disabled — do not hammer upstream.
                step_daddy.channels = []
            try:
                await get_catalog().ensure_loaded(force=True)
            except Exception:
                pass
            invalidate_channels_cache()
            _sync_epg_catalog()
            await asyncio.sleep(300)
        except asyncio.CancelledError:
            continue


def _apply_channel_taxonomy(
    *,
    name: str,
    tags: list,
    group_title: str | None,
    source: str | None,
    provider: str | None,
    tvg_id: str | None,
) -> dict:
    tax = normalize_channel_taxonomy(
        name=name,
        tags=tags,
        group_title=group_title,
        source=source,
        provider=provider,
        tvg_id=tvg_id,
    )
    # Prefer facet genre label for legacy group_title consumers; keep raw only if no genre.
    gt = genre_group_title(tax) or group_title
    return {
        "genre": tax.genre,
        "genres": list(tax.genres),
        "distributor": tax.distributor,
        "country": tax.country,
        "language": tax.language,
        "group_title": gt,
    }


def _build_channels_list() -> list[Channel]:
    channels = []
    skip_epg = getattr(epg, "disabled", False)
    ddl_cdn_blocked = live_cdn_is_blocked() or live_cdn_tos_is_blocked()
    ddl_cdn_tos = live_cdn_tos_is_blocked()
    if _daddylive_enabled():
        for ch in step_daddy.channels:
            name, logo = _apply_identity_override(ch.id, ch.name, ch.logo)
            if skip_epg:
                tvg_id = None
                epg_has = False
            else:
                match = epg.map_channel_by_id(ch.id, name)
                tvg_id = match.tvg_id
                epg_has = epg.has_programme_data(match.tvg_id)
            facets = _apply_channel_taxonomy(
                name=name,
                tags=ch.tags,
                group_title=None,
                source="ddl",
                provider="DaddyLive",
                tvg_id=tvg_id,
            )
            channels.append(Channel(
                id=ch.id,
                name=name,
                tags=ch.tags,
                logo=logo,
                dead=(ch.id in dead_channels),
                cdn_blocked=ddl_cdn_blocked,
                cdn_tos_blocked=ddl_cdn_tos,
                tvg_id=tvg_id,
                epg_has_data=epg_has,
                provider="DaddyLive",
                group_title=facets["group_title"],
                stream_url=live_stream_path(ch.id),
                source="ddl",
                genre=facets["genre"],
                genres=facets["genres"],
                distributor=facets["distributor"],
                country=facets["country"],
                language=facets["language"],
            ))
    for sch in get_catalog().list_channels():
        name, logo = _apply_identity_override(sch.id, sch.name, sch.logo)
        if skip_epg:
            tvg_id = sch.tvg_id
            epg_has = False
        else:
            match = epg.map_channel_by_id(sch.id, name)
            # Prefer playlist tvg-id when it has programmes; else woftv/mapper id.
            candidates = [sch.tvg_id, match.tvg_id]
            tvg_id = None
            epg_has = False
            for cand in candidates:
                cid = str(cand).strip() if cand else ""
                if not cid:
                    continue
                if epg.has_programme_data(cid):
                    tvg_id = cid
                    epg_has = True
                    break
                if tvg_id is None:
                    tvg_id = cid
        facets = _apply_channel_taxonomy(
            name=name,
            tags=list(sch.tags),
            group_title=sch.group_title,
            source=sch.source,
            provider=sch.provider,
            tvg_id=tvg_id,
        )
        channels.append(Channel(
            id=sch.id,
            name=name,
            tags=list(sch.tags),
            logo=logo,
            dead=(sch.id in dead_channels),
            cdn_blocked=False,
            cdn_tos_blocked=False,
            tvg_id=tvg_id,
            epg_has_data=epg_has,
            provider=sch.provider,
            group_title=facets["group_title"],
            stream_url=sch.stream_url or live_stream_path(sch.id),
            source=sch.source,
            genre=facets["genre"],
            genres=facets["genres"],
            distributor=facets["distributor"],
            country=facets["country"],
            language=facets["language"],
        ))
    return channels


def get_channels(include_dead: bool = True, force_refresh: bool = False):
    global _channels_cache, _channels_cache_ts
    now = time.time()
    if force_refresh or _channels_cache is None or (now - _channels_cache_ts) > CHANNELS_CACHE_TTL:
        _channels_cache = _build_channels_list()
        _channels_cache_ts = now
    channels = _channels_cache
    if include_dead:
        return channels
    return [ch for ch in channels if not ch.dead]


def get_channel(channel_id) -> Channel | None:
    if not channel_id or channel_id == "":
        return None
    cid = _normalize_channel_id(channel_id)
    for ch in get_channels(include_dead=True):
        if ch.id == cid:
            return ch
    return None


def _build_playlist_response() -> Response:
    enriched_channels = get_channels(include_dead=True)
    headers = _hls_headers("playlist.m3u8")
    headers["Content-Disposition"] = "attachment; filename=playlist.m3u8"
    return Response(
        content=step_daddy.playlist(enriched_channels),
        media_type="application/vnd.apple.mpegurl",
        headers=headers,
    )


@fastapi_app.get("/playlist.m3u8")
def playlist():
    return _build_playlist_response()


@fastapi_app.head("/playlist.m3u8")
def playlist_head():
    return _head_from_response(_build_playlist_response())


@fastapi_app.options("/playlist.m3u8")
def playlist_options():
    return Response(status_code=204, headers=_hls_headers("playlist.m3u8"))


@fastapi_app.get("/dulo-stream/{channel_id}.m3u8")
async def dulo_stream(channel_id: str):
    try:
        content = await get_catalog().resolve_dulo_playlist(channel_id)
        return Response(
            content=content,
            media_type="application/vnd.apple.mpegurl",
            headers=_playlist_cache_headers(f"dulo-{channel_id}.m3u8"),
        )
    except Exception as e:
        msg = str(e)
        auth = "auth" in msg.lower()
        return Response(
            content=_hls_error_manifest(msg),
            media_type="application/vnd.apple.mpegurl",
            status_code=status.HTTP_401_UNAUTHORIZED if auth else status.HTTP_502_BAD_GATEWAY,
            headers=_playlist_cache_headers(f"dulo-{channel_id}.m3u8"),
        )


@fastapi_app.head("/dulo-stream/{channel_id}.m3u8")
async def dulo_stream_head(channel_id: str):
    return Response(status_code=200, headers=_playlist_cache_headers(f"dulo-{channel_id}.m3u8"), media_type="application/vnd.apple.mpegurl")


@fastapi_app.get("/ntv-stream/{token}.m3u8")
async def ntv_stream(token: str):
    try:
        content = await get_catalog().resolve_ntv_playlist(token)
        return Response(
            content=content,
            media_type="application/vnd.apple.mpegurl",
            headers=_playlist_cache_headers(f"ntv-{token}.m3u8"),
        )
    except Exception as e:
        return Response(
            content=_hls_error_manifest(str(e)),
            media_type="application/vnd.apple.mpegurl",
            status_code=status.HTTP_502_BAD_GATEWAY,
            headers=_playlist_cache_headers(f"ntv-{token}.m3u8"),
        )


@fastapi_app.head("/ntv-stream/{token}.m3u8")
async def ntv_stream_head(token: str):
    return Response(status_code=200, headers=_playlist_cache_headers(f"ntv-{token}.m3u8"), media_type="application/vnd.apple.mpegurl")


@fastapi_app.get("/settings/household")
def household_settings_get():
    settings = get_settings().as_dict()
    settings["dulo_auth_configured"] = dulo_mod.auth_configured()
    settings["supplement_stats"] = get_catalog().stats
    settings["cdn_blocked"] = live_cdn_is_blocked() or live_cdn_tos_is_blocked()
    settings["cdn_tos_blocked"] = live_cdn_tos_is_blocked()
    return settings


@fastapi_app.patch("/settings/household")
@fastapi_app.post("/settings/household")
async def household_settings_set(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}
    updated = get_settings().update(body)
    # Refresh channel merge when DDL toggle flips
    if "use_daddylive" in body:
        if updated.get("use_daddylive"):
            try:
                await step_daddy.load_channels()
            except Exception:
                pass
        else:
            step_daddy.channels = []
            step_daddy.invalidate_stream_cache()
    try:
        await get_catalog().ensure_loaded(force=True)
    except Exception:
        pass
    invalidate_channels_cache()
    _sync_epg_catalog()
    updated["dulo_auth_configured"] = dulo_mod.auth_configured()
    updated["supplement_stats"] = get_catalog().stats
    updated["cdn_blocked"] = live_cdn_is_blocked() or live_cdn_tos_is_blocked()
    updated["cdn_tos_blocked"] = live_cdn_tos_is_blocked()
    return updated


_health_started_at = time.time()


@fastapi_app.get("/health")
def health(lite: int = 0):
    """Lite health probe (Android /health?lite=1 compatible subset)."""
    status = channels_status()
    epg_off = bool(getattr(epg, "disabled", False))
    bundle_version = None
    try:
        with open(os.path.join(os.path.dirname(__file__), "..", "VERSION"), encoding="utf-8") as fh:
            bundle_version = fh.read().strip() or None
    except Exception:
        bundle_version = None
    payload = {
        "ok": status["total_count"] > 0,
        "starting": status["total_count"] == 0,
        "version": "StepDaddyLiveHD-linux",
        "bundle_version": bundle_version,
        "channels": status["total_count"],
        "dead_count": status["dead_count"],
        "port": int(os.environ.get("PORT", "3000")),
        "upstream_base_url": step_daddy._base_url,
        "relay_hosts": step_daddy._relay_hosts,
        "epg_enabled": not epg_off,
        "epg_woftv_lite": bool(getattr(epg, "woftv_lite", False)),
        "epg_mapped_count": status.get("epg_mapped_count", 0),
        "epg_refreshing": status.get("epg_refreshing", False),
        "uptime_seconds": int(time.time() - _health_started_at),
        "stream_cache_entries": len(step_daddy._stream_cache),
        "daddylive_enabled": _daddylive_enabled(),
        "supplement_stats": get_catalog().stats,
        "dulo_auth_configured": dulo_mod.auth_configured(),
    }
    if not lite:
        payload["upstream_mirrors"] = step_daddy._mirrors
        payload["dead_channels_sample"] = status["dead"][:15]
    return payload


@fastapi_app.get("/health/visual")
def health_visual():
    """Mobile-friendly visual health dashboard with live video probe."""
    api_url = os.environ.get("API_URL", "")
    domain = os.environ.get("PUBLIC_DOMAIN", "sdgateway.duckdns.org")
    html = render_health_visual_page(probe_channel="763", api_url=api_url, domain=domain)
    return Response(content=html, media_type="text/html; charset=utf-8")


@fastapi_app.get("/channels/status")
def channels_status():
    meta = epg.debug_refresh_meta()
    channels = get_channels(include_dead=True)
    total = len(channels)
    if meta.get("refreshing"):
        return {
            "dead": sorted(dead_channels),
            "dead_count": len(dead_channels),
            "total_count": total,
            "daddylive_enabled": _daddylive_enabled(),
            "daddylive_count": len(step_daddy.channels) if _daddylive_enabled() else 0,
            "supplement_stats": get_catalog().stats,
            "epg_mapped_count": -1,
            "epg_refreshing": True,
        }
    mapped = len([c for c in channels if c.epg_has_data])
    return {
        "dead": sorted(dead_channels),
        "dead_count": len(dead_channels),
        "total_count": total,
        "daddylive_enabled": _daddylive_enabled(),
        "daddylive_count": len(step_daddy.channels) if _daddylive_enabled() else 0,
        "supplement_stats": get_catalog().stats,
        "epg_mapped_count": mapped,
        "epg_refreshing": False,
    }


def _epg_updated_at() -> str | None:
    ts = getattr(epg, "_last_refresh", 0.0) or 0.0
    if ts <= 0:
        return None
    return datetime.fromtimestamp(ts, timezone.utc).isoformat()


@fastapi_app.get("/epg/status")
def epg_status():
    meta = epg.debug_refresh_meta()
    return {
        "ready": bool(meta.get("epg_ready")),
        "refreshing": bool(meta.get("refreshing")),
        "updated_at": _epg_updated_at(),
        "proven_channels": meta.get("proven_channels", 0),
        "mapped_channels": meta.get("android_mapped_ids", 0),
        "gap_fill_queued": meta.get("gap_fill_queued", 0),
        "gap_fill_busy": bool(meta.get("gap_fill_busy")),
    }


@fastapi_app.get("/epg.xml")
def epg_xml():
    channels = get_channels(include_dead=True)
    tvg_ids = {c.tvg_id for c in channels if c.tvg_id}
    xml = epg.build_filtered_epg_xml(tvg_ids)
    return Response(content=xml, media_type="application/xml")


@fastapi_app.get("/epg/now-next/{channel_id}")
def epg_now_next(channel_id: str):
    return _epg_now_next_payload(channel_id)


@fastapi_app.get("/epg/schedule/{channel_id}")
def epg_schedule(channel_id: str, hours: int = 24):
    return _epg_schedule_payload(channel_id, hours=hours)


# Cap batch size so a runaway client cannot expand into a full-catalog scan on
# the RAM-constrained Oracle free-tier (WOFTV lite).
_EPG_BATCH_MAX = 48


def _epg_now_next_payload(
    channel_id: str,
    *,
    allow_live_fill: bool = True,
    queue_fill: bool = False,
) -> dict:
    ch = get_channel(channel_id)
    if not ch or not ch.tvg_id:
        return {
            "channel_id": channel_id,
            "tvg_id": ch.tvg_id if ch else None,
            "has_data": False,
            "now": None,
            "next": None,
            "fill_pending": False,
            "updated_at": _epg_updated_at(),
        }
    data = epg.get_now_next(
        ch.tvg_id, channel_id=channel_id, allow_live_fill=allow_live_fill
    )
    has = bool(data.get("now") or data.get("next") or ch.epg_has_data)
    fill_pending = False
    if queue_fill and not (data.get("now") or data.get("next")):
        fill_pending = bool(epg.queue_live_fill(channel_id, ch.tvg_id))
    return {
        "channel_id": channel_id,
        "tvg_id": ch.tvg_id,
        "has_data": has,
        "fill_pending": fill_pending,
        "updated_at": _epg_updated_at(),
        **data,
    }


def _epg_schedule_payload(
    channel_id: str,
    hours: int = 24,
    *,
    allow_live_fill: bool = True,
    queue_fill: bool = False,
) -> dict:
    ch = get_channel(channel_id)
    if not ch or not ch.tvg_id:
        return {
            "channel_id": channel_id,
            "tvg_id": ch.tvg_id if ch else None,
            "has_data": False,
            "programmes": [],
            "fill_pending": False,
            "updated_at": _epg_updated_at(),
        }
    programmes = epg.get_schedule(
        ch.tvg_id,
        hours=hours,
        channel_id=channel_id,
        allow_live_fill=allow_live_fill,
    )
    fill_pending = False
    if queue_fill and not programmes:
        fill_pending = bool(epg.queue_live_fill(channel_id, ch.tvg_id))
    return {
        "channel_id": channel_id,
        "tvg_id": ch.tvg_id,
        "has_data": bool(programmes) or bool(ch.epg_has_data),
        "programmes": programmes,
        "fill_pending": fill_pending,
        "updated_at": _epg_updated_at(),
    }


def _normalize_epg_batch_ids(raw) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in raw:
        cid = str(item or "").strip()
        if not cid or cid in seen:
            continue
        seen.add(cid)
        out.append(cid)
        if len(out) >= _EPG_BATCH_MAX:
            break
    return out


@fastapi_app.post("/epg/now-next/batch")
async def epg_now_next_batch(request: Request):
    """Batch now/next — RAM/disk first; live gap fills run async (never stall the batch)."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    ids = _normalize_epg_batch_ids((body or {}).get("channel_ids"))
    updated = _epg_updated_at()
    channels = {
        cid: _epg_now_next_payload(cid, allow_live_fill=False, queue_fill=True)
        for cid in ids
    }
    pending = sum(1 for row in channels.values() if row.get("fill_pending"))
    return {
        "updated_at": updated,
        "channels": channels,
        "count": len(channels),
        "fill_pending_count": pending,
    }


@fastapi_app.post("/epg/schedule/batch")
async def epg_schedule_batch(request: Request):
    """Batch schedules — warm cache immediately; Pluto/epg.pw fills queued in background."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    body = body or {}
    ids = _normalize_epg_batch_ids(body.get("channel_ids"))
    try:
        hours = int(body.get("hours") or 24)
    except (TypeError, ValueError):
        hours = 24
    hours = max(1, min(hours, 48))
    updated = _epg_updated_at()
    channels = {
        cid: _epg_schedule_payload(
            cid, hours=hours, allow_live_fill=False, queue_fill=True
        )
        for cid in ids
    }
    pending = sum(1 for row in channels.values() if row.get("fill_pending"))
    return {
        "updated_at": updated,
        "hours": hours,
        "channels": channels,
        "count": len(channels),
        "fill_pending_count": pending,
    }


@fastapi_app.get("/epg/events")
def epg_events(hours: int = 24, limit: int = 300):
    channels = get_channels(include_dead=True)
    by_tvg = {c.tvg_id: c for c in channels if c.tvg_id}
    events = []
    for e in epg.get_upcoming_events(hours=hours, limit=limit * 2):
        ch = by_tvg.get(e["channel"])
        if not ch:
            continue
        events.append({
            "name": e["title"],
            "time": datetime.fromisoformat(e["start"]).strftime("%H:%M"),
            "dt": e["start"],
            "category": e["category"],
            "channels": [{"name": ch.name, "id": ch.id}],
        })
        if len(events) >= limit:
            break
    return events


@fastapi_app.get("/meta/programme")
def meta_programme(
    title: str,
    programme_type: str = "other",
    year: int | None = None,
    season: int | None = None,
    episode: int | None = None,
    subtitle: str | None = None,
    poster_url: str | None = None,
):
    meta = title_meta.lookup_programme(
        title=title,
        programme_type=programme_type,
        year=year,
        season=season,
        episode=episode,
        subtitle=subtitle,
    )
    if isinstance(meta, dict):
        meta = dict(meta)
    elif meta is not None and hasattr(meta, "to_dict"):
        meta = meta.to_dict()
    epg_poster = (poster_url or "").strip()
    if epg_poster and (not meta or not meta.get("poster_url")):
        meta = meta or {
            "title": title,
            "matched_title": title,
            "poster_url": None,
            "source": "epg",
            "cast_members": [],
        }
        meta["poster_url"] = epg_poster
        src = str(meta.get("source") or "")
        meta["source"] = (src + "+epg").strip("+") if src and src != "none" else "epg"
    meta = _sanitize_title_meta(meta)
    if not meta or not meta.get("poster_url"):
        return {"has_data": bool(meta and meta.get("matched_title")), "meta": meta}
    return {"has_data": True, "meta": meta}


def _epg_prog_for_meta_lookup(prog: dict | None) -> dict | None:
    """Strip WOFTV plot-in-subtitle so title_meta matches the real programme title."""
    if not prog or not isinstance(prog, dict):
        return prog
    out = dict(prog)
    sub = str(out.get("subtitle") or "").strip()
    # Episode labels stay; long synopsis/plot text poisons Metahub/TVmaze matching.
    if sub and (
        len(sub) > 80
        or sub.endswith(".")
        or " stars " in sub.lower()
        or sub.lower().startswith(("a ", "an ", "the ", "when ", "after "))
    ):
        out["subtitle"] = ""
    return out


def _sanitize_title_meta(meta: dict | None) -> dict | None:
    """Drop poster URLs that are known-dead so UI never shows a broken image box."""
    if not meta:
        return meta
    out = dict(meta)
    poster = str(out.get("poster_url") or "").strip()
    if not poster:
        return out
    # Trusted live art hosts — skip HEAD probe (CDN often rejects HEAD).
    low = poster.lower()
    if any(
        h in low
        for h in (
            "images.pluto.tv",
            "images.metahub.space",
            "image.tmdb.org",
            "media-amazon.com",
            "m.media-amazon.com",
            "static.tvmaze.com",
        )
    ):
        return out
    # Metahub often 307→404 for wrong IDs; probe quickly and clear on hard failure only.
    try:
        req = urllib.request.Request(
            poster,
            method="HEAD",
            headers={"User-Agent": "StepDaddy-Gateway/1.0"},
        )
        with urllib.request.urlopen(req, timeout=2.5) as resp:
            code = int(getattr(resp, "status", None) or resp.getcode() or 0)
            if code >= 400:
                out["poster_url"] = None
    except urllib.error.HTTPError as exc:
        if int(getattr(exc, "code", 0) or 0) >= 400:
            out["poster_url"] = None
    except Exception:
        # Network/timeout — keep URL; client onerror handles broken art.
        pass
    return out


@fastapi_app.get("/meta/now/{channel_id}")
def meta_now(channel_id: str):
    ch = get_channel(channel_id)
    if not ch:
        return {"channel_id": channel_id, "has_data": False, "programme": None, "meta": None}
    # Prefer live now/next (incl. Pluto by channel_id) even when catalog epg_has_data is stale.
    nn = epg.get_now_next(ch.tvg_id or "", channel_id=channel_id)
    now = nn.get("now") if isinstance(nn, dict) else None
    if not now:
        return {"channel_id": channel_id, "has_data": False, "programme": None, "meta": None}
    meta = _sanitize_title_meta(
        title_meta.lookup_from_epg_programme(_epg_prog_for_meta_lookup(now))
    )
    return {
        "channel_id": channel_id,
        "has_data": bool(meta and meta.get("poster_url")),
        "programme": now,
        "meta": meta,
    }


@fastapi_app.get("/vod/sources")
def vod_sources(
    tmdb_id: int,
    type: str = "movie",
    season: int | None = None,
    episode: int | None = None,
    lang: str = "en",
    prefer_lang: str | None = None,
    include_other_langs: bool = False,
):
    prefer = (prefer_lang or lang or "en").strip().lower() or "en"
    sources = list_sources(
        tmdb_id,
        type,
        season,
        episode,
        lang,
        include_auto=True,
        prefer_lang=prefer,
        include_other_langs=include_other_langs or prefer in ("multi", "any", "all"),
    )
    return {
        "tmdb_id": tmdb_id,
        "type": type,
        "season": season,
        "episode": episode,
        "lang": lang,
        "prefer_lang": prefer,
        "count": len(sources),
        "sources": sources_as_dicts(sources),
        "omss_enabled": omss_client.enabled(),
        "direct_hls_providers": sorted(HLS_PROVIDER_IDS),
    }


@fastapi_app.get("/vod/sources/now/{channel_id}")
def vod_sources_now(channel_id: str, lang: str = "en"):
    """VOD sources for the programme currently on air (uses EPG + metadata)."""
    ch = get_channel(channel_id)
    if not ch or not ch.tvg_id or not ch.epg_has_data:
        return {"channel_id": channel_id, "has_data": False, "sources": []}
    nn = epg.get_now_next(ch.tvg_id)
    now = nn.get("now")
    if not now:
        return {"channel_id": channel_id, "has_data": False, "sources": []}
    meta = title_meta.lookup_from_epg_programme(_epg_prog_for_meta_lookup(now)) or {}
    tmdb_id = meta.get("tmdb_id")
    if not tmdb_id:
        return {
            "channel_id": channel_id,
            "has_data": False,
            "programme": now,
            "meta": meta,
            "sources": [],
        }
    ptype = now.get("programme_type") or "movie"
    season = now.get("season")
    episode = now.get("episode")
    sources = list_sources(tmdb_id, ptype, season, episode, lang)
    return {
        "channel_id": channel_id,
        "has_data": True,
        "programme": now,
        "meta": meta,
        "tmdb_id": tmdb_id,
        "count": len(sources),
        "sources": sources_as_dicts(sources),
    }


def _vod_purge_sessions():
    now = _time.time()
    dead = [k for k, v in _vod_sessions.items() if now - v.get("ts", 0) > _VOD_SESSION_TTL]
    for k in dead:
        _vod_sessions.pop(k, None)


def _vod_create_session(result: VodResolveResult, meta: dict | None = None) -> str:
    _vod_purge_sessions()
    sid = secrets.token_urlsafe(14)
    meta = meta or {}
    _vod_sessions[sid] = {
        "manifest_url": result.manifest_url,
        "referer": result.referer,
        "origin": result.origin,
        "provider": result.provider,
        "provider_name": result.provider_name,
        "quality": result.quality,
        "source": result.source,
        "kind": getattr(result, "kind", None) or "hls",
        "tmdb_id": meta.get("tmdb_id"),
        "media_type": meta.get("media_type"),
        "title": meta.get("title"),
        "season": meta.get("season"),
        "episode": meta.get("episode"),
        "ts": _time.time(),
    }
    return sid


def _first_embed_fallback(sources: list[dict]) -> dict | None:
    """Prefer frameable clean embeds for Auto iframe fallback.

    Skip auto rows and hosts that refuse cross-origin framing
    (e.g. VidZee X-Frame-Options: SAMEORIGIN → blank player).
    """
    from StepDaddyLiveHD.vod_sources import FRAMEABLE_EMBED_IDS, embed_url_frameable

    preferred_ids = FRAMEABLE_EMBED_IDS + ("vidzee",)

    def _ok(s: dict, *, require_frameable: bool = True) -> bool:
        if s.get("auto"):
            return False
        url = (s.get("embed_url") or "").strip()
        if not url:
            return False
        if require_frameable and not embed_url_frameable(url):
            return False
        return True

    for pid in preferred_ids:
        for s in sources:
            if _ok(s) and s.get("id") == pid:
                return s
    for s in sources:
        if _ok(s) and (s.get("risk") or "standard") == "preferred":
            return s
    for s in sources:
        if _ok(s) and (s.get("risk") or "standard") != "risky":
            return s
    for s in sources:
        if _ok(s):
            return s
    # Absolute last resort (may blank in iframe — Sources UI can still list it).
    for s in sources:
        if _ok(s, require_frameable=False):
            return s
    return None


def _merge_resolve_results(*groups: list[VodResolveResult]) -> list[VodResolveResult]:
    from StepDaddyLiveHD.vod_resolver import _provider_clean_rank

    seen: set[str] = set()
    out: list[VodResolveResult] = []
    for group in groups:
        for item in group:
            key = item.manifest_url.split("?", 1)[0]
            if key in seen:
                continue
            seen.add(key)
            out.append(item)
    out.sort(
        key=lambda r: (
            1 if (getattr(r, "kind", "hls") or "hls") == "hls" else 0,
            _provider_clean_rank(r.provider),
            omss_client._quality_rank(r.quality),
            1 if r.source == "omss" else 0,
        ),
        reverse=True,
    )
    return out


async def _vod_resolve_all(
    tmdb_id: int,
    media_type: str,
    season: int | None,
    episode: int | None,
    provider: str | None,
    lang: str,
) -> list[VodResolveResult]:
    omss_results: list[VodResolveResult] = []
    if omss_client.enabled() and not provider:
        omss_results = await omss_client.fetch_sources(
            tmdb_id, media_type, season, episode, client=client
        )
    local_results = await vod_resolver.resolve_all(
        tmdb_id=tmdb_id,
        media_type=media_type,
        season=season,
        episode=episode,
        provider=provider,
        lang=lang,
    )
    merged = _merge_resolve_results(omss_results, local_results)
    if provider:
        pid = provider.strip().lower()
        merged = [r for r in merged if r.provider == pid]
    return merged


def _resolve_result_payload(result: VodResolveResult, sid: str) -> dict:
    kind = (getattr(result, "kind", None) or "hls").strip().lower()
    if kind == "mp4":
        stream_url = f"/vod/file/{sid}"
        method = "mp4"
    else:
        stream_url = f"/vod/hls/{sid}.m3u8"
        method = "hls"
    return {
        "ok": True,
        "method": method,
        "kind": kind,
        "provider": result.provider,
        "provider_name": result.provider_name or result.provider,
        "quality": result.quality,
        "source": result.source,
        "stream_url": stream_url,
    }


_VOD_MIN_MP4_BYTES = int(os.environ.get("VOD_MIN_MP4_BYTES", str(5 * 1024 * 1024)))


async def _mp4_looks_complete(result: VodResolveResult) -> bool:
    """Reject OMSS/provider stub previews (~20s / <5MB) that look like a full episode."""
    if (getattr(result, "kind", None) or "hls") != "mp4":
        return True
    min_bytes = max(512_000, _VOD_MIN_MP4_BYTES)
    try:
        upstream = await step_daddy.proxy_progressive(
            result.manifest_url,
            result.referer,
            result.origin,
            range_header="bytes=0-0",
        )
        try:
            clen = upstream.headers.get("content-length")
            crange = upstream.headers.get("content-range") or ""
            total = None
            if "/" in crange:
                try:
                    total = int(crange.rsplit("/", 1)[-1])
                except Exception:
                    total = None
            if total is None and clen:
                try:
                    total = int(clen)
                except Exception:
                    total = None
            if total is not None and total < min_bytes:
                return False
            # Some hosts omit length on Range; try HEAD-ish GET without range once.
            if total is None:
                await upstream.aclose()
                upstream = await step_daddy.proxy_progressive(
                    result.manifest_url, result.referer, result.origin, range_header=None
                )
                clen = upstream.headers.get("content-length")
                if clen and int(clen) < min_bytes:
                    return False
        finally:
            await upstream.aclose()
    except Exception:
        # If we cannot probe, keep the candidate — client can still fail over.
        return True
    return True


async def _pick_playable_resolve(results: list[VodResolveResult]) -> VodResolveResult | None:
    """Prefer real-length streams; skip tiny MP4 stubs."""
    if not results:
        return None
    hls = [r for r in results if (getattr(r, "kind", "hls") or "hls") == "hls"]
    if hls:
        best = pick_best_result(hls)
        if best:
            return best
    mp4s = [r for r in results if (getattr(r, "kind", "hls") or "hls") == "mp4"]
    remaining = list(mp4s)
    while remaining:
        best = pick_best_result(remaining)
        if not best:
            break
        remaining = [r for r in remaining if r is not best]
        if await _mp4_looks_complete(best):
            return best
    return None


@fastapi_app.get("/vod/resolve")
async def vod_resolve(
    tmdb_id: int,
    type: str = "movie",
    season: int | None = None,
    episode: int | None = None,
    provider: str | None = None,
    lang: str = "en",
    all_sources: bool = False,
):
    """Try direct HLS extraction (local resolvers + optional CinePro OMSS)."""
    if provider and provider.strip().lower() == "auto":
        provider = None
    media_type = (type or "movie").strip().lower()
    if media_type in ("series", "show", "episode"):
        media_type = "tv"
    if media_type == "tv":
        season = int(season or 1)
        episode = int(episode or 1)
    results = await _vod_resolve_all(tmdb_id, media_type, season, episode, provider, lang)
    session_meta = {
        "tmdb_id": tmdb_id,
        "media_type": media_type,
        "season": season,
        "episode": episode,
    }
    if all_sources and results:
        payload = []
        for result in results:
            if (getattr(result, "kind", None) or "hls") == "mp4" and not await _mp4_looks_complete(result):
                continue
            sid = _vod_create_session(result, session_meta)
            payload.append(_resolve_result_payload(result, sid))
        return {"ok": True, "method": "mixed", "count": len(payload), "sources": payload}
    result = await _pick_playable_resolve(results)
    if not result:
        embed_sources = list_sources(tmdb_id, media_type, season, episode, lang)
        fallback = sources_as_dicts(embed_sources)
        pick = None
        if provider:
            pick = next((s for s in fallback if s["id"] == provider.strip().lower()), None)
        if not pick or not (pick.get("embed_url") or "").strip():
            pick = _first_embed_fallback(fallback)
        embed = (pick or {}).get("embed_url") or preferred_embed_url(
            tmdb_id, media_type, season, episode
        )
        return {
            "ok": False,
            "method": "embed",
            "embed_url": embed or None,
            "provider": (pick or {}).get("id") if pick else provider,
            "provider_name": (pick or {}).get("name") if pick else None,
            "omss_enabled": omss_client.enabled(),
            "direct_hls_failed": True,
            "reason": "no_playable_direct_or_stub_filtered",
        }
    sid = _vod_create_session(result, session_meta)
    return _resolve_result_payload(result, sid)


@fastapi_app.get("/vod/hls/{session_id}.m3u8")
async def vod_hls_manifest(session_id: str):
    _vod_purge_sessions()
    session = _vod_sessions.get(session_id)
    if not session:
        return JSONResponse(content={"error": "vod_session_expired"}, status_code=404)
    if (session.get("kind") or "hls") == "mp4":
        return JSONResponse(content={"error": "vod_session_is_file"}, status_code=400)
    try:
        body = await step_daddy.proxy_playlist(
            session["manifest_url"],
            session["referer"],
            session.get("origin"),
        )
    except Exception as exc:
        return JSONResponse(content={"error": str(exc)}, status_code=502)
    return Response(
        content=body,
        media_type="application/vnd.apple.mpegurl",
        headers={"Cache-Control": "no-store"},
    )


def _vod_file_headers(upstream) -> dict:
    headers = {
        "Accept-Ranges": upstream.headers.get("accept-ranges") or "bytes",
        "Cache-Control": "no-store",
    }
    ctype = upstream.headers.get("content-type") or "video/mp4"
    headers["Content-Type"] = ctype
    clen = upstream.headers.get("content-length")
    if clen:
        headers["Content-Length"] = clen
    crange = upstream.headers.get("content-range")
    if crange:
        headers["Content-Range"] = crange
    return headers


@fastapi_app.api_route("/vod/file/{session_id}", methods=["GET", "HEAD"])
async def vod_progressive_file(session_id: str, request: Request):
    """Progressive MP4 (CinePro file sources) proxied with Range support."""
    _vod_purge_sessions()
    session = _vod_sessions.get(session_id)
    if not session:
        return JSONResponse(content={"error": "vod_session_expired"}, status_code=404)
    if (session.get("kind") or "hls") != "mp4":
        return JSONResponse(content={"error": "vod_session_not_file"}, status_code=400)
    try:
        upstream = await step_daddy.proxy_progressive(
            session["manifest_url"],
            session["referer"],
            session.get("origin"),
            range_header=request.headers.get("range"),
        )
    except Exception as exc:
        return JSONResponse(content={"error": str(exc)}, status_code=502)
    if upstream.status_code not in (200, 206):
        await upstream.aclose()
        return JSONResponse(
            content={"error": f"upstream_file_http_{upstream.status_code}"},
            status_code=502,
        )
    headers = _vod_file_headers(upstream)
    media_type = headers.get("Content-Type") or "video/mp4"
    if request.method == "HEAD":
        await upstream.aclose()
        return Response(status_code=upstream.status_code, headers=headers, media_type=media_type)

    async def _iter():
        try:
            async for chunk in upstream.aiter_bytes(65536):
                if chunk:
                    yield chunk
        finally:
            await upstream.aclose()

    return StreamingResponse(
        _iter(),
        status_code=upstream.status_code,
        media_type=media_type,
        headers=headers,
    )


@fastapi_app.get("/vod/download/{session_id}")
async def vod_download_file(session_id: str, request: Request):
    """Authenticated download of a progressive MP4 VOD session."""
    _vod_purge_sessions()
    session = _vod_sessions.get(session_id)
    if not session:
        return JSONResponse(content={"error": "vod_session_expired"}, status_code=404)
    if (session.get("kind") or "hls") != "mp4":
        return JSONResponse(
            content={"error": "download_mp4_only", "hint": "HLS offline packaging coming later"},
            status_code=400,
        )
    try:
        upstream = await step_daddy.proxy_progressive(
            session["manifest_url"],
            session["referer"],
            session.get("origin"),
            range_header=request.headers.get("range"),
        )
    except Exception as exc:
        return JSONResponse(content={"error": str(exc)}, status_code=502)
    if upstream.status_code not in (200, 206):
        await upstream.aclose()
        return JSONResponse(
            content={"error": f"upstream_file_http_{upstream.status_code}"},
            status_code=502,
        )
    headers = _vod_file_headers(upstream)
    title = (session.get("title") or f"tmdb-{session.get('tmdb_id') or session_id}").strip()
    safe = "".join(ch if ch.isalnum() or ch in " ._-" else "_" for ch in title)[:80] or "movie"
    headers["Content-Disposition"] = f'attachment; filename="{safe}.mp4"'
    media_type = headers.get("Content-Type") or "video/mp4"

    async def _iter():
        try:
            async for chunk in upstream.aiter_bytes(65536):
                if chunk:
                    yield chunk
        finally:
            await upstream.aclose()

    return StreamingResponse(
        _iter(),
        status_code=upstream.status_code,
        media_type=media_type,
        headers=headers,
    )


@fastapi_app.get("/vod/catalog/home")
def vod_catalog_home():
    if not vod_catalog.enabled:
        return {"enabled": False, "sections": []}
    return vod_catalog.home()


@fastapi_app.get("/vod/catalog/providers")
def vod_catalog_providers():
    return {"providers": vod_catalog.providers()}


@fastapi_app.get("/vod/catalog/genres")
def vod_catalog_genres(type: str = "movie"):
    return {"genres": vod_catalog.genres(type), "type": type}


@fastapi_app.get("/vod/catalog/sort-options")
def vod_catalog_sort_options():
    return {"options": vod_catalog.sort_options()}


@fastapi_app.get("/vod/catalog/discover")
def vod_catalog_discover(
    type: str = "movie",
    page: int = 1,
    provider_id: int | None = None,
    genre_id: int | None = None,
    sort: str = "popularity.desc",
    year_min: int | None = None,
    year_max: int | None = None,
    rating_min: float | None = None,
    cast_id: int | None = None,
    crew_id: int | None = None,
):
    result = vod_catalog.discover(
        type,
        page,
        provider_id=provider_id,
        genre_id=genre_id,
        sort=sort,
        year_min=year_min,
        year_max=year_max,
        rating_min=rating_min,
        cast_id=cast_id,
        crew_id=crew_id,
    )
    return {
        **result,
        "type": type,
        "provider_id": provider_id,
    }


@fastapi_app.get("/vod/catalog/provider/{provider_id}")
def vod_catalog_by_provider(provider_id: int, type: str = "movie", page: int = 1):
    result = vod_catalog.by_provider(provider_id, type, page)
    return {
        **result,
        "provider_id": provider_id,
        "type": type,
    }


@fastapi_app.get("/vod/catalog/trending")
def vod_catalog_trending(type: str = "movie", page: int = 1):
    return {"items": vod_catalog.trending(type, page), "type": type, "page": page}


@fastapi_app.get("/vod/catalog/popular")
def vod_catalog_popular(type: str = "movie", page: int = 1):
    return {"items": vod_catalog.popular(type, page), "type": type, "page": page}


@fastapi_app.get("/vod/catalog/search")
def vod_catalog_search(q: str = "", type: str = "multi", page: int = 1):
    result = vod_catalog.search(q, type, page)
    return {**result, "query": q}


@fastapi_app.get("/vod/catalog/movie/{tmdb_id}")
def vod_catalog_movie(tmdb_id: int, imdb: str | None = None):
    detail = vod_catalog.movie_detail(tmdb_id, imdb_id=imdb)
    if not detail:
        return JSONResponse(content={"error": "not_found"}, status_code=404)
    return detail


@fastapi_app.get("/vod/catalog/tv/{tmdb_id}")
def vod_catalog_tv(tmdb_id: int, imdb: str | None = None):
    detail = vod_catalog.tv_detail(tmdb_id, imdb_id=imdb)
    if not detail:
        return JSONResponse(content={"error": "not_found"}, status_code=404)
    return detail


@fastapi_app.get("/vod/catalog/tv/{tmdb_id}/season/{season}")
def vod_catalog_tv_season(tmdb_id: int, season: int, imdb: str | None = None):
    return {
        "episodes": vod_catalog.tv_episodes(tmdb_id, season, imdb_id=imdb),
        "season": season,
    }


@fastapi_app.get("/vod/library/status")
def vod_library_status(request: Request):
    return trakt_status(session_id_from_request(request))


@fastapi_app.get("/vod/library/list")
def vod_library_list(kind: str = "all", limit: int = 50):
    return {"items": list_items(kind, limit), "kind": kind}


@fastapi_app.get("/vod/library/continue")
def vod_library_continue(limit: int = 24):
    items = list_continue_watching(limit)
    return {"items": items, "count": len(items)}


@fastapi_app.put("/vod/library/progress")
async def vod_library_progress(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}
    tmdb_id = int(body.get("tmdb_id") or 0)
    media_type = body.get("type") or body.get("media_type") or "movie"
    if tmdb_id <= 0:
        return JSONResponse({"ok": False, "error": "tmdb_id_required"}, status_code=400)
    meta = body.get("meta") if isinstance(body.get("meta"), dict) else {
        k: body[k] for k in ("title", "poster_url", "year") if k in body
    }
    return update_progress(
        media_type,
        tmdb_id,
        progress_seconds=float(body.get("progress_seconds") or 0),
        duration_seconds=float(body.get("duration_seconds") or 0),
        season=body.get("season"),
        episode=body.get("episode"),
        meta=meta,
        scrobble=body.get("scrobble"),
        session_id=session_id_from_request(request),
    )


@fastapi_app.get("/vod/subtitles")
def vod_subtitles(
    tmdb_id: int,
    type: str = "movie",
    season: int | None = None,
    episode: int | None = None,
    lang: str | None = None,
):
    tracks = subtitle_service.search_subtitles(
        tmdb_id, type, season=season, episode=episode, language=lang
    )
    return {"ok": True, "count": len(tracks), "tracks": tracks}


@fastapi_app.get("/vod/subtitles/fetch")
def vod_subtitles_fetch(url: str):
    try:
        text, ctype = subtitle_service.fetch_subtitle_text(url)
    except Exception as exc:
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=502)
    return Response(content=text, media_type=ctype, headers={"Cache-Control": "private, max-age=3600"})


@fastapi_app.get("/vod/library/item/{media_type}/{tmdb_id}")
def vod_library_get_item(media_type: str, tmdb_id: int):
    return get_item(media_type, tmdb_id)


@fastapi_app.put("/vod/library/item/{media_type}/{tmdb_id}")
async def vod_library_put_item(media_type: str, tmdb_id: int, request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}
    meta = body.get("meta") if isinstance(body.get("meta"), dict) else {}
    patch = {k: body[k] for k in ("watched", "favorite", "bookmark", "reminder_at") if k in body}
    return upsert_item(
        media_type,
        tmdb_id,
        patch,
        meta=meta,
        session_id=session_id_from_request(request),
    )


@fastapi_app.post("/vod/library/item/{media_type}/{tmdb_id}/view")
async def vod_library_view_item(media_type: str, tmdb_id: int, request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}
    return touch_recent(media_type, tmdb_id, body)


@fastapi_app.post("/vod/trakt/device/start")
def trakt_device_start_route(request: Request):
    return device_start(session_id_from_request(request))


@fastapi_app.get("/vod/trakt/device/poll")
def trakt_device_poll_route(request: Request):
    return device_poll(session_id_from_request(request))


@fastapi_app.post("/vod/trakt/logout")
def trakt_logout_route(request: Request):
    trakt_logout(session_id_from_request(request))
    return {"ok": True}


async def get_schedule():
    return await step_daddy.schedule()


@fastapi_app.get("/logo/{logo}")
async def logo(logo: str):
    url = urlsafe_base64_decode(logo)
    file = url.split("/")[-1]
    if not os.path.exists("./logo-cache"):
        os.makedirs("./logo-cache")
    if os.path.exists(f"./logo-cache/{file}"):
        return FileResponse(f"./logo-cache/{file}")
    try:
        response = await client.get(url, headers={"user-agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0"})
        if response.status_code == 200:
            with open(f"./logo-cache/{file}", "wb") as f:
                f.write(response.content)
            return FileResponse(f"./logo-cache/{file}")
        else:
            return JSONResponse(content={"error": "Logo not found"}, status_code=status.HTTP_404_NOT_FOUND)
    except httpx.ConnectTimeout:
        return JSONResponse(content={"error": "Request timed out"}, status_code=status.HTTP_504_GATEWAY_TIMEOUT)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)




@fastapi_app.get("/channels/neighbors/{channel_id}")
def channel_neighbors(channel_id: str):
    try:
        channel_id = _normalize_channel_id(channel_id)
        idx = _channel_index(channel_id)
        if idx is None:
            return JSONResponse(content={"error": "channel_not_found"}, status_code=404)
        ids = _channel_order_ids()
        names = {str(ch.id): ch.name for ch in get_channels(include_dead=True)}
        prev_id = ids[idx - 1] if idx > 0 else None
        next_id = ids[idx + 1] if idx < len(ids) - 1 else None
        ch = get_channel(channel_id)
        stream = (ch.stream_url if ch and ch.stream_url else live_stream_path(channel_id))
        return {
            "channel_id": str(channel_id),
            "index": idx,
            "number": idx + 1,
            "total": len(ids),
            "name": ch.name if ch else names.get(str(channel_id), ""),
            "prev": {"id": prev_id, "name": names.get(str(prev_id), "")} if prev_id else None,
            "next": {"id": next_id, "name": names.get(str(next_id), "")} if next_id else None,
            "stream_url": stream,
            "live_meta_url": f"/live/{quote(channel_id, safe='')}/meta",
            "source": ch.source if ch else None,
            "provider": ch.provider if ch else None,
        }
    except Exception as e:
        return JSONResponse(
            content={"error": "neighbors_failed", "detail": str(e)[:200]},
            status_code=500,
        )


@fastapi_app.get("/channels/order")
def channels_order(limit: int = 0):
    """Lightweight ordered id list for client channel switching (no EPG enrichment)."""
    ids = _channel_order_ids()
    if limit > 0:
        ids = ids[:limit]
    return {"total": len(_channel_order_ids()), "ids": ids}

@fastapi_app.get("/channels")
def channels(include_dead: bool = False):
    return [c.model_dump() for c in get_channels(include_dead=include_dead)]


# SHARE_TOKEN_V1
SHARE_SECRET = os.environ.get("SHARE_SECRET", "change-me-now")
SHARE_BASE_URL = os.environ.get("SHARE_BASE_URL", os.environ.get("API_URL", "http://127.0.0.1:3000"))

def _b64u(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")

def _b64u_dec(s: str) -> bytes:
    pad = '=' * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)

def _sign(msg: str) -> str:
    return hmac.new(SHARE_SECRET.encode(), msg.encode(), hashlib.sha256).hexdigest()

def _make_share_token(channel_id: str, ttl_seconds: int = 7200) -> str:
    payload = {"c": str(channel_id), "e": int(time.time()) + int(ttl_seconds)}
    payload_b64 = _b64u(json.dumps(payload, separators=(",", ":")).encode())
    sig = _sign(payload_b64)
    return f"{payload_b64}.{sig}"

def _verify_share_token(token: str):
    try:
        payload_b64, sig = token.split('.', 1)
        if not hmac.compare_digest(_sign(payload_b64), sig):
            return None
        payload = json.loads(_b64u_dec(payload_b64).decode())
        if int(payload.get("e", 0)) < int(time.time()):
            return None
        return payload
    except Exception:
        return None

@fastapi_app.post("/share/create")
def share_create(channel_id: str, ttl_seconds: int = 7200):
    token = _make_share_token(channel_id, ttl_seconds)
    return {
        "token": token,
        "expires_in": ttl_seconds,
        "watch_url": f"{SHARE_BASE_URL}/share/watch/{token}",
        "stream_url": f"{SHARE_BASE_URL}/share/stream/{token}.m3u8",
    }

async def _build_share_stream_response(token: str) -> Response:
    payload = _verify_share_token(token)
    if not payload:
        return JSONResponse(content={"error": "invalid_or_expired_token"}, status_code=403)
    channel_id = str(payload.get("c", ""))
    try:
        content = await step_daddy.stream(channel_id)
        return Response(
            content=content,
            media_type="application/vnd.apple.mpegurl",
            headers=_hls_headers("share.m3u8"),
        )
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


@fastapi_app.get("/share/stream/{token}.m3u8")
async def share_stream(token: str):
    return await _build_share_stream_response(token)


@fastapi_app.head("/share/stream/{token}.m3u8")
async def share_stream_head(token: str):
    return _head_from_response(await _build_share_stream_response(token))


@fastapi_app.options("/share/stream/{token}.m3u8")
async def share_stream_options(token: str):
    return Response(status_code=204, headers=_hls_headers("share.m3u8"))

@fastapi_app.get("/share/watch/{token}")
def share_watch(token: str):
    if not _verify_share_token(token):
        return Response(content="Link expired or invalid", media_type="text/plain", status_code=403)
    stream_url = f"/share/stream/{token}.m3u8"
    html = f"""<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'><title>Watch Channel</title><script src='https://cdn.jsdelivr.net/npm/hls.js@latest'></script><style>body{{background:#000;color:#fff;font-family:Arial;margin:0}}video{{width:100vw;height:100vh;background:#000}}</style></head><body><video id='v' controls autoplay playsinline></video><script>const v=document.getElementById('v');const u='{stream_url}';if(window.Hls&&Hls.isSupported()){{const h=new Hls();h.loadSource(u);h.attachMedia(v);h.on(Hls.Events.MANIFEST_PARSED,()=>v.play().catch(()=>{{}}));}}else{{v.src=u;v.play().catch(()=>{{}});}}</script></body></html>"""
    return Response(content=html, media_type="text/html")






@fastapi_app.get("/vod")
@fastapi_app.get("/vod/{vod_path:path}")
def vod_catalog_shell(vod_path: str = ""):
    """VOD catalog SPA shell (same advanced TV player; client routes under /vod/*)."""
    html = render_advanced_tv_page(None)
    return Response(content=html, media_type="text/html; charset=utf-8")


@fastapi_app.get("/tv")
@fastapi_app.get("/tv/")
def tv_guide_default():
    """Advanced TV guide — picks last channel or 763 client-side."""
    html = render_advanced_tv_page(None)
    return Response(content=html, media_type="text/html; charset=utf-8")


@fastapi_app.get("/tv/{channel_id}")
def tv_guide_channel(channel_id: str):
    """Advanced EPG player with full-screen video background."""
    html = render_advanced_tv_page(channel_id)
    return Response(content=html, media_type="text/html; charset=utf-8")

@fastapi_app.get("/play")
@fastapi_app.get("/play/")
def play_directory():
    """Mobile-friendly channel directory — pick a channel to open /play/{id}."""
    total = len(get_channels(include_dead=False))
    html = render_play_directory_page(total)
    return Response(content=html, media_type="text/html; charset=utf-8")


@fastapi_app.get("/play/{channel_id}")
@fastapi_app.get("/watch/{channel_id}")
def play_channel(channel_id: str):
    """Browser HTML player (hls.js) tuned for mobile cellular + channel +/- switching."""
    ch = get_channel(channel_id)
    raw_title = ch.name if ch else f"Channel {channel_id}"
    title = (
        raw_title.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
    idx = _channel_index(channel_id)
    ch_num = (idx + 1) if idx is not None else 0
    total = len(get_channels(include_dead=False))
    html = render_play_page(channel_id, title, ch_num, total)
    return Response(content=html, media_type="text/html; charset=utf-8")


@fastapi_app.get("/channels/search")
def channels_search(q: str):
    ql = (q or "").lower().strip()
    out = []
    for c in get_channels(include_dead=True):
        if ql in c.name.lower():
            out.append(c.model_dump())
    return out[:50]


@fastapi_app.get("/search")
def search_unified(q: str = "", limit: int = 12):
    """Search channels, TV guide schedule, and VOD titles in one response."""
    return unified_search(epg, vod_catalog, get_channels, q, limit)


@fastapi_app.get("/epg/match/{channel_id}")
def epg_match_debug(channel_id: str):
    ch = get_channel(channel_id)
    if not ch:
        return {"error": "channel_not_found", "channel_id": channel_id}
    m = epg.map_channel_by_id(ch.id, ch.name)
    now_next = epg.get_now_next(m.tvg_id) if m.tvg_id and epg.has_programme_data(m.tvg_id) else {"now": None, "next": None}
    return {
        "channel_id": ch.id,
        "channel_name": ch.name,
        "mapped_tvg_id": m.tvg_id,
        "confidence": m.confidence,
        "method": m.method,
        "epg_has_data": epg.has_programme_data(m.tvg_id),
        "now": now_next.get("now"),
        "next": now_next.get("next"),
    }


@fastapi_app.get("/epg/debug/refresh")
def epg_debug_refresh():
    meta = epg.debug_refresh_meta()
    return {
        "epg_ready": epg._epg_ready,
        "last_refresh": epg._last_refresh,
        "meta": meta,
    }
