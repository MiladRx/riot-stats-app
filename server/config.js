// --- Seasons ---
export const SEASONS = {
  "2026": { label: "Season 2026", start: 1768000000, end: null },
  "2025": { label: "Season 2025", start: 1736380800, end: 1768000000 },
  "2024": { label: "Season 2024", start: 1704844800, end: 1736380800 },
  "2023": { label: "Season 2023", start: 1673395200, end: 1704844800 },
};
export const CURRENT_SEASON = "2026";
export const QUEUE_IDS = { solo: 420, flex: 440, clash: 700 };

// --- Full Player Roster ---
export const FULL_SQUAD = [
  { gameName: "adam1276", tagLine: "EUNE" },
  { gameName: "Spirifan3", tagLine: "Faker" },
  { gameName: "moroccan dealer", tagLine: "pimp" },
  { gameName: "Pas på", tagLine: "00007" },
  { gameName: "La Cabra", tagLine: "III" },
  { gameName: "mohsh", tagLine: "EUNE" },
  { gameName: "Fåce", tagLine: "TAP" },
  { gameName: "Milad", tagLine: "EXE" },
  { gameName: "LittlestJeff1", tagLine: "goyem" },
  { gameName: "DÅRK", tagLine: "ABO" },
  { gameName: "DARWIZZY", tagLine: "HØES" },
  { gameName: "La Cabra II", tagLine: "Qlawi" },
];

export const CACHE_DURATION = 10 * 60 * 1000;       // 10 minutes
export const FETCH_DELAY_MS = 700;                   // ~85 req/min — safely under Riot 100/2min, optimized for Vercel 60s timeout
export const MAX_MATCH_PAGES_PER_PLAYER = 2;         // Fetch ~40 recent games per player (2 pages × 20 games) — safe Vercel timeout, cache keeps all old games
export const AUTO_FETCH_INTERVAL = 5 * 60 * 1000;  // 5 minutes
