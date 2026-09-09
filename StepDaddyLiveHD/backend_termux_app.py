import asyncio
import json
import os
import pathlib
import re
import shutil
import time

import httpx
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from StepDaddyLiveHD.backend import (
    client,
    fastapi_app,
    invalidate_channels_cache,
    step_daddy,
    update_channels,
)
from StepDaddyLiveHD.pin_auth import PinAuthMiddleware, register_auth_routes
from StepDaddyLiveHD.supplements import get_catalog, get_settings

register_auth_routes(fastapi_app)
fastapi_app.add_middleware(PinAuthMiddleware)

DOMAIN_RELAY_URLS = [
    "https://raw.githubusercontent.com/thothassistantai-web/stepdaddy-gateway-android/main/release/domain-relay.json",
    "https://github.com/thothassistantai-web/stepdaddy-gateway-android/releases/latest/download/domain-relay.json",
]
WARM_CHANNELS = ["763", "857", "51", "360"]
PREFERRED_PRIMARY = "https://daddylive.li"
PREFERRED_MIN_CHANNELS = 1300


async def _fetch_domain_relay() -> dict | None:
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as hc:
        for url in DOMAIN_RELAY_URLS:
            try:
                r = await hc.get(url)
                if r.status_code == 200:
                    data = r.json()
                    cache = pathlib.Path(".domain-relay-cache.json")
                    try:
                        cache.write_text(json.dumps(data))
                    except Exception:
                        pass
                    return data
            except Exception:
                continue
    cache = pathlib.Path(".domain-relay-cache.json")
    if cache.exists():
        try:
            return json.loads(cache.read_text())
        except Exception:
            pass
    return None


async def _probe_channel_count(base: str) -> int:
    base = base.rstrip("/")
    try:
        response = await step_daddy._session.get(
            f"{base}/api/channels",
            headers=step_daddy._headers(base),
            timeout=15.0,
        )
        if response.status_code != 200:
            return 0
        content_type = response.headers.get("content-type", "")
        if "application/json" not in content_type:
            return 0
        data = response.json()
        if isinstance(data, list):
            return len(data)
        if isinstance(data, dict):
            channels = data.get("channels")
            if isinstance(channels, list):
                return len(channels)
    except Exception:
        pass
    return 0


def _persist_env_updates(relays: list[str], mirrors: list[str]) -> None:
    env_path = pathlib.Path(".env.termux")
    if not env_path.exists():
        return
    text = env_path.read_text()
    updates: dict[str, str] = {}
    if relays:
        updates["DLHD_RELAY_HOSTS"] = ",".join(relays)
    if mirrors:
        updates["DLHD_BASE_URLS"] = ",".join(mirrors)
    for key, val in updates.items():
        pat = re.compile(rf"^{re.escape(key)}=.*$", re.M)
        line = f"{key}={val}"
        text = pat.sub(line, text) if pat.search(text) else text.rstrip() + "\n" + line + "\n"
    try:
        shutil.copy2(env_path, env_path.with_suffix(f".termux.bak-startup-{int(time.time())}"))
        env_path.write_text(text)
    except Exception:
        pass


async def _apply_domain_relay() -> None:
    relay = await _fetch_domain_relay()
    if not relay:
        return
    src = (relay.get("sources") or {}).get("daddylive") or {}
    relays = [m.rstrip("/") for m in (src.get("relayHosts") or []) if m]
    mirrors = [m.rstrip("/") for m in (src.get("mirrors") or []) if m]
    primary = (src.get("primary") or "").rstrip("/")
    if relays:
        step_daddy._relay_hosts = relays
    env_primary = os.environ.get("DLHD_BASE_URL", PREFERRED_PRIMARY).strip().rstrip("/")
    merged: list[str] = []
    for m in ([env_primary] if env_primary else []) + ([primary] if primary else []) + mirrors + list(step_daddy._mirrors):
        if m and m not in merged:
            merged.append(m)
    preferred_count = await _probe_channel_count(PREFERRED_PRIMARY)
    if preferred_count >= PREFERRED_MIN_CHANNELS:
        step_daddy._base_url = PREFERRED_PRIMARY
        if PREFERRED_PRIMARY not in merged:
            merged.insert(0, PREFERRED_PRIMARY)
    else:
        best_base = merged[0] if merged else step_daddy._base_url
        best_count = 0
        for candidate in merged[:6]:
            count = await _probe_channel_count(candidate)
            if count > best_count:
                best_base, best_count = candidate, count
        if best_count > 0:
            step_daddy._base_url = best_base
    step_daddy._mirrors = merged
    _persist_env_updates(relays, merged)


@fastapi_app.on_event("startup")
async def _startup():
    settings = get_settings()
    if settings.use_daddylive:
        try:
            await _apply_domain_relay()
        except Exception:
            pass
        try:
            await step_daddy.load_channels()
            invalidate_channels_cache()
        except Exception:
            pass
    else:
        step_daddy.channels = []
        invalidate_channels_cache()

    try:
        await get_catalog().ensure_loaded(force=True)
        invalidate_channels_cache()
    except Exception:
        pass

    fastapi_app.state._channels_task = asyncio.create_task(update_channels())

    async def _warm_channels():
        if not get_settings().use_daddylive:
            # Warm a Free-TV / iptv supplement instead of DDL numerics.
            cats = get_catalog().list_channels()
            warm_ids = [c.id for c in cats if c.source in ("freetv", "iptv", "adultswim")][:3]
            for cid in warm_ids:
                try:
                    await get_catalog().resolve_playlist(cid)
                except Exception:
                    pass
                await asyncio.sleep(0.3)
            return
        for cid in WARM_CHANNELS:
            try:
                await step_daddy.stream(cid)
            except Exception:
                pass
            await asyncio.sleep(0.5)

    asyncio.create_task(_warm_channels())


@fastapi_app.on_event("shutdown")
async def _shutdown():
    t = getattr(fastapi_app.state, "_channels_task", None)
    if t:
        t.cancel()
    try:
        await client.aclose()
    except Exception:
        pass
    try:
        await step_daddy._session.aclose()
    except Exception:
        pass


_PLAYER_ASSETS = pathlib.Path(__file__).resolve().parent / "player_assets"
fastapi_app.mount("/tv-assets", StaticFiles(directory=str(_PLAYER_ASSETS)), name="tv_assets")
fastapi_app.mount("/ui", StaticFiles(directory="webui", html=True), name="ui")


@fastapi_app.api_route("/", methods=["GET", "HEAD"])
async def root_to_tv():
    """Canonical entry: domain root serves the TV guide (bookmarks to old `/` land here)."""
    return RedirectResponse(url="/tv", status_code=302)


@fastapi_app.api_route("/legacy", methods=["GET", "HEAD"])
@fastapi_app.api_route("/legacy/", methods=["GET", "HEAD"])
async def legacy_ui():
    """Prebuilt Reflex/webui browse experience (formerly served at `/`)."""
    return FileResponse("webui/index.html")
