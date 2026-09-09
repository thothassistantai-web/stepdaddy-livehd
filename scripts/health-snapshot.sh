#!/usr/bin/env bash
# Lightweight periodic health snapshot (JSON line).
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-3000}"
LOG="${LOG:-logs/health-snapshots.log}"
mkdir -p logs
ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
uptime_s=$(cut -d. -f1 /proc/uptime 2>/dev/null || echo 0)
mem_avail=$(free -m 2>/dev/null | awk '/^Mem:/{print $7}' || echo null)
mem_total=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}' || echo null)
load=$(cut -d' ' -f1-3 /proc/loadavg 2>/dev/null || echo "")
# Cumulative egress counters (primary interface)
net_dev="${NET_DEV_PRIMARY:-}"
if [ -z "$net_dev" ]; then
  for cand in ens3 enp0s6 enp0s5 eth0; do
    if grep -q "^[[:space:]]*${cand}:" /proc/net/dev 2>/dev/null; then
      net_dev=$cand
      break
    fi
  done
fi
tx_bytes=""
rx_bytes=""
if [ -n "$net_dev" ] && [ -r /proc/net/dev ]; then
  line=$(awk -v d="$net_dev" -F'[: ]+' '$1==d {print $0}' /proc/net/dev | head -1)
  if [ -n "$line" ]; then
    rx_bytes=$(echo "$line" | awk '{print $2}')
    tx_bytes=$(echo "$line" | awk '{print $10}')
  fi
fi
body="/tmp/sd-snap-$$.json"
code=$(curl -sf -m 6 -o "$body" -w "%{http_code}" "http://127.0.0.1:${PORT}/health?lite=1" 2>/dev/null || echo "000")
python3 -c "
import json, sys, os
ts, code, uptime_s, mem_avail, mem_total, load = sys.argv[1:7]
tx, rx, net_dev = sys.argv[7:10]
snap = {'ts': ts, 'http_code': int(code) if code.isdigit() else 0, 'uptime_s': int(uptime_s or 0),
        'mem_avail_mb': int(mem_avail) if mem_avail.isdigit() else None,
        'mem_total_mb': int(mem_total) if mem_total.isdigit() else None,
        'load': load}
if net_dev:
    snap['net_dev'] = net_dev
if tx.isdigit():
    snap['tx_bytes_cumulative'] = int(tx)
if rx.isdigit():
    snap['rx_bytes_cumulative'] = int(rx)
path = sys.argv[10]
if os.path.isfile(path) and code == '200':
    try:
        d = json.load(open(path))
        snap['ok'] = d.get('ok')
        snap['channels'] = d.get('channels')
    except Exception:
        pass
print(json.dumps(snap, separators=(',', ':')))
" "$ts" "$code" "$uptime_s" "$mem_avail" "$mem_total" "$load" "${tx_bytes:-}" "${rx_bytes:-}" "${net_dev:-}" "$body" >> "$LOG"
rm -f "$body"
# Keep file small (~500 lines max)
if [ -f "$LOG" ]; then
  lines=$(wc -l < "$LOG")
  if [ "$lines" -gt 500 ]; then
    tail -400 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
  fi
fi
