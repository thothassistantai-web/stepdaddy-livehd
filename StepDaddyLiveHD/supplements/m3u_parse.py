"""Minimal M3U / M3U8 EXTINF parser."""

from __future__ import annotations

import re
from dataclasses import dataclass


_ATTR_RE = re.compile(r'([A-Za-z0-9\-]+)="([^"]*)"')


@dataclass
class M3uEntry:
    name: str
    stream_url: str
    tvg_id: str | None = None
    logo: str | None = None
    group_title: str | None = None
    source_playlist: str | None = None


def parse_m3u(text: str, source_playlist: str | None = None) -> list[M3uEntry]:
    entries: list[M3uEntry] = []
    pending: dict[str, str] | None = None
    pending_name = ""
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("#EXTINF:"):
            attrs = {m.group(1).lower(): m.group(2) for m in _ATTR_RE.finditer(line)}
            name = line.rsplit(",", 1)[-1].strip() if "," in line else attrs.get("tvg-name", "")
            pending = attrs
            pending_name = name
            continue
        if line.startswith("#"):
            continue
        if pending is None and not pending_name:
            continue
        attrs = pending or {}
        entries.append(
            M3uEntry(
                name=pending_name or attrs.get("tvg-name") or "Channel",
                stream_url=line,
                tvg_id=(attrs.get("tvg-id") or "").strip() or None,
                logo=(attrs.get("tvg-logo") or "").strip() or None,
                group_title=(attrs.get("group-title") or "").strip() or None,
                source_playlist=source_playlist,
            )
        )
        pending = None
        pending_name = ""
    return entries
