import { getPlayerStats } from "../lib/riot.js";

export default async function handler(req, res) {
  const { gameName = "adam1276", tagLine = "EUNE" } = req.query;
  try {
    const data = await getPlayerStats(gameName, tagLine);
    res.json(data);
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
}