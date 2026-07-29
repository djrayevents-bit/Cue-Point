// Public booking page payload by DJ handle.
// GET ?handle=… → branding + packages for that DJ only (service role).
// Never returns other users' rows to the client.

const { createClient } = require("@supabase/supabase-js");

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

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/[^a-z0-9]/g, "");

function publicProfile(profile) {
  if (!profile || typeof profile !== "object") return {};
  const out = {};
  for (const key of PUBLIC_PROFILE_FIELDS) {
    if (profile[key] != null && profile[key] !== "") out[key] = profile[key];
  }
  return out;
}

function handleMatches(profile, userId, handleNorm) {
  if (!handleNorm) return false;
  if (String(userId) === handleNorm || norm(userId) === handleNorm) return true;
  if (!profile || typeof profile !== "object") return false;
  const candidates = [profile.subdomain, profile.bookingHandle, profile.djName, profile.businessName]
    .map(norm)
    .filter(Boolean);
  return candidates.includes(handleNorm);
}

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const handle = String(req.query?.handle || "").trim();
  if (!handle) return res.status(400).json({ error: "Missing handle" });
  const handleNorm = norm(handle);
  if (!handleNorm) return res.status(400).json({ error: "Invalid handle" });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1) Find the DJ by scanning profile handles only (server-side; not returned en masse).
    const { data: profileRows, error: profileErr } = await supabase
      .from("user_data")
      .select("user_id, value")
      .eq("key", "djProfile");
    if (profileErr) {
      console.error("booking-page profile lookup:", profileErr.message);
      return res.status(500).json({ error: "Lookup failed" });
    }

    let matchedUserId = null;
    let matchedProfile = null;
    for (const row of profileRows || []) {
      const profile = row.value;
      if (handleMatches(profile, row.user_id, handleNorm)) {
        matchedUserId = row.user_id;
        matchedProfile = profile;
        break;
      }
    }

    if (!matchedUserId) {
      return res.status(404).json({ error: "DJ not found" });
    }

    // 2) Load ONLY that DJ's public booking keys.
    const keys = ["pricingPackages", "pricingAddOns", "inquiryFormConfig", "pricingSettings"];
    const { data: rows, error } = await supabase
      .from("user_data")
      .select("key, value")
      .eq("user_id", matchedUserId)
      .in("key", keys);
    if (error) {
      console.error("booking-page payload:", error.message);
      return res.status(500).json({ error: "Lookup failed" });
    }

    const blob = {};
    for (const r of rows || []) blob[r.key] = r.value;

    return res.status(200).json({
      djProfile: publicProfile(matchedProfile),
      pricingPackages: Array.isArray(blob.pricingPackages) ? blob.pricingPackages : [],
      pricingAddOns: Array.isArray(blob.pricingAddOns) ? blob.pricingAddOns : [],
      inquiryFormConfig: blob.inquiryFormConfig || null,
      pricingSettings: blob.pricingSettings && typeof blob.pricingSettings === "object"
        ? blob.pricingSettings
        : {},
    });
  } catch (err) {
    console.error("booking-page error:", err.message);
    return res.status(500).json({ error: "Lookup failed" });
  }
};
