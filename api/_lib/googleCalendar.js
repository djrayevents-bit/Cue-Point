/**
 * Google Calendar helpers for CuePoint Scheduling.
 * Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI (optional)
 */

const { createClient } = require("@supabase/supabase-js");

const TOKEN_KEY = "googleCalendarAuth";

function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function googleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function redirectUri(req) {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const proto = req?.headers?.["x-forwarded-proto"] || "https";
  const host = req?.headers?.["x-forwarded-host"] || req?.headers?.host || "cuepointplanning.com";
  return `${proto}://${host}/api/meetings`;
}

function appOrigin(req) {
  const proto = req?.headers?.["x-forwarded-proto"] || "https";
  const host = req?.headers?.["x-forwarded-host"] || req?.headers?.host || "cuepointplanning.com";
  return `${proto}://${host}`;
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
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri(req),
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || json.error || "Token exchange failed");
  return json;
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || json.error || "Refresh failed");
  return json;
}

async function getValidAccessToken(userId) {
  const stored = await getStoredAuth(userId);
  if (!stored?.refreshToken && !stored?.accessToken) return null;

  const expiresAt = Number(stored.expiresAt || 0);
  if (stored.accessToken && expiresAt > Date.now() + 60_000) {
    return { accessToken: stored.accessToken, stored };
  }

  if (!stored.refreshToken) return null;
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

async function fetchGoogleEmail(accessToken) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return "";
  const json = await res.json();
  return json.email || "";
}

/**
 * Create a Calendar event with Google Meet. Returns { meetLink, htmlLink, eventId } or null.
 */
async function createMeetEvent({ userId, meeting, timeZone, djName }) {
  if (!googleConfigured()) return null;
  const token = await getValidAccessToken(userId);
  if (!token?.accessToken) return null;

  const tz = timeZone || "America/New_York";
  const startDateTime = `${meeting.date}T${meeting.startTime}:00`;
  const endDateTime = `${meeting.date}T${meeting.endTime}:00`;
  const requestId = `cp-${meeting.id}-${Date.now()}`;

  const body = {
    summary: meeting.title || `Meeting with ${meeting.clientName}`,
    description: [
      `Scheduled via CuePoint Planning${djName ? ` (${djName})` : ""}.`,
      meeting.notes ? `Notes: ${meeting.notes}` : "",
      meeting.clientName ? `Client: ${meeting.clientName}` : "",
      meeting.clientEmail ? `Email: ${meeting.clientEmail}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    start: { dateTime: startDateTime, timeZone: tz },
    end: { dateTime: endDateTime, timeZone: tz },
    attendees: meeting.clientEmail ? [{ email: meeting.clientEmail }] : [],
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Google Calendar create failed:", res.status, json);
    return null;
  }

  const entryPoints = json.conferenceData?.entryPoints || [];
  const video = entryPoints.find((e) => e.entryPointType === "video");
  const meetLink = video?.uri || json.hangoutLink || "";

  return {
    meetLink,
    htmlLink: json.htmlLink || "",
    eventId: json.id || "",
  };
}

async function updateMeetEvent({ userId, eventId, meeting, timeZone }) {
  if (!eventId || !googleConfigured()) return null;
  const token = await getValidAccessToken(userId);
  if (!token?.accessToken) return null;
  const tz = timeZone || "America/New_York";
  const body = {
    start: { dateTime: `${meeting.date}T${meeting.startTime}:00`, timeZone: tz },
    end: { dateTime: `${meeting.date}T${meeting.endTime}:00`, timeZone: tz },
    summary: meeting.title || `Meeting with ${meeting.clientName}`,
  };
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error("Google Calendar update failed:", res.status, err);
    return null;
  }
  return true;
}

async function cancelMeetEvent({ userId, eventId }) {
  if (!eventId || !googleConfigured()) return null;
  const token = await getValidAccessToken(userId);
  if (!token?.accessToken) return null;
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token.accessToken}` },
    }
  );
  if (!res.ok && res.status !== 404) {
    console.error("Google Calendar delete failed:", res.status);
    return null;
  }
  return true;
}

function buildAuthUrl({ userId, req, stateNonce }) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(req),
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    state: `${userId}.${stateNonce}`,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

module.exports = {
  TOKEN_KEY,
  googleConfigured,
  redirectUri,
  appOrigin,
  getStoredAuth,
  saveStoredAuth,
  clearStoredAuth,
  exchangeCode,
  getValidAccessToken,
  fetchGoogleEmail,
  createMeetEvent,
  updateMeetEvent,
  cancelMeetEvent,
  buildAuthUrl,
};
