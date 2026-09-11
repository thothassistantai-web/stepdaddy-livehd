/**
 * Horizontal shelf axis-lock: vertical drag scrolls parent; horizontal pans shelf.
 * Use with touch-action:none on the shelf (CSS).
 * preventDefault only after axis lock; rAF + light inertia so shelves glide.
 */
(function () {
  if (window.SDShelfAxisLock) return;

  var LOCK_PX = 16;
  var SHELF_SEL = ".ml-scroll, .mr-scroll, .mh-scroll";

  function findVerticalParent(el) {
    var n = el && el.parentElement;
    while (n && n !== document.body) {
      var oy = window.getComputedStyle(n).overflowY;
      if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 2) {
        return n;
      }
      n = n.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  function wire(shelf, verticalParent) {
    if (!shelf || shelf.__sdAxisLock) return;
    shelf.__sdAxisLock = true;
    var parent = verticalParent || findVerticalParent(shelf);
    var axis = null;
    var sx = 0;
    var sy = 0;
    var startLeft = 0;
    var startTop = 0;
    var active = false;
    var suppressedClick = false;
    var lastX = 0;
    var lastY = 0;
    var lastT = 0;
    var vx = 0;
    var vy = 0;
    var pendingX = null;
    var pendingY = null;
    var raf = 0;
    var coastRaf = 0;

    function pt(e) {
      if (e.touches && e.touches.length) return e.touches[0];
      if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0];
      return e;
    }

    function cancelCoast() {
      if (coastRaf) {
        cancelAnimationFrame(coastRaf);
        coastRaf = 0;
      }
    }

    function flush() {
      raf = 0;
      if (pendingX != null) {
        shelf.scrollLeft = pendingX;
        pendingX = null;
      }
      if (pendingY != null && parent) {
        parent.scrollTop = pendingY;
        pendingY = null;
      }
    }

    function schedule() {
      if (!raf) raf = requestAnimationFrame(flush);
    }

    function coast(axisLocked, vel) {
      cancelCoast();
      var v = vel;
      var friction = 0.95;
      var min = 0.18;
      function step() {
        v *= friction;
        if (Math.abs(v) < min) {
          coastRaf = 0;
          return;
        }
        if (axisLocked === "x") {
          shelf.scrollLeft -= v;
          var maxL = shelf.scrollWidth - shelf.clientWidth;
          if (shelf.scrollLeft <= 0 || shelf.scrollLeft >= maxL) {
            coastRaf = 0;
            return;
          }
        } else if (axisLocked === "y" && parent) {
          parent.scrollTop -= v;
          var maxT = parent.scrollHeight - parent.clientHeight;
          if (parent.scrollTop <= 0 || parent.scrollTop >= maxT) {
            coastRaf = 0;
            return;
          }
        }
        coastRaf = requestAnimationFrame(step);
      }
      coastRaf = requestAnimationFrame(step);
    }

    function onStart(e) {
      if (e.touches && e.touches.length !== 1) return;
      var t = pt(e);
      if (!t) return;
      cancelCoast();
      active = true;
      axis = null;
      suppressedClick = false;
      sx = t.clientX;
      sy = t.clientY;
      lastX = sx;
      lastY = sy;
      lastT = e.timeStamp || Date.now();
      vx = 0;
      vy = 0;
      startLeft = shelf.scrollLeft;
      startTop = parent ? parent.scrollTop : 0;
    }

    function onMove(e) {
      if (!active) return;
      var t = pt(e);
      if (!t) return;
      var dx = t.clientX - sx;
      var dy = t.clientY - sy;
      var now = e.timeStamp || Date.now();
      var dt = Math.max(8, now - lastT);
      vx = (t.clientX - lastX) / dt;
      vy = (t.clientY - lastY) / dt;
      lastX = t.clientX;
      lastY = t.clientY;
      lastT = now;

      if (axis == null) {
        if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
      // Only block native scrolling after axis lock — keeps early moves passive-friendly.
      if (axis === "y") {
        if (e.cancelable) e.preventDefault();
        suppressedClick = true;
        pendingY = startTop - dy;
        pendingX = null;
        schedule();
      } else if (axis === "x") {
        if (e.cancelable) e.preventDefault();
        suppressedClick = true;
        pendingX = startLeft - dx;
        pendingY = null;
        schedule();
      }
    }

    function onEnd(e) {
      var t = pt(e);
      var dist = t ? Math.hypot(t.clientX - sx, t.clientY - sy) : 99;
      if (raf) {
        cancelAnimationFrame(raf);
        flush();
      }
      // Glide after release (px/ms → ~16ms frame scale).
      if (axis === "x" && Math.abs(vx) > 0.05) coast("x", vx * 16);
      else if (axis === "y" && Math.abs(vy) > 0.05) coast("y", vy * 16);

      // Mobile: preventDefault on slight finger jitter cancels the click — re-fire taps.
      if (active && suppressedClick && dist < 22) {
        var el = document.elementFromPoint(sx, sy);
        var hit =
          el &&
          el.closest(
            "[role='button'], button, a, .ml-card, .mh-card, .ml-featured-card, .ml-track, .mr-station, .ms-chip, .mh-seg-btn"
          );
        if (hit && !el.closest("[data-ml-add], [data-ml-more], .sd-ml-add")) {
          try {
            hit.click();
          } catch (err) {}
        }
      }
      active = false;
      axis = null;
      suppressedClick = false;
    }

    shelf.addEventListener("touchstart", onStart, { passive: true });
    shelf.addEventListener("touchmove", onMove, { passive: false });
    shelf.addEventListener("touchend", onEnd, { passive: true });
    shelf.addEventListener("touchcancel", onEnd, { passive: true });
  }

  function wireAll(root, shelfSel, verticalSel) {
    if (!root) return;
    var parent = verticalSel ? root.querySelector(verticalSel) : null;
    root.querySelectorAll(shelfSel || SHELF_SEL).forEach(function (el) {
      wire(el, parent || findVerticalParent(el));
    });
  }

  window.SDShelfAxisLock = { wire: wire, wireAll: wireAll, findVerticalParent: findVerticalParent };
})();
