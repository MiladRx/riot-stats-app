import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH   = path.join(__dirname, "..", "data", "matches.db");

// Ensure data dir exists
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

// ── Schema ──────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS matches (
    id          TEXT    NOT NULL,
    player_key  TEXT    NOT NULL,
    season      TEXT    NOT NULL,
    mode        TEXT    NOT NULL,
    ts          INTEGER,
    duration    INTEGER,
    win         INTEGER,
    champion    TEXT,
    role        TEXT,
    kills       INTEGER,
    deaths      INTEGER,
    assists     INTEGER,
    cs          INTEGER,
    vision      INTEGER,
    damage      INTEGER,
    gold        INTEGER,
    pentas      INTEGER,
    PRIMARY KEY (id, player_key)
  );

  CREATE TABLE IF NOT EXISTS player_state (
    player_key  TEXT    NOT NULL,
    season      TEXT    NOT NULL,
    mode        TEXT    NOT NULL,
    puuid       TEXT,
    last_updated INTEGER,
    PRIMARY KEY (player_key, season, mode)
  );

  CREATE TABLE IF NOT EXISTS fetched_ids (
    id          TEXT    NOT NULL,
    player_key  TEXT    NOT NULL,
    season      TEXT    NOT NULL,
    mode        TEXT    NOT NULL,
    PRIMARY KEY (id, player_key, season, mode)
  );

  CREATE INDEX IF NOT EXISTS idx_matches_player  ON matches (player_key, season, mode);
  CREATE INDEX IF NOT EXISTS idx_matches_ts      ON matches (ts DESC);
  CREATE INDEX IF NOT EXISTS idx_fetched_player  ON fetched_ids (player_key, season, mode);
`);

// ── Prepared statements ──────────────────────────────────────────────────────
const stmts = {
  upsertMatch: db.prepare(`
    INSERT OR REPLACE INTO matches
      (id,player_key,season,mode,ts,duration,win,champion,role,kills,deaths,assists,cs,vision,damage,gold,pentas)
    VALUES
      (@id,@player_key,@season,@mode,@ts,@duration,@win,@champion,@role,@kills,@deaths,@assists,@cs,@vision,@damage,@gold,@pentas)
  `),

  getMatches: db.prepare(`
    SELECT * FROM matches WHERE player_key=? AND season=? AND mode=?
  `),

  getMatchCount: db.prepare(`
    SELECT COUNT(*) as cnt FROM matches WHERE player_key=? AND season=? AND mode=?
  `),

  upsertState: db.prepare(`
    INSERT OR REPLACE INTO player_state (player_key,season,mode,puuid,last_updated)
    VALUES (@player_key,@season,@mode,@puuid,@last_updated)
  `),

  getState: db.prepare(`
    SELECT * FROM player_state WHERE player_key=? AND season=? AND mode=?
  `),

  isFetched: db.prepare(`
    SELECT 1 FROM fetched_ids WHERE id=? AND player_key=? AND season=? AND mode=?
  `),

  addFetchedId: db.prepare(`
    INSERT OR IGNORE INTO fetched_ids (id,player_key,season,mode) VALUES (?,?,?,?)
  `),

  getAllFetchedIds: db.prepare(`
    SELECT id FROM fetched_ids WHERE player_key=? AND season=? AND mode=?
  `),

  getMatchIds: db.prepare(`
    SELECT id FROM matches WHERE player_key=? AND season=? AND mode=?
  `),
};

// ── Public API ───────────────────────────────────────────────────────────────

export function saveMatch(playerKey, season, mode, matchId, data) {
  stmts.upsertMatch.run({
    id: matchId, player_key: playerKey, season, mode,
    ts: data.ts || null,
    duration: data.duration || null,
    win: data.win ? 1 : 0,
    champion: data.champion || null,
    role: data.role || null,
    kills: data.kills || 0,
    deaths: data.deaths || 0,
    assists: data.assists || 0,
    cs: data.cs || 0,
    vision: data.vision || 0,
    damage: data.damage || 0,
    gold: data.gold || 0,
    pentas: data.pentas || 0,
  });
}

export function getMatches(playerKey, season, mode) {
  return stmts.getMatches.all(playerKey, season, mode).map(row => ({
    ts: row.ts, duration: row.duration, win: !!row.win,
    champion: row.champion, role: row.role,
    kills: row.kills, deaths: row.deaths, assists: row.assists,
    cs: row.cs, vision: row.vision, damage: row.damage,
    gold: row.gold, pentas: row.pentas,
    _id: row.id,
  }));
}

export function getMatchCount(playerKey, season, mode) {
  return stmts.getMatchCount.get(playerKey, season, mode).cnt;
}

export function savePlayerState(playerKey, season, mode, puuid, lastUpdated) {
  stmts.upsertState.run({ player_key: playerKey, season, mode, puuid, last_updated: lastUpdated || Date.now() });
}

export function getPlayerState(playerKey, season, mode) {
  return stmts.getState.get(playerKey, season, mode) || null;
}

export function isMatchFetched(matchId, playerKey, season, mode) {
  return !!stmts.isFetched.get(matchId, playerKey, season, mode);
}

export function markMatchFetched(matchId, playerKey, season, mode) {
  stmts.addFetchedId.run(matchId, playerKey, season, mode);
}

export function getKnownIds(playerKey, season, mode) {
  const fromFetched = stmts.getAllFetchedIds.all(playerKey, season, mode).map(r => r.id);
  const fromMatches = stmts.getMatchIds.all(playerKey, season, mode).map(r => r.id);
  return new Set([...fromFetched, ...fromMatches]);
}

// Bulk insert for JSON migration
export const bulkInsert = db.transaction((playerKey, season, mode, matchesObj, puuid, lastUpdated) => {
  for (const [matchId, data] of Object.entries(matchesObj)) {
    saveMatch(playerKey, season, mode, matchId, data);
    markMatchFetched(matchId, playerKey, season, mode);
  }
  savePlayerState(playerKey, season, mode, puuid || null, lastUpdated || null);
});

export default db;
