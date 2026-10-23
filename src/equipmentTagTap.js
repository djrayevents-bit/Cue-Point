/**
 * Decide where an equipment-tag URL goes inside the installed app.
 * The phone without the app never reaches this code: https://cuepointplanning.com/t/:id
 * still redirects on the web.
 */

const TAG_HOSTS = new Set(["cuepointplanning.com", "www.cuepointplanning.com"]);
const TAG_ID = /^[a-z0-9]{10}$/;
const PUBLIC_ORIGIN = "https://cuepointplanning.com";

export function parseEquipmentTagUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!TAG_HOSTS.has(url.hostname)) return null;
  const match = url.pathname.match(/^\/t\/([^/]+)\/?$/);
  if (!match) return null;
  let id = match[1];
  try {
    id = decodeURIComponent(id);
  } catch {
    /* keep the raw segment */
  }
  if (!TAG_ID.test(id)) return null;
  return { id, asVisitor: url.searchParams.get("as") === "visitor" };
}

function httpUrl(value, base) {
  if (!value || typeof value !== "string") return null;
  try {
    const url = base ? new URL(value, base) : new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

function hashFor(id, audience) {
  return audience === "inApp"
    ? `#/equipment-tag/${id}/work`
    : `#/equipment-tag/${id}`;
}

function destinationTarget(id, destination, audience) {
  if (destination && destination.kind === "external") {
    const url = httpUrl(destination.url);
    if (url) return { type: "external", url: url.toString() };
  }
  return { type: "hash", hash: hashFor(id, audience) };
}

function tagHash(url, id) {
  const hash = url.hash || "";
  const publicHash = hashFor(id, "public");
  const workHash = hashFor(id, "inApp");
  if (hash === publicHash || hash.startsWith(`${publicHash}?`)) return "public";
  if (hash === workHash || hash.startsWith(`${workHash}?`)) return "work";
  return "";
}

function isCuePointScreen(url) {
  if (!TAG_HOSTS.has(url.hostname)) return false;
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return path === "/" || path === "/app";
}

export function publicTarget(id, publicLocation) {
  const fallback = { type: "hash", hash: hashFor(id, "public") };
  if (!publicLocation) return fallback;
  const url = httpUrl(publicLocation, PUBLIC_ORIGIN);
  if (!url) return fallback;
  if (TAG_HOSTS.has(url.hostname)) {
    const path = url.pathname.replace(/\/+$/, "");
    const which = tagHash(url, id);
    if (which === "public" || which === "work" || isCuePointScreen(url) || path === `/t/${id}`) {
      return fallback;
    }
  }
  return { type: "external", url: url.toString() };
}

export function resolveEquipmentTagOpen({ rawUrl, signedIn, ownerTag, publicLocation }) {
  const parsed = parseEquipmentTagUrl(rawUrl);
  if (!parsed) return null;
  const ownerDestination = ownerTag && ownerTag.inApp;
  if (signedIn && !parsed.asVisitor && ownerDestination) {
    return destinationTarget(parsed.id, ownerDestination, "inApp");
  }
  return publicTarget(parsed.id, publicLocation || "");
}
