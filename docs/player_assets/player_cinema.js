/* Cinema player advanced: settings/themes, gestures, sources, dual audio, download, xray */
(function sdCinemaBoot() {
  const LS_PLAYER_THEME = "sd_player_theme";
  const LS_SPEED = "sd_player_speed";
  const LS_DUAL_AUDIO = "sd_dual_audio";
  const LS_ZOOM = "sd_player_zoom";
  const LS_SUB_OFFSET = "sd_sub_offset";
  const LS_XRAY_PAUSE = "sd_xray_pause";

  let controlsLocked = false;
  let dualAudioEl = null;
  let dualAudioTimer = null;
  let gestureState = null;
  let zoomMode = "contain"; // contain | cover | manual
  let manualZoom = 1;

  function lsGet(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : v;
    } catch (e) {
      return d;
    }
  }
  function lsSet(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {}
  }
  function toast(msg) {
    const el = document.getElementById("pcToast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 2200);
  }
  function gestureHud(label, pct) {
    const hud = document.getElementById("pcGestureHud");
    const lab = document.getElementById("pcGestureLabel");
    const bar = document.getElementById("pcGestureBar");
    if (!hud) return;
    if (lab) lab.textContent = label;
    if (bar) bar.style.width = Math.max(0, Math.min(100, pct || 0)) + "%";
    hud.classList.add("show");
    clearTimeout(hud._t);
    hud._t = setTimeout(() => hud.classList.remove("show"), 900);
  }

  function applyPlayerTheme(theme) {
    const allowed = ["cinema", "prime", "netflix", "broadcast"];
    if (!allowed.includes(theme)) theme = "cinema";
    lsSet(LS_PLAYER_THEME, theme);
    if (tvRoot) tvRoot.dataset.playerTheme = theme;
    document.querySelectorAll(".pc-theme-grid button").forEach((b) => {
      b.classList.toggle("active", b.dataset.theme === theme);
    });
  }

  function ensureSettingsDom() {
    if (document.getElementById("pcSettings")) return;
    const backdrop = document.createElement("div");
    backdrop.className = "pc-settings-backdrop";
    backdrop.id = "pcSettingsBackdrop";
    const sheet = document.createElement("div");
    sheet.className = "pc-settings";
    sheet.id = "pcSettings";
    sheet.innerHTML =
      '<div class="pc-sh"><h3>Player settings</h3><button type="button" id="pcSettingsClose">✕</button></div>' +
      '<div class="pc-sb">' +
      '<div class="pc-sec"><div class="pc-sec-title">Appearance</div>' +
      '<div class="pc-theme-grid" id="pcThemeGrid">' +
      '<button type="button" data-theme="cinema" class="active">Cinema<span>Soft white · default</span></button>' +
      '<button type="button" data-theme="prime">Prime Soft<span>Teal accents</span></button>' +
      '<button type="button" data-theme="netflix">Netflix Warm<span>Red accents</span></button>' +
      '<button type="button" data-theme="broadcast">Broadcast<span>Blue utility</span></button>' +
      "</div></div>" +
      '<div class="pc-sec"><div class="pc-sec-title">Playback</div>' +
      '<div class="pc-row"><div><label>Speed</label><span class="hint">0.25x – 2x</span></div>' +
      '<select id="pcSetSpeed"><option>0.25</option><option>0.5</option><option>0.75</option><option selected>1</option><option>1.25</option><option>1.5</option><option>1.75</option><option>2</option></select></div>' +
      '<div class="pc-row"><div><label>Zoom</label><span class="hint">Fit · Cover · Manual</span></div>' +
      '<select id="pcSetZoom"><option value="contain">Fit</option><option value="cover">Cover</option><option value="manual">Manual</option></select></div>' +
      '<div class="pc-row"><div><label>Manual zoom</label></div><input type="range" id="pcSetZoomAmt" min="1" max="2" step="0.01" value="1"/></div>' +
      "</div>" +
      '<div class="pc-sec"><div class="pc-sec-title">Audio & language</div>' +
      '<div class="pc-row"><div><label>Dual-source audio</label><span class="hint">Keep video, play other-language audio (experimental)</span></div>' +
      '<button type="button" class="pc-toggle" id="pcSetDual" aria-pressed="false"></button></div>' +
      "</div>" +
      '<div class="pc-sec"><div class="pc-sec-title">Subtitles</div>' +
      '<div class="pc-row"><div><label>Offset (ms)</label><span class="hint">Negative = earlier</span></div>' +
      '<input type="range" id="pcSetSubOff" min="-5000" max="5000" step="100" value="0"/></div>' +
      '<div class="pc-row"><div><label>Size</label></div><input type="range" id="pcSetSubSize" min="14" max="42" step="1" value="22"/></div>' +
      "</div>" +
      '<div class="pc-sec"><div class="pc-sec-title">X-ray</div>' +
      '<div class="pc-row"><div><label>Pause while open</label></div>' +
      '<button type="button" class="pc-toggle" id="pcSetXrayPause" aria-pressed="false"></button></div>' +
      "</div>" +
      '<div class="pc-sec"><div class="pc-sec-title">Downloads</div>' +
      '<div class="pc-row"><div><label>Saved offline</label><span class="hint" id="pcDlHint">MP4 titles only</span></div>' +
      '<button type="button" class="pc-btn-label" id="pcClearDl" style="width:auto;padding:8px 12px;border-radius:10px;border:0;background:#1a1f2a;color:#fff;cursor:pointer">Clear list</button></div>' +
      '<div id="pcDlList" style="padding:4px 6px;font-size:12px;color:#9aa"></div>' +
      "</div></div>";
    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);
    backdrop.addEventListener("click", closeSettings);
    document.getElementById("pcSettingsClose").addEventListener("click", closeSettings);
    document.getElementById("pcThemeGrid").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-theme]");
      if (b) applyPlayerTheme(b.dataset.theme);
    });
    const speed = document.getElementById("pcSetSpeed");
    speed.value = lsGet(LS_SPEED, "1");
    speed.addEventListener("change", () => {
      lsSet(LS_SPEED, speed.value);
      applySpeed(Number(speed.value));
    });
    const zoom = document.getElementById("pcSetZoom");
    zoom.value = lsGet(LS_ZOOM, "contain");
    zoom.addEventListener("change", () => applyZoom(zoom.value));
    const zoomAmt = document.getElementById("pcSetZoomAmt");
    zoomAmt.value = String(manualZoom);
    zoomAmt.addEventListener("input", () => {
      manualZoom = Number(zoomAmt.value) || 1;
      if (tvRoot) tvRoot.style.setProperty("--pc-zoom", String(manualZoom));
      applyZoom("manual");
    });
    wireToggle("pcSetDual", LS_DUAL_AUDIO, "0");
    wireToggle("pcSetXrayPause", LS_XRAY_PAUSE, "0");
    const subOff = document.getElementById("pcSetSubOff");
    subOff.value = lsGet(LS_SUB_OFFSET, "0");
    subOff.addEventListener("input", () => lsSet(LS_SUB_OFFSET, subOff.value));
    const subSize = document.getElementById("pcSetSubSize");
    subSize.value = lsGet("sd_sub_size", "22");
    subSize.addEventListener("input", () => {
      lsSet("sd_sub_size", subSize.value);
      const overlay = document.getElementById("sdSubOverlay");
      if (overlay) overlay.style.setProperty("--sd-sub-size", subSize.value + "px");
    });
    document.getElementById("pcClearDl").addEventListener("click", () => {
      try {
        localStorage.removeItem("sd_downloads");
      } catch (e) {}
      renderDownloadList();
      toast("Downloads cleared");
    });
  }

  function wireToggle(id, key, defOff) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const on = lsGet(key, defOff) === "1";
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.addEventListener("click", () => {
      const next = !btn.classList.contains("on");
      btn.classList.toggle("on", next);
      btn.setAttribute("aria-pressed", next ? "true" : "false");
      lsSet(key, next ? "1" : "0");
      if (id === "pcSetDual" && !next) stopDualAudio();
    });
  }

  function openSettings() {
    ensureSettingsDom();
    applyPlayerTheme(lsGet(LS_PLAYER_THEME, "cinema"));
    renderDownloadList();
    document.getElementById("pcSettingsBackdrop").classList.add("open");
    document.getElementById("pcSettings").classList.add("open");
  }
  function closeSettings() {
    const b = document.getElementById("pcSettingsBackdrop");
    const s = document.getElementById("pcSettings");
    if (b) b.classList.remove("open");
    if (s) s.classList.remove("open");
  }

  function applySpeed(rate) {
    try {
      v.playbackRate = rate || 1;
    } catch (e) {}
    const btn = document.getElementById("pcSpeedBtn");
    if (btn) btn.textContent = (rate || 1) + "x";
  }

  function applyZoom(mode) {
    zoomMode = mode || "contain";
    lsSet(LS_ZOOM, zoomMode);
    if (!tvRoot) return;
    tvRoot.classList.remove("pc-zoom-cover", "pc-zoom-contain", "pc-zoom-manual");
    if (zoomMode === "cover") tvRoot.classList.add("pc-zoom-cover");
    else if (zoomMode === "manual") {
      tvRoot.classList.add("pc-zoom-manual");
      tvRoot.style.setProperty("--pc-zoom", String(manualZoom));
    } else tvRoot.classList.add("pc-zoom-contain");
    const sel = document.getElementById("pcSetZoom");
    if (sel) sel.value = zoomMode;
  }

  function setLocked(on) {
    controlsLocked = !!on;
    if (tvRoot) tvRoot.classList.toggle("pc-controls-locked", controlsLocked);
    toast(controlsLocked ? "Controls locked" : "Controls unlocked");
  }

  function cycleZoom() {
    const order = ["contain", "cover", "manual"];
    const i = order.indexOf(zoomMode);
    applyZoom(order[(i + 1) % order.length]);
    toast("Zoom: " + zoomMode);
  }

  async function toggleFullscreen() {
    const area = document.getElementById("videoArea") || trailerLayer;
    try {
      if (!document.fullscreenElement) {
        if (area.requestFullscreen) await area.requestFullscreen();
        else if (area.webkitRequestFullscreen) area.webkitRequestFullscreen();
      } else if (document.exitFullscreen) await document.exitFullscreen();
    } catch (e) {}
    try {
      if (window.SDMobile && SDMobile.enterImmersive) SDMobile.enterImmersive(area);
    } catch (e2) {}
  }

  function renderSpeedMenu() {
    const menu = document.getElementById("pcSpeedMenu");
    if (!menu) return;
    menu.innerHTML = '<div class="pc-menu-head">Speed</div>';
    [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].forEach((r) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = r + "x";
      if (Math.abs((v.playbackRate || 1) - r) < 0.01) b.classList.add("active");
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        lsSet(LS_SPEED, String(r));
        applySpeed(r);
        menu.classList.remove("open");
      });
      menu.appendChild(b);
    });
  }

  function renderAudioMenu() {
    const menu = document.getElementById("pcAudioMenu");
    if (!menu) return;
    menu.innerHTML = '<div class="pc-menu-head">Audio</div>';
    const add = (label, fn, active) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      if (active) b.classList.add("active");
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        fn();
        menu.classList.remove("open");
      });
      menu.appendChild(b);
    };
    add("Original (this stream)", () => {
      stopDualAudio();
      if (hls && hls.audioTracks && hls.audioTracks.length) {
        try {
          hls.audioTrack = -1;
        } catch (e) {}
      }
      toast("Original audio");
    }, !dualAudioEl);
    if (hls && hls.audioTracks && hls.audioTracks.length) {
      hls.audioTracks.forEach((t, i) => {
        add((t.name || t.lang || "Track " + (i + 1)) + (t.lang ? " · " + t.lang : ""), () => {
          stopDualAudio();
          hls.audioTrack = i;
          toast("Audio: " + (t.lang || t.name || i));
        }, hls.audioTrack === i && !dualAudioEl);
      });
    }
    add("Switch language source…", () => openLanguageSources(false), false);
    if (lsGet(LS_DUAL_AUDIO, "0") === "1") {
      add("Dual audio from other source…", () => openLanguageSources(true), !!dualAudioEl);
    }
  }

  async function openLanguageSources(dual) {
    const ctx = vodPickerCtx;
    if (!ctx || !ctx.tmdbId) {
      toast("No title context");
      return;
    }
    const menu = document.getElementById("pcAudioMenu");
    if (menu) {
      menu.innerHTML = '<div class="pc-menu-head">Languages</div><button type="button" disabled>Loading…</button>';
      menu.classList.add("open");
    }
    const langs = ["en", "es", "fr", "de", "pt", "it", "ja", "ko", "hi"];
    if (menu) menu.innerHTML = '<div class="pc-menu-head">' + (dual ? "Dual audio lang" : "Language source") + "</div>";
    for (const lang of langs) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = lang.toUpperCase();
      b.addEventListener("click", async (e) => {
        e.stopPropagation();
        menu.classList.remove("open");
        await switchLanguage(lang, dual);
      });
      if (menu) menu.appendChild(b);
    }
  }

  async function switchLanguage(lang, dual) {
    const ctx = vodPickerCtx;
    if (!ctx || !ctx.tmdbId) return;
    toast((dual ? "Dual audio" : "Switching") + " · " + lang.toUpperCase());
    let url =
      "/vod/resolve?tmdb_id=" +
      encodeURIComponent(ctx.tmdbId) +
      "&type=" +
      encodeURIComponent(ctx.mediaType || "movie") +
      "&lang=" +
      encodeURIComponent(lang);
    if (ctx.season) url += "&season=" + encodeURIComponent(ctx.season);
    if (ctx.episode) url += "&episode=" + encodeURIComponent(ctx.episode);
    try {
      const r = await authFetch(url, { cache: "no-store" });
      const data = await r.json();
      if (!data.ok || !data.stream_url) {
        toast("No " + lang + " source");
        return;
      }
      if (dual) {
        await startDualAudio(data);
        return;
      }
      if (typeof playDirectVodFromResolve === "function") {
        await playDirectVodFromResolve(data, "vod_picker", ctx);
      } else if (data.method === "mp4" && typeof playVodFileInPlayer === "function") {
        await playVodFileInPlayer(data.stream_url, "vod_picker", ctx);
      } else if (typeof playVodHlsInPlayer === "function") {
        await playVodHlsInPlayer(data.stream_url, "vod_picker", ctx);
      }
    } catch (e) {
      toast("Language switch failed");
    }
  }

  async function startDualAudio(data) {
    stopDualAudio();
    if (!data || !data.stream_url) return;
    dualAudioEl = document.createElement("audio");
    dualAudioEl.id = "pcDualAudio";
    dualAudioEl.preload = "auto";
    dualAudioEl.crossOrigin = "anonymous";
    const src = data.stream_url.startsWith("http") ? data.stream_url : location.origin + data.stream_url;
    if (data.method === "mp4" || (data.stream_url || "").includes("/vod/file/")) {
      dualAudioEl.src = src;
    } else {
      toast("Dual audio works best with MP4 sources");
      dualAudioEl.src = src;
    }
    document.body.appendChild(dualAudioEl);
    try {
      v.muted = true;
      dualAudioEl.currentTime = v.currentTime || 0;
      await dualAudioEl.play();
    } catch (e) {
      toast("Dual audio blocked — try tap play");
    }
    dualAudioTimer = setInterval(() => {
      if (!dualAudioEl || !vodHlsActive) return;
      const drift = Math.abs((dualAudioEl.currentTime || 0) - (v.currentTime || 0));
      if (drift > 0.35) {
        try {
          dualAudioEl.currentTime = v.currentTime;
        } catch (e) {}
      }
      if (v.paused && !dualAudioEl.paused) dualAudioEl.pause();
      if (!v.paused && dualAudioEl.paused) dualAudioEl.play().catch(() => {});
    }, 800);
    toast("Dual-source audio on");
  }

  function stopDualAudio() {
    if (dualAudioTimer) clearInterval(dualAudioTimer);
    dualAudioTimer = null;
    if (dualAudioEl) {
      try {
        dualAudioEl.pause();
        dualAudioEl.remove();
      } catch (e) {}
      dualAudioEl = null;
    }
    try {
      if (vodHlsActive) v.muted = false;
    } catch (e) {}
  }

  async function renderSourceMenu() {
    const menu = document.getElementById("pcSourceMenu");
    const ctx = vodPickerCtx;
    if (!menu || !ctx || !ctx.tmdbId) return;
    menu.innerHTML = '<div class="pc-menu-head">Sources</div><button type="button" disabled>Loading…</button>';
    menu.classList.add("open");
    let url =
      "/vod/resolve?tmdb_id=" +
      encodeURIComponent(ctx.tmdbId) +
      "&type=" +
      encodeURIComponent(ctx.mediaType || "movie") +
      "&lang=" +
      encodeURIComponent(typeof vodPreferLang === "function" ? vodPreferLang() : "en") +
      "&all_sources=1";
    if (ctx.season) url += "&season=" + encodeURIComponent(ctx.season);
    if (ctx.episode) url += "&episode=" + encodeURIComponent(ctx.episode);
    let sources = [];
    try {
      const r = await authFetch(url, { cache: "no-store" });
      const data = await r.json();
      sources = data.sources || [];
    } catch (e) {}
    menu.innerHTML = '<div class="pc-menu-head">Direct streams</div>';
    if (!sources.length) {
      const empty = document.createElement("button");
      empty.type = "button";
      empty.disabled = true;
      empty.textContent = "No direct sources";
      menu.appendChild(empty);
    }
    sources.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent =
        (s.provider_name || s.provider || "Source") +
        (s.quality ? " · " + s.quality : "") +
        (s.method === "mp4" ? " · MP4" : " · HLS");
      b.addEventListener("click", async (e) => {
        e.stopPropagation();
        menu.classList.remove("open");
        const keep = v.currentTime || 0;
        if (typeof playDirectVodFromResolve === "function") {
          await playDirectVodFromResolve(s, "vod_picker", ctx);
        }
        const seekAfter = () => {
          try {
            if (v.duration && keep > 2 && keep < v.duration - 2) v.currentTime = keep;
          } catch (err) {}
          v.removeEventListener("loadedmetadata", seekAfter);
        };
        v.addEventListener("loadedmetadata", seekAfter);
        toast("Source switched");
      });
      menu.appendChild(b);
    });
    try {
      let srcUrl =
        "/vod/sources?tmdb_id=" +
        encodeURIComponent(ctx.tmdbId) +
        "&type=" +
        encodeURIComponent(ctx.mediaType || "movie") +
        "&lang=" +
        encodeURIComponent(typeof vodPreferLang === "function" ? vodPreferLang() : "en");
      if (ctx.season) srcUrl += "&season=" + encodeURIComponent(ctx.season);
      if (ctx.episode) srcUrl += "&episode=" + encodeURIComponent(ctx.episode);
      const sr = await authFetch(srcUrl, { cache: "no-store" });
      const payload = await sr.json();
      const embeds = (payload.sources || []).filter((x) => x.embed_url && !x.auto);
      if (embeds.length) {
        const head = document.createElement("div");
        head.className = "pc-menu-head";
        head.textContent = "Embeds";
        menu.appendChild(head);
        embeds.slice(0, 12).forEach((s) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = (s.name || s.id) + (s.risk === "risky" ? " · risky" : "");
          b.addEventListener("click", (e) => {
            e.stopPropagation();
            menu.classList.remove("open");
            if (typeof playEmbedInPlayer === "function") playEmbedInPlayer(s.embed_url, "vod_picker", ctx);
          });
          menu.appendChild(b);
        });
      }
    } catch (e2) {}
  }

  function currentSessionId() {
    const u = String(currentStreamUrl || v.currentSrc || "");
    const m = u.match(/\/vod\/(?:file|hls)\/([^/.]+)/);
    return m ? m[1] : "";
  }

  function downloadList() {
    try {
      return JSON.parse(lsGet("sd_downloads", "[]")) || [];
    } catch (e) {
      return [];
    }
  }
  function saveDownloadMeta(entry) {
    const list = downloadList().filter((x) => x.id !== entry.id);
    list.unshift(entry);
    lsSet("sd_downloads", JSON.stringify(list.slice(0, 40)));
  }
  function renderDownloadList() {
    const box = document.getElementById("pcDlList");
    if (!box) return;
    const list = downloadList();
    if (!list.length) {
      box.textContent = "No downloads yet.";
      return;
    }
    box.innerHTML = list
      .map((x) => "<div style='margin:6px 0'>" + (x.title || x.id) + " · " + (x.when || "") + "</div>")
      .join("");
  }

  async function startDownload() {
    const sid = currentSessionId();
    const ctx = vodPickerCtx || {};
    if (!sid) {
      toast("Download needs an active direct stream");
      return;
    }
    if (!(currentStreamUrl || "").includes("/vod/file/") && !(v.currentSrc || "").includes("/vod/file/")) {
      toast("Offline download supports MP4 streams first");
      return;
    }
    toast("Preparing download…");
    const href = "/vod/download/" + encodeURIComponent(sid);
    try {
      const a = document.createElement("a");
      a.href = href;
      a.download = (ctx.title || "movie").replace(/[^\w\s.-]+/g, "") + ".mp4";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      saveDownloadMeta({
        id: sid,
        title: ctx.title || "Title",
        tmdb: ctx.tmdbId,
        when: new Date().toLocaleString(),
      });
      toast("Download started");
    } catch (e) {
      toast("Download failed");
    }
  }

  async function openInPlayerXray() {
    const ctx = vodPickerCtx;
    const sheet = document.getElementById("pcXraySheet");
    const body = document.getElementById("pcXrayBody");
    if (!sheet || !body) return;
    if (lsGet(LS_XRAY_PAUSE, "0") === "1") {
      try {
        v.pause();
      } catch (e) {}
    }
    body.innerHTML = "<p style='opacity:.7'>Loading…</p>";
    sheet.classList.add("open");
    sheet.setAttribute("aria-hidden", "false");
    if (!ctx || !ctx.tmdbId) {
      body.innerHTML = "<p>No title metadata.</p>";
      return;
    }
    try {
      let url =
        "/vod/catalog/" +
        ((ctx.mediaType || "movie") === "tv" || ctx.season ? "tv" : "movie") +
        "/" +
        encodeURIComponent(ctx.tmdbId);
      const r = await authFetch(url, { cache: "no-store" });
      const data = await r.json();
      const m = data.item || data.detail || data.meta || data || {};
      const title = m.title || m.name || ctx.title || "Title";
      const overview = m.overview || m.plot || "";
      const castRaw = m.cast || (m.credits && m.credits.cast) || [];
      const cast = (Array.isArray(castRaw) ? castRaw : []).slice(0, 8);
      let html = "<h2 style='font-family:var(--player-display);font-weight:400;margin:8px 0 6px'>" + escapeHtml(title) + "</h2>";
      if (m.year || m.release_date) html += "<div style='opacity:.65;font-size:12px;margin-bottom:10px'>" + escapeHtml(String(m.year || (m.release_date || "").slice(0, 4))) + "</div>";
      if (overview) html += "<p style='font-size:13px;line-height:1.45;opacity:.9'>" + escapeHtml(overview) + "</p>";
      if (cast.length) {
        html += "<h4 style='margin:16px 0 8px;font-size:11px;letter-spacing:.08em;opacity:.55'>CAST</h4>";
        cast.forEach((c) => {
          const name = typeof c === "string" ? c : c.name || c.actor || "";
          if (name) html += "<div style='font-size:13px;margin:4px 0'>" + escapeHtml(name) + "</div>";
        });
      }
      html +=
        '<div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">' +
        '<button type="button" id="pcXrayVod" style="border:0;border-radius:10px;padding:10px 12px;background:rgba(16,185,129,.28);color:#a7f3d0;cursor:pointer;font-weight:600">▶ VOD</button>' +
        '<button type="button" id="pcXraySources" style="border:0;border-radius:10px;padding:10px 12px;background:#1a1f2a;color:#fff;cursor:pointer">Sources</button>' +
        '<button type="button" id="pcXrayAudio" style="border:0;border-radius:10px;padding:10px 12px;background:#1a1f2a;color:#fff;cursor:pointer">Audio / Lang</button>' +
        "</div>";
      body.innerHTML = html;
      const vodBtn = document.getElementById("pcXrayVod");
      if (vodBtn)
        vodBtn.addEventListener("click", () => {
          closeXraySheet();
          const mt = ((ctx.mediaType || "movie") === "tv" || ctx.season) ? "tv" : "movie";
          location.assign("/vod/" + mt + "/" + encodeURIComponent(ctx.tmdbId));
        });
      const srcBtn = document.getElementById("pcXraySources");
      if (srcBtn)
        srcBtn.addEventListener("click", () => {
          sheet.classList.remove("open");
          renderSourceMenu();
        });
      const auBtn = document.getElementById("pcXrayAudio");
      if (auBtn)
        auBtn.addEventListener("click", () => {
          sheet.classList.remove("open");
          renderAudioMenu();
          const menu = document.getElementById("pcAudioMenu");
          if (menu) menu.classList.add("open");
        });
    } catch (e) {
      body.innerHTML =
        "<h2 style='font-family:var(--player-display)'>" +
        escapeHtml(ctx.title || "Title") +
        "</h2><p style='opacity:.7'>Details unavailable.</p>";
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function closeXraySheet() {
    const sheet = document.getElementById("pcXraySheet");
    if (sheet) {
      sheet.classList.remove("open");
      sheet.setAttribute("aria-hidden", "true");
    }
  }

  function wireGestures() {
    if (!trailerLayer || trailerLayer.dataset.pcGestures === "1") return;
    trailerLayer.dataset.pcGestures = "1";
    const PARTY_IGNORE =
      ".party-drawer, .party-fab, .party-toast, .party-jitsi-stage, .party-av-overlay, #partyAvOverlay, #partyFab, .party-live-overlay, .sd-modal, .sd-modal-backdrop";
    function ignoreParty(t) {
      return !!(t && t.closest && t.closest(PARTY_IGNORE));
    }
    function seekable() {
      try {
        return !!(vodHlsActive && v && isFinite(v.duration) && v.duration > 0 && v.seekable && v.seekable.length);
      } catch (e) {
        return false;
      }
    }
    trailerLayer.addEventListener(
      "touchstart",
      (e) => {
        if (!vodHlsActive || controlsLocked || e.touches.length !== 1) return;
        if (ignoreParty(e.target)) return;
        const t = e.touches[0];
        const rect = trailerLayer.getBoundingClientRect();
        gestureState = {
          x0: t.clientX,
          y0: t.clientY,
          vol0: v.volume,
          t0: v.currentTime,
          mode: null,
          side: t.clientX < rect.left + rect.width / 2 ? "left" : "right",
        };
      },
      { passive: true }
    );
    trailerLayer.addEventListener(
      "touchmove",
      (e) => {
        if (!gestureState || !vodHlsActive || controlsLocked) return;
        if (ignoreParty(e.target)) return;
        const t = e.touches[0];
        const dx = t.clientX - gestureState.x0;
        const dy = t.clientY - gestureState.y0;
        if (!gestureState.mode) {
          if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy)) {
            if (!seekable()) return;
            gestureState.mode = "seek";
          } else if (Math.abs(dy) > 18) gestureState.mode = gestureState.side === "left" ? "bright" : "vol";
        }
        if (gestureState.mode === "seek") {
          const dur = v.duration || 0;
          if (!dur) return;
          const delta = (dx / trailerLayer.clientWidth) * Math.min(120, dur * 0.2);
          const next = Math.max(0, Math.min(dur, gestureState.t0 + delta));
          gestureHud((delta >= 0 ? "+" : "") + Math.round(delta) + "s", (next / dur) * 100);
          try {
            v.currentTime = next;
          } catch (err) {}
        } else if (gestureState.mode === "vol") {
          const next = Math.max(0, Math.min(1, gestureState.vol0 - dy / 220));
          v.volume = next;
          v.muted = next <= 0.01;
          syncMuteUi();
          gestureHud("Volume " + Math.round(next * 100) + "%", next * 100);
        } else if (gestureState.mode === "bright") {
          const cur = Number(getComputedStyle(document.documentElement).getPropertyValue("--pc-bright") || 1);
          const next = Math.max(0.4, Math.min(1.2, (gestureState.bright0 != null ? gestureState.bright0 : cur) - dy / 260));
          if (gestureState.bright0 == null) gestureState.bright0 = cur;
          document.documentElement.style.setProperty("--pc-bright", String(next));
          if (videoArea) videoArea.style.filter = "brightness(" + next + ")";
          gestureHud("Brightness " + Math.round(next * 100) + "%", ((next - 0.4) / 0.8) * 100);
        }
      },
      { passive: true }
    );
    trailerLayer.addEventListener("touchend", () => {
      gestureState = null;
    });
    // double-tap L/R = ±10s when VOD/seekable
    let lastTap = 0;
    trailerLayer.addEventListener("click", (e) => {
      if (!vodHlsActive || controlsLocked) return;
      if (ignoreParty(e.target)) return;
      if (e.target.closest("button, input, .hls-menu, .pc-settings, .pc-xray-sheet, .party-drawer, .party-fab, .party-jitsi-stage, .party-av-overlay, #partyAvOverlay, #partyFab")) return;
      if (!seekable()) return;
      const now = Date.now();
      if (now - lastTap < 280) {
        const rect = trailerLayer.getBoundingClientRect();
        let rightEdge = rect.right;
        const va = document.getElementById("videoArea");
        const hulu =
          trailerLayer.classList.contains("party-layout-hulu") ||
          (va && va.classList.contains("party-layout-hulu"));
        const rave =
          trailerLayer.classList.contains("party-layout-rave") ||
          (va && va.classList.contains("party-layout-rave"));
        if (hulu) {
          const drawer = document.getElementById("partyDrawer");
          if (drawer && drawer.classList.contains("open")) rightEdge = Math.min(rightEdge, drawer.getBoundingClientRect().left);
        }
        if (e.clientX >= rightEdge) return;
        if (rave) {
          if ((e.clientY - rect.top) / Math.max(1, rect.height) > 0.55) return;
        }
        if (e.clientX < rect.left + (rightEdge - rect.left) / 2) {
          try {
            v.currentTime = Math.max(0, v.currentTime - 10);
          } catch (err) {}
          const fl = document.getElementById("pcSeekLeft");
          if (fl) {
            fl.classList.add("show");
            setTimeout(() => fl.classList.remove("show"), 700);
          }
        } else {
          try {
            v.currentTime = Math.min(v.duration || 1e9, v.currentTime + 10);
          } catch (err) {}
          const fr = document.getElementById("pcSeekRight");
          if (fr) {
            fr.classList.add("show");
            setTimeout(() => fr.classList.remove("show"), 700);
          }
        }
        lastTap = 0;
      } else lastTap = now;
    });
  }

  function syncMuteUi() {
    const btn = document.getElementById("pcMuteBtn");
    const vol = document.getElementById("pcVol");
    if (vol) vol.value = String(v.muted ? 0 : v.volume);
    if (btn) {
      btn.innerHTML =
        v.muted || v.volume < 0.01
          ? '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.8-1-3.3-2.5-4v2.2l2.5 2.5V12zm2.5 0c0 .9-.2 1.8-.5 2.6l1.5 1.5c.6-1.3 1-2.7 1-4.1 0-3.5-2-6.5-5-8v2.1c2 .9 3.4 2.9 3.4 5.9zM4.3 3L3 4.3 7.7 9H3v4h4l5 5v-6.7l4.7 4.7c-.7.5-1.4.9-2.2 1.2v2.1c1.2-.3 2.3-.9 3.2-1.7L19.7 21 21 19.7 4.3 3zM12 4L9.9 6.1 12 8.2V4z" fill="currentColor"/></svg>'
          : '<svg viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.8-1-3.3-2.5-4v8c1.5-.7 2.5-2.2 2.5-4z" fill="currentColor"/></svg>';
    }
  }

  function onChromeReady() {
    applyPlayerTheme(lsGet(LS_PLAYER_THEME, "cinema"));
    applySpeed(Number(lsGet(LS_SPEED, "1")) || 1);
    applyZoom(lsGet(LS_ZOOM, "contain"));
    wireGestures();
    const settingsBtn = document.getElementById("pcSettingsBtn");
    if (settingsBtn && !settingsBtn.dataset.wired) {
      settingsBtn.dataset.wired = "1";
      settingsBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openSettings();
      });
    }
    const xrayBtn = document.getElementById("pcXrayBtn");
    if (xrayBtn && !xrayBtn.dataset.wired) {
      xrayBtn.dataset.wired = "1";
      xrayBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openInPlayerXray();
      });
    }
    const xrayClose = document.getElementById("pcXrayClose");
    if (xrayClose && !xrayClose.dataset.wired) {
      xrayClose.dataset.wired = "1";
      xrayClose.addEventListener("click", closeXraySheet);
    }
    const dlBtn = document.getElementById("pcDownloadBtn");
    if (dlBtn && !dlBtn.dataset.wired) {
      dlBtn.dataset.wired = "1";
      dlBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        startDownload();
      });
    }
    const speedBtn = document.getElementById("pcSpeedBtn");
    if (speedBtn && !speedBtn.dataset.wired) {
      speedBtn.dataset.wired = "1";
      speedBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        renderSpeedMenu();
        const menu = document.getElementById("pcSpeedMenu");
        document.querySelectorAll(".hls-menu").forEach((m) => m.classList.remove("open"));
        if (menu) menu.classList.add("open");
      });
    }
    const audioBtn = document.getElementById("pcAudioBtn");
    if (audioBtn && !audioBtn.dataset.wired) {
      audioBtn.dataset.wired = "1";
      audioBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        renderAudioMenu();
        const menu = document.getElementById("pcAudioMenu");
        document.querySelectorAll(".hls-menu").forEach((m) => m.classList.remove("open"));
        if (menu) menu.classList.add("open");
      });
    }
    const sourceBtn = document.getElementById("pcSourceBtn");
    if (sourceBtn && !sourceBtn.dataset.wired) {
      sourceBtn.dataset.wired = "1";
      sourceBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".hls-menu").forEach((m) => m.classList.remove("open"));
        renderSourceMenu();
      });
    }
    const fsBtn = document.getElementById("pcFsBtn");
    if (fsBtn && !fsBtn.dataset.wired) {
      fsBtn.dataset.wired = "1";
      fsBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFullscreen();
      });
    }
    const lockBtn = document.getElementById("pcLockBtn");
    if (lockBtn && !lockBtn.dataset.wired) {
      lockBtn.dataset.wired = "1";
      lockBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setLocked(true);
      });
    }
    const lockFab = document.getElementById("pcLockFab");
    if (lockFab && !lockFab.dataset.wired) {
      lockFab.dataset.wired = "1";
      lockFab.addEventListener("click", (e) => {
        e.stopPropagation();
        setLocked(false);
      });
    }
    const zoomBtn = document.getElementById("pcZoomBtn");
    if (zoomBtn && !zoomBtn.dataset.wired) {
      zoomBtn.dataset.wired = "1";
      zoomBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        cycleZoom();
      });
    }
    const muteBtn = document.getElementById("pcMuteBtn");
    if (muteBtn && !muteBtn.dataset.wired) {
      muteBtn.dataset.wired = "1";
      muteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        v.muted = !v.muted;
        syncMuteUi();
      });
    }
    const vol = document.getElementById("pcVol");
    if (vol && !vol.dataset.wired) {
      vol.dataset.wired = "1";
      vol.value = String(v.volume);
      vol.addEventListener("input", () => {
        v.volume = Number(vol.value);
        v.muted = v.volume <= 0.01;
        syncMuteUi();
      });
    }
    syncMuteUi();
  }

  document.addEventListener("keydown", (e) => {
    if (!vodHlsActive) return;
    const tag = (e.target && e.target.tagName) || "";
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      if (v.paused) v.play().catch(() => {});
      else v.pause();
    } else if (e.key === "ArrowLeft") {
      try {
        v.currentTime = Math.max(0, v.currentTime - 10);
      } catch (err) {}
    } else if (e.key === "ArrowRight") {
      try {
        v.currentTime = Math.min(v.duration || 1e9, v.currentTime + 10);
      } catch (err) {}
    } else if (e.key === "ArrowUp") {
      v.volume = Math.min(1, v.volume + 0.05);
      v.muted = false;
      syncMuteUi();
    } else if (e.key === "ArrowDown") {
      v.volume = Math.max(0, v.volume - 0.05);
      syncMuteUi();
    } else if (e.key === "m" || e.key === "M") {
      v.muted = !v.muted;
      syncMuteUi();
    } else if (e.key === "f" || e.key === "F") {
      toggleFullscreen();
    } else if (e.key === "Escape") {
      closeSettings();
      closeXraySheet();
    }
  });

  window.SDCinema = {
    onChromeReady,
    openSettings,
    applyPlayerTheme,
    stopDualAudio,
  };

  applyPlayerTheme(lsGet(LS_PLAYER_THEME, "cinema"));
  if (document.getElementById("hlsChrome")) onChromeReady();
})();
