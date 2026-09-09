# My9 NJ / WWOR repair 20260908x (supersedes Fox 5 20260908w + My9 USA 20260908u)

## Identity
- Playlist/guide **#655** = neighbors.number **655** = gateway **654**
- DaddyLive catalog: **MY9TV USA**; prior override **FOX 5 NYC** (wrong)
- Visual: on-screen **my9** bug + **my9nj.com** + **The Jennifer Hudson Show** → **My9 NJ**
- Call sign: **WWOR** (licensed Secaucus, NJ MyNetworkTV) · identity_tier: `network_bug_visual`
- epg.pw: **468489** WWOR-DT · `tvg_id=WWOR-DT.us_locals1` · now_title **The Jennifer Hudson Show** (18:00–19:00Z)
- (Gateway id **655** is WETV USA — do not confuse)
- Sibling **768** FOXNY USA verified separately: **FOX 5** + fox5ny.com → keep **WNYW** / **468913**

## Wrong conclusions (superseded)
- **20260908u:** Pinned WWOR as **MY9TV USA** (right station, weak marketing label).
- **20260908w:** Remapped to **WNYW** / Fox 5 NYC on a prior visual call. Live frames + operator GT show that was wrong: bug is **my9nj.com**, slate matches WWOR Jennifer Hudson (not WNYW Family Feud).

## Fix
- Authoritative map `654` → `WWOR-DT.us_locals1` (revert WNYW)
- Pin `assets/epgpw_channel_map.json` **468489** WWOR-DT JSON → gateway `654`; remove `654` from WNYW **468913** (leave **768**)
- Display/logo: `assets/channel_identity_overrides.json` → **My9 NJ** + My9 logo
- Name override: `654` → **My9 NJ**
- Registry: supersede `fox5-nyc-wnyw-654-20260908w`, `fox-5-nyc-654-20260908w`, `my9tv-usa-654-20260908u`; register `my9-nj-wwor-654-20260908x`
- Protocol: marketing names + prior wrong visual calls; station codes must match correct affiliate; bug URL matters
- Deploy VERSION **20260908x**; clear `prog_468489` (+ stale `prog_468913` for 654); restart `stepdaddy-livehd`

## Verify
```bash
curl -sS https://sdgateway.duckdns.org/channels | jq '.[] | select(.id=="654" or .id=="768") | {id,name,tvg_id}'
# expect 654 My9 NJ / WWOR-DT.us_locals1; 768 FOXNY / WNYW-DT.us_locals1

curl -sS https://sdgateway.duckdns.org/epg/now-next/654
# expect tvg_id WWOR-DT.us_locals1; now_title The Jennifer Hudson Show (weekday ~14:00 ET / 18:00Z)

curl -sS 'https://sdgateway.duckdns.org/health?lite=1' | jq .bundle_version
# expect 20260908x
```
