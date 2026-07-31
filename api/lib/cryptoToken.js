/**
 * Shared Node crypto helpers for serverless API routes.
 */
const crypto = require("crypto");

/** URL-safe token with ≥128 bits of entropy. */
function makeSecretToken(byteLength = 18) {
  const n = Math.max(16, byteLength | 0);
  return crypto.randomBytes(n).toString("base64url");
}

module.exports = { makeSecretToken };
