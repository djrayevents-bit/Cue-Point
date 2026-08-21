/**
 * Automations list + create/edit modal — matches CuePoint design mockups.
 */
import React, { useEffect, useState } from "react";
import {
  BRAND_FONT, BRAND_RADIUS, BRAND_ACCENT, BRAND_ACCENT_SOFT, TYPE, LIGHT_THEME,
} from "./brand";
import { mergeAutomationText, runAutomationScan, seedBaselineAutomationRuns } from "./automationEngine";

const C = LIGHT_THEME;

/* ---------- icons (inline SVG) ---------- */
const Ico = ({ children, size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
const IconBolt = (p) => <Ico {...p}><path d="M13 2L4 14h7l-1 8 10-14h-7l1-6z" fill={p.color || "currentColor"} stroke="none" /></Ico>;
const IconMail = (p) => <Ico {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 7 9-7" /></Ico>;
const IconClock = (p) => <Ico {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Ico>;
const IconSms = (p) => <Ico {...p}><path d="M21 11a7 7 0 01-7 7H7l-4 3V11a7 7 0 017-7h4a7 7 0 017 7z" /></Ico>;
const IconTask = (p) => <Ico {...p}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></Ico>;
const IconPlus = (p) => <Ico {...p}><path d="M12 5v14M5 12h14" /></Ico>;

const ROW_ICON = {
  send_email: { bg: "#E8F8EF", fg: "#2FBF6B", node: <IconMail size={16} color="#2FBF6B" /> },
  send_questionnaire: { bg: "#E8F8EF", fg: "#2FBF6B", node: <IconMail size={16} color="#2FBF6B" /> },
  send_invoice: { bg: "#FFF4E8", fg: "#EA580C", node: <IconMail size={16} color="#EA580C" /> },
  send_sms: { bg: "#EFEBFF", fg: BRAND_ACCENT, node: <IconSms size={16} color={BRAND_ACCENT} /> },
  email_sms: { bg: "#E8F4FC", fg: "#2563EB", node: <IconMail size={16} color="#2563EB" /> },
  create_task: { bg: "#FFF4E8", fg: "#EA580C", node: <IconTask size={16} color="#EA580C" /> },
  internal_note: { bg: "#F4F4F8", fg: "#8E8E93", node: <IconTask size={16} color="#8E8E93" /> },
};

/* ---------- data ---------- */
export const AUTO_EVENT_TYPE_OPTIONS = [
  { id: "all", label: "Every event" },
  { id: "Wedding", label: "Weddings" },
  { id: "Corporate", label: "Corporate" },
  { id: "Quinceañera", label: "Quinceañera & Sweet 16" },
  { id: "Private Party", label: "Private Parties" },
];

const TRIGGERS = [
  { id: "contract_signed", label: "Contract signed", desc: "The moment a client e-signs", group: "Contracts", ui: true },
  { id: "payment_received", label: "Payment received", desc: "Deposit or balance clears", group: "Invoices", ui: true },
  { id: "days_before_event", label: "Days before the event", desc: "Countdown from event date", group: "Events", ui: true, needsDays: true, defaultDays: 14 },
  { id: "days_after_event", label: "Days after the event", desc: "Follow-up window", group: "Events", ui: true, needsDays: true, defaultDays: 2 },
  { id: "balance_due_days", label: "Balance due date", desc: "Relative to the invoice due date", group: "Invoices", ui: true, needsDays: true, defaultDays: 14, daysLabel: "How many days before due?" },
  { id: "lead_no_reply", label: "New inquiry, no reply", desc: "Lead goes cold", group: "Leads", ui: true, needsDays: true, defaultDays: 1, daysLabel: "Days with no reply" },
  { id: "event_created", label: "Event is created", group: "Events" },
  { id: "event_7d", label: "7 days before event", group: "Events" },
  { id: "event_1d", label: "1 day before event", group: "Events" },
  { id: "event_completed", label: "Event date passes", group: "Events" },
  { id: "contract_sent", label: "Contract is sent", group: "Contracts" },
  { id: "invoice_sent", label: "Invoice is sent", group: "Invoices" },
  { id: "invoice_overdue", label: "Invoice becomes overdue", group: "Invoices" },
  { id: "invoice_paid", label: "Invoice is paid", group: "Invoices" },
  { id: "lead_added", label: "New lead is added", group: "Leads" },
  { id: "questionnaire_done", label: "Questionnaire is submitted", group: "Planning" },
];

const AUTO_ACTIONS = [
  { id: "send_email", label: "Send an email", short: "EMAIL", hasTemplate: true, live: true, ui: true, icon: "mail" },
  { id: "send_sms", label: "Send a text", short: "SMS", hasTemplate: true, live: false, badge: "Coming later", ui: true, icon: "sms" },
  { id: "email_sms", label: "Email + text", short: "EMAIL + SMS", hasTemplate: true, live: true, ui: true, mapsTo: "send_email", icon: "both" },
  { id: "create_task", label: "Create a task", short: "TASK", hasTemplate: true, live: true, ui: true, icon: "task" },
  { id: "internal_note", label: "Add internal note", short: "NOTE", hasTemplate: true, live: true },
  { id: "send_questionnaire", label: "Email portal questionnaire link", short: "EMAIL", hasTemplate: true, live: true },
  { id: "send_invoice", label: "Email invoice reminder", short: "EMAIL", hasTemplate: true, live: true },
];

const AUTO_TEMPLATE_PRESETS = [
  {
    id: "welcome",
    label: "Welcome & next steps",
    subject: "You're booked — next steps for {event_name}",
    body: "Hi {client_first_name},\n\nExcited to be your DJ for {event_name}! Here's what happens next, and your client portal link:\n{portal_link}\n\nTalk soon,\n{dj_name}",
  },
  {
    id: "balance",
    label: "Balance reminder",
    subject: "Friendly reminder — balance for {event_name}",
    body: "Hi {client_first_name} — we're {days_until_event} days out from {event_name}. Your remaining balance is due soon ({due_date}). Reply if you have any questions!\n\n{dj_name}",
  },
  {
    id: "questionnaire",
    label: "Planning questionnaire",
    subject: "Planning questionnaire for {event_name}",
    body: "Hi {client_first_name} — we're {days_until_event} days out from {event_name}. Here's what I need from you before we lock things in:\n{portal_link}\n\nThanks!\n{dj_name}",
  },
  {
    id: "review",
    label: "Review request",
    subject: "Thank you — how was {event_name}?",
    body: "Hi {client_first_name},\n\nThank you so much for having me at {event_name}! If you have a moment, a quick review would mean the world.\n\n{dj_name}",
  },
];

const AUTOMATION_LIBRARY = [
  {
    name: "Gear pack checklist",
    desc: "Notify team 3 days before event",
    trigger: "days_before_event",
    triggerDays: 3,
    action: "create_task",
    eventTypes: ["all"],
    template: { subject: "Pack gear", body: "Pack and confirm gear for {event_name} at {venue}." },
  },
  {
    name: "Deposit receipt",
    desc: "Send receipt upon payment",
    trigger: "payment_received",
    action: "send_email",
    eventTypes: ["all"],
    template: AUTO_TEMPLATE_PRESETS[0],
  },
  {
    name: "Song list lock",
    desc: "Freeze requests 7 days before event",
    trigger: "days_before_event",
    triggerDays: 7,
    action: "send_email",
    eventTypes: ["Wedding"],
    template: {
      subject: "Song list lock — {event_name}",
      body: "Hi {client_first_name} — we're a week out from {event_name}. Please finalize must-plays and do-not-plays in your portal:\n{portal_link}\n\n{dj_name}",
    },
  },
  {
    name: "Anniversary note",
    desc: "Email clients a first-dance clip 1 year after the event",
    trigger: "days_after_event",
    triggerDays: 365,
    action: "send_email",
    eventTypes: ["Wedding"],
    template: {
      subject: "Happy anniversary — {event_name}",
      body: "Hi {client_first_name},\n\nHard to believe it's been a year since {event_name}. Congrats again — and thank you for letting me be part of it.\n\n{dj_name}",
    },
  },
];

const EMAIL_TEMPLATES = {
  event_created: { send_email: { subject: "Your booking is confirmed!", body: "Hi Client Name,\n\nExcited to be your DJ for Event Name on Event Date!\n\nDJ Name" } },
  days_before_event: { send_email: AUTO_TEMPLATE_PRESETS[2], send_questionnaire: AUTO_TEMPLATE_PRESETS[2] },
  days_after_event: { send_email: AUTO_TEMPLATE_PRESETS[3] },
  balance_due_days: { send_email: AUTO_TEMPLATE_PRESETS[1], send_invoice: AUTO_TEMPLATE_PRESETS[1] },
  payment_received: { send_email: { subject: "Payment received — thank you!", body: "Hi Client Name,\n\nPayment received — you're all set for Event Name!\n\nDJ Name" } },
  lead_no_reply: { send_email: { subject: "Following up on your inquiry", body: "Hi Client Name,\n\nJust bumping this — happy to answer any questions about Event Name.\n\nDJ Name" } },
  contract_signed: {
    send_email: { subject: "Next step — your questionnaire", body: "Hi Client Name,\n\nThanks for signing! Questionnaire:\nPortal Link\n\nDJ Name" },
    send_questionnaire: { subject: "Your event questionnaire", body: "Hi Client Name,\n\nPlease fill out your questionnaire for Event Name:\nPortal Link\n\nDJ Name" },
  },
  event_1d: { send_sms: { subject: "", body: "Hi Client Name! Tomorrow is Event Name — so excited! - DJ Name" } },
  invoice_paid: { send_email: { subject: "Payment received — thank you!", body: "Hi Client Name,\n\nPayment received — you're all set!\n\nDJ Name" } },
};

const DEFAULT_AUTOMATIONS = [
  { id: 1, name: "Booking confirmation", trigger: "contract_signed", action: "send_email", enabled: true, eventTypes: ["all"], template: EMAIL_TEMPLATES.contract_signed.send_email, runCount: 34 },
  { id: 2, name: "Balance reminder", trigger: "balance_due_days", triggerDays: 14, action: "email_sms", enabled: true, eventTypes: ["all"], template: AUTO_TEMPLATE_PRESETS[1], runCount: 56 },
  { id: 3, name: "Day-before check-in", trigger: "days_before_event", triggerDays: 1, action: "send_sms", enabled: true, eventTypes: ["all"], template: EMAIL_TEMPLATES.event_1d.send_sms, runCount: 28 },
  { id: 4, name: "Lead follow-up", trigger: "lead_no_reply", triggerDays: 1, action: "send_email", enabled: true, eventTypes: ["all"], template: EMAIL_TEMPLATES.lead_no_reply.send_email, runCount: 41 },
  { id: 5, name: "Planning form nudge", trigger: "days_before_event", triggerDays: 30, action: "send_email", enabled: true, eventTypes: ["Wedding"], template: AUTO_TEMPLATE_PRESETS[2], runCount: 12 },
  { id: 6, name: "Special songs confirm", trigger: "days_before_event", triggerDays: 14, action: "send_email", enabled: false, eventTypes: ["Wedding"], template: { subject: "Special songs for {event_name}", body: "Hi {client_first_name} — please confirm first dance / entrance songs:\n{portal_link}\n\n{dj_name}" }, runCount: 9 },
  { id: 7, name: "Post-event thank you", trigger: "days_after_event", triggerDays: 2, action: "send_email", enabled: true, eventTypes: ["all"], template: AUTO_TEMPLATE_PRESETS[3], runCount: 22 },
];

export const ensureAutomationsSeeded = (list) => {
  if (Array.isArray(list) && list.length > 0) {
    return list.map((a) => ({
      ...a,
      eventTypes: Array.isArray(a.eventTypes) && a.eventTypes.length ? a.eventTypes : ["all"],
      template: { ...(a.template || {}) },
    }));
  }
  const now = new Date().toISOString();
  return DEFAULT_AUTOMATIONS.map((a) => ({ ...a, template: { ...(a.template || {}) }, enabledAt: a.enabledAt || now }));
};

const triggerMeta = (id) => TRIGGERS.find((t) => t.id === id) || { id, label: id, group: "Events" };
export const triggerLabel = (id, days) => {
  const t = triggerMeta(id);
  if (id === "days_before_event" && days != null) return `${days} day${Number(days) === 1 ? "" : "s"} before the event`;
  if (id === "days_after_event" && days != null) return `${days} day${Number(days) === 1 ? "" : "s"} after the event`;
  if (id === "balance_due_days" && days != null) return `${days} day${Number(days) === 1 ? "" : "s"} before balance due`;
  if (id === "lead_no_reply" && days != null) return `No reply after ${days} day${Number(days) === 1 ? "" : "s"}`;
  return t.label;
};
const actionLabel = (id) => AUTO_ACTIONS.find((a) => a.id === id)?.label || id;
const actionChannel = (id) => {
  if (id === "email_sms") return "EMAIL + SMS";
  return AUTO_ACTIONS.find((a) => a.id === id)?.short || "AUTO";
};
const resolveAutoAction = (id) => AUTO_ACTIONS.find((x) => x.id === id)?.mapsTo || id;

const eventTypeGroupLabel = (types) => {
  const t = Array.isArray(types) && types.length ? types : ["all"];
  if (t.includes("all") || t.includes("Every event")) return "ALL EVENT TYPES";
  if (t.some((x) => /wedding/i.test(x))) return "WEDDINGS";
  if (t.some((x) => /corporate/i.test(x))) return "CORPORATE";
  if (t.some((x) => /quince|sweet/i.test(x))) return "QUINCEAÑERA";
  if (t.some((x) => /party|birthday|private/i.test(x))) return "PARTIES";
  return String(t[0] || "OTHER").toUpperCase();
};

const formatAutoTime = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const yest = new Date(now); yest.setDate(now.getDate() - 1);
    const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    if (sameDay) return `Today, ${time}`;
    if (d.toDateString() === yest.toDateString()) return `Yesterday, ${time}`;
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return ""; }
};

const relativeAgo = (iso) => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  const days = Math.floor(ms / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 14) return `${days} days ago`;
  return formatAutoTime(iso);
};

const thenCopy = (auto) => {
  if (auto.action === "send_email" || auto.action === "send_questionnaire" || auto.action === "send_invoice") {
    return auto.template?.subject ? `Send email — ${auto.template.subject.split("—")[0].trim()}` : "Send an email";
  }
  if (auto.action === "email_sms") return "Send invoice reminder";
  if (auto.action === "send_sms") return "Text client load-in details";
  if (auto.action === "create_task") return "Create a task";
  return actionLabel(auto.action);
};

const PurpleToggle = ({ on, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={on}
    style={{
      width: 46, height: 28, borderRadius: 999, border: "none", padding: 0, flexShrink: 0,
      cursor: disabled ? "not-allowed" : "pointer",
      background: on ? BRAND_ACCENT : "#D1D1D6",
      position: "relative", opacity: disabled ? 0.45 : 1,
      transition: "background 0.15s",
    }}
  >
    <span style={{
      position: "absolute", top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: "50%",
      background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.18)", transition: "left 0.15s",
    }} />
  </button>
);

const highlightVars = (text) => {
  if (!text) return null;
  const parts = String(text).split(/(\{[^}]+\})/g);
  return parts.map((p, i) => (
    p.startsWith("{") && p.endsWith("}")
      ? <span key={i} style={{ color: BRAND_ACCENT, fontWeight: 700 }}>{p}</span>
      : <span key={i}>{p}</span>
  ));
};

/* ---------- Modal ---------- */
export function AutoModal({ auto, onClose, setAutos, profile, sendClientEmail, setEmailSendLog, Btn }) {
  const isNew = !auto?.id;
  const [form, setForm] = useState(() => {
    const base = auto || {};
    return {
      name: base.name || "",
      trigger: base.trigger || "days_before_event",
      triggerDays: base.triggerDays != null ? base.triggerDays : 14,
      action: base.action === "email_sms" ? "email_sms" : (base.action || "send_email"),
      enabled: base.enabled !== false,
      eventTypes: Array.isArray(base.eventTypes) && base.eventTypes.length ? base.eventTypes : ["Wedding"],
      template: base.template || { subject: AUTO_TEMPLATE_PRESETS[2].subject, body: AUTO_TEMPLATE_PRESETS[2].body },
      presetId: base.presetId || "questionnaire",
      id: base.id,
    };
  });
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const uiTriggers = TRIGGERS.filter((t) => t.ui);
  const uiActions = AUTO_ACTIONS.filter((a) => a.ui);
  const triggerInfo = triggerMeta(form.trigger);

  const appliesLabel = (() => {
    const types = form.eventTypes || [];
    if (!types.length || types.includes("all")) return "Every event";
    return types.map((id) => AUTO_EVENT_TYPE_OPTIONS.find((o) => o.id === id)?.label || id).join(", ");
  })();
  const whenLabel = triggerLabel(form.trigger, form.triggerDays);
  const thenLabel = (AUTO_ACTIONS.find((a) => a.id === form.action)?.label || "send an email").toLowerCase();
  const presetLabel = AUTO_TEMPLATE_PRESETS.find((p) => p.id === form.presetId)?.label || "custom template";
  const previewSnippet = (form.template?.body || "").split("\n").filter(Boolean).slice(0, 2).join(" ");

  const toggleType = (id) => {
    setForm((f) => {
      let next = [...(f.eventTypes || [])];
      if (id === "all") return { ...f, eventTypes: ["all"] };
      next = next.filter((x) => x !== "all");
      if (next.includes(id)) next = next.filter((x) => x !== id);
      else next.push(id);
      if (!next.length) next = ["all"];
      return { ...f, eventTypes: next };
    });
  };

  const field = {
    width: "100%", background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 12,
    padding: "12px 14px", color: C.text, fontSize: 14, fontFamily: BRAND_FONT, outline: "none", boxSizing: "border-box",
  };

  const save = () => {
    if (!form.name.trim()) return;
    if (form.action === "send_sms") return;
    const payload = {
      ...form,
      action: form.action === "email_sms" ? "email_sms" : resolveAutoAction(form.action),
      name: form.name.trim(),
      eventTypes: form.eventTypes?.length ? form.eventTypes : ["all"],
      template: { subject: form.template?.subject || "", body: form.template?.body || "" },
    };
    if (isNew) {
      setAutos((prev) => [...ensureAutomationsSeeded(prev), {
        ...payload, id: Date.now(), runCount: 0, enabled: true, enabledAt: new Date().toISOString(),
      }]);
    } else {
      setAutos((prev) => ensureAutomationsSeeded(prev).map((a) => (a.id === form.id ? { ...a, ...payload } : a)));
    }
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(22,22,26,0.5)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 980, maxHeight: "94vh", overflow: "auto",
          background: "#fff", borderRadius: 20, border: `1px solid ${C.border}`,
          boxShadow: "0 28px 90px rgba(0,0,0,0.28)", fontFamily: BRAND_FONT,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "20px 24px 16px", borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: BRAND_ACCENT_SOFT, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <IconBolt size={16} color={BRAND_ACCENT} />
              </span>
              <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: "-0.03em", color: C.text }}>
                {isNew ? "New automation" : "Edit automation"}
              </div>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginLeft: 42 }}>
              Pick who it applies to, what starts it, and what CuePoint does.
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, width: 32, height: 32, borderRadius: 10, fontSize: 18, color: C.muted, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(260px, 0.85fr)" }}>
          <div style={{ padding: "20px 24px 8px", borderRight: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 8 }}>Name</div>
            <input value={form.name} onChange={(e) => setF("name", e.target.value)} placeholder="e.g. Two-week playlist reminder" style={{ ...field, marginBottom: 22 }} />

            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 4 }}>Applies to</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Pick one or more event types</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
              {AUTO_EVENT_TYPE_OPTIONS.map((o) => {
                const on = (form.eventTypes || []).includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggleType(o.id)}
                    style={{
                      padding: "9px 14px", borderRadius: 999, cursor: "pointer", fontFamily: BRAND_FONT, fontWeight: 700, fontSize: 13,
                      border: `1.5px solid ${on ? BRAND_ACCENT : C.border}`,
                      background: on ? BRAND_ACCENT : "#fff",
                      color: on ? "#fff" : C.text,
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}
                  >
                    {on ? "✓ " : ""}{o.label}
                  </button>
                );
              })}
            </div>

            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>When this happens</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              {uiTriggers.map((t) => {
                const on = form.trigger === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setF("trigger", t.id);
                      if (t.needsDays) setF("triggerDays", form.triggerDays || t.defaultDays || 14);
                      const sug = EMAIL_TEMPLATES[t.id]?.[resolveAutoAction(form.action)] || EMAIL_TEMPLATES[t.id]?.send_email;
                      if (sug) setF("template", { subject: sug.subject, body: sug.body });
                    }}
                    style={{
                      textAlign: "left", padding: "14px 14px", borderRadius: 14, cursor: "pointer", fontFamily: BRAND_FONT,
                      border: `2px solid ${on ? BRAND_ACCENT : C.border}`,
                      background: on ? BRAND_ACCENT_SOFT : "#fff",
                      boxShadow: on ? `0 0 0 1px ${BRAND_ACCENT}22` : "none",
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 13, color: C.text, marginBottom: 3 }}>{t.label}</div>
                    <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.35 }}>{t.desc}</div>
                  </button>
                );
              })}
            </div>

            {triggerInfo.needsDays && (
              <div style={{
                marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 14px", borderRadius: 12, background: BRAND_ACCENT_SOFT, border: `1px solid ${BRAND_ACCENT}33`,
              }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: C.text }}>{triggerInfo.daysLabel || "How many days?"}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button type="button" onClick={() => setF("triggerDays", Math.max(1, (Number(form.triggerDays) || 14) - 1))}
                    style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff", cursor: "pointer", fontWeight: 800 }}>−</button>
                  <input
                    type="number" min={1} max={400} value={form.triggerDays ?? 14}
                    onChange={(e) => setF("triggerDays", Math.max(1, Number(e.target.value) || 1))}
                    style={{ width: 56, textAlign: "center", fontWeight: 900, fontSize: 16, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "6px 4px", fontFamily: BRAND_FONT }}
                  />
                  <button type="button" onClick={() => setF("triggerDays", Math.min(400, (Number(form.triggerDays) || 14) + 1))}
                    style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff", cursor: "pointer", fontWeight: 800 }}>+</button>
                </div>
              </div>
            )}

            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>Then do this</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
              {uiActions.map((a) => {
                const on = form.action === a.id;
                const disabled = a.live === false;
                const iconNode = a.icon === "sms" ? <IconSms size={20} color={on ? BRAND_ACCENT : C.muted} />
                  : a.icon === "task" ? <IconTask size={20} color={on ? BRAND_ACCENT : C.muted} />
                  : a.icon === "both" ? <IconMail size={20} color={on ? BRAND_ACCENT : C.muted} />
                  : <IconMail size={20} color={on ? BRAND_ACCENT : C.muted} />;
                return (
                  <button
                    key={a.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      setF("action", a.id);
                      const mapped = resolveAutoAction(a.id);
                      const sug = EMAIL_TEMPLATES[form.trigger]?.[mapped] || EMAIL_TEMPLATES[form.trigger]?.send_email;
                      if (sug) setF("template", { subject: sug.subject, body: sug.body });
                    }}
                    style={{
                      padding: "14px 10px", borderRadius: 14, cursor: disabled ? "not-allowed" : "pointer",
                      opacity: disabled ? 0.45 : 1, fontFamily: BRAND_FONT, textAlign: "center",
                      border: `2px solid ${on ? BRAND_ACCENT : C.border}`,
                      background: on ? BRAND_ACCENT_SOFT : "#fff",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>{iconNode}</div>
                    <div style={{ fontWeight: 800, fontSize: 12, color: C.text, lineHeight: 1.25 }}>{a.label}</div>
                  </button>
                );
              })}
            </div>

            {form.action !== "send_sms" && form.action !== "create_task" && (
              <>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>Template</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                  {AUTO_TEMPLATE_PRESETS.map((p) => {
                    const on = form.presetId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, presetId: p.id, template: { subject: p.subject, body: p.body } }))}
                        style={{
                          padding: "8px 14px", borderRadius: 999, cursor: "pointer", fontFamily: BRAND_FONT, fontWeight: 700, fontSize: 13,
                          border: `1.5px solid ${on ? BRAND_ACCENT : C.border}`,
                          background: on ? BRAND_ACCENT : "#fff",
                          color: on ? "#fff" : C.text,
                        }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {form.action === "send_sms" && (
              <div style={{ background: "#FFF4E8", border: "1px solid #F5D0A8", borderRadius: 12, padding: 12, fontSize: 13, color: "#9A5B10", marginBottom: 12 }}>
                SMS isn’t live yet — pick Email to save this rule.
              </div>
            )}
          </div>

          <div style={{ padding: "20px 20px 16px", background: "#F7F7FA" }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted, marginBottom: 12 }}>Preview</div>
            <div style={{ fontSize: 14, color: C.text, lineHeight: 1.55, marginBottom: 16, fontWeight: 600 }}>
              {form.name.trim() || "Untitled automation"}. For{" "}
              <strong style={{ color: BRAND_ACCENT }}>{appliesLabel}</strong>, when{" "}
              <strong style={{ color: BRAND_ACCENT }}>{whenLabel}</strong>, CuePoint will{" "}
              <strong style={{ color: BRAND_ACCENT }}>{thenLabel}</strong>
              {form.action !== "create_task" && form.action !== "send_sms" ? (
                <> using the <strong style={{ color: BRAND_ACCENT }}>{presetLabel}</strong> template</>
              ) : null}.
            </div>

            {form.action !== "create_task" && form.action !== "send_sms" && (
              <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: BRAND_ACCENT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 11 }}>CP</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: C.text }}>{presetLabel}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>to {appliesLabel} clients</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.55 }}>
                  {highlightVars(previewSnippet)}
                  {(form.template?.body || "").length > previewSnippet.length ? "…" : ""}
                </div>
              </div>
            )}

            <div style={{
              background: "#FFF8E8", border: "1px solid #F0D98A", borderRadius: 12, padding: "12px 14px",
              fontSize: 12, color: "#8A6A1A", lineHeight: 1.45, display: "flex", gap: 8, alignItems: "flex-start",
            }}>
              <span style={{ fontWeight: 900, color: "#C9A227" }}>!</span>
              <span>Nothing sends without a matching event. You’ll get a copy of the first run.</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px", borderTop: `1px solid ${C.border}`, gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: C.muted }}>Runs automatically once saved.</div>
          <div style={{ display: "flex", gap: 8 }}>
            {Btn ? <Btn variant="ghost" onClick={onClose}>Cancel</Btn> : (
              <button type="button" onClick={onClose} style={{ padding: "10px 16px", borderRadius: 999, border: `1px solid ${C.border}`, background: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: BRAND_FONT }}>Cancel</button>
            )}
            {Btn ? (
              <Btn onClick={save}>{isNew ? "Create automation" : "Save changes"}</Btn>
            ) : (
              <button type="button" onClick={save} style={{ padding: "10px 18px", borderRadius: 999, border: "none", background: BRAND_ACCENT, color: "#fff", fontWeight: 800, cursor: "pointer", fontFamily: BRAND_FONT }}>
                {isNew ? "Create automation" : "Save changes"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export function AutomationsPage({
  automations, setAutomations,
  automationRuns, setAutomationRuns,
  automationRunLog, setAutomationRunLog,
  automationSettings, setAutomationSettings,
  events, leads, contracts, invoices, questionnaireInstances,
  portalTokens, setPortalTokens, setDashboardTodos, setEvents, setLeads, setEmailSendLog,
  profile, sendClientEmail, getEventPortalShareUrl,
  Btn, Card, Modal, ModalFooter,
}) {
  const [editing, setEditing] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showLibrary, setShowLibrary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const rules = ensureAutomationsSeeded(automations);
  useEffect(() => {
    if (!Array.isArray(automations) || automations.length === 0) {
      setAutomations(ensureAutomationsSeeded([]));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pausedAll = !!automationSettings?.pausedAll;

  const runScan = async () => {
    if (scanning) return;
    setScanning(true);
    setScanNote("");
    try {
      const list = ensureAutomationsSeeded(automations);
      if (!automationSettings?.baselinedAt) {
        const ctx = { events, leads, contracts, invoices, questionnaireInstances };
        setAutomationRuns(seedBaselineAutomationRuns(list, ctx, automationRuns));
        setAutomationSettings((s) => ({ ...(s || {}), baselinedAt: new Date().toISOString(), baselineCrmCount: (events || []).length + (leads || []).length }));
        setScanNote("Baseline saved — scan again to process new items.");
        return;
      }
      const summary = await runAutomationScan({
        automations: list,
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
        events, leads, contracts, invoices, questionnaireInstances,
        portalTokens, setPortalTokens, getEventPortalShareUrl,
        pausedAll,
      });
      if (summary.sent > 0) setScanNote(`${summary.sent} ran`);
      else if (pausedAll) setScanNote("All paused");
      else setScanNote("Scanned — nothing new");
    } finally {
      setScanning(false);
    }
  };

  const toggleEnabled = (auto) => {
    if (auto.action === "send_sms") return;
    const nextEnabled = !auto.enabled;
    setAutomations((prev) => ensureAutomationsSeeded(prev).map((a) => {
      if (a.id !== auto.id) return a;
      return { ...a, enabled: nextEnabled, enabledAt: nextEnabled ? new Date().toISOString() : a.enabledAt };
    }));
    if (nextEnabled) {
      setAutomationRuns(seedBaselineAutomationRuns(
        [{ ...auto, enabled: true }],
        { events, leads, contracts, invoices, questionnaireInstances },
        automationRuns,
      ));
    }
  };

  const addFromLibrary = (recipe) => {
    setAutomations((prev) => [...ensureAutomationsSeeded(prev), {
      id: Date.now() + Math.floor(Math.random() * 999),
      name: recipe.name,
      trigger: recipe.trigger,
      triggerDays: recipe.triggerDays,
      action: recipe.action,
      enabled: true,
      enabledAt: new Date().toISOString(),
      eventTypes: recipe.eventTypes || ["all"],
      template: { subject: recipe.template?.subject || "", body: recipe.template?.body || "" },
      runCount: 0,
    }]);
  };

  const runLog = automationRunLog || [];
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const messagesThisMonth = runLog.filter((e) => e.status === "sent" && e.timestamp && new Date(e.timestamp) >= monthStart).length;
  const totalRuns = rules.reduce((n, a) => n + (Number(a.runCount) || 0), 0);
  const hoursSaved = Math.max(0, Math.round((totalRuns * 0.08) * 10) / 10 || Math.round(messagesThisMonth * 0.08 * 10) / 10);
  const activeCount = rules.filter((a) => a.enabled).length;

  const typeTabs = [
    { id: "all", label: "All", count: rules.length },
    { id: "Wedding", label: "Weddings", count: rules.filter((a) => eventTypeGroupLabel(a.eventTypes) === "WEDDINGS").length },
    { id: "Corporate", label: "Corporate", count: rules.filter((a) => eventTypeGroupLabel(a.eventTypes) === "CORPORATE").length },
    { id: "Quinceañera", label: "Quinceañeras", count: rules.filter((a) => eventTypeGroupLabel(a.eventTypes) === "QUINCEAÑERA").length },
    { id: "Private Party", label: "Parties", count: rules.filter((a) => eventTypeGroupLabel(a.eventTypes) === "PARTIES").length },
  ];

  const filtered = rules.filter((a) => {
    if (statusFilter === "active" && !a.enabled) return false;
    if (statusFilter === "paused" && a.enabled) return false;
    if (typeFilter === "all") return true;
    const g = eventTypeGroupLabel(a.eventTypes);
    if (typeFilter === "Wedding") return g === "WEDDINGS";
    if (typeFilter === "Corporate") return g === "CORPORATE";
    if (typeFilter === "Quinceañera") return g === "QUINCEAÑERA";
    if (typeFilter === "Private Party") return g === "PARTIES";
    return true;
  });

  const groups = {};
  filtered.forEach((a) => {
    const key = eventTypeGroupLabel(a.eventTypes);
    (groups[key] = groups[key] || []).push(a);
  });
  const groupOrder = ["ALL EVENT TYPES", "WEDDINGS", "CORPORATE", "QUINCEAÑERA", "PARTIES"];
  const orderedGroups = [
    ...groupOrder.filter((k) => groups[k]?.length),
    ...Object.keys(groups).filter((k) => !groupOrder.includes(k)),
  ];

  const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    .replace(/,/g, "")
    .toUpperCase()
    .replace(/^(\w+)\s/, "$1 · ")
    .replace(/(\d+)\s(\d{4})/, "$1, $2");

  const StatCard = ({ label, value, icon, tint }) => (
    <div style={{
      background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 20px",
      boxShadow: "0 1px 3px rgba(22,22,26,0.04)", display: "flex", alignItems: "center", gap: 14,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, background: tint, display: "flex",
        alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.04em", color: C.text, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 4, fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily: BRAND_FONT, maxWidth: 1200 }}>
      {/* Header — mock: date above title, subtitle + CTA */}
      <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", color: C.muted }}>
        {dateLabel}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 8, flexWrap: "wrap" }}>
        <h2 style={{ ...TYPE.pageTitle, margin: 0, color: C.text, fontFamily: BRAND_FONT }}>Automations</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {scanNote && <span style={{ fontSize: 12, color: C.muted }}>{scanNote}</span>}
          <button type="button" onClick={() => setShowSettings(true)} style={{ background: "none", border: "none", color: C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: BRAND_FONT }}>Settings</button>
          <button type="button" onClick={runScan} disabled={scanning || pausedAll}
            style={{ background: "none", border: "none", color: C.muted, fontWeight: 700, fontSize: 12, cursor: scanning ? "wait" : "pointer", fontFamily: BRAND_FONT, opacity: pausedAll ? 0.4 : 1 }}>
            {scanning ? "Scanning…" : "Scan"}
          </button>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 15, color: C.muted, maxWidth: 480, lineHeight: 1.45 }}>
          Let CuePoint handle the follow-ups so you can stay behind the decks.
        </p>
        {Btn ? (
          <Btn onClick={() => setEditing({})}><span style={{ marginRight: 4 }}>+</span> New automation</Btn>
        ) : (
          <button type="button" onClick={() => setEditing({})}
            style={{ background: BRAND_ACCENT, color: "#fff", border: "none", borderRadius: 999, padding: "11px 18px", fontWeight: 800, cursor: "pointer", fontFamily: BRAND_FONT }}>
            + New automation
          </button>
        )}
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14, marginBottom: 22 }}>
        <StatCard label="Active automations" value={activeCount} tint={BRAND_ACCENT_SOFT} icon={<IconBolt size={20} color={BRAND_ACCENT} />} />
        <StatCard label="Messages sent this month" value={messagesThisMonth || totalRuns} tint="#E8F4FC" icon={<IconMail size={20} color="#2563EB" />} />
        <StatCard label="Saved this month" value={`${hoursSaved || 0} hrs`} tint="#E8F8EF" icon={<IconClock size={20} color="#2FBF6B" />} />
      </div>

      {pausedAll && (
        <div style={{ background: "#FFF4E8", border: "1px solid #F5D0A8", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#9A5B10" }}>
          All automations are paused. Open Settings to resume.
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        {/* Main list */}
        <div style={{ flex: "1 1 560px", minWidth: 0 }}>
          {/* Status segmented control */}
          <div style={{ display: "inline-flex", gap: 4, background: "#EEEEEF", borderRadius: 999, padding: 4, marginBottom: 14 }}>
            {[["all", "All"], ["active", "Active"], ["paused", "Paused"]].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setStatusFilter(id)}
                style={{
                  padding: "7px 16px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: BRAND_FONT,
                  fontWeight: 800, fontSize: 13,
                  background: statusFilter === id ? "#fff" : "transparent",
                  color: statusFilter === id ? C.text : C.muted,
                  boxShadow: statusFilter === id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Event type pills */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
            {typeTabs.map((t) => {
              const on = typeFilter === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTypeFilter(t.id)}
                  style={{
                    padding: "7px 14px", borderRadius: 999, cursor: "pointer", fontFamily: BRAND_FONT, fontWeight: 700, fontSize: 13,
                    border: `1.5px solid ${on ? BRAND_ACCENT : C.border}`,
                    background: on ? BRAND_ACCENT_SOFT : "#fff",
                    color: on ? BRAND_ACCENT : C.muted,
                  }}
                >
                  {t.label} {t.count}
                </button>
              );
            })}
          </div>

          {orderedGroups.length === 0 ? (
            <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: 36, textAlign: "center" }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>No automations match</div>
              <div style={{ color: C.muted, fontSize: 14 }}>Try another filter, or create a new one.</div>
            </div>
          ) : orderedGroups.map((group) => {
            const list = groups[group] || [];
            const onCount = list.filter((a) => a.enabled).length;
            return (
              <div key={group} style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: C.muted }}>{group}</div>
                  <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{onCount} of {list.length} on</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {list.map((auto) => {
                    const sms = auto.action === "send_sms";
                    const when = triggerLabel(auto.trigger, auto.triggerDays);
                    const then = thenCopy(auto);
                    const icon = ROW_ICON[auto.action] || ROW_ICON.send_email;
                    const ago = relativeAgo(auto.lastRunAt);
                    return (
                      <div
                        key={auto.id}
                        style={{
                          background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 18px",
                          boxShadow: "0 1px 3px rgba(22,22,26,0.04)",
                          opacity: !auto.enabled ? 0.72 : 1,
                        }}
                      >
                        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: 12, background: icon.bg, flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {icon.node}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                              <span style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{auto.name}</span>
                              <span style={{
                                fontSize: 10, fontWeight: 800, letterSpacing: "0.06em",
                                color: "#2563EB", background: "#E8F4FC", padding: "3px 8px", borderRadius: 999,
                              }}>
                                {actionChannel(auto.action)}
                              </span>
                            </div>
                            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.4 }}>
                              <span style={{ fontWeight: 700, color: "#6B6B73" }}>WHEN</span> {when}
                              <span style={{ margin: "0 6px", color: "#C0C0C6" }}>→</span>
                              <span style={{ fontWeight: 700, color: "#6B6B73" }}>THEN</span> {then}
                            </div>
                            <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
                              Ran {Number(auto.runCount) || 0} time{(Number(auto.runCount) || 0) === 1 ? "" : "s"}
                              {ago ? ` · last ${ago}` : ""}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
                            <PurpleToggle on={!!auto.enabled && !sms} disabled={sms} onClick={() => toggleEnabled(auto)} />
                            <button
                              type="button"
                              onClick={() => setEditing(auto)}
                              style={{ background: "none", border: "none", color: BRAND_ACCENT, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: BRAND_FONT }}
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right rail */}
        <div style={{ flex: "0 1 300px", minWidth: 260, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, boxShadow: "0 1px 3px rgba(22,22,26,0.04)" }}>
            <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 2 }}>Ready to add</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Proven recipes from working DJs</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(showLibrary ? AUTOMATION_LIBRARY : AUTOMATION_LIBRARY.slice(0, 4)).map((recipe) => (
                <div key={recipe.name} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: C.text }}>{recipe.name}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.35 }}>{recipe.desc}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => addFromLibrary(recipe)}
                    style={{
                      flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "6px 10px", borderRadius: 999, border: `1.5px solid ${BRAND_ACCENT}44`,
                      background: BRAND_ACCENT_SOFT, color: BRAND_ACCENT, fontWeight: 800, fontSize: 12,
                      cursor: "pointer", fontFamily: BRAND_FONT,
                    }}
                  >
                    <IconPlus size={12} color={BRAND_ACCENT} /> Add
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowLibrary((v) => !v)}
              style={{ background: "none", border: "none", color: BRAND_ACCENT, fontWeight: 800, fontSize: 12, cursor: "pointer", marginTop: 14, padding: 0, fontFamily: BRAND_FONT }}
            >
              {showLibrary ? "Hide library" : "Browse the Library · 12 more in the library"}
            </button>
          </div>

          <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, boxShadow: "0 1px 3px rgba(22,22,26,0.04)" }}>
            <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12 }}>Recent activity</div>
            {runLog.length === 0 ? (
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
                No runs yet. Activity will show here after Scan.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {runLog.slice(0, 8).map((entry) => (
                  <div key={entry.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                      background: entry.status === "sent" ? "#2FBF6B" : entry.status === "failed" ? "#DC2626" : "#2563EB",
                    }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.35 }}>
                        {entry.automationName || "Automation"}
                        {entry.status === "sent" ? " sent" : entry.status === "failed" ? " failed" : ` ${entry.status}`}
                      </div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{formatAutoTime(entry.timestamp)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <AutoModal
          auto={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          setAutos={setAutomations}
          profile={profile}
          sendClientEmail={sendClientEmail}
          setEmailSendLog={setEmailSendLog}
          Btn={Btn}
        />
      )}
      {confirmDelete && Modal && (
        <Modal title="Delete automation?" onClose={() => setConfirmDelete(null)} width={420}>
          <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.55, marginTop: 0 }}>
            Remove <strong style={{ color: C.text }}>{confirmDelete.name}</strong>?
          </p>
          {ModalFooter && (
            <ModalFooter
              onClose={() => setConfirmDelete(null)}
              saveLabel="Delete"
              onSave={() => {
                setAutomations((prev) => ensureAutomationsSeeded(prev).filter((a) => a.id !== confirmDelete.id));
                setConfirmDelete(null);
              }}
            />
          )}
        </Modal>
      )}
      {showSettings && Modal && (
        <Modal title="Automation settings" onClose={() => setShowSettings(false)} width={520}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Pause all</div>
              <div style={{ fontSize: 14, color: C.muted, marginBottom: 12 }}>Stops scans from sending.</div>
              {Btn && (
                <Btn size="sm" variant={pausedAll ? "primary" : "ghost"} onClick={() => setAutomationSettings((s) => ({ ...(s || {}), pausedAll: !pausedAll }))}>
                  {pausedAll ? "Resume all automations" : "Pause all automations"}
                </Btn>
              )}
            </div>
            <div>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>From / Reply-To</div>
              <div style={{ fontSize: 14, color: C.muted }}>
                Emails send via CuePoint with Reply-To set to your profile email
                {profile?.email ? <> (<strong style={{ color: C.text }}>{profile.email}</strong>)</> : " (add it in Account & Brand)"}.
              </div>
            </div>
          </div>
          {ModalFooter && <ModalFooter onClose={() => setShowSettings(false)} saveLabel="Done" onSave={() => setShowSettings(false)} />}
        </Modal>
      )}
    </div>
  );
}
