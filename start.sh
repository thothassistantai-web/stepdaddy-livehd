#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

export PATH="/data/data/com.termux/files/usr/bin:$PATH"

ok() { printf '[OK] %s\n' "$1"; }
warn() { printf '[WARN] %s\n' "$1"; }
fail() { printf '[FAIL] %s\n' "$1" >&2; exit 1; }

[ -d venv ] || fail "Virtual environment not found. Run ./install.sh first."
[ -f webui/index.html ] || fail "Prebuilt UI missing at webui/index.html"
[ -f StepDaddyLiveHD/backend_termux_app.py ] || fail "Backend entrypoint missing"

if [ -f .env.termux ]; then
  set -a
  # shellcheck disable=SC1091
  source ./.env.termux
  set +a
fi

: "${PORT:=3000}"
export PYTHONUNBUFFERED=1

mkdir -p logs logo-cache .states
LOG_FILE="$PROJECT_DIR/logs/backend-$(date +%Y%m%d-%H%M%S).log"

termux-wake-lock >/dev/null 2>&1 || true

if pgrep -f "uvicorn StepDaddyLiveHD.backend_termux_app:fastapi_app" >/dev/null 2>&1; then
  warn "Existing backend detected; stopping it before restart"
  pkill -f "uvicorn StepDaddyLiveHD.backend_termux_app:fastapi_app" >/dev/null 2>&1 || true
  sleep 2
fi

# shellcheck disable=SC1091
source venv/bin/activate

nohup uvicorn StepDaddyLiveHD.backend_termux_app:fastapi_app --host 0.0.0.0 --port "$PORT" >"$LOG_FILE" 2>&1 < /dev/null &
PID=$!
echo "$PID" > .stepdaddy-backend.pid

ROOT_CODE="000"
STATUS_CODE="000"
for _ in $(seq 1 30); do
  if ! kill -0 "$PID" >/dev/null 2>&1; then
    tail -n 40 "$LOG_FILE" >&2 || true
    fail "Backend failed to stay running. See $LOG_FILE"
  fi
  ROOT_CODE="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/" || true)"
  STATUS_CODE="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/channels/status" || true)"
  if [ "$ROOT_CODE" = "200" ] && [ "$STATUS_CODE" = "200" ]; then
    break
  fi
  sleep 1
done

[ "$ROOT_CODE" = "200" ] || fail "Root UI validation failed with HTTP $ROOT_CODE"
[ "$STATUS_CODE" = "200" ] || fail "Channel status validation failed with HTTP $STATUS_CODE"

ok "Backend started with PID $PID"
ok "Validation passed for / and /channels/status"
printf 'Log file: %s\n' "$LOG_FILE"
printf 'Local URL: http://127.0.0.1:%s\n' "$PORT"

if command -v ip >/dev/null 2>&1; then
  mapfile -t IPS < <(ip -4 addr show scope global 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1)
  for ip_addr in "${IPS[@]:-}"; do
    [ -n "$ip_addr" ] && printf 'Network URL: http://%s:%s\n' "$ip_addr" "$PORT"
  done
fi
