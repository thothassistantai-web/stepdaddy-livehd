#!/usr/bin/env bash
# Register (or document) an UptimeRobot HTTP(s) monitor for StepDaddy gateway.
# Free tier: 50 monitors, 5-minute interval.
set -euo pipefail

MONITOR_URL="${MONITOR_URL:-https://sdgateway.duckdns.org/health?lite=1}"
MONITOR_NAME="${MONITOR_NAME:-StepDaddy sdgateway HTTPS}"
MONITOR_INTERVAL="${MONITOR_INTERVAL:-300}"  # seconds (300 = 5 min on free tier)

API_KEY="${UPTIMEROBOT_API_KEY:-${UPTIMEROBOT_API_KEY_MAIN:-}}"
if [ -z "$API_KEY" ]; then
  if command -v secret-tool >/dev/null 2>&1; then
    API_KEY="$(secret-tool lookup service uptimerobot account main 2>/dev/null || true)"
  fi
fi

if [ -z "$API_KEY" ]; then
  cat <<EOF
No UptimeRobot API key found.

Manual setup (free tier):
1. Create account: https://uptimerobot.com/signUp
2. Add Monitor → HTTP(s)
   - Friendly name: ${MONITOR_NAME}
   - URL: ${MONITOR_URL}
   - Monitoring interval: 5 minutes
   - Monitor timeout: 30 seconds
   - Alert contacts: your email (2 failures recommended)
3. Optional: store API key in GNOME Keyring for this script:
   secret-tool store --label='UptimeRobot API' service uptimerobot account main

After adding the key, re-run:
  UPTIMEROBOT_API_KEY=main-key ./scripts/uptimerobot-setup.sh

Note: use HTTPS (not :3000) — public port 3000 is closed.
EOF
  exit 0
fi

payload=$(python3 - <<PY
import json
print(json.dumps({
    "api_key": "${API_KEY}",
    "format": "json",
    "type": 1,
    "url": "${MONITOR_URL}",
    "friendly_name": "${MONITOR_NAME}",
    "interval": int("${MONITOR_INTERVAL}"),
    "timeout": 30,
}))
PY
)

resp=$(curl -fsS -X POST "https://api.uptimerobot.com/v2/newMonitor" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "api_key=${API_KEY}" \
  --data-urlencode "format=json" \
  --data-urlencode "type=1" \
  --data-urlencode "url=${MONITOR_URL}" \
  --data-urlencode "friendly_name=${MONITOR_NAME}" \
  --data-urlencode "interval=${MONITOR_INTERVAL}")

echo "$resp" | python3 -m json.tool
stat=$(echo "$resp" | python3 -c "import json,sys; print(json.load(sys.stdin).get('stat',''))")
if [ "$stat" != "ok" ]; then
  echo "UptimeRobot API did not return stat=ok (monitor may already exist)." >&2
  exit 1
fi
echo "Monitor created: ${MONITOR_URL}"
