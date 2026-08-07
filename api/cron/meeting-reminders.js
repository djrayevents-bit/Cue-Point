/**
 * Hourly cron: email 24h meeting reminders.
 * Secure with CRON_SECRET header (Authorization: Bearer …) or Vercel Cron.
 */
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendResend({ to, subject, html, replyTo }) {
  if (!process.env.RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "CuePoint Planning <hello@cuepointplanning.com>",
      replyTo: replyTo || "support@cuepointplanning.com",
      to: [to],
      subject,
      html,
    }),
  });
}

/** Interpret DJ wall date+time in timezone → UTC ms (best-effort). */
function wallToUtcMs(dateStr, timeHHMM, timeZone) {
  const [y, mo, d] = String(dateStr).split("-").map(Number);
  const [hh, mm] = String(timeHHMM || "00:00").split(":").map(Number);
  let utc = Date.UTC(y, mo - 1, d, hh, mm, 0);
  const tz = timeZone || "America/New_York";
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(utc));
    const get = (t) => Number(parts.find((p) => p.type === t)?.value || 0);
    let hour = get("hour");
    if (hour === 24) hour = 0;
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), 0);
    const desired = Date.UTC(y, mo - 1, d, hh, mm, 0);
    utc += desired - asUtc;
  }
  return utc;
}

function authorized(req) {
  const secret = process.env.CRON_SECRET || process.env.MEETING_REMINDER_SECRET;
  if (!secret) {
    // Allow Vercel Cron (has x-vercel-cron) when no secret configured
    return req.headers["x-vercel-cron"] === "1";
  }
  const auth = req.headers.authorization || "";
  if (auth === `Bearer ${secret}`) return true;
  if (req.headers["x-cron-secret"] === secret) return true;
  if (req.headers["x-vercel-cron"] === "1" && auth === `Bearer ${secret}`) return true;
  return req.headers["x-vercel-cron"] === "1";
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!authorized(req)) return res.status(401).json({ error: "Unauthorized" });

  const now = Date.now();
  const windowStart = now + 23 * 60 * 60 * 1000;
  const windowEnd = now + 25 * 60 * 60 * 1000;

  const { data: rows, error } = await supabase
    .from("user_data")
    .select("user_id, value")
    .eq("key", "meetings");
  if (error) return res.status(500).json({ error: error.message });

  let scanned = 0;
  let reminded = 0;

  for (const row of rows || []) {
    const list = Array.isArray(row.value) ? row.value : [];
    if (!list.length) continue;

    const { data: settingsRow } = await supabase
      .from("user_data")
      .select("value")
      .eq("user_id", row.user_id)
      .eq("key", "meetingSettings")
      .maybeSingle();
    const settings = settingsRow?.value || {};
    const tz = settings.timezone || "America/New_York";

    const { data: profileRow } = await supabase
      .from("user_data")
      .select("value")
      .eq("user_id", row.user_id)
      .eq("key", "djProfile")
      .maybeSingle();
    const profile = profileRow?.value || {};
    const djName = profile.businessName || profile.djName || "Your DJ";
    const djEmail = String(profile.email || "").trim();

    let changed = false;
    const next = [];

    for (const m of list) {
      scanned += 1;
      if (!m || m.status === "cancelled" || m.reminderSentAt) {
        next.push(m);
        continue;
      }
      if (!m.date || !m.startTime) {
        next.push(m);
        continue;
      }

      const startMs = wallToUtcMs(m.date, m.startTime, m.timezone || tz);
      if (startMs < windowStart || startMs > windowEnd) {
        next.push(m);
        continue;
      }

      const when = `${m.date} · ${m.startTime}–${m.endTime} (${m.timezone || tz})`;
      const joinUrl = m.joinToken
        ? `https://cuepointplanning.com/app#/m/${m.id}/${m.joinToken}`
        : "";
      const clientHtml = `
        <div style="font-family:system-ui,sans-serif;max-width:560px">
          <h2 style="margin:0 0 12px">Reminder: meeting tomorrow</h2>
          <p style="color:#444;line-height:1.6">Your meeting with <strong>${escHtml(djName)}</strong> is coming up:</p>
          <p style="font-weight:700">${escHtml(when)}</p>
          ${m.meetLink ? `<p><a href="${escHtml(m.meetLink)}" style="color:#6C4DF6;font-weight:700">Join Google Meet</a></p>` : ""}
          ${joinUrl ? `<p><a href="${escHtml(joinUrl)}" style="color:#6C4DF6">Open meeting page</a></p>` : ""}
        </div>`;

      const tasks = [];
      if (m.clientEmail) {
        tasks.push(
          sendResend({
            to: m.clientEmail,
            subject: `Reminder: meeting with ${djName} tomorrow`,
            html: clientHtml,
            replyTo: djEmail || undefined,
          })
        );
      }
      if (djEmail && djEmail.toLowerCase() !== String(m.clientEmail || "").toLowerCase()) {
        tasks.push(
          sendResend({
            to: djEmail,
            subject: `[CuePoint] Reminder — ${m.clientName || "Client"} tomorrow`,
            html: `<div style="font-family:system-ui,sans-serif"><h2>Meeting reminder</h2><p>${escHtml(m.clientName)} · ${escHtml(when)}</p></div>`,
            replyTo: m.clientEmail || undefined,
          })
        );
      }
      await Promise.all(tasks);

      next.push({ ...m, reminderSentAt: new Date().toISOString() });
      changed = true;
      reminded += 1;
    }

    if (changed) {
      await supabase.from("user_data").upsert(
        {
          user_id: row.user_id,
          key: "meetings",
          value: next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,key" }
      );
    }
  }

  return res.status(200).json({ ok: true, scanned, reminded });
};
