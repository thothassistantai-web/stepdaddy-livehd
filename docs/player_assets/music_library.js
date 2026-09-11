/**
 * StepDaddy Music Library — local-first saved items + playlists.
 * Liked songs, albums, artists, stations, user playlists (private/public/collaborative),
 * listening-party playlists with invite codes. Light server sync optional.
 * API: window.SDMusicLibrary
 */
(function () {
  if (window.SDMusicLibrary) return;

  var LS_KEY = "sd_music_library_v1";
  var IDB_NAME = "sd_music_library";
  var IDB_STORE = "blob";
  var API = "/api/music/library";
  var PLAYLIST_API = "/api/music/playlist";
  var MAX_LIKED = 500;
  var MAX_ALBUMS = 200;
  var MAX_ARTISTS = 200;
  var MAX_STATIONS = 200;
  var MAX_PLAYLISTS = 80;
  var MAX_TRACKS_PER = 250;

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    return (
      (prefix || "pl") +
      "_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 8)
    );
  }

  function inviteCode() {
    var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var out = "";
    for (var i = 0; i < 6; i++) out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    return out;
  }

  function emptyState() {
    return {
      v: 1,
      liked: [],
      albums: [],
      artists: [],
      stations: [],
      playlists: [],
      ownerId: null,
      updatedAt: nowIso(),
    };
  }

  function itemKey(it) {
    if (!it) return "";
    if (it.videoId) return "t:" + it.videoId;
    if (it.browseId) return "b:" + it.browseId;
    if (it.playlistId) return "p:" + it.playlistId;
    if (it.stationuuid) return "s:" + it.stationuuid;
    if (it.id) return "i:" + it.id;
    return "";
  }

  function normalizeTrack(t) {
    if (!t) return null;
    var kind = String(t.kind || "").toLowerCase();
    var videoId = t.videoId || (t.source === "listen" ? t.id : "") || "";
    if (!videoId && (kind === "station" || t.stationuuid || t.source === "radio")) {
      videoId = "station:" + (t.stationuuid || (t.station && t.station.stationuuid) || t.id || t.name || t.title || "");
    }
    if (!videoId && (kind === "album" || (t.browseId && kind !== "artist" && !t.channelId))) {
      videoId = "album:" + (t.browseId || t.id || t.title || "");
    }
    if (!videoId && (kind === "artist" || kind === "search_artist" || t.channelId)) {
      videoId = "artist:" + (t.browseId || t.channelId || t.id || t.title || t.name || "");
    }
    if (!videoId) return null;
    return {
      videoId: videoId,
      title: t.title || t.name || t.display_name || "Track",
      artists: t.artists || (t.subtitle ? [t.subtitle] : t.artist ? [t.artist] : []),
      subtitle: t.subtitle || "",
      thumb: t.thumb || t.artwork || t.favicon || t.thumbnail || "",
      albumId: t.albumId || (kind === "album" ? t.browseId || "" : ""),
      albumTitle: t.albumTitle || (kind === "album" ? t.title || "" : ""),
      artistId: t.artistId || (t.artistIds && t.artistIds[0]) || (kind === "artist" ? t.browseId || t.channelId || "" : ""),
      duration: t.duration || "",
      kind: kind || (String(videoId).indexOf("station:") === 0 ? "station" : "song"),
      browseId: t.browseId || t.channelId || "",
      stationuuid: t.stationuuid || (t.station && t.station.stationuuid) || "",
      stream_url: t.stream_url || t.url || (t.station && t.station.stream_url) || "",
      addedAt: t.addedAt || nowIso(),
    };
  }

  function pickPlaylistId() {
    var st = getState();
    var pls = st.playlists || [];
    if (!pls.length) {
      var title = window.prompt("Create a playlist to add this to:", "My playlist");
      if (!title) return null;
      var pl = createPlaylist({ title: String(title).slice(0, 80), visibility: "private" });
      return pl && pl.id;
    }
    var lines = pls.map(function (p, i) {
      var n = (p.tracks && p.tracks.length) || 0;
      return i + 1 + ") " + p.title + (n ? " · " + n : "");
    });
    var ans = window.prompt("Add to playlist — number or new name:\n" + lines.join("\n"), "1");
    if (ans == null) return null;
    ans = String(ans).trim();
    if (/^\d+$/.test(ans)) {
      var idx = parseInt(ans, 10) - 1;
      if (idx >= 0 && idx < pls.length) return pls[idx].id;
      return null;
    }
    if (!ans) return null;
    var created = createPlaylist({ title: ans.slice(0, 80), visibility: "private" });
    return created && created.id;
  }

  /** Unified + affordance: save type-specific library entry and add to a playlist. */
  function quickAdd(item) {
    if (!item) return { ok: false, reason: "empty" };
    var raw = item.station && typeof item.station === "object" ? Object.assign({}, item, item.station) : item;
    var kind = String(raw.kind || "").toLowerCase();
    var isStation = kind === "station" || !!raw.stationuuid || raw.source === "radio";
    var isArtist = kind === "artist" || kind === "search_artist";
    var isAlbum = kind === "album";
    var playlistId = pickPlaylistId();
    if (!playlistId) return { ok: false, reason: "cancelled" };
    try {
      if (isAlbum) saveAlbum(raw);
      else if (isArtist) followArtist(raw);
      else if (isStation) saveStation(raw.station || raw);
    } catch (e) {}
    var pl = addToPlaylist(playlistId, raw);
    return { ok: !!pl, playlistId: playlistId, action: isStation ? "station" : isArtist ? "artist" : isAlbum ? "album" : "track" };
  }

  function addBtnHtml(extraClass) {
    return (
      '<span role="button" tabindex="0" class="sd-ml-add' +
      (extraClass ? " " + extraClass : "") +
      '" data-ml-add aria-label="Add to playlist" title="Add to playlist">+</span>'
    );
  }

  function moreBtnHtml(extraClass) {
    return (
      '<span role="button" tabindex="0" class="ml-more' +
      (extraClass ? " " + extraClass : "") +
      '" data-ml-more aria-label="More" title="More" aria-haspopup="menu">⋮</span>'
    );
  }

  /** Normalize catalog/home/search rows into a Listen/UQ track seed. */
  function asPlayableTrack(item) {
    if (!item) return null;
    var kind = String(item.kind || "").toLowerCase();
    if (
      kind === "station" ||
      kind === "artist" ||
      kind === "search_artist" ||
      kind === "album" ||
      kind === "playlist" ||
      kind === "mood" ||
      item.source === "radio" ||
      item.stationuuid
    ) {
      return null;
    }
    var vid = item.videoId || "";
    if (!vid) {
      if (
        item.source === "listen" ||
        kind === "song" ||
        kind === "track" ||
        kind === "video" ||
        kind === ""
      ) {
        vid = item.id || "";
      }
    }
    vid = String(vid || "").trim();
    if (!vid) return null;
    // Reject browse / channel / playlist-ish ids mistaken for video ids.
    if (/^(MP|UC|RD|PL|OLAK)/i.test(vid)) return null;
    return Object.assign({}, item, {
      videoId: item.videoId || vid,
      title: item.title || item.name || "Track",
      artists: item.artists || (item.subtitle ? [String(item.subtitle)] : []),
      thumb: item.thumb || item.artwork || "",
      subtitle: item.subtitle || item.uploader || "",
    });
  }

  function isPlayableTrack(item) {
    return !!asPlayableTrack(item);
  }

  var _openMenuEl = null;
  var _openMenuCloser = null;

  function closeMoreMenu() {
    if (_openMenuCloser) {
      try {
        document.removeEventListener("click", _openMenuCloser, true);
        document.removeEventListener("keydown", _openMenuCloser, true);
      } catch (e) {}
      _openMenuCloser = null;
    }
    if (_openMenuEl && _openMenuEl.parentNode) {
      _openMenuEl.parentNode.removeChild(_openMenuEl);
    }
    _openMenuEl = null;
  }

  function enqueueTrack(action, item) {
    var track = asPlayableTrack(item);
    if (!track) return { ok: false, reason: "not_track" };
    try {
      var L = window.StepDaddyMusicListen;
      if (L && typeof L[action] === "function") {
        L[action](track);
        return { ok: true, action: action };
      }
      var UQ = window.SDMusicUnifiedQueue;
      if (UQ && typeof UQ[action] === "function") {
        UQ[action](track);
        return { ok: true, action: action };
      }
    } catch (e) {}
    return { ok: false, reason: "no_api" };
  }

  function flashMenuHint(anchor, text) {
    if (!anchor) return;
    var tip = document.createElement("div");
    tip.className = "ml-pop-hint";
    tip.textContent = text;
    document.body.appendChild(tip);
    var r = anchor.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(window.innerWidth - 160, r.left + r.width / 2 - 70)) + "px";
    tip.style.top = Math.max(8, r.top - 36) + "px";
    setTimeout(function () {
      if (tip.parentNode) tip.parentNode.removeChild(tip);
    }, 1400);
  }

  /** Track ⋮ menu: Play Next / Add to Queue / Add to playlist. */
  function openMoreMenu(anchor, item) {
    closeMoreMenu();
    if (!anchor || !item) return;
    var track = asPlayableTrack(item);
    var menu = document.createElement("div");
    menu.className = "ml-pop-menu";
    menu.setAttribute("role", "menu");
    var html = "";
    if (track) {
      html +=
        '<button type="button" role="menuitem" data-ml-menu="play-next">Play Next</button>' +
        '<button type="button" role="menuitem" data-ml-menu="add-queue">Add to Queue</button>';
    }
    html += '<button type="button" role="menuitem" data-ml-menu="playlist">Add to playlist</button>';
    menu.innerHTML = html;
    document.body.appendChild(menu);
    _openMenuEl = menu;

    var rect = anchor.getBoundingClientRect();
    var mw = menu.offsetWidth || 180;
    var mh = menu.offsetHeight || 120;
    var left = Math.min(window.innerWidth - mw - 8, Math.max(8, rect.right - mw));
    var top = rect.bottom + 6;
    if (top + mh > window.innerHeight - 8) top = Math.max(8, rect.top - mh - 6);
    menu.style.left = left + "px";
    menu.style.top = top + "px";

    menu.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-ml-menu]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var act = btn.getAttribute("data-ml-menu");
      closeMoreMenu();
      if (act === "play-next") {
        var r1 = enqueueTrack("playNext", item);
        if (r1.ok) flashMenuHint(anchor, "Playing next");
        return;
      }
      if (act === "add-queue") {
        var r2 = enqueueTrack("addToQueue", item);
        if (r2.ok) flashMenuHint(anchor, "Added to queue");
        return;
      }
      if (act === "playlist") {
        var res = quickAdd(item);
        if (res && res.ok) flashMenuHint(anchor, "Added to playlist");
      }
    });

    _openMenuCloser = function (ev) {
      if (ev.type === "keydown" && ev.key !== "Escape") return;
      if (ev.type === "click" && menu.contains(ev.target)) return;
      if (ev.type === "click" && anchor.contains && anchor.contains(ev.target)) return;
      closeMoreMenu();
    };
    setTimeout(function () {
      document.addEventListener("click", _openMenuCloser, true);
      document.addEventListener("keydown", _openMenuCloser, true);
    }, 0);
  }

  function wireAddButton(btn, item) {
    if (!btn || btn.__mlAddWired) return;
    btn.__mlAddWired = true;
    function go(e) {
      e.preventDefault();
      e.stopPropagation();
      var res = quickAdd(item);
      if (res && res.ok) {
        btn.classList.add("added");
        btn.setAttribute("aria-label", "Added to playlist");
        btn.title = "Added to playlist";
      }
    }
    btn.addEventListener("click", go);
    btn.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") go(e);
    });
  }

  function wireMoreButton(btn, item) {
    if (!btn || btn.__mlMoreWired) return;
    btn.__mlMoreWired = true;
    function go(e) {
      e.preventDefault();
      e.stopPropagation();
      openMoreMenu(btn, item);
    }
    btn.addEventListener("click", go);
    btn.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") go(e);
    });
  }

  /** Wire + and ⋮ inside a host; optional long-press on host for track rows. */
  function wireRowActions(host, item, opts) {
    opts = opts || {};
    if (!host || !item) return;
    var addBtn = host.querySelector("[data-ml-add]");
    if (addBtn) wireAddButton(addBtn, item);
    var more = host.querySelector("[data-ml-more]");
    if (more) wireMoreButton(more, item);
    if (opts.longPress && isPlayableTrack(item) && !host.__mlLongPressWired) {
      host.__mlLongPressWired = true;
      var timer = null;
      var startX = 0;
      var startY = 0;
      function clear() {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      }
      host.addEventListener(
        "touchstart",
        function (e) {
          if (e.target.closest("[data-ml-add], [data-ml-more], .play-dot")) return;
          var t = e.touches && e.touches[0];
          if (!t) return;
          startX = t.clientX;
          startY = t.clientY;
          clear();
          timer = setTimeout(function () {
            timer = null;
            openMoreMenu(more || host, item);
          }, 480);
        },
        { passive: true }
      );
      host.addEventListener(
        "touchmove",
        function (e) {
          var t = e.touches && e.touches[0];
          if (!t || !timer) return;
          if (Math.abs(t.clientX - startX) > 12 || Math.abs(t.clientY - startY) > 12) clear();
        },
        { passive: true }
      );
      host.addEventListener("touchend", clear);
      host.addEventListener("touchcancel", clear);
      host.addEventListener("contextmenu", function (e) {
        if (e.target.closest("[data-ml-add], [data-ml-more]")) return;
        e.preventDefault();
        openMoreMenu(more || host, item);
      });
    }
  }

  function readLs() {
    try {
      var raw = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (!raw || typeof raw !== "object") return emptyState();
      raw.liked = Array.isArray(raw.liked) ? raw.liked : [];
      raw.albums = Array.isArray(raw.albums) ? raw.albums : [];
      raw.artists = Array.isArray(raw.artists) ? raw.artists : [];
      raw.stations = Array.isArray(raw.stations) ? raw.stations : [];
      raw.playlists = Array.isArray(raw.playlists) ? raw.playlists : [];
      if (!raw.ownerId) {
        try {
          raw.ownerId = localStorage.getItem("sd_music_owner_id") || uid("own");
          localStorage.setItem("sd_music_owner_id", raw.ownerId);
        } catch (e) {
          raw.ownerId = uid("own");
        }
      }
      return raw;
    } catch (e) {
      return emptyState();
    }
  }

  var mem = null;
  var idbReady = null;
  var saveTimer = null;

  function getState() {
    if (!mem) mem = readLs();
    return mem;
  }

  function openIdb() {
    if (idbReady) return idbReady;
    idbReady = new Promise(function (resolve) {
      if (!window.indexedDB) return resolve(null);
      try {
        var req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
        };
        req.onsuccess = function () {
          resolve(req.result);
        };
        req.onerror = function () {
          resolve(null);
        };
      } catch (e) {
        resolve(null);
      }
    });
    return idbReady;
  }

  function idbPut(state) {
    return openIdb().then(function (db) {
      if (!db) return;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(IDB_STORE, "readwrite");
          tx.objectStore(IDB_STORE).put(state, "main");
          tx.oncomplete = function () {
            resolve();
          };
          tx.onerror = function () {
            resolve();
          };
        } catch (e) {
          resolve();
        }
      });
    });
  }

  function idbGet() {
    return openIdb().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(IDB_STORE, "readonly");
          var req = tx.objectStore(IDB_STORE).get("main");
          req.onsuccess = function () {
            resolve(req.result || null);
          };
          req.onerror = function () {
            resolve(null);
          };
        } catch (e) {
          resolve(null);
        }
      });
    });
  }

  function persist(state, opts) {
    opts = opts || {};
    state.updatedAt = nowIso();
    mem = state;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (e) {}
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      idbPut(state);
      if (!opts.skipSync) softSync(state);
    }, opts.immediate ? 0 : 400);
    try {
      window.dispatchEvent(new CustomEvent("sd-music-library", { detail: { at: state.updatedAt } }));
    } catch (e) {}
    return state;
  }

  function softSync(state) {
    try {
      var publicPl = (state.playlists || []).filter(function (p) {
        return p && (p.visibility === "public" || p.collaborative || p.listeningParty);
      });
      if (!publicPl.length) return;
      fetch(API + "/sync", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: state.ownerId,
          playlists: publicPl.map(slimPlaylist),
        }),
      }).catch(function () {});
    } catch (e) {}
  }

  function slimPlaylist(p) {
    return {
      id: p.id,
      title: p.title,
      description: p.description || "",
      visibility: p.visibility || "private",
      collaborative: !!p.collaborative,
      listeningParty: !!p.listeningParty,
      inviteCode: p.inviteCode || "",
      ownerId: p.ownerId,
      trackCount: (p.tracks || []).length,
      tracks: (p.tracks || []).slice(0, MAX_TRACKS_PER),
      cover: p.cover || ((p.tracks && p.tracks[0] && p.tracks[0].thumb) || ""),
      updatedAt: p.updatedAt || nowIso(),
      partyActive: !!p.partyActive,
    };
  }

  function dedupePush(list, item, keyFn, max) {
    var k = keyFn(item);
    if (!k) return list;
    list = (list || []).filter(function (x) {
      return keyFn(x) !== k;
    });
    list.unshift(item);
    return list.slice(0, max || 200);
  }

  function likeTrack(track, liked) {
    var st = getState();
    var t = normalizeTrack(track);
    if (!t || !t.videoId) return st;
    if (liked === false) {
      st.liked = st.liked.filter(function (x) {
        return x.videoId !== t.videoId;
      });
    } else {
      st.liked = dedupePush(st.liked, t, function (x) {
        return x.videoId;
      }, MAX_LIKED);
    }
    return persist(st);
  }

  function isLiked(videoId) {
    if (!videoId) return false;
    return getState().liked.some(function (t) {
      return t.videoId === String(videoId);
    });
  }

  function saveAlbum(album, on) {
    var st = getState();
    if (!album || !album.browseId) return st;
    var row = {
      browseId: album.browseId,
      title: album.title || "Album",
      subtitle: album.subtitle || (album.artists && album.artists.join(", ")) || "",
      thumb: album.thumb || "",
      artists: album.artists || [],
      kind: "album",
      addedAt: nowIso(),
    };
    if (on === false) {
      st.albums = st.albums.filter(function (a) {
        return a.browseId !== row.browseId;
      });
    } else {
      st.albums = dedupePush(st.albums, row, function (a) {
        return a.browseId;
      }, MAX_ALBUMS);
    }
    return persist(st);
  }

  function isFollowing(browseId) {
    if (!browseId) return false;
    var id = String(browseId);
    return getState().artists.some(function (a) {
      return a && String(a.browseId) === id;
    });
  }

  function isAlbumSaved(browseId) {
    if (!browseId) return false;
    var id = String(browseId);
    return getState().albums.some(function (a) {
      return a && String(a.browseId) === id;
    });
  }

  function followArtist(artist, on) {
    var st = getState();
    if (!artist || !artist.browseId) return st;
    var row = {
      browseId: artist.browseId,
      title: artist.title || "Artist",
      thumb: artist.thumb || "",
      kind: "artist",
      addedAt: nowIso(),
    };
    if (on === false) {
      st.artists = st.artists.filter(function (a) {
        return a.browseId !== row.browseId;
      });
    } else {
      st.artists = dedupePush(st.artists, row, function (a) {
        return a.browseId;
      }, MAX_ARTISTS);
    }
    try {
      var T = window.SDMusicTaste;
      if (T && typeof T.recordFollow === "function") {
        T.recordFollow(row, on !== false);
      } else if (T && typeof T.recordLike === "function") {
        T.recordLike(
          {
            id: "artist:" + row.browseId,
            title: row.title,
            artist: row.title,
            kind: "artist",
            browseId: row.browseId,
            thumb: row.thumb,
          },
          on !== false
        );
      }
    } catch (e) {}
    return persist(st);
  }

  function saveStation(station, on) {
    var st = getState();
    if (!station || !(station.stationuuid || station.id)) return st;
    var id = String(station.stationuuid || station.id);
    var row = {
      stationuuid: id,
      id: id,
      name: station.display_name || station.name || "Station",
      display_name: station.display_name || station.name || "Station",
      favicon: station.favicon || station.artwork || "",
      stream_url: station.stream_url || "",
      band: station.band || "",
      genre: station.genre || "",
      kind: "station",
      playable: station.playable !== false,
      hls: !!station.hls,
      addedAt: nowIso(),
      station: station,
    };
    if (on === false) {
      st.stations = st.stations.filter(function (s) {
        return String(s.stationuuid) !== id;
      });
    } else {
      st.stations = dedupePush(st.stations, row, function (s) {
        return String(s.stationuuid);
      }, MAX_STATIONS);
    }
    return persist(st);
  }

  function createPlaylist(opts) {
    opts = opts || {};
    var st = getState();
    var pl = {
      id: uid("pl"),
      title: String(opts.title || "My playlist").slice(0, 80),
      description: String(opts.description || "").slice(0, 240),
      visibility: opts.visibility === "public" ? "public" : "private",
      collaborative: !!opts.collaborative,
      listeningParty: !!opts.listeningParty,
      inviteCode: opts.collaborative || opts.listeningParty || opts.visibility === "public" ? inviteCode() : "",
      ownerId: st.ownerId,
      tracks: [],
      cover: "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      partyActive: !!opts.listeningParty && !!opts.partyActive,
    };
    if (opts.tracks && opts.tracks.length) {
      opts.tracks.forEach(function (t) {
        var n = normalizeTrack(t);
        if (n && n.videoId) pl.tracks.push(n);
      });
      pl.tracks = pl.tracks.slice(0, MAX_TRACKS_PER);
      if (pl.tracks[0]) pl.cover = pl.tracks[0].thumb || "";
    }
    st.playlists = dedupePush(st.playlists, pl, function (p) {
      return p.id;
    }, MAX_PLAYLISTS);
    persist(st, { immediate: true });
    if (pl.visibility === "public" || pl.collaborative || pl.listeningParty) {
      fetch(PLAYLIST_API + "/upsert", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slimPlaylist(pl)),
      }).catch(function () {});
    }
    return pl;
  }

  function getPlaylist(id) {
    return getState().playlists.find(function (p) {
      return p.id === id;
    });
  }

  function updatePlaylist(id, patch) {
    var st = getState();
    var pl = st.playlists.find(function (p) {
      return p.id === id;
    });
    if (!pl) return null;
    if (patch.title != null) pl.title = String(patch.title).slice(0, 80);
    if (patch.description != null) pl.description = String(patch.description).slice(0, 240);
    if (patch.visibility === "public" || patch.visibility === "private") pl.visibility = patch.visibility;
    if (patch.collaborative != null) pl.collaborative = !!patch.collaborative;
    if (patch.listeningParty != null) pl.listeningParty = !!patch.listeningParty;
    if (patch.partyActive != null) pl.partyActive = !!patch.partyActive;
    if ((pl.collaborative || pl.listeningParty || pl.visibility === "public") && !pl.inviteCode) {
      pl.inviteCode = inviteCode();
    }
    pl.updatedAt = nowIso();
    persist(st, { immediate: true });
    if (pl.visibility === "public" || pl.collaborative || pl.listeningParty) {
      fetch(PLAYLIST_API + "/upsert", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slimPlaylist(pl)),
      }).catch(function () {});
    }
    return pl;
  }

  function deletePlaylist(id) {
    var st = getState();
    var pl = st.playlists.find(function (p) {
      return p.id === id;
    });
    st.playlists = st.playlists.filter(function (p) {
      return p.id !== id;
    });
    persist(st, { immediate: true });
    if (pl && pl.inviteCode) {
      fetch(PLAYLIST_API + "/" + encodeURIComponent(pl.id) + "?ownerId=" + encodeURIComponent(st.ownerId), {
        method: "DELETE",
        credentials: "same-origin",
      }).catch(function () {});
    }
    return true;
  }

  function addToPlaylist(playlistId, track) {
    var st = getState();
    var pl = st.playlists.find(function (p) {
      return p.id === playlistId;
    });
    if (!pl) return null;
    var t = normalizeTrack(track);
    if (!t || !t.videoId) return pl;
    pl.tracks = dedupePush(pl.tracks, t, function (x) {
      return x.videoId;
    }, MAX_TRACKS_PER);
    if (!pl.cover && t.thumb) pl.cover = t.thumb;
    pl.updatedAt = nowIso();
    persist(st);
    return pl;
  }

  function removeFromPlaylist(playlistId, videoId) {
    var st = getState();
    var pl = st.playlists.find(function (p) {
      return p.id === playlistId;
    });
    if (!pl) return null;
    pl.tracks = (pl.tracks || []).filter(function (t) {
      return t.videoId !== String(videoId);
    });
    pl.updatedAt = nowIso();
    persist(st);
    return pl;
  }

  function joinByCode(code) {
    code = String(code || "")
      .trim()
      .toUpperCase();
    if (!code) return Promise.reject(new Error("missing_code"));
    return fetch(PLAYLIST_API + "/join/" + encodeURIComponent(code), { credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) throw new Error("join_failed");
        return r.json();
      })
      .then(function (remote) {
        if (!remote || !remote.id) throw new Error("invalid_playlist");
        var st = getState();
        var pl = {
          id: remote.id,
          title: remote.title || "Shared playlist",
          description: remote.description || "",
          visibility: remote.visibility || "public",
          collaborative: !!remote.collaborative,
          listeningParty: !!remote.listeningParty,
          inviteCode: remote.inviteCode || code,
          ownerId: remote.ownerId || "remote",
          tracks: Array.isArray(remote.tracks) ? remote.tracks : [],
          cover: remote.cover || "",
          createdAt: remote.createdAt || nowIso(),
          updatedAt: remote.updatedAt || nowIso(),
          partyActive: !!remote.partyActive,
          joined: true,
        };
        st.playlists = dedupePush(st.playlists, pl, function (p) {
          return p.id;
        }, MAX_PLAYLISTS);
        persist(st, { immediate: true, skipSync: true });
        return pl;
      });
  }

  function discoverPublic(limit) {
    return fetch(PLAYLIST_API + "/public?limit=" + encodeURIComponent(limit || 24), {
      credentials: "same-origin",
    })
      .then(function (r) {
        return r.ok ? r.json() : { playlists: [] };
      })
      .catch(function () {
        return { playlists: [] };
      });
  }

  function snapshot() {
    var st = getState();
    return {
      liked: st.liked.slice(),
      albums: st.albums.slice(),
      artists: st.artists.slice(),
      stations: st.stations.slice(),
      playlists: st.playlists.map(function (p) {
        return Object.assign({}, p, { tracks: (p.tracks || []).slice() });
      }),
      ownerId: st.ownerId,
      updatedAt: st.updatedAt,
    };
  }

  function libraryShelves() {
    var st = getState();
    return [
      { id: "liked", title: "Liked songs", items: st.liked.slice(0, 36), kind: "tracks" },
      { id: "playlists", title: "Your playlists", items: st.playlists.slice(), kind: "playlists" },
      { id: "albums", title: "Albums", items: st.albums.slice(0, 36), kind: "albums" },
      { id: "artists", title: "Artists", items: st.artists.slice(0, 36), kind: "artists" },
      { id: "stations", title: "Saved stations", items: st.stations.slice(0, 36), kind: "stations" },
    ];
  }

  // Hydrate from IDB if richer
  idbGet().then(function (blob) {
    if (!blob || !blob.playlists) return;
    var ls = readLs();
    var blobAt = Date.parse(blob.updatedAt || 0) || 0;
    var lsAt = Date.parse(ls.updatedAt || 0) || 0;
    if (blobAt > lsAt) {
      mem = blob;
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(blob));
      } catch (e) {}
    }
  });

  // Bridge likes from player favs into library for listen tracks
  try {
    window.addEventListener("sd-music-like", function (ev) {
      var d = (ev && ev.detail) || {};
      if (d.videoId || (d.source === "listen" && d.id)) {
        likeTrack(
          {
            videoId: d.videoId || d.id,
            title: d.title,
            subtitle: d.subtitle,
            artists: d.artist ? [d.artist] : [],
            thumb: d.artwork,
            albumId: d.albumId,
            artistId: d.artistId,
          },
          d.liked !== false
        );
      } else if (d.source === "radio" && d.id) {
        saveStation(
          d.station || {
            stationuuid: d.id,
            name: d.title,
            favicon: d.artwork,
            stream_url: d.streamUrl,
            genre: d.genre,
          },
          d.liked !== false
        );
      }
    });
  } catch (e) {}

  window.SDMusicLibrary = {
    read: getState,
    snapshot: snapshot,
    shelves: libraryShelves,
    likeTrack: likeTrack,
    isLiked: isLiked,
    saveAlbum: saveAlbum,
    isAlbumSaved: isAlbumSaved,
    followArtist: followArtist,
    isFollowing: isFollowing,
    saveStation: saveStation,
    createPlaylist: createPlaylist,
    getPlaylist: getPlaylist,
    updatePlaylist: updatePlaylist,
    deletePlaylist: deletePlaylist,
    addToPlaylist: addToPlaylist,
    removeFromPlaylist: removeFromPlaylist,
    joinByCode: joinByCode,
    discoverPublic: discoverPublic,
    quickAdd: quickAdd,
    pickPlaylistId: pickPlaylistId,
    addBtnHtml: addBtnHtml,
    moreBtnHtml: moreBtnHtml,
    wireAddButton: wireAddButton,
    wireMoreButton: wireMoreButton,
    wireRowActions: wireRowActions,
    openMoreMenu: openMoreMenu,
    closeMoreMenu: closeMoreMenu,
    asPlayableTrack: asPlayableTrack,
    isPlayableTrack: isPlayableTrack,
    enqueueTrack: enqueueTrack,
    itemKey: itemKey,
    inviteUrl: function (pl) {
      if (!pl || !pl.inviteCode) return "";
      return location.origin + "/music/listen?party=" + encodeURIComponent(pl.inviteCode);
    },
  };
})();
