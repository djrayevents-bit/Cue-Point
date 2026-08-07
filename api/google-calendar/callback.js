const {
  googleConfigured,
  exchangeCode,
  fetchGoogleEmail,
  getStoredAuth,
  saveStoredAuth,
  appOrigin,
} = require("../_lib/googleCalendar");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).send("Method not allowed");
  const origin = appOrigin(req);
  const fail = (msg) => {
    res.writeHead(302, {
      Location: `${origin}/app#meetings?google=error&msg=${encodeURIComponent(msg || "connect_failed")}`,
    });
    return res.end();
  };

  if (!googleConfigured()) return fail("not_configured");

  const { code, state, error } = req.query || {};
  if (error) return fail(String(error));
  if (!code || !state) return fail("missing_code");

  const [userId, nonce] = String(state).split(".");
  if (!userId || !nonce) return fail("bad_state");

  try {
    const pending = await getStoredAuth(userId);
    if (!pending?.pendingNonce || pending.pendingNonce !== nonce) {
      return fail("state_mismatch");
    }

    const tokens = await exchangeCode(code, req);
    const email = await fetchGoogleEmail(tokens.access_token);
    await saveStoredAuth(userId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || pending.refreshToken || "",
      expiresAt: Date.now() + (Number(tokens.expires_in) || 3600) * 1000,
      email,
      connectedAt: new Date().toISOString(),
    });

    res.writeHead(302, { Location: `${origin}/app#meetings?google=connected` });
    return res.end();
  } catch (e) {
    console.error("google calendar callback:", e);
    return fail(e.message || "callback_failed");
  }
};
