# Comet USA EPG repair 20260908q

## Identity
- Guide **ch 251** = playlist #251 = gateway **696** Comet USA
- Pre: `tvg_id=WWJS143.us` (bridge → Comet Pacific) · epg.pw auto **465305**
- Post: `tvg_id=Comet.us2` · epg.pw pin **465305** (Comet) · `prefer_source=json`

## Wrong conclusion (pre)
Auditor saw non-empty now/next paid-programming titles → `title_plausible` / `healthy`.
Operator ground truth: **Stargate** on the stream.
Cached `prog_465305` came from US **country gzip** with false `+0000` (~8h shift): Stargate @ **23:00Z** in cache vs **16:00Z** in JSON; daytime slots filled with paid programming.

## Fix
- Authoritative map `696` → `Comet.us2`; `channel_epg_map` same
- Pin `assets/epgpw_channel_map.json` **465305** → gateway `696` / `Comet.us2` / JSON
- Bridge: add `Comet.us2`; leave `WWJS143.us` → Pacific for the OTA callsign only
- Clear `prog_465305` + `prog_gz_US` on VPS; remove bad auto_channel_map entry
- Harden: when `EPGPW_PREFER_JSON=1`, gzip must **not** write shared `prog_{id}.json`
- Version **20260908q**

## Verify
```bash
curl -sS https://sdgateway.duckdns.org/epg/now-next/696
# expect now_title Stargate SG-1 (weekday ~12:00 ET / 16:00Z on 2026-09-08)
python3 scripts/channel-audit.py 696 --md
# expect tvg_id=Comet.us2; epg_match_status visually_confirmed after HUMAN
```
