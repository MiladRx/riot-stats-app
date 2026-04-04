import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

// Week key anchored to Friday resets — "2026-F14"
// Each "week" runs Fri 00:00 UTC → Thu 23:59 UTC
export function getWeekKey() {
  const now = new Date();
  // UTC day: 0=Sun,1=Mon,...,5=Fri,6=Sat
  const dow = now.getUTCDay(); // 0-6
  // Days since last Friday (0 if today is Friday)
  const daysSinceFri = (dow + 2) % 7; // Fri=0, Sat=1, Sun=2, Mon=3, Tue=4, Wed=5, Thu=6
  const thisFriday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceFri));
  // Week number from Jan 1
  const startOfYear = new Date(Date.UTC(thisFriday.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((thisFriday - startOfYear) / 86400000 + 1) / 7);
  return `${thisFriday.getUTCFullYear()}-F${String(weekNum).padStart(2, "0")}`;
}

// Next Friday 00:00 UTC in ms
export function getNextResetMs() {
  const now = new Date();
  const dow = now.getUTCDay();
  const daysUntilFri = (5 - dow + 7) % 7 || 7; // always next Friday, never today
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilFri));
  return next.getTime();
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
        score: Math.round(score),
        lpProgress,
        gamesThisWeek,
        winsThisWeek,
        lossesThisWeek,
        weekWR,
        curWR: curGames > 0 ? Math.round(p.solo.wins / curGames * 100) : 0,
      };
    })
    .sort((a, b) => b.score - a.score);
}
