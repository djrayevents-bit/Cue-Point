import { supabase } from "./supabase";

export function nfcOrigin() {
  const protocol = window.location.protocol;
  if (protocol === "capacitor:" || protocol === "ionic:") return "https://cuepointplanning.com";
  return window.location.origin;
}

export function tagTapUrl(id, asVisitor = false) {
  return `${nfcOrigin()}/t/${id}${asVisitor ? "?as=visitor" : ""}`;
}

export function tagUrlHostWarning() {
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return "This address only works on this computer. On your phone, open CuePoint with this Mac’s network address, then copy the NFC URL again.";
  }
  return "";
}

export function describeDestination(destination, audience) {
  if (!destination) return "";
  if (destination.kind === "external") return destination.url;
  return audience === "inApp"
    ? "Internal page — operator view"
    : "Internal page — visitor info";
}

function devBypass() {
  try {
    return import.meta.env.DEV && localStorage.getItem("cuepoint_dev_skip_auth") === "1";
  } catch {
    return false;
  }
}

async function authHeaders() {
  const headers = { "Content-Type": "application/json" };
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  else if (devBypass()) headers["X-Cuepoint-Dev-Bypass"] = "1";
  return headers;
}

async function readJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `Request failed (${res.status})`);
    error.fieldErrors = data.fieldErrors;
    error.status = res.status;
    throw error;
  }
  return data;
}

export async function syncOperatorCookie() {
  const headers = await authHeaders();
  if (!headers.Authorization && !headers["X-Cuepoint-Dev-Bypass"]) {
    return { ok: false, error: "Sign in to CuePoint in this browser." };
  }
  try {
    const res = await fetch("/api/equipment-operator", {
      method: "POST",
      credentials: "include",
      headers,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || "Could not save this browser for tag taps." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach CuePoint to save this browser for tag taps." };
  }
}

export async function clearOperatorCookie() {
  await fetch("/api/equipment-operator", {
    method: "DELETE",
    credentials: "include",
  });
}

export async function listEquipmentTags() {
  const res = await fetch("/api/equipment-tags", {
    credentials: "include",
    headers: await authHeaders(),
  });
  const data = await readJson(res);
  return data.tags || [];
}

export async function fetchEquipmentTag(id, { owner = false } = {}) {
  const headers = owner ? await authHeaders() : {};
  const res = await fetch(`/api/equipment-tags?id=${encodeURIComponent(id)}`, {
    credentials: owner ? "include" : "same-origin",
    headers,
  });
  const data = await readJson(res);
  return data.tag;
}

export async function saveEquipmentTag(input, id) {
  const res = await fetch("/api/equipment-tags", {
    method: id ? "PUT" : "POST",
    credentials: "include",
    headers: await authHeaders(),
    body: JSON.stringify(id ? { ...input, id } : input),
  });
  const data = await readJson(res);
  return data.tag;
}

export async function deleteEquipmentTag(id) {
  const res = await fetch(`/api/equipment-tags?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
    headers: await authHeaders(),
  });
  await readJson(res);
}
