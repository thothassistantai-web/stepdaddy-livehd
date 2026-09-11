/**
 * StepDaddy Music — always-on smart queue.
 * Autoplay expands outward on a 10-ring ecosystem ladder (most → least specific).
 * Exhaust / soft-cap each ring before widening; never dead-end (ring 10 floor).
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

  var ER = null;
  var ECOSYSTEM_RINGS = [];
  var RING_TARGET = 28;
  var RING_FLOOR = 4;
  var stampRing = function () { return []; };
  var mergeParentGroups = function (g, n) { return []; };
  var normalizeParents = function () { return []; };
  var fanOutParents = function () { return Promise.resolve([]); };
  var seedYearOf = function () { return 0; };
  var parseCollaborators = function () { return []; };
  var relatedArtistTracks, sourceRemainderTracks, releaseFamilyTracks;
  var artistEraTracks, collaboratorTracks, genreMoodTracks, sessionTasteTracks;

  function bindEcosystemRings() {
    var api = window.SDMusicEcosystemRings;
    if (!api) return;
    ER = api;
    ECOSYSTEM_RINGS = api.RINGS || ECOSYSTEM_RINGS;
    RING_TARGET = api.RING_TARGET || RING_TARGET;
    RING_FLOOR = api.RING_FLOOR || RING_FLOOR;
    stampRing = api.stampRing;
    mergeParentGroups = api.mergeParentGroups;
    normalizeParents = api.normalizeParents;
    fanOutParents = api.fanOutParents;
    seedYearOf = api.seedYearOf;
    parseCollaborators = api.parseCollaborators;
  }

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

  var artistEcosystem = function (opts) {
    return wireArtistEcosystem()(opts);
  };

  function wireArtistEcosystem() {
    var api = window.SDMusicArtistEcosystem;
    if (!api || typeof api.attach !== "function") {
      return function () {
        return Promise.resolve([]);
      };
    }
    return api.attach({
      classifyArtistShelves: classifyArtistShelves,
      releaseSortKey: releaseSortKey,
      fetchJson: fetchJson,
      albumTracks: albumTracks,
      searchSimilar: searchSimilar,
      tasteRank: tasteRank,
      dedupeTracks: dedupeTracks,
      trackId: trackId,
      escQ: escQ,
      LISTEN: LISTEN,
      withTimeout: withTimeout,
      FETCH_MS: FETCH_MS,
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


  function wireRingFetchers() {
    bindEcosystemRings();
    if (!ER || typeof ER.attach !== "function") return;
    var fetchers = ER.attach({
      withTimeout: withTimeout,
      searchSimilar: searchSimilar,
      albumTracks: albumTracks,
      artistEcosystem: artistEcosystem,
      artistRadio: artistRadio,
      watchNext: watchNext,
      madeForYou: madeForYou,
      classifyArtistShelves: classifyArtistShelves,
      releaseSortKey: releaseSortKey,
      fetchJson: fetchJson,
      LISTEN: LISTEN,
      FETCH_MS: FETCH_MS,
      escQ: escQ,
      dedupeTracks: dedupeTracks,
    });
    relatedArtistTracks = fetchers.relatedArtistTracks;
    sourceRemainderTracks = fetchers.sourceRemainderTracks;
    releaseFamilyTracks = fetchers.releaseFamilyTracks;
    artistEraTracks = fetchers.artistEraTracks;
    collaboratorTracks = fetchers.collaboratorTracks;
    genreMoodTracks = fetchers.genreMoodTracks;
    sessionTasteTracks = fetchers.sessionTasteTracks;
  }

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
   * Returns Promise<{ queue, flow, source, rings }>
   * 10-ring ecosystem ladder (outward only): now → source remainder → release family →
   * artist-era → artist catalog → collaborators → related → genre/mood → taste → global.
   * Soft-cap each ring before widening; ring 10 never dead-ends.
   * Each step times out so a hung Listen call cannot strand Autoplay on "Preparing…".
   */
  function refill(ctx) {
    wireRingFetchers();
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
      year: state.year,
      albumTitle: state.albumTitle,
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
      lastFlow = {
        flow: flow,
        at: Date.now(),
        source: source,
        n: queue.length,
        steps: flowSteps.slice(),
        rings: flowSteps.slice(),
      };
      try {
        window.__sdMusicSmartQueueLast = lastFlow;
      } catch (e) {}
      return { queue: queue, flow: flow, source: source, rings: flowSteps.slice() };
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
    var albumId =
      current.albumId ||
      state.albumId ||
      (ctx.sourceMeta && ctx.sourceMeta.albumId) ||
      "";
    var albumTitle =
      current.albumTitle || state.albumTitle || (ctx.sourceMeta && ctx.sourceMeta.title) || "";
    var vid = current.videoId || (state.source === "listen" ? state.id : "") || "";
    var year = seedYearOf(current, state);
    var steer = ctx.ringSteer || null;
    var plan =
      window.SDMusicSessionSignals && typeof window.SDMusicSessionSignals.refillPlan === "function"
        ? window.SDMusicSessionSignals.refillPlan(steer)
        : { preferRing: 5, stayBias: 0, softCapMul: {}, minStartRing: 1, targetBoost: 0 };
    var target = (ctx.target || RING_TARGET) + (plan.targetBoost || 0);
    var floor = ctx.floor || RING_FLOOR;
    var excludeMap = ctx.excludeIds || Object.create(null);
    var allowReplay = !!ctx.allowSessionReplay;
    // Re-weight parents from realtime steer (boost liked parents; suppress skipped/removed).
    var parents = normalizeParents(ctx.parents, artistId, artistName).map(function (p) {
      var o = Object.assign({}, p);
      if (window.SDMusicSessionSignals && typeof window.SDMusicSessionSignals.parentWeight === "function") {
        o.weight = window.SDMusicSessionSignals.parentWeight(steer, o.artistName, o.weight || 1);
      }
      return o;
    });
    parents.sort(function (a, b) {
      return (b.weight || 0) - (a.weight || 0);
    });
    // Drop heavily suppressed parents from fan-out (keep at least one).
    var filteredParents = parents.filter(function (p) {
      return (p.weight || 0) > 0.25;
    });
    if (filteredParents.length) parents = filteredParents;
    var multiParent = !!(ctx.multiParent && parents.length > 1);

    function filterExcluded(list) {
      return (list || []).filter(function (t) {
        var id = trackId(t);
        if (!id) return false;
        if (!allowReplay && excludeMap[id]) return false;
        return true;
      });
    }

    function runRing(ring, acc) {
      // Ring 1 = parent context only — never fan out.
      if (ring.id === 1) {
        flowSteps.push(ring.label);
        return Promise.resolve(acc);
      }
      // Hard-skip steer: soft-skip early rings to move outward faster.
      if (plan.minStartRing > 1 && ring.id < plan.minStartRing && ring.id < 10) {
        flowSteps.push(ring.label + "*steer-skip");
        return Promise.resolve(acc);
      }
      var mul = (plan.softCapMul && plan.softCapMul[ring.id]) || 1;
      var softCap = Math.max(0, Math.round((ring.softCap || 8) * mul));
      // Prefer-ring stay: don't early-exit before we've tried the preferred ring.
      var prefer = plan.preferRing || 5;
      var stay = (plan.stayBias || 0) >= 0.8;
      if (ring.id < 10 && acc.length >= target) {
        if (!(stay && ring.id <= prefer + 1 && softCap > 0)) {
          return Promise.resolve(acc);
        }
      }
      if (ring.id === 10 && acc.length >= floor && acc.length >= target) {
        return Promise.resolve(acc);
      }
      if (softCap <= 0 && ring.id < 10) {
        flowSteps.push(ring.label + "*cap0");
        return Promise.resolve(acc);
      }
      var stepLabel = multiParent && ring.id >= 4 && ring.id <= 9 ? ring.label + "*parents" : ring.label;
      if (stay && ring.id === prefer) stepLabel += "*steer";
      if ((plan.stayBias || 0) <= -0.8 && ring.id >= prefer) stepLabel += "*out";
      flowSteps.push(stepLabel);
      var runner;
      if (ring.id === 2) {
        runner = function () {
          // Mixed source: remainder of playlist/likes; single album still album tracks.
          return sourceRemainderTracks(ctx, multiParent ? "" : albumId);
        };
      } else if (ring.id === 3) {
        runner = function () {
          // No single release family on mixed playlists/likes — soft-skip.
          if (multiParent) return [];
          return releaseFamilyTracks(current, albumTitle, artistName, albumId, softCap + 4);
        };
      } else if (ring.id === 4) {
        runner = function () {
          if (multiParent) {
            return fanOutParents(parents, Math.max(2, Math.ceil(4 * mul)), function (p) {
              return artistEraTracks(p.artistId, p.artistName, p.year || year, "", 6);
            });
          }
          return artistEraTracks(artistId, artistName, year, albumId, softCap + 4);
        };
      } else if (ring.id === 5) {
        runner = function () {
          if (multiParent) {
            return fanOutParents(parents, Math.max(2, Math.ceil(5 * mul)), function (p) {
              if (!p.artistId && !p.artistName) return [];
              return artistRadio(p.artistId, p.artistName);
            });
          }
          if (!artistId && !artistName) return [];
          return artistRadio(artistId, artistName);
        };
      } else if (ring.id === 6) {
        runner = function () {
          if (multiParent) {
            // Collaborators across parents: features on source tracks + per-parent guests.
            var fromSource = [];
            ((ctx.sourceOrder || ctx.sourceRemainder || []) || []).slice(0, 40).forEach(function (t) {
              parseCollaborators(t).forEach(function (n) {
                if (fromSource.indexOf(n) < 0) fromSource.push(n);
              });
            });
            var collabParents = fromSource.slice(0, 6).map(function (n) {
              return { artistId: "", artistName: n, weight: 1 };
            });
            if (!collabParents.length) {
              return fanOutParents(parents.slice(0, 4), 3, function (p) {
                return searchSimilar((p.artistName || "") + " feat", 6);
              });
            }
            return fanOutParents(collabParents, 3, function (p) {
              return searchSimilar((p.artistName || "") + " songs", 8);
            });
          }
          return collaboratorTracks(current, softCap + 4);
        };
      } else if (ring.id === 7) {
        runner = function () {
          if (multiParent) {
            return fanOutParents(parents, Math.max(2, Math.ceil(4 * mul)), function (p) {
              return relatedArtistTracks(p.artistName, 10, true);
            });
          }
          return relatedArtistTracks(artistName, 20, true);
        };
      } else if (ring.id === 8) {
        runner = function () {
          if (multiParent) {
            var genreQs = [];
            parents.forEach(function (p) {
              (p.genres || []).forEach(function (g) {
                if (g && genreQs.indexOf(g) < 0) genreQs.push(g);
              });
            });
            var head = vid ? watchNext(vid, 12) : Promise.resolve([]);
            return head.then(function (watch) {
              return fanOutParents(
                (genreQs.length ? genreQs : parents.map(function (p) { return p.artistName; }))
                  .slice(0, 4)
                  .map(function (g) {
                    return { artistName: String(g), artistId: "", weight: 1 };
                  }),
                4,
                function (p) {
                  var q = /hits|songs/i.test(p.artistName)
                    ? p.artistName
                    : p.artistName + (genreQs.length ? " hits" : " type beat");
                  return searchSimilar(q, 8);
                }
              ).then(function (more) {
                return dedupeTracks((watch || []).concat(more || []));
              });
            });
          }
          return genreMoodTracks(current, vid, softCap + 6);
        };
      } else if (ring.id === 9) {
        runner = function () {
          // Session taste already global; seed with all parents for co-occurrence ranking later.
          return sessionTasteTracks(softCap + 6);
        };
      } else {
        // Ring 10 — charts / trending / emergency anything-playable
        runner = function () {
          return homeTracks(28).then(function (home) {
            var acc10 = home || [];
            if (acc10.length >= floor) return acc10;
            return emergencyPlayable(current, 20).then(function (em) {
              return dedupeTracks(acc10.concat(em || []));
            });
          });
        };
      }
      return withTimeout(Promise.resolve().then(runner), FETCH_MS, []).then(function (tracks) {
        var stamped = stampRing(filterExcluded(tracks || []), ring.id, ring.label).slice(
          0,
          ring.id === 10 ? softCap || 24 : softCap || 24
        );
        // Prefer-ring: put steered ring tracks nearer the front of acc for ranking.
        var next =
          stay && ring.id === prefer
            ? dedupeTracks(stamped.concat(acc))
            : dedupeTracks(acc.concat(stamped));
        emitProgress(next);
        return next;
      });
    }

    // Walk rings 1 → 10 outward only (never skip inward).
    var chain = Promise.resolve([]);
    ECOSYSTEM_RINGS.forEach(function (ring) {
      chain = chain.then(function (acc) {
        return runRing(ring, acc);
      });
    });

    // Absolute floor if somehow still empty after ring 10
    chain = chain.then(function (acc) {
      if (acc.length >= floor) return acc;
      flowSteps.push("emergency-ladder");
      return withTimeout(emergencyPlayable(current, 20), FETCH_MS, []).then(function (tracks) {
        var next = dedupeTracks(acc.concat(stampRing(tracks || [], 10, "global")));
        emitProgress(next);
        return next;
      });
    });

    var myGen = ++inflightGen;
    inflightStartedAt = Date.now();
    inflight = withTimeout(
      chain.then(function (acc) {
        var ranked = tasteRank(dedupeTracks(acc), {
          entryPath: ctx.entryPath || state.entryPath || source || "listen",
          seedItems: (function () {
            var seeds = current ? [current] : [];
            parents.forEach(function (p) {
              seeds.push({
                videoId: "parent-seed-" + (p.artistId || p.artistName),
                artists: [p.artistName],
                artist: p.artistName,
                title: p.artistName,
              });
            });
            return seeds;
          })(),
        });
        // Preserve ring stamps through taste rank when possible
        try {
          var byId = Object.create(null);
          (acc || []).forEach(function (t) {
            var id = trackId(t);
            if (id && t && t._ring != null) byId[id] = t;
          });
          ranked = (ranked || []).map(function (t) {
            var id = trackId(t);
            var prev = id && byId[id];
            if (!prev) return t;
            if (t._ring == null && prev._ring != null) {
              return Object.assign({}, t, { _ring: prev._ring, _ringSource: prev._ringSource });
            }
            return t;
          });
        } catch (eRank) {}
        emitProgress(ranked);
        var flow = flowSteps.join(">") || "empty";
        return finish(ranked, flow);
      }),
      REFILL_MS,
      function () {
        flowSteps.push("refill-timeout");
        return withTimeout(emergencyPlayable(current, 16), FETCH_MS, []).then(function (tracks) {
          var stamped = stampRing(tracks || [], 10, "global");
          emitProgress(stamped);
          return finish(stamped, flowSteps.join(">") || "refill-timeout");
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
    artistRadio: artistRadio,
    madeForYou: madeForYou,
    homeTracks: homeTracks,
    emergencyPlayable: emergencyPlayable,
    rings: ECOSYSTEM_RINGS,
    stampRing: function () { wireRingFetchers(); return stampRing.apply(null, arguments); },
    parseCollaborators: function () { wireRingFetchers(); return parseCollaborators.apply(null, arguments); },
    mergeParentGroups: function () { wireRingFetchers(); return mergeParentGroups.apply(null, arguments); },
    normalizeParents: function () { wireRingFetchers(); return normalizeParents.apply(null, arguments); },
    last: function () {
      return lastFlow;
    },
  };
})();
