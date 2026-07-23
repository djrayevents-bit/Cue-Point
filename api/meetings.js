import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const normalizeHandle = (h) =>
  String(h || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const slugFromProfile = (p) =>
  normalizeHandle(p?.bookingHandle || p?.subdomain || p?.djName || p?.businessName || "");

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

  // Single-tenant fallback
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
    (w) => w?.start && w?.end && timeToMins(startTime) >= timeToMins(w.start) && timeToMins(endTime) <= timeToMins(w.end)
  );
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      const handle = req.query.handle;
      const meetingId = req.query.meetingId;
      const token = req.query.token;

      // Public join page lookup by meeting id + token
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
            const { data: profileRow } = await supabase
              .from("user_data")
              .select("value")
              .eq("user_id", row.user_id)
              .eq("key", "djProfile")
              .maybeSingle();
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
              },
              djProfile: profileRow?.value || {},
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
            "Pick a time that works for you. You’ll get a Google Meet link through CuePoint.",
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

      const id = Date.now();
      const joinToken = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
      const meetingTitle =
        title ||
        settings.title ||
        `Meeting with ${dj.djProfile?.djName || dj.djProfile?.businessName || "DJ"}`;

      // Build Google Calendar template URL (local wall time as floating date)
      const startStamp = `${date.replace(/-/g, "")}T${startTime.replace(":", "")}00`;
      const endStamp = `${date.replace(/-/g, "")}T${endTime.replace(":", "")}00`;
      const details = [
        `Scheduled via CuePoint Planning.`,
        notes ? `Notes: ${notes}` : "",
        `Client: ${clientName} (${clientEmail})`,
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
        createdAt: new Date().toISOString(),
        source: "schedule_link",
      };

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
          status: meeting.status,
        },
        djName: dj.djProfile?.businessName || dj.djProfile?.djName || "Your DJ",
      });
    }

    if (req.method === "PATCH") {
      // DJ or client can attach a Meet link using meeting id + joinToken
      const { meetingId, token, meetLink, status } = req.body || {};
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

        const updated = [...list];
        updated[idx] = {
          ...updated[idx],
          ...(typeof meetLink === "string" ? { meetLink: meetLink.trim() } : {}),
          ...(status ? { status } : {}),
          updatedAt: new Date().toISOString(),
        };

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

        return res.status(200).json({ ok: true, meeting: updated[idx] });
      }

      return res.status(404).json({ error: "Meeting not found" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("meetings API error:", e);
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
