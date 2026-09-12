/**
 * Admin notify inbox — env only. Never hardcode personal emails in source.
 * Returns null when ADMIN_NOTIFY_EMAIL is unset/invalid (callers should skip send).
 */
function adminNotifyEmail() {
  const fromEnv = String(process.env.ADMIN_NOTIFY_EMAIL || "").trim().toLowerCase();
  if (fromEnv.includes("@")) return fromEnv;
  return null;
}

module.exports = { adminNotifyEmail };
