import fetch from "node-fetch";

const NETWORK_ERRORS = ["socket hang up", "ECONNRESET", "ENOTFOUND", "ETIMEDOUT", "network timeout"];

export async function riotFetch(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        headers: { "X-Riot-Token": process.env.RIOT_API_KEY },
        timeout: 10000,
      });
    } catch (err) {
      const isNetwork = NETWORK_ERRORS.some(s => (err.message || "").includes(s));
      if (isNetwork && attempt < retries) {
        const backoff = 1000 * attempt;
        console.log(`⚠️ riotFetch network error — retrying in ${backoff}ms (attempt ${attempt}/${retries}): ${err.message}`);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      throw err;
    }

    if (res.ok) return res.json();

    const body = await res.text();

    if (res.status === 429) {
      if (attempt === retries) break;
      const retryAfter = parseInt(res.headers.get("retry-after") || "0", 10);
      const backoff = retryAfter > 0 ? retryAfter * 1000 : 5000 * attempt;
      console.log(`⚠️ riotFetch 429 — waiting ${backoff / 1000}s (attempt ${attempt}/${retries}${retryAfter > 0 ? `, Retry-After: ${retryAfter}s` : ""})`);
      await new Promise(r => setTimeout(r, backoff));
      continue;
    }

    if (res.status >= 500 && attempt < retries) {
      const backoff = 2000 * attempt;
      console.log(`⚠️ riotFetch ${res.status} — retrying in ${backoff}ms (attempt ${attempt}/${retries})`);
      await new Promise(r => setTimeout(r, backoff));
      continue;
    }

    throw Object.assign(new Error(`Riot ${res.status}`), { status: res.status, body, url });
  }

  throw Object.assign(new Error("Riot API: exhausted retries"), { status: 429 });
}
