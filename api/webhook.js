const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const getRawBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

/**
 * Accept Stripe webhooks so retries stop, but do not mutate auth metadata.
 * CuePoint no longer uses subscriptions for access.
 */
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers["stripe-signature"];
  if (!secret || !sig || !process.env.STRIPE_SECRET_KEY) {
    return res.status(410).json({ error: "Billing webhooks disabled" });
  }

  try {
    const rawBody = await getRawBody(req);
    stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  return res.status(200).json({ received: true, ignored: true });
};

module.exports.config = { api: { bodyParser: false } };
