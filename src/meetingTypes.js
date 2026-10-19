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

export const FORM_FIELD_TYPES = [
  { id: "text", label: "Short text" },
  { id: "textarea", label: "Long text" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "date", label: "Date" },
  { id: "number", label: "Number" },
  { id: "select", label: "Dropdown" },
];

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
        formFields: normalizeFormFields(t.formFields),
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
    formFields: [],
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
