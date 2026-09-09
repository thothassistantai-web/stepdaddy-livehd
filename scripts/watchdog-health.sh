#!/usr/bin/env bash
# Enhanced health watchdog: probe /health?lite=1, log incidents, restart after 3 failures.
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT="$PWD"
PORT="${PORT:-3000}"
if [ -f .env.termux ]; then set -a; . ./.env.termux; set +a; fi
STATE_FILE=".watchdog-health-state"
FAIL_THRESHOLD=3
RESTART_COOLDOWN=300
fail_count=0
last_restart=0
was_failing=false
if [ -f "$STATE_FILE" ]; then
  # shellcheck disable=SC1090
  . "$STATE_FILE" || true
fi
now=$(date +%s)
health_body="/tmp/sd-health-$$.json"
code=$(curl -sf -m 8 -o "$health_body" -w "%{http_code}" "http://127.0.0.1:${PORT}/health?lite=1" 2>/dev/null || echo "000")
ok=false
health_summary=""
if [ "$code" = "200" ] && [ -f "$health_body" ]; then
  health_summary=$(python3 -c "
import json, sys
try:
    d=json.load(open(sys.argv[1]))
    print('ok=%s channels=%s base=%s' % (d.get('ok'), d.get('channels'), d.get('upstream_base_url','')[:40]))
    sys.exit(0 if d.get('ok') else 1)
except Exception as e:
    print('parse_error=%s' % e)
    sys.exit(1)
" "$health_body" 2>/dev/null) || true
  if [ -n "$health_summary" ] && [[ "$health_summary" != parse_error* ]]; then
    if python3 -c "import json,sys; d=json.load(open(sys.argv[1])); sys.exit(0 if d.get('ok') else 1)" "$health_body" 2>/dev/null; then
      ok=true
    fi
  fi
fi
rm -f "$health_body"

mem_free=$(free -m 2>/dev/null | awk '/^Mem:/{print $4}' || echo "?")
mem_avail=$(free -m 2>/dev/null | awk '/^Mem:/{print $7}' || echo "?")
load_avg=$(cut -d' ' -f1-3 /proc/loadavg 2>/dev/null || echo "?")
svc_state=$(systemctl --user is-active stepdaddy-livehd 2>/dev/null || echo "unknown")
diag="code=${code} ${health_summary} mem_free_mb=${mem_free} mem_avail_mb=${mem_avail} load=${load_avg} svc=${svc_state}"

if [ "$ok" = true ]; then
  if [ "$was_failing" = true ] || [ "${fail_count:-0}" -gt 0 ]; then
    "$PROJECT/scripts/incidents-log.sh" recovery "Health probe recovered" "prior_failures=${fail_count}" "watchdog cleared fail counter"
  fi
  fail_count=0
  was_failing=false
else
  fail_count=$((fail_count + 1))
  was_failing=true
  if [ "$fail_count" -eq 1 ] || [ "$fail_count" -eq "$FAIL_THRESHOLD" ]; then
    "$PROJECT/scripts/incidents-log.sh" health_fail "Health probe failed (${fail_count}/${FAIL_THRESHOLD})" "$diag" "monitoring"
  fi
  echo "[$(date -Is)] fail ${fail_count}/${FAIL_THRESHOLD}: ${diag}" >> logs/watchdog-health.log
fi

can_restart=false
if [ "$fail_count" -ge "$FAIL_THRESHOLD" ]; then
  if [ $((now - last_restart)) -ge "$RESTART_COOLDOWN" ]; then
    can_restart=true
  fi
fi

if [ "$can_restart" = true ]; then
  "$PROJECT/scripts/incidents-log.sh" restart "Watchdog restarting stepdaddy-livehd" "$diag" "systemctl --user restart stepdaddy-livehd"
  echo "[$(date -Is)] watchdog: ${fail_count} failures, restarting stepdaddy-livehd (${diag})" >> logs/watchdog-health.log
  systemctl --user restart stepdaddy-livehd || true
  last_restart=$now
  fail_count=0
  was_failing=true
fi

cat > "$STATE_FILE" <<STATE
fail_count=${fail_count}
last_restart=${last_restart}
was_failing=${was_failing}
STATE
