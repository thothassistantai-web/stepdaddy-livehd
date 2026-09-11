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
    var steer =
      window.SDMusicSessionSignals && typeof window.SDMusicSessionSignals.emptySteer === "function"
        ? window.SDMusicSessionSignals.emptySteer()
        : {
            v: 1,
            preferRing: 5,
            stayBias: 0,
            ringScores: {},
            parentBoosts: {},
            parentSuppress: {},
            suppressIds: {},
            sessionPlayed: {},
            signalLog: [],
            updatedAt: 0,
          };
    return {
      v: 1,
      source: null, // { type, id, title, order[], startTrackId, artistId, artistName, entryPath }
      parents: [], // multi-parent ecosystem: [{artistId, artistName, weight, count}]
      multiParent: false,
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
      ringSteer: steer,
      updatedAt: 0,
    };
  }

  /** Surfaces that often mix many artists — parents = union of source, not current track only. */
  function isMixedSurface(type) {
    var api = window.SDMusicEcosystemRings;
    if (api && api.isMixedSurface) return api.isMixedSurface(type);
    var t = String(type || "").toLowerCase();
    return !(t === "album" || t === "artist" || t === "directory");
  }

  function buildParentsFromTracks(tracks, opts) {
    var api = window.SDMusicEcosystemRings;
    if (api && api.buildParentsFromTracks) return api.buildParentsFromTracks(tracks, opts);
    return [];
  }

  function resolveParents(seeds, meta) {
    var api = window.SDMusicEcosystemRings;
    if (api && api.resolveParents) return api.resolveParents(seeds, meta);
    return { parents: [], multiParent: false, surface: String((meta && (meta.type || meta.surface)) || "").toLowerCase() };
  }

  // Module state — must stay declared (h split accidentally dropped these → Listen emit/onChange throw).
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
      try {
        if (window.SDMusicSessionSignals && typeof window.SDMusicSessionSignals.hydrateFromSession === "function") {
          window.SDMusicSessionSignals.hydrateFromSession(session);
        }
      } catch (eH) {}
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
        var avoid = [];
        try {
          if (window.SDMusicSessionSignals) {
            var ex = window.SDMusicSessionSignals.buildExcludeMap(session, { allowSessionReplay: false });
            // Don't exclude current upNext members from themselves — only history/suppress/recent.
            (session.upNext || []).forEach(function (t) {
              var id = trackId(t);
              if (id && ex[id] === "upNext") delete ex[id];
            });
            avoid = window.SDMusicSessionSignals.avoidKeysList(ex);
          }
        } catch (eEx) {}
        session.upNext =
          window.SDMusicTaste.rankItems(session.upNext, {
            entryPath: entry,
            seedItems: session.now ? [session.now] : [],
            smartShuffle: true,
            avoidKeys: avoid,
            parents: session.parents || [],
            multiParent: !!session.multiParent,
          }) || session.upNext;
        // Dedupe Up Next after rank (anti-repeat hardening).
        session.upNext = dedupeKeepOrder(session.upNext);
        return;
      } catch (e) {}
    }
    shuffleInPlace(session.upNext);
    session.upNext = dedupeKeepOrder(session.upNext);
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

  var _uqEco = null;
  function uqEco() {
    if (_uqEco) return _uqEco;
    var api = window.SDMusicUQEcosystem;
    if (!api || typeof api.bind !== "function") {
      _uqEco = {
        shouldExtendArtistEcosystem: function () { return false; },
        scheduleArtistEcosystem: function () { return Promise.resolve([]); },
        scheduleMultiParentEcosystem: function () { return Promise.resolve([]); },
      };
      return _uqEco;
    }
    _uqEco = api.bind({
      trackId: trackId,
      cloneTrack: cloneTrack,
      extendUpNext: extendUpNext,
      prepareAutoplay: function () { return prepareAutoplay.apply(null, arguments); },
      getSession: function () { return session; },
      emit: emit,
      ecosystemRef: { get inflight() { return ecosystemInflight; }, set inflight(v) { ecosystemInflight = v; } },
    });
    return _uqEco;
  }
  function shouldExtendArtistEcosystem(meta) { return uqEco().shouldExtendArtistEcosystem(meta); }
  function scheduleArtistEcosystem(meta, seeds) { return uqEco().scheduleArtistEcosystem(meta, seeds); }
  function scheduleMultiParentEcosystem(parents, seeds) { return uqEco().scheduleMultiParentEcosystem(parents, seeds); }

  function recentIds(opts) {
    opts = opts || {};
    if (window.SDMusicSessionSignals && typeof window.SDMusicSessionSignals.buildExcludeMap === "function") {
      try {
        return window.SDMusicSessionSignals.buildExcludeMap(session, {
          allowSessionReplay: !!opts.allowSessionReplay,
        });
      } catch (e) {}
    }
    var ids = Object.create(null);
    // Full session history (anti-repeat) — not just last 24.
    (session.history || []).forEach(function (t) {
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

    var parentInfo = resolveParents(seeds, meta);
    var ring2Label =
      (meta.type === "playlist" && "playlist") ||
      (meta.type === "liked" && "liked") ||
      (meta.type === "library" && "library") ||
      (meta.type === "home" && "home") ||
      (meta.type === "search" && "search") ||
      (meta.type === "album" && "album") ||
      (meta.type === "artist" && "artist") ||
      (parentInfo.multiParent ? "playlist" : "album");

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
      multiParent: parentInfo.multiParent,
      parents: parentInfo.parents,
    };
    session.parents = parentInfo.parents;
    session.multiParent = parentInfo.multiParent;
    session.now = cloneTrack(seeds[idx]);
    session.upNext = seeds.slice(idx + 1).map(function (t) {
      var o = cloneTrack(t);
      o._ring = 2;
      o._ringSource = ring2Label;
      var pname = (t.artists && t.artists[0]) || t.subtitle || "";
      if (pname) o._parentArtist = pname;
      return o;
    });
    session.history = [];
    session.playNext = prevManual;
    session.autoplay = [];
    session.layer = "source";
    session.positionSec = 0;
    session.ecosystemPending = false;
    // Fresh ring-steer / suppress for new source session; seed played with start track.
    try {
      if (window.SDMusicSessionSignals) {
        session.ringSteer = window.SDMusicSessionSignals.emptySteer();
        window.SDMusicSessionSignals.markSessionPlayed(session.ringSteer, session.now);
      }
    } catch (eSteer) {}

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
    // Single-tree: prefetch artist ecosystem. Multi-parent: union prefetch (all parents).
    if (opts.extendArtistEcosystem !== false) {
      try {
        if (session.multiParent) scheduleMultiParentEcosystem(session.parents, seeds);
        else scheduleArtistEcosystem(session.source, seeds);
      } catch (eEco) {}
    }
    try {
      prepareAutoplay();
    } catch (ePrep) {}
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
    if (removed && window.SDMusicSessionSignals && typeof window.SDMusicSessionSignals.onRemove === "function") {
      try {
        window.SDMusicSessionSignals.onRemove(session, removed);
      } catch (e) {}
    }
    // Drop any queued dupes of the removed id (Up Next / Autoplay / Play Next).
    if (removed) {
      var rid = trackId(removed);
      if (rid) {
        ["playNext", "upNext", "autoplay"].forEach(function (key) {
          session[key] = (session[key] || []).filter(function (t) {
            return trackId(t) !== rid;
          });
        });
      }
    }
    emit();
    // Soft top-up so suppress + ring steer take effect without blocking UI on force-refill.
    if (session.autoplayEnabled) {
      try {
        prepareAutoplay();
      } catch (ePrep) {}
    }
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
    try {
      if (window.SDMusicSessionSignals) {
        window.SDMusicSessionSignals.ensure(session);
        window.SDMusicSessionSignals.markSessionPlayed(session.ringSteer, track);
      }
    } catch (e) {}
  }

  /** Capture dwell/skip signal for the track leaving Now Playing. */
  function signalLeavingNow(opts) {
    opts = opts || {};
    if (!session.now) return;
    var track = session.now;
    var sec = null;
    var dur = null;
    try {
      var a = window.StepDaddyMusicPlayer && window.StepDaddyMusicPlayer._instance && window.StepDaddyMusicPlayer._instance.audio;
      if (a) {
        if (isFinite(a.currentTime)) sec = a.currentTime;
        if (isFinite(a.duration) && a.duration > 0) dur = a.duration;
      }
    } catch (e) {}
    if (sec == null && isFinite(session.positionSec)) sec = session.positionSec;
    try {
      if (window.SDMusicSessionSignals && typeof window.SDMusicSessionSignals.onDwell === "function") {
        window.SDMusicSessionSignals.onDwell(session, track, {
          seconds: sec,
          duration: dur,
          completed: !!opts.completed,
          skipped: !!opts.skipped,
        });
      }
    } catch (e2) {}
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
      // Realtime ring steer from skip vs complete before history push.
      signalLeavingNow({ completed: fromEnded && !opts.skipped, skipped: !fromEnded || !!opts.skipped });
      if (session.now) pushHistory(session.now);
      session.now = track;
      session.layer = layer;
      session.positionSec = 0;
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

    signalLeavingNow({ completed: fromEnded, skipped: !fromEnded });
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

  var _uqAp = null;
  function uqAp() {
    if (_uqAp) return _uqAp;
    var api = window.SDMusicUQAutoplay;
    if (!api || typeof api.bind !== "function") {
      _uqAp = {
        prepareAutoplay: function () {
          return Promise.resolve(session.autoplay || []);
        },
        appendAutoplay: function () {},
      };
      return _uqAp;
    }
    _uqAp = api.bind({
      trackId: trackId,
      cloneTrack: cloneTrack,
      getSession: function () {
        return session;
      },
      emit: emit,
      recentIds: recentIds,
      MAX_AUTOPLAY: MAX_AUTOPLAY,
      AUTOPLAY_PREP_MS: AUTOPLAY_PREP_MS,
      inflightRef: {
        get inflight() {
          return autoplayInflight;
        },
        set inflight(v) {
          autoplayInflight = v;
        },
        get at() {
          return autoplayInflightAt;
        },
        set at(v) {
          autoplayInflightAt = v;
        },
        get gen() {
          return autoplayPrepGen;
        },
        set gen(v) {
          autoplayPrepGen = v;
        },
      },
    });
    return _uqAp;
  }

  function prepareAutoplay(opts) {
    return uqAp().prepareAutoplay(opts);
  }

  function appendAutoplay(tracks) {
    return uqAp().appendAutoplay(tracks);
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
      parents: (session.parents || []).slice(),
      multiParent: !!session.multiParent,
      shuffle: session.shuffle,
      repeat: session.repeat,
      autoplayEnabled: session.autoplayEnabled,
      layer: session.layer,
      positionSec: session.positionSec,
      peekNext: peekNextTrack(),
      ringSteer: window.SDMusicSessionSignals
        ? window.SDMusicSessionSignals.snapshot(session)
        : null,
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
    scheduleMultiParentEcosystem: scheduleMultiParentEcosystem,
    buildParentsFromTracks: buildParentsFromTracks,
    isMixedSurface: isMixedSurface,
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
    signalLike: function (track, liked) {
      if (window.SDMusicSessionSignals && typeof window.SDMusicSessionSignals.onLike === "function") {
        window.SDMusicSessionSignals.onLike(session, track, liked);
        emit();
        if (session.autoplayEnabled) {
          try {
            prepareAutoplay();
          } catch (e) {}
        }
      }
    },
    ringSteerSnapshot: function () {
      return window.SDMusicSessionSignals ? window.SDMusicSessionSignals.snapshot(session) : null;
    },
  };
})();
