// api/webhook.js
// Vercel serverless function — handles Stripe webhook events
// Updates Supabase user metadata when subscription is created/cancelled

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Supabase admin client (service role — bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Vercel needs raw body for Stripe signature verification
export const config = { api: { bodyParser: false } };

const getRawBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  const updateUserPlan = async (userId, plan, stripeCustomerId, subscriptionId, status) => {
    if (!userId) return;
    try {
      // Update Supabase Auth user_metadata
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          plan,
          role: 'dj',
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: subscriptionId,
          subscription_status: status,
        },
      });
      if (error) console.error('Supabase update error:', error);
      else console.log(`Updated user ${userId} → plan: ${plan}, status: ${status}`);
    } catch (err) {
      console.error('updateUserPlan error:', err);
    }
  };

  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.supabase_user_id;
      const customerId = session.customer;
      const subscriptionId = session.subscription;
      if (session.payment_status === 'paid') {
        await updateUserPlan(userId, 'solo', customerId, subscriptionId, 'active');
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const userId = sub.metadata?.supabase_user_id;
      const status = sub.status; // active, trialing, past_due, canceled
      const plan = status === 'active' || status === 'trialing' ? 'solo' : 'free';
      await updateUserPlan(userId, plan, sub.customer, sub.id, status);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const userId = sub.metadata?.supabase_user_id;
      await updateUserPlan(userId, 'free', sub.customer, sub.id, 'canceled');
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const sub = await stripe.subscriptions.retrieve(invoice.subscription);
      const userId = sub.metadata?.supabase_user_id;
      await updateUserPlan(userId, 'solo', invoice.customer, invoice.subscription, 'past_due');
      break;
    }

    default:
      console.log(`Unhandled event: ${event.type}`);
  }

  return res.status(200).json({ received: true });
};
