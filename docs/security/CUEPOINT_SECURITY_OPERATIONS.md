# CuePoint Security Operations

Operational guidance for running CuePoint securely as DJ Ray Events’ private business OS.

---

## 1. Security ownership

| Role | Responsibility |
|------|----------------|
| Owner (DJ Ray Events) | Access reviews, MFA, provider dashboards, go/no-go on releases |
| Development / agent changes | Code fixes only after approval; never deploy secrets to git |
| Providers | Supabase, Vercel, Stripe, Resend, Google, Anthropic, Spotify |

There is no separate security team in-repo. Treat the owner as the security approver.

---

## 2. Environments

| Environment | Purpose | Data rules |
|-------------|---------|------------|
| Local (`vite` DEV) | UI work; optional `?dev=1` auth bypass | Fake data only |
| Vercel Preview | PR previews | Prefer non-prod keys/DB |
| Production | Real clients/events | Least privilege; change control |

**Rule:** Never copy production `user_data` into laptop localStorage dumps for debugging without redaction.

---

## 3. Change control (security-sensitive)

1. Propose fix batch (see audit remediation plan).  
2. Owner approves scope.  
3. Implement on a feature branch with regression tests where possible.  
4. Staging verification (negative authz tests).  
5. Production deploy.  
6. Update `CUEPOINT_SECURITY_AUDIT.md` finding statuses + checklist.  
7. **Do not** apply risky production DB migrations without backup + rollback plan.

---

## 4. Monitoring & detection (minimum viable)

Until dedicated tooling exists, check weekly:

- Vercel function error spikes (`meetings`, `booking-submit`, `cue/chat`, `anthropic`)  
- Resend send volume anomalies  
- Anthropic spend  
- Stripe webhook failures  
- Supabase Auth: new unknown users  
- Sudden growth in `launch_notify_signups` or leads  

**Alert ideas (manual or provider-native):** spend caps; auth signup spikes; 429 storms; webhook signature failures.

---

## 5. Logging hygiene

**Never log:** passwords, OTP codes, access tokens, portal/calendar/join tokens, Stripe secrets, service role keys, full signature images, full contract bodies, card data.

**Do log (when implementing):** authz denials (user id + route + reason code), role changes, webhook event ids processed, admin exports/deletes.

Today many routes use `console.error` with messages — review Vercel log retention and access.

---

## 6. Incident response (lightweight playbook)

1. **Contain:** revoke compromised secrets; disable abused endpoints (Anthropic proxy, public signup) via env/deploy.  
2. **Assess:** which `user_id` blobs / portal tokens / Google tokens exposed.  
3. **Eradicate:** rotate keys; regenerate portal + iCal tokens; force sign-out.  
4. **Recover:** restore from backup if data corrupted.  
5. **Notify:** affected clients if PII likely exposed (follow legal advice).  
6. **Record:** timeline, actions, follow-up fixes.

Contacts: owner; Supabase/Vercel/Stripe support; counsel if contracts/PII involved.

---

## 7. Access review cadence

| Cadence | Action |
|---------|--------|
| Monthly | Review Supabase users, Vercel members, Stripe members |
| Per event end | Revoke portal link when process exists |
| Per staff departure | N/A until staff accounts exist — change owner password/OTP factors if shared |
| Quarterly | Backup restore drill; dependency audit |

---

## 8. Dependency & supply chain ops

- Keep root `package-lock.json` committed.  
- Add `api/package-lock.json` when approved.  
- Run `npm audit` on a schedule (after install approval).  
- Prefer Dependabot PRs for patches; avoid unattended major upgrades.  
- Do not commit `node_modules`.

---

## 9. AI operations

- Prefer `/api/cue/chat` controlled prompts over open `/api/anthropic/v1/messages`.  
- Keep confirmation-before-apply for CUE actions.  
- Do not paste unrelated client data into prompts.  
- Set Anthropic billing hard limits.  
- Treat model output as untrusted text.

---

## 10. Backup & continuity ops

Document answers in the team notebook (not necessarily this repo):

- What is backed up (Postgres PITR? Vercel? Stripe is external)  
- RPO/RTO targets in business terms (e.g. “can rebuild this week’s events from email”)  
- Who can restore  
- Last restore test date  

If Supabase is unavailable: CRM localStorage on the owner’s primary browser may be stale — do not treat it as durable backup.

---

## 11. Accepted risks (track explicitly)

Add owner initials/date when accepting:

| Risk | Why accepted | Review date |
|------|--------------|-------------|
| CRM in localStorage (XSS impact) | Performance / offline UX | |
| Capability URLs for portal (link forwarding) | Client UX without accounts | |
| Staff without separate logins | Temporary ops simplicity | |

---

## 12. Related documents

- `CUEPOINT_THREAT_MODEL.md` — scenarios and assets  
- `CUEPOINT_SECURITY_AUDIT.md` — findings and verdict  
- `CUEPOINT_SECURITY_CHECKLIST.md` — control status  
- `CUEPOINT_MANUAL_ACTIONS.md` — dashboard work for the owner  

---

## 13. Reminder

Repository review and these runbooks do **not** make CuePoint unhackable, fully secure, compliant, or legally protected. Schedule independent professional review before high-stakes reliance (major season, large contracts volume, staff expansion).
