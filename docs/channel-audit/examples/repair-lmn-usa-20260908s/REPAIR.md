# Lifetime Movie Network (LMN) EPG repair 20260908s

## Identity
- Guide **ch 580** = playlist #580 = gateway **389** Lifetime Movies Network (LMN)
- (Gateway id **580** is Arena Sport 4 Croatia — do not confuse)
- Sibling: gateway **326** Lifetime Network (guide ch 581) — separate repair `20260908r`
- Pre/post: `tvg_id=LifetimeMovieNetwork.us` (correct) · epg.pw pin **464929** (LMN HD) · `prefer_source=json`

## Wrong conclusion (pre)
`/epg/now-next/389` empty (`has_data=false`). Stream live; operator GT: **A Family Nightmare: Secrets on Maple Street**.
Root cause: mapped tvg with **no epg.pw pin** → class `empty`.

## Fix
- Pin `assets/epgpw_channel_map.json` **464929** → gateway `389` / `LifetimeMovieNetwork.us` / JSON
- Keep authoritative tvg `LifetimeMovieNetwork.us` (no remap)
- Deploy VERSION **20260908s**; restart `stepdaddy-livehd`
- Confirm: now_title **A Family Nightmare: Secrets on Maple Street** @ 16:00–18:00Z (2026-09-08)

## Verify
```bash
curl -sS https://sdgateway.duckdns.org/epg/now-next/389
# expect now_title A Family Nightmare: Secrets on Maple Street (weekday ~12:00 ET / 16:00Z on 2026-09-08)
python3 scripts/channel-audit.py 389 --md --visual-match match \
  --ground-truth-title "A Family Nightmare: Secrets on Maple Street"
# expect epg_match_status=visually_confirmed; health=healthy
```
