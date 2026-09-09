"""Free-tier awareness endpoint — reads local /proc only, no external calls."""
from __future__ import annotations

import os
import pathlib
import time
from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from .pin_auth import session_count

router = APIRouter(tags=["health"])

_SHAPE = os.environ.get("OCI_SHAPE", "VM.Standard.A1.Flex")
_OCPU = int(os.environ.get("OCI_OCPU", "2"))
_RAM_GB = int(os.environ.get("OCI_RAM_GB", "8"))
_MEMORY_WARN_PCT = float(os.environ.get("FREE_TIER_MEMORY_WARN_PCT", "80"))


def _meminfo() -> dict[str, int]:
    out: dict[str, int] = {}
    try:
        for line in pathlib.Path("/proc/meminfo").read_text().splitlines():
            key, val = line.split(":", 1)
            out[key.strip()] = int(val.strip().split()[0])
    except OSError:
        pass
    return out


def _memory_stats() -> dict[str, Any]:
    mi = _meminfo()
    total_kb = mi.get("MemTotal", 0)
    avail_kb = mi.get("MemAvailable", 0)
    used_kb = max(0, total_kb - avail_kb) if total_kb else 0
    pct = round(100.0 * used_kb / total_kb, 1) if total_kb else 0.0
    return {
        "total_mb": total_kb // 1024,
        "available_mb": avail_kb // 1024,
        "used_mb": used_kb // 1024,
        "used_pct": pct,
        "warning": pct >= _MEMORY_WARN_PCT,
    }


def _tcp_established_count() -> int | None:
    try:
        count = 0
        with pathlib.Path("/proc/net/tcp").open() as f:
            next(f)
            for line in f:
                parts = line.split()
                if len(parts) > 3 and parts[3] == "01":
                    count += 1
        with pathlib.Path("/proc/net/tcp6").open() as f:
            next(f)
            for line in f:
                parts = line.split()
                if len(parts) > 3 and parts[3] == "01":
                    count += 1
        return count
    except OSError:
        return None


def _net_dev_bytes() -> dict[str, Any]:
    """Cumulative interface counters from /proc/net/dev (not monthly)."""
    primary = os.environ.get("NET_DEV_PRIMARY", "")
    interfaces: dict[str, dict[str, int]] = {}
    try:
        for line in pathlib.Path("/proc/net/dev").read_text().splitlines()[2:]:
            if ":" not in line:
                continue
            name, rest = line.split(":", 1)
            name = name.strip()
            cols = rest.split()
            if len(cols) < 9:
                continue
            interfaces[name] = {
                "rx_bytes": int(cols[0]),
                "tx_bytes": int(cols[8]),
            }
    except OSError:
        return {"primary": None, "interfaces": {}}

    if not primary:
        for candidate in ("ens3", "enp0s6", "enp0s5", "eth0"):
            if candidate in interfaces:
                primary = candidate
                break
        if not primary:
            non_lo = [n for n in interfaces if n != "lo"]
            primary = non_lo[0] if non_lo else next(iter(interfaces), None)

    return {
        "primary": primary,
        "primary_rx_bytes": interfaces.get(primary or "", {}).get("rx_bytes"),
        "primary_tx_bytes": interfaces.get(primary or "", {}).get("tx_bytes"),
        "interfaces": interfaces,
        "note": "Cumulative since boot; use vnstat or OCI console for monthly egress.",
    }


def _vnstat_monthly() -> dict[str, Any] | None:
    try:
        import subprocess

        r = subprocess.run(
            ["vnstat", "--json", "m"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if r.returncode != 0:
            return None
        import json

        data = json.loads(r.stdout)
        iface = data.get("interfaces", [{}])[0]
        tx = iface.get("traffic", {}).get("month", [{}])[-1].get("tx", 0)
        rx = iface.get("traffic", {}).get("month", [{}])[-1].get("rx", 0)
        return {"tx_bytes_month": tx, "rx_bytes_month": rx, "interface": iface.get("name")}
    except Exception:
        return None


@router.get("/health/free-tier")
def health_free_tier():
    mem = _memory_stats()
    net = _net_dev_bytes()
    vnstat = _vnstat_monthly()
    warnings: list[str] = []
    if mem.get("warning"):
        warnings.append(f"memory_used_pct>={_MEMORY_WARN_PCT}")
    if os.environ.get("PIN_AUTH_ENABLED", "").upper() not in ("1", "TRUE", "YES"):
        warnings.append("pin_auth_disabled")

    body: dict[str, Any] = {
        "ok": not warnings,
        "shape": _SHAPE,
        "ocpu": _OCPU,
        "ram_gb_allocated": _RAM_GB,
        "memory": mem,
        "tcp_established": _tcp_established_count(),
        "pin_sessions": session_count(),
        "pin_auth_enabled": os.environ.get("PIN_AUTH_ENABLED", "").upper() in ("1", "TRUE", "YES"),
        "uvicorn": {
            "workers": 1,
            "limit_concurrency": int(os.environ.get("UVICORN_LIMIT_CONCURRENCY", "40")),
            "memory_max_mb": int(os.environ.get("SYSTEMD_MEMORY_MAX_MB", "1800")),
        },
        "network": net,
        "warnings": warnings,
        "uptime_seconds": round(
            float(pathlib.Path("/proc/uptime").read_text().split()[0]), 1
        )
        if pathlib.Path("/proc/uptime").is_file()
        else 0.0,
    }
    if vnstat:
        body["vnstat_month"] = vnstat
        tx_gb = (vnstat.get("tx_bytes_month") or 0) / (1024**3)
        body["egress_gb_month_estimate"] = round(tx_gb, 2)
        if tx_gb > 8000:
            warnings.append("egress_approaching_10tb_free_tier")
            body["ok"] = False
        body["warnings"] = warnings
    return JSONResponse(content=body)
