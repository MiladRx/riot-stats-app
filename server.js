import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.RIOT_API_KEY) {
  console.error("❌ RIOT_API_KEY not set");
  process.exit(1);
}

app.use(express.static(path.join(__dirname, "public")));

// --- Imports ---
import { FULL_SQUAD, CACHE_DURATION, AUTO_FETCH_INTERVAL } from "./server/config.js";
import { loadMatchCache, fetchJob, runFetchJob, scheduleReloadAt, setScheduleReloadAt } from "./server/match-cache.js";
import { loadDDragon, ddragonVersion, getPlayerStats } from "./server/player-stats.js";
import { buildLineups } from "./server/clash.js";

loadDDragon();

// --- Squad Cache ---
let cachedSquadData = null;
let lastFetchTime = 0;

function invalidateSquadCache() {
  setTimeout(() => {
    console.log("🔄 Auto-reloading squad cache (2 min after deep fetch)...");
    cachedSquadData = null;
    lastFetchTime = 0;
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

  console.log("🔄 Fetching fresh squad data (10-Min Mega Fetch)...");
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
  console.log("✅ Squad data updated and cached for 10 minutes!");

  res.json({ players: cachedSquadData, cachedAt: lastFetchTime, expiresAt: lastFetchTime + CACHE_DURATION, ddragonVersion });
});

// --- Deep History Fetch ---
app.post("/fetch-history", (req, res) => {
  if (fetchJob.running) return res.json({ status: "already_running", progress: fetchJob.progress });
  runFetchJob(null, invalidateSquadCache);
  res.json({ status: "started" });
});

app.post("/fetch-history/:gameName/:tagLine", (req, res) => {
  if (fetchJob.running) return res.json({ status: "already_running" });
  runFetchJob([{ gameName: req.params.gameName, tagLine: req.params.tagLine }], invalidateSquadCache);
  res.json({ status: "started" });
});

app.delete("/fetch-history", (req, res) => {
  fetchJob.running = false;
  res.json({ status: "stopped" });
});

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

app.get("/fetch-status", (req, res) => {
  const cache = loadMatchCache();
  const progress = {};
  for (const p of FULL_SQUAD) {
    const key = `${p.gameName}#${p.tagLine}`.toLowerCase();
    const cached = cache[key] ? Object.keys(cache[key].matches || {}).length : 0;
    progress[key] = fetchJob.progress[key] || { status: "idle", fetched: cached, newThisRun: 0 };
    progress[key].fetched = Math.max(progress[key].fetched || 0, cached);
  }
  res.json({ running: fetchJob.running, startedAt: fetchJob.startedAt, progress, log: fetchJob.log.slice(-80) });
});

// --- Player History ---
app.get("/player-history/:gameName/:tagLine", (req, res) => {
  const key = `${req.params.gameName}#${req.params.tagLine}`.toLowerCase();
  const cache = loadMatchCache();
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
  const cache = loadMatchCache();
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
        avgKills: (s.kills / s.games).toFixed(1),
        avgDeaths: (s.deaths / s.games).toFixed(1),
        avgAssists: (s.assists / s.games).toFixed(1),
        avgCs: Math.round(s.cs / s.games),
        avgDamage: Math.round(s.damage / s.games),
        avgGold: Math.round(s.gold / s.games),
        avgVision: (s.vision / s.games).toFixed(1),
        avgDuration: Math.round(s.duration / s.games / 60),
        pentas: s.pentas,
      };
    }
    return result;
  }

  const statsA = buildChampStats(dA.matches || {});
  const statsB = buildChampStats(dB.matches || {});
  const shared = Object.keys(statsA).filter(c => statsB[c]).sort((a, b) => {
    return (statsA[b].games + statsB[b].games) - (statsA[a].games + statsB[a].games);
  });

  res.json({
    shared: shared.map(c => ({ name: c, a: statsA[c], b: statsB[c] }))
  });
});

// --- Auto Deep Fetch ---
let autoFetchTimer = null;
let nextFetchAt = null;

function startAutoFetch() {
  nextFetchAt = Date.now();
  runAutoFetchCycle();
  autoFetchTimer = setInterval(() => { runAutoFetchCycle(); }, AUTO_FETCH_INTERVAL);
}

function runAutoFetchCycle() {
  nextFetchAt = Date.now() + AUTO_FETCH_INTERVAL;
  setScheduleReloadAt(null);
  if (!fetchJob.running) {
    console.log("⏰ Auto deep fetch triggered");
    runFetchJob(null, invalidateSquadCache);
  } else {
    console.log("⏰ Auto deep fetch skipped (already running)");
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
