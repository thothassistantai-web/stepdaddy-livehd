"""Mobile play page HTML for /play/{id} and /watch/{id}.

Simple player: landscape-first fullscreen surfing with integrated overlay chrome.
"""


def render_play_page(channel_id: str, title: str, ch_num: int, total: int) -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=1,user-scalable=no"/>
  <meta name="apple-mobile-web-app-capable" content="yes"/>
  <meta name="mobile-web-app-capable" content="yes"/>
  <meta name="theme-color" content="#000000"/>
  <meta name="screen-orientation" content="landscape"/>
  <title>{title}</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js"></script>
  <style>
    :root {{
      color-scheme: dark;
      --bg: #000;
      --chrome: rgba(6, 8, 12, .72);
      --chrome-strong: rgba(8, 10, 14, .88);
      --line: rgba(255,255,255,.12);
      --text: #f2f4f7;
      --muted: rgba(232,237,245,.62);
      --btn: rgba(255,255,255,.12);
      --btn-hover: rgba(255,255,255,.2);
      --accent: #e8edf5;
      --fav: #d97706;
      --safe-t: env(safe-area-inset-top, 0px);
      --safe-b: env(safe-area-inset-bottom, 0px);
      --safe-l: env(safe-area-inset-left, 0px);
      --safe-r: env(safe-area-inset-right, 0px);
      --touch: 52px;
      --touch-lg: 64px;
    }}
    * {{ box-sizing: border-box; }}
    html, body {{
      margin: 0; height: 100%; height: 100dvh; background: var(--bg); color: var(--text);
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      overflow: hidden; overscroll-behavior: none;
      -webkit-tap-highlight-color: transparent; touch-action: manipulation;
      user-select: none; -webkit-user-select: none;
    }}
    .stage {{
      position: fixed; inset: 0; background: #000;
      display: flex; align-items: center; justify-content: center;
    }}
    video {{
      width: 100%; height: 100%; object-fit: contain; background: #000; display: block;
    }}
    .chrome {{
      position: absolute; inset: 0; z-index: 5;
      pointer-events: none;
      opacity: 1; transition: opacity .28s ease;
    }}
    .chrome.hidden {{ opacity: 0; }}
    .chrome.hidden .hit {{ pointer-events: none !important; }}
    .chrome:not(.hidden) .hit {{ pointer-events: auto; }}
    .top-bar, .bottom-bar {{
      position: absolute; left: 0; right: 0;
      display: flex; align-items: center; gap: 8px;
      padding-left: max(10px, var(--safe-l));
      padding-right: max(10px, var(--safe-r));
      background: linear-gradient(to bottom, var(--chrome-strong), transparent);
    }}
    .top-bar {{
      top: 0; min-height: calc(56px + var(--safe-t));
      padding-top: max(8px, var(--safe-t));
      padding-bottom: 18px;
      justify-content: space-between;
    }}
    .bottom-bar {{
      bottom: 0; min-height: calc(64px + var(--safe-b));
      padding-top: 22px;
      padding-bottom: max(10px, var(--safe-b));
      background: linear-gradient(to top, var(--chrome-strong), transparent);
      justify-content: center; gap: 12px;
    }}
    .meta {{
      flex: 1; min-width: 0; text-align: center; pointer-events: none;
      padding: 0 6px;
    }}
    .meta .ch-name {{
      font-size: 15px; font-weight: 650; letter-spacing: -.01em;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }}
    .meta .now-title {{
      margin-top: 2px; font-size: 12px; color: var(--muted);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }}
    .meta .ch-num {{
      margin-top: 1px; font-size: 11px; color: rgba(232,237,245,.42);
      letter-spacing: .04em; text-transform: uppercase;
    }}
    .icon-btn {{
      border: 0; border-radius: 14px; min-width: var(--touch); min-height: var(--touch);
      padding: 0 12px; font-size: 15px; font-weight: 650; color: #fff;
      background: var(--btn); cursor: pointer; touch-action: manipulation;
      display: inline-flex; align-items: center; justify-content: center;
      text-decoration: none; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
      border: 1px solid var(--line);
    }}
    .icon-btn:active {{ background: var(--btn-hover); }}
    .icon-btn.active {{ color: var(--fav); border-color: rgba(217,119,6,.45); }}
    .icon-btn.browse {{ font-size: 13px; letter-spacing: .02em; }}
    .icon-btn.transport {{ min-width: var(--touch-lg); min-height: var(--touch-lg); font-size: 22px; border-radius: 18px; }}
    .surf-btn {{
      position: absolute; top: 50%; transform: translateY(-50%);
      width: var(--touch-lg); height: var(--touch-lg); border-radius: 20px;
      border: 1px solid var(--line); background: var(--btn); color: #fff;
      font-size: 28px; font-weight: 700; cursor: pointer; touch-action: manipulation;
      display: inline-flex; align-items: center; justify-content: center;
      backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    }}
    .surf-btn:disabled {{ opacity: .28; }}
    .surf-btn.prev {{ left: max(8px, var(--safe-l)); }}
    .surf-btn.next {{ right: max(8px, var(--safe-r)); }}
    .err {{
      position: absolute; left: 12px; right: 12px; bottom: calc(84px + var(--safe-b));
      z-index: 6; padding: 10px 12px; border-radius: 12px;
      background: rgba(80,16,16,.92); color: #fecaca; font-size: 13px;
      display: none; pointer-events: none;
    }}
    .spinner {{
      position: absolute; inset: 0; z-index: 3; display: flex;
      align-items: center; justify-content: center;
      background: rgba(0,0,0,.35); pointer-events: none;
    }}
    .spinner.hidden {{ display: none; }}
    .spinner::after {{
      content: ""; width: 42px; height: 42px; border-radius: 50%;
      border: 3px solid rgba(255,255,255,.22); border-top-color: #fff;
      animation: spin .8s linear infinite;
    }}
    @keyframes spin {{ to {{ transform: rotate(360deg); }} }}
    .tap-play {{
      position: absolute; inset: 0; z-index: 4; display: none;
      align-items: center; justify-content: center;
      background: rgba(0,0,0,.5); cursor: pointer;
    }}
    .tap-play.show {{ display: flex; }}
    .tap-play span {{
      padding: 14px 22px; border-radius: 999px; background: rgba(20,22,28,.95);
      color: #fff; font-size: 15px; font-weight: 650; border: 1px solid var(--line);
    }}
    .rotate-hint {{
      position: absolute; left: 50%; bottom: calc(18px + var(--safe-b));
      transform: translateX(-50%); z-index: 7;
      display: none; align-items: center; gap: 8px;
      padding: 10px 14px; border-radius: 999px;
      background: rgba(12,14,18,.92); border: 1px solid var(--line);
      color: var(--text); font-size: 13px; font-weight: 600;
      pointer-events: none;
    }}
    .rotate-hint.show {{ display: inline-flex; }}
    .rotate-hint .glyph {{ font-size: 16px; opacity: .85; }}
    .fs-nudge {{
      position: absolute; right: max(10px, var(--safe-r));
      bottom: calc(18px + var(--safe-b)); z-index: 7;
      display: none; min-height: 44px; padding: 0 14px; border-radius: 999px;
      border: 1px solid var(--line); background: rgba(12,14,18,.9);
      color: #fff; font-size: 12px; font-weight: 650; cursor: pointer;
      touch-action: manipulation;
    }}
    .fs-nudge.show {{ display: inline-flex; align-items: center; }}
    /* Portrait: usable but nudge landscape surfing */
    @media (orientation: portrait) {{
      .meta .ch-name {{ font-size: 14px; }}
      .surf-btn {{ width: 56px; height: 56px; }}
      body.prefer-landscape .rotate-hint {{ display: inline-flex; }}
    }}
    @media (orientation: landscape) {{
      .rotate-hint {{ display: none !important; }}
      .meta .ch-name {{ font-size: 16px; }}
    }}
    .drawer-backdrop {{
      position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 30;
      opacity: 0; pointer-events: none; transition: opacity .2s;
    }}
    .drawer-backdrop.open {{ opacity: 1; pointer-events: auto; }}
    .drawer {{
      position: fixed; left: 0; right: 0; bottom: 0; max-height: 78vh; z-index: 31;
      background: #12141a; border-radius: 16px 16px 0 0; transform: translateY(100%);
      transition: transform .25s ease; display: flex; flex-direction: column;
      border-top: 1px solid var(--line);
    }}
    .drawer.open {{ transform: translateY(0); }}
    .drawer-head {{ padding: 12px 14px 8px; border-bottom: 1px solid #2a2a2a; }}
    .drawer-head h2 {{ margin: 0 0 10px; font-size: 16px; font-weight: 650; }}
    .search-row {{ display: flex; gap: 8px; }}
    .search-row input {{
      flex: 1; min-height: 44px; border-radius: 10px; border: 1px solid #333;
      background: #1b1d24; color: #fff; font-size: 16px; padding: 0 12px;
    }}
    .drawer-body {{ overflow: auto; flex: 1; padding: 8px 0 16px; -webkit-overflow-scrolling: touch; }}
    .section-label {{
      padding: 8px 14px 4px; font-size: 12px; color: #9aa3b5;
      text-transform: uppercase; letter-spacing: .04em;
    }}
    .result-row {{
      display: flex; align-items: center; gap: 10px; padding: 12px 14px;
      border-bottom: 1px solid #222; cursor: pointer; touch-action: manipulation; min-height: 48px;
    }}
    .result-row:active {{ background: #1f222b; }}
    .result-row .name {{ flex: 1; font-size: 15px; }}
    .result-row .star {{ border: 0; background: transparent; font-size: 20px; min-width: 44px; min-height: 44px; color: #fff; }}
    .empty {{ padding: 16px 14px; color: #888; font-size: 14px; }}
  </style>
</head>
<body class="prefer-landscape">
  <div class="stage" id="stage">
    <video id="v" playsinline webkit-playsinline x-webkit-airplay="allow" muted></video>
      <div class="spinner" id="spin"></div>
      <div class="tap-play" id="tapPlay" role="button" tabindex="0"><span>Tap to play</span></div>
    <div class="chrome" id="chrome">
      <div class="top-bar">
        <a class="icon-btn browse hit" href="/tv/{channel_id}?guide=1" id="browseBtn" title="Back to TV guide">Guide</a>
        <div class="meta">
          <div class="ch-name" id="chName">{title}</div>
          <div class="now-title" id="nowTitle"></div>
          <div class="ch-num" id="chNum">Ch {ch_num} / {total}</div>
        </div>
        <button type="button" class="icon-btn hit" id="favBtn" aria-label="Favorite">☆</button>
        <button type="button" class="icon-btn hit" id="searchBtn" aria-label="Search channels">⌕</button>
      </div>
      <button type="button" class="surf-btn prev hit" id="prevBtn" aria-label="Previous channel">‹</button>
      <button type="button" class="surf-btn next hit" id="nextBtn" aria-label="Next channel">›</button>
      <div class="bottom-bar">
        <button type="button" class="icon-btn transport hit" id="playPauseBtn" aria-label="Play/Pause">❚❚</button>
        <button type="button" class="icon-btn transport hit" id="muteBtn" aria-label="Mute">🔇</button>
        <button type="button" class="icon-btn transport hit" id="fsBtn" aria-label="Fullscreen" title="Fullscreen">⛶</button>
      </div>
    </div>
    <div class="err" id="err"></div>
    <div class="rotate-hint" id="rotateHint" aria-live="polite">
      <span class="glyph">↻</span><span>Rotate for channel surfing</span>
    </div>
    <button type="button" class="fs-nudge" id="fsNudge">Tap for fullscreen</button>
  </div>
  <div class="drawer-backdrop" id="drawerBackdrop"></div>
  <div class="drawer" id="drawer" role="dialog" aria-label="Channel search">
    <div class="drawer-head">
      <h2>Find a channel</h2>
      <div class="search-row">
        <input id="searchInput" type="search" placeholder="Search by name..." autocomplete="off" enterkeyhint="search"/>
        <button type="button" class="icon-btn" id="closeDrawer" aria-label="Close">✕</button>
      </div>
    </div>
    <div class="drawer-body" id="drawerBody">
      <div class="section-label">Favorites</div>
      <div id="favList"></div>
      <div class="section-label">Recent</div>
      <div id="recentList"></div>
      <div class="section-label">Results</div>
      <div id="searchResults"><div class="empty">Type to search channels</div></div>
    </div>
  </div>
  <link rel="stylesheet" href="/tv-assets/player.css?v=20260906l"/>
  <script src="/tv-assets/pin_unlock.js?v=20260906l"></script>
  <script>
    const LS_FAV = "sd_favorites";
    const LS_RECENT = "sd_recents";
    const HIDE_MS = 3200;
    const stage = document.getElementById("stage");
    const chrome = document.getElementById("chrome");
    const v = document.getElementById("v");
    const err = document.getElementById("err");
    const spin = document.getElementById("spin");
    const tapPlay = document.getElementById("tapPlay");
    const chName = document.getElementById("chName");
    const nowTitle = document.getElementById("nowTitle");
    const chNum = document.getElementById("chNum");
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const favBtn = document.getElementById("favBtn");
    const searchBtn = document.getElementById("searchBtn");
    const playPauseBtn = document.getElementById("playPauseBtn");
    const muteBtn = document.getElementById("muteBtn");
    const fsBtn = document.getElementById("fsBtn");
    const fsNudge = document.getElementById("fsNudge");
    const rotateHint = document.getElementById("rotateHint");
    const drawer = document.getElementById("drawer");
    const drawerBackdrop = document.getElementById("drawerBackdrop");
    const searchInput = document.getElementById("searchInput");
    const closeDrawer = document.getElementById("closeDrawer");
    const favList = document.getElementById("favList");
    const recentList = document.getElementById("recentList");
    const searchResults = document.getElementById("searchResults");
    let channelId = "{channel_id}";
    let hls = null;
    let userUnmuted = false;
    let switching = false;
    let currentStreamUrl = "/live/{channel_id}.m3u8";
    let stallTimer = null;
    let reloadAttempts = 0;
    let playRetryCount = 0;
    let playRetryTimer = null;
    let policyRetryCount = 0;
    let autoplayPolicyBlocked = false;
    let userGestureSeen = false;
    let searchTimer = null;
    let hideTimer = null;
    let chromePinned = false;
    let immersiveTried = false;
    const STALL_RELOAD_MS = 18000;
    const MAX_RELOAD_ATTEMPTS = 8;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "") ||
      (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);
    const HLS_CFG = {{
      enableWorker: !isIOS,
      lowLatencyMode: false,
      liveDurationInfinity: true,
      startLevel: -1,
      capLevelToPlayerSize: true,
      maxBufferLength: 30,
      maxMaxBufferLength: 90,
      liveSyncDuration: 4,
      liveMaxLatencyDuration: 30,
      backBufferLength: 30,
      maxBufferSize: 60 * 1000 * 1000,
      maxBufferHole: 0.5,
      fragLoadingTimeOut: 25000,
      manifestLoadingTimeOut: 20000,
      levelLoadingTimeOut: 20000,
      fragLoadingMaxRetry: 8,
      manifestLoadingMaxRetry: 6,
      levelLoadingMaxRetry: 6,
    }};

    function readJson(key, fallback) {{
      try {{ return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }}
      catch (e) {{ return fallback; }}
    }}
    function writeJson(key, val) {{ localStorage.setItem(key, JSON.stringify(val)); }}
    function getFavorites() {{ return readJson(LS_FAV, []); }}
    function getRecents() {{ return readJson(LS_RECENT, []); }}
    function isFavorite(id) {{ return getFavorites().some(x => x.id === id); }}

    function toggleFavorite(id, name) {{
      let favs = getFavorites();
      if (favs.some(x => x.id === id)) favs = favs.filter(x => x.id !== id);
      else favs.unshift({{ id, name: name || ("Channel " + id) }});
      writeJson(LS_FAV, favs.slice(0, 30));
      updateFavBtn();
      renderLists();
    }}

    function pushRecent(id, name) {{
      let rec = getRecents().filter(x => x.id !== id);
      rec.unshift({{ id, name: name || ("Channel " + id) }});
      writeJson(LS_RECENT, rec.slice(0, 5));
      renderLists();
    }}

    function updateFavBtn() {{
      const on = isFavorite(channelId);
      favBtn.textContent = on ? "★" : "☆";
      favBtn.classList.toggle("active", on);
      favBtn.setAttribute("aria-label", on ? "Remove favorite" : "Add favorite");
    }}

    function renderChannelRows(container, items, emptyText) {{
      container.innerHTML = "";
      if (!items.length) {{
        container.innerHTML = '<div class="empty">' + emptyText + '</div>';
        return;
      }}
      for (const item of items) {{
        const row = document.createElement("div");
        row.className = "result-row";
        row.innerHTML = '<span class="name"></span><button type="button" class="star" aria-label="Toggle favorite">☆</button>';
        row.querySelector(".name").textContent = item.name;
        const star = row.querySelector(".star");
        star.textContent = isFavorite(item.id) ? "★" : "☆";
        row.addEventListener("click", (e) => {{
          if (e.target === star) return;
          closeDrawerFn();
          switchChannel(item.id);
        }});
        star.addEventListener("click", (e) => {{
          e.stopPropagation();
          toggleFavorite(item.id, item.name);
          star.textContent = isFavorite(item.id) ? "★" : "☆";
        }});
        container.appendChild(row);
      }}
    }}

    function renderLists() {{
      renderChannelRows(favList, getFavorites(), "No favorites yet — tap ☆ on a channel");
      renderChannelRows(recentList, getRecents(), "No recent channels");
    }}

    function openDrawer() {{
      chromePinned = true;
      showChrome(true);
      drawer.classList.add("open");
      drawerBackdrop.classList.add("open");
      renderLists();
      setTimeout(() => searchInput.focus(), 200);
    }}
    function closeDrawerFn() {{
      drawer.classList.remove("open");
      drawerBackdrop.classList.remove("open");
      chromePinned = false;
      scheduleHideChrome();
    }}

    searchBtn.addEventListener("click", (e) => {{ e.stopPropagation(); openDrawer(); }});
    closeDrawer.addEventListener("click", closeDrawerFn);
    drawerBackdrop.addEventListener("click", closeDrawerFn);
    favBtn.addEventListener("click", (e) => {{
      e.stopPropagation();
      toggleFavorite(channelId, chName.textContent);
      showChrome(true);
    }});

    searchInput.addEventListener("input", () => {{
      clearTimeout(searchTimer);
      searchTimer = setTimeout(runSearch, 250);
    }});

    async function runSearch() {{
      const q = searchInput.value.trim();
      if (!q) {{
        searchResults.innerHTML = '<div class="empty">Type to search channels</div>';
        return;
      }}
      searchResults.innerHTML = '<div class="empty">Searching…</div>';
      try {{
        const r = await authFetch("/channels/search?q=" + encodeURIComponent(q));
        if (!r.ok) throw new Error("search_failed");
        const items = await r.json();
        renderChannelRows(searchResults, items.map(c => ({{ id: c.id, name: c.name }})), "No matches");
      }} catch (e) {{
        searchResults.innerHTML = '<div class="empty">Search failed</div>';
      }}
    }}

    function showErr(m) {{
      spin.classList.add("hidden");
      tapPlay.classList.remove("show");
      err.style.display = "block";
      err.textContent = m;
      showChrome(true);
    }}
    function clearErr() {{ err.style.display = "none"; err.textContent = ""; }}
    function showLoading() {{ spin.classList.remove("hidden"); }}
    function hideLoading() {{ spin.classList.add("hidden"); }}
    function showTapPlay() {{
      autoplayPolicyBlocked = true;
      hideLoading();
      if (tapPlay) {{
        const label = tapPlay.querySelector("span");
        if (label) label.textContent = "Tap to play";
        tapPlay.classList.add("show");
      }}
      chromePinned = true;
      showChrome(true);
    }}
    function hideTapPlay() {{
      autoplayPolicyBlocked = false;
      tapPlay.classList.remove("show");
      if (!drawer.classList.contains("open")) chromePinned = false;
    }}
    function isAutoplayPolicyError(err) {{
      if (!err) return false;
      const name = String(err.name || "");
      const msg = String(err.message || err || "");
      return name === "NotAllowedError" || /not allowed|user.?gesture|autoplay/i.test(msg);
    }}

    function syncTransport() {{
      playPauseBtn.textContent = v.paused ? "▶" : "❚❚";
      playPauseBtn.setAttribute("aria-label", v.paused ? "Play" : "Pause");
      muteBtn.textContent = v.muted ? "🔇" : "🔊";
      muteBtn.setAttribute("aria-label", v.muted ? "Unmute" : "Mute");
    }}

    function showChrome(keep) {{
      chrome.classList.remove("hidden");
      if (keep || chromePinned || v.paused || drawer.classList.contains("open") || tapPlay.classList.contains("show")) {{
        clearTimeout(hideTimer);
        return;
      }}
      scheduleHideChrome();
    }}
    function scheduleHideChrome() {{
      clearTimeout(hideTimer);
      if (chromePinned || v.paused || drawer.classList.contains("open") || tapPlay.classList.contains("show")) return;
      hideTimer = setTimeout(() => chrome.classList.add("hidden"), HIDE_MS);
    }}
    function toggleChrome() {{
      if (chrome.classList.contains("hidden")) showChrome(false);
      else {{
        chrome.classList.add("hidden");
        clearTimeout(hideTimer);
      }}
    }}

    async function lockLandscape() {{
      try {{
        if (screen.orientation && screen.orientation.lock) {{
          await screen.orientation.lock("landscape");
          return true;
        }}
      }} catch (e) {{}}
      return false;
    }}

    async function enterImmersive(fromGesture) {{
      immersiveTried = true;
      let ok = false;
      try {{
        const el = document.documentElement;
        if (!document.fullscreenElement) {{
          if (el.requestFullscreen) {{
            await el.requestFullscreen({{ navigationUI: "hide" }});
            ok = true;
          }} else if (el.webkitRequestFullscreen) {{
            el.webkitRequestFullscreen();
            ok = true;
          }}
        }} else ok = true;
      }} catch (e) {{
        if (fromGesture && v && v.webkitEnterFullscreen) {{
          try {{ v.webkitEnterFullscreen(); ok = true; }} catch (e2) {{}}
        }}
      }}
      const locked = await lockLandscape();
      try {{ window.scrollTo(0, 1); }} catch (e) {{}}
      updateFsUi(ok || !!document.fullscreenElement, locked);
      return ok;
    }}

    function updateFsUi(isFs, locked) {{
      const portrait = window.matchMedia("(orientation: portrait)").matches;
      rotateHint.classList.toggle("show", portrait);
      const needNudge = isMobile && !document.fullscreenElement && !isFs;
      fsNudge.classList.toggle("show", needNudge && !locked);
    }}

    function refreshOrientationUi() {{
      const portrait = window.matchMedia("(orientation: portrait)").matches;
      rotateHint.classList.toggle("show", portrait);
      fsNudge.classList.toggle("show", isMobile && !document.fullscreenElement);
      if (!portrait) lockLandscape();
    }}

    function nativeHls() {{
      try {{
        if (window.Hls && typeof Hls.isSupported === "function" && Hls.isSupported()) {{
          return false;
        }}
      }} catch (e) {{}}
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      if (!ios) return false;
      return !!v.canPlayType("application/vnd.apple.mpegurl") || !!v.canPlayType("application/x-mpegURL");
    }}

    function tryPlay() {{
      if (!v) return Promise.resolve();
      if (autoplayPolicyBlocked && !userGestureSeen) return Promise.resolve();
      try {{ v.setAttribute("playsinline", ""); v.playsInline = true; }} catch (e) {{}}
      if (!userUnmuted || !userGestureSeen) {{
        try {{ v.setAttribute("muted", ""); }} catch (e) {{}}
        v.muted = true;
      }}
      showLoading();
      return v.play().then(() => {{
        playRetryCount = 0;
        policyRetryCount = 0;
        if (playRetryTimer) {{ clearTimeout(playRetryTimer); playRetryTimer = null; }}
        hideTapPlay();
        hideLoading();
        syncTransport();
        scheduleHideChrome();
      }}).catch((err) => {{
        if (isAutoplayPolicyError(err)) {{
          policyRetryCount += 1;
          if (policyRetryCount >= 6 && v.paused && !userGestureSeen) {{
        showTapPlay();
            syncTransport();
            return;
          }}
          showLoading();
          if (playRetryTimer) clearTimeout(playRetryTimer);
          playRetryTimer = setTimeout(() => tryPlay(), 280 * Math.min(policyRetryCount, 5));
          return;
        }}
        playRetryCount += 1;
        showLoading();
        if (playRetryCount >= 16) playRetryCount = 0;
        if (playRetryTimer) clearTimeout(playRetryTimer);
        playRetryTimer = setTimeout(() => tryPlay(), 400 * Math.min(Math.max(playRetryCount, 1), 5));
        syncTransport();
      }});
    }}

    function onVideoReady() {{ showLoading(); if (!autoplayPolicyBlocked || userGestureSeen) tryPlay(); }}
    function onVideoError() {{
      const code = v.error ? v.error.code : 0;
      showErr("Video error" + (code ? " (" + code + ")" : "") + " — retrying…");
      showLoading();
      if (currentStreamUrl && reloadAttempts < MAX_RELOAD_ATTEMPTS) {{
        reloadAttempts += 1;
        setTimeout(() => attachHls(currentStreamUrl + "?r=" + Date.now(), true), 1200);
      }}
    }}

    function clearStallTimer() {{
      if (stallTimer) {{ clearTimeout(stallTimer); stallTimer = null; }}
    }}

    function scheduleStallReload() {{
      clearStallTimer();
      stallTimer = setTimeout(() => {{
        if (v.paused || switching) return;
        if (v.readyState >= 3 && !v.seeking) return;
        if (reloadAttempts >= MAX_RELOAD_ATTEMPTS) {{
          showErr("Playback stalled — tap to retry");
          showLoading();
          return;
        }}
        reloadAttempts += 1;
        attachHls(currentStreamUrl + "?r=" + Date.now(), true);
      }}, STALL_RELOAD_MS);
    }}

    v.addEventListener("loadeddata", onVideoReady);
    v.addEventListener("canplay", () => {{
      clearStallTimer();
      reloadAttempts = 0;
      if (v.paused && currentStreamUrl && (!autoplayPolicyBlocked || userGestureSeen)) tryPlay();
      else hideLoading();
    }});
    v.addEventListener("playing", () => {{
      hideLoading(); hideTapPlay(); clearStallTimer(); reloadAttempts = 0; policyRetryCount = 0; playRetryCount = 0; syncTransport(); scheduleHideChrome();
    }});
    v.addEventListener("pause", () => {{ syncTransport(); showChrome(true); }});
    v.addEventListener("volumechange", syncTransport);
    v.addEventListener("waiting", () => {{
      if (v.readyState < 3) showLoading();
      scheduleStallReload();
    }});
    v.addEventListener("error", onVideoError);

    tapPlay.addEventListener("click", async (e) => {{
      e.stopPropagation();
      hideTapPlay();
      userGestureSeen = true;
      userUnmuted = true;
      v.muted = false;
      reloadAttempts = 0;
      policyRetryCount = 0;
      playRetryCount = 0;
      await enterImmersive(true);
      if (currentStreamUrl) attachHls(currentStreamUrl + "?r=" + Date.now(), true);
      else tryPlay();
      syncTransport();
    }});

    playPauseBtn.addEventListener("click", async (e) => {{
      e.stopPropagation();
      await enterImmersive(true);
      if (v.paused) {{
        userUnmuted = userUnmuted || !v.muted;
        tryPlay();
      }} else v.pause();
      syncTransport();
      showChrome(true);
    }});

    muteBtn.addEventListener("click", (e) => {{
      e.stopPropagation();
      v.muted = !v.muted;
      if (!v.muted) userUnmuted = true;
      syncTransport();
      showChrome(true);
    }});

    fsBtn.addEventListener("click", async (e) => {{
      e.stopPropagation();
      if (document.fullscreenElement) {{
        try {{ await document.exitFullscreen(); }} catch (err) {{}}
      }} else {{
        await enterImmersive(true);
      }}
      showChrome(true);
    }});
    fsNudge.addEventListener("click", async (e) => {{
      e.stopPropagation();
      await enterImmersive(true);
      fsNudge.classList.remove("show");
    }});

    function destroyHls() {{
      clearStallTimer();
      if (hls) {{ try {{ hls.destroy(); }} catch (e) {{}} hls = null; }}
      v.removeAttribute("src");
      try {{ v.load(); }} catch (e) {{}}
    }}

    function handleAuthFailure() {{
      showErr("Session ended — unlock with PIN");
      destroyHls();
      if (window.SDPinUnlock && typeof SDPinUnlock.open === "function") {{
        SDPinUnlock.open({{
          message: "Enter your household PIN to keep watching.",
          onSuccess: function () {{
            try {{ location.reload(); }} catch (e) {{}}
          }}
        }});
        return;
      }}
      showErr("PIN unlock UI unavailable — refresh and try again");
    }}

    async function authFetch(url, opts) {{
      const r = await fetch(url, Object.assign({{ credentials: "same-origin" }}, opts || {{}}));
      if (r.status === 401) {{
        handleAuthFailure();
        throw new Error("session_ended");
      }}
      return r;
    }}

    async function resolvePlayUrl(url) {{
      const absUrl = url.startsWith("http") ? url : (location.origin + url);
      if (url.includes("/live/") || url.includes("/content/") || url.includes("/vod/hls/") || url.includes("/vod/file/")) return absUrl;
      try {{
        const r = await authFetch(absUrl, {{ cache: "no-store" }});
        if (!r.ok) return absUrl;
        const text = await r.text();
        for (const line of text.split("\\n")) {{
          const t = line.trim();
          if (t && !t.startsWith("#")) {{
            return t.startsWith("http") ? t : (location.origin + t);
          }}
        }}
      }} catch (e) {{}}
      return absUrl;
    }}

    async function attachHls(url, isReload) {{
      destroyHls();
      clearErr();
      hideTapPlay();
      playRetryCount = 0;
      policyRetryCount = 0;
      showLoading();
      currentStreamUrl = url.split("?")[0];
      try {{
        v.setAttribute("muted", "");
        v.setAttribute("playsinline", "");
        v.playsInline = true;
        if (!userUnmuted || !userGestureSeen) v.muted = true;
      }} catch (e) {{}}
      const absUrl = await resolvePlayUrl(url);
      if (nativeHls()) {{
        v.src = absUrl;
        tryPlay();
        return;
      }}
      if (window.Hls && Hls.isSupported()) {{
        hls = new Hls(HLS_CFG);
        hls.loadSource(absUrl);
        hls.attachMedia(v);
        hls.on(Hls.Events.MANIFEST_PARSED, () => tryPlay());
        hls.on(Hls.Events.FRAG_LOADED, () => {{
          if (v.paused && currentStreamUrl && (!autoplayPolicyBlocked || userGestureSeen)) tryPlay();
        }});
        hls.on(Hls.Events.ERROR, (_, data) => {{
          if (!data.fatal) {{
            if (data.details === "bufferStalledError" || data.details === "bufferSeekOverHole") {{
              try {{ hls.startLoad(-1); }} catch (e) {{}}
            }}
            return;
          }}
          if (data.response && data.response.code === 401) {{
            handleAuthFailure();
            return;
          }}
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {{
            try {{
              hls.startLoad(-1);
            }} catch (e) {{
              if (reloadAttempts < MAX_RELOAD_ATTEMPTS) {{
                reloadAttempts += 1;
                setTimeout(() => attachHls(currentStreamUrl + "?r=" + Date.now(), true), 1200);
              }} else {{
                showErr("Network error — tap to retry");
                const label = tapPlay.querySelector("span");
                if (label) label.textContent = "Tap to retry";
                tapPlay.classList.add("show");
                hideLoading();
              }}
            }}
          }} else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {{
            try {{ hls.recoverMediaError(); }} catch (e) {{ showErr("Media error — recovering…"); }}
          }} else {{
            if (reloadAttempts < MAX_RELOAD_ATTEMPTS) {{
              reloadAttempts += 1;
              setTimeout(() => attachHls(currentStreamUrl + "?r=" + Date.now(), true), 1500);
            }} else {{
              showErr("Playback error — try VLC with the .m3u8 URL");
              destroyHls();
              const label = tapPlay.querySelector("span");
              if (label) label.textContent = "Tap to retry";
              tapPlay.classList.add("show");
              hideLoading();
            }}
          }}
        }});
        return;
      }}
      showErr("This browser cannot play HLS. Open the .m3u8 in VLC / TiviMate / MX Player.");
    }}

    async function loadNowTitle(id) {{
      nowTitle.textContent = "";
      try {{
        const r = await authFetch("/epg/now-next/" + encodeURIComponent(id));
        if (!r.ok) return;
        const data = await r.json();
        const title = data && data.now && (data.now.title || data.now.name);
        if (title) nowTitle.textContent = title;
      }} catch (e) {{}}
    }}

    function updateNav(meta) {{
      const name = meta.name || "Channel";
      chName.textContent = name;
      chNum.textContent = "Ch " + (meta.number || 0) + " / " + (meta.total || 0);
      prevBtn.disabled = !meta.prev;
      nextBtn.disabled = !meta.next;
      document.title = name;
      updateFavBtn();
      pushRecent(meta.channel_id || channelId, name);
      loadNowTitle(meta.channel_id || channelId);
    }}

    async function loadNeighbors(id) {{
      const r = await authFetch("/channels/neighbors/" + encodeURIComponent(id));
      if (!r.ok) throw new Error("neighbor_lookup_failed");
      return r.json();
    }}

    async function switchChannel(targetId) {{
      if (!targetId || targetId === channelId || switching) return;
      switching = true;
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      showChrome(true);
      try {{
        const meta = await loadNeighbors(targetId);
        channelId = meta.channel_id;
        history.replaceState({{ sdSimplePlayer: 1 }}, "", "/play/" + channelId);
        updateNav(meta);
        attachHls(meta.stream_url);
      }} catch (e) {{
        showErr("Could not switch channel");
        hideLoading();
      }} finally {{
        switching = false;
      }}
    }}

    async function goPrev() {{
      const meta = await loadNeighbors(channelId);
      if (meta.prev) await switchChannel(meta.prev.id);
    }}
    async function goNext() {{
      const meta = await loadNeighbors(channelId);
      if (meta.next) await switchChannel(meta.next.id);
    }}

    prevBtn.addEventListener("click", (e) => {{ e.stopPropagation(); goPrev(); }});
    nextBtn.addEventListener("click", (e) => {{ e.stopPropagation(); goNext(); }});

    // Tap empty stage toggles chrome; ignore control hits
    stage.addEventListener("click", (e) => {{
      if (e.target.closest(".hit, .tap-play, .drawer, .fs-nudge")) return;
      toggleChrome();
    }});

    // Swipe channel surfing (horizontal landscape; vertical also works)
    let touchStartX = 0, touchStartY = 0, touchStartT = 0;
    stage.addEventListener("touchstart", (e) => {{
      if (!e.touches || !e.touches.length) return;
      if (e.target.closest(".hit, .drawer, input")) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartT = Date.now();
    }}, {{ passive: true }});
    stage.addEventListener("touchend", (e) => {{
      if (!e.changedTouches || !e.changedTouches.length) return;
      if (drawer.classList.contains("open")) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      const dt = Date.now() - touchStartT;
      if (dt > 650) return;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (ax < 56 && ay < 56) return;
      if (ax > ay) {{
        if (dx < 0) goNext();
        else goPrev();
      }} else {{
        if (dy < 0) goNext();
        else goPrev();
      }}
      showChrome(true);
    }}, {{ passive: true }});

    document.addEventListener("keydown", async (e) => {{
      if (drawer.classList.contains("open")) return;
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "[") {{
        e.preventDefault(); await goPrev();
      }} else if (e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "]") {{
        e.preventDefault(); await goNext();
      }} else if (e.key === " " || e.key === "k" || e.key === "K") {{
        e.preventDefault();
        if (v.paused) tryPlay(); else v.pause();
      }} else if (e.key === "m" || e.key === "M") {{
        v.muted = !v.muted;
        if (!v.muted) userUnmuted = true;
        syncTransport();
      }} else if (e.key === "f" || e.key === "F") {{
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {{}});
        else enterImmersive(true);
      }}
      showChrome(true);
    }});

    document.addEventListener("fullscreenchange", () => {{
      if (document.fullscreenElement) lockLandscape();
      refreshOrientationUi();
    }});
    window.addEventListener("orientationchange", () => setTimeout(refreshOrientationUi, 120));
    window.addEventListener("resize", () => refreshOrientationUi(), {{ passive: true }});

    // First user gesture → immersive landscape (gesture lost on cross-page nav)
    function onFirstGesture() {{
      enterImmersive(true);
      document.removeEventListener("pointerdown", onFirstGesture, true);
    }}
    document.addEventListener("pointerdown", onFirstGesture, true);

    (async () => {{
      updateFavBtn();
      syncTransport();
      showChrome(true);
      refreshOrientationUi();
      // Best-effort without gesture (works in installed PWA / some Android WebViews)
      if (isMobile) enterImmersive(false);
      try {{
        const meta = await loadNeighbors(channelId);
        updateNav(meta);
        attachHls(meta.stream_url);
      }} catch (e) {{
        attachHls("/live/{channel_id}.m3u8");
        pushRecent(channelId, chName.textContent);
        loadNowTitle(channelId);
      }}
    }})();

    (function wireGuideRoundTrip() {{
      function guideUrl() {{
        const id = channelId || "{channel_id}";
        try {{ localStorage.setItem("sd_tv_guide_collapsed", "0"); }} catch (e) {{}}
        try {{ sessionStorage.setItem("sd_return_guide", "1"); }} catch (e) {{}}
        return "/tv/" + encodeURIComponent(id) + "?guide=1";
      }}
      const browse = document.getElementById("browseBtn");
      if (browse) {{
        browse.addEventListener("click", (e) => {{
          e.preventDefault();
          e.stopPropagation();
          try {{
            if (document.fullscreenElement) document.exitFullscreen();
          }} catch (err) {{}}
          location.href = guideUrl();
        }});
      }}
      try {{
        history.replaceState({{ sdSimplePlayer: 1 }}, "", location.href);
        history.pushState({{ sdSimpleTrap: 1 }}, "", location.href);
      }} catch (e) {{}}
      window.addEventListener("popstate", () => {{
        try {{
          if (document.fullscreenElement) document.exitFullscreen();
        }} catch (err) {{}}
        location.replace(guideUrl());
      }});
    }})();
  </script>
  <script src="/tv-assets/pull_reload.js" defer></script>
</body>
</html>"""
