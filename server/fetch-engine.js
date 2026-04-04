import { riotFetch } from "./riot-api.js";
import { loadSeasonCache, saveSeasonCache } from "./season-cache.js";
import { FULL_SQUAD, FETCH_DELAY_MS, SEASONS, QUEUE_IDS } from "./config.js";

export const fetchJob = {
  running: false,
  startedAt: null,
  season: null,
  mode: null,
  progress: {},
  log: [],
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function jobLog(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  fetchJob.log.push(line);
  if (fetchJob.log.length > 1000) fetchJob.log = fetchJob.log.slice(-1000);
}

async function fetchForPlayer(gameName, tagLine, season, mode) {
  const key = `${gameName}#${tagLine}`.toLowerCase();
  const queue = QUEUE_IDS[mode];
  const seasonInfo = SEASONS[season];
  fetchJob.progress[key] = { gameName, status: "starting", fetched: 0, newThisRun: 0 };

  try {
    await sleep(FETCH_DELAY_MS);
    const account = await riotFetch(
      `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    );
    const { puuid } = account;

    const cache = loadSeasonCache(season, mode);
    if (!cache[key]) cache[key] = { puuid, matches: {}, fetchedIds: [] };
    cache[key].puuid = puuid;

    const knownIds = new Set([
      ...(cache[key].fetchedIds || []),
      ...Object.keys(cache[key].matches || {}),
    ]);
    const initialCount = knownIds.size;
    jobLog(`👤 ${gameName}: ${initialCount} cached — fetching Season ${season} ${mode}...`);

    // Paginate all match IDs
    let start = 0;
    const PAGE = 100;
    let allIds = [];

    while (true) {
      if (!fetchJob.running) { jobLog(`⏹ ${gameName}: stopped`); break; }
      await sleep(FETCH_DELAY_MS);

      let url = `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=${queue}&start=${start}&count=${PAGE}`;
      if (seasonInfo?.start) url += `&startTime=${seasonInfo.start}`;
      if (seasonInfo?.end)   url += `&endTime=${seasonInfo.end}`;

      let pageIds;
      try {
        pageIds = await riotFetch(url);
      } catch (e) { jobLog(`❌ ${gameName}: page ${start} failed — ${e.message}`); break; }

      if (!pageIds || pageIds.length === 0) break;
      allIds = allIds.concat(pageIds);
      if (pageIds.length < PAGE) break;
      start += PAGE;
    }

    const toFetch = allIds.filter(id => !knownIds.has(id));
    const totalToFetch = toFetch.length;
    jobLog(`📋 ${gameName}: ${allIds.length} total, ${totalToFetch} new to fetch`);

    let currentFetch = 0;

    for (const matchId of toFetch) {
      currentFetch++;
      if (!fetchJob.running) break;

      jobLog(`⏳ ${gameName}: fetching match ${currentFetch} of ${totalToFetch}...`);

      await sleep(FETCH_DELAY_MS);
      try {
        const md = await riotFetch(`https://europe.api.riotgames.com/lol/match/v5/matches/${matchId}`);
        const info = md.info;
        const self = info.participants.find(p => p.puuid === puuid);
        if (!self) { knownIds.add(matchId); continue; }

        const matchData = {
          matchId,
          win: self.win,
          champion: self.championName,
          role: self.teamPosition || self.individualPosition || null,
          kills: self.kills,
          deaths: self.deaths,
          assists: self.assists,
          damage: self.totalDamageDealtToChampions,
          cs: (self.totalMinionsKilled || 0) + (self.neutralMinionsKilled || 0),
          vision: self.visionScore,
          gold: self.goldEarned,
          pentas: self.pentaKills || 0,
          duration: Math.round(info.gameDuration),
          ts: info.gameStartTimestamp,
          gameVersion: info.gameVersion || null,
        };

        // Clash: enrich with teammate and enemy data
        if (mode === "clash") {
          matchData.teammates = info.participants
            .filter(pt => pt.teamId === self.teamId && pt.puuid !== puuid)
            .map(pt => ({
              puuid: pt.puuid,
              gameName: pt.riotIdGameName || "",
              tagLine: pt.riotIdTagline || "",
              champion: pt.championName,
              role: pt.teamPosition || pt.individualPosition || null,
              kills: pt.kills, deaths: pt.deaths, assists: pt.assists,
              win: pt.win,
            }));
          matchData.enemies = info.participants
            .filter(pt => pt.teamId !== self.teamId)
            .map(pt => ({
              champion: pt.championName,
              role: pt.teamPosition || pt.individualPosition || null,
            }));
        }

        cache[key].matches[matchId] = matchData;
        knownIds.add(matchId);

        fetchJob.progress[key] = {
          gameName,
          status: `fetching (${currentFetch}/${totalToFetch})`,
          fetched: knownIds.size,
          newThisRun: knownIds.size - initialCount,
          current: currentFetch,
          total: totalToFetch
        };
      } catch (e) {
        jobLog(`⚠️ ${gameName}: skipped ${matchId} (${e.message}) [${currentFetch}/${totalToFetch}]`);
        knownIds.add(matchId);
      }
    }

    cache[key].fetchedIds = [...knownIds];
    cache[key].lastUpdated = Date.now();
    saveSeasonCache(season, mode, cache);

    const newThisRun = knownIds.size - initialCount;
    fetchJob.progress[key] = { gameName, status: "done", fetched: knownIds.size, newThisRun };
    jobLog(`✅ ${gameName}: done — ${knownIds.size} total, +${newThisRun} new`);

  } catch (e) {
    fetchJob.progress[key] = { gameName, status: "error", error: e.message, fetched: 0, newThisRun: 0 };
    jobLog(`❌ ${gameName}: ${e.message}`);
  }
}

export async function runFetch(season, mode, players, onComplete) {
  if (fetchJob.running) return;
  const targets = players || FULL_SQUAD;
  fetchJob.running = true;
  fetchJob.startedAt = Date.now();
  fetchJob.season = season;
  fetchJob.mode = mode;
  fetchJob.progress = {};
  fetchJob.log = [];

  jobLog(`🚀 Fetch started — Season ${season} · ${mode.toUpperCase()} (${targets.length} player${targets.length !== 1 ? "s" : ""})`);

  for (const p of targets) {
    if (!fetchJob.running) break;
    await fetchForPlayer(p.gameName, p.tagLine, season, mode);
  }

  fetchJob.running = false;
  jobLog("🎉 Fetch complete!");
  if (onComplete) onComplete();
}
