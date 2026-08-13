# Legal documents (local)

Public legal suite for CuePoint Planning LLC. Hub: `/legal` (`public/legal.html`).

| Document | Path | File |
|----------|------|------|
| Legal Center | `/legal` | `public/legal.html` |
| Privacy Policy | `/privacy` | `public/privacy.html` |
| Terms of Service | `/terms` | `public/terms.html` |
| Cookie Policy | `/cookies` | `public/cookies.html` |
| SMS / OTP Terms | `/sms-terms` | `public/sms-terms.html` |
| Electronic Signatures | `/esign` | `public/esign.html` |
| Refunds & Cancellation | `/refunds` | `public/refunds.html` |
| Subprocessors | `/subprocessors` | `public/subprocessors.html` |
| Acceptable Use | `/acceptable-use` | `public/acceptable-use.html` |
| Contact | `/contact` | `public/contact.html` |

Shared styles: `public/legal.css`

## Owner fill-ins (before launch)
1. **Street mailing address** — HTML comments mark where to paste it on Privacy / Legal Center / Terms company blocks
2. **Attorney review** — especially Terms liability, refunds, ESIGN, and SMS consent
3. **SMS production details** — confirm STOP/HELP and sender match Supabase/Twilio setup
4. **Analytics** — if you add tracking, update Cookie Policy first

## Product wiring (already in this branch)
- Landing footer → Legal + core policies
- Contact page → legal subjects + full footer
- Signup → linked Terms / Privacy / SMS Terms
- Sign-in → Privacy / Terms / SMS links
- Portal e-sign → `/esign`
- `vercel.json` routes + `sitemap.xml`

## Do not push until asked
Work stays local on `cursor/legal-policies-sept1-3506` until you explicitly request a push/PR.
