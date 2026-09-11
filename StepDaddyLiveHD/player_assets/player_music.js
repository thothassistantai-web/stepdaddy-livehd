/* player_music: Music slide-up shell — Home / Radio / Listen */
(function sdMusicBoot() {
  let open = false;
  let wired = false;
  let tab = "home";
  let homeMount = null;
  let radioMount = null;
  let listenMount = null;
  let idlePrewarmTimer = null;

  function $(id) {
    return document.getElementById(id);
  }

  function tvUrl() {
    let ch = "";
    try {
      ch = localStorage.getItem("sd_last_tv_channel") || "";
    } catch (e) {}
    return ch ? "/tv/" + encodeURIComponent(ch) : "/tv/";
  }

  function parseMusicPath(path) {
    const p = (path || "").replace(/\/$/, "") || "/";
    let m = p.match(/^\/music\/t\/([A-Za-z0-9_-]{11})$/);
    if (m) return { tab: "listen", videoId: m[1], share: true };
    m = p.match(/^\/music\/r\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
    if (m) return { tab: "radio", stationId: m[1], share: true };
    m = p.match(/^\/music\/listen\/([A-Za-z0-9_-]{11})$/);
    if (m) return { tab: "listen", videoId: m[1], share: true };
    m = p.match(/^\/music\/radio\/([0-9a-f-]{36})$/i);
    if (m) return { tab: "radio", stationId: m[1], share: true };
    if (p === "/music" || p === "/music/home") return { tab: "home" };
    if (p === "/music/radio") return { tab: "radio" };
    if (p === "/music/listen" || p.startsWith("/music/listen/")) return { tab: "listen" };
    if (p.startsWith("/music/")) return { tab: "home", deep: p.slice("/music/".length) };
    return null;
  }

  function musicUrl(state) {
    const t = (state && state.tab) || tab || "home";
    if (t === "listen") return "/music/listen";
    if (t === "radio") return "/music/radio";
    if (t === "home") return "/music";
    return "/music";
  }

  function readShareDeepLink() {
    try {
      const boot = window.__SD_MUSIC_SHARE;
      if (boot && boot.id) {
        return {
          kind: boot.kind || (boot.id.length === 11 ? "listen" : "radio"),
          id: String(boot.id),
          title: boot.title || "",
          artist: boot.artist || "",
          album: boot.album || "",
          image: boot.image || "",
          expand: boot.expand !== 0,
        };
      }
    } catch (e) {}
    const params = new URLSearchParams(location.search);
    const parsed = parseMusicPath(location.pathname);
    const videoId =
      (parsed && parsed.videoId) || params.get("v") || params.get("videoId") || "";
    const stationId =
      (parsed && parsed.stationId) ||
      params.get("station") ||
      params.get("s") ||
      params.get("stationuuid") ||
      "";
    if (videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return {
        kind: "listen",
        id: videoId,
        title: params.get("title") || "",
        artist: params.get("artist") || "",
        album: params.get("album") || "",
        image: params.get("img") || params.get("image") || "",
        expand: true,
      };
    }
    if (stationId && /^[0-9a-f-]{36}$/i.test(stationId)) {
      return {
        kind: "radio",
        id: stationId,
        title: params.get("name") || params.get("title") || "",
        artist: "",
        album: "",
        image: params.get("img") || params.get("favicon") || "",
        expand: true,
      };
    }
    return null;
  }

  function expandSharedPlayer() {
    try {
      if (window.StepDaddyMusicPlayer && typeof window.StepDaddyMusicPlayer.setExpanded === "function") {
        window.StepDaddyMusicPlayer.setExpanded(true);
      }
    } catch (e) {}
  }

  function bootShareDeepLink(share) {
    if (!share || !share.id || window.__sdMusicShareBooted) return;
    window.__sdMusicShareBooted = true;
    var tries = 0;
    function go() {
      tries += 1;
      if (share.kind === "listen") {
        if (window.StepDaddyMusicListen && typeof window.StepDaddyMusicListen.playVideoId === "function") {
          var seed = {
            videoId: share.id,
            title: share.title || undefined,
            artists: share.artist ? [share.artist] : undefined,
            subtitle: share.artist || undefined,
            thumb: share.image || undefined,
            album: share.album || undefined,
          };
          Promise.resolve(window.StepDaddyMusicListen.playVideoId(share.id, [seed]))
            .then(function () {
              if (share.expand) {
                setTimeout(expandSharedPlayer, 250);
                setTimeout(expandSharedPlayer, 900);
              }
            })
            .catch(function () {});
          return;
        }
      } else if (share.kind === "radio") {
        if (window.StepDaddyMusicRadio && typeof window.StepDaddyMusicRadio.playStation === "function") {
          var st = {
            stationuuid: share.id,
            name: share.title || "Radio",
            favicon: share.image || "",
          };
          fetch("/api/music/radio/station/" + encodeURIComponent(share.id), {
            credentials: "same-origin",
          })
            .then(function (r) {
              return r.json();
            })
            .then(function (data) {
              var full = (data && (data.station || data)) || st;
              if (!full.stationuuid) full.stationuuid = share.id;
              return window.StepDaddyMusicRadio.playStation(full);
            })
            .catch(function () {
              return window.StepDaddyMusicRadio.playStation(st);
            })
            .then(function () {
              if (share.expand) {
                setTimeout(expandSharedPlayer, 250);
                setTimeout(expandSharedPlayer, 900);
              }
            });
          return;
        }
      }
      if (tries < 50) setTimeout(go, 160);
    }
    setTimeout(go, 280);
  }

  function setRootOpen(isOpen) {
    const root = document.querySelector(".tv-root");
    if (root) root.classList.toggle("music-catalog-open", !!isOpen);
  }

  function scheduleRadioPrewarm(delay) {
    try {
      if (window.SDMusicRadioCache && typeof window.SDMusicRadioCache.schedulePrewarm === "function") {
        window.SDMusicRadioCache.schedulePrewarm(delay != null ? delay : 350);
      }
    } catch (e) {}
  }

  function ensureHomeMounted(opts) {
    opts = opts || {};
    const el = $("musicHomeRoot");
    if (!el) return;
    if (homeMount) {
      if (opts.refresh) {
        try {
          if (typeof homeMount.refresh === "function") homeMount.refresh();
        } catch (e) {}
      }
      return;
    }
    if (!window.StepDaddyMusicHome || typeof window.StepDaddyMusicHome.mount !== "function") {
      if (!el.dataset.mhWait) {
        el.dataset.mhWait = "1";
        el.innerHTML = '<p class="music-home-muted">Home loading…</p>';
      }
      setTimeout(function () {
        ensureHomeMounted(opts);
      }, 200);
      return;
    }
    try {
      el.innerHTML = "";
      delete el.dataset.mhWait;
      el.__mhMounted = true;
      homeMount = window.StepDaddyMusicHome.mount(el, {
        onBack: function () {
          close();
        },
      });
    } catch (e) {
      el.innerHTML = '<p class="music-home-muted">Home failed to load.</p>';
    }
  }

  function ensureRadioMounted() {
    const el = $("musicRadioRoot");
    if (!el) return;
    if (radioMount) return;
    if (!window.StepDaddyMusicRadio || typeof window.StepDaddyMusicRadio.mount !== "function") {
      if (!el.dataset.mrWait) {
        el.dataset.mrWait = "1";
        el.innerHTML = '<p class="music-home-muted">Radio module loading…</p>';
      }
      setTimeout(ensureRadioMounted, 200);
      return;
    }
    try {
      el.innerHTML = "";
      delete el.dataset.mrWait;
      el.__mrMounted = true;
      radioMount = window.StepDaddyMusicRadio.mount(el, {
        onBack: function () {
          close();
        },
      });
    } catch (e) {
      el.innerHTML = '<p class="music-home-muted">Radio failed to load.</p>';
    }
  }

  function ensureListenMounted() {
    const el = $("musicListenRoot");
    if (!el) return;
    if (listenMount) return;
    if (!window.StepDaddyMusicListen || typeof window.StepDaddyMusicListen.mount !== "function") {
      if (!el.dataset.mlWait) {
        el.dataset.mlWait = "1";
        el.innerHTML = '<p class="music-home-muted">Listen module loading…</p>';
      }
      setTimeout(ensureListenMounted, 200);
      return;
    }
    try {
      el.innerHTML = "";
      delete el.dataset.mlWait;
      el.__mlMounted = true;
      listenMount = window.StepDaddyMusicListen.mount(el, {
        onBack: function () {
          close();
        },
      });
    } catch (e) {
      el.innerHTML = '<p class="music-home-muted">Listen failed to load.</p>';
    }
  }

  function ensureSharedPlayer() {
    const catalog = $("musicCatalog");
    if (!catalog) return;
    if (!window.StepDaddyMusicPlayer || typeof window.StepDaddyMusicPlayer.ensure !== "function") {
      setTimeout(ensureSharedPlayer, 200);
      return;
    }
    try {
      window.StepDaddyMusicPlayer.ensure(catalog);
    } catch (e) {}
  }

  function ensureMusicSearch() {
    const el = $("musicUnifiedSearch");
    if (!el) return;
    if (el.__msMounted) return;
    if (!window.StepDaddyMusicSearch || typeof window.StepDaddyMusicSearch.mount !== "function") {
      setTimeout(ensureMusicSearch, 200);
      return;
    }
    try {
      el.__msMounted = true;
      window.__sdMusicSearch = window.StepDaddyMusicSearch.mount(el);
    } catch (e) {}
  }

  function normalizeTab(next) {
    if (next === "listen" || next === "radio" || next === "home") return next;
    return "home";
  }

  function setTab(next, opts) {
    opts = opts || {};
    tab = normalizeTab(next);
    const tabs = document.querySelectorAll(".music-home-tab");
    tabs.forEach((btn) => {
      const on = btn.getAttribute("data-music-tab") === tab;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    const panels = document.querySelectorAll("[data-music-panel]");
    panels.forEach((panel) => {
      const on = panel.getAttribute("data-music-panel") === tab;
      panel.hidden = !on;
    });
    /* Header Home|Radio|Listen must clear search overlay so the tab panel is usable (desktop field). */
    if (!opts.keepSearch) {
      try {
        if (window.__sdMusicSearch && typeof window.__sdMusicSearch.dismiss === "function") {
          window.__sdMusicSearch.dismiss();
        }
      } catch (eDismiss) {}
    }
    if (tab === "home") ensureHomeMounted({ refresh: !!opts.refreshHome });
    if (tab === "radio") ensureRadioMounted();
    if (tab === "listen") ensureListenMounted();
    ensureSharedPlayer();
    ensureMusicSearch();
    scheduleRadioPrewarm(tab === "radio" ? 0 : 200);
    if (opts.pushUrl || opts.replaceUrl) {
      const url = musicUrl({ tab });
      const path = location.pathname.replace(/\/$/, "") || "/";
      if (path !== url.replace(/\/$/, "")) {
        if (opts.replaceUrl) history.replaceState({ sdMusic: { tab } }, "", url);
        else history.pushState({ sdMusic: { tab } }, "", url);
      } else if (opts.replaceUrl) {
        history.replaceState({ sdMusic: { tab } }, "", url);
      }
    }
  }

  function close(silent) {
    open = false;
    if (idlePrewarmTimer) {
      clearTimeout(idlePrewarmTimer);
      idlePrewarmTimer = null;
    }
    const sheet = $("musicCatalog");
    const backdrop = $("musicCatalogBackdrop");
    if (sheet) {
      sheet.classList.remove("open");
      sheet.setAttribute("aria-hidden", "true");
    }
    if (backdrop) backdrop.classList.remove("open");
    setRootOpen(false);
    try {
      if (window.StepDaddyMusicPlayer && typeof window.StepDaddyMusicPlayer.syncHost === "function") {
        window.StepDaddyMusicPlayer.syncHost();
      }
    } catch (e) {}
    if (!silent) {
      const path = location.pathname.replace(/\/$/, "") || "/";
      if (path === "/music" || path.startsWith("/music/")) {
        history.replaceState(null, "", tvUrl());
      }
    }
  }

  function openHome(opts) {
    opts = opts || {};
    try {
      if (typeof window.SDCloseVodCatalogUI === "function") window.SDCloseVodCatalogUI();
    } catch (e) {}
    try {
      if (window.SDParty && typeof window.SDParty.closeHome === "function") {
        window.SDParty.closeHome(true);
      }
    } catch (e) {}
    wireOnce();
    open = true;
    const sheet = $("musicCatalog");
    const backdrop = $("musicCatalogBackdrop");
    if (sheet) {
      sheet.classList.add("open");
      sheet.setAttribute("aria-hidden", "false");
    }
    if (backdrop) backdrop.classList.add("open");
    setRootOpen(true);
    try {
      if (window.StepDaddyMusicPlayer && typeof window.StepDaddyMusicPlayer.syncHost === "function") {
        window.StepDaddyMusicPlayer.syncHost();
      }
    } catch (e) {}

    let nextTab = opts.tab || tab;
    const share = opts.share || readShareDeepLink();
    if (!opts.tab) {
      const parsed = parseMusicPath(location.pathname);
      if (parsed && parsed.tab) nextTab = parsed.tab;
      if (share && share.kind === "listen") nextTab = "listen";
      if (share && share.kind === "radio") nextTab = "radio";
      if (history.state && history.state.sdMusic && history.state.sdMusic.tab && !share) {
        nextTab = history.state.sdMusic.tab;
      }
    }
    setTab(nextTab, { refreshHome: nextTab === "home" });
    scheduleRadioPrewarm(120);

    // Idle on Home → keep Radio warm
    if (idlePrewarmTimer) clearTimeout(idlePrewarmTimer);
    idlePrewarmTimer = setTimeout(function () {
      if (open && tab === "home") scheduleRadioPrewarm(0);
    }, 2500);

    const path = location.pathname.replace(/\/$/, "") || "/";
    const url = musicUrl({ tab: nextTab });
    const keepSharePath =
      !!share &&
      (/^\/music\/(t|r)\//.test(path) ||
        /[?&](v|videoId|station|s)=/.test(location.search || ""));
    if (path !== "/music" && !path.startsWith("/music/")) {
      if (opts.replace) history.replaceState({ sdMusic: { tab: nextTab } }, "", url);
      else history.pushState({ sdMusic: { tab: nextTab } }, "", url);
    } else if (opts.replace && !keepSharePath) {
      history.replaceState({ sdMusic: { tab: nextTab } }, "", url);
    }

    if (share) bootShareDeepLink(share);

    try {
      const focusTarget = $("musicHomeBrand") || $("closeMusicCatalog");
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    } catch (e) {}
  }

  function wireOnce() {
    if (wired) return;
    wired = true;

    const closeBtn = $("closeMusicCatalog");
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        close();
      });
    }
    const backdrop = $("musicCatalogBackdrop");
    if (backdrop) {
      backdrop.addEventListener("click", (e) => {
        e.preventDefault();
        close();
      });
    }
    const brand = $("musicHomeBrand");
    if (brand) {
      brand.addEventListener("click", (e) => {
        e.preventDefault();
        setTab("home", { replaceUrl: true, refreshHome: true });
      });
    }
    const tabs = $("musicCatalogTabs");
    if (tabs) {
      tabs.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-music-tab]");
        if (!btn) return;
        e.preventDefault();
        setTab(btn.getAttribute("data-music-tab"), { pushUrl: true });
      });
    }
    const musicBtn = $("musicCatalogBtn");
    if (musicBtn) {
      musicBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (open) close();
        else openHome();
      });
    }

    window.addEventListener("popstate", () => {
      const path = location.pathname.replace(/\/$/, "") || "/";
      const parsed = parseMusicPath(path);
      if (parsed) openHome({ replace: true, tab: parsed.tab });
      else if (open) close(true);
    });

    document.addEventListener("keydown", (e) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    });

    // Chrome idle: soft-prewarm Radio when Music button is visible
    scheduleRadioPrewarm(1800);
  }

  /* SDMusicFocus comes from music_focus.js (shelfOrder + persistence). */

  function install() {
    wireOnce();
    ensureSharedPlayer();
    ensureMusicSearch();
    try {
      if (window.SDMusicFocus && window.SDMusicFocus.set) {
        window.SDMusicFocus.set(window.SDMusicFocus.get(), { force: true });
      }
    } catch (e) {}
    window.SDMusic = {
      open: openHome,
      close,
      isOpen: () => open,
      setTab,
      parsePath: parseMusicPath,
      ensureHome: ensureHomeMounted,
      ensureRadio: ensureRadioMounted,
      ensureListen: ensureListenMounted,
      ensurePlayer: ensureSharedPlayer,
      ensureSearch: ensureMusicSearch,
      getFocus: function () {
        return window.SDMusicFocus.get();
      },
      setFocus: function (f) {
        return window.SDMusicFocus.set(f);
      },
      prewarmRadio: function () {
        return window.SDMusicRadioCache && window.SDMusicRadioCache.prewarm
          ? window.SDMusicRadioCache.prewarm()
          : Promise.resolve(null);
      },
    };

    try {
      const bootPath = location.pathname.replace(/\/$/, "") || "/";
      if (parseMusicPath(bootPath)) {
        setTimeout(() => {
          if (!open && parseMusicPath(location.pathname)) openHome({ replace: true });
        }, 0);
      }
    } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})();
