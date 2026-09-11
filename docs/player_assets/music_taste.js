/**
 * StepDaddy Music — device-local taste / predictive ranking (privacy-safe).
 * Signals: plays, completes, skips, likes, follows, entry path, temporal,
 * co-occurrence, genre/era. No cloud upload.
 * API: window.SDMusicTaste
 */
(function () {
  if (window.SDMusicTaste) return;

  var LS = "sd_music_taste_v1";
  var LS_FAV = "sd_music_radio_favs";
  var LS_FAV_META = "sd_music_fav_meta_v1";
  var MAX_RECENT = 48;
  var MAX_LIKES = 80;
  var MAX_SEARCH = 40;
  var MAX_KEYS = 200;
  var MAX_COOCCUR = 240;
  var MAX_TEMPORAL = 160;
  var MAX_ENTRY = 40;

  function now() {
    return Date.now();
  }

  function empty() {
    return {
      v: 2,
      plays: {},
      completes: {},
      skips: {},
      recent: [],
      searches: [],
      genres: {},
      artists: {},
      years: {},
      entryPaths: {},
      temporal: {},
      cooccur: {},
      lastPlayedKey: "",
      updated: 0,
    };
  }

  function read() {
    try {
      var raw = JSON.parse(localStorage.getItem(LS) || "null");
      if (!raw || typeof raw !== "object") return empty();
      raw.plays = raw.plays || {};
      raw.completes = raw.completes || {};
      raw.skips = raw.skips || {};
      raw.recent = Array.isArray(raw.recent) ? raw.recent : [];
      raw.searches = Array.isArray(raw.searches) ? raw.searches : [];
      raw.genres = raw.genres || {};
      raw.artists = raw.artists || {};
      raw.years = raw.years || {};
      raw.entryPaths = raw.entryPaths || {};
      raw.temporal = raw.temporal || {};
      raw.cooccur = raw.cooccur || {};
      raw.lastPlayedKey = raw.lastPlayedKey || "";
      raw.v = Math.max(2, raw.v || 1);
      return raw;
    } catch (e) {
      return empty();
    }
  }

  function write(data) {
    try {
      data.updated = now();
      localStorage.setItem(LS, JSON.stringify(data));
    } catch (e) {}
  }

  function trimMap(map, max) {
    var keys = Object.keys(map || {});
    if (keys.length <= max) return map;
    keys.sort(function (a, b) {
      var aa = map[a] || {};
      var bb = map[b] || {};
      return (bb.last || 0) - (aa.last || 0);
    });
    var out = {};
    keys.slice(0, max).forEach(function (k) {
      out[k] = map[k];
    });
    return out;
  }

  function bump(map, key, weight) {
    if (!key) return;
    var k = String(key).slice(0, 120);
    var cur = map[k] || { n: 0, last: 0, w: 0 };
    cur.n = (cur.n || 0) + 1;
    cur.w = (cur.w || 0) + (weight || 1);
    cur.last = now();
    map[k] = cur;
  }

  function itemKey(item) {
    if (!item) return "";
    if (item.source === "radio" || item.kind === "station") {
      return "r:" + (item.id || item.stationuuid || "");
    }
    return "l:" + (item.id || item.videoId || item.browseId || item.playlistId || "");
  }

  function normalizeEntryPath(p) {
    p = String(p || "").toLowerCase().trim();
    if (!p) return "";
    if (/album/.test(p)) return "album";
    if (/artist/.test(p)) return "artist";
    if (/director|tracks-dir|videos-dir|directory/.test(p)) return "directory";
    if (/search/.test(p)) return "search";
    if (/home|made|shelf/.test(p)) return "home";
    if (/library|liked|playlist/.test(p)) return "library";
    if (/watch|share/.test(p)) return "watch";
    if (/radio/.test(p)) return "radio";
    return p.slice(0, 24);
  }

  function temporalBucket(ts) {
    var d = new Date(ts || now());
    return d.getDay() + ":" + d.getHours();
  }

  function monthKey(ts) {
    var d = new Date(ts || now());
    return String(d.getMonth() + 1);
  }

  function normalizeItem(item) {
    if (!item) return null;
    var source = item.source || (item.stationuuid || item.kind === "station" ? "radio" : "listen");
    var id = item.id || item.stationuuid || item.videoId || item.browseId || item.playlistId || "";
    if (!id) return null;
    var year = item.year || item.releaseYear || "";
    if (year) year = String(year).slice(0, 4);
    return {
      source: source,
      kind: item.kind || (source === "radio" ? "station" : item.videoId ? "song" : "item"),
      id: String(id),
      title: item.title || item.display_name || item.name || "Untitled",
      subtitle: item.subtitle || item.artists || item.uploader || item.genre || "",
      artwork: item.artwork || item.thumb || item.favicon || "",
      genre: item.genre || "",
      artist: item.artist || (Array.isArray(item.artists) ? item.artists.join(", ") : "") || "",
      year: year,
      entryPath: normalizeEntryPath(item.entryPath || item.surface || item.sourceType || ""),
      streamUrl: item.streamUrl || item.stream_url || "",
      station: item.station || (source === "radio" ? item : null),
      videoId: item.videoId || (source === "listen" ? id : ""),
      ts: now(),
    };
  }

  function pushRecent(data, item) {
    var norm = normalizeItem(item);
    if (!norm) return;
    var key = itemKey(norm);
    data.recent = [norm].concat(
      data.recent.filter(function (r) {
        return itemKey(r) !== key;
      })
    ).slice(0, MAX_RECENT);
  }

  function readFavIds() {
    try {
      var raw = JSON.parse(localStorage.getItem(LS_FAV) || "[]");
      return Array.isArray(raw) ? raw.map(String) : [];
    } catch (e) {
      return [];
    }
  }

  function readFavMeta() {
    try {
      var raw = JSON.parse(localStorage.getItem(LS_FAV_META) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch (e) {
      return {};
    }
  }

  function writeFavMeta(meta) {
    try {
      localStorage.setItem(LS_FAV_META, JSON.stringify(meta));
    } catch (e) {}
  }

  function recordCooccur(data, prevKey, nextKey) {
    if (!prevKey || !nextKey || prevKey === nextKey) return;
    var a = prevKey < nextKey ? prevKey : nextKey;
    var b = prevKey < nextKey ? nextKey : prevKey;
    bump(data.cooccur, a + ">" + b, 1);
  }

  function recordPlay(item) {
    var data = read();
    var norm = normalizeItem(item);
    if (!norm) return;
    var key = itemKey(norm);
    bump(data.plays, key, 1);
    if (norm.genre) bump(data.genres, String(norm.genre).toLowerCase(), 1.2);
    if (norm.artist) bump(data.artists, String(norm.artist).toLowerCase(), 1.4);
    if (norm.year) bump(data.years, norm.year, 1);
    if (norm.entryPath) bump(data.entryPaths, norm.entryPath, 1.1);
    // Temporal affinity for this track + artist
    var tb = temporalBucket();
    bump(data.temporal, key + "@" + tb, 1.2);
    bump(data.temporal, "all@" + tb, 0.4);
    bump(data.temporal, "m:" + monthKey(), 0.3);
    if (norm.artist) bump(data.temporal, "a:" + String(norm.artist).toLowerCase().slice(0, 60) + "@" + tb, 0.8);
    if (data.lastPlayedKey) recordCooccur(data, data.lastPlayedKey, key);
    data.lastPlayedKey = key;
    pushRecent(data, norm);
    data.plays = trimMap(data.plays, MAX_KEYS);
    data.genres = trimMap(data.genres, 80);
    data.artists = trimMap(data.artists, 80);
    data.years = trimMap(data.years, 40);
    data.entryPaths = trimMap(data.entryPaths, MAX_ENTRY);
    data.temporal = trimMap(data.temporal, MAX_TEMPORAL);
    data.cooccur = trimMap(data.cooccur, MAX_COOCCUR);
    write(data);
  }

  function recordComplete(item) {
    var data = read();
    var norm = normalizeItem(item);
    if (!norm) return;
    bump(data.completes, itemKey(norm), 2);
    data.completes = trimMap(data.completes, MAX_KEYS);
    write(data);
  }

  function recordSkip(item) {
    var data = read();
    var norm = normalizeItem(item);
    if (!norm) return;
    bump(data.skips, itemKey(norm), 1);
    data.skips = trimMap(data.skips, MAX_KEYS);
    write(data);
  }

  /** Cheap dwell/attention: fraction listened (0–1) or seconds. */
  function recordDwell(item, fracOrSec) {
    var data = read();
    var norm = normalizeItem(item);
    if (!norm) return;
    var key = itemKey(norm);
    var v = Number(fracOrSec);
    if (!isFinite(v) || v <= 0) return;
    // Treat values > 1 as seconds → soft weight; else completion-ish fraction.
    var w = v > 1 ? Math.min(2.5, v / 90) : Math.min(2.2, v * 2);
    bump(data.plays, key, w * 0.35);
    data.plays = trimMap(data.plays, MAX_KEYS);
    write(data);
  }

  function recordSearch(q) {
    var query = String(q || "").trim().slice(0, 80);
    if (!query) return;
    var data = read();
    data.searches = [{ q: query, ts: now() }].concat(
      data.searches.filter(function (s) {
        return s && s.q !== query;
      })
    ).slice(0, MAX_SEARCH);
    bump(data.entryPaths, "search", 0.6);
    data.entryPaths = trimMap(data.entryPaths, MAX_ENTRY);
    write(data);
  }

  function recordEntry(path) {
    var p = normalizeEntryPath(path);
    if (!p) return;
    var data = read();
    bump(data.entryPaths, p, 0.8);
    data.entryPaths = trimMap(data.entryPaths, MAX_ENTRY);
    write(data);
  }

  function recordLike(item, liked) {
    var norm = normalizeItem(item);
    if (!norm) return;
    var meta = readFavMeta();
    var id = String(norm.id);
    var already = readFavIds().indexOf(id) >= 0;
    if (liked) {
      meta[id] = norm;
      var keys = Object.keys(meta);
      if (keys.length > MAX_LIKES) {
        keys
          .sort(function (a, b) {
            return (meta[b].ts || 0) - (meta[a].ts || 0);
          })
          .slice(MAX_LIKES)
          .forEach(function (k) {
            delete meta[k];
          });
      }
      // Keep id list in sync so rankItems liked[] boost applies (not meta-only).
      try {
        var favs = readFavIds();
        if (favs.indexOf(id) < 0) favs.unshift(id);
        localStorage.setItem(LS_FAV, JSON.stringify(favs.slice(0, MAX_LIKES)));
      } catch (e) {}
      // Likes alone must teach artist/genre soft-ranking (Home / Smart Shuffle / Autoplay).
      // Idempotent: skip weight bumps if this id was already liked (UI heart + library bridge).
      if (!already) {
        try {
          var data = read();
          artistTokens(norm).forEach(function (tok) {
            bump(data.artists, tok, 2.2);
          });
          if (norm.genre) bump(data.genres, String(norm.genre).toLowerCase(), 1.8);
          if (norm.year) bump(data.years, norm.year, 0.8);
          if (norm.entryPath) bump(data.entryPaths, norm.entryPath, 0.6);
          data.artists = trimMap(data.artists, 80);
          data.genres = trimMap(data.genres, 80);
          data.years = trimMap(data.years, 40);
          data.entryPaths = trimMap(data.entryPaths, MAX_ENTRY);
          write(data);
        } catch (e2) {}
      }
    } else {
      delete meta[id];
      try {
        var favs2 = readFavIds().filter(function (x) {
          return String(x) !== id;
        });
        localStorage.setItem(LS_FAV, JSON.stringify(favs2));
      } catch (e) {}
      if (already) {
        try {
          var data2 = read();
          artistTokens(norm).forEach(function (tok) {
            if (data2.artists && data2.artists[tok]) {
              data2.artists[tok].w = Math.max(0, (data2.artists[tok].w || 0) - 2.2);
              if ((data2.artists[tok].w || 0) <= 0 && (data2.artists[tok].n || 0) <= 1) {
                delete data2.artists[tok];
              }
            }
          });
          write(data2);
        } catch (e3) {}
      }
    }
    writeFavMeta(meta);
  }

  /** Persist artist follow signal into local taste weights (and fav meta). */
  function recordFollow(artist, following) {
    var name =
      (artist && (artist.title || artist.name || artist.artist)) ||
      "";
    name = String(name || "").trim();
    if (!name) return;
    var data = read();
    var key = name.toLowerCase();
    if (following === false) {
      if (data.artists && data.artists[key]) {
        data.artists[key].w = Math.max(0, (data.artists[key].w || 0) - 2);
        if ((data.artists[key].w || 0) <= 0 && (data.artists[key].n || 0) <= 0) {
          delete data.artists[key];
        }
        write(data);
      }
    } else {
      bump(data.artists, key, 2.5);
      data.artists = trimMap(data.artists, 80);
      write(data);
    }
    recordLike(
      {
        id: "artist:" + ((artist && (artist.browseId || artist.channelId || artist.id)) || key),
        title: name,
        artist: name,
        kind: "artist",
        browseId: (artist && (artist.browseId || artist.channelId)) || "",
        thumb: (artist && (artist.thumb || artist.artwork)) || "",
      },
      following !== false
    );
  }

  function scoreKey(data, key) {
    var p = data.plays[key] || {};
    var c = data.completes[key] || {};
    var s = data.skips[key] || {};
    // No personal history for this key → 0 (cold-start defaults handle ordering).
    if (!(p.n || c.n || s.n || p.w || c.w || s.w)) return 0;
    var recency = Math.max(p.last || 0, c.last || 0, s.last || 0);
    var ageH = recency ? (now() - recency) / 3600000 : 999;
    var recencyBoost = ageH < 24 ? 3 : ageH < 168 ? 1.5 : ageH < 720 ? 0.6 : 0.15;
    return (p.n || 0) * 1.2 + (c.n || 0) * 2.5 + (p.w || 0) * 0.2 - (s.n || 0) * 1.8 + recencyBoost;
  }

  /** Stable 0..1 noise so equal taste scores don't preserve input order (Smart ≠ Off). */
  function rankNoise(key, idx) {
    var s = String(key || "x") + "#" + String(idx || 0);
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 1000) / 1000;
  }

  function artistTokens(norm) {
    var raw = String((norm && (norm.artist || norm.subtitle)) || "").toLowerCase();
    return raw
      .split(/[,&/|]+/)
      .map(function (x) {
        return x.trim();
      })
      .filter(function (x) {
        return x.length >= 2;
      });
  }

  function parseYear(norm, it) {
    var y = (norm && norm.year) || (it && (it.year || it.releaseYear)) || "";
    y = parseInt(String(y).slice(0, 4), 10);
    return isFinite(y) && y > 1900 && y < 2100 ? y : 0;
  }

  /**
   * Soft popularity / chart bias from common item fields (YTM / Radio Browser).
   * Missing → mild mid-list prior so unknown tracks aren't zeroed out.
   */
  function popularityBoost(it, norm) {
    var raw = null;
    if (it) {
      if (it.popularity != null) raw = it.popularity;
      else if (it.viewCount != null) raw = it.viewCount;
      else if (it.views != null) raw = it.views;
      else if (it.listeners != null) raw = it.listeners;
      else if (it.votes != null) raw = it.votes;
      else if (it.score != null) raw = it.score;
    }
    if (raw == null && it && it.subtitle) {
      var m = String(it.subtitle).match(/([\d,.]+)\s*(k|m|b)?\s*(view|play|listen|vote)/i);
      if (m) {
        var n = parseFloat(m[1].replace(/,/g, ""));
        if (isFinite(n)) {
          var mul = { k: 1e3, m: 1e6, b: 1e9 }[String(m[2] || "").toLowerCase()] || 1;
          raw = n * mul;
        }
      }
    }
    if (raw == null || !isFinite(Number(raw))) return 0.35;
    var v = Number(raw);
    if (v <= 1 && v >= 0) return v * 2.2; // already 0–1 popularity
    // log compress large view/listen counts
    return Math.min(2.4, Math.log10(Math.max(10, v)) / 3.2);
  }

  /**
   * Cold-start / gap-fill defaults (empty or thin taste profile):
   * 1) Prefer same artist ecosystem as seed/now
   * 2) Prefer same genre + nearby era (±6y) of seeds
   * 3) Soft popularity / chart bias
   * 4) Avoid immediate repeats (recent / lastPlayed / avoidKeys)
   * 5) Light time-of-day bias (night → older years; day → popular)
   * Documented here; applied via coldStartBoost + recentPenalty + rankNoise.
   */
  function coldStartBoost(it, norm, seedNorms, scale) {
    scale = scale == null ? 1 : scale;
    if (!scale) return 0;
    var s = 0;
    var seeds = seedNorms || [];
    var toks = artistTokens(norm);
    var year = parseYear(norm, it);
    var genre = String((norm && norm.genre) || (it && it.genre) || "").toLowerCase();

    seeds.forEach(function (seed) {
      if (!seed) return;
      var st = artistTokens(seed);
      st.forEach(function (a) {
        toks.forEach(function (b) {
          if (a === b || (a.length >= 4 && b.indexOf(a) >= 0) || (b.length >= 4 && a.indexOf(b) >= 0)) {
            s += 2.4;
          }
        });
      });
      // Same artistId / channel when present on raw items
      if (it && seed._rawArtistId && it.artistId && String(it.artistId) === String(seed._rawArtistId)) {
        s += 2.8;
      }
      var sg = String(seed.genre || "").toLowerCase();
      if (genre && sg && (genre === sg || genre.indexOf(sg) >= 0 || sg.indexOf(genre) >= 0)) s += 1.6;
      var sy = parseYear(seed, null);
      if (year && sy) {
        var d = Math.abs(year - sy);
        if (d === 0) s += 1.4;
        else if (d <= 3) s += 1.0;
        else if (d <= 6) s += 0.55;
        else if (d <= 12) s += 0.2;
      }
    });

    s += popularityBoost(it, norm) * 0.85;

    // Light time-of-day prior (no personal temporal history required).
    var hour = new Date().getHours();
    var night = hour >= 22 || hour < 6;
    if (night) {
      if (year && year < 2012) s += 0.45;
      else if (year && year >= 2020) s -= 0.15;
    } else if (hour >= 7 && hour < 18) {
      s += popularityBoost(it, norm) * 0.25;
    }

    return Math.min(6.5, s) * scale;
  }

  function recentPenalty(data, key, opts) {
    if (!key) return 0;
    var smart = !!(opts && opts.smartShuffle);
    var pen = 0;
    if (data.lastPlayedKey === key) pen = Math.max(pen, smart ? 12 : 4.2);
    var avoid = opts && opts.avoidKeys;
    if (avoid) {
      var hit = false;
      if (typeof avoid.indexOf === "function") hit = avoid.indexOf(key) >= 0;
      else if (avoid[key]) hit = true;
      if (hit) pen = Math.max(pen, smart ? 7.5 : 3.6);
    }
    var recent = data.recent || [];
    for (var i = 0; i < Math.min(recent.length, 14); i++) {
      if (itemKey(recent[i]) === key) {
        var base = (smart ? 6.2 : 3.4) - i * (smart ? 0.35 : 0.18);
        pen = Math.max(pen, Math.max(0.8, base));
        break;
      }
    }
    return pen;
  }

  function temporalBoost(data, key, artist) {
    var tb = temporalBucket();
    var s = 0;
    var hit = data.temporal[key + "@" + tb];
    if (hit) s += Math.min(2.2, (hit.n || 0) * 0.55 + (hit.w || 0) * 0.15);
    if (artist) {
      var ak = "a:" + String(artist).toLowerCase().slice(0, 60) + "@" + tb;
      var ah = data.temporal[ak];
      if (ah) s += Math.min(1.6, (ah.n || 0) * 0.35);
    }
    var month = data.temporal["m:" + monthKey()];
    if (month) s += Math.min(0.4, (month.n || 0) * 0.05);
    return s;
  }

  function cooccurBoost(data, key, seedKeys) {
    if (!key || !seedKeys || !seedKeys.length) return 0;
    var s = 0;
    seedKeys.forEach(function (seed) {
      if (!seed || seed === key) return;
      var a = seed < key ? seed : key;
      var b = seed < key ? key : seed;
      var hit = data.cooccur[a + ">" + b];
      if (hit) s += Math.min(1.8, (hit.n || 0) * 0.45);
    });
    return Math.min(3, s);
  }

  function hasSignal(data) {
    return (
      (data.recent && data.recent.length >= 2) ||
      Object.keys(data.plays || {}).length >= 3 ||
      readFavIds().length >= 1
    );
  }

  function topGenres(data, n) {
    return Object.keys(data.genres || {})
      .map(function (g) {
        return { name: g, score: (data.genres[g].w || 0) + (data.genres[g].n || 0) };
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .slice(0, n || 5);
  }

  function topArtists(data, n) {
    return Object.keys(data.artists || {})
      .map(function (a) {
        return { name: a, score: (data.artists[a].w || 0) + (data.artists[a].n || 0) * 1.2 };
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .slice(0, n || 8);
  }

  function dedupeItems(items) {
    var seen = {};
    var out = [];
    (items || []).forEach(function (it) {
      var k = itemKey(it) || itemKey(normalizeItem(it));
      if (!k) {
        out.push(it);
        return;
      }
      if (seen[k]) return;
      seen[k] = true;
      out.push(it);
    });
    return out;
  }

  /**
   * Rank candidates. opts:
   *  - entryPath: soft-boost paths that match habitual entry
   *  - seedKeys / seedItems: co-occurrence + cold-start artist/genre/era anchors
   *  - contextBias: 0–1 strength for temporal/entry (default 1)
   *  - softBoost: smaller effect (Home / search)
   *  - smartShuffle: stronger cold-start + rank noise (Smart Shuffle path)
   *  - avoidKeys: extra immediate-repeat penalties
   *
   * Learning (when history exists): skips down-rank via scoreKey; completes/likes
   * up-rank; co-occurrence + entry path + temporal boost. Cold start still applies
   * as a gap-fill prior so Smart Shuffle never collapses to Off/plain Shuffle.
   */
  function rankItems(items, opts) {
    opts = opts || {};
    var data = read();
    var liked = {};
    readFavIds().forEach(function (id) {
      liked[String(id)] = true;
    });
    var seedKeys = (opts.seedKeys || []).slice();
    var seedNorms = [];
    (opts.seedItems || []).forEach(function (it) {
      var norm = normalizeItem(it) || it;
      var k = itemKey(norm);
      if (k) seedKeys.push(k);
      if (norm) {
        if (it && (it.artistId || (it.artistIds && it.artistIds[0]))) {
          norm._rawArtistId = it.artistId || it.artistIds[0];
        }
        seedNorms.push(norm);
      }
    });
    if (!seedKeys.length && data.lastPlayedKey) seedKeys.push(data.lastPlayedKey);
    (data.recent || []).slice(0, 6).forEach(function (r) {
      var k = itemKey(r);
      if (k) seedKeys.push(k);
      if (r && !seedNorms.length) seedNorms.push(r);
    });
    var entry = normalizeEntryPath(opts.entryPath || "");
    var bias = opts.contextBias == null ? 1 : Number(opts.contextBias);
    if (opts.softBoost) bias *= 0.55;
    if (!isFinite(bias)) bias = 1;
    var signaled = hasSignal(data);
    // Full cold-start prior when empty; softer gap-fill when taste already exists.
    var coldScale = opts.smartShuffle ? (signaled ? 0.55 : 1.15) : signaled ? 0.35 : 1.0;
    if (opts.softBoost) coldScale *= 0.65;
    var noiseAmp = opts.smartShuffle ? 0.55 : 0.22;

    var ranked = dedupeItems(items || [])
      .map(function (it, idx) {
        var norm = normalizeItem(it) || it;
        var key = itemKey(norm);
        var base = scoreKey(data, key);
        if (liked[String(norm.id)]) base += 4;
        if (norm.genre) {
          var g = data.genres[String(norm.genre).toLowerCase()];
          if (g) base += Math.min(3, (g.n || 0) * 0.4);
        }
        if (norm.year) {
          var y = data.years[String(norm.year)];
          if (y) base += Math.min(1.8, (y.n || 0) * 0.35);
        }
        if (norm.artist || norm.subtitle) {
          var a = String(norm.artist || norm.subtitle).toLowerCase();
          Object.keys(data.artists || {}).forEach(function (ak) {
            if (a.indexOf(ak) >= 0) base += Math.min(2.5, (data.artists[ak].n || 0) * 0.35);
          });
        }
        base += temporalBoost(data, key, norm.artist || "") * bias;
        base += cooccurBoost(data, key, seedKeys) * bias;
        if (entry) {
          var ep = data.entryPaths[entry];
          if (ep) base += Math.min(1.4, ((ep.n || 0) * 0.15 + (ep.w || 0) * 0.05)) * bias;
          // Prefer candidates that themselves came from matching surfaces when tagged
          if (norm.entryPath && norm.entryPath === entry) base += 0.6 * bias;
        }
        base += coldStartBoost(it, norm, seedNorms, coldScale);
        base -= recentPenalty(data, key, opts);
        // Tie-break noise: Smart Shuffle must not equal Straight Off input order.
        base += rankNoise(key, idx) * noiseAmp;
        return { item: it, score: base - idx * 0.002 };
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .map(function (x) {
        return x.item;
      });
    return ranked;
  }

  function getRecent(limit) {
    return dedupeItems(read().recent).slice(0, limit || 24);
  }

  function getLikes(limit) {
    var ids = readFavIds();
    var meta = readFavMeta();
    var out = [];
    ids.forEach(function (id) {
      if (meta[id]) out.push(meta[id]);
      else out.push({ id: id, title: id, source: "radio", kind: "station" });
    });
    return out.slice(0, limit || 24);
  }

  function shelfOrder(coldStart) {
    // `library` = compact Library strip; `near` = Radio; `recent` = Your music.
    var data = read();
    if (coldStart || !hasSignal(data)) {
      return ["library", "hero", "near", "artists", "trending", "featured", "moods"];
    }
    var recentN = (data.recent && data.recent.length) || 0;
    var playN = Object.keys(data.plays || {}).length;
    var artistN = Object.keys(data.artists || {}).length;
    var likeN = 0;
    try {
      likeN = readFavIds().length;
    } catch (e) {}
    var hour = new Date().getHours();
    var night = hour >= 22 || hour < 6;
    if (recentN >= 8 || playN >= 10 || likeN >= 4 || artistN >= 4) {
      // Night → softer discovery; day → made-for-you earlier.
      if (night) return ["library", "hero", "recent", "artists", "made", "near", "trending", "featured", "moods"];
      return ["library", "hero", "recent", "made", "artists", "near", "trending", "featured", "moods"];
    }
    return ["library", "hero", "recent", "near", "artists", "made", "trending", "featured", "moods"];
  }

  function predictContext() {
    var data = read();
    return {
      temporalBucket: temporalBucket(),
      month: monthKey(),
      topEntry: Object.keys(data.entryPaths || {})
        .map(function (k) {
          return { path: k, n: (data.entryPaths[k] || {}).n || 0 };
        })
        .sort(function (a, b) {
          return b.n - a.n;
        })
        .slice(0, 5),
      topArtists: topArtists(data, 5),
      topGenres: topGenres(data, 5),
    };
  }

  window.SDMusicTaste = {
    read: read,
    recordPlay: recordPlay,
    recordComplete: recordComplete,
    recordSkip: recordSkip,
    recordDwell: recordDwell,
    recordSearch: recordSearch,
    recordEntry: recordEntry,
    recordLike: recordLike,
    recordFollow: recordFollow,
    getRecent: getRecent,
    getLikes: getLikes,
    rankItems: rankItems,
    dedupeItems: dedupeItems,
    itemKey: itemKey,
    normalizeEntryPath: normalizeEntryPath,
    hasSignal: function () {
      return hasSignal(read());
    },
    topGenres: function (n) {
      return topGenres(read(), n);
    },
    topArtists: function (n) {
      return topArtists(read(), n);
    },
    shelfOrder: shelfOrder,
    predictContext: predictContext,
    scoreKey: function (key) {
      return scoreKey(read(), key);
    },
  };
})();
