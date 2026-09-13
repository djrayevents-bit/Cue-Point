// Combined iCal feed + publish for Hobby plan function limits.
// GET  ?token=…  → public calendar ICS (subscribers; no auth)
// POST + Bearer  → publish/upsert ICS for the signed-in user only
// POST { rotate: true } → revoke old token row and bind a new token

const { createClient } = require("@supabase/supabase-js");
const { applyCors } = require("../_lib/cors");
const {
  CALENDAR_TOKEN_KEY,
  tokenStringFromEntry,
  normalizeEntry,
  isEntryActive,
  feedRowActive,
} = require("../_lib/calendarTokens");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function loadOwnerCalendarEntry(userId) {
  const { data: tokenRow, error: tokErr } = await supabase
    .from("user_data")
    .select("value")
    .eq("user_id", userId)
    .eq("key", CALENDAR_TOKEN_KEY)
    .maybeSingle();
  if (tokErr) throw tokErr;
  return normalizeEntry(tokenRow?.value) ?? tokenRow?.value ?? null;
}

module.exports = async function handler(req, res) {
  // Public read — calendar subscribers must not need a session
  if (req.method === "GET") {
    const { token } = req.query;
    if (!token) return res.status(400).end();
    const feedToken = String(token);

    const { data, error } = await supabase
      .from("ical_feeds")
      .select("ics, user_id, expires_at, revoked_at")
      .eq("token", feedToken)
      .maybeSingle();

    // Column-missing fallback for older schemas
    let row = data;
    if (error && /expires_at|revoked_at|column/i.test(error.message || "")) {
      const retry = await supabase
        .from("ical_feeds")
        .select("ics, user_id")
        .eq("token", feedToken)
        .maybeSingle();
      if (retry.error || !retry.data) return res.status(404).end();
      row = retry.data;
    } else if (error || !row) {
      return res.status(404).end();
    }

    if (!feedRowActive(row)) return res.status(404).end();

    // Prefer owner calendarToken lifecycle when bound
    if (row.user_id) {
      try {
        const entry = await loadOwnerCalendarEntry(row.user_id);
        const active = isEntryActive(entry);
        const secret = tokenStringFromEntry(entry);
        if (!active || (secret && secret !== feedToken)) return res.status(404).end();
      } catch (e) {
        console.error("ical GET token check:", e.message);
        return res.status(500).end();
      }
    }

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store");
    return res.send(row.ics);
  }

  applyCors(req, res, {
    methods: "GET, POST, OPTIONS",
    headers: "Content-Type, Authorization",
  });
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const accessToken = authHeader.split(" ")[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !user) return res.status(401).json({ error: "Invalid session" });

  const body = req.body || {};
  const { token, ics, rotate, previousToken } = body;
  if (!token || !ics) return res.status(400).json({ error: "Missing token or ics" });
  const feedToken = String(token);

  const existingEntry = await loadOwnerCalendarEntry(user.id).catch((e) => {
    throw e;
  });
  const mine = tokenStringFromEntry(existingEntry);

  // Rotate: delete previous feed row and replace owner binding
  if (rotate) {
    const oldTok = previousToken ? String(previousToken) : mine;
    if (oldTok && oldTok !== feedToken) {
      await supabase.from("ical_feeds").delete().eq("token", oldTok).eq("user_id", user.id);
      // Best-effort mark revoked if delete unsupported / orphan
      try {
        await supabase
          .from("ical_feeds")
          .update({ revoked_at: new Date().toISOString() })
          .eq("token", oldTok);
      } catch (_) {}
    }
  } else if (mine && mine !== feedToken) {
    return res.status(403).json({ error: "Token not owned by user — rotate to replace" });
  }

  const { data: existingFeed, error: feedLookupErr } = await supabase
    .from("ical_feeds")
    .select("token, user_id")
    .eq("token", feedToken)
    .maybeSingle();
  if (feedLookupErr && !/user_id|column/i.test(feedLookupErr.message || "")) {
    return res.status(500).json({ error: feedLookupErr.message });
  }

  if (existingFeed?.user_id && existingFeed.user_id !== user.id) {
    return res.status(403).json({ error: "Token owned by another user" });
  }
  if (existingFeed && !existingFeed.user_id && mine && mine !== feedToken) {
    return res.status(403).json({ error: "Token already in use" });
  }

  // Persist structured calendarToken on the owner
  const entryToStore =
    typeof body.tokenEntry === "object" && body.tokenEntry?.token
      ? body.tokenEntry
      : existingEntry && tokenStringFromEntry(existingEntry) === feedToken && typeof existingEntry === "object"
        ? existingEntry
        : { token: feedToken, createdAt: new Date().toISOString() };

  const { error: claimErr } = await supabase.from("user_data").upsert(
    {
      user_id: user.id,
      key: CALENDAR_TOKEN_KEY,
      value: entryToStore,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,key" }
  );
  if (claimErr) return res.status(500).json({ error: claimErr.message });

  const expiresAt =
    typeof entryToStore === "object" && entryToStore.expiresAt ? entryToStore.expiresAt : null;

  const row = {
    token: feedToken,
    ics,
    user_id: user.id,
    updated_at: new Date().toISOString(),
    ...(expiresAt ? { expires_at: expiresAt } : {}),
    revoked_at: null,
  };

  const { error } = await supabase.from("ical_feeds").upsert(row, { onConflict: "token" });

  if (error) {
    if (/user_id|expires_at|revoked_at|column/i.test(error.message || "")) {
      const slim = { token: feedToken, ics, updated_at: new Date().toISOString() };
      if (!/user_id|column/i.test(error.message || "")) slim.user_id = user.id;
      const { error: err2 } = await supabase
        .from("ical_feeds")
        .upsert(slim, { onConflict: "token" });
      if (err2) {
        console.error("iCal publish error:", err2.message);
        return res.status(500).json({ error: err2.message });
      }
      return res.status(200).json({
        ok: true,
        warning: "ical_feeds missing optional columns — apply supabase/ical-feed-lifecycle.sql",
      });
    }
    console.error("iCal publish error:", error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
};
