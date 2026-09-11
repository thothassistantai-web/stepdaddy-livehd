/**
 * StepDaddy Music — entity directories (tracks / albums / playlists / videos).
 * Artists stay in music_artists.js. API: window.SDMusicDirectories
 */
(function () {
  if (window.SDMusicDirectories) return;

  var LETTERS = [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    "W",
    "X",
    "Y",
    "Z",
    "#",
  ];

  var KINDS = {
    track: {
      api: "/api/music/listen/tracks/directory",
      label: "Tracks",
      empty: "No tracks in this slice — try Trending or search.",
      loading: "Loading tracks…",
      err: "Couldn’t load tracks directory.",
      sorts: [
        { id: "hot", label: "Trending" },
        { id: "name", label: "A–Z" },
        { id: "name_desc", label: "Z–A" },
      ],
      defaultSort: "hot",
      square: true,
      lsSort: "sd_music_tracks_dir_sort_v1",
      lsLetter: "sd_music_tracks_dir_letter_v1",
    },
    album: {
      api: "/api/music/listen/albums/directory",
      label: "Albums",
      empty: "No albums here yet — try All or Trending.",
      loading: "Loading albums…",
      err: "Couldn’t load albums directory.",
      sorts: [
        { id: "hot", label: "Trending" },
        { id: "name", label: "A–Z" },
        { id: "name_desc", label: "Z–A" },
      ],
      defaultSort: "hot",
      square: true,
      lsSort: "sd_music_albums_dir_sort_v1",
      lsLetter: "sd_music_albums_dir_letter_v1",
    },
    playlist: {
      api: "/api/music/listen/playlists/directory",
      label: "Playlists",
      empty: "No playlists yet — try Trending or Your library.",
      loading: "Loading playlists…",
      err: "Couldn’t load playlists directory.",
      sorts: [
        { id: "hot", label: "Discover" },
        { id: "name", label: "A–Z" },
        { id: "name_desc", label: "Z–A" },
      ],
      defaultSort: "hot",
      square: true,
      lsSort: "sd_music_playlists_dir_sort_v1",
      lsLetter: "sd_music_playlists_dir_letter_v1",
      mergeUser: true,
    },
    video: {
      api: "/api/music/listen/videos/directory",
      label: "Videos",
      empty: "No videos in this slice — try Trending.",
      loading: "Loading videos…",
      err: "Couldn’t load videos directory.",
      sorts: [
        { id: "hot", label: "Trending" },
        { id: "name", label: "A–Z" },
        { id: "name_desc", label: "Z–A" },
      ],
      defaultSort: "hot",
      square: true,
      lsSort: "sd_music_videos_dir_sort_v1",
      lsLetter: "sd_music_videos_dir_letter_v1",
    },
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readLS(key, fallback) {
    try {
      var s = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (s != null && s !== "") return s;
    } catch (e) {}
    return fallback;
  }

  function writeLS(key, val) {
    try {
      sessionStorage.setItem(key, val);
      localStorage.setItem(key, val);
    } catch (e) {}
  }

  function fetchDirectory(kind, params) {
    params = params || {};
    var cfg = KINDS[kind];
    if (!cfg) return Promise.reject(new Error("unknown_kind"));
    var u = new URLSearchParams();
    if (params.letter) u.set("letter", params.letter);
    if (params.sort) u.set("sort", params.sort);
    u.set("limit", String(params.limit != null ? params.limit : 80));
    u.set("offset", String(params.offset != null ? params.offset : 0));
    if (params.q) u.set("q", params.q);
    return fetch(cfg.api + "?" + u.toString(), { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error(kind + "_directory_" + r.status);
      return r.json();
    });
  }

  function userPlaylistsAsItems(q) {
    var Lib = window.SDMusicLibrary;
    if (!Lib) return [];
    var st =
      (typeof Lib.read === "function" && Lib.read()) ||
      (typeof Lib.getState === "function" && Lib.getState()) ||
      {};
    var qn = String(q || "")
      .trim()
      .toLowerCase();
    return (st.playlists || [])
      .filter(function (p) {
        if (!p || !p.id) return false;
        if (!qn) return true;
        return String(p.title || "")
          .toLowerCase()
          .indexOf(qn) >= 0;
      })
      .map(function (p) {
        var vis =
          p.visibility === "public"
            ? "Public"
            : p.collaborative
              ? "Collaborative"
              : p.listeningParty
                ? "Listening party"
                : "Yours";
        return {
          kind: "playlist",
          title: p.title || "Playlist",
          subtitle: vis + " · " + ((p.tracks && p.tracks.length) || 0) + " tracks",
          playlistId: null,
          playlistLocalId: p.id,
          thumb: (p.tracks && p.tracks[0] && (p.tracks[0].thumb || p.tracks[0].artwork)) || "",
          artwork: "",
          letter: (function () {
            var ch = String(p.title || "").trim().charAt(0).toUpperCase();
            return ch >= "A" && ch <= "Z" ? ch : "#";
          })(),
          _user: true,
          _hot: 5000,
        };
      });
  }

  /**
   * Render entity directory into hostEl.
   * opts: { kind, onOpen(item), state?: {sort, letter, q} }
   */
  function renderDirectory(hostEl, opts) {
    opts = opts || {};
    var kind = opts.kind || "track";
    var cfg = KINDS[kind];
    if (!hostEl || !cfg) return Promise.resolve(null);

    var state = {
      sort: (opts.state && opts.state.sort) || readLS(cfg.lsSort, cfg.defaultSort),
      letter: (opts.state && opts.state.letter) != null ? opts.state.letter : readLS(cfg.lsLetter, ""),
      q: (opts.state && opts.state.q) || "",
      loading: true,
    };
    if (!cfg.sorts.some(function (s) {
      return s.id === state.sort;
    })) {
      state.sort = cfg.defaultSort;
    }

    function paintShell() {
      hostEl.innerHTML =
        '<div class="ml-adir ml-edir" data-edir-kind="' +
        esc(kind) +
        '">' +
        '<form class="ml-adir-search" data-edir-search>' +
        '<input type="search" enterkeyhint="search" placeholder="Search ' +
        esc(cfg.label.toLowerCase()) +
        '…" data-edir-q aria-label="Search ' +
        esc(cfg.label) +
        '" autocomplete="off" value="' +
        esc(state.q) +
        '"/>' +
        '<button type="submit">Go</button>' +
        "</form>" +
        '<div class="mh-seg ml-adir-sort" role="tablist" aria-label="' +
        esc(cfg.label) +
        ' sort">' +
        cfg.sorts
          .map(function (m) {
            return (
              '<button type="button" class="mh-seg-btn' +
              (state.sort === m.id ? " on" : "") +
              '" data-edir-sort="' +
              m.id +
              '" role="tab" aria-selected="' +
              (state.sort === m.id ? "true" : "false") +
              '">' +
              esc(m.label) +
              "</button>"
            );
          })
          .join("") +
        "</div>" +
        '<div class="ml-adir-jump" role="navigation" aria-label="A to Z">' +
        '<button type="button" class="ml-adir-letter' +
        (!state.letter ? " on" : "") +
        '" data-edir-letter="">All</button>' +
        LETTERS.map(function (L) {
          return (
            '<button type="button" class="ml-adir-letter' +
            (state.letter === L ? " on" : "") +
            '" data-edir-letter="' +
            L +
            '">' +
            L +
            "</button>"
          );
        }).join("") +
        "</div>" +
        '<div class="ml-adir-body" data-edir-body><div class="ml-loading">' +
        esc(cfg.loading) +
        "</div></div>" +
        "</div>";

      hostEl.querySelector("[data-edir-search]").addEventListener("submit", function (e) {
        e.preventDefault();
        var input = hostEl.querySelector("[data-edir-q]");
        state.q = (input && input.value) || "";
        paintShell();
        load();
      });
      hostEl.querySelector(".ml-adir-sort").addEventListener("click", function (e) {
        var b = e.target.closest("[data-edir-sort]");
        if (!b) return;
        state.sort = b.getAttribute("data-edir-sort") || cfg.defaultSort;
        writeLS(cfg.lsSort, state.sort);
        paintShell();
        load();
      });
      hostEl.querySelector(".ml-adir-jump").addEventListener("click", function (e) {
        var b = e.target.closest("[data-edir-letter]");
        if (!b) return;
        state.letter = b.getAttribute("data-edir-letter") || "";
        writeLS(cfg.lsLetter, state.letter);
        paintShell();
        load();
      });
    }

    function groupByLetter(items) {
      var map = Object.create(null);
      var order = [];
      (items || []).forEach(function (it) {
        var L = it.letter || "#";
        if (!map[L]) {
          map[L] = [];
          order.push(L);
        }
        map[L].push(it);
      });
      if (!state.letter && state.sort === "name") {
        order = LETTERS.filter(function (L) {
          return map[L] && map[L].length;
        });
      }
      return { map: map, order: order };
    }

    function paintItems(data) {
      var body = hostEl.querySelector("[data-edir-body]");
      if (!body) return;
      var items = (data && data.items) || [];
      if (!items.length) {
        body.innerHTML = '<div class="ml-empty">' + esc(cfg.empty) + "</div>";
        return;
      }
      var grouped = groupByLetter(items);
      var html = "";
      var flat = [];
      grouped.order.forEach(function (L) {
        var list = grouped.map[L] || [];
        if (!list.length) return;
        html +=
          '<div class="ml-adir-section" data-letter="' +
          esc(L) +
          '"><h3>' +
          esc(L) +
          "</h3>";
        list.forEach(function (it) {
          flat.push(it);
          var thumb = it.thumb || it.artwork || "";
          var artClass = cfg.square ? "art sq" : "art";
          var Lib = window.SDMusicLibrary;
          var plus =
            Lib && typeof Lib.addBtnHtml === "function" && !it._user ? Lib.addBtnHtml("ml-adir-add") : "";
          var go = kind === "track" || kind === "video" ? "▶" : "›";
          html +=
            '<button type="button" class="ml-adir-row' +
            (cfg.square ? " sq" : "") +
            '" data-edir-open>' +
            (thumb
              ? '<img class="' +
                artClass +
                '" src="' +
                esc(thumb) +
                '" alt="" loading="lazy" referrerpolicy="no-referrer"/>'
              : '<span class="' + artClass + ' ml-adir-ph" aria-hidden="true"></span>') +
            '<span class="meta"><span class="n">' +
            esc(it.title || cfg.label) +
            '</span><span class="c">' +
            esc(it.subtitle || (it.artists && it.artists.join(", ")) || cfg.label) +
            "</span></span>" +
            '<span class="ml-adir-end">' +
            plus +
            '<span class="go" aria-hidden="true">' +
            go +
            "</span></span>" +
            "</button>";
        });
        html += "</div>";
      });
      if (data && data.has_more) {
        html +=
          '<button type="button" class="ml-lib-btn ml-adir-more" data-edir-more>Load more</button>';
      }
      body.innerHTML = html;
      var rows = body.querySelectorAll("[data-edir-open]");
      rows.forEach(function (row, idx) {
        var item = flat[idx];
        row.addEventListener("click", function (e) {
          if (e.target.closest("[data-ml-add]")) return;
          if (!item) return;
          if (typeof opts.onOpen === "function") opts.onOpen(item);
        });
        try {
          if (window.SDMusicLibrary && window.SDMusicLibrary.wireAddButton && item && !item._user) {
            var addBtn = row.querySelector("[data-ml-add]");
            if (addBtn) window.SDMusicLibrary.wireAddButton(addBtn, item);
          }
        } catch (e) {}
      });
      var more = body.querySelector("[data-edir-more]");
      if (more) {
        more.addEventListener("click", function () {
          load({
            offset: ((data && data.offset) || 0) + ((data && data.limit) || 80),
            append: true,
            prev: flat,
          });
        });
      }
    }

    function load(extra) {
      extra = extra || {};
      var body = hostEl.querySelector("[data-edir-body]");
      if (body && !extra.append) body.innerHTML = '<div class="ml-loading">' + esc(cfg.loading) + "</div>";
      return fetchDirectory(kind, {
        letter: state.letter || undefined,
        sort: state.sort,
        limit: extra.limit || 80,
        offset: extra.offset || 0,
        q: state.q || undefined,
      })
        .then(function (data) {
          var items = (data && data.items) || [];
          if (cfg.mergeUser && !extra.append) {
            var user = userPlaylistsAsItems(state.q);
            if (state.letter) {
              user = user.filter(function (u) {
                return u.letter === state.letter;
              });
            }
            // User first, then discover (dedupe by title).
            var seen = Object.create(null);
            var merged = [];
            user.concat(items).forEach(function (it) {
              var k = String(it.playlistLocalId || it.playlistId || it.title || "")
                .toLowerCase();
              if (!k || seen[k]) return;
              seen[k] = true;
              merged.push(it);
            });
            data.items = merged;
            data.total = merged.length;
          }
          if (extra.append && extra.prev) {
            data.items = (extra.prev || []).concat(data.items || []);
            data.offset = 0;
          }
          try {
            var counts = Object.create(null);
            ((data && data.letters) || []).forEach(function (L) {
              counts[L.id] = L.count || 0;
            });
            hostEl.querySelectorAll(".ml-adir-letter[data-edir-letter]").forEach(function (btn) {
              var id = btn.getAttribute("data-edir-letter");
              if (!id) return;
              btn.classList.toggle("empty", !(counts[id] > 0));
              btn.title = (counts[id] || 0) + " items";
            });
          } catch (e) {}
          paintItems(data);
          return data;
        })
        .catch(function () {
          if (body) body.innerHTML = '<div class="ml-err">' + esc(cfg.err) + "</div>";
        });
    }

    paintShell();
    return load();
  }

  window.SDMusicDirectories = {
    KINDS: KINDS,
    LETTERS: LETTERS,
    fetchDirectory: fetchDirectory,
    renderDirectory: renderDirectory,
  };
})();
