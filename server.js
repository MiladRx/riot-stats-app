import express from "express";
import { createServer } from "http";
import { Server as SocketIO } from "socket.io";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config();

const app    = express();
const http   = createServer(app);
export const io = new SocketIO(http, { cors: { origin: "*" } });
const PORT   = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.RIOT_API_KEY) {
  console.error("❌ RIOT_API_KEY not set");
  process.exit(1);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- Imports ---
import { FULL_SQUAD, CACHE_DURATION, AUTO_FETCH_INTERVAL, CURRENT_SEASON, SEASONS, RANK_CONCURRENCY, FETCH_RETRY_ATTEMPTS, ALT_ACCOUNTS, ALT_KEYS } from "./server/config.js";
import { loadSeasonCache, getSeasonCacheSummary } from "./server/season-cache.js";
import { fetchJob, runFetch, setPentaKillHandler } from "./server/fetch-engine.js";
import { loadDDragon, ddragonVersion, getPlayerStats } from "./server/player-stats.js";
import { buildLineups } from "./server/clash.js";
import { getWeekKey, nextWeekKey, getNextResetMs, loadSnapshot, saveSnapshot, saveFinalResults, computeRankings } from "./server/power-rankings.js";
import { notifyRankChanges, notifyPentaKill } from "./server/discord.js";
import { registerDuoCommand, handleDiscordInteraction } from "./server/discord-bot.js";
import { loadMatchCache, runFetchJob, fetchJob as matchFetchJob } from "./server/match-cache.js";
import { ready as dbReady, getHeatmapData } from "./server/db.js";

loadDDragon();

// Initialize database (must happen before any routes use it)
await dbReady();

// Wire up penta kill Discord notifications
setPentaKillHandler(data => notifyPentaKill({ ...data, ddragonVersion }));

// Register Discord /duo slash command
registerDuoCommand();

// ─────────────────────────────────────────────
// Squad Cache
// ─────────────────────────────────────────────
const SQUAD_CACHE_FILE = path.join(__dirname, "data", "squad-live-cache.json");

let cachedSquadData = null;
let lastFetchTime    = 0;

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

// Fetch rank/LP/win data with retry + concurrency
async function fetchPlayerStatsSafe(p) {
  for (let attempt = 0; attempt <= FETCH_RETRY_ATTEMPTS; attempt++) {
    try {
      return { ok: true, value: await getPlayerStats(p.gameName, p.tagLine) };
    } catch (err) {
      const retryable = err.status === 429 || err.status >= 500 || !err.status;
      if (attempt < FETCH_RETRY_ATTEMPTS && retryable) {
        const wait = (attempt + 1) * 3000;
        console.log(`⚠️ ${p.gameName}: retry ${attempt + 1}/${FETCH_RETRY_ATTEMPTS} in ${wait / 1000}s (${err.message})`);
        await sleep(wait);
      } else {
        console.log(`❌ ${p.gameName}: failed after ${attempt + 1} attempt(s) — ${err.message}`);
        return { ok: false, reason: err, player: p };
      }
    }
  }
}

// Fetch fresh rank/LP/win data for all players — concurrent (RANK_CONCURRENCY at a time)
async function refreshSquadCache() {
  console.log(`🔄 Refreshing squad rank data (${FULL_SQUAD.length} players, 1 at a time)…`);

  const results = new Array(FULL_SQUAD.length);

  // Process in batches of RANK_CONCURRENCY
  for (let i = 0; i < FULL_SQUAD.length; i += RANK_CONCURRENCY) {
    const batch = FULL_SQUAD.slice(i, i + RANK_CONCURRENCY);
    const batchResults = await Promise.all(batch.map(p => fetchPlayerStatsSafe(p)));
    batchResults.forEach((r, j) => { results[i + j] = r; });
    // Small gap between batches to respect rate limits
    if (i + RANK_CONCURRENCY < FULL_SQUAD.length) await sleep(2000);
  }

  const squad = results.map((r, i) => {
    if (r?.ok) return r.value;
    const p = r?.player || FULL_SQUAD[i];
    return { gameName: p.gameName, tagLine: p.tagLine, error: r?.reason?.message ?? "Unknown error" };
  });

  // Tag alt accounts and attach combined stats to main accounts
  const squadByKey = {};
  for (const p of squad) squadByKey[`${p.gameName}#${p.tagLine}`.toLowerCase()] = p;
  for (const p of squad) {
    const key = `${p.gameName}#${p.tagLine}`.toLowerCase();
    if (ALT_KEYS.has(key)) { p.isAlt = true; continue; }
    const altKey = ALT_ACCOUNTS[key];
    if (altKey && squadByKey[altKey]?.solo) {
      const alt = squadByKey[altKey];
      p.altAccount = { gameName: alt.gameName, tagLine: alt.tagLine };
      p.altGames   = (alt.solo.wins || 0) + (alt.solo.losses || 0);
      p.altWins    = alt.solo.wins  || 0;
      p.altLosses  = alt.solo.losses || 0;
    }
  }

  squad.sort((a, b) => (b.solo?.sortScore ?? -1) - (a.solo?.sortScore ?? -1));

  // Write to disk first, then swap in-memory — no window of stale data
  const payload = JSON.stringify({ players: squad, cachedAt: Date.now() });
  try { fs.writeFileSync(SQUAD_CACHE_FILE, payload); } catch (_) {}

  const prevSquad = cachedSquadData;
  cachedSquadData = squad;
  lastFetchTime   = Date.now();
  console.log("✅ Squad rank data refreshed.");
  emitSquadUpdated();

  // Notify Discord of any rank changes (fire-and-forget)
  if (prevSquad.length > 0) notifyRankChanges(prevSquad, squad, ddragonVersion).catch(() => {});
  emitSchedule();

  // Ensure weekly snapshot exists; roll over if one week has passed since last snapshot
  const weekKey = getWeekKey();
  const snap = loadSnapshot(weekKey);
  if (!snap) {
    saveSnapshot(weekKey, cachedSquadData);
    console.log(`📸 Snapshot created for ${weekKey}`);
  } else if (Date.now() >= snap.createdAt + 7 * 24 * 60 * 60 * 1000) {
    const newKey = nextWeekKey(weekKey);
    if (!loadSnapshot(newKey)) {
      // Save final results for the completed week before rolling over
      const finalRankings = computeRankings(cachedSquadData, snap);
      saveFinalResults(weekKey, finalRankings);
      console.log(`🏆 Final results saved for ${weekKey}`);
      // Create baseline snapshot anchored to exact rollover time (not when server happened to run)
      const anchoredAt = snap.createdAt + 7 * 24 * 60 * 60 * 1000;
      saveSnapshot(newKey, cachedSquadData, anchoredAt);
      console.log(`📸 New week started → ${newKey} (anchored to ${new Date(anchoredAt).toISOString()})`);
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function afterDeepFetch() {
  try {
    await refreshSquadCache();
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
    res.json({ ok: true, cachedAt: lastFetchTime });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));
app.post("/discord/interactions", express.raw({ type: "application/json" }), handleDiscordInteraction);
app.post("/test-recap", async (req, res) => {
  await postDailyRecap(cachedSquadData);
  res.json({ ok: true });
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
  if (!["solo","clash"].includes(mode))           return res.status(400).json({ error: `Unknown mode: ${mode}` });

  const targets = playerNames?.length
    ? FULL_SQUAD.filter(p => playerNames.includes(p.gameName))
    : null;

  let progressTimer = setInterval(() => {
    emitFetchProgress();
    if (!fetchJob.running) clearInterval(progressTimer);
  }, 800);
  runFetch(season, mode, targets, () => {
    clearInterval(progressTimer);
    emitFetchProgress();
    afterDeepFetch();
  });
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

app.get("/match-history/:gameName/:tagLine", (req, res) => {
  const key = `${req.params.gameName}#${req.params.tagLine}`.toLowerCase();
  const { season = CURRENT_SEASON, mode = "solo" } = req.query;
  const seasonCache = loadSeasonCache(season, mode);
  const entry = seasonCache[key] || loadMatchCache()[key];
  if (!entry || !entry.matches) return res.json({ matches: [] });
  const matches = Object.values(entry.matches)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 20);
  res.json({ matches });
});

app.get("/match-history-summary", (req, res) => {
  const cache = loadMatchCache();
  const players = FULL_SQUAD.map(p => {
    const key = `${p.gameName}#${p.tagLine}`.toLowerCase();
    const entry = cache[key] || {};
    const total = Object.keys(entry.matches || {}).length;
    return { gameName: p.gameName, tagLine: p.tagLine, total, lastUpdated: entry.lastUpdated || null };
  });
  res.json({ players });
});

// Fetch full season match history for selected players (dashboard only)
app.post("/fetch-history", (req, res) => {
  if (matchFetchJob.running) return res.json({ status: "already_running" });
  const { players: playerNames, season = CURRENT_SEASON } = req.body || {};
  const targets = playerNames?.length
    ? FULL_SQUAD.filter(p => playerNames.includes(p.gameName))
    : FULL_SQUAD;
  const seasonInfo = SEASONS[season];
  const startTime = seasonInfo?.start ?? 1767866400;
  const endTime   = seasonInfo?.end   ?? null;
  runFetchJob(targets, null, startTime, endTime);
  res.json({ status: "started", players: targets.map(p => p.gameName) });
});

app.delete("/fetch-history", (req, res) => {
  matchFetchJob.running = false;
  res.json({ status: "stopped" });
});

app.get("/fetch-history/status", (req, res) => {
  res.json({
    running:   matchFetchJob.running,
    startedAt: matchFetchJob.startedAt,
    progress:  matchFetchJob.progress,
    log:       matchFetchJob.log.slice(-80),
  });
});

app.get("/heatmap", (req, res) => {
  const { season = CURRENT_SEASON, mode = "solo", player = null } = req.query;
  const playerKey  = player ? player.toLowerCase() : null;
  const timestamps = getHeatmapData(season, mode, playerKey);

  // Build 7×12 grid (day 0=Mon…6=Sun, slot = floor(hour/2)) in Copenhagen time
  const SLOTS = 12;
  const grid = Array.from({ length: 7 }, () => new Array(SLOTS).fill(0));
  for (const ts of timestamps) {
    const cph  = new Date(new Date(ts).toLocaleString("en-US", { timeZone: "Europe/Copenhagen" }));
    const dow  = (cph.getDay() + 6) % 7;
    const slot = Math.floor(cph.getHours() / 2);
    grid[dow][slot]++;
  }

  res.json({ grid, total: timestamps.length, season, mode });
});

app.get("/cache-summary", (req, res) => {
  const { season = CURRENT_SEASON, mode = "solo" } = req.query;
  const players = cachedSquadData?.filter(p => !p.error) ?? FULL_SQUAD;
  res.json({ summary: getSeasonCacheSummary(season, mode, players), season, mode });
});

// ─────────────────────────────────────────────
// Schedule endpoint — drives the frontend timer
// ─────────────────────────────────────────────
app.get("/schedule", (req, res) => res.json(buildSchedulePayload()));

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
    const liveRankSrc = p.solo;
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
app.get("/power-rankings/weeks", (req, res) => {
  try {
    const files = fs.readdirSync("./data")
      .filter(f => /^power-snapshot-\d{4}-W\d{2}\.json$/.test(f))
      .map(f => f.replace("power-snapshot-", "").replace(".json", ""))
      .sort();
    res.json({ weeks: files, current: getWeekKey() });
  } catch (e) {
    res.json({ weeks: [], current: getWeekKey() });
  }
});

app.get("/power-rankings", (req, res) => {
  if (!cachedSquadData) return res.status(503).json({ error: "Squad data not loaded yet." });
  const currentWeek = getWeekKey();
  const weekKey     = req.query.week || currentWeek;
  const snapshot    = loadSnapshot(weekKey);
  if (!snapshot) return res.status(503).json({ error: "Weekly snapshot not ready yet. Check back in a moment." });

  let rankings;
  if (weekKey === currentWeek) {
    // Live week: compare snapshot (start of week) vs current squad data
    rankings = computeRankings(cachedSquadData, snapshot);
  } else {
    // Past week: compare snapshot (start of week) vs next week's snapshot (end of week)
    const endSnapshot = loadSnapshot(nextWeekKey(weekKey));
    if (endSnapshot) {
      // Build a fake squadPlayers array from the end-of-week snapshot
      const endPlayers = Object.entries(endSnapshot.players).map(([key, p]) => {
        const [gameName, tagLine] = key.split("#");
        return { gameName, tagLine: tagLine || "", profileIconId: 0, solo: p, error: null };
      });
      // Carry over profileIconIds from live data where available
      for (const ep of endPlayers) {
        const live = cachedSquadData.find(p => `${p.gameName}#${p.tagLine}`.toLowerCase() === `${ep.gameName}#${ep.tagLine}`);
        if (live) ep.profileIconId = live.profileIconId || 0;
      }
      rankings = computeRankings(endPlayers, snapshot);
    } else {
      // No end snapshot yet — just show start-of-week standings with no delta
      rankings = computeRankings(cachedSquadData, snapshot);
    }
  }

  res.json({ rankings, weekKey, nextResetAt: getNextResetMs(snapshot), snapshotAt: snapshot.createdAt, ddragonVersion });
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
// Cycle logic
// boot cycle  → rank refresh only (instant, serves from existing match cache)
// full cycle  → quick match sync (1 page/player) + rank refresh
// ─────────────────────────────────────────────
let cycleRunning = false;

// Boot: serve cached squad data immediately, then just refresh ranks — no match fetch
async function runBootCycle() {
  console.log("⚡ Boot cycle — refreshing ranks only (no match fetch)…");
  try {
    await refreshSquadCache();
    console.log("✅ Boot cycle complete");
  } catch (e) {
    console.log("❌ Boot cycle failed:", e.message);
  }
}

// Scheduled / browser-triggered: quick match sync + rank refresh
async function runFullCycle() {
  if (cycleRunning) { console.log("⏭ Full cycle skipped (already running)"); return; }
  cycleRunning = true;
  console.log("🔁 Full cycle — quick sync + rank refresh");
  try {
    // Step 1: Quick match sync — 1 page per player, catches any new games fast
    if (!fetchJob.running) {
      await new Promise(resolve => runFetch(CURRENT_SEASON, "solo", null, resolve, true /* quickMode */));
    }
    // Step 2: Rank refresh
    await refreshSquadCache();
    console.log("✅ Full cycle complete");
  } catch (e) {
    console.log("❌ Full cycle failed:", e.message);
  } finally {
    cycleRunning = false;
  }
}

app.post("/full-cycle", async (req, res) => {
  if (cycleRunning) return res.json({ status: "already_running" });
  await runFullCycle();
  res.json({ status: "done" });
});

// Auto full cycle every 5 minutes
setInterval(runFullCycle, AUTO_FETCH_INTERVAL);

// ─────────────────────────────────────────────
// Start — run full cycle immediately on launch
// ─────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);
  // Send current schedule state immediately on connect
  socket.emit("schedule", buildSchedulePayload());
});

function buildSchedulePayload() {
  const nextFetchAt = lastFetchTime
    ? lastFetchTime + AUTO_FETCH_INTERVAL
    : Date.now() + AUTO_FETCH_INTERVAL;
  return {
    nextFetchAt,
    fetchRunning: fetchJob.running || cycleRunning,
    interval: AUTO_FETCH_INTERVAL,
  };
}

// Emit schedule updates whenever state changes
function emitSchedule() { io.emit("schedule", buildSchedulePayload()); }
function emitSquadUpdated() { io.emit("squad:updated"); }
function emitFetchProgress() {
  io.emit("fetch:status", {
    running:  fetchJob.running,
    season:   fetchJob.season,
    mode:     fetchJob.mode,
    progress: fetchJob.progress,
    log:      fetchJob.log.slice(-80),
  });
}

http.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  runBootCycle();
});

// ── Test endpoint — fake a penta kill card
app.post("/test-penta", async (req, res) => {
  try {
    const p = cachedSquadData?.find(p => p.solo) || { gameName: "adam1276" };
    await notifyPentaKill({ gameName: p.gameName, champion: "Yone", kills: 100, deaths: 2, assists: 5, ddragonVersion, forceLocal: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Test endpoint — fake a promo/demo card
app.post("/test-rank-change", async (req, res) => {
  try {
    const { promoted = true } = req.query;
    const p = cachedSquadData?.find(p => p.solo) || {};
    const fakeOld = [{ ...p, solo: { tier: promoted === "false" ? "MASTER" : "SILVER", rank: promoted === "false" ? "I" : "I", lp: 85 } }];
    const fakeNew = [{ ...p, solo: { tier: promoted === "false" ? "DIAMOND" : "GOLD", rank: promoted === "false" ? "I" : "IV", lp: 12 } }];
    await notifyRankChanges(fakeOld, fakeNew, ddragonVersion, true);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
