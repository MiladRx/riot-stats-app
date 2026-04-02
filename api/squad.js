import { getPlayerStats } from "../lib/riot.js";

const players = [
  { gameName: "adam1276",        tagLine: "EUNE"  },
  { gameName: "Spirifan3",       tagLine: "Faker" },
  { gameName: "moroccan dealer", tagLine: "pimp"  },
  // ... rest of your list
];

export default async function handler(req, res) {
  const results = await Promise.allSettled(
    players.map(p => getPlayerStats(p.gameName, p.tagLine))
  );

  const squad = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return { gameName: players[i].gameName, tagLine: players[i].tagLine, error: r.reason?.message };
  });

  squad.sort((a, b) => (b.solo?.sortScore ?? -1) - (a.solo?.sortScore ?? -1));
  res.json(squad);
}