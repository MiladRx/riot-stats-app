import { loadSeasonCache } from "./season-cache.js";
import { CURRENT_SEASON } from "./config.js";
import { ddragonVersion } from "./player-stats.js";

const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

// ── Extract per-role stats from a cache (ranked or clash) ──
function getRoleStats(matchCache, gameName, tagLine) {
  const key = `${gameName}#${tagLine}`.toLowerCase();
  const entry = matchCache[key];
  if (!entry || !entry.matches) return {};
  const roleStats = {};
  for (const m of Object.values(entry.matches)) {
    if (!m.role) continue;
    if (!roleStats[m.role]) roleStats[m.role] = {
      games: 0, wins: 0, kills: 0, deaths: 0, assists: 0,
      champs: {}, recent: [],
    };
    const rs = roleStats[m.role];
    rs.games++;
    if (m.win) rs.wins++;
    rs.kills += m.kills || 0;
    rs.deaths += m.deaths || 0;
    rs.assists += m.assists || 0;
    if (m.champion) {
      if (!rs.champs[m.champion]) rs.champs[m.champion] = { games: 0, wins: 0 };
      rs.champs[m.champion].games++;
      if (m.win) rs.champs[m.champion].wins++;
    }
    rs.recent.push({ win: !!m.win, ts: m.ts || 0 });
  }
  return roleStats;
}

// ── Blended score: Clash data weighted 2.5x vs ranked ──
function buildScoreMatrix(playerData) {
  const MAX_RANK = 3900;
  return playerData.map(p => {
    const rankScore = ((p.solo?.sortScore || 0) / MAX_RANK) * 100;
    const totalRanked = Math.max(Object.values(p.roleStats).reduce((s, r) => s + r.games, 0), 1);
    const totalClash = Math.max(Object.values(p.clashRoleStats).reduce((s, r) => s + r.games, 0), 1);
    const hasClashData = totalClash > 1;

    return ROLES.map(role => {
      const rs = p.roleStats[role];
      const cs = p.clashRoleStats[role];

      // Ranked contribution
      let rankedScore = 0;
      if (rs && rs.games > 0) {
        rankedScore = (rs.games / totalRanked) * 40 + (rs.wins / rs.games) * 35;
      } else if (p.solo?.topRole === role) {
        rankedScore = 8;
      }

      // Clash contribution (2.5x weight if data exists)
      let clashScore = 0;
      if (cs && cs.games > 0) {
        clashScore = ((cs.games / totalClash) * 40 + (cs.wins / cs.games) * 35) * 2.5;
      }

      const roleScore = hasClashData && cs?.games > 0
        ? rankedScore * 0.35 + clashScore * 0.65
        : rankedScore;

      return rankScore * 0.45 + roleScore * 0.55;
    });
  });
}

function bestAssignment(chosen, scoreMatrix) {
  const rolesCopy = [...ROLES];
  let bestScore = -1;
  let bestAssign = null;
  function permute(arr, l) {
    if (l === arr.length) {
      let score = 0;
      for (let i = 0; i < chosen.length; i++) score += scoreMatrix[chosen[i].idx][ROLES.indexOf(arr[i])];
      if (score > bestScore) { bestScore = score; bestAssign = [...arr]; }
      return;
    }
    for (let i = l; i < arr.length; i++) {
      [arr[l], arr[i]] = [arr[i], arr[l]];
      permute(arr, l + 1);
      [arr[l], arr[i]] = [arr[i], arr[l]];
    }
  }
  permute(rolesCopy, 0);
  return { score: bestScore, assignment: bestAssign };
}

function scoreToTier(score) {
  if (score >= 3200) return "Grandmaster";
  if (score >= 2800) return "Master";
  if (score >= 2400) return "Diamond";
  if (score >= 2000) return "Emerald";
  if (score >= 1600) return "Platinum";
  if (score >= 1200) return "Gold";
  if (score >= 800)  return "Silver";
  if (score >= 400)  return "Bronze";
  return "Iron";
}

// ── Detect which squad members have played Clash together ──
function computeSynergy(playerData, clashCache) {
  const pairs = {};
  for (const p of playerData) {
    const key = `${p.gameName}#${p.tagLine}`.toLowerCase();
    const entry = clashCache[key];
    if (!entry || !entry.matches) continue;
    for (const m of Object.values(entry.matches)) {
      if (!m.teammates) continue;
      for (const tm of m.teammates) {
        const tmName = (tm.gameName || "").toLowerCase();
        const otherPlayer = playerData.find(q =>
          q.gameName.toLowerCase() === tmName && q.gameName !== p.gameName
        );
        if (!otherPlayer) continue;
        const pairKey = [p.gameName, otherPlayer.gameName].sort().join("||");
        if (!pairs[pairKey]) pairs[pairKey] = { games: 0, wins: 0, players: [p.gameName, otherPlayer.gameName] };
        pairs[pairKey].games++;
        if (m.win) pairs[pairKey].wins++;
      }
    }
  }
  // Deduplicate (both sides count each game)
  for (const pk of Object.keys(pairs)) {
    pairs[pk].games = Math.round(pairs[pk].games / 2);
    pairs[pk].wins  = Math.round(pairs[pk].wins  / 2);
  }
  return Object.values(pairs)
    .filter(p => p.games > 0)
    .sort((a, b) => b.games - a.games);
}

function buildTeamSummary(slots, synergyPairs) {
  const avgScore = slots.reduce((a, s) => a + (s.solo?.sortScore || 0), 0) / 5;
  const avgTier = scoreToTier(avgScore);
  const mainCount = slots.filter(s => s.isTopRole).length;
  const highCount = slots.filter(s => s.confidence === "high").length;
  const wrSlots = slots.filter(s => s.roleWR !== null);
  const avgWR = wrSlots.length > 0 ? Math.round(wrSlots.reduce((a, s) => a + s.roleWR, 0) / wrSlots.length) : null;
  const clashExpSlots = slots.filter(s => s.clashGames > 0);
  const totalClashGames = clashExpSlots.reduce((a, s) => a + s.clashGames, 0);

  const strengths = [];
  if (mainCount >= 4) strengths.push(mainCount + "/5 players on their main role");
  else if (mainCount >= 3) strengths.push(mainCount + "/5 playing their main role");
  if (avgWR !== null && avgWR >= 54) strengths.push(avgWR + "% average win rate on assigned roles");
  if (highCount >= 4) strengths.push("Strong picks in " + highCount + " out of 5 roles");
  if (totalClashGames > 0) strengths.push("Using " + totalClashGames + " Clash games to inform this lineup");
  const maxScore = Math.max(...slots.map(s => s.solo?.sortScore || 0));
  const anchor = slots.find(s => (s.solo?.sortScore || 0) === maxScore);
  if (anchor && (anchor.solo?.sortScore || 0) >= 2000) {
    const t = anchor.solo.tier.charAt(0) + anchor.solo.tier.slice(1).toLowerCase();
    strengths.push(anchor.gameName + " (" + t + ") anchors the lineup");
  }

  const warnings = [];
  const noData = slots.filter(s => s.roleGames === 0 && s.clashGames === 0).length;
  if (noData > 0) warnings.push(noData + " player" + (noData > 1 ? "s" : "") + " has no role history");
  const offRole = slots.filter(s => s.confidence === "low").length;
  if (offRole >= 2) warnings.push(offRole + " off-role assignments — consider Alt lineups");

  // Top synergy pairs among the 5 starters
  const starterNames = new Set(slots.map(s => s.gameName));
  const activeSynergy = (synergyPairs || []).filter(pair =>
    pair.players.every(name => starterNames.has(name)) && pair.games >= 1
  ).slice(0, 3);

  return {
    avgTier, avgScore: Math.round(avgScore), mainCount, highCount, avgWR,
    totalClashGames, strengths: strengths.slice(0, 3), warnings: warnings.slice(0, 2),
    synergy: activeSynergy,
  };
}

export function buildLineups(squadPlayers) {
  const rankedCache = loadSeasonCache(CURRENT_SEASON, "solo");
  const clashCache  = loadSeasonCache(CURRENT_SEASON, "clash");

  const playerData = squadPlayers.map((p, idx) => ({
    ...p, idx,
    roleStats:      getRoleStats(rankedCache, p.gameName, p.tagLine),
    clashRoleStats: getRoleStats(clashCache,  p.gameName, p.tagLine),
  }));

  const synergyPairs = computeSynergy(playerData, clashCache);
  const scoreMatrix  = buildScoreMatrix(playerData);
  const n = playerData.length;
  const lineups = [];

  function combine(start, chosen) {
    if (chosen.length === 5) {
      const { score, assignment } = bestAssignment(chosen, scoreMatrix);
      lineups.push({ score, players: chosen.map((p, i) => ({ ...p, assignedRole: assignment[i] })) });
      return;
    }
    for (let i = start; i <= n - (5 - chosen.length); i++) combine(i + 1, [...chosen, playerData[i]]);
  }
  combine(0, []);
  lineups.sort((a, b) => b.score - a.score);

  const top3 = lineups.slice(0, 3);
  const firstPlayerNames = new Set(top3[0]?.players.map(p => p.gameName) || []);

  return top3.map((lineup, lineupIdx) => {
    const usedNames = new Set(lineup.players.map(p => p.gameName));
    const bench = playerData
      .filter(p => !usedNames.has(p.gameName))
      .map(p => ({
        gameName: p.gameName, tagLine: p.tagLine,
        profileIconId: p.profileIconId, solo: p.solo,
        topRole: p.solo?.topRole,
      }));

    const slots = lineup.players
      .map(p => {
        const rs  = p.roleStats[p.assignedRole];
        const cs  = p.clashRoleStats[p.assignedRole];
        const roleGames  = rs?.games || 0;
        const clashGames = cs?.games || 0;
        const roleWR  = rs && rs.games > 0 ? Math.round((rs.wins / rs.games) * 100) : null;
        const clashWR = cs && cs.games > 0 ? Math.round((cs.wins / cs.games) * 100) : null;
        const roleKDA = rs && rs.games > 0 && rs.deaths > 0
          ? +((rs.kills + rs.assists) / rs.deaths).toFixed(2) : null;
        const clashKDA = cs && cs.games > 0 && cs.deaths > 0
          ? +((cs.kills + cs.assists) / cs.deaths).toFixed(2) : null;
        const isTopRole  = p.solo?.topRole === p.assignedRole;
        // Confidence uses clash data first if available
        const confidence = clashGames >= 5 ? "high"
          : clashGames > 0 ? "medium"
          : roleGames >= 20 ? "high"
          : roleGames >= 5 ? "medium" : "low";

        // Top 3 champs on role — prefer Clash champs, fill from ranked
        const clashChamps = cs ? Object.entries(cs.champs)
          .sort((a, b) => b[1].games - a[1].games).slice(0, 3)
          .map(([name, s]) => ({ name, games: s.games, wr: Math.round(s.wins / s.games * 100), source: "clash" }))
          : [];
        const rankedChamps = rs ? Object.entries(rs.champs)
          .sort((a, b) => b[1].games - a[1].games).slice(0, 3)
          .map(([name, s]) => ({ name, games: s.games, wr: Math.round(s.wins / s.games * 100), source: "ranked" }))
          : [];
        const champNames = new Set(clashChamps.map(c => c.name));
        const topChamps = [...clashChamps, ...rankedChamps.filter(c => !champNames.has(c.name))].slice(0, 3);

        // Recent form — clash first, then ranked
        const clashRecent = cs ? cs.recent.sort((a, b) => b.ts - a.ts).slice(0, 5).map(g => ({ win: g.win, source: "clash" })) : [];
        const rankedRecent = rs ? rs.recent.sort((a, b) => b.ts - a.ts).slice(0, 5 - clashRecent.length).map(g => ({ win: g.win, source: "ranked" })) : [];
        const recentForm = [...clashRecent, ...rankedRecent];

        return {
          role: p.assignedRole,
          gameName: p.gameName, tagLine: p.tagLine,
          profileIconId: p.profileIconId, solo: p.solo,
          roleGames, roleWR, roleKDA,
          clashGames, clashWR, clashKDA,
          isTopRole, confidence,
          topChamps, recentForm,
        };
      })
      .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role));

    const teamSummary = buildTeamSummary(slots, synergyPairs);

    let diff = null;
    if (lineupIdx > 0) {
      const thisNames = new Set(lineup.players.map(p => p.gameName));
      const removed = top3[0].players.find(p => !thisNames.has(p.gameName));
      const added   = lineup.players.find(p => !firstPlayerNames.has(p.gameName));
      const addedSlot = slots.find(s => s.gameName === added?.gameName);
      if (added && removed) diff = { swappedIn: added.gameName, swappedOut: removed.gameName, role: addedSlot?.role };
    }

    return { score: +lineup.score.toFixed(1), slots, bench, teamSummary, synergyPairs, diff, ddragonVersion };
  });
}

