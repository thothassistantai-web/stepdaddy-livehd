"""Server-side channel logo resolution (iptv-org + Pluto + meta.json).

Attaches a stable HTTPS logo URL once per catalog build. Indexes are cached
under ``data/logos/`` (or ``LOGO_INDEX_DIR``) — no per-paint third-party
lookups and no bulk binary downloads into git.

Priority (first hit wins):
  1. Existing channel logo (normalized http→https / skip empty)
  2. Identity / M3U / source-provided logo (caller keeps these)
  3. iptv-org ``logos.json`` by tvg-id (feed suffix ``@…`` stripped)
  4. Pluto CDN for 24-char hex channel ids (``images.pluto.tv/.../colorLogoPNG.png``)
  5. iptv-org by normalized channel name / alt_names
  6. ``meta.json`` logo by exact / normalized name (DDL backfill)
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from pathlib import Path
from typing import Any, Iterable

import httpx

log = logging.getLogger("supplements.logo_resolve")

_REPO_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_CACHE_DIR = Path(
    os.environ.get("LOGO_INDEX_DIR")
    or os.environ.get("OPENCLAW_LOGO_DIR")
    or (_REPO_ROOT / "data" / "logos")
)

LOGOS_URLS = (
    "https://iptv-org.github.io/api/logos.json",
    "https://cdn.jsdelivr.net/gh/iptv-org/api@gh-pages/logos.json",
)
CHANNELS_URLS = (
    "https://iptv-org.github.io/api/channels.json",
    "https://cdn.jsdelivr.net/gh/iptv-org/api@gh-pages/channels.json",
)

INDEX_TTL_SEC = float(os.environ.get("LOGO_INDEX_TTL_SEC", str(24 * 3600)))
_HEX24 = re.compile(r"^[0-9a-f]{24}$", re.I)
_QUALITY_RE = re.compile(
    r"\([^)]*\)|\b(?:hd|sd|fhd|uhd|4k|720p|1080p|2160p|us|uk|usa|ca|de|fr|it|es)\b",
    re.I,
)
_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def normalize_logo_url(url: str | None) -> str | None:
    """Normalize a logo URL; return None if unusable."""
    if not url:
        return None
    u = str(url).strip()
    if not u or u.lower() in {"null", "none", "undefined", "-"}:
        return None
    if u.startswith("//"):
        u = "https:" + u
    elif u.startswith("http://"):
        u = "https://" + u[7:]
    if not (u.startswith("https://") or u.startswith("/")):
        # Relative non-root paths are usually broken in the guide.
        return None
    return u


def strip_tvg_feed(tvg_id: str | None) -> str:
    raw = (tvg_id or "").strip()
    if not raw:
        return ""
    return raw.split("@", 1)[0].strip()


def normalize_channel_name(name: str | None) -> str:
    s = (name or "").lower().strip()
    if not s:
        return ""
    s = _QUALITY_RE.sub(" ", s)
    s = _NON_ALNUM.sub("", s)
    return s


def pluto_logo_url(channel_hex: str) -> str:
    return f"https://images.pluto.tv/channels/{channel_hex.lower()}/colorLogoPNG.png"


def _pick_best_logo(rows: Iterable[dict[str, Any]]) -> str | None:
    best: tuple[tuple[int, int, int], str] | None = None
    for row in rows:
        url = normalize_logo_url(row.get("url") or row.get("logo"))
        if not url:
            continue
        area = int(row.get("width") or 0) * int(row.get("height") or 0)
        fmt = str(row.get("format") or "").upper()
        score = (
            1 if row.get("in_use") else 0,
            area,
            1 if fmt == "PNG" else 0,
        )
        if best is None or score > best[0]:
            best = (score, url)
    return best[1] if best else None


class LogoResolver:
    def __init__(self, cache_dir: Path | None = None) -> None:
        self.cache_dir = Path(cache_dir) if cache_dir else _DEFAULT_CACHE_DIR
        self._by_tvg: dict[str, str] = {}
        self._by_name: dict[str, str] = {}
        self._meta_by_name: dict[str, str] = {}
        self._meta_by_norm: dict[str, str] = {}
        self._loaded_at = 0.0
        self._stats: dict[str, Any] = {}

    @property
    def stats(self) -> dict[str, Any]:
        return dict(self._stats)

    @property
    def ready(self) -> bool:
        return bool(self._by_tvg or self._by_name or self._meta_by_name)

    def _paths(self) -> dict[str, Path]:
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        return {
            "logos": self.cache_dir / "iptv_org_logos.json",
            "channels": self.cache_dir / "iptv_org_channels.json",
            "index": self.cache_dir / "logo_index.json",
            "meta": _REPO_ROOT / "StepDaddyLiveHD" / "meta.json",
        }

    def _index_fresh(self, path: Path) -> bool:
        try:
            age = time.time() - path.stat().st_mtime
        except OSError:
            return False
        return age < INDEX_TTL_SEC

    def _load_meta_map(self) -> None:
        path = self._paths()["meta"]
        by_name: dict[str, str] = {}
        by_norm: dict[str, str] = {}
        if path.exists():
            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
            except Exception as exc:
                log.warning("meta.json logo load failed: %s", exc)
                raw = {}
            if isinstance(raw, dict):
                for name, row in raw.items():
                    if not isinstance(row, dict):
                        continue
                    url = normalize_logo_url(row.get("logo"))
                    if not url:
                        continue
                    key = str(name).strip()
                    by_name[key] = url
                    n = normalize_channel_name(key)
                    if n and n not in by_norm:
                        by_norm[n] = url
        self._meta_by_name = by_name
        self._meta_by_norm = by_norm

    def _build_indexes(self, logos: list[dict], channels: list[dict]) -> None:
        by_channel: dict[str, list[dict]] = {}
        for row in logos:
            if not isinstance(row, dict):
                continue
            ch = str(row.get("channel") or "").strip()
            if not ch:
                continue
            by_channel.setdefault(ch, []).append(row)

        by_tvg: dict[str, str] = {}
        for ch_id, rows in by_channel.items():
            url = _pick_best_logo(rows)
            if url:
                by_tvg[ch_id] = url

        by_name: dict[str, str] = {}
        for row in channels:
            if not isinstance(row, dict):
                continue
            ch_id = str(row.get("id") or "").strip()
            url = by_tvg.get(ch_id)
            if not url:
                continue
            names = [row.get("name"), *(row.get("alt_names") or [])]
            for name in names:
                n = normalize_channel_name(str(name) if name else "")
                if n and n not in by_name:
                    by_name[n] = url

        self._by_tvg = by_tvg
        self._by_name = by_name
        self._load_meta_map()
        self._loaded_at = time.time()
        self._stats = {
            "tvg_logos": len(by_tvg),
            "name_logos": len(by_name),
            "meta_logos": len(self._meta_by_name),
            "loaded_at": self._loaded_at,
            "cache_dir": str(self.cache_dir),
        }

    def _save_index(self) -> None:
        path = self._paths()["index"]
        payload = {
            "by_tvg": self._by_tvg,
            "by_name": self._by_name,
            "loaded_at": self._loaded_at,
            "stats": self._stats,
        }
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        tmp.replace(path)

    def load_from_disk(self) -> bool:
        """Load compacted index (or rebuild from cached JSON dumps). Sync-safe."""
        paths = self._paths()
        index_path = paths["index"]
        if index_path.exists() and self._index_fresh(index_path):
            try:
                payload = json.loads(index_path.read_text(encoding="utf-8"))
                self._by_tvg = {
                    str(k): str(v)
                    for k, v in (payload.get("by_tvg") or {}).items()
                    if v
                }
                self._by_name = {
                    str(k): str(v)
                    for k, v in (payload.get("by_name") or {}).items()
                    if v
                }
                self._load_meta_map()
                self._loaded_at = float(payload.get("loaded_at") or time.time())
                self._stats = dict(payload.get("stats") or {})
                self._stats["source"] = "index"
                return bool(self._by_tvg or self._by_name)
            except Exception as exc:
                log.warning("logo index read failed: %s", exc)

        logos_path, channels_path = paths["logos"], paths["channels"]
        if logos_path.exists() and channels_path.exists():
            try:
                logos = json.loads(logos_path.read_text(encoding="utf-8"))
                channels = json.loads(channels_path.read_text(encoding="utf-8"))
                if isinstance(logos, list) and isinstance(channels, list):
                    self._build_indexes(logos, channels)
                    self._save_index()
                    self._stats["source"] = "cached_json"
                    return True
            except Exception as exc:
                log.warning("logo cache rebuild failed: %s", exc)
        self._load_meta_map()
        return False

    async def _fetch_json(
        self, client: httpx.AsyncClient, urls: Iterable[str], dest: Path
    ) -> list | None:
        for url in urls:
            try:
                r = await client.get(
                    url,
                    headers={
                        "User-Agent": "StepDaddyLiveHD-logo-resolve/1.0",
                        "Accept": "application/json",
                    },
                    timeout=60.0,
                    follow_redirects=True,
                )
                if r.status_code != 200 or not r.content:
                    continue
                data = r.json()
                if not isinstance(data, list):
                    continue
                dest.write_bytes(r.content)
                return data
            except Exception as exc:
                log.debug("logo fetch miss %s: %s", url, exc)
        return None

    async def ensure_loaded(
        self, client: httpx.AsyncClient | None = None, force: bool = False
    ) -> None:
        if not force and self.ready and (time.time() - self._loaded_at) < INDEX_TTL_SEC:
            return
        if not force and self.load_from_disk():
            return

        own_client = client is None
        if own_client:
            client = httpx.AsyncClient(timeout=60.0, follow_redirects=True)
        assert client is not None
        try:
            paths = self._paths()
            logos = await self._fetch_json(client, LOGOS_URLS, paths["logos"])
            channels = await self._fetch_json(client, CHANNELS_URLS, paths["channels"])
            if logos is None or channels is None:
                if self.load_from_disk():
                    log.warning("logo index fetch failed — using stale disk cache")
                    return
                self._load_meta_map()
                log.warning("logo index unavailable (meta-only fallback)")
                return
            self._build_indexes(logos, channels)
            self._save_index()
            self._stats["source"] = "network"
            log.info(
                "logo index ready: tvg=%s name=%s meta=%s dir=%s",
                self._stats.get("tvg_logos"),
                self._stats.get("name_logos"),
                self._stats.get("meta_logos"),
                self.cache_dir,
            )
        finally:
            if own_client:
                await client.aclose()

    def resolve(
        self,
        *,
        name: str | None = None,
        tvg_id: str | None = None,
        existing: str | None = None,
        tags: list[str] | None = None,
        source: str | None = None,
    ) -> str | None:
        """Return best logo URL for a channel, or None."""
        if not self.ready:
            self.load_from_disk()

        have = normalize_logo_url(existing)
        if have:
            return have

        tid = strip_tvg_feed(tvg_id)
        if tid and tid in self._by_tvg:
            return self._by_tvg[tid]

        # iptv-org FAST lists often put Pluto channel ObjectIds in tvg-id.
        if tid and _HEX24.match(tid):
            return pluto_logo_url(tid)

        n = normalize_channel_name(name)
        if n and n in self._by_name:
            return self._by_name[n]

        raw_name = (name or "").strip()
        if raw_name and raw_name in self._meta_by_name:
            return self._meta_by_name[raw_name]
        if n and n in self._meta_by_norm:
            return self._meta_by_norm[n]
        return None

    def enrich_row(self, row: dict[str, Any]) -> dict[str, Any]:
        """Mutate/return a catalog row with resolved logo."""
        logo = self.resolve(
            name=row.get("name"),
            tvg_id=row.get("tvg_id"),
            existing=row.get("logo"),
            tags=list(row.get("tags") or []),
            source=row.get("source"),
        )
        if logo:
            row["logo"] = logo
        return row


_resolver: LogoResolver | None = None


def get_logo_resolver() -> LogoResolver:
    global _resolver
    if _resolver is None:
        _resolver = LogoResolver()
    return _resolver
