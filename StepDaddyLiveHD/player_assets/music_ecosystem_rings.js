/**
 * Music Autoplay — 10-ring ecosystem + multi-parent helpers.
 * Single-tree (album/artist) and multi-parent (playlist/likes/mixed) ladders.
 * API: window.SDMusicEcosystemRings
 */
(function () {
  if (window.SDMusicEcosystemRings) return;

  var RING_TARGET = 28;
  var RING_FLOOR = 4;

  function trackId(t) {
    return t && (t.videoId || t.id || t.stationuuid) ? String(t.videoId || t.id || t.stationuuid) : "";
  }

  /** 10-ring ladder: id, short label (queue UI), softCap per ring. */
  var ECOSYSTEM_RINGS = [
    { id: 1, label: "now", softCap: 0 },
    { id: 2, label: "album", softCap: 8 },
    { id: 3, label: "release-family", softCap: 6 },
    { id: 4, label: "artist-era", softCap: 8 },
    { id: 5, label: "artist", softCap: 10 },
    { id: 6, label: "collaborators", softCap: 8 },
    { id: 7, label: "related", softCap: 10 },
    { id: 8, label: "genre-mood", softCap: 10 },
    { id: 9, label: "taste", softCap: 10 },
    { id: 10, label: "global", softCap: 24 },
  ];
  function stampRing(tracks, ringId, label, parentArtist) {
    var lid = label || (ECOSYSTEM_RINGS[ringId - 1] && ECOSYSTEM_RINGS[ringId - 1].label) || String(ringId);
    return (tracks || []).map(function (t) {
      if (!t || typeof t !== "object") return t;
      var o = Object.assign({}, t);
      o._ring = ringId;
      o._ringSource = lid;
      if (parentArtist) o._parentArtist = parentArtist;
      return o;
    });
  }

  function mergeParentGroups(groups, limit) {
    var out = [];
    var seen = Object.create(null);
    var maxLen = 0;
    (groups || []).forEach(function (g) {
      if ((g || []).length > maxLen) maxLen = g.length;
    });
    for (var i = 0; i < maxLen && out.length < (limit || 40); i++) {
      (groups || []).forEach(function (g) {
        if (out.length >= (limit || 40)) return;
        var t = g && g[i];
        if (!t) return;
        var id = trackId(t);
        if (!id || seen[id]) return;
        seen[id] = 1;
        out.push(t);
      });
    }
    return out;
  }

  function normalizeParents(list, fallbackArtistId, fallbackArtistName) {
    var out = [];
    var seen = Object.create(null);
    (list || []).forEach(function (p) {
      if (!p) return;
      var name = String(p.artistName || p.name || "").trim();
      var id = String(p.artistId || p.id || "").trim();
      if (!name && !id) return;
      var key = (id || name).toLowerCase();
      if (seen[key]) return;
      seen[key] = 1;
      out.push({
        artistId: id,
        artistName: name,
        weight: p.weight || p.count || 1,
        year: p.year || 0,
        genres: p.genres || [],
      });
    });
    if (!out.length && (fallbackArtistId || fallbackArtistName)) {
      out.push({
        artistId: fallbackArtistId || "",
        artistName: fallbackArtistName || "",
        weight: 1,
        year: 0,
        genres: [],
      });
    }
    out.sort(function (a, b) {
      return (b.weight || 0) - (a.weight || 0);
    });
    return out.slice(0, 8);
  }

  /** Fan-out a ring runner across all parents; round-robin merge; stamp parent. */
  function fanOutParents(parents, perParent, mapper) {
    parents = parents || [];
    if (!parents.length) return Promise.resolve([]);
    return Promise.all(
      parents.map(function (p) {
        return Promise.resolve()
          .then(function () {
            return mapper(p);
          })
          .then(function (tracks) {
            return (tracks || []).map(function (t) {
              if (!t || typeof t !== "object") return t;
              var o = Object.assign({}, t);
              o._parentArtist = p.artistName || o._parentArtist || "";
              return o;
            });
          })
          .catch(function () {
            return [];
          });
      })
    ).then(function (groups) {
      return mergeParentGroups(groups, perParent * Math.max(1, parents.length));
    });
  }

  function seedYearOf(track, state) {
    var y = parseInt(
      (track && (track.year || track.albumYear)) ||
        (state && state.year) ||
        0,
      10
    );
    return isFinite(y) && y > 1900 ? y : 0;
  }

  function parseCollaborators(track) {
    var out = [];
    var seen = Object.create(null);
    function add(name) {
      name = String(name || "")
        .replace(/\s+/g, " ")
        .replace(/^[&,]+|[&,]+$/g, "")
        .trim();
      if (!name || name.length < 2) return;
      var k = name.toLowerCase();
      if (seen[k]) return;
      seen[k] = 1;
      out.push(name);
    }
    var artists = (track && track.artists) || [];
    var primary = String((artists[0] || (track && track.subtitle) || "").split(",")[0] || "").trim();
    var pk = primary.toLowerCase();
    artists.forEach(function (a, i) {
      if (i === 0) return;
      String(a || "")
        .split(/,|&|\band\b/i)
        .forEach(add);
    });
    var title = String((track && track.title) || "");
    var m = title.match(/(?:feat\.?|ft\.?|featuring|with)\s+([^()[\]]+)/i);
    if (m && m[1]) {
      m[1].split(/,|&|\band\b/i).forEach(add);
    }
    return out.filter(function (n) {
      return n.toLowerCase() !== pk;
    });
  }


  function isMixedSurface(type) {
    var t = String(type || "").toLowerCase();
    if (t === "album" || t === "artist" || t === "directory" || t === "tracks-directory" || t === "videos-directory") {
      return false;
    }
    return (
      t === "playlist" ||
      t === "library" ||
      t === "liked" ||
      t === "home" ||
      t === "search" ||
      t === "shelf" ||
      t === "mixed" ||
      t === "focus" ||
      t === "listen" ||
      /playlist|liked|library|home|search|shelf/.test(t)
    );
  }

  /**
   * Build weighted parents from a full source track list (playlist / likes / mixed shelf).
   * Weight = presence count + light predictive taste boost when available.
   */
  function buildParentsFromTracks(tracks, opts) {
    opts = opts || {};
    var max = opts.max || 12;
    var map = Object.create(null);
    (tracks || []).forEach(function (t) {
      if (!t) return;
      var name = String(
        (t.artists && t.artists[0]) || t.artist || t.subtitle || ""
      )
        .split(",")[0]
        .trim();
      var id = String(t.artistId || (t.artistIds && t.artistIds[0]) || "").trim();
      if (!name && !id) return;
      var key = (id || name).toLowerCase();
      if (!map[key]) {
        map[key] = {
          artistId: id,
          artistName: name,
          weight: 0,
          count: 0,
          albumIds: [],
          genres: [],
        };
      }
      var p = map[key];
      p.count += 1;
      p.weight += 1;
      if (!p.artistName && name) p.artistName = name;
      if (!p.artistId && id) p.artistId = id;
      var albumId = t.albumId || "";
      if (albumId && p.albumIds.indexOf(albumId) < 0 && p.albumIds.length < 8) p.albumIds.push(albumId);
      var genre = t.genre || t.category || "";
      if (genre && p.genres.indexOf(genre) < 0 && p.genres.length < 4) p.genres.push(genre);
      var y = parseInt(t.year || t.albumYear || "0", 10);
      if (isFinite(y) && y > 1900) p.year = p.year || y;
    });
    var list = Object.keys(map).map(function (k) {
      return map[k];
    });
    try {
      if (window.SDMusicTaste && typeof window.SDMusicTaste.rankItems === "function") {
        list.forEach(function (p) {
          var probe = [{ videoId: "parent-" + (p.artistId || p.artistName), artists: [p.artistName], artist: p.artistName }];
          var ranked = window.SDMusicTaste.rankItems(probe, {
            softBoost: true,
            seedItems: opts.seedItems || [],
            entryPath: opts.entryPath || "playlist",
          });
          // Presence stays primary; taste nudges weight slightly.
          p.weight += Math.min(3, (p.count || 1) * 0.15);
          if (ranked && ranked[0] && ranked[0]._tasteScore) p.weight += Math.min(2, ranked[0]._tasteScore / 10);
        });
      }
    } catch (e) {}
    list.sort(function (a, b) {
      return b.weight - a.weight || b.count - a.count;
    });
    return list.slice(0, max);
  }

  function resolveParents(seeds, meta) {
    meta = meta || {};
    var surface = String(meta.type || meta.surface || "").toLowerCase();
    var built = buildParentsFromTracks(seeds, {
      entryPath: meta.entryPath || surface,
      seedItems: seeds.slice(0, 8),
    });
    var forceMixed = isMixedSurface(surface);
    var multi = forceMixed && built.length > 1;
    if (!built.length) {
      var fallbackName =
        meta.artistName ||
        (seeds[0] && ((seeds[0].artists && seeds[0].artists[0]) || seeds[0].subtitle)) ||
        "";
      var fallbackId = meta.artistId || (seeds[0] && seeds[0].artistId) || "";
      if (fallbackName || fallbackId) {
        built = [{ artistId: fallbackId, artistName: fallbackName, weight: 1, count: 1, albumIds: [], genres: [] }];
      }
    }
    if (!multi && built.length > 1 && (surface === "album" || surface === "artist")) {
      // Single-tree start: keep primary parent only.
      built = [built[0]];
    }
    return { parents: built, multiParent: !!(multi && built.length > 1), surface: surface };
  }

  function attach(deps) {
    deps = deps || {};
    var withTimeout = deps.withTimeout;
    var searchSimilar = deps.searchSimilar;
    var albumTracks = deps.albumTracks;
    var artistEcosystem = deps.artistEcosystem;
    var artistRadio = deps.artistRadio;
    var watchNext = deps.watchNext;
    var madeForYou = deps.madeForYou;
    var classifyArtistShelves = deps.classifyArtistShelves;
    var releaseSortKey = deps.releaseSortKey;
    var fetchJson = deps.fetchJson;
    var LISTEN = deps.LISTEN || "/api/music/listen";
    var FETCH_MS = deps.FETCH_MS || 10000;
    var escQ = deps.escQ;
    var dedupeTracks = deps.dedupeTracks;

  /** Related artists via artist search (name variants / "similar to"). Tight = fewer queries. */
  function relatedArtistTracks(artistName, limit, tight) {
    var name = String(artistName || "").trim();
    if (!name) return Promise.resolve([]);
    var queries = tight
      ? ["artists like " + name, name + " radio"]
      : [name + " songs", "artists like " + name, name + " type beat", name + " radio"];
    return Promise.all(
      queries.map(function (q) {
        return withTimeout(searchSimilar(q, tight ? 8 : 10), FETCH_MS, []);
      })
    ).then(function (groups) {
      var acc = [];
      groups.forEach(function (g) {
        acc = acc.concat(g || []);
      });
      return dedupeTracks(acc).slice(0, limit || 24);
    });
  }

  /** Ring 2 — immediate source remainder (album / playlist / shelf seeds). */
  function sourceRemainderTracks(ctx, albumId) {
    var rem = ctx.sourceRemainder || ctx.sourceOrder || [];
    var fromSource = (rem || []).filter(function (t) {
      return t && (t.videoId || t.id);
    });
    if (fromSource.length) return Promise.resolve(fromSource);
    if (albumId) return albumTracks(albumId);
    return Promise.resolve([]);
  }

  /** Ring 3 — same release family (deluxe / versions / extras). */
  function releaseFamilyTracks(current, albumTitle, artistName, excludeAlbumId, limit) {
    var title = String(albumTitle || (current && current.albumTitle) || "").trim();
    var artist = String(artistName || "").trim();
    if (!title && !artist) return Promise.resolve([]);
    var base = title || artist;
    var queries = [
      title ? title + " deluxe" : "",
      title ? title + " extended" : "",
      title ? title + " anniversary" : "",
      title && artist ? artist + " " + title + " explicit" : "",
      artist && title ? artist + " " + title + " remix" : "",
      base + " bonus track",
    ].filter(Boolean);
    var acc = [];
    var i = 0;
    function next() {
      if (acc.length >= (limit || 12) || i >= queries.length) {
        return Promise.resolve(dedupeTracks(acc).slice(0, limit || 12));
      }
      var q = queries[i++];
      return withTimeout(searchSimilar(q, 8), FETCH_MS, []).then(function (tracks) {
        (tracks || []).forEach(function (t) {
          if (excludeAlbumId && String(t.albumId || "") === String(excludeAlbumId)) return;
          acc.push(t);
        });
        return next();
      });
    }
    return next();
  }

  /** Ring 4 — same artist era/project (year ± band around seed). */
  function artistEraTracks(artistId, artistName, seedYear, excludeAlbumId, limit) {
    var year = seedYear || 0;
    var band = 3;
    function inEra(it) {
      if (!year) return true;
      var y = releaseSortKey(it);
      if (!y) return true;
      return Math.abs(y - year) <= band;
    }
    if (!artistId && !artistName) return Promise.resolve([]);
    var head = artistId
      ? fetchJson(LISTEN + "/artist/" + escQ(artistId)).catch(function () {
          return null;
        })
      : Promise.resolve(null);
    return head.then(function (data) {
      if (!data) {
        return artistEcosystem({
          artistId: artistId,
          artistName: artistName,
          excludeAlbumId: excludeAlbumId || "",
          mode: "album-extend",
          maxAlbums: 4,
          maxTracks: limit || 16,
        });
      }
      if (data.title && !artistName) artistName = data.title;
      var parts = classifyArtistShelves(data.shelves || []);
      var albums = (parts.albums || [])
        .concat(parts.singles || [])
        .filter(function (a) {
          return a && a.browseId && String(a.browseId) !== String(excludeAlbumId || "");
        })
        .filter(inEra);
      var popular = ((parts.songs || []) || []).filter(function (t) {
        return t && t.videoId;
      });
      var releaseQueue = albums.slice(0, 5);
      var acc = year ? [] : popular.slice(0, 6);
      var i = 0;
      function nextPair() {
        if (acc.length >= (limit || 16) || i >= releaseQueue.length) {
          return Promise.resolve(dedupeTracks(acc).slice(0, limit || 16));
        }
        var batch = releaseQueue.slice(i, i + 2);
        i += 2;
        return Promise.all(
          batch.map(function (rel) {
            return albumTracks(rel.browseId).then(function (tracks) {
              return (tracks || []).map(function (t) {
                return Object.assign({}, t, {
                  albumId: t.albumId || rel.browseId,
                  albumTitle: t.albumTitle || rel.title || "",
                  year: t.year || rel.year || "",
                });
              });
            });
          })
        ).then(function (groups) {
          groups.forEach(function (tracks) {
            acc = acc.concat(tracks || []);
          });
          return nextPair();
        });
      }
      return nextPair();
    });
  }

  /** Ring 6 — direct collaborators / features. */
  function collaboratorTracks(track, limit) {
    var names = parseCollaborators(track || {});
    if (!names.length) return Promise.resolve([]);
    return Promise.all(
      names.slice(0, 4).map(function (n) {
        return withTimeout(searchSimilar(n + " songs", 8), FETCH_MS, []);
      })
    ).then(function (groups) {
      var acc = [];
      groups.forEach(function (g) {
        acc = acc.concat(g || []);
      });
      return dedupeTracks(acc).slice(0, limit || 16);
    });
  }

  /** Ring 8 — genre · tempo · era · mood cluster (watch + tagged search). */
  function genreMoodTracks(current, vid, limit) {
    var title = (current && current.title) || "";
    var artist =
      (current && current.artists && current.artists[0]) || (current && current.subtitle) || "";
    var year = seedYearOf(current, null);
    var genre = (current && (current.genre || current.category)) || "";
    var queries = [
      genre ? genre + " hits" : "",
      genre && year ? genre + " " + year : "",
      year ? String(year) + " hits" : "",
      artist ? artist + " type beat" : "",
      title && artist ? title + " " + artist + " mix" : "",
    ].filter(Boolean);
    var head = vid ? watchNext(vid, 20) : Promise.resolve([]);
    return head.then(function (watch) {
      var acc = watch || [];
      var i = 0;
      function next() {
        if (acc.length >= (limit || 16) || i >= queries.length) {
          return Promise.resolve(dedupeTracks(acc).slice(0, limit || 20));
        }
        var q = queries[i++];
        return withTimeout(searchSimilar(q, 8), FETCH_MS, []).then(function (tracks) {
          acc = acc.concat(tracks || []);
          return next();
        });
      }
      return next();
    });
  }

  /** Ring 9 — session / taste graph (co-occurrence, TOD, Made for you, likes). */
  function sessionTasteTracks(limit) {
    var local = madeForYou(limit || 20);
    return Promise.resolve(local);
  }

  /** Pull playable tracks from Listen home shelves (trending / charts / mixes). */

    return {
      relatedArtistTracks: relatedArtistTracks,
      sourceRemainderTracks: sourceRemainderTracks,
      releaseFamilyTracks: releaseFamilyTracks,
      artistEraTracks: artistEraTracks,
      collaboratorTracks: collaboratorTracks,
      genreMoodTracks: genreMoodTracks,
      sessionTasteTracks: sessionTasteTracks,
    };
  }

  window.SDMusicEcosystemRings = {
    RINGS: ECOSYSTEM_RINGS,
    RING_TARGET: RING_TARGET,
    RING_FLOOR: RING_FLOOR,
    stampRing: stampRing,
    mergeParentGroups: mergeParentGroups,
    normalizeParents: normalizeParents,
    fanOutParents: fanOutParents,
    seedYearOf: seedYearOf,
    parseCollaborators: parseCollaborators,
    isMixedSurface: isMixedSurface,
    buildParentsFromTracks: buildParentsFromTracks,
    resolveParents: resolveParents,
    attach: attach,
    trackId: trackId,
  };
})();
