"""Merged supplement catalog + play-time resolve helpers."""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

from . import dulo, ntv, open_iptv
from .hls_rewrite import rewrite_playlist
from .logo_resolve import get_logo_resolver
from .settings import get_settings

log = logging.getLogger("supplements.catalog")

REFRESH_TTL = float(__import__("os").environ.get("SUPPLEMENT_CACHE_TTL", "600"))


@dataclass
class SupplementChannel:
    id: str
    name: str
    tags: list[str] = field(default_factory=list)
    logo: str | None = None
    dead: bool = False
    tvg_id: str | None = None
    epg_has_data: bool = False
    provider: str | None = None
    group_title: str | None = None
    stream_url: str | None = None
    source: str | None = None
    upstream_url: str | None = None
    referer: str | None = None
    origin: str | None = None
    dulo_channel_id: str | None = None
    ntv_key: str | None = None

    def to_channel_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "tags": list(self.tags),
            "logo": self.logo,
            "dead": self.dead,
            "tvg_id": self.tvg_id,
            "epg_has_data": self.epg_has_data,
            "provider": self.provider,
            "group_title": self.group_title,
            "stream_url": self.stream_url,
            "source": self.source,
        }


def _from_row(row: dict[str, Any]) -> SupplementChannel:
    return SupplementChannel(
        id=str(row["id"]),
        name=str(row.get("name") or row["id"]),
        tags=list(row.get("tags") or []),
        logo=row.get("logo"),
        tvg_id=row.get("tvg_id"),
        provider=row.get("provider"),
        group_title=row.get("group_title"),
        stream_url=row.get("stream_url"),
        source=row.get("source"),
        upstream_url=row.get("upstream_url"),
        referer=row.get("referer"),
        origin=row.get("origin"),
        dulo_channel_id=row.get("dulo_channel_id"),
        ntv_key=row.get("ntv_key"),
    )


class SupplementCatalog:
    def __init__(self) -> None:
        self._channels: list[SupplementChannel] = []
        self._by_id: dict[str, SupplementChannel] = {}
        self._ntv_by_token: dict[str, SupplementChannel] = {}
        self._lock = asyncio.Lock()
        self._loaded_at = 0.0
        self._stats: dict[str, Any] = {}
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=12.0, read=60.0, write=12.0, pool=12.0),
            follow_redirects=True,
            headers={"User-Agent": open_iptv.UA},
        )

    @property
    def stats(self) -> dict[str, Any]:
        return dict(self._stats)

    def list_channels(self) -> list[SupplementChannel]:
        return list(self._channels)

    def get(self, channel_id: str) -> SupplementChannel | None:
        return self._by_id.get(str(channel_id))

    def ntv_by_token(self, token: str) -> SupplementChannel | None:
        return self._ntv_by_token.get(token.strip())

    def is_supplement_id(self, channel_id: str) -> bool:
        cid = str(channel_id)
        return cid.startswith(
            ("freetv:", "iptv:", "adultswim:", "dulo:", "ntv:")
        ) or cid in self._by_id

    async def ensure_loaded(self, force: bool = False) -> None:
        now = time.time()
        if not force and self._channels and (now - self._loaded_at) < REFRESH_TTL:
            return
        async with self._lock:
            now = time.time()
            if not force and self._channels and (now - self._loaded_at) < REFRESH_TTL:
                return
            await self._refresh()

    async def _refresh(self) -> None:
        settings = get_settings()
        rows: list[dict[str, Any]] = []
        stats: dict[str, Any] = {
            "freetv": 0,
            "iptv": 0,
            "adultswim": 0,
            "dulo": 0,
            "ntv": 0,
            "dulo_auth": dulo.auth_configured(),
            "errors": [],
        }

        async def safe(label: str, coro):
            try:
                return await coro
            except Exception as exc:
                log.warning("supplement %s failed: %s", label, exc)
                stats["errors"].append(f"{label}:{exc}")
                return []

        tasks = []
        labels = []
        if settings.get("supplement_freetv", True):
            tasks.append(safe("freetv", open_iptv.fetch_freetv_usa(self._client)))
            labels.append("freetv")
        if settings.get("supplement_iptv_org", True):
            tasks.append(safe("iptv", open_iptv.fetch_iptv_org_small(self._client)))
            labels.append("iptv")
        if settings.get("supplement_adult_swim", True):
            tasks.append(safe("adultswim", open_iptv.fetch_adult_swim(self._client)))
            labels.append("adultswim")
        if settings.get("supplement_dulo", True):
            tasks.append(safe("dulo", self._load_dulo()))
            labels.append("dulo")
        if settings.get("supplement_ntv", True):
            tasks.append(safe("ntv", self._load_ntv()))
            labels.append("ntv")

        results = await asyncio.gather(*tasks) if tasks else []
        for label, part in zip(labels, results):
            stats[label if label != "adultswim" else "adultswim"] = len(part)
            if label == "adultswim":
                stats["adultswim"] = len(part)
            rows.extend(part)

        # Attach logos once at catalog build (iptv-org / Pluto / meta) — CDN URLs.
        resolver = get_logo_resolver()
        try:
            await resolver.ensure_loaded(self._client)
        except Exception as exc:
            log.warning("logo index load failed: %s", exc)
            resolver.load_from_disk()
        logo_filled = 0
        for row in rows:
            before = (row.get("logo") or "").strip()
            resolver.enrich_row(row)
            after = (row.get("logo") or "").strip()
            if after and not before:
                logo_filled += 1
        stats["logo_filled"] = logo_filled
        stats["logo_index"] = resolver.stats

        channels = [_from_row(r) for r in rows]
        by_id = {c.id: c for c in channels}
        ntv_map = {
            c.id.removeprefix("ntv:"): c
            for c in channels
            if c.source == "ntv" and c.id.startswith("ntv:")
        }
        self._channels = channels
        self._by_id = by_id
        self._ntv_by_token = ntv_map
        self._loaded_at = time.time()
        self._stats = stats
        log.info(
            "supplements loaded: freetv=%s iptv=%s adultswim=%s dulo=%s ntv=%s",
            stats.get("freetv"),
            stats.get("iptv"),
            stats.get("adultswim"),
            stats.get("dulo"),
            stats.get("ntv"),
        )

    async def _load_dulo(self) -> list[dict[str, Any]]:
        catalog = await dulo.fetch_catalog(self._client)
        return dulo.build_channels(catalog)

    async def _load_ntv(self) -> list[dict[str, Any]]:
        catalog = await ntv.fetch_catalog(self._client)
        return ntv.build_channels(catalog)

    async def resolve_playlist(self, channel_id: str) -> str:
        await self.ensure_loaded()
        cid = str(channel_id)
        ch = self.get(cid)
        if cid.startswith("dulo:"):
            uuid = (ch.dulo_channel_id if ch else None) or cid.removeprefix("dulo:")
            return await self.resolve_dulo_playlist(uuid)
        if cid.startswith("ntv:"):
            token = cid.removeprefix("ntv:")
            return await self.resolve_ntv_playlist(token)
        if not ch or not ch.upstream_url:
            raise RuntimeError("supplement_channel_not_found")
        return await self._proxy_direct(ch.upstream_url, ch.referer)

    async def resolve_dulo_playlist(self, channel_uuid: str) -> str:
        manifest_url = await dulo.resolve_manifest_url(self._client, channel_uuid)
        text = await dulo.fetch_manifest_text(self._client, manifest_url)
        # Proxy nested media so https /tv never hits mixed-content http:// CDNs.
        return rewrite_playlist(text, manifest_url, proxy=True, referer=dulo.REFERER)

    async def resolve_ntv_playlist(self, token: str) -> str:
        await self.ensure_loaded()
        ch = self.ntv_by_token(token) or self.get(f"ntv:{token}")
        if not ch or not ch.ntv_key:
            raise RuntimeError("ntv_channel_not_found")
        key = ch.ntv_key
        referer = ntv.referer_for_key(key)
        manifest_url = await ntv.resolve_manifest_url(self._client, key)
        text = await ntv.fetch_manifest_text(self._client, manifest_url, referer)
        return rewrite_playlist(text, manifest_url, proxy=True, referer=referer)

    async def _proxy_direct(self, upstream_url: str, referer: str | None) -> str:
        headers = {"User-Agent": open_iptv.UA, "Accept": "*/*"}
        if referer:
            headers["Referer"] = referer
        r = await self._client.get(upstream_url, headers=headers, timeout=25.0)
        if r.status_code >= 400 or not r.text:
            raise RuntimeError(f"direct_upstream_http_{r.status_code}")
        ctype = (r.headers.get("content-type") or "").lower()
        text = r.text
        final_url = str(r.url)
        if "#EXTM3U" in text or "mpegurl" in ctype or upstream_url.lower().endswith(".m3u8"):
            # Always gateway-proxy FreeTV/iptv/Adult Swim — many feeds are plain http://.
            return rewrite_playlist(text, final_url, proxy=True, referer=referer or final_url)
        # Non-HLS progressive — still proxy the single media URL
        return rewrite_playlist(
            f"#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=4000000\n{upstream_url}\n",
            upstream_url,
            proxy=True,
            referer=referer or upstream_url,
        )


_catalog: SupplementCatalog | None = None


def get_catalog() -> SupplementCatalog:
    global _catalog
    if _catalog is None:
        _catalog = SupplementCatalog()
    return _catalog
