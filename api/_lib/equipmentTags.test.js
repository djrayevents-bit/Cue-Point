const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const file = path.join(os.tmpdir(), `cuepoint-equipment-tags-${process.pid}.json`);
process.env.EQUIPMENT_TAGS_STORE = "file";
process.env.EQUIPMENT_TAGS_FILE = file;
process.env.EQUIPMENT_TAG_SECRET = "test-secret";
process.env.NODE_ENV = "test";
delete process.env.VERCEL;

const {
  appUrl,
  buildSetCookie,
  cookieIsSecure,
  decideTap,
  handleOperator,
  handleTags,
  handleTap,
  normalizeHttpUrl,
  readOperator,
  signOperator,
  validateTagInput,
} = require("./equipmentTags");

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = { ...(headers || {}) };
    },
    end(body) {
      this.body = body == null ? "" : body;
    },
  };
}

function httpReq(extra = {}) {
  return {
    method: "GET",
    url: "/",
    headers: { host: "192.168.1.20:5173", ...(extra.headers || {}) },
    socket: {},
    query: extra.query,
    body: extra.body,
  };
}

test.after(() => {
  fs.rmSync(file, { force: true });
  fs.rmSync(`${file}.tmp`, { force: true });
});

test("external URLs must be absolute http(s)", () => {
  assert.equal(normalizeHttpUrl("https://example.com/manual"), "https://example.com/manual");
  assert.equal(normalizeHttpUrl("javascript:alert(1)"), null);
  assert.equal(normalizeHttpUrl("/equipment/speaker"), null);
  const parsed = validateTagInput({
    name: "Left speaker",
    note: "",
    inApp: { kind: "external", url: "javascript:alert(1)" },
    publicDestination: { kind: "internal" },
  });
  assert.equal(parsed.ok, false);
  assert.equal(parsed.fieldErrors.inAppUrl, "Use a full http:// or https:// URL.");
});

test("plain http does not mark the operator cookie Secure", () => {
  const http = httpReq();
  assert.equal(cookieIsSecure(http), false);
  assert.equal(buildSetCookie("abc", { secure: false, maxAge: 10 }).split(";").slice(1).map((part) => part.trim()).includes("Secure"), false);

  const forwardedHttp = httpReq({
    headers: { "x-forwarded-proto": "http" },
  });
  forwardedHttp.socket = { encrypted: true };
  assert.equal(cookieIsSecure(forwardedHttp), false);

  const https = httpReq({ headers: { "x-forwarded-proto": "https" } });
  assert.equal(cookieIsSecure(https), true);
  assert.match(buildSetCookie("abc", { secure: true, maxAge: 10 }), /;\sSecure$/);
});

test("NFC /t/:id always follows the public destination, even for the signed-in owner", async () => {
  assert.equal(
    appUrl("http://192.168.1.20:5173", "#/equipment-tag/abcdefghjk/work"),
    "http://192.168.1.20:5173/#/equipment-tag/abcdefghjk/work",
  );
  process.env.VERCEL = "1";
  try {
    assert.equal(
      appUrl("https://cuepointplanning.com", "#/equipment-tag/abcdefghjk"),
      "https://cuepointplanning.com/app#/equipment-tag/abcdefghjk",
    );
  } finally {
    delete process.env.VERCEL;
  }

  const created = mockRes();
  await handleTags({
    ...httpReq(),
    method: "POST",
    headers: {
      host: "192.168.1.20:5173",
      "x-cuepoint-dev-bypass": "1",
    },
    body: {
      name: "Left speaker",
      note: "XLR is in the lid.",
      inApp: { kind: "internal" },
      publicDestination: { kind: "external", url: "https://example.com/manual" },
    },
  }, created);
  assert.equal(created.statusCode, 201);
  const tag = JSON.parse(created.body).tag;
  assert.equal(tag.note, "XLR is in the lid.");
  assert.match(tag.id, /^[a-z0-9]{10}$/);

  const session = mockRes();
  await handleOperator({
    ...httpReq(),
    method: "POST",
    headers: { host: "192.168.1.20:5173", "x-cuepoint-dev-bypass": "1" },
  }, session);
  assert.equal(session.statusCode, 200);
  const setCookie = session.headers["Set-Cookie"];
  const cookieAttrs = setCookie.split(";").slice(1).map((part) => part.trim());
  assert.equal(cookieAttrs.includes("Secure"), false);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  const cookiePair = setCookie.split(";")[0];
  const uid = readOperator(cookiePair.split("=").slice(1).join("="));
  assert.equal(uid, "dev-local-user");
  assert.equal(signOperator("dev-local-user") && readOperator(signOperator("dev-local-user")), "dev-local-user");
  assert.equal(readOperator(`${cookiePair.split("=").slice(1).join("=")}tampered`), null);

  const asOwner = mockRes();
  await handleTap({
    ...httpReq(),
    url: `/t/${tag.id}`,
    headers: { host: "192.168.1.20:5173", cookie: cookiePair },
  }, asOwner);
  assert.equal(asOwner.statusCode, 302);
  assert.equal(asOwner.headers.Location, "https://example.com/manual");
  assert.match(asOwner.headers.Location, /^https?:\/\//);
  assert.equal(asOwner.headers.Vary, undefined);

  const asVisitor = mockRes();
  await handleTap({
    ...httpReq(),
    url: `/t/${tag.id}?as=visitor`,
    headers: { host: "192.168.1.20:5173", cookie: cookiePair },
  }, asVisitor);
  assert.equal(asVisitor.statusCode, 302);
  assert.equal(asVisitor.headers.Location, "https://example.com/manual");

  const stranger = mockRes();
  const strangerCookie = `cp_operator=${signOperator("someone-else")}`;
  await handleTap({
    ...httpReq(),
    url: `/t/${tag.id}`,
    headers: { host: "192.168.1.20:5173", cookie: strangerCookie },
  }, stranger);
  assert.equal(stranger.headers.Location, "https://example.com/manual");

  const anon = mockRes();
  await handleTap({
    ...httpReq(),
    url: `/t/${tag.id}`,
  }, anon);
  assert.equal(anon.headers.Location, "https://example.com/manual");

  const missing = mockRes();
  await handleTap({ ...httpReq(), url: "/t/abcdefghjk" }, missing);
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.headers.Location, undefined);
  assert.match(missing.body, /No tag uses this address/);

  const publicRead = mockRes();
  await handleTags({ ...httpReq(), url: `/api/equipment-tags?id=${tag.id}` }, publicRead);
  const publicBody = JSON.parse(publicRead.body);
  assert.equal(publicBody.tag.name, "Left speaker");
  assert.equal(publicBody.tag.note, undefined);
  assert.equal(publicBody.tag.inApp, undefined);

  const ownerRead = mockRes();
  await handleTags({
    ...httpReq(),
    url: `/api/equipment-tags?id=${tag.id}`,
    headers: { host: "192.168.1.20:5173", "x-cuepoint-dev-bypass": "1" },
  }, ownerRead);
  assert.equal(JSON.parse(ownerRead.body).tag.note, "XLR is in the lid.");

  const internalPublic = decideTap({
    tag: {
      id: tag.id,
      userId: "dev-local-user",
      name: "Left speaker",
      note: "secret",
      inApp: { kind: "external", url: "https://example.com/work" },
      publicDestination: { kind: "internal" },
    },
    origin: "http://192.168.1.20:5173",
  });
  assert.equal(internalPublic.location, `http://192.168.1.20:5173/#/equipment-tag/${tag.id}`);

  const ownerStillPublic = decideTap({
    tag: {
      id: tag.id,
      userId: "dev-local-user",
      name: "Left speaker",
      note: "secret",
      inApp: { kind: "internal" },
      publicDestination: { kind: "external", url: "https://example.com/manual" },
    },
    origin: "http://192.168.1.20:5173",
  });
  assert.equal(ownerStillPublic.location, "https://example.com/manual");
});

test("https operator cookie is marked Secure", async () => {
  const res = mockRes();
  await handleOperator({
    ...httpReq(),
    method: "POST",
    headers: {
      host: "192.168.1.20:5173",
      "x-forwarded-proto": "https",
      "x-cuepoint-dev-bypass": "1",
    },
  }, res);
  assert.equal(res.headers["Set-Cookie"].split(";").slice(1).map((part) => part.trim()).includes("Secure"), true);
});

test("production host rejects the local operator bypass", async () => {
  const res = mockRes();
  await handleOperator({
    ...httpReq(),
    method: "POST",
    headers: {
      host: "cuepointplanning.com",
      "x-forwarded-proto": "https",
      "x-cuepoint-dev-bypass": "1",
    },
  }, res);
  assert.equal(res.statusCode, 401);
});
