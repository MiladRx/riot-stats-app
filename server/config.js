// --- Seasons ---
export const SEASONS = {
  "2026": { label: "Season 2026", start: 1768000000, end: null },
  "2025": { label: "Season 2025", start: 1736380800, end: 1768000000 },
  "2024": { label: "Season 2024", start: 1704844800, end: 1736380800 },
  "2023": { label: "Season 2023", start: 1673395200, end: 1704844800 },
};
export const CURRENT_SEASON = "2026";
export const QUEUE_IDS = { solo: 420, clash: 700 };

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
  { gameName: "biigdaddy", tagLine: "EUNE" },
];

export const CACHE_DURATION       = 10 * 60 * 1000;  // 10 minutes
export const FETCH_DELAY_MS       = 1300;             // 1 req/1.3s = ~46/min — safely under Riot 50/min (100 req/2 min) personal key limit
export const AUTO_CYCLE_MAX_PAGES = 1;               // Auto-cycle checks only the latest page (20 games) per player — fast, catches new games
export const AUTO_FETCH_INTERVAL  = 5 * 60 * 1000;  // Auto cycle every 5 minutes
export const RANK_CONCURRENCY     = 2;               // Fetch rank data for N players at once during refreshSquadCache
export const FETCH_RETRY_ATTEMPTS = 2;               // Retry transient failures (rate limits, network blips) before marking a player as errored
