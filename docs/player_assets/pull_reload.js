/**
 * StepDaddy pull-to-refresh — coherent site-wide gesture with a page/situation registry.
 *
 * API: window.SDPullRefresh
 *   register(id, { when, allow, handler?, label? })
 *   unregister(id)
 *   setEnabled(bool) / isEnabled()
 *   canStart(ctx?) → boolean
 *   reload() — force reload (respects deny policies unless force)
 *
 * Policy:
 *  - Default ALLOW only when primary vertical scroller is at top + strong vertical pull + hold.
 *  - DENY inside Music sheet, search results, expanded player, VOD sheets, party overlays,
 *    settings/modals, nested scrollers mid-scroll, horizontal shelf pans (axis-lock).
 *  - Music catalog was previously hard-disabled; now registered as deny while open.
 */
(function () {
  if (window.SDPullRefresh && window.SDPullRefresh.__ready) return;

  var THRESHOLD = 132;
  var HOLD_MS = 900;
  var EDGE_PX = 88;
  var AXIS_BIAS = 16;
  var H_ABORT_PX = 30;

  var style = document.createElement("style");
  style.textContent =
    "html,body{overscroll-behavior-y:contain}" +
    "#sdPullReload{position:fixed;left:50%;top:calc(10px + env(safe-area-inset-top,0px));" +
    "transform:translate(-50%,-120%);z-index:99999;pointer-events:none;" +
    "min-width:168px;padding:10px 16px;border-radius:999px;" +
    "background:rgba(12,14,20,.94);border:1px solid rgba(255,255,255,.14);" +
    "color:#e5e7eb;font:600 13px/1.2 system-ui,-apple-system,sans-serif;" +
    "text-align:center;opacity:0;transition:transform .15s ease,opacity .15s ease;" +
    "box-shadow:0 8px 24px rgba(0,0,0,.35)}" +
    "#sdPullReload.show{opacity:1;transform:translate(-50%,0)}" +
    "#sdPullReload.armed{border-color:rgba(96,165,250,.45);color:#93c5fd}" +
    "#sdPullReload.holding{border-color:rgba(52,211,153,.5);color:#6ee7b7}" +
    "#sdPullReload .bar{display:block;height:3px;margin-top:8px;border-radius:99px;" +
    "background:rgba(255,255,255,.12);overflow:hidden}" +
    "#sdPullReload .bar>i{display:block;height:100%;width:0;background:#60a5fa;" +
    "transition:width .08s linear}" +
    "#sdPullReload.holding .bar>i{background:#34d399;width:100%!important;" +
    "transition:width " +
    HOLD_MS +
    "ms linear}";
  document.head.appendChild(style);

  var el = document.createElement("div");
  el.id = "sdPullReload";
  el.setAttribute("aria-live", "polite");
  el.innerHTML =
    '<span class="lbl">Pull to reload</span><span class="bar" aria-hidden="true"><i></i></span>';
  document.documentElement.appendChild(el);
  var lbl = el.querySelector(".lbl");
  var fill = el.querySelector(".bar > i");

  var registry = Object.create(null);
  var enabled = true;
  var tracking = false;
  var startY = 0;
  var startX = 0;
  var pull = 0;
  var holdTimer = null;
  var armed = false;
  var reloading = false;
  var axis = null; // null | 'y' | 'x'

  function pathIsTv() {
    try {
      var p = (location.pathname || "").replace(/\/$/, "") || "/";
      return p === "/tv" || p.indexOf("/tv/") === 0 || p === "/" || p === "";
    } catch (e) {
      return false;
    }
  }

  function musicCatalogOpen() {
    var c = document.getElementById("musicCatalog");
    return !!(c && c.classList.contains("open"));
  }

  function musicExpanded() {
    var root = document.getElementById("sdMusicPlayer");
    return !!(root && root.classList.contains("expanded") && root.classList.contains("show"));
  }

  function musicSearchActive(target) {
    try {
      if (target && target.closest && target.closest(".ms-results, .ms-search, [data-ms-results]")) {
        return true;
      }
      var results = document.querySelector(".ms-results");
      if (results && results.classList.contains("ms-pulling")) return true;
      if (results && results.offsetParent !== null && (results.scrollTop || 0) > 2) return true;
      var sheet = document.getElementById("musicCatalog");
      if (sheet && sheet.classList.contains("open") && sheet.querySelector(".ms-results:not([hidden])")) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  function modalOrOverlayOpen() {
    try {
      if (document.querySelector(".sd-modal.open, .sd-modal[aria-hidden='false']")) return true;
      if (document.getElementById("settingsDrawer")?.classList.contains("open")) return true;
      if (document.getElementById("pcSettings")?.classList.contains("open")) return true;
      var root = document.querySelector(".tv-root");
      if (root) {
        if (root.classList.contains("vod-catalog-open")) return true;
        if (root.classList.contains("overlay-playback") || root.classList.contains("trailer-active")) {
          return true;
        }
        if (root.classList.contains("overlay-active") && !root.classList.contains("live-embed-active")) {
          return true;
        }
      }
      if (document.querySelector(".vod-catalog.open, .vod-picker.open, #vodCatalog.open")) return true;
      if (document.querySelector(".party-drawer.open, .party-av-overlay.open, #partyAvOverlay.open")) {
        return true;
      }
      if (document.querySelector(".xray-panel.open, #xrayPanel.open")) return true;
    } catch (e) {}
    return false;
  }

  var NESTED_SCROLLERS = [
    ".vod-catalog-body",
    ".vod-detail-scroll",
    ".epg-panel",
    ".grid-scroll",
    "#gridScroll",
    ".xray-scroll",
    ".settings-body",
    ".vod-picker-body",
    ".party-drawer .chat",
    ".party-drawer .party-dock",
    ".mh-body",
    ".ml-body",
    ".mr-body",
    ".mr-main",
    ".ms-results",
    "#musicCatalog .music-home-body",
    "#musicCatalog .sd-music-home",
    "#musicCatalog .sd-music-listen",
    "#musicCatalog .sd-music-radio",
    ".smp-sheet",
    ".smp-queue-panel",
    ".smp-lyrics-scroll",
  ];

  function scrollAtTop() {
    if ((window.scrollY || document.documentElement.scrollTop || 0) > 2) return false;
    var nodes = document.querySelectorAll(NESTED_SCROLLERS.join(","));
    for (var i = 0; i < nodes.length; i++) {
      try {
        if (nodes[i].scrollTop > 2) return false;
      } catch (e) {}
    }
    return true;
  }

  function inHorizontalShelf(target) {
    if (!target || !target.closest) return false;
    return !!target.closest(
      ".mh-row, .mh-shelf-scroller, .ml-shelf, .ms-chips, .mh-radio-modes, .mh-seg, " +
        "[data-mh-hscroll], .shelf-row, .chip-row, .epg-now-row"
    );
  }

  function buildCtx(target) {
    return {
      target: target || null,
      path: location.pathname || "/",
      musicOpen: musicCatalogOpen(),
      musicExpanded: musicExpanded(),
      musicSearch: musicSearchActive(target),
      modalOpen: modalOrOverlayOpen(),
      atTop: scrollAtTop(),
      isTv: pathIsTv(),
      inShelf: inHorizontalShelf(target),
    };
  }

  function evalPolicy(entry, ctx) {
    if (!entry) return null;
    try {
      if (typeof entry.when === "function" && !entry.when(ctx)) return null;
      if (typeof entry.allow === "function") {
        var r = entry.allow(ctx);
        if (r === false || r === "deny") return "deny";
        if (r === true || r === "allow") return "allow";
        return null;
      }
      if (entry.allow === false || entry.allow === "deny") return "deny";
      if (entry.allow === true || entry.allow === "allow") return "allow";
    } catch (e) {}
    return null;
  }

  function decide(ctx) {
    if (!enabled) return { ok: false, reason: "disabled" };
    // Registry: any explicit deny wins; explicit allow is advisory.
    var ids = Object.keys(registry);
    var denied = null;
    for (var i = 0; i < ids.length; i++) {
      var verdict = evalPolicy(registry[ids[i]], ctx);
      if (verdict === "deny") {
        denied = ids[i];
        break;
      }
    }
    if (denied) return { ok: false, reason: denied };
    if (!ctx.atTop) return { ok: false, reason: "not-at-top" };
    if (ctx.inShelf) return { ok: false, reason: "horizontal-shelf" };
    return { ok: true, reason: "allow" };
  }

  function register(id, policy) {
    if (!id) return;
    registry[String(id)] = policy || { allow: "deny" };
  }

  function unregister(id) {
    try {
      delete registry[String(id)];
    } catch (e) {}
  }

  // ---- Built-in situation registry ----
  register("music_catalog", {
    when: function (ctx) {
      return ctx.musicOpen;
    },
    allow: "deny",
  });
  register("music_expanded", {
    when: function (ctx) {
      return ctx.musicExpanded;
    },
    allow: "deny",
  });
  register("music_search", {
    when: function (ctx) {
      return ctx.musicSearch;
    },
    allow: "deny",
  });
  register("modal_overlay", {
    when: function (ctx) {
      return ctx.modalOpen;
    },
    allow: "deny",
  });
  register("tv_guide", {
    when: function (ctx) {
      return ctx.isTv && !ctx.musicOpen && !ctx.modalOpen;
    },
    allow: function (ctx) {
      // Strong top-only pull on TV / guide; nested EPG mid-scroll already fails atTop.
      return !!ctx.atTop;
    },
  });

  function reset() {
    tracking = false;
    pull = 0;
    armed = false;
    axis = null;
    clearTimeout(holdTimer);
    holdTimer = null;
    el.classList.remove("show", "armed", "holding");
    if (fill) fill.style.width = "0%";
    if (lbl) lbl.textContent = "Pull to reload";
  }

  function doReload(force) {
    if (reloading) return;
    if (!force) {
      var d = decide(buildCtx(null));
      if (!d.ok) {
        reset();
        return;
      }
    }
    reloading = true;
    if (lbl) lbl.textContent = "Reloading…";
    el.classList.add("show", "holding");
    try {
      location.reload();
    } catch (e) {
      reloading = false;
      reset();
    }
  }

  function armHold() {
    if (holdTimer || reloading) return;
    armed = true;
    el.classList.add("armed", "holding");
    if (lbl) lbl.textContent = "Hold to reload…";
    if (fill) fill.style.width = "100%";
    holdTimer = setTimeout(function () {
      doReload(false);
    }, HOLD_MS);
  }

  function cancelHold() {
    clearTimeout(holdTimer);
    holdTimer = null;
    el.classList.remove("holding");
    if (fill) fill.style.width = Math.min(100, (pull / THRESHOLD) * 100) + "%";
    if (armed && pull >= THRESHOLD) {
      if (lbl) lbl.textContent = "Hold to reload";
      el.classList.add("armed");
    }
  }

  function onStart(y, x, target) {
    if (reloading || !enabled) return;
    var ctx = buildCtx(target);
    var d = decide(ctx);
    if (!d.ok) return;
    // Prefer top-edge starts; still allow full-width when already at scroll top on TV.
    if (y > EDGE_PX * 1.6 && !ctx.isTv) return;
    tracking = true;
    startY = y;
    startX = x;
    pull = 0;
    armed = false;
    axis = null;
  }

  function onMove(y, x, target) {
    if (!tracking || reloading) return;
    var ctx = buildCtx(target);
    if (!decide(ctx).ok) {
      reset();
      return;
    }
    var dy = y - startY;
    var dx = x - startX;
    if (axis == null) {
      if (Math.abs(dx) < AXIS_BIAS && Math.abs(dy) < AXIS_BIAS) return;
      axis = Math.abs(dx) > Math.abs(dy) * 1.05 ? "x" : "y";
    }
    // Horizontal shelf pans / diagonal scrolls must never arm reload.
    if (axis === "x" || Math.abs(dx) + AXIS_BIAS >= Math.abs(dy) || Math.abs(dx) > H_ABORT_PX) {
      reset();
      return;
    }
    if (dy < 0) {
      reset();
      return;
    }
    if (!scrollAtTop()) {
      reset();
      return;
    }
    pull = dy;
    var pct = Math.min(100, (pull / THRESHOLD) * 100);
    el.classList.add("show");
    if (fill) fill.style.width = pct + "%";
    if (pull >= THRESHOLD) {
      if (lbl) lbl.textContent = "Hold to reload";
      el.classList.add("armed");
      armHold();
    } else {
      cancelHold();
      armed = false;
      el.classList.remove("armed");
      if (lbl) lbl.textContent = "Pull to reload";
    }
  }

  function onEnd() {
    if (!tracking) return;
    cancelHold();
    reset();
  }

  document.addEventListener(
    "touchstart",
    function (e) {
      if (!e.touches || !e.touches.length) return;
      var t = e.touches[0];
      onStart(t.clientY, t.clientX, e.target);
    },
    { passive: true, capture: true }
  );
  document.addEventListener(
    "touchmove",
    function (e) {
      if (!tracking || !e.touches || !e.touches.length) return;
      var t = e.touches[0];
      onMove(t.clientY, t.clientX, e.target);
    },
    { passive: true, capture: true }
  );
  document.addEventListener("touchend", onEnd, { passive: true, capture: true });
  document.addEventListener("touchcancel", onEnd, { passive: true, capture: true });

  var mouseDown = false;
  document.addEventListener(
    "mousedown",
    function (e) {
      if (e.button !== 0) return;
      if (e.clientY > EDGE_PX) return;
      mouseDown = true;
      onStart(e.clientY, e.clientX, e.target);
    },
    true
  );
  document.addEventListener(
    "mousemove",
    function (e) {
      if (!mouseDown) return;
      onMove(e.clientY, e.clientX, e.target);
    },
    true
  );
  document.addEventListener(
    "mouseup",
    function () {
      if (!mouseDown) return;
      mouseDown = false;
      onEnd();
    },
    true
  );

  window.SDPullRefresh = {
    __ready: true,
    register: register,
    unregister: unregister,
    setEnabled: function (on) {
      enabled = !!on;
      if (!enabled) reset();
    },
    isEnabled: function () {
      return enabled;
    },
    canStart: function (target) {
      return decide(buildCtx(target)).ok;
    },
    decide: function (target) {
      return decide(buildCtx(target));
    },
    reload: function () {
      doReload(true);
    },
    registry: function () {
      return Object.keys(registry).slice();
    },
  };

  // Legacy guard flag (older scripts may check this)
  window.__sdPullReload = true;
})();
