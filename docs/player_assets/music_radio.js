/**
 * StepDaddy Music Radio — Radio Browser hierarchy UI.
 * Mount: window.StepDaddyMusicRadio.mount(containerEl, { geo?, onClose? })
 * Playback via shared StepDaddyMusicPlayer (no local <audio>).
 */
(function () {
  if (window.StepDaddyMusicRadio) return;

  const API = "/api/music/radio";
  const LS_GEO = "sd_music_radio_geo";

  function ensureCss() {
    if (document.getElementById("sd-music-radio-css")) return;
    const link = document.createElement("link");
    link.id = "sd-music-radio-css";
    link.rel = "stylesheet";
    link.href = "/tv-assets/music_radio.css?v=" + encodeURIComponent(window.__SD_BUNDLE_VERSION || "1");
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
    const u = new URLSearchParams();
    Object.keys(params || {}).forEach(function (k) {
      const v = params[k];
      if (v !== undefined && v !== null && v !== "") u.set(k, v);
    });
    const s = u.toString();
    return s ? "?" + s : "";
  }

  async function api(path, params) {
    if (window.SDMusicRadioCache && typeof window.SDMusicRadioCache.api === "function") {
      return window.SDMusicRadioCache.api(path, params);
    }
    const r = await fetch(API + path + qs(params), { credentials: "same-origin" });
    if (!r.ok) throw new Error("radio_api_" + r.status);
    return r.json();
  }

  function stationTitle(st) {
    if (!st) return "Station";
    return st.display_name || st.name || "Station";
  }

  function stationInitials(st) {
    var src = String((st && (st.callsign || st.brand || st.display_name || st.name)) || "?").trim();
    var call = String((st && st.callsign) || "").trim().toUpperCase();
    if (call && call.length <= 5) return call.slice(0, 4);
    var parts = src.replace(/[·•|]/g, " ").split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return src.slice(0, 2).toUpperCase() || "FM";
  }

  function stationFallbackArt(st) {
    var label = esc(stationInitials(st)).slice(0, 4);
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop stop-color="#1a2332"/><stop offset="1" stop-color="#243044"/>' +
      "</linearGradient></defs>" +
      '<rect width="96" height="96" rx="18" fill="url(#g)"/>' +
      '<circle cx="48" cy="40" r="22" fill="none" stroke="#3b82f6" stroke-width="3" opacity=".85"/>' +
      '<circle cx="48" cy="40" r="4" fill="#3b82f6"/>' +
      '<text x="48" y="78" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="16" font-weight="700" fill="#e8eaef">' +
      label +
      "</text></svg>";
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  function stationArtHtml(st) {
    var fallback = stationFallbackArt(st);
    var url = st && st.favicon ? String(st.favicon) : "";
    if (url) {
      return (
        '<img src="' +
        esc(url) +
        '" alt="" loading="lazy" referrerpolicy="no-referrer" data-fallback="' +
        esc(fallback) +
        '" onerror="this.onerror=null;this.src=this.getAttribute(\'data-fallback\')"/>'
      );
    }
    return '<img src="' + esc(fallback) + '" alt="" loading="lazy"/>';
  }

  function player() {
    return window.StepDaddyMusicPlayer;
  }

  function loadSavedGeo() {
    try {
      return JSON.parse(localStorage.getItem(LS_GEO) || "null");
    } catch (e) {
      return null;
    }
  }

  function saveGeo(g) {
    try {
      localStorage.setItem(LS_GEO, JSON.stringify(g));
    } catch (e) {}
  }

  function browserGeo(timeoutMs) {
    return new Promise(function (resolve) {
      if (!navigator.geolocation) return resolve(null);
      const t = setTimeout(function () {
        resolve(null);
      }, timeoutMs || 5000);
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          clearTimeout(t);
          resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, source: "browser" });
        },
        function () {
          clearTimeout(t);
          resolve(null);
        },
        { enableHighAccuracy: false, maximumAge: 600000, timeout: timeoutMs || 5000 }
      );
    });
  }

  function Mount(container, opts) {
    opts = opts || {};
    ensureCss();
    container.classList.add("sd-music-radio");
    container.innerHTML = "";

    const head = document.createElement("div");
    head.className = "mr-head";
    head.innerHTML =
      '<button type="button" class="mr-back" data-mr-back aria-label="Back">←</button>' +
      '<div><div class="mr-title">Radio</div><div class="mr-sub" data-mr-loc>Locating…</div></div>';
    container.appendChild(head);

    const body = document.createElement("div");
    body.className = "mr-body";
    container.appendChild(body);

    let stack = [];
    let geo = opts.geo || loadSavedGeo() || {};
    let homeData = null;
    let dialList = [];
    let dialLoading = null;
    let stationsDir = false;
    let stationsDirQ = "";
    let renderGen = 0;

    function setLocLabel(g) {
      const el = head.querySelector("[data-mr-loc]");
      if (!el) return;
      if (!g || (!g.city && !g.state && !g.countrycode)) {
        el.textContent = "Worldwide · home focus pending";
        return;
      }
      const bits = [g.city, g.state, g.countrycode].filter(Boolean);
      el.textContent = "Near you · " + bits.join(", ") + (g.source ? " (" + g.source + ")" : "");
    }

    async function ensureDial(force) {
      if (dialList.length && !force) return dialList;
      if (dialLoading) return dialLoading;
      const params = {};
      if (geo.lat != null) params.lat = geo.lat;
      if (geo.lon != null) params.lon = geo.lon;
      if (geo.countrycode) params.countrycode = geo.countrycode;
      if (geo.state) params.state = geo.state;
      if (geo.city) params.city = geo.city;
      params.limit = 72;
      dialLoading = api("/dial", params)
        .then(function (data) {
          dialList = (data && data.dial) || [];
          const P = player();
          if (P && typeof P.setDialList === "function") {
            const cur = P.getState && P.getState();
            P.setDialList(dialList, cur && cur.id);
          }
          return dialList;
        })
        .catch(function () {
          return dialList;
        })
        .finally(function () {
          dialLoading = null;
        });
      return dialLoading;
    }

    async function playStation(st) {
      if (!st || !st.playable || !st.stream_url) return;
      const P = player();
      if (!P || typeof P.play !== "function") return;

      try {
        fetch(API + "/click/" + encodeURIComponent(st.stationuuid), {
          method: "POST",
          credentials: "same-origin",
        }).catch(function () {});
      } catch (e) {}

      if (!dialList.length) {
        try {
          await ensureDial();
        } catch (e) {}
      }

      await P.play({
        source: "radio",
        id: st.stationuuid,
        title: stationTitle(st),
        subtitle: [st.city, st.state, st.band, st.genre].filter(Boolean).join(" · "),
        artwork: st.favicon || stationFallbackArt(st),
        streamUrl: st.stream_url,
        hls: !!st.hls || /\.m3u8(\?|$)/i.test(st.stream_url || ""),
        videoUrl: st.video_url || "",
        band: st.dial_segment || st.dial_band || st.band || "",
        dial: st.dial || "",
        homepage: st.homepage || "",
        genre: st.genre || "",
        station: st,
        dialList: dialList,
        onPrev: function () {
          if (P.tuneDial) P.tuneDial(-1);
        },
        onNext: function () {
          if (P.tuneDial) P.tuneDial(1);
        },
        onDialTune: function (nextSt) {
          playStation(nextSt);
        },
      });
    }

    head.querySelector("[data-mr-back]").addEventListener("click", function () {
      if (stationsDir) {
        stationsDir = false;
        stationsDirQ = "";
        stack = [];
        render();
        return;
      }
      if (stack.length) {
        stack.pop();
        render();
        return;
      }
      if (typeof opts.onBack === "function") opts.onBack();
      else if (typeof opts.onClose === "function") opts.onClose();
    });

    function filtersFromStack() {
      const f = {};
      stack.forEach(function (step) {
        if (step.key === "class") f.class = step.value;
        else f[step.key] = step.value;
      });
      if (geo.countrycode) f.countrycode = geo.countrycode;
      if (geo.lat != null) f.lat = geo.lat;
      if (geo.lon != null) f.lon = geo.lon;
      return f;
    }

    function crumbTitle() {
      if (!stack.length) return "Radio";
      return stack.map(function (s) { return s.label || s.value; }).join(" / ");
    }

    function renderStations(list, title) {
      const sec = document.createElement("div");
      sec.className = "mr-section";
      sec.innerHTML = "<h3>" + esc(title || "Stations") + "</h3>";
      if (!list || !list.length) {
        sec.innerHTML += '<div class="mr-empty">No stations here yet.</div>';
        return sec;
      }
      list.forEach(function (st) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mr-station" + (st.playable ? "" : " dead") + (st.seeded ? " seeded" : "");
        const fav = stationArtHtml(st);
        const subBits = [
          st.band,
          st.genre,
          st.bitrate ? st.bitrate + "kbps" : "",
          st.seeded ? "local" : "",
        ].filter(Boolean);
        btn.innerHTML =
          fav +
          '<span><span class="n">' +
          esc(stationTitle(st)) +
          '</span><span class="c">' +
          esc(subBits.join(" · ")) +
          "</span></span>" +
          '<span class="mr-station-end">' +
          '<button type="button" class="play-dot" aria-label="Play">▶</button>' +
          (window.SDMusicLibrary && window.SDMusicLibrary.addBtnHtml
            ? window.SDMusicLibrary.addBtnHtml("mr-add")
            : "") +
          "</span>";
        btn.addEventListener("click", function (e) {
          if (e.target.closest("[data-ml-add]")) return;
          if (e.target.closest(".play-dot")) {
            e.preventDefault();
            e.stopPropagation();
          }
          playStation(st);
        });
        try {
          if (window.SDMusicLibrary && window.SDMusicLibrary.wireAddButton) {
            var addBtn = btn.querySelector("[data-ml-add]");
            if (addBtn) {
              window.SDMusicLibrary.wireAddButton(
                addBtn,
                Object.assign({}, st, { kind: "station", title: stationTitle(st) })
              );
            }
          }
        } catch (e) {}
        sec.appendChild(btn);
      });
      return sec;
    }

    function renderFacets(facets, level) {
      const sec = document.createElement("div");
      sec.className = "mr-section";
      sec.innerHTML = "<h3>" + esc(level) + "</h3>";
      const grid = document.createElement("div");
      grid.className = "mr-grid";
      (facets || []).forEach(function (f) {
        if (!f.count) return;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "mr-card";
        b.innerHTML =
          '<span class="n">' + esc(f.name) + '</span><span class="c">' + esc(f.count) + " stations</span>";
        b.addEventListener("click", function () {
          stack.push({
            key: level === "class" ? "class" : level,
            value: f.name,
            label: f.name,
          });
          render();
        });
        grid.appendChild(b);
      });
      if (!grid.children.length) {
        sec.innerHTML += '<div class="mr-empty">Nothing in this branch.</div>';
      } else {
        sec.appendChild(grid);
      }
      return sec;
    }

    async function renderHome(gen) {
      const params = {};
      if (geo.lat != null) params.lat = geo.lat;
      if (geo.lon != null) params.lon = geo.lon;
      if (geo.countrycode) params.countrycode = geo.countrycode;
      if (geo.state) params.state = geo.state;
      if (geo.city) params.city = geo.city;

      function stillHome() {
        return !stationsDir && !stack.length && (gen == null || gen === renderGen);
      }

      function paintSkeleton() {
        if (!stillHome()) return;
        body.innerHTML =
          '<div class="mr-section mr-skeleton" aria-hidden="true">' +
          "<h3>Browse</h3><div class=\"mr-grid\">" +
          '<button type="button" class="mr-card sk" disabled><span class="n"> </span></button>'.repeat(4) +
          "</div></div>" +
          '<div class="mr-section mr-skeleton" aria-hidden="true"><h3>Near you</h3>' +
          '<div class="mr-station sk"></div><div class="mr-station sk"></div><div class="mr-station sk"></div>' +
          "</div>";
      }

      function paintHome(data, fromCache) {
        if (!stillHome()) return;
        if (!data) return;
        homeData = data;
        if (homeData.geo) {
          geo = Object.assign({}, geo, homeData.geo);
          saveGeo(geo);
          setLocLabel(geo);
        }
        body.innerHTML = "";
        head.querySelector(".mr-title").textContent = "Radio";
        const roots = document.createElement("div");
        roots.className = "mr-section";
        roots.innerHTML = "<h3>Browse</h3>";
        const grid = document.createElement("div");
        grid.className = "mr-grid";
        (homeData.roots || []).forEach(function (r) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "mr-card";
          b.innerHTML =
            '<span class="n">' + esc(r.title) + '</span><span class="c">' + esc(r.subtitle || "") + "</span>";
          b.addEventListener("click", function () {
            stack = [{ key: "class", value: r.id, label: r.title }];
            render();
          });
          grid.appendChild(b);
        });
        roots.appendChild(grid);
        body.appendChild(roots);
        if (homeData.near_you && homeData.near_you.length) {
          body.appendChild(renderStations(homeData.near_you, "Near you"));
        }
        if (homeData.commercial_preview && homeData.commercial_preview.length) {
          body.appendChild(renderStations(homeData.commercial_preview.slice(0, 12), "Commercial nearby"));
        }
        if (homeData.internet_preview && homeData.internet_preview.length) {
          body.appendChild(renderStations(homeData.internet_preview.slice(0, 12), "Internet nearby"));
        }
        if (fromCache) {
          var hint = document.createElement("div");
          hint.className = "mr-cache-hint";
          hint.textContent = "Updating…";
          body.appendChild(hint);
        }
      }

      var cached =
        window.SDMusicRadioCache && typeof window.SDMusicRadioCache.get === "function"
          ? window.SDMusicRadioCache.get("/home", params)
          : null;
      if (cached && (cached.near_you || cached.roots)) {
        paintHome(cached, true);
      } else {
        paintSkeleton();
      }

      // Dial never blocks first paint — warm in background
      ensureDial(false).catch(function () {});

      // Cache-first then refresh in parallel (don't await geo)
      var refresh = api("/home", params)
        .then(function (data) {
          paintHome(data, false);
          return data;
        })
        .catch(function () {
          if (!stillHome()) return;
          if (!homeData) {
            body.innerHTML = '<div class="mr-err">Couldn’t load radio right now. Pull to retry.</div>';
          } else {
            var hint = body.querySelector(".mr-cache-hint");
            if (hint) hint.remove();
          }
        });

      // Soft parallel stations prefetch (non-blocking)
      try {
        if (window.SDMusicRadioCache && window.SDMusicRadioCache.api) {
          window.SDMusicRadioCache.api("/stations", Object.assign({}, params, { limit: 24 })).catch(function () {});
        }
      } catch (e) {}

      await refresh;
    }

    async function renderStationsDirectory() {
      head.querySelector(".mr-title").textContent = "Stations";
      body.innerHTML =
        '<div class="mr-stations-dir">' +
        '<form class="mr-stations-search" data-mr-st-search>' +
        '<input type="search" enterkeyhint="search" placeholder="Search stations…" data-mr-st-q aria-label="Search stations" autocomplete="off" value="' +
        esc(stationsDirQ) +
        '"/>' +
        '<button type="submit">Go</button>' +
        "</form>" +
        '<div class="mr-stations-body" data-mr-st-body><div class="mr-loading">Loading stations…</div></div>' +
        "</div>";

      body.querySelector("[data-mr-st-search]").addEventListener("submit", function (e) {
        e.preventDefault();
        var input = body.querySelector("[data-mr-st-q]");
        stationsDirQ = (input && input.value) || "";
        renderStationsDirectory();
      });

      var params = Object.assign({ limit: 48 }, filtersFromStack());
      if (geo.lat != null) params.lat = geo.lat;
      if (geo.lon != null) params.lon = geo.lon;
      if (geo.countrycode) params.countrycode = geo.countrycode;
      if (geo.state) params.state = geo.state;
      if (geo.city) params.city = geo.city;
      if (stationsDirQ) params.q = stationsDirQ;

      var host = body.querySelector("[data-mr-st-body]");
      try {
        // Prefer explicit stations facet; fall back to home near-you + commercial.
        var data = await api("/stations", params).catch(function () {
          return null;
        });
        var list = (data && data.stations) || [];
        if (!list.length && !stationsDirQ) {
          var home = homeData;
          if (!home) {
            try {
              home = await api("/home", params);
              homeData = home;
            } catch (e) {}
          }
          if (home) {
            list = []
              .concat(home.near_you || [])
              .concat(home.commercial_preview || [])
              .concat(home.internet_preview || []);
            // Dedupe by uuid
            var seen = Object.create(null);
            list = list.filter(function (st) {
              var id = st && st.stationuuid;
              if (!id || seen[id]) return false;
              seen[id] = true;
              return true;
            });
          }
        }
        host.innerHTML = "";
        // Quick browse roots
        if (homeData && homeData.roots && homeData.roots.length) {
          var facets = document.createElement("div");
          facets.className = "mr-section";
          facets.innerHTML = "<h3>Browse</h3>";
          var grid = document.createElement("div");
          grid.className = "mr-grid";
          homeData.roots.forEach(function (r) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "mr-card";
            b.innerHTML =
              '<span class="n">' + esc(r.title) + '</span><span class="c">' + esc(r.subtitle || "") + "</span>";
            b.addEventListener("click", function () {
              stationsDir = false;
              stack = [{ key: "class", value: r.id, label: r.title }];
              render();
            });
            grid.appendChild(b);
          });
          facets.appendChild(grid);
          host.appendChild(facets);
        }
        host.appendChild(renderStations(list, stationsDirQ ? "Results" : "Stations near you"));
      } catch (e) {
        host.innerHTML = '<div class="mr-err">Couldn’t load stations directory.</div>';
      }
    }

    async function renderBrowse() {
      body.innerHTML = '<div class="mr-loading">Browsing…</div>';
      head.querySelector(".mr-title").textContent = crumbTitle();
      const data = await api("/browse", filtersFromStack());
      body.innerHTML = "";
      if (data.level === "station") {
        body.appendChild(renderStations(data.stations, "Stations"));
      } else {
        body.appendChild(renderFacets(data.facets, data.level));
        if (data.station_count && data.level !== "class") {
          try {
            const st = await api("/stations", Object.assign({ limit: 12 }, filtersFromStack()));
            if (st.stations && st.stations.length) {
              body.appendChild(renderStations(st.stations, "Popular here"));
            }
          } catch (e) {}
        }
      }
    }

    async function render() {
      var gen = ++renderGen;
      try {
        if (stationsDir) await renderStationsDirectory();
        else if (!stack.length) await renderHome(gen);
        else await renderBrowse();
        if (gen !== renderGen) return;
      } catch (e) {
        if (gen !== renderGen) return;
        body.innerHTML = '<div class="mr-err">Couldn’t load radio right now. Pull to retry.</div>';
      }
    }

    async function initGeo() {
      setLocLabel(geo);
      // Don't block first paint on geolocation — resolve in background then soft-refresh.
      browserGeo(2500).then(function (browser) {
        if (!browser) return;
        geo = Object.assign({}, geo, browser);
        saveGeo(geo);
        setLocLabel(geo);
        if (!stack.length) {
          render().catch(function () {});
        }
      });
    }

    this.refresh = function () {
      return render();
    };
    this.destroy = function () {
      container.innerHTML = "";
    };
    this.playStation = playStation;
    this.openStationsDirectory = function () {
      stationsDir = true;
      stationsDirQ = "";
      stack = [];
      return render();
    };
    /** Leave stations directory / browse stack (focus All or Listen chips). */
    this.resetNavigation = function () {
      stationsDir = false;
      stationsDirQ = "";
      stack = [];
      return render();
    };

    // Paint immediately (cache/skeleton); geo refresh is non-blocking
    setLocLabel(geo);
    render().catch(function () {
      body.innerHTML = '<div class="mr-err">Radio failed to start.</div>';
    });
    initGeo();
  }

  function autoMount() {
    const el = document.querySelector("[data-music-radio]:not(#musicRadioRoot)");
    if (!el || el.__mrMounted) return;
    el.__mrMounted = true;
    mount(el, { auto: true });
  }

  let lastMount = null;

  function mount(el, opts) {
    if (!el) throw new Error("music_radio_mount_missing_el");
    lastMount = new Mount(el, opts || {});
    return lastMount;
  }

  window.StepDaddyMusicRadio = {
    mount: mount,
    autoMount: autoMount,
    playStation: function (st) {
      if (lastMount && typeof lastMount.playStation === "function") {
        return lastMount.playStation(st);
      }
      // Fallback: direct shared-player tune when mount not ready
      const P = player();
      if (!P || !st || !st.stream_url) return Promise.resolve();
      return P.play({
        source: "radio",
        id: st.stationuuid,
        title: stationTitle(st),
        subtitle: [st.city, st.state, st.band, st.genre].filter(Boolean).join(" · "),
        artwork: st.favicon || stationFallbackArt(st),
        streamUrl: st.stream_url,
        hls: !!st.hls || /\.m3u8(\?|$)/i.test(st.stream_url || ""),
        band: st.dial_segment || st.dial_band || st.band || "",
        dial: st.dial || "",
        station: st,
      });
    },
    openStationsDirectory: function () {
      function ensure() {
        try {
          if (window.SDMusic) {
            if (typeof window.SDMusic.open === "function") {
              window.SDMusic.open({ replace: true, tab: "radio" });
            }
            if (typeof window.SDMusic.ensureRadio === "function") {
              window.SDMusic.ensureRadio();
            }
          }
        } catch (e) {}
      }
      ensure();
      return new Promise(function (resolve) {
        var tries = 0;
        function tick() {
          if (lastMount && typeof lastMount.openStationsDirectory === "function") {
            resolve(lastMount.openStationsDirectory());
            return;
          }
          tries += 1;
          if (tries > 24) {
            resolve(null);
            return;
          }
          setTimeout(tick, 50);
        }
        tick();
      });
    },
    resetNavigation: function () {
      if (lastMount && typeof lastMount.resetNavigation === "function") {
        return Promise.resolve(lastMount.resetNavigation());
      }
      return Promise.resolve(null);
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMount);
  } else {
    setTimeout(autoMount, 0);
  }
})();
