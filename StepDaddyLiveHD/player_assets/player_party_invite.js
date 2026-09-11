/* player_party_invite: Invite sheet — Link | Wi‑Fi nearby | Near me (NFC/QR) */
(function sdPartyInviteBoot() {
  const LS_LAN_VISIBLE = "sd_party_lan_visible";
  const LS_LAN_KEY = "sd_party_lan_key";
  const HEARTBEAT_MS = 25000;
  const NEARBY_POLL_MS = 12000;
  const FP_CACHE_MS = 120000;

  let wired = false;
  let activeTab = "link";
  let heartbeatTimer = null;
  let nearbyTimer = null;
  let cachedFp = "";
  let cachedFpAt = 0;
  let lastLanKey = "";
  let nfcSupported = typeof window !== "undefined" && "NDEFReader" in window;

  function authFetch(url, opts) {
    if (window.SDParty && typeof window.SDParty._authFetch === "function") {
      return window.SDParty._authFetch(url, opts);
    }
    return fetch(url, Object.assign({ credentials: "same-origin" }, opts || {}));
  }

  function toast(msg) {
    if (window.SDParty && typeof window.SDParty._toast === "function") {
      window.SDParty._toast(msg);
      return;
    }
    try {
      console.info("[party-invite]", msg);
    } catch (e) {}
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function partyState() {
    const p = window.SDParty || {};
    const st = (typeof p.getInviteState === "function" && p.getInviteState()) || {};
    return {
      code: st.code || "",
      name: st.name || "",
      title: st.title || "",
      public: !!st.public,
      locked: !!st.locked,
      hostKey: st.hostKey || "",
      isHost: !!st.isHost,
      watchPath: st.watchPath || location.pathname + location.search || "/tv/",
    };
  }

  function joinUrl(code) {
    return location.origin + "/party/join/" + encodeURIComponent(code || "");
  }

  function qrImg(payload, size) {
    const abs = String(payload || "").startsWith("http") ? payload : location.origin + payload;
    const px = size || 200;
    return (
      '<img alt="QR code" src="https://api.qrserver.com/v1/create-qr-code/?size=' +
      px +
      "x" +
      px +
      "&data=" +
      encodeURIComponent(abs) +
      '"/>'
    );
  }

  function readLanVisibleDefault(st) {
    try {
      const raw = localStorage.getItem(LS_LAN_VISIBLE + ":" + (st.code || ""));
      if (raw === "0") return false;
      if (raw === "1") return true;
    } catch (e) {}
    if (st.locked) return false;
    return !!st.public || !!st.isHost;
  }

  function storeLanVisible(code, on) {
    try {
      localStorage.setItem(LS_LAN_VISIBLE + ":" + (code || ""), on ? "1" : "0");
    } catch (e) {}
  }

  function sha256Hex(text) {
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then((buf) => {
        const arr = Array.from(new Uint8Array(buf));
        return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
      });
    }
    // Fallback: FNV-1a style 32-bit hex (weaker; still enough for soft matching)
    let h = 2166136261 >>> 0;
    const s = String(text || "");
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return Promise.resolve(("00000000" + h.toString(16)).slice(-8) + ("00000000" + (h ^ 0xa5a5a5a5).toString(16)).slice(-8));
  }

  function isRfc1918(ip) {
    const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip || "");
    if (!m) return false;
    const a = +m[1];
    const b = +m[2];
    if (a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
  }

  function subnet24(ip) {
    const parts = String(ip || "").split(".");
    if (parts.length !== 4) return "";
    return parts[0] + "." + parts[1] + "." + parts[2];
  }

  function probeLocalIp() {
    return new Promise((resolve) => {
      let done = false;
      const finish = (ip) => {
        if (done) return;
        done = true;
        try {
          pc.close();
        } catch (e) {}
        resolve(ip || "");
      };
      let pc;
      try {
        pc = new RTCPeerConnection({ iceServers: [] });
      } catch (e) {
        resolve("");
        return;
      }
      try {
        pc.createDataChannel("lan");
      } catch (e) {}
      pc.onicecandidate = (ev) => {
        const c = ev && ev.candidate && ev.candidate.candidate;
        if (!c) return;
        const m = /([0-9]{1,3}(?:\.[0-9]{1,3}){3})/.exec(c);
        if (m && isRfc1918(m[1])) finish(m[1]);
      };
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => finish(""));
      setTimeout(() => finish(""), 1600);
    });
  }

  async function getNetworkFingerprint(force) {
    const now = Date.now();
    if (!force && cachedFp && now - cachedFpAt < FP_CACHE_MS) return cachedFp;
    const ip = await probeLocalIp();
    const net = subnet24(ip);
    if (!net) {
      cachedFp = "";
      cachedFpAt = now;
      return "";
    }
    const hex = await sha256Hex("lan24:" + net);
    cachedFp = String(hex || "").slice(0, 32);
    cachedFpAt = now;
    return cachedFp;
  }

  function ensureModal() {
    if (document.getElementById("sdInviteModal")) return;
    const bd = document.createElement("div");
    bd.className = "sd-modal-backdrop";
    bd.id = "sdInviteBackdrop";
    const modal = document.createElement("div");
    modal.className = "sd-modal sd-modal-invite";
    modal.id = "sdInviteModal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-label", "Invite to Watch Party");
    modal.innerHTML =
      '<div class="invite-head">' +
      "<h3>Invite</h3>" +
      '<button type="button" class="invite-x" id="sdInviteClose" aria-label="Close">✕</button>' +
      "</div>" +
      '<p class="invite-hint" id="sdInviteHint">Share this party</p>' +
      '<div class="invite-tabs" role="tablist" aria-label="Invite method">' +
      '<button type="button" role="tab" data-invite-tab="link" class="active">Link</button>' +
      '<button type="button" role="tab" data-invite-tab="wifi">Wi‑Fi nearby</button>' +
      '<button type="button" role="tab" data-invite-tab="near">Near me</button>' +
      "</div>" +
      '<div class="invite-pane" data-invite-pane="link">' +
      '<div class="code" id="sdInviteCode"></div>' +
      '<div class="qr-wrap invite-qr" id="sdInviteQr"></div>' +
      '<input id="sdInviteUrl" readonly aria-label="Join link"/>' +
      '<div class="row">' +
      '<button type="button" class="primary" id="sdInviteCopy">Copy link</button>' +
      '<button type="button" id="sdInviteShare">Share…</button>' +
      '<a class="invite-link-btn" id="sdInviteHome" href="/party">Party Home</a>' +
      "</div>" +
      '<p class="invite-note">Works over the internet — send the link or show the QR.</p>' +
      "</div>" +
      '<div class="invite-pane" data-invite-pane="wifi" hidden>' +
      '<label class="invite-toggle" id="sdInviteLanToggleWrap">' +
      '<input type="checkbox" id="sdInviteLanVisible"/> Appear nearby on this Wi‑Fi' +
      "</label>" +
      '<p class="invite-note" id="sdInviteLanHostNote">Friends on the same Wi‑Fi see this party under Nearby.</p>' +
      '<div class="invite-lan-key-row" id="sdInviteLanKeyRow" hidden>' +
      '<span class="invite-lan-label">Wi‑Fi code</span>' +
      '<strong id="sdInviteLanKey">————</strong>' +
      '<button type="button" id="sdInviteLanKeyCopy">Copy</button>' +
      "</div>" +
      '<div class="invite-find">' +
      '<input id="sdInviteFindKey" maxlength="6" placeholder="Wi‑Fi code (optional)" autocomplete="off" spellcheck="false"/>' +
      '<button type="button" class="primary" id="sdInviteFindBtn">Find on this Wi‑Fi</button>' +
      "</div>" +
      '<div id="sdInviteNearbyList" class="invite-nearby-list"><p class="invite-muted">Looking for parties nearby…</p></div>' +
      '<p class="invite-note">Same Wi‑Fi? Ask the host for the short Wi‑Fi code if the list is empty.</p>' +
      "</div>" +
      '<div class="invite-pane" data-invite-pane="near" hidden>' +
      '<div class="qr-wrap invite-qr invite-qr-lg" id="sdInviteNearQr"></div>' +
      '<p class="invite-note">Show this QR to someone next to you.</p>' +
      '<div class="row">' +
      '<button type="button" class="primary" id="sdInviteNfc" hidden>Write to NFC tag</button>' +
      '<button type="button" id="sdInviteNearCopy">Copy link</button>' +
      "</div>" +
      '<p class="invite-muted" id="sdInviteNfcHint"></p>' +
      "</div>";
    document.body.appendChild(bd);
    document.body.appendChild(modal);
  }

  function setTab(tab) {
    activeTab = tab === "wifi" || tab === "near" ? tab : "link";
    document.querySelectorAll("[data-invite-tab]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-invite-tab") === activeTab);
    });
    document.querySelectorAll("[data-invite-pane]").forEach((pane) => {
      pane.hidden = pane.getAttribute("data-invite-pane") !== activeTab;
    });
    if (activeTab === "wifi") refreshNearby();
  }

  function stopLoops() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (nearbyTimer) {
      clearInterval(nearbyTimer);
      nearbyTimer = null;
    }
  }

  async function sendLanHeartbeat() {
    const st = partyState();
    if (!st.code || !st.hostKey || !st.isHost) return;
    const toggle = document.getElementById("sdInviteLanVisible");
    const visible = !!(toggle && toggle.checked);
    storeLanVisible(st.code, visible);
    if (!visible) {
      try {
        await authFetch("/party/presence/lan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: st.code, hostKey: st.hostKey, visible: false }),
        });
      } catch (e) {}
      const row = document.getElementById("sdInviteLanKeyRow");
      if (row) row.hidden = true;
      return;
    }
    let fp = "";
    try {
      fp = await getNetworkFingerprint(false);
    } catch (e) {}
    try {
      const r = await authFetch("/party/presence/lan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: st.code,
          hostKey: st.hostKey,
          visible: true,
          networkFingerprint: fp || undefined,
          lanKey: lastLanKey || undefined,
          name: st.name,
          title: st.title,
          watchPath: st.watchPath,
        }),
      });
      const data = await r.json();
      if (data && data.lanKey) {
        lastLanKey = data.lanKey;
        try {
          localStorage.setItem(LS_LAN_KEY + ":" + st.code, lastLanKey);
        } catch (e) {}
        const keyEl = document.getElementById("sdInviteLanKey");
        const row = document.getElementById("sdInviteLanKeyRow");
        if (keyEl) keyEl.textContent = lastLanKey;
        if (row) row.hidden = false;
      }
    } catch (e) {}
  }

  function startHostHeartbeat() {
    const st = partyState();
    if (!st.isHost || !st.code || !st.hostKey) return;
    sendLanHeartbeat();
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(sendLanHeartbeat, HEARTBEAT_MS);
  }

  function renderNearbyCards(rooms) {
    const list = document.getElementById("sdInviteNearbyList");
    if (!list) return;
    if (!rooms || !rooms.length) {
      list.innerHTML = '<p class="invite-muted">No parties nearby right now. Try the Wi‑Fi code, or use Link.</p>';
      return;
    }
    list.innerHTML = rooms
      .map((room) => {
        const title = escapeHtml(room.name || room.title || room.code || "Party");
        const bits = [];
        if (room.title && room.title !== room.name) bits.push(escapeHtml(room.title));
        if (room.locked) bits.push("Locked");
        if (room.memberCount != null) bits.push(escapeHtml(String(room.memberCount)) + " watching");
        if (room.match === "lanKey") bits.push("Wi‑Fi code");
        else if (room.match === "fingerprint") bits.push("Same Wi‑Fi");
        else bits.push("Same network");
        const href = "/party/join/" + encodeURIComponent(room.code || "");
        return (
          '<div class="invite-nearby-card">' +
          '<div class="body"><strong>' +
          title +
          "</strong><span>" +
          bits.join(" · ") +
          '</span></div><a class="invite-join" href="' +
          escapeHtml(href) +
          '">Join</a></div>'
        );
      })
      .join("");
  }

  async function refreshNearby() {
    const list = document.getElementById("sdInviteNearbyList");
    if (list && !list.dataset.loaded) {
      list.innerHTML = '<p class="invite-muted">Looking for parties nearby…</p>';
    }
    let fp = "";
    try {
      fp = await getNetworkFingerprint(false);
    } catch (e) {}
    const keyInp = document.getElementById("sdInviteFindKey");
    const lanKey = ((keyInp && keyInp.value) || "").trim().toUpperCase();
    const qs = new URLSearchParams();
    if (fp) qs.set("fp", fp);
    if (lanKey) qs.set("lanKey", lanKey);
    try {
      const r = await authFetch("/party/nearby?" + qs.toString());
      if (r.status === 401) {
        if (list) list.innerHTML = '<p class="invite-muted">Sign in with PIN to find nearby parties.</p>';
        return;
      }
      const data = await r.json();
      if (list) list.dataset.loaded = "1";
      renderNearbyCards((data && data.rooms) || []);
    } catch (e) {
      if (list) list.innerHTML = '<p class="invite-muted">Could not reach nearby discovery.</p>';
    }
  }

  async function writeNfc(url) {
    if (!nfcSupported) {
      toast("NFC not available — use QR instead");
      return;
    }
    try {
      const reader = new NDEFReader();
      await reader.write({
        records: [{ recordType: "url", data: url }],
      });
      toast("Hold phone to NFC tag — join link written");
    } catch (e) {
      const msg = String((e && e.name) || e || "");
      if (/NotAllowedError|security/i.test(msg)) toast("Allow NFC permission, then try again");
      else toast("NFC write failed — show the QR instead");
    }
  }

  function fillInvite(st, opts) {
    opts = opts || {};
    const code = st.code || "";
    const url = joinUrl(code);
    const hint = document.getElementById("sdInviteHint");
    if (hint) {
      hint.textContent = st.name
        ? st.name + (st.title ? " · " + st.title : "")
        : st.title || "Share this party";
    }
    const codeEl = document.getElementById("sdInviteCode");
    if (codeEl) codeEl.textContent = code || "—————";
    const urlEl = document.getElementById("sdInviteUrl");
    if (urlEl) urlEl.value = url;
    const qr = document.getElementById("sdInviteQr");
    if (qr) qr.innerHTML = code ? qrImg(url, 200) : "";
    const nearQr = document.getElementById("sdInviteNearQr");
    if (nearQr) nearQr.innerHTML = code ? qrImg(url, 220) : "";

    const toggleWrap = document.getElementById("sdInviteLanToggleWrap");
    const toggle = document.getElementById("sdInviteLanVisible");
    const hostNote = document.getElementById("sdInviteLanHostNote");
    if (toggleWrap) toggleWrap.hidden = !(st.isHost && st.hostKey);
    if (toggle) {
      toggle.checked = readLanVisibleDefault(st);
      if (st.locked && !localStorage.getItem(LS_LAN_VISIBLE + ":" + code)) {
        toggle.checked = false;
      }
    }
    if (hostNote) {
      hostNote.textContent = st.isHost
        ? "Friends on the same Wi‑Fi see this party under Nearby."
        : "Ask the host to enable “Appear nearby”, or enter their Wi‑Fi code.";
    }
    try {
      lastLanKey = localStorage.getItem(LS_LAN_KEY + ":" + code) || lastLanKey || "";
    } catch (e) {}
    const keyEl = document.getElementById("sdInviteLanKey");
    const keyRow = document.getElementById("sdInviteLanKeyRow");
    if (keyEl && lastLanKey) keyEl.textContent = lastLanKey;
    if (keyRow) keyRow.hidden = !(st.isHost && lastLanKey && toggle && toggle.checked);

    const nfcBtn = document.getElementById("sdInviteNfc");
    const nfcHint = document.getElementById("sdInviteNfcHint");
    if (nfcBtn) nfcBtn.hidden = !nfcSupported;
    if (nfcHint) {
      nfcHint.textContent = nfcSupported
        ? "Android Chrome can write the join link to an NFC tag."
        : "NFC not available on this browser — use the QR instead.";
    }

    if (opts.tab) setTab(opts.tab);
    else if (opts.preferNearby) setTab("wifi");
    else setTab(activeTab || "link");
  }

  function wire() {
    if (wired) return;
    ensureModal();
    wired = true;
    const bd = document.getElementById("sdInviteBackdrop");
    if (bd) bd.addEventListener("click", close);
    const closeBtn = document.getElementById("sdInviteClose");
    if (closeBtn) closeBtn.addEventListener("click", close);
    document.querySelectorAll("[data-invite-tab]").forEach((btn) => {
      btn.addEventListener("click", () => setTab(btn.getAttribute("data-invite-tab")));
    });
    const copy = () => {
      const inp = document.getElementById("sdInviteUrl");
      const v = (inp && inp.value) || "";
      if (!v) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(v).then(() => toast("Invite link copied")).catch(() => {});
      } else {
        try {
          inp.select();
          document.execCommand("copy");
          toast("Invite link copied");
        } catch (e) {}
      }
    };
    const copyBtn = document.getElementById("sdInviteCopy");
    if (copyBtn) copyBtn.addEventListener("click", copy);
    const nearCopy = document.getElementById("sdInviteNearCopy");
    if (nearCopy) nearCopy.addEventListener("click", copy);
    const shareBtn = document.getElementById("sdInviteShare");
    if (shareBtn) {
      shareBtn.addEventListener("click", async () => {
        const st = partyState();
        const url = joinUrl(st.code);
        if (navigator.share) {
          try {
            await navigator.share({
              title: st.name || "Watch Party",
              text: "Join my watch party",
              url: url,
            });
            return;
          } catch (e) {}
        }
        copy();
      });
    }
    const toggle = document.getElementById("sdInviteLanVisible");
    if (toggle) {
      toggle.addEventListener("change", () => {
        sendLanHeartbeat();
      });
    }
    const keyCopy = document.getElementById("sdInviteLanKeyCopy");
    if (keyCopy) {
      keyCopy.addEventListener("click", () => {
        const v = (document.getElementById("sdInviteLanKey") || {}).textContent || "";
        if (v && navigator.clipboard) navigator.clipboard.writeText(v).then(() => toast("Wi‑Fi code copied")).catch(() => {});
      });
    }
    const findBtn = document.getElementById("sdInviteFindBtn");
    if (findBtn) findBtn.addEventListener("click", () => refreshNearby());
    const nfcBtn = document.getElementById("sdInviteNfc");
    if (nfcBtn) {
      nfcBtn.addEventListener("click", () => {
        const st = partyState();
        writeNfc(joinUrl(st.code));
      });
    }
  }

  function open(opts) {
    opts = opts || {};
    wire();
    ensureModal();
    const st = Object.assign(partyState(), opts.state || {});
    if (!st.code && opts.code) st.code = opts.code;
    fillInvite(st, opts);
    document.getElementById("sdInviteBackdrop").classList.add("open");
    document.getElementById("sdInviteModal").classList.add("open");
    startHostHeartbeat();
    refreshNearby();
    if (nearbyTimer) clearInterval(nearbyTimer);
    nearbyTimer = setInterval(refreshNearby, NEARBY_POLL_MS);
  }

  function close() {
    document.getElementById("sdInviteBackdrop")?.classList.remove("open");
    document.getElementById("sdInviteModal")?.classList.remove("open");
    stopLoops();
    // Keep announcing while host stays in the party (background heartbeat via SDParty hook).
  }

  /** Background host beacon — called from party JS after join/create. */
  async function ensureHostBeacon() {
    const st = partyState();
    if (!st.isHost || !st.code || !st.hostKey) return;
    if (!readLanVisibleDefault(st)) return;
    let fp = "";
    try {
      fp = await getNetworkFingerprint(false);
    } catch (e) {}
    try {
      const r = await authFetch("/party/presence/lan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: st.code,
          hostKey: st.hostKey,
          visible: true,
          networkFingerprint: fp || undefined,
          name: st.name,
          title: st.title,
          watchPath: st.watchPath,
        }),
      });
      const data = await r.json();
      if (data && data.lanKey) {
        lastLanKey = data.lanKey;
        try {
          localStorage.setItem(LS_LAN_KEY + ":" + st.code, lastLanKey);
        } catch (e) {}
      }
    } catch (e) {}
  }

  async function loadNearbyForHome(targetId) {
    const el = document.getElementById(targetId || "partyHomeNearbyList");
    if (!el) return { count: 0 };
    let fp = "";
    try {
      fp = await getNetworkFingerprint(false);
    } catch (e) {}
    const qs = new URLSearchParams();
    if (fp) qs.set("fp", fp);
    try {
      const r = await authFetch("/party/nearby?" + qs.toString());
      if (r.status === 401) {
        el.innerHTML = '<p class="party-home-empty">Sign in to see nearby parties.</p>';
        return { count: 0 };
      }
      const data = await r.json();
      const rooms = (data && data.rooms) || [];
      if (!rooms.length) {
        el.innerHTML = '<p class="party-home-empty">No parties on this Wi‑Fi right now.</p>';
        return { count: 0 };
      }
      const nameEl = document.getElementById("partyHomeJoinName");
      const guest = (nameEl && nameEl.value) || "Guest";
      el.innerHTML = rooms
        .map((room) => {
          if (window.SDParty && typeof window.SDParty._partyHomeRoomCard === "function") {
            return window.SDParty._partyHomeRoomCard(room);
          }
          const title = escapeHtml(room.name || room.title || room.code || "Party");
          const meta = [];
          if (room.locked) meta.push("Locked");
          if (room.title && room.title !== room.name) meta.push(escapeHtml(room.title));
          meta.push(room.match === "fingerprint" ? "Same Wi‑Fi" : "Nearby");
          const href = "/party/join/" + encodeURIComponent(room.code || "");
          const letter = String(room.title || room.name || room.code || "?").trim().charAt(0).toUpperCase() || "?";
          const src = (room.posterPath || room.logoPath || "").trim();
          const thumb = src
            ? '<img class="party-home-poster" src="' + escapeHtml(src) + '" alt="" loading="lazy" onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement(\'div\'),{className:\'party-home-poster ph\',textContent:\'' + letter + '\'}))"/>'
            : '<div class="party-home-poster ph">' + letter + "</div>";
          return (
            '<div class="party-home-card">' +
            thumb +
            '<div class="body"><strong>' +
            title +
            "</strong><span>" +
            meta.join(" · ") +
            '</span></div><a class="party-home-btn" href="' +
            escapeHtml(href) +
            '">Join</a></div>'
          );
        })
        .join("");
      return { count: rooms.length, rooms };
    } catch (e) {
      el.innerHTML = '<p class="party-home-empty">Nearby discovery unavailable.</p>';
      return { count: 0 };
    }
  }

  window.SDPartyInvite = {
    open,
    close,
    ensureHostBeacon,
    loadNearbyForHome,
    getNetworkFingerprint,
    nfcSupported: !!nfcSupported,
  };
})();
