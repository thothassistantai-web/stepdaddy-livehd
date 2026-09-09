# StepDaddyLiveHD Mobile Backup Notes

This repository snapshot is the Android/Termux mobile version of StepDaddyLiveHD.

## Runtime Model

- **Platform:** Android device running [Termux](https://termux.dev)
- **Backend:** FastAPI via Uvicorn (no Docker, no Reflex in production)
- **Frontend:** Prebuilt static UI served from `webui/` (HLS.JS player)
- **Default port:** `3000`

## Prerequisites

- Android device with Termux installed (F-Droid recommended over Play Store)
- Shared storage permission (`termux-setup-storage`)
- Python 3.13+ in Termux
- ~300MB free storage for project + venv + caches
- Internet access to upstream IPTV/EPG sources

## Environment Variables (`.env.termux`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 3000 | Public port |
| `API_URL` | http://127.0.0.1:3000 | URL in stream/playlist links |
| `PROXY_CONTENT` | FALSE | Proxy video through server |
| `SOCKS5` | (empty) | Optional SOCKS5 proxy |
| `EPG_URLS` | (3 sources) | Comma-separated EPG XML URLs |
| `EPG_REFRESH_SECONDS` | 86400 | EPG refresh interval |
| `SHARE_SECRET` | (empty) | HMAC secret for share links |
| `SHARE_BASE_URL` | (empty) | Public URL for share/watch links |

## Install / Start / Stop

```bash
# One-time setup
./install.sh

# Start the backend
./start.sh

# Stop
./stop.sh

# Check status
./status.sh
```

## Auto-Restart Watchdog

```bash
nohup ./run-watchdog-termux.sh &
```

Monitors `/channels/status` every 20s, restarts backend after 4 consecutive failures.

## Boot Auto-Start

Create `~/.termux/boot/start-stepdaddy.sh`:

```bash
#!/data/data/com.termux/files/usr/bin/bash
cd /data/data/com.termux/files/home/stepdaddy
./start.sh
```

```bash
chmod +x ~/.termux/boot/start-stepdaddy.sh
```

## Network Access

- Device only: `http://127.0.0.1:3000`
- Same WiFi: `http://<phone-ip>:3000`
- Public: use Cloudflare tunnel (see `run-termux.sh` / `run-backend-termux.sh`)

## Important Data Files

| File | Purpose |
|------|---------|
| `StepDaddyLiveHD/channels_db_cache.csv` | Channel-to-EPG mapping cache |
| `StepDaddyLiveHD/epg_merged_cache.xml.gz` | Merged EPG database |
| `StepDaddyLiveHD/epg_overrides.json` | Manual channel-to-EPG overrides |
| `logo-cache/*.png` | Cached channel logos |
| `.states/` | Runtime state |
| `logs/` | Backend logs |
