const { createClient } = require("@supabase/supabase-js");

const ALLOWED_ORIGINS = new Set([
  "https://cuepointplanning.com",
  "https://www.cuepointplanning.com",
  "http://localhost:5173",
  "http://localhost:5174",
]);

const rateLimitMap = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 20;

function isRateLimited(key) {
  const now = Date.now();
  const entry = rateLimitMap.get(key) || { count: 0, start: now };
  if (now - entry.start > WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, start: now });
    return false;
  }
  if (entry.count >= MAX_REQUESTS) return true;
  entry.count++;
  rateLimitMap.set(key, entry);
  return false;
}

async function resolveAuth(req, supabase) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const accessToken = authHeader.split(" ")[1];
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (!error && user) {
      return { ok: true, rateKey: `user:${user.id}` };
    }
    // Invalid bearer — fall through to portal credentials if present
  }

  const eventId = req.query?.eventId;
  const portalToken = req.query?.token;
  if (!eventId || !portalToken) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const id = String(eventId);
  const { data: tokenRows, error: tokErr } = await supabase
    .from("user_data")
    .select("user_id, value")
    .eq("key", "portalTokens");
  if (tokErr) return { ok: false, status: 500, error: "DB error" };

  let valid = false;
  for (const row of tokenRows || []) {
    if (row.value?.[id] === portalToken) {
      valid = true;
      break;
    }
  }
  if (!valid) return { ok: false, status: 401, error: "Invalid portal token" };

  return { ok: true, rateKey: `portal:${id}:${portalToken}` };
}

async function searchSpotify(q) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { status: 500, error: "Spotify credentials not configured" };
  }

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return { status: 500, error: "Failed to get Spotify token" };
  }

  const searchRes = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=10&market=US`,
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
  );
  const searchData = await searchRes.json();

  const tracks = (searchData.tracks?.items || []).map((t) => ({
    id: t.id,
    title: t.name,
    artist: t.artists.map((a) => a.name).join(", "),
    album: t.album.name,
    albumArt: t.album.images?.[1]?.url || t.album.images?.[0]?.url || null,
    previewUrl: t.preview_url,
    spotifyUrl: t.external_urls?.spotify || null,
    durationMs: t.duration_ms,
  }));

  return { status: 200, tracks };
}

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const auth = await resolveAuth(req, supabase);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  if (isRateLimited(auth.rateKey)) {
    return res.status(429).json({ error: "Too many requests. Please wait a moment." });
  }

  const { q } = req.query;
  if (!q || !String(q).trim()) return res.status(400).json({ error: "Query required" });

  try {
    const result = await searchSpotify(String(q).trim());
    if (result.error) return res.status(result.status).json({ error: result.error });
    return res.status(200).json({ tracks: result.tracks });
  } catch (err) {
    console.error("Spotify search error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
