import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_WRITE_KEYS = ["requests", "questionnaireInstances", "timelines", "contracts"];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const eventId = req.method === "GET" ? req.query.eventId : req.body?.eventId;
  const token   = req.method === "GET" ? req.query.token   : req.body?.token;

  if (!eventId || !token) return res.status(400).json({ error: "Missing params" });

  // Load all relevant data across all users
  const keys = ["portalTokens","djProfile","events","contracts","invoices",
                 "requests","timelines","questionnaireInstances","customQuestionnaires"];
  const { data: rows, error } = await supabase
    .from("user_data").select("user_id, key, value").in("key", keys);
  if (error) return res.status(500).json({ error: "DB error" });

  // Group by user
  const byUser = {};
  for (const row of (rows || [])) {
    if (!byUser[row.user_id]) byUser[row.user_id] = {};
    byUser[row.user_id][row.key] = row.value;
  }

  // Find DJ whose portalTokens[eventId] === token
  let djUserId = null, djData = null;
  for (const [uid, data] of Object.entries(byUser)) {
    if (data.portalTokens?.[String(eventId)] === token) {
      djUserId = uid; djData = data; break;
    }
  }
  if (!djUserId) return res.status(401).json({ error: "Invalid token" });

  if (req.method === "GET") {
    return res.status(200).json({ djUserId, ...djData });
  }

  if (req.method === "POST") {
    const { key, value } = req.body;
    if (!ALLOWED_WRITE_KEYS.includes(key))
      return res.status(403).json({ error: "Write not allowed for key: " + key });
    const { error: writeErr } = await supabase.from("user_data").upsert(
      { user_id: djUserId, key, value, updated_at: new Date().toISOString() },
      { onConflict: "user_id,key" }
    );
    if (writeErr) return res.status(500).json({ error: writeErr.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
