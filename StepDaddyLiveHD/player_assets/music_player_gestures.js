/**
 * StepDaddy Music — gesture/hint polish for unified queue (optional patch).
 * Core gestures live in music_player.js; this keeps swipe hint + context label in sync.
 */
(function () {
  function syncHints(inst) {
    if (!inst || !inst.root) return;
    var swipeHint = inst.root.querySelector("[data-smp-swipe-hint]");
    var isRadio = inst.state && inst.state.source === "radio";
    if (swipeHint) {
      swipeHint.hidden = false;
      swipeHint.textContent = isRadio
        ? "Swipe art to retune · swipe down to collapse"
        : "Swipe art for next · swipe down to collapse";
    }
    var ctx = inst.root.querySelector("[data-smp-context-label]");
    if (ctx && !isRadio) {
      var UQ = window.SDMusicUnifiedQueue;
      var tl = UQ && UQ.getTimeline && UQ.getTimeline();
      if (tl && tl.layer === "autoplay") ctx.textContent = "Autoplay";
      else if (tl && tl.layer === "manual") ctx.textContent = "Play Next";
      else if (tl && tl.source && tl.source.title) ctx.textContent = "Playing from " + tl.source.title;
      else if (inst.state.albumTitle) ctx.textContent = "Playing from album";
      else ctx.textContent = "Playing from Listen";
    }
  }

  function hook() {
    var api = window.StepDaddyMusicPlayer;
    if (!api || api.__unifiedHintHook) return;
    api.__unifiedHintHook = true;
    var _ensure = api.ensure.bind(api);
    api.ensure = function (host) {
      var inst = _ensure(host);
      syncHints(inst);
      return inst;
    };
    var _play = api.play && api.play.bind(api);
    if (_play) {
      api.play = function (payload) {
        var r = _play(payload);
        if (api._instance) syncHints(api._instance);
        return r;
      };
    }
  }

  if (window.StepDaddyMusicPlayer) hook();
  else {
    var n = 0;
    var t = setInterval(function () {
      n++;
      if (window.StepDaddyMusicPlayer) {
        clearInterval(t);
        hook();
      } else if (n > 80) clearInterval(t);
    }, 50);
  }
})();
