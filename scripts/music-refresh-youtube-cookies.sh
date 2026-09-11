#!/usr/bin/env bash
# One-time / periodic YouTube cookie refresh for Music Listen (VPS-local jar).
# Does NOT require a continuous laptop SOCKS tunnel.
#
# Usage (on laptop with a logged-in Firefox/Chrome session):
#   ./scripts/music-refresh-youtube-cookies.sh
#   ./scripts/music-refresh-youtube-cookies.sh --browser chrome
#
# Writes Netscape cookies to the VPS path used by MUSIC_LISTEN_COOKIES /
# data/youtube.cookies.txt (gitignored). Restart is not required — yt-dlp
# re-reads the file on each extract; restart only if you change .env.
set -euo pipefail

BROWSER="${1:-firefox}"
if [[ "${1:-}" == "--browser" ]]; then
  BROWSER="${2:-firefox}"
fi
BROWSER="${BROWSER#--browser}"
BROWSER="${BROWSER:-firefox}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_TMP="$(mktemp /tmp/youtube-cookies-XXXXXX.txt)"
trap 'rm -f "$LOCAL_TMP"' EXIT

SSH_KEY="${SSH_KEY:-$HOME/.ssh/oracle_openclaw_instance}"
VPS_HOST="${VPS_HOST:-opc@129.80.78.103}"
VPS_PATH="${VPS_PATH:-/home/opc/StepDaddyLiveHD/data/youtube.cookies.txt}"

echo "[cookies] exporting from browser=${BROWSER} …"
if command -v yt-dlp >/dev/null 2>&1; then
  yt-dlp --cookies-from-browser "$BROWSER" --cookies "$LOCAL_TMP" \
    --skip-download -f bestaudio --print "%(id)s" \
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ" >/dev/null
else
  echo "yt-dlp not found on PATH" >&2
  exit 1
fi

bytes=$(wc -c <"$LOCAL_TMP" | tr -d ' ')
yt_lines=$(grep -c 'youtube\|google' "$LOCAL_TMP" || true)
echo "[cookies] local jar ${bytes} bytes, ${yt_lines} yt/google lines"
if [[ "$bytes" -lt 200 ]]; then
  echo "[cookies] jar looks empty — is ${BROWSER} logged into YouTube?" >&2
  exit 1
fi

echo "[cookies] uploading to ${VPS_HOST}:${VPS_PATH}"
scp -i "$SSH_KEY" -o IdentitiesOnly=yes "$LOCAL_TMP" "${VPS_HOST}:${VPS_PATH}"
ssh -i "$SSH_KEY" -o IdentitiesOnly=yes "$VPS_HOST" "chmod 600 '$VPS_PATH'; ls -la '$VPS_PATH'"

# Ensure env points at the jar (idempotent)
ssh -i "$SSH_KEY" -o IdentitiesOnly=yes "$VPS_HOST" bash -s <<'REMOTE'
set -euo pipefail
ENV=/home/opc/StepDaddyLiveHD/.env.termux
PATH_LINE='MUSIC_LISTEN_COOKIES=/home/opc/StepDaddyLiveHD/data/youtube.cookies.txt'
if [[ -f "$ENV" ]]; then
  if grep -q '^MUSIC_LISTEN_COOKIES=' "$ENV"; then
    sed -i 's|^MUSIC_LISTEN_COOKIES=.*|MUSIC_LISTEN_COOKIES=/home/opc/StepDaddyLiveHD/data/youtube.cookies.txt|' "$ENV"
  else
    printf '\n# YouTube cookies for Music Listen (VPS-local; refresh via scripts/music-refresh-youtube-cookies.sh)\n%s\n' "$PATH_LINE" >>"$ENV"
  fi
  # Soft-deprecate laptop tunnel for Music — keep VOD_SOCKS5 for VOD if present,
  # but document Music does not require it.
  if ! grep -q '^MUSIC_LISTEN_CLIENT_EMBED=' "$ENV"; then
    printf '\n# Music Listen: browser YT embed fallback (no laptop SOCKS required)\nMUSIC_LISTEN_CLIENT_EMBED=1\n' >>"$ENV"
  fi
fi
echo "[cookies] env ok"
REMOTE

echo "[cookies] done. Optional: systemctl --user restart stepdaddy-livehd on VPS if env changed."
