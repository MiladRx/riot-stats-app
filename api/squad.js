import { riotFetch } from "../lib/riot.js";
import fs from "fs";
import path from "path";

const CACHE_PATH = "/tmp/squad-cache.json";
const CACHE_TTL  = 5 * 60 * 1000; // 5 minutes
const BATCH_SIZE = 3;              // players fetched in parallel per group
const BATCH_DELAY = 1300;          // ms between groups — stays under 100 req/2min

const PLAYERS = [
  { gameName: "adam1276",        tagLine: "EUNE"  },
  { gameName: "Spirifan3",       tagLine: "Faker" },
  { gameName: "moroccan dealer", tagLine: "pimp"  },
  { gameName: "Pas på",          tagLine: "00007" },
  { gameName: "La Cabra",        tagLine: "III"   },
  { gameName: "mohsh",           tagLine: "EUNE"  },
  { gameName: "Fåce",            tagLine: "TAP"   },
  { gameName: "Milad",           tagLine: "EXE"   },
  { gameName: "LittlestJeff1",   tagLine: "goyem" },
  { gameName: "DÅRK",            tagLine: "ABO"   },
  { gameName: "DARWIZZY",        tagLine: "HØES"  },
  { gameName: "La Cabra II",     tagLine: "Qlawi" },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function readCache() {
  try {
    const raw = fs.readFileSync(CACHE_PATH, "utf8");
    const data = JSON.parse(raw);
    if (Date.now() - data.cachedAt < CACHE_TTL) return data;
  } catch (e) {}
  return null;
}

function writeCache(players) {
  const data = { cachedAt: Date.now(), players };
  try { fs.writeFileSync(CACHE_PATH, JSON.stringify(data)); } catch (e) {}
}

async function fetchPlayer(p) {
  try {
    const account = await riotFetch(
      `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(p.gameName)}/${encodeURIComponent(p.tagLine)}`
    );
    const { puuid } = account;

    const [allEntries, summoner] = await Promise.all([
      riotFetch(`https://eun1.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`),
      riotFetch(`https://eun1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`).catch(() => ({})),
    ]);

    const solo = allEntries.find(e => e.queueType === "RANKED_SOLO_5x5") || null;
    const flex = allEntries.find(e => e.queueType === "RANKED_FLEX_SR")  || null;
    const tierOrder = { IRON:0, BRONZE:1, SILVER:2, GOLD:3, PLATINUM:4, EMERALD:5, DIAMOND:6, MASTER:7, GRANDMASTER:8, CHALLENGER:9 };
    const rankOrder = { IV:0, III:1, II:2, I:3 };

    return {
      gameName: account.gameName,
      tagLine: account.tagLine,
      summonerLevel: summoner.summonerLevel ?? null,
      profileIconId: summoner.profileIconId ?? 1,
      isLive: false,
      topChamp: null,
      solo: solo ? {
        tier: solo.tier, rank: solo.rank, lp: solo.leaguePoints,
        wins: solo.wins, losses: solo.losses,
        winRate: Math.round((solo.wins / (solo.wins + solo.losses)) * 100),
        hotStreak: solo.hotStreak,
        sortScore: (tierOrder[solo.tier] ?? -1) * 400 + (rankOrder[solo.rank] ?? 0) * 100 + solo.leaguePoints,
        kills: "0.0", deaths: "0.0", assists: "0.0", kda: "0.00",
        lpEstimate: null, topRole: null, avgCsMin: null, avgVision: null,
        avgDamage: null, avgDuration: null, totalTimeSecs: 0,
        totalKills: 0, totalDeaths: 0, totalAssists: 0,
        totalCS: 0, totalDamage: 0, totalGold: 0, pentas: 0,
        streak: 0, bestStreak: 0, bestLStreak: 0, topCachedChamp: null,
      } : null,
      flex: flex ? {
        tier: flex.tier, rank: flex.rank, lp: flex.leaguePoints,
        wins: flex.wins, losses: flex.losses,
        sortScore: (tierOrder[flex.tier] ?? -1) * 400 + (rankOrder[flex.rank] ?? 0) * 100 + flex.leaguePoints,
      } : null,
    };
  } catch (err) {
    return { gameName: p.gameName, tagLine: p.tagLine, error: err.message, status: err.status ?? 500 };
  }
}

async function fetchAllPlayers() {
  const results = [];
  for (let i = 0; i < PLAYERS.length; i += BATCH_SIZE) {
    const batch = PLAYERS.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(fetchPlayer));
    results.push(...batchResults);
    if (i + BATCH_SIZE < PLAYERS.length) await sleep(BATCH_DELAY);
  }
  results.sort((a, b) => (b.solo?.sortScore ?? -1) - (a.solo?.sortScore ?? -1));
  return results;
}

export default async function handler(req, res) {
  // Serve from cache immediately if fresh
  const cached = readCache();
  if (cached) {
    return res.json({
      players: cached.players,
      cachedAt: cached.cachedAt,
      expiresAt: cached.cachedAt + CACHE_TTL,
      ddragonVersion: "15.8.1",
    });
  }

  // Cache stale or missing — fetch fresh
  try {
    const players = await fetchAllPlayers();
    writeCache(players);
    res.json({
      players,
      cachedAt: Date.now(),
      expiresAt: Date.now() + CACHE_TTL,
      ddragonVersion: "15.8.1",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
