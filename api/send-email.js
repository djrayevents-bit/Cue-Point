const { createClient } = require("@supabase/supabase-js");

/**
 * Soft-start admin inbox for product/support notifyAdmin sends (server-only).
 * Client email to leads/clients/events is gated by contact lookup below.
 */
function adminNotifyEmail() {
  const fromEnv = String(process.env.ADMIN_NOTIFY_EMAIL || "").trim().toLowerCase();
  if (fromEnv.includes("@")) return fromEnv;
  return "ivstudiogroup@gmail.com";
}

const ALLOWED_ORIGINS = new Set([
  "https://cuepointplanning.com",
  "https://www.cuepointplanning.com",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
]);

const rateLimitMap = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 10;

const CONTACT_KEYS = ["leads", "clients", "events", "djProfile"];

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

function addEmail(set, raw) {
  const e = normEmail(raw);
  if (e && e.includes("@") && e.length <= 254) set.add(e);
}

/** Collect every email address that appears on this DJ's CRM blobs. */
function collectContactEmails(rows) {
  const emails = new Set();
  for (const row of rows || []) {
    const key = row.key;
    const value = row.value;
    if (key === "djProfile" && value && typeof value === "object") {
      addEmail(emails, value.email);
      continue;
    }
    if (!Array.isArray(value)) continue;
    if (key === "leads") {
      for (const l of value) {
        addEmail(emails, l?.email);
        addEmail(emails, l?.clientEmail);
      }
    } else if (key === "clients") {
      for (const c of value) {
        addEmail(emails, c?.email);
        for (const ct of c?.contacts || []) addEmail(emails, ct?.email);
      }
    } else if (key === "events") {
      for (const ev of value) {
        addEmail(emails, ev?.clientEmail);
        addEmail(emails, ev?.email);
        for (const ct of ev?.contacts || []) addEmail(emails, ct?.email);
      }
    }
  }
  return emails;
}

async function isAllowedRecipient(supabase, user, toRaw, { allowAdmin = false } = {}) {
  const to = normEmail(toRaw);
  if (!to || !to.includes("@")) return false;
  if (allowAdmin && to === adminNotifyEmail()) return true;
  if (normEmail(user.email) === to) return true;

  try {
    const { data: rows, error } = await supabase
      .from("user_data")
      .select("key, value")
      .eq("user_id", user.id)
      .in("key", CONTACT_KEYS);
    if (error) {
      console.warn("send-email contact lookup failed:", error.message);
      return false;
    }
    const allowed = collectContactEmails(rows);
    return allowed.has(to);
  } catch (err) {
    console.warn("send-email contact lookup error:", err.message);
    return false;
  }
}

async function loadDjProfile(supabase, userId) {
  try {
    const { data } = await supabase
      .from("user_data")
      .select("value")
      .eq("user_id", userId)
      .eq("key", "djProfile")
      .maybeSingle();
    return data?.value && typeof data.value === "object" ? data.value : {};
  } catch {
    return {};
  }
}

function sanitizeFromName(name) {
  const cleaned = String(name || "CuePoint")
    .replace(/[<>\r\n"]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
  return cleaned || "CuePoint";
}

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolveHtml({ html, text }) {
  if (html != null && String(html).trim()) return String(html);
  if (text != null && String(text).trim()) {
    return `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.65;color:#1A1A2E;white-space:pre-wrap">${escHtml(text).replace(/\n/g, "<br/>")}</div>`;
  }
  return null;
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

  const body = req.body || {};
  const notifyAdmin = body.notifyAdmin === true;
  const to = notifyAdmin ? adminNotifyEmail() : body.to;
  const subject = body.subject;
  const htmlBody = resolveHtml({ html: body.html, text: body.text });

  if (!to || !subject || !htmlBody) {
    return res.status(400).json({ error: "Missing fields (to, subject, and html or text required)" });
  }
  if (String(subject).length > 200) {
    return res.status(400).json({ error: "Subject too long" });
  }

  const allowed = await isAllowedRecipient(supabase, user, to, { allowAdmin: notifyAdmin });
  if (!allowed) {
    console.warn("send-email blocked: recipient not on contacts", { userId: user.id, to: normEmail(to) });
    return res.status(403).json({ error: "Recipient not allowed — email must match a lead, client, or event contact on your account." });
  }

  const profile = await loadDjProfile(supabase, user.id);
  const fromName = sanitizeFromName(
    profile.djName || profile.businessName || profile.fullName || "CuePoint"
  );
  const replyTo =
    normEmail(profile.email)?.includes("@")
      ? String(profile.email).trim()
      : normEmail(user.email)?.includes("@")
        ? String(user.email).trim()
        : "support@cuepointplanning.com";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${fromName} via CuePoint <hello@cuepointplanning.com>`,
        replyTo,
        to: [String(to).trim()],
        subject: String(subject),
        html: htmlBody,
        ...(body.text ? { text: String(body.text) } : {}),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("send-email Resend error:", response.status, typeof data?.message === "string" ? data.message : "failed");
      return res.status(500).json({ error: "Email provider rejected the send" });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("send-email error:", err.message);
    return res.status(500).json({ error: err.message || "Send failed" });
  }
};
