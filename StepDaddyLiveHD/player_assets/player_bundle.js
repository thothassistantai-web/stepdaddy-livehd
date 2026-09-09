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
  
/* player_features: continue watching, subtitles, hls controls, prefetch, last-good */
(function sdFeaturesBoot() {
  const LS_LAST_GOOD = "sd_vod_last_good";
  const LS_SUB_LANG = "sd_sub_lang";
  const LS_SUB_SIZE = "sd_sub_size";
  const LS_SUB_COLOR = "sd_sub_color";
  const LS_SUB_POS = "sd_sub_pos";
  const LS_PIP = "sd_pip_default";
  const LS_AUTO_PIP_BG = "sd_auto_pip_bg";
  const LS_PREFETCH = "sd_resolve_prefetch";
  const LS_PARTY_NAME = "sd_party_name";

  let progressTimer = null;
  let lastProgressSent = 0;
  let resumeSeek = null;
  let hlsChromeHideTimer = null;
  let hlsHoldActive = false;
  let hlsScrubbing = false;
  let subTracks = [];
  let activeSubUrl = null;
  let subCues = [];
  let subRaf = null;

  const PARTY_IGNORE_SEL =
    ".party-drawer, .party-fab, .party-toast, .party-jitsi-stage, .party-av-overlay, #partyAvOverlay, #partyFab, .party-live-overlay, .party-live-badge, .sd-modal, .sd-modal-backdrop, .pc-settings, .pc-settings-backdrop";

  function partyChromeIgnore(target) {
    return !!(target && target.closest && target.closest(PARTY_IGNORE_SEL));
  }

  function chromeOverlayBlockingHide() {
    if (hlsHoldActive || hlsScrubbing) return true;
    if (document.getElementById("pcSettings")?.classList.contains("open")) return true;
    if (document.getElementById("pcXraySheet")?.classList.contains("open")) return true;
    if (document.getElementById("partyDrawer")?.classList.contains("open")) return true;
    if (document.getElementById("sdPartyModal")?.classList.contains("open")) return true;
    return false;
  }

  /**
   * Multifunction hold-done: press → hold threshold → release/done.
   * Short press still fires click; hold runs tickFn on interval; cancel on leave/cancel.
   */
  function bindHoldDone(el, opts) {
    if (!el || el.dataset.holdBound === "1") return;
    el.dataset.holdBound = "1";
    opts = opts || {};
    const threshold = opts.threshold != null ? opts.threshold : 380;
    const interval = opts.interval != null ? opts.interval : 160;
    const tickFn = opts.onHoldTick || opts.onHold;
    const onStart = opts.onHoldStart;
    const onEnd = opts.onHoldEnd;
    let holdTimer = null;
    let tickTimer = null;
    let holding = false;
    let suppressClick = false;
    let ptrId = null;

    function clearAll() {
      clearTimeout(holdTimer);
      clearInterval(tickTimer);
      holdTimer = null;
      tickTimer = null;
      if (holding) {
        holding = false;
        suppressClick = true;
        hlsHoldActive = false;
        el.classList.remove("pc-hold-active");
        const bar = document.getElementById("hlsChrome");
        if (bar) bar.classList.remove("pc-hold-busy");
        if (onEnd) onEnd();
        showHlsChrome(false);
      }
      ptrId = null;
    }

    function beginHold() {
      holding = true;
      hlsHoldActive = true;
      el.classList.add("pc-hold-active");
      const bar = document.getElementById("hlsChrome");
      if (bar) bar.classList.add("pc-hold-busy");
      showHlsChrome(true);
      if (onStart) onStart();
      if (tickFn) {
        tickFn();
        tickTimer = setInterval(tickFn, interval);
      }
    }

    el.addEventListener("pointerdown", (e) => {
      if (e.button != null && e.button !== 0) return;
      ptrId = e.pointerId;
      suppressClick = false;
      clearTimeout(holdTimer);
      holdTimer = setTimeout(beginHold, threshold);
      try {
        el.setPointerCapture(e.pointerId);
      } catch (err) {}
    });
    el.addEventListener("pointerup", (e) => {
      if (ptrId != null && e.pointerId !== ptrId) return;
      clearAll();
    });
    el.addEventListener("pointercancel", clearAll);
    el.addEventListener("lostpointercapture", clearAll);
    el.addEventListener(
      "click",
      (e) => {
        if (suppressClick) {
          suppressClick = false;
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true
    );
  }

  function lsGet(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : v;
    } catch (e) {
      return d;
    }
  }
  function lsSet(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {}
  }
  function lastGoodMap() {
    try {
      return JSON.parse(lsGet(LS_LAST_GOOD, "{}")) || {};
    } catch (e) {
      return {};
    }
  }
  function lastGoodKey(ctx) {
    if (!ctx || !ctx.tmdbId) return "";
    return [ctx.tmdbId, ctx.mediaType || "movie", ctx.season || "", ctx.episode || ""].join(":");
  }
  function getLastGood(ctx) {
    const k = lastGoodKey(ctx);
    return k ? lastGoodMap()[k] || "" : "";
  }
  function setLastGood(ctx, provider) {
    if (!provider || !ctx) return;
    const m = lastGoodMap();
    m[lastGoodKey(ctx)] = String(provider);
    lsSet(LS_LAST_GOOD, JSON.stringify(m));
  }
  function prefetchEnabled() {
    return lsGet(LS_PREFETCH, "1") !== "0";
  }
  function fmtClock(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h) return h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    return m + ":" + String(s).padStart(2, "0");
  }

  function _pcIcon(name) {
    const icons = {
      play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
      pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
      back10: '<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z"/></svg>',
      fwd10: '<svg viewBox="0 0 24 24"><path d="M12 5V1l5 5-5 5V7c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6h2c0 4.4-3.6 8-8 8s-8-3.6-8-8 3.6-8 8-8z"/></svg>',
      vol: '<svg viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.8-1-3.3-2.5-4v8c1.5-.7 2.5-2.2 2.5-4z"/></svg>',
      mute: '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.8-1-3.3-2.5-4v2.2l2.5 2.5V12zm2.5 0c0 .9-.2 1.8-.5 2.6l1.5 1.5c.6-1.3 1-2.7 1-4.1 0-3.5-2-6.5-5-8v2.1c2 .9 3.4 2.9 3.4 5.9zM4.3 3L3 4.3 7.7 9H3v4h4l5 5v-6.7l4.7 4.7c-.7.5-1.4.9-2.2 1.2v2.1c1.2-.3 2.3-.9 3.2-1.7L19.7 21 21 19.7 4.3 3zM12 4L9.9 6.1 12 8.2V4z"/></svg>',
      cc: '<svg viewBox="0 0 24 24"><path d="M19 4H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z"/></svg>',
      gear: '<svg viewBox="0 0 24 24"><path d="M19.1 12.9c0-.3 0-.6.1-.9s0-.6-.1-.9l2-1.6c.2-.1.2-.4.1-.6l-1.9-3.3c-.1-.2-.4-.3-.6-.2l-2.4 1c-.5-.4-1-.7-1.6-.9l-.4-2.5c0-.2-.2-.4-.5-.4h-3.8c-.2 0-.5.2-.5.4l-.4 2.5c-.6.2-1.1.5-1.6.9l-2.4-1c-.2-.1-.5 0-.6.2L2.7 8.9c-.1.2-.1.5.1.6l2 1.6c0 .3-.1.6-.1.9s0 .6.1.9l-2 1.6c-.2.1-.2.4-.1.6l1.9 3.3c.1.2.4.3.6.2l2.4-1c.5.4 1 .7 1.6.9l.4 2.5c0 .2.2.4.5.4h3.8c.2 0 .5-.2.5-.4l.4-2.5c.6-.2 1.1-.5 1.6-.9l2.4 1c.2.1.5 0 .6-.2l1.9-3.3c.1-.2.1-.5-.1-.6l-2-1.6zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>',
      fs: '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
      pip: '<svg viewBox="0 0 24 24"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.98 2 1.98h18c1.1 0 2-.88 2-1.98V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z"/></svg>',
      xray: '<svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
      dl: '<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>',
      source: '<svg viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z"/></svg>',
      audio: '<svg viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>',
      lock: '<svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.8-2.2-5-5-5S7 3.2 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.7 1.3-3 3-3s3 1.3 3 3v2H9V6zm3 11c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>',
      more: '<svg viewBox="0 0 24 24"><path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>',
      cast: '<svg viewBox="0 0 24 24"><path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zM21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>',
    };
    return icons[name] || "";
  }

  function ensureHlsChromeDom() {
    if (!trailerLayer) return null;
    let bar = document.getElementById("hlsChrome");
    if (bar && bar.dataset.cinema === "1") return bar;
    if (bar) bar.remove();
    if (!document.getElementById("hlsHotzone")) {
      const hot = document.createElement("div");
      hot.className = "hls-hotzone";
      hot.id = "hlsHotzone";
      trailerLayer.appendChild(hot);
    }
    if (!document.getElementById("sdSubOverlay")) {
      const sub = document.createElement("div");
      sub.className = "sd-sub-overlay";
      sub.id = "sdSubOverlay";
      sub.hidden = true;
      trailerLayer.appendChild(sub);
    }
    bar = document.createElement("div");
    bar.className = "hls-chrome";
    bar.id = "hlsChrome";
    bar.dataset.cinema = "1";
    bar.innerHTML =
      '<div class="pc-top">' +
      '<div class="pc-title-block">' +
      '<div class="pc-eyebrow" id="pcEyebrow">Now playing</div>' +
      '<div class="pc-title" id="pcTitle">Title</div>' +
      '<div class="pc-sub" id="pcSub"></div>' +
      "</div>" +
      '<div class="pc-top-actions">' +
      '<button type="button" class="pc-btn" id="pcXrayBtn" title="X-ray">' +
      _pcIcon("xray") +
      "</button>" +
      '<button type="button" class="pc-btn" id="pcDownloadBtn" title="Download">' +
      _pcIcon("dl") +
      "</button>" +
      '<button type="button" class="pc-btn" id="pcSettingsBtn" title="Player settings">' +
      _pcIcon("gear") +
      "</button>" +
      "</div></div>" +
      '<div class="pc-center">' +
      '<span class="pc-seek-flash left" id="pcSeekLeft">−10s</span>' +
      '<button type="button" class="pc-center-hit" id="hlsPlayBtn" title="Play/Pause">' +
      _pcIcon("play") +
      "</button>" +
      '<span class="pc-seek-flash right" id="pcSeekRight">+10s</span>' +
      "</div>" +
      '<div class="pc-bottom">' +
      '<div class="pc-scrub-wrap">' +
      '<div class="pc-buf" id="pcBuf"><i id="pcBufFill"></i></div>' +
      '<input type="range" class="hls-scrub" id="hlsScrub" min="0" max="1000" value="0" step="1"/>' +
      "</div>" +
      '<div class="pc-meta-row"><span class="hls-time" id="hlsTime">0:00 / 0:00</span></div>' +
      '<div class="pc-controls">' +
      '<button type="button" class="pc-btn" id="hlsBack10" title="-10s">' +
      _pcIcon("back10") +
      "</button>" +
      '<button type="button" class="pc-btn" id="hlsFwd10" title="+10s">' +
      _pcIcon("fwd10") +
      "</button>" +
      '<div class="pc-vol">' +
      '<button type="button" class="pc-btn" id="pcMuteBtn" title="Mute">' +
      _pcIcon("vol") +
      "</button>" +
      '<input type="range" id="pcVol" min="0" max="1" step="0.01" value="1"/>' +
      "</div>" +
      '<div class="hls-menus"><button type="button" class="pc-btn" id="hlsCcBtn" title="Subtitles">' +
      _pcIcon("cc") +
      '</button><div class="hls-menu" id="hlsCcMenu"></div></div>' +
      '<div class="hls-menus"><button type="button" class="pc-btn pc-btn-label" id="hlsQualityBtn" title="Quality">Auto</button>' +
      '<div class="hls-menu" id="hlsQualityMenu"></div></div>' +
      '<div class="hls-menus"><button type="button" class="pc-btn pc-btn-label" id="pcSpeedBtn" title="Speed">1x</button>' +
      '<div class="hls-menu" id="pcSpeedMenu"></div></div>' +
      '<div class="hls-menus"><button type="button" class="pc-btn" id="pcAudioBtn" title="Audio">' +
      _pcIcon("audio") +
      '</button><div class="hls-menu" id="pcAudioMenu"></div></div>' +
      '<div class="hls-menus"><button type="button" class="pc-btn" id="pcSourceBtn" title="Sources">' +
      _pcIcon("source") +
      '</button><div class="hls-menu" id="pcSourceMenu"></div></div>' +
      '<button type="button" class="pc-btn" id="hlsPipBtn" title="Picture in Picture">' +
      _pcIcon("pip") +
      "</button>" +
      '<button type="button" class="pc-btn" id="hlsCastBtn" title="Cast / AirPlay">' +
      _pcIcon("cast") +
      "</button>" +
      '<button type="button" class="pc-btn" id="pcFsBtn" title="Fullscreen">' +
      _pcIcon("fs") +
      "</button>" +
      '<button type="button" class="pc-btn" id="pcLockBtn" title="Lock controls">' +
      _pcIcon("lock") +
      "</button>" +
      '<div class="hls-menus"><button type="button" class="pc-btn" id="pcMoreBtn" title="More">' +
      _pcIcon("more") +
      '</button><div class="hls-menu" id="pcMoreMenu">' +
      '<button type="button" id="hlsShareBtn">Share</button>' +
      '<button type="button" id="hlsPartyBtn">Watch party</button>' +
      '<button type="button" id="pcZoomBtn">Fit / Zoom</button>' +
      "</div></div>" +
      "</div></div>" +
      '<div class="pc-gesture-hud" id="pcGestureHud"><div id="pcGestureLabel"></div><div class="bar"><i id="pcGestureBar"></i></div></div>' +
      '<button type="button" class="pc-lock-fab" id="pcLockFab" title="Unlock">' +
      _pcIcon("lock") +
      "</button>" +
      '<div class="pc-toast" id="pcToast"></div>' +
      '<aside class="pc-xray-sheet" id="pcXraySheet" aria-hidden="true">' +
      '<button type="button" class="pc-xray-close" id="pcXrayClose">✕</button>' +
      '<div id="pcXrayBody"></div></aside>';
    trailerLayer.appendChild(bar);
    wireHlsChrome(bar);
    if (window.SDCinema && SDCinema.onChromeReady) SDCinema.onChromeReady(bar);
    return bar;
  }

  function showHlsChrome(pinned) {
    const bar = ensureHlsChromeDom();
    if (!bar || !vodHlsActive) return;
    if (tvRoot && tvRoot.classList.contains("pc-controls-locked")) return;
    updateCinemaTitle();
    updateBuffered();
    bar.classList.add("show");
    bar.classList.remove("idle");
    if (pinned) bar.classList.add("pinned");
    else bar.classList.remove("pinned");
    if (trailerLayer) trailerLayer.classList.add("has-hls-chrome");
    clearTimeout(hlsChromeHideTimer);
    const menuOpen = !!(bar.querySelector(".hls-menu.open"));
    const keep =
      pinned ||
      menuOpen ||
      (v && v.paused) ||
      chromeOverlayBlockingHide();
    if (!keep) {
      hlsChromeHideTimer = setTimeout(hideHlsChrome, 2800);
    }
  }
  function hideHlsChrome(force) {
    const bar = document.getElementById("hlsChrome");
    if (!bar) return;
    if (!force) {
      if (bar.classList.contains("pinned")) return;
      if (bar.querySelector(".hls-menu.open")) return;
      if (v && v.paused) return;
      if (chromeOverlayBlockingHide()) return;
    }
    bar.classList.remove("show", "pinned");
    bar.classList.add("idle");
    if (trailerLayer) trailerLayer.classList.remove("has-hls-chrome");
  }

  function wireHlsChrome(bar) {
    if (bar.dataset.wired === "1") return;
    bar.dataset.wired = "1";
    const scrub = document.getElementById("hlsScrub");
    const playBtn = document.getElementById("hlsPlayBtn");
    function setPlayIcon() {
      if (!playBtn) return;
      playBtn.innerHTML = v.paused ? _pcIcon("play") : _pcIcon("pause");
    }
    function flashSeek(side) {
      const el = document.getElementById(side === "left" ? "pcSeekLeft" : "pcSeekRight");
      if (!el) return;
      el.classList.add("show");
      setTimeout(() => el.classList.remove("show"), 700);
    }
    function seekBy(delta) {
      try {
        const dur = v.duration || 1e9;
        v.currentTime = Math.max(0, Math.min(dur, (v.currentTime || 0) + delta));
      } catch (e) {}
      flashSeek(delta < 0 ? "left" : "right");
      showHlsChrome();
      broadcastClockSoon();
    }
    const back10 = document.getElementById("hlsBack10");
    const fwd10 = document.getElementById("hlsFwd10");
    back10.addEventListener("click", () => seekBy(-10));
    fwd10.addEventListener("click", () => seekBy(10));
    // Hold seek = 2x scrub burst (±2s ticks)
    bindHoldDone(back10, {
      interval: 140,
      onHoldTick: () => seekBy(-2),
    });
    bindHoldDone(fwd10, {
      interval: 140,
      onHoldTick: () => seekBy(2),
    });
    playBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (v.paused) v.play().catch(() => {});
      else v.pause();
      setPlayIcon();
      showHlsChrome();
      broadcastClockSoon();
    });
    function endScrub() {
      hlsScrubbing = false;
      // Always unpin after scrub so chrome cannot stick "pinned forever"
      if (scrub) scrub.classList.remove("pc-scrubbing");
      showHlsChrome(false);
    }
    scrub.addEventListener("pointerdown", () => {
      hlsScrubbing = true;
      scrub.classList.add("pc-scrubbing");
      showHlsChrome(true);
    });
    scrub.addEventListener("input", () => {
      const dur = v.duration || 0;
      if (dur > 0) v.currentTime = (Number(scrub.value) / 1000) * dur;
      hlsScrubbing = true;
      showHlsChrome(true);
    });
    scrub.addEventListener("change", () => {
      endScrub();
      broadcastClockSoon();
      reportProgress("pause");
    });
    scrub.addEventListener("pointerup", endScrub);
    scrub.addEventListener("pointercancel", endScrub);
    scrub.addEventListener("pointerleave", () => {
      if (hlsScrubbing) endScrub();
    });
    const vol = document.getElementById("pcVol");
    const muteBtn = document.getElementById("pcMuteBtn");
    if (vol) {
      bindHoldDone(vol, {
        threshold: 320,
        interval: 90,
        onHoldTick: () => {
          const step = 0.04;
          // hold volume: nudge toward extremes based on thumb position
          const cur = Number(vol.value) || 0;
          const next = cur >= 0.5 ? Math.min(1, cur + step) : Math.max(0, cur - step);
          vol.value = String(next);
          v.volume = next;
          v.muted = next <= 0.01;
          vol.dispatchEvent(new Event("input", { bubbles: true }));
          showHlsChrome(true);
        },
      });
    }
    if (muteBtn) {
      bindHoldDone(muteBtn, {
        threshold: 450,
        interval: 100,
        onHoldStart: () => {
          muteBtn.dataset.holdVol0 = String(v.volume || 1);
        },
        onHoldTick: () => {
          const next = Math.min(1, (v.volume || 0) + 0.05);
          v.volume = next;
          v.muted = false;
          if (vol) vol.value = String(next);
          showHlsChrome(true);
        },
      });
    }
    document.getElementById("hlsCcBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMenu("hlsCcMenu");
      loadSubtitlesForCtx(vodPickerCtx);
      showHlsChrome(true);
    });
    document.getElementById("hlsQualityBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      renderQualityMenu();
      toggleMenu("hlsQualityMenu");
      showHlsChrome(true);
    });
    document.getElementById("hlsPipBtn").addEventListener("click", async () => {
      try {
        if (isInAnyPip(v) || document.pictureInPictureElement) await exitVideoPip(v);
        else await enterVideoPip(v);
      } catch (e) {}
      showHlsChrome();
    });
    const castBtn = document.getElementById("hlsCastBtn");
    if (castBtn)
      castBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        try {
          if (window.SDCast && typeof SDCast.prompt === "function") SDCast.prompt({ source: "hls-chrome" });
          else if (v.remote && v.remote.prompt) v.remote.prompt();
          else if (typeof showErr === "function") showErr("Cast not supported in this browser");
        } catch (err) {
          if (typeof showErr === "function") showErr("Cast unavailable");
        }
      });
    const shareBtn = document.getElementById("hlsShareBtn");
    if (shareBtn)
      shareBtn.addEventListener("click", () => {
        if (window.SDParty && SDParty.openShare) SDParty.openShare();
      });
    const partyBtn = document.getElementById("hlsPartyBtn");
    if (partyBtn)
      partyBtn.addEventListener("click", () => {
        if (window.SDParty && SDParty.openPanel) SDParty.openPanel();
      });
    const moreBtn = document.getElementById("pcMoreBtn");
    if (moreBtn)
      moreBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleMenu("pcMoreMenu");
        showHlsChrome(true);
      });
    if (trailerLayer && trailerLayer.dataset.hlsChromeBound !== "1") {
      trailerLayer.dataset.hlsChromeBound = "1";
      /*
       * Hotzone map (non-conflicting; party layouts clip to video pane via CSS):
       * ┌──────────────────────────────────────────────┐
       * │ TOP (~18%)     back / title — reveal chrome  │
       * │ EDGE L (~12%)  channel− / seek− (live/VOD)   │
       * │ CENTER         tap = toggle chrome           │
       * │ EDGE R (~12%)  channel+ / seek+ / party rail │
       * │ BOTTOM (~28%)  transport / scrub hotzone     │
       * └──────────────────────────────────────────────┘
       * Ignore: .party-drawer, #partyFab, #partyAvOverlay, .party-live-overlay, modals.
       * Marker classes: pc-hotzone-top|bottom|center|edge-l|edge-r, pc-hold-active
       */
      function chromeZoneFromEvent(e) {
        const layer = trailerLayer;
        if (!layer) return "center";
        const rect = layer.getBoundingClientRect();
        const y = (e.clientY != null ? e.clientY : (e.touches && e.touches[0] && e.touches[0].clientY)) || 0;
        const x = (e.clientX != null ? e.clientX : (e.touches && e.touches[0] && e.touches[0].clientX)) || 0;
        const partyOpen =
          layer.classList.contains("party-layout-hulu") ||
          layer.classList.contains("party-layout-rave") ||
          (document.getElementById("videoArea") &&
            (document.getElementById("videoArea").classList.contains("party-layout-hulu") ||
              document.getElementById("videoArea").classList.contains("party-layout-rave")));
        let rightEdge = rect.right;
        let leftEdge = rect.left;
        if (partyOpen) {
          const drawer = document.getElementById("partyDrawer");
          if (drawer && drawer.classList.contains("open")) {
            const dr = drawer.getBoundingClientRect();
            if (dr.left > leftEdge + 40) rightEdge = Math.min(rightEdge, dr.left);
            if (dr.top > leftEdge && layer.classList.contains("party-layout-rave")) {
              /* portrait rave: lower region is party */
            }
          }
        }
        if (partyOpen && x >= rightEdge) return "party";
        const relY = (y - rect.top) / Math.max(1, rect.height);
        const relX = (x - leftEdge) / Math.max(1, rightEdge - leftEdge);
        const va = document.getElementById("videoArea");
        if (
          (layer.classList.contains("party-layout-rave") || (va && va.classList.contains("party-layout-rave"))) &&
          relY > 0.55
        ) {
          return "party";
        }
        if (relY < 0.18) return "top";
        if (relY > 0.72) return "bottom";
        if (relX < 0.12) return "edge-l";
        if (relX > 0.88) return "edge-r";
        return "center";
      }
      trailerLayer.addEventListener("mousemove", (e) => {
        if (!vodHlsActive || (tvRoot && tvRoot.classList.contains("pc-controls-locked"))) return;
        if (partyChromeIgnore(e.target)) return;
        const z = chromeZoneFromEvent(e);
        if (z === "party") return;
        showHlsChrome();
      });
      trailerLayer.addEventListener("mouseleave", () => {
        if (v && v.paused) return;
        if (chromeOverlayBlockingHide()) return;
        hideHlsChrome();
      });
      trailerLayer.addEventListener(
        "touchstart",
        (e) => {
          if (partyChromeIgnore(e.target)) return;
          if (chromeZoneFromEvent(e) === "party") return;
          if (vodHlsActive && !(tvRoot && tvRoot.classList.contains("pc-controls-locked"))) showHlsChrome();
        },
        { passive: true }
      );
      // Center tap toggles chrome; top/bottom/edges reveal (don't steal control clicks)
      let lastCenterTap = 0;
      trailerLayer.addEventListener("click", (e) => {
        if (!vodHlsActive || (tvRoot && tvRoot.classList.contains("pc-controls-locked"))) return;
        if (partyChromeIgnore(e.target)) return;
        if (e.target.closest("button, input, .hls-menu, .hls-chrome, .pc-settings, .pc-xray-sheet")) return;
        const z = chromeZoneFromEvent(e);
        if (z === "party") return;
        if (z === "center") {
          const now = Date.now();
          // Defer to double-tap seek (±10s) — skip toggle on the second tap
          if (now - lastCenterTap < 280) {
            lastCenterTap = 0;
            return;
          }
          lastCenterTap = now;
          const barEl = document.getElementById("hlsChrome");
          if (barEl && barEl.classList.contains("show") && !barEl.classList.contains("pinned")) {
            hideHlsChrome(true);
          } else {
            showHlsChrome(false);
          }
          return;
        }
        showHlsChrome(false);
      });
    }
    v.addEventListener("timeupdate", onHlsTimeUpdate);
    v.addEventListener("progress", updateBuffered);
    v.addEventListener("play", () => {
      setPlayIcon();
      if (vodHlsActive) reportProgress("start");
      broadcastClockSoon();
      showHlsChrome(false);
    });
    v.addEventListener("pause", () => {
      setPlayIcon();
      if (vodHlsActive) reportProgress("pause");
      broadcastClockSoon();
      showHlsChrome(true);
    });
    v.addEventListener("ended", () => {
      if (vodHlsActive) reportProgress("stop");
      showHlsChrome(true);
    });
    document.addEventListener("click", (e) => {
      const openMenus = document.querySelectorAll(".hls-menu.open");
      if (!openMenus.length) return;
      if (e.target && e.target.closest && e.target.closest(".hls-menus, .hls-menu")) return;
      openMenus.forEach((m) => m.classList.remove("open"));
      showHlsChrome(false);
    });
    setPlayIcon();
  }

  function updateBuffered() {
    const fill = document.getElementById("pcBufFill");
    if (!fill || !v.duration) return;
    try {
      let end = 0;
      for (let i = 0; i < v.buffered.length; i++) {
        if (v.buffered.start(i) <= v.currentTime && v.buffered.end(i) > end) end = v.buffered.end(i);
      }
      fill.style.width = Math.min(100, (end / v.duration) * 100) + "%";
    } catch (e) {}
  }

  function updateCinemaTitle() {
    const ctx = vodPickerCtx || {};
    const titleEl = document.getElementById("pcTitle");
    const subEl = document.getElementById("pcSub");
    const eye = document.getElementById("pcEyebrow");
    if (titleEl) titleEl.textContent = ctx.title || "Now playing";
    if (eye) {
      eye.textContent =
        (ctx.mediaType || "movie") === "tv" || ctx.season
          ? "Series"
          : "Movie";
    }
    if (subEl) {
      const bits = [];
      if (ctx.season && ctx.episode) bits.push("S" + ctx.season + " · E" + ctx.episode);
      if (ctx.episodeName) bits.push(ctx.episodeName);
      subEl.textContent = bits.join(" — ");
    }
    try {
      syncMediaSession();
    } catch (e) {}
  }

  function toggleMenu(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const open = !el.classList.contains("open");
    document.querySelectorAll(".hls-menu").forEach((m) => m.classList.remove("open"));
    if (open) el.classList.add("open");
  }

  function onHlsTimeUpdate() {
    if (!vodHlsActive) return;
    const scrub = document.getElementById("hlsScrub");
    const timeEl = document.getElementById("hlsTime");
    const dur = v.duration || 0;
    if (scrub && dur > 0 && document.activeElement !== scrub) {
      scrub.value = String(Math.round((v.currentTime / dur) * 1000));
    }
    if (timeEl) timeEl.textContent = fmtClock(v.currentTime) + " / " + fmtClock(dur);
    paintSubtitles();
    const now = Date.now();
    if (now - lastProgressSent > 10000) {
      lastProgressSent = now;
      reportProgress(null);
    }
  }

  function broadcastClockSoon() {
    if (window.SDParty && SDParty.broadcastClock) SDParty.broadcastClock();
  }

  async function reportProgress(scrobble) {
    const ctx = vodPickerCtx;
    if (!ctx || !ctx.tmdbId || !vodHlsActive) return;
    const body = {
      tmdb_id: Number(ctx.tmdbId),
      type: ctx.mediaType || "movie",
      progress_seconds: v.currentTime || 0,
      duration_seconds: v.duration || 0,
      season: ctx.season || null,
      episode: ctx.episode || null,
      meta: { title: ctx.title || "" },
    };
    if (scrobble) body.scrobble = scrobble;
    try {
      await authFetch("/vod/library/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) {}
  }

  function renderQualityMenu() {
    const menu = document.getElementById("hlsQualityMenu");
    const btn = document.getElementById("hlsQualityBtn");
    if (!menu) return;
    menu.innerHTML = "";
    const mk = (label, level) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      if (hls && hls.currentLevel === level) b.classList.add("active");
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        if (hls) hls.currentLevel = level;
        if (btn) btn.textContent = label;
        menu.classList.remove("open");
      });
      menu.appendChild(b);
    };
    mk("Auto", -1);
    if (hls && hls.levels && hls.levels.length) {
      hls.levels.forEach((lv, i) => {
        const h = lv.height || 0;
        mk(h ? h + "p" : "Level " + (i + 1), i);
      });
    }
  }

  async function loadSubtitlesForCtx(ctx) {
    const menu = document.getElementById("hlsCcMenu");
    if (!menu || !ctx || !ctx.tmdbId) return;
    menu.innerHTML = '<button type="button" disabled>Loading…</button>';
    let url =
      "/vod/subtitles?tmdb_id=" +
      encodeURIComponent(ctx.tmdbId) +
      "&type=" +
      encodeURIComponent(ctx.mediaType || "movie");
    if (ctx.season) url += "&season=" + encodeURIComponent(ctx.season);
    if (ctx.episode) url += "&episode=" + encodeURIComponent(ctx.episode);
    const lang = lsGet(LS_SUB_LANG, "");
    if (lang) url += "&lang=" + encodeURIComponent(lang);
    try {
      const r = await authFetch(url, { cache: "no-store" });
      const data = await r.json();
      subTracks = data.tracks || [];
    } catch (e) {
      subTracks = [];
    }
    menu.innerHTML = "";
    const off = document.createElement("button");
    off.type = "button";
    off.textContent = "Off";
    off.addEventListener("click", (e) => {
      e.stopPropagation();
      clearSubtitles();
      menu.classList.remove("open");
    });
    menu.appendChild(off);
    for (const t of subTracks) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = (t.display || t.language || "Track") + (t.hearing_impaired ? " (HI)" : "");
      if (activeSubUrl === t.url) b.classList.add("active");
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        applySubtitle(t);
        menu.classList.remove("open");
      });
      menu.appendChild(b);
    }
    if (!subTracks.length) {
      const empty = document.createElement("button");
      empty.type = "button";
      empty.disabled = true;
      empty.textContent = "No tracks found";
      menu.appendChild(empty);
    }
  }

  function clearSubtitles() {
    activeSubUrl = null;
    subCues = [];
    const overlay = document.getElementById("sdSubOverlay");
    if (overlay) {
      overlay.hidden = true;
      overlay.textContent = "";
    }
    [...v.querySelectorAll("track[data-sd-sub]")].forEach((t) => t.remove());
  }

  function parseVtt(text) {
    const cues = [];
    const blocks = String(text || "").replace(/\r/g, "").split(/\n\n+/);
    const re = /(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})/;
    function toSec(ts) {
      const p = ts.replace(",", ".").split(":");
      return Number(p[0]) * 3600 + Number(p[1]) * 60 + Number(p[2]);
    }
    for (const block of blocks) {
      const lines = block.split("\n").filter(Boolean);
      if (!lines.length) continue;
      let i = 0;
      if (/^\d+$/.test(lines[0])) i = 1;
      const m = lines[i] && lines[i].match(re);
      if (!m) continue;
      cues.push({ start: toSec(m[1]), end: toSec(m[2]), text: lines.slice(i + 1).join("\n") });
    }
    return cues;
  }

  async function applySubtitle(track) {
    clearSubtitles();
    if (!track || !track.url) return;
    activeSubUrl = track.url;
    try {
      const r = await authFetch("/vod/subtitles/fetch?url=" + encodeURIComponent(track.url), {
        cache: "force-cache",
      });
      const text = await r.text();
      subCues = parseVtt(text);
      applySubStyle();
      paintSubtitles();
    } catch (e) {
      if (typeof showErr === "function") showErr("Subtitle load failed");
    }
  }

  function applySubStyle() {
    const overlay = document.getElementById("sdSubOverlay");
    if (!overlay) return;
    overlay.style.setProperty("--sd-sub-size", (lsGet(LS_SUB_SIZE, "22") || "22") + "px");
    overlay.style.setProperty("--sd-sub-color", lsGet(LS_SUB_COLOR, "#ffffff") || "#ffffff");
    overlay.dataset.pos = lsGet(LS_SUB_POS, "bottom") || "bottom";
  }

  function paintSubtitles() {
    const overlay = document.getElementById("sdSubOverlay");
    if (!overlay || !subCues.length) return;
    const offset = Number(lsGet("sd_sub_offset", "0") || 0) / 1000;
    const t = (v.currentTime || 0) + offset;
    let text = "";
    for (const c of subCues) {
      if (t >= c.start && t <= c.end) {
        text = c.text;
        break;
      }
    }
    overlay.hidden = !text;
    overlay.textContent = text;
  }

  async function injectContinueWatching() {
    if (!vodCatalogBody) return;
    try {
      const r = await authFetch("/vod/library/continue?limit=24", { cache: "no-store" });
      if (!r.ok) return;
      const data = await r.json();
      const items = data.items || [];
      if (!items.length) return;
      const existing = vodCatalogBody.querySelector('[data-cw="1"]');
      if (existing) existing.remove();
      const sec = renderVodSection(
        "Continue Watching",
        items,
        false,
        (idx) => [vodQueueItem(items[idx].type, items[idx].tmdb_id)]
      );
      sec.dataset.cw = "1";
      sec.querySelectorAll(".vod-card").forEach((card, i) => {
        const it = items[i];
        const wrap = card.querySelector(".vod-poster-wrap") || card;
        const bar = document.createElement("div");
        bar.className = "cw-bar";
        const pct = Math.max(2, Math.min(94, Number(it.percent) || 0));
        bar.innerHTML = "<i style=\"width:" + pct + '%"></i>';
        wrap.appendChild(bar);
        card.addEventListener(
          "click",
          () => {
            resumeSeek = {
              tmdbId: String(it.tmdb_id),
              seconds: Number(it.progress_seconds) || 0,
              season: it.season,
              episode: it.episode,
            };
          },
          true
        );
      });
      vodCatalogBody.insertBefore(sec, vodCatalogBody.firstChild);
    } catch (e) {}
  }

  function prefetchResolve(ctx) {
    if (!prefetchEnabled() || !ctx || !ctx.tmdbId || !vodDirectHlsEnabled()) return;
    let url =
      "/vod/resolve?tmdb_id=" +
      encodeURIComponent(ctx.tmdbId) +
      "&type=" +
      encodeURIComponent(ctx.mediaType || "movie");
    if (ctx.season) url += "&season=" + encodeURIComponent(ctx.season);
    if (ctx.episode) url += "&episode=" + encodeURIComponent(ctx.episode);
    const pref = getLastGood(ctx);
    if (pref) url += "&provider=" + encodeURIComponent(pref);
    authFetch(url, { cache: "no-store" }).catch(() => {});
  }

  function installSettingsExtras() {
    const drawer = document.getElementById("settingsDrawer");
    if (!drawer || drawer.dataset.featSettings === "1") return;
    drawer.dataset.featSettings = "1";
    const host = drawer.querySelector(".settings-body") || drawer;
    const block = document.createElement("div");
    block.innerHTML =
      '<div class="settings-section"><h3>Subtitles</h3>' +
      '<label class="setting-row"><span class="setting-label">Preferred language' +
      '<span class="setting-sub">ISO code, e.g. en</span></span>' +
      '<input id="sdSubLang" type="text" maxlength="8" style="width:72px;text-align:center"/></label>' +
      '<label class="setting-row"><span class="setting-label">Size</span>' +
      '<input id="sdSubSize" type="number" min="14" max="48" style="width:72px"/></label>' +
      '<label class="setting-row"><span class="setting-label">Color</span>' +
      '<input id="sdSubColor" type="color"/></label>' +
      '<label class="setting-row"><span class="setting-label">Position</span>' +
      '<select id="sdSubPos"><option value="bottom">Bottom</option>' +
      '<option value="middle">Middle</option><option value="top">Top</option></select></label></div>' +
      '<div class="settings-section"><h3>Party</h3>' +
      '<label class="setting-row"><span class="setting-label">Display name</span>' +
      '<input id="sdPartyName" type="text" maxlength="32" style="width:140px"/></label>' +
      '<label class="setting-row"><span class="setting-label">Call provider' +
      '<span class="setting-sub">Built-in is free &amp; unlimited; Jitsi public demo ~5 min</span></span>' +
      '<select id="sdPartyAvProvider"><option value="webrtc">Built-in (free)</option>' +
      '<option value="jitsi">Jitsi (demo limit)</option></select></label></div>' +
      '<div class="settings-section"><h3>Playback</h3>' +
      '<label class="setting-row" for="sdPrefetchToggle"><span class="setting-label">Prefetch streams' +
      '<span class="setting-sub">Warm /vod/resolve when opening a title</span></span>' +
      '<input type="checkbox" id="sdPrefetchToggle"/></label>' +
      '<label class="setting-row" for="sdPipToggle"><span class="setting-label">Offer PiP on HLS start</span>' +
      '<input type="checkbox" id="sdPipToggle"/></label>' +
      '<label class="setting-row" for="sdAutoPipBg"><span class="setting-label">Auto PiP when leaving tab' +
      '<span class="setting-sub">Keep playing in PiP / background when switching apps</span></span>' +
      '<input type="checkbox" id="sdAutoPipBg"/></label></div>';
    const dataSec = host.querySelector(".settings-section:last-child");
    if (dataSec) host.insertBefore(block, dataSec);
    else host.appendChild(block);
    const lang = document.getElementById("sdSubLang");
    const size = document.getElementById("sdSubSize");
    const color = document.getElementById("sdSubColor");
    const pos = document.getElementById("sdSubPos");
    const pname = document.getElementById("sdPartyName");
    const pav = document.getElementById("sdPartyAvProvider");
    const pref = document.getElementById("sdPrefetchToggle");
    const pip = document.getElementById("sdPipToggle");
    const autoPip = document.getElementById("sdAutoPipBg");
    if (lang) lang.value = lsGet(LS_SUB_LANG, "en");
    if (size) size.value = lsGet(LS_SUB_SIZE, "22");
    if (color) color.value = lsGet(LS_SUB_COLOR, "#ffffff");
    if (pos) pos.value = lsGet(LS_SUB_POS, "bottom");
    if (pname) pname.value = lsGet(LS_PARTY_NAME, "Guest");
    if (pav) {
      const cur =
        (window.SDPartyAV && SDPartyAV.getProvider && SDPartyAV.getProvider()) ||
        lsGet("sd_party_av_provider", "webrtc");
      pav.value = cur === "jitsi" ? "jitsi" : "webrtc";
    }
    if (pref) pref.checked = prefetchEnabled();
    if (pip) pip.checked = lsGet(LS_PIP, "0") === "1";
    {
      const isAndroid = /Android/i.test(navigator.userAgent || "");
      const autoPipDef = isAndroid ? "0" : "1";
      if (autoPip) autoPip.checked = lsGet(LS_AUTO_PIP_BG, autoPipDef) !== "0";
    }
    const save = () => {
      if (lang) lsSet(LS_SUB_LANG, lang.value.trim());
      if (size) lsSet(LS_SUB_SIZE, String(size.value || "22"));
      if (color) lsSet(LS_SUB_COLOR, color.value || "#ffffff");
      if (pos) lsSet(LS_SUB_POS, pos.value || "bottom");
      if (pname) lsSet(LS_PARTY_NAME, pname.value.trim() || "Guest");
      if (pav) {
        const next = pav.value === "jitsi" ? "jitsi" : "webrtc";
        if (window.SDPartyAV && SDPartyAV.setProvider) SDPartyAV.setProvider(next);
        else lsSet("sd_party_av_provider", next);
      }
      if (pref) lsSet(LS_PREFETCH, pref.checked ? "1" : "0");
      if (pip) lsSet(LS_PIP, pip.checked ? "1" : "0");
      if (autoPip) lsSet(LS_AUTO_PIP_BG, autoPip.checked ? "1" : "0");
      applySubStyle();
    };
    [lang, size, color, pos, pname, pav, pref, pip, autoPip].forEach((el) => {
      if (el) el.addEventListener("change", save);
    });
  }

  // --- wrap core player functions (same script scope via bundle) ---
  const _loadHome = loadVodCatalogHome;
  loadVodCatalogHome = async function () {
    await _loadHome.apply(this, arguments);
    await injectContinueWatching();
  };

  const _showDetailUI = showVodDetailUI;
  showVodDetailUI = async function (tmdbId, mediaType) {
    await _showDetailUI.apply(this, arguments);
    const mt = mediaType === "tv" ? "tv" : "movie";
    const d = vodCatalogDetail;
    const ctx = {
      tmdbId: String(tmdbId),
      mediaType: mt,
      season: mt === "tv" ? "1" : "",
      episode: mt === "tv" ? "1" : "",
      title: (d && d.title) || "",
    };
    if (d && d.type === "tv") {
      const sel = document.getElementById("vodSeasonSelect");
      ctx.season = sel ? sel.value : "1";
    }
    prefetchResolve(ctx);
    // Detail share affordance (Start party is wired in player_app detail actions)
    const actionHost = document.querySelector(".vod-detail-actions");
    if (actionHost && !document.getElementById("vodShareBtn")) {
      const b = document.createElement("button");
      b.type = "button";
      b.id = "vodShareBtn";
      b.className = "trailer";
      b.textContent = "Share";
      b.addEventListener("click", () => {
        if (window.SDParty && SDParty.openShare) SDParty.openShare({ detail: d || ctx });
      });
      actionHost.appendChild(b);
    }
  };

  const _tryAuto = tryAutoVodHls;
  tryAutoVodHls = async function (ctx, returnKind, opts) {
    if (!ctx || !ctx.tmdbId || !vodDirectHlsEnabled()) return false;
    const pref = getLastGood(ctx);
    // Don't prefer known adware last-good for Auto.
    const riskyLast = /^(2embed|2embedskin|moviesapi)$/i.test(String(pref || ""));
    if (pref && !riskyLast) {
      opts = opts || {};
      const timeoutMs = opts.timeoutMs != null ? opts.timeoutMs : 7000;
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      try {
        let url =
          "/vod/resolve?tmdb_id=" +
          encodeURIComponent(ctx.tmdbId) +
          "&type=" +
          encodeURIComponent(ctx.mediaType || "movie");
        if (ctx.season) url += "&season=" + encodeURIComponent(ctx.season);
        if (ctx.episode) url += "&episode=" + encodeURIComponent(ctx.episode);
        url += "&provider=" + encodeURIComponent(pref);
        const fetchOpts = { cache: "no-store" };
        if (controller) fetchOpts.signal = controller.signal;
        const r = await authFetch(url, fetchOpts);
        if (r.ok) {
          const data = await r.json();
          if (isPlayableDirectVod(data)) {
            setLastGood(ctx, data.provider || data.origin || pref);
            await playDirectVodFromResolve(data, returnKind, ctx);
            return true;
          }
        }
      } catch (e) {
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    const ok = await _tryAuto.call(this, ctx, returnKind, opts);
    return ok;
  };

  const _playSource = playVodSource;
  playVodSource = async function (source, ctx) {
    await _playSource.apply(this, arguments);
    if (source && ctx && vodHlsActive && (source.id || source.provider)) {
      setLastGood(ctx, source.id || source.provider);
    }
  };

  const _playHls = playVodHlsInPlayer;
  playVodHlsInPlayer = async function (streamUrl, returnKind, pickerCtx) {
    await _playHls.apply(this, arguments);
    ensureHlsChromeDom();
    if (window.SDCinema && SDCinema.onChromeReady) SDCinema.onChromeReady();
    applySubStyle();
    showHlsChrome();
    const ctx = pickerCtx || vodPickerCtx;
    if (resumeSeek && ctx && String(resumeSeek.tmdbId) === String(ctx.tmdbId)) {
      const sec = resumeSeek.seconds;
      resumeSeek = null;
      const seekOnce = () => {
        if (v.duration && v.duration > sec + 2) {
          try {
            v.currentTime = sec;
          } catch (e) {}
          v.removeEventListener("loadedmetadata", seekOnce);
        }
      };
      v.addEventListener("loadedmetadata", seekOnce);
      setTimeout(seekOnce, 800);
    }
    if (lsGet(LS_PIP, "0") === "1" && v.requestPictureInPicture) {
      setTimeout(() => {
        v.requestPictureInPicture().catch(() => {});
      }, 1200);
    }
    lastProgressSent = 0;
    reportProgress("start");
    if (ctx) loadSubtitlesForCtx(ctx);
    if (window.SDParty && SDParty.onHlsStarted) SDParty.onHlsStarted(ctx);
  };

  if (typeof playVodFileInPlayer === "function") {
    const _playFile = playVodFileInPlayer;
    playVodFileInPlayer = async function (streamUrl, returnKind, pickerCtx) {
      await _playFile.apply(this, arguments);
      ensureHlsChromeDom();
      if (window.SDCinema && SDCinema.onChromeReady) SDCinema.onChromeReady();
      applySubStyle();
      showHlsChrome();
      lastProgressSent = 0;
      reportProgress("start");
      const ctx = pickerCtx || vodPickerCtx;
      if (ctx) loadSubtitlesForCtx(ctx);
      if (window.SDParty && SDParty.onHlsStarted) SDParty.onHlsStarted(ctx);
    };
  }

  const _attach = attachHls;
  attachHls = async function (url) {
    await _attach.apply(this, arguments);
    if (vodHlsActive && hls) {
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        renderQualityMenu();
        const btn = document.getElementById("hlsQualityBtn");
        if (btn) btn.textContent = "Auto";
      });
    }
  };

  const _openSettings = openSettingsDrawer;
  openSettingsDrawer = function () {
    installSettingsExtras();
    _openSettings.apply(this, arguments);
  };

  installSettingsExtras();
  ensureHlsChromeDom();

  /* ---- Media Session API (marker: mediaSession) + background keep-alive / PiP ---- */
  const MS_SITE_ICON = "/tv-assets/icon-512.png";

  let bgWasPlaying = false;
  let bgEnteredPip = false;
  let msWantImmersiveReturn = false;
  let bgKeepAliveWired = false;
  let bgReturnTimer = null;

  function typingTarget(el) {
    if (!el) return false;
    const tag = (el.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (el.isContentEditable) return true;
    return !!(el.closest && el.closest("input, textarea, select, [contenteditable='true']"));
  }

  function absMediaUrl(src) {
    if (!src || typeof src !== "string") return "";
    const s = src.trim();
    if (!s || s.startsWith("data:") || s.startsWith("blob:")) return "";
    try {
      return new URL(s, location.href).href;
    } catch (e) {
      return "";
    }
  }

  function isPlaceholderTitle(t) {
    if (!t) return true;
    const low = String(t).trim().toLowerCase();
    return !low || low === "title" || low === "loading…" || low === "loading..." || low === "now playing";
  }

  function isChannelIndexLabel(t) {
    return /^ch\s+\d+\s*\/\s*\d+$/i.test(String(t || "").trim());
  }

  function currentChannelRecord() {
    try {
      const id = String(
        (typeof headerMeta !== "undefined" && headerMeta && (headerMeta.channel_id || headerMeta.id)) ||
          (typeof channelId !== "undefined" && channelId) ||
          ""
      );
      const fromMap =
        id && typeof channelMap !== "undefined" && channelMap
          ? channelMap[id] || channelMap[String(id)] || null
          : null;
      const name =
        (typeof headerMeta !== "undefined" && headerMeta && headerMeta.name) ||
        (fromMap && fromMap.name) ||
        (id ? "Channel " + id : "");
      const logo =
        (fromMap && fromMap.logo) ||
        (typeof headerMeta !== "undefined" && headerMeta && headerMeta.logo) ||
        "";
      const number =
        (typeof headerMeta !== "undefined" && headerMeta && headerMeta.number) ||
        (fromMap && fromMap.number) ||
        null;
      return { id, name: String(name || ""), logo: String(logo || ""), number };
    } catch (e) {
      return { id: "", name: "", logo: "", number: null };
    }
  }

  function currentEpgNow() {
    try {
      const ch = currentChannelRecord();
      if (!ch.id) return null;
      if (typeof getCachedEntry === "function" && typeof epgCache !== "undefined") {
        const epg = getCachedEntry(epgCache, String(ch.id));
        if (epg && epg.now) return epg.now;
      }
    } catch (e) {}
    return null;
  }

  function watchingVodNow() {
    try {
      if (typeof vodHlsActive !== "undefined" && vodHlsActive) return true;
      if (location.pathname.startsWith("/vod")) return true;
    } catch (e) {}
    return false;
  }

  function programmeArtworkUrl() {
    try {
      if (typeof currentTitleMeta !== "undefined" && currentTitleMeta && currentTitleMeta.meta) {
        const m = currentTitleMeta.meta;
        const u = absMediaUrl(m.poster_url || m.backdrop_url || "");
        if (u) return u;
      }
    } catch (e) {}
    try {
      if (typeof vodPickerCtx !== "undefined" && vodPickerCtx) {
        const u = absMediaUrl(
          vodPickerCtx.poster_url ||
            vodPickerCtx.poster ||
            vodPickerCtx.posterUrl ||
            (vodPickerCtx.posterPath && String(vodPickerCtx.posterPath).startsWith("http")
              ? vodPickerCtx.posterPath
              : "") ||
            ""
        );
        if (u) return u;
      }
    } catch (e) {}
    const imgs = [
      document.getElementById("cinemaPosterLg"),
      document.getElementById("chromePoster"),
      document.getElementById("hdrPoster"),
      document.querySelector(".hdr-poster.show"),
    ];
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i];
      if (!img) continue;
      const raw = img.getAttribute("src") || img.src || "";
      const u = absMediaUrl(raw);
      if (u) return u;
    }
    return "";
  }

  function siteIconArtworkUrl() {
    try {
      const link = document.querySelector(
        'link[rel="apple-touch-icon"], link[rel="icon"][sizes="512x512"], link[rel="icon"]'
      );
      if (link && link.href) {
        const u = absMediaUrl(link.href);
        if (u) return u;
      }
    } catch (e) {}
    return absMediaUrl(MS_SITE_ICON) || absMediaUrl("/tv-assets/icon-192.png");
  }

  function buildMediaArtwork() {
    const out = [];
    const seen = {};
    function push(src, sizes, type) {
      const u = absMediaUrl(src);
      if (!u || seen[u]) return;
      seen[u] = true;
      out.push({ src: u, sizes: sizes || "512x512", type: type || "image/png" });
    }
    // Priority: programme/VOD poster → channel logo → site icon (never empty for Android)
    const prog = programmeArtworkUrl();
    if (prog) push(prog, "512x512", "image/jpeg");
    const logo = absMediaUrl(currentChannelRecord().logo);
    if (logo) push(logo, "512x512", "image/png");
    push(siteIconArtworkUrl(), "512x512", "image/png");
    if (!out.length) push(MS_SITE_ICON, "512x512", "image/png");
    return out;
  }

  function mediaMetaFromDom() {
    const ch = currentChannelRecord();
    const epgNow = currentEpgNow();
    const vod = watchingVodNow();
    let title = "";
    let artist = "";
    let album = "";

    if (vod) {
      const pcTitle = document.getElementById("pcTitle");
      const pcSub = document.getElementById("pcSub");
      const ctx = typeof vodPickerCtx !== "undefined" ? vodPickerCtx : null;
      title =
        (ctx && (ctx.episodeName || ctx.title || ctx.name)) ||
        (pcTitle && pcTitle.textContent.trim()) ||
        "";
      if (isPlaceholderTitle(title)) title = (ctx && ctx.title) || "On Demand";
      artist =
        (pcSub && pcSub.textContent.trim()) ||
        (ctx && ((ctx.mediaType || ctx.media_type) === "tv" ? "Series" : "Movie")) ||
        "On Demand";
      album = "VOD";
    } else {
      if (epgNow) {
        title = String(epgNow.title || "").trim();
      }
      if (isPlaceholderTitle(title)) {
        const hdr =
          document.querySelector("#nowOnAir .hdr-title, #chromeOnAir .hdr-title") ||
          document.querySelector("#cinemaTitle");
        const hdrText = hdr && hdr.textContent.trim();
        if (hdrText && !isPlaceholderTitle(hdrText) && !isChannelIndexLabel(hdrText)) title = hdrText;
      }
      if (isPlaceholderTitle(title)) title = ch.name || "Live TV";
      artist = ch.name || "Live TV";
      const albumBits = ["Live"];
      if (ch.number != null && ch.number !== "") albumBits.push("Ch " + ch.number);
      else if (ch.id) albumBits.push("Ch " + ch.id);
      album = albumBits.join(" · ");
    }

    if (isChannelIndexLabel(artist)) artist = ch.name || (vod ? "On Demand" : "Live TV");
    if (isPlaceholderTitle(title)) title = ch.name || document.title || "StepDaddyLiveHD";

    // Never surface raw "Ch N / M" as the notification title
    if (isChannelIndexLabel(title)) title = ch.name || "Live TV";

    return {
      title: String(title).slice(0, 120),
      artist: String(artist).slice(0, 80),
      album: String(album).slice(0, 80),
      artwork: buildMediaArtwork(),
    };
  }

  function updateDocumentTitleFromPlayback() {
    try {
      const meta = mediaMetaFromDom();
      const base = meta.title || "TV Guide";
      if (base && !isPlaceholderTitle(base) && !isChannelIndexLabel(base)) {
        document.title = base + " — StepDaddyLiveHD";
      }
    } catch (e) {}
  }

  function syncMediaSession() {
    if (!("mediaSession" in navigator)) return;
    const v = document.getElementById("v");
    if (!v) return;
    try {
      const meta = mediaMetaFromDom();
      navigator.mediaSession.metadata = new MediaMetadata(meta);
      navigator.mediaSession.playbackState = v.paused ? "paused" : "playing";
      updateDocumentTitleFromPlayback();
      if (isFinite(v.duration) && v.duration > 0 && isFinite(v.currentTime)) {
        navigator.mediaSession.setPositionState({
          duration: v.duration,
          playbackRate: v.playbackRate || 1,
          position: Math.min(v.currentTime, v.duration),
        });
      }
    } catch (e) {}
  }

  function msSeek(delta) {
    const v = document.getElementById("v");
    if (!v || !isFinite(v.duration) || v.duration <= 0) return;
    try {
      v.currentTime = Math.max(0, Math.min(v.duration - 0.25, v.currentTime + delta));
    } catch (e) {}
    syncMediaSession();
  }

  function msChannelStep(dir) {
    try {
      if (typeof window.SDStepChannel === "function") {
        window.SDStepChannel(dir);
        return;
      }
    } catch (e) {}
    try {
      const ids = typeof orderIds !== "undefined" ? orderIds : null;
      const cur = typeof channelId !== "undefined" ? channelId : null;
      if (ids && ids.length && typeof switchChannel === "function") {
        let idx = ids.indexOf(String(cur));
        if (idx < 0) idx = 0;
        const next = ids[(idx + dir + ids.length) % ids.length];
        if (next) switchChannel(next);
        return;
      }
    } catch (e2) {}
  }

  function autoPipBgEnabled() {
    // Default OFF on Android: Auto PiP (20260907q) remounts the Qualcomm HW decoder and
    // correlates with Chrome ImageReader "no buffers" green/black paint on S23.
    const isAndroid = /Android/i.test(navigator.userAgent || "");
    const def = isAndroid ? "0" : "1";
    return lsGet(LS_AUTO_PIP_BG, def) !== "0";
  }

  function ensureVideoBgAttrs(vid) {
    if (!vid) return;
    try {
      vid.setAttribute("playsinline", "");
      vid.setAttribute("webkit-playsinline", "");
      vid.playsInline = true;
    } catch (e) {}
    try {
      vid.disablePictureInPicture = false;
    } catch (e) {}
    // Hint Chromium/Android/Safari: keep media eligible for AirPlay / remote / lock-screen
    try {
      if (!vid.hasAttribute("x-webkit-airplay")) vid.setAttribute("x-webkit-airplay", "allow");
      if (!vid.hasAttribute("airplay")) vid.setAttribute("airplay", "allow");
      try { vid.disableRemotePlayback = false; } catch (e2) {}
      try { vid.removeAttribute("disableRemotePlayback"); } catch (e3) {}
    } catch (e) {}
  }

  function isInAnyPip(vid) {
    try {
      if (document.pictureInPictureElement) return true;
    } catch (e) {}
    try {
      if (vid && typeof vid.webkitPresentationMode === "string" && vid.webkitPresentationMode === "picture-in-picture") {
        return true;
      }
    } catch (e) {}
    try {
      if (document.pictureInPictureElement === vid) return true;
    } catch (e) {}
    return false;
  }

  async function enterVideoPip(vid) {
    const v = vid || document.getElementById("v");
    if (!v || v.paused) return false;
    ensureVideoBgAttrs(v);
    if (isInAnyPip(v)) return true;
    // Standard video PiP (Chrome Android / desktop / Safari where enabled)
    try {
      if (document.pictureInPictureEnabled !== false && typeof v.requestPictureInPicture === "function") {
        await v.requestPictureInPicture();
        return true;
      }
    } catch (e) {}
    // iOS Safari / WKWebView
    try {
      if (typeof v.webkitSupportsPresentationMode === "function" && v.webkitSupportsPresentationMode("picture-in-picture")) {
        v.webkitSetPresentationMode("picture-in-picture");
        return true;
      }
    } catch (e) {}
    try {
      if (typeof v.webkitSetPresentationMode === "function") {
        v.webkitSetPresentationMode("picture-in-picture");
        return true;
      }
    } catch (e) {}
    return false;
  }

  async function exitVideoPip(vid) {
    const v = vid || document.getElementById("v");
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
    } catch (e) {}
    try {
      if (v && typeof v.webkitPresentationMode === "string" && v.webkitPresentationMode === "picture-in-picture") {
        v.webkitSetPresentationMode("inline");
      }
    } catch (e) {}
  }

  async function enterPlayerFullscreen() {
    const v = document.getElementById("v");
    const area = document.getElementById("videoArea") || document.documentElement;
    try {
      if (typeof applyGuideState === "function") applyGuideState(true);
    } catch (e) {}
    document.body.classList.add("sd-immersive", "sd-fs");
    try {
      if (window.SDMobile && typeof SDMobile.enterImmersive === "function") {
        await SDMobile.enterImmersive(area);
        return;
      }
    } catch (e) {}
    try {
      if (v && typeof v.webkitEnterFullscreen === "function" && /iPhone|iPad|iPod/i.test(navigator.userAgent || "")) {
        v.webkitEnterFullscreen();
        return;
      }
    } catch (e) {}
    try {
      if (!document.fullscreenElement) {
        if (area.requestFullscreen) await area.requestFullscreen({ navigationUI: "hide" });
        else if (area.webkitRequestFullscreen) area.webkitRequestFullscreen();
      }
    } catch (e) {}
  }

  function markMediaSessionReturn() {
    msWantImmersiveReturn = true;
  }

  function resumePlaybackIfNeeded() {
    const v = document.getElementById("v");
    if (!v) return;
    ensureVideoBgAttrs(v);
    // Never auto-pause on hide; if the browser paused us, nudge play when allowed.
    if (v.paused && (bgWasPlaying || msWantImmersiveReturn)) {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
    syncMediaSession();
  }

  async function onPageHiddenKeepAlive() {
    const v = document.getElementById("v");
    if (!v) return;
    bgWasPlaying = !v.paused && !v.ended;
    // Explicitly do NOT pause — mobile browsers often kill playback unless PiP / Media Session.
    if (!bgWasPlaying) return;
    syncMediaSession();
    if (!autoPipBgEnabled()) return;
    // Auto-request PiP mainly on phones; desktop relies on Media Session enterpictureinpicture.
    if (!preferImmersiveReturn()) return;
    const ok = await enterVideoPip(v);
    if (ok) bgEnteredPip = true;
  }

  function preferImmersiveReturn() {
    try {
      if (window.SDMobile && SDMobile.isMobile && SDMobile.isMobile()) return true;
    } catch (e) {}
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
  }

  async function onPageVisibleRestore() {
    const v = document.getElementById("v");
    if (bgReturnTimer) {
      clearTimeout(bgReturnTimer);
      bgReturnTimer = null;
    }
    // Small delay so focus/gesture from notification tap can satisfy fullscreen policies.
    bgReturnTimer = setTimeout(async () => {
      bgReturnTimer = null;
      resumePlaybackIfNeeded();
      // If live stalled after background/PiP, soft-reconnect / hard-remount (20260907r).
      try {
        const healthy =
          typeof window.__sdLivePlaybackHealthy === "function"
            ? window.__sdLivePlaybackHealthy()
            : !!(v && !v.paused && v.readyState >= 2 && !v.error);
        if (!healthy && typeof window.__sdRecoverLivePlayback === "function") {
          window.__sdRecoverLivePlayback("visibility-restore");
        }
      } catch (e) {}
      const fromPip = bgEnteredPip || isInAnyPip(v);
      const wantFs = msWantImmersiveReturn || (fromPip && preferImmersiveReturn());
      if (fromPip) {
        try {
          await exitVideoPip(v);
        } catch (e) {}
        bgEnteredPip = false;
      }
      // Desktop tab switch: reattach player only. Mobile / media-session: go immersive.
      if (wantFs && preferImmersiveReturn()) {
        msWantImmersiveReturn = false;
        try {
          await enterPlayerFullscreen();
        } catch (e) {}
      } else {
        msWantImmersiveReturn = false;
      }
      syncMediaSession();
      bgWasPlaying = false;
    }, 80);
  }

  function wireBackgroundKeepAlive() {
    if (bgKeepAliveWired) return;
    bgKeepAliveWired = true;
    const v = document.getElementById("v");
    ensureVideoBgAttrs(v);

    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden || document.visibilityState === "hidden") {
          onPageHiddenKeepAlive();
        } else {
          onPageVisibleRestore();
        }
      },
      { passive: true }
    );

    // iOS / some Android paths fire pagehide without a reliable visibilitychange order.
    window.addEventListener(
      "pagehide",
      () => {
        onPageHiddenKeepAlive();
      },
      { passive: true }
    );

    window.addEventListener(
      "pageshow",
      () => {
        if (!document.hidden) onPageVisibleRestore();
      },
      { passive: true }
    );

    if (v) {
      v.addEventListener(
        "enterpictureinpicture",
        () => {
          bgEnteredPip = true;
          syncMediaSession();
        },
        { passive: true }
      );
      v.addEventListener(
        "leavepictureinpicture",
        () => {
          bgEnteredPip = false;
          // Returning from OS PiP UI — reattach immersive player when page is visible.
          if (!document.hidden) {
            msWantImmersiveReturn = true;
            onPageVisibleRestore();
          }
        },
        { passive: true }
      );
      // If the browser pauses us while hidden, flip back when possible (no intentional pause-on-hide).
      v.addEventListener(
        "pause",
        () => {
          if (!document.hidden) return;
          if (!bgWasPlaying && !msWantImmersiveReturn) return;
          // Defer: some browsers pause briefly during PiP transition.
          setTimeout(() => {
            if (!document.hidden) return;
            const vid = document.getElementById("v");
            if (!vid || !vid.paused) return;
            if (isInAnyPip(vid)) {
              vid.play().catch(() => {});
              return;
            }
            // Still hidden without PiP — keep trying play for background audio where allowed.
            vid.play().catch(() => {});
            syncMediaSession();
          }, 120);
        },
        { passive: true }
      );
    }
  }

  function wireMediaSession() {
    if (!("mediaSession" in navigator) || navigator.mediaSession.__sdWired) return;
    navigator.mediaSession.__sdWired = true;
    const v = document.getElementById("v");
    ensureVideoBgAttrs(v);

    const wrapMs = (fn) => {
      return function () {
        markMediaSessionReturn();
        try {
          fn.apply(null, arguments);
        } catch (e) {}
        // Notification / lock-screen tap often focuses the tab — request immersive ASAP.
        if (!document.hidden) {
          onPageVisibleRestore();
        }
        syncMediaSession();
      };
    };

    const actions = [
      [
        "play",
        wrapMs(() => {
          const vid = document.getElementById("v");
          if (vid) vid.play().catch(() => {});
        }),
      ],
      [
        "pause",
        () => {
          // User-initiated pause from notification — honor it (do not set immersive return).
          const vid = document.getElementById("v");
          if (vid) vid.pause();
          bgWasPlaying = false;
          syncMediaSession();
        },
      ],
      [
        "stop",
        () => {
          const vid = document.getElementById("v");
          if (vid) {
            vid.pause();
            try {
              vid.currentTime = 0;
            } catch (e) {}
          }
          bgWasPlaying = false;
          syncMediaSession();
        },
      ],
      ["seekbackward", wrapMs((d) => msSeek(-((d && d.seekOffset) || 10)))],
      ["seekforward", wrapMs((d) => msSeek((d && d.seekOffset) || 10))],
      ["previoustrack", wrapMs(() => msChannelStep(-1))],
      ["nexttrack", wrapMs(() => msChannelStep(1))],
    ];
    actions.forEach(([name, fn]) => {
      try {
        navigator.mediaSession.setActionHandler(name, fn);
      } catch (e) {}
    });
    try {
      navigator.mediaSession.setActionHandler(
        "seekto",
        wrapMs((d) => {
          const vid = document.getElementById("v");
          if (!vid || d.seekTime == null) return;
          try {
            vid.currentTime = d.seekTime;
          } catch (e) {}
        })
      );
    } catch (e) {}
    // Chromium: OS can request PiP when user leaves the tab/app.
    try {
      navigator.mediaSession.setActionHandler("enterpictureinpicture", async () => {
        markMediaSessionReturn();
        await enterVideoPip(document.getElementById("v"));
        syncMediaSession();
      });
    } catch (e) {}
    try {
      navigator.mediaSession.setActionHandler("leavepictureinpicture", () => {
        markMediaSessionReturn();
        if (!document.hidden) onPageVisibleRestore();
      });
    } catch (e) {}

    if (v) {
      ["play", "pause", "ended", "timeupdate", "loadedmetadata", "ratechange"].forEach((ev) => {
        v.addEventListener(
          ev,
          () => {
            if (ev === "timeupdate" && Math.floor(v.currentTime) % 3 !== 0) return;
            syncMediaSession();
          },
          { passive: true }
        );
      });
    }
    syncMediaSession();
    setInterval(syncMediaSession, 8000);
  }

  function ensureKeysHelp() {
    let el = document.getElementById("sdKeysHelp");
    if (el) return el;
    el = document.createElement("div");
    el.id = "sdKeysHelp";
    el.className = "sd-keys-help";
    el.hidden = true;
    el.innerHTML =
      '<div class="sd-keys-help-card" role="dialog" aria-label="Keyboard shortcuts">' +
      "<h3>Keyboard shortcuts</h3>" +
      "<dl>" +
      "<dt>Space / K</dt><dd>Play / pause</dd>" +
      "<dt>← / →</dt><dd>Seek ±10s (VOD) or nudge guide</dd>" +
      "<dt>↑ / ↓</dt><dd>Volume ±</dd>" +
      "<dt>M</dt><dd>Mute</dd>" +
      "<dt>F</dt><dd>Fullscreen</dd>" +
      "<dt>G</dt><dd>Guide</dd>" +
      "<dt>P</dt><dd>Party panel / cycle chat mode</dd>" +
      "<dt>[ / ]</dt><dd>Channel − / + (live)</dd>" +
      "<dt>0–9</dt><dd>Volume 0%–90%</dd>" +
      "<dt>Esc</dt><dd>Close overlays</dd>" +
      "<dt>? / Shift+/</dt><dd>This help</dd>" +
      "</dl>" +
      '<p class="hint">Shortcuts ignore focused inputs. Lock-screen / notification controls use Media Session. Leaving the tab auto-enters PiP when supported (Settings → Auto PiP).</p>' +
      "</div>";
    el.addEventListener("click", (e) => {
      if (e.target === el) el.hidden = true;
    });
    document.body.appendChild(el);
    return el;
  }

  function toggleKeysHelp(force) {
    const el = ensureKeysHelp();
    el.hidden = force === undefined ? !el.hidden : !force;
  }

  function wireSiteShortcuts() {
    if (window.__sdSiteKeys) return;
    window.__sdSiteKeys = true;
    document.addEventListener(
      "keydown",
      (e) => {
        if (typingTarget(e.target)) {
          if (e.key === "Escape") {
            const help = document.getElementById("sdKeysHelp");
            if (help && !help.hidden) help.hidden = true;
          }
          return;
        }
        const v = document.getElementById("v");
        const help = document.getElementById("sdKeysHelp");
        if (e.key === "Escape") {
          if (help && !help.hidden) {
            e.preventDefault();
            help.hidden = true;
            return;
          }
          const picker = document.getElementById("partyModePicker");
          if (picker && !picker.hidden) {
            e.preventDefault();
            picker.hidden = true;
            return;
          }
        }
        if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
          e.preventDefault();
          toggleKeysHelp();
          return;
        }
        if (help && !help.hidden) return;

        const guideOpen = !!(
          document.getElementById("tvRoot") &&
          !document.getElementById("tvRoot").classList.contains("guide-collapsed") &&
          document.querySelector(".epg-panel:not([hidden])")
        );
        // Prefer cinema/VOD handler when HLS overlay active; still cover live + party.
        if (e.key === " " || e.key === "k" || e.key === "K") {
          if (typeof vodHlsActive !== "undefined" && vodHlsActive) return; // cinema.js
          if (!v) return;
          e.preventDefault();
          if (v.paused) v.play().catch(() => {});
          else v.pause();
          syncMediaSession();
          return;
        }
        if (e.key === "m" || e.key === "M") {
          if (typeof vodHlsActive !== "undefined" && vodHlsActive) return;
          if (!v) return;
          e.preventDefault();
          v.muted = !v.muted;
          syncMediaSession();
          return;
        }
        if (e.key === "f" || e.key === "F") {
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
            document.body.classList.remove("sd-immersive", "sd-fs");
          } else {
            enterPlayerFullscreen();
          }
          return;
        }
        if (e.key === "p" || e.key === "P") {
          e.preventDefault();
          if (window.SDParty) {
            if (e.shiftKey && typeof SDParty.layoutPartyChrome === "function") {
              /* keep */
            }
            if (document.getElementById("partyFab")) {
              const fab = document.getElementById("partyFab");
              fab.click();
            } else if (typeof SDParty.openPanel === "function") SDParty.openPanel();
          }
          return;
        }
        if (e.key === "[" || e.key === "]") {
          e.preventDefault();
          msChannelStep(e.key === "]" ? 1 : -1);
          return;
        }
        if (e.key >= "0" && e.key <= "9" && v) {
          e.preventDefault();
          v.volume = Number(e.key) / 10;
          v.muted = v.volume <= 0.01;
          syncMediaSession();
          return;
        }
        if (!guideOpen && (e.key === "ArrowUp" || e.key === "ArrowDown") && v) {
          if (typeof vodHlsActive !== "undefined" && vodHlsActive) return;
          e.preventDefault();
          const delta = e.key === "ArrowUp" ? 0.05 : -0.05;
          v.volume = Math.max(0, Math.min(1, (v.volume || 0) + delta));
          if (delta > 0) v.muted = false;
          syncMediaSession();
        }
      },
      true
    );
  }

  // Feature-detect PiP button visibility
  try {
    const pipBtn = document.getElementById("hlsPipBtn");
    if (pipBtn) {
      const probe = document.createElement("video");
      const ok =
        (document.pictureInPictureEnabled && typeof probe.requestPictureInPicture === "function") ||
        (typeof probe.webkitSupportsPresentationMode === "function" &&
          probe.webkitSupportsPresentationMode("picture-in-picture")) ||
        typeof probe.webkitSetPresentationMode === "function";
      pipBtn.hidden = !ok;
      pipBtn.style.display = ok ? "" : "none";
    }
  } catch (e) {}

  wireMediaSession();
  wireBackgroundKeepAlive();
  wireSiteShortcuts();

  // Refresh media session when live header / VOD chrome titles update
  try {
    if (window.MutationObserver) {
      const obs = new MutationObserver(() => syncMediaSession());
      ["nowOnAir", "chromeOnAir", "chromeSub", "pcTitle", "pcSub", "cinemaTitle", "cinemaSub"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) obs.observe(el, { childList: true, characterData: true, subtree: true, attributes: true });
      });
    }
  } catch (e) {}

  /* ── Cast / AirPlay (best-effort) ───────────────────────────────────────
   * Paths:
   *  1) Safari/iOS: webkitShowPlaybackTargetPicker + video airplay attrs
   *  2) Remote Playback API (Chrome/Android when media is URL-backed)
   *  3) Cast Web Sender → Default Media Receiver with absolute HLS/MP4 URL
   *  4) Presentation API second-screen fallback
   * MSE/hls.js on Android Chrome often cannot Remote Playback; Cast still
   * attempts the proxied .m3u8 URL (auth cookies are NOT sent to the receiver).
   */
  const CAST_SENDER_SRC =
    "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
  let castSenderPromise = null;
  let castFrameworkReady = false;
  let castSessionActive = false;
  let castRemoteWatching = false;

  function castNotify(msg, isErr) {
    const text = String(msg || "");
    try {
      const errEl = document.getElementById("errToast");
      if (errEl && isErr) {
        errEl.textContent = text;
        errEl.classList.add("show");
        clearTimeout(errEl._castHide);
        errEl._castHide = setTimeout(() => errEl.classList.remove("show"), 4500);
        return;
      }
    } catch (e) {}
    try {
      const el = document.getElementById("pcToast");
      if (el) {
        el.textContent = text;
        el.classList.add("show");
        clearTimeout(el._castHide);
        el._castHide = setTimeout(() => el.classList.remove("show"), 4200);
        return;
      }
    } catch (e2) {}
    try {
      const errEl = document.getElementById("errToast");
      if (errEl) {
        errEl.textContent = text;
        errEl.classList.add("show");
        clearTimeout(errEl._castHide);
        errEl._castHide = setTimeout(() => errEl.classList.remove("show"), 4200);
      }
    } catch (e3) {}
  }

  function setCastUiActive(on) {
    castSessionActive = !!on;
    ["castBtn", "hlsCastBtn"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle("casting", !!on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
      if (on) el.title = "Casting — tap to stop / change device";
      else if (id === "castBtn") el.title = "Cast / AirPlay";
      else el.title = "Cast / AirPlay";
    });
  }

  function absCastUrl(u) {
    const s = String(u || "").trim();
    if (!s) return "";
    try {
      return new URL(s, location.href).href.split("#")[0];
    } catch (e) {
      return s.startsWith("http") ? s : location.origin + (s.startsWith("/") ? s : "/" + s);
    }
  }

  function resolveCastMediaUrl() {
    let raw = "";
    try {
      if (typeof currentStreamUrl !== "undefined" && currentStreamUrl) raw = currentStreamUrl;
    } catch (e) {}
    try {
      if (!raw && typeof liveStreamUrl !== "undefined" && liveStreamUrl) raw = liveStreamUrl;
    } catch (e2) {}
    try {
      const vid = document.getElementById("v");
      if (!raw && vid) {
        raw = vid.currentSrc || vid.src || "";
        // blob: MSE sources are not castable as a URL
        if (/^blob:/i.test(raw)) raw = "";
      }
    } catch (e3) {}
    try {
      if (!raw && typeof channelId !== "undefined" && channelId) {
        raw = "/live/" + encodeURIComponent(channelId) + ".m3u8";
      }
    } catch (e4) {}
    return absCastUrl(String(raw || "").split("?")[0]);
  }

  function castContentType(url) {
    const u = String(url || "").toLowerCase();
    if (u.includes(".m3u8") || u.includes("/live/") || u.includes("/catchup/")) {
      return "application/x-mpegURL";
    }
    if (u.includes(".mpd")) return "application/dash+xml";
    if (/\.(mp4|m4v|mov)(\?|$)/i.test(u) || u.includes("/vod/file/")) return "video/mp4";
    return "application/x-mpegURL";
  }

  function isLikelyMsePlayback() {
    try {
      const vid = document.getElementById("v");
      if (vid && /^blob:/i.test(vid.currentSrc || vid.src || "")) return true;
    } catch (e) {}
    try {
      if (window.Hls && typeof Hls.isSupported === "function" && Hls.isSupported()) {
        // Desktop/Android Chrome almost always uses hls.js for our proxied live feeds
        if (!/iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent || "")) return true;
      }
    } catch (e2) {}
    return false;
  }

  function loadCastSender() {
    if (castFrameworkReady && window.cast && cast.framework) return Promise.resolve(true);
    if (castSenderPromise) return castSenderPromise;
    castSenderPromise = new Promise((resolve) => {
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        resolve(!!ok);
      };
      window.__onGCastApiAvailable = function (isAvailable) {
        try {
          if (!isAvailable || !window.cast || !cast.framework) {
            done(false);
            return;
          }
          const ctx = cast.framework.CastContext.getInstance();
          ctx.setOptions({
            receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
            autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
          });
          ctx.addEventListener(
            cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
            (ev) => {
              try {
                const st = ev.sessionState;
                const active =
                  st === cast.framework.SessionState.SESSION_STARTED ||
                  st === cast.framework.SessionState.SESSION_RESUMED;
                setCastUiActive(active);
              } catch (e) {}
            }
          );
          castFrameworkReady = true;
          done(true);
        } catch (e) {
          done(false);
        }
      };
      try {
        if (document.querySelector('script[data-sd-cast-sender="1"]')) {
          // Script already requested; wait briefly for callback
          setTimeout(() => done(castFrameworkReady), 2500);
          return;
        }
        const s = document.createElement("script");
        s.src = CAST_SENDER_SRC;
        s.async = true;
        s.dataset.sdCastSender = "1";
        s.onerror = () => done(false);
        document.head.appendChild(s);
        setTimeout(() => done(castFrameworkReady), 4000);
      } catch (e) {
        done(false);
      }
    });
    return castSenderPromise;
  }

  async function tryAirPlayPicker(vid) {
    if (!vid) return false;
    ensureVideoBgAttrs(vid);
    try {
      if (typeof vid.webkitShowPlaybackTargetPicker === "function") {
        vid.webkitShowPlaybackTargetPicker();
        castNotify("Choose an AirPlay device");
        return true;
      }
    } catch (e) {}
    return false;
  }

  async function tryRemotePlayback(vid) {
    if (!vid || !vid.remote || typeof vid.remote.prompt !== "function") return false;
    try {
      if (!castRemoteWatching && typeof vid.remote.watchAvailability === "function") {
        castRemoteWatching = true;
        try {
          vid.remote.watchAvailability(() => {});
        } catch (e) {}
      }
      ensureVideoBgAttrs(vid);
      await vid.remote.prompt();
      setCastUiActive(true);
      return true;
    } catch (e) {
      // NotAllowedError / NotSupportedError / AbortError → fall through
      return false;
    }
  }

  async function tryCastSenderLoad(mediaUrl) {
    if (!mediaUrl || /^blob:/i.test(mediaUrl)) return false;
    const ok = await loadCastSender();
    if (!ok || !window.cast || !cast.framework || !window.chrome || !chrome.cast) return false;
    try {
      const ctx = cast.framework.CastContext.getInstance();
      let session = ctx.getCurrentSession();
      if (!session) {
        await ctx.requestSession();
        session = ctx.getCurrentSession();
      }
      if (!session) return false;
      const mediaInfo = new chrome.cast.media.MediaInfo(mediaUrl, castContentType(mediaUrl));
      mediaInfo.streamType = /\/live\/|\.m3u8/i.test(mediaUrl)
        ? chrome.cast.media.StreamType.LIVE
        : chrome.cast.media.StreamType.BUFFERED;
      try {
        const titleEl = document.getElementById("nowCh") || document.getElementById("pcTitle");
        mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
        mediaInfo.metadata.title = (titleEl && titleEl.textContent) || document.title || "StepDaddyLiveHD";
      } catch (e) {}
      const req = new chrome.cast.media.LoadRequest(mediaInfo);
      await session.loadMedia(req);
      setCastUiActive(true);
      castNotify("Casting to device");
      return true;
    } catch (e) {
      return false;
    }
  }

  async function tryPresentationApi(mediaUrl) {
    if (!window.PresentationRequest || !mediaUrl || /^blob:/i.test(mediaUrl)) return false;
    try {
      // Lightweight receiver: open the same-origin watch URL if possible; else stream URL
      let presentUrl = mediaUrl;
      try {
        if (typeof channelId !== "undefined" && channelId) {
          presentUrl = location.origin + "/tv?ch=" + encodeURIComponent(channelId);
        }
      } catch (e) {}
      const req = new PresentationRequest([presentUrl]);
      const conn = await req.start();
      if (conn) {
        setCastUiActive(true);
        try {
          conn.addEventListener("close", () => setCastUiActive(false));
          conn.addEventListener("terminate", () => setCastUiActive(false));
        } catch (e2) {}
        castNotify("Presentation started");
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  }

  async function promptCast(opts) {
    opts = opts || {};
    const vid = document.getElementById("v");
    if (vid) ensureVideoBgAttrs(vid);
    const mediaUrl = resolveCastMediaUrl();
    const ua = navigator.userAgent || "";
    const isApple = /iPhone|iPad|iPod|Macintosh/i.test(ua) && /Safari/i.test(ua) && !/Chrome|CriOS|Edg/i.test(ua);
    const isAndroid = /Android/i.test(ua);

    // 1) AirPlay route picker (Safari / iOS / some macOS)
    if (await tryAirPlayPicker(vid)) return true;

    // 2) Remote Playback API
    if (await tryRemotePlayback(vid)) return true;

    // 3) Cast Web Sender with absolute stream URL
    if (mediaUrl && (await tryCastSenderLoad(mediaUrl))) return true;

    // 4) Presentation API
    if (mediaUrl && (await tryPresentationApi(mediaUrl))) return true;

    // Helpful limitation messages
    if (isApple) {
      castNotify("AirPlay: use the video player’s AirPlay control or Control Center", true);
      return false;
    }
    if (isAndroid && isLikelyMsePlayback()) {
      castNotify(
        "Cast limited on Android Chrome with HLS.js — try Chrome ⋮ Cast tab/screen, or open in a Cast-capable player",
        true
      );
      return false;
    }
    if (!mediaUrl) {
      castNotify("Nothing to cast — start playback first", true);
      return false;
    }
    castNotify(
      "No cast target found. Desktop Chrome: Cast extension / tab cast. Proxied HLS may need a Cast-capable URL.",
      true
    );
    return false;
  }

  function wireCastControls() {
    const btn = document.getElementById("castBtn");
    // player_app may already wire #castBtn → SDCast.prompt; avoid double handlers
    if (btn && !btn.dataset.wiredApp && !btn.dataset.wiredCast) {
      btn.dataset.wiredCast = "1";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        promptCast({ source: "q2" });
      });
    }
    // Warm Cast sender on Chromium so first tap is faster (best-effort, non-blocking)
    try {
      if (/Chrome|Chromium|Edg|CriOS/i.test(navigator.userAgent || "")) {
        setTimeout(() => {
          loadCastSender().catch(() => {});
        }, 2500);
      }
    } catch (e) {}
    try {
      const vid = document.getElementById("v");
      if (vid) ensureVideoBgAttrs(vid);
    } catch (e2) {}
  }

  try {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", wireCastControls);
    } else {
      wireCastControls();
    }
  } catch (e) {
    try { wireCastControls(); } catch (e2) {}
  }

  window.SDCast = {
    prompt: promptCast,
    resolveUrl: resolveCastMediaUrl,
    isActive: () => castSessionActive,
    ensureAttrs: ensureVideoBgAttrs,
  };

  window.SDFeatures = {
    getLastGood,
    setLastGood,
    prefetchResolve,
    reportProgress,
    showHlsChrome,
    partyName: () => lsGet(LS_PARTY_NAME, "Guest"),
    syncMediaSession,
    toggleKeysHelp,
    enterVideoPip,
    exitVideoPip,
    enterPlayerFullscreen,
  };
})();
/* Cinema player advanced: settings/themes, gestures, sources, dual audio, download, xray */
(function sdCinemaBoot() {
  const LS_PLAYER_THEME = "sd_player_theme";
  const LS_SPEED = "sd_player_speed";
  const LS_DUAL_AUDIO = "sd_dual_audio";
  const LS_ZOOM = "sd_player_zoom";
  const LS_SUB_OFFSET = "sd_sub_offset";
  const LS_XRAY_PAUSE = "sd_xray_pause";

  let controlsLocked = false;
  let dualAudioEl = null;
  let dualAudioTimer = null;
  let gestureState = null;
  let zoomMode = "contain"; // contain | cover | manual
  let manualZoom = 1;

  function lsGet(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : v;
    } catch (e) {
      return d;
    }
  }
  function lsSet(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {}
  }
  function toast(msg) {
    const el = document.getElementById("pcToast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 2200);
  }
  function gestureHud(label, pct) {
    const hud = document.getElementById("pcGestureHud");
    const lab = document.getElementById("pcGestureLabel");
    const bar = document.getElementById("pcGestureBar");
    if (!hud) return;
    if (lab) lab.textContent = label;
    if (bar) bar.style.width = Math.max(0, Math.min(100, pct || 0)) + "%";
    hud.classList.add("show");
    clearTimeout(hud._t);
    hud._t = setTimeout(() => hud.classList.remove("show"), 900);
  }

  function applyPlayerTheme(theme) {
    const allowed = ["cinema", "prime", "netflix", "broadcast"];
    if (!allowed.includes(theme)) theme = "cinema";
    lsSet(LS_PLAYER_THEME, theme);
    if (tvRoot) tvRoot.dataset.playerTheme = theme;
    document.querySelectorAll(".pc-theme-grid button").forEach((b) => {
      b.classList.toggle("active", b.dataset.theme === theme);
    });
  }

  function ensureSettingsDom() {
    if (document.getElementById("pcSettings")) return;
    const backdrop = document.createElement("div");
    backdrop.className = "pc-settings-backdrop";
    backdrop.id = "pcSettingsBackdrop";
    const sheet = document.createElement("div");
    sheet.className = "pc-settings";
    sheet.id = "pcSettings";
    sheet.innerHTML =
      '<div class="pc-sh"><h3>Player settings</h3><button type="button" id="pcSettingsClose">✕</button></div>' +
      '<div class="pc-sb">' +
      '<div class="pc-sec"><div class="pc-sec-title">Appearance</div>' +
      '<div class="pc-theme-grid" id="pcThemeGrid">' +
      '<button type="button" data-theme="cinema" class="active">Cinema<span>Soft white · default</span></button>' +
      '<button type="button" data-theme="prime">Prime Soft<span>Teal accents</span></button>' +
      '<button type="button" data-theme="netflix">Netflix Warm<span>Red accents</span></button>' +
      '<button type="button" data-theme="broadcast">Broadcast<span>Blue utility</span></button>' +
      "</div></div>" +
      '<div class="pc-sec"><div class="pc-sec-title">Playback</div>' +
      '<div class="pc-row"><div><label>Speed</label><span class="hint">0.25x – 2x</span></div>' +
      '<select id="pcSetSpeed"><option>0.25</option><option>0.5</option><option>0.75</option><option selected>1</option><option>1.25</option><option>1.5</option><option>1.75</option><option>2</option></select></div>' +
      '<div class="pc-row"><div><label>Zoom</label><span class="hint">Fit · Cover · Manual</span></div>' +
      '<select id="pcSetZoom"><option value="contain">Fit</option><option value="cover">Cover</option><option value="manual">Manual</option></select></div>' +
      '<div class="pc-row"><div><label>Manual zoom</label></div><input type="range" id="pcSetZoomAmt" min="1" max="2" step="0.01" value="1"/></div>' +
      "</div>" +
      '<div class="pc-sec"><div class="pc-sec-title">Audio & language</div>' +
      '<div class="pc-row"><div><label>Dual-source audio</label><span class="hint">Keep video, play other-language audio (experimental)</span></div>' +
      '<button type="button" class="pc-toggle" id="pcSetDual" aria-pressed="false"></button></div>' +
      "</div>" +
      '<div class="pc-sec"><div class="pc-sec-title">Subtitles</div>' +
      '<div class="pc-row"><div><label>Offset (ms)</label><span class="hint">Negative = earlier</span></div>' +
      '<input type="range" id="pcSetSubOff" min="-5000" max="5000" step="100" value="0"/></div>' +
      '<div class="pc-row"><div><label>Size</label></div><input type="range" id="pcSetSubSize" min="14" max="42" step="1" value="22"/></div>' +
      "</div>" +
      '<div class="pc-sec"><div class="pc-sec-title">X-ray</div>' +
      '<div class="pc-row"><div><label>Pause while open</label></div>' +
      '<button type="button" class="pc-toggle" id="pcSetXrayPause" aria-pressed="false"></button></div>' +
      "</div>" +
      '<div class="pc-sec"><div class="pc-sec-title">Downloads</div>' +
      '<div class="pc-row"><div><label>Saved offline</label><span class="hint" id="pcDlHint">MP4 titles only</span></div>' +
      '<button type="button" class="pc-btn-label" id="pcClearDl" style="width:auto;padding:8px 12px;border-radius:10px;border:0;background:#1a1f2a;color:#fff;cursor:pointer">Clear list</button></div>' +
      '<div id="pcDlList" style="padding:4px 6px;font-size:12px;color:#9aa"></div>' +
      "</div></div>";
    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);
    backdrop.addEventListener("click", closeSettings);
    document.getElementById("pcSettingsClose").addEventListener("click", closeSettings);
    document.getElementById("pcThemeGrid").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-theme]");
      if (b) applyPlayerTheme(b.dataset.theme);
    });
    const speed = document.getElementById("pcSetSpeed");
    speed.value = lsGet(LS_SPEED, "1");
    speed.addEventListener("change", () => {
      lsSet(LS_SPEED, speed.value);
      applySpeed(Number(speed.value));
    });
    const zoom = document.getElementById("pcSetZoom");
    zoom.value = lsGet(LS_ZOOM, "contain");
    zoom.addEventListener("change", () => applyZoom(zoom.value));
    const zoomAmt = document.getElementById("pcSetZoomAmt");
    zoomAmt.value = String(manualZoom);
    zoomAmt.addEventListener("input", () => {
      manualZoom = Number(zoomAmt.value) || 1;
      if (tvRoot) tvRoot.style.setProperty("--pc-zoom", String(manualZoom));
      applyZoom("manual");
    });
    wireToggle("pcSetDual", LS_DUAL_AUDIO, "0");
    wireToggle("pcSetXrayPause", LS_XRAY_PAUSE, "0");
    const subOff = document.getElementById("pcSetSubOff");
    subOff.value = lsGet(LS_SUB_OFFSET, "0");
    subOff.addEventListener("input", () => lsSet(LS_SUB_OFFSET, subOff.value));
    const subSize = document.getElementById("pcSetSubSize");
    subSize.value = lsGet("sd_sub_size", "22");
    subSize.addEventListener("input", () => {
      lsSet("sd_sub_size", subSize.value);
      const overlay = document.getElementById("sdSubOverlay");
      if (overlay) overlay.style.setProperty("--sd-sub-size", subSize.value + "px");
    });
    document.getElementById("pcClearDl").addEventListener("click", () => {
      try {
        localStorage.removeItem("sd_downloads");
      } catch (e) {}
      renderDownloadList();
      toast("Downloads cleared");
    });
  }

  function wireToggle(id, key, defOff) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const on = lsGet(key, defOff) === "1";
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.addEventListener("click", () => {
      const next = !btn.classList.contains("on");
      btn.classList.toggle("on", next);
      btn.setAttribute("aria-pressed", next ? "true" : "false");
      lsSet(key, next ? "1" : "0");
      if (id === "pcSetDual" && !next) stopDualAudio();
    });
  }

  function openSettings() {
    ensureSettingsDom();
    applyPlayerTheme(lsGet(LS_PLAYER_THEME, "cinema"));
    renderDownloadList();
    document.getElementById("pcSettingsBackdrop").classList.add("open");
    document.getElementById("pcSettings").classList.add("open");
  }
  function closeSettings() {
    const b = document.getElementById("pcSettingsBackdrop");
    const s = document.getElementById("pcSettings");
    if (b) b.classList.remove("open");
    if (s) s.classList.remove("open");
  }

  function applySpeed(rate) {
    try {
      v.playbackRate = rate || 1;
    } catch (e) {}
    const btn = document.getElementById("pcSpeedBtn");
    if (btn) btn.textContent = (rate || 1) + "x";
  }

  function applyZoom(mode) {
    zoomMode = mode || "contain";
    lsSet(LS_ZOOM, zoomMode);
    if (!tvRoot) return;
    tvRoot.classList.remove("pc-zoom-cover", "pc-zoom-contain", "pc-zoom-manual");
    if (zoomMode === "cover") tvRoot.classList.add("pc-zoom-cover");
    else if (zoomMode === "manual") {
      tvRoot.classList.add("pc-zoom-manual");
      tvRoot.style.setProperty("--pc-zoom", String(manualZoom));
    } else tvRoot.classList.add("pc-zoom-contain");
    const sel = document.getElementById("pcSetZoom");
    if (sel) sel.value = zoomMode;
  }

  function setLocked(on) {
    controlsLocked = !!on;
    if (tvRoot) tvRoot.classList.toggle("pc-controls-locked", controlsLocked);
    toast(controlsLocked ? "Controls locked" : "Controls unlocked");
  }

  function cycleZoom() {
    const order = ["contain", "cover", "manual"];
    const i = order.indexOf(zoomMode);
    applyZoom(order[(i + 1) % order.length]);
    toast("Zoom: " + zoomMode);
  }

  async function toggleFullscreen() {
    const area = document.getElementById("videoArea") || trailerLayer;
    try {
      if (!document.fullscreenElement) {
        if (area.requestFullscreen) await area.requestFullscreen();
        else if (area.webkitRequestFullscreen) area.webkitRequestFullscreen();
      } else if (document.exitFullscreen) await document.exitFullscreen();
    } catch (e) {}
    try {
      if (window.SDMobile && SDMobile.enterImmersive) SDMobile.enterImmersive(area);
    } catch (e2) {}
  }

  function renderSpeedMenu() {
    const menu = document.getElementById("pcSpeedMenu");
    if (!menu) return;
    menu.innerHTML = '<div class="pc-menu-head">Speed</div>';
    [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].forEach((r) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = r + "x";
      if (Math.abs((v.playbackRate || 1) - r) < 0.01) b.classList.add("active");
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        lsSet(LS_SPEED, String(r));
        applySpeed(r);
        menu.classList.remove("open");
      });
      menu.appendChild(b);
    });
  }

  function renderAudioMenu() {
    const menu = document.getElementById("pcAudioMenu");
    if (!menu) return;
    menu.innerHTML = '<div class="pc-menu-head">Audio</div>';
    const add = (label, fn, active) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      if (active) b.classList.add("active");
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        fn();
        menu.classList.remove("open");
      });
      menu.appendChild(b);
    };
    add("Original (this stream)", () => {
      stopDualAudio();
      if (hls && hls.audioTracks && hls.audioTracks.length) {
        try {
          hls.audioTrack = -1;
        } catch (e) {}
      }
      toast("Original audio");
    }, !dualAudioEl);
    if (hls && hls.audioTracks && hls.audioTracks.length) {
      hls.audioTracks.forEach((t, i) => {
        add((t.name || t.lang || "Track " + (i + 1)) + (t.lang ? " · " + t.lang : ""), () => {
          stopDualAudio();
          hls.audioTrack = i;
          toast("Audio: " + (t.lang || t.name || i));
        }, hls.audioTrack === i && !dualAudioEl);
      });
    }
    add("Switch language source…", () => openLanguageSources(false), false);
    if (lsGet(LS_DUAL_AUDIO, "0") === "1") {
      add("Dual audio from other source…", () => openLanguageSources(true), !!dualAudioEl);
    }
  }

  async function openLanguageSources(dual) {
    const ctx = vodPickerCtx;
    if (!ctx || !ctx.tmdbId) {
      toast("No title context");
      return;
    }
    const menu = document.getElementById("pcAudioMenu");
    if (menu) {
      menu.innerHTML = '<div class="pc-menu-head">Languages</div><button type="button" disabled>Loading…</button>';
      menu.classList.add("open");
    }
    const langs = ["en", "es", "fr", "de", "pt", "it", "ja", "ko", "hi"];
    if (menu) menu.innerHTML = '<div class="pc-menu-head">' + (dual ? "Dual audio lang" : "Language source") + "</div>";
    for (const lang of langs) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = lang.toUpperCase();
      b.addEventListener("click", async (e) => {
        e.stopPropagation();
        menu.classList.remove("open");
        await switchLanguage(lang, dual);
      });
      if (menu) menu.appendChild(b);
    }
  }

  async function switchLanguage(lang, dual) {
    const ctx = vodPickerCtx;
    if (!ctx || !ctx.tmdbId) return;
    toast((dual ? "Dual audio" : "Switching") + " · " + lang.toUpperCase());
    let url =
      "/vod/resolve?tmdb_id=" +
      encodeURIComponent(ctx.tmdbId) +
      "&type=" +
      encodeURIComponent(ctx.mediaType || "movie") +
      "&lang=" +
      encodeURIComponent(lang);
    if (ctx.season) url += "&season=" + encodeURIComponent(ctx.season);
    if (ctx.episode) url += "&episode=" + encodeURIComponent(ctx.episode);
    try {
      const r = await authFetch(url, { cache: "no-store" });
      const data = await r.json();
      if (!data.ok || !data.stream_url) {
        toast("No " + lang + " source");
        return;
      }
      if (dual) {
        await startDualAudio(data);
        return;
      }
      if (typeof playDirectVodFromResolve === "function") {
        await playDirectVodFromResolve(data, "vod_picker", ctx);
      } else if (data.method === "mp4" && typeof playVodFileInPlayer === "function") {
        await playVodFileInPlayer(data.stream_url, "vod_picker", ctx);
      } else if (typeof playVodHlsInPlayer === "function") {
        await playVodHlsInPlayer(data.stream_url, "vod_picker", ctx);
      }
    } catch (e) {
      toast("Language switch failed");
    }
  }

  async function startDualAudio(data) {
    stopDualAudio();
    if (!data || !data.stream_url) return;
    dualAudioEl = document.createElement("audio");
    dualAudioEl.id = "pcDualAudio";
    dualAudioEl.preload = "auto";
    dualAudioEl.crossOrigin = "anonymous";
    const src = data.stream_url.startsWith("http") ? data.stream_url : location.origin + data.stream_url;
    if (data.method === "mp4" || (data.stream_url || "").includes("/vod/file/")) {
      dualAudioEl.src = src;
    } else {
      toast("Dual audio works best with MP4 sources");
      dualAudioEl.src = src;
    }
    document.body.appendChild(dualAudioEl);
    try {
      v.muted = true;
      dualAudioEl.currentTime = v.currentTime || 0;
      await dualAudioEl.play();
    } catch (e) {
      toast("Dual audio blocked — try tap play");
    }
    dualAudioTimer = setInterval(() => {
      if (!dualAudioEl || !vodHlsActive) return;
      const drift = Math.abs((dualAudioEl.currentTime || 0) - (v.currentTime || 0));
      if (drift > 0.35) {
        try {
          dualAudioEl.currentTime = v.currentTime;
        } catch (e) {}
      }
      if (v.paused && !dualAudioEl.paused) dualAudioEl.pause();
      if (!v.paused && dualAudioEl.paused) dualAudioEl.play().catch(() => {});
    }, 800);
    toast("Dual-source audio on");
  }

  function stopDualAudio() {
    if (dualAudioTimer) clearInterval(dualAudioTimer);
    dualAudioTimer = null;
    if (dualAudioEl) {
      try {
        dualAudioEl.pause();
        dualAudioEl.remove();
      } catch (e) {}
      dualAudioEl = null;
    }
    try {
      if (vodHlsActive) v.muted = false;
    } catch (e) {}
  }

  async function renderSourceMenu() {
    const menu = document.getElementById("pcSourceMenu");
    const ctx = vodPickerCtx;
    if (!menu || !ctx || !ctx.tmdbId) return;
    menu.innerHTML = '<div class="pc-menu-head">Sources</div><button type="button" disabled>Loading…</button>';
    menu.classList.add("open");
    let url =
      "/vod/resolve?tmdb_id=" +
      encodeURIComponent(ctx.tmdbId) +
      "&type=" +
      encodeURIComponent(ctx.mediaType || "movie") +
      "&lang=" +
      encodeURIComponent(typeof vodPreferLang === "function" ? vodPreferLang() : "en") +
      "&all_sources=1";
    if (ctx.season) url += "&season=" + encodeURIComponent(ctx.season);
    if (ctx.episode) url += "&episode=" + encodeURIComponent(ctx.episode);
    let sources = [];
    try {
      const r = await authFetch(url, { cache: "no-store" });
      const data = await r.json();
      sources = data.sources || [];
    } catch (e) {}
    menu.innerHTML = '<div class="pc-menu-head">Direct streams</div>';
    if (!sources.length) {
      const empty = document.createElement("button");
      empty.type = "button";
      empty.disabled = true;
      empty.textContent = "No direct sources";
      menu.appendChild(empty);
    }
    sources.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent =
        (s.provider_name || s.provider || "Source") +
        (s.quality ? " · " + s.quality : "") +
        (s.method === "mp4" ? " · MP4" : " · HLS");
      b.addEventListener("click", async (e) => {
        e.stopPropagation();
        menu.classList.remove("open");
        const keep = v.currentTime || 0;
        if (typeof playDirectVodFromResolve === "function") {
          await playDirectVodFromResolve(s, "vod_picker", ctx);
        }
        const seekAfter = () => {
          try {
            if (v.duration && keep > 2 && keep < v.duration - 2) v.currentTime = keep;
          } catch (err) {}
          v.removeEventListener("loadedmetadata", seekAfter);
        };
        v.addEventListener("loadedmetadata", seekAfter);
        toast("Source switched");
      });
      menu.appendChild(b);
    });
    try {
      let srcUrl =
        "/vod/sources?tmdb_id=" +
        encodeURIComponent(ctx.tmdbId) +
        "&type=" +
        encodeURIComponent(ctx.mediaType || "movie") +
        "&lang=" +
        encodeURIComponent(typeof vodPreferLang === "function" ? vodPreferLang() : "en");
      if (ctx.season) srcUrl += "&season=" + encodeURIComponent(ctx.season);
      if (ctx.episode) srcUrl += "&episode=" + encodeURIComponent(ctx.episode);
      const sr = await authFetch(srcUrl, { cache: "no-store" });
      const payload = await sr.json();
      const embeds = (payload.sources || []).filter((x) => x.embed_url && !x.auto);
      if (embeds.length) {
        const head = document.createElement("div");
        head.className = "pc-menu-head";
        head.textContent = "Embeds";
        menu.appendChild(head);
        embeds.slice(0, 12).forEach((s) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = (s.name || s.id) + (s.risk === "risky" ? " · risky" : "");
          b.addEventListener("click", (e) => {
            e.stopPropagation();
            menu.classList.remove("open");
            if (typeof playEmbedInPlayer === "function") playEmbedInPlayer(s.embed_url, "vod_picker", ctx);
          });
          menu.appendChild(b);
        });
      }
    } catch (e2) {}
  }

  function currentSessionId() {
    const u = String(currentStreamUrl || v.currentSrc || "");
    const m = u.match(/\/vod\/(?:file|hls)\/([^/.]+)/);
    return m ? m[1] : "";
  }

  function downloadList() {
    try {
      return JSON.parse(lsGet("sd_downloads", "[]")) || [];
    } catch (e) {
      return [];
    }
  }
  function saveDownloadMeta(entry) {
    const list = downloadList().filter((x) => x.id !== entry.id);
    list.unshift(entry);
    lsSet("sd_downloads", JSON.stringify(list.slice(0, 40)));
  }
  function renderDownloadList() {
    const box = document.getElementById("pcDlList");
    if (!box) return;
    const list = downloadList();
    if (!list.length) {
      box.textContent = "No downloads yet.";
      return;
    }
    box.innerHTML = list
      .map((x) => "<div style='margin:6px 0'>" + (x.title || x.id) + " · " + (x.when || "") + "</div>")
      .join("");
  }

  async function startDownload() {
    const sid = currentSessionId();
    const ctx = vodPickerCtx || {};
    if (!sid) {
      toast("Download needs an active direct stream");
      return;
    }
    if (!(currentStreamUrl || "").includes("/vod/file/") && !(v.currentSrc || "").includes("/vod/file/")) {
      toast("Offline download supports MP4 streams first");
      return;
    }
    toast("Preparing download…");
    const href = "/vod/download/" + encodeURIComponent(sid);
    try {
      const a = document.createElement("a");
      a.href = href;
      a.download = (ctx.title || "movie").replace(/[^\w\s.-]+/g, "") + ".mp4";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      saveDownloadMeta({
        id: sid,
        title: ctx.title || "Title",
        tmdb: ctx.tmdbId,
        when: new Date().toLocaleString(),
      });
      toast("Download started");
    } catch (e) {
      toast("Download failed");
    }
  }

  async function openInPlayerXray() {
    const ctx = vodPickerCtx;
    const sheet = document.getElementById("pcXraySheet");
    const body = document.getElementById("pcXrayBody");
    if (!sheet || !body) return;
    if (lsGet(LS_XRAY_PAUSE, "0") === "1") {
      try {
        v.pause();
      } catch (e) {}
    }
    body.innerHTML = "<p style='opacity:.7'>Loading…</p>";
    sheet.classList.add("open");
    sheet.setAttribute("aria-hidden", "false");
    if (!ctx || !ctx.tmdbId) {
      body.innerHTML = "<p>No title metadata.</p>";
      return;
    }
    try {
      let url =
        "/vod/catalog/" +
        ((ctx.mediaType || "movie") === "tv" || ctx.season ? "tv" : "movie") +
        "/" +
        encodeURIComponent(ctx.tmdbId);
      const r = await authFetch(url, { cache: "no-store" });
      const data = await r.json();
      const m = data.item || data.detail || data.meta || data || {};
      const title = m.title || m.name || ctx.title || "Title";
      const overview = m.overview || m.plot || "";
      const castRaw = m.cast || (m.credits && m.credits.cast) || [];
      const cast = (Array.isArray(castRaw) ? castRaw : []).slice(0, 8);
      let html = "<h2 style='font-family:var(--player-display);font-weight:400;margin:8px 0 6px'>" + escapeHtml(title) + "</h2>";
      if (m.year || m.release_date) html += "<div style='opacity:.65;font-size:12px;margin-bottom:10px'>" + escapeHtml(String(m.year || (m.release_date || "").slice(0, 4))) + "</div>";
      if (overview) html += "<p style='font-size:13px;line-height:1.45;opacity:.9'>" + escapeHtml(overview) + "</p>";
      if (cast.length) {
        html += "<h4 style='margin:16px 0 8px;font-size:11px;letter-spacing:.08em;opacity:.55'>CAST</h4>";
        cast.forEach((c) => {
          const name = typeof c === "string" ? c : c.name || c.actor || "";
          if (name) html += "<div style='font-size:13px;margin:4px 0'>" + escapeHtml(name) + "</div>";
        });
      }
      html +=
        '<div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">' +
        '<button type="button" id="pcXrayVod" style="border:0;border-radius:10px;padding:10px 12px;background:rgba(16,185,129,.28);color:#a7f3d0;cursor:pointer;font-weight:600">▶ VOD</button>' +
        '<button type="button" id="pcXraySources" style="border:0;border-radius:10px;padding:10px 12px;background:#1a1f2a;color:#fff;cursor:pointer">Sources</button>' +
        '<button type="button" id="pcXrayAudio" style="border:0;border-radius:10px;padding:10px 12px;background:#1a1f2a;color:#fff;cursor:pointer">Audio / Lang</button>' +
        "</div>";
      body.innerHTML = html;
      const vodBtn = document.getElementById("pcXrayVod");
      if (vodBtn)
        vodBtn.addEventListener("click", () => {
          closeXraySheet();
          const mt = ((ctx.mediaType || "movie") === "tv" || ctx.season) ? "tv" : "movie";
          location.assign("/vod/" + mt + "/" + encodeURIComponent(ctx.tmdbId));
        });
      const srcBtn = document.getElementById("pcXraySources");
      if (srcBtn)
        srcBtn.addEventListener("click", () => {
          sheet.classList.remove("open");
          renderSourceMenu();
        });
      const auBtn = document.getElementById("pcXrayAudio");
      if (auBtn)
        auBtn.addEventListener("click", () => {
          sheet.classList.remove("open");
          renderAudioMenu();
          const menu = document.getElementById("pcAudioMenu");
          if (menu) menu.classList.add("open");
        });
    } catch (e) {
      body.innerHTML =
        "<h2 style='font-family:var(--player-display)'>" +
        escapeHtml(ctx.title || "Title") +
        "</h2><p style='opacity:.7'>Details unavailable.</p>";
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function closeXraySheet() {
    const sheet = document.getElementById("pcXraySheet");
    if (sheet) {
      sheet.classList.remove("open");
      sheet.setAttribute("aria-hidden", "true");
    }
  }

  function wireGestures() {
    if (!trailerLayer || trailerLayer.dataset.pcGestures === "1") return;
    trailerLayer.dataset.pcGestures = "1";
    const PARTY_IGNORE =
      ".party-drawer, .party-fab, .party-toast, .party-jitsi-stage, .party-av-overlay, #partyAvOverlay, #partyFab, .party-live-overlay, .sd-modal, .sd-modal-backdrop";
    function ignoreParty(t) {
      return !!(t && t.closest && t.closest(PARTY_IGNORE));
    }
    function seekable() {
      try {
        return !!(vodHlsActive && v && isFinite(v.duration) && v.duration > 0 && v.seekable && v.seekable.length);
      } catch (e) {
        return false;
      }
    }
    trailerLayer.addEventListener(
      "touchstart",
      (e) => {
        if (!vodHlsActive || controlsLocked || e.touches.length !== 1) return;
        if (ignoreParty(e.target)) return;
        const t = e.touches[0];
        const rect = trailerLayer.getBoundingClientRect();
        gestureState = {
          x0: t.clientX,
          y0: t.clientY,
          vol0: v.volume,
          t0: v.currentTime,
          mode: null,
          side: t.clientX < rect.left + rect.width / 2 ? "left" : "right",
        };
      },
      { passive: true }
    );
    trailerLayer.addEventListener(
      "touchmove",
      (e) => {
        if (!gestureState || !vodHlsActive || controlsLocked) return;
        if (ignoreParty(e.target)) return;
        const t = e.touches[0];
        const dx = t.clientX - gestureState.x0;
        const dy = t.clientY - gestureState.y0;
        if (!gestureState.mode) {
          if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy)) {
            if (!seekable()) return;
            gestureState.mode = "seek";
          } else if (Math.abs(dy) > 18) gestureState.mode = gestureState.side === "left" ? "bright" : "vol";
        }
        if (gestureState.mode === "seek") {
          const dur = v.duration || 0;
          if (!dur) return;
          const delta = (dx / trailerLayer.clientWidth) * Math.min(120, dur * 0.2);
          const next = Math.max(0, Math.min(dur, gestureState.t0 + delta));
          gestureHud((delta >= 0 ? "+" : "") + Math.round(delta) + "s", (next / dur) * 100);
          try {
            v.currentTime = next;
          } catch (err) {}
        } else if (gestureState.mode === "vol") {
          const next = Math.max(0, Math.min(1, gestureState.vol0 - dy / 220));
          v.volume = next;
          v.muted = next <= 0.01;
          syncMuteUi();
          gestureHud("Volume " + Math.round(next * 100) + "%", next * 100);
        } else if (gestureState.mode === "bright") {
          const cur = Number(getComputedStyle(document.documentElement).getPropertyValue("--pc-bright") || 1);
          const next = Math.max(0.4, Math.min(1.2, (gestureState.bright0 != null ? gestureState.bright0 : cur) - dy / 260));
          if (gestureState.bright0 == null) gestureState.bright0 = cur;
          document.documentElement.style.setProperty("--pc-bright", String(next));
          if (videoArea) videoArea.style.filter = "brightness(" + next + ")";
          gestureHud("Brightness " + Math.round(next * 100) + "%", ((next - 0.4) / 0.8) * 100);
        }
      },
      { passive: true }
    );
    trailerLayer.addEventListener("touchend", () => {
      gestureState = null;
    });
    // double-tap L/R = ±10s when VOD/seekable
    let lastTap = 0;
    trailerLayer.addEventListener("click", (e) => {
      if (!vodHlsActive || controlsLocked) return;
      if (ignoreParty(e.target)) return;
      if (e.target.closest("button, input, .hls-menu, .pc-settings, .pc-xray-sheet, .party-drawer, .party-fab, .party-jitsi-stage, .party-av-overlay, #partyAvOverlay, #partyFab")) return;
      if (!seekable()) return;
      const now = Date.now();
      if (now - lastTap < 280) {
        const rect = trailerLayer.getBoundingClientRect();
        let rightEdge = rect.right;
        const va = document.getElementById("videoArea");
        const hulu =
          trailerLayer.classList.contains("party-layout-hulu") ||
          (va && va.classList.contains("party-layout-hulu"));
        const rave =
          trailerLayer.classList.contains("party-layout-rave") ||
          (va && va.classList.contains("party-layout-rave"));
        if (hulu) {
          const drawer = document.getElementById("partyDrawer");
          if (drawer && drawer.classList.contains("open")) rightEdge = Math.min(rightEdge, drawer.getBoundingClientRect().left);
        }
        if (e.clientX >= rightEdge) return;
        if (rave) {
          if ((e.clientY - rect.top) / Math.max(1, rect.height) > 0.55) return;
        }
        if (e.clientX < rect.left + (rightEdge - rect.left) / 2) {
          try {
            v.currentTime = Math.max(0, v.currentTime - 10);
          } catch (err) {}
          const fl = document.getElementById("pcSeekLeft");
          if (fl) {
            fl.classList.add("show");
            setTimeout(() => fl.classList.remove("show"), 700);
          }
        } else {
          try {
            v.currentTime = Math.min(v.duration || 1e9, v.currentTime + 10);
          } catch (err) {}
          const fr = document.getElementById("pcSeekRight");
          if (fr) {
            fr.classList.add("show");
            setTimeout(() => fr.classList.remove("show"), 700);
          }
        }
        lastTap = 0;
      } else lastTap = now;
    });
  }

  function syncMuteUi() {
    const btn = document.getElementById("pcMuteBtn");
    const vol = document.getElementById("pcVol");
    if (vol) vol.value = String(v.muted ? 0 : v.volume);
    if (btn) {
      btn.innerHTML =
        v.muted || v.volume < 0.01
          ? '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.8-1-3.3-2.5-4v2.2l2.5 2.5V12zm2.5 0c0 .9-.2 1.8-.5 2.6l1.5 1.5c.6-1.3 1-2.7 1-4.1 0-3.5-2-6.5-5-8v2.1c2 .9 3.4 2.9 3.4 5.9zM4.3 3L3 4.3 7.7 9H3v4h4l5 5v-6.7l4.7 4.7c-.7.5-1.4.9-2.2 1.2v2.1c1.2-.3 2.3-.9 3.2-1.7L19.7 21 21 19.7 4.3 3zM12 4L9.9 6.1 12 8.2V4z" fill="currentColor"/></svg>'
          : '<svg viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.8-1-3.3-2.5-4v8c1.5-.7 2.5-2.2 2.5-4z" fill="currentColor"/></svg>';
    }
  }

  function onChromeReady() {
    applyPlayerTheme(lsGet(LS_PLAYER_THEME, "cinema"));
    applySpeed(Number(lsGet(LS_SPEED, "1")) || 1);
    applyZoom(lsGet(LS_ZOOM, "contain"));
    wireGestures();
    const settingsBtn = document.getElementById("pcSettingsBtn");
    if (settingsBtn && !settingsBtn.dataset.wired) {
      settingsBtn.dataset.wired = "1";
      settingsBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openSettings();
      });
    }
    const xrayBtn = document.getElementById("pcXrayBtn");
    if (xrayBtn && !xrayBtn.dataset.wired) {
      xrayBtn.dataset.wired = "1";
      xrayBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openInPlayerXray();
      });
    }
    const xrayClose = document.getElementById("pcXrayClose");
    if (xrayClose && !xrayClose.dataset.wired) {
      xrayClose.dataset.wired = "1";
      xrayClose.addEventListener("click", closeXraySheet);
    }
    const dlBtn = document.getElementById("pcDownloadBtn");
    if (dlBtn && !dlBtn.dataset.wired) {
      dlBtn.dataset.wired = "1";
      dlBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        startDownload();
      });
    }
    const speedBtn = document.getElementById("pcSpeedBtn");
    if (speedBtn && !speedBtn.dataset.wired) {
      speedBtn.dataset.wired = "1";
      speedBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        renderSpeedMenu();
        const menu = document.getElementById("pcSpeedMenu");
        document.querySelectorAll(".hls-menu").forEach((m) => m.classList.remove("open"));
        if (menu) menu.classList.add("open");
      });
    }
    const audioBtn = document.getElementById("pcAudioBtn");
    if (audioBtn && !audioBtn.dataset.wired) {
      audioBtn.dataset.wired = "1";
      audioBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        renderAudioMenu();
        const menu = document.getElementById("pcAudioMenu");
        document.querySelectorAll(".hls-menu").forEach((m) => m.classList.remove("open"));
        if (menu) menu.classList.add("open");
      });
    }
    const sourceBtn = document.getElementById("pcSourceBtn");
    if (sourceBtn && !sourceBtn.dataset.wired) {
      sourceBtn.dataset.wired = "1";
      sourceBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".hls-menu").forEach((m) => m.classList.remove("open"));
        renderSourceMenu();
      });
    }
    const fsBtn = document.getElementById("pcFsBtn");
    if (fsBtn && !fsBtn.dataset.wired) {
      fsBtn.dataset.wired = "1";
      fsBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFullscreen();
      });
    }
    const lockBtn = document.getElementById("pcLockBtn");
    if (lockBtn && !lockBtn.dataset.wired) {
      lockBtn.dataset.wired = "1";
      lockBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setLocked(true);
      });
    }
    const lockFab = document.getElementById("pcLockFab");
    if (lockFab && !lockFab.dataset.wired) {
      lockFab.dataset.wired = "1";
      lockFab.addEventListener("click", (e) => {
        e.stopPropagation();
        setLocked(false);
      });
    }
    const zoomBtn = document.getElementById("pcZoomBtn");
    if (zoomBtn && !zoomBtn.dataset.wired) {
      zoomBtn.dataset.wired = "1";
      zoomBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        cycleZoom();
      });
    }
    const muteBtn = document.getElementById("pcMuteBtn");
    if (muteBtn && !muteBtn.dataset.wired) {
      muteBtn.dataset.wired = "1";
      muteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        v.muted = !v.muted;
        syncMuteUi();
      });
    }
    const vol = document.getElementById("pcVol");
    if (vol && !vol.dataset.wired) {
      vol.dataset.wired = "1";
      vol.value = String(v.volume);
      vol.addEventListener("input", () => {
        v.volume = Number(vol.value);
        v.muted = v.volume <= 0.01;
        syncMuteUi();
      });
    }
    syncMuteUi();
  }

  document.addEventListener("keydown", (e) => {
    if (!vodHlsActive) return;
    const tag = (e.target && e.target.tagName) || "";
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      if (v.paused) v.play().catch(() => {});
      else v.pause();
    } else if (e.key === "ArrowLeft") {
      try {
        v.currentTime = Math.max(0, v.currentTime - 10);
      } catch (err) {}
    } else if (e.key === "ArrowRight") {
      try {
        v.currentTime = Math.min(v.duration || 1e9, v.currentTime + 10);
      } catch (err) {}
    } else if (e.key === "ArrowUp") {
      v.volume = Math.min(1, v.volume + 0.05);
      v.muted = false;
      syncMuteUi();
    } else if (e.key === "ArrowDown") {
      v.volume = Math.max(0, v.volume - 0.05);
      syncMuteUi();
    } else if (e.key === "m" || e.key === "M") {
      v.muted = !v.muted;
      syncMuteUi();
    } else if (e.key === "f" || e.key === "F") {
      toggleFullscreen();
    } else if (e.key === "Escape") {
      closeSettings();
      closeXraySheet();
    }
  });

  window.SDCinema = {
    onChromeReady,
    openSettings,
    applyPlayerTheme,
    stopDualAudio,
  };

  applyPlayerTheme(lsGet(LS_PLAYER_THEME, "cinema"));
  if (document.getElementById("hlsChrome")) onChromeReady();
})();
/* Embed hybrid chrome: slim OSD + YouTube postMessage bridge when available */
(function sdEmbedBoot() {
  let embedActive = false;
  let embedApi = null; // "youtube" | null
  let ytState = -1;
  let ytTime = 0;
  let hideTimer = null;
  let msgBound = false;
  let reclaimBound = false;
  let wasHiddenWhileEmbed = false;
  let nativeOpen = null;
  let liveEmbedMode = false;
  // Block adware popups from third-party embeds; keep scripts/fullscreen working.
  // Note: some preferred players (Videasy) refuse to run when *any* sandbox attr is set.
  const EMBED_SANDBOX =
    "allow-scripts allow-same-origin allow-forms allow-presentation allow-fullscreen allow-pointer-lock";

  function embedHostNeedsOpenFrame(url) {
    try {
      const host = new URL(String(url || ""), location.href).hostname.toLowerCase();
      return /(^|\.)videasy\.(net|to)$|(^|\.)smashystream\.com$|(^|\.)vixsrc\.to$/.test(host);
    } catch (e) {
      return false;
    }
  }

  function detectEmbedApi(url) {
    const u = String(url || "").toLowerCase();
    if (/youtube\.com|youtube-nocookie\.com|youtu\.be/.test(u)) return "youtube";
    return null;
  }

  function ensureYoutubeApiParams(url) {
    try {
      const u = new URL(url, location.href);
      if (!/youtube\.com|youtube-nocookie\.com/.test(u.hostname)) return url;
      u.searchParams.set("enablejsapi", "1");
      u.searchParams.set("origin", location.origin);
      u.searchParams.set("playsinline", "1");
      u.searchParams.set("controls", "0");
      u.searchParams.set("modestbranding", "1");
      u.searchParams.set("rel", "0");
      return u.toString();
    } catch (e) {
      return url;
    }
  }

  function ytCommand(func, args) {
    if (!trailerFrame || !trailerFrame.contentWindow) return;
    try {
      trailerFrame.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: func, args: args || [] }),
        "*"
      );
    } catch (e) {}
  }

  function ytListen() {
    if (msgBound) return;
    msgBound = true;
    window.addEventListener("message", (event) => {
      if (!embedActive || embedApi !== "youtube") return;
      if (!event.origin || (!event.origin.includes("youtube.com") && !event.origin.includes("youtube-nocookie.com")))
        return;
      let data;
      try {
        data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch (e) {
        return;
      }
      if (!data || typeof data !== "object") return;
      if (data.event === "onStateChange" && typeof data.info === "number") {
        ytState = data.info;
        syncEmbedPlayBtn();
      }
      if (data.event === "infoDelivery" && data.info && typeof data.info === "object") {
        if (typeof data.info.playerState === "number") {
          ytState = data.info.playerState;
          syncEmbedPlayBtn();
        }
        if (typeof data.info.currentTime === "number") ytTime = data.info.currentTime;
      }
      if (data.event === "onReady") {
        ytCommand("addEventListener", ["onStateChange"]);
        syncEmbedPlayBtn();
      }
    });
  }

  function syncEmbedPlayBtn() {
    const btn = document.getElementById("embedPlayBtn");
    if (!btn) return;
    const playing = ytState === 1;
    btn.innerHTML = playing
      ? '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';
    btn.title = playing ? "Pause" : "Play";
  }

  function ensureEmbedChrome() {
    if (!trailerLayer) return null;
    let bar = document.getElementById("embedChrome");
    if (bar) return bar;
    bar = document.createElement("div");
    bar.id = "embedChrome";
    bar.className = "embed-chrome";
    bar.innerHTML =
      '<div class="embed-chrome-top">' +
      '<div class="embed-chrome-meta">' +
      '<div class="embed-chrome-eye" id="embedEye">Embed</div>' +
      '<div class="embed-chrome-title" id="embedTitle">Now playing</div>' +
      '<div class="embed-chrome-sub" id="embedSub"></div>' +
      "</div>" +
      '<div class="embed-chrome-actions">' +
      '<button type="button" class="embed-btn" id="embedDirectBtn" title="Try direct stream">Direct</button>' +
      '<button type="button" class="embed-btn" id="embedSourcesBtn" title="Sources">Sources</button>' +
      '<button type="button" class="embed-btn" id="embedAudioBtn" title="Language">Lang</button>' +
      '<button type="button" class="embed-btn" id="embedSettingsBtn" title="Settings">⚙</button>' +
      "</div></div>" +
      '<div class="embed-chrome-hint" id="embedHint">Using embed · tap empty video area for provider controls</div>' +
      '<div class="embed-chrome-bottom" id="embedRemoteBar" hidden>' +
      '<button type="button" class="embed-btn icon" id="embedBack10" title="-10s">−10</button>' +
      '<button type="button" class="embed-btn icon" id="embedPlayBtn" title="Play/Pause">' +
      '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg></button>' +
      '<button type="button" class="embed-btn icon" id="embedFwd10" title="+10s">+10</button>' +
      '<button type="button" class="embed-btn icon" id="embedMuteBtn" title="Mute">🔇</button>' +
      '<span class="embed-api-pill" id="embedApiPill">Remote</span>' +
      "</div>";
    trailerLayer.appendChild(bar);
    ensureReclaimBar();
    wireEmbedChrome(bar);
    return bar;
  }

  function ensureReclaimBar() {
    if (!trailerLayer) return null;
    let reclaim = document.getElementById("embedReclaim");
    if (reclaim) return reclaim;
    reclaim = document.createElement("div");
    reclaim.id = "embedReclaim";
    reclaim.className = "embed-reclaim";
    reclaim.hidden = true;
    reclaim.innerHTML =
      '<div class="embed-reclaim-msg" id="embedReclaimMsg">Popup blocked — your film is still here</div>' +
      '<div class="embed-reclaim-actions">' +
      '<button type="button" class="embed-btn primary" id="embedReclaimFilm">Back to film</button>' +
      '<button type="button" class="embed-btn" id="embedReclaimSources">Sources</button>' +
      '<button type="button" class="embed-btn" id="embedReclaimDismiss">Dismiss</button>' +
      '<button type="button" class="embed-btn" id="embedReclaimExit">Exit player</button>' +
      "</div>";
    trailerLayer.appendChild(reclaim);
    reclaim.querySelector("#embedReclaimFilm").addEventListener("click", (e) => {
      e.stopPropagation();
      reclaimToFilm();
    });
    reclaim.querySelector("#embedReclaimSources").addEventListener("click", (e) => {
      e.stopPropagation();
      hideReclaim();
      if (liveEmbedMode) {
        try {
          if (typeof applyGuideState === "function") applyGuideState(false);
          else if (typeof toggleGuide === "function") toggleGuide();
        } catch (err) {}
        return;
      }
      openEmbedSources();
    });
    reclaim.querySelector("#embedReclaimDismiss").addEventListener("click", (e) => {
      e.stopPropagation();
      hideReclaim();
    });
    reclaim.querySelector("#embedReclaimExit").addEventListener("click", (e) => {
      e.stopPropagation();
      hideReclaim();
      if (liveEmbedMode) {
        try {
          if (typeof applyGuideState === "function") applyGuideState(false);
        } catch (err) {}
        try {
          if (window.SDEmbed && SDEmbed.stop) SDEmbed.stop();
        } catch (err) {}
        // Tear down live embed and retune current channel chrome (guide visible).
        try {
          if (typeof restoreLiveChannelPlayback === "function") {
            restoreLiveChannelPlayback("live-embed-exit");
          } else if (typeof switchChannel === "function" && typeof channelId !== "undefined" && channelId) {
            switchChannel(String(channelId), { force: true });
          }
        } catch (err) {}
        return;
      }
      if (typeof stopOverlayPlayback === "function") stopOverlayPlayback();
      else if (typeof stopTrailerPlayback === "function") stopTrailerPlayback();
    });
    return reclaim;
  }

  function syncReclaimChrome() {
    const filmBtn = document.getElementById("embedReclaimFilm");
    const sourcesBtn = document.getElementById("embedReclaimSources");
    const exitBtn = document.getElementById("embedReclaimExit");
    const msg = document.getElementById("embedReclaimMsg");
    if (liveEmbedMode) {
      if (filmBtn) filmBtn.textContent = "Back to live";
      if (sourcesBtn) sourcesBtn.textContent = "Guide";
      if (exitBtn) exitBtn.textContent = "Exit backup";
      if (msg && (!msg.dataset.locked || msg.dataset.locked === "0")) {
        msg.textContent = "Popup blocked — live backup player is still here";
      }
    } else {
      if (filmBtn) filmBtn.textContent = "Back to film";
      if (sourcesBtn) sourcesBtn.textContent = "Sources";
      if (exitBtn) exitBtn.textContent = "Exit player";
      if (msg && (!msg.dataset.locked || msg.dataset.locked === "0")) {
        msg.textContent = "Popup blocked — your film is still here";
      }
    }
  }

  function peekFilmShell() {
    try {
      if (typeof window.SDPeekFilmOverVodCatalog === "function") window.SDPeekFilmOverVodCatalog();
      else {
        document.getElementById("vodCatalog")?.classList.remove("open");
        document.getElementById("vodCatalogBackdrop")?.classList.remove("open");
      }
    } catch (e) {}
    // Live backup: collapse guide/sheet so reclaim stays visible on mobile (same class as VOD).
    if (liveEmbedMode) {
      try {
        if (typeof applyGuideState === "function") applyGuideState(true);
      } catch (e) {}
      try {
        document.getElementById("epgPanel")?.classList.remove("open");
      } catch (e) {}
    }
  }

  function showReclaim(message) {
    if (!embedActive) return;
    const bar = ensureReclaimBar();
    if (!bar) return;
    // Catalog/guide sheet can sit under the trailer layer but still steal attention / cover reclaim on mobile.
    peekFilmShell();
    syncReclaimChrome();
    const msg = document.getElementById("embedReclaimMsg");
    if (msg && message) {
      msg.textContent = message;
      msg.dataset.locked = "1";
    }
    bar.hidden = false;
    bar.classList.add("show");
    showEmbedChrome();
    const back = document.getElementById("trailerBackBtn");
    if (back) {
      back.classList.add("embed-sticky-back");
      back.textContent = liveEmbedMode ? "← Back to live" : "← Back to film";
    }
  }

  function hideReclaim() {
    const bar = document.getElementById("embedReclaim");
    if (bar) {
      bar.hidden = true;
      bar.classList.remove("show");
    }
    const msg = document.getElementById("embedReclaimMsg");
    if (msg) msg.dataset.locked = "0";
  }

  function reclaimToFilm() {
    hideReclaim();
    peekFilmShell();
    try {
      if (typeof closeVodPickerPanel === "function") closeVodPickerPanel();
    } catch (e) {}
    try {
      if (window.SDPinUnlock && SDPinUnlock.isOpen && SDPinUnlock.isOpen()) SDPinUnlock.close();
    } catch (e) {}
    showEmbedChrome();
    const back = document.getElementById("trailerBackBtn");
    if (back) {
      back.classList.add("embed-sticky-back");
      back.textContent = liveEmbedMode ? "← Back to live" : "← Back to film";
    }
    try {
      if (trailerLayer) trailerLayer.scrollIntoView({ block: "nearest" });
    } catch (e) {}
    // Nudge iframe focus without navigating away.
    try {
      if (trailerFrame && trailerFrame.contentWindow) trailerFrame.contentWindow.focus();
    } catch (e) {}
    try {
      window.focus();
    } catch (e) {}
  }

  function hardenTrailerFrame(embedUrl) {
    if (!trailerFrame) return;
    try {
      const openFrame = embedHostNeedsOpenFrame(embedUrl || trailerFrame.src || "");
      if (openFrame) {
        // Videasy (and similar) detect sandbox="" and show "Iframe Sandbox Detected".
        // Hijack popups still blocked by installPopupGuard() window.open wrapper.
        trailerFrame.removeAttribute("sandbox");
        trailerFrame.setAttribute("referrerpolicy", "origin-when-cross-origin");
      } else {
        trailerFrame.setAttribute("sandbox", EMBED_SANDBOX);
        trailerFrame.setAttribute("referrerpolicy", "no-referrer");
      }
      // Keep media permissions; do not grant display-capture / payment.
      trailerFrame.setAttribute(
        "allow",
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      );
    } catch (e) {}
  }

  function installPopupGuard() {
    if (nativeOpen) return;
    try {
      nativeOpen = window.open;
      window.open = function () {
        if (embedActive) {
          showReclaim(
            liveEmbedMode
              ? "Blocked a hijack popup — tap Back to live"
              : "Blocked a hijack popup — tap Back to film"
          );
          return null;
        }
        return nativeOpen.apply(window, arguments);
      };
    } catch (e) {}
  }

  function removePopupGuard() {
    if (!nativeOpen) return;
    try {
      window.open = nativeOpen;
    } catch (e) {}
    nativeOpen = null;
  }

  function wireReclaimLifecycle() {
    if (reclaimBound) return;
    reclaimBound = true;
    let reclaimCooldownUntil = 0;
    let blurAt = 0;
    function softReclaim(message) {
      if (!embedActive) return;
      if (Date.now() < reclaimCooldownUntil) return;
      showReclaim(message);
      reclaimCooldownUntil = Date.now() + 8000;
    }
    document.addEventListener("visibilitychange", () => {
      if (!embedActive) return;
      if (document.hidden) {
        wasHiddenWhileEmbed = true;
        return;
      }
      if (wasHiddenWhileEmbed) {
        wasHiddenWhileEmbed = false;
        softReclaim(
          liveEmbedMode
            ? "Returned from another tab — continue live backup"
            : "Returned from another tab — continue your film"
        );
      }
    });
    window.addEventListener("pagehide", () => {
      if (embedActive) wasHiddenWhileEmbed = true;
    });
    window.addEventListener("pageshow", () => {
      if (embedActive && wasHiddenWhileEmbed) {
        wasHiddenWhileEmbed = false;
        softReclaim(
          liveEmbedMode
            ? "Welcome back — live backup player is still open"
            : "Welcome back — your film player is still open"
        );
      }
    });
    // Ignore brief blur (notification shade / status bar). Only long focus loss.
    window.addEventListener("blur", () => {
      if (embedActive) blurAt = Date.now();
    });
    window.addEventListener("focus", () => {
      if (!embedActive || !blurAt) return;
      const away = Date.now() - blurAt;
      blurAt = 0;
      if (away < 2500) return;
      if (wasHiddenWhileEmbed) wasHiddenWhileEmbed = false;
      softReclaim(
        liveEmbedMode
          ? "Focus restored — tap Back to live if an ad covered playback"
          : "Focus restored — tap Back to film if an ad covered playback"
      );
    });
  }

  function wireEmbedChrome(bar) {
    if (bar.dataset.wired === "1") return;
    bar.dataset.wired = "1";
    document.getElementById("embedSourcesBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      openEmbedSources();
    });
    document.getElementById("embedAudioBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.SDCinema && SDCinema.openSettings) SDCinema.openSettings();
    });
    document.getElementById("embedDirectBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      retryDirectStream();
    });
    document.getElementById("embedSettingsBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.SDCinema && SDCinema.openSettings) SDCinema.openSettings();
    });
    document.getElementById("embedPlayBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      if (embedApi !== "youtube") return;
      if (ytState === 1) ytCommand("pauseVideo");
      else ytCommand("playVideo");
      showEmbedChrome();
    });
    document.getElementById("embedBack10").addEventListener("click", (e) => {
      e.stopPropagation();
      if (embedApi === "youtube") {
        ytTime = Math.max(0, (ytTime || 0) - 10);
        ytCommand("seekTo", [ytTime, true]);
      }
      showEmbedChrome();
    });
    document.getElementById("embedFwd10").addEventListener("click", (e) => {
      e.stopPropagation();
      if (embedApi === "youtube") {
        ytTime = (ytTime || 0) + 10;
        ytCommand("seekTo", [ytTime, true]);
      }
      showEmbedChrome();
    });
    document.getElementById("embedMuteBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      if (embedApi !== "youtube") return;
      const btn = e.currentTarget;
      if (btn.dataset.muted === "1") {
        ytCommand("unMute");
        btn.dataset.muted = "0";
        btn.textContent = "🔊";
      } else {
        ytCommand("mute");
        btn.dataset.muted = "1";
        btn.textContent = "🔇";
      }
      showEmbedChrome();
    });

    if (trailerLayer && trailerLayer.dataset.embedChromeBound !== "1") {
      trailerLayer.dataset.embedChromeBound = "1";
      /*
       * Embed chrome zones (aligned with HLS party hotzones):
       * top = Direct/Sources/Lang/title, bottom = remote bar, center toggles.
       * Ignore .party-drawer so chat taps never pop embed OSD over the rail.
       */
      function embedPartyIgnore(target) {
        return !!(
          target &&
          target.closest &&
          target.closest(
            ".party-drawer, .party-fab, .party-toast, .party-jitsi-stage, .party-av-overlay, #partyAvOverlay, #partyFab, .party-live-overlay, .sd-modal, .sd-modal-backdrop"
          )
        );
      }
      function embedInVideoPane(e) {
        if (!trailerLayer) return true;
        const va = document.getElementById("videoArea");
        const hulu =
          trailerLayer.classList.contains("party-layout-hulu") ||
          (va && va.classList.contains("party-layout-hulu"));
        const rave =
          trailerLayer.classList.contains("party-layout-rave") ||
          (va && va.classList.contains("party-layout-rave"));
        if (!hulu && !rave) return true;
        const x = e.clientX != null ? e.clientX : (e.touches && e.touches[0] && e.touches[0].clientX) || 0;
        const y = e.clientY != null ? e.clientY : (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
        if (hulu) {
          const drawer = document.getElementById("partyDrawer");
          if (drawer && drawer.classList.contains("open")) {
            return x < drawer.getBoundingClientRect().left;
          }
        }
        if (rave) {
          const rect = (va || trailerLayer).getBoundingClientRect();
          return (y - rect.top) / Math.max(1, rect.height) <= 0.55;
        }
        return true;
      }
      trailerLayer.addEventListener("mousemove", (e) => {
        if (!embedActive || embedPartyIgnore(e.target) || !embedInVideoPane(e)) return;
        showEmbedChrome();
      });
      trailerLayer.addEventListener(
        "touchstart",
        (e) => {
          if (!embedActive || embedPartyIgnore(e.target) || !embedInVideoPane(e)) return;
          showEmbedChrome();
        },
        { passive: true }
      );
      trailerLayer.addEventListener("click", (e) => {
        if (!embedActive || embedPartyIgnore(e.target) || !embedInVideoPane(e)) return;
        if (e.target.closest(".embed-chrome-actions, .embed-chrome-bottom, button, input")) return;
        const bar = document.getElementById("embedChrome");
        if (bar && bar.classList.contains("show")) {
          bar.classList.remove("show");
          clearTimeout(hideTimer);
        } else {
          showEmbedChrome();
        }
      });
    }
  }

  function showEmbedChrome() {
    const bar = ensureEmbedChrome();
    if (!bar || !embedActive) return;
    bar.classList.add("show");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!embedActive) return;
      bar.classList.remove("show");
    }, 3200);
  }

  function updateEmbedMeta() {
    const ctx = typeof vodPickerCtx !== "undefined" ? vodPickerCtx || {} : {};
    const title = document.getElementById("embedTitle");
    const sub = document.getElementById("embedSub");
    const eye = document.getElementById("embedEye");
    if (title) title.textContent = ctx.title || "Now playing";
    if (eye) eye.textContent = embedApi === "youtube" ? "YouTube · remote" : "Embed playback";
    if (sub) {
      const bits = [];
      if (ctx.season && ctx.episode) bits.push("S" + ctx.season + " · E" + ctx.episode);
      if (ctx.episodeName) bits.push(ctx.episodeName);
      sub.textContent = bits.join(" — ");
    }
    const remote = document.getElementById("embedRemoteBar");
    const hint = document.getElementById("embedHint");
    if (remote) remote.hidden = embedApi !== "youtube";
    if (hint) {
      hint.textContent =
        embedApi === "youtube"
          ? "Remote controls active · use our bar for play / seek / mute"
          : "Using embed · empty video area passes clicks to provider · Sources / Direct above";
    }
  }

  async function openEmbedSources() {
    const ctx = typeof vodPickerCtx !== "undefined" ? vodPickerCtx : null;
    if (!ctx || !ctx.tmdbId) return;
    if (typeof openVodPickerForCtx === "function") await openVodPickerForCtx(ctx);
  }

  async function retryDirectStream() {
    const ctx = typeof vodPickerCtx !== "undefined" ? vodPickerCtx : null;
    if (!ctx || !ctx.tmdbId) return;
    const hint = document.getElementById("embedHint");
    if (hint) hint.textContent = "Trying direct stream…";
    try {
      let url =
        "/vod/resolve?tmdb_id=" +
        encodeURIComponent(ctx.tmdbId) +
        "&type=" +
        encodeURIComponent(ctx.mediaType || "movie") +
        "&lang=" +
        encodeURIComponent(typeof vodPreferLang === "function" ? vodPreferLang() : "en");
      if (ctx.season) url += "&season=" + encodeURIComponent(ctx.season);
      if (ctx.episode) url += "&episode=" + encodeURIComponent(ctx.episode);
      const r = await authFetch(url, { cache: "no-store" });
      const data = await r.json();
      if (data && data.ok && data.stream_url && typeof playDirectVodFromResolve === "function") {
        stopEmbedChrome();
        const retKind =
          (typeof overlayReturn !== "undefined" && overlayReturn && overlayReturn.kind) ||
          "vod_detail";
        await playDirectVodFromResolve(data, retKind === "live" ? "vod_detail" : retKind, ctx);
        return;
      }
      if (hint) hint.textContent = "No direct stream yet · pick another source";
    } catch (e) {
      if (hint) hint.textContent = "Direct stream failed · stay on embed";
    }
  }

  function startEmbedChrome(embedUrl, opts) {
    opts = opts || {};
    liveEmbedMode = !!(opts.live || opts.mode === "live");
    embedActive = true;
    embedApi = detectEmbedApi(embedUrl);
    ytState = -1;
    ytTime = 0;
    wasHiddenWhileEmbed = false;
    ytListen();
    wireReclaimLifecycle();
    installPopupGuard();
    hardenTrailerFrame(embedUrl);
    if (trailerLayer) {
      trailerLayer.classList.add("embed-mode");
      trailerLayer.classList.remove("hls-mode", "has-hls-chrome");
      if (liveEmbedMode) trailerLayer.classList.add("live-embed-mode");
      else trailerLayer.classList.remove("live-embed-mode");
    }
    ensureEmbedChrome();
    ensureReclaimBar();
    syncReclaimChrome();
    hideReclaim();
    // Keep reclaim + player visible over VOD catalog / live guide sheet on mobile.
    peekFilmShell();
    updateEmbedMeta();
    showEmbedChrome();
    const back = document.getElementById("trailerBackBtn");
    if (back) {
      back.classList.add("embed-sticky-back");
      if (liveEmbedMode) {
        back.textContent = "← Back to live";
      } else if (typeof overlayReturn !== "undefined" && overlayReturn && overlayReturn.kind !== "live") {
        back.textContent = "← Back to film";
      }
    }
    // Hide VOD-only Direct/Sources chrome noise for live backup.
    try {
      const direct = document.getElementById("embedDirectBtn");
      const sources = document.getElementById("embedSourcesBtn");
      const audio = document.getElementById("embedAudioBtn");
      if (direct) direct.hidden = !!liveEmbedMode;
      if (sources) sources.hidden = !!liveEmbedMode;
      if (audio) audio.hidden = !!liveEmbedMode;
      const eye = document.getElementById("embedEye");
      if (eye) eye.textContent = liveEmbedMode ? "Live backup" : "Embed";
      const hint = document.getElementById("embedHint");
      if (hint) {
        const tos = !!(window.__SD_LIVE_CDN_TOS);
        hint.textContent = liveEmbedMode
          ? (tos
            ? "Upstream CDN ToS-blocked — backup waiting on new CDN · tap for controls"
            : "CDN blocked — backup player · tap empty area for controls")
          : "Using embed · tap empty video area for provider controls";
      }
    } catch (e) {}
    if (embedApi === "youtube") {
      setTimeout(() => {
        ytCommand("addEventListener", ["onStateChange"]);
        ytCommand("playVideo");
      }, 700);
    }
  }

  function stopEmbedChrome() {
    embedActive = false;
    embedApi = null;
    liveEmbedMode = false;
    wasHiddenWhileEmbed = false;
    clearTimeout(hideTimer);
    hideReclaim();
    removePopupGuard();
    if (trailerLayer) trailerLayer.classList.remove("embed-mode", "live-embed-mode");
    const bar = document.getElementById("embedChrome");
    if (bar) bar.classList.remove("show");
    const back = document.getElementById("trailerBackBtn");
    if (back) back.classList.remove("embed-sticky-back");
    try {
      const direct = document.getElementById("embedDirectBtn");
      const sources = document.getElementById("embedSourcesBtn");
      const audio = document.getElementById("embedAudioBtn");
      if (direct) direct.hidden = false;
      if (sources) sources.hidden = false;
      if (audio) audio.hidden = false;
    } catch (e) {}
  }

  function enhanceEmbedUrl(url) {
    if (detectEmbedApi(url) === "youtube") return ensureYoutubeApiParams(url);
    return url;
  }

  window.SDEmbed = {
    start: startEmbedChrome,
    stop: stopEmbedChrome,
    enhanceUrl: enhanceEmbedUrl,
    hasRemote: () => embedApi === "youtube",
    isActive: () => !!embedActive,
    isLive: () => !!liveEmbedMode,
    sandbox: EMBED_SANDBOX,
    hardenFrame: hardenTrailerFrame,
    reclaim: reclaimToFilm,
    showReclaim: showReclaim,
    peekShell: peekFilmShell,
  };
})();
/* player_party_av: built-in WebRTC mesh + movable/resizable AV overlay (Jitsi optional) */
(function sdPartyAvBoot() {
  const LS_PROVIDER = "sd_party_av_provider";
  const SS_GEOM = "sd_party_av_geom";
  const IDLE_MS = 2500;
  const IDLE_BUBBLE = 100; // 88–112px circle when idle
  const MIN_W = 160;
  const MIN_H = 120;
  const DEFAULT_W = 280;
  const DEFAULT_H = 200;
  const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];

  let sendFn = null;
  let myMemberId = "";
  let roomCode = "";
  let displayName = "Guest";
  let mode = "text"; // voice | video | hybrid
  let provider = "webrtc";
  let active = false;
  let localStream = null;
  let muted = false;
  let camOff = false;
  let peers = Object.create(null); // memberId -> { pc, polite, makingOffer, ignoreOffer, videoEl }
  let remoteStates = Object.create(null); // memberId -> av_state
  let jitsiFrame = null;
  let idleTimer = null;
  let dragState = null;
  let resizeState = null;
  let pinchState = null;
  let lastRectGeom = null; // active PiP size/pos (persisted; circle idle does not overwrite)
  let stageFocus = "content"; // content | local | peerId
  let stageLayoutActive = false;

  function getProvider() {
    try {
      const v = (localStorage.getItem(LS_PROVIDER) || "webrtc").toLowerCase();
      return v === "jitsi" ? "jitsi" : "webrtc";
    } catch (e) {
      return "webrtc";
    }
  }

  function setProvider(p) {
    p = String(p || "webrtc").toLowerCase() === "jitsi" ? "jitsi" : "webrtc";
    try {
      localStorage.setItem(LS_PROVIDER, p);
    } catch (e) {}
    const prev = provider;
    provider = p;
    syncProviderUi();
    if (active && prev !== p) {
      const m = mode;
      stopInternal();
      startInternal(m);
    }
    return provider;
  }

  function orientKey() {
    try {
      return window.matchMedia("(orientation: landscape)").matches ? "land" : "port";
    } catch (e) {
      return "port";
    }
  }

  function loadGeom() {
    try {
      const raw = sessionStorage.getItem(SS_GEOM + "_" + orientKey());
      if (!raw) return null;
      const g = JSON.parse(raw);
      if (!g || typeof g.w !== "number") return null;
      return g;
    } catch (e) {
      return null;
    }
  }

  function saveGeom(g) {
    try {
      sessionStorage.setItem(SS_GEOM + "_" + orientKey(), JSON.stringify(g));
    } catch (e) {}
  }

  /** Same stable host as SDParty — never trailerLayer (hidden on pure live). */
  function partyHost() {
    return (
      document.getElementById("videoArea") ||
      document.getElementById("tvRoot") ||
      document.body
    );
  }

  function layer() {
    return partyHost();
  }

  function wantsVideo() {
    return mode === "video" || mode === "hybrid";
  }

  function toast(msg) {
    if (window.SDParty && typeof SDParty._toast === "function") SDParty._toast(msg);
    else if (typeof window.showErr === "function") showErr(msg);
  }

  function ensureOverlay() {
    let el = document.getElementById("partyAvOverlay");
    const host = partyHost();
    if (el) {
      if (host && el.parentNode !== host) host.appendChild(el);
      return el;
    }
    el = document.createElement("div");
    el.id = "partyAvOverlay";
    el.className = "party-av-overlay";
    el.innerHTML =
      '<div class="party-av-chrome" id="partyAvChrome">' +
      '<div class="party-av-header" id="partyAvHeader">' +
      '<span class="party-av-title" id="partyAvTitle">Call</span>' +
      '<span class="party-av-provider-chip" id="partyAvProviderChip"></span>' +
      "</div>" +
      '<div class="party-av-note" id="partyAvNote" hidden>Jitsi public demo may disconnect after ~5 minutes</div>' +
      '<div class="party-av-stage" id="partyAvStage"></div>' +
      '<div class="party-av-controls" id="partyAvControls">' +
      '<button type="button" class="party-av-btn" id="partyAvMute" title="Mute mic" aria-label="Mute">🎤</button>' +
      '<button type="button" class="party-av-btn" id="partyAvCam" title="Toggle camera" aria-label="Camera">📷</button>' +
      '<button type="button" class="party-av-btn party-av-hangup" id="partyAvHangup" title="Leave call" aria-label="Hang up">✕</button>' +
      "</div>" +
      '<div class="party-av-resize" id="partyAvResize" title="Resize" aria-hidden="true"></div>' +
      "</div>";
    host.appendChild(el);
    wireOverlayGestures(el);
    const muteBtn = document.getElementById("partyAvMute");
    const camBtn = document.getElementById("partyAvCam");
    const hangBtn = document.getElementById("partyAvHangup");
    if (muteBtn) muteBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleMute(); });
    if (camBtn) camBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleCam(); });
    if (hangBtn) hangBtn.addEventListener("click", (e) => { e.stopPropagation(); hangUp(); });
    return el;
  }

  function markActive() {
    const el = document.getElementById("partyAvOverlay");
    if (!el) return;
    if (stageLayoutActive) {
      // Stage+filmstrip stays docked; no idle circle morph
      clearTimeout(idleTimer);
      return;
    }
    wakeFromIdle(el);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!active || stageLayoutActive) return;
      enterIdle(el);
    }, IDLE_MS);
  }

  function isLandscapeHulu() {
    try {
      const layerEl = layer();
      if (layerEl && layerEl.classList.contains("party-layout-hulu")) return true;
      if (document.body.classList.contains("party-layout-hulu")) return true;
      return (
        window.matchMedia("(orientation: landscape)").matches &&
        (window.matchMedia("(max-height: 500px)").matches ||
          window.matchMedia("(max-width: 720px)").matches)
      );
    } catch (e) {
      return false;
    }
  }

  function remotePeerCount() {
    return Object.keys(peers).length;
  }

  function shouldUseStageLayout() {
    if (!active || provider === "jitsi") return false;
    if (mode !== "voice" && mode !== "video" && mode !== "hybrid") return false;
    if (!isLandscapeHulu()) return false;
    // Multi-peer stage once ≥1 remote AV peer
    return remotePeerCount() >= 1;
  }

  function ensureStageDom() {
    const stage = document.getElementById("partyAvStage");
    if (!stage) return null;
    let main = document.getElementById("partyAvMainStage");
    let strip = document.getElementById("partyAvFilmstrip");
    if (!main) {
      main = document.createElement("div");
      main.id = "partyAvMainStage";
      main.className = "party-stage";
    }
    if (!strip) {
      strip = document.createElement("div");
      strip.id = "partyAvFilmstrip";
      strip.className = "party-filmstrip";
    }
    if (main.parentNode !== stage) stage.appendChild(main);
    if (strip.parentNode !== stage) stage.appendChild(strip);
    if (!strip.dataset.focusWired) {
      strip.dataset.focusWired = "1";
      strip.addEventListener("click", (e) => {
        const tile = e.target.closest(".party-av-tile");
        if (!tile) return;
        const focus = tile.dataset.focus || (tile.classList.contains("local") ? "local" : tile.dataset.peer);
        if (focus) setStageFocus(focus);
      });
    }
    return { stage: stage, main: main, strip: strip };
  }

  function ensureContentTile() {
    const dom = ensureStageDom();
    if (!dom) return null;
    let tile = document.getElementById("partyAvContentTile");
    if (!tile) {
      tile = document.createElement("div");
      tile.id = "partyAvContentTile";
      tile.className = "party-av-tile party-content-tile";
      tile.dataset.focus = "content";
      tile.setAttribute("role", "button");
      tile.setAttribute("tabindex", "0");
      tile.title = "Show content on stage";
      tile.innerHTML =
        '<div class="party-content-thumb" aria-hidden="true">🎬</div>' +
        '<span class="party-av-label">Content</span>';
    }
    return tile;
  }

  function setStageFocus(focus) {
    stageFocus = String(focus || (mode === "hybrid" ? "content" : "local"));
    syncStageLayout();
  }

  function defaultStageFocus() {
    if (mode === "hybrid") return "content";
    const remotes = Object.keys(peers);
    if (remotes.length) return remotes[0];
    return "local";
  }

  function dockStageOverlay(el) {
    if (!el) return;
    el.style.left = "0px";
    el.style.top = "0px";
    el.style.right = "";
    el.style.bottom = "";
    el.style.width = "";
    el.style.height = "";
  }

  function syncStageLayout() {
    const el = document.getElementById("partyAvOverlay");
    const stage = document.getElementById("partyAvStage");
    if (!el || !stage || stage.classList.contains("jitsi")) return;

    const want = shouldUseStageLayout();
    if (!want) {
      if (stageLayoutActive) {
        stageLayoutActive = false;
        el.classList.remove("party-stage-mode", "party-stage-content-focus");
        // Flatten tiles back into stage grid
        const main = document.getElementById("partyAvMainStage");
        const strip = document.getElementById("partyAvFilmstrip");
        const content = document.getElementById("partyAvContentTile");
        if (content) content.remove();
        const tiles = [];
        if (main) Array.from(main.children).forEach((c) => tiles.push(c));
        if (strip) Array.from(strip.children).forEach((c) => tiles.push(c));
        tiles.forEach((t) => {
          if (t && t.classList.contains("party-av-tile") && !t.classList.contains("party-content-tile")) {
            stage.appendChild(t);
          }
        });
        if (main) main.remove();
        if (strip) strip.remove();
        placeDefault();
        markActive();
      }
      return;
    }

    const was = stageLayoutActive;
    stageLayoutActive = true;
    el.classList.remove("idle", "party-av-idle");
    el.classList.add("party-stage-mode");
    clearTimeout(idleTimer);

    if (!stageFocus || (!was && mode === "hybrid")) stageFocus = defaultStageFocus();
    if (mode === "video" && stageFocus === "content") stageFocus = defaultStageFocus();
    if (mode === "voice" && stageFocus === "content") stageFocus = defaultStageFocus();

    const dom = ensureStageDom();
    if (!dom) return;
    const { main, strip } = dom;

    // Collect all camera tiles currently anywhere under stage
    const allTiles = Array.from(stage.querySelectorAll(".party-av-tile")).filter(
      (t) => !t.classList.contains("party-content-tile")
    );
    allTiles.forEach((t) => {
      t.classList.remove("party-focus-active", "party-av-idle-focus");
      if (!t.dataset.focus) {
        t.dataset.focus = t.classList.contains("local") ? "local" : t.dataset.peer || "";
      }
      t.setAttribute("role", "button");
      t.setAttribute("tabindex", "0");
    });

    const contentFocus = mode === "hybrid" && stageFocus === "content";
    el.classList.toggle("party-stage-content-focus", contentFocus);

    // Clear main/strip then redistribute
    while (main.firstChild) main.removeChild(main.firstChild);
    while (strip.firstChild) strip.removeChild(strip.firstChild);

    if (contentFocus) {
      const content = ensureContentTile();
      // Content is on the movie canvas; cameras all go to filmstrip
      allTiles.forEach((t) => strip.appendChild(t));
      // Keep content tile available in strip for swap-back after peer focus — not needed while content is focused
    } else {
      let focusTile =
        allTiles.find((t) => (t.dataset.focus || "") === stageFocus) ||
        allTiles.find((t) => t.classList.contains("local") && stageFocus === "local") ||
        allTiles.find((t) => t.dataset.peer === stageFocus) ||
        allTiles[0];
      if (focusTile) {
        focusTile.classList.add("party-focus-active");
        main.appendChild(focusTile);
      }
      allTiles.forEach((t) => {
        if (t !== focusTile) strip.appendChild(t);
      });
      if (mode === "hybrid") {
        const content = ensureContentTile();
        if (content) {
          content.classList.toggle("party-focus-active", false);
          strip.appendChild(content);
        }
      }
    }

    dockStageOverlay(el);
  }

  function syncIdleVideoFocus() {
    const stage = document.getElementById("partyAvStage");
    if (!stage) return;
    stage.querySelectorAll(".party-av-tile").forEach((t) => t.classList.remove("party-av-idle-focus"));
    if (stage.classList.contains("jitsi")) return;
    if (stageLayoutActive) return;
    const remotes = Array.from(stage.querySelectorAll(".party-av-tile.remote"));
    let focus =
      remotes.find((t) => !t.classList.contains("audio-only")) ||
      remotes[0] ||
      stage.querySelector(".party-av-tile.local");
    if (focus) focus.classList.add("party-av-idle-focus");
  }

  function enterIdle(el) {
    if (!el || !active || stageLayoutActive) return;
    if (!el.classList.contains("party-av-idle")) {
      lastRectGeom = Object.assign({}, currentGeom());
      persistRectGeom(lastRectGeom);
    }
    syncIdleVideoFocus();
    el.classList.add("idle", "party-av-idle");
    el.style.opacity = "";
    const g = lastRectGeom || currentGeom();
    const size = IDLE_BUBBLE;
    const cx = g.x + g.w / 2;
    const cy = g.y + g.h / 2;
    applyGeom({ x: cx - size / 2, y: cy - size / 2, w: size, h: size }, { skipPersist: true });
  }

  function wakeFromIdle(el) {
    if (!el) return;
    const wasIdle = el.classList.contains("party-av-idle") || el.classList.contains("idle");
    el.classList.remove("idle", "party-av-idle");
    el.style.opacity = "1";
    if (!wasIdle) return;
    const circle = currentGeom();
    const rect = lastRectGeom || {
      w: DEFAULT_W,
      h: DEFAULT_H,
      x: circle.x,
      y: circle.y,
    };
    const cx = circle.x + circle.w / 2;
    const cy = circle.y + circle.h / 2;
    applyGeom({
      x: cx - rect.w / 2,
      y: cy - rect.h / 2,
      w: rect.w,
      h: rect.h,
    });
  }

  function videoPaneSize(host) {
    const rect = host.getBoundingClientRect();
    let w = rect.width;
    let h = rect.height;
    const layoutEl =
      document.getElementById("videoArea") ||
      document.getElementById("trailerLayer") ||
      host;
    try {
      if (layoutEl.classList.contains("party-layout-hulu")) {
        const cs = getComputedStyle(layoutEl);
        const railRaw = cs.getPropertyValue("--party-rail-w").trim();
        let rail = 0;
        if (railRaw.endsWith("px")) rail = parseFloat(railRaw) || 0;
        else if (railRaw) {
          const drawer = document.getElementById("partyDrawer");
          if (drawer && drawer.classList.contains("open")) {
            rail = drawer.getBoundingClientRect().width;
          }
        }
        if (rail > 0) w = Math.max(MIN_W + 16, rect.width - rail);
        else {
          const drawer = document.getElementById("partyDrawer");
          if (drawer && drawer.classList.contains("open") && !layoutEl.classList.contains("party-chat-minimized")) {
            const dr = drawer.getBoundingClientRect();
            w = Math.max(MIN_W + 16, dr.left - rect.left);
          }
        }
      }
      if (layoutEl.classList.contains("party-layout-rave")) {
        if (layoutEl.classList.contains("party-live-overlay")) {
          h = rect.height;
        } else {
          const drawer = document.getElementById("partyDrawer");
          if (drawer && drawer.classList.contains("open") && !drawer.classList.contains("collapsed")) {
            const dr = drawer.getBoundingClientRect();
            h = Math.max(MIN_H + 16, dr.top - rect.top);
          } else {
            h = rect.height * 0.62;
          }
        }
      }
    } catch (e) {}
    return { w: w, h: h };
  }

  function clampGeom(g, host) {
    const pane = videoPaneSize(host);
    const pad = 8;
    let safeT = pad;
    let safeB = Math.max(pad, 24);
    let safeL = pad;
    let safeR = pad;
    try {
      const cs = getComputedStyle(document.documentElement);
      const readEnv = (name) => {
        const raw = cs.getPropertyValue(name);
        const n = parseInt(raw, 10);
        return Number.isFinite(n) ? n : 0;
      };
      // env() rarely resolves via getPropertyValue; keep numeric pads + CSS safe-area on host
      safeT = pad + Math.max(0, readEnv("--sat") || 0);
    } catch (e) {}
    const maxW = Math.max(MIN_W, pane.w - safeL - safeR);
    const maxH = Math.max(MIN_H, pane.h - safeT - safeB);
    const el = document.getElementById("partyAvOverlay");
    const idleCircle = el && el.classList.contains("party-av-idle");
    if (idleCircle) {
      const size = Math.min(IDLE_BUBBLE, maxW, maxH, Math.min(pane.w, pane.h) * 0.42);
      g.w = size;
      g.h = size;
    } else {
      g.w = Math.min(Math.max(MIN_W, g.w), maxW);
      g.h = Math.min(Math.max(MIN_H, g.h), maxH);
    }
    g.x = Math.min(Math.max(safeL, g.x), Math.max(safeL, pane.w - g.w - safeR));
    g.y = Math.min(Math.max(safeT, g.y), Math.max(safeT, pane.h - g.h - safeB));
    return g;
  }

  function persistRectGeom(g) {
    lastRectGeom = { x: g.x, y: g.y, w: g.w, h: g.h };
    saveGeom(lastRectGeom);
  }

  function applyGeom(g, opts) {
    const el = document.getElementById("partyAvOverlay");
    const host = layer();
    if (!el || !host) return;
    g = clampGeom(Object.assign({}, g), host);
    el.style.left = g.x + "px";
    el.style.top = g.y + "px";
    el.style.width = g.w + "px";
    el.style.height = g.h + "px";
    el.style.right = "auto";
    el.style.bottom = "auto";
    if (opts && opts.skipPersist) {
      // Idle circle: keep lastRectGeom; update stored position from circle center
      if (lastRectGeom) {
        const cx = g.x + g.w / 2;
        const cy = g.y + g.h / 2;
        saveGeom({
          x: cx - lastRectGeom.w / 2,
          y: cy - lastRectGeom.h / 2,
          w: lastRectGeom.w,
          h: lastRectGeom.h,
        });
      }
      return;
    }
    persistRectGeom(g);
  }

  function currentGeom() {
    const el = document.getElementById("partyAvOverlay");
    if (!el) return { x: 12, y: 12, w: DEFAULT_W, h: DEFAULT_H };
    return {
      x: parseFloat(el.style.left) || el.offsetLeft || 12,
      y: parseFloat(el.style.top) || el.offsetTop || 12,
      w: parseFloat(el.style.width) || el.offsetWidth || DEFAULT_W,
      h: parseFloat(el.style.height) || el.offsetHeight || DEFAULT_H,
    };
  }

  function placeDefault() {
    const host = layer();
    const saved = loadGeom();
    if (saved) {
      lastRectGeom = Object.assign({}, saved);
      applyGeom(saved);
      return;
    }
    const w = Math.min(DEFAULT_W, (host && host.clientWidth ? host.clientWidth : 360) * 0.42);
    const h = Math.min(DEFAULT_H, (host && host.clientHeight ? host.clientHeight : 640) * 0.36);
    applyGeom({ x: 12, y: 12, w: w, h: h });
  }

  function isInteractiveTarget(t) {
    if (!t || !t.closest) return false;
    return !!(
      t.closest(".party-av-btn") ||
      t.closest("button") ||
      t.closest("a") ||
      t.closest("select") ||
      t.closest("input") ||
      t.closest("#partyAvResize")
    );
  }

  function wireOverlayGestures(el) {
    if (el.dataset.gestures === "1") return;
    el.dataset.gestures = "1";
    const header = el.querySelector("#partyAvHeader");
    const resize = el.querySelector("#partyAvResize");

    const beginDrag = (e, captureEl) => {
      if (e.button != null && e.button !== 0) return;
      markActive();
      const g = currentGeom();
      dragState = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origX: g.x,
        origY: g.y,
      };
      try {
        (captureEl || el).setPointerCapture(e.pointerId);
      } catch (err) {}
      e.preventDefault();
      e.stopPropagation();
    };
    const onPointerMove = (e) => {
      if (!dragState || dragState.id !== e.pointerId) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      const base = currentGeom();
      applyGeom({
        x: dragState.origX + dx,
        y: dragState.origY + dy,
        w: base.w,
        h: base.h,
      });
      // Keep awake while dragging without re-entering idle morph mid-gesture
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!active) return;
        const overlay = document.getElementById("partyAvOverlay");
        if (overlay) enterIdle(overlay);
      }, IDLE_MS);
    };
    const onPointerUp = (e) => {
      if (!dragState || dragState.id !== e.pointerId) return;
      dragState = null;
      markActive();
    };

    // Idle: whole bubble is drag handle; active: header drag; any pointer wakes
    el.addEventListener("pointerdown", (e) => {
      if (isInteractiveTarget(e.target)) {
        markActive();
        return;
      }
      if (el.classList.contains("party-av-idle") || el.classList.contains("idle")) {
        beginDrag(e, el);
        return;
      }
      if (header && (e.target === header || header.contains(e.target))) {
        beginDrag(e, header);
        return;
      }
      markActive();
    });
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);

    if (resize) {
      resize.addEventListener("pointerdown", (e) => {
        if (e.button != null && e.button !== 0) return;
        // Wake first — resize only after active rect
        markActive();
        const g = currentGeom();
        resizeState = {
          id: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          origW: g.w,
          origH: g.h,
          origX: g.x,
          origY: g.y,
        };
        try {
          resize.setPointerCapture(e.pointerId);
        } catch (err) {}
        e.preventDefault();
        e.stopPropagation();
      });
      resize.addEventListener("pointermove", (e) => {
        if (!resizeState || resizeState.id !== e.pointerId) return;
        applyGeom({
          x: resizeState.origX,
          y: resizeState.origY,
          w: resizeState.origW + (e.clientX - resizeState.startX),
          h: resizeState.origH + (e.clientY - resizeState.startY),
        });
        markActive();
      });
      resize.addEventListener("pointerup", (e) => {
        if (!resizeState || resizeState.id !== e.pointerId) return;
        resizeState = null;
        markActive();
      });
      resize.addEventListener("pointercancel", () => {
        resizeState = null;
      });
    }

    // Pinch: first contact wakes to rect; then resize
    el.addEventListener(
      "touchstart",
      (e) => {
        markActive();
        if (e.touches.length === 2) {
          const a = e.touches[0];
          const b = e.touches[1];
          const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          const g = currentGeom();
          pinchState = { dist: dist, w: g.w, h: g.h, x: g.x, y: g.y };
          e.preventDefault();
        }
      },
      { passive: false }
    );
    el.addEventListener(
      "touchmove",
      (e) => {
        if (!pinchState || e.touches.length !== 2) return;
        const a = e.touches[0];
        const b = e.touches[1];
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const scale = dist / Math.max(1, pinchState.dist);
        const nw = pinchState.w * scale;
        const nh = pinchState.h * scale;
        const cx = pinchState.x + pinchState.w / 2;
        const cy = pinchState.y + pinchState.h / 2;
        applyGeom({ x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh });
        markActive();
        e.preventDefault();
      },
      { passive: false }
    );
    el.addEventListener("touchend", () => {
      pinchState = null;
      markActive();
    });
  }

  function syncProviderUi() {
    const chip = document.getElementById("partyAvProviderChip");
    const note = document.getElementById("partyAvNote");
    if (chip) chip.textContent = provider === "jitsi" ? "Jitsi" : "Built-in";
    if (note) note.hidden = provider !== "jitsi";
    const sel = document.getElementById("partyAvProviderSelect");
    if (sel && sel.value !== provider) sel.value = provider;
    const setSel = document.getElementById("sdPartyAvProvider");
    if (setSel && setSel.value !== provider) setSel.value = provider;
  }

  function syncControlsUi() {
    const muteBtn = document.getElementById("partyAvMute");
    const camBtn = document.getElementById("partyAvCam");
    const title = document.getElementById("partyAvTitle");
    if (muteBtn) {
      muteBtn.textContent = muted ? "🔇" : "🎤";
      muteBtn.classList.toggle("off", muted);
      muteBtn.title = muted ? "Unmute mic" : "Mute mic";
    }
    if (camBtn) {
      camBtn.hidden = !wantsVideo() || provider === "jitsi";
      camBtn.textContent = camOff ? "🚫" : "📷";
      camBtn.classList.toggle("off", camOff);
    }
    if (title) {
      title.textContent = mode === "voice" ? "Voice" : mode === "hybrid" ? "Hybrid" : "Video";
    }
  }

  function send(msg) {
    if (typeof sendFn === "function") sendFn(msg);
  }

  function broadcastAvState(inCall) {
    send({
      type: "av_state",
      inCall: !!inCall,
      mode: mode,
      muted: muted,
      camOff: camOff,
    });
  }

  async function getLocalMedia() {
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      localStream = null;
    }
    const constraints = {
      audio: true,
      video: wantsVideo()
        ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
        : false,
    };
    try {
      localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      if (wantsVideo()) {
        try {
          localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          toast("Camera unavailable — audio only");
          camOff = true;
        } catch (e2) {
          toast("Microphone permission denied");
          throw e2;
        }
      } else {
        toast("Microphone permission denied");
        throw e;
      }
    }
    if (muted) localStream.getAudioTracks().forEach((t) => (t.enabled = false));
    if (camOff) localStream.getVideoTracks().forEach((t) => (t.enabled = false));
    return localStream;
  }

  function ensureLocalTile() {
    const stage = document.getElementById("partyAvStage");
    if (!stage) return;
    let tile = document.getElementById("partyAvLocalTile");
    if (!tile) {
      tile = document.createElement("div");
      tile.id = "partyAvLocalTile";
      tile.className = "party-av-tile local";
      tile.dataset.focus = "local";
      tile.innerHTML =
        '<video playsinline autoplay muted id="partyAvLocalVideo"></video>' +
        '<span class="party-av-label">You</span>';
      const strip = document.getElementById("partyAvFilmstrip");
      const main = document.getElementById("partyAvMainStage");
      if (stageLayoutActive && strip) strip.appendChild(tile);
      else if (stageLayoutActive && main) main.appendChild(tile);
      else stage.prepend(tile);
    }
    const vid = document.getElementById("partyAvLocalVideo");
    if (vid && localStream && vid.srcObject !== localStream) {
      vid.srcObject = localStream;
      vid.play().catch(() => {});
    }
    tile.classList.toggle("audio-only", !wantsVideo() || camOff || !localStream || !localStream.getVideoTracks().length);
    const overlay = document.getElementById("partyAvOverlay");
    if (overlay && overlay.classList.contains("party-av-idle")) syncIdleVideoFocus();
    syncStageLayout();
  }

  function ensureRemoteTile(peerId, name) {
    const stage = document.getElementById("partyAvStage");
    if (!stage) return null;
    const id = "partyAvPeer_" + peerId;
    let tile = document.getElementById(id);
    if (!tile) {
      tile = document.createElement("div");
      tile.id = id;
      tile.className = "party-av-tile remote";
      tile.dataset.peer = peerId;
      tile.dataset.focus = peerId;
      tile.innerHTML =
        '<video playsinline autoplay id="partyAvVid_' +
        peerId +
        '"></video>' +
        '<span class="party-av-label"></span>';
      const strip = document.getElementById("partyAvFilmstrip");
      if (stageLayoutActive && strip) strip.appendChild(tile);
      else stage.appendChild(tile);
    }
    const label = tile.querySelector(".party-av-label");
    if (label) label.textContent = name || remoteStates[peerId]?.displayName || "Peer";
    syncStageLayout();
    return tile;
  }

  function removeRemoteTile(peerId) {
    const tile = document.getElementById("partyAvPeer_" + peerId);
    if (tile) tile.remove();
    if (stageFocus === peerId) stageFocus = defaultStageFocus();
    syncStageLayout();
  }

  function closePeer(peerId) {
    const p = peers[peerId];
    if (!p) return;
    try {
      p.pc.close();
    } catch (e) {}
    delete peers[peerId];
    removeRemoteTile(peerId);
  }

  function closeAllPeers() {
    Object.keys(peers).forEach(closePeer);
  }

  function pcConfig() {
    return { iceServers: ICE_SERVERS };
  }

  async function ensurePeer(peerId, polite) {
    if (peers[peerId]) return peers[peerId];
    const pc = new RTCPeerConnection(pcConfig());
    const entry = {
      pc: pc,
      polite: !!polite,
      makingOffer: false,
      ignoreOffer: false,
    };
    peers[peerId] = entry;

    if (localStream) {
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    }

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      send({
        type: "webrtc_ice",
        to: peerId,
        candidate: ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate,
      });
    };

    pc.ontrack = (ev) => {
      const tile = ensureRemoteTile(peerId, remoteStates[peerId]?.displayName);
      const vid = document.getElementById("partyAvVid_" + peerId);
      const stream = ev.streams && ev.streams[0] ? ev.streams[0] : new MediaStream([ev.track]);
      if (vid && vid.srcObject !== stream) {
        vid.srcObject = stream;
        vid.play().catch(() => {});
      }
      if (tile) {
        const hasVid = stream.getVideoTracks().some((t) => t.enabled && t.readyState !== "ended");
        tile.classList.toggle("audio-only", !hasVid);
      }
      const overlay = document.getElementById("partyAvOverlay");
      if (overlay && overlay.classList.contains("party-av-idle")) syncIdleVideoFocus();
    };

    pc.onnegotiationneeded = async () => {
      try {
        entry.makingOffer = true;
        await pc.setLocalDescription();
        send({ type: "webrtc_offer", to: peerId, sdp: pc.localDescription });
      } catch (e) {
        /* ignore */
      } finally {
        entry.makingOffer = false;
      }
    };

    ensureRemoteTile(peerId, remoteStates[peerId]?.displayName);
    return entry;
  }

  async function connectToPeer(peerId) {
    if (!peerId || peerId === myMemberId || peers[peerId]) return;
    // Perfect negotiation: higher id is polite (answers glare)
    const polite = String(myMemberId) > String(peerId);
    await ensurePeer(peerId, polite);
  }

  async function handleOffer(msg) {
    const from = msg.from;
    if (!from || from === myMemberId) return;
    const polite = String(myMemberId) > String(from);
    const entry = await ensurePeer(from, polite);
    const pc = entry.pc;
    const offerCollision = entry.makingOffer || pc.signalingState !== "stable";
    entry.ignoreOffer = !entry.polite && offerCollision;
    if (entry.ignoreOffer) return;
    await pc.setRemoteDescription(msg.sdp);
    await pc.setLocalDescription();
    send({ type: "webrtc_answer", to: from, sdp: pc.localDescription });
  }

  async function handleAnswer(msg) {
    const entry = peers[msg.from];
    if (!entry) return;
    try {
      await entry.pc.setRemoteDescription(msg.sdp);
    } catch (e) {}
  }

  async function handleIce(msg) {
    const entry = peers[msg.from];
    if (!entry || !msg.candidate) return;
    try {
      await entry.pc.addIceCandidate(msg.candidate);
    } catch (e) {}
  }

  function handleHangup(msg) {
    if (msg.from) closePeer(msg.from);
  }

  function handleAvState(msg) {
    if (!msg || !msg.from || msg.from === myMemberId) return;
    remoteStates[msg.from] = msg;
    if (!active || provider !== "webrtc") return;
    if (msg.inCall) {
      connectToPeer(msg.from).catch(() => {});
      ensureRemoteTile(msg.from, msg.displayName);
    } else {
      closePeer(msg.from);
    }
  }

  function jitsiRoomName() {
    return "sdgateway-" + String(roomCode || "lobby").toLowerCase();
  }

  function startJitsiInOverlay() {
    const stage = document.getElementById("partyAvStage");
    if (!stage || !roomCode) return;
    stage.innerHTML = "";
    stage.classList.add("jitsi");
    const room = encodeURIComponent(jitsiRoomName());
    const display = encodeURIComponent((displayName || "Guest").slice(0, 32));
    const audioOnly = mode === "voice";
    const cfg =
      "#userInfo.displayName=%22" +
      display +
      "%22&config.prejoinPageEnabled=false&config.disableDeepLinking=true" +
      (audioOnly ? "&config.startWithVideoMuted=true&config.startAudioOnly=true" : "") +
      (mode === "video" || mode === "hybrid" ? "&config.startWithAudioMuted=false" : "");
    jitsiFrame = document.createElement("iframe");
    jitsiFrame.allow = "camera; microphone; fullscreen; display-capture; autoplay";
    jitsiFrame.setAttribute("allowfullscreen", "true");
    jitsiFrame.src = "https://meet.jit.si/" + room + cfg;
    jitsiFrame.setAttribute("data-room", jitsiRoomName());
    jitsiFrame.setAttribute("data-mode", mode);
    stage.appendChild(jitsiFrame);
  }

  function stopJitsiInOverlay() {
    const stage = document.getElementById("partyAvStage");
    if (stage) {
      stage.classList.remove("jitsi");
      stage.innerHTML = "";
    }
    jitsiFrame = null;
  }

  async function startWebRtc() {
    const stage = document.getElementById("partyAvStage");
    if (stage) {
      stage.classList.remove("jitsi");
      stage.innerHTML = "";
    }
    await getLocalMedia();
    ensureLocalTile();
    broadcastAvState(true);
    // Connect to anyone already advertising inCall
    Object.keys(remoteStates).forEach((id) => {
      if (remoteStates[id] && remoteStates[id].inCall) connectToPeer(id).catch(() => {});
    });
  }

  async function startInternal(m) {
    mode = m;
    provider = getProvider();
    stageFocus = mode === "hybrid" ? "content" : "local";
    stageLayoutActive = false;
    const el = ensureOverlay();
    el.classList.add("open");
    el.classList.remove("party-stage-mode", "party-stage-content-focus");
    placeDefault();
    syncProviderUi();
    syncControlsUi();
    markActive();
    active = true;
    if (provider === "jitsi") {
      startJitsiInOverlay();
    } else {
      try {
        await startWebRtc();
      } catch (e) {
        active = false;
        el.classList.remove("open");
        return;
      }
    }
    syncControlsUi();
    syncStageLayout();
  }

  function stopInternal() {
    active = false;
    stageLayoutActive = false;
    stageFocus = "content";
    clearTimeout(idleTimer);
    if (provider === "webrtc" || localStream) {
      try {
        broadcastAvState(false);
      } catch (e) {}
    }
    closeAllPeers();
    stopJitsiInOverlay();
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      localStream = null;
    }
    const el = document.getElementById("partyAvOverlay");
    if (el) {
      el.classList.remove("open", "idle", "party-av-idle", "party-stage-mode", "party-stage-content-focus");
      el.style.opacity = "";
    }
    const layerEl = layer();
    if (layerEl) layerEl.classList.remove("party-av-full");
    // Remove legacy full-bleed jitsi stage if present
    const legacy = document.getElementById("partyJitsiStage");
    if (legacy) {
      legacy.classList.remove("open", "hybrid");
      legacy.innerHTML = "";
    }
  }

  function toggleMute() {
    muted = !muted;
    if (localStream) localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
    syncControlsUi();
    markActive();
    if (active && provider === "webrtc") broadcastAvState(true);
  }

  function toggleCam() {
    if (!wantsVideo()) return;
    camOff = !camOff;
    if (localStream) localStream.getVideoTracks().forEach((t) => (t.enabled = !camOff));
    ensureLocalTile();
    syncControlsUi();
    markActive();
    if (active && provider === "webrtc") broadcastAvState(true);
  }

  function hangUp() {
    stopInternal();
    if (window.SDParty && typeof SDParty._onAvHangup === "function") SDParty._onAvHangup();
  }

  function start(opts) {
    opts = opts || {};
    sendFn = opts.send || sendFn;
    myMemberId = opts.memberId || myMemberId;
    roomCode = opts.roomCode || roomCode;
    displayName = opts.displayName || displayName || "Guest";
    provider = getProvider();
    const m = String(opts.mode || "voice").toLowerCase();
    if (m === "text") {
      stopInternal();
      return;
    }
    return startInternal(m);
  }

  function stop() {
    stopInternal();
  }

  function handleSignal(msg) {
    if (!msg || !msg.type) return;
    if (msg.type === "av_state") {
      handleAvState(msg);
      return;
    }
    if (!active || provider !== "webrtc") {
      if (msg.type === "av_state") handleAvState(msg);
      return;
    }
    if (msg.type === "webrtc_offer") handleOffer(msg).catch(() => {});
    else if (msg.type === "webrtc_answer") handleAnswer(msg).catch(() => {});
    else if (msg.type === "webrtc_ice") handleIce(msg).catch(() => {});
    else if (msg.type === "webrtc_hangup") handleHangup(msg);
  }

  function onMembers(members) {
    if (!active || provider !== "webrtc") return;
    const ids = new Set((members || []).map((m) => m.id || m.memberId).filter(Boolean));
    Object.keys(peers).forEach((id) => {
      if (!ids.has(id)) closePeer(id);
    });
    // Re-announce so late joiners can mesh with us
    broadcastAvState(true);
    syncStageLayout();
  }

  function onPartyLayoutChange() {
    if (!active) return;
    syncStageLayout();
    if (!stageLayoutActive) applyGeom(currentGeom());
  }

  function injectProviderSelect(host) {
    if (!host || document.getElementById("partyAvProviderSelect")) return;
    const wrap = document.createElement("div");
    wrap.className = "party-av-provider-row";
    wrap.id = "partyAvProviderRow";
    wrap.innerHTML =
      '<label class="party-av-provider-label">Call provider' +
      '<select id="partyAvProviderSelect">' +
      '<option value="webrtc">Built-in (free)</option>' +
      '<option value="jitsi">Jitsi (demo limit)</option>' +
      "</select></label>";
    host.appendChild(wrap);
    const sel = document.getElementById("partyAvProviderSelect");
    if (sel) {
      sel.value = getProvider();
      sel.addEventListener("change", () => {
        setProvider(sel.value);
        if (window.SDParty && typeof SDParty._onAvProviderChange === "function") {
          SDParty._onAvProviderChange(sel.value);
        }
      });
    }
  }

  // Re-clamp on resize/orientation
  try {
    window.addEventListener("resize", () => {
      if (!active) return;
      syncStageLayout();
      if (!stageLayoutActive) applyGeom(currentGeom());
    });
    window.addEventListener("orientationchange", () => {
      setTimeout(() => {
        if (!active) return;
        syncStageLayout();
        if (stageLayoutActive) return;
        const saved = loadGeom();
        if (saved) applyGeom(saved);
        else placeDefault();
      }, 100);
    });
  } catch (e) {}

  provider = getProvider();

  window.SDPartyAV = {
    LS_PROVIDER,
    getProvider,
    setProvider,
    start,
    stop,
    handleSignal,
    onMembers,
    onPartyLayoutChange,
    injectProviderSelect,
    hangUp,
    setStageFocus,
    isActive: () => active,
    syncProviderUi,
  };
})();
/* player_party: QR share/remote, watch party chat/reactions/HLS clock sync */
(function sdPartyBoot() {
  const REACTIONS = ["👍", "👎", "❤️", "😂", "😮", "👏", "🎉", "🔥"];
  const LS_CLIENT = "sd_party_client_id";
  const LS_HOST_KEY = "sd_party_host_key";
  const LS_SYNC_FOLLOW = "sd_party_sync_follow";
  const SS_CHAT_MIN = "sd_party_chat_minimized";
  const SS_LIVE_EXPANDED = "sd_party_live_expanded";
  /** FAB chat UI mode — marker: sd_party_chat_mode — default coherency (Live / mockup C) */
  const LS_CHAT_UI_MODE = "sd_party_chat_mode";
  const CLOCK_LOOP_MS = 1750;
  const PING_INTERVAL_MS = 8000;
  const SEEK_COOLDOWN_MS = 1800;
  const DRIFT_IGNORE_S = 0.12;
  const DRIFT_SOFT_S = 0.85;
  const SOFT_RATE_FAST = 1.02;
  const SOFT_RATE_SLOW = 0.98;
  const CHAT_UI_MODES = ["sidebar", "coherency", "peek", "muted", "cinema"];
  const CHAT_UI_LABELS = {
    sidebar: "Sidebar",
    coherency: "Live",
    peek: "Peek",
    muted: "Muted",
    cinema: "Cinema",
  };
  /** Sidebar layout when mode=sidebar — marker: sd_party_sidebar_style (a=chat-first, b=tabs, e=dual-pane; no D) */
  const LS_SIDEBAR_STYLE = "sd_party_sidebar_style";
  const SIDEBAR_STYLES = ["a", "b", "e"];
  const SIDEBAR_STYLE_LABELS = {
    a: "Chat first",
    b: "Tabs",
    e: "Dual pane",
  };
  const SIDEBAR_STYLE_MARKERS = {
    a: "chat-first",
    b: "tabs",
    e: "dual-pane",
  };
  const RISING_MAX = 4;
  const RISING_FADE_MS = 4200;
  const RISING_FADE_FAST_MS = 2400;
  let layoutChromeWired = false;
  let layoutChromeRaf = 0;
  const CHAT_IDLE_MS = 5000;
  const NAME_MAX = 64;
  const DEFAULT_FEATURES = {
    chat_text: true,
    chat_gif: true,
    chat_voice_note: true,
    av_voice: true,
    av_video: true,
    sync_vod: true,
    sync_wait_buffering: false,
  };
  const SYNC_LIVE_MODES = ["off", "content", "catchup", "lag", "pdt"];
  let ws = null;
  let roomCode = "";
  let roomName = "";
  let roomPublic = false;
  let roomNumber = 0;
  let memberId = "";
  let hostKey = "";
  let isHost = false;
  let isAdmin = false;
  let roomFeatures = Object.assign({}, DEFAULT_FEATURES);
  let roomAdmins = [];
  let syncLiveMode = "content";
  let catchupUrl = null;
  let waitForBuffering = false;
  let clockOffsetMs = 0;
  let lastSeekAt = 0;
  let lastPingSentAt = 0;
  let pingTimer = null;
  let hasPdt = false;
  let lastProgramDateTime = null;
  let lastAttachedCatchup = null;
  let guestFollowSync = true;
  let chatMode = "text"; // text | voice | video | hybrid
  let applyingClock = false;
  let applyingContent = false;
  let clockTimer = null;
  let remoteBound = false;
  let bufferingBound = false;
  let softRateTimer = null;
  let lastMembers = [];
  let chatCollapsed = false;
  let liveExpanded = false;
  let chatIdleTimer = null;
  let uiWired = false;
  let voiceRecorder = null;
  let voiceChunks = [];
  let voiceStartAt = 0;
  let chatUiMode = loadChatUiMode();
  let chatUiModeBeforeCinema = "coherency";
  let sidebarStyle = loadSidebarStyle();
  let sidebarTab = "chat";
  let dualCollapsed = false;
  let unreadWhileMuted = 0;
  let peekComposeOpen = false;
  let fabLongPressTimer = null;
  let fabIgnoreClick = false;
  let fabLastTapAt = 0;

  function partyName() {
    return (window.SDFeatures && SDFeatures.partyName && SDFeatures.partyName()) || "Guest";
  }

  function clientId() {
    try {
      let id = localStorage.getItem(LS_CLIENT);
      if (!id) {
        id =
          (crypto.randomUUID && crypto.randomUUID()) ||
          "c" + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(LS_CLIENT, id);
      }
      return id;
    } catch (e) {
      return "anon";
    }
  }

  function storeHostKey(code, key) {
    if (!code || !key) return;
    try {
      localStorage.setItem(LS_HOST_KEY + "_" + code, key);
    } catch (e) {}
  }

  function loadHostKey(code) {
    try {
      return localStorage.getItem(LS_HOST_KEY + "_" + code) || "";
    } catch (e) {
      return "";
    }
  }

  /**
   * Party chrome host (drawer / FAB / toast / LIVE badge / AV).
   * Must stay visible for BOTH live and VOD. `#trailerLayer` is `display:none`
   * during pure live and is torn down by `stopOverlayPlayback` / channel switch —
   * mounting there made chat appear then vanish once the live stream started.
   * Marker: party-chrome-host
   */
  function partyHost() {
    return (
      document.getElementById("videoArea") ||
      document.getElementById("tvRoot") ||
      document.body
    );
  }

  function layer() {
    return partyHost();
  }

  function chatRoot() {
    return partyHost();
  }

  function layoutRoots() {
    return [
      document.getElementById("videoArea"),
      document.getElementById("trailerLayer"),
      document.getElementById("tvRoot"),
      document.body,
    ].filter(Boolean);
  }

  function adoptPartyChrome(host) {
    if (!host) return;
    host.classList.add("party-chrome-host");
    ["partyDrawer", "partyFab", "partyToast", "partyLiveBadge", "partyAvOverlay", "partyRailHandle", "partyRisingBubbles", "partyModePicker"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (el && el.parentNode !== host) host.appendChild(el);
      }
    );
  }

  function partyLayoutMode() {
    try {
      if (window.matchMedia("(max-height: 500px) and (orientation: landscape)").matches) return "hulu";
      if (window.matchMedia("(max-width: 720px) and (orientation: landscape)").matches) return "hulu";
      if (window.matchMedia("(max-width: 720px)").matches) return "rave";
    } catch (e) {}
    return null;
  }

  function loadGuestFollowSync() {
    try {
      const raw = localStorage.getItem(LS_SYNC_FOLLOW);
      if (raw == null || raw === "") return true;
      return raw === "1" || raw === "true";
    } catch (e) {
      return true;
    }
  }

  function saveGuestFollowSync(on) {
    guestFollowSync = !!on;
    try {
      localStorage.setItem(LS_SYNC_FOLLOW, guestFollowSync ? "1" : "0");
    } catch (e) {}
  }

  guestFollowSync = loadGuestFollowSync();

  function loadChatMinPref() {
    try {
      return sessionStorage.getItem(SS_CHAT_MIN) === "1";
    } catch (e) {
      return false;
    }
  }

  function saveChatMinPref(min) {
    try {
      sessionStorage.setItem(SS_CHAT_MIN, min ? "1" : "0");
    } catch (e) {}
  }

  function loadLiveExpandedPref() {
    try {
      return sessionStorage.getItem(SS_LIVE_EXPANDED) === "1";
    } catch (e) {
      return false;
    }
  }

  function saveLiveExpandedPref(on) {
    try {
      sessionStorage.setItem(SS_LIVE_EXPANDED, on ? "1" : "0");
    } catch (e) {}
  }

  function loadChatUiMode() {
    try {
      const raw = localStorage.getItem(LS_CHAT_UI_MODE);
      if (raw == null || raw === "") return "coherency";
      return CHAT_UI_MODES.indexOf(raw) >= 0 ? raw : "coherency";
    } catch (e) {
      return "coherency";
    }
  }

  function saveChatUiMode(mode) {
    chatUiMode = CHAT_UI_MODES.indexOf(mode) >= 0 ? mode : "coherency";
    try {
      localStorage.setItem(LS_CHAT_UI_MODE, chatUiMode);
    } catch (e) {}
  }

  function loadSidebarStyle() {
    try {
      const raw = localStorage.getItem(LS_SIDEBAR_STYLE);
      if (raw == null || raw === "") return "a";
      const v = String(raw).toLowerCase();
      if (v === "d") return "a";
      return SIDEBAR_STYLES.indexOf(v) >= 0 ? v : "a";
    } catch (e) {
      return "a";
    }
  }

  function saveSidebarStyle(style) {
    const v = String(style || "").toLowerCase();
    sidebarStyle = SIDEBAR_STYLES.indexOf(v) >= 0 ? v : "a";
    try {
      localStorage.setItem(LS_SIDEBAR_STYLE, sidebarStyle);
    } catch (e) {}
  }

  function applySidebarStyle(style, opts) {
    opts = opts || {};
    if (style != null) saveSidebarStyle(style);
    else sidebarStyle = loadSidebarStyle();
    const drawer = document.getElementById("partyDrawer");
    if (!drawer) return;
    SIDEBAR_STYLES.forEach((s) => {
      drawer.classList.remove("party-sidebar-style-" + s);
      drawer.classList.remove("party-sidebar-" + (SIDEBAR_STYLE_MARKERS[s] || s));
    });
    drawer.classList.remove("party-sidebar-style-d", "party-sidebar-compact-rail");
    drawer.classList.add("party-sidebar-style-" + sidebarStyle);
    drawer.classList.add("party-sidebar-" + (SIDEBAR_STYLE_MARKERS[sidebarStyle] || sidebarStyle));
    drawer.dataset.sidebarStyle = sidebarStyle;
    if (!opts.keepTab) {
      sidebarTab = "chat";
    }
    drawer.dataset.sidebarTab = sidebarTab;
    drawer.classList.toggle("dual-collapsed", !!dualCollapsed && sidebarStyle === "e");
    if (sidebarStyle !== "a") {
      drawer.classList.remove("extras-open");
      const extras = document.getElementById("partyExtras");
      const moreBtn = document.getElementById("partyMoreBtn");
      if (extras && style != null) {
        extras.setAttribute("hidden", "");
        if (moreBtn) moreBtn.setAttribute("aria-expanded", "false");
      }
    }
    const tabs = drawer.querySelectorAll("#partySidebarTabs [data-sidebar-tab]");
    tabs.forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-sidebar-tab") === sidebarTab);
    });
    const styleBtns = drawer.querySelectorAll("[data-sidebar-style]");
    styleBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-sidebar-style") === sidebarStyle);
    });
    const dualBtn = document.getElementById("partyDualCollapse");
    if (dualBtn) {
      dualBtn.setAttribute("aria-expanded", dualCollapsed ? "false" : "true");
      const chev = dualBtn.querySelector(".party-dual-chevron");
      if (chev) chev.textContent = dualCollapsed ? "▾" : "▴";
    }
  }

  function bubblesEnabled() {
    if (!roomCode) return false;
    if (chatUiMode === "muted" || chatUiMode === "cinema") return false;
    if (chatUiMode === "peek" || chatUiMode === "coherency") return true;
    return !!chatCollapsed || !document.getElementById("partyDrawer")?.classList.contains("open");
  }

  function ensureRisingHost() {
    const fallback = partyHost();
    if (!fallback) return null;
    let el = document.getElementById("partyRisingBubbles");
    if (!el) {
      el = document.createElement("div");
      el.id = "partyRisingBubbles";
      el.className = "party-rising-bubbles";
      el.setAttribute("aria-live", "polite");
      el.setAttribute("aria-relevant", "additions");
      el.addEventListener("click", (e) => {
        const bubble = e.target.closest(".party-rising-bubble");
        if (!bubble) return;
        e.stopPropagation();
        if (chatUiMode === "peek") {
          peekComposeOpen = true;
          applyChatUiMode("coherency");
        } else if (chatUiMode === "coherency" || chatUiMode === "sidebar") {
          applyChatUiMode("sidebar");
          openOverlay();
        }
      });
    }
    placeRisingHost(el);
    return el;
  }

  /** Mount rising stack inside Live dock (after meta) or float on host otherwise. */
  function placeRisingHost(el) {
    el = el || document.getElementById("partyRisingBubbles");
    if (!el) return;
    const drawer = document.getElementById("partyDrawer");
    const inLiveDock = chatUiMode === "coherency" && !!roomCode && drawer && drawer.classList.contains("open");
    if (inLiveDock) {
      const ph = drawer.querySelector(".ph");
      const reacts = document.getElementById("partyReactions");
      const anchor = reacts || drawer.querySelector(".compose") || null;
      if (el.parentNode !== drawer || (ph && el.previousElementSibling !== ph)) {
        if (anchor) drawer.insertBefore(el, anchor);
        else if (ph && ph.nextSibling) drawer.insertBefore(el, ph.nextSibling);
        else drawer.appendChild(el);
      }
      el.classList.add("party-rising-in-dock");
    } else {
      const host = partyHost();
      if (host && el.parentNode !== host) host.appendChild(el);
      el.classList.remove("party-rising-in-dock");
    }
  }

  function risingFadeMs() {
    const host = document.getElementById("partyRisingBubbles");
    const n = host ? host.children.length : 0;
    if (n >= 3) return RISING_FADE_FAST_MS;
    return RISING_FADE_MS;
  }

  function pushRisingBubble(m) {
    if (!bubblesEnabled() || !m) return;
    const host = ensureRisingHost();
    if (!host) return;
    const kind = String(m.msgType || m.kind || "text").toLowerCase();
    const bubble = document.createElement("div");
    bubble.className = "party-rising-bubble";
    const who = escapeHtml(m.displayName || "?");
    let body = "";
    if (kind === "gif") body = "GIF";
    else if (kind === "voice") body = "🎤 voice note";
    else body = escapeHtml(String(m.text || "").slice(0, 140));
    bubble.innerHTML = '<span class="party-rising-name">' + who + "</span> " + body;
    host.appendChild(bubble);
    while (host.children.length > RISING_MAX) host.removeChild(host.firstChild);
    scheduleLayoutPartyChrome();
    const fadeAfter = risingFadeMs();
    setTimeout(() => {
      bubble.classList.add("fade");
      setTimeout(() => {
        bubble.remove();
        scheduleLayoutPartyChrome();
      }, 500);
    }, fadeAfter);
  }

  function pushRisingReaction(emoji) {
    if (!bubblesEnabled() || !emoji) return;
    const host = ensureRisingHost();
    if (!host) return;
    const bubble = document.createElement("div");
    bubble.className = "party-rising-bubble party-rising-react";
    bubble.textContent = emoji;
    host.appendChild(bubble);
    while (host.children.length > RISING_MAX) host.removeChild(host.firstChild);
    scheduleLayoutPartyChrome();
    setTimeout(() => {
      bubble.classList.add("fade");
      setTimeout(() => {
        bubble.remove();
        scheduleLayoutPartyChrome();
      }, 500);
    }, Math.min(2200, risingFadeMs()));
  }

  /**
   * Collision-aware party chrome layout (marker: layoutPartyChrome).
   * Slots (priority): video safe → transport → compose+reactions → rising → room meta → FAB → LIVE badge.
   * Live/coherency: flex bottom dock (meta → bubbles → reactions → compose); FAB clears compose.
   */
  function layoutPartyChrome() {
    layoutChromeRaf = 0;
    const drawer = document.getElementById("partyDrawer");
    const fab = document.getElementById("partyFab");
    const rising = document.getElementById("partyRisingBubbles");
    const chrome = document.getElementById("collapsedChrome");
    const roots = layoutRoots();

    let vvInset = 0;
    let vvHeight = window.innerHeight || 0;
    try {
      if (window.visualViewport) {
        const vv = window.visualViewport;
        vvHeight = vv.height || vvHeight;
        vvInset = Math.max(0, (window.innerHeight || 0) - vv.height - (vv.offsetTop || 0));
      }
    } catch (e) {}

    const chromeHidden = !!(chrome && chrome.classList.contains("chrome-hidden"));
    const liveDock = chatUiMode === "coherency" && !!roomCode;
    const hideDock = !roomCode || chatUiMode === "muted" || chatUiMode === "cinema";

    placeRisingHost(rising);

    let fabClear = 56;
    if (fab && fab.classList.contains("show") && !fab.hidden) {
      const w = fab.offsetWidth || 48;
      fabClear = Math.ceil(w) + 20;
    }

    const shortLandscape =
      (window.matchMedia && window.matchMedia("(max-height: 500px) and (orientation: landscape)").matches) ||
      vvHeight < 500;
    const narrow = (window.innerWidth || 0) <= 720;

    roots.forEach((el) => {
      el.style.setProperty("--party-vv-inset", vvInset + "px");
      el.style.setProperty("--party-fab-clear", fabClear + "px");
      el.style.setProperty("--party-vv-height", Math.round(vvHeight) + "px");
      el.classList.toggle("party-live-dock", liveDock && !hideDock);
      el.classList.toggle("party-dock-dim", liveDock && chromeHidden);
      el.classList.toggle("party-dock-short", !!(liveDock && shortLandscape));
      el.classList.toggle("party-dock-narrow", !!(liveDock && narrow));
    });

    if (rising) {
      const cap = shortLandscape ? Math.min(vvHeight * 0.22, 96) : Math.min(vvHeight * 0.28, 160);
      rising.style.maxHeight = Math.max(48, Math.round(cap)) + "px";
      const kids = rising.children;
      for (let i = 0; i < kids.length; i++) {
        const age = kids.length - 1 - i;
        if (age >= 2) kids[i].style.opacity = String(Math.max(0.38, 1 - age * 0.2));
        else kids[i].style.opacity = "";
      }
    }

    if (drawer && liveDock) {
      drawer.classList.add("party-live-dock-el");
      const nameEl = document.getElementById("partyDrawerName");
      if (nameEl) {
        nameEl.title = nameEl.textContent || "";
      }
    } else if (drawer) {
      drawer.classList.remove("party-live-dock-el");
    }

    // Sidebar: keep FAB clear of open rail / guide tab
    if (fab && chatUiMode === "sidebar" && drawer && drawer.classList.contains("open") && !chatCollapsed) {
      fab.classList.remove("show");
    }
  }

  function scheduleLayoutPartyChrome() {
    if (layoutChromeRaf) return;
    layoutChromeRaf = requestAnimationFrame(() => layoutPartyChrome());
  }

  function wireLayoutPartyChrome() {
    if (layoutChromeWired) return;
    layoutChromeWired = true;
    const onLayout = () => scheduleLayoutPartyChrome();
    window.addEventListener("resize", onLayout, { passive: true });
    window.addEventListener("orientationchange", () => setTimeout(onLayout, 80));
    try {
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", onLayout, { passive: true });
        window.visualViewport.addEventListener("scroll", onLayout, { passive: true });
      }
    } catch (e) {}
    const chrome = document.getElementById("collapsedChrome");
    if (chrome && window.MutationObserver) {
      try {
        new MutationObserver(onLayout).observe(chrome, { attributes: true, attributeFilter: ["class", "aria-hidden"] });
      } catch (e) {}
    }
    document.addEventListener(
      "fullscreenchange",
      onLayout,
      { passive: true }
    );
  }

  function updateFabChrome() {
    const fab = document.getElementById("partyFab");
    if (!fab) return;
    CHAT_UI_MODES.forEach((m) => fab.classList.remove("mode-" + m));
    fab.classList.add("mode-" + chatUiMode);
    fab.dataset.chatMode = chatUiMode;
    const label = CHAT_UI_LABELS[chatUiMode] || chatUiMode;
    fab.title = "Chat: " + label + " (tap to cycle)";
    fab.setAttribute("aria-label", "Party chat mode " + label);
    let badge = fab.querySelector(".party-fab-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "party-fab-badge";
      fab.appendChild(badge);
    }
    if (chatUiMode === "muted" && unreadWhileMuted > 0) {
      badge.hidden = false;
      badge.textContent = unreadWhileMuted > 9 ? "9+" : String(unreadWhileMuted);
    } else {
      badge.hidden = true;
      badge.textContent = "";
    }
  }

  function applyChatUiMode(mode, opts) {
    opts = opts || {};
    const prev = chatUiMode;
    if (mode === "cinema" && prev !== "cinema") chatUiModeBeforeCinema = prev;
    saveChatUiMode(mode);
    layoutRoots().forEach((el) => {
      CHAT_UI_MODES.forEach((m) => el.classList.remove("party-chat-mode-" + m));
      el.classList.add("party-chat-mode-" + chatUiMode);
    });
    const drawer = document.getElementById("partyDrawer");
    const fab = document.getElementById("partyFab");
    peekComposeOpen = chatUiMode === "coherency" ? peekComposeOpen : false;

    if (chatUiMode === "sidebar") {
      if (!opts.skipOpen && roomCode) {
        chatCollapsed = false;
        saveChatMinPref(false);
        if (drawer) {
          drawer.classList.add("open");
          drawer.classList.remove("collapsed");
        }
        setChatClasses(true, false);
        if (fab) fab.classList.toggle("show", false);
      }
    } else if (chatUiMode === "coherency") {
      liveExpanded = false;
      saveLiveExpandedPref(false);
      chatCollapsed = false;
      saveChatMinPref(false);
      if (drawer) {
        drawer.classList.add("open");
        drawer.classList.remove("collapsed");
      }
      layoutRoots().forEach((el) => {
        el.classList.add("party-layout-rave");
        el.classList.add("party-live-overlay");
        el.classList.remove("party-live-expanded");
        el.classList.remove("party-chat-minimized");
        el.classList.add("party-chat-open");
        el.classList.remove("party-chat-collapsed");
      });
      if (fab) fab.classList.add("show");
      if (window.SDPartyAV && typeof SDPartyAV.onPartyLayoutChange === "function") {
        try {
          SDPartyAV.onPartyLayoutChange();
        } catch (e) {}
      }
    } else {
      clearChatIdle();
      chatCollapsed = true;
      saveChatMinPref(true);
      if (drawer) {
        drawer.classList.add("collapsed");
        drawer.classList.remove("open");
      }
      setChatClasses(false, false);
      if (fab) fab.classList.toggle("show", !!roomCode);
    }
    updateFabChrome();
    ensureRisingHost();
    applySidebarStyle(null, { keepTab: true });
    if (chatUiMode !== "muted") unreadWhileMuted = 0;
    scheduleLayoutPartyChrome();
  }

  function cycleChatUiMode() {
    const i = CHAT_UI_MODES.indexOf(chatUiMode);
    const next = CHAT_UI_MODES[(i + 1) % CHAT_UI_MODES.length];
    applyChatUiMode(next);
    toast(CHAT_UI_LABELS[next] || next);
  }

  function ensureModePicker() {
    let picker = document.getElementById("partyModePicker");
    if (picker) return picker;
    picker = document.createElement("div");
    picker.id = "partyModePicker";
    picker.className = "party-mode-picker";
    picker.hidden = true;
    picker.innerHTML = CHAT_UI_MODES.map(
      (m) =>
        '<button type="button" data-ui-mode="' +
        m +
        '">' +
        (CHAT_UI_LABELS[m] || m) +
        "</button>"
    ).join("");
    partyHost().appendChild(picker);
    picker.addEventListener("click", (e) => {
      const b = e.target.closest("[data-ui-mode]");
      if (!b) return;
      applyChatUiMode(b.getAttribute("data-ui-mode"));
      picker.hidden = true;
      toast(CHAT_UI_LABELS[chatUiMode] || chatUiMode);
    });
    return picker;
  }

  function toggleModePicker(force) {
    const picker = ensureModePicker();
    const show = force === undefined ? picker.hidden : !!force;
    picker.hidden = !show;
    if (show) {
      const fab = document.getElementById("partyFab");
      if (fab) {
        const r = fab.getBoundingClientRect();
        picker.style.right = Math.max(8, window.innerWidth - r.right) + "px";
        picker.style.bottom = Math.max(8, window.innerHeight - r.top + 8) + "px";
      }
    }
  }

  function clearChatIdle() {
    clearTimeout(chatIdleTimer);
    chatIdleTimer = null;
  }

  function scheduleChatIdle() {
    clearChatIdle();
    if (!roomCode || chatCollapsed) return;
    const mode = partyLayoutMode();
    if (mode !== "hulu" && mode !== "rave") return;
    chatIdleTimer = setTimeout(() => {
      if (!roomCode || chatCollapsed) return;
      setChatCollapsed(true);
    }, CHAT_IDLE_MS);
  }

  function noteChatActivity(opts) {
    opts = opts || {};
    if (opts.expand) {
      if (chatCollapsed) setChatCollapsed(false);
      else openOverlay();
    }
    clearChatIdle();
    if (!chatCollapsed && roomCode) scheduleChatIdle();
    if (window.SDPartyAV && typeof SDPartyAV.onPartyLayoutChange === "function") {
      try {
        SDPartyAV.onPartyLayoutChange();
      } catch (e) {}
    }
  }

  function ensureLiveBadge() {
    const host = chatRoot();
    if (!host) return null;
    let badge = document.getElementById("partyLiveBadge");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "partyLiveBadge";
      badge.className = "party-live-badge";
      badge.innerHTML =
        '<span class="party-live-pill">LIVE</span>' +
        '<span class="party-live-count" id="partyLiveCount">👁 1</span>';
      host.appendChild(badge);
    }
    return badge;
  }

  function syncLiveBadge() {
    const badge = ensureLiveBadge();
    if (!badge) return;
    const show = !!roomCode;
    badge.classList.toggle("show", show);
    const countEl = document.getElementById("partyLiveCount");
    const n = Math.max(1, (lastMembers && lastMembers.length) || 1);
    if (countEl) countEl.textContent = "👁 " + n;
  }

  function setChatClasses(open, collapsed) {
    const drawer = document.getElementById("partyDrawer");
    const fullyOpen = !!open && !collapsed;
    // Edge-handle minimize only while drawer remains open (landscape). Fully hidden = FAB only.
    const handleMin =
      !!collapsed && !!roomCode && !!(drawer && drawer.classList.contains("open"));
    let layoutHint = fullyOpen || handleMin ? partyLayoutMode() : null;
    if (chatUiMode === "coherency" && roomCode) layoutHint = "rave";
    liveExpanded = chatUiMode === "coherency" ? false : loadLiveExpandedPref();
    const roots = layoutRoots();
    roots.forEach((el) => {
      el.classList.toggle("party-chat-open", fullyOpen || chatUiMode === "coherency");
      el.classList.toggle("party-chat-collapsed", !!collapsed && !!roomCode && chatUiMode !== "coherency");
      el.classList.toggle("party-chat-minimized", handleMin && chatUiMode === "sidebar");
      el.classList.toggle("party-layout-rave", layoutHint === "rave" && (fullyOpen || chatUiMode === "coherency"));
      el.classList.toggle("party-layout-hulu", layoutHint === "hulu" && (fullyOpen || handleMin) && chatUiMode === "sidebar");
      el.classList.toggle(
        "party-live-overlay",
        (layoutHint === "rave" && fullyOpen && !liveExpanded) || chatUiMode === "coherency"
      );
      el.classList.toggle(
        "party-live-expanded",
        layoutHint === "rave" && fullyOpen && liveExpanded && chatUiMode !== "coherency"
      );
      CHAT_UI_MODES.forEach((m) => el.classList.toggle("party-chat-mode-" + m, m === chatUiMode));
    });
    syncLiveBadge();
    updateFabChrome();
    scheduleLayoutPartyChrome();
    if (window.SDPartyAV && typeof SDPartyAV.onPartyLayoutChange === "function") {
      try {
        SDPartyAV.onPartyLayoutChange();
      } catch (e) {}
    }
  }

  function syncPartyLayout() {
    const drawer = document.getElementById("partyDrawer");
    if (!drawer) return;
    const open = drawer.classList.contains("open");
    const collapsed = drawer.classList.contains("collapsed") || chatCollapsed;
    setChatClasses(open && !collapsed, collapsed && !!roomCode);
    scheduleLayoutPartyChrome();
  }

  function syncable() {
    if (!guestFollowSync) return false;
    if (typeof v === "undefined" || !v) return false;
    if (catchupUrl && syncLiveMode === "catchup" && playingCatchupUrl(catchupUrl)) {
      return true;
    }
    if (roomFeatures.sync_vod !== false && typeof vodHlsActive !== "undefined" && vodHlsActive) {
      return true;
    }
    return false;
  }

  function playingCatchupUrl(url) {
    if (!url) return false;
    try {
      const needle = String(url).split("?")[0];
      const cur =
        (typeof currentStreamUrl !== "undefined" && currentStreamUrl) ||
        (v && (v.currentSrc || v.src)) ||
        "";
      if (!cur) return false;
      return String(cur).indexOf(needle) >= 0 || String(cur).indexOf("/catchup/") >= 0;
    } catch (e) {
      return false;
    }
  }

  function shouldBroadcastClock() {
    if (!isHost) return false;
    if (syncable()) return true;
    if (syncLiveMode === "lag" || syncLiveMode === "pdt") return true;
    return false;
  }

  function serverNowMs() {
    return Date.now() + (Number(clockOffsetMs) || 0);
  }

  function getLiveEdgeOffset() {
    try {
      if (typeof hls !== "undefined" && hls) {
        if (typeof hls.latency === "number" && isFinite(hls.latency)) return hls.latency;
        if (typeof hls.liveSyncPosition === "number" && isFinite(hls.liveSyncPosition) && v) {
          return Math.max(0, hls.liveSyncPosition - (v.currentTime || 0));
        }
      }
    } catch (e) {}
    return null;
  }

  function getProgramDateTimeMs() {
    try {
      if (typeof hls !== "undefined" && hls && hls.playingDate) {
        const d = hls.playingDate;
        if (d instanceof Date && !isNaN(d.getTime())) return d.getTime();
      }
      if (lastProgramDateTime != null) return Number(lastProgramDateTime);
    } catch (e) {}
    return null;
  }

  function refreshPdtState(streamUrl) {
    hasPdt = false;
    lastProgramDateTime = null;
    try {
      if (typeof hls !== "undefined" && hls) {
        if (hls.playingDate instanceof Date && !isNaN(hls.playingDate.getTime())) {
          hasPdt = true;
          lastProgramDateTime = hls.playingDate.getTime();
        }
        const levels = hls.levels || [];
        for (let i = 0; i < levels.length; i++) {
          const details = levels[i] && levels[i].details;
          if (details && details.hasProgramDateTime) {
            hasPdt = true;
            break;
          }
          const frags = (details && details.fragments) || [];
          for (let j = 0; j < Math.min(frags.length, 6); j++) {
            if (frags[j] && frags[j].programDateTime) {
              hasPdt = true;
              lastProgramDateTime = frags[j].programDateTime;
              break;
            }
          }
          if (hasPdt) break;
        }
      }
    } catch (e) {}
    if (hasPdt) return Promise.resolve(true);
    const url = streamUrl || (typeof currentStreamUrl !== "undefined" ? currentStreamUrl : "") || catchupUrl;
    if (!url) return Promise.resolve(false);
    return fetch(url, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.text() : ""))
      .then((text) => {
        if (text && /#EXT-X-PROGRAM-DATE-TIME:/i.test(text)) {
          hasPdt = true;
          const m = text.match(/#EXT-X-PROGRAM-DATE-TIME:([^\r\n]+)/i);
          if (m) {
            const t = Date.parse(m[1].trim());
            if (!isNaN(t)) lastProgramDateTime = t;
          }
        }
        return hasPdt;
      })
      .catch(() => false);
  }

  async function ensureCatchupPlayback(url) {
    url = String(url || "").trim();
    if (!url || applyingContent) return;
    if (playingCatchupUrl(url) && lastAttachedCatchup === url) return;
    applyingContent = true;
    lastAttachedCatchup = url;
    try {
      toast("Switching to party catchup stream");
      if (typeof attachHls === "function") {
        await attachHls(url);
      } else if (v) {
        v.src = url;
        try {
          await v.play();
        } catch (e) {}
      }
      setTimeout(() => refreshPdtState(url), 600);
    } finally {
      applyingContent = false;
    }
  }

  function isWatchingVod() {
    try {
      if (location.pathname.startsWith("/vod")) return true;
    } catch (e) {}
    if (typeof vodHlsActive !== "undefined" && vodHlsActive) return true;
    if (
      typeof trailerActive !== "undefined" &&
      trailerActive &&
      vodPickerCtx &&
      (vodPickerCtx.tmdbId || vodPickerCtx.tmdb_id)
    ) {
      return true;
    }
    return false;
  }

  function liveProgrammeTitle() {
    try {
      if (typeof headerMeta !== "undefined" && headerMeta) {
        const epg =
          typeof getCachedEntry === "function" && typeof epgCache !== "undefined"
            ? getCachedEntry(epgCache, String(headerMeta.channel_id || channelId || ""))
            : null;
        if (epg && epg.now && epg.now.title) return String(epg.now.title);
        if (headerMeta.name) return String(headerMeta.name);
      }
      if (typeof channelId !== "undefined" && channelId && typeof channelMap !== "undefined") {
        const ch = channelMap[channelId];
        if (ch && ch.name) return String(ch.name);
      }
    } catch (e) {}
    return typeof channelId !== "undefined" && channelId ? "Channel " + channelId : "Live TV";
  }

  function saveLastPlace(partial) {
    if (typeof window.SDSaveLastPlace === "function") {
      try {
        window.SDSaveLastPlace(partial);
        return;
      } catch (e) {}
    }
    try {
      const prev = JSON.parse(localStorage.getItem("sd_last_place") || "{}") || {};
      const next = Object.assign({}, prev, partial || {}, { ts: Date.now() });
      localStorage.setItem("sd_last_place", JSON.stringify(next));
    } catch (e) {}
  }

  function rememberPartyRecent(code, name, title) {
    try {
      const recent = JSON.parse(localStorage.getItem("sd_party_recent") || "[]");
      const entry = {
        code: String(code || "").toUpperCase(),
        name: name || "",
        title: title || "",
        ts: Date.now(),
      };
      const next = [entry].concat(recent.filter((x) => x && x.code !== entry.code)).slice(0, 12);
      localStorage.setItem("sd_party_recent", JSON.stringify(next));
    } catch (e) {}
  }

  function contentTitle() {
    const p = contentPayload();
    return String(p.title || "").trim() || "Watch Party";
  }

  function provisionalRoomName() {
    const title = contentTitle();
    const base = title + " · Room …";
    return base.length > NAME_MAX ? title.slice(0, Math.max(12, NAME_MAX - 12)).trim() + "… · Room …" : base;
  }

  function needsDrawerRebuild() {
    return !(
      document.getElementById("partyFab") &&
      document.getElementById("partyDrawerName") &&
      document.getElementById("partyModeSwitch") &&
      document.getElementById("partyGifBtn") &&
      document.getElementById("partyAvProviderHost") &&
      document.getElementById("partyLiveExpandBtn") &&
      document.getElementById("partyMoreBtn") &&
      document.getElementById("partySidebarTabs") &&
      document.getElementById("partyCallBlock") &&
      document.getElementById("partySidebarStyleRow") &&
      document.getElementById("partyDualTop") &&
      document.getElementById("partySyncFollow") &&
      document.getElementById("partySyncLiveMode")
    );
  }

  function drawerHtml() {
    return (
      '<div class="ph">' +
      '<button type="button" class="party-icon-btn" id="partyCollapseBtn" title="Collapse chat" aria-label="Collapse">▾</button>' +
      '<div class="party-title-wrap">' +
      '<span class="party-drawer-name" id="partyDrawerName">Party</span>' +
      '<span class="party-code-chip" id="partyDrawerCode"></span>' +
      '<span class="party-public-badge" id="partyPublicBadge" hidden>Public</span>' +
      "</div>" +
      '<button type="button" class="party-icon-btn" id="partyMoreBtn" title="Room &amp; chat settings" aria-label="More settings" aria-expanded="false">⋯</button>' +
      '<button type="button" class="party-icon-btn" id="partyLiveExpandBtn" title="Expand chat panel" aria-label="Expand chat panel">▣</button>' +
      '<button type="button" class="party-icon-btn" id="partyHideBtn" title="Hide chat" aria-label="Hide">✕</button>' +
      "</div>" +
      '<div class="party-sb-tabbar" id="partySidebarTabs" role="tablist" aria-label="Sidebar sections">' +
      '<button type="button" role="tab" data-sidebar-tab="chat" class="active">Chat</button>' +
      '<button type="button" role="tab" data-sidebar-tab="people">People</button>' +
      '<button type="button" role="tab" data-sidebar-tab="call">Call</button>' +
      '<button type="button" role="tab" data-sidebar-tab="room">Room</button>' +
      "</div>" +
      '<div class="party-dual-top" id="partyDualTop">' +
      '<button type="button" class="party-dual-toggle" id="partyDualCollapse" aria-expanded="true">' +
      '<span class="party-dual-toggle-label"><span class="party-dual-dot" aria-hidden="true"></span> Call &amp; room</span>' +
      '<span class="party-dual-chevron" aria-hidden="true">▴</span>' +
      "</button>" +
      "</div>" +
      '<div class="party-call-block" id="partyCallBlock">' +
      '<div class="party-mode-switch" id="partyModeSwitch" role="tablist" aria-label="Call mode">' +
      '<button type="button" data-mode="text" class="active">Text</button>' +
      '<button type="button" data-mode="voice">Voice</button>' +
      '<button type="button" data-mode="video">Video</button>' +
      '<button type="button" data-mode="hybrid">Hybrid</button>' +
      "</div>" +
      '<div class="party-av-provider-host" id="partyAvProviderHost"></div>' +
      '<div class="party-features-bar" id="partyFeaturesBar" hidden>' +
      '<label><input type="checkbox" data-feat="chat_text"/> Text</label>' +
      '<label><input type="checkbox" data-feat="chat_gif"/> GIF</label>' +
      '<label><input type="checkbox" data-feat="chat_voice_note"/> Voice note</label>' +
      '<label><input type="checkbox" data-feat="av_voice"/> AV voice</label>' +
      '<label><input type="checkbox" data-feat="av_video"/> AV video</label>' +
      '<label class="party-sync-feat"><input type="checkbox" data-feat="sync_vod"/> VOD sync</label>' +
      '<label class="party-sync-feat"><input type="checkbox" data-feat="sync_wait_buffering"/> Wait buffering</label>' +
      '<label class="party-sync-follow"><input type="checkbox" id="partySyncFollow"/> Follow sync</label>' +
      '<label class="party-sync-live" id="partySyncLiveWrap">Sync live ' +
      '<select id="partySyncLiveMode" aria-label="Live sync mode">' +
      '<option value="off">Off</option>' +
      '<option value="content">Content</option>' +
      '<option value="catchup">Catchup</option>' +
      '<option value="lag">Lag</option>' +
      '<option value="pdt">PDT</option>' +
      "</select></label>" +
      "</div>" +
      '<div class="party-host-bar" id="partyHostBar" hidden>' +
      '<input id="partyRenameInput" maxlength="64" placeholder="Room display name"/>' +
      '<button type="button" id="partyRenameBtn">Rename</button>' +
      '<label class="party-public-toggle"><input type="checkbox" id="partyPublicToggle"/> Public</label>' +
      "</div>" +
      "</div>" +
      '<div class="members" id="partyMembers"></div>' +
      '<div class="party-extras" id="partyExtras" hidden>' +
      '<div class="party-sidebar-style-row" id="partySidebarStyleRow">' +
      '<span class="party-sidebar-style-label">Sidebar layout</span>' +
      '<div class="party-sidebar-style-picker" role="group" aria-label="Sidebar layout">' +
      '<button type="button" data-sidebar-style="a" title="Chat first">Chat first</button>' +
      '<button type="button" data-sidebar-style="b" title="Tabs">Tabs</button>' +
      '<button type="button" data-sidebar-style="e" title="Dual pane">Dual pane</button>' +
      "</div>" +
      '<p class="party-sidebar-style-hint">Applies when chat mode is Sidebar</p>' +
      "</div>" +
      "</div>" +
      '<div class="chat" id="partyChat"></div>' +
      '<div class="party-reactions" id="partyReactions">' +
      REACTIONS.map((e) => '<button type="button" data-emoji="' + e + '">' + e + "</button>").join("") +
      "</div>" +
      '<div class="party-gif-picker" id="partyGifPicker">' +
      '<input id="partyGifQuery" placeholder="Search GIFs / paste URL" maxlength="200"/>' +
      '<div class="party-gif-grid" id="partyGifGrid"></div>' +
      "</div>" +
      '<div class="compose">' +
      '<div class="party-compose-tools">' +
      '<button type="button" class="party-icon-btn" id="partyGifBtn" title="GIF">GIF</button>' +
      '<button type="button" class="party-icon-btn" id="partyVoiceBtn" title="Voice note">🎤</button>' +
      "</div>" +
      '<input id="partyChatInput" placeholder="Say something…" maxlength="280"/>' +
      '<button type="button" id="partyChatSend">Send</button></div>' +
      '<p class="party-tabs-hint" id="partyTabsHint">Call and Room tabs include call providers and additional features.</p>'
    );
  }

  function partyModalHtml() {
    return (
      "<h3>Watch party</h3>" +
      '<label class="party-field-label" for="sdPartyRoomName">Room name</label>' +
      '<input id="sdPartyRoomName" maxlength="64" placeholder="Title · Room …" style="width:100%;box-sizing:border-box"/>' +
      '<label class="party-public-check"><input type="checkbox" id="sdPartyPublic"/> Public room (anyone on the household PIN can browse &amp; join)</label>' +
      '<input id="sdPartyPassword" type="password" placeholder="Password (optional)" autocomplete="off" style="width:100%;margin-top:8px;box-sizing:border-box"/>' +
      '<div class="row"><button type="button" class="primary" id="sdPartyCreate">Create room</button>' +
      '<button type="button" id="sdPartyJoinBtn">Join with code</button></div>' +
      '<input id="sdPartyJoinCode" placeholder="ABCDE" maxlength="5" style="width:100%;margin-top:8px;text-transform:uppercase"/>' +
      '<div class="party-public-section">' +
      '<div class="party-public-head"><span>Public rooms</span>' +
      '<button type="button" id="sdPartyRefreshPublic">Refresh</button></div>' +
      '<div id="sdPartyPublicList" class="party-public-list"><p class="party-muted">Loading…</p></div></div>' +
      '<div id="sdPartyCreated" hidden>' +
      '<div class="party-created-name" id="sdPartyDisplayName"></div>' +
      '<div class="code" id="sdPartyCode"></div>' +
      '<div class="qr-wrap" id="sdPartyQr"></div>' +
      '<input id="sdPartyJoinUrl" readonly style="width:100%;box-sizing:border-box"/>' +
      '<div class="row"><button type="button" class="primary" id="sdPartyCopy">Copy invite</button>' +
      '<button type="button" id="sdPartyForceSync">Force sync</button>' +
      '<button type="button" id="sdPartyLeave">Leave</button></div></div>' +
      '<div class="row"><button type="button" id="sdPartyClose">Close</button></div>'
    );
  }

  function ensureUi() {
    if (!document.getElementById("sdShareModal")) {
      const bd = document.createElement("div");
      bd.className = "sd-modal-backdrop";
      bd.id = "sdShareBackdrop";
      const modal = document.createElement("div");
      modal.className = "sd-modal";
      modal.id = "sdShareModal";
      modal.innerHTML =
        '<h3 id="sdShareTitle">Share</h3>' +
        '<p id="sdShareHint" style="margin:0;color:#9aa;font-size:13px"></p>' +
        '<div class="qr-wrap" id="sdShareQr"></div>' +
        '<div class="code" id="sdShareCode" hidden></div>' +
        '<input id="sdShareUrl" readonly style="width:100%;box-sizing:border-box"/>' +
        '<div class="row">' +
        '<button type="button" class="primary" id="sdShareCopy">Copy link</button>' +
        '<button type="button" id="sdShareRemote">Phone remote</button>' +
        '<button type="button" id="sdShareClose">Close</button></div>';
      document.body.appendChild(bd);
      document.body.appendChild(modal);
    }

    let pmodal = document.getElementById("sdPartyModal");
    if (!pmodal) {
      const pbd = document.createElement("div");
      pbd.className = "sd-modal-backdrop";
      pbd.id = "sdPartyBackdrop";
      pmodal = document.createElement("div");
      pmodal.className = "sd-modal sd-modal-party";
      pmodal.id = "sdPartyModal";
      pmodal.innerHTML = partyModalHtml();
      document.body.appendChild(pbd);
      document.body.appendChild(pmodal);
    } else if (!document.getElementById("sdPartyRoomName")) {
      pmodal.innerHTML = partyModalHtml();
      uiWired = false;
    }

    const host = chatRoot();
    adoptPartyChrome(host);
    let drawer = document.getElementById("partyDrawer");
    let fab = document.getElementById("partyFab");
    if (!drawer || needsDrawerRebuild()) {
      if (drawer) drawer.remove();
      const oldReact = document.getElementById("partyReactions");
      if (oldReact && !oldReact.closest("#partyDrawer")) oldReact.remove();
      drawer = document.createElement("div");
      drawer.className = "party-drawer";
      drawer.id = "partyDrawer";
      drawer.innerHTML = drawerHtml();
      host.appendChild(drawer);
      uiWired = false;
    } else if (drawer.parentNode !== host) {
      host.appendChild(drawer);
    }
    if (!fab) {
      fab = document.createElement("button");
      fab.type = "button";
      fab.className = "party-fab";
      fab.id = "partyFab";
      fab.title = "Open party chat";
      fab.setAttribute("aria-label", "Open party chat");
      fab.innerHTML = '💬<span class="party-fab-badge" hidden></span>';
      host.appendChild(fab);
      uiWired = false;
    } else if (fab.parentNode !== host) {
      host.appendChild(fab);
    }
    ensureRisingHost();
    updateFabChrome();
    applySidebarStyle(null, { keepTab: true });
    if (!document.getElementById("partyToast")) {
      const toast = document.createElement("div");
      toast.className = "party-toast";
      toast.id = "partyToast";
      host.appendChild(toast);
    } else {
      const toast = document.getElementById("partyToast");
      if (toast && toast.parentNode !== host) host.appendChild(toast);
    }
    ensureLiveBadge();
    adoptPartyChrome(host);
    wireLayoutPartyChrome();
    scheduleLayoutPartyChrome();

    if (!uiWired) {
      wireUi();
      uiWired = true;
    }
  }

  function wireUi() {
    const bd = document.getElementById("sdShareBackdrop");
    if (bd && !bd.dataset.wired) {
      bd.dataset.wired = "1";
      bd.addEventListener("click", closeShare);
    }
    const shareClose = document.getElementById("sdShareClose");
    if (shareClose && !shareClose.dataset.wired) {
      shareClose.dataset.wired = "1";
      shareClose.addEventListener("click", closeShare);
    }
    const shareCopy = document.getElementById("sdShareCopy");
    if (shareCopy && !shareCopy.dataset.wired) {
      shareCopy.dataset.wired = "1";
      shareCopy.addEventListener("click", () => {
        const inp = document.getElementById("sdShareUrl");
        if (inp) {
          inp.select();
          navigator.clipboard && navigator.clipboard.writeText(inp.value).catch(() => {});
        }
      });
    }
    const shareRemote = document.getElementById("sdShareRemote");
    if (shareRemote && !shareRemote.dataset.wired) {
      shareRemote.dataset.wired = "1";
      shareRemote.addEventListener("click", createRemoteQr);
    }

    const pbd = document.getElementById("sdPartyBackdrop");
    if (pbd && !pbd.dataset.wired) {
      pbd.dataset.wired = "1";
      pbd.addEventListener("click", closePartyModal);
    }
    const closeBtn = document.getElementById("sdPartyClose");
    if (closeBtn && !closeBtn.dataset.wired) {
      closeBtn.dataset.wired = "1";
      closeBtn.addEventListener("click", closePartyModal);
    }
    const createBtn = document.getElementById("sdPartyCreate");
    if (createBtn && !createBtn.dataset.wired) {
      createBtn.dataset.wired = "1";
      createBtn.addEventListener("click", () => createParty());
    }
    const joinBtn = document.getElementById("sdPartyJoinBtn");
    if (joinBtn && !joinBtn.dataset.wired) {
      joinBtn.dataset.wired = "1";
      joinBtn.addEventListener("click", () => {
        const code = (document.getElementById("sdPartyJoinCode").value || "").trim().toUpperCase();
        if (code) joinParty(code);
      });
    }
    const copyBtn = document.getElementById("sdPartyCopy");
    if (copyBtn && !copyBtn.dataset.wired) {
      copyBtn.dataset.wired = "1";
      copyBtn.addEventListener("click", () => {
        const inp = document.getElementById("sdPartyJoinUrl");
        if (inp && navigator.clipboard) navigator.clipboard.writeText(inp.value).catch(() => {});
      });
    }
    const forceBtn = document.getElementById("sdPartyForceSync");
    if (forceBtn && !forceBtn.dataset.wired) {
      forceBtn.dataset.wired = "1";
      forceBtn.addEventListener("click", forceSync);
    }
    const leaveBtn = document.getElementById("sdPartyLeave");
    if (leaveBtn && !leaveBtn.dataset.wired) {
      leaveBtn.dataset.wired = "1";
      leaveBtn.addEventListener("click", leaveParty);
    }
    const refreshPublic = document.getElementById("sdPartyRefreshPublic");
    if (refreshPublic && !refreshPublic.dataset.wired) {
      refreshPublic.dataset.wired = "1";
      refreshPublic.addEventListener("click", loadPublicRooms);
    }
    const publicList = document.getElementById("sdPartyPublicList");
    if (publicList && !publicList.dataset.wired) {
      publicList.dataset.wired = "1";
      publicList.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-join-code]");
        if (!btn) return;
        const code = btn.getAttribute("data-join-code");
        if (code) joinParty(code);
      });
    }

    const send = document.getElementById("partyChatSend");
    const input = document.getElementById("partyChatInput");
    if (send && !send.dataset.wired) {
      send.dataset.wired = "1";
      send.addEventListener("click", () => {
        noteChatActivity({ expand: true });
        sendChat(input && input.value);
        if (input) input.value = "";
      });
    }
    if (input && !input.dataset.wired) {
      input.dataset.wired = "1";
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          noteChatActivity({ expand: true });
          sendChat(input.value);
          input.value = "";
        }
      });
      input.addEventListener("focus", () => noteChatActivity({ expand: true }));
      input.addEventListener("input", () => noteChatActivity());
    }
    const gifBtn = document.getElementById("partyGifBtn");
    if (gifBtn && !gifBtn.dataset.wired) {
      gifBtn.dataset.wired = "1";
      gifBtn.addEventListener("click", () => {
        noteChatActivity({ expand: true });
        toggleGifPicker();
      });
    }
    const voiceBtn = document.getElementById("partyVoiceBtn");
    if (voiceBtn && !voiceBtn.dataset.wired) {
      voiceBtn.dataset.wired = "1";
      voiceBtn.addEventListener("click", () => {
        noteChatActivity({ expand: true });
        toggleVoiceNote();
      });
    }
    const gifQuery = document.getElementById("partyGifQuery");
    if (gifQuery && !gifQuery.dataset.wired) {
      gifQuery.dataset.wired = "1";
      let gifTimer = null;
      gifQuery.addEventListener("input", () => {
        clearTimeout(gifTimer);
        gifTimer = setTimeout(() => searchGifs(gifQuery.value), 280);
      });
      gifQuery.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const val = (gifQuery.value || "").trim();
          if (/^https?:\/\//i.test(val)) {
            sendGif(val);
            gifQuery.value = "";
            toggleGifPicker(false);
          } else searchGifs(val);
        }
      });
    }
    const gifGrid = document.getElementById("partyGifGrid");
    if (gifGrid && !gifGrid.dataset.wired) {
      gifGrid.dataset.wired = "1";
      gifGrid.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-gif-url]");
        if (!b) return;
        noteChatActivity({ expand: true });
        sendGif(b.getAttribute("data-gif-url"));
        toggleGifPicker(false);
      });
    }
    const modeSwitch = document.getElementById("partyModeSwitch");
    if (modeSwitch && !modeSwitch.dataset.wired) {
      modeSwitch.dataset.wired = "1";
      modeSwitch.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-mode]");
        if (!b || b.disabled) return;
        noteChatActivity({ expand: true });
        setChatMode(b.getAttribute("data-mode"));
      });
    }
    const avHost = document.getElementById("partyAvProviderHost");
    if (avHost && window.SDPartyAV && SDPartyAV.injectProviderSelect) {
      SDPartyAV.injectProviderSelect(avHost);
    }
    const featBar = document.getElementById("partyFeaturesBar");
    if (featBar && !featBar.dataset.wired) {
      featBar.dataset.wired = "1";
      featBar.addEventListener("change", (e) => {
        const follow = e.target.closest("#partySyncFollow");
        if (follow) {
          saveGuestFollowSync(!!follow.checked);
          toast(guestFollowSync ? "Following host sync" : "Sync follow off");
          return;
        }
        const liveSel = e.target.closest("#partySyncLiveMode");
        if (liveSel) {
          sendSetSyncLive(liveSel.value);
          return;
        }
        const inp = e.target.closest("input[data-feat]");
        if (!inp || !isAdmin) return;
        const patch = {};
        patch[inp.getAttribute("data-feat")] = !!inp.checked;
        sendSetFeatures(patch);
      });
    }
    const reactsEl = document.getElementById("partyReactions");
    if (reactsEl && !reactsEl.dataset.wired) {
      reactsEl.dataset.wired = "1";
      reactsEl.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-emoji]");
        if (b) {
          noteChatActivity({ expand: true });
          sendReaction(b.dataset.emoji);
        }
      });
    }
    const membersEl = document.getElementById("partyMembers");
    if (membersEl && !membersEl.dataset.wired) {
      membersEl.dataset.wired = "1";
      membersEl.addEventListener("click", (e) => {
        const kick = e.target.closest("[data-kick]");
        if (kick && isHost) kickMember(kick.getAttribute("data-kick"));
        const adminBtn = e.target.closest("[data-admin]");
        if (adminBtn && isHost) {
          const id = adminBtn.getAttribute("data-admin");
          const grant = adminBtn.getAttribute("data-grant") === "1";
          if (grant) sendGrantAdmin(id);
          else sendRevokeAdmin(id);
        }
      });
    }
    const collapseBtn = document.getElementById("partyCollapseBtn");
    if (collapseBtn && !collapseBtn.dataset.wired) {
      collapseBtn.dataset.wired = "1";
      collapseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setChatCollapsed(!chatCollapsed);
      });
    }
    const expandBtn = document.getElementById("partyLiveExpandBtn");
    if (expandBtn && !expandBtn.dataset.wired) {
      expandBtn.dataset.wired = "1";
      expandBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        liveExpanded = !liveExpanded;
        saveLiveExpandedPref(liveExpanded);
        expandBtn.title = liveExpanded ? "Overlay chat (FB Live)" : "Expand chat panel";
        expandBtn.textContent = liveExpanded ? "▦" : "▣";
        noteChatActivity({ expand: true });
        syncPartyLayout();
      });
    }
    const hideBtn = document.getElementById("partyHideBtn");
    if (hideBtn && !hideBtn.dataset.wired) {
      hideBtn.dataset.wired = "1";
      hideBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        clearChatIdle();
        chatCollapsed = true;
        saveChatMinPref(true);
        const d = document.getElementById("partyDrawer");
        if (d) {
          d.classList.add("collapsed");
          d.classList.remove("open");
        }
        setChatClasses(false, false);
        document.getElementById("partyFab")?.classList.add("show");
      });
    }
    const moreBtn = document.getElementById("partyMoreBtn");
    if (moreBtn && !moreBtn.dataset.wired) {
      moreBtn.dataset.wired = "1";
      moreBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const extras = document.getElementById("partyExtras");
        const drawer = document.getElementById("partyDrawer");
        if (!extras) return;
        const open = extras.hasAttribute("hidden");
        if (open) extras.removeAttribute("hidden");
        else extras.setAttribute("hidden", "");
        moreBtn.setAttribute("aria-expanded", open ? "true" : "false");
        if (drawer) drawer.classList.toggle("extras-open", open);
        noteChatActivity();
      });
    }
    const sidebarTabs = document.getElementById("partySidebarTabs");
    if (sidebarTabs && !sidebarTabs.dataset.wired) {
      sidebarTabs.dataset.wired = "1";
      sidebarTabs.addEventListener("click", (e) => {
        const b = e.target.closest("[data-sidebar-tab]");
        if (!b) return;
        sidebarTab = b.getAttribute("data-sidebar-tab") || "chat";
        applySidebarStyle(null, { keepTab: true });
        noteChatActivity();
      });
    }
    const styleRow = document.getElementById("partySidebarStyleRow");
    if (styleRow && !styleRow.dataset.wired) {
      styleRow.dataset.wired = "1";
      styleRow.addEventListener("click", (e) => {
        const b = e.target.closest("[data-sidebar-style]");
        if (!b) return;
        const next = b.getAttribute("data-sidebar-style");
        applySidebarStyle(next);
        toast("Sidebar: " + (SIDEBAR_STYLE_LABELS[sidebarStyle] || sidebarStyle));
        noteChatActivity();
      });
    }
    const dualCollapse = document.getElementById("partyDualCollapse");
    if (dualCollapse && !dualCollapse.dataset.wired) {
      dualCollapse.dataset.wired = "1";
      dualCollapse.addEventListener("click", (e) => {
        e.stopPropagation();
        dualCollapsed = !dualCollapsed;
        applySidebarStyle(null, { keepTab: true });
        noteChatActivity();
      });
    }
    const drawer = document.getElementById("partyDrawer");
    if (drawer && !drawer.dataset.minTapWired) {
      drawer.dataset.minTapWired = "1";
      drawer.addEventListener("click", (e) => {
        if (!chatCollapsed) return;
        if (e.target.closest("#partyCollapseBtn") || e.target.closest("#partyHideBtn")) return;
        setChatCollapsed(false);
      });
    }
    const fab = document.getElementById("partyFab");
    if (fab && !fab.dataset.wired) {
      fab.dataset.wired = "1";
      const onFabActivate = () => {
        if (fabIgnoreClick) {
          fabIgnoreClick = false;
          return;
        }
        const now = Date.now();
        const dbl = now - fabLastTapAt < 420;
        fabLastTapAt = now;
        if (dbl && chatUiMode === "cinema") {
          applyChatUiMode(chatUiModeBeforeCinema || "sidebar");
          toast(CHAT_UI_LABELS[chatUiMode] || chatUiMode);
          return;
        }
        if (dbl && chatUiMode === "peek") {
          peekComposeOpen = true;
          applyChatUiMode("coherency");
          toast("Compose");
          return;
        }
        cycleChatUiMode();
      };
      fab.addEventListener("click", onFabActivate);
      fab.addEventListener("pointerdown", (e) => {
        if (e.button != null && e.button !== 0) return;
        clearTimeout(fabLongPressTimer);
        fabLongPressTimer = setTimeout(() => {
          fabIgnoreClick = true;
          toggleModePicker(true);
        }, 520);
      });
      const clearLp = () => clearTimeout(fabLongPressTimer);
      fab.addEventListener("pointerup", clearLp);
      fab.addEventListener("pointerleave", clearLp);
      fab.addEventListener("pointercancel", clearLp);
    }
    const renameBtn = document.getElementById("partyRenameBtn");
    if (renameBtn && !renameBtn.dataset.wired) {
      renameBtn.dataset.wired = "1";
      renameBtn.addEventListener("click", sendRename);
    }
    const publicToggle = document.getElementById("partyPublicToggle");
    if (publicToggle && !publicToggle.dataset.wired) {
      publicToggle.dataset.wired = "1";
      publicToggle.addEventListener("change", () => sendSetPublic(!!publicToggle.checked));
    }
  }

  function setChatCollapsed(collapsed) {
    chatCollapsed = !!collapsed;
    saveChatMinPref(chatCollapsed);
    const drawer = document.getElementById("partyDrawer");
    const layout = partyLayoutMode();
    if (drawer) {
      drawer.classList.toggle("collapsed", chatCollapsed);
      if (chatCollapsed && layout === "hulu" && roomCode) {
        // Landscape: thin right-edge handle
        drawer.classList.add("open");
      } else if (chatCollapsed) {
        // Portrait / desktop: FAB-only
        drawer.classList.remove("open");
      }
    }
    const btn = document.getElementById("partyCollapseBtn");
    if (btn) {
      btn.textContent = chatCollapsed ? (layout === "hulu" ? "‹" : "▴") : "▾";
      btn.title = chatCollapsed ? "Expand chat" : "Collapse chat";
    }
    const open = !!(drawer && drawer.classList.contains("open"));
    setChatClasses(open && !chatCollapsed, chatCollapsed);
    const fab = document.getElementById("partyFab");
    if (fab) fab.classList.toggle("show", !!roomCode && (!open || chatCollapsed || chatUiMode !== "sidebar"));
    updateFabChrome();
    if (chatCollapsed) clearChatIdle();
    else scheduleChatIdle();
  }

  function qrImg(payload) {
    const abs = payload.startsWith("http") ? payload : location.origin + payload;
    return (
      '<img alt="QR" src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' +
      encodeURIComponent(abs) +
      '"/>'
    );
  }

  function openShare(opts) {
    ensureUi();
    opts = opts || {};
    const d = opts.detail || vodCatalogDetail || vodPickerCtx || {};
    let path = "";
    if (d.tmdb_id || d.tmdbId) {
      const mt = (d.type || d.mediaType || "movie") === "tv" ? "tv" : "movie";
      const id = d.tmdb_id || d.tmdbId;
      path = "/vod/" + mt + "/" + id;
      const s = d.season || (vodPickerCtx && vodPickerCtx.season);
      const e = d.episode || (vodPickerCtx && vodPickerCtx.episode);
      if (mt === "tv" && s) {
        path += "?season=" + encodeURIComponent(s);
        if (e) path += "&episode=" + encodeURIComponent(e);
      }
    } else if (typeof channelId !== "undefined" && channelId) {
      path = "/tv/" + channelId;
    } else {
      path = location.pathname + location.search;
    }
    const abs = location.origin + path;
    document.getElementById("sdShareTitle").textContent = "Share";
    document.getElementById("sdShareHint").textContent = d.title || d.name || path;
    document.getElementById("sdShareCode").hidden = true;
    document.getElementById("sdShareUrl").value = abs;
    document.getElementById("sdShareQr").innerHTML = qrImg(abs);
    document.getElementById("sdShareBackdrop").classList.add("open");
    document.getElementById("sdShareModal").classList.add("open");
  }

  function closeShare() {
    document.getElementById("sdShareBackdrop")?.classList.remove("open");
    document.getElementById("sdShareModal")?.classList.remove("open");
  }

  async function createRemoteQr() {
    try {
      const r = await authFetch("/party/remote-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel_id: typeof channelId !== "undefined" ? channelId : "",
          room_code: roomCode || "",
        }),
      });
      const data = await r.json();
      if (!data.ok && !data.token) throw new Error("token");
      const url = location.origin + "/remote?token=" + encodeURIComponent(data.token);
      document.getElementById("sdShareTitle").textContent = "Phone remote";
      document.getElementById("sdShareHint").textContent = "Scan to control this player";
      document.getElementById("sdShareUrl").value = url;
      document.getElementById("sdShareQr").innerHTML = qrImg(url);
      ensureRemoteListener();
      if (!roomCode) await createParty({ quiet: true });
    } catch (e) {
      if (typeof showErr === "function") showErr("Could not create remote link");
    }
  }

  function openPanel() {
    ensureUi();
    const nameEl = document.getElementById("sdPartyRoomName");
    if (nameEl && !roomCode) nameEl.value = provisionalRoomName();
    document.getElementById("sdPartyBackdrop").classList.add("open");
    document.getElementById("sdPartyModal").classList.add("open");
    if (roomCode) showPartyCreated(roomCode, { name: roomName });
    else loadPublicRooms();
  }
  function closePartyModal() {
    document.getElementById("sdPartyBackdrop")?.classList.remove("open");
    document.getElementById("sdPartyModal")?.classList.remove("open");
  }

  function contentPayload(extra) {
    extra = extra || {};
    const onVod = isWatchingVod();
    if (!onVod && !extra.tmdbId && !extra.tmdb_id) {
      const ch = typeof channelId !== "undefined" ? channelId : null;
      return {
        tmdbId: null,
        mediaType: "live",
        title: extra.title || liveProgrammeTitle(),
        posterPath: null,
        season: null,
        episode: null,
        channelId: ch,
        hls: !!(catchupUrl && syncLiveMode === "catchup"),
      };
    }
    const ctx = Object.assign({}, vodPickerCtx || {}, extra);
    const detail = typeof vodCatalogDetail !== "undefined" ? vodCatalogDetail : null;
    return {
      tmdbId: ctx.tmdbId || ctx.tmdb_id || (detail && detail.tmdb_id) || null,
      mediaType: ctx.mediaType || ctx.type || (detail && detail.type) || "movie",
      title: ctx.title || (detail && detail.title) || "",
      posterPath: (detail && (detail.poster_url || detail.poster_path)) || ctx.posterPath || null,
      season: ctx.season || null,
      episode: ctx.episode || null,
      channelId: null,
      hls: !!syncable(),
    };
  }

  function readPassword() {
    const el = document.getElementById("sdPartyPassword");
    return ((el && el.value) || "").trim();
  }

  function readCreateName() {
    const el = document.getElementById("sdPartyRoomName");
    const v = ((el && el.value) || "").trim();
    return v || provisionalRoomName();
  }

  function readCreatePublic() {
    const el = document.getElementById("sdPartyPublic");
    return !!(el && el.checked);
  }

  async function loadPublicRooms() {
    const list = document.getElementById("sdPartyPublicList");
    if (!list) return;
    list.innerHTML = '<p class="party-muted">Loading…</p>';
    try {
      const r = await authFetch("/party/public");
      const data = await r.json();
      const rooms = (data && data.rooms) || [];
      if (!rooms.length) {
        list.innerHTML = '<p class="party-muted">No public rooms right now.</p>';
        return;
      }
      list.innerHTML = rooms
        .map((room) => {
          const title = escapeHtml(room.name || room.title || room.code || "Party");
          const meta =
            escapeHtml(String(room.memberCount || 0)) +
            " watching" +
            (room.locked ? " · 🔒" : "") +
            (room.title ? " · " + escapeHtml(room.title) : "");
          return (
            '<div class="party-public-card">' +
            '<div class="party-public-meta"><strong>' +
            title +
            "</strong><span>" +
            meta +
            '</span></div>' +
            '<button type="button" class="primary" data-join-code="' +
            escapeHtml(room.code) +
            '">Join</button></div>'
          );
        })
        .join("");
    } catch (e) {
      list.innerHTML = '<p class="party-muted">Could not load public rooms.</p>';
    }
  }

  async function createParty(opts) {
    opts = opts || {};
    ensureUi();
    try {
      const body = { content: contentPayload(opts.content) };
      const pwd = opts.password != null ? opts.password : readPassword();
      const name = opts.name != null ? opts.name : readCreateName();
      const isPublic = opts.public != null ? !!opts.public : readCreatePublic();
      if (pwd) body.password = pwd;
      if (name) body.name = name;
      body.public = isPublic;
      const r = await authFetch("/party/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!data.code) throw new Error("create");
      hostKey = data.hostKey || "";
      storeHostKey(data.code, hostKey);
      roomName = data.name || name || "";
      roomPublic = !!data.public;
      roomNumber = data.roomNumber || 0;
      await connectWs("join", data.code, { password: pwd, hostKey });
      isHost = true;
      rememberPartyRecent(data.code, roomName, contentTitle());
      saveLastPlace({
        path: location.pathname + location.search,
        partyCode: data.code,
        channelId: typeof channelId !== "undefined" ? channelId : null,
        title: contentTitle(),
      });
      if (!opts.quiet) {
        showPartyCreated(data.code, { name: roomName, room: data.room });
        openOverlay();
        toast((roomName || "Party") + " — invite ready");
      } else {
        showPartyCreated(data.code, { name: roomName, room: data.room });
      }
    } catch (e) {
      if (typeof showErr === "function") showErr("Party create failed");
    }
  }

  function applyRoomMeta(room) {
    if (!room) return;
    if (room.code) roomCode = room.code;
    if (room.name) roomName = room.name;
    if (typeof room.public === "boolean") roomPublic = room.public;
    if (room.roomNumber != null) roomNumber = room.roomNumber;
    if (room.features && typeof room.features === "object") {
      roomFeatures = Object.assign({}, DEFAULT_FEATURES, room.features);
    }
    if (Array.isArray(room.admins)) roomAdmins = room.admins.slice();
    if (room.hostId) {
      isHost = room.hostId === memberId;
    }
    isAdmin = isHost || (memberId && roomAdmins.indexOf(memberId) >= 0);
    const prevCatchup = catchupUrl;
    if (room.syncLiveMode != null) {
      const mode = String(room.syncLiveMode || "content").toLowerCase();
      syncLiveMode = SYNC_LIVE_MODES.indexOf(mode) >= 0 ? mode : "content";
    }
    if ("catchupUrl" in room) catchupUrl = room.catchupUrl || null;
    if ("waitForBuffering" in room) waitForBuffering = !!room.waitForBuffering;
    else waitForBuffering = !!roomFeatures.sync_wait_buffering;
    const nameEl = document.getElementById("partyDrawerName");
    if (nameEl) nameEl.textContent = roomName || "Party";
    const codeEl = document.getElementById("partyDrawerCode");
    if (codeEl) codeEl.textContent = roomCode || "";
    const badge = document.getElementById("partyPublicBadge");
    if (badge) badge.hidden = !roomPublic;
    const display = document.getElementById("sdPartyDisplayName");
    if (display) display.textContent = roomName || "";
    const hostBar = document.getElementById("partyHostBar");
    if (hostBar) hostBar.hidden = !isHost;
    const renameInput = document.getElementById("partyRenameInput");
    if (renameInput && document.activeElement !== renameInput) renameInput.value = roomName || "";
    const publicToggle = document.getElementById("partyPublicToggle");
    if (publicToggle) publicToggle.checked = !!roomPublic;
    const syncBtn = document.getElementById("sdPartyForceSync");
    if (syncBtn) syncBtn.style.display = isHost ? "" : "none";
    syncFeaturesUi();
    syncModeUi();
    if (catchupUrl && syncLiveMode === "catchup") {
      ensureCatchupPlayback(catchupUrl);
    } else if (!catchupUrl && prevCatchup) {
      lastAttachedCatchup = null;
    }
  }

  function syncFeaturesUi() {
    const bar = document.getElementById("partyFeaturesBar");
    if (!bar) return;
    bar.hidden = false;
    bar.classList.add("show");
    bar.querySelectorAll("input[data-feat]").forEach((inp) => {
      const key = inp.getAttribute("data-feat");
      inp.checked = !!roomFeatures[key];
      if (key) inp.disabled = !isAdmin;
    });
    // Chat/AV/sync feature labels: admin-only; follow sync is for everyone.
    bar.querySelectorAll("label").forEach((lab) => {
      if (lab.classList.contains("party-sync-follow")) {
        lab.style.display = "";
        return;
      }
      if (lab.classList.contains("party-sync-live")) {
        lab.style.display = isAdmin ? "" : "none";
        return;
      }
      const feat = lab.querySelector("input[data-feat]");
      if (feat) lab.style.display = isAdmin ? "" : "none";
    });
    if (!isAdmin) {
      const followLab = bar.querySelector(".party-sync-follow");
      if (followLab) followLab.style.display = "";
    }
    const follow = document.getElementById("partySyncFollow");
    if (follow) {
      follow.checked = !!guestFollowSync;
      follow.disabled = false;
    }
    const liveWrap = document.getElementById("partySyncLiveWrap");
    const liveSel = document.getElementById("partySyncLiveMode");
    if (liveWrap) liveWrap.style.display = isAdmin ? "" : "none";
    if (liveSel) {
      liveSel.value = SYNC_LIVE_MODES.indexOf(syncLiveMode) >= 0 ? syncLiveMode : "content";
      liveSel.disabled = !isAdmin;
    }
    // Keep bar visible when anyone is in a party (follow sync); collapse if not in room
    if (!roomCode) {
      bar.hidden = true;
      bar.classList.remove("show");
    } else if (!isAdmin) {
      // Slim guest bar: only follow sync
      bar.hidden = false;
    }
    const gifBtn = document.getElementById("partyGifBtn");
    const voiceBtn = document.getElementById("partyVoiceBtn");
    const input = document.getElementById("partyChatInput");
    const send = document.getElementById("partyChatSend");
    if (gifBtn) gifBtn.disabled = !roomFeatures.chat_gif;
    if (voiceBtn) voiceBtn.disabled = !roomFeatures.chat_voice_note;
    if (input) {
      input.disabled = !roomFeatures.chat_text;
      input.placeholder = roomFeatures.chat_text ? "Say something…" : "Text chat disabled";
    }
    if (send) send.disabled = !roomFeatures.chat_text;
    const modeSwitch = document.getElementById("partyModeSwitch");
    if (modeSwitch) {
      modeSwitch.querySelectorAll("button[data-mode]").forEach((b) => {
        const mode = b.getAttribute("data-mode");
        if (mode === "text") b.disabled = false;
        else if (mode === "voice") b.disabled = !roomFeatures.av_voice;
        else if (mode === "video") b.disabled = !roomFeatures.av_video;
        else if (mode === "hybrid") b.disabled = !(roomFeatures.av_voice || roomFeatures.av_video);
      });
    }
    if (chatMode === "voice" && !roomFeatures.av_voice) setChatMode("text");
    else if (chatMode === "video" && !roomFeatures.av_video) setChatMode("text");
    else if (chatMode === "hybrid" && !(roomFeatures.av_voice || roomFeatures.av_video)) setChatMode("text");
  }

  function syncModeUi() {
    const modeSwitch = document.getElementById("partyModeSwitch");
    if (modeSwitch) {
      modeSwitch.querySelectorAll("button[data-mode]").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-mode") === chatMode);
      });
    }
    // Built-in / Jitsi always use floating overlay — never full-bleed party-av-full.
    const layerEl = layer();
    if (layerEl) layerEl.classList.remove("party-av-full");
  }

  function partySend(msg) {
    if (!ws || ws.readyState !== 1) return;
    try {
      ws.send(JSON.stringify(msg));
    } catch (e) {}
  }

  function stopAv() {
    if (window.SDPartyAV && SDPartyAV.stop) SDPartyAV.stop();
  }

  function startAv(mode) {
    if (!roomCode || !window.SDPartyAV) return;
    SDPartyAV.start({
      mode: mode,
      roomCode: roomCode,
      memberId: memberId,
      displayName: partyName(),
      send: partySend,
    });
  }

  function setChatMode(mode) {
    mode = String(mode || "text").toLowerCase();
    if (mode === "voice" && !roomFeatures.av_voice) {
      toast("Voice chat disabled by host");
      return;
    }
    if (mode === "video" && !roomFeatures.av_video) {
      toast("Video chat disabled by host");
      return;
    }
    if (mode === "hybrid" && !(roomFeatures.av_voice || roomFeatures.av_video)) {
      toast("AV chat disabled by host");
      return;
    }
    chatMode = mode;
    syncModeUi();
    if (mode === "text") stopAv();
    else startAv(mode);
  }

  function toggleGifPicker(force) {
    const picker = document.getElementById("partyGifPicker");
    if (!picker) return;
    if (!roomFeatures.chat_gif) {
      toast("GIFs disabled by host");
      picker.classList.remove("open");
      return;
    }
    const open = force == null ? !picker.classList.contains("open") : !!force;
    picker.classList.toggle("open", open);
    if (open) searchGifs((document.getElementById("partyGifQuery") || {}).value || "party");
  }

  async function searchGifs(q) {
    const grid = document.getElementById("partyGifGrid");
    if (!grid) return;
    grid.innerHTML = "<p class='party-muted'>Loading…</p>";
    try {
      const r = await authFetch("/party/gifs?q=" + encodeURIComponent(q || "party") + "&limit=18");
      const data = await r.json();
      const items = (data && data.results) || [];
      if (!items.length) {
        grid.innerHTML = "<p class='party-muted'>No GIFs — paste a GIF URL above</p>";
        return;
      }
      grid.innerHTML = items
        .map(
          (it) =>
            '<button type="button" data-gif-url="' +
            escapeHtml(it.url) +
            '"><img src="' +
            escapeHtml(it.preview || it.url) +
            '" alt="" loading="lazy"/></button>'
        )
        .join("");
    } catch (e) {
      grid.innerHTML = "<p class='party-muted'>GIF search failed — paste a URL</p>";
    }
  }

  function sendGif(url) {
    url = String(url || "").trim();
    if (!url || !ws || ws.readyState !== 1) return;
    if (!roomFeatures.chat_gif) {
      toast("GIFs disabled by host");
      return;
    }
    ws.send(JSON.stringify({ type: "chat", msgType: "gif", url: url, text: "" }));
  }

  async function toggleVoiceNote() {
    if (!roomFeatures.chat_voice_note) {
      toast("Voice notes disabled by host");
      return;
    }
    const btn = document.getElementById("partyVoiceBtn");
    if (voiceRecorder && voiceRecorder.state === "recording") {
      voiceRecorder.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceChunks = [];
      voiceStartAt = Date.now();
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      voiceRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      voiceRecorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size) voiceChunks.push(ev.data);
      };
      voiceRecorder.onstop = async () => {
        try {
          stream.getTracks().forEach((t) => t.stop());
        } catch (e) {}
        const blob = new Blob(voiceChunks, { type: voiceRecorder.mimeType || "audio/webm" });
        voiceRecorder = null;
        if (btn) btn.textContent = "🎤";
        const durationMs = Date.now() - voiceStartAt;
        if (blob.size < 200) return;
        await uploadAndSendVoice(blob, durationMs);
      };
      voiceRecorder.start();
      if (btn) btn.textContent = "⏹";
      toast("Recording… tap again to send");
    } catch (e) {
      toast("Mic permission needed");
    }
  }

  async function uploadAndSendVoice(blob, durationMs) {
    if (!ws || ws.readyState !== 1) return;
    try {
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      const b64 = btoa(bin);
      const r = await authFetch("/party/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: roomCode,
          kind: "voice",
          contentType: blob.type || "audio/webm",
          data: b64,
        }),
      });
      const data = await r.json();
      if (!data || !data.ok || !data.url) {
        toast((data && data.error) || "Upload failed");
        return;
      }
      ws.send(
        JSON.stringify({
          type: "chat",
          msgType: "voice",
          url: data.url,
          durationMs: durationMs || 0,
          text: "",
        })
      );
    } catch (e) {
      toast("Voice upload failed");
    }
  }

  function sendSetFeatures(patch) {
    if (!isAdmin || !ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: "set_features", features: patch }));
  }
  function sendSetSyncLive(mode) {
    if (!isAdmin || !ws || ws.readyState !== 1) return;
    const m = String(mode || "content").toLowerCase();
    const next = SYNC_LIVE_MODES.indexOf(m) >= 0 ? m : "content";
    syncLiveMode = next;
    ws.send(JSON.stringify({ type: "set_sync_live", mode: next }));
    toast("Live sync: " + next);
  }
  function sendGrantAdmin(id) {
    if (!isHost || !ws || ws.readyState !== 1 || !id) return;
    ws.send(JSON.stringify({ type: "grant_admin", memberId: id }));
  }
  function sendRevokeAdmin(id) {
    if (!isHost || !ws || ws.readyState !== 1 || !id) return;
    ws.send(JSON.stringify({ type: "revoke_admin", memberId: id }));
  }

  function showPartyCreated(code, meta) {
    meta = meta || {};
    roomCode = code;
    if (meta.name) roomName = meta.name;
    if (meta.room) applyRoomMeta(meta.room);
    else applyRoomMeta({ code: code, name: roomName, public: roomPublic, roomNumber: roomNumber });
    const wrap = document.getElementById("sdPartyCreated");
    if (wrap) wrap.hidden = false;
    const c = document.getElementById("sdPartyCode");
    if (c) c.textContent = code;
    const join = location.origin + "/party/join/" + code;
    const inp = document.getElementById("sdPartyJoinUrl");
    if (inp) inp.value = join;
    const qr = document.getElementById("sdPartyQr");
    if (qr) qr.innerHTML = qrImg(join);
  }

  async function joinParty(code, opts) {
    opts = opts || {};
    code = String(code || "").toUpperCase();
    const attempts = Math.max(1, opts.retries != null ? opts.retries : 1);
    let pwd = opts.password != null ? opts.password : readPassword();
    if (!pwd) {
      try {
        pwd = sessionStorage.getItem("sd_party_password_pending") || "";
      } catch (e) {}
    }
    const hk = opts.hostKey || loadHostKey(code) || "";
    let lastErr = null;
    for (let i = 0; i < attempts; i++) {
      try {
        const msg = await connectWs("join", code, { password: pwd, hostKey: hk });
        if (!msg || (msg.type !== "joined" && msg.type !== "created")) {
          throw new Error("timeout");
        }
        try {
          sessionStorage.removeItem("sd_party_password_pending");
        } catch (e) {}
        showPartyCreated(code, { name: roomName });
        rememberPartyRecent(code, roomName, contentTitle());
        saveLastPlace({
          path: location.pathname + location.search,
          partyCode: code,
          channelId: typeof channelId !== "undefined" ? channelId : null,
          title: contentTitle(),
        });
        openOverlay();
        closePartyModal();
        return msg;
      } catch (e) {
        lastErr = e;
        const err = String((e && e.message) || e || "");
        if (err === "bad_password" || err === "not_found" || err === "auth_required" || err === "full" || err === "feature_disabled") {
          break;
        }
        if (i + 1 < attempts) {
          await new Promise((r) => setTimeout(r, 700 + i * 500));
        }
      }
    }
    const err = String((lastErr && lastErr.message) || lastErr || "party");
    if (err === "bad_password") {
      if (typeof showErr === "function") showErr("Wrong party password");
      else toast("Wrong party password");
      openPanel();
    } else if (err === "not_found") {
      if (typeof showErr === "function") showErr("Party not found or expired");
      else toast("Party not found or expired");
    } else if (err === "auth_required") {
      if (typeof showErr === "function") showErr("Session ended — sign in again");
      else toast("Session ended — sign in again");
    } else if (err === "full") {
      toast("Party is full");
    } else if (typeof showErr === "function") showErr("Could not join party");
    else toast("Could not join party");
    throw lastErr || new Error(err);
  }

  function wsUrl() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    return proto + "://" + location.host + "/ws/party";
  }

  function connectWs(mode, code, opts) {
    opts = opts || {};
    return new Promise((resolve, reject) => {
      try {
        if (ws) {
          try {
            ws.close();
          } catch (e) {}
        }
        let settled = false;
        const done = (fn, arg) => {
          if (settled) return;
          settled = true;
          fn(arg);
        };
        ws = new WebSocket(wsUrl());
        ws.onopen = () => {
          const payload = {
            type: mode,
            code: code,
            displayName: partyName(),
            clientId: clientId(),
            content: contentPayload(),
          };
          if (opts.password) payload.password = opts.password;
          if (opts.hostKey) payload.hostKey = opts.hostKey;
          if (mode === "create") {
            if (opts.name) payload.name = opts.name;
            if (typeof opts.public === "boolean") payload.public = opts.public;
          }
          ws.send(JSON.stringify(payload));
          startPingLoop();
          sendPing();
        };
        ws.onmessage = (ev) => {
          let msg;
          try {
            msg = JSON.parse(ev.data);
          } catch (e) {
            return;
          }
          handleMsg(msg);
          if (msg.type === "created" || msg.type === "joined") done(resolve, msg);
          if (msg.type === "error") done(reject, new Error(msg.error || "party"));
        };
        ws.onerror = () => done(reject, new Error("ws"));
        setTimeout(() => done(reject, new Error("timeout")), 8000);
      } catch (e) {
        reject(e);
      }
    });
  }

  function handleMsg(msg) {
    if (!msg || !msg.type) return;
    if (msg.type === "created" || msg.type === "joined") {
      memberId = msg.memberId || "";
      if (msg.hostKey) {
        hostKey = msg.hostKey;
        storeHostKey((msg.room && msg.room.code) || roomCode, hostKey);
      }
      roomCode = (msg.room && msg.room.code) || roomCode;
      isHost = !!(msg.room && msg.room.hostId === memberId);
      if (msg.room) renderRoom(msg.room);
      ensureRemoteListener();
      bindBuffering();
      startClockLoop();
      if (!isHost && msg.room && msg.room.content) {
        applyContent(msg.room.content, { fromJoin: true });
      }
      if (!isHost && msg.room && msg.room.clock) {
        setTimeout(() => applyClock(msg.room.clock, true), 800);
      }
    } else if (msg.type === "room_meta" && msg.room) {
      applyRoomMeta(msg.room);
      if (msg.room.members) renderMembers(msg.room.members);
    } else if (msg.type === "pong") {
      handlePong(msg);
    } else if (msg.type === "error" && msg.error === "catchup_unavailable") {
      toast("Catchup unavailable — falling back");
      syncLiveMode = "content";
      catchupUrl = null;
      syncFeaturesUi();
    } else if (msg.type === "host") {
      if (msg.memberId === memberId) {
        isHost = true;
        isAdmin = true;
        if (msg.hostKey) {
          hostKey = msg.hostKey;
          storeHostKey(roomCode, hostKey);
        }
        toast("You are now the host");
        showPartyCreated(roomCode, { name: roomName });
        applyRoomMeta({
          code: roomCode,
          name: roomName,
          public: roomPublic,
          roomNumber: roomNumber,
          features: roomFeatures,
          admins: roomAdmins,
          hostId: memberId,
        });
      } else {
        isHost = false;
        applyRoomMeta({
          code: roomCode,
          name: roomName,
          public: roomPublic,
          roomNumber: roomNumber,
          features: roomFeatures,
          admins: roomAdmins,
          hostId: msg.memberId,
        });
      }
    } else if (msg.type === "member" && msg.members) {
      renderMembers(msg.members);
      if (window.SDPartyAV && SDPartyAV.onMembers) SDPartyAV.onMembers(msg.members);
    } else if (msg.type === "chat" && msg.message) {
      appendChat(msg.message);
    } else if (msg.type === "error" && msg.error === "feature_disabled") {
      toast("That feature is disabled by the host");
    } else if (msg.type === "reaction") {
      floatEmoji(msg.emoji);
    } else if (msg.type === "clock" && msg.clock) {
      applyClock(msg.clock, false);
    } else if (msg.type === "content" && msg.content) {
      applyContent(msg.content);
    } else if (msg.type === "force_sync") {
      if (msg.content) applyContent(msg.content, { force: true });
      if (msg.clock) setTimeout(() => applyClock(msg.clock, true), 600);
      toast("Host forced sync");
    } else if (msg.type === "kicked") {
      toast("Removed from party");
      leaveParty({ silent: true });
    } else if (msg.type === "remote" && msg.cmd) {
      handleRemote(msg.cmd);
    } else if (
      msg.type === "webrtc_offer" ||
      msg.type === "webrtc_answer" ||
      msg.type === "webrtc_ice" ||
      msg.type === "webrtc_hangup" ||
      msg.type === "av_state"
    ) {
      if (window.SDPartyAV && SDPartyAV.handleSignal) SDPartyAV.handleSignal(msg);
    }
  }

  function sameContent(a, b) {
    if (!a || !b) return false;
    return (
      String(a.tmdbId || a.tmdb_id || "") === String(b.tmdbId || b.tmdb_id || "") &&
      String(a.channelId || a.channel_id || "") === String(b.channelId || b.channel_id || "") &&
      String(a.season || "") === String(b.season || "") &&
      String(a.episode || "") === String(b.episode || "") &&
      String(a.mediaType || a.type || "movie").toLowerCase() ===
        String(b.mediaType || b.type || "movie").toLowerCase()
    );
  }

  async function applyContent(content, opts) {
    opts = opts || {};
    if (!content || isHost || applyingContent) return;
    const already = sameContent(content, contentPayload());
    const tmdb = content.tmdbId || content.tmdb_id;
    const channel = content.channelId || content.channel_id;
    // Live TV has no scrub sync — if already on the host channel, never reload.
    if (!opts.force && already) {
      if (!tmdb && channel) return;
      if (syncable() || !opts.fromJoin) return;
      if (!tmdb) return;
    }
    applyingContent = true;
    try {
      const media = String(content.mediaType || content.type || "movie").toLowerCase();
      const title = content.title || "title";
      if (tmdb && media !== "live" && media !== "channel") {
        toast("Following host → " + title);
        const ctx = {
          tmdbId: String(tmdb),
          mediaType: media === "tv" || media === "series" || media === "show" ? "tv" : "movie",
          season: content.season != null && content.season !== "" ? String(content.season) : "",
          episode: content.episode != null && content.episode !== "" ? String(content.episode) : "",
          title: title,
        };
        if (typeof startVodPlayback === "function") {
          await startVodPlayback(ctx, "vod_picker");
        } else {
          const path =
            ctx.mediaType === "tv"
              ? "/vod/tv/" +
                ctx.tmdbId +
                (ctx.season
                  ? "?season=" +
                    encodeURIComponent(ctx.season) +
                    (ctx.episode ? "&episode=" + encodeURIComponent(ctx.episode) : "")
                  : "")
              : "/vod/movie/" + ctx.tmdbId;
          const join = path + (path.includes("?") ? "&" : "?") + "party=" + encodeURIComponent(roomCode);
          location.href = join;
        }
      } else if (channel) {
        if (catchupUrl && syncLiveMode === "catchup") {
          toast("Following host → catchup");
          await ensureCatchupPlayback(catchupUrl);
          return;
        }
        const alreadyOn =
          typeof channelId !== "undefined" && String(channelId) === String(channel);
        if (alreadyOn && !opts.force) {
          toast("In host’s live channel");
          return;
        }
        toast("Following host → live");
        if (typeof switchChannel === "function") {
          await switchChannel(String(channel), { force: !!opts.force });
        } else {
          // Avoid reload-loop: only navigate if path differs.
          const want = "/tv/" + encodeURIComponent(channel);
          if (!location.pathname.replace(/\/$/, "").endsWith("/" + String(channel))) {
            const join =
              want +
              "?party=" +
              encodeURIComponent(roomCode || "") +
              (partyName() ? "&name=" + encodeURIComponent(partyName()) : "");
            location.href = join;
          }
        }
      } else if (!opts.fromJoin) {
        toast("Host changed content");
      }
    } catch (e) {
      toast("Could not follow host content");
    } finally {
      applyingContent = false;
    }
  }

  function renderRoom(room) {
    applyRoomMeta(room);
    renderMembers(room.members || []);
    const chat = document.getElementById("partyChat");
    if (chat) {
      chat.innerHTML = "";
      (room.chat || []).forEach((m) => appendChat(m, { silent: true }));
    }
  }
  function renderMembers(members) {
    lastMembers = members || [];
    if (window.SDPartyAV && SDPartyAV.onMembers) SDPartyAV.onMembers(lastMembers);
    syncLiveBadge();
    const el = document.getElementById("partyMembers");
    if (!el) return;
    el.innerHTML = lastMembers
      .filter((m) => m.kind !== "remote")
      .map((m) => {
        const buff = m.buffering ? " …" : "";
        const host = m.role === "host" ? " ★" : "";
        const adminMark = roomAdmins.indexOf(m.id) >= 0 && m.role !== "host" ? " ⚒" : "";
        const kick =
          isHost && m.id !== memberId
            ? ' <button type="button" class="party-kick" data-kick="' +
              escapeHtml(m.id) +
              '" title="Kick">×</button>'
            : "";
        let adminBtn = "";
        if (isHost && m.id !== memberId && m.role !== "host") {
          const isAdm = roomAdmins.indexOf(m.id) >= 0;
          adminBtn = isAdm
            ? ' <button type="button" class="party-kick" data-admin="' +
              escapeHtml(m.id) +
              '" data-grant="0" title="Revoke admin">−</button>'
            : ' <button type="button" class="party-kick" data-admin="' +
              escapeHtml(m.id) +
              '" data-grant="1" title="Make admin">+</button>';
        }
        return (
          '<span class="party-member">' +
          escapeHtml(m.displayName || "?") +
          host +
          adminMark +
          buff +
          adminBtn +
          kick +
          "</span>"
        );
      })
      .join("");
  }
  function appendChat(m, opts) {
    opts = opts || {};
    const chat = document.getElementById("partyChat");
    if (!chat || !m) return;
    const div = document.createElement("div");
    const kind = String(m.msgType || m.kind || "text").toLowerCase();
    div.className = "m" + (kind === "gif" ? " party-msg-gif" : kind === "voice" ? " party-msg-voice" : "");
    const name = '<span class="n">' + escapeHtml(m.displayName || "?") + "</span> ";
    if (kind === "gif" && m.url) {
      div.innerHTML =
        name +
        (m.text ? escapeHtml(m.text) + " " : "") +
        '<a href="' +
        escapeHtml(m.url) +
        '" target="_blank" rel="noopener"><img src="' +
        escapeHtml(m.url) +
        '" alt="GIF" loading="lazy"/></a>';
    } else if (kind === "voice" && m.url) {
      const secs = m.durationMs ? Math.round(m.durationMs / 1000) + "s" : "";
      div.innerHTML =
        name +
        (secs ? '<span class="party-muted">' + secs + "</span> " : "") +
        '<audio controls preload="metadata" src="' +
        escapeHtml(m.url) +
        '"></audio>';
    } else {
      div.innerHTML = name + escapeHtml(m.text || "");
    }
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    if (opts.silent) return;
    if (chatUiMode === "muted" || chatUiMode === "cinema") {
      if (chatUiMode === "muted") {
        unreadWhileMuted += 1;
        updateFabChrome();
      }
      return;
    }
    if (bubblesEnabled()) {
      pushRisingBubble(m);
      noteChatActivity();
      return;
    }
    noteChatActivity({ expand: chatUiMode === "sidebar" });
  }
  function floatEmoji(emoji) {
    if (!emoji) return;
    if (chatUiMode === "muted" || chatUiMode === "cinema") return;
    if (bubblesEnabled()) {
      pushRisingReaction(emoji);
    }
    const liveOverlay =
      document.body.classList.contains("party-live-overlay") ||
      layoutRoots().some((el) => el.classList.contains("party-live-overlay"));
    const mobileSplit =
      !liveOverlay &&
      (document.body.classList.contains("party-layout-rave") ||
        document.body.classList.contains("party-layout-hulu") ||
        layoutRoots().some(
          (el) => el.classList.contains("party-layout-rave") || el.classList.contains("party-layout-hulu")
        ));
    const drawer = document.getElementById("partyDrawer");
    const chat = document.getElementById("partyChat");
    const host = liveOverlay
      ? partyHost()
      : mobileSplit && (chat || drawer)
        ? chat || drawer
        : partyHost();
    const el = document.createElement("div");
    el.className = "party-float-emoji";
    el.textContent = emoji;
    if (liveOverlay) {
      el.style.left = "auto";
      el.style.right = 6 + Math.random() * 18 + "%";
      el.style.bottom = 18 + Math.random() * 12 + "%";
    } else {
      el.style.left = (mobileSplit ? 18 + Math.random() * 64 : 40 + Math.random() * 20) + "%";
      if (mobileSplit) el.style.bottom = "8%";
    }
    host.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }
  function toast(text) {
    ensureUi();
    const el = document.getElementById("partyToast");
    if (!el) return;
    el.textContent = text;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2400);
  }

  function openOverlay() {
    ensureUi();
    if (chatUiMode !== "sidebar") {
      applyChatUiMode(chatUiMode, { skipOpen: false });
      return;
    }
    chatCollapsed = false;
    saveChatMinPref(false);
    const drawer = document.getElementById("partyDrawer");
    if (drawer) {
      drawer.classList.add("open");
      drawer.classList.remove("collapsed");
    }
    document.getElementById("partyFab")?.classList.remove("show");
    setChatClasses(true, false);
    const btn = document.getElementById("partyCollapseBtn");
    if (btn) {
      btn.textContent = "▾";
      btn.title = "Collapse chat";
    }
    const expandBtn = document.getElementById("partyLiveExpandBtn");
    if (expandBtn) {
      liveExpanded = loadLiveExpandedPref();
      expandBtn.title = liveExpanded ? "Overlay chat (FB Live)" : "Expand chat panel";
      expandBtn.textContent = liveExpanded ? "▦" : "▣";
    }
    updateFabChrome();
    scheduleChatIdle();
  }

  function sendChat(text) {
    text = String(text || "").trim();
    if (!text || !ws || ws.readyState !== 1) return;
    if (!roomFeatures.chat_text) {
      toast("Text chat disabled by host");
      return;
    }
    ws.send(JSON.stringify({ type: "chat", msgType: "text", text }));
  }
  function sendReaction(emoji) {
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: "reaction", emoji }));
  }
  function sendRename() {
    if (!isHost || !ws || ws.readyState !== 1) return;
    const el = document.getElementById("partyRenameInput");
    const name = ((el && el.value) || "").trim();
    if (name.length < 3) return;
    ws.send(JSON.stringify({ type: "rename", name }));
  }
  function sendSetPublic(on) {
    if (!isHost || !ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: "set_public", public: !!on }));
  }

  function forceSync() {
    if (!isHost || !ws || ws.readyState !== 1) return;
    broadcastContent();
    broadcastClock();
    ws.send(JSON.stringify({ type: "force_sync" }));
    toast("Forced sync for guests");
  }

  function kickMember(id) {
    if (!isHost || !ws || ws.readyState !== 1 || !id) return;
    ws.send(JSON.stringify({ type: "kick", memberId: id }));
  }

  function sendPing() {
    if (!ws || ws.readyState !== 1) return;
    lastPingSentAt = Date.now();
    try {
      ws.send(JSON.stringify({ type: "ping", t: lastPingSentAt }));
    } catch (e) {}
  }

  function startPingLoop() {
    clearInterval(pingTimer);
    pingTimer = setInterval(sendPing, PING_INTERVAL_MS);
  }

  function stopPingLoop() {
    clearInterval(pingTimer);
    pingTimer = null;
  }

  function handlePong(msg) {
    const t0 = Number(msg.clientT != null ? msg.clientT : lastPingSentAt) || lastPingSentAt;
    const t3 = Date.now();
    let serverTime = Number(msg.serverTime);
    if (!isFinite(serverTime)) {
      const t = Number(msg.t);
      serverTime = t > 1e12 ? t : t * 1000;
    }
    if (!isFinite(t0) || !isFinite(serverTime)) return;
    // NTP-style: offset ≈ ((t1 - t0) + (t2 - t3)) / 2 with t1≈t2≈serverTime
    const sample = (serverTime - t0 + serverTime - t3) / 2;
    if (!isFinite(sample)) return;
    clockOffsetMs = clockOffsetMs ? clockOffsetMs * 0.7 + sample * 0.3 : sample;
  }

  function broadcastClock() {
    if (!isHost || !ws || ws.readyState !== 1) return;
    if (!shouldBroadcastClock()) return;
    if (typeof v === "undefined" || !v) return;
    const liveEdgeOffset = getLiveEdgeOffset();
    const pdt = getProgramDateTimeMs();
    const payload = {
      type: "clock",
      positionSeconds: v.currentTime || 0,
      paused: !!v.paused,
      playbackRate: v.playbackRate || 1,
      liveEdgeOffset: liveEdgeOffset,
      hasPdt: !!hasPdt,
      programDateTime: pdt,
    };
    ws.send(JSON.stringify(payload));
  }

  function broadcastContent() {
    if (!isHost || !ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: "content", content: contentPayload() }));
  }

  function startClockLoop() {
    clearInterval(clockTimer);
    clockTimer = setInterval(() => {
      if (isHost && shouldBroadcastClock()) broadcastClock();
    }, CLOCK_LOOP_MS);
  }

  function resetPlaybackRate() {
    if (typeof v === "undefined" || !v) return;
    try {
      if (Math.abs((v.playbackRate || 1) - 1) > 0.01) v.playbackRate = 1;
    } catch (e) {}
  }

  function extrapolatedHostPosition(clock) {
    const base = Number(clock.positionSeconds) || 0;
    if (clock.paused) return base;
    const updatedAt = Number(clock.updatedAt || clock.serverTime) || 0;
    if (!updatedAt) return base;
    const elapsed = Math.max(0, (serverNowMs() - updatedAt) / 1000);
    const rate = Number(clock.playbackRate) || 1;
    return base + elapsed * rate;
  }

  function applyLagClock(clock, force) {
    if (typeof v === "undefined" || !v) return;
    if (typeof hls === "undefined" || !hls) return;
    const hostOff = Number(clock.liveEdgeOffset);
    if (!isFinite(hostOff)) return;
    const myOff = getLiveEdgeOffset();
    if (myOff == null || !isFinite(myOff)) return;
    const skew = myOff - hostOff; // positive => I'm further behind live than host
    const abs = Math.abs(skew);
    if (!force && abs < 0.25) {
      resetPlaybackRate();
      return;
    }
    // Nudge via playbackRate only — never hard-seek raw live currentTime like VOD.
    try {
      if (force || abs > 1.5) {
        const rate = skew > 0 ? SOFT_RATE_FAST : SOFT_RATE_SLOW;
        v.playbackRate = rate;
        clearTimeout(softRateTimer);
        softRateTimer = setTimeout(resetPlaybackRate, 2200);
      } else if (abs > 0.35) {
        v.playbackRate = skew > 0 ? 1.01 : 0.99;
        clearTimeout(softRateTimer);
        softRateTimer = setTimeout(resetPlaybackRate, 1800);
      } else {
        resetPlaybackRate();
      }
    } catch (e) {}
  }

  function applyPdtClock(clock, force) {
    if (typeof v === "undefined" || !v) return;
    const hostPdt = Number(clock.programDateTime);
    const myPdt = getProgramDateTimeMs();
    if (!isFinite(hostPdt) || !isFinite(myPdt)) {
      if (force) toast("PDT missing — try lag or catchup");
      return;
    }
    const skewSec = (hostPdt - myPdt) / 1000;
    const abs = Math.abs(skewSec);
    if (!force && abs < DRIFT_IGNORE_S) {
      resetPlaybackRate();
      return;
    }
    // Prefer soft rate; only seek when large and seekable (catchup/VOD), not raw live.
    if ((force || abs > DRIFT_SOFT_S) && syncable() && Date.now() - lastSeekAt >= SEEK_COOLDOWN_MS) {
      try {
        v.currentTime = (v.currentTime || 0) + skewSec;
        lastSeekAt = Date.now();
        resetPlaybackRate();
      } catch (e) {}
      return;
    }
    try {
      if (abs > DRIFT_IGNORE_S) {
        v.playbackRate = skewSec > 0 ? SOFT_RATE_FAST : SOFT_RATE_SLOW;
        clearTimeout(softRateTimer);
        softRateTimer = setTimeout(resetPlaybackRate, 2000);
      }
    } catch (e) {}
  }

  function applyVodClock(clock, force) {
    if (typeof v === "undefined" || !v) return;
    const target = extrapolatedHostPosition(clock);
    const now = v.currentTime || 0;
    const skew = target - now;
    const abs = Math.abs(skew);
    const cooling = Date.now() - lastSeekAt < SEEK_COOLDOWN_MS;
    if (!force && abs < DRIFT_IGNORE_S) {
      resetPlaybackRate();
    } else if (force || (abs > DRIFT_SOFT_S && !cooling)) {
      try {
        v.currentTime = target;
        lastSeekAt = Date.now();
      } catch (e) {}
      resetPlaybackRate();
    } else if (abs >= DRIFT_IGNORE_S) {
      try {
        const rate = skew > 0 ? SOFT_RATE_FAST : SOFT_RATE_SLOW;
        v.playbackRate = rate;
        clearTimeout(softRateTimer);
        softRateTimer = setTimeout(resetPlaybackRate, 2200);
      } catch (e) {}
    } else {
      resetPlaybackRate();
    }
    // Respect sync_wait_buffering: server forces paused while peers buffer
    if (clock.paused && !v.paused) v.pause();
    if (!clock.paused && v.paused && !waitForBuffering) v.play().catch(() => {});
    else if (!clock.paused && v.paused) v.play().catch(() => {});
  }

  function applyClock(clock, force) {
    if (isHost || applyingClock || !clock) return;
    if (!guestFollowSync) return;
    applyingClock = true;
    try {
      if (syncable()) {
        applyVodClock(clock, force);
      } else if (syncLiveMode === "lag" && !catchupUrl) {
        applyLagClock(clock, force);
        if (clock.paused && v && !v.paused) v.pause();
        if (!clock.paused && v && v.paused) v.play().catch(() => {});
      } else if (syncLiveMode === "pdt") {
        if (clock.hasPdt || hasPdt) applyPdtClock(clock, force);
        else if (force) {
          toast("No PROGRAM-DATE-TIME — falling back to lag");
          applyLagClock(clock, force);
        }
        if (clock.paused && v && !v.paused) v.pause();
        if (!clock.paused && v && v.paused) v.play().catch(() => {});
      }
    } finally {
      applyingClock = false;
    }
  }

  function leaveParty(opts) {
    opts = opts || {};
    clearChatIdle();
    stopPingLoop();
    try {
      if (ws) ws.send(JSON.stringify({ type: "leave" }));
      if (ws) ws.close();
    } catch (e) {}
    ws = null;
    roomCode = "";
    roomName = "";
    roomPublic = false;
    roomNumber = 0;
    isHost = false;
    isAdmin = false;
    roomAdmins = [];
    roomFeatures = Object.assign({}, DEFAULT_FEATURES);
    syncLiveMode = "content";
    catchupUrl = null;
    waitForBuffering = false;
    clockOffsetMs = 0;
    lastAttachedCatchup = null;
    hasPdt = false;
    lastProgramDateTime = null;
    clearInterval(clockTimer);
    clockTimer = null;
    chatMode = "text";
    chatCollapsed = false;
    lastMembers = [];
    stopAv();
    document.getElementById("partyDrawer")?.classList.remove("open", "collapsed");
    document.getElementById("partyFab")?.classList.remove("show");
    document.getElementById("partyLiveBadge")?.classList.remove("show");
    setChatClasses(false, false);
    const wrap = document.getElementById("sdPartyCreated");
    if (wrap) wrap.hidden = true;
    saveLastPlace({ partyCode: null });
    syncFeaturesUi();
    if (!opts.silent) closePartyModal();
  }

  function ensureRemoteListener() {
    if (remoteBound) return;
    remoteBound = true;
  }

  function bindBuffering() {
    if (bufferingBound || typeof v === "undefined" || !v) return;
    bufferingBound = true;
    const sendBuff = (on) => {
      if (!ws || ws.readyState !== 1) return;
      ws.send(JSON.stringify({ type: "buffering", buffering: !!on }));
    };
    v.addEventListener("waiting", () => sendBuff(true));
    v.addEventListener("stalled", () => sendBuff(true));
    v.addEventListener("playing", () => sendBuff(false));
    v.addEventListener("canplay", () => sendBuff(false));
  }

  function handleRemote(cmd) {
    cmd = String(cmd || "").toLowerCase();
    if (cmd === "playpause") {
      if (v.paused) v.play().catch(() => {});
      else v.pause();
    } else if (cmd === "mute") {
      v.muted = !v.muted;
    } else if (cmd === "up" || cmd === "left") {
      try {
        if (typeof changeChannel === "function") changeChannel(-1);
        else if (typeof stepChannel === "function") stepChannel(-1);
        else if (typeof navigateChannel === "function") navigateChannel(-1);
        else document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
      } catch (e) {}
    } else if (cmd === "down" || cmd === "right") {
      try {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
      } catch (e) {}
    } else if (cmd === "next") {
      const n = document.getElementById("vodEpNext");
      if (n) n.click();
    } else if (cmd === "prev") {
      const p = document.getElementById("vodEpPrev");
      if (p) p.click();
    } else if (cmd === "guide") {
      const g = document.getElementById("guideToggle");
      if (g) g.click();
    } else if (cmd === "ok" || cmd === "info") {
      if (cmd === "info" && typeof openXray === "function") openXray();
    }
  }

  function onHlsStarted(ctx) {
    ensureUi();
    refreshPdtState(
      (typeof currentStreamUrl !== "undefined" && currentStreamUrl) || catchupUrl || ""
    ).then(() => {
      if (syncLiveMode === "pdt" && !hasPdt && isHost) {
        toast("No PDT tags — lag/catchup recommended");
      }
    });
    if (catchupUrl && syncLiveMode === "catchup" && !playingCatchupUrl(catchupUrl)) {
      ensureCatchupPlayback(catchupUrl);
    }
    if (ws && ws.readyState === 1 && isHost) {
      broadcastContent();
      broadcastClock();
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  try {
    const params = new URLSearchParams(location.search);
    let code = (params.get("party") || "").toUpperCase();
    let name = params.get("name");
    try {
      if (!code) code = (sessionStorage.getItem("sd_party_pending") || "").toUpperCase();
      if (!name) name = sessionStorage.getItem("sd_party_name_pending") || "";
    } catch (e) {}
    if (name) {
      try {
        localStorage.setItem("sd_party_name", name);
      } catch (e) {}
    }
    if (code) {
      const tryJoin = (attempt) => {
        joinParty(code, { retries: 1 })
          .then(() => {
            try {
              sessionStorage.removeItem("sd_party_pending");
              sessionStorage.removeItem("sd_party_name_pending");
            } catch (e) {}
          })
          .catch((e) => {
            const err = String((e && e.message) || e || "");
            if (
              attempt < 5 &&
              err !== "bad_password" &&
              err !== "not_found" &&
              err !== "auth_required" &&
              err !== "full"
            ) {
              setTimeout(() => tryJoin(attempt + 1), 900 + attempt * 400);
            } else {
              try {
                sessionStorage.removeItem("sd_party_pending");
                sessionStorage.removeItem("sd_party_name_pending");
              } catch (err2) {}
            }
          });
      };
      setTimeout(() => tryJoin(1), 900);
    } else if (params.get("party_create") === "1") {
      setTimeout(() => {
        try {
          openPanel();
        } catch (e) {}
      }, 1100);
    }
  } catch (e) {}

  /* —— Party home slide-up (same chrome as VOD catalog) —— */
  const LS_PARTY_NAME = "sd_party_name";
  const LS_PARTY_RECENT = "sd_party_recent";
  const LS_LAST_PLACE = "sd_last_place";
  const LS_LAST_TV = "sd_last_tv_channel";
  let partyHomeOpen = false;
  let partyHomePollTimer = null;
  let partyHomeWired = false;

  function partyHomeEsc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function partyHomeEl(id) {
    return document.getElementById(id);
  }

  function partyHomeWatchJoinUrl(code, name, watchPath) {
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

  function partyHomeStashPending(code, name) {
    try {
      sessionStorage.setItem("sd_party_pending", code);
      sessionStorage.setItem("sd_party_name_pending", name || "Guest");
      localStorage.setItem(LS_PARTY_NAME, name || "Guest");
    } catch (e) {}
  }

  function partyHomeTvUrl() {
    let ch = "";
    try {
      ch = localStorage.getItem(LS_LAST_TV) || "";
    } catch (e) {}
    return ch ? "/tv/" + encodeURIComponent(ch) : "/tv/";
  }

  function partyHomeRoomCard(room, opts) {
    opts = opts || {};
    const title = room.name || room.title || room.code || "Party";
    const meta = [];
    if (room.memberCount != null) meta.push(room.memberCount + " watching");
    if (room.locked) meta.push("Locked");
    if (room.title && room.title !== title) meta.push(room.title);
    if (room.channelId) meta.push("Ch " + room.channelId);
    const nameEl = partyHomeEl("partyHomeJoinName");
    const guest = (nameEl && nameEl.value) || "Guest";
    const poster = room.posterPath
      ? '<img class="party-home-poster" src="' + partyHomeEsc(room.posterPath) + '" alt=""/>'
      : '<div class="party-home-poster ph">LIVE</div>';
    const href =
      opts.href || partyHomeWatchJoinUrl(room.code, guest, room.watchPath);
    return (
      '<div class="party-home-card">' +
      poster +
      '<div class="body"><strong>' +
      partyHomeEsc(title) +
      "</strong><span>" +
      partyHomeEsc(meta.join(" · ")) +
      '</span></div><a class="party-home-btn" href="' +
      partyHomeEsc(href) +
      '">Join</a></div>'
    );
  }

  async function partyHomeLoadPublic() {
    const el = partyHomeEl("partyHomePublicList");
    if (!el) return;
    try {
      const r = await authFetch("/party/public");
      if (r.status === 401) {
        el.innerHTML = '<p class="party-home-empty">Sign in with PIN to see public parties.</p>';
        return;
      }
      const data = await r.json();
      const rooms = (data && data.rooms) || [];
      if (!rooms.length) {
        el.innerHTML = '<p class="party-home-empty">No public parties right now.</p>';
        return;
      }
      el.innerHTML = rooms.map((room) => partyHomeRoomCard(room)).join("");
    } catch (e) {
      el.innerHTML = '<p class="party-home-empty">Could not load public parties.</p>';
    }
  }

  async function partyHomeLoadPresence() {
    const summary = partyHomeEl("partyHomeOnlineSummary");
    const list = partyHomeEl("partyHomeOnlineList");
    if (!summary) return;
    try {
      const r = await authFetch("/party/presence");
      if (r.status === 401) {
        summary.textContent = "Sign in to see who’s online";
        return;
      }
      const data = await r.json();
      const n = (data && data.inParties) || 0;
      const priv = (data && data.privateRooms) || 0;
      summary.textContent =
        n +
        " in parties now" +
        (priv ? " · " + priv + " private room" + (priv === 1 ? "" : "s") : "");
      if (!list) return;
      const people = (data && data.online) || [];
      if (!people.length) {
        list.innerHTML = '<p class="party-home-empty">Nobody in a party right now.</p>';
        return;
      }
      const nameEl = partyHomeEl("partyHomeJoinName");
      const guest = (nameEl && nameEl.value) || "Guest";
      list.innerHTML = people
        .slice(0, 24)
        .map((p) => {
          const where = p.roomName || (p.public ? "Public party" : "In a party");
          const title = p.title ? " · " + p.title : "";
          return (
            '<div class="party-home-card"><div class="body"><strong>' +
            partyHomeEsc(p.displayName || "Guest") +
            "</strong><span>" +
            partyHomeEsc(where + title) +
            "</span></div>" +
            (p.watchPath && p.code
              ? '<a class="party-home-btn secondary" href="' +
                partyHomeEsc(partyHomeWatchJoinUrl(p.code, guest, p.watchPath)) +
                '">Join</a>'
              : "") +
            "</div>"
          );
        })
        .join("");
    } catch (e) {
      summary.textContent = "Presence unavailable";
    }
  }

  function partyHomeLoadRecent() {
    const el = partyHomeEl("partyHomeRecentList");
    if (!el) return;
    let recent = [];
    try {
      recent = JSON.parse(localStorage.getItem(LS_PARTY_RECENT) || "[]");
    } catch (e) {}
    if (!Array.isArray(recent) || !recent.length) {
      el.innerHTML = '<p class="party-home-empty">No recent parties on this device.</p>';
      return;
    }
    el.innerHTML = recent
      .slice(0, 8)
      .map((room) => {
        const href = "/party/join/" + encodeURIComponent(room.code || "");
        return partyHomeRoomCard(
          {
            code: room.code,
            name: room.name,
            title: room.title,
            watchPath: href,
            memberCount: null,
          },
          { href: href }
        );
      })
      .join("");
  }

  function partyHomeLoadSuggested() {
    const el = partyHomeEl("partyHomeSuggestList");
    const startLast = partyHomeEl("partyHomeStartLast");
    if (!el) return;
    let place = null;
    try {
      place = JSON.parse(localStorage.getItem(LS_LAST_PLACE) || "null");
    } catch (e) {}
    const cards = [];
    if (place && place.channelId) {
      const href = "/tv/" + encodeURIComponent(place.channelId) + "?party_create=1";
      cards.push(
        '<div class="party-home-card"><div class="party-home-poster ph">TV</div><div class="body"><strong>Start party on Ch ' +
          partyHomeEsc(place.channelId) +
          "</strong><span>" +
          partyHomeEsc(place.title || "Last live channel") +
          '</span></div><a class="party-home-btn" href="' +
          partyHomeEsc(href) +
          '">Start</a></div>'
      );
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
        '<div class="party-home-card"><div class="party-home-poster ph">VOD</div><div class="body"><strong>Continue ' +
          partyHomeEsc(place.title || "title") +
          '</strong><span>Start a party on this title</span></div><a class="party-home-btn" href="' +
          partyHomeEsc(path) +
          '">Start</a></div>'
      );
    }
    if (place && place.partyCode) {
      cards.push(
        '<div class="party-home-card"><div class="party-home-poster ph">↻</div><div class="body"><strong>Resume party ' +
          partyHomeEsc(place.partyCode) +
          "</strong><span>" +
          partyHomeEsc(place.title || place.path || "") +
          '</span></div><a class="party-home-btn secondary" href="/party/join/' +
          partyHomeEsc(place.partyCode) +
          '">Rejoin</a></div>'
      );
    }
    el.innerHTML = cards.length
      ? cards.join("")
      : '<p class="party-home-empty">Watch something, then start a party from here.</p>';
  }

  function partyHomeRefresh() {
    partyHomeLoadPublic();
    partyHomeLoadPresence();
    partyHomeLoadRecent();
    partyHomeLoadSuggested();
  }

  function closePartyHome(silent) {
    partyHomeOpen = false;
    const sheet = partyHomeEl("partyHome");
    const backdrop = partyHomeEl("partyHomeBackdrop");
    if (sheet) sheet.classList.remove("open");
    if (backdrop) backdrop.classList.remove("open");
    if (partyHomePollTimer) {
      clearInterval(partyHomePollTimer);
      partyHomePollTimer = null;
    }
    if (!silent) {
      const path = location.pathname.replace(/\/$/, "") || "/";
      if (path === "/party" || path === "/party/home") {
        history.replaceState(null, "", partyHomeTvUrl());
      }
    }
  }

  function openPartyHome(opts) {
    opts = opts || {};
    try {
      if (typeof window.SDCloseVodCatalogUI === "function") window.SDCloseVodCatalogUI();
    } catch (e) {}
    wirePartyHomeOnce();
    partyHomeOpen = true;
    const sheet = partyHomeEl("partyHome");
    const backdrop = partyHomeEl("partyHomeBackdrop");
    if (sheet) sheet.classList.add("open");
    if (backdrop) backdrop.classList.add("open");
    const nameInput = partyHomeEl("partyHomeJoinName");
    if (nameInput && !nameInput.value) {
      try {
        nameInput.value = localStorage.getItem(LS_PARTY_NAME) || "";
      } catch (e) {}
    }
    partyHomeRefresh();
    if (!partyHomePollTimer) {
      partyHomePollTimer = setInterval(() => {
        if (!partyHomeOpen) return;
        partyHomeLoadPublic();
        partyHomeLoadPresence();
      }, 20000);
    }
    const path = location.pathname.replace(/\/$/, "") || "/";
    if (path !== "/party" && path !== "/party/home") {
      if (opts.replace) history.replaceState({ sdPartyHome: 1 }, "", "/party");
      else history.pushState({ sdPartyHome: 1 }, "", "/party");
    } else if (opts.replace) {
      history.replaceState({ sdPartyHome: 1 }, "", "/party");
    }
  }

  function wirePartyHomeOnce() {
    if (partyHomeWired) return;
    partyHomeWired = true;
    const form = partyHomeEl("partyHomeJoinForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const code = ((partyHomeEl("partyHomeJoinCode") || {}).value || "")
          .trim()
          .toUpperCase();
        const name =
          ((partyHomeEl("partyHomeJoinName") || {}).value || "Guest").trim() ||
          "Guest";
        const err = partyHomeEl("partyHomeJoinErr");
        if (err) err.textContent = "";
        if (!code || code.length < 4) {
          if (err) err.textContent = "Enter a valid party code.";
          return;
        }
        partyHomeStashPending(code, name);
        let watch = "/tv/";
        try {
          const r = await authFetch(
            "/party/join/" + encodeURIComponent(code) + "/meta"
          );
          const data = await r.json();
          if (data && data.ok && data.watchPath) watch = data.watchPath;
          else if (data && data.error === "not_found") {
            if (err) err.textContent = "Room not found or expired.";
            return;
          }
        } catch (err2) {}
        location.href = partyHomeWatchJoinUrl(code, name, watch);
      });
    }
    const closeBtn = partyHomeEl("closePartyHome");
    if (closeBtn) closeBtn.addEventListener("click", () => closePartyHome());
    const backdrop = partyHomeEl("partyHomeBackdrop");
    if (backdrop) backdrop.addEventListener("click", () => closePartyHome());
    const startLive = partyHomeEl("partyHomeStartLive");
    if (startLive) {
      startLive.addEventListener("click", () => {
        closePartyHome(true);
        history.replaceState(null, "", partyHomeTvUrl().split("?")[0] + "?party_create=1");
        try {
          openPanel();
        } catch (e) {}
        setTimeout(() => {
          try {
            openPanel();
          } catch (e) {}
        }, 200);
      });
    }
    const startVod = partyHomeEl("partyHomeStartVod");
    if (startVod) {
      startVod.addEventListener("click", () => {
        location.href = "/vod?party_create=1";
      });
    }
    const startLast = partyHomeEl("partyHomeStartLast");
    if (startLast) {
      startLast.addEventListener("click", () => {
        const href = startLast.dataset.href || "/tv/?party_create=1";
        location.href = href;
      });
    }
    const homeBtn = partyHomeEl("partyHomeBtn");
    if (homeBtn) {
      homeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (partyHomeOpen) closePartyHome();
        else openPartyHome();
      });
    }
    window.addEventListener("popstate", () => {
      const path = location.pathname.replace(/\/$/, "") || "/";
      if (path === "/party" || path === "/party/home") openPartyHome({ replace: true });
      else if (partyHomeOpen) closePartyHome(true);
    });
  }

  function addHeaderShare() {
    const chrome = document.getElementById("collapsedChrome") || document.querySelector(".video-area");
    if (!chrome || document.getElementById("liveShareBtn")) return;
    const wrap = document.createElement("div");
    wrap.className = "guide-more-wrap live-more-wrap";
    wrap.style.cssText = "position:absolute;right:52px;top:max(8px,env(safe-area-inset-top,8px));pointer-events:auto;z-index:10";
    const b = document.createElement("button");
    b.type = "button";
    b.id = "liveShareBtn";
    b.className = "btn-search-chrome";
    b.title = "More";
    b.setAttribute("aria-label", "More actions");
    b.setAttribute("aria-haspopup", "menu");
    b.setAttribute("aria-expanded", "false");
    b.textContent = "⋯";
    const menu = document.createElement("div");
    menu.id = "liveMoreMenu";
    menu.className = "guide-more-menu";
    menu.hidden = true;
    menu.setAttribute("role", "menu");
    menu.innerHTML =
      '<button type="button" role="menuitem" data-live-action="share">Share / remote</button>' +
      '<button type="button" role="menuitem" data-live-action="guide">Show guide</button>' +
      '<button type="button" role="menuitem" data-live-action="settings">Settings</button>' +
      '<button type="button" role="menuitem" data-live-action="party">Watch Party</button>' +
      '<button type="button" role="menuitem" data-live-action="simple">Simple player</button>' +
      '<button type="button" role="menuitem" data-live-action="report">Report</button>';
    function closeMenu() {
      menu.hidden = true;
      b.setAttribute("aria-expanded", "false");
    }
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = menu.hidden;
      menu.hidden = !open;
      b.setAttribute("aria-expanded", open ? "true" : "false");
    });
    menu.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-live-action]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const action = btn.getAttribute("data-live-action");
      closeMenu();
      if (action === "share") openShare();
      else if (action === "guide") {
        try {
          const show = document.getElementById("showGuideBtn");
          if (show) show.click();
        } catch (err) {}
      } else if (action === "settings") {
        try {
          const s = document.getElementById("settingsBtn");
          if (s) s.click();
        } catch (err) {}
      } else if (action === "party") {
        try { openPartyHome(); } catch (err) {}
      } else if (action === "simple") {
        const a = document.getElementById("simpleLink");
        if (a && a.href) location.href = a.href;
      } else if (action === "report") {
        try { if (window.SDReport && SDReport.open) SDReport.open(); } catch (err) {}
      }
    });
    document.addEventListener("click", (e) => {
      if (!menu.hidden && !e.target.closest("#liveShareBtn, #liveMoreMenu")) closeMenu();
    });
    wrap.appendChild(b);
    wrap.appendChild(menu);
    chrome.appendChild(wrap);
  }

  ensureUi();
  addHeaderShare();
  wireLayoutPartyChrome();
  wirePartyHomeOnce();
  try {
    window.addEventListener("resize", syncPartyLayout);
    window.addEventListener("orientationchange", () => setTimeout(syncPartyLayout, 80));
  } catch (e) {}
  scheduleLayoutPartyChrome();
  try {
    const bootPath = location.pathname.replace(/\/$/, "") || "/";
    if (bootPath === "/party" || bootPath === "/party/home") {
      openPartyHome({ replace: true });
    }
  } catch (e) {}

  window.SDParty = {
    openShare,
    openPanel,
    openHome: openPartyHome,
    closeHome: closePartyHome,
    broadcastClock,
    broadcastContent,
    onHlsStarted,
    createParty,
    joinParty,
    leaveParty,
    forceSync,
    applyContent,
    ensureUi,
    layoutPartyChrome,
    _toast: toast,
    _onAvHangup: () => {
      chatMode = "text";
      syncModeUi();
    },
    _onAvProviderChange: () => {
      if (chatMode !== "text") startAv(chatMode);
    },
  };
})();
/* player_report: /tv ⋯ Report popup — audit snapshot + screenshot + POST /api/channel-reports */
(function sdReportBoot() {
  const CATEGORIES = [
    { id: "epg_mismatch", label: "EPG mismatch" },
    { id: "wrong_title", label: "Wrong title" },
    { id: "wrong_logo", label: "Logo issue" },
    { id: "wrong_network", label: "Wrong network" },
    { id: "playback", label: "Playback / stream" },
    { id: "paint_death", label: "Paint death (green/black)" },
    { id: "other", label: "Other" },
  ];
  const SEVERITIES = [
    { id: "low", label: "Low" },
    { id: "medium", label: "Medium" },
    { id: "high", label: "High" },
    { id: "critical", label: "Critical" },
  ];
  const LS_DEDUP = "sd_channel_report_dedup_v1";
  const DEDUP_MS = 15 * 60 * 1000;
  const MAX_SHOT_W = 480;

  let submitting = false;
  let lastAudit = null;
  let lastShot = null;

  function $(id) {
    return document.getElementById(id);
  }

  function toast(msg) {
    try {
      if (window.SDParty && typeof SDParty.toast === "function") {
        SDParty.toast(msg);
        return;
      }
    } catch (e) {}
    const el = $("errToast") || $("partyToast");
    if (el) {
      el.textContent = String(msg || "");
      el.classList.add("show");
      setTimeout(() => el.classList.remove("show"), 3500);
    }
  }

  function channelIdFromUrl() {
    const m = (location.pathname || "").match(/^\/tv\/([^/]+)\/?$/);
    return m ? decodeURIComponent(m[1]) : "";
  }

  function readDedup() {
    try {
      return JSON.parse(localStorage.getItem(LS_DEDUP) || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  function writeDedup(map) {
    try {
      localStorage.setItem(LS_DEDUP, JSON.stringify(map));
    } catch (e) {}
  }

  function localDupKey(channelId, cats, gt, severity) {
    return [channelId, cats.slice().sort().join(","), String(gt || "").trim().toLowerCase(), severity].join("|");
  }

  function isLocalDup(key) {
    const map = readDedup();
    const ts = Number(map[key] || 0);
    return ts && Date.now() - ts < DEDUP_MS;
  }

  function markLocalDup(key) {
    const map = readDedup();
    const now = Date.now();
    Object.keys(map).forEach((k) => {
      if (now - Number(map[k] || 0) > DEDUP_MS * 2) delete map[k];
    });
    map[key] = now;
    writeDedup(map);
  }

  function ensureUi() {
    if ($("sdReportModal")) return;
    const bd = document.createElement("div");
    bd.className = "sd-modal-backdrop";
    bd.id = "sdReportBackdrop";
    const modal = document.createElement("div");
    modal.className = "sd-modal sd-modal-report";
    modal.id = "sdReportModal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "sdReportTitle");
    modal.innerHTML =
      '<h3 id="sdReportTitle">Report channel issue</h3>' +
      '<p class="sd-report-hint" id="sdReportHint">Gathering audit snapshot…</p>' +
      '<div class="sd-report-meta" id="sdReportMeta"></div>' +
      '<div class="sd-report-shot-wrap">' +
      '<img id="sdReportShot" class="sd-report-shot" alt="Capture preview" hidden/>' +
      '<div class="sd-report-shot-status" id="sdReportShotStatus"></div></div>' +
      '<label class="sd-report-label">Categories</label>' +
      '<div class="sd-report-cats" id="sdReportCats"></div>' +
      '<div class="sd-report-grid">' +
      '<label class="sd-report-label">Severity' +
      '<select id="sdReportSeverity"></select></label>' +
      '<label class="sd-report-label">Ground-truth title' +
      '<input id="sdReportGroundTruth" type="text" maxlength="240" placeholder="Correct show / movie title" autocomplete="off"/></label>' +
      '</div>' +
      '<label class="sd-report-label">What\'s actually airing' +
      '<input id="sdReportAiring" type="text" maxlength="240" placeholder="What you see on the video right now" autocomplete="off"/></label>' +
      '<label class="sd-report-label">Notes' +
      '<textarea id="sdReportNotes" rows="3" maxlength="4000" placeholder="EPG mismatch, logo wrong, stuck buffering…"></textarea></label>' +
      '<label class="sd-report-check"><input type="checkbox" id="sdReportAttachAudit" checked/> Attach full audit JSON</label>' +
      '<label class="sd-report-check"><input type="checkbox" id="sdReportForce"/> Submit even if duplicate</label>' +
      '<div class="row">' +
      '<button type="button" class="primary" id="sdReportSubmit">Submit report</button>' +
      '<button type="button" id="sdReportRecapture">Recapture</button>' +
      '<button type="button" id="sdReportClose">Cancel</button></div>' +
      '<p class="sd-report-status" id="sdReportStatus" aria-live="polite"></p>';
    document.body.appendChild(bd);
    document.body.appendChild(modal);

    const cats = $("sdReportCats");
    CATEGORIES.forEach((c) => {
      const lab = document.createElement("label");
      lab.className = "sd-report-cat";
      lab.innerHTML =
        '<input type="checkbox" value="' +
        c.id +
        '"/> <span>' +
        c.label +
        "</span>";
      cats.appendChild(lab);
    });
    const sev = $("sdReportSeverity");
    SEVERITIES.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.label;
      if (s.id === "medium") opt.selected = true;
      sev.appendChild(opt);
    });

    bd.addEventListener("click", close);
    $("sdReportClose").addEventListener("click", close);
    $("sdReportSubmit").addEventListener("click", () => submitReport(false));
    $("sdReportRecapture").addEventListener("click", () => {
      captureScreenshot().then((shot) => {
        lastShot = shot;
        applyShot(shot);
      });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("open")) close();
    });
  }

  function selectedCategories() {
    return Array.from(document.querySelectorAll("#sdReportCats input:checked")).map(
      (el) => el.value
    );
  }

  function setStatus(msg, isErr) {
    const el = $("sdReportStatus");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("err", !!isErr);
  }

  function applyShot(shot) {
    const img = $("sdReportShot");
    const st = $("sdReportShotStatus");
    if (!img || !st) return;
    if (shot && shot.dataUrl) {
      img.src = shot.dataUrl;
      img.hidden = false;
      st.textContent =
        "Capture: " +
        (shot.source || "frame") +
        (shot.width ? " · " + shot.width + "×" + shot.height : "");
    } else {
      img.hidden = true;
      img.removeAttribute("src");
      st.textContent = "No screenshot (video frame unavailable — notes still help).";
    }
  }

  function renderMeta(ctx, audit) {
    const el = $("sdReportMeta");
    const hint = $("sdReportHint");
    if (!el) return;
    const id = (ctx && ctx.channel_id) || channelIdFromUrl() || "—";
    const name = (ctx && ctx.display_name) || "—";
    const tvg = (ctx && ctx.tvg_id) || (audit && audit.tvg_id) || "—";
    const nowT =
      (ctx && ctx.epg_now && (ctx.epg_now.title || ctx.epg_now.name)) ||
      (audit && audit.epg && audit.epg.now && audit.epg.now.title) ||
      "—";
    const nextT =
      (ctx && ctx.epg_next && (ctx.epg_next.title || ctx.epg_next.name)) ||
      (audit && audit.epg && audit.epg.next && audit.epg.next.title) ||
      "—";
    const play = (ctx && ctx.playback) || {};
    const ver = (audit && audit.bundle_version) || "—";
    if (hint) {
      hint.textContent =
        "Channel " + id + " · audit + capture ready. Pick categories and ground truth.";
    }
    el.innerHTML =
      "<div><b>Ch</b> " +
      escapeHtml(String(id)) +
      " · " +
      escapeHtml(String(name)) +
      "</div>" +
      "<div><b>tvg</b> " +
      escapeHtml(String(tvg)) +
      "</div>" +
      "<div><b>EPG now</b> " +
      escapeHtml(String(nowT)) +
      "</div>" +
      "<div><b>EPG next</b> " +
      escapeHtml(String(nextT)) +
      "</div>" +
      "<div><b>Playback</b> rs=" +
      escapeHtml(String(play.readyState != null ? play.readyState : "?")) +
      " · " +
      (play.paused ? "paused" : "playing") +
      (play.paint_dead ? " · paint-dead" : "") +
      " · " +
      escapeHtml(String(play.videoWidth || 0)) +
      "×" +
      escapeHtml(String(play.videoHeight || 0)) +
      "</div>" +
      "<div><b>Bundle</b> " +
      escapeHtml(String(ver)) +
      "</div>";
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function captureVideoFrame() {
    const v = $("v");
    if (!v || v.readyState < 2 || v.videoWidth < 2) return null;
    try {
      const scale = Math.min(1, MAX_SHOT_W / v.videoWidth);
      const w = Math.max(1, Math.round(v.videoWidth * scale));
      const h = Math.max(1, Math.round(v.videoHeight * scale));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(v, 0, 0, w, h);
      return {
        dataUrl: c.toDataURL("image/jpeg", 0.72),
        source: "video_frame",
        width: w,
        height: h,
      };
    } catch (e) {
      return null;
    }
  }

  async function captureGuideFallback() {
    // Lightweight: composite now-on-air + chrome text into a small canvas (no html2canvas dep).
    try {
      const now = $("nowOnAir");
      const text = (now && (now.innerText || now.textContent) || "").trim().slice(0, 220);
      if (!text) return null;
      const c = document.createElement("canvas");
      c.width = 480;
      c.height = 120;
      const ctx = c.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#0e1218";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = "#e8edf5";
      ctx.font = "600 16px system-ui,sans-serif";
      wrapText(ctx, text, 16, 36, 448, 22);
      ctx.fillStyle = "#9aa3b5";
      ctx.font = "500 12px system-ui,sans-serif";
      ctx.fillText("Guide strip capture · " + new Date().toISOString(), 16, 104);
      return {
        dataUrl: c.toDataURL("image/jpeg", 0.8),
        source: "guide_strip",
        width: c.width,
        height: c.height,
      };
    } catch (e) {
      return null;
    }
  }

  function wrapText(ctx, text, x, y, maxW, lineH) {
    const words = String(text).split(/\s+/);
    let line = "";
    let yy = y;
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = words[i];
        yy += lineH;
        if (yy > 80) break;
      } else {
        line = test;
      }
    }
    if (line && yy <= 88) ctx.fillText(line, x, yy);
  }

  async function captureScreenshot() {
    const frame = captureVideoFrame();
    if (frame) return frame;
    // Optional html2canvas if already on page
    try {
      if (typeof window.html2canvas === "function") {
        const target = document.querySelector(".tv-root") || document.body;
        const canvas = await window.html2canvas(target, {
          scale: 0.35,
          logging: false,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#0b0d12",
        });
        const scale = Math.min(1, MAX_SHOT_W / canvas.width);
        const w = Math.max(1, Math.round(canvas.width * scale));
        const h = Math.max(1, Math.round(canvas.height * scale));
        const out = document.createElement("canvas");
        out.width = w;
        out.height = h;
        out.getContext("2d").drawImage(canvas, 0, 0, w, h);
        return {
          dataUrl: out.toDataURL("image/jpeg", 0.7),
          source: "html2canvas",
          width: w,
          height: h,
        };
      }
    } catch (e) {}
    return await captureGuideFallback();
  }

  async function fetchJson(url) {
    try {
      const r = await fetch(url, { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) {
      return null;
    }
  }

  async function gatherAudit() {
    const ctx =
      typeof window.SDGetReportContext === "function" ? window.SDGetReportContext() : null;
    const channelId = (ctx && ctx.channel_id) || channelIdFromUrl();
    const health = await fetchJson("/health?lite=1");
    const bundle =
      (health && (health.bundle_version || health.version)) ||
      (document.querySelector('script[src*="player_bundle"]') || {}).src ||
      "";
    let match = null;
    let nowNext = null;
    let neighbors = null;
    let liveMeta = null;
    if (channelId) {
      const results = await Promise.all([
        fetchJson("/epg/match/" + encodeURIComponent(channelId)),
        fetchJson("/epg/now-next/" + encodeURIComponent(channelId)),
        fetchJson("/channels/neighbors/" + encodeURIComponent(channelId)),
        fetchJson("/live/" + encodeURIComponent(channelId) + "/meta"),
      ]);
      match = results[0];
      nowNext = results[1];
      neighbors = results[2];
      liveMeta = results[3];
    }

    const v = $("v");
    const playback = (ctx && ctx.playback) || {
      paused: !!(v && v.paused),
      readyState: v ? v.readyState : 0,
      videoWidth: v ? v.videoWidth : 0,
      videoHeight: v ? v.videoHeight : 0,
      muted: !!(v && v.muted),
      networkState: v ? v.networkState : 0,
    };

    const streamStatus = {
      live_meta_ok: !!(liveMeta && !liveMeta.error),
      dead: !!(liveMeta && liveMeta.dead),
      referer_host: liveMeta && liveMeta.referer_host ? String(liveMeta.referer_host) : null,
      proxy_mode: liveMeta && liveMeta.proxy_mode ? String(liveMeta.proxy_mode) : null,
      path_kind: channelId ? "/live/" + channelId + ".m3u8" : null,
    };

    const audit = {
      schema_hint: "channel-report-client-audit/1",
      gathered_at: new Date().toISOString(),
      gateway_base: location.origin,
      channel_id: channelId || null,
      display_name: (ctx && ctx.display_name) || (match && match.channel_name) || null,
      tvg_id:
        (ctx && ctx.tvg_id) ||
        (match && match.mapped_tvg_id) ||
        null,
      epg: {
        match_method: match && match.method,
        match_confidence: match && match.confidence,
        now: (ctx && ctx.epg_now) || (nowNext && nowNext.now) || null,
        next: (ctx && ctx.epg_next) || (nowNext && nowNext.next) || null,
        has_data: match ? !!match.epg_has_data : null,
      },
      stream: streamStatus,
      playback: playback,
      neighbors: neighbors
        ? {
            index: neighbors.index,
            number: neighbors.number,
            prev: neighbors.prev && neighbors.prev.id,
            next: neighbors.next && neighbors.next.id,
          }
        : null,
      bundle_version: typeof bundle === "string" ? bundle.replace(/^.*[?&]v=/, "").slice(0, 32) : null,
      health_bundle_version: health && health.bundle_version,
      theme: ctx && ctx.theme,
      guide_collapsed: ctx && ctx.guide_collapsed,
      path: location.pathname,
      href_host: location.host,
    };
    return { ctx, audit, channelId, health };
  }

  function guessCategoryDefaults(audit) {
    const boxes = document.querySelectorAll("#sdReportCats input");
    boxes.forEach((b) => {
      b.checked = false;
    });
    let pick = "other";
    try {
      if (audit && audit.playback && audit.playback.paint_dead) pick = "paint_death";
      else if (audit && audit.stream && audit.stream.dead) pick = "playback";
      else if (audit && audit.epg && audit.epg.now) pick = "epg_mismatch";
    } catch (e) {}
    boxes.forEach((b) => {
      if (b.value === pick) b.checked = true;
    });
  }

  async function open() {
    ensureUi();
    const modal = $("sdReportModal");
    const bd = $("sdReportBackdrop");
    if (!modal || !bd) return;
    setStatus("");
    $("sdReportNotes").value = "";
    $("sdReportGroundTruth").value = "";
    $("sdReportAiring").value = "";
    $("sdReportForce").checked = false;
    $("sdReportAttachAudit").checked = true;
    $("sdReportSeverity").value = "medium";
    lastAudit = null;
    lastShot = null;
    applyShot(null);
    renderMeta(null, null);
    bd.classList.add("open");
    modal.classList.add("open");

    try {
      const gathered = await gatherAudit();
      lastAudit = gathered;
      renderMeta(gathered.ctx, gathered.audit);
      guessCategoryDefaults(gathered.audit);
      // Prefill airing from EPG now as a starting point (user edits to ground truth).
      const nowT =
        (gathered.ctx && gathered.ctx.epg_now && (gathered.ctx.epg_now.title || gathered.ctx.epg_now.name)) ||
        (gathered.audit && gathered.audit.epg && gathered.audit.epg.now && gathered.audit.epg.now.title) ||
        "";
      if (nowT && !$("sdReportAiring").value) {
        // Leave airing empty — user should type what they *see*; put EPG in placeholder.
        $("sdReportAiring").placeholder = "EPG says: " + String(nowT).slice(0, 80);
      }
    } catch (e) {
      setStatus("Audit gather partial — you can still submit notes.", true);
    }

    try {
      lastShot = await captureScreenshot();
      applyShot(lastShot);
    } catch (e) {
      applyShot(null);
    }

    setTimeout(() => {
      try {
        $("sdReportGroundTruth").focus();
      } catch (e) {}
    }, 50);
  }

  function close() {
    const modal = $("sdReportModal");
    const bd = $("sdReportBackdrop");
    if (modal) modal.classList.remove("open");
    if (bd) bd.classList.remove("open");
  }

  async function submitReport(forceFlag) {
    if (submitting) return;
    ensureUi();
    const cats = selectedCategories();
    if (!cats.length) {
      setStatus("Select at least one category.", true);
      return;
    }
    const severity = $("sdReportSeverity").value || "medium";
    const gt = ($("sdReportGroundTruth").value || "").trim();
    const airing = ($("sdReportAiring").value || "").trim();
    const notes = ($("sdReportNotes").value || "").trim();
    const force = forceFlag || ($("sdReportForce") && $("sdReportForce").checked);
    const attach = !($("sdReportAttachAudit") && !$("sdReportAttachAudit").checked);

    let gathered = lastAudit;
    if (!gathered) {
      try {
        gathered = await gatherAudit();
        lastAudit = gathered;
      } catch (e) {
        gathered = { ctx: null, audit: {}, channelId: channelIdFromUrl() };
      }
    }
    const channelId = gathered.channelId || channelIdFromUrl();
    if (!channelId) {
      setStatus("No channel id — tune a channel first.", true);
      return;
    }

    const dupKey = localDupKey(channelId, cats, gt || airing, severity);
    if (!force && isLocalDup(dupKey)) {
      setStatus("Duplicate suppressed locally (same channel/category in last 15m). Check “Submit even if duplicate” to force.", true);
      return;
    }

    if (!lastShot) {
      try {
        lastShot = await captureScreenshot();
        applyShot(lastShot);
      } catch (e) {}
    }

    const payload = {
      channel_id: channelId,
      channel_name:
        (gathered.ctx && gathered.ctx.display_name) ||
        (gathered.audit && gathered.audit.display_name) ||
        null,
      categories: cats,
      severity: severity,
      ground_truth_title: gt || null,
      actually_airing: airing || null,
      notes: notes || null,
      bundle_version:
        (gathered.audit && gathered.audit.health_bundle_version) ||
        (gathered.audit && gathered.audit.bundle_version) ||
        null,
      client_reported_at: new Date().toISOString(),
      client: {
        user_agent: navigator.userAgent || "",
        platform: navigator.platform || "",
        language: navigator.language || "",
        timezone: (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || null,
        online: navigator.onLine,
        viewport: {
          w: window.innerWidth || 0,
          h: window.innerHeight || 0,
          dpr: window.devicePixelRatio || 1,
        },
      },
      force: !!force,
      screenshot: lastShot && lastShot.dataUrl ? lastShot.dataUrl : null,
      audit: attach ? gathered.audit : { channel_id: channelId, stripped: true },
    };

    submitting = true;
    setStatus("Submitting…");
    const btn = $("sdReportSubmit");
    if (btn) btn.disabled = true;
    try {
      const r = await fetch("/api/channel-reports", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let data = null;
      try {
        data = await r.json();
      } catch (e) {
        data = null;
      }
      if (!r.ok || !data || !data.ok) {
        setStatus(
          "Submit failed" + (data && data.error ? ": " + data.error : " (" + r.status + ")"),
          true
        );
        return;
      }
      markLocalDup(dupKey);
      if (data.duplicate) {
        setStatus("Duplicate on server — earlier report " + (data.id || "") + " still counts.", false);
        toast("Report already on file");
      } else {
        setStatus("Submitted · " + (data.id || "ok"), false);
        toast("Report submitted");
        setTimeout(close, 700);
      }
    } catch (e) {
      setStatus("Network error submitting report.", true);
    } finally {
      submitting = false;
      if (btn) btn.disabled = false;
    }
  }

  window.SDReport = {
    open,
    close,
    gatherAudit,
    captureScreenshot,
  };
})();
