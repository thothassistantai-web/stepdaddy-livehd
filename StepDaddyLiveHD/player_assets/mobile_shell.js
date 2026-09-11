/* Mobile / S25 Edge Chrome: app-like fullscreen + landscape on playback */
(function () {
  if (window.__sdMobileShell) return;
  window.__sdMobileShell = true;

  const style = document.createElement("style");
  style.textContent =
    "html,body{height:100%;height:100dvh;overscroll-behavior:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation}" +
    ".tv-root,.wrap{min-height:100dvh;min-height:100svh}" +
    "@media (display-mode: standalone),(display-mode: fullscreen){" +
    "  body{user-select:none;-webkit-user-select:none}" +
    "}" +
    "body.sd-immersive{overflow:hidden;background:#000}" +
    "body.sd-immersive .tv-root{height:100dvh;height:100svh}" +
    "body.sd-fs .epg-panel,body.sd-fs .show-guide-btn,body.sd-fs #collapsedChrome{" +
    "  opacity:0!important;pointer-events:none!important}" +
    "#sdInstallHint{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));" +
    "z-index:99998;padding:12px 14px;border-radius:14px;background:rgba(12,14,20,.94);" +
    "border:1px solid rgba(255,255,255,.12);color:#e5e7eb;font:600 13px system-ui,sans-serif;" +
    "display:none;gap:10px;align-items:center;box-sizing:border-box}" +
    "#sdInstallHint.show{display:flex}" +
    "#sdInstallHint button{margin-left:auto;border:0;border-radius:10px;padding:8px 12px;" +
    "background:#2563eb;color:#fff;font-weight:700;cursor:pointer;min-height:44px;touch-action:manipulation}" +
    "#sdInstallHint #sdInstallDismiss{flex:0 0 auto;margin-left:6px;min-width:44px;background:#333}" +
    "body.sd-install-visible .epg-panel,body.sd-guest-banner-visible .epg-panel{padding-bottom:calc(76px + env(safe-area-inset-bottom,0px))}" +
    "body.sd-install-visible .show-guide-btn{bottom:calc(88px + env(safe-area-inset-bottom,0px))}" +
    ".party-fab,.party-icon-btn,.show-guide-btn,#partyHomeBtn,#vodCatalogBtn,#musicCatalogBtn,#searchBtn,#settingsBtn,#castBtn,#guideMoreBtn{touch-action:manipulation;min-width:44px;min-height:44px}" +
    "@media (orientation: portrait) and (max-width: 900px){" +
    "  body.sd-playing-vod .video-area{min-height:56vw}" +
    "}";
  document.head.appendChild(style);

  function isMobile() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "") ||
      (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);
  }

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
  }

  async function lockLandscape() {
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock("landscape");
      }
    } catch (e) {}
  }

  async function unlockOrientation() {
    try {
      if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
    } catch (e) {}
  }

  async function enterImmersive(target) {
    document.body.classList.add("sd-immersive", "sd-fs", "sd-playing-vod");
    const el = target || document.documentElement;
    try {
      if (!document.fullscreenElement && el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: "hide" });
      }
    } catch (e) {
      try {
        const v = document.getElementById("v");
        if (v && v.webkitEnterFullscreen) v.webkitEnterFullscreen();
      } catch (e2) {}
    }
    await lockLandscape();
    // Nudge Chrome address bar away
    try {
      window.scrollTo(0, 1);
    } catch (e) {}
  }

  async function exitImmersive() {
    document.body.classList.remove("sd-immersive", "sd-fs", "sd-playing-vod");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch (e) {}
    await unlockOrientation();
  }

  window.SDMobile = {
    isMobile,
    isStandalone,
    enterImmersive,
    exitImmersive,
    lockLandscape,
  };

  // Install / Add to Home Screen hint (Chrome Android)
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (isStandalone() || sessionStorage.getItem("sd_hide_install") === "1") return;
    let hint = document.getElementById("sdInstallHint");
    if (!hint) {
      hint = document.createElement("div");
      hint.id = "sdInstallHint";
      hint.innerHTML =
        "<span>Install StepDaddy for fullscreen app mode (hides Chrome bars)</span>" +
        '<button type="button" id="sdInstallBtn">Install</button>' +
        '<button type="button" id="sdInstallDismiss" style="background:#333;margin-left:6px">✕</button>';
      document.body.appendChild(hint);
      document.getElementById("sdInstallBtn").onclick = async () => {
        hint.classList.remove("show");
        document.body.classList.remove("sd-install-visible");
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
      };
      document.getElementById("sdInstallDismiss").onclick = () => {
        sessionStorage.setItem("sd_hide_install", "1");
        hint.classList.remove("show");
        document.body.classList.remove("sd-install-visible");
      };
    }
    hint.classList.add("show");
    document.body.classList.add("sd-install-visible");
  });

  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
      document.body.classList.remove("sd-fs");
      unlockOrientation();
    } else {
      lockLandscape();
    }
  });

  // Auto-enter immersive when VOD overlay / HLS starts (mobile only)
  if (isMobile()) {
    const obs = new MutationObserver(() => {
      const root = document.getElementById("tvRoot");
      if (!root) return;
      const playing = root.classList.contains("overlay-active") || root.classList.contains("vod-hls-playing");
      if (playing && !document.body.classList.contains("sd-immersive")) {
        enterImmersive(document.getElementById("videoArea") || document.documentElement);
      } else if (!playing && document.body.classList.contains("sd-immersive") && !document.fullscreenElement) {
        document.body.classList.remove("sd-immersive", "sd-playing-vod");
      }
    });
    const boot = () => {
      const root = document.getElementById("tvRoot");
      if (root) obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})();
