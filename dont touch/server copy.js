import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.RIOT_API_KEY;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!API_KEY) {
  console.error("❌ RIOT_API_KEY not set");
  process.exit(1);
}

app.use(express.static(path.join(__dirname, "public")));

// --- Data Dragon (Champion Info) ---
let championMap = {};
let ddragonVersion = "14.10.1"; // Fallback
async function loadDDragon() {
  try {
    const verRes = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
    const versions = await verRes.json();
    ddragonVersion = versions[0];
    const champRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/en_US/champion.json`);
    const champData = await champRes.json();
    for (let key in champData.data) {
      championMap[champData.data[key].key] = champData.data[key];
    }
    console.log(`✅ DDragon Champion Data Loaded (v${ddragonVersion})`);
  } catch (e) {
    console.log("⚠️ Failed to load DDragon data.");
  }
}
loadDDragon();

// --- Full Player Roster (used for deep history fetch) ---
const FULL_SQUAD = [
  { gameName: "adam1276", tagLine: "EUNE" },
  { gameName: "Spirifan3", tagLine: "Faker" },
  { gameName: "moroccan dealer", tagLine: "pimp" },
  { gameName: "Pas på", tagLine: "00007" },
  { gameName: "La Cabra", tagLine: "III" },
  { gameName: "mohsh", tagLine: "EUNE" },
  { gameName: "Fåce", tagLine: "TAP" },
  { gameName: "Milad", tagLine: "EXE" },
  { gameName: "LittlestJeff1", tagLine: "goyem" },
];


// --- Match History Cache ---
const MATCH_CACHE_PATH = path.join(__dirname, "match-cache.json");
const FETCH_DELAY_MS = 1350; // ~44 req/min — safely under the 100/2min Riot limit

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function loadMatchCache() {
  try {
    if (fs.existsSync(MATCH_CACHE_PATH)) return JSON.parse(fs.readFileSync(MATCH_CACHE_PATH, "utf8"));
  } catch (e) { }
  return {};
}

function saveMatchCache(cache) {
  try { fs.writeFileSync(MATCH_CACHE_PATH, JSON.stringify(cache)); }
  catch (e) { console.log("⚠️ Match cache save failed:", e.message); }
}

// --- Background History Fetch Job ---
const fetchJob = { running: false, startedAt: null, progress: {}, log: [] };

function jobLog(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  fetchJob.log.push(line);
  if (fetchJob.log.length > 500) fetchJob.log = fetchJob.log.slice(-500);
}

async function fetchHistoryForPlayer(gameName, tagLine) {
  const key = `${gameName}#${tagLine}`.toLowerCase();
  fetchJob.progress[key] = { status: "starting", fetched: 0, newThisRun: 0 };

  try {
    await sleep(FETCH_DELAY_MS);
    const account = await riotFetch(
      `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    );
    const { puuid } = account;

    const cache = loadMatchCache();
    if (!cache[key]) cache[key] = { matches: {}, fetchedIds: [] };
    // Seed from both fetchedIds and matches keys to recover from mid-run crashes
    const knownIds = new Set([
      ...(cache[key].fetchedIds || []),
      ...Object.keys(cache[key].matches || {})
    ]);
    const initialCount = knownIds.size;
    jobLog(`👤 ${gameName}: ${initialCount} already cached — fetching the rest...`);

    let start = 0;
    const PAGE = 100;

    while (true) {
      if (!fetchJob.running) { jobLog(`⏹ ${gameName}: stopped`); break; }

      await sleep(FETCH_DELAY_MS);
      let pageIds;
      try {
        pageIds = await riotFetch(
          `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=${start}&count=${PAGE}&startTime=1767866400`
        );
      } catch (e) { jobLog(`❌ ${gameName}: page ${start} failed — ${e.message}`); break; }

      if (!pageIds || pageIds.length === 0) { jobLog(`✅ ${gameName}: end of history`); break; }

      const newIds = pageIds.filter(id => !knownIds.has(id));
      jobLog(`📋 ${gameName}: page ${start}–${start + pageIds.length - 1} → ${newIds.length} new to fetch`);

      for (const matchId of newIds) {
        if (!fetchJob.running) break;
        await sleep(FETCH_DELAY_MS);
        try {
          const md = await riotFetch(`https://europe.api.riotgames.com/lol/match/v5/matches/${matchId}`);
          const p = md.info.participants.find(p => p.puuid === puuid);
          if (p) {
            cache[key].matches[matchId] = {
              ts: md.info.gameStartTimestamp,
              duration: md.info.gameDuration,
              win: p.win,
              champion: p.championName,
              role: p.teamPosition,
              kills: p.kills,
              deaths: p.deaths,
              assists: p.assists,
              cs: (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0),
              vision: p.visionScore,
              damage: p.totalDamageDealtToChampions,
              gold: p.goldEarned,
              pentas: p.pentaKills || 0,
            };
            knownIds.add(matchId);
          }
        } catch (e) { jobLog(`⚠️ ${gameName}: skipped ${matchId} (${e.message})`); }

        fetchJob.progress[key] = { status: "fetching", fetched: knownIds.size, newThisRun: knownIds.size - initialCount };
      }

      // Save progress after every page so a restart doesn't lose work
      cache[key].fetchedIds = [...knownIds];
      cache[key].lastUpdated = Date.now();
      saveMatchCache(cache);

      if (pageIds.length < PAGE) { jobLog(`✅ ${gameName}: reached earliest match`); break; }
      start += PAGE;
    }

    const newThisRun = knownIds.size - initialCount;
    fetchJob.progress[key] = { status: "done", fetched: knownIds.size, newThisRun };
    jobLog(`🏁 ${gameName}: done — ${knownIds.size} total, ${newThisRun} new this run`);

  } catch (e) {
    fetchJob.progress[key] = { status: "error", error: e.message };
    jobLog(`❌ ${gameName}: ${e.message}`);
  }
}

async function runFetchJob(players) {
  if (fetchJob.running) return;
  players = players || FULL_SQUAD;
  fetchJob.running = true;
  fetchJob.startedAt = Date.now();
  fetchJob.progress = {};
  fetchJob.log = [];
  jobLog(`🚀 Deep history fetch started (${players.length} player${players.length > 1 ? "s" : ""})`);

  for (const p of players) {
    if (!fetchJob.running) break;
    await fetchHistoryForPlayer(p.gameName, p.tagLine);
  }

  fetchJob.running = false;
  jobLog("🎉 Done!");
}

// --- Riot Fetch Wrapper ---
async function riotFetch(url) {
  const res = await fetch(url, { headers: { "X-Riot-Token": API_KEY } });
  if (!res.ok) {
    const body = await res.text();
    throw Object.assign(new Error(`Riot ${res.status}`), { status: res.status, body, url });
  }
  return res.json();
}

// --- Player Stats & KDA Logic ---
async function getPlayerStats(gameName, tagLine) {
  // Step 1: PUUID
  const account = await riotFetch(
    `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
  );
  const { puuid } = account;

  // Step 2: Ranked entries
  const allEntries = await riotFetch(
    `https://eun1.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`
  );

  // Step 3: Summoner info (Profile Icon)
  let summoner = {};
  try {
    summoner = await riotFetch(`https://eun1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`);
  } catch (e) { }

  // Step 4: Live Game Check
  let isLive = false;
  try {
    await riotFetch(`https://eun1.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}`);
    isLive = true; // If no 404 error, they are in a match!
  } catch (e) { /* 404 means not in game, ignore */ }

  // Step 5: Top Champion Mastery
  let topChamp = null;
  try {
    const mastery = await riotFetch(`https://eun1.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=1`);
    if (mastery && mastery.length > 0) {
      const champInfo = championMap[String(mastery[0].championId)];
      if (champInfo) {
        topChamp = {
          name: champInfo.name,
          id: champInfo.id,
          points: mastery[0].championPoints,
          version: ddragonVersion
        };
      }
    }
  } catch (e) { }

  // Step 6: Compute stats from match cache (no API calls); fall back to API only if no cache
  let avgKills = "0.0", avgDeaths = "0.0", avgAssists = "0.0", kdaRatio = "0.00";
  let topRole = null, lpEstimate = null;
  let avgCsMin = null, avgVision = null, avgDamage = null, avgDuration = null;
  let pentas = 0, streak = 0, bestStreak = 0, bestLStreak = 0, topCachedChamp = null;
  let totalKills = 0, totalDeaths = 0, totalAssists = 0, totalDuration = 0;
  let totalCS = 0, totalDamage = 0, totalGold = 0;
  try {
    const cache = loadMatchCache();
    const cacheKey = `${gameName}#${tagLine}`.toLowerCase();
    const cached = cache[cacheKey] && cache[cacheKey].matches ? cache[cacheKey].matches : null;

    if (cached && Object.keys(cached).length > 0) {
      // Use all stored data
      const recent = Object.values(cached);

      let validGames = 0, totalVision = 0, totalPentas = 0;
      let recentWins = 0, positionCounts = {};
      const champStats = {};

      for (const m of recent) {
        totalKills += m.kills || 0;
        totalDeaths += m.deaths || 0;
        totalAssists += m.assists || 0;
        totalCS += m.cs || 0;
        totalVision += m.vision || 0;
        totalDamage += m.damage || 0;
        totalDuration += m.duration || 0;
        totalPentas += m.pentas || 0;
        totalGold += m.gold || 0;
        validGames++;
        if (m.win) recentWins++;
        if (m.role) positionCounts[m.role] = (positionCounts[m.role] || 0) + 1;
        if (m.champion) {
          if (!champStats[m.champion]) champStats[m.champion] = { games: 0, wins: 0 };
          champStats[m.champion].games++;
          if (m.win) champStats[m.champion].wins++;
        }
      }

      if (validGames > 0) {
        avgKills = (totalKills / validGames).toFixed(1);
        avgDeaths = (totalDeaths / validGames).toFixed(1);
        avgAssists = (totalAssists / validGames).toFixed(1);
        kdaRatio = totalDeaths === 0 ? "Perfect" : ((totalKills + totalAssists) / totalDeaths).toFixed(2);
        lpEstimate = (recentWins - (validGames - recentWins)) * 20;
        avgCsMin = totalDuration > 0 ? (totalCS / (totalDuration / 60)).toFixed(1) : null;
        avgVision = (totalVision / validGames).toFixed(1);
        avgDamage = Math.round(totalDamage / validGames);
        avgDuration = Math.round(totalDuration / validGames / 60);
        pentas = totalPentas;
      }

      if (Object.keys(positionCounts).length > 0)
        topRole = Object.entries(positionCounts).sort((a, b) => b[1] - a[1])[0][0];

      // Current win/loss streak (sorted by most recent first)
      const sortedByTime = recent.slice().sort((a, b) => b.ts - a.ts);
      if (sortedByTime.length > 0) {
        const streakWin = sortedByTime[0].win;
        for (const m of sortedByTime) {
          if (m.win === streakWin) streak++;
          else break;
        }
        if (!streakWin) streak = -streak;
      }

      // Best win streak & worst loss streak ever in stored data
      let curRun = 0, curLRun = 0;
      for (const m of sortedByTime.slice().reverse()) {
        if (m.win) { curRun++; if (curRun > bestStreak) bestStreak = curRun; curLRun = 0; }
        else { curLRun++; if (curLRun > bestLStreak) bestLStreak = curLRun; curRun = 0; }
      }

      // Most played champion from cache
      const champEntries = Object.entries(champStats).sort((a, b) => b[1].games - a[1].games);
      if (champEntries.length > 0) {
        const [name, { games, wins }] = champEntries[0];
        topCachedChamp = { name, games, winRate: Math.round((wins / games) * 100) };
      }

    }
    // No cache = all stats remain null/default — use Fetch in the panel to populate
  } catch (e) { }

  const solo = allEntries.find(e => e.queueType === "RANKED_SOLO_5x5") || null;
  const tierOrder = { IRON: 0, BRONZE: 1, SILVER: 2, GOLD: 3, PLATINUM: 4, EMERALD: 5, DIAMOND: 6, MASTER: 7, GRANDMASTER: 8, CHALLENGER: 9 };
  const rankOrder = { IV: 0, III: 1, II: 2, I: 3 };

  return {
    gameName: account.gameName,
    tagLine: account.tagLine,
    summonerLevel: summoner.summonerLevel ?? null,
    profileIconId: summoner.profileIconId ?? 1,
    isLive: isLive,
    topChamp: topChamp,
    solo: solo ? {
      tier: solo.tier,
      rank: solo.rank,
      lp: solo.leaguePoints,
      wins: solo.wins,
      losses: solo.losses,
      winRate: Math.round((solo.wins / (solo.wins + solo.losses)) * 100),
      sortScore: (tierOrder[solo.tier] ?? -1) * 400 + (rankOrder[solo.rank] ?? 0) * 100 + solo.leaguePoints,
      kills: avgKills,
      deaths: avgDeaths,
      assists: avgAssists,
      kda: kdaRatio,
      lpEstimate: lpEstimate,
      topRole: topRole,
      avgCsMin: avgCsMin,
      avgVision: avgVision,
      avgDamage: avgDamage,
      avgDuration: avgDuration,
      totalTimeSecs: totalDuration,
      totalKills: totalKills,
      totalDeaths: totalDeaths,
      totalAssists: totalAssists,
      totalCS: totalCS,
      totalDamage: totalDamage,
      totalGold: totalGold,
      pentas: pentas,
      streak: streak,
      bestStreak: bestStreak,
      bestLStreak: bestLStreak,
      topCachedChamp: topCachedChamp,
    } : null,
  };
}

// --- Endpoints ---
app.get("/stats", async (req, res) => {
  const { gameName = "adam1276", tagLine = "EUNE" } = req.query;
  try { res.json(await getPlayerStats(gameName, tagLine)); }
  catch (err) { res.status(err.status ?? 500).json({ error: err.message }); }
});

// --- 10-Minute Cache Setup ---
let cachedSquadData = null;
let lastFetchTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

app.get("/squad", async (req, res) => {
  const now = Date.now();
  if (cachedSquadData && (now - lastFetchTime < CACHE_DURATION)) {
    console.log("⚡ Serving squad data from cache...");
    return res.json({ players: cachedSquadData, cachedAt: lastFetchTime, expiresAt: lastFetchTime + CACHE_DURATION });
  }

  console.log("🔄 Fetching fresh squad data (10-Min Mega Fetch)...");
  const players = [
    { gameName: "adam1276", tagLine: "EUNE" },
    { gameName: "Spirifan3", tagLine: "Faker" },
    { gameName: "moroccan dealer", tagLine: "pimp" },
    { gameName: "Pas på", tagLine: "00007" },
    { gameName: "La Cabra", tagLine: "III" },
    { gameName: "mohsh", tagLine: "EUNE" },
    { gameName: "Fåce", tagLine: "TAP" },
    { gameName: "Milad", tagLine: "EXE" },
    { gameName: "LittlestJeff1", tagLine: "goyem" },
  ];

  const results = [];
  for (const p of players) {
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
    return { gameName: players[i].gameName, tagLine: players[i].tagLine, error: r.reason?.message ?? "Unknown error", status: r.reason?.status ?? 500 };
  });

  squad.sort((a, b) => (b.solo?.sortScore ?? -1) - (a.solo?.sortScore ?? -1));

  cachedSquadData = squad;
  lastFetchTime = Date.now();

  console.log("✅ Squad data updated and cached for 10 minutes!");

  res.json({ players: cachedSquadData, cachedAt: lastFetchTime, expiresAt: lastFetchTime + CACHE_DURATION });
});


// --- Deep History Fetch Endpoints ---
app.post("/fetch-history", (req, res) => {
  if (fetchJob.running) return res.json({ status: "already_running", progress: fetchJob.progress });
  runFetchJob();
  res.json({ status: "started" });
});

app.post("/fetch-history/:gameName/:tagLine", (req, res) => {
  if (fetchJob.running) return res.json({ status: "already_running" });
  runFetchJob([{ gameName: req.params.gameName, tagLine: req.params.tagLine }]);
  res.json({ status: "started" });
});

app.delete("/fetch-history", (req, res) => {
  fetchJob.running = false;
  res.json({ status: "stopped" });
});

app.get("/fetch-status", (req, res) => {
  const cache = loadMatchCache();
  // Attach total cached count per player to progress
  const progress = {};
  for (const p of FULL_SQUAD) {
    const key = `${p.gameName}#${p.tagLine}`.toLowerCase();
    const cached = cache[key] ? Object.keys(cache[key].matches || {}).length : 0;
    progress[key] = fetchJob.progress[key] || { status: "idle", fetched: cached, newThisRun: 0 };
    progress[key].fetched = Math.max(progress[key].fetched || 0, cached);
  }
  res.json({ running: fetchJob.running, startedAt: fetchJob.startedAt, progress, log: fetchJob.log.slice(-80) });
});

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

  const recentForm = matches
    .sort((a, b) => b.ts - a.ts).slice(0, 20)
    .map(m => ({ win: m.win, champion: m.champion, kills: m.kills, deaths: m.deaths, assists: m.assists, ts: m.ts }));

  res.json({ totalMatches: matches.length, lastUpdated: data.lastUpdated, champions, recentForm });
});

app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));