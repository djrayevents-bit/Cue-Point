const { verifyTurnstile, turnstileTokenFromBody } = require("./turnstile");

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

(async () => {
  // No secret → skip (allow)
  delete process.env.TURNSTILE_SECRET_KEY;
  const skipped = await verifyTurnstile(null);
  assert(skipped.ok && skipped.skipped, "skip when unset");

  process.env.TURNSTILE_SECRET_KEY = "test-secret";
  const missing = await verifyTurnstile("");
  assert(!missing.ok && !missing.skipped, "fail closed when secret set and token missing");

  assert(turnstileTokenFromBody({ turnstileToken: "abc" }) === "abc", "token field");
  assert(turnstileTokenFromBody({ "cf-turnstile-response": "xyz" }) === "xyz", "cf field");

  console.log("turnstile.test.js OK");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
