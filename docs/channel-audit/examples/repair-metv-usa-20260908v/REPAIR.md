# METV USA EPG repair 20260908v

## Identity
- Guide **ch 622** = playlist #622 = gateway **662** METV USA
- (Gateway id **622** is Cosmote Sport 1 Greece — do not confuse)
- Pre: `tvg_id=WZVNTV262.us` (empty; bridge → MeTV.Plus) · no epg.pw pin
- Post: `tvg_id=Me.TV.Network.us2` · epg.pw pin **465323** (Me TV Network) · `prefer_source=json`

## Wrong conclusion (pre)
`/epg/now-next/662` empty (`has_data=false`). Stream live (768x432); MeTV bug on-screen; visual GT: **The Waltons**.
Root cause: wrong/empty tvg (`WZVNTV262.us` → Plus bridge) with **no epg.pw pin** → class `empty` (+ `wrong_tvg` / `affiliate_collision`).

## Fix
- Authoritative map `662` → `Me.TV.Network.us2`; `channel_epg_map` + name override same
- Pin `assets/epgpw_channel_map.json` **465323** → gateway `662` / `Me.TV.Network.us2` / JSON
- Bridge: add `Me.TV.Network.us2`; leave `WZVNTV262.us` → MeTV.Plus for OTA callsign only
- Deploy VERSION **20260908v**; clear `prog_465323` cache; restart `stepdaddy-livehd`
- Confirm: now_title **The Waltons** @ 16:00–17:00Z (2026-09-08); next **Gunsmoke**

## Verify
```bash
curl -sS https://sdgateway.duckdns.org/epg/now-next/662
# expect now_title The Waltons (weekday ~12:00 ET / 16:00Z on 2026-09-08)
curl -sS 'https://sdgateway.duckdns.org/health?lite=1' | jq .bundle_version
# expect 20260908v
python3 scripts/channel-audit.py 662 --md --visual-match match \
  --ground-truth-title "The Waltons" --register-confirmed \
  --register-pin 465323 --register-root-cause empty --register-version 20260908v
# expect epg_match_status=visually_confirmed; health=healthy
```
