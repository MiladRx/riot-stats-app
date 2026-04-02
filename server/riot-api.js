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
