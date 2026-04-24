import crypto from "crypto";
import puppeteer from "puppeteer";
import { getDuoStats } from "./db.js";
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
export async function registerDuoCommand() {
  const appId   = process.env.DISCORD_APP_ID;
  const token   = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID; // optional — guild-scoped = instant update
  if (!appId || !token) {
    console.log("⚠️  DISCORD_APP_ID or DISCORD_BOT_TOKEN not set — skipping slash command registration");
    return;
  }

  const url = guildId
    ? `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
    : `https://discord.com/api/v10/applications/${appId}/commands`;

  const body = {
    name:        "duo",
    description: "Show top 3 duos by games played and win rate",
  };

  const res = await fetch(url, {
    method:  "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });

  if (res.ok) {
    console.log("✅ /duo slash command registered");
  } else {
    const err = await res.text();
    console.warn("⚠️  Failed to register /duo command:", err);
  }
}

// ── Build duo card HTML ───────────────────────────────────────────────────────
function buildDuoHTML(duos) {
  const rows = duos.slice(0, 3).map((d, i) => {
    const wr      = d.games > 0 ? Math.round((d.wins / d.games) * 100) : 0;
    const name1   = displayName(d.p1);
    const name2   = displayName(d.p2);
    const medals  = ["🥇","🥈","🥉"];
    const wrColor = wr >= 55 ? "#30d158" : wr >= 50 ? "#ffd60a" : "#ff453a";

    return `
    <div class="duo-row">
      <div class="duo-rank">${medals[i]}</div>
      <div class="duo-names">
        <span class="duo-n1">${name1}</span>
        <span class="duo-sep">+</span>
        <span class="duo-n2">${name2}</span>
      </div>
      <div class="duo-stats">
        <div class="duo-wr" style="color:${wrColor}">${wr}%</div>
        <div class="duo-games">${d.games} games</div>
      </div>
      <div class="duo-bar-wrap">
        <div class="duo-bar" style="width:${wr}%;background:${wrColor}"></div>
      </div>
    </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans', sans-serif; background: transparent; width: 460px; }

  .card {
    width: 460px;
    background: linear-gradient(160deg, #16161f 0%, #0e0e15 100%);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 24px;
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
    background: radial-gradient(circle, rgba(10,132,255,0.12) 0%, transparent 70%);
    pointer-events: none;
  }

  .inner {
    padding: 24px 28px 28px;
    position: relative;
    z-index: 1;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 22px;
  }
  .header-icon { font-size: 22px; }
  .header-title {
    font-size: 18px; font-weight: 800; color: #fff;
  }
  .header-sub {
    font-size: 11px; color: rgba(255,255,255,0.35);
    text-transform: uppercase; letter-spacing: 1px;
    margin-top: 1px;
  }

  .duo-row {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 14px;
    padding: 14px 16px 10px;
    margin-bottom: 10px;
  }
  .duo-row:last-child { margin-bottom: 0; }

  .duo-rank {
    font-size: 18px;
    margin-bottom: 6px;
  }

  .duo-names {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .duo-n1, .duo-n2 {
    font-size: 15px; font-weight: 700; color: #fff;
  }
  .duo-sep {
    font-size: 13px; color: rgba(255,255,255,0.3); font-weight: 400;
  }

  .duo-stats {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 8px;
  }
  .duo-wr {
    font-size: 20px; font-weight: 800;
  }
  .duo-games {
    font-size: 11px; color: rgba(255,255,255,0.35);
    text-transform: uppercase; letter-spacing: 0.8px;
  }

  .duo-bar-wrap {
    height: 3px;
    background: rgba(255,255,255,0.07);
    border-radius: 2px;
    overflow: hidden;
  }
  .duo-bar {
    height: 100%;
    border-radius: 2px;
    opacity: 0.85;
  }

  .footer {
    font-size: 10px; color: rgba(255,255,255,0.15);
    text-transform: uppercase; letter-spacing: 1.5px;
    margin-top: 18px; text-align: center;
  }
</style>
</head>
<body>
<div class="card">
  <div class="shimmer"></div>
  <div class="bg-glow"></div>
  <div class="inner">
    <div class="header">
      <div class="header-icon">🤝</div>
      <div>
        <div class="header-title">Top Duos</div>
        <div class="header-sub">Season 2026 · Solo/Duo</div>
      </div>
    </div>
    ${rows}
    <div class="footer">Squad Tracker</div>
  </div>
</div>
</body>
</html>`;
}

// ── Render card image ─────────────────────────────────────────────────────────
async function renderDuoCard(html) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 460, height: 600, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    const card = await page.$(".card");
    return await card.screenshot({ type: "png" });
  } finally {
    await browser.close();
  }
}

// ── Follow-up response with image ─────────────────────────────────────────────
async function sendDuoResponse(appId, token, buffer) {
  const form = new FormData();
  form.append("files[0]", new Blob([buffer], { type: "image/png" }), "duo-stats.png");
  form.append("payload_json", JSON.stringify({}));

  const res = await fetch(
    `https://discord.com/api/v10/webhooks/${appId}/${token}`,
    { method: "POST", body: form }
  );
  if (!res.ok) console.warn("Duo follow-up failed:", res.status, await res.text());
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

  // Slash command
  if (body.type === 2 && body.data?.name === "duo") {
    // Acknowledge immediately (deferred response)
    res.json({ type: 5 });

    // Generate and send image in background
    const appId = process.env.DISCORD_APP_ID;
    const interactionToken = body.token;

    setImmediate(async () => {
      try {
        const duos = getDuoStats(CURRENT_SEASON, "solo", 3);
        if (duos.length === 0) {
          await fetch(`https://discord.com/api/v10/webhooks/${appId}/${interactionToken}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: "No duo data found yet — play some games together first!" }),
          });
          return;
        }
        const html   = buildDuoHTML(duos);
        const buffer = await renderDuoCard(html);
        await sendDuoResponse(appId, interactionToken, buffer);
      } catch (e) {
        console.warn("Duo command error:", e.message);
      }
    });
  }
}
