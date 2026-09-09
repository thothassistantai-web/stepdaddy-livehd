# `/tv` casting (feature 4)

Version: introduced **20260909c** (live cache-bust may be newer, e.g. **20260909d**).

## UI

| Control | Where |
|---------|--------|
| `#castBtn` | Q2 tools strip (after Settings) — cast icon |
| ⋯ → **Cast / AirPlay** | `#guideMoreMenu` |
| `#hlsCastBtn` | Cinema/HLS transport bar (icon button) |

All call `window.SDCast.prompt()`.

## Paths (best-effort order)

1. **AirPlay** — Safari / iOS: `webkitShowPlaybackTargetPicker`; `<video airplay x-webkit-airplay="allow">`
2. **Remote Playback API** — Chromium when media is URL-backed: `video.remote.prompt()`
3. **Cast Web Sender** — loads Google Cast framework → Default Media Receiver + absolute stream URL (`.m3u8` / MP4)
4. **Presentation API** — second-screen / presentation display fallback

## Limitations

- **Android Chrome + hls.js (MSE):** Remote Playback usually fails (blob/MSE). Use Chrome menu **Cast tab/screen**, or a Cast-capable external player.
- **PIN / cookie auth:** Chromecast fetches the media URL without the browser session cookie — proxied `/live/*.m3u8` may return **401** on the receiver even when local playback works.
- **Desktop Chrome:** Cast sender works when a Cast device is on LAN and the stream URL is publicly fetchable by the receiver; otherwise use tab casting.
- **Does not pause/break** local `#v` playback if cast fails — toast only.
