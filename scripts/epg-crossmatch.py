#!/usr/bin/env python3
"""Enhanced EPG ↔ stream crossmatch loop (data-in protocol).

Pipeline:
  1. Multi-source now/next (gateway EPG + optional Pluto + TV Insider vote)
  2. ffmpeg live frame
  3. OCR (tesseract) + lightweight bumper/ad + network-bug heuristics
  4. Bumper/ad → uncertain
  5. Bug ≠ expected network → WRONG_FEED candidate
  6. Fuzzy-match OCR/title cues to now; else search ±12h same-channel schedule
  7. TV Insider schedule vote (yes/no/offset_suspect/wrong_feed) when mapped
  8. Persist fingerprint registry JSON
  9. Rate limits; defer dead streams
  10. Emit high-confidence remap suggestions (deploy only solid map fixes)

Examples:
  python3 scripts/epg-crossmatch.py --batch A --channels-file scripts/batches/batch-a-hard-misses.json
  python3 scripts/epg-crossmatch.py --batch B --channels-file scripts/batches/us-sports-kids-ent-gaps.json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

DEFAULT_OUT_ROOT = ROOT / "field-test-epg-batches"
DEFAULT_GATEWAY = os.environ.get("SD_GATEWAY", "https://sdgateway.duckdns.org").rstrip("/")
DEFAULT_REGISTRY = ROOT / "data" / "epg_fingerprint_registry.json"
UA = "StepDaddy-epg-crossmatch/1.0"

try:
    from StepDaddyLiveHD.supplements import tvinsider_epg as _tvinsider
except Exception:  # pragma: no cover - optional vote source
    _tvinsider = None  # type: ignore

AD_BUMPER_HINTS = re.compile(
    r"\b("
    r"commercial|sponsored|brought to you|visit .{0,20}\.com|call now|"
    r"1[- ]?800|teleshopping|infomercial|high street tv|"
    r"coming up|next on|stay tuned|we'll be right back|"
    r"pluto\s*tv|bumper|promo only"
    r")\b",
    re.I,
)
WRONG_FEED_ALIASES: dict[str, list[str]] = {
    "acorn": ["acorn tv", "acorn"],
    "adult swim": ["adult swim", "[as]", "stoopid monkey"],
    "court tv": ["court tv"],
    "bbc news": ["bbc news"],
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def slug(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", (name or "").strip()).strip("-").lower()
    return s or "channel"


def norm_title(s: str | None) -> str:
    s = (s or "").lower()
    s = re.sub(r"^(live:\s*|new:\s*|visually signed\s*)", "", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def title_similarity(a: str | None, b: str | None) -> float:
    na, nb = norm_title(a), norm_title(b)
    if not na or not nb:
        return 0.0
    if na == nb or na in nb or nb in na:
        return 1.0
    return SequenceMatcher(None, na, nb).ratio()


def http_get(url: str, *, timeout: float = 25, retries: int = 3, backoff: float = 2.0) -> tuple[int, bytes]:
    last_err: Exception | None = None
    delay = backoff
    for attempt in range(retries):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                code = getattr(resp, "status", 200) or 200
                data = resp.read()
                if code in (429, 503):
                    time.sleep(delay)
                    delay = min(delay * 2, 60)
                    continue
                return int(code), data
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code in (429, 503) and attempt < retries - 1:
                time.sleep(delay)
                delay = min(delay * 2, 60)
                continue
            return int(e.code), e.read() if e.fp else b""
        except Exception as e:
            last_err = e
            if attempt < retries - 1:
                time.sleep(delay)
                delay = min(delay * 2, 30)
                continue
            raise
    if last_err:
        raise last_err
    return 0, b""


def http_json(url: str, **kwargs: Any) -> Any:
    code, raw = http_get(url, **kwargs)
    if code >= 400:
        raise RuntimeError(f"HTTP {code} for {url}")
    return json.loads(raw.decode("utf-8", errors="replace"))


def load_channels(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = payload["channels"] if isinstance(payload, dict) else payload
    out = []
    for r in rows:
        cid = str(r.get("id") or r.get("channel_id") or "").strip()
        if not cid:
            continue
        out.append(
            {
                "id": cid,
                "name": str(r.get("name") or cid),
                "group": str(r.get("group") or ""),
                "expected_bugs": list(r.get("expected_bugs") or []),
                "pluto_id": r.get("pluto_id"),
                "tvinsider_slug": (str(r["tvinsider_slug"]).strip() if r.get("tvinsider_slug") else None),
            }
        )
    return out


def _ffmpeg_bin() -> str:
    for cand in ("/usr/bin/ffmpeg", "/bin/ffmpeg", "ffmpeg"):
        if cand.startswith("/") and not Path(cand).exists():
            continue
        return cand
    return "ffmpeg"


def ffmpeg_grab_frame(playlist_url: str, dest: Path, *, timeout_sec: float = 35) -> tuple[bool, str]:
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
        err = (proc.stderr or proc.stdout or "").strip().splitlines()
        detail = err[-1][:240] if err else f"ffmpeg_exit_{proc.returncode}"
        low = detail.lower()
        if "404" in low or "403" in low:
            return False, f"http_denied:{detail}"
        if any(x in low for x in ("502", "503", "429")):
            return False, f"upstream_busy:{detail}"
        return False, detail or "ffmpeg_failed"
    return True, f"frame_bytes={dest.stat().st_size}"


def probe_playlist(gateway: str, cid: str) -> tuple[str, str]:
    url = f"{gateway}/live/{urllib.request.quote(cid, safe=':')}.m3u8"
    try:
        code, raw = http_get(url, timeout=18, retries=2, backoff=1.5)
    except Exception as e:
        return "deferred", f"playlist_error:{e}"
    if code in (429, 503, 502):
        return "deferred", f"playlist_http_{code}"
    if code >= 400:
        return "deferred", f"playlist_http_{code}"
    text = raw.decode("utf-8", errors="replace")
    if "#EXTM3U" not in text:
        return "deferred", "playlist_not_m3u8"
    if not re.search(r"https?://|\.ts|\.m4s|content/", text):
        return "deferred", "playlist_empty"
    return "ok", url


def fetch_gateway_epg(gateway: str, cid: str) -> dict[str, Any]:
    enc = urllib.request.quote(cid, safe=":")
    now_next: dict[str, Any] = {}
    schedule: dict[str, Any] = {}
    try:
        now_next = http_json(f"{gateway}/epg/now-next/{enc}", timeout=20)
    except Exception as e:
        now_next = {"error": str(e), "channel_id": cid, "has_data": False}
    try:
        schedule = http_json(f"{gateway}/epg/schedule/{enc}", timeout=25)
    except Exception as e:
        schedule = {"error": str(e), "programmes": []}
    return {"now_next": now_next, "schedule": schedule}


def fetch_pluto_now(pluto_id: str | None) -> dict[str, Any] | None:
    if not pluto_id:
        return None
    # Public Pluto timelines API (same family as gateway pluto_epg helper)
    start = datetime.now(timezone.utc) - timedelta(hours=1)
    end = datetime.now(timezone.utc) + timedelta(hours=6)
    url = (
        f"https://api.pluto.tv/v2/channels/{pluto_id}"
        f"?start={start.strftime('%Y-%m-%dT%H:%M:%S.000Z')}"
        f"&stop={end.strftime('%Y-%m-%dT%H:%M:%S.000Z')}"
    )
    try:
        code, raw = http_get(url, timeout=20, retries=2)
        if code >= 400:
            return {"error": f"http_{code}", "source": "pluto"}
        data = json.loads(raw.decode("utf-8", errors="replace"))
    except Exception as e:
        return {"error": str(e), "source": "pluto"}
    timelines = data if isinstance(data, list) else data.get("timelines") or data.get("episodes") or []
    now = datetime.now(timezone.utc)
    current = None
    nxt = None
    for item in timelines:
        st = parse_ts(item.get("start") or item.get("startTime"))
        en = parse_ts(item.get("stop") or item.get("end") or item.get("endTime"))
        title = (
            (item.get("title") or (item.get("episode") or {}).get("name") or item.get("name") or "")
        )
        if not st or not en:
            continue
        row = {"title": title, "start": st.isoformat(), "stop": en.isoformat()}
        if st <= now < en:
            current = row
        elif en > now and nxt is None:
            nxt = row
    return {"source": "pluto", "pluto_id": pluto_id, "now": current, "next": nxt, "has_data": bool(current)}


def run_ocr(frame_path: Path) -> str:
    try:
        proc = subprocess.run(
            ["tesseract", str(frame_path), "stdout", "--psm", "6", "-l", "eng"],
            capture_output=True,
            text=True,
            timeout=12,
            check=False,
        )
        return (proc.stdout or "").strip()
    except FileNotFoundError:
        return ""
    except Exception:
        return ""


def frame_heuristics(frame_path: Path) -> dict[str, Any]:
    """Lightweight bumper/ad heuristics via Pillow stats (no vision model)."""
    out: dict[str, Any] = {"ad_or_bumper_likely": False, "reasons": []}
    try:
        from PIL import Image, ImageStat

        im = Image.open(frame_path).convert("RGB")
        w, h = im.size
        # sample center + corners
        regions = {
            "center": im.crop((w // 4, h // 4, 3 * w // 4, 3 * h // 4)),
            "tl": im.crop((0, 0, w // 5, h // 6)),
            "tr": im.crop((4 * w // 5, 0, w, h // 6)),
            "br": im.crop((4 * w // 5, 5 * h // 6, w, h)),
            "bl": im.crop((0, 5 * h // 6, w // 5, h)),
        }
        stats = {k: ImageStat.Stat(v) for k, v in regions.items()}
        center_mean = sum(stats["center"].mean) / 3
        center_var = sum(stats["center"].var) / 3
        if center_var < 180 and (center_mean < 35 or center_mean > 220):
            out["ad_or_bumper_likely"] = True
            out["reasons"].append("near_solid_frame")
        if center_var < 90:
            out["ad_or_bumper_likely"] = True
            out["reasons"].append("very_low_detail")
        out["center_mean"] = round(center_mean, 1)
        out["center_var"] = round(center_var, 1)
        out["size"] = [w, h]
    except Exception as e:
        out["error"] = str(e)
    return out


def detect_network_bug(ocr_text: str, expected: list[str]) -> dict[str, Any]:
    low = (ocr_text or "").lower()
    found_expected = [b for b in expected if b and b.lower() in low]
    foreign = []
    for label, aliases in WRONG_FEED_ALIASES.items():
        if any(a in low for a in aliases):
            # only foreign if not expected
            if not any(label in (e or "").lower() or a in (e or "").lower() for e in expected for a in aliases):
                foreign.append(label)
    # Adult Swim is allowed for Cartoon Network overnight
    if "adult swim" in foreign and any("cartoon" in (e or "").lower() or e.upper() == "CN" for e in expected):
        foreign = [f for f in foreign if f != "adult swim"]
    return {
        "expected_found": found_expected,
        "foreign_bugs": foreign,
        "wrong_feed_candidate": bool(foreign),
    }


def schedule_window_hits(
    programmes: list[dict],
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
    hits = []
    for p in programmes:
        title = p.get("title") or ""
        st = parse_ts(p.get("start"))
        if st and (st < lo or st > hi):
            continue
        score = title_similarity(query, title)
        if score >= 0.72:
            hits.append(
                {
                    "title": title,
                    "start": p.get("start"),
                    "stop": p.get("stop"),
                    "score": round(score, 3),
                    "delta_hours": round(((st - center).total_seconds() / 3600.0), 2) if st else None,
                }
            )
    hits.sort(key=lambda x: (-x["score"], abs(x["delta_hours"] or 99)))
    return hits[:8]


def extract_title_cues(ocr_text: str) -> list[str]:
    if not ocr_text:
        return []
    lines = [ln.strip() for ln in ocr_text.splitlines() if ln.strip()]
    cues = []
    for ln in lines:
        if len(ln) < 4 or len(ln) > 80:
            continue
        if re.search(r"https?://|www\.|@|\d{1,2}:\d{2}", ln):
            continue
        if sum(c.isalpha() for c in ln) < 4:
            continue
        cues.append(ln)
    # also whole blob collapsed
    blob = re.sub(r"\s+", " ", ocr_text)[:120]
    if blob:
        cues.append(blob)
    return cues[:12]


def classify_row(
    *,
    epg_now: str | None,
    has_data: bool,
    ocr_text: str,
    heuristics: dict[str, Any],
    bug_info: dict[str, Any],
    programmes: list[dict],
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "match": "uncertain",
        "identified": None,
        "notes": "",
        "schedule_hits": [],
        "remap_suggestion": None,
    }

    if bug_info.get("wrong_feed_candidate"):
        result["match"] = "WRONG_FEED"
        result["identified"] = ", ".join(bug_info["foreign_bugs"])
        result["notes"] = f"Network bug ≠ expected; foreign={bug_info['foreign_bugs']}"
        return result

    if heuristics.get("ad_or_bumper_likely") or AD_BUMPER_HINTS.search(ocr_text or ""):
        result["match"] = "uncertain"
        result["identified"] = "ad/bumper (heuristic)"
        result["notes"] = "Ad/bumper skip — cannot confirm title"
        return result

    if not has_data or not epg_now:
        result["match"] = "no_epg"
        result["notes"] = "Stream OK but EPG empty/missing now"
        # still try to surface OCR cues
        cues = extract_title_cues(ocr_text)
        if cues:
            result["identified"] = cues[0][:120]
        return result

    cues = extract_title_cues(ocr_text)
    best_now = 0.0
    best_cue = None
    for cue in cues:
        sc = title_similarity(cue, epg_now)
        if sc > best_now:
            best_now = sc
            best_cue = cue

    if best_now >= 0.82:
        result["match"] = "yes"
        result["identified"] = best_cue
        result["notes"] = f"Fuzzy now match score={best_now:.2f}"
        return result

    # ±12h schedule search using best cue or OCR blob
    query = best_cue or (cues[0] if cues else "")
    hits = schedule_window_hits(programmes, query) if query else []
    result["schedule_hits"] = hits
    if hits and hits[0]["score"] >= 0.82:
        hit = hits[0]
        result["match"] = "no"  # not now, but found on same channel day
        result["identified"] = query[:120]
        result["notes"] = (
            f"Title-like OCR matches schedule '{hit['title']}' "
            f"@ {hit['delta_hours']:+.1f}h (score={hit['score']}) — skew/wrong-slot candidate"
        )
        return result

    if cues and best_now < 0.55:
        result["match"] = "no"
        result["identified"] = (best_cue or cues[0])[:120]
        result["notes"] = f"OCR cues do not match now '{epg_now}' (best={best_now:.2f})"
        return result

    result["match"] = "uncertain"
    result["identified"] = (best_cue or None)
    result["notes"] = "Insufficient OCR/heuristic confidence — needs visual review"
    return result


def load_registry(path: Path) -> dict[str, Any]:
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"updated_at": None, "fingerprints": {}}


def save_registry(path: Path, registry: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    registry["updated_at"] = utc_now()
    path.write_text(json.dumps(registry, indent=2), encoding="utf-8")


def fingerprint_key(cid: str, frame_path: Path, ocr_text: str) -> str:
    import hashlib

    h = hashlib.sha1()
    h.update(cid.encode())
    if frame_path.exists():
        h.update(frame_path.read_bytes()[:65536])
    h.update((ocr_text or "")[:400].encode())
    return h.hexdigest()[:16]


def write_reports(out_dir: Path, report: dict) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    counts: dict[str, int] = {}
    for r in report.get("channels") or []:
        counts[r.get("match") or "unknown"] = counts.get(r.get("match") or "unknown", 0) + 1

    lines = [
        f"# EPG crossmatch batch {report.get('batch')}",
        "",
        f"Protocol: `{report.get('pipeline')}`",
        f"Captured: `{report.get('started_at_utc')}` → `{report.get('finished_at_utc')}`",
        f"Gateway: `{report.get('gateway')}`",
        f"Deploy baseline: `{report.get('deploy_version_baseline')}`",
        "",
        "Summary: " + ", ".join(f"{k}={v}" for k, v in sorted(counts.items())),
        "",
        "| Channel | EPG now | Identified | Match | Note |",
        "|---|---|---|---|---|",
    ]
    for r in report.get("channels") or []:
        epg = (r.get("epg") or {}).get("now_title") or "—"
        lines.append(
            f"| {r.get('name')} (`{r.get('id')}`) | {epg} | "
            f"{(r.get('identified') or '—')[:80]} | **{r.get('match')}** | "
            f"{(r.get('notes') or r.get('detail') or '')[:120]} |"
        )

    if report.get("deferred"):
        lines += ["", "## Deferred", ""]
        for d in report["deferred"]:
            lines.append(f"- `{d.get('id')}` {d.get('name')}: {d.get('reason')}")

    if report.get("remap_suggestions"):
        lines += ["", "## Remap suggestions (not auto-deployed)", ""]
        for s in report["remap_suggestions"]:
            lines.append(f"- `{s.get('id')}` {s.get('name')}: {s.get('suggestion')} — {s.get('reason')}")

    (out_dir / "REPORT.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    match_report = {
        "batch": report.get("batch"),
        "pipeline": report.get("pipeline"),
        "deploy_version": report.get("deploy_version"),
        "deploy_version_baseline": report.get("deploy_version_baseline"),
        "started_at_utc": report.get("started_at_utc"),
        "finished_at_utc": report.get("finished_at_utc"),
        "summary": counts,
        "channels": [
            {
                "id": r.get("id"),
                "name": r.get("name"),
                "tvg_id": (r.get("epg") or {}).get("tvg_id"),
                "epg_now": (r.get("epg") or {}).get("now_title"),
                "identified": r.get("identified"),
                "match": r.get("match"),
                "notes": r.get("notes"),
                "wrong_feed": r.get("match") == "WRONG_FEED",
                "tvinsider_vote": ((r.get("sources") or {}).get("tvinsider") or {}).get("vote"),
                "tvinsider_now": ((r.get("sources") or {}).get("tvinsider") or {}).get("now_title"),
                "schedule_hits": r.get("schedule_hits") or [],
                "frame": r.get("frame"),
            }
            for r in report.get("channels") or []
        ],
        "remap_suggestions": report.get("remap_suggestions") or [],
        "deferred": report.get("deferred") or [],
    }
    (out_dir / "MATCH-REPORT.json").write_text(json.dumps(match_report, indent=2), encoding="utf-8")
    (out_dir / "MATCH-REPORT.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def read_deploy_version() -> str:
    for p in (ROOT / "VERSION", ROOT / "docs" / "VERSION"):
        if p.exists():
            return p.read_text(encoding="utf-8").strip()
    return "unknown"


def process_channel(
    gateway: str,
    ch: dict[str, Any],
    out_dir: Path,
    index: int,
    ffmpeg_timeout: float,
    registry: dict[str, Any],
    *,
    use_tvinsider: bool = True,
) -> dict[str, Any]:
    cid = ch["id"]
    name = ch["name"]
    stem = f"{index:02d}-{slug(cid)}-{slug(name)}"
    row: dict[str, Any] = {
        "id": cid,
        "name": name,
        "group": ch.get("group") or "",
        "captured_at_utc": utc_now(),
        "sources": {},
        "epg": {},
        "match": "pending",
        "identified": None,
        "notes": "",
    }

    # Multi-source EPG
    gw = fetch_gateway_epg(gateway, cid)
    nn = gw["now_next"]
    programmes = (gw["schedule"] or {}).get("programmes") or []
    pluto = fetch_pluto_now(ch.get("pluto_id") or (cid.split(":", 1)[-1] if cid.startswith("iptv:") else None))
    if pluto and cid.startswith(("iptv:", "plu-", "freetv:")):
        row["sources"]["pluto"] = pluto
    row["sources"]["gateway"] = {
        "tvg_id": nn.get("tvg_id"),
        "has_data": nn.get("has_data"),
        "now": nn.get("now"),
        "next": nn.get("next"),
        "schedule_count": len(programmes),
        "error": nn.get("error"),
    }

    # Prefer gateway now; for Pluto channels prefer Pluto if gateway empty
    now_obj = nn.get("now") if isinstance(nn.get("now"), dict) else None
    if (not now_obj or not nn.get("has_data")) and pluto and pluto.get("now"):
        now_obj = pluto["now"]
        has_data = True
        tvg_id = nn.get("tvg_id") or f"pluto:{pluto.get('pluto_id')}"
    else:
        has_data = bool(nn.get("has_data") and now_obj)
        tvg_id = nn.get("tvg_id")

    row["epg"] = {
        "tvg_id": tvg_id,
        "has_data": has_data,
        "now_title": (now_obj or {}).get("title"),
        "now_start": (now_obj or {}).get("start"),
        "now_stop": (now_obj or {}).get("stop"),
        "next_title": ((nn.get("next") or {}) if isinstance(nn.get("next"), dict) else {}).get("title"),
    }

    status, detail = probe_playlist(gateway, cid)
    if status != "ok":
        row["status"] = "deferred"
        row["detail"] = detail
        row["match"] = "deferred"
        return row

    frame_path = out_dir / "frames" / f"{stem}.jpg"
    ok, fdetail = ffmpeg_grab_frame(detail, frame_path, timeout_sec=ffmpeg_timeout)
    if not ok:
        row["status"] = "deferred"
        row["detail"] = fdetail
        row["match"] = "deferred"
        return row

    row["status"] = "ok"
    row["detail"] = fdetail
    row["frame"] = str(frame_path.relative_to(out_dir))

    ocr_text = run_ocr(frame_path)
    heuristics = frame_heuristics(frame_path)
    bug_info = detect_network_bug(ocr_text, list(ch.get("expected_bugs") or []))
    row["ocr_text"] = ocr_text[:800] if ocr_text else ""
    row["heuristics"] = heuristics
    row["bug_info"] = bug_info

    classified = classify_row(
        epg_now=row["epg"].get("now_title"),
        has_data=bool(has_data),
        ocr_text=ocr_text,
        heuristics=heuristics,
        bug_info=bug_info,
        programmes=programmes,
    )
    row.update(classified)

    # TV Insider advisory vote (gateway EPG ↔ public schedule); match-tool only.
    if use_tvinsider and _tvinsider is not None and getattr(_tvinsider, "enabled", lambda: False)():
        try:
            ti_vote = _tvinsider.crossmatch_vote(
                channel_name=name,
                tvg_id=str(tvg_id) if tvg_id else None,
                gateway_now_title=row["epg"].get("now_title"),
                gateway_programmes=programmes,
                ocr_text=ocr_text,
                explicit_slug=ch.get("tvinsider_slug"),
            )
            row["sources"]["tvinsider"] = ti_vote
            new_match, suffix = _tvinsider.apply_vote_to_match(row.get("match") or "uncertain", ti_vote)
            if suffix:
                row["notes"] = ((row.get("notes") or "") + suffix).strip(" |")
            row["match"] = new_match
            if new_match == "WRONG_FEED":
                row["identified"] = row.get("identified") or ti_vote.get("now_title")
        except Exception as e:
            row["sources"]["tvinsider"] = {"source": "tvinsider", "vote": "no_data", "error": str(e)}

    # Fingerprint registry
    fp = fingerprint_key(cid, frame_path, ocr_text)
    entry = {
        "channel_id": cid,
        "name": name,
        "tvg_id": tvg_id,
        "captured_at_utc": row["captured_at_utc"],
        "epg_now": row["epg"].get("now_title"),
        "match": row["match"],
        "identified": row.get("identified"),
        "ocr_preview": (ocr_text or "")[:160],
        "frame": row["frame"],
        "wrong_feed": row["match"] == "WRONG_FEED",
        "tvinsider_vote": ((row.get("sources") or {}).get("tvinsider") or {}).get("vote"),
    }
    registry.setdefault("fingerprints", {})[fp] = entry
    row["fingerprint"] = fp

    # High-confidence remap suggestion only for clear wrong map signals
    if row["match"] == "WRONG_FEED" and bug_info.get("foreign_bugs"):
        row["remap_suggestion"] = {
            "id": cid,
            "name": name,
            "suggestion": f"investigate source feed (foreign bug: {bug_info['foreign_bugs']})",
            "reason": "WRONG_FEED — do not auto-remap tvg_id without confirming catalog id",
            "confidence": "medium",
        }
    return row


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Enhanced EPG crossmatch loop")
    p.add_argument("--batch", required=True, help="Batch id, e.g. A or 07")
    p.add_argument("--gateway", default=DEFAULT_GATEWAY)
    p.add_argument("--channels-file", required=True)
    p.add_argument("--out-root", type=Path, default=DEFAULT_OUT_ROOT)
    p.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    p.add_argument("--sleep", type=float, default=4.0)
    p.add_argument("--epg-gap", type=float, default=0.6)
    p.add_argument("--ffmpeg-timeout", type=float, default=40.0)
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument(
        "--tvinsider",
        dest="tvinsider",
        action="store_true",
        default=None,
        help="Enable TV Insider schedule vote (default: env TVINSIDER_EPG_ENABLE)",
    )
    p.add_argument(
        "--no-tvinsider",
        dest="tvinsider",
        action="store_false",
        help="Disable TV Insider schedule vote",
    )
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    gateway = args.gateway.rstrip("/")
    channels = load_channels(Path(args.channels_file))
    if args.limit and args.limit > 0:
        channels = channels[: args.limit]
    if not channels:
        print("No channels", file=sys.stderr)
        return 2

    use_tvinsider = True
    if args.tvinsider is False:
        use_tvinsider = False
        os.environ["TVINSIDER_EPG_ENABLE"] = "0"
    elif args.tvinsider is True:
        os.environ["TVINSIDER_EPG_ENABLE"] = "1"
        use_tvinsider = True

    batch = str(args.batch)
    out_dir = Path(args.out_root) / f"batch-{batch}"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "frames").mkdir(parents=True, exist_ok=True)

    baseline = read_deploy_version()
    registry = load_registry(Path(args.registry))

    report: dict[str, Any] = {
        "batch": batch,
        "pipeline": "epg-crossmatch-v1",
        "gateway": gateway,
        "deploy_version_baseline": baseline,
        "deploy_version": "unchanged — no solid map fix from this batch yet",
        "tvinsider": bool(use_tvinsider and _tvinsider is not None),
        "started_at_utc": utc_now(),
        "channels": [],
        "ok": [],
        "deferred": [],
        "remap_suggestions": [],
    }

    print(
        f"batch-{batch}: {len(channels)} channels via {gateway} "
        f"(baseline {baseline}; tvinsider={'on' if report['tvinsider'] else 'off'})",
        flush=True,
    )
    if args.dry_run:
        print(json.dumps(channels, indent=2))
        return 0

    epg_snapshot: dict[str, Any] = {}
    for i, ch in enumerate(channels, 1):
        print(f"[{i}/{len(channels)}] {ch['id']} {ch['name']}", flush=True)
        time.sleep(args.epg_gap)
        row = process_channel(
            gateway,
            ch,
            out_dir,
            i,
            args.ffmpeg_timeout,
            registry,
            use_tvinsider=use_tvinsider,
        )
        epg_snapshot[ch["id"]] = row.get("sources")
        report["channels"].append(row)
        if row.get("status") == "ok":
            report["ok"].append(ch["id"])
        else:
            report["deferred"].append(
                {"id": ch["id"], "name": ch["name"], "reason": row.get("detail")}
            )
        if row.get("remap_suggestion"):
            report["remap_suggestions"].append(row["remap_suggestion"])
        report["finished_at_utc"] = utc_now()
        write_reports(out_dir, report)
        save_registry(Path(args.registry), registry)
        time.sleep(args.sleep)

    (out_dir / "epg-now-next.json").write_text(json.dumps(epg_snapshot, indent=2), encoding="utf-8")
    report["finished_at_utc"] = utc_now()
    write_reports(out_dir, report)
    save_registry(Path(args.registry), registry)

    print(
        json.dumps(
            {
                "out": str(out_dir),
                "ok": len(report["ok"]),
                "deferred": len(report["deferred"]),
                "remap_suggestions": len(report["remap_suggestions"]),
                "registry": str(args.registry),
                "tvinsider": report.get("tvinsider"),
            },
            indent=2,
        ),
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
