import bisect
import gzip
import html
import json
import os
import re
import threading
import time
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path


ANDROID_EPG_DIR = Path(__file__).resolve().parent.parent / "assets" / "android_epg"
EPG_PROGRAMME_CACHE = Path(__file__).with_name("epg_programmes_cache.json.gz")

DEFAULT_PRIMARY_FEEDS = [
    "https://epgshare01.online/epgshare01/epg_ripper_US2.xml.gz",
    "https://epgshare01.online/epgshare01/epg_ripper_US_SPORTS1.xml.gz",
    "https://epgshare01.online/epgshare01/epg_ripper_US_LOCALS1.xml.gz",
]

QUALITY_SUFFIXES = ("@SD", "@HD", "@UHD", "@4K", "@FHD")
REGION_SUFFIXES = (
    "@US", "@UK", "@East", "@West", "@Central", "@Mountain", "@Pacific",
    "@Germany", "@France", "@Panregional", "@EastHD", "@HDEast", "@WestHD",
)

AUTHORITATIVE_ID_MAPPINGS = {
    # 20260908r — guide ch 581 / gateway 326 Lifetime Network: keep LifetimeNetwork.us; fill via epg.pw 465290 Lifetime HD JSON (was empty)
    "326": "LifetimeNetwork.us",
    # 20260908s — guide ch 580 / gateway 389 Lifetime Movie Network: keep LifetimeMovieNetwork.us; fill via epg.pw 464929 LMN HD JSON (was empty)
    "389": "LifetimeMovieNetwork.us",
    # 20260908x — playlist/guide #655 / gateway 654: My9 NJ (WWOR Secaucus; bug my9nj.com). Not Fox 5 NYC / WNYW. Pin epg.pw 468489. Gateway 655 is WETV — do not confuse.
    "654": "WWOR-DT.us_locals1",
    # 20260908w/x — FOXNY USA gateway 768: true Fox 5 NYC (fox5ny.com) → keep WNYW + epg.pw 468913 (do not share 654's WWOR pin).
    "768": "WNYW-DT.us_locals1",
    "689": "HBO2.us",
    "151": "beINSportsMax7.qa",
    "597": "beINSportsMax8.qa",
    # 20260908a — batch 1–5 field match: SETTV.us was Sony-style id on E!; AMCPlus.us ≠ linear AMC.HD
    "315": "E.us",
    "303": "AMC.us",
    # 20260908b — batch 07: MTV USA stream is main MTV (Ridiculousness), not MTV Live concert feed
    "371": "MTV.us",
    # 20260908o — guide ch 20 / gateway 51 ABC USA: keep ABC.us (not Czech ABC.TV.cz); lite via epg.pw 464902
    "51": "ABC.us",
    # 20260908q — guide ch 251 / gateway 696 Comet USA: WWJS143.us was local/Pacific-skewed paid-prog guide; pin Comet.us2 + epg.pw 465305 JSON
    "696": "Comet.us2",
    # 20260908v — guide ch 622 / gateway 662 METV USA: WZVNTV262.us was empty + bridged MeTV.Plus; pin Me.TV.Network.us2 + epg.pw 465323 JSON (gateway 622 is Cosmote Sport 1 — do not confuse)
    "662": "Me.TV.Network.us2",
}


@dataclass
class EpgMatch:
    tvg_id: str | None
    confidence: float
    method: str


@dataclass(frozen=True)
class Programme:
    title: str
    start_ts: float
    stop_ts: float
    category: str = ""
    subtitle: str = ""
    year: int | None = None
    season: int | None = None
    episode: int | None = None
    episode_label: str = ""
    categories: tuple[str, ...] = field(default_factory=tuple)
    poster_url: str = ""
    backdrop_url: str = ""

    def to_dict(self) -> dict:
        return {
            "start": self.start_ts,
            "stop": self.stop_ts,
            "title": self.title,
            "category": self.category,
            "subtitle": self.subtitle,
            "year": self.year,
            "season": self.season,
            "episode": self.episode,
            "episode_label": self.episode_label,
            "categories": list(self.categories),
            "poster_url": self.poster_url or None,
            "backdrop_url": self.backdrop_url or None,
        }

    @classmethod
    def from_dict(cls, row: dict) -> "Programme | None":
        title = str(row.get("title") or "").strip()
        if not title:
            return None
        year_raw = row.get("year")
        year = int(year_raw) if year_raw not in (None, "") else None
        season_raw = row.get("season")
        episode_raw = row.get("episode")
        season = int(season_raw) if season_raw not in (None, "") else None
        episode = int(episode_raw) if episode_raw not in (None, "") else None
        cats = row.get("categories")
        if isinstance(cats, list):
            categories = tuple(str(c).strip() for c in cats if str(c).strip())
        else:
            categories = ()
        category = str(row.get("category") or (categories[0] if categories else "")).strip()
        return cls(
            title=title,
            start_ts=float(row["start"]),
            stop_ts=float(row["stop"]),
            category=category,
            subtitle=str(row.get("subtitle") or "").strip(),
            year=year,
            season=season,
            episode=episode,
            episode_label=str(row.get("episode_label") or "").strip(),
            categories=categories or ((category,) if category else ()),
            poster_url=str(row.get("poster_url") or row.get("image") or "").strip(),
            backdrop_url=str(row.get("backdrop_url") or "").strip(),
        )


class EpgChannelMapper:
    def __init__(self, assets_dir: Path = ANDROID_EPG_DIR):
        self._by_channel_id: dict[str, str] = {}
        self._by_norm_name: dict[str, str] = {}
        self._bridge: dict[str, list[str]] = {}
        self._load_assets(assets_dir)

    @staticmethod
    def _norm_name(name: str) -> str:
        s = name.lower()
        s = re.sub(r"\([^)]*\)", " ", s)
        s = s.replace("+", " plus ").replace("&", " and ")
        s = re.sub(r"\b(usa|us|uk|hd|fhd|4k|sd|tv|channel|live)\b", " ", s)
        s = re.sub(r"[^a-z0-9]+", " ", s)
        return re.sub(r"\s+", " ", s).strip()

    def _load_assets(self, assets_dir: Path):
        map_path = assets_dir / "channel_epg_map.json"
        if map_path.exists():
            try:
                payload = json.loads(map_path.read_text(encoding="utf-8"))
                for channel_id, tvg_id in (payload.get("mapping") or {}).items():
                    cid = str(channel_id).strip()
                    tid = str(tvg_id).strip()
                    if cid and tid:
                        self._by_channel_id[cid] = tid
            except Exception:
                pass

        for channel_id, tvg_id in AUTHORITATIVE_ID_MAPPINGS.items():
            self._by_channel_id[channel_id] = tvg_id

        bridge_path = assets_dir / "epg_id_bridge.json"
        if bridge_path.exists():
            try:
                payload = json.loads(bridge_path.read_text(encoding="utf-8"))
                raw = payload.get("bridge") or {}
                for playlist_id, feed_ids in raw.items():
                    key = str(playlist_id).strip()
                    ids = [str(x).strip() for x in feed_ids if str(x).strip()]
                    if key and ids:
                        self._bridge[key] = ids
            except Exception:
                pass

        overrides_path = assets_dir / "epg_name_overrides.json"
        if overrides_path.exists():
            try:
                payload = json.loads(overrides_path.read_text(encoding="utf-8"))
                for display_name, tvg_id in payload.items():
                    norm = self._norm_name(str(display_name))
                    tid = str(tvg_id).strip()
                    if norm and tid:
                        self._by_norm_name[norm] = tid
            except Exception:
                pass

    def map_channel_by_id(self, channel_id: str, channel_name: str = "") -> EpgMatch:
        cid = str(channel_id).strip()
        if cid in self._by_channel_id:
            return EpgMatch(self._by_channel_id[cid], 1.0, "android_id_map")
        if channel_name:
            return self.map_channel_name(channel_name)
        return EpgMatch(None, 0.0, "none")

    def map_channel_name(self, channel_name: str) -> EpgMatch:
        norm = self._norm_name(channel_name or "")
        if norm and norm in self._by_norm_name:
            return EpgMatch(self._by_norm_name[norm], 1.0, "android_name_override")
        return EpgMatch(None, 0.0, "none")

    def expand_lookup_ids(self, playlist_tvg_ids: set[str]) -> tuple[set[str], dict[str, str]]:
        lookup_ids: set[str] = set()
        remap: dict[str, str] = {}

        def add_variant(variant: str, playlist_id: str):
            variant = variant.strip()
            playlist_id = playlist_id.strip()
            if not variant or not playlist_id:
                return
            lookup_ids.add(variant)
            remap.setdefault(variant, playlist_id)

        for playlist_id in playlist_tvg_ids:
            trimmed = playlist_id.strip()
            if not trimmed:
                continue
            add_variant(trimmed, trimmed)
            base = trimmed.split("@", 1)[0]
            if base and base != trimmed:
                add_variant(base, trimmed)
            for suffix in QUALITY_SUFFIXES + REGION_SUFFIXES:
                add_variant(f"{base}{suffix}", trimmed)
            if trimmed.lower().endswith("@us"):
                add_variant(f"{base}@SD", trimmed)
            if trimmed.lower().endswith("@sd"):
                add_variant(f"{base}@US", trimmed)
            for feed_id in self._bridge.get(trimmed, []):
                add_variant(feed_id, trimmed)
                feed_base = feed_id.split("@", 1)[0]
                if feed_base and feed_base != feed_id:
                    add_variant(feed_base, trimmed)

        return lookup_ids, remap

    @property
    def mapped_id_count(self) -> int:
        return len(self._by_channel_id)


class EpgService:
    def __init__(self):
        epg_disable = os.environ.get("EPG_DISABLE", "FALSE").upper() in ("1", "TRUE", "YES")
        # WhatsOnFreeTV Free-TV + FAST merge can run alone (no heavy XMLTV) when EPG_DISABLE=TRUE.
        try:
            from StepDaddyLiveHD.supplements import woftv_epg as _woftv

            woftv_on = bool(_woftv.ENABLED)
        except Exception:
            woftv_on = os.environ.get("WOFTV_EPG_ENABLE", "1").strip().lower() not in (
                "0",
                "false",
                "no",
                "off",
            )
        try:
            from StepDaddyLiveHD.supplements import epgpw_epg as _epgpw

            epgpw_on = bool(_epgpw.ENABLED)
        except Exception:
            epgpw_on = os.environ.get("EPGPW_ENABLE", "1").strip().lower() not in (
                "0",
                "false",
                "no",
                "off",
            )
        # Lite = skip heavy XMLTV; WOFTV/Pluto/epg.pw still merge.
        self.woftv_lite = bool(epg_disable and (woftv_on or epgpw_on))
        # Full disable only when neither XMLTV nor lite supplements are wanted.
        self.disabled = bool(epg_disable and not woftv_on and not epgpw_on)
        urls_env = os.environ.get("EPG_URLS", "").strip()
        if self.disabled:
            self.epg_urls: list[str] = []
        elif self.woftv_lite:
            # Memory-safe: skip XMLTV feeds; Free-TV programmes come from woftv GitHub JSON.
            self.epg_urls = []
        elif urls_env:
            self.epg_urls = [u.strip() for u in urls_env.split(",") if u.strip()]
        else:
            self.epg_urls = list(DEFAULT_PRIMARY_FEEDS)

        self.refresh_seconds = int(os.environ.get("EPG_REFRESH_SECONDS", "21600"))
        self.schedule_hours = int(os.environ.get("EPG_SCHEDULE_HOURS", "24"))
        self.schedule_past_minutes = int(os.environ.get("EPG_SCHEDULE_PAST_MINUTES", "30"))
        self.enable_heavy_fallback = os.environ.get("EPG_ENABLE_HEAVY_FALLBACK", "FALSE").upper() == "TRUE"
        self.download_timeout_seconds = int(os.environ.get("EPG_DOWNLOAD_TIMEOUT_SECONDS", "45"))
        self.heavy_max_mb = int(os.environ.get("EPG_HEAVY_MAX_MB", "60"))

        self.mapper = EpgChannelMapper()
        self._catalog_ids: list[tuple[str, str]] = []
        self._catalog_tags: dict[str, list[str]] = {}
        self._wanted_tvg_ids: set[str] = set()
        self._proven_tvg_ids: set[str] = set()
        self._programmes_by_channel: dict[str, list[Programme]] = {}
        self._match_cache: dict[str, EpgMatch] = {}
        self._last_refresh = 0.0
        self._epg_ready = False
        self._refresh_lock = threading.Lock()
        self._refreshing = False
        self._last_refresh_meta: dict = {}
        self._pluto_id_by_tvg: dict[str, str] = {}
        self._pluto_id_by_channel: dict[str, str] = {}
        self._pluto_filled_tvg: set[str] = set()
        self._epgpw_id_by_tvg: dict[str, str] = {}
        self._epgpw_id_by_channel: dict[str, str] = {}
        self._epgpw_filled_tvg: set[str] = set()
        # Background live gap fills (epg.pw / Pluto) — never block batch responses.
        self._gap_fill_lock = threading.Lock()
        self._gap_fill_queued: set[str] = set()  # "cid|tvg" keys
        self._gap_fill_attempted: set[str] = set()  # avoid re-queue storms on empty ids
        self._gap_fill_worker: threading.Thread | None = None
        # Optional callback (e.g. invalidate channels cache) after a successful refresh.
        self.on_refresh_done = None

        if not self.disabled:
            loaded = self._load_programme_cache_if_fresh(time.time())
            if loaded:
                # Cache path skips Pluto/epg.pw overlays; force overlay on next refresh.
                self._last_refresh = 0.0
            # Do not call ensure_refresh_async() here — uvicorn may not have bound yet.
            # Startup / first API hit will kick refresh.

    def set_catalog(self, channels: list):
        """Accept (id, name) or (id, name, tags) or Channel-like objects."""
        rows: list[tuple[str, str]] = []
        tags_by_id: dict[str, list[str]] = {}
        for item in channels:
            if hasattr(item, "id") and hasattr(item, "name"):
                cid, name = str(item.id), str(item.name)
                tags = list(getattr(item, "tags", None) or [])
            elif isinstance(item, (tuple, list)) and len(item) >= 2:
                cid, name = str(item[0]), str(item[1])
                tags = list(item[2]) if len(item) >= 3 and item[2] else []
            else:
                continue
            rows.append((cid, name))
            if tags:
                tags_by_id[cid] = [str(t) for t in tags]
        self._catalog_ids = rows
        self._catalog_tags = tags_by_id
        wanted: set[str] = set()
        for cid, name in self._catalog_ids:
            match = self.map_channel_by_id(cid, name)
            if match.tvg_id:
                wanted.add(match.tvg_id)
        self._wanted_tvg_ids = wanted

    def map_channel_by_id(self, channel_id: str, channel_name: str = "") -> EpgMatch:
        cache_key = f"id:{channel_id}"
        if cache_key in self._match_cache:
            return self._match_cache[cache_key]
        match = self.mapper.map_channel_by_id(channel_id, channel_name)
        self._match_cache[cache_key] = match
        return match

    def map_channel_name(self, name: str) -> EpgMatch:
        if name in self._match_cache:
            return self._match_cache[name]
        match = self.mapper.map_channel_name(name)
        self._match_cache[name] = match
        return match

    @staticmethod
    def _parse_xmltv_dt(value: str) -> datetime | None:
        if not value:
            return None
        value = value.strip()
        for fmt in ("%Y%m%d%H%M%S %z", "%Y%m%d%H%M %z", "%Y%m%d%H%M%S", "%Y%m%d%H%M"):
            try:
                dt = datetime.strptime(value, fmt)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.astimezone(timezone.utc)
            except Exception:
                continue
        return None

    @staticmethod
    def _parse_year(value: str) -> int | None:
        value = (value or "").strip()
        m = re.match(r"(\d{4})", value)
        if not m:
            return None
        year = int(m.group(1))
        if 1900 <= year <= 2100:
            return year
        return None

    @staticmethod
    def _parse_episode_num(text: str) -> dict:
        text = html.unescape((text or "").strip())
        try:
            from StepDaddyLiveHD.supplements.episode_meta import parse_episode_num_text

            return parse_episode_num_text(text)
        except Exception:
            out = {"episode_label": "", "season": None, "episode": None}
            if not text:
                return out
            m = re.match(r"[Ss](\d+)\s*[Ee](?:p(?:isode)?)?\s*(\d+)", text)
            if m:
                out["season"] = int(m.group(1))
                out["episode"] = int(m.group(2))
                out["episode_label"] = f"S{m.group(1)}E{m.group(2)}"
                return out
            m = re.match(r"(\d+)\s*[/\.]\s*(\d+)", text)
            if m:
                out["season"] = int(m.group(1))
                out["episode"] = int(m.group(2))
                out["episode_label"] = f"S{m.group(1)}E{m.group(2)}"
                return out
            out["episode_label"] = text
            return out

    @staticmethod
    def _programme_kind(prog: Programme) -> str:
        cats = [c.lower() for c in (prog.categories or (prog.category,) if prog.category else ())]
        if prog.season or prog.episode or prog.episode_label:
            return "series"
        if any("movie" in c or "film" in c for c in cats):
            return "movie"
        if any("sport" in c for c in cats):
            return "sports"
        if any("news" in c for c in cats):
            return "news"
        if any("series" in c for c in cats):
            return "series"
        return "other"

    def _programme_to_api(self, prog: Programme, *, allow_network: bool = True) -> dict:
        out = {
            "title": prog.title,
            "subtitle": prog.subtitle,
            "start": datetime.fromtimestamp(prog.start_ts, timezone.utc).isoformat(),
            "stop": datetime.fromtimestamp(prog.stop_ts, timezone.utc).isoformat(),
            "category": prog.category or "EPG",
            "categories": list(prog.categories) if prog.categories else ([prog.category] if prog.category else []),
            "year": prog.year,
            "season": prog.season,
            "episode": prog.episode,
            "episode_label": prog.episode_label,
            "programme_type": self._programme_kind(prog),
            "poster_url": prog.poster_url or None,
            "backdrop_url": prog.backdrop_url or None,
        }
        # epg.pw JSON/gzip often omit episode-num; fill S/E from TVmaze plot match.
        # Network lookups are for now/next only — schedule uses disk/memory cache to
        # avoid blocking the single uvicorn worker on cold TVmaze fetches.
        if out.get("season") is None or out.get("episode") is None or not out.get("episode_label"):
            try:
                from StepDaddyLiveHD.supplements.episode_resolve import enrich_api_programme

                enrich_api_programme(out, allow_network=allow_network)
            except Exception:
                pass
        return out

    @staticmethod
    def _feed_download_url(url: str) -> str:
        cb = int(time.time() * 1000)
        return f"{url}&cb={cb}" if "?" in url else f"{url}?cb={cb}"

    def _download_xml_bytes(self, url: str, max_bytes: int | None = None) -> bytes:
        req = urllib.request.Request(
            self._feed_download_url(url),
            headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) StepDaddy-Gateway/1.0"},
        )
        with urllib.request.urlopen(req, timeout=self.download_timeout_seconds) as resp:
            chunks: list[bytes] = []
            total = 0
            while True:
                block = resp.read(1024 * 1024)
                if not block:
                    break
                total += len(block)
                if max_bytes and total > max_bytes:
                    raise ValueError("feed exceeded max_bytes")
                chunks.append(block)
        data = b"".join(chunks)
        if url.endswith(".gz"):
            return gzip.decompress(data)
        return data

    def _window_bounds(self) -> tuple[float, float]:
        now = datetime.now(timezone.utc)
        start = now - timedelta(minutes=self.schedule_past_minutes)
        end = now + timedelta(hours=self.schedule_hours)
        return start.timestamp(), end.timestamp()

    def _parse_feed_into(
        self,
        xml_bytes: bytes,
        lookup_ids: set[str],
        remap: dict[str, str],
        window_start: float,
        window_end: float,
        out: dict[str, list[Programme]],
        seen: set[tuple[str, float, str]],
    ):
        text = xml_bytes.decode("utf-8", errors="ignore")
        prog_re = re.compile(r"<programme\b([^>]*)>(.*?)</programme>", re.S | re.I)
        attr_re = re.compile(r'(\w+)="([^"]*)"')
        title_re = re.compile(r"<title[^>]*>([^<]*)</title>", re.I)
        subtitle_re = re.compile(r"<sub-title[^>]*>([^<]*)</sub-title>", re.I)
        category_re = re.compile(r"<category[^>]*>([^<]*)</category>", re.I)
        date_re = re.compile(r"<date[^>]*>([^<]*)</date>", re.I)
        episode_re = re.compile(r'<episode-num(?:\s+system="([^"]*)")?>([^<]*)</episode-num>', re.I)

        for attrs_blob, body in prog_re.findall(text):
            attrs = dict(attr_re.findall(attrs_blob))
            feed_ch = (attrs.get("channel") or "").strip()
            if feed_ch not in lookup_ids:
                continue

            start_dt = self._parse_xmltv_dt(attrs.get("start", ""))
            stop_dt = self._parse_xmltv_dt(attrs.get("stop", ""))
            if not start_dt or not stop_dt:
                continue

            start_ts = start_dt.timestamp()
            stop_ts = stop_dt.timestamp()
            if stop_ts <= window_start or start_ts >= window_end:
                continue

            title_m = title_re.search(body)
            title = html.unescape((title_m.group(1) if title_m else "")).strip()
            if not title:
                continue

            subtitle_m = subtitle_re.search(body)
            subtitle = html.unescape((subtitle_m.group(1) if subtitle_m else "")).strip()
            categories = tuple(
                html.unescape(m).strip() for m in category_re.findall(body) if html.unescape(m).strip()
            )
            category = categories[0] if categories else ""
            date_m = date_re.search(body)
            year = self._parse_year(date_m.group(1) if date_m else "")
            episode_label = ""
            season = None
            episode = None
            for _system, ep_text in episode_re.findall(body):
                ep = self._parse_episode_num(ep_text)
                if ep["episode_label"] or ep["season"] or ep["episode"]:
                    episode_label = ep["episode_label"]
                    season = ep["season"]
                    episode = ep["episode"]
                    break

            playlist_id = remap.get(feed_ch, feed_ch)
            dedupe_key = (playlist_id, start_ts, title)
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            out.setdefault(playlist_id, []).append(
                Programme(
                    title=title,
                    start_ts=start_ts,
                    stop_ts=stop_ts,
                    category=category,
                    subtitle=subtitle,
                    year=year,
                    season=season,
                    episode=episode,
                    episode_label=episode_label,
                    categories=categories,
                )
            )

    def _rebuild_programme_index(self, raw: dict[str, list[Programme]]):
        indexed: dict[str, list[Programme]] = {}
        proven: set[str] = set()
        for tvg_id, rows in raw.items():
            if not rows:
                continue
            rows.sort(key=lambda r: r.start_ts)
            indexed[tvg_id] = rows
            proven.add(tvg_id)
        self._programmes_by_channel = indexed
        self._proven_tvg_ids = proven

    def _save_programme_cache(self):
        try:
            payload = {
                "v": 2,
                "saved_at": time.time(),
                "programmes": {
                    tvg_id: [p.to_dict() for p in rows]
                    for tvg_id, rows in self._programmes_by_channel.items()
                },
            }
            EPG_PROGRAMME_CACHE.write_bytes(gzip.compress(json.dumps(payload).encode("utf-8"), compresslevel=5))
        except Exception:
            pass

    def _load_programme_cache_if_fresh(self, now: float) -> bool:
        try:
            if not EPG_PROGRAMME_CACHE.exists():
                return False
            age = now - EPG_PROGRAMME_CACHE.stat().st_mtime
            if age > self.refresh_seconds:
                return False
            payload = json.loads(gzip.decompress(EPG_PROGRAMME_CACHE.read_bytes()).decode("utf-8"))
            raw: dict[str, list[Programme]] = {}
            for tvg_id, rows in (payload.get("programmes") or {}).items():
                parsed: list[Programme] = []
                for row in rows:
                    prog = Programme.from_dict(row)
                    if prog:
                        parsed.append(prog)
                if parsed:
                    raw[tvg_id] = parsed
            self._rebuild_programme_index(raw)
            self._last_refresh = now
            self._epg_ready = True
            self._last_refresh_meta = {
                "loaded_from_cache": True,
                "proven_channels": len(self._proven_tvg_ids),
                "mapped_tvg_ids": len(self._wanted_tvg_ids),
            }
            return True
        except Exception:
            return False

    def ensure_refresh_async(self):
        if self.disabled:
            return
        now = time.time()
        if self._epg_ready and (now - self._last_refresh) < self.refresh_seconds:
            self._refreshing = False
            return
        if self._refreshing:
            return

        def _run():
            try:
                self.refresh()
            except Exception:
                self._refreshing = False

        self._refreshing = True
        threading.Thread(target=_run, daemon=True).start()

    def refresh(self):
        if self.disabled:
            self._refreshing = False
            return
        if self._refresh_lock.locked():
            return
        with self._refresh_lock:
            now = time.time()
            if self._epg_ready and (now - self._last_refresh) < self.refresh_seconds:
                self._refreshing = False
                return
            if not self._epg_ready and self._load_programme_cache_if_fresh(now):
                # Overlay live Pluto timelines even when programmes load from disk cache
                # (WOFTV name-match can be region-wrong for plu-* streams).
                try:
                    merged = {
                        tvg: list(rows)
                        for tvg, rows in self._programmes_by_channel.items()
                    }
                    seen: set[tuple[str, float, str]] = set()
                    for tvg, rows in merged.items():
                        for p in rows:
                            seen.add((tvg, p.start_ts, p.title))
                    ws, we = self._window_bounds()
                    pluto_meta = self._merge_pluto_fast(merged, seen, ws, we)
                    epgpw_meta = self._merge_epgpw_fast(merged, seen, ws, we)
                    if pluto_meta.get("matched") or epgpw_meta.get("matched"):
                        self._rebuild_programme_index(merged)
                        self._save_programme_cache()
                    meta = dict(self._last_refresh_meta or {})
                    meta["pluto"] = pluto_meta
                    meta["epgpw"] = epgpw_meta
                    self._last_refresh_meta = meta
                except Exception:
                    pass
                self._refreshing = False
                return

            if not self._wanted_tvg_ids and self._catalog_ids:
                self.set_catalog(self._catalog_ids)
            # woftv lite needs freetv:* / iptv:* FAST rows (may have empty wanted XMLTV ids)
            has_fast = any(
                str(cid).startswith(("freetv:", "iptv:")) for cid, _ in self._catalog_ids
            )
            has_epgpw_map = False
            try:
                from StepDaddyLiveHD.supplements import epgpw_epg as _epgpw_chk

                has_epgpw_map = bool(_epgpw_chk.ENABLED and _epgpw_chk.load_channel_map())
            except Exception:
                has_epgpw_map = False
            if not self._wanted_tvg_ids and not (self.woftv_lite and has_fast) and not has_epgpw_map:
                self._refreshing = False
                return

            lookup_ids, remap = self.mapper.expand_lookup_ids(self._wanted_tvg_ids)
            window_start, window_end = self._window_bounds()
            merged: dict[str, list[Programme]] = {}
            seen: set[tuple[str, float, str]] = set()
            feeds_ok = 0

            for url in self.epg_urls:
                try:
                    xml_bytes = self._download_xml_bytes(url, max_bytes=self.heavy_max_mb * 1024 * 1024)
                    self._parse_feed_into(xml_bytes, lookup_ids, remap, window_start, window_end, merged, seen)
                    feeds_ok += 1
                except Exception:
                    continue

            woftv_meta = self._merge_woftv_fast(merged, seen, window_start, window_end)
            # Pluto live API wins over WOFTV name-match (fixes UK vs US Thrillers etc.).
            pluto_meta = self._merge_pluto_fast(merged, seen, window_start, window_end)
            # epg.pw fills DDL gaps (e.g. 5 USA) via per-channel JSON — not full dumps.
            epgpw_meta = self._merge_epgpw_fast(merged, seen, window_start, window_end)

            self._rebuild_programme_index(merged)
            self._last_refresh = now
            self._epg_ready = (
                feeds_ok > 0
                or bool(self._proven_tvg_ids)
                or bool(woftv_meta.get("matched"))
                or bool(pluto_meta.get("matched"))
                or bool(epgpw_meta.get("matched"))
            )
            self._save_programme_cache()
            self._last_refresh_meta = {
                "loaded_from_cache": False,
                "feeds_ok": feeds_ok,
                "feeds_total": len(self.epg_urls),
                "proven_channels": len(self._proven_tvg_ids),
                "mapped_tvg_ids": len(self._wanted_tvg_ids),
                "lookup_ids": len(lookup_ids),
                "window_hours": self.schedule_hours,
                "woftv": woftv_meta,
                "pluto": pluto_meta,
                "epgpw": epgpw_meta,
                "woftv_lite": bool(self.woftv_lite),
            }
            self._refreshing = False
            cb = self.on_refresh_done
            if callable(cb):
                try:
                    cb()
                except Exception:
                    pass

    def _merge_woftv_fast(
        self,
        merged: dict[str, list[Programme]],
        seen: set[tuple[str, float, str]],
        window_start: float,
        window_end: float,
    ) -> dict:
        """Merge WhatsOnFreeTV GitHub JSON onto freetv:* and FAST iptv:* catalog rows."""
        meta: dict = {
            "matched": 0,
            "programmes": 0,
            "skipped": 0,
            "enabled": False,
            "by_platform": {},
        }
        try:
            from StepDaddyLiveHD.supplements import woftv_epg
        except Exception:
            return meta
        if not woftv_epg.ENABLED:
            return meta
        meta["enabled"] = True
        try:
            by_platform, flat = woftv_epg.load_programmes_by_platform()
        except Exception as exc:
            meta["error"] = str(exc)[:160]
            return meta
        if not flat:
            return meta

        catalog_meta: dict[str, dict] = {}
        try:
            from StepDaddyLiveHD.supplements import get_catalog
            from StepDaddyLiveHD.supplements import pluto_epg as _pluto_epg

            for sch in get_catalog().list_channels():
                if not (sch.id.startswith("freetv:") or sch.id.startswith("iptv:")):
                    continue
                hint = None
                for tag in sch.tags or []:
                    resolved = woftv_epg.resolve_woftv_platform(str(tag))
                    if resolved:
                        hint = resolved
                        break
                if not hint and sch.group_title:
                    hint = woftv_epg.resolve_woftv_platform(sch.group_title)
                catalog_meta[sch.id] = {
                    "tvg_id": str(sch.tvg_id).strip() if sch.tvg_id else None,
                    "platform_hint": hint,
                    "name": sch.name,
                    # Skip US-centric WOFTV only for clearly non-US Pluto regional feeds.
                    "skip_woftv": bool(
                        _pluto_epg.extract_pluto_id(sch.upstream_url)
                        and _pluto_epg.is_non_us_tvg(sch.tvg_id)
                    ),
                }
        except Exception:
            catalog_meta = {}

        target_rows = [
            (cid, name)
            for cid, name in self._catalog_ids
            if str(cid).startswith(("freetv:", "iptv:"))
        ]
        for cid, _name in target_rows:
            self._match_cache.pop(f"id:{cid}", None)

        for cid, name in target_rows:
            cm = catalog_meta.get(cid) or {}
            if cm.get("skip_woftv"):
                meta["skipped"] += 1
                continue
            platform_hint = cm.get("platform_hint")
            key, plat = woftv_epg.best_match_platform(
                name, by_platform, flat, platform_hint=platform_hint
            )
            if not key:
                meta["skipped"] += 1
                continue
            index = by_platform.get(plat or "", {}) if plat else {}
            rows = index.get(key) if index else None
            if not rows:
                rows = flat.get(key) or []
            if not rows:
                meta["skipped"] += 1
                continue

            existing = self.mapper.map_channel_by_id(cid, name)
            tvg_id = cm.get("tvg_id") or existing.tvg_id
            if not tvg_id:
                tvg_id = f"woftv:{key.replace(' ', '.')}"
            self.mapper._by_channel_id[str(cid)] = tvg_id
            self._match_cache[f"id:{cid}"] = EpgMatch(tvg_id, 0.95, "woftv_fast")
            self._wanted_tvg_ids.add(tvg_id)

            added = 0
            for row in rows:
                start_ts = float(row["start"])
                stop_ts = float(row["stop"])
                if stop_ts <= window_start or start_ts >= window_end:
                    continue
                title = str(row["title"])
                dedupe = (tvg_id, start_ts, title)
                if dedupe in seen:
                    continue
                if any(
                    abs(p.start_ts - start_ts) < 60 and p.title
                    for p in merged.get(tvg_id, [])
                ):
                    continue
                seen.add(dedupe)
                cat = str(row.get("category") or plat or "FreeTV")
                try:
                    from StepDaddyLiveHD.supplements.episode_meta import enrich_programme_row

                    enrich_programme_row(row)
                except Exception:
                    pass
                season_raw = row.get("season")
                episode_raw = row.get("episode")
                try:
                    season = int(season_raw) if season_raw not in (None, "") else None
                except (TypeError, ValueError):
                    season = None
                try:
                    episode = int(episode_raw) if episode_raw not in (None, "") else None
                except (TypeError, ValueError):
                    episode = None
                merged.setdefault(tvg_id, []).append(
                    Programme(
                        title=title,
                        start_ts=start_ts,
                        stop_ts=stop_ts,
                        category=cat,
                        subtitle=str(row.get("subtitle") or ""),
                        season=season,
                        episode=episode,
                        episode_label=str(row.get("episode_label") or "").strip(),
                        categories=(cat,),
                    )
                )
                added += 1
            if added:
                meta["matched"] += 1
                meta["programmes"] += added
                plat_key = plat or "unknown"
                bucket = meta["by_platform"].setdefault(
                    plat_key, {"matched": 0, "programmes": 0}
                )
                bucket["matched"] += 1
                bucket["programmes"] += added
        return meta

    def _merge_woftv_freetv(
        self,
        merged: dict[str, list[Programme]],
        seen: set[tuple[str, float, str]],
        window_start: float,
        window_end: float,
    ) -> dict:
        """Backward-compatible alias → FAST merge (freetv + iptv platforms)."""
        return self._merge_woftv_fast(merged, seen, window_start, window_end)

    def _merge_pluto_fast(
        self,
        merged: dict[str, list[Programme]],
        seen: set[tuple[str, float, str]],
        window_start: float,
        window_end: float,
    ) -> dict:
        """Prefer Pluto API for regional / duplicate-name plu-* streams (not all 500+)."""
        meta: dict = {"matched": 0, "programmes": 0, "skipped": 0, "enabled": False}
        try:
            from StepDaddyLiveHD.supplements import pluto_epg
        except Exception:
            return meta
        if not pluto_epg.ENABLED:
            return meta
        meta["enabled"] = True

        targets: list[tuple[str, str, str]] = []  # cid, tvg_id, pluto_id
        try:
            from StepDaddyLiveHD.supplements import get_catalog
            from collections import Counter

            cat = get_catalog()
            # Never asyncio.run() here — startup may already own the event loop
            # (deadlocks the gateway before uvicorn binds).
            if not cat.list_channels():
                meta["catalog_empty"] = True

            pluto_rows: list[tuple[str, str, str, str]] = []  # cid, name, tvg, pid
            for sch in cat.list_channels():
                if not (sch.id.startswith("freetv:") or sch.id.startswith("iptv:")):
                    continue
                pid = pluto_epg.extract_pluto_id(sch.upstream_url)
                if not pid:
                    continue
                existing = self.mapper.map_channel_by_id(sch.id, sch.name)
                tvg_id = (sch.tvg_id or existing.tvg_id or "").strip() or f"pluto:{pid}"
                pluto_rows.append((str(sch.id), sch.name or "", tvg_id, pid))

            name_counts = Counter(pluto_epg.norm_channel_name(n) for _, n, _, _ in pluto_rows)
            for cid, name, tvg_id, pid in pluto_rows:
                needs = pluto_epg.is_non_us_tvg(tvg_id) or name_counts[pluto_epg.norm_channel_name(name)] > 1
                if not needs:
                    meta["skipped"] += 1
                    continue
                targets.append((cid, tvg_id, pid))
        except Exception as exc:
            meta["error"] = str(exc)[:160]
            return meta

        meta["pluto_targets"] = len(targets)
        if not targets:
            return meta

        # Cap refresh-time fetches; remainder is filled lazily via get_now_next.
        max_refresh = int(__import__("os").environ.get("PLUTO_EPG_REFRESH_MAX", "80"))
        fetch_targets = targets[: max(1, max_refresh)]
        meta["pluto_fetch"] = len(fetch_targets)

        by_pid = pluto_epg.load_programmes_for_ids(
            [pid for _, _, pid in fetch_targets],
            window_start=window_start,
            window_end=window_end,
        )
        replaced_tvg: set[str] = set()
        for cid, tvg_id, pid in fetch_targets:
            rows = by_pid.get(pid) or []
            if not rows:
                meta["skipped"] += 1
                continue
            self._apply_pluto_rows(merged, seen, cid, tvg_id, rows, window_start, window_end, replaced_tvg)
            meta["matched"] += 1
            meta["programmes"] += len(merged.get(tvg_id) or [])
        # Remember pluto id mapping for lazy fetch even if not fetched yet.
        for cid, tvg_id, pid in targets:
            self.mapper._by_channel_id[cid] = tvg_id
            self._match_cache[f"id:{cid}"] = EpgMatch(tvg_id, 0.98, "pluto_live")
            self._wanted_tvg_ids.add(tvg_id)
            self._pluto_id_by_tvg[tvg_id] = pid
            self._pluto_id_by_channel[cid] = pid
        return meta

    def _apply_pluto_rows(
        self,
        merged: dict[str, list[Programme]],
        seen: set[tuple[str, float, str]],
        cid: str,
        tvg_id: str,
        rows: list[dict],
        window_start: float,
        window_end: float,
        replaced_tvg: set[str] | None = None,
    ) -> int:
        if replaced_tvg is None:
            replaced_tvg = set()
        self.mapper._by_channel_id[cid] = tvg_id
        self._match_cache[f"id:{cid}"] = EpgMatch(tvg_id, 0.98, "pluto_live")
        self._wanted_tvg_ids.add(tvg_id)
        if tvg_id not in replaced_tvg:
            for old in list(merged.get(tvg_id) or []):
                seen.discard((tvg_id, old.start_ts, old.title))
            merged[tvg_id] = []
            replaced_tvg.add(tvg_id)
        added = 0
        for row in rows:
            start_ts = float(row["start"])
            stop_ts = float(row["stop"])
            if stop_ts <= window_start or start_ts >= window_end:
                continue
            title = str(row["title"])
            dedupe = (tvg_id, start_ts, title)
            if dedupe in seen:
                continue
            seen.add(dedupe)
            cat = str(row.get("category") or "Pluto TV").strip() or "Pluto TV"
            year_raw = row.get("year")
            try:
                year = int(year_raw) if year_raw not in (None, "") else None
            except (TypeError, ValueError):
                year = None
            try:
                from StepDaddyLiveHD.supplements.episode_meta import enrich_programme_row

                enrich_programme_row(row)
            except Exception:
                pass
            season_raw = row.get("season")
            episode_raw = row.get("episode")
            try:
                season = int(season_raw) if season_raw not in (None, "") else None
            except (TypeError, ValueError):
                season = None
            try:
                episode = int(episode_raw) if episode_raw not in (None, "") else None
            except (TypeError, ValueError):
                episode = None
            merged.setdefault(tvg_id, []).append(
                Programme(
                    title=title,
                    start_ts=start_ts,
                    stop_ts=stop_ts,
                    category=cat,
                    subtitle=str(row.get("subtitle") or ""),
                    year=year,
                    season=season,
                    episode=episode,
                    episode_label=str(row.get("episode_label") or "").strip(),
                    categories=(cat,),
                    poster_url=str(row.get("poster_url") or "").strip(),
                    backdrop_url=str(row.get("backdrop_url") or "").strip(),
                )
            )
            added += 1
        return added

    def _ensure_pluto_for_tvg(self, tvg_id: str | None, channel_id: str | None = None) -> bool:
        """Lazy single-channel Pluto timeline fetch into the live index."""
        if not tvg_id:
            return False
        try:
            from StepDaddyLiveHD.supplements import pluto_epg, get_catalog
        except Exception:
            return False
        if not pluto_epg.ENABLED:
            return False
        pid = self._pluto_id_by_tvg.get(tvg_id) or self._pluto_id_by_channel.get(str(channel_id or ""))
        if not pid and channel_id:
            sch = get_catalog().get(str(channel_id))
            if sch:
                pid = pluto_epg.extract_pluto_id(sch.upstream_url)
                if pid:
                    self._pluto_id_by_channel[str(channel_id)] = pid
                    self._pluto_id_by_tvg[tvg_id] = pid
        if not pid:
            return False
        # Skip if we already have a current programme from a prior Pluto fill.
        arr = self._programmes_by_channel.get(tvg_id) or []
        now_ts = datetime.now(timezone.utc).timestamp()
        if any(p.start_ts <= now_ts < p.stop_ts for p in arr) and getattr(self, "_pluto_filled_tvg", None) and tvg_id in self._pluto_filled_tvg:
            return False
        ws, we = self._window_bounds()
        by_pid = pluto_epg.load_programmes_for_ids([pid], window_start=ws, window_end=we)
        rows = by_pid.get(pid) or []
        if not rows:
            return False
        merged = {k: list(v) for k, v in self._programmes_by_channel.items()}
        seen: set[tuple[str, float, str]] = set()
        for tvg, progs in merged.items():
            for p in progs:
                seen.add((tvg, p.start_ts, p.title))
        cid = str(channel_id or "")
        self._apply_pluto_rows(merged, seen, cid or f"pluto:{pid}", tvg_id, rows, ws, we)
        self._rebuild_programme_index(merged)
        self._pluto_filled_tvg.add(tvg_id)
        return True

    def _merge_epgpw_fast(
        self,
        merged: dict[str, list[Programme]],
        seen: set[tuple[str, float, str]],
        window_start: float,
        window_end: float,
    ) -> dict:
        """Fill DDL / mapped gaps from epg.pw per-channel JSON (never full dumps)."""
        meta: dict = {
            "matched": 0,
            "programmes": 0,
            "skipped": 0,
            "enabled": False,
            "auto_matched": 0,
            "mapped": 0,
        }
        try:
            from StepDaddyLiveHD.supplements import epgpw_epg
        except Exception:
            return meta
        if not epgpw_epg.ENABLED:
            return meta
        meta["enabled"] = True

        cmap = epgpw_epg.load_channel_map()
        # Auto-match confirmed-region DDL gaps (GB/US/CA) that still lack programmes.
        try:
            gap_rows: list[tuple] = []
            for cid, name in self._catalog_ids:
                if not str(cid).isdigit():
                    continue
                match = self.map_channel_by_id(cid, name)
                tvg = match.tvg_id
                if tvg and merged.get(tvg):
                    continue
                tags = getattr(self, "_catalog_tags", {}).get(str(cid)) or []
                gap_rows.append((cid, name, tvg, tags))
            gaps = epgpw_epg.region_candidates_from_catalog(gap_rows)
            meta["region_candidates"] = len(gaps)
            by_region: dict[str, int] = {}
            for *_rest, region in gaps:
                by_region[region] = by_region.get(region, 0) + 1
            meta["confirmed_by_region"] = by_region
            auto = epgpw_epg.auto_match_gaps(gaps, existing_map=cmap)
            if auto:
                meta["auto_matched"] = len(auto)
                auto_regions: dict[str, int] = {}
                for info in auto.values():
                    cc = str(info.get("country") or "?")
                    auto_regions[cc] = auto_regions.get(cc, 0) + 1
                meta["auto_by_region"] = auto_regions
                cmap = epgpw_epg.load_channel_map()
            try:
                from StepDaddyLiveHD.supplements import epgpw_region as _reg

                meta["ambiguous_samples"] = _reg.ambiguous_unmapped_samples(
                    gap_rows, set(epgpw_epg.gateway_to_epg_ids(cmap)), limit=25
                )
            except Exception:
                pass
        except Exception as exc:
            meta["auto_error"] = str(exc)[:160]

        meta["mapped"] = len(cmap)
        meta["feeds"] = sorted(
            set(epgpw_epg.mapped_countries(cmap))
            | set((meta.get("confirmed_by_region") or {}).keys())
        )
        if not cmap:
            return meta

        # Resolve tvg_id for each map entry.
        targets: list[tuple[str, str, str, str]] = []  # gateway_id, tvg_id, epg_cid, source
        for epg_cid, info in cmap.items():
            tvg_hint = (info.get("tvg_id") or "").strip() or None
            source = str(info.get("source") or "map")
            for gid in info.get("channel_ids") or []:
                name = next((n for c, n in self._catalog_ids if str(c) == str(gid)), info.get("name") or "")
                existing = self.mapper.map_channel_by_id(str(gid), name or "")
                # Authoritative android remaps win over stale epgpw auto tvg_hints
                # (20260908c: auto had pinned 371→MTVLive.us after map moved to MTV.us).
                auth = AUTHORITATIVE_ID_MAPPINGS.get(str(gid))
                if auth:
                    tvg_id = auth
                elif source == "auto" and existing.tvg_id:
                    tvg_id = existing.tvg_id
                else:
                    tvg_id = tvg_hint or existing.tvg_id or f"epgpw:{epg_cid}"
                has_real = any(
                    p.title and str(p.title).strip().upper() not in ("LIVE", "")
                    for p in (merged.get(tvg_id) or [])
                )
                # Explicit maps (file/env/default) fill gaps; auto skips if already titled.
                if has_real and source == "auto":
                    meta["skipped"] += 1
                    continue
                targets.append((str(gid), tvg_id, str(epg_cid), source))

        meta["targets"] = len(targets)
        if not targets:
            return meta

        by_epg = epgpw_epg.load_programmes_for_ids(
            [t[2] for t in targets],
            window_start=window_start,
            window_end=window_end,
            channel_map=cmap,
        )
        replaced: set[str] = set()
        for gid, tvg_id, epg_cid, _source in targets:
            rows = by_epg.get(epg_cid) or []
            self._epgpw_id_by_channel[gid] = epg_cid
            self._epgpw_id_by_tvg[tvg_id] = epg_cid
            self.mapper._by_channel_id[gid] = tvg_id
            self._match_cache[f"id:{gid}"] = EpgMatch(tvg_id, 0.97, "epgpw")
            self._wanted_tvg_ids.add(tvg_id)
            if not rows:
                meta["skipped"] += 1
                continue
            added = self._apply_epgpw_rows(
                merged, seen, gid, tvg_id, rows, window_start, window_end, replaced
            )
            if added:
                meta["matched"] += 1
                meta["programmes"] += added
        return meta

    def _apply_epgpw_rows(
        self,
        merged: dict[str, list[Programme]],
        seen: set[tuple[str, float, str]],
        cid: str,
        tvg_id: str,
        rows: list[dict],
        window_start: float,
        window_end: float,
        replaced_tvg: set[str] | None = None,
    ) -> int:
        if replaced_tvg is None:
            replaced_tvg = set()
        self.mapper._by_channel_id[cid] = tvg_id
        self._match_cache[f"id:{cid}"] = EpgMatch(tvg_id, 0.97, "epgpw")
        self._wanted_tvg_ids.add(tvg_id)
        if tvg_id not in replaced_tvg:
            for old in list(merged.get(tvg_id) or []):
                seen.discard((tvg_id, old.start_ts, old.title))
            merged[tvg_id] = []
            replaced_tvg.add(tvg_id)
        added = 0
        for row in rows:
            start_ts = float(row["start"])
            stop_ts = float(row["stop"])
            if stop_ts <= window_start or start_ts >= window_end:
                continue
            title = str(row["title"])
            dedupe = (tvg_id, start_ts, title)
            if dedupe in seen:
                continue
            seen.add(dedupe)
            cat = str(row.get("category") or "EPG").strip() or "EPG"
            try:
                from StepDaddyLiveHD.supplements.episode_meta import enrich_programme_row

                enrich_programme_row(row)
            except Exception:
                pass
            season_raw = row.get("season")
            episode_raw = row.get("episode")
            try:
                season = int(season_raw) if season_raw not in (None, "") else None
            except (TypeError, ValueError):
                season = None
            try:
                episode = int(episode_raw) if episode_raw not in (None, "") else None
            except (TypeError, ValueError):
                episode = None
            merged.setdefault(tvg_id, []).append(
                Programme(
                    title=title,
                    start_ts=start_ts,
                    stop_ts=stop_ts,
                    category=cat,
                    subtitle=str(row.get("subtitle") or ""),
                    season=season,
                    episode=episode,
                    episode_label=str(row.get("episode_label") or "").strip(),
                    categories=(cat,),
                )
            )
            added += 1
        return added

    def _ensure_epgpw_for_tvg(self, tvg_id: str | None, channel_id: str | None = None) -> bool:
        if not tvg_id and not channel_id:
            return False
        try:
            from StepDaddyLiveHD.supplements import epgpw_epg
        except Exception:
            return False
        if not epgpw_epg.ENABLED:
            return False
        epg_cid = None
        if tvg_id:
            epg_cid = self._epgpw_id_by_tvg.get(tvg_id)
        if not epg_cid and channel_id:
            epg_cid = self._epgpw_id_by_channel.get(str(channel_id))
        if not epg_cid and channel_id:
            gmap = epgpw_epg.gateway_to_epg_ids()
            epg_cid = gmap.get(str(channel_id))
            if epg_cid and tvg_id:
                self._epgpw_id_by_channel[str(channel_id)] = epg_cid
                self._epgpw_id_by_tvg[tvg_id] = epg_cid
        if not epg_cid:
            return False
        use_tvg = tvg_id or f"epgpw:{epg_cid}"
        arr = self._programmes_by_channel.get(use_tvg) or []
        now_ts = datetime.now(timezone.utc).timestamp()
        if any(p.start_ts <= now_ts < p.stop_ts for p in arr) and use_tvg in self._epgpw_filled_tvg:
            return False
        ws, we = self._window_bounds()
        by_id = epgpw_epg.load_programmes_for_ids([epg_cid], window_start=ws, window_end=we)
        rows = by_id.get(epg_cid) or []
        if not rows:
            return False
        merged = {k: list(v) for k, v in self._programmes_by_channel.items()}
        seen: set[tuple[str, float, str]] = set()
        for tvg, progs in merged.items():
            for p in progs:
                seen.add((tvg, p.start_ts, p.title))
        cid = str(channel_id or "")
        self._apply_epgpw_rows(merged, seen, cid or f"epgpw:{epg_cid}", use_tvg, rows, ws, we)
        self._rebuild_programme_index(merged)
        self._epgpw_filled_tvg.add(use_tvg)
        return True

    def has_programme_data(self, tvg_id: str | None) -> bool:
        if not tvg_id:
            return False
        return tvg_id in self._proven_tvg_ids

    def _ram_has_current(self, tvg_id: str | None) -> bool:
        if not tvg_id:
            return False
        arr = self._programmes_by_channel.get(tvg_id) or []
        if not arr:
            return False
        now_ts = datetime.now(timezone.utc).timestamp()
        return any(p.start_ts <= now_ts < p.stop_ts for p in arr)

    def _ram_has_programmes(self, tvg_id: str | None) -> bool:
        if not tvg_id:
            return False
        return bool(self._programmes_by_channel.get(tvg_id))

    def may_need_live_fill(self, tvg_id: str | None, channel_id: str | None = None) -> bool:
        """True when RAM is empty/stale but Pluto or epg.pw might still fill."""
        if self.disabled:
            return False
        if self._ram_has_current(tvg_id):
            return False
        key = f"{channel_id or ''}|{tvg_id or ''}"
        with self._gap_fill_lock:
            if key in self._gap_fill_attempted or key in self._gap_fill_queued:
                return False
        if tvg_id and tvg_id in getattr(self, "_epgpw_filled_tvg", set()):
            return False
        if tvg_id and tvg_id in getattr(self, "_pluto_filled_tvg", set()):
            return False
        cid = str(channel_id or "")
        if cid and cid in self._pluto_id_by_channel:
            return True
        if tvg_id and tvg_id in self._pluto_id_by_tvg:
            return True
        if cid and cid in self._epgpw_id_by_channel:
            return True
        if tvg_id and tvg_id in self._epgpw_id_by_tvg:
            return True
        # Mapped epg.pw gateway ids can still be warm-miss on first hit.
        try:
            from StepDaddyLiveHD.supplements import epgpw_epg

            if epgpw_epg.ENABLED and cid:
                gmap = epgpw_epg.gateway_to_epg_ids()
                if cid in gmap:
                    return True
        except Exception:
            pass
        if tvg_id and str(tvg_id).startswith(("pluto:", "epgpw:")):
            return True
        return False

    def _apply_live_fills(self, tvg_id: str | None, channel_id: str | None = None) -> None:
        if channel_id or tvg_id:
            try:
                self._ensure_pluto_for_tvg(tvg_id, channel_id)
            except Exception:
                pass
            try:
                self._ensure_epgpw_for_tvg(tvg_id, channel_id)
            except Exception:
                pass

    def queue_live_fill(self, channel_id: str | None, tvg_id: str | None) -> bool:
        """Enqueue Pluto/epg.pw fill off the request path. Returns True if queued."""
        if not self.may_need_live_fill(tvg_id, channel_id):
            return False
        key = f"{channel_id or ''}|{tvg_id or ''}"
        with self._gap_fill_lock:
            if key in self._gap_fill_attempted or key in self._gap_fill_queued:
                return False
            self._gap_fill_queued.add(key)
            alive = self._gap_fill_worker is not None and self._gap_fill_worker.is_alive()
            if alive:
                return True

            def _worker():
                while True:
                    with self._gap_fill_lock:
                        if not self._gap_fill_queued:
                            self._gap_fill_worker = None
                            if self._gap_fill_queued:
                                t = threading.Thread(
                                    target=_worker, daemon=True, name="epg-gap-fill"
                                )
                                self._gap_fill_worker = t
                                t.start()
                            return
                        next_key = next(iter(self._gap_fill_queued))
                        self._gap_fill_queued.discard(next_key)
                        self._gap_fill_attempted.add(next_key)
                    try:
                        parts = next_key.split("|", 1)
                        cid = parts[0] if parts else ""
                        tvg = parts[1] if len(parts) > 1 else ""
                        self._apply_live_fills(tvg or None, cid or None)
                    except Exception:
                        pass

            t = threading.Thread(target=_worker, daemon=True, name="epg-gap-fill")
            self._gap_fill_worker = t
            t.start()
        return True

    def get_now_next(
        self,
        tvg_id: str,
        channel_id: str | None = None,
        *,
        allow_live_fill: bool = True,
    ):
        self.ensure_refresh_async()
        if allow_live_fill:
            self._apply_live_fills(tvg_id, channel_id)
        if not tvg_id or tvg_id not in self._proven_tvg_ids:
            return {"now": None, "next": None}
        arr = self._programmes_by_channel.get(tvg_id) or []
        if not arr:
            return {"now": None, "next": None}

        now_ts = datetime.now(timezone.utc).timestamp()
        starts = [x.start_ts for x in arr]
        i = bisect.bisect_right(starts, now_ts) - 1
        current = None
        nxt = None

        if 0 <= i < len(arr):
            prog = arr[i]
            if prog.start_ts <= now_ts < prog.stop_ts:
                current = self._programme_to_api(prog)
                if i + 1 < len(arr):
                    nxt = self._programme_to_api(arr[i + 1])
                return {"now": current, "next": nxt}

        j = max(i + 1, 0)
        if j < len(arr):
            nxt = self._programme_to_api(arr[j])
        return {"now": current, "next": nxt}

    def get_schedule(
        self,
        tvg_id: str,
        hours: int | None = None,
        channel_id: str | None = None,
        *,
        allow_live_fill: bool = True,
    ) -> list[dict]:
        self.ensure_refresh_async()
        if allow_live_fill:
            self._apply_live_fills(tvg_id, channel_id)
        if not tvg_id or tvg_id not in self._proven_tvg_ids:
            return []
        hours = hours or self.schedule_hours
        now = datetime.now(timezone.utc)
        window_start = (now - timedelta(minutes=self.schedule_past_minutes)).timestamp()
        window_end = (now + timedelta(hours=hours)).timestamp()
        out = []
        for prog in self._programmes_by_channel.get(tvg_id, []):
            if prog.stop_ts <= window_start or prog.start_ts >= window_end:
                continue
            out.append(self._programme_to_api(prog, allow_network=False))
        return out

    def get_upcoming_events(self, hours: int = 24, limit: int = 300):
        self.ensure_refresh_async()
        now = datetime.now(timezone.utc).timestamp()
        cutoff = now + hours * 3600
        events = []
        for tvg_id, rows in self._programmes_by_channel.items():
            for prog in rows:
                if prog.start_ts < now or prog.start_ts > cutoff:
                    continue
                item = self._programme_to_api(prog, allow_network=False)
                item["channel"] = tvg_id
                events.append(item)
        events.sort(key=lambda e: e["start"])
        return events[:limit]

    def build_filtered_epg_xml(self, tvg_ids: set[str]) -> str:
        self.ensure_refresh_async()
        root = ET.Element("tv")
        for tvg_id in sorted(tvg_ids):
            if tvg_id not in self._proven_tvg_ids:
                continue
            ch = ET.SubElement(root, "channel", id=tvg_id)
            ET.SubElement(ch, "display-name").text = tvg_id
            for prog in self._programmes_by_channel.get(tvg_id, []):
                start = datetime.fromtimestamp(prog.start_ts, timezone.utc).strftime("%Y%m%d%H%M%S +0000")
                stop = datetime.fromtimestamp(prog.stop_ts, timezone.utc).strftime("%Y%m%d%H%M%S +0000")
                node = ET.SubElement(root, "programme", start=start, stop=stop, channel=tvg_id)
                ET.SubElement(node, "title").text = prog.title
                if prog.subtitle:
                    ET.SubElement(node, "sub-title").text = prog.subtitle
                if prog.category:
                    ET.SubElement(node, "category").text = prog.category
                if prog.year:
                    ET.SubElement(node, "date").text = str(prog.year)
                if prog.episode_label:
                    ET.SubElement(node, "episode-num").text = prog.episode_label
        return ET.tostring(root, encoding="unicode")

    def proven_tvg_ids(self) -> list[str]:
        return sorted(self._proven_tvg_ids)

    @property
    def xml(self):
        """Legacy compatibility — filtered XML not kept as full tree in rewrite."""
        return self.build_filtered_epg_xml(self._proven_tvg_ids)

    def debug_refresh_meta(self):
        meta = dict(self._last_refresh_meta)
        with self._gap_fill_lock:
            gap_queued = len(self._gap_fill_queued)
            gap_busy = bool(
                self._gap_fill_worker is not None and self._gap_fill_worker.is_alive()
            )
        meta.update(
            {
                "refreshing": self._refreshing,
                "epg_ready": self._epg_ready,
                "indexed_channels": len(self._programmes_by_channel),
                "proven_channels": len(self._proven_tvg_ids),
                "android_mapped_ids": self.mapper.mapped_id_count,
                "catalog_tvg_ids": len(self._wanted_tvg_ids),
                "gap_fill_queued": gap_queued,
                "gap_fill_busy": gap_busy,
            }
        )
        return meta
