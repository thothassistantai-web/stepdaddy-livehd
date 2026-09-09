"""Per-session Trakt OAuth (device code flow) and token storage."""

from __future__ import annotations

import json
import os
import threading
import time
from pathlib import Path
from typing import Any

import httpx

TRAKT_CLIENT_ID = os.environ.get("TRAKT_CLIENT_ID", "").strip()
TRAKT_CLIENT_SECRET = os.environ.get("TRAKT_CLIENT_SECRET", "").strip()
TRAKT_API = "https://api.trakt.tv"
TOKENS_PATH = Path(os.environ.get("TRAKT_TOKENS_PATH", "data/trakt_tokens.json"))

_lock = threading.Lock()
_tokens: dict[str, Any] | None = None
_pending: dict[str, dict[str, Any]] = {}


def _default_tokens() -> dict[str, Any]:
    return {"sessions": {}, "updated_at": None}


def _load_tokens() -> dict[str, Any]:
    global _tokens
    if _tokens is not None:
        return _tokens
    if TOKENS_PATH.exists():
        try:
            data = json.loads(TOKENS_PATH.read_text(encoding="utf-8"))
            if isinstance(data, dict) and isinstance(data.get("sessions"), dict):
                _tokens = data
                return _tokens
        except Exception:
            pass
    _tokens = _default_tokens()
    return _tokens


def _save_tokens(data: dict[str, Any]) -> None:
    global _tokens
    data["updated_at"] = time.time()
    TOKENS_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = TOKENS_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    tmp.replace(TOKENS_PATH)
    _tokens = data


def app_configured() -> bool:
    return bool(TRAKT_CLIENT_ID and TRAKT_CLIENT_SECRET)


def session_id_from_request(request) -> str:
    sid = (request.cookies.get("sd_session") or request.cookies.get("sd_device") or "").strip()
    return sid or "anonymous"


def get_access_token(session_id: str) -> str | None:
    env_token = os.environ.get("TRAKT_ACCESS_TOKEN", "").strip()
    if env_token:
        return env_token
    data = _load_tokens()
    row = data["sessions"].get(session_id) or {}
    token = (row.get("access_token") or "").strip()
    return token or None


def get_session_row(session_id: str) -> dict[str, Any]:
    data = _load_tokens()
    return dict(data["sessions"].get(session_id) or {})


def logout(session_id: str) -> None:
    with _lock:
        data = _load_tokens()
        if session_id in data["sessions"]:
            del data["sessions"][session_id]
            _save_tokens(data)
    _pending.pop(session_id, None)


def _trakt_public_headers() -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": TRAKT_CLIENT_ID,
        "User-Agent": "StepDaddyLiveHD/1.0",
    }


def _trakt_user_headers(access_token: str) -> dict[str, Any]:
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {access_token}",
        "trakt-api-version": "2",
        "trakt-api-key": TRAKT_CLIENT_ID,
        "User-Agent": "StepDaddyLiveHD/1.0",
    }


def _fetch_username(access_token: str) -> str | None:
    try:
        with httpx.Client(timeout=12.0) as client:
            r = client.get(TRAKT_API + "/users/settings", headers=_trakt_user_headers(access_token))
        if r.status_code >= 400:
            return None
        data = r.json()
        user = data.get("user") or {}
        return user.get("username") or user.get("name")
    except Exception:
        return None


def device_start(session_id: str) -> dict[str, Any]:
    if not app_configured():
        return {"ok": False, "error": "trakt_not_configured"}
    try:
        with httpx.Client(timeout=12.0) as client:
            r = client.post(
                TRAKT_API + "/oauth/device/code",
                headers=_trakt_public_headers(),
                json={"client_id": TRAKT_CLIENT_ID},
            )
        if r.status_code >= 400:
            return {"ok": False, "error": "trakt_device_code_failed", "detail": r.text[:200]}
        data = r.json()
        _pending[session_id] = {
            "device_code": data.get("device_code"),
            "expires_at": time.time() + int(data.get("expires_in") or 600),
            "interval": max(2, int(data.get("interval") or 5)),
        }
        return {
            "ok": True,
            "user_code": data.get("user_code"),
            "verification_url": data.get("verification_url") or "https://trakt.tv/activate",
            "expires_in": data.get("expires_in"),
            "interval": _pending[session_id]["interval"],
        }
    except Exception as exc:
        return {"ok": False, "error": "trakt_device_start_failed", "detail": str(exc)[:200]}


def device_poll(session_id: str) -> dict[str, Any]:
    pending = _pending.get(session_id)
    if not pending:
        row = get_session_row(session_id)
        if row.get("access_token"):
            return {
                "ok": True,
                "connected": True,
                "username": row.get("username"),
            }
        return {"ok": False, "error": "no_pending_device"}
    if time.time() > float(pending.get("expires_at") or 0):
        _pending.pop(session_id, None)
        return {"ok": False, "error": "device_code_expired"}
    if not app_configured():
        return {"ok": False, "error": "trakt_not_configured"}
    try:
        with httpx.Client(timeout=12.0) as client:
            r = client.post(
                TRAKT_API + "/oauth/device/token",
                headers=_trakt_public_headers(),
                json={
                    "code": pending.get("device_code"),
                    "client_id": TRAKT_CLIENT_ID,
                    "client_secret": TRAKT_CLIENT_SECRET,
                },
            )
        if r.status_code == 400:
            body = r.json() if r.content else {}
            if body.get("error") == "authorization_pending":
                return {"ok": True, "pending": True}
            if body.get("error") == "slow_down":
                return {"ok": True, "pending": True, "slow_down": True}
            if body.get("error") == "expired_token":
                _pending.pop(session_id, None)
                return {"ok": False, "error": "device_code_expired"}
            return {"ok": False, "error": body.get("error") or "poll_failed"}
        if r.status_code >= 400:
            return {"ok": False, "error": "trakt_token_failed", "detail": r.text[:200]}
        token_data = r.json()
        access = token_data.get("access_token")
        if not access:
            return {"ok": False, "error": "missing_access_token"}
        username = _fetch_username(access)
        with _lock:
            store = _load_tokens()
            store["sessions"][session_id] = {
                "access_token": access,
                "refresh_token": token_data.get("refresh_token"),
                "expires_at": time.time() + int(token_data.get("expires_in") or 7200),
                "username": username,
                "connected_at": time.time(),
            }
            _save_tokens(store)
        _pending.pop(session_id, None)
        return {"ok": True, "connected": True, "username": username}
    except Exception as exc:
        return {"ok": False, "error": "trakt_poll_failed", "detail": str(exc)[:200]}


def status(session_id: str) -> dict[str, Any]:
    row = get_session_row(session_id)
    connected = bool(get_access_token(session_id))
    return {
        "app_configured": app_configured(),
        "has_client_id": bool(TRAKT_CLIENT_ID),
        "has_client_secret": bool(TRAKT_CLIENT_SECRET),
        "connected": connected,
        "username": row.get("username") if connected else None,
        "pending": session_id in _pending,
    }
