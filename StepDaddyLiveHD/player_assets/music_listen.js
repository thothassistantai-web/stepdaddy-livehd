/**
 * StepDaddy Music Listen — YouTube Music shelves (streaming only).
 * Mount: window.StepDaddyMusicListen.mount(containerEl, { onClose? })
 * Shell mounts into #musicListenRoot via player_music.js.
 */
(function () {
  if (window.StepDaddyMusicListen) return;

  const API = "/api/music/listen";

  function ensureCss() {
    if (document.getElementById("sd-music-listen-css")) return;
    const link = document.createElement("link");
    link.id = "sd-music-listen-css";
    link.rel = "stylesheet";
    link.href = "/tv-assets/music_listen.css?v=" + encodeURIComponent(window.__SD_BUNDLE_VERSION || "1");
    document.head.appendChild(link);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function trackCountLabel(n) {
    var c = Number(n) || 0;
    return c === 1 ? "1 track" : c + " tracks";
  }

  function qs(params) {
    const u = new URLSearchParams();
    Object.keys(params || {}).forEach(function (k) {
      const v = params[k];
      if (v !== undefined && v !== null && v !== "") u.set(k, v);
    });
    const s = u.toString();
    return s ? "?" + s : "";
  }

  async function api(path, params) {
    const r = await fetch(API + path + qs(params), { credentials: "same-origin" });
    if (!r.ok) throw new Error("listen_api_" + r.status);
    return r.json();
  }

  function Mount(container, opts) {
    opts = opts || {};
    ensureCss();
    container.classList.add("sd-music-listen");
    container.innerHTML = "";

    const head = document.createElement("div");
    head.className = "ml-head";
    head.innerHTML =
      '<button type="button" class="ml-back" data-ml-back aria-label="Back">←</button>' +
      '<div><div class="ml-title">Listen</div><div class="ml-sub" data-ml-sub>YouTube Music · stream only</div></div>';
    container.appendChild(head);

    const searchRow = document.createElement("form");
    searchRow.className = "ml-search";
    searchRow.innerHTML =
      '<input type="search" enterkeyhint="search" placeholder="Search songs, albums, artists…" data-ml-q aria-label="Search music" autocomplete="off"/>' +
      '<button type="submit" aria-label="Search">Go</button>';
    // Unified #musicUnifiedSearch is the primary Music search — hide nested Listen bar
    // when that shell exists to avoid dual-search clutter. openSearch still drives results.
    const hasUnified =
      !!document.getElementById("musicUnifiedSearch") ||
      !!document.querySelector("[data-music-search]");
    if (hasUnified) {
      searchRow.hidden = true;
      searchRow.classList.add("ml-search-demoted");
      searchRow.setAttribute("aria-hidden", "true");
    }
    container.appendChild(searchRow);

    const hint = document.createElement("div");
    hint.className = "ml-hint";
    hint.textContent = "Personal streaming · no downloads";
    container.appendChild(hint);

    const body = document.createElement("div");
    body.className = "ml-body";
    container.appendChild(body);

    let stack = []; // { view, title, data? }
    let queue = [];
    let qIndex = -1;
    let homeData = null;
    let streamRetry = Object.create(null);
    /** In-memory Listen stream token cache: videoId → { data, at } */
    var streamCache = Object.create(null);
    var streamInflight = Object.create(null);
    var STREAM_CACHE_TTL_MS = 8 * 60 * 1000;
    var STREAM_CACHE_MAX = 24;

    function setSub(t) {
      const el = head.querySelector("[data-ml-sub]");
      if (el) el.textContent = t || "YouTube Music · stream only";
    }

    function sharedPlayer() {
      return window.StepDaddyMusicPlayer;
    }

    function UQ() {
      return window.SDMusicUnifiedQueue;
    }

    function stopPlayback() {
      qIndex = -1;
      try {
        if (UQ()) UQ().reset();
      } catch (e) {}
      try {
        if (sharedPlayer()) sharedPlayer().stop();
      } catch (e) {}
    }

    function playMode() {
      try {
        var P = sharedPlayer();
        if (P && typeof P.getPlayMode === "function") return P.getPlayMode();
      } catch (e) {}
      return "off";
    }

    function syncFlatFromUnified() {
      var u = UQ();
      if (!u) return;
      queue = u.asFlatQueue();
      qIndex = u.currentIndex();
    }

    function peekNextMeta() {
      var u = UQ();
      var nextTrack = u ? u.peekNext() : null;
      if (!nextTrack && queue.length && qIndex >= 0 && qIndex + 1 < queue.length) {
        nextTrack = queue[qIndex + 1];
      }
      return nextTrack
        ? {
            title: nextTrack.title,
            artist:
              (nextTrack.artists && nextTrack.artists.join(", ")) ||
              nextTrack.subtitle ||
              "",
          }
        : null;
    }

    function cacheGet(videoId) {
      if (!videoId) return null;
      var hit = streamCache[videoId];
      if (!hit) return null;
      if (Date.now() - hit.at > STREAM_CACHE_TTL_MS) {
        delete streamCache[videoId];
        return null;
      }
      return hit.data;
    }

    function cachePut(videoId, data) {
      if (!videoId || !data || !data.stream_url) return;
      streamCache[videoId] = { data: data, at: Date.now() };
      var keys = Object.keys(streamCache);
      if (keys.length > STREAM_CACHE_MAX) {
        keys
          .sort(function (a, b) {
            return (streamCache[a].at || 0) - (streamCache[b].at || 0);
          })
          .slice(0, keys.length - STREAM_CACHE_MAX)
          .forEach(function (k) {
            delete streamCache[k];
          });
      }
    }

    function fetchStream(videoId, opts) {
      opts = opts || {};
      if (!videoId) return Promise.reject(new Error("no_id"));
      if (!opts.force) {
        var cached = cacheGet(videoId);
        if (cached) return Promise.resolve(cached);
      }
      if (streamInflight[videoId]) return streamInflight[videoId];
      streamInflight[videoId] = api("/stream/" + encodeURIComponent(videoId))
        .then(function (data) {
          if (!data || !data.stream_url) throw new Error("no_stream");
          cachePut(videoId, data);
          return data;
        })
        .finally(function () {
          delete streamInflight[videoId];
        });
      return streamInflight[videoId];
    }

    /** Prefetch next 1–2 upcoming Listen stream tokens; warm Autoplay when Up Next is thin. */
    function prewarmUpcoming(n) {
      n = n == null ? 2 : n;
      var u = UQ();
      if (!u) return;
      try {
        if (typeof u.prepareAutoplay === "function") {
          var sess = typeof u.getSession === "function" ? u.getSession() : null;
          var upLen = (sess && sess.upNext && sess.upNext.length) || 0;
          if (upLen <= 2) u.prepareAutoplay();
        }
      } catch (ePrep) {}
      var ids = [];
      try {
        var flat = typeof u.asFlatQueue === "function" ? u.asFlatQueue() : [];
        flat.slice(1, 1 + n).forEach(function (t) {
          var id = t && (t.videoId || t.id);
          if (id) ids.push(String(id));
        });
      } catch (eFlat) {
        try {
          var peek = u.peekNext && u.peekNext();
          if (peek && (peek.videoId || peek.id)) ids.push(String(peek.videoId || peek.id));
        } catch (ePeek) {}
      }
      ids.forEach(function (id) {
        if (cacheGet(id) || streamInflight[id]) return;
        fetchStream(id).catch(function () {});
      });
    }

    function smartNav(dir) {
      var u = UQ();
      // dir: -1 prev, 1 next, 0 ended
      if (u && (dir === 1 || dir === 0)) {
        function playResolved(res) {
          if (!res) return;
          if (res.ended) {
            try {
              var P = sharedPlayer();
              if (P && P._instance) {
                P._instance.state.playing = false;
                P._instance._wantPlaying = false;
                if (P._instance.audio) P._instance.audio.pause();
                if (typeof P._instance._syncPlayButtons === "function") P._instance._syncPlayButtons();
              }
            } catch (e) {}
            return;
          }
          if (res.waiting) {
            var waiters = [];
            try {
              if (typeof u.prepareAutoplay === "function") waiters.push(u.prepareAutoplay());
            } catch (e) {}
            try {
              var sess = typeof u.getSession === "function" ? u.getSession() : null;
              if (sess && sess.ecosystemPending) {
                waiters.push(
                  new Promise(function (resolve) {
                    var n = 0;
                    var timer = setInterval(function () {
                      n += 1;
                      var s = u.getSession();
                      if (!s || !s.ecosystemPending || (s.upNext && s.upNext.length) || n > 48) {
                        clearInterval(timer);
                        resolve();
                      }
                    }, 250);
                  })
                );
              }
            } catch (e2) {}
            Promise.all(waiters.length ? waiters : [Promise.resolve()]).then(function () {
              var again = u.advanceNext({ fromEnded: dir === 0 });
              if (again && again.track) playTrackObject(again.track);
              else if (again && again.ended) playResolved(again);
            });
            return;
          }
          if (res.repeated && res.track) {
            playTrackObject(res.track, { restart: true });
            return;
          }
          if (res.track) playTrackObject(res.track);
        }
        var res = u.advanceNext({
          fromEnded: dir === 0,
          forceRepeatOne: dir === 0 && playMode() === "repeat-one",
        });
        playResolved(res);
        return;
      }
      if (u && dir < 0) {
        var prev = u.advancePrev();
        if (prev && prev.track) playTrackObject(prev.track);
        return;
      }
      // Legacy fallback without unified queue
      var ni = qIndex + (dir == null || dir === 0 ? 1 : dir);
      if (ni >= 0 && ni < queue.length) playIndex(ni);
      else if (dir === 0 || playMode() === "off") {
        try {
          var P2 = sharedPlayer();
          if (P2 && P2._instance) {
            P2._instance.state.playing = false;
            P2._instance._wantPlaying = false;
            if (P2._instance.audio) P2._instance.audio.pause();
          }
        } catch (e) {}
      }
    }

    function playTrackObject(track, opts) {
      opts = opts || {};
      if (!track || !track.videoId) {
        smartNav(1);
        return;
      }
      syncFlatFromUnified();
      var flatIdx = queue.findIndex(function (t) {
        return t && t.videoId === track.videoId;
      });
      if (flatIdx < 0) {
        queue = [track].concat(queue.filter(Boolean));
        flatIdx = 0;
      }
      playIndex(flatIdx, opts);
    }

    async function playIndex(i, opts) {
      opts = opts || {};
      if (i < 0 || i >= queue.length) return;
      const track = queue[i];
      if (!track || !track.videoId) return;
      const P = sharedPlayer();
      if (!P || typeof P.play !== "function") return;
      qIndex = i;
      const subtitle =
        (track.artists && track.artists.join(", ")) || track.subtitle || track.uploader || "";
      const artistId =
        track.artistId ||
        (track.artistIds && track.artistIds[0]) ||
        "";
      var retryKey = track.videoId;
      try {
        const data = await fetchStream(track.videoId, { force: !!opts.forceStream });
        if (!data || !data.stream_url) throw new Error("no_stream");
        streamRetry[retryKey] = 0;
        const title = data.title || track.title || "Track";
        const artist = data.uploader || subtitle;
        var nextMeta = peekNextMeta();
        var u = UQ();
        prewarmUpcoming(2);
        if (u) {
          u.prepareAutoplay();
        }
        var albumId =
          track.albumId ||
          (u && u.getSession && u.getSession().source && u.getSession().source.type === "album"
            ? u.getSession().source.id
            : "") ||
          "";
        var albumTitle =
          track.albumTitle ||
          (u && u.getSession && u.getSession().source ? u.getSession().source.title : "") ||
          "";
        await P.play({
          source: "listen",
          id: track.videoId,
          title: title,
          subtitle: artist,
          artwork: data.thumb || track.thumb || "",
          streamUrl: data.stream_url,
          videoUrl: data.video_stream_url || "",
          albumId: albumId,
          albumTitle: albumTitle,
          artistId: artistId,
          track: track,
          now: { title: title, artist: artist },
          next: nextMeta,
          queue: u ? u.asFlatQueue() : queue,
          queueIndex: u ? u.currentIndex() : i,
          onEnded: function () {
            smartNav(0);
          },
          onPrev: function () {
            smartNav(-1);
          },
          onNext: function () {
            smartNav(1);
          },
        });
        if (opts.restart && P._instance && P._instance.audio) {
          try {
            P._instance.audio.currentTime = 0;
          } catch (eR) {}
        }
        // Keep warming while current track plays
        setTimeout(function () {
          prewarmUpcoming(2);
        }, 1200);
        syncFlatFromUnified();
      } catch (e) {
        try {
          P.setNowNext({ now: { title: "Couldn’t play — trying next…" } });
        } catch (err) {}
        // Retry once, then skip to next playable — don't kill session
        var tries = streamRetry[retryKey] || 0;
        if (tries < 1) {
          streamRetry[retryKey] = tries + 1;
          setTimeout(function () {
            playIndex(i, Object.assign({}, opts, { forceStream: true }));
          }, 400);
          return;
        }
        streamRetry[retryKey] = 0;
        setTimeout(function () {
          if (UQ()) {
            var skipped = UQ().skipUnavailable();
            if (skipped && skipped.track) playTrackObject(skipped.track);
            else if (skipped && skipped.waiting) {
              UQ().prepareAutoplay().then(function () {
                var again = UQ().advanceNext({ fromEnded: true });
                if (again && again.track) playTrackObject(again.track);
              });
            }
          } else {
            smartNav(1);
          }
        }, 350);
      }
    }

    function playTracks(tracks, startId, surface, meta) {
      var seeds = (tracks || []).filter(function (t) {
        return t && t.videoId;
      });
      if (!seeds.length) return;
      meta = meta || {};
      var srcMeta = {
        type: surface || meta.type || "listen",
        id: meta.albumId || meta.artistId || meta.playlistId || meta.id || "",
        title: meta.albumTitle || meta.artistName || meta.playlistTitle || meta.title || "",
        albumId: meta.albumId,
        artistId:
          meta.artistId ||
          (seeds[0] && (seeds[0].artistId || (seeds[0].artistIds && seeds[0].artistIds[0]))) ||
          "",
        artistName:
          meta.artistName ||
          (seeds[0] && ((seeds[0].artists && seeds[0].artists[0]) || seeds[0].subtitle)) ||
          "",
        entryPath: meta.entryPath || surface || "listen",
        surface: surface,
      };
      if (surface === "album" && !srcMeta.id) {
        srcMeta.id = (seeds[0] && seeds[0].albumId) || "";
        srcMeta.title = (seeds[0] && seeds[0].albumTitle) || srcMeta.title;
        srcMeta.type = "album";
        srcMeta.entryPath = "album";
      }
      if ((surface === "directory" || surface === "tracks-directory" || surface === "videos-directory") && !srcMeta.artistId) {
        srcMeta.artistId = resolveArtistChannel(seeds[0]) || srcMeta.artistId;
      }
      var u = UQ();
      if (u) {
        u.startFromSource(seeds, startId || (seeds[0] && seeds[0].videoId), srcMeta, {
          playMode: playMode(),
          clearManual: true,
          extendArtistEcosystem: true,
        });
        syncFlatFromUnified();
        var now = u.getTimeline().now;
        if (now) playTrackObject(now);
        return;
      }
      queue = seeds;
      let idx = 0;
      if (startId) {
        const found = queue.findIndex(function (t) {
          return t.videoId === startId;
        });
        if (found >= 0) idx = found;
      }
      playIndex(idx);
    }

    head.querySelector("[data-ml-back]").addEventListener("click", function () {
      if (stack.length) {
        stack.pop();
        render();
        return;
      }
      if (typeof opts.onBack === "function") opts.onBack();
      else if (typeof opts.onClose === "function") opts.onClose();
    });

    searchRow.addEventListener("submit", function (e) {
      e.preventDefault();
      const q = (searchRow.querySelector("[data-ml-q]").value || "").trim();
      if (!q) return;
      stack.push({ view: "search", title: "Search", q: q });
      render();
    });

    function placeholderArt(item) {
      if (item && item.thumb) {
        return '<img class="art" src="' + esc(item.thumb) + '" alt="" loading="lazy" referrerpolicy="no-referrer"/>';
      }
      return '<span class="art" aria-hidden="true"></span>';
    }

    function resolveArtistChannel(item) {
      if (!item) return "";
      var channel =
        item.browseId ||
        item.channelId ||
        item.artistId ||
        (item.artistIds && item.artistIds[0]) ||
        "";
      channel = String(channel || "").trim();
      // Album browse ids are MPRE… — never treat as artist channels.
      if (channel && channel.indexOf("MPRE") === 0) return "";
      // Prefer YouTube channel ids (UC…) when present.
      if (channel && channel.indexOf("UC") === 0) return channel;
      // Some payloads use bare channel-like ids without UC — still try.
      if (channel && channel.indexOf("MP") !== 0 && channel.length >= 12) return channel;
      return "";
    }

    function openArtistItem(item) {
      if (!item) return false;
      var channel = resolveArtistChannel(item);
      var title = item.title || item.name || "Artist";
      if (channel) {
        stack.push({
          view: "artist",
          title: title,
          channelId: channel,
        });
        render();
        return true;
      }
      var q = String(item._q || item.title || item.name || "").trim();
      if (!q) return false;
      // Resolve name-only / taste stubs to a real artist channel, then open hierarchy.
      body.innerHTML = '<div class="ml-loading">Opening artist…</div>';
      head.querySelector(".ml-title").textContent = title;
      setSub("Artist");
      api("/search", { q: q, filter: "artists", limit: 10 })
        .then(function (data) {
          var hit = ((data && data.items) || []).find(function (i) {
            return i && resolveArtistChannel(i);
          });
          if (hit) {
            stack.push({
              view: "artist",
              title: hit.title || q,
              channelId: resolveArtistChannel(hit),
            });
          } else {
            stack.push({ view: "search", title: "Search", q: q });
          }
          return render();
        })
        .catch(function () {
          stack.push({ view: "search", title: "Search", q: q });
          return render();
        });
      return true;
    }

    function openItem(item) {
      if (!item) return;
      if (item.kind === "mood" && item.params) {
        stack.push({ view: "mood", title: item.title || "Mood", params: item.params });
        render();
        return;
      }
      if (
        item.kind === "album" ||
        (item.browseId && String(item.browseId).indexOf("MPRE") === 0)
      ) {
        if (item.browseId) {
          stack.push({ view: "album", title: item.title || "Album", browseId: item.browseId });
          render();
          return;
        }
      }
      if (item.kind === "playlist" && item.playlistId) {
        stack.push({ view: "playlist", title: item.title || "Playlist", playlistId: item.playlistId });
        render();
        return;
      }
      if (
        item.kind === "artist" ||
        item.kind === "search_artist" ||
        (item.browseId && String(item.browseId).indexOf("UC") === 0)
      ) {
        if (openArtistItem(item)) return;
      }
      if (item.videoId) {
        playTracks([item], item.videoId, "watch", {
          title: item.title,
          artistName: item.subtitle || (item.artists && item.artists[0]) || "",
          artistId: item.artistId || resolveArtistChannel(item) || "",
          albumId: item.albumId || "",
        });
      }
    }

    function addChrome(item) {
      var Lib = window.SDMusicLibrary;
      var plus = Lib && typeof Lib.addBtnHtml === "function" ? Lib.addBtnHtml() : "";
      var more =
        Lib && typeof Lib.moreBtnHtml === "function"
          ? Lib.moreBtnHtml()
          : '<span role="button" tabindex="0" class="ml-more" data-ml-more aria-label="More" title="More">⋮</span>';
      return '<span class="ml-actions">' + plus + more + "</span>";
    }

    function wireCardAdd(host, item) {
      try {
        var Lib = window.SDMusicLibrary;
        if (!Lib) return;
        if (typeof Lib.wireRowActions === "function") {
          Lib.wireRowActions(host, item, { longPress: !!(Lib.isPlayableTrack && Lib.isPlayableTrack(item)) });
          return;
        }
        if (typeof Lib.wireAddButton === "function") {
          var btn = host.querySelector("[data-ml-add]");
          if (btn) Lib.wireAddButton(btn, item);
        }
      } catch (e) {}
    }

    function renderFeatured(item) {
      if (!item) return null;
      var sec = document.createElement("div");
      sec.className = "ml-section ml-featured";
      var art = item.thumb
        ? '<img class="ml-featured-art" src="' + esc(item.thumb) + '" alt="" loading="lazy" referrerpolicy="no-referrer"/>'
        : '<div class="ml-featured-art ml-featured-ph" aria-hidden="true"></div>';
      var kicker =
        item.kind === "artist"
          ? "Featured artist"
          : item.kind === "album"
            ? "Featured album"
            : item.kind === "playlist"
              ? "Featured playlist"
              : "Featured";
      sec.innerHTML =
        '<div class="ml-featured-card" role="button" tabindex="0">' +
        '<span class="ml-card-art-wrap">' +
        art +
        addChrome(item) +
        "</span>" +
        '<span class="ml-featured-meta"><span class="k">' +
        esc(kicker) +
        '</span><span class="n">' +
        esc(item.title || "Featured") +
        '</span><span class="c">' +
        esc(item.subtitle || item.kind || "") +
        "</span></span>" +
        '<span class="ml-featured-go" aria-hidden="true">›</span>' +
        "</div>";
      var card = sec.querySelector(".ml-featured-card");
      function openFeat() {
        openItem(item);
      }
      card.addEventListener("click", function (e) {
        if (e.target.closest("[data-ml-add], [data-ml-more]")) return;
        openFeat();
      });
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openFeat();
        }
      });
      wireCardAdd(sec, item);
      return sec;
    }

    function renderShelf(title, items) {
      const sec = document.createElement("div");
      sec.className = "ml-section";
      sec.innerHTML =
        '<div class="ml-sec-head"><h3>' +
        esc(title || "Shelf") +
        '</h3><button type="button" class="ml-see-all" data-ml-see-all hidden>See all ›</button></div>';
      const scroll = document.createElement("div");
      scroll.className = "ml-scroll";
      (items || []).forEach(function (item) {
        const btn = document.createElement("div");
        btn.className = "ml-card";
        btn.setAttribute("role", "button");
        btn.tabIndex = 0;
        btn.innerHTML =
          '<span class="ml-card-art-wrap">' +
          placeholderArt(item) +
          addChrome(item) +
          "</span>" +
          '<span class="n">' +
          esc(item.title) +
          '</span><span class="c">' +
          esc(item.subtitle || item.kind || "") +
          "</span>";
        function open() {
          openItem(item);
        }
        btn.addEventListener("click", function (e) {
          if (e.target.closest("[data-ml-add], [data-ml-more]")) return;
          open();
        });
        btn.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        });
        wireCardAdd(btn, item);
        scroll.appendChild(btn);
      });
      if (!scroll.children.length) {
        sec.innerHTML += '<div class="ml-empty">Nothing here.</div>';
      } else {
        sec.appendChild(scroll);
        try {
          if (window.SDShelfAxisLock) window.SDShelfAxisLock.wire(scroll, body);
        } catch (e) {}
      }
      return sec;
    }

    function renderTrackList(tracks, title) {
      const sec = document.createElement("div");
      sec.className = "ml-section ml-songs";
      sec.innerHTML =
        '<div class="ml-sec-head"><h3>' +
        esc(title || "Songs") +
        '</h3><button type="button" class="ml-see-all" data-ml-see-all hidden>See all ›</button></div>';
      if (!tracks || !tracks.length) {
        sec.innerHTML += '<div class="ml-empty">No tracks.</div>';
        return sec;
      }
      tracks.forEach(function (t) {
        const row = document.createElement("div");
        row.className = "ml-track";
        const img = t.thumb
          ? '<img src="' + esc(t.thumb) + '" alt="" loading="lazy" referrerpolicy="no-referrer"/>'
          : "<img alt=\"\"/>";
        row.innerHTML =
          img +
          '<button type="button" class="ml-track-main"><span class="n">' +
          esc(t.title) +
          '</span><span class="c">' +
          esc((t.artists && t.artists.join(", ")) || t.subtitle || t.duration || "") +
          "</span></button>" +
          '<span class="ml-track-end">' +
          '<button type="button" class="play-dot" aria-label="Play">▶</button>' +
          addChrome(t) +
          "</span>";
        function play() {
          var albumIds = {};
          var albumCount = 0;
          (tracks || []).forEach(function (x) {
            if (x && x.albumId && !albumIds[x.albumId]) {
              albumIds[x.albumId] = 1;
              albumCount++;
            }
          });
          var surface =
            albumCount === 1 && t.albumId
              ? "album"
              : tracks.length > 1
                ? "playlist"
                : "watch";
          playTracks(tracks, t.videoId, surface, {
            albumId: t.albumId,
            artistId: t.artistId || (t.artistIds && t.artistIds[0]) || "",
            albumTitle: t.albumTitle || "",
            title: surface === "album" ? t.albumTitle || title || t.title : t.title,
            artistName: (t.artists && t.artists[0]) || t.subtitle || "",
            entryPath: surface,
          });
        }
        row.querySelector(".ml-track-main").addEventListener("click", play);
        row.querySelector(".play-dot").addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          play();
        });
        wireCardAdd(row, t);
        sec.appendChild(row);
      });
      return sec;
    }

    function shelfRankKey(title) {
      var t = String(title || "").toLowerCase();
      if (/artist/.test(t)) return 10;
      if (/quick pick|made for|for you|mix/.test(t)) return 20;
      if (/new release|new & trending|new song/.test(t)) return 30;
      if (/trending|chart|hot|popular/.test(t)) return 40;
      if (/mood|vibe|feeling|genre/.test(t)) return 50;
      if (/throwback|summer|community|featured|playlist/.test(t)) return 60;
      if (/video/.test(t)) return 70;
      return 80;
    }

    function orderListenShelves(shelves) {
      return (shelves || [])
        .map(function (sh, i) {
          return { sh: sh, i: i, rank: shelfRankKey(sh && sh.title) };
        })
        .sort(function (a, b) {
          if (a.rank !== b.rank) return a.rank - b.rank;
          return a.i - b.i;
        })
        .map(function (x) {
          return x.sh;
        });
    }

    function renderLibrarySection() {
      var wrap = document.createElement("div");
      wrap.className = "ml-section ml-library";
      wrap.innerHTML =
        '<div class="ml-sec-head"><h3>Your library</h3></div>' +
        '<div class="ml-lib-actions" role="toolbar" aria-label="Library actions">' +
        '<button type="button" class="ml-lib-btn" data-ml-lib="open">Open</button>' +
        '<button type="button" class="ml-lib-btn" data-ml-lib="artists">Artists</button>' +
        '<button type="button" class="ml-lib-btn" data-ml-lib="create">New playlist</button>' +
        '<button type="button" class="ml-lib-btn" data-ml-lib="collab">Collaborative</button>' +
        '<button type="button" class="ml-lib-btn" data-ml-lib="party">Listening party</button>' +
        '<button type="button" class="ml-lib-btn" data-ml-lib="join">Join code</button>' +
        "</div>";
      var preview = document.createElement("div");
      preview.className = "ml-scroll";
      var Lib = window.SDMusicLibrary;
      var items = [];
      if (Lib) {
        var snap = Lib.snapshot();
        if (snap.liked && snap.liked.length) {
          items.push({
            kind: "lib-liked",
            title: "Liked songs",
            subtitle: trackCountLabel(snap.liked.length),
            thumb: snap.liked[0].thumb || "",
            tracks: snap.liked,
          });
        }
        (snap.playlists || []).slice(0, 8).forEach(function (p) {
          items.push({
            kind: "lib-playlist",
            title: p.title,
            subtitle:
              (p.visibility || "private") +
              (p.collaborative ? " · collab" : "") +
              (p.listeningParty ? " · party" : "") +
              " · " +
              trackCountLabel((p.tracks && p.tracks.length) || 0),
            thumb: p.cover || (p.tracks && p.tracks[0] && p.tracks[0].thumb) || "",
            playlist: p,
          });
        });
        (snap.albums || []).slice(0, 4).forEach(function (a) {
          items.push(Object.assign({}, a, { kind: "album" }));
        });
      }
      if (!items.length) {
        preview.innerHTML = '<div class="ml-empty" style="padding:8px 0">Save likes & playlists — they show up here.</div>';
      } else {
        items.forEach(function (item) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "ml-card";
          var art = item.thumb
            ? '<img class="art" src="' + esc(item.thumb) + '" alt="" loading="lazy" referrerpolicy="no-referrer"/>'
            : '<span class="art" aria-hidden="true"></span>';
          btn.innerHTML =
            '<span class="ml-card-art-wrap">' +
            art +
            (item.kind === "album" || item.kind === "lib-playlist" ? addChrome(item) : "") +
            "</span>" +
            '<span class="n">' +
            esc(item.title) +
            '</span><span class="c">' +
            esc(item.subtitle || item.kind || "") +
            "</span>";
          btn.addEventListener("click", function (e) {
            if (e.target.closest("[data-ml-add], [data-ml-more]")) return;
            if (item.kind === "lib-liked" && item.tracks) {
              playTracks(item.tracks, item.tracks[0] && item.tracks[0].videoId, "library");
              return;
            }
            if (item.kind === "lib-playlist" && item.playlist) {
              stack.push({
                view: "library-playlist",
                title: item.playlist.title,
                playlistLocalId: item.playlist.id,
              });
              render();
              return;
            }
            openItem(item);
          });
          if (item.kind === "album") wireCardAdd(btn, item);
          preview.appendChild(btn);
        });
      }
      wrap.appendChild(preview);
      wrap.querySelectorAll("[data-ml-lib]").forEach(function (b) {
        b.addEventListener("click", function (e) {
          e.stopPropagation();
          handleLibraryAction(b.getAttribute("data-ml-lib"));
        });
      });
      try {
        if (window.SDShelfAxisLock) window.SDShelfAxisLock.wire(preview, body);
      } catch (e) {}
      return wrap;
    }

    function handleLibraryAction(action) {
      var Lib = window.SDMusicLibrary;
      if (!Lib) {
        alert("Library module not loaded");
        return;
      }
      if (action === "open") {
        stack.push({ view: "library", title: "Library" });
        render();
        return;
      }
      if (action === "artists") {
        stack.push({ view: "artists-directory", title: "Artists" });
        render();
        return;
      }
      if (action === "join") {
        var code = prompt("Enter invite / listening-party code");
        if (!code) return;
        Lib.joinByCode(code)
          .then(function (pl) {
            stack.push({ view: "library-playlist", title: pl.title, playlistLocalId: pl.id });
            render();
          })
          .catch(function () {
            alert("Couldn’t join that code");
          });
        return;
      }
      var title = prompt(
        action === "party" ? "Listening party name" : action === "collab" ? "Collaborative playlist name" : "Playlist name",
        action === "party" ? "Listening party" : "My playlist"
      );
      if (!title) return;
      var vis = action === "party" || action === "collab" ? "public" : confirm("Make this playlist public?") ? "public" : "private";
      var pl = Lib.createPlaylist({
        title: title,
        visibility: vis,
        collaborative: action === "collab" || action === "party",
        listeningParty: action === "party",
        partyActive: action === "party",
      });
      var msg = "Created “" + pl.title + "”";
      if (pl.inviteCode) msg += "\nInvite code: " + pl.inviteCode + "\n" + (Lib.inviteUrl(pl) || "");
      try {
        if (pl.inviteCode && navigator.clipboard) navigator.clipboard.writeText(pl.inviteCode);
      } catch (e) {}
      alert(msg);
      stack.push({ view: "library-playlist", title: pl.title, playlistLocalId: pl.id });
      render();
    }

    function renderArtistsShelf(shelves) {
      var artists = [];
      (shelves || []).forEach(function (sh) {
        if (!/artist/i.test(sh.title || "")) return;
        (sh.items || []).forEach(function (it) {
          if (it && (it.kind === "artist" || (it.browseId && String(it.browseId).indexOf("UC") === 0))) {
            artists.push(it);
          }
        });
      });
      try {
        if (window.SDMusicLibrary) {
          artists = artists.concat(window.SDMusicLibrary.snapshot().artists || []);
        }
        if (window.SDMusicTaste && window.SDMusicArtists && window.SDMusicArtists.fromTaste) {
          artists = artists.concat(window.SDMusicArtists.fromTaste() || []);
        }
      } catch (e) {}
      // Prefer channel browseId when merging same title (library stubs without id lose).
      var byTitle = Object.create(null);
      var byId = Object.create(null);
      var out = [];
      artists.forEach(function (a) {
        if (!a) return;
        var channel = resolveArtistChannel(a);
        var titleKey = String(a.title || a.name || "").trim().toLowerCase();
        var card = Object.assign({}, a, {
          kind: channel ? "artist" : a.kind === "search_artist" ? "search_artist" : a.kind || "artist",
          browseId: channel || a.browseId || undefined,
          channelId: channel || a.channelId || undefined,
          _q: channel ? a._q : a._q || a.title || a.name,
        });
        if (channel) {
          if (byId[channel]) {
            if (!byId[channel].thumb && card.thumb) byId[channel].thumb = card.thumb;
            return;
          }
          byId[channel] = card;
          if (titleKey) byTitle[titleKey] = card;
          out.push(card);
          return;
        }
        if (titleKey && byTitle[titleKey] && resolveArtistChannel(byTitle[titleKey])) return;
        if (titleKey && byTitle[titleKey]) return;
        if (titleKey) byTitle[titleKey] = card;
        out.push(card);
      });
      if (!out.length) return null;
      var sec = renderShelf("Artists", out.slice(0, 24));
      if (!sec) return null;
      try {
        var head = sec.querySelector(".ml-sec-head");
        if (head) {
          var see = head.querySelector("[data-ml-see-all]") || document.createElement("button");
          see.type = "button";
          see.className = "ml-see-all";
          see.setAttribute("data-ml-see-all", "artists-directory");
          see.hidden = false;
          see.textContent = "Directory ›";
          see.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            stack.push({ view: "artists-directory", title: "Artists" });
            render();
          });
          if (!see.parentNode) head.appendChild(see);
        }
      } catch (e) {}
      return sec;
    }

    async function renderLibraryView() {
      body.innerHTML = "";
      head.querySelector(".ml-title").textContent = "Library";
      setSub("Saved on this device · sync for public/collab");
      var Lib = window.SDMusicLibrary;
      if (!Lib) {
        body.innerHTML = '<div class="ml-err">Library unavailable</div>';
        return;
      }
      body.appendChild(renderLibrarySection());
      Lib.shelves().forEach(function (sh) {
        if (sh.id === "playlists") {
          var sec = document.createElement("div");
          sec.className = "ml-section";
          sec.innerHTML = "<h3>Playlists</h3>";
          (sh.items || []).forEach(function (p) {
            var row = document.createElement("button");
            row.type = "button";
            row.className = "ml-track";
            row.innerHTML =
              (p.cover
                ? '<img src="' + esc(p.cover) + '" alt="" loading="lazy" referrerpolicy="no-referrer"/>'
                : "<img alt=\"\"/>") +
              "<span><span class=\"n\">" +
              esc(p.title) +
              '</span><span class="c">' +
              esc(
                (p.visibility || "private") +
                  (p.collaborative ? " · collab" : "") +
                  (p.listeningParty ? " · party" : "") +
                  " · " +
                  trackCountLabel((p.tracks && p.tracks.length) || 0) +
                  (p.inviteCode ? " · " + p.inviteCode : "")
              ) +
              "</span></span>" +
              '<span class="play-dot" aria-hidden="true">▶</span>';
            row.addEventListener("click", function () {
              stack.push({ view: "library-playlist", title: p.title, playlistLocalId: p.id });
              render();
            });
            sec.appendChild(row);
          });
          body.appendChild(sec);
          return;
        }
        if (sh.kind === "tracks" && sh.items && sh.items.length) {
          body.appendChild(renderTrackList(sh.items, sh.title));
        } else if (sh.items && sh.items.length) {
          body.appendChild(renderShelf(sh.title, sh.items));
        }
      });
      Lib.discoverPublic(12).then(function (data) {
        var pubs = (data && data.playlists) || [];
        if (!pubs.length) return;
        var mapped = pubs.map(function (p) {
          return {
            kind: "public-playlist",
            title: p.title,
            subtitle: trackCountLabel(p.trackCount || 0) + (p.listeningParty ? " · party" : ""),
            thumb: p.cover,
            inviteCode: p.inviteCode,
            id: p.id,
          };
        });
        var sec = renderShelf("Public & listening parties", mapped);
        sec.querySelectorAll(".ml-card").forEach(function (btn, i) {
          btn.onclick = function () {
            var p = mapped[i];
            if (!p.inviteCode) return;
            Lib.joinByCode(p.inviteCode).then(function (pl) {
              stack.push({ view: "library-playlist", title: pl.title, playlistLocalId: pl.id });
              render();
            });
          };
        });
        body.appendChild(sec);
      });
    }

    function renderLocalPlaylist(playlistId, title) {
      body.innerHTML = "";
      head.querySelector(".ml-title").textContent = title || "Playlist";
      var Lib = window.SDMusicLibrary;
      var pl = Lib && Lib.getPlaylist(playlistId);
      if (!pl) {
        body.innerHTML = '<div class="ml-empty">Playlist missing</div>';
        return;
      }
      setSub(
        (pl.visibility || "private") +
          (pl.collaborative ? " · collaborative" : "") +
          (pl.listeningParty ? " · listening party" : "") +
          (pl.inviteCode ? " · code " + pl.inviteCode : "")
      );
      var tools = document.createElement("div");
      tools.className = "ml-lib-actions";
      tools.innerHTML =
        '<button type="button" class="ml-lib-btn" data-act="play">Play</button>' +
        '<button type="button" class="ml-lib-btn" data-act="privacy">Privacy</button>' +
        '<button type="button" class="ml-lib-btn" data-act="share">Share code</button>' +
        '<button type="button" class="ml-lib-btn" data-act="rename">Rename</button>' +
        '<button type="button" class="ml-lib-btn danger" data-act="delete">Delete</button>';
      body.appendChild(tools);
      tools.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-act]");
        if (!btn) return;
        var act = btn.getAttribute("data-act");
        if (act === "play") {
          playTracks(pl.tracks || [], null, "library");
          return;
        }
        if (act === "share") {
          if (!pl.inviteCode) {
            Lib.updatePlaylist(pl.id, { visibility: "public", collaborative: true });
            pl = Lib.getPlaylist(pl.id);
          }
          var url = Lib.inviteUrl(pl);
          alert("Code: " + pl.inviteCode + (url ? "\n" + url : ""));
          try {
            if (navigator.clipboard) navigator.clipboard.writeText(pl.inviteCode);
          } catch (err) {}
          return;
        }
        if (act === "privacy") {
          var next = pl.visibility === "public" ? "private" : "public";
          Lib.updatePlaylist(pl.id, { visibility: next });
          render();
          return;
        }
        if (act === "rename") {
          var t = prompt("Rename playlist", pl.title);
          if (t) {
            Lib.updatePlaylist(pl.id, { title: t });
            render();
          }
          return;
        }
        if (act === "delete") {
          if (confirm("Delete playlist “" + pl.title + "”?")) {
            Lib.deletePlaylist(pl.id);
            stack.pop();
            render();
          }
        }
      });
      body.appendChild(renderTrackList(pl.tracks || [], pl.title || "Tracks"));
    }

    async function renderHome() {
      body.innerHTML = '<div class="ml-loading">Loading shelves…</div>';
      head.querySelector(".ml-title").textContent = "Listen";
      setSub("YouTube Music · stream only");
      body.innerHTML = "";
      body.appendChild(renderLibrarySection());
      homeData = await api("/home");
      const shelves = orderListenShelves((homeData && homeData.shelves) || []);
      const artistsSec = renderArtistsShelf(shelves);

      // Collect songs / albums for phone-mock density + wide split
      var songPool = [];
      var albumPool = [];
      var featuredItem = null;
      shelves.forEach(function (sh) {
        (sh.items || []).forEach(function (it) {
          if (
            !featuredItem &&
            it.kind === "artist" &&
            resolveArtistChannel(it)
          ) {
            featuredItem = it;
          } else if (
            !featuredItem &&
            (it.kind === "album" || it.kind === "playlist")
          ) {
            featuredItem = it;
          }
          if ((it.kind === "song" || it.videoId) && songPool.length < 12) songPool.push(it);
          if (it.kind === "album" && albumPool.length < 16) albumPool.push(it);
        });
      });
      if (!featuredItem && artistsSec) {
        // leave artists shelf as primary when no featured
      } else if (featuredItem) {
        var feat = renderFeatured(featuredItem);
        if (feat) body.appendChild(feat);
      }

      var split = document.createElement("div");
      split.className = "ml-wide-split";
      var left = document.createElement("div");
      left.className = "ml-wide-col ml-wide-songs";
      var right = document.createElement("div");
      right.className = "ml-wide-col ml-wide-albums";

      if (songPool.length) left.appendChild(renderTrackList(songPool, "Songs"));
      if (albumPool.length) right.appendChild(renderShelf("Albums", albumPool));
      if (left.children.length) split.appendChild(left);
      if (right.children.length) split.appendChild(right);
      if (split.children.length) body.appendChild(split);

      if (artistsSec) body.appendChild(artistsSec);
      const rest = shelves.filter(function (sh) {
        var t = (sh && sh.title) || "";
        if (/artist/i.test(t)) return false;
        if (/album/i.test(t) && albumPool.length) return false;
        if ((/song|track|quick pick|made for/i.test(t) || /chart|trending|hot/i.test(t)) && songPool.length) {
          return false;
        }
        return true;
      });
      if (!rest.length && !artistsSec && !songPool.length && !albumPool.length) {
        var empty = document.createElement("div");
        empty.className = "ml-empty";
        empty.textContent = "No shelves yet — try searching.";
        body.appendChild(empty);
        return;
      }
      rest.forEach(function (sh) {
        var items = sh.items || [];
        var looksTracks = items.length && items.every(function (it) {
          return it.videoId || it.kind === "song" || it.kind === "video";
        });
        if (looksTracks) body.appendChild(renderTrackList(items, sh.title));
        else body.appendChild(renderShelf(sh.title, items));
      });
      try {
        if (window.SDShelfAxisLock) window.SDShelfAxisLock.wireAll(body, ".ml-scroll", null);
      } catch (e) {}
    }

    async function renderSearch(q) {
      body.innerHTML = '<div class="ml-loading">Searching…</div>';
      head.querySelector(".ml-title").textContent = "Search";
      setSub(q);
      const data = await api("/search", { q: q, limit: 36 });
      body.innerHTML = "";
      const songs = (data.items || []).filter(function (i) {
        return i.kind === "song" || i.videoId;
      });
      const albums = (data.items || []).filter(function (i) {
        return i.kind === "album";
      });
      const artists = (data.items || []).filter(function (i) {
        return i.kind === "artist";
      });
      const playlists = (data.items || []).filter(function (i) {
        return i.kind === "playlist";
      });
      if (songs.length) body.appendChild(renderTrackList(songs, "Songs"));
      if (albums.length) body.appendChild(renderShelf("Albums", albums));
      if (artists.length) body.appendChild(renderShelf("Artists", artists));
      if (playlists.length) body.appendChild(renderShelf("Playlists", playlists));
      if (!songs.length && !albums.length && !artists.length && !playlists.length) {
        body.innerHTML = '<div class="ml-empty">No results.</div>';
      }
    }

    async function renderAlbum(browseId, title) {
      body.innerHTML = '<div class="ml-loading">Loading album…</div>';
      head.querySelector(".ml-title").textContent = title || "Album";
      const data = await api("/album/" + encodeURIComponent(browseId));
      body.innerHTML = "";
      setSub((data.artists || []).join(", ") || data.year || "");
      const tracks = (data.tracks || []).map(function (t) {
        return Object.assign({}, t, {
          albumId: browseId,
          albumTitle: data.title || title || "",
          artistId: t.artistId || (t.artistIds && t.artistIds[0]) || data.artistId || (data.artistIds && data.artistIds[0]) || "",
          artistIds: t.artistIds || data.artistIds || [],
          year: t.year || data.year || "",
        });
      });
      var albumArtistId = data.artistId || (data.artistIds && data.artistIds[0]) || (tracks[0] && tracks[0].artistId) || "";
      var albumArtistName = (data.artists && data.artists[0]) || "";
      // Expose album ▶ play-all via first-track meta on section dataset for ecosystem.
      body.dataset.mlAlbumId = browseId;
      if (albumArtistId) body.dataset.mlArtistId = albumArtistId;
      if (albumArtistName) body.dataset.mlArtistName = albumArtistName;
      if (window.SDMusicLibrary) {
        var Lib = window.SDMusicLibrary;
        var saved = typeof Lib.isAlbumSaved === "function" && Lib.isAlbumSaved(browseId);
        var bar = document.createElement("div");
        bar.className = "ml-lib-actions";
        bar.innerHTML =
          '<button type="button" class="ml-lib-btn' +
          (saved ? " on" : "") +
          '" data-save-album>' +
          (saved ? "Saved" : "Save album") +
          "</button>";
        bar.querySelector("[data-save-album]").addEventListener("click", function () {
          var nowSaved = typeof Lib.isAlbumSaved === "function" && Lib.isAlbumSaved(browseId);
          Lib.saveAlbum(
            {
              browseId: browseId,
              title: data.title || title,
              artists: data.artists || [],
              thumb: data.thumb || (tracks[0] && tracks[0].thumb) || "",
            },
            !nowSaved
          );
          var on = typeof Lib.isAlbumSaved === "function" && Lib.isAlbumSaved(browseId);
          this.textContent = on ? "Saved" : "Save album";
          this.classList.toggle("on", !!on);
        });
        body.appendChild(bar);
      }
      body.appendChild(renderTrackList(tracks, data.title || "Tracks"));
    }

    async function renderPlaylist(playlistId, title) {
      body.innerHTML = '<div class="ml-loading">Loading playlist…</div>';
      head.querySelector(".ml-title").textContent = title || "Playlist";
      const data = await api("/playlist/" + encodeURIComponent(playlistId));
      body.innerHTML = "";
      setSub(
        data.description
          ? String(data.description).slice(0, 80)
          : trackCountLabel(data.trackCount || (data.tracks || []).length)
      );
      body.appendChild(renderTrackList(data.tracks || [], data.title || "Tracks"));
    }

    function classifyArtistShelves(shelves) {
      var out = { songs: [], albums: [], singles: [], videos: [], related: [], other: [] };
      (shelves || []).forEach(function (sh) {
        var t = String((sh && sh.title) || "").toLowerCase();
        var items = (sh && sh.items) || [];
        if (!items.length) return;
        if (/related|similar|fans also|you may/i.test(t)) {
          out.related = out.related.concat(items);
        } else if (/single|ep\b/i.test(t)) {
          out.singles = out.singles.concat(items);
        } else if (/album/i.test(t)) {
          out.albums = out.albums.concat(items);
        } else if (/video/i.test(t)) {
          out.videos = out.videos.concat(items);
        } else if (/song|popular|top track|hits/i.test(t) || items.some(function (i) { return i && i.videoId; })) {
          out.songs = out.songs.concat(
            items.filter(function (i) {
              return i && i.videoId;
            })
          );
          var rest = items.filter(function (i) {
            return i && !i.videoId;
          });
          if (rest.length) out.other.push({ title: sh.title, items: rest });
        } else {
          out.other.push(sh);
        }
      });
      return out;
    }

    function shuffleCopy(list) {
      var a = (list || []).slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
      }
      return a;
    }

    async function renderArtist(channelId, title) {
      body.innerHTML = '<div class="ml-loading">Loading artist…</div>';
      head.querySelector(".ml-title").textContent = title || "Artist";
      const data = await api("/artist/" + encodeURIComponent(channelId));
      body.innerHTML = "";
      var artistTitle = data.title || title || "Artist";
      head.querySelector(".ml-title").textContent = artistTitle;
      var desc = data.description ? String(data.description).replace(/\s+/g, " ").trim() : "";
      setSub(desc ? desc.slice(0, 90) + (desc.length > 90 ? "…" : "") : "Artist");

      var parts = classifyArtistShelves(data.shelves || []);
      var songs = parts.songs.map(function (t) {
        return Object.assign({}, t, {
          artistId: t.artistId || channelId,
          artists: t.artists && t.artists.length ? t.artists : [artistTitle],
        });
      });
      var albums = parts.albums.map(function (it) {
        return Object.assign({}, it, { kind: it.kind || "album" });
      });
      var singles = parts.singles.map(function (it) {
        return Object.assign({}, it, { kind: it.kind || (it.videoId ? "song" : "album") });
      });
      var related = parts.related.map(function (it) {
        var browse = it.browseId || it.channelId || "";
        if (browse && String(browse).indexOf("MPRE") === 0) browse = "";
        return Object.assign({}, it, {
          kind: browse || it.kind === "artist" ? "artist" : it.kind || "artist",
          browseId: browse || it.browseId,
          channelId: browse || it.channelId,
        });
      });

      var Lib = window.SDMusicLibrary;
      var following = !!(Lib && typeof Lib.isFollowing === "function" && Lib.isFollowing(channelId));
      var thumb =
        data.thumb ||
        (songs[0] && songs[0].thumb) ||
        (albums[0] && albums[0].thumb) ||
        "";
      var hero = document.createElement("section");
      hero.className = "ml-artist-hero";
      var artHtml = thumb
        ? '<img class="ml-artist-art" src="' + esc(thumb) + '" alt="" loading="lazy" referrerpolicy="no-referrer"/>'
        : '<div class="ml-artist-art ml-artist-ph" aria-hidden="true"></div>';
      hero.innerHTML =
        '<div class="ml-artist-hero-bg" aria-hidden="true"' +
        (thumb ? ' style="background-image:url(' + esc(thumb) + ')"' : "") +
        "></div>" +
        '<div class="ml-artist-hero-inner">' +
        '<div class="ml-artist-art-wrap">' +
        artHtml +
        "</div>" +
        '<div class="ml-artist-meta">' +
        '<span class="k">Artist</span>' +
        '<h2 class="n">' +
        esc(artistTitle) +
        "</h2>" +
        (desc
          ? '<p class="d">' + esc(desc.slice(0, 160)) + (desc.length > 160 ? "…" : "") + "</p>"
          : "") +
        '<div class="ml-artist-actions" role="toolbar" aria-label="Artist actions">' +
        '<button type="button" class="ml-lib-btn primary" data-artist-play' +
        (songs.length ? "" : " disabled") +
        ">Play</button>" +
        '<button type="button" class="ml-lib-btn" data-artist-shuffle' +
        (songs.length ? "" : " disabled") +
        ">Shuffle</button>" +
        '<button type="button" class="ml-lib-btn' +
        (following ? " on following" : "") +
        '" data-follow-artist aria-pressed="' +
        (following ? "true" : "false") +
        '">' +
        (following ? "Following" : "Follow") +
        "</button>" +
        (Lib && typeof Lib.addBtnHtml === "function" ? Lib.addBtnHtml("ml-artist-add") : "") +
        "</div></div></div>";
      body.appendChild(hero);

      var artistPayload = {
        browseId: channelId,
        channelId: channelId,
        title: artistTitle,
        thumb: thumb,
        kind: "artist",
      };
      var followBtn = hero.querySelector("[data-follow-artist]");
      if (followBtn && Lib && typeof Lib.followArtist === "function") {
        followBtn.addEventListener("click", function () {
          var on = typeof Lib.isFollowing === "function" && Lib.isFollowing(channelId);
          Lib.followArtist(artistPayload, !on);
          var nowOn = typeof Lib.isFollowing === "function" && Lib.isFollowing(channelId);
          followBtn.textContent = nowOn ? "Following" : "Follow";
          followBtn.classList.toggle("on", !!nowOn);
          followBtn.classList.toggle("following", !!nowOn);
          followBtn.setAttribute("aria-pressed", nowOn ? "true" : "false");
        });
      }
      var playBtn = hero.querySelector("[data-artist-play]");
      if (playBtn && songs.length) {
        playBtn.addEventListener("click", function () {
          playTracks(songs, songs[0].videoId, "artist-radio", {
            artistId: channelId,
            title: artistTitle,
            artistName: artistTitle,
          });
        });
      }
      var shuffleBtn = hero.querySelector("[data-artist-shuffle]");
      if (shuffleBtn && songs.length) {
        shuffleBtn.addEventListener("click", function () {
          var sh = shuffleCopy(songs);
          playTracks(sh, sh[0].videoId, "artist-radio", {
            artistId: channelId,
            title: artistTitle,
            artistName: artistTitle,
          });
        });
      }
      wireCardAdd(hero, artistPayload);

      if (songs.length) body.appendChild(renderTrackList(songs, "Popular"));
      if (albums.length) body.appendChild(renderShelf("Albums", albums));
      if (singles.length) body.appendChild(renderShelf("Singles", singles));
      if (parts.videos.length) body.appendChild(renderShelf("Videos", parts.videos));
      if (related.length) body.appendChild(renderShelf("Related artists", related));
      parts.other.forEach(function (sh) {
        var hasSongs = (sh.items || []).some(function (i) {
          return i && i.videoId;
        });
        if (hasSongs && /song/i.test(sh.title || "")) {
          body.appendChild(renderTrackList(sh.items, sh.title));
        } else {
          body.appendChild(renderShelf(sh.title, sh.items));
        }
      });
      if (
        !songs.length &&
        !albums.length &&
        !singles.length &&
        !parts.videos.length &&
        !related.length &&
        !parts.other.length
      ) {
        body.appendChild(
          Object.assign(document.createElement("div"), {
            className: "ml-empty",
            textContent: "No catalog for this artist yet.",
          })
        );
      }
    }

    async function renderMood(params, title) {
      body.innerHTML = '<div class="ml-loading">Loading mood…</div>';
      head.querySelector(".ml-title").textContent = title || "Mood";
      const data = await api("/mood", { params: params });
      body.innerHTML = "";
      setSub("Playlists");
      body.appendChild(renderShelf(title || "Mood", data.items || []));
    }

    async function renderArtistsDirectory() {
      head.querySelector(".ml-title").textContent = "Artists";
      setSub("A–Z directory · tap to browse");
      body.innerHTML = "";
      var host = document.createElement("div");
      body.appendChild(host);
      var A = window.SDMusicArtists;
      if (!A || typeof A.renderDirectory !== "function") {
        host.innerHTML = '<div class="ml-err">Artists directory unavailable</div>';
        return;
      }
      await A.renderDirectory(host, {
        onOpenArtist: function (item) {
          openArtistItem(item);
        },
      });
    }

    async function renderEntityDirectory(kind, title) {
      head.querySelector(".ml-title").textContent = title || "Directory";
      var subs = {
        track: "Trending + A–Z · tap to play",
        album: "Browse albums · tap to open",
        playlist: "Yours + discover · tap to open",
        video: "Music videos · tap to play",
      };
      setSub(subs[kind] || "Directory");
      body.innerHTML = "";
      var host = document.createElement("div");
      body.appendChild(host);
      var D = window.SDMusicDirectories;
      if (!D || typeof D.renderDirectory !== "function") {
        host.innerHTML = '<div class="ml-err">' + esc(title || "Directory") + " unavailable</div>";
        return;
      }
      await D.renderDirectory(host, {
        kind: kind,
        onOpen: function (item) {
          if (!item) return;
          if (kind === "track" || kind === "video") {
            if (item.videoId) {
              playTracks([item], item.videoId, "directory", {
                kind: kind,
                artistId: item.artistId || (item.artistIds && item.artistIds[0]) || resolveArtistChannel(item) || "",
                artistName: (item.artists && item.artists[0]) || item.subtitle || "",
                entryPath: "directory",
                title: item.title,
              });
              return;
            }
          }
          if (kind === "album" && item.browseId) {
            stack.push({ view: "album", title: item.title || "Album", browseId: item.browseId });
            render();
            return;
          }
          if (kind === "playlist") {
            if (item.playlistLocalId) {
              stack.push({
                view: "library-playlist",
                title: item.title || "Playlist",
                playlistLocalId: item.playlistLocalId,
              });
              render();
              return;
            }
            if (item.playlistId) {
              stack.push({
                view: "playlist",
                title: item.title || "Playlist",
                playlistId: item.playlistId,
              });
              render();
              return;
            }
          }
          openItem(item);
        },
      });
    }

    async function render() {
      try {
        if (!stack.length) {
          await renderHome();
          return;
        }
        const top = stack[stack.length - 1];
        if (top.view === "search") await renderSearch(top.q);
        else if (top.view === "album") await renderAlbum(top.browseId, top.title);
        else if (top.view === "playlist") await renderPlaylist(top.playlistId, top.title);
        else if (top.view === "artist") await renderArtist(top.channelId, top.title);
        else if (top.view === "mood") await renderMood(top.params, top.title);
        else if (top.view === "library") await renderLibraryView();
        else if (top.view === "library-playlist") renderLocalPlaylist(top.playlistLocalId, top.title);
        else if (top.view === "artists-directory") await renderArtistsDirectory();
        else if (top.view === "tracks-directory") await renderEntityDirectory("track", "Tracks");
        else if (top.view === "albums-directory") await renderEntityDirectory("album", "Albums");
        else if (top.view === "playlists-directory") await renderEntityDirectory("playlist", "Playlists");
        else if (top.view === "videos-directory") await renderEntityDirectory("video", "Videos");
        else await renderHome();
      } catch (e) {
        body.innerHTML = '<div class="ml-err">Couldn’t load Listen right now.</div>';
      }
    }

    this.refresh = function () {
      return render();
    };
    this.destroy = function () {
      stopPlayback();
      container.innerHTML = "";
      if (lastListenMount === this) lastListenMount = null;
    };
    this.playTracks = playTracks;
    this.playUnifiedNow = function (opts) {
      opts = opts || {};
      var u = UQ();
      var track = u && u.getTimeline && u.getTimeline().now;
      if (!track) return;
      syncFlatFromUnified();
      playTrackObject(track, opts);
      prewarmUpcoming(2);
    };
    this.prewarmUpcoming = prewarmUpcoming;
    try {
      if (UQ() && typeof UQ().onChange === "function" && !this.__uqPrewarmSub) {
        this.__uqPrewarmSub = true;
        UQ().onChange(function () {
          prewarmUpcoming(2);
        });
      }
    } catch (eSub) {}
    this.playNext = function (track) {
      if (UQ()) UQ().playNext(track);
      else if (track && track.videoId) {
        queue.splice(qIndex + 1, 0, track);
      }
      try {
        var P = sharedPlayer();
        if (P && P._instance && typeof P._instance._renderQueuePanel === "function") {
          P._instance._renderQueuePanel();
        }
      } catch (e) {}
    };
    this.addToQueue = function (track) {
      if (UQ()) UQ().addToQueue(track);
      else if (track && track.videoId) queue.push(track);
      try {
        var P = sharedPlayer();
        if (P && P._instance && typeof P._instance._renderQueuePanel === "function") {
          P._instance._renderQueuePanel();
        }
      } catch (e) {}
    };
    this.openSearch = function (q) {
      const query = String(q || "").trim();
      if (!query) return;
      const input = searchRow.querySelector("[data-ml-q]");
      if (input) input.value = query;
      stack = [{ view: "search", title: "Search", q: query }];
      render();
    };
    this.openAlbum = function (browseId, title) {
      if (!browseId) return;
      stack = [{ view: "album", title: title || "Album", browseId: browseId }];
      render();
    };
    this.openPlaylist = function (playlistId, title) {
      if (!playlistId) return;
      stack = [{ view: "playlist", title: title || "Playlist", playlistId: playlistId }];
      render();
    };
    this.openArtist = function (channelId, title) {
      if (!channelId) return;
      stack = [{ view: "artist", title: title || "Artist", channelId: channelId }];
      render();
    };
    this.openArtistItem = function (item) {
      return openArtistItem(item);
    };
    /** Clear directory/search stack back to Listen home (focus chips / All). */
    this.resetNavigation = function () {
      stack = [];
      return render();
    };
    this.openArtistsDirectory = function () {
      stack = [{ view: "artists-directory", title: "Artists" }];
      render();
    };
    this.openTracksDirectory = function () {
      stack = [{ view: "tracks-directory", title: "Tracks" }];
      render();
    };
    this.openAlbumsDirectory = function () {
      stack = [{ view: "albums-directory", title: "Albums" }];
      render();
    };
    this.openPlaylistsDirectory = function () {
      stack = [{ view: "playlists-directory", title: "Playlists" }];
      render();
    };
    this.openVideosDirectory = function () {
      stack = [{ view: "videos-directory", title: "Videos" }];
      render();
    };
    /** Open Library hub; optional focus: liked | saved | playlists. */
    this.openLibrary = function (focus) {
      var f = String(focus || "").toLowerCase();
      if (f === "liked") {
        var Lib = window.SDMusicLibrary;
        var liked = Lib && Lib.snapshot ? (Lib.snapshot().liked || []).slice() : [];
        if (liked.length) {
          playTracks(liked, liked[0] && liked[0].videoId, "library");
          stack = [{ view: "library", title: "Library" }];
          return render();
        }
      }
      stack = [{ view: "library", title: "Library" }];
      return render();
    };
    this.openMood = function (params, title) {
      if (!params) return;
      stack = [{ view: "mood", title: title || "Mood", params: params }];
      render();
    };
    this.searchAndPlay = async function (q) {
      const query = String(q || "").trim();
      if (!query) return;
      this.openSearch(query);
      const data = await api("/search", { q: query, filter: "songs", limit: 12 });
      const songs = ((data && data.items) || []).filter(function (i) {
        return i && i.videoId;
      });
      if (!songs.length) throw new Error("no_results");
      playTracks(songs, songs[0].videoId);
      return songs[0];
    };

    lastListenMount = this;

    render().catch(function () {
      body.innerHTML = '<div class="ml-err">Listen failed to start.</div>';
    });
  }

  let lastListenMount = null;

  function mount(el, opts) {
    if (!el) throw new Error("music_listen_mount_missing_el");
    return new Mount(el, opts || {});
  }

  function autoMount() {
    const el = document.querySelector("[data-music-listen]:not(#musicListenRoot)");
    if (!el || el.__mlMounted) return;
    el.__mlMounted = true;
    mount(el, { auto: true });
  }

  async function ensureListenReady() {
    try {
      if (window.SDMusic) {
        if (typeof window.SDMusic.open === "function") {
          window.SDMusic.open({ replace: true, tab: "listen" });
        }
        if (typeof window.SDMusic.ensureListen === "function") {
          window.SDMusic.ensureListen();
        }
      }
    } catch (e) {}
    for (let i = 0; i < 20; i++) {
      if (lastListenMount) return lastListenMount;
      await new Promise(function (r) {
        setTimeout(r, 50);
      });
    }
    return lastListenMount;
  }

  window.StepDaddyMusicListen = {
    mount: mount,
    autoMount: autoMount,
    openSearch: function (q) {
      return ensureListenReady().then(function (m) {
        if (m && typeof m.openSearch === "function") return m.openSearch(q);
      });
    },
    openAlbum: function (browseId, title) {
      return ensureListenReady().then(function (m) {
        if (m && typeof m.openAlbum === "function") return m.openAlbum(browseId, title);
      });
    },
    openPlaylist: function (playlistId, title) {
      return ensureListenReady().then(function (m) {
        if (m && typeof m.openPlaylist === "function") return m.openPlaylist(playlistId, title);
      });
    },
    openArtist: function (channelId, title) {
      return ensureListenReady().then(function (m) {
        if (m && typeof m.openArtist === "function") return m.openArtist(channelId, title);
      });
    },
    openArtistItem: function (item) {
      return ensureListenReady().then(function (m) {
        if (m && typeof m.openArtistItem === "function") return m.openArtistItem(item);
      });
    },
    resetNavigation: function () {
      // Do not force-open Listen — chip All must stay on Home.
      if (lastListenMount && typeof lastListenMount.resetNavigation === "function") {
        return Promise.resolve(lastListenMount.resetNavigation());
      }
      return Promise.resolve(null);
    },
    openArtistsDirectory: function () {
      return ensureListenReady().then(function (m) {
        if (m && typeof m.openArtistsDirectory === "function") return m.openArtistsDirectory();
      });
    },
    openTracksDirectory: function () {
      return ensureListenReady().then(function (m) {
        if (m && typeof m.openTracksDirectory === "function") return m.openTracksDirectory();
      });
    },
    openAlbumsDirectory: function () {
      return ensureListenReady().then(function (m) {
        if (m && typeof m.openAlbumsDirectory === "function") return m.openAlbumsDirectory();
      });
    },
    openPlaylistsDirectory: function () {
      return ensureListenReady().then(function (m) {
        if (m && typeof m.openPlaylistsDirectory === "function") return m.openPlaylistsDirectory();
      });
    },
    openVideosDirectory: function () {
      return ensureListenReady().then(function (m) {
        if (m && typeof m.openVideosDirectory === "function") return m.openVideosDirectory();
      });
    },
    openLibrary: function (focus) {
      return ensureListenReady().then(function (m) {
        if (m && typeof m.openLibrary === "function") return m.openLibrary(focus);
      });
    },
    openMood: function (params, title) {
      return ensureListenReady().then(function (m) {
        if (m && typeof m.openMood === "function") return m.openMood(params, title);
      });
    },
    searchAndPlay: function (q) {
      return ensureListenReady().then(function (m) {
        if (m && typeof m.searchAndPlay === "function") return m.searchAndPlay(q);
        throw new Error("listen_not_ready");
      });
    },
    playVideoId: function (videoId, queueTracks) {
      return ensureListenReady().then(function (m) {
        if (!m || typeof m.playTracks !== "function") return;
        var seeds = Array.isArray(queueTracks) && queueTracks.length ? queueTracks : [{ videoId: videoId }];
        m.playTracks(seeds, videoId, "share");
        try {
          if (window.StepDaddyMusicPlayer && typeof window.StepDaddyMusicPlayer.setExpanded === "function") {
            setTimeout(function () {
              window.StepDaddyMusicPlayer.setExpanded(true);
            }, 400);
          }
        } catch (e) {}
      });
    },
    playTracks: function (tracks, startId, surface, meta) {
      return ensureListenReady().then(function (m) {
        if (!m || typeof m.playTracks !== "function") return;
        m.playTracks(tracks, startId, surface || "listen", meta || {});
      });
    },
    playUnifiedNow: function (opts) {
      return ensureListenReady().then(function (m) {
        if (!m || typeof m.playUnifiedNow !== "function") return;
        m.playUnifiedNow(opts || {});
      });
    },
    prewarmUpcoming: function (n) {
      return ensureListenReady().then(function (m) {
        if (m && typeof m.prewarmUpcoming === "function") m.prewarmUpcoming(n);
      });
    },
    playNext: function (track) {
      if (window.SDMusicUnifiedQueue) {
        window.SDMusicUnifiedQueue.playNext(track);
        return Promise.resolve();
      }
      return ensureListenReady().then(function (m) {
        if (m && typeof m.playNext === "function") m.playNext(track);
      });
    },
    addToQueue: function (track) {
      if (window.SDMusicUnifiedQueue) {
        window.SDMusicUnifiedQueue.addToQueue(track);
        return Promise.resolve();
      }
      return ensureListenReady().then(function (m) {
        if (m && typeof m.addToQueue === "function") m.addToQueue(track);
      });
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMount);
  } else {
    setTimeout(autoMount, 0);
  }
})();
