"""Channel multi-facet taxonomy: genre / distributor / country / language.

Normalizes raw catalog signals (tags, group_title, source, provider, name)
into canonical facet ids used by the Channel API and guide drawer.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable, Mapping

log = logging.getLogger("supplements.taxonomy")

_REPO_ROOT = Path(__file__).resolve().parents[2]
_TAXONOMY_DIR = _REPO_ROOT / "data" / "taxonomy"

_SOURCE_DISTRIBUTOR = {
    "ddl": "daddylive",
    "daddylive": "daddylive",
    "freetv": "freetv",
    "iptv": "iptv_org",
    "dulo": "dulo",
    "ntv": "ntv",
    "adultswim": "adultswim",
}

_PROVIDER_DISTRIBUTOR = {
    "daddylive": "daddylive",
    "daddy live": "daddylive",
    "free-tv": "freetv",
    "freetv": "freetv",
    "iptv-org": "iptv_org",
    "dulo": "dulo",
    "falcon": "ntv",
    "cdn": "ntv",
    "adult swim": "adultswim",
}

_PLATFORM_STEMS = frozenset(
    {
        "pluto",
        "plex",
        "roku",
        "samsung",
        "tubi",
        "xumo",
        "tcl",
        "vizio",
        "firetv",
        "stirr",
        "rakuten",
        "sofast",
        "bbc",
    }
)

_MEGA_GROUP_RE = re.compile(
    r"^(?:📡\s*\|\s*)?extra\s*\|\s*|^\s*24/7\s*$",
    re.I,
)

_COUNTRY_FROM_COUNTRY = {
    "US": "en",
    "UK": "en",
    "CA": "en",
    "AU": "en",
    "IE": "en",
    "MX": "es",
    "ES": "es",
    "FR": "fr",
    "DE": "de",
    "IT": "it",
    "PT": "pt",
    "BR": "pt",
    "NL": "nl",
    "JP": "ja",
    "IN": "hi",
    "LATAM": "es",
}

_NAME_COUNTRY_RE = re.compile(
    r"(?:^|[\s\|\-\(/])(USA|UK|US|CA|AU|MX|ES|PT|LAT|MEX)(?:$|[\s\|\-\)/])",
    re.I,
)

_GENRE_PRIORITY = (
    "sports",
    "news",
    "movies",
    "kids",
    "documentary",
    "animation",
    "music",
    "lifestyle",
    "religious",
    "shopping",
    "education",
    "weather",
    "entertainment",
    "general",
)


@dataclass
class ChannelTaxonomy:
    genre: str | None = None
    genres: list[str] = field(default_factory=list)
    distributor: str | None = None
    country: str | None = None
    language: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "genre": self.genre,
            "genres": list(self.genres),
            "distributor": self.distributor,
            "country": self.country,
            "language": self.language,
        }


def _load_json(name: str) -> dict[str, Any]:
    path = _TAXONOMY_DIR / name
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception as exc:
        log.warning("taxonomy load failed %s: %s", path, exc)
        return {}


@lru_cache(maxsize=1)
def _maps() -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    return (
        _load_json("genre_aliases.json"),
        _load_json("distributor_aliases.json"),
        _load_json("country_aliases.json"),
        _load_json("language_aliases.json"),
        _load_json("labels.json"),
    )


def reload_maps() -> None:
    _maps.cache_clear()


def _alias_lookup(table: Mapping[str, Any], raw: str | None) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    if s in table:
        val = table[s]
        return None if val is None else str(val)
    low = s.lower()
    if low in table:
        val = table[low]
        return None if val is None else str(val)
    stripped = low.lstrip("#@").replace("_", " ").strip()
    if stripped in table:
        val = table[stripped]
        return None if val is None else str(val)
    compact = stripped.replace(" ", "").replace("-", "")
    if compact in table:
        val = table[compact]
        return None if val is None else str(val)
    # underscore form (us_pluto)
    uscore = low.lstrip("#@")
    if uscore in table:
        val = table[uscore]
        return None if val is None else str(val)
    return None


def label_for(facet: str, canonical: str | None) -> str:
    if not canonical:
        return ""
    _, _, _, _, labels = _maps()
    bucket = labels.get(facet) if isinstance(labels, dict) else None
    if isinstance(bucket, dict) and canonical in bucket:
        return str(bucket[canonical])
    if facet == "country":
        return str(canonical)
    return str(canonical).replace("_", " ").title()


def migrate_guide_category_key(key: str | None) -> str:
    """Map legacy group:/tag: drawer keys onto facet keys (or all)."""
    k = (key or "all").strip() or "all"
    if k in ("all", "favorites", "recent"):
        return k
    if k.startswith(("genre:", "distributor:", "country:", "language:")):
        return k
    genre_map, dist_map, country_map, lang_map, _ = _maps()
    if k.startswith("tag:"):
        raw = k[4:]
        g = _alias_lookup(genre_map, raw)
        if g:
            return f"genre:{g}"
        d = _alias_lookup(dist_map, raw)
        if d:
            return f"distributor:{d}"
        c = _alias_lookup(country_map, raw)
        if c:
            return f"country:{c}"
        return "all"
    if k.startswith("group:"):
        raw = k[6:].strip()
        # Prefer platform / country from iptv-org | us_pluto style
        low = raw.lower()
        if "|" in low:
            stem = low.split("|", 1)[1].strip()
        else:
            stem = low
        stem = stem.replace("iptv-org", "").strip(" |_")
        for part in reversed(stem.split("_")):
            d = _alias_lookup(dist_map, part)
            if d and d != "iptv_org":
                return f"distributor:{d}"
        for part in stem.split("_"):
            c = _alias_lookup(country_map, part)
            if c:
                return f"country:{c}"
        g = _alias_lookup(genre_map, raw) or _alias_lookup(genre_map, stem)
        if g:
            return f"genre:{g}"
        d = _alias_lookup(dist_map, raw) or _alias_lookup(dist_map, stem)
        if d:
            return f"distributor:{d}"
        c = _alias_lookup(country_map, raw) or _alias_lookup(country_map, stem)
        if c:
            return f"country:{c}"
        if _MEGA_GROUP_RE.search(raw) or "dulo" in low:
            return "distributor:dulo" if "dulo" in low else "all"
        if "free-tv" in low or "freetv" in low:
            return "distributor:freetv"
        return "all"
    # bare legacy values
    g = _alias_lookup(genre_map, k)
    if g:
        return f"genre:{g}"
    return "all"


def _iter_tokens(
    tags: Iterable[Any] | None,
    group_title: str | None,
    source: str | None,
    provider: str | None,
    name: str | None,
    tvg_id: str | None,
) -> list[str]:
    out: list[str] = []
    for raw in tags or []:
        t = str(raw).strip()
        if t:
            out.append(t)
    gt = (group_title or "").strip()
    if gt:
        out.append(gt)
        if "|" in gt:
            left, right = gt.split("|", 1)
            out.append(left.strip())
            out.append(right.strip())
            for part in right.strip().replace("-", "_").split("_"):
                if part:
                    out.append(part)
        else:
            for part in re.split(r"[\s|/]+", gt):
                if part:
                    out.append(part)
    if source:
        out.append(str(source))
    if provider:
        out.append(str(provider))
    if name:
        m = _NAME_COUNTRY_RE.search(name)
        if m:
            out.append(m.group(1))
    if tvg_id:
        tid = str(tvg_id).strip()
        out.append(tid)
        m = re.search(r"\.([a-z]{2,3})\d*(?:@|$)", tid, re.I)
        if m:
            out.append(m.group(1))
        if "@" in tid:
            out.append(tid.rsplit("@", 1)[-1])
    return out


def _pick_genres(tokens: list[str], genre_map: Mapping[str, Any]) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for tok in tokens:
        g = _alias_lookup(genre_map, tok)
        if not g or g in seen:
            continue
        # Skip pure mega-bucket leftovers
        if g == "general" and tok.lower().lstrip("#") in ("live", "24/7"):
            continue
        seen.add(g)
        found.append(g)
    # Stable priority order for primary
    ranked = [g for g in _GENRE_PRIORITY if g in seen]
    extras = [g for g in found if g not in ranked]
    return ranked + extras


def _pick_distributor(
    tokens: list[str],
    dist_map: Mapping[str, Any],
    source: str | None,
    provider: str | None,
    group_title: str | None,
) -> str | None:
    # Explicit platform tags win over generic iptv_org
    for tok in tokens:
        d = _alias_lookup(dist_map, tok)
        if d and d != "iptv_org":
            # Prefer real platforms from stem tokens
            low = str(tok).lower().lstrip("#")
            if low in _PLATFORM_STEMS or d in _PLATFORM_STEMS or d in (
                "pluto",
                "samsung",
                "tubi",
                "xumo",
                "roku",
                "plex",
                "dulo",
                "ntv",
                "freetv",
                "daddylive",
                "adultswim",
                "stirr",
                "rakuten",
                "bbc",
                "firetv",
            ):
                return d
    gt = (group_title or "").lower()
    if "|" in gt:
        stem = gt.split("|", 1)[1].strip().replace("-", "_")
        for part in reversed(stem.split("_")):
            d = _alias_lookup(dist_map, part)
            if d and d != "iptv_org":
                return d
    if provider:
        d = _alias_lookup(dist_map, provider) or _PROVIDER_DISTRIBUTOR.get(provider.strip().lower())
        if d:
            return d
    if source:
        d = _SOURCE_DISTRIBUTOR.get(str(source).strip().lower())
        if d:
            return d
        d = _alias_lookup(dist_map, source)
        if d:
            return d
    for tok in tokens:
        d = _alias_lookup(dist_map, tok)
        if d:
            return d
    return None


def _pick_country(tokens: list[str], country_map: Mapping[str, Any]) -> str | None:
    for tok in tokens:
        c = _alias_lookup(country_map, tok)
        if c:
            return c
    return None


def _pick_language(
    tokens: list[str],
    lang_map: Mapping[str, Any],
    country: str | None,
) -> str | None:
    for tok in tokens:
        # Avoid treating country codes ES/DE as languages when they came from region tags —
        # only accept explicit language-ish tokens (#en, english, …) or bare 2-letter when
        # not already used as the country code itself.
        low = str(tok).lower().lstrip("#@")
        if low in ("us", "uk", "gb", "ca", "au", "mx", "ie", "br", "jp", "in", "lat", "latam"):
            continue
        lang = _alias_lookup(lang_map, tok)
        if lang:
            # If token is a 2-letter country that equals selected country, skip (ES→es conflict)
            if country and low.upper() == country and low in ("es", "fr", "de", "it", "pt", "nl"):
                # still allow if original had #lang prefix style — tags like #es on Spanish
                # channels are country; leave language to country inference.
                continue
            return lang
    if country:
        return _COUNTRY_FROM_COUNTRY.get(country)
    return None


def normalize_channel_taxonomy(
    *,
    name: str | None = None,
    tags: Iterable[Any] | None = None,
    group_title: str | None = None,
    source: str | None = None,
    provider: str | None = None,
    tvg_id: str | None = None,
) -> ChannelTaxonomy:
    genre_map, dist_map, country_map, lang_map, _ = _maps()
    tokens = _iter_tokens(tags, group_title, source, provider, name, tvg_id)
    genres = _pick_genres(tokens, genre_map)
    primary = genres[0] if genres else "general"
    if primary not in genres:
        genres = [primary] + genres
    distributor = _pick_distributor(tokens, dist_map, source, provider, group_title)
    country = _pick_country(tokens, country_map)
    language = _pick_language(tokens, lang_map, country)
    return ChannelTaxonomy(
        genre=primary,
        genres=genres,
        distributor=distributor,
        country=country,
        language=language,
    )


def genre_group_title(tax: ChannelTaxonomy) -> str | None:
    """Backward-compat group_title: normalized primary genre label."""
    if not tax.genre:
        return None
    return label_for("genre", tax.genre) or tax.genre.title()
