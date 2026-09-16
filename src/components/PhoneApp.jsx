/**
 * CuePoint phone shell — bottom tabs matching the iOS mockups.
 * No Billing & Plan entry. Automations opens the shared empty-first page.
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import CuePointLogo from "./CuePointLogo";
import { BRAND_ACCENT, BRAND_ACCENT_SOFT, BRAND_FONT, BRAND_GRADIENT } from "../brand";
import { eventPaidTotals, invoicePaidAmount } from "../eventMoney";

const TABS = [
  { id: "home", label: "Home", section: null },
  { id: "events", label: "Events", section: "events" },
  { id: "cue", label: "CUE", section: null, center: true },
  { id: "money", label: "Money", section: "financials" },
  { id: "more", label: "More", section: null },
];

/** More menu — mirrors desktop nav without Billing & Plan. Clients lives here (not in tab bar). */
export const PHONE_MORE_ITEMS = [
  { label: "DJ Planning", blurb: "Timelines, playlists, and night-of notes", section: "djplanning", group: "Music & Planning", tint: "#E8F8EF", ink: "#2FBF6B" },
  { label: "Contracts", blurb: "Templates and sent agreements", section: "templates", group: "Music & Planning", tint: "#E8F4FC", ink: "#2563EB" },
  { label: "Questionnaires", blurb: "Client intake and song forms", section: "templates", group: "Music & Planning", tint: "#FCE7F3", ink: "#DB2777" },
  { label: "Templates", blurb: "Reusable contracts and forms", section: "templates", group: "Music & Planning", tint: BRAND_ACCENT_SOFT, ink: BRAND_ACCENT },
  { label: "Day-of Mode", blurb: "Booth-ready run of show", section: "dayof", group: "Music & Planning", tint: "#FFF4E5", ink: "#C2410C" },
  { label: "Clients", blurb: "Your booked client list", section: "clients", group: "Clients & Leads", tint: BRAND_ACCENT_SOFT, ink: BRAND_ACCENT },
  { label: "Leads & CRM", blurb: "Inquiries and follow-ups", section: "leads", group: "Clients & Leads", tint: "#E8F4FC", ink: "#2563EB" },
  { label: "Client Portal", blurb: "Share event pages with clients", section: "clientportal", group: "Clients & Leads", tint: "#E0F2FE", ink: "#0284C7" },
  { label: "Automations", blurb: "Reminders that send themselves", section: "automations", group: "Clients & Leads", tint: "#FCE7F3", ink: "#DB2777" },
  { label: "Quick Texts", blurb: "Saved messages ready to send", section: "quicktexts", group: "Clients & Leads", tint: BRAND_ACCENT_SOFT, ink: BRAND_ACCENT },
  { label: "Venues", blurb: "Rooms, contacts, and load-in notes", section: "venues", group: "Clients & Leads", tint: "#FFEDD5", ink: "#C2410C" },
  { label: "Scheduling", blurb: "Meetings and availability links", section: "meetings", group: "Clients & Leads", tint: "#FCE7F3", ink: "#DB2777" },
  { label: "Calendar", blurb: "Block dates and sync feeds", section: "availability", group: "Calendar", tint: "#FCE7F3", ink: "#DB2777" },
  { label: "Pricing and Packaging", blurb: "Packages, add-ons, and rates", section: "pricing", group: "Money", tint: "#E8F8EF", ink: "#2FBF6B" },
  { label: "Financials", blurb: "Invoices, expenses, and reports", section: "financials", group: "Money", tint: "#FFEDD5", ink: "#C2410C" },
  { label: "Equipment", blurb: "Gear inventory and charging", section: "equipment", group: "Gear & Team", tint: "#E8F4FC", ink: "#2563EB" },
  { label: "Wardrobe", blurb: "Looks and cleaners tracking", section: "wardrobe", group: "Gear & Team", tint: "#FCE7F3", ink: "#DB2777" },
  { label: "Staff & Team", blurb: "Helpers and payroll contacts", section: "staff", group: "Gear & Team", tint: BRAND_ACCENT_SOFT, ink: BRAND_ACCENT },
  { label: "Settings", blurb: "Account and brand profile", section: "settings", group: "Settings & Updates", tint: "#F3F4F6", ink: "#4B5563" },
  { label: "Preferences", blurb: "Lists, defaults, and labels", section: "preferences", group: "Settings & Updates", tint: "#F3F4F6", ink: "#4B5563" },
  { label: "What's New", blurb: "Latest CuePoint updates", section: "changelog", group: "Settings & Updates", tint: BRAND_ACCENT_SOFT, ink: BRAND_ACCENT },
];

const TabIcon = ({ id, active, color }) => {
  const c = active ? color : "#8E8E93";
  const s = 22;
  if (id === "home") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z" stroke={c} strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }
  if (id === "events") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="16" rx="3" stroke={c} strokeWidth="1.8" />
        <path d="M3 10h18M8 3v4M16 3v4" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "clients") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="3.5" stroke={c} strokeWidth="1.8" />
        <path d="M4 20c0-3.5 3.1-6 8-6s8 2.5 8 6" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "money") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M4 19V10M10 19V6M16 19v-7M22 19V8" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="2" stroke={c} strokeWidth="1.8" />
      <rect x="14" y="3" width="7" height="7" rx="2" stroke={c} strokeWidth="1.8" />
      <rect x="3" y="14" width="7" height="7" rx="2" stroke={c} strokeWidth="1.8" />
      <rect x="14" y="14" width="7" height="7" rx="2" stroke={c} strokeWidth="1.8" />
    </svg>
  );
};

const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`;

const toISODate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Compact month calendar — always rendered, even with zero events. */
function PhoneMonthCalendar({ C, events, selectedISO, onSelectDay, onOpenEventDetail, onOpenNewEvent, setSection }) {
  const today = new Date();
  const todayISO = toISODate(today);
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleString("en-US", { month: "long", year: "numeric" });

  const eventDates = useMemo(() => {
    const map = new Map();
    (events || []).forEach((ev) => {
      if (!ev?.date) return;
      const key = String(ev.date).slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    });
    return map;
  }, [events]);

  const cells = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();
    const out = [];
    for (let i = firstDow - 1; i >= 0; i -= 1) {
      const day = daysInPrev - i;
      const date = new Date(year, month - 1, day);
      out.push({ day, current: false, iso: toISODate(date) });
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      const date = new Date(year, month, d);
      out.push({ day: d, current: true, iso: toISODate(date) });
    }
    let nextDay = 1;
    while (out.length % 7 !== 0) {
      const date = new Date(year, month + 1, nextDay);
      out.push({ day: nextDay, current: false, iso: toISODate(date) });
      nextDay += 1;
    }
    return out;
  }, [year, month]);

  const selectedEvents = eventDates.get(selectedISO) || [];
  const selectedLabel = (() => {
    try {
      return new Date(`${selectedISO}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric",
      });
    } catch {
      return selectedISO;
    }
  })();

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: C.muted }}>CALENDAR</div>
        <button
          type="button"
          onClick={() => setSection("availability")}
          style={{ background: "none", border: "none", color: BRAND_ACCENT, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: BRAND_FONT, padding: 0 }}
        >
          Full calendar →
        </button>
      </div>

      <div style={{
        background: "linear-gradient(180deg, #FFFFFF 0%, #FBFBFD 100%)",
        borderRadius: 22,
        padding: "14px 12px 12px",
        boxShadow: "0 8px 24px rgba(22,22,26,0.06)",
        border: `1px solid ${C.border}`,
      }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, padding: "0 4px" }}>
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            style={{
              width: 36, height: 36, borderRadius: 12, border: `1px solid ${C.border}`,
              background: "#fff", color: C.text, cursor: "pointer", fontSize: 18, fontFamily: BRAND_FONT,
            }}
          >
            ‹
          </button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-0.02em", color: C.text }}>{monthLabel}</div>
            <button
              type="button"
              onClick={() => {
                setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
                onSelectDay(todayISO);
              }}
              style={{
                marginTop: 2, background: "none", border: "none", color: BRAND_ACCENT,
                fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: BRAND_FONT, padding: 0,
              }}
            >
              Jump to today
            </button>
          </div>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            style={{
              width: 36, height: 36, borderRadius: 12, border: `1px solid ${C.border}`,
              background: "#fff", color: C.text, cursor: "pointer", fontSize: 18, fontFamily: BRAND_FONT,
            }}
          >
            ›
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={`${d}-${i}`} style={{ textAlign: "center", fontSize: 10, fontWeight: 800, color: C.muted, padding: "4px 0" }}>{d}</div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {cells.map((cell) => {
            const hasEvents = (eventDates.get(cell.iso) || []).length > 0;
            const isToday = cell.iso === todayISO;
            const isSelected = cell.iso === selectedISO;
            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => onSelectDay(cell.iso)}
                style={{
                  height: 44, borderRadius: 12, border: "none", cursor: "pointer",
                  background: isSelected ? BRAND_ACCENT : isToday ? BRAND_ACCENT_SOFT : "transparent",
                  color: isSelected ? "#fff" : cell.current ? C.text : C.mutedLight || C.muted,
                  opacity: cell.current ? 1 : 0.45,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                  fontFamily: BRAND_FONT, padding: 0,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: isToday || isSelected ? 900 : 700, lineHeight: 1 }}>{cell.day}</span>
                <span style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: hasEvents ? (isSelected ? "#fff" : BRAND_ACCENT) : "transparent",
                }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, marginBottom: 8 }}>{selectedLabel}</div>
        {selectedEvents.length === 0 ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            padding: "14px 16px", borderRadius: 16, background: "#fff", border: `1px solid ${C.border}`,
          }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: C.text, marginBottom: 2 }}>Nothing booked</div>
              <div style={{ fontSize: 12, color: C.muted }}>Free day — add a gig anytime.</div>
            </div>
            <button
              type="button"
              onClick={() => (onOpenNewEvent ? onOpenNewEvent() : setSection("events"))}
              style={{
                flexShrink: 0, background: BRAND_ACCENT, color: "#fff", border: "none",
                borderRadius: 999, padding: "10px 14px", fontWeight: 800, fontSize: 12, fontFamily: BRAND_FONT, cursor: "pointer",
              }}
            >
              + Event
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {selectedEvents.map((ev) => (
              <button
                key={ev.id || `${ev.date}-${ev.name}`}
                type="button"
                onClick={() => onOpenEventDetail?.(ev.id)}
                style={{
                  textAlign: "left", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16,
                  padding: "14px 16px", cursor: "pointer", fontFamily: BRAND_FONT,
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 800, fontSize: 14, color: C.text }}>
                    {ev.name || ev.client || "Event"}
                  </span>
                  <span style={{ display: "block", fontSize: 12, color: C.muted, marginTop: 3 }}>
                    {[ev.venue, ev.client].filter(Boolean).join(" · ") || (ev.type || ev.eventType || "Event")}
                  </span>
                </span>
                <span style={{ color: BRAND_ACCENT, fontWeight: 800, fontSize: 13, flexShrink: 0 }}>→</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PhoneAddTaskSheet({ C, events, onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [eventId, setEventId] = useState("");
  const [notes, setNotes] = useState("");
  const [kbPad, setKbPad] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const sync = () => {
      const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKbPad(covered);
    };
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    sync();
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  const fieldBg = C.surfaceAlt || "#F4F4F8";
  const labelStyle = {
    fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase",
    letterSpacing: "0.08em", marginBottom: 8, display: "block",
  };
  const inputStyle = {
    width: "100%", boxSizing: "border-box", background: fieldBg, border: "none",
    borderRadius: 14, padding: "14px 14px", color: C.text, fontSize: 15,
    fontFamily: BRAND_FONT, outline: "none", WebkitAppearance: "none", appearance: "none",
  };

  const eventOptions = (events || [])
    .filter((e) => e.date)
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const dueLabel = (() => {
    if (!dueDate) return "Tap to pick a date";
    try {
      return new Date(`${dueDate}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric", year: "numeric",
      });
    } catch {
      return dueDate;
    }
  })();

  const handleSave = () => {
    if (!title.trim()) return;
    onSave?.({
      title: title.trim(),
      notes: notes.trim(),
      priority: priority || "Normal",
      dueDate: dueDate || "",
      eventId: eventId || null,
      createdAt: new Date().toISOString(),
      completedAt: null,
      id: Date.now(),
    });
    onClose?.();
  };

  const sheet = (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 10000, background: "rgba(22,22,26,0.45)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%", maxWidth: 480, background: "#fff",
          borderRadius: "24px 24px 0 0",
          fontFamily: BRAND_FONT, boxShadow: "0 -8px 40px rgba(22,22,26,0.18)",
          maxHeight: kbPad > 0 ? `calc(100vh - ${kbPad}px)` : "92vh",
          marginBottom: kbPad, display: "flex", flexDirection: "column",
          minHeight: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 999, background: "#D4D4D8" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 20px 12px" }}>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em", color: C.text }}>Add Task</div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer",
                background: fieldBg, color: C.muted, fontSize: 18, fontWeight: 600, fontFamily: BRAND_FONT,
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 20px 12px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Due date</label>
            <div style={{
              position: "relative", background: fieldBg, borderRadius: 14,
              minHeight: 48, display: "flex", alignItems: "center", padding: "0 14px",
            }}
            >
              <span style={{
                flex: 1, fontSize: 15, fontWeight: dueDate ? 700 : 500,
                color: dueDate ? C.text : C.muted, fontFamily: BRAND_FONT, pointerEvents: "none",
              }}
              >
                {dueLabel}
              </span>
              {dueDate ? (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDueDate(""); }}
                  style={{
                    border: "none", background: "transparent", color: C.muted, fontWeight: 800,
                    fontSize: 12, cursor: "pointer", fontFamily: BRAND_FONT, padding: "6px 8px", marginRight: 4,
                  }}
                >
                  Clear
                </button>
              ) : null}
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.55 }} aria-hidden>
                <rect x="2" y="3" width="12" height="11" rx="2" stroke={C.muted} strokeWidth="1.5" />
                <path d="M2 6.5h12M5.5 2v2.5M10.5 2v2.5" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                aria-label="Due date"
                style={{
                  position: "absolute", inset: 0, opacity: 0.02, width: "100%", height: "100%",
                  border: "none", background: "transparent", cursor: "pointer", fontSize: 16,
                }}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Priority</label>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, padding: 4,
              background: fieldBg, borderRadius: 14,
            }}
            >
              {["Low", "Normal", "High"].map((p) => {
                const active = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    style={{
                      border: "none", cursor: "pointer", fontFamily: BRAND_FONT,
                      padding: "10px 8px", borderRadius: 11, fontWeight: 800, fontSize: 13,
                      background: active ? "#fff" : "transparent",
                      color: active ? C.text : C.muted,
                      boxShadow: active ? "0 1px 4px rgba(22,22,26,0.08)" : "none",
                    }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Link to event</label>
            <div style={{ position: "relative" }}>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                style={{
                  ...inputStyle,
                  paddingRight: 40,
                  appearance: "none",
                  WebkitAppearance: "none",
                  MozAppearance: "none",
                }}
              >
                <option value="">None</option>
                {eventOptions.map((ev) => (
                  <option key={ev.id} value={String(ev.id)}>
                    {ev.name || ev.client || "Event"}{ev.date ? ` · ${ev.date}` : ""}
                  </option>
                ))}
              </select>
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                style={{
                  position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                  pointerEvents: "none",
                }}
                aria-hidden
              >
                <path d="M4 6l4 4 4-4" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional details..."
              rows={3}
              style={{ ...inputStyle, resize: "none", minHeight: 88 }}
            />
          </div>
        </div>

        <div style={{
          flexShrink: 0, display: "flex", gap: 10, padding: "12px 20px",
          paddingBottom: "max(16px, env(safe-area-inset-bottom))",
          borderTop: `1px solid ${C.border}`, background: "#fff",
        }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1, padding: "14px 12px", borderRadius: 14, border: "none", cursor: "pointer",
              background: fieldBg, color: C.text, fontWeight: 800, fontSize: 15, fontFamily: BRAND_FONT,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!title.trim()}
            style={{
              flex: 1, padding: "14px 12px", borderRadius: 14, border: "none",
              cursor: title.trim() ? "pointer" : "default",
              background: title.trim() ? BRAND_ACCENT : "#C4B5FD",
              color: "#fff", fontWeight: 800, fontSize: 15, fontFamily: BRAND_FONT,
              opacity: title.trim() ? 1 : 0.7,
            }}
          >
            Add Task
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(sheet, document.body);
}

function PhoneHome({
  C, profile, events, leads, invoices, setSection, onOpenCue, onOpenEventDetail, onOpenNewEvent, onOpenNewLead,
  taskAlerts = [], onToggleTaskAlert, taskAlertColors, onSaveTask,
}) {
  const today = new Date();
  const todayISO = toISODate(today);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [selectedISO, setSelectedISO] = useState(todayISO);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const firstName = (profile?.djName || profile?.businessName || "DJ").split(/\s+/)[0];
  const hour = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = today.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();

  const upcoming = useMemo(() =>
    (events || [])
      .filter((e) => e.date && new Date(`${e.date}T00:00:00`) >= todayStart)
      .sort((a, b) => (a.date > b.date ? 1 : -1)),
  [events]); // eslint-disable-line react-hooks/exhaustive-deps

  const nextEvent = upcoming[0];
  const daysUntil = nextEvent
    ? Math.round((new Date(`${nextEvent.date}T00:00:00`) - todayStart) / 86400000)
    : null;

  const year = today.getFullYear();
  const yearEvents = (events || []).filter((e) => e.date && new Date(`${e.date}T00:00:00`).getFullYear() === year);
  const remaining = yearEvents.filter((e) => new Date(`${e.date}T00:00:00`) >= todayStart).length;
  const needCharge = (invoices || []).filter((i) => i.status === "Unpaid" || i.status === "Overdue").length;

  const ytdBooked = yearEvents.reduce((s, e) => s + (Number(e.totalFee) || 0), 0);
  const monthBooked = (events || [])
    .filter((e) => {
      if (!e.date) return false;
      const d = new Date(`${e.date}T00:00:00`);
      return d.getMonth() === today.getMonth() && d.getFullYear() === year;
    })
    .reduce((s, e) => s + (Number(e.totalFee) || 0), 0);
  const collected = (invoices || []).reduce((s, i) => s + (Number(i.paid) || 0), 0);
  const outstanding = Math.max(0, ytdBooked - collected);
  const barTotal = collected + outstanding || 1;

  const alertColors = {
    todo: "#6C4DF6",
    notifications: "#FF7A3C",
    charging: "#CA8A04",
    wardrobe: "#A056E8",
    ...(taskAlertColors || {}),
  };
  const priorityColor = (p) => {
    if (p === "High") return "#DC2626";
    if (p === "Low") return "#2563EB";
    return BRAND_ACCENT;
  };
  const kindMeta = (item) => {
    if (item.kind === "charging") return { label: "Charge", color: alertColors.charging };
    if (item.kind === "wardrobe") return { label: item.statusLabel || "Wardrobe", color: alertColors.wardrobe };
    if (item.kind === "custom" || item.kind === "todo") {
      if (item.priority) return { label: item.priority, color: priorityColor(item.priority) };
      return { label: "To-Do", color: alertColors.todo };
    }
    return { label: "Alert", color: alertColors.notifications };
  };

  const visibleTasks = showAllTasks ? taskAlerts : taskAlerts.slice(0, 5);

  const openTask = (item) => {
    if (item.eventId != null && item.kind === "notifications" && item.section === "events") {
      onOpenEventDetail?.(item.eventId);
      return;
    }
    if (item.section) setSection(item.section);
  };

  const quick = [
    { label: "New event", go: () => (onOpenNewEvent ? onOpenNewEvent() : setSection("events")), tint: BRAND_ACCENT_SOFT, ink: BRAND_ACCENT, mark: "+" },
    { label: "New lead", go: () => (onOpenNewLead ? onOpenNewLead() : setSection("leads")), tint: "#E8F4FC", ink: "#2563EB", mark: "L" },
    { label: "Send contract", go: () => setSection("templates"), tint: "#FCE7F3", ink: "#DB2777", mark: "C" },
    { label: "Build playlist", go: () => setSection("djplanning"), tint: "#E8F8EF", ink: "#2FBF6B", mark: "♪" },
    { label: "Ask assistant", go: () => onOpenCue?.(), tint: BRAND_ACCENT_SOFT, ink: BRAND_ACCENT, mark: "+" },
    { label: "New task", go: () => setShowAddTask(true), tint: "#FFF4E5", ink: "#C2410C", mark: "✓" },
  ];

  const fmtDate = (iso) => {
    if (!iso) return "TBD";
    try {
      return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    } catch {
      return iso;
    }
  };

  return (
    <div style={{ padding: "8px 16px 120px", width: "100%", boxSizing: "border-box", fontFamily: BRAND_FONT }}>
      {showAddTask && (
        <PhoneAddTaskSheet
          C={C}
          events={events}
          onClose={() => setShowAddTask(false)}
          onSave={(todo) => onSaveTask?.(todo)}
        />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <CuePointLogo size={28} showText textSize={15} />
        <button
          type="button"
          onClick={() => setSection("settings")}
          style={{
            width: 36, height: 36, borderRadius: "50%", border: "none", cursor: "pointer",
            background: BRAND_ACCENT, color: "#fff", fontWeight: 800, fontSize: 12, fontFamily: BRAND_FONT,
          }}
        >
          {(firstName || "DJ").slice(0, 2).toUpperCase()}
        </button>
      </div>

      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: C.muted, marginBottom: 4 }}>{dateLabel}</div>
      <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.03em", color: C.text, marginBottom: 2 }}>
        {greeting}, {firstName}
      </div>
      <div style={{ fontSize: 14, color: C.muted, marginBottom: 16 }}>
        {nextEvent
          ? (daysUntil === 0 ? "You have a gig today." : daysUntil === 1 ? "Next gig is tomorrow." : `Next gig in ${daysUntil} days.`)
          : "Your month at a glance."}
      </div>

      <PhoneMonthCalendar
        C={C}
        events={events}
        selectedISO={selectedISO}
        onSelectDay={setSelectedISO}
        onOpenEventDetail={onOpenEventDetail}
        onOpenNewEvent={onOpenNewEvent}
        setSection={setSection}
      />

      {nextEvent && (
        <button
          type="button"
          onClick={() => onOpenEventDetail?.(nextEvent.id)}
          style={{
            width: "100%", textAlign: "left", marginBottom: 18, cursor: "pointer",
            background: BRAND_GRADIENT, borderRadius: 20, padding: "16px 18px", border: "none",
            boxShadow: "0 10px 28px rgba(108,77,246,0.28)", color: "#fff", fontFamily: BRAND_FONT,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", background: "rgba(0,0,0,0.22)", padding: "5px 10px", borderRadius: 999 }}>
              {daysUntil === 0 ? "TODAY" : daysUntil === 1 ? "IN 1 DAY" : `IN ${daysUntil} DAYS`}
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.9 }}>Up next →</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 4, lineHeight: 1.2 }}>
            {nextEvent.name || nextEvent.client || "Upcoming event"}
          </div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>
            {fmtDate(nextEvent.date)}
            {[nextEvent.venue, nextEvent.client].filter(Boolean).length
              ? ` · ${[nextEvent.venue, nextEvent.client].filter(Boolean).join(" · ")}`
              : ""}
          </div>
        </button>
      )}

      <div style={{
        display: "flex", gap: 0, marginBottom: 22, borderRadius: 16, overflow: "hidden",
        background: "#fff", border: `1px solid ${C.border}`,
      }}
      >
        {[
          [yearEvents.length, "Events"],
          [remaining, "Left"],
          [needCharge, "To charge"],
        ].map(([v, l], i) => (
          <div
            key={l}
            style={{
              flex: 1, padding: "12px 8px", textAlign: "center",
              borderLeft: i > 0 ? `1px solid ${C.border}` : "none",
            }}
          >
            <div style={{
              fontSize: 18, fontWeight: 900, letterSpacing: "-0.03em",
              color: l === "To charge" && needCharge > 0 ? C.orange : C.text,
            }}
            >{v}</div>
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, marginTop: 2, letterSpacing: "0.04em", textTransform: "uppercase" }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: C.muted }}>TASKS & ALERTS</div>
        {taskAlerts.length > 0 && (
          <div style={{ fontSize: 11, fontWeight: 800, color: BRAND_ACCENT }}>{taskAlerts.length} open</div>
        )}
      </div>
      {taskAlerts.length === 0 ? (
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 22, padding: "2px 2px 0" }}>Nothing needs attention.</div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 18, border: `1px solid ${C.border}`, marginBottom: 22, overflow: "hidden" }}>
          {visibleTasks.map((row, i) => {
            const meta = kindMeta(row);
            return (
              <div
                key={row.id}
                style={{
                  padding: "14px 16px",
                  borderBottom: i < visibleTasks.length - 1 || (!showAllTasks && taskAlerts.length > 5)
                    ? `1px solid ${C.border}` : "none",
                  display: "flex", gap: 12, alignItems: "flex-start",
                }}
              >
                <button
                  type="button"
                  aria-label="Mark done"
                  onClick={(e) => { e.stopPropagation(); onToggleTaskAlert?.(row); }}
                  style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
                    border: `2px solid ${C.border}`, background: "transparent", cursor: "pointer", padding: 0,
                  }}
                />
                <button
                  type="button"
                  onClick={() => openTask(row)}
                  style={{
                    flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none",
                    cursor: "pointer", padding: 0, fontFamily: BRAND_FONT,
                  }}
                >
                  <span style={{ display: "block", fontWeight: 800, fontSize: 14, color: C.text }}>{row.label}</span>
                  {row.sub ? (
                    <span style={{ display: "block", fontSize: 12, color: C.muted, marginTop: 3 }}>{row.sub}</span>
                  ) : null}
                </button>
                <span style={{
                  fontSize: 10, fontWeight: 800, borderRadius: 999, padding: "4px 8px", flexShrink: 0,
                  background: `${meta.color}22`, color: meta.color,
                }}>{meta.label}</span>
              </div>
            );
          })}
          {!showAllTasks && taskAlerts.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAllTasks(true)}
              style={{
                width: "100%", padding: "12px 16px", background: "none", border: "none",
                color: BRAND_ACCENT, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: BRAND_FONT,
              }}
            >
              Show all {taskAlerts.length} →
            </button>
          )}
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: C.muted, marginBottom: 10 }}>QUICK ACTIONS</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 22 }}>
        {quick.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={q.go}
            style={{
              background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: "14px 10px",
              textAlign: "left", cursor: "pointer", fontFamily: BRAND_FONT,
            }}
          >
            <span style={{
              width: 32, height: 32, borderRadius: 10, background: q.tint, color: q.ink,
              display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 900, marginBottom: 8, fontSize: 15,
            }}>{q.mark}</span>
            <span style={{ display: "block", fontWeight: 800, fontSize: 12, color: C.text, lineHeight: 1.25 }}>{q.label}</span>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: C.muted, marginBottom: 10 }}>REVENUE SNAPSHOT</div>
      <div style={{ background: "#fff", borderRadius: 18, border: `1px solid ${C.border}`, padding: 16, marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>Booked this year</div>
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em" }}>{money(ytdBooked)}</div>
          </div>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>Month {money(monthBooked)}</div>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: C.surfaceAlt || "#F1F1F6", overflow: "hidden", display: "flex" }}>
          <div style={{ width: `${(collected / barTotal) * 100}%`, background: C.green }} />
          <div style={{ width: `${(outstanding / barTotal) * 100}%`, background: C.orange }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, fontWeight: 700 }}>
          <span style={{ color: C.green }}>Collected {money(collected)}</span>
          <span style={{ color: C.orange }}>Out {money(outstanding)}</span>
        </div>
      </div>
    </div>
  );
}

function PhoneEvents({
  C, events, invoices, leads, onOpenEventDetail, onOpenNewEvent, setSection,
}) {
  const [tab, setTab] = useState("Upcoming");
  const todayStr = toISODate(new Date());

  const hasBalanceDue = (ev) => {
    const fee = Number(ev.totalFee) || 0;
    if (fee <= 0) return false;
    const paid = eventPaidTotals(ev, invoices).totalPaid || 0;
    return fee - paid > 0.5;
  };

  const lists = useMemo(() => {
    const all = events || [];
    const upcoming = all
      .filter((ev) => {
        if (ev.status === "Lead" || ev.status === "Cancelled") return false;
        return !ev.date || ev.date >= todayStr;
      })
      .sort((a, b) => String(a.date || "9999").localeCompare(String(b.date || "9999")));

    const leadEvents = all
      .filter((ev) => ev.status === "Lead")
      .sort((a, b) => String(a.date || "9999").localeCompare(String(b.date || "9999")));

    const leadRows = (leads || [])
      .filter((l) => l.stage !== "Booked" && l.stage !== "Lost")
      .map((l) => ({
        id: `lead-${l.id}`,
        isLead: true,
        name: l.name || l.client || "Lead",
        date: l.eventDate || l.date || "",
        venue: l.venue || l.event || l.eventType || "",
        city: l.city || "",
        type: l.eventType || l.event || "Lead",
        status: l.stage || "Lead",
      }));

    const leadsCombined = [...leadEvents, ...leadRows].sort((a, b) =>
      String(a.date || "9999").localeCompare(String(b.date || "9999"))
    );

    const past = all
      .filter((ev) => ev.date && ev.date < todayStr && ev.status !== "Lead")
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));

    return { Upcoming: upcoming, Leads: leadsCombined, Past: past };
  }, [events, leads, todayStr]);

  const rows = lists[tab] || [];

  const dateParts = (iso) => {
    if (!iso) return { mon: "TBD", day: "—" };
    try {
      const d = new Date(`${iso}T00:00:00`);
      return {
        mon: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
        day: String(d.getDate()),
      };
    } catch {
      return { mon: "TBD", day: "—" };
    }
  };

  const typeTint = (type) => {
    const t = String(type || "").toLowerCase();
    if (t.includes("wedding")) return { bg: "#FEE2E2", fg: "#DC2626" };
    if (t.includes("corporate")) return { bg: BRAND_ACCENT_SOFT, fg: BRAND_ACCENT };
    if (t.includes("birthday") || t.includes("party")) return { bg: "#FFEDD5", fg: "#C2410C" };
    return { bg: "#F3F4F6", fg: "#6B7280" };
  };

  return (
    <div style={{ padding: "8px 16px 120px", width: "100%", boxSizing: "border-box", fontFamily: BRAND_FONT }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, letterSpacing: "-0.04em", color: C.text }}>Events</h1>
        <button
          type="button"
          aria-label="New event"
          onClick={() => (onOpenNewEvent ? onOpenNewEvent() : setSection("events"))}
          style={{
            width: 40, height: 40, borderRadius: "50%", border: "none", cursor: "pointer",
            background: BRAND_ACCENT, color: "#fff", fontSize: 24, fontWeight: 300, lineHeight: 1,
            display: "flex", alignItems: "center", justifyContent: "center", fontFamily: BRAND_FONT,
            boxShadow: "0 6px 16px rgba(108,77,246,0.28)",
          }}
        >
          +
        </button>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, padding: 4, marginBottom: 16,
        background: "#ECECF2", borderRadius: 14,
      }}
      >
        {["Upcoming", "Leads", "Past"].map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                border: "none", cursor: "pointer", fontFamily: BRAND_FONT, fontWeight: 800, fontSize: 13,
                padding: "10px 8px", borderRadius: 11,
                background: active ? "#fff" : "transparent",
                color: active ? C.text : C.muted,
                boxShadow: active ? "0 1px 3px rgba(22,22,26,0.08)" : "none",
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.length === 0 ? (
          <div style={{
            padding: "28px 18px", textAlign: "center", background: "#fff",
            borderRadius: 18, border: `1px solid ${C.border}`,
          }}
          >
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6, color: C.text }}>
              {tab === "Upcoming" ? "No upcoming events" : tab === "Leads" ? "No leads yet" : "No past events"}
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
              {tab === "Leads" ? "New inquiries will show up here." : "Add a gig to fill this list."}
            </div>
            {tab !== "Past" && (
              <button
                type="button"
                onClick={() => (tab === "Leads" ? setSection("leads") : (onOpenNewEvent ? onOpenNewEvent() : setSection("events")))}
                style={{
                  background: BRAND_ACCENT, color: "#fff", border: "none", borderRadius: 999,
                  padding: "10px 16px", fontWeight: 800, fontFamily: BRAND_FONT, cursor: "pointer",
                }}
              >
                {tab === "Leads" ? "Open leads" : "+ New event"}
              </button>
            )}
          </div>
        ) : rows.map((ev) => {
          const { mon, day } = dateParts(ev.date);
          const tint = typeTint(ev.type || ev.eventType);
          const balance = !ev.isLead && hasBalanceDue(ev);
          const place = [ev.venue, ev.city || ev.location].filter(Boolean).join(" · ");
          return (
            <button
              key={ev.id}
              type="button"
              onClick={() => {
                if (ev.isLead) setSection("leads");
                else onOpenEventDetail?.(ev.id);
              }}
              style={{
                display: "flex", gap: 14, alignItems: "stretch", textAlign: "left",
                background: "#fff", border: `1px solid ${C.border}`, borderRadius: 18,
                padding: "14px 14px 14px 12px", cursor: "pointer", fontFamily: BRAND_FONT,
                boxShadow: "0 2px 8px rgba(22,22,26,0.04)",
              }}
            >
              <div style={{
                width: 48, borderRadius: 12, background: "#FEE2E2", color: "#DC2626",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                flexShrink: 0, padding: "8px 4px",
              }}
              >
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em" }}>{mon}</span>
                <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.1 }}>{day}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 16, color: C.text, letterSpacing: "-0.02em", marginBottom: 4 }}>
                  {ev.name || ev.client || "Event"}
                </div>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {place || (ev.isLead ? "Lead inquiry" : "Venue TBD")}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(ev.type || ev.eventType) && (
                    <span style={{
                      fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase",
                      padding: "4px 8px", borderRadius: 8, background: tint.bg, color: tint.fg,
                    }}
                    >
                      {ev.type || ev.eventType}
                    </span>
                  )}
                  {balance && (
                    <span style={{
                      fontSize: 10, fontWeight: 800, letterSpacing: "0.02em",
                      padding: "4px 8px", borderRadius: 8, background: "#FFEDD5", color: "#C2410C",
                    }}
                    >
                      Balance due
                    </span>
                  )}
                  {ev.isLead && (
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: "4px 8px", borderRadius: 8,
                      background: BRAND_ACCENT_SOFT, color: BRAND_ACCENT,
                    }}
                    >
                      {ev.status || "Lead"}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function invAmount(inv) {
  if (inv?.lineItems?.length) {
    return inv.lineItems.reduce((s, li) => s + (Number(li.qty) || 1) * (Number(li.rate) || 0), 0);
  }
  return Number(inv?.amount) || 0;
}

function moneyFmt(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString()}`;
}

function PhoneMoney({ C, invoices, events, onOpenFullFinancials, onOpenEventDetail }) {
  const [filter, setFilter] = useState("All");
  const year = new Date().getFullYear();
  const list = invoices || [];

  const yearEvents = (events || []).filter((e) => {
    if (!e.date) return false;
    return new Date(e.date + "T00:00:00").getFullYear() === year;
  });
  const booked = yearEvents.reduce((a, e) => a + (Number(e.totalFee) || 0), 0);
  const collected = list.reduce((s, inv) => {
    const y = new Date(inv.issued || inv.eventDate || inv.paidDate || "").getFullYear();
    if (!isNaN(y) && y !== year) return s;
    return s + invoicePaidAmount(inv);
  }, 0);
  const outstanding = Math.max(0, booked - collected);

  const unpaidStatuses = new Set(["Unpaid", "Partial", "Deposit Paid", "Overdue", "Draft"]);
  const rows = list.filter((inv) => {
    if (filter === "Unpaid") return unpaidStatuses.has(inv.status) || (invAmount(inv) - invoicePaidAmount(inv) > 0.5 && inv.status !== "Paid");
    if (filter === "Paid") return inv.status === "Paid";
    return true;
  }).slice().sort((a, b) => String(b.due || b.issued || "").localeCompare(String(a.due || a.issued || "")));

  const statusColor = {
    Paid: C.green, "Deposit Paid": C.purple || BRAND_ACCENT, Partial: C.yellow || "#CA8A04",
    Unpaid: C.red || "#EF4444", Draft: C.muted, Overdue: "#EF4444",
  };

  return (
    <div style={{ padding: "12px 16px 120px", width: "100%", boxSizing: "border-box", fontFamily: BRAND_FONT }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, letterSpacing: "-0.04em", color: C.text }}>Money</h1>
          <div style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>{year} · invoices & collections</div>
        </div>
        <button
          type="button"
          onClick={onOpenFullFinancials}
          style={{
            background: BRAND_ACCENT, color: "#fff", border: "none", borderRadius: 999,
            padding: "10px 14px", fontWeight: 800, fontSize: 13, fontFamily: BRAND_FONT, cursor: "pointer", flexShrink: 0,
          }}
        >
          + Invoice
        </button>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, marginBottom: 18,
        background: "#fff", borderRadius: 18, border: `1px solid ${C.border}`, overflow: "hidden",
      }}>
        {[
          [moneyFmt(booked), "Booked", C.text],
          [moneyFmt(collected), "Collected", C.green],
          [moneyFmt(outstanding), "Out", outstanding > 0 ? C.orange : C.muted],
        ].map(([v, l, color], i) => (
          <div key={l} style={{ padding: "14px 8px", textAlign: "center", borderLeft: i ? `1px solid ${C.border}` : "none" }}>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-0.03em", color }}>{v}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginTop: 3, textTransform: "uppercase", letterSpacing: "0.04em" }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {["All", "Unpaid", "Paid"].map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                flex: 1, padding: "10px 8px", borderRadius: 12, cursor: "pointer", fontFamily: BRAND_FONT,
                border: `1px solid ${active ? BRAND_ACCENT : C.border}`,
                background: active ? BRAND_ACCENT_SOFT : "#fff",
                color: active ? BRAND_ACCENT : C.muted,
                fontWeight: 800, fontSize: 13,
              }}
            >
              {f}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.length === 0 ? (
          <div style={{
            padding: "28px 18px", textAlign: "center", background: "#fff",
            borderRadius: 18, border: `1px solid ${C.border}`,
          }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6, color: C.text }}>
              {filter === "Unpaid" ? "Nothing unpaid" : filter === "Paid" ? "No paid invoices yet" : "No invoices yet"}
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
              Create an invoice from Financials when you are ready to bill.
            </div>
            <button
              type="button"
              onClick={onOpenFullFinancials}
              style={{
                background: BRAND_ACCENT, color: "#fff", border: "none", borderRadius: 999,
                padding: "10px 16px", fontWeight: 800, fontFamily: BRAND_FONT, cursor: "pointer",
              }}
            >
              Open Financials
            </button>
          </div>
        ) : rows.map((inv) => {
          const total = invAmount(inv);
          const paid = invoicePaidAmount(inv);
          const due = Math.max(0, total - paid);
          const sc = statusColor[inv.status] || C.muted;
          return (
            <button
              key={inv.id}
              type="button"
              onClick={() => {
                if (inv.eventId != null && onOpenEventDetail) onOpenEventDetail(inv.eventId);
                else onOpenFullFinancials?.();
              }}
              style={{
                display: "flex", gap: 12, alignItems: "center", textAlign: "left",
                background: "#fff", border: `1px solid ${C.border}`, borderRadius: 18,
                padding: "14px 14px", cursor: "pointer", fontFamily: BRAND_FONT,
                boxShadow: "0 2px 8px rgba(22,22,26,0.04)",
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: `${sc}18`, color: sc,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: 13,
              }}>
                $
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 15, color: C.text, letterSpacing: "-0.02em" }}>
                  {inv.client || "Client"}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {inv.event || inv.id}{inv.due ? ` · Due ${inv.due}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 15, color: C.text }}>{moneyFmt(total)}</div>
                <div style={{
                  fontSize: 10, fontWeight: 800, marginTop: 4, color: sc,
                  background: `${sc}18`, padding: "3px 8px", borderRadius: 8, display: "inline-block",
                }}>
                  {inv.status || "—"}{due > 0.5 && inv.status !== "Paid" ? ` · ${moneyFmt(due)}` : ""}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onOpenFullFinancials}
        style={{
          width: "100%", marginTop: 16, background: "#fff", border: `1px solid ${C.border}`,
          borderRadius: 16, padding: "14px", fontWeight: 800, color: BRAND_ACCENT,
          fontFamily: BRAND_FONT, cursor: "pointer", fontSize: 14,
        }}
      >
        Expenses · Payroll · Reports →
      </button>
    </div>
  );
}

function PhoneClients({ C, clients, events, onOpenFull }) {
  const [q, setQ] = useState("");
  const filtered = (clients || []).filter((c) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase().trim();
    const name = (c.name || `${c.firstName || ""} ${c.lastName || ""}`).toLowerCase();
    return name.includes(needle)
      || (c.business || "").toLowerCase().includes(needle)
      || (c.email || "").toLowerCase().includes(needle);
  });

  const eventCount = (c) => (events || []).filter((e) => {
    if (c.id != null && e.clientId != null && String(e.clientId) === String(c.id)) return true;
    return c.name && e.client && e.client === c.name;
  }).length;

  return (
    <div style={{ padding: "4px 4px 24px", width: "100%", boxSizing: "border-box", fontFamily: BRAND_FONT }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.03em", color: C.text }}>Clients</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{(clients || []).length} total</div>
        </div>
        <button
          type="button"
          onClick={onOpenFull}
          style={{
            background: BRAND_ACCENT, color: "#fff", border: "none", borderRadius: 999,
            padding: "9px 14px", fontWeight: 800, fontSize: 13, fontFamily: BRAND_FONT, cursor: "pointer",
          }}
        >
          + Add
        </button>
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search clients..."
        style={{
          width: "100%", boxSizing: "border-box", marginBottom: 14,
          background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14,
          padding: "12px 14px", fontSize: 15, fontFamily: BRAND_FONT, color: C.text, outline: "none",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: "28px 18px", textAlign: "center", background: "#fff",
            borderRadius: 18, border: `1px solid ${C.border}`,
          }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6, color: C.text }}>
              {(clients || []).length === 0 ? "No clients yet" : "No matches"}
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
              {(clients || []).length === 0
                ? "Add a client to link events, contracts, and invoices."
                : "Try a different name or organization."}
            </div>
            <button
              type="button"
              onClick={onOpenFull}
              style={{
                background: BRAND_ACCENT, color: "#fff", border: "none", borderRadius: 999,
                padding: "10px 16px", fontWeight: 800, fontFamily: BRAND_FONT, cursor: "pointer",
              }}
            >
              {(clients || []).length === 0 ? "+ Add client" : "Open full list"}
            </button>
          </div>
        ) : filtered.map((c) => {
          const name = c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim() || "Client";
          const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
          const n = eventCount(c);
          return (
            <button
              key={c.id || name}
              type="button"
              onClick={onOpenFull}
              style={{
                display: "flex", gap: 12, alignItems: "center", textAlign: "left",
                background: "#fff", border: `1px solid ${C.border}`, borderRadius: 18,
                padding: "14px", cursor: "pointer", fontFamily: BRAND_FONT,
                boxShadow: "0 2px 8px rgba(22,22,26,0.04)",
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                background: BRAND_ACCENT, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 14,
              }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 15, color: C.text }}>{name}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.business || c.email || c.role || "No contact info"}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: BRAND_ACCENT }}>{n}</div>
                <div style={{ fontSize: 10, color: C.muted, fontWeight: 700 }}>{n === 1 ? "event" : "events"}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PhoneMore({ C, setSection, onSignOut }) {
  const groups = {};
  PHONE_MORE_ITEMS.forEach((item) => {
    if (!groups[item.group]) groups[item.group] = [];
    groups[item.group].push(item);
  });

  return (
    <div style={{ padding: "12px 0 120px", width: "100%", boxSizing: "border-box", fontFamily: BRAND_FONT }}>
      <div style={{ padding: "0 16px", marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, letterSpacing: "-0.04em", color: C.text }}>More</h1>
        <div style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>Everything else in your CuePoint toolkit.</div>
      </div>
      {Object.entries(groups).map(([group, items]) => (
        <div key={group} style={{ marginBottom: 22 }}>
          <div style={{
            fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: C.muted,
            marginBottom: 8, padding: "0 16px",
          }}
          >
            {group.toUpperCase()}
          </div>
          <div style={{
            background: "#fff",
            borderTop: `1px solid ${C.border}`,
            borderBottom: `1px solid ${C.border}`,
            overflow: "hidden",
            width: "100%",
          }}
          >
            {items.map((item, i) => (
              <button
                key={`${item.section}-${item.label}`}
                type="button"
                onClick={() => setSection(item.section)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px", background: "#fff", border: "none", cursor: "pointer",
                  borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : "none",
                  fontFamily: BRAND_FONT, textAlign: "left", boxSizing: "border-box",
                }}
              >
                <span style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: item.tint || BRAND_ACCENT_SOFT, color: item.ink || BRAND_ACCENT,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 900, fontSize: 14,
                }}
                >
                  {item.label.slice(0, 1)}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 800, fontSize: 15, color: C.text }}>{item.label}</span>
                  {item.blurb && (
                    <span style={{ display: "block", fontSize: 12, color: C.muted, marginTop: 2 }}>{item.blurb}</span>
                  )}
                </span>
                <span style={{ color: C.muted, fontSize: 18, flexShrink: 0 }}>›</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div style={{ padding: "0 16px" }}>
        <button
          type="button"
          onClick={onSignOut}
          style={{
            width: "100%", marginTop: 4, background: "#fff", border: `1px solid ${C.border}`,
            borderRadius: 16, padding: "14px", fontWeight: 800, color: C.muted, fontFamily: BRAND_FONT, cursor: "pointer",
          }}
        >
          Sign out
        </button>
        <div style={{ textAlign: "center", fontSize: 12, color: C.muted, marginTop: 18 }}>
          CuePoint Planning — DJ Platform
        </div>
      </div>
    </div>
  );
}

/**
 * Full phone chrome. When a bottom-tab section is active, renders children (desktop section UI).
 * Home / More are phone-native screens.
 */
export function PhoneApp({
  C,
  section,
  setSection,
  profile,
  events,
  leads,
  invoices,
  clients,
  taskAlerts,
  taskAlertColors,
  onToggleTaskAlert,
  onSaveTask,
  onOpenCue,
  onOpenEventDetail,
  onOpenNewEvent,
  onOpenNewLead,
  onSignOut,
  children,
}) {
  const tabFromSection = (sec) => {
    if (!sec || sec === "dashboard") return "home";
    if (sec === "events") return "events";
    if (sec === "financials" || sec === "pricing") return "money";
    return "more";
  };

  const [tab, setTab] = useState(() => tabFromSection(section));
  const [eventDrill, setEventDrill] = useState(false);
  const [moneyDrill, setMoneyDrill] = useState(false);
  const [clientsDrill, setClientsDrill] = useState(false);

  useEffect(() => {
    // Keep More hub visible when section is dashboard after tapping More
    if (tab === "more" && (!section || section === "dashboard")) return;
    setTab(tabFromSection(section));
  }, [section]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab !== "events") setEventDrill(false);
  }, [tab]);

  useEffect(() => {
    const onIdle = () => setEventDrill(false);
    window.addEventListener("cuepoint:phone-events-idle", onIdle);
    return () => window.removeEventListener("cuepoint:phone-events-idle", onIdle);
  }, []);

  useEffect(() => {
    if (tab !== "money") setMoneyDrill(false);
    if (section === "pricing") setMoneyDrill(true);
  }, [tab, section]);

  useEffect(() => {
    if (section !== "clients") setClientsDrill(false);
  }, [section]);

  const showHome = tab === "home";
  const inMoreDetail = tab === "more" && section && section !== "dashboard"
    && !["events", "financials"].includes(section);
  const showMoneyHub = tab === "money" && section !== "pricing" && !moneyDrill;
  const showClientsHub = inMoreDetail && section === "clients" && !clientsDrill;
  // Events list is always PhoneEvents; detail/create mount as overlays via eventDrill
  const showSectionChrome = (tab === "money" && !showMoneyHub)
    || (inMoreDetail && !showClientsHub)
    || (tab === "events" && eventDrill);

  const onTab = (id) => {
    if (id === "cue") {
      onOpenCue?.();
      return;
    }
    setTab(id);
    const meta = TABS.find((t) => t.id === id);
    if (id === "home") setSection("dashboard");
    else if (id === "more") setSection("dashboard");
    else if (meta?.section) {
      if (id === "money") setMoneyDrill(false);
      setSection(meta.section);
    }
  };

  const openEventFromPhone = (id) => {
    setEventDrill(true);
    onOpenEventDetail?.(id);
  };

  const openNewEventFromPhone = () => {
    setEventDrill(true);
    onOpenNewEvent?.();
  };

  return (
    <div
      className="cuepoint-phone-shell"
      style={{
        display: "flex", flexDirection: "column", height: "100%", minHeight: "100vh",
        width: "100%", maxWidth: "100vw", overflowX: "hidden", boxSizing: "border-box",
        background: C.bg, fontFamily: BRAND_FONT,
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <style>{`
        .cuepoint-phone-shell, .cuepoint-phone-shell * { box-sizing: border-box; }
        .cuepoint-phone-section {
          width: 100% !important;
          max-width: 100% !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
        }
        .cuepoint-phone-section > div,
        .cuepoint-phone-section > section,
        .cuepoint-phone-section > main {
          width: 100% !important;
          max-width: 100% !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
        }
        .cuepoint-phone-section table {
          display: block;
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .cuepoint-phone-section h2 {
          font-size: 22px !important;
          letter-spacing: -0.03em !important;
        }
        .cuepoint-phone-fin-kpis {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 10px !important;
        }
      `}</style>
      <div style={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch", width: "100%" }}>
        {showHome && (
          <PhoneHome
            C={C}
            profile={profile}
            events={events}
            leads={leads}
            invoices={invoices}
            taskAlerts={taskAlerts}
            taskAlertColors={taskAlertColors}
            onToggleTaskAlert={onToggleTaskAlert}
            onSaveTask={onSaveTask}
            setSection={(s) => { setTab(tabFromSection(s)); setSection(s); }}
            onOpenCue={onOpenCue}
            onOpenEventDetail={openEventFromPhone}
            onOpenNewEvent={openNewEventFromPhone}
            onOpenNewLead={onOpenNewLead}
          />
        )}
        {tab === "events" && (
          <PhoneEvents
            C={C}
            events={events}
            invoices={invoices}
            leads={leads}
            setSection={(s) => { setTab(tabFromSection(s)); setSection(s); }}
            onOpenEventDetail={openEventFromPhone}
            onOpenNewEvent={openNewEventFromPhone}
          />
        )}
        {showMoneyHub && (
          <PhoneMoney
            C={C}
            invoices={invoices}
            events={events}
            onOpenFullFinancials={() => { setMoneyDrill(true); setSection("financials"); }}
            onOpenEventDetail={openEventFromPhone}
          />
        )}
        {tab === "more" && !inMoreDetail && (
          <PhoneMore C={C} setSection={(s) => { setTab("more"); setSection(s); }} onSignOut={onSignOut} />
        )}
        {showClientsHub && (
          <div style={{ padding: "8px 12px 100px", width: "100%" }}>
            <button
              type="button"
              onClick={() => { setTab("more"); setSection("dashboard"); }}
              style={{
                background: "none", border: "none", color: BRAND_ACCENT, fontWeight: 800,
                fontSize: 14, marginBottom: 10, cursor: "pointer", fontFamily: BRAND_FONT, padding: 0,
              }}
            >
              ← More
            </button>
            <PhoneClients
              C={C}
              clients={clients}
              events={events}
              onOpenFull={() => setClientsDrill(true)}
            />
          </div>
        )}
        {showSectionChrome && (
          <div
            className="cuepoint-phone-section"
            style={{
              ...(tab === "events" && eventDrill
                ? { padding: 0, width: "100%" }
                : { padding: "8px 0 100px", width: "100%" }),
            }}
          >
            {tab === "money" && moneyDrill && (
              <button
                type="button"
                onClick={() => { setMoneyDrill(false); setSection("financials"); }}
                style={{
                  background: "none", border: "none", color: BRAND_ACCENT, fontWeight: 800,
                  fontSize: 14, marginBottom: 10, cursor: "pointer", fontFamily: BRAND_FONT, padding: "0 16px",
                }}
              >
                ← Money
              </button>
            )}
            {inMoreDetail && (
              <button
                type="button"
                onClick={() => {
                  if (section === "clients" && clientsDrill) {
                    setClientsDrill(false);
                    return;
                  }
                  setTab("more");
                  setSection("dashboard");
                }}
                style={{
                  background: "none", border: "none", color: BRAND_ACCENT, fontWeight: 800,
                  fontSize: 14, marginBottom: 10, cursor: "pointer", fontFamily: BRAND_FONT, padding: "0 16px",
                }}
              >
                {section === "clients" && clientsDrill ? "← Clients" : "← More"}
              </button>
            )}
            <div style={{ width: "100%", padding: tab === "events" && eventDrill ? 0 : "0 12px" }}>
              {children}
            </div>
          </div>
        )}
      </div>

      {/* Bottom tabs — Home · Events · CUE · Money · More */}
      <nav style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 70,
        background: "rgba(251,251,253,0.96)", backdropFilter: "blur(12px)",
        borderTop: `1px solid ${C.border}`,
        paddingBottom: "env(safe-area-inset-bottom)",
        display: "grid", gridTemplateColumns: "1fr 1fr 72px 1fr 1fr",
        alignItems: "end",
        minHeight: 64,
      }}
      >
        {TABS.map((t) => {
          if (t.center) {
            return (
              <div key={t.id} style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", paddingBottom: 6 }}>
                <button
                  type="button"
                  onClick={() => onTab("cue")}
                  aria-label="Open CUE Assistant"
                  style={{
                    width: 58, height: 58, marginTop: -22, borderRadius: "50%", border: "3px solid #FBFBFD",
                    cursor: "pointer", background: BRAND_GRADIENT, color: "#fff",
                    boxShadow: "0 10px 24px rgba(108,77,246,0.4)",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    fontFamily: BRAND_FONT, padding: 0,
                  }}
                >
                  <span style={{ fontSize: 22, fontWeight: 300, lineHeight: 1, marginTop: -2 }}>+</span>
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", marginTop: 1 }}>CUE</span>
                </button>
              </div>
            );
          }
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              style={{
                background: "none", border: "none", padding: "10px 4px 8px", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontFamily: BRAND_FONT,
              }}
            >
              <TabIcon id={t.id} active={active} color={BRAND_ACCENT} />
              <span style={{ fontSize: 10, fontWeight: 800, color: active ? BRAND_ACCENT : "#8E8E93" }}>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export function useIsPhoneViewport(breakpoint = 768) {
  const [isPhone, setIsPhone] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const onResize = () => setIsPhone(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isPhone;
}
