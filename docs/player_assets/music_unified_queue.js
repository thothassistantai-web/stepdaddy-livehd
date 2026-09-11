/**
 * StepDaddy Music — Unified Listen session timeline.
 * History → Now Playing → Play Next → Up Next → Autoplay
 * Radio stays dial-only; this module is Listen-only.
 * API: window.SDMusicUnifiedQueue
 */
(function () {
  if (window.SDMusicUnifiedQueue) return;

  var LS_KEY = "sd_music_unified_session_v1";
  var LS_AUTOPLAY = "sd_music_autoplay_enabled";
  var MAX_HISTORY = 80;
  var MAX_AUTOPLAY = 40;

  function trackId(t) {
    if (!t) return "";
    return String(t.videoId || t.id || "");
  }

  function cloneTrack(t) {
    if (!t || typeof t !== "object") return t;
    var o = {};
    for (var k in t) {
      if (Object.prototype.hasOwnProperty.call(t, k)) o[k] = t[k];
    }
    return o;
  }

  function dedupeKeepOrder(list, allowManualDupes) {
    if (allowManualDupes) return (list || []).slice();
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

  function shuffleInPlace(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function readAutoplayPref() {
    try {
      var v = localStorage.getItem(LS_AUTOPLAY);
      if (v === "0" || v === "false") return false;
      if (v === "1" || v === "true") return true;
    } catch (e) {}
    return true;
  }

  function writeAutoplayPref(on) {
    try {
      localStorage.setItem(LS_AUTOPLAY, on ? "1" : "0");
    } catch (e) {}
  }

  /** Map legacy playMode → { shuffle, repeat, autoplayBias } */
  function mapPlayMode(mode) {
    mode = mode || "off";
    if (mode === "repeat-one") return { shuffle: false, repeat: "one", autoplayBias: false };
    if (mode === "repeat-all") return { shuffle: false, repeat: "all", autoplayBias: false };
    if (mode === "shuffle") return { shuffle: true, repeat: "off", autoplayBias: false };
    if (mode === "smart-shuffle") return { shuffle: true, repeat: "off", autoplayBias: true };
    // off / straight — no wrap; autoplay still allowed if user pref on
    return { shuffle: false, repeat: "off", autoplayBias: false };
  }

  function emptySession() {
    return {
      v: 1,
      source: null, // { type, id, title, order[], startTrackId, artistId, artistName, entryPath }
      now: null,
      history: [],
      playNext: [], // FIFO of manual "Play Next" — newest insert at front
      upNext: [],
      autoplay: [],
      shuffle: false,
      repeat: "off", // off | all | one
      autoplayEnabled: readAutoplayPref(),
      autoplayBias: false,
      positionSec: 0,
      layer: "source", // source | autoplay
      ecosystemPending: false,
      updatedAt: 0,
    };
  }

  var session = emptySession();
  var persistTimer = null;
  var autoplayInflight = null;
  var autoplayInflightAt = 0;
  var autoplayPrepGen = 0;
  var ecosystemInflight = null;
  var listeners = [];
  var AUTOPLAY_PREP_MS = 11000;

  function emit() {
    var snap = getTimeline();
    listeners.forEach(function (fn) {
      try {
        fn(snap);
      } catch (e) {}
    });
    schedulePersist();
    syncPlayerState();
  }

  function schedulePersist() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(persist, 280);
  }

  function persist() {
    session.updatedAt = Date.now();
    try {
      var a = window.StepDaddyMusicPlayer && window.StepDaddyMusicPlayer._instance && window.StepDaddyMusicPlayer._instance.audio;
      if (a && isFinite(a.currentTime)) session.positionSec = a.currentTime;
    } catch (e) {}
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(session));
    } catch (e) {}
  }

  function restore() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      var data = JSON.parse(raw);
      if (!data || data.v !== 1) return false;
      session = Object.assign(emptySession(), data);
      session.autoplayEnabled = readAutoplayPref();
      return !!(session.now && trackId(session.now));
    } catch (e) {
      return false;
    }
  }

  function syncPlayerState() {
    try {
      var P = window.StepDaddyMusicPlayer && window.StepDaddyMusicPlayer._instance;
      if (!P || P.state.source === "radio") return;
      var flat = flattenUpcoming(true);
      P.state.queue = [session.now].concat(flat).filter(Boolean);
      P.state.queueIndex = session.now ? 0 : -1;
      P.state.sessionLayer = session.layer;
      P.state.autoplayEnabled = session.autoplayEnabled;
      if (session.source) {
        if (session.source.type === "album") {
          P.state.albumId = session.source.id || P.state.albumId;
          P.state.albumTitle = session.source.title || P.state.albumTitle;
        }
        if (session.source.type === "artist") {
          P.state.artistId = session.source.id || P.state.artistId;
        }
      }
    } catch (e) {}
  }

  function flattenUpcoming(includeAutoplay) {
    var out = session.playNext.slice();
    out = out.concat(session.upNext);
    if (includeAutoplay !== false) out = out.concat(session.autoplay);
    return out.filter(Boolean);
  }

  function applyShuffleToUpNext() {
    if (!session.shuffle) return;
    // Smart Shuffle: taste-rank (+ cold-start defaults) then rank noise for ties — not plain random.
    if (session.autoplayBias && window.SDMusicTaste && typeof window.SDMusicTaste.rankItems === "function") {
      try {
        var entry =
          (session.source && (session.source.entryPath || session.source.type)) || "listen";
        session.upNext =
          window.SDMusicTaste.rankItems(session.upNext, {
            entryPath: entry,
            seedItems: session.now ? [session.now] : [],
            smartShuffle: true,
          }) || session.upNext;
        return;
      } catch (e) {}
    }
    shuffleInPlace(session.upNext);
  }

  function extendUpNext(tracks, opts) {
    opts = opts || {};
    var seen = recentIds();
    var added = [];
    (tracks || []).forEach(function (t) {
      if (!t || !trackId(t)) return;
      if (t.stationuuid || t.kind === "station" || t.source === "radio") return;
      var id = trackId(t);
      if (seen[id]) return;
      seen[id] = 1;
      var item = cloneTrack(t);
      item._queueLayer = opts.layer || "artist-ecosystem";
      added.push(item);
    });
    if (!added.length) return 0;
    if (opts.rank !== false && window.SDMusicTaste && typeof window.SDMusicTaste.rankItems === "function") {
      try {
        added =
          window.SDMusicTaste.rankItems(added, {
            entryPath: opts.entryPath || (session.source && session.source.entryPath) || "",
            seedItems: session.now ? [session.now] : [],
            softBoost: !!opts.softBoost,
          }) || added;
      } catch (e) {}
    }
    if (opts.shuffle) shuffleInPlace(added);
    session.upNext = session.upNext.concat(added);
    emit();
    return added.length;
  }

  function shouldExtendArtistEcosystem(meta) {
    meta = meta || {};
    var t = String(meta.type || meta.surface || "").toLowerCase();
    return t === "album" || t === "directory" || t === "tracks-directory" || t === "videos-directory";
  }

  /**
   * Prefetch artist discography into Up Next without blocking first track.
   * Album: rest-of-album already in upNext → append other albums then singles.
   * Directory: fill artist popular + discography before Autoplay.
   */
  function scheduleArtistEcosystem(meta, seeds) {
    meta = meta || {};
    if (!shouldExtendArtistEcosystem(meta)) return Promise.resolve([]);
    var SQ = window.SDMusicSmartQueue;
    if (!SQ || typeof SQ.artistEcosystem !== "function") return Promise.resolve([]);

    var excludeIds = Object.create(null);
    (seeds || []).forEach(function (t) {
      var id = trackId(t);
      if (id) excludeIds[id] = 1;
    });
    (session.upNext || []).forEach(function (t) {
      var id = trackId(t);
      if (id) excludeIds[id] = 1;
    });
    if (session.now) {
      var nid = trackId(session.now);
      if (nid) excludeIds[nid] = 1;
    }

    var surface = String(meta.type || meta.surface || "").toLowerCase();
    var mode = surface === "album" ? "album-extend" : "directory";
    var artistId =
      meta.artistId ||
      (session.now && (session.now.artistId || (session.now.artistIds && session.now.artistIds[0]))) ||
      (session.source && session.source.artistId) ||
      "";
    var artistName =
      meta.artistName ||
      (session.now && ((session.now.artists && session.now.artists[0]) || session.now.subtitle)) ||
      (session.source && session.source.artistName) ||
      "";

    session.ecosystemPending = true;
    if (ecosystemInflight) {
      // Allow overlapping schedule only for newest session; drop flag when done.
    }

    var seenBatch = Object.create(null);
    ecosystemInflight = SQ.artistEcosystem({
      artistId: artistId,
      artistName: artistName,
      excludeAlbumId: surface === "album" ? meta.id || meta.albumId || "" : "",
      excludeIds: excludeIds,
      mode: mode,
      entryPath: surface || mode,
      seedItems: seeds || (session.now ? [session.now] : []),
      maxAlbums: mode === "album-extend" ? 8 : 5,
      maxTracks: 72,
      onBatch: function (batch) {
        var fresh = (batch || []).filter(function (t) {
          var id = trackId(t);
          if (!id || seenBatch[id] || excludeIds[id]) return false;
          seenBatch[id] = 1;
          excludeIds[id] = 1;
          return true;
        });
        if (!fresh.length) return;
        extendUpNext(fresh, {
          layer: "artist-ecosystem",
          entryPath: surface,
          // Album continuity: keep release order from builder; directory may rank.
          rank: mode === "directory",
          shuffle: mode === "directory" && session.shuffle,
        });
      },
    })
      .then(function (all) {
        var fresh = (all || []).filter(function (t) {
          var id = trackId(t);
          if (!id || seenBatch[id] || excludeIds[id]) return false;
          seenBatch[id] = 1;
          return true;
        });
        if (fresh.length) {
          extendUpNext(fresh, {
            layer: "artist-ecosystem",
            entryPath: surface,
            rank: mode === "directory",
            shuffle: mode === "directory" && session.shuffle,
          });
        }
        return session.upNext;
      })
      .catch(function () {
        return session.upNext;
      })
      .finally(function () {
        session.ecosystemPending = false;
        ecosystemInflight = null;
        emit();
        // Top up Autoplay after ecosystem settles (still after Up Next).
        prepareAutoplay();
      });
    return ecosystemInflight;
  }

  function recentIds() {
    var ids = Object.create(null);
    (session.history || []).slice(-24).forEach(function (t) {
      var id = trackId(t);
      if (id) ids[id] = 1;
    });
    if (session.now) {
      var nid = trackId(session.now);
      if (nid) ids[nid] = 1;
    }
    session.playNext.concat(session.upNext).concat(session.autoplay).forEach(function (t) {
      var id = trackId(t);
      if (id) ids[id] = 1;
    });
    return ids;
  }

  /**
   * Start a new source session.
   * startId: play this track now; Up Next = remaining after it (not earlier tracks).
   * clearManual: default true (new source replaces session).
   */
  function startFromSource(tracks, startId, meta, opts) {
    opts = opts || {};
    meta = meta || {};
    var seeds = dedupeKeepOrder(
      (tracks || []).filter(function (t) {
        return t && trackId(t);
      })
    );
    if (!seeds.length) return null;

    var idx = 0;
    if (startId) {
      var found = seeds.findIndex(function (t) {
        return trackId(t) === String(startId);
      });
      if (found >= 0) idx = found;
    }

    var clearManual = opts.clearManual !== false;
    var prevManual = clearManual ? [] : session.playNext.slice();

    session.source = {
      type: meta.type || meta.surface || "listen",
      id: meta.id || meta.albumId || meta.artistId || meta.playlistId || "",
      title: meta.title || meta.albumTitle || meta.artistName || meta.playlistTitle || "",
      order: seeds.map(cloneTrack),
      startTrackId: trackId(seeds[idx]),
      artistId: meta.artistId || (seeds[idx] && (seeds[idx].artistId || (seeds[idx].artistIds && seeds[idx].artistIds[0]))) || "",
      artistName:
        meta.artistName ||
        (seeds[idx] && ((seeds[idx].artists && seeds[idx].artists[0]) || seeds[idx].subtitle)) ||
        "",
      entryPath: meta.entryPath || meta.type || meta.surface || "listen",
      albumId: meta.albumId || (meta.type === "album" ? meta.id : "") || (seeds[idx] && seeds[idx].albumId) || "",
    };
    session.now = cloneTrack(seeds[idx]);
    session.upNext = seeds.slice(idx + 1).map(cloneTrack);
    session.history = [];
    session.playNext = prevManual;
    session.autoplay = [];
    session.layer = "source";
    session.positionSec = 0;
    session.ecosystemPending = false;

    // Apply play-mode mapping
    var mode = opts.playMode;
    if (!mode) {
      try {
        var P = window.StepDaddyMusicPlayer;
        if (P && typeof P.getPlayMode === "function") mode = P.getPlayMode();
      } catch (e) {}
    }
    var mapped = mapPlayMode(mode);
    session.shuffle = mapped.shuffle;
    session.repeat = mapped.repeat;
    session.autoplayBias = mapped.autoplayBias;
    if (typeof opts.autoplayEnabled === "boolean") {
      session.autoplayEnabled = opts.autoplayEnabled;
      writeAutoplayPref(opts.autoplayEnabled);
    } else {
      session.autoplayEnabled = readAutoplayPref();
    }

    applyShuffleToUpNext();
    emit();
    try {
      if (window.SDMusicTaste && typeof window.SDMusicTaste.recordEntry === "function") {
        window.SDMusicTaste.recordEntry(session.source.entryPath);
      }
    } catch (e) {}
    // Prefetch artist ecosystem in background (album / directory) — don't block Now Playing.
    if (opts.extendArtistEcosystem !== false) {
      scheduleArtistEcosystem(session.source, seeds);
    }
    prepareAutoplay();
    return session.now;
  }

  function setPlayMode(mode) {
    var mapped = mapPlayMode(mode);
    var wasShuffle = session.shuffle;
    session.shuffle = mapped.shuffle;
    session.repeat = mapped.repeat;
    session.autoplayBias = mapped.autoplayBias;
    if (session.shuffle && !wasShuffle) applyShuffleToUpNext();
    emit();
  }

  function setAutoplayEnabled(on) {
    session.autoplayEnabled = !!on;
    writeAutoplayPref(session.autoplayEnabled);
    if (session.autoplayEnabled) prepareAutoplay();
    else session.autoplay = [];
    emit();
  }

  /** Play Next: insert after current (most recent Play Next is next → unshift). */
  function playNext(track) {
    if (!track || !trackId(track)) return;
    session.playNext.unshift(cloneTrack(track));
    emit();
  }

  /** Add to Queue: after all manual items, before source Up Next resumes. */
  function addToQueue(track) {
    if (!track || !trackId(track)) return;
    session.playNext.push(cloneTrack(track));
    emit();
  }

  function removeManualAt(index) {
    if (index < 0 || index >= session.playNext.length) return;
    session.playNext.splice(index, 1);
    emit();
  }

  function sectionList(section) {
    if (section === "playNext" || section === "manual") return session.playNext;
    if (section === "upNext" || section === "source") return session.upNext;
    if (section === "autoplay") return session.autoplay;
    return null;
  }

  function sectionLayer(section) {
    if (section === "playNext" || section === "manual") return "manual";
    if (section === "autoplay") return "autoplay";
    return "source";
  }

  /**
   * Remove a queued item from Play Next / Up Next / Autoplay by section+index.
   * Does not touch Now Playing.
   */
  function removeAt(section, index) {
    var list = sectionList(section);
    if (!list || index < 0 || index >= list.length) return null;
    var removed = list.splice(index, 1)[0] || null;
    emit();
    return removed;
  }

  /**
   * Jump Now Playing to a queued track at section+index.
   * Skipped upcoming items (before the target in Play Next → Up Next → Autoplay
   * order) move into History. Remaining items after the target stay in their
   * original sections. Does not call startFromSource (preserves source meta).
   */
  function jumpTo(section, index) {
    var list = sectionList(section);
    if (!list || index < 0 || index >= list.length) return null;
    var target = cloneTrack(list[index]);
    if (!target || !trackId(target)) return null;

    var buckets = [
      { key: "playNext", items: session.playNext.slice() },
      { key: "upNext", items: session.upNext.slice() },
      { key: "autoplay", items: session.autoplay.slice() },
    ];
    var mapKey =
      section === "manual" ? "playNext" : section === "source" ? "upNext" : section;
    var before = [];
    var after = { playNext: [], upNext: [], autoplay: [] };
    var found = false;

    buckets.forEach(function (b) {
      b.items.forEach(function (t, i) {
        if (!found) {
          if (b.key === mapKey && i === index) {
            found = true;
            return;
          }
          before.push(t);
          return;
        }
        after[b.key].push(t);
      });
    });
    if (!found) return null;

    if (session.now) pushHistory(session.now);
    before.forEach(function (t) {
      pushHistory(t);
    });

    session.now = target;
    session.playNext = after.playNext;
    session.upNext = after.upNext;
    session.autoplay = after.autoplay;
    session.layer = sectionLayer(section);
    session.positionSec = 0;
    emit();
    prepareAutoplay();
    return session.now;
  }

  function reorderManual(from, to) {
    if (from < 0 || from >= session.playNext.length) return;
    if (to < 0 || to >= session.playNext.length) return;
    var item = session.playNext.splice(from, 1)[0];
    session.playNext.splice(to, 0, item);
    emit();
  }

  function clearManual() {
    session.playNext = [];
    emit();
  }

  function pushHistory(track) {
    if (!track) return;
    session.history.push(cloneTrack(track));
    if (session.history.length > MAX_HISTORY) {
      session.history = session.history.slice(-MAX_HISTORY);
    }
  }

  function peekNextTrack() {
    if (session.repeat === "one" && session.now) return session.now;
    if (session.playNext.length) return session.playNext[0];
    if (session.upNext.length) return session.upNext[0];
    if (session.repeat === "all" && session.source && session.source.order && session.source.order.length) {
      return session.source.order[0];
    }
    if (session.autoplayEnabled && session.autoplay.length) return session.autoplay[0];
    return null;
  }

  /**
   * Advance to next playable. Decision order:
   * Repeat One → manual Play Next → Up Next → Repeat All → Autoplay → end
   * Returns { track, layer, ended } or null if ended.
   */
  function advanceNext(opts) {
    opts = opts || {};
    var fromEnded = !!opts.fromEnded;

    if (session.repeat === "one" && session.now && (fromEnded || opts.forceRepeatOne)) {
      return { track: session.now, layer: session.layer, ended: false, repeated: true };
    }

    function take(track, layer, extra) {
      if (session.now) pushHistory(session.now);
      session.now = track;
      session.layer = layer;
      emit();
      prepareAutoplay();
      return Object.assign({ track: session.now, layer: layer, ended: false }, extra || {});
    }

    // Manual Play Next
    if (session.playNext.length) {
      return take(session.playNext.shift(), "manual");
    }

    // Up Next from source
    if (session.upNext.length) {
      return take(session.upNext.shift(), "source");
    }

    // Artist ecosystem still prefetching — hold Now Playing until batch lands (like Autoplay wait).
    if (session.ecosystemPending) {
      return { track: null, layer: "source", ended: false, waiting: true };
    }

    // Repeat All — rebuild Up Next from source order after current
    if (session.repeat === "all" && session.source && session.source.order && session.source.order.length) {
      var order = session.source.order.map(cloneTrack);
      session.upNext = order.slice(1);
      if (session.shuffle) applyShuffleToUpNext();
      return take(order[0], "source", { wrapped: true });
    }

    // Autoplay
    if (session.autoplayEnabled) {
      if (!session.autoplay.length) {
        // Keep current as Now Playing until refill lands — don't push history yet.
        return { track: null, layer: "autoplay", ended: false, waiting: true };
      }
      return take(session.autoplay.shift(), "autoplay");
    }

    if (session.now) pushHistory(session.now);
    session.now = null;
    emit();
    return { track: null, layer: null, ended: true };
  }

  /**
   * Go to previous track from history (caller applies 5s restart rule before calling).
   */
  function advancePrev() {
    if (!session.history.length) return { track: session.now, layer: session.layer, ended: false, same: true };
    if (session.now) {
      // Current goes back to front of appropriate queue
      if (session.layer === "autoplay") session.autoplay.unshift(session.now);
      else if (session.layer === "manual") session.playNext.unshift(session.now);
      else session.upNext.unshift(session.now);
    }
    session.now = session.history.pop();
    session.layer = "history";
    emit();
    return { track: session.now, layer: "history", ended: false };
  }

  function skipUnavailable() {
    // Drop current into nothing; advance without re-queueing current
    session.now = null;
    return advanceNext({ fromEnded: true });
  }

  function prepareAutoplay(opts) {
    opts = opts || {};
    if (!session.autoplayEnabled) return Promise.resolve([]);
    if (!opts.force && session.autoplay.length >= 8) return Promise.resolve(session.autoplay);

    // Recover from a hung prepare so Autoplay never sits on "Preparing…" forever.
    if (autoplayInflight && !opts.force) {
      if (autoplayInflightAt && Date.now() - autoplayInflightAt < AUTOPLAY_PREP_MS) {
        return autoplayInflight;
      }
      autoplayInflight = null;
      autoplayInflightAt = 0;
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
          return session.autoplay;
        });
      }
      return Promise.resolve(session.autoplay);
    }

    var seed = session.now || (session.history.length && session.history[session.history.length - 1]) || null;
    var myGen = ++autoplayPrepGen;
    autoplayInflightAt = Date.now();

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

    autoplayInflight = timed(
      SQ.refill({
        force: !!opts.force,
        state: {
          source: "listen",
          id: seed && trackId(seed),
          albumId:
            (seed && seed.albumId) ||
            (session.source && session.source.albumId) ||
            (session.source && session.source.type === "album" && session.source.id) ||
            "",
          artistId: (seed && seed.artistId) || (session.source && session.source.artistId) || "",
          title: seed && seed.title,
          subtitle: (seed && ((seed.artists && seed.artists.join(", ")) || seed.subtitle)) || "",
          entryPath: (session.source && (session.source.entryPath || session.source.type)) || "listen",
        },
        queue: [],
        track: seed,
        source: "listen",
        entryPath: (session.source && (session.source.entryPath || session.source.type)) || "listen",
        onBatch: function (batch) {
          // Progressive fill — UI leaves "Preparing…" as soon as first candidates land.
          appendAutoplay(batch);
        },
      }).then(function (res) {
        var q = (res && res.queue) || [];
        appendAutoplay(q);
        return session.autoplay;
      }),
      AUTOPLAY_PREP_MS,
      function () {
        // Timeout path: force a fresh emergency ladder; never leave Autoplay empty.
        if (typeof SQ.emergencyPlayable === "function") {
          return SQ.emergencyPlayable(seed, 20).then(function (tracks) {
            appendAutoplay(tracks);
            if (!session.autoplay.length && typeof SQ.homeTracks === "function") {
              return SQ.homeTracks(24).then(function (home) {
                appendAutoplay(home);
                return session.autoplay;
              });
            }
            return session.autoplay;
          });
        }
        return session.autoplay;
      }
    )
      .then(function (list) {
        if ((!list || !list.length) && typeof SQ.emergencyPlayable === "function") {
          return SQ.emergencyPlayable(seed, 20).then(function (tracks) {
            appendAutoplay(tracks);
            return session.autoplay;
          });
        }
        return session.autoplay;
      })
      .catch(function () {
        return session.autoplay;
      })
      .finally(function () {
        if (autoplayPrepGen === myGen) {
          autoplayInflight = null;
          autoplayInflightAt = 0;
        }
      });
    return autoplayInflight;
  }

  function appendAutoplay(tracks) {
    var seen = recentIds();
    (tracks || []).forEach(function (t) {
      if (!t || !trackId(t)) return;
      if (t.stationuuid || t.kind === "station" || t.source === "radio") return;
      var id = trackId(t);
      if (seen[id]) return;
      seen[id] = 1;
      var item = cloneTrack(t);
      item._queueLayer = "autoplay";
      session.autoplay.push(item);
    });
    if (window.SDMusicTaste && typeof window.SDMusicTaste.rankItems === "function") {
      try {
        var rankOpts = {
          entryPath: (session.source && (session.source.entryPath || session.source.type)) || "listen",
          seedItems: session.now ? [session.now] : [],
          softBoost: !session.autoplayBias,
          smartShuffle: !!session.autoplayBias,
        };
        session.autoplay = window.SDMusicTaste.rankItems(session.autoplay, rankOpts) || session.autoplay;
      } catch (e) {}
    }
    if (session.autoplay.length > MAX_AUTOPLAY) {
      session.autoplay = session.autoplay.slice(0, MAX_AUTOPLAY);
    }
    emit();
  }

  function getTimeline() {
    var srcTitle =
      (session.source && session.source.title) ||
      (session.source && session.source.type) ||
      "Listen";
    return {
      now: session.now,
      history: session.history.slice(),
      playNext: session.playNext.slice(),
      upNext: session.upNext.slice(),
      autoplay: session.autoplay.slice(),
      source: session.source,
      sourceLabel: srcTitle,
      shuffle: session.shuffle,
      repeat: session.repeat,
      autoplayEnabled: session.autoplayEnabled,
      layer: session.layer,
      positionSec: session.positionSec,
      peekNext: peekNextTrack(),
    };
  }

  /** Flat queue for legacy callers: [now, ...playNext, ...upNext, ...autoplay] */
  function asFlatQueue() {
    var q = [];
    if (session.now) q.push(session.now);
    return q.concat(flattenUpcoming(true));
  }

  function currentIndex() {
    return session.now ? 0 : -1;
  }

  function onChange(fn) {
    if (typeof fn === "function") listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (f) {
        return f !== fn;
      });
    };
  }

  function reset() {
    session = emptySession();
    emit();
    try {
      localStorage.removeItem(LS_KEY);
    } catch (e) {}
  }

  // Restore lightly on load (UI state); playback resume is opt-in via restoreForUi
  try {
    restore();
  } catch (e) {}

  window.SDMusicUnifiedQueue = {
    startFromSource: startFromSource,
    playNext: playNext,
    addToQueue: addToQueue,
    removeManualAt: removeManualAt,
    removeAt: removeAt,
    jumpTo: jumpTo,
    reorderManual: reorderManual,
    clearManual: clearManual,
    advanceNext: advanceNext,
    advancePrev: advancePrev,
    skipUnavailable: skipUnavailable,
    peekNext: peekNextTrack,
    prepareAutoplay: prepareAutoplay,
    extendUpNext: extendUpNext,
    scheduleArtistEcosystem: scheduleArtistEcosystem,
    getTimeline: getTimeline,
    asFlatQueue: asFlatQueue,
    currentIndex: currentIndex,
    setPlayMode: setPlayMode,
    setAutoplayEnabled: setAutoplayEnabled,
    isAutoplayEnabled: function () {
      return !!session.autoplayEnabled;
    },
    mapPlayMode: mapPlayMode,
    persist: persist,
    restore: restore,
    reset: reset,
    onChange: onChange,
    trackId: trackId,
    getSession: function () {
      return session;
    },
  };
})();
