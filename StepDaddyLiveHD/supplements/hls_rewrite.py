"""Absolute-ize HLS playlist media/key URLs (Android M3u8Rewriter subset).

When proxy=True, rewrite through same-origin /content|/key so HTTPS pages can
play http:// upstreams without mixed-content blocks (FreeTV/iptv/etc.).
"""

from __future__ import annotations

from urllib.parse import urljoin, urlparse


def origin_from_referer(referer: str) -> str:
    try:
        p = urlparse(referer)
        if p.scheme and p.netloc:
            return f"{p.scheme}://{p.netloc}"
    except Exception:
        pass
    return (referer or "").rstrip("/")


def _proxy_media_url(absolute_url: str, referer_host: str) -> str:
    from StepDaddyLiveHD.utils import encrypt

    host = (referer_host or "").strip() or "direct"
    return f"/content/{encrypt(absolute_url)}/{encrypt(host)}"


def _proxy_key_url(absolute_url: str, referer_host: str) -> str:
    from StepDaddyLiveHD.utils import encrypt

    host = (referer_host or "").strip() or "direct"
    return f"/key/{encrypt(absolute_url)}/{encrypt(host)}"


def rewrite_playlist(
    m3u8_text: str,
    m3u8_url: str,
    *,
    proxy: bool = False,
    referer: str | None = None,
) -> str:
    """Rewrite playlist lines to absolute URLs, optionally gateway-proxied.

    proxy=True is required for browser playback of http:// upstreams from an
    https:// gateway page (mixed content). Nested playlists/segments then go
    through /content/{encrypt}/{encrypt} like DaddyLive.
    """
    referer_host = ""
    if referer:
        try:
            referer_host = urlparse(referer).netloc or referer
        except Exception:
            referer_host = referer
    if not referer_host:
        try:
            referer_host = urlparse(m3u8_url).netloc or "direct"
        except Exception:
            referer_host = "direct"

    lines_out: list[str] = []
    non_comment = 0
    for raw in m3u8_text.splitlines():
        line = raw.strip()
        if line.upper().startswith("#EXT-X-KEY:"):
            start = line.find('URI="')
            if start >= 0:
                start += 5
                end = line.find('"', start)
                if end > start:
                    original = line[start:end]
                    absolute = urljoin(m3u8_url, original)
                    if proxy:
                        absolute = _proxy_key_url(absolute, referer_host)
                    line = line[:start] + absolute + line[end:]
        elif line and not line.startswith("#"):
            non_comment += 1
            absolute = urljoin(m3u8_url, line)
            if proxy:
                absolute = _proxy_media_url(absolute, referer_host)
            line = absolute
        lines_out.append(line)
    if not any(l.startswith("#EXTM3U") for l in lines_out) and non_comment == 1:
        media = next((l for l in lines_out if l and not l.startswith("#")), "")
        return f"#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=8000000\n{media}\n"
    return "\n".join(lines_out).rstrip() + "\n"
