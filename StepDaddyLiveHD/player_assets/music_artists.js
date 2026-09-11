/**
 * StepDaddy Music — Artists directory helpers for Home.
 * Pool + sort modes: recent / genre / era / latest / hot / recommended.
 * API: window.SDMusicArtists
 */
(function () {
  if (window.SDMusicArtists) return;

  var MODES = [
    { id: "recent", label: "Recent" },
    { id: "genre", label: "Genre" },
    { id: "era", label: "Era" },
    { id: "latest", label: "Latest" },
    { id: "hot", label: "Hot" },
    { id: "recommended", label: "For you" },
  ];
  var LS_MODE = "sd_music_artists_mode_v1";

  function yearFromText(s) {
    var m = String(s || "").match(/\b(19|20)\d{2}\b/);
    return m ? Number(m[0]) : 0;
  }

  function decadeLabel(y) {
    if (!y || y < 1950) return "Classic";
    if (y < 1970) return "60s";
    if (y < 1980) return "70s";
    if (y < 1990) return "80s";
    if (y < 2000) return "90s";
    if (y < 2010) return "2000s";
    if (y < 2020) return "2010s";
    return "2020s";
  }

  function readMode() {
    try {
      var m = sessionStorage.getItem(LS_MODE) || localStorage.getItem(LS_MODE);
      if (m && MODES.some(function (x) { return x.id === m; })) return m;
    } catch (e) {}
    return "recommended";
  }

  function writeMode(mode) {
    try {
      sessionStorage.setItem(LS_MODE, mode);
      localStorage.setItem(LS_MODE, mode);
    } catch (e) {}
  }

  function asArtistCard(raw, fallbackSub) {
    if (!raw) return null;
    var title =
      raw.title ||
      raw.name ||
      (Array.isArray(raw.artists) && raw.artists[0]) ||
      raw.subtitle ||
      "";
    title = String(title || "").trim();
    if (!title) return null;
    var browse = raw.browseId || raw.channelId || "";
    if (browse && String(browse).indexOf("MPRE") === 0) browse = "";
    if (raw.kind === "album" && !browse) {
      title = (Array.isArray(raw.artists) && raw.artists[0]) || raw.subtitle || title;
    }
    return {
      source: "listen",
      kind: browse ? "artist" : "search_artist",
      id: browse || "artist:" + title.toLowerCase(),
      title: title,
      subtitle: raw.subtitle || fallbackSub || "Artist",
      artwork: raw.artwork || raw.thumb || "",
      thumb: raw.thumb || raw.artwork || "",
      browseId: browse || undefined,
      channelId: browse || undefined,
      _q: browse ? undefined : title,
      year: raw.year || yearFromText(raw.subtitle) || yearFromText(raw.title),
      genre: raw.genre || "",
    };
  }

  function listenShelves(home) {
    return ((home && home.shelves) || []).map(function (sh) {
      return {
        title: sh.title || "Shelf",
        items: (sh.items || []).map(function (it) {
          return Object.assign({}, it, { source: "listen" });
        }),
      };
    });
  }

  function buildPool(listenHome, artistsFeed, T) {
    var map = {};
    function add(card, scoreBoost) {
      if (!card || !card.title) return;
      var key = String(card.title).toLowerCase();
      var prev = map[key];
      if (!prev || (card.browseId && !prev.browseId)) {
        card._score = (card._score || 0) + (scoreBoost || 0);
        map[key] = card;
      } else {
        prev._score = (prev._score || 0) + (scoreBoost || 0);
        if (!prev.artwork && card.artwork) prev.artwork = card.artwork;
        if (!prev.browseId && card.browseId) {
          prev.browseId = card.browseId;
          prev.channelId = card.channelId;
          prev.kind = "artist";
          delete prev._q;
        }
      }
    }

    ((artistsFeed && artistsFeed.hot) || []).forEach(function (a) {
      add(asArtistCard(a, "Hot"), 3);
    });
    ((artistsFeed && artistsFeed.latest) || []).forEach(function (a) {
      add(asArtistCard(a, "Latest release"), 2);
    });

    listenShelves(listenHome).forEach(function (sh) {
      var title = (sh.title || "").toLowerCase();
      var isTrend = /trend|chart|hot|popular|artist/.test(title);
      var isNew = /new release|new album|just.?drop/.test(title);
      (sh.items || []).forEach(function (it) {
        if (it.kind === "artist") {
          add(asArtistCard(it, sh.title), isTrend ? 4 : 1);
          return;
        }
        if (it.kind === "album" && (isNew || isTrend || (it.artists && it.artists.length))) {
          var names = it.artists && it.artists.length ? it.artists : [it.subtitle];
          names.forEach(function (n) {
            add(
              asArtistCard(
                {
                  title: n,
                  subtitle: (isNew ? "Latest · " : "") + (it.title || sh.title),
                  thumb: it.thumb,
                  year: yearFromText(it.subtitle) || yearFromText(it.title),
                },
                sh.title
              ),
              isNew ? 3 : isTrend ? 2 : 1
            );
          });
        }
        if ((it.kind === "song" || it.kind === "video") && it.artists) {
          it.artists.forEach(function (n) {
            add(asArtistCard({ title: n, thumb: it.thumb, subtitle: it.title }), 0.5);
          });
        }
      });
    });

    if (T) {
      T.topArtists(16).forEach(function (a) {
        add(
          asArtistCard({ title: a.name, subtitle: "From your listening" }, "Your artists"),
          5 + (a.score || 0) * 0.1
        );
      });
      T.getRecent(24).forEach(function (r) {
        var name = r.artist || (typeof r.subtitle === "string" ? r.subtitle.split("·")[0] : "") || "";
        name = String(name).trim();
        if (!name || /radio|station|fm|am/i.test(name)) return;
        if (r.kind === "station" || r.source === "radio") return;
        add(
          asArtistCard(
            {
              title: name.split(",")[0].trim(),
              thumb: r.artwork,
              subtitle: "Recently played",
            },
            "Recent"
          ),
          4
        );
      });
    }

    return Object.keys(map).map(function (k) {
      return map[k];
    });
  }

  function sortPool(pool, mode, T, artistsFeed) {
    var list = (pool || []).slice();
    mode = mode || "recommended";
    if (mode === "recent") {
      var recentNames = {};
      var order = [];
      if (T) {
        T.getRecent(40).forEach(function (r) {
          var name = String(r.artist || "").split(",")[0].trim().toLowerCase();
          if (!name && r.kind !== "station") {
            name = String(r.subtitle || "")
              .split(/[·,]/)[0]
              .trim()
              .toLowerCase();
          }
          if (!name || recentNames[name]) return;
          if (r.kind === "station" || r.source === "radio") return;
          recentNames[name] = true;
          order.push(name);
        });
        T.topArtists(12).forEach(function (a) {
          var n = String(a.name || "").toLowerCase();
          if (n && !recentNames[n]) {
            recentNames[n] = true;
            order.push(n);
          }
        });
      }
      list.sort(function (a, b) {
        var ai = order.indexOf(String(a.title).toLowerCase());
        var bi = order.indexOf(String(b.title).toLowerCase());
        if (ai < 0) ai = 999;
        if (bi < 0) bi = 999;
        return ai - bi || (b._score || 0) - (a._score || 0);
      });
      var hit = list.filter(function (a) {
        return order.indexOf(String(a.title).toLowerCase()) >= 0;
      });
      return (hit.length ? hit : list).slice(0, 18);
    }
    if (mode === "hot") {
      var hotFeed = ((artistsFeed && artistsFeed.hot) || []).map(function (x) {
        return String(x.title || "").toLowerCase();
      });
      list.sort(function (a, b) {
        var ai = hotFeed.length ? hotFeed.indexOf(String(a.title).toLowerCase()) : -1;
        var bi = hotFeed.length ? hotFeed.indexOf(String(b.title).toLowerCase()) : -1;
        if (ai < 0) ai = 500;
        if (bi < 0) bi = 500;
        return ai - bi || (b._score || 0) - (a._score || 0);
      });
      return list.slice(0, 18);
    }
    if (mode === "latest") {
      var latestNames = ((artistsFeed && artistsFeed.latest) || []).map(function (x) {
        return String(x.title || "").toLowerCase();
      });
      list.sort(function (a, b) {
        var ai = latestNames.indexOf(String(a.title).toLowerCase());
        var bi = latestNames.indexOf(String(b.title).toLowerCase());
        if (ai < 0) ai = 400;
        if (bi < 0) bi = 400;
        return ai - bi || (b.year || 0) - (a.year || 0) || (b._score || 0) - (a._score || 0);
      });
      return list.slice(0, 18);
    }
    if (mode === "era") {
      list.forEach(function (a) {
        a._era = decadeLabel(a.year || yearFromText(a.subtitle) || yearFromText(a.title));
      });
      list.sort(function (a, b) {
        return (b.year || 0) - (a.year || 0) || (b._score || 0) - (a._score || 0);
      });
      list.forEach(function (a) {
        if (a._era && (!a.subtitle || a.subtitle === "Artist" || a.subtitle === "Trending")) {
          a.subtitle = a._era;
        } else if (a._era && a.subtitle && a.subtitle.indexOf(a._era) < 0) {
          a.subtitle = a._era + " · " + a.subtitle;
        }
      });
      return list.slice(0, 18);
    }
    if (mode === "genre") {
      var genres = T ? T.topGenres(6) : [];
      var gnames = genres.map(function (g) {
        return String(g.name || "").toLowerCase();
      });
      list.forEach(function (a) {
        var g = String(a.genre || a.subtitle || "").toLowerCase();
        var ghit = gnames.find(function (n) {
          return n && g.indexOf(n) >= 0;
        });
        a._genreHit = ghit || "";
        if (ghit && (!a.subtitle || a.subtitle === "Artist")) a.subtitle = ghit;
      });
      list.sort(function (a, b) {
        var ai = a._genreHit ? gnames.indexOf(a._genreHit) : 50;
        var bi = b._genreHit ? gnames.indexOf(b._genreHit) : 50;
        return ai - bi || (b._score || 0) - (a._score || 0);
      });
      return list.slice(0, 18);
    }
    if (T && T.hasSignal()) return T.rankItems(list).slice(0, 18);
    list.sort(function (a, b) {
      return (b._score || 0) - (a._score || 0);
    });
    return list.slice(0, 18);
  }

  window.SDMusicArtists = {
    MODES: MODES,
    readMode: readMode,
    writeMode: writeMode,
    asArtistCard: asArtistCard,
    buildPool: buildPool,
    sortPool: sortPool,
    yearFromText: yearFromText,
    decadeLabel: decadeLabel,
    LETTERS: ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","#"],
    SORTS: [
      { id: "name", label: "A–Z" },
      { id: "name_desc", label: "Z–A" },
      { id: "hot", label: "Hot" },
      { id: "recent", label: "Recent" },
    ],
    fetchDirectory: fetchDirectory,
    renderDirectory: renderDirectory,
  };

  var DIR_API = "/api/music/listen/artists/directory";
  var LS_DIR_SORT = "sd_music_artists_dir_sort_v1";
  var LS_DIR_LETTER = "sd_music_artists_dir_letter_v1";

  function readDirSort() {
    try {
      var s = sessionStorage.getItem(LS_DIR_SORT) || localStorage.getItem(LS_DIR_SORT);
      if (s && ["name", "name_desc", "hot", "recent"].indexOf(s) >= 0) return s;
    } catch (e) {}
    return "name";
  }

  function writeDirSort(s) {
    try {
      sessionStorage.setItem(LS_DIR_SORT, s);
      localStorage.setItem(LS_DIR_SORT, s);
    } catch (e) {}
  }

  function readDirLetter() {
    try {
      var s = sessionStorage.getItem(LS_DIR_LETTER) || localStorage.getItem(LS_DIR_LETTER);
      if (s === "#" || (s && /^[A-Z]$/.test(s))) return s;
    } catch (e) {}
    return "";
  }

  function writeDirLetter(s) {
    try {
      sessionStorage.setItem(LS_DIR_LETTER, s || "");
      localStorage.setItem(LS_DIR_LETTER, s || "");
    } catch (e) {}
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fetchDirectory(params) {
    params = params || {};
    var u = new URLSearchParams();
    if (params.letter) u.set("letter", params.letter);
    if (params.sort && params.sort !== "recent") u.set("sort", params.sort);
    else if (params.sort === "recent") u.set("sort", "hot");
    u.set("limit", String(params.limit != null ? params.limit : 120));
    u.set("offset", String(params.offset != null ? params.offset : 0));
    if (params.q) u.set("q", params.q);
    return fetch(DIR_API + "?" + u.toString(), { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error("artists_directory_" + r.status);
      return r.json();
    });
  }

  function applyRecentSort(items) {
    var T = window.SDMusicTaste;
    if (!T || !T.getRecent) return items;
    var recent = T.getRecent(48) || [];
    var rank = Object.create(null);
    recent.forEach(function (it, idx) {
      var name = String(
        (it && (it.artist || it.subtitle || (it.artists && it.artists[0]) || it.title)) || ""
      )
        .trim()
        .toLowerCase();
      if (name && rank[name] == null) rank[name] = idx;
      var bid = it && (it.artistId || it.browseId || it.channelId);
      if (bid && rank["id:" + bid] == null) rank["id:" + bid] = idx;
    });
    return (items || []).slice().sort(function (a, b) {
      var ak =
        (a.browseId && rank["id:" + a.browseId] != null
          ? rank["id:" + a.browseId]
          : rank[String(a.title || "").toLowerCase()]);
      var bk =
        (b.browseId && rank["id:" + b.browseId] != null
          ? rank["id:" + b.browseId]
          : rank[String(b.title || "").toLowerCase()]);
      if (ak == null) ak = 9999;
      if (bk == null) bk = 9999;
      return ak - bk || String(a.title || "").localeCompare(String(b.title || ""));
    });
  }

  /**
   * Render A–Z artists directory into hostEl.
   * opts: { onOpenArtist(item), state?: {sort, letter} }
   */
  function renderDirectory(hostEl, opts) {
    opts = opts || {};
    if (!hostEl) return Promise.resolve(null);
    var state = {
      sort: (opts.state && opts.state.sort) || readDirSort(),
      letter: (opts.state && opts.state.letter) != null ? opts.state.letter : readDirLetter(),
      loading: true,
    };

    function paintShell() {
      hostEl.innerHTML =
        '<div class="ml-adir">' +
        '<div class="mh-seg ml-adir-sort" role="tablist" aria-label="Artist sort">' +
        window.SDMusicArtists.SORTS.map(function (m) {
          return (
            '<button type="button" class="mh-seg-btn' +
            (state.sort === m.id ? " on" : "") +
            '" data-adir-sort="' +
            m.id +
            '" role="tab" aria-selected="' +
            (state.sort === m.id ? "true" : "false") +
            '">' +
            esc(m.label) +
            "</button>"
          );
        }).join("") +
        "</div>" +
        '<div class="ml-adir-jump" role="navigation" aria-label="A to Z">' +
        '<button type="button" class="ml-adir-letter' +
        (!state.letter ? " on" : "") +
        '" data-adir-letter="">All</button>' +
        window.SDMusicArtists.LETTERS.map(function (L) {
          return (
            '<button type="button" class="ml-adir-letter' +
            (state.letter === L ? " on" : "") +
            '" data-adir-letter="' +
            L +
            '">' +
            L +
            "</button>"
          );
        }).join("") +
        "</div>" +
        '<div class="ml-adir-body" data-adir-body><div class="ml-loading">Loading artists directory…</div></div>' +
        "</div>";

      hostEl.querySelector(".ml-adir-sort").addEventListener("click", function (e) {
        var b = e.target.closest("[data-adir-sort]");
        if (!b) return;
        state.sort = b.getAttribute("data-adir-sort") || "name";
        writeDirSort(state.sort);
        paintShell();
        load();
      });
      hostEl.querySelector(".ml-adir-jump").addEventListener("click", function (e) {
        var b = e.target.closest("[data-adir-letter]");
        if (!b) return;
        state.letter = b.getAttribute("data-adir-letter") || "";
        writeDirLetter(state.letter);
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
        order = window.SDMusicArtists.LETTERS.filter(function (L) {
          return map[L] && map[L].length;
        });
      }
      return { map: map, order: order };
    }

    function paintItems(data) {
      var body = hostEl.querySelector("[data-adir-body]");
      if (!body) return;
      var items = (data && data.items) || [];
      if (state.sort === "recent") items = applyRecentSort(items);
      if (!items.length) {
        body.innerHTML = '<div class="ml-empty">No artists in this slice yet — try All or Hot.</div>';
        return;
      }
      var grouped = groupByLetter(items);
      var html = "";
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
          var thumb = it.thumb || it.artwork || "";
          html +=
            '<button type="button" class="ml-adir-row" data-adir-open>' +
            (thumb
              ? '<img class="art" src="' +
                esc(thumb) +
                '" alt="" loading="lazy" referrerpolicy="no-referrer"/>'
              : '<span class="art ml-adir-ph" aria-hidden="true"></span>') +
            '<span class="meta"><span class="n">' +
            esc(it.title || "Artist") +
            '</span><span class="c">' +
            esc(it.subtitle || it.listeners || "Artist") +
            "</span></span>" +
            '<span class="go" aria-hidden="true">›</span>' +
            "</button>";
        });
        html += "</div>";
      });
      if (data && data.has_more) {
        html +=
          '<button type="button" class="ml-lib-btn ml-adir-more" data-adir-more>Load more</button>';
      }
      body.innerHTML = html;
      var rows = body.querySelectorAll("[data-adir-open]");
      var flat = [];
      grouped.order.forEach(function (L) {
        flat = flat.concat(grouped.map[L] || []);
      });
      rows.forEach(function (row, idx) {
        row.addEventListener("click", function () {
          var item = flat[idx];
          if (!item) return;
          if (typeof opts.onOpenArtist === "function") opts.onOpenArtist(item);
        });
      });
      var more = body.querySelector("[data-adir-more]");
      if (more) {
        more.addEventListener("click", function () {
          load({ offset: ((data && data.offset) || 0) + ((data && data.limit) || 120), append: true, prev: flat });
        });
      }
    }

    function load(extra) {
      extra = extra || {};
      var body = hostEl.querySelector("[data-adir-body]");
      if (body && !extra.append) body.innerHTML = '<div class="ml-loading">Loading artists directory…</div>';
      var sortApi = state.sort === "recent" ? "hot" : state.sort;
      return fetchDirectory({
        letter: state.letter || undefined,
        sort: sortApi,
        limit: extra.limit || 120,
        offset: extra.offset || 0,
      })
        .then(function (data) {
          if (extra.append && extra.prev) {
            data.items = (extra.prev || []).concat(data.items || []);
            data.offset = 0;
            data.has_more = !!data.has_more;
          }
          // Mark letter counts on jump bar
          try {
            var counts = Object.create(null);
            ((data && data.letters) || []).forEach(function (L) {
              counts[L.id] = L.count || 0;
            });
            hostEl.querySelectorAll(".ml-adir-letter[data-adir-letter]").forEach(function (btn) {
              var id = btn.getAttribute("data-adir-letter");
              if (!id) return;
              btn.classList.toggle("empty", !(counts[id] > 0));
              btn.title = (counts[id] || 0) + " artists";
            });
          } catch (e) {}
          paintItems(data);
          return data;
        })
        .catch(function () {
          if (body) body.innerHTML = '<div class="ml-err">Couldn’t load artists directory.</div>';
        });
    }

    paintShell();
    return load();
  }
})();
