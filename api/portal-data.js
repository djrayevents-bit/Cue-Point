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

/** Only signature-related fields may be set from the portal. */
const applyClientSignature = (contract, { signerName, signatureData, signedAt }) => {
  const when = signedAt || new Date().toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
  const logEntry = {
    time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    action: `Signed by ${signerName} ✓`,
    color: "#16A34A",
  };
  return {
    ...contract,
    status: "Signed",
    signed: when,
    signedDate: when,
    signedAt: when,
    signedBy: signerName,
    signatureDrawn: true,
    ...(signatureData != null ? { signatureData } : {}),
    openLog: [...(Array.isArray(contract.openLog) ? contract.openLog : []), logEntry],
  };
};

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
                    "timelines","djTimelines","questionnaireInstances","customQuestionnaires","portalSettings"];
  const { data: rows, error } = await supabase
    .from("user_data").select("key, value").eq("user_id", djUserId).in("key", readKeys);
  if (error) return res.status(500).json({ error: "DB error" });

  const blob = {};
  for (const r of (rows || [])) blob[r.key] = r.value;

  if (req.method === "GET") {
    // Resolve this one event so we can match contracts/questionnaires by name too.
    const thisEvent = (blob.events || []).find(e => String(e.id) === id) || null;
    const evName    = thisEvent?.name;

    const arr = (x) => Array.isArray(x) ? x : [];
    const tl  = blob.djTimelines || blob.timelines || {};

    // Contracts: prefer eventId / linkedEventId. Legacy rows need name AND client.
    const contracts = arr(blob.contracts).filter(c => {
      if (c?.eventId != null && c.eventId !== "") return String(c.eventId) === id;
      if (c?.linkedEventId != null && c.linkedEventId !== "") return String(c.linkedEventId) === id;
      const nameMatch = !!evName && (c?.event === evName || c?.eventName === evName);
      const clientMatch = !!(thisEvent?.client && c?.client && c.client === thisEvent.client);
      return nameMatch && clientMatch;
    });

    return res.status(200).json({
      djUserId,
      djProfile: blob.djProfile ?? {},
      customQuestionnaires: blob.customQuestionnaires ?? [],   // templates only — no client answers
      events: thisEvent ? [thisEvent] : [],
      contracts,
      invoices: arr(blob.invoices).filter(i => sameEvent(i, id)),
      requests: arr(blob.requests).filter(r => sameEvent(r, id)),
      questionnaireInstances: arr(blob.questionnaireInstances).filter(q =>
        sameEvent(q, id) || (evName && q.event === evName)),
      djTimelines: { [id]: tl[id] || tl[Number(id)] || [] },
      // Feature flags for honest portal UI (payments not live until Stripe client pay)
      portalSettings: {
        // Soft launch: never expose client pay until Stripe portal pay ships.
        allowPayments: false,
        allowContract: blob.portalSettings?.allowContract !== false,
        allowQuestionnaire: blob.portalSettings?.allowQuestionnaire !== false,
        allowMusicRequests: blob.portalSettings?.allowMusicRequests !== false,
        allowTimeline: blob.portalSettings?.allowTimeline !== false,
      },
    });
  }

  if (req.method === "POST") {
    const { action } = req.body || {};

    // Narrow signature write — never accepts full contract blob rewrites.
    if (action === "signContract") {
      const contractId = req.body?.contractId;
      const signerName = String(req.body?.signerName || "").trim();
      const signatureData = req.body?.signatureData;
      const signedAt = req.body?.signedAt;

      if (!contractId || !signerName) {
        return res.status(400).json({ error: "Missing contractId or signerName" });
      }

      const thisEvent = (blob.events || []).find(e => String(e.id) === id) || null;
      const evName = thisEvent?.name;
      const existing = Array.isArray(blob.contracts) ? blob.contracts : [];

      const idx = existing.findIndex(c => String(c?.id) === String(contractId));
      if (idx < 0) {
        return res.status(404).json({ error: "Contract not found" });
      }

      const current = existing[idx];
      const belongsToEvent = (() => {
        if (current?.eventId != null && current.eventId !== "") return String(current.eventId) === id;
        if (current?.linkedEventId != null && current.linkedEventId !== "") return String(current.linkedEventId) === id;
        const nameMatch = !!evName && (current.event === evName || current.eventName === evName);
        const clientMatch = !!(thisEvent?.client && current.client && current.client === thisEvent.client);
        return nameMatch && clientMatch;
      })();

      if (!belongsToEvent) {
        return res.status(403).json({ error: "Contract does not belong to this event" });
      }

      if (current.status === "Signed" && current.signedBy) {
        // Idempotent: already signed — return current, do not rewrite body/fee.
        return res.status(200).json({ ok: true, contract: current, alreadySigned: true });
      }

      const updated = applyClientSignature(current, { signerName, signatureData, signedAt });
      const merged = existing.map((c, i) => (i === idx ? updated : c));

      const { error: writeErr } = await supabase.from("user_data").upsert(
        { user_id: djUserId, key: "contracts", value: merged, updated_at: new Date().toISOString() },
        { onConflict: "user_id,key" }
      );
      if (writeErr) return res.status(500).json({ error: writeErr.message });

      return res.status(200).json({ ok: true, contract: updated });
    }

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
