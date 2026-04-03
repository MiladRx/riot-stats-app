import express from "express";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.RIOT_API_KEY) {
  console.error("❌ RIOT_API_KEY not set");
  process.exit(1);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- Imports ---
import { FULL_SQUAD, CACHE_DURATION, AUTO_FETCH_INTERVAL, CURRENT_SEASON, SEASONS } from "./server/config.js";
import { loadSeasonCache, getSeasonCacheSummary } from "./server/season-cache.js";
import { fetchJob, runFetch } from "./server/fetch-engine.js";
import { loadDDragon, ddragonVersion, getPlayerStats } from "./server/player-stats.js";
import { buildLineups } from "./server/clash.js";

loadDDragon();

// --- Squad Cache ---
let cachedSquadData = null;
let lastFetchTime = 0;
let scheduleReloadAt = null;

function invalidateSquadCache() {
  setTimeout(() => {
    console.log("🔄 Auto-reloading squad cache (2 min after deep fetch)...");
    cachedSquadData = null;
    lastFetchTime = 0;
    scheduleReloadAt = Date.now() + 2 * 60 * 1000;
  }, 2 * 60 * 1000);
}

// --- Routes ---
app.get("/stats", async (req, res) => {
  const { gameName = "adam1276", tagLine = "EUNE" } = req.query;
  try { res.json(await getPlayerStats(gameName, tagLine)); }
  catch (err) { res.status(err.status ?? 500).json({ error: err.message }); }
});

app.get("/squad", async (req, res) => {
  const now = Date.now();
  if (cachedSquadData && (now - lastFetchTime < CACHE_DURATION)) {
    console.log("⚡ Serving squad data from cache...");
    return res.json({ players: cachedSquadData, cachedAt: lastFetchTime, expiresAt: lastFetchTime + CACHE_DURATION, ddragonVersion });
  }

  console.log("🔄 Fetching fresh squad data...");
  const results = [];
  for (const p of FULL_SQUAD) {
    try {
      console.log(`Fetching data for ${p.gameName}...`);
      const data = await getPlayerStats(p.gameName, p.tagLine);
      results.push({ status: "fulfilled", value: data });
    } catch (err) {
      console.log(`❌ Failed to fetch ${p.gameName}: ${err.message}`);
      results.push({ status: "rejected", reason: err });
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  const squad = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return { gameName: FULL_SQUAD[i].gameName, tagLine: FULL_SQUAD[i].tagLine, error: r.reason?.message ?? "Unknown error", status: r.reason?.status ?? 500 };
  });

  squad.sort((a, b) => (b.solo?.sortScore ?? -1) - (a.solo?.sortScore ?? -1));
  cachedSquadData = squad;
  lastFetchTime = Date.now();
  console.log("✅ Squad data updated and cached!");

  res.json({ players: cachedSquadData, cachedAt: lastFetchTime, expiresAt: lastFetchTime + CACHE_DURATION, ddragonVersion });
});

// --- Unified Fetch API ---
app.post("/fetch", (req, res) => {
  if (fetchJob.running) return res.json({ status: "already_running", season: fetchJob.season, mode: fetchJob.mode });

  const { season = CURRENT_SEASON, mode = "solo", players: playerNames } = req.body || {};

  if (!SEASONS[season]) return res.status(400).json({ error: `Unknown season: ${season}` });
  if (!["solo", "flex", "clash"].includes(mode)) return res.status(400).json({ error: `Unknown mode: ${mode}` });

  let targets = null;
  if (playerNames && Array.isArray(playerNames) && playerNames.length > 0) {
    targets = FULL_SQUAD.filter(p => playerNames.includes(p.gameName));
  }

  // Reset auto-fetch timer so it doesn't immediately trigger after a manual fetch
  nextFetchAt = Date.now() + AUTO_FETCH_INTERVAL;

  runFetch(season, mode, targets, () => {
    invalidateSquadCache();
    nextFetchAt = Date.now() + AUTO_FETCH_INTERVAL;
  });

  res.json({ status: "started", season, mode });
});

app.delete("/fetch", (req, res) => {
  fetchJob.running = false;
  res.json({ status: "stopped" });
});

app.get("/fetch-status", (req, res) => {
  res.json({
    running: fetchJob.running,
    startedAt: fetchJob.startedAt,
    season: fetchJob.season,
    mode: fetchJob.mode,
    progress: fetchJob.progress,
    log: fetchJob.log.slice(-80),
  });
});

app.get("/cache-summary", (req, res) => {
  const { season = CURRENT_SEASON, mode = "solo" } = req.query;
  const players = cachedSquadData
    ? cachedSquadData.filter(p => !p.error)
    : FULL_SQUAD;
  res.json({ summary: getSeasonCacheSummary(season, mode, players), season, mode });
});

// --- Available seasons (only those with actual cached data) ---
app.get("/seasons-available", (req, res) => {
  const { mode = "solo" } = req.query;
  const dataDir = path.join(__dirname, "data");
  const available = [];
  for (const season of Object.keys(SEASONS)) {
    try {
      const p = path.join(dataDir, `season-${season}-${mode}.json`);
      if (fs.existsSync(p)) {
        const cache = JSON.parse(fs.readFileSync(p, "utf8"));
        // Check at least one player has matches
        const hasData = Object.values(cache).some(e => e.matches && Object.keys(e.matches).length > 0);
        if (hasData) available.push(season);
      }
    } catch (e) {}
  }
  res.json({ available });
});

// --- Cached Season Stats (for history / alternate modes) ---
app.get("/squad-stats", (req, res) => {
  const { season, mode = "solo" } = req.query;
  if (!season || !SEASONS[season]) return res.status(400).json({ error: "Invalid season" });

  const TIER_SCORES = { IRON: 0, BRONZE: 400, SILVER: 800, GOLD: 1200, PLATINUM: 1600, EMERALD: 2000, DIAMOND: 2400, MASTER: 2800, GRANDMASTER: 3200, CHALLENGER: 3600 };
  const RANK_SCORES = { IV: 0, III: 100, II: 200, I: 300 };

  const cache = loadSeasonCache(season, mode);
  const squadBase = (cachedSquadData || FULL_SQUAD);

  const players = squadBase.map(p => {
    const key = `${p.gameName}#${p.tagLine}`.toLowerCase();
    const entry = cache[key];

    const liveRankSrc = mode === "flex" ? p.flex : p.solo;
    const liveRank = liveRankSrc ? { tier: liveRankSrc.tier, rank: liveRankSrc.rank, lp: liveRankSrc.lp } : null;

    const base = {
      gameName: p.gameName, tagLine: p.tagLine,
      profileIconId: p.profileIconId || 1,
      summonerLevel: p.summonerLevel || null,
      cached: true, season, mode, liveRank,
    };

    if (!entry || !entry.matches || Object.keys(entry.matches).length === 0) {
      return { ...base, noData: true, solo: null };
    }

    const matches = Object.values(entry.matches);
    let wins = 0, kills = 0, deaths = 0, assists = 0, cs = 0, vision = 0, damage = 0, duration = 0, pentas = 0, gold = 0;
    const roleCounts = {};
    const champStats = {};

    for (const m of matches) {
      if (m.win) wins++;
      kills   += m.kills   || 0;
      deaths  += m.deaths  || 0;
      assists += m.assists || 0;
      cs      += m.cs      || 0;
      vision  += m.vision  || 0;
      damage  += m.damage  || 0;
      duration += m.duration || 0;
      pentas  += m.pentas  || 0;
      gold    += m.gold    || 0;
      if (m.role) roleCounts[m.role] = (roleCounts[m.role] || 0) + 1;
      if (m.champion) {
        if (!champStats[m.champion]) champStats[m.champion] = { games: 0, wins: 0 };
        champStats[m.champion].games++;
        if (m.win) champStats[m.champion].wins++;
      }
    }

    const n = matches.length;
    const losses = n - wins;
    const winRate = Math.round((wins / n) * 100);
    const topRole = Object.keys(roleCounts).sort((a, b) => roleCounts[b] - roleCounts[a])[0] || null;
    const kda = deaths === 0 ? "Perfect" : ((kills + assists) / deaths).toFixed(2);
    const avgCsMin = duration > 0 ? (cs / (duration / 60)).toFixed(1) : null;
    const topChampEntry = Object.entries(champStats).sort((a, b) => b[1].games - a[1].games)[0];
    const topCachedChamp = topChampEntry
      ? { name: topChampEntry[0], games: topChampEntry[1].games, winRate: Math.round(topChampEntry[1].wins / topChampEntry[1].games * 100) }
      : null;

    // Streak from recent matches (sorted by timestamp)
    const sorted = matches.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
    let streak = 0;
    if (sorted.length > 0) {
      const streakWin = sorted[0].win;
      for (const m of sorted) { if (m.win === streakWin) streak++; else break; }
      if (!streakWin) streak = -streak;
    }

    return {
      ...base,
      solo: {
        tier: null, rank: null, lp: null,
        wins, losses, winRate,
        kills: (kills / n).toFixed(1),
        deaths: (deaths / n).toFixed(1),
        assists: (assists / n).toFixed(1),
        kda,
        topRole,
        avgCsMin,
        avgVision: (vision / n).toFixed(1),
        avgDamage: Math.round(damage / n),
        avgDuration: Math.round(duration / n / 60),
        totalTimeSecs: duration,
        totalKills: kills, totalDeaths: deaths, totalAssists: assists,
        totalCS: cs, totalDamage: damage, totalGold: gold,
        pentas, streak,
        sortScore: mode === "flex"
          ? (liveRank ? (TIER_SCORES[liveRank.tier] || 0) + (RANK_SCORES[liveRank.rank] || 0) + (liveRank.lp || 0) : wins - losses)
          : wins - losses,
        topCachedChamp,
      },
    };
  });

  players.sort((a, b) => (b.solo?.sortScore ?? -9999) - (a.solo?.sortScore ?? -9999));
  res.json({ players, season, mode, ddragonVersion });
});

// --- Clash Lineup ---
app.get("/clash-lineup", (req, res) => {
  if (!cachedSquadData) return res.status(503).json({ error: "Squad data not loaded yet — try again in a moment." });
  const eligible = cachedSquadData.filter(p => !p.error && p.solo);
  if (eligible.length < 5) return res.status(400).json({ error: "Need at least 5 ranked players." });
  try {
    const lineups = buildLineups(eligible);
    res.json({ lineups });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Player History ---
app.get("/player-history/:gameName/:tagLine", (req, res) => {
  const { season = CURRENT_SEASON, mode = "solo" } = req.query;
  const key = `${req.params.gameName}#${req.params.tagLine}`.toLowerCase();
  const cache = loadSeasonCache(season, mode);
  const data = cache[key];
  if (!data) return res.json({ totalMatches: 0, champions: [], recentForm: [] });

  const matches = Object.values(data.matches);

  const champMap = {};
  for (const m of matches) {
    if (!m.champion) continue;
    if (!champMap[m.champion]) champMap[m.champion] = { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, cs: 0, damage: 0 };
    const c = champMap[m.champion];
    c.games++; if (m.win) c.wins++;
    c.kills += m.kills || 0; c.deaths += m.deaths || 0; c.assists += m.assists || 0;
    c.cs += m.cs || 0; c.damage += m.damage || 0;
  }

  const champions = Object.entries(champMap)
    .map(([name, s]) => ({
      name, games: s.games,
      winRate: Math.round((s.wins / s.games) * 100),
      kda: s.deaths === 0 ? "Perfect" : ((s.kills + s.assists) / s.deaths).toFixed(2),
      avgKills: (s.kills / s.games).toFixed(1),
      avgDeaths: (s.deaths / s.games).toFixed(1),
      avgAssists: (s.assists / s.games).toFixed(1),
      avgCs: Math.round(s.cs / s.games),
    }))
    .sort((a, b) => b.games - a.games);

  const sorted = matches.sort((a, b) => b.ts - a.ts);
  const recentForm = sorted.slice(0, 20)
    .map(m => ({ win: m.win, champion: m.champion, kills: m.kills, deaths: m.deaths, assists: m.assists, ts: m.ts }));
  const recentGames = sorted.slice(0, 5).map(m => ({
    win: m.win, champion: m.champion, role: m.role,
    kills: m.kills, deaths: m.deaths, assists: m.assists,
    cs: m.cs, vision: m.vision, damage: m.damage,
    gold: m.gold, pentas: m.pentas || 0,
    duration: m.duration, ts: m.ts
  }));

  res.json({ totalMatches: matches.length, lastUpdated: data.lastUpdated, champions, recentForm, recentGames });
});

// --- Compare ---
app.get("/compare/:keyA/:keyB", (req, res) => {
  const { season = CURRENT_SEASON, mode = "solo" } = req.query;
  const cache = loadSeasonCache(season, mode);
  const dA = cache[req.params.keyA.toLowerCase()];
  const dB = cache[req.params.keyB.toLowerCase()];
  if (!dA || !dB) return res.json({ shared: [] });

  function buildChampStats(matches) {
    const map = {};
    for (const m of Object.values(matches)) {
      if (!m.champion) continue;
      if (!map[m.champion]) map[m.champion] = { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, cs: 0, damage: 0, gold: 0, vision: 0, duration: 0, pentas: 0 };
      const c = map[m.champion];
      c.games++; if (m.win) c.wins++;
      c.kills += m.kills || 0; c.deaths += m.deaths || 0; c.assists += m.assists || 0;
      c.cs += m.cs || 0; c.damage += m.damage || 0; c.gold += m.gold || 0;
      c.vision += m.vision || 0; c.duration += m.duration || 0; c.pentas += m.pentas || 0;
    }
    const result = {};
    for (const [name, s] of Object.entries(map)) {
      result[name] = {
        games: s.games, wins: s.wins,
        winRate: Math.round((s.wins / s.games) * 100),
        kda: s.deaths === 0 ? "Perfect" : ((s.kills + s.assists) / s.deaths).toFixed(2),
        avgKills: (s.kills / s.games).toFixed(1), avgDeaths: (s.deaths / s.games).toFixed(1),
        avgAssists: (s.assists / s.games).toFixed(1), avgCs: Math.round(s.cs / s.games),
        avgDamage: Math.round(s.damage / s.games), avgGold: Math.round(s.gold / s.games),
        avgVision: (s.vision / s.games).toFixed(1), avgDuration: Math.round(s.duration / s.games / 60),
        pentas: s.pentas,
      };
    }
    return result;
  }

  const statsA = buildChampStats(dA.matches || {});
  const statsB = buildChampStats(dB.matches || {});
  const shared = Object.keys(statsA).filter(c => statsB[c]).sort((a, b) =>
    (statsA[b].games + statsB[b].games) - (statsA[a].games + statsB[a].games)
  );

  res.json({ shared: shared.map(c => ({ name: c, a: statsA[c], b: statsB[c] })) });
});

// --- Auto Deep Fetch ---
let autoFetchTimer = null;
let nextFetchAt = null;

function startAutoFetch() {
  nextFetchAt = Date.now() + AUTO_FETCH_INTERVAL;
  autoFetchTimer = setInterval(() => { runAutoFetchCycle(); }, AUTO_FETCH_INTERVAL);
}

function runAutoFetchCycle() {
  nextFetchAt = Date.now() + AUTO_FETCH_INTERVAL;
  scheduleReloadAt = null;
  if (!fetchJob.running) {
    console.log("⏰ Auto fetch triggered");
    runFetch(CURRENT_SEASON, "solo", null, invalidateSquadCache);
  } else {
    console.log("⏰ Auto fetch skipped (fetch already running)");
  }
}

app.get("/schedule", (req, res) => {
  res.json({
    nextFetchAt,
    scheduleReloadAt,
    fetchRunning: fetchJob.running,
    interval: AUTO_FETCH_INTERVAL
  });
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  startAutoFetch();
});
