import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH   = path.join(__dirname, "..", "data", "matches.db");

// Ensure data dir exists
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let db = null;
let SQL = null;

// Initialize SQL.js and load or create database
async function initDb() {
  SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const data = fs.readFileSync(DB_PATH);
    db = new SQL.Database(data);
    console.log("📊 Loaded existing SQLite database from disk");
  } else {
    db = new SQL.Database();
    console.log("📊 Created new SQLite database in memory");
  }

  // Create schema
  db.run(`
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

  saveDb();
}

// Save database to disk
function saveDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, data);
}

// ── Public API ───────────────────────────────────────────────────────────────

export function saveMatch(playerKey, season, mode, matchId, data) {
  if (!db) throw new Error("DB not initialized");

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO matches
      (id,player_key,season,mode,ts,duration,win,champion,role,kills,deaths,assists,cs,vision,damage,gold,pentas)
    VALUES
      (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  stmt.bind([
    matchId, playerKey, season, mode,
    data.ts || null,
    data.duration || null,
    data.win ? 1 : 0,
    data.champion || null,
    data.role || null,
    data.kills || 0,
    data.deaths || 0,
    data.assists || 0,
    data.cs || 0,
    data.vision || 0,
    data.damage || 0,
    data.gold || 0,
    data.pentas || 0,
  ]);
  stmt.step();
  stmt.free();
  saveDb();
}

export function getMatches(playerKey, season, mode) {
  if (!db) return [];

  const stmt = db.prepare(`
    SELECT * FROM matches WHERE player_key=? AND season=? AND mode=?
  `);
  stmt.bind([playerKey, season, mode]);

  const result = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    result.push({
      ts: row.ts,
      duration: row.duration,
      win: !!row.win,
      champion: row.champion,
      role: row.role,
      kills: row.kills,
      deaths: row.deaths,
      assists: row.assists,
      cs: row.cs,
      vision: row.vision,
      damage: row.damage,
      gold: row.gold,
      pentas: row.pentas,
      _id: row.id,
    });
  }
  stmt.free();
  return result;
}

export function getMatchCount(playerKey, season, mode) {
  if (!db) return 0;

  const stmt = db.prepare(`
    SELECT COUNT(*) as cnt FROM matches WHERE player_key=? AND season=? AND mode=?
  `);
  stmt.bind([playerKey, season, mode]);
  stmt.step();
  const row = stmt.getAsObject();
  stmt.free();
  return row.cnt || 0;
}

export function getHeatmapData(season, mode, playerKey = null) {
  if (!db) return [];
  const sql  = playerKey
    ? `SELECT ts FROM matches WHERE season=? AND mode=? AND player_key=? AND ts IS NOT NULL`
    : `SELECT ts FROM matches WHERE season=? AND mode=? AND ts IS NOT NULL`;
  const stmt = db.prepare(sql);
  stmt.bind(playerKey ? [season, mode, playerKey] : [season, mode]);
  const result = [];
  while (stmt.step()) {
    result.push(stmt.getAsObject().ts);
  }
  stmt.free();
  return result;
}

export function savePlayerState(playerKey, season, mode, puuid, lastUpdated) {
  if (!db) return;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO player_state (player_key,season,mode,puuid,last_updated)
    VALUES (?,?,?,?,?)
  `);
  stmt.bind([playerKey, season, mode, puuid || null, lastUpdated || Date.now()]);
  stmt.step();
  stmt.free();
  saveDb();
}

export function getPlayerState(playerKey, season, mode) {
  if (!db) return null;

  const stmt = db.prepare(`
    SELECT * FROM player_state WHERE player_key=? AND season=? AND mode=?
  `);
  stmt.bind([playerKey, season, mode]);

  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}

export function isMatchFetched(matchId, playerKey, season, mode) {
  if (!db) return false;

  const stmt = db.prepare(`
    SELECT 1 FROM fetched_ids WHERE id=? AND player_key=? AND season=? AND mode=?
  `);
  stmt.bind([matchId, playerKey, season, mode]);
  const found = stmt.step();
  stmt.free();
  return found;
}

export function markMatchFetched(matchId, playerKey, season, mode) {
  if (!db) return;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO fetched_ids (id,player_key,season,mode) VALUES (?,?,?,?)
  `);
  stmt.bind([matchId, playerKey, season, mode]);
  stmt.step();
  stmt.free();
  saveDb();
}

export function getKnownIds(playerKey, season, mode) {
  if (!db) return new Set();

  const ids = new Set();

  // From fetched_ids
  let stmt = db.prepare(`
    SELECT id FROM fetched_ids WHERE player_key=? AND season=? AND mode=?
  `);
  stmt.bind([playerKey, season, mode]);
  while (stmt.step()) {
    const row = stmt.getAsObject();
    ids.add(row.id);
  }
  stmt.free();

  // From matches
  stmt = db.prepare(`
    SELECT id FROM matches WHERE player_key=? AND season=? AND mode=?
  `);
  stmt.bind([playerKey, season, mode]);
  while (stmt.step()) {
    const row = stmt.getAsObject();
    ids.add(row.id);
  }
  stmt.free();

  return ids;
}

export function bulkInsert(playerKey, season, mode, matchesObj, puuid, lastUpdated) {
  if (!db) return;

  for (const [matchId, data] of Object.entries(matchesObj)) {
    saveMatch(playerKey, season, mode, matchId, data);
    markMatchFetched(matchId, playerKey, season, mode);
  }
  savePlayerState(playerKey, season, mode, puuid || null, lastUpdated || null);
}

// Returns { player_key: { wins, losses } } for all matches since a given timestamp
export function getMatchesSince(sinceTs, season = "2026", mode = "solo") {
  if (!db) return {};
  const rows = db.exec(
    `SELECT player_key, win FROM matches WHERE ts >= ${sinceTs} AND season='${season}' AND mode='${mode}'`
  );
  const result = {};
  if (!rows.length) return result;
  for (const [playerKey, win] of rows[0].values) {
    if (!result[playerKey]) result[playerKey] = { wins: 0, losses: 0 };
    if (win) result[playerKey].wins++;
    else     result[playerKey].losses++;
  }
  return result;
}

export async function ready() {
  return initDb();
}

export default db;
