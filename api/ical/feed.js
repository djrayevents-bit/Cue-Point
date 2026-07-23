// Combined iCal feed + publish for Hobby plan function limits.
// GET  ?token=…  → return calendar ICS
// POST + auth    → publish/upsert ICS for the signed-in user

const { createClient } = require("@supabase/supabase-js");

const ALLOWED_ORIGINS = new Set([
  "https://cuepointplanning.com",
  "http://localhost:5173",
  "http://localhost:5174",
]);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
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

  const { data: tokenRow, error: tokErr } = await supabase
    .from("user_data")
    .select("value")
    .eq("user_id", user.id)
    .eq("key", "calendarToken")
    .maybeSingle();
  if (tokErr) return res.status(500).json({ error: tokErr.message });

  const ownedToken = tokenRow?.value;
  if (!ownedToken || String(ownedToken) !== String(token)) {
    return res.status(403).json({ error: "Token not owned by user" });
  }

  const { data: existingFeed } = await supabase
    .from("ical_feeds")
    .select("token, user_id")
    .eq("token", token)
    .maybeSingle();
  if (existingFeed?.user_id && existingFeed.user_id !== user.id) {
    return res.status(403).json({ error: "Token owned by another user" });
  }

  const { error } = await supabase
    .from("ical_feeds")
    .upsert(
      { token, ics, user_id: user.id, updated_at: new Date().toISOString() },
      { onConflict: "token" }
    );

  if (error) {
    if (/user_id|column/i.test(error.message || "")) {
      const { error: err2 } = await supabase
        .from("ical_feeds")
        .upsert({ token, ics, updated_at: new Date().toISOString() }, { onConflict: "token" });
      if (err2) {
        console.error("iCal publish error:", err2.message);
        return res.status(500).json({ error: err2.message });
      }
      return res.status(200).json({ ok: true });
    }
    console.error("iCal publish error:", error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
};
