"""Per-IP token-bucket rate limit for HLS proxy paths (abuse / egress protection)."""
from __future__ import annotations

import os
import threading
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

_LIMITED_PREFIXES = ("/stream/", "/content/", "/live/", "/dulo-stream/", "/ntv-stream/")
_DEFAULT_RPS = float(os.environ.get("RATE_LIMIT_RPS", "30"))
_BURST = int(os.environ.get("RATE_LIMIT_BURST", "60"))
_WINDOW = 1.0


class _Bucket:
    __slots__ = ("tokens", "updated")

    def __init__(self) -> None:
        self.tokens = float(_BURST)
        self.updated = time.monotonic()


_lock = threading.Lock()
_buckets: dict[str, _Bucket] = {}
_last_prune = time.monotonic()


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-real-ip") or request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _allow(key: str, rps: float) -> bool:
    global _last_prune
    now = time.monotonic()
    with _lock:
        if now - _last_prune > 300:
            stale = [k for k, b in _buckets.items() if now - b.updated > 600]
            for k in stale:
                del _buckets[k]
            _last_prune = now
        bucket = _buckets.get(key)
        if bucket is None:
            bucket = _Bucket()
            _buckets[key] = bucket
        elapsed = now - bucket.updated
        bucket.updated = now
        bucket.tokens = min(float(_BURST), bucket.tokens + elapsed * rps)
        if bucket.tokens >= 1.0:
            bucket.tokens -= 1.0
            return True
        return False


class StreamRateLimitMiddleware(BaseHTTPMiddleware):
    """Limit requests per IP on stream/content paths; health/auth unaffected."""

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        if not any(path.startswith(p) for p in _LIMITED_PREFIXES):
            return await call_next(request)
        if request.method == "OPTIONS":
            return await call_next(request)
        ip = _client_ip(request)
        if not _allow(f"{ip}:{path.split('/')[1]}", _DEFAULT_RPS):
            return JSONResponse(
                status_code=429,
                content={"error": "rate_limit_exceeded", "retry_after_seconds": 1},
                headers={"Retry-After": "1"},
            )
        return await call_next(request)
