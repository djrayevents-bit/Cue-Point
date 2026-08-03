/** Day-of timeline helpers — grounded Now/Next + replan that keeps past moments stable. */

/** Minutes since midnight from "H:MM AM/PM", "HH:MM", or Date. */
export const timeToMinutesOfDay = (raw) => {
  if (raw instanceof Date) {
    return raw.getHours() * 60 + raw.getMinutes();
  }
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  const m = s.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = (m[3] || "").toUpperCase();
  if (ap === "AM" && h === 12) h = 0;
  if (ap === "PM" && h !== 12) h += 12;
  if (!ap && h > 23) return null;
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
};

export const minutesFromIso = (iso) => {
  if (!iso) return timeToMinutesOfDay(new Date());
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return timeToMinutesOfDay(new Date());
  return timeToMinutesOfDay(d);
};

/** Prefer today's event, else next upcoming by date, else first. */
export const pickTodayOrNextEvent = (events = [], todayIso = null) => {
  const list = Array.isArray(events) ? events.filter(Boolean) : [];
  if (!list.length) return null;
  const today = todayIso || new Date().toISOString().slice(0, 10);
  const todays = list.filter((e) => e.date === today).sort((a, b) => String(a.startTime || "").localeCompare(String(b.startTime || "")));
  if (todays.length) return todays[0];
  const upcoming = list
    .filter((e) => e.date && e.date >= today)
    .sort((a, b) => (a.date === b.date
      ? String(a.startTime || "").localeCompare(String(b.startTime || ""))
      : (a.date > b.date ? 1 : -1)));
  return upcoming[0] || list[0];
};

const labelOf = (it) => String(it?.event || it?.label || "Moment").trim();

/**
 * Ground Now / Next / Coming up from a real timeline + local clock.
 * @returns {{ current, next, comingUp, past, remaining, timedItems, currentIdx, hasTimeline }}
 */
export const getTimelinePosition = (items = [], now = new Date()) => {
  const list = Array.isArray(items) ? items.slice() : [];
  const hasTimeline = list.length > 0;
  const nowMin = timeToMinutesOfDay(now instanceof Date ? now : new Date(now));

  const withIdx = list.map((it, i) => ({
    ...it,
    label: labelOf(it),
    _i: i,
    _min: timeToMinutesOfDay(it.time),
  }));

  const timed = withIdx
    .filter((it) => it._min != null)
    .sort((a, b) => a._min - b._min);

  let currentIdx = -1;
  for (let i = 0; i < timed.length; i += 1) {
    const t = timed[i]._min;
    const nextT = timed[i + 1] ? timed[i + 1]._min : Infinity;
    if (nowMin >= t && nowMin < nextT) {
      currentIdx = i;
      break;
    }
  }
  // Before first moment → nothing current; after last → last is current
  if (currentIdx < 0 && timed.length) {
    if (nowMin < timed[0]._min) currentIdx = -1;
    else currentIdx = timed.length - 1;
  }

  const current = currentIdx >= 0 ? timed[currentIdx] : null;
  const next = currentIdx >= 0 ? (timed[currentIdx + 1] || null) : (timed[0] || null);
  const comingUp = (() => {
    if (!timed.length) return [];
    // After Next: 2–4 further moments (Next is shown separately in the shell)
    const start = currentIdx >= 0 ? currentIdx + 2 : 1;
    return timed.slice(start, start + 4);
  })();

  const past = timed.filter((it, i) => currentIdx >= 0 && i < currentIdx);
  const remaining = timed.filter((it, i) => currentIdx < 0 || i >= currentIdx);

  return {
    current,
    next,
    comingUp,
    past,
    remaining,
    timedItems: timed,
    currentIdx,
    hasTimeline,
    nowMin,
  };
};

/** Countdown string to next timed moment, or null. */
export const countdownTo = (nextItem, now = new Date()) => {
  if (!nextItem?.time) return null;
  const nextMin = timeToMinutesOfDay(nextItem.time);
  const nowMin = timeToMinutesOfDay(now);
  if (nextMin == null || nowMin == null) return null;
  const diff = nextMin - nowMin;
  if (diff < 0) return null;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
};

/** Find MC script matching a moment label (fuzzy contains / equality). */
export const findScriptForMoment = (scripts = [], moment) => {
  if (!moment) return null;
  const label = labelOf(moment).toLowerCase();
  if (!label) return null;
  const list = Array.isArray(scripts) ? scripts : [];
  const exact = list.find((s) => String(s.label || "").toLowerCase() === label);
  if (exact) return exact;
  return list.find((s) => {
    const sl = String(s.label || "").toLowerCase();
    return sl && (label.includes(sl) || sl.includes(label));
  }) || null;
};

/**
 * Keep past moments (time < now) from existing; replace remaining with proposed remaining.
 * Untimed existing items that appear before the first remaining timed slot stay in past bucket by order.
 */
export const buildDayOfReplanTimeline = (existing = [], proposed = [], nowMinutes) => {
  const nowMin = nowMinutes == null ? timeToMinutesOfDay(new Date()) : nowMinutes;
  const existingList = Array.isArray(existing) ? existing : [];
  const proposedList = Array.isArray(proposed) ? proposed : [];

  const isPast = (it) => {
    const m = timeToMinutesOfDay(it?.time);
    if (m == null) return false;
    return m < nowMin;
  };

  const past = existingList.filter(isPast).map((it) => ({ ...it }));
  const remainingProposed = proposedList
    .filter((it) => {
      const m = timeToMinutesOfDay(it?.time);
      if (m == null) return true; // allow untimed cues in remaining
      return m >= nowMin;
    })
    .map((it, i) => ({
      ...it,
      id: typeof it.id === "number" ? it.id : Date.now() + i + Math.floor(Math.random() * 500),
    }));

  // If model only returned remaining (no past), fine. If empty remaining, keep existing remaining.
  if (!remainingProposed.length) {
    const existingRemaining = existingList.filter((it) => !isPast(it));
    return [...past, ...existingRemaining];
  }

  const merged = [...past, ...remainingProposed];
  merged.sort((a, b) => {
    const am = timeToMinutesOfDay(a.time);
    const bm = timeToMinutesOfDay(b.time);
    if (am == null && bm == null) return 0;
    if (am == null) return 1;
    if (bm == null) return -1;
    return am - bm;
  });
  return merged;
};

/** Check if proposed remaining overruns event endTime (minutes). */
export const detectEndTimeOverrun = (items = [], endTime) => {
  const endMin = timeToMinutesOfDay(endTime);
  if (endMin == null) return null;
  let latest = null;
  for (const it of items || []) {
    const m = timeToMinutesOfDay(it.time);
    if (m != null && (latest == null || m > latest)) latest = m;
  }
  if (latest == null) return null;
  if (latest <= endMin) return null;
  const over = latest - endMin;
  return `Proposed timeline runs ${over} min past event end (${endTime}).`;
};
