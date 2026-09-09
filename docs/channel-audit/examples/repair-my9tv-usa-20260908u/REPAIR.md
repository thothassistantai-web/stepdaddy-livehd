# MY9TV USA EPG repair 20260908u

## Identity
- Playlist/guide **#655** = neighbors.number **655** = gateway **654** MY9TV USA
- (Gateway id **655** is WETV USA — do not confuse)
- Pre/post: `tvg_id=WWOR-DT.us_locals1` (correct) · epg.pw pin **468489** (WWOR-DT) · `prefer_source=json`

## Wrong conclusion (pre)
`/epg/now-next/654` empty (`has_data=false`). Stream live (1280x720); operator GT: **Maury**.
Root cause: mapped tvg with **no epg.pw pin** → class `empty`.

## Fix
- Pin `assets/epgpw_channel_map.json` **468489** → gateway `654` / `WWOR-DT.us_locals1` / JSON
- Authoritative lock `654` → `WWOR-DT.us_locals1` in `StepDaddyLiveHD/epg.py`
- Deploy VERSION **20260908u**; restart `stepdaddy-livehd`
- Confirm: now_title **Maury** @ 16:00–17:00Z (2026-09-08); next **THE NOON**

## Verify
```bash
curl -sS https://sdgateway.duckdns.org/epg/now-next/654
# expect now_title Maury (weekday ~12:00 ET / 16:00Z on 2026-09-08)
curl -sS 'https://sdgateway.duckdns.org/health?lite=1' | jq .bundle_version
# expect 20260908u
python3 scripts/channel-audit.py 654 --md --visual-match match --ground-truth-title "Maury"
# expect epg_match_status=visually_confirmed; health=healthy
```
