/**
 * Server-side entitlement helpers.
 * Privileged fields must live in app_metadata (admin/webhook only).
 * user_metadata is client-writable and must not grant Super Admin.
 */

function getEntitlements(user) {
  const app = user?.app_metadata || {};
  const meta = user?.user_metadata || {};
  return {
    plan: app.plan || meta.plan || null,
    status: app.subscription_status || meta.subscription_status || null,
    role: app.role || null,
    stripeCustomerId: app.stripe_customer_id || meta.stripe_customer_id || null,
  };
}

function hasPaidAccess(user) {
  const { plan, status, role } = getEntitlements(user);
  if (role === "superadmin") return true;
  if (plan === "solo") {
    return !status || status === "active" || status === "trialing";
  }
  return false;
}

module.exports = { getEntitlements, hasPaidAccess };
