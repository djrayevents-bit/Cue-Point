const assert = require("assert");
const {
  sealGoogleAuth,
  openGoogleAuth,
  encryptString,
  decryptToString,
} = require("./secretCrypto");

// Without key → plaintext round-trip
delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
delete process.env.SECRETS_ENCRYPTION_KEY;

const plain = sealGoogleAuth({
  accessToken: "at",
  refreshToken: "rt",
  email: "dj@example.com",
  connectedAt: "2026-01-01T00:00:00.000Z",
  expiresAt: 123,
});
assert.strictEqual(plain.refreshToken, "rt");
assert.strictEqual(plain.accessToken, "at");
assert.ok(!plain._enc);
const openedPlain = openGoogleAuth(plain);
assert.strictEqual(openedPlain.refreshToken, "rt");
assert.strictEqual(openedPlain.email, "dj@example.com");

// With key → encrypted shape
process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "a".repeat(64);
const sealed = sealGoogleAuth({
  accessToken: "access-1",
  refreshToken: "refresh-1",
  email: "owner@example.com",
  pendingNonce: "abc",
  expiresAt: 999,
});
assert.ok(sealed._enc);
assert.ok(!sealed.refreshToken);
assert.ok(!sealed.accessToken);
assert.strictEqual(sealed.email, "owner@example.com");
assert.strictEqual(sealed.pendingNonce, "abc");
assert.strictEqual(sealed.hasRefresh, true);

const opened = openGoogleAuth(sealed);
assert.strictEqual(opened.refreshToken, "refresh-1");
assert.strictEqual(opened.accessToken, "access-1");
assert.strictEqual(opened.email, "owner@example.com");

// Low-level encrypt/decrypt
const enc = encryptString("hello");
assert.ok(enc.ct);
assert.strictEqual(decryptToString(enc), "hello");

// Legacy plaintext still opens
const legacy = openGoogleAuth({ refreshToken: "legacy-rt", accessToken: "legacy-at", email: "x" });
assert.strictEqual(legacy.refreshToken, "legacy-rt");

console.log("secretCrypto.test.js OK");
