const { createClient } = require("@supabase/supabase-js");

/**
 * Portal token lookup — O(1) by key `portalToken:<token>`.
 * Value shape: { eventId: string }
 * Legacy dual-read: scan portalTokens blobs once, then backfill the index row.
 */

const PORTAL_TOKEN_PREFIX = "portalToken:";

const ALLOWED_ORIGINS = new Set([
  "https://cuepointplanning.com",
  "https://www.cuepointplanning.com",
  "http://localhost:5173",
  "http://localhost:5174",
]);

const PUBLIC_PROFILE_FIELDS = [
  "brandColor",
  "businessName",
  "djName",
  "logoPhoto",
  "city",
  "market",
  "location",
  "bookingReplyMessage",
  "subdomain",
  "bookingHandle",
];

const PUBLIC_EVENT_FIELDS = [
  "id",
  "name",
  "date",
  "type",
  "venue",
  "client",
  "startTime",
  "endTime",
  "status",
  "guests",
];

const MAX_WRITE_ARRAY = 500;
const MAX_WRITE_BYTES = 400_000;

function portalTokenKey(token) {
  return PORTAL_TOKEN_PREFIX + String(token);
}

function publicProfile(profile) {
  if (!profile || typeof profile !== "object") return {};
  const out = {};
  for (const key of PUBLIC_PROFILE_FIELDS) {
    if (profile[key] != null && profile[key] !== "") out[key] = profile[key];
  }
  return out;
}

function publicEvent(ev) {
  if (!ev || typeof ev !== "object") return null;
  const out = {};
  for (const key of PUBLIC_EVENT_FIELDS) {
    if (ev[key] != null && ev[key] !== "") out[key] = ev[key];
  }
  return out.id != null ? out : null;
}

/**
 * Resolve portal (eventId, token) → djUserId.
 * Returns { djUserId } or null.
 */
async function resolvePortalAccess(supabase, eventId, token) {
  if (eventId == null || eventId === "" || !token) return null;
  const id = String(eventId);
  const key = portalTokenKey(token);

  const { data: row, error } = await supabase
    .from("user_data")
    .select("user_id, value")
    .eq("key", key)
    .maybeSingle();

  if (!error && row?.user_id) {
    if (String(row.value?.eventId) === id) {
      return { djUserId: row.user_id };
    }
    return null;
  }

  const { data: tokenRows, error: tokErr } = await supabase
    .from("user_data")
    .select("user_id, value")
    .eq("key", "portalTokens");
  if (tokErr) throw tokErr;

  for (const r of tokenRows || []) {
    const map = r.value && typeof r.value === "object" ? r.value : {};
    const match =
      map[id] === token ||
      map[eventId] === token ||
      map[String(eventId)] === token;
    if (!match) continue;

    await supabase.from("user_data").upsert(
      {
        user_id: r.user_id,
        key,
        value: { eventId: id },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,key" }
    );
    return { djUserId: r.user_id };
  }

  return null;
}


const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Clients may only write these keys. contracts/events/invoices removed:
// a portal visitor must never rewrite contracts, the event, or billing.
const ALLOWED_WRITE_KEYS = ["requests", "questionnaireInstances", "timelines"];

const sameEvent = (rec, id) =>
  String(rec?.eventId) === id || String(rec?.linkedEventId) === id;

/** Legacy match only when no event id fields — name AND client together. */
const legacyEventClientMatch = (rec, thisEvent, evName) => {
  if (!rec || !thisEvent) return false;
  if (rec.eventId != null && rec.eventId !== "") return false;
  if (rec.linkedEventId != null && rec.linkedEventId !== "") return false;
  const nameMatch = !!evName && (rec.event === evName || rec.eventName === evName);
  const clientMatch = !!(thisEvent.client && rec.client && rec.client === thisEvent.client);
  return nameMatch && clientMatch;
};

const recordLinksToEvent = (rec, id, thisEvent, evName) => {
  if (rec?.eventId != null && rec.eventId !== "") return String(rec.eventId) === id;
  if (rec?.linkedEventId != null && rec.linkedEventId !== "") return String(rec.linkedEventId) === id;
  return legacyEventClientMatch(rec, thisEvent, evName);
};

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

function setCors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const eventId = req.method === "GET" ? req.query.eventId : req.body?.eventId;
  const token   = req.method === "GET" ? req.query.token   : req.body?.token;
  if (!eventId || !token) return res.status(400).json({ error: "Missing params" });
  const id = String(eventId);

  let access;
  try {
    access = await resolvePortalAccess(supabase, eventId, token);
  } catch (e) {
    console.error("Portal token resolve error:", e);
    return res.status(500).json({ error: "DB error" });
  }
  if (!access?.djUserId) return res.status(401).json({ error: "Invalid token" });
  const djUserId = access.djUserId;

  const readKeys = ["djProfile","events","contracts","invoices","requests",
                    "timelines","djTimelines","questionnaireInstances","customQuestionnaires","portalSettings"];
  const { data: rows, error } = await supabase
    .from("user_data").select("key, value").eq("user_id", djUserId).in("key", readKeys);
  if (error) return res.status(500).json({ error: "DB error" });

  const blob = {};
  for (const r of (rows || [])) blob[r.key] = r.value;

  if (req.method === "GET") {
    const thisEvent = (blob.events || []).find(e => String(e.id) === id) || null;
    const evName    = thisEvent?.name;

    const arr = (x) => Array.isArray(x) ? x : [];
    const tl  = blob.djTimelines || blob.timelines || {};
    const allowPayments = blob.portalSettings?.allowPayments === true;

    const contracts = arr(blob.contracts).filter(c => recordLinksToEvent(c, id, thisEvent, evName));
    const invoices = allowPayments
      ? arr(blob.invoices).filter(i => recordLinksToEvent(i, id, thisEvent, evName))
      : [];
    const questionnaireInstances = arr(blob.questionnaireInstances).filter(q =>
      recordLinksToEvent(q, id, thisEvent, evName)
    );

    const safeEvent = publicEvent(thisEvent);

    return res.status(200).json({
      djProfile: publicProfile(blob.djProfile),
      customQuestionnaires: blob.customQuestionnaires ?? [],
      events: safeEvent ? [safeEvent] : [],
      contracts,
      invoices,
      requests: arr(blob.requests).filter(r => sameEvent(r, id)),
      questionnaireInstances,
      djTimelines: { [id]: tl[id] || tl[Number(id)] || [] },
      portalSettings: {
        allowPayments: false, // soft launch: never expose client pay
        allowContract: blob.portalSettings?.allowContract !== false,
        allowQuestionnaire: blob.portalSettings?.allowQuestionnaire !== false,
        allowMusicRequests: blob.portalSettings?.allowMusicRequests !== false,
        allowTimeline: blob.portalSettings?.allowTimeline !== false,
      },
    });
  }

  if (req.method === "POST") {
    const { action } = req.body || {};

    if (action === "signContract") {
      const contractId = req.body?.contractId;
      const signerName = String(req.body?.signerName || "").trim();
      const signatureData = req.body?.signatureData;
      const signedAt = req.body?.signedAt;

      if (!contractId || !signerName) {
        return res.status(400).json({ error: "Missing contractId or signerName" });
      }
      if (signerName.length > 200) {
        return res.status(400).json({ error: "signerName too long" });
      }
      if (signatureData != null && String(signatureData).length > 200_000) {
        return res.status(400).json({ error: "signature too large" });
      }

      const thisEvent = (blob.events || []).find(e => String(e.id) === id) || null;
      const evName = thisEvent?.name;
      const existing = Array.isArray(blob.contracts) ? blob.contracts : [];

      const idx = existing.findIndex(c => String(c?.id) === String(contractId));
      if (idx < 0) {
        return res.status(404).json({ error: "Contract not found" });
      }

      const current = existing[idx];
      if (!recordLinksToEvent(current, id, thisEvent, evName)) {
        return res.status(403).json({ error: "Contract does not belong to this event" });
      }

      if (current.status === "Signed" && current.signedBy) {
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

    try {
      const raw = JSON.stringify(value ?? null);
      if (raw.length > MAX_WRITE_BYTES) {
        return res.status(413).json({ error: "Payload too large" });
      }
    } catch {
      return res.status(400).json({ error: "Invalid value" });
    }

    const dbKey = key === "timelines" ? "djTimelines" : key;
    const { data: cur, error: curErr } = await supabase
      .from("user_data").select("value").eq("user_id", djUserId).eq("key", dbKey).maybeSingle();
    if (curErr) return res.status(500).json({ error: curErr.message });

    let merged;
    if (key === "timelines") {
      const existing = (cur?.value && typeof cur.value === "object") ? cur.value : {};
      const incoming = (value && typeof value === "object") ? (value[id] ?? value) : [];
      if (Array.isArray(incoming) && incoming.length > MAX_WRITE_ARRAY) {
        return res.status(413).json({ error: "Too many timeline items" });
      }
      merged = { ...existing, [id]: incoming };
    } else {
      const existing = Array.isArray(cur?.value) ? cur.value : [];
      const others = existing.filter(r => !sameEvent(r, id));
      const incoming = (Array.isArray(value) ? value : [])
        .filter(r => sameEvent(r, id) || r?.eventId == null)
        .map(r => ({ ...r, eventId: r?.eventId ?? eventId }));
      if (incoming.length > MAX_WRITE_ARRAY) {
        return res.status(413).json({ error: "Too many records" });
      }
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
