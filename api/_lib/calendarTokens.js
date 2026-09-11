/**
 * Calendar (iCal) feed token helpers — expiry / revocation.
 *
 * Stored in user_data key `calendarToken` as:
 *   legacy: "<token string>"
 *   new:    { token, createdAt, expiresAt, revokedAt? }
 *
 * Optional ical_feeds columns: expires_at, revoked_at (see supabase/ical-feed-lifecycle.sql)
 */

const CALENDAR_TOKEN_KEY = "calendarToken";
const CALENDAR_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year; revoke anytime

function tokenStringFromEntry(entry) {
  if (entry == null) return null;
  if (typeof entry === "string") {
    try {
      const parsed = JSON.parse(entry);
      if (typeof parsed === "string") return parsed;
      if (parsed && typeof parsed === "object" && parsed.token) return String(parsed.token);
    } catch (_) {}
    return entry;
  }
  if (typeof entry === "object" && entry.token) return String(entry.token);
  return null;
}

function normalizeEntry(raw) {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return normalizeEntry(parsed);
    } catch (_) {
      return raw; // legacy bare token string
    }
  }
  if (typeof raw === "object" && raw.token) return raw;
  return null;
}

function isEntryActive(entry, now = Date.now()) {
  if (!entry) return false;
  if (typeof entry === "string") return true; // legacy until rotated
  if (entry.revokedAt) return false;
  if (entry.expiresAt) {
    const exp = Date.parse(entry.expiresAt);
    if (Number.isFinite(exp) && exp < now) return false;
  }
  return !!entry.token;
}

function mintCalendarTokenEntry(ttlMs = CALENDAR_TOKEN_TTL_MS) {
  const now = new Date();
  return {
    token: require("crypto").randomBytes(18).toString("base64url"),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
  };
}

function feedRowActive(row, now = Date.now()) {
  if (!row) return false;
  if (row.revoked_at) {
    const rev = Date.parse(row.revoked_at);
    if (Number.isFinite(rev) && rev <= now) return false;
  }
  if (row.expires_at) {
    const exp = Date.parse(row.expires_at);
    if (Number.isFinite(exp) && exp < now) return false;
  }
  return true;
}

module.exports = {
  CALENDAR_TOKEN_KEY,
  CALENDAR_TOKEN_TTL_MS,
  tokenStringFromEntry,
  normalizeEntry,
  isEntryActive,
  mintCalendarTokenEntry,
  feedRowActive,
};
