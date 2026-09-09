"""ntv.cx 24/7 CDN resolve (Android NtvCxCdnLive* port)."""

from __future__ import annotations

import base64
import hashlib
import logging
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlencode

import httpx

log = logging.getLogger("supplements.ntv")

BASE_URL = "https://www.ntv.cx"
CHANNELS_API = f"{BASE_URL}/api/get-channels"
GROUP_TITLE = "📡 | Extra | 24/7"
REFERER = "https://cdnlivetv.tv/"
ORIGIN = "https://cdnlivetv.tv"
PLAYER_REFERER = "https://www.ntv.cx/"
HESGOALES_REFERER = "https://hesgoaler.com/"
HESGOALES_ORIGIN = "https://hesgoaler.com"
CATALOG_UA = (
    "Mozilla/5.0 (Linux; Android 11; Android TV) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
# Match Android NtvCxCdnLiveConfig.MAX_CHANNELS — no lean 266-style cap.
MAX_CHANNELS = int(os.environ.get("NTV_MAX_CHANNELS", "1000"))
ID_PREFIX = "ntv:"

_EMBED_TOKEN_RE = re.compile(r"/embed\?t=([^\"'&\s]+)")
_IFRAME_SRC_RE = re.compile(r'src="(https?://[^"]+)"')
_B64_CHUNK_RE = re.compile(r"var ([A-Za-z]+)='([^']+)'")
_HASH_ID_RE = re.compile(r"^[a-f0-9]{20,40}$")
_SLUG_SANITIZE_RE = re.compile(r"[^a-zA-Z0-9\-]")
_HES_SRC_RE = re.compile(r'src:\s*"([^"]+\.m3u8[^"]*)"')
_HES_CH_RE = re.compile(r'ch:\s*"([^"]+)"')
_HES_URL_CH_RE = re.compile(r"[?&]ch=([^&]+)")


@dataclass
class NtvCatalogChannel:
    server: str
    name: str
    region_code: str
    logo: str | None
    stream_page_url: str | None = None


def _bootstrap_path() -> Path:
    return Path(__file__).resolve().parent.parent / "assets" / "supplements" / "ntv_cx_catalog_bootstrap.json"


def _cache_path() -> Path:
    env = os.environ.get("NTV_CATALOG_CACHE", "").strip()
    if env:
        return Path(env)
    root = Path(__file__).resolve().parents[2]
    return root / "data" / "ntv_catalog.json"


def short_hash(value: str) -> str:
    digest = hashlib.sha256(value.encode("utf-8")).digest()
    return "".join(f"{b:02x}" for b in digest[:6])


def channel_slug(channel_name: str) -> str:
    return _SLUG_SANITIZE_RE.sub("", channel_name.strip().replace(" ", "-")).lower()


def ntv_key(server: str, name: str, region_code: str, stream_page_url: str | None = None) -> str:
    if server == "hesgoales":
        return f"{server}|{name.strip()}|{(stream_page_url or '').strip()}"
    return f"{server}|{name.strip()}|{(region_code or 'us').strip() or 'us'}"


def parse_ntv_key(key: str) -> tuple[str, str, str] | None:
    parts = key.split("|", 2)
    if len(parts) < 3:
        return None
    server, name, extra = parts[0].strip(), parts[1].strip(), parts[2].strip()
    if not server or not name:
        return None
    if server == "hesgoales" and not extra:
        return None
    return server, name, extra


def absolute_image_url(raw: str | None) -> str | None:
    trimmed = (raw or "").strip()
    if not trimmed:
        return None
    if trimmed.startswith("http://") or trimmed.startswith("https://"):
        return trimmed
    return f"{BASE_URL}{trimmed}"


def parse_catalog_json(payload: Any) -> list[NtvCatalogChannel]:
    if isinstance(payload, str):
        import json

        try:
            payload = json.loads(payload)
        except Exception:
            return []
    if not isinstance(payload, dict) or payload.get("success") is not True:
        return []
    channels = payload.get("channels")
    if not isinstance(channels, list):
        return []
    out: list[NtvCatalogChannel] = []
    for row in channels:
        if not isinstance(row, dict):
            continue
        server = str(row.get("server") or "").strip()
        if server not in ("cdnlive", "hesgoales"):
            continue
        name = str(row.get("channel_name") or "").strip()
        if not name:
            continue
        code = str(row.get("channel_code") or "").strip() or "us"
        stream_page = None
        if server == "hesgoales":
            stream_page = str(row.get("channel_url") or "").strip() or None
            if not stream_page:
                continue
        out.append(
            NtvCatalogChannel(
                server=server,
                name=name,
                region_code=code,
                logo=absolute_image_url(row.get("channel_image")),
                stream_page_url=stream_page,
            )
        )
    return out


def _load_json_file(path: Path) -> list[NtvCatalogChannel]:
    if not path.is_file():
        return []
    try:
        return parse_catalog_json(path.read_text(encoding="utf-8"))
    except Exception as exc:
        log.warning("ntv catalog file load failed %s: %s", path, exc)
        return []


def load_bootstrap_catalog() -> list[NtvCatalogChannel]:
    return _load_json_file(_bootstrap_path())


def load_disk_catalog() -> list[NtvCatalogChannel]:
    rows = _load_json_file(_cache_path())
    boot = load_bootstrap_catalog()
    if not rows:
        return boot
    if len(rows) >= 80 or not boot:
        return rows
    # Prefer richer bootstrap when the cached live snapshot is thin.
    seen = {ntv_key(r.server, r.name, r.region_code, r.stream_page_url) for r in rows}
    merged = list(rows)
    for row in boot:
        key = ntv_key(row.server, row.name, row.region_code, row.stream_page_url)
        if key in seen:
            continue
        seen.add(key)
        merged.append(row)
    return merged


def save_disk_catalog(raw_text: str) -> None:
    # Avoid clobbering a rich cache with a thin live snapshot.
    try:
        parsed = parse_catalog_json(raw_text)
        existing = _load_json_file(_cache_path())
        if existing and len(parsed) < 80 and len(existing) > len(parsed):
            return
    except Exception:
        pass
    path = _cache_path()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".json.part")
        tmp.write_text(raw_text, encoding="utf-8")
        tmp.replace(path)
    except Exception as exc:
        log.warning("ntv catalog cache write failed: %s", exc)


async def fetch_catalog(client: httpx.AsyncClient) -> list[NtvCatalogChannel]:
    backoffs = (0.0, 1.5, 3.0)
    live_rows: list[NtvCatalogChannel] = []
    for attempt, delay in enumerate(backoffs):
        if delay:
            import asyncio

            await asyncio.sleep(delay)
        try:
            r = await client.get(
                CHANNELS_API,
                headers={
                    "User-Agent": CATALOG_UA,
                    "Accept": "application/json, text/plain, */*",
                    "Referer": PLAYER_REFERER,
                    "Connection": "close",
                },
                timeout=httpx.Timeout(connect=20.0, read=120.0, write=20.0, pool=20.0),
            )
            if r.status_code == 200 and r.text:
                rows = parse_catalog_json(r.text)
                if rows:
                    save_disk_catalog(r.text)
                    live_rows = rows
                    break
        except Exception as exc:
            log.warning("ntv catalog attempt %s failed: %s", attempt + 1, exc)
    if live_rows and len(live_rows) >= 80:
        return live_rows
    # Thin live responses (ntv sometimes returns a short page) — merge disk/bootstrap.
    cached = load_disk_catalog()
    if not live_rows:
        return cached
    seen = {ntv_key(r.server, r.name, r.region_code, r.stream_page_url) for r in live_rows}
    merged = list(live_rows)
    for row in cached:
        key = ntv_key(row.server, row.name, row.region_code, row.stream_page_url)
        if key in seen:
            continue
        seen.add(key)
        merged.append(row)
    return merged


def build_channels(catalog: list[NtvCatalogChannel], max_channels: int = MAX_CHANNELS) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for row in catalog:
        if len(out) >= max_channels:
            break
        key = ntv_key(row.server, row.name, row.region_code, row.stream_page_url)
        if key in seen:
            continue
        seen.add(key)
        token = short_hash(key)
        if row.server == "hesgoales":
            referer, origin, provider = HESGOALES_REFERER, HESGOALES_ORIGIN, "Falcon"
        else:
            referer, origin, provider = REFERER, ORIGIN, "CDN"
        out.append(
            {
                "id": f"{ID_PREFIX}{token}",
                "name": row.name,
                "tvg_id": None,
                "logo": row.logo,
                "group_title": GROUP_TITLE,
                "tags": ["#ntv", "#live", f"#{(row.region_code or 'us').lower()}"],
                "provider": provider,
                "source": "ntv",
                "stream_url": f"/ntv-stream/{token}.m3u8",
                "ntv_key": key,
                "referer": referer,
                "origin": origin,
            }
        )
    return out


def referer_for_key(key: str) -> str:
    parts = parse_ntv_key(key)
    if parts and parts[0] == "hesgoales":
        return HESGOALES_REFERER
    return REFERER


def _decode_b64_chunk(raw: str) -> str | None:
    normalized = raw.strip().replace("~", "=")
    while len(normalized) % 4:
        normalized += "="
    try:
        return base64.b64decode(normalized).decode("utf-8")
    except Exception:
        return None


def parse_player_m3u8(player_html: str) -> str | None:
    decoded: dict[str, str] = {}
    for match in _B64_CHUNK_RE.finditer(player_html):
        value = _decode_b64_chunk(match.group(2))
        if value:
            decoded[match.group(1)] = value
    hash_id = next((v for v in decoded.values() if _HASH_ID_RE.match(v)), None)
    token = next((v for v in decoded.values() if v.startswith("?token=")), None)
    if not hash_id or not token:
        return None
    return f"https://cdnlivetv.tv/secure/api/v1/{hash_id}/playlist.m3u8{token}"


async def _fetch_text(
    client: httpx.AsyncClient,
    url: str,
    *,
    referer: str | None = None,
    timeout: float = 30.0,
) -> str | None:
    headers = {
        "User-Agent": CATALOG_UA,
        "Accept": "application/json, text/html, text/plain, */*",
    }
    if referer:
        headers["Referer"] = referer
    try:
        r = await client.get(url, headers=headers, timeout=timeout, follow_redirects=True)
        if r.status_code != 200:
            return None
        return r.text
    except Exception as exc:
        log.warning("ntv fetch failed %s: %s", url, exc)
        return None


async def resolve_cdnlive_manifest(client: httpx.AsyncClient, channel_name: str, region_code: str) -> str:
    slug = channel_slug(channel_name)
    code = quote(region_code.strip() or "us", safe="")
    watch_url = f"{BASE_URL}/channel-cdnlive/{slug}?code={code}"
    watch_html = await _fetch_text(client, watch_url, referer=PLAYER_REFERER)
    if not watch_html:
        raise RuntimeError("ntv watch page failed")
    m = _EMBED_TOKEN_RE.search(watch_html)
    if not m:
        raise RuntimeError("ntv embed token missing")
    embed_url = f"{BASE_URL}/embed?t={m.group(1).strip()}"
    embed_html = await _fetch_text(client, embed_url, referer=watch_url)
    if not embed_html:
        raise RuntimeError("ntv embed page failed")
    iframe = _IFRAME_SRC_RE.search(embed_html.replace("&amp;", "&"))
    if not iframe:
        raise RuntimeError("ntv player iframe missing")
    player_html = await _fetch_text(client, iframe.group(1).strip(), referer=PLAYER_REFERER)
    if not player_html:
        raise RuntimeError("cdnlivetv player failed")
    manifest = parse_player_m3u8(player_html)
    if not manifest:
        raise RuntimeError("cdnlivetv m3u8 missing")
    return manifest


async def resolve_hesgoales_manifest(client: httpx.AsyncClient, stream_page_url: str) -> str:
    page_url = stream_page_url.strip()
    if not page_url:
        raise RuntimeError("hesgoales_url_missing")
    html = await _fetch_text(client, page_url, referer=HESGOALES_REFERER)
    if not html:
        raise RuntimeError("hesgoales page failed")
    src_m = _HES_SRC_RE.search(html)
    if not src_m:
        raise RuntimeError("hesgoales src missing")
    src = src_m.group(1).strip()
    ch_m = _HES_CH_RE.search(html) or _HES_URL_CH_RE.search(page_url)
    if not ch_m:
        raise RuntimeError("hesgoales channel id missing")
    channel_id = ch_m.group(1).strip()
    try:
        r = await client.post(
            page_url,
            headers={
                "User-Agent": CATALOG_UA,
                "Referer": HESGOALES_REFERER,
                "Content-Type": "application/json",
            },
            json={"channel": channel_id, "current_token": ""},
            timeout=20.0,
        )
        data = r.json() if r.status_code == 200 else None
    except Exception as exc:
        raise RuntimeError("hesgoales token missing") from exc
    if not isinstance(data, dict) or data.get("success") is not True:
        raise RuntimeError("hesgoales token missing")
    token = str(data.get("token") or "").strip()
    if not token:
        raise RuntimeError("hesgoales token missing")
    base = src.split("?", 1)[0].strip()
    return f"{base}?token={token}"


async def resolve_manifest_url(client: httpx.AsyncClient, key: str) -> str:
    parts = parse_ntv_key(key)
    if not parts:
        raise RuntimeError("ntv_key_invalid")
    server, name, extra = parts
    if server == "cdnlive":
        return await resolve_cdnlive_manifest(client, name, extra)
    if server == "hesgoales":
        return await resolve_hesgoales_manifest(client, extra)
    raise RuntimeError("ntv_server_unsupported")


async def fetch_manifest_text(client: httpx.AsyncClient, manifest_url: str, referer: str) -> str:
    text = await _fetch_text(client, manifest_url, referer=referer, timeout=25.0)
    if not text:
        raise RuntimeError("ntv manifest fetch failed")
    return text
