/**
 * Shared meeting security helpers (Batch 1 hardening).
 * Pure functions — safe to unit-test without Supabase.
 */

/** Require a configured cron secret; never trust spoofable cron headers alone. */
function isCronAuthorized(req, env = process.env) {
  const secret = env.CRON_SECRET || env.MEETING_REMINDER_SECRET;
  if (!secret) return false;
  const auth = req.headers?.authorization || "";
  if (auth === `Bearer ${secret}`) return true;
  if (req.headers?.["x-cron-secret"] === secret) return true;
  return false;
}

/**
 * Allow empty string (clear link) or https Meet / Zoom / Teams-style hosts.
 * Reject javascript:, data:, and non-https schemes.
 */
function isAllowedMeetLink(url) {
  if (url == null) return false;
  const s = String(url).trim();
  if (s === "") return true; // clear
  let parsed;
  try {
    parsed = new URL(s);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  const allowed =
    host === "meet.google.com" ||
    host.endsWith(".meet.google.com") ||
    host === "zoom.us" ||
    host.endsWith(".zoom.us") ||
    host === "teams.microsoft.com" ||
    host.endsWith(".teams.microsoft.com");
  return allowed;
}

module.exports = { isCronAuthorized, isAllowedMeetLink };
