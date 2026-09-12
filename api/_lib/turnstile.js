/**
 * Cloudflare Turnstile verification (env-gated).
 * When TURNSTILE_SECRET_KEY is unset, verification is skipped (local/Hobby without CAPTCHA).
 * When set, bad/missing tokens fail closed.
 */

async function verifyTurnstile(token, { remoteip } = {}) {
  const secret = String(process.env.TURNSTILE_SECRET_KEY || "").trim();
  if (!secret) {
    return { ok: true, skipped: true };
  }
  const response = String(token || "").trim();
  if (!response) {
    return { ok: false, skipped: false, error: "Captcha required" };
  }
  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", response);
    if (remoteip) body.set("remoteip", String(remoteip));
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (!data?.success) {
      return { ok: false, skipped: false, error: "Captcha failed", codes: data?.["error-codes"] };
    }
    return { ok: true, skipped: false };
  } catch (err) {
    console.warn("turnstile verify error:", err.message);
    return { ok: false, skipped: false, error: "Captcha verification unavailable" };
  }
}

function turnstileTokenFromBody(body = {}) {
  return (
    body.turnstileToken ||
    body.cfTurnstileResponse ||
    body["cf-turnstile-response"] ||
    null
  );
}

module.exports = { verifyTurnstile, turnstileTokenFromBody };
