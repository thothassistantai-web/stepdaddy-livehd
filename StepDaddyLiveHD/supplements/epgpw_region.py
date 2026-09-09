"""High-confidence catalog region inference for selective epg.pw fetches.

Only GB / US / CA are auto-indexed. Other ISO codes require an existing map entry
before any country gzip is touched. Ambiguous channels (BBC One regionals, conflicting
US/UK signals, etc.) return None and stay unmapped.
"""

from __future__ import annotations

import os
import re
from typing import Any, Iterable

# Regions we may auto-fetch epg.pw country indexes for.
AUTO_INDEX_REGIONS = frozenset({"GB", "US", "CA"})

_SUFFIX_TO_CC = {
    "uk": "GB",
    "gb": "GB",
    "ie": "GB",
    "us": "US",
    "usa": "US",
    "ca": "CA",
}

_TAG_TO_CC = {
    "uk": "GB",
    "gb": "GB",
    "ie": "GB",
    "us": "US",
    "usa": "US",
    "ca": "CA",
    "canada": "CA",
}

_FLAG_TO_CC = {
    "🇬🇧": "GB",
    "🏴󠁧󠁢󠁥󠁮󠁧󠁿": "GB",
    "🏴󠁧󠁢󠁳󠁣󠁴󠁿": "GB",
    "🏴󠁧󠁢󠁷󠁬󠁳󠁿": "GB",
    "🇺🇸": "US",
    "🇨🇦": "CA",
}

# BBC One / ITV regional opt-outs (tvg @suffix or name).
_REGIONAL_VARIANT_RE = re.compile(
    r"@(london|east|west|north|south|midlands|yorkshire|wales|scotland|"
    r"northernireland|channelislands|oxford|cambridge|ci)\b|"
    r"\b(east midlands|west midlands|east yorkshire|channel islands|"
    r"northern ireland|north west|north east|south east|south west)\b",
    re.I,
)

_AMBIGUOUS_NAME_RE = re.compile(
    r"\b(bbc\s*one|bbc1|bbc\s*1)\b",
    re.I,
)

_SPORTS_RE = re.compile(
    r"\b(sports?|tnt\s*sports?|sky\s*sports?|espn\w*|eurosport|golf|cricket|football|"
    r"nba|nfl|mlb|nhl|ufc|racing|dazn|bein\w*|bt\s*sport|premier\s*sports|"
    r"fs[12]|tudn|acc\s*network|big\s*ten|sec\s*network|pac-?12|mls|"
    r"tennis|motogp|f1|formula\s*1|mutv|liverpool\s*tv|pdc)\b",
    re.I,
)


def _env_truthy(name: str, default: str = "0") -> bool:
    return os.environ.get(name, default).strip().lower() not in (
        "0",
        "false",
        "no",
        "off",
    )


def _tvg_base_and_region(tvg_id: str | None) -> tuple[str, str | None, str | None]:
    """Return (base, suffix_cc, at_region) from tvg-id like Foo.us@GB or BBCOne.uk@East."""
    tid = (tvg_id or "").strip()
    if not tid:
        return "", None, None
    at_region = None
    base = tid
    if "@" in tid:
        base, at_raw = tid.rsplit("@", 1)
        at_region = at_raw.strip().lower() or None
    suffix_cc = None
    m = re.search(r"\.([a-z]{2,3})\d*$", base, re.I)
    if m:
        suffix_cc = _SUFFIX_TO_CC.get(m.group(1).lower())
    if at_region:
        at_cc = _TAG_TO_CC.get(at_region)
        if at_cc:
            # Pluto / iptv-org style: PlutoTVAction.de@GB → GB
            return base, at_cc, at_region
    return base, suffix_cc, at_region


def _tags_to_regions(tags: Iterable[str] | None) -> set[str]:
    out: set[str] = set()
    for raw in tags or []:
        t = str(raw).strip()
        if not t:
            continue
        if t in _FLAG_TO_CC:
            out.add(_FLAG_TO_CC[t])
            continue
        low = t.lower().lstrip("#@")
        if low in _TAG_TO_CC:
            out.add(_TAG_TO_CC[low])
            continue
        # FreeTV / playlist origin: #us #uk #ca already covered; also @US in tag form.
        m = re.fullmatch(r"[@#]?(us|usa|uk|gb|ie|ca|canada)", low)
        if m:
            out.add(_TAG_TO_CC[m.group(1)])
    return out


def _name_region(name: str) -> str | None:
    n = (name or "").strip()
    if not n:
        return None
    low = n.lower()
    # Explicit trailing country tokens only (high confidence).
    if re.search(r"\b(united kingdom|great britain)\b", low) or re.search(
        r"(?:^|[\s\-])uk$", low
    ):
        return "GB"
    if re.search(r"\busa$", low) or re.search(r"\bunited states\b", low):
        return "US"
    if re.search(r"(?:^|[\s\-])us$", low) and "plus" not in low:
        # Trailing " US" — avoid "News" false positives; require space/hyphen before us.
        return "US"
    if re.search(r"\bcanada\b", low) or re.search(r"(?:^|[\s\-])ca$", low):
        return "CA"
    return None


def is_ambiguous_channel(
    name: str,
    tvg_id: str | None = None,
    tags: Iterable[str] | None = None,
) -> bool:
    """True when region cannot be trusted (BBC One regionals, conflicting signals)."""
    blob = f"{name or ''} {tvg_id or ''}"
    if _REGIONAL_VARIANT_RE.search(blob):
        return True
    if _AMBIGUOUS_NAME_RE.search(name or "") and "@" in (tvg_id or ""):
        # BBC One London / East / etc.
        return True
    tag_regions = _tags_to_regions(tags)
    _, suffix_cc, at_region = _tvg_base_and_region(tvg_id)
    name_cc = _name_region(name)
    votes = set(tag_regions)
    if suffix_cc:
        votes.add(suffix_cc)
    if name_cc:
        votes.add(name_cc)
    # Pluto @GB on a .de base is fine (single vote GB). Conflict = 2+ ISO codes.
    if len(votes) > 1:
        return True
    # Regional US timezone tags without country are not a country confirm.
    if at_region and at_region in (
        "east",
        "west",
        "central",
        "mountain",
        "pacific",
        "hd",
        "east hd",
        "west hd",
    ):
        # Still OK if we have a clear .us suffix / USA name — not ambiguous by itself.
        pass
    return False


def infer_confirmed_region(
    name: str,
    tvg_id: str | None = None,
    tags: Iterable[str] | None = None,
    *,
    channel_id: str | None = None,
    source: str | None = None,
) -> str | None:
    """Return ISO-ish region (GB/US/CA) only at high confidence; else None."""
    if is_ambiguous_channel(name, tvg_id, tags):
        return None

    tag_regions = _tags_to_regions(tags)
    _, suffix_cc, _at = _tvg_base_and_region(tvg_id)
    name_cc = _name_region(name)

    # FreeTV / iptv playlist origin tags are authoritative when alone.
    src = (source or "").strip().lower()
    if src in ("freetv", "iptv") and len(tag_regions) == 1:
        return next(iter(tag_regions))

    votes: list[str] = []
    if suffix_cc:
        votes.append(suffix_cc)
    if name_cc:
        votes.append(name_cc)
    votes.extend(sorted(tag_regions))

    if not votes:
        return None
    # All votes must agree.
    if len(set(votes)) != 1:
        return None
    cc = votes[0]
    if cc not in AUTO_INDEX_REGIONS:
        return None
    return cc


def region_candidates_from_catalog(
    catalog_rows: list[tuple[Any, ...]],
) -> list[tuple[str, str, str | None, str]]:
    """Filter catalog to high-confidence (gateway_id, name, tvg_id, region).

    Accepts tuples of (gid, name[, tvg[, tags[, source]]]).
    Skips sports/news sprawl unless EPGPW_AUTO_SPORTS=1. Numeric DDL only.
    """
    allow_sports = _env_truthy("EPGPW_AUTO_SPORTS", "0")
    out: list[tuple[str, str, str | None, str]] = []
    for row in catalog_rows:
        if not row:
            continue
        gid = str(row[0])
        name = str(row[1] if len(row) > 1 else "")
        tvg = str(row[2]).strip() if len(row) > 2 and row[2] else None
        tags = row[3] if len(row) > 3 else None
        source = str(row[4]) if len(row) > 4 and row[4] else None
        if not gid.isdigit():
            continue
        if not allow_sports and _SPORTS_RE.search(name or ""):
            continue
        if re.search(
            r"\b(serbia|croatia|bosnia|albania|russia|ukraine)\b",
            (name or "").lower(),
        ):
            continue
        region = infer_confirmed_region(
            name, tvg, tags if isinstance(tags, (list, tuple, set)) else None, source=source
        )
        if not region:
            continue
        # Prefer entertainment bands / clear names; still allow any confirmed DDL.
        out.append((gid, name, tvg, region))

    def _rank(item: tuple[str, str, str | None, str]) -> tuple:
        gid, name, _tvg, region = item
        n = int(gid)
        name_l = (name or "").lower()
        gb_band = 1 if region == "GB" and 348 <= n <= 380 else 0
        clear_tail = 1 if re.search(r"\b(uk|usa|us|ca|canada)$", name_l) else 0
        return (0 if region == "GB" else 1 if region == "US" else 2, -gb_band, -clear_tail, n)

    out.sort(key=_rank)
    return out


def ambiguous_unmapped_samples(
    catalog_rows: list[tuple[Any, ...]],
    already_gateway: set[str],
    limit: int = 40,
) -> list[dict[str, str]]:
    """Lightweight report of skipped ambiguous / unconfirmed DDL channels."""
    samples: list[dict[str, str]] = []
    for row in catalog_rows:
        if len(samples) >= limit:
            break
        gid = str(row[0])
        if not gid.isdigit() or gid in already_gateway:
            continue
        name = str(row[1] if len(row) > 1 else "")
        tvg = str(row[2]).strip() if len(row) > 2 and row[2] else ""
        tags = row[3] if len(row) > 3 else None
        if infer_confirmed_region(
            name, tvg or None, tags if isinstance(tags, (list, tuple, set)) else None
        ):
            continue
        reason = "unconfirmed"
        if is_ambiguous_channel(
            name, tvg or None, tags if isinstance(tags, (list, tuple, set)) else None
        ):
            reason = "ambiguous"
        # Only surface interesting skips (BBC regionals / conflicts / UK-ish names).
        blob = f"{name} {tvg}".lower()
        if not (
            reason == "ambiguous"
            or "bbc" in blob
            or "uk" in blob
            or "usa" in blob
            or ".uk" in blob
            or ".us" in blob
        ):
            continue
        samples.append(
            {
                "channel_id": gid,
                "name": name[:80],
                "tvg_id": tvg[:80],
                "reason": reason,
            }
        )
    return samples
