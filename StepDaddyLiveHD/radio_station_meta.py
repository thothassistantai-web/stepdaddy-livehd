"""Broadcast callsign/dial display-name helpers for Music Radio."""
from __future__ import annotations

import re
from typing import Any

_CALLSIGN_EXTRACT_RE = re.compile(
    r"\b([KW][A-Z]{2,3}|[KW]\d[A-Z]{2,3})(?:-?(?:FM|AM|HD))?\b",
    re.I,
)
_FM_DIAL_RE = re.compile(r"\b(\d{2,3}\.\d)\s*(?:FM)?\b", re.I)
_AM_DIAL_RE = re.compile(r"\b(\d{3,4})\s*AM\b", re.I)


def _tag_list(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [t.strip().lower() for t in str(raw).split(",") if t.strip()]


def parse_broadcast_identity(name: str, tags: str | None = None) -> dict[str, str | None]:
    """Extract callsign / dial / band hints from a Radio Browser station name."""
    raw = str(name or "").strip()
    tagset = set(_tag_list(tags))
    callsign = None
    m = _CALLSIGN_EXTRACT_RE.search(raw)
    if m:
        callsign = m.group(1).upper()
    dial = None
    band = None
    fm = _FM_DIAL_RE.search(raw)
    am = _AM_DIAL_RE.search(raw)
    if fm:
        dial = fm.group(1)
        band = "FM"
    elif am:
        dial = am.group(1)
        band = "AM"
    elif "fm" in tagset:
        band = "FM"
    elif "am" in tagset:
        band = "AM"
    brand = None
    brand_src = raw
    if callsign:
        brand_src = re.sub(re.escape(callsign) + r"(?:-?(?:FM|AM|HD))?", " ", brand_src, flags=re.I)
    brand_src = re.sub(r"\b\d{2,3}\.\d\s*(?:FM)?\b", " ", brand_src, flags=re.I)
    brand_src = re.sub(r"\b\d{3,4}\s*AM\b", " ", brand_src, flags=re.I)
    brand_src = re.sub(r"\s+[–—-]\s*.*$", "", brand_src).strip(" \"'`-|,")
    brand_src = re.sub(r"\s{2,}", " ", brand_src).strip()
    if brand_src and brand_src.upper() != (callsign or ""):
        brand = brand_src[:48]
    return {"callsign": callsign, "dial": dial, "band": band, "brand": brand}


def format_station_display_name(
    *,
    raw_name: str,
    callsign: str | None = None,
    brand: str | None = None,
    dial: str | None = None,
    band: str | None = None,
) -> str:
    """Normalize to `CALL · Brand · dial BAND` when parts are known."""
    cs = (callsign or "").strip().upper() or None
    br = (brand or "").strip() or None
    di = (dial or "").strip() or None
    bd = (band or "").strip().upper() or None
    if br and cs and br.upper() == cs:
        br = None
    if br and di and br.replace(" ", "") == f"{di}{bd or ''}".replace(" ", ""):
        br = None
    parts: list[str] = []
    if cs:
        parts.append(cs)
    if br:
        parts.append(br)
    if di:
        parts.append(f"{di} {bd}".strip() if bd and bd in {"FM", "AM", "HD"} else di)
    if parts:
        return " · ".join(parts)
    return (raw_name or "Unknown").strip() or "Unknown"
