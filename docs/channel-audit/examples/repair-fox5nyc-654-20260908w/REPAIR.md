# FOX 5 NYC (WNYW) wrong_network repair 20260908w

## Identity
- Playlist/guide **#655** = neighbors.number **655** = gateway **654**
- Upstream DaddyLive label was **MY9TV USA**; on-screen bug is **FOX 5** (WNYW / Fox 5 New York)
- Sibling **768** FOXNY USA already mapped `WNYW-DT.us_locals1` (was empty — share same epg.pw pin)
- Gateway id **655** is WETV USA — do not confuse
- **Not** gateway **662** METV USA (MeTV bug + westerns confirmed separately)

## Evidence
- Frame `artifacts/654-frame.jpg` / `654-gt.jpg`: FOX 5 bug + clock/temp; news package (Gov. Hochul / previously recorded)
- Frame `artifacts/662-frame.jpg`: MeTV bug during western — 662 stays MeTV

## Wrong conclusion (20260908u)
Pinned empty WWOR → `WWOR-DT.us_locals1` / epg.pw **468489** and marked healthy on My9 titles (**Maury** / **THE NOON**). Root cause was **wrong_network** (catalog + tvg), not merely `empty`.

## Fix
- Display name override `assets/channel_name_overrides.json`: `654` → **FOX 5 NYC**
- Authoritative map `654` → `WNYW-DT.us_locals1`
- Pin epg.pw **468913** (WNYW-DT) → gateway `654` (+ `768`); `prefer_source=json`
- Remove gateway `654` from WWOR pin **468489**
- Supersede registry case `my9tv-usa-654-20260908u`
- Protocol: add root-cause class **`wrong_network`**
- Deploy VERSION **20260908w**; clear `prog_468913` cache; restart `stepdaddy-livehd`

## Verify
```bash
curl -sS https://sdgateway.duckdns.org/channels/neighbors/654
# expect name FOX 5 NYC
curl -sS https://sdgateway.duckdns.org/epg/now-next/654
# expect tvg_id WNYW-DT.us_locals1; daytime titles from WNYW JSON
curl -sS 'https://sdgateway.duckdns.org/health?lite=1' | jq .bundle_version
# expect 20260908w
```
