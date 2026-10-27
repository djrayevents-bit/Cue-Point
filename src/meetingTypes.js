/** Shared meeting-type helpers — kept light so phone Scheduling doesn't pull the full MeetingSchedule UI module. */

export const DEFAULT_WEEKLY_HOURS = {
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
  description: "Pick a time that works for you. You’ll get a confirmation email and calendar invite through CuePoint.",
  durationMins: 30,
  bufferMins: 0,
  daysAhead: 30,
  weeklyHours: DEFAULT_WEEKLY_HOURS,
  dateOverrides: [],
  meetingTypes: [],
  timezone: typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : "America/New_York",
};

/** Questions a DJ can turn on per meeting type. Name, email, phone, and notes are always asked. */
export const MEETING_QUESTION_PRESETS = [
  { id: "sq-event-date", label: "Event date", type: "date", placeholder: "" },
  { id: "sq-event-type", label: "Event type", type: "select", options: ["Wedding", "Corporate", "School dance", "Private party", "Other"] },
  { id: "sq-venue", label: "Venue", type: "text", placeholder: "Venue name" },
  { id: "sq-city", label: "Event city", type: "text", placeholder: "City" },
  { id: "sq-guest-count", label: "Guest count", type: "number", placeholder: "About how many guests?" },
  { id: "sq-budget", label: "Budget", type: "text", placeholder: "Approximate budget" },
  { id: "sq-start-time", label: "Event start time", type: "text", placeholder: "Ceremony or start time" },
  { id: "sq-must-plays", label: "Must-play songs", type: "textarea", placeholder: "Songs they have to hear" },
  { id: "sq-do-not-play", label: "Do-not-play songs", type: "textarea", placeholder: "Songs to skip" },
  { id: "sq-referral", label: "How did you hear about us?", type: "text", placeholder: "" },
];

export const isPresetQuestion = (field) =>
  MEETING_QUESTION_PRESETS.some((p) => p.id === field?.id);

/** Turn a suggested question on or off for one meeting type. */
export function setPresetQuestion(fields, preset, enabled, required) {
  const list = Array.isArray(fields) ? [...fields] : [];
  const existing = list.find((f) => f.id === preset.id);
  if (!enabled) return list.filter((f) => f.id !== preset.id);
  const next = {
    id: preset.id,
    label: preset.label,
    type: preset.type,
    required: required != null ? !!required : !!existing?.required,
    placeholder: preset.placeholder || "",
    options: Array.isArray(preset.options) ? [...preset.options] : [],
  };
  if (existing) return list.map((f) => (f.id === preset.id ? { ...existing, ...next } : f));
  return [...list, next];
}

export const MEETING_LOCATIONS = [
  { id: "phone", label: "Phone call" },
  { id: "google_meet", label: "Google Meet" },
  { id: "zoom", label: "Zoom" },
];

/** Where this meeting type happens. Existing types without a choice stay on Google Meet. */
export function meetingLocation(type) {
  const id = String(type?.location || "").toLowerCase();
  if (MEETING_LOCATIONS.some((l) => l.id === id)) return id;
  const title = String(type?.title || "");
  if (/zoom/i.test(title)) return "zoom";
  if (/phone/i.test(title)) return "phone";
  return "google_meet";
}

export function meetingLocationLabel(type) {
  const id = meetingLocation(type);
  return MEETING_LOCATIONS.find((l) => l.id === id)?.label || "Google Meet";
}

export const FORM_FIELD_TYPES = [
  { id: "text", label: "Short text" },
  { id: "textarea", label: "Long text" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "date", label: "Date" },
  { id: "number", label: "Number" },
  { id: "select", label: "Dropdown" },
];

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Copy weekday windows so one meeting type never shares array refs with another. */
export function cloneWeeklyHours(source) {
  const src = source && typeof source === "object" ? source : DEFAULT_WEEKLY_HOURS;
  const out = {};
  for (let d = 0; d <= 6; d += 1) {
    const ranges = src[d] ?? src[String(d)] ?? [];
    out[d] = (Array.isArray(ranges) ? ranges : [])
      .filter((r) => r && r.start && r.end)
      .map((r) => ({ start: String(r.start), end: String(r.end) }));
  }
  return out;
}

/** Per-type hours when set; otherwise the shared schedule. */
export function weeklyHoursForType(settings, type) {
  if (type?.weeklyHours && typeof type.weeklyHours === "object") {
    return cloneWeeklyHours(type.weeklyHours);
  }
  return cloneWeeklyHours(settings?.weeklyHours || DEFAULT_WEEKLY_HOURS);
}

export function settingsForType(settings, type) {
  return {
    ...(settings || {}),
    weeklyHours: weeklyHoursForType(settings, type),
    durationMins: Number(type?.durationMins) || Number(settings?.durationMins) || 30,
  };
}

export function describeWeeklyHours(hours) {
  const wh = cloneWeeklyHours(hours);
  const open = [];
  for (let d = 0; d <= 6; d += 1) {
    if (wh[d].length) open.push(DAY_SHORT[d]);
  }
  if (!open.length) return "No open days";
  return open.join(", ");
}

export const slugifyMeetingType = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "meeting";

const normalizeFormFields = (fields) =>
  (Array.isArray(fields) ? fields : [])
    .filter((f) => f && (f.label || f.id))
    .map((f, i) => ({
      id: String(f.id || `ff-${i}`),
      label: String(f.label || "Question").trim() || "Question",
      type: FORM_FIELD_TYPES.some((t) => t.id === f.type) ? f.type : "text",
      required: !!f.required,
      placeholder: String(f.placeholder || ""),
      options: Array.isArray(f.options)
        ? f.options.map((o) => String(o || "").trim()).filter(Boolean)
        : String(f.optionsText || "")
            .split("\n")
            .map((o) => o.trim())
            .filter(Boolean),
    }));

export const normalizeMeetingTypes = (settings = {}) => {
  const raw = Array.isArray(settings.meetingTypes) ? settings.meetingTypes : [];
  const cleaned = raw
    .filter((t) => t && (t.title || t.id))
    .map((t, i) => {
      const title = String(t.title || "Meeting").trim() || "Meeting";
      return {
        id: String(t.id || `mt-${i}`),
        slug: slugifyMeetingType(t.slug || title),
        title,
        description: String(t.description || ""),
        durationMins: Math.max(5, Number(t.durationMins) || Number(settings.durationMins) || 30),
        enabled: t.enabled !== false,
        location: meetingLocation(t),
        formFields: normalizeFormFields(t.formFields),
        ...(t.weeklyHours && typeof t.weeklyHours === "object"
          ? { weeklyHours: cloneWeeklyHours(t.weeklyHours) }
          : {}),
      };
    });
  if (cleaned.length) {
    const seen = new Set();
    return cleaned.map((t) => {
      let slug = t.slug;
      let n = 2;
      while (seen.has(slug)) {
        slug = `${t.slug}-${n++}`;
      }
      seen.add(slug);
      return { ...t, slug };
    });
  }
  return [
    {
      id: "mt-default",
      slug: "meeting",
      title: settings.title || "Book a Meeting",
      description: settings.description || "",
      durationMins: Number(settings.durationMins) || 30,
      enabled: true,
      location: "google_meet",
      formFields: [],
    },
  ];
};

export const blankMeetingType = (settings = {}) => {
  const id = `mt-${Date.now()}`;
  return {
    id,
    slug: `meeting-${String(Date.now()).slice(-4)}`,
    title: "New meeting type",
    description: "",
    durationMins: Number(settings.durationMins) || 30,
    enabled: true,
    location: "google_meet",
    formFields: [],
    weeklyHours: cloneWeeklyHours(settings.weeklyHours || DEFAULT_WEEKLY_HOURS),
  };
};

export const blankFormField = () => ({
  id: `ff-${Date.now()}-${Math.floor(Math.random() * 999)}`,
  label: "New question",
  type: "text",
  required: false,
  placeholder: "",
  options: [],
});
