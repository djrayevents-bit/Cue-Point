# CuePoint Security Audit

Date: 2026-08-02  
Scope: Vite/React SPA (`src/`), Vercel serverless API (`api/`), Supabase usage (`supabase/`)

This document records findings from a code-level security review and the remediations shipped alongside it.

---

## Summary

| Severity | Count | Themes |
|----------|------:|--------|
| Critical | 2 | Entitlement spoofing via `user_metadata`; missing RLS / cross-tenant Super Admin |
| High | 5 | Portal oversharing; Anthropic proxy abuse; meeting PATCH; service-role scans; portal writes |
| Medium | 6 | Stripe email binding; HTML email injection; CORS `*`; XSS preview; weak rate limits; email leak |
| Low / Info | several | Soft paywall, localStorage secrets, token TTL, security headers |

---

## Critical

### C1. Billing / role stored in client-writable `user_metadata`

**Where:** `api/webhook.js`, `src/App.jsx` (`getUserBillingState`, signup, Super Admin)

CRM access and Super Admin were derived from `user.user_metadata.plan`, `subscription_status`, and `role`. Supabase lets authenticated users call `supabase.auth.updateUser({ data: { … } })` to change `user_metadata` unless Auth Hooks block it.

**Impact:** Attacker can set `plan: "solo"`, `subscription_status: "active"`, and/or `role: "superadmin"` and unlock CRM / admin UI without paying.

**Remediation shipped:**
- Webhook writes privileged fields to **`app_metadata`** (admin-only).
- Client prefers `app_metadata`; **`role` / Super Admin only from `app_metadata`**.
- Signup no longer writes `plan` / `role` into `user_metadata`.

**Follow-up (ops):** One-time migrate existing users’ billing fields from `user_metadata` → `app_metadata` (Supabase Admin API). Until then, client still falls back to `user_metadata` for `plan`/`status` when `app_metadata` has none.

### C2. No RLS policies in repo; Super Admin selects all `djProfile` rows

**Where:** `supabase/*.sql` (no policies); `SuperAdmin` in `src/App.jsx`

Super Admin uses the anon client to `.select()` all `user_data` rows with `key = "djProfile"`. That only works if RLS is off or overly permissive — in which case **any** logged-in user can run the same query.

**Remediation shipped:** Recommended RLS SQL in `supabase/rls-user-data.sql`. Super Admin remains UI-only until a privileged server route exists.

**Follow-up (ops):** Apply RLS in the Supabase dashboard; move admin listing to a service-role API gated on `app_metadata.role === "superadmin"`.

---

## High

### H1. Portal GET overshared DJ profile, invoices, `djUserId`

**Where:** `api/portal-data.js`

Token holders received full `djProfile`, invoices (even with payments off), and internal `djUserId`.

**Remediation shipped:** Public profile field allowlist; event field allowlist; omit `djUserId`; omit invoices when payments disabled; payload size limits on writes; CORS origin allowlist.

### H2. Open Anthropic proxy

**Where:** `api/anthropic/v1/messages.js`

Authenticated users could forward nearly arbitrary Anthropic bodies (cost abuse). In-memory rate limit is weak on serverless.

**Remediation shipped:** Entitlement check; allowlisted body fields; `max_tokens` cap.

### H3. Meeting PATCH: arbitrary `status` / `meetLink`

**Where:** `api/meetings.js`

Anyone with `meetingId` + `joinToken` could set any status or phishing/`javascript:` Meet URL.

**Remediation shipped:** Status allowlist; HTTPS Google Meet URL validation.

### H4. Public meetings schedule leaked email + single-tenant fallback

**Where:** `api/meetings.js`

GET by handle returned DJ email and `userId`; unknown handles resolved to the only user when one tenant existed.

**Remediation shipped:** Strip email/`userId` from public payload; remove single-tenant fallback; join-page profile allowlisted.

### H5. Portal generic POST could replace event-scoped arrays without limits

**Where:** `api/portal-data.js`

**Remediation shipped:** Max array length / JSON byte size checks on writes.

---

## Medium

| ID | Issue | Notes |
|----|--------|--------|
| M1 | Stripe customer binding by email | Tightened to prefer `supabase_user_id` metadata; still email-fallback for legacy |
| M2 | `send-email` arbitrary HTML to admin/self | Auth + allowlist OK; still phishing risk to admin inbox |
| M3 | CORS `*` on portal/meetings/webhook | Portal/meetings now origin-allowlisted; webhook may stay `*` (Stripe servers) |
| M4 | `dangerouslySetInnerHTML` contract preview | Escaped via `escHtml` before inject |
| M5 | In-memory rate limits | Documented; prefer Upstash Redis (dep already present, unused) |
| M6 | Welcome / notify-launch HTML injection | Escaped dynamic name/email in outbound HTML |

---

## Low / Info

- Soft client-side paywall only — data access still depends on RLS.
- Full CRM + portal/calendar tokens in `localStorage` — XSS or shared device = exfil.
- iCal / portal tokens are high-entropy capability URLs with no TTL.
- No CSP / `X-Frame-Options` in `vercel.json`.
- No hardcoded API secrets found; client correctly uses `VITE_SUPABASE_ANON_KEY` only.
- Stripe webhook signature verification is correct (`constructEvent`).

---

## API attack surface (reference)

| Endpoint | Auth | Notes |
|----------|------|--------|
| `POST /api/webhook` | Stripe signature | Billing → `app_metadata` |
| `POST /api/stripe` | Bearer JWT | Checkout / billing portal |
| `GET/POST /api/portal-data` | Portal token | Event-scoped client portal |
| `GET /api/spotify-search` | Bearer or portal token | Spotify proxy |
| `POST /api/send-email` | Bearer | Recipient allowlist |
| `GET/POST/PATCH /api/meetings` | Public handle / join token | Scheduler |
| `GET /api/booking-page` | Public handle | Booking branding |
| `POST /api/booking-submit` | Public | Lead capture |
| `GET/POST /api/ical/feed` | Token / Bearer | Calendar feed |
| `POST /api/cue/chat` | Bearer | CUE assistant |
| `POST /api/anthropic/v1/messages` | Bearer + paid | Anthropic proxy |
| `POST /api/notify-launch` | Public | Launch list |

---

## Recommended next steps (not all in this PR)

1. Apply `supabase/rls-user-data.sql` in production and verify with a non-owner session.
2. Migrate all users’ `plan` / `subscription_status` / `stripe_*` / `role` into `app_metadata`.
3. Add Auth Hook rejecting client updates to privileged `user_metadata` keys.
4. Replace in-memory rate limits with Upstash Redis.
5. Server-side Super Admin API; remove cross-tenant selects from the anon client.
6. Add CSP and clickjacking headers in `vercel.json`.
7. Index public handles (`bookingHandle` → `user_id`) to stop full-table service-role scans.
