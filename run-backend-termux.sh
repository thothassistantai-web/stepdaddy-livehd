#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p logs
LOG="$(pwd)/logs/backend-$(date +%Y%m%d-%H%M%S).log"
if [ -f .env.termux ]; then
  set -a
  . ./.env.termux
  set +a
fi
: "${PORT:=3000}"
export PYTHONUNBUFFERED=1
termux-wake-lock >/dev/null 2>&1 || true
pkill -f "uvicorn StepDaddyLiveHD.backend_termux_app:fastapi_app" >/dev/null 2>&1 || true
source venv/bin/activate
python -m pip install -q uvicorn
nohup uvicorn StepDaddyLiveHD.backend_termux_app:fastapi_app --host 0.0.0.0 --port "$PORT" > "$LOG" 2>&1 < /dev/null &
echo $! > .stepdaddy-backend.pid
sleep 3
echo "PID=$(cat .stepdaddy-backend.pid) LOG=$LOG PORT=$PORT"
