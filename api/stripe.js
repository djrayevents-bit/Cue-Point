// Combined Stripe endpoints for Hobby plan function limits.
// POST body.action: "checkout" | "portal"

const { createClient } = require("@supabase/supabase-js");
const Stripe = require("stripe");

const ALLOWED_ORIGINS = new Set([
  "https://cuepointplanning.com",
  "http://localhost:5173",
  "http://localhost:5174",
]);

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
  const email = user.email;
  if (!email) return res.status(400).json({ error: "Authenticated user has no email" });

  try {
    if (action === "portal") {
      const existing = await stripe.customers.list({ email, limit: 5 });
      const owned = (existing.data || []).find(
        (c) => c.metadata?.supabase_user_id === user.id
      ) || existing.data?.[0];

      if (!owned) return res.status(400).json({ error: "No Stripe customer found" });
      if (req.body?.customerId && req.body.customerId !== owned.id) {
        return res.status(403).json({ error: "Customer mismatch" });
      }
      if (owned.metadata?.supabase_user_id !== user.id) {
        await stripe.customers.update(owned.id, {
          metadata: { ...(owned.metadata || {}), supabase_user_id: user.id },
        });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: owned.id,
        return_url: process.env.APP_URL || "https://cuepointplanning.com",
      });
      return res.status(200).json({ url: session.url });
    }

    // default: checkout
    const userId = user.id;
    const name = (req.body?.name && String(req.body.name).slice(0, 120)) || "";

    let customerId;
    const existing = await stripe.customers.list({ email, limit: 1 });
    if (existing.data.length > 0) {
      customerId = existing.data[0].id;
      await stripe.customers.update(customerId, {
        metadata: { ...(existing.data[0].metadata || {}), supabase_user_id: userId },
      });
    } else {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: { supabase_user_id: userId },
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
        metadata: { supabase_user_id: userId },
      },
      payment_method_collection: "always",
      metadata: { supabase_user_id: userId },
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
