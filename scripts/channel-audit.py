#!/usr/bin/env python3
"""Single-channel gapless audit for StepDaddyLiveHD.

Fills docs/channel-audit schema fields automatically from the gateway.
Human-only fields stay marked (visual EPG match, paint-death, TiviMate UI #, etc.).

Never prints or stores PINs, cookies, share tokens, or full signed /content/ URLs.
Hosts and path kinds only.

Examples:
  python3 scripts/channel-audit.py 343
  python3 scripts/channel-audit.py 51 --probe-media --grab-frame --md
  python3 scripts/channel-audit.py 343 --gateway https://sdgateway.duckdns.org
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_PATH = ROOT / "docs" / "channel-audit" / "template" / "channel-audit.template.json"
DEFAULT_OUT = ROOT / "docs" / "channel-audit" / "examples"
DEFAULT_GATEWAY = os.environ.get("SD_GATEWAY", "https://sdgateway.duckdns.org").rstrip("/")
UA = "StepDaddy-channel-audit/1.2.0"
TOOL_VERSION = "1.2.0"

# Confirmed-case registry + correction playbook (learns from visually_confirmed repairs).
sys.path.insert(0, str(ROOT / "scripts"))
try:
    import epg_correction as epg_corr  # noqa: E402
except ImportError:  # pragma: no cover
    epg_corr = None  # type: ignore

TOP_NETWORK_NAME_RE = re.compile(
    r"\b(espn|cnn|fox news|msnbc|usa\b|tnt\b|tbs\b|hbo|showtime|amc\b|fx\b|"
    r"discovery|history|nat(?:ional)?\s*geo|nbc|abc|cbs|food network|hgtv|"
    r"cartoon network|disney|mtv|comedy central|syfy|paramount|lifetime|"
    r"hallmark|nhl|nba|nfl network|golf channel|fs1|fox sports)\b",
    re.I,
)
ADULT_TAG_RE = re.compile(r"(adult|xxx|porn|nsfw)", re.I)
STREAM_INF_RE = re.compile(
    r"#EXT-X-STREAM-INF:([^\n]+)\n([^\n#]+)",
    re.M,
)
ATTR_RE = re.compile(r'([A-Z0-9\-]+)=("([^"]*)"|([^,]*))')


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def rel_or_abs(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(ROOT))
    except ValueError:
        return str(path.resolve())


def host_only(url: str | None) -> str | None:
    if not url:
        return None
    try:
        p = urlparse(url if "://" in url else f"https://{url}")
        return p.hostname
    except Exception:
        return None


def redact_url_kind(url: str | None, gateway: str) -> str | None:
    """Classify URL without retaining signed tokens."""
    if not url:
        return None
    u = url.strip()
    if "/content/" in u:
        return f"{gateway}/content/{{token}}"
    if u.startswith("/content/"):
        return "/content/{token}"
    if u.startswith("http"):
        h = host_only(u)
        path = urlparse(u).path
        ext = Path(path).suffix or ""
        return f"https://{h}/…{ext}" if h else "https://{cdn}/…"
    if u.startswith("/"):
        return u.split("?")[0]
    return "{opaque}"


def http_get(
    url: str,
    *,
    timeout: float = 25,
    method: str = "GET",
    max_bytes: int | None = None,
) -> tuple[int, bytes, dict[str, str]]:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": UA, "Accept": "*/*"},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            code = int(getattr(resp, "status", 200) or 200)
            headers = {k.lower(): v for k, v in resp.headers.items()}
            data = resp.read(max_bytes) if max_bytes else resp.read()
            return code, data, headers
    except urllib.error.HTTPError as e:
        body = e.read() if hasattr(e, "read") else b""
        headers = {k.lower(): v for k, v in (e.headers.items() if e.headers else [])}
        return int(e.code), body, headers
    except Exception as e:
        raise RuntimeError(f"{type(e).__name__}:{e}") from e


def http_json(url: str, *, timeout: float = 30) -> tuple[int, Any]:
    code, raw, _ = http_get(url, timeout=timeout)
    if not raw:
        return code, None
    try:
        return code, json.loads(raw.decode("utf-8", errors="replace"))
    except Exception:
        return code, None


def parse_attrs(blob: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for m in ATTR_RE.finditer(blob or ""):
        key = m.group(1)
        val = m.group(3) if m.group(3) is not None else (m.group(4) or "")
        out[key] = val
    return out


def parse_resolution(res: str | None) -> tuple[int | None, int | None]:
    if not res or "x" not in res.lower():
        return None, None
    try:
        w, h = res.lower().split("x", 1)
        return int(w), int(h)
    except Exception:
        return None, None


def parse_fps(val: str | None) -> float | None:
    if not val:
        return None
    try:
        return float(val)
    except Exception:
        return None


def parse_ladder(playlist_text: str, gateway: str) -> list[dict[str, Any]]:
    rungs: list[dict[str, Any]] = []
    for m in STREAM_INF_RE.finditer(playlist_text):
        attrs = parse_attrs(m.group(1))
        uri = (m.group(2) or "").strip()
        w, h = parse_resolution(attrs.get("RESOLUTION"))
        kind = "unknown"
        if "/content/" in uri or uri.startswith("/content/"):
            kind = "content_proxy"
        elif uri.startswith("http"):
            kind = "direct_cdn"
        elif uri.startswith("/"):
            kind = "relative"
        rungs.append(
            {
                "bandwidth_bps": int(attrs["BANDWIDTH"]) if attrs.get("BANDWIDTH", "").isdigit() else None,
                "avg_bandwidth_bps": int(attrs["AVERAGE-BANDWIDTH"])
                if attrs.get("AVERAGE-BANDWIDTH", "").isdigit()
                else None,
                "resolution": attrs.get("RESOLUTION"),
                "width": w,
                "height": h,
                "frame_rate": parse_fps(attrs.get("FRAME-RATE")),
                "codecs": attrs.get("CODECS"),
                "uri_kind": kind,
            }
        )
    return rungs


def playlist_kind(text: str) -> str:
    if "#EXT-X-STREAM-INF" in text:
        return "hls_master"
    if "#EXTINF" in text:
        if "#EXT-X-MAP" in text:
            return "fmp4"
        return "hls_media"
    if text.lstrip().startswith("<") or "<html" in text.lower():
        return "embed_html"
    return "unknown"


def segment_urls(text: str) -> list[str]:
    urls: list[str] = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        urls.append(line)
    return urls


def mpegts_heuristics(data: bytes) -> tuple[bool | None, bool | None, str | None]:
    if not data:
        return None, None, None
    if data[0:1] == b"\x47":
        sync = data[0] == 0x47
        mod = (len(data) % 188) == 0
        return sync, mod, "mpegts"
    if data[4:8] == b"ftyp":
        return None, None, "fmp4"
    if data.startswith(b"\x00\x00\x00") and b"ftyp" in data[:64]:
        return None, None, "fmp4"
    return None, None, "unknown"


def codecs_from_string(codecs: str | None) -> tuple[str | None, str | None]:
    if not codecs:
        return None, None
    parts = [p.strip() for p in codecs.split(",") if p.strip()]
    video = audio = None
    for p in parts:
        pl = p.lower()
        if pl.startswith("avc1") or pl.startswith("hvc1") or pl.startswith("hev1") or pl.startswith("av01"):
            video = p
        elif pl.startswith("mp4a") or pl.startswith("ac-3") or pl.startswith("ec-3"):
            audio = p
    return video, audio


def avc_profile_level(avc: str | None) -> tuple[str | None, float | None]:
    """Map avc1.PPCCLL → rough profile name + level."""
    if not avc or not avc.lower().startswith("avc1."):
        return None, None
    hexpart = avc.split(".", 1)[1]
    if len(hexpart) < 6:
        return None, None
    try:
        profile_idc = int(hexpart[0:2], 16)
        level_idc = int(hexpart[4:6], 16)
    except Exception:
        return None, None
    profiles = {66: "Baseline", 77: "Main", 100: "High", 110: "High10", 122: "High422"}
    profile = profiles.get(profile_idc, f"idc_{profile_idc}")
    level = level_idc / 10.0
    return profile, level


def aspect_ratio(w: int | None, h: int | None) -> str | None:
    if not w or not h:
        return None
    from math import gcd

    g = gcd(w, h)
    return f"{w // g}:{h // g}"


def load_template() -> dict[str, Any]:
    return copy.deepcopy(json.loads(TEMPLATE_PATH.read_text(encoding="utf-8")))


def find_channel(channels: list[dict[str, Any]], cid: str) -> dict[str, Any] | None:
    for c in channels:
        if str(c.get("id")) == str(cid):
            return c
    return None


def sibling_and_alias_search(
    gateway: str, cid: str, name: str
) -> tuple[list[str], list[str]]:
    aliases: list[str] = []
    siblings: list[str] = []
    # Search by significant tokens from name
    tokens = [t for t in re.split(r"\s+", name) if len(t) >= 3][:3]
    q = " ".join(tokens[:2]) if tokens else name
    if not q:
        return aliases, siblings
    try:
        code, data = http_json(
            f"{gateway}/channels/search?q={urllib.parse.quote(q)}", timeout=25
        )
    except Exception:
        return aliases, siblings
    if code >= 400 or not isinstance(data, list):
        return aliases, siblings
    base = re.sub(r"\s+(usa|uk|us)$", "", name.strip(), flags=re.I).strip().lower()
    for row in data:
        rid = str(row.get("id"))
        rname = str(row.get("name") or "")
        if rid == str(cid):
            continue
        if rname and rname not in aliases:
            # Same brand family
            rbase = re.sub(r"\s+(usa|uk|us)$", "", rname.strip(), flags=re.I).strip().lower()
            if base and (base in rbase or rbase in base or base.split()[0] in rbase):
                aliases.append(rname)
                siblings.append(rid)
    return aliases[:12], siblings[:12]


def region_language_hints(tags: list[str], tvg_id: str | None, name: str) -> tuple[str | None, str | None]:
    region = None
    lang = None
    flag_map = {
        "🇺🇸": "US",
        "🇬🇧": "UK",
        "🇨🇦": "CA",
        "🇦🇺": "AU",
        "🇩🇪": "DE",
        "🇫🇷": "FR",
        "🇪🇸": "ES",
        "🇮🇹": "IT",
        "🇲🇽": "MX",
        "🇧🇷": "BR",
        "🇮🇳": "IN",
    }
    for t in tags:
        if t in flag_map:
            region = flag_map[t]
            break
    if tvg_id and "." in tvg_id:
        region = region or tvg_id.rsplit(".", 1)[-1].upper()
    nl = name.lower()
    if nl.endswith(" uk") or ".uk" in (tvg_id or "").lower():
        lang = lang or "en-GB"
    if nl.endswith(" usa") or nl.endswith(" us") or (tvg_id or "").endswith(".us"):
        lang = lang or "en-US"
    if region == "US":
        lang = lang or "en-US"
    if region == "UK":
        lang = lang or "en-GB"
    return region, lang


def map_epg_source(method: str | None) -> str | None:
    if not method:
        return None
    m = method.lower()
    if "epgpw" in m:
        return "epgpw"
    if "woftv" in m:
        return "woftv"
    if "pluto" in m:
        return "pluto"
    if "android" in m:
        return "android_id_map"
    if "tvinsider" in m or "tv_insider" in m:
        return "tvinsider"
    if "xmltv" in m:
        return "xmltv"
    if m in ("none", "unmapped", "empty"):
        return "none"
    return "unknown"


def _ffmpeg_bin() -> str:
    for cand in ("/usr/bin/ffmpeg", "/bin/ffmpeg", "ffmpeg"):
        if cand.startswith("/") and not Path(cand).exists():
            continue
        return cand
    return "ffmpeg"


def _ffprobe_bin() -> str:
    for cand in ("/usr/bin/ffprobe", "/bin/ffprobe", "ffprobe"):
        if cand.startswith("/") and not Path(cand).exists():
            continue
        return cand
    return "ffprobe"


def ffprobe_bytes(data: bytes) -> tuple[bool, dict[str, Any], str | None]:
    if not data:
        return False, {}, "empty_segment"
    ff = _ffprobe_bin()
    with tempfile.NamedTemporaryFile(suffix=".ts", delete=False) as tmp:
        tmp.write(data)
        path = tmp.name
    try:
        cmd = [
            ff,
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_streams",
            "-show_format",
            path,
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30, check=False)
        if proc.returncode != 0:
            err = (proc.stderr or proc.stdout or "ffprobe_failed").strip().splitlines()
            return False, {}, (err[-1][:240] if err else "ffprobe_failed")
        payload = json.loads(proc.stdout or "{}")
        return True, payload, None
    except FileNotFoundError:
        return False, {}, "ffprobe_missing"
    except Exception as e:
        return False, {}, f"{type(e).__name__}:{e}"
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def apply_ffprobe(record: dict[str, Any], probe: dict[str, Any]) -> None:
    streams = probe.get("streams") or []
    v = next((s for s in streams if s.get("codec_type") == "video"), None)
    a = next((s for s in streams if s.get("codec_type") == "audio"), None)
    codecs = record["stream"]["codecs"]
    picture = record["stream"]["picture"]
    if v:
        codecs["video_codec"] = v.get("codec_name") or codecs.get("video_codec")
        codecs["video_profile"] = v.get("profile") or codecs.get("video_profile")
        try:
            codecs["video_level"] = float(v["level"]) / 10.0 if v.get("level") and int(v["level"]) > 30 else (
                float(v["level"]) if v.get("level") is not None else codecs.get("video_level")
            )
        except Exception:
            pass
        # ffprobe H.264 level is often 40 meaning 4.0
        if v.get("level") is not None:
            try:
                lvl = int(v["level"])
                codecs["video_level"] = lvl / 10.0 if lvl >= 10 else float(lvl)
            except Exception:
                pass
        codecs["pix_fmt"] = v.get("pix_fmt")
        codecs["has_b_frames"] = v.get("has_b_frames")
        picture["width"] = v.get("width") or picture.get("width")
        picture["height"] = v.get("height") or picture.get("height")
        fr = v.get("avg_frame_rate") or v.get("r_frame_rate")
        if fr and isinstance(fr, str) and "/" in fr:
            num, den = fr.split("/", 1)
            try:
                if float(den) != 0:
                    picture["fps"] = round(float(num) / float(den), 3)
            except Exception:
                pass
        fo = (v.get("field_order") or "").lower()
        if fo in ("progressive", "unknown", ""):
            picture["scan_type"] = "progressive" if fo == "progressive" or not fo else "unknown"
        elif "inter" in fo or fo in ("tt", "bb", "tb", "bt"):
            picture["scan_type"] = "interlaced"
        else:
            picture["scan_type"] = "unknown"
        picture["aspect_ratio"] = aspect_ratio(picture.get("width"), picture.get("height"))
    if a:
        codecs["audio_codec"] = a.get("codec_name") or codecs.get("audio_codec")
        codecs["audio_profile"] = a.get("profile") or codecs.get("audio_profile")
    fmt = probe.get("format") or {}
    if fmt.get("bit_rate"):
        try:
            picture["bitrate_bps"] = int(fmt["bit_rate"])
        except Exception:
            pass
    if fmt.get("format_name"):
        record["stream"]["segment_sample"]["container"] = str(fmt["format_name"]).split(",")[0]


def grab_frame(playlist_url: str, dest: Path, timeout_sec: float = 28) -> tuple[bool, str]:
    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        _ffmpeg_bin(),
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-user_agent",
        UA,
        "-rw_timeout",
        "15000000",
        "-i",
        playlist_url,
        "-map",
        "0:v:0",
        "-frames:v",
        "1",
        "-q:v",
        "3",
        str(dest),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_sec, check=False)
    except subprocess.TimeoutExpired:
        dest.unlink(missing_ok=True)
        return False, "ffmpeg_timeout"
    except FileNotFoundError:
        return False, "ffmpeg_missing"
    if proc.returncode != 0 or not dest.exists() or dest.stat().st_size < 800:
        dest.unlink(missing_ok=True)
        err = (proc.stderr or "").strip().splitlines()
        return False, (err[-1][:240] if err else f"ffmpeg_exit_{proc.returncode}")
    return True, f"frame_bytes={dest.stat().st_size}"


# Overnight / early-morning US network titles vs daytime entertainment.
# Used to catch false-UTC / wrong-feed EPG (e.g. ABC World News Now at 11am ET).
_OVERNIGHT_TITLE_RE = re.compile(
    r"\b("
    r"world news now|nightline|jimmy kimmel|late\s*night|after\s*midnight|"
    r"overnight|news now|first look"
    r")\b",
    re.I,
)
_DAYTIME_TITLE_RE = re.compile(
    r"\b("
    r"the view|general hospital|gma3|good morning america(?!\s+first\s+look)|"
    r"oprah|live with|the talk|kelly and"
    r")\b",
    re.I,
)


def assess_epg_match_status(epg: dict[str, Any], region_hint: str | None) -> dict[str, Any]:
    """Derive epg_match_status without trusting non-empty now/next alone.

    Returns keys: epg_match_status, daypart_hint, daypart_plausible, timezone_notes, wrong_feed_suspect.
    """
    visual = (epg.get("visual_epg_match") or "not_checked").strip().lower()
    has_data = bool(epg.get("epg_has_data"))
    title = (epg.get("now_title") or "").strip()
    notes = [
        "EPG timestamps are UTC ISO-8601 from gateway; confirm local guide TZ on device."
    ]

    out: dict[str, Any] = {
        "epg_match_status": "api_only",
        "daypart_hint": None,
        "daypart_plausible": None,
        "wrong_feed_suspect": epg.get("wrong_feed_suspect"),
        "timezone_notes": epg.get("timezone_notes") or notes[0],
    }

    if visual in ("match",):
        out["epg_match_status"] = "visually_confirmed"
        out["daypart_plausible"] = True
        return out
    if visual in ("mismatch",):
        out["epg_match_status"] = "mismatch_suspected"
        out["wrong_feed_suspect"] = True
        return out

    if not has_data or not title:
        out["epg_match_status"] = "api_only"
        out["daypart_plausible"] = None
        return out

    # Wall-clock daypart in America/New_York for .us / US-tagged channels.
    hour_et: int | None = None
    try:
        from zoneinfo import ZoneInfo

        et = ZoneInfo("America/New_York")
        hour_et = datetime.now(et).hour
        out["timezone_notes"] = (
            f"Wall clock America/New_York hour={hour_et}; "
            f"gateway now_title={title!r}; visual={visual}."
        )
    except Exception:
        hour_et = datetime.now(timezone.utc).hour - 4  # rough EDT fallback
        if hour_et < 0:
            hour_et += 24

    region = (region_hint or epg.get("region_hint") or "").upper()
    tvg = (epg.get("tvg_id") or "").lower()
    us_like = region in ("US", "USA") or tvg.endswith(".us") or ".us" in tvg

    daypart = None
    if hour_et is not None:
        if 0 <= hour_et < 6:
            daypart = "overnight"
        elif 6 <= hour_et < 10:
            daypart = "morning"
        elif 10 <= hour_et < 17:
            daypart = "daytime"
        elif 17 <= hour_et < 23:
            daypart = "evening"
        else:
            daypart = "late"
    out["daypart_hint"] = daypart

    plausible = True
    suspect_reason = None
    if us_like and daypart == "daytime":
        if _OVERNIGHT_TITLE_RE.search(title) and not _DAYTIME_TITLE_RE.search(title):
            plausible = False
            suspect_reason = (
                f"US daytime ({hour_et}:00 ET) but now_title looks overnight/news-block "
                f"({title!r}) — possible false-UTC XMLTV or wrong national feed."
            )
    if us_like and daypart == "overnight":
        if _DAYTIME_TITLE_RE.search(title) and not _OVERNIGHT_TITLE_RE.search(title):
            plausible = False
            suspect_reason = (
                f"US overnight ({hour_et}:00 ET) but now_title looks daytime entertainment "
                f"({title!r}) — possible timezone skew."
            )

    out["daypart_plausible"] = plausible
    if not plausible:
        out["epg_match_status"] = "mismatch_suspected"
        out["wrong_feed_suspect"] = True
        if suspect_reason:
            out["timezone_notes"] = suspect_reason
    elif visual in ("not_checked", "unverifiable", "bumper_ad", "partial", ""):
        out["epg_match_status"] = "title_plausible"
    else:
        out["epg_match_status"] = "api_only"
    return out


def build_verdict(record: dict[str, Any]) -> None:
    actions: list[dict[str, Any]] = []
    status = record["stream"].get("stream_status")
    severity = "info"
    health = "unknown"

    if status in ("dead", "http_404", "timeout"):
        health, severity = "broken", "critical"
        actions.append(
            {
                "action": "Re-resolve upstream stream cache; confirm channel still exists at provider.",
                "severity": "critical",
                "owner": "gateway",
                "auto_suggested": True,
            }
        )
    elif status in ("http_403", "cdn_blocked", "cdn_tos_blocked"):
        health, severity = "broken", "high"
        actions.append(
            {
                "action": "Check CDN / ToS block flags; wait for upstream rotate or use alternate path/embed.",
                "severity": "high",
                "owner": "upstream",
                "auto_suggested": True,
            }
        )
    elif status in ("http_5xx", "degraded"):
        health, severity = "degraded", "high"
        actions.append(
            {
                "action": "Inspect gateway /content proxy errors and upstream health.",
                "severity": "high",
                "owner": "gateway",
                "auto_suggested": True,
            }
        )
    elif status in ("live", "embed_ok", "paint_death_risk"):
        health = "healthy"

    decode = record["playback"]["decode_notes"]
    if decode.get("single_1080_high_risk"):
        if health == "healthy":
            health = "client_path_issue"
        severity = _max_sev(severity, "medium")
        actions.append(
            {
                "action": "Expect Chrome /tv MSE risk (High@1080 single rung); verify embed fallback / TiviMate OK.",
                "severity": "medium",
                "owner": "client",
                "auto_suggested": True,
            }
        )
        decode["mse_vs_exoplayer"] = (
            decode.get("mse_vs_exoplayer")
            or "Same AVC High TS often OK on ExoPlayer/TiviMate; Chrome MSE ImageReader starvation risk."
        )
        decode["green_black_history"] = (
            decode.get("green_black_history")
            or "Known class: green/black paint on /tv MSE while media-session title still updates."
        )

    epg = record["epg"]
    # Never treat non-empty now/next as confirmed — daypart + visual gates.
    assessed = assess_epg_match_status(epg, epg.get("region_hint"))
    for k, v in assessed.items():
        if v is not None or k in ("daypart_plausible", "wrong_feed_suspect", "epg_match_status"):
            epg[k] = v
    match_status = (epg.get("epg_match_status") or "api_only").strip().lower()

    if epg.get("tvg_id") and epg.get("epg_has_data") is False:
        severity = _max_sev(severity, "medium")
        if health == "healthy":
            health = "epg_only_issue"
        actions.append(
            {
                "action": f"Fill or remap EPG for tvg_id={epg.get('tvg_id')} (now/next empty).",
                "severity": "medium",
                "owner": "epg",
                "auto_suggested": True,
            }
        )
    elif match_status == "mismatch_suspected":
        severity = _max_sev(severity, "medium")
        if health == "healthy":
            health = "epg_only_issue"
        actions.append(
            {
                "action": (
                    f"EPG now_title={epg.get('now_title')!r} fails daypart/visual sanity "
                    f"({epg.get('timezone_notes') or 'mismatch'}). Remap feed or fix TZ source; "
                    "do not treat non-empty now/next as healthy."
                ),
                "severity": "medium",
                "owner": "epg",
                "auto_suggested": True,
            }
        )
    elif match_status in ("api_only", "title_plausible") and epg.get("epg_has_data"):
        severity = _max_sev(severity, "low")
        actions.append(
            {
                "action": (
                    f"EPG match_status={match_status} — API now/next present but not "
                    "visually confirmed. Complete visual_epg_match before calling guide healthy."
                ),
                "severity": "low",
                "owner": "operator",
                "auto_suggested": True,
            }
        )

    if not epg.get("tvg_id"):
        severity = _max_sev(severity, "medium")
        actions.append(
            {
                "action": "Assign tvg_id / EPG mapping for this gateway id.",
                "severity": "medium",
                "owner": "epg",
                "auto_suggested": True,
            }
        )

    if record["identity"].get("logo_load_ok") is False:
        severity = _max_sev(severity, "low")
        actions.append(
            {
                "action": "Fix or replace logo URL (logo GET failed).",
                "severity": "low",
                "owner": "gateway",
                "auto_suggested": True,
            }
        )

    if record["ux"].get("numbering_confusion_risk"):
        severity = _max_sev(severity, "low")
        actions.append(
            {
                "action": "Document playlist_number vs TiviMate UI number to avoid id mix-ups.",
                "severity": "low",
                "owner": "operator",
                "auto_suggested": True,
            }
        )

    # Non-empty EPG alone never yields severity=none.
    if status == "live" and health == "healthy" and not actions:
        severity = "none"
    elif status == "live" and health == "healthy" and match_status != "visually_confirmed":
        severity = _max_sev(severity, "low")
        # Harden: title_plausible / api_only must not leave severity at none.
        if match_status in ("api_only", "title_plausible") and severity == "none":
            severity = "low"

    blinds = [
        "visual_epg_match",
        "language_confirmed",
        "paint_death_observed",
        "ui_channel_number",
        "favorites_flag",
        "guide_search_name_ok",
        "icon_recognizable",
        "group_placement_ok",
        "tivimate_exoplayer visual",
        "media_session_title",
    ]
    if match_status != "visually_confirmed":
        blinds = [
            f"epg_match_status={match_status} (API-only EPG — unconfirmed visually)"
            if b == "visual_epg_match"
            else b
            for b in blinds
        ]
    record["verdict"] = {
        "health": health,
        "severity": severity,
        "summary": _summary_line(record, health, status),
        "repair_actions": actions,
        "blind_spots_remaining": blinds,
    }


def _max_sev(a: str, b: str) -> str:
    order = ["none", "info", "low", "medium", "high", "critical"]
    return order[max(order.index(a) if a in order else 0, order.index(b) if b in order else 0)]


def _summary_line(record: dict[str, Any], health: str, status: str | None) -> str:
    name = record["identity"].get("display_name") or record["channel_id"]
    pic = record["stream"]["picture"]
    res = None
    if pic.get("width") and pic.get("height"):
        res = f"{pic['width']}x{pic['height']}"
    bits = [f"{name} ({record['channel_id']})", f"status={status}", f"health={health}"]
    if res:
        bits.append(res)
    if record["epg"].get("now_title"):
        bits.append(f"epg_now={record['epg']['now_title'][:60]}")
    if record["epg"].get("epg_match_status"):
        bits.append(f"epg_match={record['epg']['epg_match_status']}")
    return "; ".join(bits)


def audit_channel(
    cid: str,
    *,
    gateway: str,
    out_dir: Path,
    probe_media: bool,
    grab: bool,
    write_md: bool,
    operator: str | None,
    save_samples: bool,
    visual_match: str | None = None,
    ground_truth_title: str | None = None,
    register_confirmed: bool = False,
    register_version: str | None = None,
    register_pin: str | None = None,
    register_root_cause: str | None = None,
    skip_registry: bool = False,
) -> dict[str, Any]:
    record = load_template()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    audit_id = f"audit-{cid}-{stamp}"
    record["schema_version"] = "1.0.0"
    record["audit_id"] = audit_id
    record["audited_at"] = utc_now()
    record["auditor"] = {
        "tool": "scripts/channel-audit.py",
        "tool_version": TOOL_VERSION,
        "operator": operator,
        "host": socket.gethostname(),
    }
    record["gateway_base"] = gateway
    record["channel_id"] = str(cid)

    out_dir.mkdir(parents=True, exist_ok=True)
    sample_dir = out_dir / f"{audit_id}-artifacts"
    if save_samples or grab or probe_media:
        sample_dir.mkdir(parents=True, exist_ok=True)

    # --- Phase 1 identity ---
    try:
        code, channels = http_json(f"{gateway}/channels?include_dead=true", timeout=90)
    except Exception as e:
        record["phases"]["identity"] = "failed"
        record["notes"] = f"channels_fetch_failed:{e}"
        channels = []
        code = 0
    ch = find_channel(channels if isinstance(channels, list) else [], cid)
    neighbors = None
    try:
        ncode, neighbors = http_json(f"{gateway}/channels/neighbors/{cid}", timeout=30)
        if ncode >= 400:
            neighbors = None
    except Exception:
        neighbors = None

    ident = record["identity"]
    if ch:
        ident["channel_id"] = str(ch.get("id"))
        ident["display_name"] = ch.get("name")
        ident["provider"] = ch.get("provider")
        ident["source"] = ch.get("source")
        ident["group_title"] = ch.get("group_title")
        ident["tags"] = list(ch.get("tags") or [])
        ident["logo_url"] = ch.get("logo")
        ident["dead_catalog_flag"] = bool(ch.get("dead"))
        ident["cdn_blocked_flag"] = bool(ch.get("cdn_blocked"))
        ident["cdn_tos_blocked_flag"] = bool(ch.get("cdn_tos_blocked"))
        tags = ident["tags"]
        ident["category_hints"] = [t for t in tags if str(t).startswith("#")]
        adult = bool(
            ADULT_TAG_RE.search(str(ch.get("name") or ""))
            or any(ADULT_TAG_RE.search(str(t)) for t in tags)
            or str(ch.get("source") or "").lower() == "adultswim"
            or str(ch.get("id") or "").lower().startswith("adultswim:")
        )
        ident["adult"] = adult
        ident["top_network_candidate"] = bool(TOP_NETWORK_NAME_RE.search(str(ch.get("name") or "")))
        aliases, siblings = sibling_and_alias_search(gateway, cid, str(ch.get("name") or ""))
        ident["aliases"] = aliases
        ident["sibling_ids"] = siblings
        record["phases"]["identity"] = "partial"
    else:
        ident["channel_id"] = str(cid)
        record["phases"]["identity"] = "failed"
        record["notes"] = (record.get("notes") or "") + "; channel_not_in_catalog"

    if isinstance(neighbors, dict):
        ident["playlist_index"] = neighbors.get("index")
        ident["playlist_number"] = neighbors.get("number")
        record["metadata"]["neighbors"] = {
            "prev_id": (neighbors.get("prev") or {}).get("id"),
            "prev_name": (neighbors.get("prev") or {}).get("name"),
            "next_id": (neighbors.get("next") or {}).get("id"),
            "next_name": (neighbors.get("next") or {}).get("name"),
        }
        # Large playlist numbers often confuse operators vs TiviMate UI nums
        if isinstance(ident.get("playlist_number"), int) and ident["playlist_number"] >= 1000:
            record["ux"]["numbering_confusion_risk"] = True

    if ident.get("logo_url"):
        try:
            lcode, lbody, lhdr = http_get(ident["logo_url"], timeout=20, max_bytes=512_000)
            ident["logo_http_status"] = lcode
            ident["logo_content_type"] = lhdr.get("content-type")
            ident["logo_bytes"] = len(lbody)
            ident["logo_load_ok"] = lcode == 200 and len(lbody) > 32
        except Exception as e:
            ident["logo_load_ok"] = False
            ident["logo_http_status"] = None
            record["notes"] = (record.get("notes") or "") + f"; logo_error:{e}"

    if ch:
        record["phases"]["identity"] = "complete"

    # --- Phase 2 stream ---
    paths = {
        "live_m3u8": f"/live/{cid}.m3u8",
        "stream_m3u8": f"/stream/{cid}.m3u8",
        "content_proxy": "/content/{token}",
        "embed_page": f"/live/{cid}/embed",
        "embed_m3u8": f"/live/{cid}/embed.m3u8",
        "tivimate_stream": f"/tivimate-stream/{cid}.m3u8",
        "tv_page": f"/tv/{cid}",
        "play_page": f"/play/{cid}",
    }
    record["stream"]["paths"] = paths

    meta = None
    try:
        _, meta = http_json(f"{gateway}/live/{cid}/meta", timeout=45)
    except Exception as e:
        meta = {"ok": False, "error": str(e)}

    upstream = record["stream"]["upstream"]
    if isinstance(meta, dict):
        upstream["referer_host"] = meta.get("referer_host") or host_only(meta.get("upstream_embed_url"))
        upstream["embed_host"] = host_only(meta.get("upstream_embed_url"))
        upstream["notes"] = meta.get("cdn_note")
        if meta.get("cdn_blocked"):
            ident["cdn_blocked_flag"] = True
        if meta.get("cdn_tos_blocked"):
            ident["cdn_tos_blocked_flag"] = True
        if meta.get("source"):
            ident["source"] = ident.get("source") or meta.get("source")
        if meta.get("provider"):
            ident["provider"] = ident.get("provider") or meta.get("provider")

    record["stream"]["headers_needs"] = {
        "user_agent_required": True,
        "referer_required": bool(upstream.get("referer_host")),
        "origin_required": False,
        "cookie_required": False,
        "notes": "Gateway injects upstream Referer for /content/; clients should not store secret header values.",
    }

    path_status: dict[str, int | None] = {}
    live_text = ""
    live_code = 0
    for key, rel in [
        ("live_m3u8", paths["live_m3u8"]),
        ("stream_m3u8", paths["stream_m3u8"]),
        ("embed_page", paths["embed_page"]),
        ("embed_m3u8", paths["embed_m3u8"]),
        ("tivimate_stream", paths["tivimate_stream"]),
        ("tv_page", paths["tv_page"]),
        ("play_page", paths["play_page"]),
    ]:
        url = f"{gateway}{rel}"
        try:
            # Limit body for HTML pages
            max_b = 64_000 if key in ("tv_page", "play_page", "embed_page") else 200_000
            c, body, _ = http_get(url, timeout=35, max_bytes=max_b)
            path_status[key] = c
            if key == "live_m3u8":
                live_code, live_text = c, body.decode("utf-8", errors="replace")
            if key == "tivimate_stream" and c == 404:
                record["stream"]["paths"]["tivimate_stream"] = None
        except Exception:
            path_status[key] = None

    pl = record["stream"]["playlist"]
    pl["http_status"] = live_code
    pl["reachable"] = live_code == 200 and "#EXTM3U" in live_text
    pl["bytes"] = len(live_text.encode("utf-8")) if live_text else 0
    if pl["reachable"]:
        pl["kind"] = playlist_kind(live_text)
        # media playlist tags
        m = re.search(r"#EXT-X-TARGETDURATION:([\d.]+)", live_text)
        pl["target_duration_sec"] = float(m.group(1)) if m else None
        m = re.search(r"#EXT-X-MEDIA-SEQUENCE:(\d+)", live_text)
        pl["media_sequence"] = int(m.group(1)) if m else None
        pl["has_program_date_time"] = "#EXT-X-PROGRAM-DATE-TIME" in live_text
        pl["has_ext_x_map"] = "#EXT-X-MAP" in live_text
        pl["has_endlist"] = "#EXT-X-ENDLIST" in live_text
        segs = segment_urls(live_text)
        pl["segment_count_sampled"] = len(segs)
        if segs:
            ext = Path(urlparse(segs[0]).path).suffix.lower()
            pl["segment_ext_hint"] = ext or "unknown"
        ladder = parse_ladder(live_text, gateway)
        # If media playlist only, also try /stream master for ABR
        if not ladder and path_status.get("stream_m3u8") == 200:
            try:
                _, sbody, _ = http_get(f"{gateway}{paths['stream_m3u8']}", timeout=25, max_bytes=50_000)
                ladder = parse_ladder(sbody.decode("utf-8", errors="replace"), gateway)
                if ladder and pl["kind"] == "hls_media":
                    # keep media kind but attach ladder from master sibling
                    pass
            except Exception:
                pass
        record["stream"]["abr_ladder"] = ladder
        if ladder:
            # Prefer highest bandwidth as active/default description
            record["stream"]["active_variant"] = sorted(
                ladder, key=lambda r: r.get("bandwidth_bps") or 0, reverse=True
            )[0]
            av = record["stream"]["active_variant"]
            record["stream"]["picture"]["width"] = av.get("width")
            record["stream"]["picture"]["height"] = av.get("height")
            record["stream"]["picture"]["fps"] = av.get("frame_rate")
            record["stream"]["picture"]["bitrate_bps"] = av.get("bandwidth_bps")
            record["stream"]["picture"]["avg_bitrate_bps"] = av.get("avg_bandwidth_bps")
            record["stream"]["picture"]["aspect_ratio"] = aspect_ratio(av.get("width"), av.get("height"))
            record["stream"]["picture"]["scan_type"] = "unknown"
            vcod, acod = codecs_from_string(av.get("codecs"))
            record["stream"]["codecs"]["video_codec"] = (
                "h264" if vcod and vcod.lower().startswith("avc1") else (vcod or None)
            )
            record["stream"]["codecs"]["audio_codec"] = (
                "aac" if acod and acod.lower().startswith("mp4a") else (acod or None)
            )
            prof, lvl = avc_profile_level(vcod)
            record["stream"]["codecs"]["video_profile"] = prof
            record["stream"]["codecs"]["video_level"] = lvl
        else:
            # media playlist without master — still note proxy mode from segments
            record["stream"]["active_variant"] = None

        # proxy mode
        sample_seg = segs[0] if segs else None
        if sample_seg and "/content/" in sample_seg:
            record["stream"]["proxy_mode"] = "content_proxy"
        elif sample_seg and sample_seg.startswith("http"):
            record["stream"]["proxy_mode"] = "direct_cdn"
            upstream["cdn_host"] = host_only(sample_seg)
        elif ladder and any(r.get("uri_kind") == "content_proxy" for r in ladder):
            record["stream"]["proxy_mode"] = "content_proxy"
        elif ladder and any(r.get("uri_kind") == "direct_cdn" for r in ladder):
            record["stream"]["proxy_mode"] = "direct_cdn"
        else:
            record["stream"]["proxy_mode"] = "unknown"

        # segment sample (follow master → media if needed)
        media_text = live_text
        media_segs = segs
        if pl["kind"] == "hls_master" and ladder:
            # fetch first variant playlist (redact later)
            first_uri = None
            for m in STREAM_INF_RE.finditer(live_text):
                first_uri = (m.group(2) or "").strip()
                break
            if first_uri:
                if first_uri.startswith("/"):
                    vurl = f"{gateway}{first_uri}"
                elif first_uri.startswith("http"):
                    vurl = first_uri
                else:
                    vurl = urllib.parse.urljoin(f"{gateway}/live/", first_uri)
                try:
                    vc, vbody, _ = http_get(vurl, timeout=30, max_bytes=100_000)
                    if vc == 200:
                        media_text = vbody.decode("utf-8", errors="replace")
                        media_segs = segment_urls(media_text)
                except Exception:
                    pass

        if media_segs:
            seg = media_segs[0]
            if seg.startswith("/"):
                seg_url = f"{gateway}{seg}"
            elif seg.startswith("http"):
                seg_url = seg
            else:
                seg_url = urllib.parse.urljoin(f"{gateway}/live/{cid}.m3u8", seg)
            try:
                sc, sbody, _ = http_get(seg_url, timeout=40, max_bytes=3_000_000)
                sync, mod188, container = mpegts_heuristics(sbody)
                record["stream"]["segment_sample"] = {
                    "http_status": sc,
                    "bytes": len(sbody),
                    "container": container,
                    "mpegts_sync_ok": sync,
                    "mpegts_mod188_ok": mod188,
                    "via_proxy": "/content/" in seg_url,
                }
                if not upstream.get("cdn_host") and "/content/" not in seg_url:
                    upstream["cdn_host"] = host_only(seg_url)
                if save_samples and sbody:
                    seg_path = sample_dir / f"{cid}-segment.sample"
                    seg_path.write_bytes(sbody[: min(len(sbody), 512_000)])
                    record["raw_refs"]["segment_sample_path"] = rel_or_abs(seg_path)
                if probe_media and sbody:
                    ok, probe, err = ffprobe_bytes(sbody)
                    record["stream"]["codecs"]["ffprobe_ok"] = ok
                    record["stream"]["codecs"]["ffprobe_error"] = err
                    if ok:
                        apply_ffprobe(record, probe)
            except Exception as e:
                record["stream"]["segment_sample"]["http_status"] = None
                record["stream"]["status_detail"] = f"segment_error:{e}"

        if save_samples and live_text:
            # Redact content tokens in saved playlist
            redacted = re.sub(
                r"(https?://[^/]+)/content/[^\s]+",
                r"\1/content/{token}",
                live_text,
            )
            pl_path = sample_dir / f"{cid}-playlist.m3u8"
            pl_path.write_text(redacted, encoding="utf-8")
            record["raw_refs"]["playlist_sample_path"] = rel_or_abs(pl_path)

        record["phases"]["stream_probe"] = "complete"
    else:
        record["phases"]["stream_probe"] = "failed"
        record["stream"]["proxy_mode"] = "unknown"

    # stream status classification
    status = "unknown"
    detail = None
    if ident.get("cdn_tos_blocked_flag"):
        status, detail = "cdn_tos_blocked", "meta.cdn_tos_blocked"
    elif ident.get("cdn_blocked_flag") and not pl.get("reachable"):
        status, detail = "cdn_blocked", "meta.cdn_blocked"
    elif ident.get("dead_catalog_flag"):
        status, detail = "dead", "catalog.dead"
    elif live_code == 403:
        status = "http_403"
    elif live_code == 404:
        status = "http_404"
    elif live_code and live_code >= 500:
        status = "http_5xx"
    elif live_code and 400 <= live_code < 500:
        status = "http_4xx"
    elif path_status.get("live_m3u8") is None:
        status, detail = "timeout", "live_m3u8_unreachable"
    elif pl.get("reachable"):
        status = "live"
    elif path_status.get("embed_page") == 200:
        status = "embed_ok"
        detail = "live playlist failed; embed page reachable"
    record["stream"]["stream_status"] = status
    record["stream"]["status_detail"] = detail

    # decode risk
    pic = record["stream"]["picture"]
    codecs = record["stream"]["codecs"]
    ladder = record["stream"]["abr_ladder"] or []
    single = len(ladder) <= 1
    high1080 = (
        (pic.get("height") or 0) >= 1080
        and str(codecs.get("video_profile") or "").lower() == "high"
    )
    record["playback"]["decode_notes"]["lighter_variant_available"] = len(ladder) > 1
    record["playback"]["decode_notes"]["single_1080_high_risk"] = bool(single and high1080)
    if record["playback"]["decode_notes"]["single_1080_high_risk"] and status == "live":
        record["stream"]["stream_status"] = "paint_death_risk"

    # --- Phase 3 playback (HTTP reachability + risk; visual human) ---
    surfaces = record["playback"]["surfaces"]
    surfaces["tv_mse"] = {
        "status": "untested"
        if path_status.get("tv_page") == 200
        else ("fail" if path_status.get("tv_page") not in (200, None) else "untested"),
        "notes": "HUMAN: confirm MSE paint on /tv; auto only checked page HTTP "
        + f"status={path_status.get('tv_page')}",
    }
    if path_status.get("tv_page") == 200:
        surfaces["tv_mse"]["status"] = "untested"
    surfaces["play_page"] = {
        "status": "untested" if path_status.get("play_page") == 200 else "fail",
        "notes": f"HTTP {path_status.get('play_page')}",
    }
    if path_status.get("play_page") not in (200, None) and path_status.get("play_page"):
        surfaces["play_page"]["status"] = "fail"
    elif path_status.get("play_page") == 200:
        surfaces["play_page"]["status"] = "untested"
    surfaces["embed_clappr"] = {
        "status": "ok"
        if path_status.get("embed_page") == 200
        else ("fail" if path_status.get("embed_page") else "n_a"),
        "notes": f"HTTP {path_status.get('embed_page')} (visual confirm still HUMAN)",
    }
    surfaces["tivimate_exoplayer"] = {
        "status": "n_a" if record["stream"]["paths"]["tivimate_stream"] is None and path_status.get("tivimate_stream") == 404 else "untested",
        "notes": "HUMAN: ExoPlayer path; Linux gateway may not expose /tivimate-stream/ (APK-local).",
    }
    surfaces["apk_native"] = {"status": "untested", "notes": "HUMAN"}
    record["ux"]["mobile_tv_path_notes"] = (
        f"/tv/{cid} uses hls.js MSE via /live/{cid}.m3u8 → /content/ proxy."
    )
    record["ux"]["tivimate_path_notes"] = (
        "TiviMate typically uses gateway APK playlist or /live/{id}.m3u8; "
        "UI channel number may differ from playlist_number."
    )

    if grab and pl.get("reachable"):
        frame_path = sample_dir / f"{cid}-frame.jpg"
        ok, detail_f = grab_frame(f"{gateway}/live/{cid}.m3u8", frame_path)
        record["playback"]["ffmpeg_frame"] = {
            "ok": ok,
            "path": rel_or_abs(frame_path) if ok else None,
            "detail": detail_f,
        }
        record["raw_refs"]["frame_path"] = record["playback"]["ffmpeg_frame"]["path"]
    record["phases"]["playback"] = "partial"

    # --- Phase 4 EPG ---
    epg = record["epg"]
    try:
        _, match = http_json(f"{gateway}/epg/match/{cid}", timeout=30)
    except Exception:
        match = None
    try:
        _, now_next = http_json(f"{gateway}/epg/now-next/{cid}", timeout=30)
    except Exception:
        now_next = None
    try:
        _, schedule = http_json(f"{gateway}/epg/schedule/{cid}?hours=6", timeout=40)
    except Exception:
        schedule = None

    if isinstance(match, dict) and not match.get("error"):
        epg["tvg_id"] = match.get("mapped_tvg_id")
        epg["match_method"] = match.get("method")
        epg["match_confidence"] = match.get("confidence")
        epg["epg_has_data"] = match.get("epg_has_data")
        epg["epg_source"] = map_epg_source(match.get("method"))
        now = match.get("now") or {}
        nxt = match.get("next") or {}
        if now:
            epg["now_title"] = now.get("title")
            epg["now_start"] = now.get("start")
            epg["now_stop"] = now.get("stop")
        if nxt:
            epg["next_title"] = nxt.get("title")
    if isinstance(now_next, dict):
        epg["tvg_id"] = epg.get("tvg_id") or now_next.get("tvg_id")
        if now_next.get("has_data") is not None:
            epg["epg_has_data"] = now_next.get("has_data")
        now = now_next.get("now") or {}
        nxt = now_next.get("next") or {}
        if now and not epg.get("now_title"):
            epg["now_title"] = now.get("title")
            epg["now_start"] = now.get("start")
            epg["now_stop"] = now.get("stop")
        if nxt and not epg.get("next_title"):
            epg["next_title"] = nxt.get("title")
        if not epg.get("tvg_id") and ch:
            epg["tvg_id"] = ch.get("tvg_id")
            epg["epg_source"] = epg.get("epg_source") or ("none" if not ch.get("tvg_id") else "unknown")
    if isinstance(schedule, dict):
        events = schedule.get("events") or schedule.get("programmes") or schedule.get("items") or []
        if isinstance(events, list):
            epg["schedule_events_sampled"] = len(events)
        elif isinstance(schedule.get("schedule"), list):
            epg["schedule_events_sampled"] = len(schedule["schedule"])
    if ch and not epg.get("tvg_id"):
        epg["tvg_id"] = ch.get("tvg_id")
        epg["epg_has_data"] = ch.get("epg_has_data")
        if not epg.get("epg_source"):
            epg["epg_source"] = "none" if not ch.get("tvg_id") else "unknown"

    region, lang = region_language_hints(ident.get("tags") or [], epg.get("tvg_id"), ident.get("display_name") or "")
    epg["region_hint"] = region
    epg["language_hint"] = lang
    # Human visual gate — optional CLI upgrade to match/mismatch for this run.
    vm = (visual_match or "not_checked").strip().lower()
    if vm not in ("not_checked", "match", "mismatch", "uncertain"):
        vm = "not_checked"
    epg["visual_epg_match"] = vm
    if ground_truth_title:
        epg["ground_truth_title"] = ground_truth_title.strip()
    # Auto daypart / confidence — never mark EPG confirmed from API alone.
    for k, v in assess_epg_match_status(epg, region).items():
        if v is not None or k in ("daypart_plausible", "wrong_feed_suspect", "epg_match_status"):
            epg[k] = v
    record["phases"]["epg"] = "partial" if vm == "not_checked" else "complete"

    # --- Phase 5 metadata ---
    record["metadata"]["title_now_playing"] = epg.get("now_title")
    record["metadata"]["last_verified_at"] = record["audited_at"]
    record["metadata"]["verified_by"] = "scripts/channel-audit.py"
    # prior incidents: lightweight local path hints (no personal data)
    prior: list[str] = []
    decode_report = ROOT / "field-test-s23" / "decode-invest" / "REPORT.md"
    if decode_report.exists() and str(cid) in ("343", "302"):
        prior.append("field-test-s23/decode-invest/REPORT.md")
    # Confirmed-case registry artifact hints for this gateway id.
    if epg_corr is not None and not skip_registry:
        try:
            reg = epg_corr.load_registry()
            for case in (epg_corr.cases_by_gateway(reg).get(str(cid)) or []):
                for art in case.get("artifacts") or []:
                    if art not in prior:
                        prior.append(art)
        except Exception:
            pass
    record["metadata"]["prior_incidents"] = prior
    record["phases"]["metadata"] = "partial"

    # --- Phase 6 UX ---
    record["phases"]["ux"] = "partial"

    # --- Phase 7 verdict ---
    build_verdict(record)
    # Consult confirmed-case registry: classify failure + prefer proven resolutions.
    if epg_corr is not None and not skip_registry:
        try:
            epg_corr.enrich_audit_record(record)
        except Exception as e:
            record.setdefault("epg_correction", {})["error"] = f"{type(e).__name__}:{e}"
    # Write visually_confirmed repairs back into the registry (feedback loop).
    if register_confirmed:
        if epg_corr is None:
            raise RuntimeError("epg_correction module unavailable; cannot --register-confirmed")
        if vm != "match":
            raise RuntimeError("--register-confirmed requires --visual-match match")
        pin = register_pin
        if not pin and epg_corr is not None:
            # Prefer pin from existing exact case, else require CLI.
            reg0 = epg_corr.load_registry()
            exact = epg_corr.cases_by_gateway(reg0).get(str(cid)) or []
            if exact:
                pin = str(exact[-1].get("epgpw_pin") or "")
        if not pin:
            raise RuntimeError("--register-confirmed needs --register-pin (or an existing registry case)")
        ver = register_version
        if not ver:
            vpath = ROOT / "VERSION"
            ver = vpath.read_text(encoding="utf-8").strip() if vpath.exists() else "unknown"
        root_cause = register_root_cause
        if not root_cause:
            cls = (record.get("epg_correction") or {}).get("classification") or {}
            root_cause = cls.get("primary_class") or "gzip_tz_poison"
        gt = ground_truth_title or epg.get("now_title") or ""
        if not gt:
            raise RuntimeError("--register-confirmed needs --ground-truth-title or a non-empty now_title")
        reg = epg_corr.load_registry()
        case = epg_corr.register_confirmed_case(
            reg,
            gateway_id=str(cid),
            tvg_id=str(epg.get("tvg_id") or ""),
            epgpw_pin=str(pin),
            ground_truth_title=gt,
            root_cause_class=str(root_cause),
            resolution_version=ver,
            display_name=ident.get("display_name"),
            prefer_source="json",
            artifacts=[f"docs/channel-audit/examples/{audit_id}.json"],
        )
        epg_corr.save_registry(reg)
        record.setdefault("epg_correction", {})["registered_case"] = case.get("case_id")
        record["epg"]["epg_match_status"] = "visually_confirmed"
    record["phases"]["verdict"] = "partial"

    # write outputs
    json_path = out_dir / f"{audit_id}.json"
    json_path.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    record["raw_refs"]["report_path"] = rel_or_abs(json_path)
    # rewrite with report_path set
    json_path.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")

    if write_md:
        md_path = out_dir / f"{audit_id}.md"
        md_path.write_text(render_md(record), encoding="utf-8")

    return record


def render_md(record: dict[str, Any]) -> str:
    ident = record["identity"]
    stream = record["stream"]
    epg = record["epg"]
    verdict = record["verdict"]
    lines = [
        f"# Channel audit `{record['channel_id']}` — {ident.get('display_name')}",
        "",
        f"- **audit_id:** `{record['audit_id']}`",
        f"- **audited_at:** {record['audited_at']}",
        f"- **gateway:** {record['gateway_base']}",
        f"- **health / severity:** {verdict.get('health')} / {verdict.get('severity')}",
        f"- **stream_status:** {stream.get('stream_status')}",
        "",
        "## Identity",
        f"- id `{ident.get('channel_id')}` · playlist# `{ident.get('playlist_number')}` · provider `{ident.get('provider')}` / `{ident.get('source')}`",
        f"- tags: {', '.join(ident.get('tags') or []) or '—'}",
        f"- logo_ok: {ident.get('logo_load_ok')} · top_network: {ident.get('top_network_candidate')}",
        f"- siblings: {', '.join(ident.get('sibling_ids') or []) or '—'}",
        "",
        "## Stream",
        f"- proxy: `{stream.get('proxy_mode')}` · playlist kind: `{stream.get('playlist', {}).get('kind')}`",
        f"- upstream host: `{stream.get('upstream', {}).get('referer_host')}`",
        f"- picture: {stream.get('picture')}",
        f"- codecs: {stream.get('codecs')}",
        f"- ABR rungs: {len(stream.get('abr_ladder') or [])}",
        "",
        "## EPG",
        f"- tvg_id `{epg.get('tvg_id')}` · source `{epg.get('epg_source')}` · method `{epg.get('match_method')}`",
        f"- has_data: {epg.get('epg_has_data')} · now: {epg.get('now_title')}",
        f"- epg_match_status: **{epg.get('epg_match_status')}** · daypart: {epg.get('daypart_hint')} · plausible: {epg.get('daypart_plausible')}",
        f"- visual_epg_match: **{epg.get('visual_epg_match')}** (HUMAN)",
        f"- timezone_notes: {epg.get('timezone_notes')}",
        "",
    ]
    corr = record.get("epg_correction") or {}
    if corr:
        cls = corr.get("classification") or {}
        lines += [
            "## EPG correction (registry)",
            f"- algorithm: `{corr.get('algorithm_version')}` · registry `{corr.get('registry_path')}`",
            f"- class: **{cls.get('primary_class')}** ({cls.get('confidence')}) — {', '.join(cls.get('classes') or []) or '—'}",
            f"- exact cases: {', '.join(c.get('case_id') for c in (corr.get('exact_cases') or [])) or '—'}",
        ]
        if corr.get("registered_case"):
            lines.append(f"- **registered this run:** `{corr.get('registered_case')}`")
        lines.append("")
    lines += [
        "## Verdict",
        f"- {verdict.get('summary')}",
        "",
        "### Repair actions",
    ]
    for a in verdict.get("repair_actions") or []:
        lines.append(f"- [{a.get('severity')}] ({a.get('owner')}) {a.get('action')}")
    if not verdict.get("repair_actions"):
        lines.append("- (none auto-suggested)")
    lines += [
        "",
        "### Blind spots (HUMAN)",
        "",
    ]
    for b in verdict.get("blind_spots_remaining") or []:
        lines.append(f"- {b}")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description="Gapless single-channel audit for StepDaddyLiveHD")
    ap.add_argument("channel_id", help="Gateway channel id (e.g. 343)")
    ap.add_argument("--gateway", default=DEFAULT_GATEWAY, help="Gateway base URL")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Output directory")
    ap.add_argument("--probe-media", action="store_true", help="ffprobe first segment")
    ap.add_argument("--grab-frame", action="store_true", help="ffmpeg single JPEG frame")
    ap.add_argument("--save-samples", action="store_true", help="Save redacted playlist + segment sample")
    ap.add_argument("--md", action="store_true", help="Also write Markdown summary")
    ap.add_argument("--operator", default=None, help="Neutral operator label")
    ap.add_argument(
        "--visual-match",
        choices=["not_checked", "match", "mismatch", "uncertain"],
        default=None,
        help="Set visual_epg_match for this run (required=match with --register-confirmed)",
    )
    ap.add_argument(
        "--ground-truth-title",
        default=None,
        help="Operator ground-truth on-screen title (stored when registering)",
    )
    ap.add_argument(
        "--register-confirmed",
        action="store_true",
        help="Write visually_confirmed repair into data/epg_confirmed_corrections.json",
    )
    ap.add_argument(
        "--register-pin",
        default=None,
        help="epg.pw channel id pin to store with --register-confirmed",
    )
    ap.add_argument(
        "--register-version",
        default=None,
        help="VERSION tag for the repair (default: repo VERSION file)",
    )
    ap.add_argument(
        "--register-root-cause",
        default=None,
        help="Root-cause class (default: classified primary, else gzip_tz_poison)",
    )
    ap.add_argument(
        "--skip-registry",
        action="store_true",
        help="Do not consult/enrich from confirmed-case registry",
    )
    args = ap.parse_args()

    if not TEMPLATE_PATH.exists():
        print(f"Missing template: {TEMPLATE_PATH}", file=sys.stderr)
        return 2

    t0 = time.time()
    try:
        record = audit_channel(
            str(args.channel_id),
            gateway=args.gateway.rstrip("/"),
            out_dir=args.out if args.out.is_absolute() else (ROOT / args.out),
            probe_media=args.probe_media,
            grab=args.grab_frame,
            write_md=args.md,
            operator=args.operator,
            save_samples=args.save_samples or args.probe_media or args.grab_frame,
            visual_match=args.visual_match,
            ground_truth_title=args.ground_truth_title,
            register_confirmed=args.register_confirmed,
            register_version=args.register_version,
            register_pin=args.register_pin,
            register_root_cause=args.register_root_cause,
            skip_registry=args.skip_registry,
        )
    except Exception as e:
        print(f"audit_failed: {e}", file=sys.stderr)
        return 1

    elapsed = time.time() - t0
    path = record.get("raw_refs", {}).get("report_path")
    corr = record.get("epg_correction") or {}
    print(
        json.dumps(
            {
                "ok": True,
                "audit_id": record["audit_id"],
                "channel_id": record["channel_id"],
                "health": record["verdict"]["health"],
                "severity": record["verdict"]["severity"],
                "stream_status": record["stream"]["stream_status"],
                "epg_match_status": record.get("epg", {}).get("epg_match_status"),
                "epg_correction_class": (corr.get("classification") or {}).get("primary_class"),
                "registry_cases": [c.get("case_id") for c in (corr.get("exact_cases") or [])],
                "registered_case": corr.get("registered_case"),
                "report": path,
                "elapsed_sec": round(elapsed, 2),
                "human_remaining": record["verdict"]["blind_spots_remaining"],
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
