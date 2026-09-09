# Lifetime Network EPG repair 20260908r

## Identity
- Guide **ch 581** = playlist #581 = gateway **326** Lifetime Network
- (Gateway id **581** is Arena Sport 4 Serbia — do not confuse)
- Pre/post: `tvg_id=LifetimeNetwork.us` (correct) · epg.pw pin **465290** (Lifetime HD) · `prefer_source=json`

## Wrong conclusion (pre)
`/epg/now-next/326` empty (`has_data=false`). Stream live; frame + operator GT: **The Rookie**.
Root cause: mapped tvg with **no epg.pw pin** → class `empty`.

## Fix
- Pin `assets/epgpw_channel_map.json` **465290** → gateway `326` / `LifetimeNetwork.us` / JSON
- Keep authoritative tvg `LifetimeNetwork.us` (no remap)
- Deploy VERSION **20260908r**; restart `stepdaddy-livehd`
- Confirm: now_title **The Rookie** @ 16:00–17:00Z (2026-09-08)

## Verify
```bash
curl -sS https://sdgateway.duckdns.org/epg/now-next/326
# expect now_title The Rookie (weekday ~12:00 ET / 16:00Z on 2026-09-08)
python3 scripts/channel-audit.py 326 --md --visual-match match --ground-truth-title "The Rookie"
# expect epg_match_status=visually_confirmed; health=healthy
```
