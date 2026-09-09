    const INITIAL_CHANNEL = window.SD_INITIAL_CHANNEL || "";
    const LS_LAST = "sd_last_tv_channel";
    const LS_LAST_PLACE = "sd_last_place";
    const LS_RECENT = "sd_recents";
    const LS_FAV = "sd_favorites";
    const LS_GUIDE_CATEGORY = "sd_guide_category";
    const LS_SEARCH_RECENT = "sd_search_recent";
    const CAT_DRAWER_W = 168;
    const CAT_OPEN_THRESHOLD = 0.38;
    const FACET_LABELS = {
      genre: {
        sports: "Sports", news: "News", movies: "Movies", entertainment: "Entertainment",
        kids: "Kids", documentary: "Documentary", animation: "Animation", music: "Music",
        lifestyle: "Lifestyle", religious: "Religious", shopping: "Shopping",
        education: "Education", weather: "Weather", general: "General",
      },
      distributor: {
        daddylive: "DaddyLive", pluto: "Pluto", samsung: "Samsung TV Plus", tubi: "Tubi",
        xumo: "Xumo", roku: "Roku", plex: "Plex", freetv: "Free-TV", iptv_org: "iptv-org",
        dulo: "Dulo", ntv: "NTV", adultswim: "Adult Swim", stirr: "Stirr", rakuten: "Rakuten",
        firetv: "Fire TV", tcl: "TCL", vizio: "Vizio", sofast: "SoFast", bbc: "BBC",
      },
      country: {
        US: "United States", UK: "United Kingdom", CA: "Canada", AU: "Australia",
        IE: "Ireland", MX: "Mexico", ES: "Spain", FR: "France", DE: "Germany",
        IT: "Italy", PT: "Portugal", BR: "Brazil", NL: "Netherlands", JP: "Japan",
        IN: "India", LATAM: "Latin America",
      },
      language: {
        en: "English", es: "Spanish", fr: "French", de: "German", it: "Italian",
        pt: "Portuguese", nl: "Dutch", ja: "Japanese", hi: "Hindi", ar: "Arabic",
      },
    };
    const LEGACY_TAG_TO_GENRE = {
      "#sports": "sports", "#entertainment": "entertainment", "#movies": "movies",
      "#news": "news", "#kids": "kids", "#documentary": "documentary",
      "#premium": "entertainment", "#football": "sports", "#animation": "animation",
      "#international": "general", "#regional": "general", "#general": "general",
    };
    const LS_VOD_QUEUE = "sd_vod_detail_queue";
    const LS_VOD_TRAILER_MUTED = "sd_vod_trailer_muted";
    const VOD_TRAILER_SOUND_AFTER = 3;
    const VOD_TRAILER_MAX_LOOPS = 3;
    const LS_GUIDE = "sd_tv_guide_collapsed";
    const LS_GUIDE_SHEET = "sd_guide_sheet_snap";
    const GUIDE_SHEET_SNAPS = ["peek", "mid", "expanded"];
    const GUIDE_SHEET_VH = { peek: 26, mid: 45, expanded: 62 };
    const GUIDE_VIDEO_MIN_VH = 32;
    const LS_THEME = "sd_tv_theme";
    const LS_VOD_DIRECT = "sd_vod_direct_hls";
    const LS_VOD_HLS_ONLY = "sd_vod_hls_only";
    const LS_VOD_SOURCE_MODE = "sd_vod_source_mode";
    const LS_VOD_TRAILER_AUTOPLAY = "sd_vod_trailer_autoplay";
    const LS_VOD_AUTO_NEXT = "sd_vod_auto_next";
    const LS_VOD_LANG = "sd_vod_prefer_lang";
    const LS_VOD_SERIES_PLAY = "sd_vod_series_play_mode"; // latest | progressive
    const DEFAULT_VOD_SERIES_PLAY = "latest";
    const LS_UI_CALM = "sd_ui_calm";
    const LS_REMEMBER_CHANNEL = "sd_remember_channel";
    const LS_LIVE_START_MUTED = "sd_live_start_muted";
    const LS_LIVE_START_MUTED_PREF = "sd_live_start_muted_pref_v2";
    const LS_GUIDE_DEFAULT = "sd_guide_default_collapsed";
    const LS_SKIP_CDN_BLOCKED = "sd_skip_cdn_blocked";
    // Decoder-error → Clappr embed (Android green/black paint). Default watches 60s.
    const LS_PAINT_EMBED = "sd_paint_embed_fallback";
    const LS_PAINT_GRACE = "sd_paint_embed_grace"; // short | default | patient
    const LS_PAINT_DEAD_LOG = "sd_paint_dead_log";
    const PAINT_DEAD_SAMPLE_MS = 1000; // watchdog tick
    // Short still shorter; Default = 60s sustained death before embed (field request).
    const PAINT_DEAD_GRACE_MS = { short: 15000, default: 60000, patient: 90000 };
    const DEFAULT_PAINT_DEAD_GRACE = "default";
    const PAINT_DEAD_LOG_MAX = 40;
    // Require sustained good paint before clearing remount/reload budgets.
    // A single FRAG_LOADED / playing sample used to reset flags → remount loop.
    const PAINT_HEALTHY_CONFIRM_MS = 8000;
    // After a remount/soft-reload/embed flip, refuse another MSE destroy for this window.
    const LIVE_RECOVER_COOLDOWN_MS = 15000;
    // True no-frame (vw=0 / ready<2): fail-fast to retry UI — do not spin through paint grace.
    // Cold playlist/cache after deploy often needs >10s before first frame.
    // Sticky clock across soft remounts (20260908n) made every channel trip this.
    const NO_FRAME_FAILFAST_MS = 25000;
    // Android MSE: prefer ≤720 when master has multiple ABR levels (before paint grace).
    const ANDROID_LEVEL_CAP_HEIGHT = 720;
    const BUFFER_SOFT_DELAY_MS = 1000;
    const BUFFER_FULL_DELAY_MS = 1400;
    const BUFFER_START_DELAY_MS = 450;
    const BUFFER_RESHOW_COOLDOWN_MS = 2800;
    const THEMES = ["cinema", "standard", "glass", "broadcast"];
    const DEFAULT_THEME = "cinema";
    const VOD_SOURCE_MODES = ["auto", "manual"];
    const DEFAULT_VOD_SOURCE_MODE = "auto";
    const SLOT_MIN = 30;
    const SLOT_W = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue("--slot-w")) || 108;
    const ROW_H = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue("--row-h")) || 52;
    const VISIBLE_ROWS = 11;
    const GUIDE_OVERSCAN = 6;
    // Hard cap: stretching windowRange to a distant focusIdx used to request
    // hundreds of /epg/schedule calls, starve visible rows, and paint all LIVE.
    const MAX_GUIDE_EPG_ROWS = 36;
    // Per-channel fallback only; batch endpoints collapse the storm to 1–2 POSTs.
    const EPG_FETCH_CONCURRENCY = 4;
    const EPG_BATCH_MAX = 48;
    const EPG_SCHEDULE_HOURS = 24;
    const EPG_STALE_GRACE_MS = 10 * 60 * 1000;
    const EPG_PENDING_TTL_MS = 8 * 1000; // re-ask soon while server fills gaps async
    const EPG_IDLE_BATCH = 12;
    const EPG_SCROLL_AHEAD = 4;
    // Priority tiers (lower = sooner). Slow/gap-fill sources get +EPG_SLOW_BOOST.
    const EPG_TIER = {
      TUNED: 0,
      VISIBLE: 1,
      RECENT: 2,
      TOP: 3,
      SCROLL: 4,
      IDLE: 5,
    };
    const EPG_SLOW_BOOST = 10;
    // Curated top cable/DDL brands when favorites are empty.
    const TOP_NETWORK_NAME_RE = /\b(espn|cnn|fox news|msnbc|usa\b|tnt\b|tbs\b|hbo|showtime|amc\b|fx\b|discovery|history|nat(?:ional)?\s*geo|nbc|abc|cbs|food network|hgtv|cartoon network|disney|mtv|comedy central|syfy|paramount|lifetime|hallmark|nhl|nba|nfl network|golf channel|fs1|fox sports)\b/i;
    const NUM_SLOTS = 48;
    const SLOT_MS = SLOT_MIN * 60 * 1000;
    const LIVE_PLACEHOLDER = "● Live";

    const v = document.getElementById("v");
    const loadBar = document.getElementById("loadBar");
    const bufferOverlay = document.getElementById("bufferOverlay");
    const bufferStatus = document.getElementById("bufferStatus");
    const tapPlay = document.getElementById("tapPlay");
    const unmuteBtn = document.getElementById("unmuteBtn");
    const errToast = document.getElementById("errToast");
    const epgPanel = document.getElementById("epgPanel");
    const guideSheetHandle = document.getElementById("guideSheetHandle");
    const nowTitle = document.getElementById("nowTitle");
    const nowSub = document.getElementById("nowSub");
    const dayLabel = document.getElementById("dayLabel");
    const timeRow = document.getElementById("timeRow");
    const timeScroll = document.getElementById("timeScroll");
    const chWrap = document.getElementById("chWrap");
    const gridWrap = document.getElementById("gridWrap");
    const epgBody = document.getElementById("epgBody");
    const catDrawer = document.getElementById("catDrawer");
    const catDrawerList = document.getElementById("catDrawerList");
    const catDrawerScrim = document.getElementById("catDrawerScrim");
    const chScroll = document.getElementById("chScroll");
    const gridScroll = document.getElementById("gridScroll");
    const simpleLink = document.getElementById("simpleLink");
    const guideMoreBtn = document.getElementById("guideMoreBtn");
    const guideMoreMenu = document.getElementById("guideMoreMenu");
    const tvRoot = document.getElementById("tvRoot");
    const guideToggle = document.getElementById("guideToggle");
    const showGuideBtn = document.getElementById("showGuideBtn");
    const videoArea = document.getElementById("videoArea");
    const collapsedChrome = document.getElementById("collapsedChrome");
    const nowOnAir = document.getElementById("nowOnAir");
    const chromeOnAir = document.getElementById("chromeOnAir");
    const chromeHdr = document.getElementById("chromeHdr");
    const chromeSub = document.getElementById("chromeSub");
    const hdrPoster = document.getElementById("hdrPoster");
    const chromePoster = document.getElementById("chromePoster");
    const titleHoverCard = document.getElementById("titleHoverCard");
    const xrayPanel = document.getElementById("xrayPanel");
    const xrayBackdrop = document.getElementById("xrayBackdrop");
    const xrayScroll = document.getElementById("xrayScroll");
    const xrayClose = document.getElementById("xrayClose");
    const xrayBtn = document.getElementById("xrayBtn");
    const searchBtn = document.getElementById("searchBtn");
    const searchBtnChrome = document.getElementById("searchBtnChrome");
    const searchDrawer = document.getElementById("searchDrawer");
    const searchBackdrop = document.getElementById("searchBackdrop");
    const searchInput = document.getElementById("searchInput");
    const searchMicBtn = document.getElementById("searchMicBtn");
    const closeSearch = document.getElementById("closeSearch");
    const favList = document.getElementById("favList");
    const recentList = document.getElementById("recentList");
    const searchResults = document.getElementById("searchResults");
    const searchQuick = document.getElementById("searchQuick");
    const searchRecentTags = document.getElementById("searchRecentTags");
    const settingsBtn = document.getElementById("settingsBtn");
    const settingsDrawer = document.getElementById("settingsDrawer");
    const settingsBackdrop = document.getElementById("settingsBackdrop");
    const closeSettings = document.getElementById("closeSettings");
    const themeGrid = document.getElementById("themeGrid");
    const cinemaPosterLg = document.getElementById("cinemaPosterLg");
    const cinemaPosterPh = document.getElementById("cinemaPosterPh");
    const cinemaOverview = document.getElementById("cinemaOverview");
    const cinemaTitle = document.getElementById("cinemaTitle");
    const cinemaSub = document.getElementById("cinemaSub");
    const cinemaTime = document.getElementById("cinemaTime");
    const trailerLayer = document.getElementById("trailerLayer");
    const trailerFrame = document.getElementById("trailerFrame");
    const trailerBackBtn = document.getElementById("trailerBackBtn");
    const vodPicker = document.getElementById("vodPicker");
    const vodPickerBackdrop = document.getElementById("vodPickerBackdrop");
    const vodSourceList = document.getElementById("vodSourceList");
    const vodPickerTitle = document.getElementById("vodPickerTitle");
    const closeVodPicker = document.getElementById("closeVodPicker");
    const vodDirectHlsToggle = document.getElementById("vodDirectHlsToggle");
    const vodHlsOnlyToggle = document.getElementById("vodHlsOnlyToggle");
    const vodSourceModeSeg = document.getElementById("vodSourceModeSeg");
    const vodSourceModeHint = document.getElementById("vodSourceModeHint");
    const vodTrailerAutoplayToggle = document.getElementById("vodTrailerAutoplayToggle");
    const vodTrailerMutedToggle = document.getElementById("vodTrailerMutedToggle");
    const vodAutoNextToggle = document.getElementById("vodAutoNextToggle");
    const calmUiToggle = document.getElementById("calmUiToggle");
    const vodEpChrome = document.getElementById("vodEpChrome");
    const vodEpHotzone = document.getElementById("vodEpHotzone");
    const vodEpPrev = document.getElementById("vodEpPrev");
    const vodEpNext = document.getElementById("vodEpNext");
    const vodEpAutoBtn = document.getElementById("vodEpAutoBtn");
    const vodEpLabel = document.getElementById("vodEpLabel");
    const vodEpName = document.getElementById("vodEpName");
    const vodEpNextUp = document.getElementById("vodEpNextUp");
    const vodEpNextUpTitle = document.getElementById("vodEpNextUpTitle");
    const vodEpNextUpCancel = document.getElementById("vodEpNextUpCancel");
    const vodEpNextUpPlay = document.getElementById("vodEpNextUpPlay");
    const vodEpNextUpFill = document.getElementById("vodEpNextUpFill");
    const vodStartGate = document.getElementById("vodStartGate");
    const vodStartGateBtn = document.getElementById("vodStartGateBtn");
    const vodStartGateLabel = document.getElementById("vodStartGateLabel");
    const vodStartGateSub = document.getElementById("vodStartGateSub");
    const vodStartGateSources = document.getElementById("vodStartGateSources");
    const vodStartGateEmbed = document.getElementById("vodStartGateEmbed");
    const vodStreamStatus = document.getElementById("vodStreamStatus");
    const rememberChannelToggle = document.getElementById("rememberChannelToggle");
    const liveStartMutedToggle = document.getElementById("liveStartMutedToggle");
    const guideCollapsedToggle = document.getElementById("guideCollapsedToggle");
    const useDaddyliveToggle = document.getElementById("useDaddyliveToggle");
    const skipCdnBlockedToggle = document.getElementById("skipCdnBlockedToggle");
    const paintEmbedToggle = document.getElementById("paintEmbedToggle");
    const paintGraceSeg = document.getElementById("paintGraceSeg");
    const paintGraceHint = document.getElementById("paintGraceHint");
    const liveEmbedGuideHotspot = document.getElementById("liveEmbedGuideHotspot");
    let householdUseDaddylive = false;
    let householdCdnBlocked = false;
    let householdCdnTosBlocked = false;
    const clearRecentsBtn = document.getElementById("clearRecentsBtn");
    const clearSearchRecentBtn = document.getElementById("clearSearchRecentBtn");
    const clearFavoritesBtn = document.getElementById("clearFavoritesBtn");
    const vodCatalogBtn = document.getElementById("vodCatalogBtn");
    const vodCatalog = document.getElementById("vodCatalog");
    const vodCatalogBackdrop = document.getElementById("vodCatalogBackdrop");
    const vodCatalogBody = document.getElementById("vodCatalogBody");
    const vodCatalogSearch = document.getElementById("vodCatalogSearch");
    const vodCatalogMicBtn = document.getElementById("vodCatalogMicBtn");
    const vodCatalogTabs = document.getElementById("vodCatalogTabs");
    const vodProviderBar = document.getElementById("vodProviderBar");
    const vodFilterBar = document.getElementById("vodFilterBar");
    const vodSortSelect = document.getElementById("vodSortSelect");
    const vodGenreSelect = document.getElementById("vodGenreSelect");
    const vodYearSelect = document.getElementById("vodYearSelect");
    const vodRatingSelect = document.getElementById("vodRatingSelect");
    const closeVodCatalogBtn = document.getElementById("closeVodCatalog");
    const vodHomeBrand = document.getElementById("vodHomeBrand");
    const vodDetail = document.getElementById("vodDetail");
    const vodDetailHero = document.getElementById("vodDetailHero");
    const vodDetailScroll = document.getElementById("vodDetailScroll");

    const CHROME_HIDE_MS = 4000;
    let chromeHideTimer = null;
    let collapsedChromeVisible = false;
    let searchTimer = null;
    let searchOpen = false;
    let settingsOpen = false;
    let currentTheme = DEFAULT_THEME;
    let trailerActive = false;
    let vodPickerOpen = false;
    let vodHlsActive = false;
    let vodPickerCtx = null;
    let vodPickerSources = [];
    let overlayReturn = null;
    let vodSeriesSession = null;
    let vodSeasonEpCache = new Map();
    let vodEpNextTimer = null;
    let vodEpNextRaf = null;
    let vodEpNextTarget = null;
    let vodEpChromeHideTimer = null;
    let vodStartGatePending = null;
    let vodCatalogOpen = false;
    let vodCatalogTab = "home";
    let vodCatalogDetail = null;
    let vodProviders = [];
    let vodActiveProvider = "";
    let vodGenresLoaded = { movie: false, tv: false };
    let vodFilterDebounce = null;
    let vodSearchTimer = null;
    let vodInfiniteGrid = null;
    let vodHomeSections = [];
    let vodDetailQueue = [];
    let traktPollTimer = null;
    let vodPageState = { page: 0, hasMore: false, loading: false, title: "", type: "movie", searchQuery: "", castId: "" };

    let channelId = "";
    let guideCollapsed = false;
    let guideSheetSnap = "mid";
    let guideSheetDragging = false;
    let guideHistoryPushed = false;
    let guideHistorySilent = false;
    let tvBackArmedAt = 0;
    let playRetryCount = 0;
    let playRetryTimer = null;
    let policyRetryCount = 0;
    let autoplayPolicyBlocked = false;
    let bufferHideTimer = null;
    let bufferShowTimer = null;
    let bufferEscalateTimer = null;
    let bufferCooldownUntil = 0;
    let bufferPending = null;
    let bufferVisible = false;
    let userGestureSeen = false;
    let viewStart = 0;
    let guideScrollRaf = 0;
    let guideScrollIdleTimer = null;
    let guideNowIdleTimer = null;
    let guideFollowNow = true;
    let guideUserPanned = false;
    let guideProgrammaticScroll = false;
    const GUIDE_NOW_IDLE_MS = 75000;
    let syncScroll = false;
    let cinemaInfoHideTimer = null;
    let cinemaInfoLastKey = "";
    const CINEMA_INFO_HIDE_MS = 4200;
    let hls = null;
    let userUnmuted = false;
    let switching = false;
    let currentStreamUrl = "";
    // Last known LIVE stream URL (survives VOD attach/teardown so close-VOD can restore).
    let liveStreamUrl = "";
    let restoreLiveInflight = null;
    let reloadAttempts = 0;
    let liveHardRemountUsed = false;
    let liveRecoverTimer = null;
    let liveRecoverWatchdog = null;
    let liveEmbedActive = false;
    let liveEmbedFailCount = 0;
    let liveEmbedInflight = null;
    const MAX_LIVE_CDN_FAILS = 1; // hard CDN block → stop (no attachHls storm)
    const MAX_LIVE_SOFT_RELOAD = 3; // soft reconnects with backoff, then one hard remount
    const MAX_VOD_RELOAD = 4;
    let liveCdnBlockedUntil = 0; // thrash guard: suppress soft mid-retry after hard CDN fail
    const LIVE_CDN_BLOCK_TTL_MS = 5 * 60 * 1000;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    // Samsung/Android Chrome + hls.js workers can stick the HW decoder on some 1080p High feeds
    // (solid green / blue garbage while readyState looks healthy). Keep workers off on Android.
    const isAndroid = /Android/i.test(navigator.userAgent || "");
    const HLS_CFG = {
      enableWorker: !isIOS && !isAndroid, lowLatencyMode: false, liveDurationInfinity: true,
      startLevel: -1, capLevelToPlayerSize: true,
      // Android Chrome/WebAPK + Qualcomm c2.qti.avc.decoder: large MSE buffers correlate with
      // ImageReader "no buffers currently available" → green/black paint. Keep buffers lean.
      maxBufferLength: isAndroid ? 12 : 30,
      maxMaxBufferLength: isAndroid ? 24 : 60,
      liveSyncDuration: isAndroid ? 3 : 4,
      liveMaxLatencyDuration: isAndroid ? 18 : 30,
      backBufferLength: isAndroid ? 8 : 20,
      fragLoadingTimeOut: 25000, manifestLoadingTimeOut: 20000,
      // Keep session/guest cookies on playlist + segment XHRs (PIN grace / sd_session).
      xhrSetup: function (xhr) {
        try { xhr.withCredentials = true; } catch (e) {}
      }
    };
    let lastPaintDead = false;
    let lastPaintSampleAt = 0;
    let paintDeadStreak = 0;
    let paintDeadSince = 0; // Date.now() when continuous dead-paint began
    let paintHealthySince = 0; // sustained healthy paint clock for budget clears
    let lastLiveRecoverAt = 0; // last MSE remount / soft-reload / paint embed
    let livePaintEmbedUsed = false;
    let livePaintRemountUsed = false;
    let paintWatchTimer = null;
    let paintCanvas = null;
    let paintCtx = null;
    let noFrameSince = 0;
    let noFrameWatchTimer = null;
    let noFrameFailArmed = false;

    let orderIds = [];
    let allOrderIds = [];
    let channelMap = {};
    let guideCategoryKey = "all";
    let catDrawerOpen = false;
    let focusIdx = 0;
    let focusSlot = 0;
    let gridStartMs = 0;
    const EPG_NOW_TTL_MS = 60 * 1000;
    const EPG_SCHEDULE_TTL_MS = 5 * 60 * 1000;
    const EPG_STATUS_POLL_MS = 2 * 60 * 1000;
    let epgCache = new Map();
    let scheduleCache = new Map();
    let epgSlowIds = new Set(); // known gap-fill heavy (Pluto / epg.pw) — end of queue
    let epgIdleTimer = null;
    let epgPendingRetryTimer = null;
    let epgInflight = new Map();
    let epgRefreshGen = 0;
    let epgAbortController = null;
    let epgScrollDir = 0; // 1 = down, -1 = up (preload bias)
    let lastEpgViewStart = 0;
    let serverEpgUpdatedAt = null;
    let headerMeta = null;
    let headerLayout = "standard";
    let headerResizeObs = null;
    let currentTitleMeta = null;
    let hoverHideTimer = null;
    let hoverShowTimer = null;
    let progMetaCache = new Map();
    let xrayOpen = false;
    let renderToken = 0;

    function lsFlag(key, defaultOn) {
      try {
        const v = localStorage.getItem(key);
        if (v === null) return !!defaultOn;
        return v === "1";
      } catch (e) { return !!defaultOn; }
    }

    function setLsFlag(key, on) {
      try { localStorage.setItem(key, on ? "1" : "0"); } catch (e) {}
    }

    function vodDirectHlsEnabled() {
      return lsFlag(LS_VOD_DIRECT, true);
    }

    function setVodDirectHls(on) {
      setLsFlag(LS_VOD_DIRECT, on);
      if (vodDirectHlsToggle) vodDirectHlsToggle.checked = !!on;
    }

    function vodHlsOnlyEnabled() {
      return lsFlag(LS_VOD_HLS_ONLY, false);
    }

    function setVodHlsOnly(on) {
      setLsFlag(LS_VOD_HLS_ONLY, on);
      if (vodHlsOnlyToggle) vodHlsOnlyToggle.checked = !!on;
      if (vodSourceMode() === "auto") setVodSourceMode("auto");
    }

    function vodSourceMode() {
      try {
        const v = (localStorage.getItem(LS_VOD_SOURCE_MODE) || DEFAULT_VOD_SOURCE_MODE).toLowerCase();
        return VOD_SOURCE_MODES.includes(v) ? v : DEFAULT_VOD_SOURCE_MODE;
      } catch (e) { return DEFAULT_VOD_SOURCE_MODE; }
    }

    function setVodSourceMode(mode) {
      mode = (mode || DEFAULT_VOD_SOURCE_MODE).toLowerCase();
      if (!VOD_SOURCE_MODES.includes(mode)) mode = DEFAULT_VOD_SOURCE_MODE;
      try { localStorage.setItem(LS_VOD_SOURCE_MODE, mode); } catch (e) {}
      if (vodSourceModeSeg) {
        vodSourceModeSeg.querySelectorAll(".seg-opt").forEach((el) => {
          const on = el.dataset.mode === mode;
          el.classList.toggle("active", on);
          el.setAttribute("aria-pressed", on ? "true" : "false");
        });
      }
      if (vodSourceModeHint) {
        if (mode === "manual") {
          vodSourceModeHint.textContent = "Manual always opens the source picker so you choose HLS or embed.";
        } else if (vodHlsOnlyEnabled()) {
          vodSourceModeHint.textContent = "Auto plays direct HLS only. No adware iframe unless you opt in.";
        } else {
          vodSourceModeHint.textContent = "Auto tries a direct stream first, then falls back to embed if needed.";
        }
      }
      const hlsRow = document.getElementById("vodDirectHlsRow");
      if (hlsRow) hlsRow.style.opacity = mode === "manual" && !vodDirectHlsEnabled() ? "0.55" : "1";
    }

    function vodTrailerAutoplayEnabled() {
      return lsFlag(LS_VOD_TRAILER_AUTOPLAY, true);
    }

    function setVodTrailerAutoplay(on) {
      setLsFlag(LS_VOD_TRAILER_AUTOPLAY, on);
      if (vodTrailerAutoplayToggle) vodTrailerAutoplayToggle.checked = !!on;
    }

    function vodAutoNextEnabled() {
      return lsFlag(LS_VOD_AUTO_NEXT, true);
    }

    function setVodAutoNext(on) {
      setLsFlag(LS_VOD_AUTO_NEXT, on);
      if (vodAutoNextToggle) vodAutoNextToggle.checked = !!on;
      if (vodEpAutoBtn) {
        vodEpAutoBtn.classList.toggle("active", !!on);
        vodEpAutoBtn.setAttribute("aria-pressed", on ? "true" : "false");
      }
      if (!on) cancelEpisodeAutoAdvance();
    }

    function vodSeriesPlayMode() {
      try {
        const v = (localStorage.getItem(LS_VOD_SERIES_PLAY) || DEFAULT_VOD_SERIES_PLAY).toLowerCase();
        return v === "progressive" ? "progressive" : "latest";
      } catch (e) {
        return DEFAULT_VOD_SERIES_PLAY;
      }
    }

    function setVodSeriesPlayMode(mode) {
      mode = mode === "progressive" ? "progressive" : "latest";
      try { localStorage.setItem(LS_VOD_SERIES_PLAY, mode); } catch (e) {}
      const seg = document.getElementById("vodSeriesPlaySeg");
      if (seg) {
        seg.querySelectorAll(".seg-opt").forEach((el) => {
          const on = el.getAttribute("data-mode") === mode;
          el.classList.toggle("active", on);
          el.setAttribute("aria-pressed", on ? "true" : "false");
        });
      }
      const hint = document.getElementById("vodSeriesPlayHint");
      if (hint) {
        hint.textContent = mode === "progressive"
          ? "Play continues from the episode after the one you last watched."
          : "Play opens the newest episode that has already aired.";
      }
      updateVodDetailPlayLabel();
    }

    function fmtEpisodeAirDate(iso) {
      if (!iso) return "";
      try {
        const d = new Date(String(iso).slice(0, 10) + "T12:00:00");
        if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
        return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      } catch (e) {
        return String(iso).slice(0, 10);
      }
    }

    function updateVodDetailPlayLabel() {
      const btn = document.getElementById("vodDetailPlay");
      if (!btn) return;
      const d = vodCatalogDetail;
      if (!d || (d.type !== "tv" && d.type !== "series")) {
        btn.textContent = "▶ Play";
        return;
      }
      const target = btn.dataset.playLabel;
      if (target) {
        btn.textContent = "▶ Play " + target;
        return;
      }
      btn.textContent = vodSeriesPlayMode() === "progressive" ? "▶ Continue" : "▶ Play latest";
    }

    function vodPreferLang() {
      try {
        const v = (localStorage.getItem(LS_VOD_LANG) || "en").toLowerCase().trim();
        return v || "en";
      } catch (e) { return "en"; }
    }
    function setVodPreferLang(lang) {
      lang = String(lang || "en").toLowerCase().trim() || "en";
      try { localStorage.setItem(LS_VOD_LANG, lang); } catch (e) {}
      const sel = document.getElementById("vodLangSelect");
      if (sel) sel.value = lang;
    }

    function vodTrailersStartMuted() {
      try {
        const v = localStorage.getItem(LS_VOD_TRAILER_MUTED);
        return v !== "0";
      } catch (e) { return true; }
    }

    function setVodTrailersStartMuted(on) {
      setLsFlag(LS_VOD_TRAILER_MUTED, on);
      if (vodTrailerMutedToggle) vodTrailerMutedToggle.checked = !!on;
    }

    function calmUiEnabled() {
      return lsFlag(LS_UI_CALM, true);
    }

    function applyCalmUi(on) {
      setLsFlag(LS_UI_CALM, on);
      if (tvRoot) {
        if (on) tvRoot.removeAttribute("data-calm");
        else tvRoot.dataset.calm = "0";
      }
      if (calmUiToggle) calmUiToggle.checked = !!on;
    }

    function rememberChannelEnabled() {
      return lsFlag(LS_REMEMBER_CHANNEL, true);
    }

    function setRememberChannel(on) {
      setLsFlag(LS_REMEMBER_CHANNEL, on);
      if (rememberChannelToggle) rememberChannelToggle.checked = !!on;
    }

    function loadLastPlace() {
      try {
        const raw = localStorage.getItem(LS_LAST_PLACE);
        if (!raw) return null;
        const place = JSON.parse(raw);
        return place && typeof place === "object" ? place : null;
      } catch (e) {
        return null;
      }
    }

    function saveLastPlace(partial) {
      if (!rememberChannelEnabled() && !(partial && partial.partyCode)) return;
      try {
        const prev = loadLastPlace() || {};
        const next = Object.assign({}, prev, partial || {}, { ts: Date.now() });
        if (partial && Object.prototype.hasOwnProperty.call(partial, "partyCode") && !partial.partyCode) {
          delete next.partyCode;
        }
        localStorage.setItem(LS_LAST_PLACE, JSON.stringify(next));
      } catch (e) {}
    }
    window.SDSaveLastPlace = saveLastPlace;

    function lastPlaceHasDeepLink() {
      try {
        const q = new URLSearchParams(location.search);
        if (q.get("party") || q.get("party_create")) return true;
      } catch (e) {}
      if (INITIAL_CHANNEL) return true;
      const path = location.pathname.replace(/\/$/, "") || "/";
      if (path.startsWith("/vod/") && path !== "/vod") return true;
      if (/^\/tv\/[^/]+$/.test(path)) return true;
      return false;
    }

    function buildPlaceUrl(place) {
      if (!place) return null;
      let path = "";
      if (place.tmdbId) {
        const mt = place.mediaType === "tv" || place.mediaType === "series" || place.mediaType === "show" ? "tv" : "movie";
        path = "/vod/" + mt + "/" + encodeURIComponent(place.tmdbId);
        if (mt === "tv" && place.season) {
          path += "?season=" + encodeURIComponent(place.season);
          if (place.episode) path += "&episode=" + encodeURIComponent(place.episode);
        }
      } else if (place.channelId) {
        path = "/tv/" + encodeURIComponent(place.channelId);
      } else if (place.path && place.path.startsWith("/")) {
        path = place.path;
      } else {
        return null;
      }
      if (place.partyCode) {
        path += (path.includes("?") ? "&" : "?") + "party=" + encodeURIComponent(place.partyCode);
      }
      return path;
    }

    function maybeResumeLastPlace() {
      if (!rememberChannelEnabled() || lastPlaceHasDeepLink()) return false;
      const path = location.pathname.replace(/\/$/, "") || "/";
      const bareTv = path === "/tv" || path === "" || path === "/";
      const bareVod = path === "/vod";
      if (!bareTv && !bareVod) return false;
      const place = loadLastPlace();
      if (!place || !place.ts) return false;
      if (Date.now() - Number(place.ts) > 14 * 24 * 3600 * 1000) return false;
      // Channel-only resume stays on /tv via resolveInitialChannel.
      if (bareTv && place.channelId && !place.tmdbId && !place.partyCode) return false;
      const url = buildPlaceUrl(place);
      if (!url) return false;
      const cur = location.pathname + location.search;
      if (url === cur || url === path) return false;
      try {
        history.replaceState(null, "", url);
      } catch (e) {
        location.replace(url);
        return true;
      }
      // Soft navigation for VOD / party deep links after bare /tv.
      if (url.startsWith("/vod") || (place.partyCode && place.tmdbId)) {
        location.replace(url);
        return true;
      }
      return false;
    }

    function liveStartMutedEnabled() {
      // v2 default = unmuted. One-time migrate so legacy muted default ("1"/null) does not stick.
      try {
        if (localStorage.getItem(LS_LIVE_START_MUTED_PREF) === "1") {
          return lsFlag(LS_LIVE_START_MUTED, false);
        }
        const raw = localStorage.getItem(LS_LIVE_START_MUTED);
        // Preserve only an explicit unmuted choice; reset muted/null to new unmuted default.
        if (raw === "0") {
          localStorage.setItem(LS_LIVE_START_MUTED_PREF, "1");
          return false;
        }
        localStorage.setItem(LS_LIVE_START_MUTED, "0");
        localStorage.setItem(LS_LIVE_START_MUTED_PREF, "1");
        return false;
      } catch (e) {
        return false;
      }
    }

    function setLiveStartMuted(on) {
      try { localStorage.setItem(LS_LIVE_START_MUTED_PREF, "1"); } catch (e) {}
      setLsFlag(LS_LIVE_START_MUTED, on);
      if (liveStartMutedToggle) liveStartMutedToggle.checked = !!on;
    }

    function guideDefaultCollapsed() {
      return lsFlag(LS_GUIDE_DEFAULT, false);
    }

    function setGuideDefaultCollapsed(on) {
      setLsFlag(LS_GUIDE_DEFAULT, on);
      if (guideCollapsedToggle) guideCollapsedToggle.checked = !!on;
    }

    function skipCdnBlockedEnabled() {
      return lsFlag(LS_SKIP_CDN_BLOCKED, false);
    }

    function setSkipCdnBlocked(on) {
      setLsFlag(LS_SKIP_CDN_BLOCKED, on);
      if (skipCdnBlockedToggle) skipCdnBlockedToggle.checked = !!on;
    }

    function paintEmbedFallbackEnabled() {
      return lsFlag(LS_PAINT_EMBED, true);
    }
    function setPaintEmbedFallback(on) {
      setLsFlag(LS_PAINT_EMBED, on);
      if (paintEmbedToggle) paintEmbedToggle.checked = !!on;
      if (paintGraceSeg) paintGraceSeg.style.opacity = on ? "1" : "0.45";
    }
    function paintDeadGracePreset() {
      try {
        const v = (localStorage.getItem(LS_PAINT_GRACE) || DEFAULT_PAINT_DEAD_GRACE).toLowerCase();
        return Object.prototype.hasOwnProperty.call(PAINT_DEAD_GRACE_MS, v) ? v : DEFAULT_PAINT_DEAD_GRACE;
      } catch (e) {
        return DEFAULT_PAINT_DEAD_GRACE;
      }
    }
    function paintDeadGraceMs() {
      return PAINT_DEAD_GRACE_MS[paintDeadGracePreset()] || PAINT_DEAD_GRACE_MS.default;
    }
    function setPaintDeadGracePreset(preset) {
      preset = String(preset || DEFAULT_PAINT_DEAD_GRACE).toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(PAINT_DEAD_GRACE_MS, preset)) preset = DEFAULT_PAINT_DEAD_GRACE;
      try { localStorage.setItem(LS_PAINT_GRACE, preset); } catch (e) {}
      if (paintGraceSeg) {
        paintGraceSeg.querySelectorAll(".seg-opt").forEach((el) => {
          const on = el.dataset.grace === preset;
          el.classList.toggle("active", on);
          el.setAttribute("aria-pressed", on ? "true" : "false");
        });
      }
      if (paintGraceHint) {
        const ms = PAINT_DEAD_GRACE_MS[preset] || PAINT_DEAD_GRACE_MS.default;
        const sec = Math.round(ms / 1000);
        if (preset === "short") {
          paintGraceHint.textContent = "Short (~" + sec + "s): flips sooner after a frozen green/black frame.";
        } else if (preset === "patient") {
          paintGraceHint.textContent = "Patient (~" + sec + "s): longest watch so stubborn decoder glitches can self-correct.";
        } else {
          paintGraceHint.textContent = "Default (~" + sec + "s): watch dead paint this long before backup/embed; brief flashes stay temporary.";
        }
      }
      // Reset in-progress streak so a mid-watch setting change does not instantly trip.
      paintDeadStreak = 0;
      paintDeadSince = 0;
    }
    function paintMediaSnapshot() {
      const snap = { channelId: String(channelId || ""), ts: Date.now() };
      try {
        if (v) {
          snap.width = v.videoWidth || 0;
          snap.height = v.videoHeight || 0;
        }
      } catch (e) {}
      try {
        if (hls && hls.levels && hls.currentLevel >= 0 && hls.levels[hls.currentLevel]) {
          const lv = hls.levels[hls.currentLevel];
          if (lv.attrs && lv.attrs.CODECS) snap.codec = lv.attrs.CODECS;
          else if (lv.videoCodec) snap.codec = lv.videoCodec;
          if (lv.height) snap.height = lv.height;
          if (lv.width) snap.width = lv.width;
        }
      } catch (e) {}
      snap.graceMs = paintDeadGraceMs();
      snap.gracePreset = paintDeadGracePreset();
      snap.android = !!isAndroid;
      return snap;
    }
    function readPaintDeadLog() {
      try {
        const raw = localStorage.getItem(LS_PAINT_DEAD_LOG);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch (e) {
        return [];
      }
    }
    function logPaintDeadEvent(kind, extra) {
      // kind: "detect" | "temporary" | "static"
      const ev = Object.assign(paintMediaSnapshot(), extra || {}, { kind: kind });
      try {
        console.info("[live] paint-dead", kind, ev);
      } catch (e) {}
      try {
        const arr = readPaintDeadLog();
        arr.push(ev);
        while (arr.length > PAINT_DEAD_LOG_MAX) arr.shift();
        localStorage.setItem(LS_PAINT_DEAD_LOG, JSON.stringify(arr));
      } catch (e) {}
      try {
        window.__sdPaintDeadLast = ev;
        window.__sdPaintDeadEvents = readPaintDeadLog();
      } catch (e) {}
      // Lightweight optional beacon (fire-and-forget; ignore failures).
      try {
        if (kind === "temporary" || kind === "static") {
          const body = JSON.stringify({
            type: "paint_dead",
            kind: kind,
            channelId: ev.channelId,
            durationMs: ev.durationMs || 0,
            graceMs: ev.graceMs,
            width: ev.width,
            height: ev.height,
            codec: ev.codec || "",
            ts: ev.ts
          });
          if (navigator.sendBeacon) {
            navigator.sendBeacon("/api/client-metrics", new Blob([body], { type: "application/json" }));
          }
        }
      } catch (e) {}
    }
    try {
      window.__sdPaintDeadLog = readPaintDeadLog;
      window.__sdPaintDeadStats = function () {
        const arr = readPaintDeadLog();
        let temporary = 0, staticN = 0, detect = 0;
        arr.forEach((e) => {
          if (e.kind === "temporary") temporary += 1;
          else if (e.kind === "static") staticN += 1;
          else if (e.kind === "detect") detect += 1;
        });
        return { total: arr.length, temporary: temporary, static: staticN, detect: detect, events: arr };
      };
    } catch (e) {}

    const SUPPLEMENT_ID_RE = /^(freetv|iptv|ntv|dulo|adultswim):/i;
    const SUPPLEMENT_SOURCES = new Set(["freetv", "iptv", "ntv", "dulo", "adultswim", "supplement"]);

    function encodeLiveStreamUrl(url) {
      // Ensure colon ids in /live/freetv:… .m3u8 are percent-encoded.
      const raw = String(url || "");
      if (!raw) return raw;
      try {
        const abs = raw.startsWith("http") ? new URL(raw) : new URL(raw, location.origin);
        const m = abs.pathname.match(/^\/live\/(.+?)(\.m3u8)$/i);
        if (m) {
          const idPart = m[1];
          // Avoid double-encoding
          let decoded = idPart;
          try { decoded = decodeURIComponent(idPart); } catch (e) {}
          abs.pathname = "/live/" + encodeURIComponent(decoded) + m[2];
          return abs.pathname + abs.search + abs.hash;
        }
      } catch (e) {}
      return raw;
    }

    function isSupplementChannelId(id) {
      return SUPPLEMENT_ID_RE.test(String(id || ""));
    }

    function isSupplementChannel(chOrId) {
      if (chOrId == null || chOrId === "") return false;
      if (typeof chOrId === "string" || typeof chOrId === "number") {
        const id = String(chOrId);
        if (isSupplementChannelId(id)) return true;
        const mapped = channelMap[id];
        return mapped ? isSupplementChannel(mapped) : false;
      }
      const ch = chOrId;
      const id = String(ch.id || "");
      if (isSupplementChannelId(id)) return true;
      const src = String(ch.source || "").toLowerCase();
      if (SUPPLEMENT_SOURCES.has(src)) return true;
      return false;
    }

    function isDaddyLiveChannel(ch) {
      if (!ch) return false;
      // Supplements never inherit DaddyLive CDN / TOS circuit-breaker state.
      if (isSupplementChannel(ch)) return false;
      const src = String(ch.source || "").toLowerCase();
      if (src === "ddl" || src === "daddylive") return true;
      if (String(ch.provider || "") === "DaddyLive") return true;
      const id = String(ch.id || "");
      if (/^\d+$/.test(id)) return true;
      return false;
    }

    function currentLiveIsDaddyLive() {
      const id = String(channelId || "");
      if (!id) return false;
      if (isSupplementChannelId(id)) return false;
      const ch = channelMap[id];
      if (ch) return isDaddyLiveChannel(ch);
      return /^\d+$/.test(id);
    }

    function guideCdnKnownBlocked() {
      try {
        if (window.__SD_LIVE_CDN_TOS) return true;
      } catch (e) {}
      return !!(householdCdnBlocked || householdCdnTosBlocked || liveCdnIsBlocked());
    }

    function isChannelCdnBlocked(id) {
      const ch = channelMap[String(id)];
      if (!ch) return false;
      // CDN gray-out / skip-blocked is DaddyLive-only — never FreeTV/iptv/ntv/dulo/adultswim.
      if (!isDaddyLiveChannel(ch)) return false;
      if (ch.dead) return true;
      if (ch.cdn_blocked || ch.cdn_tos_blocked || ch.unavailable) return true;
      if (guideCdnKnownBlocked()) return true;
      return false;
    }

    function nearestWorkingChannelId(fromId) {
      const start = orderIds.indexOf(String(fromId));
      if (start < 0) {
        for (const id of orderIds) {
          if (!isChannelCdnBlocked(id)) return id;
        }
        return null;
      }
      for (let dist = 1; dist < orderIds.length; dist++) {
        const right = start + dist;
        if (right < orderIds.length && !isChannelCdnBlocked(orderIds[right])) return orderIds[right];
        const left = start - dist;
        if (left >= 0 && !isChannelCdnBlocked(orderIds[left])) return orderIds[left];
      }
      return null;
    }

    function resolveSelectableChannelId(targetId) {
      const id = String(targetId || "");
      if (!id || !isChannelCdnBlocked(id) || !skipCdnBlockedEnabled()) return id;
      return nearestWorkingChannelId(id) || id;
    }

    function syncSettingsForm() {
      if (vodDirectHlsToggle) vodDirectHlsToggle.checked = vodDirectHlsEnabled();
      if (vodHlsOnlyToggle) vodHlsOnlyToggle.checked = vodHlsOnlyEnabled();
      setVodSourceMode(vodSourceMode());
      if (vodTrailerAutoplayToggle) vodTrailerAutoplayToggle.checked = vodTrailerAutoplayEnabled();
      if (vodTrailerMutedToggle) vodTrailerMutedToggle.checked = vodTrailersStartMuted();
      if (vodAutoNextToggle) vodAutoNextToggle.checked = vodAutoNextEnabled();
      setVodSeriesPlayMode(vodSeriesPlayMode());
      const vodLangSelect = document.getElementById("vodLangSelect");
      if (vodLangSelect) vodLangSelect.value = vodPreferLang();
      if (vodEpAutoBtn) {
        vodEpAutoBtn.classList.toggle("active", vodAutoNextEnabled());
        vodEpAutoBtn.setAttribute("aria-pressed", vodAutoNextEnabled() ? "true" : "false");
      }
      if (calmUiToggle) calmUiToggle.checked = calmUiEnabled();
      if (rememberChannelToggle) rememberChannelToggle.checked = rememberChannelEnabled();
      if (liveStartMutedToggle) liveStartMutedToggle.checked = liveStartMutedEnabled();
      if (guideCollapsedToggle) guideCollapsedToggle.checked = guideDefaultCollapsed();
      if (useDaddyliveToggle) useDaddyliveToggle.checked = !!householdUseDaddylive;
      if (skipCdnBlockedToggle) skipCdnBlockedToggle.checked = skipCdnBlockedEnabled();
      if (paintEmbedToggle) paintEmbedToggle.checked = paintEmbedFallbackEnabled();
      setPaintDeadGracePreset(paintDeadGracePreset());
    }

    async function refreshHouseholdSettings() {
      try {
        const r = await authFetch("/settings/household", { cache: "no-store" });
        if (!r.ok) return;
        const data = await r.json();
        householdUseDaddylive = !!data.use_daddylive;
        householdCdnBlocked = !!(data.cdn_blocked || data.cdn_tos_blocked);
        householdCdnTosBlocked = !!data.cdn_tos_blocked;
        try {
          if (householdCdnTosBlocked) window.__SD_LIVE_CDN_TOS = true;
        } catch (e) {}
        if (useDaddyliveToggle) useDaddyliveToggle.checked = householdUseDaddylive;
        if (skipCdnBlockedToggle) skipCdnBlockedToggle.checked = skipCdnBlockedEnabled();
      if (paintEmbedToggle) paintEmbedToggle.checked = paintEmbedFallbackEnabled();
      setPaintDeadGracePreset(paintDeadGracePreset());
        if (orderIds.length) renderGrid({ preserveScroll: true });
      } catch (e) {}
    }

    async function setHouseholdUseDaddylive(on) {
      householdUseDaddylive = !!on;
      if (useDaddyliveToggle) useDaddyliveToggle.checked = householdUseDaddylive;
      try {
        const r = await authFetch("/settings/household", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ use_daddylive: householdUseDaddylive }),
        });
        if (r.ok) location.reload();
      } catch (e) {}
    }

    function loadVodSettings() {
      applyCalmUi(calmUiEnabled());
    setPaintEmbedFallback(paintEmbedFallbackEnabled());
    setPaintDeadGracePreset(paintDeadGracePreset());
      syncSettingsForm();
    }

    function applyTheme(theme) {
      if (!THEMES.includes(theme)) theme = DEFAULT_THEME;
      currentTheme = theme;
      if (tvRoot) tvRoot.dataset.theme = theme;
      try { localStorage.setItem(LS_THEME, theme); } catch (e) {}
      if (themeGrid) {
        themeGrid.querySelectorAll(".theme-opt").forEach(el => {
          el.classList.toggle("active", el.dataset.theme === theme);
        });
      }
      updateGuideToggleLabel();
      renderGrid();
      if (headerMeta) updateHeader(headerMeta);
    }

    function loadTheme() {
      let theme = DEFAULT_THEME;
      try { theme = localStorage.getItem(LS_THEME) || DEFAULT_THEME; } catch (e) {}
      applyTheme(theme);
    }

    function updateGuideToggleLabel() {
      if (!guideToggle) return;
      const label = guideToggle.querySelector(".toggle-label");
      if (!label) return;
      if (currentTheme === "cinema") {
        label.textContent = guideCollapsed ? "Guide" : "Hide";
      } else if (currentTheme === "broadcast") {
        label.textContent = guideCollapsed ? "Guide" : "Hide";
      } else {
        label.textContent = guideCollapsed ? "Show Guide" : "Hide Guide";
      }
    }

    function openSettingsDrawer() {
      settingsOpen = true;
      if (settingsDrawer) settingsDrawer.classList.add("open");
      if (settingsBackdrop) settingsBackdrop.classList.add("open");
      syncSettingsForm();
      refreshHouseholdSettings();
      refreshTraktSettingsHint();
    }

    function closeSettingsDrawer() {
      settingsOpen = false;
      if (settingsDrawer) settingsDrawer.classList.remove("open");
      if (settingsBackdrop) settingsBackdrop.classList.remove("open");
    }

    function isPlotLikeText(text) {
      const s = String(text || "").trim();
      if (!s) return false;
      if (s.length > 80) return true;
      if (/\bstars\b/i.test(s)) return true;
      if (/[.!?]$/.test(s) && s.split(/\s+/).length >= 8) return true;
      return false;
    }

    function channelLogoUrl(meta) {
      if (meta && meta.logo) return meta.logo;
      const id = meta && (meta.channel_id || meta.id);
      const mapped = id != null ? channelMap[String(id)] : null;
      return (mapped && mapped.logo) || "";
    }

    function channelLetter(meta) {
      const name = (meta && meta.name) || "";
      return (name.trim().charAt(0) || "T").toUpperCase();
    }

    function setPosterImage(img, url, onBroken) {
      if (!img) return;
      img.onerror = null;
      if (!url) {
        img.classList.remove("show");
        img.removeAttribute("src");
        try { img.hidden = true; } catch (e) {}
        if (onBroken) onBroken();
        return;
      }
      img.onload = () => {
        img.classList.add("show");
        try { img.hidden = false; } catch (e) {}
      };
      img.onerror = () => {
        img.classList.remove("show");
        img.removeAttribute("src");
        try { img.hidden = true; } catch (e) {}
        if (onBroken) onBroken();
      };
      if (img.src === url) {
        img.classList.add("show");
        try { img.hidden = false; } catch (e) {}
        return;
      }
      img.src = url;
    }

    function openChannelInfo(e) {
      if (e) {
        try { e.preventDefault(); e.stopPropagation(); } catch (err) {}
      }
      // Manually open cinema/channel info overlay (cover + title + synopsis).
      if (headerMeta) {
        updateCinemaOverlay(headerMeta, undefined, currentTitleMeta);
      }
      showCinemaInfoOverlay({ force: true, autoHide: true, ms: 8000 });
      // Kick meta fetch if we only have a letter placeholder so far.
      try { refreshCurrentMeta(); } catch (err) {}
    }

    function programmePosterUrl(programme, metaPayload) {
      const m = metaPayload && metaPayload.meta;
      return (
        (programme && (programme.poster_url || programme.image))
        || (metaPayload && metaPayload.has_data && m && m.poster_url)
        || (m && m.poster_url)
        || ""
      );
    }

    function updateCinemaOverlay(meta, epgData, metaPayload, forceShow) {
      if (!cinemaTitle) return;
      const name = meta ? (meta.name || ("Channel " + meta.channel_id)) : "";
      const epg = epgData !== undefined ? epgData : (meta ? getCachedEntry(epgCache, String(meta.channel_id)) : null);
      const prog = epg && epg.now;
      const m = metaPayload && metaPayload.meta;
      // Never promote WOFTV plot (stored in subtitle) to the hero title.
      const title = (prog && prog.title) || name || "Live";
      cinemaTitle.textContent = title;
      const overview = (
        (prog && isPlotLikeText(prog.subtitle) ? prog.subtitle : "")
        || (m && m.overview)
        || ""
      ).trim();
      if (cinemaOverview) {
        cinemaOverview.textContent = overview;
        cinemaOverview.style.display = overview ? "" : "none";
      }
      const subBits = [name];
      if (prog) {
        const epCode = programmeMetaShort(prog);
        if (epCode && /^S\d+E\d+/i.test(epCode)) subBits.push(epCode);
      }
      if (m && m.year) subBits.push(String(m.year));
      else if (prog && prog.year) subBits.push(String(prog.year));
      if (m && m.genres && m.genres.length) subBits.push(m.genres.slice(0, 2).join(" · "));
      else if (prog && prog.category && prog.category !== "EPG") subBits.push(prog.category);
      if (cinemaSub) cinemaSub.textContent = subBits.filter(Boolean).join(" · ");
      const timeBits = [];
      if (prog && prog.start && prog.stop) timeBits.push(formatTimeRange(prog.start, prog.stop, false));
      if (prog && prog.stop) timeBits.push(minsRemaining(prog.stop) + " minutes left");
      if (meta) {
        const chNum = meta.number != null ? meta.number : (orderIds.indexOf(String(meta.channel_id)) + 1 || "?");
        timeBits.push("Ch " + chNum);
      }
      if (cinemaTime) cinemaTime.textContent = timeBits.join(" · ");

      const posterUrl = programmePosterUrl(prog, metaPayload);
      const logoUrl = channelLogoUrl(meta);
      const showPh = (letter) => {
        if (!cinemaPosterPh) return;
        cinemaPosterPh.textContent = letter || "TV";
        cinemaPosterPh.classList.remove("loading");
        cinemaPosterPh.classList.add("show");
      };
      const showLoading = () => {
        if (!cinemaPosterPh) return;
        cinemaPosterPh.textContent = "…";
        cinemaPosterPh.classList.add("show", "loading");
      };
      const hidePh = () => {
        if (!cinemaPosterPh) return;
        cinemaPosterPh.classList.remove("show", "loading");
      };
      if (cinemaPosterLg) {
        if (posterUrl) {
          hidePh();
          setPosterImage(cinemaPosterLg, posterUrl, () => {
            if (logoUrl) {
              setPosterImage(cinemaPosterLg, logoUrl, () => {
                cinemaPosterLg.classList.remove("show");
                cinemaPosterLg.removeAttribute("src");
                showPh(channelLetter(meta));
              });
            } else {
              cinemaPosterLg.classList.remove("show");
              cinemaPosterLg.removeAttribute("src");
              showPh(channelLetter(meta));
            }
          });
        } else if (metaPayload && metaPayload._posterPending) {
          cinemaPosterLg.classList.remove("show");
          cinemaPosterLg.removeAttribute("src");
          showLoading();
        } else if (logoUrl) {
          hidePh();
          setPosterImage(cinemaPosterLg, logoUrl, () => {
            cinemaPosterLg.classList.remove("show");
            cinemaPosterLg.removeAttribute("src");
            showPh(channelLetter(meta));
          });
        } else {
          cinemaPosterLg.classList.remove("show");
          cinemaPosterLg.removeAttribute("src");
          showPh(channelLetter(meta));
        }
      }
      const infoKey = String(meta && meta.channel_id || "") + "|" + title + "|" + (prog && prog.start || "");
      showCinemaInfoOverlay({
        key: infoKey,
        onlyIfChanged: !forceShow,
        force: !!forceShow,
        autoHide: true,
        ms: forceShow ? 6500 : undefined,
      });
    }

    let vodHeroTrailerId = null;
    let vodTrailerLayoutMode = "";
    let vodTrailerLayoutTimer = null;
    let vodHeroTrailerLoops = 0;
    let vodHeroTrailerSettled = false;
    let vodHeroTrailerEnding = false;
    let vodHeroTrailerMsgBound = false;
    let liveAudioHold = null;

    function pickVodTrailerLayout() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const landscapePhone = w > h && h <= 520;
      if (w <= 560 || landscapePhone) return "cinema";
      if (w <= 900 || h <= 640) return "tall";
      return "wide";
    }

    function buildVodTrailerMarkup() {
      return '<div class="vod-detail-trailer" id="vodDetailTrailerWrap" role="button" tabindex="0" aria-label="Expand trailer">'
        + '<iframe id="vodHeroTrailerFrame" title="Trailer preview"'
        + ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"'
        + ' allowfullscreen></iframe></div>';
    }

    function buildVodTrailerMuteBtn() {
      return '<button type="button" class="vod-trailer-mute-btn" id="vodTrailerMuteBtn" aria-label="Toggle trailer mute">🔇</button>';
    }

    function buildVodTrailerUi() {
      return '<div class="vod-detail-trailer-ui">'
        + '<span class="vod-detail-trailer-badge">Trailer</span>'
        + '<button type="button" class="vod-detail-trailer-expand" aria-label="Expand trailer with sound">⛶ Expand</button>'
        + "</div>";
    }

    function wireVodTrailerControls(youtubeId) {
      const media = document.getElementById("vodTrailerHeroSlot");
      const wrap = document.getElementById("vodDetailTrailerWrap");
      const expandBtn = document.querySelector(".vod-detail-trailer-expand");
      const expand = () => expandVodHeroTrailer(youtubeId);
      for (const el of [media, wrap]) {
        if (!el) continue;
        el.onclick = expand;
        el.onkeydown = (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); expand(); }
        };
      }
      if (expandBtn) expandBtn.onclick = (e) => { e.stopPropagation(); expand(); };
      const muteBtn = document.getElementById("vodTrailerMuteBtn");
      if (muteBtn) muteBtn.onclick = (e) => { e.stopPropagation(); toggleVodTrailerMute(); };
      if (vodDetailHero) {
        vodDetailHero.onclick = (e) => {
          if (!vodHeroTrailerSettled) return;
          if (e.target.closest(".vod-detail-nav, .vod-trailer-replay-btn, .vod-trailer-mute-btn, .vod-detail-main, .vod-detail-trailer-ui, .vod-detail-actions")) return;
          expand();
        };
      }
    }

    function layoutVodDetailTrailer(forceRemount) {
      if (!vodDetailHero) return;
      const mode = pickVodTrailerLayout();
      if (mode === vodTrailerLayoutMode && !forceRemount) return;
      vodTrailerLayoutMode = mode;
      vodDetailHero.classList.remove("trailer-wide", "trailer-tall", "trailer-cinema");
      vodDetailHero.classList.add("trailer-" + mode);
    }

    function scheduleVodTrailerLayout(forceRemount) {
      clearTimeout(vodTrailerLayoutTimer);
      vodTrailerLayoutTimer = setTimeout(() => layoutVodDetailTrailer(!!forceRemount), 80);
    }

    function bindVodTrailerLayout() {
      if (window.__sdVodTrailerLayoutBound) return;
      window.__sdVodTrailerLayoutBound = true;
      window.addEventListener("resize", () => scheduleVodTrailerLayout(false), { passive: true });
      window.addEventListener("orientationchange", () => scheduleVodTrailerLayout(true), { passive: true });
    }

    function normalizeYoutubeId(value) {
      if (!value) return "";
      const raw = String(value).trim();
      if (/^[a-zA-Z0-9_-]{6,}$/.test(raw)) return raw;
      try {
        const u = new URL(raw);
        if (u.hostname.includes("youtu.be")) return u.pathname.replace(/^\//, "").split("/")[0] || "";
        if (u.searchParams.get("v")) return u.searchParams.get("v");
        const parts = u.pathname.split("/").filter(Boolean);
        const embedIdx = parts.indexOf("embed");
        if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
      } catch (e) {}
      return raw;
    }

    function buildYoutubeEmbedUrl(id, opts) {
      if (!id) return "";
      opts = opts || {};
      const params = new URLSearchParams();
      params.set("autoplay", opts.autoplay === false ? "0" : "1");
      if (opts.mute) params.set("mute", "1");
      params.set("rel", "0");
      params.set("modestbranding", "1");
      params.set("playsinline", "1");
      if (opts.controls === false) params.set("controls", "0");
      if (opts.loop) {
        params.set("loop", "1");
        params.set("playlist", id);
      }
      if (opts.enablejsapi) {
        params.set("enablejsapi", "1");
        params.set("origin", location.origin);
      }
      return "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id) + "?" + params.toString();
    }

    function updateVodTrailerMuteBtn(useSound) {
      const muteBtn = document.getElementById("vodTrailerMuteBtn");
      if (muteBtn) muteBtn.textContent = useSound ? "🔊" : "🔇";
    }

    function postVodHeroTrailerCommand(func, args) {
      const frame = getVodHeroTrailerFrame();
      if (!frame || !frame.contentWindow || !frame.src) return;
      try {
        frame.contentWindow.postMessage(JSON.stringify({ event: "command", func: func, args: args || [] }), "*");
      } catch (e) {}
    }

    function bindVodHeroTrailerMessages() {
      if (vodHeroTrailerMsgBound) return;
      vodHeroTrailerMsgBound = true;
      window.addEventListener("message", (event) => {
        if (!vodHeroTrailerId || vodHeroTrailerSettled) return;
        if (!event.origin.includes("youtube.com") && !event.origin.includes("youtube-nocookie.com")) return;
        let data;
        try { data = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch (e) { return; }
        if (!data || typeof data !== "object") return;
        if (data.event === "onStateChange" && data.info === 0) {
          onVodHeroTrailerEnded();
          return;
        }
        if (data.event === "infoDelivery" && data.info && data.info.playerState === 0) {
          onVodHeroTrailerEnded();
          return;
        }
        if (data.event === "infoDelivery" && data.info && data.info.playerState === 1) {
          syncLiveAudioForVodTrailer(isVodHeroTrailerAudible());
        }
      });
    }

    function isVodHeroTrailerAudible() {
      if (vodHeroTrailerSettled) return false;
      if (!vodHeroTrailerId || !vodDetail || !vodDetail.classList.contains("show")) return false;
      if (trailerActive || vodPickerOpen) return false;
      if (localStorage.getItem(LS_VOD_TRAILER_MUTED) === "1") return false;
      return vodTrailerShouldUseSound();
    }

    function syncLiveAudioForVodTrailer(audible) {
      const shouldDuck = audible !== undefined ? !!audible : isVodHeroTrailerAudible();
      if (shouldDuck) {
        if (!liveAudioHold) {
          liveAudioHold = { muted: v.muted, wasPlaying: !v.paused };
          v.muted = true;
        }
        return;
      }
      if (liveAudioHold) {
        v.muted = liveAudioHold.muted;
        if (liveAudioHold.wasPlaying && v.paused && currentStreamUrl && !trailerActive && !vodHlsActive) {
          tryPlay().catch(() => {});
        }
        liveAudioHold = null;
      }
    }

    function onVodHeroTrailerEnded() {
      if (vodHeroTrailerSettled || vodHeroTrailerEnding) return;
      vodHeroTrailerEnding = true;
      setTimeout(() => { vodHeroTrailerEnding = false; }, 500);
      vodHeroTrailerLoops += 1;
      if (vodHeroTrailerLoops >= VOD_TRAILER_MAX_LOOPS) {
        settleVodHeroTrailer();
        return;
      }
      postVodHeroTrailerCommand("seekTo", [0, true]);
      postVodHeroTrailerCommand("playVideo");
    }

    function removeVodHeroReplayBtn() {
      const replay = document.getElementById("vodTrailerReplayBtn");
      if (replay) replay.remove();
    }

    function ensureVodHeroReplayUi() {
      if (!vodDetailHero || document.getElementById("vodTrailerReplayBtn")) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "vod-trailer-replay-btn";
      btn.id = "vodTrailerReplayBtn";
      btn.textContent = "▶ Replay trailer";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        replayVodHeroTrailer();
      });
      vodDetailHero.appendChild(btn);
    }

    function settleVodHeroTrailer() {
      if (vodHeroTrailerSettled) return;
      vodHeroTrailerSettled = true;
      pauseVodHeroTrailer();
      syncLiveAudioForVodTrailer(false);
      if (!vodDetailHero) return;
      vodDetailHero.classList.add("trailer-settled");
      ensureVodHeroReplayUi();
    }

    function replayVodHeroTrailer() {
      if (!vodHeroTrailerId) return;
      vodHeroTrailerSettled = false;
      vodHeroTrailerLoops = 0;
      removeVodHeroReplayBtn();
      if (vodDetailHero) vodDetailHero.classList.remove("trailer-settled");
      mountVodHeroTrailer(vodHeroTrailerId);
    }

    function getVodHeroTrailerFrame() {
      return document.getElementById("vodHeroTrailerFrame");
    }

    function mountVodHeroTrailer(youtubeId) {
      const id = normalizeYoutubeId(youtubeId);
      if (!id) return;
      bindVodHeroTrailerMessages();
      vodHeroTrailerId = id;
      vodHeroTrailerSettled = false;
      vodHeroTrailerLoops = 0;
      removeVodHeroReplayBtn();
      if (vodDetailHero) vodDetailHero.classList.remove("trailer-settled");
      const frame = getVodHeroTrailerFrame();
      if (!frame) return;
      const useSound = vodTrailerShouldUseSound();
      frame.src = buildYoutubeEmbedUrl(id, { mute: !useSound, controls: false, loop: false, enablejsapi: true });
      frame.onload = () => {
        try { frame.contentWindow.postMessage(JSON.stringify({ event: "listening" }), "*"); } catch (e) {}
      };
      updateVodTrailerMuteBtn(useSound);
      syncLiveAudioForVodTrailer(useSound);
    }

    function toggleVodTrailerMute() {
      if (vodHeroTrailerSettled) return;
      const willMute = !vodTrailersStartMuted();
      setVodTrailersStartMuted(willMute);
      const frame = getVodHeroTrailerFrame();
      if (frame && frame.src) {
        postVodHeroTrailerCommand(willMute ? "mute" : "unMute");
        updateVodTrailerMuteBtn(!willMute);
        syncLiveAudioForVodTrailer(!willMute);
        return;
      }
      if (vodHeroTrailerId) mountVodHeroTrailer(vodHeroTrailerId);
    }

    function pauseVodHeroTrailer() {
      const frame = getVodHeroTrailerFrame();
      if (frame) frame.src = "";
    }

    function stopVodHeroTrailer() {
      pauseVodHeroTrailer();
      vodHeroTrailerId = null;
      vodHeroTrailerLoops = 0;
      vodHeroTrailerSettled = false;
      vodTrailerLayoutMode = "";
      removeVodHeroReplayBtn();
      syncLiveAudioForVodTrailer(false);
      if (vodDetailHero) {
        vodDetailHero.classList.remove("has-trailer", "trailer-wide", "trailer-tall", "trailer-cinema", "trailer-settled");
      }
    }

    function expandVodHeroTrailer(youtubeId) {
      const id = normalizeYoutubeId(youtubeId || vodHeroTrailerId);
      if (!id) return;
      vodHeroTrailerId = id;
      pauseVodHeroTrailer();
      syncLiveAudioForVodTrailer(false);
      const btn = document.getElementById("vodDetailTrailer");
      if (btn) btn.classList.add("active");
      playTrailerInPlayer(id, "vod_detail_trailer");
    }

    function setVodTrailerButtonActive(active) {
      const btn = document.getElementById("vodDetailTrailer");
      if (btn) btn.classList.toggle("active", !!active);
    }

    function updateOverlayBackLabel() {
      if (!trailerBackBtn) return;
      if (overlayReturn && overlayReturn.kind !== "live") {
        trailerBackBtn.textContent = "← Back to film";
        trailerBackBtn.classList.add("embed-sticky-back");
      } else {
        trailerBackBtn.textContent = "← Back to live";
        trailerBackBtn.classList.remove("embed-sticky-back");
      }
    }

    function fmtEpisodeCode(season, episode) {
      const s = String(Math.max(1, parseInt(season, 10) || 1)).padStart(2, "0");
      const e = String(Math.max(1, parseInt(episode, 10) || 1)).padStart(2, "0");
      return "S" + s + " · E" + e;
    }

    function clearSeriesSession() {
      cancelEpisodeAutoAdvance();
      hideVodStartGate();
      hideVodStreamStatus();
      hideEpisodeChrome(true);
      vodSeriesSession = null;
      if (vodEpChrome) vodEpChrome.hidden = true;
      if (vodEpNextUp) vodEpNextUp.hidden = true;
      if (trailerLayer) trailerLayer.classList.remove("has-ep-chrome");
    }

    function hideEpisodeChrome(force) {
      if (vodEpChromeHideTimer) { clearTimeout(vodEpChromeHideTimer); vodEpChromeHideTimer = null; }
      if (!vodEpChrome) return;
      if (!force && vodEpChrome.classList.contains("pinned")) return;
      vodEpChrome.classList.remove("show");
    }

    function revealEpisodeChrome(holdMs) {
      if (!vodEpChrome || vodEpChrome.hidden) return;
      vodEpChrome.classList.add("show");
      if (vodEpChromeHideTimer) clearTimeout(vodEpChromeHideTimer);
      if (vodEpChrome.classList.contains("pinned")) return;
      vodEpChromeHideTimer = setTimeout(() => {
        vodEpChrome.classList.remove("show");
        vodEpChromeHideTimer = null;
      }, holdMs != null ? holdMs : 2200);
    }

    function bindEpisodeChromeAutoHide() {
      if (!trailerLayer || trailerLayer.dataset.epChromeBound === "1") return;
      trailerLayer.dataset.epChromeBound = "1";
      trailerLayer.addEventListener("mousemove", (e) => {
        if (!vodEpChrome || vodEpChrome.hidden) return;
        const rect = trailerLayer.getBoundingClientRect();
        if ((rect.bottom - e.clientY) <= 100) revealEpisodeChrome(2200);
        else if (!vodEpChrome.classList.contains("pinned") && !vodEpChrome.matches(":hover")) {
          hideEpisodeChrome();
        }
      });
      trailerLayer.addEventListener("mouseleave", () => hideEpisodeChrome());
      if (vodEpHotzone) {
        vodEpHotzone.addEventListener("mouseenter", () => revealEpisodeChrome(2600));
        vodEpHotzone.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          revealEpisodeChrome(3200);
        });
      }
      if (vodEpChrome) {
        vodEpChrome.addEventListener("mouseenter", () => {
          if (vodEpChromeHideTimer) clearTimeout(vodEpChromeHideTimer);
          vodEpChrome.classList.add("show");
        });
        vodEpChrome.addEventListener("mouseleave", () => revealEpisodeChrome(1200));
      }
      trailerLayer.addEventListener("touchstart", (e) => {
        if (!vodEpChrome || vodEpChrome.hidden) return;
        const t = e.touches && e.touches[0];
        if (!t) return;
        const rect = trailerLayer.getBoundingClientRect();
        if ((rect.bottom - t.clientY) <= 120) revealEpisodeChrome(3200);
      }, { passive: true });
    }

    function hideVodStreamStatus() {
      if (vodStreamStatus) {
        vodStreamStatus.hidden = true;
        vodStreamStatus.classList.remove("busy");
      }
    }

    function showVodStreamStatus(text, opts) {
      if (!vodStreamStatus) return;
      opts = opts || {};
      vodStreamStatus.textContent = text || "Finding stream…";
      vodStreamStatus.classList.toggle("busy", !!opts.busy);
      vodStreamStatus.hidden = false;
    }

    function hideVodStartGate() {
      vodStartGatePending = null;
      if (vodStartGate) vodStartGate.hidden = true;
      if (trailerLayer) trailerLayer.classList.remove("gate-open");
      if (vodStartGateEmbed) vodStartGateEmbed.hidden = true;
    }

    function withEmbedAutoplay(url) {
      if (!url) return url;
      try {
        const u = new URL(url, location.href);
        const host = u.hostname.toLowerCase();
        u.searchParams.set("autoplay", "1");
        if (/vsembed|vidsrc|vidlink|primesrc|moviesapi|vidzee|videasy|smashy|multiembed/.test(host)) {
          u.searchParams.set("autoPlay", "true");
        }
        return u.toString();
      } catch (e) {
        return url;
      }
    }

    function buildDefaultEmbedUrl(ctx) {
      if (!ctx || !ctx.tmdbId) return "";
      const tid = encodeURIComponent(String(ctx.tmdbId));
      const kind = String(ctx.mediaType || "movie").toLowerCase();
      const isTv = kind === "tv" || kind === "series" || kind === "show";
      const s = Math.max(1, parseInt(ctx.season, 10) || 1);
      const e = Math.max(1, parseInt(ctx.episode, 10) || 1);
      // Frameable instant embeds for Auto. VidZee is XFO SAMEORIGIN — blank in our iframe.
      const clean = isTv
        ? [
            "https://player.videasy.net/tv/" + tid + "/" + s + "/" + e,
            "https://embed.smashystream.com/playere.php?tmdb=" + tid + "&season=" + s + "&episode=" + e,
            "https://vixsrc.to/tv/" + tid + "/" + s + "/" + e + "?lang=en",
          ]
        : [
            "https://player.videasy.net/movie/" + tid,
            "https://embed.smashystream.com/playere.php?tmdb=" + tid,
            "https://vixsrc.to/movie/" + tid + "?lang=en",
          ];
      return withEmbedAutoplay(clean[0]);
    }

    function embedUrlFrameable(url) {
      try {
        const host = new URL(String(url || ""), location.href).hostname.toLowerCase();
        if (!host) return true;
        if (host === "player.vidzee.wtf" || host.endsWith(".vidzee.wtf") || host === "vidzee.wtf") {
          return false;
        }
        return true;
      } catch (e) {
        return true;
      }
    }

    function firstEmbedSource(sources) {
      if (!sources || !sources.length) return null;
      const preferredIds = ["videasy", "smashy", "vixsrc", "vidzee"];
      for (const id of preferredIds) {
        const hit = sources.find((s) => s.id === id && s.embed_url && !s.auto && embedUrlFrameable(s.embed_url));
        if (hit) return hit;
      }
      return sources.find((s) => s.embed_url && !s.auto && embedUrlFrameable(s.embed_url) && s.risk === "preferred")
        || sources.find((s) => s.embed_url && !s.auto && embedUrlFrameable(s.embed_url) && s.risk !== "risky")
        || sources.find((s) => s.embed_url && !s.auto && embedUrlFrameable(s.embed_url))
        || sources.find((s) => s.embed_url && !s.auto)
        || sources.find((s) => s.embed_url)
        || null;
    }


    function formatVodStartSub(ctx) {
      if (!ctx) return "";
      const bits = [];
      if (ctx.title) bits.push(ctx.title);
      if (ctx.mediaType === "tv" || ctx.season) {
        bits.push(fmtEpisodeCode(ctx.season || 1, ctx.episode || 1));
      }
      return bits.join(" · ");
    }

    function rememberLiveStreamUrl(url) {
      const u = String(url || currentStreamUrl || "").split("?")[0];
      if (!u) return;
      // Never remember VOD file/hls endpoints as the live resume target.
      if (/\/vod\//i.test(u) || /\/vod\/file\//i.test(u) || /\/vod\/hls\//i.test(u)) return;
      liveStreamUrl = u;
    }

    function isLiveStreamUrl(url) {
      const u = String(url || "");
      if (!u || /\/vod\//i.test(u)) return false;
      return /\/live\/|\/dulo-stream\/|\/ntv-stream\/|\/stream\/|\/content\//i.test(u) || !/\/vod\//i.test(u);
    }

    async function restoreLiveChannelPlayback(reason) {
      // Idempotent re-attach of live HLS after VOD/embed teardown.
      if (restoreLiveInflight) return restoreLiveInflight;
      restoreLiveInflight = (async () => {
        try {
          // Force-clear VOD overlay leftovers without recursing into catalog restore.
          overlayStopping = true;
          trailerActive = false;
          vodHlsActive = false;
          liveEmbedActive = false;
          overlayReturn = null;
          try { if (window.SDEmbed && SDEmbed.stop) SDEmbed.stop(); } catch (e) {}
          try { if (window.SDMobile && SDMobile.exitImmersive) SDMobile.exitImmersive(); } catch (e) {}
          if (tvRoot) {
            tvRoot.classList.remove(
              "trailer-active",
              "overlay-active",
              "overlay-playback",
              "vod-hls-playing",
              "pc-controls-locked",
              "live-embed-active"
            );
          }
          if (trailerFrame) trailerFrame.src = "";
          if (trailerLayer) {
            trailerLayer.classList.remove("show", "hls-mode", "has-hls-chrome", "embed-mode", "live-embed-mode", "gate-open");
            trailerLayer.setAttribute("aria-hidden", "true");
          }
          hideVodStartGate();
          hideVodStreamStatus();
          clearSeriesSession();
          closeVodPickerPanel();
          updateOverlayBackLabel();
          setVodTrailerButtonActive(false);
          try { clearBufferOverlay(); } catch (e) {}
          try { hideTapPlayGate(); } catch (e) {}
          overlayStopping = false;

          const ch = channelId || resolveInitialChannel();
          let url = liveStreamUrl;
          if (!url || !isLiveStreamUrl(url)) {
            url = ch ? ("/live/" + encodeURIComponent(ch) + ".m3u8") : "";
          }
          try {
            if (ch) {
              const meta = await loadNeighbors(ch);
              if (meta && meta.stream_url) url = meta.stream_url;
              try { updateHeader(meta); } catch (e) {}
            }
          } catch (e) {}
          if (!url) return;
          rememberLiveStreamUrl(url);
          autoplayPolicyBlocked = false;
          userGestureSeen = true;
          playRetryCount = 0;
          policyRetryCount = 0;
          reloadAttempts = 0;
          liveEmbedFailCount = 0;
          // Prefer unmuted via tryPlay; muted fallback if browser blocks sound.
          try {
            if (liveStartMutedEnabled()) {
              v.muted = true;
              v.setAttribute("muted", "");
            } else {
              v.muted = false;
              try { v.removeAttribute("muted"); } catch (e2) {}
            }
          } catch (e) {}
          await attachHls(url);
        } finally {
          restoreLiveInflight = null;
        }
      })();
      return restoreLiveInflight;
    }
    window.SDRestoreLivePlayback = restoreLiveChannelPlayback;

    function teardownDirectVodPlayer() {
      const wasHls = vodHlsActive;
      vodHlsActive = false;
      if (tvRoot) tvRoot.classList.remove("vod-hls-playing", "pc-controls-locked");
      if (trailerLayer) {
        trailerLayer.classList.remove("hls-mode", "has-hls-chrome");
      }
      const bar = document.getElementById("hlsChrome");
      if (bar) {
        bar.classList.remove("show", "pinned");
        bar.classList.add("idle");
        bar.querySelectorAll(".hls-menu.open").forEach((m) => m.classList.remove("open"));
      }
      const xraySheet = document.getElementById("pcXraySheet");
      if (xraySheet) {
        xraySheet.classList.remove("open");
        xraySheet.setAttribute("aria-hidden", "true");
      }
      try {
        if (window.SDCinema && SDCinema.stopDualAudio) SDCinema.stopDualAudio();
      } catch (e) {}
      try {
        if (window.SDEmbed && SDEmbed.stop) SDEmbed.stop();
      } catch (e) {}
      try { v.pause(); } catch (e) {}
      if (wasHls || (typeof hls !== "undefined" && hls) || (v && (v.src || v.currentSrc))) {
        try {
          if (typeof destroyHls === "function") destroyHls();
        } catch (e) {}
      }
      // Clear active URL but keep liveStreamUrl for restore-after-VOD.
      try {
        if (!isLiveStreamUrl(currentStreamUrl)) currentStreamUrl = "";
        else rememberLiveStreamUrl(currentStreamUrl);
      } catch (e) {}
    }

    function prepareOverlayShell(returnKind, ctx) {
      beginOverlayPlayback(returnKind || "vod_picker", ctx);
      trailerActive = true;
      teardownDirectVodPlayer();
      if (tvRoot) {
        tvRoot.classList.add("trailer-active", "overlay-active");
        tvRoot.classList.remove("vod-hls-playing");
      }
      try { v.pause(); } catch (e) {}
      if (trailerFrame) trailerFrame.src = "";
      if (trailerLayer) {
        trailerLayer.classList.add("show");
        trailerLayer.classList.remove("hls-mode", "has-hls-chrome");
        trailerLayer.setAttribute("aria-hidden", "false");
      }
      closeVodPickerPanel();
      applyGuideState(true);
      revealCollapsedChrome(true);
      activateSeriesSession(ctx, returnKind || "vod_picker");
      updateOverlayBackLabel();
    }

    function showVodStartGate(ctx, returnKind, embedUrl) {
      prepareOverlayShell(returnKind, ctx);
      hideVodStreamStatus();
      vodStartGatePending = {
        mode: "embed_start",
        ctx: Object.assign({}, ctx || {}),
        returnKind: returnKind || "vod_picker",
        embedUrl: embedUrl || "",
      };
      if (vodStartGateLabel) vodStartGateLabel.textContent = "Tap to start";
      if (vodStartGateSub) vodStartGateSub.textContent = formatVodStartSub(ctx);
      if (vodStartGateEmbed) vodStartGateEmbed.hidden = true;
      if (trailerLayer) trailerLayer.classList.add("gate-open");
      if (vodStartGate) vodStartGate.hidden = false;
    }

    async function showVodHlsFailedGate(ctx, returnKind) {
      prepareOverlayShell(returnKind, ctx);
      hideVodStreamStatus();
      let embedUrl = "";
      try {
        embedUrl = buildDefaultEmbedUrl(ctx) || (await resolveBestEmbedUrl(ctx)) || "";
      } catch (e) {}
      vodStartGatePending = {
        mode: "hls_fail",
        ctx: Object.assign({}, ctx || {}),
        returnKind: returnKind || "vod_picker",
        embedUrl: embedUrl,
      };
      if (vodStartGateLabel) vodStartGateLabel.textContent = "Retry direct stream";
      if (vodStartGateSub) {
        vodStartGateSub.textContent = "No ad-free HLS yet · "
          + (formatVodStartSub(ctx) || "try again or pick a source");
      }
      if (vodStartGateEmbed) {
        vodStartGateEmbed.hidden = !embedUrl;
        vodStartGateEmbed.textContent = "Use embed (may have ads)";
      }
      if (trailerLayer) trailerLayer.classList.add("gate-open");
      if (vodStartGate) vodStartGate.hidden = false;
    }

    async function resolveBestEmbedUrl(ctx) {
      if (!ctx || !ctx.tmdbId) return "";
      try {
        let url = "/vod/resolve?tmdb_id=" + encodeURIComponent(ctx.tmdbId)
          + "&type=" + encodeURIComponent(ctx.mediaType || "movie")
          + "&lang=" + encodeURIComponent(vodPreferLang());
        if (ctx.season) url += "&season=" + encodeURIComponent(ctx.season);
        if (ctx.episode) url += "&episode=" + encodeURIComponent(ctx.episode);
        const r = await authFetch(url, { cache: "no-store" });
        if (r.ok) {
          const data = await r.json();
          if (data.embed_url) return data.embed_url;
        }
      } catch (e) {}
      try {
        let srcUrl = "/vod/sources?tmdb_id=" + encodeURIComponent(ctx.tmdbId)
          + "&type=" + encodeURIComponent(ctx.mediaType || "movie")
          + "&lang=" + encodeURIComponent(vodPreferLang())
          + "&prefer_lang=" + encodeURIComponent(vodPreferLang());
        if (ctx.season) srcUrl += "&season=" + encodeURIComponent(ctx.season);
        if (ctx.episode) srcUrl += "&episode=" + encodeURIComponent(ctx.episode);
        const sr = await authFetch(srcUrl, { cache: "no-store" });
        if (!sr.ok) return "";
        const sdata = await sr.json();
        const pick = firstEmbedSource(sdata.sources || []);
        return (pick && pick.embed_url) || "";
      } catch (e) {
        return "";
      }
    }

    function cancelEpisodeAutoAdvance() {
      if (vodEpNextTimer) { clearTimeout(vodEpNextTimer); vodEpNextTimer = null; }
      if (vodEpNextRaf) { cancelAnimationFrame(vodEpNextRaf); vodEpNextRaf = null; }
      vodEpNextTarget = null;
      if (vodEpNextUp) vodEpNextUp.hidden = true;
      if (vodEpNextUpFill) vodEpNextUpFill.style.width = "0%";
      if (vodEpChrome) vodEpChrome.classList.remove("pinned");
    }

    async function loadSeasonEpisodes(tmdbId, season) {
      const key = String(tmdbId) + ":" + String(season);
      if (vodSeasonEpCache.has(key)) return vodSeasonEpCache.get(key);
      try {
        const r = await authFetch("/vod/catalog/tv/" + encodeURIComponent(tmdbId) + "/season/" + encodeURIComponent(season), { cache: "no-store" });
        if (!r.ok) throw new Error("season_failed");
        const data = await r.json();
        const eps = data.episodes || [];
        vodSeasonEpCache.set(key, eps);
        return eps;
      } catch (e) {
        vodSeasonEpCache.set(key, []);
        return [];
      }
    }

    async function ensureSeriesSeasonsMeta(session) {
      if (!session || !session.tmdbId) return;
      if (session.seasons && session.seasons.length) return;
      if (vodCatalogDetail && String(vodCatalogDetail.tmdb_id) === String(session.tmdbId) && vodCatalogDetail.seasons) {
        session.seasons = (vodCatalogDetail.seasons || []).filter((s) => Number(s.season) >= 1);
        if (!session.title && vodCatalogDetail.title) session.title = vodCatalogDetail.title;
        return;
      }
      try {
        const r = await authFetch("/vod/catalog/tv/" + encodeURIComponent(session.tmdbId), { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        session.seasons = (d.seasons || []).filter((s) => Number(s.season) >= 1);
        if (!session.title && d.title) session.title = d.title;
      } catch (e) {}
    }

    async function activateSeriesSession(ctx, returnKind) {
      if (!ctx || !ctx.tmdbId) { clearSeriesSession(); return; }
      const mediaType = (ctx.mediaType || "movie").toLowerCase();
      if (mediaType !== "tv" && mediaType !== "series" && mediaType !== "show") {
        clearSeriesSession();
        return;
      }
      const season = parseInt(ctx.season, 10) || 1;
      const episode = parseInt(ctx.episode, 10) || 1;
      vodSeriesSession = {
        tmdbId: String(ctx.tmdbId),
        title: ctx.title || (vodCatalogDetail && vodCatalogDetail.title) || "",
        mediaType: "tv",
        season: season,
        episode: episode,
        episodeTitle: ctx.episodeTitle || "",
        seasons: (vodCatalogDetail && String(vodCatalogDetail.tmdb_id) === String(ctx.tmdbId) && vodCatalogDetail.seasons)
          ? (vodCatalogDetail.seasons || []).filter((s) => Number(s.season) >= 1)
          : (vodSeriesSession && vodSeriesSession.tmdbId === String(ctx.tmdbId) ? (vodSeriesSession.seasons || []) : []),
        returnKind: returnKind || "vod_picker",
      };
      await refreshEpisodeChrome();
    }

    async function refreshEpisodeChrome() {
      const s = vodSeriesSession;
      if (!s || !vodEpChrome) return;
      bindEpisodeChromeAutoHide();
      vodEpChrome.hidden = false;
      if (trailerLayer) trailerLayer.classList.add("has-ep-chrome");
      if (vodEpLabel) vodEpLabel.textContent = fmtEpisodeCode(s.season, s.episode);
      if (vodEpName) vodEpName.textContent = s.episodeTitle || s.title || "Episode";
      if (vodEpAutoBtn) {
        const on = vodAutoNextEnabled();
        vodEpAutoBtn.classList.toggle("active", on);
        vodEpAutoBtn.setAttribute("aria-pressed", on ? "true" : "false");
      }
      revealEpisodeChrome(2800);
      await ensureSeriesSeasonsMeta(s);
      const eps = await loadSeasonEpisodes(s.tmdbId, s.season);
      const cur = eps.find((ep) => Number(ep.episode) === Number(s.episode));
      if (cur && cur.title) {
        s.episodeTitle = cur.title;
        if (vodEpName) vodEpName.textContent = cur.title;
      }
      const prev = await resolveAdjacentEpisode(-1);
      const next = await resolveAdjacentEpisode(1);
      if (vodEpPrev) vodEpPrev.disabled = !prev;
      if (vodEpNext) vodEpNext.disabled = !next;
    }

    async function resolveAdjacentEpisode(delta) {
      const s = vodSeriesSession;
      if (!s) return null;
      await ensureSeriesSeasonsMeta(s);
      const season = Number(s.season);
      const episode = Number(s.episode);
      const eps = await loadSeasonEpisodes(s.tmdbId, season);
      const idx = eps.findIndex((ep) => Number(ep.episode) === episode);
      if (idx >= 0) {
        const hit = eps[idx + delta];
        if (hit) {
          return { season: season, episode: Number(hit.episode), title: hit.title || ("Episode " + hit.episode) };
        }
      } else if (delta > 0) {
        const higher = eps.find((ep) => Number(ep.episode) > episode);
        if (higher) return { season: season, episode: Number(higher.episode), title: higher.title };
      } else if (delta < 0) {
        const lower = [...eps].reverse().find((ep) => Number(ep.episode) < episode);
        if (lower) return { season: season, episode: Number(lower.episode), title: lower.title };
      }
      const seasons = (s.seasons || []).map((x) => Number(x.season)).filter((n) => n >= 1).sort((a, b) => a - b);
      let si = seasons.indexOf(season);
      if (si < 0 && seasons.length) {
        si = seasons.findIndex((n) => n >= season);
        if (si < 0) si = seasons.length - 1;
      }
      if (delta > 0 && si >= 0 && si < seasons.length - 1) {
        const nextSeason = seasons[si + 1];
        const nextEps = await loadSeasonEpisodes(s.tmdbId, nextSeason);
        if (nextEps.length) {
          const first = nextEps[0];
          return { season: nextSeason, episode: Number(first.episode), title: first.title || ("Episode " + first.episode) };
        }
      }
      if (delta < 0 && si > 0) {
        const prevSeason = seasons[si - 1];
        const prevEps = await loadSeasonEpisodes(s.tmdbId, prevSeason);
        if (prevEps.length) {
          const last = prevEps[prevEps.length - 1];
          return { season: prevSeason, episode: Number(last.episode), title: last.title || ("Episode " + last.episode) };
        }
      }
      return null;
    }

    async function playSeriesEpisode(season, episode, opts) {
      const s = vodSeriesSession;
      if (!s) return;
      opts = opts || {};
      cancelEpisodeAutoAdvance();
      const ctx = {
        tmdbId: s.tmdbId,
        mediaType: "tv",
        season: String(season),
        episode: String(episode),
        title: s.title || "",
        episodeTitle: opts.title || "",
      };
      s.season = Number(season);
      s.episode = Number(episode);
      s.episodeTitle = opts.title || "";
      vodPickerCtx = Object.assign({}, ctx);
      if (opts.forcePicker) {
        await refreshEpisodeChrome();
        openVodPickerForCtx(ctx);
        return;
      }
      await startVodPlayback(ctx, s.returnKind || "vod_picker");
    }

    async function stepSeriesEpisode(delta) {
      const target = await resolveAdjacentEpisode(delta);
      if (!target) return;
      await playSeriesEpisode(target.season, target.episode, { title: target.title });
    }

    function showNextEpisodePrompt(autoStart) {
      if (!vodSeriesSession || !vodEpNextUp) return;
      resolveAdjacentEpisode(1).then((target) => {
        if (!target) return;
        vodEpNextTarget = target;
        if (vodEpNextUpTitle) {
          vodEpNextUpTitle.textContent = fmtEpisodeCode(target.season, target.episode)
            + (target.title ? " · " + target.title : "");
        }
        vodEpNextUp.hidden = false;
        if (vodEpChrome) vodEpChrome.classList.add("pinned");
        if (!autoStart || !vodAutoNextEnabled()) {
          if (vodEpNextUpFill) vodEpNextUpFill.style.width = "0%";
          return;
        }
        const total = 8000;
        const started = performance.now();
        const tick = (now) => {
          const pct = Math.min(100, ((now - started) / total) * 100);
          if (vodEpNextUpFill) vodEpNextUpFill.style.width = pct + "%";
          if (pct >= 100) {
            vodEpNextRaf = null;
            const t = vodEpNextTarget;
            cancelEpisodeAutoAdvance();
            if (t) playSeriesEpisode(t.season, t.episode, { title: t.title });
            return;
          }
          vodEpNextRaf = requestAnimationFrame(tick);
        };
        vodEpNextRaf = requestAnimationFrame(tick);
      });
    }

    function onVodEpisodeEnded() {
      if (!vodHlsActive || !vodSeriesSession) return;
      showNextEpisodePrompt(true);
    }

    function beginOverlayPlayback(returnKind, pickerCtx) {
      rememberLiveStreamUrl();
      overlayReturn = {
        kind: returnKind || "live",
        pickerCtx: pickerCtx ? Object.assign({}, pickerCtx) : (vodPickerCtx ? Object.assign({}, vodPickerCtx) : null),
        vodCatalogWasOpen: vodCatalogOpen,
        vodDetailWasOpen: vodDetail && vodDetail.classList.contains("show"),
        vodRoute: (history.state && history.state.sdVod) ? Object.assign({}, history.state.sdVod) : vodParseRoute(),
        xrayWasOpen: xrayOpen,
        liveStreamUrl: liveStreamUrl || "",
      };
      if (tvRoot) tvRoot.classList.add("overlay-playback");
      // Gapless BACK: push a same-URL play frame so Android/browser Back exits player first.
      try {
        if (!(history.state && history.state.sdVodPlay)) {
          const base = (history.state && typeof history.state === "object") ? Object.assign({}, history.state) : {};
          if (overlayReturn.vodRoute) base.sdVod = overlayReturn.vodRoute;
          base.sdVodPlay = 1;
          history.pushState(base, "", location.href);
        }
      } catch (e) {}
      updateOverlayBackLabel();
    }

    async function restoreOverlayReturn(ret) {
      if (!ret || ret.kind === "live") return;
      const backToFilm =
        ret.kind === "vod_detail" ||
        ret.kind === "vod_detail_trailer" ||
        ret.kind === "vod_picker" ||
        ret.kind === "xray_picker";
      if (ret.vodCatalogWasOpen || backToFilm) {
        openVodCatalogUI();
        if (ret.vodRoute) await applyVodRoute(ret.vodRoute, { keepSearch: true });
        else if ((ret.vodDetailWasOpen || backToFilm) && ret.pickerCtx && ret.pickerCtx.tmdbId) {
          await applyVodRoute({
            view: "detail",
            type: ret.pickerCtx.mediaType === "tv" ? "tv" : "movie",
            tmdbId: String(ret.pickerCtx.tmdbId),
          }, { keepSearch: true });
        }
      }
      if (ret.xrayWasOpen && xrayPanel && xrayBackdrop) {
        xrayPanel.classList.add("open");
        xrayBackdrop.classList.add("show");
        xrayPanel.setAttribute("aria-hidden", "false");
        xrayBackdrop.setAttribute("aria-hidden", "false");
        xrayOpen = true;
      }
      // Source picker only when Back left a picker surface — not "Back to film" from detail play.
      if (ret.kind === "vod_picker" || ret.kind === "xray_picker") {
        if (ret.pickerCtx) await openVodPickerForCtx(ret.pickerCtx);
      }
    }

    function playEmbedInPlayer(embedUrl, returnKind, pickerCtx, opts) {
      if (!embedUrl || !trailerLayer || !trailerFrame) return;
      opts = opts || {};
      const ctx = pickerCtx || vodPickerCtx;
      if (ctx) vodPickerCtx = Object.assign({}, ctx);
      hideVodStartGate();
      hideVodStreamStatus();
      beginOverlayPlayback(returnKind || (vodCatalogOpen ? "vod_picker" : (xrayOpen ? "xray_trailer" : "live")), ctx);
      teardownDirectVodPlayer();
      trailerActive = true;
      if (tvRoot) {
        tvRoot.classList.add("trailer-active", "overlay-active");
        tvRoot.classList.remove("vod-hls-playing");
      }
      try { v.pause(); } catch (e) {}
      if (trailerLayer) {
        trailerLayer.classList.remove("hls-mode", "has-hls-chrome");
        trailerLayer.classList.add("embed-mode");
      }
      let finalUrl = opts.skipAutoplay ? embedUrl : withEmbedAutoplay(embedUrl);
      try {
        if (window.SDEmbed && SDEmbed.enhanceUrl) finalUrl = SDEmbed.enhanceUrl(finalUrl);
      } catch (e) {}
      try {
        if (trailerFrame) {
          // Preferred VOD hosts refuse to play when sandbox is present (Videasy error UI).
          // SDEmbed.hardenFrame applies the same open-frame policy + popup guard.
          if (window.SDEmbed && SDEmbed.hardenFrame) {
            SDEmbed.hardenFrame(finalUrl);
          } else {
            const host = (() => { try { return new URL(finalUrl, location.href).hostname.toLowerCase(); } catch (e) { return ""; } })();
            const openFrame = /(^|\.)videasy\.(net|to)$|(^|\.)smashystream\.com$|(^|\.)vixsrc\.to$/.test(host);
            if (openFrame) {
              trailerFrame.removeAttribute("sandbox");
              trailerFrame.setAttribute("referrerpolicy", "origin-when-cross-origin");
            } else {
              trailerFrame.setAttribute(
                "sandbox",
                "allow-scripts allow-same-origin allow-forms allow-presentation allow-fullscreen allow-pointer-lock"
              );
              trailerFrame.setAttribute("referrerpolicy", "no-referrer");
            }
          }
        }
      } catch (e) {}
      trailerFrame.src = finalUrl;
      trailerLayer.classList.add("show");
      trailerLayer.setAttribute("aria-hidden", "false");
      closeVodPickerPanel();
      peekFilmOverVodCatalog();
      applyGuideState(true);
      revealCollapsedChrome(true);
      activateSeriesSession(ctx, returnKind || "vod_picker");
      updateOverlayBackLabel();
      try {
        if (window.SDEmbed && SDEmbed.start) SDEmbed.start(finalUrl);
      } catch (e) {}
      try { if (window.SDMobile && SDMobile.enterImmersive) SDMobile.enterImmersive(document.getElementById("videoArea")); } catch (e) {}
    }

    function playTrailerInPlayer(youtubeId, returnKind) {
      const id = normalizeYoutubeId(youtubeId);
      if (!id) return;
      clearSeriesSession();
      playEmbedInPlayer(buildYoutubeEmbedUrl(id, { enablejsapi: true }), returnKind);
    }

    let overlayStopping = false;
    function stopOverlayPlayback() {
      if (overlayStopping) return;
      if (!trailerActive && !(trailerLayer && trailerLayer.classList.contains("show"))) return;
      overlayStopping = true;
      const ret = overlayReturn;
      const savedLive =
        (ret && ret.liveStreamUrl) ||
        liveStreamUrl ||
        (isLiveStreamUrl(currentStreamUrl) ? String(currentStreamUrl).split("?")[0] : "");
      if (savedLive) liveStreamUrl = savedLive;
      const resumeLive = !ret || ret.kind === "live";
      const consumePlayFrame = !!(history.state && history.state.sdVodPlay);
      trailerActive = false;
      teardownDirectVodPlayer();
      clearSeriesSession();
      if (tvRoot) tvRoot.classList.remove("trailer-active", "overlay-active", "overlay-playback", "vod-hls-playing", "live-embed-active");
      try { if (window.SDEmbed && SDEmbed.stop) SDEmbed.stop(); } catch (e) {}
      try { if (window.SDMobile && SDMobile.exitImmersive) SDMobile.exitImmersive(); } catch (e) {}
      liveEmbedActive = false;
      if (trailerFrame) trailerFrame.src = "";
      if (trailerLayer) {
        trailerLayer.classList.remove("show", "hls-mode", "has-hls-chrome", "embed-mode", "live-embed-mode", "gate-open");
        trailerLayer.setAttribute("aria-hidden", "true");
      }
      try { syncLiveEmbedChrome(); } catch (e) {}
      hideVodStartGate();
      hideVodStreamStatus();
      overlayReturn = null;
      updateOverlayBackLabel();
      setVodTrailerButtonActive(false);
      const finish = () => {
        overlayStopping = false;
        if (consumePlayFrame) {
          try { history.back(); } catch (e) {}
        }
      };
      if (!resumeLive) {
        // Stay in VOD catalog/detail; live is restored when the catalog closes.
        restoreOverlayReturn(ret).then(() => {
          if (ret.kind === "vod_detail_trailer" && vodHeroTrailerId) mountVodHeroTrailer(vodHeroTrailerId);
          finish();
        }).catch(finish);
        return;
      }
      restoreLiveChannelPlayback("stop-overlay-live").finally(finish);
    }

    function stopTrailerPlayback() { stopOverlayPlayback(); }

    function buildXrayActionButtons(programme, meta) {
      const m = meta || {};
      const kind = programmeKind(programme || {});
      const mediaType = (kind === "series") ? "tv" : "movie";
      const parts = [];
      if (m.trailer_youtube) {
        parts.push('<button type="button" class="xray-trailer" data-youtube-id="' + escapeHtml(String(m.trailer_youtube)) + '">▶ Watch trailer</button>');
      }
      const title = (m.matched_title || (programme && programme.title) || "").trim();
      const imdbId = (m.imdb_id && String(m.imdb_id).indexOf("tt") === 0) ? String(m.imdb_id) : "";
      // Catalog accepts IMDb digits as synthetic tmdb_id when moviedb_id is absent.
      let tmdbId = m.tmdb_id ? String(m.tmdb_id) : "";
      if (!tmdbId && imdbId) tmdbId = imdbId.replace(/\D/g, "");
      const canVod = !!(tmdbId || imdbId || (title && title !== LIVE_PLACEHOLDER));
      if (canVod) {
        let attrs = 'type="button" class="xray-vod" data-media-type="' + escapeHtml(mediaType) + '"';
        if (tmdbId) attrs += ' data-tmdb-id="' + escapeHtml(tmdbId) + '"';
        if (imdbId) attrs += ' data-imdb-id="' + escapeHtml(imdbId) + '"';
        if (programme && programme.season) attrs += ' data-season="' + escapeHtml(String(programme.season)) + '"';
        if (programme && programme.episode) attrs += ' data-episode="' + escapeHtml(String(programme.episode)) + '"';
        if (title) attrs += ' data-title="' + escapeHtml(title) + '"';
        parts.push("<button " + attrs + ">▶ VOD</button>");
      }
      if (!parts.length) return "";
      return '<div class="xray-actions">' + parts.join("") + "</div>";
    }

    async function openVodDetailFromXrayButton(btn) {
      if (!btn) return;
      try { closeXrayPanel(); } catch (e) {}
      const mediaType = (btn.dataset.mediaType === "tv") ? "tv" : "movie";
      let tmdbId = (btn.dataset.tmdbId || "").trim();
      const imdbId = (btn.dataset.imdbId || "").trim();
      const title = (btn.dataset.title || "").trim();
      if (!tmdbId && imdbId) tmdbId = imdbId.replace(/\D/g, "");
      if (tmdbId) {
        await showVodDetail(tmdbId, mediaType, imdbId);
        return;
      }
      if (!title || title === LIVE_PLACEHOLDER) return;
      try {
        const searchType = mediaType === "tv" ? "tv" : "multi";
        const r = await authFetch(
          "/vod/catalog/search?q=" + encodeURIComponent(title) + "&type=" + encodeURIComponent(searchType),
          { cache: "no-store" }
        );
        if (r.ok) {
          const data = await r.json();
          const items = data.items || data.results || [];
          const hit = items.find((it) => it && it.tmdb_id) || null;
          if (hit) {
            await showVodDetail(hit.tmdb_id, hit.type === "tv" ? "tv" : mediaType, hit.imdb_id || "");
            return;
          }
        }
      } catch (e) {}
      await vodNavigate({ view: "browse", tab: "search", q: title });
    }

    function closeVodPickerPanel() {
      vodPickerOpen = false;
      if (vodPicker) vodPicker.classList.remove("open");
      if (vodPickerBackdrop) vodPickerBackdrop.classList.remove("open");
    }

    function renderVodSources(sources, title) {
      if (!vodSourceList) return;
      vodPickerSources = sources || [];
      if (vodPickerTitle) vodPickerTitle.textContent = title ? ("On demand · " + title) : "On demand";
      if (!sources || !sources.length) {
        vodSourceList.innerHTML = '<div class="vod-empty">No on-demand sources for this title.</div>';
        return;
      }
      vodSourceList.innerHTML = "";
      const hlsRows = sources.filter((s) => s.auto || s.hls_capable || s.kind === "hls");
      const preferredEmbed = sources.filter((s) => !s.auto && !s.hls_capable && s.kind !== "hls" && (s.risk || "standard") === "preferred");
      const standardEmbed = sources.filter((s) => !s.auto && !s.hls_capable && s.kind !== "hls" && (s.risk || "standard") === "standard");
      const riskyEmbed = sources.filter((s) => !s.auto && !s.hls_capable && s.kind !== "hls" && s.risk === "risky");
      const appendSection = (label, rows) => {
        if (!rows.length) return;
        const head = document.createElement("div");
        head.className = "vod-source-section";
        head.textContent = label;
        vodSourceList.appendChild(head);
        for (const s of rows) {
          const row = document.createElement("button");
          row.type = "button";
          row.className = "vod-source-row" + (s.auto ? " auto" : "");
          let badge = "";
          if (s.auto || s.hls_capable || s.kind === "hls") {
            badge = '<span class="vod-source-badge hls">HLS</span>';
          } else if (s.risk === "preferred") {
            badge = '<span class="vod-source-badge preferred">Cleaner</span>';
          } else if (s.risk === "risky") {
            badge = '<span class="vod-source-badge risky">Ads</span>';
          } else {
            badge = '<span class="vod-source-badge embed">Embed</span>';
          }
          const quality = s.quality_hint
            ? '<span class="vod-source-quality">' + escapeHtml(s.quality_hint) + "</span>"
            : "";
          row.innerHTML = '<span class="body"><span class="name">' + escapeHtml(s.name || s.id)
            + '</span><span class="provider">' + escapeHtml(s.provider || "") + "</span></span>"
            + '<span class="aside">' + badge + quality + "</span>";
          row.addEventListener("click", () => { playVodSource(s, vodPickerCtx); });
          vodSourceList.appendChild(row);
        }
      };
      appendSection("Direct stream (no ad overlay)", hlsRows);
      appendSection("Preferred embeds", preferredEmbed);
      appendSection("Standard embeds", standardEmbed);
      appendSection("Risky embeds (popups / overlays)", riskyEmbed);
    }

    async function tryAutoVodHls(ctx, returnKind, opts) {
      if (!ctx || !ctx.tmdbId) return false;
      opts = opts || {};
      if (!opts.force && !vodDirectHlsEnabled()) return false;
      const timeoutMs = opts.timeoutMs != null ? opts.timeoutMs : 7000;
      const controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      try {
        let url = "/vod/resolve?tmdb_id=" + encodeURIComponent(ctx.tmdbId)
          + "&type=" + encodeURIComponent(ctx.mediaType || "movie")
          + "&lang=" + encodeURIComponent(vodPreferLang());
        if (ctx.season) url += "&season=" + encodeURIComponent(ctx.season);
        if (ctx.episode) url += "&episode=" + encodeURIComponent(ctx.episode);
        const fetchOpts = { cache: "no-store" };
        if (controller) fetchOpts.signal = controller.signal;
        const r = await authFetch(url, fetchOpts);
        if (!r.ok) return false;
        const data = await r.json();
        if (isPlayableDirectVod(data)) {
          try {
            if (data.provider || data.origin) {
              const key = [ctx.tmdbId, ctx.mediaType || "movie", ctx.season || "", ctx.episode || ""].join(":");
              const map = JSON.parse(localStorage.getItem("sd_vod_last_good") || "{}");
              map[key] = String(data.provider || data.origin);
              localStorage.setItem("sd_vod_last_good", JSON.stringify(map));
            }
          } catch (e) {}
          await playDirectVodFromResolve(data, returnKind, ctx);
          return true;
        }
        // Server filtered stubs / no direct — keep embed_url for the caller.
        if (data && data.embed_url) {
          ctx._resolveEmbedUrl = data.embed_url;
        }
      } catch (e) {}
      finally {
        if (timer) clearTimeout(timer);
      }
      return false;
    }

    async function tryAutoVodEmbed(ctx, returnKind, opts) {
      if (!ctx || !ctx.tmdbId) return false;
      opts = opts || {};
      const embedUrl = await resolveBestEmbedUrl(ctx);
      if (!embedUrl) return false;
      if (opts.useGate) {
        showVodStartGate(ctx, returnKind, embedUrl);
        return true;
      }
      playEmbedInPlayer(embedUrl, returnKind, ctx);
      return true;
    }

    async function startVodPlayback(ctx, returnKind) {
      ctx = ctx || {};
      returnKind = returnKind || "vod_picker";
      const mt = String(ctx.mediaType || "movie").toLowerCase();
      if (mt === "tv" || mt === "series" || mt === "show") {
        ctx.mediaType = "tv";
        ctx.season = String(ctx.season || 1);
        ctx.episode = String(ctx.episode || 1);
      } else {
        ctx.mediaType = "movie";
      }
      vodPickerCtx = Object.assign({}, ctx);
      hideVodStartGate();
      hideVodStreamStatus();
      saveLastPlace({
        path: location.pathname + location.search,
        tmdbId: ctx.tmdbId || null,
        mediaType: ctx.mediaType || "movie",
        season: ctx.season || null,
        episode: ctx.episode || null,
        title: ctx.title || "",
        channelId: null,
      });

      if (vodSourceMode() === "manual") {
        openVodPickerForCtx(ctx);
        return;
      }

      prepareOverlayShell(returnKind, ctx);
      showVodStreamStatus("Finding direct stream…", { busy: true });
      if (vodDirectHlsEnabled()) {
        const played = await tryAutoVodHls(ctx, returnKind, { timeoutMs: vodHlsOnlyEnabled() ? 16000 : 12000, force: true });
        if (played) {
          hideVodStreamStatus();
          return;
        }
      }
      if (vodHlsOnlyEnabled()) {
        await showVodHlsFailedGate(ctx, returnKind);
        return;
      }
      if (ctx._resolveEmbedUrl) {
        hideVodStreamStatus();
        playEmbedInPlayer(ctx._resolveEmbedUrl, returnKind, ctx);
        return;
      }
      const cleanEmbed = buildDefaultEmbedUrl(ctx);
      if (cleanEmbed) {
        hideVodStreamStatus();
        playEmbedInPlayer(cleanEmbed, returnKind, ctx);
        return;
      }
      const ok = await tryAutoVodEmbed(ctx, returnKind, { useGate: false });
      hideVodStreamStatus();
      if (!ok) openVodPickerForCtx(ctx);
    }

    function isPlayableDirectVod(data) {
      return !!(data && data.ok && data.stream_url && (data.method === "hls" || data.method === "mp4"));
    }

    async function playDirectVodFromResolve(data, returnKind, ctx) {
      if (data.method === "mp4") {
        await playVodFileInPlayer(data.stream_url, returnKind, ctx);
        return;
      }
      await playVodHlsInPlayer(data.stream_url, returnKind, ctx);
    }

    async function playVodHlsInPlayer(streamUrl, returnKind, pickerCtx) {
      const ctx = pickerCtx || vodPickerCtx;
      hideVodStartGate();
      hideVodStreamStatus();
      beginOverlayPlayback(returnKind || "live", ctx);
      vodHlsActive = true;
      trailerActive = true;
      if (tvRoot) tvRoot.classList.add("trailer-active", "overlay-active", "vod-hls-playing");
      try { v.pause(); } catch (e) {}
      if (trailerFrame) trailerFrame.src = "";
      if (trailerLayer) {
        trailerLayer.classList.add("show", "hls-mode");
        trailerLayer.setAttribute("aria-hidden", "false");
      }
      closeVodPickerPanel();
      peekFilmOverVodCatalog();
      applyGuideState(true);
      revealCollapsedChrome(true);
      userUnmuted = true;
      await activateSeriesSession(ctx, returnKind || "vod_picker");
      try { if (window.SDMobile && SDMobile.enterImmersive) SDMobile.enterImmersive(document.getElementById("videoArea")); } catch (e) {}
      await attachHls(streamUrl);
    }

    async function playVodFileInPlayer(streamUrl, returnKind, pickerCtx) {
      const ctx = pickerCtx || vodPickerCtx;
      hideVodStartGate();
      hideVodStreamStatus();
      beginOverlayPlayback(returnKind || "live", ctx);
      vodHlsActive = true;
      trailerActive = true;
      if (tvRoot) tvRoot.classList.add("trailer-active", "overlay-active", "vod-hls-playing");
      try { v.pause(); } catch (e) {}
      if (trailerFrame) trailerFrame.src = "";
      if (trailerLayer) {
        trailerLayer.classList.add("show", "hls-mode");
        trailerLayer.setAttribute("aria-hidden", "false");
      }
      closeVodPickerPanel();
      peekFilmOverVodCatalog();
      applyGuideState(true);
      revealCollapsedChrome(true);
      userUnmuted = true;
      await activateSeriesSession(ctx, returnKind || "vod_picker");
      try { if (window.SDMobile && SDMobile.enterImmersive) SDMobile.enterImmersive(document.getElementById("videoArea")); } catch (e) {}
      destroyHls();
      currentStreamUrl = String(streamUrl || "").split("?")[0];
      v.src = streamUrl.startsWith("http") ? streamUrl : (location.origin + streamUrl);
      setLoading(true);
      const onReady = () => { setLoading(false); v.removeEventListener("loadeddata", onReady); };
      v.addEventListener("loadeddata", onReady);
      tryPlay();
    }

    function resolveVodReturnKind(fallback) {
      if (vodCatalogOpen && vodDetail && vodDetail.classList.contains("show")) return "vod_detail";
      if (vodCatalogOpen) return "vod_picker";
      if (xrayOpen) return "xray_picker";
      return fallback || "live";
    }

    async function playVodSource(source, ctx) {
      if (!source) return;
      ctx = ctx || vodPickerCtx || {};
      const returnKind = resolveVodReturnKind("live");
      const isHlsRow = !!(source.auto || source.hls_capable || source.kind === "hls");
      const wantsHls = ctx.tmdbId && isHlsRow && (vodDirectHlsEnabled() || source.auto || vodSourceMode() === "auto");
      if (wantsHls) {
        if (vodSourceList) vodSourceList.innerHTML = '<div class="vod-loading">Extracting direct stream…</div>';
        showVodStreamStatus("Extracting direct stream…", { busy: true });
        try {
          let url = "/vod/resolve?tmdb_id=" + encodeURIComponent(ctx.tmdbId)
            + "&type=" + encodeURIComponent(ctx.mediaType || "movie")
            + "&lang=" + encodeURIComponent(vodPreferLang());
          if (ctx.season) url += "&season=" + encodeURIComponent(ctx.season);
          if (ctx.episode) url += "&episode=" + encodeURIComponent(ctx.episode);
          if (source.id && !source.auto) url += "&provider=" + encodeURIComponent(source.id);
          const r = await authFetch(url, { cache: "no-store" });
          if (r.ok) {
            const data = await r.json();
            if (isPlayableDirectVod(data)) {
              await playDirectVodFromResolve(data, returnKind, ctx);
              return;
            }
          }
        } catch (e) {}
        hideVodStreamStatus();
        if (vodHlsOnlyEnabled()) {
          if (vodSourceList) {
            vodSourceList.innerHTML = '<div class="vod-empty">Direct stream unavailable. Pick an embed below if you accept ads/overlays, or retry Auto later.</div>';
            try {
              const srcUrl = "/vod/sources?tmdb_id=" + encodeURIComponent(ctx.tmdbId)
                + "&type=" + encodeURIComponent(ctx.mediaType || "movie")
                + "&lang=" + encodeURIComponent(vodPreferLang())
                + "&prefer_lang=" + encodeURIComponent(vodPreferLang());
              const sr = await authFetch(srcUrl, { cache: "no-store" });
              if (sr.ok) {
                const payload = await sr.json();
                renderVodSources(payload.sources || [], ctx.title || "");
              }
            } catch (e2) {}
          }
          return;
        }
        const embed = source.embed_url || (firstEmbedSource(vodPickerSources) || {}).embed_url;
        if (embed) {
          playEmbedInPlayer(embed, returnKind, ctx);
          return;
        }
      }
      if (source.embed_url) {
        playEmbedInPlayer(source.embed_url, returnKind, ctx);
        return;
      }
      const fallback = firstEmbedSource(vodPickerSources);
      if (fallback && fallback.embed_url) {
        playEmbedInPlayer(fallback.embed_url, returnKind, ctx);
        return;
      }
      if (vodSourceList) {
        vodSourceList.innerHTML = '<div class="vod-empty">No playable URL for this source.</div>';
      }
    }

    async function openVodPickerFromButton(btn) {
      if (!btn || !btn.dataset.tmdbId) return;
      await openVodPickerForCtx({
        tmdbId: btn.dataset.tmdbId,
        mediaType: btn.dataset.mediaType || "movie",
        season: btn.dataset.season || "",
        episode: btn.dataset.episode || "",
        title: btn.dataset.title || "",
      });
    }

    async function openVodPickerForCtx(ctx) {
      if (!ctx || !ctx.tmdbId) return;
      vodPickerCtx = ctx;
      vodPickerOpen = true;
      if (vodPicker) vodPicker.classList.add("open");
      if (vodPickerBackdrop) vodPickerBackdrop.classList.add("open");
      if (vodSourceList) vodSourceList.innerHTML = '<div class="vod-loading">Finding sources…</div>';
      const title = ctx.title || "";
      if (vodPickerTitle) vodPickerTitle.textContent = title ? ("On demand · " + title) : "On demand";
      let url = "/vod/sources?tmdb_id=" + encodeURIComponent(ctx.tmdbId)
        + "&type=" + encodeURIComponent(ctx.mediaType || "movie")
        + "&lang=" + encodeURIComponent(vodPreferLang())
        + "&prefer_lang=" + encodeURIComponent(vodPreferLang());
      if (ctx.season) url += "&season=" + encodeURIComponent(ctx.season);
      if (ctx.episode) url += "&episode=" + encodeURIComponent(ctx.episode);
      try {
        const r = await authFetch(url, { cache: "no-store" });
        if (!r.ok) throw new Error("vod_sources_failed");
        const data = await r.json();
        renderVodSources(data.sources || [], title);
      } catch (e) {
        if (vodSourceList) vodSourceList.innerHTML = '<div class="vod-empty">Could not load on-demand sources.</div>';
      }
    }

    function closeVodCatalogUI(opts) {
      opts = opts || {};
      vodCatalogOpen = false;
      if (vodCatalog) vodCatalog.classList.remove("open");
      if (vodCatalogBackdrop) vodCatalogBackdrop.classList.remove("open");
      hideVodDetailUI();
      if (opts.restoreLive) {
        try { restoreLiveChannelPlayback(opts.reason || "close-vod-ui"); } catch (e) {}
      }
    }

    // Collapse catalog sheet while film/embed plays so hijack reclaim + player stay visible.
    // Does not clear overlayReturn / detail DOM — Back / stopOverlay restores via vodCatalogWasOpen.
    function peekFilmOverVodCatalog() {
      if (vodCatalog) vodCatalog.classList.remove("open");
      if (vodCatalogBackdrop) vodCatalogBackdrop.classList.remove("open");
    }
    window.SDPeekFilmOverVodCatalog = peekFilmOverVodCatalog;

    function closeVodCatalog() {
      // Leaving VOD entirely: tear down any stuck player/embed, then resume live.
      if (trailerActive || (trailerLayer && trailerLayer.classList.contains("show")) || vodHlsActive) {
        try {
          overlayReturn = {
            kind: "live",
            liveStreamUrl: liveStreamUrl || (overlayReturn && overlayReturn.liveStreamUrl) || "",
            pickerCtx: null,
            vodCatalogWasOpen: false,
            vodDetailWasOpen: false,
            vodRoute: null,
            xrayWasOpen: false,
          };
          stopOverlayPlayback();
        } catch (e) {
          try { restoreLiveChannelPlayback("close-vod-force"); } catch (err) {}
        }
      } else {
        restoreLiveChannelPlayback("close-vod");
      }
      closeVodCatalogUI();
      const ch = channelId || resolveInitialChannel();
      history.replaceState(null, "", tvChannelUrl(ch));
    }

    window.SDCloseVodCatalogUI = closeVodCatalogUI;

    function hideVodDetailUI() {
      stopVodHeroTrailer();
      vodCatalogDetail = null;
      if (vodDetail) vodDetail.classList.remove("show");
      if (vodCatalogBody) vodCatalogBody.style.display = "";
      if (vodCatalogTabs) vodCatalogTabs.style.display = "";
      if (vodProviderBar) vodProviderBar.style.display = "";
      if (vodFilterBar) vodFilterBar.style.display = "";
      updateVodFilterBar();
    }

    function openVodCatalogUI() {
      try {
        if (window.SDParty && typeof window.SDParty.closeHome === "function") {
          window.SDParty.closeHome(true);
        }
      } catch (e) {}
      vodCatalogOpen = true;
      if (vodCatalog) vodCatalog.classList.add("open");
      if (vodCatalogBackdrop) vodCatalogBackdrop.classList.add("open");
    }

    function vodBrowseStateFromUi() {
      return {
        view: "browse",
        tab: vodCatalogTab || "home",
        q: (vodCatalogSearch && vodCatalogSearch.value.trim()) || "",
        provider: vodActiveProvider || "",
        sort: (vodSortSelect && vodSortSelect.value) || "popularity.desc",
        genre: (vodGenreSelect && vodGenreSelect.value) || "",
        year: (vodYearSelect && vodYearSelect.value) || "",
        rating: (vodRatingSelect && vodRatingSelect.value) || "",
        castId: vodPageState.castId || "",
      };
    }

    function vodBuildUrl(state) {
      const q = new URLSearchParams();
      if (state.view === "detail") {
        let path = "/vod/" + (state.type === "tv" ? "tv" : "movie") + "/" + encodeURIComponent(state.tmdbId);
        if (state.imdbId) path += "?imdb=" + encodeURIComponent(state.imdbId);
        return path;
      }
      if (state.view === "person") {
        q.set("type", state.type || "movie");
        return "/vod/person/" + encodeURIComponent(state.personId) + "?" + q.toString();
      }
      let path = "/vod";
      if (state.tab === "movie") path = "/vod/movies";
      else if (state.tab === "tv") path = "/vod/shows";
      else if (state.tab === "search" && state.q) {
        path = "/vod/search";
        q.set("q", state.q);
      }
      if (state.provider) q.set("provider", state.provider);
      if (state.sort && state.sort !== "popularity.desc") q.set("sort", state.sort);
      if (state.genre) q.set("genre", state.genre);
      if (state.year) q.set("year", state.year);
      if (state.rating) q.set("rating", state.rating);
      if (state.castId) q.set("cast", state.castId);
      const qs = q.toString();
      return qs ? path + "?" + qs : path;
    }

    function vodParseRoute() {
      const path = location.pathname.replace(/\/$/, "");
      if (!path.startsWith("/vod")) return null;
      const rest = path.slice(4).replace(/^\//, "");
      const parts = rest.split("/").filter(Boolean);
      const q = new URLSearchParams(location.search);
      const base = {
        provider: q.get("provider") || "",
        sort: q.get("sort") || "popularity.desc",
        genre: q.get("genre") || "",
        year: q.get("year") || "",
        rating: q.get("rating") || "",
        castId: q.get("cast") || "",
      };
      if (!parts.length) return { view: "browse", tab: "home", q: "", ...base };
      if (parts[0] === "movies") return { view: "browse", tab: "movie", q: "", ...base };
      if (parts[0] === "shows") return { view: "browse", tab: "tv", q: "", ...base };
      if (parts[0] === "search") {
        return { view: "browse", tab: "search", q: q.get("q") || "", ...base };
      }
      if (parts[0] === "movie" && parts[1]) {
        return { view: "detail", type: "movie", tmdbId: parts[1], imdbId: q.get("imdb") || "" };
      }
      if (parts[0] === "tv" && parts[1]) {
        return { view: "detail", type: "tv", tmdbId: parts[1], imdbId: q.get("imdb") || "" };
      }
      if (parts[0] === "person" && parts[1]) {
        return {
          view: "person",
          personId: parts[1],
          personName: "",
          type: q.get("type") || "movie",
        };
      }
      return { view: "browse", tab: "home", q: "", ...base };
    }

    function vodApplyFiltersFromState(state) {
      vodActiveProvider = state.provider || "";
      if (vodSortSelect && state.sort) vodSortSelect.value = state.sort;
      if (vodGenreSelect && state.genre) vodGenreSelect.value = state.genre;
      if (vodYearSelect && state.year) vodYearSelect.value = state.year;
      if (vodRatingSelect && state.rating) vodRatingSelect.value = state.rating;
      renderVodProviderBar();
      updateVodFilterBar();
    }

    function vodAtBrowseRoot() {
      const path = location.pathname.replace(/\/$/, "");
      return path === "/vod" && !location.search;
    }

    function vodGoBack() {
      if (location.pathname.startsWith("/vod") && !vodAtBrowseRoot()) {
        history.back();
      } else if (vodDetail && vodDetail.classList.contains("show")) {
        history.back();
      } else {
        hideVodDetailUI();
      }
    }

    async function applyVodRoute(state, opts) {
      opts = opts || {};
      if (!state) return;
      openVodCatalogUI();
      if (state.view === "detail") {
        await showVodDetailUI(state.tmdbId, state.type, state.imdbId || "");
        return;
      }
      hideVodDetailUI();
      if (state.view === "person") {
        vodPageState.castId = state.personId || "";
        await loadVodPersonBrowseUI(state.personId, state.personName || "", state.type);
        return;
      }
      vodCatalogTab = state.tab === "tv" ? "tv" : state.tab === "movie" ? "movie" : "home";
      if (vodCatalogTabs) {
        vodCatalogTabs.querySelectorAll(".vod-tab").forEach(el => {
          el.classList.toggle("active", el.dataset.tab === vodCatalogTab);
        });
      }
      vodApplyFiltersFromState(state);
      if (state.castId) vodPageState.castId = state.castId;
      if (state.tab === "search") {
        if (vodCatalogSearch) vodCatalogSearch.value = state.q || "";
        await searchVodCatalogUI(state.q || "");
        return;
      }
      if (vodCatalogSearch && !opts.keepSearch) vodCatalogSearch.value = "";
      if (vodCatalogTab === "home") await loadVodCatalogHome();
      else await loadVodCatalogBrowse(vodCatalogTab === "tv" ? "tv" : "movie");
    }

    async function vodNavigate(state, replace) {
      const url = vodBuildUrl(state);
      const histState = { sdVod: state };
      if (replace) history.replaceState(histState, "", url);
      else history.pushState(histState, "", url);
      await applyVodRoute(state);
    }

    window.addEventListener("popstate", () => {
      // Gapless owner for /vod + overlay play frames (catalog → detail → play → back).
      if (trailerActive || (trailerLayer && trailerLayer.classList.contains("show")) || vodHlsActive) {
        stopOverlayPlayback();
        return;
      }
      if (window.SDPinUnlock && SDPinUnlock.isOpen && SDPinUnlock.isOpen()) {
        try { SDPinUnlock.close(); } catch (e) {}
        return;
      }
      if (location.pathname.startsWith("/vod")) {
        const state = (history.state && history.state.sdVod) ? history.state.sdVod : vodParseRoute();
        applyVodRoute(state, { keepSearch: true });
      } else if (vodCatalogOpen) {
        closeVodCatalogUI({ restoreLive: true, reason: "popstate-leave-vod" });
      }
    });

    function renderVodStars(stars) {
      if (!stars || !stars.score) return "";
      let html = '<div class="vod-rating">';
      for (let i = 0; i < (stars.full || 0); i++) html += '<span class="star">★</span>';
      if (stars.half) html += '<span class="star">⯨</span>';
      for (let i = 0; i < (stars.empty || 0); i++) html += '<span class="star empty">★</span>';
      html += '<span class="score">' + escapeHtml(String(stars.score)) + '</span></div>';
      return html;
    }

    function renderVodBadges(item) {
      let html = "";
      const tags = item.quality_tags || [];
      for (const t of tags) {
        html += '<span class="vod-badge q-' + escapeHtml(String(t)) + '">' + escapeHtml(String(t)) + '</span>';
      }
      if (item.provider_name) {
        html += '<span class="vod-badge provider">' + escapeHtml(item.provider_name) + '</span>';
      }
      return html ? '<div class="vod-badges">' + html + '</div>' : "";
    }

    function vodQueueItem(type, tmdbId, imdbId) {
      const row = { type: type === "tv" ? "tv" : "movie", tmdb_id: String(tmdbId) };
      if (imdbId) row.imdb_id = String(imdbId);
      return row;
    }

    function setVodDetailQueue(items) {
      vodDetailQueue = (items || []).map(it => vodQueueItem(it.type, it.tmdb_id, it.imdb_id));
      try { sessionStorage.setItem(LS_VOD_QUEUE, JSON.stringify(vodDetailQueue)); } catch (e) {}
    }

    function loadVodDetailQueue() {
      if (vodDetailQueue.length) return vodDetailQueue;
      try {
        const raw = sessionStorage.getItem(LS_VOD_QUEUE);
        if (raw) vodDetailQueue = JSON.parse(raw) || [];
      } catch (e) { vodDetailQueue = []; }
      return vodDetailQueue;
    }

    function buildVodQueueFromHome(sectionIndex, itemIndex) {
      const out = [];
      for (let s = sectionIndex; s < vodHomeSections.length; s++) {
        const items = vodHomeSections[s].items || [];
        const start = s === sectionIndex ? itemIndex : 0;
        for (let i = start; i < items.length; i++) {
          const it = items[i];
          out.push(vodQueueItem(it.type, it.tmdb_id, it.imdb_id));
        }
      }
      return out;
    }

    function buildVodQueueFromGrid(tmdbId) {
      if (!vodInfiniteGrid) return [vodQueueItem("movie", tmdbId)];
      const cards = [...vodInfiniteGrid.querySelectorAll(".vod-card")];
      const items = cards.map(c => vodQueueItem(c.dataset.mediaType, c.dataset.tmdbId, c.dataset.imdbId));
      const idx = items.findIndex(it => it.tmdb_id === String(tmdbId));
      return idx >= 0 ? items.slice(idx) : items;
    }

    function buildVodQueueFromSectionItems(items, itemIndex) {
      const out = [];
      for (let i = itemIndex; i < (items || []).length; i++) {
        out.push(vodQueueItem(items[i].type, items[i].tmdb_id, items[i].imdb_id));
      }
      return out;
    }

    function vodDetailQueueIndex(tmdbId, type) {
      const q = loadVodDetailQueue();
      const id = String(tmdbId);
      const mt = type === "tv" ? "tv" : "movie";
      return q.findIndex(it => it.tmdb_id === id && it.type === mt);
    }

    function updateVodDetailNav() {
      const prev = document.getElementById("vodDetailPrev");
      const next = document.getElementById("vodDetailNext");
      if (!prev || !next || !vodCatalogDetail) return;
      const q = loadVodDetailQueue();
      const idx = vodDetailQueueIndex(vodCatalogDetail.tmdb_id, vodCatalogDetail.type);
      prev.disabled = idx <= 0;
      next.disabled = idx < 0 || idx >= q.length - 1;
    }

    async function stepVodDetail(delta) {
      const q = loadVodDetailQueue();
      const idx = vodDetailQueueIndex(vodCatalogDetail.tmdb_id, vodCatalogDetail.type);
      if (idx < 0) return;
      const target = q[idx + delta];
      if (!target) return;
      await vodNavigate({
        view: "detail",
        type: target.type,
        tmdbId: target.tmdb_id,
        imdbId: target.imdb_id || "",
      });
    }

    function bumpVodDetailViews() {
      try {
        const n = parseInt(sessionStorage.getItem("sd_vod_detail_views") || "0", 10) + 1;
        sessionStorage.setItem("sd_vod_detail_views", String(n));
      } catch (e) {}
    }

    function vodTrailerShouldUseSound() {
      if (trailerActive || vodPickerOpen) return false;
      try {
        const v = localStorage.getItem(LS_VOD_TRAILER_MUTED);
        if (v === "1") return false;
        if (v === "0") return true;
      } catch (e) {}
      try {
        const n = parseInt(sessionStorage.getItem("sd_vod_detail_views") || "0", 10);
        return n >= VOD_TRAILER_SOUND_AFTER;
      } catch (e) { return false; }
    }

    function renderVodCard(item, queueItems) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "vod-card";
      btn.dataset.tmdbId = String(item.tmdb_id);
      btn.dataset.mediaType = item.type || "movie";
      if (item.imdb_id) btn.dataset.imdbId = String(item.imdb_id);
      const posterInner = item.poster_url
        ? '<img class="poster" src="' + escapeHtml(item.poster_url) + '" alt="" loading="lazy"/>'
        : '<div class="poster ph">🎬</div>';
      const poster = '<div class="vod-poster-wrap">' + posterInner + renderVodBadges(item) + renderVodStars(item.stars) + '</div>';
      const meta = [item.year, item.type === "tv" ? "TV" : "Movie"].filter(Boolean).join(" · ");
      btn.innerHTML = poster + '<div class="title">' + escapeHtml(item.title || "") + '</div>'
        + (meta ? '<div class="meta">' + escapeHtml(meta) + "</div>" : "");
      btn.addEventListener("click", () => {
        let q = queueItems;
        if (vodInfiniteGrid) q = buildVodQueueFromGrid(item.tmdb_id);
        else if (!q || !q.length) q = [vodQueueItem(item.type, item.tmdb_id)];
        setVodDetailQueue(q);
        showVodDetail(item.tmdb_id, item.type, item.imdb_id || "");
      });
      return btn;
    }

    function renderVodSection(title, items, grid, queueBuilder) {
      const sec = document.createElement("div");
      sec.className = "vod-section";
      sec.innerHTML = "<h3>" + escapeHtml(title) + "</h3>";
      const row = document.createElement("div");
      row.className = grid ? "vod-grid" : "vod-row";
      for (let i = 0; i < items.length; i++) {
        const q = queueBuilder ? queueBuilder(i) : null;
        row.appendChild(renderVodCard(items[i], q));
      }
      sec.appendChild(row);
      return sec;
    }

    function vodBrowseType() {
      return vodCatalogTab === "tv" ? "tv" : "movie";
    }

    function vodFilterParams(page) {
      const params = new URLSearchParams();
      params.set("type", vodPageState.type || vodBrowseType());
      params.set("page", String(page || 1));
      if (vodActiveProvider) params.set("provider_id", vodActiveProvider);
      if (vodSortSelect && vodSortSelect.value) params.set("sort", vodSortSelect.value);
      if (vodGenreSelect && vodGenreSelect.value) params.set("genre_id", vodGenreSelect.value);
      if (vodYearSelect && vodYearSelect.value) {
        const parts = vodYearSelect.value.split("-");
        if (parts[0]) params.set("year_min", parts[0]);
        if (parts[1]) params.set("year_max", parts[1]);
      }
      if (vodRatingSelect && vodRatingSelect.value) params.set("rating_min", vodRatingSelect.value);
      if (vodPageState.castId) params.set("cast_id", vodPageState.castId);
      return params;
    }

    function resetVodInfiniteScroll() {
      vodInfiniteGrid = null;
      vodPageState = { page: 0, hasMore: false, loading: false, title: "", type: "movie", searchQuery: "", castId: "" };
    }

    function appendVodCards(items) {
      if (!vodInfiniteGrid || !items || !items.length) return 0;
      const seen = new Set();
      vodInfiniteGrid.querySelectorAll(".vod-card").forEach(c => seen.add(c.dataset.tmdbId));
      let added = 0;
      for (const item of items) {
        const id = String(item.tmdb_id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        vodInfiniteGrid.appendChild(renderVodCard(item));
        added++;
      }
      return added;
    }

    function updateVodLoadSentinel() {
      if (!vodCatalogBody || !vodInfiniteGrid) return;
      let sentinel = vodCatalogBody.querySelector(".vod-load-more");
      if (!sentinel) {
        sentinel = document.createElement("div");
        sentinel.className = "vod-load-more";
        vodCatalogBody.appendChild(sentinel);
      }
      sentinel.classList.toggle("loading", !!vodPageState.loading);
      if (vodPageState.loading) {
        sentinel.textContent = vodPageState.page > 0 ? "Loading more…" : "Loading…";
      } else if (vodPageState.hasMore) {
        sentinel.textContent = "";
      } else if (vodInfiniteGrid.children.length) {
        sentinel.textContent = "— End of list —";
      } else {
        sentinel.textContent = "";
      }
    }

    async function loadVodPaginatedGrid(opts) {
      opts = opts || {};
      const reset = opts.reset !== false;
      if (!vodCatalogBody) return;
      if (vodPageState.loading) return;
      if (!reset && !vodPageState.hasMore) return;

      if (reset) {
        vodPageState.page = 0;
        vodPageState.hasMore = true;
        vodPageState.title = opts.title || "";
        vodPageState.type = opts.type || vodBrowseType();
        vodPageState.searchQuery = opts.searchQuery || "";
        vodPageState.castId = opts.castId || "";
        vodInfiniteGrid = null;
        vodCatalogBody.innerHTML = '<div class="vod-catalog-loading">Loading…</div>';
        hideVodDetailUI();
      } else {
        updateVodLoadSentinel();
      }

      vodPageState.loading = true;
      const nextPage = vodPageState.page + 1;
      try {
        let url;
        if (vodPageState.searchQuery) {
          url = "/vod/catalog/search?q=" + encodeURIComponent(vodPageState.searchQuery)
            + "&type=multi&page=" + nextPage;
        } else {
          const params = vodFilterParams(nextPage);
          params.set("type", vodPageState.type);
          url = "/vod/catalog/discover?" + params.toString();
        }
        const r = await authFetch(url, { cache: "no-store" });
        if (!r.ok) throw new Error("load_failed");
        const data = await r.json();
        const items = data.items || [];

        if (reset) {
          vodCatalogBody.innerHTML = "";
          if (!items.length) {
            vodCatalogBody.innerHTML = '<div class="vod-catalog-loading">No titles found.</div>';
            vodPageState.hasMore = false;
            return;
          }
          const sec = document.createElement("div");
          sec.className = "vod-section";
          sec.innerHTML = "<h3>" + escapeHtml(vodPageState.title) + "</h3>";
          vodInfiniteGrid = document.createElement("div");
          vodInfiniteGrid.className = "vod-grid";
          sec.appendChild(vodInfiniteGrid);
          vodCatalogBody.appendChild(sec);
        }

        appendVodCards(items);
        vodPageState.page = nextPage;
        if (typeof data.has_more === "boolean") {
          vodPageState.hasMore = data.has_more;
        } else if (data.total_pages) {
          vodPageState.hasMore = nextPage < data.total_pages;
        } else {
          vodPageState.hasMore = items.length >= 20;
        }
        updateVodLoadSentinel();
      } catch (e) {
        if (reset) {
          vodCatalogBody.innerHTML = '<div class="vod-catalog-loading">Could not load titles.</div>';
        }
        vodPageState.hasMore = false;
        updateVodLoadSentinel();
      } finally {
        vodPageState.loading = false;
        updateVodLoadSentinel();
      }
    }

    function onVodCatalogScroll() {
      if (!vodCatalogOpen || vodPageState.loading || !vodPageState.hasMore || !vodInfiniteGrid) return;
      const el = vodCatalogBody;
      if (!el) return;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 360) {
        loadVodPaginatedGrid({ reset: false });
      }
    }

    function updateVodFilterBar() {
      const show = vodCatalogTab === "movie" || vodCatalogTab === "tv" || vodActiveProvider;
      if (vodFilterBar) vodFilterBar.classList.toggle("show", !!show);
    }

    function renderVodProviderBar() {
      if (!vodProviderBar) return;
      vodProviderBar.innerHTML = "";
      const all = document.createElement("button");
      all.type = "button";
      all.className = "vod-provider-chip" + (vodActiveProvider ? "" : " active");
      all.dataset.providerId = "";
      all.textContent = "All";
      all.addEventListener("click", () => selectVodProvider(""));
      vodProviderBar.appendChild(all);
      for (const p of vodProviders) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "vod-provider-chip" + (String(p.id) === String(vodActiveProvider) ? " active" : "");
        chip.dataset.providerId = String(p.id);
        chip.textContent = p.name || p.slug || "Provider";
        chip.addEventListener("click", () => selectVodProvider(String(p.id)));
        vodProviderBar.appendChild(chip);
      }
    }

    async function ensureVodGenres(type) {
      if (!vodGenreSelect || vodGenresLoaded[type]) return;
      try {
        const r = await authFetch("/vod/catalog/genres?type=" + encodeURIComponent(type), { cache: "no-store" });
        if (!r.ok) return;
        const data = await r.json();
        const keep = vodGenreSelect.value;
        vodGenreSelect.innerHTML = '<option value="">All genres</option>';
        for (const g of (data.genres || [])) {
          const opt = document.createElement("option");
          opt.value = String(g.id);
          opt.textContent = g.name || ("Genre " + g.id);
          vodGenreSelect.appendChild(opt);
        }
        if (keep) vodGenreSelect.value = keep;
        vodGenresLoaded[type] = true;
      } catch (e) {}
    }

    function selectVodProvider(providerId) {
      const tab = vodCatalogTab === "home" && providerId ? "movie" : vodCatalogTab;
      vodNavigate({
        view: "browse",
        tab: tab === "tv" ? "tv" : tab === "movie" ? "movie" : "home",
        q: "",
        provider: providerId || "",
        sort: (vodSortSelect && vodSortSelect.value) || "popularity.desc",
        genre: (vodGenreSelect && vodGenreSelect.value) || "",
        year: (vodYearSelect && vodYearSelect.value) || "",
        rating: (vodRatingSelect && vodRatingSelect.value) || "",
        castId: "",
      }, true);
    }

    function scheduleVodFilterReload() {
      clearTimeout(vodFilterDebounce);
      vodFilterDebounce = setTimeout(() => {
        vodNavigate(vodBrowseStateFromUi(), true);
      }, 250);
    }

    async function loadVodProviderBrowse() {
      if (!vodCatalogBody || !vodActiveProvider) return;
      updateVodFilterBar();
      const prov = vodProviders.find(p => String(p.id) === String(vodActiveProvider));
      const title = prov ? ("On " + prov.name) : "Provider";
      await loadVodPaginatedGrid({ reset: true, type: vodBrowseType(), title });
    }

    async function loadVodCatalogHome() {
      if (!vodCatalogBody) return;
      resetVodInfiniteScroll();
      vodCatalogBody.innerHTML = '<div class="vod-catalog-loading">Loading catalog…</div>';
      hideVodDetailUI();
      updateVodFilterBar();
      try {
        const r = await authFetch("/vod/catalog/home", { cache: "no-store" });
        if (!r.ok) throw new Error("home_failed");
        const data = await r.json();
        if (!data.enabled) {
          vodCatalogBody.innerHTML = '<div class="vod-catalog-loading">VOD catalog unavailable.</div>';
          return;
        }
        if (data.providers && data.providers.length) {
          vodProviders = data.providers;
          renderVodProviderBar();
        }
        vodHomeSections = data.sections || [];
        vodCatalogBody.innerHTML = "";
        for (let si = 0; si < vodHomeSections.length; si++) {
          const sec = vodHomeSections[si];
          if (sec.items && sec.items.length) {
            vodCatalogBody.appendChild(renderVodSection(sec.title, sec.items, false, (idx) => buildVodQueueFromHome(si, idx)));
          }
        }
      } catch (e) {
        vodCatalogBody.innerHTML = '<div class="vod-catalog-loading">Could not load VOD catalog.</div>';
      }
    }

    async function loadVodCatalogBrowse(type) {
      if (!vodCatalogBody) return;
      type = type || "movie";
      updateVodFilterBar();
      await ensureVodGenres(type);
      const labels = { movie: "Movies", tv: "TV Shows" };
      await loadVodPaginatedGrid({ reset: true, type, title: labels[type] || "Titles" });
    }

    async function searchVodCatalogUI(q) {
      q = (q || "").trim();
      if (!vodCatalogBody) return;
      await loadVodPaginatedGrid({ reset: true, searchQuery: q, title: "Results" });
    }

    async function searchVodCatalog(q) {
      q = (q || "").trim();
      if (!q) {
        vodNavigate({
          view: "browse",
          tab: vodCatalogTab || "home",
          q: "",
          provider: vodActiveProvider || "",
          sort: (vodSortSelect && vodSortSelect.value) || "popularity.desc",
          genre: (vodGenreSelect && vodGenreSelect.value) || "",
          year: (vodYearSelect && vodYearSelect.value) || "",
          rating: (vodRatingSelect && vodRatingSelect.value) || "",
          castId: "",
        }, true);
        return;
      }
      vodNavigate({
        view: "browse",
        tab: "search",
        q,
        provider: vodActiveProvider || "",
        sort: (vodSortSelect && vodSortSelect.value) || "popularity.desc",
        genre: (vodGenreSelect && vodGenreSelect.value) || "",
        year: (vodYearSelect && vodYearSelect.value) || "",
        rating: (vodRatingSelect && vodRatingSelect.value) || "",
        castId: "",
      });
    }

    function setVodCatalogTab(tab, opts) {
      if (opts && opts.noNavigate) {
        vodCatalogTab = tab;
        if (vodCatalogTabs) {
          vodCatalogTabs.querySelectorAll(".vod-tab").forEach(el => {
            el.classList.toggle("active", el.dataset.tab === tab);
          });
        }
        if (tab === "home") vodActiveProvider = "";
        renderVodProviderBar();
        updateVodFilterBar();
        loadVodCatalogTab(tab);
        return;
      }
      if (vodCatalogSearch) vodCatalogSearch.value = "";
      vodNavigate({
        view: "browse",
        tab: tab === "tv" ? "tv" : tab === "movie" ? "movie" : "home",
        q: "",
        provider: tab === "home" ? "" : vodActiveProvider || "",
        sort: (vodSortSelect && vodSortSelect.value) || "popularity.desc",
        genre: (vodGenreSelect && vodGenreSelect.value) || "",
        year: (vodYearSelect && vodYearSelect.value) || "",
        rating: (vodRatingSelect && vodRatingSelect.value) || "",
        castId: "",
      });
    }

    function loadVodCatalogTab(tab) {
      if (tab === "home") loadVodCatalogHome();
      else if (tab === "movie") loadVodCatalogBrowse("movie");
      else if (tab === "tv") loadVodCatalogBrowse("tv");
    }

    function openVodCatalog() {
      resetVodInfiniteScroll();
      if (vodSortSelect) vodSortSelect.value = "popularity.desc";
      if (vodGenreSelect) vodGenreSelect.value = "";
      if (vodYearSelect) vodYearSelect.value = "";
      if (vodRatingSelect) vodRatingSelect.value = "";
      vodNavigate({
        view: "browse",
        tab: "home",
        q: "",
        provider: "",
        sort: "popularity.desc",
        genre: "",
        year: "",
        rating: "",
        castId: "",
      });
    }

    function renderVodStreamBadges(providers) {
      if (!providers || !providers.length) return "";
      let html = '<div class="vod-fact vod-fact-streaming"><span class="label">Streaming on</span><div class="vod-stream-badges">';
      for (const p of providers) {
        const logo = p.logo_url
          ? '<img src="' + escapeHtml(p.logo_url) + '" alt="" loading="lazy"/>'
          : '<span class="ph">' + escapeHtml((p.name || "?").charAt(0)) + "</span>";
        html += '<span class="vod-stream-badge">' + logo + escapeHtml(p.name || "Provider") + "</span>";
      }
      html += "</div></div>";
      return html;
    }

    function renderVodTrackBar() {
      return '<span class="vod-track-label">Your list</span>'
        + '<div class="vod-track-bar" id="vodTrackBar">'
        + '<button type="button" class="vod-track-btn" data-track="watched">✓ Watched</button>'
        + '<button type="button" class="vod-track-btn" data-track="favorite">♥ Favorite</button>'
        + '<button type="button" class="vod-track-btn" data-track="bookmark">🔖 Bookmark</button>'
        + '<button type="button" class="vod-track-btn" data-track="reminder">⏰ Remind</button>'
        + '<button type="button" class="vod-track-btn" id="vodTraktConnectInline">Trakt</button>'
        + '<span class="vod-track-sync" id="vodTrackSync"></span></div>';
    }

    function buildVodHeroSubline(d, mt) {
      const bits = [];
      if (d.year) bits.push(String(d.year));
      if (d.certification) bits.push(d.certification);
      if (d.runtime_minutes) bits.push(d.runtime_minutes + " min");
      else if (d.episode_runtime) bits.push(d.episode_runtime + " min/ep");
      if (mt === "tv" && d.number_of_seasons) {
        bits.push(d.number_of_seasons + (d.number_of_seasons === 1 ? " season" : " seasons"));
      }
      if (d.quality_tags && d.quality_tags.length) bits.push(d.quality_tags.join(" · "));
      return bits.join(" · ");
    }

    function buildVodHeroMetaBlock(d, mt, posterHtml) {
      const typeLabel = mt === "tv" ? "Series" : "Movie";
      const ratingHtml = d.rating
        ? '<span class="rating-pill">★ ' + escapeHtml(String(d.rating)) + "</span>"
        : "";
      const sub = buildVodHeroSubline(d, mt);
      return posterHtml + '<div class="meta-panel"><div class="meta-head"><h3>' + escapeHtml(d.title || "")
        + '</h3><span class="type-badge">' + escapeHtml(typeLabel) + "</span></div>"
        + (sub ? '<div class="sub">' + ratingHtml + escapeHtml(sub) + "</div>" : "")
        + "</div>";
    }

    function renderVodDetailMetaStrip(d, mt) {
      const chips = [];
      if (d.genres && d.genres.length) {
        for (const g of d.genres.slice(0, 6)) chips.push({ genre: true, text: g });
      }
      if (d.status) chips.push({ text: d.status });
      if (d.original_language) chips.push({ text: String(d.original_language).toUpperCase() });
      if (!chips.length) return "";
      let html = '<div class="vod-detail-meta-strip">';
      for (const c of chips) {
        html += '<span class="vod-meta-chip' + (c.genre ? " genre" : "") + '">' + escapeHtml(c.text) + "</span>";
      }
      html += "</div>";
      return html;
    }

    function vodLibraryMeta(d) {
      return { title: d.title || "", poster_url: d.poster_url || null, year: d.year || null };
    }

    async function fetchVodLibraryItem(d, mt) {
      const r = await authFetch("/vod/library/item/" + mt + "/" + encodeURIComponent(d.tmdb_id), { cache: "no-store" });
      if (!r.ok) throw new Error("library_get_failed");
      return r.json();
    }

    async function touchVodRecent(d, mt) {
      try {
        await authFetch("/vod/library/item/" + mt + "/" + encodeURIComponent(d.tmdb_id) + "/view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(vodLibraryMeta(d)),
        });
      } catch (e) {}
    }

    function applyVodTrackBarState(state) {
      const bar = document.getElementById("vodTrackBar");
      if (!bar) return;
      for (const btn of bar.querySelectorAll(".vod-track-btn")) {
        const key = btn.dataset.track;
        const on = key === "reminder" ? !!state.reminder_at : !!state[key];
        btn.classList.toggle("active", on);
        if (key === "reminder") {
          btn.textContent = on ? "⏰ Reminder set" : "⏰ Remind";
        }
      }
    }

    async function refreshVodTrackBar(d, mt) {
      try {
        const state = await fetchVodLibraryItem(d, mt);
        applyVodTrackBarState(state);
      } catch (e) {}
      try {
        const sr = await authFetch("/vod/library/status", { cache: "no-store" });
        if (sr.ok) {
          const st = await sr.json();
          const el = document.getElementById("vodTrackSync");
          if (el) {
            el.textContent = st.configured ? "Trakt sync on" : "Trakt off";
            el.classList.toggle("on", !!st.configured);
          }
        }
      } catch (e) {}
    }

    async function toggleVodTrack(d, mt, track) {
      let state;
      try { state = await fetchVodLibraryItem(d, mt); } catch (e) { state = {}; }
      const patch = { meta: vodLibraryMeta(d) };
      if (track === "reminder") {
        if (state.reminder_at) {
          patch.reminder_at = null;
        } else {
          const raw = window.prompt("Reminder date/time (YYYY-MM-DDTHH:MM)", "");
          if (!raw) return;
          patch.reminder_at = raw.trim();
        }
      } else {
        patch[track] = !state[track];
      }
      try {
        const r = await authFetch("/vod/library/item/" + mt + "/" + encodeURIComponent(d.tmdb_id), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!r.ok) throw new Error("library_put_failed");
        const next = await r.json();
        applyVodTrackBarState(next);
      } catch (e) {
        showErr("Could not update library");
      }
    }

    function wireVodTrackBar(d, mt) {
      const bar = document.getElementById("vodTrackBar");
      if (!bar) return;
      bar.onclick = (e) => {
        const traktBtn = e.target.closest("#vodTraktConnectInline");
        if (traktBtn) {
          openSettingsDrawer();
          startTraktDeviceLogin(document.getElementById("traktDeviceHint"));
          return;
        }
        const btn = e.target.closest(".vod-track-btn[data-track]");
        if (!btn) return;
        toggleVodTrack(d, mt, btn.dataset.track);
      };
      refreshVodTrackBar(d, mt);
      touchVodRecent(d, mt);
      refreshTraktSettingsHint();
    }

    async function refreshTraktSettingsHint() {
      const el = document.getElementById("traktStatusHint");
      const connectBtn = document.getElementById("traktConnectBtn");
      const logoutBtn = document.getElementById("traktLogoutBtn");
      const inline = document.getElementById("vodTraktConnectInline");
      try {
        const r = await authFetch("/vod/library/status", { cache: "no-store" });
        if (!r.ok) throw new Error("status_failed");
        const st = await r.json();
        const connected = !!st.connected;
        const canConnect = !!st.app_configured;
        if (el) {
          el.textContent = connected
            ? ("Trakt connected" + (st.username ? " as " + st.username : "") + ".")
            : (canConnect ? "Connect Trakt to sync watched titles and your watchlist." : "Add TRAKT_CLIENT_ID and TRAKT_CLIENT_SECRET on the server.");
        }
        if (connectBtn) connectBtn.style.display = connected || !canConnect ? "none" : "";
        if (logoutBtn) logoutBtn.style.display = connected ? "" : "none";
        if (inline) {
          inline.textContent = connected ? "Trakt ✓" : "Trakt";
          inline.classList.toggle("active", connected);
        }
      } catch (e) {
        if (el) el.textContent = "Trakt status unavailable.";
      }
    }

    async function startTraktDeviceLogin(hintEl) {
      clearTimeout(traktPollTimer);
      const hint = hintEl || document.getElementById("traktDeviceHint");
      if (hint) {
        hint.style.display = "block";
        hint.textContent = "Starting Trakt login…";
      }
      try {
        const r = await authFetch("/vod/trakt/device/start", { method: "POST" });
        const data = await r.json();
        if (!data.ok) throw new Error(data.error || "start_failed");
        const url = data.verification_url || "https://trakt.tv/activate";
        const code = data.user_code || "";
        if (hint) {
          hint.innerHTML = 'Go to <a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(url)
            + '</a> and enter code <strong>' + escapeHtml(code) + "</strong>";
        }
        const interval = Math.max(3, (data.interval || 5) * 1000);
        traktPollTimer = setTimeout(() => pollTraktDeviceLogin(hint, interval), interval);
      } catch (e) {
        if (hint) hint.textContent = "Could not start Trakt login.";
      }
    }

    async function pollTraktDeviceLogin(hint, interval) {
      try {
        const r = await authFetch("/vod/trakt/device/poll", { cache: "no-store" });
        const data = await r.json();
        if (data.connected) {
          if (hint) hint.textContent = "Trakt connected" + (data.username ? " as " + data.username : "") + ".";
          refreshTraktSettingsHint();
          if (vodCatalogDetail) refreshVodTrackBar(vodCatalogDetail, vodCatalogDetail.type || "movie");
          return;
        }
        if (data.pending) {
          traktPollTimer = setTimeout(() => pollTraktDeviceLogin(hint, interval), interval);
          return;
        }
        if (hint) hint.textContent = "Trakt login expired. Try again.";
      } catch (e) {
        traktPollTimer = setTimeout(() => pollTraktDeviceLogin(hint, interval), interval);
      }
    }

    async function logoutTrakt() {
      try {
        await authFetch("/vod/trakt/logout", { method: "POST" });
      } catch (e) {}
      clearTimeout(traktPollTimer);
      const hint = document.getElementById("traktDeviceHint");
      if (hint) hint.style.display = "none";
      refreshTraktSettingsHint();
    }

    function renderVodDetailFacts(d) {
      const facts = [];
      if (d.rating) facts.push({ label: "Rating", value: String(d.rating) + " / 10" });
      if (d.vote_count) facts.push({ label: "Votes", value: String(d.vote_count) });
      if (d.runtime_minutes) facts.push({ label: "Runtime", value: d.runtime_minutes + " min" });
      if (d.episode_runtime) facts.push({ label: "Episode", value: d.episode_runtime + " min" });
      if (d.number_of_seasons) facts.push({ label: "Seasons", value: String(d.number_of_seasons) });
      if (d.number_of_episodes) facts.push({ label: "Episodes", value: String(d.number_of_episodes) });
      if (d.budget_formatted) facts.push({ label: "Budget", value: d.budget_formatted });
      if (d.revenue_formatted) facts.push({ label: "Box office", value: d.revenue_formatted });
      if (d.networks && d.networks.length) facts.push({ label: "Network", value: d.networks.join(", ") });
      if (d.production_companies && d.production_companies.length) {
        facts.push({ label: "Studio", value: d.production_companies.slice(0, 2).join(", ") });
      }
      if (d.imdb_url) {
        facts.push({ label: "IMDb", value: '<a href="' + escapeHtml(d.imdb_url) + '" target="_blank" rel="noopener">View on IMDb</a>' });
      }
      if (!facts.length && !(d.providers && d.providers.length)) return "";
      let html = '<section class="vod-detail-section"><h4 class="vod-section-title">Details</h4><div class="vod-detail-facts">';
      for (const f of facts) {
        html += '<div class="vod-fact"><span class="label">' + escapeHtml(f.label) + '</span>'
          + '<span class="value">' + (f.label === "IMDb" ? f.value : escapeHtml(f.value)) + "</span></div>";
      }
      html += renderVodStreamBadges(d.providers || []);
      html += "</div></section>";
      return html;
    }

    function renderVodDetailCast(d) {
      if (!d.cast || !d.cast.length) return "";
      let html = '<section class="vod-detail-section vod-detail-cast"><h4 class="vod-section-title">Cast</h4><div class="vod-cast-grid">';
      for (const c of d.cast.slice(0, 12)) {
        const img = c.profile_url
          ? '<img src="' + escapeHtml(c.profile_url) + '" alt="" loading="lazy"/>'
          : '<div class="ph">👤</div>';
        html += '<button type="button" class="vod-cast-card" data-person-id="' + escapeHtml(String(c.id || "")) + '">'
          + img + '<div class="name">' + escapeHtml(c.name || "") + '</div>'
          + (c.character ? '<div class="role">' + escapeHtml(c.character) + "</div>" : "")
          + "</button>";
      }
      html += "</div></section>";
      return html;
    }

    function renderVodDetailCrew(d) {
      if (!d.crew || !d.crew.length) return "";
      let html = '<section class="vod-detail-section vod-detail-crew"><h4 class="vod-section-title">Crew</h4><div class="vod-crew-list">';
      for (const c of d.crew) {
        html += '<div class="vod-crew-row"><span class="job">' + escapeHtml(c.job || "") + '</span>'
          + '<span class="name">' + escapeHtml(c.name || "") + "</span></div>";
      }
      html += "</div></section>";
      return html;
    }

    function renderVodDetailKeywords(d) {
      if (!d.keywords || !d.keywords.length) return "";
      let html = '<section class="vod-detail-section"><h4 class="vod-section-title">Themes</h4><div class="vod-keywords">';
      for (const kw of d.keywords) {
        html += '<span class="vod-keyword">' + escapeHtml(kw) + "</span>";
      }
      html += "</div></section>";
      return html;
    }

    function renderVodDetailRelated(sections) {
      if (!sections || !sections.length) return null;
      const wrap = document.createElement("div");
      wrap.className = "vod-detail-related";
      let added = false;
      for (const sec of sections) {
        if (sec.items && sec.items.length) {
          if (!added) {
            const head = document.createElement("h4");
            head.className = "vod-section-title";
            head.textContent = "More like this";
            wrap.appendChild(head);
            added = true;
          }
          wrap.appendChild(renderVodSection(sec.title, sec.items, false, (idx) => buildVodQueueFromSectionItems(sec.items, idx)));
        }
      }
      return added ? wrap : null;
    }

    function wireVodDetailRelated(container) {
      if (!container) return;
      container.querySelectorAll(".vod-cast-card").forEach(btn => {
        btn.addEventListener("click", () => {
          const pid = btn.dataset.personId;
          if (!pid) return;
          const name = btn.querySelector(".name")?.textContent || "";
          loadVodPersonBrowse(pid, name);
        });
      });
    }

    async function loadVodPersonBrowse(personId, name) {
      await vodNavigate({
        view: "person",
        personId: String(personId),
        personName: name || "",
        type: vodBrowseType(),
      });
    }

    async function loadVodPersonBrowseUI(personId, name, mediaType) {
      if (!vodCatalogBody) return;
      hideVodDetailUI();
      vodCatalogBody.style.display = "";
      resetVodInfiniteScroll();
      const title = name ? ("Titles with " + name) : "Related titles";
      await loadVodPaginatedGrid({
        reset: true,
        type: mediaType || vodBrowseType(),
        title,
        castId: personId,
      });
    }

    function renderVodDetailContent(d, mt) {
      let html = '<div class="vod-detail-body">';
      html += '<div class="vod-detail-toolbar">';
      html += '<div class="vod-detail-actions">';
      html += '<button type="button" class="back" id="vodDetailBack">← Back</button>';
      html += '<button type="button" class="play" id="vodDetailPlay">▶ Play</button>';
      html += '<button type="button" class="trailer" id="vodDetailSources">Sources</button>';
      if (d.trailer_youtube) {
        html += '<button type="button" class="trailer" id="vodDetailTrailer">⛶ Trailer</button>';
      }
      html += '<button type="button" class="trailer" id="vodPartyBtn">Start party</button>';
      html += "</div>";
      html += renderVodTrackBar();
      html += "</div>";
      html += renderVodDetailMetaStrip(d, mt);
      if (d.tagline || d.overview) {
        html += '<section class="vod-detail-section vod-detail-synopsis"><h4 class="vod-section-title">Synopsis</h4>';
        if (d.tagline) html += '<p class="vod-detail-tagline">' + escapeHtml(d.tagline) + "</p>";
        if (d.overview) html += '<p class="vod-detail-overview">' + escapeHtml(d.overview) + "</p>";
        html += "</section>";
      }
      html += renderVodDetailCast(d);
      html += renderVodDetailFacts(d);
      html += renderVodDetailCrew(d);
      html += renderVodDetailKeywords(d);
      if (mt === "tv" && d.seasons && d.seasons.length) {
        html += '<section class="vod-detail-section vod-detail-episodes"><h4 class="vod-section-title">Episodes</h4>';
        html += '<select class="vod-season-select" id="vodSeasonSelect">';
        for (const s of d.seasons) {
          if (s.season < 1) continue;
          html += '<option value="' + s.season + '">' + escapeHtml(s.name || ("Season " + s.season)) + "</option>";
        }
        html += '</select><div class="vod-episodes" id="vodEpisodeList"></div></section>';
      }
      html += "</div>";
      return html;
    }

    function wireVodDetailActions(d, mt) {
      document.getElementById("vodDetailBack").addEventListener("click", () => vodGoBack());
      document.getElementById("vodDetailPlay").addEventListener("click", () => playVodFromCatalogDetail());
      const sourcesBtn = document.getElementById("vodDetailSources");
      if (sourcesBtn) {
        sourcesBtn.addEventListener("click", async () => {
          const ctx = {
            tmdbId: String(d.tmdb_id),
            mediaType: mt,
            season: "",
            episode: "",
            title: d.title || "",
          };
          if (mt === "tv") {
            const def = await resolveDefaultSeriesEpisode(d);
            ctx.season = String(def.season || 1);
            ctx.episode = String(def.episode || 1);
          }
          vodPickerCtx = Object.assign({}, ctx);
          openVodPickerForCtx(ctx);
        });
      }
      wireVodTrackBar(d, mt);
      const partyBtn = document.getElementById("vodPartyBtn");
      if (partyBtn) {
        partyBtn.addEventListener("click", async () => {
          const def = mt === "tv" ? await resolveDefaultSeriesEpisode(d) : null;
          const partyCtx = {
            tmdbId: String(d.tmdb_id),
            mediaType: mt,
            title: d.title || "",
            season: mt === "tv" ? String((def && def.season) || 1) : "",
            episode: mt === "tv" ? String((def && def.episode) || 1) : "",
          };
          vodPickerCtx = Object.assign({}, vodPickerCtx || {}, partyCtx);
          if (window.SDParty && SDParty.createParty) {
            await SDParty.createParty({ content: partyCtx });
            if (SDParty.openPanel) SDParty.openPanel();
          }
        });
      }
      if (d.trailer_youtube) {
        document.getElementById("vodDetailTrailer").addEventListener("click", () => {
          expandVodHeroTrailer(d.trailer_youtube);
        });
      }
      if (mt === "tv" && d.seasons && d.seasons.length) {
        const sel = document.getElementById("vodSeasonSelect");
        if (!sel) return;
        const playBtn = document.getElementById("vodDetailPlay");
        const applyDefaultSeason = async () => {
          try {
            const def = await resolveDefaultSeriesEpisode(d);
            if (def && def.season) sel.value = String(def.season);
            if (playBtn) {
              playBtn.dataset.playLabel = "S" + String(def.season).padStart(2, "0")
                + "E" + String(def.episode).padStart(2, "0");
              updateVodDetailPlayLabel();
            }
          } catch (e) {}
        };
        const loadEps = async () => {
          const epList = document.getElementById("vodEpisodeList");
          epList.innerHTML = '<div class="vod-catalog-loading">Loading episodes…</div>';
          const sr = await authFetch("/vod/catalog/tv/" + d.tmdb_id + "/season/" + sel.value, { cache: "no-store" });
          const sdata = await sr.json();
          epList.innerHTML = "";
          let highlightEp = null;
          try {
            const def = await resolveDefaultSeriesEpisode(d);
            if (def && String(def.season) === String(sel.value)) highlightEp = Number(def.episode);
          } catch (e) {}
          for (const ep of (sdata.episodes || [])) {
            const row = document.createElement("button");
            row.type = "button";
            row.className = "vod-ep-row";
            if (ep.aired === false) row.classList.add("unaired");
            if (highlightEp != null && Number(ep.episode) === highlightEp) row.classList.add("is-default");
            const air = fmtEpisodeAirDate(ep.air_date);
            const airLabel = air ? (ep.aired === false ? ("Airs " + air) : air) : "";
            row.innerHTML = '<span class="num">' + ep.episode + "</span>"
              + '<span class="body"><span class="name">' + escapeHtml(ep.title || "") + "</span>"
              + (airLabel ? '<span class="air">' + escapeHtml(airLabel) + "</span>" : "")
              + "</span>";
            row.addEventListener("click", () => playVodFromCatalogDetail(sel.value, ep.episode));
            epList.appendChild(row);
          }
        };
        sel.addEventListener("change", loadEps);
        applyDefaultSeason().then(loadEps);
      } else {
        updateVodDetailPlayLabel();
      }
    }

    async function showVodDetail(tmdbId, mediaType, imdbId) {
      const mt = mediaType === "tv" ? "tv" : "movie";
      const nav = { view: "detail", type: mt, tmdbId: String(tmdbId) };
      if (imdbId) nav.imdbId = String(imdbId);
      await vodNavigate(nav);
    }

    async function showVodDetailUI(tmdbId, mediaType, imdbId) {
      if (!vodDetail || !vodDetailHero || !vodDetailScroll) return;
      syncLiveAudioForVodTrailer(false);
      pauseVodHeroTrailer();
      const mt = mediaType === "tv" ? "tv" : "movie";
      vodDetailScroll.innerHTML = '<div class="vod-catalog-loading">Loading…</div>';
      if (vodCatalogBody) vodCatalogBody.style.display = "none";
      if (vodCatalogTabs) vodCatalogTabs.style.display = "none";
      if (vodProviderBar) vodProviderBar.style.display = "none";
      if (vodFilterBar) vodFilterBar.style.display = "none";
      vodDetail.classList.add("show");
      try {
        let detailUrl = "/vod/catalog/" + mt + "/" + encodeURIComponent(tmdbId);
        if (imdbId) detailUrl += "?imdb=" + encodeURIComponent(imdbId);
        const r = await authFetch(detailUrl, { cache: "no-store" });
        if (!r.ok) throw new Error("detail_failed");
        const d = await r.json();
        vodCatalogDetail = d;
        const backdrop = d.backdrop_url
          ? '<img class="backdrop" src="' + escapeHtml(d.backdrop_url) + '" alt="" loading="lazy"/>'
          : "";
        const poster = d.poster_url
          ? '<img class="poster" src="' + escapeHtml(d.poster_url) + '" alt="" loading="lazy"/>'
          : "";
        const ytId = d.trailer_youtube ? normalizeYoutubeId(d.trailer_youtube) : "";
        vodDetailHero.classList.toggle("has-trailer", !!ytId);
        const mainBlock = buildVodHeroMetaBlock(d, mt, poster);
        let heroInner = "";
        if (ytId) {
          heroInner = '<div class="vod-hero-media" id="vodTrailerHeroSlot">' + buildVodTrailerMarkup() + "</div>"
            + '<div class="vod-hero-shade"></div>'
            + buildVodTrailerMuteBtn()
            + '<div class="vod-detail-nav"><button type="button" id="vodDetailPrev" aria-label="Previous title">‹</button>'
            + '<button type="button" id="vodDetailNext" aria-label="Next title">›</button></div>'
            + '<div class="vod-detail-hero-inner"><div class="vod-detail-main">' + mainBlock + "</div></div>"
            + buildVodTrailerUi();
        } else {
          heroInner = '<div class="vod-hero-shade"></div>'
            + '<div class="vod-detail-nav"><button type="button" id="vodDetailPrev" aria-label="Previous title">‹</button>'
            + '<button type="button" id="vodDetailNext" aria-label="Next title">›</button></div>'
            + '<div class="vod-detail-main">' + mainBlock + "</div>";
        }
        vodDetailHero.innerHTML = backdrop + heroInner;
        vodDetailScroll.innerHTML = renderVodDetailContent(d, mt);
        if (ytId) {
          vodHeroTrailerId = ytId;
          bindVodTrailerLayout();
          layoutVodDetailTrailer(true);
          wireVodTrailerControls(ytId);
          if (vodTrailerAutoplayEnabled()) mountVodHeroTrailer(ytId);
          else settleVodHeroTrailer();
        } else {
          stopVodHeroTrailer();
        }
        wireVodDetailActions(d, mt);
        const prevBtn = document.getElementById("vodDetailPrev");
        const nextBtn = document.getElementById("vodDetailNext");
        if (prevBtn) prevBtn.addEventListener("click", (e) => { e.stopPropagation(); stepVodDetail(-1); });
        if (nextBtn) nextBtn.addEventListener("click", (e) => { e.stopPropagation(); stepVodDetail(1); });
        updateVodDetailNav();
        bumpVodDetailViews();
        const relatedEl = renderVodDetailRelated(d.related_sections || []);
        const detailBody = vodDetailScroll.querySelector(".vod-detail-body");
        if (relatedEl) {
          if (detailBody) detailBody.appendChild(relatedEl);
          else vodDetailScroll.appendChild(relatedEl);
        }
        wireVodDetailRelated(vodDetailScroll);
        vodDetailScroll.scrollTop = 0;
      } catch (e) {
        vodDetailScroll.innerHTML = '<div class="vod-catalog-loading">Could not load details.</div>';
      }
    }

    async function fetchLibrarySeriesProgress(tmdbId) {
      try {
        const r = await authFetch("/vod/library/item/tv/" + encodeURIComponent(tmdbId), { cache: "no-store" });
        if (!r.ok) return null;
        const item = await r.json();
        if (!item) return null;
        const season = parseInt(item.season, 10);
        const episode = parseInt(item.episode, 10);
        if (!season || !episode) return null;
        return { season, episode, progress_seconds: item.progress_seconds || 0 };
      } catch (e) {
        return null;
      }
    }

    async function nextEpisodeAfter(tmdbId, season, episode) {
      const eps = await loadSeasonEpisodes(tmdbId, season);
      const higher = (eps || []).find((ep) => Number(ep.episode) > Number(episode));
      if (higher) {
        return {
          season: Number(season),
          episode: Number(higher.episode),
          title: higher.title || ("Episode " + higher.episode),
          air_date: higher.air_date || null,
        };
      }
      const detail = vodCatalogDetail;
      const seasons = ((detail && detail.seasons) || [])
        .map((s) => Number(s.season))
        .filter((n) => n >= 1)
        .sort((a, b) => a - b);
      const si = seasons.indexOf(Number(season));
      if (si >= 0 && si < seasons.length - 1) {
        const ns = seasons[si + 1];
        const nextEps = await loadSeasonEpisodes(tmdbId, ns);
        if (nextEps && nextEps.length) {
          const first = nextEps[0];
          return {
            season: ns,
            episode: Number(first.episode),
            title: first.title || ("Episode " + first.episode),
            air_date: first.air_date || null,
          };
        }
      }
      return null;
    }

    async function resolveDefaultSeriesEpisode(d) {
      if (!d || !d.tmdb_id) return { season: 1, episode: 1, title: "", air_date: null };
      const mode = vodSeriesPlayMode();
      if (mode === "progressive") {
        const prog = await fetchLibrarySeriesProgress(d.tmdb_id);
        if (prog) {
          // If nearly finished (>90% or >20 min into a typical ep), skip ahead; else resume same ep.
          const resumeSame = Number(prog.progress_seconds || 0) < 60;
          if (resumeSame) {
            return {
              season: prog.season,
              episode: prog.episode,
              title: "",
              air_date: null,
              reason: "resume",
            };
          }
          const nxt = await nextEpisodeAfter(d.tmdb_id, prog.season, prog.episode);
          if (nxt) return Object.assign({ reason: "next" }, nxt);
          return {
            season: prog.season,
            episode: prog.episode,
            title: "",
            air_date: null,
            reason: "last",
          };
        }
        // No history → start at S1E1
        return { season: 1, episode: 1, title: "", air_date: null, reason: "start" };
      }
      // latest aired
      if (d.latest_aired && d.latest_aired.season && d.latest_aired.episode) {
        return {
          season: Number(d.latest_aired.season),
          episode: Number(d.latest_aired.episode),
          title: d.latest_aired.title || "",
          air_date: d.latest_aired.air_date || null,
          reason: "latest",
        };
      }
      // Fallback: scan seasons for last aired
      const seasons = ((d.seasons || []).map((s) => Number(s.season)).filter((n) => n >= 1).sort((a, b) => b - a));
      for (const sn of seasons) {
        const eps = await loadSeasonEpisodes(d.tmdb_id, sn);
        const aired = (eps || []).filter((ep) => ep.aired !== false && (ep.air_date || ep.title));
        const pick = aired.length ? aired[aired.length - 1] : (eps && eps.length ? eps[eps.length - 1] : null);
        if (pick) {
          return {
            season: sn,
            episode: Number(pick.episode),
            title: pick.title || "",
            air_date: pick.air_date || null,
            reason: "latest-scan",
          };
        }
      }
      return { season: 1, episode: 1, title: "", air_date: null, reason: "fallback" };
    }

    async function playVodFromCatalogDetail(season, episode) {
      pauseVodHeroTrailer();
      syncLiveAudioForVodTrailer(false);
      const d = vodCatalogDetail;
      if (!d || !d.tmdb_id) return;
      const mt = (d.type === "tv" || d.type === "series" || d.type === "show") ? "tv" : "movie";
      const ctx = {
        tmdbId: String(d.tmdb_id),
        mediaType: mt,
        season: season ? String(season) : "",
        episode: episode ? String(episode) : "",
        title: d.title || "",
      };
      if (mt === "tv") {
        if (!ctx.season || !ctx.episode) {
          const def = await resolveDefaultSeriesEpisode(d);
          ctx.season = String(def.season || 1);
          ctx.episode = String(def.episode || 1);
          if (def.title) ctx.episodeTitle = def.title;
        }
      }
      vodPickerCtx = Object.assign({}, ctx);
      await startVodPlayback(ctx, "vod_detail");
    }

    function getCachedEntry(cache, id, opts) {
      opts = opts || {};
      const entry = cache.get(id);
      if (!entry) return null;
      const age = Date.now() - entry.fetchedAt;
      if (age <= entry.ttl) return entry.data;
      // Stale-while-revalidate: keep painting until a refresh lands.
      if (opts.allowStale !== false && age <= entry.ttl + EPG_STALE_GRACE_MS) return entry.data;
      return null;
    }

    function isCacheFresh(cache, id) {
      const entry = cache.get(id);
      if (!entry) return false;
      return (Date.now() - entry.fetchedAt) <= entry.ttl;
    }

    function setCachedEntry(cache, id, data, ttl) {
      cache.set(id, { data, fetchedAt: Date.now(), ttl });
    }

    function clearEpgCaches() {
      epgCache.clear();
      scheduleCache.clear();
      epgInflight.clear();
      // Keep epgSlowIds — still useful across revision bumps.
    }

    function fmtDay(d) {
      return d.toLocaleDateString(undefined, { weekday: "long" });
    }
    function fmtTime(d) {
      return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    }
    function fmtShort(d) {
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ", " + fmtTime(d);
    }
    function fmtClock(iso) {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      let h = d.getHours();
      const m = d.getMinutes();
      const ap = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      if (m === 0) return h + ap;
      return h + ":" + String(m).padStart(2, "0") + ap;
    }
    function minsRemaining(stopIso) {
      const stop = new Date(stopIso).getTime();
      if (isNaN(stop)) return 0;
      return Math.max(0, Math.ceil((stop - Date.now()) / 60000));
    }
    function detectHeaderLayout() {
      const w = nowTitle ? nowTitle.clientWidth : window.innerWidth;
      if (w >= 900) return "full";
      if (w >= 640) return "standard";
      if (w >= 400) return "compact";
      return "tiny";
    }

    function programmeKind(prog) {
      if (!prog) return "other";
      if (prog.programme_type) return prog.programme_type;
      const cats = (prog.categories || (prog.category ? [prog.category] : [])).map(c => String(c).toLowerCase());
      if (prog.season || prog.episode || prog.episode_label) return "series";
      if (cats.some(c => /movie|film/.test(c))) return "movie";
      if (cats.some(c => /sport/.test(c))) return "sports";
      if (cats.some(c => /news/.test(c))) return "news";
      return "other";
    }

    function programmeMetaShort(prog) {
      const kind = programmeKind(prog);
      if (kind === "series") {
        if (prog.episode_label) return String(prog.episode_label).replace(/\s+/g, "");
        if (prog.season != null && prog.episode != null) return "S" + prog.season + "E" + prog.episode;
        if (prog.subtitle && !isPlotLikeText(prog.subtitle)) return prog.subtitle;
      }
      if (kind === "movie" && prog.year) return String(prog.year);
      return "";
    }

    function programmeMetaLong(prog) {
      const kind = programmeKind(prog);
      const parts = [];
      if (kind === "series") {
        const ep = (prog.episode_label
          ? String(prog.episode_label).replace(/\s+/g, "")
          : (prog.season != null && prog.episode != null ? "S" + prog.season + "E" + prog.episode : ""));
        if (ep) parts.push(ep);
        if (prog.subtitle && !isPlotLikeText(prog.subtitle)) parts.push(prog.subtitle);
      } else if (kind === "movie" && prog.year) {
        parts.push("(" + prog.year + ")");
      }
      return parts.join(" · ");
    }

    function formatTimeRange(start, stop, compact) {
      return fmtClock(start) + (compact ? "-" : "–") + fmtClock(stop);
    }

    function buildOnAirParts(channelName, epgData, layout) {
      if (!epgData || !epgData.has_data || !epgData.now || !epgData.now.title) {
        return { channel: channelName, title: null, meta: "", time: "", remain: "" };
      }
      const p = epgData.now;
      if (!p.start || !p.stop) return { channel: channelName, title: null, meta: "", time: "", remain: "" };
      const compact = layout === "compact" || layout === "tiny";
      const epCode = programmeMetaShort(p);
      const meta = (layout === "full" || layout === "standard") ? programmeMetaLong(p) : "";
      const time = formatTimeRange(p.start, p.stop, compact);
      const remain = minsRemaining(p.stop) + "m left";
      let title = p.title;
      // Narrow header: fold S#E# into the title so it survives compact/tiny CSS.
      if (compact && epCode && /^S\d+E\d+/i.test(epCode)) {
        title = p.title + " · " + epCode;
      } else if (compact && epCode && !meta) {
        title = p.title + " · " + epCode;
      }
      if (layout === "tiny") return { channel: channelName, title: title, meta: meta, time: "", remain: remain };
      return { channel: channelName, title: title, meta: meta, time: time, remain: remain };
    }

    function renderOnAirLine(container, parts) {
      if (!container) return;
      container.innerHTML = "";
      const ch = document.createElement("span");
      ch.className = "hdr-ch";
      ch.textContent = parts.channel;
      ch.title = (parts.channel || "Channel") + " info";
      ch.setAttribute("role", "button");
      ch.tabIndex = 0;
      container.appendChild(ch);
      if (!parts.title) return;
      const sep = document.createElement("span");
      sep.className = "hdr-sep";
      sep.textContent = " : ";
      container.appendChild(sep);
      const title = document.createElement("span");
      title.className = "hdr-title meta-hover-target";
      title.textContent = parts.title;
      container.appendChild(title);
      if (parts.meta) {
        const meta = document.createElement("span");
        meta.className = "hdr-meta";
        meta.textContent = " " + parts.meta;
        container.appendChild(meta);
      }
      if (parts.time) {
        const time = document.createElement("span");
        time.className = "hdr-time";
        time.textContent = " " + parts.time;
        container.appendChild(time);
      }
      if (parts.remain) {
        const rem = document.createElement("span");
        rem.className = "hdr-remain";
        rem.textContent = " · " + parts.remain;
        container.appendChild(rem);
      }
    }

    function formatGridProgrammeLabel(prog, cellWidth) {
      const title = (prog && prog.title) || "Programme";
      const kind = programmeKind(prog);
      const px = Math.max(0, Number(cellWidth) || 0);
      // Dynamic layout from measured cell width (px-per-minute ≈ SLOT_W / 30).
      const showClock = px >= 110;
      const showExtra = px >= 132;
      const bits = [];
      // Always surface S#E# when present — even in narrow cells.
      if (kind === "series") {
        if (prog.episode_label) bits.push(String(prog.episode_label).replace(/\s+/g, ""));
        else if (prog.season != null && prog.episode != null) bits.push("S" + prog.season + "E" + prog.episode);
      } else if (showExtra && kind === "movie" && prog.year && px > 150) {
        bits.push(String(prog.year));
      }
      let primary = title;
      if (bits.length) primary += " · " + bits[0];
      // Very narrow cells: truncate aggressively via CSS; drop clock secondary.
      const clock = showClock && prog && prog.start ? fmtClock(prog.start) : "";
      return { primary, clock };
    }

    function layoutProgrammeCell(st, sp, totalW) {
      const rawLeft = ((st - gridStartMs) / SLOT_MS) * SLOT_W();
      const rawWidth = ((sp - st) / SLOT_MS) * SLOT_W();
      let left = Math.max(0, rawLeft);
      // Clip programmes that started before the grid so text never paints left of col 0.
      let width = rawWidth - (left - rawLeft);
      width = Math.min(width, totalW - left);
      const minW = Math.max(28, SLOT_W() * 0.35);
      if (width < minW) return null;
      return { left, width };
    }

    function channelLikelyHasEpg(id) {
      const ch = channelMap[id];
      if (!ch) return true; // unknown — try fetch
      if (ch.epg_has_data === false) return false;
      if (ch.epg_has_data === true) return true;
      return !!(ch.tvg_id);
    }

    async function mapPool(items, limit, worker) {
      const out = new Array(items.length);
      let next = 0;
      const runners = [];
      const run = async () => {
        while (next < items.length) {
          const i = next++;
          out[i] = await worker(items[i], i);
        }
      };
      const n = Math.max(1, Math.min(limit || 4, items.length || 1));
      for (let r = 0; r < n; r++) runners.push(run());
      await Promise.all(runners);
      return out;
    }
    function snapGridStart(now) {
      const d = new Date(now);
      const mins = d.getMinutes();
      d.setSeconds(0, 0);
      d.setMinutes(mins >= 30 ? 30 : 0);
      d.setMinutes(d.getMinutes() - 60);
      return d.getTime();
    }
    function slotIndexForNow(now) {
      return Math.floor((now - gridStartMs) / SLOT_MS);
    }

    function guideNowScrollLeft() {
      const slot = Math.max(0, Math.min(NUM_SLOTS - 1, slotIndexForNow(Date.now())));
      // Keep a sliver of past context so "now" is not flush against the rail.
      return Math.max(0, Math.round((slot - 0.4) * SLOT_W()));
    }

    function scrollGuideToNow(opts) {
      opts = opts || {};
      if (!gridScroll) return;
      if (opts.force) {
        guideFollowNow = true;
        guideUserPanned = false;
        clearTimeout(guideNowIdleTimer);
        guideNowIdleTimer = null;
      }
      if (!guideFollowNow && !opts.force) return;
      buildTimeHeader();
      const left = guideNowScrollLeft();
      guideProgrammaticScroll = true;
      syncScroll = true;
      gridScroll.scrollLeft = left;
      if (timeRow) timeRow.style.transform = "translate3d(" + (-left) + "px,0,0)";
      syncScroll = false;
      requestAnimationFrame(() => { guideProgrammaticScroll = false; });
    }

    function markGuideUserPanned() {
      if (guideProgrammaticScroll || syncScroll) return;
      guideUserPanned = true;
      guideFollowNow = false;
      clearTimeout(guideNowIdleTimer);
      guideNowIdleTimer = setTimeout(() => {
        guideFollowNow = true;
        guideUserPanned = false;
        scrollGuideToNow({ force: true });
      }, GUIDE_NOW_IDLE_MS);
    }

    function showCinemaInfoOverlay(opts) {
      opts = opts || {};
      if (!tvRoot) return;
      const key = opts.key || cinemaInfoLastKey;
      // Avoid re-show loops from periodic header/EPG refresh of the same title.
      if (opts.onlyIfChanged && key && key === cinemaInfoLastKey && !opts.force) {
        return;
      }
      if (key) cinemaInfoLastKey = key;
      tvRoot.classList.remove("cinema-info-hidden");
      tvRoot.classList.add("cinema-info-visible");
      clearTimeout(cinemaInfoHideTimer);
      cinemaInfoHideTimer = null;
      // Prefetch now-next + schedule for the tuned channel when info opens.
      try {
        const id = String((headerMeta && headerMeta.channel_id) || channelId || "");
        if (id && channelLikelyHasEpg(id)) prefetchChannelEpg(id);
      } catch (e) {}
      if (opts.autoHide === false) return;
      cinemaInfoHideTimer = setTimeout(() => {
        hideCinemaInfoOverlay();
      }, opts.ms || CINEMA_INFO_HIDE_MS);
    }

    function hideCinemaInfoOverlay() {
      clearTimeout(cinemaInfoHideTimer);
      cinemaInfoHideTimer = null;
      if (tvRoot) {
        tvRoot.classList.add("cinema-info-hidden");
        tvRoot.classList.remove("cinema-info-visible");
      }
    }

    let lastErrToastMsg = "";
    let lastErrToastAt = 0;
    function showErr(msg) {
      const text = String(msg || "");
      const now = Date.now();
      // Dedupe identical toasts (switch/retry loops used to spam the same line).
      if (text && text === lastErrToastMsg && (now - lastErrToastAt) < 8000) return;
      lastErrToastMsg = text;
      lastErrToastAt = now;
      errToast.textContent = text;
      errToast.classList.add("show");
      setTimeout(() => errToast.classList.remove("show"), 4000);
    }
    function samplePaintLooksDead(force) {
      // Detect HW-decode garbage (classic solid green / blue-green split) that still
      // reports readyState>=2 so soft-reconnect never fires.
      const now = Date.now();
      if (!force && lastPaintSampleAt && (now - lastPaintSampleAt) < 900) return lastPaintDead;
      lastPaintSampleAt = now;
      if (!v) {
        lastPaintDead = false;
        return false;
      }
      try {
        if (v.paused || v.ended || v.readyState < 2 || v.videoWidth < 16 || v.videoHeight < 16) {
          lastPaintDead = false;
          return false;
        }
        if (!paintCanvas) {
          paintCanvas = document.createElement("canvas");
          paintCanvas.width = 48;
          paintCanvas.height = 27;
          paintCtx = paintCanvas.getContext("2d", { willReadFrequently: true });
        }
        if (!paintCtx) {
          lastPaintDead = false;
          return false;
        }
        paintCtx.drawImage(v, 0, 0, paintCanvas.width, paintCanvas.height);
        const data = paintCtx.getImageData(0, 0, paintCanvas.width, paintCanvas.height).data;
        const n = paintCanvas.width * paintCanvas.height;
        let sumR = 0, sumG = 0, sumB = 0, sum2 = 0;
        for (let i = 0; i < data.length; i += 4) {
          sumR += data[i];
          sumG += data[i + 1];
          sumB += data[i + 2];
        }
        const mr = sumR / n, mg = sumG / n, mb = sumB / n;
        for (let i = 0; i < data.length; i += 4) {
          const dr = data[i] - mr, dg = data[i + 1] - mg, db = data[i + 2] - mb;
          sum2 += dr * dr + dg * dg + db * db;
        }
        const variance = sum2 / n;
        let dark = 0, bright = 0, chromaNoise = 0, greenish = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const lum = (r + g + b) / 3;
          if (lum < 14) dark += 1;
          else bright += 1;
          // Speckle/macroblock noise on otherwise-black HW fails (green/purple flecks).
          if ((g > 36 && g > r * 2 && g > b * 2) || (b > 48 && r < 24 && g < 40) || (r > 48 && g < 20 && b < 40)) {
            chromaNoise += 1;
          }
          if (g > 28 && g > r * 2 && g > b * 2) greenish += 1;
        }
        const darkRatio = dark / n;
        // Dark real scenes are fine UNLESS chroma speckles betray a dead decoder.
        const blackNoiseFail = darkRatio > 0.9 && chromaNoise >= 4 && bright < n * 0.1;
        // Classic green decode fail (field: mean ~1,40,1).
        const greenFail = (mg > 28 && mg > mr * 2.5 && mg > mb * 2.5 && variance < 3500) || greenish > n * 0.35;
        // Near-solid non-black garbage.
        const solidFail = variance < 500 && (mr + mg + mb) > 36;
        // Blue/green split (field landscape: mean ~2,27,149).
        const chromaFail =
          variance < 10000 &&
          Math.min(mr, mg, mb) < 18 &&
          Math.max(mr, mg, mb) > 95 &&
          (mg > 70 || mb > 110);
        lastPaintDead = !!(blackNoiseFail || greenFail || solidFail || chromaFail);
        return lastPaintDead;
      } catch (e) {
        lastPaintDead = false;
        return false;
      }
    }
    function paintLooksDead() {
      return samplePaintLooksDead(false);
    }
    function playbackLooksHealthy() {
      if (!v) return false;
      try {
        if (v.paused || v.ended || v.seeking) return false;
        if (paintLooksDead()) return false;
        // HAVE_CURRENT_DATA+ with advancing/playable frames
        if (v.readyState >= 2 && !v.error) return true;
      } catch (e) {}
      return false;
    }
    function mediaPaintingOk() {
      if (!v) return false;
      try {
        if (paintLooksDead()) return false;
        return !v.paused && !v.ended && !v.seeking && v.readyState >= 2 && !v.error;
      } catch (e) {
        return false;
      }
    }
    function clearPaintWatch() {
      if (paintWatchTimer) {
        clearInterval(paintWatchTimer);
        paintWatchTimer = null;
      }
      paintDeadStreak = 0;
      paintDeadSince = 0;
    }
    // GPU keep-alive CSS experiment (20260908l) A/B'd on USA 343 — no paint improvement; removed.
    function clearNoFrameWatch(opts) {
      opts = opts || {};
      if (noFrameWatchTimer) {
        clearInterval(noFrameWatchTimer);
        noFrameWatchTimer = null;
      }
      if (opts.reset !== false) {
        noFrameSince = 0;
        noFrameFailArmed = false;
      }
    }
    function pauseNoFrameWatch() {
      // Soft remounts reset the clock on re-attach (recover budgets own thrash limits).
      clearNoFrameWatch({ reset: true });
    }
    function mediaHasDecodableFrame() {
      if (!v) return false;
      try {
        return !!(v.videoWidth >= 16 && v.videoHeight >= 16 && v.readyState >= 2 && !v.error);
      } catch (e) {
        return false;
      }
    }
    function noFrameCountdownShouldRun() {
      // Don't fail-fast while playlist/segments are still spinning up after tune/remount.
      if (liveRecoverTimer || switching) return false;
      if (bufferVisible && bufferStatus) {
        const t = String(bufferStatus.textContent || "");
        if (/loading|tuning|reconnect|starting|buffering/i.test(t)) return false;
      }
      try {
        if (hls && typeof hls.levels !== "undefined" && (!hls.levels || !hls.levels.length)) {
          return false; // manifest not parsed yet
        }
      } catch (e) {}
      return true;
    }
    function armNoFrameWatch() {
      if (noFrameWatchTimer) return;
      noFrameWatchTimer = setInterval(() => {
        if (vodHlsActive || liveEmbedActive || switching) {
          return;
        }
        if (!v || !currentStreamUrl || !isLiveStreamUrl(currentStreamUrl)) {
          return;
        }
        // User-facing gate (tap to play / soft retry) owns the UI — don't double-fire.
        if (tapPlay && tapPlay.classList.contains("show")) {
          return;
        }
        // Paint-death path has frames (vw>0) — leave that to paint grace → embed.
        if (mediaHasDecodableFrame()) {
          noFrameSince = 0;
          noFrameFailArmed = false;
          return;
        }
        // Paused before first frame with intentional mute/autoplay gate is OK.
        if (v.paused && autoplayPolicyBlocked) {
          return;
        }
        if (!noFrameCountdownShouldRun()) {
          noFrameSince = 0;
          return;
        }
        const now = Date.now();
        if (!noFrameSince) noFrameSince = now;
        if (!noFrameFailArmed && (now - noFrameSince) >= NO_FRAME_FAILFAST_MS) {
          noFrameFailArmed = true;
          try { console.info("[live] no-frame fail-fast after", now - noFrameSince, "ms"); } catch (e) {}
          clearNoFrameWatch({ reset: true });
          showLiveSoftRetry("no-frame");
        }
      }, 1000);
    }
    function applyAndroidAbrCap(hlsInstance) {
      // Cap MSE to ≤720 when master has multiple levels — no-op on single-rung 1080 feeds.
      if (!isAndroid || !hlsInstance) return;
      let levels = null;
      try { levels = hlsInstance.levels; } catch (e) { return; }
      if (!levels || levels.length < 2) return;
      let maxOk = -1;
      for (let i = 0; i < levels.length; i++) {
        const lv = levels[i] || {};
        const h = Number(lv.height) || 0;
        const w = Number(lv.width) || 0;
        if (h > 0 && h <= ANDROID_LEVEL_CAP_HEIGHT) maxOk = i;
        else if (h === 0 && w > 0 && w <= 1280) maxOk = i;
      }
      if (maxOk < 0) return; // all variants above 720 — leave uncapped (paint→embed handles)
      try {
        hlsInstance.autoLevelCapping = maxOk;
        if (typeof hlsInstance.startLevel === "number" && (hlsInstance.startLevel < 0 || hlsInstance.startLevel > maxOk)) {
          hlsInstance.startLevel = maxOk;
        }
        if (typeof hlsInstance.loadLevel === "number" && hlsInstance.loadLevel > maxOk) {
          hlsInstance.loadLevel = maxOk;
        }
        if (typeof hlsInstance.nextLevel === "number" && hlsInstance.nextLevel > maxOk) {
          hlsInstance.nextLevel = maxOk;
        }
        try { console.info("[live] android ABR cap ≤" + ANDROID_LEVEL_CAP_HEIGHT + " level", maxOk, "/", levels.length - 1); } catch (e) {}
      } catch (e) {}
    }
    function syncLiveEmbedChrome() {
      const on = !!liveEmbedActive;
      if (liveEmbedGuideHotspot) {
        if (on) liveEmbedGuideHotspot.removeAttribute("hidden");
        else liveEmbedGuideHotspot.setAttribute("hidden", "");
      }
      if (trailerLayer) {
        if (on) trailerLayer.classList.add("live-embed-mode");
        else trailerLayer.classList.remove("live-embed-mode");
      }
      if (tvRoot) {
        if (on) tvRoot.classList.add("live-embed-active");
        else tvRoot.classList.remove("live-embed-active");
      }
    }
    function returnToLiveFromEmbed(reason) {
      if (!liveEmbedActive) return;
      try { console.info("[live] leave-embed:", reason || "back"); } catch (e) {}
      liveEmbedActive = false;
      livePaintEmbedUsed = false;
      paintDeadStreak = 0;
      paintDeadSince = 0;
      clearPaintWatch();
      try { if (window.SDEmbed && SDEmbed.stop) SDEmbed.stop(); } catch (e) {}
      try { if (trailerFrame) trailerFrame.src = ""; } catch (e) {}
      if (trailerLayer) {
        trailerLayer.classList.remove("show", "embed-mode", "live-embed-mode", "gate-open");
        trailerLayer.setAttribute("aria-hidden", "true");
      }
      trailerActive = false;
      if (tvRoot) tvRoot.classList.remove("trailer-active", "overlay-active", "live-embed-active");
      if (trailerBackBtn) trailerBackBtn.classList.remove("embed-sticky-back");
      syncLiveEmbedChrome();
      const base = currentStreamUrl || liveStreamUrl || ("/live/" + encodeURIComponent(channelId || "") + ".m3u8");
      const url = base + (String(base).includes("?") ? "&" : "?") + "r=" + Date.now() + "&from=embed";
      try {
        setBuffering(true, "Returning to live…", { soft: true, force: true, immediate: true });
      } catch (e) {}
      Promise.resolve(attachHls(url)).catch(() => {});
    }
    function liveRecoverOnCooldown() {
      return !!(lastLiveRecoverAt && (Date.now() - lastLiveRecoverAt) < LIVE_RECOVER_COOLDOWN_MS);
    }
    function paintGraceWatchActive() {
      // Sustained dead-paint observation window — do not remount/thrash while waiting.
      return !!(paintDeadSince && (Date.now() - paintDeadSince) < paintDeadGraceMs());
    }
    function markLiveRecoverAction() {
      lastLiveRecoverAt = Date.now();
      paintHealthySince = 0;
    }
    function markPaintUnhealthySample() {
      paintHealthySince = 0;
    }
    function clearLiveRecoveryBudgetsConfirmed() {
      reloadAttempts = 0;
      liveHardRemountUsed = false;
      livePaintRemountUsed = false;
      // livePaintEmbedUsed stays until a clean channel attach (no ?r=) or Back to live.
      paintDeadStreak = 0;
      clearLiveRecoverWatchdog();
    }
    function markPaintHealthySample() {
      const now = Date.now();
      if (!paintHealthySince) paintHealthySince = now;
      if ((now - paintHealthySince) >= PAINT_HEALTHY_CONFIRM_MS) {
        clearLiveRecoveryBudgetsConfirmed();
      }
    }
    function recoverDeadPaint(reason) {
      if (vodHlsActive || liveEmbedActive || switching) return;
      const url = currentStreamUrl || liveStreamUrl;
      if (!url || !isLiveStreamUrl(url)) return;
      const paintWatchFlip = (reason === "paint-watch");
      // Android embed-after-grace must not be blocked by an earlier soft-reload cooldown.
      const androidEmbedReady = (
        isAndroid &&
        currentLiveIsDaddyLive() &&
        !livePaintEmbedUsed &&
        paintEmbedFallbackEnabled()
      );
      if (liveRecoverOnCooldown() && !(paintWatchFlip && androidEmbedReady)) return;
      const deadFor = paintDeadSince ? (Date.now() - paintDeadSince) : 0;
      paintDeadStreak = 0;
      const since = paintDeadSince;
      paintDeadSince = 0;
      markLiveRecoverAction();
      try { console.info("[live] dead-paint:", reason || "", "android=", isAndroid, "deadForMs=", deadFor); } catch (e) {}
      setBuffering(true, "Reconnecting…", { soft: false, force: true, immediate: true });
      // Android: remount thrashing worsens Qualcomm ImageReader buffer starvation
      // (chromium image_reader_gl_owner "no buffers"). After sustained dead paint,
      // fall through to Clappr embed (same 1080p High TS paints correctly there).
      if (androidEmbedReady) {
        livePaintEmbedUsed = true;
        livePaintRemountUsed = true;
        logPaintDeadEvent("static", {
          reason: reason || "paint-watch",
          durationMs: deadFor,
          firstDeadAt: since || null,
          action: "embed"
        });
        try {
          Promise.resolve(playLiveEmbedFallback("android-dead-paint")).catch(() => {});
        } catch (e) {}
        return;
      }
      if (!livePaintRemountUsed) {
        livePaintRemountUsed = true;
        logPaintDeadEvent("static", {
          reason: reason || "paint-watch",
          durationMs: deadFor,
          firstDeadAt: since || null,
          action: "remount"
        });
        destroyHls();
        try {
          v.removeAttribute("src");
          v.load();
        } catch (e) {}
        setTimeout(() => {
          if (liveEmbedActive || vodHlsActive) return;
          attachHls(url + (url.includes("?") ? "&" : "?") + "r=" + Date.now() + "&paint=1");
        }, 400);
        return;
      }
      logPaintDeadEvent("static", {
        reason: reason || "paint-watch",
        durationMs: deadFor,
        firstDeadAt: since || null,
        action: "soft-retry"
      });
      showLiveSoftRetry(reason || "dead-paint");
    }
    function armPaintWatch() {
      if (paintWatchTimer) return;
      paintWatchTimer = setInterval(() => {
        if (vodHlsActive || liveEmbedActive || switching) return;
        if (!v || v.paused || v.ended) {
          paintDeadStreak = 0;
          paintDeadSince = 0;
          return;
        }
        if (!samplePaintLooksDead(true)) {
          // Self-corrected within the grace window → temporary glitch.
          if (paintDeadSince) {
            const durationMs = Date.now() - paintDeadSince;
            logPaintDeadEvent("temporary", {
              reason: "self-corrected",
              durationMs: durationMs,
              firstDeadAt: paintDeadSince,
              action: "none"
            });
          }
          paintDeadStreak = 0;
          paintDeadSince = 0;
          markPaintHealthySample();
          return;
        }
        markPaintUnhealthySample();
        const now = Date.now();
        if (!paintDeadSince) {
          paintDeadSince = now;
          paintDeadStreak = 1;
          logPaintDeadEvent("detect", {
            reason: "first-dead",
            durationMs: 0,
            firstDeadAt: paintDeadSince,
            action: "grace"
          });
        } else {
          paintDeadStreak += 1;
        }
        const grace = paintDeadGraceMs();
        // Only flip when paint death is sustained past the grace window.
        if ((now - paintDeadSince) >= grace) recoverDeadPaint("paint-watch");
      }, PAINT_DEAD_SAMPLE_MS);
    }
    function cancelBufferTimers() {
      if (bufferHideTimer) {
        clearTimeout(bufferHideTimer);
        bufferHideTimer = null;
      }
      if (bufferShowTimer) {
        clearTimeout(bufferShowTimer);
        bufferShowTimer = null;
      }
      if (bufferEscalateTimer) {
        clearTimeout(bufferEscalateTimer);
        bufferEscalateTimer = null;
      }
    }
    function clearBufferOverlay(opts) {
      opts = opts || {};
      cancelBufferTimers();
      bufferPending = null;
      const wasVisible = bufferVisible;
      bufferVisible = false;
      if (loadBar) loadBar.classList.remove("show");
      if (bufferOverlay) {
        bufferOverlay.classList.remove("show", "soft");
        bufferOverlay.setAttribute("aria-hidden", "true");
      }
      if (wasVisible && !opts.skipCooldown) {
        bufferCooldownUntil = Date.now() + BUFFER_RESHOW_COOLDOWN_MS;
      }
    }
    function applyBufferOverlay(text, soft) {
      if (tapPlay && tapPlay.classList.contains("show")) {
        clearBufferOverlay({ skipCooldown: true });
        return;
      }
      // Never stack a full-screen spinner on top of "Tap for sound".
      if (unmuteBtn && unmuteBtn.style.display === "block") soft = true;
      if (bufferHideTimer) {
        clearTimeout(bufferHideTimer);
        bufferHideTimer = null;
      }
      if (loadBar) loadBar.classList.toggle("show", !soft);
      if (bufferOverlay) {
        bufferOverlay.classList.add("show");
        bufferOverlay.classList.toggle("soft", !!soft);
        bufferOverlay.setAttribute("aria-hidden", "false");
      }
      if (bufferStatus && text) bufferStatus.textContent = text;
      bufferVisible = true;
      if (soft || playbackLooksHealthy()) {
        bufferHideTimer = setTimeout(() => {
          if (playbackLooksHealthy() || mediaPaintingOk()) clearBufferOverlay();
        }, soft ? 1800 : 500);
      }
    }
    function setBuffering(on, text, opts) {
      opts = opts || {};
      if (tapPlay && tapPlay.classList.contains("show")) {
        clearBufferOverlay({ skipCooldown: true });
        return;
      }
      if (!on) {
        clearBufferOverlay(opts);
        return;
      }

      const healthy = playbackLooksHealthy() || mediaPaintingOk();
      const label = String(text || "Buffering…");
      // Ignore brief HLS waiting/stalled hiccups while frames are fine.
      if (healthy && !opts.force && !opts.allowHealthyFull) {
        cancelBufferTimers();
        bufferPending = null;
        if (bufferVisible && bufferOverlay && bufferOverlay.classList.contains("soft")) {
          // Keep soft chip briefly; auto-hide handles it.
          return;
        }
        if (bufferVisible) clearBufferOverlay();
        return;
      }

      // Prefer soft for recovery / minor stalls; full only via escalate or forceFull.
      let wantSoft = !!opts.soft || !!opts.forceSoft || !opts.forceFull;
      if (opts.forceFull) wantSoft = false;
      if (unmuteBtn && unmuteBtn.style.display === "block") wantSoft = true;

      const now = Date.now();
      const inCooldown = now < bufferCooldownUntil;
      if (inCooldown && !opts.force && !opts.immediate && bufferVisible) {
        // Already showing during cooldown — refresh label only.
        if (bufferStatus && text) bufferStatus.textContent = label;
        return;
      }
      if (inCooldown && !opts.force && !opts.immediate) {
        // Schedule a single re-check after cooldown if still unhealthy.
        bufferPending = { text: label, soft: wantSoft, forceFull: !!opts.forceFull, start: opts.start };
        if (!bufferShowTimer) {
          bufferShowTimer = setTimeout(() => {
            bufferShowTimer = null;
            const p = bufferPending;
            bufferPending = null;
            if (!p) return;
            if (playbackLooksHealthy() || mediaPaintingOk()) return;
            setBuffering(true, p.text, {
              soft: p.soft,
              forceFull: p.forceFull,
              start: p.start,
              force: true,
            });
          }, Math.max(80, bufferCooldownUntil - Date.now()));
        }
        return;
      }

      const delay = opts.immediate
        ? 0
        : (opts.start ? BUFFER_START_DELAY_MS : BUFFER_SOFT_DELAY_MS);

      bufferPending = {
        text: label,
        soft: wantSoft,
        forceFull: !!opts.forceFull,
        start: !!opts.start,
        since: (bufferPending && bufferPending.since) || now,
      };

      if (delay === 0) {
        const p = bufferPending;
        bufferPending = null;
        cancelBufferTimers();
        applyBufferOverlay(p.text, p.soft);
        return;
      }

      if (bufferShowTimer) return; // already debouncing; pending text updated
      bufferShowTimer = setTimeout(() => {
        bufferShowTimer = null;
        const p = bufferPending;
        if (!p) return;
        if (playbackLooksHealthy() || mediaPaintingOk()) {
          bufferPending = null;
          return;
        }
        // Soft chip first for stalls; full-screen only if still broken after FULL delay.
        applyBufferOverlay(p.text, true);
        if (p.forceFull) {
          applyBufferOverlay(p.text, false);
          bufferPending = null;
          return;
        }
        const elapsed = Date.now() - (p.since || Date.now());
        const escalateIn = Math.max(120, BUFFER_FULL_DELAY_MS - Math.min(elapsed, BUFFER_FULL_DELAY_MS));
        bufferEscalateTimer = setTimeout(() => {
          bufferEscalateTimer = null;
          bufferPending = null;
          if (playbackLooksHealthy() || mediaPaintingOk()) {
            clearBufferOverlay();
            return;
          }
          // Still no healthy frames — escalate to full-screen.
          applyBufferOverlay(p.text || "Reconnecting…", false);
        }, escalateIn);
      }, delay);
    }
    function setLoading(on) {
      setBuffering(on, on ? "Loading…" : "", on ? { start: true } : {});
    }
    function noteUserGesture() {
      if (userGestureSeen) return;
      userGestureSeen = true;
      if (!v) return;
      if (!v.paused && v.muted && userUnmuted) {
        v.muted = false;
        if (unmuteBtn) unmuteBtn.style.display = "none";
      } else if (v.paused && currentStreamUrl) {
        tryPlay();
      }
    }
    ["pointerdown", "touchstart", "keydown"].forEach((ev) => {
      document.addEventListener(ev, noteUserGesture, { capture: true, passive: true });
    });

    function guideSheetEnabled() {
      // Match CSS: portrait phones OR short landscape phones (not desktop/tall tablets).
      try {
        return window.matchMedia("(orientation: portrait) and (max-width: 900px)").matches
          || window.matchMedia("(orientation: landscape) and (max-height: 560px)").matches;
      } catch (e) {
        const w = window.innerWidth || 0;
        const h = window.innerHeight || 0;
        return (h >= w && w <= 900) || (w > h && h <= 560);
      }
    }
    /** @deprecated use guideSheetEnabled — kept as alias for any external callers */
    function guideSheetPortrait() { return guideSheetEnabled(); }
    function guideSheetSnapVh(name) {
      const landscapePhone = (() => {
        try {
          return window.matchMedia("(orientation: landscape) and (max-height: 560px)").matches;
        } catch (e) {
          return (window.innerWidth || 0) > (window.innerHeight || 0)
            && (window.innerHeight || 0) <= 560;
        }
      })();
      if (landscapePhone) {
        const land = { peek: 30, mid: 42, expanded: 55 };
        return land[name] || land.mid;
      }
      return GUIDE_SHEET_VH[name] || GUIDE_SHEET_VH.mid;
    }
    function guideVideoMinVh() {
      try {
        if (window.matchMedia("(orientation: landscape) and (max-height: 560px)").matches) return 28;
      } catch (e) {}
      return GUIDE_VIDEO_MIN_VH;
    }
    function loadGuideSheetSnap() {
      try {
        const raw = localStorage.getItem(LS_GUIDE_SHEET);
        if (GUIDE_SHEET_SNAPS.includes(raw)) return raw;
      } catch (e) {}
      return "mid";
    }
    function saveGuideSheetSnap(snap) {
      if (!GUIDE_SHEET_SNAPS.includes(snap)) return;
      guideSheetSnap = snap;
      try { localStorage.setItem(LS_GUIDE_SHEET, snap); } catch (e) {}
    }
    function maxGuideSheetVh() {
      return Math.max(guideSheetSnapVh("peek"), 100 - guideVideoMinVh());
    }
    function clampGuideSheetVh(vh, opts) {
      opts = opts || {};
      const maxVh = maxGuideSheetVh();
      // During drag, allow below peek so a full pull-down can hit immersive collapse.
      const minVh = opts.allowCollapse ? 0 : guideSheetSnapVh("peek");
      return Math.max(minVh, Math.min(maxVh, vh));
    }
    function applyGuideSheetSnap(snap, opts) {
      opts = opts || {};
      if (!GUIDE_SHEET_SNAPS.includes(snap)) snap = "mid";
      guideSheetSnap = snap;
      if (!opts.skipSave) saveGuideSheetSnap(snap);
      if (!tvRoot) return;
      tvRoot.dataset.guideSnap = snap;
      const vh = clampGuideSheetVh(guideSheetSnapVh(snap));
      if (guideSheetEnabled() && !guideCollapsed) {
        tvRoot.style.setProperty("--guide-sheet-h", vh + "vh");
      } else {
        tvRoot.style.removeProperty("--guide-sheet-h");
      }
      if (guideSheetHandle) {
        const idx = GUIDE_SHEET_SNAPS.indexOf(snap);
        guideSheetHandle.setAttribute("aria-valuenow", String(Math.max(0, idx)));
      }
    }
    function nearestGuideSnap(vh) {
      let best = "mid";
      let bestDist = Infinity;
      GUIDE_SHEET_SNAPS.forEach((name) => {
        const target = clampGuideSheetVh(guideSheetSnapVh(name));
        const dist = Math.abs(target - vh);
        if (dist < bestDist) {
          bestDist = dist;
          best = name;
        }
      });
      return best;
    }
    function wireGuideSheetDrag() {
      if (!guideSheetHandle || !epgPanel || !tvRoot) return;
      let startY = 0;
      let startVh = GUIDE_SHEET_VH.mid;
      let active = false;
      const onMove = (e) => {
        if (!active || guideCollapsed) return;
        const y = e.clientY;
        if (typeof y !== "number") return;
        const dy = startY - y;
        const deltaVh = (dy / Math.max(1, window.innerHeight)) * 100;
        const next = clampGuideSheetVh(startVh + deltaVh, { allowCollapse: true });
        tvRoot.style.setProperty("--guide-sheet-h", next + "vh");
        if (next < guideSheetSnapVh("peek") - 4) {
          tvRoot.dataset.guideSnap = "peek";
        } else {
          tvRoot.dataset.guideSnap = nearestGuideSnap(next);
        }
      };
      const onUp = (e) => {
        if (!active) return;
        active = false;
        guideSheetDragging = false;
        tvRoot.classList.remove("guide-sheet-dragging");
        try { guideSheetHandle.releasePointerCapture(e.pointerId); } catch (err) {}
        guideSheetHandle.removeEventListener("pointermove", onMove);
        guideSheetHandle.removeEventListener("pointerup", onUp);
        guideSheetHandle.removeEventListener("pointercancel", onUp);
        if (guideCollapsed) return;
        const cur = parseFloat(getComputedStyle(tvRoot).getPropertyValue("--guide-sheet-h")) || startVh;
        const collapseThreshold = guideSheetSnapVh("peek") - 8;
        if (cur < collapseThreshold) {
          applyGuideState(true);
          return;
        }
        applyGuideSheetSnap(nearestGuideSnap(cur));
      };
      guideSheetHandle.addEventListener("pointerdown", (e) => {
        if (!guideSheetEnabled() || guideCollapsed) return;
        if (e.button != null && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        active = true;
        guideSheetDragging = true;
        tvRoot.classList.add("guide-sheet-dragging");
        startY = e.clientY;
        const parsed = parseFloat(getComputedStyle(tvRoot).getPropertyValue("--guide-sheet-h"));
        startVh = Number.isFinite(parsed) ? parsed : guideSheetSnapVh(guideSheetSnap);
        try { guideSheetHandle.setPointerCapture(e.pointerId); } catch (err) {}
        guideSheetHandle.addEventListener("pointermove", onMove);
        guideSheetHandle.addEventListener("pointerup", onUp);
        guideSheetHandle.addEventListener("pointercancel", onUp);
      });
      guideSheetHandle.addEventListener("keydown", (e) => {
        if (!guideSheetEnabled() || guideCollapsed) return;
        const idx = GUIDE_SHEET_SNAPS.indexOf(guideSheetSnap);
        if (e.key === "ArrowUp") {
          e.preventDefault();
          applyGuideSheetSnap(GUIDE_SHEET_SNAPS[Math.min(GUIDE_SHEET_SNAPS.length - 1, idx + 1)]);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          if (idx <= 0) applyGuideState(true);
          else applyGuideSheetSnap(GUIDE_SHEET_SNAPS[idx - 1]);
        }
      });
      const syncSheet = () => {
        if (guideCollapsed) {
          tvRoot.style.removeProperty("--guide-sheet-h");
          return;
        }
        applyGuideSheetSnap(guideSheetSnap, { skipSave: true });
      };
      window.addEventListener("orientationchange", () => setTimeout(syncSheet, 80));
      window.addEventListener("resize", () => {
        if (!guideSheetDragging) syncSheet();
      });
      guideSheetSnap = loadGuideSheetSnap();
      applyGuideSheetSnap(guideSheetSnap, { skipSave: true });
    }

    function setCollapsedChromeVisible(visible) {
      if (!guideCollapsed) return;
      collapsedChromeVisible = visible;
      const hiddenClass = "chrome-hidden";
      collapsedChrome.classList.toggle(hiddenClass, !visible);
      showGuideBtn.classList.toggle(hiddenClass, !visible);
      collapsedChrome.setAttribute("aria-hidden", String(!visible));
    }

    function clearChromeHideTimer() {
      if (chromeHideTimer) {
        clearTimeout(chromeHideTimer);
        chromeHideTimer = null;
      }
    }

    function scheduleChromeHide() {
      clearChromeHideTimer();
      if (!guideCollapsed) return;
      if (document.getElementById("partyDrawer")?.classList.contains("open")) return;
      if (document.getElementById("sdPartyModal")?.classList.contains("open")) return;
      chromeHideTimer = setTimeout(() => setCollapsedChromeVisible(false), CHROME_HIDE_MS);
    }

    function revealCollapsedChrome(autoHide) {
      if (!guideCollapsed) return;
      setCollapsedChromeVisible(true);
      if (autoHide !== false) scheduleChromeHide();
    }

    function applyGuideState(collapsed, opts) {
      opts = opts || {};
      guideCollapsed = collapsed;
      tvRoot.classList.toggle("guide-collapsed", collapsed);
      guideToggle.setAttribute("aria-expanded", String(!collapsed));
      guideToggle.setAttribute("aria-label", collapsed ? "Show guide" : "Hide TV guide");
      guideToggle.setAttribute("title", collapsed ? "Show guide" : "Collapse guide");
      const label = guideToggle.querySelector(".toggle-label");
      const chev = guideToggle.querySelector(".chev");
      if (label) label.textContent = collapsed ? "Guide" : "Hide";
      if (chev) chev.textContent = collapsed ? "▲" : "▼";
      try { localStorage.setItem(LS_GUIDE, collapsed ? "1" : "0"); } catch (e) {}
      clearChromeHideTimer();
      if (collapsed) {
        tvRoot.style.removeProperty("--guide-sheet-h");
        revealCollapsedChrome(true);
        maybeShowGuideFirstRunHint();
        hideCinemaInfoOverlay();
        try {
          if (window.SDMobile && SDMobile.enterImmersive) SDMobile.enterImmersive(videoArea || document.documentElement);
        } catch (e) {}
        // Keep history depth; do not history.back() into /auth.
        if (!opts.fromPopstate) {
          guideHistoryPushed = true;
          tvBackArmedAt = Date.now();
        } else {
          guideHistoryPushed = false;
        }
      } else {
        setCollapsedChromeVisible(false);
        showGuideBtn.classList.remove("chrome-hidden");
        applyGuideSheetSnap(guideSheetSnap || loadGuideSheetSnap(), { skipSave: true });
        try {
          if (window.SDMobile && SDMobile.exitImmersive) SDMobile.exitImmersive();
        } catch (e) {}
        if (!opts.fromPopstate) ensureTvHistoryGuard();
        if (guideFollowNow) scrollGuideToNow();
        showCinemaInfoOverlay({ force: true, autoHide: true });
      }
      closeGuideMoreMenu();
    }
    function maybeShowGuideFirstRunHint() {
      if (!showGuideBtn) return;
      try {
        if (localStorage.getItem("sd_guide_hint_seen") === "1") return;
        localStorage.setItem("sd_guide_hint_seen", "1");
      } catch (e) {}
      const hint = document.getElementById("showGuideHint");
      if (hint) hint.hidden = false;
      showGuideBtn.classList.add("guide-hint-pulse");
      setTimeout(() => {
        showGuideBtn.classList.remove("guide-hint-pulse");
        if (hint) hint.hidden = true;
      }, 2800);
    }
    function toggleGuide() { applyGuideState(!guideCollapsed); }
    guideToggle.addEventListener("click", (e) => { e.stopPropagation(); toggleGuide(); });
    showGuideBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      clearChromeHideTimer();
      applyGuideState(false);
    });

    function closeGuideMoreMenu() {
      if (guideMoreMenu) guideMoreMenu.hidden = true;
      if (guideMoreBtn) guideMoreBtn.setAttribute("aria-expanded", "false");
    }
    function openGuideMoreMenu() {
      if (!guideMoreMenu) return;
      guideMoreMenu.hidden = false;
      if (guideMoreBtn) guideMoreBtn.setAttribute("aria-expanded", "true");
    }
    function toggleGuideMoreMenu() {
      if (!guideMoreMenu) return;
      if (guideMoreMenu.hidden) openGuideMoreMenu();
      else closeGuideMoreMenu();
    }
    function runGuideMoreAction(action) {
      closeGuideMoreMenu();
      if (action === "share") {
        try { if (window.SDParty && SDParty.openShare) SDParty.openShare(); } catch (e) {}
        return;
      }
      if (action === "settings") { openSettingsDrawer(); return; }
      if (action === "party") {
        try { if (window.SDParty && SDParty.openHome) SDParty.openHome(); } catch (e) {}
        return;
      }
      if (action === "simple") {
        const href = simpleLink && simpleLink.getAttribute("href");
        if (href && href !== "#") location.href = href;
        else if (channelId) location.href = "/play/" + encodeURIComponent(channelId);
        return;
      }
      if (action === "collapse") { applyGuideState(true); return; }
      if (action === "theme") {
        const idx = THEMES.indexOf(currentTheme);
        applyTheme(THEMES[(idx + 1) % THEMES.length]);
        return;
      }
      if (action === "cinema") { applyTheme("cinema"); return; }
      if (action === "search") { openSearchDrawer(); return; }
      if (action === "cast") {
        try {
          if (window.SDCast && typeof SDCast.prompt === "function") SDCast.prompt();
          else showErr("Cast loading — try again");
        } catch (e) {
          showErr("Cast unavailable");
        }
        return;
      }
      if (action === "report") {
        try { if (window.SDReport && SDReport.open) SDReport.open(); } catch (e) {}
        return;
      }
    }
    if (guideMoreBtn) {
      guideMoreBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleGuideMoreMenu();
      });
    }
    const castBtn = document.getElementById("castBtn");
    if (castBtn && !castBtn.dataset.wiredApp) {
      castBtn.dataset.wiredApp = "1";
      castBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        try {
          if (window.SDCast && typeof SDCast.prompt === "function") SDCast.prompt();
          else showErr("Cast loading — try again");
        } catch (err) {
          showErr("Cast unavailable");
        }
      });
    }
    if (guideMoreMenu) {
      guideMoreMenu.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-guide-action]");
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        runGuideMoreAction(btn.getAttribute("data-guide-action"));
      });
    }
    document.addEventListener("click", (e) => {
      if (!guideMoreMenu || guideMoreMenu.hidden) return;
      if (e.target.closest("#guideMoreBtn, #guideMoreMenu, #liveShareBtn, #liveMoreMenu")) return;
      closeGuideMoreMenu();
    });
    function ensureTvHistoryGuard() {
      try {
        history.pushState({ sdTvGuard: 1, sdGuideOpen: guideCollapsed ? 0 : 1, t: Date.now() }, "", location.href);
        guideHistoryPushed = true;
      } catch (e) {}
    }

    window.addEventListener("popstate", () => {
      if (guideHistorySilent) {
        guideHistorySilent = false;
        return;
      }
      const pathNow = (location.pathname || "").replace(/\/$/, "") || "/";
      // /vod gapless stack is owned by the VOD popstate handler — do not fight it.
      if (pathNow.startsWith("/vod")) return;
      // Prefer in-page overlays over leaving /tv (live / xray play on /tv only).
      if (trailerActive || (trailerLayer && trailerLayer.classList.contains("show")) || vodHlsActive) {
        stopOverlayPlayback();
        ensureTvHistoryGuard();
        return;
      }
      if (window.SDPinUnlock && SDPinUnlock.isOpen && SDPinUnlock.isOpen()) {
        try { SDPinUnlock.close(); } catch (e) {}
        ensureTvHistoryGuard();
        return;
      }
      try {
        const partyHome = document.getElementById("partyHome");
        if (partyHome && partyHome.classList.contains("open")) {
          if (window.SDParty && typeof window.SDParty.closeHome === "function") {
            window.SDParty.closeHome(true);
          }
          ensureTvHistoryGuard();
          return;
        }
      } catch (e) {}
      if (vodCatalogOpen) {
        if ((vodDetail && vodDetail.classList.contains("show")) || !vodAtBrowseRoot()) {
          // Keep URL in sync via VOD handler; re-arm TV guard if still on /tv.
        } else {
          closeVodCatalogUI();
        }
      }
      const path = pathNow;
      const onTv = path === "/tv" || path.startsWith("/tv/");
      if (!onTv) return;
      // Expanded guide: first BACK collapses and re-arms.
      if (!guideCollapsed) {
        applyGuideState(true, { fromPopstate: true });
        ensureTvHistoryGuard();
        tvBackArmedAt = Date.now();
        return;
      }
      // Collapsed: require a second BACK within 1.6s to actually leave.
      const now = Date.now();
      if (!tvBackArmedAt || now - tvBackArmedAt > 1600) {
        tvBackArmedAt = now;
        ensureTvHistoryGuard();
        revealCollapsedChrome(true);
        try { showErr("Press Back again to leave"); } catch (e) {}
        return;
      }
      guideHistoryPushed = false;
      tvBackArmedAt = 0;
    });

    let lastGuideVideoTapAt = 0;
    function onCollapsedVideoInteract(e) {
      if (trailerActive || (trailerLayer && trailerLayer.classList.contains("show"))) return;
      // PiP / buffer chrome / controls are not guide toggles.
      try {
        if (document.pictureInPictureElement) return;
        if (v && typeof v.webkitPresentationMode === "string" && v.webkitPresentationMode === "picture-in-picture") return;
      } catch (err) {}
      if (bufferOverlay && bufferOverlay.classList.contains("show") && !bufferOverlay.classList.contains("soft")) return;
      // Ignore real controls / chrome buttons; empty video surface is the hotspot.
      if (
        e.target.closest(
          "#showGuideBtn, #guideToggle, #tapPlay, #unmuteBtn, #searchBtnChrome, #trailerBackBtn, #vodStartGate, #vodEpChrome, #vodEpHotzone, #nowOnAir, #hdrPoster, #chromePoster, #cinemaPosterLg, #xrayBtn, #xrayPanel, #collapsedChrome, .collapsed-chrome, .party-drawer, .party-fab, #partyFab, #partyAvOverlay, .party-av-overlay, .party-live-overlay, .party-live-badge, .sd-modal, .sd-modal-backdrop, button, a, input, select, textarea, [role='button']"
        )
      )
        return;
      // Debounce accidental double-taps (Android often fires click twice).
      const now = Date.now();
      if (now - lastGuideVideoTapAt < 320) return;
      lastGuideVideoTapAt = now;

      // Center-ish only when guide is collapsed (edges remain channel zap).
      if (guideCollapsed && videoArea) {
        try {
          const rect = videoArea.getBoundingClientRect();
          const relX = (e.clientX - rect.left) / Math.max(1, rect.width);
          const relY = (e.clientY - rect.top) / Math.max(1, rect.height);
          if (relX < 0.14 || relX > 0.86 || relY < 0.12 || relY > 0.88) return;
        } catch (err) {}
      }

      hideCinemaInfoOverlay();
      // Guide visible (peek/mid/expanded) → immersive / hide guide.
      if (!guideCollapsed) {
        applyGuideState(true);
        return;
      }
      // Guide hidden / immersive → restore previous peek/mid/expanded snap.
      applyGuideState(false);
    }
    videoArea.addEventListener("click", onCollapsedVideoInteract);
    videoArea.addEventListener("mousemove", (e) => {
      if (!guideCollapsed) return;
      if (
        e.target.closest(
          ".party-drawer, .party-fab, #partyFab, #partyAvOverlay, .party-av-overlay, .sd-modal"
        )
      )
        return;
      revealCollapsedChrome(true);
    });

    /* Live hotzones when guide collapsed: edge L/R = channel±; hold edge = rapid zap */
    (function wireLiveEdgeZap() {
      if (!videoArea || videoArea.dataset.liveEdgeZap === "1") return;
      videoArea.dataset.liveEdgeZap = "1";
      let holdTimer = null;
      let zapTimer = null;
      let zapDir = 0;
      function clearZap() {
        clearTimeout(holdTimer);
        clearInterval(zapTimer);
        holdTimer = null;
        zapTimer = null;
        zapDir = 0;
        videoArea.classList.remove("pc-hold-active");
      }
      function step(dir) {
        if (!orderIds.length) return;
        const next = Math.max(0, Math.min(orderIds.length - 1, focusIdx + dir));
        if (next === focusIdx) return;
        focusIdx = next;
        switchChannel(orderIds[focusIdx]);
      }
      videoArea.addEventListener("pointerdown", (e) => {
        if (!guideCollapsed || trailerActive) return;
        if (e.target.closest("button, input, a, .party-drawer, .party-fab, #partyFab, #partyAvOverlay, .sd-modal")) return;
        const rect = videoArea.getBoundingClientRect();
        const relX = (e.clientX - rect.left) / Math.max(1, rect.width);
        const relY = (e.clientY - rect.top) / Math.max(1, rect.height);
        if (relY < 0.15 || relY > 0.85) return;
        let dir = 0;
        if (relX < 0.12) dir = -1;
        else if (relX > 0.88) dir = 1;
        if (!dir) return;
        zapDir = dir;
        holdTimer = setTimeout(() => {
          videoArea.classList.add("pc-hold-active");
          step(zapDir);
          zapTimer = setInterval(() => step(zapDir), 380);
        }, 420);
      });
      videoArea.addEventListener("pointerup", clearZap);
      videoArea.addEventListener("pointercancel", clearZap);
      videoArea.addEventListener("pointerleave", clearZap);
    })();

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) clearChromeHideTimer();
      else if (guideCollapsed) revealCollapsedChrome(true);
    });

    try {
      // Anchor /tv as replaceState so UI-collapse history.back() does not revive /auth.
      try {
        history.replaceState({ sdTv: 1 }, "", location.href);
      } catch (e) {}
      const savedGuide = localStorage.getItem(LS_GUIDE);
      if (savedGuide === "1") applyGuideState(true, { fromPopstate: true });
      else if (savedGuide === "0") applyGuideState(false, { fromPopstate: true });
      else if (guideDefaultCollapsed()) applyGuideState(true, { fromPopstate: true });
      else applyGuideState(false, { fromPopstate: true }); // first visit → expanded
      if (!guideCollapsed) ensureTvHistoryGuard();
      else {
        // Collapsed boot still needs one in-app BACK before leaving.
        ensureTvHistoryGuard();
      }
    } catch (e) {
      applyGuideState(false, { fromPopstate: true });
    }

    wireLiveBufferEvents();
    wireGuideSheetDrag();

    function readJson(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
      catch (e) { return fallback; }
    }
    function getFavorites() { return readJson(LS_FAV, []); }
    function getRecents() { return readJson(LS_RECENT, []); }

    /** Ensure favorites persist key exists (gapless favorites filter depends on it). */
    function ensureFavoritesStorage() {
      try {
        if (localStorage.getItem(LS_FAV) == null) {
          localStorage.setItem(LS_FAV, "[]");
        }
      } catch (e) {}
      return getFavorites();
    }

    function ensureRecentsStorage() {
      try {
        if (localStorage.getItem(LS_RECENT) == null) {
          localStorage.setItem(LS_RECENT, "[]");
        }
      } catch (e) {}
      return getRecents();
    }

    function loadGuideCategoryKey() {
      try {
        const raw = localStorage.getItem(LS_GUIDE_CATEGORY);
        if (raw && typeof raw === "string") return migrateGuideCategoryKey(raw);
      } catch (e) {}
      return "all";
    }

    function saveGuideCategoryKey(key) {
      guideCategoryKey = migrateGuideCategoryKey(key || "all");
      try { localStorage.setItem(LS_GUIDE_CATEGORY, guideCategoryKey); } catch (e) {}
    }

    function facetLabel(facet, id) {
      const bucket = FACET_LABELS[facet] || {};
      if (bucket[id]) return bucket[id];
      return String(id || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || id;
    }

    function migrateGuideCategoryKey(key) {
      const k = String(key || "all").trim() || "all";
      if (k === "all" || k === "favorites" || k === "recent") return k;
      if (/^(genre|distributor|country|language):/.test(k)) return k;
      if (k.indexOf("tag:") === 0) {
        const tag = k.slice(4).toLowerCase();
        const g = LEGACY_TAG_TO_GENRE[tag] || LEGACY_TAG_TO_GENRE["#" + tag.replace(/^#/, "")];
        if (g) return "genre:" + g;
        return "all";
      }
      if (k.indexOf("group:") === 0) {
        const raw = k.slice(6).trim();
        const low = raw.toLowerCase();
        if (/dulo/.test(low)) return "distributor:dulo";
        if (/free-?tv/.test(low)) return "distributor:freetv";
        if (/adult\s*swim|entertainment/.test(low) && !/iptv-org/.test(low)) {
          if (/entertainment/.test(low)) return "genre:entertainment";
        }
        let stem = low;
        if (stem.indexOf("|") >= 0) stem = stem.split("|").pop().trim();
        stem = stem.replace(/^iptv-org\s*/i, "").replace(/_/g, " ").trim();
        const parts = stem.split(/[\s_]+/).filter(Boolean);
        const platforms = ["pluto","samsung","tubi","xumo","roku","plex","stirr","rakuten","firetv","bbc","sofast","tcl","vizio"];
        for (let i = parts.length - 1; i >= 0; i--) {
          if (platforms.indexOf(parts[i]) >= 0) return "distributor:" + parts[i];
        }
        const countries = { us: "US", usa: "US", uk: "UK", gb: "UK", ca: "CA", au: "AU" };
        for (const p of parts) {
          if (countries[p]) return "country:" + countries[p];
        }
        if (countries[low]) return "country:" + countries[low];
        if (low === "usa" || low === "us") return "country:US";
        if (low === "uk" || low === "gb") return "country:UK";
        const genreHit = LEGACY_TAG_TO_GENRE["#" + low] || LEGACY_TAG_TO_GENRE[low];
        if (genreHit) return "genre:" + genreHit;
        return "all";
      }
      return "all";
    }

    function formatCatGroupLabel(gt) {
      return String(gt || "")
        .replace(/^iptv-org\s*\|\s*/i, "")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim() || "Uncategorized";
    }

    function formatCatTagLabel(tag) {
      const t = String(tag || "").replace(/^#/, "");
      if (!t) return "Tag";
      return t.charAt(0).toUpperCase() + t.slice(1);
    }

    function gaplessIdsFromList(items) {
      const seen = new Set();
      const out = [];
      for (const item of items || []) {
        const id = String(item && item.id != null ? item.id : item || "");
        if (!id || seen.has(id) || !channelMap[id]) continue;
        seen.add(id);
        out.push(id);
      }
      return out;
    }

    function channelMatchesFacet(ch, facet, value) {
      if (!ch || !value) return false;
      if (facet === "genre") {
        if (String(ch.genre || "") === value) return true;
        const gens = ch.genres || [];
        return gens.some((g) => String(g) === value);
      }
      if (facet === "distributor") return String(ch.distributor || "") === value;
      if (facet === "country") return String(ch.country || "") === value;
      if (facet === "language") return String(ch.language || "") === value;
      return false;
    }

    function idsForGuideCategory(key) {
      const k = migrateGuideCategoryKey(key || "all");
      if (k === "all") return allOrderIds.slice();
      if (k === "favorites") {
        return gaplessIdsFromList(ensureFavoritesStorage());
      }
      if (k === "recent") {
        return gaplessIdsFromList(ensureRecentsStorage());
      }
      const colon = k.indexOf(":");
      if (colon > 0) {
        const facet = k.slice(0, colon);
        const value = k.slice(colon + 1);
        if (facet === "genre" || facet === "distributor" || facet === "country" || facet === "language") {
          return allOrderIds.filter((id) => channelMatchesFacet(channelMap[id], facet, value));
        }
      }
      // Legacy fallbacks if migration missed
      if (k.indexOf("group:") === 0) {
        const g = k.slice(6);
        return allOrderIds.filter((id) => String((channelMap[id] && channelMap[id].group_title) || "") === g);
      }
      if (k.indexOf("tag:") === 0) {
        const tag = k.slice(4).toLowerCase();
        return allOrderIds.filter((id) => {
          const tags = (channelMap[id] && channelMap[id].tags) || [];
          return tags.some((t) => String(t).toLowerCase() === tag);
        });
      }
      return allOrderIds.slice();
    }

    function collectGuideCategorySections() {
      const genreCounts = new Map();
      const distCounts = new Map();
      const countryCounts = new Map();
      const langCounts = new Map();
      for (const id of allOrderIds) {
        const ch = channelMap[id];
        if (!ch) continue;
        const genre = String(ch.genre || "").trim();
        if (genre) genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
        const dist = String(ch.distributor || "").trim();
        if (dist) distCounts.set(dist, (distCounts.get(dist) || 0) + 1);
        const country = String(ch.country || "").trim();
        if (country) countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
        const lang = String(ch.language || "").trim();
        if (lang) langCounts.set(lang, (langCounts.get(lang) || 0) + 1);
      }
      const sortRows = (map, facet) => {
        const rows = [];
        for (const [id, count] of map.entries()) {
          rows.push({
            key: facet + ":" + id,
            label: facetLabel(facet, id),
            count: count,
            facet: facet,
          });
        }
        rows.sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
        return rows;
      };
      return [
        { id: "genres", title: "Genres", rows: sortRows(genreCounts, "genre") },
        { id: "distributors", title: "Distributors", rows: sortRows(distCounts, "distributor") },
        { id: "countries", title: "Countries", rows: sortRows(countryCounts, "country") },
        { id: "languages", title: "Languages", rows: sortRows(langCounts, "language") },
      ].filter((sec) => sec.rows.length > 0);
    }

    function collectGuideCategories() {
      // Flat list kept for callers; drawer prefers collectGuideCategorySections.
      const out = [];
      for (const sec of collectGuideCategorySections()) {
        for (const row of sec.rows) out.push(row);
      }
      return out;
    }

    function applyGuideCategory(key, opts) {
      opts = opts || {};
      const nextKey = migrateGuideCategoryKey(key || "all");
      const prevId = String(channelId || (orderIds[focusIdx] || "") || "");
      saveGuideCategoryKey(nextKey);
      orderIds = idsForGuideCategory(nextKey);
      let idx = prevId ? orderIds.indexOf(prevId) : -1;
      if (idx < 0) idx = orderIds.length ? 0 : -1;
      focusIdx = Math.max(0, idx);
      viewStart = 0;
      if (opts.render !== false) {
        renderGrid({ scrollToFocus: true, scrollToNow: !!opts.scrollToNow });
        prefetchEpgWindow();
      }
      if (opts.renderList !== false) renderCatDrawerList();
      return orderIds.length;
    }

    function setCatDrawerOpen(open, opts) {
      opts = opts || {};
      catDrawerOpen = !!open;
      if (catDrawerOpen) renderCatDrawerList();
      if (epgBody) epgBody.classList.toggle("cat-drawer-open", catDrawerOpen);
      if (catDrawer) {
        catDrawer.classList.toggle("open", catDrawerOpen);
        catDrawer.setAttribute("aria-hidden", catDrawerOpen ? "false" : "true");
        if (!opts.keepTransform) {
          catDrawer.classList.remove("dragging");
          catDrawer.style.transform = "";
        }
      }
      if (catDrawerScrim) {
        catDrawerScrim.hidden = !catDrawerOpen;
        catDrawerScrim.setAttribute("aria-hidden", catDrawerOpen ? "false" : "true");
      }
    }

    function setCatDrawerPull(px) {
      if (!catDrawer) return;
      const w = CAT_DRAWER_W;
      const openPx = catDrawerOpen ? w : 0;
      const next = Math.max(0, Math.min(w, openPx + px));
      const x = next - w;
      catDrawer.classList.add("dragging");
      catDrawer.style.transform = "translate3d(" + x + "px,0,0)";
      catDrawer.style.pointerEvents = next > 8 ? "auto" : "none";
      if (catDrawerScrim) {
        const frac = next / w;
        catDrawerScrim.hidden = frac < 0.02;
        catDrawerScrim.style.opacity = String(Math.min(1, frac));
        catDrawerScrim.style.pointerEvents = frac > 0.15 ? "auto" : "none";
      }
      return next / w;
    }

    function settleCatDrawerPull(frac) {
      if (!catDrawer) return;
      const shouldOpen = frac >= CAT_OPEN_THRESHOLD;
      catDrawer.classList.remove("dragging");
      catDrawer.style.transform = "";
      catDrawer.style.pointerEvents = "";
      if (catDrawerScrim) {
        catDrawerScrim.style.opacity = "";
        catDrawerScrim.style.pointerEvents = "";
      }
      setCatDrawerOpen(shouldOpen);
    }

    function renderCatDrawerList() {
      if (!catDrawerList) return;
      ensureFavoritesStorage();
      ensureRecentsStorage();
      const favCount = gaplessIdsFromList(getFavorites()).length;
      const recentCount = gaplessIdsFromList(getRecents()).length;
      const pinned = [
        { key: "all", label: "All", count: allOrderIds.length },
        { key: "favorites", label: "Favorites", count: favCount },
        { key: "recent", label: "Recent", count: recentCount },
      ];
      const sections = collectGuideCategorySections();
      catDrawerList.innerHTML = "";
      const appendItem = (row) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cat-drawer-item" + (row.key === guideCategoryKey ? " active" : "");
        btn.setAttribute("role", "option");
        btn.setAttribute("aria-selected", row.key === guideCategoryKey ? "true" : "false");
        btn.dataset.catKey = row.key;
        btn.innerHTML = '<span class="cat-label"></span><span class="cat-count"></span>';
        btn.querySelector(".cat-label").textContent = row.label;
        btn.querySelector(".cat-count").textContent = String(row.count);
        btn.addEventListener("click", () => {
          applyGuideCategory(row.key, { scrollToNow: true });
          setCatDrawerOpen(false);
        });
        catDrawerList.appendChild(btn);
      };
      for (const row of pinned) appendItem(row);
      for (const sec of sections) {
        const head = document.createElement("div");
        head.className = "cat-drawer-section";
        head.textContent = sec.title;
        head.setAttribute("role", "presentation");
        catDrawerList.appendChild(head);
        for (const row of sec.rows) appendItem(row);
      }
    }

    function wireCatDrawer() {
      if (!catDrawer || !chScroll || catDrawer.dataset.wired === "1") return;
      catDrawer.dataset.wired = "1";
      guideCategoryKey = loadGuideCategoryKey();
      if (catDrawerScrim) {
        catDrawerScrim.addEventListener("click", () => setCatDrawerOpen(false));
      }
      // Swipe drawer closed (right → left) on the drawer panel itself.
      let dPtr = null;
      let dStartX = 0;
      let dStartY = 0;
      let dMode = "";
      catDrawer.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        if (!catDrawerOpen) return;
        if (e.target && e.target.closest && e.target.closest(".cat-drawer-item")) return;
        dPtr = e.pointerId;
        dStartX = e.clientX;
        dStartY = e.clientY;
        dMode = "";
        try { catDrawer.setPointerCapture(e.pointerId); } catch (err) {}
      });
      catDrawer.addEventListener("pointermove", (e) => {
        if (dPtr == null || e.pointerId !== dPtr) return;
        const dx = e.clientX - dStartX;
        const dy = e.clientY - dStartY;
        if (!dMode) {
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
          dMode = Math.abs(dx) > Math.abs(dy) * 1.15 ? "h" : "v";
          if (dMode !== "h") {
            dPtr = null;
            try { catDrawer.releasePointerCapture(e.pointerId); } catch (err) {}
            return;
          }
        }
        if (dMode === "h") {
          e.preventDefault();
          setCatDrawerPull(dx);
        }
      });
      const endDrawerPtr = (e) => {
        if (dPtr == null || (e && e.pointerId !== dPtr)) return;
        const dx = e ? (e.clientX - dStartX) : 0;
        if (dMode === "h") {
          const openPx = CAT_DRAWER_W;
          const next = Math.max(0, Math.min(CAT_DRAWER_W, openPx + dx));
          settleCatDrawerPull(next / CAT_DRAWER_W);
        }
        dPtr = null;
        dMode = "";
        try { catDrawer.releasePointerCapture(e.pointerId); } catch (err) {}
      };
      catDrawer.addEventListener("pointerup", endDrawerPtr);
      catDrawer.addEventListener("pointercancel", endDrawerPtr);
      setCatDrawerOpen(false);
      renderCatDrawerList();
    }

    function getSearchRecents() { return readJson(LS_SEARCH_RECENT, []); }

    function pushSearchRecent(q) {
      const term = (q || "").trim();
      if (!term) return;
      let list = getSearchRecents().filter(x => x.toLowerCase() !== term.toLowerCase());
      list.unshift(term);
      try { localStorage.setItem(LS_SEARCH_RECENT, JSON.stringify(list.slice(0, 8))); } catch (e) {}
    }

    function renderSearchRecentTags() {
      if (!searchRecentTags) return;
      const items = getSearchRecents();
      searchRecentTags.innerHTML = "";
      if (!items.length) {
        searchRecentTags.innerHTML = '<div class="search-empty" style="padding:0 0 8px">Your recent searches appear here</div>';
        return;
      }
      for (const term of items) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = term;
        btn.addEventListener("click", () => {
          searchInput.value = term;
          runSearch();
        });
        searchRecentTags.appendChild(btn);
      }
    }

    function searchLogoHtml(src, letter, wide) {
      if (src) {
        return '<img class="thumb' + (wide ? " wide" : "") + '" src="' + escapeHtml(src) + '" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'thumb ph\',textContent:\'TV\'}))"/>';
      }
      return '<span class="thumb ph' + (wide ? " wide" : "") + '">' + escapeHtml(letter || "TV") + "</span>";
    }

    function fmtSearchWindow(isoStart, isoStop) {
      if (!isoStart) return "";
      const st = new Date(isoStart);
      const sp = isoStop ? new Date(isoStop) : null;
      if (isNaN(st.getTime())) return "";
      const day = st.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      const t1 = st.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      if (sp && !isNaN(sp.getTime())) {
        const t2 = sp.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
        return day + " · " + t1 + "–" + t2;
      }
      return day + " · " + t1;
    }

    function fmtProgrammeSubtitle(p) {
      const bits = [];
      if (p.subtitle) bits.push(p.subtitle);
      if (p.episode_label) bits.push(String(p.episode_label).replace(/\s+/g, ""));
      else if (p.season != null && p.episode != null) bits.push("S" + p.season + "E" + p.episode);
      if (p.category && p.category !== "EPG") bits.push(p.category);
      return bits.join(" · ");
    }

    function renderSearchBadges(badges) {
      if (!badges || !badges.length) return "";
      return '<div class="meta-row">' + badges.map(b =>
        '<span class="result-badge ' + escapeHtml(b.cls || "tag") + '">' + escapeHtml(b.text) + "</span>"
      ).join("") + "</div>";
    }

    function addSearchSection(container, label, count, rows, footHtml) {
      if (!rows || !rows.length) return false;
      const sec = document.createElement("div");
      sec.className = "search-section";
      const countHtml = count != null ? '<span class="section-count">' + count + "</span>" : "";
      sec.innerHTML = '<div class="section-label"><span>' + escapeHtml(label) + "</span>" + countHtml + "</div>";
      for (const row of rows) sec.appendChild(row);
      if (footHtml) {
        const foot = document.createElement("div");
        foot.className = "search-section-foot";
        foot.innerHTML = footHtml;
        sec.appendChild(foot);
      }
      container.appendChild(sec);
      return true;
    }

    async function openSearchScheduleResult(p) {
      closeSearchDrawer();
      await switchChannel(String(p.channel_id));
      await openXrayForProgramme(p, p.channel_name || "");
    }

    function renderUnifiedSearch(data) {
      searchResults.innerHTML = "";
      if (!data || !data.query) {
        searchResults.innerHTML = '<div class="search-empty">Search live channels, TV guide listings, and VOD</div>';
        if (searchQuick) searchQuick.classList.remove("hidden");
        return;
      }
      if (searchQuick) searchQuick.classList.add("hidden");
      pushSearchRecent(data.query);

      const totals = data.totals || {};
      if (totals.all > 0) {
        const summary = document.createElement("div");
        summary.className = "search-summary";
        const bits = [];
        if (totals.channels) bits.push("<strong>" + totals.channels + "</strong> channel" + (totals.channels === 1 ? "" : "s"));
        if (totals.schedule) bits.push("<strong>" + totals.schedule + "</strong> guide");
        if (totals.vod_movies) bits.push("<strong>" + totals.vod_movies + "</strong> movie" + (totals.vod_movies === 1 ? "" : "s"));
        if (totals.vod_tv) bits.push("<strong>" + totals.vod_tv + "</strong> show" + (totals.vod_tv === 1 ? "" : "s"));
        summary.innerHTML = bits.join(" · ") + ' for “' + escapeHtml(data.query) + "”";
        searchResults.appendChild(summary);
      }

      let any = totals.all > 0;

      const chRows = (data.channels || []).map(c => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "result-row";
        row.style.cssText = "width:100%;border:0;background:transparent;text-align:left;color:inherit;font-family:inherit";
        const letter = ((c.name || "?").trim().charAt(0) || "T").toUpperCase();
        const subBits = [];
        if (c.now_playing && c.now_playing.title) subBits.push("Now: " + c.now_playing.title);
        else if (c.epg_has_data) subBits.push("EPG available");
        if (c.tags && c.tags.length) subBits.push(c.tags.slice(0, 2).join(", "));
        const badges = [];
        if (c.dead) badges.push({ cls: "past", text: "Offline" });
        if (c.now_playing && c.now_playing.title) badges.push({ cls: "live", text: "On now" });
        row.innerHTML = searchLogoHtml(c.logo, letter, true)
          + '<div class="body"><div class="name">' + escapeHtml(c.name || ("Channel " + c.id)) + "</div>"
          + (subBits.length ? '<div class="sub">' + escapeHtml(subBits.join(" · ")) + "</div>" : "")
          + renderSearchBadges(badges) + "</div>"
          + '<div class="aside"><div class="id">#' + escapeHtml(String(c.id)) + "</div></div>";
        row.addEventListener("click", () => {
          closeSearchDrawer();
          switchChannel(String(c.id));
        });
        return row;
      });
      if (addSearchSection(searchResults, "Channels", totals.channels, chRows)) any = true;

      const schedRows = (data.schedule || []).map(p => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "result-row";
        row.style.cssText = "width:100%;border:0;background:transparent;text-align:left;color:inherit;font-family:inherit";
        const letter = ((p.channel_name || "?").trim().charAt(0) || "T").toUpperCase();
        const subtitle = fmtProgrammeSubtitle(p);
        const when = fmtSearchWindow(p.start, p.stop);
        const badges = [];
        if (p.air_status === "live") badges.push({ cls: "live", text: p.air_label || "Live now" });
        else if (p.air_status === "upcoming") badges.push({ cls: "upcoming", text: p.air_label || "Upcoming" });
        else badges.push({ cls: "past", text: p.air_label || "Earlier" });
        if (p.programme_type && p.programme_type !== "other") badges.push({ cls: "tag", text: p.programme_type });
        row.innerHTML = searchLogoHtml(p.channel_logo, letter, true)
          + '<div class="body"><div class="name">' + escapeHtml(p.title || "Programme") + "</div>"
          + (subtitle ? '<div class="sub">' + escapeHtml(subtitle) + "</div>" : "")
          + '<div class="sub">' + escapeHtml((p.channel_name || "") + (when ? " · " + when : "")) + "</div>"
          + renderSearchBadges(badges) + "</div>";
        row.addEventListener("click", () => openSearchScheduleResult(p));
        return row;
      });
      if (addSearchSection(searchResults, "TV Guide", totals.schedule, schedRows)) any = true;

      const searchVodQueue = []
        .concat((data.vod_movies || []).map(i => vodQueueItem("movie", i.tmdb_id)))
        .concat((data.vod_tv || []).map(i => vodQueueItem("tv", i.tmdb_id)));

      const vodRowBuilder = (kind, items) => (items || []).map(item => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "result-row";
        row.style.cssText = "width:100%;border:0;background:transparent;text-align:left;color:inherit;font-family:inherit";
        const thumb = item.poster_url
          ? '<img class="thumb" src="' + escapeHtml(item.poster_url) + '" alt="" loading="lazy"/>'
          : '<div class="thumb ph">🎬</div>';
        const meta = [item.year, item.rating ? (String(item.rating) + "★") : ""].filter(Boolean).join(" · ");
        const badges = [];
        for (const t of (item.quality_tags || []).slice(0, 2)) badges.push({ cls: "quality", text: t });
        if (item.provider_name) badges.push({ cls: "tag", text: item.provider_name });
        for (const g of (item.genres || []).slice(0, 2)) badges.push({ cls: "genre", text: g });
        row.innerHTML = thumb + '<div class="body"><div class="name">' + escapeHtml(item.title || "") + "</div>"
          + (meta ? '<div class="sub">' + escapeHtml(meta) + "</div>" : "")
          + (item.overview_short ? '<div class="sub">' + escapeHtml(item.overview_short) + "</div>" : "")
          + renderSearchBadges(badges) + "</div>";
        row.addEventListener("click", () => {
          closeSearchDrawer();
          const mt = item.type || kind;
          const idx = searchVodQueue.findIndex(q => q.tmdb_id === String(item.tmdb_id) && q.type === (mt === "tv" ? "tv" : "movie"));
          setVodDetailQueue(idx >= 0 ? searchVodQueue.slice(idx) : [vodQueueItem(mt, item.tmdb_id)]);
          showVodDetail(item.tmdb_id, mt);
        });
        return row;
      });

      const vodFoot = '<button type="button" data-vod-search="' + escapeHtml(data.query) + '">Browse all VOD results</button>';
      const movieRows = vodRowBuilder("movie", data.vod_movies);
      if (addSearchSection(searchResults, "Movies", totals.vod_movies, movieRows, totals.vod_movies ? vodFoot : "")) any = true;
      const tvRows = vodRowBuilder("tv", data.vod_tv);
      if (addSearchSection(searchResults, "TV Shows", totals.vod_tv, tvRows, totals.vod_tv ? vodFoot : "")) any = true;

      searchResults.querySelectorAll("[data-vod-search]").forEach(btn => {
        btn.addEventListener("click", () => {
          const q = btn.getAttribute("data-vod-search") || "";
          closeSearchDrawer();
          vodNavigate({ view: "browse", tab: "search", q });
        });
      });

      if (!any) {
        searchResults.innerHTML = '<div class="search-empty">No results for “' + escapeHtml(data.query) + "”. Try another title, channel, or show name.</div>";
      }
    }

    function renderSearchRows(container, items, emptyMsg) {
      container.innerHTML = "";
      if (!items.length) {
        container.innerHTML = '<div class="search-empty">' + emptyMsg + '</div>';
        return;
      }
      for (const item of items) {
        const ch = channelMap[String(item.id)] || item;
        const row = document.createElement("button");
        row.type = "button";
        row.className = "result-row";
        row.style.cssText = "width:100%;border:0;background:transparent;text-align:left;color:inherit;font-family:inherit";
        const letter = ((ch.name || item.name || "?").trim().charAt(0) || "T").toUpperCase();
        row.innerHTML = searchLogoHtml(ch.logo, letter, true)
          + '<div class="body"><div class="name">' + escapeHtml(ch.name || item.name || ("Channel " + item.id)) + '</div></div>'
          + '<div class="aside"><div class="id">#' + escapeHtml(String(item.id)) + '</div></div>';
        row.addEventListener("click", () => {
          closeSearchDrawer();
          switchChannel(String(item.id));
        });
        container.appendChild(row);
      }
    }

    function refreshQuickLists() {
      renderSearchRows(favList, getFavorites(), "No favorites yet");
      renderSearchRows(recentList, getRecents(), "No recent channels");
    }

    function openSearchDrawer() {
      searchOpen = true;
      searchDrawer.classList.add("open");
      searchBackdrop.classList.add("open");
      refreshQuickLists();
      renderSearchRecentTags();
      setTimeout(() => searchInput.focus(), 200);
    }

    function closeSearchDrawer() {
      searchOpen = false;
      searchDrawer.classList.remove("open");
      searchBackdrop.classList.remove("open");
      searchInput.value = "";
      if (searchQuick) searchQuick.classList.remove("hidden");
      searchResults.innerHTML = '<div class="search-empty">Search live channels, TV guide listings, and VOD</div>';
    }

    searchBtn.addEventListener("click", (e) => { e.stopPropagation(); openSearchDrawer(); });
    searchBtnChrome.addEventListener("click", (e) => { e.stopPropagation(); openSearchDrawer(); });
    closeSearch.addEventListener("click", closeSearchDrawer);
    searchBackdrop.addEventListener("click", closeSearchDrawer);

    if (settingsBtn) settingsBtn.addEventListener("click", (e) => { e.stopPropagation(); openSettingsDrawer(); });
    const traktConnectBtn = document.getElementById("traktConnectBtn");
    const traktLogoutBtn = document.getElementById("traktLogoutBtn");
    if (traktConnectBtn) traktConnectBtn.addEventListener("click", () => startTraktDeviceLogin(document.getElementById("traktDeviceHint")));
    if (traktLogoutBtn) traktLogoutBtn.addEventListener("click", logoutTrakt);
    if (closeSettings) closeSettings.addEventListener("click", closeSettingsDrawer);
    if (settingsBackdrop) settingsBackdrop.addEventListener("click", closeSettingsDrawer);
    if (themeGrid) {
      themeGrid.addEventListener("click", (e) => {
        const btn = e.target.closest(".theme-opt");
        if (!btn || !btn.dataset.theme) return;
        applyTheme(btn.dataset.theme);
      });
    }

    if (closeVodPicker) closeVodPicker.addEventListener("click", closeVodPickerPanel);
    if (vodPickerBackdrop) vodPickerBackdrop.addEventListener("click", closeVodPickerPanel);
    if (vodDirectHlsToggle) {
      vodDirectHlsToggle.addEventListener("change", () => setVodDirectHls(vodDirectHlsToggle.checked));
    }
    if (vodHlsOnlyToggle) {
      vodHlsOnlyToggle.addEventListener("change", () => setVodHlsOnly(vodHlsOnlyToggle.checked));
    }
    if (vodSourceModeSeg) {
      vodSourceModeSeg.addEventListener("click", (e) => {
        const btn = e.target.closest(".seg-opt");
        if (!btn || !btn.dataset.mode) return;
        setVodSourceMode(btn.dataset.mode);
      });
    }
    const vodSeriesPlaySeg = document.getElementById("vodSeriesPlaySeg");
    if (vodSeriesPlaySeg) {
      vodSeriesPlaySeg.addEventListener("click", (e) => {
        const btn = e.target.closest(".seg-opt");
        if (!btn || !btn.dataset.mode) return;
        setVodSeriesPlayMode(btn.dataset.mode);
      });
    }
    if (vodTrailerAutoplayToggle) {
      vodTrailerAutoplayToggle.addEventListener("change", () => setVodTrailerAutoplay(vodTrailerAutoplayToggle.checked));
    }
    if (vodTrailerMutedToggle) {
      vodTrailerMutedToggle.addEventListener("change", () => setVodTrailersStartMuted(vodTrailerMutedToggle.checked));
    }
    if (vodAutoNextToggle) {
      vodAutoNextToggle.addEventListener("change", () => setVodAutoNext(vodAutoNextToggle.checked));
    }
    const vodLangSelectEl = document.getElementById("vodLangSelect");
    if (vodLangSelectEl) {
      vodLangSelectEl.addEventListener("change", () => setVodPreferLang(vodLangSelectEl.value));
    }
    if (vodEpPrev) vodEpPrev.addEventListener("click", (e) => { e.stopPropagation(); stepSeriesEpisode(-1); });
    if (vodEpNext) vodEpNext.addEventListener("click", (e) => { e.stopPropagation(); stepSeriesEpisode(1); });
    if (vodEpAutoBtn) {
      vodEpAutoBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setVodAutoNext(!vodAutoNextEnabled());
      });
    }
    if (vodEpNextUpCancel) {
      vodEpNextUpCancel.addEventListener("click", (e) => { e.stopPropagation(); cancelEpisodeAutoAdvance(); });
    }
    if (vodEpNextUpPlay) {
      vodEpNextUpPlay.addEventListener("click", (e) => {
        e.stopPropagation();
        const t = vodEpNextTarget;
        cancelEpisodeAutoAdvance();
        if (t) playSeriesEpisode(t.season, t.episode, { title: t.title });
      });
    }
    function handleVodStartGateAction(action) {
      const pending = vodStartGatePending;
      if (!pending) return;
      const embedUrl = pending.embedUrl;
      const ctx = pending.ctx;
      const returnKind = pending.returnKind || "vod_picker";
      const mode = pending.mode || "embed_start";
      if (action === "sources") {
        hideVodStartGate();
        if (ctx) openVodPickerForCtx(ctx);
        return;
      }
      if (action === "embed") {
        hideVodStartGate();
        if (embedUrl) playEmbedInPlayer(embedUrl, returnKind, ctx);
        else if (ctx) openVodPickerForCtx(ctx);
        return;
      }
      hideVodStartGate();
      if (mode === "hls_fail") {
        startVodPlayback(ctx, returnKind);
        return;
      }
      if (embedUrl) {
        playEmbedInPlayer(embedUrl, returnKind, ctx);
        return;
      }
      startVodPlayback(ctx, returnKind);
    }

    if (vodStartGateBtn) {
      vodStartGateBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleVodStartGateAction("start");
      });
    }
    if (vodStartGateSources) {
      vodStartGateSources.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleVodStartGateAction("sources");
      });
    }
    if (vodStartGateEmbed) {
      vodStartGateEmbed.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleVodStartGateAction("embed");
      });
    }
    if (vodStartGate) {
      vodStartGate.addEventListener("click", (e) => {
        if (e.target.closest("#vodStartGateEmbed")) {
          e.preventDefault();
          e.stopPropagation();
          handleVodStartGateAction("embed");
          return;
        }
        if (e.target.closest("#vodStartGateSources")) {
          e.preventDefault();
          e.stopPropagation();
          handleVodStartGateAction("sources");
          return;
        }
        if (e.target.closest("#vodStartGateBtn, .vod-start-gate-btn")) {
          e.preventDefault();
          e.stopPropagation();
          handleVodStartGateAction("start");
        }
      });
    }
    if (v) v.addEventListener("ended", onVodEpisodeEnded);
    if (calmUiToggle) {
      calmUiToggle.addEventListener("change", () => applyCalmUi(calmUiToggle.checked));
    }
    if (rememberChannelToggle) {
      rememberChannelToggle.addEventListener("change", () => setRememberChannel(rememberChannelToggle.checked));
    }
    if (liveStartMutedToggle) {
      liveStartMutedToggle.addEventListener("change", () => setLiveStartMuted(liveStartMutedToggle.checked));
    }
    if (guideCollapsedToggle) {
      guideCollapsedToggle.addEventListener("change", () => {
        setGuideDefaultCollapsed(guideCollapsedToggle.checked);
        if (guideCollapsedToggle.checked) applyGuideState(true);
      });
    }
    if (useDaddyliveToggle) {
      useDaddyliveToggle.addEventListener("change", () => setHouseholdUseDaddylive(useDaddyliveToggle.checked));
    }
    if (skipCdnBlockedToggle) {
      skipCdnBlockedToggle.addEventListener("change", () => setSkipCdnBlocked(skipCdnBlockedToggle.checked));
    }
    if (paintEmbedToggle) {
      paintEmbedToggle.addEventListener("change", () => setPaintEmbedFallback(paintEmbedToggle.checked));
    }
    if (paintGraceSeg) {
      paintGraceSeg.addEventListener("click", (e) => {
        const btn = e.target.closest(".seg-opt");
        if (!btn || !btn.dataset.grace) return;
        setPaintDeadGracePreset(btn.dataset.grace);
      });
    }
    if (clearRecentsBtn) {
      clearRecentsBtn.addEventListener("click", () => {
        try { localStorage.removeItem(LS_RECENT); } catch (e) {}
        ensureRecentsStorage();
        refreshQuickLists();
        if (guideCategoryKey === "recent") applyGuideCategory("recent", { scrollToNow: false });
        else renderCatDrawerList();
        clearRecentsBtn.textContent = "Cleared";
        setTimeout(() => { clearRecentsBtn.textContent = "Clear recent channels"; }, 1400);
      });
    }
    if (clearSearchRecentBtn) {
      clearSearchRecentBtn.addEventListener("click", () => {
        try { localStorage.removeItem(LS_SEARCH_RECENT); } catch (e) {}
        renderSearchRecentTags();
        clearSearchRecentBtn.textContent = "Cleared";
        setTimeout(() => { clearSearchRecentBtn.textContent = "Clear search history"; }, 1400);
      });
    }
    if (clearFavoritesBtn) {
      clearFavoritesBtn.addEventListener("click", () => {
        if (!confirm("Clear all favorite channels?")) return;
        try { localStorage.removeItem(LS_FAV); } catch (e) {}
        ensureFavoritesStorage();
        refreshQuickLists();
        if (guideCategoryKey === "favorites") applyGuideCategory("favorites", { scrollToNow: false });
        else {
          renderCatDrawerList();
          renderGrid();
        }
        clearFavoritesBtn.textContent = "Cleared";
        setTimeout(() => { clearFavoritesBtn.textContent = "Clear favorites"; }, 1400);
      });
    }
    if (vodCatalogBtn) vodCatalogBtn.addEventListener("click", (e) => { e.stopPropagation(); openVodCatalog(); });
    if (vodHomeBrand) {
      vodHomeBrand.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openVodCatalog();
      });
    }
    if (closeVodCatalogBtn) closeVodCatalogBtn.addEventListener("click", closeVodCatalog);
    if (vodCatalogBackdrop) vodCatalogBackdrop.addEventListener("click", closeVodCatalog);
    if (vodCatalogTabs) {
      vodCatalogTabs.addEventListener("click", (e) => {
        const tab = e.target.closest(".vod-tab");
        if (!tab || !tab.dataset.tab) return;
        if (vodCatalogSearch) vodCatalogSearch.value = "";
        setVodCatalogTab(tab.dataset.tab);
      });
    }
    for (const sel of [vodSortSelect, vodGenreSelect, vodYearSelect, vodRatingSelect]) {
      if (sel) sel.addEventListener("change", scheduleVodFilterReload);
    }
    if (vodCatalogSearch) {
      vodCatalogSearch.addEventListener("input", () => {
        clearTimeout(vodSearchTimer);
        vodSearchTimer = setTimeout(() => searchVodCatalog(vodCatalogSearch.value), 300);
      });
      vodCatalogSearch.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          if ((vodDetail && vodDetail.classList.contains("show")) || !vodAtBrowseRoot()) {
            vodGoBack();
          } else {
            closeVodCatalog();
          }
        }
      });
    }
    if (vodCatalogBody) {
      vodCatalogBody.addEventListener("scroll", onVodCatalogScroll, { passive: true });
    }

    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(runSearch, 250);
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); closeSearchDrawer(); }
    });

    async function runSearch() {
      const q = searchInput.value.trim();
      if (!q) {
        if (searchQuick) searchQuick.classList.remove("hidden");
        searchResults.innerHTML = '<div class="search-empty">Search live channels, TV guide listings, and VOD</div>';
        return;
      }
      if (searchQuick) searchQuick.classList.add("hidden");
      searchResults.innerHTML = '<div class="search-empty">Searching…</div>';
      try {
        const r = await authFetch("/search?q=" + encodeURIComponent(q) + "&limit=15");
        if (!r.ok) throw new Error("search_failed");
        const data = await r.json();
        renderUnifiedSearch(data);
      } catch (e) {
        searchResults.innerHTML = '<div class="search-empty">Search failed</div>';
      }
    }

    function getSpeechRecognitionCtor() {
      return window.SpeechRecognition || window.webkitSpeechRecognition || null;
    }

    function wireVoiceSearchMic(inputEl, micBtn, onFinalTranscript) {
      if (!micBtn) return;
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor || !inputEl) {
        micBtn.hidden = true;
        micBtn.setAttribute("aria-hidden", "true");
        return;
      }
      let rec = null;
      let listening = false;
      function setListening(on) {
        listening = !!on;
        micBtn.classList.toggle("listening", listening);
        micBtn.setAttribute("aria-pressed", listening ? "true" : "false");
        if (listening) micBtn.title = "Listening… tap to stop";
        else if (!micBtn.title || micBtn.title.indexOf("Listening") === 0)
          micBtn.title = "Voice search";
      }
      function stopRec() {
        try { if (rec) rec.stop(); } catch (e) {}
        setListening(false);
      }
      micBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (listening) { stopRec(); return; }
        try {
          rec = new Ctor();
          rec.lang = navigator.language || "en-US";
          rec.interimResults = false;
          rec.maxAlternatives = 1;
          rec.continuous = false;
          rec.onresult = (ev) => {
            let transcript = "";
            try {
              transcript = (ev.results && ev.results[0] && ev.results[0][0] && ev.results[0][0].transcript) || "";
            } catch (err) { transcript = ""; }
            transcript = String(transcript || "").trim();
            if (!transcript) return;
            inputEl.value = transcript;
            try { inputEl.dispatchEvent(new Event("input", { bubbles: true })); } catch (err) {}
            if (typeof onFinalTranscript === "function") onFinalTranscript(transcript);
          };
          rec.onerror = (ev) => {
            setListening(false);
            const err = (ev && ev.error) || "";
            if (err === "not-allowed" || err === "service-not-allowed")
              micBtn.title = "Mic permission denied";
            else if (err === "no-speech")
              micBtn.title = "No speech heard — try again";
            else if (err && err !== "aborted")
              micBtn.title = "Voice search unavailable";
          };
          rec.onend = () => setListening(false);
          setListening(true);
          micBtn.title = "Listening… tap to stop";
          rec.start();
        } catch (err) {
          setListening(false);
          micBtn.hidden = true;
          micBtn.setAttribute("aria-hidden", "true");
        }
      });
    }

    wireVoiceSearchMic(searchInput, searchMicBtn, () => { clearTimeout(searchTimer); runSearch(); });
    wireVoiceSearchMic(vodCatalogSearch, vodCatalogMicBtn, (q) => {
      clearTimeout(vodSearchTimer);
      searchVodCatalog(q);
    });

    function openInlinePinUnlock(reason, opts) {
      opts = opts || {};
      const locked = reason === "guest_expired" || reason === "pin_required" || reason === "stream_locked";
      const msg = locked
        ? "Stream locked — enter your household PIN to keep watching."
        : (opts.message || "Enter your household PIN to unlock this device.");
      function resumeAfterUnlock() {
        try {
          const banner = document.getElementById("sdGuestPinBanner");
          if (banner) {
            banner.hidden = true;
            document.body.classList.remove("sd-guest-banner-visible");
          }
          sessionStorage.removeItem("sd_guest_banner_dismiss");
          sessionStorage.setItem("sd_inline_pin_shown", "0");
        } catch (e) {}
        tryPlay();
        if (typeof opts.onSuccess === "function") opts.onSuccess();
      }
      if (window.SDPinUnlock && typeof SDPinUnlock.open === "function") {
        if (!opts.quiet) {
          showErr(locked
            ? "PIN required — unlock on this page"
            : "Session ended — unlock on this page");
        }
        SDPinUnlock.open({ message: msg, onSuccess: resumeAfterUnlock });
        return true;
      }
      return false;
    }

    function handleAuthFailure(reason) {
      try { window.dispatchEvent(new CustomEvent("sd-auth-required", { detail: { reason: reason || "auth" } })); } catch (e) {}
      destroyHls();
      // Stay on the current page — never force-navigate to /auth.
      if (openInlinePinUnlock(reason || "auth")) return;
      showErr(reason === "guest_expired" || reason === "pin_required"
        ? "PIN required — tap Enter PIN"
        : "Session ended — tap Enter PIN");
      try {
        const banner = document.getElementById("sdGuestPinBanner");
        if (banner) {
          banner.hidden = false;
          banner.classList.add("urgent");
          document.body.classList.add("sd-guest-banner-visible");
        }
      } catch (e) {}
    }
    async function authFetch(url, opts) {
      const r = await fetch(url, Object.assign({ credentials: "same-origin" }, opts || {}));
      if (r.status === 401) {
        let reason = "auth";
        try {
          const data = await r.clone().json();
          if (data && data.error) reason = data.error;
        } catch (e) {}
        handleAuthFailure(reason);
        throw new Error("auth");
      }
      return r;
    }

    function nativeHls() {
      // Chromium canPlayType may claim HLS ("maybe") without a working native stack for
      // our proxied playlists — prefer hls.js MSE whenever it is supported.
      try {
        if (window.Hls && typeof Hls.isSupported === "function" && Hls.isSupported()) {
          return false;
        }
      } catch (e) {}
      if (!isIOS) return false;
      return !!v.canPlayType("application/vnd.apple.mpegurl") || !!v.canPlayType("application/x-mpegURL");
    }
    function isAutoplayPolicyError(err) {
      if (!err) return false;
      const name = String(err.name || "");
      const msg = String(err.message || err || "");
      return name === "NotAllowedError" || /not allowed|user.?gesture|autoplay/i.test(msg);
    }
    function hideTapPlayGate() {
      autoplayPolicyBlocked = false;
      if (tapPlay) tapPlay.classList.remove("show");
    }
    function showTapPlayGate() {
      // Only for true autoplay-policy failure after muted retries.
      autoplayPolicyBlocked = true;
      clearBufferOverlay();
      if (tapPlay) {
        tapPlay.textContent = "Tap to play";
        tapPlay.classList.add("show");
      }
    }
    function tryPlay() {
      if (!v) return Promise.resolve();
      if (autoplayPolicyBlocked && !userGestureSeen) return Promise.resolve();
      const hidePrompts = () => {
        hideTapPlayGate();
        if (unmuteBtn) unmuteBtn.style.display = "none";
      };
      const preferMutedStart = liveStartMutedEnabled();
      const tryWithMute = (muted) => {
        try { v.setAttribute("playsinline", ""); v.playsInline = true; } catch (e) {}
        if (muted) {
          try { v.setAttribute("muted", ""); } catch (e) {}
          v.muted = true;
        } else {
          v.muted = false;
        }
        return v.play().then(() => {
          playRetryCount = 0;
          policyRetryCount = 0;
          if (playRetryTimer) {
            clearTimeout(playRetryTimer);
            playRetryTimer = null;
          }
          hidePrompts();
          if (!muted) {
            userUnmuted = true;
            try { v.removeAttribute("muted"); } catch (e) {}
            if (unmuteBtn) unmuteBtn.style.display = "none";
          } else if (!userUnmuted && unmuteBtn) {
            // Muted fallback (policy or settings) — invite unmute.
            unmuteBtn.style.display = "block";
          }
          // play() can resolve before frames arrive — keep buffer UI until ready.
          if (!v.paused && v.readyState >= 2) clearBufferOverlay();
          else if (!v.paused) setBuffering(true, muted ? "Starting (muted)…" : "Starting…", { start: true, soft: true });
        });
      };
      const scheduleRetry = (err) => {
        const policy = isAutoplayPolicyError(err);
        if (policy) {
          policyRetryCount += 1;
          // Keep buffering while we retry muted autoplay; gate only after real policy blocks.
          if (policyRetryCount >= 6 && v.paused && !userGestureSeen) {
            showTapPlayGate();
            return;
          }
          if (v.paused) setBuffering(true, "Starting…", { start: true, soft: true });
          if (playRetryTimer) clearTimeout(playRetryTimer);
          playRetryTimer = setTimeout(() => tryPlay(), 280 * Math.min(policyRetryCount, 5));
          return;
        }
        // Not-ready / abort / decode — never present Tap to play as idle CTA.
        playRetryCount += 1;
        if (v.paused) setBuffering(true, v.readyState < 2 ? "Loading…" : "Starting…", { start: true, soft: true });
        else clearBufferOverlay();
        if (playRetryCount >= 16) playRetryCount = 0; // keep trying on media events
        if (playRetryTimer) clearTimeout(playRetryTimer);
        playRetryTimer = setTimeout(() => tryPlay(), 400 * Math.min(Math.max(playRetryCount, 1), 5));
      };
      try { v.setAttribute("playsinline", ""); v.playsInline = true; } catch (e) {}
      if (v.paused) setBuffering(true, "Starting…", { start: true, soft: true });
      else clearBufferOverlay();

      // Explicit unmute / gesture: always prefer sound.
      if (userUnmuted && userGestureSeen) {
        return tryWithMute(false)
          .catch((e) => tryWithMute(true).catch(() => Promise.reject(e)))
          .catch(scheduleRetry);
      }

      // TV guide default: unmuted autoplay first; muted fallback → "Tap for sound".
      if (!preferMutedStart) {
        return tryWithMute(false)
          .catch((e) => {
            if (!isAutoplayPolicyError(e)) return Promise.reject(e);
            return tryWithMute(true);
          })
          .catch(scheduleRetry);
      }

      // Settings: start muted.
      try { v.setAttribute("muted", ""); } catch (e) {}
      return tryWithMute(true).catch(scheduleRetry);
    }
    function destroyHls() {
      if (liveRecoverTimer) {
        clearTimeout(liveRecoverTimer);
        liveRecoverTimer = null;
      }
      pauseNoFrameWatch();
      if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
      v.removeAttribute("src");
      try { v.load(); } catch (e) {}
    }

    function clearLiveRecoverWatchdog() {
      if (liveRecoverWatchdog) {
        clearInterval(liveRecoverWatchdog);
        liveRecoverWatchdog = null;
      }
    }

    function armLiveRecoverWatchdog() {
      clearLiveRecoverWatchdog();
      let ticks = 0;
      liveRecoverWatchdog = setInterval(() => {
        if (playbackLooksHealthy() || mediaPaintingOk()) {
          clearBufferOverlay();
          markPaintHealthySample();
          // Only drop the watchdog after sustained healthy paint (not one lucky tick).
          if (paintHealthySince && (Date.now() - paintHealthySince) >= PAINT_HEALTHY_CONFIRM_MS) {
            clearLiveRecoverWatchdog();
          }
          return;
        }
        markPaintUnhealthySample();
        ticks++;
        // Stuck "Reconnecting…" with no progress → escalate at most twice from watchdog.
        if (
          ticks <= 2 &&
          bufferVisible &&
          bufferStatus &&
          /reconnect/i.test(bufferStatus.textContent || "")
        ) {
          try { recoverLivePlayback("watchdog"); } catch (e) {}
        } else if (ticks > 6) {
          clearLiveRecoverWatchdog();
          if (!(playbackLooksHealthy() || mediaPaintingOk())) {
            showLiveSoftRetry("watchdog-timeout");
          }
        }
      }, 4500);
    }

    function hardRemountLive(reason) {
      if (liveHardRemountUsed) return false;
      if (paintGraceWatchActive()) return false; // let 60s paint watch finish — no MSE thrash
      if (liveRecoverOnCooldown()) return false;
      liveHardRemountUsed = true;
      markLiveRecoverAction();
      try { console.info("[live] hard-remount:", reason || ""); } catch (e) {}
      const url = currentStreamUrl || liveStreamUrl || ("/live/" + encodeURIComponent(channelId || "") + ".m3u8");
      if (!url) return false;
      reloadAttempts = 0;
      setBuffering(true, "Reconnecting…", { soft: false, force: true, immediate: true });
      destroyHls();
      try {
        // Force media element to drop decoder state before re-attach.
        v.removeAttribute("src");
        v.load();
      } catch (e) {}
      setTimeout(() => {
        if (liveEmbedActive || vodHlsActive) return;
        attachHls(url + (url.includes("?") ? "&" : "?") + "r=" + Date.now());
      }, 350);
      return true;
    }

    function recoverLivePlayback(reason) {
      if (vodHlsActive || liveEmbedActive || switching) return;
      if (paintGraceWatchActive()) return; // decoder-death watch owns recovery until grace ends
      if (playbackLooksHealthy() || mediaPaintingOk()) {
        clearBufferOverlay();
        markPaintHealthySample();
        return;
      }
      if (liveRecoverOnCooldown()) return;
      const url = currentStreamUrl || liveStreamUrl;
      if (!url || !isLiveStreamUrl(url)) return;
      armLiveRecoverWatchdog();
      if (reloadAttempts < MAX_LIVE_SOFT_RELOAD) {
        reloadAttempts++;
        markLiveRecoverAction();
        const delay = Math.min(6000, 900 * Math.pow(1.7, reloadAttempts - 1));
        setBuffering(true, "Reconnecting…", {
          soft: false,
          force: true,
          immediate: reloadAttempts === 1,
        });
        if (liveRecoverTimer) clearTimeout(liveRecoverTimer);
        liveRecoverTimer = setTimeout(() => {
          liveRecoverTimer = null;
          if (liveEmbedActive || vodHlsActive) return;
          if (playbackLooksHealthy() || mediaPaintingOk()) {
            clearBufferOverlay();
            return;
          }
          // Soft: reload playlist / re-attach HLS with cache-bust.
          if (hls && typeof hls.loadSource === "function") {
            try {
              const abs = (url.startsWith("http") ? url : (location.origin + url));
              const bust = abs + (abs.includes("?") ? "&" : "?") + "r=" + Date.now();
              hls.stopLoad();
              hls.loadSource(bust);
              hls.startLoad(-1);
              tryPlay();
              return;
            } catch (e) {}
          }
          attachHls(url + (url.includes("?") ? "&" : "?") + "r=" + Date.now());
        }, delay);
        return;
      }
      if (!liveHardRemountUsed) {
        hardRemountLive(reason || "soft-exhausted");
        return;
      }
      showLiveSoftRetry(reason || "recover-exhausted");
    }

    // Expose for background/PiP restore path in player_features.js
    window.__sdRecoverLivePlayback = recoverLivePlayback;
    window.__sdLivePlaybackHealthy = () => playbackLooksHealthy() || mediaPaintingOk();

    async function resolvePlayUrl(url) {
      url = encodeLiveStreamUrl(url);
      const absUrl = url.startsWith("http") ? url : (location.origin + url);
      if (url.includes("/live/") || url.includes("/dulo-stream/") || url.includes("/ntv-stream/") || url.includes("/content/") || url.includes("/vod/hls/") || url.includes("/vod/file/")) return absUrl;
      try {
        const r = await authFetch(absUrl, { cache: "no-store" });
        if (!r.ok) return absUrl;
        const text = await r.text();
        for (const line of text.split("\n")) {
          const t = line.trim();
          if (t && !t.startsWith("#")) return t.startsWith("http") ? t : (location.origin + t);
        }
      } catch (e) {}
      return absUrl;
    }
    function wireLiveBufferEvents() {
      if (!v || v.dataset.sdBufferWired === "1") return;
      v.dataset.sdBufferWired = "1";
      let lastProgressT = 0;
      const showWait = (label, softPreferred) => {
        if (tapPlay && tapPlay.classList.contains("show")) return;
        if (playbackLooksHealthy() || mediaPaintingOk()) {
          // Brief segment hiccup while painting — ignore (no flicker).
          return;
        }
        setBuffering(true, label || "Buffering…", { soft: true });
      };
      const maybeHide = () => {
        if (playbackLooksHealthy() || mediaPaintingOk()) {
          clearBufferOverlay();
          return;
        }
        if (!v.paused && v.readyState >= 2 && !v.seeking) {
          bufferHideTimer = setTimeout(() => {
            if (playbackLooksHealthy() || mediaPaintingOk()) clearBufferOverlay();
          }, 80);
        }
      };
      v.addEventListener("loadstart", () => {
        if (!playbackLooksHealthy() && !mediaPaintingOk()) {
          setBuffering(true, "Loading…", { start: true, soft: true });
        }
      });
      v.addEventListener("waiting", () => {
        // waiting fires between segments — ignore when healthy; else soft after debounce.
        showWait("Buffering…", true);
      });
      v.addEventListener("stalled", () => {
        showWait("Reconnecting…", true);
      });
      v.addEventListener("seeking", () => {
        if (!playbackLooksHealthy() && !mediaPaintingOk()) {
          setBuffering(true, "Seeking…", { soft: true });
        }
      });
      v.addEventListener("playing", () => {
        hideTapPlayGate();
        policyRetryCount = 0;
        playRetryCount = 0;
        armPaintWatch();
        // Playing + green garbage is NOT healthy — keep recovery budget.
        // Do NOT force "Reconnecting…" here: that UI + remount-budget resets caused
        // load→reload thrash on brief black/green flashes during settle.
        if (paintLooksDead()) {
          markPaintUnhealthySample();
          return;
        }
        if (mediaHasDecodableFrame()) {
          noFrameSince = 0;
        }
        paintDeadStreak = 0;
        markPaintHealthySample();
        try { if (window.__sdAttachStallTimer) clearTimeout(window.__sdAttachStallTimer); } catch (e) {}
        if (playbackLooksHealthy() || mediaPaintingOk()) clearBufferOverlay();
      });
      v.addEventListener("canplay", () => {
        if (v.paused && currentStreamUrl && !autoplayPolicyBlocked) tryPlay();
        else if (v.paused && currentStreamUrl && userGestureSeen) tryPlay();
        maybeHide();
      });
      v.addEventListener("canplaythrough", maybeHide);
      v.addEventListener("loadeddata", () => {
        if (v.paused && currentStreamUrl && (!autoplayPolicyBlocked || userGestureSeen)) tryPlay();
        maybeHide();
      });
      v.addEventListener("timeupdate", () => {
        const t = v.currentTime || 0;
        if (t > 0 && Math.abs(t - lastProgressT) > 0.05) {
          lastProgressT = t;
          // Advancing timestamps on green-screen garbage must not hide recovery chrome.
          if (!v.paused && !paintLooksDead()) clearBufferOverlay();
        }
      });
      v.addEventListener("error", () => {
        // Transient media errors during HLS recovery must not full-block healthy video.
        if (autoplayPolicyBlocked) return;
        if (playbackLooksHealthy() || mediaPaintingOk()) return;
        if (!vodHlsActive && isLiveStreamUrl(currentStreamUrl || liveStreamUrl)) {
          recoverLivePlayback("media-error");
          return;
        }
        setBuffering(true, "Reconnecting…", { soft: true });
      });
    }
    function markLiveCdnBlocked() {
      // Sticky CDN circuit breaker is DaddyLive /content proxy only.
      if (!currentLiveIsDaddyLive()) return;
      liveCdnBlockedUntil = Date.now() + LIVE_CDN_BLOCK_TTL_MS;
    }

    function liveCdnIsBlocked() {
      return Date.now() < liveCdnBlockedUntil;
    }

    function clearLiveCdnPlaybackGuard() {
      liveCdnBlockedUntil = 0;
    }

    function isLiveContentUrl(url) {
      return String(url || "").includes("/content/");
    }

    function isHardLiveCdnBlock(data) {
      // Only DaddyLive gateway /content/* CF blocks — never FreeTV/iptv absolute CDNs or keys.
      if (!currentLiveIsDaddyLive()) return false;
      const code = data && data.response && data.response.code;
      const url = (data && data.frag && data.frag.url)
        || (data && data.url)
        || (data && data.context && data.context.url)
        || "";
      if (!isLiveContentUrl(url)) return false;
      // Our gateway maps upstream CF 403/429 → 502 + cdn_blocked on /content/*
      if (code === 403 || code === 429 || code === 502 || code === 503) return true;
      try {
        const body = data && data.response && data.response.data;
        if (body && typeof body === "object" && (body.cdn_blocked || body.cdn_tos_blocked)) return true;
      } catch (e) {}
      return false;
    }

    async function fetchLiveEmbedMeta(ch) {
      const id = String(ch || channelId || "").trim();
      if (!id) return null;
      try {
        const r = await authFetch("/live/" + encodeURIComponent(id) + "/meta", { cache: "no-store" });
        if (!r.ok) return null;
        return await r.json();
      } catch (e) {
        return null;
      }
    }

    async function fetchLiveEmbedUrl(ch) {
      const id = String(ch || channelId || "").trim();
      if (!id) return "";
      // Manual/debug only — same-origin sanitized proxy (not used on channel tune).
      const data = await fetchLiveEmbedMeta(id);
      try {
        // Never promote supplement meta into household CDN TOS sticky.
        if (data && data.cdn_tos_blocked && !isSupplementChannel(id) && currentLiveIsDaddyLive()) {
          window.__SD_LIVE_CDN_TOS = true;
        }
      } catch (e) {}
      if (data && data.embed_url) return data.embed_url;
      return "/live/" + encodeURIComponent(id) + "/embed";
    }

    let liveSoftRetryShownAt = 0;
    let liveSoftAutoRetryUsed = false;
    function showLiveSoftRetry(reason) {
      // Supplement / soft live fail: normal retry UX — no CDN toast, no guide gray-out, no sticky TOS.
      clearLiveCdnPlaybackGuard();
      clearBufferOverlay();
      const ch = channelId || resolveInitialChannel();
      const retryUrl = currentStreamUrl || liveStreamUrl || (ch ? ("/live/" + encodeURIComponent(ch) + ".m3u8") : "");
      try {
        destroyHls();
        try { v.pause(); } catch (e) {}
      } catch (e) {}
      const now = Date.now();
      if ((now - liveSoftRetryShownAt) > 8000) {
        liveSoftRetryShownAt = now;
        showErr("Playback interrupted — tap to retry");
      }
      if (tapPlay) {
        tapPlay.textContent = "Tap to retry";
        tapPlay.classList.add("show");
      }
      try {
        if (reason) console.info("[live] soft-retry:", reason);
      } catch (e) {}
      // One automatic re-attach after deploy blips / cold cache — avoids stranding every channel.
      if (!liveSoftAutoRetryUsed && retryUrl && !vodHlsActive && !liveEmbedActive) {
        liveSoftAutoRetryUsed = true;
        setTimeout(() => {
          if (vodHlsActive || liveEmbedActive || switching) return;
          if (!(tapPlay && tapPlay.classList.contains("show"))) return;
          try {
            hideTapPlayGate();
            setBuffering(true, "Reconnecting…", { soft: false, force: true, immediate: true });
            attachHls(retryUrl + (String(retryUrl).includes("?") ? "&" : "?") + "r=" + Date.now() + "&soft=1");
          } catch (e) {}
        }, 1400);
      }
    }

    function showLiveUnavailable(reason) {
      // Fail-fast CDN UX — DaddyLive only. Supplements must never enter this path.
      if (!currentLiveIsDaddyLive()) {
        showLiveSoftRetry(reason || "non-ddl");
        return;
      }
      markLiveCdnBlocked();
      liveEmbedFailCount = MAX_LIVE_CDN_FAILS;
      try { window.__SD_LIVE_CDN_TOS = true; } catch (e) {}
      householdCdnBlocked = true;
      clearBufferOverlay();
      try {
        destroyHls();
        try { v.pause(); } catch (e) {}
      } catch (e) {}
      showErr("Live unavailable — upstream CDN blocked");
      if (tapPlay) {
        tapPlay.textContent = "Tap to retry";
        tapPlay.classList.add("show");
      }
      try {
        if (reason) console.info("[live] unavailable:", reason);
      } catch (e) {}
      try { renderGrid({ preserveScroll: true }); } catch (e) {}
    }

    // Manual/debug only — do NOT call from attachHls / channel tune.
    async function playLiveEmbedFallback(reason) {
      if (liveEmbedActive || vodHlsActive) return false;
      if (liveEmbedInflight) return liveEmbedInflight;
      liveEmbedInflight = (async () => {
        const ch = channelId || resolveInitialChannel();
        const embedUrl = await fetchLiveEmbedUrl(ch);
        if (!embedUrl || !trailerFrame) return false;
        try {
          destroyHls();
          try { v.pause(); } catch (e) {}
          try { v.removeAttribute("src"); v.load(); } catch (e) {}
          liveEmbedActive = true;
          trailerActive = true;
          if (tvRoot) tvRoot.classList.add("trailer-active", "overlay-active", "live-embed-active");
          if (trailerLayer) {
            trailerLayer.classList.add("show", "embed-mode", "live-embed-mode");
            trailerLayer.classList.remove("hls-mode", "has-hls-chrome", "gate-open");
            trailerLayer.setAttribute("aria-hidden", "false");
          }
          syncLiveEmbedChrome();
          clearBufferOverlay();
          hideTapPlayGate();
          try { if (typeof applyGuideState === "function") applyGuideState(true); } catch (e) {}
          try { if (typeof peekFilmOverVodCatalog === "function") peekFilmOverVodCatalog(); } catch (e) {}
          try {
            if (window.SDEmbed && SDEmbed.hardenFrame) SDEmbed.hardenFrame(embedUrl);
            else if (window.SDEmbed && SDEmbed.sandbox) {
              trailerFrame.setAttribute("sandbox", SDEmbed.sandbox);
              trailerFrame.setAttribute("referrerpolicy", "no-referrer");
            } else {
              trailerFrame.setAttribute(
                "sandbox",
                "allow-scripts allow-same-origin allow-forms allow-presentation allow-fullscreen allow-pointer-lock"
              );
              trailerFrame.setAttribute("referrerpolicy", "no-referrer");
            }
            trailerFrame.setAttribute(
              "allow",
              "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            );
          } catch (e) {}
          let finalUrl = embedUrl;
          try {
            if (window.SDEmbed && SDEmbed.enhanceUrl) finalUrl = SDEmbed.enhanceUrl(embedUrl);
          } catch (e) {}
          trailerFrame.src = finalUrl;
          try {
            if (window.SDEmbed && SDEmbed.start) SDEmbed.start(finalUrl, { live: true });
          } catch (e) {}
          if (trailerBackBtn) {
            trailerBackBtn.textContent = "← Back to live";
            trailerBackBtn.classList.add("embed-sticky-back");
          }
          try {
            const auto = String(reason || "").indexOf("dead-paint") >= 0 || String(reason || "").indexOf("android") >= 0;
            showErr(auto
              ? "Backup player (decoder glitch) — tap ← Back to live for MSE"
              : "Backup player (/live/" + (ch || "") + "/embed)");
          } catch (e) {}
          return true;
        } catch (e) {
          liveEmbedActive = false;
          try { if (window.SDEmbed && SDEmbed.stop) SDEmbed.stop(); } catch (err) {}
          return false;
        } finally {
          liveEmbedInflight = null;
        }
      })();
      return liveEmbedInflight;
    }

    async function attachHls(url) {
      url = encodeLiveStreamUrl(url);
      // Fail-fast: supplements must not spin "Loading…" forever (mixed-content / dead CDN).
      try { if (window.__sdAttachStallTimer) clearTimeout(window.__sdAttachStallTimer); } catch (e) {}
      const attachGen = (window.__sdAttachGen = (window.__sdAttachGen || 0) + 1);
      const stallMs = isSupplementChannelId(channelId) ? 18000 : 45000;
      window.__sdAttachStallTimer = setTimeout(() => {
        if (attachGen !== window.__sdAttachGen) return;
        if (playbackLooksHealthy() || mediaPaintingOk()) return;
        if (vodHlsActive) return;
        try {
          if (isSupplementChannelId(channelId) || !currentLiveIsDaddyLive()) {
            showLiveSoftRetry("attach-stall");
          } else {
            showLiveSoftRetry("attach-stall-ddl");
          }
        } catch (e) {}
      }, stallMs);

      destroyHls();
      playRetryCount = 0;
      policyRetryCount = 0;
      // Fresh attach resets soft-retry budget; hard remount flag only clears on healthy play.
      if (!String(url || "").includes("?r=") && !String(url || "").includes("&r=")) {
        reloadAttempts = 0;
        liveHardRemountUsed = false;
        livePaintRemountUsed = false;
        livePaintEmbedUsed = false;
        paintDeadStreak = 0;
        paintDeadSince = 0;
        paintHealthySince = 0;
        lastLiveRecoverAt = 0;
        lastPaintDead = false;
        liveSoftAutoRetryUsed = false;
        clearLiveRecoverWatchdog();
        clearPaintWatch();
      }
      // Always reset no-frame clock on attach — sticky clock across remounts stranded channels.
      clearNoFrameWatch({ reset: true });
      hideTapPlayGate();
      if (liveEmbedActive) {
        liveEmbedActive = false;
        if (tvRoot) tvRoot.classList.remove("live-embed-active");
        try { if (window.SDEmbed && SDEmbed.stop) SDEmbed.stop(); } catch (e) {}
        if (trailerFrame) trailerFrame.src = "";
        if (trailerLayer) {
          trailerLayer.classList.remove("show", "embed-mode", "live-embed-mode");
          trailerLayer.setAttribute("aria-hidden", "true");
        }
        trailerActive = false;
      }
      // Always try normal /live/{id}.m3u8 HLS first — never short-circuit on
      // prefer_embed / cdn_blocked / circuit breaker into Clappr embed.
      if (isSupplementChannel(channelId) || isSupplementChannelId(String(channelId || ""))) {
        clearLiveCdnPlaybackGuard();
      }
      setBuffering(true, switching ? "Tuning…" : "Loading…", { start: true, soft: true });
      currentStreamUrl = url.split("?")[0];
      if (!vodHlsActive && isLiveStreamUrl(currentStreamUrl)) {
        rememberLiveStreamUrl(currentStreamUrl);
        armNoFrameWatch();
      }
      const absUrl = await resolvePlayUrl(url);
      // playsinline only here — mute policy lives in tryPlay (unmuted-first on /tv).
      try {
        v.setAttribute("playsinline", "");
        v.playsInline = true;
        if (liveStartMutedEnabled()) {
          v.setAttribute("muted", "");
          v.muted = true;
        } else {
          try { v.removeAttribute("muted"); } catch (e) {}
          v.muted = false;
        }
      } catch (e) {}
      if (nativeHls()) {
        v.src = absUrl;
        tryPlay();
        return;
      }
      if (window.Hls && Hls.isSupported()) {
        hls = new Hls(HLS_CFG);
        hls.loadSource(absUrl);
        hls.attachMedia(v);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          try { applyAndroidAbrCap(hls); } catch (e) {}
          tryPlay();
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, () => {
          try { applyAndroidAbrCap(hls); } catch (e) {}
        });
        hls.on(Hls.Events.FRAG_LOADED, () => {
          liveEmbedFailCount = 0;
          // Successful segments clear the CDN thrash guard.
          liveCdnBlockedUntil = 0;
          // Do NOT reset recovery counters while HW decoder is painting garbage —
          // FRAG_LOADED still fires on green-screen 1080p High feeds.
          // Also do NOT reset on a single healthy sample (remount thrash).
          if (!(playbackLooksHealthy() || mediaPaintingOk())) {
            markPaintUnhealthySample();
            armPaintWatch();
            return;
          }
          noFrameSince = 0;
          liveSoftAutoRetryUsed = false;
          markPaintHealthySample();
          if (playbackLooksHealthy() || mediaPaintingOk()) clearBufferOverlay();
          if (v.paused && currentStreamUrl && (!autoplayPolicyBlocked || userGestureSeen)) tryPlay();
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (!data.fatal) {
            if (data.details === "bufferStalledError") {
              if (!(playbackLooksHealthy() || mediaPaintingOk())) {
                setBuffering(true, "Buffering…", { soft: true });
              }
            }
            return;
          }
          if (data.response && data.response.code === 401) { handleAuthFailure(); return; }
          const isLive = !vodHlsActive && isLiveStreamUrl(currentStreamUrl);
          const ddlLive = isLive && currentLiveIsDaddyLive();
          const hardCdn = ddlLive && isHardLiveCdnBlock(data);
          if (hardCdn) {
            // Fail fast — do NOT re-attachHls (that re-floods /content and blows concurrency).
            showLiveUnavailable("cdn-hard-" + ((data.response && data.response.code) || "x"));
            return;
          }
          // Soft path (non-/content 502/503, media errors, all supplement fails): reconnect with backoff.
          if (isLive) {
            recoverLivePlayback("hls-fatal-" + (data.details || data.type || "x"));
            return;
          }
          const maxReload = MAX_VOD_RELOAD;
          if (reloadAttempts < maxReload) {
            reloadAttempts++;
            setBuffering(true, "Reconnecting…", {
              soft: playbackLooksHealthy() || mediaPaintingOk(),
            });
            const delay = 1200;
            setTimeout(() => {
              if (liveEmbedActive || vodHlsActive) return;
              attachHls(currentStreamUrl + "?r=" + Date.now());
            }, delay);
          } else {
            clearBufferOverlay();
            showErr("Playback error — tap player to retry");
            if (tapPlay) {
              tapPlay.textContent = "Tap to retry";
              tapPlay.classList.add("show");
            }
          }
        });
        return;
      }
      clearBufferOverlay();
      showErr("HLS not supported in this browser");
    }

    tapPlay.addEventListener("click", () => {
      userGestureSeen = true;
      userUnmuted = true;
      autoplayPolicyBlocked = false;
      v.muted = false;
      reloadAttempts = 0;
      liveHardRemountUsed = false;
      liveEmbedFailCount = 0;
      liveCdnBlockedUntil = 0; // manual retry clears circuit breaker
      policyRetryCount = 0;
      playRetryCount = 0;
      clearLiveRecoverWatchdog();
      hideTapPlayGate();
      setBuffering(true, "Loading…");
      if (currentStreamUrl) attachHls(currentStreamUrl + "?r=" + Date.now());
      else tryPlay();
    });

    unmuteBtn.addEventListener("click", () => {
      userGestureSeen = true;
      userUnmuted = true;
      v.muted = false;
      v.play().then(() => { unmuteBtn.style.display = "none"; }).catch(() => tryPlay());
    });

    function saveLastChannel(id) {
      if (rememberChannelEnabled()) {
        try { localStorage.setItem(LS_LAST, id); } catch (e) {}
      }
      try {
        const name = (channelMap[id] && channelMap[id].name) || ("Channel " + id);
        let rec = JSON.parse(localStorage.getItem(LS_RECENT) || "[]").filter(x => x.id !== id);
        rec.unshift({ id, name });
        localStorage.setItem(LS_RECENT, JSON.stringify(rec.slice(0, 8)));
      } catch (e) {}
      saveLastPlace({
        path: "/tv/" + encodeURIComponent(id),
        channelId: String(id),
        tmdbId: null,
        mediaType: "live",
        title: (channelMap[id] && channelMap[id].name) || ("Channel " + id),
        season: null,
        episode: null,
      });
    }

    function updateHeader(meta, epgData) {
      const mapped = meta && channelMap[String(meta.channel_id)];
      if (mapped && mapped.logo && !(meta && meta.logo)) {
        meta = Object.assign({}, meta, { logo: mapped.logo });
      }
      headerMeta = meta;
      headerLayout = detectHeaderLayout();
      const name = meta.name || ("Channel " + meta.channel_id);
      const chSub = "Ch " + (meta.number || "?") + " / " + (meta.total || orderIds.length);
      const epg = epgData !== undefined ? epgData : getCachedEntry(epgCache, String(meta.channel_id));
      const parts = buildOnAirParts(name, epg, headerLayout);
      if (nowTitle) nowTitle.dataset.layout = headerLayout;
      if (chromeHdr) chromeHdr.dataset.layout = headerLayout;
      renderOnAirLine(nowOnAir, parts);
      renderOnAirLine(chromeOnAir, parts);
      nowSub.textContent = chSub;
      if (chromeSub) chromeSub.textContent = chSub;
      updateCinemaOverlay(meta, epg, currentTitleMeta);
      document.title = name + " — StepDaddyLiveHD";
      try {
        if (window.SDFeatures && typeof SDFeatures.syncMediaSession === "function") SDFeatures.syncMediaSession();
      } catch (e) {}
      simpleLink.href = "/play/" + encodeURIComponent(meta.channel_id);
      simpleLink.onclick = (e) => {
        try { localStorage.setItem(LS_GUIDE, "0"); } catch (err) {}
        try { sessionStorage.setItem("sd_return_guide", "1"); } catch (err) {}
      };
    }

    function setupHeaderResize() {
      if (!nowTitle || headerResizeObs) return;
      const refreshLayout = () => {
        if (!headerMeta) return;
        const next = detectHeaderLayout();
        if (next !== headerLayout) updateHeader(headerMeta);
        else updateHeader(headerMeta);
      };
      if (window.ResizeObserver) {
        headerResizeObs = new ResizeObserver(refreshLayout);
        headerResizeObs.observe(nowTitle);
      }
      window.addEventListener("resize", refreshLayout, { passive: true });
    }

    function buildHoverCardHtml(programme, meta, channelName, opts) {
      if (!programme || !programme.title) return "";
      const m = meta || {};
      const headline = programme.title || "";
      const series = m.matched_title && m.matched_title !== programme.title ? m.matched_title : "";
      const ep = programme.episode_label
        ? String(programme.episode_label).replace(/\s+/g, "")
        : (programme.season != null && programme.episode != null ? "S" + programme.season + "E" + programme.episode : "");
      const year = programme.year || m.year;
      const bits = [];
      if (series) bits.push(series);
      if (ep) bits.push(ep);
      if (year) bits.push(String(year));
      if (programme.start && programme.stop) bits.push(formatTimeRange(programme.start, programme.stop, false));
      if (programme.stop) bits.push(minsRemaining(programme.stop) + "m left");
      if (m.rating) bits.push(m.rating + "★");
      if (m.genres && m.genres.length) bits.push(m.genres.slice(0, 3).join(" · "));
      const poster = programme.poster_url || programme.image || m.poster_url || "";
      const logo = (opts && opts.logoUrl) || "";
      const overview = (m.overview || (isPlotLikeText(programme.subtitle) ? programme.subtitle : "") || "").trim();
      const castMembers = m.cast_members || [];
      let castHtml = "";
      if (castMembers.length) {
        castHtml = '<div class="cast">' + castMembers.slice(0, 4).map(c =>
          escapeHtml(c.name + (c.character ? " · " + c.character : ""))
        ).join(" · ") + "</div>";
      } else if (m.cast && m.cast.length) {
        castHtml = '<div class="cast">' + escapeHtml(m.cast.slice(0, 5).join(", ")) + "</div>";
      }
      let posterHtml;
      if (poster) {
        if (logo) {
          posterHtml = '<img class="poster" src="' + escapeHtml(poster) + '" alt="" loading="lazy" decoding="async" data-fallback="'
            + escapeHtml(logo) + '" onerror="var f=this.getAttribute(\'data-fallback\');if(f&&this.src!==f){this.src=f;this.removeAttribute(\'data-fallback\');return;}this.replaceWith(Object.assign(document.createElement(\'div\'),{className:\'poster ph\',textContent:\'🎬\'}));"/>';
        } else {
          posterHtml = '<img class="poster" src="' + escapeHtml(poster) + '" alt="" loading="lazy" decoding="async" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{className:\'poster ph\',textContent:\'🎬\'}))"/>';
        }
      } else if (opts && opts.loading) {
        posterHtml = '<div class="poster ph loading" aria-hidden="true">…</div>';
      } else if (logo) {
        posterHtml = '<img class="poster" src="' + escapeHtml(logo) + '" alt="" loading="lazy" decoding="async" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{className:\'poster ph\',textContent:\'🎬\'}))"/>';
      } else {
        posterHtml = '<div class="poster ph">🎬</div>';
      }
      let html = '<div class="inner">' + posterHtml + '<div class="body">';
      html += "<h3>" + escapeHtml(headline) + "</h3>";
      if (bits.length) html += '<div class="subline">' + escapeHtml(bits.join(" · ")) + "</div>";
      if (channelName) html += '<div class="subline">' + escapeHtml(channelName) + "</div>";
      if (overview) html += '<div class="overview">' + escapeHtml(overview) + "</div>";
      if (castHtml) html += castHtml;
      html += "</div></div>";
      return html;
    }

    function buildXrayPanelHtml(programme, meta, channelName) {
      if (!programme || !programme.title) return "";
      const m = meta || {};
      const headline = programme.title || "";
      const series = m.matched_title || programme.title || "";
      const ep = programme.episode_label
        ? String(programme.episode_label).replace(/\s+/g, "")
        : (programme.season != null && programme.episode != null ? "S" + programme.season + "E" + programme.episode : "");
      const metaBits = [];
      if (m.year || programme.year) metaBits.push(String(m.year || programme.year));
      if (m.genres && m.genres.length) metaBits.push(m.genres.slice(0, 2).join(" · "));
      if (m.seasons) metaBits.push(m.seasons + " seasons");
      if (programme.start && programme.stop) metaBits.push(formatTimeRange(programme.start, programme.stop, false));
      if (programme.stop) metaBits.push(minsRemaining(programme.stop) + " left");
      const backdrop = m.backdrop_url || programme.backdrop_url || m.poster_url || programme.poster_url || "";
      const poster = programme.poster_url || programme.image || m.poster_url || "";
      let html = '<div class="xray-hero">';
      if (backdrop) html += '<img class="backdrop" src="' + escapeHtml(backdrop) + '" alt="" loading="lazy"/>';
      html += '<div class="hero-shade"></div><div class="hero-main">';
      if (poster) html += '<img class="hero-poster" src="' + escapeHtml(poster) + '" alt="" loading="lazy"/>';
      html += '<div class="hero-text"><h2>' + escapeHtml(headline) + "</h2>";
      html += '<div class="meta-line">' + escapeHtml(series) + "</div>";
      if (ep || metaBits.length) html += '<div class="meta-line">' + escapeHtml([ep].concat(metaBits).filter(Boolean).join(" · ")) + "</div>";
      if (channelName) html += '<div class="meta-line">' + escapeHtml(channelName) + "</div>";
      html += "</div></div></div>";

      html += '<div class="xray-ratings">';
      if (m.rating) html += '<div class="pill">' + escapeHtml(String(m.rating)) + '★<small>' + escapeHtml(m.rating_source || "rating") + '</small></div>';
      if (m.imdb_url) html += '<div class="pill">IMDb<small>View on IMDb</small></div>';
      if (m.runtime_minutes) html += '<div class="pill">' + escapeHtml(String(m.runtime_minutes)) + 'm<small>runtime</small></div>';
      html += "</div>";

      html += buildXrayActionButtons(programme, m);

      if (m.overview) {
        html += '<div class="xray-section"><h4>OVERVIEW</h4><div class="xray-overview">' + escapeHtml(m.overview) + "</div></div>";
      }

      const castMembers = m.cast_members || [];
      if (castMembers.length) {
        html += '<div class="xray-section"><h4>CAST</h4><div class="xray-cast">';
        for (const c of castMembers.slice(0, 12)) {
          html += '<div class="xray-cast-row">';
          if (c.photo_url) html += '<img src="' + c.photo_url + '" alt="" loading="lazy"/>';
          else html += '<div class="ph">👤</div>';
          html += '<div><div class="name">' + escapeHtml(c.name || "") + '</div>';
          if (c.character) html += '<div class="role">' + escapeHtml(c.character) + "</div>";
          html += "</div></div>";
        }
        html += "</div></div>";
      }

      html += '<div class="xray-attrib">Information provided by TVmaze · Cinemeta / Metahub</div>';
      return html;
    }

    function openXrayPanel(html) {
      if (!xrayPanel || !xrayBackdrop || !html) return;
      hideTitleHoverCard(0);
      xrayScroll.innerHTML = html;
      xrayPanel.classList.add("open");
      xrayBackdrop.classList.add("show");
      xrayPanel.setAttribute("aria-hidden", "false");
      xrayBackdrop.setAttribute("aria-hidden", "false");
      xrayOpen = true;
      revealCollapsedChrome(true);
    }

    function setupXrayInteractions() {
      if (!xrayScroll || xrayScroll._xrayBound) return;
      xrayScroll._xrayBound = true;
      xrayScroll.addEventListener("click", (e) => {
        const trailerBtn = e.target.closest(".xray-trailer[data-youtube-id]");
        if (trailerBtn) {
          e.preventDefault();
          e.stopPropagation();
          playTrailerInPlayer(trailerBtn.dataset.youtubeId, "xray_trailer");
          return;
        }
        const vodBtn = e.target.closest(".xray-vod");
        if (vodBtn) {
          e.preventDefault();
          e.stopPropagation();
          openVodDetailFromXrayButton(vodBtn);
        }
      });
    }

    function closeXrayPanel() {
      if (!xrayPanel || !xrayBackdrop) return;
      xrayPanel.classList.remove("open");
      xrayBackdrop.classList.remove("show");
      xrayPanel.setAttribute("aria-hidden", "true");
      xrayBackdrop.setAttribute("aria-hidden", "true");
      xrayOpen = false;
    }

    async function openXrayForProgramme(prog, channelName) {
      if (!prog || !prog.title || prog.title === LIVE_PLACEHOLDER) return;
      let metaPayload = null;
      if (currentTitleMeta && currentTitleMeta.programme && currentTitleMeta.programme.start === prog.start) {
        metaPayload = currentTitleMeta;
      } else {
        metaPayload = await fetchMetaForProgramme(prog);
      }
      const meta = metaPayload && metaPayload.meta;
      const html = buildXrayPanelHtml(prog, meta, channelName);
      if (html) openXrayPanel(html);
    }

    async function openXrayForCurrentChannel() {
      if (currentTitleMeta && currentTitleMeta.programme) {
        const name = headerMeta ? headerMeta.name : "";
        const html = buildXrayPanelHtml(currentTitleMeta.programme, currentTitleMeta.meta, name);
        if (html) { openXrayPanel(html); return; }
      }
      const id = String((headerMeta && headerMeta.channel_id) || channelId);
      const data = await fetchMetaForChannel(id);
      updateMetaPosters(data);
      if (data && data.programme) {
        const name = headerMeta ? headerMeta.name : "";
        const html = buildXrayPanelHtml(data.programme, data.meta, name);
        if (html) openXrayPanel(html);
      }
    }

    function toggleXrayPanel() {
      if (xrayOpen) closeXrayPanel();
      else openXrayForCurrentChannel();
    }

    function escapeHtml(s) {
      return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function positionHoverCard(anchorEl) {
      if (!titleHoverCard || !anchorEl) return;
      const rect = anchorEl.getBoundingClientRect();
      const cardW = Math.min(320, window.innerWidth - 24);
      let left = Math.max(12, Math.min(rect.left, window.innerWidth - cardW - 12));
      let top = rect.bottom + 8;
      const estimatedH = 180;
      if (top + estimatedH > window.innerHeight - 12) top = Math.max(12, rect.top - estimatedH - 8);
      titleHoverCard.style.width = cardW + "px";
      titleHoverCard.style.left = left + "px";
      titleHoverCard.style.top = top + "px";
    }

    function showTitleHoverCard(anchorEl, html) {
      if (!titleHoverCard || !html) return;
      clearTimeout(hoverHideTimer);
      clearTimeout(hoverShowTimer);
      titleHoverCard.innerHTML = html;
      positionHoverCard(anchorEl);
      titleHoverCard.classList.add("show");
      titleHoverCard.setAttribute("aria-hidden", "false");
    }

    function hideTitleHoverCard(delay) {
      clearTimeout(hoverHideTimer);
      hoverHideTimer = setTimeout(() => {
        if (titleHoverCard) {
          titleHoverCard.classList.remove("show");
          titleHoverCard.setAttribute("aria-hidden", "true");
        }
      }, delay || 100);
    }

    function progMetaCacheKey(prog) {
      return [
        prog.title || "",
        prog.programme_type || prog.category || "",
        prog.year || "",
        prog.season || "",
        prog.episode || "",
        prog.subtitle || ""
      ].join("|");
    }

    async function fetchMetaForProgramme(prog) {
      const key = progMetaCacheKey(prog);
      if (progMetaCache.has(key)) return progMetaCache.get(key);
      const params = new URLSearchParams();
      params.set("title", prog.title || "");
      params.set("programme_type", prog.programme_type || prog.category || "other");
      if (prog.year) params.set("year", String(prog.year));
      if (prog.season) params.set("season", String(prog.season));
      if (prog.episode) params.set("episode", String(prog.episode));
      if (prog.subtitle) params.set("subtitle", prog.subtitle);
      if (prog.poster_url) params.set("poster_url", prog.poster_url);
      try {
        const r = await authFetch("/meta/programme?" + params.toString(), { cache: "no-store" });
        if (!r.ok) return null;
        const data = await r.json();
        // Prefer EPG art when meta still lacks a poster.
        if (prog.poster_url && data && data.meta && !data.meta.poster_url) {
          data.meta.poster_url = prog.poster_url;
          data.has_data = true;
        }
        progMetaCache.set(key, data);
        return data;
      } catch (e) {
        return null;
      }
    }

    async function showHoverForProgramme(prog, anchorEl, channelName) {
      if (!prog || !prog.title || prog.title === LIVE_PLACEHOLDER) return;
      const ch = (anchorEl && anchorEl.dataset && anchorEl.dataset.chId)
        ? (channelMap[anchorEl.dataset.chId] || {})
        : {};
      const logoUrl = (ch && ch.logo) || channelLogoUrl(headerMeta) || "";
      // Instant card: EPG poster or loading — never empty dark box.
      const pending = !(prog.poster_url || (currentTitleMeta && currentTitleMeta.programme
        && currentTitleMeta.programme.start === prog.start && currentTitleMeta.meta && currentTitleMeta.meta.poster_url));
      const bootHtml = buildHoverCardHtml(prog, null, channelName, { logoUrl, loading: pending && !logoUrl });
      if (bootHtml) showTitleHoverCard(anchorEl, bootHtml);
      let metaPayload = null;
      if (currentTitleMeta && currentTitleMeta.programme && currentTitleMeta.programme.start === prog.start) {
        metaPayload = currentTitleMeta;
      } else {
        metaPayload = await fetchMetaForProgramme(prog);
      }
      const meta = metaPayload && metaPayload.meta;
      const html = buildHoverCardHtml(prog, meta, channelName, { logoUrl });
      if (html) showTitleHoverCard(anchorEl, html);
    }

    function setupTitleHover() {
      const onEnter = (e) => {
        if (xrayOpen) return;
        const el = e.target.closest(".meta-hover-target");
        if (!el) return;
        clearTimeout(hoverShowTimer);
        hoverShowTimer = setTimeout(async () => {
          if (el.classList.contains("hdr-title")) {
            if (!currentTitleMeta || !currentTitleMeta.programme) return;
            const name = headerMeta ? headerMeta.name : "";
            const html = buildHoverCardHtml(currentTitleMeta.programme, currentTitleMeta.meta, name, {
              logoUrl: channelLogoUrl(headerMeta) || "",
            });
            if (html) showTitleHoverCard(el, html);
            return;
          }
          if (el.classList.contains("prog-cell") && el._progData) {
            const ch = channelMap[el.dataset.chId] || { name: "Channel " + el.dataset.chId };
            await showHoverForProgramme(el._progData, el, ch.name);
          }
        }, 120);
      };
      const onLeave = (e) => {
        const el = e.target.closest(".meta-hover-target");
        if (!el) return;
        clearTimeout(hoverShowTimer);
        hideTitleHoverCard(80);
      };
      if (nowOnAir) {
        nowOnAir.addEventListener("mouseover", onEnter);
        nowOnAir.addEventListener("mouseout", onLeave);
      }
      if (chromeOnAir) {
        chromeOnAir.addEventListener("mouseover", onEnter);
        chromeOnAir.addEventListener("mouseout", onLeave);
      }
      if (gridWrap) {
        gridWrap.addEventListener("mouseover", onEnter);
        gridWrap.addEventListener("mouseout", onLeave);
      }
      document.addEventListener("scroll", () => hideTitleHoverCard(0), true);
      if (titleHoverCard) {
        titleHoverCard.addEventListener("mouseenter", () => clearTimeout(hoverHideTimer));
        titleHoverCard.addEventListener("mouseleave", () => hideTitleHoverCard(80));
      }
      const onTitleClick = (e) => {
        const el = e.target.closest(".hdr-title, .hdr-poster.show");
        if (!el || !currentTitleMeta || !currentTitleMeta.programme) return;
        e.preventDefault();
        e.stopPropagation();
        openXrayForCurrentChannel();
      };
      const onChannelLabelClick = (e) => {
        const el = e.target.closest(".hdr-ch");
        if (!el) return;
        openChannelInfo(e);
      };
      const onChannelLabelKey = (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const el = e.target.closest(".hdr-ch");
        if (!el) return;
        openChannelInfo(e);
      };
      if (nowOnAir) {
        nowOnAir.addEventListener("click", onTitleClick);
        nowOnAir.addEventListener("click", onChannelLabelClick);
        nowOnAir.addEventListener("keydown", onChannelLabelKey);
      }
      if (chromeOnAir) {
        chromeOnAir.addEventListener("click", onTitleClick);
        chromeOnAir.addEventListener("click", onChannelLabelClick);
        chromeOnAir.addEventListener("keydown", onChannelLabelKey);
      }
      if (hdrPoster) hdrPoster.addEventListener("click", (e) => openChannelInfo(e));
      if (chromePoster) chromePoster.addEventListener("click", (e) => openChannelInfo(e));
      if (xrayBtn) xrayBtn.addEventListener("click", (e) => { e.preventDefault(); toggleXrayPanel(); });
      if (xrayClose) xrayClose.addEventListener("click", closeXrayPanel);
      if (xrayBackdrop) xrayBackdrop.addEventListener("click", closeXrayPanel);
      if (trailerBackBtn) trailerBackBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (liveEmbedActive) {
          // Leave Clappr embed and return to the MSE /live path cleanly.
          returnToLiveFromEmbed("back-btn");
          return;
        }
        stopOverlayPlayback();
      });
      if (liveEmbedGuideHotspot) {
        liveEmbedGuideHotspot.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!liveEmbedActive) return;
          hideCinemaInfoOverlay();
          if (!guideCollapsed) applyGuideState(true);
          else applyGuideState(false);
        });
      }
      setupXrayInteractions();
      document.addEventListener("keydown", (e) => {
        if (trailerActive && e.key === "Escape") { e.preventDefault(); stopOverlayPlayback(); return; }
        if (e.key === "Escape" && xrayOpen) { e.preventDefault(); closeXrayPanel(); return; }
        if (e.key === "i" || e.key === "I") {
          if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
          e.preventDefault();
          toggleXrayPanel();
        }
      });
    }

    function updateMetaPosters(metaPayload) {
      currentTitleMeta = metaPayload;
      const prog = metaPayload && metaPayload.programme;
      const url = programmePosterUrl(prog, metaPayload);
      const logo = channelLogoUrl(headerMeta);
      const apply = (img) => {
        if (!img) return;
        setPosterImage(img, url || logo || "", () => {
          img.classList.remove("show");
          img.removeAttribute("src");
        });
      };
      apply(hdrPoster);
      apply(chromePoster);
      if (headerMeta) updateCinemaOverlay(headerMeta, undefined, metaPayload);
      try {
        if (window.SDFeatures && typeof SDFeatures.syncMediaSession === "function") SDFeatures.syncMediaSession();
      } catch (e) {}
    }

    async function fetchMetaForChannel(id) {
      try {
        const r = await authFetch("/meta/now/" + encodeURIComponent(id), { cache: "no-store" });
        if (!r.ok) return null;
        return await r.json();
      } catch (e) {
        return null;
      }
    }

    async function refreshCurrentMeta() {
      const id = String((headerMeta && headerMeta.channel_id) || channelId);
      const epg = getCachedEntry(epgCache, id);
      const epgNow = epg && epg.now;
      // Show loading / EPG art immediately so cinema info isn't an empty box.
      if (headerMeta && epgNow && epgNow.title && epgNow.title !== LIVE_PLACEHOLDER) {
        updateMetaPosters({
          channel_id: id,
          has_data: !!(epgNow.poster_url),
          programme: epgNow,
          meta: epgNow.poster_url ? { poster_url: epgNow.poster_url, matched_title: epgNow.title } : null,
          _posterPending: !epgNow.poster_url,
        });
      }
      let data = await fetchMetaForChannel(id);
      const hasPoster = !!(data && data.has_data && data.meta && data.meta.poster_url)
        || !!(data && data.programme && data.programme.poster_url);
      // Gapless client fallback: EPG now title → /meta/programme (Metahub/Cinemeta).
      if (!hasPoster) {
        const prog = (data && data.programme) || epgNow || null;
        if (prog && prog.title && prog.title !== LIVE_PLACEHOLDER) {
          const progMeta = await fetchMetaForProgramme(prog);
          if (progMeta && progMeta.meta && progMeta.meta.poster_url) {
            data = {
              channel_id: id,
              has_data: true,
              programme: prog,
              meta: progMeta.meta,
            };
          } else if (!data) {
            data = {
              channel_id: id,
              has_data: false,
              programme: prog,
              meta: (progMeta && progMeta.meta) || null,
            };
          }
        }
      }
      if (data) data._posterPending = false;
      updateMetaPosters(data);
      return data;
    }

    async function refreshCurrentHeaderEpg(opts) {
      if (!headerMeta) return null;
      const id = String(headerMeta.channel_id || channelId);
      const epgData = await fetchEpgForChannel(id, opts || {});
      updateHeader(headerMeta, epgData);
      await refreshCurrentMeta();
      return epgData;
    }

    async function loadNeighbors(id) {
      const r = await authFetch("/channels/neighbors/" + encodeURIComponent(id));
      if (!r.ok) throw new Error("not_found");
      return r.json();
    }

    async function loadSwitchMeta(id) {
      // Neighbors is preferred (prev/next + name). Fall back to /live/.../meta so a
      // neighbors 500 never bricks colon-id (iptv:/freetv:) tunes.
      try {
        return await loadNeighbors(id);
      } catch (e) {
        const live = await fetchLiveEmbedMeta(id);
        if (live && live.stream_url) {
          return {
            channel_id: String(live.channel_id || id),
            name: (channelMap[id] && channelMap[id].name) || String(id),
            stream_url: live.stream_url,
            source: live.source,
            provider: live.provider,
          };
        }
        return {
          channel_id: String(id),
          name: (channelMap[id] && channelMap[id].name) || String(id),
          stream_url: "/live/" + encodeURIComponent(id) + ".m3u8",
        };
      }
    }

    let lastSwitchFailId = "";
    let lastSwitchFailAt = 0;
    async function switchChannel(targetId, opts) {
      opts = opts || {};
      const resolvedId = resolveSelectableChannelId(targetId);
      if (!resolvedId || (resolvedId === channelId && !opts.force) || switching) return;
      // One fail toast per id for a short window — blocks party/guide retry spam.
      if (
        !opts.force &&
        resolvedId === lastSwitchFailId &&
        (Date.now() - lastSwitchFailAt) < 12000
      ) {
        return;
      }
      stopOverlayPlayback();
      switching = true;
      try {
        const meta = await loadSwitchMeta(resolvedId);
        channelId = String(meta.channel_id || resolvedId);
        // Tuning a supplement must not inherit DDL /content CDN thrash guard.
        if (isSupplementChannel(channelId)) clearLiveCdnPlaybackGuard();
        const idx = orderIds.indexOf(channelId);
        if (idx >= 0) focusIdx = idx;
        saveLastChannel(channelId);
        history.replaceState(null, "", tvChannelUrl(channelId));
        updateHeader(meta);
        simpleLink.href = "/play/" + encodeURIComponent(channelId);
        updateMetaPosters(null);
        closeXrayPanel();
        await attachHls(meta.stream_url || ("/live/" + encodeURIComponent(channelId) + ".m3u8"));
        lastSwitchFailId = "";
        lastSwitchFailAt = 0;
        // Channel change re-syncs guide to now (even after a manual pan).
        guideFollowNow = true;
        guideUserPanned = false;
        clearTimeout(guideNowIdleTimer);
        renderGrid();
        scrollToFocus();
        scrollGuideToNow({ force: true });
        // Kick now-next for tuned + neighbors immediately (before full window).
        try {
          prefetchChannelEpg(channelId);
          const nIdx = orderIds.indexOf(channelId);
          if (nIdx >= 0) {
            if (orderIds[nIdx - 1]) prefetchChannelEpg(orderIds[nIdx - 1]);
            if (orderIds[nIdx + 1]) prefetchChannelEpg(orderIds[nIdx + 1]);
          }
        } catch (e) {}
        if (!opts.skipEpg) {
          await prefetchEpgWindow();
          await refreshCurrentHeaderEpg();
        }
        // Show info AFTER guide scroll/EPG work — those used to dismiss the bar mid-tune.
        cinemaInfoLastKey = "";
        try {
          updateCinemaOverlay(headerMeta || meta, undefined, currentTitleMeta, true);
        } catch (e) {}
        showCinemaInfoOverlay({ force: true, autoHide: true, ms: 6500 });
        try {
          if (window.SDParty && typeof SDParty.broadcastContent === "function") SDParty.broadcastContent();
          if (window.SDParty && typeof SDParty.ensureUi === "function") SDParty.ensureUi();
        } catch (e) {}
      } catch (e) {
        lastSwitchFailId = resolvedId;
        lastSwitchFailAt = Date.now();
        showErr("Could not switch to channel " + resolvedId);
      } finally {
        switching = false;
      }
    }

    function buildTimeHeader() {
      const now = Date.now();
      gridStartMs = snapGridStart(new Date(now));
      dayLabel.textContent = fmtDay(new Date(now));
      timeRow.innerHTML = "";
      focusSlot = Math.max(0, Math.min(NUM_SLOTS - 1, slotIndexForNow(now)));
      for (let i = 0; i < NUM_SLOTS; i++) {
        const t = new Date(gridStartMs + i * SLOT_MS);
        const el = document.createElement("div");
        el.className = "time-slot" + (i === focusSlot ? " now" : "");
        el.style.flex = "0 0 " + SLOT_W() + "px";
        el.textContent = fmtTime(t);
        timeRow.appendChild(el);
      }
      const totalW = NUM_SLOTS * SLOT_W();
      timeRow.style.width = totalW + "px";
      gridWrap.style.width = totalW + "px";
    }

    function logoHtml(ch) {
      const letter = ((ch && ch.name) || "?").trim().charAt(0).toUpperCase() || "T";
      if (ch && ch.logo) {
        return (
          '<img class="ch-logo" src="' +
          ch.logo +
          '" alt="" loading="lazy" decoding="async" data-ph="' +
          letter +
          '" onerror="var l=this.getAttribute(\'data-ph\')||\'T\';this.onerror=null;this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'ch-logo ph\',textContent:l}))"/>'
        );
      }
      return '<span class="ch-logo ph">' + letter + '</span>';
    }

    function programCellsForChannel(id, rowFocused) {
      const totalW = NUM_SLOTS * SLOT_W();
      const cells = [];
      const schedule = getCachedEntry(scheduleCache, id);
      const ch = channelMap[id] || { name: "Channel " + id };
      const nowMs = Date.now();
      const gridEndMs = gridStartMs + NUM_SLOTS * SLOT_MS;

      if (schedule && schedule.has_data && Array.isArray(schedule.programmes) && schedule.programmes.length) {
        for (const prog of schedule.programmes) {
          if (!prog.start || !prog.stop) continue;
          const st = new Date(prog.start).getTime();
          const sp = new Date(prog.stop).getTime();
          if (sp <= gridStartMs || st >= gridEndMs) continue;
          const box = layoutProgrammeCell(st, sp, totalW);
          if (!box) continue;
          const label = formatGridProgrammeLabel(prog, box.width);
          const slotStart = Math.floor((Math.max(st, gridStartMs) - gridStartMs) / SLOT_MS);
          const slotEnd = Math.ceil((Math.min(sp, gridEndMs) - gridStartMs) / SLOT_MS);
          const focused = rowFocused && focusSlot >= slotStart && focusSlot < slotEnd;
          const live = st <= nowMs && nowMs < sp;
          cells.push({ left: box.left, width: box.width, title: label.primary, clock: label.clock, focused, live, prog });
        }
      }

      if (!cells.length) {
        const data = getCachedEntry(epgCache, id);
        if (data && data.now && data.now.start && data.now.stop) {
          const st = new Date(data.now.start).getTime();
          const sp = new Date(data.now.stop).getTime();
          const box = layoutProgrammeCell(st, sp, totalW);
          if (box) {
            const label = formatGridProgrammeLabel(data.now, box.width);
            const focused = rowFocused && focusSlot >= Math.floor((Math.max(st, gridStartMs) - gridStartMs) / SLOT_MS) && focusSlot < Math.ceil((Math.min(sp, gridEndMs) - gridStartMs) / SLOT_MS);
            cells.push({ left: box.left, width: box.width, title: label.primary, clock: label.clock, focused, live: st <= nowMs && nowMs < sp, prog: data.now });
          }
          if (data.next && data.next.start && data.next.stop) {
            const nst = new Date(data.next.start).getTime();
            const nsp = new Date(data.next.stop).getTime();
            const nbox = layoutProgrammeCell(nst, nsp, totalW);
            if (nbox) {
              const nfocused = rowFocused && focusSlot >= Math.floor((Math.max(nst, gridStartMs) - gridStartMs) / SLOT_MS);
              const nlabel = formatGridProgrammeLabel(data.next, nbox.width);
              cells.push({ left: nbox.left, width: nbox.width, title: nlabel.primary, clock: nlabel.clock, focused: nfocused, live: false, prog: data.next });
            }
          }
        } else {
          const slot = Math.max(0, slotIndexForNow(nowMs));
          const left = slot * SLOT_W();
          const width = SLOT_W() * 2;
          cells.push({ left, width, title: LIVE_PLACEHOLDER, clock: "", focused: rowFocused, live: true, placeholder: true });
        }
      }
      return cells;
    }

    function windowRange() {
      const rowH = Math.max(1, ROW_H());
      const viewportRows = Math.max(
        VISIBLE_ROWS,
        Math.ceil(((gridScroll && gridScroll.clientHeight) || 320) / rowH) + 1
      );
      // Visible scroll window first. Only fold focus in when it is nearby —
      // never bridge a multi-thousand-row gap (that stormed EPG APIs → all LIVE).
      let start = Math.max(0, viewStart - GUIDE_OVERSCAN);
      let end = Math.min(orderIds.length, viewStart + viewportRows + GUIDE_OVERSCAN);
      if (focusIdx >= 0 && focusIdx < orderIds.length) {
        const near = Math.abs(focusIdx - viewStart) <= (viewportRows + GUIDE_OVERSCAN * 2);
        if (near) {
          start = Math.min(start, Math.max(0, focusIdx - GUIDE_OVERSCAN));
          end = Math.max(end, Math.min(orderIds.length, focusIdx + 1 + GUIDE_OVERSCAN));
        }
      }
      if (end - start > MAX_GUIDE_EPG_ROWS) {
        start = Math.max(0, viewStart - GUIDE_OVERSCAN);
        end = Math.min(orderIds.length, start + MAX_GUIDE_EPG_ROWS);
      }
      start = Math.max(0, Math.min(start, Math.max(0, orderIds.length - 1)));
      end = Math.max(start, Math.min(orderIds.length, end));
      return { start, end, viewportRows };
    }

    function renderGrid(opts) {
      opts = opts || {};
      const token = ++renderToken;
      const preserveScroll = opts.preserveScroll !== false && !opts.scrollToFocus;
      const savedTop = gridScroll ? gridScroll.scrollTop : 0;
      const savedLeft = gridScroll ? gridScroll.scrollLeft : 0;
      buildTimeHeader();
      const { start, end } = windowRange();
      const totalH = orderIds.length * ROW_H();
      chWrap.style.height = totalH + "px";
      gridWrap.style.height = totalH + "px";

      const chFrag = document.createDocumentFragment();
      const gridFrag = document.createDocumentFragment();
      const totalW = NUM_SLOTS * SLOT_W();

      for (let i = start; i < end; i++) {
        const id = orderIds[i];
        const ch = channelMap[id] || { id, name: "Channel " + id };
        const rowFocused = i === focusIdx;
        const rowBlocked = isChannelCdnBlocked(id);
        const top = i * ROW_H();

        const chRow = document.createElement("div");
        chRow.className = "epg-row" + (rowBlocked ? " cdn-blocked" : "");
        chRow.style.position = "absolute";
        chRow.style.top = top + "px";
        chRow.style.left = "0";
        chRow.style.right = "0";
        const chCell = document.createElement("div");
        chCell.className = "ch-cell" + (rowFocused ? " focused" : "") + (rowBlocked ? " cdn-blocked" : "");
        if (rowBlocked) {
          chCell.title = "CDN blocked / unavailable";
          chCell.setAttribute("aria-disabled", "true");
        }
        const chNum = ch.number || ch.channel_number || id;
        chCell.innerHTML = '<span class="ch-dot"></span><span class="ch-num-badge"></span>' + logoHtml(ch) + '<span class="ch-name"></span>';
        chCell.querySelector(".ch-num-badge").textContent = chNum;
        chCell.querySelector(".ch-name").textContent = ch.name;
        chCell.addEventListener("click", () => { focusIdx = i; switchChannel(id); });
        chRow.appendChild(chCell);
        chFrag.appendChild(chRow);

        const progRow = document.createElement("div");
        progRow.className = "prog-row" + (rowBlocked ? " cdn-blocked" : "");
        progRow.style.position = "absolute";
        progRow.style.top = top + "px";
        progRow.style.width = totalW + "px";
        for (let s = 1; s < NUM_SLOTS; s++) {
          const line = document.createElement("div");
          line.className = "grid-line";
          line.style.left = (s * SLOT_W()) + "px";
          progRow.appendChild(line);
        }
        const cells = programCellsForChannel(id, rowFocused);
        for (const c of cells) {
          const cell = document.createElement("div");
          cell.className = "prog-cell" + (c.live ? " live" : "") + (c.focused ? " focused" : "") + (c.prog ? " meta-hover-target" : "") + (rowBlocked ? " cdn-blocked" : "");
          cell.style.left = c.left + "px";
          cell.style.width = c.width + "px";
          let primary = c.title || "";
          let clock = c.clock || "";
          if (rowBlocked) primary = "Blocked · " + primary;
          else if (c.placeholder) {
            primary = currentTheme === "broadcast" ? "LIVE" : LIVE_PLACEHOLDER;
            clock = "";
          }
          // One primary title + optional secondary time — never stack LIVE/clock prefixes.
          cell.textContent = "";
          const titleEl = document.createElement("span");
          titleEl.className = "prog-title";
          titleEl.textContent = primary;
          cell.appendChild(titleEl);
          // Hide secondary clock when the cell is too narrow for both lines.
          if (clock && c.width >= 110) {
            const timeEl = document.createElement("span");
            timeEl.className = "prog-time";
            timeEl.textContent = clock;
            cell.appendChild(timeEl);
          } else {
            cell.classList.add("prog-cell--title-only");
          }
          cell.title = clock ? (primary + " · " + clock) : primary;
          cell.dataset.chId = id;
          if (c.prog) cell._progData = c.prog;
          cell.addEventListener("click", (ev) => {
            if (ev.detail > 1 && c.prog) {
              ev.preventDefault();
              const ch = channelMap[id] || { name: "Channel " + id };
              openXrayForProgramme(c.prog, ch.name);
              return;
            }
            focusIdx = i;
            switchChannel(id);
          });
          progRow.appendChild(cell);
        }
        gridFrag.appendChild(progRow);
      }

      chWrap.innerHTML = "";
      gridWrap.innerHTML = "";
      chWrap.appendChild(chFrag);
      gridWrap.appendChild(gridFrag);

      syncScroll = true;
      if (opts.scrollToFocus) {
        const rowH = Math.max(1, ROW_H());
        const viewH = Math.max(
          rowH,
          (gridScroll && gridScroll.clientHeight) || 0,
          (chScroll && chScroll.clientHeight) || 0,
          Math.round((VISIBLE_ROWS * rowH) / 2)
        );
        const rowsInView = Math.max(1, Math.floor(viewH / rowH));
        const top = Math.max(0, focusIdx * rowH - Math.floor(rowsInView / 2) * rowH);
        viewStart = Math.floor(top / rowH);
        chScroll.scrollTop = top;
        gridScroll.scrollTop = top;
        if (guideFollowNow || opts.scrollToNow) {
          const left = guideNowScrollLeft();
          gridScroll.scrollLeft = left;
          if (timeRow) timeRow.style.transform = "translate3d(" + (-left) + "px,0,0)";
        }
      } else if (preserveScroll) {
        chScroll.scrollTop = savedTop;
        gridScroll.scrollTop = savedTop;
        if (guideFollowNow && opts.preserveScroll !== "xy") {
          // Keep vertical position; re-align time to now unless user panned away.
          const left = guideNowScrollLeft();
          gridScroll.scrollLeft = left;
          if (timeRow) timeRow.style.transform = "translate3d(" + (-left) + "px,0,0)";
        } else {
          gridScroll.scrollLeft = savedLeft;
          if (timeRow) timeRow.style.transform = "translate3d(" + (-savedLeft) + "px,0,0)";
        }
      }
      syncScroll = false;
      if (token !== renderToken) return;
    }

    function scrollToFocus() {
      renderGrid({ scrollToFocus: true, scrollToNow: true });
    }

    async function fetchEpgForChannel(id, opts = {}) {
      const force = opts.force === true;
      if (!force) {
        const cached = getCachedEntry(epgCache, id, { allowStale: true });
        if (cached && isCacheFresh(epgCache, id)) return cached;
        if (cached && !opts.revalidate) return cached;
      }
      const key = "epg:" + id;
      if (epgInflight.has(key)) return epgInflight.get(key);
      const signal = opts.signal;
      const task = (async () => {
        try {
          const r = await authFetch("/epg/now-next/" + encodeURIComponent(id), {
            cache: "no-store",
            signal,
          });
          if (!r.ok) return getCachedEntry(epgCache, id, { allowStale: true });
          const data = await r.json();
          setCachedEntry(epgCache, id, data, EPG_NOW_TTL_MS);
          return data;
        } catch (e) {
          if (e && (e.name === "AbortError" || signal && signal.aborted)) {
            return getCachedEntry(epgCache, id, { allowStale: true });
          }
          return getCachedEntry(epgCache, id, { allowStale: true });
        } finally {
          epgInflight.delete(key);
        }
      })();
      epgInflight.set(key, task);
      return task;
    }

    async function fetchScheduleForChannel(id, opts = {}) {
      const force = opts.force === true;
      const hours = opts.hours || EPG_SCHEDULE_HOURS;
      if (!force) {
        const cached = getCachedEntry(scheduleCache, id, { allowStale: true });
        if (cached && isCacheFresh(scheduleCache, id)) return cached;
        if (cached && !opts.revalidate) return cached;
      }
      const key = "schedule:" + id + ":" + hours;
      if (epgInflight.has(key)) return epgInflight.get(key);
      const signal = opts.signal;
      const task = (async () => {
        try {
          const r = await authFetch(
            "/epg/schedule/" + encodeURIComponent(id) + "?hours=" + encodeURIComponent(hours),
            { cache: "no-store", signal }
          );
          if (!r.ok) return getCachedEntry(scheduleCache, id, { allowStale: true });
          const data = await r.json();
          setCachedEntry(scheduleCache, id, data, EPG_SCHEDULE_TTL_MS);
          return data;
        } catch (e) {
          if (e && (e.name === "AbortError" || signal && signal.aborted)) {
            return getCachedEntry(scheduleCache, id, { allowStale: true });
          }
          return getCachedEntry(scheduleCache, id, { allowStale: true });
        } finally {
          epgInflight.delete(key);
        }
      })();
      epgInflight.set(key, task);
      return task;
    }

    function channelEpgIsSlow(id) {
      const sid = String(id || "");
      if (!sid) return false;
      if (epgSlowIds.has(sid)) return true;
      const ch = channelMap[sid];
      if (!ch) return false;
      const tvg = String(ch.tvg_id || "");
      if (tvg.startsWith("pluto:") || tvg.startsWith("epgpw:")) return true;
      const name = String(ch.name || "");
      if (/\bpluto\b/i.test(name)) return true;
      const src = String(ch.source || "").toLowerCase();
      if (src === "pluto" || src.indexOf("epgpw") >= 0) return true;
      return false;
    }

    function noteEpgSlow(id, row) {
      const sid = String(id || "");
      if (!sid) return;
      if (row && row.fill_pending) {
        epgSlowIds.add(sid);
        return;
      }
      if (channelEpgIsSlow(sid)) epgSlowIds.add(sid);
    }

    function getTopNetworkIds(limit) {
      const lim = Math.max(1, limit || 24);
      const favs = (getFavorites() || [])
        .map((x) => String((x && x.id) || x || ""))
        .filter((id) => id && channelLikelyHasEpg(id));
      if (favs.length) return favs.slice(0, lim);
      const hits = [];
      for (const id of orderIds) {
        const ch = channelMap[id];
        if (!ch || !channelLikelyHasEpg(id)) continue;
        if (TOP_NETWORK_NAME_RE.test(String(ch.name || ""))) hits.push(id);
        if (hits.length >= lim) break;
      }
      return hits;
    }

    function buildEpgPriorityQueue(opts) {
      opts = opts || {};
      const includeIdle = opts.includeIdle === true;
      const maxIds = Math.max(1, opts.max || Math.min(MAX_GUIDE_EPG_ROWS, EPG_BATCH_MAX));
      const scored = new Map();
      const bump = (id, tier) => {
        if (!id || !channelLikelyHasEpg(id)) return;
        const sid = String(id);
        const slow = channelEpgIsSlow(sid);
        const rank = tier + (slow ? EPG_SLOW_BOOST : 0);
        const prev = scored.get(sid);
        if (prev == null || rank < prev) scored.set(sid, rank);
      };

      const tunedId = String(channelId || orderIds[focusIdx] || "");
      // 1. Currently displayed / tuned
      bump(tunedId, EPG_TIER.TUNED);

      const { start, end, viewportRows } = windowRange();
      const fIdx = tunedId ? orderIds.indexOf(tunedId) : focusIdx;
      // 2. Visible schedule window — focus neighbors + on-screen rows
      if (fIdx >= 0) {
        for (let d = 1; d <= 2; d++) {
          bump(orderIds[fIdx - d], EPG_TIER.VISIBLE);
          bump(orderIds[fIdx + d], EPG_TIER.VISIBLE);
        }
      }
      const visEnd = Math.min(orderIds.length, viewStart + viewportRows);
      for (let i = viewStart; i < visEnd; i++) bump(orderIds[i], EPG_TIER.VISIBLE);

      // 3. Recently watched
      try {
        for (const r of getRecents() || []) {
          bump((r && r.id) || r, EPG_TIER.RECENT);
        }
      } catch (e) {}

      // 4. Top networks (favorites or curated brands)
      for (const id of getTopNetworkIds(24)) bump(id, EPG_TIER.TOP);

      // 5. Scroll-ahead / nearby offscreen buffer
      if (epgScrollDir > 0) {
        for (let i = end; i < Math.min(orderIds.length, end + EPG_SCROLL_AHEAD); i++) {
          bump(orderIds[i], EPG_TIER.SCROLL);
        }
      } else if (epgScrollDir < 0) {
        for (let i = Math.max(0, start - EPG_SCROLL_AHEAD); i < start; i++) {
          bump(orderIds[i], EPG_TIER.SCROLL);
        }
      } else {
        for (let i = end; i < Math.min(orderIds.length, end + 2); i++) bump(orderIds[i], EPG_TIER.SCROLL);
        for (let i = Math.max(0, start - 2); i < start; i++) bump(orderIds[i], EPG_TIER.SCROLL);
      }
      // Overscan rows already in windowRange but outside strict viewport
      for (let i = start; i < end; i++) {
        if (i < viewStart || i >= visEnd) bump(orderIds[i], EPG_TIER.SCROLL);
      }

      // 6. Everything else — idle fill (optional; scheduled separately)
      if (includeIdle) {
        for (const id of orderIds) bump(id, EPG_TIER.IDLE);
      }

      return Array.from(scored.entries())
        .sort((a, b) => a[1] - b[1] || String(a[0]).localeCompare(String(b[0])))
        .map((x) => x[0])
        .slice(0, maxIds);
    }

    // Back-compat alias used by older call sites / mental model.
    function prioritizeEpgIds(ids, focusId) {
      const q = buildEpgPriorityQueue({ max: Math.min(MAX_GUIDE_EPG_ROWS, EPG_BATCH_MAX) });
      if (focusId) {
        const sid = String(focusId);
        if (q[0] !== sid && channelLikelyHasEpg(sid)) {
          q.unshift(sid);
          return q.slice(0, Math.min(MAX_GUIDE_EPG_ROWS, EPG_BATCH_MAX));
        }
      }
      if (ids && ids.length) {
        for (const id of ids) {
          if (q.indexOf(String(id)) < 0 && channelLikelyHasEpg(id)) q.push(String(id));
        }
      }
      return q.slice(0, Math.min(MAX_GUIDE_EPG_ROWS, EPG_BATCH_MAX));
    }

    function idsNeedingFetch(cache, ids, force) {
      if (force) return ids.slice();
      return ids.filter((id) => !isCacheFresh(cache, id));
    }

    function cacheBatchRow(cache, id, row, freshTtl) {
      if (!row) return false;
      noteEpgSlow(id, row);
      const pending = !!row.fill_pending;
      // Pending → short TTL so client re-asks after async fill. Confirmed empty
      // (no pending) uses normal TTL so we do not hammer the server.
      const ttl = pending ? EPG_PENDING_TTL_MS : freshTtl;
      setCachedEntry(cache, id, row, ttl);
      return pending;
    }

    function scheduleEpgPendingRetry() {
      if (epgPendingRetryTimer) return;
      epgPendingRetryTimer = setTimeout(() => {
        epgPendingRetryTimer = null;
        prefetchEpgWindow();
      }, EPG_PENDING_TTL_MS + 200);
    }

    function scheduleEpgIdleFill() {
      if (epgIdleTimer) return;
      epgIdleTimer = setTimeout(() => {
        epgIdleTimer = null;
        if (document.visibilityState === "hidden") return;
        runEpgPriorityQueue({ includeIdle: true, idleOnly: true, force: false });
      }, 1200);
    }

    async function fetchNowNextBatch(ids, opts = {}) {
      const force = opts.force === true;
      const signal = opts.signal;
      const wanted = idsNeedingFetch(epgCache, ids, force);
      if (!wanted.length) return { pending: false };
      const key = "epg-batch:" + wanted.join(",");
      if (epgInflight.has(key)) {
        await epgInflight.get(key);
        return { pending: false };
      }
      let anyPending = false;
      const task = (async () => {
        try {
          const r = await authFetch("/epg/now-next/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channel_ids: wanted }),
            cache: "no-store",
            signal,
          });
          if (!r.ok) throw new Error("batch_now_next_" + r.status);
          const data = await r.json();
          const channels = (data && data.channels) || {};
          for (const id of wanted) {
            const row = channels[id];
            if (cacheBatchRow(epgCache, id, row, EPG_NOW_TTL_MS)) anyPending = true;
          }
          if (data && data.fill_pending_count > 0) anyPending = true;
        } catch (e) {
          if (e && (e.name === "AbortError" || (signal && signal.aborted))) return;
          await mapPool(wanted, EPG_FETCH_CONCURRENCY, (id) =>
            fetchEpgForChannel(id, { force: true, signal })
          );
        } finally {
          epgInflight.delete(key);
        }
      })();
      epgInflight.set(key, task);
      await task;
      return { pending: anyPending };
    }

    async function fetchScheduleBatch(ids, opts = {}) {
      const force = opts.force === true;
      const signal = opts.signal;
      const hours = opts.hours || EPG_SCHEDULE_HOURS;
      const wanted = idsNeedingFetch(scheduleCache, ids, force);
      if (!wanted.length) return { pending: false };
      const key = "sched-batch:" + hours + ":" + wanted.join(",");
      if (epgInflight.has(key)) {
        await epgInflight.get(key);
        return { pending: false };
      }
      let anyPending = false;
      const task = (async () => {
        try {
          const r = await authFetch("/epg/schedule/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channel_ids: wanted, hours }),
            cache: "no-store",
            signal,
          });
          if (!r.ok) throw new Error("batch_schedule_" + r.status);
          const data = await r.json();
          const channels = (data && data.channels) || {};
          for (const id of wanted) {
            const row = channels[id];
            if (cacheBatchRow(scheduleCache, id, row, EPG_SCHEDULE_TTL_MS)) anyPending = true;
          }
          if (data && data.fill_pending_count > 0) anyPending = true;
        } catch (e) {
          if (e && (e.name === "AbortError" || (signal && signal.aborted))) return;
          await mapPool(wanted, EPG_FETCH_CONCURRENCY, (id) =>
            fetchScheduleForChannel(id, { force: true, hours, signal })
          );
        } finally {
          epgInflight.delete(key);
        }
      })();
      epgInflight.set(key, task);
      await task;
      return { pending: anyPending };
    }

    async function runEpgPriorityQueue(opts = {}) {
      const force = opts.force === true;
      const idleOnly = opts.idleOnly === true;
      const gen = ++epgRefreshGen;
      if (epgAbortController) {
        try { epgAbortController.abort(); } catch (e) {}
      }
      const controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
      epgAbortController = controller;
      const signal = controller ? controller.signal : undefined;

      let wanted;
      if (idleOnly) {
        const all = buildEpgPriorityQueue({
          includeIdle: true,
          max: Math.min(orderIds.length, EPG_BATCH_MAX * 3),
        });
        wanted = all
          .filter((id) => !isCacheFresh(epgCache, id) || !isCacheFresh(scheduleCache, id))
          .slice(0, EPG_IDLE_BATCH);
      } else {
        wanted = buildEpgPriorityQueue({
          includeIdle: false,
          max: Math.min(MAX_GUIDE_EPG_ROWS, EPG_BATCH_MAX),
        });
      }
      if (!wanted.length) {
        if (!idleOnly) renderGrid();
        if (!idleOnly) scheduleEpgIdleFill();
        return;
      }

      // Wave A — high-priority now/next (tuned + visible first; queue already sorted).
      const waveA = wanted.slice(0, Math.min(wanted.length, 16));
      const nnA = await fetchNowNextBatch(waveA, { force, signal });
      if (gen !== epgRefreshGen) return;
      renderGrid({ preserveScroll: "xy" });
      if (headerMeta) updateHeader(headerMeta);

      if (wanted.length > waveA.length) {
        await fetchNowNextBatch(wanted.slice(waveA.length), { force, signal });
        if (gen !== epgRefreshGen) return;
        renderGrid({ preserveScroll: "xy" });
      }

      const sch = await fetchScheduleBatch(wanted, { force, signal, hours: EPG_SCHEDULE_HOURS });
      if (gen !== epgRefreshGen) return;
      renderGrid({ preserveScroll: "xy" });
      if (headerMeta) updateHeader(headerMeta);

      if ((nnA && nnA.pending) || (sch && sch.pending)) scheduleEpgPendingRetry();
      if (!idleOnly) scheduleEpgIdleFill();
    }

    async function refreshEpgWindow(opts = {}) {
      await runEpgPriorityQueue({
        force: opts.force === true,
        includeIdle: opts.includeIdle === true,
      });
    }

    async function prefetchEpgWindow() {
      await runEpgPriorityQueue({ force: false });
    }

    function prefetchChannelEpg(id) {
      if (!id) return;
      const needNow = !isCacheFresh(epgCache, id);
      const needSch = !isCacheFresh(scheduleCache, id);
      if (!needNow && !needSch) return;
      // Route single-channel kicks through the same priority queue (tuned tier wins).
      runEpgPriorityQueue({ force: false }).catch(() => {});
    }

    async function syncEpgServerRevision() {
      try {
        const r = await authFetch("/epg/status", { cache: "no-store" });
        if (!r.ok) return false;
        const status = await r.json();
        if (status.updated_at && status.updated_at !== serverEpgUpdatedAt) {
          serverEpgUpdatedAt = status.updated_at;
          clearEpgCaches();
          return true;
        }
      } catch (e) {}
      return false;
    }

    function moveFocus(dRow, dSlot) {
      if (dRow) {
        const next = Math.max(0, Math.min(orderIds.length - 1, focusIdx + dRow));
        if (next !== focusIdx) {
          focusIdx = next;
          const id = orderIds[focusIdx];
          switchChannel(id, { skipEpg: true });
          scrollToFocus();
          prefetchEpgWindow();
        }
      }
      if (dSlot) {
        focusSlot = Math.max(0, Math.min(NUM_SLOTS - 1, focusSlot + dSlot));
        markGuideUserPanned();
        guideProgrammaticScroll = true;
        syncScroll = true;
        const left = Math.max(0, focusSlot * SLOT_W());
        gridScroll.scrollLeft = left;
        if (timeRow) timeRow.style.transform = "translate3d(" + (-left) + "px,0,0)";
        syncScroll = false;
        requestAnimationFrame(() => { guideProgrammaticScroll = false; });
        renderGrid({ preserveScroll: "xy" });
        // Do not hide cinema info here — channel-change / Now jumps need the info bar.
      }
    }

    document.addEventListener("keydown", (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) {
        if (e.key === "Escape" && searchOpen) closeSearchDrawer();
        if (e.key === "Escape" && settingsOpen) closeSettingsDrawer();
        return;
      }
      if (searchOpen && e.key === "Escape") { e.preventDefault(); closeSearchDrawer(); return; }
      if (settingsOpen && e.key === "Escape") { e.preventDefault(); closeSettingsDrawer(); return; }
      if (window.SDPinUnlock && SDPinUnlock.isOpen && SDPinUnlock.isOpen() && e.key === "Escape") {
        e.preventDefault();
        try { SDPinUnlock.close(); } catch (err) {}
        return;
      }
      if (vodPickerOpen && e.key === "Escape") {
        e.preventDefault();
        closeVodPickerPanel();
        return;
      }
      if (trailerActive && e.key === "Escape") {
        e.preventDefault();
        stopOverlayPlayback();
        return;
      }
      if (vodSeriesSession && trailerActive) {
        if (e.key === "n" || e.key === "N" || e.key === "]") {
          e.preventDefault();
          stepSeriesEpisode(1);
          return;
        }
        if (e.key === "p" || e.key === "P" || e.key === "[") {
          e.preventDefault();
          stepSeriesEpisode(-1);
          return;
        }
        if (e.key === "a" || e.key === "A") {
          e.preventDefault();
          setVodAutoNext(!vodAutoNextEnabled());
          return;
        }
      }
      if (document.getElementById("partyHome") && document.getElementById("partyHome").classList.contains("open") && e.key === "Escape") {
        e.preventDefault();
        try {
          if (window.SDParty && typeof window.SDParty.closeHome === "function") window.SDParty.closeHome();
        } catch (err) {}
        return;
      }
      if (vodCatalogOpen && e.key === "Escape") {
        e.preventDefault();
        if ((vodDetail && vodDetail.classList.contains("show")) || !vodAtBrowseRoot()) {
          vodGoBack();
        } else {
          closeVodCatalog();
        }
        return;
      }
      if (vodDetail && vodDetail.classList.contains("show") && vodCatalogOpen) {
        if (e.key === "ArrowLeft") { e.preventDefault(); stepVodDetail(-1); return; }
        if (e.key === "ArrowRight") { e.preventDefault(); stepVodDetail(1); return; }
      }
      if (e.key === "/" || ((e.key === "s" || e.key === "S") && !e.shiftKey)) { e.preventDefault(); openSearchDrawer(); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); moveFocus(-1, 0); }
      else if (e.key === "ArrowDown") { e.preventDefault(); moveFocus(1, 0); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); moveFocus(0, -1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); moveFocus(0, 1); }
      else if (e.key === "Enter") {
        e.preventDefault();
        if (guideCollapsed) revealCollapsedChrome(true);
        else switchChannel(orderIds[focusIdx]);
      }
      else if (e.key === "PageUp") { e.preventDefault(); moveFocus(-5, 0); }
      else if (e.key === "PageDown") { e.preventDefault(); moveFocus(5, 0); }
      else if (e.key === "g" || e.key === "G") { e.preventDefault(); toggleGuide(); }
      else if (e.key === "," || (e.key === "s" && e.shiftKey)) { e.preventDefault(); openSettingsDrawer(); }
      else if (guideCollapsed && e.key === " ") {
        e.preventDefault();
        revealCollapsedChrome(true);
      }
    });

    gridScroll.addEventListener("scroll", () => {
      if (syncScroll) return;
      syncScroll = true;
      const top = gridScroll.scrollTop;
      const left = gridScroll.scrollLeft;
      chScroll.scrollTop = top;
      if (timeRow) timeRow.style.transform = "translate3d(" + (-left) + "px,0,0)";
      if (!guideProgrammaticScroll) {
        const target = guideNowScrollLeft();
        if (Math.abs(left - target) > Math.max(24, SLOT_W() * 0.35)) {
          markGuideUserPanned();
        }
      }
      // Programmatic tune/sync scrolls must not dismiss the channel info bar.
      if (!guideProgrammaticScroll && !syncScroll && !switching) {
        hideCinemaInfoOverlay();
      }
      const rowH = Math.max(1, ROW_H());
      const nextStart = Math.max(0, Math.floor(top / rowH));
      if (Math.abs(nextStart - viewStart) >= 1) {
        epgScrollDir = nextStart > viewStart ? 1 : (nextStart < viewStart ? -1 : epgScrollDir);
        lastEpgViewStart = viewStart;
        viewStart = nextStart;
        if (!guideScrollRaf) {
          guideScrollRaf = requestAnimationFrame(() => {
            guideScrollRaf = 0;
            renderGrid({ preserveScroll: "xy" });
          });
        }
      }
      clearTimeout(guideScrollIdleTimer);
      guideScrollIdleTimer = setTimeout(() => {
        if (tvRoot) tvRoot.classList.remove("guide-scrolling");
        // Do not move focusIdx to viewport mid — that stole highlight from the
        // tuned channel onto no-EPG neighbors and made the guide look "stuck LIVE".
        prefetchEpgWindow();
      }, 140);
      if (tvRoot) tvRoot.classList.add("guide-scrolling");
      syncScroll = false;
    }, { passive: true });

    // Channel logo rail: forward wheel / touch pans into the shared grid scroller.
    // Also: left→right swipe opens Q3-3d category drawer; reverse closes it.
    (function wireGuideRailHotzones() {
      if (!chScroll || !gridScroll || chScroll.dataset.hotzone === "1") return;
      chScroll.dataset.hotzone = "1";
      chScroll.addEventListener("wheel", (e) => {
        e.preventDefault();
        gridScroll.scrollTop += e.deltaY;
        if (e.deltaX) gridScroll.scrollLeft += e.deltaX;
      }, { passive: false });

      let railDragging = false;
      let railPtr = null;
      let railLastY = 0;
      let railLastX = 0;
      let railStartX = 0;
      let railStartY = 0;
      let railMoved = false;
      let railMode = ""; // "" | "v" | "h" | "cat"
      let catPullActive = false;
      chScroll.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        railDragging = true;
        railMoved = false;
        railMode = "";
        catPullActive = false;
        railPtr = e.pointerId;
        railLastY = e.clientY;
        railLastX = e.clientX;
        railStartX = e.clientX;
        railStartY = e.clientY;
        try { chScroll.setPointerCapture(e.pointerId); } catch (err) {}
      });
      const endRail = (e) => {
        if (!railDragging || (railPtr != null && e.pointerId !== railPtr)) return;
        if (catPullActive) {
          const dx = e.clientX - railStartX;
          const openPx = catDrawerOpen ? CAT_DRAWER_W : 0;
          const next = Math.max(0, Math.min(CAT_DRAWER_W, openPx + dx));
          settleCatDrawerPull(next / CAT_DRAWER_W);
        }
        railDragging = false;
        railPtr = null;
        railMode = "";
        catPullActive = false;
        try { chScroll.releasePointerCapture(e.pointerId); } catch (err) {}
      };
      chScroll.addEventListener("pointermove", (e) => {
        if (!railDragging || (railPtr != null && e.pointerId !== railPtr)) return;
        const dy = railLastY - e.clientY;
        const dx = e.clientX - railLastX;
        const totalDx = e.clientX - railStartX;
        const totalDy = e.clientY - railStartY;
        if (Math.abs(dy) > 2 || Math.abs(dx) > 2) railMoved = true;

        if (!railMode) {
          if (Math.abs(totalDx) < 10 && Math.abs(totalDy) < 10) {
            railLastY = e.clientY;
            railLastX = e.clientX;
            return;
          }
          if (Math.abs(totalDx) > Math.abs(totalDy) * 1.2) {
            // Horizontal: open (L→R) or close (R→L) category drawer.
            if ((!catDrawerOpen && totalDx > 0) || (catDrawerOpen && totalDx < 0) || catDrawerOpen) {
              railMode = "cat";
              catPullActive = true;
            } else {
              railMode = "h";
            }
          } else {
            railMode = "v";
          }
        }

        if (railMode === "cat") {
          e.preventDefault();
          setCatDrawerPull(totalDx);
          railLastY = e.clientY;
          railLastX = e.clientX;
          hideCinemaInfoOverlay();
          return;
        }

        // Prefer vertical on the logo column; allow light horizontal scrub.
        if (railMode === "v" || Math.abs(dy) >= Math.abs(dx)) {
          gridScroll.scrollTop += dy;
        } else {
          gridScroll.scrollLeft += dx;
          markGuideUserPanned();
        }
        railLastY = e.clientY;
        railLastX = e.clientX;
        hideCinemaInfoOverlay();
      });
      chScroll.addEventListener("pointerup", endRail);
      chScroll.addEventListener("pointercancel", endRail);
      // Avoid click-select after a drag.
      chScroll.addEventListener("click", (e) => {
        if (railMoved) {
          e.preventDefault();
          e.stopPropagation();
          railMoved = false;
        }
      }, true);

      if (timeRow) {
        timeRow.addEventListener("click", (e) => {
          const slot = e.target && e.target.closest ? e.target.closest(".time-slot") : null;
          if (!slot || !timeRow.contains(slot)) return;
          const idx = Array.prototype.indexOf.call(timeRow.children, slot);
          if (idx < 0) return;
          markGuideUserPanned();
          guideProgrammaticScroll = true;
          syncScroll = true;
          const left = Math.max(0, idx * SLOT_W());
          gridScroll.scrollLeft = left;
          timeRow.style.transform = "translate3d(" + (-left) + "px,0,0)";
          focusSlot = idx;
          renderGrid({ preserveScroll: "xy" });
          syncScroll = false;
          requestAnimationFrame(() => { guideProgrammaticScroll = false; });
          hideCinemaInfoOverlay();
        });
      }
      const dayCol = document.querySelector(".day-col");
      if (dayCol) {
        dayCol.style.cursor = "pointer";
        dayCol.title = "Jump to now";
        dayCol.addEventListener("click", () => {
          scrollGuideToNow({ force: true });
          hideCinemaInfoOverlay();
        });
      }
    })();

    async function loadCatalog() {
      const [orderRes, chRes] = await Promise.all([
        authFetch("/channels/order"),
        authFetch("/channels?include_dead=false")
      ]);
      if (!orderRes.ok || !chRes.ok) throw new Error("catalog");
      const orderData = await orderRes.json();
      const channels = await chRes.json();
      channelMap = {};
      for (const c of channels) channelMap[String(c.id)] = c;
      const seen = new Set();
      orderIds = [];
      for (const id of (orderData.ids || []).map(String)) {
        if (!seen.has(id) && channelMap[id]) {
          seen.add(id);
          orderIds.push(id);
        }
      }
      const extras = channels
        .map(c => String(c.id))
        .filter(id => !seen.has(id))
        .sort((a, b) => (channelMap[a].name || "").localeCompare(channelMap[b].name || "", undefined, { sensitivity: "base" }));
      for (const id of extras) {
        seen.add(id);
        orderIds.push(id);
      }
      if (!orderIds.length) orderIds = channels.map(c => String(c.id));
      allOrderIds = orderIds.slice();
      ensureFavoritesStorage();
      ensureRecentsStorage();
      guideCategoryKey = loadGuideCategoryKey();
    }

    function tvChannelUrl(ch) {
      const id = String(ch || "").replace(/^\/+|\/+$/g, "");
      let path = "/tv/" + encodeURIComponent(id);
      try {
        const keep = new URLSearchParams();
        const cur = new URLSearchParams(location.search);
        let party = (cur.get("party") || "").toUpperCase();
        let name = cur.get("name") || "";
        try {
          if (!party) party = (sessionStorage.getItem("sd_party_pending") || "").toUpperCase();
          if (!name) name = sessionStorage.getItem("sd_party_name_pending") || "";
        } catch (e) {}
        if (party) keep.set("party", party);
        if (name) keep.set("name", name);
        const qs = keep.toString();
        if (qs) path += "?" + qs;
      } catch (e) {}
      return path;
    }

    function resolveInitialChannel() {
      if (INITIAL_CHANNEL) return INITIAL_CHANNEL;
      try {
        const m = location.pathname.match(/^\/tv\/([^/]+)\/?$/);
        if (m && m[1]) return decodeURIComponent(m[1]);
      } catch (e) {}
      if (rememberChannelEnabled()) {
        try {
          const last = localStorage.getItem(LS_LAST);
          if (last) return last;
          const place = loadLastPlace();
          if (place && place.channelId) return String(place.channelId);
        } catch (e) {}
      }
      return "763";
    }

    async function boot() {
      loadTheme();
      loadVodSettings();
      refreshHouseholdSettings();
      if (maybeResumeLastPlace()) return;
      try {
        await loadCatalog();
      } catch (e) {
        showErr("Could not load channel list");
        return;
      }
      const initial = resolveSelectableChannelId(resolveInitialChannel());
      // Resolve tune target against the full playlist, then apply category filter.
      let idx = allOrderIds.indexOf(String(initial));
      if (idx < 0) idx = allOrderIds.indexOf("763");
      if (idx < 0) idx = 0;
      channelId = allOrderIds[idx] || initial;
      if (!INITIAL_CHANNEL) {
        history.replaceState(null, "", tvChannelUrl(channelId));
      }
      // Paint guide on the tuned channel (not alphabet top) so EPG titles are visible.
      wireCatDrawer();
      applyGuideCategory(guideCategoryKey, { render: false, renderList: true });
      {
        const fIdx = orderIds.indexOf(String(channelId));
        focusIdx = fIdx >= 0 ? fIdx : 0;
      }
      renderGrid({ scrollToFocus: true, scrollToNow: true });
      setupHeaderResize();
      setupTitleHover();
      try {
        const meta = await loadNeighbors(channelId);
        updateHeader(meta);
        saveLastChannel(channelId);
        await attachHls(meta.stream_url);
      } catch (e) {
        await attachHls("/live/" + encodeURIComponent(channelId) + ".m3u8");
      }
      await syncEpgServerRevision();
      await prefetchEpgWindow();
      await refreshCurrentHeaderEpg();
      // Re-center after EPG + layout so mobile sheet height is known.
      requestAnimationFrame(() => {
        scrollToFocus();
        scrollGuideToNow({ force: true });
        prefetchEpgWindow();
      });
      setInterval(() => {
        buildTimeHeader();
        renderGrid({ preserveScroll: guideFollowNow ? true : "xy" });
        if (guideFollowNow) scrollGuideToNow();
        if (headerMeta) updateHeader(headerMeta);
      }, 60000);
      setInterval(() => {
        if (headerMeta) updateHeader(headerMeta);
      }, 30000);
      setInterval(async () => {
        const busted = await syncEpgServerRevision();
        refreshEpgWindow({ force: busted });
      }, EPG_NOW_TTL_MS);
      setInterval(() => { refreshEpgWindow({ force: false }); }, EPG_SCHEDULE_TTL_MS);
      setInterval(async () => { await syncEpgServerRevision(); }, EPG_STATUS_POLL_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          // Soft reopen: only force when server EPG revision changed; otherwise
          // revalidate stale tiers via the priority queue (fresh cache stays).
          syncEpgServerRevision().then((busted) => refreshEpgWindow({ force: !!busted }));
        }
      });
      if (location.pathname.startsWith("/vod")) {
        const vodState = (history.state && history.state.sdVod) ? history.state.sdVod : vodParseRoute();
        const vodUrl = vodBuildUrl(vodState);
        history.replaceState({ sdVod: vodState }, "", vodUrl);
        await applyVodRoute(vodState, { keepSearch: true });
      } else {
        const partyPath = location.pathname.replace(/\/$/, "") || "/";
        if (partyPath === "/party" || partyPath === "/party/home") {
          try {
            if (window.SDParty && typeof window.SDParty.openHome === "function") {
              window.SDParty.openHome({ replace: true });
            }
          } catch (e) {}
        }
      }
    }

    if (!INITIAL_CHANNEL && location.pathname.replace(/\/$/, "") === "/tv") {
      const target = resolveInitialChannel();
      history.replaceState(null, "", tvChannelUrl(target));
    }

    try {
      const wantGuide = new URLSearchParams(location.search).get("guide");
      const fromSimple = sessionStorage.getItem("sd_return_guide") === "1";
      if (fromSimple) sessionStorage.removeItem("sd_return_guide");
      if (wantGuide === "1" || fromSimple) {
        localStorage.setItem(LS_GUIDE, "0");
        applyGuideState(false, { fromPopstate: true });
      } else if (wantGuide === "0") {
        localStorage.setItem(LS_GUIDE, "1");
        applyGuideState(true, { fromPopstate: true });
      }
    } catch (e) {}

    (function wireGuestPinBanner() {
      let banner = document.getElementById("sdGuestPinBanner");
      if (!banner) {
        banner = document.createElement("div");
        banner.id = "sdGuestPinBanner";
        banner.className = "sd-guest-pin-banner";
        banner.hidden = true;
        banner.innerHTML =
          '<span class="sd-guest-pin-msg"></span>' +
          '<button type="button" class="sd-guest-pin-cta" id="sdGuestPinCta">Enter PIN</button>' +
          '<button type="button" class="sd-guest-pin-dismiss" aria-label="Dismiss">✕</button>';
        document.body.appendChild(banner);
        banner.querySelector(".sd-guest-pin-dismiss").addEventListener("click", () => {
          banner.hidden = true;
          document.body.classList.remove("sd-guest-banner-visible");
          try { sessionStorage.setItem("sd_guest_banner_dismiss", String(Date.now())); } catch (e) {}
        });
        const cta = banner.querySelector("#sdGuestPinCta");
        if (cta) {
          cta.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Always stay on this page — optional Full login link lives inside the sheet.
            if (!openInlinePinUnlock("pin_required", { quiet: true })) {
              showErr("PIN unlock UI unavailable — refresh and try again");
            }
          });
        }
      }
      const msg = banner.querySelector(".sd-guest-pin-msg");
      let timer = null;
      async function refresh() {
        try {
          const r = await fetch("/auth/status", { credentials: "same-origin", cache: "no-store" });
          if (!r.ok) return;
          const data = await r.json();
          if (!data || data.authenticated) {
            banner.hidden = true;
            document.body.classList.remove("sd-guest-banner-visible");
            return;
          }
          if (!data.guest && !data.stream_locked && !data.reminder) {
            banner.hidden = true;
            document.body.classList.remove("sd-guest-banner-visible");
            return;
          }
          const rem = Math.max(0, Number(data.grace_remaining_seconds || 0));
          const mins = Math.ceil(rem / 60);
          const isGuest = !!data.guest;
          if (msg) {
            msg.textContent = isGuest && rem > 0
              ? ("Guest mode — set a household PIN soon (" + mins + " min left)")
              : (isGuest || data.stream_locked)
                ? "Guest grace ended — enter a PIN to keep watching"
                : "Enter a household PIN to unlock streams";
          }
          let dismissed = 0;
          try { dismissed = Number(sessionStorage.getItem("sd_guest_banner_dismiss") || 0); } catch (e) {}
          // Only nudge on server reminder / lock / last 2 min — never "always on" for any guest.
          const showReminder = !!data.reminder || !!data.stream_locked || (isGuest && rem > 0 && rem <= 120);
          if (showReminder && (!dismissed || Date.now() - dismissed > 180000 || !!data.stream_locked)) {
            banner.hidden = false;
            banner.classList.toggle("urgent", !!data.stream_locked || rem <= 120);
          } else if (!showReminder) {
            banner.hidden = true;
          }
          if (data.stream_locked && isGuest) {
            banner.hidden = false;
            banner.classList.add("urgent");
            if (msg) msg.textContent = "Stream locked — enter PIN to continue";
          }
          document.body.classList.toggle("sd-guest-banner-visible", !banner.hidden);
          // Auto-open PIN only for a real guest whose grace ended / stream locked.
          // Missing sd_guest must NOT open PIN (was the constant re-prompt loop).
          const shouldAutoPin = isGuest && (!!data.stream_locked || rem <= 0);
          let alreadyShown = "0";
          try { alreadyShown = sessionStorage.getItem("sd_inline_pin_shown") || "0"; } catch (e) {}
          if (
            shouldAutoPin &&
            alreadyShown !== "1" &&
            !(window.SDPinUnlock && SDPinUnlock.isOpen && SDPinUnlock.isOpen())
          ) {
            try { sessionStorage.setItem("sd_inline_pin_shown", "1"); } catch (e) {}
            openInlinePinUnlock(data.stream_locked ? "stream_locked" : "guest_expired", { quiet: true });
          }
        } catch (e) {}
      }
      refresh();
      timer = setInterval(refresh, 60000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") refresh();
      });
      window.addEventListener("sd-auth-required", refresh);
      window.addEventListener("sd-auth-unlocked", () => {
        banner.hidden = true;
        document.body.classList.remove("sd-guest-banner-visible");
        try { sessionStorage.setItem("sd_inline_pin_shown", "0"); } catch (e) {}
        refresh();
      });
    })();

    window.SDGetReportContext = function () {
      const id = String(channelId || "");
      const ch = (id && channelMap[id]) || {};
      let epg = null;
      try {
        epg = id ? getCachedEntry(epgCache, id) : null;
      } catch (e) {
        epg = null;
      }
      let paintDead = false;
      try {
        paintDead = typeof samplePaintLooksDead === "function" && !!samplePaintLooksDead(true);
      } catch (e) {}
      let embedActive = false;
      try {
        const frame = document.getElementById("liveEmbedFrame") || document.querySelector("#liveEmbed iframe, .live-embed iframe");
        embedActive = !!(frame && frame.src);
      } catch (e) {}
      return {
        channel_id: id || null,
        display_name: (headerMeta && headerMeta.name) || ch.name || null,
        tvg_id: ch.tvg_id || null,
        number: (headerMeta && headerMeta.number) || ch.number || null,
        logo: (headerMeta && headerMeta.logo) || ch.logo || null,
        epg_now: (epg && epg.now) || null,
        epg_next: (epg && epg.next) || null,
        playback: {
          paused: !!(v && v.paused),
          ended: !!(v && v.ended),
          muted: !!(v && v.muted),
          readyState: v ? v.readyState : 0,
          networkState: v ? v.networkState : 0,
          videoWidth: v ? v.videoWidth : 0,
          videoHeight: v ? v.videoHeight : 0,
          currentTime: v ? Math.round((v.currentTime || 0) * 10) / 10 : 0,
          paint_dead: paintDead,
          embed_active: embedActive,
        },
        theme: typeof currentTheme !== "undefined" ? currentTheme : null,
        guide_collapsed: !!guideCollapsed,
      };
    };

    boot();
  
