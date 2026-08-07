import React, { useEffect, useMemo, useState } from "react";
import { BRAND_ACCENT, BRAND_FONT, BRAND_RADIUS, LIGHT_THEME } from "../brand";
import { formatDisplayTime, DEFAULT_TIME_FORMAT } from "../timeFormat";
import { supabase } from "../supabase";
import {
  getBrowserTimeZone,
  groupSlotsForClient,
  sameZone,
  wallTimeToUtc,
  formatInZone,
} from "../meetingTime";

const C = LIGHT_THEME;

const DEFAULT_WEEKLY_HOURS = {
  0: [],
  1: [{ start: "10:00", end: "12:00" }, { start: "14:00", end: "17:00" }],
  2: [{ start: "10:00", end: "12:00" }, { start: "14:00", end: "17:00" }],
  3: [{ start: "10:00", end: "12:00" }, { start: "14:00", end: "17:00" }],
  4: [{ start: "10:00", end: "12:00" }, { start: "14:00", end: "17:00" }],
  5: [{ start: "10:00", end: "12:00" }, { start: "14:00", end: "16:00" }],
  6: [],
};

export const DEFAULT_MEETING_SETTINGS = {
  enabled: true,
  title: "Book a Meeting",
  description: "Pick a time that works for you. You’ll get a confirmation email and join via Google Meet — scheduled through CuePoint.",
  durationMins: 30,
  bufferMins: 0,
  daysAhead: 30,
  weeklyHours: DEFAULT_WEEKLY_HOURS,
  // Calendly-style date overrides: { date, type: 'unavailable'|'custom', hours?: [{start,end}], note? }
  dateOverrides: [],
  timezone: typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : "America/New_York",
};

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "UTC",
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const btnBase = {
  fontFamily: BRAND_FONT,
  cursor: "pointer",
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 13,
  padding: "9px 16px",
  border: "none",
};

const Btn = ({ children, onClick, variant = "primary", size = "md", disabled, style }) => {
  const sizes = { sm: { padding: "6px 12px", fontSize: 12 }, md: {}, lg: { padding: "12px 20px", fontSize: 14 } };
  const variants = {
    primary: { background: C.accent, color: "#fff" },
    ghost: { background: C.surface, color: C.text, border: `1px solid ${C.border}` },
    danger: { background: C.surface, color: C.red, border: `1px solid ${C.red}40` },
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        ...btnBase,
        ...sizes[size],
        ...variants[variant],
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
};

const Card = ({ children, style }) => (
  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: BRAND_RADIUS.card, padding: 20, ...style }}>
    {children}
  </div>
);

const Toast = ({ message, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 2400);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 2000, background: C.text, color: "#fff", padding: "12px 18px", borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 28px rgba(0,0,0,0.2)" }}>
      {message}
    </div>
  );
};

const addMinutes = (timeHHMM, mins) => {
  const [h, m] = timeHHMM.split(":").map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
};

const timeToMins = (t) => {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h * 60 + m;
};

const dateStr = (d) => {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
};

const isBlockedDate = (blockedDates, ds) =>
  (blockedDates || []).some((b) => (typeof b === "string" ? b : b.date) === ds);

const getDateOverride = (settings, ds) =>
  (settings?.dateOverrides || []).find((o) => o && o.date === ds) || null;

/** Resolve bookable windows for a date (weekly hours + date overrides). */
const getWindowsForDate = (settings, ds) => {
  const override = getDateOverride(settings, ds);
  if (override) {
    if (override.type === "unavailable") return [];
    if (override.type === "custom") return Array.isArray(override.hours) ? override.hours : [];
  }
  const d = new Date(ds + "T12:00:00");
  const day = d.getDay();
  const weekly = settings.weeklyHours || DEFAULT_WEEKLY_HOURS;
  return weekly[day] || weekly[String(day)] || [];
};

const slotsForDate = (date, settings, busyMeetings = [], bookedEventDates = []) => {
  const ds = typeof date === "string" ? date : dateStr(date);
  if ((bookedEventDates || []).includes(ds)) return [];

  const windows = getWindowsForDate(settings, ds);
  const duration = Number(settings.durationMins) || 30;
  const buffer = Number(settings.bufferMins) || 0;
  if (!windows.length) return [];

  const slots = [];
  for (const win of windows) {
    if (!win?.start || !win?.end) continue;
    let cursor = win.start;
    while (timeToMins(cursor) + duration <= timeToMins(win.end)) {
      const end = addMinutes(cursor, duration);
      const overlaps = (busyMeetings || []).some(
        (m) => m.date === ds && m.status !== "cancelled" && m.startTime < end && m.endTime > cursor
      );
      if (!overlaps) slots.push({ startTime: cursor, endTime: end });
      cursor = addMinutes(end, buffer);
    }
  }
  return slots;
};

const formatOverrideLabel = (ds) => {
  try {
    return new Date(ds + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return ds;
  }
};

const googleCalendarUrlForMeeting = (meeting, djName) => {
  if (meeting.googleCalendarUrl) return meeting.googleCalendarUrl;
  const startStamp = `${meeting.date.replace(/-/g, "")}T${meeting.startTime.replace(":", "")}00`;
  const endStamp = `${meeting.date.replace(/-/g, "")}T${meeting.endTime.replace(":", "")}00`;
  const details = [
    `Scheduled via CuePoint Planning with ${djName}.`,
    meeting.notes ? `Notes: ${meeting.notes}` : "",
    "Open this event in Google Calendar and click Add Google Meet video conferencing.",
  ].filter(Boolean).join("\n");
  return (
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(meeting.title || "Meeting")}` +
    `&dates=${startStamp}/${endStamp}` +
    `&details=${encodeURIComponent(details)}` +
    (meeting.clientEmail ? `&add=${encodeURIComponent(meeting.clientEmail)}` : "")
  );
};

const scheduleHandleFromProfile = (profile) =>
  String(profile?.bookingHandle || profile?.subdomain || profile?.djName || profile?.businessName || "dj")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") || "dj";

/** DJ-facing Meeting Schedule section */
export function MeetingSchedule({
  meetings = [],
  setMeetings,
  meetingSettings,
  setMeetingSettings,
  profile,
  setProfile,
  timeFormat = DEFAULT_TIME_FORMAT,
}) {
  const settings = { ...DEFAULT_MEETING_SETTINGS, ...(meetingSettings || {}) };
  const [tab, setTab] = useState("Meetings");
  const [toast, setToast] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [meetLinkDraft, setMeetLinkDraft] = useState("");
  const [handleDraft, setHandleDraft] = useState(() => scheduleHandleFromProfile(profile));
  const [overrideForm, setOverrideForm] = useState({
    date: "",
    type: "unavailable",
    hours: [{ start: "10:00", end: "12:00" }],
    note: "",
  });
  const handle = scheduleHandleFromProfile(profile);
  const [googleStatus, setGoogleStatus] = useState({ configured: false, connected: false, email: "" });
  const [googleBusy, setGoogleBusy] = useState(false);

  const refreshGoogleStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch("/api/meetings?google=status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setGoogleStatus(await res.json());
    } catch {}
  };

  useEffect(() => { refreshGoogleStatus(); }, []);

  useEffect(() => {
    const q = new URLSearchParams((window.location.hash.split("?")[1] || ""));
    if (q.get("google") === "connected") {
      setToast("Google Calendar connected — new bookings get Meet links automatically");
      refreshGoogleStatus();
      window.history.replaceState({}, "", `${window.location.pathname}#meetings`);
    } else if (q.get("google") === "error") {
      setToast(q.get("msg") || "Google connect failed");
      window.history.replaceState({}, "", `${window.location.pathname}#meetings`);
    }
  }, []);

  const connectGoogle = async () => {
    setGoogleBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setToast("Sign in required to connect Google");
        return;
      }
      const res = await fetch("/api/meetings?google=connect&redirect=0", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error || "Could not start Google connect");
      window.location.href = json.url;
    } catch (e) {
      setToast(e.message || "Google connect failed");
    } finally {
      setGoogleBusy(false);
    }
  };

  const disconnectGoogle = async () => {
    setGoogleBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch("/api/meetings?google=1", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
      });
      setGoogleStatus((s) => ({ ...s, connected: false, email: "" }));
      setToast("Google Calendar disconnected");
    } catch {
      setToast("Could not disconnect Google");
    } finally {
      setGoogleBusy(false);
    }
  };

  const shareUrl = `${window.location.origin}${window.location.pathname}#/schedule/${handle}`;

  useEffect(() => {
    setHandleDraft(scheduleHandleFromProfile(profile));
  }, [profile?.bookingHandle, profile?.subdomain, profile?.djName, profile?.businessName]);

  const timezoneOptions = useMemo(() => {
    const current = settings.timezone || "America/New_York";
    return COMMON_TIMEZONES.includes(current) ? COMMON_TIMEZONES : [current, ...COMMON_TIMEZONES];
  }, [settings.timezone]);

  const dateOverrides = useMemo(() => {
    return [...(settings.dateOverrides || [])]
      .filter((o) => o?.date)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [settings.dateOverrides]);

  const upcomingOverrides = useMemo(() => {
    const today = dateStr(new Date());
    return dateOverrides.filter((o) => o.date >= today);
  }, [dateOverrides]);

  const upcoming = useMemo(() => {
    const today = dateStr(new Date());
    return [...(meetings || [])]
      .filter((m) => m.status !== "cancelled" && m.date >= today)
      .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  }, [meetings]);

  const past = useMemo(() => {
    const today = dateStr(new Date());
    return [...(meetings || [])]
      .filter((m) => m.date < today || m.status === "cancelled")
      .sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`));
  }, [meetings]);

  const setSetting = (key, value) => {
    setMeetingSettings((prev) => ({ ...DEFAULT_MEETING_SETTINGS, ...(prev || {}), [key]: value }));
  };

  const setDayHours = (dayIdx, ranges) => {
    const next = { ...(settings.weeklyHours || DEFAULT_WEEKLY_HOURS), [dayIdx]: ranges };
    setSetting("weeklyHours", next);
  };

  const saveDateOverride = () => {
    const ds = overrideForm.date;
    if (!ds) {
      setToast("Pick a date first");
      return;
    }
    if (overrideForm.type === "custom") {
      const hours = (overrideForm.hours || []).filter((h) => h.start && h.end && timeToMins(h.end) > timeToMins(h.start));
      if (!hours.length) {
        setToast("Add at least one valid time window");
        return;
      }
    }
    const entry = {
      date: ds,
      type: overrideForm.type === "custom" ? "custom" : "unavailable",
      hours: overrideForm.type === "custom"
        ? (overrideForm.hours || []).filter((h) => h.start && h.end)
        : [],
      note: (overrideForm.note || "").trim(),
    };
    const prev = settings.dateOverrides || [];
    const next = [...prev.filter((o) => o.date !== ds), entry].sort((a, b) => a.date.localeCompare(b.date));
    setSetting("dateOverrides", next);
    setOverrideForm({ date: "", type: "unavailable", hours: [{ start: "10:00", end: "12:00" }], note: "" });
    setToast(entry.type === "unavailable" ? "Day blocked off" : "Special hours saved");
  };

  const editDateOverride = (o) => {
    setOverrideForm({
      date: o.date,
      type: o.type === "custom" ? "custom" : "unavailable",
      hours: o.hours?.length ? o.hours.map((h) => ({ ...h })) : [{ start: "10:00", end: "12:00" }],
      note: o.note || "",
    });
    setTab("Date Overrides");
  };

  const removeDateOverride = (ds) => {
    setSetting("dateOverrides", (settings.dateOverrides || []).filter((o) => o.date !== ds));
    setToast("Override removed");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setToast("Scheduling link copied!");
    } catch {
      setToast(shareUrl);
    }
  };

  const cancelMeeting = async (m) => {
    setMeetings((prev) =>
      (prev || []).map((x) => (String(x.id) === String(m.id) ? { ...x, status: "cancelled" } : x))
    );
    if (m.joinToken) {
      try {
        await fetch("/api/meetings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meetingId: m.id, token: m.joinToken, status: "cancelled" }),
        });
      } catch {}
    }
    setToast("Meeting cancelled — client notified by email");
    setSelectedMeeting(null);
  };

  const saveBookingHandle = () => {
    const cleaned = String(handleDraft || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    if (!cleaned) {
      setToast("Handle must include letters or numbers");
      return;
    }
    if (typeof setProfile === "function") {
      setProfile((p) => ({ ...(p || {}), bookingHandle: cleaned }));
      setToast("Scheduling handle saved");
    } else {
      setToast("Could not save handle — open Account & Brand");
    }
  };

  const saveMeetLink = (m, link) => {
    const trimmed = (link || "").trim();
    setMeetings((prev) =>
      (prev || []).map((x) => (String(x.id) === String(m.id) ? { ...x, meetLink: trimmed } : x))
    );
    if (m.joinToken) {
      fetch("/api/meetings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: m.id, token: m.joinToken, meetLink: trimmed }),
      }).catch(() => {});
    }
    setToast(trimmed ? "Google Meet link saved" : "Meet link cleared");
    setSelectedMeeting((s) => (s && String(s.id) === String(m.id) ? { ...s, meetLink: trimmed } : s));
  };

  const openCreateMeet = (m) => {
    const url = googleCalendarUrlForMeeting(m, profile?.djName || profile?.businessName || "DJ");
    window.open(url, "_blank");
    setToast("Create the event in Google Calendar, then paste the Meet link here.");
  };

  const joinPageUrl = (m) =>
    `${window.location.origin}${window.location.pathname}#/m/${m.id}/${m.joinToken}`;

  const inputStyle = {
    width: "100%",
    background: C.surfaceAlt,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: "10px 12px",
    color: C.text,
    fontSize: 13,
    fontFamily: BRAND_FONT,
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 4 }}>Scheduling</h2>
          <p style={{ color: C.muted, fontSize: 13, maxWidth: 520 }}>
            Share your Calendly-style link. Clients book a slot, get a confirmation email + calendar invite, and you attach Google Meet when ready.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn variant="ghost" onClick={copyLink}>Copy Link</Btn>
          <Btn onClick={() => setTab("Share Link")}>Share Link</Btn>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          ["Upcoming", upcoming.length, C.accent],
          ["With Meet link", upcoming.filter((m) => m.meetLink).length, C.green],
          ["Duration", `${settings.durationMins} min`, C.purple],
          ["Status", settings.enabled !== false ? "Live" : "Paused", settings.enabled !== false ? C.green : C.orange],
        ].map(([label, val, color]) => (
          <Card key={label} style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color }}>{val}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {["Meetings", "Availability", "Date Overrides", "Share Link"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              padding: "7px 16px",
              borderRadius: 999,
              border: `1.5px solid ${tab === t ? C.accent : C.border}`,
              background: tab === t ? C.accent + "18" : C.surfaceAlt,
              color: tab === t ? C.accent : C.muted,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: BRAND_FONT,
            }}
          >
            {t}
            {t === "Date Overrides" && upcomingOverrides.length > 0 ? ` (${upcomingOverrides.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "Share Link" && (
        <Card>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Your scheduling link</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
            Send this like a Calendly link. Clients pick a time, both of you get confirmation emails (with a calendar invite), and the booking lands here so you can attach Google Meet.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
            <input readOnly value={shareUrl} style={{ ...inputStyle, flex: 1, minWidth: 220 }} />
            <Btn onClick={copyLink}>Copy</Btn>
            <Btn variant="ghost" onClick={() => window.open(shareUrl, "_blank")}>Preview</Btn>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Link handle</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: C.muted }}>#/schedule/</span>
              <input
                value={handleDraft}
                onChange={(e) => setHandleDraft(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
                style={{ ...inputStyle, maxWidth: 220 }}
                placeholder="yourname"
              />
              <Btn size="sm" variant="ghost" onClick={saveBookingHandle}>Save handle</Btn>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Letters and numbers only. Keep it short so clients can type it.</div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={settings.enabled !== false}
              onChange={(e) => setSetting("enabled", e.target.checked)}
              style={{ width: 16, height: 16, accentColor: C.accent }}
            />
            Scheduling link is active
          </label>
          <div style={{ marginTop: 18, padding: 14, borderRadius: 12, border: `1px solid ${C.border}`, background: C.surfaceAlt }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>Google Calendar + Meet</div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.55, marginBottom: 12 }}>
              Connect Google so new bookings automatically create a Calendar event and Google Meet link (no paste step).
            </div>
            {!googleStatus.configured ? (
              <div style={{ fontSize: 12, color: C.muted }}>
                Not configured on this server yet. Add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in Vercel. Redirect URI: <code>/api/meetings</code>.
              </div>
            ) : googleStatus.connected ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>Connected{googleStatus.email ? ` · ${googleStatus.email}` : ""}</span>
                <Btn size="sm" variant="ghost" disabled={googleBusy} onClick={disconnectGoogle}>Disconnect</Btn>
              </div>
            ) : (
              <Btn size="sm" disabled={googleBusy} onClick={connectGoogle}>{googleBusy ? "Opening Google…" : "Connect Google Calendar"}</Btn>
            )}
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: C.muted, lineHeight: 1.55 }}>
            Reminder emails go out daily for meetings in the next day or so. Clients can reschedule from their join page.
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Page title</div>
            <input value={settings.title || ""} onChange={(e) => setSetting("title", e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Description</div>
            <textarea
              value={settings.description || ""}
              onChange={(e) => setSetting("description", e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
        </Card>
      )}

      {tab === "Availability" && (
        <div style={{ display: "grid", gap: 16 }}>
          <Card>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Meeting length</div>
                <select value={settings.durationMins} onChange={(e) => setSetting("durationMins", Number(e.target.value))} style={inputStyle}>
                  {[15, 30, 45, 60].map((n) => <option key={n} value={n}>{n} minutes</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Buffer between</div>
                <select value={settings.bufferMins} onChange={(e) => setSetting("bufferMins", Number(e.target.value))} style={inputStyle}>
                  {[0, 5, 10, 15, 30].map((n) => <option key={n} value={n}>{n} minutes</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Book up to</div>
                <select value={settings.daysAhead} onChange={(e) => setSetting("daysAhead", Number(e.target.value))} style={inputStyle}>
                  {[14, 21, 30, 45, 60].map((n) => <option key={n} value={n}>{n} days ahead</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Timezone</div>
                <select value={settings.timezone || "America/New_York"} onChange={(e) => setSetting("timezone", e.target.value)} style={inputStyle}>
                  {timezoneOptions.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
                </select>
              </div>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 12, lineHeight: 1.5 }}>
              Slots are shown in this timezone on your public page. Confirmation emails include it so clients know when to show up.
            </div>
          </Card>

          <Card>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Weekly hours</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
              Default hours for each weekday. For one-off blocked days or special hours, use the <button type="button" onClick={() => setTab("Date Overrides")} style={{ background: "none", border: "none", color: C.accent, fontWeight: 700, cursor: "pointer", padding: 0, fontFamily: BRAND_FONT, fontSize: 12 }}>Date Overrides</button> tab.
            </div>
            {DAY_LABELS.map((label, dayIdx) => {
              const ranges = (settings.weeklyHours || DEFAULT_WEEKLY_HOURS)[dayIdx] || [];
              return (
                <div key={label} style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 12, alignItems: "start", padding: "12px 0", borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontWeight: 800, fontSize: 13, paddingTop: 8 }}>{label}</div>
                  <div>
                    {ranges.length === 0 ? (
                      <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Unavailable</div>
                    ) : (
                      ranges.map((r, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                          <input type="time" value={r.start} onChange={(e) => {
                            const next = ranges.map((x, xi) => (xi === i ? { ...x, start: e.target.value } : x));
                            setDayHours(dayIdx, next);
                          }} style={{ ...inputStyle, width: 130 }} />
                          <span style={{ color: C.muted }}>to</span>
                          <input type="time" value={r.end} onChange={(e) => {
                            const next = ranges.map((x, xi) => (xi === i ? { ...x, end: e.target.value } : x));
                            setDayHours(dayIdx, next);
                          }} style={{ ...inputStyle, width: 130 }} />
                          <Btn size="sm" variant="ghost" onClick={() => setDayHours(dayIdx, ranges.filter((_, xi) => xi !== i))}>Remove</Btn>
                        </div>
                      ))
                    )}
                    <Btn size="sm" variant="ghost" onClick={() => setDayHours(dayIdx, [...ranges, { start: "10:00", end: "12:00" }])}>+ Add window</Btn>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {tab === "Date Overrides" && (
        <div style={{ display: "grid", gap: 16 }}>
          <Card>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Date overrides</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.55 }}>
              Like Calendly — block a special day entirely, or set custom hours for one date (including days that are normally closed).
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Date</div>
                <input
                  type="date"
                  value={overrideForm.date}
                  min={dateStr(new Date())}
                  onChange={(e) => setOverrideForm((f) => ({ ...f, date: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Override type</div>
                <select
                  value={overrideForm.type}
                  onChange={(e) => setOverrideForm((f) => ({ ...f, type: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="unavailable">Block entire day</option>
                  <option value="custom">Custom hours</option>
                </select>
              </div>
            </div>

            {overrideForm.type === "custom" && (
              <div style={{ marginBottom: 12, padding: 12, background: C.surfaceAlt, borderRadius: 10, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10 }}>Hours for this date</div>
                {(overrideForm.hours || []).map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                    <input
                      type="time"
                      value={r.start}
                      onChange={(e) => setOverrideForm((f) => ({
                        ...f,
                        hours: f.hours.map((x, xi) => (xi === i ? { ...x, start: e.target.value } : x)),
                      }))}
                      style={{ ...inputStyle, width: 130 }}
                    />
                    <span style={{ color: C.muted }}>to</span>
                    <input
                      type="time"
                      value={r.end}
                      onChange={(e) => setOverrideForm((f) => ({
                        ...f,
                        hours: f.hours.map((x, xi) => (xi === i ? { ...x, end: e.target.value } : x)),
                      }))}
                      style={{ ...inputStyle, width: 130 }}
                    />
                    <Btn
                      size="sm"
                      variant="ghost"
                      onClick={() => setOverrideForm((f) => ({
                        ...f,
                        hours: f.hours.filter((_, xi) => xi !== i),
                      }))}
                    >
                      Remove
                    </Btn>
                  </div>
                ))}
                <Btn
                  size="sm"
                  variant="ghost"
                  onClick={() => setOverrideForm((f) => ({
                    ...f,
                    hours: [...(f.hours || []), { start: "14:00", end: "17:00" }],
                  }))}
                >
                  + Add window
                </Btn>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Note (optional)</div>
              <input
                value={overrideForm.note}
                onChange={(e) => setOverrideForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="e.g. Vacation, early day, wedding load-in"
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: upcomingOverrides.length ? 18 : 0 }}>
              <Btn onClick={saveDateOverride}>{overrideForm.date && (settings.dateOverrides || []).some((o) => o.date === overrideForm.date) ? "Update override" : "Add override"}</Btn>
              {overrideForm.date && (
                <Btn
                  variant="ghost"
                  onClick={() => setOverrideForm({ date: "", type: "unavailable", hours: [{ start: "10:00", end: "12:00" }], note: "" })}
                >
                  Clear form
                </Btn>
              )}
            </div>

            {upcomingOverrides.length > 0 && (
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  Upcoming overrides ({upcomingOverrides.length})
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {upcomingOverrides.map((o) => (
                    <div
                      key={o.date}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                        flexWrap: "wrap",
                        padding: "12px 14px",
                        borderRadius: 10,
                        border: `1px solid ${o.type === "unavailable" ? C.red + "35" : C.accent + "35"}`,
                        background: o.type === "unavailable" ? C.red + "08" : C.accent + "08",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 13, color: C.text }}>{formatOverrideLabel(o.date)}</div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                          {o.type === "unavailable"
                            ? "Blocked — no bookings"
                            : `Custom hours: ${(o.hours || []).map((h) => `${formatDisplayTime(h.start, timeFormat)}–${formatDisplayTime(h.end, timeFormat)}`).join(", ") || "—"}`}
                          {o.note ? ` · ${o.note}` : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Btn size="sm" variant="ghost" onClick={() => editDateOverride(o)}>Edit</Btn>
                        <Btn size="sm" variant="danger" onClick={() => removeDateOverride(o.date)}>Remove</Btn>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {upcomingOverrides.length === 0 && (
              <div style={{ marginTop: 8, padding: "14px 16px", borderRadius: 10, background: C.surfaceAlt, border: `1px solid ${C.border}`, fontSize: 13, color: C.muted }}>
                No special days yet. Pick a date above to block it or set custom hours.
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "Meetings" && (
        <div>
          {upcoming.length === 0 ? (
            <Card style={{ textAlign: "center", padding: 48 }}>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>No upcoming meetings</div>
              <div style={{ color: C.muted, fontSize: 13, marginBottom: 20, maxWidth: 380, margin: "0 auto 20px" }}>
                Copy your scheduling link and send it to a client. When they book, the meeting shows up here.
              </div>
              <Btn onClick={copyLink}>Copy Scheduling Link</Btn>
            </Card>
          ) : (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.surfaceAlt }}>
                    {["When", "Client", "Status", "Meet", "Actions"].map((h) => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: C.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((m) => (
                    <tr key={m.id} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 700 }}>{m.date}</div>
                        <div style={{ fontSize: 12, color: C.muted }}>
                          {formatDisplayTime(m.startTime, timeFormat)} – {formatDisplayTime(m.endTime, timeFormat)}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 700 }}>{m.clientName}</div>
                        <div style={{ fontSize: 12, color: C.muted }}>{m.clientEmail}</div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: m.status === "scheduled" ? C.green : C.muted, background: (m.status === "scheduled" ? C.green : C.muted) + "18", padding: "3px 10px", borderRadius: 999 }}>
                          {m.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {m.meetLink ? (
                          <a href={m.meetLink} target="_blank" rel="noreferrer" style={{ color: C.accent, fontWeight: 700, fontSize: 12 }}>Open Meet</a>
                        ) : (
                          <span style={{ color: C.border, fontSize: 12 }}>Not set</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <Btn size="sm" variant="ghost" onClick={() => { setSelectedMeeting(m); setMeetLinkDraft(m.meetLink || ""); }}>Manage</Btn>
                          <Btn size="sm" onClick={() => openCreateMeet(m)}>Google Meet</Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {past.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10, color: C.muted }}>Past / cancelled</div>
              <Card style={{ padding: 0 }}>
                {past.slice(0, 8).map((m, i) => (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 16px", borderTop: i ? `1px solid ${C.border}` : "none", fontSize: 13 }}>
                    <div>
                      <span style={{ fontWeight: 700 }}>{m.clientName}</span>
                      <span style={{ color: C.muted }}> · {m.date} · {formatDisplayTime(m.startTime, timeFormat)}</span>
                    </div>
                    <span style={{ color: C.muted, fontSize: 12 }}>{m.status}</span>
                  </div>
                ))}
              </Card>
            </div>
          )}
        </div>
      )}

      {selectedMeeting && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setSelectedMeeting(null)}>
          <div style={{ background: C.surface, borderRadius: 16, width: "100%", maxWidth: 480, border: `1px solid ${C.border}`, padding: 22 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{selectedMeeting.title || "Meeting"}</div>
              <button type="button" onClick={() => setSelectedMeeting(null)} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, width: 30, height: 30, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, marginBottom: 16 }}>
              <div><strong style={{ color: C.text }}>{selectedMeeting.clientName}</strong> · {selectedMeeting.clientEmail}</div>
              <div>{selectedMeeting.date} · {formatDisplayTime(selectedMeeting.startTime, timeFormat)} – {formatDisplayTime(selectedMeeting.endTime, timeFormat)}</div>
              {selectedMeeting.notes && <div style={{ marginTop: 8 }}>Notes: {selectedMeeting.notes}</div>}
            </div>

            <div style={{ background: C.accent + "0C", border: `1px solid ${C.accent}25`, borderRadius: 12, padding: 14, marginBottom: 14, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
              1. Click <strong style={{ color: C.text }}>Create Google Meet</strong> — opens Google Calendar with this meeting and your client invited.<br />
              2. In Google Calendar, add <strong style={{ color: C.text }}>Google Meet video conferencing</strong>, then copy the Meet link back here.
            </div>

            <Btn onClick={() => openCreateMeet(selectedMeeting)} style={{ width: "100%", marginBottom: 12 }}>Create Google Meet</Btn>

            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Google Meet link</div>
            <input value={meetLinkDraft} onChange={(e) => setMeetLinkDraft(e.target.value)} placeholder="https://meet.google.com/..." style={{ ...inputStyle, marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <Btn style={{ flex: 1 }} onClick={() => saveMeetLink(selectedMeeting, meetLinkDraft)}>Save Meet Link</Btn>
              {selectedMeeting.meetLink && (
                <Btn variant="ghost" onClick={() => window.open(selectedMeeting.meetLink, "_blank")}>Join</Btn>
              )}
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Client join page</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input readOnly value={joinPageUrl(selectedMeeting)} style={{ ...inputStyle, flex: 1, fontSize: 12 }} />
              <Btn variant="ghost" onClick={async () => {
                try {
                  await navigator.clipboard.writeText(joinPageUrl(selectedMeeting));
                  setToast("Join page link copied");
                } catch {}
              }}>Copy</Btn>
            </div>

            <Btn variant="danger" style={{ width: "100%" }} onClick={() => cancelMeeting(selectedMeeting)}>Cancel Meeting</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/** Public customer booking page: #/schedule/{handle} */
export function StandaloneMeetingSchedulePage({ handle }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [submitted, setSubmitted] = useState(null);
  const [saving, setSaving] = useState(false);
  const clientTz = useMemo(() => getBrowserTimeZone(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/meetings?handle=${encodeURIComponent(handle)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Unable to load scheduler");
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Unable to load scheduler");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [handle]);

  const brand = data?.djProfile?.brandColor || BRAND_ACCENT;
  const djName = data?.djProfile?.businessName || data?.djProfile?.djName || "Your DJ";
  const settings = { ...DEFAULT_MEETING_SETTINGS, ...(data?.settings || {}) };
  const djTz = settings.timezone || "America/New_York";

  const flatSlots = useMemo(() => {
    if (!data) return [];
    const out = [];
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    const days = Number(settings.daysAhead) || 30;
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const ds = dateStr(d);
      if (isBlockedDate(data.blockedDates, ds)) continue;
      const slots = slotsForDate(ds, settings, data.meetings, data.bookedEventDates);
      for (const s of slots) out.push({ date: ds, ...s });
    }
    return out;
  }, [data, settings]);

  const daysForClient = useMemo(
    () => groupSlotsForClient(flatSlots, djTz, clientTz),
    [flatSlots, djTz, clientTz]
  );

  const selectedDay = daysForClient.find((d) => d.dateKey === selectedDateKey) || null;

  const book = async () => {
    if (!form.name.trim() || !form.email.trim() || !selectedSlot) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle,
          clientName: form.name.trim(),
          clientEmail: form.email.trim(),
          clientPhone: form.phone.trim(),
          date: selectedSlot.date,
          startTime: selectedSlot.startTime,
          notes: form.notes.trim(),
          title: settings.title,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Booking failed");
      setSubmitted(json);
    } catch (e) {
      setError(e.message || "Booking failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F5F7", fontFamily: BRAND_FONT, color: "#71717A" }}>
        Loading schedule…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F5F7", fontFamily: BRAND_FONT, padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8, color: "#1A1A2E" }}>Scheduler unavailable</div>
          <div style={{ color: "#71717A", fontSize: 14 }}>{error}</div>
        </div>
      </div>
    );
  }

  const inputStyle = {
    width: "100%",
    background: "#F9F9FB",
    border: "1px solid #E4E4E8",
    borderRadius: 10,
    padding: "12px 14px",
    color: "#1A1A2E",
    fontSize: 14,
    fontFamily: BRAND_FONT,
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F5F5F7", fontFamily: BRAND_FONT }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E4E4E8", padding: "16px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        {data?.djProfile?.logoPhoto && (
          <img src={data.djProfile.logoPhoto} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
        )}
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#1A1A2E" }}>{djName}</div>
          <div style={{ fontSize: 12, color: "#71717A" }}>Schedule a meeting through CuePoint</div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 60px" }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#1A1A2E", letterSpacing: "-0.02em", marginBottom: 8 }}>{settings.title}</h1>
          <p style={{ fontSize: 14, color: "#71717A", lineHeight: 1.65, maxWidth: 520 }}>{settings.description}</p>
          <div style={{ fontSize: 12, color: "#A1A1AA", marginTop: 8 }}>
            Showing times in your timezone ({clientTz.replace(/_/g, " ")})
            {!sameZone(clientTz, djTz) ? ` · DJ timezone: ${djTz.replace(/_/g, " ")}` : ""}
          </div>
        </div>

        {error && data && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>{error}</div>
        )}

        {submitted ? (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E4E4E8", padding: 28, textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: brand + "18", border: `2px solid ${brand}`, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: brand }}>✓</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8, color: "#1A1A2E" }}>You're booked!</div>
            <div style={{ fontSize: 14, color: "#71717A", lineHeight: 1.7, marginBottom: 18 }}>
              {formatInZone(
                wallTimeToUtc(submitted.meeting.date, submitted.meeting.startTime, submitted.meeting.timezone || djTz),
                clientTz,
                { weekday: "short", month: "short", day: "numeric", timeZoneName: "short" }
              )}
              <br />with {submitted.djName}
            </div>
            <div style={{ background: "#F9F9FB", borderRadius: 12, padding: 16, textAlign: "left", fontSize: 13, color: "#71717A", lineHeight: 1.65, marginBottom: 16 }}>
              Check your email for confirmation + calendar invite.
              {submitted.meeting.meetLink
                ? " Your Google Meet link is ready."
                : ` ${submitted.djName} will attach the Meet link if it isn't automatic yet.`}
            </div>
            {submitted.meeting.meetLink && (
              <a href={submitted.meeting.meetLink} target="_blank" rel="noreferrer" style={{ display: "inline-block", background: brand, color: "#fff", textDecoration: "none", fontWeight: 700, borderRadius: 10, padding: "12px 20px", marginBottom: 12, marginRight: 8 }}>
                Join Google Meet
              </a>
            )}
            <a href={`#/m/${submitted.meeting.id}/${submitted.meeting.joinToken}`} style={{ display: "inline-block", background: submitted.meeting.meetLink ? "#fff" : brand, color: submitted.meeting.meetLink ? brand : "#fff", border: submitted.meeting.meetLink ? `1.5px solid ${brand}` : "none", textDecoration: "none", fontWeight: 700, borderRadius: 10, padding: "12px 20px", marginBottom: 12 }}>
              Open meeting page
            </a>
            <div>
              <a href={submitted.meeting.googleCalendarUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: brand, fontWeight: 700 }}>Add to Google Calendar</a>
            </div>
            <div style={{ marginTop: 20, fontSize: 11, color: "#A1A1AA" }}>Powered by CuePoint Planning</div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E4E4E8", padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, color: "#1A1A2E" }}>1. Pick a day</div>
              {daysForClient.length === 0 ? (
                <div style={{ fontSize: 13, color: "#71717A" }}>No open times in the next {settings.daysAhead} days.</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {daysForClient.map((day) => {
                    const active = selectedDateKey === day.dateKey;
                    return (
                      <button key={day.dateKey} type="button" onClick={() => { setSelectedDateKey(day.dateKey); setSelectedSlot(null); setError(""); }}
                        style={{ padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${active ? brand : "#E4E4E8"}`, background: active ? brand + "14" : "#F9F9FB", color: active ? brand : "#1A1A2E", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: BRAND_FONT }}>
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedDay && (
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E4E4E8", padding: 20 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, color: "#1A1A2E" }}>2. Pick a time ({settings.durationMins} min)</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {selectedDay.slots.map((slot) => {
                    const active = selectedSlot?.startTime === slot.startTime && selectedSlot?.date === slot.date;
                    return (
                      <button key={`${slot.date}-${slot.startTime}`} type="button" onClick={() => { setSelectedSlot(slot); setError(""); }}
                        style={{ padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${active ? brand : "#E4E4E8"}`, background: active ? brand + "14" : "#F9F9FB", color: active ? brand : "#1A1A2E", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: BRAND_FONT, textAlign: "left" }}>
                        <div>{slot.clientLabel}</div>
                        {!sameZone(clientTz, djTz) && (
                          <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.7, marginTop: 2 }}>{slot.djLabel} DJ time</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedSlot && (
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E4E4E8", padding: 20 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, color: "#1A1A2E" }}>3. Your details</div>
                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Name *</label>
                    <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="Your name" />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Email *</label>
                    <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} style={inputStyle} placeholder="you@email.com" />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Phone</label>
                    <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} style={inputStyle} placeholder="(555) 000-0000" />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Notes</label>
                    <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} style={{ ...inputStyle, resize: "vertical" }} placeholder="What should we cover?" />
                  </div>
                  <button type="button" disabled={saving || !form.name.trim() || !form.email.trim()} onClick={book}
                    style={{ background: saving || !form.name.trim() || !form.email.trim() ? "#E4E4E8" : brand, color: saving || !form.name.trim() || !form.email.trim() ? "#A1A1AA" : "#fff", border: "none", borderRadius: 10, padding: "13px 18px", fontWeight: 800, fontSize: 14, cursor: saving || !form.name.trim() || !form.email.trim() ? "not-allowed" : "pointer", fontFamily: BRAND_FONT }}>
                    {saving ? "Booking…" : "Confirm meeting"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <div style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: "#A1A1AA" }}>Powered by CuePoint Planning</div>
      </div>
    </div>
  );
}

/** Public join page: #/m/{id}/{token} */
export function StandaloneMeetingJoinPage({ meetingId, token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [schedData, setSchedData] = useState(null);
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [saving, setSaving] = useState(false);
  const clientTz = useMemo(() => getBrowserTimeZone(), []);

  const load = async () => {
    try {
      const res = await fetch(`/api/meetings?meetingId=${encodeURIComponent(meetingId)}&token=${encodeURIComponent(token)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Meeting not found");
      setPayload(json);
      setError("");
      setLoading(false);
    } catch (e) {
      setError(e.message || "Meeting not found");
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [meetingId, token]);

  const openReschedule = async () => {
    if (!payload?.scheduleHandle) {
      setError("Reschedule unavailable");
      return;
    }
    setRescheduleOpen(true);
    setError("");
    try {
      const res = await fetch(`/api/meetings?handle=${encodeURIComponent(payload.scheduleHandle)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load open times");
      setSchedData(json);
    } catch (e) {
      setError(e.message || "Could not load open times");
    }
  };

  const djTz = payload?.timezone || schedData?.settings?.timezone || "America/New_York";
  const settings = { ...DEFAULT_MEETING_SETTINGS, ...(schedData?.settings || {}) };

  const flatSlots = useMemo(() => {
    if (!schedData) return [];
    const out = [];
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    const days = Number(settings.daysAhead) || 30;
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const ds = dateStr(d);
      if (isBlockedDate(schedData.blockedDates, ds)) continue;
      const slots = slotsForDate(ds, settings, schedData.meetings, schedData.bookedEventDates);
      for (const s of slots) out.push({ date: ds, ...s });
    }
    return out;
  }, [schedData, settings]);

  const daysForClient = useMemo(
    () => groupSlotsForClient(flatSlots, djTz, clientTz),
    [flatSlots, djTz, clientTz]
  );
  const selectedDay = daysForClient.find((d) => d.dateKey === selectedDateKey) || null;

  const confirmReschedule = async () => {
    if (!selectedSlot) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/meetings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId,
          token,
          action: "reschedule",
          date: selectedSlot.date,
          startTime: selectedSlot.startTime,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Reschedule failed");
      setPayload((p) => ({ ...p, meeting: { ...p.meeting, ...json.meeting } }));
      setRescheduleOpen(false);
      setSelectedSlot(null);
      setSelectedDateKey("");
    } catch (e) {
      setError(e.message || "Reschedule failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F5F7", fontFamily: BRAND_FONT, color: "#71717A" }}>
        Loading meeting…
      </div>
    );
  }

  if ((error && !payload) || !payload) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F5F7", fontFamily: BRAND_FONT, padding: 24 }}>
        <div style={{ textAlign: "center", color: "#71717A" }}>{error || "Meeting not found"}</div>
      </div>
    );
  }

  const m = payload.meeting;
  const brand = payload.djProfile?.brandColor || BRAND_ACCENT;
  const djName = payload.djProfile?.businessName || payload.djProfile?.djName || "Your DJ";
  const whenLabel = formatInZone(
    wallTimeToUtc(m.date, m.startTime, m.timezone || djTz),
    clientTz,
    { weekday: "short", month: "short", day: "numeric", timeZoneName: "short" }
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F5F5F7", fontFamily: BRAND_FONT, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 520, background: "#fff", borderRadius: 18, border: "1px solid #E4E4E8", padding: 28, textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: brand, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>CuePoint Meeting</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#1A1A2E", marginBottom: 8 }}>{m.title || "Meeting"}</div>
        <div style={{ fontSize: 14, color: "#71717A", lineHeight: 1.7, marginBottom: 20 }}>
          with {djName}<br />
          {whenLabel}
          {m.status === "cancelled" && <div style={{ color: "#DC2626", fontWeight: 700, marginTop: 8 }}>Cancelled</div>}
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13 }}>{error}</div>
        )}

        {m.status !== "cancelled" && m.meetLink ? (
          <a href={m.meetLink} target="_blank" rel="noreferrer" style={{ display: "block", background: brand, color: "#fff", textDecoration: "none", fontWeight: 800, borderRadius: 12, padding: "14px 18px", marginBottom: 12 }}>
            Join Google Meet
          </a>
        ) : m.status !== "cancelled" ? (
          <div style={{ background: "#F9F9FB", borderRadius: 12, padding: 16, fontSize: 13, color: "#71717A", lineHeight: 1.65, marginBottom: 12 }}>
            Google Meet link isn’t attached yet. This page updates automatically once it’s ready.
          </div>
        ) : null}

        {m.googleCalendarUrl && m.status !== "cancelled" && (
          <a href={m.googleCalendarUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: brand, fontWeight: 700, display: "inline-block", marginBottom: 14 }}>
            Add to Google Calendar
          </a>
        )}

        {m.status !== "cancelled" && !rescheduleOpen && (
          <div>
            <button type="button" onClick={openReschedule}
              style={{ marginTop: 8, background: "#fff", border: `1.5px solid ${brand}`, color: brand, borderRadius: 10, padding: "10px 16px", fontWeight: 700, cursor: "pointer", fontFamily: BRAND_FONT, fontSize: 13 }}>
              Reschedule
            </button>
          </div>
        )}

        {rescheduleOpen && (
          <div style={{ marginTop: 18, textAlign: "left", borderTop: "1px solid #E4E4E8", paddingTop: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10, color: "#1A1A2E" }}>Pick a new time</div>
            <div style={{ fontSize: 12, color: "#A1A1AA", marginBottom: 10 }}>Times shown in {clientTz.replace(/_/g, " ")}</div>
            {!schedData ? (
              <div style={{ fontSize: 13, color: "#71717A" }}>Loading open times…</div>
            ) : (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {daysForClient.map((day) => (
                    <button key={day.dateKey} type="button" onClick={() => { setSelectedDateKey(day.dateKey); setSelectedSlot(null); }}
                      style={{ padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${selectedDateKey === day.dateKey ? brand : "#E4E4E8"}`, background: selectedDateKey === day.dateKey ? brand + "14" : "#F9F9FB", color: selectedDateKey === day.dateKey ? brand : "#1A1A2E", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: BRAND_FONT }}>
                      {day.label}
                    </button>
                  ))}
                </div>
                {selectedDay && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {selectedDay.slots.map((slot) => (
                      <button key={`${slot.date}-${slot.startTime}`} type="button" onClick={() => setSelectedSlot(slot)}
                        style={{ padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${selectedSlot?.startTime === slot.startTime && selectedSlot?.date === slot.date ? brand : "#E4E4E8"}`, background: selectedSlot?.startTime === slot.startTime && selectedSlot?.date === slot.date ? brand + "14" : "#F9F9FB", color: selectedSlot?.startTime === slot.startTime && selectedSlot?.date === slot.date ? brand : "#1A1A2E", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: BRAND_FONT }}>
                        {slot.clientLabel}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" disabled={!selectedSlot || saving} onClick={confirmReschedule}
                    style={{ flex: 1, background: !selectedSlot || saving ? "#E4E4E8" : brand, color: !selectedSlot || saving ? "#A1A1AA" : "#fff", border: "none", borderRadius: 10, padding: "11px 14px", fontWeight: 800, cursor: !selectedSlot || saving ? "not-allowed" : "pointer", fontFamily: BRAND_FONT }}>
                    {saving ? "Saving…" : "Confirm new time"}
                  </button>
                  <button type="button" onClick={() => setRescheduleOpen(false)}
                    style={{ background: "#fff", border: "1px solid #E4E4E8", borderRadius: 10, padding: "11px 14px", fontWeight: 700, cursor: "pointer", fontFamily: BRAND_FONT }}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ marginTop: 22, fontSize: 11, color: "#A1A1AA" }}>Powered by CuePoint Planning</div>
      </div>
    </div>
  );
}


export default MeetingSchedule;
