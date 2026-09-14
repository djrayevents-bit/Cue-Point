/**
 * CuePoint phone shell — bottom tabs matching the iOS mockups.
 * No Billing & Plan entry. Automations opens the shared empty-first page.
 */
import { useEffect, useMemo, useState } from "react";
import CuePointLogo from "./CuePointLogo";
import { BRAND_ACCENT, BRAND_ACCENT_SOFT, BRAND_FONT, BRAND_GRADIENT } from "../brand";

const TABS = [
  { id: "home", label: "Home", section: null },
  { id: "events", label: "Events", section: "events" },
  { id: "clients", label: "Clients", section: "clients" },
  { id: "money", label: "Money", section: "financials" },
  { id: "more", label: "More", section: null },
];

/** More menu — mirrors desktop nav without Billing & Plan. */
export const PHONE_MORE_ITEMS = [
  { label: "Leads", section: "leads", group: "Clients" },
  { label: "Client Portal", section: "clientportal", group: "Clients" },
  { label: "Scheduling", section: "meetings", group: "Clients" },
  { label: "Quick Texts", section: "quicktexts", group: "Clients" },
  { label: "Automations", section: "automations", group: "Clients" },
  { label: "Templates", section: "templates", group: "Planning" },
  { label: "Calendar", section: "availability", group: "Calendar" },
  { label: "Pricing and Packaging", section: "pricing", group: "Money" },
  { label: "Financials", section: "financials", group: "Money" },
  { label: "Venues", section: "venues", group: "Operations" },
  { label: "Equipment", section: "equipment", group: "Operations" },
  { label: "Wardrobe", section: "wardrobe", group: "Operations" },
  { label: "Staff", section: "staff", group: "Operations" },
  { label: "Account & Brand", section: "settings", group: "Settings" },
  { label: "Lists & Defaults", section: "preferences", group: "Settings" },
  { label: "What's New", section: "changelog", group: "Settings" },
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

function PhoneHome({
  C, profile, events, leads, invoices, setSection, onOpenCue, onOpenEventDetail, onOpenNewEvent, onOpenNewLead,
}) {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const firstName = (profile?.djName || profile?.businessName || "DJ").split(/\s+/)[0];
  const hour = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = today.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();

  const upcoming = useMemo(() =>
    (events || [])
      .filter((e) => e.date && new Date(`${e.date}T00:00:00`) >= todayStart)
      .sort((a, b) => (a.date > b.date ? 1 : -1)),
  [events, todayStart]);

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

  const needsYou = useMemo(() => {
    const rows = [];
    (invoices || []).filter((i) => i.status === "Unpaid" || i.status === "Overdue").slice(0, 2).forEach((inv) => {
      rows.push({
        id: `inv-${inv.id}`,
        title: "Send balance reminder",
        sub: `${inv.client || inv.eventName || "Client"} — ${money((inv.amount || 0) - (inv.paid || 0))} due`,
        tag: inv.status === "Overdue" ? "Overdue" : "Today",
        overdue: inv.status === "Overdue",
        go: () => setSection("financials"),
      });
    });
    (leads || []).filter((l) => l.stage === "New Inquiry" || l.status === "Hot").slice(0, 2).forEach((lead) => {
      rows.push({
        id: `lead-${lead.id || lead.name}`,
        title: `Reply to ${lead.name || "lead"}`,
        sub: `${lead.event || lead.eventType || "Lead"} — Lead`,
        tag: "Today",
        overdue: false,
        go: () => setSection("leads"),
      });
    });
    return rows.slice(0, 3);
  }, [invoices, leads, setSection]);

  const quick = [
    { label: "New event", go: () => (onOpenNewEvent ? onOpenNewEvent() : setSection("events")), tint: BRAND_ACCENT_SOFT, ink: BRAND_ACCENT },
    { label: "New lead", go: () => (onOpenNewLead ? onOpenNewLead() : setSection("leads")), tint: "#E8F4FC", ink: "#2563EB" },
    { label: "Send contract", go: () => setSection("events"), tint: "#FCE7F3", ink: "#DB2777" },
    { label: "Build playlist", go: () => setSection("djplanning"), tint: "#E8F8EF", ink: "#2FBF6B" },
    { label: "Ask assistant", go: () => onOpenCue?.(), tint: BRAND_ACCENT_SOFT, ink: BRAND_ACCENT },
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
    <div style={{ padding: "8px 16px 120px", fontFamily: BRAND_FONT }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
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

      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: C.muted, marginBottom: 6 }}>{dateLabel}</div>
      <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.03em", color: C.text, marginBottom: 4 }}>
        {greeting}, {firstName}
      </div>
      <div style={{ fontSize: 14, color: C.muted, marginBottom: 18 }}>Here&apos;s what&apos;s happening today.</div>

      {nextEvent ? (
        <div
          onClick={() => onOpenEventDetail?.(nextEvent.id)}
          style={{
            background: BRAND_GRADIENT, borderRadius: 22, padding: "18px 18px 16px", marginBottom: 16,
            boxShadow: "0 10px 28px rgba(108,77,246,0.28)", cursor: "pointer", color: "#fff",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", background: "rgba(0,0,0,0.22)", padding: "5px 10px", borderRadius: 999 }}>
              {daysUntil === 0 ? "TODAY" : daysUntil === 1 ? "IN 1 DAY" : `IN ${daysUntil} DAYS`}
            </span>
            {(nextEvent.type || nextEvent.eventType) && (
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", background: "rgba(255,255,255,0.92)", color: "#C0264B", padding: "5px 10px", borderRadius: 999 }}>
                {String(nextEvent.type || nextEvent.eventType).toUpperCase()}
              </span>
            )}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 6, lineHeight: 1.15 }}>
            {nextEvent.name || nextEvent.client || "Upcoming event"}
          </div>
          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 16 }}>
            {[nextEvent.venue, nextEvent.city || nextEvent.location].filter(Boolean).join(" · ") || "Venue TBD"}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", opacity: 0.7, marginBottom: 4 }}>DATE</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{fmtDate(nextEvent.date)}</div>
              {nextEvent.client && <div style={{ fontSize: 12, opacity: 0.85, marginTop: 8 }}>{nextEvent.client}</div>}
            </div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>View details →</div>
          </div>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 18, padding: 18, marginBottom: 16, border: `1px solid ${C.border}` }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>No upcoming events</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Add your next gig to see it here.</div>
          <button type="button" onClick={() => (onOpenNewEvent ? onOpenNewEvent() : setSection("events"))}
            style={{ background: BRAND_ACCENT, color: "#fff", border: "none", borderRadius: 999, padding: "10px 16px", fontWeight: 800, fontFamily: BRAND_FONT }}>
            + New event
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 22 }}>
        {[
          [yearEvents.length, "Total events", C.text],
          [remaining, "Remaining", C.text],
          [needCharge, "Need to charge", needCharge === 0 ? C.green : C.orange],
        ].map(([v, l, color]) => (
          <div key={l} style={{ background: "#fff", borderRadius: 16, padding: "14px 10px", textAlign: "center", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 22, fontWeight: 900, color, letterSpacing: "-0.03em" }}>{v}</div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginTop: 4 }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: C.muted, marginBottom: 10 }}>NEEDS YOU</div>
      <div style={{ background: "#fff", borderRadius: 18, border: `1px solid ${C.border}`, marginBottom: 22, overflow: "hidden" }}>
        {needsYou.length === 0 ? (
          <div style={{ padding: 18, fontSize: 13, color: C.muted }}>You&apos;re all caught up.</div>
        ) : needsYou.map((row, i) => (
          <button
            key={row.id}
            type="button"
            onClick={row.go}
            style={{
              width: "100%", textAlign: "left", background: "#fff", border: "none", cursor: "pointer",
              padding: "14px 16px", borderBottom: i < needsYou.length - 1 ? `1px solid ${C.border}` : "none",
              display: "flex", gap: 12, alignItems: "flex-start", fontFamily: BRAND_FONT,
            }}
          >
            <span style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${C.border}`, flexShrink: 0, marginTop: 2 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 800, fontSize: 14, color: C.text }}>{row.title}</span>
              <span style={{ display: "block", fontSize: 12, color: C.muted, marginTop: 3 }}>{row.sub}</span>
            </span>
            <span style={{
              fontSize: 10, fontWeight: 800, borderRadius: 999, padding: "4px 8px", flexShrink: 0,
              background: row.overdue ? "#FEE2E2" : "#FFF4E5", color: row.overdue ? "#DC2626" : "#C2410C",
            }}>{row.tag}</span>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: C.muted, marginBottom: 10 }}>QUICK ACTIONS</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
        {quick.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={q.go}
            style={{
              background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 14px",
              textAlign: "left", cursor: "pointer", fontFamily: BRAND_FONT,
            }}
          >
            <span style={{
              width: 36, height: 36, borderRadius: 12, background: q.tint, color: q.ink,
              display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 900, marginBottom: 10,
            }}>+</span>
            <span style={{ display: "block", fontWeight: 800, fontSize: 13, color: C.text }}>{q.label}</span>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: C.muted, marginBottom: 10 }}>REVENUE SNAPSHOT</div>
      <div style={{ background: "#fff", borderRadius: 18, border: `1px solid ${C.border}`, padding: 18, marginBottom: 8 }}>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>Booked this year</div>
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 8 }}>{money(ytdBooked)}</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>This month: {money(monthBooked)}</div>
        <div style={{ height: 10, borderRadius: 999, background: C.surfaceAlt, overflow: "hidden", display: "flex" }}>
          <div style={{ width: `${(collected / barTotal) * 100}%`, background: C.green }} />
          <div style={{ width: `${(outstanding / barTotal) * 100}%`, background: C.orange }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12, fontWeight: 700 }}>
          <span style={{ color: C.green }}>Collected {money(collected)}</span>
          <span style={{ color: C.orange }}>Outstanding {money(outstanding)}</span>
        </div>
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
    <div style={{ padding: "8px 16px 120px", fontFamily: BRAND_FONT }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: C.muted, marginBottom: 8 }}>MORE</div>
      <h2 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em", margin: "0 0 18px", color: C.text }}>Everything else</h2>
      {Object.entries(groups).map(([group, items]) => (
        <div key={group} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: C.muted, marginBottom: 8 }}>{group.toUpperCase()}</div>
          <div style={{ background: "#fff", borderRadius: 18, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            {items.map((item, i) => (
              <button
                key={item.section}
                type="button"
                onClick={() => setSection(item.section)}
                style={{
                  width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "15px 16px", background: "#fff", border: "none", cursor: "pointer",
                  borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : "none",
                  fontFamily: BRAND_FONT, fontWeight: 700, fontSize: 15, color: C.text,
                }}
              >
                <span>{item.label}</span>
                <span style={{ color: C.muted }}>›</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={onSignOut}
        style={{
          width: "100%", marginTop: 8, background: "#fff", border: `1px solid ${C.border}`,
          borderRadius: 16, padding: "14px", fontWeight: 800, color: C.muted, fontFamily: BRAND_FONT, cursor: "pointer",
        }}
      >
        Sign out
      </button>
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
    if (sec === "clients") return "clients";
    if (sec === "financials" || sec === "pricing") return "money";
    return "more";
  };

  const [tab, setTab] = useState(() => tabFromSection(section));

  useEffect(() => {
    // Keep More hub visible when section is dashboard after tapping More
    if (tab === "more" && (!section || section === "dashboard")) return;
    setTab(tabFromSection(section));
  }, [section]); // eslint-disable-line react-hooks/exhaustive-deps

  const showHome = tab === "home";
  const inMoreDetail = tab === "more" && section && section !== "dashboard"
    && !["events", "clients", "financials"].includes(section);

  const onTab = (id) => {
    setTab(id);
    const meta = TABS.find((t) => t.id === id);
    if (id === "home") setSection("dashboard");
    else if (id === "more") setSection("dashboard"); // More hub (no Billing & Plan)
    else if (meta?.section) setSection(meta.section);
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%", minHeight: "100vh",
      background: C.bg, fontFamily: BRAND_FONT,
      paddingTop: "env(safe-area-inset-top)",
    }}
    >
      <div style={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch" }}>
        {showHome && (
          <PhoneHome
            C={C}
            profile={profile}
            events={events}
            leads={leads}
            invoices={invoices}
            setSection={(s) => { setTab(tabFromSection(s)); setSection(s); }}
            onOpenCue={onOpenCue}
            onOpenEventDetail={onOpenEventDetail}
            onOpenNewEvent={onOpenNewEvent}
            onOpenNewLead={onOpenNewLead}
          />
        )}
        {tab === "more" && !inMoreDetail && (
          <PhoneMore C={C} setSection={(s) => { setTab("more"); setSection(s); }} onSignOut={onSignOut} />
        )}
        {(tab === "events" || tab === "clients" || tab === "money" || inMoreDetail) && (
          <div style={{ padding: "8px 12px 100px" }}>
            {inMoreDetail && (
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
            )}
            {children}
          </div>
        )}
      </div>

      {/* CUE FAB */}
      <button
        type="button"
        onClick={() => onOpenCue?.()}
        style={{
          position: "fixed", right: 18, bottom: `calc(72px + env(safe-area-inset-bottom))`,
          width: 64, height: 64, borderRadius: "50%", border: "none", cursor: "pointer",
          background: BRAND_GRADIENT, color: "#fff", boxShadow: "0 10px 28px rgba(108,77,246,0.4)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          fontFamily: BRAND_FONT, zIndex: 60,
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 300, lineHeight: 1 }}>+</span>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em" }}>CUE</span>
      </button>

      {/* Bottom tabs */}
      <nav style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 70,
        background: "rgba(251,251,253,0.96)", backdropFilter: "blur(12px)",
        borderTop: `1px solid ${C.border}`,
        paddingBottom: "env(safe-area-inset-bottom)",
        display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
      }}
      >
        {TABS.map((t) => {
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
