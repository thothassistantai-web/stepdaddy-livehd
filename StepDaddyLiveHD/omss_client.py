"""Optional CinePro Core (OMSS) client for direct HLS source discovery.

Set CINEPRO_OMSS_URL (e.g. http://127.0.0.1:3000) to enable.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import httpx

from StepDaddyLiveHD.vod_resolver import VodResolveResult, _norm_type

CINEPRO_OMSS_URL = os.environ.get("CINEPRO_OMSS_URL", "").strip().rstrip("/")
OMSS_TIMEOUT = float(os.environ.get("CINEPRO_OMSS_TIMEOUT", "35"))


def enabled() -> bool:
    return bool(CINEPRO_OMSS_URL)


def _quality_rank(quality: str | None) -> int:
    if not quality:
        return 0
    m = re.search(r"(\d{3,4})", str(quality))
    return int(m.group(1)) if m else (900 if str(quality).lower() in ("auto", "best") else 0)


def decode_omss_proxy(proxy_url: str, base: str) -> tuple[str, str, str | None]:
    """Decode OMSS /v1/proxy?data=... into manifest URL, referer, origin."""
    raw = proxy_url.strip()
    if raw.startswith("/"):
        raw = base.rstrip("/") + raw
    parsed = urlparse(raw)
    data_param = parse_qs(parsed.query).get("data", [None])[0]
    if not data_param:
        raise ValueError("omss_proxy_missing_data")
    payload = json.loads(unquote(data_param))
    if not isinstance(payload, dict):
        raise ValueError("omss_proxy_invalid_payload")
    manifest = str(payload.get("url") or "").strip()
    if not manifest:
        raise ValueError("omss_proxy_missing_url")
    headers = payload.get("headers") or {}
    if not isinstance(headers, dict):
        headers = {}
    referer = str(headers.get("Referer") or headers.get("referer") or "").strip()
    origin = str(headers.get("Origin") or headers.get("origin") or "").strip() or None
    if not referer:
        referer = manifest
    return manifest, referer, origin


def _omss_source_to_result(source: dict[str, Any], base: str) -> VodResolveResult | None:
    try:
        stype = str(source.get("type") or "").lower()
        if stype in ("dash",):
            return None
        if stype and stype not in ("hls", "http", "mp4"):
            return None
        kind = "mp4" if stype in ("mp4", "http") else "hls"
        proxy_url = str(source.get("url") or "").strip()
        if not proxy_url:
            return None
        if "/v1/proxy" in proxy_url or "data=" in proxy_url:
            manifest, referer, origin = decode_omss_proxy(proxy_url, base)
        else:
            # Some OMSS builds return a raw stream URL.
            manifest = proxy_url
            headers = source.get("headers") if isinstance(source.get("headers"), dict) else {}
            referer = str(headers.get("Referer") or headers.get("referer") or base).strip()
            origin = str(headers.get("Origin") or headers.get("origin") or "").strip() or None
        provider = source.get("provider") or {}
        pid = str(provider.get("id") or provider.get("name") or "omss").strip().lower()
        pname = str(provider.get("name") or pid)
        quality = str(source.get("quality") or "").strip() or None
        return VodResolveResult(
            provider=pid,
            provider_name=pname,
            manifest_url=manifest,
            referer=referer,
            origin=origin,
            quality=quality,
            source="omss",
            kind=kind,
        )
    except Exception:
        return None


async def fetch_sources(
    tmdb_id: int,
    media_type: str = "movie",
    season: int | None = None,
    episode: int | None = None,
    client: httpx.AsyncClient | None = None,
) -> list[VodResolveResult]:
    """Fetch HLS sources from a CinePro OMSS instance."""
    if not enabled() or not tmdb_id:
        return []
    kind = _norm_type(media_type)
    if kind == "movie":
        paths = [f"/v1/movies/{int(tmdb_id)}"]
    else:
        s = max(1, int(season or 1))
        e = max(1, int(episode or 1))
        paths = [
            f"/v1/tv/{int(tmdb_id)}/seasons/{s}/episodes/{e}",
            f"/v1/tv/{int(tmdb_id)}/{s}/{e}",
        ]
    owns = client is None
    if owns:
        client = httpx.AsyncClient(timeout=httpx.Timeout(OMSS_TIMEOUT), follow_redirects=True, verify=False)
    try:
        data: dict[str, Any] | None = None
        for path in paths:
            try:
                r = await client.get(CINEPRO_OMSS_URL + path)
            except Exception:
                continue
            if r.status_code != 200:
                continue
            payload = r.json()
            if isinstance(payload, dict) and (payload.get("sources") or payload.get("error")):
                data = payload
                if payload.get("sources"):
                    break
        if not data:
            return []
        sources = data.get("sources") or []
        if not isinstance(sources, list):
            return []
        out: list[VodResolveResult] = []
        for item in sources:
            if not isinstance(item, dict):
                continue
            result = _omss_source_to_result(item, CINEPRO_OMSS_URL)
            if result:
                out.append(result)
        out.sort(key=lambda x: _quality_rank(x.quality), reverse=True)
        return out
    except Exception:
        return []
    finally:
        if owns and client is not None:
            await client.aclose()


def pick_best(sources: list[VodResolveResult]) -> VodResolveResult | None:
    if not sources:
        return None
    return max(sources, key=lambda s: _quality_rank(s.quality))
