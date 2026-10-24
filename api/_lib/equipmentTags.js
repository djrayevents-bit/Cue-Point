/**
 * Equipment NFC tags for CuePoint.
 *
 * One URL per item: /t/:id, written on the tag as an NDEF URI.
 * A signed-in owner of that tag is sent to the in-app destination.
 * Everyone else, and any request with ?as=visitor, is sent to the public one.
 *
 * Safari on iPhone rejects a relative Location and drops a Secure cookie on
 * plain http. Redirects are absolute, and the operator cookie is Secure only
 * when the request itself is https.
 */

const crypto = require("node:crypto");
const { mkdir, readFile, rename, writeFile } = require("node:fs/promises");
const path = require("node:path");

const OPERATOR_COOKIE = "cp_operator";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const DEV_USER_ID = "dev-local-user";
const NAME_MAX = 80;
const NOTE_MAX = 500;
const URL_MAX = 2000;
const TAG_KEY_PREFIX = "equipmentTag:";
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

let writeChain = Promise.resolve();

function exclusive(task) {
  const run = writeChain.then(task, task);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function firstHeader(value) {
  if (value == null) return "";
  const part = String(value).split(",")[0].trim();
  return part;
}

function requestProto(req) {
  const forwarded = firstHeader(req.headers["x-forwarded-proto"]).replace(/:$/, "");
  if (forwarded === "https" || forwarded === "http") return forwarded;
  return req.socket && req.socket.encrypted ? "https" : "http";
}

function cookieIsSecure(req) {
  return requestProto(req) === "https";
}

function safeHost(host) {
  if (!host || host.length > 253) return "";
  if (!/^[A-Za-z0-9.-]+(?::\d{1,5})?$/.test(host)) return "";
  return host;
}

function originFrom(req) {
  const host = safeHost(firstHeader(req.headers["x-forwarded-host"])) || safeHost(firstHeader(req.headers.host));
  const proto = requestProto(req);
  if (!host) return "http://127.0.0.1:5173";
  return `${proto}://${host}`;
}

function spaPrefix() {
  return process.env.VERCEL ? "/app" : "/";
}

function appUrl(origin, hash) {
  const prefix = spaPrefix();
  const pathPart = prefix === "/" ? `/${hash || ""}` : `${prefix}${hash || ""}`;
  return new URL(pathPart, origin.endsWith("/") ? origin : `${origin}/`).toString();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function missingTagHtml(origin) {
  const home = escapeHtml(appUrl(origin, ""));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tag not found · CuePoint</title>
</head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F1F1F6;color:#16161A;">
  <main style="max-width:36rem;margin:0 auto;padding:3rem 1.25rem;">
    <p style="letter-spacing:.16em;text-transform:uppercase;font-size:.75rem;font-weight:700;color:#8E8E93;">CuePoint</p>
    <h1 style="font-size:1.8rem;line-height:1.2;margin:.5rem 0 1rem;">No tag uses this address</h1>
    <p style="line-height:1.5;">The NFC URL does not match any equipment stored in CuePoint.</p>
    <p style="margin-top:1.5rem;"><a href="${home}" style="color:#6C4DF6;font-weight:700;">Back to CuePoint</a></p>
  </main>
</body>
</html>`;
}

function normalizeHttpUrl(input) {
  const trimmed = String(input || "").trim();
  if (!trimmed || trimmed.length > URL_MAX) return null;
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url.toString();
}

function parseDestinationInput(value) {
  if (!value || typeof value !== "object" || value.kind == null || value.kind === "internal") {
    return { destination: { kind: "internal" } };
  }
  if (value.kind !== "external") {
    return { error: "Choose an internal page or an external URL." };
  }
  const raw = String(value.url ?? "");
  if (!raw.trim()) return { error: "Paste a full URL starting with http:// or https://." };
  const url = normalizeHttpUrl(raw);
  if (!url) return { error: "Use a full http:// or https:// URL." };
  return { destination: { kind: "external", url } };
}

function validateTagInput(input) {
  const fieldErrors = {};
  const name = String(input && input.name != null ? input.name : "").trim();
  const note = String(input && input.note != null ? input.note : "").trim();
  if (!name) fieldErrors.name = "Give this equipment a name.";
  else if (name.length > NAME_MAX) fieldErrors.name = `Keep the name to ${NAME_MAX} characters.`;
  if (note.length > NOTE_MAX) fieldErrors.note = `Keep the note to ${NOTE_MAX} characters.`;

  const inApp = parseDestinationInput(input && input.inApp);
  if (inApp.error) fieldErrors.inAppUrl = inApp.error;
  const publicDestination = parseDestinationInput(input && input.publicDestination);
  if (publicDestination.error) fieldErrors.publicUrl = publicDestination.error;

  if (fieldErrors.name || fieldErrors.note || fieldErrors.inAppUrl || fieldErrors.publicUrl) {
    return { ok: false, fieldErrors };
  }
  return {
    ok: true,
    value: {
      name,
      note,
      inApp: inApp.destination,
      publicDestination: publicDestination.destination,
    },
  };
}

function parseStoredDestination(value) {
  if (!value || typeof value !== "object") throw new Error("A tag destination is missing.");
  if (value.kind === "internal") return { kind: "internal" };
  if (value.kind === "external" && typeof value.url === "string") {
    const url = normalizeHttpUrl(value.url);
    if (!url) throw new Error("A tag has an external URL that is not http or https.");
    return { kind: "external", url };
  }
  throw new Error("A tag destination is not internal or an external URL.");
}

function parseTag(value, userId) {
  if (!value || typeof value !== "object") throw new Error("A tag record is not an object.");
  if (typeof value.id !== "string" || typeof value.name !== "string") {
    throw new Error("A tag record is missing an id or name.");
  }
  const owner = userId || value.userId;
  if (typeof owner !== "string" || !owner) throw new Error("A tag record is missing an owner.");
  return {
    id: value.id,
    name: value.name,
    note: typeof value.note === "string" ? value.note : "",
    inApp: parseStoredDestination(value.inApp),
    publicDestination: parseStoredDestination(value.publicDestination),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
    userId: owner,
  };
}

function resolveDestination(destination, internalUrl, origin) {
  if (destination && destination.kind === "external") {
    const normalized = normalizeHttpUrl(destination.url);
    if (normalized) return normalized;
  }
  return new URL(internalUrl, origin).toString();
}

function decideTap({ tag, operatorUserId, asVisitor, origin }) {
  if (!tag) {
    return {
      status: 404,
      html: missingTagHtml(origin),
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    };
  }
  const useInApp = Boolean(operatorUserId) && operatorUserId === tag.userId && !asVisitor;
  const destination = useInApp ? tag.inApp : tag.publicDestination;
  const hash = useInApp
    ? `#/equipment-tag/${encodeURIComponent(tag.id)}/work`
    : `#/equipment-tag/${encodeURIComponent(tag.id)}`;
  const internalUrl = appUrl(origin, hash);
  const location = resolveDestination(destination, internalUrl, origin);
  if (!/^https?:\/\//i.test(location)) {
    throw new Error("Redirect location must be an absolute http(s) URL.");
  }
  return {
    status: 302,
    location,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
      Vary: "Cookie",
    },
  };
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function signingSecret() {
  const secret = process.env.EQUIPMENT_TAG_SECRET
    || process.env.SUPABASE_JWT_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (secret) return secret;
  if (process.env.VERCEL || process.env.NODE_ENV === "production") return null;
  return "cuepoint-equipment-tags-dev";
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function signOperator(userId, now = Date.now()) {
  const secret = signingSecret();
  if (!secret || !userId) return null;
  const exp = Math.floor(now / 1000) + COOKIE_MAX_AGE;
  const payload = base64url(JSON.stringify({ uid: String(userId), exp }));
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function readOperator(token, now = Date.now()) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const secret = signingSecret();
  if (!secret) return null;
  const splitAt = token.indexOf(".");
  const payload = token.slice(0, splitAt);
  const sig = token.slice(splitAt + 1);
  if (!payload || !sig || sig.includes(".")) return null;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!data || typeof data.uid !== "string" || typeof data.exp !== "number") return null;
  if (data.exp * 1000 <= now) return null;
  return data.uid;
}

function buildSetCookie(value, { secure, maxAge }) {
  const parts = [
    `${OPERATOR_COOKIE}=${value}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  const parts = String(raw).split(/;\s*/);
  for (const part of parts) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index) === name) {
      try {
        return decodeURIComponent(part.slice(index + 1));
      } catch {
        return part.slice(index + 1);
      }
    }
  }
  return "";
}

function requestUrl(req) {
  try {
    return new URL(req.url || "/", "http://localhost");
  } catch {
    return new URL("http://localhost/");
  }
}

function queryValue(req, key) {
  if (req.query && req.query[key] != null && req.query[key] !== "") {
    const value = req.query[key];
    return Array.isArray(value) ? String(value[0]) : String(value);
  }
  return requestUrl(req).searchParams.get(key) || "";
}

function tagIdFromRequest(req) {
  const fromQuery = queryValue(req, "id");
  if (fromQuery) return fromQuery;
  const match = requestUrl(req).pathname.match(/\/t\/([^/]+)$/);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function isTagId(id) {
  return /^[a-z0-9]{10}$/.test(id);
}

function asVisitorRequest(req) {
  if (queryValue(req, "as") === "visitor") return true;
  const candidates = [
    req.url,
    req.headers["x-forwarded-uri"],
    req.headers["x-original-url"],
    req.headers["x-vercel-original-url"],
  ];
  return candidates.some((value) => value && /(?:\?|&)as=visitor(?:&|$)/.test(String(value)));
}

function devBypassAllowed(req) {
  if (process.env.VERCEL) return false;
  if (process.env.NODE_ENV === "production") return false;
  const host = safeHost(firstHeader(req.headers["x-forwarded-host"])) || safeHost(firstHeader(req.headers.host));
  const name = host.split(":")[0];
  if (name === "cuepointplanning.com" || name === "www.cuepointplanning.com") return false;
  return true;
}

function wantsDevBypass(req) {
  return req.headers["x-cuepoint-dev-bypass"] === "1";
}

function storageMode() {
  if (process.env.EQUIPMENT_TAGS_STORE === "file") return "file";
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return "supabase";
  return "file";
}

function tagsFile() {
  return process.env.EQUIPMENT_TAGS_FILE || path.join(process.cwd(), "data", "equipment-tags.json");
}

function createId() {
  const bytes = crypto.randomBytes(10);
  let id = "";
  for (let index = 0; index < bytes.length; index += 1) {
    id += ALPHABET[bytes[index] % ALPHABET.length];
  }
  return id;
}

async function readFileTags() {
  try {
    const raw = await readFile(tagsFile(), "utf8");
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("The equipment tag file is not a list.");
    return parsed.map((row) => parseTag(row));
  } catch (error) {
    if (error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeFileTags(tags) {
  const file = tagsFile();
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(tags, null, 2)}\n`, "utf8");
  await rename(temporary, file);
}

function serviceSupabase() {
  const { createClient } = require("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function anonSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const { createClient } = require("@supabase/supabase-js");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function userFromAccessToken(token) {
  const client = anonSupabase();
  if (!client || !token) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data || !data.user) return null;
  return { id: data.user.id };
}

async function currentUser(req) {
  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (bearer) return userFromAccessToken(bearer);
  if (devBypassAllowed(req) && wantsDevBypass(req)) return { id: DEV_USER_ID };
  return null;
}

function tagKey(id) {
  return `${TAG_KEY_PREFIX}${id}`;
}

async function listTags(userId) {
  if (storageMode() === "supabase") {
    const supabase = serviceSupabase();
    const { data, error } = await supabase
      .from("user_data")
      .select("user_id, value")
      .eq("user_id", userId)
      .like("key", `${TAG_KEY_PREFIX}%`);
    if (error) throw new Error(error.message);
    return (data || [])
      .map((row) => parseTag(row.value, row.user_id))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  const tags = await readFileTags();
  return tags
    .filter((tag) => tag.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function getTag(id) {
  if (!isTagId(id)) return null;
  if (storageMode() === "supabase") {
    const supabase = serviceSupabase();
    const { data, error } = await supabase
      .from("user_data")
      .select("user_id, value")
      .eq("key", tagKey(id))
      .limit(1);
    if (error) throw new Error(error.message);
    const row = data && data[0];
    if (!row) return null;
    return parseTag(row.value, row.user_id);
  }
  const tags = await readFileTags();
  return tags.find((tag) => tag.id === id) || null;
}

async function createTag(userId, input) {
  const now = new Date().toISOString();
  if (storageMode() === "supabase") {
    const supabase = serviceSupabase();
    let id = createId();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existing = await getTag(id);
      if (!existing) break;
      id = createId();
    }
    const tag = {
      id,
      name: input.name,
      note: input.note,
      inApp: input.inApp,
      publicDestination: input.publicDestination,
      createdAt: now,
      updatedAt: now,
    };
    const { error } = await supabase.from("user_data").upsert({
      user_id: userId,
      key: tagKey(id),
      value: tag,
      updated_at: now,
    }, { onConflict: "user_id,key" });
    if (error) throw new Error(error.message);
    return { ...tag, userId };
  }
  return exclusive(async () => {
    const tags = await readFileTags();
    let id = createId();
    for (let attempt = 0; attempt < 5 && tags.some((tag) => tag.id === id); attempt += 1) {
      id = createId();
    }
    const tag = {
      id,
      name: input.name,
      note: input.note,
      inApp: input.inApp,
      publicDestination: input.publicDestination,
      createdAt: now,
      updatedAt: now,
      userId,
    };
    tags.push(tag);
    await writeFileTags(tags);
    return tag;
  });
}

async function updateTag(userId, id, input) {
  const now = new Date().toISOString();
  if (storageMode() === "supabase") {
    const current = await getTag(id);
    if (!current || current.userId !== userId) return null;
    const tag = {
      id: current.id,
      name: input.name,
      note: input.note,
      inApp: input.inApp,
      publicDestination: input.publicDestination,
      createdAt: current.createdAt,
      updatedAt: now,
    };
    const supabase = serviceSupabase();
    const { error } = await supabase.from("user_data").upsert({
      user_id: userId,
      key: tagKey(id),
      value: tag,
      updated_at: now,
    }, { onConflict: "user_id,key" });
    if (error) throw new Error(error.message);
    return { ...tag, userId };
  }
  return exclusive(async () => {
    const tags = await readFileTags();
    const index = tags.findIndex((tag) => tag.id === id && tag.userId === userId);
    if (index === -1) return null;
    const current = tags[index];
    const updated = {
      ...current,
      name: input.name,
      note: input.note,
      inApp: input.inApp,
      publicDestination: input.publicDestination,
      updatedAt: now,
    };
    tags[index] = updated;
    await writeFileTags(tags);
    return updated;
  });
}

async function deleteTag(userId, id) {
  if (storageMode() === "supabase") {
    const current = await getTag(id);
    if (!current || current.userId !== userId) return false;
    const supabase = serviceSupabase();
    const { error } = await supabase.from("user_data").delete().eq("user_id", userId).eq("key", tagKey(id));
    if (error) throw new Error(error.message);
    return true;
  }
  return exclusive(async () => {
    const tags = await readFileTags();
    const next = tags.filter((tag) => !(tag.id === id && tag.userId === userId));
    if (next.length === tags.length) return false;
    await writeFileTags(next);
    return true;
  });
}

function ownerView(tag) {
  return {
    id: tag.id,
    name: tag.name,
    note: tag.note,
    inApp: tag.inApp,
    publicDestination: tag.publicDestination,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  };
}

function publicView(tag) {
  return { id: tag.id, name: tag.name };
}

function send(res, status, body, headers) {
  const payload = body == null ? "" : typeof body === "string" ? body : JSON.stringify(body);
  const finalHeaders = {
    "Cache-Control": "no-store",
    ...(typeof body === "string" ? { "Content-Type": "text/html; charset=utf-8" } : body == null ? {} : { "Content-Type": "application/json; charset=utf-8" }),
    ...headers,
  };
  res.writeHead(status, finalHeaders);
  res.end(payload);
}

function sendJson(res, status, body, headers) {
  send(res, status, body, headers);
}

function readJson(req) {
  if (req.body != null && req.body !== "") {
    if (typeof req.body === "object") return Promise.resolve(req.body);
    if (typeof req.body === "string") {
      try {
        return Promise.resolve(JSON.parse(req.body));
      } catch {
        return Promise.reject(Object.assign(new Error("Invalid JSON"), { status: 400 }));
      }
    }
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
      const size = chunks.reduce((sum, part) => sum + part.length, 0);
      if (size > 1_000_000) {
        reject(Object.assign(new Error("Body too large"), { status: 413 }));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("Invalid JSON"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function storeUnavailableMessage() {
  if (storageMode() === "file" && process.env.VERCEL) {
    return "Equipment tags need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on this server.";
  }
  return "";
}

async function handleTap(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET", "Cache-Control": "no-store" });
    res.end();
    return;
  }
  const origin = originFrom(req);
  try {
    const id = tagIdFromRequest(req);
    const tag = isTagId(id) ? await getTag(id) : null;
    const operatorUserId = readOperator(readCookie(req, OPERATOR_COOKIE));
    const decision = decideTap({
      tag,
      operatorUserId,
      asVisitor: asVisitorRequest(req),
      origin,
    });
    if (decision.status === 302) {
      send(res, 302, null, decision.headers);
      return;
    }
    send(res, decision.status, req.method === "HEAD" ? "" : decision.html, decision.headers);
  } catch (error) {
    console.error("[equipment-tags] tap", error && error.message ? error.message : error);
    send(res, 500, missingTagHtml(origin).replace("No tag uses this address", "This tag could not be opened"), {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    });
  }
}

async function handleTags(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Cache-Control": "no-store" });
    res.end();
    return;
  }
  const unavailable = storeUnavailableMessage();
  if (unavailable && req.method !== "GET") {
    sendJson(res, 503, { error: unavailable });
    return;
  }
  try {
    if (req.method === "GET") {
      const id = queryValue(req, "id");
      if (id) {
        if (!isTagId(id)) {
          sendJson(res, 404, { error: "No tag uses this address." });
          return;
        }
        const tag = await getTag(id);
        if (!tag) {
          sendJson(res, 404, { error: "No tag uses this address." });
          return;
        }
        const user = await currentUser(req);
        sendJson(res, 200, { tag: user && user.id === tag.userId ? ownerView(tag) : publicView(tag) });
        return;
      }
      const user = await currentUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Sign in to CuePoint to manage tags." });
        return;
      }
      const tags = await listTags(user.id);
      sendJson(res, 200, { tags: tags.map(ownerView) });
      return;
    }

    const user = await currentUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to CuePoint to manage tags." });
      return;
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const parsed = validateTagInput(body);
      if (!parsed.ok) {
        sendJson(res, 400, { fieldErrors: parsed.fieldErrors });
        return;
      }
      const tag = await createTag(user.id, parsed.value);
      sendJson(res, 201, { tag: ownerView(tag) });
      return;
    }

    if (req.method === "PUT" || req.method === "PATCH") {
      const body = await readJson(req);
      const id = String(body.id || queryValue(req, "id") || "");
      if (!isTagId(id)) {
        sendJson(res, 400, { error: "That tag id is not valid." });
        return;
      }
      const parsed = validateTagInput(body);
      if (!parsed.ok) {
        sendJson(res, 400, { fieldErrors: parsed.fieldErrors });
        return;
      }
      const updated = await updateTag(user.id, id, parsed.value);
      if (!updated) {
        sendJson(res, 404, { error: "That tag is no longer in CuePoint." });
        return;
      }
      sendJson(res, 200, { tag: ownerView(updated) });
      return;
    }

    if (req.method === "DELETE") {
      const id = queryValue(req, "id");
      if (!isTagId(id)) {
        sendJson(res, 400, { error: "That tag id is not valid." });
        return;
      }
      await deleteTag(user.id, id);
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    const status = error && error.status ? error.status : 500;
    console.error("[equipment-tags]", error && error.message ? error.message : error);
    sendJson(res, status, {
      error: status === 400
        ? "That request was not valid JSON."
        : req.method === "GET"
          ? "Could not load this tag."
          : "Could not save this tag.",
    });
  }
}

async function handleOperator(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Cache-Control": "no-store" });
    res.end();
    return;
  }
  const secure = cookieIsSecure(req);
  if (req.method === "DELETE") {
    sendJson(res, 200, { ok: true }, {
      "Set-Cookie": buildSetCookie("", { secure, maxAge: 0 }),
    });
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  try {
    const user = await currentUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Sign in to CuePoint in this browser before a tag can open the in-app page." });
      return;
    }
    const token = signOperator(user.id);
    if (!token) {
      sendJson(res, 503, { error: "This server cannot sign the operator cookie." });
      return;
    }
    sendJson(res, 200, { ok: true }, {
      "Set-Cookie": buildSetCookie(token, { secure, maxAge: COOKIE_MAX_AGE }),
    });
  } catch (error) {
    console.error("[equipment-tags] operator", error && error.message ? error.message : error);
    sendJson(res, 500, { error: "Could not save this browser for tag taps." });
  }
}

module.exports = {
  OPERATOR_COOKIE,
  DEV_USER_ID,
  appUrl,
  asVisitorRequest,
  buildSetCookie,
  cookieIsSecure,
  decideTap,
  handleOperator,
  handleTags,
  handleTap,
  normalizeHttpUrl,
  originFrom,
  readOperator,
  resolveDestination,
  signOperator,
  validateTagInput,
};
