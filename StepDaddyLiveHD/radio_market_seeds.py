"""Curated broadcast-market seeds for Radio near-you / local top-N guarantee.

Radio Browser geo/state search often misses flagship FM/AM locals (sparse geo tags,
inconsistent `state` fields, global clickcount pollution). Seeds fill gaps for
known metros and are expandable.
"""
from __future__ import annotations

import math
from typing import Any

# Each seed: callsign, brand, dial, band, preferred Radio Browser uuid(s), name fallbacks.
# Prefer https / lastcheckok streams when multiple uuids are listed.

_NYC_STATIONS: list[dict[str, Any]] = [
    {
        "callsign": "WQHT",
        "brand": "Hot 97",
        "dial": "97.1",
        "band": "FM",
        "uuids": [
            "a6381986-1c6e-400f-a57e-0bce3ccc1214",  # https StreamTheWorld
            "04ff395c-514b-44c4-98b0-f93b8d9e383c",
        ],
        "name_queries": ["WQHT Hot 97", "Hot 97"],
        "genre": "hip-hop",
    },
    {
        "callsign": "WWPR",
        "brand": "Power 105",
        "dial": "105.1",
        "band": "FM",
        "uuids": ["d5f76b95-7507-487e-ad3f-48ba15cd3cce"],
        "name_queries": ["Power 105.1", "Power 105"],
        "genre": "urban contemporary",
    },
    {
        "callsign": "WHTZ",
        "brand": "Z100",
        "dial": "100.3",
        "band": "FM",
        "uuids": [
            "ba3ad919-0516-485c-bce6-b27c4492ab14",
            "56df9f1a-ed8b-4393-890a-2c0e6a0133a1",
        ],
        "name_queries": ["Z100", "WHTZ"],
        "genre": "top 40",
    },
    {
        "callsign": "WKTU",
        "brand": "103.5 KTU",
        "dial": "103.5",
        "band": "FM",
        "uuids": ["ae414367-526c-43f4-b5e1-979978cd307a"],
        "name_queries": ["WKTU", "103.5 KTU"],
        "genre": "rhythmic adult contemporary",
    },
    {
        "callsign": "WAXQ",
        "brand": "Q104.3",
        "dial": "104.3",
        "band": "FM",
        "uuids": [
            "f604751e-e902-4e6e-9996-9d2c974d450f",
            "c329ab1d-9e5a-467f-a8ba-d9a9998f622f",
        ],
        "name_queries": ["Q104.3", "WAXQ"],
        "genre": "classic rock",
    },
    {
        "callsign": "WLTW",
        "brand": "Lite FM",
        "dial": "106.7",
        "band": "FM",
        "uuids": [
            "19569a71-edd0-4207-b755-d5217fe2b23b",
            "b878428e-22e5-4772-9943-82e90487e2e9",
        ],
        "name_queries": ['WLTW "LiteFM"', "WLTW 106.7"],
        "genre": "adult contemporary",
    },
    {
        "callsign": "WQXR",
        "brand": "WQXR",
        "dial": "105.9",
        "band": "FM",
        "uuids": ["30928802-8f3b-4083-94ee-7cb3c6c41790"],
        "name_queries": ["WQXR 105.9", "WQXR"],
        "genre": "classical",
    },
    {
        "callsign": "WNYC",
        "brand": "WNYC",
        "dial": "93.9",
        "band": "FM",
        "uuids": [
            "535d3971-0a8f-4ccd-9dbe-2444bc7d339b",
            "f34ae431-42cd-4ef1-8a24-f4eca8a70cc1",
        ],
        "name_queries": ["WNYC 93.9", "WNYC FM"],
        "genre": "public radio",
    },
    {
        "callsign": "WFAN",
        "brand": "WFAN",
        "dial": "660",
        "band": "AM",
        "uuids": ["a9028c58-96cc-47e7-bdb9-00d06f4b1ac7"],
        "name_queries": ["WFAN", "101.9WFAN"],
        "genre": "sports",
    },
    {
        "callsign": "WPAT",
        "brand": "Amor 93.1",
        "dial": "93.1",
        "band": "FM",
        "uuids": [
            "631d4862-14c9-4888-b247-d89f05cfa5bf",
            "51805705-04bc-405f-a8f9-19afc54bb23d",
        ],
        "name_queries": ["WPAT-FM Amor", "Amor 93.1", "WPAT-FM"],
        "genre": "spanish",
    },
]

MARKETS: list[dict[str, Any]] = [
    {
        "id": "nyc",
        "label": "New York Metro",
        "countrycode": "US",
        "lat": 40.7128,
        "lon": -74.0060,
        "radius_km": 95.0,
        "states": {
            "new york",
            "new jersey",
            "connecticut",
            "ny",
            "nj",
            "ct",
        },
        "cities": {
            "new york",
            "nyc",
            "new york city",
            "brooklyn",
            "bronx",
            "queens",
            "manhattan",
            "staten island",
            "newark",
            "jersey city",
            "yonkers",
            "hoboken",
            "white plains",
            "long island",
            "nassau",
            "suffolk",
        },
        "stations": _NYC_STATIONS,
        "top_n": 10,
    },
]


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def match_markets(
    *,
    lat: float | None = None,
    lon: float | None = None,
    countrycode: str | None = None,
    state: str | None = None,
    city: str | None = None,
) -> list[dict[str, Any]]:
    """Return markets that match geo / state / city (best first)."""
    cc = (countrycode or "").upper()
    st = (state or "").strip().lower()
    cy = (city or "").strip().lower()
    hits: list[tuple[int, dict[str, Any]]] = []
    for m in MARKETS:
        if cc and m.get("countrycode") and cc != str(m["countrycode"]).upper():
            # Still allow lat/lon match inside radius even if IP country missing
            pass
        score = 0
        if cy and cy in m.get("cities", set()):
            score += 5
        if st and (st in m.get("states", set()) or any(st.startswith(x) for x in m.get("states", set()))):
            score += 4
        if lat is not None and lon is not None:
            dist = _haversine_km(float(lat), float(lon), float(m["lat"]), float(m["lon"]))
            if dist <= float(m.get("radius_km") or 80):
                score += 6
                # Prefer closer metros
                score += max(0, int(3 - dist / 40))
            elif dist <= float(m.get("radius_km") or 80) * 1.6:
                score += 2
        if score:
            if cc and m.get("countrycode") and cc != str(m["countrycode"]).upper():
                score -= 2
            if score > 0:
                hits.append((score, m))
    hits.sort(key=lambda t: -t[0])
    return [m for _, m in hits]


def seed_display_name(seed: dict[str, Any]) -> str:
    callsign = (seed.get("callsign") or "").strip().upper()
    brand = (seed.get("brand") or "").strip()
    dial = (seed.get("dial") or "").strip()
    band = (seed.get("band") or "").strip().upper()
    parts: list[str] = []
    if callsign:
        parts.append(callsign)
    if brand and brand.upper() != callsign:
        parts.append(brand)
    if dial:
        parts.append(f"{dial} {band}".strip() if band else dial)
    return " · ".join(parts) if parts else (brand or callsign or "Station")


def all_seed_callsigns() -> set[str]:
    out: set[str] = set()
    for m in MARKETS:
        for s in m.get("stations") or []:
            cs = (s.get("callsign") or "").upper()
            if cs:
                out.add(cs)
    return out
