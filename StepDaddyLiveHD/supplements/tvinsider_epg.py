"""TV Insider network schedules as a polite EPG cross-match vote source.

Public pages (HTML, no private API):
  https://www.tvinsider.com/network/{slug}/
  https://www.tvinsider.com/network/{slug}/schedule/

Match-tool only — do not merge into the live gateway guide without an
explicit product decision. Cloudflare may challenge bare curl; use a
browser-like User-Agent, disk cache, and a low request rate.
"""

from __future__ import annotations

import html as html_lib
import json
import logging
import os
import re
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

log = logging.getLogger("supplements.tvinsider_epg")

BASE = "https://www.tvinsider.com"
UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 "
    "StepDaddy-epg-crossmatch/1.0 (+TVInsider schedule verify; low-rate)"
)
ET = ZoneInfo("America/New_York")

CACHE_DIR = Path(
    os.environ.get(
        "TVINSIDER_EPG_CACHE_DIR",
        str(Path(__file__).resolve().parents[2] / "data" / "tvinsider_epg"),
    )
)
CACHE_TTL_SEC = int(os.environ.get("TVINSIDER_EPG_CACHE_TTL_SEC", str(3 * 3600)))
ENABLED = os.environ.get("TVINSIDER_EPG_ENABLE", "1").strip().lower() not in (
    "0",
    "false",
    "no",
    "off",
)
MIN_FETCH_GAP_SEC = float(os.environ.get("TVINSIDER_EPG_MIN_GAP_SEC", "1.8"))
REQUEST_TIMEOUT_SEC = float(os.environ.get("TVINSIDER_EPG_TIMEOUT_SEC", "28"))

_fetch_lock = threading.Lock()
_last_fetch_mono = 0.0

_MARKER_RE = re.compile(r"[🅖🅨ⓈⒼⓎ]+")
_NORM_RE = re.compile(r"[^a-z0-9]+")
_SHOW_BLOCK_RE = re.compile(
    r'<a class="show-upcoming[^"]*"[^>]*>(.*?)</a>',
    re.I | re.S,
)
_TIME_RE = re.compile(r"<time[^>]*>\s*([^<]+?)\s*</time>", re.I)
_TITLE_RE = re.compile(r"<h3>(.*?)</h3>", re.I | re.S)
_EPISODE_RE = re.compile(r"<h[56]>(.*?)</h[56]>", re.I | re.S)

# High-confidence gateway name / alias → TV Insider /network/{slug}/.
# Only major US cable/broadcast where the slug is unambiguous.
NAME_TO_SLUG: dict[str, str] = {
    "cnn": "cnn",
    "cnn usa": "cnn",
    "a&e": "ae",
    "a&e usa": "ae",
    "ae": "ae",
    "history": "history-channel",
    "history usa": "history-channel",
    "history tv": "history-channel",
    "history channel": "history-channel",
    "freeform": "freeform",
    "syfy": "syfy",
    "syfy usa": "syfy",
    "abc": "abc",
    "cbs": "cbs",
    "nbc": "nbc",
    "fox": "fox",
    "the cw": "the-cw",
    "cw": "the-cw",
    "pbs": "pbs",
    "amc": "amc",
    "bbc america": "bbc-america",
    "bbc news": "bbc-news",
    "bet": "bet",
    "bravo": "bravo",
    "cartoon network": "cartoon-network",
    "cmt": "cmt",
    "cnbc": "cnbc",
    "comedy central": "comedy-central",
    "cooking channel": "cooking-channel",
    "destination america": "destination-america",
    "discovery": "discovery-channel",
    "discovery channel": "discovery-channel",
    "disney channel": "disney-channel",
    "disney xd": "disney-xd",
    "disney junior": "disney-junior",
    "e!": "e",
    "e": "e",
    "espn": "espn",
    "espn2": "espn2",
    "food network": "food-network",
    "fox business": "fox-business",
    "fox news": "fox-news",
    "fx": "fx",
    "fxx": "fxx",
    "fyi": "fyi",
    "game show network": "game-show-network",
    "gsn": "game-show-network",
    "hallmark channel": "hallmark-channel",
    "hgtv": "hgtv",
    "investigation discovery": "investigation-discovery",
    "lifetime": "lifetime",
    "mtv": "mtv",
    "mtv usa": "mtv",
    "national geographic": "nat-geo",
    "nat geo": "nat-geo",
    "nat geo wild": "nat-geo-wild",
    "nickelodeon": "nickelodeon",
    "nick jr": "nick-jr",
    "nick jr.": "nick-jr",
    "own": "own",
    "oxygen": "oxygen",
    "paramount network": "paramount-network",
    "science": "science-channel",
    "science channel": "science-channel",
    "smithsonian channel": "smithsonian-channel",
    "tbs": "tbs",
    "tlc": "tlc",
    "tnt": "tnt",
    "travel channel": "travel-channel",
    "trutv": "trutv",
    "tv land": "tv-land",
    "usa network": "usa-network",
    "usa": "usa-network",
    "vh1": "vh1",
    "vh1 usa": "vh1",
    "vice": "vice-tv",
    "vice tv": "vice-tv",
    "we tv": "we-tv",
    "weather channel": "the-weather-channel",
    "the weather channel": "the-weather-channel",
    "adult swim": "adult-swim",
    "animal planet": "animal-planet",
    "boomerang": "boomerang",
    "ifc": "ifc",
    "magnolia network": "magnolia-network",
    "pop tv": "pop-tv",
    "reelz": "reelz",
    "sundance": "sundance",
    "sundance tv": "sundance",
}

# tvg_id prefix / exact → slug (US XMLTV-style ids used by gateway map).
TVG_TO_SLUG: dict[str, str] = {
    "cnn.us": "cnn",
    "cnninternational.us": "cnn-international",
    "a.and.e.hd.east.us2": "ae",
    "aande.us": "ae",
    "ae.us": "ae",
    "history.us": "history-channel",
    "freeform.us": "freeform",
    "syfy.us": "syfy",
    "abc.us": "abc",
    "cbs.us": "cbs",
    "nbc.us": "nbc",
    "fox.us": "fox",
    "amc.us": "amc",
    "bbcamerica.us": "bbc-america",
    "bet.us": "bet",
    "bravo.us": "bravo",
    "cartoonnetwork.us": "cartoon-network",
    "cmt.us": "cmt",
    "cnbc.us": "cnbc",
    "comedycentral.us": "comedy-central",
    "cookingchannel.us": "cooking-channel",
    "destinationamerica.us": "destination-america",
    "discoverychannel.us": "discovery-channel",
    "disneychannel.us": "disney-channel",
    "disneyxd.us": "disney-xd",
    "e.us": "e",
    "espn.us": "espn",
    "espn2.us": "espn2",
    "foodnetwork.us": "food-network",
    "foxbusinessnetwork.us": "fox-business",
    "foxnewschannel.us": "fox-news",
    "fx.us": "fx",
    "fxx.us": "fxx",
    "fyi.us": "fyi",
    "gameseshownetwork.us": "game-show-network",
    "hallmarkchannel.us": "hallmark-channel",
    "hgtv.us": "hgtv",
    "investigationdiscovery.us": "investigation-discovery",
    "lifetimenetwork.us": "lifetime",
    "mtv.us": "mtv",
    "nationalgeographic.us": "nat-geo",
    "nickjr.us": "nick-jr",
    "own.us": "own",
    "paramountnetwork.us": "paramount-network",
    "science.us": "science-channel",
    "smithsonianchannel.us": "smithsonian-channel",
    "tbs.us": "tbs",
    "tlc.us": "tlc",
    "tnt.us": "tnt",
    "travelchannel.us": "travel-channel",
    "trutv.us": "trutv",
    "usanetwork.us": "usa-network",
    "vh1.us": "vh1",
    "vicetv.us": "vice-tv",
    "adultswim.us": "adult-swim",
    "animalplanet.us": "animal-planet",
    "boomerang.us": "boomerang",
    "ifc.us": "ifc",
    "magnolianetwork.us": "magnolia-network",
    "poptv.us": "pop-tv",
    "reelz.us": "reelz",
    "sundancetv.us": "sundance",
    "theweatherchannel.us": "the-weather-channel",
}

def enabled() -> bool:
    return bool(ENABLED)


def norm_name(name: str) -> str:
    s = (name or "").lower()
    s = _MARKER_RE.sub(" ", s)
    s = re.sub(r"\([^)]*\)", " ", s)
    s = s.replace("&", " and ")
    s = s.replace("+", " plus ")
    s = re.sub(
        r"\b(usa|us|uk|ca|hd|fhd|4k|sd|tv|channel|live|east|west|pacific)\b",
        " ",
        s,
    )
    s = _NORM_RE.sub(" ", s)
    return re.sub(r"\s+", " ", s).strip()


def norm_title(s: str | None) -> str:
    s = (s or "").lower()
    s = re.sub(r"^(live:\s*|new:\s*)", "", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def title_similarity(a: str | None, b: str | None) -> float:
    na, nb = norm_title(a), norm_title(b)
    if not na or not nb:
        return 0.0
    if na == nb or na in nb or nb in na:
        return 1.0
    return SequenceMatcher(None, na, nb).ratio()


def resolve_slug(
    channel_name: str | None = None,
    *,
    tvg_id: str | None = None,
    explicit: str | None = None,
) -> str | None:
    """Map gateway channel → TV Insider slug when high-confidence only."""
    if explicit:
        slug = explicit.strip().lower().strip("/")
        return slug or None

    if tvg_id:
        key = tvg_id.strip().lower()
        if key in TVG_TO_SLUG:
            return TVG_TO_SLUG[key]
        # Strip @feed / region suffixes: Freeform.us@East
        base = key.split("@", 1)[0]
        if base in TVG_TO_SLUG:
            return TVG_TO_SLUG[base]

    raw = (channel_name or "").strip().lower()
    if not raw:
        return None
    # Prefer exact alias keys before aggressive stripping (keeps "a&e").
    if raw in NAME_TO_SLUG:
        return NAME_TO_SLUG[raw]
    raw_amp = raw.replace(" and ", " & ")
    if raw_amp in NAME_TO_SLUG:
        return NAME_TO_SLUG[raw_amp]

    n = norm_name(channel_name or "")
    # Rebuild a few special cases after norm ("a and e" → a&e lookup)
    if n in ("a and e", "a e"):
        return "ae"
    if n in NAME_TO_SLUG:
        return NAME_TO_SLUG[n]
    # Try with "channel" restored for History Channel style names already stripped
    for cand in (n, f"{n} channel", f"{n} network"):
        if cand in NAME_TO_SLUG:
            return NAME_TO_SLUG[cand]
    return None


def _cache_path(slug: str, kind: str) -> Path:
    safe = re.sub(r"[^a-z0-9-]+", "-", slug.lower()).strip("-") or "unknown"
    return CACHE_DIR / f"{safe}.{kind}.html"


def _read_cache(path: Path) -> str | None:
    if not path.is_file():
        return None
    age = time.time() - path.stat().st_mtime
    if age > CACHE_TTL_SEC:
        return None
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return None


def _write_cache(path: Path, body: str) -> None:
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".part")
        tmp.write_text(body, encoding="utf-8")
        tmp.replace(path)
    except Exception as exc:
        log.debug("tvinsider cache write failed %s: %s", path, exc)


def _rate_limit() -> None:
    global _last_fetch_mono
    with _fetch_lock:
        now = time.monotonic()
        wait = MIN_FETCH_GAP_SEC - (now - _last_fetch_mono)
        if wait > 0:
            time.sleep(wait)
        _last_fetch_mono = time.monotonic()


def _http_get(url: str) -> tuple[int, str]:
    _rate_limit()
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": f"{BASE}/network/",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SEC) as resp:
            code = int(getattr(resp, "status", 200) or 200)
            raw = resp.read()
            text = raw.decode("utf-8", errors="replace")
            if "cf-mitigated" in (resp.headers.get("cf-mitigated") or "") or (
                code == 403 and "Just a moment" in text
            ):
                return 403, text
            return code, text
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        return int(e.code), body
    except Exception as e:
        raise RuntimeError(f"tvinsider fetch failed {url}: {e}") from e


def _strip_tags(chunk: str) -> str:
    text = re.sub(r"<[^>]+>", " ", chunk or "")
    text = html_lib.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _parse_wall_time(text: str) -> tuple[int, int] | None:
    m = re.match(r"^\s*(\d{1,2}):(\d{2})\s*([AP]M)\s*$", (text or "").strip(), re.I)
    if not m:
        return None
    hour = int(m.group(1))
    minute = int(m.group(2))
    ampm = m.group(3).upper()
    if hour == 12:
        hour = 0
    if ampm == "PM":
        hour += 12
    return hour, minute


def _parse_day_id(day_id: str) -> datetime | None:
    # id="09-07-2026" → MM-DD-YYYY
    try:
        return datetime.strptime(day_id, "%m-%d-%Y").replace(tzinfo=ET)
    except Exception:
        return None


def _parse_day_label(label: str) -> datetime | None:
    # "Monday, September 7" — year inferred from nearby id when possible
    label = (label or "").strip()
    for fmt in ("%A, %B %d, %Y", "%A, %B %d"):
        try:
            dt = datetime.strptime(label, fmt)
            if dt.year == 1900:
                return None
            return dt.replace(tzinfo=ET)
        except Exception:
            continue
    return None


def parse_schedule_html(html: str, *, slug: str, source_url: str) -> list[dict[str, Any]]:
    """Parse TV Insider schedule or network 'Live TV' grids into programmes."""
    if not html:
        return []

    # Prefer dated schedule sections when present.
    parts = re.split(r'(?=<h2[^>]*class="date")', html, flags=re.I)
    rows: list[dict[str, Any]] = []
    if len(parts) > 1:
        for part in parts[1:]:
            day_dt: datetime | None = None
            m = re.search(
                r'<h2[^>]*\bid="(\d{2}-\d{2}-\d{4})"[^>]*>',
                part,
                re.I,
            )
            if m:
                day_dt = _parse_day_id(m.group(1))
            if day_dt is None:
                m2 = re.search(r'<h2[^>]*class="date"[^>]*>\s*([^<]+)\s*</h2>', part, re.I)
                if m2:
                    day_dt = _parse_day_label(m2.group(1))
            if day_dt is None:
                continue
            rows.extend(_parse_blocks(part, day_dt=day_dt, slug=slug, source_url=source_url))
    else:
        # Network landing "Live TV On … Now" — assume America/New_York calendar day,
        # rolling past midnight when times decrease.
        now_et = datetime.now(ET)
        day_dt = now_et.replace(hour=0, minute=0, second=0, microsecond=0)
        rows = _parse_blocks(html, day_dt=day_dt, slug=slug, source_url=source_url, roll_midnight=True)

    rows.sort(key=lambda r: r["start"])
    # Fill stop from next start when missing
    for i, row in enumerate(rows):
        if row.get("stop"):
            continue
        if i + 1 < len(rows):
            row["stop"] = rows[i + 1]["start"]
        else:
            st = datetime.fromisoformat(row["start"])
            row["stop"] = (st + timedelta(hours=1)).isoformat()
    return rows


def _parse_blocks(
    html: str,
    *,
    day_dt: datetime,
    slug: str,
    source_url: str,
    roll_midnight: bool = False,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    last_minutes: int | None = None
    day = day_dt
    for block in _SHOW_BLOCK_RE.findall(html):
        tm = _TIME_RE.search(block)
        th = _TITLE_RE.search(block)
        if not tm or not th:
            continue
        wall = _parse_wall_time(tm.group(1))
        if not wall:
            continue
        hour, minute = wall
        title = _strip_tags(th.group(1))
        title = re.sub(r"\s+New\s*$", "", title).strip()
        if not title:
            continue
        mins = hour * 60 + minute
        if roll_midnight and last_minutes is not None and mins < last_minutes - 6 * 60:
            # crossed into next calendar morning
            day = day + timedelta(days=1)
        last_minutes = mins
        start = day.replace(hour=hour, minute=minute, second=0, microsecond=0)
        ep = _EPISODE_RE.search(block)
        episode = _strip_tags(ep.group(1)) if ep else ""
        out.append(
            {
                "title": title,
                "episode": episode or None,
                "start": start.astimezone(timezone.utc).isoformat(),
                "stop": None,
                "slug": slug,
                "source": "tvinsider",
                "source_url": source_url,
            }
        )
    return out


def fetch_network_schedule(slug: str, *, prefer_full: bool = True) -> dict[str, Any]:
    """Fetch + parse schedule for a slug. Uses disk cache; polite rate limit."""
    slug = (slug or "").strip().lower().strip("/")
    if not slug:
        return {"ok": False, "error": "empty_slug", "programmes": []}

    urls: list[tuple[str, str]] = []
    if prefer_full:
        urls.append(("schedule", f"{BASE}/network/{slug}/schedule/"))
    urls.append(("network", f"{BASE}/network/{slug}/"))

    last_err = None
    for kind, url in urls:
        path = _cache_path(slug, kind)
        body = _read_cache(path)
        from_cache = body is not None
        if body is None:
            try:
                code, body = _http_get(url)
            except Exception as e:
                last_err = str(e)
                continue
            if code >= 400 or "Just a moment" in (body or "")[:2000]:
                last_err = f"http_{code}"
                # stale cache fallback
                if path.is_file():
                    try:
                        body = path.read_text(encoding="utf-8")
                        from_cache = True
                        log.warning("tvinsider using stale cache for %s (%s)", slug, last_err)
                    except Exception:
                        continue
                else:
                    continue
            else:
                _write_cache(path, body)
        programmes = parse_schedule_html(body, slug=slug, source_url=url)
        if programmes:
            return {
                "ok": True,
                "slug": slug,
                "url": url,
                "kind": kind,
                "from_cache": from_cache,
                "programmes": programmes,
                "count": len(programmes),
            }
        last_err = last_err or "no_programmes"
    return {
        "ok": False,
        "slug": slug,
        "error": last_err or "fetch_failed",
        "programmes": [],
    }


def find_now(
    programmes: list[dict[str, Any]],
    *,
    when: datetime | None = None,
) -> dict[str, Any] | None:
    when = when or datetime.now(timezone.utc)
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    current = None
    for p in programmes:
        try:
            st = datetime.fromisoformat(p["start"].replace("Z", "+00:00"))
            en = datetime.fromisoformat((p.get("stop") or p["start"]).replace("Z", "+00:00"))
        except Exception:
            continue
        if st <= when < en:
            current = p
            break
    return current


def schedule_window_hits(
    programmes: list[dict[str, Any]],
    query: str,
    *,
    center: datetime | None = None,
    hours: float = 12.0,
) -> list[dict[str, Any]]:
    if not query or not programmes:
        return []
    center = center or datetime.now(timezone.utc)
    lo = center - timedelta(hours=hours)
    hi = center + timedelta(hours=hours)
    hits: list[dict[str, Any]] = []
    for p in programmes:
        title = p.get("title") or ""
        try:
            st = datetime.fromisoformat(str(p.get("start")).replace("Z", "+00:00"))
        except Exception:
            continue
        if st < lo or st > hi:
            continue
        score = title_similarity(query, title)
        if score >= 0.72:
            hits.append(
                {
                    "title": title,
                    "start": p.get("start"),
                    "stop": p.get("stop"),
                    "score": round(score, 3),
                    "delta_hours": round((st - center).total_seconds() / 3600.0, 2),
                }
            )
    hits.sort(key=lambda x: (-x["score"], abs(x["delta_hours"] or 99)))
    return hits[:8]


def crossmatch_vote(
    *,
    channel_name: str,
    tvg_id: str | None = None,
    gateway_now_title: str | None = None,
    gateway_programmes: list[dict[str, Any]] | None = None,
    ocr_text: str | None = None,
    explicit_slug: str | None = None,
    window_hours: float = 12.0,
) -> dict[str, Any]:
    """Compare TV Insider schedule to gateway EPG; return an advisory vote.

    Votes: yes | no | offset_suspect | wrong_feed | uncertain | skipped | no_data
    """
    out: dict[str, Any] = {
        "source": "tvinsider",
        "enabled": enabled(),
        "vote": "skipped",
        "slug": None,
        "now_title": None,
        "now_start": None,
        "similarity_to_gateway_now": 0.0,
        "notes": "",
        "schedule_hits": [],
    }
    if not enabled():
        out["notes"] = "TVINSIDER_EPG_ENABLE off"
        return out

    slug = resolve_slug(channel_name, tvg_id=tvg_id, explicit=explicit_slug)
    out["slug"] = slug
    if not slug:
        out["vote"] = "no_data"
        out["notes"] = "no high-confidence TV Insider slug"
        return out

    fetched = fetch_network_schedule(slug)
    out["fetch"] = {
        "ok": fetched.get("ok"),
        "kind": fetched.get("kind"),
        "from_cache": fetched.get("from_cache"),
        "count": fetched.get("count") or len(fetched.get("programmes") or []),
        "url": fetched.get("url"),
        "error": fetched.get("error"),
    }
    programmes = list(fetched.get("programmes") or [])
    if not programmes:
        out["vote"] = "no_data"
        out["notes"] = f"no TV Insider programmes ({fetched.get('error') or 'empty'})"
        return out

    ti_now = find_now(programmes)
    if not ti_now:
        out["vote"] = "uncertain"
        out["notes"] = "TV Insider schedule loaded but no current slot"
        out["programmes_preview"] = [
            {"title": p.get("title"), "start": p.get("start")} for p in programmes[:4]
        ]
        return out

    out["now_title"] = ti_now.get("title")
    out["now_start"] = ti_now.get("start")
    out["now_stop"] = ti_now.get("stop")
    out["now_episode"] = ti_now.get("episode")

    gw_now = gateway_now_title or ""
    sim = title_similarity(gw_now, ti_now.get("title"))
    out["similarity_to_gateway_now"] = round(sim, 3)

    # OCR soft wrong-feed: OCR looks like TI now, not like gateway now
    if ocr_text:
        ocr_blob = re.sub(r"\s+", " ", ocr_text)[:160]
        ocr_ti = title_similarity(ocr_blob, ti_now.get("title"))
        ocr_gw = title_similarity(ocr_blob, gw_now) if gw_now else 0.0
        out["ocr_similarity_ti"] = round(ocr_ti, 3)
        out["ocr_similarity_gateway"] = round(ocr_gw, 3)
        if ocr_ti >= 0.82 and ocr_gw < 0.55 and sim < 0.55:
            out["vote"] = "wrong_feed"
            out["notes"] = (
                f"OCR≈TV Insider now '{ti_now.get('title')}' but not gateway now '{gw_now}'"
            )
            return out

    if gw_now and sim >= 0.82:
        out["vote"] = "yes"
        out["notes"] = f"TV Insider now agrees with gateway (score={sim:.2f})"
        return out

    # ±12h: does TI now title appear elsewhere on gateway schedule?
    gw_progs = gateway_programmes or []
    hits = schedule_window_hits(
        gw_progs, str(ti_now.get("title") or ""), hours=window_hours
    )
    out["schedule_hits"] = hits
    if hits and hits[0]["score"] >= 0.82 and abs(hits[0].get("delta_hours") or 0) >= 0.4:
        out["vote"] = "offset_suspect"
        hit = hits[0]
        out["notes"] = (
            f"TV Insider now '{ti_now.get('title')}' matches gateway schedule "
            f"@ {hit['delta_hours']:+.1f}h (score={hit['score']})"
        )
        return out

    if gw_now and sim < 0.55:
        out["vote"] = "no"
        out["notes"] = (
            f"TV Insider now '{ti_now.get('title')}' ≠ gateway now '{gw_now}' "
            f"(score={sim:.2f})"
        )
        return out

    if not gw_now:
        out["vote"] = "uncertain"
        out["notes"] = f"TV Insider now '{ti_now.get('title')}' but gateway EPG empty"
        return out

    out["vote"] = "uncertain"
    out["notes"] = f"Partial title overlap score={sim:.2f}"
    return out


def apply_vote_to_match(match: str, vote: dict[str, Any]) -> tuple[str, str]:
    """Optionally adjust crossmatch label using TV Insider advisory vote.

    Returns (match, note_suffix). Never invents WRONG_FEED from TI alone unless
    the vote itself is wrong_feed (OCR-backed).
    """
    v = (vote or {}).get("vote") or "skipped"
    note = (vote or {}).get("notes") or ""
    if v in ("skipped", "no_data"):
        return match, ""
    suffix = f" | TVInsider:{v}" + (f" — {note}" if note else "")

    if v == "wrong_feed" and match not in ("WRONG_FEED",):
        return "WRONG_FEED", suffix
    if v == "offset_suspect" and match in ("yes", "uncertain", "no", "pending", "no_epg"):
        # Surface skew explicitly; don't override a hard WRONG_FEED.
        if match == "yes":
            return "offset_suspect", suffix + " (downgraded: TI offset vs gateway now)"
        return "offset_suspect", suffix
    if v == "yes" and match == "uncertain":
        return "uncertain", suffix  # reinforce only in notes
    if v == "no" and match == "yes":
        return "uncertain", suffix + " (TI disagrees with gateway now)"
    return match, suffix


def dump_mapping_stats() -> dict[str, Any]:
    return {
        "name_aliases": len(NAME_TO_SLUG),
        "tvg_aliases": len(TVG_TO_SLUG),
        "cache_dir": str(CACHE_DIR),
        "cache_ttl_sec": CACHE_TTL_SEC,
        "enabled": enabled(),
        "min_gap_sec": MIN_FETCH_GAP_SEC,
    }


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser(description="TV Insider EPG helper")
    ap.add_argument("--slug", default="")
    ap.add_argument("--name", default="")
    ap.add_argument("--tvg-id", default="")
    ap.add_argument("--gateway-now", default="")
    ap.add_argument("--stats", action="store_true")
    args = ap.parse_args()
    if args.stats:
        print(json.dumps(dump_mapping_stats(), indent=2))
        raise SystemExit(0)
    slug = resolve_slug(args.name, tvg_id=args.tvg_id or None, explicit=args.slug or None)
    print("slug", slug)
    if slug:
        vote = crossmatch_vote(
            channel_name=args.name or slug,
            tvg_id=args.tvg_id or None,
            gateway_now_title=args.gateway_now or None,
            explicit_slug=slug,
        )
        print(json.dumps(vote, indent=2)[:4000])
