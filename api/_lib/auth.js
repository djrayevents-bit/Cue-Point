/**
 * Shared auth + entitlement helpers for CuePoint API routes.
 * Privileges MUST come from app_metadata (service-role / webhook writable only).
 * user_metadata is client-writable and must never unlock paid features or admin.
 */

const { createClient } = require("@supabase/supabase-js");

function supabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/** Prefer app_metadata; ignore privilege keys in user_metadata for role.
 *  plan/status may fall back to user_metadata ONLY while app_metadata has no
 *  billing fields yet (migration). Set ENTITLEMENTS_STRICT=1 after backfill
 *  to reject user_metadata entirely for paid checks.
 */
function getEntitlements(user) {
  const app = user?.app_metadata || {};
  const um = user?.user_metadata || {};
  const strict = process.env.ENTITLEMENTS_STRICT === "1";
  const appHasBilling = !!(app.plan || app.subscription_status);
  const useAppOnly = strict || appHasBilling;
  return {
    plan: useAppOnly ? (app.plan || "trial") : (app.plan || um.plan || "trial"),
    status: useAppOnly
      ? (app.subscription_status || null)
      : (app.subscription_status || um.subscription_status || null),
    // role is NEVER taken from user_metadata (client-writable)
    role: app.role || "dj",
    stripeCustomerId: app.stripe_customer_id || (!useAppOnly ? um.stripe_customer_id : null) || null,
  };
}

function isSuperAdmin(user) {
  return getEntitlements(user).role === "superadmin";
}

/** Paid / trial CRM access — mirrors client gates but enforced server-side. */
function hasPaidAccess(user) {
  const { plan, status, role } = getEntitlements(user);
  if (role === "superadmin") return true;
  if (status === "past_due" || status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
    return false;
  }
  if (plan === "solo") {
    return !status || status === "active" || status === "trialing";
  }
  return false;
}

/**
 * Extract Bearer JWT, verify with Supabase Auth.
 * @returns {{ user, supabase } | never} — sends 401 and returns null if invalid
 */
async function requireUser(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const token = authHeader.slice(7);
  const supabase = supabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: "Invalid session" });
    return null;
  }
  return { user, supabase, token };
}

/** requireUser + active paid/trial entitlement */
async function requirePaidUser(req, res) {
  const ctx = await requireUser(req, res);
  if (!ctx) return null;
  if (!hasPaidAccess(ctx.user)) {
    res.status(402).json({ error: "Subscription required" });
    return null;
  }
  return ctx;
}

module.exports = {
  supabaseAdmin,
  getEntitlements,
  isSuperAdmin,
  hasPaidAccess,
  requireUser,
  requirePaidUser,
};
