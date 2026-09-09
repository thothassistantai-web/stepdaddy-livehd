/* player_features: continue watching, subtitles, hls controls, prefetch, last-good */
(function sdFeaturesBoot() {
  const LS_LAST_GOOD = "sd_vod_last_good";
  const LS_SUB_LANG = "sd_sub_lang";
  const LS_SUB_SIZE = "sd_sub_size";
  const LS_SUB_COLOR = "sd_sub_color";
  const LS_SUB_POS = "sd_sub_pos";
  const LS_PIP = "sd_pip_default";
  const LS_AUTO_PIP_BG = "sd_auto_pip_bg";
  const LS_PREFETCH = "sd_resolve_prefetch";
  const LS_PARTY_NAME = "sd_party_name";

  let progressTimer = null;
  let lastProgressSent = 0;
  let resumeSeek = null;
  let hlsChromeHideTimer = null;
  let hlsHoldActive = false;
  let hlsScrubbing = false;
  let subTracks = [];
  let activeSubUrl = null;
  let subCues = [];
  let subRaf = null;

  const PARTY_IGNORE_SEL =
    ".party-drawer, .party-fab, .party-toast, .party-jitsi-stage, .party-av-overlay, #partyAvOverlay, #partyFab, .party-live-overlay, .party-live-badge, .sd-modal, .sd-modal-backdrop, .pc-settings, .pc-settings-backdrop";

  function partyChromeIgnore(target) {
    return !!(target && target.closest && target.closest(PARTY_IGNORE_SEL));
  }

  function chromeOverlayBlockingHide() {
    if (hlsHoldActive || hlsScrubbing) return true;
    if (document.getElementById("pcSettings")?.classList.contains("open")) return true;
    if (document.getElementById("pcXraySheet")?.classList.contains("open")) return true;
    if (document.getElementById("partyDrawer")?.classList.contains("open")) return true;
    if (document.getElementById("sdPartyModal")?.classList.contains("open")) return true;
    return false;
  }

  /**
   * Multifunction hold-done: press → hold threshold → release/done.
   * Short press still fires click; hold runs tickFn on interval; cancel on leave/cancel.
   */
  function bindHoldDone(el, opts) {
    if (!el || el.dataset.holdBound === "1") return;
    el.dataset.holdBound = "1";
    opts = opts || {};
    const threshold = opts.threshold != null ? opts.threshold : 380;
    const interval = opts.interval != null ? opts.interval : 160;
    const tickFn = opts.onHoldTick || opts.onHold;
    const onStart = opts.onHoldStart;
    const onEnd = opts.onHoldEnd;
    let holdTimer = null;
    let tickTimer = null;
    let holding = false;
    let suppressClick = false;
    let ptrId = null;

    function clearAll() {
      clearTimeout(holdTimer);
      clearInterval(tickTimer);
      holdTimer = null;
      tickTimer = null;
      if (holding) {
        holding = false;
        suppressClick = true;
        hlsHoldActive = false;
        el.classList.remove("pc-hold-active");
        const bar = document.getElementById("hlsChrome");
        if (bar) bar.classList.remove("pc-hold-busy");
        if (onEnd) onEnd();
        showHlsChrome(false);
      }
      ptrId = null;
    }

    function beginHold() {
      holding = true;
      hlsHoldActive = true;
      el.classList.add("pc-hold-active");
      const bar = document.getElementById("hlsChrome");
      if (bar) bar.classList.add("pc-hold-busy");
      showHlsChrome(true);
      if (onStart) onStart();
      if (tickFn) {
        tickFn();
        tickTimer = setInterval(tickFn, interval);
      }
    }

    el.addEventListener("pointerdown", (e) => {
      if (e.button != null && e.button !== 0) return;
      ptrId = e.pointerId;
      suppressClick = false;
      clearTimeout(holdTimer);
      holdTimer = setTimeout(beginHold, threshold);
      try {
        el.setPointerCapture(e.pointerId);
      } catch (err) {}
    });
    el.addEventListener("pointerup", (e) => {
      if (ptrId != null && e.pointerId !== ptrId) return;
      clearAll();
    });
    el.addEventListener("pointercancel", clearAll);
    el.addEventListener("lostpointercapture", clearAll);
    el.addEventListener(
      "click",
      (e) => {
        if (suppressClick) {
          suppressClick = false;
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true
    );
  }

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
  function lastGoodMap() {
    try {
      return JSON.parse(lsGet(LS_LAST_GOOD, "{}")) || {};
    } catch (e) {
      return {};
    }
  }
  function lastGoodKey(ctx) {
    if (!ctx || !ctx.tmdbId) return "";
    return [ctx.tmdbId, ctx.mediaType || "movie", ctx.season || "", ctx.episode || ""].join(":");
  }
  function getLastGood(ctx) {
    const k = lastGoodKey(ctx);
    return k ? lastGoodMap()[k] || "" : "";
  }
  function setLastGood(ctx, provider) {
    if (!provider || !ctx) return;
    const m = lastGoodMap();
    m[lastGoodKey(ctx)] = String(provider);
    lsSet(LS_LAST_GOOD, JSON.stringify(m));
  }
  function prefetchEnabled() {
    return lsGet(LS_PREFETCH, "1") !== "0";
  }
  function fmtClock(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h) return h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    return m + ":" + String(s).padStart(2, "0");
  }

  function _pcIcon(name) {
    const icons = {
      play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
      pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
      back10: '<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z"/></svg>',
      fwd10: '<svg viewBox="0 0 24 24"><path d="M12 5V1l5 5-5 5V7c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6h2c0 4.4-3.6 8-8 8s-8-3.6-8-8 3.6-8 8-8z"/></svg>',
      vol: '<svg viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.8-1-3.3-2.5-4v8c1.5-.7 2.5-2.2 2.5-4z"/></svg>',
      mute: '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.8-1-3.3-2.5-4v2.2l2.5 2.5V12zm2.5 0c0 .9-.2 1.8-.5 2.6l1.5 1.5c.6-1.3 1-2.7 1-4.1 0-3.5-2-6.5-5-8v2.1c2 .9 3.4 2.9 3.4 5.9zM4.3 3L3 4.3 7.7 9H3v4h4l5 5v-6.7l4.7 4.7c-.7.5-1.4.9-2.2 1.2v2.1c1.2-.3 2.3-.9 3.2-1.7L19.7 21 21 19.7 4.3 3zM12 4L9.9 6.1 12 8.2V4z"/></svg>',
      cc: '<svg viewBox="0 0 24 24"><path d="M19 4H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z"/></svg>',
      gear: '<svg viewBox="0 0 24 24"><path d="M19.1 12.9c0-.3 0-.6.1-.9s0-.6-.1-.9l2-1.6c.2-.1.2-.4.1-.6l-1.9-3.3c-.1-.2-.4-.3-.6-.2l-2.4 1c-.5-.4-1-.7-1.6-.9l-.4-2.5c0-.2-.2-.4-.5-.4h-3.8c-.2 0-.5.2-.5.4l-.4 2.5c-.6.2-1.1.5-1.6.9l-2.4-1c-.2-.1-.5 0-.6.2L2.7 8.9c-.1.2-.1.5.1.6l2 1.6c0 .3-.1.6-.1.9s0 .6.1.9l-2 1.6c-.2.1-.2.4-.1.6l1.9 3.3c.1.2.4.3.6.2l2.4-1c.5.4 1 .7 1.6.9l.4 2.5c0 .2.2.4.5.4h3.8c.2 0 .5-.2.5-.4l.4-2.5c.6-.2 1.1-.5 1.6-.9l2.4 1c.2.1.5 0 .6-.2l1.9-3.3c.1-.2.1-.5-.1-.6l-2-1.6zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>',
      fs: '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
      pip: '<svg viewBox="0 0 24 24"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.98 2 1.98h18c1.1 0 2-.88 2-1.98V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z"/></svg>',
      xray: '<svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
      dl: '<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>',
      source: '<svg viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z"/></svg>',
      audio: '<svg viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>',
      lock: '<svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.8-2.2-5-5-5S7 3.2 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.7 1.3-3 3-3s3 1.3 3 3v2H9V6zm3 11c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>',
      more: '<svg viewBox="0 0 24 24"><path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>',
      cast: '<svg viewBox="0 0 24 24"><path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zM21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>',
    };
    return icons[name] || "";
  }

  function ensureHlsChromeDom() {
    if (!trailerLayer) return null;
    let bar = document.getElementById("hlsChrome");
    if (bar && bar.dataset.cinema === "1") return bar;
    if (bar) bar.remove();
    if (!document.getElementById("hlsHotzone")) {
      const hot = document.createElement("div");
      hot.className = "hls-hotzone";
      hot.id = "hlsHotzone";
      trailerLayer.appendChild(hot);
    }
    if (!document.getElementById("sdSubOverlay")) {
      const sub = document.createElement("div");
      sub.className = "sd-sub-overlay";
      sub.id = "sdSubOverlay";
      sub.hidden = true;
      trailerLayer.appendChild(sub);
    }
    bar = document.createElement("div");
    bar.className = "hls-chrome";
    bar.id = "hlsChrome";
    bar.dataset.cinema = "1";
    bar.innerHTML =
      '<div class="pc-top">' +
      '<div class="pc-title-block">' +
      '<div class="pc-eyebrow" id="pcEyebrow">Now playing</div>' +
      '<div class="pc-title" id="pcTitle">Title</div>' +
      '<div class="pc-sub" id="pcSub"></div>' +
      "</div>" +
      '<div class="pc-top-actions">' +
      '<button type="button" class="pc-btn" id="pcXrayBtn" title="X-ray">' +
      _pcIcon("xray") +
      "</button>" +
      '<button type="button" class="pc-btn" id="pcDownloadBtn" title="Download">' +
      _pcIcon("dl") +
      "</button>" +
      '<button type="button" class="pc-btn" id="pcSettingsBtn" title="Player settings">' +
      _pcIcon("gear") +
      "</button>" +
      "</div></div>" +
      '<div class="pc-center">' +
      '<span class="pc-seek-flash left" id="pcSeekLeft">−10s</span>' +
      '<button type="button" class="pc-center-hit" id="hlsPlayBtn" title="Play/Pause">' +
      _pcIcon("play") +
      "</button>" +
      '<span class="pc-seek-flash right" id="pcSeekRight">+10s</span>' +
      "</div>" +
      '<div class="pc-bottom">' +
      '<div class="pc-scrub-wrap">' +
      '<div class="pc-buf" id="pcBuf"><i id="pcBufFill"></i></div>' +
      '<input type="range" class="hls-scrub" id="hlsScrub" min="0" max="1000" value="0" step="1"/>' +
      "</div>" +
      '<div class="pc-meta-row"><span class="hls-time" id="hlsTime">0:00 / 0:00</span></div>' +
      '<div class="pc-controls">' +
      '<button type="button" class="pc-btn" id="hlsBack10" title="-10s">' +
      _pcIcon("back10") +
      "</button>" +
      '<button type="button" class="pc-btn" id="hlsFwd10" title="+10s">' +
      _pcIcon("fwd10") +
      "</button>" +
      '<div class="pc-vol">' +
      '<button type="button" class="pc-btn" id="pcMuteBtn" title="Mute">' +
      _pcIcon("vol") +
      "</button>" +
      '<input type="range" id="pcVol" min="0" max="1" step="0.01" value="1"/>' +
      "</div>" +
      '<div class="hls-menus"><button type="button" class="pc-btn" id="hlsCcBtn" title="Subtitles">' +
      _pcIcon("cc") +
      '</button><div class="hls-menu" id="hlsCcMenu"></div></div>' +
      '<div class="hls-menus"><button type="button" class="pc-btn pc-btn-label" id="hlsQualityBtn" title="Quality">Auto</button>' +
      '<div class="hls-menu" id="hlsQualityMenu"></div></div>' +
      '<div class="hls-menus"><button type="button" class="pc-btn pc-btn-label" id="pcSpeedBtn" title="Speed">1x</button>' +
      '<div class="hls-menu" id="pcSpeedMenu"></div></div>' +
      '<div class="hls-menus"><button type="button" class="pc-btn" id="pcAudioBtn" title="Audio">' +
      _pcIcon("audio") +
      '</button><div class="hls-menu" id="pcAudioMenu"></div></div>' +
      '<div class="hls-menus"><button type="button" class="pc-btn" id="pcSourceBtn" title="Sources">' +
      _pcIcon("source") +
      '</button><div class="hls-menu" id="pcSourceMenu"></div></div>' +
      '<button type="button" class="pc-btn" id="hlsPipBtn" title="Picture in Picture">' +
      _pcIcon("pip") +
      "</button>" +
      '<button type="button" class="pc-btn" id="hlsCastBtn" title="Cast / AirPlay">' +
      _pcIcon("cast") +
      "</button>" +
      '<button type="button" class="pc-btn" id="pcFsBtn" title="Fullscreen">' +
      _pcIcon("fs") +
      "</button>" +
      '<button type="button" class="pc-btn" id="pcLockBtn" title="Lock controls">' +
      _pcIcon("lock") +
      "</button>" +
      '<div class="hls-menus"><button type="button" class="pc-btn" id="pcMoreBtn" title="More">' +
      _pcIcon("more") +
      '</button><div class="hls-menu" id="pcMoreMenu">' +
      '<button type="button" id="hlsShareBtn">Share</button>' +
      '<button type="button" id="hlsPartyBtn">Watch party</button>' +
      '<button type="button" id="pcZoomBtn">Fit / Zoom</button>' +
      "</div></div>" +
      "</div></div>" +
      '<div class="pc-gesture-hud" id="pcGestureHud"><div id="pcGestureLabel"></div><div class="bar"><i id="pcGestureBar"></i></div></div>' +
      '<button type="button" class="pc-lock-fab" id="pcLockFab" title="Unlock">' +
      _pcIcon("lock") +
      "</button>" +
      '<div class="pc-toast" id="pcToast"></div>' +
      '<aside class="pc-xray-sheet" id="pcXraySheet" aria-hidden="true">' +
      '<button type="button" class="pc-xray-close" id="pcXrayClose">✕</button>' +
      '<div id="pcXrayBody"></div></aside>';
    trailerLayer.appendChild(bar);
    wireHlsChrome(bar);
    if (window.SDCinema && SDCinema.onChromeReady) SDCinema.onChromeReady(bar);
    return bar;
  }

  function showHlsChrome(pinned) {
    const bar = ensureHlsChromeDom();
    if (!bar || !vodHlsActive) return;
    if (tvRoot && tvRoot.classList.contains("pc-controls-locked")) return;
    updateCinemaTitle();
    updateBuffered();
    bar.classList.add("show");
    bar.classList.remove("idle");
    if (pinned) bar.classList.add("pinned");
    else bar.classList.remove("pinned");
    if (trailerLayer) trailerLayer.classList.add("has-hls-chrome");
    clearTimeout(hlsChromeHideTimer);
    const menuOpen = !!(bar.querySelector(".hls-menu.open"));
    const keep =
      pinned ||
      menuOpen ||
      (v && v.paused) ||
      chromeOverlayBlockingHide();
    if (!keep) {
      hlsChromeHideTimer = setTimeout(hideHlsChrome, 2800);
    }
  }
  function hideHlsChrome(force) {
    const bar = document.getElementById("hlsChrome");
    if (!bar) return;
    if (!force) {
      if (bar.classList.contains("pinned")) return;
      if (bar.querySelector(".hls-menu.open")) return;
      if (v && v.paused) return;
      if (chromeOverlayBlockingHide()) return;
    }
    bar.classList.remove("show", "pinned");
    bar.classList.add("idle");
    if (trailerLayer) trailerLayer.classList.remove("has-hls-chrome");
  }

  function wireHlsChrome(bar) {
    if (bar.dataset.wired === "1") return;
    bar.dataset.wired = "1";
    const scrub = document.getElementById("hlsScrub");
    const playBtn = document.getElementById("hlsPlayBtn");
    function setPlayIcon() {
      if (!playBtn) return;
      playBtn.innerHTML = v.paused ? _pcIcon("play") : _pcIcon("pause");
    }
    function flashSeek(side) {
      const el = document.getElementById(side === "left" ? "pcSeekLeft" : "pcSeekRight");
      if (!el) return;
      el.classList.add("show");
      setTimeout(() => el.classList.remove("show"), 700);
    }
    function seekBy(delta) {
      try {
        const dur = v.duration || 1e9;
        v.currentTime = Math.max(0, Math.min(dur, (v.currentTime || 0) + delta));
      } catch (e) {}
      flashSeek(delta < 0 ? "left" : "right");
      showHlsChrome();
      broadcastClockSoon();
    }
    const back10 = document.getElementById("hlsBack10");
    const fwd10 = document.getElementById("hlsFwd10");
    back10.addEventListener("click", () => seekBy(-10));
    fwd10.addEventListener("click", () => seekBy(10));
    // Hold seek = 2x scrub burst (±2s ticks)
    bindHoldDone(back10, {
      interval: 140,
      onHoldTick: () => seekBy(-2),
    });
    bindHoldDone(fwd10, {
      interval: 140,
      onHoldTick: () => seekBy(2),
    });
    playBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (v.paused) v.play().catch(() => {});
      else v.pause();
      setPlayIcon();
      showHlsChrome();
      broadcastClockSoon();
    });
    function endScrub() {
      hlsScrubbing = false;
      // Always unpin after scrub so chrome cannot stick "pinned forever"
      if (scrub) scrub.classList.remove("pc-scrubbing");
      showHlsChrome(false);
    }
    scrub.addEventListener("pointerdown", () => {
      hlsScrubbing = true;
      scrub.classList.add("pc-scrubbing");
      showHlsChrome(true);
    });
    scrub.addEventListener("input", () => {
      const dur = v.duration || 0;
      if (dur > 0) v.currentTime = (Number(scrub.value) / 1000) * dur;
      hlsScrubbing = true;
      showHlsChrome(true);
    });
    scrub.addEventListener("change", () => {
      endScrub();
      broadcastClockSoon();
      reportProgress("pause");
    });
    scrub.addEventListener("pointerup", endScrub);
    scrub.addEventListener("pointercancel", endScrub);
    scrub.addEventListener("pointerleave", () => {
      if (hlsScrubbing) endScrub();
    });
    const vol = document.getElementById("pcVol");
    const muteBtn = document.getElementById("pcMuteBtn");
    if (vol) {
      bindHoldDone(vol, {
        threshold: 320,
        interval: 90,
        onHoldTick: () => {
          const step = 0.04;
          // hold volume: nudge toward extremes based on thumb position
          const cur = Number(vol.value) || 0;
          const next = cur >= 0.5 ? Math.min(1, cur + step) : Math.max(0, cur - step);
          vol.value = String(next);
          v.volume = next;
          v.muted = next <= 0.01;
          vol.dispatchEvent(new Event("input", { bubbles: true }));
          showHlsChrome(true);
        },
      });
    }
    if (muteBtn) {
      bindHoldDone(muteBtn, {
        threshold: 450,
        interval: 100,
        onHoldStart: () => {
          muteBtn.dataset.holdVol0 = String(v.volume || 1);
        },
        onHoldTick: () => {
          const next = Math.min(1, (v.volume || 0) + 0.05);
          v.volume = next;
          v.muted = false;
          if (vol) vol.value = String(next);
          showHlsChrome(true);
        },
      });
    }
    document.getElementById("hlsCcBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMenu("hlsCcMenu");
      loadSubtitlesForCtx(vodPickerCtx);
      showHlsChrome(true);
    });
    document.getElementById("hlsQualityBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      renderQualityMenu();
      toggleMenu("hlsQualityMenu");
      showHlsChrome(true);
    });
    document.getElementById("hlsPipBtn").addEventListener("click", async () => {
      try {
        if (isInAnyPip(v) || document.pictureInPictureElement) await exitVideoPip(v);
        else await enterVideoPip(v);
      } catch (e) {}
      showHlsChrome();
    });
    const castBtn = document.getElementById("hlsCastBtn");
    if (castBtn)
      castBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        try {
          if (window.SDCast && typeof SDCast.prompt === "function") SDCast.prompt({ source: "hls-chrome" });
          else if (v.remote && v.remote.prompt) v.remote.prompt();
          else if (typeof showErr === "function") showErr("Cast not supported in this browser");
        } catch (err) {
          if (typeof showErr === "function") showErr("Cast unavailable");
        }
      });
    const shareBtn = document.getElementById("hlsShareBtn");
    if (shareBtn)
      shareBtn.addEventListener("click", () => {
        if (window.SDParty && SDParty.openShare) SDParty.openShare();
      });
    const partyBtn = document.getElementById("hlsPartyBtn");
    if (partyBtn)
      partyBtn.addEventListener("click", () => {
        if (window.SDParty && SDParty.openPanel) SDParty.openPanel();
      });
    const moreBtn = document.getElementById("pcMoreBtn");
    if (moreBtn)
      moreBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleMenu("pcMoreMenu");
        showHlsChrome(true);
      });
    if (trailerLayer && trailerLayer.dataset.hlsChromeBound !== "1") {
      trailerLayer.dataset.hlsChromeBound = "1";
      /*
       * Hotzone map (non-conflicting; party layouts clip to video pane via CSS):
       * ┌──────────────────────────────────────────────┐
       * │ TOP (~18%)     back / title — reveal chrome  │
       * │ EDGE L (~12%)  channel− / seek− (live/VOD)   │
       * │ CENTER         tap = toggle chrome           │
       * │ EDGE R (~12%)  channel+ / seek+ / party rail │
       * │ BOTTOM (~28%)  transport / scrub hotzone     │
       * └──────────────────────────────────────────────┘
       * Ignore: .party-drawer, #partyFab, #partyAvOverlay, .party-live-overlay, modals.
       * Marker classes: pc-hotzone-top|bottom|center|edge-l|edge-r, pc-hold-active
       */
      function chromeZoneFromEvent(e) {
        const layer = trailerLayer;
        if (!layer) return "center";
        const rect = layer.getBoundingClientRect();
        const y = (e.clientY != null ? e.clientY : (e.touches && e.touches[0] && e.touches[0].clientY)) || 0;
        const x = (e.clientX != null ? e.clientX : (e.touches && e.touches[0] && e.touches[0].clientX)) || 0;
        const partyOpen =
          layer.classList.contains("party-layout-hulu") ||
          layer.classList.contains("party-layout-rave") ||
          (document.getElementById("videoArea") &&
            (document.getElementById("videoArea").classList.contains("party-layout-hulu") ||
              document.getElementById("videoArea").classList.contains("party-layout-rave")));
        let rightEdge = rect.right;
        let leftEdge = rect.left;
        if (partyOpen) {
          const drawer = document.getElementById("partyDrawer");
          if (drawer && drawer.classList.contains("open")) {
            const dr = drawer.getBoundingClientRect();
            if (dr.left > leftEdge + 40) rightEdge = Math.min(rightEdge, dr.left);
            if (dr.top > leftEdge && layer.classList.contains("party-layout-rave")) {
              /* portrait rave: lower region is party */
            }
          }
        }
        if (partyOpen && x >= rightEdge) return "party";
        const relY = (y - rect.top) / Math.max(1, rect.height);
        const relX = (x - leftEdge) / Math.max(1, rightEdge - leftEdge);
        const va = document.getElementById("videoArea");
        if (
          (layer.classList.contains("party-layout-rave") || (va && va.classList.contains("party-layout-rave"))) &&
          relY > 0.55
        ) {
          return "party";
        }
        if (relY < 0.18) return "top";
        if (relY > 0.72) return "bottom";
        if (relX < 0.12) return "edge-l";
        if (relX > 0.88) return "edge-r";
        return "center";
      }
      trailerLayer.addEventListener("mousemove", (e) => {
        if (!vodHlsActive || (tvRoot && tvRoot.classList.contains("pc-controls-locked"))) return;
        if (partyChromeIgnore(e.target)) return;
        const z = chromeZoneFromEvent(e);
        if (z === "party") return;
        showHlsChrome();
      });
      trailerLayer.addEventListener("mouseleave", () => {
        if (v && v.paused) return;
        if (chromeOverlayBlockingHide()) return;
        hideHlsChrome();
      });
      trailerLayer.addEventListener(
        "touchstart",
        (e) => {
          if (partyChromeIgnore(e.target)) return;
          if (chromeZoneFromEvent(e) === "party") return;
          if (vodHlsActive && !(tvRoot && tvRoot.classList.contains("pc-controls-locked"))) showHlsChrome();
        },
        { passive: true }
      );
      // Center tap toggles chrome; top/bottom/edges reveal (don't steal control clicks)
      let lastCenterTap = 0;
      trailerLayer.addEventListener("click", (e) => {
        if (!vodHlsActive || (tvRoot && tvRoot.classList.contains("pc-controls-locked"))) return;
        if (partyChromeIgnore(e.target)) return;
        if (e.target.closest("button, input, .hls-menu, .hls-chrome, .pc-settings, .pc-xray-sheet")) return;
        const z = chromeZoneFromEvent(e);
        if (z === "party") return;
        if (z === "center") {
          const now = Date.now();
          // Defer to double-tap seek (±10s) — skip toggle on the second tap
          if (now - lastCenterTap < 280) {
            lastCenterTap = 0;
            return;
          }
          lastCenterTap = now;
          const barEl = document.getElementById("hlsChrome");
          if (barEl && barEl.classList.contains("show") && !barEl.classList.contains("pinned")) {
            hideHlsChrome(true);
          } else {
            showHlsChrome(false);
          }
          return;
        }
        showHlsChrome(false);
      });
    }
    v.addEventListener("timeupdate", onHlsTimeUpdate);
    v.addEventListener("progress", updateBuffered);
    v.addEventListener("play", () => {
      setPlayIcon();
      if (vodHlsActive) reportProgress("start");
      broadcastClockSoon();
      showHlsChrome(false);
    });
    v.addEventListener("pause", () => {
      setPlayIcon();
      if (vodHlsActive) reportProgress("pause");
      broadcastClockSoon();
      showHlsChrome(true);
    });
    v.addEventListener("ended", () => {
      if (vodHlsActive) reportProgress("stop");
      showHlsChrome(true);
    });
    document.addEventListener("click", (e) => {
      const openMenus = document.querySelectorAll(".hls-menu.open");
      if (!openMenus.length) return;
      if (e.target && e.target.closest && e.target.closest(".hls-menus, .hls-menu")) return;
      openMenus.forEach((m) => m.classList.remove("open"));
      showHlsChrome(false);
    });
    setPlayIcon();
  }

  function updateBuffered() {
    const fill = document.getElementById("pcBufFill");
    if (!fill || !v.duration) return;
    try {
      let end = 0;
      for (let i = 0; i < v.buffered.length; i++) {
        if (v.buffered.start(i) <= v.currentTime && v.buffered.end(i) > end) end = v.buffered.end(i);
      }
      fill.style.width = Math.min(100, (end / v.duration) * 100) + "%";
    } catch (e) {}
  }

  function updateCinemaTitle() {
    const ctx = vodPickerCtx || {};
    const titleEl = document.getElementById("pcTitle");
    const subEl = document.getElementById("pcSub");
    const eye = document.getElementById("pcEyebrow");
    if (titleEl) titleEl.textContent = ctx.title || "Now playing";
    if (eye) {
      eye.textContent =
        (ctx.mediaType || "movie") === "tv" || ctx.season
          ? "Series"
          : "Movie";
    }
    if (subEl) {
      const bits = [];
      if (ctx.season && ctx.episode) bits.push("S" + ctx.season + " · E" + ctx.episode);
      if (ctx.episodeName) bits.push(ctx.episodeName);
      subEl.textContent = bits.join(" — ");
    }
    try {
      syncMediaSession();
    } catch (e) {}
  }

  function toggleMenu(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const open = !el.classList.contains("open");
    document.querySelectorAll(".hls-menu").forEach((m) => m.classList.remove("open"));
    if (open) el.classList.add("open");
  }

  function onHlsTimeUpdate() {
    if (!vodHlsActive) return;
    const scrub = document.getElementById("hlsScrub");
    const timeEl = document.getElementById("hlsTime");
    const dur = v.duration || 0;
    if (scrub && dur > 0 && document.activeElement !== scrub) {
      scrub.value = String(Math.round((v.currentTime / dur) * 1000));
    }
    if (timeEl) timeEl.textContent = fmtClock(v.currentTime) + " / " + fmtClock(dur);
    paintSubtitles();
    const now = Date.now();
    if (now - lastProgressSent > 10000) {
      lastProgressSent = now;
      reportProgress(null);
    }
  }

  function broadcastClockSoon() {
    if (window.SDParty && SDParty.broadcastClock) SDParty.broadcastClock();
  }

  async function reportProgress(scrobble) {
    const ctx = vodPickerCtx;
    if (!ctx || !ctx.tmdbId || !vodHlsActive) return;
    const body = {
      tmdb_id: Number(ctx.tmdbId),
      type: ctx.mediaType || "movie",
      progress_seconds: v.currentTime || 0,
      duration_seconds: v.duration || 0,
      season: ctx.season || null,
      episode: ctx.episode || null,
      meta: { title: ctx.title || "" },
    };
    if (scrobble) body.scrobble = scrobble;
    try {
      await authFetch("/vod/library/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) {}
  }

  function renderQualityMenu() {
    const menu = document.getElementById("hlsQualityMenu");
    const btn = document.getElementById("hlsQualityBtn");
    if (!menu) return;
    menu.innerHTML = "";
    const mk = (label, level) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      if (hls && hls.currentLevel === level) b.classList.add("active");
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        if (hls) hls.currentLevel = level;
        if (btn) btn.textContent = label;
        menu.classList.remove("open");
      });
      menu.appendChild(b);
    };
    mk("Auto", -1);
    if (hls && hls.levels && hls.levels.length) {
      hls.levels.forEach((lv, i) => {
        const h = lv.height || 0;
        mk(h ? h + "p" : "Level " + (i + 1), i);
      });
    }
  }

  async function loadSubtitlesForCtx(ctx) {
    const menu = document.getElementById("hlsCcMenu");
    if (!menu || !ctx || !ctx.tmdbId) return;
    menu.innerHTML = '<button type="button" disabled>Loading…</button>';
    let url =
      "/vod/subtitles?tmdb_id=" +
      encodeURIComponent(ctx.tmdbId) +
      "&type=" +
      encodeURIComponent(ctx.mediaType || "movie");
    if (ctx.season) url += "&season=" + encodeURIComponent(ctx.season);
    if (ctx.episode) url += "&episode=" + encodeURIComponent(ctx.episode);
    const lang = lsGet(LS_SUB_LANG, "");
    if (lang) url += "&lang=" + encodeURIComponent(lang);
    try {
      const r = await authFetch(url, { cache: "no-store" });
      const data = await r.json();
      subTracks = data.tracks || [];
    } catch (e) {
      subTracks = [];
    }
    menu.innerHTML = "";
    const off = document.createElement("button");
    off.type = "button";
    off.textContent = "Off";
    off.addEventListener("click", (e) => {
      e.stopPropagation();
      clearSubtitles();
      menu.classList.remove("open");
    });
    menu.appendChild(off);
    for (const t of subTracks) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = (t.display || t.language || "Track") + (t.hearing_impaired ? " (HI)" : "");
      if (activeSubUrl === t.url) b.classList.add("active");
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        applySubtitle(t);
        menu.classList.remove("open");
      });
      menu.appendChild(b);
    }
    if (!subTracks.length) {
      const empty = document.createElement("button");
      empty.type = "button";
      empty.disabled = true;
      empty.textContent = "No tracks found";
      menu.appendChild(empty);
    }
  }

  function clearSubtitles() {
    activeSubUrl = null;
    subCues = [];
    const overlay = document.getElementById("sdSubOverlay");
    if (overlay) {
      overlay.hidden = true;
      overlay.textContent = "";
    }
    [...v.querySelectorAll("track[data-sd-sub]")].forEach((t) => t.remove());
  }

  function parseVtt(text) {
    const cues = [];
    const blocks = String(text || "").replace(/\r/g, "").split(/\n\n+/);
    const re = /(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})/;
    function toSec(ts) {
      const p = ts.replace(",", ".").split(":");
      return Number(p[0]) * 3600 + Number(p[1]) * 60 + Number(p[2]);
    }
    for (const block of blocks) {
      const lines = block.split("\n").filter(Boolean);
      if (!lines.length) continue;
      let i = 0;
      if (/^\d+$/.test(lines[0])) i = 1;
      const m = lines[i] && lines[i].match(re);
      if (!m) continue;
      cues.push({ start: toSec(m[1]), end: toSec(m[2]), text: lines.slice(i + 1).join("\n") });
    }
    return cues;
  }

  async function applySubtitle(track) {
    clearSubtitles();
    if (!track || !track.url) return;
    activeSubUrl = track.url;
    try {
      const r = await authFetch("/vod/subtitles/fetch?url=" + encodeURIComponent(track.url), {
        cache: "force-cache",
      });
      const text = await r.text();
      subCues = parseVtt(text);
      applySubStyle();
      paintSubtitles();
    } catch (e) {
      if (typeof showErr === "function") showErr("Subtitle load failed");
    }
  }

  function applySubStyle() {
    const overlay = document.getElementById("sdSubOverlay");
    if (!overlay) return;
    overlay.style.setProperty("--sd-sub-size", (lsGet(LS_SUB_SIZE, "22") || "22") + "px");
    overlay.style.setProperty("--sd-sub-color", lsGet(LS_SUB_COLOR, "#ffffff") || "#ffffff");
    overlay.dataset.pos = lsGet(LS_SUB_POS, "bottom") || "bottom";
  }

  function paintSubtitles() {
    const overlay = document.getElementById("sdSubOverlay");
    if (!overlay || !subCues.length) return;
    const offset = Number(lsGet("sd_sub_offset", "0") || 0) / 1000;
    const t = (v.currentTime || 0) + offset;
    let text = "";
    for (const c of subCues) {
      if (t >= c.start && t <= c.end) {
        text = c.text;
        break;
      }
    }
    overlay.hidden = !text;
    overlay.textContent = text;
  }

  async function injectContinueWatching() {
    if (!vodCatalogBody) return;
    try {
      const r = await authFetch("/vod/library/continue?limit=24", { cache: "no-store" });
      if (!r.ok) return;
      const data = await r.json();
      const items = data.items || [];
      if (!items.length) return;
      const existing = vodCatalogBody.querySelector('[data-cw="1"]');
      if (existing) existing.remove();
      const sec = renderVodSection(
        "Continue Watching",
        items,
        false,
        (idx) => [vodQueueItem(items[idx].type, items[idx].tmdb_id)]
      );
      sec.dataset.cw = "1";
      sec.querySelectorAll(".vod-card").forEach((card, i) => {
        const it = items[i];
        const wrap = card.querySelector(".vod-poster-wrap") || card;
        const bar = document.createElement("div");
        bar.className = "cw-bar";
        const pct = Math.max(2, Math.min(94, Number(it.percent) || 0));
        bar.innerHTML = "<i style=\"width:" + pct + '%"></i>';
        wrap.appendChild(bar);
        card.addEventListener(
          "click",
          () => {
            resumeSeek = {
              tmdbId: String(it.tmdb_id),
              seconds: Number(it.progress_seconds) || 0,
              season: it.season,
              episode: it.episode,
            };
          },
          true
        );
      });
      vodCatalogBody.insertBefore(sec, vodCatalogBody.firstChild);
    } catch (e) {}
  }

  function prefetchResolve(ctx) {
    if (!prefetchEnabled() || !ctx || !ctx.tmdbId || !vodDirectHlsEnabled()) return;
    let url =
      "/vod/resolve?tmdb_id=" +
      encodeURIComponent(ctx.tmdbId) +
      "&type=" +
      encodeURIComponent(ctx.mediaType || "movie");
    if (ctx.season) url += "&season=" + encodeURIComponent(ctx.season);
    if (ctx.episode) url += "&episode=" + encodeURIComponent(ctx.episode);
    const pref = getLastGood(ctx);
    if (pref) url += "&provider=" + encodeURIComponent(pref);
    authFetch(url, { cache: "no-store" }).catch(() => {});
  }

  function installSettingsExtras() {
    const drawer = document.getElementById("settingsDrawer");
    if (!drawer || drawer.dataset.featSettings === "1") return;
    drawer.dataset.featSettings = "1";
    const host = drawer.querySelector(".settings-body") || drawer;
    const block = document.createElement("div");
    block.innerHTML =
      '<div class="settings-section"><h3>Subtitles</h3>' +
      '<label class="setting-row"><span class="setting-label">Preferred language' +
      '<span class="setting-sub">ISO code, e.g. en</span></span>' +
      '<input id="sdSubLang" type="text" maxlength="8" style="width:72px;text-align:center"/></label>' +
      '<label class="setting-row"><span class="setting-label">Size</span>' +
      '<input id="sdSubSize" type="number" min="14" max="48" style="width:72px"/></label>' +
      '<label class="setting-row"><span class="setting-label">Color</span>' +
      '<input id="sdSubColor" type="color"/></label>' +
      '<label class="setting-row"><span class="setting-label">Position</span>' +
      '<select id="sdSubPos"><option value="bottom">Bottom</option>' +
      '<option value="middle">Middle</option><option value="top">Top</option></select></label></div>' +
      '<div class="settings-section"><h3>Party</h3>' +
      '<label class="setting-row"><span class="setting-label">Display name</span>' +
      '<input id="sdPartyName" type="text" maxlength="32" style="width:140px"/></label>' +
      '<label class="setting-row"><span class="setting-label">Call provider' +
      '<span class="setting-sub">Built-in is free &amp; unlimited; Jitsi public demo ~5 min</span></span>' +
      '<select id="sdPartyAvProvider"><option value="webrtc">Built-in (free)</option>' +
      '<option value="jitsi">Jitsi (demo limit)</option></select></label></div>' +
      '<div class="settings-section"><h3>Playback</h3>' +
      '<label class="setting-row" for="sdPrefetchToggle"><span class="setting-label">Prefetch streams' +
      '<span class="setting-sub">Warm /vod/resolve when opening a title</span></span>' +
      '<input type="checkbox" id="sdPrefetchToggle"/></label>' +
      '<label class="setting-row" for="sdPipToggle"><span class="setting-label">Offer PiP on HLS start</span>' +
      '<input type="checkbox" id="sdPipToggle"/></label>' +
      '<label class="setting-row" for="sdAutoPipBg"><span class="setting-label">Auto PiP when leaving tab' +
      '<span class="setting-sub">Keep playing in PiP / background when switching apps</span></span>' +
      '<input type="checkbox" id="sdAutoPipBg"/></label></div>';
    const dataSec = host.querySelector(".settings-section:last-child");
    if (dataSec) host.insertBefore(block, dataSec);
    else host.appendChild(block);
    const lang = document.getElementById("sdSubLang");
    const size = document.getElementById("sdSubSize");
    const color = document.getElementById("sdSubColor");
    const pos = document.getElementById("sdSubPos");
    const pname = document.getElementById("sdPartyName");
    const pav = document.getElementById("sdPartyAvProvider");
    const pref = document.getElementById("sdPrefetchToggle");
    const pip = document.getElementById("sdPipToggle");
    const autoPip = document.getElementById("sdAutoPipBg");
    if (lang) lang.value = lsGet(LS_SUB_LANG, "en");
    if (size) size.value = lsGet(LS_SUB_SIZE, "22");
    if (color) color.value = lsGet(LS_SUB_COLOR, "#ffffff");
    if (pos) pos.value = lsGet(LS_SUB_POS, "bottom");
    if (pname) pname.value = lsGet(LS_PARTY_NAME, "Guest");
    if (pav) {
      const cur =
        (window.SDPartyAV && SDPartyAV.getProvider && SDPartyAV.getProvider()) ||
        lsGet("sd_party_av_provider", "webrtc");
      pav.value = cur === "jitsi" ? "jitsi" : "webrtc";
    }
    if (pref) pref.checked = prefetchEnabled();
    if (pip) pip.checked = lsGet(LS_PIP, "0") === "1";
    {
      const isAndroid = /Android/i.test(navigator.userAgent || "");
      const autoPipDef = isAndroid ? "0" : "1";
      if (autoPip) autoPip.checked = lsGet(LS_AUTO_PIP_BG, autoPipDef) !== "0";
    }
    const save = () => {
      if (lang) lsSet(LS_SUB_LANG, lang.value.trim());
      if (size) lsSet(LS_SUB_SIZE, String(size.value || "22"));
      if (color) lsSet(LS_SUB_COLOR, color.value || "#ffffff");
      if (pos) lsSet(LS_SUB_POS, pos.value || "bottom");
      if (pname) lsSet(LS_PARTY_NAME, pname.value.trim() || "Guest");
      if (pav) {
        const next = pav.value === "jitsi" ? "jitsi" : "webrtc";
        if (window.SDPartyAV && SDPartyAV.setProvider) SDPartyAV.setProvider(next);
        else lsSet("sd_party_av_provider", next);
      }
      if (pref) lsSet(LS_PREFETCH, pref.checked ? "1" : "0");
      if (pip) lsSet(LS_PIP, pip.checked ? "1" : "0");
      if (autoPip) lsSet(LS_AUTO_PIP_BG, autoPip.checked ? "1" : "0");
      applySubStyle();
    };
    [lang, size, color, pos, pname, pav, pref, pip, autoPip].forEach((el) => {
      if (el) el.addEventListener("change", save);
    });
  }

  // --- wrap core player functions (same script scope via bundle) ---
  const _loadHome = loadVodCatalogHome;
  loadVodCatalogHome = async function () {
    await _loadHome.apply(this, arguments);
    await injectContinueWatching();
  };

  const _showDetailUI = showVodDetailUI;
  showVodDetailUI = async function (tmdbId, mediaType) {
    await _showDetailUI.apply(this, arguments);
    const mt = mediaType === "tv" ? "tv" : "movie";
    const d = vodCatalogDetail;
    const ctx = {
      tmdbId: String(tmdbId),
      mediaType: mt,
      season: mt === "tv" ? "1" : "",
      episode: mt === "tv" ? "1" : "",
      title: (d && d.title) || "",
    };
    if (d && d.type === "tv") {
      const sel = document.getElementById("vodSeasonSelect");
      ctx.season = sel ? sel.value : "1";
    }
    prefetchResolve(ctx);
    // Detail share affordance (Start party is wired in player_app detail actions)
    const actionHost = document.querySelector(".vod-detail-actions");
    if (actionHost && !document.getElementById("vodShareBtn")) {
      const b = document.createElement("button");
      b.type = "button";
      b.id = "vodShareBtn";
      b.className = "trailer";
      b.textContent = "Share";
      b.addEventListener("click", () => {
        if (window.SDParty && SDParty.openShare) SDParty.openShare({ detail: d || ctx });
      });
      actionHost.appendChild(b);
    }
  };

  const _tryAuto = tryAutoVodHls;
  tryAutoVodHls = async function (ctx, returnKind, opts) {
    if (!ctx || !ctx.tmdbId || !vodDirectHlsEnabled()) return false;
    const pref = getLastGood(ctx);
    // Don't prefer known adware last-good for Auto.
    const riskyLast = /^(2embed|2embedskin|moviesapi)$/i.test(String(pref || ""));
    if (pref && !riskyLast) {
      opts = opts || {};
      const timeoutMs = opts.timeoutMs != null ? opts.timeoutMs : 7000;
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      try {
        let url =
          "/vod/resolve?tmdb_id=" +
          encodeURIComponent(ctx.tmdbId) +
          "&type=" +
          encodeURIComponent(ctx.mediaType || "movie");
        if (ctx.season) url += "&season=" + encodeURIComponent(ctx.season);
        if (ctx.episode) url += "&episode=" + encodeURIComponent(ctx.episode);
        url += "&provider=" + encodeURIComponent(pref);
        const fetchOpts = { cache: "no-store" };
        if (controller) fetchOpts.signal = controller.signal;
        const r = await authFetch(url, fetchOpts);
        if (r.ok) {
          const data = await r.json();
          if (isPlayableDirectVod(data)) {
            setLastGood(ctx, data.provider || data.origin || pref);
            await playDirectVodFromResolve(data, returnKind, ctx);
            return true;
          }
        }
      } catch (e) {
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    const ok = await _tryAuto.call(this, ctx, returnKind, opts);
    return ok;
  };

  const _playSource = playVodSource;
  playVodSource = async function (source, ctx) {
    await _playSource.apply(this, arguments);
    if (source && ctx && vodHlsActive && (source.id || source.provider)) {
      setLastGood(ctx, source.id || source.provider);
    }
  };

  const _playHls = playVodHlsInPlayer;
  playVodHlsInPlayer = async function (streamUrl, returnKind, pickerCtx) {
    await _playHls.apply(this, arguments);
    ensureHlsChromeDom();
    if (window.SDCinema && SDCinema.onChromeReady) SDCinema.onChromeReady();
    applySubStyle();
    showHlsChrome();
    const ctx = pickerCtx || vodPickerCtx;
    if (resumeSeek && ctx && String(resumeSeek.tmdbId) === String(ctx.tmdbId)) {
      const sec = resumeSeek.seconds;
      resumeSeek = null;
      const seekOnce = () => {
        if (v.duration && v.duration > sec + 2) {
          try {
            v.currentTime = sec;
          } catch (e) {}
          v.removeEventListener("loadedmetadata", seekOnce);
        }
      };
      v.addEventListener("loadedmetadata", seekOnce);
      setTimeout(seekOnce, 800);
    }
    if (lsGet(LS_PIP, "0") === "1" && v.requestPictureInPicture) {
      setTimeout(() => {
        v.requestPictureInPicture().catch(() => {});
      }, 1200);
    }
    lastProgressSent = 0;
    reportProgress("start");
    if (ctx) loadSubtitlesForCtx(ctx);
    if (window.SDParty && SDParty.onHlsStarted) SDParty.onHlsStarted(ctx);
  };

  if (typeof playVodFileInPlayer === "function") {
    const _playFile = playVodFileInPlayer;
    playVodFileInPlayer = async function (streamUrl, returnKind, pickerCtx) {
      await _playFile.apply(this, arguments);
      ensureHlsChromeDom();
      if (window.SDCinema && SDCinema.onChromeReady) SDCinema.onChromeReady();
      applySubStyle();
      showHlsChrome();
      lastProgressSent = 0;
      reportProgress("start");
      const ctx = pickerCtx || vodPickerCtx;
      if (ctx) loadSubtitlesForCtx(ctx);
      if (window.SDParty && SDParty.onHlsStarted) SDParty.onHlsStarted(ctx);
    };
  }

  const _attach = attachHls;
  attachHls = async function (url) {
    await _attach.apply(this, arguments);
    if (vodHlsActive && hls) {
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        renderQualityMenu();
        const btn = document.getElementById("hlsQualityBtn");
        if (btn) btn.textContent = "Auto";
      });
    }
  };

  const _openSettings = openSettingsDrawer;
  openSettingsDrawer = function () {
    installSettingsExtras();
    _openSettings.apply(this, arguments);
  };

  installSettingsExtras();
  ensureHlsChromeDom();

  /* ---- Media Session API (marker: mediaSession) + background keep-alive / PiP ---- */
  const MS_SITE_ICON = "/tv-assets/icon-512.png";

  let bgWasPlaying = false;
  let bgEnteredPip = false;
  let msWantImmersiveReturn = false;
  let bgKeepAliveWired = false;
  let bgReturnTimer = null;

  function typingTarget(el) {
    if (!el) return false;
    const tag = (el.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (el.isContentEditable) return true;
    return !!(el.closest && el.closest("input, textarea, select, [contenteditable='true']"));
  }

  function absMediaUrl(src) {
    if (!src || typeof src !== "string") return "";
    const s = src.trim();
    if (!s || s.startsWith("data:") || s.startsWith("blob:")) return "";
    try {
      return new URL(s, location.href).href;
    } catch (e) {
      return "";
    }
  }

  function isPlaceholderTitle(t) {
    if (!t) return true;
    const low = String(t).trim().toLowerCase();
    return !low || low === "title" || low === "loading…" || low === "loading..." || low === "now playing";
  }

  function isChannelIndexLabel(t) {
    return /^ch\s+\d+\s*\/\s*\d+$/i.test(String(t || "").trim());
  }

  function currentChannelRecord() {
    try {
      const id = String(
        (typeof headerMeta !== "undefined" && headerMeta && (headerMeta.channel_id || headerMeta.id)) ||
          (typeof channelId !== "undefined" && channelId) ||
          ""
      );
      const fromMap =
        id && typeof channelMap !== "undefined" && channelMap
          ? channelMap[id] || channelMap[String(id)] || null
          : null;
      const name =
        (typeof headerMeta !== "undefined" && headerMeta && headerMeta.name) ||
        (fromMap && fromMap.name) ||
        (id ? "Channel " + id : "");
      const logo =
        (fromMap && fromMap.logo) ||
        (typeof headerMeta !== "undefined" && headerMeta && headerMeta.logo) ||
        "";
      const number =
        (typeof headerMeta !== "undefined" && headerMeta && headerMeta.number) ||
        (fromMap && fromMap.number) ||
        null;
      return { id, name: String(name || ""), logo: String(logo || ""), number };
    } catch (e) {
      return { id: "", name: "", logo: "", number: null };
    }
  }

  function currentEpgNow() {
    try {
      const ch = currentChannelRecord();
      if (!ch.id) return null;
      if (typeof getCachedEntry === "function" && typeof epgCache !== "undefined") {
        const epg = getCachedEntry(epgCache, String(ch.id));
        if (epg && epg.now) return epg.now;
      }
    } catch (e) {}
    return null;
  }

  function watchingVodNow() {
    try {
      if (typeof vodHlsActive !== "undefined" && vodHlsActive) return true;
      if (location.pathname.startsWith("/vod")) return true;
    } catch (e) {}
    return false;
  }

  function programmeArtworkUrl() {
    try {
      if (typeof currentTitleMeta !== "undefined" && currentTitleMeta && currentTitleMeta.meta) {
        const m = currentTitleMeta.meta;
        const u = absMediaUrl(m.poster_url || m.backdrop_url || "");
        if (u) return u;
      }
    } catch (e) {}
    try {
      if (typeof vodPickerCtx !== "undefined" && vodPickerCtx) {
        const u = absMediaUrl(
          vodPickerCtx.poster_url ||
            vodPickerCtx.poster ||
            vodPickerCtx.posterUrl ||
            (vodPickerCtx.posterPath && String(vodPickerCtx.posterPath).startsWith("http")
              ? vodPickerCtx.posterPath
              : "") ||
            ""
        );
        if (u) return u;
      }
    } catch (e) {}
    const imgs = [
      document.getElementById("cinemaPosterLg"),
      document.getElementById("chromePoster"),
      document.getElementById("hdrPoster"),
      document.querySelector(".hdr-poster.show"),
    ];
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i];
      if (!img) continue;
      const raw = img.getAttribute("src") || img.src || "";
      const u = absMediaUrl(raw);
      if (u) return u;
    }
    return "";
  }

  function siteIconArtworkUrl() {
    try {
      const link = document.querySelector(
        'link[rel="apple-touch-icon"], link[rel="icon"][sizes="512x512"], link[rel="icon"]'
      );
      if (link && link.href) {
        const u = absMediaUrl(link.href);
        if (u) return u;
      }
    } catch (e) {}
    return absMediaUrl(MS_SITE_ICON) || absMediaUrl("/tv-assets/icon-192.png");
  }

  function buildMediaArtwork() {
    const out = [];
    const seen = {};
    function push(src, sizes, type) {
      const u = absMediaUrl(src);
      if (!u || seen[u]) return;
      seen[u] = true;
      out.push({ src: u, sizes: sizes || "512x512", type: type || "image/png" });
    }
    // Priority: programme/VOD poster → channel logo → site icon (never empty for Android)
    const prog = programmeArtworkUrl();
    if (prog) push(prog, "512x512", "image/jpeg");
    const logo = absMediaUrl(currentChannelRecord().logo);
    if (logo) push(logo, "512x512", "image/png");
    push(siteIconArtworkUrl(), "512x512", "image/png");
    if (!out.length) push(MS_SITE_ICON, "512x512", "image/png");
    return out;
  }

  function mediaMetaFromDom() {
    const ch = currentChannelRecord();
    const epgNow = currentEpgNow();
    const vod = watchingVodNow();
    let title = "";
    let artist = "";
    let album = "";

    if (vod) {
      const pcTitle = document.getElementById("pcTitle");
      const pcSub = document.getElementById("pcSub");
      const ctx = typeof vodPickerCtx !== "undefined" ? vodPickerCtx : null;
      title =
        (ctx && (ctx.episodeName || ctx.title || ctx.name)) ||
        (pcTitle && pcTitle.textContent.trim()) ||
        "";
      if (isPlaceholderTitle(title)) title = (ctx && ctx.title) || "On Demand";
      artist =
        (pcSub && pcSub.textContent.trim()) ||
        (ctx && ((ctx.mediaType || ctx.media_type) === "tv" ? "Series" : "Movie")) ||
        "On Demand";
      album = "VOD";
    } else {
      if (epgNow) {
        title = String(epgNow.title || "").trim();
      }
      if (isPlaceholderTitle(title)) {
        const hdr =
          document.querySelector("#nowOnAir .hdr-title, #chromeOnAir .hdr-title") ||
          document.querySelector("#cinemaTitle");
        const hdrText = hdr && hdr.textContent.trim();
        if (hdrText && !isPlaceholderTitle(hdrText) && !isChannelIndexLabel(hdrText)) title = hdrText;
      }
      if (isPlaceholderTitle(title)) title = ch.name || "Live TV";
      artist = ch.name || "Live TV";
      const albumBits = ["Live"];
      if (ch.number != null && ch.number !== "") albumBits.push("Ch " + ch.number);
      else if (ch.id) albumBits.push("Ch " + ch.id);
      album = albumBits.join(" · ");
    }

    if (isChannelIndexLabel(artist)) artist = ch.name || (vod ? "On Demand" : "Live TV");
    if (isPlaceholderTitle(title)) title = ch.name || document.title || "StepDaddyLiveHD";

    // Never surface raw "Ch N / M" as the notification title
    if (isChannelIndexLabel(title)) title = ch.name || "Live TV";

    return {
      title: String(title).slice(0, 120),
      artist: String(artist).slice(0, 80),
      album: String(album).slice(0, 80),
      artwork: buildMediaArtwork(),
    };
  }

  function updateDocumentTitleFromPlayback() {
    try {
      const meta = mediaMetaFromDom();
      const base = meta.title || "TV Guide";
      if (base && !isPlaceholderTitle(base) && !isChannelIndexLabel(base)) {
        document.title = base + " — StepDaddyLiveHD";
      }
    } catch (e) {}
  }

  function syncMediaSession() {
    if (!("mediaSession" in navigator)) return;
    const v = document.getElementById("v");
    if (!v) return;
    try {
      const meta = mediaMetaFromDom();
      navigator.mediaSession.metadata = new MediaMetadata(meta);
      navigator.mediaSession.playbackState = v.paused ? "paused" : "playing";
      updateDocumentTitleFromPlayback();
      if (isFinite(v.duration) && v.duration > 0 && isFinite(v.currentTime)) {
        navigator.mediaSession.setPositionState({
          duration: v.duration,
          playbackRate: v.playbackRate || 1,
          position: Math.min(v.currentTime, v.duration),
        });
      }
    } catch (e) {}
  }

  function msSeek(delta) {
    const v = document.getElementById("v");
    if (!v || !isFinite(v.duration) || v.duration <= 0) return;
    try {
      v.currentTime = Math.max(0, Math.min(v.duration - 0.25, v.currentTime + delta));
    } catch (e) {}
    syncMediaSession();
  }

  function msChannelStep(dir) {
    try {
      if (typeof window.SDStepChannel === "function") {
        window.SDStepChannel(dir);
        return;
      }
    } catch (e) {}
    try {
      const ids = typeof orderIds !== "undefined" ? orderIds : null;
      const cur = typeof channelId !== "undefined" ? channelId : null;
      if (ids && ids.length && typeof switchChannel === "function") {
        let idx = ids.indexOf(String(cur));
        if (idx < 0) idx = 0;
        const next = ids[(idx + dir + ids.length) % ids.length];
        if (next) switchChannel(next);
        return;
      }
    } catch (e2) {}
  }

  function autoPipBgEnabled() {
    // Default OFF on Android: Auto PiP (20260907q) remounts the Qualcomm HW decoder and
    // correlates with Chrome ImageReader "no buffers" green/black paint on S23.
    const isAndroid = /Android/i.test(navigator.userAgent || "");
    const def = isAndroid ? "0" : "1";
    return lsGet(LS_AUTO_PIP_BG, def) !== "0";
  }

  function ensureVideoBgAttrs(vid) {
    if (!vid) return;
    try {
      vid.setAttribute("playsinline", "");
      vid.setAttribute("webkit-playsinline", "");
      vid.playsInline = true;
    } catch (e) {}
    try {
      vid.disablePictureInPicture = false;
    } catch (e) {}
    // Hint Chromium/Android/Safari: keep media eligible for AirPlay / remote / lock-screen
    try {
      if (!vid.hasAttribute("x-webkit-airplay")) vid.setAttribute("x-webkit-airplay", "allow");
      if (!vid.hasAttribute("airplay")) vid.setAttribute("airplay", "allow");
      try { vid.disableRemotePlayback = false; } catch (e2) {}
      try { vid.removeAttribute("disableRemotePlayback"); } catch (e3) {}
    } catch (e) {}
  }

  function isInAnyPip(vid) {
    try {
      if (document.pictureInPictureElement) return true;
    } catch (e) {}
    try {
      if (vid && typeof vid.webkitPresentationMode === "string" && vid.webkitPresentationMode === "picture-in-picture") {
        return true;
      }
    } catch (e) {}
    try {
      if (document.pictureInPictureElement === vid) return true;
    } catch (e) {}
    return false;
  }

  async function enterVideoPip(vid) {
    const v = vid || document.getElementById("v");
    if (!v || v.paused) return false;
    ensureVideoBgAttrs(v);
    if (isInAnyPip(v)) return true;
    // Standard video PiP (Chrome Android / desktop / Safari where enabled)
    try {
      if (document.pictureInPictureEnabled !== false && typeof v.requestPictureInPicture === "function") {
        await v.requestPictureInPicture();
        return true;
      }
    } catch (e) {}
    // iOS Safari / WKWebView
    try {
      if (typeof v.webkitSupportsPresentationMode === "function" && v.webkitSupportsPresentationMode("picture-in-picture")) {
        v.webkitSetPresentationMode("picture-in-picture");
        return true;
      }
    } catch (e) {}
    try {
      if (typeof v.webkitSetPresentationMode === "function") {
        v.webkitSetPresentationMode("picture-in-picture");
        return true;
      }
    } catch (e) {}
    return false;
  }

  async function exitVideoPip(vid) {
    const v = vid || document.getElementById("v");
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
    } catch (e) {}
    try {
      if (v && typeof v.webkitPresentationMode === "string" && v.webkitPresentationMode === "picture-in-picture") {
        v.webkitSetPresentationMode("inline");
      }
    } catch (e) {}
  }

  async function enterPlayerFullscreen() {
    const v = document.getElementById("v");
    const area = document.getElementById("videoArea") || document.documentElement;
    try {
      if (typeof applyGuideState === "function") applyGuideState(true);
    } catch (e) {}
    document.body.classList.add("sd-immersive", "sd-fs");
    try {
      if (window.SDMobile && typeof SDMobile.enterImmersive === "function") {
        await SDMobile.enterImmersive(area);
        return;
      }
    } catch (e) {}
    try {
      if (v && typeof v.webkitEnterFullscreen === "function" && /iPhone|iPad|iPod/i.test(navigator.userAgent || "")) {
        v.webkitEnterFullscreen();
        return;
      }
    } catch (e) {}
    try {
      if (!document.fullscreenElement) {
        if (area.requestFullscreen) await area.requestFullscreen({ navigationUI: "hide" });
        else if (area.webkitRequestFullscreen) area.webkitRequestFullscreen();
      }
    } catch (e) {}
  }

  function markMediaSessionReturn() {
    msWantImmersiveReturn = true;
  }

  function resumePlaybackIfNeeded() {
    const v = document.getElementById("v");
    if (!v) return;
    ensureVideoBgAttrs(v);
    // Never auto-pause on hide; if the browser paused us, nudge play when allowed.
    if (v.paused && (bgWasPlaying || msWantImmersiveReturn)) {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
    syncMediaSession();
  }

  async function onPageHiddenKeepAlive() {
    const v = document.getElementById("v");
    if (!v) return;
    bgWasPlaying = !v.paused && !v.ended;
    // Explicitly do NOT pause — mobile browsers often kill playback unless PiP / Media Session.
    if (!bgWasPlaying) return;
    syncMediaSession();
    if (!autoPipBgEnabled()) return;
    // Auto-request PiP mainly on phones; desktop relies on Media Session enterpictureinpicture.
    if (!preferImmersiveReturn()) return;
    const ok = await enterVideoPip(v);
    if (ok) bgEnteredPip = true;
  }

  function preferImmersiveReturn() {
    try {
      if (window.SDMobile && SDMobile.isMobile && SDMobile.isMobile()) return true;
    } catch (e) {}
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
  }

  async function onPageVisibleRestore() {
    const v = document.getElementById("v");
    if (bgReturnTimer) {
      clearTimeout(bgReturnTimer);
      bgReturnTimer = null;
    }
    // Small delay so focus/gesture from notification tap can satisfy fullscreen policies.
    bgReturnTimer = setTimeout(async () => {
      bgReturnTimer = null;
      resumePlaybackIfNeeded();
      // If live stalled after background/PiP, soft-reconnect / hard-remount (20260907r).
      try {
        const healthy =
          typeof window.__sdLivePlaybackHealthy === "function"
            ? window.__sdLivePlaybackHealthy()
            : !!(v && !v.paused && v.readyState >= 2 && !v.error);
        if (!healthy && typeof window.__sdRecoverLivePlayback === "function") {
          window.__sdRecoverLivePlayback("visibility-restore");
        }
      } catch (e) {}
      const fromPip = bgEnteredPip || isInAnyPip(v);
      const wantFs = msWantImmersiveReturn || (fromPip && preferImmersiveReturn());
      if (fromPip) {
        try {
          await exitVideoPip(v);
        } catch (e) {}
        bgEnteredPip = false;
      }
      // Desktop tab switch: reattach player only. Mobile / media-session: go immersive.
      if (wantFs && preferImmersiveReturn()) {
        msWantImmersiveReturn = false;
        try {
          await enterPlayerFullscreen();
        } catch (e) {}
      } else {
        msWantImmersiveReturn = false;
      }
      syncMediaSession();
      bgWasPlaying = false;
    }, 80);
  }

  function wireBackgroundKeepAlive() {
    if (bgKeepAliveWired) return;
    bgKeepAliveWired = true;
    const v = document.getElementById("v");
    ensureVideoBgAttrs(v);

    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden || document.visibilityState === "hidden") {
          onPageHiddenKeepAlive();
        } else {
          onPageVisibleRestore();
        }
      },
      { passive: true }
    );

    // iOS / some Android paths fire pagehide without a reliable visibilitychange order.
    window.addEventListener(
      "pagehide",
      () => {
        onPageHiddenKeepAlive();
      },
      { passive: true }
    );

    window.addEventListener(
      "pageshow",
      () => {
        if (!document.hidden) onPageVisibleRestore();
      },
      { passive: true }
    );

    if (v) {
      v.addEventListener(
        "enterpictureinpicture",
        () => {
          bgEnteredPip = true;
          syncMediaSession();
        },
        { passive: true }
      );
      v.addEventListener(
        "leavepictureinpicture",
        () => {
          bgEnteredPip = false;
          // Returning from OS PiP UI — reattach immersive player when page is visible.
          if (!document.hidden) {
            msWantImmersiveReturn = true;
            onPageVisibleRestore();
          }
        },
        { passive: true }
      );
      // If the browser pauses us while hidden, flip back when possible (no intentional pause-on-hide).
      v.addEventListener(
        "pause",
        () => {
          if (!document.hidden) return;
          if (!bgWasPlaying && !msWantImmersiveReturn) return;
          // Defer: some browsers pause briefly during PiP transition.
          setTimeout(() => {
            if (!document.hidden) return;
            const vid = document.getElementById("v");
            if (!vid || !vid.paused) return;
            if (isInAnyPip(vid)) {
              vid.play().catch(() => {});
              return;
            }
            // Still hidden without PiP — keep trying play for background audio where allowed.
            vid.play().catch(() => {});
            syncMediaSession();
          }, 120);
        },
        { passive: true }
      );
    }
  }

  function wireMediaSession() {
    if (!("mediaSession" in navigator) || navigator.mediaSession.__sdWired) return;
    navigator.mediaSession.__sdWired = true;
    const v = document.getElementById("v");
    ensureVideoBgAttrs(v);

    const wrapMs = (fn) => {
      return function () {
        markMediaSessionReturn();
        try {
          fn.apply(null, arguments);
        } catch (e) {}
        // Notification / lock-screen tap often focuses the tab — request immersive ASAP.
        if (!document.hidden) {
          onPageVisibleRestore();
        }
        syncMediaSession();
      };
    };

    const actions = [
      [
        "play",
        wrapMs(() => {
          const vid = document.getElementById("v");
          if (vid) vid.play().catch(() => {});
        }),
      ],
      [
        "pause",
        () => {
          // User-initiated pause from notification — honor it (do not set immersive return).
          const vid = document.getElementById("v");
          if (vid) vid.pause();
          bgWasPlaying = false;
          syncMediaSession();
        },
      ],
      [
        "stop",
        () => {
          const vid = document.getElementById("v");
          if (vid) {
            vid.pause();
            try {
              vid.currentTime = 0;
            } catch (e) {}
          }
          bgWasPlaying = false;
          syncMediaSession();
        },
      ],
      ["seekbackward", wrapMs((d) => msSeek(-((d && d.seekOffset) || 10)))],
      ["seekforward", wrapMs((d) => msSeek((d && d.seekOffset) || 10))],
      ["previoustrack", wrapMs(() => msChannelStep(-1))],
      ["nexttrack", wrapMs(() => msChannelStep(1))],
    ];
    actions.forEach(([name, fn]) => {
      try {
        navigator.mediaSession.setActionHandler(name, fn);
      } catch (e) {}
    });
    try {
      navigator.mediaSession.setActionHandler(
        "seekto",
        wrapMs((d) => {
          const vid = document.getElementById("v");
          if (!vid || d.seekTime == null) return;
          try {
            vid.currentTime = d.seekTime;
          } catch (e) {}
        })
      );
    } catch (e) {}
    // Chromium: OS can request PiP when user leaves the tab/app.
    try {
      navigator.mediaSession.setActionHandler("enterpictureinpicture", async () => {
        markMediaSessionReturn();
        await enterVideoPip(document.getElementById("v"));
        syncMediaSession();
      });
    } catch (e) {}
    try {
      navigator.mediaSession.setActionHandler("leavepictureinpicture", () => {
        markMediaSessionReturn();
        if (!document.hidden) onPageVisibleRestore();
      });
    } catch (e) {}

    if (v) {
      ["play", "pause", "ended", "timeupdate", "loadedmetadata", "ratechange"].forEach((ev) => {
        v.addEventListener(
          ev,
          () => {
            if (ev === "timeupdate" && Math.floor(v.currentTime) % 3 !== 0) return;
            syncMediaSession();
          },
          { passive: true }
        );
      });
    }
    syncMediaSession();
    setInterval(syncMediaSession, 8000);
  }

  function ensureKeysHelp() {
    let el = document.getElementById("sdKeysHelp");
    if (el) return el;
    el = document.createElement("div");
    el.id = "sdKeysHelp";
    el.className = "sd-keys-help";
    el.hidden = true;
    el.innerHTML =
      '<div class="sd-keys-help-card" role="dialog" aria-label="Keyboard shortcuts">' +
      "<h3>Keyboard shortcuts</h3>" +
      "<dl>" +
      "<dt>Space / K</dt><dd>Play / pause</dd>" +
      "<dt>← / →</dt><dd>Seek ±10s (VOD) or nudge guide</dd>" +
      "<dt>↑ / ↓</dt><dd>Volume ±</dd>" +
      "<dt>M</dt><dd>Mute</dd>" +
      "<dt>F</dt><dd>Fullscreen</dd>" +
      "<dt>G</dt><dd>Guide</dd>" +
      "<dt>P</dt><dd>Party panel / cycle chat mode</dd>" +
      "<dt>[ / ]</dt><dd>Channel − / + (live)</dd>" +
      "<dt>0–9</dt><dd>Volume 0%–90%</dd>" +
      "<dt>Esc</dt><dd>Close overlays</dd>" +
      "<dt>? / Shift+/</dt><dd>This help</dd>" +
      "</dl>" +
      '<p class="hint">Shortcuts ignore focused inputs. Lock-screen / notification controls use Media Session. Leaving the tab auto-enters PiP when supported (Settings → Auto PiP).</p>' +
      "</div>";
    el.addEventListener("click", (e) => {
      if (e.target === el) el.hidden = true;
    });
    document.body.appendChild(el);
    return el;
  }

  function toggleKeysHelp(force) {
    const el = ensureKeysHelp();
    el.hidden = force === undefined ? !el.hidden : !force;
  }

  function wireSiteShortcuts() {
    if (window.__sdSiteKeys) return;
    window.__sdSiteKeys = true;
    document.addEventListener(
      "keydown",
      (e) => {
        if (typingTarget(e.target)) {
          if (e.key === "Escape") {
            const help = document.getElementById("sdKeysHelp");
            if (help && !help.hidden) help.hidden = true;
          }
          return;
        }
        const v = document.getElementById("v");
        const help = document.getElementById("sdKeysHelp");
        if (e.key === "Escape") {
          if (help && !help.hidden) {
            e.preventDefault();
            help.hidden = true;
            return;
          }
          const picker = document.getElementById("partyModePicker");
          if (picker && !picker.hidden) {
            e.preventDefault();
            picker.hidden = true;
            return;
          }
        }
        if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
          e.preventDefault();
          toggleKeysHelp();
          return;
        }
        if (help && !help.hidden) return;

        const guideOpen = !!(
          document.getElementById("tvRoot") &&
          !document.getElementById("tvRoot").classList.contains("guide-collapsed") &&
          document.querySelector(".epg-panel:not([hidden])")
        );
        // Prefer cinema/VOD handler when HLS overlay active; still cover live + party.
        if (e.key === " " || e.key === "k" || e.key === "K") {
          if (typeof vodHlsActive !== "undefined" && vodHlsActive) return; // cinema.js
          if (!v) return;
          e.preventDefault();
          if (v.paused) v.play().catch(() => {});
          else v.pause();
          syncMediaSession();
          return;
        }
        if (e.key === "m" || e.key === "M") {
          if (typeof vodHlsActive !== "undefined" && vodHlsActive) return;
          if (!v) return;
          e.preventDefault();
          v.muted = !v.muted;
          syncMediaSession();
          return;
        }
        if (e.key === "f" || e.key === "F") {
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
            document.body.classList.remove("sd-immersive", "sd-fs");
          } else {
            enterPlayerFullscreen();
          }
          return;
        }
        if (e.key === "p" || e.key === "P") {
          e.preventDefault();
          if (window.SDParty) {
            if (e.shiftKey && typeof SDParty.layoutPartyChrome === "function") {
              /* keep */
            }
            if (document.getElementById("partyFab")) {
              const fab = document.getElementById("partyFab");
              fab.click();
            } else if (typeof SDParty.openPanel === "function") SDParty.openPanel();
          }
          return;
        }
        if (e.key === "[" || e.key === "]") {
          e.preventDefault();
          msChannelStep(e.key === "]" ? 1 : -1);
          return;
        }
        if (e.key >= "0" && e.key <= "9" && v) {
          e.preventDefault();
          v.volume = Number(e.key) / 10;
          v.muted = v.volume <= 0.01;
          syncMediaSession();
          return;
        }
        if (!guideOpen && (e.key === "ArrowUp" || e.key === "ArrowDown") && v) {
          if (typeof vodHlsActive !== "undefined" && vodHlsActive) return;
          e.preventDefault();
          const delta = e.key === "ArrowUp" ? 0.05 : -0.05;
          v.volume = Math.max(0, Math.min(1, (v.volume || 0) + delta));
          if (delta > 0) v.muted = false;
          syncMediaSession();
        }
      },
      true
    );
  }

  // Feature-detect PiP button visibility
  try {
    const pipBtn = document.getElementById("hlsPipBtn");
    if (pipBtn) {
      const probe = document.createElement("video");
      const ok =
        (document.pictureInPictureEnabled && typeof probe.requestPictureInPicture === "function") ||
        (typeof probe.webkitSupportsPresentationMode === "function" &&
          probe.webkitSupportsPresentationMode("picture-in-picture")) ||
        typeof probe.webkitSetPresentationMode === "function";
      pipBtn.hidden = !ok;
      pipBtn.style.display = ok ? "" : "none";
    }
  } catch (e) {}

  wireMediaSession();
  wireBackgroundKeepAlive();
  wireSiteShortcuts();

  // Refresh media session when live header / VOD chrome titles update
  try {
    if (window.MutationObserver) {
      const obs = new MutationObserver(() => syncMediaSession());
      ["nowOnAir", "chromeOnAir", "chromeSub", "pcTitle", "pcSub", "cinemaTitle", "cinemaSub"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) obs.observe(el, { childList: true, characterData: true, subtree: true, attributes: true });
      });
    }
  } catch (e) {}

  /* ── Cast / AirPlay (best-effort) ───────────────────────────────────────
   * Paths:
   *  1) Safari/iOS: webkitShowPlaybackTargetPicker + video airplay attrs
   *  2) Remote Playback API (Chrome/Android when media is URL-backed)
   *  3) Cast Web Sender → Default Media Receiver with absolute HLS/MP4 URL
   *  4) Presentation API second-screen fallback
   * MSE/hls.js on Android Chrome often cannot Remote Playback; Cast still
   * attempts the proxied .m3u8 URL (auth cookies are NOT sent to the receiver).
   */
  const CAST_SENDER_SRC =
    "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
  let castSenderPromise = null;
  let castFrameworkReady = false;
  let castSessionActive = false;
  let castRemoteWatching = false;

  function castNotify(msg, isErr) {
    const text = String(msg || "");
    try {
      const errEl = document.getElementById("errToast");
      if (errEl && isErr) {
        errEl.textContent = text;
        errEl.classList.add("show");
        clearTimeout(errEl._castHide);
        errEl._castHide = setTimeout(() => errEl.classList.remove("show"), 4500);
        return;
      }
    } catch (e) {}
    try {
      const el = document.getElementById("pcToast");
      if (el) {
        el.textContent = text;
        el.classList.add("show");
        clearTimeout(el._castHide);
        el._castHide = setTimeout(() => el.classList.remove("show"), 4200);
        return;
      }
    } catch (e2) {}
    try {
      const errEl = document.getElementById("errToast");
      if (errEl) {
        errEl.textContent = text;
        errEl.classList.add("show");
        clearTimeout(errEl._castHide);
        errEl._castHide = setTimeout(() => errEl.classList.remove("show"), 4200);
      }
    } catch (e3) {}
  }

  function setCastUiActive(on) {
    castSessionActive = !!on;
    ["castBtn", "hlsCastBtn"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle("casting", !!on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
      if (on) el.title = "Casting — tap to stop / change device";
      else if (id === "castBtn") el.title = "Cast / AirPlay";
      else el.title = "Cast / AirPlay";
    });
  }

  function absCastUrl(u) {
    const s = String(u || "").trim();
    if (!s) return "";
    try {
      return new URL(s, location.href).href.split("#")[0];
    } catch (e) {
      return s.startsWith("http") ? s : location.origin + (s.startsWith("/") ? s : "/" + s);
    }
  }

  function resolveCastMediaUrl() {
    let raw = "";
    try {
      if (typeof currentStreamUrl !== "undefined" && currentStreamUrl) raw = currentStreamUrl;
    } catch (e) {}
    try {
      if (!raw && typeof liveStreamUrl !== "undefined" && liveStreamUrl) raw = liveStreamUrl;
    } catch (e2) {}
    try {
      const vid = document.getElementById("v");
      if (!raw && vid) {
        raw = vid.currentSrc || vid.src || "";
        // blob: MSE sources are not castable as a URL
        if (/^blob:/i.test(raw)) raw = "";
      }
    } catch (e3) {}
    try {
      if (!raw && typeof channelId !== "undefined" && channelId) {
        raw = "/live/" + encodeURIComponent(channelId) + ".m3u8";
      }
    } catch (e4) {}
    return absCastUrl(String(raw || "").split("?")[0]);
  }

  function castContentType(url) {
    const u = String(url || "").toLowerCase();
    if (u.includes(".m3u8") || u.includes("/live/") || u.includes("/catchup/")) {
      return "application/x-mpegURL";
    }
    if (u.includes(".mpd")) return "application/dash+xml";
    if (/\.(mp4|m4v|mov)(\?|$)/i.test(u) || u.includes("/vod/file/")) return "video/mp4";
    return "application/x-mpegURL";
  }

  function isLikelyMsePlayback() {
    try {
      const vid = document.getElementById("v");
      if (vid && /^blob:/i.test(vid.currentSrc || vid.src || "")) return true;
    } catch (e) {}
    try {
      if (window.Hls && typeof Hls.isSupported === "function" && Hls.isSupported()) {
        // Desktop/Android Chrome almost always uses hls.js for our proxied live feeds
        if (!/iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent || "")) return true;
      }
    } catch (e2) {}
    return false;
  }

  function loadCastSender() {
    if (castFrameworkReady && window.cast && cast.framework) return Promise.resolve(true);
    if (castSenderPromise) return castSenderPromise;
    castSenderPromise = new Promise((resolve) => {
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        resolve(!!ok);
      };
      window.__onGCastApiAvailable = function (isAvailable) {
        try {
          if (!isAvailable || !window.cast || !cast.framework) {
            done(false);
            return;
          }
          const ctx = cast.framework.CastContext.getInstance();
          ctx.setOptions({
            receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
            autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
          });
          ctx.addEventListener(
            cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
            (ev) => {
              try {
                const st = ev.sessionState;
                const active =
                  st === cast.framework.SessionState.SESSION_STARTED ||
                  st === cast.framework.SessionState.SESSION_RESUMED;
                setCastUiActive(active);
              } catch (e) {}
            }
          );
          castFrameworkReady = true;
          done(true);
        } catch (e) {
          done(false);
        }
      };
      try {
        if (document.querySelector('script[data-sd-cast-sender="1"]')) {
          // Script already requested; wait briefly for callback
          setTimeout(() => done(castFrameworkReady), 2500);
          return;
        }
        const s = document.createElement("script");
        s.src = CAST_SENDER_SRC;
        s.async = true;
        s.dataset.sdCastSender = "1";
        s.onerror = () => done(false);
        document.head.appendChild(s);
        setTimeout(() => done(castFrameworkReady), 4000);
      } catch (e) {
        done(false);
      }
    });
    return castSenderPromise;
  }

  async function tryAirPlayPicker(vid) {
    if (!vid) return false;
    ensureVideoBgAttrs(vid);
    try {
      if (typeof vid.webkitShowPlaybackTargetPicker === "function") {
        vid.webkitShowPlaybackTargetPicker();
        castNotify("Choose an AirPlay device");
        return true;
      }
    } catch (e) {}
    return false;
  }

  async function tryRemotePlayback(vid) {
    if (!vid || !vid.remote || typeof vid.remote.prompt !== "function") return false;
    try {
      if (!castRemoteWatching && typeof vid.remote.watchAvailability === "function") {
        castRemoteWatching = true;
        try {
          vid.remote.watchAvailability(() => {});
        } catch (e) {}
      }
      ensureVideoBgAttrs(vid);
      await vid.remote.prompt();
      setCastUiActive(true);
      return true;
    } catch (e) {
      // NotAllowedError / NotSupportedError / AbortError → fall through
      return false;
    }
  }

  async function tryCastSenderLoad(mediaUrl) {
    if (!mediaUrl || /^blob:/i.test(mediaUrl)) return false;
    const ok = await loadCastSender();
    if (!ok || !window.cast || !cast.framework || !window.chrome || !chrome.cast) return false;
    try {
      const ctx = cast.framework.CastContext.getInstance();
      let session = ctx.getCurrentSession();
      if (!session) {
        await ctx.requestSession();
        session = ctx.getCurrentSession();
      }
      if (!session) return false;
      const mediaInfo = new chrome.cast.media.MediaInfo(mediaUrl, castContentType(mediaUrl));
      mediaInfo.streamType = /\/live\/|\.m3u8/i.test(mediaUrl)
        ? chrome.cast.media.StreamType.LIVE
        : chrome.cast.media.StreamType.BUFFERED;
      try {
        const titleEl = document.getElementById("nowCh") || document.getElementById("pcTitle");
        mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
        mediaInfo.metadata.title = (titleEl && titleEl.textContent) || document.title || "StepDaddyLiveHD";
      } catch (e) {}
      const req = new chrome.cast.media.LoadRequest(mediaInfo);
      await session.loadMedia(req);
      setCastUiActive(true);
      castNotify("Casting to device");
      return true;
    } catch (e) {
      return false;
    }
  }

  async function tryPresentationApi(mediaUrl) {
    if (!window.PresentationRequest || !mediaUrl || /^blob:/i.test(mediaUrl)) return false;
    try {
      // Lightweight receiver: open the same-origin watch URL if possible; else stream URL
      let presentUrl = mediaUrl;
      try {
        if (typeof channelId !== "undefined" && channelId) {
          presentUrl = location.origin + "/tv?ch=" + encodeURIComponent(channelId);
        }
      } catch (e) {}
      const req = new PresentationRequest([presentUrl]);
      const conn = await req.start();
      if (conn) {
        setCastUiActive(true);
        try {
          conn.addEventListener("close", () => setCastUiActive(false));
          conn.addEventListener("terminate", () => setCastUiActive(false));
        } catch (e2) {}
        castNotify("Presentation started");
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  }

  async function promptCast(opts) {
    opts = opts || {};
    const vid = document.getElementById("v");
    if (vid) ensureVideoBgAttrs(vid);
    const mediaUrl = resolveCastMediaUrl();
    const ua = navigator.userAgent || "";
    const isApple = /iPhone|iPad|iPod|Macintosh/i.test(ua) && /Safari/i.test(ua) && !/Chrome|CriOS|Edg/i.test(ua);
    const isAndroid = /Android/i.test(ua);

    // 1) AirPlay route picker (Safari / iOS / some macOS)
    if (await tryAirPlayPicker(vid)) return true;

    // 2) Remote Playback API
    if (await tryRemotePlayback(vid)) return true;

    // 3) Cast Web Sender with absolute stream URL
    if (mediaUrl && (await tryCastSenderLoad(mediaUrl))) return true;

    // 4) Presentation API
    if (mediaUrl && (await tryPresentationApi(mediaUrl))) return true;

    // Helpful limitation messages
    if (isApple) {
      castNotify("AirPlay: use the video player’s AirPlay control or Control Center", true);
      return false;
    }
    if (isAndroid && isLikelyMsePlayback()) {
      castNotify(
        "Cast limited on Android Chrome with HLS.js — try Chrome ⋮ Cast tab/screen, or open in a Cast-capable player",
        true
      );
      return false;
    }
    if (!mediaUrl) {
      castNotify("Nothing to cast — start playback first", true);
      return false;
    }
    castNotify(
      "No cast target found. Desktop Chrome: Cast extension / tab cast. Proxied HLS may need a Cast-capable URL.",
      true
    );
    return false;
  }

  function wireCastControls() {
    const btn = document.getElementById("castBtn");
    // player_app may already wire #castBtn → SDCast.prompt; avoid double handlers
    if (btn && !btn.dataset.wiredApp && !btn.dataset.wiredCast) {
      btn.dataset.wiredCast = "1";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        promptCast({ source: "q2" });
      });
    }
    // Warm Cast sender on Chromium so first tap is faster (best-effort, non-blocking)
    try {
      if (/Chrome|Chromium|Edg|CriOS/i.test(navigator.userAgent || "")) {
        setTimeout(() => {
          loadCastSender().catch(() => {});
        }, 2500);
      }
    } catch (e) {}
    try {
      const vid = document.getElementById("v");
      if (vid) ensureVideoBgAttrs(vid);
    } catch (e2) {}
  }

  try {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", wireCastControls);
    } else {
      wireCastControls();
    }
  } catch (e) {
    try { wireCastControls(); } catch (e2) {}
  }

  window.SDCast = {
    prompt: promptCast,
    resolveUrl: resolveCastMediaUrl,
    isActive: () => castSessionActive,
    ensureAttrs: ensureVideoBgAttrs,
  };

  window.SDFeatures = {
    getLastGood,
    setLastGood,
    prefetchResolve,
    reportProgress,
    showHlsChrome,
    partyName: () => lsGet(LS_PARTY_NAME, "Guest"),
    syncMediaSession,
    toggleKeysHelp,
    enterVideoPip,
    exitVideoPip,
    enterPlayerFullscreen,
  };
})();
