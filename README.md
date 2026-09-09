# StepDaddyLiveHD Mobile

StepDaddyLiveHD is a self-hosted IPTV proxy built for Android/Termux. It scrapes live channels from upstream sources, serves them through a FastAPI backend, provides a prebuilt web UI with HLS playback, generates M3U playlists, and enriches channels with EPG metadata and logos.

This is the **mobile (Termux) version** — optimized for running directly on an Android phone with no Docker.

## Quick Start

### 1. Install Termux

Install from [F-Droid](https://f-droid.org/packages/com.termux/) (recommended) or side-load the APK.

### 2. Setup

Open Termux and run:

```bash
termux-setup-storage
```

### 3. Transfer this folder to Termux

Copy the `stepdaddy` folder to your Termux home:

```bash
cp -r ~/storage/downloads/stepdaddy ~/stepdaddy
cd ~/stepdaddy
```

### 4. Install & Launch

```bash
./install.sh
./start.sh
```

On Termux, `install.sh` also writes `~/.termux/boot/start-stepdaddy.sh` so the app starts automatically after reboot.

Then open in your phone's browser:

```
http://127.0.0.1:3000
```

## What It Needs

- Android device with Termux
- Shared storage permission
- Python 3.13+
- ~300MB free storage
- Outbound internet access

## Environment Variables

Copy `.env.example` to `.env.termux` and edit as needed:

```bash
cp .env.example .env.termux
```

Key variables:

- `PORT` — public port (default `3000`)
- `API_URL` — URL used in stream/playlist links
- `PROXY_CONTENT` — `TRUE` to proxy video, `FALSE` for direct upstream URLs
- `SOCKS5` — optional SOCKS5 proxy
- `SHARE_BASE_URL` — set if using Cloudflare tunnel for public sharing

If `API_URL` is not set, the app falls back to `http://127.0.0.1:${PORT}` automatically.

## Scripts

| Script | Purpose |
|--------|---------|
| `install.sh` | One-time Termux package + Python dependency install |
| `start.sh` | Launch backend with validation |
| `stop.sh` | Stop backend |
| `status.sh` | Check process + endpoint health |
| `run-backend-termux.sh` | Backend launcher (no validation) |
| `run-watchdog-termux.sh` | Auto-restart watchdog |
| `healthcheck.sh` | Quick endpoint test |
| `setup-termux.sh` | Alternate full setup (Reflex + all deps) |
| `setup-termux-backend.sh` | Minimal backend-only setup |

## Watchdog

The watchdog monitors `/channels/status` and restarts the backend automatically if it crashes:

```bash
nohup ./run-watchdog-termux.sh &
```

## Boot Auto-Start

```bash
mkdir -p ~/.termux/boot
cat > ~/.termux/boot/start-stepdaddy.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
cd ~/stepdaddy
./start.sh
EOF
chmod +x ~/.termux/boot/start-stepdaddy.sh
```

## Network Access

- **Local:** `http://127.0.0.1:3000`
- **WiFi:** `http://<phone-ip>:3000`
- **Public:** Use `cloudflared` tunnel or Tailscale Funnel
- **SSH:** Termux SSH server runs on port `8022`

## Playlist

```
http://127.0.0.1:3000/playlist.m3u8
```

## Troubleshooting

- **Blank UI / no channels:** Check outbound internet access
- **Port in use:** `pkill -f uvicorn` then retry `./start.sh`
- **Storage full:** Clear `logo-cache/` and `logs/`
- **Termux killed by Android:** Disable battery optimization for Termux

## Notes

- The backend preloads channels on startup to avoid blank first-load
- EPG data is cached locally and refreshes every 24h by default
- Playlists are generated dynamically — no static `.m3u` file on disk
- `start.sh` keeps a Termux wake lock enabled so the backend survives Android sleep more reliably
- `SHARE_SECRET` must be set to enable share links

## License

MIT License — see [LICENSE](LICENSE)
