#!/usr/bin/env python3
"""EPG match batch runner — stream-frame pipeline (no browser).

Optimal path for batch 2+:
  1. Load channel list (batch JSON or major-network filter)
  2. Fetch /epg/now-next once per wave (polite gaps)
  3. Resolve /live/{id}.m3u8 → grab one frame with ffmpeg
  4. On failure/timeout → deferred; continue
  5. Write field-test-epg-batches/batch-NN/{frames,report.json}

Concurrency: 1–2 max. Backoff on 429/503. Safe for laptop or VPS.

Examples:
  python3 scripts/epg-match-batch.py --batch 02 --channels-file scripts/batches/uk-majors.json
  python3 scripts/epg-match-batch.py --batch 02 --filter uk-majors --gateway https://sdgateway.duckdns.org
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
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT_ROOT = ROOT / "field-test-epg-batches"
DEFAULT_GATEWAY = os.environ.get("SD_GATEWAY", "https://sdgateway.duckdns.org").rstrip("/")
UA = "StepDaddy-epg-match-batch/1.0"

# Built-in major-network sets for quick kicks
PRESETS: dict[str, list[dict[str, str]]] = {
    "uk-majors": [
        {"id": "356", "name": "BBC One UK"},
        {"id": "357", "name": "BBC Two UK"},
        {"id": "350", "name": "ITV1 UK"},
        {"id": "354", "name": "Channel 4 UK"},
        {"id": "355", "name": "Channel 5 UK"},
        {"id": "363", "name": "E4 UK"},
        {"id": "688", "name": "Film4 UK"},
        {"id": "671", "name": "Sky Cinema Premiere UK"},
        {"id": "673", "name": "Sky Cinema Hits UK"},
        {"id": "672", "name": "Sky Cinema Select UK"},
        {"id": "362", "name": "Sky Atlantic UK"},
        {"id": "349", "name": "BBC News UK"},
    ],
    "us-premium": [
        {"id": "321", "name": "HBO USA"},
        {"id": "689", "name": "HBO2 USA"},
        {"id": "690", "name": "HBO Comedy USA"},
        {"id": "693", "name": "HBO Signature USA"},
        {"id": "694", "name": "HBO Zone USA"},
        {"id": "374", "name": "Cinemax USA"},
        {"id": "333", "name": "Showtime USA"},
        {"id": "792", "name": "Showtime 2 USA"},
        {"id": "793", "name": "Showtime Showcase USA"},
        {"id": "335", "name": "Starz"},
        {"id": "970", "name": "Starz Cinema"},
        {"id": "302", "name": "A&E USA"},
        {"id": "345", "name": "CNN USA"},
    ],
    "us-broadcast-cable": [
        {"id": "51", "name": "ABC USA"},
        {"id": "52", "name": "CBS USA"},
        {"id": "53", "name": "NBC USA"},
        {"id": "54", "name": "Fox USA"},
        {"id": "302", "name": "A&E USA"},
        {"id": "345", "name": "CNN USA"},
        {"id": "347", "name": "Fox News USA"},
        {"id": "327", "name": "MSNBC USA"},
        {"id": "336", "name": "TBS USA"},
        {"id": "338", "name": "TNT USA"},
        {"id": "343", "name": "USA Network"},
        {"id": "317", "name": "FX USA"},
    ],
    "pluto-fast": [
        # IDs resolved at runtime from /channels if present; placeholders empty
    ],
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def slug(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", (name or "").strip()).strip("-").lower()
    return s or "channel"


def http_get(
    url: str,
    *,
    timeout: float = 25,
    retries: int = 3,
    backoff: float = 2.0,
) -> tuple[int, bytes]:
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


def load_channels(args: argparse.Namespace, gateway: str) -> list[dict[str, str]]:
    if args.channels_file:
        payload = json.loads(Path(args.channels_file).read_text(encoding="utf-8"))
        if isinstance(payload, dict) and "channels" in payload:
            rows = payload["channels"]
        elif isinstance(payload, list):
            rows = payload
        else:
            raise SystemExit(f"Unrecognized channels file shape: {args.channels_file}")
        out = []
        for r in rows:
            cid = str(r.get("id") or r.get("channel_id") or "").strip()
            if not cid:
                continue
            out.append({"id": cid, "name": str(r.get("name") or cid), "group": str(r.get("group") or "")})
        return out

    preset = (args.filter or "").strip().lower()
    if preset in PRESETS and PRESETS[preset]:
        return [dict(x) for x in PRESETS[preset]]

    if preset == "pluto-fast":
        # Resolve Pluto/FAST from live catalog (polite single fetch)
        catalog = http_json(f"{gateway}/channels", timeout=40)
        items = catalog if isinstance(catalog, list) else (catalog.get("channels") or catalog.get("items") or [])
        out = []
        for c in items:
            cid = str(c.get("id") or c.get("channel_id") or "")
            name = str(c.get("name") or "")
            tags = " ".join(str(t) for t in (c.get("tags") or [])).lower()
            blob = f"{cid} {name} {tags} {c.get('source') or ''}".lower()
            if not cid.startswith(("plu-", "freetv:", "iptv:")) and "pluto" not in blob:
                continue
            if "pluto" in blob or cid.startswith("plu-"):
                out.append({"id": cid, "name": name or cid, "group": "pluto"})
            if len(out) >= int(args.limit or 15):
                break
        return out

    raise SystemExit("Provide --channels-file or --filter (uk-majors|us-premium|us-broadcast-cable|pluto-fast)")


def fetch_epg_wave(gateway: str, channels: list[dict[str, str]], gap: float) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for ch in channels:
        cid = ch["id"]
        try:
            time.sleep(gap)
            out[cid] = http_json(f"{gateway}/epg/now-next/{cid}", timeout=20)
        except Exception as e:
            out[cid] = {"error": str(e), "channel_id": cid, "has_data": False}
    return out


def _ffmpeg_bin() -> str:
    """Prefer distro ffmpeg; ~/.local static build segfaults on some HLS paths."""
    for cand in ("/usr/bin/ffmpeg", "/bin/ffmpeg", "ffmpeg"):
        if cand.startswith("/") and not Path(cand).exists():
            continue
        return cand
    return "ffmpeg"


def ffmpeg_grab_frame(
    playlist_url: str,
    dest: Path,
    *,
    timeout_sec: float = 25,
) -> tuple[bool, str]:
    """Grab one JPEG frame from HLS playlist. Returns (ok, detail)."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    ff = _ffmpeg_bin()
    # Prefer seeking near live edge; discard audio; single frame
    cmd = [
        ff,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-user_agent",
        UA,
        "-rw_timeout",
        "15000000",  # microseconds
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
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_sec,
            check=False,
        )
    except subprocess.TimeoutExpired:
        if dest.exists():
            dest.unlink(missing_ok=True)
        return False, "ffmpeg_timeout"
    except FileNotFoundError:
        return False, "ffmpeg_missing"
    if proc.returncode != 0 or not dest.exists() or dest.stat().st_size < 800:
        if dest.exists() and dest.stat().st_size < 800:
            dest.unlink(missing_ok=True)
        err = (proc.stderr or proc.stdout or "").strip().splitlines()
        detail = err[-1][:240] if err else f"ffmpeg_exit_{proc.returncode}"
        # classify common failures
        low = detail.lower()
        if "404" in low or "403" in low:
            return False, f"http_denied:{detail}"
        if "502" in low or "503" in low or "429" in low:
            return False, f"upstream_busy:{detail}"
        return False, detail or "ffmpeg_failed"
    return True, f"frame_bytes={dest.stat().st_size}"


def probe_playlist(gateway: str, cid: str) -> tuple[str, str]:
    """Return (status, detail) for playlist reachability before ffmpeg."""
    url = f"{gateway}/live/{cid}.m3u8"
    try:
        code, raw = http_get(url, timeout=18, retries=2, backoff=1.5)
    except Exception as e:
        return "deferred", f"playlist_error:{e}"
    if code in (429, 503):
        return "deferred", f"playlist_http_{code}"
    if code >= 400:
        return "deferred", f"playlist_http_{code}"
    text = raw.decode("utf-8", errors="replace")
    if "#EXTM3U" not in text:
        return "deferred", "playlist_not_m3u8"
    if not re.search(r"https?://|\.ts|\.m4s|content/", text):
        return "deferred", "playlist_empty"
    return "ok", url


def process_channel(
    gateway: str,
    ch: dict[str, str],
    epg: dict,
    out_dir: Path,
    index: int,
    ffmpeg_timeout: float,
) -> dict[str, Any]:
    cid = ch["id"]
    name = ch["name"]
    stem = f"{index:02d}-{cid}-{slug(name)}"
    row: dict[str, Any] = {
        "id": cid,
        "name": name,
        "group": ch.get("group") or "",
        "captured_at_utc": utc_now(),
        "epg": {
            "tvg_id": epg.get("tvg_id"),
            "has_data": epg.get("has_data"),
            "now_title": (epg.get("now") or {}).get("title") if isinstance(epg.get("now"), dict) else None,
            "now_start": (epg.get("now") or {}).get("start") if isinstance(epg.get("now"), dict) else None,
            "now_stop": (epg.get("now") or {}).get("stop") if isinstance(epg.get("now"), dict) else None,
            "next_title": (epg.get("next") or {}).get("title") if isinstance(epg.get("next"), dict) else None,
            "error": epg.get("error"),
        },
        "match": "pending_review",
        "identified": None,
        "notes": "",
    }

    status, detail = probe_playlist(gateway, cid)
    if status != "ok":
        row["status"] = "deferred"
        row["detail"] = detail
        return row

    playlist_url = detail
    frame_path = out_dir / "frames" / f"{stem}.jpg"
    ok, fdetail = ffmpeg_grab_frame(playlist_url, frame_path, timeout_sec=ffmpeg_timeout)
    if not ok:
        row["status"] = "deferred"
        row["detail"] = fdetail
        return row

    row["status"] = "ok"
    row["detail"] = fdetail
    row["frame"] = str(frame_path.relative_to(out_dir))
    # Optional light OCR if tesseract present (best-effort, never blocks)
    try:
        ocr = subprocess.run(
            ["tesseract", str(frame_path), "stdout", "--psm", "6"],
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
        )
        text = (ocr.stdout or "").strip()
        if text and len(text) >= 4:
            row["ocr_text"] = text[:500]
    except Exception:
        pass
    return row


def write_report(out_dir: Path, report: dict) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "frames").mkdir(parents=True, exist_ok=True)
    (out_dir / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    # Markdown summary for humans
    lines = [
        f"# EPG match batch {report.get('batch')}",
        "",
        f"Captured: `{report.get('started_at_utc')}` → `{report.get('finished_at_utc')}`",
        f"Gateway: `{report.get('gateway')}`",
        f"Pipeline: `{report.get('pipeline')}`",
        "",
        f"- ok: **{len(report.get('ok', []))}**",
        f"- deferred: **{len(report.get('deferred', []))}**",
        f"- pending_review: **{sum(1 for r in report.get('channels', []) if r.get('match') == 'pending_review')}**",
        "",
        "| # | Channel | EPG now | Status | Frame | Match |",
        "|---|---------|---------|--------|-------|-------|",
    ]
    for i, r in enumerate(report.get("channels") or [], 1):
        lines.append(
            f"| {i} | {r.get('name')} (`{r.get('id')}`) | {r.get('epg', {}).get('now_title') or '—'} | "
            f"{r.get('status')} | {r.get('frame') or r.get('detail')} | {r.get('match')} |"
        )
    if report.get("deferred"):
        lines += ["", "## Deferred", ""]
        for d in report["deferred"]:
            lines.append(f"- `{d.get('id')}` {d.get('name')}: {d.get('reason') or d.get('detail')}")
    (out_dir / "REPORT.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="EPG vs stream-frame match batch (ffmpeg, no browser)")
    p.add_argument("--batch", required=True, help="Batch number, e.g. 02")
    p.add_argument("--gateway", default=DEFAULT_GATEWAY)
    p.add_argument("--channels-file", help="JSON list or {channels:[...]}")
    p.add_argument("--filter", help="Preset: uk-majors | us-premium | us-broadcast-cable | pluto-fast")
    p.add_argument("--out-root", type=Path, default=DEFAULT_OUT_ROOT)
    p.add_argument("--concurrency", type=int, default=1, choices=[1, 2])
    p.add_argument("--sleep", type=float, default=3.0, help="Seconds between channel starts")
    p.add_argument("--epg-gap", type=float, default=0.8, help="Seconds between EPG API calls")
    p.add_argument("--ffmpeg-timeout", type=float, default=28.0)
    p.add_argument("--limit", type=int, default=0, help="Optional cap on channels")
    p.add_argument("--dry-run", action="store_true")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    gateway = args.gateway.rstrip("/")
    channels = load_channels(args, gateway)
    if args.limit and args.limit > 0:
        channels = channels[: args.limit]
    if not channels:
        print("No channels to process", file=sys.stderr)
        return 2

    batch = str(args.batch).zfill(2) if str(args.batch).isdigit() else str(args.batch)
    out_dir = Path(args.out_root) / f"batch-{batch}"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "frames").mkdir(parents=True, exist_ok=True)

    report: dict[str, Any] = {
        "batch": batch,
        "pipeline": "ffmpeg-live-frame",
        "gateway": gateway,
        "started_at_utc": utc_now(),
        "channels": [],
        "ok": [],
        "deferred": [],
        "prior_mismatches_resolved": False,
        "notes": "Frames saved for human/agent match review. match=pending_review until verified.",
    }

    print(f"batch-{batch}: {len(channels)} channels via {gateway}", flush=True)
    if args.dry_run:
        print(json.dumps(channels, indent=2))
        return 0

    epg_map = fetch_epg_wave(gateway, channels, gap=args.epg_gap)
    (out_dir / "epg-now-next.json").write_text(json.dumps(epg_map, indent=2), encoding="utf-8")

    # Sequential or lightly concurrent (max 2)
    if args.concurrency == 1:
        for i, ch in enumerate(channels, 1):
            print(f"[{i}/{len(channels)}] {ch['id']} {ch['name']}", flush=True)
            row = process_channel(
                gateway, ch, epg_map.get(ch["id"], {}), out_dir, i, args.ffmpeg_timeout
            )
            report["channels"].append(row)
            if row["status"] == "ok":
                report["ok"].append(ch["id"])
            else:
                report["deferred"].append(
                    {"id": ch["id"], "name": ch["name"], "reason": row.get("detail")}
                )
            write_report(out_dir, {**report, "finished_at_utc": utc_now()})
            time.sleep(args.sleep)
    else:
        # concurrency 2 with staggered starts
        with ThreadPoolExecutor(max_workers=2) as pool:
            futs = {}
            for i, ch in enumerate(channels, 1):
                if i > 1:
                    time.sleep(args.sleep)
                print(f"[{i}/{len(channels)}] start {ch['id']} {ch['name']}", flush=True)
                fut = pool.submit(
                    process_channel,
                    gateway,
                    ch,
                    epg_map.get(ch["id"], {}),
                    out_dir,
                    i,
                    args.ffmpeg_timeout,
                )
                futs[fut] = ch
            for fut in as_completed(futs):
                row = fut.result()
                report["channels"].append(row)
                if row["status"] == "ok":
                    report["ok"].append(row["id"])
                else:
                    report["deferred"].append(
                        {"id": row["id"], "name": row["name"], "reason": row.get("detail")}
                    )
                write_report(out_dir, {**report, "finished_at_utc": utc_now()})

    # Stable order by channel list
    order = {c["id"]: i for i, c in enumerate(channels)}
    report["channels"].sort(key=lambda r: order.get(r["id"], 999))
    report["finished_at_utc"] = utc_now()
    write_report(out_dir, report)
    print(
        json.dumps(
            {
                "out": str(out_dir),
                "ok": len(report["ok"]),
                "deferred": len(report["deferred"]),
            },
            indent=2,
        ),
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
