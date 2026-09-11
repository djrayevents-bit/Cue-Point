const {
  tokenStringFromEntry,
  isEntryActive,
  portalTokenKey,
} = require("./portalTokens");

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

assert(portalTokenKey("abc") === "portalToken:abc", "prefix");
assert(tokenStringFromEntry("legacy") === "legacy", "legacy string");
assert(tokenStringFromEntry({ token: "t1" }) === "t1", "object token");
assert(tokenStringFromEntry(null) === null, "null entry");
assert(isEntryActive("legacy") === true, "legacy active");
assert(isEntryActive({ token: "t1" }) === true, "object active");
assert(isEntryActive({ token: "t1", revokedAt: "2026-01-01T00:00:00.000Z" }) === false, "revoked");
assert(
  isEntryActive({ token: "t1", expiresAt: "2000-01-01T00:00:00.000Z" }) === false,
  "expired"
);
assert(
  isEntryActive({ token: "t1", expiresAt: "2099-01-01T00:00:00.000Z" }) === true,
  "future expiry"
);

console.log("portalTokens.test.js OK");
