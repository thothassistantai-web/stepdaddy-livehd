/* player_party_av: built-in WebRTC mesh + movable/resizable AV overlay (Jitsi optional) */
(function sdPartyAvBoot() {
  const LS_PROVIDER = "sd_party_av_provider";
  const SS_GEOM = "sd_party_av_geom";
  const IDLE_MS = 2500;
  const IDLE_BUBBLE = 100; // 88–112px circle when idle
  const MIN_W = 160;
  const MIN_H = 120;
  const DEFAULT_W = 280;
  const DEFAULT_H = 200;
  const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];

  let sendFn = null;
  let myMemberId = "";
  let roomCode = "";
  let displayName = "Guest";
  let mode = "text"; // voice | video | hybrid
  let provider = "webrtc";
  let active = false;
  let localStream = null;
  let muted = false;
  let camOff = false;
  let peers = Object.create(null); // memberId -> { pc, polite, makingOffer, ignoreOffer, videoEl }
  let remoteStates = Object.create(null); // memberId -> av_state
  let jitsiFrame = null;
  let idleTimer = null;
  let dragState = null;
  let resizeState = null;
  let pinchState = null;
  let lastRectGeom = null; // active PiP size/pos (persisted; circle idle does not overwrite)
  let stageFocus = "content"; // content | local | peerId
  let stageLayoutActive = false;

  function getProvider() {
    try {
      const v = (localStorage.getItem(LS_PROVIDER) || "webrtc").toLowerCase();
      return v === "jitsi" ? "jitsi" : "webrtc";
    } catch (e) {
      return "webrtc";
    }
  }

  function setProvider(p) {
    p = String(p || "webrtc").toLowerCase() === "jitsi" ? "jitsi" : "webrtc";
    try {
      localStorage.setItem(LS_PROVIDER, p);
    } catch (e) {}
    const prev = provider;
    provider = p;
    syncProviderUi();
    if (active && prev !== p) {
      const m = mode;
      stopInternal();
      startInternal(m);
    }
    return provider;
  }

  function orientKey() {
    try {
      return window.matchMedia("(orientation: landscape)").matches ? "land" : "port";
    } catch (e) {
      return "port";
    }
  }

  function loadGeom() {
    try {
      const raw = sessionStorage.getItem(SS_GEOM + "_" + orientKey());
      if (!raw) return null;
      const g = JSON.parse(raw);
      if (!g || typeof g.w !== "number") return null;
      return g;
    } catch (e) {
      return null;
    }
  }

  function saveGeom(g) {
    try {
      sessionStorage.setItem(SS_GEOM + "_" + orientKey(), JSON.stringify(g));
    } catch (e) {}
  }

  /** Same stable host as SDParty — never trailerLayer (hidden on pure live). */
  function partyHost() {
    return (
      document.getElementById("videoArea") ||
      document.getElementById("tvRoot") ||
      document.body
    );
  }

  function layer() {
    return partyHost();
  }

  function wantsVideo() {
    return mode === "video" || mode === "hybrid";
  }

  function toast(msg) {
    if (window.SDParty && typeof SDParty._toast === "function") SDParty._toast(msg);
    else if (typeof window.showErr === "function") showErr(msg);
  }

  function ensureOverlay() {
    let el = document.getElementById("partyAvOverlay");
    const host = partyHost();
    if (el) {
      if (host && el.parentNode !== host) host.appendChild(el);
      return el;
    }
    el = document.createElement("div");
    el.id = "partyAvOverlay";
    el.className = "party-av-overlay";
    el.innerHTML =
      '<div class="party-av-chrome" id="partyAvChrome">' +
      '<div class="party-av-header" id="partyAvHeader">' +
      '<span class="party-av-title" id="partyAvTitle">Call</span>' +
      '<span class="party-av-provider-chip" id="partyAvProviderChip"></span>' +
      "</div>" +
      '<div class="party-av-note" id="partyAvNote" hidden>Jitsi public demo may disconnect after ~5 minutes</div>' +
      '<div class="party-av-stage" id="partyAvStage"></div>' +
      '<div class="party-av-controls" id="partyAvControls">' +
      '<button type="button" class="party-av-btn" id="partyAvMute" title="Mute mic" aria-label="Mute">🎤</button>' +
      '<button type="button" class="party-av-btn" id="partyAvCam" title="Toggle camera" aria-label="Camera">📷</button>' +
      '<button type="button" class="party-av-btn party-av-hangup" id="partyAvHangup" title="Leave call" aria-label="Hang up">✕</button>' +
      "</div>" +
      '<div class="party-av-resize" id="partyAvResize" title="Resize" aria-hidden="true"></div>' +
      "</div>";
    host.appendChild(el);
    wireOverlayGestures(el);
    const muteBtn = document.getElementById("partyAvMute");
    const camBtn = document.getElementById("partyAvCam");
    const hangBtn = document.getElementById("partyAvHangup");
    if (muteBtn) muteBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleMute(); });
    if (camBtn) camBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleCam(); });
    if (hangBtn) hangBtn.addEventListener("click", (e) => { e.stopPropagation(); hangUp(); });
    return el;
  }

  function markActive() {
    const el = document.getElementById("partyAvOverlay");
    if (!el) return;
    if (stageLayoutActive) {
      // Stage+filmstrip stays docked; no idle circle morph
      clearTimeout(idleTimer);
      return;
    }
    wakeFromIdle(el);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!active || stageLayoutActive) return;
      enterIdle(el);
    }, IDLE_MS);
  }

  function isLandscapeHulu() {
    try {
      const layerEl = layer();
      if (layerEl && layerEl.classList.contains("party-layout-hulu")) return true;
      if (document.body.classList.contains("party-layout-hulu")) return true;
      return (
        window.matchMedia("(orientation: landscape)").matches &&
        (window.matchMedia("(max-height: 500px)").matches ||
          window.matchMedia("(max-width: 720px)").matches)
      );
    } catch (e) {
      return false;
    }
  }

  function remotePeerCount() {
    return Object.keys(peers).length;
  }

  function shouldUseStageLayout() {
    if (!active || provider === "jitsi") return false;
    if (mode !== "voice" && mode !== "video" && mode !== "hybrid") return false;
    if (!isLandscapeHulu()) return false;
    // Multi-peer stage once ≥1 remote AV peer
    return remotePeerCount() >= 1;
  }

  function ensureStageDom() {
    const stage = document.getElementById("partyAvStage");
    if (!stage) return null;
    let main = document.getElementById("partyAvMainStage");
    let strip = document.getElementById("partyAvFilmstrip");
    if (!main) {
      main = document.createElement("div");
      main.id = "partyAvMainStage";
      main.className = "party-stage";
    }
    if (!strip) {
      strip = document.createElement("div");
      strip.id = "partyAvFilmstrip";
      strip.className = "party-filmstrip";
    }
    if (main.parentNode !== stage) stage.appendChild(main);
    if (strip.parentNode !== stage) stage.appendChild(strip);
    if (!strip.dataset.focusWired) {
      strip.dataset.focusWired = "1";
      strip.addEventListener("click", (e) => {
        const tile = e.target.closest(".party-av-tile");
        if (!tile) return;
        const focus = tile.dataset.focus || (tile.classList.contains("local") ? "local" : tile.dataset.peer);
        if (focus) setStageFocus(focus);
      });
    }
    return { stage: stage, main: main, strip: strip };
  }

  function ensureContentTile() {
    const dom = ensureStageDom();
    if (!dom) return null;
    let tile = document.getElementById("partyAvContentTile");
    if (!tile) {
      tile = document.createElement("div");
      tile.id = "partyAvContentTile";
      tile.className = "party-av-tile party-content-tile";
      tile.dataset.focus = "content";
      tile.setAttribute("role", "button");
      tile.setAttribute("tabindex", "0");
      tile.title = "Show content on stage";
      tile.innerHTML =
        '<div class="party-content-thumb" aria-hidden="true">🎬</div>' +
        '<span class="party-av-label">Content</span>';
    }
    return tile;
  }

  function setStageFocus(focus) {
    stageFocus = String(focus || (mode === "hybrid" ? "content" : "local"));
    syncStageLayout();
  }

  function defaultStageFocus() {
    if (mode === "hybrid") return "content";
    const remotes = Object.keys(peers);
    if (remotes.length) return remotes[0];
    return "local";
  }

  function dockStageOverlay(el) {
    if (!el) return;
    el.style.left = "0px";
    el.style.top = "0px";
    el.style.right = "";
    el.style.bottom = "";
    el.style.width = "";
    el.style.height = "";
  }

  function syncStageLayout() {
    const el = document.getElementById("partyAvOverlay");
    const stage = document.getElementById("partyAvStage");
    if (!el || !stage || stage.classList.contains("jitsi")) return;

    const want = shouldUseStageLayout();
    if (!want) {
      if (stageLayoutActive) {
        stageLayoutActive = false;
        el.classList.remove("party-stage-mode", "party-stage-content-focus");
        // Flatten tiles back into stage grid
        const main = document.getElementById("partyAvMainStage");
        const strip = document.getElementById("partyAvFilmstrip");
        const content = document.getElementById("partyAvContentTile");
        if (content) content.remove();
        const tiles = [];
        if (main) Array.from(main.children).forEach((c) => tiles.push(c));
        if (strip) Array.from(strip.children).forEach((c) => tiles.push(c));
        tiles.forEach((t) => {
          if (t && t.classList.contains("party-av-tile") && !t.classList.contains("party-content-tile")) {
            stage.appendChild(t);
          }
        });
        if (main) main.remove();
        if (strip) strip.remove();
        placeDefault();
        markActive();
      }
      return;
    }

    const was = stageLayoutActive;
    stageLayoutActive = true;
    el.classList.remove("idle", "party-av-idle");
    el.classList.add("party-stage-mode");
    clearTimeout(idleTimer);

    if (!stageFocus || (!was && mode === "hybrid")) stageFocus = defaultStageFocus();
    if (mode === "video" && stageFocus === "content") stageFocus = defaultStageFocus();
    if (mode === "voice" && stageFocus === "content") stageFocus = defaultStageFocus();

    const dom = ensureStageDom();
    if (!dom) return;
    const { main, strip } = dom;

    // Collect all camera tiles currently anywhere under stage
    const allTiles = Array.from(stage.querySelectorAll(".party-av-tile")).filter(
      (t) => !t.classList.contains("party-content-tile")
    );
    allTiles.forEach((t) => {
      t.classList.remove("party-focus-active", "party-av-idle-focus");
      if (!t.dataset.focus) {
        t.dataset.focus = t.classList.contains("local") ? "local" : t.dataset.peer || "";
      }
      t.setAttribute("role", "button");
      t.setAttribute("tabindex", "0");
    });

    const contentFocus = mode === "hybrid" && stageFocus === "content";
    el.classList.toggle("party-stage-content-focus", contentFocus);

    // Clear main/strip then redistribute
    while (main.firstChild) main.removeChild(main.firstChild);
    while (strip.firstChild) strip.removeChild(strip.firstChild);

    if (contentFocus) {
      const content = ensureContentTile();
      // Content is on the movie canvas; cameras all go to filmstrip
      allTiles.forEach((t) => strip.appendChild(t));
      // Keep content tile available in strip for swap-back after peer focus — not needed while content is focused
    } else {
      let focusTile =
        allTiles.find((t) => (t.dataset.focus || "") === stageFocus) ||
        allTiles.find((t) => t.classList.contains("local") && stageFocus === "local") ||
        allTiles.find((t) => t.dataset.peer === stageFocus) ||
        allTiles[0];
      if (focusTile) {
        focusTile.classList.add("party-focus-active");
        main.appendChild(focusTile);
      }
      allTiles.forEach((t) => {
        if (t !== focusTile) strip.appendChild(t);
      });
      if (mode === "hybrid") {
        const content = ensureContentTile();
        if (content) {
          content.classList.toggle("party-focus-active", false);
          strip.appendChild(content);
        }
      }
    }

    dockStageOverlay(el);
  }

  function syncIdleVideoFocus() {
    const stage = document.getElementById("partyAvStage");
    if (!stage) return;
    stage.querySelectorAll(".party-av-tile").forEach((t) => t.classList.remove("party-av-idle-focus"));
    if (stage.classList.contains("jitsi")) return;
    if (stageLayoutActive) return;
    const remotes = Array.from(stage.querySelectorAll(".party-av-tile.remote"));
    let focus =
      remotes.find((t) => !t.classList.contains("audio-only")) ||
      remotes[0] ||
      stage.querySelector(".party-av-tile.local");
    if (focus) focus.classList.add("party-av-idle-focus");
  }

  function enterIdle(el) {
    if (!el || !active || stageLayoutActive) return;
    if (!el.classList.contains("party-av-idle")) {
      lastRectGeom = Object.assign({}, currentGeom());
      persistRectGeom(lastRectGeom);
    }
    syncIdleVideoFocus();
    el.classList.add("idle", "party-av-idle");
    el.style.opacity = "";
    const g = lastRectGeom || currentGeom();
    const size = IDLE_BUBBLE;
    const cx = g.x + g.w / 2;
    const cy = g.y + g.h / 2;
    applyGeom({ x: cx - size / 2, y: cy - size / 2, w: size, h: size }, { skipPersist: true });
  }

  function wakeFromIdle(el) {
    if (!el) return;
    const wasIdle = el.classList.contains("party-av-idle") || el.classList.contains("idle");
    el.classList.remove("idle", "party-av-idle");
    el.style.opacity = "1";
    if (!wasIdle) return;
    const circle = currentGeom();
    const rect = lastRectGeom || {
      w: DEFAULT_W,
      h: DEFAULT_H,
      x: circle.x,
      y: circle.y,
    };
    const cx = circle.x + circle.w / 2;
    const cy = circle.y + circle.h / 2;
    applyGeom({
      x: cx - rect.w / 2,
      y: cy - rect.h / 2,
      w: rect.w,
      h: rect.h,
    });
  }

  function videoPaneSize(host) {
    const rect = host.getBoundingClientRect();
    let w = rect.width;
    let h = rect.height;
    const layoutEl =
      document.getElementById("videoArea") ||
      document.getElementById("trailerLayer") ||
      host;
    try {
      if (layoutEl.classList.contains("party-layout-hulu")) {
        const cs = getComputedStyle(layoutEl);
        const railRaw = cs.getPropertyValue("--party-rail-w").trim();
        let rail = 0;
        if (railRaw.endsWith("px")) rail = parseFloat(railRaw) || 0;
        else if (railRaw) {
          const drawer = document.getElementById("partyDrawer");
          if (drawer && drawer.classList.contains("open")) {
            rail = drawer.getBoundingClientRect().width;
          }
        }
        if (rail > 0) w = Math.max(MIN_W + 16, rect.width - rail);
        else {
          const drawer = document.getElementById("partyDrawer");
          if (drawer && drawer.classList.contains("open") && !layoutEl.classList.contains("party-chat-minimized")) {
            const dr = drawer.getBoundingClientRect();
            w = Math.max(MIN_W + 16, dr.left - rect.left);
          }
        }
      }
      if (layoutEl.classList.contains("party-layout-rave")) {
        if (layoutEl.classList.contains("party-live-overlay")) {
          h = rect.height;
        } else {
          const drawer = document.getElementById("partyDrawer");
          if (drawer && drawer.classList.contains("open") && !drawer.classList.contains("collapsed")) {
            const dr = drawer.getBoundingClientRect();
            h = Math.max(MIN_H + 16, dr.top - rect.top);
          } else {
            h = rect.height * 0.62;
          }
        }
      }
    } catch (e) {}
    return { w: w, h: h };
  }

  function clampGeom(g, host) {
    const pane = videoPaneSize(host);
    const pad = 8;
    let safeT = pad;
    let safeB = Math.max(pad, 24);
    let safeL = pad;
    let safeR = pad;
    try {
      const cs = getComputedStyle(document.documentElement);
      const readEnv = (name) => {
        const raw = cs.getPropertyValue(name);
        const n = parseInt(raw, 10);
        return Number.isFinite(n) ? n : 0;
      };
      // env() rarely resolves via getPropertyValue; keep numeric pads + CSS safe-area on host
      safeT = pad + Math.max(0, readEnv("--sat") || 0);
    } catch (e) {}
    const maxW = Math.max(MIN_W, pane.w - safeL - safeR);
    const maxH = Math.max(MIN_H, pane.h - safeT - safeB);
    const el = document.getElementById("partyAvOverlay");
    const idleCircle = el && el.classList.contains("party-av-idle");
    if (idleCircle) {
      const size = Math.min(IDLE_BUBBLE, maxW, maxH, Math.min(pane.w, pane.h) * 0.42);
      g.w = size;
      g.h = size;
    } else {
      g.w = Math.min(Math.max(MIN_W, g.w), maxW);
      g.h = Math.min(Math.max(MIN_H, g.h), maxH);
    }
    g.x = Math.min(Math.max(safeL, g.x), Math.max(safeL, pane.w - g.w - safeR));
    g.y = Math.min(Math.max(safeT, g.y), Math.max(safeT, pane.h - g.h - safeB));
    return g;
  }

  function persistRectGeom(g) {
    lastRectGeom = { x: g.x, y: g.y, w: g.w, h: g.h };
    saveGeom(lastRectGeom);
  }

  function applyGeom(g, opts) {
    const el = document.getElementById("partyAvOverlay");
    const host = layer();
    if (!el || !host) return;
    g = clampGeom(Object.assign({}, g), host);
    el.style.left = g.x + "px";
    el.style.top = g.y + "px";
    el.style.width = g.w + "px";
    el.style.height = g.h + "px";
    el.style.right = "auto";
    el.style.bottom = "auto";
    if (opts && opts.skipPersist) {
      // Idle circle: keep lastRectGeom; update stored position from circle center
      if (lastRectGeom) {
        const cx = g.x + g.w / 2;
        const cy = g.y + g.h / 2;
        saveGeom({
          x: cx - lastRectGeom.w / 2,
          y: cy - lastRectGeom.h / 2,
          w: lastRectGeom.w,
          h: lastRectGeom.h,
        });
      }
      return;
    }
    persistRectGeom(g);
  }

  function currentGeom() {
    const el = document.getElementById("partyAvOverlay");
    if (!el) return { x: 12, y: 12, w: DEFAULT_W, h: DEFAULT_H };
    return {
      x: parseFloat(el.style.left) || el.offsetLeft || 12,
      y: parseFloat(el.style.top) || el.offsetTop || 12,
      w: parseFloat(el.style.width) || el.offsetWidth || DEFAULT_W,
      h: parseFloat(el.style.height) || el.offsetHeight || DEFAULT_H,
    };
  }

  function placeDefault() {
    const host = layer();
    const saved = loadGeom();
    if (saved) {
      lastRectGeom = Object.assign({}, saved);
      applyGeom(saved);
      return;
    }
    const w = Math.min(DEFAULT_W, (host && host.clientWidth ? host.clientWidth : 360) * 0.42);
    const h = Math.min(DEFAULT_H, (host && host.clientHeight ? host.clientHeight : 640) * 0.36);
    applyGeom({ x: 12, y: 12, w: w, h: h });
  }

  function isInteractiveTarget(t) {
    if (!t || !t.closest) return false;
    return !!(
      t.closest(".party-av-btn") ||
      t.closest("button") ||
      t.closest("a") ||
      t.closest("select") ||
      t.closest("input") ||
      t.closest("#partyAvResize")
    );
  }

  function wireOverlayGestures(el) {
    if (el.dataset.gestures === "1") return;
    el.dataset.gestures = "1";
    const header = el.querySelector("#partyAvHeader");
    const resize = el.querySelector("#partyAvResize");

    const beginDrag = (e, captureEl) => {
      if (e.button != null && e.button !== 0) return;
      markActive();
      const g = currentGeom();
      dragState = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origX: g.x,
        origY: g.y,
      };
      try {
        (captureEl || el).setPointerCapture(e.pointerId);
      } catch (err) {}
      e.preventDefault();
      e.stopPropagation();
    };
    const onPointerMove = (e) => {
      if (!dragState || dragState.id !== e.pointerId) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      const base = currentGeom();
      applyGeom({
        x: dragState.origX + dx,
        y: dragState.origY + dy,
        w: base.w,
        h: base.h,
      });
      // Keep awake while dragging without re-entering idle morph mid-gesture
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!active) return;
        const overlay = document.getElementById("partyAvOverlay");
        if (overlay) enterIdle(overlay);
      }, IDLE_MS);
    };
    const onPointerUp = (e) => {
      if (!dragState || dragState.id !== e.pointerId) return;
      dragState = null;
      markActive();
    };

    // Idle: whole bubble is drag handle; active: header drag; any pointer wakes
    el.addEventListener("pointerdown", (e) => {
      if (isInteractiveTarget(e.target)) {
        markActive();
        return;
      }
      if (el.classList.contains("party-av-idle") || el.classList.contains("idle")) {
        beginDrag(e, el);
        return;
      }
      if (header && (e.target === header || header.contains(e.target))) {
        beginDrag(e, header);
        return;
      }
      markActive();
    });
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);

    if (resize) {
      resize.addEventListener("pointerdown", (e) => {
        if (e.button != null && e.button !== 0) return;
        // Wake first — resize only after active rect
        markActive();
        const g = currentGeom();
        resizeState = {
          id: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          origW: g.w,
          origH: g.h,
          origX: g.x,
          origY: g.y,
        };
        try {
          resize.setPointerCapture(e.pointerId);
        } catch (err) {}
        e.preventDefault();
        e.stopPropagation();
      });
      resize.addEventListener("pointermove", (e) => {
        if (!resizeState || resizeState.id !== e.pointerId) return;
        applyGeom({
          x: resizeState.origX,
          y: resizeState.origY,
          w: resizeState.origW + (e.clientX - resizeState.startX),
          h: resizeState.origH + (e.clientY - resizeState.startY),
        });
        markActive();
      });
      resize.addEventListener("pointerup", (e) => {
        if (!resizeState || resizeState.id !== e.pointerId) return;
        resizeState = null;
        markActive();
      });
      resize.addEventListener("pointercancel", () => {
        resizeState = null;
      });
    }

    // Pinch: first contact wakes to rect; then resize
    el.addEventListener(
      "touchstart",
      (e) => {
        markActive();
        if (e.touches.length === 2) {
          const a = e.touches[0];
          const b = e.touches[1];
          const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          const g = currentGeom();
          pinchState = { dist: dist, w: g.w, h: g.h, x: g.x, y: g.y };
          e.preventDefault();
        }
      },
      { passive: false }
    );
    el.addEventListener(
      "touchmove",
      (e) => {
        if (!pinchState || e.touches.length !== 2) return;
        const a = e.touches[0];
        const b = e.touches[1];
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const scale = dist / Math.max(1, pinchState.dist);
        const nw = pinchState.w * scale;
        const nh = pinchState.h * scale;
        const cx = pinchState.x + pinchState.w / 2;
        const cy = pinchState.y + pinchState.h / 2;
        applyGeom({ x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh });
        markActive();
        e.preventDefault();
      },
      { passive: false }
    );
    el.addEventListener("touchend", () => {
      pinchState = null;
      markActive();
    });
  }

  function syncProviderUi() {
    const chip = document.getElementById("partyAvProviderChip");
    const note = document.getElementById("partyAvNote");
    if (chip) chip.textContent = provider === "jitsi" ? "Jitsi" : "Built-in";
    if (note) note.hidden = provider !== "jitsi";
    const sel = document.getElementById("partyAvProviderSelect");
    if (sel && sel.value !== provider) sel.value = provider;
    const setSel = document.getElementById("sdPartyAvProvider");
    if (setSel && setSel.value !== provider) setSel.value = provider;
  }

  function syncControlsUi() {
    const muteBtn = document.getElementById("partyAvMute");
    const camBtn = document.getElementById("partyAvCam");
    const title = document.getElementById("partyAvTitle");
    if (muteBtn) {
      muteBtn.textContent = muted ? "🔇" : "🎤";
      muteBtn.classList.toggle("off", muted);
      muteBtn.title = muted ? "Unmute mic" : "Mute mic";
    }
    if (camBtn) {
      camBtn.hidden = !wantsVideo() || provider === "jitsi";
      camBtn.textContent = camOff ? "🚫" : "📷";
      camBtn.classList.toggle("off", camOff);
    }
    if (title) {
      title.textContent = mode === "voice" ? "Voice" : mode === "hybrid" ? "Hybrid" : "Video";
    }
  }

  function send(msg) {
    if (typeof sendFn === "function") sendFn(msg);
  }

  function broadcastAvState(inCall) {
    send({
      type: "av_state",
      inCall: !!inCall,
      mode: mode,
      muted: muted,
      camOff: camOff,
    });
  }

  async function getLocalMedia() {
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      localStream = null;
    }
    const constraints = {
      audio: true,
      video: wantsVideo()
        ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
        : false,
    };
    try {
      localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      if (wantsVideo()) {
        try {
          localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          toast("Camera unavailable — audio only");
          camOff = true;
        } catch (e2) {
          toast("Microphone permission denied");
          throw e2;
        }
      } else {
        toast("Microphone permission denied");
        throw e;
      }
    }
    if (muted) localStream.getAudioTracks().forEach((t) => (t.enabled = false));
    if (camOff) localStream.getVideoTracks().forEach((t) => (t.enabled = false));
    return localStream;
  }

  function ensureLocalTile() {
    const stage = document.getElementById("partyAvStage");
    if (!stage) return;
    let tile = document.getElementById("partyAvLocalTile");
    if (!tile) {
      tile = document.createElement("div");
      tile.id = "partyAvLocalTile";
      tile.className = "party-av-tile local";
      tile.dataset.focus = "local";
      tile.innerHTML =
        '<video playsinline autoplay muted id="partyAvLocalVideo"></video>' +
        '<span class="party-av-label">You</span>';
      const strip = document.getElementById("partyAvFilmstrip");
      const main = document.getElementById("partyAvMainStage");
      if (stageLayoutActive && strip) strip.appendChild(tile);
      else if (stageLayoutActive && main) main.appendChild(tile);
      else stage.prepend(tile);
    }
    const vid = document.getElementById("partyAvLocalVideo");
    if (vid && localStream && vid.srcObject !== localStream) {
      vid.srcObject = localStream;
      vid.play().catch(() => {});
    }
    tile.classList.toggle("audio-only", !wantsVideo() || camOff || !localStream || !localStream.getVideoTracks().length);
    const overlay = document.getElementById("partyAvOverlay");
    if (overlay && overlay.classList.contains("party-av-idle")) syncIdleVideoFocus();
    syncStageLayout();
  }

  function ensureRemoteTile(peerId, name) {
    const stage = document.getElementById("partyAvStage");
    if (!stage) return null;
    const id = "partyAvPeer_" + peerId;
    let tile = document.getElementById(id);
    if (!tile) {
      tile = document.createElement("div");
      tile.id = id;
      tile.className = "party-av-tile remote";
      tile.dataset.peer = peerId;
      tile.dataset.focus = peerId;
      tile.innerHTML =
        '<video playsinline autoplay id="partyAvVid_' +
        peerId +
        '"></video>' +
        '<span class="party-av-label"></span>';
      const strip = document.getElementById("partyAvFilmstrip");
      if (stageLayoutActive && strip) strip.appendChild(tile);
      else stage.appendChild(tile);
    }
    const label = tile.querySelector(".party-av-label");
    if (label) label.textContent = name || remoteStates[peerId]?.displayName || "Peer";
    syncStageLayout();
    return tile;
  }

  function removeRemoteTile(peerId) {
    const tile = document.getElementById("partyAvPeer_" + peerId);
    if (tile) tile.remove();
    if (stageFocus === peerId) stageFocus = defaultStageFocus();
    syncStageLayout();
  }

  function closePeer(peerId) {
    const p = peers[peerId];
    if (!p) return;
    try {
      p.pc.close();
    } catch (e) {}
    delete peers[peerId];
    removeRemoteTile(peerId);
  }

  function closeAllPeers() {
    Object.keys(peers).forEach(closePeer);
  }

  function pcConfig() {
    return { iceServers: ICE_SERVERS };
  }

  async function ensurePeer(peerId, polite) {
    if (peers[peerId]) return peers[peerId];
    const pc = new RTCPeerConnection(pcConfig());
    const entry = {
      pc: pc,
      polite: !!polite,
      makingOffer: false,
      ignoreOffer: false,
    };
    peers[peerId] = entry;

    if (localStream) {
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    }

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      send({
        type: "webrtc_ice",
        to: peerId,
        candidate: ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate,
      });
    };

    pc.ontrack = (ev) => {
      const tile = ensureRemoteTile(peerId, remoteStates[peerId]?.displayName);
      const vid = document.getElementById("partyAvVid_" + peerId);
      const stream = ev.streams && ev.streams[0] ? ev.streams[0] : new MediaStream([ev.track]);
      if (vid && vid.srcObject !== stream) {
        vid.srcObject = stream;
        vid.play().catch(() => {});
      }
      if (tile) {
        const hasVid = stream.getVideoTracks().some((t) => t.enabled && t.readyState !== "ended");
        tile.classList.toggle("audio-only", !hasVid);
      }
      const overlay = document.getElementById("partyAvOverlay");
      if (overlay && overlay.classList.contains("party-av-idle")) syncIdleVideoFocus();
    };

    pc.onnegotiationneeded = async () => {
      try {
        entry.makingOffer = true;
        await pc.setLocalDescription();
        send({ type: "webrtc_offer", to: peerId, sdp: pc.localDescription });
      } catch (e) {
        /* ignore */
      } finally {
        entry.makingOffer = false;
      }
    };

    ensureRemoteTile(peerId, remoteStates[peerId]?.displayName);
    return entry;
  }

  async function connectToPeer(peerId) {
    if (!peerId || peerId === myMemberId || peers[peerId]) return;
    // Perfect negotiation: higher id is polite (answers glare)
    const polite = String(myMemberId) > String(peerId);
    await ensurePeer(peerId, polite);
  }

  async function handleOffer(msg) {
    const from = msg.from;
    if (!from || from === myMemberId) return;
    const polite = String(myMemberId) > String(from);
    const entry = await ensurePeer(from, polite);
    const pc = entry.pc;
    const offerCollision = entry.makingOffer || pc.signalingState !== "stable";
    entry.ignoreOffer = !entry.polite && offerCollision;
    if (entry.ignoreOffer) return;
    await pc.setRemoteDescription(msg.sdp);
    await pc.setLocalDescription();
    send({ type: "webrtc_answer", to: from, sdp: pc.localDescription });
  }

  async function handleAnswer(msg) {
    const entry = peers[msg.from];
    if (!entry) return;
    try {
      await entry.pc.setRemoteDescription(msg.sdp);
    } catch (e) {}
  }

  async function handleIce(msg) {
    const entry = peers[msg.from];
    if (!entry || !msg.candidate) return;
    try {
      await entry.pc.addIceCandidate(msg.candidate);
    } catch (e) {}
  }

  function handleHangup(msg) {
    if (msg.from) closePeer(msg.from);
  }

  function handleAvState(msg) {
    if (!msg || !msg.from || msg.from === myMemberId) return;
    remoteStates[msg.from] = msg;
    if (!active || provider !== "webrtc") return;
    if (msg.inCall) {
      connectToPeer(msg.from).catch(() => {});
      ensureRemoteTile(msg.from, msg.displayName);
    } else {
      closePeer(msg.from);
    }
  }

  function jitsiRoomName() {
    return "sdgateway-" + String(roomCode || "lobby").toLowerCase();
  }

  function startJitsiInOverlay() {
    const stage = document.getElementById("partyAvStage");
    if (!stage || !roomCode) return;
    stage.innerHTML = "";
    stage.classList.add("jitsi");
    const room = encodeURIComponent(jitsiRoomName());
    const display = encodeURIComponent((displayName || "Guest").slice(0, 32));
    const audioOnly = mode === "voice";
    const cfg =
      "#userInfo.displayName=%22" +
      display +
      "%22&config.prejoinPageEnabled=false&config.disableDeepLinking=true" +
      (audioOnly ? "&config.startWithVideoMuted=true&config.startAudioOnly=true" : "") +
      (mode === "video" || mode === "hybrid" ? "&config.startWithAudioMuted=false" : "");
    jitsiFrame = document.createElement("iframe");
    jitsiFrame.allow = "camera; microphone; fullscreen; display-capture; autoplay";
    jitsiFrame.setAttribute("allowfullscreen", "true");
    jitsiFrame.src = "https://meet.jit.si/" + room + cfg;
    jitsiFrame.setAttribute("data-room", jitsiRoomName());
    jitsiFrame.setAttribute("data-mode", mode);
    stage.appendChild(jitsiFrame);
  }

  function stopJitsiInOverlay() {
    const stage = document.getElementById("partyAvStage");
    if (stage) {
      stage.classList.remove("jitsi");
      stage.innerHTML = "";
    }
    jitsiFrame = null;
  }

  async function startWebRtc() {
    const stage = document.getElementById("partyAvStage");
    if (stage) {
      stage.classList.remove("jitsi");
      stage.innerHTML = "";
    }
    await getLocalMedia();
    ensureLocalTile();
    broadcastAvState(true);
    // Connect to anyone already advertising inCall
    Object.keys(remoteStates).forEach((id) => {
      if (remoteStates[id] && remoteStates[id].inCall) connectToPeer(id).catch(() => {});
    });
  }

  async function startInternal(m) {
    mode = m;
    provider = getProvider();
    stageFocus = mode === "hybrid" ? "content" : "local";
    stageLayoutActive = false;
    const el = ensureOverlay();
    el.classList.add("open");
    el.classList.remove("party-stage-mode", "party-stage-content-focus");
    placeDefault();
    syncProviderUi();
    syncControlsUi();
    markActive();
    active = true;
    if (provider === "jitsi") {
      startJitsiInOverlay();
    } else {
      try {
        await startWebRtc();
      } catch (e) {
        active = false;
        el.classList.remove("open");
        return;
      }
    }
    syncControlsUi();
    syncStageLayout();
  }

  function stopInternal() {
    active = false;
    stageLayoutActive = false;
    stageFocus = "content";
    clearTimeout(idleTimer);
    if (provider === "webrtc" || localStream) {
      try {
        broadcastAvState(false);
      } catch (e) {}
    }
    closeAllPeers();
    stopJitsiInOverlay();
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      localStream = null;
    }
    const el = document.getElementById("partyAvOverlay");
    if (el) {
      el.classList.remove("open", "idle", "party-av-idle", "party-stage-mode", "party-stage-content-focus");
      el.style.opacity = "";
    }
    const layerEl = layer();
    if (layerEl) layerEl.classList.remove("party-av-full");
    // Remove legacy full-bleed jitsi stage if present
    const legacy = document.getElementById("partyJitsiStage");
    if (legacy) {
      legacy.classList.remove("open", "hybrid");
      legacy.innerHTML = "";
    }
  }

  function toggleMute() {
    muted = !muted;
    if (localStream) localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
    syncControlsUi();
    markActive();
    if (active && provider === "webrtc") broadcastAvState(true);
  }

  function toggleCam() {
    if (!wantsVideo()) return;
    camOff = !camOff;
    if (localStream) localStream.getVideoTracks().forEach((t) => (t.enabled = !camOff));
    ensureLocalTile();
    syncControlsUi();
    markActive();
    if (active && provider === "webrtc") broadcastAvState(true);
  }

  function hangUp() {
    stopInternal();
    if (window.SDParty && typeof SDParty._onAvHangup === "function") SDParty._onAvHangup();
  }

  function start(opts) {
    opts = opts || {};
    sendFn = opts.send || sendFn;
    myMemberId = opts.memberId || myMemberId;
    roomCode = opts.roomCode || roomCode;
    displayName = opts.displayName || displayName || "Guest";
    provider = getProvider();
    const m = String(opts.mode || "voice").toLowerCase();
    if (m === "text") {
      stopInternal();
      return;
    }
    return startInternal(m);
  }

  function stop() {
    stopInternal();
  }

  function handleSignal(msg) {
    if (!msg || !msg.type) return;
    if (msg.type === "av_state") {
      handleAvState(msg);
      return;
    }
    if (!active || provider !== "webrtc") {
      if (msg.type === "av_state") handleAvState(msg);
      return;
    }
    if (msg.type === "webrtc_offer") handleOffer(msg).catch(() => {});
    else if (msg.type === "webrtc_answer") handleAnswer(msg).catch(() => {});
    else if (msg.type === "webrtc_ice") handleIce(msg).catch(() => {});
    else if (msg.type === "webrtc_hangup") handleHangup(msg);
  }

  function onMembers(members) {
    if (!active || provider !== "webrtc") return;
    const ids = new Set((members || []).map((m) => m.id || m.memberId).filter(Boolean));
    Object.keys(peers).forEach((id) => {
      if (!ids.has(id)) closePeer(id);
    });
    // Re-announce so late joiners can mesh with us
    broadcastAvState(true);
    syncStageLayout();
  }

  function onPartyLayoutChange() {
    if (!active) return;
    syncStageLayout();
    if (!stageLayoutActive) applyGeom(currentGeom());
  }

  function injectProviderSelect(host) {
    if (!host || document.getElementById("partyAvProviderSelect")) return;
    const wrap = document.createElement("div");
    wrap.className = "party-av-provider-row";
    wrap.id = "partyAvProviderRow";
    wrap.innerHTML =
      '<label class="party-av-provider-label">Call provider' +
      '<select id="partyAvProviderSelect">' +
      '<option value="webrtc">Built-in (free)</option>' +
      '<option value="jitsi">Jitsi (demo limit)</option>' +
      "</select></label>";
    host.appendChild(wrap);
    const sel = document.getElementById("partyAvProviderSelect");
    if (sel) {
      sel.value = getProvider();
      sel.addEventListener("change", () => {
        setProvider(sel.value);
        if (window.SDParty && typeof SDParty._onAvProviderChange === "function") {
          SDParty._onAvProviderChange(sel.value);
        }
      });
    }
  }

  // Re-clamp on resize/orientation
  try {
    window.addEventListener("resize", () => {
      if (!active) return;
      syncStageLayout();
      if (!stageLayoutActive) applyGeom(currentGeom());
    });
    window.addEventListener("orientationchange", () => {
      setTimeout(() => {
        if (!active) return;
        syncStageLayout();
        if (stageLayoutActive) return;
        const saved = loadGeom();
        if (saved) applyGeom(saved);
        else placeDefault();
      }, 100);
    });
  } catch (e) {}

  provider = getProvider();

  window.SDPartyAV = {
    LS_PROVIDER,
    getProvider,
    setProvider,
    start,
    stop,
    handleSignal,
    onMembers,
    onPartyLayoutChange,
    injectProviderSelect,
    hangUp,
    setStageFocus,
    isActive: () => active,
    syncProviderUi,
  };
})();
