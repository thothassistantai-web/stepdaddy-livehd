/**
 * StepDaddy Music — unified search (stations + Listen entities) + voice mic.
 * Mounts into #musicUnifiedSearch inside /music shell.
 * Full-height results + infinite scroll + swipe-down dismiss.
 */
(function () {
  if (window.StepDaddyMusicSearch) return;

  var API = "/api/music/search";
  var PREVIEW = 6;
  var PAGE = 18;
  var DEBOUNCE_MS = 260;
  var LABELS = {
    station: "Stations",
    track: "Tracks",
    artist: "Artists",
    album: "Albums",
    playlist: "Playlists",
    video: "Videos",
  };
  var FILTERS = ["all", "station", "track", "artist", "album", "playlist", "video"];
  var CHIP_ICONS = {
    all:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
    station:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14"/></svg>',
    track:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    artist:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    album:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>',
    playlist:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    video:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="14" height="14" rx="2"/><path d="m17 10 4-2v8l-4-2z"/></svg>',
  };

  function ensureCss() {
    if (document.getElementById("sd-music-search-css")) return;
    var link = document.createElement("link");
    link.id = "sd-music-search-css";
    link.rel = "stylesheet";
    link.href =
      "/tv-assets/music_search.css?v=" +
      encodeURIComponent(window.__SD_BUNDLE_VERSION || "1");
    document.head.appendChild(link);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getSpeechCtor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function geoParams() {
    var out = {};
    try {
      var g = JSON.parse(localStorage.getItem("sd_music_radio_geo") || "null");
      if (g) {
        if (g.lat != null) out.lat = g.lat;
        if (g.lon != null) out.lon = g.lon;
        if (g.countrycode) out.countrycode = g.countrycode;
        if (g.state) out.state = g.state;
        if (g.city) out.city = g.city;
      }
    } catch (e) {}
    return out;
  }

  function tasteParams() {
    var out = {};
    try {
      if (!window.SDMusicTaste) return out;
      var artists =
        typeof window.SDMusicTaste.topArtists === "function"
          ? window.SDMusicTaste.topArtists(8)
          : [];
      var genres =
        typeof window.SDMusicTaste.topGenres === "function"
          ? window.SDMusicTaste.topGenres(5)
          : [];
      if (artists && artists.length) {
        out.taste_artists = artists
          .map(function (a) {
            return a && a.name ? a.name : "";
          })
          .filter(Boolean)
          .slice(0, 8)
          .join(",");
      }
      if (genres && genres.length) {
        out.taste_genres = genres
          .map(function (g) {
            return g && g.name ? g.name : "";
          })
          .filter(Boolean)
          .slice(0, 5)
          .join(",");
      }
    } catch (e) {}
    return out;
  }

  function applyTasteRank(groups) {
    if (!groups || !window.SDMusicTaste) return groups;
    var topA = [];
    try {
      topA =
        typeof window.SDMusicTaste.topArtists === "function"
          ? window.SDMusicTaste.topArtists(10)
          : [];
    } catch (e) {
      topA = [];
    }
    var artistKeys = (topA || [])
      .map(function (a) {
        return a && a.name ? String(a.name).toLowerCase() : "";
      })
      .filter(Boolean);
    if (!artistKeys.length) return groups;
    var out = {};
    Object.keys(groups).forEach(function (k) {
      var list = (groups[k] || []).slice();
      list.sort(function (a, b) {
        var sa = Number(a && a.score) || 0;
        var sb = Number(b && b.score) || 0;
        function boost(hit) {
          var blob = (
            (hit.title || "") +
            " " +
            (hit.subtitle || "") +
            " " +
            ((hit.artists || []).join(" ") || "")
          ).toLowerCase();
          var b = 0;
          for (var i = 0; i < artistKeys.length; i++) {
            if (blob.indexOf(artistKeys[i]) >= 0) b += Math.max(1, 6 - i * 0.4);
          }
          return b;
        }
        return sb + boost(b) - (sa + boost(a));
      });
      out[k] = list;
    });
    return out;
  }

  function hitId(hit) {
    if (!hit) return "";
    return String(hit.id || hit.videoId || (hit.station && hit.station.stationuuid) || hit.title || "");
  }

  /** Strip accidental digit runs (e.g. unlock PIN) injected mid-word: Lil Wa4494yne → Lil Wayne */
  function sanitizeQuery(q) {
    var s = String(q == null ? "" : q);
    // letter(s) + 3–6 digits + letter(s) inside a token → drop the digits
    s = s.replace(/([A-Za-z]{2,})\d{3,6}([A-Za-z]{2,})/g, "$1$2");
    // collapse leftover double spaces
    return s.replace(/\s{2,}/g, " ").trimStart();
  }

  function mergeGroups(prev, next) {
    var out = {};
    var kinds = FILTERS.slice(1);
    kinds.forEach(function (k) {
      var seen = {};
      var list = [];
      ((prev && prev[k]) || []).forEach(function (h) {
        var id = hitId(h);
        if (id && seen[id]) return;
        if (id) seen[id] = 1;
        list.push(h);
      });
      ((next && next[k]) || []).forEach(function (h) {
        var id = hitId(h);
        if (id && seen[id]) return;
        if (id) seen[id] = 1;
        list.push(h);
      });
      out[k] = list;
    });
    return out;
  }

  function skeletonHtml() {
    var row =
      '<div class="ms-skel-row" aria-hidden="true">' +
      '<span class="ms-skel ms-skel-art"></span>' +
      '<span class="ms-skel-meta"><span class="ms-skel ms-skel-t"></span><span class="ms-skel ms-skel-s"></span></span>' +
      '<span class="ms-skel ms-skel-chip"></span></div>';
    return (
      '<div class="ms-loading-skel" role="status" aria-live="polite" aria-label="Searching">' +
      '<div class="ms-skel-label">Searching…</div>' +
      row +
      row +
      row +
      row +
      row +
      "</div>"
    );
  }

  function Mount(el) {
    ensureCss();
    el.classList.add("sd-music-search");
    el.innerHTML =
      '<form class="ms-form" data-ms-form>' +
      '  <div class="ms-input-wrap">' +
      '    <input type="text" inputmode="search" enterkeyhint="search" placeholder="Search stations, songs, artists, albums…" data-ms-q aria-label="Search Music" autocomplete="off" spellcheck="false"/>' +
      '    <button type="button" class="ms-clear" data-ms-clear hidden aria-label="Clear search" title="Clear">' +
      '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
      "    </button>" +
      '    <button type="button" class="ms-mic" data-ms-mic aria-label="Voice search" title="Voice search" aria-pressed="false">' +
      '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/><path d="M8 22h8"/></svg>' +
      "    </button>" +
      "  </div>" +
      '  <button type="submit" class="ms-go">Search</button>' +
      "</form>" +
      '<div class="ms-chips" data-ms-chips role="tablist" aria-label="Music focus"></div>' +
      '<div class="ms-results" data-ms-results hidden></div>';

    var form = el.querySelector("[data-ms-form]");
    var input = el.querySelector("[data-ms-q]");
    var clearBtn = el.querySelector("[data-ms-clear]");
    var mic = el.querySelector("[data-ms-mic]");
    var chips = el.querySelector("[data-ms-chips]");
    var results = el.querySelector("[data-ms-results]");
    // Prefer single horizontal rail under search (header owns Home/Radio/Listen)
    try {
      var host = document.getElementById("musicFocusChipsHost");
      if (host && chips && chips.parentNode !== host) {
        host.appendChild(chips);
      }
    } catch (e) {}
    // Place results below chip rail so list fills remaining sheet height
    try {
      var body = document.getElementById("musicCatalogBody");
      if (body && body.parentNode && results) {
        body.parentNode.insertBefore(results, body);
      }
    } catch (ePlace) {}
    var chipRail = document.getElementById("musicChipRail");
    var timer = null;
    var filter = "all";
    var lastData = null;
    var reqId = 0;
    var abortCtrl = null;
    var expanded = {};
    var resultsCollapsed = false;
    var panelOpen = false;
    var loadingMore = false;
    var exhausted = false;
    var nextOffset = 0;
    var searching = false;

    function updateChipRailFades() {
      var rail = chipRail || document.getElementById("musicChipRail");
      if (!rail) return;
      var max = Math.max(0, rail.scrollWidth - rail.clientWidth);
      var left = max > 4 && rail.scrollLeft > 4 ? 18 : 0;
      var right = max > 4 && rail.scrollLeft < max - 4 ? 22 : 0;
      rail.style.setProperty("--music-chip-fade-l", left + "px");
      rail.style.setProperty("--music-chip-fade-r", right + "px");
    }

    function wireChipRailFades() {
      var rail = chipRail || document.getElementById("musicChipRail");
      if (!rail || rail.dataset.msFadeWired) return;
      rail.dataset.msFadeWired = "1";
      rail.addEventListener("scroll", updateChipRailFades, { passive: true });
      try {
        if (typeof ResizeObserver !== "undefined") {
          var ro = new ResizeObserver(updateChipRailFades);
          ro.observe(rail);
        }
      } catch (e) {}
      updateChipRailFades();
    }

    try {
      if (window.SDMusicFocus && window.SDMusicFocus.get) filter = window.SDMusicFocus.get() || "all";
    } catch (e) {}

    function updateClearBtn() {
      var has = String(input.value || "").trim().length > 0;
      if (clearBtn) clearBtn.hidden = !has;
      try {
        var wrap = el.querySelector(".ms-input-wrap");
        if (!wrap) return;
        wrap.classList.toggle("has-clear", has);
        wrap.classList.toggle("no-mic", !!(mic && mic.hidden));
      } catch (e) {}
    }

    function blurKeyboard() {
      try {
        input.blur();
      } catch (e) {}
    }

    function ensureScrim() {
      var bodyEl = document.getElementById("musicCatalogBody");
      if (!bodyEl) return null;
      var scrim = document.getElementById("musicSearchScrim");
      if (!scrim) {
        scrim = document.createElement("button");
        scrim.type = "button";
        scrim.id = "musicSearchScrim";
        scrim.className = "ms-search-scrim";
        scrim.setAttribute("aria-label", "Dismiss search results");
        scrim.hidden = true;
        scrim.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          dismissResults({ keepQuery: true, blur: true });
        });
        try {
          bodyEl.style.position = bodyEl.style.position || "relative";
          bodyEl.appendChild(scrim);
        } catch (e) {
          return null;
        }
      }
      return scrim;
    }

    function setPanelOpen(on) {
      panelOpen = !!on;
      el.classList.toggle("ms-open", panelOpen);
      try {
        var catalog = document.getElementById("musicCatalog");
        if (catalog) catalog.classList.toggle("ms-search-open", panelOpen);
      } catch (e) {}
      var scrim = ensureScrim();
      if (scrim) {
        scrim.hidden = !panelOpen;
        scrim.setAttribute("aria-hidden", panelOpen ? "false" : "true");
      }
    }

    function isResultsOpen() {
      return panelOpen && results && !results.hidden;
    }

    /** Collapse results layer only — never closes #musicCatalog. */
    function dismissResults(opts) {
      opts = opts || {};
      clearTimeout(timer);
      reqId += 1;
      searching = false;
      loadingMore = false;
      resultsCollapsed = true;
      try {
        if (abortCtrl) abortCtrl.abort();
      } catch (eAb) {}
      abortCtrl = null;
      function hideNow() {
        results.hidden = true;
        results.innerHTML = "";
        results.classList.remove("ms-pulling", "ms-dismissing");
        results.style.transform = "";
        results.style.transition = "";
        setPanelOpen(false);
      }
      if (opts.instant || results.hidden || !panelOpen) {
        hideNow();
      } else {
        results.classList.add("ms-dismissing");
        setTimeout(hideNow, 180);
      }
      if (opts.clearQuery) {
        input.value = "";
        lastData = null;
        expanded = {};
        exhausted = false;
        nextOffset = 0;
        renderChips({});
      }
      updateClearBtn();
      if (opts.blur) blurKeyboard();
      return true;
    }

    function dismissIfOpen() {
      if (!isResultsOpen()) return false;
      dismissResults({ keepQuery: true, blur: true });
      return true;
    }

    function applyFocus(next) {
      filter = next || "all";
      try {
        if (window.SDMusicFocus && typeof window.SDMusicFocus.set === "function") {
          window.SDMusicFocus.set(filter);
        } else {
          window.dispatchEvent(
            new CustomEvent("sd-music-focus", { detail: { focus: filter } })
          );
        }
      } catch (e) {}
      try {
        var catalog = document.getElementById("musicCatalog");
        if (catalog) catalog.dataset.musicFocus = filter;
      } catch (e) {}

      function keepSheetOpen(tab) {
        try {
          if (window.SDMusic && typeof window.SDMusic.open === "function") {
            window.SDMusic.open({ replace: true, tab: tab || undefined });
            return;
          }
          if (window.SDMusic && typeof window.SDMusic.setTab === "function" && tab) {
            window.SDMusic.setTab(tab, { replaceUrl: true });
          }
        } catch (eKeep) {}
      }

      function resetListenStack() {
        try {
          var L = window.StepDaddyMusicListen;
          if (L && typeof L.resetNavigation === "function") L.resetNavigation();
        } catch (eR) {}
      }

      function resetRadioStack() {
        try {
          var R = window.StepDaddyMusicRadio;
          if (R && typeof R.resetNavigation === "function") R.resetNavigation();
        } catch (eR) {}
      }

      function goListenDir(fnName) {
        try {
          resetRadioStack();
          keepSheetOpen("listen");
          var L = window.StepDaddyMusicListen;
          if (L && typeof L[fnName] === "function") {
            L[fnName]();
            return true;
          }
        } catch (eDir) {}
        return false;
      }

      if (filter === "station") {
        try {
          resetListenStack();
          keepSheetOpen("radio");
          if (window.StepDaddyMusicRadio && window.StepDaddyMusicRadio.openStationsDirectory) {
            window.StepDaddyMusicRadio.openStationsDirectory();
            return;
          }
        } catch (eSt) {}
      }
      if (filter === "artist") {
        if (goListenDir("openArtistsDirectory")) return;
      }
      if (filter === "track") {
        if (goListenDir("openTracksDirectory")) return;
      }
      if (filter === "album") {
        if (goListenDir("openAlbumsDirectory")) return;
      }
      if (filter === "playlist") {
        if (goListenDir("openPlaylistsDirectory")) return;
      }
      if (filter === "video") {
        if (goListenDir("openVideosDirectory")) return;
      }

      try {
        resetListenStack();
        resetRadioStack();
        keepSheetOpen("home");
        if (window.SDMusic && typeof window.SDMusic.setTab === "function") {
          window.SDMusic.setTab("home", { replaceUrl: true, refreshHome: false });
        }
        if (window.StepDaddyMusicHome && typeof window.StepDaddyMusicHome.render === "function") {
          window.StepDaddyMusicHome.render();
        } else if (window.StepDaddyMusicHome && window.StepDaddyMusicHome.refresh) {
          window.StepDaddyMusicHome.refresh();
        }
      } catch (e) {}
    }

    function renderChips(counts) {
      chips.innerHTML = FILTERS.map(function (k) {
        var label = k === "all" ? "All" : LABELS[k] || k;
        var n = k === "all" ? (lastData && lastData.total) || 0 : (counts && counts[k]) || 0;
        var on = filter === k;
        var ico = CHIP_ICONS[k] || CHIP_ICONS.all;
        return (
          '<button type="button" class="ms-chip' +
          (on ? " on" : "") +
          '" data-ms-filter="' +
          k +
          '" role="tab" aria-selected="' +
          (on ? "true" : "false") +
          '">' +
          '<span class="ms-chip-ico">' +
          ico +
          "</span>" +
          '<span class="ms-chip-label">' +
          esc(label) +
          "</span>" +
          (n
            ? '<span class="ms-chip-count" aria-hidden="true">' + esc(String(n)) + "</span>"
            : "") +
          "</button>"
        );
      }).join("");
      wireChipRailFades();
      updateChipRailFades();
    }

    function thumbHtml(hit) {
      var fallback =
        "data:image/svg+xml," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">' +
            '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
            '<stop stop-color="#1a2332"/><stop offset="1" stop-color="#243044"/>' +
            "</linearGradient></defs>" +
            '<rect width="96" height="96" rx="18" fill="url(#g)"/>' +
            '<circle cx="48" cy="48" r="26" fill="none" stroke="#3b82f6" stroke-width="3" opacity=".85"/>' +
            '<circle cx="48" cy="48" r="5" fill="#3b82f6"/></svg>'
        );
      if (hit.kind === "station" && hit.station) {
        var st = hit.station;
        var labelSrc = String(st.callsign || st.brand || hit.title || "FM").trim();
        var label = labelSrc.length <= 4 ? labelSrc.toUpperCase() : labelSrc.slice(0, 2).toUpperCase();
        fallback =
          "data:image/svg+xml," +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">' +
              '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
              '<stop stop-color="#1a2332"/><stop offset="1" stop-color="#243044"/>' +
              "</linearGradient></defs>" +
              '<rect width="96" height="96" rx="18" fill="url(#g)"/>' +
              '<circle cx="48" cy="40" r="22" fill="none" stroke="#3b82f6" stroke-width="3" opacity=".85"/>' +
              '<circle cx="48" cy="40" r="4" fill="#3b82f6"/>' +
              '<text x="48" y="78" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" font-weight="700" fill="#e8eaef">' +
              esc(label).slice(0, 4) +
              "</text></svg>"
          );
      }
      if (hit.thumb) {
        return (
          '<img class="ms-art" src="' +
          esc(hit.thumb) +
          '" alt="" loading="lazy" referrerpolicy="no-referrer" data-fallback="' +
          esc(fallback) +
          '" onerror="this.onerror=null;this.src=this.getAttribute(\'data-fallback\')"/>'
        );
      }
      return '<img class="ms-art" src="' + esc(fallback) + '" alt="" aria-hidden="true"/>';
    }

    function typeChip(kind) {
      return '<span class="ms-badge ms-badge-' + esc(kind) + '">' + esc(LABELS[kind] || kind) + "</span>";
    }

    function showResultsIfCached() {
      if (!lastData) return;
      if (!String(input.value || "").trim()) return;
      resultsCollapsed = false;
      renderResults();
    }

    async function activate(hit) {
      if (!hit) return;
      dismissResults({ keepQuery: true, blur: true });
      if (hit.kind === "station" && hit.station) {
        if (window.StepDaddyMusicRadio && typeof window.StepDaddyMusicRadio.playStation === "function") {
          await window.StepDaddyMusicRadio.playStation(hit.station);
          return;
        }
      }
      if (hit.kind === "track" || hit.kind === "video") {
        var vid = hit.videoId || (hit.item && hit.item.videoId);
        if (vid && window.StepDaddyMusicListen) {
          try {
            if (window.SDMusic) window.SDMusic.open({ replace: true, tab: "listen" });
          } catch (e) {}
          if (typeof window.StepDaddyMusicListen.searchAndPlay === "function") {
            await window.StepDaddyMusicListen.searchAndPlay(
              [hit.title, (hit.artists && hit.artists[0]) || ""].filter(Boolean).join(" ")
            );
            return;
          }
          // Always UQ path — never bare Player.play without onEnded/handlers.
          var seed =
            window.SDMusicLibrary && typeof window.SDMusicLibrary.asPlayableTrack === "function"
              ? window.SDMusicLibrary.asPlayableTrack(hit.item || hit)
              : null;
          if (!seed) {
            seed = {
              videoId: vid,
              title: hit.title,
              artists: hit.artists || [],
              thumb: hit.thumb || "",
              subtitle: hit.subtitle || "",
            };
          }
          if (typeof window.StepDaddyMusicListen.playTracks === "function") {
            await window.StepDaddyMusicListen.playTracks([seed], vid, "search", {
              title: hit.title,
              artistName: (hit.artists && hit.artists[0]) || hit.subtitle || "",
            });
            return;
          }
          if (typeof window.StepDaddyMusicListen.playVideoId === "function") {
            await window.StepDaddyMusicListen.playVideoId(vid, [seed]);
            return;
          }
        }
        return;
      }
      try {
        if (window.SDMusic && typeof window.SDMusic.open === "function") {
          window.SDMusic.open({ replace: true, tab: "listen" });
        }
        if (window.StepDaddyMusicListen && typeof window.StepDaddyMusicListen.openSearch === "function") {
          window.StepDaddyMusicListen.openSearch(hit.title || input.value);
        }
      } catch (e) {}
    }

    function hitRowHtml(kind, hit, idx) {
      var subtitle = hit.subtitle || "";
      if (!subtitle || String(subtitle).toLowerCase() === String(kind).toLowerCase()) {
        if (hit.artists && hit.artists.length) subtitle = hit.artists.join(", ");
        else if (hit.duration) subtitle = String(hit.duration);
        else subtitle = LABELS[kind] || kind;
      }
      var Lib = window.SDMusicLibrary;
      var plus = Lib && Lib.addBtnHtml ? Lib.addBtnHtml("ms-add") : "";
      var more =
        (kind === "track" || kind === "video") && Lib && Lib.moreBtnHtml ? Lib.moreBtnHtml() : "";
      var actions =
        plus || more ? '<span class="ml-actions">' + plus + more + "</span>" : "";
      return (
        '<div class="ms-hit-row">' +
        '<button type="button" class="ms-hit" data-ms-kind="' +
        esc(kind) +
        '" data-ms-i="' +
        idx +
        '">' +
        thumbHtml(hit) +
        '<span class="ms-meta"><span class="n">' +
        esc(hit.title) +
        '</span><span class="c">' +
        esc(subtitle) +
        "</span></span>" +
        typeChip(kind) +
        "</button>" +
        actions +
        "</div>"
      );
    }

    function footerHtml() {
      if (loadingMore) {
        return '<div class="ms-load-more" data-ms-load-more role="status">Loading more…</div>';
      }
      if (exhausted && lastData && lastData.total > 0) {
        return '<div class="ms-load-more ms-exhausted" data-ms-exhausted>No more results</div>';
      }
      return "";
    }

    function bindResultInteractions() {
      results.querySelectorAll(".ms-hit").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var kind = btn.getAttribute("data-ms-kind");
          var i = Number(btn.getAttribute("data-ms-i"));
          var hit = lastData.groups[kind] && lastData.groups[kind][i];
          activate(hit);
        });
      });
      results.querySelectorAll("[data-ms-see-all]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var kind = btn.getAttribute("data-ms-see-all");
          if (kind && filter === "all") {
            expanded[kind] = true;
            renderResults();
          }
        });
      });
      results.querySelectorAll("[data-ms-see-less]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var kind = btn.getAttribute("data-ms-see-less");
          if (kind) {
            delete expanded[kind];
            renderResults();
          }
        });
      });
      results.querySelectorAll(".ms-hit-row").forEach(function (row) {
        var hitBtn = row.querySelector(".ms-hit");
        var Lib = window.SDMusicLibrary;
        if (!hitBtn || !Lib) return;
        var kind = hitBtn.getAttribute("data-ms-kind");
        var i = Number(hitBtn.getAttribute("data-ms-i"));
        var hit = lastData.groups[kind] && lastData.groups[kind][i];
        if (!hit) return;
        if (typeof Lib.wireRowActions === "function") {
          Lib.wireRowActions(row, hit, {
            longPress: kind === "track" || kind === "video",
          });
        } else if (typeof Lib.wireAddButton === "function") {
          var addBtn = row.querySelector("[data-ml-add]");
          if (addBtn) Lib.wireAddButton(addBtn, hit);
        }
      });
    }

    function renderResults() {
      try {
        if (!lastData) {
          results.hidden = true;
          results.innerHTML = "";
          setPanelOpen(false);
          return;
        }
        var order = lastData.order || FILTERS.slice(1);
        var previewN = Number(lastData.preview) || PREVIEW;
        var html = "";
        order.forEach(function (kind) {
          if (filter !== "all" && filter !== kind) return;
          var list = (lastData.groups && lastData.groups[kind]) || [];
          if (!list.length) return;
          var showAll = filter !== "all" || expanded[kind];
          var visible = showAll ? list : list.slice(0, previewN);
          var more = !showAll && list.length > previewN;
          html +=
            '<section class="ms-section" data-ms-section="' +
            esc(kind) +
            '"><div class="ms-sec-head"><h3>' +
            esc(LABELS[kind] || kind) +
            "</h3>" +
            (list.length
              ? '<span class="ms-sec-count">' + esc(String(list.length)) + "</span>"
              : "") +
            "</div>";
          visible.forEach(function (hit, idx) {
            html += hitRowHtml(kind, hit, idx);
          });
          if (more) {
            html +=
              '<button type="button" class="ms-see-all" data-ms-see-all="' +
              esc(kind) +
              '">See all ' +
              esc(String(list.length)) +
              " " +
              esc(LABELS[kind] || kind) +
              "</button>";
          } else if (showAll && filter === "all" && list.length > previewN && expanded[kind]) {
            html +=
              '<button type="button" class="ms-see-all ms-see-less" data-ms-see-less="' +
              esc(kind) +
              '">Show less</button>';
          }
          html += "</section>";
        });
        if (!html) {
          html = '<div class="ms-empty">No matches for “' + esc(lastData.q || "") + '”</div>';
        }
        html += footerHtml();
        results.classList.remove("ms-dismissing", "ms-pulling");
        results.style.transform = "";
        results.innerHTML = html;
        results.hidden = false;
        resultsCollapsed = false;
        setPanelOpen(true);
        bindResultInteractions();
      } catch (err) {
        results.innerHTML =
          '<div class="ms-empty">Couldn’t show results — try again</div>';
        results.hidden = false;
        setPanelOpen(true);
      }
    }

    function fetchPage(q, offset, append) {
      var id = ++reqId;
      if (!append) {
        try {
          if (abortCtrl) abortCtrl.abort();
        } catch (eA) {}
        abortCtrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      }
      var u = new URLSearchParams(Object.assign({}, geoParams(), tasteParams()));
      u.set("q", q);
      u.set("limit", String(PAGE));
      u.set("offset", String(offset || 0));
      var fetchOpts = { credentials: "same-origin" };
      if (!append && abortCtrl) fetchOpts.signal = abortCtrl.signal;
      return fetch(API + "?" + u.toString(), fetchOpts)
        .then(function (r) {
          if (!r.ok) {
            var err = new Error("search_http_" + r.status);
            err.status = r.status;
            throw err;
          }
          return r.json();
        })
        .then(function (data) {
          if (id !== reqId) return { __stale: true };
          data = data || { q: q, groups: {}, counts: {}, total: 0, order: FILTERS.slice(1) };
          if (data.groups) data.groups = applyTasteRank(data.groups);
          if (append && lastData && lastData.groups) {
            data.groups = mergeGroups(lastData.groups, data.groups);
            data.counts = lastData.counts || data.counts;
            data.total = Object.keys(data.groups).reduce(function (n, k) {
              return n + ((data.groups[k] && data.groups[k].length) || 0);
            }, 0);
            data.order = lastData.order || data.order;
            data.preview = lastData.preview || data.preview;
          }
          var lim = Number(data.limit) || PAGE;
          var off = Number(data.offset) || offset || 0;
          nextOffset = off + lim;
          exhausted = !data.has_more;
          if (filter !== "all" && data.has_more_by_kind) {
            exhausted = !data.has_more_by_kind[filter];
          }
          lastData = data;
          return data;
        })
        .catch(function (err) {
          if (err && (err.name === "AbortError" || err.code === 20)) {
            return { __stale: true };
          }
          if (id !== reqId) return { __stale: true };
          throw err;
        });
    }

    function loadMore() {
      if (loadingMore || exhausted || !lastData || searching) return;
      var q = String(input.value || lastData.q || "").trim();
      q = sanitizeQuery(q).trim();
      if (!q) return;
      loadingMore = true;
      renderResults();
      fetchPage(q, nextOffset, true)
        .then(function (data) {
          loadingMore = false;
          if (!data || data.__stale) return;
          renderChips(lastData.counts || {});
          renderResults();
        })
        .catch(function () {
          loadingMore = false;
          renderResults();
        });
    }

    function runSearch(q, opts) {
      opts = opts || {};
      q = sanitizeQuery(q);
      if (String(input.value || "") !== q && opts.rewriteInput !== false) {
        // Only rewrite when sanitizer changed a contaminated query
        var raw = String(input.value || "");
        if (sanitizeQuery(raw).trim() === q.trim() && sanitizeQuery(raw) !== raw) {
          input.value = q;
        }
      }
      q = String(q || "").trim();
      try {
        var sheet = document.getElementById("musicCatalog");
        if (sheet && !sheet.classList.contains("open") && window.SDMusic && typeof window.SDMusic.open === "function") {
          window.SDMusic.open({ replace: true });
        }
      } catch (eOpen) {}
      if (opts.blur) blurKeyboard();
      if (q.length < 1) {
        dismissResults({ clearQuery: false, blur: !!opts.blur, instant: true });
        lastData = null;
        expanded = {};
        exhausted = false;
        nextOffset = 0;
        renderChips({});
        return;
      }
      try {
        if (window.SDMusicTaste && typeof window.SDMusicTaste.recordSearch === "function") {
          window.SDMusicTaste.recordSearch(q);
        }
      } catch (e) {}
      expanded = {};
      exhausted = false;
      nextOffset = 0;
      loadingMore = false;
      resultsCollapsed = false;
      searching = true;
      results.hidden = false;
      results.classList.remove("ms-dismissing");
      // Avoid blanking a good list into a permanent skeleton on race/fail —
      // only show skeleton when we have nothing to keep on screen.
      if (!lastData || !lastData.groups) {
        results.innerHTML = skeletonHtml();
      } else {
        var live = results.querySelector(".ms-live-status");
        if (!live) {
          live = document.createElement("div");
          live.className = "ms-skel-label ms-live-status";
          live.setAttribute("role", "status");
          live.style.position = "sticky";
          live.style.top = "0";
          live.style.zIndex = "2";
          live.style.background = "rgba(16,20,28,0.92)";
          results.insertBefore(live, results.firstChild);
        }
        live.textContent = "Updating…";
      }
      setPanelOpen(true);
      fetchPage(q, 0, false)
        .then(function (data) {
          if (!data || data.__stale) return;
          searching = false;
          renderChips(lastData.counts || {});
          renderResults();
        })
        .catch(function () {
          searching = false;
          if (lastData && lastData.groups) {
            renderChips(lastData.counts || {});
            renderResults();
            var note = document.createElement("div");
            note.className = "ms-empty";
            note.textContent = "Search failed — showing previous results";
            results.insertBefore(note, results.firstChild);
          } else {
            results.innerHTML = '<div class="ms-empty">Search failed — try again</div>';
            setPanelOpen(true);
          }
        });
    }

    try {
      if (window.SDMusicSearchGestures) {
        window.SDMusicSearchGestures.wireInfiniteScroll(results, {
          shouldLoad: function () {
            return isResultsOpen() && !loadingMore && !exhausted && !searching;
          },
          loadMore: loadMore,
        });
        window.SDMusicSearchGestures.wireSwipeDismiss(results, {
          isOpen: isResultsOpen,
          onDismiss: function () {
            dismissResults({ keepQuery: true, blur: true });
          },
        });
      }
    } catch (eGest) {}

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      clearTimeout(timer);
      runSearch(input.value, { blur: true });
    });
    input.addEventListener("input", function () {
      clearTimeout(timer);
      updateClearBtn();
      var raw = input.value;
      var cleaned = sanitizeQuery(raw);
      // Soft-clean obvious PIN injection without fighting caret mid-edit too hard
      if (cleaned !== raw && /[A-Za-z]{2,}\d{3,6}[A-Za-z]{2,}/.test(raw)) {
        var start = input.selectionStart;
        input.value = cleaned;
        try {
          var delta = raw.length - cleaned.length;
          var pos = Math.max(0, (start || 0) - delta);
          input.setSelectionRange(pos, pos);
        } catch (eCaret) {}
        updateClearBtn();
        raw = cleaned;
      }
      var v = raw;
      var delay = String(v || "").trim().length <= 2 ? DEBOUNCE_MS + 80 : DEBOUNCE_MS;
      timer = setTimeout(function () {
        runSearch(v);
      }, delay);
    });
    if (clearBtn) {
      clearBtn.addEventListener("click", function (e) {
        e.preventDefault();
        dismissResults({ clearQuery: true, blur: false, instant: true });
        try {
          input.focus();
        } catch (err) {}
      });
    }
    input.addEventListener("focus", function () {
      showResultsIfCached();
    });
    chips.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-ms-filter]");
      if (!btn) return;
      var next = btn.getAttribute("data-ms-filter") || "all";
      // While search results are open, chips only filter the list — do not
      // navigate into Radio/Listen directories (that collapses the search UX).
      if (isResultsOpen()) {
        filter = next;
        try {
          if (window.SDMusicFocus && typeof window.SDMusicFocus.set === "function") {
            window.SDMusicFocus.set(filter);
          }
          var catalog = document.getElementById("musicCatalog");
          if (catalog) catalog.dataset.musicFocus = filter;
        } catch (eFocus) {}
        renderChips((lastData && lastData.counts) || {});
        renderResults();
        return;
      }
      applyFocus(next);
      renderChips((lastData && lastData.counts) || {});
    });

    var Ctor = getSpeechCtor();
    if (!Ctor) {
      mic.hidden = true;
      mic.setAttribute("aria-hidden", "true");
    } else {
      var rec = null;
      var listening = false;
      function setListening(on) {
        listening = !!on;
        mic.classList.toggle("listening", listening);
        mic.setAttribute("aria-pressed", listening ? "true" : "false");
        mic.title = listening ? "Listening… tap to stop" : "Voice search";
      }
      mic.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (listening) {
          try {
            if (rec) rec.stop();
          } catch (err) {}
          setListening(false);
          return;
        }
        try {
          rec = new Ctor();
          rec.lang = navigator.language || "en-US";
          rec.interimResults = false;
          rec.maxAlternatives = 1;
          rec.continuous = false;
          rec.onresult = function (ev) {
            var transcript = "";
            try {
              transcript =
                (ev.results && ev.results[0] && ev.results[0][0] && ev.results[0][0].transcript) ||
                "";
            } catch (err) {
              transcript = "";
            }
            transcript = String(transcript || "").trim();
            if (!transcript) return;
            input.value = transcript;
            updateClearBtn();
            runSearch(transcript, { blur: true });
          };
          rec.onerror = function (ev) {
            setListening(false);
            var err = (ev && ev.error) || "";
            if (err === "not-allowed" || err === "service-not-allowed")
              mic.title = "Mic permission denied";
            else if (err === "no-speech") mic.title = "No speech heard — try again";
            else if (err && err !== "aborted") mic.title = "Voice search unavailable";
          };
          rec.onend = function () {
            setListening(false);
          };
          setListening(true);
          rec.start();
        } catch (err) {
          setListening(false);
          mic.hidden = true;
        }
      });
    }

    renderChips({});
    updateClearBtn();
    this.focus = function () {
      try {
        input.focus();
      } catch (e) {}
    };
    this.getFilter = function () {
      return filter;
    };
    this.setFilter = function (f) {
      applyFocus(f || "all");
      renderChips((lastData && lastData.counts) || {});
      renderResults();
    };
    this.search = runSearch;
    this.dismiss = dismissIfOpen;
    this.destroy = function () {
      el.innerHTML = "";
      if (results && results.parentNode && results.parentNode !== el) {
        try {
          results.remove();
        } catch (e) {}
      }
    };
  }

  function mount(el) {
    if (!el) return null;
    return new Mount(el);
  }

  function autoMount() {
    var el = document.getElementById("musicUnifiedSearch");
    if (!el || el.__msMounted) return;
    el.__msMounted = true;
    window.__sdMusicSearch = mount(el);
  }

  window.StepDaddyMusicSearch = {
    mount: mount,
    autoMount: autoMount,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMount);
  } else {
    setTimeout(autoMount, 0);
  }
})();
