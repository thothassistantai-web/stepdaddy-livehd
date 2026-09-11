/**
 * Unified Queue artist / multi-parent ecosystem prefetch.
 * API: window.SDMusicUQEcosystem.bind(ctx)
 */
(function () {
  if (window.SDMusicUQEcosystem) return;

  function bind(ctx) {
    var trackId = ctx.trackId;
    var cloneTrack = ctx.cloneTrack;
    var extendUpNext = ctx.extendUpNext;
    var prepareAutoplay = ctx.prepareAutoplay;
    var getSession = ctx.getSession;
    var emit = ctx.emit;
    var ecosystemRef = ctx.ecosystemRef; // { inflight }

  function sess() { return getSession(); }

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
    (sess().upNext || []).forEach(function (t) {
      var id = trackId(t);
      if (id) excludeIds[id] = 1;
    });
    if (sess().now) {
      var nid = trackId(sess().now);
      if (nid) excludeIds[nid] = 1;
    }

    var surface = String(meta.type || meta.surface || "").toLowerCase();
    var mode = surface === "album" ? "album-extend" : "directory";
    var artistId =
      meta.artistId ||
      (sess().now && (sess().now.artistId || (sess().now.artistIds && sess().now.artistIds[0]))) ||
      (sess().source && sess().source.artistId) ||
      "";
    var artistName =
      meta.artistName ||
      (sess().now && ((sess().now.artists && sess().now.artists[0]) || sess().now.subtitle)) ||
      (sess().source && sess().source.artistName) ||
      "";

    sess().ecosystemPending = true;
    if (ecosystemRef.inflight) {
      // Allow overlapping schedule only for newest session; drop flag when done.
    }

    var seenBatch = Object.create(null);
    ecosystemRef.inflight = SQ.artistEcosystem({
      artistId: artistId,
      artistName: artistName,
      excludeAlbumId: surface === "album" ? meta.id || meta.albumId || "" : "",
      excludeIds: excludeIds,
      mode: mode,
      entryPath: surface || mode,
      seedItems: seeds || (sess().now ? [sess().now] : []),
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
        extendUpNext(
          fresh.map(function (t) {
            var o = cloneTrack(t);
            o._ring = mode === "album-extend" ? 4 : 5;
            o._ringSource = mode === "album-extend" ? "artist-era" : "artist";
            return o;
          }),
          {
          layer: "artist-ecosystem",
          entryPath: surface,
          // Album continuity: keep release order from builder; directory may rank.
          rank: mode === "directory",
          shuffle: mode === "directory" && sess().shuffle,
        }
        );
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
          extendUpNext(
            fresh.map(function (t) {
              var o = cloneTrack(t);
              o._ring = mode === "album-extend" ? 4 : 5;
              o._ringSource = mode === "album-extend" ? "artist-era" : "artist";
              return o;
            }),
            {
            layer: "artist-ecosystem",
            entryPath: surface,
            rank: mode === "directory",
            shuffle: mode === "directory" && sess().shuffle,
          }
          );
        }
        return sess().upNext;
      })
      .catch(function () {
        return sess().upNext;
      })
      .finally(function () {
        sess().ecosystemPending = false;
        ecosystemRef.inflight = null;
        emit();
        // Top up Autoplay after ecosystem settles (still after Up Next).
        prepareAutoplay();
      });
    return ecosystemRef.inflight;
  }

  /**
   * Mixed playlist / likes: prefetch catalogs from ALL weighted parents into Up Next
   * (interleaved) — never collapse to the currently playing track's artist alone.
   */
  function scheduleMultiParentEcosystem(parents, seeds) {
    var SQ = window.SDMusicSmartQueue;
    if (!SQ || typeof SQ.artistEcosystem !== "function") {
      prepareAutoplay();
      return Promise.resolve([]);
    }
    parents = (parents || []).slice(0, 6);
    if (parents.length < 2) return scheduleArtistEcosystem(sess().source || {}, seeds);

    var excludeIds = Object.create(null);
    (seeds || []).forEach(function (t) {
      var id = trackId(t);
      if (id) excludeIds[id] = 1;
    });
    (sess().upNext || []).forEach(function (t) {
      var id = trackId(t);
      if (id) excludeIds[id] = 1;
    });
    if (sess().now) {
      var nid = trackId(sess().now);
      if (nid) excludeIds[nid] = 1;
    }

    sess().ecosystemPending = true;
    var perParent = Math.max(3, Math.ceil(24 / parents.length));
    ecosystemRef.inflight = Promise.all(
      parents.map(function (p) {
        return SQ.artistEcosystem({
          artistId: p.artistId || "",
          artistName: p.artistName || "",
          excludeIds: excludeIds,
          mode: "directory",
          entryPath: "playlist-multi",
          seedItems: seeds || [],
          maxAlbums: 2,
          maxTracks: perParent,
        })
          .then(function (tracks) {
            return (tracks || []).map(function (t) {
              var o = cloneTrack(t);
              o._ring = 5;
              o._ringSource = "artist";
              o._parentArtist = p.artistName || "";
              return o;
            });
          })
          .catch(function () {
            return [];
          });
      })
    )
      .then(function (groups) {
        var merged = [];
        if (SQ.mergeParentGroups) merged = SQ.mergeParentGroups(groups, 36);
        else {
          var maxLen = 0;
          groups.forEach(function (g) {
            if (g.length > maxLen) maxLen = g.length;
          });
          for (var i = 0; i < maxLen; i++) {
            groups.forEach(function (g) {
              if (g[i]) merged.push(g[i]);
            });
          }
        }
        var fresh = merged.filter(function (t) {
          var id = trackId(t);
          if (!id || excludeIds[id]) return false;
          excludeIds[id] = 1;
          return true;
        });
        if (fresh.length) {
          extendUpNext(fresh, {
            layer: "multi-parent-ecosystem",
            entryPath: "playlist",
            rank: !!sess().autoplayBias,
            shuffle: false,
          });
        }
        return sess().upNext;
      })
      .catch(function () {
        return sess().upNext;
      })
      .finally(function () {
        sess().ecosystemPending = false;
        ecosystemRef.inflight = null;
        emit();
        prepareAutoplay();
      });
    return ecosystemRef.inflight;
  }


    return {
      shouldExtendArtistEcosystem: shouldExtendArtistEcosystem,
      scheduleArtistEcosystem: scheduleArtistEcosystem,
      scheduleMultiParentEcosystem: scheduleMultiParentEcosystem,
    };
  }

  window.SDMusicUQEcosystem = { bind: bind };
})();
