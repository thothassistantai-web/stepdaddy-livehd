"""Shared season/episode parsing for lite EPG sources (epg.pw, Pluto, WOFTV).

Normalizes to episode_label form ``S1E1`` (no zero-pad, no space).
"""

from __future__ import annotations

import re
from typing import Any

_SEASON_EPISODE_PATTERNS = (
    re.compile(r"\b[Ss](\d{1,2})\s*[Ee](?:p(?:isode)?)?\s*(\d{1,3})\b"),
    re.compile(r"\b(\d{1,2})\s*[xX]\s*(\d{1,3})\b"),
    re.compile(r"\bSeason\s+(\d{1,2})\s*[,:]?\s*Episode\s+(\d{1,3})\b", re.I),
    re.compile(r"\bSeason\s+(\d{1,2})\s+Ep(?:isode)?\.?\s*(\d{1,3})\b", re.I),
    # XMLTV onscreen / compact: "S1 E2"
    re.compile(r"\b[Ss](\d{1,2})\s+E(?:p(?:isode)?)?\s*(\d{1,3})\b"),
)
# Bare "1/2" is only safe as a *whole* episode-num token — never inside prose
# (e.g. "9/11 attacks" must not become S9E11).
_SLASH_EPISODE_ONLY = re.compile(r"^\s*(\d{1,2})\s*/\s*(\d{1,3})\s*$")


def format_episode_label(season: int | None, episode: int | None) -> str:
    if season is None or episode is None:
        return ""
    try:
        s = int(season)
        e = int(episode)
    except (TypeError, ValueError):
        return ""
    if s < 0 or e < 0:
        return ""
    return f"S{s}E{e}"


def coerce_episode_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, float):
        if value != value:  # NaN
            return None
        value = int(value)
    try:
        n = int(str(value).strip())
    except (TypeError, ValueError):
        return None
    if n < 0 or n > 9999:
        return None
    return n


def parse_episode_num_text(text: str) -> dict[str, Any]:
    """Parse an episode-num / free-text fragment → season, episode, episode_label."""
    raw = (text or "").strip()
    out: dict[str, Any] = {"season": None, "episode": None, "episode_label": ""}
    if not raw:
        return out
    m_slash = _SLASH_EPISODE_ONLY.match(raw)
    if m_slash:
        season = coerce_episode_int(m_slash.group(1))
        episode = coerce_episode_int(m_slash.group(2))
        label = format_episode_label(season, episode)
        if label:
            out["season"] = season
            out["episode"] = episode
            out["episode_label"] = label
            return out
    for pat in _SEASON_EPISODE_PATTERNS:
        m = pat.search(raw)
        if not m:
            continue
        season = coerce_episode_int(m.group(1))
        episode = coerce_episode_int(m.group(2))
        label = format_episode_label(season, episode)
        if label:
            out["season"] = season
            out["episode"] = episode
            out["episode_label"] = label
            return out
    # Keep non-matching XMLTV episode-num text as opaque label only when short.
    if len(raw) <= 24 and not re.search(r"\s{2,}|\.", raw):
        out["episode_label"] = raw
    return out


def _first_int(*values: Any) -> int | None:
    for value in values:
        n = coerce_episode_int(value)
        if n is not None:
            return n
    return None


def extract_episode_meta(
    source: dict[str, Any] | None = None,
    *texts: str,
    season: Any = None,
    episode: Any = None,
    episode_label: Any = None,
) -> dict[str, Any]:
    """Build normalized {season, episode, episode_label} from dict fields and/or text."""
    src = source if isinstance(source, dict) else {}
    season_n = _first_int(
        season,
        src.get("season"),
        src.get("seasonNumber"),
        src.get("season_number"),
        src.get("seasonNum"),
    )
    episode_n = _first_int(
        episode,
        src.get("episode"),
        src.get("number"),
        src.get("episodeNumber"),
        src.get("episode_number"),
        src.get("episodeNum"),
        src.get("epnum"),
        src.get("episode_num"),
    )
    label = str(
        episode_label
        if episode_label not in (None, "")
        else (src.get("episode_label") or src.get("episodeLabel") or "")
    ).strip()

    if season_n is not None and episode_n is not None:
        return {
            "season": season_n,
            "episode": episode_n,
            "episode_label": format_episode_label(season_n, episode_n) or label,
        }

    if label:
        parsed = parse_episode_num_text(label)
        if parsed["season"] is not None and parsed["episode"] is not None:
            return parsed
        if season_n is not None or episode_n is not None:
            return {
                "season": season_n if season_n is not None else parsed["season"],
                "episode": episode_n if episode_n is not None else parsed["episode"],
                "episode_label": format_episode_label(
                    season_n if season_n is not None else parsed["season"],
                    episode_n if episode_n is not None else parsed["episode"],
                )
                or label,
            }

    for text in texts:
        if not text:
            continue
        parsed = parse_episode_num_text(str(text))
        if parsed["season"] is not None and parsed["episode"] is not None:
            return parsed

    # Partial numeric fields without a pair — do not invent a label.
    return {"season": season_n, "episode": episode_n, "episode_label": label}


def enrich_programme_row(row: dict[str, Any]) -> dict[str, Any]:
    """Ensure programme row dict has normalized season/episode/episode_label."""
    if not isinstance(row, dict):
        return row
    meta = extract_episode_meta(
        row,
        str(row.get("title") or ""),
        str(row.get("subtitle") or ""),
        str(row.get("desc") or ""),
        str(row.get("description") or ""),
    )
    if meta["season"] is not None:
        row["season"] = meta["season"]
    if meta["episode"] is not None:
        row["episode"] = meta["episode"]
    if meta["episode_label"]:
        row["episode_label"] = meta["episode_label"]
    return row
