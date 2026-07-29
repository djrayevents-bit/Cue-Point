// Combined iCal feed + publish for Hobby plan function limits.
// GET  ?token=…  → public calendar ICS (subscribers; no auth)
// POST + Bearer  → publish/upsert ICS for the signed-in user only
// Replaces legacy unauthenticated api/ical/publish.js

const { createClient } = require("@supabase/supabase-js");

const ALLOWED_ORIGINS = new Set([
  "https://cuepointplanning.com",
  "https://www.cuepointplanning.com",
  "http://localhost:5173",
  "http://localhost:5174",
]);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizeToken(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "string") return parsed;
    } catch (_) {}
    return value;
  }
  return String(value);
}

module.exports = async function handler(req, res) {
  // Public read — calendar subscribers must not need a session
  if (req.method === "GET") {
    const { token } = req.query;
    if (!token) return res.status(400).end();

    const { data, error } = await supabase
      .from("ical_feeds")
      .select("ics")
      .eq("token", token)
      .single();

    if (error || !data) return res.status(404).end();

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store");
    return res.send(data.ics);
  }

  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const accessToken = authHeader.split(" ")[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !user) return res.status(401).json({ error: "Invalid session" });

  const { token, ics } = req.body || {};
  if (!token || !ics) return res.status(400).json({ error: "Missing token or ics" });
  const feedToken = String(token);

  const { data: existingFeed, error: feedLookupErr } = await supabase
    .from("ical_feeds")
    .select("token, user_id")
    .eq("token", feedToken)
    .maybeSingle();
  if (feedLookupErr && !/user_id|column/i.test(feedLookupErr.message || "")) {
    return res.status(500).json({ error: feedLookupErr.message });
  }

  // Prefer ical_feeds.user_id binding when the column exists
  if (existingFeed?.user_id && existingFeed.user_id !== user.id) {
    return res.status(403).json({ error: "Token owned by another user" });
  }

  const { data: tokenRow, error: tokErr } = await supabase
    .from("user_data")
    .select("value")
    .eq("user_id", user.id)
    .eq("key", "calendarToken")
    .maybeSingle();
  if (tokErr) return res.status(500).json({ error: tokErr.message });

  const mine = normalizeToken(tokenRow?.value);

  // User already mapped a different token — do not let them overwrite someone else's feed id
  if (mine && mine !== feedToken) {
    return res.status(403).json({ error: "Token not owned by user" });
  }

  // Legacy orphan row (no user_id): only the user who already mapped this token may update it
  if (existingFeed && !existingFeed.user_id && mine !== feedToken) {
    return res.status(403).json({ error: "Token already in use" });
  }

  // First publish for this user — bind token in user_data
  if (!mine) {
    const { error: claimErr } = await supabase.from("user_data").upsert(
      {
        user_id: user.id,
        key: "calendarToken",
        value: feedToken,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,key" }
    );
    if (claimErr) return res.status(500).json({ error: claimErr.message });
  }

  const row = {
    token: feedToken,
    ics,
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("ical_feeds")
    .upsert(row, { onConflict: "token" });

  if (error) {
    // Column missing: still require user_data ownership (established above), then upsert without user_id
    if (/user_id|column/i.test(error.message || "")) {
      const { error: err2 } = await supabase
        .from("ical_feeds")
        .upsert(
          { token: feedToken, ics, updated_at: new Date().toISOString() },
          { onConflict: "token" }
        );
      if (err2) {
        console.error("iCal publish error:", err2.message);
        return res.status(500).json({ error: err2.message });
      }
      return res.status(200).json({ ok: true, warning: "ical_feeds.user_id column missing — add it for stronger binding" });
    }
    console.error("iCal publish error:", error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
};
