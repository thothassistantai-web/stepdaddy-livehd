"""Radio Browser API client — mirror pick, polite rate-limit, server cache, classification.

Public API: https://api.radio-browser.info
We never hard-code a single mirror; DNS/list + failover, User-Agent required.
"""
from __future__ import annotations

import asyncio
import os
import re
import socket
import threading
import time
from typing import Any
from urllib.parse import urlencode, urlparse

import httpx

UA = os.environ.get(
    "RADIO_BROWSER_UA",
    f"StepDaddyLiveHD/{os.environ.get('BUNDLE_VERSION', 'dev')} (radio; +https://sdgateway.duckdns.org)",
)
CACHE_TTL_SEC = int(os.environ.get("RADIO_BROWSER_CACHE_TTL", "900"))
NEAR_CACHE_TTL_SEC = int(os.environ.get("RADIO_BROWSER_NEAR_TTL", "300"))
MIRROR_TTL_SEC = int(os.environ.get("RADIO_BROWSER_MIRROR_TTL", "3600"))
MIN_INTERVAL_SEC = float(os.environ.get("RADIO_BROWSER_MIN_INTERVAL", "0.35"))
MAX_LIMIT = int(os.environ.get("RADIO_BROWSER_MAX_LIMIT", "200"))
DEFAULT_LIMIT = int(os.environ.get("RADIO_BROWSER_DEFAULT_LIMIT", "48"))
IP_GEO_TTL_SEC = int(os.environ.get("RADIO_BROWSER_IP_GEO_TTL", "1800"))

# Structural / non-genre tags stripped when listing genres
_STRUCT_TAGS = frozenset(
    {
        "fm",
        "am",
        "hd",
        "hd radio",
        "local",
        "internet",
        "internet radio",
        "web radio",
        "online",
        "radio",
        "music",
        "news",
        "talk",
        "public radio",
        "npr",
        "community",
        "community radio",
        "college",
        "college radio",
        "student",
        "streaming",
        "live",
        "mp3",
        "aac",
        "hls",
    }
)

_COMMERCIAL_TAGS = frozenset(
    {
        "fm",
        "am",
        "hd",
        "hd radio",
        "local",
        "news",
        "talk",
        "sports",
        "npr",
        "public radio",
        "classic hits",
        "top 40",
        "hot ac",
        "adult contemporary",
        "country",
        "urban",
        "urban contemporary",
        "classic rock",
        "oldies",
        "christian",
        "gospel",
        "regional mexican",
        "spanish",
        "iheart",
        "cumulus",
        "audacy",
        "entercom",
        "townsquare",
    }
)

_INTERNET_TAGS = frozenset(
    {
        "internet",
        "internet radio",
        "web radio",
        "online",
        "netradio",
        "webcast",
        "streaming only",
        "diy",
        "vaporwave",
        "lofi",
        "lo-fi",
        "chillout",
        "ambient",
        "electronic only",
    }
)

_US_STATES = {
    "alabama": "AL",
    "alaska": "AK",
    "arizona": "AZ",
    "arkansas": "AR",
    "california": "CA",
    "colorado": "CO",
    "connecticut": "CT",
    "delaware": "DE",
    "florida": "FL",
    "georgia": "GA",
    "hawaii": "HI",
    "idaho": "ID",
    "illinois": "IL",
    "indiana": "IN",
    "iowa": "IA",
    "kansas": "KS",
    "kentucky": "KY",
    "louisiana": "LA",
    "maine": "ME",
    "maryland": "MD",
    "massachusetts": "MA",
    "michigan": "MI",
    "minnesota": "MN",
    "mississippi": "MS",
    "missouri": "MO",
    "montana": "MT",
    "nebraska": "NE",
    "nevada": "NV",
    "new hampshire": "NH",
    "new jersey": "NJ",
    "new mexico": "NM",
    "new york": "NY",
    "north carolina": "NC",
    "north dakota": "ND",
    "ohio": "OH",
    "oklahoma": "OK",
    "oregon": "OR",
    "pennsylvania": "PA",
    "rhode island": "RI",
    "south carolina": "SC",
    "south dakota": "SD",
    "tennessee": "TN",
    "texas": "TX",
    "utah": "UT",
    "vermont": "VT",
    "virginia": "VA",
    "washington": "WA",
    "west virginia": "WV",
    "wisconsin": "WI",
    "wyoming": "WY",
    "district of columbia": "DC",
    "washington dc": "DC",
    "washington d.c.": "DC",
}
_US_STATE_BY_ABBR = {v: k.title() for k, v in _US_STATES.items()}
_US_STATE_BY_ABBR["DC"] = "District of Columbia"

_CALLSIGN_RE = re.compile(
    r"^(?:[KW][A-Z]{2,3}|[KW]\d[A-Z]{2,3})\b|\b(?:[KW][A-Z]{2,3})\s*(?:-?\s*(?:FM|AM|HD))?\b",
    re.I,
)
_FM_RE = re.compile(r"\b(\d{2,3}\.\d)\s*(?:FM)?\b|\bFM\b", re.I)
_AM_RE = re.compile(r"\b(\d{3,4})\s*AM\b|\bAM\b", re.I)
_HD_RE = re.compile(r"\bHD\s*[123]?\b|HD\s*Radio", re.I)

HEURISTIC_DOC = {
    "hierarchy": [
        "commercial|internet",
        "state",
        "city",
        "band",
        "genre",
        "station",
    ],
    "commercial_vs_internet": (
        "Score each station. Commercial signals: US/CA callsign-like names (K***/W***), "
        "tags in {fm,am,local,news,talk,sports,npr,classic hits,top 40,country,...}, "
        "non-empty real US state / iso_3166_2 subdivision, broadcast-style bitrates. "
        "Internet signals: tags {internet,internet radio,web radio,online,...}, empty geography, "
        "no callsign. Winner by score; ties prefer commercial when a real state is present, else internet."
    ),
    "band": (
        "AM / FM / HD inferred from tags + name frequency patterns; else Digital (stream-only)."
    ),
    "city": (
        "Derived from Radio Browser `state` when it looks like a city, else from comma forms "
        "('City ST'), else 'Regional'. Near-you uses geo search + IP/browser location."
    ),
    "genre": "Comma tags minus structural tags (fm/am/local/internet/…). First remaining tag is primary.",
    "local_top_n": (
        "Near-you merges curated metro seeds (callsign/dial/uuid) when geo/state matches a market "
        "(e.g. NYC), ensuring flagship FM/AM locals fill the top ~10 even when Radio Browser "
        "geo/state search is sparse or polluted by global clickcounts."
    ),
    "display_name": "Prefer `CALL · Brand · dial BAND` when callsign/dial known (seed or name parse).",
}


class _TTLCache:
    def __init__(self) -> None:
        self._data: dict[str, tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Any | None:
        now = time.monotonic()
        with self._lock:
            item = self._data.get(key)
            if not item:
                return None
            exp, val = item
            if now > exp:
                del self._data[key]
                return None
            return val

    def set(self, key: str, val: Any, ttl: float) -> None:
        with self._lock:
            self._data[key] = (time.monotonic() + ttl, val)
            if len(self._data) > 512:
                stale = [k for k, (e, _) in self._data.items() if e < time.monotonic()]
                for k in stale[:128]:
                    self._data.pop(k, None)


_cache = _TTLCache()
_last_upstream = 0.0
_upstream_lock = asyncio.Lock()
_mirrors: list[str] = []
_mirrors_ts = 0.0
_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=8.0, read=25.0, write=10.0, pool=5.0),
            headers={"User-Agent": UA, "Accept": "application/json"},
            follow_redirects=True,
        )
    return _client


async def close_radio_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def _discover_mirrors_sync() -> list[str]:
    names: list[str] = []
    try:
        infos = socket.getaddrinfo("all.api.radio-browser.info", 443, type=socket.SOCK_STREAM)
        ips = sorted({i[4][0] for i in infos if i[4]})
        for ip in ips:
            try:
                host, _, _ = socket.gethostbyaddr(ip)
                if host and host not in names:
                    names.append(host.rstrip("."))
            except socket.herror:
                continue
    except OSError:
        pass
    if not names:
        names = ["de1.api.radio-browser.info", "nl1.api.radio-browser.info", "at1.api.radio-browser.info"]
    # Prefer de1 first when present (known-good in our probes)
    names.sort(key=lambda h: (0 if h.startswith("de1.") else 1, h))
    return names


async def get_mirrors(force: bool = False) -> list[str]:
    global _mirrors, _mirrors_ts
    now = time.monotonic()
    if not force and _mirrors and now - _mirrors_ts < MIRROR_TTL_SEC:
        return list(_mirrors)
    names = await asyncio.to_thread(_discover_mirrors_sync)
    _mirrors = names
    _mirrors_ts = now
    return list(names)


async def _throttle() -> None:
    global _last_upstream
    async with _upstream_lock:
        now = time.monotonic()
        wait = MIN_INTERVAL_SEC - (now - _last_upstream)
        if wait > 0:
            await asyncio.sleep(wait)
        _last_upstream = time.monotonic()


async def rb_get(path: str, params: dict[str, Any] | None = None, ttl: float | None = None) -> Any:
    """GET /json/... from a working mirror with cache + throttle."""
    params = {k: v for k, v in (params or {}).items() if v is not None and v != ""}
    cache_key = f"GET:{path}?{urlencode(sorted((k, str(v)) for k, v in params.items()))}"
    hit = _cache.get(cache_key)
    if hit is not None:
        return hit

    mirrors = await get_mirrors()
    client = _get_client()
    last_err: Exception | None = None
    for host in mirrors:
        url = f"https://{host}{path}"
        try:
            await _throttle()
            r = await client.get(url, params=params)
            if r.status_code >= 500:
                last_err = RuntimeError(f"{host} HTTP {r.status_code}")
                continue
            r.raise_for_status()
            data = r.json()
            _cache.set(cache_key, data, float(ttl if ttl is not None else CACHE_TTL_SEC))
            return data
        except Exception as exc:  # noqa: BLE001 — failover across mirrors
            last_err = exc
            continue
    # Force rediscover once
    mirrors = await get_mirrors(force=True)
    for host in mirrors:
        url = f"https://{host}{path}"
        try:
            await _throttle()
            r = await client.get(url, params=params)
            r.raise_for_status()
            data = r.json()
            _cache.set(cache_key, data, float(ttl if ttl is not None else CACHE_TTL_SEC))
            return data
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            continue
    raise RuntimeError(f"radio-browser unavailable: {last_err}")


def _tag_list(raw: str | None) -> list[str]:
    if not raw:
        return []
    out: list[str] = []
    for part in str(raw).split(","):
        t = part.strip().lower()
        if t and t not in out:
            out.append(t)
    return out


def _normalize_state_city(raw_state: str, countrycode: str, iso_3166_2: str) -> tuple[str, str]:
    """Return (state_name, city_label)."""
    s = (raw_state or "").strip()
    cc = (countrycode or "").upper()
    iso = (iso_3166_2 or "").upper()

    if iso.startswith("US-") and len(iso) >= 5:
        abbr = iso[3:5]
        state_name = _US_STATE_BY_ABBR.get(abbr, abbr)
        city = s
        # If state field is the state name itself, city unknown
        if s.lower() in _US_STATES or s.upper() == abbr:
            city = "Regional"
        elif "," in s:
            left, right = [p.strip() for p in s.split(",", 1)]
            if right.upper() in _US_STATE_BY_ABBR or right.lower() in _US_STATES:
                city = left or "Regional"
                state_name = _US_STATE_BY_ABBR.get(right.upper()) or (
                    right.title() if right.lower() in _US_STATES else state_name
                )
            else:
                city = left
        elif s.upper() in _US_STATE_BY_ABBR:
            city = "Regional"
            state_name = _US_STATE_BY_ABBR[s.upper()]
        return state_name, city or "Regional"

    if cc == "US" or cc == "USA":
        low = s.lower()
        if low in _US_STATES:
            return low.title() if low != "district of columbia" else "District of Columbia", "Regional"
        # "Los Angeles CA" / "New York NY"
        m = re.match(r"^(.+?)\s+([A-Z]{2})$", s)
        if m and m.group(2) in _US_STATE_BY_ABBR:
            return _US_STATE_BY_ABBR[m.group(2)], m.group(1).strip() or "Regional"
        if "," in s:
            left, right = [p.strip() for p in s.split(",", 1)]
            rlow = right.lower()
            if rlow in _US_STATES:
                return rlow.title(), left or "Regional"
            if right.upper() in _US_STATE_BY_ABBR:
                return _US_STATE_BY_ABBR[right.upper()], left or "Regional"
            return right or "Unknown", left or "Regional"
        if s:
            # Ambiguous: treat as city under Unknown unless it's a known state fragment
            return "Unknown", s
        return "Unknown", "Regional"

    if not s:
        return "Unknown", "Regional"
    if "," in s:
        left, right = [p.strip() for p in s.split(",", 1)]
        return right or "Unknown", left or "Regional"
    return s, "Regional"


def infer_band(station: dict[str, Any]) -> str:
    name = str(station.get("name") or "")
    tags = set(_tag_list(station.get("tags")))
    if "am" in tags or (_AM_RE.search(name) and not _FM_RE.search(name)):
        if _AM_RE.search(name) or "am" in tags:
            # Prefer FM if both clear FM frequency present
            if _FM_RE.search(name) and re.search(r"\d{2,3}\.\d", name):
                return "FM"
            return "AM"
    if "hd" in tags or "hd radio" in tags or _HD_RE.search(name):
        return "HD"
    if "fm" in tags or _FM_RE.search(name):
        return "FM"
    if "am" in tags or _AM_RE.search(name):
        return "AM"
    return "Digital"


def classify_station(station: dict[str, Any]) -> str:
    """Return 'commercial' or 'internet'."""
    name = str(station.get("name") or "")
    tags = set(_tag_list(station.get("tags")))
    state = str(station.get("state") or "").strip()
    cc = str(station.get("countrycode") or "").upper()
    iso = str(station.get("iso_3166_2") or "")
    bitrate = int(station.get("bitrate") or 0)

    commercial = 0
    internet = 0

    if tags & _COMMERCIAL_TAGS:
        commercial += 2 + min(2, len(tags & _COMMERCIAL_TAGS) - 1)
    if tags & _INTERNET_TAGS:
        internet += 2 + min(2, len(tags & _INTERNET_TAGS) - 1)

    if _CALLSIGN_RE.search(name):
        commercial += 3
    if _FM_RE.search(name) or _AM_RE.search(name):
        commercial += 1

    st_name, _city = _normalize_state_city(state, cc, iso)
    if st_name and st_name != "Unknown":
        commercial += 2
    elif not state and not station.get("geo_lat"):
        internet += 1

    if cc in {"US", "CA", "GB", "AU"} and state:
        commercial += 1

    if bitrate and 24 <= bitrate <= 192:
        commercial += 1
    if bitrate and bitrate >= 256 and not (tags & _COMMERCIAL_TAGS):
        internet += 1

    if commercial > internet:
        return "commercial"
    if internet > commercial:
        return "internet"
    # tie-break
    if st_name and st_name != "Unknown" and (_CALLSIGN_RE.search(name) or tags & {"fm", "am", "local"}):
        return "commercial"
    return "internet"


def genres_from_station(station: dict[str, Any]) -> list[str]:
    skip = _STRUCT_TAGS | {"fm", "am", "hd", "hd radio", "local", "internet", "internet radio", "web radio", "online"}
    genres: list[str] = []
    for t in _tag_list(station.get("tags")):
        if t in skip:
            continue
        if t not in genres:
            genres.append(t)
    return genres[:12] or ["variety"]


from .radio_station_meta import format_station_display_name, parse_broadcast_identity  # noqa: E402


def _best_favicon(raw: dict[str, Any]) -> str:
    """Prefer Radio Browser favicon; else derive a logo URL from homepage host."""
    fav = str(raw.get("favicon") or "").strip()
    if fav.startswith(("http://", "https://")):
        return fav
    home = str(raw.get("homepage") or "").strip()
    if not home:
        return ""
    try:
        host = urlparse(home if "://" in home else f"https://{home}").hostname
    except Exception:  # noqa: BLE001
        host = None
    if not host or "." not in host:
        return ""
    # Public icon CDN — fills many missing/broken Radio Browser favicons.
    return f"https://icons.duckduckgo.com/ip3/{host.lower()}.ico"


def enrich_station(raw: dict[str, Any], *, seed: dict[str, Any] | None = None) -> dict[str, Any]:
    state_name, city = _normalize_state_city(
        str(raw.get("state") or ""),
        str(raw.get("countrycode") or ""),
        str(raw.get("iso_3166_2") or ""),
    )
    stream = (raw.get("url_resolved") or raw.get("url") or "").strip()
    hls = bool(int(raw.get("hls") or 0))
    playable = bool(stream) and not stream.lower().endswith((".html", ".htm"))
    cls = classify_station(raw)
    genres = genres_from_station(raw)
    band = infer_band(raw)
    ident = parse_broadcast_identity(str(raw.get("name") or ""), raw.get("tags"))
    callsign = (seed or {}).get("callsign") or ident.get("callsign")
    dial = (seed or {}).get("dial") or ident.get("dial")
    brand = (seed or {}).get("brand") or ident.get("brand")
    dial_band = (seed or {}).get("band") or ident.get("band") or (band if band in {"AM", "FM", "HD"} else None)
    if seed and seed.get("genre"):
        g = str(seed["genre"]).strip()
        if g:
            genres = [g] + [x for x in genres if x.lower() != g.lower()]
    display = format_station_display_name(
        raw_name=str(raw.get("name") or "Unknown"),
        callsign=callsign,
        brand=brand,
        dial=dial,
        band=dial_band,
    )
    # Seeded flagships are always treated as commercial broadcast
    if seed:
        cls = "commercial"
        if dial_band in {"AM", "FM", "HD"}:
            band = dial_band
        if seed.get("city"):
            city = str(seed["city"])
        if seed.get("state"):
            state_name = str(seed["state"])
    return {
        "stationuuid": raw.get("stationuuid"),
        "name": display,
        "raw_name": raw.get("name") or "Unknown",
        "display_name": display,
        "callsign": callsign,
        "dial": dial,
        "dial_band": dial_band,
        "brand": brand,
        "class": cls,
        "state": state_name,
        "city": city,
        "band": band,
        "genre": genres[0] if genres else "variety",
        "genres": genres,
        "countrycode": (raw.get("countrycode") or "").upper(),
        "tags": raw.get("tags") or "",
        "favicon": _best_favicon(raw),
        "homepage": raw.get("homepage") or "",
        "codec": raw.get("codec") or "",
        "bitrate": int(raw.get("bitrate") or 0),
        "hls": hls,
        "stream_url": stream if playable else "",
        "playable": playable,
        "votes": int(raw.get("votes") or 0),
        "clickcount": int(raw.get("clickcount") or 0),
        "geo_lat": raw.get("geo_lat"),
        "geo_long": raw.get("geo_long"),
        "geo_distance": raw.get("geo_distance"),
        "lastcheckok": int(raw.get("lastcheckok") or 0),
        "seeded": bool(seed),
        "market_id": (seed or {}).get("market_id"),
    }


def _clamp_limit(limit: int | None) -> int:
    try:
        n = int(limit if limit is not None else DEFAULT_LIMIT)
    except (TypeError, ValueError):
        n = DEFAULT_LIMIT
    return max(1, min(MAX_LIMIT, n))


async def search_stations(**kwargs: Any) -> list[dict[str, Any]]:
    limit = _clamp_limit(kwargs.pop("limit", DEFAULT_LIMIT))
    params: dict[str, Any] = {
        "hidebroken": "true",
        "order": kwargs.get("order") or "clickcount",
        "reverse": "true" if kwargs.get("reverse", True) else "false",
        "limit": limit,
        "offset": int(kwargs.get("offset") or 0),
    }
    for key in (
        "name",
        "countrycode",
        "state",
        "language",
        "tag",
        "tagList",
        "codec",
        "bitrateMin",
        "bitrateMax",
        "has_geo_info",
        "geo_lat",
        "geo_long",
    ):
        if key in kwargs and kwargs[key] not in (None, ""):
            params[key] = kwargs[key]
    raw = await rb_get("/json/stations/search", params)
    if not isinstance(raw, list):
        return []
    return [enrich_station(s) for s in raw if isinstance(s, dict)]


async def station_by_uuid(uuid: str) -> dict[str, Any] | None:
    raw = await rb_get(f"/json/stations/byuuid/{uuid}", ttl=CACHE_TTL_SEC)
    if isinstance(raw, list) and raw:
        return enrich_station(raw[0])
    if isinstance(raw, dict) and raw.get("stationuuid"):
        return enrich_station(raw)
    return None


# Seed resolve lives in radio_local (keeps this module under ~1k lines).
from .radio_local import (  # noqa: E402
    load_market_seed_stations,
    resolve_seed_station,
)

async def record_click(uuid: str) -> dict[str, Any]:
    # Clicks should not be cached
    mirrors = await get_mirrors()
    client = _get_client()
    last_err: Exception | None = None
    for host in mirrors:
        try:
            await _throttle()
            r = await client.get(f"https://{host}/json/url/{uuid}")
            if r.status_code < 500:
                try:
                    return r.json()
                except Exception:
                    return {"ok": True}
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            continue
    return {"ok": False, "error": str(last_err or "click_failed")}



async def resolve_ip_geo(ip: str) -> dict[str, Any]:
    ip = (ip or "").split(",")[0].strip()
    if not ip or ip in {"127.0.0.1", "::1", "unknown"}:
        return {"ok": False, "source": "none"}
    cache_key = f"ipgeo:{ip}"
    hit = _cache.get(cache_key)
    if hit is not None:
        return hit

    client = _get_client()
    # ip-api.com free (non-HTTPS on free tier) — fine server-side
    try:
        await _throttle()
        r = await client.get(
            f"http://ip-api.com/json/{ip}",
            params={"fields": "status,country,countryCode,region,regionName,city,lat,lon,query"},
        )
        data = r.json()
        if data.get("status") == "success":
            out = {
                "ok": True,
                "source": "ip-api",
                "ip": data.get("query") or ip,
                "countrycode": data.get("countryCode") or "",
                "state": data.get("regionName") or "",
                "region_code": data.get("region") or "",
                "city": data.get("city") or "",
                "lat": data.get("lat"),
                "lon": data.get("lon"),
            }
            _cache.set(cache_key, out, IP_GEO_TTL_SEC)
            return out
    except Exception:
        pass

    try:
        await _throttle()
        r = await client.get(f"https://ipapi.co/{ip}/json/")
        data = r.json()
        if not data.get("error"):
            out = {
                "ok": True,
                "source": "ipapi.co",
                "ip": data.get("ip") or ip,
                "countrycode": data.get("country_code") or data.get("country") or "",
                "state": data.get("region") or "",
                "region_code": data.get("region_code") or "",
                "city": data.get("city") or "",
                "lat": data.get("latitude"),
                "lon": data.get("longitude"),
            }
            _cache.set(cache_key, out, IP_GEO_TTL_SEC)
            return out
    except Exception:
        pass

    out = {"ok": False, "source": "none", "ip": ip}
    _cache.set(cache_key, out, 120)
    return out


def _facet_counts(stations: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for s in stations:
        val = str(s.get(key) or "Unknown").strip() or "Unknown"
        counts[val] = counts.get(val, 0) + 1
    items = [{"name": k, "count": v} for k, v in counts.items()]
    items.sort(key=lambda x: (-x["count"], x["name"].lower()))
    return items


def filter_hierarchy(
    stations: list[dict[str, Any]],
    *,
    cls: str | None = None,
    state: str | None = None,
    city: str | None = None,
    band: str | None = None,
    genre: str | None = None,
) -> list[dict[str, Any]]:
    out = stations
    if cls:
        c = cls.lower().strip()
        out = [s for s in out if s.get("class") == c]
    if state:
        st = state.lower().strip()
        out = [s for s in out if str(s.get("state") or "").lower() == st]
    if city:
        cy = city.lower().strip()
        out = [s for s in out if str(s.get("city") or "").lower() == cy]
    if band:
        b = band.lower().strip()
        out = [s for s in out if str(s.get("band") or "").lower() == b]
    if genre:
        g = genre.lower().strip()
        out = [
            s
            for s in out
            if str(s.get("genre") or "").lower() == g
            or g in [x.lower() for x in (s.get("genres") or [])]
        ]
    return out


async def browse_level(
    *,
    cls: str | None = None,
    state: str | None = None,
    city: str | None = None,
    band: str | None = None,
    genre: str | None = None,
    countrycode: str | None = None,
    seed_limit: int = 200,
) -> dict[str, Any]:
    """Return next facet list + stations when fully drilled down."""
    params: dict[str, Any] = {"limit": min(seed_limit, MAX_LIMIT), "countrycode": countrycode or None}
    # Prefer state filter at upstream when possible
    if state and state.lower() not in {"unknown", "regional"}:
        params["state"] = state
    raw = await search_stations(**params)
    # If state filter too strict (RB state field quirks), widen to country then filter locally
    if state and len(raw) < 3 and countrycode:
        wider = await search_stations(countrycode=countrycode, limit=min(seed_limit, MAX_LIMIT))
        raw = wider

    filtered = filter_hierarchy(raw, cls=cls, state=state, city=city, band=band, genre=genre)

    # Inject curated flagships when browsing a seeded market (commercial branch)
    if (cls or "").lower() == "commercial" and state:
        try:
            seeded = await load_market_seed_stations(
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
            inject: list[dict[str, Any]] = []
            for s in seeded:
                uid = s.get("stationuuid")
                cs = (s.get("callsign") or "").upper()
                if uid and uid in seen:
                    continue
                if cs and cs in seen_cs:
                    continue
                # Respect deeper filters when present
                if city and str(s.get("city") or "").lower() != str(city).lower():
                    # Seeds use metro city label; allow Regional / New York aliases
                    if str(city).lower() not in {"new york", "nyc", "new york city", "regional"}:
                        continue
                if band and str(s.get("band") or "").lower() != str(band).lower():
                    continue
                if genre:
                    g = genre.lower()
                    if str(s.get("genre") or "").lower() != g and g not in [
                        x.lower() for x in (s.get("genres") or [])
                    ]:
                        continue
                inject.append(s)
                if uid:
                    seen.add(uid)
                if cs:
                    seen_cs.add(cs)
            if inject:
                filtered = inject + filtered

    if not cls:
        level = "class"
        facets = [
            {"name": "commercial", "count": sum(1 for s in filtered if s["class"] == "commercial")},
            {"name": "internet", "count": sum(1 for s in filtered if s["class"] == "internet")},
        ]
    elif not state:
        level = "state"
        facets = _facet_counts(filtered, "state")
    elif not city:
        level = "city"
        facets = _facet_counts(filtered, "city")
    elif not band:
        level = "band"
        facets = _facet_counts(filtered, "band")
    elif not genre:
        level = "genre"
        facets = _facet_counts(filtered, "genre")
    else:
        level = "station"
        facets = []

    stations = filtered if level == "station" else []
    # When drilling to stations, sort playable first
    if stations:
        stations = sorted(
            stations,
            key=lambda s: (
                0 if s.get("playable") else 1,
                -(s.get("clickcount") or 0),
                -(s.get("votes") or 0),
                str(s.get("name") or ""),
            ),
        )

    return {
        "level": level,
        "facets": facets,
        "stations": stations[:DEFAULT_LIMIT] if stations else [],
        "station_count": len(filtered),
        "filters": {
            "class": cls,
            "state": state,
            "city": city,
            "band": band,
            "genre": genre,
            "countrycode": countrycode,
        },
        "heuristic": HEURISTIC_DOC,
    }


async def near_you(
    *,
    lat: float | None,
    lon: float | None,
    countrycode: str | None,
    state: str | None,
    city: str | None,
    limit: int = 36,
) -> dict[str, Any]:
    limit = _clamp_limit(limit)
    cache_key = f"near:v2:{lat}:{lon}:{countrycode}:{state}:{city}:{limit}"
    hit = _cache.get(cache_key)
    if hit is not None:
        return hit

    # Curated flagship locals for matched metros (NYC, …)
    seeded: list[dict[str, Any]] = []
    try:
        seeded = await load_market_seed_stations(
            lat=lat,
            lon=lon,
            countrycode=countrycode,
            state=state,
            city=city,
            top_n=10,
        )
    except Exception:
        seeded = []

    geo_stations: list[dict[str, Any]] = []
    if lat is not None and lon is not None:
        try:
            geo_stations = await search_stations(
                geo_lat=lat,
                geo_long=lon,
                has_geo_info="true",
                limit=max(limit, 64),
                order="clickcount",
            )
            # Drop global clickcount noise: keep same-country and/or within ~800 km
            cc_u = (countrycode or "").upper()
            filtered_geo: list[dict[str, Any]] = []
            for s in geo_stations:
                scc = str(s.get("countrycode") or "").upper()
                dist = s.get("geo_distance")
                try:
                    dist_f = float(dist) if dist is not None else None
                except (TypeError, ValueError):
                    dist_f = None
                if dist_f is not None and dist_f <= 800_000:
                    filtered_geo.append(s)
                elif cc_u and scc == cc_u and (dist_f is None or dist_f <= 1_500_000):
                    # Same country but only if commercial / callsign-ish to avoid CNN/BBC
                    if s.get("class") == "commercial" or s.get("callsign"):
                        filtered_geo.append(s)
            if filtered_geo:
                geo_stations = filtered_geo
            geo_stations.sort(
                key=lambda s: (
                    0 if s.get("class") == "commercial" else 1,
                    float(s["geo_distance"]) if s.get("geo_distance") is not None else 1e15,
                    -(s.get("votes") or 0),
                    -(s.get("clickcount") or 0),
                )
            )
        except Exception:
            geo_stations = []

    local: list[dict[str, Any]] = []
    if state:
        try:
            local = await search_stations(
                countrycode=countrycode or "US",
                state=state,
                limit=limit,
            )
        except Exception:
            local = []
        # Also try city-as-state quirks
        if city and len(local) < 8:
            try:
                more = await search_stations(
                    countrycode=countrycode or "US",
                    state=f"{city}",
                    limit=limit,
                )
                seen = {s["stationuuid"] for s in local}
                for s in more:
                    if s["stationuuid"] not in seen:
                        local.append(s)
                        seen.add(s["stationuuid"])
            except Exception:
                pass

    def _call_key(s: dict[str, Any]) -> str:
        return (s.get("callsign") or "").upper()

    def _loc_score(s: dict[str, Any]) -> tuple[int, int, float, int]:
        st_match = 0
        if state and str(s.get("state") or "").lower() == str(state).lower():
            st_match = 2
        if city and str(s.get("city") or "").lower() == str(city).lower():
            st_match = 3
        seeded_boost = 1 if s.get("seeded") else 0
        commercial_boost = 1 if s.get("class") == "commercial" else 0
        dist = float(s["geo_distance"]) if s.get("geo_distance") is not None else 9e15
        return (-seeded_boost, -st_match - commercial_boost, dist, -(s.get("clickcount") or 0))

    seen_uuid: set[str] = set()
    seen_call: set[str] = set()
    merged: list[dict[str, Any]] = []

    def _add(s: dict[str, Any]) -> None:
        uid = s.get("stationuuid")
        if not uid or uid in seen_uuid:
            return
        ck = _call_key(s)
        if ck and ck in seen_call:
            return
        seen_uuid.add(uid)
        if ck:
            seen_call.add(ck)
        merged.append(s)

    # Seeds first (guaranteed top locals), then discovered locals / geo
    for s in seeded:
        _add(s)
    for bucket in (local, geo_stations):
        for s in bucket:
            _add(s)

    # Keep seeded block at front; sort the remainder
    seed_block = [s for s in merged if s.get("seeded")]
    rest = [s for s in merged if not s.get("seeded")]
    rest.sort(key=_loc_score)
    merged = seed_block + rest

    # Prefer commercial broadcast in the primary near-you strip when we have enough
    commercial = [s for s in merged if s.get("class") == "commercial"]
    internet = [s for s in merged if s.get("class") == "internet"]
    near = merged[:limit]
    # If near is thin on commercial, rebuild near as seeds + commercial + rest
    if len([s for s in near if s.get("class") == "commercial"]) < min(10, len(commercial)):
        near = (seed_block + commercial + internet)[:limit]
        # dedupe preserve order
        seen: set[str] = set()
        deduped: list[dict[str, Any]] = []
        for s in near:
            uid = s.get("stationuuid")
            if not uid or uid in seen:
                continue
            seen.add(uid)
            deduped.append(s)
        near = deduped[:limit]

    out = {
        "near": near,
        "commercial": commercial[: max(10, limit // 2)],
        "internet": internet[: max(8, limit // 2)],
        "seeded_count": len(seed_block),
        "location": {
            "lat": lat,
            "lon": lon,
            "countrycode": countrycode,
            "state": state,
            "city": city,
        },
        "heuristic": HEURISTIC_DOC,
    }
    _cache.set(cache_key, out, NEAR_CACHE_TTL_SEC)
    return out
