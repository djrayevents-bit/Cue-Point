# CuePoint Manual Security Actions

Owner checklist for controls that **cannot** be proven from the repository alone.  
**Do not paste passwords, API keys, OTP codes, or real customer records into chat.**

Mark each item: ☐ Todo · ☑ Done · ✦ N/A

---

## 1. Product intent (decided 2026-09-11)

☑ **Private OS** — DJ Ray Events only (not multi-DJ SaaS).  
☑ **Owner login only** — no staff/client accounts for now. Staff = CRM records; clients = portal links. **Never share the owner login.**  
☑ **Owner sets meeting URL only** — join-token clients must not set `meetLink`.  
☐ Confirm how to handle leftover **public signup / Stripe gating / Super Admin** in product UI (recommend: disable/remove).  
☐ Confirm who may hold `superadmin` (ideally: nobody in `user_metadata`; use locked `app_metadata` if ever needed).

---

## 2. Supabase — Authentication

☐ Dashboard → Authentication → Providers: only Email OTP / Phone as intended.  
☐ Disable unused providers.  
☐ Confirm **MFA** options for the owner account; enable where available.  
☐ Session duration / refresh settings reviewed.  
☐ **Auth Hooks / triggers:** block clients from setting `role`, `plan`, `subscription_status`, `stripe_*` in `user_metadata` — or migrate those to `app_metadata`.  
☐ Review user list: remove unknown accounts; disable public signups if private OS.  
☐ Check leaked-password / bot protection settings if offered.  
☐ Review email/SMS rate limits and template contents (no sensitive URLs beyond necessity).

---

## 3. Supabase — Database & RLS (highest priority)

☐ Apply repo SQL: `supabase/rls-private-os.sql` (RLS + optional `stripe_webhook_events`).
☐ Apply `supabase/dj-handles.sql` (O(1) booking/meeting handle lookup).
☐ Apply `supabase/ical-feed-lifecycle.sql` (`expires_at` / `revoked_at` on `ical_feeds`).


☐ For every table exposed to the anon/authenticated roles (`user_data`, `ical_feeds`, `launch_notify_signups`, any `events` table, storage metadata):  
  - RLS **enabled**  
  - No policy that allows `USING (true)` for SELECT/UPDATE/DELETE on sensitive data  
  - DJ policies constrain `user_id = auth.uid()`  
☐ Confirm **service_role** is never used in browser env vars.  
☐ Inspect **SECURITY DEFINER** functions/views for privilege bypass.  
☐ Confirm Realtime publication on `user_data` does not broaden read access beyond RLS.  
☐ Run negative tests with **fake** User A / User B (never production customers).

### Suggested negative tests (staging)

1. User A anon client: `from('user_data').select('*').eq('user_id', USER_B)` → 0 rows / error.  
2. User A: upsert into User B’s `user_id` → denied.  
3. User A: read `googleCalendarAuth` for User B → denied.  
4. Unauthenticated: select `user_data` → denied.

---

## 4. Supabase — Storage (if used)

☐ No public buckets for contracts, layouts, IDs, or client docs.  
☐ Bucket policies match event/owner authorization.  
☐ Signed URLs expire quickly.  
*(Repo shows little/no Storage API usage — confirm nothing was configured manually.)*

---

## 5. Vercel — Hosting & env

☐ Production vs Preview env vars separated.  
☐ Required secrets present only on server (names only checklist):  
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`  
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`  
  - `RESEND_API_KEY`, `ADMIN_NOTIFY_EMAIL`  
  - `ANTHROPIC_API_KEY`  
  - `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`  
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`  
  - `CRON_SECRET` (**required** after Batch 1 — Vercel Cron sends Bearer `CRON_SECRET`) or `MEETING_REMINDER_SECRET`  
  - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (optional; durable rate limits — falls back to memory)  
  - `IP_HASH_SALT`, `APP_URL`  
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (public by design)  
☐ Preview deployments cannot use production Stripe live keys / prod DB if avoidable.  
☐ Deployment protection / access control for preview apps reviewed.  
☐ Logs redaction: ensure tokens and portal links are not retained unnecessarily.  
☐ (Recommended) Create an Upstash Redis REST database and add the two env vars above so rate limits span all Vercel instances.

---

## 6. Stripe

☐ Webhook endpoint URL correct; signing secret matches `STRIPE_WEBHOOK_SECRET`.  
☐ Only expected events enabled.  
☐ Customer Portal configuration reviewed.  
☐ No client-event card collection outside Stripe (confirm business process).  
☐ Restrict dashboard users.

---

## 7. Resend / email

☐ Domain authentication (SPF/DKIM/DMARC).  
☐ API key scoped; rotate if old.  
☐ Confirm `ADMIN_NOTIFY_EMAIL` — remove reliance on personal Gmail hardcoding in code after fix approval.  
☐ Review sent-mail logs for unexpected volume.

---

## 8. Google Calendar OAuth

☐ Redirect URI allowlist equals production `/api/meetings` (and staging if any).  
☐ OAuth client type correct; secrets only on server.  
☐ Connected Google account is the business calendar, not a personal throwaway without 2FA.

---

## 9. Anthropic / AI

☐ API spend limits and alerts enabled.  
☐ Data retention / training opt-out settings reviewed for business data.  
☑ `/api/anthropic/v1/messages` disabled in Batch 1 (returns 410). Use `/api/cue/chat` only.
☐ Confirm Anthropic spend limits remain enabled.

---

## 10. Spotify

☐ Client credentials are app-only (not user OAuth); rotate if exposed.  
☐ Usage quotas monitored.

---

## 11. GitHub

☐ Secret scanning enabled.  
☐ Dependabot / vulnerability alerts enabled.  
☐ Branch protection on `main`.  
☐ Review who has admin on `djrayevents-bit/Cue-Point`.  
☐ Confirm no `.env` or dumps ever committed (scanning tools).

---

## 12. Access review

☐ List all Supabase users — only intended owner (and future staff).  
☐ List Vercel / Stripe / Google / Resend / Anthropic / GitHub members.  
☐ Rotate any shared passwords; prefer SSO + MFA.  
☐ Revoke portal links for finished/cancelled events (process until product supports revoke).  
☐ Revoke iCal subscribe links if devices lost.

---

## 13. Backups & recovery

☐ Supabase PITR / daily backups enabled.  
☐ Who can restore? Is backup access separate from daily admin?  
☐ Document restore steps for `user_data` corruption.  
☐ **Test restore on staging** at least once.  
☐ Export critical contracts/invoices offline if needed for business continuity.

---

## 14. Privacy / legal / incident

☐ Privacy notice matches actual processors (Supabase, Vercel, Stripe, Resend, Anthropic, Google, Spotify).  
☐ Incident contacts: owner phone/email; provider support links.  
☐ Do **not** claim e-signature or PCI compliance from this audit — ask qualified counsel for contract/signature legal questions.

---

## 15. After any suspected leak

☐ Rotate: Supabase service role, anon (if needed), Stripe secret + webhook secret, Resend, Anthropic, Google client secret, Spotify secret, cron secret.  
☐ Invalidate sessions (Supabase).  
☐ Regenerate portal tokens and calendar tokens for active events.  
☐ Review Auth logs and Vercel logs for abuse window.  
☐ **Do not rewrite git history** without a coordinated plan.

---

## What not to send back to the auditor

- Secret values, connection strings, private keys  
- Real customer exports  
- Production OTP codes / MFA codes  
- Full database dumps


## Optional bot protection

☐ Create a Cloudflare Turnstile site and set `TURNSTILE_SECRET_KEY` (Vercel) + `VITE_TURNSTILE_SITE_KEY` (build env).
