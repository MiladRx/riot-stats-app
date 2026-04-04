import fetch from "node-fetch";

const RETRYABLE = ["socket hang up", "ECONNRESET", "ENOTFOUND", "ETIMEDOUT", "network timeout"];

function isRetryable(err) {
  const msg = err.message || "";
  return RETRYABLE.some(s => msg.includes(s));
}

export async function riotFetch(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "X-Riot-Token": process.env.RIOT_API_KEY },
        timeout: 10000, // 10 second timeout per request
      });
      if (!res.ok) {
        const body = await res.text();
        // Don't retry 4xx errors (bad request, not found, rate limit handled separately)
        if (res.status === 429) {
          await new Promise(r => setTimeout(r, 2000)); // back off on rate limit
          continue;
        }
        throw Object.assign(new Error(`Riot ${res.status}`), { status: res.status, body, url });
      }
      return res.json();
    } catch (err) {
      const willRetry = attempt < retries && isRetryable(err);
      if (willRetry) {
        console.log(`⚠️ Retrying (${attempt}/${retries}): ${err.message}`);
        await new Promise(r => setTimeout(r, 1000 * attempt)); // 1s, 2s backoff
        continue;
      }
      throw err;
    }
  }
}
