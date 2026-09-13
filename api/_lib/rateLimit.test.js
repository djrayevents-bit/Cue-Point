const { isRateLimited } = require("./rateLimit");

async function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

(async () => {
  const key = `test:${Date.now()}:${Math.random()}`;
  assert((await isRateLimited(key, { limit: 2, windowMs: 60_000 })) === false, "1st ok");
  assert((await isRateLimited(key, { limit: 2, windowMs: 60_000 })) === false, "2nd ok");
  assert((await isRateLimited(key, { limit: 2, windowMs: 60_000 })) === true, "3rd limited");
  console.log("rateLimit.test.js OK");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
