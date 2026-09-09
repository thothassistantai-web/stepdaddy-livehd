"""WhatsOnFreeTV schedule data (public GitHub JSON) for Free-TV + FAST EPG merge.

Source: https://github.com/whatsonfreetv/whatsonfreetv-data
(same feeds the site at https://whatsonfreetv.com/ loads).

Platforms present in the feed (US): Pluto TV, Plex, Roku, Samsung TV Plus,
Tubi, Xumo Play. Cached on disk; do not hammer GitHub.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from StepDaddyLiveHD.supplements.episode_meta import enrich_programme_row, extract_episode_meta

log = logging.getLogger("supplements.woftv_epg")

DATA_BASES = [
    "https://cdn.jsdelivr.net/gh/whatsonfreetv/whatsonfreetv-data@main/",
    "https://raw.githubusercontent.com/whatsonfreetv/whatsonfreetv-data/main/",
]
UA = "Mozilla/5.0 (X11; Linux x86_64) StepDaddy-Gateway/1.0 (+https://whatsonfreetv.com)"

CACHE_DIR = Path(
    os.environ.get(
        "WOFTV_EPG_CACHE_DIR",
        str(Path(__file__).resolve().parents[2] / "data" / "woftv_epg"),
    )
)
CACHE_TTL_SEC = int(os.environ.get("WOFTV_EPG_CACHE_TTL_SEC", str(6 * 3600)))
ENABLED = os.environ.get("WOFTV_EPG_ENABLE", "1").strip().lower() not in (
    "0",
    "false",
    "no",
    "off",
)
COUNTRIES = [
    c.strip().lower()
    for c in os.environ.get("WOFTV_EPG_COUNTRIES", "us,ca").split(",")
    if c.strip()
]
PLACEHOLDER_TITLE = "program information currently unavailable"
_MARKER_RE = re.compile(r"[🅖🅨ⓈⒼⓎ]+")
_NORM_RE = re.compile(r"[^a-z0-9]+")

# Catalog/platform tags → WhatsOnFreeTV "platform" field values.
PLATFORM_ALIASES: dict[str, str] = {
    "pluto": "Pluto TV",
    "plutotv": "Pluto TV",
    "plex": "Plex",
    "roku": "Roku",
    "samsung": "Samsung TV Plus",
    "samsungtvplus": "Samsung TV Plus",
    "tubi": "Tubi",
    "xumo": "Xumo Play",
    "xumoplay": "Xumo Play",
}
# Platforms requested but with no WOFTV (or stable public GitHub) schedule feed.
UNSUPPORTED_PLATFORMS = ("lg", "tcl", "vizio", "prime", "amazon", "firetv")


def norm_name(name: str) -> str:
    s = (name or "").lower()
    s = _MARKER_RE.sub(" ", s)
    s = re.sub(r"\([^)]*\)", " ", s)
    s = s.replace("+", " plus ").replace("&", " and ")
    s = re.sub(
        r"\b(usa|us|uk|ca|hd|fhd|4k|sd|tv|channel|live|free|fast)\b",
        " ",
        s,
    )
    s = _NORM_RE.sub(" ", s)
    return re.sub(r"\s+", " ", s).strip()


def _cache_path(filename: str) -> Path:
    return CACHE_DIR / filename


def _read_cache(filename: str) -> dict[str, Any] | None:
    path = _cache_path(filename)
    if not path.is_file():
        return None
    age = time.time() - path.stat().st_mtime
    if age > CACHE_TTL_SEC:
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _write_cache(filename: str, payload: dict[str, Any]) -> None:
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        tmp = _cache_path(filename + ".part")
        tmp.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
        tmp.replace(_cache_path(filename))
    except Exception as exc:
        log.debug("woftv cache write failed %s: %s", filename, exc)


def _download_json(filename: str) -> dict[str, Any] | None:
    cached = _read_cache(filename)
    if cached is not None:
        return cached
    # Stale cache fallback after failed downloads
    stale_path = _cache_path(filename)
    last_err: Exception | None = None
    for base in DATA_BASES:
        url = base + filename
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=90) as resp:
                raw = resp.read()
            payload = json.loads(raw.decode("utf-8", errors="replace"))
            if isinstance(payload, dict):
                _write_cache(filename, payload)
                return payload
        except Exception as exc:
            last_err = exc
            log.debug("woftv fetch miss %s: %s", url, exc)
            continue
    if stale_path.is_file():
        try:
            log.warning("woftv using stale cache for %s (%s)", filename, last_err)
            return json.loads(stale_path.read_text(encoding="utf-8"))
        except Exception:
            pass
    if last_err:
        log.warning("woftv fetch failed %s: %s", filename, last_err)
    return None


def _parse_iso_ts(value: str) -> float | None:
    if not value:
        return None
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).timestamp()
    except Exception:
        return None


def load_programmes_by_norm_name(
    countries: list[str] | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """Return normalized channel-name → programme row dicts (start/stop/title/…)."""
    _by_platform, flat = load_programmes_by_platform(countries=countries)
    return flat


def load_programmes_by_platform(
    countries: list[str] | None = None,
) -> tuple[dict[str, dict[str, list[dict[str, Any]]]], dict[str, list[dict[str, Any]]]]:
    """Return (platform → norm_name → programmes, flat all-platform index)."""
    if not ENABLED:
        return {}, {}
    by_platform: dict[str, dict[str, list[dict[str, Any]]]] = {}
    flat: dict[str, list[dict[str, Any]]] = {}
    for country in countries or COUNTRIES:
        cc = country.strip().lower()
        if cc not in ("us", "ca"):
            continue
        payload = _download_json(f"epg-{cc}.json")
        if not payload:
            continue
        for row in payload.get("programs") or []:
            if not isinstance(row, dict):
                continue
            ch_name = str(row.get("channel") or "").strip()
            title = str(row.get("title") or "").strip()
            if not ch_name or not title:
                continue
            if title.lower() == PLACEHOLDER_TITLE:
                continue
            start_ts = _parse_iso_ts(str(row.get("start") or ""))
            stop_ts = _parse_iso_ts(str(row.get("end") or row.get("stop") or ""))
            if start_ts is None or stop_ts is None or stop_ts <= start_ts:
                continue
            key = norm_name(ch_name)
            if not key:
                continue
            platform = str(row.get("platform") or "FreeTV").strip() or "FreeTV"
            subtitle = str(row.get("description") or "").strip()[:240]
            ep_meta = extract_episode_meta(row, title, subtitle)
            prog = {
                "title": title,
                "subtitle": subtitle,
                "start": start_ts,
                "stop": stop_ts,
                "category": platform,
                "woftv_channel": ch_name,
                "woftv_platform": platform,
            }
            if ep_meta.get("season") is not None:
                prog["season"] = ep_meta["season"]
            if ep_meta.get("episode") is not None:
                prog["episode"] = ep_meta["episode"]
            if ep_meta.get("episode_label"):
                prog["episode_label"] = ep_meta["episode_label"]
            enrich_programme_row(prog)
            by_platform.setdefault(platform, {}).setdefault(key, []).append(prog)
            flat.setdefault(key, []).append(prog)
    for plat_index in by_platform.values():
        for rows in plat_index.values():
            rows.sort(key=lambda r: r["start"])
    for rows in flat.values():
        rows.sort(key=lambda r: r["start"])
    return by_platform, flat


def resolve_woftv_platform(hint: str | None) -> str | None:
    """Map catalog tag/group hint to a WOFTV platform label, or None."""
    if not hint:
        return None
    raw = hint.strip().lower().lstrip("#")
    if raw in PLATFORM_ALIASES:
        return PLATFORM_ALIASES[raw]
    # group_title like "iptv-org | us_pluto"
    for part in re.split(r"[|\s_/.-]+", raw):
        if part in PLATFORM_ALIASES:
            return PLATFORM_ALIASES[part]
    return None


def best_match(channel_name: str, index: dict[str, list]) -> str | None:
    """Return the norm key in index that best matches channel_name, or None."""
    needle = norm_name(channel_name)
    if not needle:
        return None
    if needle in index:
        return needle
    # Case-folded exact already covered by norm; try containment with length ratio.
    best_key = None
    best_score = 0.0
    for key in index:
        if not key:
            continue
        if needle == key:
            return key
        if needle in key or key in needle:
            score = min(len(needle), len(key)) / max(len(needle), len(key))
            if score >= 0.78 and score > best_score:
                best_score = score
                best_key = key
    return best_key


def best_match_platform(
    channel_name: str,
    by_platform: dict[str, dict[str, list]],
    flat: dict[str, list],
    platform_hint: str | None = None,
) -> tuple[str | None, str | None]:
    """Return (norm_key, platform_label) preferring platform_hint when available."""
    preferred = resolve_woftv_platform(platform_hint)
    if preferred and preferred in by_platform:
        key = best_match(channel_name, by_platform[preferred])
        if key:
            return key, preferred
    key = best_match(channel_name, flat)
    if not key:
        return None, None
    # Recover platform from first programme row when matching flat.
    rows = flat.get(key) or []
    plat = str((rows[0] or {}).get("woftv_platform") or "") if rows else ""
    return key, (plat or None)