"""Mobile-friendly PIN entry pages (cinema unlock shell)."""


def _friendly_next(next_path: str) -> str:
    p = (next_path or "/play").split("?", 1)[0].rstrip("/") or "/"
    if p.startswith("/tv"):
        return "TV guide"
    if p.startswith("/vod"):
        return "On demand"
    if p.startswith("/party"):
        return "Watch party"
    if p.startswith("/play"):
        return "Live player"
    if p.startswith("/remote"):
        return "Phone remote"
    return "Continue"


def render_auth_page(next_path: str, device_id: str) -> str:
    safe_next = next_path.replace("\\", "\\\\").replace('"', "&quot;").replace("<", "&lt;")
    safe_device = device_id.replace('"', "&quot;").replace("<", "&lt;")
    dest = _friendly_next(next_path).replace('"', "&quot;").replace("<", "&lt;")
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,interactive-widget=resizes-content"/>
  <meta name="apple-mobile-web-app-capable" content="yes"/>
  <meta name="mobile-web-app-capable" content="yes"/>
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
  <meta name="theme-color" content="#0b0b0b"/>
  <meta name="color-scheme" content="dark"/>
  <link rel="manifest" href="/tv-assets/site.webmanifest"/>
  <link rel="apple-touch-icon" href="/tv-assets/icon-192.png"/>
  <title>Unlock — StepDaddyLiveHD</title>
  <style>
    :root {{
      color-scheme: dark;
      --bg0: #07080c;
      --bg1: #12141c;
      --card: rgba(18, 20, 28, 0.88);
      --line: rgba(255,255,255,0.10);
      --text: #f3f4f6;
      --muted: #9aa3b2;
      --accent: #3b82f6;
      --ok: #16a34a;
      --bad: #f87171;
      --pad: #1a1d27;
      --pad-active: #2a3040;
      --safe-b: env(safe-area-inset-bottom, 0px);
      --safe-t: env(safe-area-inset-top, 0px);
    }}
    * {{ box-sizing: border-box; -webkit-tap-highlight-color: transparent; }}
    html, body {{
      margin: 0; min-height: 100%; min-height: 100dvh;
      background:
        radial-gradient(1200px 600px at 50% -10%, rgba(37,99,235,0.22), transparent 55%),
        radial-gradient(800px 400px at 100% 100%, rgba(22,163,74,0.10), transparent 50%),
        linear-gradient(180deg, var(--bg1), var(--bg0));
      color: var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      overscroll-behavior: none;
    }}
    .shell {{
      min-height: 100dvh; display: grid; place-items: center;
      padding: calc(20px + var(--safe-t)) 16px calc(24px + var(--safe-b));
    }}
    .card {{
      width: min(420px, 100%);
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 22px;
      padding: 22px 18px 18px;
      backdrop-filter: blur(16px);
      box-shadow: 0 24px 60px rgba(0,0,0,0.45);
    }}
    .brand {{
      display: flex; align-items: center; gap: 12px; margin-bottom: 6px;
    }}
    .logo {{
      width: 42px; height: 42px; border-radius: 12px;
      background: linear-gradient(145deg, #2563eb, #0ea5e9 55%, #16a34a);
      display: grid; place-items: center; font-weight: 800; letter-spacing: -0.04em;
      box-shadow: 0 8px 20px rgba(37,99,235,0.35);
    }}
    h1 {{ font-size: 1.2rem; margin: 0; letter-spacing: -0.02em; }}
    .sub {{ margin: 0; color: var(--muted); font-size: 0.9rem; }}
    .dest {{
      margin: 14px 0 18px; display: inline-flex; align-items: center; gap: 8px;
      padding: 7px 11px; border-radius: 999px; border: 1px solid var(--line);
      background: rgba(255,255,255,0.04); color: #dbeafe; font-size: 12px; font-weight: 600;
    }}
    .dest span {{ color: var(--muted); font-weight: 500; }}
    .dots {{
      display: flex; justify-content: center; gap: 10px; margin: 8px 0 18px; min-height: 18px;
    }}
    .dot {{
      width: 12px; height: 12px; border-radius: 50%;
      border: 1.5px solid rgba(255,255,255,0.28);
      background: transparent; transition: transform .12s ease, background .12s ease, border-color .12s ease;
    }}
    .dot.filled {{ background: #fff; border-color: #fff; transform: scale(1.08); }}
    .display {{
      text-align: center; color: var(--muted); font-size: 13px; margin-bottom: 14px; min-height: 18px;
    }}
    .pad {{
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
    }}
    .pad button {{
      min-height: 62px; border: 0; border-radius: 16px; font-size: 1.35rem; font-weight: 650;
      color: var(--text); background: var(--pad); cursor: pointer; touch-action: manipulation;
      transition: background .12s ease, transform .08s ease;
    }}
    .pad button:active {{ background: var(--pad-active); transform: scale(0.97); }}
    .pad button.action {{ background: #1e293b; font-size: 0.92rem; font-weight: 600; color: #cbd5e1; }}
    .pad button.enter {{
      grid-column: span 3; min-height: 54px; font-size: 1rem;
      background: linear-gradient(180deg, #22c55e, #15803d); color: #fff;
      box-shadow: 0 10px 24px rgba(22,163,74,0.28);
    }}
    .pad button.enter:disabled {{ opacity: 0.45; box-shadow: none; }}
    .opts {{
      margin-top: 16px; display: grid; gap: 10px;
      padding-top: 14px; border-top: 1px solid var(--line);
    }}
    .row {{
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
    }}
    .row label {{
      display: flex; align-items: flex-start; gap: 10px; cursor: pointer; flex: 1;
      font-size: 0.92rem; font-weight: 600;
    }}
    .row label small {{
      display: block; font-weight: 500; color: var(--muted); font-size: 0.78rem; margin-top: 2px;
    }}
    .row input[type="checkbox"] {{
      width: 18px; height: 18px; margin-top: 2px; accent-color: var(--accent); flex-shrink: 0;
    }}
    .ttl {{
      width: 100%; appearance: none; border-radius: 12px; border: 1px solid var(--line);
      background: #0f121a; color: var(--text); padding: 11px 12px; font-size: 0.9rem; font-weight: 600;
    }}
    .ttl:disabled {{ opacity: 0.45; }}
    .nick {{
      width: 100%; border-radius: 12px; border: 1px solid var(--line);
      background: #0f121a; color: var(--text); padding: 11px 12px; font-size: 0.9rem;
    }}
    .nick::placeholder {{ color: #6b7280; }}
    .err {{
      color: var(--bad); text-align: center; min-height: 20px; margin-top: 12px; font-size: 0.9rem;
    }}
    .hint {{
      margin-top: 10px; text-align: center; color: #6b7280; font-size: 0.75rem; line-height: 1.4;
    }}
    .loading {{ opacity: 0.55; pointer-events: none; }}
    .shake {{ animation: shake 0.38s ease; }}
    @keyframes shake {{
      0%,100% {{ transform: translateX(0); }}
      20% {{ transform: translateX(-8px); }}
      40% {{ transform: translateX(8px); }}
      60% {{ transform: translateX(-5px); }}
      80% {{ transform: translateX(5px); }}
    }}
    .quick {{
      display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 12px;
    }}
    .quick a, .quick button.link {{
      border: 1px solid var(--line); background: transparent; color: var(--muted);
      border-radius: 999px; padding: 7px 11px; font-size: 12px; text-decoration: none; cursor: pointer;
    }}
  </style>
</head>
<body>
  <div class="shell">
    <div class="card" id="app">
      <div class="brand">
        <div class="logo" aria-hidden="true">SD</div>
        <div>
          <h1>StepDaddyLiveHD</h1>
          <p class="sub" id="greeting">Enter your access PIN</p>
        </div>
      </div>
      <div class="dest"><span>Unlock to</span> {dest}</div>
      <div class="dots" id="dots" aria-hidden="true"></div>
      <div class="display" id="display">PIN</div>
      <div class="pad" role="group" aria-label="PIN keypad">
        <button type="button" data-digit="1">1</button>
        <button type="button" data-digit="2">2</button>
        <button type="button" data-digit="3">3</button>
        <button type="button" data-digit="4">4</button>
        <button type="button" data-digit="5">5</button>
        <button type="button" data-digit="6">6</button>
        <button type="button" data-digit="7">7</button>
        <button type="button" data-digit="8">8</button>
        <button type="button" data-digit="9">9</button>
        <button type="button" class="action" id="clear">Clear</button>
        <button type="button" data-digit="0">0</button>
        <button type="button" class="action" id="back" aria-label="Backspace">⌫</button>
        <button type="button" class="enter" id="submit">Unlock</button>
      </div>

      <div class="opts">
        <div class="row">
          <label for="rememberDevice">
            <input type="checkbox" id="rememberDevice" checked/>
            <span>Remember this device
              <small>Stay signed in on this phone / TV browser</small>
            </span>
          </label>
        </div>
        <div>
          <select class="ttl" id="sessionTtl" aria-label="Session length">
            <option value="30d" selected>Keep unlocked for 30 days</option>
            <option value="7d">Keep unlocked for 7 days</option>
            <option value="1d">Keep unlocked for 1 day</option>
            <option value="session">Until I close the browser</option>
          </select>
        </div>
        <div>
          <input class="nick" id="deviceNick" maxlength="32" placeholder="Device name (optional) — Living room TV"/>
        </div>
        <div class="row">
          <label for="autoSubmit">
            <input type="checkbox" id="autoSubmit" checked/>
            <span>Auto-unlock
              <small>Submit when PIN looks complete</small>
            </span>
          </label>
        </div>
      </div>

      <div class="err" id="err" role="status" aria-live="polite"></div>
      <p class="hint">Household PIN · one active session per guest PIN · pull down to reload</p>
      <div class="quick">
        <a href="/auth?next=/tv/">TV guide</a>
        <a href="/auth?next=/play">Live player</a>
        <button type="button" class="link" id="installHintBtn" hidden>Install app</button>
      </div>
    </div>
  </div>
  <script>
    const NEXT = "{safe_next}";
    const DEVICE_ID = "{safe_device}";
    const MAX_LEN = 8;
    const LS_REMEMBER = "sd_auth_remember";
    const LS_TTL = "sd_auth_ttl";
    const LS_AUTO = "sd_auth_autosubmit";
    const LS_NICK = "sd_auth_device_nick";
    const LS_PIN_LEN = "sd_auth_last_pin_len";

    let pin = "";
    let submitting = false;
    let autoTimer = null;
    const display = document.getElementById("display");
    const err = document.getElementById("err");
    const app = document.getElementById("app");
    const dots = document.getElementById("dots");
    const submitBtn = document.getElementById("submit");
    const rememberEl = document.getElementById("rememberDevice");
    const ttlEl = document.getElementById("sessionTtl");
    const autoEl = document.getElementById("autoSubmit");
    const nickEl = document.getElementById("deviceNick");

    function lsGet(k, fallback) {{
      try {{
        const v = localStorage.getItem(k);
        return v == null ? fallback : v;
      }} catch (e) {{ return fallback; }}
    }}
    function lsSet(k, v) {{
      try {{ localStorage.setItem(k, v); }} catch (e) {{}}
    }}

    // Restore prefs
    rememberEl.checked = lsGet(LS_REMEMBER, "1") !== "0";
    ttlEl.value = lsGet(LS_TTL, "30d");
    autoEl.checked = lsGet(LS_AUTO, "1") !== "0";
    nickEl.value = lsGet(LS_NICK, "");
    ttlEl.disabled = !rememberEl.checked;
    const nick = (nickEl.value || "").trim();
    if (nick) document.getElementById("greeting").textContent = "Welcome back, " + nick;

    function slotCount() {{
      const last = parseInt(lsGet(LS_PIN_LEN, "4"), 10);
      return Math.min(MAX_LEN, Math.max(4, isNaN(last) ? 4 : last));
    }}
    function renderDots() {{
      const n = Math.max(slotCount(), pin.length || 4);
      dots.innerHTML = "";
      for (let i = 0; i < n; i++) {{
        const d = document.createElement("div");
        d.className = "dot" + (i < pin.length ? " filled" : "");
        dots.appendChild(d);
      }}
    }}
    function render() {{
      display.textContent = pin ? (pin.length + " digit" + (pin.length === 1 ? "" : "s")) : "PIN";
      submitBtn.disabled = !pin || submitting;
      renderDots();
    }}

    function scheduleAuto() {{
      clearTimeout(autoTimer);
      if (!autoEl.checked || !pin) return;
      const last = parseInt(lsGet(LS_PIN_LEN, "0"), 10) || 0;
      const ready = (last >= 4 && pin.length === last) || pin.length >= 6;
      if (!ready) return;
      autoTimer = setTimeout(() => submitPin(), 280);
    }}

    function pushDigit(d) {{
      if (submitting || pin.length >= MAX_LEN) return;
      pin += d;
      err.textContent = "";
      render();
      scheduleAuto();
    }}

    document.querySelectorAll("[data-digit]").forEach(btn => {{
      btn.addEventListener("click", () => pushDigit(btn.dataset.digit));
    }});
    document.getElementById("clear").addEventListener("click", () => {{
      pin = ""; err.textContent = ""; render();
    }});
    document.getElementById("back").addEventListener("click", () => {{
      pin = pin.slice(0, -1); err.textContent = ""; render();
    }});

    rememberEl.addEventListener("change", () => {{
      lsSet(LS_REMEMBER, rememberEl.checked ? "1" : "0");
      ttlEl.disabled = !rememberEl.checked;
    }});
    ttlEl.addEventListener("change", () => lsSet(LS_TTL, ttlEl.value));
    autoEl.addEventListener("change", () => lsSet(LS_AUTO, autoEl.checked ? "1" : "0"));
    nickEl.addEventListener("change", () => lsSet(LS_NICK, nickEl.value.trim()));
    nickEl.addEventListener("blur", () => lsSet(LS_NICK, nickEl.value.trim()));

    window.addEventListener("keydown", (e) => {{
      if (e.key >= "0" && e.key <= "9") {{ e.preventDefault(); pushDigit(e.key); }}
      else if (e.key === "Backspace") {{ e.preventDefault(); pin = pin.slice(0, -1); render(); }}
      else if (e.key === "Escape") {{ pin = ""; render(); }}
      else if (e.key === "Enter") {{ e.preventDefault(); submitPin(); }}
    }});

    async function submitPin() {{
      if (submitting) return;
      if (!pin) {{ err.textContent = "Enter a PIN"; return; }}
      submitting = true;
      clearTimeout(autoTimer);
      app.classList.add("loading");
      err.textContent = "";
      lsSet(LS_NICK, nickEl.value.trim());
      lsSet(LS_REMEMBER, rememberEl.checked ? "1" : "0");
      lsSet(LS_TTL, ttlEl.value);
      try {{
        const r = await fetch("/auth/verify", {{
          method: "POST",
          headers: {{ "Content-Type": "application/json" }},
          credentials: "same-origin",
          body: JSON.stringify({{
            pin,
            device_id: DEVICE_ID,
            next: NEXT,
            remember: !!rememberEl.checked,
            ttl: rememberEl.checked ? ttlEl.value : "session",
            device_name: (nickEl.value || "").trim().slice(0, 32)
          }})
        }});
        const data = await r.json().catch(() => ({{}}));
        if (r.ok && data.ok) {{
          lsSet(LS_PIN_LEN, String(pin.length));
          window.location.href = data.redirect || NEXT || "/tv/";
          return;
        }}
        err.textContent = data.error === "invalid_pin" ? "Invalid PIN — try again" : (data.message || "Login failed");
        app.classList.remove("shake");
        void app.offsetWidth;
        app.classList.add("shake");
        pin = "";
        render();
      }} catch (e) {{
        err.textContent = "Network error — try again";
      }} finally {{
        submitting = false;
        app.classList.remove("loading");
      }}
    }}

    document.getElementById("submit").addEventListener("click", submitPin);

    // Optional install affordance
    let deferredPrompt = null;
    window.addEventListener("beforeinstallprompt", (e) => {{
      e.preventDefault();
      deferredPrompt = e;
      const b = document.getElementById("installHintBtn");
      if (b) {{
        b.hidden = false;
        b.onclick = async () => {{
          if (!deferredPrompt) return;
          deferredPrompt.prompt();
          await deferredPrompt.userChoice;
          deferredPrompt = null;
          b.hidden = true;
        }};
      }}
    }});

    render();
  </script>
  <script src="/tv-assets/pull_reload.js" defer></script>
</body>
</html>"""


def render_session_ended_page() -> str:
    return """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <meta name="theme-color" content="#0b0b0b"/>
  <meta name="mobile-web-app-capable" content="yes"/>
  <title>Session Ended — StepDaddyLiveHD</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100dvh; display: grid; place-items: center;
      padding: 24px; text-align: center; color: #eee;
      font-family: ui-sans-serif, system-ui, sans-serif;
      background:
        radial-gradient(900px 500px at 50% 0%, rgba(239,68,68,0.18), transparent 55%),
        #07080c;
    }
    .box {
      max-width: 440px; width: 100%; padding: 24px 20px; border-radius: 20px;
      background: rgba(18,20,28,0.9); border: 1px solid rgba(255,255,255,0.1);
    }
    h1 { font-size: 1.25rem; margin: 0 0 10px; }
    p { color: #9aa3b2; line-height: 1.55; margin: 0 0 10px; font-size: 0.95rem; }
    .actions { display: grid; gap: 10px; margin-top: 18px; }
    a {
      display: block; padding: 14px 18px; border-radius: 12px; text-decoration: none; font-weight: 700;
    }
    a.primary { background: #16a34a; color: #fff; }
    a.ghost { background: transparent; color: #cbd5e1; border: 1px solid rgba(255,255,255,0.12); }
  </style>
</head>
<body>
  <div class="box">
    <h1>Session moved</h1>
    <p>This guest PIN is now active on another device. Only one live session is allowed per guest PIN.</p>
    <p>Unlock here to continue on this device (the other session will end).</p>
    <div class="actions">
      <a class="primary" href="/auth?next=/tv/">Unlock on this device</a>
      <a class="ghost" href="/auth?next=/play">Open live player instead</a>
    </div>
  </div>
  <script src="/tv-assets/pull_reload.js" defer></script>
</body>
</html>"""
