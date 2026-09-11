"""Light ICY / stream now-playing peek for Music Radio.

Prefers ICY StreamTitle from shoutcast/icecast-style streams.
Decodes MediaBase / automation attribute dumps (text=, TPID=, …)
into clean artist/title plus structured ids for enrichment.
Degrades gracefully (no scraper farm).
"""
from __future__ import annotations

import asyncio
import re
from typing import Any
from urllib.parse import urlparse

import httpx

from .radio_browser import UA, _get_client, _throttle

# StreamTitle='…' or StreamTitle="…"
_ICY_TITLE_RE = re.compile(r"StreamTitle=(['\"])(.*?)\1", re.I | re.DOTALL)
_NEXT_RE = re.compile(r"StreamUrl='([^']*)'|next(?:up)?[=:]?\s*([^;]+)", re.I)

# key="value" with basic backslash escapes inside quotes
_ATTR_RE = re.compile(r'([A-Za-z_][\w]*)="((?:\\.|[^"\\])*)"')
# Truncated / incomplete key="… (no closing quote) — common when ICY meta block cuts mid-dump
_ATTR_OPEN_RE = re.compile(r'([A-Za-z_][\w]*)="')
_INCOMPLETE_ATTR_TAIL_RE = re.compile(r'\s*[A-Za-z_][\w]*="[^"]*$')

# Dashes used between Artist and Title / attr soup
_DASH_SPLIT_RE = re.compile(r"\s+(?:—|–|-|−)\s+")

# Structured automation / MediaBase keys we keep (never shown in dock title)
_ID_KEYS = (
    "TPID",
    "cartcutId",
    "itunesTrackId",
    "amgTrackId",
    "amgArtistId",
    "MediaBaseId",
    "song_spot",
    "TAID",
    "spotInstanceId",
    "length",
    "album",
    "ISRC",
)

_COMMERCIAL_SPOTS = frozenset({"C", "c", "I", "i", "V", "v", "P", "p", "J", "j"})
_ZEROISH = frozenset({"", "0", "-1", "null", "None", "none"})
_JUNK_TITLE_RE = re.compile(r'^[\s,",.\|/\\\'`~_\-–—]+$')

_RAW_MAX = 480
_FIELD_MAX = 180


def _unescape_attr(val: str) -> str:
    return (
        (val or "")
        .replace(r"\"", '"')
        .replace(r"\\", "\\")
        .replace(r"\n", " ")
        .strip()
    )


def _clip(s: str | None, n: int = _FIELD_MAX) -> str | None:
    if s is None:
        return None
    t = s.strip()
    if not t:
        return None
    if len(t) > n:
        return t[: n - 1].rstrip() + "…"
    return t


def _parse_attrs(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for m in _ATTR_RE.finditer(text or ""):
        key = m.group(1)
        out[key] = _unescape_attr(m.group(2))
    return out


def _has_attr_soup(text: str) -> bool:
    return bool(_ATTR_RE.search(text or "")) or bool(_ATTR_OPEN_RE.search(text or ""))


def _prefix_before_attrs(text: str) -> str:
    """Everything before the first key=\"…\" blob, trailing separators stripped."""
    m = _ATTR_RE.search(text or "") or _ATTR_OPEN_RE.search(text or "")
    head = text[: m.start()] if m else (text or "")
    return re.sub(r"[\s\-–—−·|:]+$", "", head).strip()


def _strip_attr_soup(text: str) -> str:
    cleaned = _ATTR_RE.sub(" ", text or "")
    cleaned = _INCOMPLETE_ATTR_TAIL_RE.sub("", cleaned)
    cleaned = _ATTR_OPEN_RE.sub(" ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" \t-–—−·|:")
    return cleaned


def _split_artist_title(blob: str) -> tuple[str | None, str | None]:
    text = (blob or "").strip()
    if not text:
        return None, None
    parts = _DASH_SPLIT_RE.split(text, maxsplit=1)
    if len(parts) == 2 and parts[0].strip() and parts[1].strip():
        return parts[0].strip(), parts[1].strip()
    return None, text


def _collect_ids(attrs: dict[str, str]) -> dict[str, str]:
    """Keep useful structured ids; drop zeroish catalog ids that aren't useful."""
    always = frozenset({"TPID", "cartcutId", "song_spot"})
    skip_zeroish = frozenset(
        {"itunesTrackId", "amgTrackId", "amgArtistId", "MediaBaseId", "TAID", "spotInstanceId"}
    )
    ids: dict[str, str] = {}
    for key in _ID_KEYS:
        if key not in attrs:
            continue
        val = (attrs[key] or "").strip()
        if not val:
            continue
        if key in skip_zeroish and val in _ZEROISH:
            continue
        if key in always or val not in _ZEROISH or key not in skip_zeroish:
            ids[key] = val
    return ids


def _is_commercial(ids: dict[str, str], title: str | None, artist: str | None) -> bool:
    spot = (ids.get("song_spot") or "").strip()
    if spot in _COMMERCIAL_SPOTS:
        return True
    if not title and not artist and ids:
        return True
    low = (title or "").lower()
    if low in {"commercial", "ad", "advertisement", "promo", "liners", "sweepers", "id"}:
        return True
    return False


def _parse_title_blob(raw: str) -> dict[str, Any]:
    """Parse StreamTitle / next blob into human fields + structured ids.

    Handles classic ``Artist - Title`` and MediaBase dumps like::

        Lil Uzi Vert - text="What You Saying" song_spot="M" TPID="368995827" …

    UI must only use artist/title; ids stay for enrichment (cover lookup later).
    """
    text = (raw or "").strip()
    if not text:
        return {"raw": None, "title": None, "artist": None, "next": None, "ids": None}

    raw_kept = text if len(text) <= _RAW_MAX else text[: _RAW_MAX - 1].rstrip() + "…"
    attrs = _parse_attrs(text) if _has_attr_soup(text) else {}
    ids = _collect_ids(attrs) if attrs else {}

    title: str | None = None
    artist: str | None = None

    # Prefer explicit text="…" (MediaBase / automation title)
    text_attr = attrs.get("text") or attrs.get("Title") or attrs.get("song") or attrs.get("Song")
    # Incomplete text="… truncation: salvage whatever is inside the open quote
    if not text_attr:
        m_open = re.search(r'(?:^|\s)(?:text|Title|song)\s*=\s*"([^"]*)', text, re.I)
        if m_open and m_open.group(1).strip():
            text_attr = m_open.group(1).strip()
            # Drop obvious truncation crumbs
            if text_attr.endswith("\\"):
                text_attr = text_attr[:-1].rstrip()
    if text_attr:
        title = text_attr.strip() or None
        prefix = _prefix_before_attrs(text)
        if prefix:
            # Prefix is usually the artist (possibly with a dangling dash already stripped)
            a2, t2 = _split_artist_title(prefix)
            if a2 and t2 and not _has_attr_soup(t2):
                # Rare: "Artist - Something" before attrs — keep Something only if no text=
                artist = a2
            else:
                artist = prefix
        if not artist:
            # Fallback: cleaned remainder without attrs
            cleaned = _strip_attr_soup(text)
            a2, t2 = _split_artist_title(cleaned)
            if a2:
                artist = a2
    else:
        # Classic StreamTitle: Artist - Title (or attr soup without text=)
        if attrs or _ATTR_OPEN_RE.search(text):
            cleaned = _strip_attr_soup(text)
            artist, title = _split_artist_title(cleaned)
            # Secondary title keys
            if not title:
                title = (
                    attrs.get("title")
                    or attrs.get("Title")
                    or attrs.get("song")
                    or attrs.get("Song")
                )
            if not artist:
                artist = attrs.get("artist") or attrs.get("Artist") or attrs.get("performer")
        else:
            artist, title = _split_artist_title(text)

    artist = _clip(artist)
    title = _clip(title)

    # If title/artist still look like attr soup or open key=", refuse to surface it
    if title and (_has_attr_soup(title) or _ATTR_OPEN_RE.search(title) or title.startswith("text=")):
        title = _clip(attrs.get("text") or text_attr) or None
    if artist and (_has_attr_soup(artist) or _ATTR_OPEN_RE.search(artist)):
        artist = _clip(_prefix_before_attrs(artist)) or None
    if title and (_JUNK_TITLE_RE.match(title) or title.count('"') >= 2 and len(title) < 12):
        title = None

    commercial = _is_commercial(ids, title, artist)
    if commercial and not title and not artist:
        # IDs-only / break — keep payload structured, no dock soup
        return {
            "raw": raw_kept,
            "title": None,
            "artist": None,
            "next": None,
            "ids": ids or None,
            "kind": "break",
        }

    out: dict[str, Any] = {
        "raw": raw_kept,
        "title": title,
        "artist": artist,
        "next": None,
        "ids": ids or None,
    }
    if commercial:
        out["kind"] = "break"
    return out


async def peek_icy_metadata(stream_url: str, *, timeout: float = 4.0) -> dict[str, Any]:
    """Fetch a short ICY metadata window from a live audio stream URL."""
    url = (stream_url or "").strip()
    if not url or not url.lower().startswith(("http://", "https://")):
        return {"ok": False, "source": "none", "error": "bad_url"}
    # Skip playlists — client plays them; metadata lives on media segments
    path = urlparse(url).path.lower()
    if path.endswith((".m3u8", ".m3u", ".pls", ".xspf")):
        return {"ok": False, "source": "playlist", "error": "playlist_unsupported"}

    client = _get_client()
    headers = {
        "User-Agent": UA,
        "Icy-MetaData": "1",
        "Accept": "*/*",
        "Connection": "close",
    }
    try:
        await _throttle()
        async with client.stream(
            "GET",
            url,
            headers=headers,
            timeout=httpx.Timeout(timeout, connect=min(3.0, timeout)),
            follow_redirects=True,
        ) as resp:
            if resp.status_code >= 400:
                return {"ok": False, "source": "http", "error": f"status_{resp.status_code}"}
            metaint = resp.headers.get("icy-metaint") or resp.headers.get("Icy-MetaInt")
            icy_name = resp.headers.get("icy-name") or resp.headers.get("ice-name")
            icy_desc = resp.headers.get("icy-description") or resp.headers.get("ice-description")
            if not metaint:
                out: dict[str, Any] = {
                    "ok": bool(icy_name),
                    "source": "headers",
                    "station_name": icy_name,
                    "description": icy_desc,
                    "now": _parse_title_blob(icy_name or "") if icy_name else None,
                    "next": None,
                }
                return out
            try:
                interval = int(metaint)
            except ValueError:
                return {"ok": False, "source": "icy", "error": "bad_metaint"}
            if interval <= 0 or interval > 64_000:
                return {"ok": False, "source": "icy", "error": "metaint_out_of_range"}

            # Read audio chunk then one metadata block
            to_skip = interval
            buf = bytearray()
            async for chunk in resp.aiter_bytes():
                if not chunk:
                    continue
                buf.extend(chunk)
                if len(buf) >= to_skip + 1:
                    break
                if len(buf) > interval + 4096:
                    break

            if len(buf) < to_skip + 1:
                return {
                    "ok": bool(icy_name),
                    "source": "headers",
                    "station_name": icy_name,
                    "now": _parse_title_blob(icy_name or "") if icy_name else None,
                    "next": None,
                    "error": "short_read",
                }
            meta_len = buf[to_skip] * 16
            meta_start = to_skip + 1
            meta_end = meta_start + meta_len
            meta_raw = ""
            if meta_len and len(buf) >= meta_end:
                meta_raw = buf[meta_start:meta_end].decode("utf-8", errors="ignore").strip("\x00 ").strip()
            title_m = _ICY_TITLE_RE.search(meta_raw) if meta_raw else None
            stream_title = title_m.group(2).strip() if title_m else ""
            now = _parse_title_blob(stream_title) if stream_title else None
            nxt = None
            if meta_raw:
                nm = _NEXT_RE.search(meta_raw)
                if nm:
                    cand = (nm.group(1) or nm.group(2) or "").strip()
                    if cand and not cand.lower().startswith("http"):
                        nxt = _parse_title_blob(cand)
            return {
                "ok": bool(now and (now.get("raw") or now.get("title") or now.get("artist") or icy_name)),
                "source": "icy",
                "station_name": icy_name,
                "description": icy_desc,
                "now": now,
                "next": nxt,
                "raw_meta": meta_raw[:240] if meta_raw else None,
            }
    except asyncio.TimeoutError:
        return {"ok": False, "source": "icy", "error": "timeout"}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "source": "icy", "error": str(exc)[:160]}
