#!/usr/bin/env bash
# Append structured incident/event lines to stability logs.
# Usage: incidents-log.sh <event_type> <message> [root_cause] [action_taken]
set -euo pipefail
LOG_DIR="${LOG_DIR:-$HOME/StepDaddyLiveHD/logs}"
INCIDENTS_LOG="${INCIDENTS_LOG:-$LOG_DIR/incidents.log}"
STABILITY_LOG="${STABILITY_LOG:-$LOG_DIR/stability.log}"
mkdir -p "$LOG_DIR"
event_type="${1:-event}"
shift || true
message="${1:-}"
root_cause="${2:-}"
action_taken="${3:-}"
ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
# JSON line (machine-readable)
python3 -c "
import json, sys
print(json.dumps({
    'ts': sys.argv[1],
    'event': sys.argv[2],
    'message': sys.argv[3],
    'root_cause': sys.argv[4] or None,
    'action': sys.argv[5] or None,
}, separators=(',', ':')))
" "$ts" "$event_type" "$message" "$root_cause" "$action_taken" >> "$INCIDENTS_LOG"
# Human-readable mirror
printf '[%s] %s | %s' "$ts" "$event_type" "$message" >> "$STABILITY_LOG"
if [ -n "$root_cause" ]; then printf ' | cause=%s' "$root_cause" >> "$STABILITY_LOG"; fi
if [ -n "$action_taken" ]; then printf ' | action=%s' "$action_taken" >> "$STABILITY_LOG"; fi
printf '\n' >> "$STABILITY_LOG"
