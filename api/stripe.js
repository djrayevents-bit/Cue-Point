// Combined Stripe endpoints for Hobby plan function limits.
// POST body.action: "checkout" | "portal"
// Replaces legacy unauthenticated /api/create-checkout-session and /api/billing-portal.
// Requires Authorization: Bearer <supabase access token>.

const { createClient } = require("@supabase/supabase-js");
const Stripe = require("stripe");

const ALLOWED_ORIGINS = new Set([
  "https://cuepointplanning.com",
  "https://www.cuepointplanning.com",
  "http://localhost:5173",
  "http://localhost:5174",
]);

function emailsMatch(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

/** Resolve a Stripe customer that belongs to the authenticated user only. */
async function resolveOwnedCustomer(stripe, user) {
  const metaCustomerId =
    user.app_metadata?.stripe_customer_id || user.user_metadata?.stripe_customer_id;
  if (metaCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(metaCustomerId);
      if (
        customer &&
        !customer.deleted &&
        customer.metadata?.supabase_user_id === user.id
      ) {
        return customer;
      }
      // Legacy: metadata not stamped yet — allow email match only for this customer id
      if (
        customer &&
        !customer.deleted &&
        !customer.metadata?.supabase_user_id &&
        emailsMatch(customer.email, user.email)
      ) {
        return customer;
      }
    } catch (_) {
      // fall through to email lookup
    }
  }

  if (!user.email) return null;

  const existing = await stripe.customers.list({ email: user.email, limit: 10 });
  const customers = existing.data || [];
  const byUserId = customers.find((c) => c.metadata?.supabase_user_id === user.id);
  if (byUserId) return byUserId;

  // Email match only if the customer isn't stamped to a different Supabase user
  return customers.find(
    (c) => !c.metadata?.supabase_user_id || c.metadata.supabase_user_id === user.id
  ) || null;
}

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Invalid session" });

  const action = String(req.body?.action || "checkout").toLowerCase();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

  // Identity always from the verified session — never from spoofable body.userId
  const supabaseUserId = user.id;
  const authEmail = user.email;
  if (!authEmail) return res.status(400).json({ error: "Authenticated user has no email" });

  // Body email is only allowed when it matches the signed-in user
  if (req.body?.email && !emailsMatch(req.body.email, authEmail)) {
    return res.status(403).json({ error: "Email mismatch" });
  }

  try {
    if (action === "portal") {
      const owned = await resolveOwnedCustomer(stripe, user);
      if (!owned) return res.status(400).json({ error: "No Stripe customer found" });

      // Reject spoofed customerId that isn't the resolved owned customer
      if (req.body?.customerId && req.body.customerId !== owned.id) {
        return res.status(403).json({ error: "Customer mismatch" });
      }

      if (owned.metadata?.supabase_user_id !== supabaseUserId) {
        await stripe.customers.update(owned.id, {
          metadata: { ...(owned.metadata || {}), supabase_user_id: supabaseUserId },
        });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: owned.id,
        return_url: process.env.APP_URL || "https://cuepointplanning.com",
      });
      return res.status(200).json({ url: session.url });
    }

    // default: checkout
    const name = (req.body?.name && String(req.body.name).slice(0, 120)) || "";

    let customerId;
    const owned = await resolveOwnedCustomer(stripe, user);
    if (owned) {
      customerId = owned.id;
      await stripe.customers.update(customerId, {
        metadata: { ...(owned.metadata || {}), supabase_user_id: supabaseUserId },
        ...(name ? { name } : {}),
      });
    } else {
      const customer = await stripe.customers.create({
        email: authEmail,
        name,
        metadata: { supabase_user_id: supabaseUserId },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      subscription_data: {
        trial_period_days: 30,
        metadata: { supabase_user_id: supabaseUserId },
      },
      payment_method_collection: "always",
      metadata: { supabase_user_id: supabaseUserId },
      success_url: `${process.env.APP_URL}/index.html?stripe=success`,
      cancel_url: `${process.env.APP_URL}/index.html?stripe=cancel`,
      allow_promotion_codes: true,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("stripe api error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
