/**
 * Zoom helpers for CuePoint Scheduling.
 * Env: ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_REDIRECT_URI (optional, defaults to /api/meetings)
 */

const { createClient } = require("@supabase/supabase-js");

const TOKEN_KEY = "zoomAuth";

function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function zoomConfigured() {
  return !!(process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);
}

function redirectUri(req) {
  if (process.env.ZOOM_REDIRECT_URI) return process.env.ZOOM_REDIRECT_URI;
  const proto = req?.headers?.["x-forwarded-proto"] || "https";
  const host = req?.headers?.["x-forwarded-host"] || req?.headers?.host || "cuepointplanning.com";
  return `${proto}://${host}/api/meetings`;
}

function basicAuthHeader() {
  const raw = `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

async function getStoredAuth(userId) {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("user_data")
    .select("value")
    .eq("user_id", userId)
    .eq("key", TOKEN_KEY)
    .maybeSingle();
  return data?.value || null;
}

async function saveStoredAuth(userId, value) {
  const supabase = supabaseAdmin();
  await supabase.from("user_data").upsert(
    {
      user_id: userId,
      key: TOKEN_KEY,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,key" }
  );
}

async function clearStoredAuth(userId) {
  const supabase = supabaseAdmin();
  await supabase.from("user_data").delete().eq("user_id", userId).eq("key", TOKEN_KEY);
}

async function exchangeCode(code, req) {
  const body = new URLSearchParams({
    code,
    redirect_uri: redirectUri(req),
    grant_type: "authorization_code",
  });
  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.reason || json.error || "Zoom token exchange failed");
  return json;
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.reason || json.error || "Zoom refresh failed");
  return json;
}

async function getValidAccessToken(userId) {
  const stored = await getStoredAuth(userId);
  if (!stored?.refreshToken && !stored?.accessToken) return null;
  const expiresAt = Number(stored.expiresAt || 0);
  if (stored.accessToken && expiresAt > Date.now() + 60_000) {
    return { accessToken: stored.accessToken, stored };
  }
  if (!stored.refreshToken || !zoomConfigured()) return null;
  const refreshed = await refreshAccessToken(stored.refreshToken);
  const next = {
    ...stored,
    accessToken: refreshed.access_token,
    expiresAt: Date.now() + (Number(refreshed.expires_in) || 3600) * 1000,
    refreshToken: refreshed.refresh_token || stored.refreshToken,
  };
  await saveStoredAuth(userId, next);
  return { accessToken: next.accessToken, stored: next };
}

async function fetchZoomEmail(accessToken) {
  const res = await fetch("https://api.zoom.us/v2/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return "";
  const json = await res.json();
  return json.email || "";
}

function buildAuthUrl({ userId, req, stateNonce }) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ZOOM_CLIENT_ID,
    redirect_uri: redirectUri(req),
    state: `z.${userId}.${stateNonce}`,
  });
  return `https://zoom.us/oauth/authorize?${params.toString()}`;
}

async function createZoomMeeting({ userId, meeting, timeZone, personalLink }) {
  const stored = userId ? await getStoredAuth(userId) : null;
  const fallback = String(personalLink || stored?.personalLink || "").trim();
  if (!zoomConfigured()) {
    if (fallback) return { meetLink: fallback };
    return { error: "Connect Zoom first, or save a personal Zoom link." };
  }
  const token = await getValidAccessToken(userId);
  if (!token?.accessToken) {
    if (fallback) return { meetLink: fallback };
    return { error: "Connect Zoom first." };
  }
  const start = `${meeting.date}T${String(meeting.startTime || "00:00").slice(0, 5)}:00`;
  const res = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: meeting.title || meeting.meetingTypeTitle || "Meeting",
      type: 2,
      start_time: start,
      duration: Number(meeting.durationMins) || 30,
      timezone: timeZone || "America/New_York",
      settings: { join_before_host: true, waiting_room: false },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (fallback) return { meetLink: fallback };
    return { error: json.message || "Zoom could not create the meeting." };
  }
  return { meetLink: json.join_url || fallback, eventId: json.id ? String(json.id) : "" };
}

module.exports = {
  TOKEN_KEY,
  zoomConfigured,
  getStoredAuth,
  saveStoredAuth,
  clearStoredAuth,
  exchangeCode,
  fetchZoomEmail,
  buildAuthUrl,
  createZoomMeeting,
};
