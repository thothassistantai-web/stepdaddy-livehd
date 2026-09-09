#!/usr/bin/env bash
# Log boot/uptime state once per boot.
set -euo pipefail
cd "$(dirname "$0")/.."
last_boot=$(who -b 2>/dev/null | awk '{print $3, $4}' || date -Is)
uptime_out=$(uptime -p 2>/dev/null || uptime)
mem=$(free -m 2>/dev/null | awk '/^Mem:/{printf "total=%s avail=%s", $2, $7}' || echo "unknown")
"$PWD/scripts/incidents-log.sh" boot "Service host boot probe" "last_boot=${last_boot} ${uptime_out} ${mem}" "boot-probe oneshot"
echo "[$(date -Is)] boot probe: ${last_boot} | ${uptime_out} | ${mem}" >> logs/boot-probe.log
