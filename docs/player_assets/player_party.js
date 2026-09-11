/* player_party: QR share/remote, watch party chat/reactions/HLS clock sync */
(function sdPartyBoot() {
  const REACTIONS = ["👍", "👎", "❤️", "😂", "😮", "👏", "🎉", "🔥"];
  const LS_CLIENT = "sd_party_client_id";
  const LS_HOST_KEY = "sd_party_host_key";
  const LS_SYNC_FOLLOW = "sd_party_sync_follow";
  const SS_CHAT_MIN = "sd_party_chat_minimized";
  const SS_LIVE_EXPANDED = "sd_party_live_expanded";
  /** FAB chat UI mode — marker: sd_party_chat_mode — default coherency (Live / mockup C) */
  const LS_CHAT_UI_MODE = "sd_party_chat_mode";
  const CLOCK_LOOP_MS = 1750;
  const PING_INTERVAL_MS = 8000;
  const SEEK_COOLDOWN_MS = 1800;
  const DRIFT_IGNORE_S = 0.12;
  const DRIFT_SOFT_S = 0.85;
  const SOFT_RATE_FAST = 1.02;
  const SOFT_RATE_SLOW = 0.98;
  const CHAT_UI_MODES = ["sidebar", "coherency", "peek", "muted", "cinema"];
  const CHAT_UI_LABELS = {
    sidebar: "Sidebar",
    coherency: "Live",
    peek: "Peek",
    muted: "Muted",
    cinema: "Cinema",
  };
  /** Sidebar layout when mode=sidebar — marker: sd_party_sidebar_style (a=chat-first, b=tabs, e=dual-pane; no D) */
  const LS_SIDEBAR_STYLE = "sd_party_sidebar_style";
  const SIDEBAR_STYLES = ["a", "b", "e"];
  const SIDEBAR_STYLE_LABELS = {
    a: "Chat first",
    b: "Tabs",
    e: "Dual pane",
  };
  const SIDEBAR_STYLE_MARKERS = {
    a: "chat-first",
    b: "tabs",
    e: "dual-pane",
  };
  const RISING_MAX = 4;
  const RISING_FADE_MS = 4200;
  const RISING_FADE_FAST_MS = 2400;
  let layoutChromeWired = false;
  let layoutChromeRaf = 0;
  const CHAT_IDLE_MS = 5000;
  const NAME_MAX = 64;
  const DEFAULT_FEATURES = {
    chat_text: true,
    chat_gif: true,
    chat_voice_note: true,
    av_voice: true,
    av_video: true,
    sync_vod: true,
    sync_wait_buffering: false,
  };
  const SYNC_LIVE_MODES = ["off", "content", "catchup", "lag", "pdt"];
  let ws = null;
  let roomCode = "";
  let roomName = "";
  let roomPublic = false;
  let roomLocked = false;
  let roomNumber = 0;
  let memberId = "";
  let hostKey = "";
  let isHost = false;
  let isAdmin = false;
  let roomFeatures = Object.assign({}, DEFAULT_FEATURES);
  let roomAdmins = [];
  let syncLiveMode = "content";
  let catchupUrl = null;
  let waitForBuffering = false;
  let clockOffsetMs = 0;
  let lastSeekAt = 0;
  let lastPingSentAt = 0;
  let pingTimer = null;
  let hasPdt = false;
  let lastProgramDateTime = null;
  let lastAttachedCatchup = null;
  let guestFollowSync = true;
  let chatMode = "text"; // text | voice | video | hybrid
  let applyingClock = false;
  let applyingContent = false;
  let clockTimer = null;
  let remoteBound = false;
  let bufferingBound = false;
  let softRateTimer = null;
  let lastMembers = [];
  let chatCollapsed = false;
  let liveExpanded = false;
  let chatIdleTimer = null;
  let uiWired = false;
  let voiceRecorder = null;
  let voiceChunks = [];
  let voiceStartAt = 0;
  let chatUiMode = loadChatUiMode();
  let chatUiModeBeforeCinema = "coherency";
  let sidebarStyle = loadSidebarStyle();
  let sidebarTab = "chat";
  let dualCollapsed = false;
  let unreadWhileMuted = 0;
  let peekComposeOpen = false;
  let fabLongPressTimer = null;
  let fabIgnoreClick = false;
  let fabLastTapAt = 0;
  let lanBeaconTimer = null;

  function stopLanBeacon() {
    if (lanBeaconTimer) {
      clearInterval(lanBeaconTimer);
      lanBeaconTimer = null;
    }
  }

  function startLanBeacon() {
    stopLanBeacon();
    const tick = () => {
      try {
        if (!isHost || !roomCode || !hostKey) {
          stopLanBeacon();
          return;
        }
        if (window.SDPartyInvite && SDPartyInvite.ensureHostBeacon) SDPartyInvite.ensureHostBeacon();
      } catch (e) {}
    };
    tick();
    lanBeaconTimer = setInterval(tick, 25000);
  }

  function partyName() {
    if (window.SDFeatures && SDFeatures.partyName) return SDFeatures.partyName();
    try {
      let n = (localStorage.getItem("sd_party_name") || "").trim();
      if (n && n.toLowerCase() !== "guest") return n;
      let id = localStorage.getItem(LS_CLIENT) || clientId();
      const suf = String(id).replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase() || "USER";
      n = "Guest-" + suf;
      localStorage.setItem("sd_party_name", n);
      return n;
    } catch (e) {
      return "Guest";
    }
  }

  function clientId() {
    try {
      let id = localStorage.getItem(LS_CLIENT);
      if (!id) {
        id =
          (crypto.randomUUID && crypto.randomUUID()) ||
          "c" + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(LS_CLIENT, id);
      }
      return id;
    } catch (e) {
      return "anon";
    }
  }

  function storeHostKey(code, key) {
    if (!code || !key) return;
    try {
      localStorage.setItem(LS_HOST_KEY + "_" + code, key);
    } catch (e) {}
  }

  function loadHostKey(code) {
    try {
      return localStorage.getItem(LS_HOST_KEY + "_" + code) || "";
    } catch (e) {
      return "";
    }
  }

  /**
   * Party chrome host (drawer / FAB / toast / LIVE badge / AV).
   * Must stay visible for BOTH live and VOD. `#trailerLayer` is `display:none`
   * during pure live and is torn down by `stopOverlayPlayback` / channel switch —
   * mounting there made chat appear then vanish once the live stream started.
   * Marker: party-chrome-host
   */
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

  function chatRoot() {
    return partyHost();
  }

  function layoutRoots() {
    return [
      document.getElementById("videoArea"),
      document.getElementById("trailerLayer"),
      document.getElementById("tvRoot"),
      document.body,
    ].filter(Boolean);
  }

  function adoptPartyChrome(host) {
    if (!host) return;
    host.classList.add("party-chrome-host");
    ["partyDrawer", "partyFab", "partyToast", "partyLiveBadge", "partyAvOverlay", "partyRailHandle", "partyRisingBubbles", "partyModePicker"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (el && el.parentNode !== host) host.appendChild(el);
      }
    );
  }

  function partyLayoutMode() {
    try {
      if (window.matchMedia("(max-height: 500px) and (orientation: landscape)").matches) return "hulu";
      if (window.matchMedia("(max-width: 720px) and (orientation: landscape)").matches) return "hulu";
      if (window.matchMedia("(max-width: 720px)").matches) return "rave";
    } catch (e) {}
    return null;
  }

  function loadGuestFollowSync() {
    try {
      const raw = localStorage.getItem(LS_SYNC_FOLLOW);
      if (raw == null || raw === "") return true;
      return raw === "1" || raw === "true";
    } catch (e) {
      return true;
    }
  }

  function saveGuestFollowSync(on) {
    guestFollowSync = !!on;
    try {
      localStorage.setItem(LS_SYNC_FOLLOW, guestFollowSync ? "1" : "0");
    } catch (e) {}
  }

  guestFollowSync = loadGuestFollowSync();

  function loadChatMinPref() {
    try {
      return sessionStorage.getItem(SS_CHAT_MIN) === "1";
    } catch (e) {
      return false;
    }
  }

  function saveChatMinPref(min) {
    try {
      sessionStorage.setItem(SS_CHAT_MIN, min ? "1" : "0");
    } catch (e) {}
  }

  function loadLiveExpandedPref() {
    try {
      return sessionStorage.getItem(SS_LIVE_EXPANDED) === "1";
    } catch (e) {
      return false;
    }
  }

  function saveLiveExpandedPref(on) {
    try {
      sessionStorage.setItem(SS_LIVE_EXPANDED, on ? "1" : "0");
    } catch (e) {}
  }

  function loadChatUiMode() {
    try {
      const raw = localStorage.getItem(LS_CHAT_UI_MODE);
      if (raw == null || raw === "") return "coherency";
      return CHAT_UI_MODES.indexOf(raw) >= 0 ? raw : "coherency";
    } catch (e) {
      return "coherency";
    }
  }

  function saveChatUiMode(mode) {
    chatUiMode = CHAT_UI_MODES.indexOf(mode) >= 0 ? mode : "coherency";
    try {
      localStorage.setItem(LS_CHAT_UI_MODE, chatUiMode);
    } catch (e) {}
  }

  function loadSidebarStyle() {
    try {
      const raw = localStorage.getItem(LS_SIDEBAR_STYLE);
      if (raw == null || raw === "") return "a";
      const v = String(raw).toLowerCase();
      if (v === "d") return "a";
      return SIDEBAR_STYLES.indexOf(v) >= 0 ? v : "a";
    } catch (e) {
      return "a";
    }
  }

  function saveSidebarStyle(style) {
    const v = String(style || "").toLowerCase();
    sidebarStyle = SIDEBAR_STYLES.indexOf(v) >= 0 ? v : "a";
    try {
      localStorage.setItem(LS_SIDEBAR_STYLE, sidebarStyle);
    } catch (e) {}
  }

  function applySidebarStyle(style, opts) {
    opts = opts || {};
    if (style != null) saveSidebarStyle(style);
    else sidebarStyle = loadSidebarStyle();
    const drawer = document.getElementById("partyDrawer");
    if (!drawer) return;
    SIDEBAR_STYLES.forEach((s) => {
      drawer.classList.remove("party-sidebar-style-" + s);
      drawer.classList.remove("party-sidebar-" + (SIDEBAR_STYLE_MARKERS[s] || s));
    });
    drawer.classList.remove("party-sidebar-style-d", "party-sidebar-compact-rail");
    drawer.classList.add("party-sidebar-style-" + sidebarStyle);
    drawer.classList.add("party-sidebar-" + (SIDEBAR_STYLE_MARKERS[sidebarStyle] || sidebarStyle));
    drawer.dataset.sidebarStyle = sidebarStyle;
    if (!opts.keepTab) {
      sidebarTab = "chat";
    }
    drawer.dataset.sidebarTab = sidebarTab;
    drawer.classList.toggle("dual-collapsed", !!dualCollapsed && sidebarStyle === "e");
    if (sidebarStyle !== "a") {
      drawer.classList.remove("extras-open");
      const extras = document.getElementById("partyExtras");
      const moreBtn = document.getElementById("partyMoreBtn");
      if (extras && style != null) {
        extras.setAttribute("hidden", "");
        if (moreBtn) moreBtn.setAttribute("aria-expanded", "false");
      }
    }
    const tabs = drawer.querySelectorAll("#partySidebarTabs [data-sidebar-tab]");
    tabs.forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-sidebar-tab") === sidebarTab);
    });
    const styleBtns = drawer.querySelectorAll("[data-sidebar-style]");
    styleBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-sidebar-style") === sidebarStyle);
    });
    const dualBtn = document.getElementById("partyDualCollapse");
    if (dualBtn) {
      dualBtn.setAttribute("aria-expanded", dualCollapsed ? "false" : "true");
      const chev = dualBtn.querySelector(".party-dual-chevron");
      if (chev) chev.textContent = dualCollapsed ? "▾" : "▴";
    }
  }

  function bubblesEnabled() {
    if (!roomCode) return false;
    if (chatUiMode === "muted" || chatUiMode === "cinema") return false;
    if (chatUiMode === "peek" || chatUiMode === "coherency") return true;
    return !!chatCollapsed || !document.getElementById("partyDrawer")?.classList.contains("open");
  }

  function ensureRisingHost() {
    const fallback = partyHost();
    if (!fallback) return null;
    let el = document.getElementById("partyRisingBubbles");
    if (!el) {
      el = document.createElement("div");
      el.id = "partyRisingBubbles";
      el.className = "party-rising-bubbles";
      el.setAttribute("aria-live", "polite");
      el.setAttribute("aria-relevant", "additions");
      el.addEventListener("click", (e) => {
        const bubble = e.target.closest(".party-rising-bubble");
        if (!bubble) return;
        e.stopPropagation();
        if (chatUiMode === "peek") {
          peekComposeOpen = true;
          applyChatUiMode("coherency");
        } else if (chatUiMode === "coherency" || chatUiMode === "sidebar") {
          applyChatUiMode("sidebar");
          openOverlay();
        }
      });
    }
    placeRisingHost(el);
    return el;
  }

  /** Mount rising stack inside Live dock (after meta) or float on host otherwise. */
  function placeRisingHost(el) {
    el = el || document.getElementById("partyRisingBubbles");
    if (!el) return;
    const drawer = document.getElementById("partyDrawer");
    const inLiveDock = chatUiMode === "coherency" && !!roomCode && drawer && drawer.classList.contains("open");
    if (inLiveDock) {
      const ph = drawer.querySelector(".ph");
      const reacts = document.getElementById("partyReactions");
      const anchor = reacts || drawer.querySelector(".compose") || null;
      if (el.parentNode !== drawer || (ph && el.previousElementSibling !== ph)) {
        if (anchor) drawer.insertBefore(el, anchor);
        else if (ph && ph.nextSibling) drawer.insertBefore(el, ph.nextSibling);
        else drawer.appendChild(el);
      }
      el.classList.add("party-rising-in-dock");
    } else {
      const host = partyHost();
      if (host && el.parentNode !== host) host.appendChild(el);
      el.classList.remove("party-rising-in-dock");
    }
  }

  function risingFadeMs() {
    const host = document.getElementById("partyRisingBubbles");
    const n = host ? host.children.length : 0;
    if (n >= 3) return RISING_FADE_FAST_MS;
    return RISING_FADE_MS;
  }

  function pushRisingBubble(m) {
    if (!bubblesEnabled() || !m) return;
    const host = ensureRisingHost();
    if (!host) return;
    const kind = String(m.msgType || m.kind || "text").toLowerCase();
    const bubble = document.createElement("div");
    bubble.className = "party-rising-bubble";
    const who = escapeHtml(m.displayName || "?");
    let body = "";
    if (kind === "gif") body = "GIF";
    else if (kind === "voice") body = "🎤 voice note";
    else body = escapeHtml(String(m.text || "").slice(0, 140));
    bubble.innerHTML =
      '<span class="party-rising-name">' + who + '</span><span class="party-msg-sep" aria-hidden="true"> · </span>' + body;
    host.appendChild(bubble);
    while (host.children.length > RISING_MAX) host.removeChild(host.firstChild);
    scheduleLayoutPartyChrome();
    const fadeAfter = risingFadeMs();
    setTimeout(() => {
      bubble.classList.add("fade");
      setTimeout(() => {
        bubble.remove();
        scheduleLayoutPartyChrome();
      }, 500);
    }, fadeAfter);
  }

  function pushRisingReaction(emoji) {
    if (!bubblesEnabled() || !emoji) return;
    const host = ensureRisingHost();
    if (!host) return;
    const bubble = document.createElement("div");
    bubble.className = "party-rising-bubble party-rising-react";
    bubble.textContent = emoji;
    host.appendChild(bubble);
    while (host.children.length > RISING_MAX) host.removeChild(host.firstChild);
    scheduleLayoutPartyChrome();
    setTimeout(() => {
      bubble.classList.add("fade");
      setTimeout(() => {
        bubble.remove();
        scheduleLayoutPartyChrome();
      }, 500);
    }, Math.min(2200, risingFadeMs()));
  }

  /**
   * Collision-aware party chrome layout (marker: layoutPartyChrome).
   * Slots (priority): video safe → transport → compose+reactions → rising → room meta → FAB → LIVE badge.
   * Live/coherency: flex bottom dock (meta → bubbles → reactions → compose); FAB clears compose.
   */
  function layoutPartyChrome() {
    layoutChromeRaf = 0;
    const drawer = document.getElementById("partyDrawer");
    const fab = document.getElementById("partyFab");
    const rising = document.getElementById("partyRisingBubbles");
    const chrome = document.getElementById("collapsedChrome");
    const roots = layoutRoots();

    let vvInset = 0;
    let vvHeight = window.innerHeight || 0;
    try {
      if (window.visualViewport) {
        const vv = window.visualViewport;
        vvHeight = vv.height || vvHeight;
        vvInset = Math.max(0, (window.innerHeight || 0) - vv.height - (vv.offsetTop || 0));
      }
    } catch (e) {}

    const chromeHidden = !!(chrome && chrome.classList.contains("chrome-hidden"));
    const liveDock = chatUiMode === "coherency" && !!roomCode;
    const hideDock = !roomCode || chatUiMode === "muted" || chatUiMode === "cinema";

    placeRisingHost(rising);

    let fabClear = 56;
    if (fab && fab.classList.contains("show") && !fab.hidden) {
      const w = fab.offsetWidth || 48;
      fabClear = Math.ceil(w) + 20;
    }

    const shortLandscape =
      (window.matchMedia && window.matchMedia("(max-height: 500px) and (orientation: landscape)").matches) ||
      vvHeight < 500;
    const narrow = (window.innerWidth || 0) <= 720;

    roots.forEach((el) => {
      el.style.setProperty("--party-vv-inset", vvInset + "px");
      el.style.setProperty("--party-fab-clear", fabClear + "px");
      el.style.setProperty("--party-vv-height", Math.round(vvHeight) + "px");
      el.classList.toggle("party-live-dock", liveDock && !hideDock);
      el.classList.toggle("party-dock-dim", liveDock && chromeHidden);
      el.classList.toggle("party-dock-short", !!(liveDock && shortLandscape));
      el.classList.toggle("party-dock-narrow", !!(liveDock && narrow));
    });

    if (rising) {
      const cap = shortLandscape ? Math.min(vvHeight * 0.22, 96) : Math.min(vvHeight * 0.28, 160);
      rising.style.maxHeight = Math.max(48, Math.round(cap)) + "px";
      const kids = rising.children;
      for (let i = 0; i < kids.length; i++) {
        const age = kids.length - 1 - i;
        if (age >= 2) kids[i].style.opacity = String(Math.max(0.38, 1 - age * 0.2));
        else kids[i].style.opacity = "";
      }
    }

    if (drawer && liveDock) {
      drawer.classList.add("party-live-dock-el");
      const nameEl = document.getElementById("partyDrawerName");
      if (nameEl) {
        nameEl.title = nameEl.textContent || "";
      }
    } else if (drawer) {
      drawer.classList.remove("party-live-dock-el");
    }

    // Sidebar: keep FAB clear of open rail / guide tab
    if (fab && chatUiMode === "sidebar" && drawer && drawer.classList.contains("open") && !chatCollapsed) {
      fab.classList.remove("show");
    }
  }

  function scheduleLayoutPartyChrome() {
    if (layoutChromeRaf) return;
    layoutChromeRaf = requestAnimationFrame(() => layoutPartyChrome());
  }

  function wireLayoutPartyChrome() {
    if (layoutChromeWired) return;
    layoutChromeWired = true;
    const onLayout = () => scheduleLayoutPartyChrome();
    window.addEventListener("resize", onLayout, { passive: true });
    window.addEventListener("orientationchange", () => setTimeout(onLayout, 80));
    try {
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", onLayout, { passive: true });
        window.visualViewport.addEventListener("scroll", onLayout, { passive: true });
      }
    } catch (e) {}
    const chrome = document.getElementById("collapsedChrome");
    if (chrome && window.MutationObserver) {
      try {
        new MutationObserver(onLayout).observe(chrome, { attributes: true, attributeFilter: ["class", "aria-hidden"] });
      } catch (e) {}
    }
    document.addEventListener(
      "fullscreenchange",
      onLayout,
      { passive: true }
    );
  }

  function updateFabChrome() {
    const fab = document.getElementById("partyFab");
    if (!fab) return;
    CHAT_UI_MODES.forEach((m) => fab.classList.remove("mode-" + m));
    fab.classList.add("mode-" + chatUiMode);
    fab.dataset.chatMode = chatUiMode;
    const label = CHAT_UI_LABELS[chatUiMode] || chatUiMode;
    fab.title = "Chat: " + label + " (tap to cycle)";
    fab.setAttribute("aria-label", "Party chat mode " + label);
    let badge = fab.querySelector(".party-fab-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "party-fab-badge";
      fab.appendChild(badge);
    }
    if (chatUiMode === "muted" && unreadWhileMuted > 0) {
      badge.hidden = false;
      badge.textContent = unreadWhileMuted > 9 ? "9+" : String(unreadWhileMuted);
    } else {
      badge.hidden = true;
      badge.textContent = "";
    }
  }

  function applyChatUiMode(mode, opts) {
    opts = opts || {};
    const prev = chatUiMode;
    if (mode === "cinema" && prev !== "cinema") chatUiModeBeforeCinema = prev;
    saveChatUiMode(mode);
    layoutRoots().forEach((el) => {
      CHAT_UI_MODES.forEach((m) => el.classList.remove("party-chat-mode-" + m));
      el.classList.add("party-chat-mode-" + chatUiMode);
    });
    const drawer = document.getElementById("partyDrawer");
    const fab = document.getElementById("partyFab");
    peekComposeOpen = chatUiMode === "coherency" ? peekComposeOpen : false;

    if (chatUiMode === "sidebar") {
      if (!opts.skipOpen && roomCode) {
        chatCollapsed = false;
        saveChatMinPref(false);
        if (drawer) {
          drawer.classList.add("open");
          drawer.classList.remove("collapsed");
        }
        setChatClasses(true, false);
        if (fab) fab.classList.toggle("show", false);
      }
    } else if (chatUiMode === "coherency") {
      liveExpanded = false;
      saveLiveExpandedPref(false);
      chatCollapsed = false;
      saveChatMinPref(false);
      if (drawer) {
        drawer.classList.add("open");
        drawer.classList.remove("collapsed");
      }
      layoutRoots().forEach((el) => {
        el.classList.add("party-layout-rave");
        el.classList.add("party-live-overlay");
        el.classList.remove("party-live-expanded");
        el.classList.remove("party-chat-minimized");
        el.classList.add("party-chat-open");
        el.classList.remove("party-chat-collapsed");
      });
      if (fab) fab.classList.add("show");
      if (window.SDPartyAV && typeof SDPartyAV.onPartyLayoutChange === "function") {
        try {
          SDPartyAV.onPartyLayoutChange();
        } catch (e) {}
      }
    } else {
      clearChatIdle();
      chatCollapsed = true;
      saveChatMinPref(true);
      if (drawer) {
        drawer.classList.add("collapsed");
        drawer.classList.remove("open");
      }
      setChatClasses(false, false);
      if (fab) fab.classList.toggle("show", !!roomCode);
    }
    updateFabChrome();
    ensureRisingHost();
    applySidebarStyle(null, { keepTab: true });
    if (chatUiMode !== "muted") unreadWhileMuted = 0;
    scheduleLayoutPartyChrome();
  }

  function cycleChatUiMode() {
    const i = CHAT_UI_MODES.indexOf(chatUiMode);
    const next = CHAT_UI_MODES[(i + 1) % CHAT_UI_MODES.length];
    applyChatUiMode(next);
    toast(CHAT_UI_LABELS[next] || next);
  }

  function ensureModePicker() {
    let picker = document.getElementById("partyModePicker");
    if (picker) return picker;
    picker = document.createElement("div");
    picker.id = "partyModePicker";
    picker.className = "party-mode-picker";
    picker.hidden = true;
    picker.innerHTML = CHAT_UI_MODES.map(
      (m) =>
        '<button type="button" data-ui-mode="' +
        m +
        '">' +
        (CHAT_UI_LABELS[m] || m) +
        "</button>"
    ).join("");
    partyHost().appendChild(picker);
    picker.addEventListener("click", (e) => {
      const b = e.target.closest("[data-ui-mode]");
      if (!b) return;
      applyChatUiMode(b.getAttribute("data-ui-mode"));
      picker.hidden = true;
      toast(CHAT_UI_LABELS[chatUiMode] || chatUiMode);
    });
    return picker;
  }

  function toggleModePicker(force) {
    const picker = ensureModePicker();
    const show = force === undefined ? picker.hidden : !!force;
    picker.hidden = !show;
    if (show) {
      const fab = document.getElementById("partyFab");
      if (fab) {
        const r = fab.getBoundingClientRect();
        picker.style.right = Math.max(8, window.innerWidth - r.right) + "px";
        picker.style.bottom = Math.max(8, window.innerHeight - r.top + 8) + "px";
      }
    }
  }

  function clearChatIdle() {
    clearTimeout(chatIdleTimer);
    chatIdleTimer = null;
  }

  function scheduleChatIdle() {
    clearChatIdle();
    if (!roomCode || chatCollapsed) return;
    const mode = partyLayoutMode();
    if (mode !== "hulu" && mode !== "rave") return;
    chatIdleTimer = setTimeout(() => {
      if (!roomCode || chatCollapsed) return;
      setChatCollapsed(true);
    }, CHAT_IDLE_MS);
  }

  function noteChatActivity(opts) {
    opts = opts || {};
    if (opts.expand) {
      if (chatCollapsed) setChatCollapsed(false);
      else openOverlay();
    }
    clearChatIdle();
    if (!chatCollapsed && roomCode) scheduleChatIdle();
    if (window.SDPartyAV && typeof SDPartyAV.onPartyLayoutChange === "function") {
      try {
        SDPartyAV.onPartyLayoutChange();
      } catch (e) {}
    }
  }

  function ensureLiveBadge() {
    const host = chatRoot();
    if (!host) return null;
    let badge = document.getElementById("partyLiveBadge");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "partyLiveBadge";
      badge.className = "party-live-badge";
      badge.innerHTML =
        '<span class="party-live-pill">LIVE</span>' +
        '<span class="party-live-count" id="partyLiveCount">👁 1</span>';
      host.appendChild(badge);
    }
    return badge;
  }

  function syncLiveBadge() {
    const badge = ensureLiveBadge();
    if (!badge) return;
    const show = !!roomCode;
    badge.classList.toggle("show", show);
    const countEl = document.getElementById("partyLiveCount");
    const n = Math.max(1, (lastMembers && lastMembers.length) || 1);
    if (countEl) countEl.textContent = "👁 " + n;
  }

  function setChatClasses(open, collapsed) {
    const drawer = document.getElementById("partyDrawer");
    const fullyOpen = !!open && !collapsed;
    // Edge-handle minimize only while drawer remains open (landscape). Fully hidden = FAB only.
    const handleMin =
      !!collapsed && !!roomCode && !!(drawer && drawer.classList.contains("open"));
    let layoutHint = fullyOpen || handleMin ? partyLayoutMode() : null;
    if (chatUiMode === "coherency" && roomCode) layoutHint = "rave";
    liveExpanded = chatUiMode === "coherency" ? false : loadLiveExpandedPref();
    const roots = layoutRoots();
    roots.forEach((el) => {
      el.classList.toggle("party-chat-open", fullyOpen || chatUiMode === "coherency");
      el.classList.toggle("party-chat-collapsed", !!collapsed && !!roomCode && chatUiMode !== "coherency");
      el.classList.toggle("party-chat-minimized", handleMin && chatUiMode === "sidebar");
      el.classList.toggle("party-layout-rave", layoutHint === "rave" && (fullyOpen || chatUiMode === "coherency"));
      el.classList.toggle("party-layout-hulu", layoutHint === "hulu" && (fullyOpen || handleMin) && chatUiMode === "sidebar");
      el.classList.toggle(
        "party-live-overlay",
        (layoutHint === "rave" && fullyOpen && !liveExpanded) || chatUiMode === "coherency"
      );
      el.classList.toggle(
        "party-live-expanded",
        layoutHint === "rave" && fullyOpen && liveExpanded && chatUiMode !== "coherency"
      );
      CHAT_UI_MODES.forEach((m) => el.classList.toggle("party-chat-mode-" + m, m === chatUiMode));
    });
    syncLiveBadge();
    updateFabChrome();
    scheduleLayoutPartyChrome();
    if (window.SDPartyAV && typeof SDPartyAV.onPartyLayoutChange === "function") {
      try {
        SDPartyAV.onPartyLayoutChange();
      } catch (e) {}
    }
  }

  function syncPartyLayout() {
    const drawer = document.getElementById("partyDrawer");
    if (!drawer) return;
    const open = drawer.classList.contains("open");
    const collapsed = drawer.classList.contains("collapsed") || chatCollapsed;
    setChatClasses(open && !collapsed, collapsed && !!roomCode);
    scheduleLayoutPartyChrome();
  }

  function syncable() {
    if (!guestFollowSync) return false;
    if (typeof v === "undefined" || !v) return false;
    if (catchupUrl && syncLiveMode === "catchup" && playingCatchupUrl(catchupUrl)) {
      return true;
    }
    if (roomFeatures.sync_vod !== false && typeof vodHlsActive !== "undefined" && vodHlsActive) {
      return true;
    }
    return false;
  }

  function playingCatchupUrl(url) {
    if (!url) return false;
    try {
      const needle = String(url).split("?")[0];
      const cur =
        (typeof currentStreamUrl !== "undefined" && currentStreamUrl) ||
        (v && (v.currentSrc || v.src)) ||
        "";
      if (!cur) return false;
      return String(cur).indexOf(needle) >= 0 || String(cur).indexOf("/catchup/") >= 0;
    } catch (e) {
      return false;
    }
  }

  function shouldBroadcastClock() {
    if (!isHost) return false;
    if (syncable()) return true;
    if (syncLiveMode === "lag" || syncLiveMode === "pdt") return true;
    return false;
  }

  function serverNowMs() {
    return Date.now() + (Number(clockOffsetMs) || 0);
  }

  function getLiveEdgeOffset() {
    try {
      if (typeof hls !== "undefined" && hls) {
        if (typeof hls.latency === "number" && isFinite(hls.latency)) return hls.latency;
        if (typeof hls.liveSyncPosition === "number" && isFinite(hls.liveSyncPosition) && v) {
          return Math.max(0, hls.liveSyncPosition - (v.currentTime || 0));
        }
      }
    } catch (e) {}
    return null;
  }

  function getProgramDateTimeMs() {
    try {
      if (typeof hls !== "undefined" && hls && hls.playingDate) {
        const d = hls.playingDate;
        if (d instanceof Date && !isNaN(d.getTime())) return d.getTime();
      }
      if (lastProgramDateTime != null) return Number(lastProgramDateTime);
    } catch (e) {}
    return null;
  }

  function refreshPdtState(streamUrl) {
    hasPdt = false;
    lastProgramDateTime = null;
    try {
      if (typeof hls !== "undefined" && hls) {
        if (hls.playingDate instanceof Date && !isNaN(hls.playingDate.getTime())) {
          hasPdt = true;
          lastProgramDateTime = hls.playingDate.getTime();
        }
        const levels = hls.levels || [];
        for (let i = 0; i < levels.length; i++) {
          const details = levels[i] && levels[i].details;
          if (details && details.hasProgramDateTime) {
            hasPdt = true;
            break;
          }
          const frags = (details && details.fragments) || [];
          for (let j = 0; j < Math.min(frags.length, 6); j++) {
            if (frags[j] && frags[j].programDateTime) {
              hasPdt = true;
              lastProgramDateTime = frags[j].programDateTime;
              break;
            }
          }
          if (hasPdt) break;
        }
      }
    } catch (e) {}
    if (hasPdt) return Promise.resolve(true);
    const url = streamUrl || (typeof currentStreamUrl !== "undefined" ? currentStreamUrl : "") || catchupUrl;
    if (!url) return Promise.resolve(false);
    return fetch(url, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.text() : ""))
      .then((text) => {
        if (text && /#EXT-X-PROGRAM-DATE-TIME:/i.test(text)) {
          hasPdt = true;
          const m = text.match(/#EXT-X-PROGRAM-DATE-TIME:([^\r\n]+)/i);
          if (m) {
            const t = Date.parse(m[1].trim());
            if (!isNaN(t)) lastProgramDateTime = t;
          }
        }
        return hasPdt;
      })
      .catch(() => false);
  }

  async function ensureCatchupPlayback(url) {
    url = String(url || "").trim();
    if (!url || applyingContent) return;
    if (playingCatchupUrl(url) && lastAttachedCatchup === url) return;
    applyingContent = true;
    lastAttachedCatchup = url;
    try {
      toast("Switching to party catchup stream");
      if (typeof attachHls === "function") {
        await attachHls(url);
      } else if (v) {
        v.src = url;
        try {
          await v.play();
        } catch (e) {}
      }
      setTimeout(() => refreshPdtState(url), 600);
    } finally {
      applyingContent = false;
    }
  }

  function isWatchingVod() {
    try {
      if (location.pathname.startsWith("/vod")) return true;
    } catch (e) {}
    if (typeof vodHlsActive !== "undefined" && vodHlsActive) return true;
    if (
      typeof trailerActive !== "undefined" &&
      trailerActive &&
      vodPickerCtx &&
      (vodPickerCtx.tmdbId || vodPickerCtx.tmdb_id)
    ) {
      return true;
    }
    return false;
  }

  function liveProgrammeTitle() {
    try {
      if (typeof headerMeta !== "undefined" && headerMeta) {
        const epg =
          typeof getCachedEntry === "function" && typeof epgCache !== "undefined"
            ? getCachedEntry(epgCache, String(headerMeta.channel_id || channelId || ""))
            : null;
        if (epg && epg.now && epg.now.title) return String(epg.now.title);
        if (headerMeta.name) return String(headerMeta.name);
      }
      if (typeof channelId !== "undefined" && channelId && typeof channelMap !== "undefined") {
        const ch = channelMap[channelId];
        if (ch && ch.name) return String(ch.name);
      }
    } catch (e) {}
    return typeof channelId !== "undefined" && channelId ? "Channel " + channelId : "Live TV";
  }

  function usableArtUrl(raw) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!s || s === "null" || s === "undefined" || s === "none") return null;
    return s;
  }

  function liveChannelLogo() {
    try {
      if (typeof headerMeta !== "undefined" && headerMeta && headerMeta.logo) {
        return usableArtUrl(headerMeta.logo);
      }
      const id =
        typeof channelId !== "undefined" && channelId
          ? String(channelId)
          : headerMeta && (headerMeta.channel_id || headerMeta.id)
            ? String(headerMeta.channel_id || headerMeta.id)
            : "";
      if (id && typeof channelMap !== "undefined" && channelMap[id] && channelMap[id].logo) {
        return usableArtUrl(channelMap[id].logo);
      }
      if (typeof channelLogoUrl === "function") {
        return usableArtUrl(channelLogoUrl(headerMeta || { id: id, channel_id: id }));
      }
    } catch (e) {}
    return null;
  }

  function liveProgrammeArt() {
    try {
      if (typeof headerMeta !== "undefined" && headerMeta) {
        const epg =
          typeof getCachedEntry === "function" && typeof epgCache !== "undefined"
            ? getCachedEntry(epgCache, String(headerMeta.channel_id || channelId || ""))
            : null;
        const now = epg && epg.now;
        if (now) {
          const art = usableArtUrl(now.poster_url || now.image || now.icon);
          if (art) return art;
        }
      }
    } catch (e) {}
    return null;
  }

  function saveLastPlace(partial) {
    if (typeof window.SDSaveLastPlace === "function") {
      try {
        window.SDSaveLastPlace(partial);
        return;
      } catch (e) {}
    }
    try {
      const prev = JSON.parse(localStorage.getItem("sd_last_place") || "{}") || {};
      const next = Object.assign({}, prev, partial || {}, { ts: Date.now() });
      localStorage.setItem("sd_last_place", JSON.stringify(next));
    } catch (e) {}
  }

  function rememberPartyRecent(code, name, title) {
    try {
      const recent = JSON.parse(localStorage.getItem("sd_party_recent") || "[]");
      const payload = typeof contentPayload === "function" ? contentPayload() : {};
      const entry = {
        code: String(code || "").toUpperCase(),
        name: name || "",
        title: title || "",
        posterPath: (payload && payload.posterPath) || null,
        logoPath: (payload && payload.logoPath) || null,
        channelId: (payload && payload.channelId) || null,
        ts: Date.now(),
      };
      const next = [entry].concat(recent.filter((x) => x && x.code !== entry.code)).slice(0, 12);
      localStorage.setItem("sd_party_recent", JSON.stringify(next));
    } catch (e) {}
  }

  function contentTitle() {
    const p = contentPayload();
    return String(p.title || "").trim() || "Watch Party";
  }

  function provisionalRoomName() {
    const title = contentTitle();
    const base = title + " · Room …";
    return base.length > NAME_MAX ? title.slice(0, Math.max(12, NAME_MAX - 12)).trim() + "… · Room …" : base;
  }

  function needsDrawerRebuild() {
    return !(
      document.getElementById("partyFab") &&
      document.getElementById("partyDrawerName") &&
      document.getElementById("partyModeSwitch") &&
      document.getElementById("partyGifBtn") &&
      document.getElementById("partyAvProviderHost") &&
      document.getElementById("partyLiveExpandBtn") &&
      document.getElementById("partyMoreBtn") &&
      document.getElementById("partySidebarTabs") &&
      document.getElementById("partyCallBlock") &&
      document.getElementById("partySidebarStyleRow") &&
      document.getElementById("partyDualTop") &&
      document.getElementById("partySyncFollow") &&
      document.getElementById("partySyncLiveMode")
    );
  }

  function drawerHtml() {
    return (
      '<div class="ph">' +
      '<button type="button" class="party-icon-btn" id="partyCollapseBtn" title="Collapse chat" aria-label="Collapse">▾</button>' +
      '<div class="party-title-wrap">' +
      '<span class="party-drawer-name" id="partyDrawerName">Party</span>' +
      '<span class="party-code-chip" id="partyDrawerCode"></span>' +
      '<span class="party-public-badge" id="partyPublicBadge" hidden>Public</span>' +
      "</div>" +
      '<button type="button" class="party-icon-btn" id="partyMoreBtn" title="Room &amp; chat settings" aria-label="More settings" aria-expanded="false">⋯</button>' +
      '<button type="button" class="party-icon-btn" id="partyLiveExpandBtn" title="Expand chat panel" aria-label="Expand chat panel">▣</button>' +
      '<button type="button" class="party-icon-btn" id="partyHideBtn" title="Hide chat" aria-label="Hide">✕</button>' +
      "</div>" +
      '<div class="party-sb-tabbar" id="partySidebarTabs" role="tablist" aria-label="Sidebar sections">' +
      '<button type="button" role="tab" data-sidebar-tab="chat" class="active">Chat</button>' +
      '<button type="button" role="tab" data-sidebar-tab="people">People</button>' +
      '<button type="button" role="tab" data-sidebar-tab="call">Call</button>' +
      '<button type="button" role="tab" data-sidebar-tab="room">Room</button>' +
      "</div>" +
      '<div class="party-dual-top" id="partyDualTop">' +
      '<button type="button" class="party-dual-toggle" id="partyDualCollapse" aria-expanded="true">' +
      '<span class="party-dual-toggle-label"><span class="party-dual-dot" aria-hidden="true"></span> Call &amp; room</span>' +
      '<span class="party-dual-chevron" aria-hidden="true">▴</span>' +
      "</button>" +
      "</div>" +
      '<div class="party-call-block" id="partyCallBlock">' +
      '<div class="party-mode-switch" id="partyModeSwitch" role="tablist" aria-label="Call mode">' +
      '<button type="button" data-mode="text" class="active">Text</button>' +
      '<button type="button" data-mode="voice">Voice</button>' +
      '<button type="button" data-mode="video">Video</button>' +
      '<button type="button" data-mode="hybrid">Hybrid</button>' +
      "</div>" +
      '<div class="party-av-provider-host" id="partyAvProviderHost"></div>' +
      '<div class="party-features-bar" id="partyFeaturesBar" hidden>' +
      '<label><input type="checkbox" data-feat="chat_text"/> Text</label>' +
      '<label><input type="checkbox" data-feat="chat_gif"/> GIF</label>' +
      '<label><input type="checkbox" data-feat="chat_voice_note"/> Voice note</label>' +
      '<label><input type="checkbox" data-feat="av_voice"/> AV voice</label>' +
      '<label><input type="checkbox" data-feat="av_video"/> AV video</label>' +
      '<label class="party-sync-feat"><input type="checkbox" data-feat="sync_vod"/> VOD sync</label>' +
      '<label class="party-sync-feat"><input type="checkbox" data-feat="sync_wait_buffering"/> Wait buffering</label>' +
      '<label class="party-sync-follow"><input type="checkbox" id="partySyncFollow"/> Follow sync</label>' +
      '<label class="party-sync-live" id="partySyncLiveWrap">Sync live ' +
      '<select id="partySyncLiveMode" aria-label="Live sync mode">' +
      '<option value="off">Off</option>' +
      '<option value="content">Content</option>' +
      '<option value="catchup">Catchup</option>' +
      '<option value="lag">Lag</option>' +
      '<option value="pdt">PDT</option>' +
      "</select></label>" +
      "</div>" +
      '<div class="party-host-bar" id="partyHostBar" hidden>' +
      '<input id="partyRenameInput" maxlength="64" placeholder="Room display name"/>' +
      '<button type="button" id="partyRenameBtn">Rename</button>' +
      '<label class="party-public-toggle"><input type="checkbox" id="partyPublicToggle"/> Public</label>' +
      "</div>" +
      "</div>" +
      '<div class="members" id="partyMembers"></div>' +
      '<div class="party-extras" id="partyExtras" hidden>' +
      '<div class="party-sidebar-style-row" id="partySidebarStyleRow">' +
      '<span class="party-sidebar-style-label">Sidebar layout</span>' +
      '<div class="party-sidebar-style-picker" role="group" aria-label="Sidebar layout">' +
      '<button type="button" data-sidebar-style="a" title="Chat first">Chat first</button>' +
      '<button type="button" data-sidebar-style="b" title="Tabs">Tabs</button>' +
      '<button type="button" data-sidebar-style="e" title="Dual pane">Dual pane</button>' +
      "</div>" +
      '<p class="party-sidebar-style-hint">Applies when chat mode is Sidebar</p>' +
      "</div>" +
      "</div>" +
      '<div class="chat" id="partyChat"></div>' +
      '<div class="party-reactions" id="partyReactions">' +
      REACTIONS.map((e) => '<button type="button" data-emoji="' + e + '">' + e + "</button>").join("") +
      "</div>" +
      '<div class="party-gif-picker" id="partyGifPicker">' +
      '<input id="partyGifQuery" placeholder="Search GIFs / paste URL" maxlength="200"/>' +
      '<div class="party-gif-grid" id="partyGifGrid"></div>' +
      "</div>" +
      '<div class="compose">' +
      '<div class="party-compose-tools">' +
      '<button type="button" class="party-icon-btn" id="partyGifBtn" title="GIF">GIF</button>' +
      '<button type="button" class="party-icon-btn" id="partyVoiceBtn" title="Voice note">🎤</button>' +
      "</div>" +
      '<input id="partyChatInput" placeholder="Say something…" maxlength="280"/>' +
      '<button type="button" id="partyChatSend">Send</button></div>' +
      '<p class="party-tabs-hint" id="partyTabsHint">Call and Room tabs include call providers and additional features.</p>'
    );
  }

  function partyModalHtml() {
    return (
      "<h3>Watch party</h3>" +
      '<label class="party-field-label" for="sdPartyRoomName">Room name</label>' +
      '<input id="sdPartyRoomName" maxlength="64" placeholder="Title · Room …" style="width:100%;box-sizing:border-box"/>' +
      '<label class="party-public-check"><input type="checkbox" id="sdPartyPublic"/> Public room (anyone on the household PIN can browse &amp; join)</label>' +
      '<input id="sdPartyPassword" type="password" placeholder="Password (optional)" autocomplete="off" style="width:100%;margin-top:8px;box-sizing:border-box"/>' +
      '<div class="row"><button type="button" class="primary" id="sdPartyCreate">Create room</button>' +
      '<button type="button" id="sdPartyJoinBtn">Join with code</button></div>' +
      '<input id="sdPartyJoinCode" placeholder="ABCDE" maxlength="5" style="width:100%;margin-top:8px;text-transform:uppercase"/>' +
      '<div class="party-public-section">' +
      '<div class="party-public-head"><span>Public rooms</span>' +
      '<button type="button" id="sdPartyRefreshPublic">Refresh</button></div>' +
      '<div id="sdPartyPublicList" class="party-public-list"><p class="party-muted">Loading…</p></div></div>' +
      '<div id="sdPartyCreated" hidden>' +
      '<div class="party-created-name" id="sdPartyDisplayName"></div>' +
      '<div class="code" id="sdPartyCode"></div>' +
      '<div class="qr-wrap" id="sdPartyQr"></div>' +
      '<input id="sdPartyJoinUrl" readonly style="width:100%;box-sizing:border-box"/>' +
      '<div class="row"><button type="button" class="primary" id="sdPartyInvite">Invite</button>' +
      '<button type="button" id="sdPartyCopy">Copy link</button>' +
      '<button type="button" id="sdPartyForceSync">Force sync</button>' +
      '<button type="button" id="sdPartyLeave">Leave</button></div></div>' +
      '<div class="row"><button type="button" id="sdPartyClose">Close</button></div>'
    );
  }

  function getInviteState() {
    const path = (typeof contentPayload === "function" && contentPayload().channelId
      ? "/tv/" + contentPayload().channelId
      : null) || location.pathname + location.search || "/tv/";
    let watchPath = path;
    try {
      const p = contentPayload();
      if (p && p.mediaType === "live" && p.channelId) watchPath = "/tv/" + p.channelId;
      else if (p && (p.tmdbId || p.tmdb_id)) {
        const mt = (p.mediaType || "movie") === "tv" ? "tv" : "movie";
        watchPath = "/vod/" + mt + "/" + (p.tmdbId || p.tmdb_id);
      }
    } catch (e) {}
    return {
      code: roomCode || "",
      name: roomName || "",
      title: contentTitle(),
      public: !!roomPublic,
      locked: !!roomLocked,
      hostKey: hostKey || loadHostKey(roomCode) || "",
      isHost: !!isHost,
      watchPath: watchPath,
    };
  }

  function openInvite(opts) {
    opts = opts || {};
    if (window.SDPartyInvite && typeof SDPartyInvite.open === "function" && (roomCode || opts.code)) {
      SDPartyInvite.open(
        Object.assign({}, opts, {
          state: Object.assign(getInviteState(), opts.state || {}, opts.code ? { code: opts.code } : {}),
        })
      );
      return;
    }
    openShare(opts);
  }

  function ensureUi() {
    if (!document.getElementById("sdShareModal")) {
      const bd = document.createElement("div");
      bd.className = "sd-modal-backdrop";
      bd.id = "sdShareBackdrop";
      const modal = document.createElement("div");
      modal.className = "sd-modal";
      modal.id = "sdShareModal";
      modal.innerHTML =
        '<h3 id="sdShareTitle">Share</h3>' +
        '<p id="sdShareHint" style="margin:0;color:#9aa;font-size:13px"></p>' +
        '<div class="qr-wrap" id="sdShareQr"></div>' +
        '<div class="code" id="sdShareCode" hidden></div>' +
        '<input id="sdShareUrl" readonly style="width:100%;box-sizing:border-box"/>' +
        '<div class="row">' +
        '<button type="button" class="primary" id="sdShareCopy">Copy link</button>' +
        '<button type="button" id="sdShareRemote">Phone remote</button>' +
        '<button type="button" id="sdShareClose">Close</button></div>';
      document.body.appendChild(bd);
      document.body.appendChild(modal);
    }

    let pmodal = document.getElementById("sdPartyModal");
    if (!pmodal) {
      const pbd = document.createElement("div");
      pbd.className = "sd-modal-backdrop";
      pbd.id = "sdPartyBackdrop";
      pmodal = document.createElement("div");
      pmodal.className = "sd-modal sd-modal-party";
      pmodal.id = "sdPartyModal";
      pmodal.innerHTML = partyModalHtml();
      document.body.appendChild(pbd);
      document.body.appendChild(pmodal);
    } else if (!document.getElementById("sdPartyRoomName")) {
      pmodal.innerHTML = partyModalHtml();
      uiWired = false;
    }

    const host = chatRoot();
    adoptPartyChrome(host);
    let drawer = document.getElementById("partyDrawer");
    let fab = document.getElementById("partyFab");
    if (!drawer || needsDrawerRebuild()) {
      if (drawer) drawer.remove();
      const oldReact = document.getElementById("partyReactions");
      if (oldReact && !oldReact.closest("#partyDrawer")) oldReact.remove();
      drawer = document.createElement("div");
      drawer.className = "party-drawer";
      drawer.id = "partyDrawer";
      drawer.innerHTML = drawerHtml();
      host.appendChild(drawer);
      uiWired = false;
    } else if (drawer.parentNode !== host) {
      host.appendChild(drawer);
    }
    if (!fab) {
      fab = document.createElement("button");
      fab.type = "button";
      fab.className = "party-fab";
      fab.id = "partyFab";
      fab.title = "Open party chat";
      fab.setAttribute("aria-label", "Open party chat");
      fab.innerHTML = '💬<span class="party-fab-badge" hidden></span>';
      host.appendChild(fab);
      uiWired = false;
    } else if (fab.parentNode !== host) {
      host.appendChild(fab);
    }
    ensureRisingHost();
    updateFabChrome();
    applySidebarStyle(null, { keepTab: true });
    if (!document.getElementById("partyToast")) {
      const toast = document.createElement("div");
      toast.className = "party-toast";
      toast.id = "partyToast";
      host.appendChild(toast);
    } else {
      const toast = document.getElementById("partyToast");
      if (toast && toast.parentNode !== host) host.appendChild(toast);
    }
    ensureLiveBadge();
    adoptPartyChrome(host);
    wireLayoutPartyChrome();
    scheduleLayoutPartyChrome();

    if (!uiWired) {
      wireUi();
      uiWired = true;
    }
  }

  function wireUi() {
    const bd = document.getElementById("sdShareBackdrop");
    if (bd && !bd.dataset.wired) {
      bd.dataset.wired = "1";
      bd.addEventListener("click", closeShare);
    }
    const shareClose = document.getElementById("sdShareClose");
    if (shareClose && !shareClose.dataset.wired) {
      shareClose.dataset.wired = "1";
      shareClose.addEventListener("click", closeShare);
    }
    const shareCopy = document.getElementById("sdShareCopy");
    if (shareCopy && !shareCopy.dataset.wired) {
      shareCopy.dataset.wired = "1";
      shareCopy.addEventListener("click", () => {
        const inp = document.getElementById("sdShareUrl");
        if (inp) {
          inp.select();
          navigator.clipboard && navigator.clipboard.writeText(inp.value).catch(() => {});
        }
      });
    }
    const shareRemote = document.getElementById("sdShareRemote");
    if (shareRemote && !shareRemote.dataset.wired) {
      shareRemote.dataset.wired = "1";
      shareRemote.addEventListener("click", createRemoteQr);
    }

    const pbd = document.getElementById("sdPartyBackdrop");
    if (pbd && !pbd.dataset.wired) {
      pbd.dataset.wired = "1";
      pbd.addEventListener("click", closePartyModal);
    }
    const closeBtn = document.getElementById("sdPartyClose");
    if (closeBtn && !closeBtn.dataset.wired) {
      closeBtn.dataset.wired = "1";
      closeBtn.addEventListener("click", closePartyModal);
    }
    const createBtn = document.getElementById("sdPartyCreate");
    if (createBtn && !createBtn.dataset.wired) {
      createBtn.dataset.wired = "1";
      createBtn.addEventListener("click", () => createParty());
    }
    const joinBtn = document.getElementById("sdPartyJoinBtn");
    if (joinBtn && !joinBtn.dataset.wired) {
      joinBtn.dataset.wired = "1";
      joinBtn.addEventListener("click", () => {
        const code = (document.getElementById("sdPartyJoinCode").value || "").trim().toUpperCase();
        if (code) joinParty(code);
      });
    }
    const inviteBtn = document.getElementById("sdPartyInvite");
    if (inviteBtn && !inviteBtn.dataset.wired) {
      inviteBtn.dataset.wired = "1";
      inviteBtn.addEventListener("click", () => openInvite());
    }
    const copyBtn = document.getElementById("sdPartyCopy");
    if (copyBtn && !copyBtn.dataset.wired) {
      copyBtn.dataset.wired = "1";
      copyBtn.addEventListener("click", () => {
        const inp = document.getElementById("sdPartyJoinUrl");
        if (inp && navigator.clipboard) navigator.clipboard.writeText(inp.value).catch(() => {});
        else openInvite({ tab: "link" });
      });
    }
    const forceBtn = document.getElementById("sdPartyForceSync");
    if (forceBtn && !forceBtn.dataset.wired) {
      forceBtn.dataset.wired = "1";
      forceBtn.addEventListener("click", forceSync);
    }
    const leaveBtn = document.getElementById("sdPartyLeave");
    if (leaveBtn && !leaveBtn.dataset.wired) {
      leaveBtn.dataset.wired = "1";
      leaveBtn.addEventListener("click", leaveParty);
    }
    const refreshPublic = document.getElementById("sdPartyRefreshPublic");
    if (refreshPublic && !refreshPublic.dataset.wired) {
      refreshPublic.dataset.wired = "1";
      refreshPublic.addEventListener("click", loadPublicRooms);
    }
    const publicList = document.getElementById("sdPartyPublicList");
    if (publicList && !publicList.dataset.wired) {
      publicList.dataset.wired = "1";
      publicList.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-join-code]");
        if (!btn) return;
        const code = btn.getAttribute("data-join-code");
        if (code) joinParty(code);
      });
    }

    const send = document.getElementById("partyChatSend");
    const input = document.getElementById("partyChatInput");
    if (send && !send.dataset.wired) {
      send.dataset.wired = "1";
      send.addEventListener("click", () => {
        noteChatActivity({ expand: true });
        sendChat(input && input.value);
        if (input) input.value = "";
      });
    }
    if (input && !input.dataset.wired) {
      input.dataset.wired = "1";
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          noteChatActivity({ expand: true });
          sendChat(input.value);
          input.value = "";
        }
      });
      input.addEventListener("focus", () => noteChatActivity({ expand: true }));
      input.addEventListener("input", () => noteChatActivity());
    }
    const gifBtn = document.getElementById("partyGifBtn");
    if (gifBtn && !gifBtn.dataset.wired) {
      gifBtn.dataset.wired = "1";
      gifBtn.addEventListener("click", () => {
        noteChatActivity({ expand: true });
        toggleGifPicker();
      });
    }
    const voiceBtn = document.getElementById("partyVoiceBtn");
    if (voiceBtn && !voiceBtn.dataset.wired) {
      voiceBtn.dataset.wired = "1";
      voiceBtn.addEventListener("click", () => {
        noteChatActivity({ expand: true });
        toggleVoiceNote();
      });
    }
    const gifQuery = document.getElementById("partyGifQuery");
    if (gifQuery && !gifQuery.dataset.wired) {
      gifQuery.dataset.wired = "1";
      let gifTimer = null;
      gifQuery.addEventListener("input", () => {
        clearTimeout(gifTimer);
        gifTimer = setTimeout(() => searchGifs(gifQuery.value), 280);
      });
      gifQuery.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const val = (gifQuery.value || "").trim();
          if (/^https?:\/\//i.test(val)) {
            sendGif(val);
            gifQuery.value = "";
            toggleGifPicker(false);
          } else searchGifs(val);
        }
      });
    }
    const gifGrid = document.getElementById("partyGifGrid");
    if (gifGrid && !gifGrid.dataset.wired) {
      gifGrid.dataset.wired = "1";
      gifGrid.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-gif-url]");
        if (!b) return;
        noteChatActivity({ expand: true });
        sendGif(b.getAttribute("data-gif-url"));
        toggleGifPicker(false);
      });
    }
    const modeSwitch = document.getElementById("partyModeSwitch");
    if (modeSwitch && !modeSwitch.dataset.wired) {
      modeSwitch.dataset.wired = "1";
      modeSwitch.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-mode]");
        if (!b || b.disabled) return;
        noteChatActivity({ expand: true });
        setChatMode(b.getAttribute("data-mode"));
      });
    }
    const avHost = document.getElementById("partyAvProviderHost");
    if (avHost && window.SDPartyAV && SDPartyAV.injectProviderSelect) {
      SDPartyAV.injectProviderSelect(avHost);
    }
    const featBar = document.getElementById("partyFeaturesBar");
    if (featBar && !featBar.dataset.wired) {
      featBar.dataset.wired = "1";
      featBar.addEventListener("change", (e) => {
        const follow = e.target.closest("#partySyncFollow");
        if (follow) {
          saveGuestFollowSync(!!follow.checked);
          toast(guestFollowSync ? "Following host sync" : "Sync follow off");
          return;
        }
        const liveSel = e.target.closest("#partySyncLiveMode");
        if (liveSel) {
          sendSetSyncLive(liveSel.value);
          return;
        }
        const inp = e.target.closest("input[data-feat]");
        if (!inp || !isAdmin) return;
        const patch = {};
        patch[inp.getAttribute("data-feat")] = !!inp.checked;
        sendSetFeatures(patch);
      });
    }
    const reactsEl = document.getElementById("partyReactions");
    if (reactsEl && !reactsEl.dataset.wired) {
      reactsEl.dataset.wired = "1";
      reactsEl.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-emoji]");
        if (b) {
          noteChatActivity({ expand: true });
          sendReaction(b.dataset.emoji);
        }
      });
    }
    const membersEl = document.getElementById("partyMembers");
    if (membersEl && !membersEl.dataset.wired) {
      membersEl.dataset.wired = "1";
      membersEl.addEventListener("click", (e) => {
        const kick = e.target.closest("[data-kick]");
        if (kick && isHost) kickMember(kick.getAttribute("data-kick"));
        const adminBtn = e.target.closest("[data-admin]");
        if (adminBtn && isHost) {
          const id = adminBtn.getAttribute("data-admin");
          const grant = adminBtn.getAttribute("data-grant") === "1";
          if (grant) sendGrantAdmin(id);
          else sendRevokeAdmin(id);
        }
      });
    }
    const collapseBtn = document.getElementById("partyCollapseBtn");
    if (collapseBtn && !collapseBtn.dataset.wired) {
      collapseBtn.dataset.wired = "1";
      collapseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setChatCollapsed(!chatCollapsed);
      });
    }
    const expandBtn = document.getElementById("partyLiveExpandBtn");
    if (expandBtn && !expandBtn.dataset.wired) {
      expandBtn.dataset.wired = "1";
      expandBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        liveExpanded = !liveExpanded;
        saveLiveExpandedPref(liveExpanded);
        expandBtn.title = liveExpanded ? "Overlay chat (FB Live)" : "Expand chat panel";
        expandBtn.textContent = liveExpanded ? "▦" : "▣";
        noteChatActivity({ expand: true });
        syncPartyLayout();
      });
    }
    const hideBtn = document.getElementById("partyHideBtn");
    if (hideBtn && !hideBtn.dataset.wired) {
      hideBtn.dataset.wired = "1";
      hideBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        clearChatIdle();
        chatCollapsed = true;
        saveChatMinPref(true);
        const d = document.getElementById("partyDrawer");
        if (d) {
          d.classList.add("collapsed");
          d.classList.remove("open");
        }
        setChatClasses(false, false);
        document.getElementById("partyFab")?.classList.add("show");
      });
    }
    const moreBtn = document.getElementById("partyMoreBtn");
    if (moreBtn && !moreBtn.dataset.wired) {
      moreBtn.dataset.wired = "1";
      moreBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const extras = document.getElementById("partyExtras");
        const drawer = document.getElementById("partyDrawer");
        if (!extras) return;
        const open = extras.hasAttribute("hidden");
        if (open) extras.removeAttribute("hidden");
        else extras.setAttribute("hidden", "");
        moreBtn.setAttribute("aria-expanded", open ? "true" : "false");
        if (drawer) drawer.classList.toggle("extras-open", open);
        noteChatActivity();
      });
    }
    const sidebarTabs = document.getElementById("partySidebarTabs");
    if (sidebarTabs && !sidebarTabs.dataset.wired) {
      sidebarTabs.dataset.wired = "1";
      sidebarTabs.addEventListener("click", (e) => {
        const b = e.target.closest("[data-sidebar-tab]");
        if (!b) return;
        sidebarTab = b.getAttribute("data-sidebar-tab") || "chat";
        applySidebarStyle(null, { keepTab: true });
        noteChatActivity();
      });
    }
    const styleRow = document.getElementById("partySidebarStyleRow");
    if (styleRow && !styleRow.dataset.wired) {
      styleRow.dataset.wired = "1";
      styleRow.addEventListener("click", (e) => {
        const b = e.target.closest("[data-sidebar-style]");
        if (!b) return;
        const next = b.getAttribute("data-sidebar-style");
        applySidebarStyle(next);
        toast("Sidebar: " + (SIDEBAR_STYLE_LABELS[sidebarStyle] || sidebarStyle));
        noteChatActivity();
      });
    }
    const dualCollapse = document.getElementById("partyDualCollapse");
    if (dualCollapse && !dualCollapse.dataset.wired) {
      dualCollapse.dataset.wired = "1";
      dualCollapse.addEventListener("click", (e) => {
        e.stopPropagation();
        dualCollapsed = !dualCollapsed;
        applySidebarStyle(null, { keepTab: true });
        noteChatActivity();
      });
    }
    const drawer = document.getElementById("partyDrawer");
    if (drawer && !drawer.dataset.minTapWired) {
      drawer.dataset.minTapWired = "1";
      drawer.addEventListener("click", (e) => {
        if (!chatCollapsed) return;
        if (e.target.closest("#partyCollapseBtn") || e.target.closest("#partyHideBtn")) return;
        setChatCollapsed(false);
      });
    }
    const fab = document.getElementById("partyFab");
    if (fab && !fab.dataset.wired) {
      fab.dataset.wired = "1";
      const onFabActivate = () => {
        if (fabIgnoreClick) {
          fabIgnoreClick = false;
          return;
        }
        const now = Date.now();
        const dbl = now - fabLastTapAt < 420;
        fabLastTapAt = now;
        if (dbl && chatUiMode === "cinema") {
          applyChatUiMode(chatUiModeBeforeCinema || "sidebar");
          toast(CHAT_UI_LABELS[chatUiMode] || chatUiMode);
          return;
        }
        if (dbl && chatUiMode === "peek") {
          peekComposeOpen = true;
          applyChatUiMode("coherency");
          toast("Compose");
          return;
        }
        cycleChatUiMode();
      };
      fab.addEventListener("click", onFabActivate);
      fab.addEventListener("pointerdown", (e) => {
        if (e.button != null && e.button !== 0) return;
        clearTimeout(fabLongPressTimer);
        fabLongPressTimer = setTimeout(() => {
          fabIgnoreClick = true;
          toggleModePicker(true);
        }, 520);
      });
      const clearLp = () => clearTimeout(fabLongPressTimer);
      fab.addEventListener("pointerup", clearLp);
      fab.addEventListener("pointerleave", clearLp);
      fab.addEventListener("pointercancel", clearLp);
    }
    const renameBtn = document.getElementById("partyRenameBtn");
    if (renameBtn && !renameBtn.dataset.wired) {
      renameBtn.dataset.wired = "1";
      renameBtn.addEventListener("click", sendRename);
    }
    const publicToggle = document.getElementById("partyPublicToggle");
    if (publicToggle && !publicToggle.dataset.wired) {
      publicToggle.dataset.wired = "1";
      publicToggle.addEventListener("change", () => sendSetPublic(!!publicToggle.checked));
    }
  }

  function setChatCollapsed(collapsed) {
    chatCollapsed = !!collapsed;
    saveChatMinPref(chatCollapsed);
    const drawer = document.getElementById("partyDrawer");
    const layout = partyLayoutMode();
    if (drawer) {
      drawer.classList.toggle("collapsed", chatCollapsed);
      if (chatCollapsed && layout === "hulu" && roomCode) {
        // Landscape: thin right-edge handle
        drawer.classList.add("open");
      } else if (chatCollapsed) {
        // Portrait / desktop: FAB-only
        drawer.classList.remove("open");
      }
    }
    const btn = document.getElementById("partyCollapseBtn");
    if (btn) {
      btn.textContent = chatCollapsed ? (layout === "hulu" ? "‹" : "▴") : "▾";
      btn.title = chatCollapsed ? "Expand chat" : "Collapse chat";
    }
    const open = !!(drawer && drawer.classList.contains("open"));
    setChatClasses(open && !chatCollapsed, chatCollapsed);
    const fab = document.getElementById("partyFab");
    if (fab) fab.classList.toggle("show", !!roomCode && (!open || chatCollapsed || chatUiMode !== "sidebar"));
    updateFabChrome();
    if (chatCollapsed) clearChatIdle();
    else scheduleChatIdle();
  }

  function qrImg(payload) {
    const abs = payload.startsWith("http") ? payload : location.origin + payload;
    return (
      '<img alt="QR" src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' +
      encodeURIComponent(abs) +
      '"/>'
    );
  }

  function openShare(opts) {
    ensureUi();
    opts = opts || {};
    if (roomCode && !opts.forceContent && !(opts.detail && (opts.detail.tmdb_id || opts.detail.tmdbId))) {
      openInvite(opts);
      return;
    }
    const d = opts.detail || vodCatalogDetail || vodPickerCtx || {};
    let path = "";
    if (d.tmdb_id || d.tmdbId) {
      const mt = (d.type || d.mediaType || "movie") === "tv" ? "tv" : "movie";
      const id = d.tmdb_id || d.tmdbId;
      path = "/vod/" + mt + "/" + id;
      const s = d.season || (vodPickerCtx && vodPickerCtx.season);
      const e = d.episode || (vodPickerCtx && vodPickerCtx.episode);
      if (mt === "tv" && s) {
        path += "?season=" + encodeURIComponent(s);
        if (e) path += "&episode=" + encodeURIComponent(e);
      }
    } else if (typeof channelId !== "undefined" && channelId) {
      path = "/tv/" + channelId;
    } else {
      path = location.pathname + location.search;
    }
    const abs = location.origin + path;
    document.getElementById("sdShareTitle").textContent = "Share";
    document.getElementById("sdShareHint").textContent = d.title || d.name || path;
    document.getElementById("sdShareCode").hidden = true;
    document.getElementById("sdShareUrl").value = abs;
    document.getElementById("sdShareQr").innerHTML = qrImg(abs);
    document.getElementById("sdShareBackdrop").classList.add("open");
    document.getElementById("sdShareModal").classList.add("open");
  }

  function closeShare() {
    document.getElementById("sdShareBackdrop")?.classList.remove("open");
    document.getElementById("sdShareModal")?.classList.remove("open");
  }

  async function createRemoteQr() {
    try {
      const r = await authFetch("/party/remote-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel_id: typeof channelId !== "undefined" ? channelId : "",
          room_code: roomCode || "",
        }),
      });
      const data = await r.json();
      if (!data.ok && !data.token) throw new Error("token");
      const url = location.origin + "/remote?token=" + encodeURIComponent(data.token);
      document.getElementById("sdShareTitle").textContent = "Phone remote";
      document.getElementById("sdShareHint").textContent = "Scan to control this player";
      document.getElementById("sdShareUrl").value = url;
      document.getElementById("sdShareQr").innerHTML = qrImg(url);
      ensureRemoteListener();
      if (!roomCode) await createParty({ quiet: true });
    } catch (e) {
      if (typeof showErr === "function") showErr("Could not create remote link");
    }
  }

  function openPanel() {
    ensureUi();
    const nameEl = document.getElementById("sdPartyRoomName");
    if (nameEl && !roomCode) {
      let prefName = "";
      try {
        prefName = sessionStorage.getItem("sd_party_create_name") || "";
      } catch (e) {}
      nameEl.value = prefName || provisionalRoomName();
    }
    try {
      const pub = document.getElementById("sdPartyPublic");
      if (pub && !roomCode) {
        const v = sessionStorage.getItem("sd_party_create_public");
        if (v === "0" || v === "1") pub.checked = v === "1";
        else {
          const ls = localStorage.getItem("sd_party_create_public");
          if (ls === "0" || ls === "1") pub.checked = ls === "1";
        }
      }
      const pw = document.getElementById("sdPartyPassword");
      if (pw && !roomCode) {
        pw.value = sessionStorage.getItem("sd_party_create_password") || "";
      }
    } catch (e) {}
    document.getElementById("sdPartyBackdrop").classList.add("open");
    document.getElementById("sdPartyModal").classList.add("open");
    if (roomCode) showPartyCreated(roomCode, { name: roomName });
    else loadPublicRooms();
  }
  function closePartyModal() {
    document.getElementById("sdPartyBackdrop")?.classList.remove("open");
    document.getElementById("sdPartyModal")?.classList.remove("open");
  }

  function contentPayload(extra) {
    extra = extra || {};
    const onVod = isWatchingVod();
    if (!onVod && !extra.tmdbId && !extra.tmdb_id) {
      const ch = typeof channelId !== "undefined" ? channelId : null;
      const logo = usableArtUrl(extra.logoPath || extra.logo) || liveChannelLogo();
      const poster =
        usableArtUrl(extra.posterPath || extra.poster_url || extra.image) ||
        liveProgrammeArt() ||
        logo;
      return {
        tmdbId: null,
        mediaType: "live",
        title: extra.title || liveProgrammeTitle(),
        posterPath: poster,
        logoPath: logo,
        season: null,
        episode: null,
        channelId: ch,
        hls: !!(catchupUrl && syncLiveMode === "catchup"),
      };
    }
    const ctx = Object.assign({}, vodPickerCtx || {}, extra);
    const detail = typeof vodCatalogDetail !== "undefined" ? vodCatalogDetail : null;
    const poster =
      usableArtUrl(
        (detail && (detail.poster_url || detail.poster_path)) || ctx.posterPath || ctx.poster_url
      ) || null;
    return {
      tmdbId: ctx.tmdbId || ctx.tmdb_id || (detail && detail.tmdb_id) || null,
      mediaType: ctx.mediaType || ctx.type || (detail && detail.type) || "movie",
      title: ctx.title || (detail && detail.title) || "",
      posterPath: poster,
      logoPath: usableArtUrl(ctx.logoPath || ctx.logo) || null,
      season: ctx.season || null,
      episode: ctx.episode || null,
      channelId: null,
      hls: !!syncable(),
    };
  }

  function readPassword() {
    const el = document.getElementById("sdPartyPassword");
    return ((el && el.value) || "").trim();
  }

  function readCreateName() {
    const el = document.getElementById("sdPartyRoomName");
    const v = ((el && el.value) || "").trim();
    return v || provisionalRoomName();
  }

  function readCreatePublic() {
    const el = document.getElementById("sdPartyPublic");
    return !!(el && el.checked);
  }

  async function loadPublicRooms() {
    const list = document.getElementById("sdPartyPublicList");
    if (!list) return;
    list.innerHTML = '<p class="party-muted">Loading…</p>';
    try {
      const r = await authFetch("/party/public");
      const data = await r.json();
      const rooms = (data && data.rooms) || [];
      if (!rooms.length) {
        list.innerHTML = '<p class="party-muted">No public rooms right now.</p>';
        return;
      }
      list.innerHTML = rooms
        .map((room) => {
          const title = escapeHtml(room.name || room.title || room.code || "Party");
          const meta =
            escapeHtml(String(room.memberCount || 0)) +
            " watching" +
            (room.locked ? " · 🔒" : "") +
            (room.title ? " · " + escapeHtml(room.title) : "");
          return (
            '<div class="party-public-card">' +
            '<div class="party-public-meta"><strong>' +
            title +
            "</strong><span>" +
            meta +
            '</span></div>' +
            '<button type="button" class="primary" data-join-code="' +
            escapeHtml(room.code) +
            '">Join</button></div>'
          );
        })
        .join("");
    } catch (e) {
      list.innerHTML = '<p class="party-muted">Could not load public rooms.</p>';
    }
  }

  async function createParty(opts) {
    opts = opts || {};
    ensureUi();
    try {
      const body = { content: contentPayload(opts.content) };
      const pwd = opts.password != null ? opts.password : readPassword();
      const name = opts.name != null ? opts.name : readCreateName();
      const isPublic = opts.public != null ? !!opts.public : readCreatePublic();
      if (pwd) body.password = pwd;
      if (name) body.name = name;
      body.public = isPublic;
      const r = await authFetch("/party/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!data.code) throw new Error("create");
      hostKey = data.hostKey || "";
      storeHostKey(data.code, hostKey);
      roomName = data.name || name || "";
      roomPublic = !!data.public;
      roomNumber = data.roomNumber || 0;
      await connectWs("join", data.code, { password: pwd, hostKey });
      isHost = true;
      rememberPartyRecent(data.code, roomName, contentTitle());
      saveLastPlace({
        path: location.pathname + location.search,
        partyCode: data.code,
        channelId: typeof channelId !== "undefined" ? channelId : null,
        title: contentTitle(),
      });
      if (!opts.quiet) {
        showPartyCreated(data.code, { name: roomName, room: data.room });
        openOverlay();
        toast((roomName || "Party") + " — invite ready");
      } else {
        showPartyCreated(data.code, { name: roomName, room: data.room });
      }
    } catch (e) {
      if (typeof showErr === "function") showErr("Party create failed");
    }
  }

  function applyRoomMeta(room) {
    if (!room) return;
    if (room.code) roomCode = room.code;
    if (room.name) roomName = room.name;
    if (typeof room.public === "boolean") roomPublic = room.public;
    if (typeof room.locked === "boolean") roomLocked = room.locked;
    if (room.roomNumber != null) roomNumber = room.roomNumber;
    if (room.features && typeof room.features === "object") {
      roomFeatures = Object.assign({}, DEFAULT_FEATURES, room.features);
    }
    if (Array.isArray(room.admins)) roomAdmins = room.admins.slice();
    if (room.hostId) {
      isHost = room.hostId === memberId;
    }
    isAdmin = isHost || (memberId && roomAdmins.indexOf(memberId) >= 0);
    const prevCatchup = catchupUrl;
    if (room.syncLiveMode != null) {
      const mode = String(room.syncLiveMode || "content").toLowerCase();
      syncLiveMode = SYNC_LIVE_MODES.indexOf(mode) >= 0 ? mode : "content";
    }
    if ("catchupUrl" in room) catchupUrl = room.catchupUrl || null;
    if ("waitForBuffering" in room) waitForBuffering = !!room.waitForBuffering;
    else waitForBuffering = !!roomFeatures.sync_wait_buffering;
    const nameEl = document.getElementById("partyDrawerName");
    if (nameEl) nameEl.textContent = roomName || "Party";
    const codeEl = document.getElementById("partyDrawerCode");
    if (codeEl) codeEl.textContent = roomCode || "";
    const badge = document.getElementById("partyPublicBadge");
    if (badge) badge.hidden = !roomPublic;
    const display = document.getElementById("sdPartyDisplayName");
    if (display) display.textContent = roomName || "";
    const hostBar = document.getElementById("partyHostBar");
    if (hostBar) hostBar.hidden = !isHost;
    const renameInput = document.getElementById("partyRenameInput");
    if (renameInput && document.activeElement !== renameInput) renameInput.value = roomName || "";
    const publicToggle = document.getElementById("partyPublicToggle");
    if (publicToggle) publicToggle.checked = !!roomPublic;
    const syncBtn = document.getElementById("sdPartyForceSync");
    if (syncBtn) syncBtn.style.display = isHost ? "" : "none";
    syncFeaturesUi();
    syncModeUi();
    if (catchupUrl && syncLiveMode === "catchup") {
      ensureCatchupPlayback(catchupUrl);
    } else if (!catchupUrl && prevCatchup) {
      lastAttachedCatchup = null;
    }
  }

  function syncFeaturesUi() {
    const bar = document.getElementById("partyFeaturesBar");
    if (!bar) return;
    bar.hidden = false;
    bar.classList.add("show");
    bar.querySelectorAll("input[data-feat]").forEach((inp) => {
      const key = inp.getAttribute("data-feat");
      inp.checked = !!roomFeatures[key];
      if (key) inp.disabled = !isAdmin;
    });
    // Chat/AV/sync feature labels: admin-only; follow sync is for everyone.
    bar.querySelectorAll("label").forEach((lab) => {
      if (lab.classList.contains("party-sync-follow")) {
        lab.style.display = "";
        return;
      }
      if (lab.classList.contains("party-sync-live")) {
        lab.style.display = isAdmin ? "" : "none";
        return;
      }
      const feat = lab.querySelector("input[data-feat]");
      if (feat) lab.style.display = isAdmin ? "" : "none";
    });
    if (!isAdmin) {
      const followLab = bar.querySelector(".party-sync-follow");
      if (followLab) followLab.style.display = "";
    }
    const follow = document.getElementById("partySyncFollow");
    if (follow) {
      follow.checked = !!guestFollowSync;
      follow.disabled = false;
    }
    const liveWrap = document.getElementById("partySyncLiveWrap");
    const liveSel = document.getElementById("partySyncLiveMode");
    if (liveWrap) liveWrap.style.display = isAdmin ? "" : "none";
    if (liveSel) {
      liveSel.value = SYNC_LIVE_MODES.indexOf(syncLiveMode) >= 0 ? syncLiveMode : "content";
      liveSel.disabled = !isAdmin;
    }
    // Keep bar visible when anyone is in a party (follow sync); collapse if not in room
    if (!roomCode) {
      bar.hidden = true;
      bar.classList.remove("show");
    } else if (!isAdmin) {
      // Slim guest bar: only follow sync
      bar.hidden = false;
    }
    const gifBtn = document.getElementById("partyGifBtn");
    const voiceBtn = document.getElementById("partyVoiceBtn");
    const input = document.getElementById("partyChatInput");
    const send = document.getElementById("partyChatSend");
    if (gifBtn) gifBtn.disabled = !roomFeatures.chat_gif;
    if (voiceBtn) voiceBtn.disabled = !roomFeatures.chat_voice_note;
    if (input) {
      input.disabled = !roomFeatures.chat_text;
      input.placeholder = roomFeatures.chat_text ? "Say something…" : "Text chat disabled";
    }
    if (send) send.disabled = !roomFeatures.chat_text;
    const modeSwitch = document.getElementById("partyModeSwitch");
    if (modeSwitch) {
      modeSwitch.querySelectorAll("button[data-mode]").forEach((b) => {
        const mode = b.getAttribute("data-mode");
        if (mode === "text") b.disabled = false;
        else if (mode === "voice") b.disabled = !roomFeatures.av_voice;
        else if (mode === "video") b.disabled = !roomFeatures.av_video;
        else if (mode === "hybrid") b.disabled = !(roomFeatures.av_voice || roomFeatures.av_video);
      });
    }
    if (chatMode === "voice" && !roomFeatures.av_voice) setChatMode("text");
    else if (chatMode === "video" && !roomFeatures.av_video) setChatMode("text");
    else if (chatMode === "hybrid" && !(roomFeatures.av_voice || roomFeatures.av_video)) setChatMode("text");
  }

  function syncModeUi() {
    const modeSwitch = document.getElementById("partyModeSwitch");
    if (modeSwitch) {
      modeSwitch.querySelectorAll("button[data-mode]").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-mode") === chatMode);
      });
    }
    // Built-in / Jitsi always use floating overlay — never full-bleed party-av-full.
    const layerEl = layer();
    if (layerEl) layerEl.classList.remove("party-av-full");
  }

  function partySend(msg) {
    if (!ws || ws.readyState !== 1) return;
    try {
      ws.send(JSON.stringify(msg));
    } catch (e) {}
  }

  function stopAv() {
    if (window.SDPartyAV && SDPartyAV.stop) SDPartyAV.stop();
  }

  function startAv(mode) {
    if (!roomCode || !window.SDPartyAV) return;
    SDPartyAV.start({
      mode: mode,
      roomCode: roomCode,
      memberId: memberId,
      displayName: partyName(),
      send: partySend,
    });
  }

  function setChatMode(mode) {
    mode = String(mode || "text").toLowerCase();
    if (mode === "voice" && !roomFeatures.av_voice) {
      toast("Voice chat disabled by host");
      return;
    }
    if (mode === "video" && !roomFeatures.av_video) {
      toast("Video chat disabled by host");
      return;
    }
    if (mode === "hybrid" && !(roomFeatures.av_voice || roomFeatures.av_video)) {
      toast("AV chat disabled by host");
      return;
    }
    chatMode = mode;
    syncModeUi();
    if (mode === "text") stopAv();
    else startAv(mode);
  }

  function toggleGifPicker(force) {
    const picker = document.getElementById("partyGifPicker");
    if (!picker) return;
    if (!roomFeatures.chat_gif) {
      toast("GIFs disabled by host");
      picker.classList.remove("open");
      return;
    }
    const open = force == null ? !picker.classList.contains("open") : !!force;
    picker.classList.toggle("open", open);
    if (open) searchGifs((document.getElementById("partyGifQuery") || {}).value || "party");
  }

  async function searchGifs(q) {
    const grid = document.getElementById("partyGifGrid");
    if (!grid) return;
    grid.innerHTML = "<p class='party-muted'>Loading…</p>";
    try {
      const r = await authFetch("/party/gifs?q=" + encodeURIComponent(q || "party") + "&limit=18");
      const data = await r.json();
      const items = (data && data.results) || [];
      if (!items.length) {
        grid.innerHTML = "<p class='party-muted'>No GIFs — paste a GIF URL above</p>";
        return;
      }
      grid.innerHTML = items
        .map(
          (it) =>
            '<button type="button" data-gif-url="' +
            escapeHtml(it.url) +
            '"><img src="' +
            escapeHtml(it.preview || it.url) +
            '" alt="" loading="lazy"/></button>'
        )
        .join("");
    } catch (e) {
      grid.innerHTML = "<p class='party-muted'>GIF search failed — paste a URL</p>";
    }
  }

  function sendGif(url) {
    url = String(url || "").trim();
    if (!url || !ws || ws.readyState !== 1) return;
    if (!roomFeatures.chat_gif) {
      toast("GIFs disabled by host");
      return;
    }
    ws.send(JSON.stringify({ type: "chat", msgType: "gif", url: url, text: "" }));
  }

  async function toggleVoiceNote() {
    if (!roomFeatures.chat_voice_note) {
      toast("Voice notes disabled by host");
      return;
    }
    const btn = document.getElementById("partyVoiceBtn");
    if (voiceRecorder && voiceRecorder.state === "recording") {
      voiceRecorder.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceChunks = [];
      voiceStartAt = Date.now();
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      voiceRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      voiceRecorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size) voiceChunks.push(ev.data);
      };
      voiceRecorder.onstop = async () => {
        try {
          stream.getTracks().forEach((t) => t.stop());
        } catch (e) {}
        const blob = new Blob(voiceChunks, { type: voiceRecorder.mimeType || "audio/webm" });
        voiceRecorder = null;
        if (btn) btn.textContent = "🎤";
        const durationMs = Date.now() - voiceStartAt;
        if (blob.size < 200) return;
        await uploadAndSendVoice(blob, durationMs);
      };
      voiceRecorder.start();
      if (btn) btn.textContent = "⏹";
      toast("Recording… tap again to send");
    } catch (e) {
      toast("Mic permission needed");
    }
  }

  async function uploadAndSendVoice(blob, durationMs) {
    if (!ws || ws.readyState !== 1) return;
    try {
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      const b64 = btoa(bin);
      const r = await authFetch("/party/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: roomCode,
          kind: "voice",
          contentType: blob.type || "audio/webm",
          data: b64,
        }),
      });
      const data = await r.json();
      if (!data || !data.ok || !data.url) {
        toast((data && data.error) || "Upload failed");
        return;
      }
      ws.send(
        JSON.stringify({
          type: "chat",
          msgType: "voice",
          url: data.url,
          durationMs: durationMs || 0,
          text: "",
        })
      );
    } catch (e) {
      toast("Voice upload failed");
    }
  }

  function sendSetFeatures(patch) {
    if (!isAdmin || !ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: "set_features", features: patch }));
  }
  function sendSetSyncLive(mode) {
    if (!isAdmin || !ws || ws.readyState !== 1) return;
    const m = String(mode || "content").toLowerCase();
    const next = SYNC_LIVE_MODES.indexOf(m) >= 0 ? m : "content";
    syncLiveMode = next;
    ws.send(JSON.stringify({ type: "set_sync_live", mode: next }));
    toast("Live sync: " + next);
  }
  function sendGrantAdmin(id) {
    if (!isHost || !ws || ws.readyState !== 1 || !id) return;
    ws.send(JSON.stringify({ type: "grant_admin", memberId: id }));
  }
  function sendRevokeAdmin(id) {
    if (!isHost || !ws || ws.readyState !== 1 || !id) return;
    ws.send(JSON.stringify({ type: "revoke_admin", memberId: id }));
  }

  function showPartyCreated(code, meta) {
    meta = meta || {};
    roomCode = code;
    if (meta.name) roomName = meta.name;
    if (meta.room) applyRoomMeta(meta.room);
    else applyRoomMeta({ code: code, name: roomName, public: roomPublic, roomNumber: roomNumber });
    const wrap = document.getElementById("sdPartyCreated");
    if (wrap) wrap.hidden = false;
    const c = document.getElementById("sdPartyCode");
    if (c) c.textContent = code;
    const join = location.origin + "/party/join/" + code;
    const inp = document.getElementById("sdPartyJoinUrl");
    if (inp) inp.value = join;
    const qr = document.getElementById("sdPartyQr");
    if (qr) qr.innerHTML = qrImg(join);
    try {
      if (window.SDPartyInvite && SDPartyInvite.ensureHostBeacon) SDPartyInvite.ensureHostBeacon();
    } catch (e) {}
    if (isHost) startLanBeacon();
  }

  async function joinParty(code, opts) {
    opts = opts || {};
    code = String(code || "").toUpperCase();
    const attempts = Math.max(1, opts.retries != null ? opts.retries : 1);
    let pwd = opts.password != null ? opts.password : readPassword();
    if (!pwd) {
      try {
        pwd = sessionStorage.getItem("sd_party_password_pending") || "";
      } catch (e) {}
    }
    const hk = opts.hostKey || loadHostKey(code) || "";
    let lastErr = null;
    for (let i = 0; i < attempts; i++) {
      try {
        const msg = await connectWs("join", code, { password: pwd, hostKey: hk });
        if (!msg || (msg.type !== "joined" && msg.type !== "created")) {
          throw new Error("timeout");
        }
        try {
          sessionStorage.removeItem("sd_party_password_pending");
        } catch (e) {}
        showPartyCreated(code, { name: roomName });
        rememberPartyRecent(code, roomName, contentTitle());
        saveLastPlace({
          path: location.pathname + location.search,
          partyCode: code,
          channelId: typeof channelId !== "undefined" ? channelId : null,
          title: contentTitle(),
        });
        openOverlay();
        closePartyModal();
        return msg;
      } catch (e) {
        lastErr = e;
        const err = String((e && e.message) || e || "");
        if (err === "bad_password" || err === "not_found" || err === "auth_required" || err === "full" || err === "feature_disabled") {
          break;
        }
        if (i + 1 < attempts) {
          await new Promise((r) => setTimeout(r, 700 + i * 500));
        }
      }
    }
    const err = String((lastErr && lastErr.message) || lastErr || "party");
    if (err === "bad_password") {
      if (typeof showErr === "function") showErr("Wrong party password");
      else toast("Wrong party password");
      openPanel();
    } else if (err === "not_found") {
      if (typeof showErr === "function") showErr("Party not found or expired");
      else toast("Party not found or expired");
    } else if (err === "auth_required") {
      if (typeof showErr === "function") showErr("Session ended — sign in again");
      else toast("Session ended — sign in again");
    } else if (err === "full") {
      toast("Party is full");
    } else if (typeof showErr === "function") showErr("Could not join party");
    else toast("Could not join party");
    throw lastErr || new Error(err);
  }

  function wsUrl() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    return proto + "://" + location.host + "/ws/party";
  }

  function connectWs(mode, code, opts) {
    opts = opts || {};
    return new Promise((resolve, reject) => {
      try {
        if (ws) {
          try {
            ws.close();
          } catch (e) {}
        }
        let settled = false;
        const done = (fn, arg) => {
          if (settled) return;
          settled = true;
          fn(arg);
        };
        ws = new WebSocket(wsUrl());
        ws.onopen = () => {
          const payload = {
            type: mode,
            code: code,
            displayName: partyName(),
            clientId: clientId(),
            content: contentPayload(),
          };
          if (opts.password) payload.password = opts.password;
          if (opts.hostKey) payload.hostKey = opts.hostKey;
          if (mode === "create") {
            if (opts.name) payload.name = opts.name;
            if (typeof opts.public === "boolean") payload.public = opts.public;
          }
          ws.send(JSON.stringify(payload));
          startPingLoop();
          sendPing();
        };
        ws.onmessage = (ev) => {
          let msg;
          try {
            msg = JSON.parse(ev.data);
          } catch (e) {
            return;
          }
          handleMsg(msg);
          if (msg.type === "created" || msg.type === "joined") done(resolve, msg);
          if (msg.type === "error") done(reject, new Error(msg.error || "party"));
        };
        ws.onerror = () => done(reject, new Error("ws"));
        setTimeout(() => done(reject, new Error("timeout")), 8000);
      } catch (e) {
        reject(e);
      }
    });
  }

  function handleMsg(msg) {
    if (!msg || !msg.type) return;
    if (msg.type === "created" || msg.type === "joined") {
      memberId = msg.memberId || "";
      if (msg.hostKey) {
        hostKey = msg.hostKey;
        storeHostKey((msg.room && msg.room.code) || roomCode, hostKey);
      }
      roomCode = (msg.room && msg.room.code) || roomCode;
      isHost = !!(msg.room && msg.room.hostId === memberId);
      if (msg.room) renderRoom(msg.room);
      ensureRemoteListener();
      bindBuffering();
      startClockLoop();
      if (!isHost && msg.room && msg.room.content) {
        applyContent(msg.room.content, { fromJoin: true });
      }
      if (!isHost && msg.room && msg.room.clock) {
        setTimeout(() => applyClock(msg.room.clock, true), 800);
      }
    } else if (msg.type === "room_meta" && msg.room) {
      applyRoomMeta(msg.room);
      if (msg.room.members) renderMembers(msg.room.members);
    } else if (msg.type === "pong") {
      handlePong(msg);
    } else if (msg.type === "error" && msg.error === "catchup_unavailable") {
      toast("Catchup unavailable — falling back");
      syncLiveMode = "content";
      catchupUrl = null;
      syncFeaturesUi();
    } else if (msg.type === "host") {
      if (msg.memberId === memberId) {
        isHost = true;
        isAdmin = true;
        if (msg.hostKey) {
          hostKey = msg.hostKey;
          storeHostKey(roomCode, hostKey);
        }
        toast("You are now the host");
        showPartyCreated(roomCode, { name: roomName });
        applyRoomMeta({
          code: roomCode,
          name: roomName,
          public: roomPublic,
          roomNumber: roomNumber,
          features: roomFeatures,
          admins: roomAdmins,
          hostId: memberId,
        });
      } else {
        isHost = false;
        applyRoomMeta({
          code: roomCode,
          name: roomName,
          public: roomPublic,
          roomNumber: roomNumber,
          features: roomFeatures,
          admins: roomAdmins,
          hostId: msg.memberId,
        });
      }
    } else if (msg.type === "member" && msg.members) {
      renderMembers(msg.members);
      if (window.SDPartyAV && SDPartyAV.onMembers) SDPartyAV.onMembers(msg.members);
    } else if (msg.type === "chat" && msg.message) {
      appendChat(msg.message);
    } else if (msg.type === "error" && msg.error === "feature_disabled") {
      toast("That feature is disabled by the host");
    } else if (msg.type === "reaction") {
      floatEmoji(msg.emoji);
    } else if (msg.type === "clock" && msg.clock) {
      applyClock(msg.clock, false);
    } else if (msg.type === "content" && msg.content) {
      applyContent(msg.content);
    } else if (msg.type === "force_sync") {
      if (msg.content) applyContent(msg.content, { force: true });
      if (msg.clock) setTimeout(() => applyClock(msg.clock, true), 600);
      toast("Host forced sync");
    } else if (msg.type === "kicked") {
      toast("Removed from party");
      leaveParty({ silent: true });
    } else if (msg.type === "remote" && msg.cmd) {
      handleRemote(msg.cmd);
    } else if (
      msg.type === "webrtc_offer" ||
      msg.type === "webrtc_answer" ||
      msg.type === "webrtc_ice" ||
      msg.type === "webrtc_hangup" ||
      msg.type === "av_state"
    ) {
      if (window.SDPartyAV && SDPartyAV.handleSignal) SDPartyAV.handleSignal(msg);
    }
  }

  function sameContent(a, b) {
    if (!a || !b) return false;
    return (
      String(a.tmdbId || a.tmdb_id || "") === String(b.tmdbId || b.tmdb_id || "") &&
      String(a.channelId || a.channel_id || "") === String(b.channelId || b.channel_id || "") &&
      String(a.season || "") === String(b.season || "") &&
      String(a.episode || "") === String(b.episode || "") &&
      String(a.mediaType || a.type || "movie").toLowerCase() ===
        String(b.mediaType || b.type || "movie").toLowerCase()
    );
  }

  async function applyContent(content, opts) {
    opts = opts || {};
    if (!content || isHost || applyingContent) return;
    const already = sameContent(content, contentPayload());
    const tmdb = content.tmdbId || content.tmdb_id;
    const channel = content.channelId || content.channel_id;
    // Live TV has no scrub sync — if already on the host channel, never reload.
    if (!opts.force && already) {
      if (!tmdb && channel) return;
      if (syncable() || !opts.fromJoin) return;
      if (!tmdb) return;
    }
    applyingContent = true;
    try {
      const media = String(content.mediaType || content.type || "movie").toLowerCase();
      const title = content.title || "title";
      if (tmdb && media !== "live" && media !== "channel") {
        toast("Following host → " + title);
        const ctx = {
          tmdbId: String(tmdb),
          mediaType: media === "tv" || media === "series" || media === "show" ? "tv" : "movie",
          season: content.season != null && content.season !== "" ? String(content.season) : "",
          episode: content.episode != null && content.episode !== "" ? String(content.episode) : "",
          title: title,
          imdbId: (content.imdbId || content.imdb_id || "") + "",
        };
        if (typeof startVodPlayback === "function") {
          await startVodPlayback(ctx, "vod_picker");
        } else {
          let path =
            ctx.mediaType === "tv"
              ? "/vod/tv/" +
                ctx.tmdbId +
                (ctx.season
                  ? "?season=" +
                    encodeURIComponent(ctx.season) +
                    (ctx.episode ? "&episode=" + encodeURIComponent(ctx.episode) : "")
                  : "")
              : "/vod/movie/" + ctx.tmdbId;
          if (ctx.imdbId && ctx.imdbId.indexOf("tt") === 0) {
            path += (path.indexOf("?") >= 0 ? "&" : "?") + "imdb=" + encodeURIComponent(ctx.imdbId);
          }
          const join = path + (path.includes("?") ? "&" : "?") + "party=" + encodeURIComponent(roomCode);
          location.href = join;
        }
      } else if (channel) {
        if (catchupUrl && syncLiveMode === "catchup") {
          toast("Following host → catchup");
          await ensureCatchupPlayback(catchupUrl);
          return;
        }
        const alreadyOn =
          typeof channelId !== "undefined" && String(channelId) === String(channel);
        if (alreadyOn && !opts.force) {
          toast("In host’s live channel");
          return;
        }
        toast("Following host → live");
        if (typeof switchChannel === "function") {
          await switchChannel(String(channel), { force: !!opts.force });
        } else {
          // Avoid reload-loop: only navigate if path differs.
          const want = "/tv/" + encodeURIComponent(channel);
          if (!location.pathname.replace(/\/$/, "").endsWith("/" + String(channel))) {
            const join =
              want +
              "?party=" +
              encodeURIComponent(roomCode || "") +
              (partyName() ? "&name=" + encodeURIComponent(partyName()) : "");
            location.href = join;
          }
        }
      } else if (!opts.fromJoin) {
        toast("Host changed content");
      }
    } catch (e) {
      toast("Could not follow host content");
    } finally {
      applyingContent = false;
    }
  }

  function renderRoom(room) {
    applyRoomMeta(room);
    renderMembers(room.members || []);
    const chat = document.getElementById("partyChat");
    if (chat) {
      chat.innerHTML = "";
      (room.chat || []).forEach((m) => appendChat(m, { silent: true }));
    }
  }
  function renderMembers(members) {
    lastMembers = members || [];
    if (window.SDPartyAV && SDPartyAV.onMembers) SDPartyAV.onMembers(lastMembers);
    syncLiveBadge();
    const el = document.getElementById("partyMembers");
    if (!el) return;
    el.innerHTML = lastMembers
      .filter((m) => m.kind !== "remote")
      .map((m) => {
        const buff = m.buffering ? ' <span class="party-muted">…</span>' : "";
        const host =
          m.role === "host"
            ? ' <span class="party-role" title="Host">host</span>'
            : "";
        const adminMark =
          roomAdmins.indexOf(m.id) >= 0 && m.role !== "host"
            ? ' <span class="party-role" title="Admin">admin</span>'
            : "";
        const kick =
          isHost && m.id !== memberId
            ? ' <button type="button" class="party-kick" data-kick="' +
              escapeHtml(m.id) +
              '" title="Kick">×</button>'
            : "";
        let adminBtn = "";
        if (isHost && m.id !== memberId && m.role !== "host") {
          const isAdm = roomAdmins.indexOf(m.id) >= 0;
          adminBtn = isAdm
            ? ' <button type="button" class="party-kick" data-admin="' +
              escapeHtml(m.id) +
              '" data-grant="0" title="Revoke admin">−</button>'
            : ' <button type="button" class="party-kick" data-admin="' +
              escapeHtml(m.id) +
              '" data-grant="1" title="Make admin">+</button>';
        }
        return (
          '<span class="party-member' +
          (m.role === "host" ? " is-host" : "") +
          '" title="' +
          escapeHtml(m.displayName || "?") +
          '">' +
          escapeHtml(m.displayName || "?") +
          host +
          adminMark +
          buff +
          adminBtn +
          kick +
          "</span>"
        );
      })
      .join('<span class="party-member-sep" aria-hidden="true"> · </span>');
  }
  function appendChat(m, opts) {
    opts = opts || {};
    const chat = document.getElementById("partyChat");
    if (!chat || !m) return;
    const div = document.createElement("div");
    const kind = String(m.msgType || m.kind || "text").toLowerCase();
    div.className = "m" + (kind === "gif" ? " party-msg-gif" : kind === "voice" ? " party-msg-voice" : "");
    const name =
      '<span class="n">' +
      escapeHtml(m.displayName || "?") +
      '</span><span class="party-msg-sep" aria-hidden="true"> · </span>';
    if (kind === "gif" && m.url) {
      div.innerHTML =
        name +
        (m.text ? escapeHtml(m.text) + " " : "") +
        '<a href="' +
        escapeHtml(m.url) +
        '" target="_blank" rel="noopener"><img src="' +
        escapeHtml(m.url) +
        '" alt="GIF" loading="lazy"/></a>';
    } else if (kind === "voice" && m.url) {
      const secs = m.durationMs ? Math.round(m.durationMs / 1000) + "s" : "";
      div.innerHTML =
        name +
        (secs ? '<span class="party-muted">' + secs + "</span> " : "") +
        '<audio controls preload="metadata" src="' +
        escapeHtml(m.url) +
        '"></audio>';
    } else {
      div.innerHTML = name + escapeHtml(m.text || "");
    }
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    if (opts.silent) return;
    if (chatUiMode === "muted" || chatUiMode === "cinema") {
      if (chatUiMode === "muted") {
        unreadWhileMuted += 1;
        updateFabChrome();
      }
      return;
    }
    if (bubblesEnabled()) {
      pushRisingBubble(m);
      noteChatActivity();
      return;
    }
    noteChatActivity({ expand: chatUiMode === "sidebar" });
  }
  function floatEmoji(emoji) {
    if (!emoji) return;
    if (chatUiMode === "muted" || chatUiMode === "cinema") return;
    if (bubblesEnabled()) {
      pushRisingReaction(emoji);
    }
    const liveOverlay =
      document.body.classList.contains("party-live-overlay") ||
      layoutRoots().some((el) => el.classList.contains("party-live-overlay"));
    const mobileSplit =
      !liveOverlay &&
      (document.body.classList.contains("party-layout-rave") ||
        document.body.classList.contains("party-layout-hulu") ||
        layoutRoots().some(
          (el) => el.classList.contains("party-layout-rave") || el.classList.contains("party-layout-hulu")
        ));
    const drawer = document.getElementById("partyDrawer");
    const chat = document.getElementById("partyChat");
    const host = liveOverlay
      ? partyHost()
      : mobileSplit && (chat || drawer)
        ? chat || drawer
        : partyHost();
    const el = document.createElement("div");
    el.className = "party-float-emoji";
    el.textContent = emoji;
    if (liveOverlay) {
      el.style.left = "auto";
      el.style.right = 6 + Math.random() * 18 + "%";
      el.style.bottom = 18 + Math.random() * 12 + "%";
    } else {
      el.style.left = (mobileSplit ? 18 + Math.random() * 64 : 40 + Math.random() * 20) + "%";
      if (mobileSplit) el.style.bottom = "8%";
    }
    host.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }
  function toast(text) {
    ensureUi();
    const el = document.getElementById("partyToast");
    if (!el) return;
    el.textContent = text;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2400);
  }

  function openOverlay() {
    ensureUi();
    if (chatUiMode !== "sidebar") {
      applyChatUiMode(chatUiMode, { skipOpen: false });
      return;
    }
    chatCollapsed = false;
    saveChatMinPref(false);
    const drawer = document.getElementById("partyDrawer");
    if (drawer) {
      drawer.classList.add("open");
      drawer.classList.remove("collapsed");
    }
    document.getElementById("partyFab")?.classList.remove("show");
    setChatClasses(true, false);
    const btn = document.getElementById("partyCollapseBtn");
    if (btn) {
      btn.textContent = "▾";
      btn.title = "Collapse chat";
    }
    const expandBtn = document.getElementById("partyLiveExpandBtn");
    if (expandBtn) {
      liveExpanded = loadLiveExpandedPref();
      expandBtn.title = liveExpanded ? "Overlay chat (FB Live)" : "Expand chat panel";
      expandBtn.textContent = liveExpanded ? "▦" : "▣";
    }
    updateFabChrome();
    scheduleChatIdle();
  }

  function sendChat(text) {
    text = String(text || "").trim();
    if (!text || !ws || ws.readyState !== 1) return;
    if (!roomFeatures.chat_text) {
      toast("Text chat disabled by host");
      return;
    }
    ws.send(JSON.stringify({ type: "chat", msgType: "text", text }));
  }
  function sendReaction(emoji) {
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: "reaction", emoji }));
  }
  function sendRename() {
    if (!isHost || !ws || ws.readyState !== 1) return;
    const el = document.getElementById("partyRenameInput");
    const name = ((el && el.value) || "").trim();
    if (name.length < 3) return;
    ws.send(JSON.stringify({ type: "rename", name }));
  }
  function sendSetPublic(on) {
    if (!isHost || !ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: "set_public", public: !!on }));
  }

  function forceSync() {
    if (!isHost || !ws || ws.readyState !== 1) return;
    broadcastContent();
    broadcastClock();
    ws.send(JSON.stringify({ type: "force_sync" }));
    toast("Forced sync for guests");
  }

  function kickMember(id) {
    if (!isHost || !ws || ws.readyState !== 1 || !id) return;
    ws.send(JSON.stringify({ type: "kick", memberId: id }));
  }

  function sendPing() {
    if (!ws || ws.readyState !== 1) return;
    lastPingSentAt = Date.now();
    try {
      ws.send(JSON.stringify({ type: "ping", t: lastPingSentAt }));
    } catch (e) {}
  }

  function startPingLoop() {
    clearInterval(pingTimer);
    pingTimer = setInterval(sendPing, PING_INTERVAL_MS);
  }

  function stopPingLoop() {
    clearInterval(pingTimer);
    pingTimer = null;
  }

  function handlePong(msg) {
    const t0 = Number(msg.clientT != null ? msg.clientT : lastPingSentAt) || lastPingSentAt;
    const t3 = Date.now();
    let serverTime = Number(msg.serverTime);
    if (!isFinite(serverTime)) {
      const t = Number(msg.t);
      serverTime = t > 1e12 ? t : t * 1000;
    }
    if (!isFinite(t0) || !isFinite(serverTime)) return;
    // NTP-style: offset ≈ ((t1 - t0) + (t2 - t3)) / 2 with t1≈t2≈serverTime
    const sample = (serverTime - t0 + serverTime - t3) / 2;
    if (!isFinite(sample)) return;
    clockOffsetMs = clockOffsetMs ? clockOffsetMs * 0.7 + sample * 0.3 : sample;
  }

  function broadcastClock() {
    if (!isHost || !ws || ws.readyState !== 1) return;
    if (!shouldBroadcastClock()) return;
    if (typeof v === "undefined" || !v) return;
    const liveEdgeOffset = getLiveEdgeOffset();
    const pdt = getProgramDateTimeMs();
    const payload = {
      type: "clock",
      positionSeconds: v.currentTime || 0,
      paused: !!v.paused,
      playbackRate: v.playbackRate || 1,
      liveEdgeOffset: liveEdgeOffset,
      hasPdt: !!hasPdt,
      programDateTime: pdt,
    };
    ws.send(JSON.stringify(payload));
  }

  function broadcastContent() {
    if (!isHost || !ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: "content", content: contentPayload() }));
  }

  function startClockLoop() {
    clearInterval(clockTimer);
    clockTimer = setInterval(() => {
      if (isHost && shouldBroadcastClock()) broadcastClock();
    }, CLOCK_LOOP_MS);
  }

  function resetPlaybackRate() {
    if (typeof v === "undefined" || !v) return;
    try {
      if (Math.abs((v.playbackRate || 1) - 1) > 0.01) v.playbackRate = 1;
    } catch (e) {}
  }

  function extrapolatedHostPosition(clock) {
    const base = Number(clock.positionSeconds) || 0;
    if (clock.paused) return base;
    const updatedAt = Number(clock.updatedAt || clock.serverTime) || 0;
    if (!updatedAt) return base;
    const elapsed = Math.max(0, (serverNowMs() - updatedAt) / 1000);
    const rate = Number(clock.playbackRate) || 1;
    return base + elapsed * rate;
  }

  function applyLagClock(clock, force) {
    if (typeof v === "undefined" || !v) return;
    if (typeof hls === "undefined" || !hls) return;
    const hostOff = Number(clock.liveEdgeOffset);
    if (!isFinite(hostOff)) return;
    const myOff = getLiveEdgeOffset();
    if (myOff == null || !isFinite(myOff)) return;
    const skew = myOff - hostOff; // positive => I'm further behind live than host
    const abs = Math.abs(skew);
    if (!force && abs < 0.25) {
      resetPlaybackRate();
      return;
    }
    // Nudge via playbackRate only — never hard-seek raw live currentTime like VOD.
    try {
      if (force || abs > 1.5) {
        const rate = skew > 0 ? SOFT_RATE_FAST : SOFT_RATE_SLOW;
        v.playbackRate = rate;
        clearTimeout(softRateTimer);
        softRateTimer = setTimeout(resetPlaybackRate, 2200);
      } else if (abs > 0.35) {
        v.playbackRate = skew > 0 ? 1.01 : 0.99;
        clearTimeout(softRateTimer);
        softRateTimer = setTimeout(resetPlaybackRate, 1800);
      } else {
        resetPlaybackRate();
      }
    } catch (e) {}
  }

  function applyPdtClock(clock, force) {
    if (typeof v === "undefined" || !v) return;
    const hostPdt = Number(clock.programDateTime);
    const myPdt = getProgramDateTimeMs();
    if (!isFinite(hostPdt) || !isFinite(myPdt)) {
      if (force) toast("PDT missing — try lag or catchup");
      return;
    }
    const skewSec = (hostPdt - myPdt) / 1000;
    const abs = Math.abs(skewSec);
    if (!force && abs < DRIFT_IGNORE_S) {
      resetPlaybackRate();
      return;
    }
    // Prefer soft rate; only seek when large and seekable (catchup/VOD), not raw live.
    if ((force || abs > DRIFT_SOFT_S) && syncable() && Date.now() - lastSeekAt >= SEEK_COOLDOWN_MS) {
      try {
        v.currentTime = (v.currentTime || 0) + skewSec;
        lastSeekAt = Date.now();
        resetPlaybackRate();
      } catch (e) {}
      return;
    }
    try {
      if (abs > DRIFT_IGNORE_S) {
        v.playbackRate = skewSec > 0 ? SOFT_RATE_FAST : SOFT_RATE_SLOW;
        clearTimeout(softRateTimer);
        softRateTimer = setTimeout(resetPlaybackRate, 2000);
      }
    } catch (e) {}
  }

  function applyVodClock(clock, force) {
    if (typeof v === "undefined" || !v) return;
    const target = extrapolatedHostPosition(clock);
    const now = v.currentTime || 0;
    const skew = target - now;
    const abs = Math.abs(skew);
    const cooling = Date.now() - lastSeekAt < SEEK_COOLDOWN_MS;
    if (!force && abs < DRIFT_IGNORE_S) {
      resetPlaybackRate();
    } else if (force || (abs > DRIFT_SOFT_S && !cooling)) {
      try {
        v.currentTime = target;
        lastSeekAt = Date.now();
      } catch (e) {}
      resetPlaybackRate();
    } else if (abs >= DRIFT_IGNORE_S) {
      try {
        const rate = skew > 0 ? SOFT_RATE_FAST : SOFT_RATE_SLOW;
        v.playbackRate = rate;
        clearTimeout(softRateTimer);
        softRateTimer = setTimeout(resetPlaybackRate, 2200);
      } catch (e) {}
    } else {
      resetPlaybackRate();
    }
    // Respect sync_wait_buffering: server forces paused while peers buffer
    if (clock.paused && !v.paused) v.pause();
    if (!clock.paused && v.paused && !waitForBuffering) v.play().catch(() => {});
    else if (!clock.paused && v.paused) v.play().catch(() => {});
  }

  function applyClock(clock, force) {
    if (isHost || applyingClock || !clock) return;
    if (!guestFollowSync) return;
    applyingClock = true;
    try {
      if (syncable()) {
        applyVodClock(clock, force);
      } else if (syncLiveMode === "lag" && !catchupUrl) {
        applyLagClock(clock, force);
        if (clock.paused && v && !v.paused) v.pause();
        if (!clock.paused && v && v.paused) v.play().catch(() => {});
      } else if (syncLiveMode === "pdt") {
        if (clock.hasPdt || hasPdt) applyPdtClock(clock, force);
        else if (force) {
          toast("No PROGRAM-DATE-TIME — falling back to lag");
          applyLagClock(clock, force);
        }
        if (clock.paused && v && !v.paused) v.pause();
        if (!clock.paused && v && v.paused) v.play().catch(() => {});
      }
    } finally {
      applyingClock = false;
    }
  }

  function leaveParty(opts) {
    opts = opts || {};
    clearChatIdle();
    stopPingLoop();
    stopLanBeacon();
    try {
      if (isHost && roomCode && hostKey && window.SDPartyInvite) {
        authFetch("/party/presence/lan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: roomCode, hostKey: hostKey, visible: false }),
        }).catch(() => {});
      }
    } catch (e) {}
    try {
      if (ws) ws.send(JSON.stringify({ type: "leave" }));
      if (ws) ws.close();
    } catch (e) {}
    ws = null;
    roomCode = "";
    roomName = "";
    roomPublic = false;
    roomLocked = false;
    roomNumber = 0;
    isHost = false;
    isAdmin = false;
    roomAdmins = [];
    roomFeatures = Object.assign({}, DEFAULT_FEATURES);
    syncLiveMode = "content";
    catchupUrl = null;
    waitForBuffering = false;
    clockOffsetMs = 0;
    lastAttachedCatchup = null;
    hasPdt = false;
    lastProgramDateTime = null;
    clearInterval(clockTimer);
    clockTimer = null;
    chatMode = "text";
    chatCollapsed = false;
    lastMembers = [];
    stopAv();
    document.getElementById("partyDrawer")?.classList.remove("open", "collapsed");
    document.getElementById("partyFab")?.classList.remove("show");
    document.getElementById("partyLiveBadge")?.classList.remove("show");
    setChatClasses(false, false);
    const wrap = document.getElementById("sdPartyCreated");
    if (wrap) wrap.hidden = true;
    saveLastPlace({ partyCode: null });
    syncFeaturesUi();
    if (!opts.silent) closePartyModal();
  }

  function ensureRemoteListener() {
    if (remoteBound) return;
    remoteBound = true;
  }

  function bindBuffering() {
    if (bufferingBound || typeof v === "undefined" || !v) return;
    bufferingBound = true;
    const sendBuff = (on) => {
      if (!ws || ws.readyState !== 1) return;
      ws.send(JSON.stringify({ type: "buffering", buffering: !!on }));
    };
    v.addEventListener("waiting", () => sendBuff(true));
    v.addEventListener("stalled", () => sendBuff(true));
    v.addEventListener("playing", () => sendBuff(false));
    v.addEventListener("canplay", () => sendBuff(false));
  }

  function handleRemote(cmd) {
    cmd = String(cmd || "").toLowerCase();
    if (cmd === "playpause") {
      if (v.paused) v.play().catch(() => {});
      else v.pause();
    } else if (cmd === "mute") {
      v.muted = !v.muted;
    } else if (cmd === "up" || cmd === "left") {
      try {
        if (typeof changeChannel === "function") changeChannel(-1);
        else if (typeof stepChannel === "function") stepChannel(-1);
        else if (typeof navigateChannel === "function") navigateChannel(-1);
        else document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
      } catch (e) {}
    } else if (cmd === "down" || cmd === "right") {
      try {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
      } catch (e) {}
    } else if (cmd === "next") {
      const n = document.getElementById("vodEpNext");
      if (n) n.click();
    } else if (cmd === "prev") {
      const p = document.getElementById("vodEpPrev");
      if (p) p.click();
    } else if (cmd === "guide") {
      const g = document.getElementById("guideToggle");
      if (g) g.click();
    } else if (cmd === "ok" || cmd === "info") {
      if (cmd === "info" && typeof openXray === "function") openXray();
    }
  }

  function onHlsStarted(ctx) {
    ensureUi();
    refreshPdtState(
      (typeof currentStreamUrl !== "undefined" && currentStreamUrl) || catchupUrl || ""
    ).then(() => {
      if (syncLiveMode === "pdt" && !hasPdt && isHost) {
        toast("No PDT tags — lag/catchup recommended");
      }
    });
    if (catchupUrl && syncLiveMode === "catchup" && !playingCatchupUrl(catchupUrl)) {
      ensureCatchupPlayback(catchupUrl);
    }
    if (ws && ws.readyState === 1 && isHost) {
      broadcastContent();
      broadcastClock();
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  try {
    const params = new URLSearchParams(location.search);
    let code = (params.get("party") || "").toUpperCase();
    let name = params.get("name");
    try {
      if (!code) code = (sessionStorage.getItem("sd_party_pending") || "").toUpperCase();
      if (!name) name = sessionStorage.getItem("sd_party_name_pending") || "";
    } catch (e) {}
    if (name) {
      try {
        localStorage.setItem("sd_party_name", name);
      } catch (e) {}
    }
    if (code) {
      const tryJoin = (attempt) => {
        joinParty(code, { retries: 1 })
          .then(() => {
            try {
              sessionStorage.removeItem("sd_party_pending");
              sessionStorage.removeItem("sd_party_name_pending");
            } catch (e) {}
          })
          .catch((e) => {
            const err = String((e && e.message) || e || "");
            if (
              attempt < 5 &&
              err !== "bad_password" &&
              err !== "not_found" &&
              err !== "auth_required" &&
              err !== "full"
            ) {
              setTimeout(() => tryJoin(attempt + 1), 900 + attempt * 400);
            } else {
              try {
                sessionStorage.removeItem("sd_party_pending");
                sessionStorage.removeItem("sd_party_name_pending");
              } catch (err2) {}
            }
          });
      };
      setTimeout(() => tryJoin(1), 900);
    } else if (params.get("party_create") === "1") {
      setTimeout(() => {
        try {
          openPanel();
        } catch (e) {}
      }, 1100);
    }
  } catch (e) {}

  /* —— Party home: delegated to player_party_home.js (SDPartyHome) —— */
  function openPartyHome(opts) {
    if (window.SDPartyHome && typeof SDPartyHome.open === "function") {
      return SDPartyHome.open(opts || {});
    }
    // Fallback until home module loads: push /party so home boot can open.
    try {
      const path = location.pathname.replace(/\/$/, "") || "/";
      if (path !== "/party" && path !== "/party/home") {
        history.pushState({ sdPartyHome: 1 }, "", "/party");
      }
    } catch (e) {}
    setTimeout(() => {
      try {
        if (window.SDPartyHome && typeof SDPartyHome.open === "function") {
          SDPartyHome.open(Object.assign({ replace: true }, opts || {}));
        }
      } catch (err) {}
    }, 0);
  }

  function closePartyHome(silent) {
    if (window.SDPartyHome && typeof SDPartyHome.close === "function") {
      return SDPartyHome.close(silent);
    }
  }

  function partyHomeRoomCard(room, opts) {
    if (window.SDPartyHome && typeof SDPartyHome.roomCard === "function") {
      return SDPartyHome.roomCard(room, opts);
    }
    return "";
  }

  function addHeaderShare() {
    const chrome = document.getElementById("collapsedChrome") || document.querySelector(".video-area");
    if (!chrome || document.getElementById("liveShareBtn")) return;
    const wrap = document.createElement("div");
    wrap.className = "guide-more-wrap live-more-wrap";
    wrap.style.cssText = "position:absolute;right:52px;top:max(8px,env(safe-area-inset-top,8px));pointer-events:auto;z-index:10";
    const b = document.createElement("button");
    b.type = "button";
    b.id = "liveShareBtn";
    b.className = "btn-search-chrome";
    b.title = "More";
    b.setAttribute("aria-label", "More actions");
    b.setAttribute("aria-haspopup", "menu");
    b.setAttribute("aria-expanded", "false");
    b.textContent = "⋯";
    const menu = document.createElement("div");
    menu.id = "liveMoreMenu";
    menu.className = "guide-more-menu";
    menu.hidden = true;
    menu.setAttribute("role", "menu");
    menu.innerHTML =
      '<button type="button" role="menuitem" data-live-action="share">Invite / share</button>' +
      '<button type="button" role="menuitem" data-live-action="guide">Show guide</button>' +
      '<button type="button" role="menuitem" data-live-action="settings">Settings</button>' +
      '<button type="button" role="menuitem" data-live-action="party">Watch Party</button>' +
      '<button type="button" role="menuitem" data-live-action="simple">Simple player</button>' +
      '<button type="button" role="menuitem" data-live-action="report">Report</button>';
    function closeMenu() {
      menu.hidden = true;
      b.setAttribute("aria-expanded", "false");
      if (menu.parentElement !== wrap) wrap.appendChild(menu);
    }
    function positionLiveMoreMenu() {
      if (typeof window.SDPositionGuideMoreMenu === "function") {
        window.SDPositionGuideMoreMenu(menu, b);
        return;
      }
      if (menu.parentElement !== document.body) document.body.appendChild(menu);
      const gap = 6;
      const pad = 8;
      const br = b.getBoundingClientRect();
      const vw = window.innerWidth || 0;
      const vh = window.innerHeight || 0;
      const spaceBelow = Math.max(0, vh - br.bottom - gap - pad);
      const spaceAbove = Math.max(0, br.top - gap - pad);
      const preferBelow = spaceBelow >= spaceAbove;
      const avail = Math.max(120, preferBelow ? spaceBelow : spaceAbove);
      menu.style.position = "fixed";
      menu.style.zIndex = "120";
      menu.style.right = "auto";
      menu.style.bottom = "auto";
      menu.style.maxHeight = Math.min(520, avail) + "px";
      const mw = Math.max(menu.offsetWidth || 188, 188);
      const mh = Math.min(menu.scrollHeight || 220, Math.min(520, avail));
      let left = Math.max(pad, Math.min(br.right - mw, vw - mw - pad));
      let top = preferBelow ? br.bottom + gap : br.top - gap - mh;
      if (top < pad) top = pad;
      if (top + mh > vh - pad) top = Math.max(pad, vh - mh - pad);
      menu.style.left = Math.round(left) + "px";
      menu.style.top = Math.round(top) + "px";
      menu.style.maxHeight = Math.round(mh) + "px";
    }
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = menu.hidden;
      menu.hidden = !open;
      b.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) positionLiveMoreMenu();
    });
    menu.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-live-action]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const action = btn.getAttribute("data-live-action");
      closeMenu();
      if (action === "share") {
        if (roomCode) openInvite();
        else openShare({ forceContent: true });
      }
      else if (action === "guide") {
        try {
          const show = document.getElementById("showGuideBtn");
          if (show) show.click();
        } catch (err) {}
      } else if (action === "settings") {
        try {
          const s = document.getElementById("settingsBtn");
          if (s) s.click();
        } catch (err) {}
      } else if (action === "party") {
        try { openPartyHome(); } catch (err) {}
      } else if (action === "simple") {
        const a = document.getElementById("simpleLink");
        if (a && a.href) location.href = a.href;
      } else if (action === "report") {
        try { if (window.SDReport && SDReport.open) SDReport.open(); } catch (err) {}
      }
    });
    document.addEventListener("click", (e) => {
      if (!menu.hidden && !e.target.closest("#liveShareBtn, #liveMoreMenu")) closeMenu();
    });
    window.addEventListener("resize", () => {
      if (!menu.hidden) positionLiveMoreMenu();
    });
    wrap.appendChild(b);
    wrap.appendChild(menu);
    chrome.appendChild(wrap);
  }

  ensureUi();
  addHeaderShare();
  wireLayoutPartyChrome();
  try {
    window.addEventListener("resize", syncPartyLayout);
    window.addEventListener("orientationchange", () => setTimeout(syncPartyLayout, 80));
  } catch (e) {}
  scheduleLayoutPartyChrome();

  window.SDParty = {
    openShare,
    openInvite,
    openPanel,
    openHome: openPartyHome,
    closeHome: closePartyHome,
    broadcastClock,
    broadcastContent,
    onHlsStarted,
    createParty,
    joinParty,
    leaveParty,
    forceSync,
    applyContent,
    ensureUi,
    layoutPartyChrome,
    getInviteState,
    _authFetch: typeof authFetch === "function" ? authFetch : null,
    _partyHomeRoomCard: partyHomeRoomCard,
    _toast: toast,
    _onAvHangup: () => {
      chatMode = "text";
      syncModeUi();
    },
    _onAvProviderChange: () => {
      if (chatMode !== "text") startAv(chatMode);
    },
  };
})();
