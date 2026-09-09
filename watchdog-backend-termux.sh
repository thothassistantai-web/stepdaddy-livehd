#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env.termux ]; then
  set -a
  . ./.env.termux
  set +a
fi

: "${PORT:=3000}"
: "${WATCHDOG_INTERVAL:=20}"
: "${WATCHDOG_FAIL_THRESHOLD:=4}"      # require 4 consecutive failures
: "${WATCHDOG_STARTUP_GRACE:=180}"      # seconds after start to avoid restart
: "${WATCHDOG_RESTART_COOLDOWN:=300}"   # min seconds between restarts

STATE_FILE=".watchdog-state"
fail_count=0
last_restart=0

if [ -f "$STATE_FILE" ]; then
  # shellcheck disable=SC1090
  . "$STATE_FILE" || true
fi

persist_state() {
  cat > "$STATE_FILE" <<STATE
fail_count=${fail_count}
last_restart=${last_restart}
STATE
}

now_s() { date +%s; }

while true; do
  now=$(now_s)

  code=$(curl -s -m 8 -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/channels/status" || true)
  if [ "$code" = "200" ]; then
    fail_count=0
    persist_state
    sleep "$WATCHDOG_INTERVAL"
    continue
  fi

  fail_count=$((fail_count+1))

  # determine backend pid + age
  pid=""
  age=999999
  if [ -f .stepdaddy-backend.pid ]; then
    pid=$(cat .stepdaddy-backend.pid 2>/dev/null || true)
  fi
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    # etimes may fail on some builds; fallback to large
    age=$(ps -o etimes= -p "$pid" 2>/dev/null | tr -d ' ' || echo 999999)
    [ -z "$age" ] && age=999999
  else
    age=999999
  fi

  can_restart=true
  if [ "$fail_count" -lt "$WATCHDOG_FAIL_THRESHOLD" ]; then
    can_restart=false
  fi
  if [ "$age" -lt "$WATCHDOG_STARTUP_GRACE" ]; then
    can_restart=false
  fi
  if [ $((now-last_restart)) -lt "$WATCHDOG_RESTART_COOLDOWN" ]; then
    can_restart=false
  fi

  if [ "$can_restart" = true ]; then
    ./run-backend-termux.sh >/dev/null 2>&1 || true
    last_restart=$(now_s)
    fail_count=0
  fi

  persist_state
  sleep "$WATCHDOG_INTERVAL"
done
