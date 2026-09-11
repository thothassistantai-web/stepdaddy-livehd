"""Local market seed resolve for Music Radio (curated top-N broadcast)."""
from __future__ import annotations

from typing import Any

from . import radio_market_seeds as seeds
from .radio_browser import CACHE_TTL_SEC, enrich_station, rb_get


async def _raw_station_by_uuid(uuid: str) -> dict[str, Any] | None:
    raw = await rb_get(f"/json/stations/byuuid/{uuid}", ttl=CACHE_TTL_SEC)
    if isinstance(raw, list) and raw and isinstance(raw[0], dict):
        return raw[0]
    if isinstance(raw, dict) and raw.get("stationuuid"):
        return raw
    return None


def _prefer_stream_raw(a: dict[str, Any], b: dict[str, Any]) -> dict[str, Any]:
    """Pick the better of two raw RB station rows."""

    def key(s: dict[str, Any]) -> tuple[int, int, int, int]:
        url = (s.get("url_resolved") or s.get("url") or "").strip()
        https = 1 if url.lower().startswith("https://") else 0
        ok = int(s.get("lastcheckok") or 0)
        br = int(s.get("bitrate") or 0)
        votes = int(s.get("votes") or 0)
        return (ok, https, 1 if br > 0 else 0, votes)

    return a if key(a) >= key(b) else b


async def resolve_seed_station(seed: dict[str, Any], *, market: dict[str, Any]) -> dict[str, Any] | None:
    """Resolve a curated seed to an enriched playable station."""
    best_raw: dict[str, Any] | None = None
    for uid in seed.get("uuids") or []:
        try:
            row = await _raw_station_by_uuid(str(uid))
        except Exception:
            row = None
        if not row:
            continue
        best_raw = row if best_raw is None else _prefer_stream_raw(best_raw, row)
        url = (best_raw.get("url_resolved") or best_raw.get("url") or "").strip()
        if best_raw.get("lastcheckok") and url.lower().startswith("https://"):
            break

    if best_raw is None:
        for q in seed.get("name_queries") or []:
            try:
                rows = await rb_get(
                    "/json/stations/search",
                    {
                        "name": q,
                        "countrycode": market.get("countrycode") or "US",
                        "hidebroken": "true",
                        "order": "votes",
                        "reverse": "true",
                        "limit": 8,
                    },
                )
            except Exception:
                rows = []
            if not isinstance(rows, list):
                continue
            call = (seed.get("callsign") or "").upper()
            for row in rows:
                if not isinstance(row, dict):
                    continue
                name = str(row.get("name") or "")
                if call and call not in name.upper() and call not in str(row.get("tags") or "").upper():
                    brand = (seed.get("brand") or "").lower()
                    if brand and brand.split()[0] not in name.lower():
                        continue
                best_raw = row if best_raw is None else _prefer_stream_raw(best_raw, row)
            if best_raw is not None:
                break

    if not best_raw:
        return None

    seed_meta = {
        "callsign": seed.get("callsign"),
        "brand": seed.get("brand"),
        "dial": seed.get("dial"),
        "band": seed.get("band"),
        "genre": seed.get("genre"),
        "city": "New York" if market.get("id") == "nyc" else None,
        "state": "New York" if market.get("id") == "nyc" else None,
        "market_id": market.get("id"),
    }
    enriched = enrich_station(best_raw, seed=seed_meta)
    enriched["name"] = seeds.seed_display_name(seed)
    enriched["display_name"] = enriched["name"]
    return enriched if enriched.get("playable") else None


async def load_market_seed_stations(
    *,
    lat: float | None,
    lon: float | None,
    countrycode: str | None,
    state: str | None,
    city: str | None,
    top_n: int = 10,
) -> list[dict[str, Any]]:
    markets = seeds.match_markets(
        lat=lat, lon=lon, countrycode=countrycode, state=state, city=city
    )
    if not markets:
        return []
    market = markets[0]
    want = int(market.get("top_n") or top_n)
    out: list[dict[str, Any]] = []
    seen_cs: set[str] = set()
    seen_uuid: set[str] = set()
    for seed in market.get("stations") or []:
        if len(out) >= want:
            break
        try:
            st = await resolve_seed_station(seed, market=market)
        except Exception:
            st = None
        if not st:
            continue
        uid = st.get("stationuuid")
        cs = (st.get("callsign") or seed.get("callsign") or "").upper()
        if uid and uid in seen_uuid:
            continue
        if cs and cs in seen_cs:
            continue
        if uid:
            seen_uuid.add(uid)
        if cs:
            seen_cs.add(cs)
        out.append(st)
    return out
