"""Extra HLS extractors ported from CinePro Core (Videasy + VidZee).

Videasy: fan-out to api.videasy.net servers, decrypt blob via enc-dec.app.
VidZee: /api/server + AES key from core.vidzee.wtf/api-key (CinePro decrypt.ts).
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import os
import re
from typing import Any
from urllib.parse import urlencode

import httpx

from StepDaddyLiveHD.vod_resolver import VodResolveResult, _norm_type, UA

VIDEASY_HEADERS = {
    "User-Agent": UA,
    "Accept": "application/json, */*; q=0.01",
    "Referer": "https://player.videasy.net/",
    "Origin": "https://player.videasy.net",
}
VIDEASY_SERVERS = (
    ("mb-flix", "https://api.videasy.net/mb-flix/sources-with-title"),
    ("1movies", "https://api.videasy.net/1movies/sources-with-title"),
    ("cdn", "https://api.videasy.net/cdn/sources-with-title"),
    ("superflix", "https://api.videasy.net/superflix/sources-with-title"),
    ("lamovie", "https://api.videasy.net/lamovie/sources-with-title"),
    ("cuevana", "https://api2.videasy.net/cuevana/sources-with-title"),
)
VIDEASY_DEC = os.environ.get("VIDEASY_DEC_URL", "https://enc-dec.app/api/dec-videasy").strip()

VIDZEE_PLAYER = "https://player.vidzee.wtf"
VIDZEE_CORE = "https://core.vidzee.wtf"
VIDZEE_HEADERS = {
    "User-Agent": UA,
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Referer": VIDZEE_PLAYER,
    "Origin": VIDZEE_PLAYER,
}
# CinePro vidzee/decrypt.ts — SHA-256 of this string is the AES-GCM wrapping key.
_VIDZEE_WRAP = b"4f2a9c7d1e8b3a6f0d5c2e9a7b1f4d8c"


def _aes_available() -> bool:
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # noqa: F401
        from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes  # noqa: F401

        return True
    except Exception:
        return False


def _looks_m3u8(url: str) -> bool:
    return ".m3u8" in (url or "").split("?", 1)[0].lower()


def _quality_label(raw: str | None) -> str:
    if not raw:
        return "Auto"
    s = raw.strip()
    if re.match(r"^\d{3,4}p$|^4K$|^HD$|^SD$", s, re.I):
        return s
    m = re.search(r"(\d{3,4})", s)
    return f"{m.group(1)}p" if m else "Auto"


async def _head_is_hls(client: httpx.AsyncClient, url: str, referer: str, origin: str | None) -> bool:
    headers = {"User-Agent": UA, "Referer": referer, "Accept": "*/*"}
    if origin:
        headers["Origin"] = origin
    try:
        r = await client.get(url, headers=headers)
        return r.status_code < 500 and r.text.lstrip().startswith("#EXTM3U")
    except Exception:
        return False


async def resolve_videasy(
    client: httpx.AsyncClient,
    tmdb_id: int,
    media_type: str,
    season: int | None,
    episode: int | None,
    lang: str = "en",
    title: str = "",
) -> VodResolveResult | None:
    kind = _norm_type(media_type)
    params_base = {
        "title": title or "",
        "mediaType": "movie" if kind == "movie" else "tv",
        "tmdbId": str(int(tmdb_id)),
        "imdbId": "",
        "episodeId": str(max(1, int(episode or 1)) if kind == "tv" else 1),
        "seasonId": str(max(1, int(season or 1)) if kind == "tv" else 1),
        "language": "english" if (lang or "en").lower().startswith("en") else lang,
    }
    if kind == "movie":
        params_base["year"] = ""

    async def one(server_url: str) -> list[str]:
        url = server_url + "?" + urlencode(params_base)
        r = await client.get(url, headers=VIDEASY_HEADERS)
        if r.status_code != 200:
            return []
        blob = r.text.strip()
        if len(blob) < 10:
            return []
        dec = await client.post(
            VIDEASY_DEC,
            headers={"Content-Type": "application/json"},
            json={"text": blob, "id": str(int(tmdb_id))},
        )
        if dec.status_code != 200:
            return []
        data = dec.json()
        result = data.get("result") or {}
        sources = result.get("sources") or []
        out = []
        for s in sources:
            if isinstance(s, dict):
                u = str(s.get("url") or "").strip()
                if u and _looks_m3u8(u):
                    out.append(u)
            elif isinstance(s, str) and _looks_m3u8(s):
                out.append(s)
        return out

    tasks = [one(u) for _, u in VIDEASY_SERVERS]
    batches = await asyncio.gather(*tasks, return_exceptions=True)
    urls: list[str] = []
    for b in batches:
        if isinstance(b, list):
            urls.extend(b)
    seen: set[str] = set()
    for u in urls:
        if u in seen:
            continue
        seen.add(u)
        if await _head_is_hls(client, u, "https://player.videasy.net/", "https://player.videasy.net"):
            return VodResolveResult(
                provider="videasy",
                provider_name="Videasy",
                manifest_url=u,
                referer="https://player.videasy.net/",
                origin="https://player.videasy.net",
                quality="Auto",
                source="local",
            )
    return None


def _vidzee_derive_key(wrapped_b64: str) -> str:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    raw = base64.b64decode(re.sub(r"\s+", "", wrapped_b64))
    if len(raw) <= 28:
        return ""
    iv, tag, rest = raw[:12], raw[12:28], raw[28:]
    wrapped = rest + tag
    key = hashlib.sha256(_VIDZEE_WRAP).digest()
    aes = AESGCM(key)
    return aes.decrypt(iv, wrapped, None).decode("utf-8")


def _vidzee_decrypt_link(encrypted: str, key_utf8: str) -> str:
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.backends import default_backend

    if not encrypted or not key_utf8:
        return ""
    try:
        decoded = base64.b64decode(encrypted)
        text = decoded.decode("latin1")
        iv_b64, cipher_b64 = text.split(":", 1)
        iv = base64.b64decode(iv_b64)
        cipher_bytes = base64.b64decode(cipher_b64)
        key = key_utf8.encode("utf-8")[:32].ljust(32, b"\x00")
        decryptor = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend()).decryptor()
        pt = decryptor.update(cipher_bytes) + decryptor.finalize()
        pad = pt[-1]
        if 1 <= pad <= 16:
            pt = pt[:-pad]
        return pt.decode("utf-8")
    except Exception:
        return ""


async def resolve_vidzee(
    client: httpx.AsyncClient,
    tmdb_id: int,
    media_type: str,
    season: int | None,
    episode: int | None,
    lang: str = "en",
) -> VodResolveResult | None:
    if not _aes_available():
        return None
    try:
        key_r = await client.get(f"{VIDZEE_CORE}/api-key", headers=VIDZEE_HEADERS)
        if key_r.status_code != 200 or not key_r.text.strip():
            return None
        dec_key = _vidzee_derive_key(key_r.text.strip())
        if not dec_key:
            return None
    except Exception:
        return None

    kind = _norm_type(media_type)

    async def one_server(sr: int) -> list[str]:
        url = f"{VIDZEE_PLAYER}/api/server?id={int(tmdb_id)}&sr={sr}"
        if kind == "tv":
            url += f"&ss={max(1, int(season or 1))}&ep={max(1, int(episode or 1))}"
        r = await client.get(url, headers=VIDZEE_HEADERS)
        if r.status_code != 200:
            return []
        try:
            data = r.json()
        except Exception:
            return []
        urls = []
        items = data.get("url") or []
        if not isinstance(items, list):
            return []
        for item in items:
            link = ""
            if isinstance(item, dict):
                link = str(item.get("link") or "")
            elif isinstance(item, str):
                link = item
            if not link:
                continue
            plain = _vidzee_decrypt_link(link, dec_key) or link
            if plain.startswith("http") and _looks_m3u8(plain):
                urls.append(plain)
            elif plain.startswith("http") and ".mp4" in plain.split("?", 1)[0].lower():
                urls.append(plain)
        return urls

    batches = await asyncio.gather(*[one_server(i) for i in range(8)], return_exceptions=True)
    seen: set[str] = set()
    for b in batches:
        if not isinstance(b, list):
            continue
        for u in b:
            if u in seen:
                continue
            seen.add(u)
            referer = VIDZEE_PLAYER + "/"
            origin = VIDZEE_PLAYER
            if "fast33lane" in u:
                referer = "https://rapidairmax.site/"
                origin = "https://rapidairmax.site"
            if _looks_m3u8(u) and await _head_is_hls(client, u, referer, origin):
                return VodResolveResult(
                    provider="vidzee",
                    provider_name="VidZee",
                    manifest_url=u,
                    referer=referer,
                    origin=origin,
                    quality="Auto",
                    source="local",
                )
    return None
