#!/usr/bin/env bash
# Fetch Android domain-relay.json and optionally update .env.termux mirror/relay vars.
# Default: dry-run (prints diff only). Pass --apply to write + restart service.
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env.termux"
CACHE_FILE="$PROJECT_DIR/.domain-relay-cache.json"
URL_RAW="https://raw.githubusercontent.com/thothassistantai-web/stepdaddy-gateway-android/main/release/domain-relay.json"
URL_RELEASE="https://github.com/thothassistantai-web/stepdaddy-gateway-android/releases/latest/download/domain-relay.json"
APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1

fetch_json() {
  for url in "$URL_RAW" "$URL_RELEASE"; do
    if curl -fsSL -m 20 "$url" -o "$CACHE_FILE.tmp"; then
      mv "$CACHE_FILE.tmp" "$CACHE_FILE"
      echo "[OK] fetched $url"
      return 0
    fi
  done
  echo "[FAIL] could not fetch domain-relay.json" >&2
  exit 1
}

fetch_json
python3 - "$ENV_FILE" "$APPLY" "$CACHE_FILE" <<'PY'
import json, pathlib, re, sys, shutil, time
env_path, apply, cache_path = pathlib.Path(sys.argv[1]), bool(int(sys.argv[2])), pathlib.Path(sys.argv[3])
cache = json.loads(cache_path.read_text())
src = (cache.get("sources") or {}).get("daddylive") or {}
primary = (src.get("primary") or "").rstrip("/")
mirrors = [m.rstrip("/") for m in (src.get("mirrors") or []) if m]
relays = [m.rstrip("/") for m in (src.get("relayHosts") or []) if m]
blocked = src.get("blocked") or []
version = cache.get("version")
message = cache.get("message") or ""

updates = {}
if relays:
    updates["DLHD_RELAY_HOSTS"] = ",".join(relays)
if mirrors:
    merged = []
    # Keep configured DLHD_BASE_URL first — catalog host order matters for channel count.
    env_primary = None
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("DLHD_BASE_URL="):
                env_primary = line.split("=",1)[1].strip().rstrip("/")
                break
    for m in ([env_primary] if env_primary else []) + ([primary] if primary else []) + mirrors:
        if m and m not in merged:
            merged.append(m)
    updates["DLHD_BASE_URLS"] = ",".join(merged)
# Do not auto-change DLHD_BASE_URL primary without explicit flag in future

print(f"domain-relay v{version}: {message}")
print("Proposed .env.termux updates:")
for k, v in updates.items():
    print(f"  {k}={v}")
if blocked:
    print(f"  (blocked hosts in relay, not written: {blocked})")

if not apply:
    print("[dry-run] pass --apply to write and restart stepdaddy-livehd")
    sys.exit(0)

text = env_path.read_text() if env_path.exists() else ""
for key, val in updates.items():
    pat = re.compile(rf"^{re.escape(key)}=.*$", re.M)
    line = f"{key}={val}"
    text = pat.sub(line, text) if pat.search(text) else text.rstrip() + "\n" + line + "\n"
bak = env_path.with_suffix(f".termux.bak-{int(time.time())}")
if env_path.exists():
    shutil.copy2(env_path, bak)
env_path.write_text(text)
print(f"[OK] updated {env_path} (backup {bak.name})")
PY

if [ "$APPLY" -eq 1 ]; then
  systemctl --user restart stepdaddy-livehd
  sleep 2
  curl -sf "http://127.0.0.1:3000/health?lite=1" | python3 -m json.tool || true
fi
