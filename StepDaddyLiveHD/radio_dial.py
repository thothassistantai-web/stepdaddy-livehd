"""Dial-order station list for physical-radio swipe (AM → FM → Internet)."""
from __future__ import annotations

from typing import Any


def dial_frequency_sort_key(station: dict[str, Any]) -> float:
    """Numeric sort key for AM (kHz) / FM (MHz). Missing dial sorts last."""
    dial = station.get("dial")
    if dial is None or dial == "":
        return 1e15
    try:
        return float(str(dial).strip())
    except (TypeError, ValueError):
        return 1e15


def _band_of(station: dict[str, Any]) -> str:
    b = str(station.get("dial_band") or station.get("band") or "").strip().upper()
    if b == "HD":
        return "FM"
    return b


def _is_broadcast_am(station: dict[str, Any]) -> bool:
    return _band_of(station) == "AM" and bool(station.get("dial"))


def _is_broadcast_fm(station: dict[str, Any]) -> bool:
    return _band_of(station) in {"FM", "HD"} and bool(station.get("dial"))


def _internet_bucket(station: dict[str, Any]) -> bool:
    if _is_broadcast_am(station) or _is_broadcast_fm(station):
        return False
    return True


def _dedupe(stations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen_uuid: set[str] = set()
    seen_call: set[str] = set()
    out: list[dict[str, Any]] = []
    for s in stations:
        uid = s.get("stationuuid")
        if not uid or uid in seen_uuid:
            continue
        cs = str(s.get("callsign") or "").upper()
        if cs and cs in seen_call:
            continue
        seen_uuid.add(uid)
        if cs:
            seen_call.add(cs)
        out.append(s)
    return out


def build_dial_list(
    *,
    near: list[dict[str, Any]] | None = None,
    commercial: list[dict[str, Any]] | None = None,
    internet: list[dict[str, Any]] | None = None,
    limit_internet: int = 48,
) -> dict[str, Any]:
    """Build looped dial order: AM↑ → FM↑ → Internet (votes↓, name).

    Swipe next past highest FM enters Internet; swipe prev below lowest FM
    enters AM. Ends of the combined list loop.
    """
    pool = _dedupe(
        list(near or []) + list(commercial or []) + list(internet or [])
    )
    am = [s for s in pool if _is_broadcast_am(s)]
    fm = [s for s in pool if _is_broadcast_fm(s)]
    web = [s for s in pool if _internet_bucket(s)]

    am.sort(key=lambda s: (dial_frequency_sort_key(s), str(s.get("display_name") or "")))
    fm.sort(key=lambda s: (dial_frequency_sort_key(s), str(s.get("display_name") or "")))
    web.sort(
        key=lambda s: (
            -(int(s.get("votes") or 0)),
            -(int(s.get("clickcount") or 0)),
            str(s.get("display_name") or s.get("name") or "").lower(),
        )
    )
    web = web[: max(8, limit_internet)]

    raw_dial = am + fm + web
    dial: list[dict[str, Any]] = []
    am_n, fm_n = len(am), len(fm)
    for i, s in enumerate(raw_dial):
        item = dict(s)
        if i < am_n:
            seg = "AM"
        elif i < am_n + fm_n:
            seg = "FM"
        else:
            seg = "Internet"
        item["dial_segment"] = seg
        item["dial_index"] = i
        dial.append(item)

    return {
        "am": [dict(s) for s in am],
        "fm": [dict(s) for s in fm],
        "internet": [dict(s) for s in web],
        "dial": dial,
        "counts": {"am": len(am), "fm": len(fm), "internet": len(web), "total": len(dial)},
        "order_doc": (
            "AM frequency ascending → FM frequency ascending → Internet "
            "(votes/clickcount/name). Combined list loops at both ends."
        ),
    }


async def dial_for_geo(
    near_fn,
    *,
    lat: float | None,
    lon: float | None,
    countrycode: str | None,
    state: str | None,
    city: str | None,
    limit: int = 64,
) -> dict[str, Any]:
    near = await near_fn(
        lat=lat,
        lon=lon,
        countrycode=countrycode,
        state=state,
        city=city,
        limit=limit,
    )
    built = build_dial_list(
        near=near.get("near") or [],
        commercial=near.get("commercial") or [],
        internet=near.get("internet") or [],
        limit_internet=max(24, limit // 2),
    )
    built["location"] = near.get("location") or {
        "lat": lat,
        "lon": lon,
        "countrycode": countrycode,
        "state": state,
        "city": city,
    }
    built["seeded_count"] = near.get("seeded_count") or 0
    return built
