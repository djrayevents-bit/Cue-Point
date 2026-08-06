/**
 * CuePoint Automations engine (V1)
 * Client-side scan + idempotent sends via /api/send-email.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const mergeAutomationText = (text, vars = {}) => {
  if (!text) return "";
  let out = String(text);
  const pairs = [
    ["Client Name", vars.clientName],
    ["Event Name", vars.eventName],
    ["Event Date", vars.eventDate],
    ["Venue Name", vars.venueName],
    ["DJ Name", vars.djName],
    ["Due Date", vars.dueDate],
    ["Portal Link", vars.portalLink],
    ["Business Name", vars.businessName],
    ["{{client_name}}", vars.clientFirst || vars.clientName],
    ["{{client_full_name}}", vars.clientName],
    ["{{event_name}}", vars.eventName],
    ["{{event_date}}", vars.eventDate],
    ["{{venue}}", vars.venueName],
    ["{{dj_name}}", vars.djName],
    ["{{due_date}}", vars.dueDate],
    ["{{portal_link}}", vars.portalLink],
    ["{{business_name}}", vars.businessName],
  ];
  for (const [token, val] of pairs) {
    if (val == null || val === "") continue;
    out = out.split(token).join(String(val));
  }
  return out;
};

export const automationRunKey = (automationId, trigger, entityType, entityId, bucket = "once") =>
  `${automationId}:${trigger}:${entityType}:${entityId}:${bucket}`;

const todayISO = () => new Date().toISOString().slice(0, 10);

const parseDateOnly = (ds) => {
  if (!ds) return null;
  const s = String(ds).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + "T12:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
};

const daysUntil = (dateStr) => {
  const d = parseDateOnly(dateStr);
  if (!d) return null;
  const today = parseDateOnly(todayISO());
  return Math.round((d - today) / DAY_MS);
};

const entityEmail = (entity, type) => {
  if (!entity) return "";
  if (type === "lead") return String(entity.email || entity.clientEmail || "").trim();
  if (type === "event") {
    const fromContact = (entity.contacts || []).map((c) => c?.email).find(Boolean);
    return String(entity.clientEmail || entity.email || fromContact || "").trim();
  }
  if (type === "contract") return String(entity.email || entity.clientEmail || "").trim();
  if (type === "invoice") return String(entity.email || entity.clientEmail || "").trim();
  if (type === "questionnaire") return String(entity.clientEmail || entity.email || "").trim();
  return "";
};

const buildVars = ({ entity, type, profile, events, portalLink }) => {
  const djName = profile?.djName || profile?.businessName || profile?.fullName || "Your DJ";
  const businessName = profile?.businessName || djName;
  let clientName = "";
  let eventName = "";
  let eventDate = "";
  let venueName = "";
  let dueDate = "";

  if (type === "lead") {
    clientName = entity.name || entity.client || "";
    eventName = entity.event || entity.eventType || "your event";
    eventDate = entity.eventDate || entity.date || "";
    venueName = entity.venue || "";
  } else if (type === "event") {
    clientName = entity.client || "";
    eventName = entity.name || "";
    eventDate = entity.date || "";
    venueName = entity.venue || "";
  } else if (type === "contract") {
    clientName = entity.client || "";
    eventName = entity.event || entity.eventName || "";
    eventDate = entity.eventDate || "";
    const ev = (events || []).find((e) => String(e.id) === String(entity.eventId || entity.linkedEventId));
    if (ev) {
      venueName = ev.venue || "";
      if (!eventDate) eventDate = ev.date || "";
      if (!clientName) clientName = ev.client || "";
    }
  } else if (type === "invoice") {
    clientName = entity.client || "";
    eventName = entity.event || entity.eventName || "";
    dueDate = entity.due || entity.dueDate || "";
    const ev = (events || []).find((e) => String(e.id) === String(entity.eventId || entity.linkedEventId));
    if (ev) {
      venueName = ev.venue || "";
      eventDate = ev.date || "";
      if (!clientName) clientName = ev.client || "";
      if (!eventName) eventName = ev.name || "";
    }
  } else if (type === "questionnaire") {
    clientName = entity.client || "";
    eventName = entity.event || "";
    const ev = (events || []).find((e) => String(e.id) === String(entity.eventId));
    if (ev) {
      eventDate = ev.date || "";
      venueName = ev.venue || "";
      if (!clientName) clientName = ev.client || "";
      if (!eventName) eventName = ev.name || "";
    }
  }

  const clientFirst = clientName ? String(clientName).split(" ")[0] : "there";
  return {
    clientName: clientName || "there",
    clientFirst,
    eventName: eventName || "your event",
    eventDate: eventDate || "your event date",
    venueName: venueName || "the venue",
    djName,
    businessName,
    dueDate: dueDate || "the due date",
    portalLink: portalLink || "",
  };
};

const IMMEDIATE_TRIGGERS = new Set([
  "lead_added",
  "event_created",
  "contract_sent",
  "contract_signed",
  "invoice_sent",
  "invoice_paid",
  "questionnaire_done",
]);

const entityCreatedMs = (entity) => {
  const raw = entity?.createdAt || entity?.created || entity?.addedAt || null;
  if (raw) {
    const t = new Date(raw).getTime();
    if (!Number.isNaN(t)) return t;
  }
  // Many CuePoint ids are Date.now() at create time
  const idNum = Number(entity?.id);
  if (Number.isFinite(idNum) && idNum > 1e12) return idNum;
  return null;
};

/**
 * Collect candidate firings for one automation against current CRM data.
 */
export const collectAutomationCandidates = (auto, ctx) => {
  if (!auto?.enabled || auto.action === "send_sms") return [];
  const {
    events = [],
    leads = [],
    contracts = [],
    invoices = [],
    questionnaireInstances = [],
  } = ctx;
  const trigger = auto.trigger;
  const out = [];
  const enabledMs = auto.enabledAt ? new Date(auto.enabledAt).getTime() : null;

  const push = (entityType, entity, bucket = "once") => {
    if (IMMEDIATE_TRIGGERS.has(trigger) && enabledMs && !Number.isNaN(enabledMs)) {
      const created = entityCreatedMs(entity);
      // Skip historical rows when we know they predate enable (prevents backfill spam).
      if (created != null && created < enabledMs) return;
    }
    out.push({
      entityType,
      entityId: entity.id,
      entity,
      bucket,
    });
  };

  if (trigger === "lead_added") {
    (leads || []).forEach((l) => push("lead", l));
  } else if (trigger === "event_created") {
    (events || []).forEach((e) => push("event", e));
  } else if (trigger === "contract_sent") {
    (contracts || [])
      .filter((c) => c.status === "Awaiting Signature" || c.status === "Sent" || c.djSigned)
      .forEach((c) => push("contract", c));
  } else if (trigger === "contract_signed") {
    (contracts || []).filter((c) => c.status === "Signed").forEach((c) => push("contract", c));
  } else if (trigger === "invoice_sent") {
    (invoices || [])
      .filter((i) => i.status === "Unpaid" || i.status === "Sent" || i.status === "Partial")
      .forEach((i) => push("invoice", i));
  } else if (trigger === "invoice_paid") {
    (invoices || []).filter((i) => i.status === "Paid").forEach((i) => push("invoice", i));
  } else if (trigger === "questionnaire_done") {
    (questionnaireInstances || [])
      .filter((q) => q.status === "Completed")
      .forEach((q) => push("questionnaire", q));
  } else if (trigger === "event_7d") {
    (events || [])
      .filter((e) => ["Confirmed", "Pending"].includes(e.status) && daysUntil(e.date) === 7)
      .forEach((e) => push("event", e, e.date || todayISO()));
  } else if (trigger === "event_1d") {
    (events || [])
      .filter((e) => ["Confirmed", "Pending"].includes(e.status) && daysUntil(e.date) === 1)
      .forEach((e) => push("event", e, e.date || todayISO()));
  } else if (trigger === "event_completed") {
    (events || [])
      .filter((e) => ["Confirmed", "Pending"].includes(e.status) && daysUntil(e.date) != null && daysUntil(e.date) < 0)
      .forEach((e) => push("event", e, e.date || "past"));
  } else if (trigger === "invoice_overdue") {
    (invoices || [])
      .filter((i) => {
        if (i.status === "Paid") return false;
        if (i.status === "Overdue") return true;
        const due = i.due || i.dueDate;
        const d = daysUntil(due);
        return d != null && d < 0;
      })
      .forEach((i) => push("invoice", i, (i.due || i.dueDate || todayISO())));
  }

  return out;
};

/**
 * Resolve portal link for questionnaire / portal nudges when possible.
 */
export const resolvePortalLinkForEntity = (entity, type, ctx) => {
  const { profile, portalTokens, setPortalTokens, getEventPortalShareUrl } = ctx;
  if (typeof getEventPortalShareUrl !== "function") return "";
  let eventId = null;
  if (type === "event") eventId = entity.id;
  else if (type === "contract") eventId = entity.eventId ?? entity.linkedEventId;
  else if (type === "questionnaire") eventId = entity.eventId;
  else if (type === "invoice") eventId = entity.eventId ?? entity.linkedEventId;
  if (eventId == null || eventId === "") return "";
  try {
    return getEventPortalShareUrl(profile, eventId, portalTokens, setPortalTokens) || "";
  } catch {
    return "";
  }
};

/**
 * Mark current candidates as already handled so enabling rules / first install
 * does not backfill-spam historical leads/events. Returns merged runs map.
 */
export function seedBaselineAutomationRuns(automations, ctx, existingRuns = {}) {
  const runs = { ...(existingRuns || {}) };
  const stamp = new Date().toISOString();
  for (const auto of automations || []) {
    if (!auto?.enabled || auto.action === "send_sms") continue;
    const candidates = collectAutomationCandidates(auto, ctx);
    for (const cand of candidates) {
      const key = automationRunKey(auto.id, auto.trigger, cand.entityType, cand.entityId, cand.bucket);
      if (!runs[key]) runs[key] = stamp;
    }
  }
  return runs;
}

/**
 * Run all enabled automations once. Mutates persistence via callbacks.
 * Returns summary { ran, sent, skipped, failed, logs[] }.
 */
export async function runAutomationScan({
  automations,
  automationRuns,
  setAutomationRuns,
  setAutomations,
  setAutomationRunLog,
  setDashboardTodos,
  setEvents,
  setLeads,
  sendClientEmail,
  setEmailSendLog,
  profile,
  events,
  leads,
  contracts,
  invoices,
  questionnaireInstances,
  portalTokens,
  setPortalTokens,
  getEventPortalShareUrl,
  pausedAll,
}) {
  const summary = { ran: 0, sent: 0, skipped: 0, failed: 0, logs: [] };
  if (pausedAll) return summary;

  const list = (automations && automations.length > 0) ? automations : [];
  const runs = { ...(automationRuns || {}) };
  const nowIso = new Date().toISOString();

  const appendLog = (entry) => {
    summary.logs.push(entry);
    if (typeof setAutomationRunLog === "function") {
      setAutomationRunLog((prev) => [entry, ...(Array.isArray(prev) ? prev : [])].slice(0, 300));
    }
  };

  const markRun = (key) => {
    runs[key] = nowIso;
  };

  for (const auto of list) {
    if (!auto.enabled) continue;
    if (auto.action === "send_sms") continue;

    const candidates = collectAutomationCandidates(auto, {
      events, leads, contracts, invoices, questionnaireInstances,
    });

    for (const cand of candidates) {
      summary.ran += 1;
      const key = automationRunKey(auto.id, auto.trigger, cand.entityType, cand.entityId, cand.bucket);
      if (runs[key]) {
        // Idempotent hits are counted but not logged (would flood the run log on every scan).
        summary.skipped += 1;
        continue;
      }

      const portalLink = resolvePortalLinkForEntity(cand.entity, cand.entityType, {
        profile, portalTokens, setPortalTokens, getEventPortalShareUrl,
      });
      const vars = buildVars({
        entity: cand.entity,
        type: cand.entityType,
        profile,
        events,
        portalLink,
      });

      // Action: send_questionnaire requires portal link → email it
      let action = auto.action;
      let template = auto.template || { subject: "", body: "" };
      if (action === "send_questionnaire") {
        if (!portalLink) {
          summary.skipped += 1;
          appendLog({
            id: `arl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            automationId: auto.id,
            automationName: auto.name,
            trigger: auto.trigger,
            action,
            entityType: cand.entityType,
            entityId: cand.entityId,
            status: "skipped",
            error: "no portal link",
            timestamp: nowIso,
          });
          continue;
        }
        action = "send_email";
        template = {
          subject: template.subject || "Your event questionnaire",
          body: template.body || `Hi Client Name,\n\nPlease fill out your questionnaire here:\nPortal Link\n\nThanks!\nDJ Name`,
        };
      }
      if (action === "send_invoice") {
        action = "send_email";
        template = {
          subject: template.subject || "Invoice reminder — Event Name",
          body: template.body || `Hi Client Name,\n\nFriendly reminder about your invoice for Event Name. Due Date: Due Date.\n\nDJ Name`,
        };
      }

      const subject = mergeAutomationText(template.subject || auto.name || "Message from your DJ", vars);
      const body = mergeAutomationText(template.body || "", vars);
      const to = entityEmail(cand.entity, cand.entityType);

      try {
        if (action === "send_email") {
          if (!to || !to.includes("@")) {
            summary.skipped += 1;
            appendLog({
              id: `arl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              automationId: auto.id,
              automationName: auto.name,
              trigger: auto.trigger,
              action,
              entityType: cand.entityType,
              entityId: cand.entityId,
              status: "skipped",
              error: "no recipient email",
              timestamp: nowIso,
            });
            continue;
          }
          const result = await sendClientEmail({
            to,
            subject,
            text: body,
            context: {
              source: "automation",
              automationId: auto.id,
              trigger: auto.trigger,
              entityType: cand.entityType,
              entityId: cand.entityId,
            },
            setEmailSendLog,
          });
          if (!result.ok) {
            summary.failed += 1;
            appendLog({
              id: `arl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              automationId: auto.id,
              automationName: auto.name,
              trigger: auto.trigger,
              action,
              entityType: cand.entityType,
              entityId: cand.entityId,
              to,
              subject,
              status: "failed",
              error: result.error || "send failed",
              timestamp: nowIso,
            });
            continue;
          }
          markRun(key);
          summary.sent += 1;
          if (typeof setAutomations === "function") {
            setAutomations((prev) => (prev || []).map((a) =>
              String(a.id) === String(auto.id)
                ? { ...a, runCount: (Number(a.runCount) || 0) + 1, lastRunAt: nowIso }
                : a
            ));
          }
          appendLog({
            id: `arl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            automationId: auto.id,
            automationName: auto.name,
            trigger: auto.trigger,
            action,
            entityType: cand.entityType,
            entityId: cand.entityId,
            to,
            subject,
            status: "sent",
            timestamp: nowIso,
          });
        } else if (action === "create_task") {
          const title = subject || body.slice(0, 80) || auto.name;
          if (typeof setDashboardTodos === "function") {
            setDashboardTodos((prev) => [{
              id: Date.now() + Math.random(),
              title,
              notes: body,
              priority: "Normal",
              dueDate: "",
              eventId: cand.entityType === "event" ? cand.entityId : (cand.entity?.eventId || ""),
              completedAt: null,
              source: "automation",
              automationId: auto.id,
            }, ...(prev || [])]);
          }
          markRun(key);
          summary.sent += 1;
          if (typeof setAutomations === "function") {
            setAutomations((prev) => (prev || []).map((a) =>
              String(a.id) === String(auto.id)
                ? { ...a, runCount: (Number(a.runCount) || 0) + 1, lastRunAt: nowIso }
                : a
            ));
          }
          appendLog({
            id: `arl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            automationId: auto.id,
            automationName: auto.name,
            trigger: auto.trigger,
            action,
            entityType: cand.entityType,
            entityId: cand.entityId,
            subject: title,
            status: "sent",
            timestamp: nowIso,
          });
        } else if (action === "internal_note") {
          const note = body || subject || auto.name;
          const stamp = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          if (cand.entityType === "event" && typeof setEvents === "function") {
            setEvents((prev) => (prev || []).map((e) => String(e.id) === String(cand.entityId)
              ? { ...e, notes: [e.notes, `[Automation] ${note} (${stamp})`].filter(Boolean).join("\n") }
              : e));
          } else if (cand.entityType === "lead" && typeof setLeads === "function") {
            setLeads((prev) => (prev || []).map((l) => String(l.id) === String(cand.entityId)
              ? { ...l, note: [l.note, `[Automation] ${note} (${stamp})`].filter(Boolean).join("\n") }
              : l));
          } else {
            summary.skipped += 1;
            appendLog({
              id: `arl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              automationId: auto.id,
              automationName: auto.name,
              trigger: auto.trigger,
              action,
              entityType: cand.entityType,
              entityId: cand.entityId,
              status: "skipped",
              error: "unsupported entity for note",
              timestamp: nowIso,
            });
            continue;
          }
          markRun(key);
          summary.sent += 1;
          if (typeof setAutomations === "function") {
            setAutomations((prev) => (prev || []).map((a) =>
              String(a.id) === String(auto.id)
                ? { ...a, runCount: (Number(a.runCount) || 0) + 1, lastRunAt: nowIso }
                : a
            ));
          }
          appendLog({
            id: `arl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            automationId: auto.id,
            automationName: auto.name,
            trigger: auto.trigger,
            action,
            entityType: cand.entityType,
            entityId: cand.entityId,
            subject: note.slice(0, 80),
            status: "sent",
            timestamp: nowIso,
          });
        } else {
          summary.skipped += 1;
          appendLog({
            id: `arl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            automationId: auto.id,
            automationName: auto.name,
            trigger: auto.trigger,
            action,
            entityType: cand.entityType,
            entityId: cand.entityId,
            status: "skipped",
            error: "action not supported",
            timestamp: nowIso,
          });
        }
      } catch (err) {
        summary.failed += 1;
        appendLog({
          id: `arl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          automationId: auto.id,
          automationName: auto.name,
          trigger: auto.trigger,
          action: auto.action,
          entityType: cand.entityType,
          entityId: cand.entityId,
          status: "failed",
          error: err?.message || "unexpected error",
          timestamp: nowIso,
        });
      }
    }
  }

  if (typeof setAutomationRuns === "function") {
    setAutomationRuns(runs);
  }
  return summary;
}
