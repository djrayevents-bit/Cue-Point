const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
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
};
