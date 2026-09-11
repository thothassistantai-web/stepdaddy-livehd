/**
 * Session signals: realtime ring-steer + anti-repeat suppress lists.
 * Like / unlike / skip-vs-dwell / queue-remove update which Autoplay ring
 * expands next and which ids/artists stay suppressed this session.
 * API: window.SDMusicSessionSignals
 */
(function () {
  if (window.SDMusicSessionSignals) return;

  var SUPPRESS_TRACKS = 12; // don't re-suggest for ~N upcoming slots
  var SUPPRESS_MS = 18 * 60 * 1000; // or ~18 min
  var RECENT_TASTE_N = 18;
  var SHORT_SKIP_SEC = 22;
  var SHORT_SKIP_FRAC = 0.28;
  var LONG_DWELL_FRAC = 0.72;

  function now() {
    return Date.now();
  }

  function trackId(t) {
    if (!t) return "";
    return String(t.videoId || t.id || t.stationuuid || "");
  }

  function artistKey(t) {
    if (!t) return "";
    var name =
      (t.artists && t.artists[0]) ||
      t.artist ||
      t.subtitle ||
      t._parentArtist ||
      "";
    return String(name || "")
      .split(",")[0]
      .trim()
      .toLowerCase()
      .slice(0, 80);
  }

  function ringOf(t) {
    var r = t && (t._ring != null ? t._ring : t.ring);
    r = parseInt(r, 10);
    return isFinite(r) && r >= 1 && r <= 10 ? r : 0;
  }

  function emptySteer() {
    return {
      v: 1,
      preferRing: 5,
      stayBias: 0, // >0 stay/widen preferred ring; <0 jump outward faster
      ringScores: {}, // ringId -> float
      parentBoosts: {}, // artistKey -> float
      parentSuppress: {}, // artistKey -> { until, n }
      suppressIds: {}, // id -> { until, n, reason }
      sessionPlayed: {}, // id -> 1 (history blocklist)
      signalLog: [], // last few for field debug
      updatedAt: 0,
    };
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function ensure(session) {
    if (!session) return emptySteer();
    if (!session.ringSteer || session.ringSteer.v !== 1) {
      session.ringSteer = emptySteer();
    }
    return session.ringSteer;
  }

  function pruneSuppress(map) {
    var t = now();
    Object.keys(map || {}).forEach(function (k) {
      var e = map[k];
      if (!e) {
        delete map[k];
        return;
      }
      if (e.until && e.until < t && (e.n == null || e.n <= 0)) delete map[k];
    });
  }

  function bumpSuppress(steer, id, reason, tracks, ms) {
    if (!id) return;
    tracks = tracks == null ? SUPPRESS_TRACKS : tracks;
    ms = ms == null ? SUPPRESS_MS : ms;
    var prev = steer.suppressIds[id] || {};
    steer.suppressIds[id] = {
      until: Math.max(prev.until || 0, now() + ms),
      n: Math.max(prev.n || 0, tracks),
      reason: reason || prev.reason || "suppress",
    };
  }

  function tickSuppressOnAdvance(steer) {
    Object.keys(steer.suppressIds || {}).forEach(function (id) {
      var e = steer.suppressIds[id];
      if (!e) return;
      if (e.n != null) e.n = Math.max(0, (e.n || 0) - 1);
      if ((e.n || 0) <= 0 && (!e.until || e.until < now())) delete steer.suppressIds[id];
    });
    Object.keys(steer.parentSuppress || {}).forEach(function (k) {
      var e = steer.parentSuppress[k];
      if (!e) return;
      if (e.n != null) e.n = Math.max(0, (e.n || 0) - 1);
      if ((e.n || 0) <= 0 && (!e.until || e.until < now())) delete steer.parentSuppress[k];
    });
  }

  function log(steer, kind, detail) {
    steer.signalLog = [{ ts: now(), kind: kind, detail: detail || {} }]
      .concat(steer.signalLog || [])
      .slice(0, 24);
    steer.updatedAt = now();
  }

  function bumpRing(steer, ring, delta) {
    if (!ring) return;
    var k = String(ring);
    steer.ringScores[k] = (steer.ringScores[k] || 0) + delta;
    // Prefer the ring that just got positive signal; outward nudge on negatives.
    if (delta > 0) {
      steer.preferRing = clamp(ring, 2, 9);
      steer.stayBias = clamp((steer.stayBias || 0) + delta * 0.55, -6, 8);
    } else {
      steer.stayBias = clamp((steer.stayBias || 0) + delta * 0.45, -6, 8);
      if (delta <= -1.2) {
        steer.preferRing = clamp(Math.max(steer.preferRing || 5, ring) + 1, 2, 10);
      }
    }
  }

  function bumpParent(steer, key, delta) {
    if (!key) return;
    steer.parentBoosts[key] = clamp((steer.parentBoosts[key] || 0) + delta, -8, 10);
    if (delta < -1) {
      var prev = steer.parentSuppress[key] || {};
      steer.parentSuppress[key] = {
        until: Math.max(prev.until || 0, now() + SUPPRESS_MS),
        n: Math.max(prev.n || 0, Math.ceil(SUPPRESS_TRACKS * 0.6)),
      };
    }
  }

  function markSessionPlayed(steer, t) {
    var id = trackId(t);
    if (id) steer.sessionPlayed[id] = 1;
  }

  /** Like / unlike mid-session → stay/widen into that track's ring + parent. */
  function onLike(session, track, liked) {
    var steer = ensure(session);
    var ring = ringOf(track) || steer.preferRing || 5;
    var art = artistKey(track);
    if (liked) {
      bumpRing(steer, ring, 2.4);
      bumpParent(steer, art, 2.0);
      // Liked related-artist material → linger around related (7) / collaborators (6).
      if (ring >= 6 && ring <= 8) {
        steer.preferRing = ring;
        steer.stayBias = clamp((steer.stayBias || 0) + 1.8, -6, 8);
      }
      log(steer, "like", { id: trackId(track), ring: ring, artist: art });
    } else {
      bumpRing(steer, ring, -1.6);
      bumpParent(steer, art, -1.4);
      bumpSuppress(steer, trackId(track), "unlike", 8, SUPPRESS_MS * 0.6);
      log(steer, "unlike", { id: trackId(track), ring: ring, artist: art });
    }
    return steer;
  }

  /**
   * Skip vs play duration.
   * short skip → negative ring/artist, outward faster
   * long complete / high dwell → positive toward that ring/artist
   */
  function onDwell(session, track, opts) {
    opts = opts || {};
    var steer = ensure(session);
    var id = trackId(track);
    var ring = ringOf(track) || steer.preferRing || 5;
    var art = artistKey(track);
    var sec = Number(opts.seconds);
    var dur = Number(opts.duration);
    var frac = Number(opts.frac);
    if (!isFinite(frac) || frac < 0) {
      if (isFinite(sec) && isFinite(dur) && dur > 0) frac = sec / dur;
      else if (isFinite(sec) && sec > 0) frac = sec > 90 ? 1 : sec / 90;
      else frac = NaN;
    }
    if (!isFinite(sec)) sec = isFinite(dur) && isFinite(frac) ? frac * dur : NaN;

    markSessionPlayed(steer, track);
    tickSuppressOnAdvance(steer);

    var hasListenEvidence =
      (isFinite(sec) && sec > 0) || (isFinite(dur) && dur > 0 && isFinite(frac)) || !!opts.completed;
    var short =
      hasListenEvidence &&
      ((isFinite(sec) && sec > 0 && sec < SHORT_SKIP_SEC) || (isFinite(frac) && frac < SHORT_SKIP_FRAC));
    var longOk =
      !!opts.completed ||
      (isFinite(frac) && frac >= LONG_DWELL_FRAC) ||
      (isFinite(sec) && sec >= 90);

    if (opts.skipped || (short && !opts.completed)) {
      bumpRing(steer, ring, -2.0);
      bumpParent(steer, art, -1.8);
      bumpSuppress(steer, id, "short-skip", 10, SUPPRESS_MS);
      // Hard skip → prefer different parent / move outward faster.
      steer.preferRing = clamp((steer.preferRing || 5) + 1, 3, 10);
      steer.stayBias = clamp((steer.stayBias || 0) - 1.6, -6, 8);
      log(steer, "short-skip", { id: id, ring: ring, artist: art, sec: sec, frac: frac });
    } else if (longOk) {
      bumpRing(steer, ring, 1.6);
      bumpParent(steer, art, 1.4);
      if (ring >= 2 && ring <= 8) {
        steer.preferRing = ring;
        steer.stayBias = clamp((steer.stayBias || 0) + 1.1, -6, 8);
      }
      log(steer, "long-dwell", { id: id, ring: ring, artist: art, sec: sec, frac: frac });
    } else if (hasListenEvidence) {
      // Mild mid-listen abandon — soft outward, light suppress.
      bumpRing(steer, ring, -0.6);
      bumpParent(steer, art, -0.4);
      bumpSuppress(steer, id, "mid-skip", 6, SUPPRESS_MS * 0.5);
      log(steer, "mid-dwell", { id: id, ring: ring, artist: art, sec: sec, frac: frac });
    } else {
      // No audio position (programmatic advance / pre-buffer) — mark played only.
      log(steer, "advance", { id: id, ring: ring, artist: art });
    }
    return steer;
  }

  /** Queue remove → suppress id + mild artist down-rank; don't immediately re-suggest. */
  function onRemove(session, track) {
    var steer = ensure(session);
    var id = trackId(track);
    var art = artistKey(track);
    var ring = ringOf(track);
    bumpSuppress(steer, id, "queue-remove", SUPPRESS_TRACKS, SUPPRESS_MS);
    bumpParent(steer, art, -1.2);
    if (ring) bumpRing(steer, ring, -0.5);
    log(steer, "queue-remove", { id: id, ring: ring, artist: art });
    return steer;
  }

  function isSuppressed(steer, id) {
    if (!id || !steer) return false;
    pruneSuppress(steer.suppressIds);
    var e = steer.suppressIds[id];
    if (!e) return false;
    if ((e.n || 0) > 0) return true;
    if (e.until && e.until > now()) return true;
    return false;
  }

  function isSessionPlayed(steer, id) {
    return !!(steer && id && steer.sessionPlayed && steer.sessionPlayed[id]);
  }

  function parentWeight(steer, artistName, base) {
    var key = String(artistName || "")
      .split(",")[0]
      .trim()
      .toLowerCase()
      .slice(0, 80);
    var w = base == null ? 1 : Number(base) || 1;
    if (!steer || !key) return w;
    pruneSuppress(steer.parentSuppress);
    var sup = steer.parentSuppress[key];
    if (sup && ((sup.n || 0) > 0 || (sup.until && sup.until > now()))) {
      w *= 0.15;
    }
    w += (steer.parentBoosts[key] || 0) * 0.35;
    return w;
  }

  /**
   * How refill should walk rings given steer state.
   * stayBias>0 → expand softCap around preferRing; stayBias<0 → shrink early softCaps / jump outward.
   */
  function refillPlan(steer) {
    steer = steer || emptySteer();
    var prefer = clamp(steer.preferRing || 5, 2, 10);
    var bias = steer.stayBias || 0;
    var softCapMul = {};
    for (var r = 2; r <= 10; r++) softCapMul[r] = 1;
    if (bias >= 0.8) {
      softCapMul[prefer] = 1.85;
      if (prefer > 2) softCapMul[prefer - 1] = 1.25;
      if (prefer < 10) softCapMul[prefer + 1] = 1.35;
      // Don't overfill rings far from prefer when staying.
      for (var i = 2; i <= 10; i++) {
        if (Math.abs(i - prefer) >= 3) softCapMul[i] *= 0.55;
      }
    } else if (bias <= -0.8) {
      // Move outward faster: starve early rings, feed outer.
      for (var j = 2; j < prefer; j++) softCapMul[j] *= 0.35;
      softCapMul[prefer] = 1.2;
      softCapMul[Math.min(10, prefer + 1)] = 1.5;
      softCapMul[10] = 1.35;
    }
    // Ring score nudges
    Object.keys(steer.ringScores || {}).forEach(function (k) {
      var id = parseInt(k, 10);
      var s = steer.ringScores[k] || 0;
      if (!id || !softCapMul[id]) return;
      softCapMul[id] *= clamp(1 + s * 0.08, 0.25, 2.4);
    });
    return {
      preferRing: prefer,
      stayBias: bias,
      softCapMul: softCapMul,
      minStartRing: bias <= -1.5 ? clamp(prefer, 4, 8) : 1,
      targetBoost: bias >= 1 ? 6 : 0,
    };
  }

  /**
   * Build exclude / avoid id map for Autoplay + Up Next + Smart Shuffle.
   * opts.allowSessionReplay: only ring-10 exhausted path may set true.
   */
  function buildExcludeMap(session, opts) {
    opts = opts || {};
    var ids = Object.create(null);
    var steer = ensure(session);
    pruneSuppress(steer.suppressIds);

    function add(id, why) {
      if (!id) return;
      ids[id] = why || 1;
    }

    // Full session history blocklist (unless forced at ring 10).
    if (!opts.allowSessionReplay) {
      Object.keys(steer.sessionPlayed || {}).forEach(function (id) {
        add(id, "session");
      });
      (session.history || []).forEach(function (t) {
        add(trackId(t), "history");
      });
    }

    if (session.now) add(trackId(session.now), "now");
    (session.playNext || []).forEach(function (t) {
      add(trackId(t), "playNext");
    });
    (session.upNext || []).forEach(function (t) {
      add(trackId(t), "upNext");
    });
    (session.autoplay || []).forEach(function (t) {
      add(trackId(t), "autoplay");
    });

    Object.keys(steer.suppressIds || {}).forEach(function (id) {
      if (isSuppressed(steer, id)) add(id, "suppress");
    });

    // Taste recent window (N tracks / time) — suppress unless forced.
    if (!opts.allowSessionReplay && window.SDMusicTaste && typeof window.SDMusicTaste.getRecent === "function") {
      try {
        var recent = window.SDMusicTaste.getRecent(RECENT_TASTE_N) || [];
        var cutoff = now() - SUPPRESS_MS;
        recent.forEach(function (r, i) {
          var id = trackId(r) || (r && (r.id || r.videoId));
          if (!id) return;
          var ts = (r && r.ts) || 0;
          if (i < RECENT_TASTE_N || (ts && ts > cutoff)) add(String(id), "taste-recent");
        });
      } catch (e) {}
    }

    return ids;
  }

  function avoidKeysList(excludeMap) {
    return Object.keys(excludeMap || {});
  }

  function snapshot(session) {
    var steer = ensure(session);
    var plan = refillPlan(steer);
    return {
      preferRing: plan.preferRing,
      stayBias: plan.stayBias,
      ringScores: Object.assign({}, steer.ringScores),
      parentBoosts: Object.assign({}, steer.parentBoosts),
      suppressN: Object.keys(steer.suppressIds || {}).length,
      sessionPlayedN: Object.keys(steer.sessionPlayed || {}).length,
      lastSignals: (steer.signalLog || []).slice(0, 6),
    };
  }

  // Sync sessionPlayed from existing history on restore
  function hydrateFromSession(session) {
    var steer = ensure(session);
    (session.history || []).forEach(function (t) {
      markSessionPlayed(steer, t);
    });
    if (session.now) markSessionPlayed(steer, session.now);
    return steer;
  }

  window.SDMusicSessionSignals = {
    emptySteer: emptySteer,
    ensure: ensure,
    onLike: onLike,
    onDwell: onDwell,
    onRemove: onRemove,
    markSessionPlayed: markSessionPlayed,
    isSuppressed: isSuppressed,
    isSessionPlayed: isSessionPlayed,
    parentWeight: parentWeight,
    refillPlan: refillPlan,
    buildExcludeMap: buildExcludeMap,
    avoidKeysList: avoidKeysList,
    snapshot: snapshot,
    hydrateFromSession: hydrateFromSession,
    trackId: trackId,
    artistKey: artistKey,
    ringOf: ringOf,
  };
})();
