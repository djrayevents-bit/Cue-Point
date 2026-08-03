/**
 * Server-side entitlement helpers.
 * Prefer app_metadata (Admin API only). Fall back to user_metadata during migration.
 * Never authorize from client-writable fields alone once migration is complete.
 */

function readEntitlements(user) {
  if (!user) return { plan: null, status: null, role: null, stripeCustomerId: null };
  const app = user.app_metadata || {};
  const um = user.user_metadata || {};
  return {
    plan: app.plan || um.plan || null,
    status: app.subscription_status || um.subscription_status || null,
    role: app.role || um.role || "dj",
    stripeCustomerId: app.stripe_customer_id || um.stripe_customer_id || null,
    stripeSubscriptionId: app.stripe_subscription_id || um.stripe_subscription_id || null,
  };
}

function isSuperAdmin(user) {
  return readEntitlements(user).role === "superadmin";
}

/** Paid / trial CRM access for AI and other spend APIs. */
function hasPaidAccess(user) {
  if (isSuperAdmin(user)) return true;
  const { plan, status } = readEntitlements(user);
  if (status === "past_due" || status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
    return false;
  }
  if (plan === "solo") {
    return !status || status === "active" || status === "trialing";
  }
  // Brief post-signup window: trial in metadata before Stripe webhook
  if (plan === "trial") {
    return !status || status === "trialing" || status === "active";
  }
  return false;
}

function requirePaidAccess(user, res) {
  if (hasPaidAccess(user)) return true;
  res.status(403).json({ error: "Subscription required" });
  return false;
}

function requireSuperAdmin(user, res) {
  if (isSuperAdmin(user)) return true;
  res.status(403).json({ error: "Forbidden" });
  return false;
}

/** Public-facing DJ profile fields only (no home address, email, phone). */
function publicDjProfile(profile) {
  const p = profile && typeof profile === "object" ? profile : {};
  return {
    businessName: p.businessName || "",
    djName: p.djName || "",
    fullName: p.fullName || "",
    brandColor: p.brandColor || "",
    logoPhoto: p.logoPhoto || "",
  };
}

/** Minimal invoice fields for portal payment status UI. */
function publicInvoices(invoices) {
  return (Array.isArray(invoices) ? invoices : []).map((inv) => ({
    id: inv.id,
    eventId: inv.eventId ?? null,
    linkedEventId: inv.linkedEventId ?? null,
    name: inv.name || inv.title || "",
    status: inv.status || "",
    total: inv.total ?? inv.amount ?? null,
    amountPaid: inv.amountPaid ?? inv.paid ?? null,
    depositAmount: inv.depositAmount ?? null,
    dueDate: inv.dueDate || null,
    client: inv.client || "",
  }));
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Allow only https Meet / Zoom-style links for meeting join pages. */
function sanitizeMeetLink(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return "";
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  const allowed =
    host === "meet.google.com" ||
    host.endsWith(".google.com") ||
    host === "zoom.us" ||
    host.endsWith(".zoom.us") ||
    host === "cuepointplanning.com" ||
    host.endsWith(".cuepointplanning.com");
  if (!allowed) return null;
  return url.toString();
}

const CLIENT_MEETING_STATUSES = new Set(["scheduled", "completed"]);

module.exports = {
  readEntitlements,
  isSuperAdmin,
  hasPaidAccess,
  requirePaidAccess,
  requireSuperAdmin,
  publicDjProfile,
  publicInvoices,
  escapeHtml,
  sanitizeMeetLink,
  CLIENT_MEETING_STATUSES,
};
