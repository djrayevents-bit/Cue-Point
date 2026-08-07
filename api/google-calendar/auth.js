const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { googleConfigured, buildAuthUrl, saveStoredAuth, getStoredAuth } = require("../_lib/googleCalendar");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function requireUser(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!googleConfigured()) {
    return res.status(503).json({
      error: "Google Calendar is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    });
  }

  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: "Not signed in" });

  const nonce = crypto.randomBytes(12).toString("hex");
  const existing = await getStoredAuth(user.id);
  await saveStoredAuth(user.id, {
    ...(existing || {}),
    pendingNonce: nonce,
    pendingAt: new Date().toISOString(),
  });

  const url = buildAuthUrl({ userId: user.id, req, stateNonce: nonce });
  // Prefer redirect for browser navigation; also return URL for fetch callers.
  if (req.query.redirect === "0") {
    return res.status(200).json({ url });
  }
  res.writeHead(302, { Location: url });
  return res.end();
};
