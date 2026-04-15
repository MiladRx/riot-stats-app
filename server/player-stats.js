import fetch from "node-fetch";
import { riotFetch } from "./riot-api.js";
import { loadSeasonCache } from "./season-cache.js";
import { CURRENT_SEASON } from "./config.js";

// --- Data Dragon (Champion Info) ---
export let championMap = {};
export let ddragonVersion = "14.10.1";

export async function loadDDragon() {
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

// --- Player Stats & KDA Logic ---
export async function getPlayerStats(gameName, tagLine) {
  // Step 1: PUUID (must be first — everything else depends on it)
  const account = await riotFetch(
    `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
  );
  if (!account?.puuid) throw Object.assign(new Error(`No PUUID returned for ${gameName}#${tagLine}`), { status: 404 });
  const { puuid } = account;

  // Steps 2-5: All independent — run in parallel
  const [allEntries, summonerResult, isLiveResult, masteryResult] = await Promise.all([
    riotFetch(`https://eun1.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`),
    riotFetch(`https://eun1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`).catch(() => ({})),
    riotFetch(`https://eun1.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}`).then(() => true).catch(() => false),
    riotFetch(`https://eun1.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=1`).catch(() => null),
  ]);

  const summoner = summonerResult || {};
  const isLive = isLiveResult || false;

  let topChamp = null;
  if (masteryResult && masteryResult.length > 0) {
    const champInfo = championMap[String(masteryResult[0].championId)];
    if (champInfo) {
      topChamp = { name: champInfo.name, id: champInfo.id, points: masteryResult[0].championPoints, version: ddragonVersion };
    }
  }

  // Step 6: Compute stats from match cache (sync — already in memory)
  let avgKills = "0.0", avgDeaths = "0.0", avgAssists = "0.0", kdaRatio = "0.00";
  let topRole = null, lpEstimate = null;
  let avgCsMin = null, avgVision = null, avgDamage = null, avgDuration = null;
  let pentas = 0, streak = 0, bestStreak = 0, bestLStreak = 0, topCachedChamp = null;
  let totalKills = 0, totalDeaths = 0, totalAssists = 0, totalDuration = 0;
  let maxKillsDeathless = 0;
  let totalCS = 0, totalDamage = 0, totalGold = 0;
  try {
    const cache = loadSeasonCache(CURRENT_SEASON, "solo");
    const cacheKey = `${gameName}#${tagLine}`.toLowerCase();
    const cached = cache[cacheKey]?.matches || null;

    if (cached && Object.keys(cached).length > 0) {
      const recent = Object.values(cached);
      let validGames = 0, totalVision = 0, totalPentas = 0;
      let recentWins = 0, positionCounts = {};
      const champStats = {};

      for (const m of recent) {
        totalKills   += m.kills   || 0;
        totalDeaths  += m.deaths  || 0;
        totalAssists += m.assists || 0;
        totalCS      += m.cs      || 0;
        totalVision  += m.vision  || 0;
        totalDamage  += m.damage  || 0;
        totalDuration += m.duration || 0;
        totalPentas  += m.pentas  || 0;
        totalGold    += m.gold    || 0;
        if ((m.deaths || 0) === 0 && (m.kills || 0) > maxKillsDeathless) maxKillsDeathless = m.kills;
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
        avgKills   = (totalKills / validGames).toFixed(1);
        avgDeaths  = (totalDeaths / validGames).toFixed(1);
        avgAssists = (totalAssists / validGames).toFixed(1);
        kdaRatio   = totalDeaths === 0 ? "Perfect" : ((totalKills + totalAssists) / totalDeaths).toFixed(2);
        lpEstimate = (recentWins - (validGames - recentWins)) * 20;
        avgCsMin   = totalDuration > 0 ? (totalCS / (totalDuration / 60)).toFixed(1) : null;
        avgVision  = (totalVision / validGames).toFixed(1);
        avgDamage  = Math.round(totalDamage / validGames);
        avgDuration = Math.round(totalDuration / validGames / 60);
        pentas     = totalPentas;
      }

      if (Object.keys(positionCounts).length > 0)
        topRole = Object.entries(positionCounts).sort((a, b) => b[1] - a[1])[0][0];

      const sortedByTime = recent.slice().sort((a, b) => b.ts - a.ts);
      if (sortedByTime.length > 0) {
        const streakWin = sortedByTime[0].win;
        for (const m of sortedByTime) { if (m.win === streakWin) streak++; else break; }
        if (!streakWin) streak = -streak;
      }

      let curRun = 0, curLRun = 0;
      for (const m of sortedByTime.slice().reverse()) {
        if (m.win) { curRun++; if (curRun > bestStreak) bestStreak = curRun; curLRun = 0; }
        else { curLRun++; if (curLRun > bestLStreak) bestLStreak = curLRun; curRun = 0; }
      }

      const champEntries = Object.entries(champStats).sort((a, b) => b[1].games - a[1].games);
      if (champEntries.length > 0) {
        const [name, { games, wins }] = champEntries[0];
        topCachedChamp = { name, games, winRate: Math.round((wins / games) * 100) };
      }
    }
  } catch (e) { }

  const solo = Array.isArray(allEntries) ? (allEntries.find(e => e.queueType === "RANKED_SOLO_5x5") || null) : null;
  const tierOrder = { IRON: 0, BRONZE: 1, SILVER: 2, GOLD: 3, PLATINUM: 4, EMERALD: 5, DIAMOND: 6, MASTER: 7, GRANDMASTER: 8, CHALLENGER: 9 };
  const rankOrder = { IV: 0, III: 1, II: 2, I: 3 };

  return {
    gameName: account.gameName,
    tagLine: account.tagLine,
    summonerLevel: summoner.summonerLevel ?? null,
    profileIconId: summoner.profileIconId ?? 1,
    isLive,
    topChamp,
    solo: solo ? {
      tier: solo.tier,
      rank: solo.rank,
      lp: solo.leaguePoints,
      wins: solo.wins,
      losses: solo.losses,
      winRate: Math.round((solo.wins / (solo.wins + solo.losses)) * 100),
      sortScore: (tierOrder[solo.tier] ?? -1) * 400 + (rankOrder[solo.rank] ?? 0) * 100 + solo.leaguePoints,
      kills: avgKills, deaths: avgDeaths, assists: avgAssists, kda: kdaRatio,
      lpEstimate, topRole, avgCsMin, avgVision, avgDamage, avgDuration,
      totalTimeSecs: totalDuration, totalKills, totalDeaths, totalAssists,
      totalCS, totalDamage, totalGold, pentas, streak, bestStreak, bestLStreak, maxKillsDeathless,
      topCachedChamp,
    } : null,
  };
}
