const Stripe = require("stripe");

module.exports = async (req, res) => {
  // CORS + method guard
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

  try {
    const { userId, email, name } = req.body;
    if (!userId || !email) return res.status(400).json({ error: "userId and email required" });

    // Find or create Stripe customer by email to avoid duplicates
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
          price_data: {
            currency: "usd",
            product_data: {
              name: "CuePoint Planning — Solo",
              description: "1 DJ · All features included · Cancel anytime",
            },
            unit_amount: 1999, // $19.99
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      // Pass userId in metadata so the webhook can update Supabase
      subscription_data: {
        trial_period_days: 30,
        metadata: { supabase_user_id: userId },
      },
      payment_method_collection: "always", // require card even during trial
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
