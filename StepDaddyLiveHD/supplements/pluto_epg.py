"""Live Pluto TV guide timelines keyed by plu-{channelId} stream URLs.

WOFTV GitHub JSON is US/CA-centric and matches by channel *name*, so regional
duplicates (e.g. UK Pluto TV Thrillers vs US) get the wrong schedule. Prefer
Pluto's own API when the upstream URL embeds a Pluto channel id.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from StepDaddyLiveHD.supplements.episode_meta import extract_episode_meta, format_episode_label

log = logging.getLogger("supplements.pluto_epg")

ENABLED = os.environ.get("PLUTO_EPG_ENABLE", "1").strip().lower() not in (
    "0",
    "false",
    "no",
    "off",
)
CACHE_DIR = Path(
    os.environ.get(
        "PLUTO_EPG_CACHE_DIR",
        str(Path(__file__).resolve().parents[2] / "data" / "pluto_epg"),
    )
)
CACHE_TTL_SEC = int(os.environ.get("PLUTO_EPG_CACHE_TTL_SEC", str(20 * 60)))
FETCH_TIMEOUT = float(os.environ.get("PLUTO_EPG_TIMEOUT_SEC", "12"))
UA = "Mozilla/5.0 (X11; Linux x86_64) StepDaddy-Gateway/1.0 (+pluto-epg)"

_PLU_RE = re.compile(r"plu-([a-f0-9]{16,24})", re.I)


def extract_pluto_id(url: str | None) -> str | None:
    if not url:
        return None
    m = _PLU_RE.search(str(url))
    return m.group(1).lower() if m else None


def is_non_us_tvg(tvg_id: str | None) -> bool:
    """True when XMLTV id is explicitly non-US (e.g. PlutoTVThrillers.de@GB)."""
    tid = (tvg_id or "").strip()
    if not tid:
        return False
    low = tid.lower()
    if low.endswith("@us") or low.endswith(".us"):
        return False
    if "@" in low:
        region = low.rsplit("@", 1)[-1]
        return region not in ("us", "usa")
    # Bare ids like PlutoTVThrillers.de
    if re.search(r"\.(de|gb|uk|fr|it|es|nl|pl|ca)\b", low):
        return True
    return False


def norm_channel_name(name: str) -> str:
    s = (name or "").lower()
    s = re.sub(r"\([^)]*\)", " ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _cache_path(pluto_id: str) -> Path:
    return CACHE_DIR / f"{pluto_id}.json"


def _read_cache(pluto_id: str) -> list[dict[str, Any]] | None:
    path = _cache_path(pluto_id)
    if not path.is_file():
        return None
    age = time.time() - path.stat().st_mtime
    if age > CACHE_TTL_SEC:
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        rows = payload.get("programmes") if isinstance(payload, dict) else None
        return rows if isinstance(rows, list) else None
    except Exception:
        return None


def _write_cache(pluto_id: str, programmes: list[dict[str, Any]]) -> None:
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        tmp = _cache_path(pluto_id).with_suffix(".json.part")
        tmp.write_text(
            json.dumps(
                {"fetched_at": time.time(), "programmes": programmes},
                separators=(",", ":"),
            ),
            encoding="utf-8",
        )
        tmp.replace(_cache_path(pluto_id))
    except Exception as exc:
        log.debug("pluto cache write failed %s: %s", pluto_id, exc)


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


def _fetch_timelines(pluto_id: str, window_start: float, window_end: float) -> list[dict[str, Any]]:
    start = datetime.fromtimestamp(window_start, timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    stop = datetime.fromtimestamp(window_end, timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    url = (
        f"https://api.pluto.tv/v2/channels/{pluto_id}"
        f"?start={start}&stop={stop}"
    )
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=FETCH_TIMEOUT) as resp:
        data = json.loads(resp.read().decode("utf-8", errors="replace"))
    timelines = []
    if isinstance(data, dict):
        timelines = data.get("timelines") or []
    elif isinstance(data, list) and data:
        timelines = (data[0] or {}).get("timelines") or []
    out: list[dict[str, Any]] = []
    for t in timelines:
        if not isinstance(t, dict):
            continue
        ep = t.get("episode") if isinstance(t.get("episode"), dict) else {}
        series = (ep or {}).get("series") if isinstance((ep or {}).get("series"), dict) else {}
        series_type = str((series or {}).get("type") or "").strip().lower()
        ep_name = str((ep or {}).get("name") or "").strip()
        series_name = str((series or {}).get("name") or "").strip()
        # Prefer series title for TV; keep episode title in subtitle when distinct.
        if series_type in ("film", "movie"):
            title = ep_name or series_name or str(t.get("title") or "").strip()
        else:
            title = series_name or ep_name or str(t.get("title") or "").strip()
        if not title:
            continue
        start_ts = _parse_iso_ts(str(t.get("start") or ""))
        stop_ts = _parse_iso_ts(str(t.get("stop") or t.get("end") or ""))
        if start_ts is None or stop_ts is None or stop_ts <= start_ts:
            continue
        desc = str((ep or {}).get("description") or t.get("description") or "").strip()[:240]
        if (
            series_type not in ("film", "movie")
            and ep_name
            and series_name
            and ep_name.lower() != series_name.lower()
        ):
            subtitle = ep_name[:240]
        else:
            subtitle = desc
        poster_url = None
        backdrop_url = None
        for src in (
            (ep or {}).get("poster"),
            (series or {}).get("tile") if isinstance(series, dict) else None,
            (ep or {}).get("thumbnail"),
        ):
            if isinstance(src, dict):
                path = str(src.get("path") or "").strip()
                if path.startswith("http"):
                    poster_url = path
                    break
            elif isinstance(src, str) and src.startswith("http"):
                poster_url = src.strip()
                break
        for src in (
            (ep or {}).get("featuredImage"),
            (ep or {}).get("poster16_9"),
            (series or {}).get("featuredImage") if isinstance(series, dict) else None,
        ):
            if isinstance(src, dict):
                path = str(src.get("path") or "").strip()
                if path.startswith("http"):
                    backdrop_url = path
                    break
            elif isinstance(src, str) and src.startswith("http"):
                backdrop_url = src.strip()
                break
        year = None
        clip = (ep or {}).get("clip") if isinstance((ep or {}).get("clip"), dict) else {}
        for raw in (
            (clip or {}).get("originalReleaseDate"),
            (ep or {}).get("firstAired"),
            (ep or {}).get("slug"),
        ):
            m = re.search(r"(19|20)\d{2}", str(raw or ""))
            if m:
                year = int(m.group(0))
                break
        category = "Movie" if series_type in ("film", "movie") else "Pluto TV"
        ep_meta = extract_episode_meta(
            ep or {},
            ep_name,
            series_name,
            str((ep or {}).get("slug") or ""),
            title,
            subtitle,
            desc,
        )
        if series_type in ("film", "movie"):
            # Films sometimes carry clip episode numbers — drop spurious S#E#.
            ep_meta = {"season": None, "episode": None, "episode_label": ""}
        row = {
            "title": title,
            "subtitle": subtitle,
            "start": start_ts,
            "stop": stop_ts,
            "category": category,
            "pluto_id": pluto_id,
            "poster_url": poster_url,
            "backdrop_url": backdrop_url,
            "year": year,
        }
        if ep_meta.get("season") is not None:
            row["season"] = ep_meta["season"]
        if ep_meta.get("episode") is not None:
            row["episode"] = ep_meta["episode"]
        if ep_meta.get("episode_label"):
            row["episode_label"] = ep_meta["episode_label"]
        elif ep_meta.get("season") is not None and ep_meta.get("episode") is not None:
            row["episode_label"] = format_episode_label(ep_meta["season"], ep_meta["episode"])
        out.append(row)
    out.sort(key=lambda r: r["start"])
    return out


def load_programmes_for_ids(
    pluto_ids: list[str],
    window_start: float | None = None,
    window_end: float | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """Return pluto_id → programme rows (start/stop unix)."""
    if not ENABLED or not pluto_ids:
        return {}
    now = datetime.now(timezone.utc)
    ws = window_start if window_start is not None else (now - timedelta(hours=2)).timestamp()
    we = window_end if window_end is not None else (now + timedelta(hours=24)).timestamp()
    # Pad fetch window slightly for cache reuse.
    fetch_start = ws - 3600
    fetch_end = we + 3600
    out: dict[str, list[dict[str, Any]]] = {}
    for pid in dict.fromkeys(str(x).lower() for x in pluto_ids if x):
        cached = _read_cache(pid)
        if cached is not None:
            out[pid] = [
                r
                for r in cached
                if float(r.get("stop") or 0) > ws and float(r.get("start") or 0) < we
            ]
            continue
        try:
            rows = _fetch_timelines(pid, fetch_start, fetch_end)
            _write_cache(pid, rows)
            out[pid] = [r for r in rows if float(r["stop"]) > ws and float(r["start"]) < we]
        except Exception as exc:
            log.warning("pluto epg fetch failed %s: %s", pid, exc)
            # Stale cache fallback
            path = _cache_path(pid)
            if path.is_file():
                try:
                    payload = json.loads(path.read_text(encoding="utf-8"))
                    rows = payload.get("programmes") or []
                    out[pid] = [
                        r
                        for r in rows
                        if float(r.get("stop") or 0) > ws and float(r.get("start") or 0) < we
                    ]
                except Exception:
                    pass
    return out
