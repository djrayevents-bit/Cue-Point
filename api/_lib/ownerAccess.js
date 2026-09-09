/**
 * Personal-instance access control.
 *
 * CUEPOINT_OWNER_EMAILS — comma-separated allowlist
 * (default: ivstudiogroup@gmail.com, djrayevents@gmail.com).
 * Set to "*" to allow any authenticated user.
 * CUEPOINT_OWNER_PHONES — optional E.164 / digits allowlist for SMS-only accounts.
 */

function normEmail(s) {
  return String(s || "").trim().toLowerCase();
}

function digits(s) {
  return String(s || "").replace(/\D/g, "");
}

function ownerEmails() {
  const raw = process.env.CUEPOINT_OWNER_EMAILS;
  if (raw == null || String(raw).trim() === "") {
    return new Set(["ivstudiogroup@gmail.com", "djrayevents@gmail.com"]);
  }
  if (String(raw).trim() === "*") return null;
  return new Set(
    String(raw)
      .split(",")
      .map(normEmail)
      .filter((e) => e.includes("@"))
  );
}

function ownerPhones() {
  const raw = process.env.CUEPOINT_OWNER_PHONES || "";
  return new Set(
    String(raw)
      .split(",")
      .map(digits)
      .filter((p) => p.length >= 10)
  );
}

function isAllowedOwner(user) {
  if (!user) return false;
  const emails = ownerEmails();
  if (emails === null) return true;
  const candidates = [
    user.email,
    user.new_email,
    user.user_metadata?.billing_email,
    user.user_metadata?.email,
  ]
    .map(normEmail)
    .filter((e) => e.includes("@"));
  if (candidates.some((e) => emails.has(e))) return true;

  const phones = ownerPhones();
  if (phones.size) {
    const phone = digits(user.phone);
    if (phone && [...phones].some((p) => phone.endsWith(p) || p.endsWith(phone))) return true;
  }
  return false;
}

async function requireAuthedUser(req, supabase) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: { status: 401, message: "Unauthorized" } };
  }
  const token = authHeader.split(" ")[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { error: { status: 401, message: "Invalid session" } };
  return { user };
}

async function requireOwner(req, supabase) {
  const result = await requireAuthedUser(req, supabase);
  if (result.error) return result;
  if (!isAllowedOwner(result.user)) {
    return { error: { status: 403, message: "This CuePoint instance is private." } };
  }
  return result;
}

module.exports = {
  isAllowedOwner,
  requireAuthedUser,
  requireOwner,
};
