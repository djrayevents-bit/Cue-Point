import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Clients may only write these keys. contracts/events/invoices removed:
// a portal visitor must never rewrite contracts, the event, or billing.
const ALLOWED_WRITE_KEYS = ["requests", "questionnaireInstances", "timelines"];

const sameEvent = (rec, id) =>
  String(rec?.eventId) === id || String(rec?.linkedEventId) === id;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const eventId = req.method === "GET" ? req.query.eventId : req.body?.eventId;
  const token   = req.method === "GET" ? req.query.token   : req.body?.token;
  if (!eventId || !token) return res.status(400).json({ error: "Missing params" });
  const id = String(eventId);

  // 1. Resolve token -> djUserId using ONLY portalTokens rows.
  const { data: tokenRows, error: tokErr } = await supabase
    .from("user_data").select("user_id, value").eq("key", "portalTokens");
  if (tokErr) return res.status(500).json({ error: "DB error" });

  let djUserId = null;
  for (const row of (tokenRows || [])) {
    if (row.value?.[id] === token) { djUserId = row.user_id; break; }
  }
  if (!djUserId) return res.status(401).json({ error: "Invalid token" });

  // 2. Load ONLY this DJ's rows.
  const readKeys = ["djProfile","events","contracts","invoices","requests",
                    "timelines","djTimelines","questionnaireInstances","customQuestionnaires"];
  const { data: rows, error } = await supabase
    .from("user_data").select("key, value").eq("user_id", djUserId).in("key", readKeys);
  if (error) return res.status(500).json({ error: "DB error" });

  const blob = {};
  for (const r of (rows || [])) blob[r.key] = r.value;

  if (req.method === "GET") {
    // Resolve this one event so we can match contracts/questionnaires by name too.
    const thisEvent = (blob.events || []).find(e => String(e.id) === id) || null;
    const evName    = thisEvent?.name;
    const evClient  = thisEvent?.client;

    const arr = (x) => Array.isArray(x) ? x : [];
    const tl  = blob.djTimelines || blob.timelines || {};

    return res.status(200).json({
      djUserId,
      djProfile: blob.djProfile ?? {},
      customQuestionnaires: blob.customQuestionnaires ?? [],   // templates only — no client answers
      events: thisEvent ? [thisEvent] : [],
      contracts: arr(blob.contracts).filter(c =>
        sameEvent(c, id) || (evName && c.event === evName) || (evClient && c.client === evClient)),
      invoices: arr(blob.invoices).filter(i => sameEvent(i, id)),
      requests: arr(blob.requests).filter(r => sameEvent(r, id)),
      questionnaireInstances: arr(blob.questionnaireInstances).filter(q =>
        sameEvent(q, id) || (evName && q.event === evName)),
      djTimelines: { [id]: tl[id] || tl[Number(id)] || [] },
    });
  }

  if (req.method === "POST") {
    const { key, value } = req.body;
    if (!ALLOWED_WRITE_KEYS.includes(key))
      return res.status(403).json({ error: "Write not allowed for key: " + key });

    // Read the CURRENT full blob server-side, merge ONLY this event's slice.
    const dbKey = key === "timelines" ? "djTimelines" : key;
    const { data: cur, error: curErr } = await supabase
      .from("user_data").select("value").eq("user_id", djUserId).eq("key", dbKey).maybeSingle();
    if (curErr) return res.status(500).json({ error: curErr.message });

    let merged;
    if (key === "timelines") {
      const existing = (cur?.value && typeof cur.value === "object") ? cur.value : {};
      const incoming = (value && typeof value === "object") ? (value[id] ?? value) : [];
      merged = { ...existing, [id]: incoming };
    } else {
      // requests / questionnaireInstances: arrays. Drop this event's old rows,
      // re-add the incoming ones (stamped with eventId), keep all other events untouched.
      const existing = Array.isArray(cur?.value) ? cur.value : [];
      const others = existing.filter(r => !sameEvent(r, id));
      const incoming = (Array.isArray(value) ? value : [])
        .filter(r => sameEvent(r, id) || r?.eventId == null)
        .map(r => ({ ...r, eventId: r?.eventId ?? eventId }));
      merged = [...others, ...incoming];
    }

    const { error: writeErr } = await supabase.from("user_data").upsert(
      { user_id: djUserId, key: dbKey, value: merged, updated_at: new Date().toISOString() },
      { onConflict: "user_id,key" }
    );
    if (writeErr) return res.status(500).json({ error: writeErr.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
