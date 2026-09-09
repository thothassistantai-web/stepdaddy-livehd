"""Stability report endpoint — low RAM, reads local log files only."""
from __future__ import annotations

import json
import os
import pathlib
import time
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

router = APIRouter(tags=["health"])

LOG_DIR = pathlib.Path(os.environ.get("STABILITY_LOG_DIR", "logs"))
INCIDENTS = LOG_DIR / "incidents.log"
SNAPSHOTS = LOG_DIR / "health-snapshots.log"
CLIENT_METRICS = LOG_DIR / "client-metrics.log"
_CLIENT_METRICS_MAX_BYTES = 512_000
_CLIENT_METRICS_TYPES = frozenset({"paint_dead"})

KNOWN_ISSUES = [
    {
        "id": "vm_kernel_freeze",
        "severity": "critical",
        "description": "Full VM hang on 1GB micro — SSH/HTTP accept TCP but no response. Watchdog cannot fix.",
        "mitigation": "OCI soft reset: oci compute instance action --action SOFTRESET --instance-id <ocid>",
    },
    {
        "id": "upstream_cdn_403",
        "severity": "high",
        "description": "Upstream CDN returns 403 without Referer or on stale domains.",
        "mitigation": "Domain-relay sync (cron 6h + startup); verify daddylive.li primary.",
    },
    {
        "id": "segment_truncation",
        "severity": "medium",
        "description": "HLS segments truncated (~4KB) causing playback stall.",
        "mitigation": "Master URL rotation / stream cache refresh; retry via /live/{id}.m3u8.",
    },
    {
        "id": "master_url_rotation",
        "severity": "medium",
        "description": "Upstream rotates master playlist URL; cached URL goes stale mid-play.",
        "mitigation": "Stream cache TTL + player stall reload; mirror failover in step_daddy.py.",
    },
    {
        "id": "oci_stopping_stuck",
        "severity": "high",
        "description": "Instance stuck in STOPPING during soft reset — external access dead until RUNNING.",
        "mitigation": "Wait or force stop/start via OCI console/CLI.",
    },
]


def _read_json_lines(path: pathlib.Path, limit: int = 50) -> list[dict[str, Any]]:
    if not path.is_file():
        return []
    lines: list[str] = []
    try:
        with path.open() as f:
            for line in f:
                line = line.strip()
                if line:
                    lines.append(line)
    except OSError:
        return []
    out: list[dict[str, Any]] = []
    for line in lines[-limit:]:
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


def _uptime_seconds() -> float:
    try:
        return float(pathlib.Path("/proc/uptime").read_text().split()[0])
    except (OSError, ValueError, IndexError):
        return 0.0


def _append_client_metric(row: dict[str, Any]) -> None:
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        line = json.dumps(row, separators=(",", ":"), ensure_ascii=False) + "\n"
        with CLIENT_METRICS.open("a", encoding="utf-8") as f:
            f.write(line)
        if CLIENT_METRICS.is_file() and CLIENT_METRICS.stat().st_size > _CLIENT_METRICS_MAX_BYTES:
            # Cheap ring trim: keep the last ~half of the file.
            raw = CLIENT_METRICS.read_bytes()
            cut = raw[len(raw) // 2 :]
            nl = cut.find(b"\n")
            if nl >= 0:
                cut = cut[nl + 1 :]
            CLIENT_METRICS.write_bytes(cut)
    except OSError:
        pass


@router.post("/api/client-metrics")
async def client_metrics(request: Request):
    """Lightweight browser beacon (paint-dead temporary/static). No auth; capped."""
    try:
        body = await request.body()
        if not body or len(body) > 4096:
            return Response(status_code=204)
        data = json.loads(body.decode("utf-8", errors="ignore"))
        if not isinstance(data, dict):
            return Response(status_code=204)
        kind = str(data.get("type") or "")
        if kind not in _CLIENT_METRICS_TYPES:
            return Response(status_code=204)
        row = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "type": kind,
            "kind": str(data.get("kind") or "")[:32],
            "channelId": str(data.get("channelId") or "")[:64],
            "durationMs": int(data.get("durationMs") or 0),
            "graceMs": int(data.get("graceMs") or 0),
            "width": int(data.get("width") or 0),
            "height": int(data.get("height") or 0),
            "codec": str(data.get("codec") or "")[:64],
        }
        _append_client_metric(row)
    except Exception:
        pass
    return Response(status_code=204)


@router.get("/api/client-metrics")
def client_metrics_tail(limit: int = 40):
    """Inspect recent client paint-dead beacons (temporary vs static)."""
    lim = max(1, min(int(limit or 40), 200))
    rows = _read_json_lines(CLIENT_METRICS, lim)
    temporary = sum(1 for r in rows if r.get("kind") == "temporary")
    static_n = sum(1 for r in rows if r.get("kind") == "static")
    return JSONResponse(
        content={
            "ok": True,
            "path": str(CLIENT_METRICS),
            "temporary": temporary,
            "static": static_n,
            "events": rows[-lim:],
        }
    )


@router.get("/health/stability")
def health_stability():
    incidents = _read_json_lines(INCIDENTS, 100)
    snapshots = _read_json_lines(SNAPSHOTS, 5)
    recent_failures = [i for i in incidents if i.get("event") in ("health_fail", "restart", "downtime", "vm_freeze")]
    last_downtime = recent_failures[-1] if recent_failures else None
    last_ok = next((s for s in reversed(snapshots) if s.get("ok") is True), None)
    body = {
        "ok": last_ok is not None or not snapshots,
        "uptime_seconds": round(_uptime_seconds(), 1),
        "incident_count_24h": sum(
            1
            for i in incidents
            if i.get("event") in ("health_fail", "restart", "downtime", "recovery", "vm_freeze", "boot")
            and _is_recent(i.get("ts"), hours=24)
        ),
        "recent_incidents": incidents[-10:],
        "last_downtime": last_downtime,
        "last_snapshot": snapshots[-1] if snapshots else None,
        "known_issues": KNOWN_ISSUES,
        "log_paths": {
            "incidents": str(INCIDENTS),
            "stability": str(LOG_DIR / "stability.log"),
            "watchdog": str(LOG_DIR / "watchdog-health.log"),
            "snapshots": str(SNAPSHOTS),
        },
    }
    return JSONResponse(content=body)


def _is_recent(ts: str | None, hours: int = 24) -> bool:
    if not ts:
        return False
    try:
        # ISO8601 Z
        from datetime import datetime, timezone

        dt = datetime.strptime(ts.replace("Z", "+0000"), "%Y-%m-%dT%H:%M:%S%z")
        return (datetime.now(timezone.utc) - dt).total_seconds() < hours * 3600
    except ValueError:
        return False
