/**
 * StepDaddy Music — unified Spotify-like player for Radio + Listen.
 * Single <audio> engine; optional muted looping <video> in art after still fade.
 * Expanded sheet: dial swipe, lyrics, Listen deep-link, dense chrome actions.
 * API: window.StepDaddyMusicPlayer.ensure(host) / .play(payload) / .stop() / …
 */
(function () {
  if (window.StepDaddyMusicPlayer) return;

  var ART_TO_VIDEO_MS = 4200;
  var NP_POLL_MS = 22000;
  var DIAL_DEBOUNCE_MS = 420;
  var DOCK_GESTURE_DEBOUNCE_MS = 380;
  /** Paused mini-dock on /tv auto-hides after this idle (Spotify-adjacent). */
  var DOCK_PAUSE_IDLE_MS = 5500;
  var LYRICS_POLL_MS = 400;
  var FALLBACK_ART =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">' +
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
        '<stop stop-color="#12151c"/><stop offset="1" stop-color="#1a2332"/>' +
        "</linearGradient></defs>" +
        '<rect width="240" height="240" fill="url(#g)"/>' +
        '<circle cx="120" cy="120" r="54" fill="none" stroke="#3b82f6" stroke-width="6" opacity=".85"/>' +
        '<circle cx="120" cy="120" r="10" fill="#3b82f6"/>' +
        '<path d="M140 78v70c0 12-10 22-22 22s-22-10-22-22 10-22 22-22c4 0 8 1 11 3V78l56-12v28l-45 10z" fill="#e8eaef" opacity=".92"/>' +
        "</svg>"
    );

  function ensureCss() {
    if (document.getElementById("sd-music-player-css")) return;
    var link = document.createElement("link");
    link.id = "sd-music-player-css";
    link.rel = "stylesheet";
    link.href =
      "/tv-assets/music_player.css?v=" +
      encodeURIComponent(window.__SD_BUNDLE_VERSION || "1");
    document.head.appendChild(link);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function looksLikeAttrSoup(s) {
    return /(?:^|\s)\w+="/.test(String(s || ""));
  }

  function extractTextAttr(s) {
    var m = /(?:^|\s)(?:text|Title|song)\s*=\s*"((?:\\.|[^"\\])*)"/i.exec(String(s || ""));
    if (m) return m[1].replace(/\\"/g, '"').trim();
    var m2 = /(?:^|\s)(?:text|Title|song)\s*=\s*"([^"]*)/i.exec(String(s || ""));
    return m2 ? m2[1].trim() : "";
  }

  function stripAttrSoup(s) {
    return String(s || "")
      .replace(/(?:^|\s)\w+="(?:\\.|[^"\\])*"/g, " ")
      .replace(/(?:^|\s)\w+="[^"]*$/g, " ")
      .replace(/\s+(?:—|–|-)\s*$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function sanitizeNowFields(now) {
    if (!now || typeof now === "string") return now;
    var artist = now.artist || "";
    var title = now.title || "";
    var raw = now.raw || "";
    if (looksLikeAttrSoup(title) || /^text=/i.test(title)) {
      title = extractTextAttr(title) || extractTextAttr(raw) || "";
    }
    if (looksLikeAttrSoup(artist)) {
      artist = stripAttrSoup(artist);
    }
    if (!title && raw && !looksLikeAttrSoup(raw)) title = raw;
    if (!title && raw) title = extractTextAttr(raw);
    if (title && /^[\s,",]+$/.test(title)) title = "";
    return { artist: artist || null, title: title || null, raw: raw || null, ids: now.ids || null };
  }

  function formatNowLine(now) {
    if (!now) return "";
    if (typeof now === "string") {
      if (looksLikeAttrSoup(now)) {
        var t = extractTextAttr(now);
        var head = stripAttrSoup(now);
        if (t && head) return head + " — " + t;
        return t || "";
      }
      return now;
    }
    var clean = sanitizeNowFields(now);
    if (clean.artist && clean.title) return clean.artist + " — " + clean.title;
    return clean.title || "";
  }

  function Player() {
    this.root = null;
    this.audio = null;
    this.video = null;
    this.hls = null;
    this.state = {
      source: null,
      id: null,
      title: "",
      subtitle: "",
      artwork: "",
      streamUrl: "",
      videoUrl: "",
      hls: false,
      now: null,
      next: null,
      queue: null,
      queueIndex: -1,
      playing: false,
      expanded: false,
      muted: false,
      volume: 1,
      band: "",
      dial: "",
      homepage: "",
      genre: "",
      station: null,
      playMode: "off",
      albumId: "",
      albumTitle: "",
      artistId: "",
      videoFs: false,
    };
    this._artTimer = null;
    this._npTimer = null;
    this._npInflight = false;
    this._handlers = { onEnded: null, onPrev: null, onNext: null };
    this._dial = { list: [], index: -1 };
    this._lyrics = { lines: [], synced: false, key: "", visible: false, raf: null };
    this._wantPlaying = false;
    this._msWired = false;
    this._bgKeepWired = false;
    this._swipe = { x0: 0, y0: 0, active: false, lastTune: 0 };
    this._dockGesture = {
      active: false,
      axis: null,
      x0: 0,
      y0: 0,
      fromBtn: false,
      pointerId: null,
      lastCommit: 0,
      usingPointer: false,
    };
    this._pauseIdleTimer = null;
    this._seekWired = false;
  }

  Player.prototype._musicSheetOpen = function () {
    var sheet = document.getElementById("musicCatalog");
    return !!(sheet && sheet.classList.contains("open"));
  };

  Player.prototype._syncHost = function () {
    if (!this.root) return this;
    var catalog = document.getElementById("musicCatalog");
    var musicOpen = this._musicSheetOpen();
    var showing = this.root.classList.contains("show");
    var target = musicOpen && catalog ? catalog : document.body;
    if (this.root.parentNode !== target) {
      target.appendChild(this.root);
    }
    this.root.classList.toggle("smp-on-tv", !!(showing && !musicOpen));
    this._bumpPauseIdle();
    return this;
  };

  Player.prototype.ensure = function (host) {
    ensureCss();
    if (this.root && document.body.contains(this.root)) {
      if (host && this.root.parentNode !== host && this._musicSheetOpen()) {
        host.appendChild(this.root);
      }
      this._syncHost();
      return this;
    }
    var root = document.createElement("div");
    root.className = "sd-music-player";
    root.id = "sdMusicPlayer";
    root.innerHTML =
      '<div class="smp-dock" data-smp-dock>' +
      '  <button type="button" class="smp-art" data-smp-expand aria-label="Expand now playing">' +
      '    <img data-smp-art alt=""/>' +
      '    <video data-smp-video muted loop playsinline webkit-playsinline></video>' +
      "  </button>" +
      '  <div class="smp-meta" data-smp-expand-meta>' +
      '    <div class="smp-title smp-marquee" data-smp-title><span class="smp-marquee-inner">—</span></div>' +
      '    <div class="smp-sub smp-marquee" data-smp-sub><span class="smp-marquee-inner"></span></div>' +
      '    <div class="smp-now smp-marquee" data-smp-now hidden><span class="smp-marquee-inner"></span></div>' +
      '    <div class="smp-next smp-marquee" data-smp-upnext hidden><span class="smp-marquee-inner"></span></div>' +
      "  </div>" +
      '  <div class="smp-controls">' +
      '    <button type="button" class="smp-dock-fav" data-smp-fav aria-label="Favorite">♡</button>' +
      '    <button type="button" class="smp-dock-skip" data-smp-prev aria-label="Previous"><span class="smp-ico" aria-hidden="true">⏮</span></button>' +
      '    <button type="button" class="smp-main" data-smp-toggle aria-label="Play/Pause"><span class="smp-ico" aria-hidden="true">▶</span></button>' +
      '    <button type="button" class="smp-dock-skip" data-smp-next aria-label="Next"><span class="smp-ico" aria-hidden="true">⏭</span></button>' +
      '    <button type="button" class="smp-stop" data-smp-stop aria-label="Stop" title="Stop"><span class="smp-ico" aria-hidden="true">■</span></button>' +
      "  </div>" +
      '  <div class="smp-dock-progress" data-smp-dock-progress hidden aria-hidden="true"><i data-smp-dock-progress-bar></i></div>' +
      '  <audio data-smp-audio playsinline webkit-playsinline preload="none" crossorigin="anonymous"></audio>' +
      "</div>" +
      '<div class="smp-sheet" data-smp-sheet hidden>' +
      '  <div class="smp-sheet-top">' +
      '    <button type="button" class="smp-icon-btn" data-smp-collapse aria-label="Collapse">↓</button>' +
      '    <div class="smp-sheet-context">' +
      '      <small data-smp-context-label>Now playing</small>' +
      '      <div class="smp-band-pill" data-smp-band-pill>FM</div>' +
      "    </div>" +
      '    <button type="button" class="smp-icon-btn" data-smp-share aria-label="Share">↗</button>' +
      "  </div>" +
      '  <div class="smp-dial-hint" data-smp-dial-hint aria-live="polite">' +
      '    <button type="button" class="smp-dial-arrow" data-smp-dial-prev aria-label="Previous station">‹</button>' +
      '    <div class="smp-dial-readout"><span data-smp-dial-freq>—</span><small data-smp-dial-seg></small></div>' +
      '    <button type="button" class="smp-dial-arrow" data-smp-dial-next aria-label="Next station">›</button>' +
      "  </div>" +
      '  <div class="smp-sheet-main" data-smp-sheet-main>' +
      '  <div class="smp-sheet-stage" data-smp-stage>' +
      '    <div class="smp-sheet-art" data-smp-art-wrap>' +
      '      <img data-smp-art-lg alt=""/>' +
      '      <video data-smp-video-lg muted loop playsinline webkit-playsinline></video>' +
      "    </div>" +
      '    <div class="smp-swipe-hint" data-smp-swipe-hint>Swipe art for next · swipe down to collapse</div>' +
      "  </div>" +
      '  <div class="smp-sheet-body">' +
      '    <div class="smp-meta-row">' +
      '      <div class="smp-meta-text">' +
      '        <button type="button" class="smp-sheet-title smp-nav-link smp-marquee" data-smp-title-lg data-smp-nav="album"><span class="smp-marquee-inner">—</span></button>' +
      '        <button type="button" class="smp-sheet-sub smp-nav-link smp-marquee" data-smp-sub-lg data-smp-nav="artist"><span class="smp-marquee-inner"></span></button>' +
      '        <div class="smp-sheet-now" data-smp-now-lg hidden></div>' +
      '        <div class="smp-sheet-next" data-smp-upnext-lg hidden></div>' +
      "      </div>" +
      '      <button type="button" class="smp-like-btn" data-smp-fav aria-label="Favorite">♡</button>' +
      "    </div>" +
      '    <div class="smp-seek" data-smp-seek hidden>' +
      '      <input type="range" min="0" max="1000" value="0" data-smp-seek-range aria-label="Seek"/>' +
      '      <div class="smp-seek-times"><span data-smp-tcur>0:00</span><span data-smp-tdur>—:——</span></div>' +
      "    </div>" +
      '    <div class="smp-sheet-controls">' +
      '      <button type="button" class="smp-mode-btn" data-smp-play-mode aria-label="Off · Straight play" title="Off · Straight play">⇉</button>' +
      '      <button type="button" data-smp-prev aria-label="Previous"><span class="smp-ico" aria-hidden="true">⏮</span></button>' +
      '      <button type="button" class="smp-main" data-smp-toggle aria-label="Play/Pause"><span class="smp-ico" aria-hidden="true">▶</span></button>' +
      '      <button type="button" data-smp-next aria-label="Next"><span class="smp-ico" aria-hidden="true">⏭</span></button>' +
      '      <button type="button" class="smp-queue-btn" data-smp-queue-toggle aria-label="Up next">☰</button>' +
      "    </div>" +
      '    <div class="smp-lyrics" data-smp-lyrics hidden>' +
      '      <div class="smp-lyrics-status" data-smp-lyrics-status>Lyrics unavailable</div>' +
      '      <div class="smp-lyrics-scroll" data-smp-lyrics-scroll></div>' +
      "    </div>" +
      '    <div class="smp-queue-panel" data-smp-queue-panel hidden></div>' +
      '    <div class="smp-info-panel" data-smp-info-panel hidden></div>' +
      "  </div>" +
      "  </div>" +
      "</div>" +
      '<div class="smp-video-fs" data-smp-video-fs hidden>' +
      '  <video data-smp-video-fs-el muted playsinline webkit-playsinline></video>' +
      '  <button type="button" class="smp-video-fs-close" data-smp-video-fs-close aria-label="Exit fullscreen">✕</button>' +
      "</div>";
    var mount = host || document.getElementById("musicCatalog") || document.body;
    mount.appendChild(root);
    this.root = root;
    this.audio = root.querySelector("[data-smp-audio]");
    this.video = root.querySelector("[data-smp-video]");
    this.videoLg = root.querySelector("[data-smp-video-lg]");
    this._wire();
    this._wireViewport();
    this._syncHost();
    return this;
  };

  Player.prototype._syncViewport = function () {
    if (!this.root) return;
    var sheet = this.root.querySelector("[data-smp-sheet]");
    if (!sheet) return;
    var vv = window.visualViewport;
    var h = vv && vv.height ? vv.height : window.innerHeight;
    var w = vv && vv.width ? vv.width : window.innerWidth;
    if (!h || !w) {
      h = window.innerHeight;
      w = window.innerWidth;
    }
    /* Prefer layout viewport when visualViewport is smaller due to transient
       browser chrome; never exceed the usable layout size. */
    var layoutH = window.innerHeight || h;
    var layoutW = window.innerWidth || w;
    if (layoutH > 0) h = Math.min(h, layoutH);
    if (layoutW > 0) w = Math.min(w, layoutW);
    /* If sheet is trapped in #musicCatalog (transform containing-block), size
       to the catalog's client box so we don't overflow/clip controls. */
    var catalog = document.getElementById("musicCatalog");
    if (catalog && catalog.contains(this.root)) {
      var ch = catalog.clientHeight;
      var cw = catalog.clientWidth;
      if (ch > 40) h = Math.min(h, ch);
      if (cw > 40) w = Math.min(w, cw);
    }
    sheet.style.setProperty("--smp-vh", h + "px");
    sheet.style.setProperty("--smp-vw", w + "px");
    var landscape = w > h;
    var short = h < 640;
    var hasVideo = this.root.classList.contains("has-video");
    var art;
    // Spotify-like: art dominates upper viewport; leave room for bottom-weighted chrome
    if (landscape) {
      art = Math.min(h * 0.78, w * 0.4, short ? 210 : 300);
    } else if (hasVideo) {
      /* 16:9 frame width — height follows aspect-ratio in CSS */
      art = Math.min(w * 0.92, h * 0.44 * (16 / 9), 560);
    } else if (h < 700) {
      art = Math.min(w * 0.86, h * 0.4, 320);
    } else {
      art = Math.min(w * 0.88, h * 0.46, 420);
    }
    sheet.style.setProperty("--smp-art", Math.round(art) + "px");
    sheet.dataset.orient = landscape ? "landscape" : "portrait";
    sheet.dataset.short = short ? "1" : "0";
    try {
      document.documentElement.style.setProperty("--music-vh", h + "px");
      document.documentElement.style.setProperty("--music-vw", w + "px");
    } catch (e) {}
  };

  Player.prototype._wireViewport = function () {
    if (this._vpWired) return;
    this._vpWired = true;
    var self = this;
    var tick = function () {
      self._syncViewport();
    };
    window.addEventListener("resize", tick, { passive: true });
    window.addEventListener("orientationchange", function () {
      setTimeout(tick, 60);
      setTimeout(tick, 300);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", tick, { passive: true });
    }
    tick();
  };

  Player.prototype._wire = function () {
    var self = this;
    var root = this.root;
    root.querySelectorAll("[data-smp-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        self.toggle();
      });
    });
    root.querySelectorAll("[data-smp-stop]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        self.stop();
      });
    });
    root.querySelectorAll("[data-smp-prev]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        self.prev();
      });
    });
    root.querySelectorAll("[data-smp-next]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        self.next();
      });
    });
    var expand = root.querySelector("[data-smp-expand]");
    if (expand) {
      expand.addEventListener("click", function () {
        self.setExpanded(true);
      });
    }
    var meta = root.querySelector(".smp-meta");
    if (meta) {
      meta.addEventListener("click", function () {
        self.setExpanded(true);
      });
    }
    root.querySelectorAll("[data-smp-fav]").forEach(function (favBtn) {
      if (favBtn.__smpFavWired) return;
      favBtn.__smpFavWired = true;
      favBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        self._toggleFav();
      });
    });
    var collapse = root.querySelector("[data-smp-collapse]");
    if (collapse) {
      collapse.addEventListener("click", function () {
        self.setExpanded(false);
      });
    }
    root.querySelectorAll("[data-smp-dial-prev]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        // Same path as transport / swipe — never a separate dial-only shortcut.
        self.prev();
      });
    });
    root.querySelectorAll("[data-smp-dial-next]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        self.next();
      });
    });
    var share = root.querySelector("[data-smp-share]");
    if (share) {
      share.addEventListener("click", function (e) {
        e.stopPropagation();
        self._share();
      });
    }
    var qbtn = root.querySelector("[data-smp-queue-toggle]");
    if (qbtn) {
      qbtn.addEventListener("click", function (e) {
        e.stopPropagation();
        self._toggleQueuePanel();
      });
    }
    var seek = root.querySelector("[data-smp-seek-range]");
    if (seek && !this._seekWired) {
      this._seekWired = true;
      seek.addEventListener("input", function () {
        if (self.state.source !== "listen" || !self.audio.duration) return;
        var t = (Number(seek.value) / 1000) * self.audio.duration;
        try {
          self.audio.currentTime = t;
        } catch (e) {}
      });
      this.audio.addEventListener("timeupdate", function () {
        self._onTimeUpdate();
      });
    }
    this._wireSwipe(root.querySelector("[data-smp-stage]"));
    this._wireSheetDismiss(root.querySelector("[data-smp-sheet]"));
    this._wireDockGestures(root.querySelector("[data-smp-dock]"));
    this._wireMediaSession();
    this._wireBackgroundKeepAlive();
    if (typeof this._wireUxExtras === "function") this._wireUxExtras();
    this.audio.addEventListener("ended", function () {
      self._wantPlaying = false;
      self.state.playing = false;
      self._syncPlayButtons();
      self._syncMediaSession();
      try {
        if (window.SDMusicTaste && self.state.id) {
          window.SDMusicTaste.recordComplete({
            source: self.state.source,
            id: self.state.id,
            title: self.state.title,
            subtitle: self.state.subtitle,
            artwork: self.state.artwork,
            genre: self.state.genre,
            artist: self.state.subtitle,
            station: self.state.station,
            videoId: self.state.source === "listen" ? self.state.id : "",
          });
        }
      } catch (e) {}
      self._tastePlayStarted = 0;
      if (self.state.source === "radio" && typeof self._radioOnEnded === "function") {
        self._radioOnEnded();
      } else if (typeof self._handlers.onEnded === "function") {
        self._handlers.onEnded();
      }
      self._schedulePauseIdle();
    });
    this.audio.addEventListener("play", function () {
      self._wantPlaying = true;
      self.state.playing = true;
      self._syncPlayButtons();
      self._clearPauseIdle();
      self._claimMediaSession({ releaseTv: true });
    });
    this.audio.addEventListener("pause", function () {
      // Browser / OS may pause on leave-app, screen-off, TV mute churn, or freeze —
      // never treat as user pause while we still intend to play. Nudge play immediately
      // without re-entering releaseTv (that was pausing Music again).
      if (self._wantPlaying) {
        if (self._switchingTrack || !self.audio || !self.audio.src) {
          self._syncMediaSession();
          return;
        }
        try {
          if (window.SDMusicTvAudio && typeof window.SDMusicTvAudio.setFocus === "function") {
            window.SDMusicTvAudio.setFocus("music", "pause-resume");
          }
        } catch (eF) {}
        self._nudgePlayIfWanted("pause-event");
        // Metadata only — do not releaseTv/pause #v again (cascade pause glitch).
        self._claimMediaSession({ releaseTv: false, skipKicks: true });
        setTimeout(function () {
          if (!self._wantPlaying || !self.audio) return;
          if (!self.audio.paused) {
            self._syncMediaSession();
            return;
          }
          self._nudgePlayIfWanted("pause-50");
          self._syncMediaSession();
        }, 50);
        setTimeout(function () {
          if (!self._wantPlaying || !self.audio || !self.audio.paused) return;
          self._nudgePlayIfWanted("pause-250");
          self._syncMediaSession();
        }, 250);
        setTimeout(function () {
          if (!self._wantPlaying || !self.audio || !self.audio.paused) return;
          self._nudgePlayIfWanted("pause-900");
          self._syncMediaSession();
        }, 900);
        return;
      }
      self.state.playing = false;
      self._syncPlayButtons();
      self._syncMediaSession();
      self._schedulePauseIdle();
    });
  };

  Player.prototype._wireSheetDismiss = function (sheet) {
    if (!sheet || sheet.__smpDismiss) return;
    sheet.__smpDismiss = true;
    var self = this;
    var st = { active: false, x0: 0, y0: 0 };
    var onDown = function (ev) {
      if (!self.state.expanded) return;
      var t = ev.touches ? ev.touches[0] : ev;
      // Only start from top chrome / art — not scrubber/controls
      var el = ev.target;
      if (
        el &&
        el.closest &&
        el.closest(
          ".smp-sheet-controls, .smp-seek, .smp-lyrics, .smp-queue-panel, .smp-info-panel, input, button"
        )
      ) {
        return;
      }
      st.active = true;
      st.x0 = t.clientX;
      st.y0 = t.clientY;
    };
    var onUp = function (ev) {
      if (!st.active) return;
      st.active = false;
      var t = ev.changedTouches ? ev.changedTouches[0] : ev;
      var dx = t.clientX - st.x0;
      var dy = t.clientY - st.y0;
      if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.15) {
        self.setExpanded(false);
      }
    };
    sheet.addEventListener("pointerdown", onDown, { passive: true });
    sheet.addEventListener("pointerup", onUp, { passive: true });
    sheet.addEventListener("touchstart", onDown, { passive: true });
    sheet.addEventListener("touchend", onUp, { passive: true });
  };

  Player.prototype._absArtUrl = function (url) {
    if (!url) return "";
    try {
      return new URL(url, location.href).href;
    } catch (e) {
      return url;
    }
  };

  Player.prototype._claimMediaSession = function (opts) {
    opts = opts || {};
    var releaseTv = opts.releaseTv !== false;
    try {
      window.__sdMusicMediaActive = true;
      window.__sdMusicHoldsTv = true;
      window.__sdMediaSessionOwner = "music";
      document.documentElement.dataset.sdMediaSessionOwner = "music";
    } catch (e) {}
    // Only touch #v on first claim / explicit release — heartbeat must not re-pause TV
    // (that cascades into Music pause on Chrome Android).
    if (releaseTv) {
      try {
        if (window.SDFeatures && typeof window.SDFeatures.releaseTvMediaSessionForMusic === "function") {
          window.SDFeatures.releaseTvMediaSessionForMusic();
        }
      } catch (e2) {}
    }
    this._wireMediaSession();
    this._ensureSilentKeepAlive();
    this._nudgePlayIfWanted("claim");
    this._syncMediaSession();
    this._startMediaSessionHeartbeat();
    // Kick MediaStyle while document is still visible (metadata only — no TV play/pause).
    var self = this;
    if (!opts.skipKicks) {
      [50, 200, 500].forEach(function (ms) {
        setTimeout(function () {
          try {
            if (!self._wantPlaying && !(self.audio && !self.audio.paused && self.audio.src)) return;
            self._nudgePlayIfWanted("claim-kick");
            self._wireMediaSession();
            self._syncMediaSession();
          } catch (eK) {}
        }, ms);
      });
    }
  };

  /** Silent play nudge when user intent is playing but element unexpectedly paused. */
  Player.prototype._nudgePlayIfWanted = function (reason) {
    try {
      if (!this._wantPlaying || this._switchingTrack) return false;
      if (!this.audio || !this.audio.src) return false;
      if (!this.audio.paused) return true;
      this._ensureSilentKeepAlive();
      var p = this.audio.play();
      if (p && typeof p.catch === "function") p.catch(function () {});
      return true;
    } catch (e) {
      return false;
    }
  };

  Player.prototype._startMediaSessionHeartbeat = function () {
    var self = this;
    if (this._msHbTimer) return;
    this._msHbTimer = setInterval(function () {
      try {
        if (!self._wantPlaying && !(self.audio && !self.audio.paused && self.audio.src)) {
          if (self._msHbTimer) {
            clearInterval(self._msHbTimer);
            self._msHbTimer = null;
          }
          return;
        }
        // Re-assert ownership metadata only — do NOT releaseTv/pause #v (pause glitch).
        window.__sdMusicMediaActive = true;
        window.__sdMusicHoldsTv = true;
        window.__sdMediaSessionOwner = "music";
        self._nudgePlayIfWanted("heartbeat");
        self._wireMediaSession();
        self._syncMediaSession();
      } catch (e) {}
    }, 1200);
  };

  Player.prototype._stopMediaSessionHeartbeat = function () {
    if (this._msHbTimer) {
      clearInterval(this._msHbTimer);
      this._msHbTimer = null;
    }
  };

  Player.prototype._releaseMediaSession = function () {
    this._stopMediaSessionHeartbeat();
    try {
      window.__sdMusicMediaActive = false;
      window.__sdMusicHoldsTv = false;
    } catch (e) {}
    try {
      if (this._silentOsc) {
        try {
          this._silentOsc.stop();
        } catch (eO) {}
        this._silentOsc = null;
      }
      if (this._silentCtx) {
        try {
          this._silentCtx.close();
        } catch (eC) {}
        this._silentCtx = null;
        this._silentGain = null;
      }
    } catch (eS) {}
    try {
      if (navigator.mediaSession) {
        navigator.mediaSession.playbackState = "none";
        navigator.mediaSession.metadata = null;
      }
    } catch (e) {}
    // Hand session back to TV dynamically (same focus switch as audio crossfade).
    try {
      if (window.SDFeatures && typeof window.SDFeatures.reclaimMediaSessionForTv === "function") {
        window.SDFeatures.reclaimMediaSessionForTv(true);
      } else if (window.SDFeatures && typeof window.SDFeatures.syncMediaSession === "function") {
        window.__sdMediaSessionOwner = "tv";
        window.SDFeatures.syncMediaSession(true);
      }
    } catch (e) {}
  };

  Player.prototype._syncMediaSession = function () {
    if (!("mediaSession" in navigator)) return;
    if (!this._wantPlaying && !(this.audio && !this.audio.paused && this.audio.src)) {
      // Still publish paused state if a track is loaded in the dock (keeps Music owner).
      if (!(this.audio && this.audio.src && this.root && this.root.classList.contains("show") && this.state && this.state.id)) {
        return;
      }
    }
    try {
      // If user still wants play but element was paused by TV focus churn, nudge first.
      if (this._wantPlaying && this.audio && this.audio.src && this.audio.paused && !this._switchingTrack) {
        this._nudgePlayIfWanted("sync");
      }
      window.__sdMusicMediaActive = true;
      window.__sdMusicHoldsTv = true;
      window.__sdMediaSessionOwner = "music";
      try {
        document.documentElement.dataset.sdMediaSessionOwner = "music";
      } catch (eD) {}
      var nowLine = formatNowLine(this.state.now);
      var title =
        (this.state.now && this.state.now.title) ||
        this.state.title ||
        nowLine ||
        "Music";
      var artist =
        (this.state.now && this.state.now.artist) || this.state.subtitle || "StepDaddy Music";
      // Prefer song title in metadata title (not station/album dump) for Android MediaStyle.
      if (this.state.source === "radio" && this.state.now && this.state.now.title) {
        title = this.state.now.title;
        if (this.state.now.artist) artist = this.state.now.artist;
      }
      var album =
        this.state.albumTitle ||
        (this.state.source === "radio" ? this.state.title || "Radio" : this.state.source === "listen" ? "Listen" : "Music");
      var art = this._absArtUrl(this.state.artwork);
      var artwork = [];
      if (art && !/^data:/i.test(art)) {
        artwork = [
          { src: art, sizes: "96x96", type: "image/jpeg" },
          { src: art, sizes: "256x256", type: "image/jpeg" },
          { src: art, sizes: "512x512", type: "image/jpeg" },
        ];
      } else if (art) {
        artwork = [{ src: art, sizes: "512x512", type: "image/png" }];
      }
      navigator.mediaSession.metadata = new MediaMetadata({
        title: String(title).slice(0, 120),
        artist: String(artist).slice(0, 80),
        album: String(album).slice(0, 80),
        artwork: artwork,
      });
      // Intent wins: never publish paused while _wantPlaying (OS would demand Play tap).
      var playing = !!this._wantPlaying || !!(this.audio && !this.audio.paused);
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
      try {
        document.title = String(title).slice(0, 80) + " — StepDaddyLiveHD";
      } catch (eT) {}
      if (
        this.state.source === "listen" &&
        this.audio &&
        isFinite(this.audio.duration) &&
        this.audio.duration > 0 &&
        isFinite(this.audio.currentTime)
      ) {
        try {
          navigator.mediaSession.setPositionState({
            duration: this.audio.duration,
            playbackRate: this.audio.playbackRate || 1,
            position: Math.min(Math.max(0, this.audio.currentTime), this.audio.duration),
          });
        } catch (ePos) {}
      }
      this._startMediaSessionHeartbeat();
    } catch (e) {}
  };

  Player.prototype._wireMediaSession = function () {
    if (!("mediaSession" in navigator)) return;
    var self = this;
    var bind = function (name, fn) {
      try {
        navigator.mediaSession.setActionHandler(name, fn);
      } catch (e) {}
    };
    bind("play", function () {
      self._wantPlaying = true;
      if (self.audio) self.audio.play().catch(function () {});
      self._claimMediaSession();
    });
    bind("pause", function () {
      self._wantPlaying = false;
      if (self.audio) self.audio.pause();
      self.state.playing = false;
      self._syncPlayButtons();
      self._syncMediaSession();
    });
    bind("stop", function () {
      self._wantPlaying = false;
      self.stop();
    });
    bind("previoustrack", function () {
      self.prev();
      self._claimMediaSession();
    });
    bind("nexttrack", function () {
      self.next();
      self._claimMediaSession();
    });
    try {
      bind("seekto", function (details) {
        if (self.state.source !== "listen" || !self.audio || !isFinite(self.audio.duration)) return;
        if (details && typeof details.seekTime === "number") {
          self.audio.currentTime = Math.max(0, Math.min(self.audio.duration, details.seekTime));
          self._syncMediaSession();
        }
      });
    } catch (e) {}
    this._msWired = true;
  };

  Player.prototype._ensureSilentKeepAlive = function () {
    // Tiny WebAudio tone (near-silent) helps some Android Chrome builds keep the media pipeline
    // alive after Home / app-switch. No-op if AudioContext is unavailable or already running.
    if (this._silentCtx) {
      try {
        if (this._silentCtx.state === "suspended") this._silentCtx.resume();
      } catch (e) {}
      return;
    }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = new AC();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      gain.gain.value = 0.00001;
      osc.frequency.value = 20;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      this._silentCtx = ctx;
      this._silentOsc = osc;
      this._silentGain = gain;
      if (ctx.state === "suspended") ctx.resume().catch(function () {});
    } catch (e) {}
  };

  Player.prototype._wireBackgroundKeepAlive = function () {
    if (this._bgKeepWired) return;
    this._bgKeepWired = true;
    var self = this;
    var pauseTvForMusic = function () {
      try {
        window.__sdMusicMediaActive = true;
        window.__sdMusicHoldsTv = true;
        var v = document.getElementById("v");
        if (!v) return;
        try {
          if (!v.dataset.sdMutedForMusic) {
            v.dataset.sdMutedForMusic = v.muted ? "was-muted" : "1";
          }
          v.muted = true;
          v.dataset.sdSoftHoldForMusic = "0";
          v.dataset.sdPausedForMusic = "1";
        } catch (eM) {}
        if (!v.paused) {
          try {
            v.pause();
          } catch (eP) {}
        }
      } catch (e) {}
    };
    var resumeIfNeeded = function (reason) {
      if (!self._wantPlaying || !self.audio || !self.audio.src) return;
      try {
        if (window.SDMusicTvAudio && typeof window.SDMusicTvAudio.setFocus === "function") {
          window.SDMusicTvAudio.setFocus("music", reason || "bg");
        }
      } catch (e) {}
      pauseTvForMusic();
      self._ensureSilentKeepAlive();
      self._nudgePlayIfWanted(reason || "bg");
      // Assert session without re-releaseTv churn.
      self._claimMediaSession({ releaseTv: false, skipKicks: true });
    };
    document.addEventListener(
      "visibilitychange",
      function () {
        if (document.hidden || document.visibilityState === "hidden") {
          resumeIfNeeded("visibility-hidden");
          setTimeout(function () {
            resumeIfNeeded("visibility-hidden-deferred");
          }, 80);
          setTimeout(function () {
            resumeIfNeeded("visibility-hidden-mid");
          }, 300);
          setTimeout(function () {
            resumeIfNeeded("visibility-hidden-late");
          }, 800);
        } else {
          self._syncPlayButtons();
          self._claimMediaSession({ releaseTv: false, skipKicks: true });
          self._onTimeUpdate();
          if (self._wantPlaying) resumeIfNeeded("visibility-visible");
        }
      },
      { passive: true }
    );
    window.addEventListener(
      "pagehide",
      function (ev) {
        // persisted=true → bfcache; still nudge play so leave-browser doesn't stick paused.
        resumeIfNeeded(ev && ev.persisted ? "pagehide-persisted" : "pagehide");
        setTimeout(function () {
          resumeIfNeeded("pagehide-deferred");
        }, 100);
      },
      { passive: true }
    );
    window.addEventListener(
      "pageshow",
      function (ev) {
        if (self._wantPlaying) resumeIfNeeded(ev && ev.persisted ? "pageshow-persisted" : "pageshow");
      },
      { passive: true }
    );
    // Page Lifecycle API (Chrome Android): freeze can occur on screen-off / background.
    document.addEventListener(
      "freeze",
      function () {
        resumeIfNeeded("freeze");
      },
      { passive: true }
    );
    document.addEventListener(
      "resume",
      function () {
        if (self._wantPlaying) resumeIfNeeded("lifecycle-resume");
      },
      { passive: true }
    );
    // Periodic nudge while backgrounded — Media Session alone is not always enough on Samsung Chrome.
    if (!this._bgKeepTimer) {
      this._bgKeepTimer = setInterval(function () {
        if (!self._wantPlaying) return;
        if (!(document.hidden || document.visibilityState === "hidden")) return;
        resumeIfNeeded("bg-interval");
      }, 1200);
    }
    // Ensure audio attrs for mobile WebView / Chrome
    try {
      this.audio.setAttribute("playsinline", "");
      this.audio.setAttribute("webkit-playsinline", "");
      this.audio.setAttribute("x-webkit-airplay", "allow");
    } catch (e) {}
  };

  Player.prototype._wireSwipe = function (stage) {
    if (!stage || stage.__smpSwipe) return;
    stage.__smpSwipe = true;
    var self = this;
    var art = stage.querySelector("[data-smp-art-wrap]") || stage;
    var gesture = {
      active: false,
      x0: 0,
      y0: 0,
      t0: 0,
      committed: false,
      width: 320,
      pointerId: null,
    };

    var resetArt = function () {
      if (art) {
        art.style.transform = "";
        art.style.transition = "";
      }
      stage.classList.remove("swiping");
      var hint = self.root && self.root.querySelector("[data-smp-dial-hint]");
      if (hint) hint.style.removeProperty("--smp-dial-nudge");
    };

    var onDown = function (ev) {
      if (!self.state.expanded) return;
      var el = ev.target;
      // Horizontal gestures only from artwork — not scrubber/lyrics/buttons/queue.
      if (
        el &&
        el.closest &&
        el.closest(
          ".smp-sheet-controls, .smp-seek, .smp-lyrics, .smp-queue-panel, .smp-info-panel, input, button"
        )
      ) {
        return;
      }
      if (art && el && !art.contains(el) && el !== art) return;
      var t = ev.touches ? ev.touches[0] : ev;
      gesture.active = true;
      gesture.committed = false;
      gesture.x0 = t.clientX;
      gesture.y0 = t.clientY;
      gesture.t0 = Date.now();
      gesture.pointerId = ev.pointerId != null ? ev.pointerId : null;
      gesture.width = (art && art.getBoundingClientRect().width) || window.innerWidth || 320;
      stage.classList.add("swiping");
      if (art) art.style.transition = "none";
    };
    var onMove = function (ev) {
      if (!gesture.active || gesture.committed) return;
      if (gesture.pointerId != null && ev.pointerId != null && ev.pointerId !== gesture.pointerId) return;
      var t = ev.touches ? ev.touches[0] : ev;
      var dx = t.clientX - gesture.x0;
      var dy = t.clientY - gesture.y0;
      if (art) {
        if (Math.abs(dx) >= Math.abs(dy)) {
          art.style.transform = "translateX(" + dx + "px)";
          if (ev.cancelable && Math.abs(dx) > 12) ev.preventDefault();
        } else if (dy > 0) {
          art.style.transform = "translateY(" + Math.min(dy * 0.55, 140) + "px)";
        }
      }
      var hint = self.root && self.root.querySelector("[data-smp-dial-hint]");
      if (hint) hint.style.setProperty("--smp-dial-nudge", dx * 0.08 + "px");
    };
    var onUp = function (ev) {
      if (!gesture.active) return;
      if (gesture.pointerId != null && ev.pointerId != null && ev.pointerId !== gesture.pointerId) return;
      gesture.active = false;
      var t = ev.changedTouches ? ev.changedTouches[0] : ev;
      var dx = t.clientX - gesture.x0;
      var dy = t.clientY - gesture.y0;
      var dt = Math.max(16, Date.now() - gesture.t0);
      var vx = Math.abs(dx) / dt;
      var threshold = Math.max(48, gesture.width * 0.3);
      var velocityOk = vx > 0.55 && Math.abs(dx) > 36;

      // Swipe player/artwork downward → collapse to mini (not stop).
      if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.15) {
        resetArt();
        self.setExpanded(false);
        return;
      }

      var horizontal =
        Math.abs(dx) >= Math.abs(dy) * 1.05 && (Math.abs(dx) >= threshold || velocityOk);
      if (horizontal && !gesture.committed) {
        gesture.committed = true; // one track change per gesture
        if (art) {
          art.style.transition = "transform 0.18s ease-out";
          art.style.transform = "translateX(" + (dx < 0 ? -gesture.width : gesture.width) + "px)";
        }
        var goNext = dx < 0;
        setTimeout(function () {
          resetArt();
          // Same path as transport buttons.
          if (goNext) self.next();
          else self.prev();
        }, 160);
        return;
      }

      if (art) {
        art.style.transition = "transform 0.2s ease-out";
        art.style.transform = "translateX(0)";
      }
      setTimeout(resetArt, 200);
    };
    // Bind on artwork when present so scrubber/lyrics never start the gesture.
    var target = art || stage;
    target.addEventListener("pointerdown", onDown);
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
    target.addEventListener("touchstart", onDown, { passive: true });
    target.addEventListener("touchmove", onMove, { passive: false });
    target.addEventListener("touchend", onUp);
  };

  /**
   * Mini-dock gestures — global (any host: /tv, /music, /vod, party):
   *   swipe up → expand sheet
   *   swipe down → no-op while music active (Stop/Close only; no accidental dismiss)
   *   swipe left / right → next / previous via player.next()/prev() (same as buttons)
   * Axis-lock + threshold so dock swipes don't fight page scroll.
   * Pause+idle (~5.5s) auto-hides when floating outside an open Music sheet.
   */
  Player.prototype._clearPauseIdle = function () {
    if (this._pauseIdleTimer) {
      clearTimeout(this._pauseIdleTimer);
      this._pauseIdleTimer = null;
    }
  };

  Player.prototype._tvDockPausedIdleEligible = function () {
    var audioPaused = !!(this.audio && this.audio.paused);
    return !!(
      this.root &&
      this.state.source &&
      this.root.classList.contains("show") &&
      !this.state.expanded &&
      !this._musicSheetOpen() &&
      audioPaused
    );
  };

  Player.prototype._schedulePauseIdle = function () {
    var self = this;
    this._clearPauseIdle();
    if (!this._tvDockPausedIdleEligible()) return;
    this._pauseIdleTimer = setTimeout(function () {
      self._pauseIdleTimer = null;
      if (!self._tvDockPausedIdleEligible()) return;
      self.stop();
    }, DOCK_PAUSE_IDLE_MS);
  };

  Player.prototype._bumpPauseIdle = function () {
    if (this._tvDockPausedIdleEligible()) this._schedulePauseIdle();
    else this._clearPauseIdle();
  };

  Player.prototype._wireDockGestures = function (dock) {
    if (!dock || dock.__smpDockGestures) return;
    dock.__smpDockGestures = true;
    var self = this;
    var LOCK_PX = 10;
    var SWIPE_PX = 48;
    var st = this._dockGesture;

    function pt(ev) {
      if (ev.touches && ev.touches.length) return ev.touches[0];
      if (ev.changedTouches && ev.changedTouches.length) return ev.changedTouches[0];
      return ev;
    }

    function isControl(el) {
      return !!(
        el &&
        el.closest &&
        el.closest(".smp-controls button, [data-smp-toggle], [data-smp-prev], [data-smp-next], [data-smp-stop]")
      );
    }

    function dockGestureActive() {
      // Shared dock — works on /tv, /music, /vod, party, wherever mini dock is visible.
      return !!(self.root && self.root.classList.contains("show") && !self.state.expanded);
    }

    function reset() {
      st.active = false;
      st.axis = null;
      st.fromBtn = false;
      st.pointerId = null;
    }

    function onDown(ev) {
      if (!dockGestureActive()) return;
      if (ev.touches && ev.touches.length !== 1) return;
      if (ev.type.indexOf("touch") === 0 && st.usingPointer) return;
      if (ev.type.indexOf("pointer") === 0) st.usingPointer = true;
      var t = pt(ev);
      if (!t) return;
      st.active = true;
      st.axis = null;
      st.x0 = t.clientX;
      st.y0 = t.clientY;
      st.fromBtn = isControl(ev.target);
      st.pointerId = ev.pointerId != null ? ev.pointerId : null;
      self._bumpPauseIdle();
    }

    function onMove(ev) {
      if (!st.active) return;
      if (ev.type.indexOf("touch") === 0 && st.usingPointer) return;
      if (st.pointerId != null && ev.pointerId != null && ev.pointerId !== st.pointerId) return;
      var t = pt(ev);
      if (!t) return;
      var dx = t.clientX - st.x0;
      var dy = t.clientY - st.y0;
      if (st.axis == null) {
        if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return;
        st.axis = Math.abs(dx) > Math.abs(dy) * 1.05 ? "x" : "y";
      }
      if (ev.cancelable) ev.preventDefault();
    }

    function onUp(ev) {
      if (!st.active) return;
      if (ev.type.indexOf("touch") === 0 && st.usingPointer) return;
      if (st.pointerId != null && ev.pointerId != null && ev.pointerId !== st.pointerId) return;
      var axis = st.axis;
      var fromBtn = st.fromBtn;
      var t = pt(ev);
      var dx = t ? t.clientX - st.x0 : 0;
      var dy = t ? t.clientY - st.y0 : 0;
      reset();
      if (ev.type.indexOf("pointer") === 0) {
        setTimeout(function () {
          st.usingPointer = false;
        }, 0);
      }
      if (!dockGestureActive()) return;
      if (!axis) return;
      if (fromBtn && Math.abs(dx) < SWIPE_PX && Math.abs(dy) < SWIPE_PX) return;
      var now = Date.now();
      if (now - st.lastCommit < DOCK_GESTURE_DEBOUNCE_MS) return;
      if (axis === "y") {
        if (Math.abs(dy) < SWIPE_PX || Math.abs(dy) < Math.abs(dx) * 1.15) return;
        st.lastCommit = now;
        if (dy < 0) self.setExpanded(true);
        // Swipe down while music active → no action (explicit Stop/Close only).
        return;
      }
      if (axis === "x") {
        if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.15) return;
        st.lastCommit = now;
        if (dx < 0) self.next();
        else self.prev();
      }
    }

    dock.addEventListener("pointerdown", onDown);
    dock.addEventListener("pointermove", onMove);
    dock.addEventListener("pointerup", onUp);
    dock.addEventListener("pointercancel", onUp);
    dock.addEventListener("touchstart", onDown, { passive: true });
    dock.addEventListener("touchmove", onMove, { passive: false });
    dock.addEventListener("touchend", onUp, { passive: true });
    dock.addEventListener("touchcancel", onUp, { passive: true });
  };

  /**
   * True when a Listen/album/playlist/search context queue is active.
   * Dial must NEVER win while this is true.
   */
  Player.prototype._hasListenQueue = function () {
    // Explicit Radio source always owns dial — ignore stale Listen fields.
    if (this.state.source === "radio") return false;
    if (this.state.source === "listen") return true;
    var q = this.state.queue;
    if (Array.isArray(q) && q.length) {
      for (var i = 0; i < q.length; i++) {
        var t = q[i];
        if (t && (t.videoId || (t.source === "listen" && t.id))) return true;
      }
    }
    if (this.state.albumId || this.state.artistId) return true;
    return false;
  };

  /** Radio dial only when source is radio and no Listen queue context exists. */
  Player.prototype._useRadioDial = function () {
    if (this.state.source !== "radio") return false;
    if (this._hasListenQueue()) return false;
    return !!(this._dial && this._dial.list && this._dial.list.length);
  };

  Player.prototype._smartQueueNav = function (dir) {
    var self = this;
    // Never let smart-queue fall through into radio dial for Listen contexts.
    if (self._useRadioDial()) {
      if (self._radioNavByMode) self._radioNavByMode(dir < 0 ? -1 : 1);
      else self.tuneDial(dir < 0 ? -1 : 1);
      return true;
    }
    var SQ = window.SDMusicSmartQueue;
    if (!SQ || typeof SQ.ensureAndPick !== "function") return false;
    SQ.ensureAndPick({ dir: dir, source: "listen" }).then(function (res) {
      if (!res || res.index < 0) {
        // End of queue under Off / no soft-refill — stop, do not yank to Radio.
        if (dir === 0 || (self.state.playMode || "off") === "off") {
          try {
            if (self.audio) self.audio.pause();
          } catch (e) {}
          self.state.playing = false;
          self._wantPlaying = false;
          self._syncPlayButtons();
          self._syncMediaSession && self._syncMediaSession();
        }
        return;
      }
      if (self.state.source === "listen" && res.queue && res.queue.length) {
        self.state.queue = res.queue;
        self.state.queueIndex = res.index;
        var track = res.queue[res.index];
        if (track && track.videoId) {
          if (window.StepDaddyMusicListen && typeof window.StepDaddyMusicListen.playVideoId === "function") {
            window.StepDaddyMusicListen.playVideoId(track.videoId, res.queue);
            return;
          }
        }
      }
      if (dir < 0 && typeof self._handlers.onPrev === "function") self._handlers.onPrev();
      else if (dir >= 0 && typeof self._handlers.onNext === "function") self._handlers.onNext();
    });
    return true;
  };

  /**
   * Single transport API — buttons, dock swipe, expanded swipe, mediaSession
   * all bind to these. Radio dial is only used when source is Radio.
   * Prev 5s rule (Listen): >5s restarts current; ≤5s goes previous.
   */
  Player.prototype.prev = function () {
    if (!this._useRadioDial || !this._useRadioDial()) {
      if (this.state && this.state.source === "listen" && this.audio) {
        var ct = this.audio.currentTime || 0;
        if (ct > 5) {
          try {
            this.audio.currentTime = 0;
          } catch (e) {}
          try {
            if (window.SDMusicUnifiedQueue) window.SDMusicUnifiedQueue.persist();
          } catch (e2) {}
          return;
        }
      }
    }
    return this._navPrev();
  };

  Player.prototype.next = function () {
    return this._navNext();
  };

  Player.prototype._navPrev = function () {
    if (this._useRadioDial()) {
      if (this._radioNavByMode) this._radioNavByMode(-1);
      else this.tuneDial(-1);
      return;
    }
    if (typeof this._handlers.onPrev === "function") {
      this._handlers.onPrev();
      return;
    }
    if (this._hasListenQueue() || this.state.source === "listen") {
      this._smartQueueNav(-1);
      return;
    }
    // No Listen context and not radio → no-op (never invent a dial jump).
  };

  Player.prototype._navNext = function () {
    if (this._useRadioDial()) {
      if (this._radioNavByMode) this._radioNavByMode(1);
      else this.tuneDial(1);
      return;
    }
    if (typeof this._handlers.onNext === "function") {
      this._handlers.onNext();
      return;
    }
    if (this._hasListenQueue() || this.state.source === "listen") {
      this._smartQueueNav(1);
      return;
    }
  };

  Player.prototype.setDialList = function (list, currentId) {
    this._dial.list = Array.isArray(list) ? list.slice() : [];
    this._dial.index = -1;
    if (currentId) {
      this._dial.index = this._dial.list.findIndex(function (s) {
        return String(s.stationuuid) === String(currentId);
      });
    }
    this._syncDialHint();
    this._preloadNeighborArt();
  };

  Player.prototype.tuneDial = function (delta) {
    // Hard guard: dial retune is Radio-only. Listen/album queues must use next()/prev().
    if (this.state.source !== "radio") return;
    var list = this._dial.list;
    if (!list.length || !delta) return;
    var now = Date.now();
    if (now - this._swipe.lastTune < DIAL_DEBOUNCE_MS) return;
    this._swipe.lastTune = now;
    var idx = this._dial.index;
    if (idx < 0 && this.state.id) {
      idx = list.findIndex(function (s) {
        return String(s.stationuuid) === String(this.state.id);
      }.bind(this));
    }
    if (idx < 0) idx = 0;
    var next = (idx + delta) % list.length;
    if (next < 0) next += list.length;
    this._dial.index = next;
    var st = list[next];
    this._syncDialHint();
    this._preloadNeighborArt();
    if (typeof window.StepDaddyMusicRadio === "object" && typeof window.StepDaddyMusicRadio.playStation === "function") {
      window.StepDaddyMusicRadio.playStation(st);
      return;
    }
    if (typeof this._handlers.onDialTune === "function") {
      this._handlers.onDialTune(st, next);
    }
  };

  Player.prototype._syncDialHint = function () {
    if (!this.root) return;
    var st =
      this._dial.index >= 0 && this._dial.list[this._dial.index]
        ? this._dial.list[this._dial.index]
        : this.state.station;
    var freqEl = this.root.querySelector("[data-smp-dial-freq]");
    var segEl = this.root.querySelector("[data-smp-dial-seg]");
    var pill = this.root.querySelector("[data-smp-band-pill]");
    var hint = this.root.querySelector("[data-smp-dial-hint]");
    var swipeHint = this.root.querySelector("[data-smp-swipe-hint]");
    var isRadio = this.state.source === "radio";
    if (hint) hint.hidden = !isRadio;
    if (swipeHint) {
      swipeHint.hidden = false;
      swipeHint.textContent = isRadio
        ? "Swipe art to retune · swipe down to collapse"
        : "Swipe art for next · swipe down to collapse";
    }
    var band = (st && (st.dial_segment || st.dial_band || st.band)) || this.state.band || "";
    var dial = (st && st.dial) || this.state.dial || "";
    var label = dial
      ? dial + (band && band !== "Internet" ? " " + String(band).toUpperCase() : "")
      : band === "Internet"
        ? "NET"
        : "—";
    if (freqEl) freqEl.textContent = label;
    if (segEl) {
      segEl.textContent = band ? String(band).toUpperCase() : "";
    }
    if (pill) {
      pill.textContent = band ? String(band).toUpperCase() : isRadio ? "RADIO" : "LISTEN";
      pill.dataset.band = String(band || (isRadio ? "radio" : "listen")).toLowerCase();
    }
    var ctx = this.root.querySelector("[data-smp-context-label]");
    if (ctx) {
      ctx.textContent = isRadio
        ? dial
          ? "Tuning " + label
          : "Playing from Radio"
        : this.state.albumTitle
          ? "Playing from album"
          : "Playing from Listen";
    }
  };

  Player.prototype._preloadNeighborArt = function () {
    var list = this._dial.list;
    var idx = this._dial.index;
    if (!list.length || idx < 0) return;
    [-1, 1].forEach(function (d) {
      var j = (idx + d + list.length) % list.length;
      var url = list[j] && list[j].favicon;
      if (!url) return;
      try {
        var img = new Image();
        img.referrerPolicy = "no-referrer";
        img.src = url;
      } catch (e) {}
    });
  };

  Player.prototype._setBtnIcon = function (btn, icon) {
    if (!btn) return;
    var ico = btn.querySelector(".smp-ico");
    if (ico) ico.textContent = icon;
    else btn.textContent = icon;
  };

  Player.prototype._syncPlayButtons = function () {
    if (!this.root) return;
    var label = this.state.playing ? "❚❚" : "▶";
    var self = this;
    this.root.querySelectorAll("[data-smp-toggle]").forEach(function (b) {
      self._setBtnIcon(b, label);
    });
    this.root.classList.toggle("is-playing", !!this.state.playing);
  };

  /** Keep prev/next icons + enabled state; stop always visible (never overwritten by up-next text). */
  Player.prototype._syncTransportButtons = function (canPrev, canNext) {
    if (!this.root) return;
    if (canPrev == null || canNext == null) {
      canPrev =
        typeof this._handlers.onPrev === "function" ||
        (this.state.source === "radio" && this._dial.list.length > 1);
      canNext =
        typeof this._handlers.onNext === "function" ||
        (this.state.source === "radio" && this._dial.list.length > 1);
    }
    var self = this;
    this.root.querySelectorAll("[data-smp-prev]").forEach(function (b) {
      b.hidden = false;
      b.disabled = !canPrev;
      self._setBtnIcon(b, "⏮");
    });
    this.root.querySelectorAll("[data-smp-next]").forEach(function (b) {
      // Transport only — never hide when metadata is empty (that was the Listen/stop clash).
      b.hidden = false;
      b.disabled = !canNext;
      self._setBtnIcon(b, "⏭");
    });
    this.root.querySelectorAll("[data-smp-stop]").forEach(function (b) {
      b.hidden = false;
      b.disabled = false;
      self._setBtnIcon(b, "■");
    });
  };

  Player.prototype._syncMuteBtn = function () {
    if (!this.root) return;
    var mute = this.root.querySelector("[data-smp-mute]");
    this._setBtnIcon(mute, this.state.muted || this.state.volume <= 0 ? "🔇" : "🔊");
  };

  Player.prototype._toggleMute = function () {
    this.state.muted = !this.state.muted;
    this.audio.muted = this.state.muted;
    this._syncMuteBtn();
  };

  Player.prototype._clearMedia = function () {
    try {
      if (this.hls) {
        this.hls.destroy();
        this.hls = null;
      }
    } catch (e) {}
    try {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
    } catch (e) {}
    [this.video, this.videoLg].forEach(function (v) {
      if (!v) return;
      try {
        v.pause();
        v.removeAttribute("src");
        v.load();
        v.classList.remove("show");
      } catch (e) {}
    });
    if (this.root) this.root.classList.remove("has-video");
    if (typeof this._exitVideoFullscreen === "function") this._exitVideoFullscreen(true);
    if (this._artTimer) {
      clearTimeout(this._artTimer);
      this._artTimer = null;
    }
  };

  Player.prototype._stopNp = function () {
    if (this._npTimer) {
      clearTimeout(this._npTimer);
      this._npTimer = null;
    }
    this._npInflight = false;
  };

  Player.prototype.setArtwork = function (url) {
    var src = url || FALLBACK_ART;
    if (!this.root) return;
    this.root.querySelectorAll("[data-smp-art], [data-smp-art-lg]").forEach(function (img) {
      img.src = src;
      img.onerror = function () {
        if (img.src !== FALLBACK_ART) img.src = FALLBACK_ART;
      };
    });
    var sheet = this.root.querySelector("[data-smp-sheet]");
    if (!sheet) return;
    var skinSrc = src && src !== FALLBACK_ART ? src : "";
    if (skinSrc) {
      sheet.style.setProperty("--smp-skin", 'url("' + String(skinSrc).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '")');
      sheet.classList.add("has-skin");
    } else {
      sheet.style.removeProperty("--smp-skin");
      sheet.classList.remove("has-skin");
    }
  };

  Player.prototype._setText = function (el, text) {
    if (!el) return;
    var inner = el.querySelector(".smp-marquee-inner");
    if (inner) inner.textContent = text == null ? "" : String(text);
    else el.textContent = text == null ? "" : String(text);
  };

  Player.prototype.setNowNext = function (meta) {
    meta = meta || {};
    this.state.now = meta.now || null;
    this.state.next = meta.next || null;
    var nowLine = formatNowLine(this.state.now);
    var nextLine = formatNowLine(this.state.next);
    if (!this.root) return;
    var self = this;
    this.root.querySelectorAll("[data-smp-now], [data-smp-now-lg]").forEach(function (el) {
      if (nowLine) {
        el.hidden = false;
        self._setText(el, "Now · " + nowLine);
      } else {
        el.hidden = true;
        self._setText(el, "");
      }
    });
    // Up-next metadata lines only — never touch transport [data-smp-next] buttons.
    this.root.querySelectorAll("[data-smp-upnext], [data-smp-upnext-lg]").forEach(function (el) {
      if (nextLine) {
        el.hidden = false;
        self._setText(el, "Next · " + nextLine);
      } else {
        el.hidden = true;
        self._setText(el, "");
      }
    });
    this._syncListenBtn();
    if (this._lyrics.visible) this._fetchLyrics();
    this._syncTransportButtons();
    this._syncMarquee();
    this._claimMediaSession();
  };

  Player.prototype.setExpanded = function (on) {
    this.state.expanded = !!on;
    if (!this.root) return;
    var sheet = this.root.querySelector("[data-smp-sheet]");
    if (sheet) sheet.hidden = !on;
    this.root.classList.toggle("expanded", !!on);
    if (on) {
      this._clearPauseIdle();
      this._syncViewport();
      this._syncDialHint();
      this._syncFavBtn();
      this._syncListenBtn();
      this._syncPlayModeBtn();
      this._syncMetaNav();
      this._syncMarquee();
      /* Laptop/wide: open Up Next beside art so landscape expanded isn't art+void. */
      try {
        var wide =
          window.matchMedia &&
          window.matchMedia("(min-width: 1024px) and (min-aspect-ratio: 1/1)").matches;
        if (wide && this.state.source === "listen") {
          var panel = this.root.querySelector("[data-smp-queue-panel]");
          if (panel && panel.hidden) {
            panel.hidden = false;
            if (typeof this._ensureQueueLiveUpdates === "function") this._ensureQueueLiveUpdates();
            if (typeof this._renderQueuePanel === "function") this._renderQueuePanel();
          }
        }
      } catch (eWideQ) {}
    } else {
      if (typeof this._exitVideoFullscreen === "function") this._exitVideoFullscreen(false);
      this._bumpPauseIdle();
    }
  };

  Player.prototype._scheduleVideoFade = function () {
    var self = this;
    if (this._artTimer) clearTimeout(this._artTimer);
    if (!this.state.videoUrl) return;
    this._artTimer = setTimeout(function () {
      self._startArtVideo();
    }, ART_TO_VIDEO_MS);
  };

  Player.prototype._startArtVideo = function () {
    var url = this.state.videoUrl;
    if (!url || !this.video) return;
    [this.video, this.videoLg].forEach(function (v) {
      if (!v) return;
      try {
        v.src = url;
        v.muted = true;
        v.loop = true;
        v.playsInline = true;
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
        v.classList.add("show");
      } catch (e) {}
    });
    this.root.classList.add("has-video");
  };

  Player.prototype._pollRadioNowPlaying = function () {
    var self = this;
    if (this.state.source !== "radio" || !this.state.id) return;
    if (this._npInflight) return;
    this._npInflight = true;
    var u = new URLSearchParams();
    u.set("station_uuid", this.state.id);
    if (this.state.streamUrl) u.set("url", this.state.streamUrl);
    fetch("/api/music/radio/nowplaying?" + u.toString(), { credentials: "same-origin" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        if (!data || self.state.source !== "radio") return;
        self.setNowNext({ now: data.now, next: data.next });
      })
      .catch(function () {})
      .finally(function () {
        self._npInflight = false;
        if (self.state.source === "radio" && self.state.id) {
          self._npTimer = setTimeout(function () {
            self._pollRadioNowPlaying();
          }, NP_POLL_MS);
        }
      });
  };

  Player.prototype.play = function (payload) {
    payload = payload || {};
    // Skip prior track if abandoning early
    try {
      if (
        this._tastePlayStarted &&
        this.state.id &&
        this.audio &&
        Date.now() - this._tastePlayStarted < 18000 &&
        this.audio.currentTime < 20 &&
        window.SDMusicTaste
      ) {
        window.SDMusicTaste.recordSkip({
          source: this.state.source,
          id: this.state.id,
          title: this.state.title,
          subtitle: this.state.subtitle,
          artwork: this.state.artwork,
          genre: this.state.genre,
          artist: this.state.subtitle,
          station: this.state.station,
          videoId: this.state.source === "listen" ? this.state.id : "",
        });
      }
    } catch (e) {}

    this.ensure();
    // Claim Music session BEFORE tearing down prior media so TV interval/header sync cannot
    // overwrite OS media controls during the track switch gap.
    this._switchingTrack = true;
    this._wantPlaying = true;
    try {
      window.__sdMusicMediaActive = true;
      window.__sdMusicHoldsTv = true;
      window.__sdMediaSessionOwner = "music";
    } catch (eOwn) {}
    try {
      if (window.SDFeatures && typeof window.SDFeatures.releaseTvMediaSessionForMusic === "function") {
        window.SDFeatures.releaseTvMediaSessionForMusic();
      }
    } catch (eRel) {}
    this._clearMedia();
    this._stopNp();
    this._switchingTrack = false;

    this.state.source = payload.source || "listen";
    this.state.id = payload.id || null;
    this.state.title = payload.title || "Playing";
    this.state.subtitle = payload.subtitle || "";
    this.state.artwork = payload.artwork || "";
    this.state.streamUrl = payload.streamUrl || payload.url || "";
    this.state.videoUrl = payload.videoUrl || "";
    this.state.hls = !!payload.hls;
    this.state.queue = payload.queue || null;
    this.state.queueIndex = payload.queueIndex != null ? payload.queueIndex : -1;
    // Radio play must not keep a prior Listen queue around for swipe/nav.
    if ((payload.source || "listen") === "radio") {
      this.state.queue = null;
      this.state.queueIndex = -1;
    }
    this.state.band = payload.band || "";
    this.state.dial = payload.dial || "";
    this.state.homepage = payload.homepage || "";
    this.state.genre = payload.genre || "";
    this.state.station = payload.station || null;
    this.state.albumId = payload.albumId || (payload.track && payload.track.albumId) || "";
    this.state.albumTitle = payload.albumTitle || (payload.track && payload.track.albumTitle) || "";
    this.state.artistId =
      payload.artistId ||
      payload.channelId ||
      (payload.track && (payload.track.artistId || (payload.track.artistIds && payload.track.artistIds[0]))) ||
      "";
    if (typeof this._ensurePlayMode === "function") this._ensurePlayMode();
    this._handlers.onEnded = payload.onEnded || null;
    this._handlers.onPrev = payload.onPrev || null;
    this._handlers.onNext = payload.onNext || null;
    this._handlers.onDialTune = payload.onDialTune || null;
    this._tastePlayStarted = Date.now();
    try {
      if (window.SDMusicTaste && typeof window.SDMusicTaste.recordPlay === "function") {
        window.SDMusicTaste.recordPlay({
          source: this.state.source,
          id: this.state.id,
          title: this.state.title,
          subtitle: this.state.subtitle,
          artwork: this.state.artwork,
          genre: this.state.genre,
          artist: (payload.now && payload.now.artist) || this.state.subtitle,
          year: (payload.track && payload.track.year) || payload.year || "",
          entryPath:
            (window.SDMusicUnifiedQueue &&
              window.SDMusicUnifiedQueue.getSession &&
              window.SDMusicUnifiedQueue.getSession() &&
              window.SDMusicUnifiedQueue.getSession().source &&
              (window.SDMusicUnifiedQueue.getSession().source.entryPath ||
                window.SDMusicUnifiedQueue.getSession().source.type)) ||
            this.state.source ||
            "",
          station: this.state.station,
          videoId: this.state.source === "listen" ? this.state.id : "",
          streamUrl: this.state.streamUrl,
        });
      }
    } catch (e) {}

    if (payload.dialList) this.setDialList(payload.dialList, this.state.id);
    else if (this.state.source === "radio" && this.state.id && this._dial.list.length) {
      this._dial.index = this._dial.list.findIndex(function (s) {
        return String(s.stationuuid) === String(this.state.id);
      }.bind(this));
      this._syncDialHint();
    }

    if (!this.root) return Promise.resolve();
    this.root.classList.add("show");
    this._syncHost();
    this.root.dataset.source = this.state.source;
    var selfText = this;
    this.root.querySelectorAll("[data-smp-title], [data-smp-title-lg]").forEach(function (el) {
      selfText._setText(el, selfText.state.title);
    });
    this.root.querySelectorAll("[data-smp-sub], [data-smp-sub-lg]").forEach(function (el) {
      selfText._setText(el, selfText.state.subtitle);
    });
    this.setArtwork(this.state.artwork);
    this.setNowNext({ now: payload.now || null, next: payload.next || null });
    this._syncFavBtn();
    this._syncDialHint();
    this._syncListenBtn();
    this._syncPlayModeBtn();
    this._syncMetaNav();
    this._syncMarquee();
    var seekRow = this.root.querySelector("[data-smp-seek]");
    if (seekRow) seekRow.hidden = this.state.source !== "listen";

    var canPrev =
      typeof this._handlers.onPrev === "function" ||
      (this.state.source === "radio" && this._dial.list.length > 1);
    var canNext =
      typeof this._handlers.onNext === "function" ||
      (this.state.source === "radio" && this._dial.list.length > 1);
    this._syncTransportButtons(canPrev, canNext);

    var url = this.state.streamUrl;
    if (!url) return Promise.resolve();

    var self = this;
    var playAudio = function () {
      self._wantPlaying = true;
      try {
        window.__sdMusicHoldsTv = true;
      } catch (eH) {}
      self._ensureSilentKeepAlive();
      self.audio.volume = self.state.muted ? 0 : self.state.volume;
      self.audio.muted = !!self.state.muted;
      return self.audio.play().then(
        function () {
          self.state.playing = true;
          self._syncPlayButtons();
          self._claimMediaSession();
        },
        function () {
          self.state.playing = false;
          self._syncPlayButtons();
          self._syncMediaSession();
        }
      );
    };

    var start = Promise.resolve();
    if (this.state.hls && window.Hls && window.Hls.isSupported()) {
      this.hls = new window.Hls({ enableWorker: true, lowLatencyMode: false });
      this.hls.loadSource(url);
      this.hls.attachMedia(this.audio);
      start = new Promise(function (resolve) {
        self.hls.on(window.Hls.Events.MANIFEST_PARSED, function () {
          playAudio().finally(resolve);
        });
      });
    } else {
      this.audio.src = url;
      start = playAudio();
    }

    this._scheduleVideoFade();
    if (this.state.source === "radio") {
      this._npTimer = setTimeout(function () {
        self._pollRadioNowPlaying();
      }, 1600);
    }

    try {
      if (window.SDMusic && typeof window.SDMusic.open === "function" && !window.SDMusic.isOpen()) {
        window.SDMusic.open({
          replace: true,
          tab: this.state.source === "radio" ? "radio" : "listen",
        });
      }
    } catch (e) {}

    return start;
  };

  Player.prototype.toggle = function () {
    if (!this.audio || !this.audio.src) return;
    if (this.audio.paused) {
      this._wantPlaying = true;
      this.audio.play().catch(function () {});
      this._claimMediaSession();
    } else {
      this._wantPlaying = false;
      this.audio.pause();
      this.state.playing = false;
      this._syncPlayButtons();
      this._syncMediaSession();
      this._schedulePauseIdle();
    }
  };

  Player.prototype.stop = function () {
    this._wantPlaying = false;
    this._clearPauseIdle();
    this._clearMedia();
    this._stopNp();
    this.state.playing = false;
    this.state.id = null;
    this.state.streamUrl = "";
    this.state.videoUrl = "";
    this.state.source = null;
    this.state.station = null;
    this.setNowNext({});
    this.setExpanded(false);
    this._syncPlayButtons();
    this._releaseMediaSession();
    if (this.root) {
      this.root.classList.remove("show");
      this._syncHost();
    }
    this._clearPauseIdle();
  };

  Player.prototype._syncFavBtn = Player.prototype._syncFavBtn || function () {};
  Player.prototype._syncListenBtn = Player.prototype._syncListenBtn || function () {};
  Player.prototype._toggleFav = Player.prototype._toggleFav || function () {};
  Player.prototype._share = Player.prototype._share || function () {};
  Player.prototype._toggleLyrics = Player.prototype._toggleLyrics || function () {};
  Player.prototype._toggleQueuePanel = Player.prototype._toggleQueuePanel || function () {};
  Player.prototype._playOnListen = Player.prototype._playOnListen || function () {};
  Player.prototype._browseRelated = Player.prototype._browseRelated || function () {};
  Player.prototype._toggleInfo = Player.prototype._toggleInfo || function () {};
  Player.prototype._fetchLyrics = Player.prototype._fetchLyrics || function () {};
  Player.prototype._onTimeUpdate = Player.prototype._onTimeUpdate || function () {};
  Player.prototype._wireUxExtras = Player.prototype._wireUxExtras || function () {};
  Player.prototype._syncPlayModeBtn = Player.prototype._syncPlayModeBtn || function () {};
  Player.prototype._syncMetaNav = Player.prototype._syncMetaNav || function () {};
  Player.prototype._syncMarquee = Player.prototype._syncMarquee || function () {};
  Player.prototype._ensurePlayMode = Player.prototype._ensurePlayMode || function () {};
  Player.prototype._exitVideoFullscreen = Player.prototype._exitVideoFullscreen || function () {};
  Player.prototype._radioNavByMode = Player.prototype._radioNavByMode || null;
  Player.prototype._radioOnEnded = Player.prototype._radioOnEnded || null;

  Player.prototype.getState = function () {
    return Object.assign({}, this.state);
  };

  var singleton = new Player();

  window.StepDaddyMusicPlayer = {
    ensure: function (host) {
      return singleton.ensure(host);
    },
    play: function (payload) {
      return singleton.play(payload);
    },
    stop: function () {
      return singleton.stop();
    },
    toggle: function () {
      return singleton.toggle();
    },
    setNowNext: function (m) {
      return singleton.setNowNext(m);
    },
    setExpanded: function (on) {
      return singleton.setExpanded(on);
    },
    setDialList: function (list, id) {
      return singleton.setDialList(list, id);
    },
    next: function () {
      return singleton.next();
    },
    prev: function () {
      return singleton.prev();
    },
    tuneDial: function (d) {
      return singleton.tuneDial(d);
    },
    getState: function () {
      return singleton.getState();
    },
    getPlayMode: function () {
      return singleton.state.playMode || "off";
    },
    setPlayMode: function (mode) {
      if (typeof singleton._setPlayMode === "function") return singleton._setPlayMode(mode);
      singleton.state.playMode = mode || "off";
      return singleton.state.playMode;
    },
    pickQueueIndex: function (queue, cur, dir, mode) {
      if (typeof singleton._pickQueueIndex === "function") {
        return singleton._pickQueueIndex(queue, cur, dir, mode);
      }
      return cur + (dir || 1);
    },
    syncHost: function () {
      return singleton._syncHost();
    },
    formatNowLine: formatNowLine,
    sanitizeNowFields: sanitizeNowFields,
    fallbackArt: FALLBACK_ART,
    _instance: singleton,
  };
})();
