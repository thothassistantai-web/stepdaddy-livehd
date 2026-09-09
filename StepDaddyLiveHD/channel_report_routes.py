"""Channel report intake — JSON-lite store under logs/channel-reports/."""
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(tags=["channel-reports"])

_ROOT = pathlib.Path(__file__).resolve().parent.parent
_env_dir = os.environ.get("CHANNEL_REPORT_DIR")
REPORT_DIR = pathlib.Path(_env_dir).expanduser() if _env_dir else (_ROOT / "logs" / "channel-reports")
if not REPORT_DIR.is_absolute():
    REPORT_DIR = (_ROOT / REPORT_DIR).resolve()
else:
    REPORT_DIR = REPORT_DIR.resolve()
INDEX_PATH = REPORT_DIR / "index.jsonl"
_DEDUP_WINDOW_SEC = int(os.environ.get("CHANNEL_REPORT_DEDUP_SEC", "900"))
_MAX_BODY_BYTES = int(os.environ.get("CHANNEL_REPORT_MAX_BYTES", str(2_500_000)))
_MAX_SCREENSHOT_CHARS = 1_800_000
_MAX_NOTES = 4000
_MAX_TITLE = 240

_CATEGORIES = frozenset(
    {
        "epg_mismatch",
        "wrong_title",
        "wrong_logo",
        "wrong_network",
        "playback",
        "paint_death",
        "other",
    }
)
_SEVERITIES = frozenset({"low", "medium", "high", "critical"})


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime | None = None) -> str:
    return (dt or _utc_now()).strftime("%Y-%m-%dT%H:%M:%SZ")


def _safe_id(raw: str) -> str:
    s = re.sub(r"[^A-Za-z0-9._-]+", "-", str(raw or "").strip())[:64]
    return s or "unknown"


def _clip(val: Any, n: int) -> str:
    return str(val or "")[:n]


def _bundle_version() -> str | None:
    try:
        root = pathlib.Path(__file__).resolve().parent.parent
        return (root / "VERSION").read_text(encoding="utf-8").strip() or None
    except Exception:
        return None


def _ensure_dir() -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)


def _fingerprint(channel_id: str, categories: list[str], ground_truth: str, severity: str) -> str:
    key = "|".join(
        [
            channel_id.strip().lower(),
            ",".join(sorted(categories)),
            ground_truth.strip().lower(),
            severity.strip().lower(),
        ]
    )
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:24]


def _recent_dup(fp: str, channel_id: str) -> dict[str, Any] | None:
    if not INDEX_PATH.is_file():
        return None
    cutoff = time.time() - _DEDUP_WINDOW_SEC
    try:
        lines = INDEX_PATH.read_text(encoding="utf-8").splitlines()
    except OSError:
        return None
    for line in reversed(lines[-200:]):
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if row.get("fingerprint") != fp:
            continue
        if str(row.get("channel_id") or "") != channel_id:
            continue
        try:
            ts = float(row.get("epoch") or 0)
        except (TypeError, ValueError):
            ts = 0.0
        if ts >= cutoff:
            return row
    return None


def _append_index(row: dict[str, Any]) -> None:
    _ensure_dir()
    with INDEX_PATH.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")


def _sanitize_audit(audit: Any) -> dict[str, Any] | None:
    if not isinstance(audit, dict):
        return None
    # Drop anything that looks like secrets / signed URLs.
    out: dict[str, Any] = {}
    for k, v in list(audit.items())[:80]:
        key = str(k)[:64]
        if key.lower() in {"pin", "token", "cookie", "authorization", "password"}:
            continue
        if isinstance(v, str):
            if "/content/" in v or "token=" in v.lower() or "sig=" in v.lower():
                out[key] = "[redacted-url]"
            else:
                out[key] = v[:2000]
        elif isinstance(v, (int, float, bool)) or v is None:
            out[key] = v
        elif isinstance(v, dict):
            out[key] = _sanitize_audit(v) or {}
        elif isinstance(v, list):
            out[key] = [
                (_sanitize_audit(x) if isinstance(x, dict) else _clip(x, 400))
                for x in v[:40]
            ]
        else:
            out[key] = _clip(v, 400)
    return out


@router.post("/api/channel-reports")
async def create_channel_report(request: Request):
    """Accept a client channel report (audit snapshot + optional screenshot)."""
    try:
        raw = await request.body()
    except Exception:
        return JSONResponse({"ok": False, "error": "read_failed"}, status_code=400)
    if not raw:
        return JSONResponse({"ok": False, "error": "empty"}, status_code=400)
    if len(raw) > _MAX_BODY_BYTES:
        return JSONResponse({"ok": False, "error": "too_large"}, status_code=413)
    try:
        data = json.loads(raw.decode("utf-8", errors="ignore"))
    except json.JSONDecodeError:
        return JSONResponse({"ok": False, "error": "invalid_json"}, status_code=400)
    if not isinstance(data, dict):
        return JSONResponse({"ok": False, "error": "invalid_json"}, status_code=400)

    channel_id = _safe_id(data.get("channel_id") or data.get("channelId") or "")
    if channel_id == "unknown":
        return JSONResponse({"ok": False, "error": "channel_id_required"}, status_code=400)

    cats_in = data.get("categories") or data.get("category") or []
    if isinstance(cats_in, str):
        cats_in = [cats_in]
    categories = []
    for c in cats_in:
        c = str(c or "").strip().lower()
        if c in _CATEGORIES and c not in categories:
            categories.append(c)
    if not categories:
        categories = ["other"]

    severity = str(data.get("severity") or "medium").strip().lower()
    if severity not in _SEVERITIES:
        severity = "medium"

    ground_truth = _clip(data.get("ground_truth_title") or data.get("groundTruthTitle"), _MAX_TITLE)
    actually_airing = _clip(
        data.get("actually_airing") or data.get("whats_actually_airing"), _MAX_TITLE
    )
    notes = _clip(data.get("notes") or data.get("comments"), _MAX_NOTES)
    channel_name = _clip(data.get("channel_name") or data.get("display_name"), _MAX_TITLE)

    fp = _fingerprint(channel_id, categories, ground_truth or actually_airing, severity)
    dup = _recent_dup(fp, channel_id)
    if dup and not data.get("force"):
        return JSONResponse(
            {
                "ok": True,
                "duplicate": True,
                "id": dup.get("id"),
                "path": dup.get("path"),
                "message": "Similar report already filed recently for this channel.",
            }
        )

    now = _utc_now()
    report_id = f"report-{channel_id}-{now.strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:8]}"
    screenshot = data.get("screenshot") or data.get("screenshot_data_url")
    screenshot_meta = None
    if isinstance(screenshot, str) and screenshot.startswith("data:image/"):
        if len(screenshot) > _MAX_SCREENSHOT_CHARS:
            screenshot = None
            screenshot_meta = {"omitted": True, "reason": "too_large"}
        else:
            screenshot_meta = {
                "included": True,
                "chars": len(screenshot),
                "mime": screenshot.split(";", 1)[0].replace("data:", "")[:32],
            }
    else:
        screenshot = None

    client = data.get("client") if isinstance(data.get("client"), dict) else {}
    ua = _clip(client.get("user_agent") or request.headers.get("user-agent"), 400)
    audit = _sanitize_audit(data.get("audit") or data.get("audit_json"))

    record = {
        "schema_version": "1.0.0",
        "id": report_id,
        "created_at": _iso(now),
        "channel_id": channel_id,
        "channel_name": channel_name or None,
        "categories": categories,
        "severity": severity,
        "ground_truth_title": ground_truth or None,
        "actually_airing": actually_airing or None,
        "notes": notes or None,
        "fingerprint": fp,
        "bundle_version_client": _clip(data.get("bundle_version"), 32) or None,
        "bundle_version_server": _bundle_version(),
        "client": {
            "user_agent": ua or None,
            "platform": _clip(client.get("platform"), 80) or None,
            "language": _clip(client.get("language"), 32) or None,
            "viewport": client.get("viewport") if isinstance(client.get("viewport"), dict) else None,
            "timezone": _clip(client.get("timezone"), 64) or None,
            "online": client.get("online") if isinstance(client.get("online"), bool) else None,
        },
        "timestamps": {
            "client_reported_at": _clip(data.get("client_reported_at"), 40) or None,
            "server_received_at": _iso(now),
        },
        "screenshot": screenshot_meta,
        "audit": audit,
        "source": "tv_guide_more_menu",
    }

    _ensure_dir()
    report_path = REPORT_DIR / f"{report_id}.json"
    # Keep screenshot out of the main JSON when huge: sibling .png/.jpg via data URL is overkill;
    # store inline only when present and already bounded.
    if screenshot:
        record["screenshot_data_url"] = screenshot

    try:
        report_path.write_text(
            json.dumps(record, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    except OSError as exc:
        return JSONResponse(
            {"ok": False, "error": "store_failed", "detail": str(exc)[:120]},
            status_code=500,
        )

    index_row = {
        "id": report_id,
        "channel_id": channel_id,
        "categories": categories,
        "severity": severity,
        "fingerprint": fp,
        "epoch": time.time(),
        "created_at": record["created_at"],
        "path": str(report_path),
        "ground_truth_title": ground_truth or None,
    }
    try:
        _append_index(index_row)
    except OSError:
        pass

    return JSONResponse(
        {
            "ok": True,
            "duplicate": False,
            "id": report_id,
            "path": str(report_path),
            "storage_dir": str(REPORT_DIR),
        }
    )


@router.get("/api/channel-reports")
def list_channel_reports(limit: int = 40, channel_id: str | None = None):
    """Tail recent channel reports (ops / audit triage)."""
    lim = max(1, min(int(limit or 40), 200))
    want = _safe_id(channel_id) if channel_id else None
    if want == "unknown":
        want = None
    rows: list[dict[str, Any]] = []
    if INDEX_PATH.is_file():
        try:
            lines = INDEX_PATH.read_text(encoding="utf-8").splitlines()
        except OSError:
            lines = []
        for line in reversed(lines):
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if want and str(row.get("channel_id") or "") != want:
                continue
            rows.append(row)
            if len(rows) >= lim:
                break
    return JSONResponse(
        {
            "ok": True,
            "storage_dir": str(REPORT_DIR),
            "count": len(rows),
            "reports": rows,
        }
    )


@router.get("/api/channel-reports/{report_id}")
def get_channel_report(report_id: str):
    rid = _safe_id(report_id)
    path = REPORT_DIR / f"{rid}.json"
    if not path.is_file():
        # Allow bare id without assuming extension mismatch
        matches = list(REPORT_DIR.glob(f"{rid}*.json")) if REPORT_DIR.is_dir() else []
        if not matches:
            return JSONResponse({"ok": False, "error": "not_found"}, status_code=404)
        path = matches[0]
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return JSONResponse({"ok": False, "error": "read_failed"}, status_code=500)
    # Strip giant screenshot from GET by default? Include flag via query — keep full for operators.
    return JSONResponse({"ok": True, "path": str(path), "report": data})
