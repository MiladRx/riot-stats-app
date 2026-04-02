import fetch from "node-fetch";

const API_KEY = process.env.RIOT_API_KEY;

export async function riotFetch(url) {
  const res = await fetch(url, { headers: { "X-Riot-Token": API_KEY } });
  if (!res.ok) {
    const body = await res.text();
    throw Object.assign(new Error(`Riot ${res.status}`), { status: res.status, body, url });
  }
  return res.json();
}

export async function getPlayerStats(gameName, tagLine) {
  const account = await riotFetch(
    `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
  );
  const { puuid } = account;

  const allEntries = await riotFetch(
    `https://eun1.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`
  );

  let summoner = {};
  try {
    summoner = await riotFetch(
      `https://eun1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`
    );
  } catch (e) {}

  const solo = allEntries.find(e => e.queueType === "RANKED_SOLO_5x5") || null;
  const tierOrder = { IRON:0, BRONZE:1, SILVER:2, GOLD:3, PLATINUM:4, EMERALD:5, DIAMOND:6, MASTER:7, GRANDMASTER:8, CHALLENGER:9 };
  const rankOrder = { IV:0, III:1, II:2, I:3 };

  return {
    gameName: account.gameName,
    tagLine: account.tagLine,
    summonerLevel: summoner.summonerLevel ?? null,
    profileIconId: summoner.profileIconId ?? 1,
    solo: solo ? {
      tier: solo.tier,
      rank: solo.rank,
      lp: solo.leaguePoints,
      wins: solo.wins,
      losses: solo.losses,
      winRate: Math.round((solo.wins / (solo.wins + solo.losses)) * 100),
      hotStreak: solo.hotStreak,
      veteran: solo.veteran,
      freshBlood: solo.freshBlood,
      inactive: solo.inactive,
      sortScore: (tierOrder[solo.tier] ?? -1) * 400 + (rankOrder[solo.rank] ?? 0) * 100 + solo.leaguePoints,
    } : null,
  };
}