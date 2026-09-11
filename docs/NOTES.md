## Music Autoplay endless fallback 20260911g
- Field: S21 stuck on Autoplay **Preparing suggestions…** after Up Next source finished (live was 20260911f).
- Root cause: shared `SQ.refill` inflight + `fetchJson` with no timeout → hung Listen call dead-ended prepare forever; waiting path did not retry when Autoplay stayed empty.
- Fix: 10s fetch / 12s refill / 11s prepare timeouts; progressive `onBatch`; endless ladder album→artist→related→watch→home→made-for-you→search→library→emergency; waiting retry loop; stream prewarm abort; continuous refill while playing.
- SOCKS `:11080` / `VOD_SOCKS5` was healthy (`proxy.active=true`) — not the blocker.
- Deployed `20260911g`; S21 CDP: prepare ~1.1s → 40 tracks; 8 advances no wait; empty recover ~1s → 39 tracks. Report `/tmp/music-autoplay-field.json`.

## Music Smart Shuffle field + cold-start 20260911f
- Field-tested Smart Shuffle vs Off vs plain Shuffle; was near no-op on empty taste (rank ≈ input order).
- Cold-start defaults in `SDMusicTaste.rankItems`: same-artist/genre/era as seed, soft popularity, avoid immediate repeats, light time-of-day, rank noise (Smart ≠ Off).
- Learning path wired into Smart Shuffle specifically (`smartShuffle: true` on UQ Up Next + player next/prev + radio dial).
- `recordLike` syncs fav id list so likes up-rank; unit smoke `_smoke_smart_shuffle.js`.
- Report: /tmp/music-smart-shuffle-field.json

## Music S21 viewport fit 20260911e
- Root cause: `.music-home` used `98dvh` + `.vod-catalog` `transform` trapping `.smp-sheet` fixed positioning; sheet height used full `visualViewport` → ~17px top gap + bottom clip on S21 WebAPK.
- Fix: full-bleed Music catalog (`100dvh` / `--music-vh`); expanded host `transform: none`; sheet fills host / VV; video art uses 16:9 contain; `_syncViewport` clamps to catalog client box.
- Report: `/tmp/music-s21-fit.json`

## Music desktop field: search-tab dismiss + wide art/queue 20260911d
- Field-tested /music at 1280/1440/1920 + landscape: sheet, Music|Home|Radio|Listen, search Enter blur, directories, OG share OK.
- Fix: header tab switch dismisses search results overlay (was covering Home/Radio/Listen).
- Fix: laptop expanded player — art|meta+queue column fills height; auto-open Up Next on Listen expand ≥1024 landscape.
- Close ✕ hit target 40×40; preserves SOCKS/Listen, UQ tap/remove, TV 10-foot dock (20260911c).
- Report: `/tmp/music-field-desktop.json`

## Music TV 10-foot dock + field test 20260911c
- Field-tested /music + /tv at 1920×1080, 4K-scaled, 960×540; API smokes Listen/search/radio + SOCKS proxy OK.
- Playback logic OK: Radio vs Listen, UQ advanceNext/Prev/jumpTo, Media Session owner switch, SDMusicTvAudio focus, mini-dock smp-on-tv, no audio clash (TV muted/paused on Music claim).
- Fix: 10-foot mini-dock — larger targets (56–64px), art/type, dock prev/next on `.smp-on-tv`; enlarged sheet controls when Music overlays TV (≥1280×720).
- Report: /tmp/music-field-tv.json

## Music queue tap/remove + live update + prewarm + drop volcontrol 20260911b
- Expanded Up Next: tap row → jump Now Playing via UQ; X + swipe-to-remove on Play Next/Up Next/Autoplay.
- Queue panel live-refreshes on UQ.onChange while open (no re-open).
- Listen stream cache + prewarm next 1-2 URLs; Autoplay prepare when Up Next thin.
- Removed smp-sheet-utils volcontrol row (mute/lyrics/related/info + volume slider).
- Report: /tmp/music-queue-tap-remove-vol.json

## Listen stream SOCKS restore 20260911a
- Root cause: VPS `.env.termux` missing `VOD_SOCKS5` while home `pproxy`+`ssh -R :11080` was up — yt-dlp hit Oracle IP → YouTube bot gate (`Sign in to confirm you’re not a bot`) on Listen `/stream/{id}`; Radio unaffected.
- Fix: set `VOD_SOCKS5=socks5://127.0.0.1:11080`; harden `music_stream` format `bestaudio/best/worst` + optional cookiefile; health reports `proxy.active`.

## Music artist ecosystem + predictive taste 20260910az
- Album play: Now = tapped track; Up Next = rest of album → other albums/singles by same artist → Autoplay.
- Directory track/video: stay on artist (popular + discography) before Autoplay; background prefetch.
- SDMusicTaste v2: entry path, temporal (dow/hour/month), co-occurrence, year/era, dwell; ranks Smart Shuffle + Autoplay + Home soft-boost.
- ytmusicapi album stamps artistId onto tracks; radio dial-only preserved.
- Report: /tmp/music-artist-ecosystem-predictive.json

## Music Home/Search → UQ + Play Next menus 20260910ay
- Home track taps route through Listen `playTracks` / UQ (onEnded, next/prev, Up Next, Autoplay); no bare Player.play.
- Search fallback uses UQ `playTracks`/`playVideoId` (never direct Player.play).
- Track ⋮ menus: Play Next / Add to Queue / Add to playlist on Listen rows, Home track cards, Search hits; long-press on track rows.
- Radio dial-only + share deep links preserved. Report `/tmp/music-home-uq-wire.json`

## Music unified queue timeline 20260910av
- Listen session: History → Now Playing → Play Next → Up Next → Autoplay (`music_unified_queue.js`)
- Mini swipe-down no-op; expanded swipe-down collapses; artwork L/R next/prev (30%/velocity + 5s prev)
- Queue panel sections + Autoplay toggle; Radio dial-only when `source===radio`
- Report `/tmp/music-unified-queue-spec.json`

## Music search field UX 20260910at
- Unlock: keyguard-first no-op when unlocked; ignore Secure Folder deviceLocked=1
- Empty query dismisses results; mic/clear absolute inside input (player.css reinforce)
- No prophylactic unlock during field tests
- Report `/tmp/music-search-field-test.json`

## Music search field UX 20260910as
- Fix stuck “Searching…” (abort/stale races, never leave skeleton on fail; keep prior results + Updating…)
- Fixed-height search bar; aligned clear/mic insets; uniform Search button; blur keyboard on submit
- Soft-clean accidental PIN digit injection mid-query; results open/close motion
- `s21-unlock`: keyevents only, skip PIN when already unlocked (no `input text` into Chrome)
- Report `/tmp/music-search-field-test.json`

## Music search tall results + infinite scroll + swipe dismiss 20260910ar
- `.ms-results` fills remaining Music sheet height below search + chips; catalog body hidden while open.
- `/api/music/search` supports offset/limit + has_more / has_more_by_kind (ytmusicapi pool slice + Radio Browser).
- Infinite scroll loads more at bottom; swipe-down from scrollTop~0 dismisses results (sheet stays open).
- Keeps aq dismiss-on-select, chips, All/typed sections, ap ranking/dedupe.
- Report: `/tmp/music-search-infinite.json`

## Music search dismiss on select 20260910aq
- Unified `/music` search: selecting a result hides the results panel + blurs input (keeps query).
- Chip filters + voice search preserved; focus re-opens cached results.
- Report: `/tmp/music-search-dismiss.json`

## Music unified search improve 20260910ap
- `/api/music/search`: ytmusicapi typed fan-out + Radio Browser name/tag; rank by exact/prefix/phrase + votes + yt rank prior + taste.
- Dedup stable ids + artist/album/playlist title soft-dedupe; Untitled/artist mapping hardened; 45s query cache.
- UI: skeletons, type chips, See all, faster debounce, taste soft-boost; chip→directory / Home / Media Session preserved.
- Bundle rebuilt; report `/tmp/music-search-improve.json`.

## Music Home discovery + library strip 20260910an
- Home flow: compact Library strip (Liked/Playlists/Artists/Albums/Saved 2×N + See all) → hero → Your music → Radio → Artists → Made for you/trending (taste-weighted).
- Cold start favors geo radio + charts; with history Made for you / Recent / followed artists rise.
- Focus chips under search: equal min-width/height, aligned baseline, one-line scroll, TV-guide blues.
- Preserves header Music|Home|Radio|Listen, chip→directory, artist follow, Media Session, wide sheet.
- Report: `/tmp/music-home-discovery-library.json`

## Music focus chip stack reset 20260910am
- On top of ak: chip All / switches call `resetNavigation` (Listen+Radio) so A–Z directories do not stick.
- Radio `renderGen`/`stillHome` prevents async home paint from overwriting Stations directory.
- Search keeps Music sheet open. Preserves Follow (aj) + ak polish. Report `/tmp/music-focus-directories.json`

## Music focus chip stack reset 20260910al
- Chip All (and chip switches) call `resetNavigation` on Listen + Radio so directory A–Z does not stick after leaving.
- Stations→Radio stations; Tracks/Albums/Playlists/Videos/Artists→Listen directories; search keeps Music sheet open.
- Preserves artist Follow (aj) + ak target polish. Report `/tmp/music-focus-directories.json`

## Music Listen field-test touch/copy fixes 20260910ak
- Field test (S21): Directory › ~15px, tabs 32px, play-dot 36px, '1 tracks', duplicate Library labels.
- Fixes: trackCountLabel pluralization; Your library/Open; .ml-see-all ≥40×44 hit; play-dot 40px; header tabs min-height 40.
- Reports: /tmp/music-listen-field-test.json · /tmp/music-listen-competitive-research.json · screenshots /tmp/music-listen-field-ag/

## Music focus chips → directories 20260910aj
- Focus chips navigate tab+directory: All→Home; Stations→Radio stations dir; Tracks/Albums/Playlists/Videos/Artists→Listen directories.
- APIs: `/api/music/listen/{tracks,albums,playlists,videos}/directory` (+ artists). `music_directories.js` uses `.charAt(0)` (no JS `[:1]`).
- Preserves artist Follow toggle + enriched artist page from follow agent.
- Report: `/tmp/music-focus-directories.json`

## Focus chip directories 20260910ai→aj
- Chips navigate: All→Home; Stations→Radio stations dir; Tracks/Albums/Playlists/Videos→Listen directories; Artists→existing A–Z.
- APIs: `/api/music/listen/{tracks,albums,playlists,videos}/directory` (letter/sort/search/paginate).
- Module `music_directories.js`; Radio `openStationsDirectory`; focus persist + back pops directory.
- Bundle concat includes music_directories; report `/tmp/music-focus-directories.json`.

## Artist follow + enriched artist page 20260910aj
- Follow toggles unfollow when already following; persists library + taste (`isFollowing` / `recordFollow`).
- Enriched artist page: hero art, Play/Shuffle/Follow/+, Popular · Albums · Singles · Related.
- Fixed `music_directories.js` `[:1]` SyntaxError that broke live `20260910ai` player_bundle.
- A–Z artists directory preserved. Report `/tmp/music-artist-follow-enrich.json`

## Artists A–Z directory 20260910ag
- API `GET /api/music/listen/artists/directory` — letter A–Z/#, sort name|name_desc|hot, pagination; cached pool from charts + letter seeds.
- UI: Listen Artists Directory (Library Artists, Home Directory ›, focus Artists chip); tap → Artist→Album→Song.
- Continues chip polish, Your music Recent|Liked, artist thumb resolve. Reports `/tmp/music-artists-directory.json` + `/tmp/music-focus-chip-polish.json`.

## Music artist nav resolve + chips 20260910af
- Artist thumbs without UC id resolve via `/api/music/listen/search?filter=artists` then open artist page (Artist→Album→Song).
- Featured artist requires channel id; axis-lock re-fires suppressed mobile taps; focus pills stay single-line.
- Continues Your music Recent|Liked shelf + chip polish. Report `/tmp/music-focus-chip-polish.json`

## Music focus chips + Your music + artist nav 20260910ae
- Focus chip rail polish (header-aligned pills, icons, fade edges) from ad.
- Home **Your music** chip shelf: Recent | Liked | Favorites (Radio-style).
- Listen artist thumbs: harden openItem (UC/channel/search fallback) + axis-lock tap restore so Artist → Album → Song works on touch.
- Bundle → player_bundle.js · report `/tmp/music-focus-chip-polish.json`

## Music focus chips + Your music shelf 20260910ad
- Focus chip rail under search: pill chrome aligned to header Music|Home|Radio|Listen, clearer active, icons+counts, fade-edge scroll hints.
- Home: Recently played + Liked consolidated into **Your music** Radio-style chip shelf (Recent | Liked | Favorites if distinct).
- Preserves header nav, wide sheet, + playlist, Media Session.
- Bundle: app+features+cinema+embed+party*+music*+report → player_bundle.js · report `/tmp/music-focus-chip-polish.json`

## Media Session no-pause-on-claim 20260910z
- Glitch: soft-hold `v.play()` then deferred `v.pause()` stole Android audio focus from Music; heartbeat re-claimed and re-paused TV, leaving Music paused until notification Play.
- Fix: releaseTv is mute+pause once (idempotent), never soft-hold play; heartbeat/sync use `_nudgePlayIfWanted` + metadata only (`releaseTv:false`); `_wantPlaying` forces `playbackState=playing`.
- Report: /tmp/music-mediasession-foreground.json

## Media Session foreground live controls 20260910y
- Root cause (20260910w/x): hard-pause `#v` on Music claim tore down Chrome MediaStyle while visibilityState===visible; session only re-posted on leave-browser.
- Fix: soft-hold muted `#v` briefly in foreground, then deferred hard-pause + immediate Music re-sync; owner state machine music|tv|vod|none; 1.2s foreground refresh; no metadata=null on reclaim.
- Anti-steal retained while Music actively playing. Leave-browser hard-pause path kept.
- Report: /tmp/music-mediasession-foreground.json

## Music Media Session ownership handoff 20260910w
- Dynamic Media Session owner: Music play/focus claims  (metadata + handlers); TV releases/pauses  so interval/MutationObserver cannot overwrite.
- Stop Music →  rebinds TV handlers + LIVE metadata.
- Same switch as smart TV↔Music audio focus ().
- Keep-alive leave-browser/screen-off retained; report .

## Music leave-browser + screen-off keep-alive 20260910v
- Aggressive background playback: resume on any pause while `_wantPlaying` (not only when hidden).
- Leave-browser: visibility/pagehide(persisted)/freeze + 1.2s bg nudge; near-silent WebAudio keepalive; Media Session stays `playing` while intent held.
- TV must not reclaim audio: `__sdMusicHoldsTv` pauses `#v` and blocks TV pause-auto-resume / Media Session overwrite while Music wants play.
- Report: `/tmp/music-screen-off-smoke.json`

## Spotify-inspired player + screen-off playback 20260910t
- Expanded sheet: large art, bottom-weighted controls (mode/prev/play/next/queue), title+like row, scrubber times, util row.
- Mini dock: floating bar proportions, like+play+stop, Listen progress hairline.
- Media Session metadata + play/pause/next/prev/seekto; `__sdMusicMediaActive` defers TV session; resume on visibility hidden.
- TV↔Music focus keeps Music on screen-off (no duck-stop).
- Report: `/tmp/music-spotify-inspired-player.json`

## Music Home Radio chips + shelf dedupe 20260910s
- Home Radio: one chip/bubble shelf (Near you / Commercial / Internet / AM / FM / Favorites / Genre) swapping a single station row — Artists density pattern.
- Dedupe Recent + Made for you by stable id (videoId / station uuid); Made excludes Recently played ids; rankItems/getRecent dedupe in SDMusicTaste.
- Legacy stacked "Radio near you" + "More radio" rows removed from shelf order (near owns Radio).
- Report: `/tmp/music-home-radio-bubbles-dedupe.json`

## Music play-mode Off / Straight 20260910r
- Expanded player play-mode cycle now includes **Off · Straight play** (⇉): sequential order, no shuffle.
- Cycle: Straight (off) → Shuffle → Smart shuffle → Repeat song → Repeat playlist.
- Default for new sessions (no saved preference): `off`; persisted via `sd_music_play_mode`.
- Listen queue respects sequential/no-wrap when Off; Radio dial uses sequential tune when not shuffling.
- Bundle rebuilt with music_focus + music_artists (no Home Artists / chip focus regression).
- Report: `/tmp/music-shuffle-off.json`

## Music Home Artists + chip focus 20260910p
- Home Artists section under Radio near-you with sort chips: Recent / Genre / Era / Latest / Hot / For you.
- Unified search chips (All/Stations/Artists/...) set shared SDMusicFocus (session+localStorage) and reorder Home shelves.
- Backend: /api/music/listen/artists + fixed charts-artist normalization (channel browseId).
- Modules: music_focus.js, music_artists.js (avoid racing music_player.js).
- Report: /tmp/music-home-artists-focus.json

## Music Home personalize + Radio prewarm 20260910n
- `/music` default **Home** tab: hero + dense shelves (recent, likes, near-you radio, Listen trending/charts, Made for you).
- Device-local taste (`SDMusicTaste`): plays/completes/likes/skips/searches → lightweight scorer; cold start uses geo radio + Listen home.
- Radio prewarm (`SDMusicRadioCache`): idle/open Music warms `/api/music/radio` home/dial/stations + Listen home into memory/sessionStorage TTL; Radio tab uses cache for instant paint.
- Shared `StepDaddyMusicPlayer`; Radio + Listen tabs kept. Report: `/tmp/music-home-personalize-prewarm.json`

## Q3 stay-alive + tap semantics 20260910m
- Q3 same-channel recover: 6.5s settle grace suppresses watchdog/paint/no-frame remounts that killed playback after jump/soft-reload; jumpToLiveEdge no longer overshoots seekable; soft reload re-nudges play.
- Intentional live pause latched (`userPausedLive`) so canplay cannot auto-resume over Space/K / content-tap play.
- Content tap priority: not playing → play; muted → unmute only; else existing guide immersive toggle. Music dock / party / chrome excluded.
- Bundle: same concat order → `player_bundle.js` · report `/tmp/tv-q3-tap-semantics.json`

## Music TV dock gestures — Listen+Radio 20260910k
- Fixed Listen dock: up-next metadata no longer hijacks `[data-smp-next]` transport (was hiding/replacing Next icon and crowding Stop).
- Distinct controls: prev / play-pause / next / stop always present; swipe-down stop+hide works for Listen and Radio.
- Pause-idle (~5.5s) auto-hides floating `/tv` dock; Music sheet / expanded skip auto-close.
- Report: `/tmp/music-tv-dock-gestures.json`

## Music TV dock gestures + pause-idle hide 20260910j
- Mini-dock on `/tv` (`smp-on-tv`): swipe up expand, swipe down stop/hide, swipe L/R prev/next (axis-lock + 48px).
- Paused floating dock auto-hides after ~5.5s idle; dock touch resets; play/resume cancels; expanded or Music sheet open skips auto-close.
- Preserves 20260910g TV↔Music audio ducking.
- Report: `/tmp/music-tv-dock-gestures.json`

## Music TV dock gestures + pause-idle hide 20260910i
- Mini-dock on `/tv` (`smp-on-tv`): swipe up expand, swipe down stop/hide, swipe L/R prev/next.
- Paused floating dock auto-hides after ~5.5s idle; dock interaction resets; play cancels; Music sheet open skips auto-close.
- Preserves 20260910g TV↔Music audio ducking.
- Report: `/tmp/music-tv-dock-gestures.json`

## Music TV dock gestures + pause-idle hide 20260910i
- Mini-dock on `/tv` (`smp-on-tv`): swipe up expand, swipe down stop/hide, swipe L/R prev/next.
- Paused floating dock auto-hides after ~5.5s idle; dock interaction resets; play cancels; Music sheet open skips auto-close.
- Preserves 20260910g TV↔Music audio ducking.
- Report: `/tmp/music-tv-dock-gestures.json`

## Music scroll / real-estate / audio fade 20260910g
- Axis-lock shelves: vertical drag scrolls `.ml-body`; horizontal pans shelf (fixes thumb blocking scroll).
- Music sheet ~98dvh; tighter head/tabs/search; larger Listen art; removed 96px body pad that made black bar above dock.
- Expanded player: hide mini-dock, pin controls with `margin-top:auto`; dock is flex sibling (no void).
- Smart TV↔Music crossfade (`music_tv_audio.js`): Music intent ducks `#v`; TV intent ducks Music.
- Report: `/tmp/music-scroll-realestate-audiofade.json`

## Music mobile field-fix 20260910e
- Closed Music sheet no longer peeks "Music ✕" over `/tv` (bottom-anchored 92dvh + translateY(100%)).
- Listen/Radio shelves: horizontal `touch-action:pan-x` + overscroll contain; single scroll owner (panel body).
- Unified dock: reparents to `body` as `smp-on-tv` while playing with Music closed; sticky inside open sheet; content padding under dock.
- Report: `/tmp/music-mobile-field-fix.json`

## Unified Music player + Radio top-10 locals 20260909an
- Shared `music_player.js` / `music_player.css` (Spotify-like dock + expanded sheet) used by Radio and Listen — single `<audio>` engine, no dual-audio clash.
- Art area: cover / favicon with brand fallback SVG; optional muted looping video after ~4s crossfade when `video_stream_url` present (Listen progressive preview).
- Radio: curated NYC metro seeds guarantee Hot 97 / Power 105 / Z100 etc. in near-you; titles `CALL · Brand · dial BAND`; ICY now/next via `/api/music/radio/nowplaying`.
- Bundle order: … + **music_player** + player_music + music_radio + music_listen + report.
- Report: `/tmp/music-unified-player.json`

## Music Listen (ytmusicapi) 20260909al
- Backend: `music_ytm_client.py` + `music_stream.py` + `music_listen_routes.py` under `/api/music/listen/*` (search/home/album/playlist/artist/mood/watch + ephemeral stream proxy).
- Streaming only: yt-dlp extract-only → same-origin `/proxy/{token}` byte stream; **no disk archive / download UI**.
- UI: `music_listen.js` + `music_listen.css` mounted into `#musicListenRoot` by `player_music.js` (Radio `#musicRadioRoot` unchanged).
- Deps: `ytmusicapi>=1.12.2`, `yt-dlp`.
- Report: `/tmp/music-listen-ytmusicapi-ship.json`

## Radio Browser music hierarchy 20260909ak
- Backend: `radio_browser.py` + `music_radio_routes.py` under `/api/music/radio/*` (mirror failover, TTL cache, polite upstream throttle + per-IP client limit).
- Hierarchy: Commercial|Internet → State → City → Band → Genre → Station; Near-you via browser geolocation then IP geo (`ip-api` / `ipapi.co`).
- Classification heuristic documented in API `heuristic` payload + NOTES (callsigns/FM-AM/local tags → commercial; internet/web tags + empty geo → internet).
- UI: `music_radio.js` + `music_radio.css` mounted into `#musicRadioRoot` by `player_music.js` (chrome shell from `aj`).
- Report: `/tmp/music-radio-browser.json`

## Music chrome + scrollable action strip 20260909aj
- `.action-group-tools` horizontally scrollable (overflow-x auto, hidden scrollbar, snap proximity, 44px targets) across standard/glass/broadcast/cinema/collapsed.
- Music note icon `#musicCatalogBtn` opens `/music` slide-up sheet (Radio / Listen stubs) via `player_music.js` — same VOD/party catalog chrome.
- Boot: `/music` + `/music/*` not rewritten to `/tv/{last}`; PIN/auth + FastAPI shell routes added.
- Bundle: app + features + cinema + embed + party_av_media + party_av + party + party_invite + party_home + **music** + report → `player_bundle.js`
- Report: `/tmp/music-chrome-scroll-shell.json`

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

## Channel logos (20260909j)
- **Problem:** ~4441 / ~5560 channels had empty `logo` (iptv-org streams omit `tvg-logo`; DDL beyond `meta.json`; some ntv).
- **Fix:** Server-side resolve at catalog/`/channels` build via `supplements/logo_resolve.py`:
  1. Keep existing / override / M3U logo (normalize `http→https`)
  2. iptv-org `logos.json` by `tvg-id` (strip `@feed`)
  3. Pluto CDN for 24-char hex ids (`images.pluto.tv/channels/{id}/colorLogoPNG.png`)
  4. iptv-org name / alt_names match
  5. `meta.json` name match (DDL)
- Index cached under `data/logos/` (CDN URL map — not thousands of binaries in git). TTL `LOGO_INDEX_TTL_SEC` (default 24h). Override dir: `LOGO_INDEX_DIR`.
- Guide UI keeps letter placeholder only when still missing after resolve.
- Optional: `python3 scripts/logo-backfill.py` (warm index + coverage report).
- Neighbors API now includes `logo`.

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

## Watch Party home enrich (20260909u)
- In-app `/party` sheet: hero CTAs (Create / Enter code), nearby-first, continue/recent, public cards, presence, create form (name/public/password)
- New module `player_party_home.js` (bundle after invite); `player_party.js` delegates open/close
- Bundle: `app + features + cinema + embed + party_av_media + party_av + party + party_invite + party_home + report`
- Report: `/tmp/watchparty-home-enrich.json`

## Watch Party home / resume / live channels (2026-09-04)
- **Party Home:** `https://sdgateway.duckdns.org/party` (PIN-gated). Public invite: `/party/join/{code}` (no PIN). Meta: `/party/join/{code}/meta`
- TV guide header: people icon (`#partyHomeBtn`) next to VOD opens Party Home
- Home shows public rooms, presence (`GET /party/presence`), **nearby on Wi‑Fi** (`GET /party/nearby`), recent codes (`sd_party_recent`), suggested from `sd_last_place`, join-by-code, create CTAs
- **Invite sheet** (Link | Wi‑Fi nearby | Near me): copy/`navigator.share`/QR for `/party/join/{code}`; host LAN beacon `POST /party/presence/lan` (fingerprint + public-IP hash + optional Wi‑Fi code); Web NFC write when `NDEFReader` exists
- Bundle: `player_app + features + cinema + embed + party_av_media + party_av + party + party_invite + report` → `player_bundle.js`
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

## 20260909i — EPG season/episode from TVmaze plot match
- Report `report-343-20260909T085411Z-7cd63a8d` (USA Network `343`): guide title OK (SVU) but `season`/`episode`/`episode_label` empty in now-next / X-Ray / info bubble.
- Root cause: epg.pw JSON (and US gzip) ship title+desc only — no episode-num. Parser-only fill (`20260909g`) cannot invent S/E from prose.
- Fix: `supplements/episode_resolve.py` matches subtitle/desc against TVmaze episode summaries; `_programme_to_api` enriches missing S/E (cached under `data/episode_resolve/`).
- Also: stop treating bare `N/M` inside prose as episode codes (`9/11` → false `S9E11`); slash form only when the *entire* token is `N/M`. Re-sanitize epg.pw prog cache on read.
- Channel map unchanged (`465006` / `USANetwork.us`); visual GT = USA bug + SVU.

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

## 20260909v — Watch Party homepage blank thumbnails
- Root: live parties sent posterPath null; cards showed dark LIVE stubs / empty holes.
- Server: list/nearby/join-meta/presence enrich posterPath + logoPath from channel catalog logos.
- Client: contentPayload fills live art (EPG poster then channel logo); homepage cardThumbHtml does poster then logo then letter/gradient with onerror; never empty img src.
- Bundle: app + features + cinema + embed + party_av_media + party_av + party + party_invite + party_home + report

## Live TV player UX polish 20260909w
- Field-tested `/tv/343` + `/tv/337` on SM-G998U CDP 9222 (cold FCP ~250–320ms; first frame ~1.8–3.9s).
- Shipped: LIVE pill + **Jump to live** when ≥3.5s behind edge; optimistic channel zap + switch generation cancel; neighbor logo prefetch / eager logos ±2; now-air EPG skeleton; 44px touch targets for `.btn-icon`; guide sheet `will-change` + row `content-visibility`; show-guide hit area 44px; safe-area aware live chrome.
- Bundle: app + features + cinema + embed + party_av_media + party_av + party + party_invite + party_home + report → `player_bundle.js`
- Report: `/tmp/live-tv-player-fieldtest.json` · shots `/tmp/live-tv-player-ux/`

## LIVE badge fade / hide-by-default 20260909x
- Owner feedback on **20260909w**: LIVE pill was persistently visible.
- Default: LIVE pill hidden (opacity 0). After channel tune / first playing frame (~2.6s): show LIVE (instant paint — Android background tabs freeze CSS fade-in), then fade out.
- When ≥3.5s behind live edge: show LIVE with Jump-to-live; after ~4.5s idle fade LIVE only — Jump stays usable without a permanent badge.
- Yields to party LIVE badge / cast `.casting` chrome (JS `livePillBlockedByChrome`).
- Soft remounts (`?r=`) do not re-flash.
- Bundle: same concat order → `player_bundle.js`

## X-Ray now-air sync 20260909z
- Bug: info-bar title click opened X-Ray for the **previous** EPG slot (stale `currentTitleMeta`) while now-air text already showed the live programme.
- Fix: resolve X-Ray from active now-air (`data-prog-start` / title + `resolveActiveNowProgramme`); invalidate meta bind on slot advance; refresh open X-Ray; prefer EPG now over lagged `/meta/now`.
- Bundle: same concat order → `player_bundle.js` · report `/tmp/xray-now-sync-fix.json`

## Q3 same-channel tap recover 20260909y
- Q3b focused `.ch-cell` (channel column): tapping the **currently tuned** channel resyncs / reloads / reconnects by playback state (not a silent no-op).
- Mapping: healthy → `jumpToLiveEdge` (“Resyncing…”); stalled/buffering → HLS soft reload (“Reloading…”); error/ended/paint-dead → `switchChannel(id,{force:true})` (“Reconnecting…”).
- Guardrails: 1.5s cooldown + in-flight coalesce; ≥4 recoveries / 30s → 5.5s cooldown + “Wait a moment…”; party guest with follow-sync → “Following party host” (no local recover).
- Bundle: same concat order → `player_bundle.js` · report `/tmp/q3-channel-resync.json`

## Guide resize + LIVE quiet + cat tab 20260909z
- Owner feedback on LIVE/Jump flash + missing desktop guide resize + laptop category pull.
- LIVE quiet: 3.2s delay before brief (~1.1s) post-tune pill; Jump only ≥5.5s behind (hysteresis clear @3s); no pulse; lower opacity; guide `● Live` → static `.prog-live-dot` (`animation:none`, glass glow removed).
- Desktop guide grabber on `#guideSheetHandle` resizes `--epg-h` (18–68vh, video min 28vh); persists `sd_guide_epg_h_vh` (mouse + touch).
- Category edge tab `#catDrawerTab` (click/drag) + **C** shortcut (keys help); Esc closes.
- Q3 same-channel recover (`20260909y`) preserved.
- Bundle: same concat order → `player_bundle.js` · report `/tmp/guide-resize-live-quiet.json`

## Jump bubble remove + A/V switch guards 20260909aa
- Owner: Q3 same-channel tap replaces Jump-to-live → remove floating Jump bubble/pill chrome.
- Removed `#jumpLiveBtn` + `.jump-live-btn` CSS/JS show path; kept `jumpToLiveEdge` for Q3 recover; LIVE pill stays quiet delayed flash.
- A/V hunt (Starz 335 hearing USA 343): not repro’d in 150s CDP monitor; Starz/USA not order-neighbors.
- Guards: `stopSecondaryMediaSinks`, pause-on-`destroyHls`, stale `attachHls`/hard-remount/recover gen gates, MediaSession next/prev ignored while foreground live.
- Bundle: same concat order → `player_bundle.js` · audit `/tmp/jump-remove-av-switch-audit.json`

## Category drawer tab ghost 20260909ab
- Soften `#catDrawerTab` / `.cat-drawer-tab`: opacity ~0.42 (hover/focus ~0.88), thinner 13×48 footprint, frosted `backdrop-filter`, softer border/shadow.
- CSS-only in `player.css`; template CSS `?v=` → **20260909ab**; JS left at parallel **20260909aa** (Jump bubble / A-V).

## Prefer-native VOD Auto 20260909ac
- Auto resolve client timeout **22s** (was 12s) — aligns with server `VOD_RESOLVE_TIMEOUT=20`.
- Auto miss no longer silent-flips to Videasy iframe: **showVodHlsFailedGate** (Retry / Use embed / Sources).
- On miss: `all_sources=1` + clean-rank chain (icefy/cinesu/vidapi/…) before gate.
- `sd_vod_hls_only` default **true**; last-good probe short-circuits at 4s.
- Manual picker + Clappr live-only + embed popup guards unchanged.
- Bundle: app + features + cinema + embed + party_av_media + party_av + party + party_invite + party_home + report → `player_bundle.js`
- Report: `/tmp/vod-prefer-native-ship.json`

## VOD resolve restore + /vod boot 20260909ad
- Root cause: Oracle VPS datacenter IP → Cloudflare **403** on VixSrc/Videasy; `CINEPRO_OMSS_URL` unset despite cinepro-core on `:3010`; no `VOD_SOCKS5`.
- Wired `CINEPRO_OMSS_URL=http://127.0.0.1:3010` + residential `VOD_SOCKS5` (home pproxy `:11080` reverse-tunneled to VPS); parallel OMSS+local resolve; OMSS timeout 35s.
- Boot: raw `/vod`, `/vod/movie/{id}`, `/vod/tv/{id}` no longer `history.replaceState` → `/tv/{last}`; skip live `attachHls` on VOD boot; bare `/vod` won't resume a live channel.
- Client Auto resolve timeout **40s** (OMSS+SOCKS).
- Bundle: same concat order → `player_bundle.js` · report `/tmp/vod-resolve-restore.json`

## VOD HLS proxy SOCKS 20260909ae
- Symptom on **ad**: `/vod/resolve` ok (VixSrc via `VOD_SOCKS5`) but `/vod/hls/{sid}.m3u8` → **502 `upstream_manifest_http_403`**.
- Root cause: `step_daddy` proxy only honored `SOCKS5` (unset); resolve used `VOD_SOCKS5` — manifest/segments hit Oracle IP → CF 403.
- Fix: dedicated `_vod_session` from `VOD_SOCKS5` for `proxy_playlist` / `proxy_progressive` / VOD `/content`+`/key`; Chrome UA+Origin match resolver; bare-host Origin → `https://…`.
- Report: `/tmp/vod-hls-proxy-403-fix.json`

## VOD category header nav 20260909af
- Home row titles (Popular Movies/TV, Top Rated, New, More) are clickable **See all** headers.
- Navigate to existing `/vod/movies` / `/vod/shows` with matching `sort` (and genre for related rows).
- Catalog `see_all` metadata on `/vod/catalog/home` sections; CSS affordance + keyboard focus.
- Report: `/tmp/vod-category-header-nav.json`

## VOD chrome bleed + War detail 20260909ag
- Field-test open page: `/vod/movie/10431` — "Could not load details" + ghost YES Network USA under VOD header.
- Root cause (label): not mangled USA Network — live channel YES Network USA HDR bleeding through 98%-opaque VOD sheet.
- Root cause (404): Cinemeta catalog warm-map misses TMDB 10431 (War, 2007 / tt0499556); resolve/HLS still worked.
- Fixes: opaque #080a0e VOD sheet; tv-root.vod-catalog-open hides live collapsed-chrome/cinema; Wikidata TMDB→IMDb fallback in vod_catalog; detail error Retry / Play anyway.
- Bundle: app + features + cinema + embed + party_av_media + party_av + party + party_invite + party_home + report → player_bundle.js
- Report: `/tmp/phone-page-fieldtest-fix.json`


## VOD tap chrome dead 20260909ah
- Symptom: native VOD (`#v` / hls.js) taps showed no playback chrome / scrubber / back.
- Root causes (stacked):
  1. YES Network bleed fix (`20260909ag`) set `.tv-root.vod-hls-playing .trailer-layer { pointer-events: none }` — center taps hit `#v`, not `showHlsChrome` listeners.
  2. `partyChromeIgnore` / cinema `PARTY_IGNORE` included `.party-live-overlay`, but that class is stamped on `#trailerLayer` / `#videoArea` as a layout mode — every VOD tap was ignored while party overlay mode was active (owner's S21 session).
  3. Closed `.vod-catalog` kept `pointer-events: auto` after Play/peek.
- Fixes: `hls-mode` trailer pe:auto + z-index 60; full-bleed `.hls-hotzone`; closed catalog pe:none; drop `.party-live-overlay` from ignore selectors; videoArea tap fallback.
- Bundle: app + features + cinema + embed + party_av_media + party_av + party + party_invite + party_home + report → player_bundle.js
- Report: `/tmp/vod-touch-controls-fix.json`

## More menu clipped 20260909ai
- Symptom: ⋯ (`#guideMoreBtn` / `#liveShareBtn` / VOD `#pcMoreBtn`) appeared dead — menu toggled in DOM but items unusable / invisible.
- Root cause: `.guide-more-menu` was `position:absolute` under `.epg-panel { overflow:hidden }` (all themes) and broadcast `.action-group { overflow:hidden }` (full clip). `position:fixed` alone still failed because `.epg-panel` `will-change/transform` retargets fixed to the panel. Live embed also hid collapsed chrome via `trailer-active`/`overlay-active` rules from `ag` while still needing ⋯.
- Fixes: portal menus to `document.body` + viewport-aware `positionGuideMoreMenu()`; broadcast `.action-group-view { overflow:visible }`; live-embed restores collapsed chrome visibility; HLS `toggleMenu` portals too; keep VOD `hls-mode` pe:auto from `ah`.
- Bundle: app + features + cinema + embed + party_av_media + party_av + party + party_invite + party_home + report → player_bundle.js
- Report: `/tmp/more-menu-themes-fix.json`

## Music Listen wide responsive 20260910aa
- Library/focus chips: single horizontally scrollable rail (Home/Radio/Listen + All/Stations/…); no multi-row wrap.
- Plus (+) add-to-playlist on tracks, albums, artists, stations, shelf/search cards via `SDMusicLibrary.quickAdd`.
- Listen layout: featured row + Songs list + Albums shelf; TV guide blues/greys (not neon/lime).
- Wide/desktop: Music sheet expands to ~1280–1440px; songs|albums side-by-side; phone stays single-column.
- Preserve Media Session / shared player / Home chips.
- Bundle: app+features+cinema+embed+party*+music*+report → player_bundle.js · report `/tmp/music-listen-wide-responsive.json`
## Music Listen nested-button layout fix 20260910ab
- Featured/shelf cards use `div[role=button]`; add (+) is `span[role=button]` to avoid nested `<button>` DOM repair that broke featured row.
- Chip rail single-line scroll hardened (`nowrap !important`, max-content host).

## Music header nav 20260910ac
- Home / Radio / Listen moved into Music sheet header: **Music | [Home] [Radio] [Listen]** … ✕
- Removed duplicate secondary tab row from chip rail; focus chips (All/Stations/…) stay under search.
- Continues wide sheet + single-line chips + add-to-playlist + TV-guide blues from 20260910aa/ab.

## Music scroll smooth + anti-refresh 20260910ao
- Smoother Music sheet/shelf scroll: overscroll contain, touch axis-lock with rAF+inertia, less paint thrash (dock blur off, lighter hero blur).
- Pull-to-reload disabled inside open Music catalog; higher threshold + Music body scrollTop awareness so nested scroll no longer false-triggers reload.
- Preserve Home discovery / chips / player / Media Session.
- Bundle: app+features+cinema+embed+party*+music*+report → player_bundle.js · report `/tmp/music-scroll-smooth-antirefresh.json`
