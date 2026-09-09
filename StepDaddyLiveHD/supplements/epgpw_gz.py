"""Stream-filter epg.pw country gzip programmes for a wanted id set (no full dump in RAM)."""

from __future__ import annotations

import gzip
import json
import logging
import re
import threading
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable
from xml.etree.ElementTree import XMLParser

log = logging.getLogger("supplements.epgpw_gz")

UA = "Mozilla/5.0 (X11; Linux x86_64) StepDaddy-Gateway/1.0 (+epgpw-epg)"
COUNTRY_GZ = "https://epg.pw/xmltv/epg_{cc}.xml.gz"
_BLOCKED = ("/xmltv/epg.xml", "/xmltv/epg_lite.xml", "epg_ripper_ALL", "epg-all")
_lock = threading.Lock()


def _url_allowed(url: str) -> bool:
    low = url.lower()
    if any(b in low for b in _BLOCKED):
        return False
    return bool(re.search(r"/xmltv/epg_[A-Z]{2}\.xml\.gz$", url, re.I))


class FilteredProgrammeTarget:
    """XMLParser target: keep programmes only for wanted channel ids."""

    def __init__(self, wanted: set[str], window_start: float, window_end: float):
        self.wanted = wanted
        self.ws = window_start
        self.we = window_end
        self.by_cid: dict[str, list[dict[str, Any]]] = {c: [] for c in wanted}
        self._tag: str | None = None
        self._buf: list[str] = []
        self._keep = False
        self._cid: str | None = None
        self._start: float | None = None
        self._stop: float | None = None
        self._title = ""
        self._desc = ""
        self._epnum = ""

    def start(self, tag: str, attrs: dict[str, str]):
        local = tag.rsplit("}", 1)[-1]
        self._tag = local
        self._buf = []
        if local == "programme":
            cid = str(attrs.get("channel") or "")
            self._keep = cid in self.wanted
            self._cid = cid if self._keep else None
            self._title = ""
            self._desc = ""
            self._epnum = ""
            self._start = None
            self._stop = None
            if self._keep:
                self._start = self._parse_xmltv_attr(attrs.get("start") or "")
                self._stop = self._parse_xmltv_attr(attrs.get("stop") or "")
        elif self._keep and local == "title":
            pass
        elif self._keep and local in ("desc", "sub-title", "episode-num"):
            pass

    @staticmethod
    def _parse_xmltv_attr(value: str) -> float | None:
        value = (value or "").strip()
        if not value:
            return None
        m = re.match(r"^(\d{14})", value)
        if not m:
            return None
        body = m.group(1)
        rest = value[14:].strip()
        off = "+0000"
        if rest:
            om = re.match(r"^([+-]\d{2}):?(\d{2})", rest)
            if om:
                off = f"{om.group(1)}{om.group(2)}"
            elif re.match(r"^[+-]\d{4}$", rest):
                off = rest
        try:
            dt = datetime.strptime(f"{body} {off}", "%Y%m%d%H%M%S %z")
            return dt.astimezone(timezone.utc).timestamp()
        except Exception:
            try:
                return (
                    datetime.strptime(body, "%Y%m%d%H%M%S")
                    .replace(tzinfo=timezone.utc)
                    .timestamp()
                )
            except Exception:
                return None

    def end(self, tag: str):
        local = tag.rsplit("}", 1)[-1]
        text = "".join(self._buf).strip()
        if self._keep:
            if local == "title" and text and not self._title:
                self._title = text
            elif local in ("desc", "sub-title") and text and not self._desc:
                self._desc = text[:240]
            elif local == "episode-num" and text and not self._epnum:
                self._epnum = text
            elif local == "programme" and self._cid and self._title and self._start is not None:
                stop = (
                    self._stop
                    if self._stop and self._stop > self._start
                    else self._start + 3600
                )
                if stop > self.ws and self._start < self.we:
                    row: dict[str, Any] = {
                        "title": self._title,
                        "subtitle": self._desc,
                        "start": self._start,
                        "stop": stop,
                        "category": "EPG",
                        "epgpw_id": self._cid,
                    }
                    if self._epnum:
                        row["episode_label"] = self._epnum
                    try:
                        from StepDaddyLiveHD.supplements.episode_meta import enrich_programme_row

                        enrich_programme_row(row)
                    except Exception:
                        pass
                    self.by_cid.setdefault(self._cid, []).append(row)
                self._keep = False
                self._cid = None
        self._tag = None
        self._buf = []

    def data(self, data: str):
        if self._keep and self._tag in ("title", "desc", "sub-title", "episode-num"):
            self._buf.append(data)

    def close(self):
        return self.by_cid


def load_programmes_from_country_gz(
    cc: str,
    epg_ids: list[str],
    *,
    cache_dir: Path,
    ttl_sec: int,
    fetch_timeout: float,
    window_start: float | None = None,
    window_end: float | None = None,
    write_prog_cache: Callable[[str, list[dict[str, Any]]], None] | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """Stream country gzip; keep programmes only for wanted epg channel ids."""
    cc = cc.strip().upper()
    wanted = {str(x) for x in epg_ids if str(x).isdigit()}
    if not wanted or cc in ("ALL", "WORLD", "LITE"):
        if cc in ("ALL", "WORLD", "LITE"):
            log.warning("epgpw refusing programme gz %s", cc)
        return {}

    now = datetime.now(timezone.utc)
    ws = window_start if window_start is not None else (now - timedelta(hours=2)).timestamp()
    we = window_end if window_end is not None else (now + timedelta(hours=36)).timestamp()
    cache_path = cache_dir / f"prog_gz_{cc}.json"

    with _lock:
        if cache_path.is_file() and (time.time() - cache_path.stat().st_mtime) <= ttl_sec:
            try:
                payload = json.loads(cache_path.read_text(encoding="utf-8"))
                raw = payload.get("by_cid") if isinstance(payload, dict) else None
                if isinstance(raw, dict):
                    out: dict[str, list[dict[str, Any]]] = {}
                    for cid in wanted:
                        rows = raw.get(cid) or []
                        if not isinstance(rows, list):
                            continue
                        filtered = [
                            r
                            for r in rows
                            if float(r.get("stop") or 0) > ws
                            and float(r.get("start") or 0) < we
                        ]
                        if filtered:
                            out[cid] = filtered
                            if write_prog_cache:
                                write_prog_cache(cid, rows)
                    if out:
                        return out
            except Exception:
                pass

        url = COUNTRY_GZ.format(cc=cc)
        if not _url_allowed(url):
            log.warning("epgpw blocked programme URL %s", url)
            return {}

        target = FilteredProgrammeTarget(wanted, ws, we)
        parser = XMLParser(target=target)
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=max(fetch_timeout, 120)) as resp:
                with gzip.GzipFile(fileobj=resp) as gz:
                    while True:
                        chunk = gz.read(64 * 1024)
                        if not chunk:
                            break
                        parser.feed(chunk)
        except Exception as exc:
            log.warning("epgpw programme gz fetch failed %s: %s", cc, exc)
            return {}

        slim = {cid: rows for cid, rows in target.by_cid.items() if rows}
        try:
            cache_dir.mkdir(parents=True, exist_ok=True)
            tmp = cache_path.with_suffix(".json.part")
            tmp.write_text(
                json.dumps(
                    {
                        "fetched_at": time.time(),
                        "country": cc,
                        "wanted": sorted(wanted),
                        "by_cid": slim,
                    },
                    separators=(",", ":"),
                ),
                encoding="utf-8",
            )
            tmp.replace(cache_path)
        except Exception as exc:
            log.debug("epgpw prog gz cache write failed: %s", exc)
        if write_prog_cache:
            for cid, rows in slim.items():
                write_prog_cache(cid, rows)
        return {
            cid: [r for r in rows if float(r["stop"]) > ws and float(r["start"]) < we]
            for cid, rows in slim.items()
        }
