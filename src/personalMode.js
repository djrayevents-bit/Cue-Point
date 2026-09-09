/**
 * CuePoint runs as a private personal business system — not a public SaaS.
 * Signup, Stripe billing, and marketing funnels are disabled.
 *
 * Override owner emails at build time with VITE_CUEPOINT_OWNER_EMAILS
 * (comma-separated). Use "*" to allow any authenticated account.
 */

export const PERSONAL_MODE = true;

export const DEFAULT_OWNER_EMAILS = ["ivstudiogroup@gmail.com", "djrayevents@gmail.com"];

const normEmail = (s) => String(s || "").trim().toLowerCase();

export function ownerEmailSet() {
  const extra = String(import.meta.env.VITE_CUEPOINT_OWNER_EMAILS || "")
    .split(",")
    .map(normEmail)
    .filter(Boolean);
  if (extra.includes("*")) return null;
  return new Set([...DEFAULT_OWNER_EMAILS, ...extra.filter((e) => e.includes("@"))]);
}

export function isPersonalOwner(user) {
  if (!user) return false;
  const allowed = ownerEmailSet();
  if (allowed == null) return true;
  const candidates = [
    user.email,
    user.user_metadata?.billing_email,
    user.user_metadata?.email,
  ].map(normEmail);
  return candidates.some((e) => e.includes("@") && allowed.has(e));
}
