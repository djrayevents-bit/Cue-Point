/**
 * AES-256-GCM helpers for secrets stored in user_data (e.g. Google OAuth tokens).
 * Env: GOOGLE_TOKEN_ENCRYPTION_KEY or SECRETS_ENCRYPTION_KEY
 *   — 64 hex chars (32 bytes) or base64 that decodes to 32 bytes.
 * When unset, plaintext is stored (compat); set the key in production.
 */

const crypto = require("crypto");

let warnedMissingKey = false;

function resolveKeyBytes() {
  const raw = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || process.env.SECRETS_ENCRYPTION_KEY;
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  try {
    const buf = Buffer.from(trimmed, "base64");
    if (buf.length === 32) return buf;
  } catch {
    /* ignore */
  }
  return null;
}

function encryptionConfigured() {
  return !!resolveKeyBytes();
}

function encryptString(plaintext) {
  const key = resolveKeyBytes();
  if (!key) {
    if (!warnedMissingKey) {
      console.warn("SECRETS_ENCRYPTION_KEY / GOOGLE_TOKEN_ENCRYPTION_KEY unset — storing secrets in plaintext");
      warnedMissingKey = true;
    }
    return null;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ct: ct.toString("base64"),
  };
}

function decryptToString(payload) {
  if (!payload || typeof payload !== "object" || payload.v !== 1 || !payload.ct) {
    return null;
  }
  const key = resolveKeyBytes();
  if (!key) {
    throw new Error("Encrypted secret present but encryption key is not configured");
  }
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const ct = Buffer.from(payload.ct, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/**
 * Wrap Google auth blob: encrypt access/refresh tokens; keep status metadata plaintext.
 */
function sealGoogleAuth(value) {
  if (!value || typeof value !== "object") return value;
  const {
    accessToken,
    refreshToken,
    email,
    connectedAt,
    pendingNonce,
    pendingAt,
    expiresAt,
    ...rest
  } = value;

  const secretPayload = {
    accessToken: accessToken || "",
    refreshToken: refreshToken || "",
  };
  const sealed = encryptString(JSON.stringify(secretPayload));

  const meta = {
    email: email || "",
    connectedAt: connectedAt || null,
    pendingNonce: pendingNonce || null,
    pendingAt: pendingAt || null,
    expiresAt: expiresAt || 0,
    hasRefresh: !!(refreshToken || accessToken),
    ...rest,
  };

  if (!sealed) {
    // Plaintext fallback when key unset
    return {
      ...meta,
      accessToken: secretPayload.accessToken,
      refreshToken: secretPayload.refreshToken,
    };
  }

  return {
    ...meta,
    _enc: sealed,
  };
}

function openGoogleAuth(value) {
  if (!value || typeof value !== "object") return value;

  // Encrypted shape
  if (value._enc && value._enc.v === 1) {
    const json = decryptToString(value._enc);
    const secrets = JSON.parse(json || "{}");
    return {
      email: value.email || "",
      connectedAt: value.connectedAt || null,
      pendingNonce: value.pendingNonce || null,
      pendingAt: value.pendingAt || null,
      expiresAt: value.expiresAt || 0,
      accessToken: secrets.accessToken || "",
      refreshToken: secrets.refreshToken || "",
      hasRefresh: !!(secrets.refreshToken || secrets.accessToken),
    };
  }

  // Legacy plaintext
  return {
    ...value,
    hasRefresh: !!(value.refreshToken || value.accessToken),
  };
}

module.exports = {
  encryptionConfigured,
  encryptString,
  decryptToString,
  sealGoogleAuth,
  openGoogleAuth,
  resolveKeyBytes,
};
