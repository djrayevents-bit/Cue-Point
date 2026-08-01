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
    .map((e) => ({
      name: e.name || "Unnamed",
      date: e.date,
      type: e.type || "Event",
      venue: e.venue || null,
      status: e.status || "Confirmed",
      fee: Number(e.totalFee) || 0,
      client: eventClientName(e) || null,
    }));

  const pastEvents = (events || [])
    .filter((e) => e.date && e.date < today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map((e) => ({
      name: e.name || "Unnamed",
      date: e.date,
      type: e.type || "Event",
      client: eventClientName(e) || null,
    }));

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
        name: focused.name || "Unnamed",
        date: focused.date || null,
        type: focused.type || "Event",
        venue: focused.venue || null,
        client: eventClientName(focused) || null,
        fee: Number(focused.totalFee) || 0,
        status: focused.status || "Confirmed",
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
    financials: {
      revenue_collected: yearRevenue,
      expenses: yearExpenses,
      net_profit: yearRevenue - yearExpenses,
      outstanding_invoices: outstandingInvoices,
    },
    upcoming_events: upcomingEvents,
    past_events: pastEvents,
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
