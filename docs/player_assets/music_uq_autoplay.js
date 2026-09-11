/**
 * Unified Queue Autoplay prepare / append (split from music_unified_queue.js).
 * API: window.SDMusicUQAutoplay.bind(ctx)
 */
(function () {
  if (window.SDMusicUQAutoplay) return;

  function bind(ctx) {
    var trackId = ctx.trackId;
    var cloneTrack = ctx.cloneTrack;
    var getSession = ctx.getSession;
    var emit = ctx.emit;
    var recentIds = ctx.recentIds;
    var MAX_AUTOPLAY = ctx.MAX_AUTOPLAY || 40;
    var AUTOPLAY_PREP_MS = ctx.AUTOPLAY_PREP_MS || 11000;
    var inflightRef = ctx.inflightRef; // { inflight, at, gen }

    function sess() {
      return getSession();
    }

    function appendAutoplay(tracks) {
      var session = sess();
      var seen = recentIds();
      (tracks || []).forEach(function (t) {
        if (!t || !trackId(t)) return;
        if (t.stationuuid || t.kind === "station" || t.source === "radio") return;
        var id = trackId(t);
        if (seen[id]) return;
        seen[id] = 1;
        var item = cloneTrack(t);
        item._queueLayer = "autoplay";
        if (t._ring != null) item._ring = t._ring;
        if (t._ringSource) item._ringSource = t._ringSource;
        if (t._parentArtist) item._parentArtist = t._parentArtist;
        else if (!item._ringSource && item._ring == null) {
          item._ring = 10;
          item._ringSource = "global";
        }
        session.autoplay.push(item);
      });
      // Cross-section dedupe: drop Autoplay ids already in Play Next / Up Next.
      var ahead = Object.create(null);
      (session.playNext || []).concat(session.upNext || []).forEach(function (t) {
        var id = trackId(t);
        if (id) ahead[id] = 1;
      });
      session.autoplay = (session.autoplay || []).filter(function (t) {
        var id = trackId(t);
        return id && !ahead[id];
      });
      if (window.SDMusicTaste && typeof window.SDMusicTaste.rankItems === "function") {
        try {
          var avoid = [];
          try {
            if (window.SDMusicSessionSignals) {
              avoid = window.SDMusicSessionSignals.avoidKeysList(
                window.SDMusicSessionSignals.buildExcludeMap(session, { allowSessionReplay: false })
              );
            }
          } catch (eA) {}
          var rankOpts = {
            entryPath: (session.source && (session.source.entryPath || session.source.type)) || "listen",
            seedItems: session.now ? [session.now] : [],
            softBoost: !session.autoplayBias,
            smartShuffle: !!session.autoplayBias,
            avoidKeys: avoid,
            parents: session.parents || [],
            multiParent: !!session.multiParent,
          };
          session.autoplay = window.SDMusicTaste.rankItems(session.autoplay, rankOpts) || session.autoplay;
        } catch (e) {}
      }
      if (session.autoplay.length > MAX_AUTOPLAY) {
        session.autoplay = session.autoplay.slice(0, MAX_AUTOPLAY);
      }
      emit();
    }

    function timed(promise, ms, fallback) {
      return new Promise(function (resolve) {
        var settled = false;
        function done(v) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(v);
        }
        var timer = setTimeout(function () {
          try {
            var fb = typeof fallback === "function" ? fallback() : fallback;
            Promise.resolve(fb).then(done, function () {
              done([]);
            });
          } catch (e) {
            done([]);
          }
        }, ms);
        Promise.resolve(promise).then(done, function () {
          try {
            var fb2 = typeof fallback === "function" ? fallback() : fallback;
            Promise.resolve(fb2).then(done, function () {
              done([]);
            });
          } catch (e2) {
            done([]);
          }
        });
      });
    }

    function refillCtx(seed, session, extra) {
      extra = extra || {};
      return Object.assign(
        {
          force: !!extra.force,
          state: {
            source: "listen",
            id: seed && trackId(seed),
            albumId:
              (seed && seed.albumId) ||
              (session.source && session.source.albumId) ||
              (session.source && session.source.type === "album" && session.source.id) ||
              "",
            albumTitle: (session.source && session.source.title) || (seed && seed.albumTitle) || "",
            artistId: (seed && seed.artistId) || (session.source && session.source.artistId) || "",
            title: seed && seed.title,
            subtitle: (seed && ((seed.artists && seed.artists.join(", ")) || seed.subtitle)) || "",
            year: seed && seed.year,
            entryPath: (session.source && (session.source.entryPath || session.source.type)) || "listen",
          },
          queue: [],
          track: seed,
          source: "listen",
          entryPath: (session.source && (session.source.entryPath || session.source.type)) || "listen",
          sourceRemainder: (session.upNext || []).slice(),
          sourceOrder: (session.source && session.source.order) || [],
          sourceMeta: session.source || null,
          history: (session.history || []).slice(),
          parents: session.parents || (session.source && session.source.parents) || [],
          multiParent: !!(session.multiParent || (session.source && session.source.multiParent)),
          ringSteer: session.ringSteer || null,
          excludeIds: recentIds({ allowSessionReplay: !!extra.allowSessionReplay }),
          allowSessionReplay: !!extra.allowSessionReplay,
        },
        extra.onBatch
          ? {
              onBatch: extra.onBatch,
            }
          : {}
      );
    }

    function prepareAutoplay(opts) {
      opts = opts || {};
      var session = sess();
      if (!session.autoplayEnabled) return Promise.resolve([]);
      if (!opts.force && session.autoplay.length >= 8 && (session.upNext || []).length >= 3) {
        return Promise.resolve(session.autoplay);
      }
      if (!opts.force && session.autoplay.length >= 12) return Promise.resolve(session.autoplay);

      if (inflightRef.inflight && !opts.force) {
        if (inflightRef.at && Date.now() - inflightRef.at < AUTOPLAY_PREP_MS) {
          return inflightRef.inflight;
        }
        inflightRef.inflight = null;
        inflightRef.at = 0;
      }

      var SQ = window.SDMusicSmartQueue;
      if (!SQ || typeof SQ.refill !== "function") {
        var local = [];
        try {
          if (SQ && typeof SQ.madeForYou === "function") local = SQ.madeForYou(16) || [];
        } catch (e) {}
        appendAutoplay(local);
        if (!session.autoplay.length && SQ && typeof SQ.emergencyPlayable === "function") {
          return SQ.emergencyPlayable(session.now, 16).then(function (tracks) {
            appendAutoplay(tracks);
            return sess().autoplay;
          });
        }
        return Promise.resolve(sess().autoplay);
      }

      var seed = session.now || (session.history.length && session.history[session.history.length - 1]) || null;
      var myGen = ++inflightRef.gen;
      inflightRef.at = Date.now();

      inflightRef.inflight = timed(
        SQ.refill(
          refillCtx(seed, session, {
            force: !!opts.force,
            onBatch: function (batch) {
              appendAutoplay(batch);
            },
          })
        ).then(function (res) {
          var q = (res && res.queue) || [];
          var cur = sess();
          // Ring-10 exhausted: allow session replay only if still empty after primary refill.
          if ((!q || !q.length) && (!cur.autoplay || !cur.autoplay.length)) {
            return SQ.refill(
              refillCtx(seed, cur, {
                force: true,
                allowSessionReplay: true,
              })
            ).then(function (res2) {
              appendAutoplay((res2 && res2.queue) || []);
              return sess().autoplay;
            });
          }
          appendAutoplay(q);
          return sess().autoplay;
        }),
        AUTOPLAY_PREP_MS,
        function () {
          if (typeof SQ.emergencyPlayable === "function") {
            return SQ.emergencyPlayable(seed, 20).then(function (tracks) {
              appendAutoplay(tracks);
              if (!sess().autoplay.length && typeof SQ.homeTracks === "function") {
                return SQ.homeTracks(24).then(function (home) {
                  appendAutoplay(home);
                  return sess().autoplay;
                });
              }
              return sess().autoplay;
            });
          }
          return sess().autoplay;
        }
      )
        .then(function (list) {
          if ((!list || !list.length) && typeof SQ.emergencyPlayable === "function") {
            return SQ.emergencyPlayable(seed, 20).then(function (tracks) {
              appendAutoplay(tracks);
              return sess().autoplay;
            });
          }
          return sess().autoplay;
        })
        .catch(function () {
          return sess().autoplay;
        })
        .finally(function () {
          if (inflightRef.gen === myGen) {
            inflightRef.inflight = null;
            inflightRef.at = 0;
          }
        });
      return inflightRef.inflight;
    }

    return {
      prepareAutoplay: prepareAutoplay,
      appendAutoplay: appendAutoplay,
    };
  }

  window.SDMusicUQAutoplay = { bind: bind };
})();
