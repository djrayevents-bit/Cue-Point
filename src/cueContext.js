/** Shared CUE context helpers — used by full-page Cue + CueAssistant panel. */

import { buildEventFinancialComputed } from "./eventMoney";

/** Resolve display client name from event shape (client | clientName | contacts). */
export const eventClientName = (ev) => {
  if (!ev) return "";
  if (ev.client && String(ev.client).trim()) return String(ev.client).trim();
  if (ev.clientName && String(ev.clientName).trim()) return String(ev.clientName).trim();
  const c = (ev.contacts || [])[0];
  if (c) {
    const n = `${c.first || ""} ${c.last || ""}`.trim();
    if (n) return n;
    if (c.name) return String(c.name).trim();
  }
  return "";
};

const clientLabel = (c) => {
  const n = `${c?.first || ""} ${c?.last || ""}`.trim();
  return n || c?.name || "Unnamed";
};

/** Compact event row for business snapshot (times + money for “last gig” questions). */
const summarizeEventForBusiness = (e, invoices) => {
  const computed = buildEventFinancialComputed(e, invoices);
  return {
    name: e.name || "Unnamed",
    date: e.date || null,
    start_time: e.startTime || null,
    end_time: e.endTime || null,
    type: e.type || "Event",
    venue: e.venue || null,
    status: e.status || "Confirmed",
    client: eventClientName(e) || null,
    fee: Number(e.totalFee) || 0,
    amount_paid: computed.amount_paid,
    balance_remaining: computed.balance_remaining,
    deposit_status: computed.deposit_status,
  };
};

/**
 * Structured business snapshot for POST /api/cue/chat (scope: "business").
 * Uses live AppContext fields (pricingPackages / addOns — not packages/addons).
 */
export const buildBusinessContextSnapshot = ({
  profile = {},
  events = [],
  clients = [],
  leads = [],
  invoices = [],
  expenses = [],
  staff = [],
  pricingPackages = [],
  addOns = [],
  focusedEventId = "",
} = {}) => {
  const today = new Date().toISOString().slice(0, 10);
  const thisYear = new Date().getFullYear();

  const upcomingEvents = (events || [])
    .filter((e) => e.date && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10)
    .map((e) => summarizeEventForBusiness(e, invoices));

  const pastEvents = (events || [])
    .filter((e) => e.date && e.date < today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)
    .map((e) => summarizeEventForBusiness(e, invoices));

  const clientList = (clients || []).slice(0, 15).map((c) => ({
    name: clientLabel(c),
    email: c.email || null,
    phone: c.phone || null,
  }));

  const activeLeads = (leads || [])
    .filter((l) => l.stage !== "Converted" && l.stage !== "Lost")
    .slice(0, 8)
    .map((l) => ({
      name: l.name || "Unnamed",
      stage: l.stage || "New",
      eventType: l.eventType || l.event || null,
      eventDate: l.eventDate || null,
      budget: l.budget != null && l.budget !== "" ? Number(l.budget) || l.budget : null,
    }));

  const yearRevenue = (invoices || [])
    .filter((inv) => inv.status === "Paid" && inv.issued && String(inv.issued).startsWith(String(thisYear)))
    .reduce((s, inv) => s + (Number(inv.amount) || 0), 0);
  const yearExpenses = (expenses || [])
    .filter((ex) => ex.date && String(ex.date).startsWith(String(thisYear)))
    .reduce((s, ex) => s + (Number(ex.amount) || 0), 0);
  const outstandingInvoices = (invoices || [])
    .filter((inv) => inv.status === "Sent" || inv.status === "Overdue")
    .reduce((s, inv) => s + (Number(inv.amount) || 0), 0);

  const packages = (pricingPackages || []).map((p) => ({
    name: p.name,
    price: Number(p.price) || 0,
  }));
  const addons = (addOns || []).map((a) => ({
    name: a.name,
    price: Number(a.price) || 0,
  }));

  const team = (staff || []).map((s) => ({
    name: s.name,
    role: s.role,
    rate: Number(s.rate) || 0,
    rateType: s.rateType || null,
  }));

  const focused = focusedEventId
    ? (events || []).find((e) => String(e.id) === String(focusedEventId))
    : null;

  const focusedEvent = focused
    ? {
        ...summarizeEventForBusiness(focused, invoices),
        notes: focused.notes || null,
        _computed: buildEventFinancialComputed(focused, invoices),
      }
    : null;

  return {
    profile: {
      businessName: profile.businessName || null,
      djName: profile.djName || null,
      email: profile.email || null,
      phone: profile.phone || null,
      website: profile.website || null,
    },
    year: thisYear,
    today,
    financials: {
      revenue_collected: yearRevenue,
      expenses: yearExpenses,
      net_profit: yearRevenue - yearExpenses,
      outstanding_invoices: outstandingInvoices,
    },
    upcoming_events: upcomingEvents,
    past_events: pastEvents,
    /** Most recent past gig first — use for “last event” questions */
    last_event: pastEvents[0] || null,
    clients: clientList,
    clients_total: (clients || []).length,
    active_leads: activeLeads,
    packages,
    add_ons: addons,
    staff: team,
    focused_event: focusedEvent,
  };
};

/** Attach authoritative financials for event-scoped CUE calls. */
export const enrichEventForCue = (ev, invoices) => {
  if (!ev || typeof ev !== "object") return null;
  return {
    ...ev,
    client: eventClientName(ev) || ev.client || null,
    clientName: eventClientName(ev) || ev.clientName || null,
    _computed: buildEventFinancialComputed(ev, invoices),
  };
};

/** Anthropic messages must alternate and start with user — drop leading assistant turns. */
export const sanitizeCueHistory = (history = []) => {
  const cleaned = (history || [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content }));
  let i = 0;
  while (i < cleaned.length && cleaned[i].role === "assistant") i += 1;
  return cleaned.slice(i);
};
