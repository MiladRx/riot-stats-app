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
import { getWeekKey, getNextResetMs, loadSnapshot, saveSnapshot, computeRankings } from "./server/power-rankings.js";

loadDDragon();

// ─────────────────────────────────────────────
// Squad Cache
// ─────────────────────────────────────────────
const SQUAD_CACHE_FILE = path.join(__dirname, "data", "squad-live-cache.json");

let cachedSquadData = null;
let lastFetchTime    = 0;
let scheduleReloadAt = null;   // Set only AFTER fresh data is written to disk

// Load persisted squad cache on startup — instant first load
try {
  const raw  = fs.readFileSync(SQUAD_CACHE_FILE, "utf8");
  const saved = JSON.parse(raw);
  if (saved?.players) {
    cachedSquadData = saved.players;
    lastFetchTime   = saved.cachedAt || 0;
    console.log("⚡ Loaded squad cache from file.");
  }
} catch (_) {}

// Fetch fresh rank/LP/win data for all 12 players and persist to disk.
// Does NOT touch scheduleReloadAt — caller decides when to reload.
async function refreshSquadCache() {
  console.log("🔄 Refreshing squad rank data...");
  const results = [];
  for (let i = 0; i < FULL_SQUAD.length; i++) {
    const p = FULL_SQUAD[i];
    try {
      results.push({ ok: true, value: await getPlayerStats(p.gameName, p.tagLine) });
    } catch (err) {
      results.push({ ok: false, reason: err, player: p });
    }
    if (i < FULL_SQUAD.length - 1) await sleep(1500);
  }

  const squad = results.map((r, i) => {
    if (r.ok) return r.value;
    const p = r.player || FULL_SQUAD[i];
    return { gameName: p.gameName, tagLine: p.tagLine, error: r.reason?.message ?? "Unknown error" };
  });
  squad.sort((a, b) => (b.solo?.sortScore ?? -1) - (a.solo?.sortScore ?? -1));

  // Write to disk first, then swap in-memory — no window of stale data
  const payload = JSON.stringify({ players: squad, cachedAt: Date.now() });
  try { fs.writeFileSync(SQUAD_CACHE_FILE, payload); } catch (_) {}

  cachedSquadData = squad;
  lastFetchTime   = Date.now();
  console.log("✅ Squad rank data refreshed.");

  // Ensure weekly snapshot exists
  const weekKey = getWeekKey();
  if (!loadSnapshot(weekKey)) {
    saveSnapshot(weekKey, cachedSquadData);
    console.log(`📸 Snapshot created for ${weekKey}`);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Called after deep match-history fetch completes:
// refresh rank data → persist → then (and only then) schedule reload.
async function afterDeepFetch() {
  try {
    await refreshSquadCache();
    scheduleReloadAt = Date.now() + 2 * 60 * 1000;
    console.log("🕑 Reload scheduled in 2 min.");
  } catch (e) {
    console.log("❌ afterDeepFetch failed:", e.message);
  }
}

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────

// Admin: force an immediate rank refresh + schedule page reload
app.post("/force-refresh", async (req, res) => {
  if (fetchJob.running) return res.status(409).json({ error: "Deep fetch already running" });
  try {
    await refreshSquadCache();
    scheduleReloadAt = Date.now() + 2 * 60 * 1000;
    res.json({ ok: true, cachedAt: lastFetchTime });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/stats", async (req, res) => {
  const { gameName = "adam1276", tagLine = "EUNE" } = req.query;
  try { res.json(await getPlayerStats(gameName, tagLine)); }
  catch (err) { res.status(err.status ?? 500).json({ error: err.message }); }
});

app.get("/squad", async (req, res) => {
  if (cachedSquadData) {
    console.log("⚡ Serving squad data from cache...");
    return res.json({ players: cachedSquadData, cachedAt: lastFetchTime, expiresAt: lastFetchTime + CACHE_DURATION, ddragonVersion });
  }
  // First-ever run — no file yet
  console.log("🆕 No cache found — doing initial squad fetch...");
  await refreshSquadCache();
  res.json({ players: cachedSquadData, cachedAt: lastFetchTime, expiresAt: lastFetchTime + CACHE_DURATION, ddragonVersion });
});

// Deep match-history fetch (triggered by Fetch Dashboard or GitHub Actions)
app.post("/fetch", (req, res) => {
  if (fetchJob.running) return res.json({ status: "already_running", season: fetchJob.season, mode: fetchJob.mode });

  const { season = CURRENT_SEASON, mode = "solo", players: playerNames } = req.body || {};
  if (!SEASONS[season])                          return res.status(400).json({ error: `Unknown season: ${season}` });
  if (!["solo","flex","clash"].includes(mode))   return res.status(400).json({ error: `Unknown mode: ${mode}` });

  const targets = playerNames?.length
    ? FULL_SQUAD.filter(p => playerNames.includes(p.gameName))
    : null;

  runFetch(season, mode, targets, () => { afterDeepFetch(); });
  res.json({ status: "started", season, mode });
});

app.delete("/fetch", (req, res) => {
  fetchJob.running = false;
  res.json({ status: "stopped" });
});

app.get("/fetch-status", (req, res) => {
  res.json({
    running:   fetchJob.running,
    startedAt: fetchJob.startedAt,
    season:    fetchJob.season,
    mode:      fetchJob.mode,
    progress:  fetchJob.progress,
    log:       fetchJob.log.slice(-80),
  });
});

app.get("/cache-summary", (req, res) => {
  const { season = CURRENT_SEASON, mode = "solo" } = req.query;
  const players = cachedSquadData?.filter(p => !p.error) ?? FULL_SQUAD;
  res.json({ summary: getSeasonCacheSummary(season, mode, players), season, mode });
});

// ─────────────────────────────────────────────
// Schedule endpoint — drives the frontend timer
// ─────────────────────────────────────────────
app.get("/schedule", (req, res) => {
  // Compute nextFetchAt: prefer cached value → lastFetchTime + interval → now + interval
  const nextFetchAt = lastFetchTime
    ? lastFetchTime + AUTO_FETCH_INTERVAL
    : Date.now() + AUTO_FETCH_INTERVAL;

  res.json({
    nextFetchAt,
    scheduleReloadAt,
    fetchRunning: fetchJob.running,
    interval: AUTO_FETCH_INTERVAL,
  });
});

// ─────────────────────────────────────────────
// Seasons available
// ─────────────────────────────────────────────
const _seasonsCache = {};
app.get("/seasons-available", (req, res) => {
  const { mode = "solo" } = req.query;
  if (_seasonsCache[mode]) return res.json({ available: _seasonsCache[mode] });
  const dataDir = path.join(__dirname, "data");
  const available = [];
  for (const season of Object.keys(SEASONS)) {
    try {
      const p = path.join(dataDir, `season-${season}-${mode}.json`);
      if (fs.existsSync(p)) {
        const cache = JSON.parse(fs.readFileSync(p, "utf8"));
        if (Object.values(cache).some(e => e.matches && Object.keys(e.matches).length > 0))
          available.push(season);
      }
    } catch (_) {}
  }
  _seasonsCache[mode] = available;
  res.json({ available });
});

// ─────────────────────────────────────────────
// Squad stats (cached season data)
// ─────────────────────────────────────────────
app.get("/squad-stats", (req, res) => {
  const { season, mode = "solo" } = req.query;
  if (!season || !SEASONS[season]) return res.status(400).json({ error: "Invalid season" });

  const TIER_SCORES = { IRON:0,BRONZE:400,SILVER:800,GOLD:1200,PLATINUM:1600,EMERALD:2000,DIAMOND:2400,MASTER:2800,GRANDMASTER:3200,CHALLENGER:3600 };
  const RANK_SCORES = { IV:0,III:100,II:200,I:300 };

  const cache     = loadSeasonCache(season, mode);
  const squadBase = cachedSquadData || FULL_SQUAD;

  const players = squadBase.map(p => {
    const key   = `${p.gameName}#${p.tagLine}`.toLowerCase();
    const entry = cache[key];
    const liveRankSrc = mode === "flex" ? p.flex : p.solo;
    const liveRank    = liveRankSrc ? { tier: liveRankSrc.tier, rank: liveRankSrc.rank, lp: liveRankSrc.lp } : null;
    const base = { gameName: p.gameName, tagLine: p.tagLine, profileIconId: p.profileIconId || 1, summonerLevel: p.summonerLevel || null, cached: true, season, mode, liveRank };

    if (!entry?.matches || !Object.keys(entry.matches).length) return { ...base, noData: true, solo: null };

    const matches = Object.values(entry.matches);
    let wins=0,kills=0,deaths=0,assists=0,cs=0,vision=0,damage=0,duration=0,pentas=0,gold=0;
    const roleCounts={}, champStats={};

    for (const m of matches) {
      if (m.win) wins++;
      kills+=m.kills||0; deaths+=m.deaths||0; assists+=m.assists||0;
      cs+=m.cs||0; vision+=m.vision||0; damage+=m.damage||0;
      duration+=m.duration||0; pentas+=m.pentas||0; gold+=m.gold||0;
      if (m.role) roleCounts[m.role]=(roleCounts[m.role]||0)+1;
      if (m.champion) {
        if (!champStats[m.champion]) champStats[m.champion]={games:0,wins:0};
        champStats[m.champion].games++;
        if (m.win) champStats[m.champion].wins++;
      }
    }

    const n       = matches.length;
    const losses  = n - wins;
    const winRate = Math.round(wins/n*100);
    const topRole = Object.keys(roleCounts).sort((a,b)=>roleCounts[b]-roleCounts[a])[0]||null;
    const kda     = deaths===0?"Perfect":((kills+assists)/deaths).toFixed(2);
    const avgCsMin = duration>0?(cs/(duration/60)).toFixed(1):null;
    const topChampEntry = Object.entries(champStats).sort((a,b)=>b[1].games-a[1].games)[0];
    const topCachedChamp = topChampEntry ? { name:topChampEntry[0], games:topChampEntry[1].games, winRate:Math.round(topChampEntry[1].wins/topChampEntry[1].games*100) } : null;

    const sorted = matches.slice().sort((a,b)=>(b.ts||0)-(a.ts||0));
    let streak=0;
    if (sorted.length>0) { const sw=sorted[0].win; for (const m of sorted){if(m.win===sw)streak++;else break;} if(!sorted[0].win)streak=-streak; }

    let bestStreak=0,bestLStreak=0,curRun=0,curLRun=0;
    for (const m of sorted.slice().reverse()) {
      if (m.win){curRun++;if(curRun>bestStreak)bestStreak=curRun;curLRun=0;}
      else{curLRun++;if(curLRun>bestLStreak)bestLStreak=curLRun;curRun=0;}
    }

    return { ...base, solo: {
      tier:null,rank:null,lp:null, wins,losses,winRate,
      kills:(kills/n).toFixed(1),deaths:(deaths/n).toFixed(1),assists:(assists/n).toFixed(1),
      kda,topRole,avgCsMin,avgVision:(vision/n).toFixed(1),avgDamage:Math.round(damage/n),
      avgDuration:Math.round(duration/n/60),totalTimeSecs:duration,
      totalKills:kills,totalDeaths:deaths,totalAssists:assists,totalCS:cs,totalDamage:damage,totalGold:gold,
      pentas,streak,bestStreak,bestLStreak,
      sortScore: season!==CURRENT_SEASON&&mode!=="clash" ? n
        : mode==="flex" ? (liveRank?(TIER_SCORES[liveRank.tier]||0)+(RANK_SCORES[liveRank.rank]||0)+(liveRank.lp||0):wins-losses)
        : mode==="clash" ? winRate*1000+wins
        : wins-losses,
      topCachedChamp,
    }};
  });

  players.sort((a,b)=>(b.solo?.sortScore??-9999)-(a.solo?.sortScore??-9999));
  res.json({ players, season, mode, hideRank: season!==CURRENT_SEASON&&mode!=="clash", ddragonVersion });
});

// ─────────────────────────────────────────────
// Power Rankings
// ─────────────────────────────────────────────
app.get("/power-rankings", (req, res) => {
  if (!cachedSquadData) return res.status(503).json({ error: "Squad data not loaded yet." });
  const weekKey  = getWeekKey();
  const snapshot = loadSnapshot(weekKey);
  if (!snapshot) return res.status(503).json({ error: "Weekly snapshot not ready yet. Check back in a moment." });
  const rankings = computeRankings(cachedSquadData, snapshot);
  res.json({ rankings, weekKey, nextResetAt: getNextResetMs(), snapshotAt: snapshot.createdAt, ddragonVersion });
});

app.post("/power-rankings/reset", (req, res) => {
  if (!cachedSquadData) return res.status(503).json({ error: "No squad data." });
  const weekKey  = getWeekKey();
  const snapshot = saveSnapshot(weekKey, cachedSquadData);
  res.json({ ok: true, weekKey, players: Object.keys(snapshot.players).length });
});

// ─────────────────────────────────────────────
// Clash Lineup
// ─────────────────────────────────────────────
app.get("/clash-lineup", (req, res) => {
  if (!cachedSquadData) return res.status(503).json({ error: "Squad data not loaded yet." });
  const eligible = cachedSquadData.filter(p => !p.error && p.solo);
  if (eligible.length < 5) return res.status(400).json({ error: "Need at least 5 ranked players." });
  try { res.json({ lineups: buildLineups(eligible) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────
// Player History
// ─────────────────────────────────────────────
app.get("/player-history/:gameName/:tagLine", (req, res) => {
  const { season = CURRENT_SEASON, mode = "solo" } = req.query;
  const key  = `${req.params.gameName}#${req.params.tagLine}`.toLowerCase();
  const cache = loadSeasonCache(season, mode);
  const data  = cache[key];
  if (!data) return res.json({ totalMatches: 0, champions: [], recentForm: [] });

  const matches = Object.values(data.matches);
  const champMap = {};
  for (const m of matches) {
    if (!m.champion) continue;
    if (!champMap[m.champion]) champMap[m.champion]={games:0,wins:0,kills:0,deaths:0,assists:0,cs:0,damage:0};
    const c=champMap[m.champion]; c.games++; if(m.win)c.wins++;
    c.kills+=m.kills||0; c.deaths+=m.deaths||0; c.assists+=m.assists||0; c.cs+=m.cs||0; c.damage+=m.damage||0;
  }
  const champions = Object.entries(champMap)
    .map(([name,s])=>({name,games:s.games,winRate:Math.round(s.wins/s.games*100),kda:s.deaths===0?"Perfect":((s.kills+s.assists)/s.deaths).toFixed(2),avgKills:(s.kills/s.games).toFixed(1),avgDeaths:(s.deaths/s.games).toFixed(1),avgAssists:(s.assists/s.games).toFixed(1),avgCs:Math.round(s.cs/s.games)}))
    .sort((a,b)=>b.games-a.games);

  const sorted = matches.sort((a,b)=>b.ts-a.ts);
  const recentForm  = sorted.slice(0,20).map(m=>({win:m.win,champion:m.champion,kills:m.kills,deaths:m.deaths,assists:m.assists,ts:m.ts}));
  const recentGames = sorted.slice(0,5).map(m=>({win:m.win,champion:m.champion,role:m.role,kills:m.kills,deaths:m.deaths,assists:m.assists,cs:m.cs,vision:m.vision,damage:m.damage,gold:m.gold,pentas:m.pentas||0,duration:m.duration,ts:m.ts}));

  res.json({ totalMatches: matches.length, lastUpdated: data.lastUpdated, champions, recentForm, recentGames });
});

// ─────────────────────────────────────────────
// Compare
// ─────────────────────────────────────────────
app.get("/compare/:keyA/:keyB", (req, res) => {
  const { season = CURRENT_SEASON, mode = "solo" } = req.query;
  const cache = loadSeasonCache(season, mode);
  const dA = cache[req.params.keyA.toLowerCase()];
  const dB = cache[req.params.keyB.toLowerCase()];
  if (!dA || !dB) return res.json({ shared: [] });

  function buildChampStats(matches) {
    const map={};
    for (const m of Object.values(matches)) {
      if(!m.champion)continue;
      if(!map[m.champion])map[m.champion]={games:0,wins:0,kills:0,deaths:0,assists:0,cs:0,damage:0,gold:0,vision:0,duration:0,pentas:0};
      const c=map[m.champion]; c.games++;if(m.win)c.wins++;
      c.kills+=m.kills||0;c.deaths+=m.deaths||0;c.assists+=m.assists||0;c.cs+=m.cs||0;c.damage+=m.damage||0;c.gold+=m.gold||0;c.vision+=m.vision||0;c.duration+=m.duration||0;c.pentas+=m.pentas||0;
    }
    const result={};
    for(const[name,s]of Object.entries(map)){
      result[name]={games:s.games,wins:s.wins,winRate:Math.round(s.wins/s.games*100),kda:s.deaths===0?"Perfect":((s.kills+s.assists)/s.deaths).toFixed(2),avgKills:(s.kills/s.games).toFixed(1),avgDeaths:(s.deaths/s.games).toFixed(1),avgAssists:(s.assists/s.games).toFixed(1),avgCs:Math.round(s.cs/s.games),avgDamage:Math.round(s.damage/s.games),avgGold:Math.round(s.gold/s.games),avgVision:(s.vision/s.games).toFixed(1),avgDuration:Math.round(s.duration/s.games/60),pentas:s.pentas};
    }
    return result;
  }

  const statsA=buildChampStats(dA.matches||{});
  const statsB=buildChampStats(dB.matches||{});
  const shared=Object.keys(statsA).filter(c=>statsB[c]).sort((a,b)=>(statsA[b].games+statsB[b].games)-(statsA[a].games+statsB[a].games));
  res.json({ shared: shared.map(c=>({name:c,a:statsA[c],b:statsB[c]})) });
});

// ─────────────────────────────────────────────
// Full Cycle: deep fetch → rank refresh → reload
// Called on launch, every 5 min locally, and by GitHub Actions via /full-cycle
// ─────────────────────────────────────────────
let cycleRunning = false;

async function runFullCycle() {
  if (cycleRunning) { console.log("⏭ Full cycle skipped (already running)"); return; }
  cycleRunning = true;
  console.log("🔁 Full cycle started — fetch → rank refresh → reload");
  try {
    // Step 1: Deep fetch (match history) — early-stop means fast if no new games
    await new Promise(resolve => {
      if (fetchJob.running) { resolve(); return; }
      runFetch(CURRENT_SEASON, "solo", null, resolve);
    });
    // Step 2: Rank refresh (LP, wins, losses) — always fresh
    await refreshSquadCache();
    // Step 3: Schedule page reload so frontend gets new data
    scheduleReloadAt = Date.now() + 2 * 60 * 1000;
    console.log("✅ Full cycle complete — reload in 2 min");
  } catch (e) {
    console.log("❌ Full cycle failed:", e.message);
  } finally {
    cycleRunning = false;
  }
}

// GitHub Actions calls this every 5 min — runs full cycle and waits for completion
app.post("/full-cycle", async (req, res) => {
  if (cycleRunning) return res.json({ status: "already_running" });
  runFullCycle(); // don't await — respond immediately so GH Actions doesn't timeout
  res.json({ status: "started" });
});

// Auto full cycle on schedule (every AUTO_FETCH_INTERVAL)
setInterval(runFullCycle, AUTO_FETCH_INTERVAL);

// ─────────────────────────────────────────────
// Start — run full cycle immediately on launch
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log("🚀 Running full cycle on launch...");
  runFullCycle();
});
