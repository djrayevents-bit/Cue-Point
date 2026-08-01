/**
 * Portal token lookup — O(1) by key `portalToken:<token>`.
 * Value shape: { eventId: string }
 * Legacy dual-read: scan portalTokens blobs once, then backfill the index row.
 */

const PORTAL_TOKEN_PREFIX = "portalToken:";

function portalTokenKey(token) {
  return PORTAL_TOKEN_PREFIX + String(token);
}

/**
 * Resolve portal (eventId, token) → djUserId.
 * Returns { djUserId } or null.
 */
async function resolvePortalAccess(supabase, eventId, token) {
  if (eventId == null || eventId === "" || !token) return null;
  const id = String(eventId);
  const key = portalTokenKey(token);

  // Fast path: individual index row
  const { data: row, error } = await supabase
    .from("user_data")
    .select("user_id, value")
    .eq("key", key)
    .maybeSingle();

  if (!error && row?.user_id) {
    if (String(row.value?.eventId) === id) {
      return { djUserId: row.user_id };
    }
    // Token exists but wrong event — reject (do not fall through to legacy)
    return null;
  }

  // Legacy fallback: scan portalTokens blobs once, then backfill index
  const { data: tokenRows, error: tokErr } = await supabase
    .from("user_data")
    .select("user_id, value")
    .eq("key", "portalTokens");
  if (tokErr) throw tokErr;

  for (const r of tokenRows || []) {
    const map = r.value && typeof r.value === "object" ? r.value : {};
    const match =
      map[id] === token ||
      map[eventId] === token ||
      map[String(eventId)] === token;
    if (!match) continue;

    // Backfill index for steady-state O(1) next time
    await supabase.from("user_data").upsert(
      {
        user_id: r.user_id,
        key,
        value: { eventId: id },
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
  resolvePortalAccess,
};
