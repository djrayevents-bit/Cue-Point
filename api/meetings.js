const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");
const {
  createMeetEvent,
  updateMeetEvent,
  cancelMeetEvent,
} = require("./_lib/googleCalendar");

/** URL-safe token with ≥128 bits of entropy. */
function makeSecretToken(byteLength = 18) {
  const n = Math.max(16, byteLength | 0);
  return crypto.randomBytes(n).toString("base64url");
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ORIGINS = new Set([
  "https://cuepointplanning.com",
  "https://www.cuepointplanning.com",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
]);

const rateLimitMap = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 12;

const normalizeHandle = (h) =>
  String(h || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const slugFromProfile = (p) =>
  normalizeHandle(p?.bookingHandle || p?.subdomain || p?.djName || p?.businessName || "");

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

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatWhen(date, startTime, endTime, timezone) {
  const tz = timezone ? ` (${timezone})` : "";
  return `${date} · ${startTime}–${endTime}${tz}`;
}

function buildMeetingIcs({ meeting, djName, joinUrl }) {
  const stamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
  const start = `${meeting.date.replace(/-/g, "")}T${String(meeting.startTime).replace(":", "")}00`;
  const end = `${meeting.date.replace(/-/g, "")}T${String(meeting.endTime).replace(":", "")}00`;
  const summary = String(meeting.title || `Meeting with ${djName}`).replace(/[,;\n]/g, " ");
  const desc = [
    `Scheduled via CuePoint Planning with ${djName}.`,
    meeting.notes ? `Notes: ${meeting.notes}` : "",
    joinUrl ? `Join page: ${joinUrl}` : "",
    meeting.meetLink ? `Meet link: ${meeting.meetLink}` : "",
  ]
    .filter(Boolean)
    .join("\\n")
    .replace(/[,;]/g, " ");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CuePoint Planning//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:meeting-${meeting.id}@cuepointplanning.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${desc}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

async function resolveDjEmails(userId, profile) {
  const emails = new Set();
  try {
    const { data: authData } = await supabase.auth.admin.getUserById(userId);
    const authEmail = String(authData?.user?.email || "").trim();
    if (authEmail.includes("@")) emails.add(authEmail);
  } catch (err) {
    console.warn("meetings auth email:", err.message);
  }
  const profileEmail = String(profile?.email || "").trim();
  if (profileEmail.includes("@")) emails.add(profileEmail);
  return [...emails];
}

async function sendResend({ to, subject, html, replyTo, attachments }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("meetings email skipped: RESEND_API_KEY missing");
    return { ok: false, skipped: true };
  }
  const payload = {
    from: "CuePoint Planning <hello@cuepointplanning.com>",
    replyTo: replyTo || "support@cuepointplanning.com",
    to: [to],
    subject,
    html,
  };
  if (attachments?.length) payload.attachments = attachments;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("meetings resend failed:", response.status, body);
    return { ok: false, status: response.status };
  }
  return { ok: true };
}

function appBaseUrl(req) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) return origin;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "cuepointplanning.com";
  return `${proto}://${host}`;
}

async function notifyMeetingBooked({ req, userId, profile, meeting, settings }) {
  const djName = profile?.businessName || profile?.djName || "Your DJ";
  const when = formatWhen(meeting.date, meeting.startTime, meeting.endTime, settings?.timezone);
  const base = appBaseUrl(req);
  const joinUrl = `${base}/app#/m/${meeting.id}/${meeting.joinToken}`;
  const ics = buildMeetingIcs({ meeting, djName, joinUrl });
  const icsAttachment = {
    filename: "cuepoint-meeting.ics",
    content: Buffer.from(ics, "utf8").toString("base64"),
  };

  const clientHtml = `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2 style="margin:0 0 12px">You're booked with ${escHtml(djName)}</h2>
      <p style="color:#444;line-height:1.6">Your meeting is confirmed for <strong>${escHtml(when)}</strong>.</p>
      <p style="color:#444;line-height:1.6">Use this page when it's time to join (Google Meet link appears here once your DJ adds it):</p>
      <p><a href="${escHtml(joinUrl)}" style="color:#6C4DF6;font-weight:700">${escHtml(joinUrl)}</a></p>
      <p style="color:#888;font-size:13px">A calendar invite (.ics) is attached. You can also add it from Google Calendar using the link in CuePoint.</p>
      <p style="color:#aaa;font-size:12px;margin-top:24px">Powered by CuePoint Planning</p>
    </div>`;

  const djRows = [
    ["Client", meeting.clientName],
    ["Email", meeting.clientEmail],
    ["Phone", meeting.clientPhone],
    ["When", when],
    ["Notes", meeting.notes],
  ]
    .filter(([, v]) => v)
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">${escHtml(label)}</td><td style="padding:4px 0;font-weight:600;white-space:pre-wrap">${escHtml(value)}</td></tr>`
    )
    .join("");

  const djHtml = `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2 style="margin:0 0 12px">New meeting booked</h2>
      <table style="border-collapse:collapse">${djRows}</table>
      <p style="margin-top:16px"><a href="${escHtml(base)}/app#meetings" style="color:#6C4DF6;font-weight:700">Open Meetings in CuePoint</a> to attach a Google Meet link.</p>
    </div>`;

  const clientTo = String(meeting.clientEmail || "").trim();
  const djEmails = await resolveDjEmails(userId, profile);
  const tasks = [];

  if (clientTo.includes("@")) {
    tasks.push(
      sendResend({
        to: clientTo,
        subject: `Confirmed: ${meeting.title || "Meeting"} with ${djName}`,
        html: clientHtml,
        replyTo: djEmails[0] || undefined,
        attachments: [icsAttachment],
      })
    );
  }

  for (const to of djEmails) {
    if (to.toLowerCase() === clientTo.toLowerCase()) continue;
    tasks.push(
      sendResend({
        to,
        subject: `[CuePoint] New meeting — ${meeting.clientName || "Client"}`,
        html: djHtml,
        replyTo: clientTo.includes("@") ? clientTo : undefined,
        attachments: [icsAttachment],
      })
    );
  }

  await Promise.all(tasks);
}

async function notifyMeetingCancelled({ userId, profile, meeting, settings }) {
  const djName = profile?.businessName || profile?.djName || "Your DJ";
  const when = formatWhen(meeting.date, meeting.startTime, meeting.endTime, settings?.timezone);
  const clientTo = String(meeting.clientEmail || "").trim();
  const djEmails = await resolveDjEmails(userId, profile);

  const clientHtml = `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2 style="margin:0 0 12px">Meeting cancelled</h2>
      <p style="color:#444;line-height:1.6">Your meeting with <strong>${escHtml(djName)}</strong> on <strong>${escHtml(when)}</strong> was cancelled.</p>
      <p style="color:#888;font-size:13px">Reply to this email if you need to reschedule.</p>
    </div>`;

  const djHtml = `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2 style="margin:0 0 12px">Meeting cancelled</h2>
      <p style="color:#444">${escHtml(meeting.clientName)} · ${escHtml(when)}</p>
    </div>`;

  const tasks = [];
  if (clientTo.includes("@")) {
    tasks.push(
      sendResend({
        to: clientTo,
        subject: `Cancelled: meeting with ${djName}`,
        html: clientHtml,
        replyTo: djEmails[0] || undefined,
      })
    );
  }
  for (const to of djEmails) {
    if (to.toLowerCase() === clientTo.toLowerCase()) continue;
    tasks.push(
      sendResend({
        to,
        subject: `[CuePoint] Meeting cancelled — ${meeting.clientName || "Client"}`,
        html: djHtml,
        replyTo: clientTo.includes("@") ? clientTo : undefined,
      })
    );
  }
  await Promise.all(tasks);
}

async function notifyMeetLinkReady({ userId, profile, meeting }) {
  const djName = profile?.businessName || profile?.djName || "Your DJ";
  const clientTo = String(meeting.clientEmail || "").trim();
  if (!clientTo.includes("@") || !meeting.meetLink) return;
  const djEmails = await resolveDjEmails(userId, profile);
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2 style="margin:0 0 12px">Your Google Meet link is ready</h2>
      <p style="color:#444;line-height:1.6">${escHtml(djName)} added the video link for your meeting on <strong>${escHtml(meeting.date)} · ${escHtml(meeting.startTime)}</strong>.</p>
      <p><a href="${escHtml(meeting.meetLink)}" style="display:inline-block;background:#6C4DF6;color:#fff;text-decoration:none;font-weight:700;border-radius:8px;padding:10px 16px">Join Google Meet</a></p>
    </div>`;
  await sendResend({
    to: clientTo,
    subject: `Meet link ready — ${meeting.title || "your meeting"}`,
    html,
    replyTo: djEmails[0] || undefined,
  });
}

async function findDjByHandle(handle) {
  const target = normalizeHandle(handle);
  if (!target) return null;

  const { data: rows, error } = await supabase
    .from("user_data")
    .select("user_id, key, value")
    .in("key", ["djProfile", "meetingSettings", "meetings", "blockedDates", "events"]);

  if (error) throw error;

  const byUser = {};
  for (const row of rows || []) {
    if (!byUser[row.user_id]) byUser[row.user_id] = { userId: row.user_id };
    byUser[row.user_id][row.key] = row.value;
  }

  for (const data of Object.values(byUser)) {
    const slug = slugFromProfile(data.djProfile || {});
    if (slug === target || normalizeHandle(data.userId) === target) return data;
  }

  const users = Object.values(byUser);
  return users.length === 1 ? users[0] : null;
}

function slotTaken(meetings, date, startTime, endTime, excludeId) {
  return (meetings || []).some((m) => {
    if (excludeId && String(m.id) === String(excludeId)) return false;
    if (m.status === "cancelled") return false;
    if (m.date !== date) return false;
    return m.startTime < endTime && m.endTime > startTime;
  });
}

function addMinutes(timeHHMM, mins) {
  const [h, m] = timeHHMM.split(":").map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

function timeToMins(t) {
  const [h, m] = String(t || "00:00").split(":").map(Number);
  return h * 60 + m;
}

function getWindowsForDate(settings, ds) {
  const override = (settings?.dateOverrides || []).find((o) => o && o.date === ds);
  if (override) {
    if (override.type === "unavailable") return [];
    if (override.type === "custom") return Array.isArray(override.hours) ? override.hours : [];
  }
  const d = new Date(ds + "T12:00:00");
  const day = d.getDay();
  const weekly = settings.weeklyHours || {};
  return weekly[day] || weekly[String(day)] || [];
}

function isSlotAllowed(settings, date, startTime, endTime) {
  const windows = getWindowsForDate(settings, date);
  if (!windows.length) return false;
  return windows.some(
    (w) =>
      w?.start &&
      w?.end &&
      timeToMins(startTime) >= timeToMins(w.start) &&
      timeToMins(endTime) <= timeToMins(w.end)
  );
}

async function loadProfile(userId) {
  const { data } = await supabase
    .from("user_data")
    .select("value")
    .eq("user_id", userId)
    .eq("key", "djProfile")
    .maybeSingle();
  return data?.value || {};
}

async function loadMeetingSettings(userId) {
  const { data } = await supabase
    .from("user_data")
    .select("value")
    .eq("user_id", userId)
    .eq("key", "meetingSettings")
    .maybeSingle();
  return data?.value || {};
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      const handle = req.query.handle;
      const meetingId = req.query.meetingId;
      const token = req.query.token;

      if (meetingId && token) {
        const { data: rows, error } = await supabase
          .from("user_data")
          .select("user_id, value")
          .eq("key", "meetings");
        if (error) return res.status(500).json({ error: "DB error" });

        for (const row of rows || []) {
          const list = Array.isArray(row.value) ? row.value : [];
          const meeting = list.find(
            (m) => String(m.id) === String(meetingId) && m.joinToken === token
          );
          if (meeting) {
            const profile = await loadProfile(row.user_id);
            const settings = await loadMeetingSettings(row.user_id);
            return res.status(200).json({
              meeting: {
                id: meeting.id,
                title: meeting.title,
                date: meeting.date,
                startTime: meeting.startTime,
                endTime: meeting.endTime,
                status: meeting.status,
                clientName: meeting.clientName,
                meetLink: meeting.meetLink || "",
                joinToken: meeting.joinToken,
                googleCalendarUrl: meeting.googleCalendarUrl || "",
                timezone: meeting.timezone || settings.timezone || "",
                googleEventId: meeting.googleEventId || "",
              },
              scheduleHandle: slugFromProfile(profile || {}),
              timezone: meeting.timezone || settings.timezone || "America/New_York",
              djProfile: profile || {},
            });
          }
        }
        return res.status(404).json({ error: "Meeting not found" });
      }

      if (!handle) return res.status(400).json({ error: "Missing handle" });
      const dj = await findDjByHandle(handle);
      if (!dj) return res.status(404).json({ error: "Scheduler not found" });

      const settings = dj.meetingSettings || {};
      if (settings.enabled === false) {
        return res.status(404).json({ error: "Scheduling is disabled" });
      }

      const meetings = (Array.isArray(dj.meetings) ? dj.meetings : [])
        .filter((m) => m.status !== "cancelled")
        .map((m) => ({
          date: m.date,
          startTime: m.startTime,
          endTime: m.endTime,
          status: m.status,
        }));

      return res.status(200).json({
        userId: dj.userId,
        djProfile: {
          businessName: dj.djProfile?.businessName || "",
          djName: dj.djProfile?.djName || "",
          fullName: dj.djProfile?.fullName || "",
          email: dj.djProfile?.email || "",
          brandColor: dj.djProfile?.brandColor || "",
          logoPhoto: dj.djProfile?.logoPhoto || "",
        },
        settings: {
          enabled: settings.enabled !== false,
          title: settings.title || "Book a Meeting",
          description:
            settings.description ||
            "Pick a time that works for you. You’ll get a confirmation email and join link through CuePoint.",
          durationMins: Number(settings.durationMins) || 30,
          bufferMins: Number(settings.bufferMins) || 0,
          daysAhead: Number(settings.daysAhead) || 30,
          weeklyHours: settings.weeklyHours || null,
          dateOverrides: Array.isArray(settings.dateOverrides) ? settings.dateOverrides : [],
          timezone: settings.timezone || "America/New_York",
        },
        meetings,
        blockedDates: Array.isArray(dj.blockedDates) ? dj.blockedDates : [],
        bookedEventDates: (Array.isArray(dj.events) ? dj.events : [])
          .filter((e) => e?.date && ["Confirmed", "Pending"].includes(e.status))
          .map((e) => e.date),
      });
    }

    if (req.method === "POST") {
      const {
        handle,
        clientName,
        clientEmail,
        clientPhone,
        date,
        startTime,
        notes,
        title,
      } = req.body || {};

      if (!handle || !clientName || !clientEmail || !date || !startTime) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const ip = clientIp(req);
      if (isRateLimited(`${ip}:${normalizeHandle(handle)}`)) {
        return res.status(429).json({ error: "Too many requests. Please try again later." });
      }

      const dj = await findDjByHandle(handle);
      if (!dj) return res.status(404).json({ error: "Scheduler not found" });

      const settings = dj.meetingSettings || {};
      if (settings.enabled === false) {
        return res.status(403).json({ error: "Scheduling is disabled" });
      }

      const duration = Number(settings.durationMins) || 30;
      const endTime = addMinutes(startTime, duration);
      const existing = Array.isArray(dj.meetings) ? dj.meetings : [];

      if (slotTaken(existing, date, startTime, endTime)) {
        return res.status(409).json({ error: "That time was just booked. Pick another slot." });
      }

      if (!isSlotAllowed(settings, date, startTime, endTime)) {
        return res.status(409).json({ error: "That time is no longer available. Pick another slot." });
      }

      const blocked = Array.isArray(dj.blockedDates) ? dj.blockedDates : [];
      if (blocked.some((b) => (typeof b === "string" ? b : b.date) === date)) {
        return res.status(409).json({ error: "That day is blocked. Pick another day." });
      }

      const bookedEventDates = (Array.isArray(dj.events) ? dj.events : [])
        .filter((e) => e?.date && ["Confirmed", "Pending"].includes(e.status))
        .map((e) => e.date);
      if (bookedEventDates.includes(date)) {
        return res.status(409).json({ error: "That day is booked for an event. Pick another day." });
      }

      const id = Date.now();
      const joinToken = makeSecretToken(18);
      const meetingTitle =
        title ||
        settings.title ||
        `Meeting with ${dj.djProfile?.djName || dj.djProfile?.businessName || "DJ"}`;

      const startStamp = `${date.replace(/-/g, "")}T${startTime.replace(":", "")}00`;
      const endStamp = `${date.replace(/-/g, "")}T${endTime.replace(":", "")}00`;
      const details = [
        `Scheduled via CuePoint Planning.`,
        notes ? `Notes: ${notes}` : "",
        `Client: ${clientName} (${clientEmail})`,
        `Timezone: ${settings.timezone || "local"}`,
        `After opening this event in Google Calendar, click "Add Google Meet video conferencing" to create the Meet link.`,
      ]
        .filter(Boolean)
        .join("\n");

      const googleCalendarUrl =
        `https://calendar.google.com/calendar/render?action=TEMPLATE` +
        `&text=${encodeURIComponent(meetingTitle)}` +
        `&dates=${startStamp}/${endStamp}` +
        `&details=${encodeURIComponent(details)}` +
        `&add=${encodeURIComponent(clientEmail)}`;

      const meeting = {
        id,
        title: meetingTitle,
        clientName: String(clientName).trim(),
        clientEmail: String(clientEmail).trim().toLowerCase(),
        clientPhone: clientPhone || "",
        date,
        startTime,
        endTime,
        durationMins: duration,
        notes: notes || "",
        status: "scheduled",
        meetLink: "",
        joinToken,
        googleCalendarUrl,
        timezone: settings.timezone || "",
        createdAt: new Date().toISOString(),
        source: "schedule_link",
        googleEventId: "",
      };

      try {
        const gcal = await createMeetEvent({
          userId: dj.userId,
          meeting,
          timeZone: settings.timezone || "America/New_York",
          djName: dj.djProfile?.businessName || dj.djProfile?.djName || "",
        });
        if (gcal?.meetLink) {
          meeting.meetLink = gcal.meetLink;
          meeting.googleEventId = gcal.eventId || "";
          if (gcal.htmlLink) meeting.googleCalendarUrl = gcal.htmlLink;
        }
      } catch (err) {
        console.warn("auto Meet create skipped:", err.message);
      }

      const nextMeetings = [meeting, ...existing];
      const { error: upErr } = await supabase.from("user_data").upsert(
        {
          user_id: dj.userId,
          key: "meetings",
          value: nextMeetings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,key" }
      );
      if (upErr) return res.status(500).json({ error: upErr.message });

      // Fire-and-forget emails — booking already succeeded
      notifyMeetingBooked({
        req,
        userId: dj.userId,
        profile: dj.djProfile || {},
        meeting,
        settings,
      }).catch((err) => console.error("meeting notify error:", err));

      return res.status(200).json({
        ok: true,
        meeting: {
          id: meeting.id,
          title: meeting.title,
          date: meeting.date,
          startTime: meeting.startTime,
          endTime: meeting.endTime,
          joinToken: meeting.joinToken,
          googleCalendarUrl: meeting.googleCalendarUrl,
          meetLink: meeting.meetLink || "",
          status: meeting.status,
          timezone: meeting.timezone,
        },
        djName: dj.djProfile?.businessName || dj.djProfile?.djName || "Your DJ",
        emailed: true,
      });
    }

    if (req.method === "PATCH") {
      // DJ or client: meet link, cancel, or reschedule via meeting id + joinToken
      const { meetingId, token, meetLink, status, date, startTime, action } = req.body || {};
      if (!meetingId || !token) return res.status(400).json({ error: "Missing params" });

      const { data: rows, error } = await supabase
        .from("user_data")
        .select("user_id, value")
        .eq("key", "meetings");
      if (error) return res.status(500).json({ error: "DB error" });

      for (const row of rows || []) {
        const list = Array.isArray(row.value) ? row.value : [];
        const idx = list.findIndex(
          (m) => String(m.id) === String(meetingId) && m.joinToken === token
        );
        if (idx === -1) continue;

        const prev = list[idx];
        const profile = await loadProfile(row.user_id);
        const settings = await loadMeetingSettings(row.user_id);
        const updated = [...list];
        let next = { ...updated[idx] };

        if (action === "reschedule" || (date && startTime && !status && meetLink == null)) {
          if (prev.status === "cancelled") {
            return res.status(409).json({ error: "Cancelled meetings cannot be rescheduled" });
          }
          if (!date || !startTime) {
            return res.status(400).json({ error: "date and startTime required to reschedule" });
          }
          const duration = Number(prev.durationMins) || Number(settings.durationMins) || 30;
          const endTime = addMinutes(startTime, duration);
          if (slotTaken(list, date, startTime, endTime, meetingId)) {
            return res.status(409).json({ error: "That time was just booked. Pick another slot." });
          }
          if (!isSlotAllowed(settings, date, startTime, endTime)) {
            return res.status(409).json({ error: "That time is no longer available." });
          }

          const { data: blockedRow } = await supabase
            .from("user_data")
            .select("value")
            .eq("user_id", row.user_id)
            .eq("key", "blockedDates")
            .maybeSingle();
          const blockedDates = Array.isArray(blockedRow?.value) ? blockedRow.value : [];
          if (blockedDates.some((b) => (typeof b === "string" ? b : b.date) === date)) {
            return res.status(409).json({ error: "That day is blocked." });
          }

          next = {
            ...next,
            date,
            startTime,
            endTime,
            durationMins: duration,
            reminderSentAt: null,
            updatedAt: new Date().toISOString(),
          };

          if (next.googleEventId) {
            try {
              await updateMeetEvent({
                userId: row.user_id,
                eventId: next.googleEventId,
                meeting: next,
                timeZone: settings.timezone || next.timezone || "America/New_York",
              });
            } catch (err) {
              console.warn("google event update:", err.message);
            }
          }

          updated[idx] = next;
          const { error: upErr } = await supabase.from("user_data").upsert(
            {
              user_id: row.user_id,
              key: "meetings",
              value: updated,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,key" }
          );
          if (upErr) return res.status(500).json({ error: upErr.message });

          notifyMeetingBooked({
            req,
            userId: row.user_id,
            profile,
            meeting: { ...next, title: `${next.title || "Meeting"} (rescheduled)` },
            settings,
          }).catch((err) => console.error("reschedule notify:", err));

          return res.status(200).json({ ok: true, meeting: next, rescheduled: true });
        }

        next = {
          ...next,
          ...(typeof meetLink === "string" ? { meetLink: meetLink.trim() } : {}),
          ...(status ? { status } : {}),
          updatedAt: new Date().toISOString(),
        };
        updated[idx] = next;

        const { error: upErr } = await supabase.from("user_data").upsert(
          {
            user_id: row.user_id,
            key: "meetings",
            value: updated,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,key" }
        );
        if (upErr) return res.status(500).json({ error: upErr.message });

        if (status === "cancelled" && prev.status !== "cancelled") {
          if (prev.googleEventId) {
            cancelMeetEvent({ userId: row.user_id, eventId: prev.googleEventId }).catch(() => {});
          }
          notifyMeetingCancelled({
            userId: row.user_id,
            profile,
            meeting: next,
            settings,
          }).catch((err) => console.error("meeting cancel notify:", err));
        }

        const linkJustAdded =
          typeof meetLink === "string" &&
          meetLink.trim() &&
          !prev.meetLink;
        if (linkJustAdded) {
          notifyMeetLinkReady({
            userId: row.user_id,
            profile,
            meeting: next,
          }).catch((err) => console.error("meet link notify:", err));
        }

        return res.status(200).json({ ok: true, meeting: next });
      }

      return res.status(404).json({ error: "Meeting not found" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("meetings API error:", e);
    return res.status(500).json({ error: e.message || "Server error" });
  }
};
