"""PIN-based session authentication for StepDaddyLiveHD gateway."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import threading
import time
from pathlib import Path
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, RedirectResponse, Response

from StepDaddyLiveHD.auth_template import render_auth_page, render_session_ended_page

PINS_FILE = Path(os.environ.get("PIN_CONFIG", "config/pins.json"))
SESSION_COOKIE = "sd_session"
DEVICE_COOKIE = "sd_device"
GUEST_COOKIE = "sd_guest"
SESSION_TTL = int(os.environ.get("PIN_SESSION_TTL", str(30 * 24 * 3600)))
AUTH_ENABLED = os.environ.get("PIN_AUTH_ENABLED", "1").strip().lower() not in ("0", "false", "no")

# Gapless no-PIN grace (household gateway soft entry)
GUEST_ENABLED = os.environ.get("PIN_GUEST_ENABLED", "1").strip().lower() not in ("0", "false", "no")
GUEST_GRACE_SECONDS = int(os.environ.get("PIN_GUEST_GRACE_SECONDS", "900"))  # 15 min
GUEST_REMINDER_FIRST_SECONDS = int(os.environ.get("PIN_GUEST_REMINDER_FIRST_SECONDS", "300"))  # first nudge @ 5 min
GUEST_REMINDER_SECONDS = int(os.environ.get("PIN_GUEST_REMINDER_SECONDS", "180"))  # every 3 min after
GUEST_LOCKOUT_SECONDS = int(os.environ.get("PIN_GUEST_LOCKOUT_SECONDS", "900"))  # 15 min lockout
GUEST_ABUSE_MAX = int(os.environ.get("PIN_GUEST_ABUSE_MAX", "8"))  # stream hits after grace
GUEST_ABUSE_WINDOW_SECONDS = int(os.environ.get("PIN_GUEST_ABUSE_WINDOW_SECONDS", "600"))  # 10 min window
GUEST_SECRET = (
    os.environ.get("PIN_GUEST_SECRET")
    or os.environ.get("SHARE_SECRET")
    or "sd-guest-dev-secret"
)

TTL_CHOICES = {
    "session": None,  # browser session cookie
    "1d": 24 * 3600,
    "7d": 7 * 24 * 3600,
    "30d": 30 * 24 * 3600,
}

PROTECTED_PREFIXES = (
    "/tv",
    "/party",
    "/remote",
    "/vod",
    "/music",
    "/play",
    "/stream/",
    "/live/",
    "/dulo-stream/",
    "/ntv-stream/",
    "/content/",
    "/catchup/",
    "/playlist.m3u8",
    "/channels/",
    "/settings/",
)

# Hard-require PIN after grace (streams / play pages)
STREAM_LOCK_PREFIXES = (
    "/stream/",
    "/live/",
    "/dulo-stream/",
    "/ntv-stream/",
    "/content/",
    "/catchup/",
    "/playlist.m3u8",
    "/play",
)

PUBLIC_EXACT = {"/playlist.m3u8"}  # matched via startswith logic below

_lock = threading.Lock()
_sessions: dict[str, dict[str, Any]] = {}
_user_active: dict[str, str] = {}
_pin_store: dict[str, Any] | None = None
_guest_abuse: dict[str, dict[str, Any]] = {}
_guest_lockout: dict[str, float] = {}


def _hash_pin(pin: str, salt: str) -> str:
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        pin.encode("utf-8"),
        salt.encode("utf-8"),
        120_000,
    )
    return digest.hex()


def load_pin_store() -> dict[str, Any]:
    global _pin_store
    if _pin_store is not None:
        return _pin_store
    if not PINS_FILE.is_file():
        _pin_store = {"enabled": False, "salt": "", "admin": None, "users": []}
        return _pin_store
    with _lock:
        data = json.loads(PINS_FILE.read_text())
        _pin_store = data
        return data


def reload_pin_store() -> None:
    global _pin_store
    _pin_store = None
    load_pin_store()


def auth_is_enabled() -> bool:
    if not AUTH_ENABLED:
        return False
    store = load_pin_store()
    return bool(store.get("enabled"))


def verify_pin(pin: str) -> tuple[str, str] | None:
    """Return (pin_id, pin_type) or None."""
    store = load_pin_store()
    if not store.get("enabled"):
        return None
    salt = store.get("salt") or ""
    pin_hash = _hash_pin(pin.strip(), salt)
    admin = store.get("admin") or {}
    if admin.get("hash") and secrets.compare_digest(pin_hash, admin["hash"]):
        return str(admin.get("id", "admin")), "admin"
    for user in store.get("users") or []:
        if user.get("hash") and secrets.compare_digest(pin_hash, user["hash"]):
            return str(user.get("id")), "user"
    return None


def _new_token() -> str:
    return secrets.token_urlsafe(32)


def _now() -> float:
    return time.time()


def create_session(
    pin_id: str,
    pin_type: str,
    device_id: str,
    *,
    ttl_seconds: int | None = None,
    device_name: str = "",
) -> str:
    token = _new_token()
    ttl = SESSION_TTL if ttl_seconds is None else max(60, int(ttl_seconds))
    now = _now()
    record = {
        "pin_id": pin_id,
        "pin_type": pin_type,
        "device_id": device_id,
        "device_name": (device_name or "")[:32],
        "session_token": token,
        "created_at": now,
        "expires_at": now + ttl,
        "ttl_seconds": ttl,
    }
    with _lock:
        if pin_type == "user":
            old = _user_active.get(pin_id)
            if old and old in _sessions:
                del _sessions[old]
            _user_active[pin_id] = token
        _sessions[token] = record
    return token


def get_session(token: str | None) -> dict[str, Any] | None:
    if not token:
        return None
    with _lock:
        rec = _sessions.get(token)
        if not rec:
            return None
        expires = float(rec.get("expires_at") or 0)
        if not expires:
            expires = float(rec.get("created_at", 0)) + SESSION_TTL
        if _now() > expires:
            _sessions.pop(token, None)
            if rec.get("pin_type") == "user" and _user_active.get(rec["pin_id"]) == token:
                _user_active.pop(rec["pin_id"], None)
            return None
        return dict(rec)


def invalidate_session(token: str | None) -> None:
    if not token:
        return
    with _lock:
        rec = _sessions.pop(token, None)
        if rec and rec.get("pin_type") == "user":
            if _user_active.get(rec["pin_id"]) == token:
                _user_active.pop(rec["pin_id"], None)


def session_count() -> int:
    with _lock:
        return len(_sessions)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-real-ip") or request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _guest_sign(payload: str) -> str:
    return hmac.new(GUEST_SECRET.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()[:24]


def _encode_guest_token(started_at: float, device_id: str) -> str:
    raw = f"{int(started_at)}.{device_id}"
    return f"{raw}.{_guest_sign(raw)}"


def _decode_guest_token(token: str | None) -> dict[str, Any] | None:
    if not token or token.count(".") < 2:
        return None
    started_s, device_id, sig = token.split(".", 2)
    raw = f"{started_s}.{device_id}"
    if not secrets.compare_digest(sig, _guest_sign(raw)):
        return None
    try:
        started_at = float(started_s)
    except ValueError:
        return None
    if started_at <= 0 or started_at > _now() + 60:
        return None
    return {"started_at": started_at, "device_id": device_id}


def guest_status(token: str | None) -> dict[str, Any]:
    """Return guest grace / reminder / lockout info for /auth/status."""
    rec = _decode_guest_token(token)
    if not rec:
        # No cookie yet — NOT locked. Client must not treat missing guest as PIN-required.
        # /auth/status (and first protected hit) will issue a guest cookie to start grace.
        return {
            "guest": False,
            "grace_remaining_seconds": GUEST_GRACE_SECONDS if GUEST_ENABLED else 0,
            "grace_total_seconds": GUEST_GRACE_SECONDS,
            "reminder": False,
            "stream_locked": False,
            "lockout_remaining_seconds": 0,
            "guest_pending": bool(GUEST_ENABLED),
        }
    elapsed = max(0.0, _now() - float(rec["started_at"]))
    remaining = max(0, int(GUEST_GRACE_SECONDS - elapsed))
    stream_locked = remaining <= 0
    reminder = False
    if elapsed >= GUEST_REMINDER_FIRST_SECONDS:
        after_first = elapsed - GUEST_REMINDER_FIRST_SECONDS
        # Remind on first threshold, then every REMINDER_SECONDS window.
        reminder = True
        if GUEST_REMINDER_SECONDS > 0 and after_first > 0:
            reminder = int(after_first) % GUEST_REMINDER_SECONDS < 60 or remaining <= 120
        if remaining <= 0:
            reminder = True
    lockout_remaining = 0
    return {
        "guest": True,
        "grace_remaining_seconds": remaining,
        "grace_total_seconds": GUEST_GRACE_SECONDS,
        "grace_elapsed_seconds": int(elapsed),
        "reminder": reminder,
        "stream_locked": stream_locked,
        "lockout_remaining_seconds": lockout_remaining,
        "started_at": int(rec["started_at"]),
    }


def _path_is_stream_lock(path: str) -> bool:
    for prefix in STREAM_LOCK_PREFIXES:
        if prefix.endswith(".m3u8") and path == prefix:
            return True
        if prefix.endswith("/") and path.startswith(prefix):
            return True
        if not prefix.endswith("/") and (path == prefix or path.startswith(prefix + "/")):
            return True
    return False


def _guest_locked_out(key: str) -> float:
    with _lock:
        until = float(_guest_lockout.get(key) or 0)
        if until and _now() < until:
            return until - _now()
        if until:
            _guest_lockout.pop(key, None)
        return 0.0


def _record_guest_abuse(key: str) -> tuple[bool, float]:
    """Return (is_locked_out, lockout_remaining_seconds)."""
    now = _now()
    with _lock:
        until = float(_guest_lockout.get(key) or 0)
        if until and now < until:
            return True, until - now
        bucket = _guest_abuse.get(key)
        if not bucket or now - float(bucket.get("window_start", 0)) > GUEST_ABUSE_WINDOW_SECONDS:
            bucket = {"window_start": now, "hits": 0}
            _guest_abuse[key] = bucket
        bucket["hits"] = int(bucket.get("hits", 0)) + 1
        if bucket["hits"] >= GUEST_ABUSE_MAX:
            _guest_lockout[key] = now + GUEST_LOCKOUT_SECONDS
            bucket["hits"] = 0
            bucket["window_start"] = now
            return True, float(GUEST_LOCKOUT_SECONDS)
        return False, 0.0


def _path_is_protected(path: str) -> bool:
    if path.startswith("/health"):
        return False
    if path.startswith("/auth"):
        return False
    # Public party invite landing (PIN still required for /tv).
    if path.startswith("/party/join/"):
        return False
    # Public Music share deep links (OG crawlers + guest open; stream APIs separate).
    if path.startswith("/music/t/") or path.startswith("/music/r/"):
        return False
    # WebSocket upgrades must bypass BaseHTTPMiddleware (it breaks them).
    # Session checks happen inside the WS handlers.
    if path.startswith("/ws/") or path == "/ws":
        return False
    if path == "/tv-assets/pull_reload.js" or path.startswith("/tv-assets/"):
        return False
    for prefix in PROTECTED_PREFIXES:
        if prefix.endswith(".m3u8") and path == prefix:
            return True
        if prefix.endswith("/") and path.startswith(prefix):
            return True
        if not prefix.endswith("/") and (path == prefix or path.startswith(prefix + "/")):
            return True
    return False


def _wants_html(request: Request) -> bool:
    accept = request.headers.get("accept", "")
    if "text/html" in accept and "application/json" not in accept.split(",")[0]:
        return True
    path = request.url.path
    if (
        path.startswith("/play")
        or path.startswith("/tv")
        or path.startswith("/vod")
        or path.startswith("/music")
        or path.startswith("/legacy")
        or path == "/party"
        or path.startswith("/party/home")
    ):
        return True
    return False


def _secure_cookie(request: Request) -> bool:
    if request.url.scheme == "https":
        return True
    forwarded = request.headers.get("x-forwarded-proto", "")
    return forwarded.split(",")[0].strip().lower() == "https"


def _cookie_kwargs(request: Request, max_age: int | None = None) -> dict[str, Any]:
    kw: dict[str, Any] = {
        "httponly": True,
        "samesite": "lax",
        "path": "/",
        "secure": _secure_cookie(request),
    }
    if max_age is not None:
        kw["max_age"] = max_age
    return kw


def _unauthorized_response(request: Request, reason: str = "auth_required") -> Response:
    if _wants_html(request):
        from urllib.parse import quote

        # Preserve ?party=&name= (and any other query) through the PIN gate.
        nxt = request.url.path
        if request.url.query:
            nxt = f"{nxt}?{request.url.query}"
        return RedirectResponse(url=f"/auth?next={quote(nxt, safe='/')}", status_code=302)
    messages = {
        "guest_expired": "Guest grace ended — enter PIN at /auth to keep watching",
        "session_ended": "Session ended — re-enter PIN at /auth",
        "auth_required": "Session ended — re-enter PIN at /auth",
        "pin_required": "PIN required — enter PIN at /auth",
    }
    return JSONResponse(
        status_code=401,
        content={
            "error": reason,
            "message": messages.get(reason, messages["auth_required"]),
            "auth_url": "/auth",
        },
    )


class PinAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not auth_is_enabled():
            return await call_next(request)
        path = request.url.path
        # Catchup worker (ffmpeg on localhost) uses a shared internal header.
        try:
            from StepDaddyLiveHD.catchup import catchup_internal_key

            key = request.headers.get("x-internal-catchup") or ""
            if key and key == catchup_internal_key():
                client = (request.client.host if request.client else "") or ""
                if client in ("127.0.0.1", "::1", "localhost") or path.startswith("/live/") or path.startswith(
                    "/content/"
                ):
                    return await call_next(request)
        except Exception:
            pass
        if not _path_is_protected(path):
            return await call_next(request)
        token = request.cookies.get(SESSION_COOKIE)
        session = get_session(token)
        if session:
            device_id = request.cookies.get(DEVICE_COOKIE) or request.headers.get("x-device-id")
            if device_id and session.get("device_id") and device_id != session["device_id"]:
                invalidate_session(token)
                return _unauthorized_response(request, "session_ended")
            return await call_next(request)

        # Gapless guest entry: browse/watch without PIN during grace, then hard-lock streams.
        if GUEST_ENABLED:
            ip = _client_ip(request)
            abuse_key = ip
            lock_rem = _guest_locked_out(abuse_key)
            if lock_rem > 0 and _path_is_stream_lock(path):
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "guest_lockout",
                        "message": "Too many no-PIN stream attempts — enter PIN or wait",
                        "retry_after_seconds": int(lock_rem),
                        "auth_url": "/auth",
                    },
                    headers={"Retry-After": str(max(1, int(lock_rem)))},
                )

            device_id = request.cookies.get(DEVICE_COOKIE) or secrets.token_urlsafe(16)
            guest_token = request.cookies.get(GUEST_COOKIE)
            guest = _decode_guest_token(guest_token)
            issue_guest = False
            if not guest:
                guest = {"started_at": _now(), "device_id": device_id}
                guest_token = _encode_guest_token(guest["started_at"], device_id)
                issue_guest = True
            elapsed = max(0.0, _now() - float(guest["started_at"]))
            within_grace = elapsed < GUEST_GRACE_SECONDS

            if within_grace:
                response = await call_next(request)
                if issue_guest or not request.cookies.get(DEVICE_COOKIE):
                    if not hasattr(response, "set_cookie"):
                        pass
                    else:
                        if issue_guest:
                            response.set_cookie(
                                GUEST_COOKIE,
                                guest_token,
                                **_cookie_kwargs(request, max_age=GUEST_GRACE_SECONDS + GUEST_LOCKOUT_SECONDS),
                            )
                        if not request.cookies.get(DEVICE_COOKIE):
                            response.set_cookie(
                                DEVICE_COOKIE,
                                device_id,
                                **_cookie_kwargs(request, max_age=365 * 24 * 3600),
                            )
                return response

            # Grace expired: allow guide/browse HTML & non-stream APIs; block playback paths.
            if _path_is_stream_lock(path):
                locked, rem = _record_guest_abuse(abuse_key)
                if locked:
                    return JSONResponse(
                        status_code=429,
                        content={
                            "error": "guest_lockout",
                            "message": "Too many no-PIN stream attempts — enter PIN or wait",
                            "retry_after_seconds": int(rem),
                            "auth_url": "/auth",
                        },
                        headers={"Retry-After": str(max(1, int(rem)))},
                    )
                return _unauthorized_response(request, "guest_expired")

            response = await call_next(request)
            if issue_guest and hasattr(response, "set_cookie"):
                response.set_cookie(
                    GUEST_COOKIE,
                    guest_token,
                    **_cookie_kwargs(request, max_age=GUEST_GRACE_SECONDS + GUEST_LOCKOUT_SECONDS),
                )
            return response

        return _unauthorized_response(request, "session_ended" if token else "auth_required")


def register_auth_routes(app) -> None:
    @app.get("/auth")
    def auth_page(request: Request, next: str = "/play"):
        if not auth_is_enabled():
            return RedirectResponse(url=next or "/play", status_code=302)
        device = request.cookies.get(DEVICE_COOKIE) or secrets.token_urlsafe(16)
        html = render_auth_page(next_path=next or "/play", device_id=device)
        resp = Response(content=html, media_type="text/html; charset=utf-8")
        if not request.cookies.get(DEVICE_COOKIE):
            resp.set_cookie(DEVICE_COOKIE, device, **_cookie_kwargs(request, max_age=365 * 24 * 3600))
        return resp

    @app.get("/auth/session-ended")
    def session_ended_page():
        return Response(
            content=render_session_ended_page(),
            media_type="text/html; charset=utf-8",
        )

    @app.post("/auth/verify")
    async def auth_verify(request: Request):
        if not auth_is_enabled():
            return JSONResponse({"ok": True, "disabled": True})
        try:
            body = await request.json()
        except Exception:
            body = {}
        pin = str(body.get("pin") or "").strip()
        device_id = str(body.get("device_id") or request.cookies.get(DEVICE_COOKIE) or "").strip()
        next_path = str(body.get("next") or "/play").strip() or "/play"
        if not next_path.startswith("/"):
            next_path = "/play"
        remember = body.get("remember")
        if remember is None:
            remember = True
        remember = bool(remember)
        ttl_key = str(body.get("ttl") or body.get("session_ttl") or ("30d" if remember else "session")).lower()
        if not remember:
            ttl_key = "session"
        if ttl_key not in TTL_CHOICES:
            ttl_key = "30d" if remember else "session"
        ttl_seconds = TTL_CHOICES[ttl_key]
        # Browser session cookies still need a server-side expiry bound.
        server_ttl = ttl_seconds if ttl_seconds is not None else min(SESSION_TTL, 12 * 3600)
        device_name = str(body.get("device_name") or body.get("device_nick") or "").strip()[:32]
        if not pin:
            return JSONResponse({"ok": False, "error": "pin_required"}, status_code=400)
        if not device_id:
            device_id = secrets.token_urlsafe(16)
        verified = verify_pin(pin)
        if not verified:
            return JSONResponse({"ok": False, "error": "invalid_pin"}, status_code=403)
        pin_id, pin_type = verified
        token = create_session(
            pin_id,
            pin_type,
            device_id,
            ttl_seconds=server_ttl,
            device_name=device_name,
        )
        resp = JSONResponse(
            {
                "ok": True,
                "pin_type": pin_type,
                "redirect": next_path,
                "remember": remember,
                "ttl": ttl_key,
            }
        )
        cookie_kw = _cookie_kwargs(request, max_age=ttl_seconds)
        resp.set_cookie(SESSION_COOKIE, token, **cookie_kw)
        resp.set_cookie(DEVICE_COOKIE, device_id, **_cookie_kwargs(request, max_age=365 * 24 * 3600))
        resp.delete_cookie(GUEST_COOKIE, path="/")
        return resp

    @app.post("/auth/logout")
    def auth_logout(request: Request):
        token = request.cookies.get(SESSION_COOKIE)
        invalidate_session(token)
        resp = JSONResponse({"ok": True})
        resp.delete_cookie(SESSION_COOKIE, path="/")
        return resp

    @app.get("/auth/status")
    def auth_status(request: Request):
        if not auth_is_enabled():
            return {"enabled": False, "authenticated": True, "guest": False}
        token = request.cookies.get(SESSION_COOKIE)
        session = get_session(token)
        if session is not None:
            return {
                "enabled": True,
                "authenticated": True,
                "guest": False,
                "pin_type": session.get("pin_type"),
                "active_sessions": session_count(),
                "grace_remaining_seconds": 0,
                "reminder": False,
                "stream_locked": False,
            }

        # Issue / refresh guest + device cookies here so /auth/status never reports
        # stream_locked before a protected route has a chance to set sd_guest.
        issue_guest = False
        device_id = request.cookies.get(DEVICE_COOKIE) or secrets.token_urlsafe(16)
        guest_token = request.cookies.get(GUEST_COOKIE)
        guest_rec = _decode_guest_token(guest_token) if GUEST_ENABLED else None
        if GUEST_ENABLED and not guest_rec:
            guest_rec = {"started_at": _now(), "device_id": device_id}
            guest_token = _encode_guest_token(guest_rec["started_at"], device_id)
            issue_guest = True

        guest = guest_status(guest_token if guest_rec else None) if GUEST_ENABLED else {"guest": False}
        ip = _client_ip(request)
        lock_rem = _guest_locked_out(ip)
        if lock_rem > 0:
            guest = dict(guest)
            guest["lockout_remaining_seconds"] = int(lock_rem)
            guest["stream_locked"] = True
            guest["reminder"] = True

        payload = {
            "enabled": True,
            "authenticated": False,
            "pin_type": None,
            "active_sessions": session_count(),
            "guest_enabled": GUEST_ENABLED,
            **guest,
        }
        if not issue_guest and request.cookies.get(DEVICE_COOKIE):
            return payload

        resp = JSONResponse(payload)
        if issue_guest and guest_token:
            resp.set_cookie(
                GUEST_COOKIE,
                guest_token,
                **_cookie_kwargs(request, max_age=GUEST_GRACE_SECONDS + GUEST_LOCKOUT_SECONDS),
            )
        if not request.cookies.get(DEVICE_COOKIE):
            resp.set_cookie(
                DEVICE_COOKIE,
                device_id,
                **_cookie_kwargs(request, max_age=365 * 24 * 3600),
            )
        return resp
