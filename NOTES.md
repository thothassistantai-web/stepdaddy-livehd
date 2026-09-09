# StepDaddy LiveHD — Oracle VPS Notes

Updated: 2026-09-01 (Ampere migration)

## Public access (PRIMARY — Ampere A1.Flex)
- **HTTPS (use this):** https://sdgateway.duckdns.org
- **Entry / TV guide:** https://sdgateway.duckdns.org/ → redirects to `/tv` (bookmarks to old root now open TV)
- **Legacy browse UI:** https://sdgateway.duckdns.org/legacy (formerly served at `/`; also `/ui/`)
- Health (lite): https://sdgateway.duckdns.org/health?lite=1
- PIN entry: https://sdgateway.duckdns.org/auth
- Play example: https://sdgateway.duckdns.org/play/763 (requires PIN)
- Direct IP :3000: **blocked externally** (2026-09-01) — localhost/Caddy only

## Routes (20260909b)
- `/` → **302 → `/tv`** (canonical app home)
- `/tv`, `/tv/{id}` → advanced TV guide player
- `/vod`, `/vod/*` → VOD catalog SPA (header **VOD** brand → `/vod` home)
- `/legacy` → prebuilt webui browse (old root experience)
- Caddy unchanged: all paths reverse_proxy to `127.0.0.1:3000`

## Instance
- Name: `stepdaddy-ampere`
- OCID: `ocid1.instance.oc1.iad.anuwcljtl2j6c4yco7mvh6texytx3ytmxpeyrtlpqayzw7fgofi7t5czwmpa`
- Shape: `VM.Standard.A1.Flex` (2 OCPU, 8 GB RAM)
- Region: us-ashburn-1 / AD-1
- Private IP: 10.0.0.70
- OS: Oracle Linux 9.8 aarch64, Python 3.12 venv

## Previous host (STOPPED 2026-09-01)
- `openclaw-gateway` micro @ 129.153.238.155 — stopped to free Always Free slot; not terminated

## PIN authentication
- Enabled via `PIN_AUTH_ENABLED=1` in `.env.termux`
- Hashed config: `config/pins.json`
- Cleartext issuance (SSH only, chmod 600): `config/PINS-ISSUED.txt`
- 1 admin PIN (multi-device), 10 user PINs (one device each)
- Setup/regenerate: `python3 scripts/setup-pins.py`

## Tailscale (tailnet only — from old micro, re-link if needed)
- Host: `openclaw-oracle` (`100.96.81.82`) — was on stopped micro
- Re-install Tailscale on Ampere if tailnet access required

## Ops
- **Cron** (every 6h): `sync-domain-relay.sh --apply` → `logs/domain-relay.log`
- **Watchdog timer**: `stepdaddy-watchdog.timer` probes `/health?lite=1` every 20s
- **Health snapshots**: every 5m → `logs/health-snapshots.log`
- **Boot probe**: `stepdaddy-boot-probe.service`
- **Firewalld**: ssh, http, https only (port 3000 removed 2026-09-01)

## Startup
- Fetches Android `domain-relay.json` before channel load
- Keeps `daddylive.li` primary when catalog ≥1300 channels
- Pre-warms streams: 763, 857, 51, 360

## Mobile play page
- `/play/{id}` — search drawer, favorites/recents (localStorage), Browse link to `/`
- Session ended → redirect to `/auth`

## Constraints
- EPG disabled, 1 uvicorn worker, MemoryMax=1800M (8 GB host)
- Port 3000 **not** public (HTTPS via Caddy only)
- OpenClaw **not** running on this host (gateway focus)

## Stability loop
- Full doc: `~/StepDaddyLiveHD/STABILITY.md`
- Incidents (JSON): `logs/incidents.log`
- Endpoint: https://sdgateway.duckdns.org/health/stability

## Hetzner fallback
- Runbook: `~/openclaw/workspace/docs/stepdaddy-gateway-HETZNER-FALLBACK.md` (on Pop!_OS)

## Watch party AV
- Default provider: **Built-in WebRTC** (`localStorage sd_party_av_provider=webrtc`)
- Optional: Jitsi meet.jit.si (public demo ~5 min limit) via party drawer / Settings → Party → Call provider
- Landscape Voice/Video/Hybrid with ≥1 remote peer: Zoom-style `#partyAvMainStage` + `#partyAvFilmstrip` under stage (`.party-stage-mode`); tap tile to swap focus; Hybrid defaults content on stage with cameras in strip
- Idle circle (`.party-av-idle`) only for simple PiP / Text peeker without multi-peer stage
- Landscape chat: gapless flush rail (`gap:0`, `--party-rail-w`); idle ~5s or minimize → `.party-chat-minimized` 32px edge handle; sessionStorage `sd_party_chat_minimized`
- Portrait: FB Live overlays (`.party-live-overlay`) — translucent chat stack + compose; optional expand `.party-live-expanded`; LIVE badge + member count
- Signaling: `/ws/party` types `webrtc_offer|webrtc_answer|webrtc_ice|webrtc_hangup|av_state`
- Mesh best for ≤4–8 peers (room max 8); STUN only (no TURN) — household LAN/NAT may vary
- Bundle: `player_app + features + cinema + embed + party_av + party` → `player_bundle.js`

## Watch party UX (2026-09-04) — guide + chat modes + sidebar layouts
- **Show Guide (incognito):** collapsed chrome uses thin bottom edge chevron tab (`.show-guide-btn--incognito`), aria-label `Show guide`; fades with collapsed chrome; optional first-run hint (`sd_guide_hint_seen`)
- **Rising bubbles:** minimized / peek / Live modes show `#partyRisingBubbles` FB Live style stack (last ~4, auto-fade); pointer-events mostly none; tap expands
- **FAB chat UI modes** (`localStorage sd_party_chat_mode`): **default `coherency` (UI: Live / mockup C)** when unset; cycle via `#partyFab` — `sidebar` → `coherency` (Live) → `peek` → `muted` → `cinema` → …; long-press FAB opens mode picker; cinema double-tap restores previous; peek double-tap opens compose (Live)
- FAB appearance: `.mode-sidebar|.mode-coherency|.mode-peek|.mode-muted|.mode-cinema` (+ muted unread badge)
- **Sidebar layouts** (`localStorage sd_party_sidebar_style`, default `a` when unset; **D not offered**):
  - `a` / `.party-sidebar-chat-first` — Chat first (max transcript; Call/provider/features/rename/people under ⋯)
  - `b` / `.party-sidebar-tabs` — Tabs: Chat | People | Call | Room
  - `e` / `.party-sidebar-dual-pane` — Dual pane: collapsible Call & room (~30%) + chat (~70%)
  - Switch in party ⋯ → **Sidebar layout: Chat first | Tabs | Dual pane**
- Drawer chrome: Text/Voice/Video/Hybrid, provider, features, rename under layout-appropriate panels; settings under **⋯** (`#partyMoreBtn` / `#partyExtras`)
- Mockups: `player_assets/mockups/party-sidebar/` (A/B/C/E; D skipped)
- Bundle: `player_app + features + cinema + embed + party_av + party` → `player_bundle.js`

## Watch Party home / resume / live channels (2026-09-04)
- **Party Home:** `https://sdgateway.duckdns.org/party` (PIN-gated). Public invite: `/party/join/{code}` (no PIN). Meta: `/party/join/{code}/meta`
- TV guide header: people icon (`#partyHomeBtn`) next to VOD opens Party Home
- Home shows public rooms, presence (`GET /party/presence`), recent codes (`sd_party_recent`), suggested from `sd_last_place`, join-by-code, create CTAs
- **Session resume:** `localStorage sd_last_place` = `{ path, channelId?, tmdbId?, mediaType?, season?, episode?, partyCode?, title?, ts }`; honors remember-channel; bare `/tv` restores VOD/party deep links; channel still via `sd_last_tv_channel`
- **Live channel parties:** create/join sets `content.channelId` + EPG/channel title (`mediaType: live`); guests `switchChannel` (no reload loop); live is content-follow + chat/AV, not HLS scrub sync
- **Party chrome host (2026-09-04 fix):** drawer / FAB / toast / LIVE badge / AV mount on `#videoArea` (`.party-chrome-host`), not `#trailerLayer`. Root cause of “chat vanishes when live video starts”: `trailerLayer` is `display:none` during pure live and `stopOverlayPlayback` / channel switch removes `.show`. CSS party layouts dual-target `#videoArea` + `#trailerLayer`; force-display of empty trailerLayer gated to VOD (`.show`/`.hls-mode`/`.embed-mode`) only.
- **Player hotzones / hold:** center tap toggles chrome; edges channel± (live) or seek; hold seek/volume/channel = burst; chrome stays while paused / menu / party / scrub / hold; ignore `.party-drawer`, `#partyFab`, `#partyAvOverlay`, modals
- Join landing: desktop CTA, room name/title, password if locked, deep-link `?party=&name=`, missing-room → Party Home; auto-join retries + surfaced errors (`bad_password`, `not_found`, `auth_required`)
- Bundle: `player_app + features + cinema + embed + party_av + party` → `player_bundle.js`

## Media Session metadata fix (2026-09-04)
- **Root cause:** `mediaMetaFromDom()` preferred HLS chrome `#pcTitle` placeholder (`"Title"`) and `#chromeSub` channel index (`"Ch N / M"`); artwork used relative `/tv-assets/icon-512.png` and never channel logos → Android Chrome blue circle
- **Fix:** Live/VOD metadata from `headerMeta` + EPG `now` + `channelMap`; artwork priority programme/VOD poster → **channel logo (absolute URL)** → site icon; sync on header/EPG/meta/VOD title changes
- Bundle rebuilt; assets rsynced to VPS (no Python restart)

## Live dock layout + Media Session + shortcuts (2026-09-04)
- **Overlap fix (Live/coherency):** `layoutPartyChrome()` in `player_party.js` — collision-aware slots; mounts `#partyRisingBubbles` inside drawer (`.party-rising-in-dock`); flex bottom dock stack: meta (1-line ellipsis + chips) → rising (capped height, older fade faster) → reactions → compose; FAB clears compose via `--party-fab-clear` + dock `padding-right`; `env(safe-area-inset-*)` + `visualViewport` → `--party-vv-inset` / `--party-vv-height`
- Classes: `.party-live-dock`, `.party-dock-dim` (chrome auto-hide), `.party-dock-narrow`, `.party-dock-short` (≤500px landscape); muted/cinema hide dock
- **SEO:** OG/Twitter/theme-color in `advanced_player_template.py` + party home/join; `document.title` updates on tune (`— StepDaddyLiveHD`); canonical `/tv/` and `/party`
- **Media Session** (`marker: mediaSession` in `player_features.js`): metadata + play/pause/stop/seek±/prev/next track; playbackState; lock-screen / notification controls where supported
- **Shortcuts:** Space/K play-pause; ←/→ seek (VOD via cinema); ↑/↓ volume; M mute; F fullscreen; G guide; P party; [ ] channel±; 0–9 volume; Esc close; `?` / Shift+/ help overlay (`.sd-keys-help`); ignores inputs
- **Mobile:** `site.webmanifest` display-standalone + orientation any; `mobile_shell.js` touch-action + 44px targets; FAB ≥44px; PiP button feature-detect hide
- Bundle: `player_app + features + cinema + embed + party_av + party` → `player_bundle.js`

## Optional Watch Party Sync (2026-09-04)
- **VOD sync:** room features `sync_vod` (default on) + `sync_wait_buffering`; guest override `localStorage sd_party_sync_follow` (default on); NTP-style WS ping/pong → `clockOffsetMs`; three-tier `applyClock` (ignore / soft rate 0.98–1.02 / seek+cooldown); host clock ~1.75s
- **Live catchup (preferred):** `syncLiveMode=catchup` → server `catchup.py` ffmpeg `-c copy` ring → `/catchup/{code}/index.m3u8`; clients attach that HLS and reuse VOD scrub sync. Env: `PARTY_CATCHUP_DIR` (prefer OPENCLAW disk on VPS), `PARTY_CATCHUP_WINDOW_SEC`, `PARTY_CATCHUP_MAX_SESSIONS`, `PARTY_CATCHUP_INTERNAL_KEY`
- **Live lag fallback:** `syncLiveMode=lag` — host broadcasts `liveEdgeOffset` (hls.js latency / liveSyncPosition); guests nudge via playbackRate only (no raw live currentTime hard-seek)
- **PDT:** probe `EXT-X-PROGRAM-DATE-TIME` / hls.js `playingDate`; `syncLiveMode=pdt` when tags exist, else toast + lag/catchup
- **Phase 5 IDMS local-lag — deferred:** do **not** implement a full RFC 7272 / IDMS delay buffer. Prefer catchup; use lag as lightweight fallback. Revisit only if catchup is operationally rejected and lag skew remains unacceptable.
- Bundle: `player_app + features + cinema + embed + party_av + party` → `player_bundle.js`

## Background PiP / Media Session return (2026-09-07)
- **No pause-on-hide:** `wireBackgroundKeepAlive` never pauses `#v` on `visibilitychange` / `pagehide`; retries `play()` if the browser paused while hidden
- **Auto PiP (mobile):** when leaving the tab/app while playing → `requestPictureInPicture` / `webkitSetPresentationMode('picture-in-picture')` (Settings → Auto PiP when leaving tab, default on)
- **Media Session:** play/pause/stop/seek/prev/next + `enterpictureinpicture` / `leavepictureinpicture`; metadata from EPG/channel; notification/lock actions mark immersive return → exit PiP + fullscreen / `SDMobile.enterImmersive` / `webkitEnterFullscreen`
- Desktop: no forced fullscreen on tab return; PiP via Media Session action only
- Version **`20260907q`** (superseded by 20260907r)
- Bundle: `player_app + features + cinema + embed + party_av + party` → `player_bundle.js`

## Mobile /tv UX 20260907r
- Center tap: guide visible → immersive; immersive → restore peek/mid/expanded (debounced; ignores chrome/PiP/buffer)
- Schedule cells: clip overflow, dynamic title/time by width, rail isolation so glyphs never bleed into channel column
- Cinema/channel info art: EPG → Metahub/Cinemeta `/meta` → channel logo → letter; channel chip opens info bar
- Live reconnect: soft reload×3 with backoff + one hard remount; clear stuck Reconnecting; visibility/PiP restore hooks
- Guide chevron: larger mobile hot zone; Simple moved into ⋯ menu only
- Version **`20260907r`**
- Bundle: `player_app + features + cinema + embed + party_av + party` → `player_bundle.js`

## Channel info via channel text 20260907s
- Removed dedicated toolbar `#channelInfoBtn` chip (Damian: no extra info button)
- Channel name (`.hdr-ch`) + header/chrome posters open cinema/channel info bar
- Toolbar: channel text → VOD → party → search → xray → settings …
- Version **`20260907s`**
- Bundle: `player_app + features + cinema + embed + party_av + party` → `player_bundle.js`

## EPG guide performance 20260907t
- Viewport-first prioritized EPG: focused → neighbors → visible → scroll-direction preload
- Now-next first (instant LIVE→title upgrade), then schedule; AbortController on rapid scroll
- Batch APIs: `POST /epg/now-next/batch`, `POST /epg/schedule/batch` (max 48 ids)
- Client memory cache + short TTL + stale-while-revalidate; dedupe in-flight
- Prefetch on channel tune / cinema info open
- Version **`20260907t`**
- Bundle: `player_app + features + cinema + embed + party_av + party` → `player_bundle.js`

## Programme posters 20260907u
- Root cause: movie EPG titles never hit Cinemeta catalog search (no TMDB key); Pluto API posters were stripped in `pluto_epg`
- Fix: Pluto `poster_url`/`backdrop_url`/`year` on programmes; Cinemeta title search fallback; cinema/hover loading → EPG/Metahub → logo → letter/clapper
- Version **`20260907u`**

## Guide boot scroll-to-focus 20260907z
- Field test: guide stayed at alphabet top (sports ● Live); scroll-idle stole `focusIdx` onto no-EPG neighbors
- Fix: boot `scrollToFocus` with real guide `clientHeight`; stop scroll-idle from moving `focusIdx`; dark scrollbar styling
- Version **`20260907z`**
- Bundle: `player_app + features + cinema + embed + party_av + party` → `player_bundle.js`
- Bundle: `player_app + features + cinema + embed + party_av + party` → `player_bundle.js`

## EPG map audit 20260908a (batches 1–5)
- **E! (`315`)**: `SETTV.us` → `E.us` (channel map, name override, authoritative, bridge → `E!.Entertainment.Television.HD.us2`). epg.pw row `464832` still the only US E! index hit (schedule quality is upstream).
- **AMC (`303`)**: `AMCPlus.us` → `AMC.us` with bridge **only** `AMC.HD.us2`; `AMCPlus.us` → `AMC+.us2`. Not pinned to epg.pw `465032` (John Hughes / *Lost Boys* block ≠ linear *Great Outdoors* from batch-03).
- **Empty majors pinned via epgpw_channel_map**: FS1 `39`→465248, Golf `318`→464783, HGTV `382`→465095, Food `384`→464984, Showtime `333`→465332 (lite mode; XML still disabled).
- No HBO/Cinemax/Showtime skew offset invented. NBC News NOW Pluto title left alone.
- Version **`20260908a`**

## EPG bridge fix 20260908b (batch 06 miss audit + batch 07 MTV)
- **Disney XD (`314`)**: `DisneyXD.us` bridge was wrongly `Disney.Channel.HD.us2` (Disney Channel guide). Corrected to `Disney.XD.HD.us2` + `Disney.XD.HD.(Pacific).us2` (verified in US2 XML). Lite/epg.pw path unchanged until US2 XML enabled.
- **MTV USA (`371`)**: `MTVLive.us` → `MTV.us` (map, name override, authoritative, bridge → `MTV.-.Music.Television.HD.us2`). Batch 07 frame = MTV bug + Ridiculousness-style clip; US2 main MTV lists *Ridiculousness*; MTV Live guide was concert/Unplugged.
- Batch 06 hard misses **not** remapped: BBC America `305` = upstream Acorn *Poirot* hijack (tvg_id `BBCAmerica.us` correct); Cartoon Network overnight Adult Swim is shared-feed timeshare (no safe static remap; `AdultSwim.us` empty); Disney Channel *Bluey* vs *Rio 2* = schedule skew with correct bug.
- Version **`20260908b`**

## EPG epgpw override fix 20260908c (MTV lite drift)
- **Root cause**: persisted `data/epgpw_epg/auto_channel_map.json` pinned gateway `371` → epg.pw `464825` with `tvg_id=MTVLive.us`. Merge applied that hint and **overwrote** authoritative `MTV.us` in the live mapper (`/epg/match/371` method=epgpw).
- **Fix**: sentinel pin `999002`→`MTV.us` in `assets/epgpw_channel_map.json` (blocks auto rematch); `load_channel_map` strips auto gateway ids owned by file/default/env; `_merge_epgpw_fast` prefers `AUTHORITATIVE_ID_MAPPINGS` over auto tvg_hints. Stale auto `464825` entry removed on VPS.
- Lite guide may be empty for MTV until a verified main-MTV epg.pw id is pinned (preferred over wrong Live concert schedule).
- Version **`20260908c`**

## Android green-screen decode recovery 20260908d
- Field: S23 Chrome `/tv/343` (USA Network 1080p High) painted solid green / blue-green garbage while `readyState` looked healthy; 720p ch51 OK; `/live/343/embed` OK; ffmpeg software decode of same TS OK.
- Root cause: health checks treated HW-decode garbage as healthy → soft-reconnect never ran; FRAG_LOADED reset recovery counters.
- Fix: canvas paint sampler detects green/solid/chroma-dead frames; `playbackLooksHealthy`/`mediaPaintingOk` fail closed; paint watchdog remounts once then Android DDL → Clappr embed fallback; `enableWorker:false` on Android.
- Version **`20260908d`**
- Bundle: `player_app + features + cinema + embed + party_av + party` → `player_bundle.js`

## Android GPU ImageReader decode fix 20260908e
- Investigation (S23 WebAPK/Chrome): Qualcomm `c2.qti.avc.decoder` + Chromium `image_reader_gl_owner.cc: no buffers currently available` → green/purple speckles / black paint on 1080p High DDL (USA `343`). 720p Main (`51`) OK; `/live/343/embed` OK; ffmpeg software decode OK. Not TiviMate-specific.
- Timeline (~2 days): `20260907q` Auto PiP + `20260907r` aggressive live remount/reconnect increase HW decoder thrash; MSE still uses same MPEG-TS AVC High@L4.0 via `/content/` (format unchanged — not a sudden fMP4/HEVC flip).
- Fix: Android leaner hls.js buffers; paint-dead → **embed immediately** (no remount thrash); Auto PiP default **off** on Android; black+chroma-noise paint detector.
- Version **`20260908e`**
- Bundle: `player_app + features + cinema + embed + party_av + party` → `player_bundle.js`

## EPG smart priority queue 20260908f
- Client: real priority queue for `/tv` guide — tuned → visible viewport → recents → favorites/top networks → scroll-ahead → idle fill; Pluto/epg.pw gap-fill channels deprioritized
- Cap concurrency + AbortController preemption on scroll/channel change; skip fresh `epgCache`/`scheduleCache` entries
- Soft tab-visible refresh (force only when `/epg/status` revision changes)
- Server: `POST /epg/now-next/batch` + `/epg/schedule/batch` return RAM immediately; live Pluto/epg.pw fills queued async (`fill_pending`); single-channel GETs still may fill inline
- Version **`20260908f`**
- Bundle: `player_app + features + cinema + embed + party_av + party` → `player_bundle.js`

## Android paint grace + settings 20260908g
- Dead-paint → embed now waits a **sustained** grace window (default **6s**; Short 2.5s / Patient 12s) so brief green/black flashes can self-correct.
- Settings → Live TV: **Decoder glitch → backup player** toggle + Short/Default/Patient wait.
- Client log: `localStorage.sd_paint_dead_log` + `window.__sdPaintDeadStats()` (temporary vs static). Optional beacon `POST /api/client-metrics` → `logs/client-metrics.log`; inspect `GET /api/client-metrics`.
- Embed UX: center guide hotspot, Back to live returns to MSE, chrome/z-index above iframe.
- Version **`20260908g`**
- Bundle: `player_app + features + cinema + embed + party_av + party` → `player_bundle.js`

## Live remount thrash fix 20260908h
- Root cause: `playing` / `FRAG_LOADED` reset `livePaintRemountUsed` + reload budgets on a **single** non-dead paint sample → remount → brief OK/black → reset → remount loop (load→reload).
- Also: `playing` + dead paint forced "Reconnecting…" UI during grace (looked like thrash).
- Fix: require **8s sustained healthy paint** before clearing remount/reload budgets; **15s recover cooldown** after remount/soft-reload/embed; quiet grace (no force reconnect UI); timeupdate ignores green-screen progress.
- EPG priority queue unchanged (already does not remount `#v`).
- Version **`20260908h`**
- Bundle: `player_app + features + cinema + embed + party_av + party` → `player_bundle.js`

## Android ABR cap + no-frame fail-fast + GPU keep-alive 20260908l
- Android MSE: `autoLevelCapping` / start at ≤720 when master has **multiple** HLS levels (no-op on single-rung 1080).
- True no-frame (`videoWidth==0` / `readyState<2`) fail-fast soft-retry at **~10s** (does not wait out 60s paint grace).
- Optional Android GPU keep-alive CSS tick while playing (`localStorage.sd_gpu_keepalive=0` to disable); A/B vs paint-death.
- Paint→embed grace path unchanged.
- Version **`20260908l`**
- Bundle: `player_app + features + cinema + embed + party_av + party` → `player_bundle.js`

## Keep working MSE experiments 20260908m
- **Kept:** Android ABR ≤720 when multi-level master; ~10s no-frame fail-fast → Tap to retry; paint→embed grace path.
- **Reverted:** GPU keep-alive CSS (A/B on USA `343` — identical near-black with on/off; no green reduction).
- Skipped ffmpeg remux/re-encode farm.
- Field: `field-test-s23/mse-experiments-20260908l/` (includes l A/B + paint-embed verify).
- Version **`20260908m`**
- Bundle: `player_app + features + cinema + embed + party_av + party` → `player_bundle.js`

## Single-channel audit protocol
- Gapless one-channel repair/rebuild checklist + JSON schema + auditor:
  - Protocol: `docs/channel-audit/PROTOCOL.md`
  - Schema: `docs/channel-audit/schema/channel-audit.schema.json`
  - Script: `python3 scripts/channel-audit.py <channel_id> [--probe-media] [--grab-frame] [--md]`
  - Examples: `docs/channel-audit/examples/` (343 USA, 51 ABC)
- Auto fills catalog/stream/EPG probe; human fills visual EPG match, paint-death, TiviMate UI #, favorites.

## No-frame fail-fast remount fix 20260908n
- Soft remounts no longer reset the no-frame clock (reconnect loops were starving the ~10s fail-fast).
- Version **`20260908n`**
- Bundle: `player_app + features + cinema + embed + party_av + party` → `player_bundle.js`

## ABC USA EPG repair 20260908o
- Guide **ch 20** = playlist #20 = gateway **`51`** ABC USA (`playlist_index` 19).
- Root cause: lite mode has no programmes for `ABC.us` (WOFTV affiliates only; bridge was Czech `ABC.TV.cz`).
- Fix: epg.pw pin **`464902`** (ABC National Feed) → gateway `51` / `ABC.us`; bridge → `ABC.National.Feed.us2`; authoritative `51`→`ABC.us`.
- Version **`20260908o`**
- Audit: `docs/channel-audit/examples/audit-51-*` + repair folder under examples if dated.

## ABC USA false-UTC EPG fix 20260908p
- User disputed 20260908o: stream showed **The View**; guide showed overnight **ABC World News Now**.
- Root cause: US epg.pw **country gzip** stamps slots as `+0000` with shifted clocks (~8h); JSON API for `464902` is correct (The View @ 15:00Z). Gateway preferred gzip.
- Fix: `EPGPW_PREFER_JSON=1` (default) — JSON first, gzip fallback; clear `prog_464902` cache; keep pin `464902`.
- Auditor 1.1: `epg_match_status` + US daypart heuristics; non-empty now/next alone cannot yield severity=none / false healthy.
- Version **`20260908p`**

## Comet USA EPG repair 20260908q
- Guide **ch 251** = playlist #251 = gateway **`696`** Comet USA.
- Root cause: `WWJS143.us` + poisoned `prog_465305` from US epg.pw **gzip** (false +0000, ~8h); JSON has **Stargate SG-1** @ 16:00Z while guide showed paid programming.
- Fix: authoritative/`channel_epg_map` **`Comet.us2`**; pin epg.pw **`465305`** prefer JSON; clear prog cache; gzip no longer overwrites `prog_*.json` when JSON preferred.
- Version **`20260908q`**
- Audit: `docs/channel-audit/examples/audit-696-*` + `repair-comet-usa-20260908q/`.

## EPG confirmed-case feedback loop (auditor 1.2)
- Honest gap: PROTOCOL 1.1 / JSON-first / gzip overwrite stop / daypart gates shipped as **one-off repairs + detection**, not a learning loop.
- Added: `data/epg_confirmed_corrections.json` (seeded ABC `51`/`464902` + Comet `696`/`465305`), `scripts/epg_correction.py` (classify → prefer proven class resolutions), auditor consult/register flags.
- Protocol Phase 4b: every `visually_confirmed` repair MUST be registered; future audits MUST consult the registry; never healthy on non-empty alone (strengthened).
- Global gzip/JSON rules documented as algorithm steps (`20260908p`/`q` already on gateway) — no VERSION bump (docs/scripts only).

## Lifetime Network EPG repair 20260908r

- Guide **ch 581** = gateway **326** Lifetime Network
- Pin epg.pw **465290** Lifetime HD JSON → `LifetimeNetwork.us` (was empty)
- GT / now_title: **The Rookie**; version **`20260908r`**
- Audit: `docs/channel-audit/examples/audit-326-*` + `repair-lifetime-usa-20260908r/`.

## Lifetime Movie Network EPG repair 20260908s

- Guide **ch 580** = gateway **389** Lifetime Movies Network (LMN)
- Pin epg.pw **464929** LMN HD JSON → `LifetimeMovieNetwork.us` (was empty)
- GT / now_title: **A Family Nightmare: Secrets on Maple Street**; version **`20260908s`**
- Audit: `docs/channel-audit/examples/audit-389-*` + `repair-lmn-usa-20260908s/`.

## MY9TV USA EPG repair 20260908u — **SUPERSEDED by 20260908x (via 20260908w detour)**

- Was: playlist/guide **#655** = gateway **654** pinned WWOR **468489** (Maury GT).
- **Superseded:** visual FOX 5 bug → identity is **WNYW**, not WWOR. See 20260908w.

## METV USA EPG repair 20260908v
- Guide **ch 622** = playlist #622 = gateway **`662`** METV USA (gateway **622** is Cosmote Sport 1 Greece).
- Root cause: `WZVNTV262.us` empty + bridge to MeTV.Plus; no epg.pw pin → class `empty`.
- Fix: authoritative/`channel_epg_map` **`Me.TV.Network.us2`**; pin epg.pw **`465323`** prefer JSON; leave WZVNTV262→Plus for OTA callsign.
- GT / now_title: **The Waltons**; version **`20260908v`**
- Audit: `docs/channel-audit/examples/repair-metv-usa-20260908v/`.

## FOX 5 NYC / WNYW repair 20260908w — **SUPERSEDED by 20260908x (654 only; 768 kept)**
- Guide **#655** / gateway **654**: DaddyLive label **MY9TV USA** was wrong; on-screen **FOX 5** bug → call sign **WNYW**.
- Remap `654` → `WNYW-DT.us_locals1` + epg.pw **468913**; display override **FOX 5 NYC**; supersedes `my9tv-usa-654-20260908u`. Also pin FOXNY **768**.
- No DDL My9 found; dulo `My9 New York` remains. Classes: `wrong_label` / `wrong_network` + station-code tiers in PROTOCOL.
- Version **`20260908w`**. Audit: `docs/channel-audit/examples/repair-fox5-nyc-654-20260908w/`.


## Live no-frame fail-fast fix 20260908y
- Root cause: ~10s no-frame soft-retry armed at attach and **kept ticking across soft remounts** (`?r=`), so post-deploy cold playlist/cache stranded **all** channels on `Playback interrupted — tap to retry`.
- Fix: reset no-frame clock on every attach; freeze countdown while Loading/Tuning/Reconnecting; 25s budget; one auto soft re-attach; prefer hls.js over Chromium native HLS claims.
- Also harden `nativeHls()` (MSE first; Apple-only fallback).
- Version **`20260908y`**.

## My9 NJ / WWOR repair 20260908x
- Guide **#655** / gateway **654**: on-screen **my9** + **my9nj.com** + GT **The Jennifer Hudson Show** → **My9 NJ** / call sign **WWOR**.
- Remap `654` → `WWOR-DT.us_locals1` + epg.pw **468489**; display **My9 NJ**; supersedes `fox5-nyc-wnyw-654-20260908w` / `fox-5-nyc-654-20260908w` / `my9tv-usa-654-20260908u`.
- Sibling **768** FOXNY stays **WNYW** / **468913** (verified fox5ny.com separately).
- Algorithm: station codes still required but must match correct affiliate; bug URL + latest operator/airing GT override prior wrong visual registry calls.
- Version **`20260908x`**. Audit: `docs/channel-audit/examples/repair-my9nj-654-20260908x/`.

## Voice search mics 20260909a
- Feature 6: `/tv` Search drawer input gets an in-box mic (right) using Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`); hidden when unsupported.
- Feature 7: VOD catalog search uses the same mic-in-corner pattern.
- Text search unchanged (mic fills the input and triggers existing search handlers).
- Version **`20260909a`**
- Bundle: `player_app + features + cinema + embed + party_av + party` → `player_bundle.js`

## Guide category drawer (feature 1) 20260909d
- Swipe/pull channel column (**Q3-3b**) left→right opens **Q3-3d** `#catDrawer` from off-screen left of the EPG body.
- Drawer: **All** · **Favorites** (gapless, creates `sd_favorites` if missing) · **Recent** · catalog `group_title` groups (+ whitelist tags for ungrouped DDL).
- Selecting a category filters `orderIds` with no holes; persists `sd_guide_category`. Close via reverse swipe or scrim.
- UI map: `docs/ui-map/tv-portrait-quadrants.md` (**3d**).
- Version **`20260909d`**
- Bundle: `player_app + features + cinema + embed + party_av + party + report` → `player_bundle.js`

## Channel Report (⋯ menu) 20260909c
- `/tv` multi-menu **Report** opens audit popup: categories, severity, ground-truth title, what's actually airing, notes, screenshot (video frame / guide strip), optional audit JSON.
- API: `POST /api/channel-reports` → `logs/channel-reports/` (+ `index.jsonl`); list/get for ops; 15m fingerprint dedupe (client + server).
- Collapsed chrome live ⋯ also has Report. Protocol: `docs/channel-audit/PROTOCOL.md` (Client reports).
- Version **`20260909b`** (Report + Cast cache-bust aligned)
- Bundle: `player_app + features + cinema + embed + party_av + party + report` → `player_bundle.js`

## Cast / AirPlay (feature 4) 20260909c
- **UI:** Q2 strip `#castBtn` (cast icon, same `btn-icon` stroke style) after Settings; ⋯ menu **Cast / AirPlay**; HLS cinema chrome Cast is a transport `pc-btn` with cast icon.
- **API:** `window.SDCast.prompt()` best-effort chain: AirPlay picker → Remote Playback → Cast Web Sender (Default Media Receiver + stream URL) → Presentation API.
- **Limitations:** Android Chrome + hls.js MSE often cannot Remote Playback; Cast receiver lacks PIN cookies so proxied `/live/*.m3u8` may 401 on the dongle; toast suggests Chrome ⋮ Cast tab/screen. AirPlay best on Safari/iOS native HLS. Details: `docs/CASTING.md`.
- Introduced in **`20260909c`**; live cache-bust currently **`20260909d`** (parallel feature bump kept cast markers).
- Bundle: `player_app + features + cinema + embed + party_av + party + report` → `player_bundle.js`
- UI map: `docs/ui-map/tv-portrait-quadrants.md` (Q2 **2f2** cast)

## 20260909e — Always Sunny VOD 2710 playback
- Root: Auto embed fell back to VidZee (`X-Frame-Options: SAMEORIGIN`) → blank iframe; VPS also CF-403 on direct HLS extractors.
- Fix: prefer frameable embeds (Videasy → Smashy → VixSrc); demote VidZee; `embed_url_frameable` guard server+client.
- Case study: `docs/case-studies/vod-always-sunny-2710.md`
- Verify: https://sdgateway.duckdns.org/vod/tv/2710 — `/vod/resolve` returns Videasy embed.
- Bundle: `player_app + features + cinema + embed + party_av + party + report` → `player_bundle.js`

## 20260909h — Channel genre + distributor taxonomy
- Server `supplements/taxonomy.py` + `data/taxonomy/*_aliases.json` normalize genre / distributor / country / language at `/channels` merge.
- Channel API fields: `genre`, `genres[]`, `distributor`, `country`, `language`; `group_title` set to genre label for legacy clients.
- Guide drawer **Q3-3d** sections: All · Favorites · Recent → Genres → Distributors → Countries → Languages. Persists `genre:…` / `distributor:…` / `country:…` / `language:…` (`sd_guide_category`; legacy `group:`/`tag:` migrated).
- Pluto (etc.) stay under **Distributors**; UK/uk/USA/us collapse to **Countries** UK/US. DDL/FreeTV/iptv/Dulo/ntv/Adult Swim wired via source + tags.
- Audit: `scripts/taxonomy-audit.py`. UI map **3d** updated.
- Bundle: `player_app + features + cinema + embed + party_av + party + report` → `player_bundle.js`

## 20260909g — EPG episode codes + portrait title row
- Lite ingest (epg.pw JSON, Pluto, WOFTV + gz) now fills `season` / `episode` / `episode_label` (`S1E1`) via shared `supplements/episode_meta.py`; Pluto maps `episode.season`/`number` and prefers series title.
- Client always surfaces S#E# in guide cells, on-air (incl. compact/tiny), cinema overlay, hover/X-Ray.
- Portrait/`max-width:720px` top-bar: title full-width row; VOD/Party/Search/X-Ray icons on second row. UI map Q2 updated.

## 20260909f — Portrait X-Ray + X-Ray VOD detail
- Portrait Q2: `#xrayBtn` visible again (only `#dirLink` stays hidden on ≤640px).
- X-Ray panel **▶ VOD** opens VOD details for matched title (`/vod/{movie|tv}/{id}`, IMDb/search fallback) instead of source picker.
- Cinema in-player X-Ray also restores **▶ VOD** → `/vod/...` detail.
- Bundle: `player_app + features + cinema + embed + party_av + party + report` → `player_bundle.js`
- UI map: `docs/ui-map/tv-portrait-quadrants.md` (Q2 **2e2** xray)
