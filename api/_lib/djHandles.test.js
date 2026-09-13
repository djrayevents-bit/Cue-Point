const {
  normalizeHandle,
  profileMatchesHandle,
  handleKey,
} = require("./djHandles");
const {
  isEntryActive,
  tokenStringFromEntry,
  normalizeEntry,
} = require("./calendarTokens");

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

assert(normalizeHandle("My-DJ_Name!") === "mydjname", "normalize");
assert(profileMatchesHandle({ subdomain: "my-dj" }, "u1", "mydj") === true, "match subdomain");
assert(profileMatchesHandle({ bookingHandle: "other" }, "u1", "mydj") === false, "no match");
assert(handleKey("abc") === "djHandle:abc", "handle key");

assert(tokenStringFromEntry("legacy") === "legacy", "legacy token");
assert(tokenStringFromEntry({ token: "t1" }) === "t1", "object token");
assert(isEntryActive("legacy") === true, "legacy active");
assert(isEntryActive({ token: "t1", revokedAt: "2020-01-01T00:00:00.000Z" }) === false, "revoked");
assert(isEntryActive({ token: "t1", expiresAt: "2000-01-01T00:00:00.000Z" }) === false, "expired");
assert(isEntryActive({ token: "t1", expiresAt: "2099-01-01T00:00:00.000Z" }) === true, "future");
assert(normalizeEntry('{"token":"x"}')?.token === "x", "json string entry");

console.log("djHandles + calendarTokens helpers OK");
