/**
 * Durable rate limiting for Vercel serverless.
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set;
 * falls back to per-instance memory (better than nothing on cold starts).
 */

const memoryMap = new Map();

function memoryLimited(key, limit, windowMs) {
  const now = Date.now();
  const entry = memoryMap.get(key) || { count: 0, start: now };
  if (now - entry.start > windowMs) {
    memoryMap.set(key, { count: 1, start: now });
    return false;
  }
  if (entry.count >= limit) return true;
  entry.count += 1;
  memoryMap.set(key, entry);
  return false;
}

/**
 * @param {string} key
 * @param {{ limit: number, windowMs: number }} opts
 * @returns {Promise<boolean>} true when limited
 */
async function isRateLimited(key, { limit, windowMs }) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      const { Redis } = require("@upstash/redis");
      const redis = new Redis({ url, token });
      const redisKey = `cuepoint:rl:${key}`;
      const count = await redis.incr(redisKey);
      if (count === 1) {
        await redis.pexpire(redisKey, windowMs);
      }
      return count > limit;
    } catch (err) {
      console.warn("rateLimit Upstash fallback:", err.message);
    }
  }
  return memoryLimited(key, limit, windowMs);
}

function clientIp(req) {
  const xf = req.headers?.["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req.headers?.["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

module.exports = { isRateLimited, clientIp };
