/** CUE Wave 1 — action parse, validate, normalize, and apply helpers. */

import { supabase } from "./supabase";

export const CUE_ACTION_TYPES = [
  "apply_timeline",
  "prefill_event",
  "draft_email",
  "save_night_brief",
  "apply_mc_scripts",
];

export const CUE_INTENTS = [
  "chat",
  "timeline",
  "new_event",
  "lead_email",
  "night_brief",
  "mc_scripts",
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
export const parseCueResponse = (data, { packages = [], timelineItems = [] } = {}) => {
  const reply = (data && (data.reply || data.error)) || "";
  let actions = Array.isArray(data?.actions) ? data.actions : [];

  // Fallback: model put JSON in reply
  if (!actions.length && typeof reply === "string") {
    const parsed = extractJsonObject(reply);
    if (parsed && Array.isArray(parsed.actions)) {
      actions = parsed.actions;
      if (parsed.reply) {
        return finalizeActions(String(parsed.reply), actions, packages, timelineItems);
      }
    }
  }

  return finalizeActions(String(reply || ""), actions, packages, timelineItems);
};

const finalizeActions = (reply, actions, packages, timelineItems) => {
  const out = [];
  for (const a of actions || []) {
    if (!a || !CUE_ACTION_TYPES.includes(a.type)) continue;
    const payload = a.payload;
    let normalized = null;
    if (a.type === "apply_timeline") {
      normalized = normalizeTimelineItems(payload?.items || payload);
      if (!normalized.length) continue;
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

export const mailtoHref = ({ to, subject, body }) => {
  const q = new URLSearchParams();
  if (subject) q.set("subject", subject);
  if (body) q.set("body", body);
  const qs = q.toString();
  return `mailto:${encodeURIComponent(to || "")}${qs ? `?${qs}` : ""}`;
};
