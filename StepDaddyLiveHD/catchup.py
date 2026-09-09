"""On-demand IPTV catchup / timeshift ring for watch-party live sync.

Records the gateway live relay into a short rolling HLS window so all party
members share one seekable timeline (VOD-style clock sync applies).
"""

from __future__ import annotations

import asyncio
import os
import shutil
import time
from pathlib import Path
from typing import Any

CATCHUP_DIR = Path(
    os.environ.get(
        "PARTY_CATCHUP_DIR",
        str(Path(__file__).resolve().parent.parent / "catchup-cache"),
    )
)
CATCHUP_WINDOW_SEC = int(os.environ.get("PARTY_CATCHUP_WINDOW_SEC", "300"))  # 5 min
CATCHUP_SEGMENT_SEC = int(os.environ.get("PARTY_CATCHUP_SEGMENT_SEC", "4"))
CATCHUP_MAX_SESSIONS = int(os.environ.get("PARTY_CATCHUP_MAX_SESSIONS", "2"))
CATCHUP_INTERNAL_KEY = os.environ.get("PARTY_CATCHUP_INTERNAL_KEY", "sd-catchup-local")
API_URL = os.environ.get("API_URL", "http://127.0.0.1:3000").rstrip("/")
FFMPEG = os.environ.get("FFMPEG_BIN", shutil.which("ffmpeg") or "ffmpeg")

_sessions: dict[str, dict[str, Any]] = {}  # party_code -> meta
_lock = asyncio.Lock()


def catchup_internal_key() -> str:
    return CATCHUP_INTERNAL_KEY


def _list_size() -> int:
    return max(8, int(CATCHUP_WINDOW_SEC / max(1, CATCHUP_SEGMENT_SEC)) + 2)


def _session_dir(party_code: str) -> Path:
    return CATCHUP_DIR / str(party_code).upper()


def playlist_path(party_code: str) -> Path:
    return _session_dir(party_code) / "index.m3u8"


def public_url(party_code: str) -> str:
    return f"/catchup/{str(party_code).upper()}/index.m3u8"


async def ensure_catchup(channel_id: str, party_code: str) -> dict[str, Any]:
    """Start or refresh a catchup ring for this party+channel."""
    code = str(party_code or "").upper()
    channel_id = str(channel_id or "").strip()
    if not code or not channel_id:
        raise ValueError("channel_and_code_required")
    if not shutil.which(FFMPEG) and FFMPEG == "ffmpeg":
        # still try path
        pass

    async with _lock:
        existing = _sessions.get(code)
        if existing and existing.get("channel_id") == channel_id and existing.get("proc"):
            proc = existing["proc"]
            if proc.returncode is None:
                existing["last_active"] = time.time()
                return {"url": public_url(code), "channel_id": channel_id, "ready": playlist_path(code).exists()}

        # Evict if at capacity
        if code not in _sessions and len(_sessions) >= CATCHUP_MAX_SESSIONS:
            # Drop oldest idle
            oldest = sorted(_sessions.items(), key=lambda kv: kv[1].get("last_active", 0))
            if oldest:
                await _stop_unlocked(oldest[0][0])

        await _stop_unlocked(code)
        out_dir = _session_dir(code)
        out_dir.mkdir(parents=True, exist_ok=True)
        for stale in out_dir.glob("*"):
            try:
                stale.unlink()
            except Exception:
                pass

        src = f"{API_URL}/live/{channel_id}.m3u8"
        list_size = _list_size()
        cmd = [
            FFMPEG,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-headers",
            f"X-Internal-Catchup: {CATCHUP_INTERNAL_KEY}\r\n",
            "-i",
            src,
            "-c",
            "copy",
            "-f",
            "hls",
            "-hls_time",
            str(CATCHUP_SEGMENT_SEC),
            "-hls_list_size",
            str(list_size),
            "-hls_flags",
            "delete_segments+append_list+omit_endlist",
            "-hls_segment_filename",
            str(out_dir / "seg_%05d.ts"),
            str(out_dir / "index.m3u8"),
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        _sessions[code] = {
            "channel_id": channel_id,
            "proc": proc,
            "started": time.time(),
            "last_active": time.time(),
            "cmd": cmd,
        }

    # Wait briefly for first playlist
    ready = False
    for _ in range(40):
        if playlist_path(code).exists() and playlist_path(code).stat().st_size > 32:
            ready = True
            break
        if proc.returncode is not None:
            err = b""
            try:
                err = await proc.stderr.read() if proc.stderr else b""
            except Exception:
                pass
            raise RuntimeError(f"catchup_ffmpeg_exit:{proc.returncode}:{err[:200]!r}")
        await asyncio.sleep(0.25)

    return {"url": public_url(code), "channel_id": channel_id, "ready": ready}


def release_catchup(party_code: str) -> None:
    code = str(party_code or "").upper()
    if not code:
        return
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(_stop(code))
        else:
            loop.run_until_complete(_stop(code))
    except Exception:
        try:
            asyncio.run(_stop(code))
        except Exception:
            pass


async def _stop(party_code: str) -> None:
    async with _lock:
        await _stop_unlocked(party_code)


async def _stop_unlocked(party_code: str) -> None:
    code = str(party_code or "").upper()
    meta = _sessions.pop(code, None)
    if meta and meta.get("proc"):
        proc = meta["proc"]
        try:
            proc.terminate()
            try:
                await asyncio.wait_for(proc.wait(), timeout=3)
            except Exception:
                proc.kill()
        except Exception:
            pass
    out_dir = _session_dir(code)
    if out_dir.exists():
        try:
            shutil.rmtree(out_dir, ignore_errors=True)
        except Exception:
            pass


async def purge_idle(max_idle_sec: float = 600.0) -> None:
    now = time.time()
    async with _lock:
        dead = [c for c, m in _sessions.items() if now - m.get("last_active", 0) > max_idle_sec]
        for c in dead:
            await _stop_unlocked(c)


def touch(party_code: str) -> None:
    meta = _sessions.get(str(party_code or "").upper())
    if meta:
        meta["last_active"] = time.time()
