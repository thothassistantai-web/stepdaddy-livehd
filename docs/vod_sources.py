"""VOD source catalog — TMDB-ID embed aggregators + HLS resolver hints.

Embed URLs play in the iframe fallback. Providers in HLS_PROVIDER_IDS are
extracted server-side via vod_resolver (CinePro-style). Optional CinePro OMSS
adds an auto-best HLS row when CINEPRO_OMSS_URL is set.

risk tiers:
  preferred — cleaner players / fewer clickjack overlays (try first)
  standard  — common aggregators
  risky     — known for invisible ad layers / popunder redirects
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from StepDaddyLiveHD.vod_resolver import HLS_PROVIDER_IDS

VIDSRC_EMBED_BASE = os.environ.get("VIDSRC_EMBED_BASE", "https://vsembed.ru").rstrip("/")
VIDEASY_PLAYER = os.environ.get("VIDEASY_PLAYER_BASE", "https://player.videasy.net").rstrip("/")
VIDZEE_PLAYER = os.environ.get("VIDZEE_PLAYER_BASE", "https://player.vidzee.wtf").rstrip("/")
SMASHY_EMBED = os.environ.get("SMASHY_EMBED_BASE", "https://embed.smashystream.com").rstrip("/")
VIDSRC_ME = os.environ.get("VIDSRC_ME_BASE", "https://vidsrc.me").rstrip("/")
VIDSRC_ME_RU = os.environ.get("VIDSRC_ME_RU_BASE", "https://vidsrcme.ru").rstrip("/")
VIDSRC_EMBED_RU = os.environ.get("VIDSRC_EMBED_RU_BASE", "https://vidsrc-embed.ru").rstrip("/")
MULTIEMBED = os.environ.get("MULTIEMBED_BASE", "https://multiembed.mov").rstrip("/")


@dataclass(frozen=True)
class VodSource:
    id: str
    name: str
    provider: str
    embed_url: str
    kind: str = "embed"  # embed | hls
    hls_capable: bool = False
    quality_hint: str | None = None
    auto: bool = False
    risk: str = "standard"  # preferred | standard | risky
    languages: tuple[str, ...] = ("en",)  # ISO-ish audio/UI langs this source tends to serve


def _norm_type(media_type: str) -> str:
    t = (media_type or "movie").strip().lower()
    if t in ("series", "tv", "show", "episode"):
        return "tv"
    return "movie"


def _source(
    sid: str,
    name: str,
    provider: str,
    embed_url: str,
    *,
    quality_hint: str | None = None,
    risk: str = "standard",
    languages: tuple[str, ...] = ("en",),
) -> VodSource:
    hls = sid in HLS_PROVIDER_IDS
    return VodSource(
        id=sid,
        name=name,
        provider=provider,
        embed_url=embed_url,
        kind="hls" if hls else "embed",
        hls_capable=hls,
        quality_hint=quality_hint,
        risk=risk,
        languages=languages or ("en",),
    )


def _lang_ok(source: VodSource, prefer: str) -> bool:
    prefer = (prefer or "en").strip().lower()[:5] or "en"
    if prefer in ("any", "*", "all"):
        return True
    langs = [x.lower() for x in (source.languages or ("en",))]
    if prefer in langs or "multi" in langs or "en" in langs and prefer == "en":
        return True
    # Allow unknown/english-first aggregators tagged en
    return prefer == "en" and ("en" in langs or not langs)


def list_sources(
    tmdb_id: int,
    media_type: str = "movie",
    season: int | None = None,
    episode: int | None = None,
    lang: str = "en",
    *,
    include_auto: bool = True,
    prefer_lang: str | None = None,
    include_other_langs: bool = False,
) -> list[VodSource]:
    """Return playable VOD sources for a TMDB id (preferred → standard → risky).

    prefer_lang defaults to lang (usually en). Non-matching sources are omitted
    unless include_other_langs=True (then sorted after English matches).
    """
    if not tmdb_id or int(tmdb_id) <= 0:
        return []

    tid = int(tmdb_id)
    kind = _norm_type(media_type)
    lang = (lang or "en").strip().lower()[:5]
    out: list[VodSource] = []

    if include_auto:
        out.append(
            VodSource(
                id="auto",
                name="Auto · Best direct stream",
                provider="Direct HLS",
                embed_url="",
                kind="hls",
                hls_capable=True,
                quality_hint="1080p",
                auto=True,
                risk="preferred",
            )
        )

    if kind == "movie":
        # Prefer embeds that allow cross-origin iframes. VidZee ships
        # X-Frame-Options: SAMEORIGIN (blank player when framed on our origin).
        preferred = [
            _source(
                "videasy",
                "Videasy",
                "player.videasy.net",
                f"{VIDEASY_PLAYER}/movie/{tid}",
                quality_hint="1080p",
                risk="preferred",
            ),
            _source(
                "smashy",
                "SmashyStream",
                "smashystream.com",
                f"{SMASHY_EMBED}/playere.php?tmdb={tid}",
                risk="preferred",
            ),
            _source(
                "vixsrc",
                "VixSrc",
                "vixsrc.to",
                f"https://vixsrc.to/movie/{tid}?lang={lang}",
                quality_hint="1080p",
                risk="preferred",
            ),
            _source(
                "vidzee",
                "VidZee Player",
                "player.vidzee.wtf",
                f"{VIDZEE_PLAYER}/embed/movie/{tid}",
                # Not frameable in our player — keep listed for Sources / new-tab.
                risk="standard",
            ),
            VodSource(
                id="icefy",
                name="Icefy",
                provider="streams.icefy.top",
                embed_url="",
                kind="hls",
                hls_capable=True,
                quality_hint="1080p",
                risk="preferred",
            ),
            VodSource(
                id="cinesu",
                name="CineSu",
                provider="cine.su",
                embed_url="",
                kind="hls",
                hls_capable=True,
                quality_hint="1080p",
                risk="preferred",
            ),
            VodSource(
                id="vidapi",
                name="VidApi",
                provider="vaplayer.ru",
                embed_url="",
                kind="hls",
                hls_capable=True,
                quality_hint="1080p",
                risk="preferred",
            ),
        ]
        standard = [
            _source(
                "vidsrc",
                "Vidsrc",
                "vsembed.ru",
                f"{VIDSRC_EMBED_BASE}/embed/movie?tmdb={tid}",
            ),
            _source(
                "vidsrcme",
                "Vidsrc.me",
                "vidsrc.me",
                f"{VIDSRC_ME}/embed/movie?tmdb={tid}",
            ),
            _source(
                "vidsrcmeru",
                "VidsrcMe.ru",
                "vidsrcme.ru",
                f"{VIDSRC_ME_RU}/embed/movie?tmdb={tid}",
            ),
            _source(
                "vidsrcembedru",
                "Vidsrc Embed RU",
                "vidsrc-embed.ru",
                f"{VIDSRC_EMBED_RU}/embed/movie/{tid}",
            ),
            _source(
                "vidlink",
                "VidLink",
                "vidlink.pro",
                f"https://vidlink.pro/movie/{tid}",
            ),
            _source(
                "multiembed",
                "MultiEmbed",
                "multiembed.mov",
                f"{MULTIEMBED}/?video_id={tid}&tmdb=1",
            ),
            _source(
                "primesrc",
                "PrimeSrc",
                "primesrc.me",
                f"https://primesrc.me/embed/movie?tmdb={tid}",
            ),
        ]
        risky = [
            _source(
                "2embed",
                "2Embed (ads)",
                "2embed.cc",
                f"https://www.2embed.cc/embed/{tid}",
                risk="risky",
            ),
            _source(
                "2embedskin",
                "2Embed.skin (ads)",
                "2embed.skin",
                f"https://www.2embed.skin/embed/{tid}",
                risk="risky",
            ),
            VodSource(
                id="moviesapi",
                name="MoviesAPI (ads)",
                provider="moviesapi.club",
                embed_url=f"https://moviesapi.club/movie/{tid}",
                kind="embed",
                hls_capable=False,
                risk="risky",
            ),
        ]
        out.extend(preferred + standard + risky)
    else:
        s = max(1, int(season or 1))
        e = max(1, int(episode or 1))
        # Prefer frameable embeds (see movie branch). VidZee XFO SAMEORIGIN.
        preferred = [
            _source(
                "videasy",
                "Videasy",
                "player.videasy.net",
                f"{VIDEASY_PLAYER}/tv/{tid}/{s}/{e}",
                quality_hint="1080p",
                risk="preferred",
            ),
            _source(
                "smashy",
                "SmashyStream",
                "smashystream.com",
                f"{SMASHY_EMBED}/playere.php?tmdb={tid}&season={s}&episode={e}",
                risk="preferred",
            ),
            _source(
                "vixsrc",
                "VixSrc",
                "vixsrc.to",
                f"https://vixsrc.to/tv/{tid}/{s}/{e}?lang={lang}",
                quality_hint="1080p",
                risk="preferred",
            ),
            _source(
                "vidzee",
                "VidZee Player",
                "player.vidzee.wtf",
                f"{VIDZEE_PLAYER}/embed/tv/{tid}/{s}/{e}",
                risk="standard",
            ),
            VodSource(
                id="icefy",
                name="Icefy",
                provider="streams.icefy.top",
                embed_url="",
                kind="hls",
                hls_capable=True,
                quality_hint="1080p",
                risk="preferred",
            ),
            VodSource(
                id="cinesu",
                name="CineSu",
                provider="cine.su",
                embed_url="",
                kind="hls",
                hls_capable=True,
                quality_hint="1080p",
                risk="preferred",
            ),
            VodSource(
                id="vidapi",
                name="VidApi",
                provider="vaplayer.ru",
                embed_url="",
                kind="hls",
                hls_capable=True,
                quality_hint="1080p",
                risk="preferred",
            ),
        ]
        standard = [
            _source(
                "vidsrc",
                "Vidsrc",
                "vsembed.ru",
                f"{VIDSRC_EMBED_BASE}/embed/tv?tmdb={tid}&season={s}&episode={e}",
            ),
            _source(
                "vidsrcme",
                "Vidsrc.me",
                "vidsrc.me",
                f"{VIDSRC_ME}/embed/tv?tmdb={tid}&season={s}&episode={e}",
            ),
            _source(
                "vidsrcmeru",
                "VidsrcMe.ru",
                "vidsrcme.ru",
                f"{VIDSRC_ME_RU}/embed/tv?tmdb={tid}&season={s}&episode={e}",
            ),
            _source(
                "vidsrcembedru",
                "Vidsrc Embed RU",
                "vidsrc-embed.ru",
                f"{VIDSRC_EMBED_RU}/embed/tv/{tid}/{s}/{e}",
            ),
            _source(
                "vidlink",
                "VidLink",
                "vidlink.pro",
                f"https://vidlink.pro/tv/{tid}/{s}/{e}",
            ),
            _source(
                "multiembed",
                "MultiEmbed",
                "multiembed.mov",
                f"{MULTIEMBED}/?video_id={tid}&tmdb=1&s={s}&e={e}",
            ),
            _source(
                "primesrc",
                "PrimeSrc",
                "primesrc.me",
                f"https://primesrc.me/embed/tv?tmdb={tid}&season={s}&episode={e}",
            ),
        ]
        risky = [
            _source(
                "2embed",
                "2Embed (ads)",
                "2embed.cc",
                f"https://www.2embed.cc/embedtv/{tid}&s={s}&e={e}",
                risk="risky",
            ),
            _source(
                "2embedskin",
                "2Embed.skin (ads)",
                "2embed.skin",
                f"https://www.2embed.skin/embedtv/{tid}&s={s}&e={e}",
                risk="risky",
            ),
        ]
        out.extend(preferred + standard + risky)

    # Language hints for aggregators that often serve non-English audio by default.
    lang_overrides = {
        "vidsrcmeru": ("multi", "en", "ru"),
        "vidsrcembedru": ("multi", "en", "ru"),
        "multiembed": ("multi", "en"),
        "2embed": ("multi", "en"),
        "2embedskin": ("multi", "en"),
        "moviesapi": ("multi", "en"),
        "primesrc": ("en", "multi"),
        "videasy": ("en",),
        "vidzee": ("en", "multi"),
        "smashy": ("en", "multi"),
        "vixsrc": ("en",),
        "vidsrc": ("en", "multi"),
        "vidsrcme": ("en", "multi"),
        "vidlink": ("en", "multi"),
        "icefy": ("en",),
        "cinesu": ("en",),
        "vidapi": ("en", "multi"),
        "auto": ("en", "multi"),
    }
    remapped: list[VodSource] = []
    for s in out:
        langs = lang_overrides.get(s.id)
        if langs and s.languages == ("en",):
            remapped.append(
                VodSource(
                    id=s.id,
                    name=s.name,
                    provider=s.provider,
                    embed_url=s.embed_url,
                    kind=s.kind,
                    hls_capable=s.hls_capable,
                    quality_hint=s.quality_hint,
                    auto=s.auto,
                    risk=s.risk,
                    languages=langs,
                )
            )
        else:
            remapped.append(s)
    out = remapped

    prefer = (prefer_lang if prefer_lang is not None else lang) or "en"
    prefer = prefer.strip().lower()[:5] or "en"
    matched = [s for s in out if _lang_ok(s, prefer)]
    other = [s for s in out if s not in matched]
    if include_other_langs:
        return matched + other
    # Always keep Auto row even if filtered
    autos = [s for s in out if s.auto]
    if matched:
        # preserve auto at front
        rest = [s for s in matched if not s.auto]
        return (autos[:1] if autos else []) + rest
    return autos or out


# Hosts known to refuse cross-origin iframes (X-Frame-Options / frame-ancestors).
NON_FRAMEABLE_EMBED_HOSTS = frozenset(
    {
        "player.vidzee.wtf",
        "vidzee.wtf",
    }
)

# Auto / instant-play order: frameable first.
FRAMEABLE_EMBED_IDS = ("videasy", "smashy", "vixsrc")


def embed_url_frameable(url: str | None) -> bool:
    u = (url or "").strip().lower()
    if not u.startswith("http"):
        return False
    try:
        from urllib.parse import urlparse

        host = (urlparse(u).hostname or "").lower()
    except Exception:
        return True
    if not host:
        return True
    if host in NON_FRAMEABLE_EMBED_HOSTS:
        return False
    if host.endswith(".vidzee.wtf"):
        return False
    return True


def preferred_embed_url(
    tmdb_id: int,
    media_type: str = "movie",
    season: int | None = None,
    episode: int | None = None,
) -> str:
    """First frameable preferred embed URL for instant iframe playback."""
    sources = [
        s
        for s in list_sources(
            tmdb_id, media_type, season, episode, lang="en", include_auto=False, prefer_lang="en"
        )
        if (s.embed_url or "").strip() and embed_url_frameable(s.embed_url)
    ]
    by_id = {s.id: s for s in sources}
    for sid in FRAMEABLE_EMBED_IDS:
        s = by_id.get(sid)
        if s:
            return s.embed_url
    for s in sources:
        if s.risk == "preferred":
            return s.embed_url
    for s in sources:
        if s.risk != "risky":
            return s.embed_url
    # Last resort: any embed (may be non-frameable — caller can still open Sources).
    for s in list_sources(
        tmdb_id, media_type, season, episode, lang="en", include_auto=False, prefer_lang="en"
    ):
        if (s.embed_url or "").strip():
            return s.embed_url
    return ""


def sources_as_dicts(sources: list[VodSource]) -> list[dict]:
    return [
        {
            "id": s.id,
            "name": s.name,
            "provider": s.provider,
            "embed_url": s.embed_url,
            "kind": s.kind,
            "hls_capable": s.hls_capable,
            "quality_hint": s.quality_hint,
            "auto": s.auto,
            "risk": s.risk,
            "languages": list(s.languages or ("en",)),
        }
        for s in sources
    ]
