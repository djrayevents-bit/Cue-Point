export const TIME_FORMAT_12 = "12h";
export const TIME_FORMAT_24 = "24h";
export const DEFAULT_TIME_FORMAT = TIME_FORMAT_12;

/** Parse "18:30", "6:30 PM", "9:00" → { hours, minutes } or null */
export function parseTimeString(timeStr) {
  if (!timeStr || timeStr === "TBD") return null;
  const trimmed = String(timeStr).trim();

  let m = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ap = m[3].toUpperCase();
    if (ap === "AM" && h === 12) h = 0;
    if (ap === "PM" && h !== 12) h += 12;
    return { hours: h, minutes: min };
  }

  m = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    return { hours: parseInt(m[1], 10), minutes: parseInt(m[2], 10) };
  }

  return null;
}

export function to24HourString(timeStr) {
  if (!timeStr || timeStr === "TBD") return timeStr || "";
  const p = parseTimeString(timeStr);
  if (!p) return timeStr;
  return `${String(p.hours).padStart(2, "0")}:${String(p.minutes).padStart(2, "0")}`;
}

export function formatDisplayTime(timeStr, format = TIME_FORMAT_12) {
  if (!timeStr || timeStr === "TBD") return timeStr || "";
  const p = parseTimeString(timeStr);
  if (!p) return timeStr;
  if (format === TIME_FORMAT_24) {
    return `${String(p.hours).padStart(2, "0")}:${String(p.minutes).padStart(2, "0")}`;
  }
  let h = p.hours % 12;
  if (h === 0) h = 12;
  const ap = p.hours >= 12 ? "PM" : "AM";
  return `${h}:${String(p.minutes).padStart(2, "0")} ${ap}`;
}

export function formatTimeRange(start, end, format = TIME_FORMAT_12) {
  if (!start && !end) return "TBD";
  const s = start ? formatDisplayTime(start, format) : "TBD";
  const e = end ? formatDisplayTime(end, format) : "";
  return e ? `${s} – ${e}` : s;
}

export function parseToParts(timeStr) {
  const p = parseTimeString(timeStr);
  if (!p) return { hour: "", minute: "00", ampm: "PM" };
  let h = p.hours % 12;
  if (h === 0) h = 12;
  return {
    hour: String(h),
    minute: String(p.minutes).padStart(2, "0"),
    ampm: p.hours >= 12 ? "PM" : "AM",
  };
}

export function partsTo24Hour({ hour, minute, ampm }) {
  if (!hour && hour !== 0) return "";
  let h = parseInt(hour, 10);
  const m = parseInt(minute || "0", 10);
  if (Number.isNaN(h)) return "";
  if (ampm === "AM" && h === 12) h = 0;
  if (ampm === "PM" && h !== 12) h += 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function timeToMinutes(timeStr) {
  const p = parseTimeString(timeStr);
  if (!p) return 9999;
  return p.hours * 60 + p.minutes;
}

export function localeTimeOptions(format = TIME_FORMAT_12) {
  return {
    hour: "2-digit",
    minute: "2-digit",
    hour12: format === TIME_FORMAT_12,
  };
}

export function formatNow(date = new Date(), format = TIME_FORMAT_12, { seconds = false } = {}) {
  const opts = { ...localeTimeOptions(format) };
  if (seconds) opts.second = "2-digit";
  return date.toLocaleTimeString("en-US", opts);
}
