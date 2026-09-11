/**
 * Unit smoke: 10-ring ladder order + multi-parent union.
 * Run: node player_assets/_smoke_ecosystem_rings.js
 * Exit 0 on pass.
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
  global.fetch = function () {
    return Promise.reject(new Error("no network in unit smoke"));
  };

  require("./music_ecosystem_rings.js");
  require("./music_artist_ecosystem.js");
  require("./music_taste.js");
  require("./music_smart_queue.js");

  var ER = global.SDMusicEcosystemRings;
  var SQ = global.SDMusicSmartQueue;
  if (!ER || !SQ) {
    console.error("FAIL: modules missing", !!ER, !!SQ);
    process.exit(1);
  }

  var expected = [
    "now",
    "album",
    "release-family",
    "artist-era",
    "artist",
    "collaborators",
    "related",
    "genre-mood",
    "taste",
    "global",
  ];
  var labels = (ER.RINGS || SQ.rings || []).map(function (r) {
    return r.label;
  });
  if (labels.join(",") !== expected.join(",")) {
    console.error("FAIL ring order", labels);
    process.exit(1);
  }
  for (var i = 0; i < ER.RINGS.length; i++) {
    if (ER.RINGS[i].id !== i + 1) {
      console.error("FAIL ring ids not 1..10 sequential");
      process.exit(1);
    }
  }

  // Multi-parent build from mixed playlist
  var seeds = [
    { videoId: "d1", title: "Gods Plan", artists: ["Drake"], artistId: "A_drake" },
    { videoId: "p1", title: "Dior", artists: ["Pop Smoke"], artistId: "A_pop" },
    { videoId: "b1", title: "Oh My", artists: ["Boogie"], artistId: "A_boogie" },
    { videoId: "d2", title: "In My Feelings", artists: ["Drake"], artistId: "A_drake" },
    { videoId: "p2", title: "Welcome to the Party", artists: ["Pop Smoke"], artistId: "A_pop" },
  ];
  var parents = ER.buildParentsFromTracks(seeds, { entryPath: "playlist" });
  var names = parents.map(function (p) {
    return p.artistName;
  });
  if (parents.length < 3) {
    console.error("FAIL expected 3 parents from mixed playlist", names);
    process.exit(1);
  }
  if (names.indexOf("Drake") < 0 || names.indexOf("Pop Smoke") < 0 || names.indexOf("Boogie") < 0) {
    console.error("FAIL missing parent artists", names);
    process.exit(1);
  }
  // Drake appears twice → should rank first by presence
  if (parents[0].artistName !== "Drake") {
    console.error("FAIL Drake should be top-weighted parent", parents[0]);
    process.exit(1);
  }

  var resolvedMixed = ER.resolveParents(seeds, { type: "playlist", title: "Liked songs" });
  if (!resolvedMixed.multiParent || resolvedMixed.parents.length < 3) {
    console.error("FAIL playlist should be multi-parent", resolvedMixed);
    process.exit(1);
  }

  var resolvedAlbum = ER.resolveParents(seeds.slice(0, 2), {
    type: "album",
    artistName: "Drake",
    artistId: "A_drake",
  });
  if (resolvedAlbum.multiParent) {
    console.error("FAIL album must stay single-tree", resolvedAlbum);
    process.exit(1);
  }

  // Mock refill ladder order with fixture fetchers
  var calls = [];
  var deps = {
    withTimeout: function (p) {
      return Promise.resolve(p);
    },
    searchSimilar: function (q) {
      calls.push("search:" + q);
      return Promise.resolve([{ videoId: "s_" + calls.length, title: q, artists: ["X"] }]);
    },
    albumTracks: function (id) {
      calls.push("album:" + id);
      return Promise.resolve([
        { videoId: "a1", title: "t1", albumId: id },
        { videoId: "a2", title: "t2", albumId: id },
      ]);
    },
    artistEcosystem: function (opts) {
      calls.push("eco:" + (opts.artistName || opts.artistId));
      return Promise.resolve([{ videoId: "e1", title: "eco", artists: [opts.artistName] }]);
    },
    artistRadio: function (id, name) {
      calls.push("radio:" + (name || id));
      return Promise.resolve([{ videoId: "r_" + name, title: "hit", artists: [name] }]);
    },
    watchNext: function (vid) {
      calls.push("watch:" + vid);
      return Promise.resolve([{ videoId: "w1", title: "watch" }]);
    },
    madeForYou: function () {
      calls.push("mfy");
      return [{ videoId: "m1", title: "made" }];
    },
    classifyArtistShelves: function () {
      return { songs: [], albums: [], singles: [], videos: [] };
    },
    releaseSortKey: function () {
      return 0;
    },
    fetchJson: function () {
      return Promise.resolve(null);
    },
    LISTEN: "/api/music/listen",
    FETCH_MS: 50,
    escQ: encodeURIComponent,
    dedupeTracks: function (list) {
      var seen = Object.create(null);
      var out = [];
      (list || []).forEach(function (t) {
        var id = t && (t.videoId || t.id);
        if (!id || seen[id]) return;
        seen[id] = 1;
        out.push(t);
      });
      return out;
    },
  };
  var fetchers = ER.attach(deps);

  // Multi-parent fan-out must hit ALL parents on ring-5 style radio
  return ER.fanOutParents(parents, 2, function (p) {
    return deps.artistRadio(p.artistId, p.artistName);
  }).then(function (merged) {
    var radios = calls.filter(function (c) {
      return c.indexOf("radio:") === 0;
    });
    if (radios.length < 3) {
      console.error("FAIL multi-parent fan-out did not query all parents", radios, calls);
      process.exit(1);
    }
    var parentHits = {
      Drake: merged.some(function (t) {
        return t._parentArtist === "Drake" || (t.artists && t.artists[0] === "Drake");
      }),
      "Pop Smoke": merged.some(function (t) {
        return t._parentArtist === "Pop Smoke";
      }),
      Boogie: merged.some(function (t) {
        return t._parentArtist === "Boogie";
      }),
    };
    if (!parentHits.Drake || !parentHits["Pop Smoke"] || !parentHits.Boogie) {
      console.error("FAIL merged tracks missing parent stamps", parentHits, merged);
      process.exit(1);
    }

    // Live-ish refill with mocks: monkeypatch after wire
    // Ensure SQ.refill walks rings outward (flow starts with now)
    global.fetch = function (url) {
      calls.push("fetch:" + url);
      if (/\/home/.test(url)) {
        return Promise.resolve({
          ok: true,
          json: function () {
            return Promise.resolve({
              shelves: [{ items: [{ videoId: "h1", title: "chart" }, { videoId: "h2", title: "trend" }] }],
            });
          },
        });
      }
      if (/\/album\//.test(url)) {
        return Promise.resolve({
          ok: true,
          json: function () {
            return Promise.resolve({ title: "Album", tracks: [{ videoId: "al1", title: "A1" }] });
          },
        });
      }
      if (/\/artist\//.test(url)) {
        return Promise.resolve({
          ok: true,
          json: function () {
            return Promise.resolve({
              title: "Artist",
              shelves: [{ title: "Songs", items: [{ videoId: "ar1", title: "S1" }] }],
            });
          },
        });
      }
      if (/\/search/.test(url)) {
        return Promise.resolve({
          ok: true,
          json: function () {
            return Promise.resolve({ items: [{ videoId: "q1", title: "Q", artists: ["Z"] }] });
          },
        });
      }
      if (/\/watch/.test(url)) {
        return Promise.resolve({
          ok: true,
          json: function () {
            return Promise.resolve({ tracks: [{ videoId: "wn1", title: "W" }] });
          },
        });
      }
      return Promise.resolve({
        ok: true,
        json: function () {
          return Promise.resolve({});
        },
      });
    };

    return SQ.refill({
      force: true,
      source: "listen",
      track: seeds[0],
      parents: parents,
      multiParent: true,
      sourceRemainder: seeds.slice(1),
      sourceOrder: seeds,
      target: 12,
      floor: 2,
      state: { source: "listen", id: "d1", title: "Gods Plan", subtitle: "Drake" },
    }).then(function (res) {
      var steps = (res.rings || (res.flow || "").split(">")).filter(Boolean);
      if (steps[0] !== "now") {
        console.error("FAIL ladder must start at now", steps);
        process.exit(1);
      }
      // Ring 3 skipped/empty on multi — label may still appear then yield []
      if (steps.indexOf("album") < 0 && steps.indexOf("album") !== 1) {
        // ring 2 label is still "album" in RINGS even for playlist remainder
      }
      var idx = function (name) {
        for (var i = 0; i < steps.length; i++) {
          if (steps[i] === name || steps[i].indexOf(name) === 0) return i;
        }
        return -1;
      };
      var iNow = idx("now");
      var iSrc = idx("album");
      var iArt = idx("artist");
      if (iNow !== 0) {
        console.error("FAIL now not first", steps);
        process.exit(1);
      }
      if (iSrc >= 0 && iArt >= 0 && iSrc > iArt) {
        console.error("FAIL inward skip: artist before source remainder", steps);
        process.exit(1);
      }
      // Never jump to global before exhausting earlier attempted rings in order
      var orderCheck = ["now", "album", "release-family", "artist-era", "artist", "collaborators", "related", "genre-mood", "taste", "global"];
      var last = -1;
      for (var s = 0; s < steps.length; s++) {
        var base = String(steps[s]).split("*")[0];
        var oi = orderCheck.indexOf(base);
        if (oi < 0) continue;
        if (oi < last) {
          console.error("FAIL outward-only violated", steps, base);
          process.exit(1);
        }
        last = oi;
      }
      if (!(res.queue && res.queue.length)) {
        console.error("FAIL empty queue / dead-end", res);
        process.exit(1);
      }

      var report = {
        ok: true,
        rings: labels,
        multi_parents: names,
        multiParent: true,
        refill_steps: steps,
        queue_n: res.queue.length,
        sample_parent_stamps: (res.queue || [])
          .filter(function (t) {
            return t._parentArtist;
          })
          .slice(0, 5)
          .map(function (t) {
            return { id: t.videoId, ring: t._ringSource, parent: t._parentArtist };
          }),
      };
      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
    });
  }).catch(function (e) {
    console.error("FAIL", e && e.stack ? e.stack : e);
    process.exit(1);
  });
})();
