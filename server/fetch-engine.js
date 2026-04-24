import { riotFetch } from "./riot-api.js";
import { saveMatch, markMatchFetched, getKnownIds, savePlayerState } from "./db.js";
import { FULL_SQUAD, FETCH_DELAY_MS, SEASONS, QUEUE_IDS } from "./config.js";

// Called when a new penta kill is found — set by server.js
export let onPentaKill = null;
export function setPentaKillHandler(fn) { onPentaKill = fn; }

export const fetchJob = {
  running:   false,
  startedAt: null,
  season:    null,
  mode:      null,
  progress:  {},
  log:       [],
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function jobLog(msg) {
  const ts   = new Date().toISOString().slice(11, 19);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  fetchJob.log.push(line);
  if (fetchJob.log.length > 1000) fetchJob.log = fetchJob.log.slice(-1000);
}


// quickMode = true  → auto-cycle: check only 1 page per player (last ~20 games)
// quickMode = false → manual deep fetch: paginate full history
async function fetchForPlayer(gameName, tagLine, season, mode, quickMode = false) {
  const key        = `${gameName}#${tagLine}`.toLowerCase();
  const queue      = QUEUE_IDS[mode];
  const seasonInfo = SEASONS[season];
  fetchJob.progress[key] = { gameName, status: "starting", fetched: 0, newThisRun: 0 };

  try {
    await sleep(FETCH_DELAY_MS);

    const account = await riotFetch(
      `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    );
    if (!account?.puuid) throw new Error("no puuid returned");
    const { puuid } = account;

    const knownIds    = getKnownIds(key, season, mode);
    const initialCount = knownIds.size;
    const modeLabel   = quickMode ? "quick" : "deep";
    jobLog(`👤 ${gameName}: ${initialCount} cached — ${modeLabel} fetch (${season} ${mode})…`);

    // ── Paginate match IDs ────────────────────────────────────────────────────
    let start  = 0;
    const PAGE = quickMode ? 5 : 20;   // quickMode: check last 5 match IDs — catches recent games without over-fetching
    const maxPages = quickMode ? 1 : Infinity;
    let allNewIds = [];
    let pagesFetched = 0;

    while (pagesFetched < maxPages) {
      if (!fetchJob.running) { jobLog(`⏹ ${gameName}: stopped`); break; }

      await sleep(FETCH_DELAY_MS);

      let url = `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=${queue}&start=${start}&count=${PAGE}`;
      if (seasonInfo?.start) url += `&startTime=${seasonInfo.start}`;
      if (seasonInfo?.end)   url += `&endTime=${seasonInfo.end}`;

      let pageIds;
      try {
        pageIds = await riotFetch(url);
      } catch (e) {
        jobLog(`❌ ${gameName}: page ${start} failed — ${e.message}`);
        break;
      }

      if (!pageIds?.length) break;

      const newOnPage = pageIds.filter(id => !knownIds.has(id));
      allNewIds = allNewIds.concat(newOnPage);
      pagesFetched++;

      // Early stop: all IDs on this page already cached — nothing new further back
      if (newOnPage.length === 0) {
        jobLog(`⏩ ${gameName}: page fully cached — stopping early`);
        break;
      }

      if (pageIds.length < PAGE) break; // last page
      start += PAGE;
    }

    const totalToFetch = allNewIds.length;
    if (totalToFetch === 0) {
      jobLog(`✅ ${gameName}: already up to date (${initialCount} cached)`);
      fetchJob.progress[key] = { gameName, status: "done", fetched: initialCount, newThisRun: 0 };
      return;
    }

    jobLog(`📋 ${gameName}: ${totalToFetch} new match${totalToFetch !== 1 ? "es" : ""} to fetch`);

    // ── Fetch individual match data ───────────────────────────────────────────
    let fetched = 0;
    for (const matchId of allNewIds) {
      if (!fetchJob.running) break;

      fetched++;
      await sleep(FETCH_DELAY_MS);

      try {
        const md   = await riotFetch(`https://europe.api.riotgames.com/lol/match/v5/matches/${matchId}`);
        const info = md?.info;
        const self = info?.participants?.find(p => p.puuid === puuid);

        if (!self) {
          markMatchFetched(matchId, key, season, mode);
          knownIds.add(matchId);
          continue;
        }

        const matchData = {
          win:      self.win,
          champion: self.championName,
          role:     self.teamPosition || self.individualPosition || null,
          kills:    self.kills,
          deaths:   self.deaths,
          assists:  self.assists,
          damage:   self.totalDamageDealtToChampions,
          cs:       (self.totalMinionsKilled || 0) + (self.neutralMinionsKilled || 0),
          vision:   self.visionScore,
          gold:     self.goldEarned,
          pentas:   self.pentaKills || 0,
          duration: Math.round(info.gameDuration),
          ts:       info.gameStartTimestamp,
        };

        saveMatch(key, season, mode, matchId, matchData);
        markMatchFetched(matchId, key, season, mode);
        knownIds.add(matchId);

        // Fire penta kill notification
        if (matchData.pentas > 0 && onPentaKill) {
          onPentaKill({ gameName, tagLine, ...matchData }).catch(() => {});
        }

      } catch (e) {
        jobLog(`⚠️ ${gameName}: skipped ${matchId} — ${e.message} [${fetched}/${totalToFetch}]`);
        markMatchFetched(matchId, key, season, mode);
        knownIds.add(matchId);
      }

      fetchJob.progress[key] = {
        gameName, status: "fetching",
        fetched: knownIds.size,
        newThisRun: knownIds.size - initialCount,
        current: fetched, total: totalToFetch,
      };
    }

    savePlayerState(key, season, mode, puuid, Date.now());
    const newThisRun = knownIds.size - initialCount;
    fetchJob.progress[key] = { gameName, status: "done", fetched: knownIds.size, newThisRun };
    jobLog(`✅ ${gameName}: done — ${knownIds.size} total, +${newThisRun} new`);

  } catch (e) {
    fetchJob.progress[key] = { gameName, status: "error", error: e.message, fetched: 0, newThisRun: 0 };
    jobLog(`❌ ${gameName}: ${e.message}`);
  }
}

// ── Public runners ────────────────────────────────────────────────────────────

// quickMode = true  → used by auto-cycle (1 page per player, fast)
// quickMode = false → used by manual fetch dashboard (full history)
export async function runFetch(season, mode, players, onComplete, quickMode = false) {
  if (fetchJob.running) return;
  const targets = players || FULL_SQUAD;
  fetchJob.running   = true;
  fetchJob.startedAt = Date.now();
  fetchJob.season    = season;
  fetchJob.mode      = mode;
  fetchJob.progress  = {};
  fetchJob.log       = [];

  const label = quickMode ? "Quick sync" : "Deep fetch";
  jobLog(`🚀 ${label} — Season ${season} · ${mode.toUpperCase()} (${targets.length} player${targets.length !== 1 ? "s" : ""})`);

  for (const p of targets) {
    if (!fetchJob.running) break;
    await fetchForPlayer(p.gameName, p.tagLine, season, mode, quickMode);
  }

  fetchJob.running = false;
  jobLog("🎉 Fetch complete!");
  if (onComplete) onComplete();
}
