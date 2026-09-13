/**
 * O(1) DJ handle → user_id resolution.
 *
 * Prefer `dj_handles` table when present (see supabase/dj-handles.sql).
 * Fallback: user_data key `djHandle:<norm>` index rows (backfilled on scan).
 * Last resort: scan djProfile rows once, then backfill index.
 */

const HANDLE_KEY_PREFIX = "djHandle:";

function normalizeHandle(h) {
  return String(h || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function handleKey(norm) {
  return HANDLE_KEY_PREFIX + String(norm);
}

function handlesFromProfile(profile, userId) {
  if (!profile || typeof profile !== "object") {
    const u = normalizeHandle(userId);
    return u ? [u] : [];
  }
  const candidates = [
    profile.subdomain,
    profile.bookingHandle,
    profile.djName,
    profile.businessName,
    userId,
  ]
    .map(normalizeHandle)
    .filter(Boolean);
  return [...new Set(candidates)];
}

function profileMatchesHandle(profile, userId, handleNorm) {
  if (!handleNorm) return false;
  return handlesFromProfile(profile, userId).includes(handleNorm);
}

async function backfillHandleIndex(supabase, userId, profile) {
  const norms = handlesFromProfile(profile, userId);
  for (const norm of norms) {
    // Dedicated table (ignore if missing)
    try {
      await supabase.from("dj_handles").upsert(
        {
          handle: norm,
          user_id: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "handle" }
      );
    } catch (_) {}

    // user_data reverse index (works without migration)
    try {
      await supabase.from("user_data").upsert(
        {
          user_id: userId,
          key: handleKey(norm),
          value: { userId, handle: norm },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,key" }
      );
    } catch (_) {}
  }
}

/**
 * @returns {Promise<string|null>} user_id
 */
async function resolveUserIdByHandle(supabase, handle) {
  const target = normalizeHandle(handle);
  if (!target) return null;

  // 1) dj_handles table
  try {
    const { data, error } = await supabase
      .from("dj_handles")
      .select("user_id")
      .eq("handle", target)
      .maybeSingle();
    if (!error && data?.user_id) return data.user_id;
    // missing table / column → fall through
  } catch (_) {}

  // 2) user_data index key
  try {
    const { data: rows, error } = await supabase
      .from("user_data")
      .select("user_id, value")
      .eq("key", handleKey(target))
      .limit(2);
    if (!error && rows?.length === 1) return rows[0].user_id;
  } catch (_) {}

  // 3) Legacy scan + backfill
  const { data: profileRows, error: scanErr } = await supabase
    .from("user_data")
    .select("user_id, value")
    .eq("key", "djProfile");
  if (scanErr) throw scanErr;

  for (const row of profileRows || []) {
    if (!profileMatchesHandle(row.value, row.user_id, target)) continue;
    await backfillHandleIndex(supabase, row.user_id, row.value);
    return row.user_id;
  }
  return null;
}

module.exports = {
  HANDLE_KEY_PREFIX,
  normalizeHandle,
  handleKey,
  handlesFromProfile,
  profileMatchesHandle,
  backfillHandleIndex,
  resolveUserIdByHandle,
};
