/** Passwordless auth helpers — Email OTP or SMS OTP via Supabase. */

/** Digits only (no +). */
const digitsOnly = (raw) => String(raw || "").replace(/\D/g, "");

/** Normalize US-friendly input to E.164. Returns null if invalid. */
export const normalizePhoneE164 = (raw) => {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Already E.164-ish
  if (trimmed.startsWith("+")) {
    const d = digitsOnly(trimmed);
    if (d.length >= 10 && d.length <= 15) return `+${d}`;
    return null;
  }

  const only = digitsOnly(trimmed);
  if (only.length === 10) return `+1${only}`;
  if (only.length === 11 && only.startsWith("1")) return `+${only}`;
  // International without + (rare in US UI) — require 10–15 digits
  if (only.length >= 10 && only.length <= 15) return `+${only}`;
  return null;
};

/** Format for display while typing (US-focused). */
export const formatPhoneInput = (raw) => {
  const only = digitsOnly(raw).slice(0, 11);
  if (!only) return "";
  // Keep leading 1 as country code hint
  if (only.length === 11 && only.startsWith("1")) {
    const rest = only.slice(1);
    if (rest.length <= 3) return `+1 (${rest}`;
    if (rest.length <= 6) return `+1 (${rest.slice(0, 3)}) ${rest.slice(3)}`;
    return `+1 (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6)}`;
  }
  if (only.length <= 3) return `(${only}`;
  if (only.length <= 6) return `(${only.slice(0, 3)}) ${only.slice(3)}`;
  return `(${only.slice(0, 3)}) ${only.slice(3, 6)}-${only.slice(6, 10)}`;
};

export const isValidEmail = (email) =>
  typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export const maskDestination = (channel, value) => {
  if (!value) return "";
  if (channel === "email") {
    const [u, d] = String(value).split("@");
    if (!d) return value;
    const shown = u.length <= 2 ? `${u[0] || ""}*` : `${u.slice(0, 2)}***`;
    return `${shown}@${d}`;
  }
  const digits = digitsOnly(value);
  if (digits.length < 4) return value;
  return `•••-•••-${digits.slice(-4)}`;
};

/** Call custom Resend/Twilio OTP API (login). Returns JSON body; throws on network failure. */
export async function requestAuthOtp(body) {
  const res = await fetch("/api/auth-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/**
 * Finish login with the emailed/texted code on the browser client.
 * Prefer this over server verify + setSession (avoids auth-token lock races).
 */
export async function verifyEmailOtpOnClient(supabase, { email, token }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanToken = String(token || "").replace(/\s/g, "");
  if (!cleanEmail || !cleanToken) {
    throw new Error("Missing email or code for verification.");
  }

  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: "email",
    });
    if (!error && data?.session) return data.session;

    lastErr = error || new Error("Could not verify that code.");
    const msg = String(lastErr.message || "");
    // OTP is single-use — don't retry invalid/expired codes.
    if (/invalid|expired|otp/i.test(msg) && !/lock|stole/i.test(msg)) break;
    if (!/lock|stole|abort/i.test(msg)) break;
    await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
  }
  throw lastErr;
}

/** Friendlier OTP / SMS error copy for the login UI. */
export const mapOtpError = (err, { channel = "email", creating = false } = {}) => {
  const m = String(err?.message || err || "");
  if (!m) return "Something went wrong. Try again.";

  if (/lock:.*auth-token|another request stole|navigator\.locks/i.test(m)) {
    return "Sign-in got interrupted. Tap Sign in again — if it still fails, request a new code.";
  }
  if (/signups not allowed|user not found|unable to validate/i.test(m)) {
    return creating
      ? m
      : channel === "sms"
        ? "No account found for that number. Use the same mobile you signed up with, or sign in with email and add your phone in Account & Brand."
        : "No account found for that contact. Start free to create one.";
  }
  if (/sms|twilio|vonage|messagebird|phone provider|unsupported phone provider|error sending.*sms/i.test(m)) {
    return "We couldn’t send a text right now. Check the number, wait a minute, or use email login.";
  }
  if (/rate.?limit|for security purposes|only request an otp/i.test(m)) {
    return "Please wait about a minute before requesting another code.";
  }
  if (/invalid.*(phone|mobile)/i.test(m)) {
    return "Enter a valid US mobile number, like (555) 123-4567.";
  }
  if (/expired|otp.*invalid|token.*(invalid|expired)|invalid.*token/i.test(m)) {
    return "That code is invalid or expired. Request a new one.";
  }
  return m;
};
