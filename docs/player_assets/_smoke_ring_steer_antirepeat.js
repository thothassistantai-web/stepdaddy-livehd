/**
 * Unit smoke: realtime ring steer + anti-repeat + smart shuffle predictive.
 * Run: node player_assets/_smoke_ring_steer_antirepeat.js
 */
(function () {
  var store = {};
  global.localStorage = {
    getItem: function (k) {
      return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null;
    },
    setItem: function (k, v) {
      store[k] = String(v);
    },
    removeItem: function (k) {
      delete store[k];
    },
  };
  global.window = global;

  require("./music_taste.js");
  require("./music_session_signals.js");
  var T = global.SDMusicTaste;
  var S = global.SDMusicSessionSignals;
  if (!T || !S) {
    console.error("FAIL: modules missing");
    process.exit(1);
  }

  function ids(list) {
    return (list || []).map(function (t) {
      return t.videoId || t.id;
    });
  }

  var report = { ok: true, tests: {} };

  // --- Ring steer: like related → prefer ring 7 / stayBias up ---
  var session = {
    history: [],
    now: null,
    playNext: [],
    upNext: [],
    autoplay: [],
    parents: [{ artistName: "Drake", weight: 2 }],
    multiParent: true,
    ringSteer: S.emptySteer(),
  };
  S.onLike(session, { videoId: "rel1", title: "Related Hit", artists: ["Future"], _ring: 7, _ringSource: "related" }, true);
  var snap1 = S.snapshot(session);
  report.tests.like_related = {
    preferRing: snap1.preferRing,
    stayBias: snap1.stayBias,
    ok: snap1.preferRing === 7 && snap1.stayBias > 0,
  };
  if (!report.tests.like_related.ok) {
    console.error("FAIL like_related", snap1);
    process.exit(1);
  }

  // Short skip → outward + suppress
  S.onDwell(
    session,
    { videoId: "skip1", title: "Skip Me", artists: ["Cold Artist"], _ring: 5 },
    { seconds: 8, duration: 200, skipped: true }
  );
  var snap2 = S.snapshot(session);
  var planOut = S.refillPlan(session.ringSteer);
  report.tests.short_skip = {
    preferRing: snap2.preferRing,
    stayBias: snap2.stayBias,
    suppressN: snap2.suppressN,
    minStartRing: planOut.minStartRing,
    ok: snap2.stayBias < snap1.stayBias && snap2.suppressN >= 1 && S.isSuppressed(session.ringSteer, "skip1"),
  };
  if (!report.tests.short_skip.ok) {
    console.error("FAIL short_skip", report.tests.short_skip, snap2);
    process.exit(1);
  }

  // Long dwell → positive
  var biasBefore = session.ringSteer.stayBias;
  S.onDwell(
    session,
    { videoId: "long1", title: "Full Play", artists: ["Kendrick Lamar"], _ring: 7, genre: "hip-hop" },
    { seconds: 180, duration: 200, completed: true }
  );
  report.tests.long_dwell = {
    stayBias: session.ringSteer.stayBias,
    preferRing: session.ringSteer.preferRing,
    ok: session.ringSteer.stayBias > biasBefore && session.ringSteer.preferRing === 7,
  };
  if (!report.tests.long_dwell.ok) {
    console.error("FAIL long_dwell", report.tests.long_dwell);
    process.exit(1);
  }

  // Queue remove → suppress
  S.onRemove(session, { videoId: "rm1", title: "Remove Me", artists: ["No Thanks"], _ring: 8 });
  report.tests.queue_remove = {
    suppressed: S.isSuppressed(session.ringSteer, "rm1"),
    ok: S.isSuppressed(session.ringSteer, "rm1"),
  };
  if (!report.tests.queue_remove.ok) {
    console.error("FAIL queue_remove");
    process.exit(1);
  }

  // Anti-repeat: history + suppress in exclude map
  session.history = [
    { videoId: "h1", title: "Hist 1" },
    { videoId: "h2", title: "Hist 2" },
  ];
  session.now = { videoId: "now1", title: "Now" };
  session.autoplay = [{ videoId: "ap1", title: "AP" }];
  S.hydrateFromSession(session);
  var ex = S.buildExcludeMap(session, { allowSessionReplay: false });
  report.tests.antirepeat = {
    has_h1: !!ex.h1,
    has_rm1: !!ex.rm1,
    has_now: !!ex.now1,
    has_ap: !!ex.ap1,
    ok: !!(ex.h1 && ex.rm1 && ex.now1 && ex.ap1),
  };
  if (!report.tests.antirepeat.ok) {
    console.error("FAIL antirepeat", ex);
    process.exit(1);
  }

  // Ring-10 forced replay may omit sessionPlayed from exclude
  var ex10 = S.buildExcludeMap(session, { allowSessionReplay: true });
  report.tests.ring10_replay = {
    h1_still_in_history_path: !!ex10.h1, // history still listed via session.history loop when allowSessionReplay — actually looking at code: when allowSessionReplay, sessionPlayed and history are NOT added. So h1 should be absent unless in queues.
    h1_absent: !ex10.h1,
    now_still: !!ex10.now1,
    ok: !ex10.h1 && !!ex10.now1,
  };
  if (!report.tests.ring10_replay.ok) {
    console.error("FAIL ring10_replay", ex10);
    process.exit(1);
  }

  // Smart Shuffle predictive vs plain order with hip-hop likes (j-test pattern)
  store = {};
  [
    { videoId: "FrsOnNxIrg8", title: "God's Plan", artist: "Drake", genre: "hip-hop" },
    { videoId: "H4RELGc9su8", title: "HUMBLE.", artist: "Kendrick Lamar", genre: "hip-hop" },
    { videoId: "NQbkGDoD7B0", title: "SICKO MODE", artist: "Travis Scott", genre: "hip-hop" },
    { videoId: "thk1vwD2p3Y", title: "Dior (Bonus)", artist: "Pop Smoke", genre: "hip-hop" },
  ].forEach(function (t) {
    T.recordLike(t, true);
    T.recordPlay(t);
    T.recordComplete(t);
  });
  T.recordEntry("search");

  var pool = [
    { videoId: "cold1", title: "Fogerty", artist: "John Fogerty", genre: "rock", year: "1970", popularity: 0.4 },
    { videoId: "alb_k2", title: "Album filler", artist: "Unknown", genre: "pop", year: "2020", popularity: 0.5 },
    { videoId: "FrsOnNxIrg8", title: "God's Plan", artist: "Drake", genre: "hip-hop", year: "2018", popularity: 0.9 },
    { videoId: "H4RELGc9su8", title: "HUMBLE.", artist: "Kendrick Lamar", genre: "hip-hop", year: "2017", popularity: 0.95 },
    { videoId: "probe_fog", title: "Centerfield", artist: "John Fogerty", genre: "rock", year: "1985", popularity: 0.6 },
    { videoId: "NQbkGDoD7B0", title: "SICKO MODE", artist: "Travis Scott", genre: "hip-hop", year: "2018", popularity: 0.92 },
    { videoId: "alb_cold1", title: "Cold", artist: "Nobody", genre: "ambient", year: "2024", popularity: 0.2 },
  ];
  var off = pool.slice();
  var smart = T.rankItems(pool.slice(), {
    smartShuffle: true,
    seedItems: [{ videoId: "seed", artist: "Drake", genre: "hip-hop", year: "2018" }],
    entryPath: "search",
    parents: [{ artistName: "Drake", weight: 2 }, { artistName: "Kendrick Lamar", weight: 1.5 }],
    multiParent: true,
  });
  var smartIds = ids(smart);
  var hiphopTop = smartIds.slice(0, 3).filter(function (id) {
    return id === "FrsOnNxIrg8" || id === "H4RELGc9su8" || id === "NQbkGDoD7B0";
  }).length;
  report.tests.smart_shuffle = {
    smart: smartIds,
    off: ids(off),
    differs: smartIds.join() !== ids(off).join(),
    hiphop_in_top3: hiphopTop,
    ok: smartIds.join() !== ids(off).join() && hiphopTop >= 2,
  };
  if (!report.tests.smart_shuffle.ok) {
    console.error("FAIL smart_shuffle", report.tests.smart_shuffle);
    process.exit(1);
  }

  // Stay plan softCapMul for prefer ring
  session.ringSteer.preferRing = 7;
  session.ringSteer.stayBias = 3;
  var planStay = S.refillPlan(session.ringSteer);
  report.tests.refill_plan_stay = {
    preferRing: planStay.preferRing,
    mul7: planStay.softCapMul[7],
    mul3: planStay.softCapMul[3],
    ok: planStay.softCapMul[7] > 1.2 && planStay.softCapMul[3] < 1,
  };
  if (!report.tests.refill_plan_stay.ok) {
    console.error("FAIL refill_plan_stay", planStay);
    process.exit(1);
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
})();
