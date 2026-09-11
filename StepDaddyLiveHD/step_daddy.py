import asyncio
import base64
import json
import os
import re
import time
try:
    import reflex as rx
except Exception:
    rx = None
from pydantic import BaseModel, Field
from urllib.parse import quote, urlparse, urljoin
import httpx
AsyncSession=httpx.AsyncClient
from typing import List, Optional
from .utils import encrypt, decrypt, urlsafe_base64, decode_bundle
from types import SimpleNamespace
config = SimpleNamespace(
    api_url=(os.environ.get("API_URL", "http://127.0.0.1:3000").strip()),
    proxy_content=(os.environ.get("PROXY_CONTENT", "TRUE").upper()=="TRUE"),
    socks5=(os.environ.get("SOCKS5", "").strip()),
    # Residential SOCKS for VOD extract + same-origin HLS/media proxy (Oracle CF bypass).
    vod_socks5=(os.environ.get("VOD_SOCKS5", "").strip()),
)
import html

# Match vod_resolver UA — VixSrc/CF fingerprint path used at resolve time.
_VOD_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
_VOD_PROXY_HOST_HINTS = (
    "vixsrc.",
    "videasy.",
    "vidzee.",
    "vidsrc.",
    "vsembed.",
    "2embed.",
    "vidlink.",
    "icefy.",
    "cine.su",
    "vaplayer.",
    "brightpath",
    "cloudnestra.",
    "smashy",
    "orchidpixel",
    "neonhorizon",
    "wanderlynest",
)


def _normalize_proxy_url(raw: str) -> Optional[str]:
    raw = (raw or "").strip()
    if not raw:
        return None
    return raw if "://" in raw else f"socks5://{raw}"


class Channel(BaseModel):
    id: str
    name: str
    tags: List[str]
    logo: str | None
    dead: bool = False
    cdn_blocked: bool = False
    cdn_tos_blocked: bool = False
    tvg_id: str | None = None
    epg_has_data: bool = False
    provider: str | None = None
    group_title: str | None = None
    stream_url: str | None = None
    source: str | None = None
    # Multi-facet taxonomy (normalized at catalog merge).
    genre: str | None = None
    genres: List[str] = Field(default_factory=list)
    distributor: str | None = None
    country: str | None = None
    language: str | None = None


class StepDaddy:
    def __init__(self):
        self._seg_cache: dict[str, tuple[float, bytes]] = {}
        self._seg_prefetch_enabled = os.environ.get("VOD_SEGMENT_PREFETCH", "1").strip().lower() not in (
            "0",
            "false",
            "no",
            "off",
        )
        try:
            self._seg_prefetch_n = max(0, min(8, int(os.environ.get("VOD_SEGMENT_PREFETCH_N", "3"))))
        except Exception:
            self._seg_prefetch_n = 3
        self._seg_prefetch_ttl = float(os.environ.get("VOD_SEGMENT_PREFETCH_TTL", "45"))
        self._seg_prefetch_sem = asyncio.Semaphore(2)
        _timeout = httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=5.0)
        _limits = httpx.Limits(max_keepalive_connections=8, max_connections=16, keepalive_expiry=45.0)
        live_proxy = _normalize_proxy_url(config.socks5)
        # Legacy SOCKS5 values were host:port only; keep that join for live.
        if config.socks5 and "://" not in config.socks5:
            live_proxy = "socks5://" + config.socks5.strip()
        if live_proxy:
            self._session = AsyncSession(proxy=live_proxy, timeout=_timeout, limits=_limits)
        else:
            self._session = AsyncSession(timeout=_timeout, limits=_limits)
        # Dedicated VOD egress (VOD_SOCKS5). Resolve already used this; proxy must too.
        vod_proxy = _normalize_proxy_url(config.vod_socks5)
        if vod_proxy and vod_proxy != live_proxy:
            self._vod_session = AsyncSession(proxy=vod_proxy, timeout=_timeout, limits=_limits)
        elif vod_proxy:
            self._vod_session = self._session
        else:
            self._vod_session = None
        # Prefer Android gateway defaults (2026-08 domain-relay / GatewayConfig).
        # Stale Linux default was https://dlhd.pk; primary daddylive.eu may be down —
        # daddylive.li currently serves /api/channels (Android path).
        base_url = os.environ.get("DLHD_BASE_URL", "https://daddylive.li").strip()
        self._base_url = base_url.rstrip("/")
        mirrors_env = os.environ.get(
            "DLHD_BASE_URLS",
            "https://daddylive.li,https://dlstreams.st,https://dlhd.st,https://dlhd.pk,https://daddylive.eu",
        )
        self._mirrors = [m.strip().rstrip("/") for m in mirrors_env.split(",") if m.strip()]
        if self._base_url not in self._mirrors:
            self._mirrors = [self._base_url] + self._mirrors
        # Android GatewayConfig relayHosts (domain-relay.json)
        relays_env = os.environ.get(
            "DLHD_RELAY_HOSTS",
            "https://dlstreams.st,https://dlhd.st,https://dlhd.pk",
        )
        self._relay_hosts = [m.strip().rstrip("/") for m in relays_env.split(",") if m.strip()]
        self.channels = []
        self._stream_cache: dict[str, dict] = {}
        self._stream_cache_ttl = int(os.environ.get("STREAM_CACHE_TTL", "600"))
        self._failed_endpoints: dict[tuple[str, str], float] = {}
        self._failed_endpoint_ttl = int(os.environ.get("FAILED_ENDPOINT_TTL", "300"))
        with open("StepDaddyLiveHD/meta.json", "r") as f:
            self._meta = json.load(f)
        # Gateway-id → display name (wrong_network / upstream mislabels). Optional file.
        self._name_overrides: dict[str, str] = {}
        try:
            nov_path = os.path.join(
                os.path.dirname(__file__), "..", "assets", "channel_name_overrides.json"
            )
            with open(nov_path, "r", encoding="utf-8") as nf:
                raw = json.load(nf)
            if isinstance(raw, dict):
                self._name_overrides = {
                    str(k).strip(): str(v).strip()
                    for k, v in raw.items()
                    if str(k).strip() and str(v).strip()
                }
        except Exception:
            self._name_overrides = {}

    def invalidate_stream_cache(self, channel_id: str | None = None):
        if channel_id is None:
            self._stream_cache.clear()
        else:
            self._stream_cache.pop(str(channel_id), None)

    def _endpoint_key(self, base: str, path: str) -> tuple[str, str]:
        return (base.rstrip("/"), path)

    def _is_endpoint_failed(self, base: str, path: str) -> bool:
        key = self._endpoint_key(base, path)
        ts = self._failed_endpoints.get(key)
        if not ts:
            return False
        if time.time() - ts >= self._failed_endpoint_ttl:
            del self._failed_endpoints[key]
            return False
        return True

    def _mark_endpoint_failed(self, base: str, path: str) -> None:
        self._failed_endpoints[self._endpoint_key(base, path)] = time.time()

    def _resolve_bases(self) -> list[str]:
        resolve_bases: list[str] = []
        for b in list(self._relay_hosts) + [self._base_url] + list(self._mirrors):
            if b and b not in resolve_bases:
                resolve_bases.append(b)
        return resolve_bases

    async def _resolve_stream_source(self, channel_id: str) -> tuple[str, str, str]:
        """Resolve upstream media m3u8 URL and referer. Returns (m3u8_url, referer_host, referer)."""
        key = "CHANNEL_KEY"
        resolve_bases = self._resolve_bases()

        for base in resolve_bases:
            for path in (
                f"/watch/stream-{channel_id}.php",
                f"/cast/stream-{channel_id}.php",
                f"/stream/stream-{channel_id}.php",
            ):
                if self._is_endpoint_failed(base, path):
                    continue
                watch_url = f"{base}{path}"
                try:
                    watch_response = await self._session.get(
                        watch_url, headers=self._headers(base), timeout=15.0, follow_redirects=True
                    )
                except Exception:
                    self._mark_endpoint_failed(base, path)
                    continue
                if watch_response.status_code != 200:
                    self._mark_endpoint_failed(base, path)
                    continue
                watch_iframe = re.search(r'iframe\s+src="([^"]+)"', watch_response.text, re.I)
                if not watch_iframe:
                    continue
                source_page_url = watch_iframe.group(1)
                if source_page_url.startswith("//"):
                    source_page_url = "https:" + source_page_url
                try:
                    source_page_response = await self._session.get(
                        source_page_url, headers=self._headers(watch_url), timeout=15.0, follow_redirects=True
                    )
                except Exception:
                    continue
                source_b64 = re.search(r"source\s*:\s*window\.atob\('([^']+)'\)", source_page_response.text)
                if not source_b64:
                    source_b64 = re.search(r"atob\('([^']+)'\)", source_page_response.text)
                if source_b64:
                    try:
                        m3u8_url = base64.b64decode(source_b64.group(1)).decode()
                    except Exception:
                        continue
                    if ".m3u8" not in m3u8_url:
                        continue
                    referer_host = urlparse(source_page_url).netloc
                    return m3u8_url, referer_host, source_page_url

        response = None
        url = None
        matches = []
        legacy_path = f"/stream/stream-{channel_id}.php"
        for base in resolve_bases:
            if self._is_endpoint_failed(base, legacy_path):
                continue
            url = f"{base}{legacy_path}"
            try:
                response = await self._session.get(
                    url, headers=self._headers(base), timeout=15.0, follow_redirects=True
                )
            except Exception:
                self._mark_endpoint_failed(base, legacy_path)
                continue
            if response.status_code != 200:
                self._mark_endpoint_failed(base, legacy_path)
                continue
            matches = re.compile('iframe src="(.*)" width').findall(response.text)
            if matches:
                break
        if not matches:
            raise ValueError("Failed to find source URL for channel")

        source_url = matches[0]
        source_response = await self._session.get(source_url, headers=self._headers(url))
        channel_key = re.compile(rf"const\s+{re.escape(key)}\s*=\s*\"(.*?)\";").findall(source_response.text)[-1]

        data = decode_bundle(source_response.text)
        auth_ts = data.get("b_ts", "")
        auth_sig = data.get("b_sig", "")
        auth_rnd = data.get("b_rnd", "")
        auth_url = data.get("b_host", "")
        auth_request_url = f"{auth_url}auth.php?channel_id={channel_key}&ts={auth_ts}&rnd={auth_rnd}&sig={auth_sig}"
        auth_response = await self._session.get(auth_request_url, headers=self._headers(source_url))
        if auth_response.status_code != 200:
            raise ValueError("Failed to get auth response")
        key_url = urlparse(source_url)
        key_url = f"{key_url.scheme}://{key_url.netloc}/server_lookup.php?channel_id={channel_key}"
        key_response = await self._session.get(key_url, headers=self._headers(source_url))
        server_key = key_response.json().get("server_key")
        if not server_key:
            raise ValueError("No server key found in response")
        if server_key == "top1/cdn":
            m3u8_url = f"https://top1.newkso.ru/top1/cdn/{channel_key}/mono.m3u8"
        else:
            m3u8_url = f"https://{server_key}new.newkso.ru/{server_key}/{channel_key}/mono.m3u8"
        referer_host = urlparse(source_url).netloc
        return m3u8_url, referer_host, quote(str(source_url))

    async def _ensure_stream_cache(self, channel_id: str, force: bool = False) -> dict:
        cid = str(channel_id)
        now = time.time()
        cached = self._stream_cache.get(cid)
        if not force and cached and (now - cached["ts"]) < self._stream_cache_ttl:
            return cached
        m3u8_url, referer_host, referer = await self._resolve_stream_source(cid)
        cached = {"m3u8_url": m3u8_url, "referer_host": referer_host, "referer": referer, "ts": now}
        self._stream_cache[cid] = cached
        return cached

    @staticmethod
    def _sanitize_live_playlist(text: str) -> str:
        if "#EXT-X-ENDLIST" in text and "#EXT-X-MEDIA-SEQUENCE" in text:
            return "\n".join(line for line in text.splitlines() if line.strip() != "#EXT-X-ENDLIST")
        return text

    async def _fetch_upstream_playlist(self, cached: dict, retry_resolve: bool = False) -> str:
        channel_hint = None
        for cid, entry in self._stream_cache.items():
            if entry is cached:
                channel_hint = cid
                break

        m3u8_url = cached["m3u8_url"]
        referer = cached["referer"]
        referer_host = cached["referer_host"]
        m3u8_response = await self._session.get(
            m3u8_url, headers=self._headers(referer), timeout=20.0, follow_redirects=True
        )
        if m3u8_response.status_code != 200:
            if retry_resolve and channel_hint:
                self.invalidate_stream_cache(channel_hint)
                fresh = await self._ensure_stream_cache(channel_hint, force=True)
                return await self._fetch_upstream_playlist(fresh, retry_resolve=False)
            raise ValueError(f"upstream_playlist_http_{m3u8_response.status_code}")
        text = self._sanitize_live_playlist(m3u8_response.text)
        return self.rewrite_playlist(text, m3u8_url, referer_host)

    async def _fetch_media_playlist(
        self,
        cached: dict,
        retry_resolve: bool = False,
        *,
        proxy_content: bool | None = None,
    ) -> str:
        channel_hint = None
        for cid, entry in self._stream_cache.items():
            if entry is cached:
                channel_hint = cid
                break

        m3u8_url = cached["m3u8_url"]
        referer = cached["referer"]
        referer_host = cached["referer_host"]
        m3u8_response = await self._session.get(
            m3u8_url, headers=self._headers(referer), timeout=20.0, follow_redirects=True
        )
        if m3u8_response.status_code != 200:
            if retry_resolve and channel_hint:
                self.invalidate_stream_cache(channel_hint)
                fresh = await self._ensure_stream_cache(channel_hint, force=True)
                return await self._fetch_media_playlist(
                    fresh, retry_resolve=False, proxy_content=proxy_content
                )
            raise ValueError(f"upstream_playlist_http_{m3u8_response.status_code}")

        text = self._sanitize_live_playlist(m3u8_response.text)
        if "#EXT-X-STREAM-INF" in text:
            lines = text.splitlines()
            for i, line in enumerate(lines):
                if line.startswith("#EXT-X-STREAM-INF") and i + 1 < len(lines):
                    variant = lines[i + 1].strip()
                    if variant and not variant.startswith("#"):
                        variant_url = urljoin(m3u8_url, variant)
                        variant_response = await self._session.get(
                            variant_url, headers=self._headers(referer), timeout=20.0, follow_redirects=True
                        )
                        if variant_response.status_code != 200:
                            raise ValueError(f"upstream_variant_http_{variant_response.status_code}")
                        text = self._sanitize_live_playlist(variant_response.text)
                        m3u8_url = str(variant_response.url) if variant_response.url else variant_url
                        break

        return self.rewrite_playlist(text, m3u8_url, referer_host, proxy_content=proxy_content)

    def _headers(self, referer: str = None, origin: str = None):
        if referer is None:
            referer = self._base_url
        headers = {
            "Referer": referer,
            "user-agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0",
        }
        if origin:
            headers["Origin"] = origin
        return headers

    def _vod_headers(self, referer: str, origin: str | None = None) -> dict:
        """Headers matching vod_resolver extract path (Chrome UA + Accept)."""
        if not origin:
            parsed = urlparse(referer)
            if parsed.scheme and parsed.netloc:
                origin = f"{parsed.scheme}://{parsed.netloc}"
        headers = {
            "User-Agent": _VOD_UA,
            "Referer": referer,
            "Accept": "*/*",
        }
        if origin:
            headers["Origin"] = origin
        return headers

    @staticmethod
    def _looks_like_vod_host(host_or_url: str | None) -> bool:
        blob = (host_or_url or "").lower()
        return any(h in blob for h in _VOD_PROXY_HOST_HINTS)

    def _client_for_vod(self, referer_host: str | None = None, url: str = "") -> httpx.AsyncClient:
        """Prefer VOD_SOCKS5 session for VOD CDN hosts; else live session."""
        if self._vod_session is None:
            return self._session
        if self._looks_like_vod_host(referer_host) or self._looks_like_vod_host(url):
            return self._vod_session
        return self._session

    def _vod_client(self) -> httpx.AsyncClient:
        """Client for /vod/hls and /vod/file — always prefer residential SOCKS when set."""
        return self._vod_session or self._session

    async def load_channels(self):
        channels = []
        last_err = None
        try:
            for base in self._mirrors:
                try:
                    # Android path first
                    response = await self._session.get(f"{base}/api/channels", headers=self._headers(base), timeout=20.0)
                    if response.status_code == 200:
                        try:
                            payload = response.json()
                        except Exception:
                            payload = None
                        rows = payload if isinstance(payload, list) else (payload or {}).get("channels") if isinstance(payload, dict) else None
                        if isinstance(rows, list) and rows:
                            for row in rows:
                                if not isinstance(row, dict):
                                    continue
                                channel_name = str(row.get("channel_name") or row.get("name") or "").strip().replace("#", "")
                                embed = str(row.get("url") or row.get("embed_url") or "")
                                channel_id = str(row.get("channel_id") or row.get("id") or "")
                                if not channel_id and "id=" in embed:
                                    m = re.search(r"[?&]id=([^&]+)", embed)
                                    channel_id = m.group(1) if m else ""
                                channel_id = channel_id.replace("stream-", "") if channel_id.startswith("stream-") else channel_id
                                if not channel_id or not channel_name:
                                    continue
                                channel_id = str(channel_id)
                                if channel_id in self._name_overrides:
                                    channel_name = self._name_overrides[channel_id]
                                meta = self._meta.get("18+" if channel_name.startswith("18+") else channel_name, {})
                                logo = meta.get("logo", "")
                                if logo:
                                    logo = f"/logo/{urlsafe_base64(logo)}"
                                channels.append(Channel(id=channel_id, name=channel_name, tags=meta.get("tags", []), logo=logo))
                            if channels:
                                self._base_url = base
                                break
                        # Some hosts return HTML for /api/channels — fall through
                    # Legacy HTML catalog (Linux / older mirrors)
                    response = await self._session.get(f"{base}/24-7-channels.php", headers=self._headers(base), timeout=20.0)
                    if response.status_code != 200:
                        continue
                    matches = re.findall(
                        r'<a class="card"\s+href="/watch\.php\?id=(\d+)"[^>]*>\s*<div class="card__title">(.*?)</div>',
                        response.text,
                        re.DOTALL
                    )
                    for channel_id, channel_name in matches:
                        channel_id = str(channel_id)
                        channel_name = html.unescape(channel_name.strip()).replace("#", "")
                        if channel_id in self._name_overrides:
                            channel_name = self._name_overrides[channel_id]
                        meta = self._meta.get("18+" if channel_name.startswith("18+") else channel_name, {})
                        logo = meta.get("logo", "")
                        if logo:
                            logo = f"/logo/{urlsafe_base64(logo)}"
                        channels.append(Channel(id=channel_id, name=channel_name, tags=meta.get("tags", []), logo=logo))
                    if channels:
                        self._base_url = base
                        break
                except Exception as e:
                    last_err = e
                    channels = []
                    continue
            if not channels and last_err:
                raise last_err
        finally:
            # Preserve upstream catalog order (playlist / API sequence) for channel +/- navigation.
            self.channels = channels

    def rewrite_playlist(
        self,
        m3u8_text: str,
        m3u8_url: str,
        referer_host: str,
        *,
        proxy_content: bool | None = None,
    ) -> str:
        """Rewrite key/media URLs through this API; embed referer host for CDN auth.

        proxy_content=False keeps absolute upstream media URLs (browser/P2P direct).
        Keys still go through /key when proxying is on — AES needs the gateway Referer.
        """
        do_proxy = config.proxy_content if proxy_content is None else bool(proxy_content)
        # Prefer same-origin relative /content and /key so stale API_URL (old VPS IP)
        # cannot poison playlists. Absolute API_URL only when explicitly forced.
        force_abs = (os.environ.get("PLAYLIST_ABSOLUTE_URLS") or "").strip().lower() in (
            "1",
            "true",
            "yes",
        )
        api_prefix = (config.api_url or "").rstrip("/") if force_abs else ""
        lines_out = []
        non_comment_count = 0

        def _proxy_media(absolute_url: str) -> str:
            return (
                f"{api_prefix}/content/{encrypt(absolute_url)}"
                f"/{encrypt(referer_host)}"
            )

        def _rewrite_tag_uris(line: str) -> str:
            """Rewrite URI="..." on MEDIA / MAP / I-FRAME / SESSION-KEY style tags."""
            def _sub(m: re.Match) -> str:
                original = m.group(1)
                absolute = urljoin(m3u8_url, original)
                return f'URI="{_proxy_media(absolute)}"'

            return re.sub(r'URI="([^"]*)"', _sub, line)

        for line in m3u8_text.split("\n"):
            line = line.strip()
            if line.startswith("#EXT-X-KEY:"):
                uri_match = re.search(r'URI="(.*?)"', line)
                if uri_match:
                    original_url = uri_match.group(1)
                    absolute_key_url = urljoin(m3u8_url, original_url)
                    if do_proxy:
                        proxied = (
                            f"{api_prefix}/key/{encrypt(absolute_key_url)}/{encrypt(referer_host)}"
                        )
                        line = line.replace(original_url, proxied)
                    else:
                        line = line.replace(original_url, absolute_key_url)
            elif line.startswith("#") and 'URI="' in line and do_proxy:
                # EXT-X-MEDIA / EXT-X-MAP / EXT-X-I-FRAME-STREAM-INF audio+subs+init
                line = _rewrite_tag_uris(line)
            elif line and not line.startswith("#"):
                non_comment_count += 1
                absolute_media_url = urljoin(m3u8_url, line)
                if do_proxy:
                    line = _proxy_media(absolute_media_url)
                else:
                    line = absolute_media_url
            lines_out.append(line)

        has_extm3u = any(l.startswith("#EXTM3U") for l in lines_out)
        if not has_extm3u and non_comment_count == 1:
            media_line = next((l for l in lines_out if l and not l.startswith("#")), "")
            return f"#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=8000000\n{media_line}\n"

        return "\n".join(lines_out).strip() + "\n"

    def _purge_seg_cache(self) -> None:
        now = time.time()
        dead = [u for u, (ts, _) in self._seg_cache.items() if now - ts > self._seg_prefetch_ttl]
        for u in dead:
            self._seg_cache.pop(u, None)

    def _media_segment_urls(self, playlist_text: str, playlist_url: str) -> list[str]:
        """Absolute upstream segment URLs from a media playlist (skip nested manifests)."""
        urls: list[str] = []
        for line in playlist_text.split("\n"):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            abs_url = urljoin(playlist_url, line)
            if ".m3u8" in abs_url.split("?", 1)[0].lower():
                continue
            urls.append(abs_url)
            if len(urls) >= self._seg_prefetch_n:
                break
        return urls

    def _schedule_segment_prefetch(
        self, playlist_text: str, playlist_url: str, headers: dict, client: httpx.AsyncClient | None = None
    ) -> None:
        if not self._seg_prefetch_enabled or self._seg_prefetch_n <= 0:
            return
        urls = self._media_segment_urls(playlist_text, playlist_url)
        if not urls:
            return
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        loop.create_task(self._prefetch_segments(urls, headers, client=client))

    async def _prefetch_segments(
        self, urls: list[str], headers: dict, client: httpx.AsyncClient | None = None
    ) -> None:
        self._purge_seg_cache()
        for url in urls:
            if url in self._seg_cache:
                continue
            async with self._seg_prefetch_sem:
                try:
                    resp = await self._upstream_get(
                        url, headers, stream=False, timeout=20.0, client=client
                    )
                    if not self._upstream_ok(resp.status_code):
                        await resp.aclose()
                        continue
                    body = await resp.aread()
                    await resp.aclose()
                    if body:
                        self._seg_cache[url] = (time.time(), body)
                except Exception:
                    continue

    def _cached_segment(self, url: str) -> bytes | None:
        self._purge_seg_cache()
        hit = self._seg_cache.get(url)
        if not hit:
            return None
        ts, body = hit
        if time.time() - ts > self._seg_prefetch_ttl:
            self._seg_cache.pop(url, None)
            return None
        return body

    async def proxy_playlist(
        self, manifest_url: str, referer: str, origin: str | None = None
    ) -> bytes:
        """Fetch an upstream HLS manifest and rewrite segment URLs through this gateway."""
        parsed = urlparse(referer)
        if not origin:
            origin = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else referer
        headers = self._vod_headers(referer, origin)
        client = self._vod_client()
        response = await self._upstream_get(
            manifest_url, headers, stream=False, timeout=60.0, client=client
        )
        if not self._upstream_ok(response.status_code):
            await response.aclose()
            raise ValueError(f"upstream_manifest_http_{response.status_code}")
        body = await response.aread()
        await response.aclose()
        text = body.decode("utf-8", errors="replace")
        stripped = text.lstrip("\ufeff \t\r\n")
        if not stripped.startswith("#EXTM3U"):
            raise ValueError("upstream_not_hls")
        referer_host = parsed.netloc or referer
        self._schedule_segment_prefetch(text, manifest_url, headers, client=client)
        return self.rewrite_playlist(text, manifest_url, referer_host).encode("utf-8")

    async def proxy_progressive(self, url: str, referer: str, origin: str | None = None, range_header: str | None = None):
        """Stream a progressive MP4 (or similar) through the gateway, forwarding Range."""
        parsed = urlparse(referer)
        if not origin:
            origin = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else referer
        headers = self._vod_headers(referer, origin)
        headers["Accept"] = "*/*"
        if range_header:
            headers["Range"] = range_header
        client = self._vod_client()
        req = client.build_request("GET", url, headers=headers, timeout=120.0)
        return await client.send(req, stream=True, follow_redirects=True)

    async def stream(self, channel_id: str):
        cached = await self._ensure_stream_cache(channel_id)
        try:
            return await self._fetch_upstream_playlist(cached, retry_resolve=True)
        except Exception:
            self.invalidate_stream_cache(channel_id)
            cached = await self._ensure_stream_cache(channel_id, force=True)
            return await self._fetch_upstream_playlist(cached, retry_resolve=False)

    async def media_stream(self, channel_id: str, *, direct_segments: bool = False) -> str:
        """Return the live media playlist directly (stable URL for browser players).

        direct_segments=True leaves absolute CDN URLs (for backup Clappr/P2P when
        Oracle /content egress is CF-blocked). Default still rewrites through /content.
        """
        cached = await self._ensure_stream_cache(channel_id)
        try:
            return await self._fetch_media_playlist(
                cached, retry_resolve=True, proxy_content=(False if direct_segments else None)
            )
        except Exception:
            self.invalidate_stream_cache(channel_id)
            cached = await self._ensure_stream_cache(channel_id, force=True)
            return await self._fetch_media_playlist(
                cached, retry_resolve=False, proxy_content=(False if direct_segments else None)
            )

    async def key(self, url: str, host: str):
        url = decrypt(url)
        host = decrypt(host)
        referer = host if "://" in host else f"https://{host}/"
        if "://" in host:
            origin = f"{urlparse(host).scheme}://{urlparse(host).netloc}"
        else:
            origin = f"https://{host.split('/')[0]}"
        client = self._client_for_vod(host, url)
        headers = (
            self._vod_headers(referer, origin)
            if client is self._vod_session
            else self._headers(referer, origin)
        )
        response = await client.get(url, headers=headers, timeout=60)
        if response.status_code != 200:
            raise Exception(f"Failed to get key")
        return response.content

    def _content_request_headers(self, path: str, host: str | None = None):
        url = decrypt(path)
        referer_host = decrypt(host) if host else None
        if referer_host:
            if "://" in referer_host:
                referer = referer_host
                parsed = urlparse(referer)
                origin = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else referer
            else:
                bare = referer_host.split("/")[0]
                referer = f"https://{bare}/"
                origin = f"https://{bare}"
            if self._vod_session is not None and (
                self._looks_like_vod_host(referer_host) or self._looks_like_vod_host(url)
            ):
                headers = self._vod_headers(referer, origin)
            else:
                headers = self._headers(referer, origin)
        else:
            headers = self._headers()
        return url, referer_host, headers

    @staticmethod
    def _upstream_ok(status_code: int) -> bool:
        return status_code in (200, 206)

    async def _upstream_get(
        self,
        url: str,
        headers: dict,
        stream: bool,
        timeout: float = 60.0,
        client: httpx.AsyncClient | None = None,
    ):
        session = client or self._session
        req = session.build_request("GET", url, headers=headers, timeout=timeout)
        response = await session.send(req, stream=stream, follow_redirects=True)
        status = response.status_code
        # Hard CDN/auth blocks will not recover on a 250ms retry — don't double-hold a worker.
        if status in (403, 429, 401):
            return response
        if not self._upstream_ok(status) and stream:
            await response.aclose()
            await asyncio.sleep(0.25)
            req = session.build_request("GET", url, headers=headers, timeout=timeout)
            response = await session.send(req, stream=stream, follow_redirects=True)
        return response

    async def fetch_content(self, path: str, host: str | None = None):
        """Fetch proxied CDN content. Returns (kind, media_type, status, payload).

        kind is "playlist" (bytes body) or "stream" (async byte iterator).
        """
        url, referer_host, headers = self._content_request_headers(path, host)
        client = self._client_for_vod(referer_host, url)
        is_m3u8_url = ".m3u8" in url.split("?", 1)[0].lower()
        if not is_m3u8_url:
            cached = self._cached_segment(url)
            if cached is not None:
                ctype = "video/mp2t" if cached[:1] == bytes([0x47]) else "application/octet-stream"

                async def _from_cache():
                    yield cached

                return "stream", ctype, 200, _from_cache()
        response = await self._upstream_get(
            url, headers, stream=not is_m3u8_url, timeout=60.0, client=client
        )
        status_code = response.status_code
        if not self._upstream_ok(status_code):
            err_snip = b""
            try:
                # Keep a small body snip so callers can detect CF ToS zone bans vs IP blocks.
                err_snip = await response.aread()
                if len(err_snip) > 4096:
                    err_snip = err_snip[:4096]
            except Exception:
                err_snip = b""
            await response.aclose()
            # Hard CDN/auth blocks: no second fetch (matches _upstream_get thrash guard).
            if is_m3u8_url and status_code not in (403, 429, 401):
                response = await self._upstream_get(
                    url, headers, stream=False, timeout=60.0, client=client
                )
                status_code = response.status_code
                if not self._upstream_ok(status_code):
                    try:
                        err_snip = await response.aread()
                        if len(err_snip) > 4096:
                            err_snip = err_snip[:4096]
                    except Exception:
                        pass
                    await response.aclose()
                    return "playlist", "application/octet-stream", status_code, err_snip
            else:
                return "playlist", "application/octet-stream", status_code, err_snip

        if is_m3u8_url:
            body = await response.aread()
            await response.aclose()
            text = body.decode("utf-8", errors="replace")
            text = self._sanitize_live_playlist(text)
            rh = referer_host.split("://", 1)[-1].split("/")[0] if referer_host else urlparse(url).netloc
            self._schedule_segment_prefetch(text, url, headers, client=client)
            text = self.rewrite_playlist(text, url, rh)
            return "playlist", "application/vnd.apple.mpegurl", 200, text.encode("utf-8")

        # httpx allows only one aiter_bytes() pass per response — reuse the same iterator.
        byte_iter = response.aiter_bytes(chunk_size=65536)
        first = b""
        async for chunk in byte_iter:
            if chunk:
                first = chunk
                break
        if not first:
            await response.aclose()
            async def _empty():
                return
                yield  # pragma: no cover
            return "stream", "application/octet-stream", 200, _empty()

        if first.lstrip()[:7] == b"#EXTM3U":
            parts = [first]
            async for chunk in byte_iter:
                if chunk:
                    parts.append(chunk)
            await response.aclose()
            body = b"".join(parts)
            text = body.decode("utf-8", errors="replace")
            rh = referer_host.split("://", 1)[-1].split("/")[0] if referer_host else urlparse(url).netloc
            text = self.rewrite_playlist(text, url, rh)
            return "playlist", "application/vnd.apple.mpegurl", 200, text.encode("utf-8")

        ctype = response.headers.get("content-type") or "application/octet-stream"
        if first[:1] == bytes([0x47]):
            ctype = "video/mp2t"

        async def _iter_chunks():
            try:
                yield first
                async for chunk in byte_iter:
                    if chunk:
                        yield chunk
            finally:
                await response.aclose()

        return "stream", ctype, 200, _iter_chunks()

    @staticmethod
    def content_url(path: str):
        return decrypt(path)

    def playlist(self, channels: List[Channel] | None = None):
        data = "#EXTM3U\n"
        items = channels if channels is not None else self.channels
        api = config.api_url.rstrip("/")
        for channel in items:
            attrs = []
            if channel.tvg_id:
                attrs.append(f'tvg-id="{channel.tvg_id}"')
            if channel.logo:
                attrs.append(f'tvg-logo="{channel.logo}"')
            if getattr(channel, "group_title", None):
                attrs.append(f'group-title="{channel.group_title}"')
            attrs_str = (" " + " ".join(attrs)) if attrs else ""
            path = (getattr(channel, "stream_url", None) or f"/live/{channel.id}.m3u8").strip()
            if path.startswith("http://") or path.startswith("https://"):
                stream = path
            else:
                stream = f"{api}{path if path.startswith('/') else '/' + path}"
            data += f"#EXTINF:-1{attrs_str},{channel.name}\n{stream}\n"
        return data

    async def schedule(self):
        response = await self._session.get(f"{self._base_url}/schedule/schedule-generated.php", headers=self._headers())
        content_type = response.headers.get("content-type", "")
        if "application/json" not in content_type:
            return []
        try:
            return response.json()
        except Exception:
            return []
