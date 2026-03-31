const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { token, ics } = req.body;
  if (!token || !ics) return res.status(400).json({ error: "Missing token or ics" });

  const { error } = await supabase
    .from("ical_feeds")
    .upsert({ token, ics, updated_at: new Date().toISOString() }, { onConflict: "token" });

  if (error) {
    console.error("iCal publish error:", error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
};
