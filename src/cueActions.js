/** CUE Wave 1 — action parse, validate, normalize, and apply helpers. */

import { supabase } from "./supabase";
import { buildDayOfReplanTimeline, minutesFromIso, timeToMinutesOfDay } from "./dayOfHelpers";

export const CUE_ACTION_TYPES = [
  "apply_timeline",
  "update_timeline_note",
  "prefill_event",
  "draft_email",
  "save_night_brief",
  "apply_mc_scripts",
  "add_wardrobe_item",
  "add_equipment_item",
];

export const WARDROBE_STATUSES = [
  "Clean & Ready", "Drop Off At Cleaners", "At the Cleaners", "Needs Washing", "Dirty",
];
export const DEFAULT_CUE_WARDROBE_CATEGORIES = [
  "Suit Jacket", "Dress Shirt", "Pants", "Vest", "Tie", "Bow Tie",
  "Shoes", "Belt", "Accessories", "Full Outfit", "Other",
];
export const DEFAULT_CUE_EQUIPMENT_CATEGORIES = [
  "Speakers", "Subwoofers", "Mixers", "Controllers", "Lighting",
  "Microphones", "Cables & Stands", "Laptops", "DJ Accessories", "Other",
];
export const DEFAULT_CUE_EQUIPMENT_LOCATIONS = [
  "Home", "Van / Vehicle", "Storage Unit", "Venue Locker", "Other",
];
export const EQUIPMENT_CONDITIONS = ["Excellent", "Good", "Fair", "Needs Repair"];

const pickFromList = (value, list, fallback) => {
  const v = String(value || "").trim();
  const opts = (list || []).filter(Boolean);
  if (!v) return fallback;
  const exact = opts.find((x) => String(x).toLowerCase() === v.toLowerCase());
  if (exact) return exact;
  const fuzzy = opts.find((x) => {
    const a = String(x).toLowerCase();
    const b = v.toLowerCase();
    return a.includes(b) || b.includes(a);
  });
  return fuzzy || fallback || v;
};

export const CUE_INTENTS = [
  "chat",
  "timeline",
  "new_event",
  "lead_email",
  "night_brief",
  "mc_scripts",
  "dayof_next",
  "dayof_mc",
  "dayof_replan",
];

/** Strip markdown fences and extract JSON object from model text. */
export const extractJsonObject = (text) => {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
};

/** Normalize 24h "HH:MM" or "H:MM" to display "H:MM AM/PM". Pass through if already 12h. */
export const toTimelineDisplayTime = (raw) => {
  if (!raw || typeof raw !== "string") return "";
  const s = raw.trim();
  if (/am|pm/i.test(s)) return s.replace(/\s+/g, " ");
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return s;
  let h = parseInt(m[1], 10);
  const min = m[2];
  if (Number.isNaN(h) || h > 23) return s;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${ap}`;
};

export const normalizeDuration = (d) => {
  if (d == null || d === "") return "";
  if (typeof d === "number" && Number.isFinite(d)) return `${d} min`;
  return String(d);
};

export const normalizeTimelineItems = (items) => {
  if (!Array.isArray(items)) return [];
  const base = Date.now();
  return items
    .filter((it) => it && (it.event || it.label || it.time))
    .map((it, i) => ({
      id: typeof it.id === "number" ? it.id : base + i,
      time: toTimelineDisplayTime(it.time || ""),
      event: String(it.event || it.label || "Moment").trim(),
      duration: normalizeDuration(it.duration),
      song: it.song != null ? String(it.song) : "",
      note: it.note != null ? String(it.note) : "",
      linkedSectionId: it.linkedSectionId ?? null,
    }))
    .sort((a, b) => timeSortKey(a.time) - timeSortKey(b.time));
};

const timeSortKey = (t) => {
  const m = String(t || "").match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!m) return 9999;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = (m[3] || "").toUpperCase();
  if (ap === "AM" && h === 12) h = 0;
  if (ap === "PM" && h !== 12) h += 12;
  if (!ap && h <= 23) { /* already 24h-ish */ }
  return h * 60 + min;
};

export const normalizeMcScripts = (scripts, timelineItems = []) => {
  if (!Array.isArray(scripts)) return [];
  const base = Date.now();
  return scripts
    .filter((s) => s && (s.text || s.label))
    .map((s, i) => {
      let linked = s.linkedTimelineItemId ?? null;
      if (linked == null && s.label && timelineItems.length) {
        const hit = timelineItems.find(
          (t) => String(t.event || "").toLowerCase() === String(s.label).toLowerCase()
        );
        if (hit) linked = hit.id;
      }
      return {
        id: typeof s.id === "number" ? s.id : base + i,
        label: String(s.label || `Script ${i + 1}`).trim(),
        text: String(s.text || "").trim(),
        linkedTimelineItemId: linked,
      };
    });
};

export const normalizePrefillEvent = (payload, packages = []) => {
  if (!payload || typeof payload !== "object") return null;
  const pkgs = packages || [];
  let packageName = payload.package || payload.packageName || "";
  let packageId = payload.packageId ?? null;
  let totalFee = payload.totalFee;

  if (packageId != null) {
    const p = pkgs.find((x) => String(x.id) === String(packageId));
    if (p) {
      packageName = p.name;
      if (totalFee == null || totalFee === "") totalFee = p.price;
    } else {
      packageId = null;
    }
  } else if (packageName) {
    const p = pkgs.find((x) => String(x.name).toLowerCase() === String(packageName).toLowerCase());
    if (p) {
      packageId = p.id;
      packageName = p.name;
      if (totalFee == null || totalFee === "") totalFee = p.price;
    } else {
      // Don't invent prices — clear fee if package unknown
      packageName = "";
      totalFee = undefined;
    }
  } else {
    totalFee = undefined;
  }

  const contacts = Array.isArray(payload.contacts) && payload.contacts.length
    ? payload.contacts
    : [{
        first: (payload.client || "").split(/\s+/)[0] || "",
        last: (payload.client || "").split(/\s+/).slice(1).join(" ") || "",
        email: payload.clientEmail || "",
        phone: payload.clientPhone || "",
        relationship: "Client",
      }];

  return {
    eventName: payload.name || payload.eventName || "",
    eventType: payload.type || payload.eventType || "",
    date: payload.date || "",
    startTime: payload.startTime || "",
    endTime: payload.endTime || "",
    setupTime: payload.setupTime || "",
    venueName: payload.venue || payload.venueName || "",
    guests: payload.guests != null ? String(payload.guests) : "",
    notes: payload.notes || "",
    package: packageName,
    packageId,
    selectedAddons: Array.isArray(payload.selectedAddons) ? payload.selectedAddons : [],
    totalFee: totalFee != null && totalFee !== "" ? String(totalFee) : "",
    contacts,
    client: payload.client || `${contacts[0]?.first || ""} ${contacts[0]?.last || ""}`.trim(),
    clientEmail: payload.clientEmail || contacts[0]?.email || "",
    clientPhone: payload.clientPhone || contacts[0]?.phone || "",
  };
};

export const normalizeDraftEmail = (payload) => {
  if (!payload || typeof payload !== "object") return null;
  const to = String(payload.to || "").trim();
  const subject = String(payload.subject || "").trim();
  const body = String(payload.body || "").trim();
  if (!subject && !body) return null;
  return { to, subject, body };
};

export const normalizeNightBrief = (payload) => {
  if (payload == null) return null;
  if (typeof payload === "string") return payload.trim() || null;
  if (typeof payload === "object" && payload.brief) return String(payload.brief).trim() || null;
  if (typeof payload === "object" && payload.text) return String(payload.text).trim() || null;
  return null;
};

/**
 * Validate and attach normalized payloads. Drops invalid actions.
 * Returns { reply, actions } where actions have .normalized
 */
export const normalizeWardrobeItem = (payload, categories = []) => {
  if (!payload || typeof payload !== "object") return null;
  const name = String(payload.name || "").trim();
  if (!name) return null;
  const cats = categories?.length ? categories : DEFAULT_CUE_WARDROBE_CATEGORIES;
  return {
    name,
    category: pickFromList(payload.category, cats, "Other"),
    color: String(payload.color || "").trim(),
    status: pickFromList(payload.status, WARDROBE_STATUSES, "Clean & Ready"),
    notes: String(payload.notes || "").trim(),
    assignedEventId: payload.assignedEventId != null ? String(payload.assignedEventId) : "",
  };
};

export const normalizeEquipmentItem = (payload, { categories = [], locations = [] } = {}) => {
  if (!payload || typeof payload !== "object") return null;
  const name = String(payload.name || "").trim();
  if (!name) return null;
  const cats = categories?.length ? categories : DEFAULT_CUE_EQUIPMENT_CATEGORIES;
  const locs = locations?.length ? locations : DEFAULT_CUE_EQUIPMENT_LOCATIONS;
  const qty = Number(payload.quantity);
  const cost = payload.costPerItem === "" || payload.costPerItem == null ? "" : Number(payload.costPerItem);
  return {
    name,
    category: pickFromList(payload.category, cats, "Other"),
    location: pickFromList(payload.location, locs, "Home"),
    quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
    condition: pickFromList(payload.condition, EQUIPMENT_CONDITIONS, "Excellent"),
    costPerItem: Number.isFinite(cost) && cost >= 0 ? cost : "",
    serial: String(payload.serial || "").trim(),
    notes: String(payload.notes || "").trim(),
    batteryPowered: !!payload.batteryPowered,
    chargeStatus: payload.batteryPowered ? (payload.chargeStatus || "Unknown") : "Unknown",
    chargeReminderDays: 7,
    chargeReminderEnabled: false,
  };
};

/** Match a run-sheet moment by title (preferred) or time. */
export const findTimelineMoment = (items, { moment, time } = {}) => {
  const list = Array.isArray(items) ? items : [];
  const title = String(moment || "").trim().toLowerCase();
  const rawTime = String(time || "").trim();
  if (title) {
    const exact = list.find(
      (it) => String(it.event || it.label || "").trim().toLowerCase() === title
    );
    if (exact) return exact;
    const fuzzy = list.find((it) => {
      const n = String(it.event || it.label || "").trim().toLowerCase();
      return n && (n.includes(title) || title.includes(n));
    });
    if (fuzzy) return fuzzy;
  }
  if (rawTime) {
    const want = timeSortKey(toTimelineDisplayTime(rawTime) || rawTime);
    if (want !== 9999) {
      const byTime = list.find((it) => timeSortKey(it.time) === want);
      if (byTime) return byTime;
    }
  }
  return null;
};

export const normalizeTimelineNoteUpdate = (payload, timelineItems = []) => {
  if (!payload || typeof payload !== "object") return null;
  const note = String(payload.note || "").trim();
  const moment = String(payload.moment || payload.event || payload.label || "").trim();
  const time = payload.time != null ? String(payload.time).trim() : "";
  const mode = payload.mode === "append" ? "append" : "replace";
  if (!note) return null;
  if (!moment && !time) return null;
  const hit = findTimelineMoment(timelineItems, { moment, time });
  const matchedTime = hit?.time || (time ? toTimelineDisplayTime(time) : "");
  const matchedMoment = hit
    ? String(hit.event || hit.label || moment || "Moment").trim()
    : (moment || "Moment");
  return {
    moment: matchedMoment,
    time: matchedTime,
    note,
    mode,
    matched: !!hit,
    matchedId: hit?.id ?? null,
    previousNote: hit?.note != null ? String(hit.note) : "",
  };
};

export const parseCueResponse = (data, {
  packages = [],
  timelineItems = [],
  wardrobeCategories = [],
  equipmentCategories = [],
  equipmentLocations = [],
} = {}) => {
  const reply = (data && (data.reply || data.error)) || "";
  let actions = Array.isArray(data?.actions) ? data.actions : [];

  // Fallback: model put JSON in reply
  if (!actions.length && typeof reply === "string") {
    const parsed = extractJsonObject(reply);
    if (parsed && Array.isArray(parsed.actions)) {
      actions = parsed.actions;
      if (parsed.reply) {
        return finalizeActions(String(parsed.reply), actions, {
          packages, timelineItems, wardrobeCategories, equipmentCategories, equipmentLocations,
        });
      }
    }
  }

  return finalizeActions(String(reply || ""), actions, {
    packages, timelineItems, wardrobeCategories, equipmentCategories, equipmentLocations,
  });
};

const finalizeActions = (reply, actions, lists = {}) => {
  const {
    packages = [],
    timelineItems = [],
    wardrobeCategories = [],
    equipmentCategories = [],
    equipmentLocations = [],
  } = lists;
  const out = [];
  for (const a of actions || []) {
    if (!a || !CUE_ACTION_TYPES.includes(a.type)) continue;
    const payload = a.payload;
    let normalized = null;
    if (a.type === "apply_timeline") {
      normalized = normalizeTimelineItems(payload?.items || payload);
      if (!normalized.length) continue;
      const strategy = payload?.strategy === "replace_remaining" ? "replace_remaining" : null;
      out.push({ type: a.type, payload, normalized, strategy });
      continue;
    } else if (a.type === "update_timeline_note") {
      normalized = normalizeTimelineNoteUpdate(payload, timelineItems);
      if (!normalized) continue;
    } else if (a.type === "apply_mc_scripts") {
      normalized = normalizeMcScripts(payload?.scripts || payload, timelineItems);
      if (!normalized.length) continue;
    } else if (a.type === "prefill_event") {
      normalized = normalizePrefillEvent(payload, packages);
      if (!normalized) continue;
    } else if (a.type === "draft_email") {
      normalized = normalizeDraftEmail(payload);
      if (!normalized) continue;
    } else if (a.type === "save_night_brief") {
      normalized = normalizeNightBrief(payload);
      if (!normalized) continue;
    } else if (a.type === "add_wardrobe_item") {
      normalized = normalizeWardrobeItem(payload, wardrobeCategories);
      if (!normalized) continue;
    } else if (a.type === "add_equipment_item") {
      normalized = normalizeEquipmentItem(payload, {
        categories: equipmentCategories,
        locations: equipmentLocations,
      });
      if (!normalized) continue;
    }
    out.push({ type: a.type, payload, normalized });
  }
  return { reply, actions: out };
};

/** POST /api/cue/chat with auth. Returns raw JSON. */
export const callCueChat = async (body) => {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch("/api/cue/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
};

/** Normalize timeline items and merge/replace into timelines map. Pure helper for Wave 1 + import + day-of replan. */
export const applyTimelineToStore = (prev, eventId, items, mode = "replace", opts = {}) => {
  if (eventId == null || eventId === "") return prev || {};
  const normalized = normalizeTimelineItems(items);
  const existing = prev?.[eventId] || [];
  let next;
  if (mode === "merge") {
    next = [
      ...existing,
      ...normalized.map((it, i) => ({ ...it, id: Date.now() + i + Math.floor(Math.random() * 1000) })),
    ];
  } else if (mode === "replace_remaining") {
    const nowMin = opts.nowMinutes != null
      ? opts.nowMinutes
      : (opts.nowIso ? minutesFromIso(opts.nowIso) : timeToMinutesOfDay(new Date()));
    next = buildDayOfReplanTimeline(existing, normalized, nowMin);
  } else {
    next = normalized;
  }
  next.sort((a, b) => timeSortKey(a.time) - timeSortKey(b.time));
  return { ...(prev || {}), [eventId]: next };
};

export const applyMcScriptsToStore = (prev, eventId, scripts, mode = "replace") => {
  if (eventId == null || eventId === "") return prev || {};
  const normalized = normalizeMcScripts(scripts);
  const existing = prev?.[eventId] || [];
  const next = mode === "merge" ? [...existing, ...normalized] : normalized;
  return { ...(prev || {}), [eventId]: next };
};

/** Write/replace/append a note on one matched timeline moment. */
export const applyTimelineNoteToStore = (prev, eventId, normalized, modeOverride) => {
  if (eventId == null || eventId === "" || !normalized?.matchedId) return prev || {};
  const mode = modeOverride === "append" || modeOverride === "replace"
    ? modeOverride
    : (normalized.mode === "append" ? "append" : "replace");
  const noteText = String(normalized.note || "").trim();
  if (!noteText) return prev || {};
  const list = prev?.[eventId] || [];
  const next = list.map((it) => {
    if (String(it.id) !== String(normalized.matchedId)) return it;
    const prevNote = it.note != null ? String(it.note).trim() : "";
    const note = mode === "append" && prevNote
      ? `${prevNote}\n${noteText}`
      : noteText;
    return { ...it, note };
  });
  return { ...(prev || {}), [eventId]: next };
};

/**
 * POST /api/cue/import-timeline (rewritten to /api/cue/chat) — PDF (base64) or pasted text.
 * PDF is sent in-request only; not stored server-side.
 */
export const callCueImportTimeline = async ({ eventId, text, pdfBase64, filename, event }) => {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch("/api/cue/import-timeline", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
    },
    body: JSON.stringify({
      importTimeline: true,
      eventId,
      ...(text ? { text } : {}),
      ...(pdfBase64 ? { pdfBase64, filename } : {}),
      ...(event ? { event } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Import failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
};

export const mailtoHref = ({ to, subject, body }) => {
  const q = new URLSearchParams();
  if (subject) q.set("subject", subject);
  if (body) q.set("body", body);
  const qs = q.toString();
  return `mailto:${encodeURIComponent(to || "")}${qs ? `?${qs}` : ""}`;
};
