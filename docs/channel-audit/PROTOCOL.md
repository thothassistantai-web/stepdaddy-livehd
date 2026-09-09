# Single-channel audit protocol (gapless)

Reusable checklist for **one** StepDaddyLiveHD channel — repair, rebuild, or maintenance.
Goal: no blind spots across identity, stream, playback surfaces, EPG, metadata, and UX.

**Neutral wording only.** Do not put personal names in audit records, scripts, comments, or shared docs.
**Never** paste PINs, cookies, share tokens, or full signed `/content/` URLs into audit JSON or reports — hosts and path *kinds* only.

Related files:

| Artifact | Path |
|----------|------|
| Schema | `docs/channel-audit/schema/channel-audit.schema.json` |
| Empty template | `docs/channel-audit/template/channel-audit.template.json` |
| Auditor | `scripts/channel-audit.py` |
| Confirmed-case registry | `data/epg_confirmed_corrections.json` |
| Correction algorithm | `scripts/epg_correction.py` |
| Examples | `docs/channel-audit/examples/` |

---

## How to run (one channel)

```bash
cd /home/nova/StepDaddyLiveHD

# Public gateway (default)
python3 scripts/channel-audit.py 343

# Explicit gateway + write under docs/channel-audit/examples
python3 scripts/channel-audit.py 51 \
  --gateway https://sdgateway.duckdns.org \
  --out docs/channel-audit/examples

# Optional: grab ffmpeg frame + ffprobe segment (slower)
python3 scripts/channel-audit.py 343 --probe-media --grab-frame

# Local backend / VPS tunnel
python3 scripts/channel-audit.py 343 --gateway http://127.0.0.1:3000
```

Optional VPS live probe (operator machine):

```bash
ssh -i ~/.ssh/oracle_openclaw_instance -o IdentitiesOnly=yes opc@129.80.78.103
# then curl localhost:3000 or use public https://sdgateway.duckdns.org from laptop
```

After the script: complete **HUMAN** fields in the JSON (visual EPG match, paint-death, TiviMate UI number, favorites).

---

## Phase order (do not skip)

### Phase 0 — Scope lock

1. Confirm the **gateway stream id** (not the TiviMate on-screen number).
2. Note sibling ids (e.g. `343` USA Network vs `3010` USA Network USA).
3. Record gateway base (`https://sdgateway.duckdns.org` or local).
4. Record operator label + timestamp (neutral).

### Phase 1 — Identity

| Check | Auto / Human | Notes |
|-------|--------------|-------|
| Channel id | Auto | `/channels`, `/channels/neighbors/{id}` |
| Display name | Auto | catalog `name` |
| Aliases / siblings | Mixed | search `/channels/search?q=`; neighbors; name overrides |
| Provider / source | Auto | `DaddyLive` / `ddl`, FreeTV, iptv, ntv, dulo, adultswim… |
| Tags / group / adult | Auto | `#` tags; adultswim / adult tag heuristics |
| Playlist index vs number | Auto | neighbors `index` / `number` |
| TiviMate UI number | **Human** | Often ≠ playlist number |
| Logo URL + load | Auto | GET `/logo/...` (status, type, bytes) |
| Dead / CDN flags | Auto | catalog + `/live/{id}/meta` |
| Top-network candidate | Auto | name regex (ESPN, CNN, USA, HBO…) |
| Favorites | **Human** | device `localStorage` / client profile |

### Phase 2 — Stream probe

| Check | Auto / Human | Notes |
|-------|--------------|-------|
| Path matrix | Auto | `/live/{id}.m3u8`, `/stream/{id}.m3u8`, `/live/{id}/embed`, embed.m3u8, `/tv/{id}`, `/play/{id}` |
| Proxy mode | Auto | `/content/` vs direct CDN vs embed |
| Upstream host family | Auto | meta `referer_host` / embed host — **host only** |
| Header needs (high-level) | Auto | referer required for DDL; no secret values |
| Playlist kind | Auto | master vs media; `#EXT-X-MAP` → fMP4 hint |
| ABR ladder | Auto | parse `#EXT-X-STREAM-INF` |
| Segment sample | Auto | first segment via proxy; MPEG-TS sync / 188 |
| Codecs / profile / level | Auto* | playlist CODECS + optional ffprobe |
| Resolution / FPS / bitrate | Auto* | STREAM-INF + ffprobe |
| Interlaced vs progressive | Auto* | ffprobe `field_order` / assume progressive if unknown |
| Stream status | Auto | live / 403 / 404 / 5xx / timeout / cdn flags |

\* Requires `--probe-media` (ffprobe) for full codec detail.

### Phase 3 — Playback surfaces

| Surface | Path | Auto / Human |
|---------|------|--------------|
| Mobile `/tv` MSE (hls.js) | `/tv/{id}` | Mixed — auto risk flags; **human** paint confirm |
| `/play` page | `/play/{id}` | Mixed |
| Clappr embed | `/live/{id}/embed` | Auto HTTP + **human** visual |
| TiviMate / ExoPlayer | playlist / `/tivimate-stream/` if present | **Human** (or APK field test) |
| Gateway APK native | local ServerService | **Human** |

Decode checklist (always fill):

- MSE vs ExoPlayer difference for this feed
- Green/black / paint-death history for this id or codec class
- Single High@1080 ABR rung → known Chrome MSE risk class
- Whether a lighter variant exists (`preferLighterVariant` useful or not)

### Phase 4 — EPG

| Check | Auto / Human |
|-------|--------------|
| `tvg_id` | Auto |
| Match method / confidence | Auto `/epg/match/{id}` |
| EPG source family | Auto (woftv / epgpw / pluto / android_id_map / none) |
| now / next | Auto `/epg/now-next/{id}` |
| Schedule density | Auto `/epg/schedule/{id}` |
| Wall-clock / daypart | Auto — `America/New_York` hour → `daypart_hint` |
| Title vs daypart sanity | Auto — overnight news titles in US daytime → `mismatch_suspected` |
| `epg_match_status` | Auto (+ human upgrade) — see below |
| Region / language hints | Mixed (tags, tvg suffix `.us` / `.uk`) |
| Confirmed language | **Human** |
| **Visual EPG match** (title vs screen) | **Human** (or OCR / `epg-crossmatch.py`) |
| Wrong-feed / bumper suspect | Mixed |

#### `epg_match_status` (required)

| Status | Meaning |
|--------|---------|
| `api_only` | now/next non-empty (or empty) from API; **no** daypart pass and **no** visual confirm |
| `title_plausible` | Auto daypart heuristic OK for region; still **not** visually confirmed |
| `visually_confirmed` | HUMAN (or tooling) set `visual_epg_match=match` |
| `mismatch_suspected` | Daypart fail and/or `visual_epg_match=mismatch` |

**Hard rule:** Non-empty `/epg/now-next` alone must **never** produce overall `health=healthy` with `severity=none`. At best `title_plausible` + low severity until visual confirm. `mismatch_suspected` → `epg_only_issue`. Never mark healthy on non-empty alone — daypart + visual gates are mandatory (protocol 1.1+ / auditor 1.2+).

---

### Phase 4b — Confirmed-case feedback loop (required)

We do **not** treat one-off map pins as the end of a repair. High-confidence, **visually confirmed** resolutions must improve the reusable correction algorithm.

| Artifact | Path |
|----------|------|
| Confirmed-case registry | `data/epg_confirmed_corrections.json` |
| Correction algorithm CLI | `scripts/epg_correction.py` |
| Auditor wiring | `scripts/channel-audit.py` (consults + can register) |

**Rules:**

1. **Every** repair that reaches `epg_match_status=visually_confirmed` **MUST** be written into the registry (exact gateway id, `tvg_id`, epg.pw pin, ground-truth title, root-cause class, `resolution_version`).
2. **Every** future audit **MUST** consult the registry: classify the failure, attach proven resolutions for that gateway id, and prefer global rules proven by the same root-cause class.
3. Same-class lessons (e.g. `gzip_tz_poison`) inform **algorithm steps** and global gateway behavior — they must **not** blindly copy another channel’s pin onto an unrelated id.
4. Fingerprint OCR store (`data/epg_fingerprint_registry.json`) is **not** a substitute for this registry.

**Root-cause classes (playbook):** `empty` · `gzip_tz_poison` · `wrong_tvg` · `affiliate_collision` · `wrong_feed` · `wrong_network` / `wrong_label` · `bridge_mismatch` · `false_healthy` · `paid_programming_poison`

| Class | vs neighbors |
|-------|----------------|
| `wrong_tvg` | Stream network is correct; only the tvg/EPG id is wrong (or empty). |
| `wrong_feed` | Mapped EPG network ≠ what the stream is airing (feed swap / bumper). |
| `wrong_network` / `wrong_label` | **Catalog/display label is the wrong network** (e.g. labeled MeTV/My9 but on-screen bug is FOX 5). Fix display name + tvg + epg.pw pin together; supersede any prior confirmed case for that gateway id. Prefer **station call signs** (WNYW, WWOR, …) over marketing names. |

#### Local / news identity — station-code confirmation tier

US OTA **locals and news** must not be confirmed from DaddyLive marketing names alone (`MY9TV`, `Fox 5`, `FOXNY`, `My9`, `My9 USA`, `My9 NJ`). Those labels collide, get swapped upstream, and sometimes split the **same** call sign (WWOR = Secaucus NJ MyNetworkTV, marketed My9 / My9 NJ).

| Tier (highest → lowest) | Meaning | Confidence |
|-------------------------|---------|------------|
| `station_code_visual` | Frame/OCR shows call sign (**WNYW**, WWOR, WABC, WNBC, WCBS, …) | high |
| `station_code_epg` | `tvg_id` / epg.pw pin is call-sign based (`WWOR-DT…`) and programmes match **now** | high |
| `network_bug_visual` | Definitive on-screen network bug **including affiliate URL** (e.g. **my9** + my9nj.com, **FOX 5** + fox5ny.com) | high |
| `catalog_marketing_name` | Guide/catalog brand text only | **low** for locals |

**Hard rules:**

1. Prefer matching EPG/tvg pins by **call sign / station code** over marketing names — but the call sign must be the **correct** affiliate (NJ My9/`WWOR` ≠ NYC Fox/`WNYW`).
2. Visual network bug (especially **bug + station URL**) or station-code OCR **overrides** catalog display name (`wrong_label` / `wrong_network` ± `wrong_tvg` / `affiliate_collision`).
3. Coincidental programme-title match (syndicated shows like Maury / Jennifer Hudson) is **not** identity proof when the bug disagrees; conversely, when the operator corrects identity, **trust latest operator + airing GT + bug URL** over a prior visual registry case.
4. Prior wrong visual calls (e.g. mistaking a sibling Fox 5 frame or commercial for My9) **must be superseded**, not defended by registry inertia.
5. Confirmed local cases in `data/epg_confirmed_corrections.json` **MUST** store `call_sign` and `identity_tier`; supersede prior wrong-identity pins (`status=superseded`).
6. Display/logo fixes for mislabeled gateway ids go in `assets/channel_identity_overrides.json` (applied at playlist/API build). Sibling gateways (e.g. **768** FOXNY) must be verified separately — do not blindly share/remove pins.

Helpers: `scripts/epg_correction.py` → `extract_call_sign`, `identity_confirmation_tier`, `register_confirmed_case(..., call_sign=..., supersedes=...)`.

**Global algorithm steps already in the running gateway (do not re-pin per channel):**

1. `EPGPW_PREFER_JSON=1` — JSON-first; US gzip is fallback only (`20260908p`).
2. When JSON preferred, gzip must **not** overwrite shared `prog_{id}.json` (`20260908q`).
3. Auditor never yields `severity=none` healthy from non-empty now/next alone (`20260908p` / auditor 1.2).

**Register after visual confirm:**

```bash
python3 scripts/channel-audit.py 51 \
  --visual-match match \
  --ground-truth-title "The View" \
  --register-confirmed \
  --register-pin 464902 \
  --register-root-cause gzip_tz_poison \
  --register-version 20260908p \
  --md

# or directly:
python3 scripts/epg_correction.py register \
  --gateway-id 654 --tvg-id WNYW-DT.us_locals1 --epgpw-pin 468913 \
  --ground-truth "Fox 5 News" --root-cause wrong_label \
  --version 20260908w --previous-tvg-id WWOR-DT.us_locals1 \
  --display-name "FOX 5 NYC" --call-sign WNYW \
  --identity-tier network_bug_visual --visual-network-bug \
  --supersedes my9tv-usa-654-20260908u \
  --secondary wrong_tvg,affiliate_collision,wrong_feed
```

---

### Phase 5 — Metadata & continuity

| Check | Auto / Human |
|-------|--------------|
| Neighbors prev/next | Auto |
| Media-session / now-playing title | **Human** |
| Last verified + verifier | Auto (this run) + optional human |
| Prior incidents | Mixed — link field-test dirs / NOTES bullets (no secrets) |

### Phase 6 — UX

| Check | Auto / Human |
|-------|--------------|
| `/tv` vs TiviMate path differences | Mixed |
| Guide search by name | **Human** |
| Icon recognizable | **Human** |
| Group placement | **Human** |
| Numbering confusion risk | Auto if playlist number ≫ common expectation; confirm human |

### Phase 7 — Verdict

1. Set `health`: `healthy` | `degraded` | `broken` | `epg_only_issue` | `client_path_issue` | `unknown`
2. Set overall `severity`
3. List `repair_actions` (severity + owner: gateway / epg / client / upstream / operator)
4. List `blind_spots_remaining` (every unchecked HUMAN field)
5. Mark all protocol phases `complete` | `partial` | `failed`

---

## Extra gapless items (beyond the brief)

Operators must also consider:

1. **Clock skew** — `#EXT-X-PROGRAM-DATE-TIME` vs wall clock vs EPG window.
2. **DRM / encrypted media** — `#EXT-X-KEY` presence (unexpected on free feeds).
3. **Audio-only / video-missing** — ffprobe stream presence.
4. **CEA-608/708 / CLOSED-CAPTIONS** — playlist attribute.
5. **Ad stitch / bumper density** — false EPG mismatch.
6. **Geo / ASN blocks** — VPS OK, home ISP fail (or reverse).
7. **IPv6 vs IPv4** CDN differences.
8. **HTTP/2 / TLS fingerprint** sensitivity (high-level note only).
9. **Playlist cache staleness** — gateway stream cache vs fresh resolve.
10. **Duplicate feeds** — same network, different id/quality/region.
11. **Adult / kids / news policy tags** — wrong group → wrong PIN profile exposure.
12. **Supplement vs DaddyLive** — no embed path for supplements; different failure modes.
13. **Stability / paint-grace settings** — client version that last verified.
14. **EPG map authority** — file map vs auto map overwrite risk.
15. **Share-link path** — optional; do not store share tokens in the audit record.

---

## Auto vs human (summary)

**Fully auto (script):** identity catalog fields, neighbors, logo GET, live meta hosts, playlist/ABR parse, path HTTP matrix, segment TS heuristics, EPG match/now-next/schedule sample, **daypart / `epg_match_status`**, **registry classify + correction hints**, top-network heuristic, single-1080-High risk flag, draft repair actions, timestamps.

**Auto with flags:** `--probe-media` (ffprobe), `--grab-frame` (ffmpeg JPEG), `--visual-match` / `--register-confirmed` (operator-gated write-back to registry).

**Human (always):** visual EPG match (required to reach `visually_confirmed`), confirmed language, paint-death observed, TiviMate UI number, favorites, guide search/icon/group UX, on-device media-session title, final health if surfaces disagree. After visual confirm: **register the case** (Phase 4b).

---

## Severity guide

| Severity | Examples |
|----------|----------|
| critical | Playlist dead / persistent 403–502 on all paths; black screen all surfaces |
| high | CDN ToS block; wrong feed; EPG mapped to different network |
| medium | MSE paint-death but embed/TiviMate OK; missing EPG data on major net; **daypart mismatch** (overnight title in US daytime) |
| low | Logo fail; numbering confusion; thin schedule; **API-only EPG** (`title_plausible` / `api_only`) awaiting visual |
| info | Notes, historical context, cosmetic tags |

---

## Worked example — ABC USA false `healthy` (20260908o → 20260908p)

**Ids:** guide ch **20** = playlist #20 = gateway **`51`** ABC USA · `tvg_id=ABC.us` · epg.pw **`464902`** (ABC National Feed).

### What went wrong

1. Prior repair pinned `464902` and saw non-empty now/next → auditor set **`health=healthy`**.
2. Gateway preferred **US country XMLTV gzip** for mapped US ids. That dump stamps many slots as `+0000` while the clock values are effectively **local/wrong**, shifting daytime shows ~8h (The View at **23:00Z** in gzip vs **15:00Z** in JSON).
3. At ~11:50 ET the live stream was **The View**, but `/epg/now-next/51` showed **ABC World News Now** (overnight block from the skewed gzip schedule).
4. `visual_epg_match` stayed `not_checked` — still marked healthy because the verdict treated “has_data + live stream” as success.

### Correct detection (protocol 1.1+)

- Auto: US **daytime** + overnight title → `epg_match_status=mismatch_suspected` → `health=epg_only_issue` (not healthy).
- Fix: prefer epg.pw **per-channel JSON** over US gzip (`EPGPW_PREFER_JSON=1`); keep pin `464902`; clear `prog_464902` cache; redeploy.
- Confirm: `/epg/now-next/51` now_title ≈ **The View** during weekday late morning ET; HUMAN sets `visual_epg_match=match`.

Artifacts: `docs/channel-audit/examples/repair-abc-usa-20260908p/`.

---

## Output location

Default: `docs/channel-audit/examples/audit-{id}-{timestamp}.json`  
Also write a short Markdown twin when `--md` is passed.

---

## Client reports (`/tv` ⋯ → Report)

Field operators can file a **channel report** from the guide multi-menu without leaving playback.

| Piece | Path / API |
|-------|------------|
| UI | `/tv` → `#guideMoreBtn` ⋯ → **Report** (also collapsed chrome live ⋯) |
| Client | `player_assets/player_report.js` → `window.SDReport` |
| API | `POST /api/channel-reports` · `GET /api/channel-reports` · `GET /api/channel-reports/{id}` |
| Storage | `logs/channel-reports/report-{channel}-{ts}-{id}.json` + `index.jsonl` |

Payload includes: channel id/name, tvg, EPG now/next, stream/playback state, bundle version, device/UA, optional screenshot (video frame preferred), categories, severity, **ground-truth title**, **what's actually airing**, notes, and attached client audit JSON.

**Effectiveness helpers:** severity + multi category tags, ground-truth / actually-airing fields, audit JSON attach toggle, client+server **duplicate suppression** (~15 min fingerprint). Use reports as triage seeds into `scripts/channel-audit.py` + `data/epg_confirmed_corrections.json` — never paste PINs/tokens into notes.
