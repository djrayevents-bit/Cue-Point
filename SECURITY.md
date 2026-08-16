# CuePoint Security Checklist

Research audit of what must be in place before treating the app as safe for real DJ/client data. Vibecoded apps fail when **UI gates** are mistaken for **server enforcement**, and when the **anon key + open tables** can read everyone’s CRM.

---

## Current stack (attack surface)

| Layer | Tech | Risk if misconfigured |
|-------|------|------------------------|
| Auth | Supabase Email/SMS OTP | Account takeover via OTP spam / SIM swap; role spoofing |
| Data | `user_data` JSON blobs + Realtime | Cross-tenant data theft without RLS |
| APIs | Vercel serverless + service role | Privilege escalation, cost abuse, email bombs |
| Billing | Stripe + user metadata | Free Pro / unlock CRM without paying |
| Public links | Portal / iCal / booking / join tokens | Data leak if token weak or long-lived |

---

## Critical boxes (must be checked)

### 1. Supabase Row Level Security (RLS) — **#1 priority**

The browser ships `VITE_SUPABASE_ANON_KEY`. That key is **public by design**. Without RLS, anyone can query/update every DJ’s `user_data`.

**Required:**

- [ ] `ENABLE ROW LEVEL SECURITY` on `user_data`, `ical_feeds`, `launch_signups`, and any other public-schema tables
- [ ] Default deny; policies only allow `auth.uid() = user_id`
- [ ] Service role used **only** in `/api/*` (never in the Vite client)
- [ ] Verify with a second account: cannot `select * from user_data` for another `user_id`

SQL to run in the Supabase SQL editor: [`supabase/rls-policies.sql`](supabase/rls-policies.sql).

### 2. Privileges in `app_metadata` only (not `user_metadata`)

Clients can call `supabase.auth.updateUser({ data: { role: "superadmin", plan: "solo" } })` and rewrite **`user_metadata`**.

**Required:**

- [ ] Store `plan`, `subscription_status`, `role`, Stripe IDs in **`app_metadata`** (admin/webhook only)
- [ ] Stripe webhook writes `app_metadata` (see `api/webhook.js`)
- [ ] UI reads billing/role from `app_metadata` first (`getUserBillingState`)
- [ ] Never grant SuperAdmin from client-writable fields
- [ ] Run one-time backfill: [`supabase/billing-app-metadata.sql`](supabase/billing-app-metadata.sql) notes
- [ ] After backfill, set Vercel env `ENTITLEMENTS_STRICT=1` so APIs ignore `user_metadata` plan/status entirely

### 3. Server-side entitlement checks

Paywalls in React (`userHasCrmAccess`, billing lock screens) are **cosmetic**. An authenticated free user can still call paid APIs with a Bearer token.

**Required on every sensitive API:**

- [ ] Valid Supabase session (`getUser(jwt)`)
- [ ] Active entitlement: `solo` + `active|trialing`, or `app_metadata.role === "superadmin"`
- [ ] Apply to: CUE chat, Anthropic proxy, send-email, iCal publish, Spotify (authed path), meetings Google connect

Shared helper: [`api/_lib/auth.js`](api/_lib/auth.js).

### 4. No open AI / email / cron abuse

| Endpoint | Threat | Mitigation |
|----------|--------|------------|
| `/api/anthropic/v1/messages` | Burn Anthropic spend via arbitrary proxy body | Allowlist fields + hard `max_tokens` cap (done) |
| `/api/send-email` | Phishing HTML from `hello@cuepointplanning.com` | Recipient allowlist (exists); sanitize admin HTML; prefer templates |
| Meeting reminders cron | Email bomb if `x-vercel-cron` forgeable | Require `CRON_SECRET` Bearer when set (done) |
| Public booking / schedule | Spam leads | Keep rate limits; move to Upstash Redis for multi-instance |

### 5. Public link / token hygiene

| Link | Strength today | Still required |
|------|----------------|----------------|
| Client portal `#/portal/.../token` | ~144-bit CSPRNG | Revoke UI (exists); don’t put tokens in Referer logs; rate-limit portal API |
| iCal `?token=` | Strong | **Revoke/rotate UI**; treat feed as sensitive schedule data |
| Meeting join token | Strong | Allowlist `meetLink` hosts (`meet.google.com` only) |
| Booking `/book/{handle}` | Public by design | Rate-limit; no PII in public profile |

Tokens are strong enough that **guessing is not the risk** — **leakage** (screenshots, browser history, shared devices) is.

### 6. HTTP security headers

Add on Vercel (see `vercel.json`):

- `Content-Security-Policy` (start report-only, then enforce)
- `X-Frame-Options: DENY` / `frame-ancestors 'none'`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (camera/mic off unless needed)
- HSTS (Vercel usually provides on custom domains)

### 7. Reduce sensitive data in `localStorage`

Today the CRM (contracts, invoices, Wi‑Fi passwords, portal tokens) is mirrored into `cuepoint_*` keys for speed.

**Required direction:**

- [ ] Treat XSS as full account compromise until CSP + sanitization are solid
- [ ] Clear all `cuepoint_*` **and** portal caches on logout
- [ ] Don’t upload leftover local blobs from a previous user on login without confirmation
- [ ] Prefer server as source of truth; local cache non-sensitive UI state only where possible

---

## High-priority gaps still to close

1. **Admin / SuperAdmin** — move off client-only metadata; server-gated admin API; never `select` all `djProfile` rows with the anon key from the browser.
2. **Durable rate limits** — in-memory Maps reset on cold start and don’t share across Vercel isolates; use Upstash Redis (already a dependency).
3. **Portal write size/schema limits** — cap JSON size; validate questionnaire/request shapes.
4. **CORS** — avoid `*` on token-authenticated endpoints (`portal-data`).
5. **HTML sanitization** — contract preview `dangerouslySetInnerHTML`; email HTML; DOMPurify or server templates.
6. **OAuth redirect pinning** — `APP_URL` / `GOOGLE_REDIRECT_URI` only (no Host-header trust).
7. **Meetings public GET** — do not expose DJ email or raw `userId` (strip like booking-page).
8. **Handle resolution** — never fall back to “only one DJ in DB ⇒ any handle matches.”

---

## What’s already in good shape

- Stripe webhook signature verification (`constructEvent` + raw body)
- Stripe checkout/portal binds customer to authenticated user
- Spotify client secret stays server-side
- Portal write key allowlist (no rewriting contracts/events via generic write)
- Legacy `#/q` and `#/sign` public pages disabled
- `send-email` recipient must match CRM contact (or self)
- Portal / iCal / join tokens use `crypto.getRandomValues` (~18 bytes)
- CUE timeline PDF import: ownership check + size caps
- Secrets in env (`.gitignore` covers `.env*`); no service-role key in the Vite client

---

## Environment secrets checklist (Vercel)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Server Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only — never `VITE_` |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Public client (needs RLS) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_ID` | Billing |
| `RESEND_API_KEY` | Email |
| `ANTHROPIC_API_KEY` | CUE / AI |
| `CRON_SECRET` | Meeting reminders (required in production) |
| `APP_URL` | Canonical origin for OAuth redirects |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Calendar |
| `ADMIN_NOTIFY_EMAIL` | Product notify target (avoid hardcoded inbox) |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Search |

---

## Supabase Auth dashboard settings

- [ ] OTP expiry short (e.g. 10 minutes); rate-limit OTP sends
- [ ] Disable unused providers
- [ ] Confirm SMS provider is production-grade (not a shared trial that can be drained)
- [ ] Site URL + redirect allowlist = production only
- [ ] Review whether users can edit dangerous `user_metadata` keys (prefer ignoring them in app code)

---

## How attackers typically break vibecoded apps

1. **Anon key + no RLS** → dump every user’s events/contracts.
2. **Self-grant Pro** via `user_metadata.plan = "solo"`.
3. **Self-grant admin** via `user_metadata.role = "superadmin"`.
4. **Call paid APIs** with a free account’s JWT (UI paywall only).
5. **Open AI proxy** → max out the Anthropic bill.
6. **Open email relay** → phishing from your domain.
7. **Forge cron header** → mass reminder spam.
8. **Steal portal/iCal URL** → read/write client data without login.
9. **XSS** → steal Supabase session from storage + all `localStorage` CRM data.
10. **IDOR** → change `user_id` / `eventId` in requests when the API trusts the body over the session.

---

## Recommended rollout order

1. Run `supabase/rls-policies.sql` and verify isolation with two test accounts.
2. Deploy webhook + client `app_metadata` billing/role reads; set your SuperAdmin via SQL/admin API only.
3. Ship API entitlement helper on paid routes.
4. Keep Anthropic proxy locked; prefer `/api/cue/chat` only.
5. Set `CRON_SECRET` in Vercel; confirm cron Authorization header.
6. Add security headers + CSP report-only.
7. Upstash rate limits; portal payload caps; iCal revoke UI.
8. Pen-test checklist: second account cross-read, metadata spoof, unauthenticated portal write, cron without secret, Anthropic large `max_tokens`.

---

## Manual verification (after deploy)

```bash
# 1. As user A, confirm you cannot read user B's rows with the anon key
# 2. As free user, POST /api/cue/chat → expect 402/403
# 3. POST /api/anthropic/v1/messages with huge max_tokens → capped/rejected
# 4. GET /api/meetings?reminders=1 without CRON_SECRET → 401
# 5. updateUser({ data: { role: "superadmin" } }) → UI still not admin
```

This document tracks research findings and the hardening work in this PR. Treat unchecked boxes above as **launch blockers** for real customer data.
