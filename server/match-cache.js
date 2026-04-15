import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { FETCH_DELAY_MS, SEASONS, CURRENT_SEASON } from "./config.js";
import { riotFetch } from "./riot-api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MATCH_CACHE_PATH = path.join(__dirname, "..", "match-cache.json");

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// --- Cache I/O ---
export function loadMatchCache() {
  try {
    if (fs.existsSync(MATCH_CACHE_PATH)) return JSON.parse(fs.readFileSync(MATCH_CACHE_PATH, "utf8"));
  } catch (e) { }
  return {};
}

export function saveMatchCache(cache) {
  try { fs.writeFileSync(MATCH_CACHE_PATH, JSON.stringify(cache)); }
  catch (e) { console.log("⚠️ Match cache save failed:", e.message); }
}

// --- Background Fetch Job ---
export const fetchJob = { running: false, startedAt: null, progress: {}, log: [] };

function jobLog(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  fetchJob.log.push(line);
  if (fetchJob.log.length > 500) fetchJob.log = fetchJob.log.slice(-500);
}

async function fetchHistoryForPlayer(gameName, tagLine, startTime = SEASONS[CURRENT_SEASON].start, endTime = null) {
  const key = `${gameName}#${tagLine}`.toLowerCase();
  fetchJob.progress[key] = { status: "starting", fetched: 0, newThisRun: 0 };

  try {
    await sleep(FETCH_DELAY_MS);
    const account = await riotFetch(
      `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    );
    if (!account || !account.puuid) {
      jobLog(`❌ ${gameName}: account lookup returned no puuid — skipping`);
      fetchJob.progress[key] = { status: "error", error: "account not found" };
      return;
    }
    const { puuid } = account;

    const cache = loadMatchCache();
    if (!cache[key]) cache[key] = { matches: {}, fetchedIds: [] };
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
          `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=${start}&count=${PAGE}&startTime=${startTime}` + (endTime ? `&endTime=${endTime}` : '')
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
          if (!md?.info?.participants) { knownIds.add(matchId); continue; }
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

export async function runFetchJob(players, onComplete, startTime = SEASONS[CURRENT_SEASON].start, endTime = null) {
  if (fetchJob.running) return;
  const { FULL_SQUAD } = await import("./config.js");
  players = players || FULL_SQUAD;
  fetchJob.running = true;
  fetchJob.startedAt = Date.now();
  fetchJob.progress = {};
  fetchJob.log = [];
  jobLog(`🚀 Deep history fetch started (${players.length} player${players.length > 1 ? "s" : ""})`);

  for (const p of players) {
    if (!fetchJob.running) break;
    await fetchHistoryForPlayer(p.gameName, p.tagLine, startTime, endTime);
  }

  fetchJob.running = false;
  jobLog("🎉 Done!");

  if (onComplete) onComplete();
}
