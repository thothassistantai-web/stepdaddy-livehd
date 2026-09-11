/**
 * StepDaddy Music Home — personalized Spotify-like directory.
 * Mount: window.StepDaddyMusicHome.mount(containerEl, { onBack? })
 * Flow: compact Library → hero → Your music / Radio → Artists → Made for you / trending.
 * Radio + Artists use bubble/chip shelves; search-chip focus via SDMusicFocus.
 */
(function () {
  if (window.StepDaddyMusicHome) return;

  var LISTEN_API = "/api/music/listen";
  var RADIO_API = "/api/music/radio";
  var Artists = function () { return window.SDMusicArtists; };
  var LS_RADIO_MODE = "sd_music_radio_home_mode_v1";
  var LS_LIBRARY_MODE = "sd_music_library_home_mode_v1";
  var RADIO_MODES = [
    { id: "near", label: "Near you" },
    { id: "commercial", label: "Commercial" },
    { id: "internet", label: "Internet" },
    { id: "am", label: "AM" },
    { id: "fm", label: "FM" },
    { id: "favorites", label: "Favorites" },
    { id: "genre", label: "Genre" },
  ];
  var LIBRARY_MODES = [
    { id: "recent", label: "Recent" },
    { id: "liked", label: "Liked" },
    { id: "favorites", label: "Favorites" },
  ];

  function ensureCss() {
    if (document.getElementById("sd-music-home-css")) return;
    var link = document.createElement("link");
    link.id = "sd-music-home-css";
    link.rel = "stylesheet";
    link.href =
      "/tv-assets/music_home.css?v=" + encodeURIComponent(window.__SD_BUNDLE_VERSION || "1");
    document.head.appendChild(link);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function qs(params) {
    var u = new URLSearchParams();
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v !== undefined && v !== null && v !== "") u.set(k, v);
    });
    var s = u.toString();
    return s ? "?" + s : "";
  }

  function taste() {
    return window.SDMusicTaste;
  }

  function focusApi() {
    return window.SDMusicFocus;
  }

  function radioCache() {
    return window.SDMusicRadioCache;
  }

  function player() {
    return window.StepDaddyMusicPlayer;
  }

  async function listenApi(path, params) {
    var r = await fetch(LISTEN_API + path + qs(params), { credentials: "same-origin" });
    if (!r.ok) throw new Error("listen_api_" + r.status);
    return r.json();
  }

  async function radioApi(path, params) {
    var C = radioCache();
    if (C && typeof C.api === "function") return C.api(path, params);
    var r = await fetch(RADIO_API + path + qs(params), { credentials: "same-origin" });
    if (!r.ok) throw new Error("radio_api_" + r.status);
    return r.json();
  }

  function artHtml(item, cls) {
    var url = (item && (item.artwork || item.thumb || item.favicon)) || "";
    if (url) {
      return (
        '<img class="' +
        (cls || "art") +
        '" src="' +
        esc(url) +
        '" alt="" loading="lazy" referrerpolicy="no-referrer"/>'
      );
    }
    return '<span class="' + (cls || "art") + ' mh-fallback" aria-hidden="true"></span>';
  }

  function subtitleOf(item) {
    if (!item) return "";
    if (typeof item.subtitle === "string") return item.subtitle;
    if (Array.isArray(item.artists)) return item.artists.join(", ");
    return item.uploader || item.genre || item.kind || item.source || "";
  }

  function stableKey(item) {
    if (!item) return "";
    var T = taste();
    if (T && typeof T.itemKey === "function") {
      var k = T.itemKey(item);
      if (k) return k;
    }
    if (item.source === "radio" || item.kind === "station" || item.stationuuid) {
      return "r:" + (item.id || item.stationuuid || (item.station && item.station.stationuuid) || "");
    }
    return "l:" + (item.id || item.videoId || item.browseId || item.playlistId || "");
  }

  function dedupeItems(items) {
    var T = taste();
    if (T && typeof T.dedupeItems === "function") return T.dedupeItems(items);
    var seen = {};
    var out = [];
    (items || []).forEach(function (it) {
      var k = stableKey(it);
      if (!k) {
        out.push(it);
        return;
      }
      if (seen[k]) return;
      seen[k] = true;
      out.push(it);
    });
    return out;
  }

  function readRadioMode() {
    try {
      var m = sessionStorage.getItem(LS_RADIO_MODE) || localStorage.getItem(LS_RADIO_MODE);
      if (m && RADIO_MODES.some(function (x) { return x.id === m; })) return m;
    } catch (e) {}
    return "near";
  }

  function writeRadioMode(mode) {
    try {
      sessionStorage.setItem(LS_RADIO_MODE, mode);
      localStorage.setItem(LS_RADIO_MODE, mode);
    } catch (e) {}
  }

  function readLibraryMode() {
    try {
      var m = sessionStorage.getItem(LS_LIBRARY_MODE) || localStorage.getItem(LS_LIBRARY_MODE);
      if (m && LIBRARY_MODES.some(function (x) { return x.id === m; })) return m;
    } catch (e) {}
    return "recent";
  }

  function writeLibraryMode(mode) {
    try {
      sessionStorage.setItem(LS_LIBRARY_MODE, mode);
      localStorage.setItem(LS_LIBRARY_MODE, mode);
    } catch (e) {}
  }

  function asRadioCard(st, fallbackSub) {
    if (!st) return null;
    var uuid = st.stationuuid || st.id || "";
    if (!uuid && st.station) uuid = st.station.stationuuid || st.station.id || "";
    var band = st.band || (st.station && st.station.band) || "";
    var genre = st.genre || (st.station && st.station.genre) || "";
    return {
      source: "radio",
      kind: "station",
      id: uuid,
      stationuuid: uuid,
      title: st.display_name || st.name || st.title || "Station",
      subtitle: fallbackSub || [band, genre, st.city].filter(Boolean).join(" · ") || "Radio",
      artwork: st.favicon || st.artwork || "",
      station: st.station || st,
      genre: genre,
      band: band,
    };
  }

  function Mount(container, opts) {
    opts = opts || {};
    ensureCss();
    container.classList.add("sd-music-home");
    container.innerHTML = "";

    var head = document.createElement("div");
    head.className = "mh-head";
    head.innerHTML =
      '<div><div class="mh-title">Home</div><div class="mh-sub" data-mh-sub>For you · local only</div></div>';
    container.appendChild(head);

    var body = document.createElement("div");
    body.className = "mh-body";
    container.appendChild(body);

    var state = {
      radioHome: null,
      listenHome: null,
      artistsFeed: null,
      loading: false,
      artistMode: (Artists() && Artists().readMode()) || "recommended",
      radioMode: readRadioMode(),
      libraryMode: readLibraryMode(),
    };
    var unsubFocus = null;

    function setSub(t) {
      var el = head.querySelector("[data-mh-sub]");
      if (el) el.textContent = t || "For you · local only";
    }

    async function playListenItem(item, queue) {
      if (!item) return;
      if (item.kind === "mood" && item.params) {
        try {
          if (window.SDMusic) window.SDMusic.setTab("listen", { pushUrl: true });
          if (window.StepDaddyMusicListen && window.StepDaddyMusicListen.openMood) {
            window.StepDaddyMusicListen.openMood(item.params, item.title);
          }
        } catch (e) {}
        return;
      }
      if (item.kind === "album" && item.browseId) {
        try {
          if (window.SDMusic) window.SDMusic.setTab("listen", { pushUrl: true });
          if (window.StepDaddyMusicListen && window.StepDaddyMusicListen.openAlbum) {
            window.StepDaddyMusicListen.openAlbum(item.browseId, item.title);
          }
        } catch (e) {}
        return;
      }
      if (item.kind === "playlist" && item.playlistId) {
        try {
          if (window.SDMusic) window.SDMusic.setTab("listen", { pushUrl: true });
          if (window.StepDaddyMusicListen && window.StepDaddyMusicListen.openPlaylist) {
            window.StepDaddyMusicListen.openPlaylist(item.playlistId, item.title);
          }
        } catch (e) {}
        return;
      }
      if (item.kind === "artist" || item.kind === "search_artist") {
        openArtist(item);
        return;
      }
      var Lib = window.SDMusicLibrary;
      function normalize(t) {
        if (Lib && typeof Lib.asPlayableTrack === "function") return Lib.asPlayableTrack(t);
        if (!t) return null;
        var vid = t.videoId || (t.source === "listen" ? t.id : "") || "";
        if (!vid) return null;
        return Object.assign({}, t, { videoId: String(vid) });
      }
      var seed = normalize(item);
      if (!seed || !seed.videoId) return;
      var tracks = (queue || [item])
        .map(normalize)
        .filter(function (t) {
          return t && t.videoId;
        });
      if (!tracks.length) tracks = [seed];
      var L = window.StepDaddyMusicListen;
      if (L && typeof L.playTracks === "function") {
        try {
          await L.playTracks(tracks, seed.videoId, "home", {
            title: item.title || seed.title || "Home",
            artistName: subtitleOf(item) || "",
          });
          return;
        } catch (e) {}
      }
      if (L && typeof L.playVideoId === "function") {
        try {
          await L.playVideoId(seed.videoId, tracks);
          return;
        } catch (e2) {}
      }
      // Last resort: still enter UQ if available (never bare Player.play without handlers).
      try {
        var UQ = window.SDMusicUnifiedQueue;
        if (UQ && typeof UQ.startFromSource === "function" && L && typeof L.playTracks === "function") {
          await L.playTracks(tracks, seed.videoId, "home");
        }
      } catch (e3) {}
    }

    function openArtist(item) {
      if (!item) return;
      try {
        if (window.SDMusic) window.SDMusic.setTab("listen", { pushUrl: true });
        if (window.StepDaddyMusicListen && typeof window.StepDaddyMusicListen.openArtistItem === "function") {
          window.StepDaddyMusicListen.openArtistItem(item);
          return;
        }
        var channel = item.browseId || item.channelId || "";
        if (channel && String(channel).indexOf("MPRE") === 0) channel = "";
        if (channel && window.StepDaddyMusicListen && window.StepDaddyMusicListen.openArtist) {
          window.StepDaddyMusicListen.openArtist(channel, item.title);
          return;
        }
        if (window.StepDaddyMusicListen && window.StepDaddyMusicListen.openSearch) {
          window.StepDaddyMusicListen.openSearch(item._q || item.title || "");
        }
      } catch (err) {}
    }

    async function playRadioStation(st) {
      if (!st) return;
      if (window.StepDaddyMusicRadio && typeof window.StepDaddyMusicRadio.playStation === "function") {
        return window.StepDaddyMusicRadio.playStation(st);
      }
      var P = player();
      if (!P || !st.stream_url) return;
      await P.play({
        source: "radio",
        id: st.stationuuid || st.id,
        title: st.display_name || st.name || st.title || "Station",
        subtitle: [st.city, st.state, st.band, st.genre].filter(Boolean).join(" · "),
        artwork: st.favicon || st.artwork || "",
        streamUrl: st.stream_url,
        hls: !!st.hls,
        station: st,
        genre: st.genre || "",
      });
    }

    function openItem(item, shelfItems) {
      if (!item) return;
      if (item.kind === "search_artist" && item._q) {
        openArtist(item);
        return;
      }
      if (item.source === "radio" || item.kind === "station" || item.stationuuid) {
        playRadioStation(item.station || item);
        return;
      }
      playListenItem(item, shelfItems);
    }

    function goListen(action, arg) {
      try {
        if (window.SDMusic) window.SDMusic.setTab("listen", { pushUrl: true });
        var L = window.StepDaddyMusicListen;
        if (!L) return;
        if (action === "library" && L.openLibrary) return L.openLibrary(arg);
        if (action === "artists" && L.openArtistsDirectory) return L.openArtistsDirectory();
        if (action === "albums" && L.openAlbumsDirectory) return L.openAlbumsDirectory();
        if (action === "playlists" && L.openPlaylistsDirectory) return L.openPlaylistsDirectory();
        if (action === "liked" && L.openLibrary) return L.openLibrary("liked");
        if (action === "saved" && L.openLibrary) return L.openLibrary("saved");
      } catch (e) {}
    }

    function libraryCounts() {
      var out = { liked: 0, playlists: 0, artists: 0, albums: 0, saved: 0 };
      try {
        var Lib = window.SDMusicLibrary;
        if (!Lib || typeof Lib.snapshot !== "function") return out;
        var snap = Lib.snapshot() || {};
        out.liked = (snap.liked && snap.liked.length) || 0;
        out.playlists = (snap.playlists && snap.playlists.length) || 0;
        out.artists = (snap.artists && snap.artists.length) || 0;
        out.albums = (snap.albums && snap.albums.length) || 0;
        out.saved =
          ((snap.stations && snap.stations.length) || 0) +
          ((snap.albums && snap.albums.length) || 0);
      } catch (e) {}
      return out;
    }

    /** Compact Spotify/Apple-style library entry — 2×N tiles + See all. */
    function renderLibraryStrip() {
      var counts = libraryCounts();
      var tiles = [
        { id: "liked", label: "Liked", count: counts.liked, tone: "liked" },
        { id: "playlists", label: "Playlists", count: counts.playlists, tone: "playlists" },
        { id: "artists", label: "Artists", count: counts.artists, tone: "artists" },
        { id: "albums", label: "Albums", count: counts.albums, tone: "albums" },
        { id: "saved", label: "Saved", count: counts.saved, tone: "saved" },
      ];
      var wrap = document.createElement("div");
      wrap.className = "mh-section mh-lib-strip mh-primary";
      wrap.setAttribute("data-mh-focus", "library");
      wrap.innerHTML =
        '<div class="mh-lib-strip-head">' +
        "<h3>Library</h3>" +
        '<button type="button" class="ml-see-all" data-mh-lib-all>See all ›</button>' +
        "</div>" +
        '<div class="mh-lib-grid" role="list">' +
        tiles
          .map(function (t) {
            return (
              '<button type="button" class="mh-lib-tile tone-' +
              t.tone +
              '" data-mh-lib-tile="' +
              t.id +
              '" role="listitem">' +
              '<span class="mh-lib-tile-ico" aria-hidden="true"></span>' +
              '<span class="mh-lib-tile-meta"><span class="n">' +
              esc(t.label) +
              '</span><span class="c">' +
              (t.count ? esc(String(t.count)) : "—") +
              "</span></span></button>"
            );
          })
          .join("") +
        "</div>";
      var seeAll = wrap.querySelector("[data-mh-lib-all]");
      if (seeAll) {
        seeAll.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          goListen("library");
        });
      }
      wrap.querySelectorAll("[data-mh-lib-tile]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          var id = btn.getAttribute("data-mh-lib-tile");
          if (id === "artists") goListen("artists");
          else if (id === "albums") goListen("albums");
          else if (id === "playlists") goListen("playlists");
          else if (id === "liked") goListen("liked");
          else if (id === "saved") goListen("saved");
          else goListen("library");
        });
      });
      return wrap;
    }

    function renderHero(item) {
      if (!item) return null;
      var sec = document.createElement("div");
      sec.className = "mh-hero";
      var title = item.title || item.display_name || item.name || "Play something";
      var sub = subtitleOf(item) || (item.source === "radio" ? "Radio near you" : "Made for you");
      sec.innerHTML =
        artHtml(item, "mh-hero-art") +
        '<div class="mh-hero-copy"><div class="mh-hero-kicker">Featured</div>' +
        '<div class="mh-hero-title">' +
        esc(title) +
        '</div><div class="mh-hero-sub">' +
        esc(sub) +
        '</div><button type="button" class="mh-hero-play">Play</button></div>';
      sec.querySelector(".mh-hero-play").addEventListener("click", function () {
        openItem(item);
      });
      sec.addEventListener("click", function (e) {
        if (e.target.closest(".mh-hero-play")) return;
        openItem(item);
      });
      return sec;
    }

    function renderShelf(title, items, opts) {
      opts = opts || {};
      items = dedupeItems((items || []).filter(Boolean));
      if (!items.length) return null;
      var lim = opts.limit != null ? opts.limit : items.length;
      items = items.slice(0, lim);
      var sec = document.createElement("div");
      sec.className =
        "mh-section" +
        (opts.dense ? " dense" : "") +
        (opts.compact ? " mh-compact" : "") +
        (opts.primary ? " mh-primary" : "") +
        (opts.artists ? " mh-artists" : "");
      if (opts.focusKey) sec.setAttribute("data-mh-focus", opts.focusKey);
      sec.innerHTML = "<h3>" + esc(title) + "</h3>";
      var scroll = document.createElement("div");
      scroll.className = "mh-scroll";
      items.forEach(function (item) {
        var btn = document.createElement("div");
        btn.setAttribute("role", "button");
        btn.tabIndex = 0;
        var isRadio = item.source === "radio" || item.kind === "station";
        var isArtist = item.kind === "artist" || item.kind === "search_artist";
        btn.className = "mh-card" + (isRadio ? " radio" : "") + (isArtist ? " artist" : "");
        var Lib = window.SDMusicLibrary;
        var plus = Lib && Lib.addBtnHtml ? Lib.addBtnHtml("mh-add") : "";
        var more =
          Lib && Lib.moreBtnHtml && Lib.isPlayableTrack && Lib.isPlayableTrack(item) ? Lib.moreBtnHtml() : "";
        var chrome = more ? '<span class="ml-actions">' + plus + more + "</span>" : plus;
        btn.innerHTML =
          '<span class="mh-card-art-wrap">' +
          artHtml(item) +
          chrome +
          "</span>" +
          '<span class="n">' +
          esc(item.title || item.display_name || item.name || "Item") +
          '</span><span class="c">' +
          esc(subtitleOf(item)) +
          "</span>";
        function open() {
          openItem(item, items);
        }
        btn.addEventListener("click", function (e) {
          if (e.target.closest("[data-ml-add], [data-ml-more]")) return;
          open();
        });
        btn.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        });
        if (Lib && Lib.wireRowActions) {
          Lib.wireRowActions(btn, item, { longPress: !!(Lib.isPlayableTrack && Lib.isPlayableTrack(item)) });
        } else if (Lib && Lib.wireAddButton) {
          var addBtn = btn.querySelector("[data-ml-add]");
          if (addBtn) Lib.wireAddButton(addBtn, item);
        }
        scroll.appendChild(btn);
      });
      sec.appendChild(scroll);
      try {
        if (window.SDShelfAxisLock) window.SDShelfAxisLock.wire(scroll, body);
      } catch (e) {}
      return sec;
    }

    function listenShelvesFromHome(home) {
      return ((home && home.shelves) || []).map(function (sh) {
        return {
          title: sh.title || "Shelf",
          items: (sh.items || []).map(function (it) {
            return Object.assign({}, it, { source: "listen" });
          }),
        };
      });
    }

    function renderArtistsSection(T, secOpts) {
      secOpts = secOpts || {};
      var A = Artists();
      if (!A) return null;
      var pool = A.buildPool(state.listenHome, state.artistsFeed, T);
      var items = A.sortPool(pool, state.artistMode, T, state.artistsFeed);
      if (!items.length) return null;

      var wrap = document.createElement("div");
      wrap.className =
        "mh-section mh-artists" +
        (secOpts.compact ? " mh-compact" : "") +
        (secOpts.primary ? " mh-primary" : "");
      wrap.setAttribute("data-mh-focus", "artists");
      wrap.innerHTML =
        "<h3>Artists</h3>" +
        '<div class="mh-sec-tools"><button type="button" class="ml-see-all" data-mh-artists-dir>Directory ›</button></div>' +
        '<div class="mh-seg" role="tablist" aria-label="Artist sort">' +
        A.MODES.map(function (m) {
          return (
            '<button type="button" class="mh-seg-btn' +
            (state.artistMode === m.id ? " on" : "") +
            '" data-mh-artist-mode="' +
            m.id +
            '" role="tab" aria-selected="' +
            (state.artistMode === m.id ? "true" : "false") +
            '">' +
            esc(m.label) +
            "</button>"
          );
        }).join("") +
        "</div>";

      var scroll = document.createElement("div");
      scroll.className = "mh-scroll";
      items.forEach(function (item) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mh-card artist";
        var Lib = window.SDMusicLibrary;
        var plus = Lib && Lib.addBtnHtml ? Lib.addBtnHtml("mh-add") : "";
        btn.innerHTML =
          '<span class="mh-card-art-wrap">' +
          artHtml(item) +
          plus +
          "</span>" +
          '<span class="n">' +
          esc(item.title) +
          '</span><span class="c">' +
          esc(subtitleOf(item)) +
          "</span>";
        btn.addEventListener("click", function (e) {
          if (e.target.closest("[data-ml-add]")) return;
          openArtist(item);
        });
        if (Lib && Lib.wireAddButton) {
          var addBtn = btn.querySelector("[data-ml-add]");
          if (addBtn) Lib.wireAddButton(addBtn, item);
        }
        scroll.appendChild(btn);
      });
      wrap.appendChild(scroll);

      var dirBtn = wrap.querySelector("[data-mh-artists-dir]");
      if (dirBtn) {
        dirBtn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          try {
            if (window.SDMusic) window.SDMusic.setTab("listen", { pushUrl: true });
            if (window.StepDaddyMusicListen && window.StepDaddyMusicListen.openArtistsDirectory) {
              window.StepDaddyMusicListen.openArtistsDirectory();
            }
          } catch (err) {}
        });
      }

      wrap.querySelector(".mh-seg").addEventListener("click", function (e) {
        var b = e.target.closest("[data-mh-artist-mode]");
        if (!b) return;
        state.artistMode = b.getAttribute("data-mh-artist-mode") || "recommended";
        A.writeMode(state.artistMode);
        render();
      });

      try {
        if (window.SDShelfAxisLock) window.SDShelfAxisLock.wire(scroll, body);
      } catch (e) {}
      return wrap;
    }

    function buildRadioBuckets(radioHome, T) {
      var near = dedupeItems(
        ((radioHome && radioHome.near_you) || []).map(function (st) {
          return asRadioCard(st);
        }).filter(Boolean)
      );
      var commercial = dedupeItems(
        ((radioHome && radioHome.commercial_preview) || []).map(function (st) {
          return asRadioCard(st, "Commercial · " + (st.genre || st.city || ""));
        }).filter(Boolean)
      );
      var internet = dedupeItems(
        ((radioHome && radioHome.internet_preview) || []).map(function (st) {
          return asRadioCard(st, "Internet · " + (st.genre || ""));
        }).filter(Boolean)
      );
      var pooled = dedupeItems(near.concat(commercial).concat(internet));
      var am = pooled.filter(function (it) {
        return String(it.band || (it.station && it.station.band) || "").toUpperCase() === "AM";
      });
      var fm = pooled.filter(function (it) {
        return String(it.band || (it.station && it.station.band) || "").toUpperCase() === "FM";
      });
      var favorites = [];
      if (T && T.getLikes) {
        favorites = dedupeItems(
          T.getLikes(36)
            .filter(function (it) {
              return it && (it.source === "radio" || it.kind === "station" || it.stationuuid);
            })
            .map(function (it) {
              return asRadioCard(it.station || it, it.subtitle || "Favorite");
            })
            .filter(Boolean)
        );
      }
      var topG = T && T.topGenres ? T.topGenres(8) : [];
      var gnames = topG.map(function (g) {
        return String(g.name || g).toLowerCase();
      });
      var genre = pooled.filter(function (it) {
        var g = String(it.genre || "").toLowerCase();
        if (!g) return false;
        if (!gnames.length) return true;
        return gnames.some(function (name) {
          return g.indexOf(name) >= 0 || name.indexOf(g) >= 0;
        });
      });
      if (!genre.length && pooled.length) {
        // Cold: prefer stations that have any genre tag.
        genre = pooled.filter(function (it) {
          return !!(it.genre || "").trim();
        });
      }
      var buckets = {
        near: near,
        commercial: commercial,
        internet: internet,
        am: am,
        fm: fm,
        favorites: favorites,
        genre: genre,
      };
      if (T && T.hasSignal && T.hasSignal()) {
        Object.keys(buckets).forEach(function (k) {
          if (buckets[k].length) buckets[k] = T.rankItems(buckets[k]);
        });
      }
      return buckets;
    }

    function renderRadioSection(T, secOpts) {
      secOpts = secOpts || {};
      var buckets = buildRadioBuckets(state.radioHome, T);
      var modes = RADIO_MODES.filter(function (m) {
        return (buckets[m.id] || []).length > 0;
      });
      if (!modes.length) return null;
      if (!modes.some(function (m) { return m.id === state.radioMode; })) {
        state.radioMode = modes[0].id;
        writeRadioMode(state.radioMode);
      }
      var items = buckets[state.radioMode] || [];
      if (!items.length) return null;

      var wrap = document.createElement("div");
      wrap.className =
        "mh-section mh-radio" +
        (secOpts.compact ? " mh-compact" : "") +
        (secOpts.primary ? " mh-primary" : "");
      wrap.setAttribute("data-mh-focus", "near");
      wrap.innerHTML =
        "<h3>Radio</h3>" +
        '<div class="mh-seg" role="tablist" aria-label="Radio category">' +
        modes
          .map(function (m) {
            return (
              '<button type="button" class="mh-seg-btn' +
              (state.radioMode === m.id ? " on" : "") +
              '" data-mh-radio-mode="' +
              m.id +
              '" role="tab" aria-selected="' +
              (state.radioMode === m.id ? "true" : "false") +
              '">' +
              esc(m.label) +
              "</button>"
            );
          })
          .join("") +
        "</div>";

      var lim = secOpts.limit != null ? secOpts.limit : 18;
      items = items.slice(0, lim);
      var scroll = document.createElement("div");
      scroll.className = "mh-scroll";
      items.forEach(function (item) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mh-card radio";
        var Lib = window.SDMusicLibrary;
        var plus = Lib && Lib.addBtnHtml ? Lib.addBtnHtml("mh-add") : "";
        btn.innerHTML =
          '<span class="mh-card-art-wrap">' +
          artHtml(item) +
          plus +
          "</span>" +
          '<span class="n">' +
          esc(item.title || item.display_name || item.name || "Station") +
          '</span><span class="c">' +
          esc(subtitleOf(item)) +
          "</span>";
        btn.addEventListener("click", function (e) {
          if (e.target.closest("[data-ml-add]")) return;
          openItem(item, items);
        });
        if (Lib && Lib.wireAddButton) {
          var addBtn = btn.querySelector("[data-ml-add]");
          if (addBtn) Lib.wireAddButton(addBtn, Object.assign({}, item, { kind: "station" }));
        }
        scroll.appendChild(btn);
      });
      wrap.appendChild(scroll);

      wrap.querySelector(".mh-seg").addEventListener("click", function (e) {
        var b = e.target.closest("[data-mh-radio-mode]");
        if (!b) return;
        state.radioMode = b.getAttribute("data-mh-radio-mode") || "near";
        writeRadioMode(state.radioMode);
        render();
      });

      try {
        if (window.SDShelfAxisLock) window.SDShelfAxisLock.wire(scroll, body);
      } catch (e) {}
      return wrap;
    }

    function filterLibraryItems(items, focus) {
      var list = (items || []).slice();
      if (focus === "station") {
        return list.filter(function (it) {
          return it && (it.source === "radio" || it.kind === "station" || it.stationuuid);
        });
      }
      if (focus === "track") {
        return list.filter(function (it) {
          return it && it.source !== "radio" && it.kind !== "station";
        });
      }
      if (focus === "artist") {
        return list.filter(function (it) {
          return it && (it.kind === "artist" || it.kind === "search_artist" || it.browseId);
        });
      }
      if (focus === "album") {
        return list.filter(function (it) {
          return it && (it.kind === "album" || it.browseId);
        });
      }
      if (focus === "playlist") {
        return list.filter(function (it) {
          return it && (it.kind === "playlist" || it.playlistId);
        });
      }
      if (focus === "video") {
        return list.filter(function (it) {
          return it && (it.kind === "video" || it.videoId);
        });
      }
      return list;
    }

    function buildLibraryBuckets(T, focus) {
      var recent = filterLibraryItems(dedupeItems(T ? T.getRecent(18) : []), focus);
      var liked = filterLibraryItems(dedupeItems(T ? T.getLikes(18) : []), focus);
      var favorites = [];
      try {
        var Lib = window.SDMusicLibrary;
        if (Lib && typeof Lib.read === "function") {
          favorites = filterLibraryItems(
            dedupeItems((Lib.read().liked || []).map(function (t) {
              return Object.assign({}, t, { source: t.source || "listen", kind: t.kind || "song" });
            })),
            focus
          );
        }
      } catch (e) {}
      // Favorites chip only when library likes are distinct from taste/radio likes.
      var likedKeys = {};
      liked.forEach(function (it) {
        var k = stableKey(it);
        if (k) likedKeys[k] = true;
      });
      var distinctFav = favorites.filter(function (it) {
        var k = stableKey(it);
        return k ? !likedKeys[k] : true;
      });
      return {
        recent: recent,
        liked: liked,
        favorites: distinctFav,
      };
    }

    function renderLibrarySection(T, secOpts) {
      secOpts = secOpts || {};
      var F = focusApi();
      var focus = F ? F.get() : "all";
      var buckets = buildLibraryBuckets(T, focus);
      var modes = LIBRARY_MODES.filter(function (m) {
        return (buckets[m.id] || []).length > 0;
      });
      if (!modes.length) return null;
      if (!modes.some(function (m) { return m.id === state.libraryMode; })) {
        state.libraryMode = modes[0].id;
        writeLibraryMode(state.libraryMode);
      }
      var items = buckets[state.libraryMode] || [];
      if (!items.length) return null;

      var wrap = document.createElement("div");
      wrap.className =
        "mh-section mh-library" +
        (secOpts.compact ? " mh-compact" : "") +
        (secOpts.primary ? " mh-primary" : "") +
        " dense";
      wrap.setAttribute("data-mh-focus", "recent");
      wrap.innerHTML =
        "<h3>Your music</h3>" +
        '<div class="mh-seg" role="tablist" aria-label="Your music category">' +
        modes
          .map(function (m) {
            return (
              '<button type="button" class="mh-seg-btn' +
              (state.libraryMode === m.id ? " on" : "") +
              '" data-mh-library-mode="' +
              m.id +
              '" role="tab" aria-selected="' +
              (state.libraryMode === m.id ? "true" : "false") +
              '">' +
              esc(m.label) +
              "</button>"
            );
          })
          .join("") +
        "</div>";

      var lim = secOpts.limit != null ? secOpts.limit : 18;
      items = items.slice(0, lim);
      var scroll = document.createElement("div");
      scroll.className = "mh-scroll";
      items.forEach(function (item) {
        var btn = document.createElement("div");
        btn.setAttribute("role", "button");
        btn.tabIndex = 0;
        var isRadio = item.source === "radio" || item.kind === "station";
        var isArtist = item.kind === "artist" || item.kind === "search_artist";
        btn.className = "mh-card" + (isRadio ? " radio" : "") + (isArtist ? " artist" : "");
        var Lib = window.SDMusicLibrary;
        var plus = Lib && Lib.addBtnHtml ? Lib.addBtnHtml("mh-add") : "";
        var more =
          Lib && Lib.moreBtnHtml && Lib.isPlayableTrack && Lib.isPlayableTrack(item) ? Lib.moreBtnHtml() : "";
        var chrome = more ? '<span class="ml-actions">' + plus + more + "</span>" : plus;
        btn.innerHTML =
          '<span class="mh-card-art-wrap">' +
          artHtml(item) +
          chrome +
          "</span>" +
          '<span class="n">' +
          esc(item.title || item.display_name || item.name || "Item") +
          '</span><span class="c">' +
          esc(subtitleOf(item)) +
          "</span>";
        function open() {
          openItem(item, items);
        }
        btn.addEventListener("click", function (e) {
          if (e.target.closest("[data-ml-add], [data-ml-more]")) return;
          open();
        });
        btn.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        });
        if (Lib && Lib.wireRowActions) {
          Lib.wireRowActions(btn, item, { longPress: !!(Lib.isPlayableTrack && Lib.isPlayableTrack(item)) });
        } else if (Lib && Lib.wireAddButton) {
          var addBtn = btn.querySelector("[data-ml-add]");
          if (addBtn) Lib.wireAddButton(addBtn, item);
        }
        scroll.appendChild(btn);
      });
      wrap.appendChild(scroll);

      wrap.querySelector(".mh-seg").addEventListener("click", function (e) {
        var b = e.target.closest("[data-mh-library-mode]");
        if (!b) return;
        state.libraryMode = b.getAttribute("data-mh-library-mode") || "recent";
        writeLibraryMode(state.libraryMode);
        render();
      });

      try {
        if (window.SDShelfAxisLock) window.SDShelfAxisLock.wire(scroll, body);
      } catch (e) {}
      return wrap;
    }

    function pickHero(radioHome, listenHome, T) {
      var F = focusApi();
      var focus = F ? F.get() : "all";
      if (focus === "station") {
        var near0 = (radioHome && radioHome.near_you) || [];
        if (near0.length) {
          var st0 = near0[0];
          return {
            source: "radio",
            kind: "station",
            id: st0.stationuuid,
            title: st0.display_name || st0.name,
            subtitle: [st0.city, st0.genre].filter(Boolean).join(" · "),
            artwork: st0.favicon,
            station: st0,
            genre: st0.genre,
          };
        }
      }
      var likes = T ? T.getLikes(1) : [];
      if (likes.length && focus !== "station") return likes[0];
      var recent = T ? T.getRecent(1) : [];
      if (recent.length) return recent[0];
      var near = (radioHome && radioHome.near_you) || [];
      if (near.length) {
        var st = near[0];
        return {
          source: "radio",
          kind: "station",
          id: st.stationuuid,
          title: st.display_name || st.name,
          subtitle: [st.city, st.genre].filter(Boolean).join(" · "),
          artwork: st.favicon,
          station: st,
          genre: st.genre,
        };
      }
      var shelves = listenShelvesFromHome(listenHome);
      for (var i = 0; i < shelves.length; i++) {
        var songs = (shelves[i].items || []).filter(function (x) {
          return x.videoId || x.kind === "song";
        });
        if (songs.length) return songs[0];
        if (shelves[i].items && shelves[i].items[0]) return shelves[i].items[0];
      }
      return null;
    }

    function madeForYou(radioHome, listenHome, T, excludeKeys) {
      if (!T || !T.hasSignal()) return [];
      var pool = [];
      ((radioHome && radioHome.near_you) || []).forEach(function (st) {
        pool.push(asRadioCard(st, st.genre || st.city || "Radio"));
      });
      listenShelvesFromHome(listenHome).forEach(function (sh) {
        (sh.items || []).forEach(function (it) {
          pool.push(it);
        });
      });
      // Do not inject Recently played cards into the pool — taste scoring already
      // uses play history; adding them duplicated the Recent shelf.
      var ranked = T.rankItems(dedupeItems(pool), { entryPath: "home", softBoost: true });
      var block = excludeKeys || {};
      return ranked
        .filter(function (it) {
          var k = stableKey(it);
          return !k || !block[k];
        })
        .slice(0, 16);
    }

    function filterShelfForFocus(items, kindHint) {
      var F = focusApi();
      var focus = F ? F.get() : "all";
      if (focus === "all" || !items || !items.length) return items;
      if (focus === "station") {
        return items.filter(function (it) {
          return it.source === "radio" || it.kind === "station" || it.stationuuid;
        });
      }
      if (focus === "artist") {
        return items.filter(function (it) {
          return it.kind === "artist" || it.kind === "search_artist";
        });
      }
      if (focus === "album") {
        return items.filter(function (it) {
          return it.kind === "album" || kindHint === "album";
        });
      }
      if (focus === "track") {
        return items.filter(function (it) {
          return it.kind === "song" || it.kind === "track" || it.videoId;
        });
      }
      if (focus === "playlist") {
        return items.filter(function (it) {
          return it.kind === "playlist" || it.kind === "mood" || it.playlistId;
        });
      }
      if (focus === "video") {
        return items.filter(function (it) {
          return it.kind === "video";
        });
      }
      return items;
    }

    async function loadData() {
      var C = radioCache();
      var geo = C && C.geoParams ? C.geoParams() : {};
      var radioP = radioApi("/home", geo).catch(function () {
        return null;
      });
      var listenCached = C && C.getListenHomeCached ? C.getListenHomeCached() : null;
      var listenP = listenCached
        ? Promise.resolve(listenCached)
        : listenApi("/home").catch(function () {
            return null;
          });
      var artistsP = listenApi("/artists", { limit: 24 }).catch(function () {
        return null;
      });
      var trio = await Promise.all([radioP, listenP, artistsP]);
      state.radioHome = trio[0];
      state.listenHome = trio[1];
      state.artistsFeed = trio[2];
      if (trio[1] && C && C.put) C.put("listen:/home", trio[1], 5 * 60 * 1000);
    }

    function render() {
      body.innerHTML = "";
      var T = taste();
      var F = focusApi();
      var focus = F ? F.get() : "all";
      var cold = !(T && T.hasSignal());
      var focusLabel = F ? F.label(focus) : "For you";
      setSub(
        (cold ? "Discover" : "Made for you") +
          " · " +
          focusLabel +
          (focus === "all" ? " · on this device" : " focus")
      );

      var baseOrder = T
        ? T.shelfOrder(cold)
        : ["library", "hero", "near", "trending", "featured"];
      var order = F ? F.shelfOrder(baseOrder, cold) : baseOrder.concat(["artists"]);
      // Drop legacy stacked radio / likes rows — consolidated into chip shelves.
      order = order.filter(function (k) {
        return k !== "radio" && k !== "likes";
      });
      // Compact Library strip always first.
      order = ["library"].concat(
        order.filter(function (k) {
          return k !== "library";
        })
      );
      // Ensure single library shelf key (`recent` owns Recent|Liked|Favorites).
      var seenLib = false;
      order = order.filter(function (k) {
        if (k === "recent") {
          if (seenLib) return false;
          seenLib = true;
        }
        return true;
      });
      var listenShelves = listenShelvesFromHome(state.listenHome);
      var trending = listenShelves.find(function (s) {
        return /chart|trend|popular|hit|top|video/i.test(s.title || "");
      });
      var moods = listenShelves.find(function (s) {
        return /mood|genre/i.test(s.title || "");
      });
      var featured = listenShelves.filter(function (s) {
        return s !== trending && s !== moods && !/trending artists/i.test(s.title || "");
      });
      if (focus === "album") {
        featured = listenShelves
          .filter(function (s) {
            return /album|release|new/i.test(s.title || "") || (s.items || []).some(function (i) {
              return i.kind === "album";
            });
          })
          .concat(featured);
      }
      if (focus === "playlist") {
        featured = listenShelves
          .filter(function (s) {
            return /playlist|essential|vibe|community/i.test(s.title || "");
          })
          .concat(featured);
      }
      if (focus === "video") {
        trending =
          listenShelves.find(function (s) {
            return /video/i.test(s.title || "");
          }) || trending;
      }

      var recentItems = dedupeItems(T ? T.getRecent(18) : []);
      var recentKeyMap = {};
      recentItems.forEach(function (r) {
        var k = stableKey(r);
        if (k) recentKeyMap[k] = true;
      });

      function optsFor(key) {
        var o = F && F.sectionOpts ? F.sectionOpts(key) : { primary: false, compact: false, limit: 18 };
        return Object.assign({ focusKey: key }, o);
      }

      var sections = {
        library: function () {
          return renderLibraryStrip();
        },
        hero: function () {
          return renderHero(pickHero(state.radioHome, state.listenHome, T));
        },
        made: function () {
          var o = optsFor("made");
          var items = madeForYou(state.radioHome, state.listenHome, T, recentKeyMap);
          if (focus === "station") {
            items = items.filter(function (it) {
              return it.source === "radio" || it.kind === "station";
            });
          } else if (focus !== "all") {
            var filtered = filterShelfForFocus(items);
            if (filtered.length) items = filtered;
          }
          return renderShelf("Made for you", items, o);
        },
        recent: function () {
          return renderLibrarySection(T, optsFor("recent"));
        },
        likes: function () {
          // Legacy key — consolidated into Your music chip shelf under `recent`.
          return null;
        },
        near: function () {
          return renderRadioSection(T, optsFor("near"));
        },
        artists: function () {
          return renderArtistsSection(T, optsFor("artists"));
        },
        trending: function () {
          var o = optsFor("trending");
          var items = dedupeItems((trending && trending.items) || []);
          if (T && T.hasSignal()) items = T.rankItems(items);
          if (focus !== "all") {
            var f = filterShelfForFocus(items);
            if (f.length) items = f;
          }
          return renderShelf(trending ? trending.title : "Trending", items, o);
        },
        charts: function () {
          // Legacy key — redirect to artists section
          return renderArtistsSection(T, optsFor("artists"));
        },
        featured: function () {
          var o = optsFor("featured");
          var frag = document.createDocumentFragment();
          var seen = {};
          featured.slice(0, o.compact ? 2 : 4).forEach(function (sh) {
            if (seen[sh.title]) return;
            seen[sh.title] = true;
            var items = dedupeItems(sh.items || []);
            if (T && T.hasSignal()) items = T.rankItems(items);
            if (focus === "album") {
              items = items.filter(function (it) {
                return it.kind === "album" || it.browseId;
              });
            } else if (focus === "playlist") {
              items = items.filter(function (it) {
                return it.kind === "playlist" || it.kind === "mood" || it.playlistId;
              });
            } else if (focus === "video") {
              items = items.filter(function (it) {
                return it.kind === "video" || /video/i.test(sh.title || "");
              });
            } else if (focus === "station") {
              return;
            }
            var el = renderShelf(sh.title, items, Object.assign({}, o, { limit: o.limit || 16 }));
            if (el) frag.appendChild(el);
          });
          return frag.childNodes.length ? frag : null;
        },
        moods: function () {
          if (focus === "station") return null;
          return moods ? renderShelf(moods.title, moods.items, optsFor("moods")) : null;
        },
        radio: function () {
          // Legacy key — Radio is the chip shelf under `near`.
          return null;
        },
      };

      var any = false;
      order.forEach(function (key) {
        var fn = sections[key];
        if (!fn) return;
        var el = fn();
        if (!el) return;
        any = true;
        if (el.nodeType === 11) body.appendChild(el);
        else body.appendChild(el);
      });

      if (!any) {
        body.innerHTML =
          '<div class="mh-empty">Nothing yet — open Radio or Listen, or search above.</div>';
      }

      var jumps = document.createElement("div");
      jumps.className = "mh-jumps";
      jumps.innerHTML =
        '<button type="button" data-mh-go="radio">Browse Radio</button>' +
        '<button type="button" data-mh-go="listen">Browse Listen</button>';
      jumps.addEventListener("click", function (e) {
        var b = e.target.closest("[data-mh-go]");
        if (!b || !window.SDMusic) return;
        window.SDMusic.setTab(b.getAttribute("data-mh-go"), { pushUrl: true });
      });
      body.appendChild(jumps);

      container.dataset.mhFocus = focus;
    }

    async function refresh() {
      if (state.loading) return;
      state.loading = true;
      body.innerHTML = '<div class="mh-loading">Building your Home…</div>';
      try {
        await loadData();
        render();
      } catch (e) {
        body.innerHTML = '<div class="mh-err">Couldn’t load Home right now.</div>';
      } finally {
        state.loading = false;
      }
    }

    this.refresh = refresh;
    this.render = render;
    this.destroy = function () {
      if (unsubFocus) try { unsubFocus(); } catch (e) {}
      container.innerHTML = "";
    };

    var F0 = focusApi();
    if (F0 && F0.subscribe) {
      unsubFocus = F0.subscribe(function () {
        if (!state.loading) render();
      });
    } else {
      window.addEventListener("sd-music-focus", function () {
        if (!state.loading) render();
      });
    }

    refresh();
  }

  var lastMount = null;
  function mount(el, opts) {
    if (!el) throw new Error("music_home_mount_missing_el");
    lastMount = new Mount(el, opts || {});
    return lastMount;
  }

  window.StepDaddyMusicHome = {
    mount: mount,
    refresh: function () {
      if (lastMount) return lastMount.refresh();
    },
    render: function () {
      if (lastMount && lastMount.render) return lastMount.render();
    },
  };
})();
