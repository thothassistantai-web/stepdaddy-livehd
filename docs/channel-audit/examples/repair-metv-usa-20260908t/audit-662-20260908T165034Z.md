# Channel audit `662` — METV USA

- **audit_id:** `audit-662-20260908T165034Z`
- **audited_at:** 2026-09-08T16:50:34.367081+00:00
- **gateway:** https://sdgateway.duckdns.org
- **health / severity:** epg_only_issue / medium
- **stream_status:** live

## Identity
- id `662` · playlist# `622` · provider `DaddyLive` / `ddl`
- tags: 🇺🇸, #movies, #classic
- logo_ok: True · top_network: True
- siblings: —

## Stream
- proxy: `content_proxy` · playlist kind: `hls_media`
- upstream host: `hamis.romponalis.st`
- picture: {'width': 768, 'height': 432, 'fps': 29.97, 'aspect_ratio': '16:9', 'scan_type': 'progressive', 'bitrate_bps': 676071, 'avg_bitrate_bps': 440000}
- codecs: {'video_codec': 'h264', 'video_profile': 'Main', 'video_level': 3.1, 'audio_codec': 'aac', 'audio_profile': 'LC', 'pix_fmt': 'yuv420p', 'has_b_frames': 2, 'ffprobe_ok': True, 'ffprobe_error': None}
- ABR rungs: 1

## EPG
- tvg_id `WZVNTV262.us` · source `android_id_map` · method `android_id_map`
- has_data: False · now: None
- epg_match_status: **api_only** · daypart: None · plausible: None
- visual_epg_match: **not_checked** (HUMAN)
- timezone_notes: EPG timestamps are UTC ISO-8601 from gateway; confirm local guide TZ on device. Non-empty now/next is not proof of correct feed.

## EPG correction (registry)
- algorithm: `None` · registry `None`
- class: **None** (None) — —
- exact cases: —

## Verdict
- METV USA (662); status=live; health=epg_only_issue; 768x432; epg_match=api_only

### Repair actions
- [medium] (epg) Fill or remap EPG for tvg_id=WZVNTV262.us (now/next empty).

### Blind spots (HUMAN)

- epg_match_status=api_only (API-only EPG — unconfirmed visually)
- language_confirmed
- paint_death_observed
- ui_channel_number
- favorites_flag
- guide_search_name_ok
- icon_recognizable
- group_placement_ok
- tivimate_exoplayer visual
- media_session_title
