"""Free title metadata for EPG programmes (TVmaze + Cinemeta/Metahub; optional TMDB).

Loads recovered bytecode for the original service, then patches in Cinemeta
catalog search so movie posters work without a TMDB API key (Pluto/WOFTV films).
"""
from __future__ import annotations

import json
import marshal
import re
import urllib.parse
import urllib.request
from pathlib import Path

_PYC = Path(__file__).resolve().parent / "__pycache__" / "title_metadata.recovered.pyc"
if not _PYC.is_file():
    _PYC = Path(__file__).resolve().parent / "__pycache__" / "title_metadata.cpython-312.pyc"
if not _PYC.is_file():
    raise ImportError(
        f"Missing recovered title_metadata bytecode under {Path(__file__).parent / '__pycache__'}"
    )

exec(marshal.loads(_PYC.read_bytes()[16:]), globals())

_UA = "Mozilla/5.0 (X11; Linux x86_64) StepDaddy-Gateway/1.0 (+title-meta)"
_ORIG_LOOKUP = TitleMetadataService.lookup_programme  # type: ignore[name-defined]
_ORIG_FROM_EPG = TitleMetadataService.lookup_from_epg_programme  # type: ignore[name-defined]


def _norm_match(s: str) -> str:
    s = html.unescape(s or "")  # type: ignore[name-defined]
    s = s.lower()
    s = re.sub(r"[''`]", "", s)
    s = s.replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _title_queries(title: str) -> list[str]:
    """Generate search variants for EPG titles like \"Cheech & Chong's Still Smokin\"."""
    clean = (title or "").strip()
    if not clean:
        return []
    out: list[str] = []
    seen: set[str] = set()

    def add(q: str) -> None:
        q = re.sub(r"\s+", " ", (q or "").strip())
        if not q or q.lower() in seen:
            return
        seen.add(q.lower())
        out.append(q)

    add(clean)
    # Drop leading franchise / possessive prefixes.
    stripped = re.sub(
        r"^(?:cheech\s*(?:&|and)\s*chong'?s?\s+|harry\s+potter\s+and\s+the\s+)",
        "",
        clean,
        flags=re.I,
    )
    add(stripped)
    # Drop trailing year / (1983)
    add(re.sub(r"\s*[\(\[]?\d{4}[\)\]]?\s*$", "", clean).strip())
    # After colon / dash
    for part in re.split(r"\s*[:\-–—]\s*", clean):
        if len(part) >= 4:
            add(part)
    return out


def _score_meta(query: str, name: str, year: int | None, candidate_year: int | None) -> float:
    qn = _norm_match(query)
    nn = _norm_match(name)
    if not qn or not nn:
        return 0.0
    score = 0.0
    if qn == nn:
        score = 100.0
    elif nn.startswith(qn) or qn.startswith(nn):
        score = 82.0
    elif qn in nn or nn in qn:
        score = 70.0
    else:
        qt, nt = set(qn.split()), set(nn.split())
        if not qt or not nt:
            return 0.0
        overlap = len(qt & nt) / max(len(qt), len(nt))
        if overlap < 0.5:
            return 0.0
        score = 45.0 + 40.0 * overlap
    if year and candidate_year:
        if year == candidate_year:
            score += 12.0
        elif abs(year - candidate_year) <= 1:
            score += 4.0
        else:
            score -= 8.0
    return score


def _parse_year(raw) -> int | None:
    if raw is None:
        return None
    m = re.search(r"(19|20)\d{2}", str(raw))
    return int(m.group(0)) if m else None


def _cinemeta_search(self, title: str, kind: str, year: int | None):
    """Search Cinemeta catalog by title; return TitleMeta-like dict or None."""
    # Recovered module sets CINEMETA_API to .../meta (detail endpoint). Catalog is at host root.
    raw_api = str(globals().get("CINEMETA_API") or "https://v3-cinemeta.strem.io").rstrip("/")
    api = re.sub(r"/meta/?$", "", raw_api).rstrip("/") or "https://v3-cinemeta.strem.io"
    poster_base = str(
        globals().get("METAHUB_POSTER_BASE") or "https://images.metahub.space/poster/large"
    ).rstrip("/")
    kinds = []
    if kind == "movie":
        kinds = ["movie", "series"]
    elif kind == "series":
        kinds = ["series", "movie"]
    else:
        kinds = ["movie", "series"]

    best = None
    best_score = 0.0
    for query in _title_queries(title):
        for k in kinds:
            url = f"{api}/catalog/{k}/top/search={urllib.parse.quote(query)}.json"
            try:
                req = urllib.request.Request(
                    url, headers={"User-Agent": _UA, "Accept": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=8) as resp:
                    data = json.loads(resp.read().decode("utf-8", errors="replace"))
            except Exception:
                continue
            metas = data.get("metas") if isinstance(data, dict) else None
            if not isinstance(metas, list):
                continue
            for row in metas[:12]:
                if not isinstance(row, dict):
                    continue
                name = str(row.get("name") or row.get("title") or "").strip()
                imdb = str(row.get("id") or row.get("imdb_id") or "").strip()
                if not name or not imdb.startswith("tt"):
                    continue
                cy = _parse_year(row.get("releaseInfo") or row.get("year") or row.get("released"))
                score = _score_meta(query, name, year, cy)
                # Prefer exact-ish matches for the original EPG title too.
                score = max(score, _score_meta(title, name, year, cy) * 0.95)
                if score < 68.0:
                    continue
                poster = str(row.get("poster") or "").strip() or None
                if not poster:
                    poster = f"{poster_base}/{imdb}/img"
                cand = {
                    "title": title,
                    "matched_title": name,
                    "overview": str(row.get("description") or "")[:600],
                    "poster_url": poster,
                    "backdrop_url": None,
                    "rating": None,
                    "rating_source": "imdb",
                    "year": cy,
                    "imdb_id": imdb,
                    "tmdb_id": None,
                    "genres": list(row.get("genres") or row.get("genre") or [])[:8]
                    if isinstance(row.get("genres") or row.get("genre"), list)
                    else [],
                    "cast": [],
                    "source": f"cinemeta-search:{k}",
                    "cast_members": [],
                    "trailer_youtube": None,
                    "runtime_minutes": None,
                    "imdb_url": f"https://www.imdb.com/title/{imdb}",
                    "seasons": None,
                    "_score": score,
                    "_kind": k,
                }
                try:
                    raw_rating = row.get("imdbRating") or row.get("rating")
                    if raw_rating not in (None, ""):
                        cand["rating"] = float(raw_rating)
                except (TypeError, ValueError):
                    pass
                if score > best_score:
                    best_score = score
                    best = cand
            if best_score >= 95.0:
                break
        if best_score >= 95.0:
            break

    if not best:
        return None
    # Enrich via existing Metahub/Cinemeta meta endpoint when possible.
    try:
        cm = self._fetch_cinemeta(best["_kind"], best["imdb_id"])
        if cm:
            d = cm.to_dict() if hasattr(cm, "to_dict") else dict(cm)
            if d.get("poster_url"):
                best["poster_url"] = d["poster_url"]
            if d.get("backdrop_url"):
                best["backdrop_url"] = d["backdrop_url"]
            if d.get("overview") and len(str(d["overview"])) > len(best.get("overview") or ""):
                best["overview"] = d["overview"]
            if d.get("genres"):
                best["genres"] = d["genres"]
            if d.get("cast"):
                best["cast"] = d["cast"]
            if d.get("rating") is not None:
                best["rating"] = d["rating"]
                best["rating_source"] = d.get("rating_source") or "imdb"
            best["source"] = (d.get("source") or "cinemeta") + "+search"
    except Exception:
        pass
    best.pop("_score", None)
    best.pop("_kind", None)
    return best


def _has_poster(meta) -> bool:
    if not meta:
        return False
    if isinstance(meta, dict):
        return bool(str(meta.get("poster_url") or "").strip())
    return bool(getattr(meta, "poster_url", None))


def _as_dict(meta):
    if meta is None:
        return None
    if isinstance(meta, dict):
        return meta
    if hasattr(meta, "to_dict"):
        return meta.to_dict()
    return None


def _lookup_programme_with_cinemeta(
    self,
    title: str,
    programme_type: str = "other",
    year: int | None = None,
    season: int | None = None,
    episode: int | None = None,
    subtitle: str | None = None,
):
    meta = _ORIG_LOOKUP(
        self,
        title=title,
        programme_type=programme_type,
        year=year,
        season=season,
        episode=episode,
        subtitle=subtitle,
    )
    d = _as_dict(meta)
    if _has_poster(d):
        return d

    kind = (programme_type or "other").strip().lower() or "other"
    # Film channels / Pluto often arrive as category "Pluto TV" → programme_type other.
    if kind in ("film", "films", "movies", "movie"):
        kind = "movie"
    elif kind in ("show", "shows", "tv", "series"):
        kind = "series"
    elif kind not in ("movie", "series"):
        # Prefer movie search for untitled EPG films (no season/episode).
        kind = "series" if (season or episode) else "movie"

    searched = _cinemeta_search(self, title, kind, year)
    if searched and searched.get("poster_url"):
        # Cache via original setter if available.
        try:
            clean = self._norm_title(title)
            key = self._cache_key(clean, kind, year, season, episode)
            self._set_cached(key, searched)
        except Exception:
            pass
        return searched

    # Keep stub / partial meta from original lookup.
    return d


def _lookup_from_epg_with_poster(self, prog: dict | None):
    """Prefer EPG-provided poster/backdrop (Pluto), then title lookup."""
    if not prog or not isinstance(prog, dict):
        return _ORIG_FROM_EPG(self, prog)

    epg_poster = str(prog.get("poster_url") or prog.get("image") or "").strip() or None
    epg_backdrop = str(prog.get("backdrop_url") or "").strip() or None
    title = str(prog.get("title") or "").strip()
    meta = None
    if title:
        year = prog.get("year")
        try:
            year = int(year) if year not in (None, "") else None
        except (TypeError, ValueError):
            year = None
        season = prog.get("season")
        episode = prog.get("episode")
        try:
            season = int(season) if season not in (None, "") else None
        except (TypeError, ValueError):
            season = None
        try:
            episode = int(episode) if episode not in (None, "") else None
        except (TypeError, ValueError):
            episode = None
        meta = _lookup_programme_with_cinemeta(
            self,
            title=title,
            programme_type=str(
                prog.get("programme_type") or prog.get("category") or "other"
            ),
            year=year,
            season=season,
            episode=episode,
            subtitle=str(prog.get("subtitle") or "") or None,
        )

    d = _as_dict(meta) or {
        "title": title,
        "matched_title": title,
        "poster_url": None,
        "source": "epg",
        "cast_members": [],
    }
    src = str(d.get("source") or "").strip()
    if epg_poster and not d.get("poster_url"):
        d["poster_url"] = epg_poster
        d["source"] = "pluto" if src in ("", "none") else f"{src}+pluto"
    if epg_backdrop and not d.get("backdrop_url"):
        d["backdrop_url"] = epg_backdrop
    return d


TitleMetadataService.lookup_programme = _lookup_programme_with_cinemeta  # type: ignore[name-defined,misc]
TitleMetadataService.lookup_from_epg_programme = _lookup_from_epg_with_poster  # type: ignore[name-defined,misc]
TitleMetadataService._search_cinemeta_by_title = _cinemeta_search  # type: ignore[name-defined,misc]
