import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getMatches, getMatchCount, getPlayerState, bulkInsert } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = path.join(__dirname, "..", "data");

// ── JSON Migration ────────────────────────────────────────────────────────────
const _migrated = new Set();

function migrateIfNeeded(season, mode) {
  const key = `${season}-${mode}`;
  if (_migrated.has(key)) return;
  _migrated.add(key);

  const candidates = [];
  const newPath = path.join(DATA_DIR, `season-${season}-${mode}.json`);
  if (fs.existsSync(newPath)) candidates.push({ path: newPath, season, mode });

  if (season === "2025" && mode === "solo") {
    const legacy = path.join(__dirname, "..", "match-cache.json");
    if (fs.existsSync(legacy)) candidates.push({ path: legacy, season, mode });
  }
  for (const { path: p } of candidates) {
    try {
      const raw = JSON.parse(fs.readFileSync(p, "utf8"));
      for (const [playerKey, entry] of Object.entries(raw)) {
        if (!entry?.matches || !Object.keys(entry.matches).length) continue;
        if (getMatchCount(playerKey, season, mode) > 0) continue;
        console.log(`🔄 Migrating ${playerKey} (${season}/${mode}) from JSON → SQLite (${Object.keys(entry.matches).length} matches)`);
        bulkInsert(playerKey, season, mode, entry.matches, entry.puuid || null, entry.lastUpdated || null);
      }
    } catch (e) {
      console.log(`⚠️ Migration failed for ${p}:`, e.message);
    }
  }
}

// ── Season Cache Proxy ────────────────────────────────────────────────────────
// Returns an object that behaves like { [playerKey]: { matches, lastUpdated, puuid } }
// Lazy-loads each player from SQLite on first access.

function makeSeasonProxy(season, mode) {
  migrateIfNeeded(season, mode);
  const _loaded = {};

  function load(playerKey) {
    if (_loaded[playerKey] !== undefined) return _loaded[playerKey];
    const state = getPlayerState(playerKey, season, mode);
    const rows  = getMatches(playerKey, season, mode);
    if (!rows.length && !state) { _loaded[playerKey] = null; return null; }
    const matchesObj = {};
    for (const r of rows) matchesObj[r._id] = r;
    _loaded[playerKey] = {
      matches:     matchesObj,
      lastUpdated: state?.last_updated || null,
      puuid:       state?.puuid        || null,
    };
    return _loaded[playerKey];
  }

  return new Proxy({}, {
    get(_, prop) {
      if (typeof prop === "symbol" || prop === "then") return undefined;
      return load(prop);
    },
    has(_, prop) { return load(prop) !== null; },
  });
}

// ── Exports ───────────────────────────────────────────────────────────────────

export function loadSeasonCache(season, mode) {
  return makeSeasonProxy(season, mode);
}

// saveSeasonCache kept for backward compat — writes now happen via db.js in fetch-engine
export function saveSeasonCache(_season, _mode, _cache) {}

export function getSeasonCacheSummary(season, mode, players) {
  migrateIfNeeded(season, mode);
  return players.map(p => {
    const key   = `${p.gameName}#${p.tagLine}`.toLowerCase();
    const total = getMatchCount(key, season, mode);
    const state = getPlayerState(key, season, mode);
    return { gameName: p.gameName, tagLine: p.tagLine, total, lastUpdated: state?.last_updated || null };
  });
}
