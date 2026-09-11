"""Selective epg.pw EPG for DDL / gap-fill (region-scoped, never world dumps).

Memory-safe for Oracle free-tier:
- Never fetch world/all/lite XMLTV dumps.
- Confirm catalog region (GB/US/CA) before any country gzip.
- GB: country index headers + per-channel JSON for mapped ids.
- US/CA: header index only when confirmed candidates or mapped ids exist;
  programme gzip is stream-filtered to mapped channel_ids (not held in RAM).
- Other countries: only if catalog has confirmed channels AND a map entry.

Config:
  EPGPW_ENABLE=1
  EPGPW_CHANNEL_MAP=486840:360[,tvg]
  EPGPW_CHANNEL_MAP_FILE=.../epgpw_channel_map.json
  EPGPW_CACHE_TTL_SEC=1200
  EPGPW_TZ=UTC
  EPGPW_DAYS=2
  EPGPW_AUTO_MATCH=1
  EPGPW_AUTO_MAX=24
  EPGPW_AUTO_MAX_PER_REGION=16
  EPGPW_INDEX_COUNTRIES=GB
  EPGPW_ALLOW_US_INDEX=0       # blind US dump off; auto when mapped/candidates
  EPGPW_REGION_GZ_PROGRAMMES=1 # US/CA mapped → gzip fallback only (JSON preferred)
  EPGPW_PREFER_JSON=1           # prefer per-channel JSON (US gzip often false +0000)
  EPGPW_FETCH_CONCURRENCY=2
"""

from __future__ import annotations

import gzip
import json
import logging
import os
import re
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from xml.etree.ElementTree import XMLParser

from StepDaddyLiveHD.supplements import epgpw_region
from StepDaddyLiveHD.supplements.episode_meta import enrich_programme_row, extract_episode_meta

log = logging.getLogger("supplements.epgpw_epg")

# Sentinel for load_programmes_from_country_gz(write_prog_cache=...):
# omit / sentinel → use _write_prog_cache; explicit None disables shared prog_ writes.
_WRITE_PROG_CACHE_SENTINEL = object()

ENABLED = os.environ.get("EPGPW_ENABLE", "1").strip().lower() not in (
    "0",
    "false",
    "no",
    "off",
)
CACHE_DIR = Path(
    os.environ.get(
        "EPGPW_CACHE_DIR",
        str(Path(__file__).resolve().parents[2] / "data" / "epgpw_epg"),
    )
)
CACHE_TTL_SEC = int(os.environ.get("EPGPW_CACHE_TTL_SEC", str(20 * 60)))
INDEX_TTL_SEC = int(os.environ.get("EPGPW_INDEX_TTL_SEC", str(24 * 3600)))
FETCH_TIMEOUT = float(os.environ.get("EPGPW_TIMEOUT_SEC", "15"))
DAYS = max(1, min(3, int(os.environ.get("EPGPW_DAYS", "2"))))
TZ_NAME = os.environ.get("EPGPW_TZ", "UTC").strip() or "UTC"
AUTO_MATCH = os.environ.get("EPGPW_AUTO_MATCH", "1").strip().lower() not in (
    "0",
    "false",
    "no",
    "off",
)
AUTO_MAX = max(0, int(os.environ.get("EPGPW_AUTO_MAX", "24")))
AUTO_MAX_PER_REGION = max(
    0, int(os.environ.get("EPGPW_AUTO_MAX_PER_REGION", "16"))
)
FETCH_CONCURRENCY = max(1, min(4, int(os.environ.get("EPGPW_FETCH_CONCURRENCY", "2"))))
# Never include world dumps. US is large (~21MB gz) — gated by region policy.
_DEFAULT_INDEX = "GB"
INDEX_COUNTRIES = [
    c.strip().upper()
    for c in os.environ.get("EPGPW_INDEX_COUNTRIES", _DEFAULT_INDEX).split(",")
    if c.strip()
]
# Hard deny list — full world / lite dumps.
_BLOCKED_URL_SUBSTR = (
    "/xmltv/epg.xml",
    "/xmltv/epg_lite.xml",
    "epg_ripper_ALL",
    "epg-all",
)
UA = "Mozilla/5.0 (X11; Linux x86_64) StepDaddy-Gateway/1.0 (+epgpw-epg)"
API_JSON = "https://epg.pw/api/epg.json?lang=en&date={date}&channel_id={cid}"
COUNTRY_GZ = "https://epg.pw/xmltv/epg_{cc}.xml.gz"
PROG_GZ_TTL_SEC = int(os.environ.get("EPGPW_PROG_GZ_TTL_SEC", str(45 * 60)))

_map_lock = threading.Lock()
_index_lock = threading.Lock()
_last_index_fetch: dict[str, float] = {}
_INDEX_MIN_INTERVAL_SEC = float(os.environ.get("EPGPW_INDEX_MIN_INTERVAL_SEC", "30"))

# Seed: 5 USA mapping (epg.pw GB feed → gateway).
_DEFAULT_MAP = {
    "486840": {
        "channel_ids": ["360"],
        "tvg_id": "5USA.uk",
        "name": "5 USA",
        "country": "GB",
    }
}


def _env_truthy(name: str, default: str = "1") -> bool:
    return os.environ.get(name, default).strip().lower() not in (
        "0",
        "false",
        "no",
        "off",
    )


REGION_GZ_PROGRAMMES = _env_truthy("EPGPW_REGION_GZ_PROGRAMMES", "1")
# Prefer per-channel JSON over US/CA country gzip. epg.pw's US XMLTV often stamps
# wall-clock slots as +0000 (false UTC), shifting daytime shows ~8h (ABC National
# Feed: The View at 23:00Z in gz vs 15:00Z in JSON). JSON stays memory-safe for
# mapped ids. Gz remains fallback when JSON is empty/fails.
PREFER_JSON_OVER_REGION_GZ = _env_truthy("EPGPW_PREFER_JSON", "1")


def norm_name(name: str) -> str:
    s = (name or "").lower()
    s = re.sub(r"\([^)]*\)", " ", s)
    s = s.replace("&amp;", " and ").replace("+", " plus ")
    s = re.sub(r"\b(hd|fhd|uhd|4k|sd|tv|channel|live|plus\s*1|\+1)\b", " ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


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


def _date_strings() -> list[str]:
    try:
        from zoneinfo import ZoneInfo

        tz = ZoneInfo(TZ_NAME)
    except Exception:
        tz = timezone.utc
    now = datetime.now(tz)
    return [(now + timedelta(days=i)).strftime("%Y%m%d") for i in range(DAYS)]


def _cache_path(epg_cid: str) -> Path:
    return CACHE_DIR / f"prog_{epg_cid}.json"


def _index_path(cc: str) -> Path:
    return CACHE_DIR / f"index_{cc.upper()}.json"


def _auto_map_path() -> Path:
    return CACHE_DIR / "auto_channel_map.json"


def _sanitize_cached_programme(row: dict[str, Any]) -> dict[str, Any]:
    """Re-derive S/E with current parser (drops stale 9/11→S9E11 style false hits)."""
    if not isinstance(row, dict):
        return row
    cleaned = dict(row)
    cleaned.pop("season", None)
    cleaned.pop("episode", None)
    cleaned.pop("episode_label", None)
    return enrich_programme_row(cleaned)


def _read_prog_cache(epg_cid: str) -> list[dict[str, Any]] | None:
    path = _cache_path(epg_cid)
    if not path.is_file():
        return None
    if time.time() - path.stat().st_mtime > CACHE_TTL_SEC:
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        rows = payload.get("programmes") if isinstance(payload, dict) else None
        if not isinstance(rows, list):
            return None
        return [_sanitize_cached_programme(r) for r in rows if isinstance(r, dict)]
    except Exception:
        return None


def _write_prog_cache(epg_cid: str, programmes: list[dict[str, Any]]) -> None:
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        tmp = _cache_path(epg_cid).with_suffix(".json.part")
        tmp.write_text(
            json.dumps(
                {"fetched_at": time.time(), "programmes": programmes},
                separators=(",", ":"),
            ),
            encoding="utf-8",
        )
        tmp.replace(_cache_path(epg_cid))
    except Exception as exc:
        log.debug("epgpw cache write failed %s: %s", epg_cid, exc)


def _stale_prog_cache(epg_cid: str) -> list[dict[str, Any]] | None:
    path = _cache_path(epg_cid)
    if not path.is_file():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        rows = payload.get("programmes") if isinstance(payload, dict) else None
        return rows if isinstance(rows, list) else None
    except Exception:
        return None


def parse_channel_map_env(raw: str | None = None) -> dict[str, dict[str, Any]]:
    """Parse EPGPW_CHANNEL_MAP=486840:360,123:999:Some.uk → {epg_id: {...}}."""
    text = raw if raw is not None else os.environ.get("EPGPW_CHANNEL_MAP", "")
    out: dict[str, dict[str, Any]] = {}
    for part in (text or "").split(","):
        part = part.strip()
        if not part or ":" not in part:
            continue
        bits = [b.strip() for b in part.split(":")]
        epg_cid, gateway_id = bits[0], bits[1]
        if not epg_cid.isdigit() or not gateway_id:
            continue
        entry = out.setdefault(
            epg_cid, {"channel_ids": [], "tvg_id": None, "name": None, "source": "env"}
        )
        if gateway_id not in entry["channel_ids"]:
            entry["channel_ids"].append(gateway_id)
        if len(bits) >= 3 and bits[2]:
            entry["tvg_id"] = bits[2]
    return out


def _load_map_file() -> dict[str, dict[str, Any]]:
    path = Path(
        os.environ.get(
            "EPGPW_CHANNEL_MAP_FILE",
            str(Path(__file__).resolve().parents[2] / "assets" / "epgpw_channel_map.json"),
        )
    )
    if not path.is_file():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    raw = payload.get("map") if isinstance(payload, dict) else payload
    if not isinstance(raw, dict):
        return {}
    out: dict[str, dict[str, Any]] = {}
    for epg_cid, val in raw.items():
        cid = str(epg_cid).strip()
        if not cid.isdigit():
            continue
        if isinstance(val, dict):
            chans = val.get("channel_ids") or val.get("channels") or []
            if val.get("channel_id") and str(val["channel_id"]) not in [
                str(x) for x in chans
            ]:
                chans = list(chans) + [val["channel_id"]]
            out[cid] = {
                "channel_ids": [str(x).strip() for x in chans if str(x).strip()],
                "tvg_id": (str(val["tvg_id"]).strip() if val.get("tvg_id") else None),
                "name": (str(val["name"]).strip() if val.get("name") else None),
                "country": (
                    str(val["country"]).strip().upper() if val.get("country") else None
                ),
                "source": "file",
            }
        elif isinstance(val, (str, int)):
            out[cid] = {
                "channel_ids": [str(val).strip()],
                "tvg_id": None,
                "name": None,
                "country": None,
                "source": "file",
            }
    return out


def _load_auto_map() -> dict[str, dict[str, Any]]:
    path = _auto_map_path()
    if not path.is_file():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        raw = payload.get("map") if isinstance(payload, dict) else None
        if not isinstance(raw, dict):
            return {}
        out: dict[str, dict[str, Any]] = {}
        for epg_cid, val in raw.items():
            if not str(epg_cid).isdigit() or not isinstance(val, dict):
                continue
            out[str(epg_cid)] = {
                "channel_ids": [str(x) for x in (val.get("channel_ids") or []) if str(x)],
                "tvg_id": val.get("tvg_id"),
                "name": val.get("name"),
                "country": (
                    str(val["country"]).strip().upper() if val.get("country") else None
                ),
                "source": "auto",
            }
        return out
    except Exception:
        return {}


def _save_auto_map(extra: dict[str, dict[str, Any]]) -> None:
    if not extra:
        return
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        existing = _load_auto_map()
        for k, v in extra.items():
            prev = existing.get(k) or {
                "channel_ids": [],
                "tvg_id": None,
                "name": None,
                "country": None,
            }
            ids = list(prev.get("channel_ids") or [])
            for cid in v.get("channel_ids") or []:
                if cid not in ids:
                    ids.append(cid)
            existing[k] = {
                "channel_ids": ids,
                "tvg_id": v.get("tvg_id") or prev.get("tvg_id"),
                "name": v.get("name") or prev.get("name"),
                "country": v.get("country") or prev.get("country"),
                "source": "auto",
            }
        tmp = _auto_map_path().with_suffix(".json.part")
        tmp.write_text(
            json.dumps({"saved_at": time.time(), "map": existing}, indent=2),
            encoding="utf-8",
        )
        tmp.replace(_auto_map_path())
    except Exception as exc:
        log.debug("epgpw auto map save failed: %s", exc)


def load_channel_map() -> dict[str, dict[str, Any]]:
    """Merge default + file + env + persisted auto map (env wins on overlap).

    Non-auto sources (default/file/env) own their gateway channel_ids. Auto entries
    that claim the same gateway id are stripped so a stale auto pin (e.g. MTV→MTVLive)
    cannot override an explicit file sentinel after a remap.
    """
    with _map_lock:
        merged: dict[str, dict[str, Any]] = {}
        for src in (_DEFAULT_MAP, _load_map_file(), _load_auto_map(), parse_channel_map_env()):
            for epg_cid, meta in src.items():
                cur = merged.setdefault(
                    epg_cid,
                    {
                        "channel_ids": [],
                        "tvg_id": None,
                        "name": None,
                        "country": None,
                        "source": meta.get("source"),
                    },
                )
                for cid in meta.get("channel_ids") or []:
                    if cid not in cur["channel_ids"]:
                        cur["channel_ids"].append(cid)
                if meta.get("tvg_id"):
                    cur["tvg_id"] = meta["tvg_id"]
                if meta.get("name"):
                    cur["name"] = meta["name"]
                if meta.get("country"):
                    cur["country"] = str(meta["country"]).strip().upper()
                if meta.get("source"):
                    cur["source"] = meta["source"]
                if not cur.get("country"):
                    inferred = epgpw_region.infer_confirmed_region(
                        str(cur.get("name") or ""),
                        cur.get("tvg_id"),
                    )
                    if inferred:
                        cur["country"] = inferred

        owned: set[str] = set()
        for meta in merged.values():
            if meta.get("source") == "auto":
                continue
            for gid in meta.get("channel_ids") or []:
                owned.add(str(gid))
        if owned:
            for epg_cid in list(merged.keys()):
                meta = merged[epg_cid]
                if meta.get("source") != "auto":
                    continue
                kept = [g for g in (meta.get("channel_ids") or []) if str(g) not in owned]
                if not kept:
                    del merged[epg_cid]
                    continue
                meta["channel_ids"] = kept
        return merged


def gateway_to_epg_ids(channel_map: dict[str, dict[str, Any]] | None = None) -> dict[str, str]:
    """gateway channel_id → epg.pw channel_id."""
    cmap = channel_map if channel_map is not None else load_channel_map()
    out: dict[str, str] = {}
    for epg_cid, meta in cmap.items():
        for gid in meta.get("channel_ids") or []:
            out[str(gid)] = str(epg_cid)
    return out


def mapped_countries(channel_map: dict[str, dict[str, Any]] | None = None) -> set[str]:
    cmap = channel_map if channel_map is not None else load_channel_map()
    out: set[str] = set()
    for meta in cmap.values():
        cc = (meta.get("country") or "").strip().upper()
        if cc:
            out.add(cc)
    return out


def epg_ids_by_country(
    channel_map: dict[str, dict[str, Any]] | None = None,
) -> dict[str, list[str]]:
    cmap = channel_map if channel_map is not None else load_channel_map()
    out: dict[str, list[str]] = {}
    for epg_cid, meta in cmap.items():
        cc = (meta.get("country") or "").strip().upper() or "GB"
        out.setdefault(cc, []).append(str(epg_cid))
    return out


def _fetch_day_json(epg_cid: str, date_ymd: str) -> list[dict[str, Any]]:
    url = API_JSON.format(date=date_ymd, cid=epg_cid)
    if any(b in url for b in _BLOCKED_URL_SUBSTR):
        raise RuntimeError("blocked epg.pw URL")
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=FETCH_TIMEOUT) as resp:
        data = json.loads(resp.read().decode("utf-8", errors="replace"))
    rows = data.get("epg_list") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        return []
    out: list[dict[str, Any]] = []
    for item in rows:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        if not title:
            continue
        start_ts = _parse_iso_ts(str(item.get("start_date") or item.get("start") or ""))
        if start_ts is None:
            continue
        stop_raw = item.get("end_date") or item.get("stop_date") or item.get("stop") or item.get("end")
        stop_ts = _parse_iso_ts(str(stop_raw)) if stop_raw else None
        desc = str(item.get("desc") or item.get("description") or "").strip()[:240]
        ep_meta = extract_episode_meta(
            item,
            title,
            desc,
            str(item.get("subtitle") or ""),
            str(item.get("epnum") or item.get("episode_num") or ""),
        )
        row: dict[str, Any] = {
            "title": title,
            "subtitle": desc,
            "start": start_ts,
            "stop": stop_ts,
            "category": "EPG",
            "epgpw_id": epg_cid,
        }
        if ep_meta.get("season") is not None:
            row["season"] = ep_meta["season"]
        if ep_meta.get("episode") is not None:
            row["episode"] = ep_meta["episode"]
        if ep_meta.get("episode_label"):
            row["episode_label"] = ep_meta["episode_label"]
        out.append(enrich_programme_row(row))
    out.sort(key=lambda r: r["start"])
    # Infer stop from next start when API omits end.
    for i, row in enumerate(out):
        if row.get("stop") and float(row["stop"]) > float(row["start"]):
            continue
        if i + 1 < len(out):
            row["stop"] = float(out[i + 1]["start"])
        else:
            row["stop"] = float(row["start"]) + 3600
    return out


def _fetch_programmes(epg_cid: str) -> list[dict[str, Any]]:
    by_start: dict[float, dict[str, Any]] = {}
    for date_ymd in _date_strings():
        try:
            for row in _fetch_day_json(epg_cid, date_ymd):
                by_start[float(row["start"])] = row
        except Exception as exc:
            log.warning("epgpw day fetch failed %s %s: %s", epg_cid, date_ymd, exc)
        time.sleep(0.15)  # be polite between day requests
    rows = [by_start[k] for k in sorted(by_start)]
    # Re-infer stops across day boundaries.
    for i, row in enumerate(rows):
        if i + 1 < len(rows):
            nxt = float(rows[i + 1]["start"])
            if float(row["stop"]) > nxt or float(row["stop"]) <= float(row["start"]):
                row["stop"] = nxt
        elif float(row["stop"]) <= float(row["start"]):
            row["stop"] = float(row["start"]) + 3600
    return rows


def load_programmes_for_ids(
    epg_ids: list[str],
    window_start: float | None = None,
    window_end: float | None = None,
    channel_map: dict[str, dict[str, Any]] | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """epg.pw channel_id → programme rows (unix start/stop).

    Default: per-channel JSON (accurate UTC for US nets).
    US/CA country gzip is optional fallback only — epg.pw US XMLTV often
    mislabels local wall-clock as +0000, which shifts daytime guides ~8h.
    Set EPGPW_PREFER_JSON=0 to restore gzip-first (legacy).
    """
    if not ENABLED or not epg_ids:
        return {}
    now = datetime.now(timezone.utc)
    ws = window_start if window_start is not None else (now - timedelta(hours=2)).timestamp()
    we = window_end if window_end is not None else (now + timedelta(hours=36)).timestamp()
    unique = list(dict.fromkeys(str(x) for x in epg_ids if str(x).isdigit()))
    out: dict[str, list[dict[str, Any]]] = {}
    cmap = channel_map if channel_map is not None else load_channel_map()

    gz_by_cc: dict[str, list[str]] = {}
    json_ids: list[str] = []
    for cid in unique:
        meta = cmap.get(cid) or {}
        cc = (meta.get("country") or "").strip().upper()
        use_gz = (
            REGION_GZ_PROGRAMMES
            and cc in ("US", "CA")
            and meta.get("channel_ids")
        )
        if use_gz and not PREFER_JSON_OVER_REGION_GZ:
            gz_by_cc.setdefault(cc, []).append(cid)
        else:
            json_ids.append(cid)
            if use_gz and PREFER_JSON_OVER_REGION_GZ:
                # Keep gz as secondary fill if JSON misses this id.
                gz_by_cc.setdefault(cc, []).append(cid)

    def _one(cid: str) -> tuple[str, list[dict[str, Any]]]:
        cached = _read_prog_cache(cid)
        if cached is not None:
            return cid, [
                r
                for r in cached
                if float(r.get("stop") or 0) > ws and float(r.get("start") or 0) < we
            ]
        try:
            rows = _fetch_programmes(cid)
            _write_prog_cache(cid, rows)
            return cid, [
                r for r in rows if float(r["stop"]) > ws and float(r["start"]) < we
            ]
        except Exception as exc:
            log.warning("epgpw fetch failed %s: %s", cid, exc)
            stale = _stale_prog_cache(cid) or []
            return cid, [
                r
                for r in stale
                if float(r.get("stop") or 0) > ws and float(r.get("start") or 0) < we
            ]

    json_ids = list(dict.fromkeys(json_ids))
    if len(json_ids) == 1:
        cid, rows = _one(json_ids[0])
        if rows:
            out[cid] = rows
    elif json_ids:
        with ThreadPoolExecutor(max_workers=FETCH_CONCURRENCY) as pool:
            futs = {pool.submit(_one, cid): cid for cid in json_ids}
            for fut in as_completed(futs):
                cid, rows = fut.result()
                if rows:
                    out[cid] = rows

    # Gz fallback for US/CA ids still missing after JSON (or gzip-first legacy).
    for cc, ids in gz_by_cc.items():
        need = [cid for cid in ids if cid not in out or not out.get(cid)]
        if not need and PREFER_JSON_OVER_REGION_GZ:
            continue
        try:
            # When JSON is preferred, never let gzip overwrite prog_{id}.json —
            # false +0000 US slots would poison the shared cache for later JSON hits.
            part = load_programmes_from_country_gz(
                cc,
                need if PREFER_JSON_OVER_REGION_GZ else ids,
                window_start=ws,
                window_end=we,
                write_prog_cache=(
                    None if PREFER_JSON_OVER_REGION_GZ else _write_prog_cache
                ),
            )
            for cid, rows in part.items():
                if cid not in out or not out.get(cid):
                    out[cid] = rows
        except Exception as exc:
            log.warning("epgpw gz programmes %s failed: %s", cc, exc)
    return out


class _ChannelHeaderTarget:
    """XMLParser target: collect channel id + display-names; abort at first programme."""

    def __init__(self):
        self.channels: list[tuple[str, list[str]]] = []
        self._tag: str | None = None
        self._cid: str | None = None
        self._names: list[str] = []
        self._buf: list[str] = []
        self.hit_programme = False

    def start(self, tag: str, attrs: dict[str, str]):
        if self.hit_programme:
            return
        local = tag.rsplit("}", 1)[-1]
        self._tag = local
        self._buf = []
        if local == "programme":
            self.hit_programme = True
            raise StopIteration("programmes reached")
        if local == "channel":
            self._cid = attrs.get("id")
            self._names = []

    def end(self, tag: str):
        if self.hit_programme:
            return
        local = tag.rsplit("}", 1)[-1]
        text = "".join(self._buf).strip()
        if local == "display-name" and self._cid is not None and text:
            self._names.append(text)
        elif local == "channel" and self._cid:
            self.channels.append((self._cid, list(self._names)))
            self._cid = None
            self._names = []
        self._tag = None
        self._buf = []

    def data(self, data: str):
        if self._tag == "display-name":
            self._buf.append(data)

    def close(self):
        return self.channels


def load_programmes_from_country_gz(
    cc: str,
    epg_ids: list[str],
    window_start: float | None = None,
    window_end: float | None = None,
    write_prog_cache: Any | None = _WRITE_PROG_CACHE_SENTINEL,
) -> dict[str, list[dict[str, Any]]]:
    from StepDaddyLiveHD.supplements.epgpw_gz import (
        load_programmes_from_country_gz as _gz_load,
    )

    # Sentinel preserves legacy default (_write_prog_cache); explicit None disables.
    if write_prog_cache is _WRITE_PROG_CACHE_SENTINEL:
        write_prog_cache = _write_prog_cache

    return _gz_load(
        cc,
        epg_ids,
        cache_dir=CACHE_DIR,
        ttl_sec=PROG_GZ_TTL_SEC,
        fetch_timeout=FETCH_TIMEOUT,
        window_start=window_start,
        window_end=window_end,
        write_prog_cache=write_prog_cache,
    )


def _url_allowed(url: str) -> bool:
    low = url.lower()
    if any(b in low for b in _BLOCKED_URL_SUBSTR):
        return False
    # Only country-scoped gzip paths.
    return bool(re.search(r"/xmltv/epg_[A-Z]{2}\.xml\.gz$", url, re.I))


def _may_fetch_country_index(
    cc: str,
    *,
    candidate_regions: set[str] | None = None,
    mapped: set[str] | None = None,
) -> bool:
    """Gate country gzip header fetch — never AU/BR/… without map + confirmed need."""
    cc = cc.strip().upper()
    if cc in ("ALL", "WORLD", "LITE"):
        return False
    mapped = mapped or set()
    candidate_regions = candidate_regions or set()

    if cc in INDEX_COUNTRIES and cc in epgpw_region.AUTO_INDEX_REGIONS:
        if cc == "US" and not _env_truthy("EPGPW_ALLOW_US_INDEX", "0"):
            # Allow US headers only when confirmed US candidates or mapped US ids.
            if cc not in candidate_regions and cc not in mapped:
                log.info(
                    "epgpw skipping US index (no mapped/candidate US; "
                    "set EPGPW_ALLOW_US_INDEX=1 to force)"
                )
                return False
        return True

    if cc in epgpw_region.AUTO_INDEX_REGIONS:
        # Dynamic: confirmed candidates or existing maps for US/CA beyond INDEX_COUNTRIES.
        if cc in candidate_regions or cc in mapped:
            if cc == "US" and not _env_truthy("EPGPW_ALLOW_US_INDEX", "0"):
                # Still allow when we have candidates/maps (region policy).
                return True
            return True
        return False

    # Exotic countries: require map entry (and caller should have confirmed channels).
    return cc in mapped


def fetch_country_channel_index(cc: str) -> dict[str, list[str]]:
    """Stream country gzip; keep channel headers only → norm_name → [epg_ids]."""
    cc = cc.strip().upper()
    if cc in ("ALL", "WORLD", "LITE"):
        log.warning("epgpw refusing country index %s", cc)
        return {}
    path = _index_path(cc)
    if path.is_file() and (time.time() - path.stat().st_mtime) <= INDEX_TTL_SEC:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            raw = payload.get("by_name") if isinstance(payload, dict) else None
            if isinstance(raw, dict):
                return {k: list(v) for k, v in raw.items() if isinstance(v, list)}
        except Exception:
            pass

    # Rate-limit remote index fetches.
    last = _last_index_fetch.get(cc, 0.0)
    if time.time() - last < _INDEX_MIN_INTERVAL_SEC and path.is_file():
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            raw = payload.get("by_name") or {}
            return {k: list(v) for k, v in raw.items() if isinstance(v, list)}
        except Exception:
            pass

    url = COUNTRY_GZ.format(cc=cc)
    if not _url_allowed(url):
        log.warning("epgpw blocked index URL %s", url)
        return {}

    target = _ChannelHeaderTarget()
    parser = XMLParser(target=target)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        _last_index_fetch[cc] = time.time()
        with urllib.request.urlopen(req, timeout=max(FETCH_TIMEOUT, 45)) as resp:
            with gzip.GzipFile(fileobj=resp) as gz:
                while True:
                    chunk = gz.read(64 * 1024)
                    if not chunk:
                        break
                    try:
                        parser.feed(chunk)
                    except StopIteration:
                        break
    except StopIteration:
        pass
    except Exception as exc:
        log.warning("epgpw index fetch failed %s: %s", cc, exc)
        if path.is_file():
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
                raw = payload.get("by_name") or {}
                return {k: list(v) for k, v in raw.items() if isinstance(v, list)}
            except Exception:
                return {}
        return {}

    by_name: dict[str, list[tuple[str, str]]] = {}
    for epg_cid, names in target.channels:
        for n in names or [""]:
            key = norm_name(n)
            if not key:
                continue
            bucket = by_name.setdefault(key, [])
            if not any(x[0] == epg_cid for x in bucket):
                bucket.append((epg_cid, n))

    def _rank(item: tuple[str, str]) -> tuple:
        epg_cid, raw = item
        low = (raw or "").lower()
        timeshift = 1 if re.search(r"(\+1|plus\s*1|timeshift)", low) else 0
        try:
            nid = int(epg_cid)
        except ValueError:
            nid = 0
        return (timeshift, -nid)

    ranked: dict[str, list[str]] = {}
    for key, items in by_name.items():
        items_sorted = sorted(items, key=_rank)
        ranked[key] = [epg_cid for epg_cid, _ in items_sorted]

    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".json.part")
        tmp.write_text(
            json.dumps(
                {
                    "fetched_at": time.time(),
                    "country": cc,
                    "channels": len(target.channels),
                    "by_name": ranked,
                },
                separators=(",", ":"),
            ),
            encoding="utf-8",
        )
        tmp.replace(path)
    except Exception as exc:
        log.debug("epgpw index write failed %s: %s", cc, exc)
    return ranked


def load_name_index(
    countries: list[str] | None = None,
    *,
    candidate_regions: set[str] | None = None,
    channel_map: dict[str, dict[str, Any]] | None = None,
) -> dict[str, dict[str, list[str]]]:
    """Return {CC: {norm_name: [epg_ids]}} — never merges across countries."""
    cmap = channel_map if channel_map is not None else load_channel_map()
    mapped = mapped_countries(cmap)
    cand = candidate_regions or set()
    if countries is None:
        countries = list(
            dict.fromkeys(
                list(INDEX_COUNTRIES)
                + sorted(cand & epgpw_region.AUTO_INDEX_REGIONS)
                + sorted(mapped)
            )
        )
    with _index_lock:
        out: dict[str, dict[str, list[str]]] = {}
        for cc in countries:
            cc_u = cc.strip().upper()
            if not _may_fetch_country_index(cc_u, candidate_regions=cand, mapped=mapped):
                continue
            part = fetch_country_channel_index(cc_u)
            if part:
                out[cc_u] = part
        return out


def resolve_epg_id_for_name(name: str, index: dict[str, list[str]]) -> str | None:
    key = norm_name(name)
    if not key:
        return None
    ids = index.get(key)
    if ids:
        return ids[0]
    for alt in (
        key.replace(" usa", "").replace(" uk", "").replace(" us", "").replace(" ca", "").strip(),
    ):
        if alt and alt in index:
            return index[alt][0]
    return None


def auto_match_gaps(
    candidates: list[tuple[Any, ...]],
    existing_map: dict[str, dict[str, Any]] | None = None,
) -> dict[str, dict[str, Any]]:
    """Match gaps to epg.pw ids within each confirmed region only.

    candidates: (gateway_id, name, tvg_id[, region]) — region inferred if omitted.
    """
    if not ENABLED or not AUTO_MATCH or AUTO_MAX <= 0:
        return {}
    cmap = existing_map if existing_map is not None else load_channel_map()
    already_gateway = set(gateway_to_epg_ids(cmap))

    # Normalize to (gid, name, tvg, region)
    normalized: list[tuple[str, str, str | None, str]] = []
    for row in candidates:
        if len(row) >= 4 and row[3]:
            region = str(row[3]).strip().upper()
            gid, name, tvg = str(row[0]), str(row[1]), (str(row[2]) if row[2] else None)
        else:
            gid = str(row[0])
            name = str(row[1]) if len(row) > 1 else ""
            tvg = str(row[2]) if len(row) > 2 and row[2] else None
            region = epgpw_region.infer_confirmed_region(name, tvg) or ""
        if not region or gid in already_gateway:
            continue
        if region not in epgpw_region.AUTO_INDEX_REGIONS:
            # Exotic: only match if that country already has a map (index allowed).
            if region not in mapped_countries(cmap):
                continue
        normalized.append((gid, name, tvg, region))

    if not normalized:
        return {}

    by_region: dict[str, list[tuple[str, str, str | None]]] = {}
    for gid, name, tvg, region in normalized:
        by_region.setdefault(region, []).append((gid, name, tvg))

    indexes = load_name_index(
        candidate_regions=set(by_region),
        channel_map=cmap,
    )
    found: dict[str, dict[str, Any]] = {}
    used_gateway: set[str] = set()
    per_region_counts: dict[str, int] = {}

    for region, rows in by_region.items():
        index = indexes.get(region) or {}
        if not index:
            continue
        for gid, name, tvg in rows:
            if len(found) >= AUTO_MAX:
                break
            if per_region_counts.get(region, 0) >= AUTO_MAX_PER_REGION:
                break
            if gid in used_gateway:
                continue
            epg_cid = resolve_epg_id_for_name(name, index)
            if not epg_cid and tvg:
                base = tvg.split("@", 1)[0]
                base = re.sub(r"\.(uk|us|ca|ie)\d*$", "", base, flags=re.I)
                base = base.replace(".", " ")
                epg_cid = resolve_epg_id_for_name(base, index)
            if not epg_cid or epg_cid in found:
                continue
            found[epg_cid] = {
                "channel_ids": [gid],
                "tvg_id": tvg,
                "name": name,
                "country": region,
                "source": "auto",
            }
            used_gateway.add(gid)
            per_region_counts[region] = per_region_counts.get(region, 0) + 1
        if len(found) >= AUTO_MAX:
            break

    if found:
        _save_auto_map(found)
    return found


def high_value_uk_candidates_from_catalog(
    catalog_rows: list[tuple[str, str, str | None]],
) -> list[tuple[str, str, str | None]]:
    """Backward-compatible UK-only filter; prefer region_candidates_from_catalog."""
    rich = [(gid, name, tvg, None) for gid, name, tvg in catalog_rows]
    return [
        (gid, name, tvg)
        for gid, name, tvg, region in epgpw_region.region_candidates_from_catalog(rich)
        if region == "GB"
    ]


def region_candidates_from_catalog(
    catalog_rows: list[tuple[Any, ...]],
) -> list[tuple[str, str, str | None, str]]:
    return epgpw_region.region_candidates_from_catalog(catalog_rows)
