/**
 * In-app phone Notify tab — derived P0 cards + optional persisted log.
 * Read state stays in localStorage (cuepoint_phoneNotifRead); this module
 * builds active cards and merges first-seen timestamps into `notifications`.
 */

import { invoicePaidAmount } from "./eventMoney";

export const NOTIF_CATALOG = {
  MONEY: { id: "MONEY", label: "MONEY", accent: "#EAB308", tint: "#FEF9C3", ink: "#854D0E", glyph: "$" },
  LEAD: { id: "LEAD", label: "LEAD", accent: "#3B82F6", tint: "#DBEAFE", ink: "#1D4ED8", glyph: "+" },
  CONTRACT: { id: "CONTRACT", label: "CONTRACT", accent: "#22C55E", tint: "#DCFCE7", ink: "#15803D", glyph: "≡" },
  SCHEDULING: { id: "SCHEDULING", label: "SCHEDULING", accent: "#6B7280", tint: "#F3F4F6", ink: "#374151", glyph: "✕" },
  MUSIC: { id: "MUSIC", label: "MUSIC", accent: "#EC4899", tint: "#FCE7F3", ink: "#BE185D", glyph: "♪" },
};

const READ_KEY = "cuepoint_phoneNotifRead";
const MS_DAY = 24 * 60 * 60 * 1000;

const startOfToday = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const parseDate = (raw) => {
  if (!raw) return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  const s = String(raw).trim();
  if (!s) return null;
  // ISO date-only
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + "T00:00:00");
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const daysUntil = (raw, from = startOfToday()) => {
  const d = parseDate(raw);
  if (!d) return null;
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((day - from) / MS_DAY);
};

const daysSince = (raw, from = startOfToday()) => {
  const n = daysUntil(raw, from);
  return n == null ? null : -n;
};

const invTotal = (inv) => {
  if (inv?.lineItems?.length) {
    return inv.lineItems.reduce((s, li) => s + (Number(li.qty) || 1) * (Number(li.rate) || 0), 0);
  }
  return Number(inv?.amount) || 0;
};

const invBalance = (inv) => Math.max(0, invTotal(inv) - invoicePaidAmount(inv));

const contractIsSigned = (c) =>
  c?.status === "Signed" || !!(c?.signed || c?.signedAt || c?.signedDate || c?.signatureDrawn);

const contractWasViewed = (c) => {
  if (Array.isArray(c?.openLog) && c.openLog.length > 0) return true;
  if (c?.viewedAt || c?.lastOpened || c?.opens > 0) return true;
  return false;
};

const firstOpenLogTime = (c) => {
  const log = Array.isArray(c?.openLog) ? c.openLog : [];
  for (const entry of log) {
    const t = parseDate(entry?.time || entry?.at || entry?.date);
    if (t) return t.toISOString();
  }
  return null;
};

const moneyLabel = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`;

/**
 * Build active notification cards (one per underlying object).
 * Auto-clears when the underlying condition resolves (paid, signed, booked, etc.).
 */
export function buildPhoneNotifications({
  invoices = [],
  events = [],
  leads = [],
  contracts = [],
  meetings = [],
  questionnaireInstances = [],
  requests = [],
  notifLog = [],
} = {}) {
  const today = startOfToday();
  const byObject = new Map(); // objectKey → card
  const logById = new Map((notifLog || []).map((e) => [e.id, e]));

  const put = (card) => {
    if (!card?.objectKey) return;
    const prev = byObject.get(card.objectKey);
    if (!prev || (card.priority || 0) > (prev.priority || 0)) {
      byObject.set(card.objectKey, card);
    }
  };

  // —— MONEY: overdue invoice OR balance due ≤7 days ——
  for (const inv of invoices || []) {
    if (!inv?.id) continue;
    if (inv.status === "Paid" || inv.status === "Draft") continue;
    const bal = invBalance(inv);
    if (bal <= 0.5) continue;
    const dueRaw = inv.due || inv.dueDate;
    const dueIn = daysUntil(dueRaw, today);
    const isOverdue = inv.status === "Overdue" || (dueIn != null && dueIn < 0);
    const dueSoon = dueIn != null && dueIn >= 0 && dueIn <= 7;
    if (!isOverdue && !dueSoon) continue;
    const dueTs = parseDate(dueRaw)?.toISOString() || logById.get(`money-inv-${inv.id}`)?.createdAt || null;
    put({
      id: `money-inv-${inv.id}`,
      objectKey: `invoice:${inv.id}`,
      category: "MONEY",
      priority: isOverdue ? 90 : 70,
      title: isOverdue ? "Invoice overdue" : "Balance due soon",
      body: [
        inv.client || inv.event || "Invoice",
        moneyLabel(bal) + " left",
        dueRaw ? (isOverdue ? `was due ${dueRaw}` : `due ${dueRaw}`) : null,
      ].filter(Boolean).join(" · "),
      createdAt: dueTs,
      section: inv.eventId != null ? "events" : "financials",
      eventId: inv.eventId ?? null,
    });
  }

  // Event-level balance due (when no matching invoice card already covers it)
  for (const ev of events || []) {
    if (!ev?.id) continue;
    const total = Number(ev.totalFee) || 0;
    const paid = (Number(ev.depositPaid) || 0) + (Number(ev.balancePaid) || 0);
    const bal = Math.max(0, total - paid);
    if (bal <= 0.5) continue;
    const dueRaw = ev.balanceDue || ev.depositDue;
    const dueIn = daysUntil(dueRaw, today);
    if (dueIn == null || dueIn > 7) continue;
    const hasInv = (invoices || []).some((i) => String(i.eventId) === String(ev.id) && invBalance(i) > 0.5);
    if (hasInv) continue;
    const isOverdue = dueIn < 0;
    put({
      id: `money-ev-${ev.id}`,
      objectKey: `event-balance:${ev.id}`,
      category: "MONEY",
      priority: isOverdue ? 85 : 65,
      title: isOverdue ? "Balance overdue" : "Balance due soon",
      body: [ev.client || ev.name || "Event", moneyLabel(bal) + " left", dueRaw ? `due ${dueRaw}` : null]
        .filter(Boolean).join(" · "),
      createdAt: parseDate(dueRaw)?.toISOString() || null,
      section: "events",
      eventId: ev.id,
    });
  }

  // —— LEAD: booking form / New Inquiry ——
  for (const lead of leads || []) {
    if (!lead?.id) continue;
    const stage = lead.stage || "";
    const source = lead.source || "";
    const isNewInquiry = stage === "New Inquiry";
    const isBookingForm = /booking\s*form/i.test(source);
    if (!isNewInquiry && !isBookingForm) continue;
    if (stage === "Booked" || stage === "Lost") continue;
    put({
      id: `lead-${lead.id}`,
      objectKey: `lead:${lead.id}`,
      category: "LEAD",
      priority: 80,
      title: isBookingForm ? "New booking-form lead" : "New inquiry",
      body: [lead.name || lead.client || "Lead", lead.event || lead.eventType || null, lead.date || null]
        .filter(Boolean).join(" · "),
      createdAt: parseDate(lead.createdAt || lead.last || lead.date)?.toISOString() || null,
      section: "leads",
      eventId: null,
      leadId: lead.id,
    });
  }

  // —— CONTRACT: viewed unsigned OR awaiting ≥3 days (one card per contract) ——
  for (const c of contracts || []) {
    if (!c?.id || contractIsSigned(c)) continue;
    if (c.status === "Cancelled" || c.status === "Expired" || c.status === "Draft") continue;
    const awaiting = c.status === "Awaiting Signature" || (!!c.sent && !contractIsSigned(c));
    if (!awaiting) continue;
    const viewed = contractWasViewed(c);
    const sentAt = parseDate(c.sent || c.sentAt || c.createdAt);
    const age = sentAt ? daysSince(sentAt, today) : null;
    const awaiting3 = age != null && age >= 3;
    if (!viewed && !awaiting3) continue;
    const title = viewed ? "Contract viewed — unsigned" : "Contract awaiting signature";
    const createdAt =
      (viewed && firstOpenLogTime(c))
      || sentAt?.toISOString()
      || null;
    put({
      id: `contract-${c.id}`,
      objectKey: `contract:${c.id}`,
      category: "CONTRACT",
      priority: viewed ? 88 : 75,
      title,
      body: [
        c.client || c.clientName || c.event || c.name || "Contract",
        awaiting3 && age != null ? `${age}d waiting` : null,
        viewed ? "Opened by client" : null,
      ].filter(Boolean).join(" · "),
      createdAt,
      section: c.eventId != null || c.linkedEventId != null ? "events" : "templates",
      eventId: c.eventId ?? c.linkedEventId ?? null,
    });
  }

  // —— SCHEDULING: booked / cancelled / rescheduled ——
  for (const m of meetings || []) {
    if (!m?.id) continue;
    const status = String(m.status || "scheduled").toLowerCase();
    const logEntry = logById.get(`meeting-${m.id}`);
    const createdAt =
      parseDate(m.updatedAt || m.rescheduledAt || m.cancelledAt || m.createdAt)?.toISOString()
      || logEntry?.createdAt
      || null;

    if (status === "cancelled") {
      put({
        id: `meeting-${m.id}`,
        objectKey: `meeting:${m.id}`,
        category: "SCHEDULING",
        priority: 82,
        title: "Meeting cancelled",
        body: [m.title || m.meetingTypeTitle || "Meeting", m.clientName || m.clientEmail || null, m.date || null]
          .filter(Boolean).join(" · "),
        createdAt,
        section: "meetings",
        eventId: m.eventId ?? null,
        meetingId: m.id,
      });
      continue;
    }

    if (status === "scheduled" || status === "confirmed") {
      const wasRescheduled =
        !!(m.rescheduledAt || m.rescheduled)
        || logEntry?.kind === "rescheduled"
        || (logEntry?.prevDate && m.date && String(logEntry.prevDate) !== String(m.date));
      const title = wasRescheduled ? "Meeting rescheduled" : "Meeting booked";
      // New bookings: prefer recent createdAt (≤14d) or log; always show rescheduled
      const age = daysSince(m.createdAt || createdAt, today);
      if (!wasRescheduled && age != null && age > 14) continue;
      put({
        id: `meeting-${m.id}`,
        objectKey: `meeting:${m.id}`,
        category: "SCHEDULING",
        priority: wasRescheduled ? 84 : 78,
        title,
        body: [
          m.title || m.meetingTypeTitle || "Meeting",
          m.clientName || m.clientEmail || null,
          m.date ? `${m.date}${m.startTime ? ` ${m.startTime}` : ""}` : null,
        ].filter(Boolean).join(" · "),
        createdAt,
        section: "meetings",
        eventId: m.eventId ?? null,
        meetingId: m.id,
      });
    }
  }

  // Log-only meeting events (e.g. cancelled then removed) — keep briefly if still in log
  for (const entry of notifLog || []) {
    if (!entry?.id || !String(entry.id).startsWith("meeting-")) continue;
    if (byObject.has(entry.objectKey || `meeting:${entry.meetingId}`)) continue;
    if (entry.kind !== "cancelled" && entry.kind !== "rescheduled") continue;
    const age = daysSince(entry.createdAt, today);
    if (age != null && age > 14) continue;
    put({
      id: entry.id,
      objectKey: entry.objectKey || entry.id,
      category: "SCHEDULING",
      priority: 70,
      title: entry.title || (entry.kind === "cancelled" ? "Meeting cancelled" : "Meeting rescheduled"),
      body: entry.body || "",
      createdAt: entry.createdAt || null,
      section: "meetings",
      eventId: entry.eventId ?? null,
      meetingId: entry.meetingId,
    });
  }

  // —— MUSIC / forms: questionnaire completed OR music form submitted ——
  for (const q of questionnaireInstances || []) {
    if (!q?.id) continue;
    const done = q.status === "Completed" || !!q.submittedAt;
    if (!done) continue;
    put({
      id: `quest-${q.id}`,
      objectKey: `questionnaire:${q.id}`,
      category: "MUSIC",
      priority: 72,
      title: "Questionnaire submitted",
      body: [q.client || q.name || "Client", q.event || null].filter(Boolean).join(" · "),
      createdAt: parseDate(q.submittedAt || q.updatedAt || q.completedAt)?.toISOString() || null,
      section: q.eventId != null ? "events" : "templates",
      eventId: q.eventId ?? null,
    });
  }

  for (const req of requests || []) {
    if (!req?.id) continue;
    // Guest song / music form rows often carry submittedAt
    if (!req.submittedAt && req.status !== "submitted" && !req.isNew) continue;
    put({
      id: `music-req-${req.id}`,
      objectKey: `music-request:${req.id}`,
      category: "MUSIC",
      priority: 68,
      title: "Music form submitted",
      body: [req.client || req.name || req.song || "Request", req.event || null].filter(Boolean).join(" · "),
      createdAt: parseDate(req.submittedAt || req.createdAt)?.toISOString() || null,
      section: req.eventId != null ? "events" : "djplanning",
      eventId: req.eventId ?? null,
    });
  }

  // Events whose portal music blob was updated (music.updatedAt / musicSubmittedAt)
  for (const ev of events || []) {
    if (!ev?.id || !ev.music) continue;
    const stamp = ev.music.submittedAt || ev.music.updatedAt || ev.musicSubmittedAt;
    if (!stamp) continue;
    const age = daysSince(stamp, today);
    if (age != null && age > 14) continue;
    put({
      id: `music-ev-${ev.id}`,
      objectKey: `event-music:${ev.id}`,
      category: "MUSIC",
      priority: 66,
      title: "Music form updated",
      body: [ev.client || ev.name || "Event", "Playlist / must-plays"].filter(Boolean).join(" · "),
      createdAt: parseDate(stamp)?.toISOString() || null,
      section: "events",
      eventId: ev.id,
    });
  }

  return Array.from(byObject.values()).sort((a, b) => {
    const ta = parseDate(a.createdAt)?.getTime() || 0;
    const tb = parseDate(b.createdAt)?.getTime() || 0;
    if (tb !== ta) return tb - ta;
    return (b.priority || 0) - (a.priority || 0);
  });
}

/**
 * Merge first-seen timestamps + meeting transition breadcrumbs into a persisted log.
 * Keeps the log small (active ids + recent meeting events).
 */
export function mergeNotificationLog(prevLog, cards, meetings = []) {
  const nowIso = new Date().toISOString();
  const prev = Array.isArray(prevLog) ? prevLog : [];
  const byId = new Map(prev.map((e) => [e.id, e]));

  for (const card of cards || []) {
    const existing = byId.get(card.id);
    if (!existing) {
      byId.set(card.id, {
        id: card.id,
        objectKey: card.objectKey,
        category: card.category,
        title: card.title,
        body: card.body,
        createdAt: card.createdAt || nowIso,
        firstSeenAt: nowIso,
        section: card.section,
        eventId: card.eventId ?? null,
        meetingId: card.meetingId,
        kind: card.title?.toLowerCase().includes("cancel")
          ? "cancelled"
          : card.title?.toLowerCase().includes("reschedul")
            ? "rescheduled"
            : "active",
      });
    } else if (!existing.createdAt && card.createdAt) {
      byId.set(card.id, { ...existing, createdAt: card.createdAt });
    }
  }

  // Track meeting date changes for reschedule detection on next build
  for (const m of meetings || []) {
    if (!m?.id) continue;
    const id = `meeting-${m.id}`;
    const existing = byId.get(id);
    if (existing?.prevDate && m.date && String(existing.prevDate) !== String(m.date)) {
      byId.set(id, {
        ...existing,
        kind: "rescheduled",
        prevDate: m.date,
        createdAt: nowIso,
        title: "Meeting rescheduled",
        body: [m.title || m.meetingTypeTitle || "Meeting", m.date].filter(Boolean).join(" · "),
        objectKey: `meeting:${m.id}`,
        category: "SCHEDULING",
        section: "meetings",
        meetingId: m.id,
      });
    } else if (!existing) {
      byId.set(id, {
        id,
        objectKey: `meeting:${m.id}`,
        category: "SCHEDULING",
        prevDate: m.date || null,
        firstSeenAt: nowIso,
        createdAt: parseDate(m.createdAt)?.toISOString() || nowIso,
        kind: String(m.status || "").toLowerCase() === "cancelled" ? "cancelled" : "active",
        meetingId: m.id,
      });
    } else if (existing.prevDate == null && m.date) {
      byId.set(id, { ...existing, prevDate: m.date });
    } else if (String(m.status || "").toLowerCase() === "cancelled" && existing.kind !== "cancelled") {
      byId.set(id, {
        ...existing,
        kind: "cancelled",
        createdAt: nowIso,
        title: "Meeting cancelled",
        body: [m.title || m.meetingTypeTitle || "Meeting", m.date].filter(Boolean).join(" · "),
      });
    }
  }

  // Drop stale entries older than 60 days that are not in the current card set
  const activeIds = new Set((cards || []).map((c) => c.id));
  const cutoff = Date.now() - 60 * MS_DAY;
  const next = Array.from(byId.values()).filter((e) => {
    if (activeIds.has(e.id)) return true;
    if (e.kind === "cancelled" || e.kind === "rescheduled") {
      const t = parseDate(e.createdAt)?.getTime() || 0;
      return t >= cutoff;
    }
    // Keep prevDate breadcrumbs for known meetings briefly
    if (e.meetingId && e.prevDate) {
      const t = parseDate(e.firstSeenAt || e.createdAt)?.getTime() || 0;
      return t >= cutoff;
    }
    return false;
  });

  return next;
}

/** Apply persisted firstSeenAt when card lacks a real timestamp (never invent relative "2h ago"). */
export function attachLogTimestamps(cards, notifLog = []) {
  const byId = new Map((notifLog || []).map((e) => [e.id, e]));
  return (cards || []).map((c) => {
    if (c.createdAt) return c;
    const log = byId.get(c.id);
    if (log?.createdAt || log?.firstSeenAt) {
      return { ...c, createdAt: log.createdAt || log.firstSeenAt };
    }
    return c;
  });
}

export function loadPhoneNotifRead() {
  try {
    const raw = localStorage.getItem(READ_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function savePhoneNotifRead(map) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(map || {}));
  } catch { /* ignore quota */ }
}

export function isNotifRead(card, readMap) {
  if (!card?.id || !readMap) return false;
  return !!readMap[card.id];
}

export function markAllNotifsRead(cards, readMap = {}) {
  const next = { ...readMap };
  const now = new Date().toISOString();
  for (const c of cards || []) {
    if (c?.id) next[c.id] = now;
  }
  return next;
}

export function groupNotifsTodayEarlier(cards, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const today = [];
  const earlier = [];
  for (const c of cards || []) {
    const t = parseDate(c.createdAt);
    if (t && t >= start) today.push(c);
    else earlier.push(c);
  }
  return { today, earlier };
}

/** Format a real timestamp only — returns "" if missing (never fake relative time). */
export function formatNotifWhen(iso) {
  const d = parseDate(iso);
  if (!d) return "";
  const today = startOfToday();
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today - day) / MS_DAY);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (diff === 0) return time;
  if (diff === 1) return `Yesterday · ${time}`;
  if (diff < 7) {
    return `${d.toLocaleDateString("en-US", { weekday: "short" })} · ${time}`;
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
