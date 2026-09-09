# Case study: Always Sunny VOD playback (`/vod/tv/2710`)

**Date:** 2026-09-09  
**Title:** It's Always Sunny in Philadelphia (TMDB TV `2710`)  
**Verify:** https://sdgateway.duckdns.org/vod/tv/2710  
**Symptoms:** Play → “Finding direct stream…” → blank / broken embed (or hijack reclaim), no usable video.

## Root cause (layered)

Three independent failure modes stacked:

### 1. Direct HLS empty on Oracle VPS (403 / blocked APIs)

Home egress can extract **VixSrc** HLS for S1E1…S18E5.  
Ampere VPS gets:

- `vixsrc.to` → Cloudflare **403**
- `api.videasy.net` → Cloudflare **403**
- `core.vidzee.wtf/api-key` → **404**

So `/vod/resolve` returns `ok:false` with  
`reason: no_playable_direct_or_stub_filtered` and falls through to an **embed URL**.

This is the same class of failure as live CDN ToS/403s: **datacenter IP ≠ residential**.

### 2. Auto embed picked a non-frameable host (primary UX break)

Fallback preferred **VidZee** (`player.vidzee.wtf`), which responds with:

- `X-Frame-Options: SAMEORIGIN`
- CSP `frame-ancestors *` (conflicting; browsers still often honor XFO)

Our player loads embeds in `#trailerFrame` on `sdgateway.duckdns.org` → **iframe blocked → blank black player**. Looks like “playback broken” even though resolve “succeeded” with an embed.

Videasy / Smashy allow framing (no XFO).

### 3. Stub MP4 filter (related, already shipped for Lanterns)

Some providers return ~20s / &lt;5MB MP4 previews. Those are rejected by `_mp4_looks_complete` (`VOD_MIN_MP4_BYTES`, default 5MB). That path is correct; Always Sunny’s live failure was **XFO**, not stubs. Keep stub filtering.

### 4. “Play latest” context (amplifier)

Default series mode is **latest**. Catalog reported `latest_aired` = **S18E5** (air date 2026-09-08). New episodes may lag on scrapers, but for this title home still resolved S18E5 via VixSrc — so episode choice alone was not the VPS blank-iframe bug. Still: when debugging series Play, always note **which S/E** Auto chose.

## Fix shipped

1. **Prefer frameable embeds** for Auto / resolve fallback:  
   `videasy` → `smashy` → `vixsrc`; demote `vidzee` to standard (still in Sources).
2. **`embed_url_frameable()`** + `NON_FRAMEABLE_EMBED_HOSTS` in `vod_sources.py`.
3. **`_first_embed_fallback`** skips non-frameable hosts.
4. Client `buildDefaultEmbedUrl` / `firstEmbedSource` match server order and skip VidZee for iframe Auto.
5. **Open-frame policy for preferred hosts:** Videasy detects any iframe `sandbox` attribute and shows “Iframe Sandbox Detected”. For `videasy` / `smashy` / `vixsrc`, remove `sandbox` and use `referrerpolicy=origin-when-cross-origin`. Hijack protection stays via `window.open` guard (`SDEmbed` reclaim), not sandbox.

## Playbook — similar VOD issues

| Symptom | Probe | Likely cause | Fix direction |
|---|---|---|---|
| Short clip then ends | Range GET `Content-Range` / size &lt; ~5MB | Stub MP4 treated as success | Reject stub; fall through to embed / next provider |
| Black iframe after resolve `method=embed` | `curl -I` embed → `X-Frame-Options: SAMEORIGIN` | Host refuses cross-origin frame | Prefer frameable host; keep broken host out of Auto |
| Embed shows “Iframe Sandbox Detected” | Inspect `#trailerFrame` attrs | Provider refuses any `sandbox` | Open-frame for preferred hosts; keep `window.open` hijack guard |
| Resolve empty only on VPS | Compare home vs VPS `resolve_all` | CF / ToS block on datacenter IP | Embed fallback (frameable); optional `VOD_SOCKS5` / OMSS |
| Hijack popups / reclaim UI | `SDEmbed` reclaim + sandbox | Provider ad overlays | Reclaim chrome; sandbox; Sources picker |
| Wrong title / movie embed for TV id | Resolve without `type=tv` | Default media_type=movie | Force `type=tv` + S/E from series detail |
| Latest ep missing | Catalog `latest_aired` vs provider | Airdate ahead of scrapers | Progressive mode / walk back episodes / Sources |

### Minimum reproduction checklist

1. Confirm path: `/vod/tv/{tmdb}` (series) vs `/vod/movie/{tmdb}`.
2. `GET /vod/catalog/tv/{id}` → title, `latest_aired`, seasons.
3. `GET /vod/resolve?tmdb_id=&type=tv&season=&episode=` → note `ok`, `method`, `reason`, `embed_url`.
4. `GET /vod/sources?...` → Auto vs preferred embeds.
5. From **VPS and home**: run `VodResolver.resolve_all` + `curl -I` on chosen embed (XFO / CSP).
6. Hard-refresh Play; if blank, open Sources → try Videasy / Smashy manually.
7. If stub suspected: check proxied MP4 size / duration.

### Do / don’t

- **Do** treat “resolve returned embed” as incomplete until the embed is **frameable**.
- **Do** keep stub MP4 filtering; never trust tiny progressive files as full episodes.
- **Don’t** put XFO-SAMEORIGIN hosts first in Auto iframe order.
- **Don’t** assume VPS extractors match laptop results — always dual-probe.

## Related

- Lanterns stub filter: `/vod/tv/95350`, reason `no_playable_direct_or_stub_filtered`
- Live CDN 403 → iframe backup player on `/tv`
