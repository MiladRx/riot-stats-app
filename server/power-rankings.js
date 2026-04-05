import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

// Week key — auto-increments each Saturday 23:59
// April 5, 2026 = Week 1
export function getWeekKey() {
  const now = new Date();
  const seasonStart = new Date(Date.UTC(2026, 3, 5, 23, 59, 0)); // April 5, 2026 23:59 UTC

  // Days since season start
  const daysSince = (now - seasonStart) / (24 * 60 * 60 * 1000);
  // Week number (7 days per week)
  const weekNum = Math.floor(daysSince / 7) + 1;

  return `2026-W${String(Math.max(1, weekNum)).padStart(2, "0")}`;
}

// Increment a week key string e.g. "2026-W01" → "2026-W02"
export function nextWeekKey(weekKey) {
  const num = parseInt(weekKey.split("-W")[1], 10);
  return `2026-W${String(num + 1).padStart(2, "0")}`;
}

// One week from snapshot creation timestamp
export function getNextResetMs(snapshot) {
  if (snapshot?.createdAt) return snapshot.createdAt + 7 * 24 * 60 * 60 * 1000;
  return Date.now() + 7 * 24 * 60 * 60 * 1000;
}

function snapPath(weekKey) {
  return path.join(dataDir, `power-snapshot-${weekKey}.json`);
}

export function loadSnapshot(weekKey) {
  try {
    const p = snapPath(weekKey);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {}
  return null;
}

export function saveSnapshot(weekKey, squadPlayers) {
  const snap = { week: weekKey, createdAt: Date.now(), players: {} };
  for (const p of squadPlayers) {
    if (p.error || !p.solo) continue;
    const key = `${p.gameName}#${p.tagLine}`.toLowerCase();
    snap.players[key] = {
      tier: p.solo.tier,
      rank: p.solo.rank,
      lp: p.solo.lp,
      wins: p.solo.wins,
      losses: p.solo.losses,
    };
  }
  fs.writeFileSync(snapPath(weekKey), JSON.stringify(snap, null, 2));
  return snap;
}

const TIER_VAL = { IRON: 0, BRONZE: 400, SILVER: 800, GOLD: 1200, PLATINUM: 1600, EMERALD: 2000, DIAMOND: 2400, MASTER: 2800, GRANDMASTER: 3200, CHALLENGER: 3600 };
const RANK_VAL = { IV: 0, III: 100, II: 200, I: 300 };

function fullLP(tier, rank, lp) {
  return (TIER_VAL[tier] || 0) + (RANK_VAL[rank] || 0) + (lp || 0);
}

export function computeRankings(squadPlayers, snapshot) {
  const snapPlayers = snapshot?.players || {};
  const weekKey = snapshot?.week || getWeekKey();

  return squadPlayers
    .filter(p => !p.error && p.solo)
    .map(p => {
      const key = `${p.gameName}#${p.tagLine}`.toLowerCase();
      const snap = snapPlayers[key] || null;

      const curFull = fullLP(p.solo.tier, p.solo.rank, p.solo.lp);
      const snapFull = snap ? fullLP(snap.tier, snap.rank, snap.lp) : curFull;
      const lpProgress = snap ? curFull - snapFull : 0;

      const curGames = p.solo.wins + p.solo.losses;
      const snapGames = snap ? (snap.wins + snap.losses) : curGames;
      const gamesThisWeek = Math.max(0, curGames - snapGames);
      const winsThisWeek = snap ? Math.max(0, p.solo.wins - snap.wins) : 0;
      const lossesThisWeek = Math.max(0, gamesThisWeek - winsThisWeek);
      const weekWR = gamesThisWeek > 0 ? Math.round(winsThisWeek / gamesThisWeek * 100) : null;

      // Players with no activity (no games, no LP change) get null score — ranked last
      const inactive = snap && gamesThisWeek === 0 && lpProgress === 0;

      // Scoring: LP gained + activity (games×5 + wins×3) + WR bonus for 5+ games
      let score = lpProgress + gamesThisWeek * 5 + winsThisWeek * 3;
      if (weekWR !== null && gamesThisWeek >= 5) {
        if (weekWR >= 60) score += 20;
        else if (weekWR >= 55) score += 10;
        else if (weekWR <= 40) score -= 15;
        else if (weekWR <= 45) score -= 7;
      }

      return {
        gameName: p.gameName,
        tagLine: p.tagLine,
        profileIconId: p.profileIconId,
        tier: p.solo.tier,
        rank: p.solo.rank,
        lp: p.solo.lp,
        hasSnapshot: !!snap,
        inactive,
        score: inactive ? null : Math.round(score),
        lpProgress,
        gamesThisWeek,
        winsThisWeek,
        lossesThisWeek,
        weekWR,
        curWR: curGames > 0 ? Math.round(p.solo.wins / curGames * 100) : 0,
      };
    })
    .sort((a, b) => {
      if (a.score === null && b.score === null) return 0;
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return b.score - a.score;
    });
}
