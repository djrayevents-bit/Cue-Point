/**
 * Portal token resolution with expiry / revocation support.
 *
 * Index row key: portalToken:<token>
 * Index value (new): { eventId, expiresAt?, revokedAt? }
 * Blob value (new): { token, createdAt, expiresAt, revokedAt } or legacy string token
 */

const PORTAL_TOKEN_PREFIX = "portalToken:";

function portalTokenKey(token) {
  return PORTAL_TOKEN_PREFIX + String(token);
}

function tokenStringFromEntry(entry) {
  if (entry == null) return null;
  if (typeof entry === "string") return entry;
  if (typeof entry === "object" && entry.token) return String(entry.token);
  return null;
}

function entryMatchesToken(entry, token) {
  const s = tokenStringFromEntry(entry);
  return !!s && s === String(token);
}

function isEntryActive(entry, now = Date.now()) {
  if (!entry) return false;
  if (typeof entry === "string") return true; // legacy: active until rotated
  if (entry.revokedAt) return false;
  if (entry.expiresAt) {
    const exp = Date.parse(entry.expiresAt);
    if (Number.isFinite(exp) && exp < now) return false;
  }
  return !!entry.token;
}

function indexValueActive(value, eventId, now = Date.now()) {
  if (!value || typeof value !== "object") return false;
  if (String(value.eventId) !== String(eventId)) return false;
  if (value.revokedAt) return false;
  if (value.expiresAt) {
    const exp = Date.parse(value.expiresAt);
    if (Number.isFinite(exp) && exp < now) return false;
  }
  return true;
}

/**
 * Resolve portal (eventId, token) → { djUserId } or null.
 */
async function resolvePortalAccess(supabase, eventId, token) {
  if (eventId == null || eventId === "" || !token) return null;
  const id = String(eventId);
  const key = portalTokenKey(token);
  const now = Date.now();

  const { data: row, error } = await supabase
    .from("user_data")
    .select("user_id, value")
    .eq("key", key)
    .maybeSingle();

  if (!error && row?.user_id) {
    if (!indexValueActive(row.value, id, now)) return null;
    return { djUserId: row.user_id };
  }

  // Legacy fallback: scan portalTokens blobs once, then backfill index
  const { data: tokenRows, error: tokErr } = await supabase
    .from("user_data")
    .select("user_id, value")
    .eq("key", "portalTokens");
  if (tokErr) throw tokErr;

  for (const r of tokenRows || []) {
    const map = r.value && typeof r.value === "object" ? r.value : {};
    const entry = map[id] ?? map[eventId] ?? map[String(eventId)];
    if (!entryMatchesToken(entry, token)) continue;
    if (!isEntryActive(entry, now)) return null;

    const expiresAt =
      typeof entry === "object" && entry.expiresAt ? entry.expiresAt : null;

    await supabase.from("user_data").upsert(
      {
        user_id: r.user_id,
        key,
        value: {
          eventId: id,
          ...(expiresAt ? { expiresAt } : {}),
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,key" }
    );
    return { djUserId: r.user_id };
  }

  return null;
}

module.exports = {
  PORTAL_TOKEN_PREFIX,
  portalTokenKey,
  tokenStringFromEntry,
  isEntryActive,
  resolvePortalAccess,
};
