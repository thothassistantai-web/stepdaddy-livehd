#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p logs
LOG="$(pwd)/logs/watchdog-$(date +%Y%m%d-%H%M%S).log"
pkill -f "watchdog-backend-termux.sh" >/dev/null 2>&1 || true
nohup ./watchdog-backend-termux.sh > "$LOG" 2>&1 < /dev/null &
echo $! > .stepdaddy-watchdog.pid
echo "WATCHDOG_PID=$(cat .stepdaddy-watchdog.pid) LOG=$LOG"
