/**
 * StepDaddy Music — shared content focus (search chips ↔ Home layout).
 * One source of truth: sessionStorage + light localStorage mirror.
 * API: window.SDMusicFocus
 */
(function () {
  if (window.SDMusicFocus) return;

  var LS = "sd_music_focus_v1";
  var SS = "sd_music_focus_session_v1";
  var FILTERS = ["all", "station", "track", "artist", "album", "playlist", "video"];
  var listeners = [];

  function normalize(v) {
    var s = String(v || "all").toLowerCase();
    return FILTERS.indexOf(s) >= 0 ? s : "all";
  }

  function read() {
    try {
      var s = sessionStorage.getItem(SS);
      if (s) return normalize(s);
    } catch (e) {}
    try {
      var l = localStorage.getItem(LS);
      if (l) return normalize(l);
    } catch (e2) {}
    return "all";
  }

  function write(focus) {
    var f = normalize(focus);
    try {
      sessionStorage.setItem(SS, f);
    } catch (e) {}
    try {
      localStorage.setItem(LS, f);
    } catch (e2) {}
    return f;
  }

  function get() {
    return read();
  }

  function set(focus, opts) {
    opts = opts || {};
    var prev = read();
    var next = write(focus);
    if (next === prev && !opts.force) return next;
    listeners.slice().forEach(function (fn) {
      try {
        fn(next, prev);
      } catch (e) {}
    });
    try {
      window.dispatchEvent(
        new CustomEvent("sd-music-focus", { detail: { focus: next, prev: prev } })
      );
    } catch (e2) {}
    return next;
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return function () {};
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (x) {
        return x !== fn;
      });
    };
  }

  /**
   * Reorder / filter Home shelf keys based on focus.
   * baseOrder comes from SDMusicTaste.shelfOrder (or default).
   */
  function shelfOrder(baseOrder, cold) {
    var focus = read();
    var base = (baseOrder || []).slice();
    if (focus === "all") {
      // Ensure artists sits under Radio near-you when present.
      return ensureArtistsAfterNear(base);
    }

    var primary = {
      // `library` strip always first; `near` = Radio; `recent` = Your music.
      station: ["library", "hero", "near", "recent", "made", "artists", "trending", "featured", "moods", "charts"],
      artist: ["library", "hero", "artists", "made", "recent", "trending", "charts", "featured", "near", "moods"],
      album: ["library", "hero", "featured", "trending", "artists", "made", "recent", "moods", "near", "charts"],
      track: ["library", "hero", "trending", "made", "recent", "artists", "featured", "near", "moods", "charts"],
      playlist: ["library", "hero", "moods", "featured", "trending", "made", "artists", "recent", "near", "charts"],
      video: ["library", "hero", "trending", "featured", "artists", "made", "recent", "near", "moods", "charts"],
    }[focus];

    if (!primary) return ensureArtistsAfterNear(base);

    // Keep only known keys; append any leftovers from base.
    var seen = {};
    var out = [];
    primary.forEach(function (k) {
      if (!seen[k]) {
        seen[k] = true;
        out.push(k);
      }
    });
    base.forEach(function (k) {
      if (!seen[k]) {
        seen[k] = true;
        out.push(k);
      }
    });
    // Drop legacy stacked likes — consolidated into `recent` library shelf.
    out = out.filter(function (k) {
      return k !== "likes";
    });
    if (cold && focus === "station") {
      // Cold + stations: skip empty taste shelves early.
      return out.filter(function (k) {
        return k !== "made";
      });
    }
    return out;
  }

  function ensureArtistsAfterNear(order) {
    var list = (order || []).slice();
    // Compact Library strip always leads Home.
    if (list.indexOf("library") < 0) {
      list.unshift("library");
    } else {
      list = ["library"].concat(
        list.filter(function (k) {
          return k !== "library";
        })
      );
    }
    var hasArtists = list.indexOf("artists") >= 0;
    var hasCharts = list.indexOf("charts") >= 0;
    if (!hasArtists) {
      // Replace legacy "charts" (Popular artists) with full artists block, or insert after near.
      var nearIdx = list.indexOf("near");
      if (hasCharts) {
        list = list.map(function (k) {
          return k === "charts" ? "artists" : k;
        });
      } else if (nearIdx >= 0) {
        list.splice(nearIdx + 1, 0, "artists");
      } else {
        list.push("artists");
      }
    }
    // Drop duplicate charts if artists present (artists supersedes thin Popular artists).
    if (list.indexOf("artists") >= 0) {
      list = list.filter(function (k) {
        return k !== "charts";
      });
    }
    return list;
  }

  /** Compact / demote flags for section renderers. */
  function sectionOpts(key) {
    var focus = read();
    if (focus === "all") return { primary: false, compact: false, hidden: false };
    var primaryKeys = {
      station: { library: 1, near: 1, recent: 1, hero: 1 },
      artist: { library: 1, artists: 1, hero: 1, made: 1 },
      album: { library: 1, featured: 1, trending: 1, hero: 1 },
      track: { library: 1, trending: 1, made: 1, recent: 1, hero: 1 },
      playlist: { library: 1, moods: 1, featured: 1, hero: 1 },
      video: { library: 1, trending: 1, featured: 1, hero: 1 },
    }[focus] || {};
    var isPrimary = !!primaryKeys[key];
    var demote = !isPrimary && key !== "hero" && key !== "library";
    return {
      primary: isPrimary,
      compact: demote,
      hidden: focus === "station" && (key === "moods" || key === "featured") ? false : false,
      limit: demote ? 8 : 18,
    };
  }

  function label(focus) {
    var f = normalize(focus);
    return (
      {
        all: "For you",
        station: "Stations",
        track: "Tracks",
        artist: "Artists",
        album: "Albums",
        playlist: "Playlists",
        video: "Videos",
      }[f] || "For you"
    );
  }

  /** Where a focus chip should navigate (tab + optional directory opener). */
  function destination(focus) {
    var f = normalize(focus);
    return (
      {
        all: { tab: "home", directory: null },
        station: { tab: "radio", directory: "stations" },
        track: { tab: "listen", directory: "tracks" },
        artist: { tab: "listen", directory: "artists" },
        album: { tab: "listen", directory: "albums" },
        playlist: { tab: "listen", directory: "playlists" },
        video: { tab: "listen", directory: "videos" },
      }[f] || { tab: "home", directory: null }
    );
  }

  window.SDMusicFocus = {
    FILTERS: FILTERS,
    get: get,
    set: set,
    subscribe: subscribe,
    shelfOrder: shelfOrder,
    sectionOpts: sectionOpts,
    label: label,
    destination: destination,
    normalize: normalize,
  };
})();
