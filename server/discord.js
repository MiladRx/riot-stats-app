// Discord webhook notifications — promo/demo image cards
import puppeteer from "puppeteer";

function getWebhookUrl() { return process.env.DISCORD_WEBHOOK_URL; }

const TIER_ORDER    = ["IRON","BRONZE","SILVER","GOLD","PLATINUM","EMERALD","DIAMOND","MASTER","GRANDMASTER","CHALLENGER"];
const RANK_ORDER    = ["IV","III","II","I"];
const NO_DIVISIONS  = new Set(["MASTER","GRANDMASTER","CHALLENGER"]);

const TIER_COLOR = {
  IRON: "#8c7b6b", BRONZE: "#cd7f32", SILVER: "#a8b2bd", GOLD: "#c89b3c",
  PLATINUM: "#4db6ac", EMERALD: "#30d158", DIAMOND: "#9cb4e8",
  MASTER: "#bf5af2", GRANDMASTER: "#ff453a", CHALLENGER: "#ffd60a",
};

const TIER_LABEL = {
  IRON:"Iron", BRONZE:"Bronze", SILVER:"Silver", GOLD:"Gold",
  PLATINUM:"Platinum", EMERALD:"Emerald", DIAMOND:"Diamond",
  MASTER:"Master", GRANDMASTER:"Grandmaster", CHALLENGER:"Challenger",
};

function tierScore(tier, rank) {
  const t = TIER_ORDER.indexOf(tier);
  const r = NO_DIVISIONS.has(tier) ? 0 : RANK_ORDER.indexOf(rank);
  return t * 4 + (3 - r);
}

function rankLabel(tier, rank) {
  if (NO_DIVISIONS.has(tier)) return TIER_LABEL[tier];
  return `${TIER_LABEL[tier]} ${rank}`;
}

// ── Build HTML card ────────────────────────────────────────────────────────────
function buildPromoHTML({ gameName, profileIconId, ddragonVersion, prevTier, prevRank, newTier, newRank, lp, promoted }) {
  const prevLabel   = rankLabel(prevTier, prevRank);
  const newLabel    = rankLabel(newTier, newRank);
  const accent      = TIER_COLOR[newTier]  || "#fff";
  const prevColor   = TIER_COLOR[prevTier] || "#888";
  const iconUrl     = `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion || "16.8.1"}/img/profileicon/${profileIconId || 1}.png`;
  const emblemUrl   = `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/ranked-emblem/emblem-${newTier.toLowerCase()}.png`;
  const badgeColor  = promoted ? accent : "#ff453a";
  const bigText     = promoted ? "PROMOTED" : "DEMOTED";
  const subText     = promoted ? "just ranked up &#x1F525;" : "dropped a rank &#x1F480;";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&family=Noto+Sans:wght@400;600;700;800&display=swap" rel="stylesheet"/>
<style>
  .sub { font-family: 'Noto Color Emoji', 'Noto Sans', sans-serif; }
</style>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans', 'Segoe UI', sans-serif; background: transparent; width: 460px; }
  .status-pill { font-family: 'Noto Sans', sans-serif; }

  .card {
    width: 460px;
    background: linear-gradient(160deg, #16161f 0%, #0e0e15 100%);
    border-radius: 24px;
    border: 1px solid rgba(255,255,255,0.07);
    overflow: hidden;
    position: relative;
  }

  /* top shimmer bar */
  .shimmer {
    height: 3px;
    background: linear-gradient(90deg, transparent, ${badgeColor}, transparent);
  }

  /* big blurred glow behind emblem */
  .bg-glow {
    position: absolute;
    top: -40px; left: 50%;
    transform: translateX(-50%);
    width: 320px; height: 320px;
    background: radial-gradient(circle, ${badgeColor}30 0%, transparent 70%);
    pointer-events: none;
  }

  .inner {
    padding: 28px 32px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    z-index: 1;
  }

  /* PROMOTED / DEMOTED pill */
  .status-pill {
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: ${badgeColor};
    background: ${badgeColor}18;
    border: 1px solid ${badgeColor}50;
    border-radius: 30px;
    padding: 5px 18px;
    margin-bottom: 20px;
  }

  /* rank emblem */
  .emblem {
    width: 100px; height: 100px;
    object-fit: contain;
    filter: drop-shadow(0 0 18px ${accent}55);
    margin-bottom: 18px;
  }

  /* avatar */
  .avatar-ring {
    width: 68px; height: 68px;
    border-radius: 50%;
    border: 3px solid ${accent};
    box-shadow: 0 0 18px ${accent}55;
    overflow: hidden;
    margin-bottom: 12px;
  }
  .avatar-ring img { width: 100%; height: 100%; object-fit: cover; }

  .name {
    font-size: 22px;
    font-weight: 800;
    color: #fff;
    letter-spacing: 0.2px;
    margin-bottom: 4px;
  }
  .sub {
    font-size: 13px;
    color: #555;
    margin-bottom: 24px;
  }

  /* rank transition */
  .rank-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    width: 100%;
    justify-content: center;
  }
  .rank-chip {
    display: flex; align-items: center; gap: 8px;
    padding: 9px 18px;
    border-radius: 14px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
  }
  .rank-chip.new {
    background: ${accent}18;
    border-color: ${accent}50;
    box-shadow: 0 0 12px ${accent}22;
  }
  .dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
  .rank-chip .label { font-size: 14px; font-weight: 700; color: #aaa; }
  .rank-chip.new .label { color: ${accent}; }
  .arrow { font-size: 20px; color: #333; }

  /* LP */
  .lp {
    font-size: 13px; font-weight: 700;
    color: #666;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 30px;
    padding: 6px 20px;
    margin-bottom: 4px;
    letter-spacing: 0.5px;
  }

  .footer {
    font-size: 10px; color: #2a2a35;
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
    <div class="status-pill">${bigText}</div>
    <img class="emblem" src="${emblemUrl}" onerror="this.style.display='none'"/>
    <div class="avatar-ring"><img src="${iconUrl}" onerror="this.style.background='#1a1a25'"/></div>
    <div class="name">${gameName}</div>
    <div class="sub">${subText}</div>
    <div class="rank-row">
      <div class="rank-chip">
        <div class="dot" style="background:${prevColor}"></div>
        <div class="label">${prevLabel}</div>
      </div>
      <div class="arrow">→</div>
      <div class="rank-chip new">
        <div class="dot" style="background:${accent}"></div>
        <div class="label">${newLabel}</div>
      </div>
    </div>
    <div class="lp">${lp} LP</div>
    <div class="footer">Squad Tracker</div>
  </div>
</div>
</body>
</html>`;
}

// ── Render HTML → PNG ──────────────────────────────────────────────────────────
async function renderCard(html) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 420, height: 600, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    const card = await page.$(".card");
    return await card.screenshot({ type: "png", omitBackground: true });
  } finally {
    await browser.close();
  }
}

// ── Post image to Discord ──────────────────────────────────────────────────────
async function postImageToDiscord(imageBuffer, filename) {
  const WEBHOOK_URL = getWebhookUrl();
  if (!WEBHOOK_URL) return;

  const form = new FormData();
  form.append("files[0]", new Blob([imageBuffer], { type: "image/png" }), filename);
  form.append("payload_json", JSON.stringify({ content: "<@&1495245177147621427>" }));

  try {
    const res = await fetch(WEBHOOK_URL, { method: "POST", body: form });
    if (!res.ok) console.warn("Discord webhook failed:", res.status, await res.text());
  } catch (e) {
    console.warn("Discord webhook error:", e.message);
  }
}

// ── Main export ────────────────────────────────────────────────────────────────
export async function notifyRankChanges(prevSquad, newSquad, ddragonVersion) {
  if (!getWebhookUrl()) return;

  const prevByKey = {};
  for (const p of prevSquad) {
    if (!p.solo || p.error) continue;
    prevByKey[`${p.gameName}#${p.tagLine}`.toLowerCase()] = p;
  }

  for (const p of newSquad) {
    if (!p.solo || p.error) continue;
    const key  = `${p.gameName}#${p.tagLine}`.toLowerCase();
    const prev = prevByKey[key];
    if (!prev?.solo) continue;

    const prevScore = tierScore(prev.solo.tier, prev.solo.rank);
    const newScore  = tierScore(p.solo.tier, p.solo.rank);
    if (newScore === prevScore) continue;

    const promoted = newScore > prevScore;
    console.log(`${promoted ? "🎉" : "📉"} ${p.gameName}: ${rankLabel(prev.solo.tier, prev.solo.rank)} → ${rankLabel(p.solo.tier, p.solo.rank)}`);

    try {
      const html   = buildPromoHTML({
        gameName: p.gameName,
        profileIconId: p.profileIconId,
        ddragonVersion,
        prevTier: prev.solo.tier, prevRank: prev.solo.rank,
        newTier:  p.solo.tier,    newRank:  p.solo.rank,
        lp: p.solo.lp,
        promoted,
      });
      const buffer = await renderCard(html);
      await postImageToDiscord(buffer, `${promoted ? "promo" : "demo"}-${p.gameName}.png`);
    } catch (e) {
      console.warn(`Failed to post rank card for ${p.gameName}:`, e.message);
    }

    await new Promise(r => setTimeout(r, 600));
  }
}
