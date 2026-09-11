# CuePoint Threat Model

**Scope:** DJ Ray Events private business operating system (CuePoint repository)  
**Mode:** Read-only repository audit  
**Date:** 2026-09-10  
**Status:** Draft for owner review — not a penetration test

---

## 1. Business context

CuePoint is operated by **DJ Ray Events** as an internal business OS.

### Owner-confirmed product rules (2026-09-11)

1. **Private OS** — single business (DJ Ray Events), not a multi-DJ commercial SaaS.
2. **Owner login only** — no separate staff/client authenticated accounts for now. Staff remain CRM records; clients use portal capability links.
3. **Owner sets meeting URL only** — clients with a join token must not be able to set or change `meetLink` / Meet URLs.

The repository still contains **multi-DJ SaaS leftovers** (public signup, Stripe subscription gating, booking-by-handle, Super Admin MRR dashboard). Those are now treated as **out-of-model attack surface** to remove or disable, not as intended features.

---

## 2. Assets

| Asset | Sensitivity | Where it lives |
|-------|-------------|----------------|
| Client PII (name, email, phone, addresses) | High | `user_data` keys: `clients`, `leads`, `events` |
| Event logistics, notes, timelines, music, questionnaires | High | `events`, `djTimelines`, `questionnaire*`, `requests` |
| Contracts + e-signatures | High | `contracts` (+ portal `signatureData`) |
| Invoices, deposits, balances, payroll, expenses, mileage | High | `invoices`, `payroll`, `expenses`, `mileage` |
| Staff records (pay rates, contact) | High | `staff` |
| Equipment / serials / insurance-ish notes | Medium–High | `equipment`, `wardrobe` |
| Portal / calendar / meeting capability tokens | High | `portalTokens`, `portalToken:*`, `calendarToken`, `meetings.joinToken` |
| Google Calendar OAuth refresh tokens | Critical | `user_data` key `googleCalendarAuth` |
| Stripe subscription / plan state | Medium | Supabase `user_metadata` + Stripe |
| Anthropic / Stripe / Resend / Spotify / Google API secrets | Critical | Vercel env (not in repo values) |
| Launch-list emails | Medium | `launch_notify_signups` |
| Owner identity / admin email | Medium | Hardcoded fallbacks + env |

---

## 3. Actors

| Actor | Trust | Capabilities in code today |
|-------|-------|----------------------------|
| Public visitor | Untrusted | Landing, contact, booking page/submit, meeting schedule/book, notify-launch, iCal GET by token |
| Bot / scraper | Untrusted | Same public surfaces; in-memory rate limits only |
| Client (portal) | Semi-trusted via secret URL | `#/portal/{handle}/{eventId}/{token}` → `/api/portal-data` |
| Meeting booker | Semi-trusted via join token | View/reschedule/cancel; can also set `meetLink` today |
| Authenticated DJ / owner | Trusted for own `user_id` blob | Full CRM via React + Supabase anon client |
| Staff/DJ employee | **Not an auth role (accepted for now)** | CRM records only; must not get a login until deliberately built |
| Superadmin | Highly privileged / **SaaS leftover** | `user_metadata.role === "superadmin"`; should not be required for private OS |
| Compromised integration | Untrusted | Stripe webhooks, Resend, Anthropic, Spotify, Google |
| Insider with Vercel/Supabase access | Highly privileged | Service role, env secrets, backups |

---

## 4. Entry points

### Public / unauthenticated
- `GET /`, `/contact`, `/privacy`, `/terms`, `/changelog`
- `GET /api/booking-page?handle=`
- `POST /api/booking-submit`
- `GET|POST /api/meetings` (schedule, book, join, cron reminders, Google OAuth callback)
- `GET /api/ical/feed?token=`
- `GET|POST /api/portal-data` (token capability)
- `GET /api/spotify-search` (portal token path)
- `POST /api/notify-launch`
- `POST /api/webhook` (Stripe signature)

### Authenticated DJ
- SPA `/app` (Vite + React) reading/writing `user_data` with anon key
- `POST /api/stripe`, `/api/send-email`, `/api/cue/chat`, `/api/anthropic/v1/messages`
- `POST /api/ical/feed` (publish)
- Spotify search with Bearer

### Capability URLs
- Client portal: hash route with event id + high-entropy token
- Meeting join: meeting id + `joinToken`
- Calendar subscribe: iCal token

---

## 5. Trust boundaries

```
[Browser / Public Internet]
        |  HTTPS (assumed via Vercel)
        v
[Vite SPA] ---- anon key ----> [Supabase Auth + Postgres + Realtime]
        |                              ^
        |                              | service role (bypasses RLS)
        v                              |
[Vercel Serverless /api/*] ------------+
        |
        +--> Stripe, Resend, Anthropic, Spotify, Google APIs
```

Critical boundary: **anything the browser can do with the anon key is only as safe as Supabase RLS**. Server routes that use the **service role** must enforce their own authz; a bug there is full-database access.

---

## 6. Existing protections (observed)

- Supabase Auth OTP (email/SMS); login uses `shouldCreateUser: false`
- Many expensive APIs require Bearer session (`stripe`, `send-email`, `cue/chat`, Anthropic proxy)
- Stripe webhook signature verification (`constructEvent`)
- Portal write allowlist excludes contracts/events/invoices rewrites (except controlled `signContract` / `patchEventMusic`)
- Portal token minting uses `crypto.getRandomValues` (~144 bits)
- Meeting join tokens use `crypto.randomBytes`
- `send-email` recipient allowlist against CRM contacts
- Booking submit string length caps + in-memory rate limit
- Dev auth bypass gated by `import.meta.env.DEV`
- robots.txt disallows `/app` and `/api/`

---

## 7. Threat scenarios

| # | Scenario | Likely path | Worst credible outcome | Current posture |
|---|----------|-------------|------------------------|-----------------|
| T1 | Unauthenticated internet user | Probe APIs, guess handles | Lead spam, schedule scrape, DoS via full-table scans | PARTIAL |
| T2 | Bot vs inquiry form | `booking-submit` flood | Email flood, lead pollution | Weak in-memory limits |
| T3 | Client A → Client B event | Wrong `eventId` with A’s token | Cross-event data if token/event mismatch | Portal rejects wrong event for indexed tokens |
| T4 | Client changes IDs in URL/API | Tamper `eventId` / `contractId` | Cross-event contract/invoice view | Indexed token binds event; legacy name match residual risk |
| T5 | Client changes invoice amounts | Portal POST invoice key | Fraudulent balances | Blocked by write allowlist |
| T6 | Staff accesses unassigned event | N/A — no staff auth (owner-only login accepted) | If owner password/OTP shared with staff → full access | ACCEPTED RISK until staff auth is built — do not share owner login |
| T7 | Staff accesses owner finances | Same | Full financial exposure | ACCEPTED RISK (same as T6) — mitigate by never sharing owner login |
| T8 | Stolen portal link | Forwarded email / Referer / screenshot | Full event portal for that event | No expiry/revoke UI |
| T9 | Compromised owner account | OTP phishing / stolen session | All business data + Google tokens + email send | No MFA evidence in repo |
| T10 | Leaked API key | Env leak / logs | Service-role DB, Stripe, Anthropic spend | Values not in repo; ops risk |
| T11 | Forged payment webhook | Fake Stripe events | Plan/role metadata corruption | Signature verified |
| T12 | Malicious file upload | Image/PDF as data URL / CUE PDF | XSS, storage bloat, prompt abuse | Limited server validation |
| T13 | Vulnerable dependency | Supply chain | RCE in build/runtime | No lockfile in `api/`; audit not run |
| T14 | Sensitive data in email/calendar/URL/logs | Portal tokens in hash; emails with PII | Secondary leakage | Tokens in URLs; HTML emails |
| T15 | Data loss | Accidental wipe of JSON blobs; no proven backups | Business continuity failure | MANUAL VERIFICATION |
| T16 | AI cross-client leakage | CUE context from client body | Wrong-client data in prompts / actions | Relies on DJ session + client-supplied context |
| T17 | Privilege escalation to superadmin | `updateUser({ data: { role: "superadmin" }})` | Cross-tenant admin UI if RLS weak | HIGH — metadata is client-writable in app |
| T18 | Join-token Meet-link swap | PATCH `meetLink` with join token | Client phished to attacker meeting | Confirmed in code — **violates owner rule; must fix** |
| T19 | Open Anthropic proxy | `/api/anthropic/v1/messages` | Unlimited AI spend / data exfil via model | Confirmed |
| T20 | Cron reminder abuse | Spoof `x-vercel-cron` | Mass email to clients | Confirmed weak auth |

---

## 8. Missing protections (summary)

1. Repository has **no RLS policy definitions** — production RLS must be verified manually.
2. **No authenticated staff role** matching the expected access model.
3. **Public signup + Stripe SaaS** still present — conflicts with invite-only private OS goal.
4. **Durable rate limiting** not implemented (Upstash dependency unused).
5. Portal/iCal tokens **do not expire / rotate** via product UI.
6. **Security headers / CSP** not defined in `vercel.json`.
7. **Role/plan in `user_metadata`** trusted for authorization.
8. Google refresh tokens stored in the same blob store as CRM data.

---

## 9. Assumptions & unknowns

- Production Supabase RLS, Auth hook restrictions, and storage buckets are **not** in this repo → MANUAL VERIFICATION.
- Whether CuePoint production still serves multiple DJ accounts vs only DJ Ray Events.
- Whether MFA is enabled for the owner in Supabase dashboard.
- Backup/PITR and restore drills.
- Vercel env separation (preview vs production).

---

## 10. Residual risk statement

Even after hardening, CuePoint will remain exposed to: phishing of OTP or portal links, compromised owner devices, provider outages, and zero-days in dependencies. Repository review does **not** prove the system is unhackable, compliant, or legally protected.
