/**
 * StepDaddy Music player — video preview / fullscreen state machine.
 * States: none → arming → preview → fullscreen → (resume preview | none)
 * Patches StepDaddyMusicPlayer after music_player.js (+ actions).
 * Does not touch the shared <audio> engine.
 */
(function () {
  var api = window.StepDaddyMusicPlayer;
  if (!api) return;

  var ART_TO_VIDEO_MS = 4200;
  var RETRY_MS = 2800;
  var MAX_ERRORS = 2;

  function getProto() {
    var inst = api._instance;
    if (!inst) return null;
    return Object.getPrototypeOf(inst);
  }

  function ensureVideoState(self) {
    if (!self._videoSm) {
      self._videoSm = {
        mode: "none", // none | arming | preview | fullscreen
        url: "",
        errors: 0,
        timer: null,
        resumeAt: 0,
        generation: 0,
      };
    }
    return self._videoSm;
  }

  function clearTimer(sm) {
    if (sm.timer) {
      clearTimeout(sm.timer);
      sm.timer = null;
    }
  }

  function hasUsableVideoUrl(url) {
    url = String(url || "").trim();
    if (!url) return false;
    if (/^javascript:/i.test(url)) return false;
    return true;
  }

  function bindVideoError(self, v) {
    if (!v || v.__smpVidBound) return;
    v.__smpVidBound = true;
    v.addEventListener("error", function () {
      var sm = ensureVideoState(self);
      sm.errors += 1;
      if (sm.errors >= MAX_ERRORS) {
        fallbackToArt(self, "error");
        return;
      }
      // retry once after delay while still wanting preview
      if (sm.mode === "preview" || sm.mode === "arming") {
        clearTimer(sm);
        sm.timer = setTimeout(function () {
          if (sm.url && (sm.mode === "preview" || sm.mode === "arming")) {
            startPreview(self, true);
          }
        }, RETRY_MS);
      }
    });
    v.addEventListener("playing", function () {
      var sm = ensureVideoState(self);
      if (sm.mode === "arming") sm.mode = "preview";
      if (self.root) self.root.classList.add("has-video");
      try {
        v.classList.add("show");
      } catch (e) {}
    });
  }

  function stopVideos(self, clearSrc) {
    [self.video, self.videoLg].forEach(function (v) {
      if (!v) return;
      try {
        v.pause();
        v.classList.remove("show");
        if (clearSrc) {
          v.removeAttribute("src");
          v.load();
        }
      } catch (e) {}
    });
  }

  function fallbackToArt(self, reason) {
    var sm = ensureVideoState(self);
    clearTimer(sm);
    sm.mode = "none";
    stopVideos(self, true);
    if (self.root) {
      self.root.classList.remove("has-video");
      self.root.classList.remove("video-fs");
      self.root.dataset.videoMode = "none";
      if (reason) self.root.dataset.videoReason = reason;
    }
    // leave audio alone
  }

  function startPreview(self, isRetry) {
    var sm = ensureVideoState(self);
    var url = sm.url;
    if (!hasUsableVideoUrl(url)) {
      fallbackToArt(self, "no-url");
      return;
    }
    // Only show preview when expanded (or mini has small video — keep both muted)
    sm.mode = "arming";
    if (self.root) {
      self.root.dataset.videoMode = "arming";
      delete self.root.dataset.videoReason;
    }
    var gen = ++sm.generation;
    [self.video, self.videoLg].forEach(function (v) {
      if (!v) return;
      bindVideoError(self, v);
      try {
        if (!v.src || v.src.indexOf(url) < 0) v.src = url;
        v.muted = true;
        v.defaultMuted = true;
        v.volume = 0;
        v.loop = true;
        v.playsInline = true;
        v.setAttribute("playsinline", "");
        v.setAttribute("webkit-playsinline", "");
        if (sm.resumeAt > 0.25) {
          var seek = function () {
            if (gen !== sm.generation) return;
            try {
              if (Math.abs((v.currentTime || 0) - sm.resumeAt) > 0.4) v.currentTime = sm.resumeAt;
            } catch (e) {}
          };
          if (v.readyState >= 1) seek();
          else v.onloadedmetadata = seek;
        }
        var p = v.play();
        if (p && p.catch) {
          p.catch(function () {
            if (gen !== sm.generation) return;
            if (!isRetry) {
              clearTimer(sm);
              sm.timer = setTimeout(function () {
                startPreview(self, true);
              }, RETRY_MS);
            } else {
              fallbackToArt(self, "autoplay-blocked");
            }
          });
        }
        v.classList.add("show");
      } catch (e) {
        fallbackToArt(self, "exception");
      }
    });
    if (self.root) {
      self.root.classList.add("has-video");
      self.root.dataset.videoMode = "preview";
    }
    sm.mode = "preview";
  }

  function schedulePreview(self) {
    var sm = ensureVideoState(self);
    clearTimer(sm);
    if (!hasUsableVideoUrl(self.state && self.state.videoUrl)) {
      sm.url = "";
      fallbackToArt(self, "no-video");
      return;
    }
    sm.url = self.state.videoUrl;
    sm.errors = 0;
    sm.resumeAt = 0;
    sm.mode = "arming";
    if (self.root) self.root.dataset.videoMode = "arming";
    // Keep art visible until timer; do not start video yet
    stopVideos(self, false);
    if (self.root) self.root.classList.remove("has-video");
    var gen = sm.generation;
    sm.timer = setTimeout(function () {
      if (gen !== sm.generation && sm.generation !== gen) {
        /* generation bump handled below */
      }
      if (!self.state || self.state.videoUrl !== sm.url) return;
      startPreview(self, false);
    }, ART_TO_VIDEO_MS);
  }

  function enterFullscreen(self) {
    var sm = ensureVideoState(self);
    if (!hasUsableVideoUrl(sm.url || (self.state && self.state.videoUrl))) return;
    if (!self.root || !self.root.classList.contains("has-video")) {
      // allow early tap after arming if url present
      if (!hasUsableVideoUrl(self.state.videoUrl)) return;
      sm.url = self.state.videoUrl;
    }
    var preview = self.videoLg || self.video;
    var shell = self.root.querySelector("[data-smp-video-fs]");
    var fsVid = self.root.querySelector("[data-smp-video-fs-el]");
    if (!shell || !fsVid) return;
    var t = 0;
    try {
      if (preview && isFinite(preview.currentTime)) t = preview.currentTime;
    } catch (e) {}
    sm.resumeAt = t;
    sm.mode = "fullscreen";
    self.state.videoFs = true;
    shell.hidden = false;
    self.root.classList.add("video-fs");
    self.root.dataset.videoMode = "fullscreen";
    bindVideoError(self, fsVid);
    try {
      var url = sm.url || self.state.videoUrl;
      if (!fsVid.src || fsVid.src.indexOf(url) < 0) fsVid.src = url;
      fsVid.muted = true;
      fsVid.defaultMuted = true;
      fsVid.volume = 0;
      fsVid.loop = true;
      fsVid.playsInline = true;
      var seek = function () {
        try {
          if (Math.abs((fsVid.currentTime || 0) - t) > 0.35) fsVid.currentTime = t;
        } catch (e) {}
        var p = fsVid.play();
        if (p && p.catch) p.catch(function () {});
      };
      if (fsVid.readyState >= 1) seek();
      else fsVid.onloadedmetadata = seek;
      if (preview) {
        try {
          preview.pause();
        } catch (e) {}
      }
    } catch (e) {}
  }

  function exitFullscreen(self, clear) {
    var sm = ensureVideoState(self);
    var shell = self.root && self.root.querySelector("[data-smp-video-fs]");
    var fsVid = self.root && self.root.querySelector("[data-smp-video-fs-el]");
    var preview = self.videoLg;
    var t = sm.resumeAt || 0;
    try {
      if (fsVid && isFinite(fsVid.currentTime)) t = fsVid.currentTime;
    } catch (e) {}
    sm.resumeAt = t;
    self.state.videoFs = false;
    if (self.root) {
      self.root.classList.remove("video-fs");
    }
    if (shell) shell.hidden = true;
    try {
      if (fsVid) {
        fsVid.pause();
        if (clear) {
          fsVid.removeAttribute("src");
          fsVid.load();
        }
      }
    } catch (e) {}
    if (clear) {
      fallbackToArt(self, "fs-clear");
      return;
    }
    // Resume muted preview from same timecode
    if (hasUsableVideoUrl(sm.url || (self.state && self.state.videoUrl))) {
      sm.url = sm.url || self.state.videoUrl;
      startPreview(self, false);
      // apply timecode
      [self.video, self.videoLg].forEach(function (v) {
        if (!v) return;
        try {
          if (Math.abs((v.currentTime || 0) - t) > 0.35) v.currentTime = t;
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
        } catch (e) {}
      });
      sm.mode = "preview";
      if (self.root) self.root.dataset.videoMode = "preview";
    } else {
      fallbackToArt(self, "no-url-after-fs");
    }
  }

  function patch() {
    var Proto = getProto();
    if (!Proto || Proto.__smpVideoSmPatched) {
      // Retry shortly if player not yet constructed
      if (!Proto) {
        setTimeout(patch, 50);
      }
      return;
    }
    Proto.__smpVideoSmPatched = true;

    Proto._scheduleVideoFade = function () {
      schedulePreview(this);
    };

    Proto._startArtVideo = function () {
      var sm = ensureVideoState(this);
      sm.url = this.state.videoUrl || sm.url;
      startPreview(this, false);
    };

    Proto._enterVideoFullscreen = function () {
      enterFullscreen(this);
    };

    Proto._exitVideoFullscreen = function (clear) {
      exitFullscreen(this, !!clear);
    };

    var origClear = Proto._clearMedia;
    Proto._clearMedia = function () {
      var sm = ensureVideoState(this);
      sm.generation += 1;
      clearTimer(sm);
      sm.mode = "none";
      sm.url = "";
      sm.resumeAt = 0;
      sm.errors = 0;
      if (this.root) {
        this.root.dataset.videoMode = "none";
        this.root.classList.remove("video-fs");
      }
      if (typeof origClear === "function") return origClear.apply(this, arguments);
    };

    var origExpanded = Proto.setExpanded;
    Proto.setExpanded = function (on) {
      if (typeof origExpanded === "function") origExpanded.call(this, on);
      var sm = ensureVideoState(this);
      if (!on && sm.mode === "fullscreen") {
        exitFullscreen(this, false);
      }
    };

    // Re-wire tap on large video if actions already wired
    var inst = api._instance;
    if (inst && inst.root && inst.videoLg && !inst.videoLg.__smpSmTap) {
      inst.videoLg.__smpSmTap = true;
      var tap = { x0: 0, y0: 0 };
      inst.videoLg.addEventListener(
        "pointerdown",
        function (ev) {
          tap.x0 = ev.clientX;
          tap.y0 = ev.clientY;
        },
        { passive: true }
      );
      inst.videoLg.addEventListener("click", function (ev) {
        if (!inst.state.expanded) return;
        if (!hasUsableVideoUrl(inst.state.videoUrl) && !inst.root.classList.contains("has-video")) return;
        var dx = Math.abs(ev.clientX - tap.x0);
        var dy = Math.abs(ev.clientY - tap.y0);
        if (dx > 14 || dy > 14) return;
        ev.stopPropagation();
        enterFullscreen(inst);
      });
    }
  }

  // music_player_actions may load after us — patch now and on next tick
  patch();
  setTimeout(patch, 0);
  setTimeout(patch, 200);

  window.SDMusicVideoSm = {
    modes: ["none", "arming", "preview", "fullscreen"],
    get: function () {
      var inst = api._instance;
      return inst ? ensureVideoState(inst) : null;
    },
  };
})();
