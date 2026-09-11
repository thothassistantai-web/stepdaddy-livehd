"""Cinemeta/Metahub-backed VOD catalog (browse, search, details).

Title metadata and posters come from Stremio Cinemeta + Metahub images.
TMDB is used only to map numeric `tmdb_id` → IMDb when a deep link lacks
`?imdb=` (external_ids). Stream aggregators still receive numeric `tmdb_id`
values when Cinemeta provides `moviedb_id` on a title.
"""

from __future__ import annotations

import json
import os
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

CINEMETA_API = os.environ.get("CINEMETA_API", "https://v3-cinemeta.strem.io").rstrip("/")
METAHUB_POSTER = os.environ.get(
    "METAHUB_POSTER_BASE", "https://images.metahub.space/poster/medium"
).rstrip("/")
METAHUB_BACKGROUND = os.environ.get(
    "METAHUB_BACKGROUND_BASE", "https://images.metahub.space/background/medium"
).rstrip("/")
# Wikidata Query Service rate-limits generic browser UAs; identify the gateway.
UA = os.environ.get(
    "VOD_META_UA",
    "StepDaddyLiveHD/1.0 (https://sdgateway.duckdns.org; vod-catalog)",
)
TMDB_API = os.environ.get("TMDB_API", "https://api.themoviedb.org/3").rstrip("/")
PAGE_SIZE = 50

# Curated streaming-provider chips (UI only; Cinemeta has no watch-provider filter).
STREAMING_PROVIDERS: list[dict] = [
    {"id": 8, "name": "Netflix", "slug": "netflix", "color": "#e50914"},
    {"id": 9, "name": "Prime Video", "slug": "prime", "color": "#00a8e1"},
    {"id": 15, "name": "Hulu", "slug": "hulu", "color": "#1ce783"},
    {"id": 337, "name": "Disney+", "slug": "disney", "color": "#113ccf"},
    {"id": 384, "name": "Max", "slug": "max", "color": "#002be7"},
    {"id": 350, "name": "Apple TV+", "slug": "apple", "color": "#555555"},
    {"id": 386, "name": "Peacock", "slug": "peacock", "color": "#000000"},
    {"id": 531, "name": "Paramount+", "slug": "paramount", "color": "#0064ff"},
    {"id": 73, "name": "Tubi", "slug": "tubi", "color": "#fa382f"},
    {"id": 300, "name": "Pluto TV", "slug": "pluto", "color": "#fff200"},
    {"id": 283, "name": "Crunchyroll", "slug": "crunchyroll", "color": "#f47521"},
    {"id": 1899, "name": "HBO Max", "slug": "hbo", "color": "#5822b4"},
]

SORT_OPTIONS: list[dict] = [
    {"id": "popularity.desc", "label": "Popular"},
    {"id": "vote_average.desc", "label": "Top rated"},
    {"id": "release_date.desc", "label": "Newest"},
    {"id": "release_date.asc", "label": "Oldest"},
]

CINEMETA_GENRES: list[str] = [
    "Action",
    "Adventure",
    "Animation",
    "Biography",
    "Comedy",
    "Crime",
    "Documentary",
    "Drama",
    "Family",
    "Fantasy",
    "History",
    "Horror",
    "Mystery",
    "Romance",
    "Sci-Fi",
    "Sport",
    "Thriller",
    "War",
    "Western",
]


def _genre_id(name: str) -> int:
    # Stable positive id from genre name (client sends genre_id as a number).
    h = 0
    for ch in name.lower():
        h = (h * 131 + ord(ch)) & 0x7FFFFFFF
    return h or 1


_GENRE_BY_ID = {_genre_id(g): g for g in CINEMETA_GENRES}


def _parse_year(value: str | int | None) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value if value > 1800 else None
    text = str(value).strip()
    if len(text) >= 4 and text[:4].isdigit():
        return int(text[:4])
    return None


def _poster_url(imdb_id: str | None, poster: str | None = None) -> str | None:
    if poster:
        return poster
    if imdb_id and str(imdb_id).startswith("tt"):
        return f"{METAHUB_POSTER}/{imdb_id}/img"
    return None


def _backdrop_url(imdb_id: str | None, background: str | None = None) -> str | None:
    if background:
        return background
    if imdb_id and str(imdb_id).startswith("tt"):
        return f"{METAHUB_BACKGROUND}/{imdb_id}/img"
    return None


def _star_rating(vote_average: float | None) -> dict | None:
    if vote_average is None:
        return None
    try:
        val = float(vote_average)
    except (TypeError, ValueError):
        return None
    if val <= 0:
        return None
    # Cinemeta/IMDb are already ~0–10.
    stars5 = round(val / 2, 1)
    full = int(stars5)
    half = stars5 - full >= 0.5
    empty = 5 - full - (1 if half else 0)
    return {
        "score": round(val, 1),
        "stars5": stars5,
        "full": full,
        "half": half,
        "empty": max(0, empty),
    }


def _quality_tags(year: int | None, media_type: str) -> list[str]:
    tags: list[str] = []
    now_year = datetime.now(timezone.utc).year
    if media_type == "movie" and year and year >= now_year:
        tags.append("CAM")
    if "CAM" not in tags:
        if year and year >= 2020:
            tags.append("1080")
        elif year and year >= 2012:
            tags.append("720")
        else:
            tags.append("SD")
        if year and year >= 2008:
            tags.append("HD")
    tags.append("WEB")
    out: list[str] = []
    for t in tags:
        if t not in out:
            out.append(t)
        if len(out) >= 2:
            break
    return out


def _runtime_minutes(runtime: str | int | None) -> int | None:
    if runtime is None:
        return None
    if isinstance(runtime, int):
        return runtime if runtime > 0 else None
    m = re.search(r"(\d+)", str(runtime))
    return int(m.group(1)) if m else None


def _parse_air_datetime(value: Any) -> datetime | None:
    if value is None or value == "":
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        pass
    for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(text[:10], fmt).replace(tzinfo=timezone.utc)
        except Exception:
            continue
    return None


def _episode_air_date(ep: dict) -> str | None:
    for key in ("firstAired", "released", "air_date", "releaseInfo"):
        dt = _parse_air_datetime(ep.get(key))
        if dt:
            return dt.date().isoformat()
    return None


def _episode_has_aired(ep: dict, now: datetime | None = None) -> bool:
    dt = None
    for key in ("firstAired", "released", "air_date", "releaseInfo"):
        dt = _parse_air_datetime(ep.get(key))
        if dt:
            break
    if not dt:
        # No date — treat numbered episodes with real titles as available.
        title = str(ep.get("name") or ep.get("title") or "").strip().lower()
        return bool(title and title not in ("tba", "tbd", "coming soon"))
    now = now or datetime.now(timezone.utc)
    return dt <= now


def _latest_aired_from_videos(videos: list) -> dict | None:
    now = datetime.now(timezone.utc)
    best = None
    best_key = None
    for ep in videos or []:
        if not isinstance(ep, dict):
            continue
        sn = ep.get("season")
        if sn is None or int(sn) < 1:
            continue
        if not _episode_has_aired(ep, now):
            continue
        num = ep.get("episode") if ep.get("episode") is not None else ep.get("number")
        try:
            sn_i, ep_i = int(sn), int(num)
        except (TypeError, ValueError):
            continue
        key = (sn_i, ep_i)
        if best_key is None or key > best_key:
            best_key = key
            best = {
                "season": sn_i,
                "episode": ep_i,
                "title": ep.get("name") or ep.get("title") or f"Episode {ep_i}",
                "air_date": _episode_air_date(ep),
            }
    return best


def _cinemeta_type(media_type: str) -> str:
    return "series" if media_type in ("tv", "series", "show") else "movie"


def _media_type_from_cinemeta(kind: str | None) -> str:
    return "tv" if (kind or "").lower() in ("series", "tv", "show") else "movie"


def _sort_to_catalog(sort: str) -> str:
    if sort == "vote_average.desc":
        return "imdbRating"
    if sort in ("release_date.desc", "release_date.asc"):
        return "year"
    return "top"


class VodCatalogService:
    def __init__(self):
        self.timeout = int(os.environ.get("META_HTTP_TIMEOUT_SECONDS", "12"))
        self._cache: dict[str, tuple[float, dict | list]] = {}
        self._cache_ttl = int(os.environ.get("VOD_CATALOG_CACHE_TTL", "900"))
        self._id_map: dict[str, str] = {}  # "movie:27205" -> tt...
        self._id_map_path = Path(
            os.environ.get(
                "VOD_ID_MAP_PATH",
                str(Path(__file__).resolve().parents[1] / "data" / "cinemeta_id_map.json"),
            )
        )
        self._load_id_map()

    @property
    def enabled(self) -> bool:
        # Free public metadata — no API key required.
        return True

    def _load_id_map(self) -> None:
        try:
            if self._id_map_path.is_file():
                data = json.loads(self._id_map_path.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    self._id_map = {str(k): str(v) for k, v in data.items() if v}
        except Exception:
            self._id_map = {}

    def _save_id_map(self) -> None:
        try:
            self._id_map_path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self._id_map_path.with_suffix(".tmp")
            tmp.write_text(json.dumps(self._id_map), encoding="utf-8")
            tmp.replace(self._id_map_path)
        except Exception:
            pass

    def _remember_ids(self, media_type: str, tmdb_id: int | None, imdb_id: str | None) -> None:
        if not tmdb_id or not imdb_id or not str(imdb_id).startswith("tt"):
            return
        key = f"{_media_type_from_cinemeta(media_type)}:{int(tmdb_id)}"
        if self._id_map.get(key) == imdb_id:
            return
        self._id_map[key] = imdb_id
        # Persist occasionally (every new mapping is fine at this scale).
        self._save_id_map()

    def _http_json(self, url: str) -> dict | list | None:
        hit = self._cache.get(url)
        if hit and time.time() - hit[0] < self._cache_ttl:
            return hit[1]
        req = urllib.request.Request(
            url, headers={"User-Agent": UA, "Accept": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8", errors="replace"))
        except Exception:
            return None
        if data is not None:
            self._cache[url] = (time.time(), data)
        return data

    def _catalog_url(
        self,
        media_type: str,
        catalog_id: str = "top",
        *,
        skip: int = 0,
        genre: str | None = None,
        search: str | None = None,
    ) -> str:
        kind = _cinemeta_type(media_type)
        extras: list[str] = []
        if search:
            extras.append(f"search={urllib.parse.quote(search)}")
        if genre:
            extras.append(f"genre={urllib.parse.quote(genre)}")
        if skip > 0:
            extras.append(f"skip={int(skip)}")
        base = f"{CINEMETA_API}/catalog/{kind}/{catalog_id}"
        if extras:
            return f"{base}/{'&'.join(extras)}.json"
        return f"{base}.json"

    def _meta_url(self, media_type: str, imdb_id: str) -> str:
        kind = _cinemeta_type(media_type)
        return f"{CINEMETA_API}/meta/{kind}/{imdb_id}.json"

    def _item_from_meta(
        self,
        row: dict,
        media_type: str | None = None,
        *,
        provider_name: str | None = None,
        provider_slug: str | None = None,
    ) -> dict | None:
        if not isinstance(row, dict):
            return None
        imdb_id = (row.get("imdb_id") or row.get("id") or "").strip()
        if not imdb_id.startswith("tt"):
            return None
        mt = media_type or _media_type_from_cinemeta(row.get("type"))
        tmdb_id = row.get("moviedb_id")
        try:
            tmdb_id = int(tmdb_id) if tmdb_id not in (None, "", 0, "0") else None
        except (TypeError, ValueError):
            tmdb_id = None
        # Stream resolvers require a numeric id; fall back to IMDb digits when needed.
        if not tmdb_id:
            digits = re.sub(r"\D", "", imdb_id)
            tmdb_id = int(digits) if digits else None
        if not tmdb_id:
            return None
        self._remember_ids(mt, tmdb_id, imdb_id)
        year = _parse_year(row.get("year") or row.get("releaseInfo") or row.get("released"))
        rating = None
        raw_rating = row.get("imdbRating") or row.get("rating")
        try:
            if raw_rating not in (None, ""):
                rating = float(raw_rating)
        except (TypeError, ValueError):
            rating = None
        genres = row.get("genres") or row.get("genre") or []
        if isinstance(genres, str):
            genres = [genres]
        genre_ids = [_genre_id(g) for g in genres if isinstance(g, str) and g in _GENRE_BY_ID]
        overview = (row.get("description") or row.get("overview") or "")[:280]
        return {
            "tmdb_id": tmdb_id,
            "imdb_id": imdb_id,
            "type": mt,
            "title": row.get("name") or row.get("title") or "",
            "year": year,
            "overview": overview,
            "poster_url": _poster_url(imdb_id, row.get("poster")),
            "rating": rating,
            "stars": _star_rating(rating),
            "vote_count": None,
            "genre_ids": genre_ids,
            "genres": [g for g in genres if isinstance(g, str)],
            "quality_tags": _quality_tags(year, mt),
            "provider_name": provider_name,
            "provider_slug": provider_slug,
        }

    def _fetch_catalog(
        self,
        media_type: str,
        catalog_id: str = "top",
        *,
        page: int = 1,
        genre: str | None = None,
        search: str | None = None,
        provider_name: str | None = None,
        provider_slug: str | None = None,
    ) -> dict:
        page = max(1, int(page or 1))
        skip = (page - 1) * PAGE_SIZE
        url = self._catalog_url(
            media_type, catalog_id, skip=skip, genre=genre, search=search
        )
        data = self._http_json(url)
        metas = (data or {}).get("metas") if isinstance(data, dict) else None
        items: list[dict] = []
        for row in metas or []:
            item = self._item_from_meta(
                row,
                media_type,
                provider_name=provider_name,
                provider_slug=provider_slug,
            )
            if item:
                items.append(item)
        has_more = len(items) >= PAGE_SIZE
        return {
            "items": items,
            "page": page,
            "total_pages": page + (1 if has_more else 0),
            "total_results": skip + len(items) + (PAGE_SIZE if has_more else 0),
            "has_more": has_more,
        }

    def providers(self) -> list[dict]:
        return [
            {
                "id": p["id"],
                "name": p["name"],
                "slug": p["slug"],
                "color": p.get("color"),
            }
            for p in STREAMING_PROVIDERS
        ]

    def genres(self, media_type: str = "movie") -> list[dict]:
        _ = media_type
        return [{"id": _genre_id(g), "name": g} for g in CINEMETA_GENRES]

    def sort_options(self) -> list[dict]:
        return list(SORT_OPTIONS)

    def home(self) -> dict:
        movies = self.trending("movie", page=1)[:12]
        tv = self.trending("tv", page=1)[:12]
        pop_m = self.popular("movie", page=1)[:12]
        pop_t = self.popular("tv", page=1)[:12]
        featured_m = self._fetch_catalog("movie", "imdbRating", page=1).get("items", [])[:12]
        featured_t = self._fetch_catalog("tv", "imdbRating", page=1).get("items", [])[:12]
        new_m = self._fetch_catalog("movie", "year", page=1).get("items", [])[:12]
        sections = [
            {
                "id": "trending_movies",
                "title": "Popular Movies",
                "items": movies,
                "see_all": {"tab": "movie", "sort": "popularity.desc"},
            },
            {
                "id": "trending_tv",
                "title": "Popular TV",
                "items": tv,
                "see_all": {"tab": "tv", "sort": "popularity.desc"},
            },
            {
                "id": "featured_movies",
                "title": "Top Rated Movies",
                "items": featured_m,
                "see_all": {"tab": "movie", "sort": "vote_average.desc"},
            },
            {
                "id": "featured_tv",
                "title": "Top Rated TV",
                "items": featured_t,
                "see_all": {"tab": "tv", "sort": "vote_average.desc"},
            },
            {
                "id": "new_movies",
                "title": "New Movies",
                "items": new_m,
                "see_all": {"tab": "movie", "sort": "release_date.desc"},
            },
            {
                "id": "popular_movies",
                "title": "More Movies",
                "items": pop_m,
                "see_all": {"tab": "movie", "sort": "popularity.desc"},
            },
            {
                "id": "popular_tv",
                "title": "More TV",
                "items": pop_t,
                "see_all": {"tab": "tv", "sort": "popularity.desc"},
            },
        ]
        return {
            "enabled": self.enabled,
            "metadata_source": "cinemeta",
            "providers": self.providers(),
            "sort_options": self.sort_options(),
            "sections": [s for s in sections if s.get("items")],
        }

    def trending(self, media_type: str = "movie", page: int = 1) -> list[dict]:
        return self._fetch_catalog(media_type, "top", page=page).get("items", [])

    def popular(self, media_type: str = "movie", page: int = 1) -> list[dict]:
        return self._fetch_catalog(media_type, "top", page=page).get("items", [])

    def by_provider(
        self,
        provider_id: int,
        media_type: str = "movie",
        page: int = 1,
    ) -> dict:
        meta = next((p for p in STREAMING_PROVIDERS if p["id"] == int(provider_id)), None)
        # Cinemeta has no watch-provider filter — return popular with provider label.
        return self.discover(
            media_type,
            page=page,
            provider_id=int(provider_id),
            provider_name=meta["name"] if meta else None,
            provider_slug=meta["slug"] if meta else None,
        )

    def discover(
        self,
        media_type: str = "movie",
        page: int = 1,
        *,
        provider_id: int | None = None,
        provider_name: str | None = None,
        provider_slug: str | None = None,
        genre_id: int | None = None,
        sort: str = "popularity.desc",
        year_min: int | None = None,
        year_max: int | None = None,
        rating_min: float | None = None,
        cast_id: int | None = None,
        crew_id: int | None = None,
    ) -> dict:
        _ = (year_min, year_max, rating_min, cast_id, crew_id, provider_id)
        if not provider_name and provider_id:
            meta = next((p for p in STREAMING_PROVIDERS if p["id"] == int(provider_id)), None)
            if meta:
                provider_name = meta["name"]
                provider_slug = meta["slug"]
        genre = _GENRE_BY_ID.get(int(genre_id)) if genre_id else None
        catalog_id = _sort_to_catalog(sort or "popularity.desc")
        result = self._fetch_catalog(
            media_type,
            catalog_id,
            page=page,
            genre=genre,
            provider_name=provider_name,
            provider_slug=provider_slug,
        )
        if sort == "release_date.asc":
            result["items"] = list(reversed(result.get("items") or []))
        return result

    def search(self, query: str, media_type: str = "multi", page: int = 1) -> dict:
        q = (query or "").strip()
        page = max(1, page)
        if not q:
            return {
                "items": [],
                "page": page,
                "total_pages": 0,
                "total_results": 0,
                "has_more": False,
            }
        mt = media_type if media_type in ("movie", "tv", "multi") else "multi"
        if mt == "multi":
            movies = self._fetch_catalog("movie", "top", page=page, search=q).get("items", [])
            shows = self._fetch_catalog("tv", "top", page=page, search=q).get("items", [])
            # Interleave for a mixed grid.
            out: list[dict] = []
            for a, b in zip(movies, shows):
                out.extend([a, b])
            if len(movies) > len(shows):
                out.extend(movies[len(shows) :])
            elif len(shows) > len(movies):
                out.extend(shows[len(movies) :])
            return {
                "items": out,
                "page": page,
                "total_pages": page,
                "total_results": len(out),
                "has_more": False,
            }
        return self._fetch_catalog(mt, "top", page=page, search=q)

    def _http_json_headers(self, url: str, headers: dict[str, str], timeout: float | None = None) -> dict | list | None:
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout or self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8", errors="replace"))
        except Exception:
            return None
        return data

    def _resolve_imdb_tmdb(self, media_type: str, tmdb_id: int) -> str | None:
        """Map TMDB id → IMDb via TMDB /external_ids (config/tmdb.env)."""
        token = (os.environ.get("TMDB_ACCESS_TOKEN") or "").strip()
        key = (os.environ.get("TMDB_API_KEY") or "").strip()
        if not token and not key:
            return None
        kind = "tv" if _media_type_from_cinemeta(media_type) == "tv" else "movie"
        url = f"{TMDB_API}/{kind}/{int(tmdb_id)}/external_ids"
        headers = {"User-Agent": UA, "Accept": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        else:
            url += "?" + urllib.parse.urlencode({"api_key": key})
        data = self._http_json_headers(
            url, headers, timeout=max(8.0, float(self.timeout or 12))
        )
        if not isinstance(data, dict):
            return None
        imdb = str(data.get("imdb_id") or "").strip()
        return imdb if imdb.startswith("tt") else None

    def _resolve_imdb_wikidata(self, media_type: str, tmdb_id: int) -> str | None:
        """Map TMDB id → IMDb via Wikidata (Cinemeta catalogs often miss older titles)."""
        prop = "P4947" if _media_type_from_cinemeta(media_type) == "movie" else "P4983"
        query = (
            "SELECT ?imdb WHERE {"
            f' ?f wdt:{prop} "{int(tmdb_id)}" .'
            " ?f wdt:P345 ?imdb ."
            " } LIMIT 1"
        )
        url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode(
            {"query": query, "format": "json"}
        )
        # WDQS rate-limits generic bot UAs (HTTP 429); use a browser-like agent.
        data = self._http_json_headers(
            url,
            {
                "User-Agent": (
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 StepDaddyLiveHD/1.0"
                ),
                "Accept": "application/sparql-results+json, application/json",
            },
            timeout=max(12.0, float(self.timeout or 12)),
        )
        if not isinstance(data, dict):
            return None
        bindings = ((data.get("results") or {}).get("bindings")) or []
        if not bindings:
            return None
        imdb = str(((bindings[0].get("imdb") or {}).get("value")) or "").strip()
        if imdb.startswith("tt"):
            return imdb
        return None

    def _tmdb_page_title(self, media_type: str, tmdb_id: int) -> tuple[str | None, int | None]:
        kind = "movie" if _media_type_from_cinemeta(media_type) == "movie" else "tv"
        url = f"https://www.themoviedb.org/{kind}/{int(tmdb_id)}"
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=max(12.0, float(self.timeout or 12))) as resp:
                html = resp.read().decode("utf-8", errors="replace")
        except Exception:
            return None, None
        m = re.search(r"<title>([^<]+)</title>", html, re.I)
        if not m:
            return None, None
        title_raw = (
            m.group(1)
            .replace("&#8212;", "—")
            .replace("&mdash;", "—")
            .replace("&amp;", "&")
            .strip()
        )
        # "War (2007) — The Movie Database (TMDB)"
        title_raw = re.sub(r"\s*[—\-]\s*The Movie Database.*$", "", title_raw, flags=re.I).strip()
        ym = re.search(r"\((\d{4})\)\s*$", title_raw)
        year = int(ym.group(1)) if ym else None
        name = re.sub(r"\s*\(\d{4}\)\s*$", "", title_raw).strip() if title_raw else None
        return (name or None), year

    def _resolve_imdb_cinemeta_search(self, media_type: str, tmdb_id: int) -> str | None:
        name, year = self._tmdb_page_title(media_type, int(tmdb_id))
        if not name:
            return None
        q = name if not year else f"{name} ({year})"
        items = self._fetch_catalog(media_type, "top", page=1, search=q).get("items", [])
        # Prefer exact year+name; verify moviedb_id via Cinemeta meta when needed.
        candidates = []
        for it in items[:12]:
            imdb = (it.get("imdb_id") or "").strip()
            if not imdb.startswith("tt"):
                continue
            if year and it.get("year") and int(it.get("year") or 0) != int(year):
                continue
            candidates.append(imdb)
        for imdb in candidates:
            data = self._http_json(self._meta_url(media_type, imdb))
            if not isinstance(data, dict):
                continue
            meta = data.get("meta") if isinstance(data.get("meta"), dict) else data
            if not isinstance(meta, dict):
                continue
            mdb = meta.get("moviedb_id")
            try:
                if mdb is not None and int(mdb) == int(tmdb_id):
                    return imdb
            except Exception:
                pass
            # First year+name hit if Cinemeta omitted moviedb_id
            if candidates and imdb == candidates[0] and not mdb:
                return imdb
        return candidates[0] if len(candidates) == 1 else None

    def _resolve_imdb(
        self, media_type: str, tmdb_id: int, imdb_hint: str | None = None
    ) -> str | None:
        hint = (imdb_hint or "").strip()
        if hint.startswith("tt"):
            self._remember_ids(media_type, tmdb_id, hint)
            return hint
        key = f"{_media_type_from_cinemeta(media_type)}:{int(tmdb_id)}"
        cached = self._id_map.get(key)
        if cached:
            return cached
        # Fast path for deep links (catalog warm rarely contains older TMDB ids).
        # TMDB API first (reliable with tmdb.env); then Wikidata / Cinemeta search.
        for resolver in (
            self._resolve_imdb_tmdb,
            self._resolve_imdb_wikidata,
            self._resolve_imdb_cinemeta_search,
        ):
            try:
                found = resolver(media_type, int(tmdb_id))
            except Exception:
                found = None
            if found:
                self._remember_ids(media_type, int(tmdb_id), found)
                return found
        # Warm map from popular catalogs once, then retry.
        for catalog_id in ("top", "imdbRating", "year"):
            for page in (1, 2):
                for item in self._fetch_catalog(media_type, catalog_id, page=page).get(
                    "items", []
                ):
                    if int(item.get("tmdb_id") or 0) == int(tmdb_id) and item.get("imdb_id"):
                        return item["imdb_id"]
            cached = self._id_map.get(key)
            if cached:
                return cached
        return None

    def _detail_from_imdb(self, media_type: str, imdb_id: str, tmdb_id: int | None = None) -> dict | None:
        data = self._http_json(self._meta_url(media_type, imdb_id))
        if not isinstance(data, dict):
            return None
        meta = data.get("meta") if isinstance(data.get("meta"), dict) else data
        if not isinstance(meta, dict):
            return None
        base = self._item_from_meta(meta, media_type)
        if not base:
            return None
        if tmdb_id:
            base["tmdb_id"] = int(tmdb_id)
            self._remember_ids(media_type, int(tmdb_id), imdb_id)
        rating = base.get("rating")
        trailer = None
        for t in meta.get("trailers") or meta.get("trailerStreams") or []:
            if isinstance(t, dict):
                trailer = t.get("source") or t.get("ytId")
                if trailer:
                    break
        cast = []
        for i, name in enumerate(meta.get("cast") or []):
            if not isinstance(name, str) or not name.strip():
                continue
            cast.append(
                {"id": i + 1, "name": name.strip(), "character": "", "profile_url": None}
            )
            if len(cast) >= 12:
                break
        crew = []
        for name in meta.get("director") or []:
            if isinstance(name, str) and name.strip():
                crew.append(
                    {
                        "id": len(crew) + 1,
                        "name": name.strip(),
                        "job": "Director",
                        "profile_url": None,
                    }
                )
        genres = base.get("genres") or []
        related = []
        if genres:
            more = self._fetch_catalog(
                media_type, "top", page=1, genre=genres[0]
            ).get("items", [])
            related_items = [
                it for it in more if it.get("tmdb_id") != base.get("tmdb_id")
            ][:12]
            if related_items:
                related.append(
                    {
                        "id": f"genre_{_genre_id(genres[0])}",
                        "title": f"More {genres[0]}",
                        "items": related_items,
                        "see_all": {
                            "tab": "tv" if media_type == "tv" else "movie",
                            "sort": "popularity.desc",
                            "genre": str(_genre_id(genres[0])),
                        },
                    }
                )
        detail = {
            **base,
            "tagline": "",
            "overview": meta.get("description") or base.get("overview") or "",
            "poster_url": _poster_url(imdb_id, meta.get("poster")),
            "backdrop_url": _backdrop_url(imdb_id, meta.get("background")),
            "runtime_minutes": _runtime_minutes(meta.get("runtime")),
            "status": None,
            "original_language": None,
            "certification": None,
            "imdb_url": f"https://www.imdb.com/title/{imdb_id}/",
            "production_companies": [],
            "keywords": [],
            "cast": cast,
            "crew": crew,
            "trailer_youtube": trailer,
            "providers": [],
            "related_sections": related,
            "metadata_source": "cinemeta",
        }
        if media_type == "movie":
            detail.update(
                {
                    "budget": None,
                    "budget_formatted": None,
                    "revenue": None,
                    "revenue_formatted": None,
                    "collection": None,
                }
            )
        else:
            videos = meta.get("videos") or []
            seasons_map: dict[int, dict] = {}
            for v in videos:
                if not isinstance(v, dict):
                    continue
                sn = v.get("season")
                if sn is None or int(sn) < 0:
                    continue
                sn = int(sn)
                row = seasons_map.setdefault(
                    sn,
                    {
                        "season": sn,
                        "name": "Specials" if sn == 0 else f"Season {sn}",
                        "episodes": 0,
                        "poster_url": None,
                    },
                )
                row["episodes"] += 1
            seasons = sorted(seasons_map.values(), key=lambda s: s["season"])
            latest = _latest_aired_from_videos(videos)
            detail.update(
                {
                    "number_of_seasons": len([s for s in seasons if s["season"] >= 1]),
                    "number_of_episodes": sum(s["episodes"] for s in seasons if s["season"] >= 1),
                    "episode_runtime": _runtime_minutes(meta.get("runtime")),
                    "networks": [],
                    "seasons": seasons,
                    "latest_aired": latest,
                    "_videos": videos,
                }
            )
        return detail

    def movie_detail(self, tmdb_id: int, imdb_id: str | None = None) -> dict | None:
        imdb = self._resolve_imdb("movie", int(tmdb_id), imdb_id)
        if not imdb:
            return None
        return self._detail_from_imdb("movie", imdb, int(tmdb_id))

    def tv_detail(self, tmdb_id: int, imdb_id: str | None = None) -> dict | None:
        imdb = self._resolve_imdb("tv", int(tmdb_id), imdb_id)
        if not imdb:
            return None
        detail = self._detail_from_imdb("tv", imdb, int(tmdb_id))
        if detail:
            detail.pop("_videos", None)
        return detail

    def tv_episodes(self, tmdb_id: int, season: int, imdb_id: str | None = None) -> list[dict]:
        imdb = self._resolve_imdb("tv", int(tmdb_id), imdb_id)
        if not imdb:
            return []
        detail = self._detail_from_imdb("tv", imdb, int(tmdb_id))
        if not detail:
            return []
        videos = detail.pop("_videos", None) or []
        # Re-fetch raw meta videos if stripped
        if not videos:
            data = self._http_json(self._meta_url("tv", imdb))
            meta = (data or {}).get("meta") if isinstance(data, dict) else None
            videos = (meta or {}).get("videos") or []
        out = []
        for ep in videos:
            if not isinstance(ep, dict):
                continue
            if int(ep.get("season") or -1) != int(season):
                continue
            num = ep.get("episode") if ep.get("episode") is not None else ep.get("number")
            rating = None
            try:
                if ep.get("rating") not in (None, ""):
                    rating = float(ep.get("rating"))
            except (TypeError, ValueError):
                rating = None
            out.append(
                {
                    "episode": num,
                    "season": int(season),
                    "title": ep.get("name") or ep.get("title") or f"Episode {num}",
                    "overview": (ep.get("overview") or ep.get("description") or "")[:200],
                    "still_url": ep.get("thumbnail"),
                    "runtime_minutes": None,
                    "rating": rating,
                    "stars": _star_rating(rating),
                    "air_date": _episode_air_date(ep),
                    "aired": _episode_has_aired(ep),
                }
            )
        out.sort(key=lambda e: int(e.get("episode") or 0))
        return out
