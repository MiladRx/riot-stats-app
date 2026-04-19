import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getMatchesSince } from "./db.js";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir   = path.join(__dirname, "..", "data");

function getWebhookUrl() { return process.env.DISCORD_WEBHOOK_URL; }

const TIER_EMOJI = {
  IRON: "⬛", BRONZE: "🟫", SILVER: "🩶", GOLD: "🟡",
  PLATINUM: "🩵", EMERALD: "💚", DIAMOND: "💎",
  MASTER: "🟣", GRANDMASTER: "🔴", CHALLENGER: "🔵",
};

const TIER_COLOR = {
  IRON: "#8c7b6b", BRONZE: "#cd7f32", SILVER: "#a8b2bd", GOLD: "#c89b3c",
  PLATINUM: "#4db6ac", EMERALD: "#30d158", DIAMOND: "#9cb4e8",
  MASTER: "#bf5af2", GRANDMASTER: "#ff453a", CHALLENGER: "#ffd60a",
};

const TIER_VAL = { IRON:0,BRONZE:400,SILVER:800,GOLD:1200,PLATINUM:1600,EMERALD:2000,DIAMOND:2400,MASTER:2800,GRANDMASTER:3200,CHALLENGER:3600 };
const RANK_VAL = { IV:0,III:100,II:200,I:300 };
const NO_DIV   = new Set(["MASTER","GRANDMASTER","CHALLENGER"]);

function fullLP(tier, rank, lp) {
  return (TIER_VAL[tier]||0) + (NO_DIV.has(tier) ? 0 : (RANK_VAL[rank]||0)) + (lp||0);
}

function copenhagenDate() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Copenhagen" }).format(new Date());
}

// One-time floor: ignore all matches before this point (system launch date)
// Set to null to disable once the first full 24h cycle has passed
const RECAP_FLOOR_MS = new Date("2026-04-18T21:00:00+02:00").getTime();

// Returns the timestamp of the most recent 21:00 Copenhagen (yesterday's 21:00)
function lastRecapMs() {
  const now = new Date();
  const copenhagenNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Copenhagen" }));
  const utcNow        = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs      = copenhagenNow - utcNow;

  const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Copenhagen" }).format(now);
  let last2100 = new Date(`${date}T21:00:00`);
  last2100 = new Date(last2100.getTime() - offsetMs);

  // If we haven't hit 21:00 yet today, go back to yesterday's 21:00
  if (last2100 > now) last2100 = new Date(last2100.getTime() - 24 * 60 * 60 * 1000);
  return last2100.getTime();
}

function getTodayGamesFromDB() {
  const since = Math.max(lastRecapMs(), RECAP_FLOOR_MS ?? 0);
  return getMatchesSince(since);
}

// ── Build HTML card ────────────────────────────────────────────────────────────
function buildRecapHTML(rows, date) {
  const mvp = rows[0];

  const playerRows = rows.map((r, i) => {
    const color   = TIER_COLOR[r.tier] || "#fff";
    const wrColor = r.wr >= 60 ? "#30d158" : r.wr <= 40 ? "#ff453a" : "#888";
    const medals  = ["🥇", "🥈", "🥉"];
    const medal   = medals[i] || "";
    const isMvp   = i === 0;

    return `
      <div class="row ${isMvp ? "row-mvp" : ""}">
        <div class="medal">${medal}</div>
        <div class="dot" style="background:${color};box-shadow:0 0 6px ${color}88"></div>
        <div class="name">${r.gameName}</div>
        <div class="wl">
          <span class="w">${r.wins}W</span>
          <span class="sep">/</span>
          <span class="l">${r.losses}L</span>
        </div>
        <div class="wr-col">
          <div class="bar">
            <div class="bar-win"  style="width:${r.wr}%"></div>
            <div class="bar-loss" style="width:${100 - r.wr}%"></div>
          </div>
          <div class="wr-pct" style="color:${wrColor}">${r.wr}%</div>
        </div>
        <div class="status">${r.status}</div>
      </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&family=Noto+Sans:wght@400;600;700;800&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans', 'Segoe UI', sans-serif; background: transparent; width: 500px; }
  .medal, .status, .mvp-crown, .title { font-family: 'Noto Color Emoji', 'Noto Sans', sans-serif; }

  .card {
    width: 500px;
    background: linear-gradient(160deg, #16161f 0%, #0e0e15 100%);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 24px;
    overflow: hidden;
    position: relative;
  }

  .shimmer {
    height: 3px;
    background: linear-gradient(90deg, transparent, #ffd60a, transparent);
  }

  .bg-glow {
    position: absolute; top: -60px; left: 50%;
    transform: translateX(-50%);
    width: 400px; height: 260px;
    background: radial-gradient(circle, rgba(255,214,10,0.1) 0%, transparent 70%);
    pointer-events: none;
  }

  .inner {
    padding: 24px 24px 20px;
    position: relative;
    z-index: 1;
  }

  /* header */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }
  .title {
    font-size: 16px;
    font-weight: 800;
    color: #fff;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .date-pill {
    font-size: 11px;
    font-weight: 600;
    color: #555;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 20px;
    padding: 3px 12px;
    letter-spacing: 0.5px;
  }

  /* MVP banner */
  .mvp-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    background: linear-gradient(90deg, rgba(255,214,10,0.1), transparent);
    border: 1px solid rgba(255,214,10,0.2);
    border-radius: 12px;
    padding: 10px 14px;
    margin-bottom: 14px;
  }
  .mvp-crown { font-size: 20px; }
  .mvp-text { font-size: 13px; font-weight: 700; color: #ffd60a; }
  .mvp-sub  { font-size: 11px; color: rgba(255,214,10,0.5); margin-top: 1px; }

  .divider {
    height: 1px;
    background: rgba(255,255,255,0.05);
    margin-bottom: 12px;
  }

  /* rows */
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 14px;
    margin-bottom: 6px;
    background: rgba(255,255,255,0.02);
    border: 1px solid transparent;
  }
  .row-mvp {
    background: rgba(255,214,10,0.05);
    border-color: rgba(255,214,10,0.15);
  }
  .medal { font-size: 15px; width: 20px; text-align:center; flex-shrink:0; }
  .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .name {
    font-size: 14px; font-weight: 700; color: #e0e0ee;
    flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .wl {
    display: flex; gap: 4px; align-items: center;
    font-size: 13px; font-weight: 700;
    min-width: 70px; justify-content: flex-end;
  }
  .w { color: #30d158; }
  .l { color: #ff453a; }
  .sep { color: #333; }

  .wr-col {
    display: flex; flex-direction: column; align-items: flex-end; gap: 3px;
    min-width: 58px;
  }
  .bar {
    display: flex; height: 3px; width: 54px;
    border-radius: 4px; overflow: hidden; gap: 1px;
  }
  .bar-win  { background: #30d158; border-radius: 4px 0 0 4px; }
  .bar-loss { background: #ff453a; border-radius: 0 4px 4px 0; }
  .wr-pct { font-size: 11px; font-weight: 800; }
  .status { font-size: 15px; width: 20px; text-align:center; flex-shrink:0; }

  .footer {
    text-align: center; font-size: 10px; color: #252530;
    text-transform: uppercase; letter-spacing: 1.5px; margin-top: 16px;
  }
</style>
</head>
<body>
<div class="card">
  <div class="shimmer"></div>
  <div class="bg-glow"></div>
  <div class="inner">
    <div class="header">
      <div class="title">&#x1F4CA; Daily Recap</div>
      <div class="date-pill">${date}</div>
    </div>
    ${mvp ? `
    <div class="mvp-banner">
      <div class="mvp-crown">👑</div>
      <div>
        <div class="mvp-text">MVP — ${mvp.gameName}</div>
        <div class="mvp-sub">${mvp.wins}W ${mvp.losses}L · ${mvp.wr}% WR</div>
      </div>
    </div>` : ""}
    <div class="divider"></div>
    ${playerRows}
    <div class="footer">Squad Tracker</div>
  </div>
</div>
</body>
</html>`;
}

// ── Render HTML → PNG buffer ───────────────────────────────────────────────────
async function renderRecapImage(html) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 480, height: 800, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    const card = await page.$(".card");
    const buffer = await card.screenshot({ type: "png", omitBackground: true });
    return buffer;
  } finally {
    await browser.close();
  }
}

// ── Post image to Discord ──────────────────────────────────────────────────────
async function postImageToDiscord(webhookUrl, imageBuffer, date) {
  const form = new FormData();
  form.append("files[0]", new Blob([imageBuffer], { type: "image/png" }), `recap-${date}.png`);
  form.append("payload_json", JSON.stringify({ content: "<@&1495245177147621427>" }));

  const res = await fetch(webhookUrl, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord ${res.status}: ${text}`);
  }
}

// ── Main export ────────────────────────────────────────────────────────────────
export async function postDailyRecap(squadPlayers) {
  const WEBHOOK_URL = getWebhookUrl();
  if (!WEBHOOK_URL) { console.error("❌ DISCORD_WEBHOOK_URL not set"); return; }

  const date      = copenhagenDate();
  const todayByDB = getTodayGamesFromDB();
  const rows      = [];

  for (const p of squadPlayers) {
    if (p.error || !p.solo || p.isAlt) continue;
    const key     = `${p.gameName}#${p.tagLine}`.toLowerCase();
    const dbStats = todayByDB[key] || { wins: 0, losses: 0 };
    const { wins, losses } = dbStats;
    const games = wins + losses;
    if (games === 0) continue;

    let status = "";
    if (wins / games >= 0.6 && games >= 3)        status = "🔥";
    else if (losses / games >= 0.6 && games >= 3)  status = "💀";
    else if (wins > losses)                         status = "📈";
    else if (losses > wins)                         status = "📉";
    else                                            status = "➖";

    const wr = Math.round(wins / games * 100);
    rows.push({ gameName: p.gameName, tier: p.solo.tier, wins, losses, wr, status, games });
  }

  rows.sort((a, b) => b.games - a.games || b.wr - a.wr || b.wins - a.wins);

  if (rows.length === 0) {
    console.log("📊 No games today — skipping recap.");
    return;
  }

  console.log("🎨 Rendering recap image…");
  const html   = buildRecapHTML(rows, date);
  const buffer = await renderRecapImage(html);

  console.log("📨 Posting recap image to Discord…");
  await postImageToDiscord(WEBHOOK_URL, buffer, date);
  console.log("✅ Daily recap image posted.");
}

// ── Scheduler ─────────────────────────────────────────────────────────────────
export function startDailyRecapScheduler(getSquad) {
  function scheduleNext() {
    const now = new Date();
    const copenhagenNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Copenhagen" }));
    const utcNow        = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
    const offsetMs      = copenhagenNow - utcNow;
    const date  = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Copenhagen" }).format(now);
    let next2100 = new Date(`${date}T21:00:00`);
    next2100     = new Date(next2100.getTime() - offsetMs);
    if (next2100 <= now) next2100 = new Date(next2100.getTime() + 24 * 60 * 60 * 1000);
    const msUntil = next2100 - now;
    console.log(`⏰ Daily recap scheduled in ${Math.round(msUntil / 60000)} min (21:00 Copenhagen)`);
    setTimeout(async () => { await postDailyRecap(getSquad()); scheduleNext(); }, msUntil);
  }

  function scheduleMidnightSnap() {
    const now           = new Date();
    const copenhagenNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Copenhagen" }));
    const utcNow        = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
    const offsetMs      = copenhagenNow - utcNow;
    const tomorrow = new Date(copenhagenNow);
    tomorrow.setHours(0, 1, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextMidnight = new Date(tomorrow.getTime() - offsetMs);
    setTimeout(() => { saveDailySnapshot(getSquad()); scheduleMidnightSnap(); }, nextMidnight - now);
  }

  scheduleNext();
}

// ── Midnight LP snapshot ───────────────────────────────────────────────────────
export function saveDailySnapshot(squadPlayers) {
  const date = copenhagenDate();
  const snap = { date, savedAt: Date.now(), players: {} };
  for (const p of squadPlayers) {
    if (p.error || !p.solo) continue;
    const key = `${p.gameName}#${p.tagLine}`.toLowerCase();
    snap.players[key] = { tier: p.solo.tier, rank: p.solo.rank, lp: p.solo.lp };
  }
  fs.writeFileSync(path.join(dataDir, `daily-snapshot-${date}.json`), JSON.stringify(snap, null, 2));
  console.log(`📸 Daily LP snapshot saved for ${date}`);
}
