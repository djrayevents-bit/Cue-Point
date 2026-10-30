/**
 * CuePoint phone shell — bottom tabs matching the iOS mockups.
 * No Billing & Plan entry. Automations opens the shared empty-first page.
 */
import { Component, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import CuePointLogo from "./CuePointLogo";
import PhoneScheduling from "./PhoneScheduling";

class PhoneHubBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "28px 20px", color: "#16161A", fontFamily: "-apple-system, system-ui, sans-serif" }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>This screen crashed</div>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#F3F4F6", borderRadius: 12, padding: 12, fontSize: 11, color: "#B91C1C" }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
import { BRAND_ACCENT, BRAND_ACCENT_SOFT, BRAND_FONT, BRAND_GRADIENT } from "../brand";
import { eventPaidTotals } from "../eventMoney";
import {
  NOTIF_CATALOG,
  attachLogTimestamps,
  buildPhoneNotifications,
  formatNotifWhen,
  groupNotifsTodayEarlier,
  isNotifRead,
  loadPhoneNotifRead,
  markAllNotifsRead,
  mergeNotificationLog,
  savePhoneNotifRead,
} from "../phoneNotifications";

const TABS = [
  { id: "home", label: "Home", section: null },
  { id: "events", label: "Events", section: "events" },
  { id: "cue", label: "CUE", section: null, center: true },
  { id: "notifications", label: "Alerts", section: null },
  { id: "more", label: "More", section: null },
];

/** More menu — matches iOS mock: Clients · Templates · Money · Operations · Settings */
export const PHONE_MORE_ITEMS = [
  { label: "Clients", blurb: "Everyone you have booked", section: "clients", group: "Clients", tint: "#DBEAFE", ink: "#2563EB", mark: "👤" },
  { label: "Scheduling", blurb: "Share a booking link", section: "meetings", group: "Clients", tint: "#EDE9FE", ink: "#6C4DF6", mark: "📅" },
  { label: "Quick Texts", blurb: "Saved replies", section: "quicktexts", group: "Clients", tint: "#EDE9FE", ink: "#6C4DF6", mark: "💬" },
  { label: "Automations", blurb: "Follow-ups that send themselves", section: "automations", group: "Clients", tint: "#EDE9FE", ink: "#6C4DF6", mark: "⚡" },
  { label: "Templates", blurb: "Run sheets, quotes & replies", section: "templates", group: "Templates", tint: "#FFEDD5", ink: "#C2410C", mark: "📄" },
  { label: "Contracts", blurb: "Build & send agreements", section: "templates", group: "Templates", tint: "#DCFCE7", ink: "#16A34A", mark: "📝" },
  { label: "Rentals", blurb: "Gear invoices & contracts", section: "rentals", group: "Events", tint: "#DBEAFE", ink: "#2563EB", mark: "💵" },
  { label: "Pricing and Packaging", blurb: "Packages & add-ons", section: "pricing", group: "Money", tint: "#FFEDD5", ink: "#C2410C", mark: "🏷" },
  { label: "Financials", blurb: "Invoices, expenses & P&L", section: "financials", group: "Money", tint: "#DCFCE7", ink: "#16A34A", mark: "📊" },
  { label: "Venues", blurb: "Saved locations", section: "venues", group: "Operations", tint: "#FFEDD5", ink: "#C2410C", mark: "📍" },
  { label: "Equipment", blurb: "Inventory and NFC tags", section: "equipment", group: "Operations", tint: "#DBEAFE", ink: "#2563EB", mark: "📦" },
  { label: "Wardrobe", blurb: "Outfits per event", section: "wardrobe", group: "Operations", tint: "#EDE9FE", ink: "#6C4DF6", mark: "👗" },
  { label: "Staff", blurb: "MCs, dancers, ops", section: "staff", group: "Operations", tint: "#DCFCE7", ink: "#16A34A", mark: "👥" },
  { label: "Settings", blurb: "Account, profile & billing", section: "settings", group: "Settings", tint: "#F3F4F6", ink: "#4B5563", mark: "⚙️" },
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
  if (id === "notifications") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M6 9a6 6 0 1112 0c0 3.5 1.5 5 2 6H4c.5-1 2-2.5 2-6z" stroke={c} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M10 19a2 2 0 004 0" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
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
function PhoneMonthCalendar({ C, events, meetings = [], selectedISO, onSelectDay, onOpenEventDetail, onOpenNewEvent, setSection }) {
  const today = new Date();
  const todayISO = toISODate(today);
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleString("en-US", { month: "long", year: "numeric" });

  const eventDates = useMemo(() => {
    const map = new Map();
    const add = (key, item) => {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    };
    (events || []).forEach((ev) => {
      if (!ev?.date) return;
      add(String(ev.date).slice(0, 10), ev);
    });
    (meetings || []).forEach((m) => {
      if (!m?.date || m.status === "cancelled") return;
      add(String(m.date).slice(0, 10), {
        id: `meeting-${m.id}`,
        kind: "meeting",
        name: m.meetingTypeTitle || m.title || "Meeting",
        client: m.clientName || "",
        venue: m.meetLink ? "Google Meet" : "Meeting",
        startTime: m.startTime,
      });
    });
    return map;
  }, [events, meetings]);

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
                onClick={() => (ev.kind === "meeting" ? setSection("meetings") : onOpenEventDetail?.(ev.id))}
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
                    {ev.kind === "meeting"
                      ? [ev.startTime, ev.client, ev.venue].filter(Boolean).join(" · ")
                      : ([ev.venue, ev.client].filter(Boolean).join(" · ") || (ev.type || ev.eventType || "Event"))}
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
  C, profile, events, meetings = [], leads, invoices, setSection, onOpenCue, onOpenEventDetail, onOpenNewEvent, onOpenNewLead,
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
        meetings={meetings}
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

function PhoneNotifications({
  C,
  invoices,
  events,
  leads,
  contracts,
  meetings,
  questionnaireInstances,
  requests,
  notifLog,
  onNotifLogChange,
  readMap,
  onReadMapChange,
  onOpenEventDetail,
  setSection,
}) {
  const rawCards = useMemo(
    () => buildPhoneNotifications({
      invoices, events, leads, contracts, meetings, questionnaireInstances, requests, notifLog,
    }),
    [invoices, events, leads, contracts, meetings, questionnaireInstances, requests, notifLog]
  );

  const cards = useMemo(() => attachLogTimestamps(rawCards, notifLog), [rawCards, notifLog]);

  useEffect(() => {
    if (!onNotifLogChange) return;
    const merged = mergeNotificationLog(notifLog, cards, meetings);
    const prevJson = JSON.stringify(notifLog || []);
    const nextJson = JSON.stringify(merged);
    if (prevJson !== nextJson) onNotifLogChange(merged);
  }, [cards, meetings, notifLog, onNotifLogChange]);

  const unreadCount = cards.filter((c) => !isNotifRead(c, readMap)).length;
  const { today, earlier } = groupNotifsTodayEarlier(cards);

  const markRead = (id) => {
    const next = { ...(readMap || {}), [id]: new Date().toISOString() };
    savePhoneNotifRead(next);
    onReadMapChange?.(next);
  };

  const markAll = () => {
    const next = markAllNotifsRead(cards, readMap || {});
    savePhoneNotifRead(next);
    onReadMapChange?.(next);
  };

  const openCard = (card) => {
    markRead(card.id);
    if (card.eventId != null && onOpenEventDetail) {
      onOpenEventDetail(card.eventId);
      return;
    }
    if (card.section) setSection?.(card.section);
  };

  const renderGroup = (label, list) => {
    if (!list.length) return null;
    return (
      <div style={{ marginBottom: 22 }}>
        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: C.muted,
          marginBottom: 10, padding: "0 2px",
        }}
        >
          {label.toUpperCase()}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map((card) => {
            const cat = NOTIF_CATALOG[card.category] || NOTIF_CATALOG.LEAD;
            const unread = !isNotifRead(card, readMap);
            const when = formatNotifWhen(card.createdAt);
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => openCard(card)}
                style={{
                  display: "flex", gap: 12, alignItems: "flex-start", textAlign: "left",
                  background: "#fff",
                  border: `1px solid ${C.border}`,
                  borderRadius: 18, padding: "14px 14px 14px 0", cursor: "pointer", fontFamily: BRAND_FONT,
                  boxShadow: "0 4px 14px rgba(22,22,26,0.05)",
                  overflow: "hidden",
                  opacity: unread ? 1 : 0.72,
                }}
              >
                <div style={{
                  width: 4, alignSelf: "stretch", background: cat.accent || cat.ink,
                  borderRadius: "18px 0 0 18px", flexShrink: 0, marginRight: 10,
                }}
                />
                <div style={{
                  width: 42, height: 42, borderRadius: 12, flexShrink: 0, marginTop: 2,
                  background: cat.tint, color: cat.ink,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 900, fontSize: 16,
                }}
                >
                  {cat.glyph || cat.label.slice(0, 1)}
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{
                      fontWeight: 900, fontSize: 15, color: C.text, letterSpacing: "-0.02em",
                      lineHeight: 1.25,
                    }}
                    >
                      {card.title}
                    </div>
                    {unread && (
                      <span style={{
                        width: 8, height: 8, borderRadius: "50%", background: "#EF4444", flexShrink: 0,
                      }}
                      />
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.45, marginBottom: 10 }}>
                    {card.body}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 800, letterSpacing: "0.06em",
                      color: cat.ink, background: cat.tint, padding: "4px 8px", borderRadius: 8,
                    }}
                    >
                      {cat.label}
                    </span>
                    {when ? (
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, flexShrink: 0 }}>{when}</span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "12px 16px 120px", width: "100%", boxSizing: "border-box", fontFamily: BRAND_FONT }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, letterSpacing: "-0.04em", color: C.text }}>Notifications</h1>
          <div style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>
            {cards.length === 0
              ? "You're all caught up"
              : unreadCount === 0
                ? "All caught up"
                : `${unreadCount} need your attention`}
          </div>
        </div>
        {cards.length > 0 && unreadCount > 0 && (
          <button
            type="button"
            onClick={markAll}
            style={{
              background: "none", border: "none", color: BRAND_ACCENT, fontWeight: 800,
              fontSize: 14, fontFamily: BRAND_FONT, cursor: "pointer", padding: "6px 0", flexShrink: 0,
            }}
          >
            Mark all read
          </button>
        )}
      </div>

      {cards.length === 0 ? (
        <div style={{
          padding: "36px 18px", textAlign: "center", background: "#fff",
          borderRadius: 18, border: `1px solid ${C.border}`,
        }}
        >
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6, color: C.text }}>No alerts yet</div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
            Overdue invoices, new leads, unsigned contracts, meetings, and form submissions show up here.
          </div>
        </div>
      ) : (
        <>
          {renderGroup("Today", today)}
          {renderGroup("Earlier", earlier)}
        </>
      )}
    </div>
  );
}

const AVATAR_PALETTE = ["#E11D8F", "#EA580C", "#2563EB", "#7C3AED", "#16A34A", "#DB2777"];

const clientDisplayName = (c) => (
  c?.name || `${c?.firstName || ""} ${c?.lastName || ""}`.trim() || "Client"
);

const clientInitials = (c) => {
  const name = clientDisplayName(c);
  return name.split(/\s+/).map((w) => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase() || "?";
};

const avatarColorFor = (seed = "") => {
  let h = 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
};

const eventBelongsToClientPhone = (event, client) => {
  if (!event || !client) return false;
  if (event.clientId != null && client.id != null && String(event.clientId) === String(client.id)) return true;
  const cname = (client.name || clientDisplayName(client) || "").toLowerCase().trim();
  const cemail = (client.email || "").toLowerCase().trim();
  if (!cname && !cemail) return false;
  if ((event.client || "").toLowerCase().trim() === cname) return true;
  return (event.contacts || []).some((x) => {
    const contactName = `${x.first || ""} ${x.last || ""}`.trim().toLowerCase();
    const contactEmail = (x.email || "").toLowerCase().trim();
    return (cname && contactName === cname) || (cemail && contactEmail === cemail);
  });
};

const getPhoneClientFinancials = (client, events, invoices) => {
  const cname = clientDisplayName(client).toLowerCase();
  const clientEvents = (events || []).filter((e) => eventBelongsToClientPhone(e, client));
  const clientInvoices = (invoices || []).filter((i) => (
    (client?.id != null && i.clientId != null && String(i.clientId) === String(client.id))
    || (i.client || "").toLowerCase() === cname
  ));
  if (clientEvents.length > 0) {
    const booked = clientEvents.reduce((s, e) => s + (Number(e.totalFee) || 0), 0);
    const collected = clientEvents.reduce((s, e) => s + eventPaidTotals(e, clientInvoices).totalPaid, 0);
    return {
      clientEvents,
      clientInvoices,
      booked,
      collected,
      outstanding: Math.max(0, booked - collected),
    };
  }
  const booked = clientInvoices.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const collected = clientInvoices.reduce((s, i) => s + (Number(i.paid) || Number(i.depositPaid) || 0) + (Number(i.balancePaid) || 0), 0);
  return {
    clientEvents,
    clientInvoices,
    booked,
    collected,
    outstanding: Math.max(0, booked - collected),
  };
};

const fmtPhoneContactDate = (iso, time) => {
  if (!iso) return "Date TBD";
  try {
    const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
    const datePart = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    if (!time) return datePart;
    return `${datePart} · ${time}`;
  } catch {
    return String(iso);
  }
};

const fmtAddedSince = (raw) => {
  if (!raw) return null;
  try {
    const d = new Date(raw.length <= 10 ? `${raw}T00:00:00` : raw);
    if (Number.isNaN(d.getTime())) return `Added ${raw}`;
    return `Added ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  } catch {
    return `Added ${raw}`;
  }
};

const sectionLabelStyle = (C) => ({
  fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: C.muted,
  marginBottom: 8, padding: "0 2px",
});

const cardShell = (C) => ({
  background: "#fff",
  border: `1px solid ${C.border}`,
  borderRadius: 18,
  overflow: "hidden",
  boxShadow: "0 2px 10px rgba(22,22,26,0.04)",
});

/** Contact detail — matches iOS mock: header, actions, money, events, contact, others, docs, notes. */
function PhoneContactDetail({
  C,
  client,
  events,
  invoices,
  contracts,
  questionnaireInstances,
  onBack,
  onOpenEventDetail,
  onOpenFull,
}) {
  const [favorited, setFavorited] = useState(!!client?.favorite);
  const name = clientDisplayName(client);
  const initials = clientInitials(client);
  const avatarColor = avatarColorFor(client?.id || name);
  const { clientEvents, clientInvoices, booked, collected, outstanding } = useMemo(
    () => getPhoneClientFinancials(client, events, invoices),
    [client, events, invoices]
  );

  const subtitle = [
    client?.role || "Host",
    client?.type || clientEvents[0]?.type || null,
    [client?.city, client?.state].filter(Boolean).join(", ")
      || client?.homeAddress
      || clientEvents[0]?.venueFull?.city
      || null,
  ].filter(Boolean).join(" · ");

  const phone = client?.phone || clientEvents[0]?.clientPhone || clientEvents[0]?.contacts?.[0]?.phone || "";
  const email = client?.email || clientEvents[0]?.clientEmail || clientEvents[0]?.contacts?.[0]?.email || "";
  const source = client?.source || client?.referredBy || null;
  const since = fmtAddedSince(client?.createdAt || client?.addedAt || client?.since);
  const notes = client?.notes || client?.note || "";

  const primaryKey = name.toLowerCase();
  const otherContacts = useMemo(() => {
    const seen = new Set();
    const out = [];
    clientEvents.forEach((ev) => {
      (ev.contacts || []).forEach((ct) => {
        const n = `${ct.first || ""} ${ct.last || ""}`.trim();
        if (!n) return;
        const key = n.toLowerCase();
        if (key === primaryKey || seen.has(key)) return;
        seen.add(key);
        out.push({
          name: n,
          role: [ct.relationship || ct.role, ct.secondary ? "secondary contact" : null].filter(Boolean).join(" · ")
            || ct.relationship
            || "Contact",
          seed: n,
        });
      });
      (ev.vendors || []).forEach((v) => {
        const n = v.name || "";
        if (!n) return;
        const key = n.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push({
          name: n,
          role: [v.role || v.type || "Vendor", v.venue || ev.venue].filter(Boolean).join(" · "),
          seed: n,
        });
      });
    });
    return out;
  }, [clientEvents, primaryKey]);

  const cname = name.toLowerCase();
  const clientContracts = (contracts || []).filter((c) => (
    (client?.id != null && c.clientId != null && String(c.clientId) === String(client.id))
    || (c.client || "").toLowerCase() === cname
    || clientEvents.some((e) => String(e.id) === String(c.eventId))
  ));
  const clientForms = (questionnaireInstances || []).filter((q) => (
    clientEvents.some((e) => String(e.id) === String(q.eventId))
  ));

  const documents = [
    ...clientContracts.map((c) => ({
      id: `con-${c.id}`,
      title: c.name || c.event || "Contract",
      sub: c.status === "Signed"
        ? `Signed ${c.signedDate || c.signed || c.date || ""} · PDF`.replace(/\s+·/, " ·").trim()
        : `${c.status || "Draft"}${c.date ? ` · ${c.date}` : ""}`,
      tint: "#DCFCE7",
      ink: "#16A34A",
      mark: "📄",
    })),
    ...clientInvoices.slice(0, 6).map((inv) => ({
      id: `inv-${inv.id}`,
      title: inv.event ? `Invoice — ${inv.event}` : `Invoice #${inv.id}`,
      sub: inv.status === "Paid"
        ? `Paid ${inv.balancePaidDate || inv.depositPaidDate || inv.issued || ""}`.trim()
        : `${inv.status || "Unpaid"}${inv.issued ? ` · ${inv.issued}` : ""}`,
      tint: "#EDE9FE",
      ink: "#7C3AED",
      mark: "🧾",
    })),
    ...clientForms.map((q) => ({
      id: `q-${q.id}`,
      title: q.name || "Planning form",
      sub: q.status === "Completed" || q.status === "Submitted"
        ? `Submitted ${q.submittedAt || q.completedAt || q.date || ""}`.trim()
        : (q.status || "Pending"),
      tint: "#DBEAFE",
      ink: "#2563EB",
      mark: "📋",
    })),
  ];

  const openSms = () => { if (phone) window.location.href = `sms:${phone.replace(/[^\d+]/g, "")}`; };
  const openTel = () => { if (phone) window.location.href = `tel:${phone.replace(/[^\d+]/g, "")}`; };
  const openMail = () => { if (email) window.location.href = `mailto:${email}`; };

  const actionBtn = (label, icon, onClick, disabled) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16,
        padding: "14px 8px", cursor: disabled ? "default" : "pointer",
        fontFamily: BRAND_FONT, opacity: disabled ? 0.45 : 1,
        boxShadow: "0 2px 8px rgba(22,22,26,0.04)",
      }}
    >
      <span style={{ color: BRAND_ACCENT, display: "flex" }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: BRAND_ACCENT }}>{label}</span>
    </button>
  );

  return (
    <div style={{ padding: "4px 0 28px", width: "100%", boxSizing: "border-box", fontFamily: BRAND_FONT }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: "none", border: "none", color: BRAND_ACCENT, fontWeight: 800,
            fontSize: 15, cursor: "pointer", fontFamily: BRAND_FONT, padding: 0,
          }}
        >
          ‹ Clients
        </button>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            aria-label={favorited ? "Unfavorite" : "Favorite"}
            onClick={() => setFavorited((v) => !v)}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 8,
              color: favorited ? "#EF4444" : C.muted, fontSize: 20, lineHeight: 1,
            }}
          >
            {favorited ? "♥" : "♡"}
          </button>
          <button
            type="button"
            aria-label="More actions"
            onClick={onOpenFull}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 8,
              color: C.muted, fontSize: 20, lineHeight: 1, fontWeight: 800,
            }}
          >
            ⋮
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 20 }}>
        <div style={{
          width: 88, height: 88, borderRadius: "50%", background: avatarColor, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 900, fontSize: 28, letterSpacing: "-0.02em", marginBottom: 14,
          boxShadow: "0 8px 24px rgba(22,22,26,0.12)",
        }}
        >
          {initials}
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em", color: C.text, lineHeight: 1.15 }}>
          {name}
        </div>
        {subtitle ? (
          <div style={{ fontSize: 14, color: C.muted, marginTop: 6 }}>{subtitle}</div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        {actionBtn(
          "Message",
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v7A2.5 2.5 0 0117.5 16H9l-4 3.5V6.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>,
          openSms,
          !phone,
        )}
        {actionBtn(
          "Call",
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M7.5 4.5c.6-.6 1.6-.5 2.1.2l1.4 2c.4.6.3 1.4-.2 1.9l-1 1a12 12 0 005.6 5.6l1-1c.5-.5 1.3-.6 1.9-.2l2 1.4c.7.5.8 1.5.2 2.1l-1.2 1.2c-.6.6-1.5.9-2.4.6A16.5 16.5 0 015.7 8.1c-.3-.9 0-1.8.6-2.4l1.2-1.2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>,
          openTel,
          !phone,
        )}
        {actionBtn(
          "Email",
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.8" /><path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
          openMail,
          !email,
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 22 }}>
        {[
          { label: "BOOKED", value: money(booked), color: C.text },
          { label: "COLLECTED", value: money(collected), color: "#16A34A" },
          { label: "OUTSTANDING", value: money(outstanding), color: outstanding > 0 ? "#EA580C" : C.text },
        ].map((s) => (
          <div key={s.label} style={{ ...cardShell(C), padding: "12px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", color: C.muted, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-0.02em", color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 22 }}>
        <div style={sectionLabelStyle(C)}>EVENTS</div>
        {clientEvents.length === 0 ? (
          <div style={{ ...cardShell(C), padding: "16px 14px", fontSize: 13, color: C.muted }}>No events linked yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {clientEvents.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).map((ev) => {
              const paid = eventPaidTotals(ev, invoices).totalPaid;
              const fee = Number(ev.totalFee) || 0;
              const due = fee > 0 && paid < fee - 0.5;
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onOpenEventDetail?.(ev.id)}
                  style={{
                    ...cardShell(C), padding: "14px 16px", textAlign: "left",
                    cursor: "pointer", fontFamily: BRAND_FONT, width: "100%",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 900, fontSize: 16, color: C.text, letterSpacing: "-0.02em" }}>
                      {ev.name || ev.client || "Event"}
                    </span>
                    {due && (
                      <span style={{
                        fontSize: 10, fontWeight: 800, color: "#C2410C", background: "#FFEDD5",
                        padding: "3px 8px", borderRadius: 999,
                      }}
                      >
                        Balance due
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.45 }}>
                    {fmtPhoneContactDate(ev.date, ev.startTime || ev.time)}
                    {ev.venue ? (
                      <>
                        <br />
                        {ev.venue}
                      </>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 22 }}>
        <div style={sectionLabelStyle(C)}>CONTACT</div>
        <div style={cardShell(C)}>
          {[
            { label: "Phone", value: phone, href: phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null },
            { label: "Email", value: email, href: email ? `mailto:${email}` : null },
            { label: "Source", value: source },
            { label: "Client since", value: since },
          ].filter((r) => r.value).map((r, i, arr) => (
            <div
              key={r.label}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                padding: "14px 16px",
                borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none",
              }}
            >
              <span style={{ fontSize: 14, color: C.muted, fontWeight: 600 }}>{r.label}</span>
              {r.href ? (
                <a href={r.href} style={{ fontSize: 14, fontWeight: 700, color: BRAND_ACCENT, textDecoration: "none", textAlign: "right" }}>
                  {r.value}
                </a>
              ) : (
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text, textAlign: "right" }}>{r.value}</span>
              )}
            </div>
          ))}
          {!phone && !email && !source && !since && (
            <div style={{ padding: "16px", fontSize: 13, color: C.muted }}>No contact details yet.</div>
          )}
        </div>
      </div>

      {otherContacts.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div style={sectionLabelStyle(C)}>OTHER CONTACTS</div>
          <div style={cardShell(C)}>
            {otherContacts.map((p, i) => {
              const ini = p.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
              const color = avatarColorFor(p.seed);
              return (
                <div
                  key={p.name}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                    borderBottom: i < otherContacts.length - 1 ? `1px solid ${C.border}` : "none",
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%", background: color, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, fontSize: 13, flexShrink: 0,
                  }}
                  >
                    {ini}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{p.role}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {documents.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div style={sectionLabelStyle(C)}>DOCUMENTS</div>
          <div style={cardShell(C)}>
            {documents.map((doc, i) => (
              <button
                key={doc.id}
                type="button"
                onClick={onOpenFull}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px", background: "#fff", border: "none", cursor: "pointer",
                  borderBottom: i < documents.length - 1 ? `1px solid ${C.border}` : "none",
                  fontFamily: BRAND_FONT, textAlign: "left",
                }}
              >
                <span style={{
                  width: 36, height: 36, borderRadius: 10, background: doc.tint, color: doc.ink,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, flexShrink: 0,
                }}
                >
                  {doc.mark}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 800, fontSize: 15, color: C.text }}>{doc.title}</span>
                  <span style={{ display: "block", fontSize: 12, color: C.muted, marginTop: 2 }}>{doc.sub}</span>
                </span>
                <span style={{ color: C.muted, fontSize: 18 }}>›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {notes ? (
        <div style={{ marginBottom: 8 }}>
          <div style={sectionLabelStyle(C)}>NOTES</div>
          <div style={{ ...cardShell(C), padding: "14px 16px", fontSize: 14, color: C.text, lineHeight: 1.55 }}>
            {notes}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PhoneClients({ C, clients, events, onOpenFull, onSelectClient }) {
  const [q, setQ] = useState("");
  const filtered = (clients || []).filter((c) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase().trim();
    const name = clientDisplayName(c).toLowerCase();
    return name.includes(needle)
      || (c.business || "").toLowerCase().includes(needle)
      || (c.email || "").toLowerCase().includes(needle);
  });

  const eventCount = (c) => (events || []).filter((e) => eventBelongsToClientPhone(e, c)).length;

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
          }}
          >
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
          const name = clientDisplayName(c);
          const initials = clientInitials(c);
          const n = eventCount(c);
          return (
            <button
              key={c.id || name}
              type="button"
              onClick={() => onSelectClient?.(c)}
              style={{
                display: "flex", gap: 12, alignItems: "center", textAlign: "left",
                background: "#fff", border: `1px solid ${C.border}`, borderRadius: 18,
                padding: "14px", cursor: "pointer", fontFamily: BRAND_FONT,
                boxShadow: "0 2px 8px rgba(22,22,26,0.04)",
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                background: avatarColorFor(c.id || name), color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 14,
              }}
              >
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
                  fontWeight: 900, fontSize: 15,
                }}
                >
                  {item.mark || item.label.slice(0, 1)}
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
  setProfile,
  events,
  leads,
  invoices,
  clients,
  contracts,
  meetings,
  setMeetings,
  meetingSettings,
  setMeetingSettings,
  blockedDates,
  timeFormat,
  questionnaireInstances,
  requests,
  notifLog,
  onNotifLogChange,
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
    // Everything else lives under More (tabs are Home · Events · CUE · Alerts · More)
    return "more";
  };

  const [tab, setTab] = useState(() => tabFromSection(section));
  const [eventDrill, setEventDrill] = useState(false);
  const [clientsDrill, setClientsDrill] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [readMap, setReadMap] = useState(() => loadPhoneNotifRead());

  const notifCards = useMemo(
    () => attachLogTimestamps(
      buildPhoneNotifications({
        invoices, events, leads, contracts, meetings, questionnaireInstances, requests, notifLog,
      }),
      notifLog
    ),
    [invoices, events, leads, contracts, meetings, questionnaireInstances, requests, notifLog]
  );
  const unreadNotifCount = notifCards.filter((c) => !isNotifRead(c, readMap)).length;

  useEffect(() => {
    const onStorage = () => setReadMap(loadPhoneNotifRead());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    // Keep More hub / Alerts hub when section is dashboard
    if ((tab === "more" || tab === "notifications") && (!section || section === "dashboard")) return;
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
    if (section !== "clients") {
      setClientsDrill(false);
      setSelectedClient(null);
    }
  }, [section]);

  const showHome = tab === "home";
  const showNotifyHub = tab === "notifications";
  const inMoreDetail = tab === "more" && section && section !== "dashboard"
    && section !== "events";
  const showClientsHub = inMoreDetail && section === "clients" && !clientsDrill;
  const showClientDetail = showClientsHub && !!selectedClient;
  const showSchedulingHub = inMoreDetail && section === "meetings";
  // Events list is always PhoneEvents; detail/create mount as overlays via eventDrill
  const showSectionChrome = (inMoreDetail && !showClientsHub && !showSchedulingHub)
    || (tab === "events" && eventDrill);

  const onTab = (id) => {
    if (id === "cue") {
      onOpenCue?.();
      return;
    }
    setTab(id);
    const meta = TABS.find((t) => t.id === id);
    if (id === "home" || id === "more" || id === "notifications") setSection("dashboard");
    else if (meta?.section) setSection(meta.section);
  };

  const openEventFromPhone = (id) => {
    setSelectedClient(null);
    setTab("events");
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
            meetings={meetings}
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
        {showNotifyHub && (
          <PhoneNotifications
            C={C}
            invoices={invoices}
            events={events}
            leads={leads}
            contracts={contracts}
            meetings={meetings}
            questionnaireInstances={questionnaireInstances}
            requests={requests}
            notifLog={notifLog}
            onNotifLogChange={onNotifLogChange}
            readMap={readMap}
            onReadMapChange={setReadMap}
            onOpenEventDetail={openEventFromPhone}
            setSection={(s) => { setTab(tabFromSection(s)); setSection(s); }}
          />
        )}
        {tab === "more" && !inMoreDetail && (
          <PhoneMore C={C} setSection={(s) => { setTab("more"); setSection(s); }} onSignOut={onSignOut} />
        )}
        {showClientsHub && (
          <div style={{ padding: "8px 16px 100px", width: "100%" }}>
            {showClientDetail ? (
              <PhoneContactDetail
                C={C}
                client={selectedClient}
                events={events}
                invoices={invoices}
                contracts={contracts}
                questionnaireInstances={questionnaireInstances}
                onBack={() => setSelectedClient(null)}
                onOpenEventDetail={openEventFromPhone}
                onOpenFull={() => setClientsDrill(true)}
              />
            ) : (
              <>
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
                  onSelectClient={setSelectedClient}
                />
              </>
            )}
          </div>
        )}
        {showSchedulingHub && (
          <PhoneHubBoundary>
          <PhoneScheduling
            C={C}
            profile={profile}
            setProfile={setProfile}
            meetings={meetings}
            setMeetings={setMeetings}
            meetingSettings={meetingSettings}
            setMeetingSettings={setMeetingSettings}
            events={events}
            blockedDates={blockedDates}
            timeFormat={timeFormat}
            onBackToMore={() => { setTab("more"); setSection("dashboard"); }}
            onOpenEventDetail={openEventFromPhone}
            onOpenClient={(c) => {
              if (!c) return;
              setTab("more");
              setSection("clients");
              setSelectedClient(c);
            }}
          />
          </PhoneHubBoundary>
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

      {/* Bottom tabs — Home · Events · CUE · Alerts · More */}
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
          const showBadge = t.id === "notifications" && unreadNotifCount > 0;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              style={{
                background: "none", border: "none", padding: "10px 4px 8px", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontFamily: BRAND_FONT,
                position: "relative",
              }}
            >
              <span style={{ position: "relative", display: "inline-flex" }}>
                <TabIcon id={t.id} active={active} color={BRAND_ACCENT} />
                {showBadge && (
                  <span style={{
                    position: "absolute", top: -4, right: -8, minWidth: 16, height: 16, padding: "0 4px",
                    borderRadius: 999, background: "#EF4444", color: "#fff",
                    fontSize: 9, fontWeight: 800, lineHeight: "16px", textAlign: "center",
                  }}
                  >
                    {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                  </span>
                )}
              </span>
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
