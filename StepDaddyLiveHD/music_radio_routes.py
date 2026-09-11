"""Music / Radio Browser API routes under /api/music/radio/..."""
from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

from . import radio_browser as rb

router = APIRouter(tags=["music-radio"])

_CLIENT_RPS = float(os.environ.get("MUSIC_RADIO_CLIENT_RPS", "8"))
_CLIENT_BURST = int(os.environ.get("MUSIC_RADIO_CLIENT_BURST", "20"))


class _IpBucket:
    __slots__ = ("tokens", "updated")

    def __init__(self) -> None:
        self.tokens = float(_CLIENT_BURST)
        self.updated = 0.0


_ip_buckets: dict[str, _IpBucket] = {}


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-real-ip") or request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _allow_client(ip: str) -> bool:
    import time

    now = time.monotonic()
    b = _ip_buckets.get(ip)
    if b is None:
        b = _IpBucket()
        b.updated = now
        b.tokens = float(_CLIENT_BURST)
        _ip_buckets[ip] = b
    elapsed = now - b.updated
    b.updated = now
    b.tokens = min(float(_CLIENT_BURST), b.tokens + elapsed * _CLIENT_RPS)
    if b.tokens >= 1.0:
        b.tokens -= 1.0
        return True
    return False


def _rate_limited(request: Request) -> JSONResponse | None:
    ip = _client_ip(request)
    if not _allow_client(ip):
        return JSONResponse(
            status_code=429,
            content={"error": "rate_limit_exceeded", "retry_after_seconds": 1},
            headers={"Retry-After": "1"},
        )
    return None


async def _resolve_geo(
    request: Request,
    lat: float | None = None,
    lon: float | None = None,
    countrycode: str | None = None,
    state: str | None = None,
    city: str | None = None,
) -> dict[str, Any]:
    """Resolve location: explicit browser coords win; else IP geo fallback."""
    source = "browser" if lat is not None and lon is not None else None
    ip_info: dict[str, Any] = {}
    if source is None:
        ip_info = await rb.resolve_ip_geo(_client_ip(request))
        if ip_info.get("ok"):
            source = "ip"
            lat = lat if lat is not None else ip_info.get("lat")
            lon = lon if lon is not None else ip_info.get("lon")
            countrycode = countrycode or ip_info.get("countrycode")
            state = state or ip_info.get("state")
            city = city or ip_info.get("city")
        else:
            source = "none"

    if lat is not None and lon is not None and (not countrycode or not state):
        ip_info = ip_info or await rb.resolve_ip_geo(_client_ip(request))
        if ip_info.get("ok"):
            countrycode = countrycode or ip_info.get("countrycode")
            state = state or ip_info.get("state")
            city = city or ip_info.get("city")

    return {
        "ok": source != "none",
        "source": source,
        "lat": lat,
        "lon": lon,
        "countrycode": (countrycode or "").upper() or None,
        "state": state,
        "city": city,
        "ip": ip_info.get("ip"),
    }


@router.get("/api/music/radio/health")
async def music_radio_health(request: Request):
    limited = _rate_limited(request)
    if limited:
        return limited
    try:
        mirrors = await rb.get_mirrors()
        return {
            "ok": True,
            "mirrors": mirrors[:8],
            "ua": rb.UA,
            "cache_ttl_sec": rb.CACHE_TTL_SEC,
            "heuristic": rb.HEURISTIC_DOC,
        }
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=502)


@router.get("/api/music/radio/geo")
async def music_radio_geo(
    request: Request,
    lat: float | None = None,
    lon: float | None = None,
    countrycode: str | None = None,
    state: str | None = None,
    city: str | None = None,
):
    limited = _rate_limited(request)
    if limited:
        return limited
    return await _resolve_geo(
        request, lat=lat, lon=lon, countrycode=countrycode, state=state, city=city
    )


@router.get("/api/music/radio/home")
async def music_radio_home(
    request: Request,
    lat: float | None = None,
    lon: float | None = None,
    countrycode: str | None = None,
    state: str | None = None,
    city: str | None = None,
    limit: int = Query(36, ge=1, le=100),
):
    limited = _rate_limited(request)
    if limited:
        return limited

    geo = await _resolve_geo(
        request,
        lat=lat,
        lon=lon,
        countrycode=countrycode,
        state=state,
        city=city,
    )

    near = await rb.near_you(
        lat=geo.get("lat"),
        lon=geo.get("lon"),
        countrycode=geo.get("countrycode"),
        state=geo.get("state"),
        city=geo.get("city"),
        limit=limit,
    )
    return {
        "ok": True,
        "geo": geo,
        "near_you": near.get("near") or [],
        "commercial_preview": near.get("commercial") or [],
        "internet_preview": near.get("internet") or [],
        "roots": [
            {"id": "commercial", "title": "Commercial", "subtitle": "Broadcast & local"},
            {"id": "internet", "title": "Internet", "subtitle": "Web & streaming radio"},
        ],
        "hierarchy": rb.HEURISTIC_DOC["hierarchy"],
        "heuristic": rb.HEURISTIC_DOC,
    }


@router.get("/api/music/radio/browse")
async def music_radio_browse(
    request: Request,
    class_: str | None = Query(None, alias="class"),
    state: str | None = None,
    city: str | None = None,
    band: str | None = None,
    genre: str | None = None,
    countrycode: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
):
    """Faceted browse: class → state → city → band → genre → station."""
    limited = _rate_limited(request)
    if limited:
        return limited

    cc = countrycode
    if not cc:
        geo = await _resolve_geo(request, lat=lat, lon=lon)
        cc = geo.get("countrycode") or "US"

    try:
        data = await rb.browse_level(
            cls=class_,
            state=state,
            city=city,
            band=band,
            genre=genre,
            countrycode=cc,
        )
        data["ok"] = True
        return data
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=502)


@router.get("/api/music/radio/stations")
async def music_radio_stations(
    request: Request,
    class_: str | None = Query(None, alias="class"),
    state: str | None = None,
    city: str | None = None,
    band: str | None = None,
    genre: str | None = None,
    countrycode: str | None = None,
    tag: str | None = None,
    q: str | None = None,
    limit: int = Query(48, ge=1, le=200),
):
    limited = _rate_limited(request)
    if limited:
        return limited
    try:
        raw = await rb.search_stations(
            countrycode=countrycode,
            state=state,
            tag=tag or genre,
            name=q,
            limit=limit,
        )
        filtered = rb.filter_hierarchy(
            raw, cls=class_, state=state, city=city, band=band, genre=genre
        )
        if (class_ or "").lower() == "commercial" and state:
            try:
                seeded = await rb.load_market_seed_stations(
                    lat=None,
                    lon=None,
                    countrycode=countrycode,
                    state=state,
                    city=city,
                    top_n=10,
                )
            except Exception:
                seeded = []
            if seeded:
                seen = {s.get("stationuuid") for s in filtered}
                seen_cs = {(s.get("callsign") or "").upper() for s in filtered if s.get("callsign")}
                inject = []
                for s in seeded:
                    uid = s.get("stationuuid")
                    cs = (s.get("callsign") or "").upper()
                    if uid and uid in seen:
                        continue
                    if cs and cs in seen_cs:
                        continue
                    if band and str(s.get("band") or "").lower() != str(band).lower():
                        continue
                    inject.append(s)
                    if uid:
                        seen.add(uid)
                    if cs:
                        seen_cs.add(cs)
                filtered = inject + filtered
        return {"ok": True, "stations": filtered[:limit], "count": len(filtered)}
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=502)


@router.get("/api/music/radio/station/{station_uuid}")
async def music_radio_station(station_uuid: str, request: Request):
    limited = _rate_limited(request)
    if limited:
        return limited
    try:
        st = await rb.station_by_uuid(station_uuid)
        if not st:
            return JSONResponse({"ok": False, "error": "not_found"}, status_code=404)
        return {"ok": True, "station": st}
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=502)


@router.post("/api/music/radio/click/{station_uuid}")
async def music_radio_click(station_uuid: str, request: Request):
    """Forward play click to Radio Browser (helps ranking)."""
    limited = _rate_limited(request)
    if limited:
        return limited
    try:
        result = await rb.record_click(station_uuid)
        return {"ok": True, "result": result}
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=502)


@router.get("/api/music/radio/nowplaying")
async def music_radio_nowplaying(
    request: Request,
    station_uuid: str | None = None,
    url: str | None = None,
):
    """Light now/next peek via ICY metadata (or station stream URL lookup)."""
    limited = _rate_limited(request)
    if limited:
        return limited
    from . import radio_nowplaying as rnp

    stream = (url or "").strip()
    station: dict[str, Any] | None = None
    if station_uuid:
        try:
            station = await rb.station_by_uuid(station_uuid)
        except Exception:
            station = None
        if station and not stream:
            stream = (station.get("stream_url") or "").strip()
    if not stream:
        return JSONResponse(
            {"ok": False, "error": "missing_stream", "now": None, "next": None},
            status_code=400,
        )
    try:
        meta = await rnp.peek_icy_metadata(stream)
        return {
            "ok": bool(meta.get("ok")),
            "station_uuid": station_uuid,
            "station_name": (station or {}).get("display_name") or (station or {}).get("name"),
            "now": meta.get("now"),
            "next": meta.get("next"),
            "source": meta.get("source"),
            "icy_station": meta.get("station_name"),
            "error": meta.get("error"),
        }
    except Exception as exc:  # noqa: BLE001
        return JSONResponse(
            {"ok": False, "error": str(exc), "now": None, "next": None},
            status_code=502,
        )


@router.get("/api/music/radio/dial")
async def music_radio_dial(
    request: Request,
    lat: float | None = None,
    lon: float | None = None,
    countrycode: str | None = None,
    state: str | None = None,
    city: str | None = None,
    limit: int = Query(64, ge=8, le=120),
):
    """Ordered AM↑ → FM↑ → Internet dial list for swipe-to-tune."""
    limited = _rate_limited(request)
    if limited:
        return limited
    geo = await _resolve_geo(
        request, lat=lat, lon=lon, countrycode=countrycode, state=state, city=city
    )
    try:
        from . import radio_dial as rd

        data = await rd.dial_for_geo(
            rb.near_you,
            lat=geo.get("lat"),
            lon=geo.get("lon"),
            countrycode=geo.get("countrycode"),
            state=geo.get("state"),
            city=geo.get("city"),
            limit=limit,
        )
        data["ok"] = True
        data["geo"] = geo
        return data
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=502)


@router.get("/api/music/radio/near")
async def music_radio_near(
    request: Request,
    lat: float | None = None,
    lon: float | None = None,
    countrycode: str | None = None,
    state: str | None = None,
    city: str | None = None,
    limit: int = Query(36, ge=1, le=100),
):
    limited = _rate_limited(request)
    if limited:
        return limited
    geo = await _resolve_geo(
        request, lat=lat, lon=lon, countrycode=countrycode, state=state, city=city
    )
    try:
        near = await rb.near_you(
            lat=geo.get("lat"),
            lon=geo.get("lon"),
            countrycode=geo.get("countrycode"),
            state=geo.get("state"),
            city=geo.get("city"),
            limit=limit,
        )
        return {"ok": True, "geo": geo, **near}
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=502)
