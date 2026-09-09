/* Embed hybrid chrome: slim OSD + YouTube postMessage bridge when available */
(function sdEmbedBoot() {
  let embedActive = false;
  let embedApi = null; // "youtube" | null
  let ytState = -1;
  let ytTime = 0;
  let hideTimer = null;
  let msgBound = false;
  let reclaimBound = false;
  let wasHiddenWhileEmbed = false;
  let nativeOpen = null;
  let liveEmbedMode = false;
  // Block adware popups from third-party embeds; keep scripts/fullscreen working.
  // Note: some preferred players (Videasy) refuse to run when *any* sandbox attr is set.
  const EMBED_SANDBOX =
    "allow-scripts allow-same-origin allow-forms allow-presentation allow-fullscreen allow-pointer-lock";

  function embedHostNeedsOpenFrame(url) {
    try {
      const host = new URL(String(url || ""), location.href).hostname.toLowerCase();
      return /(^|\.)videasy\.(net|to)$|(^|\.)smashystream\.com$|(^|\.)vixsrc\.to$/.test(host);
    } catch (e) {
      return false;
    }
  }

  function detectEmbedApi(url) {
    const u = String(url || "").toLowerCase();
    if (/youtube\.com|youtube-nocookie\.com|youtu\.be/.test(u)) return "youtube";
    return null;
  }

  function ensureYoutubeApiParams(url) {
    try {
      const u = new URL(url, location.href);
      if (!/youtube\.com|youtube-nocookie\.com/.test(u.hostname)) return url;
      u.searchParams.set("enablejsapi", "1");
      u.searchParams.set("origin", location.origin);
      u.searchParams.set("playsinline", "1");
      u.searchParams.set("controls", "0");
      u.searchParams.set("modestbranding", "1");
      u.searchParams.set("rel", "0");
      return u.toString();
    } catch (e) {
      return url;
    }
  }

  function ytCommand(func, args) {
    if (!trailerFrame || !trailerFrame.contentWindow) return;
    try {
      trailerFrame.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: func, args: args || [] }),
        "*"
      );
    } catch (e) {}
  }

  function ytListen() {
    if (msgBound) return;
    msgBound = true;
    window.addEventListener("message", (event) => {
      if (!embedActive || embedApi !== "youtube") return;
      if (!event.origin || (!event.origin.includes("youtube.com") && !event.origin.includes("youtube-nocookie.com")))
        return;
      let data;
      try {
        data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch (e) {
        return;
      }
      if (!data || typeof data !== "object") return;
      if (data.event === "onStateChange" && typeof data.info === "number") {
        ytState = data.info;
        syncEmbedPlayBtn();
      }
      if (data.event === "infoDelivery" && data.info && typeof data.info === "object") {
        if (typeof data.info.playerState === "number") {
          ytState = data.info.playerState;
          syncEmbedPlayBtn();
        }
        if (typeof data.info.currentTime === "number") ytTime = data.info.currentTime;
      }
      if (data.event === "onReady") {
        ytCommand("addEventListener", ["onStateChange"]);
        syncEmbedPlayBtn();
      }
    });
  }

  function syncEmbedPlayBtn() {
    const btn = document.getElementById("embedPlayBtn");
    if (!btn) return;
    const playing = ytState === 1;
    btn.innerHTML = playing
      ? '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';
    btn.title = playing ? "Pause" : "Play";
  }

  function ensureEmbedChrome() {
    if (!trailerLayer) return null;
    let bar = document.getElementById("embedChrome");
    if (bar) return bar;
    bar = document.createElement("div");
    bar.id = "embedChrome";
    bar.className = "embed-chrome";
    bar.innerHTML =
      '<div class="embed-chrome-top">' +
      '<div class="embed-chrome-meta">' +
      '<div class="embed-chrome-eye" id="embedEye">Embed</div>' +
      '<div class="embed-chrome-title" id="embedTitle">Now playing</div>' +
      '<div class="embed-chrome-sub" id="embedSub"></div>' +
      "</div>" +
      '<div class="embed-chrome-actions">' +
      '<button type="button" class="embed-btn" id="embedDirectBtn" title="Try direct stream">Direct</button>' +
      '<button type="button" class="embed-btn" id="embedSourcesBtn" title="Sources">Sources</button>' +
      '<button type="button" class="embed-btn" id="embedAudioBtn" title="Language">Lang</button>' +
      '<button type="button" class="embed-btn" id="embedSettingsBtn" title="Settings">⚙</button>' +
      "</div></div>" +
      '<div class="embed-chrome-hint" id="embedHint">Using embed · tap empty video area for provider controls</div>' +
      '<div class="embed-chrome-bottom" id="embedRemoteBar" hidden>' +
      '<button type="button" class="embed-btn icon" id="embedBack10" title="-10s">−10</button>' +
      '<button type="button" class="embed-btn icon" id="embedPlayBtn" title="Play/Pause">' +
      '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg></button>' +
      '<button type="button" class="embed-btn icon" id="embedFwd10" title="+10s">+10</button>' +
      '<button type="button" class="embed-btn icon" id="embedMuteBtn" title="Mute">🔇</button>' +
      '<span class="embed-api-pill" id="embedApiPill">Remote</span>' +
      "</div>";
    trailerLayer.appendChild(bar);
    ensureReclaimBar();
    wireEmbedChrome(bar);
    return bar;
  }

  function ensureReclaimBar() {
    if (!trailerLayer) return null;
    let reclaim = document.getElementById("embedReclaim");
    if (reclaim) return reclaim;
    reclaim = document.createElement("div");
    reclaim.id = "embedReclaim";
    reclaim.className = "embed-reclaim";
    reclaim.hidden = true;
    reclaim.innerHTML =
      '<div class="embed-reclaim-msg" id="embedReclaimMsg">Popup blocked — your film is still here</div>' +
      '<div class="embed-reclaim-actions">' +
      '<button type="button" class="embed-btn primary" id="embedReclaimFilm">Back to film</button>' +
      '<button type="button" class="embed-btn" id="embedReclaimSources">Sources</button>' +
      '<button type="button" class="embed-btn" id="embedReclaimDismiss">Dismiss</button>' +
      '<button type="button" class="embed-btn" id="embedReclaimExit">Exit player</button>' +
      "</div>";
    trailerLayer.appendChild(reclaim);
    reclaim.querySelector("#embedReclaimFilm").addEventListener("click", (e) => {
      e.stopPropagation();
      reclaimToFilm();
    });
    reclaim.querySelector("#embedReclaimSources").addEventListener("click", (e) => {
      e.stopPropagation();
      hideReclaim();
      if (liveEmbedMode) {
        try {
          if (typeof applyGuideState === "function") applyGuideState(false);
          else if (typeof toggleGuide === "function") toggleGuide();
        } catch (err) {}
        return;
      }
      openEmbedSources();
    });
    reclaim.querySelector("#embedReclaimDismiss").addEventListener("click", (e) => {
      e.stopPropagation();
      hideReclaim();
    });
    reclaim.querySelector("#embedReclaimExit").addEventListener("click", (e) => {
      e.stopPropagation();
      hideReclaim();
      if (liveEmbedMode) {
        try {
          if (typeof applyGuideState === "function") applyGuideState(false);
        } catch (err) {}
        try {
          if (window.SDEmbed && SDEmbed.stop) SDEmbed.stop();
        } catch (err) {}
        // Tear down live embed and retune current channel chrome (guide visible).
        try {
          if (typeof restoreLiveChannelPlayback === "function") {
            restoreLiveChannelPlayback("live-embed-exit");
          } else if (typeof switchChannel === "function" && typeof channelId !== "undefined" && channelId) {
            switchChannel(String(channelId), { force: true });
          }
        } catch (err) {}
        return;
      }
      if (typeof stopOverlayPlayback === "function") stopOverlayPlayback();
      else if (typeof stopTrailerPlayback === "function") stopTrailerPlayback();
    });
    return reclaim;
  }

  function syncReclaimChrome() {
    const filmBtn = document.getElementById("embedReclaimFilm");
    const sourcesBtn = document.getElementById("embedReclaimSources");
    const exitBtn = document.getElementById("embedReclaimExit");
    const msg = document.getElementById("embedReclaimMsg");
    if (liveEmbedMode) {
      if (filmBtn) filmBtn.textContent = "Back to live";
      if (sourcesBtn) sourcesBtn.textContent = "Guide";
      if (exitBtn) exitBtn.textContent = "Exit backup";
      if (msg && (!msg.dataset.locked || msg.dataset.locked === "0")) {
        msg.textContent = "Popup blocked — live backup player is still here";
      }
    } else {
      if (filmBtn) filmBtn.textContent = "Back to film";
      if (sourcesBtn) sourcesBtn.textContent = "Sources";
      if (exitBtn) exitBtn.textContent = "Exit player";
      if (msg && (!msg.dataset.locked || msg.dataset.locked === "0")) {
        msg.textContent = "Popup blocked — your film is still here";
      }
    }
  }

  function peekFilmShell() {
    try {
      if (typeof window.SDPeekFilmOverVodCatalog === "function") window.SDPeekFilmOverVodCatalog();
      else {
        document.getElementById("vodCatalog")?.classList.remove("open");
        document.getElementById("vodCatalogBackdrop")?.classList.remove("open");
      }
    } catch (e) {}
    // Live backup: collapse guide/sheet so reclaim stays visible on mobile (same class as VOD).
    if (liveEmbedMode) {
      try {
        if (typeof applyGuideState === "function") applyGuideState(true);
      } catch (e) {}
      try {
        document.getElementById("epgPanel")?.classList.remove("open");
      } catch (e) {}
    }
  }

  function showReclaim(message) {
    if (!embedActive) return;
    const bar = ensureReclaimBar();
    if (!bar) return;
    // Catalog/guide sheet can sit under the trailer layer but still steal attention / cover reclaim on mobile.
    peekFilmShell();
    syncReclaimChrome();
    const msg = document.getElementById("embedReclaimMsg");
    if (msg && message) {
      msg.textContent = message;
      msg.dataset.locked = "1";
    }
    bar.hidden = false;
    bar.classList.add("show");
    showEmbedChrome();
    const back = document.getElementById("trailerBackBtn");
    if (back) {
      back.classList.add("embed-sticky-back");
      back.textContent = liveEmbedMode ? "← Back to live" : "← Back to film";
    }
  }

  function hideReclaim() {
    const bar = document.getElementById("embedReclaim");
    if (bar) {
      bar.hidden = true;
      bar.classList.remove("show");
    }
    const msg = document.getElementById("embedReclaimMsg");
    if (msg) msg.dataset.locked = "0";
  }

  function reclaimToFilm() {
    hideReclaim();
    peekFilmShell();
    try {
      if (typeof closeVodPickerPanel === "function") closeVodPickerPanel();
    } catch (e) {}
    try {
      if (window.SDPinUnlock && SDPinUnlock.isOpen && SDPinUnlock.isOpen()) SDPinUnlock.close();
    } catch (e) {}
    showEmbedChrome();
    const back = document.getElementById("trailerBackBtn");
    if (back) {
      back.classList.add("embed-sticky-back");
      back.textContent = liveEmbedMode ? "← Back to live" : "← Back to film";
    }
    try {
      if (trailerLayer) trailerLayer.scrollIntoView({ block: "nearest" });
    } catch (e) {}
    // Nudge iframe focus without navigating away.
    try {
      if (trailerFrame && trailerFrame.contentWindow) trailerFrame.contentWindow.focus();
    } catch (e) {}
    try {
      window.focus();
    } catch (e) {}
  }

  function hardenTrailerFrame(embedUrl) {
    if (!trailerFrame) return;
    try {
      const openFrame = embedHostNeedsOpenFrame(embedUrl || trailerFrame.src || "");
      if (openFrame) {
        // Videasy (and similar) detect sandbox="" and show "Iframe Sandbox Detected".
        // Hijack popups still blocked by installPopupGuard() window.open wrapper.
        trailerFrame.removeAttribute("sandbox");
        trailerFrame.setAttribute("referrerpolicy", "origin-when-cross-origin");
      } else {
        trailerFrame.setAttribute("sandbox", EMBED_SANDBOX);
        trailerFrame.setAttribute("referrerpolicy", "no-referrer");
      }
      // Keep media permissions; do not grant display-capture / payment.
      trailerFrame.setAttribute(
        "allow",
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      );
    } catch (e) {}
  }

  function installPopupGuard() {
    if (nativeOpen) return;
    try {
      nativeOpen = window.open;
      window.open = function () {
        if (embedActive) {
          showReclaim(
            liveEmbedMode
              ? "Blocked a hijack popup — tap Back to live"
              : "Blocked a hijack popup — tap Back to film"
          );
          return null;
        }
        return nativeOpen.apply(window, arguments);
      };
    } catch (e) {}
  }

  function removePopupGuard() {
    if (!nativeOpen) return;
    try {
      window.open = nativeOpen;
    } catch (e) {}
    nativeOpen = null;
  }

  function wireReclaimLifecycle() {
    if (reclaimBound) return;
    reclaimBound = true;
    let reclaimCooldownUntil = 0;
    let blurAt = 0;
    function softReclaim(message) {
      if (!embedActive) return;
      if (Date.now() < reclaimCooldownUntil) return;
      showReclaim(message);
      reclaimCooldownUntil = Date.now() + 8000;
    }
    document.addEventListener("visibilitychange", () => {
      if (!embedActive) return;
      if (document.hidden) {
        wasHiddenWhileEmbed = true;
        return;
      }
      if (wasHiddenWhileEmbed) {
        wasHiddenWhileEmbed = false;
        softReclaim(
          liveEmbedMode
            ? "Returned from another tab — continue live backup"
            : "Returned from another tab — continue your film"
        );
      }
    });
    window.addEventListener("pagehide", () => {
      if (embedActive) wasHiddenWhileEmbed = true;
    });
    window.addEventListener("pageshow", () => {
      if (embedActive && wasHiddenWhileEmbed) {
        wasHiddenWhileEmbed = false;
        softReclaim(
          liveEmbedMode
            ? "Welcome back — live backup player is still open"
            : "Welcome back — your film player is still open"
        );
      }
    });
    // Ignore brief blur (notification shade / status bar). Only long focus loss.
    window.addEventListener("blur", () => {
      if (embedActive) blurAt = Date.now();
    });
    window.addEventListener("focus", () => {
      if (!embedActive || !blurAt) return;
      const away = Date.now() - blurAt;
      blurAt = 0;
      if (away < 2500) return;
      if (wasHiddenWhileEmbed) wasHiddenWhileEmbed = false;
      softReclaim(
        liveEmbedMode
          ? "Focus restored — tap Back to live if an ad covered playback"
          : "Focus restored — tap Back to film if an ad covered playback"
      );
    });
  }

  function wireEmbedChrome(bar) {
    if (bar.dataset.wired === "1") return;
    bar.dataset.wired = "1";
    document.getElementById("embedSourcesBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      openEmbedSources();
    });
    document.getElementById("embedAudioBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.SDCinema && SDCinema.openSettings) SDCinema.openSettings();
    });
    document.getElementById("embedDirectBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      retryDirectStream();
    });
    document.getElementById("embedSettingsBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.SDCinema && SDCinema.openSettings) SDCinema.openSettings();
    });
    document.getElementById("embedPlayBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      if (embedApi !== "youtube") return;
      if (ytState === 1) ytCommand("pauseVideo");
      else ytCommand("playVideo");
      showEmbedChrome();
    });
    document.getElementById("embedBack10").addEventListener("click", (e) => {
      e.stopPropagation();
      if (embedApi === "youtube") {
        ytTime = Math.max(0, (ytTime || 0) - 10);
        ytCommand("seekTo", [ytTime, true]);
      }
      showEmbedChrome();
    });
    document.getElementById("embedFwd10").addEventListener("click", (e) => {
      e.stopPropagation();
      if (embedApi === "youtube") {
        ytTime = (ytTime || 0) + 10;
        ytCommand("seekTo", [ytTime, true]);
      }
      showEmbedChrome();
    });
    document.getElementById("embedMuteBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      if (embedApi !== "youtube") return;
      const btn = e.currentTarget;
      if (btn.dataset.muted === "1") {
        ytCommand("unMute");
        btn.dataset.muted = "0";
        btn.textContent = "🔊";
      } else {
        ytCommand("mute");
        btn.dataset.muted = "1";
        btn.textContent = "🔇";
      }
      showEmbedChrome();
    });

    if (trailerLayer && trailerLayer.dataset.embedChromeBound !== "1") {
      trailerLayer.dataset.embedChromeBound = "1";
      /*
       * Embed chrome zones (aligned with HLS party hotzones):
       * top = Direct/Sources/Lang/title, bottom = remote bar, center toggles.
       * Ignore .party-drawer so chat taps never pop embed OSD over the rail.
       */
      function embedPartyIgnore(target) {
        return !!(
          target &&
          target.closest &&
          target.closest(
            ".party-drawer, .party-fab, .party-toast, .party-jitsi-stage, .party-av-overlay, #partyAvOverlay, #partyFab, .party-live-overlay, .sd-modal, .sd-modal-backdrop"
          )
        );
      }
      function embedInVideoPane(e) {
        if (!trailerLayer) return true;
        const va = document.getElementById("videoArea");
        const hulu =
          trailerLayer.classList.contains("party-layout-hulu") ||
          (va && va.classList.contains("party-layout-hulu"));
        const rave =
          trailerLayer.classList.contains("party-layout-rave") ||
          (va && va.classList.contains("party-layout-rave"));
        if (!hulu && !rave) return true;
        const x = e.clientX != null ? e.clientX : (e.touches && e.touches[0] && e.touches[0].clientX) || 0;
        const y = e.clientY != null ? e.clientY : (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
        if (hulu) {
          const drawer = document.getElementById("partyDrawer");
          if (drawer && drawer.classList.contains("open")) {
            return x < drawer.getBoundingClientRect().left;
          }
        }
        if (rave) {
          const rect = (va || trailerLayer).getBoundingClientRect();
          return (y - rect.top) / Math.max(1, rect.height) <= 0.55;
        }
        return true;
      }
      trailerLayer.addEventListener("mousemove", (e) => {
        if (!embedActive || embedPartyIgnore(e.target) || !embedInVideoPane(e)) return;
        showEmbedChrome();
      });
      trailerLayer.addEventListener(
        "touchstart",
        (e) => {
          if (!embedActive || embedPartyIgnore(e.target) || !embedInVideoPane(e)) return;
          showEmbedChrome();
        },
        { passive: true }
      );
      trailerLayer.addEventListener("click", (e) => {
        if (!embedActive || embedPartyIgnore(e.target) || !embedInVideoPane(e)) return;
        if (e.target.closest(".embed-chrome-actions, .embed-chrome-bottom, button, input")) return;
        const bar = document.getElementById("embedChrome");
        if (bar && bar.classList.contains("show")) {
          bar.classList.remove("show");
          clearTimeout(hideTimer);
        } else {
          showEmbedChrome();
        }
      });
    }
  }

  function showEmbedChrome() {
    const bar = ensureEmbedChrome();
    if (!bar || !embedActive) return;
    bar.classList.add("show");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!embedActive) return;
      bar.classList.remove("show");
    }, 3200);
  }

  function updateEmbedMeta() {
    const ctx = typeof vodPickerCtx !== "undefined" ? vodPickerCtx || {} : {};
    const title = document.getElementById("embedTitle");
    const sub = document.getElementById("embedSub");
    const eye = document.getElementById("embedEye");
    if (title) title.textContent = ctx.title || "Now playing";
    if (eye) eye.textContent = embedApi === "youtube" ? "YouTube · remote" : "Embed playback";
    if (sub) {
      const bits = [];
      if (ctx.season && ctx.episode) bits.push("S" + ctx.season + " · E" + ctx.episode);
      if (ctx.episodeName) bits.push(ctx.episodeName);
      sub.textContent = bits.join(" — ");
    }
    const remote = document.getElementById("embedRemoteBar");
    const hint = document.getElementById("embedHint");
    if (remote) remote.hidden = embedApi !== "youtube";
    if (hint) {
      hint.textContent =
        embedApi === "youtube"
          ? "Remote controls active · use our bar for play / seek / mute"
          : "Using embed · empty video area passes clicks to provider · Sources / Direct above";
    }
  }

  async function openEmbedSources() {
    const ctx = typeof vodPickerCtx !== "undefined" ? vodPickerCtx : null;
    if (!ctx || !ctx.tmdbId) return;
    if (typeof openVodPickerForCtx === "function") await openVodPickerForCtx(ctx);
  }

  async function retryDirectStream() {
    const ctx = typeof vodPickerCtx !== "undefined" ? vodPickerCtx : null;
    if (!ctx || !ctx.tmdbId) return;
    const hint = document.getElementById("embedHint");
    if (hint) hint.textContent = "Trying direct stream…";
    try {
      let url =
        "/vod/resolve?tmdb_id=" +
        encodeURIComponent(ctx.tmdbId) +
        "&type=" +
        encodeURIComponent(ctx.mediaType || "movie") +
        "&lang=" +
        encodeURIComponent(typeof vodPreferLang === "function" ? vodPreferLang() : "en");
      if (ctx.season) url += "&season=" + encodeURIComponent(ctx.season);
      if (ctx.episode) url += "&episode=" + encodeURIComponent(ctx.episode);
      const r = await authFetch(url, { cache: "no-store" });
      const data = await r.json();
      if (data && data.ok && data.stream_url && typeof playDirectVodFromResolve === "function") {
        stopEmbedChrome();
        const retKind =
          (typeof overlayReturn !== "undefined" && overlayReturn && overlayReturn.kind) ||
          "vod_detail";
        await playDirectVodFromResolve(data, retKind === "live" ? "vod_detail" : retKind, ctx);
        return;
      }
      if (hint) hint.textContent = "No direct stream yet · pick another source";
    } catch (e) {
      if (hint) hint.textContent = "Direct stream failed · stay on embed";
    }
  }

  function startEmbedChrome(embedUrl, opts) {
    opts = opts || {};
    liveEmbedMode = !!(opts.live || opts.mode === "live");
    embedActive = true;
    embedApi = detectEmbedApi(embedUrl);
    ytState = -1;
    ytTime = 0;
    wasHiddenWhileEmbed = false;
    ytListen();
    wireReclaimLifecycle();
    installPopupGuard();
    hardenTrailerFrame(embedUrl);
    if (trailerLayer) {
      trailerLayer.classList.add("embed-mode");
      trailerLayer.classList.remove("hls-mode", "has-hls-chrome");
      if (liveEmbedMode) trailerLayer.classList.add("live-embed-mode");
      else trailerLayer.classList.remove("live-embed-mode");
    }
    ensureEmbedChrome();
    ensureReclaimBar();
    syncReclaimChrome();
    hideReclaim();
    // Keep reclaim + player visible over VOD catalog / live guide sheet on mobile.
    peekFilmShell();
    updateEmbedMeta();
    showEmbedChrome();
    const back = document.getElementById("trailerBackBtn");
    if (back) {
      back.classList.add("embed-sticky-back");
      if (liveEmbedMode) {
        back.textContent = "← Back to live";
      } else if (typeof overlayReturn !== "undefined" && overlayReturn && overlayReturn.kind !== "live") {
        back.textContent = "← Back to film";
      }
    }
    // Hide VOD-only Direct/Sources chrome noise for live backup.
    try {
      const direct = document.getElementById("embedDirectBtn");
      const sources = document.getElementById("embedSourcesBtn");
      const audio = document.getElementById("embedAudioBtn");
      if (direct) direct.hidden = !!liveEmbedMode;
      if (sources) sources.hidden = !!liveEmbedMode;
      if (audio) audio.hidden = !!liveEmbedMode;
      const eye = document.getElementById("embedEye");
      if (eye) eye.textContent = liveEmbedMode ? "Live backup" : "Embed";
      const hint = document.getElementById("embedHint");
      if (hint) {
        const tos = !!(window.__SD_LIVE_CDN_TOS);
        hint.textContent = liveEmbedMode
          ? (tos
            ? "Upstream CDN ToS-blocked — backup waiting on new CDN · tap for controls"
            : "CDN blocked — backup player · tap empty area for controls")
          : "Using embed · tap empty video area for provider controls";
      }
    } catch (e) {}
    if (embedApi === "youtube") {
      setTimeout(() => {
        ytCommand("addEventListener", ["onStateChange"]);
        ytCommand("playVideo");
      }, 700);
    }
  }

  function stopEmbedChrome() {
    embedActive = false;
    embedApi = null;
    liveEmbedMode = false;
    wasHiddenWhileEmbed = false;
    clearTimeout(hideTimer);
    hideReclaim();
    removePopupGuard();
    if (trailerLayer) trailerLayer.classList.remove("embed-mode", "live-embed-mode");
    const bar = document.getElementById("embedChrome");
    if (bar) bar.classList.remove("show");
    const back = document.getElementById("trailerBackBtn");
    if (back) back.classList.remove("embed-sticky-back");
    try {
      const direct = document.getElementById("embedDirectBtn");
      const sources = document.getElementById("embedSourcesBtn");
      const audio = document.getElementById("embedAudioBtn");
      if (direct) direct.hidden = false;
      if (sources) sources.hidden = false;
      if (audio) audio.hidden = false;
    } catch (e) {}
  }

  function enhanceEmbedUrl(url) {
    if (detectEmbedApi(url) === "youtube") return ensureYoutubeApiParams(url);
    return url;
  }

  window.SDEmbed = {
    start: startEmbedChrome,
    stop: stopEmbedChrome,
    enhanceUrl: enhanceEmbedUrl,
    hasRemote: () => embedApi === "youtube",
    isActive: () => !!embedActive,
    isLive: () => !!liveEmbedMode,
    sandbox: EMBED_SANDBOX,
    hardenFrame: hardenTrailerFrame,
    reclaim: reclaimToFilm,
    showReclaim: showReclaim,
    peekShell: peekFilmShell,
  };
})();
