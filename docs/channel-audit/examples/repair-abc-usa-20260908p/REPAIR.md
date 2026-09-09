# ABC USA EPG repair 20260908p

## Identity
- Guide **ch 20** = playlist #20 = gateway **51** ABC USA (`ABC.us`)
- epg.pw pin remains **464902** (ABC National Feed)

## Wrong conclusion (20260908o)
Auditor marked `healthy` because `/epg/now-next/51` was non-empty while `visual_epg_match=not_checked`.
Gateway served US **country gzip** programmes with false `+0000` stamps → overnight **ABC World News Now** during ET daytime.
Live stream was **The View**.

## Fix
- Prefer epg.pw **JSON** over US gzip (`EPGPW_PREFER_JSON=1`)
- Cleared `data/epgpw_epg/prog_*.json` on VPS; restarted `stepdaddy-livehd`
- Version **20260908p**
- Protocol/auditor: `epg_match_status` + US daypart heuristics

## Verify
```bash
curl -sS https://sdgateway.duckdns.org/epg/now-next/51
# expect now_title The View (weekday ~11:00–12:00 ET)
python3 scripts/channel-audit.py 51 --md
# expect epg_match_status=title_plausible (or visually_confirmed after HUMAN)
```
