const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { token, ics } = req.body;
  if (!token || !ics) return res.status(400).json({ error: "token and ics required" });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { error } = await supabase
    .from("user_data")
    .upsert({
      user_id: `ical_${token}`,
      key: "ical_feed",
      value: ics,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,key" });

  if (error) {
    console.error("iCal publish error:", error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
};
