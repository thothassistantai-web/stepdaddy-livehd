#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if [ -f .env.termux ]; then
  set -a
  . ./.env.termux
  set +a
fi
: "${PORT:=3000}"
echo "=== StepDaddyLiveHD Status ==="
echo "PORT=$PORT"
echo ""
echo "--- Process ---"
ps -ef | grep -i "uvicorn StepDaddyLiveHD.backend_termux_app" | grep -v grep || echo "(not running)"
echo ""
echo "--- Endpoints ---"
check() {
  local path="$1"
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}${path}" || echo "failed")
  printf "  %-30s %s\n" "$path" "$code"
}
check "/"
check "/channels/status"
check "/playlist.m3u8"
