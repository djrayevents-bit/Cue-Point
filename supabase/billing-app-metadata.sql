-- CuePoint: Move billing / role into app_metadata (admin-writable only)
--
-- WHY: Clients can rewrite user_metadata via auth.updateUser().
--      app_metadata can only be set with the service role / Auth Admin API.
--
-- After deploying the webhook that writes app_metadata:
-- 1. Set your SuperAdmin once with the service role (Dashboard → Users → edit
--    raw app_metadata, or run the admin snippet below from a trusted server).
-- 2. Optionally clear dangerous keys from user_metadata for all users.
--
-- Supabase does not expose a bulk Auth Admin SQL API for app_metadata from
-- Postgres. Use the Management API / a one-off Node script with SERVICE_ROLE_KEY:

/*
  // one-off: scripts/backfill-app-metadata.mjs (run locally with SERVICE_ROLE)
  import { createClient } from '@supabase/supabase-js'
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: { users } } = await sb.auth.admin.listUsers({ perPage: 1000 })
  for (const u of users) {
    const um = u.user_metadata || {}
    const am = u.app_metadata || {}
    await sb.auth.admin.updateUserById(u.id, {
      app_metadata: {
        ...am,
        plan: am.plan || um.plan || 'trial',
        subscription_status: am.subscription_status || um.subscription_status || null,
        role: am.role === 'superadmin' ? 'superadmin' : (um.role === 'superadmin' ? 'dj' : (am.role || 'dj')),
        stripe_customer_id: am.stripe_customer_id || um.stripe_customer_id || null,
        stripe_subscription_id: am.stripe_subscription_id || um.stripe_subscription_id || null,
        trial_end: am.trial_end || um.trial_end || null,
      },
      // Strip privilege keys from client-writable metadata
      user_metadata: {
        ...um,
        plan: undefined,
        role: undefined,
        subscription_status: undefined,
        stripe_customer_id: undefined,
        stripe_subscription_id: undefined,
      },
    })
  }
*/

-- Promote a single owner to SuperAdmin (replace UUID):
-- Use Auth Admin updateUserById with:
--   app_metadata: { role: 'superadmin', plan: 'solo', subscription_status: 'active' }
-- Never put role=superadmin in user_metadata.
