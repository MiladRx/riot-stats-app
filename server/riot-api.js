import fetch from "node-fetch";

export async function riotFetch(url) {
  const res = await fetch(url, { headers: { "X-Riot-Token": process.env.RIOT_API_KEY } });
  if (!res.ok) {
    const body = await res.text();
    throw Object.assign(new Error(`Riot ${res.status}`), { status: res.status, body, url });
  }
  return res.json();
}
