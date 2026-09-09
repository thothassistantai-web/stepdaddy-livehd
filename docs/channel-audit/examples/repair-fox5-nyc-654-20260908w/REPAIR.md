# FOX 5 NYC / WNYW repair 20260908w (supersedes MY9 20260908u)

## Identity
- Playlist/guide **#655** = neighbors.number **655** = gateway **654**
- DaddyLive catalog name was **MY9TV USA** (wrong)
- Visual: on-screen **FOX 5** bug + NYC local news (Hochul / NYPD) → **WNYW**
- Call sign: **WNYW** · identity_tier: `network_bug_visual`
- (Gateway id **655** is WETV USA — do not confuse)
- Sibling: gateway **768** FOXNY USA is also WNYW (already labeled); shares epg.pw pin

## Wrong conclusion (20260908u)
Pinned epg.pw **468489** WWOR / `WWOR-DT.us_locals1` because now/next was empty and operator GT **Maury** matched WWOR schedule. Maury is syndicated; an earlier frame may have shown My9 branding, but **fresh frames show FOX 5**. Catalog marketing name + coincidental title ≠ identity. Class: `wrong_label` (+ `wrong_tvg` / `affiliate_collision`).

## Fix
- Authoritative map `654` → `WNYW-DT.us_locals1` (was WWOR)
- Authoritative map `768` → `WNYW-DT.us_locals1` (lock)
- Pin `assets/epgpw_channel_map.json` **468913** WNYW-DT JSON → gateways `654` + `768`; remove `654` from WWOR **468489**
- Display/logo: `assets/channel_identity_overrides.json` → **FOX 5 NYC** + Fox logo for `654`
- Name overrides: `MY9TV USA` / `FOX 5 NYC` / `FOXNY USA` → `WNYW-DT.us_locals1`
- Registry: supersede `my9tv-usa-654-20260908u`; register `fox5-nyc-wnyw-654-20260908w` with `call_sign=WNYW`
- Protocol/algorithm: station-code confirmation tiers; `wrong_label`; visual bug overrides catalog
- Deploy VERSION **20260908w**; clear `prog_468913` (+ stale `prog_468489`); restart `stepdaddy-livehd`

## My9 / WWOR outcome
- No other DaddyLive gateway found for true My9/WWOR
- Supplement **dulo** channel `My9 New York` (`dulo:4e657464-12df-4655-a61f-7210aff55aff`) remains the My9 option
- WWOR epg.pw **468489** no longer pinned to any DDL gateway

## Verify
```bash
curl -sS https://sdgateway.duckdns.org/channels/654 | jq '{id,name,tvg_id,logo}'
# expect name FOX 5 NYC, tvg_id WNYW-DT.us_locals1

curl -sS https://sdgateway.duckdns.org/epg/now-next/654
# expect tvg_id WNYW-DT.us_locals1; daytime titles from WNYW (e.g. The Noon / 25 Words or Less / TMZ)

curl -sS 'https://sdgateway.duckdns.org/health?lite=1' | jq .bundle_version
# expect 20260908w

python3 scripts/channel-audit.py 654 --md --grab-frame --visual-match match \
  --ground-truth-title "Fox 5 News (previously recorded)" \
  --register-confirmed --register-pin 468913 \
  --register-root-cause wrong_label --register-version 20260908w
```
