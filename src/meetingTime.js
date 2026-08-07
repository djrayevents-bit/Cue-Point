/**
 * Meeting timezone helpers (DJ wall time ↔ client local display).
 */

export function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour,
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

/** Convert DJ wall date+HH:MM in `timeZone` to a Date (UTC instant). */
export function wallTimeToUtc(dateStr, timeHHMM, timeZone) {
  const [y, mo, d] = String(dateStr).split("-").map(Number);
  const [hh, mm] = String(timeHHMM || "00:00").split(":").map(Number);
  let utc = Date.UTC(y, mo - 1, d, hh, mm, 0);
  const tz = timeZone || "UTC";
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(utc), tz);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
    const desired = Date.UTC(y, mo - 1, d, hh, mm, 0);
    utc += desired - asUtc;
  }
  return new Date(utc);
}

export function formatInZone(date, timeZone, opts = {}) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone || "UTC",
    weekday: opts.weekday,
    month: opts.month || "short",
    day: opts.day || "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: opts.timeZoneName || "short",
    ...opts,
  }).format(date);
}

export function formatTimeInZone(date, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone || "UTC",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatDateInZone(date, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone || "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function dateKeyInZone(date, timeZone) {
  const p = zonedParts(date, timeZone || "UTC");
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/**
 * Group DJ slots by the client's local calendar date.
 * Each item: { dateKey, label, slots: [{ startTime, endTime, startUtc, label }] }
 * startTime/endTime remain DJ wall times for booking API.
 */
export function groupSlotsForClient(djSlots, djTimeZone, clientTimeZone) {
  const byDay = new Map();
  for (const slot of djSlots || []) {
    const startUtc = wallTimeToUtc(slot.date, slot.startTime, djTimeZone);
    const endUtc = wallTimeToUtc(slot.date, slot.endTime, djTimeZone);
    const dateKey = dateKeyInZone(startUtc, clientTimeZone);
    if (!byDay.has(dateKey)) {
      byDay.set(dateKey, {
        dateKey,
        label: formatDateInZone(startUtc, clientTimeZone),
        slots: [],
      });
    }
    byDay.get(dateKey).slots.push({
      ...slot,
      startUtc,
      endUtc,
      clientLabel: formatTimeInZone(startUtc, clientTimeZone),
      djLabel: formatTimeInZone(startUtc, djTimeZone),
    });
  }
  return [...byDay.values()]
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .map((day) => ({
      ...day,
      slots: day.slots.sort((a, b) => a.startUtc - b.startUtc),
    }));
}

export function sameZone(a, b) {
  return String(a || "").toLowerCase() === String(b || "").toLowerCase();
}
