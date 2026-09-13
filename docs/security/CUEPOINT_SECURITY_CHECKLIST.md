# CuePoint Security Checklist

Use this as a living control checklist. Update status after each approved fix or manual verification.

Statuses: `PASS` · `FAIL` · `PARTIAL` · `NOT APPLICABLE` · `MANUAL VERIFICATION` · `FIXED` · `FALSE POSITIVE` · `ACCEPTED RISK`

---

## A. Secrets and environment

| Control | Status | Notes |
|---------|--------|-------|
| No hard-coded API key values in source | PASS | Env var references only |
| `.env` files gitignored | PASS | `.gitignore` lines 7–11 |
| No privileged keys in `VITE_*` | PASS | Only URL + anon key |
| Service role server-only | PASS (code) | All `SUPABASE_SERVICE_ROLE_KEY` under `api/` |
| `.env.example` safe | NOT APPLICABLE | None present |
| GitHub Actions permissions least privilege | PASS | `contents: read` on CI workflow |
| Git history free of secrets | MANUAL VERIFICATION | Owner: run secret scanning |
| Production secrets rotated if ever exposed | MANUAL VERIFICATION | See manual actions |

## B. Authentication

| Control | Status | Notes |
|---------|--------|-------|
| Server-side session checks on sensitive APIs | PARTIAL | Most `/api` yes; CRM relies on RLS |
| Invite-only staff registration | ACCEPTED RISK | Owner-login-only confirmed; no staff auth for now |
| Public signup disabled (private OS intent) | FIXED | Signup UI closed; shouldCreateUser false on login |
| Login rate limiting | MANUAL VERIFICATION | Supabase dashboard |
| Account enumeration resistance | PARTIAL | Login hints “no account”; notify-launch OK |
| MFA for owner | MANUAL VERIFICATION | |
| Session revocation / logout | PARTIAL | `signOut` + localStorage clear |
| OAuth state/nonce (Google) | PASS | Nonce stored server-side |
| Role not client-writable | PARTIAL | App prefers app_metadata; Auth Hook still MANUAL |
| Dev bypass production-safe | PASS | `import.meta.env.DEV` |

## C. Authorization / event isolation

| Control | Status | Notes |
|---------|--------|-------|
| RLS deny-by-default on `user_data` | MANUAL VERIFICATION | **Blocking** |
| Client A cannot read Client B portal | PARTIAL | Token↔event bind; legacy match risk |
| Client cannot rewrite invoices/contracts generically | PASS | Allowlist |
| Staff cannot access unassigned events | ACCEPTED RISK | No staff login; do not share owner OTP |
| Staff cannot access owner finances | ACCEPTED RISK | Same as above |
| Staff cannot change own role | NOT APPLICABLE | No staff auth |
| Only owner can set meeting Meet URL | FIXED | Batch 1: Bearer owner only; join token cannot PATCH meetLink |
| Cron reminders require shared secret | FIXED | Batch 1: `CRON_SECRET` / `MEETING_REMINDER_SECRET` required |
| Open Anthropic proxy disabled | FIXED | Batch 1: `/api/anthropic/v1/messages` returns 410 |
| Public schedule handle has no sole-user fallback | FIXED | Batch 1: unknown handle → 404 |
| Client cannot set payment status | PASS (portal) | Writes blocked |
| UI hide ≠ authorization | FAIL risk | CRM entirely client-driven + RLS |
| Storage bucket policies | MANUAL VERIFICATION | No Storage usage found in code |

## D. Portal and shared links

| Control | Status | Notes |
|---------|--------|-------|
| High-entropy tokens | PASS | `makeSecretToken(18)` |
| Expiry | FIXED | Portal 90d + iCal 365d on new tokens; legacy until rotated |
| Revocation | FIXED | Portal + Calendar Sync Revoke; APIs reject expired/revoked |
| Not in public indexes | PARTIAL | robots disallows `/app`; hash routes |
| Minimal URL disclosure | PARTIAL | event id visible; token in hash/API |
| Calendar feed revocable | FIXED | Calendar Sync → Revoke link |
| Calendar minimum data | MANUAL VERIFICATION | ICS built client-side |

## E. Input validation / injection

| Control | Status | Notes |
|---------|--------|-------|
| Parameterized DB access | PASS | Supabase client |
| Stored XSS in notes/requests | MANUAL VERIFICATION | Need DOM sink review + CSP |
| Open redirects | PARTIAL | OAuth redirects constructed server-side |
| Mass assignment of ownership fields | PARTIAL | Portal filters; CRM trusts client JSON |
| Dangerous HTML rendering | PARTIAL | Email HTML; review React sinks |
| Server-side schema validation | PARTIAL | Ad hoc |

## F. Public forms / abuse

| Control | Status | Notes |
|---------|--------|-------|
| Rate limiting durable | PARTIAL | Upstash when env set; memory fallback |
| CAPTCHA / bot signals | PARTIAL | Turnstile when env keys set; otherwise skipped |
| Oversized request protection | PARTIAL | String caps on booking |
| No existing customer data returned | PASS (intent) | booking-page public fields only |
| Email flooding controls | PARTIAL | Shared rateLimit helper |

## G. Contracts / invoices / payments / signatures

| Control | Status | Notes |
|---------|--------|-------|
| Invoice totals server-authoritative for client payments | NOT APPLICABLE | Portal payments disabled |
| Client cannot change prices via portal | PASS | |
| Contract sign cannot retarget other events | PARTIAL | Checks link; legacy match |
| Stripe webhook signature | PASS | |
| Webhook replay/idempotency | FAIL | |
| No raw card storage | PASS | Stripe Checkout |
| Refunds/admin money changes owner-only | PARTIAL | CRM-only; no staff split |

## H. File security

| Control | Status | Notes |
|---------|--------|-------|
| Type allowlists | PARTIAL | `accept="image/*"`; PDF for CUE |
| Random storage names | NOT APPLICABLE / PARTIAL | Often inline data URLs |
| Private-by-default object storage | MANUAL VERIFICATION | |
| Authz on download | PARTIAL | Portal gated; CRM local |
| Malware scanning | FAIL | None |

## I. Database / data protection

| Control | Status | Notes |
|---------|--------|-------|
| DB not publicly writable without auth | MANUAL VERIFICATION | |
| TLS in transit | MANUAL VERIFICATION | Supabase/Vercel defaults likely |
| Encryption at rest | MANUAL VERIFICATION | |
| Response minimization (portal) | FAIL | Full djProfile |
| Audit log of owner actions | FAIL | Incomplete |
| Backups | MANUAL VERIFICATION | |

## J. API security

| Control | Status | Notes |
|---------|--------|-------|
| Auth on expensive endpoints | PASS | Proxy disabled; cue/chat daily spend caps |
| Object ownership | PARTIAL | |
| CORS tightened | FIXED | Shared allowlist; no `*` |
| Rate limits | PASS | Upstash when configured; memory fallback; CUE daily caps |
| Safe errors | PARTIAL | Some `err.message` returned |
| Forgotten debug endpoints | PASS | Dev bypass build-gated |
| Cron protected | FIXED | Batch 1 secret required |

## K. Frontend / browser

| Control | Status | Notes |
|---------|--------|-------|
| No secrets in bundles beyond anon | PASS (expected) | |
| CSP | PARTIAL | Report-Only in vercel.json — review reports then enforce |
| HSTS / frame-ancestors / nosniff | MANUAL VERIFICATION / FAIL in repo | |
| Sensitive data not in analytics | MANUAL VERIFICATION | |
| Private pages not publicly cached | PARTIAL | SPA |

## L. Logging / monitoring

| Control | Status | Notes |
|---------|--------|-------|
| No passwords/tokens in logs | PARTIAL | Review Vercel logs |
| Failed login logging | MANUAL VERIFICATION | Supabase |
| Alerting on abuse | FAIL | Not in repo |
| Incident investigation capability | MANUAL VERIFICATION | |

## M. Dependencies / supply chain

| Control | Status | Notes |
|---------|--------|-------|
| Lockfiles | PARTIAL | Root yes; `api/` no |
| `npm audit` clean | MANUAL VERIFICATION | Needs install approval |
| Dependabot / SAST | FAIL | No CI |
| Abandoned / unused deps | PARTIAL | Upstash wired when env present |

## N. AI features

| Control | Status | Notes |
|---------|--------|-------|
| No cross-client retrieval in tools | PARTIAL | Client-supplied context |
| System prompt / secrets protected | PARTIAL | Open proxy undermines |
| AI output untrusted + confirm | PASS (design) | CUE confirm-before-apply |
| Spending limits | PASS | Daily CUE request/token caps via rateLimit |
| Provider retention settings | MANUAL VERIFICATION | Anthropic dashboard |

## O. Backups / continuity

| Control | Status | Notes |
|---------|--------|-------|
| Backups configured | MANUAL VERIFICATION | |
| Restore tested | MANUAL VERIFICATION | |
| Backup access isolated | MANUAL VERIFICATION | |

---

## Proposed automated / manual test cases

| ID | Test | Expected |
|----|------|----------|
| T-U1 | Unauthenticated GET sensitive `user_data` | Denied |
| T-C1 | Portal token A + eventId B | 401 |
| T-C2 | Portal POST `key=invoices` | 403 |
| T-C3 | Portal sign contract for other event | 403 |
| T-S1 | Staff account (if built) reads payroll | Denied |
| T-M1 | Join token PATCH `meetLink` | 403 after fix |
| T-M2 | Random handle with one user | 404 after fix |
| T-R1 | Cron without secret | 401 after fix |
| T-A1 | Anthropic proxy custom `max_tokens` | Rejected after fix |
| T-P1 | `updateUser({ role: 'superadmin' })` | No privilege |
| T-W1 | Replay Stripe event id | Idempotent |
| T-X1 | XSS payload in music request note | Escaped / CSP blocked |
| T-F1 | Booking submit 100× | Rate limited across instances |

---

## Commands requiring approval

- `npm install` (root and/or `api/`)
- `npm audit`
- `npm run build`
- Any Supabase SQL against shared projects
- Any test hitting production `cuepointplanning.com`
- Secret rotation
- Installing security scanners (semgrep, zap, etc.)
