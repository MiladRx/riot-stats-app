import { loadMatchCache } from "./match-cache.js";
import { ddragonVersion } from "./player-stats.js";

const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

function getRoleStats(matchCache, gameName, tagLine) {
  const key = `${gameName}#${tagLine}`.toLowerCase();
  const entry = matchCache[key];
  if (!entry || !entry.matches) return {};
  const roleStats = {};
  for (const m of Object.values(entry.matches)) {
    if (!m.role) continue;
    if (!roleStats[m.role]) roleStats[m.role] = {
      games: 0, wins: 0, kills: 0, deaths: 0, assists: 0,
      champs: {},
      recent: [],
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

function buildScoreMatrix(playerData) {
  const MAX_RANK = 3900;
  return playerData.map(p => {
    const totalGames = Math.max(Object.values(p.roleStats).reduce((s, r) => s + r.games, 0), 1);
    const rankScore = ((p.solo?.sortScore || 0) / MAX_RANK) * 100;
    return ROLES.map(role => {
      const rs = p.roleStats[role];
      if (!rs || rs.games === 0) {
        const topRoleBonus = p.solo?.topRole === role ? 10 : 0;
        return rankScore * 0.4 + topRoleBonus;
      }
      const playRate = (rs.games / totalGames) * 100;
      const winRate = (rs.wins / rs.games) * 100;
      return rankScore * 0.45 + playRate * 0.3 + winRate * 0.25;
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

function buildTeamSummary(slots) {
  const avgScore = slots.reduce((a, s) => a + (s.solo?.sortScore || 0), 0) / 5;
  const avgTier = scoreToTier(avgScore);
  const mainCount = slots.filter(s => s.isTopRole).length;
  const highCount = slots.filter(s => s.confidence === "high").length;
  const wrSlots = slots.filter(s => s.roleWR !== null);
  const avgWR = wrSlots.length > 0 ? Math.round(wrSlots.reduce((a, s) => a + s.roleWR, 0) / wrSlots.length) : null;

  const strengths = [];
  if (mainCount >= 4) strengths.push(mainCount + "/5 players on their main role");
  else if (mainCount >= 3) strengths.push(mainCount + "/5 playing their main role");
  if (avgWR !== null && avgWR >= 54) strengths.push(avgWR + "% average win rate on assigned roles");
  if (highCount >= 4) strengths.push("Strong picks in " + highCount + " out of 5 roles");
  const maxScore = Math.max(...slots.map(s => s.solo?.sortScore || 0));
  const anchor = slots.find(s => (s.solo?.sortScore || 0) === maxScore);
  if (anchor && (anchor.solo?.sortScore || 0) >= 2000) {
    const t = anchor.solo.tier.charAt(0) + anchor.solo.tier.slice(1).toLowerCase();
    strengths.push(anchor.gameName + " (" + t + ") anchors the lineup");
  }

  const warnings = [];
  const noData = slots.filter(s => s.roleGames === 0).length;
  if (noData > 0) warnings.push(noData + " player" + (noData > 1 ? "s" : "") + " has no role history");
  const offRole = slots.filter(s => s.confidence === "low").length;
  if (offRole >= 2) warnings.push(offRole + " off-role assignments may hurt performance");

  return { avgTier, avgScore: Math.round(avgScore), mainCount, highCount, avgWR, strengths: strengths.slice(0, 3), warnings: warnings.slice(0, 2) };
}

export function buildLineups(squadPlayers) {
  const cache = loadMatchCache();
  const playerData = squadPlayers.map((p, idx) => ({
    ...p, idx,
    roleStats: getRoleStats(cache, p.gameName, p.tagLine),
  }));

  const scoreMatrix = buildScoreMatrix(playerData);
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
        const rs = p.roleStats[p.assignedRole];
        const roleGames = rs?.games || 0;
        const roleWR = rs && rs.games > 0 ? Math.round((rs.wins / rs.games) * 100) : null;
        const roleKDA = rs && rs.games > 0 && rs.deaths > 0
          ? +((rs.kills + rs.assists) / rs.deaths).toFixed(2) : null;
        const isTopRole = p.solo?.topRole === p.assignedRole;
        const confidence = roleGames >= 20 ? "high" : roleGames >= 5 ? "medium" : "low";

        // Top 3 champs on this role
        const topChamps = rs ? Object.entries(rs.champs)
          .sort((a, b) => b[1].games - a[1].games)
          .slice(0, 3)
          .map(([name, stat]) => ({ name, games: stat.games, wr: Math.round(stat.wins / stat.games * 100) }))
          : [];

        // Recent 5 games on this role (newest first)
        const recentForm = rs ? rs.recent
          .sort((a, b) => b.ts - a.ts)
          .slice(0, 5)
          .map(g => g.win)
          : [];

        return {
          role: p.assignedRole,
          gameName: p.gameName, tagLine: p.tagLine,
          profileIconId: p.profileIconId, solo: p.solo,
          roleGames, roleWR, roleKDA, isTopRole, confidence,
          topChamps, recentForm,
        };
      })
      .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role));

    const teamSummary = buildTeamSummary(slots);

    // What changed vs best lineup
    let diff = null;
    if (lineupIdx > 0) {
      const thisNames = new Set(lineup.players.map(p => p.gameName));
      const removed = top3[0].players.find(p => !thisNames.has(p.gameName));
      const added = lineup.players.find(p => !firstPlayerNames.has(p.gameName));
      const addedSlot = slots.find(s => s.gameName === added?.gameName);
      if (added && removed) diff = { swappedIn: added.gameName, swappedOut: removed.gameName, role: addedSlot?.role };
    }

    return { score: +lineup.score.toFixed(1), slots, bench, teamSummary, diff, ddragonVersion };
  });
}
