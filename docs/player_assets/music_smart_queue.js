/**
 * StepDaddy Music — always-on smart queue.
 * When prev/next would dead-end (empty/short queue), refill seamlessly from
 * source-aware fallbacks: album → artist radio → watch next → made-for-you →
 * dial neighbors → search-similar → taste scorer.
 * API: window.SDMusicSmartQueue
 */
(function () {
  if (window.SDMusicSmartQueue) return;

  var LISTEN = "/api/music/listen";
  var FETCH_MS = 10000;
  var REFILL_MS = 12000;
  var inflight = null;
  var inflightStartedAt = 0;
  var inflightGen = 0;
  var lastFlow = null;

  function escQ(s) {
    return encodeURIComponent(String(s || "").trim());
  }

  function trackId(t) {
    return t && (t.videoId || t.id || t.stationuuid) ? String(t.videoId || t.id || t.stationuuid) : "";
  }

  function dedupeTracks(list) {
    var seen = Object.create(null);
    var out = [];
    (list || []).forEach(function (t) {
      var id = trackId(t);
      if (!id || seen[id]) return;
      seen[id] = 1;
      out.push(t);
    });
    return out;
  }

  function withTimeout(promise, ms, fallback) {
    ms = ms == null ? FETCH_MS : ms;
    return new Promise(function (resolve) {
      var settled = false;
      function done(v) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(v);
      }
      function useFallback() {
        try {
          var fb = typeof fallback === "function" ? fallback() : fallback;
          Promise.resolve(fb).then(done, function () {
            done([]);
          });
        } catch (e) {
          done([]);
        }
      }
      var timer = setTimeout(useFallback, ms);
      Promise.resolve(promise).then(done, useFallback);
    });
  }

  function fetchJson(url, timeoutMs) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = null;
    var ms = timeoutMs == null ? FETCH_MS : timeoutMs;
    if (ctrl) {
      timer = setTimeout(function () {
        try {
          ctrl.abort();
        } catch (e) {}
      }, ms);
    }
    var opts = { credentials: "same-origin" };
    if (ctrl) opts.signal = ctrl.signal;
    return fetch(url, opts)
      .then(function (r) {
        if (!r.ok) throw new Error("http_" + r.status);
        return r.json();
      })
      .finally(function () {
        if (timer) clearTimeout(timer);
      });
  }

  function tasteRank(items, opts) {
    if (window.SDMusicTaste && typeof window.SDMusicTaste.rankItems === "function") {
      try {
        return window.SDMusicTaste.rankItems(items, opts) || items;
      } catch (e) {}
    }
    return items || [];
  }

  function classifyArtistShelves(shelves) {
    var out = { songs: [], albums: [], singles: [], videos: [] };
    (shelves || []).forEach(function (sh) {
      var t = String((sh && sh.title) || "").toLowerCase();
      var items = (sh && sh.items) || [];
      if (!items.length) return;
      if (/single|ep\b/i.test(t)) out.singles = out.singles.concat(items);
      else if (/album/i.test(t)) out.albums = out.albums.concat(items);
      else if (/video/i.test(t)) out.videos = out.videos.concat(items);
      else if (/song|popular|top track|hits/i.test(t) || items.some(function (i) { return i && i.videoId; })) {
        out.songs = out.songs.concat(
          items.filter(function (i) {
            return i && i.videoId;
          })
        );
      } else if (items.some(function (i) { return i && (i.browseId || "").indexOf("MPRE") === 0; })) {
        out.albums = out.albums.concat(items);
      }
    });
    return out;
  }

  function releaseSortKey(it) {
    var y = parseInt((it && (it.year || it.subtitle)) || "0", 10);
    if (!isFinite(y)) y = 0;
    return y;
  }

  /**
   * Artist-ecosystem Up Next builder (Spotify-like session continuity).
   * mode:
   *  - album-extend: other albums (by year/popularity shelf order) then singles; skip current album tracks
   *  - directory: popular + discography (shuffled/taste-ranked) before Autoplay
   * onBatch(tracks): optional progressive append callback
   */
  function artistEcosystem(opts) {
    opts = opts || {};
    var artistId = opts.artistId || "";
    var artistName = opts.artistName || "";
    var excludeAlbumId = String(opts.excludeAlbumId || "");
    var excludeIds = opts.excludeIds || Object.create(null);
    var mode = opts.mode || "directory";
    var maxAlbums = opts.maxAlbums || (mode === "album-extend" ? 8 : 5);
    var maxTracks = opts.maxTracks || 72;
    var onBatch = typeof opts.onBatch === "function" ? opts.onBatch : null;
    var entryPath = opts.entryPath || mode;
    var rankOpts = { entryPath: entryPath, softBoost: false, seedItems: opts.seedItems || [] };

    function notExcluded(t) {
      if (!t || !trackId(t)) return false;
      if (excludeIds[trackId(t)]) return false;
      if (excludeAlbumId && String(t.albumId || "") === excludeAlbumId) return false;
      return true;
    }

    function stampArtist(t, aid, aname) {
      var o = Object.assign({}, t);
      if (aid) {
        o.artistId = o.artistId || aid;
        o.artistIds = o.artistIds || [aid];
      }
      if (aname && (!o.artists || !o.artists.length)) o.artists = [aname];
      o._ecosystem = mode;
      return o;
    }

    function emitBatch(list) {
      var cleaned = dedupeTracks((list || []).filter(notExcluded).map(function (t) {
        return stampArtist(t, artistId, artistName);
      }));
      if (cleaned.length && onBatch) {
        try {
          onBatch(cleaned.slice());
        } catch (e) {}
      }
      return cleaned;
    }

    function resolveArtistId() {
      if (artistId) return Promise.resolve(String(artistId));
      if (!artistName) return Promise.resolve("");
      return fetchJson(LISTEN + "/search?q=" + escQ(artistName) + "&filter=artists&limit=8")
        .then(function (data) {
          var hit = ((data && data.items) || []).find(function (i) {
            var id = (i && (i.browseId || i.channelId || i.artistId)) || "";
            return id && String(id).indexOf("MPRE") !== 0;
          });
          return hit ? String(hit.browseId || hit.channelId || hit.artistId) : "";
        })
        .catch(function () {
          return "";
        });
    }

    function fetchReleaseTracks(browseId, albumTitle) {
      return albumTracks(browseId).then(function (tracks) {
        return (tracks || []).map(function (t) {
          return Object.assign({}, t, {
            albumId: t.albumId || browseId,
            albumTitle: t.albumTitle || albumTitle || "",
          });
        });
      });
    }

    return resolveArtistId().then(function (aid) {
      artistId = aid || artistId;
      if (!artistId && !artistName) return [];

      var head = artistId
        ? fetchJson(LISTEN + "/artist/" + escQ(artistId)).catch(function () {
            return null;
          })
        : Promise.resolve(null);

      return head.then(function (data) {
        if (!data || !data.ok) {
          return searchSimilar(artistName || "", 28).then(function (t) {
            return tasteRank(emitBatch(t), rankOpts).slice(0, maxTracks);
          });
        }
        if (data.title && !artistName) artistName = data.title;
        var parts = classifyArtistShelves(data.shelves || []);
        var popular = (parts.songs || []).filter(notExcluded);
        var albums = (parts.albums || [])
          .filter(function (a) {
            return a && a.browseId && String(a.browseId) !== excludeAlbumId;
          })
          .slice();
        // Prefer newer years first when year present; else keep YTM shelf (popularity) order.
        var hasYear = albums.some(function (a) {
          return releaseSortKey(a) > 1900;
        });
        if (hasYear) {
          albums.sort(function (a, b) {
            return releaseSortKey(b) - releaseSortKey(a);
          });
        }
        var singles = (parts.singles || []).filter(function (a) {
          return a && (a.browseId || a.videoId);
        });

        var acc = [];
        if (mode === "directory") {
          // Stay on artist: popular first (taste/shuffle-friendly), then discography.
          acc = acc.concat(tasteRank(emitBatch(popular), rankOpts));
        }

        var releaseQueue = [];
        if (mode === "album-extend") {
          albums.slice(0, maxAlbums).forEach(function (a) {
            releaseQueue.push({ browseId: a.browseId, title: a.title || "", kind: "album" });
          });
          singles.slice(0, Math.max(4, maxAlbums)).forEach(function (a) {
            if (a.browseId) releaseQueue.push({ browseId: a.browseId, title: a.title || "", kind: "single" });
            else if (a.videoId && notExcluded(a)) acc.push(stampArtist(a, artistId, artistName));
          });
        } else {
          // directory: mix albums + singles after popular
          albums.slice(0, maxAlbums).forEach(function (a) {
            releaseQueue.push({ browseId: a.browseId, title: a.title || "", kind: "album" });
          });
          singles.slice(0, 6).forEach(function (a) {
            if (a.browseId) releaseQueue.push({ browseId: a.browseId, title: a.title || "", kind: "single" });
            else if (a.videoId && notExcluded(a)) acc.push(stampArtist(a, artistId, artistName));
          });
        }

        if (acc.length) emitBatch(acc);

        // Serial-ish album fetches (2 at a time) so first track isn't blocked and Up Next grows.
        var i = 0;
        function nextPair() {
          if (acc.length >= maxTracks || i >= releaseQueue.length) {
            return Promise.resolve(acc);
          }
          var batch = releaseQueue.slice(i, i + 2);
          i += 2;
          return Promise.all(
            batch.map(function (rel) {
              return fetchReleaseTracks(rel.browseId, rel.title);
            })
          ).then(function (groups) {
            groups.forEach(function (tracks) {
              var more = emitBatch(tracks);
              if (mode === "directory") more = tasteRank(more, rankOpts);
              acc = dedupeTracks(acc.concat(more));
            });
            return nextPair();
          });
        }

        return nextPair().then(function () {
          // If still thin, fold leftover popular (album-extend) or search.
          if (mode === "album-extend" && popular.length) {
            acc = dedupeTracks(acc.concat(emitBatch(popular)));
          }
          if (acc.length < 6 && artistName) {
            return searchSimilar(artistName, 16).then(function (t) {
              var more = emitBatch(t);
              if (mode === "directory") more = tasteRank(more, rankOpts);
              return dedupeTracks(acc.concat(more)).slice(0, maxTracks);
            });
          }
          // Album-extend: preserve release order (albums → singles). Directory: predictive rank.
          if (mode === "directory") return tasteRank(dedupeTracks(acc), rankOpts).slice(0, maxTracks);
          return dedupeTracks(acc).slice(0, maxTracks);
        });
      });
    });
  }

  function madeForYou(limit) {
    var out = [];
    try {
      if (window.SDMusicTaste) {
        out = out.concat(window.SDMusicTaste.getRecent(12) || []);
        out = out.concat(window.SDMusicTaste.getLikes(12) || []);
      }
    } catch (e) {}
    try {
      if (window.SDMusicLibrary) {
        var snap = window.SDMusicLibrary.snapshot();
        out = out.concat((snap.liked || []).slice(0, 16));
      }
    } catch (e) {}
    out = dedupeTracks(
      out.filter(function (t) {
        return t && (t.videoId || (t.source === "listen" && t.id));
      }).map(function (t) {
        if (t.videoId) return t;
        return Object.assign({}, t, { videoId: t.id });
      })
    );
    return tasteRank(out).slice(0, limit || 24);
  }

  function watchNext(videoId, limit) {
    if (!videoId) return Promise.resolve([]);
    return fetchJson(LISTEN + "/watch?videoId=" + escQ(videoId) + "&limit=" + (limit || 25))
      .then(function (data) {
        return ((data && data.tracks) || []).filter(function (t) {
          return t && t.videoId;
        });
      })
      .catch(function () {
        return [];
      });
  }

  function albumTracks(albumId) {
    if (!albumId) return Promise.resolve([]);
    return fetchJson(LISTEN + "/album/" + escQ(albumId))
      .then(function (data) {
        return ((data && data.tracks) || [])
          .filter(function (t) {
            return t && t.videoId;
          })
          .map(function (t) {
            return Object.assign({}, t, {
              albumId: albumId,
              albumTitle: (data && data.title) || t.albumTitle || "",
            });
          });
      })
      .catch(function () {
        return [];
      });
  }

  function artistRadio(artistId, artistName) {
    if (artistId) {
      return fetchJson(LISTEN + "/artist/" + escQ(artistId))
        .then(function (data) {
          var tracks = [];
          ((data && data.shelves) || []).forEach(function (sh) {
            ((sh && sh.items) || []).forEach(function (it) {
              if (it && it.videoId) tracks.push(it);
            });
          });
          return dedupeTracks(tracks);
        })
        .catch(function () {
          return searchSimilar(artistName || "", 16);
        });
    }
    return searchSimilar(artistName || "", 16);
  }

  function searchSimilar(q, limit) {
    q = String(q || "").trim();
    if (!q) return Promise.resolve([]);
    return fetchJson(LISTEN + "/search?q=" + escQ(q) + "&filter=songs&limit=" + (limit || 16))
      .then(function (data) {
        return ((data && data.items) || []).filter(function (i) {
          return i && i.videoId;
        });
      })
      .catch(function () {
        return [];
      });
  }

  /** Related artists via artist search (name variants / "similar to"). */
  function relatedArtistTracks(artistName, limit) {
    var name = String(artistName || "").trim();
    if (!name) return Promise.resolve([]);
    var queries = [
      name + " songs",
      "artists like " + name,
      name + " type beat",
      name + " radio",
    ];
    return Promise.all(
      queries.map(function (q) {
        return withTimeout(searchSimilar(q, 10), FETCH_MS, []);
      })
    ).then(function (groups) {
      var acc = [];
      groups.forEach(function (g) {
        acc = acc.concat(g || []);
      });
      return dedupeTracks(acc).slice(0, limit || 24);
    });
  }

  /** Pull playable tracks from Listen home shelves (trending / charts / mixes). */
  function homeTracks(limit) {
    return fetchJson(LISTEN + "/home")
      .then(function (data) {
        var out = [];
        ((data && data.shelves) || []).forEach(function (sh) {
          ((sh && sh.items) || []).forEach(function (it) {
            if (it && it.videoId) out.push(it);
          });
        });
        return dedupeTracks(out).slice(0, limit || 30);
      })
      .catch(function () {
        return [];
      });
  }

  /** Last-resort playable search ladder — never return empty if Listen search works. */
  function emergencyPlayable(seed, limit) {
    var title = (seed && seed.title) || "";
    var artist =
      (seed && seed.artists && seed.artists[0]) ||
      (seed && seed.subtitle) ||
      "";
    var ladder = [
      [title, artist].filter(Boolean).join(" "),
      artist,
      artist ? artist + " hits" : "",
      "new music friday",
      "today's top hits",
      "hip hop hits",
      "pop hits",
      "trending music",
    ].map(function (q) {
      return String(q || "").trim();
    }).filter(Boolean);
    // De-dupe queries while preserving order
    var seenQ = Object.create(null);
    ladder = ladder.filter(function (q) {
      var k = q.toLowerCase();
      if (seenQ[k]) return false;
      seenQ[k] = 1;
      return true;
    });

    var acc = [];
    var i = 0;
    function next() {
      if (acc.length >= (limit || 16) || i >= ladder.length) {
        return Promise.resolve(dedupeTracks(acc).slice(0, limit || 24));
      }
      var q = ladder[i++];
      return withTimeout(searchSimilar(q, 12), FETCH_MS, []).then(function (tracks) {
        acc = acc.concat(tracks || []);
        if (acc.length >= (limit || 16)) {
          return dedupeTracks(acc).slice(0, limit || 24);
        }
        return next();
      });
    }
    return next();
  }

  function dialNeighbors(state) {
    var P = window.StepDaddyMusicPlayer;
    var inst = P && P._instance;
    var dial = (inst && inst._dial && inst._dial.list) || [];
    if (!dial.length && window.SDMusicRadioCache) {
      try {
        var cached = window.SDMusicRadioCache.get("/dial", window.SDMusicRadioCache.geoParams() || {});
        dial = (cached && cached.dial) || [];
      } catch (e) {}
    }
    if (!dial.length) return [];
    var curId = state && state.id;
    var idx = dial.findIndex(function (s) {
      return String(s.stationuuid) === String(curId);
    });
    if (idx < 0) idx = 0;
    var out = [];
    for (var i = 1; i <= dial.length && out.length < 24; i++) {
      out.push(dial[(idx + i) % dial.length]);
    }
    return out;
  }

  /**
   * Build a refill queue for the current play context.
   * Returns Promise<{ queue, flow, source }>
   * Never dead-ends: most-relevant → least (album → artist → related → watch →
   * home/trending → search → made-for-you → library → emergency ladder).
   * Each step times out so a hung Listen call cannot strand Autoplay on "Preparing…".
   */
  function refill(ctx) {
    ctx = ctx || {};
    var state = ctx.state || {};
    var source = ctx.source || state.source || "listen";
    var current = ctx.track || state.track || {
      videoId: state.source === "listen" ? state.id : "",
      albumId: state.albumId,
      artistId: state.artistId,
      title: state.title,
      subtitle: state.subtitle,
      artists: state.subtitle ? [state.subtitle] : [],
    };
    var existing = dedupeTracks(ctx.queue || state.queue || []);
    var onBatch = typeof ctx.onBatch === "function" ? ctx.onBatch : null;
    var force = !!ctx.force;

    // Abandon hung shared inflight so Autoplay can recover.
    if (inflight && !force && inflightStartedAt && Date.now() - inflightStartedAt < REFILL_MS) {
      return inflight;
    }
    if (inflight && !force) {
      inflight = null;
      inflightStartedAt = 0;
    }

    var flowSteps = [];
    var emitted = Object.create(null);

    function finish(queue, flow) {
      queue = dedupeTracks(existing.concat(queue || []));
      // Keep current first if present
      var curId = trackId(current) || String(state.id || "");
      if (curId) {
        var head = queue.filter(function (t) {
          return trackId(t) === curId;
        });
        var rest = queue.filter(function (t) {
          return trackId(t) !== curId;
        });
        queue = head.concat(rest);
      }
      lastFlow = { flow: flow, at: Date.now(), source: source, n: queue.length, steps: flowSteps.slice() };
      try {
        window.__sdMusicSmartQueueLast = lastFlow;
      } catch (e) {}
      return { queue: queue, flow: flow, source: source };
    }

    function emitProgress(acc) {
      if (!onBatch) return;
      var fresh = (acc || []).filter(function (t) {
        var id = trackId(t);
        if (!id || emitted[id]) return false;
        // Don't emit current as an autoplay candidate
        if (id === (trackId(current) || String(state.id || ""))) return false;
        emitted[id] = 1;
        return true;
      });
      if (!fresh.length) return;
      try {
        onBatch(fresh);
      } catch (e) {}
    }

    function step(name, acc, need, runner) {
      if (acc.length >= need) return Promise.resolve(acc);
      flowSteps.push(name);
      return withTimeout(Promise.resolve().then(runner), FETCH_MS, []).then(function (tracks) {
        var next = dedupeTracks(acc.concat(tracks || []));
        emitProgress(next);
        return next;
      });
    }

    if (source === "radio") {
      var radioGen = ++inflightGen;
      inflightStartedAt = Date.now();
      inflight = Promise.resolve(finish(dialNeighbors(state), "radio-dial-neighbors")).finally(function () {
        if (inflightGen === radioGen) {
          inflight = null;
          inflightStartedAt = 0;
        }
      });
      return inflight;
    }

    var artistName =
      (current.artists && current.artists[0]) || current.subtitle || state.subtitle || "";
    var artistId = current.artistId || state.artistId || "";
    var albumId = current.albumId || state.albumId || "";
    var vid = current.videoId || (state.source === "listen" ? state.id : "") || "";

    // Listen / library / home / search flows — most relevant → least
    var chain = Promise.resolve([]);

    chain = chain.then(function (acc) {
      return step("album", acc, 8, function () {
        return albumId ? albumTracks(albumId) : [];
      });
    });

    chain = chain.then(function (acc) {
      return step("artist-radio", acc, 12, function () {
        if (!artistId && !artistName) return [];
        return artistRadio(artistId, artistName);
      });
    });

    chain = chain.then(function (acc) {
      return step("related-artists", acc, 16, function () {
        return relatedArtistTracks(artistName, 20);
      });
    });

    chain = chain.then(function (acc) {
      return step("watch-next", acc, 18, function () {
        return vid ? watchNext(vid, 25) : [];
      });
    });

    chain = chain.then(function (acc) {
      return step("home-trending", acc, 20, function () {
        return homeTracks(28);
      });
    });

    chain = chain.then(function (acc) {
      return step("made-for-you", acc, 22, function () {
        return madeForYou(20);
      });
    });

    chain = chain.then(function (acc) {
      return step("search-similar", acc, 12, function () {
        var q = [current.title || state.title, artistName].filter(Boolean).join(" ");
        return q ? searchSimilar(q, 12) : [];
      });
    });

    chain = chain.then(function (acc) {
      return step("library-liked", acc, 6, function () {
        try {
          if (window.SDMusicLibrary) return window.SDMusicLibrary.snapshot().liked || [];
        } catch (e) {}
        return [];
      });
    });

    // Absolute floor: keep searching until something playable lands
    chain = chain.then(function (acc) {
      return step("emergency-ladder", acc, 4, function () {
        return emergencyPlayable(current, 20);
      });
    });

    var myGen = ++inflightGen;
    inflightStartedAt = Date.now();
    inflight = withTimeout(
      chain.then(function (acc) {
        var ranked = tasteRank(dedupeTracks(acc), {
          entryPath: ctx.entryPath || state.entryPath || source || "listen",
          seedItems: current ? [current] : [],
        });
        emitProgress(ranked);
        var flow = flowSteps.join(">") || "empty";
        return finish(ranked, flow);
      }),
      REFILL_MS,
      function () {
        flowSteps.push("refill-timeout");
        return withTimeout(emergencyPlayable(current, 16), FETCH_MS, []).then(function (tracks) {
          emitProgress(tracks);
          return finish(tracks, flowSteps.join(">") || "refill-timeout");
        });
      }
    ).finally(function () {
      if (inflightGen === myGen) {
        inflight = null;
        inflightStartedAt = 0;
      }
    });
    return inflight;
  }

  /**
   * Ensure queue has items beyond current for dir (-1|1|0).
   * Mutates player state when possible; returns Promise of next index or -1.
   */
  function ensureAndPick(opts) {
    opts = opts || {};
    var P = window.StepDaddyMusicPlayer;
    var inst = P && P._instance;
    if (!inst) return Promise.resolve({ index: -1, queue: [], filled: false, flow: "no-player" });
    var dir = opts.dir == null ? 1 : opts.dir;
    var mode = opts.mode || (inst.state && inst.state.playMode) || "off";
    var queue = (opts.queue || inst.state.queue || []).slice();
    var qIndex = opts.queueIndex != null ? opts.queueIndex : inst.state.queueIndex;
    var source = opts.source || (inst.state && inst.state.source) || "listen";
    var priorLen = queue.length;

    function pick(q, idx) {
      if (typeof inst._pickQueueIndex === "function") return inst._pickQueueIndex(q, idx, dir, mode);
      var next = idx + (dir === 0 ? 1 : dir);
      if (next < 0 || next >= q.length) return -1;
      return next;
    }

    var tryIdx = pick(queue, qIndex);
    // Existing queue has a valid neighbor — stay on this context (album/playlist/etc).
    if (tryIdx >= 0) {
      return Promise.resolve({ index: tryIdx, queue: queue, filled: false, flow: "existing" });
    }

    // Radio: dial owns nav; do not fabricate a Listen refill that yanks away.
    if (source === "radio") {
      return Promise.resolve({ index: -1, queue: queue, filled: false, flow: "radio-dial" });
    }

    // Need soft-refill that extends the current Listen context (never Hot 97 / dial).
    return refill({
      state: inst.state,
      queue: queue,
      track: opts.track || inst.state.track,
      source: source === "radio" ? "listen" : source,
    }).then(function (res) {
      var q = res.queue || [];
      // Refuse radio/station items in a Listen refill.
      q = q.filter(function (t) {
        if (!t) return false;
        if (t.stationuuid || t.kind === "station" || t.source === "radio") return false;
        return !!(t.videoId || t.id);
      });
      inst.state.queue = q;
      var curId = String(inst.state.id || "");
      var cur = q.findIndex(function (t) {
        return trackId(t) === curId;
      });
      if (cur < 0) cur = qIndex >= 0 ? Math.min(qIndex, Math.max(0, q.length - 1)) : 0;
      inst.state.queueIndex = cur;
      var idx = pick(q, cur);
      // Soft-refill grew the queue past prior length → take the new neighbor.
      if (idx < 0 && q.length > priorLen && cur + 1 < q.length) {
        idx = cur + 1;
      }
      // Off mode at true end with no growth → stop (index -1). Never wrap to radio.
      if (idx < 0 && mode === "off") {
        return { index: -1, queue: q, filled: true, flow: (res.flow || "end") + ":stop" };
      }
      // repeat-all / shuffle: allow wrap within the (possibly refilled) Listen queue only.
      if (idx < 0 && q.length > 1 && (mode === "repeat-all" || mode === "shuffle" || mode === "smart-shuffle")) {
        idx = mode === "repeat-all" ? (dir < 0 ? q.length - 1 : 0) : pick(q, cur);
        if (idx < 0) idx = (cur + 1) % q.length;
      }
      return { index: idx, queue: q, filled: true, flow: res.flow };
    });
  }

  /**
   * Hook for Listen playIndex handlers — wrap onPrev/onNext/onEnded.
   */
  function wrapListenHandlers(handlers, ctx) {
    handlers = handlers || {};
    function smart(dir, playIndexFn) {
      return function () {
        ensureAndPick({ dir: dir, queue: ctx.getQueue(), queueIndex: ctx.getIndex() }).then(function (res) {
          if (res.filled && typeof ctx.setQueue === "function") ctx.setQueue(res.queue, res.index >= 0 ? ctx.getIndex() : ctx.getIndex());
          if (res.index >= 0) playIndexFn(res.index);
          else if (typeof handlers.fallback === "function") handlers.fallback(dir);
        });
      };
    }
    return {
      onPrev: smart(-1, handlers.playIndex),
      onNext: smart(1, handlers.playIndex),
      onEnded: smart(0, handlers.playIndex),
    };
  }

  /**
   * Build initial queue when starting playback from a surface.
   */
  function buildOnPlay(surface, seedTracks, seedId, meta) {
    surface = surface || "unknown";
    meta = meta || {};
    var seeds = dedupeTracks(seedTracks || []);
    var flows = {
      album: function () {
        return albumTracks(meta.albumId).then(function (t) {
          return { queue: dedupeTracks(seeds.concat(t)), flow: "album" };
        });
      },
      artist: function () {
        return artistRadio(meta.artistId, meta.artistName).then(function (t) {
          return { queue: dedupeTracks(seeds.concat(t)), flow: "artist-radio" };
        });
      },
      playlist: function () {
        return Promise.resolve({ queue: seeds, flow: "playlist" });
      },
      library: function () {
        var liked = [];
        try {
          liked = (window.SDMusicLibrary && window.SDMusicLibrary.snapshot().liked) || [];
        } catch (e) {}
        return Promise.resolve({ queue: dedupeTracks(seeds.concat(liked)), flow: "library" });
      },
      search: function () {
        var q = meta.query || meta.title || "";
        return searchSimilar(q, 20).then(function (t) {
          return { queue: dedupeTracks(seeds.concat(t)), flow: "search-similar" };
        });
      },
      home: function () {
        var seed = seeds[0];
        var vid = seed && seed.videoId;
        return watchNext(vid, 25).then(function (t) {
          return { queue: dedupeTracks(seeds.concat(t).concat(madeForYou(12))), flow: "home-watch+made" };
        });
      },
      radio: function () {
        return Promise.resolve({ queue: dialNeighbors(meta), flow: "radio-dial" });
      },
      watch: function () {
        var vid = seedId || (seeds[0] && seeds[0].videoId);
        return watchNext(vid, 25).then(function (t) {
          return { queue: dedupeTracks(seeds.concat(t)), flow: "watch-next" };
        });
      },
      directory: function () {
        var seed = seeds[0] || {};
        return artistEcosystem({
          artistId: meta.artistId || seed.artistId,
          artistName: meta.artistName || (seed.artists && seed.artists[0]) || seed.subtitle || "",
          excludeIds: (function () {
            var m = Object.create(null);
            seeds.forEach(function (t) {
              var id = trackId(t);
              if (id) m[id] = 1;
            });
            return m;
          })(),
          mode: "directory",
          entryPath: "directory",
          seedItems: seeds,
          maxTracks: 48,
        }).then(function (t) {
          return { queue: dedupeTracks(seeds.concat(t)), flow: "directory-artist-ecosystem" };
        });
      },
    };
    var fn = flows[surface] || flows.home;
    return Promise.resolve()
      .then(fn)
      .then(function (res) {
        var q = tasteRank(dedupeTracks(res.queue || seeds), {
          entryPath: surface,
          seedItems: seeds,
          softBoost: surface === "home" || surface === "search",
        });
        if (seedId) {
          var i = q.findIndex(function (t) {
            return trackId(t) === String(seedId);
          });
          if (i > 0) {
            var hit = q.splice(i, 1)[0];
            q.unshift(hit);
          }
        }
        lastFlow = { flow: res.flow, surface: surface, at: Date.now(), n: q.length };
        return { queue: q, flow: res.flow, surface: surface };
      })
      .catch(function () {
        return { queue: seeds, flow: "seed-only", surface: surface };
      });
  }

  window.SDMusicSmartQueue = {
    refill: refill,
    ensureAndPick: ensureAndPick,
    buildOnPlay: buildOnPlay,
    wrapListenHandlers: wrapListenHandlers,
    artistEcosystem: artistEcosystem,
    madeForYou: madeForYou,
    homeTracks: homeTracks,
    emergencyPlayable: emergencyPlayable,
    last: function () {
      return lastFlow;
    },
  };
})();
