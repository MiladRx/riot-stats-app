import { riotFetch } from "./riot-api.js";
import { saveMatch, markMatchFetched, getKnownIds, savePlayerState } from "./db.js";
import { FULL_SQUAD, FETCH_DELAY_MS, SEASONS, QUEUE_IDS, AUTO_CYCLE_MAX_PAGES, FETCH_RETRY_ATTEMPTS } from "./config.js";

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

// Retry wrapper — retries on rate-limit (429) or transient network errors
async function fetchWithRetry(url, attempts = FETCH_RETRY_ATTEMPTS) {
  for (let i = 0; i <= attempts; i++) {
    try {
      return await riotFetch(url);
    } catch (e) {
      const isRetryable = e.status === 429 || e.status >= 500 || e.message?.includes("fetch");
      if (i < attempts && isRetryable) {
        const wait = (i + 1) * 3000; // 3s, 6s backoff
        jobLog(`⚠️ Retry ${i + 1}/${attempts} in ${wait / 1000}s — ${e.message}`);
        await sleep(wait);
      } else {
        throw e;
      }
    }
  }
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

    const account = await fetchWithRetry(
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
    const PAGE = 20;
    const maxPages = quickMode ? AUTO_CYCLE_MAX_PAGES : Infinity;
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
        pageIds = await fetchWithRetry(url);
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
        const md   = await fetchWithRetry(`https://europe.api.riotgames.com/lol/match/v5/matches/${matchId}`);
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

        if (mode === "clash") {
          matchData.teammates = info.participants
            .filter(pt => pt.teamId === self.teamId && pt.puuid !== puuid)
            .map(pt => ({ puuid: pt.puuid, gameName: pt.riotIdGameName || "", tagLine: pt.riotIdTagline || "", champion: pt.championName, role: pt.teamPosition || pt.individualPosition || null, kills: pt.kills, deaths: pt.deaths, assists: pt.assists, win: pt.win }));
          matchData.enemies = info.participants
            .filter(pt => pt.teamId !== self.teamId)
            .map(pt => ({ champion: pt.championName, role: pt.teamPosition || pt.individualPosition || null }));
        }

        saveMatch(key, season, mode, matchId, matchData);
        markMatchFetched(matchId, key, season, mode);
        knownIds.add(matchId);

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
