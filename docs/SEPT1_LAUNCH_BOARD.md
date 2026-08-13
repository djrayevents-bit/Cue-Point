# CuePoint — September 1 Launch Board

Tracked work to launch CuePoint Planning on **September 1, 2026**.

**How to use:** move items by changing status (`todo` → `in_progress` → `blocked` → `done`). Check the box when done. Keep claims on the marketing site aligned with what is actually live.

**Last audit:** August 13, 2026 (repo + live site scan)

---

## Status legend

| Status | Meaning |
|--------|---------|
| `todo` | Not started |
| `in_progress` | Actively being worked |
| `blocked` | Waiting on account, legal, assets, or another item |
| `done` | Verified in production |

---

## Board summary

| Column | Open | Notes |
|--------|------|--------|
| P0 — Payments | 8 | SaaS billing exists; client card pay is off |
| P0 — Legal & security | 10 | Open security PR #33; legal needs review |
| P0 — Professional look | 7 | No real photos in repo; landing is mockup-only |
| P1 — Connect / integrations | 5 | Env + domain email verification |
| P1 — Product honesty | 4 | Don’t market Coming Soon as live |
| P2 — Launch ops | 6 | Dry runs, mobile, support |

---

## Column: P0 — Payments

Must work for taking money (SaaS + client deposits).

| ID | Status | Item | Detail |
|----|--------|------|--------|
| PAY-01 | todo | [ ] SaaS Checkout E2E | Signup → OTP → Stripe Checkout → webhook → plan unlock on production |
| PAY-02 | todo | [ ] Confirm Stripe prod env | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `APP_URL`, Supabase + Resend keys |
| PAY-03 | todo | [ ] Fix Stripe return URLs | Success/cancel currently hit `/index.html?stripe=…`; route cleanly through `/app` |
| PAY-04 | todo | [ ] Founder price enforcement | First 50 @ $20 vs $50 — enforce in Stripe (coupon/price/limit), not copy only |
| PAY-05 | todo | [ ] Failed payment recovery | `past_due` lock → Billing Portal “Update payment method” → restore access |
| PAY-06 | todo | [ ] Ship client portal card pay | Stripe Payment Links or Connect for deposits/balances; flip `PORTAL_PAYMENTS_LIVE` |
| PAY-07 | todo | [ ] Enable portal payments flag | After PAY-06: set `PORTAL_PAYMENTS_LIVE = true` and QA client pay flow |
| PAY-08 | todo | [ ] Launch-story for manual pay | If client card pay slips: document Venmo/Zelle/manual tracking and remove “live payments” marketing claims |

**Code anchors**
- `api/stripe.js`, `api/webhook.js`
- `src/App.jsx` — `PORTAL_PAYMENTS_LIVE = false` (client pay hard-off)

---

## Column: P0 — Legal & security

| ID | Status | Item | Detail |
|----|--------|------|--------|
| LEG-01 | todo | [ ] Merge security PR #33 | `app_metadata` entitlements, API hardening, RLS — still open |
| LEG-02 | todo | [ ] Apply RLS in production | Run/apply `supabase/user-data-rls.sql` (or equivalent); verify tenant isolation |
| LEG-03 | todo | [ ] Soft-launch holes | Confirm PR #25 leftovers vs main (portal token index/matching/locks) |
| LEG-04 | todo | [ ] Lawyer review Terms + Privacy | Real legal pass before Sept 1 |
| LEG-05 | todo | [ ] Align Privacy with OTP auth | Policy still describes password accounts; product uses email/SMS OTP |
| LEG-06 | todo | [ ] LLC identity on legal pages | Legal name, mailing address, clear controller contact |
| LEG-07 | todo | [ ] Clickable Terms/Privacy on signup | Auth copy is not linked; record acceptance |
| LEG-08 | todo | [ ] ESIGN / UETA language | Portal e-sign claims legally binding — add proper notice |
| LEG-09 | todo | [ ] SMS OTP compliance | Consent + opt-out language for Twilio/Supabase SMS |
| LEG-10 | todo | [ ] Verify support email | `support@` / `hello@cuepointplanning.com` deliverability + replies |

**Code anchors**
- `public/terms.html`, `public/privacy.html`
- `src/components/AuthOtpPages.jsx` (Terms text not linked)
- Open PR: https://github.com/djrayevents-bit/Cue-Point/pull/33

---

## Column: P0 — Professional look (photos & brand)

| ID | Status | Item | Detail |
|----|--------|------|--------|
| DES-01 | blocked | [ ] Source real photos | Shoot/select DJ Ray / CuePoint event + product photos (none in repo today) |
| DES-02 | todo | [ ] Full-bleed photo hero | Brand + one headline + CTA + real photo; retire inset CSS mockup as primary visual |
| DES-03 | todo | [ ] Real product screenshots | Replace feature-panel fake UI with live app screenshots |
| DES-04 | todo | [ ] Unify brand system | Landing: Inter + pink/purple/cyan vs app: system fonts + `#6C4DF6` — one system |
| DES-05 | todo | [ ] Polish Contact page | Email-only + emoji feels unfinished; match brand |
| DES-06 | todo | [ ] Fix legal footer links | Consistent `/privacy` / `/terms` routes (avoid `.html` mismatches) |
| DES-07 | todo | [ ] OG / social share images | Links must look intentional when shared |

**Code anchors**
- `public/landing.html` (mockup-only hero)
- `src/brand.js`
- `public/` — no JPG/PNG marketing assets (icons only)

---

## Column: P1 — Connect / integrations

| ID | Status | Item | Detail |
|----|--------|------|--------|
| INT-01 | todo | [ ] Spotify prod credentials | Confirm `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` |
| INT-02 | todo | [ ] Google Calendar env | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` if meetings sync is launch-critical |
| INT-03 | todo | [ ] Resend DNS | SPF / DKIM / DMARC for cuepointplanning.com |
| INT-04 | todo | [ ] Anthropic / CUE gating | Keys live + paid-user gate after security merge |
| INT-05 | todo | [ ] Meetings cron secrets | `CRON_SECRET` / reminder cron healthy on Vercel Hobby |

---

## Column: P1 — Product honesty

| ID | Status | Item | Detail |
|----|--------|------|--------|
| HON-01 | todo | [ ] Portal Coming Soon labels | Online Payments + Messaging — don’t market as live |
| HON-02 | todo | [ ] Landing roadmap tags | CSV Import / Recurring Events clearly “coming” or ship them |
| HON-03 | todo | [ ] Clean stale admin roadmap | Internal “This week” Stripe/Supabase items are outdated |
| HON-04 | todo | [ ] Day-of Mode messaging | Feature exists in app — drop stale “notify when launches” if unused |

---

## Column: P2 — Launch ops

| ID | Status | Item | Detail |
|----|--------|------|--------|
| OPS-01 | todo | [ ] Full happy-path dry run | Signup → event → contract → portal sign → invoice → pay/mark paid |
| OPS-02 | todo | [ ] Mobile pass | Landing + signup + portal on phone widths |
| OPS-03 | todo | [ ] Trial CTA analytics | Track Start Free Trial conversions |
| OPS-04 | todo | [ ] Support playbook | Payment fail + broken portal link scripts |
| OPS-05 | todo | [ ] Data export / deletion | Match Privacy promises |
| OPS-06 | todo | [ ] Sitemap refresh | Update `lastmod`; decide public `/changelog` SEO |

---

## Already in good shape (do not reopen unless broken)

- Live site: https://cuepointplanning.com (www → apex)
- Marketing routes: `/`, `/contact`, `/terms`, `/privacy`
- SaaS Stripe Checkout + Customer Portal + webhook code paths
- OTP auth, client portal (contracts / questionnaires / music), invoice tracking, core CRM

---

## Suggested work order (Sept 1)

1. **LEG-01 → LEG-02** (security merge + RLS) in parallel with **PAY-01 → PAY-05** (SaaS billing proof)
2. **DES-01** (photos) unblocks **DES-02 → DES-07**
3. **PAY-06 → PAY-07** (client card pay) or explicit **PAY-08** fallback story
4. **LEG-04 → LEG-10** legal/compliance pass
5. **INT-*** + **HON-*** + **OPS-*** before soft launch week

---

## Related open PRs

| PR | Title | Relevance |
|----|-------|-----------|
| [#33](https://github.com/djrayevents-bit/Cue-Point/pull/33) | Security audit: app_metadata entitlements, API hardening, RLS | LEG-01 |
| [#25](https://github.com/djrayevents-bit/Cue-Point/pull/25) | Soft-launch holes | LEG-03 (verify vs merged follow-ups) |
