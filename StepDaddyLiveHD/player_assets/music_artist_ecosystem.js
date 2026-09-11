/**
 * Artist ecosystem Up Next builder (single-tree album/directory continuity).
 * Bound from SDMusicSmartQueue via attachArtistEcosystem(deps).
 * API: window.SDMusicArtistEcosystem
 */
(function () {
  if (window.SDMusicArtistEcosystem) return;

  function attachArtistEcosystem(deps) {
    deps = deps || {};
    var classifyArtistShelves = deps.classifyArtistShelves;
    var releaseSortKey = deps.releaseSortKey;
    var fetchJson = deps.fetchJson;
    var albumTracks = deps.albumTracks;
    var searchSimilar = deps.searchSimilar;
    var tasteRank = deps.tasteRank;
    var dedupeTracks = deps.dedupeTracks;
    var trackId = deps.trackId;
    var escQ = deps.escQ;
    var LISTEN = deps.LISTEN || "/api/music/listen";
    var withTimeout = deps.withTimeout;
    var FETCH_MS = deps.FETCH_MS || 10000;

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


    return artistEcosystem;
  }

  window.SDMusicArtistEcosystem = { attach: attachArtistEcosystem };
})();
