/**
 * Phone Scheduling hub + drill-ins matching iOS mocks:
 * Hub · Meetings · Meeting detail · Availability · Date overrides · Meeting types
 */
import { useEffect, useMemo, useState } from "react";
import { BRAND_ACCENT, BRAND_FONT } from "../brand";
import { formatDisplayTime, DEFAULT_TIME_FORMAT } from "../timeFormat";
import { supabase } from "../supabase";
import {
  DEFAULT_MEETING_SETTINGS,
  normalizeMeetingTypes,
  blankMeetingType,
  blankFormField,
  MEETING_QUESTION_PRESETS,
  isPresetQuestion,
  setPresetQuestion,
  FORM_FIELD_TYPES,
  weeklyHoursForType,
  cloneWeeklyHours,
  describeWeeklyHours,
  MEETING_LOCATIONS,
  meetingLocation,
  meetingLocationLabel,
} from "../meetingTypes";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEFAULT_WEEKLY = DEFAULT_MEETING_SETTINGS.weeklyHours;

const HERO = "linear-gradient(165deg, #4F46E5 0%, #6366F1 42%, #818CF8 100%)";

const scheduleHandle = (profile) =>
  String(profile?.bookingHandle || profile?.subdomain || profile?.djName || profile?.businessName || "dj")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") || "dj";

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const parseISO = (iso) => {
  try {
    return new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  } catch {
    return null;
  }
};

const fmtShortDate = (iso) => {
  const d = parseISO(iso);
  if (!d || Number.isNaN(d.getTime())) return iso || "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
};

const fmtDayHeader = (iso) => {
  const d = parseISO(iso);
  if (!d || Number.isNaN(d.getTime())) return iso || "";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
};

const fmtDowDay = (iso) => {
  const d = parseISO(iso);
  if (!d || Number.isNaN(d.getTime())) return { dow: "—", day: "—" };
  return {
    dow: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
    day: String(d.getDate()),
  };
};

const fmtClock = (hhmm) => {
  if (!hhmm || typeof hhmm !== "string" || !hhmm.includes(":")) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

const locationLabel = (m, type) => {
  if (m?.meetLink) {
    if (/zoom/i.test(m.meetLink)) return "Zoom";
    if (/meet\.google/i.test(m.meetLink)) return "Google Meet";
    return "Video call";
  }
  const loc = String(m?.location || type?.location || "").toLowerCase();
  if (loc === "zoom" || loc.includes("zoom")) return "Zoom";
  if (loc === "google_meet" || loc.includes("google") || loc === "meet") return "Google Meet";
  if (loc === "phone" || loc.includes("phone")) return "Phone call";
  if (loc.includes("person") || loc === "in_person") return "In person";
  if (type?.title && /walkthrough|venue|in.?person/i.test(type.title)) return "In person";
  if (type?.title && /consult|phone/i.test(type.title)) return "Phone call";
  return "Phone call";
};

const locationMeta = (label) => {
  const l = (label || "").toLowerCase();
  if (l.includes("google") || l.includes("video") || l.includes("zoom") || l.includes("meet")) {
    return { tint: "#DCFCE7", ink: "#16A34A", kind: "video" };
  }
  if (l.includes("person") || l.includes("venue")) {
    return { tint: "#FFEDD5", ink: "#C2410C", kind: "place" };
  }
  return { tint: "#DBEAFE", ink: "#2563EB", kind: "phone" };
};

const LocIcon = ({ kind, color }) => {
  if (kind === "video") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="7" width="12" height="10" rx="2" stroke={color} strokeWidth="1.8" />
        <path d="M15 10l5-2.5v9L15 14" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "place") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 21s7-5.2 7-11a7 7 0 10-14 0c0 5.8 7 11 7 11z" stroke={color} strokeWidth="1.8" />
        <circle cx="12" cy="10" r="2.2" stroke={color} strokeWidth="1.8" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7.5 4.5c.6-.6 1.6-.5 2.1.2l1.4 2c.4.6.3 1.4-.2 1.9l-1 1a12 12 0 005.6 5.6l1-1c.5-.5 1.3-.6 1.9-.2l2 1.4c.7.5.8 1.5.2 2.1l-1.2 1.2c-.6.6-1.5.9-2.4.6A16.5 16.5 0 015.7 8.1c-.3-.9 0-1.8.6-2.4l1.2-1.2z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
};

const sectionLabel = {
  fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "#8E8E93",
  marginBottom: 8, padding: "0 2px",
};

const card = {
  background: "#fff",
  border: "1px solid #E8E8EE",
  borderRadius: 18,
  boxShadow: "0 2px 10px rgba(22,22,26,0.04)",
};

const Toggle = ({ on, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={() => onChange?.(!on)}
    style={{
      width: 48, height: 28, borderRadius: 999, border: "none", cursor: "pointer",
      background: on ? BRAND_ACCENT : "#D1D5DB", position: "relative", flexShrink: 0,
      transition: "background 0.15s", padding: 0,
    }}
  >
    <span style={{
      position: "absolute", top: 3, left: on ? 23 : 3, width: 22, height: 22,
      borderRadius: "50%", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
      transition: "left 0.15s",
    }}
    />
  </button>
);

const HeroShell = ({ backLabel, onBack, title, subtitle, stats, children }) => (
  <div style={{ margin: "0 -16px 0", fontFamily: BRAND_FONT }}>
    <div style={{
      background: HERO, color: "#fff",
      padding: "10px 16px 20px",
      borderRadius: "0 0 28px 28px",
    }}
    >
      <button
        type="button"
        onClick={onBack}
        style={{
          background: "none", border: "none", color: "rgba(255,255,255,0.92)",
          fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: BRAND_FONT,
          padding: "4px 0 12px",
        }}
      >
        ‹ {backLabel}
      </button>
      <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.1 }}>{title}</div>
      {subtitle ? (
        <div style={{ fontSize: 14, opacity: 0.9, marginTop: 6, lineHeight: 1.45, maxWidth: 340 }}>{subtitle}</div>
      ) : null}
      {stats?.length ? (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(stats.length, 3)}, 1fr)`, gap: 8, marginTop: 16 }}>
          {stats.map((s) => (
            <div
              key={s.label}
              style={{
                background: s.strong ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.12)",
                borderRadius: 14, padding: "10px 8px", textAlign: "center",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.02em" }}>{s.value}</div>
              <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.85, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      ) : null}
      {children}
    </div>
  </div>
);

function groupByDate(list) {
  const map = new Map();
  (list || []).forEach((m) => {
    const key = m.date || "TBD";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(m);
  });
  return [...map.entries()];
}

export default function PhoneScheduling({
  C,
  profile,
  setProfile,
  meetings = [],
  setMeetings,
  meetingSettings,
  setMeetingSettings,
  events = [],
  blockedDates = [],
  timeFormat = DEFAULT_TIME_FORMAT,
  onBackToMore,
  onOpenEventDetail,
  onOpenClient,
}) {
  const [view, setView] = useState("hub");
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [meetingsFilter, setMeetingsFilter] = useState("upcoming");
  const [toast, setToast] = useState(null);
  const [googleStatus, setGoogleStatus] = useState({ configured: false, connected: false, email: "" });
  const [zoomStatus, setZoomStatus] = useState({ configured: false, connected: false, email: "", personalLink: "" });
  const [googleBusy, setGoogleBusy] = useState(false);
  const [overrideDraft, setOverrideDraft] = useState({ date: "", type: "unavailable", start: "10:00", end: "16:00", note: "" });
  const [showAddOverride, setShowAddOverride] = useState(false);
  const [hoursTypeId, setHoursTypeId] = useState(null);
  const [typeEditorId, setTypeEditorId] = useState(null);

  const settings = useMemo(
    () => ({ ...DEFAULT_MEETING_SETTINGS, ...(meetingSettings || {}) }),
    [meetingSettings]
  );
  const meetingTypes = useMemo(() => normalizeMeetingTypes(settings), [settings]);
  const hoursType = meetingTypes.find((t) => String(t.id) === String(hoursTypeId)) || meetingTypes[0] || null;
  const handle = scheduleHandle(profile);
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}${window.location.pathname}#/schedule/${handle}`
    : `https://cuepointplanning.com/app#/schedule/${handle}`;
  const typeShareUrl = (slug) => `${shareUrl}/${slug || "meet"}`;

  const setSetting = (key, value) => {
    setMeetingSettings?.((prev) => ({ ...DEFAULT_MEETING_SETTINGS, ...(prev || {}), [key]: value }));
  };

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch("/api/meetings?google=status", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) setGoogleStatus(await res.json());
        const zoomRes = await fetch("/api/meetings?zoom=status", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (zoomRes.ok) setZoomStatus(await zoomRes.json());
      } catch { /* ignore */ }
    })();
  }, []);

  const today = todayISO();
  const upcoming = useMemo(() => [...(meetings || [])]
    .filter((m) => m && m.status !== "cancelled" && m.date >= today)
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)), [meetings, today]);

  const past = useMemo(() => [...(meetings || [])]
    .filter((m) => m && (m.date < today || m.status === "cancelled" || m.status === "completed"))
    .sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`)), [meetings, today]);

  const completedCount = (meetings || []).filter((m) => m.status === "completed" || (m.date < today && m.status !== "cancelled")).length;
  const cancelledCount = (meetings || []).filter((m) => m.status === "cancelled").length;

  const thisWeekCount = useMemo(() => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + (7 - end.getDay()));
    const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
    return upcoming.filter((m) => m.date <= endIso).length;
  }, [upcoming]);

  const openDays = useMemo(() => {
    const wh = settings.weeklyHours || DEFAULT_WEEKLY;
    return DAY_LABELS.reduce((n, _, i) => n + ((wh[i] || wh[String(i)] || []).length > 0 ? 1 : 0), 0);
  }, [settings.weeklyHours]);

  const schedulesDiffer = useMemo(() => {
    const sigs = meetingTypes.map((t) => JSON.stringify(weeklyHoursForType(settings, t)));
    return sigs.length > 1 && sigs.some((s) => s !== sigs[0]);
  }, [meetingTypes, settings]);

  const activeTypes = meetingTypes.filter((t) => t.enabled);
  const typeById = useMemo(() => {
    const map = {};
    meetingTypes.forEach((t) => { map[t.id] = t; map[t.slug] = t; });
    return map;
  }, [meetingTypes]);

  const typeForMeeting = (m) =>
    typeById[m.meetingTypeId] || typeById[m.typeId] || meetingTypes.find((t) => t.title === m.meetingTypeTitle) || null;

  const bookedByType = useMemo(() => {
    const map = {};
    (meetings || []).forEach((m) => {
      const key = m.meetingTypeId || m.meetingTypeTitle || "unknown";
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [meetings]);

  const dateOverrides = useMemo(() => [...(settings.dateOverrides || [])]
    .filter((o) => o?.date)
    .sort((a, b) => a.date.localeCompare(b.date)), [settings.dateOverrides]);

  const autoBlock = settings.autoBlockEventDays !== false;
  const eventBlocks = useMemo(() => {
    if (!autoBlock) return [];
    return (events || [])
      .filter((e) => e?.date && e.date >= today && e.status !== "Cancelled")
      .map((e) => ({
        date: e.date,
        type: "from_event",
        note: e.name || e.client || "Event",
        eventId: e.id,
      }));
  }, [events, autoBlock, today]);

  const upcomingOverrideRows = useMemo(() => {
    const rows = [
      ...dateOverrides.filter((o) => o.date >= today).map((o) => ({ ...o, kind: o.type })),
      ...eventBlocks.filter((e) => !dateOverrides.some((o) => o.date === e.date)),
    ].sort((a, b) => a.date.localeCompare(b.date));
    return rows;
  }, [dateOverrides, eventBlocks, today]);

  const nextUp = upcoming[0] || null;

  const copyTypeLink = async (t) => {
    const url = typeShareUrl(t.slug);
    try {
      await navigator.clipboard?.writeText(url);
      flash("Link copied");
    } catch {
      flash("Could not copy");
    }
  };

  const createGoogleMeet = async (m) => {
    if (!m?.joinToken) {
      flash("This meeting can’t get a Meet link yet");
      return;
    }
    if (!googleStatus.connected) {
      connectGoogle();
      return;
    }
    setGoogleBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/meetings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          meetingId: m.id,
          token: m.joinToken,
          action: "createMeet",
          location: m.location || meetingLocation(typeForMeeting(m)),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || (!json.meetLink && !json.meeting?.googleEventId)) {
        throw new Error(json.error || "Could not add this meeting to your calendar");
      }
      const patch = {
        meetLink: json.meetLink,
        googleEventId: json.meeting?.googleEventId,
        googleCalendarUrl: json.meeting?.googleCalendarUrl,
      };
      setMeetings?.((prev) => (prev || []).map((x) => (String(x.id) === String(m.id) ? { ...x, ...patch } : x)));
      setSelectedMeeting((s) => (s && String(s.id) === String(m.id) ? { ...s, ...patch } : s));
      flash(json.meetLink ? "On your Google Calendar, with a Meet link" : "Added to your Google Calendar");
    } catch (e) {
      flash(e.message || "Google Meet could not be created");
    } finally {
      setGoogleBusy(false);
    }
  };

  const connectZoom = async () => {
    setGoogleBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        flash("Sign in required");
        return;
      }
      const res = await fetch("/api/meetings?zoom=connect&redirect=0", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error || "Connect failed");
      window.location.href = json.url;
    } catch (e) {
      flash(e.message || "Zoom connect failed");
    } finally {
      setGoogleBusy(false);
    }
  };

  const connectGoogle = async () => {
    setGoogleBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        flash("Sign in required");
        return;
      }
      const res = await fetch("/api/meetings?google=connect&redirect=0", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error || "Connect failed");
      window.location.href = json.url;
    } catch (e) {
      flash(e.message || "Google connect failed");
    } finally {
      setGoogleBusy(false);
    }
  };

  const writeTypeHours = (dayIdx, ranges) => {
    if (!hoursType) return;
    const wh = cloneWeeklyHours(weeklyHoursForType(settings, hoursType));
    wh[dayIdx] = ranges;
    updateTypes(meetingTypes.map((t) => (
      String(t.id) === String(hoursType.id) ? { ...t, weeklyHours: wh } : t
    )));
  };

  const setDayEnabled = (dayIdx, enabled) => {
    const current = weeklyHoursForType(settings, hoursType)[dayIdx] || [];
    writeTypeHours(
      dayIdx,
      enabled ? (current.length ? current : [{ start: "10:00", end: "18:00" }]) : []
    );
  };

  const cycleDayHours = (dayIdx) => {
    const presets = [
      [{ start: "10:00", end: "18:00" }],
      [{ start: "10:00", end: "14:00" }],
      [{ start: "10:00", end: "12:00" }, { start: "14:00", end: "17:00" }],
      [],
    ];
    const cur = JSON.stringify(weeklyHoursForType(settings, hoursType)[dayIdx] || []);
    const idx = presets.findIndex((p) => JSON.stringify(p) === cur);
    writeTypeHours(dayIdx, presets[(idx + 1) % presets.length]);
  };

  const saveOverride = () => {
    if (!overrideDraft.date) {
      flash("Pick a date");
      return;
    }
    const entry = overrideDraft.type === "custom"
      ? {
          date: overrideDraft.date,
          type: "custom",
          hours: [{ start: overrideDraft.start, end: overrideDraft.end }],
          note: overrideDraft.note || "Custom hours",
        }
      : {
          date: overrideDraft.date,
          type: "unavailable",
          note: overrideDraft.note || "Blocked",
        };
    const next = [...(settings.dateOverrides || []).filter((o) => o.date !== entry.date), entry]
      .sort((a, b) => a.date.localeCompare(b.date));
    setSetting("dateOverrides", next);
    setShowAddOverride(false);
    setOverrideDraft({ date: "", type: "unavailable", start: "10:00", end: "16:00", note: "" });
    flash("Override saved");
  };

  const removeOverride = (date) => {
    setSetting("dateOverrides", (settings.dateOverrides || []).filter((o) => o.date !== date));
  };

  const updateTypes = (nextTypes) => {
    setMeetingSettings?.((prev) => ({
      ...DEFAULT_MEETING_SETTINGS,
      ...(prev || {}),
      meetingTypes: normalizeMeetingTypes({ ...(prev || {}), meetingTypes: nextTypes }),
    }));
  };

  const toggleType = (id, enabled) => {
    updateTypes(meetingTypes.map((t) => (String(t.id) === String(id) ? { ...t, enabled } : t)));
  };

  const addType = () => {
    const t = blankMeetingType(settings);
    updateTypes([...meetingTypes, t]);
    setTypeEditorId(t.id);
    setView("type");
  };

  const patchType = (id, patch) => {
    updateTypes(meetingTypes.map((t) => (String(t.id) === String(id) ? { ...t, ...patch } : t)));
  };

  const openMeeting = (m) => {
    setSelectedMeeting(m);
    setView("meeting");
  };

  const backFromMeeting = () => {
    setSelectedMeeting(null);
    setView("meetings");
  };

  const markCompleted = (m) => {
    setMeetings?.((prev) => (prev || []).map((x) => (String(x.id) === String(m.id) ? { ...x, status: "completed" } : x)));
    setSelectedMeeting((s) => (s && String(s.id) === String(m.id) ? { ...s, status: "completed" } : s));
    flash("Marked completed");
  };

  /* ─── HUB ─── */
  if (view === "hub") {
    const nextType = nextUp ? typeForMeeting(nextUp) : null;
    const nextLoc = nextUp ? locationLabel(nextUp, nextType) : "";
    const nextMeta = locationMeta(nextLoc);
    const nextDay = nextUp ? fmtDowDay(nextUp.date) : null;

    return (
      <div style={{ padding: "0 16px 110px", fontFamily: BRAND_FONT, width: "100%", boxSizing: "border-box" }}>
        {toast && (
          <div style={{
            position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)", zIndex: 200,
            background: "#16161A", color: "#fff", padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700,
          }}
          >
            {toast}
          </div>
        )}
        <HeroShell
          backLabel="More"
          onBack={onBackToMore}
          title="Scheduling"
          subtitle="Each meeting type has its own link. Clients pick a time and the invite sends itself."
          stats={[
            { value: upcoming.length, label: "Upcoming", strong: true },
            { value: thisWeekCount, label: "This week" },
            { value: activeTypes.length, label: "Meeting types" },
          ]}
        />

        <div style={{ marginTop: 20 }}>
          <div style={sectionLabel}>NEXT UP</div>
          {nextUp ? (
            <button
              type="button"
              onClick={() => openMeeting(nextUp)}
              style={{
                ...card, width: "100%", padding: "14px 14px", display: "flex", gap: 12, alignItems: "center",
                textAlign: "left", cursor: "pointer", fontFamily: BRAND_FONT,
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: "50%", background: "#EEF2FF", color: BRAND_ACCENT,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
              >
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.04em" }}>{nextDay.dow}</span>
                <span style={{ fontSize: 16, fontWeight: 900, lineHeight: 1 }}>{nextDay.day}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 15, color: C.text }}>{nextUp.meetingTypeTitle || "Meeting"}</div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
                  {nextUp.clientName || "Client"} · {formatDisplayTime(nextUp.startTime, timeFormat)}
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, color: nextMeta.ink, fontSize: 12, fontWeight: 700 }}>
                  <LocIcon kind={nextMeta.kind} color={nextMeta.ink} />
                  {nextLoc}
                </div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 800, color: C.muted, background: "#F3F4F6",
                padding: "5px 8px", borderRadius: 8, flexShrink: 0,
              }}
              >
                {fmtShortDate(nextUp.date)}
              </span>
            </button>
          ) : (
            <div style={{ ...card, padding: "16px 14px", color: C.muted, fontSize: 13 }}>No upcoming meetings yet.</div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18 }}>
          {[
            {
              id: "meetings", title: "Meetings", badge: `${upcoming.length} UPCOMING`,
              desc: "Calls clients booked through your link", tint: "#DBEAFE", ink: "#2563EB",
              icon: "📅",
            },
            {
              id: "availability", title: "Availability", badge: schedulesDiffer ? "PER TYPE" : `${openDays} DAYS / WK`,
              desc: "Each meeting type has its own days and times", tint: "#DCFCE7", ink: "#16A34A",
              icon: "⏱",
            },
            {
              id: "overrides", title: "Date overrides", badge: `${upcomingOverrideRows.length} DATES`,
              desc: "Blocked days and one-off hours", tint: "#FCE7F3", ink: "#DB2777",
              icon: "🚫",
            },
            {
              id: "types", title: "Meeting types", badge: `${activeTypes.length} ACTIVE`,
              desc: "Consults, planning calls and walkthroughs", tint: "#EDE9FE", ink: "#7C3AED",
              icon: "☰",
            },
          ].map((tile) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => setView(tile.id)}
              style={{
                ...card, padding: "14px 12px", textAlign: "left", cursor: "pointer",
                fontFamily: BRAND_FONT, display: "flex", flexDirection: "column", gap: 8, minHeight: 138,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                <span style={{
                  width: 34, height: 34, borderRadius: 10, background: tile.tint, color: tile.ink,
                  display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15,
                }}
                >
                  {tile.icon}
                </span>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.04em", color: tile.ink, background: tile.tint, padding: "4px 6px", borderRadius: 8 }}>
                  {tile.badge}
                </span>
              </div>
              <div style={{ fontWeight: 900, fontSize: 15, color: C.text }}>{tile.title}</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.4, flex: 1 }}>{tile.desc}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: BRAND_ACCENT }}>Open →</div>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 22 }}>
          <div style={sectionLabel}>CALENDAR SYNC</div>
          <div style={card}>
            {[
              {
                id: "google",
                name: "Google Calendar",
                connected: !!googleStatus.connected,
                sub: googleStatus.connected
                  ? `Meet links are created automatically${googleStatus.email ? ` · ${googleStatus.email}` : ""}`
                  : "Connect once so bookings get a Meet link",
                action: googleStatus.connected ? null : connectGoogle,
                actionLabel: googleBusy ? "…" : "Connect",
              },
              {
                id: "zoom",
                name: "Zoom",
                connected: !!zoomStatus.connected || !!(settings.zoomPersonalLink || zoomStatus.personalLink),
                sub: zoomStatus.connected
                  ? `Zoom meetings are created automatically${zoomStatus.email ? ` · ${zoomStatus.email}` : ""}`
                  : "Connect Zoom, or save a personal meeting link",
                action: zoomStatus.connected ? null : connectZoom,
                actionLabel: googleBusy ? "…" : "Connect",
              },
              { id: "icloud", name: "iCloud Calendar", connected: false, sub: "Not connected", soon: true },
              { id: "outlook", name: "Outlook", connected: false, sub: "Not connected", soon: true },
            ].map((row, i, arr) => (
              <div
                key={row.id}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "14px 14px",
                  borderBottom: i < arr.length - 1 ? "1px solid #E8E8EE" : "none",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{row.name}</div>
                  <div style={{ fontSize: 12, color: row.connected ? "#16A34A" : C.muted, marginTop: 2 }}>{row.sub}</div>
                </div>
                {row.connected ? (
                  <span style={{ fontSize: 12, fontWeight: 800, color: BRAND_ACCENT }}>Synced</span>
                ) : row.soon ? (
                  <span style={{ fontSize: 11, fontWeight: 800, color: C.muted, background: "#F3F4F6", padding: "6px 10px", borderRadius: 999 }}>Soon</span>
                ) : (
                  <button
                    type="button"
                    onClick={row.action}
                    disabled={googleBusy}
                    style={{
                      background: BRAND_ACCENT, color: "#fff", border: "none", borderRadius: 999,
                      padding: "8px 12px", fontWeight: 800, fontSize: 12, fontFamily: BRAND_FONT, cursor: "pointer",
                    }}
                  >
                    {row.actionLabel}
                  </button>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.text, marginBottom: 6 }}>Personal Zoom link</div>
            <input
              value={settings.zoomPersonalLink || zoomStatus.personalLink || ""}
              onChange={(e) => setSetting("zoomPersonalLink", e.target.value)}
              onBlur={async (e) => {
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session?.access_token) return;
                  await fetch("/api/meetings?zoom=link", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
                    body: JSON.stringify({ link: e.target.value.trim() }),
                  });
                } catch { /* settings still save locally */ }
              }}
              placeholder="https://zoom.us/j/…"
              style={{
                width: "100%", boxSizing: "border-box", padding: "12px", borderRadius: 12,
                border: "1px solid #E4E4EA", fontFamily: BRAND_FONT, fontSize: 14, color: C.text,
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 10, lineHeight: 1.45, padding: "0 2px" }}>
            Phone calls stay a phone call. Google Meet and Zoom get a link when that account is connected. Google bookings also land on your calendar.
          </div>
        </div>
      </div>
    );
  }

  /* ─── MEETINGS LIST ─── */
  if (view === "meetings") {
    const list = meetingsFilter === "upcoming" ? upcoming : past;
    const groups = groupByDate(list);
    return (
      <div style={{ padding: "0 16px 110px", fontFamily: BRAND_FONT }}>
        <HeroShell
          backLabel="Scheduling"
          onBack={() => setView("hub")}
          title="Meetings"
          subtitle="Calls booked through your link."
          stats={[
            { value: upcoming.length, label: "Upcoming", strong: true },
            { value: completedCount, label: "Completed" },
            { value: cancelledCount, label: "Cancelled" },
          ]}
        />
        <div style={{
          display: "flex", background: "#ECECF0", borderRadius: 14, padding: 4, marginTop: 16, marginBottom: 16,
        }}
        >
          {["upcoming", "past"].map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setMeetingsFilter(id)}
              style={{
                flex: 1, border: "none", borderRadius: 11, padding: "10px 8px", cursor: "pointer",
                fontFamily: BRAND_FONT, fontWeight: 800, fontSize: 14,
                background: meetingsFilter === id ? "#fff" : "transparent",
                color: meetingsFilter === id ? C.text : C.muted,
                boxShadow: meetingsFilter === id ? "0 2px 8px rgba(22,22,26,0.08)" : "none",
              }}
            >
              {id === "upcoming" ? "Upcoming" : "Past"}
            </button>
          ))}
        </div>
        {groups.length === 0 ? (
          <div style={{ ...card, padding: "28px 16px", textAlign: "center", color: C.muted, fontSize: 14 }}>
            No {meetingsFilter} meetings.
          </div>
        ) : groups.map(([date, items]) => (
          <div key={date} style={{ marginBottom: 16 }}>
            <div style={{ ...sectionLabel, marginBottom: 8 }}>{fmtDayHeader(date)}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((m) => {
                const type = typeForMeeting(m);
                const loc = locationLabel(m, type);
                const meta = locationMeta(loc);
                const badge = m.status === "cancelled"
                  ? { text: "Cancelled", color: "#6B7280", bg: "#F3F4F6" }
                  : m.status === "completed" || (meetingsFilter === "past" && m.status !== "cancelled")
                    ? { text: "Completed", color: "#16A34A", bg: "#DCFCE7" }
                    : { text: "Scheduled", color: "#16A34A", bg: "#DCFCE7" };
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => openMeeting(m)}
                    style={{
                      ...card, padding: "14px", display: "flex", gap: 12, alignItems: "flex-start",
                      textAlign: "left", cursor: "pointer", fontFamily: BRAND_FONT, width: "100%",
                    }}
                  >
                    <div style={{
                      width: 42, height: 42, borderRadius: 12, background: meta.tint, color: meta.ink,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2,
                    }}
                    >
                      <LocIcon kind={meta.kind} color={meta.ink} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                        <div style={{ fontWeight: 900, fontSize: 15, color: C.text }}>{m.meetingTypeTitle || type?.title || "Meeting"}</div>
                        <span style={{
                          fontSize: 9, fontWeight: 800, letterSpacing: "0.04em", color: badge.color,
                          background: badge.bg, padding: "4px 7px", borderRadius: 8, flexShrink: 0,
                        }}
                        >
                          {badge.text}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{m.clientName || "Client"}</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
                        {formatDisplayTime(m.startTime, timeFormat)}
                        {m.durationMins || type?.durationMins ? ` · ${m.durationMins || type.durationMins} min` : ""}
                        {" · "}
                        {loc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* ─── MEETING DETAIL ─── */
  if (view === "meeting" && selectedMeeting) {
    const m = selectedMeeting;
    const type = typeForMeeting(m);
    const loc = locationLabel(m, type);
    const meta = locationMeta(loc);
    const isPast = m.date < today || m.status === "completed" || m.status === "cancelled";
    const whenLabel = `${fmtDayHeader(m.date).replace(/,/g, "")} · ${formatDisplayTime(m.startTime, timeFormat)} · ${m.durationMins || type?.durationMins || "—"} min`;
    const formBits = Array.isArray(m.formAnswers)
      ? m.formAnswers.map((a) => a.value || a.answer).filter(Boolean).join(" · ")
      : (m.notes || m.note || "");

    return (
      <div style={{ padding: "0 16px 110px", fontFamily: BRAND_FONT }}>
        <HeroShell
          backLabel="Meetings"
          onBack={backFromMeeting}
          title={m.meetingTypeTitle || type?.title || "Meeting"}
          subtitle={m.clientName ? `with ${m.clientName}` : null}
          stats={[
            { value: fmtShortDate(m.date), label: "Date", strong: true },
            { value: formatDisplayTime(m.startTime, timeFormat), label: "Time" },
            { value: `${m.durationMins || type?.durationMins || "—"} min`, label: "Length" },
          ]}
        >
          <div style={{
            display: "inline-flex", marginTop: 12, background: "rgba(255,255,255,0.2)",
            borderRadius: 999, padding: "5px 10px", fontSize: 11, fontWeight: 800, letterSpacing: "0.06em",
          }}
          >
            {loc.toUpperCase()}
          </div>
        </HeroShell>

        {m.status === "cancelled" ? (
          <div style={{ background: "#FEE2E2", color: "#B91C1C", padding: "12px 14px", borderRadius: 14, marginTop: 14, fontWeight: 700, fontSize: 13 }}>
            Cancelled
          </div>
        ) : isPast ? (
          <div style={{ background: "#DCFCE7", color: "#15803D", padding: "12px 14px", borderRadius: 14, marginTop: 14, fontWeight: 700, fontSize: 13 }}>
            ✓ Completed{m.date ? ` on ${fmtDayHeader(m.date)}` : ""}
          </div>
        ) : (
          <div style={{ background: "#DCFCE7", color: "#15803D", padding: "12px 14px", borderRadius: 14, marginTop: 14, fontWeight: 700, fontSize: 13 }}>
            Scheduled
          </div>
        )}

        {m.status !== "cancelled" && !m.meetLink && meetingLocation({ location: m.location, title: type?.title }) !== "phone" && (
          <button
            type="button"
            disabled={googleBusy}
            onClick={() => {
              const place = meetingLocation({ location: m.location, title: type?.title });
              if (place === "zoom" && !zoomStatus.connected && !(settings.zoomPersonalLink || zoomStatus.personalLink)) {
                connectZoom();
                return;
              }
              createGoogleMeet(m);
            }}
            style={{
              width: "100%", marginTop: 14, background: BRAND_ACCENT, color: "#fff", border: "none",
              borderRadius: 14, padding: "14px", fontWeight: 800, fontFamily: BRAND_FONT, cursor: "pointer",
            }}
          >
            {googleBusy
              ? "Creating link…"
              : meetingLocation({ location: m.location, title: type?.title }) === "zoom"
                ? (zoomStatus.connected || settings.zoomPersonalLink || zoomStatus.personalLink ? "Create Zoom" : "Connect Zoom")
                : (googleStatus.connected ? "Create Google Meet" : "Connect Google Meet")}
          </button>
        )}

        <div style={{ marginTop: 18 }}>
          <div style={sectionLabel}>DETAILS</div>
          <div style={card}>
            {[
              { icon: "🕒", label: "When", value: whenLabel },
              m.meetLink && { icon: "📹", label: loc, value: m.meetLink.replace(/^https?:\/\//, ""), href: m.meetLink },
              m.clientPhone && !m.meetLink && loc === "Phone call" && {
                icon: "📞", label: "Phone", value: m.clientPhone, href: `tel:${m.clientPhone}`,
              },
              {
                icon: "👤",
                label: "Client",
                value: [m.clientName, m.clientEmail].filter(Boolean).join(" · ") || "—",
                chevron: true,
                onClick: () => onOpenClient?.({ name: m.clientName, email: m.clientEmail, phone: m.clientPhone }),
              },
              m.eventId && {
                icon: "📁",
                label: "Linked event",
                value: events.find((e) => String(e.id) === String(m.eventId))?.name || "Open event",
                chevron: true,
                onClick: () => onOpenEventDetail?.(m.eventId),
              },
            ].filter(Boolean).map((row, i, arr) => (
              <button
                key={row.label}
                type="button"
                onClick={row.onClick || (row.href ? () => window.open(row.href, row.href.startsWith("tel:") ? "_self" : "_blank") : undefined)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 14px",
                  background: "#fff", border: "none", borderBottom: i < arr.length - 1 ? "1px solid #E8E8EE" : "none",
                  textAlign: "left", cursor: row.onClick || row.href || row.chevron ? "pointer" : "default",
                  fontFamily: BRAND_FONT,
                }}
              >
                <span style={{ fontSize: 16, width: 24, textAlign: "center", flexShrink: 0 }}>{row.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 2 }}>{row.label}</span>
                  <span style={{
                    display: "block", fontSize: 14, fontWeight: 700,
                    color: row.href ? BRAND_ACCENT : C.text,
                    overflow: "hidden", textOverflow: "ellipsis",
                  }}
                  >
                    {row.value}
                  </span>
                </span>
                {row.chevron ? <span style={{ color: C.muted, fontSize: 18 }}>›</span> : null}
              </button>
            ))}
          </div>
        </div>

        {formBits ? (
          <div style={{ marginTop: 18 }}>
            <div style={sectionLabel}>FROM THE BOOKING FORM</div>
            <div style={{
              ...card, padding: "14px 16px", fontSize: 14, color: C.text, lineHeight: 1.55,
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}
            >
              {formBits}
            </div>
          </div>
        ) : null}

        {!isPast && m.status !== "cancelled" && (
          <button
            type="button"
            onClick={() => markCompleted(m)}
            style={{
              width: "100%", marginTop: 18, background: "#fff", border: `1px solid ${C.border}`,
              borderRadius: 14, padding: "14px", fontWeight: 800, fontFamily: BRAND_FONT, cursor: "pointer", color: C.text,
            }}
          >
            Mark Completed
          </button>
        )}
      </div>
    );
  }

  /* ─── AVAILABILITY ─── */
  if (view === "availability") {
    const notice = settings.minNoticeHours || Math.max(1, Math.round((Number(settings.bufferMins) || 0) / 60) || 24);
    const wh = weeklyHoursForType(settings, hoursType);
    const typeOpenDays = DAY_LABELS.reduce((n, _, i) => n + ((wh[i] || []).length > 0 ? 1 : 0), 0);
    let typeMins = 0;
    DAY_LABELS.forEach((_, i) => {
      (wh[i] || []).forEach((r) => {
        const [sh, sm] = (r.start || "0:0").split(":").map(Number);
        const [eh, em] = (r.end || "0:0").split(":").map(Number);
        typeMins += Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
      });
    });
    return (
      <div style={{ padding: "0 16px 110px", fontFamily: BRAND_FONT }}>
        <HeroShell
          backLabel="Scheduling"
          onBack={() => setView("hub")}
          title="Availability"
          subtitle={hoursType ? `Hours for ${hoursType.title}. Other meeting types keep their own schedule.` : "When clients can book a call."}
          stats={[
            { value: typeOpenDays, label: "days open", strong: true },
            { value: Math.round(typeMins / 60), label: "Hours / wk" },
            { value: `${notice} hours`, label: "Notice" },
          ]}
        />
        <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "14px 0 2px" }}>
          {meetingTypes.map((t) => {
            const on = hoursType && String(t.id) === String(hoursType.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setHoursTypeId(t.id)}
                style={{
                  flexShrink: 0,
                  border: "none",
                  background: on ? BRAND_ACCENT : "#fff",
                  color: on ? "#fff" : C.text,
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontFamily: BRAND_FONT,
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                  boxShadow: on ? "none" : "0 0 0 1px #E4E4EA",
                }}
              >
                {t.title}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={sectionLabel}>WEEKLY HOURS · {(hoursType?.title || "MEETING").toUpperCase()}</div>
          <div style={card}>
            {DAY_LABELS.map((label, dayIdx) => {
              const ranges = wh[dayIdx] || wh[String(dayIdx)] || [];
              const on = ranges.length > 0;
              const hoursText = on
                ? ranges.map((r) => `${fmtClock(r.start)} – ${fmtClock(r.end)}`).join(", ")
                : "Unavailable";
              return (
                <div
                  key={label}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "14px 14px",
                    borderBottom: dayIdx < 6 ? "1px solid #E8E8EE" : "none",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => on && cycleDayHours(dayIdx)}
                    style={{
                      flex: 1, background: "none", border: "none", textAlign: "left", padding: 0,
                      cursor: on ? "pointer" : "default", fontFamily: BRAND_FONT,
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{DAY_FULL[dayIdx]}</div>
                    <div style={{ fontSize: 13, color: on ? C.muted : "#B0B0B8", marginTop: 2 }}>{hoursText}</div>
                  </button>
                  <Toggle on={on} onChange={(v) => setDayEnabled(dayIdx, v)} />
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 10, lineHeight: 1.45 }}>
            Tap a day’s hours to switch between presets.
          </div>
        </div>

        <div style={{ marginTop: 22 }}>
          <div style={sectionLabel}>BOOKING RULES</div>
          <div style={card}>
            {[
              {
                title: "Minimum notice",
                sub: "How soon clients can book",
                value: `${notice} hours`,
                onClick: () => {
                  const opts = [1, 2, 4, 12, 24, 48];
                  const next = opts[(opts.indexOf(Number(notice)) + 1) % opts.length] || 24;
                  setSetting("minNoticeHours", next);
                },
              },
              {
                title: "Buffer between calls",
                sub: "Breathing room after each call",
                value: `${Number(settings.bufferMins) || 0} min`,
                onClick: () => {
                  const opts = [0, 5, 10, 15, 30];
                  const cur = Number(settings.bufferMins) || 0;
                  setSetting("bufferMins", opts[(opts.indexOf(cur) + 1) % opts.length]);
                },
              },
              {
                title: "Booking window",
                sub: "How far ahead clients can book",
                value: `${Number(settings.daysAhead) || 30} days`,
                onClick: () => {
                  const opts = [14, 21, 30, 45, 60];
                  const cur = Number(settings.daysAhead) || 30;
                  setSetting("daysAhead", opts[(opts.indexOf(cur) + 1) % opts.length]);
                },
              },
              {
                title: "Time zone",
                sub: "Clients see times in their own zone",
                value: (settings.timezone || "America/New_York").split("/").pop()?.replace(/_/g, " ") || "Eastern",
              },
            ].map((row, i, arr) => (
              <button
                key={row.title}
                type="button"
                onClick={row.onClick}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "14px 14px",
                  background: "#fff", border: "none",
                  borderBottom: i < arr.length - 1 ? "1px solid #E8E8EE" : "none",
                  textAlign: "left", cursor: row.onClick ? "pointer" : "default", fontFamily: BRAND_FONT,
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 800, fontSize: 14, color: C.text }}>{row.title}</span>
                  <span style={{ display: "block", fontSize: 12, color: C.muted, marginTop: 2 }}>{row.sub}</span>
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: BRAND_ACCENT, flexShrink: 0 }}>{row.value}</span>
                {row.onClick ? <span style={{ color: C.muted }}>›</span> : null}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ─── DATE OVERRIDES ─── */
  if (view === "overrides") {
    const blockedN = upcomingOverrideRows.filter((r) => r.kind === "unavailable" || r.type === "unavailable" || r.type === "from_event").length;
    const customN = upcomingOverrideRows.filter((r) => r.kind === "custom" || r.type === "custom").length;
    const fromEventN = upcomingOverrideRows.filter((r) => r.type === "from_event").length;
    return (
      <div style={{ padding: "0 16px 110px", fontFamily: BRAND_FONT }}>
        <HeroShell
          backLabel="Scheduling"
          onBack={() => setView("hub")}
          title="Date overrides"
          subtitle="Block a day or open different hours without touching your weekly schedule."
          stats={[
            { value: blockedN, label: "Blocked", strong: true },
            { value: customN, label: "Custom hours" },
            { value: fromEventN, label: "From events" },
          ]}
        />

        <button
          type="button"
          onClick={() => setShowAddOverride((v) => !v)}
          style={{
            width: "100%", marginTop: 16, background: "#fff",
            border: "1.5px dashed #C7C7D1", borderRadius: 16, padding: "16px 14px",
            display: "flex", gap: 12, alignItems: "center", cursor: "pointer", fontFamily: BRAND_FONT,
          }}
        >
          <span style={{
            width: 36, height: 36, borderRadius: 10, background: "#FCE7F3", color: "#DB2777",
            display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 20,
          }}
          >
            +
          </span>
          <span style={{ textAlign: "left" }}>
            <span style={{ display: "block", fontWeight: 800, fontSize: 14, color: C.text }}>Add an override</span>
            <span style={{ display: "block", fontSize: 12, color: C.muted, marginTop: 2 }}>Block a day or set one-off hours.</span>
          </span>
        </button>

        {showAddOverride && (
          <div style={{ ...card, padding: 14, marginTop: 10 }}>
            <input
              type="date"
              value={overrideDraft.date}
              min={today}
              onChange={(e) => setOverrideDraft((f) => ({ ...f, date: e.target.value }))}
              style={{
                width: "100%", boxSizing: "border-box", marginBottom: 10, padding: "12px",
                borderRadius: 12, border: `1px solid ${C.border}`, fontFamily: BRAND_FONT, fontSize: 14,
              }}
            />
            <select
              value={overrideDraft.type}
              onChange={(e) => setOverrideDraft((f) => ({ ...f, type: e.target.value }))}
              style={{
                width: "100%", boxSizing: "border-box", marginBottom: 10, padding: "12px",
                borderRadius: 12, border: `1px solid ${C.border}`, fontFamily: BRAND_FONT, fontSize: 14,
              }}
            >
              <option value="unavailable">Block entire day</option>
              <option value="custom">Custom hours</option>
            </select>
            {overrideDraft.type === "custom" && (
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input type="time" value={overrideDraft.start} onChange={(e) => setOverrideDraft((f) => ({ ...f, start: e.target.value }))} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${C.border}` }} />
                <input type="time" value={overrideDraft.end} onChange={(e) => setOverrideDraft((f) => ({ ...f, end: e.target.value }))} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${C.border}` }} />
              </div>
            )}
            <button
              type="button"
              onClick={saveOverride}
              style={{
                width: "100%", background: BRAND_ACCENT, color: "#fff", border: "none", borderRadius: 12,
                padding: "12px", fontWeight: 800, fontFamily: BRAND_FONT, cursor: "pointer",
              }}
            >
              Save override
            </button>
          </div>
        )}

        <div style={{
          ...card, marginTop: 14, padding: "14px", display: "flex", alignItems: "center", gap: 12,
        }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: C.text }}>Auto-block event days</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Booked gigs close the whole day.</div>
          </div>
          <Toggle on={autoBlock} onChange={(v) => setSetting("autoBlockEventDays", v)} />
        </div>

        <div style={{ marginTop: 22 }}>
          <div style={sectionLabel}>COMING UP</div>
          {upcomingOverrideRows.length === 0 ? (
            <div style={{ ...card, padding: 16, color: C.muted, fontSize: 13 }}>No upcoming overrides.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {upcomingOverrideRows.map((row) => {
                const d = parseISO(row.date);
                const mon = d ? d.toLocaleDateString("en-US", { month: "short" }).toUpperCase() : "—";
                const day = d ? String(d.getDate()) : "—";
                const isEvent = row.type === "from_event";
                const isCustom = row.type === "custom" || row.kind === "custom";
                const tag = isEvent
                  ? { text: "FROM EVENT", bg: "#EDE9FE", ink: "#7C3AED" }
                  : isCustom
                    ? { text: "CUSTOM", bg: "#DCFCE7", ink: "#16A34A" }
                    : { text: "BLOCKED", bg: "#FEE2E2", ink: "#DC2626" };
                const title = isEvent
                  ? row.note
                  : isCustom
                    ? (row.note || "Custom hours")
                    : (row.note || "Blocked");
                const sub = isCustom && row.hours?.[0]
                  ? `${fmtClock(row.hours[0].start)} – ${fmtClock(row.hours[0].end)} only`
                  : "Blocked all day";
                return (
                  <div key={`${row.date}-${row.type}-${row.note}`} style={{ ...card, padding: "12px 14px", display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%", background: "#F3F4F6",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}
                    >
                      <span style={{ fontSize: 9, fontWeight: 800, color: C.muted }}>{mon}</span>
                      <span style={{ fontSize: 15, fontWeight: 900, color: C.text, lineHeight: 1 }}>{day}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 14, color: C.text }}>{title}</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{sub}</div>
                    </div>
                    <span style={{
                      fontSize: 9, fontWeight: 800, letterSpacing: "0.04em", color: tag.ink,
                      background: tag.bg, padding: "4px 7px", borderRadius: 8, flexShrink: 0,
                    }}
                    >
                      {tag.text}
                    </span>
                    {!isEvent && (
                      <button
                        type="button"
                        aria-label="Remove"
                        onClick={() => removeOverride(row.date)}
                        style={{ background: "none", border: "none", color: C.muted, fontSize: 18, cursor: "pointer", padding: 4 }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ─── ONE MEETING TYPE ─── */
  if (view === "type") {
    const t = meetingTypes.find((x) => String(x.id) === String(typeEditorId));
    if (!t) {
      return (
        <div style={{ padding: 24, fontFamily: BRAND_FONT }}>
          <button type="button" onClick={() => setView("types")} style={{ background: "none", border: "none", color: BRAND_ACCENT, fontWeight: 800, cursor: "pointer", fontFamily: BRAND_FONT, padding: 0 }}>
            ‹ Meeting types
          </button>
        </div>
      );
    }
    const customFields = (t.formFields || []).filter((f) => !isPresetQuestion(f));
    const fieldInput = {
      width: "100%", boxSizing: "border-box", padding: "12px", borderRadius: 12,
      border: "1px solid #E4E4EA", fontFamily: BRAND_FONT, fontSize: 15, color: C.text,
    };
    return (
      <div style={{ padding: "0 16px 110px", fontFamily: BRAND_FONT }}>
        <button
          type="button"
          onClick={() => setView("types")}
          style={{
            background: "none", border: "none", color: BRAND_ACCENT, fontWeight: 800,
            fontSize: 15, cursor: "pointer", fontFamily: BRAND_FONT, padding: "8px 0 10px",
          }}
        >
          ‹ Meeting types
        </button>
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em", color: C.text, marginBottom: 4 }}>Questions</div>
        <div style={{ fontSize: 14, color: C.muted, marginBottom: 16, lineHeight: 1.45 }}>
          These questions are only for {t.title}. Name, email, phone, and “what’s the call about” are always asked.
        </div>

        <div style={sectionLabel}>MEETING</div>
        <div style={{ ...card, padding: 14, marginBottom: 18 }}>
          <input
            value={t.title}
            onChange={(e) => patchType(t.id, { title: e.target.value })}
            style={{ ...fieldInput, fontWeight: 800, marginBottom: 10 }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[15, 30, 45, 60, 90].map((n) => {
              const on = Number(t.durationMins) === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => patchType(t.id, { durationMins: n })}
                  style={{
                    border: "none", borderRadius: 999, padding: "8px 12px", cursor: "pointer",
                    background: on ? BRAND_ACCENT : "#F1F1F6", color: on ? "#fff" : C.text,
                    fontWeight: 800, fontSize: 13, fontFamily: BRAND_FONT,
                  }}
                >
                  {n} min
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {MEETING_LOCATIONS.map((opt) => {
              const on = meetingLocation(t) === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => patchType(t.id, { location: opt.id })}
                  style={{
                    border: "none", borderRadius: 999, padding: "8px 12px", cursor: "pointer",
                    background: on ? BRAND_ACCENT : "#F1F1F6", color: on ? "#fff" : C.text,
                    fontWeight: 800, fontSize: 13, fontFamily: BRAND_FONT,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={sectionLabel}>ASK THESE</div>
        <div style={{ ...card, marginBottom: 18 }}>
          {MEETING_QUESTION_PRESETS.map((preset, i) => {
            const field = (t.formFields || []).find((f) => f.id === preset.id);
            const on = !!field;
            return (
              <div
                key={preset.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                  borderBottom: i < MEETING_QUESTION_PRESETS.length - 1 ? "1px solid #E8E8EE" : "none",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{preset.label}</div>
                  {on ? (
                    <button
                      type="button"
                      onClick={() => patchType(t.id, { formFields: setPresetQuestion(t.formFields, preset, true, !field.required) })}
                      style={{
                        marginTop: 4, border: "none", background: "none", padding: 0, cursor: "pointer",
                        color: field.required ? BRAND_ACCENT : C.muted, fontWeight: 800, fontSize: 12, fontFamily: BRAND_FONT,
                      }}
                    >
                      {field.required ? "Required" : "Optional"} · tap to change
                    </button>
                  ) : (
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Off for this meeting</div>
                  )}
                </div>
                <Toggle
                  on={on}
                  onChange={(v) => patchType(t.id, { formFields: setPresetQuestion(t.formFields, preset, v) })}
                />
              </div>
            );
          })}
        </div>

        <div style={sectionLabel}>YOUR OWN</div>
        {customFields.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
            {customFields.map((field) => (
              <div key={field.id} style={{ ...card, padding: 14 }}>
                <input
                  value={field.label}
                  onChange={(e) => patchType(t.id, {
                    formFields: (t.formFields || []).map((f) => (f.id === field.id ? { ...f, label: e.target.value } : f)),
                  })}
                  style={{ ...fieldInput, marginBottom: 8 }}
                />
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select
                    value={field.type}
                    onChange={(e) => patchType(t.id, {
                      formFields: (t.formFields || []).map((f) => (f.id === field.id ? { ...f, type: e.target.value } : f)),
                    })}
                    style={{ ...fieldInput, flex: 1 }}
                  >
                    {FORM_FIELD_TYPES.map((ft) => <option key={ft.id} value={ft.id}>{ft.label}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => patchType(t.id, {
                      formFields: (t.formFields || []).map((f) => (f.id === field.id ? { ...f, required: !f.required } : f)),
                    })}
                    style={{
                      border: "none", borderRadius: 12, padding: "12px 10px", cursor: "pointer",
                      background: field.required ? "#EDE9FE" : "#F1F1F6",
                      color: field.required ? BRAND_ACCENT : C.muted,
                      fontWeight: 800, fontSize: 12, fontFamily: BRAND_FONT, flexShrink: 0,
                    }}
                  >
                    {field.required ? "Required" : "Optional"}
                  </button>
                  <button
                    type="button"
                    aria-label="Remove question"
                    onClick={() => patchType(t.id, { formFields: (t.formFields || []).filter((f) => f.id !== field.id) })}
                    style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer", padding: 4 }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => patchType(t.id, { formFields: [...(t.formFields || []), blankFormField()] })}
          style={{
            width: "100%", background: "#fff", border: "1.5px dashed #C7C7D1", borderRadius: 16,
            padding: "14px", fontWeight: 800, fontSize: 14, color: C.text, cursor: "pointer", fontFamily: BRAND_FONT,
          }}
        >
          + Your own question
        </button>
      </div>
    );
  }

  /* ─── MEETING TYPES ─── */
  if (view === "types") {
    const totalBooked = (meetings || []).length;
    return (
      <div style={{ padding: "0 16px 110px", fontFamily: BRAND_FONT }}>
        <div style={{ paddingTop: 4 }}>
          <button
            type="button"
            onClick={() => setView("hub")}
            style={{
              background: "none", border: "none", color: BRAND_ACCENT, fontWeight: 800,
              fontSize: 15, cursor: "pointer", fontFamily: BRAND_FONT, padding: "4px 0 10px",
            }}
          >
            ‹ Scheduling
          </button>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em", color: C.text }}>Meeting types</div>
          <div style={{ fontSize: 14, color: C.muted, marginTop: 4, marginBottom: 14 }}>
            Copy the link on the right to send that meeting type to a client.
          </div>
          <div style={{
            background: HERO, borderRadius: 18, padding: "14px 8px",
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 16,
          }}
          >
            {[
              [activeTypes.length, "Active"],
              [meetingTypes.length, "Total"],
              [totalBooked, "Booked"],
            ].map(([v, l]) => (
              <div key={l} style={{ textAlign: "center", color: "#fff" }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{v}</div>
                <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={addType}
          style={{
            width: "100%", background: "#fff", border: "1.5px dashed #C7C7D1", borderRadius: 16,
            padding: "14px", display: "flex", gap: 12, alignItems: "center", cursor: "pointer",
            fontFamily: BRAND_FONT, marginBottom: 12,
          }}
        >
          <span style={{
            width: 36, height: 36, borderRadius: 10, background: "#EDE9FE", color: BRAND_ACCENT,
            display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 20,
          }}
          >
            +
          </span>
          <span style={{ textAlign: "left" }}>
            <span style={{ display: "block", fontWeight: 800, fontSize: 14, color: C.text }}>New meeting type</span>
            <span style={{ display: "block", fontSize: 12, color: C.muted, marginTop: 2 }}>Set a length, location and questions.</span>
          </span>
        </button>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {meetingTypes.map((t) => {
            const loc = locationLabel({}, t);
            const meta = locationMeta(loc);
            const booked = bookedByType[t.id] || bookedByType[t.title] || 0;
            const dim = !t.enabled;
            return (
              <div
                key={t.id}
                style={{
                  ...card, padding: "14px", display: "flex", flexDirection: "column", gap: 12,
                  opacity: dim ? 0.55 : 1,
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, background: meta.tint, color: meta.ink,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}
                  >
                    <LocIcon kind={meta.kind} color={meta.ink} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 15, color: C.text }}>{t.title}</div>
                    {t.description ? (
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.4 }}>{t.description}</div>
                    ) : null}
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
                      {t.durationMins} min · {meetingLocationLabel(t)} · {(t.formFields || []).length} question{(t.formFields || []).length === 1 ? "" : "s"} · {describeWeeklyHours(weeklyHoursForType(settings, t))}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => copyTypeLink(t)}
                    title="Copy this meeting type’s booking link"
                    style={{
                      border: "none", background: "#EEF2FF", color: BRAND_ACCENT, borderRadius: 999,
                      padding: "8px 12px", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: BRAND_FONT,
                      maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    {t.slug || "link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTypeEditorId(t.id); setView("type"); }}
                    style={{
                      border: "none", background: "#F1F1F6", color: C.text, borderRadius: 999,
                      padding: "8px 12px", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: BRAND_FONT,
                    }}
                  >
                    Questions
                  </button>
                  <Toggle on={!!t.enabled} onChange={(v) => toggleType(t.id, v)} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 14, lineHeight: 1.45 }}>
          Only active types show on your booking link. Switching one off doesn’t cancel calls already booked.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, color: C?.muted || "#8E8E93", fontFamily: BRAND_FONT }}>
      <button type="button" onClick={() => setView("hub")} style={{ background: "none", border: "none", color: BRAND_ACCENT, fontWeight: 800, cursor: "pointer", fontFamily: BRAND_FONT, padding: 0 }}>
        ‹ Back to Scheduling
      </button>
    </div>
  );
}
