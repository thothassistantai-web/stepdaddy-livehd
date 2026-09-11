/* player_party_home: Watch Party slide-up hub — Create / Enter code / Nearby / Resume / Public / Presence */
(function sdPartyHomeBoot() {
  const LS_PARTY_NAME = "sd_party_name";
  const LS_PARTY_RECENT = "sd_party_recent";
  const LS_LAST_PLACE = "sd_last_place";
  const LS_LAST_TV = "sd_last_tv_channel";
  const LS_CREATE_PUBLIC = "sd_party_create_public";
  const POLL_MS = 22000;
  const NEARBY_POLL_MS = 28000;

  let open = false;
  let pollTimer = null;
  let nearbyTimer = null;
  let wired = false;
  let createExpanded = false;
  let joinExpanded = false;

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function $(id) {
    return document.getElementById(id);
  }

  function authFetch(url, opts) {
    try {
      if (window.SDParty && typeof SDParty._authFetch === "function") {
        return SDParty._authFetch(url, opts);
      }
    } catch (e) {}
    return fetch(url, Object.assign({ credentials: "same-origin" }, opts || {}));
  }

  function guestName() {
    const el = $("partyHomeJoinName") || $("partyHomeCreateGuest");
    const v = ((el && el.value) || "").trim();
    if (v) return v;
    try {
      return localStorage.getItem(LS_PARTY_NAME) || "Guest";
    } catch (e) {
      return "Guest";
    }
  }

  function watchJoinUrl(code, name, watchPath) {
    let path = watchPath || "/tv/";
    return (
      path +
      (path.includes("?") ? "&" : "?") +
      "party=" +
      encodeURIComponent(code) +
      "&name=" +
      encodeURIComponent(name || "Guest")
    );
  }

  function stashPending(code, name) {
    try {
      sessionStorage.setItem("sd_party_pending", code);
      sessionStorage.setItem("sd_party_name_pending", name || "Guest");
      localStorage.setItem(LS_PARTY_NAME, name || "Guest");
    } catch (e) {}
  }

  function tvUrl() {
    let ch = "";
    try {
      ch = localStorage.getItem(LS_LAST_TV) || "";
    } catch (e) {}
    return ch ? "/tv/" + encodeURIComponent(ch) : "/tv/";
  }

  function readLastPlace() {
    try {
      return JSON.parse(localStorage.getItem(LS_LAST_PLACE) || "null");
    } catch (e) {
      return null;
    }
  }

  function readRecent() {
    try {
      const recent = JSON.parse(localStorage.getItem(LS_PARTY_RECENT) || "[]");
      return Array.isArray(recent) ? recent : [];
    } catch (e) {
      return [];
    }
  }

  function usableArtUrl(raw) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!s || s === "null" || s === "undefined" || s === "none") return null;
    return s;
  }

  function channelLogoFor(room) {
    const direct = usableArtUrl(room && (room.logoPath || room.logo));
    if (direct) return direct;
    const id = room && (room.channelId || room.channel_id);
    if (!id) return null;
    try {
      if (typeof channelMap !== "undefined" && channelMap[String(id)] && channelMap[String(id)].logo) {
        return usableArtUrl(channelMap[String(id)].logo);
      }
    } catch (e) {}
    return null;
  }

  function thumbLetter(room, opts) {
    if (opts && opts.badge) return String(opts.badge).slice(0, 2);
    const src = String((room && (room.title || room.name || room.code)) || "?").trim();
    const ch = src.charAt(0);
    return (ch || "?").toUpperCase();
  }

  function thumbHue(seed) {
    let h = 0;
    const s = String(seed || "P");
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 360;
  }

  function thumbPlaceholderHtml(room, opts) {
    const letter = thumbLetter(room, opts);
    const seed = (room && (room.channelId || room.code || room.title || room.name)) || letter;
    const hue = thumbHue(seed);
    const style =
      "background:linear-gradient(145deg,hsl(" +
      hue +
      ",42%,28%),hsl(" +
      ((hue + 40) % 360) +
      ",38%,16%));";
    return (
      '<div class="party-home-poster ph" style="' +
      style +
      '" aria-hidden="true"><span class="party-home-poster-letter">' +
      esc(letter) +
      "</span></div>"
    );
  }

  function thumbImgHtml(src, fallbackSrc, room, opts) {
    const primary = usableArtUrl(src);
    const fallback = usableArtUrl(fallbackSrc);
    if (!primary && !fallback) return thumbPlaceholderHtml(room, opts);
    const use = primary || fallback;
    const next = primary && fallback && primary !== fallback ? fallback : "";
    const onerr =
      "this.onerror=null;var f=this.getAttribute('data-fallback');" +
      "if(f){this.removeAttribute('data-fallback');this.src=f;return;}" +
      "var p=this.parentNode;if(!p)return;" +
      "var d=document.createElement('div');d.className='party-home-poster ph';" +
      "d.setAttribute('aria-hidden','true');d.innerHTML=this.getAttribute('data-letter')||'?';" +
      "var st=this.getAttribute('data-ph-style');if(st)d.setAttribute('style',st);" +
      "p.replaceChild(d,this);";
    const letter = thumbLetter(room, opts);
    const seed = (room && (room.channelId || room.code || room.title || room.name)) || letter;
    const hue = thumbHue(seed);
    const phStyle =
      "background:linear-gradient(145deg,hsl(" +
      hue +
      ",42%,28%),hsl(" +
      ((hue + 40) % 360) +
      ",38%,16%));";
    return (
      '<img class="party-home-poster" src="' +
      esc(use) +
      '" alt="" loading="lazy" decoding="async"' +
      (next ? ' data-fallback="' + esc(next) + '"' : "") +
      ' data-letter="' +
      esc(letter) +
      '" data-ph-style="' +
      esc(phStyle) +
      '" onerror="' +
      onerr +
      '"/>'
    );
  }

  function cardThumbHtml(room, opts) {
    opts = opts || {};
    const poster = usableArtUrl(room && room.posterPath);
    const logo = channelLogoFor(room);
    // Prefer distinct poster, then logo, then letter/gradient — never empty <img src="">.
    if (poster && logo && poster !== logo) return thumbImgHtml(poster, logo, room, opts);
    if (poster) return thumbImgHtml(poster, logo, room, opts);
    if (logo) return thumbImgHtml(logo, null, room, opts);
    return thumbPlaceholderHtml(room, opts);
  }

  function roomCard(room, opts) {
    opts = opts || {};
    const title = room.name || room.title || room.code || "Party";
    const meta = [];
    if (room.memberCount != null) meta.push(room.memberCount + " watching");
    if (room.locked) meta.push("Locked");
    if (room.match === "fingerprint") meta.push("Same Wi‑Fi");
    else if (room.match === "lan" || room.match === "near" || room.match === "lanKey") meta.push("Nearby");
    else if (room.match === "publicIp") meta.push("Nearby");
    if (room.title && room.title !== title) meta.push(room.title);
    if (room.channelId) meta.push("Ch " + room.channelId);
    const guest = opts.guest || guestName();
    const poster = cardThumbHtml(room, opts);
    const href = opts.href || watchJoinUrl(room.code, guest, room.watchPath);
    const lockChip = room.locked
      ? '<span class="party-home-chip lock" title="Password required">Lock</span>'
      : "";
    const btnClass = opts.secondary ? "party-home-btn secondary" : "party-home-btn";
    const btnLabel = opts.btnLabel || "Join";
    return (
      '<article class="party-home-card">' +
      poster +
      '<div class="body"><strong>' +
      esc(title) +
      "</strong><span>" +
      esc(meta.join(" · ")) +
      "</span>" +
      lockChip +
      '</div><a class="' +
      btnClass +
      '" href="' +
      esc(href) +
      '" aria-label="' +
      esc(btnLabel + " " + title) +
      '">' +
      esc(btnLabel) +
      "</a></article>"
    );
  }

  function emptyState(msg, actions) {
    let html = '<div class="party-home-empty-block"><p class="party-home-empty">' + esc(msg) + "</p>";
    if (actions && actions.length) {
      html += '<div class="party-home-actions compact">';
      actions.forEach((a) => {
        html +=
          '<button type="button" class="party-home-btn ' +
          (a.secondary ? "secondary" : "") +
          '" data-home-action="' +
          esc(a.action) +
          '">' +
          esc(a.label) +
          "</button>";
      });
      html += "</div>";
    }
    html += "</div>";
    return html;
  }

  function setPanelVisible(id, visible) {
    const el = $(id);
    if (!el) return;
    el.hidden = !visible;
    el.classList.toggle("is-empty", !visible);
  }

  function syncCtaState() {
    const createPanel = $("partyHomeCreatePanel");
    const joinPanel = $("partyHomeJoinPanel");
    const createBtn = $("partyHomeCtaCreate");
    const joinBtn = $("partyHomeCtaJoin");
    if (createPanel) createPanel.hidden = !createExpanded;
    if (joinPanel) joinPanel.hidden = !joinExpanded;
    if (createBtn) {
      createBtn.setAttribute("aria-expanded", createExpanded ? "true" : "false");
      createBtn.classList.toggle("active", createExpanded);
    }
    if (joinBtn) {
      joinBtn.setAttribute("aria-expanded", joinExpanded ? "true" : "false");
      joinBtn.classList.toggle("active", joinExpanded);
    }
  }

  async function loadPublic() {
    const el = $("partyHomePublicList");
    const panel = $("partyHomePublicPanel");
    if (!el) return;
    try {
      const r = await authFetch("/party/public");
      if (r.status === 401) {
        el.innerHTML = emptyState("Sign in with PIN to see public parties.", [
          { label: "Enter code", action: "expand-join", secondary: true },
        ]);
        if (panel) panel.hidden = false;
        return;
      }
      const data = await r.json();
      const rooms = (data && data.rooms) || [];
      if (!rooms.length) {
        el.innerHTML = emptyState("No public parties right now.", [
          { label: "Create one", action: "expand-create" },
          { label: "Enter code", action: "expand-join", secondary: true },
        ]);
        if (panel) panel.hidden = false;
        return;
      }
      el.innerHTML = rooms.map((room) => roomCard(room)).join("");
      if (panel) panel.hidden = false;
    } catch (e) {
      el.innerHTML = emptyState("Could not load public parties.", [
        { label: "Retry", action: "refresh", secondary: true },
      ]);
    }
  }

  async function loadPresence() {
    const summary = $("partyHomeOnlineSummary");
    const list = $("partyHomeOnlineList");
    const panel = $("partyHomeOnlinePanel");
    if (!summary) return;
    try {
      const r = await authFetch("/party/presence");
      if (r.status === 401) {
        summary.textContent = "Sign in to see who’s watching";
        if (list) list.innerHTML = "";
        if (panel) panel.hidden = false;
        return;
      }
      const data = await r.json();
      const n = (data && data.inParties) || 0;
      const priv = (data && data.privateRooms) || 0;
      summary.textContent =
        n +
        " watching now" +
        (priv ? " · " + priv + " private room" + (priv === 1 ? "" : "s") : "");
      if (!list) return;
      const people = (data && data.online) || [];
      if (!people.length) {
        list.innerHTML = emptyState("Nobody in a party right now.", [
          { label: "Create party", action: "expand-create" },
        ]);
        if (panel) panel.hidden = false;
        return;
      }
      const guest = guestName();
      list.innerHTML = people
        .slice(0, 24)
        .map((p) => {
          const where = p.roomName || (p.public ? "Public party" : "In a party");
          const title = p.title ? " · " + p.title : "";
          const thumb = cardThumbHtml(
            {
              posterPath: p.posterPath,
              logoPath: p.logoPath,
              channelId: p.channelId,
              title: p.title || p.roomName || p.displayName,
              name: p.displayName,
              code: p.code,
            },
            { badge: (p.displayName || "?").trim().charAt(0).toUpperCase() || "◎" }
          );
          return (
            '<article class="party-home-card presence">' +
            thumb +
            '<div class="body"><strong>' +
            esc(p.displayName || "Guest") +
            "</strong><span>" +
            esc(where + title) +
            "</span></div>" +
            (p.watchPath && p.code
              ? '<a class="party-home-btn secondary" href="' +
                esc(watchJoinUrl(p.code, guest, p.watchPath)) +
                '" aria-label="Join party with ' +
                esc(p.displayName || "Guest") +
                '">Join</a>'
              : "") +
            "</article>"
          );
        })
        .join("");
      if (panel) panel.hidden = false;
    } catch (e) {
      summary.textContent = "Presence unavailable";
    }
  }

  function loadRecentAndContinue() {
    const el = $("partyHomeContinueList");
    const panel = $("partyHomeContinuePanel");
    if (!el) return;
    const cards = [];
    const place = readLastPlace();
    const recent = readRecent();

    if (place && place.partyCode) {
      const resumeTitle = place.title || place.name || "Resume party";
      let resumeMeta = "";
      if (place.channelId) resumeMeta = "Ch " + place.channelId;
      else if (place.path && !String(place.path).includes("?")) resumeMeta = place.path;
      else resumeMeta = "Tap to rejoin";
      cards.push(
        roomCard(
          {
            code: place.partyCode,
            name: resumeTitle,
            title: resumeMeta,
            channelId: place.channelId || null,
            posterPath: place.posterPath || null,
            logoPath: place.logoPath || null,
            watchPath: "/party/join/" + encodeURIComponent(place.partyCode),
          },
          {
            href: "/party/join/" + encodeURIComponent(place.partyCode),
            badge: "↻",
            btnLabel: "Rejoin",
            secondary: false,
          }
        )
      );
    }

    if (place && place.channelId && !place.partyCode) {
      const href = "/tv/" + encodeURIComponent(place.channelId) + "?party_create=1";
      cards.push(
        roomCard(
          {
            code: "CH-" + place.channelId,
            name: "Party on Ch " + place.channelId,
            title: place.title || "Last live channel",
            channelId: place.channelId,
            posterPath: place.posterPath || null,
            logoPath: place.logoPath || null,
            watchPath: href,
          },
          { href: href, badge: "TV", btnLabel: "Start" }
        )
      );
      const startLast = $("partyHomeStartLast");
      if (startLast) {
        startLast.hidden = false;
        startLast.dataset.href = href;
        startLast.textContent = "Start on Ch " + place.channelId;
      }
    }

    if (place && place.tmdbId) {
      const mt =
        place.mediaType === "tv" || place.mediaType === "series" ? "tv" : "movie";
      let path = "/vod/" + mt + "/" + encodeURIComponent(place.tmdbId);
      if (mt === "tv" && place.season) {
        path += "?season=" + encodeURIComponent(place.season);
        if (place.episode) path += "&episode=" + encodeURIComponent(place.episode);
        path += "&party_create=1";
      } else path += (path.includes("?") ? "&" : "?") + "party_create=1";
      cards.push(
        roomCard(
          {
            code: "VOD-" + place.tmdbId,
            name: "Continue " + (place.title || "title"),
            title: "Start a party on this title",
            posterPath: place.posterPath || place.poster_url || null,
            watchPath: path,
          },
          { href: path, badge: "VOD", btnLabel: "Start" }
        )
      );
    }

    const seen = {};
    if (place && place.partyCode) seen[String(place.partyCode).toUpperCase()] = 1;
    recent.slice(0, 8).forEach((room) => {
      const code = String((room && room.code) || "").toUpperCase();
      if (!code || seen[code]) return;
      seen[code] = 1;
      const href = "/party/join/" + encodeURIComponent(code);
      cards.push(
        roomCard(
          {
            code: code,
            name: room.name || code,
            title: room.title,
            posterPath: room.posterPath || null,
            logoPath: room.logoPath || null,
            channelId: room.channelId || null,
            watchPath: href,
          },
          { href: href, badge: "↻", btnLabel: "Rejoin", secondary: true }
        )
      );
    });

    if (!cards.length) {
      el.innerHTML = emptyState("No recent parties on this device yet.", [
        { label: "Create party", action: "expand-create" },
        { label: "Enter code", action: "expand-join", secondary: true },
      ]);
    } else {
      el.innerHTML = cards.join("");
    }
    if (panel) panel.hidden = false;
  }

  async function loadNearby() {
    const panel = $("partyHomeNearbyPanel");
    const el = $("partyHomeNearbyList");
    if (!el) return { count: 0 };
    try {
      if (window.SDPartyInvite && typeof SDPartyInvite.loadNearbyForHome === "function") {
        const res = await SDPartyInvite.loadNearbyForHome("partyHomeNearbyList");
        const count = (res && res.count) || 0;
        if (panel) {
          panel.hidden = false;
          panel.classList.toggle("has-nearby", count > 0);
          if (count > 0) {
            try {
              const body = $("partyHomeBody");
              const hero = $("partyHomeHero");
              if (body && panel.parentNode === body) {
                const anchor = hero ? hero.nextSibling : body.firstChild;
                body.insertBefore(panel, anchor);
              }
            } catch (e) {}
          }
        }
        return res || { count: 0 };
      }
    } catch (e) {}
    el.innerHTML = emptyState("Nearby discovery unavailable.", [
      { label: "Enter code", action: "expand-join", secondary: true },
    ]);
    if (panel) panel.hidden = false;
    return { count: 0 };
  }

  function stashCreatePrefs() {
    const name = (($("partyHomeCreateName") || {}).value || "").trim();
    const isPublic = !!(($("partyHomeCreatePublic") || {}).checked);
    const pwd = (($("partyHomeCreatePassword") || {}).value || "").trim();
    const guest = (($("partyHomeCreateGuest") || {}).value || guestName()).trim() || "Guest";
    try {
      localStorage.setItem(LS_PARTY_NAME, guest);
      localStorage.setItem(LS_CREATE_PUBLIC, isPublic ? "1" : "0");
      sessionStorage.setItem("sd_party_create_name", name);
      sessionStorage.setItem("sd_party_create_public", isPublic ? "1" : "0");
      if (pwd) sessionStorage.setItem("sd_party_create_password", pwd);
      else sessionStorage.removeItem("sd_party_create_password");
    } catch (e) {}
    // Mirror into party modal fields if present
    try {
      const rn = $("sdPartyRoomName");
      if (rn && name) rn.value = name;
      const pub = $("sdPartyPublic");
      if (pub) pub.checked = isPublic;
      const pw = $("sdPartyPassword");
      if (pw) pw.value = pwd;
    } catch (e) {}
    return { name, isPublic, pwd, guest };
  }

  function applyCreatePrefsFromStorage() {
    try {
      const nameEl = $("partyHomeCreateName");
      const pubEl = $("partyHomeCreatePublic");
      const guestEl = $("partyHomeCreateGuest");
      if (nameEl && !nameEl.value) {
        nameEl.value = sessionStorage.getItem("sd_party_create_name") || "";
      }
      if (pubEl) {
        const v = localStorage.getItem(LS_CREATE_PUBLIC);
        pubEl.checked = v !== "0";
      }
      if (guestEl && !guestEl.value) {
        guestEl.value = localStorage.getItem(LS_PARTY_NAME) || "";
      }
    } catch (e) {}
  }

  async function createOnCurrentChannel() {
    const err = $("partyHomeCreateErr");
    if (err) err.textContent = "";
    let p;
    try {
      p = stashCreatePrefs();
    } catch (e) {
      p = { name: "", isPublic: true, pwd: "", guest: "Guest" };
    }
    try {
      if (window.SDParty && typeof SDParty.createParty === "function") {
        close(true);
        await SDParty.createParty({
          name: p.name || undefined,
          public: p.isPublic,
          password: p.pwd || undefined,
        });
        return;
      }
    } catch (e) {
      if (err) err.textContent = "Could not create party here. Try live TV.";
      return;
    }
    location.href = tvUrl().split("?")[0] + "?party_create=1";
  }

  function startLiveCreate() {
    stashCreatePrefs();
    close(true);
    const base = tvUrl().split("?")[0];
    history.replaceState(null, "", base + "?party_create=1");
    try {
      if (window.SDParty && typeof SDParty.openPanel === "function") SDParty.openPanel();
    } catch (e) {}
    setTimeout(() => {
      try {
        if (window.SDParty && typeof SDParty.openPanel === "function") SDParty.openPanel();
      } catch (e) {}
    }, 200);
  }

  function startVodCreate() {
    stashCreatePrefs();
    location.href = "/vod?party_create=1";
  }

  function refresh() {
    loadNearby();
    loadRecentAndContinue();
    loadPublic();
    loadPresence();
  }

  function stopPoll() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (nearbyTimer) {
      clearInterval(nearbyTimer);
      nearbyTimer = null;
    }
  }

  function startPoll() {
    stopPoll();
    pollTimer = setInterval(() => {
      if (!open) return;
      loadPublic();
      loadPresence();
    }, POLL_MS);
    nearbyTimer = setInterval(() => {
      if (!open) return;
      loadNearby();
    }, NEARBY_POLL_MS);
  }

  function close(silent) {
    open = false;
    const sheet = $("partyHome");
    const backdrop = $("partyHomeBackdrop");
    if (sheet) {
      sheet.classList.remove("open");
      sheet.setAttribute("aria-hidden", "true");
    }
    if (backdrop) backdrop.classList.remove("open");
    stopPoll();
    if (!silent) {
      const path = location.pathname.replace(/\/$/, "") || "/";
      if (path === "/party" || path === "/party/home") {
        history.replaceState(null, "", tvUrl());
      }
    }
  }

  function openHome(opts) {
    opts = opts || {};
    try {
      if (typeof window.SDCloseVodCatalogUI === "function") window.SDCloseVodCatalogUI();
    } catch (e) {}
    try {
      if (window.SDMusic && typeof window.SDMusic.close === "function") window.SDMusic.close(true);
    } catch (e) {}
    wireOnce();
    open = true;
    const sheet = $("partyHome");
    const backdrop = $("partyHomeBackdrop");
    if (sheet) {
      sheet.classList.add("open");
      sheet.setAttribute("aria-hidden", "false");
    }
    if (backdrop) backdrop.classList.add("open");
    applyCreatePrefsFromStorage();
    const nameInput = $("partyHomeJoinName");
    if (nameInput && !nameInput.value) {
      try {
        nameInput.value = localStorage.getItem(LS_PARTY_NAME) || "";
      } catch (e) {}
    }
    const guestCreate = $("partyHomeCreateGuest");
    if (guestCreate && !guestCreate.value && nameInput) guestCreate.value = nameInput.value || "";
    // Default: show CTAs; expand create if ?party_create or opts.create
    if (opts.create) {
      createExpanded = true;
      joinExpanded = false;
    } else if (opts.join) {
      createExpanded = false;
      joinExpanded = true;
    }
    syncCtaState();
    refresh();
    startPoll();
    const path = location.pathname.replace(/\/$/, "") || "/";
    if (path !== "/party" && path !== "/party/home") {
      if (opts.replace) history.replaceState({ sdPartyHome: 1 }, "", "/party");
      else history.pushState({ sdPartyHome: 1 }, "", "/party");
    } else if (opts.replace) {
      history.replaceState({ sdPartyHome: 1 }, "", "/party");
    }
    try {
      const focusTarget =
        (createExpanded && $("partyHomeCreateName")) ||
        (joinExpanded && $("partyHomeJoinCode")) ||
        $("partyHomeCtaCreate");
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    } catch (e) {}
  }

  function handleHomeAction(action) {
    if (action === "expand-create") {
      createExpanded = true;
      joinExpanded = false;
      syncCtaState();
      try {
        ($("partyHomeCreateName") || {}).focus();
      } catch (e) {}
      return;
    }
    if (action === "expand-join") {
      joinExpanded = true;
      createExpanded = false;
      syncCtaState();
      try {
        ($("partyHomeJoinCode") || {}).focus();
      } catch (e) {}
      return;
    }
    if (action === "refresh") {
      refresh();
      return;
    }
    if (action === "guide") {
      location.href = "/tv/";
      return;
    }
  }

  function wireOnce() {
    if (wired) return;
    wired = true;

    const form = $("partyHomeJoinForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const code = (($("partyHomeJoinCode") || {}).value || "").trim().toUpperCase();
        const name =
          (($("partyHomeJoinName") || {}).value || "Guest").trim() || "Guest";
        const err = $("partyHomeJoinErr");
        if (err) err.textContent = "";
        if (!code || code.length < 4) {
          if (err) err.textContent = "Enter a valid party code.";
          return;
        }
        stashPending(code, name);
        let watch = "/tv/";
        try {
          const r = await authFetch("/party/join/" + encodeURIComponent(code) + "/meta");
          const data = await r.json();
          if (data && data.ok && data.watchPath) watch = data.watchPath;
          else if (data && data.error === "not_found") {
            if (err) err.textContent = "Room not found or expired.";
            return;
          }
        } catch (err2) {}
        location.href = watchJoinUrl(code, name, watch);
      });
    }

    const closeBtn = $("closePartyHome");
    if (closeBtn) closeBtn.addEventListener("click", () => close());
    const backdrop = $("partyHomeBackdrop");
    if (backdrop) backdrop.addEventListener("click", () => close());

    const ctaCreate = $("partyHomeCtaCreate");
    if (ctaCreate) {
      ctaCreate.addEventListener("click", () => {
        createExpanded = !createExpanded;
        if (createExpanded) joinExpanded = false;
        syncCtaState();
      });
    }
    const ctaJoin = $("partyHomeCtaJoin");
    if (ctaJoin) {
      ctaJoin.addEventListener("click", () => {
        joinExpanded = !joinExpanded;
        if (joinExpanded) createExpanded = false;
        syncCtaState();
      });
    }

    const createNow = $("partyHomeCreateNow");
    if (createNow) createNow.addEventListener("click", () => createOnCurrentChannel());
    const startLive = $("partyHomeStartLive");
    if (startLive) startLive.addEventListener("click", () => startLiveCreate());
    const startVod = $("partyHomeStartVod");
    if (startVod) startVod.addEventListener("click", () => startVodCreate());
    const startLast = $("partyHomeStartLast");
    if (startLast) {
      startLast.addEventListener("click", () => {
        stashCreatePrefs();
        location.href = startLast.dataset.href || "/tv/?party_create=1";
      });
    }

    const body = $("partyHomeBody");
    if (body) {
      body.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-home-action]");
        if (!btn) return;
        e.preventDefault();
        handleHomeAction(btn.getAttribute("data-home-action"));
      });
    }

    const homeBtn = $("partyHomeBtn");
    if (homeBtn) {
      homeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (open) close();
        else openHome();
      });
    }

    window.addEventListener("popstate", () => {
      const path = location.pathname.replace(/\/$/, "") || "/";
      if (path === "/party" || path === "/party/home") openHome({ replace: true });
      else if (open) close(true);
    });

    document.addEventListener("keydown", (e) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    });
  }

  function install() {
    wireOnce();
    window.SDPartyHome = {
      open: openHome,
      close,
      refresh,
      roomCard,
      cardThumbHtml,
      isOpen: () => open,
    };
    try {
      if (window.SDParty) {
        SDParty.openHome = openHome;
        SDParty.closeHome = close;
        SDParty._partyHomeRoomCard = roomCard;
        SDParty._partyHomeThumb = cardThumbHtml;
      }
    } catch (e) {}

    try {
      const bootPath = location.pathname.replace(/\/$/, "") || "/";
      if (bootPath === "/party" || bootPath === "/party/home") {
        openHome({ replace: true });
      }
    } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})();
