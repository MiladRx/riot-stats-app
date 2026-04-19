// Discord webhook notifications for rank changes

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

const TIER_ORDER = ["IRON","BRONZE","SILVER","GOLD","PLATINUM","EMERALD","DIAMOND","MASTER","GRANDMASTER","CHALLENGER"];
const RANK_ORDER = ["IV","III","II","I"];
const NO_DIVISIONS = new Set(["MASTER","GRANDMASTER","CHALLENGER"]);

const TIER_EMOJI = {
  IRON: "⬛", BRONZE: "🟫", SILVER: "🩶", GOLD: "🟡",
  PLATINUM: "🩵", EMERALD: "💚", DIAMOND: "💎",
  MASTER: "🟣", GRANDMASTER: "🔴", CHALLENGER: "🔵",
};

const TIER_COLOR = {
  IRON: 0x8d8d8d, BRONZE: 0xad5e2e, SILVER: 0xa8b4c0, GOLD: 0xf0c040,
  PLATINUM: 0x4eb6b0, EMERALD: 0x32d16e, DIAMOND: 0x6ab8f7,
  MASTER: 0x9b4dca, GRANDMASTER: 0xe44d26, CHALLENGER: 0x00c8ff,
};

function tierScore(tier, rank) {
  const t = TIER_ORDER.indexOf(tier);
  const r = NO_DIVISIONS.has(tier) ? 0 : RANK_ORDER.indexOf(rank);
  return t * 4 + (3 - r);
}

function rankLabel(tier, rank) {
  if (NO_DIVISIONS.has(tier)) return tier.charAt(0) + tier.slice(1).toLowerCase();
  return tier.charAt(0) + tier.slice(1).toLowerCase() + " " + rank;
}

async function sendWebhook(payload) {
  if (!WEBHOOK_URL) return;
  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("Discord webhook failed:", e.message);
  }
}

export async function notifyRankChanges(prevSquad, newSquad) {
  if (!WEBHOOK_URL) return;

  // Build lookup of previous ranks by player key
  const prevByKey = {};
  for (const p of prevSquad) {
    if (!p.solo || p.error) continue;
    const key = `${p.gameName}#${p.tagLine}`.toLowerCase();
    prevByKey[key] = p.solo;
  }

  for (const p of newSquad) {
    if (!p.solo || p.error) continue;
    const key = `${p.gameName}#${p.tagLine}`.toLowerCase();
    const prev = prevByKey[key];
    if (!prev) continue;

    const prevScore = tierScore(prev.tier, prev.rank);
    const newScore  = tierScore(p.solo.tier, p.solo.rank);

    if (newScore === prevScore) continue; // no tier/rank change

    const promoted = newScore > prevScore;
    const prevLabel = rankLabel(prev.tier, prev.rank);
    const newLabel  = rankLabel(p.solo.tier, p.solo.rank);
    const emoji = TIER_EMOJI[p.solo.tier] || "🏆";
    const color = TIER_COLOR[p.solo.tier] || 0x7289da;

    const title = promoted
      ? `${emoji} ${p.gameName} promoted to ${newLabel}!`
      : `📉 ${p.gameName} demoted to ${newLabel}`;

    const description = promoted
      ? `**${prevLabel}** → **${newLabel}** · ${p.solo.lp} LP`
      : `**${prevLabel}** → **${newLabel}** · ${p.solo.lp} LP`;

    await sendWebhook({
      embeds: [{
        title,
        description,
        color,
        thumbnail: { url: `https://ddragon.leagueoflegends.com/cdn/15.1.1/img/profileicon/${p.profileIconId || 1}.png` },
        footer: { text: "Squad Tracker" },
        timestamp: new Date().toISOString(),
      }],
    });

    // Small gap between messages if multiple people ranked up at once
    await new Promise(r => setTimeout(r, 500));
  }
}
