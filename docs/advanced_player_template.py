"""Advanced TV guide player HTML for /tv and /tv/{id}."""

from __future__ import annotations


def render_advanced_tv_page(channel_id: str | None = None) -> str:
    cid = (channel_id or "").replace("\\", "").replace('"', "")
    initial = ('"' + cid + '"') if cid else '""'
    return (
        """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,interactive-widget=resizes-content"/>
  <meta name="apple-mobile-web-app-capable" content="yes"/>
  <meta name="mobile-web-app-capable" content="yes"/>
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
  <meta name="theme-color" content="#0b0b0b"/>
  <meta name="color-scheme" content="dark"/>
  <meta name="description" content="Live TV guide, on-demand, and Watch Party — StepDaddyLiveHD"/>
  <meta property="og:type" content="website"/>
  <meta property="og:site_name" content="StepDaddyLiveHD"/>
  <meta property="og:title" content="TV Guide — StepDaddyLiveHD"/>
  <meta property="og:description" content="Watch live channels together, browse the guide, and join Watch Parties."/>
  <meta property="og:image" content="/tv-assets/icon-512.png"/>
  <meta name="twitter:card" content="summary"/>
  <meta name="twitter:title" content="TV Guide — StepDaddyLiveHD"/>
  <meta name="twitter:description" content="Live TV, VOD, and Watch Party"/>
  <link rel="canonical" href="/tv/"/>
  <link rel="manifest" href="/tv-assets/site.webmanifest"/>
  <link rel="apple-touch-icon" href="/tv-assets/icon-192.png"/>
  <title>TV Guide — StepDaddyLiveHD</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js"></script>
  <link rel="stylesheet" href="/tv-assets/player.css?v=20260911e"/>
  <link rel="stylesheet" href="/tv-assets/player_guide_sheet.css?v=20260911e"/>
  <link rel="stylesheet" href="/tv-assets/player_features.css?v=20260911e"/>
  <link rel="stylesheet" href="/tv-assets/player_cinema.css?v=20260911e"/>
  <link rel="stylesheet" href="/tv-assets/music_radio.css?v=20260911e"/>
  <link rel="stylesheet" href="/tv-assets/music_listen.css?v=20260911e"/>
  <link rel="stylesheet" href="/tv-assets/music_library.css?v=20260911e"/>
  <link rel="stylesheet" href="/tv-assets/music_home.css?v=20260911e"/>
  <link rel="stylesheet" href="/tv-assets/music_player.css?v=20260911e"/>
  <link rel="stylesheet" href="/tv-assets/music_search.css?v=20260911e"/>
  <script src="/tv-assets/pull_reload.js" defer></script>
  <script src="/tv-assets/mobile_shell.js" defer></script>
"""
        + """</head>
<body>
  <div class="tv-root" id="tvRoot" data-theme="cinema">
  <script>try{var r=document.getElementById("tvRoot");var t=localStorage.getItem("sd_tv_theme");if(t)r.dataset.theme=t;var c=localStorage.getItem("sd_ui_calm");if(c==="0")r.dataset.calm="0";var pt=localStorage.getItem("sd_player_theme");if(pt)r.dataset.playerTheme=pt;}catch(e){}</script>
  <script>try{var q=new URLSearchParams(location.search);var pc=(q.get("party")||"").toUpperCase();if(pc)sessionStorage.setItem("sd_party_pending",pc);var pn=q.get("name");if(pn){sessionStorage.setItem("sd_party_name_pending",pn);localStorage.setItem("sd_party_name",pn);}}catch(e){}</script>
    <div class="video-area" id="videoArea">
      <video id="v" class="bg-video" playsinline webkit-playsinline x-webkit-airplay="allow" airplay="allow" muted autoplay></video>
      <div class="bg-shade"></div>
      <div class="cinema-overlay" id="cinemaOverlay" aria-hidden="true">
        <div class="cinema-overlay-inner">
          <img class="cinema-poster-lg" id="cinemaPosterLg" alt="" loading="lazy" decoding="async"/>
          <div class="cinema-poster-ph" id="cinemaPosterPh" aria-hidden="true">TV</div>
          <div class="cinema-meta">
            <h2 class="cinema-title" id="cinemaTitle"></h2>
            <p class="cinema-overview" id="cinemaOverview"></p>
            <p class="cinema-sub" id="cinemaSub"></p>
            <p class="cinema-time" id="cinemaTime"></p>
          </div>
        </div>
      </div>
      <div class="collapsed-chrome chrome-hidden" id="collapsedChrome" aria-hidden="true">
        <div class="ch-title hdr-block" id="chromeHdr" data-layout="standard">
          <img class="hdr-poster" id="chromePoster" alt="" loading="lazy" decoding="async"/>
          <div class="hdr-text">
            <div class="hdr-onair" id="chromeOnAir"><span class="hdr-ch" id="chromeCh">Loading…</span></div>
            <div class="sub hdr-chnum" id="chromeSub"></div>
          </div>
        </div>
        <div class="chrome-hint">Tap for controls</div>
        <button type="button" class="btn-search-chrome" id="searchBtnChrome" aria-label="Search channels, guide, and VOD" title="Search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        </button>
      </div>
      <div class="live-edge-chrome" id="liveEdgeChrome" hidden>
        <span class="live-now-pill" id="liveNowPill" title="Live" aria-hidden="true">LIVE</span>
      </div>
      <div class="loading-bar" id="loadBar"></div>
      <div class="buffer-overlay" id="bufferOverlay" aria-live="polite" aria-hidden="true">
        <div class="buffer-spinner" aria-hidden="true"></div>
        <div class="buffer-status" id="bufferStatus">Loading…</div>
      </div>
      <div class="tap-play" id="tapPlay">Tap to play</div>
      <button type="button" class="tap-play" id="unmuteBtn">Tap for sound</button>
      <div class="err-toast" id="errToast"></div>
      <div class="trailer-layer" id="trailerLayer" aria-hidden="true">
        <button type="button" class="trailer-back-btn" id="trailerBackBtn">← Back to live</button>
        <button type="button" class="live-embed-guide-hotspot" id="liveEmbedGuideHotspot" aria-label="Toggle TV guide" hidden></button>
        <div class="vod-ep-chrome" id="vodEpChrome" hidden>
          <button type="button" class="vod-ep-nav" id="vodEpPrev" aria-label="Previous episode">‹ Prev</button>
          <div class="vod-ep-meta">
            <div class="vod-ep-label" id="vodEpLabel">S1 · E1</div>
            <div class="vod-ep-name" id="vodEpName"></div>
          </div>
          <button type="button" class="vod-ep-nav" id="vodEpNext" aria-label="Next episode">Next ›</button>
          <button type="button" class="vod-ep-auto" id="vodEpAutoBtn" aria-pressed="true" title="Auto-play next episode">Auto</button>
        </div>
        <div class="vod-ep-hotzone" id="vodEpHotzone" aria-hidden="true"></div>
        <div class="vod-ep-nextup" id="vodEpNextUp" hidden>
          <div class="vod-ep-nextup-card">
            <div class="kicker">Up next</div>
            <div class="ep" id="vodEpNextUpTitle">Episode</div>
            <div class="actions">
              <button type="button" class="ghost" id="vodEpNextUpCancel">Cancel</button>
              <button type="button" class="primary" id="vodEpNextUpPlay">Play now</button>
            </div>
            <div class="bar" aria-hidden="true"><div class="fill" id="vodEpNextUpFill"></div></div>
          </div>
        </div>
        <div class="vod-stream-status" id="vodStreamStatus" hidden>Finding stream…</div>
        <div class="trailer-frame-wrap">
          <iframe id="trailerFrame" title="Trailer player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
        </div>
        <div class="vod-start-gate" id="vodStartGate" hidden>
          <button type="button" class="vod-start-gate-btn" id="vodStartGateBtn">
            <span class="icon" aria-hidden="true">▶</span>
            <span class="label" id="vodStartGateLabel">Tap to start</span>
            <span class="sub" id="vodStartGateSub"></span>
          </button>
          <button type="button" class="vod-start-gate-alt" id="vodStartGateSources">Choose source</button>
          <button type="button" class="vod-start-gate-alt danger" id="vodStartGateEmbed" hidden>Use embed (may have ads)</button>
        </div>
      </div>
      <div class="xray-backdrop" id="xrayBackdrop" aria-hidden="true"></div>
      <aside class="xray-panel" id="xrayPanel" aria-label="Programme info" aria-hidden="true">
        <div class="xray-head">
          <span class="label">X-Ray</span>
          <span class="badge">TMDB</span>
          <span class="spacer"></span>
          <button type="button" class="xray-close" id="xrayClose" aria-label="Close info">×</button>
        </div>
        <div class="xray-scroll" id="xrayScroll"></div>
      </aside>
    </div>
    <button type="button" class="show-guide-btn show-guide-btn--incognito" id="showGuideBtn" aria-label="Show guide" title="Show guide">
      <span class="show-guide-chev" aria-hidden="true">⌃</span>
      <span class="show-guide-hint" id="showGuideHint" hidden>Guide</span>
    </button>
    <div class="epg-panel" id="epgPanel">
      <div class="guide-sheet-handle" id="guideSheetHandle" role="slider" aria-label="Resize TV guide" aria-valuemin="0" aria-valuemax="2" aria-valuenow="1" tabindex="0">
        <span class="guide-sheet-grip" aria-hidden="true"></span>
      </div>
      <div class="top-bar">
        <img class="hdr-poster" id="hdrPoster" alt="" loading="lazy" decoding="async"/>
        <div class="title hdr-block" id="nowTitle" data-layout="standard">
          <div class="hdr-onair" id="nowOnAir"><span class="hdr-ch" id="nowCh">Loading…</span></div>
          <div class="sub hdr-chnum" id="nowSub"></div>
        </div>
        <div class="top-actions">
          <div class="action-group action-group-tools" aria-label="Browse">
            <a class="btn-icon" href="/play" id="dirLink" aria-label="Channel directory" title="Channels">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="13" width="7" height="7" rx="1.5"/><rect x="14" y="13" width="7" height="7" rx="1.5"/></svg>
            </a>
            <button type="button" class="btn-icon" id="vodCatalogBtn" aria-label="VOD catalog" title="VOD">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 4v16M17 4v16M2 8h5M2 12h5M2 16h5M17 8h5M17 12h5M17 16h5"/></svg>
            </button>
            <button type="button" class="btn-icon" id="musicCatalogBtn" aria-label="Music" title="Music">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            </button>
            <button type="button" class="btn-icon" id="partyHomeBtn" aria-label="Watch Party home" title="Watch Party">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </button>
            <button type="button" class="btn-icon" id="searchBtn" aria-label="Search channels, guide, and VOD" title="Search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
            </button>
            <button type="button" class="btn-icon" id="xrayBtn" aria-label="X-Ray programme info" title="X-Ray info">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6"/><path d="M17 11h5M19.5 8.5v5"/></svg>
            </button>
            <button type="button" class="btn-icon" id="settingsBtn" aria-label="Settings" title="Settings">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            </button>
            <button type="button" class="btn-icon" id="castBtn" aria-label="Cast" title="Cast / AirPlay">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 16.1A5 5 0 0 1 5.9 20"/><path d="M2 12.05A9 9 0 0 1 9.95 20"/><path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/><circle cx="2" cy="20" r="0.01" fill="currentColor" stroke="none"/></svg>
            </button>
          </div>
          <div class="action-divider" aria-hidden="true"></div>
          <div class="action-group action-group-view" aria-label="Guide view">
            <button type="button" class="btn-guide-toggle" id="guideToggle" aria-expanded="true" aria-label="Hide TV guide" title="Collapse / expand guide">
              <span class="chev" aria-hidden="true">▼</span>
              <span class="toggle-label">Hide</span>
            </button>
            <a class="sr-only" href="#" id="simpleLink" tabindex="-1" aria-hidden="true">Simple</a>
            <div class="guide-more-wrap">
              <button type="button" class="btn-icon guide-more-btn" id="guideMoreBtn" aria-label="More actions" aria-haspopup="menu" aria-expanded="false" title="More">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
              </button>
              <div class="guide-more-menu" id="guideMoreMenu" role="menu" hidden>
                <button type="button" role="menuitem" data-guide-action="share">Share / remote</button>
                <button type="button" role="menuitem" data-guide-action="cast">Cast / AirPlay</button>
                <button type="button" role="menuitem" data-guide-action="settings">Settings</button>
                <button type="button" role="menuitem" data-guide-action="simple">Simple player</button>
                <button type="button" role="menuitem" data-guide-action="party">Watch Party</button>
                <button type="button" role="menuitem" data-guide-action="music">Music</button>
                <button type="button" role="menuitem" data-guide-action="search">Search</button>
                <button type="button" role="menuitem" data-guide-action="cinema">Cinema layout</button>
                <button type="button" role="menuitem" data-guide-action="theme">Cycle theme</button>
                <button type="button" role="menuitem" data-guide-action="report">Report</button>
                <button type="button" role="menuitem" data-guide-action="collapse">Collapse guide</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="epg-head">
        <div class="day-col" id="dayLabel">Today</div>
        <div class="time-scroll" id="timeScroll">
          <div class="time-row" id="timeRow"></div>
        </div>
      </div>
      <div class="epg-body" id="epgBody">
        <aside class="cat-drawer" id="catDrawer" aria-hidden="true" aria-label="Channel categories">
          <div class="cat-drawer-head">Categories</div>
          <div class="cat-drawer-scroll" id="catDrawerList" role="listbox" aria-label="Filter guide by category"></div>
        </aside>
        <button type="button" class="cat-drawer-tab" id="catDrawerTab" aria-controls="catDrawer" aria-expanded="false" aria-label="Open categories" title="Categories (C)">
          <span class="cat-drawer-tab-grip" aria-hidden="true"></span>
          <svg class="cat-drawer-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        </button>
        <button type="button" class="cat-drawer-scrim" id="catDrawerScrim" aria-label="Close categories" hidden></button>
        <div class="ch-scroll" id="chScroll">
          <div class="virtual-wrap" id="chWrap"></div>
        </div>
        <div class="grid-scroll" id="gridScroll">
          <div class="virtual-wrap" id="gridWrap"></div>
        </div>
      </div>
    </div>
  </div>
  <div class="search-backdrop" id="searchBackdrop"></div>
  <div class="search-drawer" id="searchDrawer" role="dialog" aria-label="Search">
    <div class="search-drawer-head">
      <h2>Search</h2>
      <div class="search-row">
        <div class="search-input-wrap">
          <input id="searchInput" type="search" placeholder="Channels, TV guide, movies &amp; shows…" autocomplete="off" enterkeyhint="search"/>
          <button type="button" class="search-mic-btn" id="searchMicBtn" aria-label="Voice search" title="Voice search" aria-pressed="false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/><path d="M8 22h8"/></svg>
          </button>
        </div>
        <button type="button" class="btn-link" id="closeSearch" aria-label="Close search">✕</button>
      </div>
    </div>
    <div class="search-drawer-body" id="searchDrawerBody">
      <div class="search-quick" id="searchQuick">
        <div class="section-label">Recent searches</div>
        <div class="search-recent-tags" id="searchRecentTags"></div>
        <div class="section-label">Favorites</div>
        <div id="favList"></div>
        <div class="section-label">Recent channels</div>
        <div id="recentList"></div>
      </div>
      <div id="searchResults"><div class="search-empty">Search live channels, TV guide listings, and VOD</div></div>
    </div>
  </div>
  <div class="title-hover-card" id="titleHoverCard" role="tooltip" aria-hidden="true"></div>
  <div class="settings-backdrop" id="settingsBackdrop"></div>
  <aside class="settings-drawer" id="settingsDrawer" role="dialog" aria-label="Settings">
    <div class="settings-head">
      <h2>Settings</h2>
      <button type="button" class="btn-link" id="closeSettings" aria-label="Close settings">✕</button>
    </div>
    <div class="settings-body">
      <div class="settings-section">
        <h3>Appearance</h3>
        <div class="theme-grid" id="themeGrid">
          <button type="button" class="theme-opt" data-theme="cinema">
            <div class="swatch swatch-cinema"></div>
            <span class="name">Minimal Cinema</span>
            <span class="desc">Video-first, thin chrome, overlay metadata</span>
          </button>
          <button type="button" class="theme-opt" data-theme="standard">
            <div class="swatch swatch-standard"></div>
            <span class="name">Standard</span>
            <span class="desc">Original balanced layout</span>
          </button>
          <button type="button" class="theme-opt" data-theme="glass">
            <div class="swatch swatch-glass"></div>
            <span class="name">Glass Premium</span>
            <span class="desc">Frosted panels, soft glow, depth</span>
          </button>
          <button type="button" class="theme-opt" data-theme="broadcast">
            <div class="swatch swatch-broadcast"></div>
            <span class="name">Broadcast Pro</span>
            <span class="desc">Cable-box EPG, high contrast</span>
          </button>
        </div>
        <label class="setting-row" for="calmUiToggle" style="margin-top:10px">
          <span class="setting-label">Calm interface
            <span class="setting-sub">Dim idle chrome; reveal on hover</span>
          </span>
          <input type="checkbox" id="calmUiToggle" checked/>
        </label>
      </div>

      <div class="settings-section">
        <h3>Live TV</h3>
        <label class="setting-row" for="useDaddyliveToggle">
          <span class="setting-label">Use DaddyLive channels
            <span class="setting-sub">On by default — gray-out / skip if CDN ToS-blocked; Free-TV / iptv / Dulo / ntv always stay on</span>
          </span>
          <input type="checkbox" id="useDaddyliveToggle"/>
        </label>
        <label class="setting-row" for="skipCdnBlockedToggle">
          <span class="setting-label">Skip CDN-blocked channels
            <span class="setting-sub">Off = keep selection on grayed rows. On = jump to nearest working channel</span>
          </span>
          <input type="checkbox" id="skipCdnBlockedToggle"/>
        </label>
        <label class="setting-row" for="rememberChannelToggle">
          <span class="setting-label">Remember last channel
            <span class="setting-sub">Open the channel you watched last</span>
          </span>
          <input type="checkbox" id="rememberChannelToggle" checked/>
        </label>
        <label class="setting-row" for="liveStartMutedToggle">
          <span class="setting-label">Start muted
            <span class="setting-sub">Off = try sound first on TV guide (fallback muted if blocked)</span>
          </span>
          <input type="checkbox" id="liveStartMutedToggle"/>
        </label>
        <label class="setting-row" for="guideCollapsedToggle">
          <span class="setting-label">Collapse guide by default
            <span class="setting-sub">Cinema-style full video on load</span>
          </span>
          <input type="checkbox" id="guideCollapsedToggle"/>
        </label>
        <label class="setting-row" for="paintEmbedToggle">
          <span class="setting-label">Decoder glitch → backup player
            <span class="setting-sub">If live video freezes green/black, switch to the embed player after a wait</span>
          </span>
          <input type="checkbox" id="paintEmbedToggle" checked/>
        </label>
        <p class="setting-hint tight">How long to wait before switching (Default = 60s)</p>
        <div class="setting-seg" id="paintGraceSeg" role="radiogroup" aria-label="Decoder glitch wait time">
          <button type="button" class="seg-opt" data-grace="short" aria-pressed="false">Short (~15s)</button>
          <button type="button" class="seg-opt active" data-grace="default" aria-pressed="true">Default (~60s)</button>
          <button type="button" class="seg-opt" data-grace="patient" aria-pressed="false">Patient (~90s)</button>
        </div>
        <p class="setting-hint" id="paintGraceHint">Default (~60s): watch dead paint this long before backup/embed; brief flashes stay temporary.</p>
      </div>

      <div class="settings-section">
        <h3>On demand</h3>
        <p class="setting-hint tight">When you press Play on a title</p>
        <div class="setting-seg" id="vodSourceModeSeg" role="radiogroup" aria-label="Source mode">
          <button type="button" class="seg-opt active" data-mode="auto" aria-pressed="true">Auto</button>
          <button type="button" class="seg-opt" data-mode="manual" aria-pressed="false">Manual</button>
        </div>
        <p class="setting-hint" id="vodSourceModeHint">Auto tries a direct stream first, then an embed if needed. Manual opens the source picker.</p>
        <label class="setting-row" for="vodDirectHlsToggle" id="vodDirectHlsRow">
          <span class="setting-label">Prefer direct HLS
            <span class="setting-sub">Try native stream in our player before any embed</span>
          </span>
          <input type="checkbox" id="vodDirectHlsToggle" checked/>
        </label>
        <label class="setting-row" for="vodHlsOnlyToggle" id="vodHlsOnlyRow">
          <span class="setting-label">HLS only (no auto embed)
            <span class="setting-sub">Off = previous: fall back to embed. On = never auto-open adware iframes</span>
          </span>
          <input type="checkbox" id="vodHlsOnlyToggle"/>
        </label>
        <label class="setting-row" for="vodTrailerAutoplayToggle">
          <span class="setting-label">Autoplay trailers
            <span class="setting-sub">Play YouTube trailer on the detail hero</span>
          </span>
          <input type="checkbox" id="vodTrailerAutoplayToggle" checked/>
        </label>
        <label class="setting-row" for="vodTrailerMutedToggle">
          <span class="setting-label">Trailers start muted
            <span class="setting-sub">Tap the mute button for sound</span>
          </span>
          <input type="checkbox" id="vodTrailerMutedToggle" checked/>
        </label>
        <label class="setting-row" for="vodAutoNextToggle">
          <span class="setting-label">Auto-play next episode
            <span class="setting-sub">After an episode ends, continue the series</span>
          </span>
          <input type="checkbox" id="vodAutoNextToggle" checked/>
        </label>
        <p class="setting-hint tight">When you press Play on a series</p>
        <div class="setting-seg" id="vodSeriesPlaySeg" role="radiogroup" aria-label="Series play default">
          <button type="button" class="seg-opt active" data-mode="latest" aria-pressed="true">Latest aired</button>
          <button type="button" class="seg-opt" data-mode="progressive" aria-pressed="false">Continue</button>
        </div>
        <p class="setting-hint" id="vodSeriesPlayHint">Play opens the newest episode that has already aired.</p>
        <label class="setting-row" for="vodLangSelect">
          <span class="setting-label">Preferred language
            <span class="setting-sub">Default English; hide other-language sources in Auto</span>
          </span>
          <select id="vodLangSelect" aria-label="Preferred audio language">
            <option value="en" selected>English</option>
            <option value="multi">Any / Multi</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="pt">Portuguese</option>
            <option value="ru">Russian</option>
            <option value="hi">Hindi</option>
          </select>
        </label>
      </div>

      <div class="settings-section">
        <h3>Library &amp; sync</h3>
        <p class="setting-hint" id="traktStatusHint">Trakt: checking…</p>
        <div class="vod-trakt-panel" id="traktSettingsPanel">
          <button type="button" id="traktConnectBtn">Connect Trakt</button>
          <button type="button" class="secondary" id="traktLogoutBtn" style="display:none">Disconnect</button>
          <div class="vod-trakt-code" id="traktDeviceHint" style="display:none"></div>
        </div>
      </div>

      <div class="settings-section">
        <h3>Data</h3>
        <p class="setting-hint">Stored only in this browser.</p>
        <div class="setting-actions">
          <button type="button" id="clearRecentsBtn">Clear recent channels</button>
          <button type="button" id="clearSearchRecentBtn">Clear search history</button>
          <button type="button" class="danger" id="clearFavoritesBtn">Clear favorites</button>
        </div>
      </div>
    </div>
  </aside>
  <div class="vod-picker-backdrop" id="vodPickerBackdrop"></div>
  <div class="vod-picker" id="vodPicker" role="dialog" aria-label="On demand sources">
    <div class="vod-picker-head">
      <h2 id="vodPickerTitle">On demand</h2>
      <button type="button" class="btn-link" id="closeVodPicker" aria-label="Close">✕</button>
    </div>
    <div class="vod-picker-body" id="vodSourceList"></div>
  </div>
  <div class="vod-catalog-backdrop" id="vodCatalogBackdrop"></div>
  <div class="vod-catalog" id="vodCatalog" role="dialog" aria-label="VOD catalog">
    <div class="vod-catalog-head">
      <a class="vod-brand" id="vodHomeBrand" href="/vod" title="VOD home">VOD</a>
      <div class="search-input-wrap vod-search-wrap">
        <input class="vod-catalog-search" id="vodCatalogSearch" type="search" placeholder="Search movies &amp; TV…" autocomplete="off"/>
        <button type="button" class="search-mic-btn" id="vodCatalogMicBtn" aria-label="Voice search" title="Voice search" aria-pressed="false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/><path d="M8 22h8"/></svg>
        </button>
      </div>
      <button type="button" class="btn-link" id="closeVodCatalog" aria-label="Close VOD">✕</button>
    </div>
    <div class="vod-catalog-tabs" id="vodCatalogTabs">
      <button type="button" class="vod-tab active" data-tab="home">Home</button>
      <button type="button" class="vod-tab" data-tab="movie">Movies</button>
      <button type="button" class="vod-tab" data-tab="tv">TV Shows</button>
    </div>
    <div class="vod-provider-bar" id="vodProviderBar" aria-label="Streaming providers"></div>
    <div class="vod-filter-bar" id="vodFilterBar">
      <div class="vod-filter-group">
        <span class="vod-filter-label">Sort</span>
        <select id="vodSortSelect" aria-label="Sort by">
          <option value="popularity.desc">Popular</option>
          <option value="vote_average.desc">Top rated</option>
          <option value="release_date.desc">Newest</option>
          <option value="release_date.asc">Oldest</option>
        </select>
      </div>
      <div class="vod-filter-group">
        <span class="vod-filter-label">Genre</span>
        <select id="vodGenreSelect" aria-label="Filter by genre"><option value="">All genres</option></select>
      </div>
      <div class="vod-filter-group">
        <span class="vod-filter-label">Year</span>
        <select id="vodYearSelect" aria-label="Filter by year">
          <option value="">Any year</option>
          <option value="2020-2026">2020+</option>
          <option value="2010-2019">2010–2019</option>
          <option value="2000-2009">2000–2009</option>
          <option value="1990-1999">1990–1999</option>
          <option value="1900-1989">Before 1990</option>
        </select>
      </div>
      <div class="vod-filter-group">
        <span class="vod-filter-label">Rating</span>
        <select id="vodRatingSelect" aria-label="Minimum rating">
          <option value="">Any rating</option>
          <option value="9">9+ stars</option>
          <option value="8">8+ stars</option>
          <option value="7">7+ stars</option>
          <option value="6">6+ stars</option>
        </select>
      </div>
    </div>
    <div class="vod-catalog-body" id="vodCatalogBody"></div>
    <div class="vod-detail" id="vodDetail">
      <div class="vod-detail-hero" id="vodDetailHero"></div>
      <div class="vod-detail-scroll" id="vodDetailScroll"></div>
    </div>
  </div>
  <div class="vod-catalog-backdrop" id="musicCatalogBackdrop"></div>
  <div class="vod-catalog music-home" id="musicCatalog" role="dialog" aria-modal="true" aria-label="Music" aria-hidden="true">
    <div class="vod-catalog-head music-home-head">
      <a class="vod-brand music-brand" id="musicHomeBrand" href="/music" title="Music home">Music</a>
      <div class="music-home-tabs" id="musicCatalogTabs" role="tablist" aria-label="Music sections">
        <button type="button" class="music-home-tab active" role="tab" aria-selected="true" data-music-tab="home" id="musicTabHome">Home</button>
        <button type="button" class="music-home-tab" role="tab" aria-selected="false" data-music-tab="radio" id="musicTabRadio">Radio</button>
        <button type="button" class="music-home-tab" role="tab" aria-selected="false" data-music-tab="listen" id="musicTabListen">Listen</button>
      </div>
      <button type="button" class="btn-link" id="closeMusicCatalog" aria-label="Close Music">✕</button>
    </div>
    <div class="music-unified-search-wrap" id="musicUnifiedSearch" data-music-search></div>
    <div class="music-chip-rail" id="musicChipRail" aria-label="Music focus">
      <div class="music-focus-chips-host" id="musicFocusChipsHost" data-music-focus-host></div>
    </div>
    <div class="vod-catalog-body music-home-body" id="musicCatalogBody">
      <section class="music-home-panel" id="musicPanelHome" data-music-panel="home">
        <div id="musicHomeRoot" data-music-home></div>
      </section>
      <section class="music-home-panel" id="musicPanelRadio" data-music-panel="radio" hidden>
        <div id="musicRadioRoot" data-music-radio></div>
      </section>
      <section class="music-home-panel" id="musicPanelListen" data-music-panel="listen" hidden>
        <div id="musicListenRoot" data-music-listen></div>
      </section>
    </div>
  </div>
  <div class="vod-catalog-backdrop" id="partyHomeBackdrop"></div>
  <div class="vod-catalog party-home" id="partyHome" role="dialog" aria-modal="true" aria-label="Watch Party home" aria-hidden="true">
    <div class="vod-catalog-head party-home-head">
      <h2>Watch Party</h2>
      <button type="button" class="btn-link" id="closePartyHome" aria-label="Close Watch Party">✕</button>
    </div>
    <div class="vod-catalog-body party-home-body" id="partyHomeBody">
      <section class="party-home-panel party-home-hero" id="partyHomeHero">
        <p class="party-home-lede">Watch together — create a room, enter a code, or jump into something nearby.</p>
        <div class="party-home-cta" role="group" aria-label="Party actions">
          <button type="button" class="party-home-btn party-home-cta-btn" id="partyHomeCtaCreate" aria-expanded="false" aria-controls="partyHomeCreatePanel">Create party</button>
          <button type="button" class="party-home-btn secondary party-home-cta-btn" id="partyHomeCtaJoin" aria-expanded="false" aria-controls="partyHomeJoinPanel">Enter code</button>
        </div>
      </section>
      <section class="party-home-panel party-home-create" id="partyHomeCreatePanel" hidden>
        <h3>Create a party</h3>
        <p class="party-home-muted">Name it, choose public or private, then start on live TV or VOD.</p>
        <label class="party-home-field" for="partyHomeCreateName">Room name</label>
        <input id="partyHomeCreateName" maxlength="64" placeholder="Friday night · Room …" autocomplete="off"/>
        <label class="party-home-field" for="partyHomeCreateGuest">Your display name</label>
        <input id="partyHomeCreateGuest" maxlength="32" placeholder="Guest" autocomplete="nickname"/>
        <label class="party-home-check"><input type="checkbox" id="partyHomeCreatePublic" checked/> Public room (browseable on this PIN)</label>
        <label class="party-home-field" for="partyHomeCreatePassword">Password <span class="party-home-optional">(optional)</span></label>
        <input id="partyHomeCreatePassword" type="password" maxlength="64" placeholder="Leave blank for open room" autocomplete="new-password"/>
        <div class="party-home-actions">
          <button type="button" class="party-home-btn" id="partyHomeCreateNow">Create on this channel</button>
          <button type="button" class="party-home-btn secondary" id="partyHomeStartLive">Start on live TV</button>
          <button type="button" class="party-home-btn secondary" id="partyHomeStartVod">Start from VOD</button>
          <button type="button" class="party-home-btn secondary" id="partyHomeStartLast" hidden>Start on last channel</button>
        </div>
        <p class="party-home-err" id="partyHomeCreateErr" role="status"></p>
      </section>
      <section class="party-home-panel party-home-join" id="partyHomeJoinPanel" hidden>
        <h3>Enter code</h3>
        <form class="party-home-row" id="partyHomeJoinForm">
          <input id="partyHomeJoinCode" placeholder="Party code" maxlength="8" autocomplete="off" spellcheck="false" aria-label="Party code"/>
          <input id="partyHomeJoinName" placeholder="Display name" maxlength="32" autocomplete="nickname" aria-label="Display name"/>
          <button type="submit">Join</button>
        </form>
        <p class="party-home-err" id="partyHomeJoinErr" role="status"></p>
      </section>
      <section class="party-home-panel" id="partyHomeNearbyPanel">
        <h3>Nearby on this Wi‑Fi</h3>
        <p class="party-home-muted">Rooms announcing on this network. Locked rooms still need a password.</p>
        <div class="party-home-grid cards" id="partyHomeNearbyList"><p class="party-home-empty">Checking…</p></div>
      </section>
      <section class="party-home-panel" id="partyHomeContinuePanel">
        <h3>Continue / recent</h3>
        <div class="party-home-grid cards" id="partyHomeContinueList"><p class="party-home-empty">Loading…</p></div>
      </section>
      <section class="party-home-panel" id="partyHomePublicPanel">
        <h3>Live public parties</h3>
        <div class="party-home-grid cards" id="partyHomePublicList"><p class="party-home-empty">Loading…</p></div>
      </section>
      <section class="party-home-panel" id="partyHomeOnlinePanel">
        <h3>Who’s watching</h3>
        <p class="party-home-pill"><span class="party-home-dot" aria-hidden="true"></span> <span id="partyHomeOnlineSummary">Checking…</span></p>
        <div class="party-home-grid" id="partyHomeOnlineList"></div>
      </section>
      <footer class="party-home-footer">
        <a href="/tv/" class="party-home-footer-link">TV Guide</a>
        <span aria-hidden="true">·</span>
        <span class="party-home-footer-hint">Invite tips: share the link, or use Wi‑Fi nearby from inside a party.</span>
      </footer>
    </div>
  </div>
"""
        + """  <script>window.SD_INITIAL_CHANNEL = """ + initial + """;</script>
  <script>window.__SD_BUNDLE_VERSION = "20260911e";</script>
  <script src="/tv-assets/pin_unlock.js?v=20260911e"></script>
  <script src="/tv-assets/player_bundle.js?v=20260911e"></script>
</body>
</html>
"""
    )
