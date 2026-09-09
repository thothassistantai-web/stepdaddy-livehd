# `/tv` portrait UI map (quadrants / bands)

Annotated screenshot: [`tv-portrait-quadrants-annotated.png`](./tv-portrait-quadrants-annotated.png)

Source capture: phone Chrome at `gateway.duckdns.org` (portrait). Zones are **horizontal bands**, not a 2×2 grid.

Handlers aligned with StepDaddyLiveHD (`player_bundle.js`, `advanced_player_template.py`).

---

## Bands (top → bottom)

| Band | Region | App? | What it is |
|------|--------|------|------------|
| **Q0** | System + browser chrome | No | Android status bar + Chrome address bar (`gateway.duckdns.org`) |
| **Q1** | Video stage | Yes | Live/VOD playback surface (`#videoArea`) |
| **Q2** | Cinema / control strip | Yes | Guide sheet handle + top bar (channel + tools) |
| **Q3** | EPG guide | Yes | Day/time header, channel column, programme grid |
| **Q4** | Android nav | No | Recents / Home / Back (system) |

---

## Element callouts

### Q0 — System + browser (not app)
| ID | Element | Notes |
|----|---------|-------|
| **0a** | Android status bar | Time, notifications, battery |
| **0b** | Browser address bar | URL / tabs / menu — outside the `/tv` app |

### Q1 — Video stage
| ID | Hotzone | Behavior (from code) |
|----|---------|----------------------|
| **1a** | Center / main surface | Guide **visible** → tap collapses to immersive; guide **hidden** → restores last sheet snap (peek/mid/expanded). Debounced ~320ms. Ignores real buttons/chrome. |
| **1b** | Left edge (~0–12% width) | When guide collapsed: channel **−**; hold ≥420ms → rapid zap |
| **1c** | Right edge (~88–100% width) | When guide collapsed: channel **+**; hold → rapid zap |

Also: `#tapPlay` overlay (“Tap to play/retry”) when stream needs a gesture; `#liveEmbedGuideHotspot` mirrors guide toggle during Clappr embed.

### Q2 — Cinema / control strip
| ID | Element | DOM / action |
|----|---------|--------------|
| **2a** | Drag handle (grey pill) | `#guideSheetHandle` — drag snaps peek (26vh) / mid (45vh) / expanded (62vh); full pull-down can hit immersive |
| **2b** | Channel + programme title | `#nowOnAir` / `.hdr-ch` → `openChannelInfo`; programme title / poster → X-Ray. On portrait / `max-width: 720px`, **title is a full-width row** (with optional poster); VOD / Party / Search / X-Ray / Settings / Cast / ⋯ sit on a **second icon row** (`.top-actions`). |
| **2c** | Filmstrip icon | `#vodCatalogBtn` → VOD catalog |
| **2d** | People icon | `#partyHomeBtn` → Watch Party home |
| **2e** | Search | `#searchBtn` → search drawer |
| **2e2** | X-Ray | `#xrayBtn` → programme X-Ray panel (visible in portrait Q2; same icon style as other tools) |
| **2f** | Settings / theme | `#settingsBtn` → settings drawer (themes cinema/standard/glass/broadcast) |
| **2f2** | Cast / AirPlay | `#castBtn` → `SDCast.prompt()` (Remote Playback / AirPlay picker / Cast Web Sender / Presentation API; best-effort for HLS.js MSE) |
| **2g** | Chevron | `#guideToggle` → collapse / show guide |
| **2h** | ⋯ menu | `#guideMoreBtn` → share, **Cast / AirPlay**, settings, simple player, party, search, cinema layout, cycle theme, **Report**, collapse |

On narrow portrait, `#dirLink` stays CSS-hidden; `#xrayBtn` remains visible in the Q2 tools strip. Title no longer shares a single flex row with the icon strip (see `.top-bar` wrap rules in `player.css`). X-Ray panel **▶ VOD** opens `/vod/{movie\|tv}/{id}` detail for the matched title (TMDB / IMDb / catalog search).

### Q3 — EPG guide
| ID | Element | Notes |
|----|---------|-------|
| **3a** | Day + time header | `#dayLabel` + `#timeRow` (e.g. Wednesday · 12:00 / 12:30 / 1:00 AM) |
| **3b** | Channel column | `#chScroll` — selected row (A&E USA) with focus indicator; tap switches channel |
| **3c** | Programme grid | `#gridScroll` — cells (e.g. Squatters, Live, Nightline); tap tunes / opens info |
| **3d** | Category drawer | `#catDrawer` — swipe/pull **3b left→right** to slide in from off-screen left of Q3. Lists **All**, **Favorites** (gapless), **Recent**, then sectioned facets: **Genres** → **Distributors** → **Countries** → **Languages** (omit empty). Keys persist as `genre:…` / `distributor:…` / `country:…` / `language:…` in `sd_guide_category` (legacy `group:`/`tag:` migrated). Tap a row to filter the guide (no holes). Swipe drawer closed (right→left) or tap `#catDrawerScrim` to collapse. |

### Q4 — Android nav (not app)
| ID | Element | Notes |
|----|---------|-------|
| **4a** | System gesture/nav bar | Recents · Home · Back — OS chrome |

---

## Quick discussion shorthand

- “**Q1 center**” = guide ↔ immersive toggle  
- “**Q2 handle**” = sheet height snap  
- “**Q2b**” = channel info bar  
- “**Q3b/Q3c**” = pick channel vs pick programme  
- “**Q3d**” = category drawer (swipe 3b L→R)  
- “**Q0 / Q4**” = ignore for app UX work  
