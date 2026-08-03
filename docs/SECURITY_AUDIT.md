# CuePoint Security Audit

**Date:** 2026-08-02  
**Scope:** Vite/React SPA (`src/`), Vercel serverless (`api/`), Supabase (`supabase/`)  
**Baseline:** `origin/main` @ merge Templates hub + CUE unify  
**PR:** Hardening fixes shipped with this document  

This audit ranks real issues by severity, documents what we fixed in code, and lists ops follow-ups that must be applied in Supabase / Auth before treating soft-launch as locked down.

---

## Executive summary

| Severity | Count (pre-fix) | Status after this PR |
|----------|------------------|----------------------|
| Critical | 3 | Mitigated in code; **ops migration still required** for full close |
| High | 6 | Fixed or substantially reduced |
| Medium | 8 | Several / documented residual |
| Low | several | Partial |

**Highest risk before fix:** Any authenticated user could set `user_metadata.role = "superadmin"` / `plan = "solo"` via Supabase Auth client APIs and unlock CRM + Super Admin UI; Super Admin then queried all `djProfile` rows through the anon key with no RLS policies in-repo.

---

## Critical findings

### C1 — Billing / role in client-writable `user_metadata`

| | |
|--|--|
| **Risk** | Privilege escalation to Super Admin or paid CRM without Stripe |
| **Where** | `getUserBillingState` / `applyAuthUser` trusted `user_metadata`; webhook wrote entitlements there; signup seeded `plan`/`role` into `options.data` |
| **Exploit** | `supabase.auth.updateUser({ data: { role: "superadmin", plan: "solo", subscription_status: "active" } })` then refresh |
| **Fix (code)** | Prefer **`app_metadata`** for plan / role / `subscription_status` / Stripe IDs (`readAuthEntitlements`); webhook writes **`app_metadata` only** and preserves `superadmin`; signup sends `{ name }` only |
| **Ops** | Migrate existing users (see `supabase/migrate-entitlements-to-app-metadata.sql` notes). Set Super Admin **only** via Admin API → `app_metadata.role`. Strip entitlement keys from `user_metadata` after verify |

### C2 — Missing RLS + Super Admin cross-tenant SELECT

| | |
|--|--|
| **Risk** | Any auth user (or spoofed admin) can read all tenants’ `user_data` if RLS is off / too open |
| **Where** | Super Admin previously: `supabase.from("user_data").select(...).eq("key","djProfile")` with no `user_id` filter |
| **Fix (code)** | Super Admin lists DJs via `POST /api/send-email` `{ action: "adminListDjProfiles" }` (service role) gated by `app_metadata.role === "superadmin"` |
| **Ops** | Apply `supabase/user-data-rls.sql` in the Supabase SQL editor. Confirm cross-tenant SELECT returns empty for a normal user JWT |

### C3 — Anthropic proxy: arbitrary body + no plan gate

| | |
|--|--|
| **Risk** | Authenticated users burn Anthropic credits; tools/stream/oversized payloads |
| **Where** | `api/anthropic/v1/messages.js` forwarded `{ ...req.body }` |
| **Fix** | Paid entitlement check; whitelist `messages` / optional `system` / capped `max_tokens`; fixed model; no tools/stream |

---

## High findings

### H1 — CUE chat without entitlement

| | |
|--|--|
| **Fix** | `requirePaidAccess` on `api/cue/chat.js`; message length cap |

### H2 — Portal oversharing (`djProfile`, `djUserId`, full invoices)

| | |
|--|--|
| **Fix** | `publicDjProfile` (brand fields only); omit `djUserId`; `publicInvoices` minimal fields; CORS allowlist instead of `*` |

### H3 — Meetings PATCH / schedule leaks / single-tenant fallback

| | |
|--|--|
| **Fix** | Status allowlist `scheduled`\|`completed`; `sanitizeMeetLink` (https Meet/Zoom only); redacted PATCH response; join/schedule use `publicDjProfile`; **removed** single-tenant handle fallback; no email / `userId` on public schedule |

### H4 — Stripe email-only customer claim

| | |
|--|--|
| **Fix** | Resolve customer only when `metadata.supabase_user_id === user.id`; read Stripe customer id from entitlements (`app_metadata` preferred) |

### H5 — Webhook trusts metadata + wrote `user_metadata`

| | |
|--|--|
| **Fix** | Resolve user via customer binding check; write `app_metadata`; escape welcome-email HTML; drop CORS `*` on webhook |

### H6 — CORS `*` on token APIs

| | |
|--|--|
| **Fix** | Origin allowlist on `portal-data` and `meetings` |

---

## Medium / Low (fixed or residual)

| ID | Issue | Status |
|----|--------|--------|
| M1 | Contract template Preview XSS (`dangerouslySetInnerHTML`) | **Fixed** — escape in `getPreview` / `getPreviewBoxed` |
| M2 | `notify-launch` HTML injection in admin email | **Fixed** — `escapeHtml` |
| M3 | In-memory rate limits on serverless | **Residual** — add Upstash/KV for durable limits |
| M4 | Portal token can replace event-scoped blobs | **Residual** — consider merge-by-id + rate limit |
| M5 | Meetings full-table scan for join/PATCH | **Residual** — index or normalize meetings table |
| M6 | Legacy portal token blob scan | **Residual** — finish `portalToken:` backfill, drop legacy |
| L1 | iCal capability URLs | By design — treat feed URL as secret |
| L2 | Booking spam | Soft rate limit only |

---

## What this PR changes (code)

| Area | Files |
|------|--------|
| Shared helpers | `api/_lib/entitlements.js` |
| Webhook / Stripe | `api/webhook.js`, `api/stripe.js` |
| AI | `api/anthropic/v1/messages.js`, `api/cue/chat.js` |
| Public APIs | `api/portal-data.js`, `api/meetings.js`, `api/notify-launch.js` |
| Admin listing | `api/send-email.js` (`adminListDjProfiles`) |
| Client entitlements / Super Admin / XSS | `src/App.jsx` |
| RLS + migration notes | `supabase/user-data-rls.sql`, `supabase/migrate-entitlements-to-app-metadata.sql` |

---

## Ops follow-ups (required)

1. **Apply RLS** — run `supabase/user-data-rls.sql` in production Supabase.  
2. **Migrate entitlements** — copy `plan`, `role`, `subscription_status`, Stripe IDs from `user_metadata` → `app_metadata` for all users (script notes in `migrate-entitlements-to-app-metadata.sql`).  
3. **Super Admin** — set only via:
   ```js
   await supabase.auth.admin.updateUserById(uid, {
     app_metadata: { ...existing, role: "superadmin" }
   });
   ```
   Confirm the account no longer relies on `user_metadata.role`.  
4. **Verify** — as a normal DJ JWT, `select * from user_data` (or client `.select()` without own filter) must not return other tenants.  
5. **Verify AI gate** — unpaid/free session `POST /api/cue/chat` and `/api/anthropic/v1/messages` → **403**.  
6. **Optional** — Auth Hook rejecting client updates that try to set reserved keys in `user_metadata` (`plan`, `role`, `subscription_status`, `stripe_*`).  
7. **Optional** — durable rate limiting (Upstash) for AI + booking-submit.  
8. **Hobby function count** — stay at 12 serverless routes; do not add `api/admin.js` without consolidating another route.

---

## Auth model (target state)

```
Client JWT
  ├─ user_metadata: display name, non-auth prefs only
  └─ app_metadata: plan, role, subscription_status, stripe_*  (Admin/webhook only)

UI gates (BillingLock / CRM)  → read app_metadata (fallback user_metadata during migration)
Paid APIs (CUE, Anthropic)    → requirePaidAccess(app_metadata)
Super Admin APIs              → requireSuperAdmin(app_metadata.role)
Tenant data                   → RLS user_id = auth.uid(); service role for portal/public APIs
```

---

## Test plan (security)

- [ ] Spoof `user_metadata.role=superadmin` → after migration, Super Admin UI / admin API still **403** unless `app_metadata.role` set  
- [ ] Unauth `POST /api/stripe`, `/api/cue/chat`, `/api/anthropic/v1/messages` → **401**  
- [ ] Free/locked user `POST` AI routes → **403**  
- [ ] Portal GET no longer returns home address / email / `djUserId`  
- [ ] Meetings schedule GET: unknown handle **404** (no single-tenant fallback); no DJ email  
- [ ] Meetings PATCH: `status=cancelled` → **400**; `meetLink=javascript:...` → **400**  
- [ ] Contract template Preview with `<img onerror=...>` shows escaped text  
- [ ] Super Admin user list loads via `/api/send-email` action (not direct table scan)

---

## Out of scope / not fixed here

- Durable (Redis) rate limits  
- Full meetings table redesign  
- Client-side Stripe card payments for portal (already forced off)  
- Automations / Day-of Mode / Templates redesign  

---

## Soft-launch recommendation

**Conditional GO:** ship this PR, then **immediately** apply RLS + `app_metadata` migration in production. Until ops steps 1–3 are done, treat C1/C2 as only partially closed (code prefers `app_metadata` but still falls back to `user_metadata` for migration compatibility).
