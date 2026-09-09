# StepDaddy Gateway — Stability Loop

Updated: 2026-09-01

## Repeat cycle

```
Detect → Log → Diagnose → Fix → Verify → Monitor
```

| Phase | What happens | Where |
|-------|----------------|-------|
| **Detect** | Watchdog (20s), health snapshots (5m), external uptime (optional) | `stepdaddy-watchdog.timer`, `stepdaddy-health-snapshot.timer` |
| **Log** | Append-only JSON incidents + human stability.log | `logs/incidents.log`, `logs/stability.log` |
| **Diagnose** | Capture health body, memory, load, service state on failure | `scripts/watchdog-health.sh` |
| **Fix** | Auto-restart after 3 probe failures; domain-relay cron; mirror failover | watchdog, cron, `step_daddy.py` |
| **Verify** | `/health?lite=1`, `/health/stability`, `/play/763` | manual or UptimeRobot |
| **Monitor** | Review incidents weekly; tune memory; consider Ampere shape | this doc + OCI metrics |

## Log files

| File | Purpose |
|------|---------|
| `logs/incidents.log` | JSON lines: ts, event, message, root_cause, action |
| `logs/stability.log` | Human-readable mirror of incidents |
| `logs/watchdog-health.log` | Raw probe failures with diagnostics |
| `logs/health-snapshots.log` | Lightweight JSON every 5 min (auto-trimmed ~400 lines) |
| `logs/boot-probe.log` | Boot-time memory/uptime |
| `logs/domain-relay.log` | Domain sync cron output |

## Check stability status

```bash
# Quick
curl -s http://127.0.0.1:3000/health/stability | python3 -m json.tool

# Recent incidents
tail -20 ~/StepDaddyLiveHD/logs/incidents.log | python3 -m json.tool

# Watchdog
tail -20 ~/StepDaddyLiveHD/logs/watchdog-health.log
journalctl --user -u stepdaddy-livehd -n 50 --no-pager
```

## Known failure modes

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| TCP :3000 connects, HTTP hangs, SSH banner timeout | **VM kernel freeze** (1GB micro OOM/stall) | OCI soft reset; long-term: Ampere A1 6GB |
| `/health` fails, service inactive | Process crash / OOM kill | Watchdog restart; check `journalctl --user -u stepdaddy-livehd` |
| Playback 403 / empty segments | Stale domain or missing Referer | Run `scripts/sync-domain-relay.sh --apply`; verify `daddylive.li` |
| 4KB segment / ffprobe fail | Truncated upstream segment | Stream cache refresh; retry channel |
| Mid-play stall then dead | Master URL rotation | Player stall reload; reduce cache TTL if recurring |
| OCI state STOPPING forever | Hung shutdown during reset | Wait 5–10m or STOP then START via OCI CLI |
| Duplicate channel neighbors | Index/cache bug | Restart service; report channel id |

## VM-level hang detection (limitations)

**User-space watchdog cannot recover a kernel freeze.** Options:

1. **OCI CLI** (from home machine):
   ```bash
   INSTANCE=ocid1.instance.oc1.iad.anuwcljtl2j6c4ychl6jemwbv7khqxh5arkodebz4iaznti47srjapjmjprq
   oci compute instance get --instance-id $INSTANCE --query 'data.{"state":"lifecycle-state"}'
   oci compute instance action --instance-id $INSTANCE --action SOFTRESET   # when hung
   ```

2. **External uptime monitor** (recommended): [UptimeRobot](https://uptimerobot.com) free tier → `http://129.153.238.155:3000/health?lite=1` every 5 min. Alert on 2 failures → manual OCI reset.

3. **OCI Monitoring alarm** (optional): Create alarm on `InstanceAccessibilityStatus` or custom agent if Management Agent enabled (currently disabled on this instance).

## Systemd units

| Unit | Role |
|------|------|
| `stepdaddy-livehd.service` | Main gateway |
| `stepdaddy-watchdog.timer` | Health probe every 20s |
| `stepdaddy-health-snapshot.timer` | JSON snapshot every 5m |
| `stepdaddy-boot-probe.service` | Log boot state once |

## Instance

- **Name:** openclaw-gateway
- **Shape:** VM.Standard.E2.1.Micro (1 GB)
- **Public:** http://129.153.238.155:3000
- **OCID:** `ocid1.instance.oc1.iad.anuwcljtl2j6c4ychl6jemwbv7khqxh5arkodebz4iaznti47srjapjmjprq`

## What was ad-hoc before (2026-08-31 → 2026-09-01)

- Reactive fixes in Cursor sessions (domains, player, neighbors)
- Basic watchdog + logrotate added without structured incident trail
- No retroactive RCA file; no `/health/stability` endpoint
- VM freezes required manual discovery each time

This document and `logs/incidents.log` start the systematic loop.
