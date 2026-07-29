// Public booking form submit → append lead to the matched DJ's user_data.leads.
// POST { handle, name, email, ... } — no auth required. Service role write only for that DJ.

const { createClient } = require("@supabase/supabase-js");

const ALLOWED_ORIGINS = new Set([
  "https://cuepointplanning.com",
  "https://www.cuepointplanning.com",
  "http://localhost:5173",
  "http://localhost:5174",
]);

const rateLimitMap = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 8;

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/[^a-z0-9]/g, "");

function handleMatches(profile, userId, handleNorm) {
  if (!handleNorm) return false;
  if (String(userId) === handleNorm || norm(userId) === handleNorm) return true;
  if (!profile || typeof profile !== "object") return false;
  const candidates = [profile.subdomain, profile.bookingHandle, profile.djName, profile.businessName]
    .map(norm)
    .filter(Boolean);
  return candidates.includes(handleNorm);
}

function clientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

function isRateLimited(key) {
  const now = Date.now();
  const entry = rateLimitMap.get(key) || { count: 0, start: now };
  if (now - entry.start > WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, start: now });
    return false;
  }
  if (entry.count >= MAX_REQUESTS) return true;
  entry.count++;
  rateLimitMap.set(key, entry);
  return false;
}

function str(v, max = 500) {
  const s = String(v == null ? "" : v).trim();
  return s.length > max ? s.slice(0, max) : s;
}

function buildLead(body) {
  const name = str(body.name, 200);
  const email = str(body.email, 320);
  if (!name || !email) return { error: "Name and email are required" };

  const phone = str(body.phone, 40);
  const date = str(body.date, 40);
  const venue = str(body.venue, 300);
  const guestCount = str(body.guestCount, 40);
  const notes = str(body.notes, 4000);
  const eventType = str(body.eventType, 120);
  const packageName = str(body.packageName || body.selectedPackage, 200);
  const addOns = Array.isArray(body.selectedAddOns)
    ? body.selectedAddOns.map((a) => str(a, 120)).filter(Boolean).slice(0, 30)
    : Array.isArray(body.addOns)
      ? body.addOns.map((a) => str(a, 120)).filter(Boolean).slice(0, 30)
      : [];
  const customLines = Array.isArray(body.customAnswers)
    ? body.customAnswers
        .map((row) => {
          const label = str(row?.label, 120);
          const answer = str(row?.answer, 1000);
          return label && answer ? `${label}: ${answer}` : "";
        })
        .filter(Boolean)
        .slice(0, 40)
    : [];

  let budget = Number(body.budget);
  if (!Number.isFinite(budget) || budget < 0) budget = 0;
  if (budget > 1e7) budget = 1e7;

  const note = [
    venue ? `Venue: ${venue}` : "",
    guestCount ? `Guests: ${guestCount}` : "",
    notes,
    ...customLines,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 8000);

  const today = new Date().toISOString().slice(0, 10);
  const leadId = Date.now();

  return {
    lead: {
      id: leadId,
      name,
      email,
      phone,
      event: packageName || eventType || "Booking Request",
      eventType: eventType || "",
      date,
      venue,
      guestCount,
      budget,
      source: "Booking Form",
      status: "Hot",
      stage: "New Inquiry",
      note,
      selectedPackage: packageName || null,
      selectedAddOns: addOns,
      createdAt: today,
      last: "Just now",
      tasks: [],
    },
  };
}

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body || {};
  const handle = str(body.handle, 80);
  const handleNorm = norm(handle);
  if (!handleNorm) return res.status(400).json({ error: "Missing handle" });

  const ip = clientIp(req);
  const rateKey = `${ip}:${handleNorm}`;
  if (isRateLimited(rateKey)) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  const built = buildLead(body);
  if (built.error) return res.status(400).json({ error: built.error });
  const { lead } = built;

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    let matchedUserId = null;

    // Prefer explicit djUserId from load response when present, still verify handle match.
    const claimedId = str(body.djUserId, 80);
    if (claimedId) {
      const { data: profileRow, error: pErr } = await supabase
        .from("user_data")
        .select("user_id, value")
        .eq("user_id", claimedId)
        .eq("key", "djProfile")
        .maybeSingle();
      if (pErr) {
        console.error("booking-submit profile by id:", pErr.message);
        return res.status(500).json({ error: "Submit failed" });
      }
      if (profileRow && handleMatches(profileRow.value, profileRow.user_id, handleNorm)) {
        matchedUserId = profileRow.user_id;
      }
    }

    if (!matchedUserId) {
      const { data: profileRows, error: profileErr } = await supabase
        .from("user_data")
        .select("user_id, value")
        .eq("key", "djProfile");
      if (profileErr) {
        console.error("booking-submit profile lookup:", profileErr.message);
        return res.status(500).json({ error: "Submit failed" });
      }
      for (const row of profileRows || []) {
        if (handleMatches(row.value, row.user_id, handleNorm)) {
          matchedUserId = row.user_id;
          break;
        }
      }
    }

    if (!matchedUserId) {
      return res.status(404).json({ error: "DJ not found" });
    }

    const { data: leadsRow, error: leadsErr } = await supabase
      .from("user_data")
      .select("value")
      .eq("user_id", matchedUserId)
      .eq("key", "leads")
      .maybeSingle();
    if (leadsErr) {
      console.error("booking-submit leads read:", leadsErr.message);
      return res.status(500).json({ error: "Submit failed" });
    }

    const existing = Array.isArray(leadsRow?.value) ? leadsRow.value : [];
    const merged = [lead, ...existing];

    const { error: writeErr } = await supabase.from("user_data").upsert(
      {
        user_id: matchedUserId,
        key: "leads",
        value: merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,key" }
    );
    if (writeErr) {
      console.error("booking-submit leads write:", writeErr.message);
      return res.status(500).json({ error: "Submit failed" });
    }

    return res.status(200).json({ ok: true, leadId: lead.id });
  } catch (err) {
    console.error("booking-submit error:", err.message);
    return res.status(500).json({ error: "Submit failed" });
  }
};
