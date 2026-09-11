/**
 * StepDaddy Music player — expanded-sheet actions (fav/share/lyrics/Listen/queue/info).
 * Patches StepDaddyMusicPlayer prototype after music_player.js.
 */
(function () {
  var api = window.StepDaddyMusicPlayer;
  if (!api || !api._instance) return;
  var PlayerProto = Object.getPrototypeOf(api._instance);
  var LS_FAV = "sd_music_radio_favs";

  function readFavs() {
    try {
      var raw = JSON.parse(localStorage.getItem(LS_FAV) || "[]");
      return Array.isArray(raw) ? raw.map(String) : [];
    } catch (e) {
      return [];
    }
  }

  function writeFavs(list) {
    try {
      localStorage.setItem(LS_FAV, JSON.stringify(list.slice(0, 200)));
    } catch (e) {}
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function formatNowLine(now) {
    if (api && typeof api.formatNowLine === "function") return api.formatNowLine(now);
    if (!now) return "";
    if (typeof now === "string") return now;
    if (now.artist && now.title) return now.artist + " — " + now.title;
    return now.title || "";
  }

  function sanitizeNowFields(now) {
    if (api && typeof api.sanitizeNowFields === "function") return api.sanitizeNowFields(now);
    return now;
  }

  // Reuse sanitize from instance methods via existing formatNowLine path:
  // _nowParts uses sanitizeNowFields — keep a local copy.
  PlayerProto._toggleFav = function () {
    if (!this.state.id) return;
    var id = String(this.state.id);
    var favs = readFavs();
    var i = favs.indexOf(id);
    var liked;
    if (i >= 0) {
      favs.splice(i, 1);
      liked = false;
    } else {
      favs.unshift(id);
      liked = true;
    }
    writeFavs(favs);
    this._syncFavBtn();
    var likePayload = {
      source: this.state.source,
      id: this.state.id,
      title: this.state.title,
      subtitle: this.state.subtitle,
      artwork: this.state.artwork,
      genre: this.state.genre,
      artist: (this.state.now && this.state.now.artist) || this.state.subtitle,
      station: this.state.station,
      videoId: this.state.source === "listen" ? this.state.id : "",
      streamUrl: this.state.streamUrl,
      albumId: this.state.albumId || "",
      artistId: this.state.artistId || "",
      liked: liked,
    };
    try {
      if (window.SDMusicTaste && typeof window.SDMusicTaste.recordLike === "function") {
        window.SDMusicTaste.recordLike(likePayload, liked);
      }
    } catch (e) {}
    try {
      window.dispatchEvent(new CustomEvent("sd-music-like", { detail: likePayload }));
    } catch (e2) {}
    try {
      if (window.SDMusicLibrary) {
        if (this.state.source === "listen" && this.state.id) {
          window.SDMusicLibrary.likeTrack(
            {
              videoId: this.state.id,
              title: this.state.title,
              subtitle: this.state.subtitle,
              thumb: this.state.artwork,
              albumId: this.state.albumId,
              artistId: this.state.artistId,
            },
            liked
          );
        } else if (this.state.source === "radio" && this.state.id) {
          window.SDMusicLibrary.saveStation(
            this.state.station || {
              stationuuid: this.state.id,
              name: this.state.title,
              favicon: this.state.artwork,
              stream_url: this.state.streamUrl,
              genre: this.state.genre,
            },
            liked
          );
        }
      }
    } catch (e3) {}
  };

  PlayerProto._syncFavBtn = function () {
    if (!this.root) return;
    var on = this.state.id && readFavs().indexOf(String(this.state.id)) >= 0;
    this.root.querySelectorAll("[data-smp-fav]").forEach(function (btn) {
      btn.classList.toggle("on", !!on);
      btn.textContent = on ? "♥" : "♡";
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  };

  PlayerProto._shareUrl = function () {
    var title = this.state.title || "";
    var artist =
      this.state.subtitle ||
      (this.state.now && this.state.now.artist) ||
      "";
    var album = this.state.album || this.state.albumTitle || "";
    var art = this.state.artwork || "";
    var origin = location.origin || "";
    var q = new URLSearchParams();
    if (this.state.source === "listen" && this.state.id) {
      if (title) q.set("title", title);
      if (artist) q.set("artist", artist);
      if (album) q.set("album", album);
      if (art && /^https?:\/\//i.test(art) && art.length < 400) q.set("img", art);
      var listenUrl = origin + "/music/t/" + encodeURIComponent(String(this.state.id));
      var qs = q.toString();
      return qs ? listenUrl + "?" + qs : listenUrl;
    }
    if (this.state.source === "radio" && this.state.id) {
      if (title) q.set("name", title);
      if (this.state.genre) q.set("genre", String(this.state.genre));
      if (art && /^https?:\/\//i.test(art) && art.length < 400) q.set("img", art);
      var radioUrl = origin + "/music/r/" + encodeURIComponent(String(this.state.id));
      var rqs = q.toString();
      return rqs ? radioUrl + "?" + rqs : radioUrl;
    }
    return origin + (this.state.source === "listen" ? "/music/listen" : "/music/radio");
  };

  PlayerProto._share = function () {
    var title = this.state.title || "StepDaddy Music";
    var artist =
      this.state.subtitle ||
      (this.state.now && this.state.now.artist) ||
      "";
    var shareTitle = artist ? artist + " — " + title : title;
    var now = formatNowLine(this.state.now);
    var text = now && this.state.source === "radio" ? shareTitle + "\n" + now : shareTitle;
    var url = this._shareUrl();
    if (navigator.share) {
      navigator.share({ title: shareTitle, text: text, url: url }).catch(function () {});
      return;
    }
    try {
      navigator.clipboard.writeText(url);
    } catch (e) {
      try {
        navigator.clipboard.writeText(text + "\n" + url);
      } catch (e2) {}
    }
  };

  PlayerProto._nowParts = function () {
    var now = sanitizeNowFields(this.state.now);
    if (now && typeof now === "object") {
      return { artist: now.artist || "", title: now.title || "" };
    }
    if (this.state.source === "listen") {
      return { artist: this.state.subtitle || "", title: this.state.title || "" };
    }
    return { artist: "", title: "" };
  };

  PlayerProto._syncListenBtn = function () {
    if (!this.root) return;
    var btn = this.root.querySelector("[data-smp-listen]");
    if (!btn) return;
    var parts = this._nowParts();
    var show = this.state.source === "radio" && !!(parts.artist && parts.title);
    btn.hidden = !show;
  };

  PlayerProto._playOnListen = function () {
    var parts = this._nowParts();
    var q = [parts.artist, parts.title].filter(Boolean).join(" ").trim();
    if (!q) return;
    var self = this;
    var run = function () {
      if (window.StepDaddyMusicListen && typeof window.StepDaddyMusicListen.searchAndPlay === "function") {
        return window.StepDaddyMusicListen.searchAndPlay(q);
      }
      return fetch(
        "/api/music/listen/search?q=" + encodeURIComponent(q) + "&filter=songs&limit=8",
        { credentials: "same-origin" }
      )
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (data) {
          var items = (data && data.items) || [];
          var track = items.find(function (i) {
            return i && i.videoId;
          });
          if (!track) throw new Error("no_track");
          return fetch("/api/music/listen/stream/" + encodeURIComponent(track.videoId), {
            credentials: "same-origin",
          }).then(function (r) {
            return r.ok ? r.json() : null;
          }).then(function (stream) {
            if (!stream || !stream.stream_url) throw new Error("no_stream");
            return self.play({
              source: "listen",
              id: track.videoId,
              title: stream.title || track.title || parts.title,
              subtitle:
                stream.uploader ||
                (track.artists && track.artists.join(", ")) ||
                parts.artist,
              artwork: stream.thumb || track.thumb || "",
              streamUrl: stream.stream_url,
              videoUrl: stream.video_stream_url || "",
              now: {
                title: stream.title || track.title,
                artist: stream.uploader || parts.artist,
              },
            });
          });
        });
    };
    try {
      if (window.SDMusic && typeof window.SDMusic.open === "function") {
        window.SDMusic.open({ replace: true, tab: "listen" });
      }
    } catch (e) {}
    Promise.resolve()
      .then(run)
      .catch(function () {
        self.setNowNext({ now: { title: "Listen search found nothing" } });
      });
  };

  PlayerProto._browseRelated = function () {
    try {
      if (window.SDMusic && typeof window.SDMusic.open === "function") {
        if (this.state.source === "listen") {
          var parts = this._nowParts();
          var q = parts.artist || parts.title || this.state.title;
          window.SDMusic.open({ replace: true, tab: "listen" });
          if (window.StepDaddyMusicListen && typeof window.StepDaddyMusicListen.openSearch === "function") {
            window.StepDaddyMusicListen.openSearch(q);
          }
        } else {
          window.SDMusic.open({ replace: true, tab: "radio" });
        }
      }
    } catch (e) {}
    this.setExpanded(false);
  };

  PlayerProto._toggleInfo = function () {
    if (!this.root) return;
    var panel = this.root.querySelector("[data-smp-info-panel]");
    if (!panel) return;
    var show = panel.hidden;
    panel.hidden = !show;
    if (!show) return;
    var st = this.state.station || {};
    var bits = [
      this.state.title,
      this.state.subtitle,
      st.callsign ? "Call " + st.callsign : "",
      st.bitrate ? st.bitrate + " kbps" : "",
      st.codec || "",
      st.homepage || this.state.homepage || "",
    ].filter(Boolean);
    panel.innerHTML =
      "<strong>Station</strong><p>" +
      esc(bits.join(" · ")) +
      "</p>" +
      (st.homepage || this.state.homepage
        ? '<a href="' +
          esc(st.homepage || this.state.homepage) +
          '" target="_blank" rel="noopener">Homepage</a>'
        : "");
  };

  PlayerProto._toggleQueuePanel = function () {
    if (!this.root) return;
    var panel = this.root.querySelector("[data-smp-queue-panel]");
    if (!panel) return;
    var show = panel.hidden;
    panel.hidden = !show;
    if (!show) return;
    this._ensureQueueLiveUpdates();
    this._renderQueuePanel();
  };

  PlayerProto._ensureQueueLiveUpdates = function () {
    if (this.__uqQueueLive) return;
    var UQ = window.SDMusicUnifiedQueue;
    if (!UQ || typeof UQ.onChange !== "function") return;
    var self = this;
    this.__uqQueueLive = true;
    this.__uqQueueUnsub = UQ.onChange(function () {
      if (!self.root) return;
      var panel = self.root.querySelector("[data-smp-queue-panel]");
      if (!panel || panel.hidden) return;
      self._renderQueuePanel();
    });
  };

  PlayerProto._playUnifiedNow = function () {
    try {
      if (window.StepDaddyMusicListen && typeof window.StepDaddyMusicListen.playUnifiedNow === "function") {
        window.StepDaddyMusicListen.playUnifiedNow();
      }
    } catch (e) {}
  };

  PlayerProto._renderQueuePanel = function () {
    if (!this.root) return;
    var panel = this.root.querySelector("[data-smp-queue-panel]");
    if (!panel || panel.hidden) return;
    var self = this;
    this._ensureQueueLiveUpdates();
    var html = "";
    var UQ = window.SDMusicUnifiedQueue;
    var scrollTop = panel.scrollTop;

    function row(t, opts) {
      opts = opts || {};
      var sub = (t.artists && t.artists.join(", ")) || t.subtitle || "";
      var actions = "";
      var sec = opts.section || "";
      var idx = opts.index;
      var canPlay = !!(opts.playable && sec && idx != null);
      var canRemove = !!(opts.removable && sec && idx != null);
      if (opts.manual && idx != null) {
        actions =
          '<span class="smp-q-actions">' +
          '<button type="button" data-smp-q-up="' +
          idx +
          '" aria-label="Move up">↑</button>' +
          '<button type="button" data-smp-q-down="' +
          idx +
          '" aria-label="Move down">↓</button>' +
          (canRemove
            ? '<button type="button" data-smp-q-rm-sec="' +
              sec +
              '" data-smp-q-rm-i="' +
              idx +
              '" aria-label="Remove">✕</button>'
            : "") +
          "</span>";
      } else if (canRemove) {
        actions =
          '<span class="smp-q-actions">' +
          '<button type="button" data-smp-q-rm-sec="' +
          sec +
          '" data-smp-q-rm-i="' +
          idx +
          '" aria-label="Remove">✕</button>' +
          "</span>";
      }
      var cls = (opts.cls || "") + (canPlay ? " smp-q-tappable" : "");
      var playAttrs = canPlay
        ? ' data-smp-q-play-sec="' + sec + '" data-smp-q-play-i="' + idx + '" role="button" tabindex="0"'
        : "";
      return (
        "<li class=\"" +
        cls.trim() +
        '"' +
        playAttrs +
        ">" +
        "<div class=\"smp-q-main\"" +
        (canPlay ? ' data-smp-q-main="1"' : "") +
        "><strong>" +
        esc(t.title || "Track") +
        "</strong><small>" +
        esc(sub) +
        "</small></div>" +
        actions +
        "</li>"
      );
    }

    if (this.state.source === "listen" && UQ) {
      var tl = UQ.getTimeline();
      html += '<div class="smp-q-toolbar">';
      html +=
        '<label class="smp-q-autoplay"><input type="checkbox" data-smp-autoplay-tog' +
        (tl.autoplayEnabled ? " checked" : "") +
        "/> Autoplay</label>";
      if (tl.playNext && tl.playNext.length) {
        html += '<button type="button" data-smp-q-clear-manual>Clear Play Next</button>';
      }
      html += "</div>";

      html += "<section class=\"smp-q-sec\"><h4>Now Playing</h4><ul>";
      if (tl.now) html += row(tl.now, { cls: "smp-q-now" });
      else html += "<li><small>Nothing playing</small></li>";
      html += "</ul></section>";

      html += "<section class=\"smp-q-sec\"><h4>Play Next</h4><ul>";
      if (tl.playNext && tl.playNext.length) {
        tl.playNext.forEach(function (t, i) {
          html += row(t, {
            manual: true,
            index: i,
            section: "playNext",
            playable: true,
            removable: true,
            cls: "smp-q-manual",
          });
        });
      } else {
        html += "<li><small>Empty — use Play Next to insert</small></li>";
      }
      html += "</ul></section>";

      var srcLabel = tl.sourceLabel ? "Up Next From " + tl.sourceLabel : "Up Next";
      html += "<section class=\"smp-q-sec\"><h4>" + esc(srcLabel) + "</h4><ul>";
      (tl.upNext || []).slice(0, 24).forEach(function (t, i) {
        html += row(t, {
          cls: "smp-q-upnext",
          section: "upNext",
          index: i,
          playable: true,
          removable: true,
        });
      });
      if (!(tl.upNext && tl.upNext.length)) html += "<li><small>Source finished</small></li>";
      html += "</ul></section>";

      html += "<section class=\"smp-q-sec\"><h4>Autoplay</h4><ul>";
      if (!tl.autoplayEnabled) {
        html += "<li><small>Autoplay off</small></li>";
      } else if (tl.autoplay && tl.autoplay.length) {
        tl.autoplay.slice(0, 16).forEach(function (t, i) {
          html += row(t, {
            cls: "smp-q-auto",
            section: "autoplay",
            index: i,
            playable: true,
            removable: true,
          });
        });
      } else {
        html += "<li><small>Preparing suggestions…</small></li>";
      }
      html += "</ul></section>";
    } else if (this.state.source === "listen" && this.state.queue && this.state.queue.length) {
      html = "<strong>Up next</strong><ul>";
      this.state.queue.slice(this.state.queueIndex + 1, this.state.queueIndex + 8).forEach(function (t) {
        html += row(t);
      });
      html += "</ul>";
    } else if (this._dial.list.length && this._dial.index >= 0) {
      html = "<strong>Dial up next</strong><ul>";
      var list = this._dial.list;
      var idx = this._dial.index;
      for (var n = 1; n <= 6; n++) {
        var st = list[(idx + n) % list.length];
        html +=
          "<li><div class=\"smp-q-main\"><strong>" +
          esc(st.display_name || st.name || "Station") +
          "</strong><small>" +
          esc((st.dial_segment || st.band || "") + (st.dial ? " · " + st.dial : "")) +
          "</small></div></li>";
      }
      html += "</ul>";
    } else {
      html = "<p>No queue yet.</p>";
    }
    panel.innerHTML = html;
    try {
      panel.scrollTop = scrollTop;
    } catch (eScr) {}

    if (!panel.__smpQWired) {
      panel.__smpQWired = true;
      panel.addEventListener("click", function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var U = window.SDMusicUnifiedQueue;
        if (!U) return;
        if (t.matches && t.matches("[data-smp-autoplay-tog]")) {
          U.setAutoplayEnabled(!!t.checked);
          self._renderQueuePanel();
          return;
        }
        if (t.matches && t.matches("[data-smp-q-clear-manual]")) {
          U.clearManual();
          self._renderQueuePanel();
          return;
        }
        var rmBtn = t.closest("[data-smp-q-rm-sec]");
        if (rmBtn) {
          e.preventDefault();
          e.stopPropagation();
          var rsec = rmBtn.getAttribute("data-smp-q-rm-sec");
          var ri = Number(rmBtn.getAttribute("data-smp-q-rm-i"));
          if (typeof U.removeAt === "function") U.removeAt(rsec, ri);
          else if (rsec === "playNext") U.removeManualAt(ri);
          self._renderQueuePanel();
          return;
        }
        var up = t.getAttribute && t.getAttribute("data-smp-q-up");
        if (up != null) {
          e.preventDefault();
          e.stopPropagation();
          var ui = Number(up);
          if (ui > 0) U.reorderManual(ui, ui - 1);
          self._renderQueuePanel();
          return;
        }
        var down = t.getAttribute && t.getAttribute("data-smp-q-down");
        if (down != null) {
          e.preventDefault();
          e.stopPropagation();
          var di = Number(down);
          U.reorderManual(di, di + 1);
          self._renderQueuePanel();
          return;
        }
        var playEl = t.closest("[data-smp-q-play-sec]");
        if (playEl && !t.closest(".smp-q-actions")) {
          e.preventDefault();
          var psec = playEl.getAttribute("data-smp-q-play-sec");
          var pi = Number(playEl.getAttribute("data-smp-q-play-i"));
          if (typeof U.jumpTo === "function" && U.jumpTo(psec, pi)) {
            self._playUnifiedNow();
          }
          self._renderQueuePanel();
        }
      });

      // Swipe-to-remove on tappable/removable rows
      var swipe = { el: null, x0: 0, y0: 0, dx: 0, active: false, axis: null };
      panel.addEventListener(
        "touchstart",
        function (e) {
          var rowEl = e.target && e.target.closest && e.target.closest("li[data-smp-q-play-sec]");
          if (!rowEl || !e.touches || !e.touches[0]) return;
          if (e.target.closest && e.target.closest(".smp-q-actions")) return;
          swipe.el = rowEl;
          swipe.x0 = e.touches[0].clientX;
          swipe.y0 = e.touches[0].clientY;
          swipe.dx = 0;
          swipe.active = true;
          swipe.axis = null;
          rowEl.classList.add("smp-q-swiping");
        },
        { passive: true }
      );
      panel.addEventListener(
        "touchmove",
        function (e) {
          if (!swipe.active || !swipe.el || !e.touches || !e.touches[0]) return;
          var dx = e.touches[0].clientX - swipe.x0;
          var dy = e.touches[0].clientY - swipe.y0;
          if (!swipe.axis) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
            swipe.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
            if (swipe.axis === "y") {
              swipe.active = false;
              swipe.el.classList.remove("smp-q-swiping");
              swipe.el.style.transform = "";
              swipe.el = null;
              return;
            }
          }
          if (swipe.axis !== "x") return;
          swipe.dx = Math.min(0, dx);
          swipe.el.style.transform = "translateX(" + swipe.dx + "px)";
        },
        { passive: true }
      );
      function endSwipe() {
        if (!swipe.el) {
          swipe.active = false;
          return;
        }
        var el = swipe.el;
        var dx = swipe.dx;
        var sec = el.getAttribute("data-smp-q-play-sec");
        var i = Number(el.getAttribute("data-smp-q-play-i"));
        el.classList.remove("smp-q-swiping");
        el.style.transform = "";
        swipe.el = null;
        swipe.active = false;
        swipe.dx = 0;
        if (dx < -72) {
          var U = window.SDMusicUnifiedQueue;
          if (U && typeof U.removeAt === "function") U.removeAt(sec, i);
          self._renderQueuePanel();
        }
      }
      panel.addEventListener("touchend", endSwipe, { passive: true });
      panel.addEventListener("touchcancel", endSwipe, { passive: true });
    }
  };

  PlayerProto._toggleLyrics = function () {
    this._lyrics.visible = !this._lyrics.visible;
    if (!this.root) return;
    var panel = this.root.querySelector("[data-smp-lyrics]");
    if (panel) panel.hidden = !this._lyrics.visible;
    var btn = this.root.querySelector("[data-smp-lyrics-toggle]");
    if (btn) btn.classList.toggle("on", this._lyrics.visible);
    if (this._lyrics.visible) this._fetchLyrics();
  };

  PlayerProto._fetchLyrics = function () {
    var parts = this._nowParts();
    var title = parts.title || (this.state.source === "listen" ? this.state.title : "");
    var artist = parts.artist || (this.state.source === "listen" ? this.state.subtitle : "");
    if (!title) {
      this._renderLyricsUnavailable("Lyrics unavailable");
      return;
    }
    var key = (artist + "|" + title).toLowerCase();
    if (key === this._lyrics.key && this._lyrics.lines.length) {
      this._renderLyrics();
      return;
    }
    this._lyrics.key = key;
    var status = this.root && this.root.querySelector("[data-smp-lyrics-status]");
    if (status) status.textContent = "Loading lyrics…";
    var self = this;
    var u = new URLSearchParams();
    u.set("title", title);
    if (artist) u.set("artist", artist);
    fetch("/api/music/lyrics?" + u.toString(), { credentials: "same-origin" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        if (!data || !data.available) {
          self._lyrics.lines = [];
          self._lyrics.synced = false;
          self._renderLyricsUnavailable("Lyrics unavailable");
          return;
        }
        self._lyrics.lines = data.lines || [];
        self._lyrics.synced = !!data.synced;
        self._renderLyrics();
      })
      .catch(function () {
        self._renderLyricsUnavailable("Lyrics unavailable");
      });
  };

  PlayerProto._renderLyricsUnavailable = function (msg) {
    if (!this.root) return;
    var status = this.root.querySelector("[data-smp-lyrics-status]");
    var scroll = this.root.querySelector("[data-smp-lyrics-scroll]");
    if (status) {
      status.hidden = false;
      status.textContent = msg || "Lyrics unavailable";
    }
    if (scroll) scroll.innerHTML = "";
  };

  PlayerProto._renderLyrics = function () {
    if (!this.root) return;
    var status = this.root.querySelector("[data-smp-lyrics-status]");
    var scroll = this.root.querySelector("[data-smp-lyrics-scroll]");
    if (!scroll) return;
    if (status) status.hidden = true;
    scroll.innerHTML = this._lyrics.lines
      .map(function (ln, i) {
        return (
          '<p data-ly-i="' +
          i +
          '"' +
          (ln.t != null ? ' data-ly-t="' + ln.t + '"' : "") +
          ">" +
          esc(ln.text) +
          "</p>"
        );
      })
      .join("");
  };

  PlayerProto._onTimeUpdate = function () {
    var dockProg = this.root && this.root.querySelector("[data-smp-dock-progress]");
    var dockBar = this.root && this.root.querySelector("[data-smp-dock-progress-bar]");
    if (!this.root || this.state.source !== "listen") {
      var hideSeek = this.root && this.root.querySelector("[data-smp-seek]");
      if (hideSeek) hideSeek.hidden = true;
      if (dockProg) dockProg.hidden = true;
      return;
    }
    var a = this.audio;
    var seekRow = this.root.querySelector("[data-smp-seek]");
    var hasDur = !!(a && a.duration && isFinite(a.duration));
    if (seekRow) seekRow.hidden = !hasDur;
    if (dockProg) dockProg.hidden = !hasDur;
    if (hasDur) {
      var pct = Math.max(0, Math.min(1, a.currentTime / a.duration));
      var range = this.root.querySelector("[data-smp-seek-range]");
      var tcur = this.root.querySelector("[data-smp-tcur]");
      var tdur = this.root.querySelector("[data-smp-tdur]");
      if (range && document.activeElement !== range) {
        range.value = String(Math.round(pct * 1000));
      }
      if (tcur) tcur.textContent = fmtTime(a.currentTime);
      if (tdur) tdur.textContent = fmtTime(a.duration);
      if (dockBar) dockBar.style.width = Math.round(pct * 1000) / 10 + "%";
    }
    if (this._lyrics.visible && this._lyrics.synced) {
      this._syncLyricsHighlight(a.currentTime || 0);
    }
    if (typeof this._syncMediaSession === "function") this._syncMediaSession();
  };


  PlayerProto._syncLyricsHighlight = function (t) {
    var scroll = this.root && this.root.querySelector("[data-smp-lyrics-scroll]");
    if (!scroll) return;
    var lines = this._lyrics.lines;
    var active = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].t == null) continue;
      if (lines[i].t <= t + 0.15) active = i;
      else break;
    }
    scroll.querySelectorAll("p").forEach(function (p, i) {
      p.classList.toggle("active", i === active);
    });
    var el = scroll.querySelector("p.active");
    if (el && typeof el.scrollIntoView === "function") {
      try {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      } catch (e) {}
    }
  };

  /* ——— Play mode / fullscreen video / meta nav / marquee ——— */

  var LS_PLAY_MODE = "sd_music_play_mode";
  /* Spotify-like cycle: Straight (off) → Shuffle → Smart → Repeat song → Repeat playlist */
  var PLAY_MODES = [
    { id: "off", icon: "⇉", label: "Straight play" },
    { id: "shuffle", icon: "🔀", label: "Shuffle" },
    { id: "smart-shuffle", icon: "✨", label: "Smart shuffle" },
    { id: "repeat-one", icon: "🔂", label: "Repeat song" },
    { id: "repeat-all", icon: "🔁", label: "Repeat playlist" },
  ];

  function modeMeta(id) {
    for (var i = 0; i < PLAY_MODES.length; i++) {
      if (PLAY_MODES[i].id === id) return PLAY_MODES[i];
    }
    return PLAY_MODES[0];
  }

  function readStoredMode() {
    try {
      var m = localStorage.getItem(LS_PLAY_MODE) || "";
      if (modeMeta(m).id === m) return m;
    } catch (e) {}
    return "off";
  }

  function writeStoredMode(m) {
    try {
      localStorage.setItem(LS_PLAY_MODE, m);
    } catch (e) {}
  }

  PlayerProto._ensurePlayMode = function () {
    var cur = this.state.playMode;
    if (!cur || modeMeta(cur).id !== cur) {
      this.state.playMode = readStoredMode();
    }
  };

  PlayerProto._setPlayMode = function (mode) {
    var meta = modeMeta(mode);
    this.state.playMode = meta.id;
    writeStoredMode(meta.id);
    this._syncPlayModeBtn();
    try {
      if (window.SDMusicUnifiedQueue && this.state.source === "listen") {
        window.SDMusicUnifiedQueue.setPlayMode(meta.id);
      }
    } catch (e) {}
    return meta.id;
  };

  PlayerProto._cyclePlayMode = function () {
    this._ensurePlayMode();
    var cur = this.state.playMode;
    // Radio: skip shuffle modes when dial too small — still cycle but disable with tooltip
    var idx = 0;
    for (var i = 0; i < PLAY_MODES.length; i++) {
      if (PLAY_MODES[i].id === cur) {
        idx = i;
        break;
      }
    }
    var next = PLAY_MODES[(idx + 1) % PLAY_MODES.length];
    return this._setPlayMode(next.id);
  };

  PlayerProto._syncPlayModeBtn = function () {
    if (!this.root) return;
    this._ensurePlayMode();
    var btn = this.root.querySelector("[data-smp-play-mode]");
    if (!btn) return;
    var meta = modeMeta(this.state.playMode);
    btn.textContent = meta.icon;
    btn.dataset.mode = meta.id;
    var radio = this.state.source === "radio";
    var dialN = (this._dial && this._dial.list && this._dial.list.length) || 0;
    var shuffleOff =
      radio &&
      (meta.id === "shuffle" || meta.id === "smart-shuffle") &&
      dialN < 2;
    btn.disabled = false;
    btn.classList.toggle("is-disabled-soft", !!shuffleOff);
    var tip = meta.label;
    if (meta.id === "off") tip = radio ? "Straight play · sequential stations" : "Off · Straight play";
    if (radio && meta.id === "repeat-one") tip = "Repeat song · reload stream";
    if (radio && meta.id === "repeat-all") tip = "Repeat dial · sequential stations";
    if (shuffleOff) tip = meta.label + " · need 2+ dial stations";
    else if (radio && (meta.id === "shuffle" || meta.id === "smart-shuffle")) {
      tip = meta.label + " · among dial list";
    }
    btn.title = tip;
    btn.setAttribute("aria-label", tip);
  };

  PlayerProto._pickQueueIndex = function (queue, cur, dir, mode) {
    queue = queue || [];
    var n = queue.length;
    if (!n) return -1;
    cur = cur == null || cur < 0 ? 0 : cur;
    mode = mode || this.state.playMode || "off";
    dir = dir == null ? 1 : dir;

    if (dir === 0) {
      // track ended
      if (mode === "repeat-one") return cur;
      dir = 1;
    }

    // off / repeat-one / repeat-all → sequential; only repeat-all wraps
    if (mode === "off" || mode === "repeat-one" || mode === "repeat-all") {
      var next = cur + dir;
      if (next >= n) return mode === "repeat-all" ? 0 : -1;
      if (next < 0) return mode === "repeat-all" ? n - 1 : -1;
      return next;
    }

    // shuffle / smart-shuffle
    var candidates = [];
    for (var i = 0; i < n; i++) if (i !== cur) candidates.push(i);
    if (!candidates.length) return mode === "repeat-all" ? cur : -1;

    if (mode === "smart-shuffle" && window.SDMusicTaste && typeof window.SDMusicTaste.rankItems === "function") {
      var items = candidates.map(function (i) {
        return queue[i];
      });
      var seed = cur >= 0 && queue[cur] ? [queue[cur]] : [];
      var entryPath = "";
      try {
        var UQ = window.SDMusicUnifiedQueue;
        var sess = UQ && typeof UQ.getSession === "function" ? UQ.getSession() : null;
        entryPath =
          (sess && sess.source && (sess.source.entryPath || sess.source.type)) ||
          this.state.entryPath ||
          this.state.sourceType ||
          "listen";
      } catch (e) {
        entryPath = "listen";
      }
      var ranked = window.SDMusicTaste.rankItems(items, {
        smartShuffle: true,
        seedItems: seed,
        entryPath: entryPath,
      });
      var recent = {};
      try {
        (window.SDMusicTaste.getRecent(16) || []).forEach(function (r) {
          var id = r && (r.videoId || r.id);
          if (id) recent[String(id)] = 1;
        });
      } catch (e) {}
      var pick = null;
      for (var r = 0; r < ranked.length; r++) {
        var t = ranked[r];
        var vid = t && (t.videoId || t.id);
        if (!vid || recent[String(vid)]) continue;
        var idx = queue.findIndex(function (q) {
          return q && String(q.videoId || q.id || "") === String(vid);
        });
        if (idx >= 0 && idx !== cur) {
          pick = idx;
          break;
        }
      }
      if (pick == null && ranked[0]) {
        var rid = ranked[0].videoId || ranked[0].id;
        if (rid) {
          pick = queue.findIndex(function (q) {
            return q && String(q.videoId || q.id || "") === String(rid);
          });
        }
      }
      if (pick != null && pick >= 0) return pick;
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
  };

  PlayerProto._radioNavByMode = function (dir) {
    this._ensurePlayMode();
    var mode = this.state.playMode;
    var list = this._dial.list || [];
    if (list.length < 2) {
      this.tuneDial(dir);
      return;
    }
    if (mode === "shuffle" || mode === "smart-shuffle") {
      var cur = this._dial.index;
      if (cur < 0 && this.state.id) {
        cur = list.findIndex(
          function (s) {
            return String(s.stationuuid) === String(this.state.id);
          }.bind(this)
        );
      }
      var idxs = [];
      for (var i = 0; i < list.length; i++) if (i !== cur) idxs.push(i);
      if (!idxs.length) return;
      var pick = idxs[Math.floor(Math.random() * idxs.length)];
      if (mode === "smart-shuffle" && window.SDMusicTaste) {
        try {
          var seedSt = cur >= 0 && list[cur] ? [list[cur]] : [];
          var ranked = window.SDMusicTaste.rankItems(
            idxs.map(function (i) {
              return list[i];
            }),
            { smartShuffle: true, seedItems: seedSt, entryPath: "radio" }
          );
          if (ranked && ranked[0]) {
            var id = ranked[0].stationuuid || ranked[0].id;
            var found = list.findIndex(function (s) {
              return String(s.stationuuid) === String(id);
            });
            if (found >= 0) pick = found;
          }
        } catch (e) {}
      }
      var delta = pick - (cur < 0 ? 0 : cur);
      // tuneDial uses modulo + debounce; jump by setting index via onDialTune
      this._swipe.lastTune = 0;
      this._dial.index = pick;
      this._syncDialHint();
      var st = list[pick];
      if (typeof window.StepDaddyMusicRadio === "object" && typeof window.StepDaddyMusicRadio.playStation === "function") {
        window.StepDaddyMusicRadio.playStation(st);
      } else if (typeof this._handlers.onDialTune === "function") {
        this._handlers.onDialTune(st, pick);
      }
      return;
    }
    this.tuneDial(dir);
  };

  PlayerProto._radioOnEnded = function () {
    this._ensurePlayMode();
    var mode = this.state.playMode;
    if (mode === "repeat-one" && this.state.station) {
      if (typeof window.StepDaddyMusicRadio === "object" && typeof window.StepDaddyMusicRadio.playStation === "function") {
        window.StepDaddyMusicRadio.playStation(this.state.station);
        return;
      }
      // reload current stream
      if (this.state.streamUrl) {
        this.play({
          source: "radio",
          id: this.state.id,
          title: this.state.title,
          subtitle: this.state.subtitle,
          artwork: this.state.artwork,
          streamUrl: this.state.streamUrl,
          hls: this.state.hls,
          videoUrl: this.state.videoUrl,
          band: this.state.band,
          dial: this.state.dial,
          homepage: this.state.homepage,
          genre: this.state.genre,
          station: this.state.station,
          dialList: this._dial.list,
          onPrev: this._handlers.onPrev,
          onNext: this._handlers.onNext,
          onDialTune: this._handlers.onDialTune,
        });
      }
      return;
    }
    if (mode === "shuffle" || mode === "smart-shuffle") {
      this._radioNavByMode(1);
      return;
    }
    // off / repeat-all → sequential next dial
    this.tuneDial(1);
  };

  PlayerProto._syncMarquee = function () {
    if (!this.root) return;
    var self = this;
    requestAnimationFrame(function () {
      if (!self.root) return;
      self.root.querySelectorAll(".smp-marquee").forEach(function (el) {
        if (el.hidden) {
          el.classList.remove("is-overflow");
          return;
        }
        var inner = el.querySelector(".smp-marquee-inner");
        if (!inner) return;
        var overflow = inner.scrollWidth > el.clientWidth + 4;
        el.classList.toggle("is-overflow", overflow);
        if (overflow) {
          el.style.setProperty("--smp-mq-dist", inner.scrollWidth - el.clientWidth + 12 + "px");
          var dur = Math.max(8, Math.min(28, (inner.scrollWidth - el.clientWidth) / 28));
          el.style.setProperty("--smp-mq-dur", dur + "s");
        }
      });
    });
  };

  PlayerProto._syncMetaNav = function () {
    if (!this.root) return;
    var titleBtn = this.root.querySelector("[data-smp-title-lg]");
    var artistBtn = this.root.querySelector("[data-smp-sub-lg]");
    var canAlbum = !!(this.state.albumId || this.state.title);
    var canArtist = !!(this.state.artistId || this.state.subtitle || (this.state.now && this.state.now.artist));
    if (titleBtn) {
      titleBtn.classList.toggle("is-nav", canAlbum);
      titleBtn.title = canAlbum ? "Open album" : "";
      titleBtn.disabled = !canAlbum;
    }
    if (artistBtn) {
      artistBtn.classList.toggle("is-nav", canArtist);
      artistBtn.title = canArtist ? "Open artist" : "";
      artistBtn.disabled = !canArtist;
    }
  };

  PlayerProto._openListenBrowse = function (kind) {
    var self = this;
    var artistName =
      (this.state.now && this.state.now.artist) || this.state.subtitle || "";
    var songTitle = (this.state.now && this.state.now.title) || this.state.title || "";
    var albumId = this.state.albumId;
    var artistId = this.state.artistId;

    function goListen(fn) {
      try {
        if (window.SDMusic && typeof window.SDMusic.open === "function") {
          window.SDMusic.open({ replace: true, tab: "listen" });
        }
      } catch (e) {}
      self.setExpanded(false);
      return Promise.resolve()
        .then(fn)
        .catch(function () {});
    }

    if (kind === "artist") {
      if (artistId) {
        return goListen(function () {
          if (window.StepDaddyMusicListen && window.StepDaddyMusicListen.openArtist) {
            window.StepDaddyMusicListen.openArtist(artistId, artistName || "Artist");
          }
        });
      }
      var aq = artistName || songTitle;
      if (!aq) return;
      return goListen(function () {
        return fetch(
          "/api/music/listen/search?q=" + encodeURIComponent(aq) + "&filter=artists&limit=8",
          { credentials: "same-origin" }
        )
          .then(function (r) {
            return r.ok ? r.json() : null;
          })
          .then(function (data) {
            var items = (data && data.items) || [];
            var hit =
              items.find(function (i) {
                return i && i.kind === "artist" && i.browseId;
              }) ||
              items.find(function (i) {
                return i && i.browseId && String(i.browseId).indexOf("UC") === 0;
              });
            if (hit && window.StepDaddyMusicListen && window.StepDaddyMusicListen.openArtist) {
              window.StepDaddyMusicListen.openArtist(hit.browseId, hit.title || artistName);
              return;
            }
            if (window.StepDaddyMusicListen && window.StepDaddyMusicListen.openSearch) {
              window.StepDaddyMusicListen.openSearch(aq);
            }
          });
      });
    }

    // album / title
    if (albumId) {
      return goListen(function () {
        if (window.StepDaddyMusicListen && window.StepDaddyMusicListen.openAlbum) {
          window.StepDaddyMusicListen.openAlbum(albumId, self.state.albumTitle || songTitle || "Album");
        }
      });
    }
    var q = [artistName, songTitle].filter(Boolean).join(" ").trim() || songTitle;
    if (!q) return;
    return goListen(function () {
      return fetch(
        "/api/music/listen/search?q=" + encodeURIComponent(q) + "&filter=albums&limit=8",
        { credentials: "same-origin" }
      )
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (data) {
          var items = (data && data.items) || [];
          var hit = items.find(function (i) {
            return i && i.browseId && (i.kind === "album" || String(i.browseId).indexOf("MPRE") === 0);
          });
          if (hit && window.StepDaddyMusicListen && window.StepDaddyMusicListen.openAlbum) {
            window.StepDaddyMusicListen.openAlbum(hit.browseId, hit.title || songTitle);
            return;
          }
          // fallback: songs search → related album context via artist page or search
          return fetch(
            "/api/music/listen/search?q=" + encodeURIComponent(q) + "&filter=songs&limit=8",
            { credentials: "same-origin" }
          )
            .then(function (r) {
              return r.ok ? r.json() : null;
            })
            .then(function (songData) {
              var songs = (songData && songData.items) || [];
              var withAlbum = songs.find(function (s) {
                return s && s.albumId;
              });
              if (withAlbum && window.StepDaddyMusicListen && window.StepDaddyMusicListen.openAlbum) {
                window.StepDaddyMusicListen.openAlbum(withAlbum.albumId, withAlbum.albumTitle || songTitle);
                return;
              }
              if (window.StepDaddyMusicListen && window.StepDaddyMusicListen.openSearch) {
                window.StepDaddyMusicListen.openSearch(q);
              }
            });
        });
    });
  };

  PlayerProto._enterVideoFullscreen = function () {
    if (!this.root || !this.state.videoUrl || !this.root.classList.contains("has-video")) return;
    var preview = this.videoLg;
    var shell = this.root.querySelector("[data-smp-video-fs]");
    var fsVid = this.root.querySelector("[data-smp-video-fs-el]");
    if (!shell || !fsVid) return;
    var t = 0;
    try {
      if (preview && isFinite(preview.currentTime)) t = preview.currentTime;
    } catch (e) {}
    this.state.videoFs = true;
    shell.hidden = false;
    this.root.classList.add("video-fs");
    try {
      if (!fsVid.src || fsVid.src.indexOf(this.state.videoUrl) < 0) {
        fsVid.src = this.state.videoUrl;
      }
      fsVid.muted = true;
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
  };

  PlayerProto._exitVideoFullscreen = function (clear) {
    if (!this.root) return;
    var shell = this.root.querySelector("[data-smp-video-fs]");
    var fsVid = this.root.querySelector("[data-smp-video-fs-el]");
    var preview = this.videoLg;
    var t = 0;
    try {
      if (fsVid && isFinite(fsVid.currentTime)) t = fsVid.currentTime;
    } catch (e) {}
    this.state.videoFs = false;
    this.root.classList.remove("video-fs");
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
    if (!clear && preview && this.state.videoUrl && this.root.classList.contains("has-video")) {
      try {
        if (Math.abs((preview.currentTime || 0) - t) > 0.35) preview.currentTime = t;
        var p = preview.play();
        if (p && p.catch) p.catch(function () {});
      } catch (e) {}
    }
  };

  PlayerProto._wireUxExtras = function () {
    if (!this.root || this.root.__smpUxWired) return;
    this.root.__smpUxWired = true;
    var self = this;
    this._ensurePlayMode();

    var modeBtn = this.root.querySelector("[data-smp-play-mode]");
    if (modeBtn) {
      modeBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        self._cyclePlayMode();
      });
    }

    this.root.querySelectorAll("[data-smp-nav]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var kind = btn.getAttribute("data-smp-nav");
        self._openListenBrowse(kind === "artist" ? "artist" : "album");
      });
    });

    var vlg = this.videoLg;
    if (vlg) {
      var tap = { x0: 0, y0: 0, t0: 0 };
      vlg.addEventListener(
        "pointerdown",
        function (ev) {
          tap.x0 = ev.clientX;
          tap.y0 = ev.clientY;
          tap.t0 = Date.now();
        },
        { passive: true }
      );
      vlg.addEventListener("click", function (ev) {
        if (!self.root.classList.contains("has-video") || !self.state.expanded) return;
        var dx = Math.abs(ev.clientX - tap.x0);
        var dy = Math.abs(ev.clientY - tap.y0);
        if (dx > 14 || dy > 14) return;
        ev.stopPropagation();
        self._enterVideoFullscreen();
      });
    }

    var closeFs = this.root.querySelector("[data-smp-video-fs-close]");
    if (closeFs) {
      closeFs.addEventListener("click", function (e) {
        e.stopPropagation();
        self._exitVideoFullscreen(false);
      });
    }
    var fsShell = this.root.querySelector("[data-smp-video-fs]");
    if (fsShell) {
      fsShell.addEventListener("click", function (e) {
        if (e.target === fsShell) self._exitVideoFullscreen(false);
      });
    }

    window.addEventListener(
      "resize",
      function () {
        self._syncMarquee();
      },
      { passive: true }
    );

    this._syncPlayModeBtn();
    this._syncMarquee();
  };
})();
