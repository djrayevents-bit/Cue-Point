# Solo desktop readiness (security notes)

Private / single-owner CuePoint. CRM syncs from the browser with the Supabase anon key; **RLS is the tenant boundary**.

## A) `user_data` RLS (blocking)

**Repo SQL:** `supabase/rls-private-os.sql`

- Enable RLS on `user_data` (and `ical_feeds` if present).
- Policies: authenticated may SELECT/INSERT/UPDATE/DELETE only when `user_id = auth.uid()`.
- Service role (Vercel APIs) bypasses RLS — keep the service key server-only.

**You must apply this in the Supabase SQL editor** if it is not already live. Code cannot enable RLS from the client.

**Smoke checks after apply:**

1. As User A, `select` rows for User B → 0 rows / error.
2. No session → denied.
3. Owner session → own keys still load/save.

## B) Auth OTP (`/api/auth-otp` → `notify-launch`)

- Rewrite: `vercel.json` maps `/api/auth-otp` → `/api/notify-launch`.
- Multiplex must forward `action=send|verify|resolve` to `api/_lib/authOtpHandler.js`.
- Email OTP: `send` + client `verifyOtp`.
- SMS OTP: Twilio (or email fallback); client may call `resolve` to map phone → account email before verify.

## C) Public surfaces (sanity)

- Portal: capability token + event scoping via service-role APIs (`portal-data`, Spotify).
- Meeting join: `meetingId` + `joinToken` required for client PATCH paths.
- CORS: allowlists in `api/_lib/allowedOrigins.js` — do not widen casually.
- Billing lock / plan gates are UI-only for this solo instance; not a multi-tenant authz layer.

## Follow-ups (non-blocking)

- Sync phone notification read-state to Supabase (`notifications` key already used for event log).
- Distributed rate limits (Upstash) — in-memory OK for solo.
- Tighten meeting join-token so clients cannot freely update `meetLink` / delete (owner-only).
- Real iOS push (APNs) — ask before building; in-app Notify tab is P0.
