/* Inline household PIN unlock — stay on current page (no /auth redirect). */
(function () {
  "use strict";
  if (window.SDPinUnlock) return;

  var LS_DEVICE = "sd_auth_device_id";
  var LS_PIN_LEN = "sd_auth_last_pin_len";
  var LS_REMEMBER = "sd_auth_remember";
  var LS_TTL = "sd_auth_ttl";
  var MAX_LEN = 8;
  var pin = "";
  var submitting = false;
  var autoTimer = null;
  var open = false;
  var onSuccessCbs = [];

  function lsGet(k, fallback) {
    try {
      var v = localStorage.getItem(k);
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }
  function lsSet(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {}
  }

  function deviceId() {
    var id = lsGet(LS_DEVICE, "");
    if (id) return id;
    try {
      id = "d_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    } catch (e) {
      id = "d_" + String(Date.now());
    }
    lsSet(LS_DEVICE, id);
    return id;
  }

  function ensureDom() {
    var existing = document.getElementById("sdPinUnlock");
    if (existing) return existing;
    var root = document.createElement("div");
    root.id = "sdPinUnlock";
    root.className = "sd-pin-unlock";
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    root.innerHTML =
      '<div class="sd-pin-unlock-backdrop" data-pin-dismiss="1"></div>' +
      '<div class="sd-pin-unlock-sheet" role="dialog" aria-modal="true" aria-labelledby="sdPinUnlockTitle">' +
      '<div class="sd-pin-unlock-head">' +
      '<h2 id="sdPinUnlockTitle">Enter household PIN</h2>' +
      '<button type="button" class="sd-pin-unlock-x" data-pin-dismiss="1" aria-label="Close">✕</button>' +
      "</div>" +
      '<p class="sd-pin-unlock-sub" id="sdPinUnlockSub">Unlock this device without leaving the page.</p>' +
      '<div class="sd-pin-unlock-display" id="sdPinUnlockDisplay">6-digit PIN (4–8 OK)</div>' +
      '<div class="sd-pin-unlock-dots" id="sdPinUnlockDots" aria-hidden="true"></div>' +
      '<div class="sd-pin-unlock-err" id="sdPinUnlockErr" role="status" aria-live="polite"></div>' +
      '<div class="sd-pin-unlock-pad" id="sdPinUnlockPad">' +
      [1, 2, 3, 4, 5, 6, 7, 8, 9, "clear", 0, "back"]
        .map(function (k) {
          if (k === "clear")
            return '<button type="button" class="sd-pin-key wide" data-pin-act="clear">Clear</button>';
          if (k === "back")
            return '<button type="button" class="sd-pin-key wide" data-pin-act="back">⌫</button>';
          return (
            '<button type="button" class="sd-pin-key" data-pin-digit="' +
            k +
            '">' +
            k +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      '<div class="sd-pin-unlock-actions">' +
      '<button type="button" class="sd-pin-unlock-submit" id="sdPinUnlockSubmit" disabled>Unlock</button>' +
      '<a class="sd-pin-unlock-full" id="sdPinUnlockFullAuth" href="/auth">Full login page</a>' +
      "</div>" +
      "</div>";
    document.body.appendChild(root);

    root.addEventListener("click", function (e) {
      var t = e.target;
      if (!t) return;
      if (t.closest && t.closest("[data-pin-dismiss]")) {
        e.preventDefault();
        close();
        return;
      }
      var digitBtn = t.closest && t.closest("[data-pin-digit]");
      if (digitBtn) {
        e.preventDefault();
        pushDigit(digitBtn.getAttribute("data-pin-digit"));
        return;
      }
      var actBtn = t.closest && t.closest("[data-pin-act]");
      if (actBtn) {
        e.preventDefault();
        var act = actBtn.getAttribute("data-pin-act");
        if (act === "clear") {
          pin = "";
          setErr("");
          render();
        } else if (act === "back") {
          pin = pin.slice(0, -1);
          setErr("");
          render();
        }
      }
    });
    var submit = document.getElementById("sdPinUnlockSubmit");
    if (submit) submit.addEventListener("click", function (e) {
      e.preventDefault();
      submitPin();
    });
    document.addEventListener("keydown", onKeydown);
    return root;
  }

  function slotCount() {
    var last = parseInt(lsGet(LS_PIN_LEN, "6"), 10);
    return Math.min(MAX_LEN, Math.max(4, isNaN(last) ? 6 : last));
  }

  function setErr(msg) {
    var el = document.getElementById("sdPinUnlockErr");
    if (el) el.textContent = msg || "";
  }

  function render() {
    var display = document.getElementById("sdPinUnlockDisplay");
    var dots = document.getElementById("sdPinUnlockDots");
    var submit = document.getElementById("sdPinUnlockSubmit");
    if (display) {
      display.textContent = pin
        ? pin.length + " / " + slotCount() + " digits"
        : "6-digit PIN (4–8 OK)";
    }
    if (dots) {
      var n = Math.max(slotCount(), pin.length || 6);
      var html = "";
      for (var i = 0; i < n; i++) {
        html += '<span class="dot' + (i < pin.length ? " filled" : "") + '"></span>';
      }
      dots.innerHTML = html;
    }
    if (submit) submit.disabled = !pin || submitting;
  }

  function scheduleAuto() {
    clearTimeout(autoTimer);
    if (!pin) return;
    var last = parseInt(lsGet(LS_PIN_LEN, "6"), 10) || 6;
    if (pin.length !== last && pin.length < 6) return;
    autoTimer = setTimeout(function () {
      submitPin();
    }, 280);
  }

  function pushDigit(d) {
    if (submitting || pin.length >= MAX_LEN) return;
    d = String(d || "");
    if (!/^\d$/.test(d)) return;
    pin += d;
    setErr("");
    render();
    scheduleAuto();
  }

  function onKeydown(e) {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      submitPin();
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      pin = pin.slice(0, -1);
      setErr("");
      render();
      return;
    }
    if (/^\d$/.test(e.key)) {
      e.preventDefault();
      pushDigit(e.key);
    }
  }

  async function submitPin() {
    if (submitting || !pin) {
      if (!pin) setErr("Enter a PIN");
      return;
    }
    submitting = true;
    clearTimeout(autoTimer);
    render();
    setErr("");
    var root = ensureDom();
    root.classList.add("loading");
    var remember = lsGet(LS_REMEMBER, "1") !== "0";
    var ttl = remember ? lsGet(LS_TTL, "30d") : "session";
    var nextPath = location.pathname + location.search || "/tv";
    try {
      var r = await fetch("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          pin: pin,
          device_id: deviceId(),
          next: nextPath,
          remember: remember,
          ttl: ttl,
          device_name: (lsGet("sd_auth_device_nick", "") || "").slice(0, 32),
        }),
      });
      var data = {};
      try {
        data = await r.json();
      } catch (e) {}
      if (r.ok && data && data.ok) {
        lsSet(LS_PIN_LEN, String(pin.length));
        pin = "";
        render();
        close();
        // Auth disabled on gateway: unlock UI was a false prompt (CDN 401). Close quietly.
        if (data.disabled) {
          try {
            window.dispatchEvent(new CustomEvent("sd-auth-unlocked", { detail: data }));
          } catch (e) {}
          var disabledCbs = onSuccessCbs.slice();
          onSuccessCbs = [];
          for (var di = 0; di < disabledCbs.length; di++) {
            try {
              disabledCbs[di](data);
            } catch (e) {}
          }
          return;
        }
        try {
          window.dispatchEvent(new CustomEvent("sd-auth-unlocked", { detail: data }));
        } catch (e) {}
        var cbs = onSuccessCbs.slice();
        onSuccessCbs = [];
        for (var i = 0; i < cbs.length; i++) {
          try {
            cbs[i](data);
          } catch (e) {}
        }
        return;
      }
      setErr(
        data && data.error === "invalid_pin"
          ? "Invalid PIN — try again"
          : (data && data.message) || "Login failed"
      );
      pin = "";
      render();
      root.classList.remove("shake");
      void root.offsetWidth;
      root.classList.add("shake");
    } catch (e) {
      setErr("Network error — try again");
    } finally {
      submitting = false;
      root.classList.remove("loading");
      render();
    }
  }

  function openModal(opts) {
    opts = opts || {};
    ensureDom();
    var root = document.getElementById("sdPinUnlock");
    var sub = document.getElementById("sdPinUnlockSub");
    var full = document.getElementById("sdPinUnlockFullAuth");
    if (sub && opts.message) sub.textContent = opts.message;
    else if (sub)
      sub.textContent = "Unlock this device without leaving the page.";
    if (full) {
      var next = encodeURIComponent(location.pathname + location.search || "/tv");
      full.href = "/auth?next=" + next;
    }
    if (typeof opts.onSuccess === "function") onSuccessCbs.push(opts.onSuccess);
    pin = "";
    submitting = false;
    setErr("");
    render();
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    document.body.classList.add("sd-pin-unlock-open");
    open = true;
    try {
      var first = root.querySelector("[data-pin-digit='1']");
      if (first) first.focus();
    } catch (e) {}
  }

  function close() {
    clearTimeout(autoTimer);
    var root = document.getElementById("sdPinUnlock");
    if (root) {
      root.hidden = true;
      root.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("sd-pin-unlock-open");
    open = false;
    pin = "";
    submitting = false;
  }

  function isOpen() {
    return open;
  }

  window.SDPinUnlock = {
    open: openModal,
    close: close,
    isOpen: isOpen,
  };
})();
