"""Free-TV (USA/CA/UK) + full Android iptv-org set + Adult Swim marathons."""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
from typing import Iterable
from urllib.parse import quote

import httpx

from .m3u_parse import parse_m3u

log = logging.getLogger("supplements.open_iptv")

UA = (
    "Mozilla/5.0 (Linux; Android 11; Android TV) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

FREETV_CDN = [
    "https://cdn.jsdelivr.net/gh/Free-TV/IPTV@master/playlists/",
    "https://fastly.jsdelivr.net/gh/Free-TV/IPTV@master/playlists/",
    "https://gcore.jsdelivr.net/gh/Free-TV/IPTV@master/playlists/",
    "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/",
]
# Match Android FreeTvIptvConfig.PLAYLIST_FILES — full USA + CA/UK when reachable.
FREETV_FILES = [
    "playlist_usa.m3u8",
    "playlist_canada.m3u8",
    "playlist_uk.m3u8",
]
FREETV_MAX = int(os.environ.get("FREETV_MAX_CHANNELS", "200"))

IPTV_ORG_CDN = [
    "https://cdn.jsdelivr.net/gh/iptv-org/iptv@master/streams/",
    "https://fastly.jsdelivr.net/gh/iptv-org/iptv@master/streams/",
    "https://gcore.jsdelivr.net/gh/iptv-org/iptv@master/streams/",
    "https://testingcf.jsdelivr.net/gh/iptv-org/iptv@master/streams/",
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/",
]
# Full Android IptvOrgStreamsConfig.PLAYLIST_FILES (UK + US regional FAST lists).
IPTV_ORG_FILES = [
    "uk.m3u",
    "uk_bbc.m3u",
    "uk_distro.m3u",
    "uk_pluto.m3u",
    "uk_rakuten.m3u",
    "uk_samsung.m3u",
    "uk_sportstribal.m3u",
    "us.m3u",
    "us_30a.m3u",
    "us_3abn.m3u",
    "us_abcnews.m3u",
    "us_afrolandtv.m3u",
    "us_amagi.m3u",
    "us_canelatv.m3u",
    "us_cbsn.m3u",
    "us_cineversetv.m3u",
    "us_distro.m3u",
    "us_firetv.m3u",
    "us_frequency.m3u",
    "us_glewedtv.m3u",
    "us_klowdtv.m3u",
    "us_local.m3u",
    "us_malimartv.m3u",
    "us_pbs.m3u",
    "us_plex.m3u",
    "us_pluto.m3u",
    "us_roku.m3u",
    "us_samsung.m3u",
    "us_sofast.m3u",
    "us_ssh101.m3u",
    "us_stirr.m3u",
    "us_tcl.m3u",
    "us_tubi.m3u",
    "us_uplynk.m3u",
    "us_vegasplus.m3u",
    "us_vizio.m3u",
    "us_wfmz.m3u",
    "us_wowza.m3u",
    "us_xumo.m3u",
]
IPTV_ORG_MAX = int(os.environ.get("IPTV_ORG_MAX_CHANNELS", "5000"))

# Playlist filename stem → FAST platform tag (for EPG merge / catalog filters).
# LG / Prime have no dedicated iptv-org US playlist today.
_PLATFORM_FROM_STEM = {
    "pluto": "pluto",
    "plex": "plex",
    "roku": "roku",
    "samsung": "samsung",
    "tubi": "tubi",
    "xumo": "xumo",
    "tcl": "tcl",
    "vizio": "vizio",
    "firetv": "firetv",
}


def platform_tag_from_playlist(filename: str) -> str | None:
    """Return #platform slug from iptv-org stream filename (e.g. us_pluto.m3u → pluto)."""
    stem = filename.removesuffix(".m3u").removesuffix(".m3u8").lower()
    # uk_pluto / us_samsung / ca_samsung …
    for part in reversed(stem.split("_")):
        if part in _PLATFORM_FROM_STEM:
            return _PLATFORM_FROM_STEM[part]
    return None


AS_CDN = "https://adultswim-vodlive.cdn.turner.com/live"
AS_PLAYER = "top-2.18.1"
AS_REFERER = "https://www.adultswim.com/"
# Full Android AdultSwimStreamsConfig.CATALOG
AS_CATALOG = [
    ("rick-and-morty", "Rick and Morty", "AdultSwimRickandMorty.us", "https://i.imgur.com/uPV5CT1.png"),
    ("robot-chicken", "Robot Chicken", "AdultSwimRobotChicken.us", "https://i.imgur.com/E6EJ14j.png"),
    ("metalocalypse", "Metalocalypse", "AdultSwimMetalocalypse.us", "https://i.imgur.com/CaKq6Mt.png"),
    ("aqua-teen", "Aqua Teen Hunger Force", "AdultSwimAquaTeenHungerForce.us", "https://i.imgur.com/cvnniFH.png"),
    ("samurai-jack", "Samurai Jack", "AdultSwimSamuraiJack.us", "https://i.imgur.com/UOZ4VTH.png"),
    ("off-the-air", "Off the Air", "AdultSwimOffTheAir.us", "https://i.imgur.com/X2qhBpO.png"),
    ("channel-5", "Channel 5", "AdultSwimChannel5.us", "https://i.imgur.com/G9TyeCN.png"),
    ("black-jesus", "Black Jesus", "AdultSwimBlackJesus.us", "https://i.imgur.com/QWzEK8i.png"),
    ("DREAM-CORP-LLC", "Dream Corp LLC", "AdultSwimDreamCorpLLC.us", "https://i.imgur.com/TSuWOBP.png"),
    ("infomercials", "Infomercials", "AdultSwimInfomercials.us", "https://i.imgur.com/gu8luP0.png"),
    ("lsotl", "Last Stream on the Left", "AdultSwimLastStreamOnTheLeft.us", "https://i.imgur.com/bnZCZD2.png"),
    ("primal", "Primal", "AdultSwimPrimal.us", "https://i.imgur.com/fRysIrL.png"),
    ("eric-andre", "The Eric Andre Show", "AdultSwimTheEricAndreShow.us", "https://i.imgur.com/47za7Yq.png"),
    ("venture-bros", "The Venture Bros", "AdultSwimTheVentureBros.us", "https://i.imgur.com/ZwNmt8Y.png"),
    ("ypf", "Your Pretty Face Is Going to Hell", "AdultSwimYourPrettyFaceIsGoingToHell.us", "https://i.imgur.com/uLoRE4F.png"),
    ("toonami", "Toonami", "Toonami.fr", "https://i.imgur.com/U7qh4yF.png"),
    ("williams-stream", "Williams Stream", None, None),
]


def live_stream_url(channel_id: str) -> str:
    """Same-origin live playlist path with colon ids percent-encoded."""
    return f"/live/{quote(str(channel_id), safe='')}.m3u8"


def _short_hash(value: str) -> str:
    digest = hashlib.sha256(value.encode("utf-8")).digest()
    return "".join(f"{b:02x}" for b in digest[:6])


def is_playable_http_stream(url: str) -> bool:
    u = url.strip().lower()
    if not (u.startswith("http://") or u.startswith("https://")):
        return False
    if "youtube.com" in u or "youtu.be" in u or "twitch.tv" in u:
        return False
    return True


def _freetv_country_tag(filename: str) -> str:
    low = filename.lower()
    if "usa" in low:
        return "#us"
    if "canada" in low:
        return "#ca"
    if "uk" in low:
        return "#uk"
    return "#international"


def _freetv_group(filename: str) -> str:
    low = filename.lower()
    if "usa" in low:
        return "Free-TV USA"
    if "canada" in low:
        return "Free-TV Canada"
    if "uk" in low:
        return "Free-TV UK"
    return "Free-TV"


async def _fetch_first(client: httpx.AsyncClient, urls: Iterable[str], max_bytes: int) -> str | None:
    for url in urls:
        try:
            r = await client.get(
                url,
                headers={"User-Agent": UA},
                timeout=15.0,
                follow_redirects=True,
            )
            if r.status_code != 200:
                continue
            raw = r.content
            if not raw or len(raw) > max_bytes:
                continue
            return raw.decode("utf-8", errors="replace")
        except Exception as exc:
            log.debug("playlist fetch miss %s: %s", url, exc)
    return None


async def fetch_freetv_usa(client: httpx.AsyncClient) -> list[dict]:
    """Fetch Free-TV USA + Canada + UK (name kept for catalog wiring)."""
    out: list[dict] = []
    seen: set[str] = set()
    for filename in FREETV_FILES:
        if len(out) >= FREETV_MAX:
            break
        text = await _fetch_first(
            client,
            (base + filename for base in FREETV_CDN),
            512 * 1024,
        )
        if not text:
            log.warning("Free-TV playlist unavailable: %s", filename)
            continue
        country = _freetv_country_tag(filename)
        group = _freetv_group(filename)
        for entry in parse_m3u(text, filename):
            if len(out) >= FREETV_MAX:
                break
            if not is_playable_http_stream(entry.stream_url):
                continue
            key = entry.name + "|" + entry.stream_url
            if key in seen:
                continue
            seen.add(key)
            cid = f"freetv:{_short_hash(key)}"
            out.append(
                {
                    "id": cid,
                    "name": entry.name,
                    "tvg_id": entry.tvg_id,
                    "logo": entry.logo,
                    "group_title": entry.group_title or group,
                    "tags": [country, "#freetv", "#live"],
                    "provider": "Free-TV",
                    "source": "freetv",
                    "stream_url": live_stream_url(cid),
                    "upstream_url": entry.stream_url.strip(),
                    "referer": "https://github.com/Free-TV/IPTV",
                    "origin": "https://github.com",
                }
            )
    return out


async def fetch_iptv_org_small(client: httpx.AsyncClient) -> list[dict]:
    """Fetch full Android UK/US iptv-org playlist set (name kept for catalog wiring)."""
    out: list[dict] = []
    seen: set[str] = set()
    for filename in IPTV_ORG_FILES:
        if len(out) >= IPTV_ORG_MAX:
            break
        text = await _fetch_first(
            client,
            (base + filename for base in IPTV_ORG_CDN),
            2 * 1024 * 1024,
        )
        if not text:
            log.warning("iptv-org playlist miss: %s", filename)
            continue
        tag = filename.removesuffix(".m3u")
        platform = platform_tag_from_playlist(filename)
        for entry in parse_m3u(text, filename):
            if len(out) >= IPTV_ORG_MAX:
                break
            if not is_playable_http_stream(entry.stream_url):
                continue
            key = entry.name + "|" + entry.stream_url
            if key in seen:
                continue
            seen.add(key)
            cid = f"iptv:{_short_hash(key)}"
            tags = ["#iptv-org", "#live", f"#{tag.split('_')[0]}"]
            if platform:
                tags.append(f"#{platform}")
            out.append(
                {
                    "id": cid,
                    "name": entry.name,
                    "tvg_id": entry.tvg_id,
                    "logo": entry.logo,
                    "group_title": entry.group_title or f"iptv-org | {tag}",
                    "tags": tags,
                    "provider": "iptv-org",
                    "source": "iptv",
                    "stream_url": live_stream_url(cid),
                    "upstream_url": entry.stream_url.strip(),
                    "referer": None,
                    "origin": None,
                }
            )
    return out


def adult_swim_url(slug: str) -> str:
    return f"{AS_CDN}/{slug.strip()}/stream_de.m3u8?playername={AS_PLAYER}"


async def fetch_adult_swim(client: httpx.AsyncClient) -> list[dict]:
    out: list[dict] = []
    sem = asyncio.Semaphore(3)

    async def probe(row: tuple[str, str, str | None, str | None]) -> dict | None:
        slug, name, tvg_id, logo = row
        url = adult_swim_url(slug)
        async with sem:
            try:
                r = await client.head(
                    url,
                    headers={"User-Agent": UA, "Referer": AS_REFERER},
                    timeout=8.0,
                    follow_redirects=True,
                )
                if r.status_code >= 400:
                    r = await client.get(
                        url,
                        headers={"User-Agent": UA, "Referer": AS_REFERER, "Range": "bytes=0-64"},
                        timeout=8.0,
                        follow_redirects=True,
                    )
                if r.status_code >= 400:
                    return None
            except Exception:
                return None
        cid = f"adultswim:{slug}"
        return {
            "id": cid,
            "name": name,
            "tvg_id": tvg_id,
            "logo": logo,
            "group_title": "Entertainment",
            "tags": ["#animation", "#entertainment", "#us", "#adultswim"],
            "provider": "Adult Swim",
            "source": "adultswim",
            "stream_url": live_stream_url(cid),
            "upstream_url": url,
            "referer": AS_REFERER,
            "origin": "https://www.adultswim.com",
        }

    results = await asyncio.gather(*(probe(row) for row in AS_CATALOG))
    for item in results:
        if item:
            out.append(item)
    return out
