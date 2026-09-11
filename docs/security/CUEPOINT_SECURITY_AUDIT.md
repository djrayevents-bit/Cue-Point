# CuePoint Security Audit

**Project:** CuePoint (DJ Ray Events private business OS)  
**Audit type:** Authorized defensive repository review  
**Date:** 2026-09-10  
**Auditor role:** Senior application-security engineer (read-only)  
**Remediation:** Batch 1 implemented (F-03–F-06); further batches awaiting approval  

**Internal Production Readiness verdict:**  
## NOT READY — SECURITY WORK REQUIRED

Blocking themes: unverified RLS on `user_data`, client-writable `role`/`plan` metadata, open Anthropic proxy, forgeable cron reminders, meeting join-token Meet-link takeover (violates owner-only Meet URL rule), and SaaS/public-signup surface that conflicts with the confirmed private OS model.

### Owner-confirmed product rules (2026-09-11)

1. **Private OS** — DJ Ray Events only; not multi-DJ SaaS.  
2. **Owner login only** — no staff/client logins for now (staff = CRM records; clients = portal links).  
3. **Owner sets meeting URL only** — join-token callers must not set `meetLink`.

---

## 1. Executive summary

CuePoint is a Vite/React SPA on Vercel with Supabase Auth + a JSON blob table (`user_data`), plus serverless APIs for Stripe, Resend, Anthropic, Spotify, Google Calendar, booking, meetings, portal, and iCal.

**Strengths:** OTP auth (no passwords), Stripe webhook signature checks, portal write allowlists, strong portal/meeting token entropy, several authenticated API gates, recipient allowlisting for outbound email.

**Critical gaps:** Authorization for almost all CRM data depends on **browser-side** Supabase calls whose safety hinges on **RLS policies that are not in the repository**. Privileges (`superadmin`, plan) are stored in **user-editable `user_metadata`**. Public and capability-token surfaces can spam email, swap Meet links, or burn AI budget. Public signup / Stripe SaaS leftovers conflict with the confirmed private OS. Staff auth is intentionally out of scope for now (**accepted risk:** never share the owner login).

This audit used only repository evidence and safe local inspection. It is **not** a substitute for penetration testing or provider-dashboard verification.

---

## 2. Detected technology stack

| Layer | Technology |
|-------|------------|
| Languages | JavaScript (ES modules + CommonJS API) |
| Frontend | React 18, Vite 5 |
| Backend | Vercel Serverless Functions (`/api/*`) |
| Auth | Supabase Auth (Email OTP + SMS OTP) |
| Database | Supabase Postgres (`user_data`, `ical_feeds`, `launch_notify_signups`; code also references `events` table in CUE) |
| ORM | None — `@supabase/supabase-js` direct |
| Storage | No Supabase Storage usage found; images/PDFs often as data URLs / client blobs |
| Payments | Stripe Checkout + Customer Portal + webhooks |
| Email | Resend |
| AI | Anthropic Claude (Haiku) via `/api/cue/chat` and `/api/anthropic/v1/messages` |
| Music | Spotify Client Credentials |
| Calendar | Google Calendar OAuth; custom iCal feeds |
| Rate limit lib | `@upstash/redis` in root `package.json` but **unused** in code |
| Hosting | Vercel (`vercel.json` routes + daily cron) |
| CI | No `.github/workflows` in repository |
| Package managers | npm (`package-lock.json` root only; **no** `api/package-lock.json`) |

---

## 3. Architecture and data-flow summary

1. **DJ signs in** via OTP → Supabase session in browser.  
2. **CRM state** is mirrored: `localStorage` (`cuepoint_*`) ↔ `user_data` rows keyed by `(user_id, key)` with large JSON values (`events`, `clients`, `contracts`, …).  
3. **Realtime** optional publication on `user_data` (`supabase/enable-realtime-user-data.sql`).  
4. **Clients** do not get accounts; they use portal capability URLs hitting `/api/portal-data` with the **service role**.  
5. **Public booking / meetings** resolve a DJ by scanning profile handles (service role).  
6. **Stripe** updates `user_metadata` plan/status via webhook + admin API.  
7. **CUE** sends event/business context from the browser to Anthropic through authenticated proxies.

### Sensitive data inventory (enter → store → leave)

| Data | Enters | Validated | Stored | Displayed | Exported / third parties |
|------|--------|-----------|--------|-----------|--------------------------|
| Leads | booking form, CRM | Partial length caps | `user_data.leads` | CRM | Resend notify |
| Clients / events | CRM UI | Client-side | `user_data.*` | CRM, portal subset | Email, calendar ICS, AI prompts |
| Contracts / signatures | CRM + portal sign | Portal allowlist | `contracts` | Portal / CRM | Email possible |
| Invoices / money | CRM (trusted UI only) | Client-side math | `invoices`, event fields | Portal read-only | Not Stripe event payments |
| Music / questionnaires | Portal + CRM | Partial | events / requests / Q instances | Portal | Spotify search API |
| Staff / payroll | CRM | Client-side | `staff`, `payroll` | CRM only | — |
| Google tokens | OAuth callback | State nonce | `googleCalendarAuth` | — | Google APIs |
| Portal tokens | CRM mint | CSPRNG | `portalTokens` + index keys | Share URLs | Emails if shared |

---

## 4. User and role inventory (detected vs expected)

| Expected role (owner rules) | Detected in code? | Notes |
|-----------------------------|-------------------|-------|
| Owner/Admin | Partial as authenticated `dj` + optional `superadmin` | Intended sole login; single `user_id` owns all blobs |
| Staff/DJ | **No auth role (accepted)** | CRM array only — do not share owner OTP/login |
| Client | Capability portal only | No Supabase user — correct for current model |
| Public visitor | Yes | Booking/meetings/marketing — tighten for private OS |
| Superadmin | Yes (SaaS leftover) | Should not be required; metadata currently client-writable |
| Paying DJ tenant | Yes (SaaS leftover) | Stripe `solo` gating — disable/remove for private OS |

**Product rules locked:** Private OS · Owner login only · Owner-only Meet URL.

---

## 5. Attack-surface inventory

### Pages / routes
- Marketing: `public/landing.html`, `contact.html`, legal pages  
- App shell: `/app` → `index.html` + hash routes (`#dashboard`, `#events`, …)  
- Portal: `#/portal/{handle}/{eventId}/{token}`  
- Meetings join / schedule hash routes in SPA  

### API endpoints
| Path | Auth |
|------|------|
| `/api/booking-page` | Public |
| `/api/booking-submit` | Public |
| `/api/meetings` | Mixed (public, join token, Bearer, cron, OAuth) |
| `/api/portal-data` | Portal token |
| `/api/spotify-search` | Bearer or portal |
| `/api/ical/feed` | GET token / POST Bearer |
| `/api/notify-launch` | Public |
| `/api/send-email` | Bearer |
| `/api/stripe` | Bearer |
| `/api/webhook` | Stripe signature |
| `/api/cue/chat` (+ import rewrite) | Bearer |
| `/api/anthropic/v1/messages` | Bearer |

---

## 6. Existing security strengths (PASS examples)

| ID | Finding | Evidence |
|----|---------|----------|
| P-01 | Frontend uses anon key only (not service role) | `src/supabase.js:3-6` — `VITE_SUPABASE_ANON_KEY` |
| P-02 | Dev login bypass cannot run in production builds | `src/App.jsx:25762-25775` — `import.meta.env.DEV` |
| P-03 | Portal tokens minted with CSPRNG | `src/App.jsx:1357-1365` |
| P-04 | Portal rejects token/event mismatch on index path | `api/portal-data.js:31-36` |
| P-05 | Portal cannot rewrite contracts/events/invoices via generic POST | `api/portal-data.js:76-78`, `261-262` |
| P-06 | Stripe webhook verifies signature | `api/webhook.js:21-29` |
| P-07 | Stripe checkout uses session identity, not spoofable `userId` body | `api/stripe.js:78-79` |
| P-08 | Login OTP does not auto-create users | `AuthOtpPages.jsx:100-101` `shouldCreateUser: false` |
| P-09 | `send-email` restricts recipients to CRM contacts / admin | `api/send-email.js:82-99`, `185-188` |
| P-10 | robots.txt blocks `/app` and `/api/` | `public/robots.txt` |

**PASS limitations:** Passes are code-level only; provider dashboards, RLS, and runtime config remain MANUAL VERIFICATION.

---

## 7. Findings table

| ID | Severity | Confidence | Finding | Affected users/data | Evidence | OWASP/CWE mapping | Required fix | Verification test | Status |
|----|----------|------------|---------|---------------------|----------|-------------------|--------------|-------------------|--------|
| F-01 | CRITICAL | Medium | **RLS for `user_data` / `ical_feeds` / related tables not defined in repo.** If missing in production, any authenticated user (or anon policies) could read/write all business JSON including Google refresh tokens. SuperAdmin UI selects all `djProfile` rows via anon client, which only works with broad SELECT policies or missing RLS. | All clients, finances, Google OAuth | `App.jsx:25518-25522`; only SQL files are realtime + ical column helpers | API1 Broken Object Level Auth; A01; CWE-862 | Confirm RLS: deny-by-default; `user_id = auth.uid()` for DJ; no client access to other users; service role server-only. Export policies into repo. | Fake User A cannot `select` User B rows with anon key | MANUAL VERIFICATION |
| F-02 | HIGH | High | **Authorization roles (`role`, `plan`) stored in client-writable `user_metadata`.** Signup calls `supabase.auth.updateUser({ data: { role: 'dj', plan: 'trial' }})`. Unless Auth hooks lock these fields, a user can set `role: "superadmin"` / `plan: "solo"`. | Privilege escalation; billing bypass | `AuthOtpPages.jsx:336-355`; `App.jsx:1409-1416`, `26030-26031`; webhook writes role in metadata `webhook.js:35-36` | A01; A07; CWE-269 | Move `role`/`plan`/`subscription_*` to `app_metadata` (service role only) or DB table; Auth hook rejecting client changes | Authenticated DJ cannot become superadmin via `updateUser` | FAIL |
| F-03 | CRITICAL | High | **Open Anthropic proxy** forwards nearly entire request body after auth. | AI spend; arbitrary prompt/tools abuse | `api/anthropic/v1/messages.js` (disabled) | A01; A04; CWE-799 | Remove endpoint or allowlist schema | Authed user cannot pass custom `max_tokens`/tools | FIXED (Batch 1 — returns 410; use `/api/cue/chat`) |
| F-04 | HIGH | High | **Meeting reminder cron treats `x-vercel-cron: 1` as sufficient even when `CRON_SECRET` is set.** | Client emails; Resend quota | `api/_lib/meetingReminders.js`; `api/_lib/meetingSecurity.js` | A07; CWE-306 | Require Bearer/`x-cron-secret` matching secret; never trust client-supplied cron header alone | Spoofed cron header returns 401 | FIXED (Batch 1 — secret required) |
| F-05 | HIGH | High | **Meeting join token can set arbitrary `meetLink`.** Violates confirmed rule: only owner sets Meet URL. Booker can PATCH attacker URL → phishing. | Meeting clients | `api/meetings.js` PATCH; `MeetingSchedule.jsx` | A01; CWE-639 | Join token: cancel / reschedule only; Bearer owner sets `meetLink`; allowlist hosts | Join token cannot change `meetLink` | FIXED (Batch 1) |
| F-06 | HIGH | High | **`findDjByHandle` falls back to the sole user** if any handle is used. | Public schedule PII; bookings to wrong handle | `api/meetings.js` `findDjByHandle` | A01; CWE-639 | Remove fallback; 404 unless slug matches | Random handle 404s even with one user | FIXED (Batch 1) |
| F-07 | HIGH | High | **Phone OTP → billing email attached with `email_confirm: true` via service role** without verifying ownership of that email. | Account/billing identity | `stripe.js:83-99` | A07; CWE-287 | Require email OTP verification before confirm; never force-confirm | Cannot bind another person’s email as confirmed | FAIL |
| F-08 | HIGH | Medium | **CUE accepts client-supplied `event` / business context without server ownership check** (DB path checks `user_id` only when `eventId` used). | AI data leakage / prompt injection volume | `cue/chat.js:248-275` | A01; LLM01 | Load context server-side from caller’s `user_data` only | Tampered event payload ignored | FAIL |
| F-09 | MEDIUM | High | **Portal returns full `djProfile` + `djUserId`.** | Owner PII overshare to anyone with link | `portal-data.js:167-169` | A01; CWE-200 | Public profile allowlist (mirror `booking-page.js`) | Response lacks home address / internal fields | FAIL |
| F-10 | MEDIUM | Medium | **Legacy name+client matching** for contracts/invoices/questionnaires can cross-attach sibling events. | Cross-event docs | `portal-data.js:83-97` | A01; CWE-639 | ID-only linking; fail closed if IDs missing | Same client name cannot pull other event contract | FAIL |
| F-11 | MEDIUM | High | **No portal/iCal token expiry or rotation UI.** Stolen links work indefinitely. | Client event data; calendar contents | Portal mint `App.jsx:1554-1566`; iCal GET `ical/feed.js:34-48` | A07; CWE-613 | Expiry, revoke, rotate; audit log | Revoked token 401 | FAIL |
| F-12 | MEDIUM | High | **In-memory rate limits** on serverless are not durable; Upstash unused. | Abuse of public/AI/email APIs | Multiple `rateLimitMap` files; `package.json` has `@upstash/redis` unused | A04; CWE-770 | Shared Redis limits + CAPTCHA on public forms | Burst across instances still limited | FAIL |
| F-13 | MEDIUM | High | **Public signup (`shouldCreateUser: true`) + Stripe SaaS** conflicts with confirmed private OS. | Unauthorized accounts | `AuthOtpPages.jsx:294-301` | A04 | Disable public signup; keep owner account only; remove/disable Stripe plan gating for single-business use | Public signup rejected | FAIL |
| F-14 | MEDIUM | High | **Staff auth not implemented.** Owner confirmed owner-login-only for now. | Full CRM if owner login is shared | Staff CRM `App.jsx`; no staff auth | A01 | Accepted for now: never share owner login; revisit invite-only staff later if needed | N/A until staff auth is requested | ACCEPTED RISK |
| F-15 | MEDIUM | High | **`send-email` accepts raw HTML** from client; `notifyAdmin` emails hardcoded/admin inbox. | Phishing via CuePoint From domain | `send-email.js:137-141`, `172-215` | A03; CWE-79 | Server templates / sanitize; stricter admin notify | HTML script not preserved as executable phishing page | FAIL |
| F-16 | MEDIUM | High | **HTML injection in webhook welcome + notify-launch emails** (unescaped name). | Email HTML injection | `webhook.js:74`; `notify-launch.js:91-98` | A03; CWE-79 | Escape like `escHtml` elsewhere | Malicious name rendered escaped | FAIL |
| F-17 | MEDIUM | High | **Public handlers full-scan `user_data`** with service role (DoS + cost as data grows). | Availability | `booking-page.js:75-78`; `meetings.js:310-313` | A04 | Indexed handle table | Lookup O(1) | FAIL |
| F-18 | MEDIUM | High | **Google OAuth refresh tokens in `user_data`** — same store as CRM; catastrophic if RLS weak. | Calendar takeover | `googleCalendar.js:8-52` | A02; CWE-522 | Encrypt / separate secrets table; RLS proven | Other users cannot read key | FAIL (conditional on F-01) |
| F-19 | MEDIUM | High | **`api/` has no lockfile**; version drift vs root Supabase client. | Supply chain | `api/package.json`; missing `api/package-lock.json` | A06 | Add lockfile; pin; Dependabot | CI fails without lock | FAIL |
| F-20 | LOW | High | **CORS `*` on portal / webhook / meetings fallback.** | Browser abuse of capability APIs | `portal-data.js:123`; `meetings.js:400-403` | A05 | Tighten to known origins where possible | — | FAIL |
| F-21 | LOW | High | **No CSP / HSTS / frame-ancestors in `vercel.json`.** | XSS impact amplification | `vercel.json` routes only | A05 | Report-only CSP first | Headers present on staging | FAIL |
| F-22 | LOW | High | **Initial screen trusts localStorage** to choose `"app"` before session resolves (flash / UX; not full bypass). | Confusion | `App.jsx:25814-25823` | A04 | Default `loading` until session | — | FAIL |
| F-23 | LOW | High | **Hardcoded admin email fallback** `ivstudiogroup@gmail.com`. | PII to personal inbox; enumeration of ops email | `booking-submit.js:127`; `send-email.js:10`; `notify-launch.js:91` | A05 | Env-only; remove hardcode | — | FAIL |
| F-24 | INFO | High | **Client event payments not via Stripe** — `allowPayments: false` on portal. Event invoices are CRM records. | N/A | `portal-data.js:177-178` | — | Keep; don’t trust browser for payment status | — | PASS (design) |
| F-25 | INFO | High | **No GitHub Actions in repo** — no automated audit/CI security gates. | Supply chain visibility | No `.github/workflows` | A06 | Add CI audit + lint | — | FAIL |
| F-26 | MEDIUM | High | **Portal tokens in URL hash / share links**; analytics/Referer risk if ever moved to query on API. API uses query `token`. | Stolen portal access | `App.jsx:1491-1492`; `portal-data.js:128-129` | A01; CWE-598 | Prefer POST body for token; revoke; avoid logging | Proxy logs redacted | PARTIAL |
| F-27 | HIGH | Medium | **Idempotency / replay for Stripe webhooks** not evident. | Duplicate plan updates / welcome emails | `webhook.js` switch without event id store | A04; CWE-799 | Persist processed `event.id` | Replay no duplicate side effects | FAIL |
| F-28 | INFO | High | **Sensitive CRM in localStorage** — XSS becomes full data theft. | All local CRM | `App.jsx` storage hooks | A03 | Reduce persistence; harden CSP XSS | — | ACCEPTED RISK until CSP |

---

## 8. Section checklist (A–O) condensed

| Area | Verdict |
|------|---------|
| A. Secrets / env | No secret **values** in tree; `.gitignore` covers `.env*`; no tracked env. Git history not exhaustively proven clean → MANUAL. Service role only in server `process.env` references. |
| B. Auth | OTP good; public signup present; no MFA evidence; metadata roles unsafe; session via Supabase. |
| C. Authorization / isolation | **Top risk.** Blob model + missing repo RLS; no staff authz; portal mostly event-scoped with residual legacy match. |
| D. Portal / links | Strong entropy; weak lifecycle (no expiry/revoke); overshare profile. |
| E. Injection | Parameterized Supabase queries; HTML email XSS; AI treats data as data in prompts (good) but client context trust (bad). |
| F. Public forms | Limits + validation partial; no CAPTCHA; full scans. |
| G. Contracts / invoices / payments | Portal cannot rewrite invoices; signing controlled; SaaS Stripe ≠ client invoice payments; webhook sig OK; replay/idempotency weak; no e-sign legal claim. |
| H. Files | Data URL images; PDF import size cap in CUE lib; no malware scan; no Storage bucket policies in repo. |
| I. Database | Service role ubiquitous in APIs; encryption/PITR MANUAL; seed/prod copy MANUAL. |
| J. API | Inventory above; several HIGH issues. |
| K. Frontend | Anon key expected; no security headers; localStorage CRM. |
| L. Logging | Some `console.error` with messages; webhook logs emails; avoid logging tokens (mostly). Incomplete audit trail. |
| M. Dependencies | `npm audit` **not run** (no `node_modules`; install not approved). |
| N. AI | Prompt-injection awareness in system rules; open proxy + client context undermine controls. |
| O. Backups | Not evidenced in repo → MANUAL. |

---

## 9. Unknowns / MANUAL VERIFICATION

1. Production Supabase RLS policies on every table and storage bucket.  
2. Whether Auth hooks prevent clients changing `role` / `plan`.  
3. Owner MFA, session settings, leaked password protection.  
4. Vercel env: preview vs prod; who can read secrets.  
5. Stripe webhook endpoint secrets and dashboard config.  
6. Google OAuth redirect URI allowlist.  
7. Backup/PITR and restore test.  
8. Whether production still has multiple DJ tenants.  
9. Log sinks (Vercel/Supabase) retention and access.  
10. Secret scanning / Dependabot on GitHub.

---

## 10. Test results (commands run)

| Command / action | Result |
|------------------|--------|
| Repository file inventory + targeted code review | Completed |
| Secret pattern scan (locations only) | No hardcoded key **values** found in tracked source |
| `npm audit` / `npm run build` / lint | **Not run** — `node_modules` absent; installing packages requires approval |
| Live tests against production / Supabase | **Not run** (policy) |
| Emulator negative RLS tests | **Not run** — no policies in repo / no credentials |

### Proposed security tests (fake data only)

See `CUEPOINT_SECURITY_CHECKLIST.md`. Priority negatives: User A vs B `user_data` with anon key; portal token/event mismatch; join-token Meet-link; cron without secret; Anthropic body smuggling; metadata role escalation.

---

## 11. Prioritized remediation plan (batches — **do not implement until approved**)

### Batch 0 — Verify before coding
- Export and review Supabase RLS + Auth hooks (F-01, F-02).  
- Confirm single-tenant vs SaaS intent.

### Batch 1 — Kill switches (small, high impact) — **DONE**
- Disable or lock down `/api/anthropic/v1/messages` (F-03).  
- Fix cron auth (F-04).  
- Remove `findDjByHandle` sole-user fallback (F-06).  
- Restrict meeting PATCH `meetLink` to owner Bearer only (F-05) — required by product rule.

### Batch 2 — Identity & privilege
- Move role/plan to `app_metadata` (F-02).  
- Fix phone→email confirm (F-07).  
- Disable public signup + Stripe SaaS gating for private OS (F-13).

### Batch 3 — Portal / data minimization
- Public profile allowlist; drop `djUserId` (F-09).  
- Remove legacy name matching (F-10).  
- Token revoke/rotate (F-11).

### Batch 4 — Abuse resistance
- Upstash durable rate limits (F-12).  
- Handle index table (F-17).  
- Email HTML escaping (F-15, F-16).

### Batch 5 — Hardening
- CSP report-only, security headers (F-21).  
- `api/package-lock.json` + CI audit (F-19, F-25).  
- Webhook idempotency (F-27).

**Side effects (now decided):** Disabling public signup/Stripe is intended. Clients lose self-serve Meet link entry (intended — owner sets URL). RLS mistakes can still lock out the owner — verify policies carefully.

---

## 12. Residual risk

After Batches 0–2, residual risk remains from: stolen OTP/portal links, XSS→localStorage theft, dependency vulns, provider compromise, and incomplete staff model. Professional pentest still recommended before treating CuePoint as “ready.”

---

## 13. Internal Production Readiness verdict

### NOT READY — SECURITY WORK REQUIRED

Do **not** treat the system as ready for broader staff/client production use until at least: RLS verified (or fixed), metadata privilege escalation closed, Anthropic open proxy removed, cron auth fixed, and meeting Meet-link authz fixed.

Alternate verdicts after work:
- **READY AFTER MANUAL SECURITY ACTIONS** — if Batch 0 proves RLS+hooks already correct **and** Batch 1 code fixes land.  
- **READY FOR AUTHORIZED STAGING TESTING** — after Batches 1–3 on staging with negative tests.  
- **BLOCK INTERNAL DEPLOYMENT** — if production RLS is confirmed missing or service role is exposed to browsers (not observed in source, but must be checked).
