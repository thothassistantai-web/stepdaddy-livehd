"""External subtitle search (Wyzie) + SRT/VTT proxy for HLS overlays."""

from __future__ import annotations

import os
import re
from typing import Any

import httpx

WYZIE_BASE = os.environ.get("WYZIE_BASE_URL", "https://sub.wyzie.io").rstrip("/")
WYZIE_KEY = os.environ.get("WYZIE_API_KEY", "").strip()
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


def _norm_type(media_type: str) -> str:
    t = (media_type or "movie").strip().lower()
    if t in ("series", "tv", "show", "episode"):
        return "tv"
    return "movie"


def search_subtitles(
    tmdb_id: int,
    media_type: str = "movie",
    *,
    season: int | None = None,
    episode: int | None = None,
    language: str | None = None,
) -> list[dict[str, Any]]:
    if not tmdb_id or int(tmdb_id) <= 0:
        return []
    params: dict[str, Any] = {"id": int(tmdb_id)}
    if language:
        params["language"] = language
    if WYZIE_KEY:
        params["key"] = WYZIE_KEY
    kind = _norm_type(media_type)
    if kind == "tv":
        params["season"] = max(1, int(season or 1))
        params["episode"] = max(1, int(episode or 1))
    try:
        with httpx.Client(timeout=14.0, follow_redirects=True, headers={"User-Agent": UA}) as client:
            r = client.get(f"{WYZIE_BASE}/search", params=params)
            if r.status_code >= 400:
                return []
            data = r.json()
    except Exception:
        return []
    if not isinstance(data, list):
        return []
    out: list[dict[str, Any]] = []
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            continue
        url = item.get("url") or item.get("download_url") or ""
        if not url:
            continue
        out.append(
            {
                "id": str(item.get("id") or f"sub_{i}"),
                "url": url,
                "language": item.get("language") or "unknown",
                "display": item.get("display") or item.get("title") or f"Subtitle {i + 1}",
                "format": item.get("format") or "srt",
                "hearing_impaired": bool(item.get("isHearingImpaired") or item.get("hi")),
            }
        )
    return out[:40]


_SRT_BLOCK = re.compile(
    r"(\d+)\s*\n(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*\n([\s\S]*?)(?=\n\d+\s*\n|\Z)",
    re.MULTILINE,
)


def srt_to_vtt(srt_text: str) -> str:
    body = srt_text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if body.lstrip().startswith("WEBVTT"):
        return body if body.endswith("\n") else body + "\n"
    cues = []
    for m in _SRT_BLOCK.finditer(body + "\n"):
        start = m.group(2).replace(",", ".")
        end = m.group(3).replace(",", ".")
        text = m.group(4).strip()
        if not text:
            continue
        cues.append(f"{start} --> {end}\n{text}\n")
    return "WEBVTT\n\n" + "\n".join(cues)


def fetch_subtitle_text(url: str) -> tuple[str, str]:
    """Return (vtt_text, content_type)."""
    if not url or not url.startswith(("http://", "https://")):
        raise ValueError("invalid_url")
    with httpx.Client(timeout=18.0, follow_redirects=True, headers={"User-Agent": UA}) as client:
        r = client.get(url)
        r.raise_for_status()
        raw = r.text
    lower = url.lower()
    if lower.endswith(".vtt") or raw.lstrip().startswith("WEBVTT"):
        vtt = raw if raw.lstrip().startswith("WEBVTT") else "WEBVTT\n\n" + raw
        return vtt, "text/vtt; charset=utf-8"
    return srt_to_vtt(raw), "text/vtt; charset=utf-8"
