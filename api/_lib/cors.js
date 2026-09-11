/**
 * Shared CORS allowlist for CuePoint public/authenticated APIs.
 * Reflect known origins only — never fall back to *.
 */

const DEFAULT_ORIGINS = [
  "https://cuepointplanning.com",
  "https://www.cuepointplanning.com",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
];

function allowedOrigins() {
  const extra = String(process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ORIGINS, ...extra]);
}

/**
 * Apply CORS headers. Returns true when origin was allowlisted (or no Origin header).
 * Does not set Access-Control-Allow-Origin for unknown browser origins.
 */
function applyCors(req, res, { methods = "GET, POST, OPTIONS", headers = "Content-Type, Authorization" } = {}) {
  const origin = req.headers?.origin;
  const allow = allowedOrigins();
  if (origin && allow.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", headers);
  return !origin || allow.has(origin);
}

module.exports = { allowedOrigins, applyCors, DEFAULT_ORIGINS };
