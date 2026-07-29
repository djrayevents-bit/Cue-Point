const { createClient } = require("@supabase/supabase-js");

// Soft-start recipients: fixed admin inbox, plus the authenticated user's own
// email (or their djProfile.email for that uid). Never allow arbitrary client addresses.
const ALLOWED_RECIPIENTS = new Set(["ivstudiogroup@gmail.com"]);

const ALLOWED_ORIGINS = new Set([
  "https://cuepointplanning.com",
  "https://www.cuepointplanning.com",
  "http://localhost:5173",
  "http://localhost:5174",
]);

const rateLimitMap = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 10;

function normEmail(s) {
  return String(s || "").trim().toLowerCase();
}

function isRateLimited(userId) {
  const now = Date.now();
  const entry = rateLimitMap.get(userId) || { count: 0, start: now };
  if (now - entry.start > WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, start: now });
    return false;
  }
  if (entry.count >= MAX_REQUESTS) return true;
  entry.count++;
  rateLimitMap.set(userId, entry);
  return false;
}

async function isAllowedRecipient(supabase, user, toRaw) {
  const to = normEmail(toRaw);
  if (!to || !to.includes("@")) return false;
  if (ALLOWED_RECIPIENTS.has(to)) return true;
  if (normEmail(user.email) === to) return true;

  try {
    const { data } = await supabase
      .from("user_data")
      .select("value")
      .eq("user_id", user.id)
      .eq("key", "djProfile")
      .maybeSingle();
    const profileEmail = normEmail(data?.value?.email);
    if (profileEmail && profileEmail === to) return true;
  } catch (err) {
    console.warn("send-email profile email check failed:", err.message);
  }
  return false;
}

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Invalid session" });

  if (isRateLimited(user.id)) {
    return res.status(429).json({ error: "Too many requests. Please wait a moment." });
  }

  const { to, subject, html } = req.body || {};
  if (!to || !subject || !html) return res.status(400).json({ error: "Missing fields" });

  const allowed = await isAllowedRecipient(supabase, user, to);
  if (!allowed) {
    console.warn("send-email blocked: recipient not allowed", { userId: user.id, to });
    return res.status(403).json({ error: "Recipient not allowed" });
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "DJ Ray at CuePoint <hello@cuepointplanning.com>",
        replyTo: "support@cuepointplanning.com",
        to: [String(to).trim()],
        subject,
        html,
      }),
    });
    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("send-email error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
