#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p logs
LOG="$(pwd)/logs/runtime-$(date +%Y%m%d-%H%M%S).log"
if [ -f .env.termux ]; then
  set -a
  . ./.env.termux
  set +a
fi
: "${PORT:=3000}"
export PYTHONUNBUFFERED=1
export REFLEX_USE_NPM=1
export REFLEX_USE_SYSTEM_BUN=1
export PATH="$HOME/.local/share/reflex/bun/bin:$PATH"
termux-wake-lock >/dev/null 2>&1 || true
pkill -f "reflex run --env prod" >/dev/null 2>&1 || true
redis-cli ping >/dev/null 2>&1 || redis-server --daemonize yes
source venv/bin/activate
nohup reflex run --env prod > "$LOG" 2>&1 < /dev/null &
echo $! > .stepdaddy.pid
sleep 4
echo "PID=$(cat .stepdaddy.pid) LOG=$LOG PORT=$PORT"
