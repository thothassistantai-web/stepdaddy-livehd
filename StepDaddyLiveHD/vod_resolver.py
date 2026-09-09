"""Resolve VOD titles to direct HLS manifests (CinePro/Streamflix-style extractors).

Tries provider-specific extractors server-side in parallel. When blocked (e.g.
Cloudflare on Oracle VPS), callers should fall back to embed playback.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import urljoin

import httpx

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
DEFAULT_ORDER = [
    p.strip()
    for p in os.environ.get(
        "VOD_RESOLVE_ORDER",
        # Cleanest / least adware first. Videasy/VidZee use CinePro decrypt paths.
        "videasy,vidzee,vixsrc,icefy,cinesu,vidapi,vidlink,vidsrc",
    ).split(",")
    if p.strip()
]
HLS_PROVIDER_IDS = frozenset(
    {"vixsrc", "vidsrc", "2embed", "vidlink", "icefy", "cinesu", "vidapi", "videasy", "vidzee"}
)
# Higher = preferred for Auto. Risky scrapers stay low even if they report 1080p.
PROVIDER_CLEAN_RANK = {
    "videasy": 105,
    "vidzee": 102,
    "vixsrc": 100,
    "icefy": 95,
    "cinesu": 95,
    "vidapi": 90,
    "vidlink": 70,
    "vidsrc": 55,
    "2embed": 15,
}


@dataclass(frozen=True)
class VodResolveResult:
    provider: str
    manifest_url: str
    referer: str
    origin: str | None = None
    quality: str | None = None
    provider_name: str | None = None
    source: str = "local"
    kind: str = "hls"  # hls | mp4


def _norm_type(media_type: str) -> str:
    t = (media_type or "movie").strip().lower()
    if t in ("series", "tv", "show", "episode"):
        return "tv"
    return "movie"


def _quality_rank(quality: str | None) -> int:
    if not quality:
        return 0
    m = re.search(r"(\d{3,4})", str(quality))
    return int(m.group(1)) if m else (900 if str(quality).lower() in ("auto", "best") else 0)


def _provider_clean_rank(provider: str | None) -> int:
    return PROVIDER_CLEAN_RANK.get((provider or "").strip().lower(), 40)


def pick_best_result(results: list[VodResolveResult]) -> VodResolveResult | None:
    if not results:
        return None
    return max(
        results,
        key=lambda r: (
            1 if (r.kind or "hls") == "hls" else 0,
            _provider_clean_rank(r.provider),
            _quality_rank(r.quality),
            1 if r.source == "omss" else 0,
        ),
    )


class VodResolver:
    def __init__(self, session: httpx.AsyncClient | None = None):
        self._session = session
        self._owns_session = session is None
        self._timeout = float(os.environ.get("VOD_RESOLVE_TIMEOUT", "20"))

    async def _client(self) -> httpx.AsyncClient:
        if self._session is None:
            socks5 = os.environ.get("VOD_SOCKS5", os.environ.get("SOCKS5", "")).strip()
            kwargs: dict[str, Any] = {
                "timeout": httpx.Timeout(self._timeout),
                "follow_redirects": True,
                "verify": False,
            }
            if socks5:
                kwargs["proxy"] = socks5 if "://" in socks5 else f"socks5://{socks5}"
            self._session = httpx.AsyncClient(**kwargs)
        return self._session

    async def aclose(self):
        if self._owns_session and self._session is not None:
            await self._session.aclose()
            self._session = None

    async def _get_text(self, url: str, referer: str | None = None, origin: str | None = None) -> str:
        client = await self._client()
        headers = {"User-Agent": UA, "Referer": referer or url, "Accept": "*/*"}
        if origin:
            headers["Origin"] = origin
        r = await client.get(url, headers=headers)
        r.raise_for_status()
        return r.text

    async def _get_json(self, url: str, referer: str | None = None, origin: str | None = None) -> dict:
        text = await self._get_text(url, referer, origin)
        return json.loads(text)

    @staticmethod
    def _find_m3u8(text: str) -> str | None:
        matches = re.findall(r'https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*', text)
        return matches[0] if matches else None

    @staticmethod
    def _find_file_urls(text: str) -> list[str]:
        out = re.findall(r'file:\s*"([^"]+)"', text)
        out.extend(re.findall(r"file:\s*'([^']+)'", text))
        return out

    @staticmethod
    def _parse_master_quality(content: str) -> str | None:
        best = 0
        for m in re.finditer(r"#EXT-X-STREAM-INF:[^\n]*RESOLUTION=\d+x(\d+)", content):
            try:
                best = max(best, int(m.group(1)))
            except ValueError:
                continue
        return f"{best}p" if best else None

    @staticmethod
    def _token_expired(expires: str) -> bool:
        try:
            return int(expires) * 1000 - 60_000 < int(time.time() * 1000)
        except (TypeError, ValueError):
            return False

    async def _resolve_vixsrc(
        self, tmdb_id: int, media_type: str, season: int | None, episode: int | None, lang: str
    ) -> VodResolveResult | None:
        base = "https://vixsrc.to"
        kind = _norm_type(media_type)
        if kind == "movie":
            api_url = f"{base}/api/movie/{tmdb_id}?lang={lang}"
        else:
            s = max(1, int(season or 1))
            e = max(1, int(episode or 1))
            api_url = f"{base}/api/tv/{tmdb_id}/{s}/{e}?lang={lang}"
        data = await self._get_json(api_url, base, base)
        src = (data.get("src") or "").lstrip("/")
        if not src:
            return None
        referer = f"{base}/{src}" if not src.startswith("http") else src
        if not src.startswith("http"):
            page_url = f"{base}/{src}"
        else:
            page_url = src
        html = await self._get_text(page_url, base, base)
        video_id = re.search(r"id:\s*'([^']+)'", html)
        token = re.search(r"['\"]token['\"]\s*:\s*['\"]([^'\"]+)", html)
        expires = re.search(r"['\"]expires['\"]\s*:\s*['\"]([^'\"]+)", html)
        playlist_path = re.search(r"url\s*:\s*['\"]([^'\"]+)['\"]", html)
        if token and expires and self._token_expired(expires.group(1)):
            return None
        if playlist_path and token and expires:
            playlist = playlist_path.group(1)
            if playlist.startswith("/"):
                manifest = f"{base}{playlist}"
            elif playlist.startswith("http"):
                manifest = playlist
            else:
                manifest = f"{base}/{playlist.lstrip('/')}"
            sep = "&" if "?" in manifest else "?"
            manifest = (
                f"{manifest}{sep}token={token.group(1)}&expires={expires.group(1)}&lang={lang}&h=1"
            )
        elif video_id and token and expires:
            manifest = (
                f"{base}/playlist/{video_id.group(1)}?token={token.group(1)}"
                f"&expires={expires.group(1)}&lang={lang}&h=1"
            )
        else:
            return None
        head = await self._get_text(manifest, page_url, base)
        if not head.lstrip().startswith("#EXTM3U"):
            return None
        quality = self._parse_master_quality(head) or "Auto"
        return VodResolveResult(
            provider="vixsrc",
            provider_name="VixSrc",
            manifest_url=manifest,
            referer=page_url,
            origin=base,
            quality=quality,
        )

    async def _resolve_vidsrc(
        self, tmdb_id: int, media_type: str, season: int | None, episode: int | None, lang: str
    ) -> VodResolveResult | None:
        base = "https://vsembed.ru"
        kind = _norm_type(media_type)
        if kind == "movie":
            page_url = f"{base}/embed/movie?tmdb={tmdb_id}"
        else:
            s = max(1, int(season or 1))
            e = max(1, int(episode or 1))
            page_url = f"{base}/embed/tv?tmdb={tmdb_id}&season={s}&episode={e}"
        html = await self._get_text(page_url, base + "/")
        iframe_m = re.search(r'<iframe[^>]*\s+src=["\']([^"\']+)["\']', html, re.I)
        if not iframe_m:
            return None
        second_url = iframe_m.group(1)
        if second_url.startswith("//"):
            second_url = "https:" + second_url
        second_html = await self._get_text(second_url, page_url)
        rel_m = re.search(r"src:\s*['\"]([^'\"]+)['\"]", second_html, re.I)
        if not rel_m:
            return None
        third_url = urljoin(second_url, rel_m.group(1))
        third_html = await self._get_text(third_url, second_url)
        file_field = re.search(r'file\s*:\s*["\']([^"\']+)["\']', third_html, re.I)
        if not file_field:
            manifest = self._find_m3u8(third_html)
            if not manifest:
                for f in self._find_file_urls(third_html):
                    if ".m3u8" in f:
                        manifest = urljoin(third_url, f)
                        break
            if not manifest:
                return None
        else:
            domains = {
                "{v1}": "neonhorizonworkshops.com",
                "{v2}": "wanderlynest.com",
                "{v3}": "orchidpixelgardens.com",
                "{v4}": "cloudnestra.com",
            }
            templates = re.split(r"\s+or\s+", file_field.group(1), flags=re.I)
            manifest = None
            for template in templates:
                url = template.strip()
                for ph, domain in domains.items():
                    url = url.replace(ph, domain)
                if "{" in url or "}" in url:
                    continue
                if ".m3u8" in url:
                    manifest = url
                    break
            if not manifest:
                return None
        referer = "https://cloudnestra.com/"
        origin = "https://cloudnestra.com"
        head = await self._get_text(manifest, referer, origin)
        if not head.lstrip().startswith("#EXTM3U"):
            return None
        quality = self._parse_master_quality(head) or "Auto"
        return VodResolveResult(
            provider="vidsrc",
            provider_name="VidSrc",
            manifest_url=manifest,
            referer=referer,
            origin=origin,
            quality=quality,
        )

    async def _resolve_2embed(
        self, tmdb_id: int, media_type: str, season: int | None, episode: int | None, lang: str
    ) -> VodResolveResult | None:
        kind = _norm_type(media_type)
        if kind == "movie":
            page = f"https://www.2embed.cc/embed/{tmdb_id}"
        else:
            s = max(1, int(season or 1))
            e = max(1, int(episode or 1))
            page = f"https://www.2embed.cc/embedtv/{tmdb_id}&s={s}&e={e}"
        html = await self._get_text(page)
        m = re.search(r'data-src="([^"]+)"', html) or re.search(
            r'<iframe[^>]+src="(https://[^"]+)"', html, re.I
        )
        if not m:
            return None
        inner_url = m.group(1)
        inner = await self._get_text(inner_url, page)
        manifest = self._find_m3u8(inner)
        if not manifest:
            for f in self._find_file_urls(inner):
                if ".m3u8" in f:
                    manifest = f
                    break
        if not manifest:
            return None
        manifest = urljoin(inner_url, manifest)
        return VodResolveResult(
            provider="2embed",
            provider_name="2Embed",
            manifest_url=manifest,
            referer=inner_url,
            quality="Auto",
        )

    async def _resolve_vidlink(
        self, tmdb_id: int, media_type: str, season: int | None, episode: int | None, lang: str
    ) -> VodResolveResult | None:
        kind = _norm_type(media_type)
        if kind == "movie":
            page = f"https://vidlink.pro/movie/{tmdb_id}"
        else:
            s = max(1, int(season or 1))
            e = max(1, int(episode or 1))
            page = f"https://vidlink.pro/tv/{tmdb_id}/{s}/{e}"
        html = await self._get_text(page)
        manifest = self._find_m3u8(html)
        if manifest:
            return VodResolveResult(
                provider="vidlink",
                provider_name="VidLink",
                manifest_url=manifest,
                referer=page,
                quality="Auto",
            )
        return None

    async def _resolve_icefy(
        self, tmdb_id: int, media_type: str, season: int | None, episode: int | None, lang: str
    ) -> VodResolveResult | None:
        """CinePro Icefy — JSON {stream: m3u8}."""
        base = "https://streams.icefy.top"
        kind = _norm_type(media_type)
        if kind == "movie":
            api = f"{base}/movie/{tmdb_id}"
        else:
            s = max(1, int(season or 1))
            e = max(1, int(episode or 1))
            api = f"{base}/tv/{tmdb_id}/{s}/{e}"
        data = await self._get_json(api, base, base)
        stream = (data.get("stream") or data.get("url") or "").strip()
        if not stream or ".m3u8" not in stream.split("?", 1)[0].lower():
            # sometimes nested
            if isinstance(data.get("sources"), list):
                for item in data["sources"]:
                    if isinstance(item, dict) and ".m3u8" in str(item.get("url") or ""):
                        stream = item["url"]
                        break
                    if isinstance(item, str) and ".m3u8" in item:
                        stream = item
                        break
        if not stream:
            return None
        head = await self._get_text(stream, base, base)
        if not head.lstrip().startswith("#EXTM3U"):
            return None
        return VodResolveResult(
            provider="icefy",
            provider_name="Icefy",
            manifest_url=stream,
            referer=base + "/",
            origin=base,
            quality=self._parse_master_quality(head) or "1080p",
        )

    async def _resolve_cinesu(
        self, tmdb_id: int, media_type: str, season: int | None, episode: int | None, lang: str
    ) -> VodResolveResult | None:
        """CinePro CineSu — direct master playlist URL."""
        base = "https://cine.su"
        kind = _norm_type(media_type)
        if kind == "movie":
            manifest = f"{base}/v1/stream/master/movie/{tmdb_id}.m3u8"
        else:
            s = max(1, int(season or 1))
            e = max(1, int(episode or 1))
            manifest = f"{base}/v1/stream/master/tv/{tmdb_id}/{s}/{e}.m3u8"
        head = await self._get_text(manifest, base + "/en/watch", base)
        if not head.lstrip().startswith("#EXTM3U"):
            return None
        return VodResolveResult(
            provider="cinesu",
            provider_name="CineSu",
            manifest_url=manifest,
            referer=base + "/en/watch",
            origin=base,
            quality=self._parse_master_quality(head) or "1080p",
        )

    async def _resolve_vidapi(
        self, tmdb_id: int, media_type: str, season: int | None, episode: int | None, lang: str
    ) -> VodResolveResult | None:
        """CinePro VidApi — streamdata.vaplayer.ru JSON."""
        api = "https://streamdata.vaplayer.ru/api.php"
        iframe = "https://brightpathsignals.com"
        kind = _norm_type(media_type)
        params = f"?tmdb={tmdb_id}&type={'movie' if kind == 'movie' else 'tv'}"
        if kind == "tv":
            s = max(1, int(season or 1))
            e = max(1, int(episode or 1))
            params += f"&season={s}&episode={e}"
        data = await self._get_json(api + params, iframe + "/", iframe)
        status = str(data.get("status_code") or data.get("status") or "")
        payload = data.get("data") if isinstance(data.get("data"), dict) else data
        if status and status not in ("200", "ok", "OK"):
            if not payload:
                return None
        urls = []
        if isinstance(payload, dict):
            for key in ("stream_urls", "streams", "sources", "url", "file"):
                val = payload.get(key)
                if isinstance(val, list):
                    urls.extend([str(x) for x in val if x])
                elif isinstance(val, str) and val:
                    urls.append(val)
        for raw in urls:
            if isinstance(raw, dict):
                raw = raw.get("url") or raw.get("file") or ""
            u = str(raw).strip()
            if not u:
                continue
            if ".m3u8" not in u.split("?", 1)[0].lower():
                continue
            try:
                head = await self._get_text(u, iframe + "/", iframe)
            except Exception:
                continue
            if head.lstrip().startswith("#EXTM3U"):
                return VodResolveResult(
                    provider="vidapi",
                    provider_name="VidApi",
                    manifest_url=u,
                    referer=iframe + "/",
                    origin=iframe,
                    quality=self._parse_master_quality(head) or "Auto",
                )
        return None

    def _dispatch(self) -> dict[str, Any]:
        return {
            "vixsrc": self._resolve_vixsrc,
            "vidsrc": self._resolve_vidsrc,
            "2embed": self._resolve_2embed,
            "vidlink": self._resolve_vidlink,
            "icefy": self._resolve_icefy,
            "cinesu": self._resolve_cinesu,
            "vidapi": self._resolve_vidapi,
            "videasy": self._resolve_videasy,
            "vidzee": self._resolve_vidzee,
        }

    async def _resolve_videasy(
        self, tmdb_id: int, media_type: str, season: int | None, episode: int | None, lang: str
    ) -> VodResolveResult | None:
        from StepDaddyLiveHD.vod_extractors import resolve_videasy

        client = await self._client()
        return await resolve_videasy(client, tmdb_id, media_type, season, episode, lang)

    async def _resolve_vidzee(
        self, tmdb_id: int, media_type: str, season: int | None, episode: int | None, lang: str
    ) -> VodResolveResult | None:
        from StepDaddyLiveHD.vod_extractors import resolve_vidzee

        client = await self._client()
        return await resolve_vidzee(client, tmdb_id, media_type, season, episode, lang)

    async def _try_provider(
        self,
        pid: str,
        fn: Any,
        tmdb_id: int,
        media_type: str,
        season: int | None,
        episode: int | None,
        lang: str,
    ) -> VodResolveResult | None:
        try:
            return await fn(tmdb_id, media_type, season, episode, lang)
        except Exception:
            return None

    async def resolve_all(
        self,
        tmdb_id: int,
        media_type: str = "movie",
        season: int | None = None,
        episode: int | None = None,
        provider: str | None = None,
        lang: str = "en",
    ) -> list[VodResolveResult]:
        if not tmdb_id or int(tmdb_id) <= 0:
            return []
        tid = int(tmdb_id)
        dispatch = self._dispatch()
        order = [provider.strip().lower()] if provider else DEFAULT_ORDER
        tasks = []
        for pid in order:
            fn = dispatch.get((pid or "").strip().lower())
            if fn:
                tasks.append(self._try_provider(pid, fn, tid, media_type, season, episode, lang))
        if not tasks:
            return []
        results = await asyncio.gather(*tasks)
        out = [r for r in results if r is not None]
        out.sort(key=lambda r: _quality_rank(r.quality), reverse=True)
        return out

    async def resolve(
        self,
        tmdb_id: int,
        media_type: str = "movie",
        season: int | None = None,
        episode: int | None = None,
        provider: str | None = None,
        lang: str = "en",
    ) -> VodResolveResult | None:
        results = await self.resolve_all(
            tmdb_id, media_type, season, episode, provider=provider, lang=lang
        )
        return pick_best_result(results)
