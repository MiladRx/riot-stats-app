import crypto from "crypto";
import puppeteer from "puppeteer";
import { getDuoStats, getStreaks } from "./db.js";
import { FULL_SQUAD, CURRENT_SEASON } from "./config.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
function displayName(playerKey) {
  const found = FULL_SQUAD.find(p =>
    `${p.gameName}#${p.tagLine}`.toLowerCase() === playerKey.toLowerCase()
  );
  return found ? found.gameName : playerKey.split("#")[0];
}

// ── Signature verification (required by Discord) ──────────────────────────────
function verifyDiscordSignature(publicKey, signature, timestamp, rawBody) {
  try {
    // Wrap raw 32-byte ed25519 public key in SPKI DER format so Node crypto accepts it
    const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
    const keyBuffer  = Buffer.concat([spkiPrefix, Buffer.from(publicKey, "hex")]);
    const key = crypto.createPublicKey({ key: keyBuffer, format: "der", type: "spki" });
    return crypto.verify(
      null,
      Buffer.from(timestamp + rawBody),
      key,
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}

// ── Register /duo slash command ───────────────────────────────────────────────
export async function registerCommands() {
  const appId   = process.env.DISCORD_APP_ID;
  const token   = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!appId || !token) {
    console.log("⚠️  DISCORD_APP_ID or DISCORD_BOT_TOKEN not set — skipping slash command registration");
    return;
  }

  const url = guildId
    ? `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
    : `https://discord.com/api/v10/applications/${appId}/commands`;

  const commands = [
    { name: "duo",    description: "Show squad duo win rates and games played" },
    { name: "streak", description: "Show current win/loss streaks for each player" },
  ];

  for (const body of commands) {
    const res = await fetch(url, {
      method:  "POST",
      headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    if (res.ok) console.log(`✅ /${body.name} slash command registered`);
    else console.warn(`⚠️  Failed to register /${body.name}:`, await res.text());
  }
}

// Keep old export name for backwards compat
export const registerDuoCommand = registerCommands;

// ── Build duo card HTML ───────────────────────────────────────────────────────
export function buildDuoHTML(duos) {
  // Sort by win rate descending
  const sorted = duos.slice().sort((a, b) => (b.wins / b.games) - (a.wins / a.games));

  const rows = sorted.map((d, i) => {
    const wr      = d.games > 0 ? Math.round((d.wins / d.games) * 100) : 0;
    const losses  = d.games - d.wins;
    const name1   = displayName(d.p1);
    const name2   = displayName(d.p2);
    const medals  = ["&#x1F947;","&#x1F948;","&#x1F949;"];
    const medal   = i < 3 ? medals[i] : String(i + 1);
    const wrColor = wr >= 55 ? "#30d158" : wr >= 50 ? "#ffd60a" : "#ff453a";
    const rowBg   = wr >= 55 ? "rgba(48,209,88,0.04)" : wr >= 50 ? "rgba(255,214,10,0.04)" : "rgba(255,69,58,0.04)";
    const rowBdr  = wr >= 55 ? "rgba(48,209,88,0.12)" : wr >= 50 ? "rgba(255,214,10,0.12)" : "rgba(255,69,58,0.12)";

    return `
    <div class="duo-row" style="background:${rowBg};border-color:${rowBdr}">
      <div class="duo-top">
        <div class="duo-medal${i >= 3 ? ' num' : ''}">${medal}</div>
        <div class="duo-info">
          <div class="duo-names">
            <span class="duo-n1">${name1}</span>
            <span class="duo-sep">+</span>
            <span class="duo-n2">${name2}</span>
          </div>
          <div class="duo-record">
            <span class="duo-w">${d.wins}W</span>
            <span class="duo-divider">·</span>
            <span class="duo-l">${losses}L</span>
            <span class="duo-divider">·</span>
            <span class="duo-g">${d.games} games</span>
          </div>
        </div>
        <div class="duo-wr" style="color:${wrColor};text-shadow:0 0 18px ${wrColor}80">${wr}%</div>
      </div>
      <div class="duo-bar-wrap">
        <div class="duo-bar" style="width:${wr}%;background:${wrColor};box-shadow:0 0 10px ${wrColor}60;opacity:0.7"></div>
      </div>
    </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&family=Noto+Sans:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans', 'Segoe UI', sans-serif; background: #0e0e15; width: 1380px; }

  .card {
    width: 1380px;
    background: linear-gradient(160deg, #16161f 0%, #0e0e15 100%);
    border-radius: 24px;
    border: 1px solid rgba(255,255,255,0.07);
    overflow: hidden;
    position: relative;
  }

  .shimmer {
    height: 3px;
    background: linear-gradient(90deg, transparent, #0a84ff, #5ac8fa, #0a84ff, transparent);
  }

  .bg-glow {
    position: absolute;
    top: -40px; left: 50%;
    transform: translateX(-50%);
    width: 320px; height: 320px;
    background: radial-gradient(circle, rgba(10,132,255,0.1) 0%, transparent 70%);
    pointer-events: none;
  }

  .inner {
    padding: 28px 28px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    z-index: 1;
  }

  .duo-grid {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
  }

  .header {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    margin-bottom: 20px;
  }
  .status-pill {
    font-size: 10px; font-weight: 900; letter-spacing: 3px;
    text-transform: uppercase;
    color: #5ac8fa;
    background: rgba(10,132,255,0.12);
    border: 1px solid rgba(10,132,255,0.3);
    border-radius: 30px;
    padding: 5px 18px;
  }
  .status-sub {
    font-size: 10px; color: rgba(255,255,255,0.25);
    letter-spacing: 1px; text-transform: uppercase;
  }

  .duo-row {
    width: 100%;
    border: 1px solid;
    border-radius: 16px;
    padding: 14px 16px 11px;
  }

  .duo-top {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
  }

  .duo-medal {
    font-size: 22px;
    flex-shrink: 0;
    font-family: 'Noto Color Emoji', sans-serif;
    line-height: 1;
    width: 28px;
    text-align: center;
  }
  .duo-medal.num {
    font-family: 'Noto Sans', sans-serif;
    font-size: 12px;
    font-weight: 800;
    width: 26px; height: 26px;
    border-radius: 50%;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.4);
    display: flex; align-items: center; justify-content: center;
    line-height: 1;
  }

  .duo-info { flex: 1; min-width: 0; }

  .duo-names {
    display: flex; align-items: center; gap: 6px;
    margin-bottom: 5px;
  }
  .duo-n1, .duo-n2 {
    font-size: 15px; font-weight: 800; color: #fff;
    white-space: nowrap;
  }
  .duo-sep { font-size: 13px; color: rgba(255,255,255,0.2); font-weight: 400; }

  .duo-record {
    display: flex; align-items: center; gap: 5px;
  }
  .duo-w  { font-size: 11px; font-weight: 700; color: #30d158; }
  .duo-l  { font-size: 11px; font-weight: 700; color: #ff453a; }
  .duo-g  { font-size: 11px; color: rgba(255,255,255,0.25); }
  .duo-divider { font-size: 10px; color: rgba(255,255,255,0.15); }

  .duo-wr {
    font-size: 26px; font-weight: 900;
    margin-left: auto; flex-shrink: 0;
    letter-spacing: -0.5px;
  }

  .duo-bar-wrap {
    height: 3px;
    background: rgba(255,255,255,0.06);
    border-radius: 3px;
    overflow: hidden;
  }
  .duo-bar { height: 100%; border-radius: 3px; }

  .footer {
    font-size: 10px; color: #252530;
    text-transform: uppercase; letter-spacing: 1.5px;
    margin-top: 18px;
  }
</style>
</head>
<body>
<div class="card">
  <div class="shimmer"></div>
  <div class="bg-glow"></div>
  <div class="inner">
    <div class="header">
      <div class="status-pill">TOP DUOS</div>
      <div class="status-sub">Season 2026 · Solo/Duo · Min. 5 games</div>
    </div>
    <div class="duo-grid">${rows}</div>
    <div class="footer">Squad Tracker</div>
  </div>
</div>
</body>
</html>`;
}

// ── Build streak card HTML ────────────────────────────────────────────────────
export function buildStreakHTML(streaks) {
  const makeCard = ({ playerKey, win, streak }) => {
    const name    = displayName(playerKey);
    const color   = win ? "#30d158" : "#ff453a";
    const bgColor = win ? "rgba(48,209,88,0.05)"  : "rgba(255,69,58,0.05)";
    const border  = win ? "rgba(48,209,88,0.15)"  : "rgba(255,69,58,0.15)";
    const icon    = win ? "🔥" : "❄️";
    const label   = win ? `${streak}W` : `${streak}L`;
    const bars    = Array.from({ length: Math.min(streak, 10) }, (_, i) =>
      `<div class="bar" style="background:${color};opacity:${0.25 + (i / Math.min(streak, 10)) * 0.75}"></div>`
    ).join("");
    return `
    <div class="row" style="background:${bgColor};border-color:${border}">
      <div class="icon">${icon}</div>
      <div class="info">
        <div class="name">${name}</div>
        <div class="bars">${bars}</div>
      </div>
      <div class="streak-val" style="color:${color};text-shadow:0 0 16px ${color}80">${label}</div>
    </div>`;
  };

  const hot  = streaks.filter(s =>  s.win).sort((a, b) => b.streak - a.streak);
  const cold = streaks.filter(s => !s.win).sort((a, b) => b.streak - a.streak);

  const hotRows  = hot.map(makeCard).join("") || `<div class="empty">No win streaks</div>`;
  const coldRows = cold.map(makeCard).join("") || `<div class="empty">No loss streaks</div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&family=Noto+Sans:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans', 'Segoe UI', sans-serif; background: #0e0e15; width: 860px; }

  .card {
    width: 860px;
    background: linear-gradient(160deg, #16161f 0%, #0e0e15 100%);
    border-radius: 24px;
    border: 1px solid rgba(255,255,255,0.07);
    overflow: hidden;
    position: relative;
  }
  .shimmer { height: 3px; background: linear-gradient(90deg, transparent, #30d158, #ff453a, #30d158, transparent); }
  .bg-glow {
    position: absolute; top: -40px; left: 50%;
    transform: translateX(-50%);
    width: 500px; height: 300px;
    background: radial-gradient(ellipse, rgba(255,255,255,0.03) 0%, transparent 70%);
    pointer-events: none;
  }
  .inner {
    padding: 28px 28px 24px;
    display: flex; flex-direction: column; align-items: center;
    position: relative; z-index: 1;
  }
  .header { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-bottom: 20px; }
  .status-pill {
    font-size: 10px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase;
    color: #5ac8fa; background: rgba(10,132,255,0.12);
    border: 1px solid rgba(10,132,255,0.3); border-radius: 30px; padding: 5px 18px;
  }
  .status-sub { font-size: 10px; color: rgba(255,255,255,0.25); letter-spacing: 1px; text-transform: uppercase; }

  .cols {
    width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
  }

  .col-header {
    font-size: 11px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase;
    margin-bottom: 10px; display: flex; align-items: center; gap: 7px;
  }
  .col-header.hot  { color: #30d158; }
  .col-header.cold { color: #ff453a; }
  .col-header-icon { font-family: 'Noto Color Emoji', sans-serif; font-size: 15px; }

  .row {
    width: 100%; display: flex; align-items: center; gap: 12px;
    border: 1px solid; border-radius: 14px;
    padding: 12px 14px; margin-bottom: 7px;
  }
  .row:last-child { margin-bottom: 0; }

  .icon { font-size: 22px; font-family: 'Noto Color Emoji', sans-serif; flex-shrink: 0; width: 28px; text-align: center; }

  .info { flex: 1; min-width: 0; }
  .name { font-size: 14px; font-weight: 800; color: #fff; margin-bottom: 7px; }

  .bars { display: flex; gap: 3px; align-items: flex-end; height: 12px; }
  .bar  { width: 7px; height: 100%; border-radius: 2px; }

  .streak-val { font-size: 20px; font-weight: 900; flex-shrink: 0; letter-spacing: -0.5px; }

  .empty { font-size: 12px; color: rgba(255,255,255,0.2); padding: 12px 0; }

  .footer { font-size: 10px; color: #252530; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 18px; }
</style>
</head>
<body>
<div class="card">
  <div class="shimmer"></div>
  <div class="bg-glow"></div>
  <div class="inner">
    <div class="header">
      <div class="status-pill">CURRENT STREAKS</div>
      <div class="status-sub">Season 2026 · Solo/Duo · Last 20 games</div>
    </div>
    <div class="cols">
      <div>
        <div class="col-header hot"><span class="col-header-icon">🔥</span> On Fire</div>
        ${hotRows}
      </div>
      <div>
        <div class="col-header cold"><span class="col-header-icon">❄️</span> Ice Cold</div>
        ${coldRows}
      </div>
    </div>
    <div class="footer">Squad Tracker</div>
  </div>
</div>
</body>
</html>`;
}

// ── Render card image ─────────────────────────────────────────────────────────
export async function renderDuoCard(html) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1380, height: 1200, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    const card = await page.$(".card");
    return await card.screenshot({ type: "png" });
  } finally {
    await browser.close();
  }
}

// ── Follow-up response with image ─────────────────────────────────────────────
async function sendFollowUp(appId, token, buffer, filename = "card.png") {
  const form = new FormData();
  form.append("files[0]", new Blob([buffer], { type: "image/png" }), filename);
  form.append("payload_json", JSON.stringify({ flags: 4096 }));
  const res = await fetch(
    `https://discord.com/api/v10/webhooks/${appId}/${token}`,
    { method: "POST", body: form }
  );
  if (!res.ok) console.warn("Follow-up failed:", res.status, await res.text());
}

// Keep old name as alias
async function sendDuoResponse(appId, token, buffer) {
  return sendFollowUp(appId, token, buffer, "duo-stats.png");
}

// ── Express interaction handler ───────────────────────────────────────────────
export function handleDiscordInteraction(req, res) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  const signature = req.headers["x-signature-ed25519"];
  const timestamp = req.headers["x-signature-timestamp"];
  const rawBody   = req.rawBody || "";

  // Verify signature
  if (!rawBody) return res.status(400).send("Empty body");
  const valid = publicKey && verifyDiscordSignature(publicKey, signature, timestamp, rawBody);
  if (!valid) return res.status(401).send("Invalid signature");

  const body = JSON.parse(rawBody);
  console.log(`Discord interaction: type=${body.type}`);

  // Discord PING
  if (body.type === 1) return res.json({ type: 1 });

  if (body.type !== 2) return;

  const appId = process.env.DISCORD_APP_ID;
  const interactionToken = body.token;
  const commandName = body.data?.name;

  // Acknowledge immediately (deferred silent response)
  res.json({ type: 5, data: { flags: 4096 } });

  setImmediate(async () => {
    try {
      if (commandName === "duo") {
        const duos = getDuoStats(CURRENT_SEASON, "solo", 5);
        if (!duos.length) {
          await fetch(`https://discord.com/api/v10/webhooks/${appId}/${interactionToken}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: "No duo data yet — play some games together first!" }),
          });
          return;
        }
        const buffer = await renderDuoCard(buildDuoHTML(duos));
        await sendFollowUp(appId, interactionToken, buffer, "duo-stats.png");

      } else if (commandName === "streak") {
        const streaks = getStreaks(CURRENT_SEASON, "solo");
        if (!streaks.length) {
          await fetch(`https://discord.com/api/v10/webhooks/${appId}/${interactionToken}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: "No match data yet!" }),
          });
          return;
        }
        const buffer = await renderDuoCard(buildStreakHTML(streaks));
        await sendFollowUp(appId, interactionToken, buffer, "streaks.png");
      }
    } catch (e) {
      console.warn(`${commandName} command error:`, e.message);
    }
  });
}
