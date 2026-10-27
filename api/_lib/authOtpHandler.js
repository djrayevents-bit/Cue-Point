/**
 * Custom passwordless OTP for CuePoint login.
 * Mounted from api/notify-launch.js (Hobby plan function limit) and
 * reached via /api/auth-otp rewrite in vercel.json.
 * Email codes go through Resend (bypasses broken Supabase magic-link mailer).
 * SMS codes use the same OTP, delivered via Twilio when configured,
 * after resolving the account by auth phone or djProfile.phone.
 */
const { createClient } = require("@supabase/supabase-js");
const ALLOWED_ORIGINS = require("./allowedOrigins");

const rateLimitMap = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_SENDS = 5;

function admin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function authClient() {
  // Prefer anon for verifyOtp; service role also works as apikey on GoTrue.
  const key =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(process.env.SUPABASE_URL, key);
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
  if (entry.count >= MAX_SENDS) return true;
  entry.count += 1;
  rateLimitMap.set(key, entry);
  return false;
}

function digitsOnly(raw) {
  return String(raw || "").replace(/\D/g, "");
}

function normalizePhoneE164(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+")) {
    const d = digitsOnly(trimmed);
    if (d.length >= 10 && d.length <= 15) return `+${d}`;
    return null;
  }
  const only = digitsOnly(trimmed);
  if (only.length === 10) return `+1${only}`;
  if (only.length === 11 && only.startsWith("1")) return `+${only}`;
  if (only.length >= 10 && only.length <= 15) return `+${only}`;
  return null;
}

function phonesMatch(a, b) {
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (!da || !db) return false;
  if (da === db) return true;
  const ta = da.length === 11 && da.startsWith("1") ? da.slice(1) : da;
  const tb = db.length === 11 && db.startsWith("1") ? db.slice(1) : db;
  return ta === tb && ta.length >= 10;
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function sendResendEmail({ to, subject, html, text }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Email provider is not configured (RESEND_API_KEY).");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "CuePoint <hello@cuepointplanning.com>",
      to: [String(to).trim()],
      subject,
      html,
      ...(text ? { text } : {}),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = typeof data?.message === "string" ? data.message : "Email provider rejected the send";
    throw new Error(msg);
  }
  return data;
}

async function sendTwilioSms({ to, body }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) {
    throw new Error("SMS provider is not configured (Twilio).");
  }
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = typeof data?.message === "string" ? data.message : "SMS provider rejected the send";
    throw new Error(msg);
  }
  return data;
}

async function findUserByEmail(supabase, email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;
  // Prefer getUserByEmail when available
  if (typeof supabase.auth.admin.getUserByEmail === "function") {
    const { data, error } = await supabase.auth.admin.getUserByEmail(normalized);
    if (!error && data?.user) return data.user;
  }
  // Paginate listUsers (small founding-member base)
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const users = data?.users || [];
    const hit = users.find((u) => String(u.email || "").toLowerCase() === normalized);
    if (hit) return hit;
    if (users.length < 200) break;
  }
  return null;
}

async function findUserByPhone(supabase, e164) {
  // Auth users with phone set
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const users = data?.users || [];
    const hit = users.find((u) => phonesMatch(u.phone, e164));
    if (hit) return hit;
    if (users.length < 200) break;
  }

  // Match CuePoint profile phone in user_data
  const { data: rows, error: qErr } = await supabase
    .from("user_data")
    .select("user_id, value")
    .eq("key", "djProfile");
  if (qErr || !Array.isArray(rows)) return null;

  for (const row of rows) {
    let value = row?.value;
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        value = null;
      }
    }
    const profilePhone = value?.phone;
    if (!phonesMatch(profilePhone, e164)) continue;
    const { data, error } = await supabase.auth.admin.getUserById(row.user_id);
    if (!error && data?.user) return data.user;
  }
  return null;
}

async function ensurePhoneOnUser(supabase, user, e164) {
  if (phonesMatch(user.phone, e164)) return user;
  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    phone: e164,
  });
  if (error) {
    console.warn("auth-otp phone link failed:", error.message);
    return user;
  }
  return data?.user || user;
}

async function issueEmailOtp(supabase, email) {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: String(email).trim(),
  });
  if (error) throw error;
  const otp = data?.properties?.email_otp;
  if (!otp) throw new Error("Could not generate login code.");
  return String(otp);
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Auth server is not configured." });
  }

  const body = req.body || {};
  const action = String(body.action || "send");
  const channel = body.channel === "sms" ? "sms" : "email";
  const ip = clientIp(req);

  try {
    const supabase = admin();

    if (action === "send") {
      if (isRateLimited(`send:${ip}`)) {
        return res.status(429).json({ error: "Too many codes requested. Wait a minute and try again." });
      }

      if (channel === "email") {
        const email = String(body.email || "").trim().toLowerCase();
        if (!isValidEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });

        let user = await findUserByEmail(supabase, email);
        if (!user && body.create) {
          const meta = body.meta && typeof body.meta === "object" ? body.meta : {};
          const { data: created, error: createErr } = await supabase.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: meta,
          });
          if (createErr) {
            const msg = String(createErr.message || "");
            if (/already|registered|exists/i.test(msg)) {
              return res.status(409).json({ error: "An account with that email already exists. Sign in instead." });
            }
            throw createErr;
          }
          user = created?.user || null;
        }
        if (!user) {
          return res.status(404).json({
            error: body.create
              ? "Couldn’t create that account. Try again."
              : "No account found for that email. Start free to create one.",
          });
        }

        const otp = await issueEmailOtp(supabase, email);
        await sendResendEmail({
          to: email,
          subject: `${otp} is your CuePoint sign-in code`,
          text: `Your CuePoint sign-in code is ${otp}. It expires in about an hour.\n\nIf you didn’t request this, you can ignore this email.`,
          html: `<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;line-height:1.5;color:#16161A">
            <p style="font-size:16px;margin:0 0 12px">Your CuePoint sign-in code:</p>
            <p style="font-size:32px;font-weight:800;letter-spacing:0.2em;margin:0 0 16px">${otp}</p>
            <p style="font-size:13px;color:#8E8E93;margin:0">Expires in about an hour. If you didn’t request this, ignore this email.</p>
          </div>`,
        });
        return res.status(200).json({ ok: true, channel: "email", email });
      }

      // SMS
      const e164 = normalizePhoneE164(body.phone);
      if (!e164) return res.status(400).json({ error: "Enter a valid mobile number, like (555) 123-4567." });

      let user = await findUserByPhone(supabase, e164);
      if (!user && body.create) {
        const email = String(body.email || "").trim().toLowerCase();
        if (!isValidEmail(email)) {
          return res.status(400).json({ error: "Enter a valid email (needed for billing & receipts)." });
        }
        const existingEmail = await findUserByEmail(supabase, email);
        if (existingEmail) {
          return res.status(409).json({
            error: "An account with that email already exists. Sign in with email, then add this phone under Account & Brand.",
          });
        }
        const meta = body.meta && typeof body.meta === "object" ? body.meta : {};
        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
          email,
          phone: e164,
          email_confirm: true,
          user_metadata: meta,
        });
        if (createErr) {
          const msg = String(createErr.message || "");
          if (/already|registered|exists|phone/i.test(msg)) {
            return res.status(409).json({ error: "That email or phone is already registered. Try signing in." });
          }
          throw createErr;
        }
        user = created?.user || null;
      }
      if (!user) {
        return res.status(404).json({
          error: body.create
            ? "Couldn’t create that account. Try again."
            : "No account found for that number. Sign in with email once, then add this phone under Account & Brand → Text message login.",
        });
      }
      if (!user.email) {
        return res.status(400).json({
          error: "This account has no email on file. Sign in with email first, then add your phone.",
        });
      }

      user = await ensurePhoneOnUser(supabase, user, e164);
      const otp = await issueEmailOtp(supabase, user.email);

      const twilioReady = !!(
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        (process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER)
      );

      if (twilioReady) {
        await sendTwilioSms({
          to: e164,
          body: `Your CuePoint code is ${otp}. It expires soon.`,
        });
        return res.status(200).json({ ok: true, channel: "sms", email: user.email });
      }

      // Fallback: still deliver the code by email if Twilio isn't set up yet
      await sendResendEmail({
        to: user.email,
        subject: `${otp} is your CuePoint sign-in code`,
        text: `You asked for a text code for ${e164}. SMS isn’t configured on the server yet, so here’s your CuePoint code: ${otp}`,
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;line-height:1.5;color:#16161A">
          <p style="font-size:15px;margin:0 0 12px">You requested a text code for <strong>${e164}</strong>.</p>
          <p style="font-size:14px;color:#8E8E93;margin:0 0 12px">SMS delivery isn’t configured yet, so we emailed your code instead:</p>
          <p style="font-size:32px;font-weight:800;letter-spacing:0.2em;margin:0">${otp}</p>
        </div>`,
      });
      return res.status(200).json({
        ok: true,
        channel: "sms",
        email: user.email,
        deliveredVia: "email_fallback",
        message: "SMS isn’t configured yet — we emailed the code to your account email.",
      });
    }

    if (action === "resolve") {
      if (channel === "sms") {
        const e164 = normalizePhoneE164(body.phone);
        if (!e164) return res.status(400).json({ error: "Missing phone number." });
        const user = await findUserByPhone(supabase, e164);
        if (!user?.email) {
          return res.status(404).json({
            error: "No account found for that number. Sign in with email once, then add this phone under Account & Brand → Text message login.",
          });
        }
        return res.status(200).json({ ok: true, email: String(user.email).toLowerCase() });
      }
      const email = String(body.email || "").trim().toLowerCase();
      if (!isValidEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
      const user = await findUserByEmail(supabase, email);
      if (!user) {
        return res.status(404).json({ error: "No account found for that email. Start free to create one." });
      }
      return res.status(200).json({ ok: true, email });
    }

    if (action === "verify") {
      if (isRateLimited(`verify:${ip}`)) {
        return res.status(429).json({ error: "Too many attempts. Wait a minute and try again." });
      }
      const token = String(body.token || "").replace(/\s/g, "");
      if (!token || token.length < 6) {
        return res.status(400).json({ error: "Enter the 6-digit code we sent." });
      }

      let email = String(body.email || "").trim().toLowerCase();
      if (channel === "sms") {
        const e164 = normalizePhoneE164(body.phone);
        if (!e164) return res.status(400).json({ error: "Missing phone number." });
        const user = await findUserByPhone(supabase, e164);
        if (!user?.email) {
          return res.status(404).json({ error: "No account found for that number." });
        }
        email = String(user.email).toLowerCase();
      }
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: "Missing email for verification." });
      }

      const client = authClient();
      const { data, error } = await client.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      if (error) {
        return res.status(400).json({ error: error.message || "Invalid or expired code." });
      }
      const session = data?.session;
      if (!session?.access_token || !session?.refresh_token) {
        return res.status(500).json({ error: "Code worked, but no session was returned. Try again." });
      }
      return res.status(200).json({
        ok: true,
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          expires_at: session.expires_at,
          token_type: session.token_type,
          user: session.user,
        },
      });
    }

    return res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    console.error("auth-otp error:", err?.message || err);
    const msg = String(err?.message || "Could not process login code.");
    // Soften provider noise
    if (/RESEND|email provider/i.test(msg)) {
      return res.status(500).json({ error: "Couldn’t send the email code. Try again in a minute." });
    }
    if (/SMS provider|Twilio/i.test(msg)) {
      return res.status(500).json({ error: "Couldn’t send the text. Try email login, or try again shortly." });
    }
    return res.status(500).json({ error: msg });
  }
};
