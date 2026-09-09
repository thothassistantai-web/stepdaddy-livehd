"""dulo.cx Live TV catalog + JWT playback-session resolver (Android DuloCxLive* port)."""

from __future__ import annotations

import logging
import os
import re
import uuid
from dataclasses import dataclass
from typing import Any

import httpx

log = logging.getLogger("supplements.dulo")

SITE_ORIGIN = "https://dulo.cx"
API_BASE = f"{SITE_ORIGIN}/api"
CHANNELS_URL = f"{API_BASE}/live-tv/channels"
SESSION_URL = f"{API_BASE}/session"
PLAYBACK_SESSION_URL = f"{API_BASE}/live-tv/playback-session"
ACTIVATE_DEVICE_URL = f"{API_BASE}/live-tv/activate-device"
REFERER = f"{SITE_ORIGIN}/live"
ORIGIN = SITE_ORIGIN
USER_AGENT = (
    "Mozilla/5.0 (Linux; Android 11; Android TV) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
ID_PREFIX = "dulo:"
GROUP_TITLE = "📡 | Extra | Dulo Live"
# Full public catalog (~200+); do not artificially cap unless env overrides.
MAX_CHANNELS = int(os.environ.get("DULO_MAX_CHANNELS", "500"))
DEVICE_FP = "stepdaddy-gw-" + uuid.uuid4().hex[:12]

CATEGORY_PRIORITY = {
    "sports": 100,
    "news": 80,
    "entertainment": 50,
    "documentary": 30,
    "movies": 20,
    "kids": 10,
}


@dataclass
class DuloCatalogChannel:
    id: str
    name: str
    category: str
    logo_url: str | None
    supporter_only: bool
    playable: bool
    sort_order: int


def access_token() -> str:
    return (os.environ.get("DULO_CX_ACCESS_TOKEN") or os.environ.get("SUPPLEMENT_DULO_CX_ACCESS_TOKEN") or "").strip()


def auth_configured() -> bool:
    return bool(access_token())


def _headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    h = {
        "User-Agent": USER_AGENT,
        "Origin": ORIGIN,
        "Referer": REFERER,
        "Accept": "application/json, text/plain, */*",
    }
    if extra:
        h.update(extra)
    return h


def parse_catalog_json(payload: Any) -> list[DuloCatalogChannel]:
    if not isinstance(payload, dict):
        return []
    arr = payload.get("channels")
    if not isinstance(arr, list):
        return []
    out: list[DuloCatalogChannel] = []
    for row in arr:
        if not isinstance(row, dict):
            continue
        cid = str(row.get("id") or "").strip()
        name = str(row.get("name") or "").strip()
        if not cid or not name:
            continue
        logo = str(row.get("logo_url") or "").strip()
        out.append(
            DuloCatalogChannel(
                id=cid,
                name=name,
                category=str(row.get("category") or "entertainment").strip() or "entertainment",
                logo_url=logo if logo.startswith("http") else None,
                supporter_only=bool(row.get("supporter_only")),
                playable=row.get("playable") is not False,
                sort_order=int(row.get("sort_order") or 0),
            )
        )
    return out


async def fetch_catalog(client: httpx.AsyncClient) -> list[DuloCatalogChannel]:
    try:
        r = await client.get(CHANNELS_URL, headers=_headers(), timeout=18.0)
        if r.status_code != 200:
            log.warning("dulo catalog http %s", r.status_code)
            return []
        return parse_catalog_json(r.json())
    except Exception as exc:
        log.warning("dulo catalog fetch failed: %s", exc)
        return []


def clean_display_name(raw: str) -> str:
    name = raw.strip()
    name = re.sub(r"\s*\|\s*(USA|UK|CA|AU|LAT|MEX|ES|PT)\s*$", "", name, flags=re.I)
    name = re.sub(r"\s+HD\s*$", "", name, flags=re.I)
    name = re.sub(r"\s+", " ", name).strip()
    return name or raw.strip()


def region_tag_from_name(name: str) -> str:
    upper = name.upper()
    if "| USA" in upper or upper.endswith(" USA"):
        return "#us"
    if "| UK" in upper or upper.endswith(" UK"):
        return "#uk"
    if "| CA" in upper or upper.endswith(" CA"):
        return "#ca"
    if "| AU" in upper:
        return "#au"
    return "#international"


def category_tag(category: str | None) -> str:
    c = (category or "").strip().lower()
    return f"#{c}" if c in CATEGORY_PRIORITY else "#live"


def rank(row: DuloCatalogChannel) -> int:
    score = CATEGORY_PRIORITY.get(row.category.lower(), 0)
    upper = row.name.upper()
    if "| USA" in upper or upper.endswith(" USA"):
        score += 40
    if "| UK" in upper or "| CA" in upper:
        score += 15
    if upper.startswith("24/7"):
        score -= 25
    return score


def build_channels(catalog: list[DuloCatalogChannel], max_channels: int = MAX_CHANNELS) -> list[dict]:
    ranked = sorted(
        [r for r in catalog if r.playable and not r.supporter_only and r.id],
        key=lambda r: (-rank(r), r.sort_order, r.name.lower()),
    )
    out: list[dict] = []
    seen: set[str] = set()
    for row in ranked:
        if len(out) >= max_channels:
            break
        if row.id in seen:
            continue
        seen.add(row.id)
        display = clean_display_name(row.name)
        region = region_tag_from_name(row.name)
        tags = [region, category_tag(row.category), "#dulo", "#live"]
        out.append(
            {
                "id": f"{ID_PREFIX}{row.id}",
                "name": display,
                "tvg_id": None,
                "logo": row.logo_url,
                "group_title": GROUP_TITLE,
                "tags": tags,
                "provider": "Dulo",
                "source": "dulo",
                "stream_url": f"/dulo-stream/{row.id}.m3u8",
                "dulo_channel_id": row.id,
                "referer": REFERER,
                "origin": ORIGIN,
            }
        )
    return out


def _normalize_playlist_url(url: str) -> str:
    if ".m3u8" in url.lower():
        return url
    if ".ts" in url.lower():
        replaced = re.sub(r"/\d+\.ts(\?.*)?$", r"/playlist.m3u8\1", url, flags=re.I)
        if replaced != url:
            return replaced
        slash = url.rfind("/")
        if slash > 0:
            return url[: slash + 1] + "playlist.m3u8"
    return url


async def resolve_manifest_url(client: httpx.AsyncClient, channel_id: str) -> str:
    cid = channel_id.strip()
    if not cid:
        raise RuntimeError("dulo_channel_id_missing")
    token = access_token()
    if not token:
        raise RuntimeError("dulo_auth_required")

    # Session cookie (best-effort)
    try:
        await client.get(SESSION_URL, headers=_headers(), timeout=12.0)
    except Exception:
        pass

    # Activate device (best-effort)
    try:
        await client.post(
            ACTIVATE_DEVICE_URL,
            headers=_headers(
                {
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                }
            ),
            json={"deviceFingerprint": DEVICE_FP},
            timeout=12.0,
        )
    except Exception as exc:
        log.warning("dulo activate-device failed: %s", exc)

    r = await client.post(
        PLAYBACK_SESSION_URL,
        headers=_headers(
            {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }
        ),
        json={"deviceFingerprint": DEVICE_FP, "channelId": cid},
        timeout=20.0,
    )
    text = r.text
    if r.status_code >= 400:
        err = "dulo_playback_http_%s" % r.status_code
        try:
            err = (r.json() or {}).get("error") or err
        except Exception:
            pass
        raise RuntimeError(err)
    try:
        obj = r.json()
    except Exception as exc:
        raise RuntimeError("dulo_playback_json_invalid") from exc
    playback = str((obj or {}).get("playbackUrl") or "").strip()
    if not playback:
        raise RuntimeError("dulo_playback_url_missing")
    if "/live-gateway/" not in playback:
        raise RuntimeError("dulo_playback_url_invalid")
    if not playback.startswith("http"):
        playback = SITE_ORIGIN.rstrip("/") + playback
    return _normalize_playlist_url(playback)


async def fetch_manifest_text(client: httpx.AsyncClient, manifest_url: str) -> str:
    r = await client.get(manifest_url, headers=_headers(), timeout=20.0)
    if r.status_code != 200 or not r.text:
        raise RuntimeError("dulo_manifest_fetch_failed")
    return r.text
