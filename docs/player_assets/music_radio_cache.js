/**
 * StepDaddy Music Radio — in-memory + sessionStorage TTL cache + idle prewarm.
 * Prefer existing /api/music/radio/* endpoints. Non-blocking.
 * API: window.SDMusicRadioCache
 */
(function () {
  if (window.SDMusicRadioCache) return;

  var API = "/api/music/radio";
  var SS_PREFIX = "sd_mrc_";
  var MEM = Object.create(null);
  var DEFAULT_TTL_MS = 5 * 60 * 1000;
  var GEO_TTL_MS = 30 * 60 * 1000;
  var inflight = Object.create(null);
  var warmed = false;
  var warming = null;

  function ssGet(key) {
    try {
      var raw = sessionStorage.getItem(SS_PREFIX + key);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.exp || obj.exp < Date.now()) {
        sessionStorage.removeItem(SS_PREFIX + key);
        return null;
      }
      return obj.data;
    } catch (e) {
      return null;
    }
  }

  function ssSet(key, data, ttl) {
    try {
      sessionStorage.setItem(
        SS_PREFIX + key,
        JSON.stringify({ exp: Date.now() + (ttl || DEFAULT_TTL_MS), data: data })
      );
    } catch (e) {}
  }

  function memGet(key) {
    var hit = MEM[key];
    if (!hit) return null;
    if (hit.exp < Date.now()) {
      delete MEM[key];
      return null;
    }
    return hit.data;
  }

  function memSet(key, data, ttl) {
    MEM[key] = { exp: Date.now() + (ttl || DEFAULT_TTL_MS), data: data };
  }

  function cacheGet(key) {
    return memGet(key) || ssGet(key);
  }

  function cachePut(key, data, ttl) {
    memSet(key, data, ttl);
    ssSet(key, data, ttl);
  }

  function qs(params) {
    var u = new URLSearchParams();
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v !== undefined && v !== null && v !== "") u.set(k, String(v));
    });
    var s = u.toString();
    return s ? "?" + s : "";
  }

  function geoParams() {
    var g = null;
    try {
      g = JSON.parse(localStorage.getItem("sd_music_radio_geo") || "null");
    } catch (e) {}
    if (!g) return {};
    var p = {};
    if (g.lat != null) p.lat = g.lat;
    if (g.lon != null) p.lon = g.lon;
    if (g.countrycode) p.countrycode = g.countrycode;
    if (g.state) p.state = g.state;
    if (g.city) p.city = g.city;
    return p;
  }

  function keyFor(path, params) {
    return path + qs(params || {});
  }

  function fetchJson(path, params, opts) {
    opts = opts || {};
    var ttl = opts.ttl != null ? opts.ttl : DEFAULT_TTL_MS;
    var key = keyFor(path, params);
    if (!opts.force) {
      var hit = cacheGet(key);
      if (hit != null) return Promise.resolve(hit);
    }
    if (inflight[key]) return inflight[key];
    inflight[key] = fetch(API + path + qs(params), { credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) throw new Error("radio_api_" + r.status);
        return r.json();
      })
      .then(function (data) {
        cachePut(key, data, ttl);
        return data;
      })
      .finally(function () {
        delete inflight[key];
      });
    return inflight[key];
  }

  function prefetchCss() {
    ["music_radio.css", "music_listen.css", "music_home.css", "music_player.css"].forEach(function (name) {
      var id = "sd-pre-" + name;
      if (document.getElementById(id)) return;
      var link = document.createElement("link");
      link.id = id;
      link.rel = "preload";
      link.as = "style";
      link.href = "/tv-assets/" + name + "?v=" + encodeURIComponent(window.__SD_BUNDLE_VERSION || "1");
      document.head.appendChild(link);
    });
  }

  function prewarm(opts) {
    opts = opts || {};
    if (warming) return warming;
    if (warmed && !opts.force) return Promise.resolve({ ok: true, cached: true });
    var started = Date.now();
    prefetchCss();
    var geo = geoParams();
    var homeParams = Object.assign({}, geo);
    var dialParams = Object.assign({}, geo, { limit: 72 });
    var stationsParams = Object.assign({}, geo, { limit: 24 });

    var tasks = [
      fetchJson("/home", homeParams).catch(function () {
        return null;
      }),
      fetchJson("/dial", dialParams).catch(function () {
        return null;
      }),
      fetchJson("/stations", stationsParams).catch(function () {
        return null;
      }),
    ];

    // Soft-touch Listen home for Music Home shelves (non-blocking)
    tasks.push(
      fetch("/api/music/listen/home", { credentials: "same-origin" })
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (data) {
          if (data) cachePut("listen:/home", data, DEFAULT_TTL_MS);
          return data;
        })
        .catch(function () {
          return null;
        })
    );

    warming = Promise.all(tasks).then(function (results) {
      warmed = true;
      warming = null;
      var home = results[0];
      if (home && home.geo) {
        try {
          var prev = JSON.parse(localStorage.getItem("sd_music_radio_geo") || "null") || {};
          localStorage.setItem(
            "sd_music_radio_geo",
            JSON.stringify(Object.assign({}, prev, home.geo))
          );
        } catch (e) {}
        cachePut("geo", home.geo, GEO_TTL_MS);
      }
      var out = {
        ok: true,
        ms: Date.now() - started,
        home: !!(home && (home.near_you || home.roots)),
        dial: !!(results[1] && results[1].dial),
        stations: !!(results[2] && results[2].stations),
        listenHome: !!results[3],
      };
      try {
        window.__sdMusicPrewarm = out;
      } catch (e) {}
      return out;
    });
    return warming;
  }

  function schedulePrewarm(delayMs) {
    var d = delayMs != null ? delayMs : 400;
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(
        function () {
          prewarm();
        },
        { timeout: Math.max(1200, d + 800) }
      );
    } else {
      setTimeout(function () {
        prewarm();
      }, d);
    }
  }

  function getCached(path, params) {
    return cacheGet(keyFor(path, params));
  }

  function getListenHomeCached() {
    return cacheGet("listen:/home");
  }

  window.SDMusicRadioCache = {
    api: fetchJson,
    get: getCached,
    put: cachePut,
    prewarm: prewarm,
    schedulePrewarm: schedulePrewarm,
    prefetchCss: prefetchCss,
    geoParams: geoParams,
    getListenHomeCached: getListenHomeCached,
    isWarm: function () {
      return !!warmed;
    },
    last: function () {
      return window.__sdMusicPrewarm || null;
    },
  };
})();
