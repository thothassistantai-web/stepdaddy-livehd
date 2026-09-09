#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if [ -f .env.termux ]; then
  set -a
  . ./.env.termux
  set +a
fi
: "${PORT:=3000}"
BASE="http://127.0.0.1:${PORT}"
check(){
  local path="$1"
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$path" || true)
  echo "$path -> $code"
}
# `/` redirects to `/tv` (302). Legacy browse UI lives at `/legacy`.
check "/"
check "/tv"
check "/legacy"
check "/playlist.m3u8"
check "/channels/status"
check "/epg.xml"
