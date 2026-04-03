import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLASH_CACHE_PATH = path.join(__dirname, "..", "clash-cache.json");

export function loadClashCache() {
  try {
    if (fs.existsSync(CLASH_CACHE_PATH)) return JSON.parse(fs.readFileSync(CLASH_CACHE_PATH, "utf8"));
  } catch (e) { }
  return {};
}

export function saveClashCache(cache) {
  try { fs.writeFileSync(CLASH_CACHE_PATH, JSON.stringify(cache)); }
  catch (e) { console.log("⚠️ Clash cache save failed:", e.message); }
}
