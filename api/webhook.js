const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const getRawBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  const updateUserPlan = async (userId, plan, stripeCustomerId, subscriptionId, status, trialEnd = null) => {
    if (!userId) { console.error('updateUserPlan: no userId'); return; }
    try {
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { plan, role: 'dj', stripe_customer_id: stripeCustomerId, stripe_subscription_id: subscriptionId, subscription_status: status, trial_end: trialEnd || null },
      });
      if (error) console.error('Supabase update error:', error);
      else console.log(`Updated user ${userId} → plan: ${plan}, status: ${status}`);
    } catch (err) { console.error('updateUserPlan error:', err); }
  };

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.supabase_user_id;
      const customerId = session.customer;
      const subscriptionId = session.subscription;
      const customerEmail = session.customer_details?.email || session.customer_email;
      const customerName = session.customer_details?.name || '';
      console.log('checkout.session.completed — userId:', userId, 'email:', customerEmail);
      await updateUserPlan(userId, 'solo', customerId, subscriptionId, 'trialing');

      // Send welcome email via Resend
      if (customerEmail) {
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: 'CuePoint Planning <hello@cuepointplanning.com>',
              replyTo: 'support@cuepointplanning.com',
              to: [customerEmail],
              subject: 'Welcome to CuePoint Planning — your trial has started',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; background: #ffffff;">
                  <div style="margin-bottom: 32px;">
                    <h1 style="font-size: 24px; font-weight: 700; color: #1A1A2E; margin: 0 0 8px;">Welcome to CuePoint Planning</h1>
                    <p style="color: #71717A; margin: 0; font-size: 14px;">Your 30-day free trial has started.</p>
                  </div>
                  <p style="color: #3D3D3D; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">Hey${customerName ? ' ' + customerName.split(' ')[0] : ''},</p>
                  <p style="color: #3D3D3D; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">Thanks for joining CuePoint Planning. You now have full access to everything — events, contracts, invoices, client portal, music planning, and more.</p>
                  <p style="color: #3D3D3D; font-size: 15px; line-height: 1.7; margin-bottom: 32px;">Your free trial runs for 30 days. After that, you will be charged $20/mo (Founder rate). You can cancel anytime from Settings, then Billing.</p>
                  <div style="margin-bottom: 32px;">
                    <a href="https://cuepointplanning.com/app" style="background: #7C5BF5; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block;">Open CuePoint Planning</a>
                  </div>
                  <p style="color: #71717A; font-size: 13px; border-top: 1px solid #e4e4e7; padding-top: 20px; margin: 0;">CuePoint Planning — Built by a working DJ. Questions? Reply to this email.</p>
                </div>
              `,
            }),
          });
          console.log('Welcome email sent to:', customerEmail);
        } catch (emailErr) {
          console.error('Welcome email failed:', emailErr);
        }
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const userId = sub.metadata?.supabase_user_id;
      const status = sub.status;
      const plan = status === 'active' || status === 'trialing' ? 'solo' : 'free';
      console.log('subscription event — userId:', userId, 'status:', status);
      await updateUserPlan(userId, plan, sub.customer, sub.id, status, sub.trial_end);
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      await updateUserPlan(sub.metadata?.supabase_user_id, 'free', sub.customer, sub.id, 'canceled');
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const sub = await stripe.subscriptions.retrieve(invoice.subscription);
      await updateUserPlan(sub.metadata?.supabase_user_id, 'solo', invoice.customer, invoice.subscription, 'past_due');
      break;
    }
    default:
      console.log(`Unhandled event: ${event.type}`);
  }

  return res.status(200).json({ received: true });
};

module.exports.config = { api: { bodyParser: false } };
