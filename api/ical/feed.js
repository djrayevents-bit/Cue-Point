const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).end();

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase
    .from("user_data")
    .select("value")
    .eq("user_id", `ical_${token}`)
    .eq("key", "ical_feed")
    .single();

  if (error || !data?.value) {
    return res.status(404).end();
  }

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'inline; filename="cuepoint.ics"');
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  return res.status(200).send(data.value);
};
