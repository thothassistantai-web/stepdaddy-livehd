/* Site-wide pull-down + hold to reload. Self-contained (injects CSS). */
(function () {
  if (window.__sdPullReload) return;
  window.__sdPullReload = true;

  const THRESHOLD = 72;
  const HOLD_MS = 700;
  const EDGE_PX = 96;

  const style = document.createElement("style");
  style.textContent =
    "#sdPullReload{position:fixed;left:50%;top:calc(10px + env(safe-area-inset-top,0px));" +
    "transform:translate(-50%,-120%);z-index:99999;pointer-events:none;" +
    "min-width:160px;padding:10px 16px;border-radius:999px;" +
    "background:rgba(12,14,20,.92);border:1px solid rgba(255,255,255,.14);" +
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
    "transition:width " + HOLD_MS + "ms linear}";
  document.head.appendChild(style);

  const el = document.createElement("div");
  el.id = "sdPullReload";
  el.innerHTML = '<span class="lbl">Pull to reload</span><span class="bar" aria-hidden="true"><i></i></span>';
  document.documentElement.appendChild(el);
  const lbl = el.querySelector(".lbl");
  const fill = el.querySelector(".bar > i");

  let tracking = false;
  let startY = 0;
  let startX = 0;
  let pull = 0;
  let holdTimer = null;
  let armed = false;
  let reloading = false;

  function scrollAtTop() {
    if ((window.scrollY || document.documentElement.scrollTop || 0) > 2) return false;
    const nodes = document.querySelectorAll(
      ".vod-catalog-body,.vod-detail-scroll,.epg-panel,.grid-scroll,#gridScroll,.xray-scroll,.settings-body,.vod-picker-body,.party-drawer .chat"
    );
    for (const n of nodes) {
      try {
        if (n.scrollTop > 2) return false;
      } catch (e) {}
    }
    return true;
  }

  function reset() {
    tracking = false;
    pull = 0;
    armed = false;
    clearTimeout(holdTimer);
    holdTimer = null;
    el.classList.remove("show", "armed", "holding");
    if (fill) fill.style.width = "0%";
    if (lbl) lbl.textContent = "Pull to reload";
  }

  function doReload() {
    if (reloading) return;
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
    holdTimer = setTimeout(doReload, HOLD_MS);
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

  function onStart(y, x, fromEdge) {
    if (reloading) return;
    if (!scrollAtTop() && !fromEdge) return;
    tracking = true;
    startY = y;
    startX = x;
    pull = 0;
    armed = false;
  }

  function onMove(y, x) {
    if (!tracking || reloading) return;
    const dy = y - startY;
    const dx = x - startX;
    if (Math.abs(dx) > Math.abs(dy) + 8 && dy < THRESHOLD / 2) {
      reset();
      return;
    }
    if (dy < 0) {
      reset();
      return;
    }
    pull = dy;
    const pct = Math.min(100, (pull / THRESHOLD) * 100);
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
    if (pull < THRESHOLD) reset();
    else {
      // Released before hold completed
      cancelHold();
      reset();
    }
  }

  document.addEventListener(
    "touchstart",
    (e) => {
      if (!e.touches || !e.touches.length) return;
      const t = e.touches[0];
      const fromEdge = t.clientY <= EDGE_PX;
      if (!scrollAtTop() && !fromEdge) return;
      onStart(t.clientY, t.clientX, fromEdge);
    },
    { passive: true }
  );
  document.addEventListener(
    "touchmove",
    (e) => {
      if (!tracking || !e.touches || !e.touches.length) return;
      const t = e.touches[0];
      onMove(t.clientY, t.clientX);
    },
    { passive: true }
  );
  document.addEventListener("touchend", onEnd, { passive: true });
  document.addEventListener("touchcancel", onEnd, { passive: true });

  // Desktop: drag from top edge with mouse
  let mouseDown = false;
  document.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    if (e.clientY > EDGE_PX && !scrollAtTop()) return;
    mouseDown = true;
    onStart(e.clientY, e.clientX, e.clientY <= EDGE_PX);
  });
  document.addEventListener("mousemove", (e) => {
    if (!mouseDown) return;
    onMove(e.clientY, e.clientX);
  });
  document.addEventListener("mouseup", () => {
    if (!mouseDown) return;
    mouseDown = false;
    onEnd();
  });
})();
