const { createClient } = require("@supabase/supabase-js");
const { googleConfigured, getStoredAuth, clearStoredAuth } = require("../_lib/googleCalendar");

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
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: "Not signed in" });

  if (req.method === "GET") {
    const stored = await getStoredAuth(user.id);
    const connected = !!(stored?.refreshToken || stored?.accessToken);
    return res.status(200).json({
      configured: googleConfigured(),
      connected,
      email: connected ? stored.email || "" : "",
      connectedAt: connected ? stored.connectedAt || null : null,
    });
  }

  if (req.method === "DELETE") {
    await clearStoredAuth(user.id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
