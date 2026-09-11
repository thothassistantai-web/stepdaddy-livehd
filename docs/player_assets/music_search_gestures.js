/**
 * Music search results gestures — swipe-down dismiss + infinite scroll.
 * Used by music_search.js Mount.
 */
(function () {
  if (window.SDMusicSearchGestures) return;

  function wireInfiniteScroll(results, opts) {
    opts = opts || {};
    if (!results || results.dataset.msInfiniteWired) return;
    results.dataset.msInfiniteWired = "1";
    results.addEventListener(
      "scroll",
      function () {
        if (typeof opts.shouldLoad !== "function" || !opts.shouldLoad()) return;
        if (typeof opts.loadMore !== "function") return;
        var remain = results.scrollHeight - results.scrollTop - results.clientHeight;
        if (remain < 120) opts.loadMore();
      },
      { passive: true }
    );
  }

  function wireSwipeDismiss(results, opts) {
    opts = opts || {};
    if (!results || results.dataset.msSwipeWired) return;
    results.dataset.msSwipeWired = "1";
    var startY = 0;
    var startX = 0;
    var pulling = false;
    var axis = null;
    var pull = 0;

    function resetPull() {
      pulling = false;
      axis = null;
      pull = 0;
      results.classList.remove("ms-pulling");
      results.style.transform = "";
      results.style.transition = "";
    }

    function isOpen() {
      return typeof opts.isOpen === "function" ? !!opts.isOpen() : !results.hidden;
    }

    results.addEventListener(
      "touchstart",
      function (e) {
        if (!isOpen() || !e.touches || !e.touches[0]) return;
        if (results.scrollTop > 2) {
          pulling = false;
          return;
        }
        startY = e.touches[0].clientY;
        startX = e.touches[0].clientX;
        pulling = true;
        axis = null;
        pull = 0;
        results.style.transition = "none";
      },
      { passive: true }
    );

    results.addEventListener(
      "touchmove",
      function (e) {
        if (!pulling || !e.touches || !e.touches[0]) return;
        var dy = e.touches[0].clientY - startY;
        var dx = e.touches[0].clientX - startX;
        if (!axis) {
          if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
          axis = Math.abs(dy) > Math.abs(dx) * 1.15 ? "y" : "x";
        }
        if (axis !== "y") {
          pulling = false;
          return;
        }
        if (results.scrollTop > 2 || dy < 0) {
          if (pull > 0) resetPull();
          return;
        }
        pull = Math.min(140, dy);
        results.classList.add("ms-pulling");
        results.style.transform = "translateY(" + pull + "px)";
        if (e.cancelable && pull > 12) e.preventDefault();
      },
      { passive: false }
    );

    function endPull() {
      if (!pulling) return;
      var dist = pull;
      results.style.transition = "transform 0.22s ease";
      if (dist > 72) {
        results.style.transform = "translateY(110%)";
        setTimeout(function () {
          resetPull();
          if (typeof opts.onDismiss === "function") opts.onDismiss();
        }, 180);
      } else {
        results.style.transform = "translateY(0)";
        setTimeout(resetPull, 220);
      }
    }

    results.addEventListener("touchend", endPull, { passive: true });
    results.addEventListener("touchcancel", resetPull, { passive: true });
  }

  window.SDMusicSearchGestures = {
    wireInfiniteScroll: wireInfiniteScroll,
    wireSwipeDismiss: wireSwipeDismiss,
  };
})();
