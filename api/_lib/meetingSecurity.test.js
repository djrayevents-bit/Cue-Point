/**
 * Regression tests for Batch 1 meeting security helpers.
 * Run: node api/_lib/meetingSecurity.test.js
 */
const assert = require("assert");
const { isCronAuthorized, isAllowedMeetLink } = require("./meetingSecurity");

function req(headers = {}) {
  return { headers };
}

// --- cron auth ---
assert.strictEqual(
  isCronAuthorized(req({ "x-vercel-cron": "1" }), {}),
  false,
  "spoofed x-vercel-cron without secret must fail"
);
assert.strictEqual(
  isCronAuthorized(req({ "x-vercel-cron": "1" }), { CRON_SECRET: "s3cret" }),
  false,
  "x-vercel-cron alone must fail even when secret is configured"
);
assert.strictEqual(
  isCronAuthorized(req({ authorization: "Bearer s3cret" }), { CRON_SECRET: "s3cret" }),
  true,
  "Bearer CRON_SECRET must pass"
);
assert.strictEqual(
  isCronAuthorized(req({ "x-cron-secret": "s3cret" }), { MEETING_REMINDER_SECRET: "s3cret" }),
  true,
  "x-cron-secret must pass"
);
assert.strictEqual(
  isCronAuthorized(req({ authorization: "Bearer wrong" }), { CRON_SECRET: "s3cret" }),
  false,
  "wrong bearer must fail"
);

// --- meet link allowlist ---
assert.strictEqual(isAllowedMeetLink(""), true, "empty clears link");
assert.strictEqual(isAllowedMeetLink("https://meet.google.com/abc-defg-hij"), true);
assert.strictEqual(isAllowedMeetLink("https://zoom.us/j/123"), true);
assert.strictEqual(isAllowedMeetLink("https://evil.example/phish"), false);
assert.strictEqual(isAllowedMeetLink("javascript:alert(1)"), false);
assert.strictEqual(isAllowedMeetLink("http://meet.google.com/x"), false, "http rejected");

console.log("meetingSecurity.test.js: all passed");
