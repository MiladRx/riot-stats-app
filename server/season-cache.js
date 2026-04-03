import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function cachePath(season, mode) {
  return path.join(DATA_DIR, `season-${season}-${mode}.json`);
}

export function loadSeasonCache(season, mode) {
  try {
    const p = cachePath(season, mode);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
    // Migration: fall back to legacy cache files on first load
    if (season === "2025" && mode === "solo") {
      const legacy = path.join(__dirname, "..", "match-cache.json");
      if (fs.existsSync(legacy)) return JSON.parse(fs.readFileSync(legacy, "utf8"));
    }
    if (season === "2025" && mode === "clash") {
      const legacy = path.join(__dirname, "..", "clash-cache.json");
      if (fs.existsSync(legacy)) return JSON.parse(fs.readFileSync(legacy, "utf8"));
    }
  } catch (e) { }
  return {};
}

export function saveSeasonCache(season, mode, cache) {
  try {
    ensureDataDir();
    fs.writeFileSync(cachePath(season, mode), JSON.stringify(cache));
  } catch (e) {
    console.log(`⚠️ Cache save failed (${season}-${mode}):`, e.message);
  }
}

export function getSeasonCacheSummary(season, mode, players) {
  const cache = loadSeasonCache(season, mode);
  return players.map(p => {
    const key = `${p.gameName}#${p.tagLine}`.toLowerCase();
    const entry = cache[key];
    const total = entry ? Object.keys(entry.matches || {}).length : 0;
    const lastUpdated = entry?.lastUpdated || null;
    return { gameName: p.gameName, tagLine: p.tagLine, total, lastUpdated };
  });
}
