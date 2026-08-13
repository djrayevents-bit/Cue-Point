# Legal documents (Sept 1)

Public legal suite for CuePoint Planning LLC. Start at **[/legal](https://cuepointplanning.com/legal)**.

| Document | Path | Purpose |
|----------|------|---------|
| Legal Center | `/legal` | Index of all policies |
| Privacy Policy | `/privacy` | Data collection, OTP, AI, rights |
| Terms of Service | `/terms` | Account, billing, liability |
| Cookie Policy | `/cookies` | Cookies / localStorage |
| SMS / OTP Terms | `/sms-terms` | Text auth consent & STOP/HELP |
| Electronic Signatures | `/esign` | ESIGN / UETA portal notice |
| Refunds & Cancellation | `/refunds` | Trial, cancel, refunds |
| Subprocessors | `/subprocessors` | Stripe, Supabase, Resend, etc. |
| Acceptable Use | `/acceptable-use` | Prohibited conduct |

## Still needed from you (not inventable in code)
- Confirm LLC mailing address for Privacy/Terms contact block
- Attorney review before treating as final
- Confirm SMS provider/sender ID language matches production Twilio/Supabase setup

## Wired into product
- Landing footer → Legal + core policies
- Contact footer → Legal links
- Signup OTP → linked Terms, Privacy, SMS Terms (when SMS channel)
- Portal contract sign → link to `/esign`
- `vercel.json` clean routes + `sitemap.xml` entries
