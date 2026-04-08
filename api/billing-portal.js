// api/billing-portal.js
// Creates a Stripe billing portal session so DJs can manage their subscription

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { customerId, email } = req.body;
    let resolvedCustomerId = customerId;

    if (!resolvedCustomerId && email) {
      const existing = await stripe.customers.list({ email, limit: 1 });
      if (existing.data.length > 0) resolvedCustomerId = existing.data[0].id;
    }

    if (!resolvedCustomerId) return res.status(400).json({ error: 'No Stripe customer found' });

    const session = await stripe.billingPortal.sessions.create({
      customer: resolvedCustomerId,
      return_url: process.env.APP_URL || 'https://cuepointplanning.com',
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Billing portal error:', err);
    return res.status(500).json({ error: err.message });
  }
};
