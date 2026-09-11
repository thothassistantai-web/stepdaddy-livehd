/**
 * YouTube IFrame embed playback for Listen when VPS yt-dlp is bot-gated.
 * Patches StepDaddyMusicPlayer after music_player.js (+ video).
 * streamUrl form: "ytembed:<videoId>"
 */
(function () {
  var P = window.StepDaddyMusicPlayer;
  if (!P || !P.prototype || P.prototype.__sdYtEmbedPatched) return;
  P.prototype.__sdYtEmbedPatched = true;

  var YT_API = "https://www.youtube.com/iframe_api";
  var _ytReady = null;
  var _ytQueue = [];

  function ensureYtApi() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (_ytReady) return _ytReady;
    _ytReady = new Promise(function (resolve) {
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        try {
          if (typeof prev === "function") prev();
        } catch (e) {}
        resolve();
        _ytQueue.splice(0).forEach(function (fn) {
          try {
            fn();
          } catch (e2) {}
        });
      };
      if (!document.getElementById("sd-yt-iframe-api")) {
        var s = document.createElement("script");
        s.id = "sd-yt-iframe-api";
        s.src = YT_API;
        s.async = true;
        document.head.appendChild(s);
      }
      // Already loading / raced
      var n = 0;
      var t = setInterval(function () {
        n += 1;
        if (window.YT && window.YT.Player) {
          clearInterval(t);
          resolve();
        } else if (n > 100) {
          clearInterval(t);
          resolve();
        }
      }, 100);
    });
    return _ytReady;
  }

  function parseEmbed(url) {
    if (!url || typeof url !== "string") return null;
    if (url.indexOf("ytembed:") === 0) return url.slice(8).trim();
    return null;
  }

  P.prototype._isYtEmbedUrl = function (url) {
    return !!parseEmbed(url);
  };

  P.prototype._destroyYtEmbed = function () {
    if (this._ytTick) {
      clearInterval(this._ytTick);
      this._ytTick = null;
    }
    try {
      if (this._ytPlayer && typeof this._ytPlayer.destroy === "function") {
        this._ytPlayer.destroy();
      }
    } catch (e) {}
    this._ytPlayer = null;
    if (this._ytHost && this._ytHost.parentNode) {
      try {
        this._ytHost.parentNode.removeChild(this._ytHost);
      } catch (e2) {}
    }
    this._ytHost = null;
    if (this.root) this.root.classList.remove("has-yt-embed");
  };

  P.prototype._ensureYtHost = function () {
    if (this._ytHost && this._ytHost.isConnected) return this._ytHost;
    var host = document.createElement("div");
    host.className = "smp-yt-embed";
    host.setAttribute("data-smp-yt-embed", "1");
    host.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;overflow:hidden;pointer-events:none;opacity:0.001;z-index:2;";
    var mount =
      (this.root && this.root.querySelector("[data-smp-art-wrap], .smp-art, [data-smp-sheet]")) ||
      this.root ||
      document.body;
    if (mount && getComputedStyle(mount).position === "static") {
      mount.style.position = "relative";
    }
    var inner = document.createElement("div");
    inner.id = "smp-yt-player-" + Math.random().toString(36).slice(2, 9);
    host.appendChild(inner);
    mount.appendChild(host);
    this._ytHost = host;
    this._ytInnerId = inner.id;
    if (this.root) this.root.classList.add("has-yt-embed");
    return host;
  };

  P.prototype._syncFromYt = function () {
    if (!this._ytPlayer || typeof this._ytPlayer.getCurrentTime !== "function") return;
    try {
      var t = this._ytPlayer.getCurrentTime() || 0;
      var d = this._ytPlayer.getDuration() || 0;
      if (this.audio) {
        // Mirror into a blank audio element so existing progress UI / media session keep working.
        try {
          Object.defineProperty(this.audio, "currentTime", {
            configurable: true,
            get: function () {
              return t;
            },
            set: function () {},
          });
        } catch (eDef) {}
        try {
          Object.defineProperty(this.audio, "duration", {
            configurable: true,
            get: function () {
              return d;
            },
          });
        } catch (eDur) {}
      }
      if (typeof this._onTimeUpdate === "function") this._onTimeUpdate();
      if (typeof this._syncMediaSession === "function") this._syncMediaSession();
    } catch (e) {}
  };

  P.prototype._startYtEmbed = function (videoId) {
    var self = this;
    this._destroyYtEmbed();
    this._ensureYtHost();
    this._wantPlaying = true;
    try {
      window.__sdMusicHoldsTv = true;
    } catch (eH) {}

    return ensureYtApi().then(function () {
      if (!window.YT || !window.YT.Player) {
        return Promise.reject(new Error("yt_api_unavailable"));
      }
      return new Promise(function (resolve, reject) {
        var settled = false;
        self._ytPlayer = new window.YT.Player(self._ytInnerId, {
          width: "100%",
          height: "100%",
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            iv_load_policy: 3,
            origin: location.origin,
          },
          events: {
            onReady: function (ev) {
              try {
                ev.target.playVideo();
                if (self.state.muted) ev.target.mute();
                else {
                  ev.target.unMute();
                  if (typeof ev.target.setVolume === "function") {
                    ev.target.setVolume(Math.round((self.state.volume || 1) * 100));
                  }
                }
              } catch (eR) {}
              self.state.playing = true;
              if (typeof self._syncPlayButtons === "function") self._syncPlayButtons();
              if (typeof self._claimMediaSession === "function") self._claimMediaSession();
              self._ytTick = setInterval(function () {
                self._syncFromYt();
              }, 500);
              if (!settled) {
                settled = true;
                resolve();
              }
            },
            onStateChange: function (ev) {
              var st = ev && ev.data;
              if (st === window.YT.PlayerState.ENDED) {
                self.state.playing = false;
                if (typeof self._syncPlayButtons === "function") self._syncPlayButtons();
                if (typeof self._handlers.onEnded === "function") self._handlers.onEnded();
                else if (typeof self.state.onEnded === "function") self.state.onEnded();
              } else if (st === window.YT.PlayerState.PLAYING) {
                self.state.playing = true;
                self._wantPlaying = true;
                if (typeof self._syncPlayButtons === "function") self._syncPlayButtons();
              } else if (st === window.YT.PlayerState.PAUSED) {
                self.state.playing = false;
                if (typeof self._syncPlayButtons === "function") self._syncPlayButtons();
              }
            },
            onError: function () {
              if (!settled) {
                settled = true;
                reject(new Error("yt_embed_error"));
              }
            },
          },
        });
        setTimeout(function () {
          if (!settled) {
            settled = true;
            resolve();
          }
        }, 8000);
      });
    });
  };

  var _clearMedia = P.prototype._clearMedia;
  P.prototype._clearMedia = function () {
    this._destroyYtEmbed();
    return _clearMedia.apply(this, arguments);
  };

  var _toggle = P.prototype.toggle;
  P.prototype.toggle = function () {
    if (this._ytPlayer && typeof this._ytPlayer.getPlayerState === "function") {
      try {
        var st = this._ytPlayer.getPlayerState();
        if (st === window.YT.PlayerState.PLAYING) {
          this._wantPlaying = false;
          this._ytPlayer.pauseVideo();
          this.state.playing = false;
        } else {
          this._wantPlaying = true;
          this._ytPlayer.playVideo();
          this.state.playing = true;
        }
        if (typeof this._syncPlayButtons === "function") this._syncPlayButtons();
        if (typeof this._syncMediaSession === "function") this._syncMediaSession();
        return;
      } catch (e) {}
    }
    return _toggle.apply(this, arguments);
  };

  /**
   * Preload YT IFrame API + cue next videoId (muted, no autoplay) so track-change
   * starts with lower delay. Safe to call repeatedly; never starts audible playback.
   */
  P.prototype.prewarmYtEmbed = function (videoId) {
    var id = String(videoId || "").trim();
    if (!id || id.length < 6) return Promise.resolve();
    var self = this;
    if (self._ytWarmId === id && self._ytWarmPlayer) return Promise.resolve();
    return ensureYtApi().then(function () {
      if (!window.YT || !window.YT.Player) return;
      try {
        if (!self._ytWarmHost || !self._ytWarmHost.isConnected) {
          var host = document.createElement("div");
          host.className = "smp-yt-warm";
          host.setAttribute("aria-hidden", "true");
          host.style.cssText =
            "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;z-index:-1;";
          var inner = document.createElement("div");
          inner.id = "smp-yt-warm-" + Math.random().toString(36).slice(2, 9);
          host.appendChild(inner);
          document.body.appendChild(host);
          self._ytWarmHost = host;
          self._ytWarmInnerId = inner.id;
        }
        if (self._ytWarmPlayer && typeof self._ytWarmPlayer.cueVideoById === "function") {
          self._ytWarmPlayer.cueVideoById({ videoId: id, startSeconds: 0 });
          self._ytWarmId = id;
          return;
        }
        self._ytWarmPlayer = new window.YT.Player(self._ytWarmInnerId, {
          width: "1",
          height: "1",
          videoId: id,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            iv_load_policy: 3,
            origin: location.origin,
          },
          events: {
            onReady: function (ev) {
              try {
                ev.target.mute();
                if (typeof ev.target.cueVideoById === "function") {
                  ev.target.cueVideoById({ videoId: id, startSeconds: 0 });
                }
              } catch (eR) {}
              self._ytWarmId = id;
            },
          },
        });
      } catch (eWarm) {}
    });
  };

  var _play = P.prototype.play;
  P.prototype.play = function (payload) {
    payload = payload || {};
    var url = payload.streamUrl || payload.url || "";
    var embedId = parseEmbed(url);
    if (!embedId && payload.mode === "yt_embed" && (payload.videoId || payload.id)) {
      embedId = String(payload.videoId || payload.id);
      payload.streamUrl = "ytembed:" + embedId;
    }
    if (!embedId) {
      this._destroyYtEmbed();
      return _play.apply(this, arguments);
    }

    // Run shared play() setup by temporarily clearing streamUrl, then start embed.
    var saved = payload.streamUrl;
    payload.streamUrl = "";
    var self = this;
    var base = _play.call(this, payload);
    this.state.streamUrl = saved;
    this.state.mode = "yt_embed";
    // Kick API early if not already prewarmed for this id.
    try {
      if (typeof self.prewarmYtEmbed === "function") self.prewarmYtEmbed(embedId);
    } catch (ePw) {}
    return Promise.resolve(base)
      .catch(function () {})
      .then(function () {
        return self._startYtEmbed(embedId);
      });
  };

  window.SDMusicYtEmbed = {
    prewarm: function (videoId) {
      try {
        var inst = window.StepDaddyMusicPlayer && window.StepDaddyMusicPlayer._instance;
        if (inst && typeof inst.prewarmYtEmbed === "function") return inst.prewarmYtEmbed(videoId);
        // Ensure player shell exists so warm host can attach.
        if (window.StepDaddyMusicPlayer && typeof window.StepDaddyMusicPlayer.ensure === "function") {
          var p = window.StepDaddyMusicPlayer.ensure(document.body);
          if (p && typeof p.prewarmYtEmbed === "function") return p.prewarmYtEmbed(videoId);
        }
      } catch (e) {}
      return ensureYtApi();
    },
  };
})();
