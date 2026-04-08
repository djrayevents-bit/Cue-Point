const Stripe = require("stripe");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

  try {
    const { userId, email, name } = req.body;
    if (!userId || !email) return res.status(400).json({ error: "userId and email required" });

    let customerId;
    const existing = await stripe.customers.list({ email, limit: 1 });
    if (existing.data.length > 0) {
      customerId = existing.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email,
        name: name || "",
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 30,
        metadata: { supabase_user_id: userId },
      },
      payment_method_collection: "always",
      metadata: { supabase_user_id: userId },
      success_url: `${process.env.APP_URL}?stripe=success`,
      cancel_url: `${process.env.APP_URL}?stripe=cancel`,
      allow_promotion_codes: true,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("create-checkout-session error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
