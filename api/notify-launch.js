const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");
const authOtpHandler = require("./_lib/authOtpHandler");
const ALLOWED_ORIGINS = require("./_lib/allowedOrigins");
const { handleOperator, handleTags, handleTap } = require("./_lib/equipmentTags");

// IP-based rate limit: 5 requests per IP per 10 minutes
const rateLimitMap = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;

function isRateLimited(ipHash) {
  const now = Date.now();
  const entry = rateLimitMap.get(ipHash) || { count: 0, start: now };
  if (now - entry.start > WINDOW_MS) {
    rateLimitMap.set(ipHash, { count: 1, start: now });
    return false;
  }
  if (entry.count >= MAX_REQUESTS) return true;
  entry.count++;
  rateLimitMap.set(ipHash, entry);
  return false;
}

function hashIP(ip) {
  const salt = process.env.IP_HASH_SALT || "";
  return crypto.createHash("sha256").update(ip + salt).digest("hex");
}

function isValidEmail(email) {
  if (typeof email !== "string") return false;
  if (email.length > 254) return false;
  // Pragmatic email regex - rejects obvious garbage, accepts real addresses
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "https://cuepointplanning.com");
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function equipmentRoute(req) {
  const flag = String((req.query && req.query.equipment) || "");
  if (flag === "tags" || flag === "operator" || flag === "tap") return flag;
  const raw = [
    req.url,
    req.headers["x-forwarded-uri"],
    req.headers["x-vercel-original-url"],
    req.headers["x-original-url"],
  ].filter(Boolean).join(" ");
  if (/\/api\/equipment-tags(?:\?|$|\s)/.test(raw)) return "tags";
  if (/\/api\/equipment-operator(?:\?|$|\s)/.test(raw)) return "operator";
  if (/\/t\/[^/?\s]+/.test(raw)) return "tap";
  return "";
}

module.exports = async (req, res) => {
  // Hobby plan allows 12 serverless functions. Tag routes rewrite here.
  const equipment = equipmentRoute(req);
  if (equipment === "tags") return handleTags(req, res);
  if (equipment === "operator") return handleOperator(req, res);
  if (equipment === "tap") return handleTap(req, res);

  // Preflight has no body.action — must CORS here or Capacitor login fails with "Load failed".
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  // Hobby plan: fold login OTP into this public POST endpoint (also via /api/auth-otp rewrite).
  // Must include resolve — SMS login falls back to action=resolve when send didn't return email.
  const otpAction = String(req.body?.action || "");
  if (otpAction === "send" || otpAction === "verify" || otpAction === "resolve") {
    return authOtpHandler(req, res);
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Get client IP (Vercel sets x-forwarded-for)
  const rawIP = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const ipHash = hashIP(rawIP);

  if (isRateLimited(ipHash)) {
    return res.status(429).json({ error: "Too many requests. Please try again in a few minutes." });
  }

  const { email, name } = req.body || {};
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = typeof name === "string" ? name.trim().slice(0, 100) : null;
  const userAgent = (req.headers["user-agent"] || "").slice(0, 500);

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Insert. If duplicate (unique index on lower(email)), treat as success silently
  // to avoid email enumeration via duplicate detection
  const { error: dbError } = await supabase
    .from("launch_notify_signups")
    .insert({
      email: cleanEmail,
      name: cleanName || null,
      ip_hash: ipHash,
      user_agent: userAgent,
    });

  // 23505 = unique violation (already on list) - return success
  if (dbError && dbError.code !== "23505") {
    console.error("notify-launch DB error:", dbError);
    return res.status(500).json({ error: "Could not save your signup. Try again?" });
  }

  // Send notification email to Ray (only on new signups, not duplicates)
  if (!dbError) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "CuePoint Launch List <hello@cuepointplanning.com>",
          to: ["ivstudiogroup@gmail.com"],
          subject: `[CuePoint Launch List] ${cleanName || "(no name)"} (${cleanEmail})`,
          html: `
            <h2 style="font-family:system-ui,sans-serif;margin:0 0 12px">New launch list signup</h2>
            <table style="font-family:system-ui,sans-serif;border-collapse:collapse">
              <tr><td style="padding:4px 12px 4px 0;color:#666">Name</td><td style="padding:4px 0;font-weight:600">${cleanName || "(not provided)"}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666">Email</td><td style="padding:4px 0;font-weight:600">${cleanEmail}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#666">Time</td><td style="padding:4px 0">${new Date().toISOString()}</td></tr>
            </table>
          `,
        }),
      });
    } catch (err) {
      // Non-fatal: signup succeeded even if notification fails
      console.error("notify-launch notification email failed:", err.message);
    }
  }

  return res.status(200).json({ success: true });
};
