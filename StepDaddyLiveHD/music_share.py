"""Music share deep-link helpers — OG metadata + path/query parsing."""

from __future__ import annotations

import json
import re
from html import escape
from typing import Any
from urllib.parse import quote, urlencode, urljoin

import httpx
from starlette.requests import Request

_VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
_STATION_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.I,
)
_DEFAULT_IMAGE = "/tv-assets/icon-512.png"
_YT_OEMBED = "https://www.youtube.com/oembed"


def _clip(s: str | None, n: int = 180) -> str:
    t = (s or "").strip()
    if len(t) <= n:
        return t
    return t[: n - 1].rstrip() + "…"


def _abs_url(base: str, url: str | None) -> str:
    u = (url or "").strip()
    if not u:
        return urljoin(base, _DEFAULT_IMAGE)
    if u.startswith("//"):
        return "https:" + u
    if u.startswith("http://") or u.startswith("https://"):
        return u
    return urljoin(base, u)


def _request_base(request: Request) -> str:
    proto = (
        request.headers.get("x-forwarded-proto") or request.url.scheme or "https"
    ).split(",")[0].strip()
    host = (
        request.headers.get("x-forwarded-host")
        or request.headers.get("host")
        or request.url.netloc
    ).split(",")[0].strip()
    if not host:
        return "https://sdgateway.duckdns.org"
    return f"{proto}://{host}"


def parse_music_share_path(music_path: str) -> dict[str, str] | None:
    """Parse /music/{music_path} deep-link segments (without leading music/)."""
    p = (music_path or "").strip().strip("/")
    if not p:
        return None
    parts = p.split("/")
    if len(parts) >= 2 and parts[0] in ("t", "listen") and _VIDEO_ID_RE.match(parts[1] or ""):
        return {"kind": "listen", "id": parts[1]}
    if len(parts) >= 2 and parts[0] in ("r", "radio") and _STATION_UUID_RE.match(parts[1] or ""):
        return {"kind": "radio", "id": parts[1]}
    return None


def _listen_meta(
    video_id: str,
    *,
    title: str = "",
    artist: str = "",
    album: str = "",
    image: str = "",
) -> dict[str, Any]:
    title = _clip(title, 120)
    artist = _clip(artist, 120)
    album = _clip(album, 120)
    if title and artist:
        og_title = f"{artist} — {title}"
    elif title:
        og_title = title
    else:
        og_title = "Song — StepDaddy Music"
    desc_parts = [p for p in (artist, album) if p]
    description = " · ".join(desc_parts) if desc_parts else "Listen on StepDaddy Music"
    canonical = f"/music/t/{quote(video_id, safe='')}"
    extra: list[tuple[str, str]] = []
    if title:
        extra.append(("title", title))
    if artist:
        extra.append(("artist", artist))
    if album:
        extra.append(("album", album))
    if image.startswith("http") and len(image) < 500:
        extra.append(("img", image))
    if extra:
        canonical += "?" + urlencode(extra)
    return {
        "kind": "listen",
        "id": video_id,
        "title": title,
        "artist": artist,
        "album": album,
        "image": image,
        "og_title": og_title,
        "description": _clip(description, 200),
        "canonical": canonical,
        "page_title": f"{og_title} — Music",
    }


def _radio_meta(
    station_id: str,
    *,
    name: str = "",
    image: str = "",
    genre: str = "",
) -> dict[str, Any]:
    name = _clip(name, 120)
    genre = _clip(genre, 80)
    og_title = name or "Radio — StepDaddy Music"
    description = genre or "Live radio on StepDaddy Music"
    canonical = f"/music/r/{quote(station_id, safe='')}"
    extra: list[tuple[str, str]] = []
    if name:
        extra.append(("name", name))
    if genre:
        extra.append(("genre", genre))
    if image.startswith("http") and len(image) < 500:
        extra.append(("img", image))
    if extra:
        canonical += "?" + urlencode(extra)
    return {
        "kind": "radio",
        "id": station_id,
        "title": name,
        "artist": "",
        "album": "",
        "image": image,
        "og_title": og_title,
        "description": _clip(description, 200),
        "canonical": canonical,
        "page_title": f"{og_title} — Music",
    }


def parse_music_share(request: Request, music_path: str = "") -> dict[str, Any] | None:
    """Build share meta from path + query. None when not a track/station deep link."""
    q = request.query_params
    parsed = parse_music_share_path(music_path)
    path_norm = (music_path or "").strip().strip("/")

    video_id = None
    station_id = None
    if parsed and parsed.get("kind") == "listen":
        video_id = parsed["id"]
    elif parsed and parsed.get("kind") == "radio":
        station_id = parsed["id"]

    if not video_id:
        cand = (q.get("v") or q.get("videoId") or q.get("video_id") or "").strip()
        if _VIDEO_ID_RE.match(cand):
            # Allow on /music, /music/listen, /music/home — not on radio tab
            if path_norm in ("", "home", "listen") or path_norm.startswith("listen/") or path_norm.startswith("t/"):
                video_id = cand

    if not station_id:
        cand = (q.get("station") or q.get("s") or q.get("stationuuid") or "").strip()
        if _STATION_UUID_RE.match(cand):
            if path_norm in ("", "home", "radio") or path_norm.startswith("radio/") or path_norm.startswith("r/"):
                station_id = cand

    if video_id:
        return _listen_meta(
            video_id,
            title=q.get("title") or q.get("name") or "",
            artist=q.get("artist") or q.get("uploader") or "",
            album=q.get("album") or "",
            image=(q.get("img") or q.get("image") or q.get("thumb") or "").strip(),
        )

    if station_id:
        return _radio_meta(
            station_id,
            name=q.get("name") or q.get("title") or "",
            image=(q.get("img") or q.get("image") or q.get("favicon") or "").strip(),
            genre=q.get("genre") or q.get("tags") or "",
        )

    return None


async def enrich_share_meta(meta: dict[str, Any]) -> dict[str, Any]:
    """Fill missing title/artist/image via lightweight public lookups."""
    if not meta:
        return meta

    if meta.get("kind") == "listen" and meta.get("id"):
        need = not (meta.get("title") and meta.get("image") and meta.get("artist"))
        if need:
            try:
                async with httpx.AsyncClient(timeout=4.0, follow_redirects=True) as client:
                    r = await client.get(
                        _YT_OEMBED,
                        params={
                            "url": f"https://www.youtube.com/watch?v={meta['id']}",
                            "format": "json",
                        },
                        headers={"User-Agent": "StepDaddyLiveHD/music-share"},
                    )
                    if r.status_code == 200:
                        data = r.json()
                        if not meta.get("title"):
                            meta["title"] = _clip(data.get("title"), 120)
                        if not meta.get("artist"):
                            meta["artist"] = _clip(data.get("author_name"), 120)
                        if not meta.get("image"):
                            meta["image"] = (data.get("thumbnail_url") or "").strip()
            except Exception:  # noqa: BLE001
                pass
        title = meta.get("title") or ""
        artist = meta.get("artist") or ""
        album = meta.get("album") or ""
        if title and artist:
            meta["og_title"] = f"{artist} — {title}"
        elif title:
            meta["og_title"] = title
        else:
            meta["og_title"] = "Song — StepDaddy Music"
        desc_parts = [p for p in (artist, album) if p]
        meta["description"] = _clip(
            " · ".join(desc_parts) if desc_parts else "Listen on StepDaddy Music",
            200,
        )
        meta["page_title"] = f"{meta['og_title']} — Music"
        if not meta.get("image"):
            meta["image"] = f"https://i.ytimg.com/vi/{meta['id']}/hqdefault.jpg"
        return meta

    if meta.get("kind") == "radio" and meta.get("id"):
        if not (meta.get("title") and meta.get("image")):
            try:
                from . import radio_browser as rb

                st = await rb.station_by_uuid(meta["id"])
                if st:
                    if not meta.get("title"):
                        meta["title"] = _clip(st.get("name"), 120)
                    if not meta.get("image"):
                        meta["image"] = (st.get("favicon") or st.get("logo") or "").strip()
                    tags = st.get("tags") or st.get("genre") or ""
                    if isinstance(tags, list):
                        tags = ", ".join(str(t) for t in tags[:4])
                    if tags and (
                        not meta.get("description")
                        or meta.get("description") == "Live radio on StepDaddy Music"
                    ):
                        meta["description"] = _clip(str(tags), 200)
            except Exception:  # noqa: BLE001
                pass
        meta["og_title"] = meta.get("title") or "Radio — StepDaddy Music"
        meta["page_title"] = f"{meta['og_title']} — Music"
        if not meta.get("description"):
            meta["description"] = "Live radio on StepDaddy Music"
    return meta


def share_boot_script(meta: dict[str, Any]) -> str:
    """Inline boot flag for the Music SPA client."""
    payload = {
        "kind": meta.get("kind") or "",
        "id": meta.get("id") or "",
        "title": meta.get("title") or "",
        "artist": meta.get("artist") or "",
        "album": meta.get("album") or "",
        "image": meta.get("image") or "",
        "expand": 1,
    }
    return (
        "<script>window.__SD_MUSIC_SHARE="
        + json.dumps(payload, ensure_ascii=True)
        + ";</script>"
    )


def apply_share_meta_to_html(html: str, meta: dict[str, Any], request: Request) -> str:
    """Replace default TV OG/twitter/title/canonical with track/station share tags."""
    if not meta:
        return html
    base = _request_base(request)
    og_title = escape(meta.get("og_title") or "StepDaddy Music")
    description = escape(meta.get("description") or "Listen on StepDaddy Music")
    page_title = escape(meta.get("page_title") or og_title)
    image = escape(_abs_url(base, meta.get("image")))
    canonical = meta.get("canonical") or "/music"
    canonical_abs = urljoin(base, canonical) if canonical.startswith("/") else canonical
    canonical_esc = escape(canonical)
    og_url = escape(canonical_abs)
    og_type = "music.song" if meta.get("kind") == "listen" else "website"

    replacements = [
        (
            '<meta name="description" content="Live TV guide, on-demand, and Watch Party — StepDaddyLiveHD"/>',
            f'<meta name="description" content="{description}"/>',
        ),
        (
            '<meta property="og:type" content="website"/>',
            f'<meta property="og:type" content="{og_type}"/>',
        ),
        (
            '<meta property="og:title" content="TV Guide — StepDaddyLiveHD"/>',
            f'<meta property="og:title" content="{og_title}"/>',
        ),
        (
            '<meta property="og:description" content="Watch live channels together, browse the guide, and join Watch Parties."/>',
            f'<meta property="og:description" content="{description}"/>',
        ),
        (
            '<meta property="og:image" content="/tv-assets/icon-512.png"/>',
            f'<meta property="og:image" content="{image}"/>\n'
            f'  <meta property="og:url" content="{og_url}"/>',
        ),
        (
            '<meta name="twitter:card" content="summary"/>',
            '<meta name="twitter:card" content="summary_large_image"/>',
        ),
        (
            '<meta name="twitter:title" content="TV Guide — StepDaddyLiveHD"/>',
            f'<meta name="twitter:title" content="{og_title}"/>',
        ),
        (
            '<meta name="twitter:description" content="Live TV, VOD, and Watch Party"/>',
            f'<meta name="twitter:description" content="{description}"/>\n'
            f'  <meta name="twitter:image" content="{image}"/>',
        ),
        (
            '<link rel="canonical" href="/tv/"/>',
            f'<link rel="canonical" href="{canonical_esc}"/>',
        ),
        (
            "<title>TV Guide — StepDaddyLiveHD</title>",
            f"<title>{page_title}</title>",
        ),
    ]
    out = html
    for old, new in replacements:
        out = out.replace(old, new, 1)

    boot = share_boot_script(meta)
    if "</head>" in out and "__SD_MUSIC_SHARE" not in out:
        out = out.replace("</head>", boot + "\n</head>", 1)
    return out
