import React, { useEffect, useMemo, useState } from "react";
import { BRAND_FONT, BRAND_RADIUS, TYPE } from "../brand";
import { CueMark } from "./CuePointLogo";
import { formatDisplayTime, formatTimeRange } from "../timeFormat";
import { MUSIC_PRESET_GENRES, splitMusicList, joinMusicList, customMusicGenres } from "../musicPresets";

const FONT = BRAND_FONT;
const CARD_R = BRAND_RADIUS.card;
const FIELD_R = BRAND_RADIUS.field;
const PILL = BRAND_RADIUS.pill;

function hexRgb(hex) {
  const h = String(hex || "#6C4DF6").replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  return {
    r: parseInt(n.slice(0, 2), 16) || 108,
    g: parseInt(n.slice(2, 4), 16) || 77,
    b: parseInt(n.slice(4, 6), 16) || 246,
  };
}
function tint(hex, a) {
  const { r, g, b } = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function dollars(n) {
  return `$${Math.max(0, Math.round(Number(n) || 0)).toLocaleString()}`;
}
function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0] || "";
    const b = (parts.find((p) => p === "&") ? parts[parts.indexOf("&") + 1] : parts[1]) || parts[1];
    return ((a + (b?.[0] || "")).toUpperCase() || "YO").slice(0, 2);
  }
  return (parts[0] || "YO").slice(0, 2).toUpperCase();
}
function formatEventDate(dateStr, opts = { weekday: "long", month: "long", day: "numeric", year: "numeric" }) {
  if (!dateStr) return "";
  const d = new Date(String(dateStr).slice(0, 10) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", opts);
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(String(dateStr).slice(0, 10) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}
function loadLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function useIsMobile(breakpoint = 720) {
  const read = () => {
    if (typeof window === "undefined") return false;
    try {
      if (typeof window.matchMedia === "function") {
        return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
      }
    } catch { /* older WebViews */ }
    return window.innerWidth <= breakpoint;
  };
  const [mobile, setMobile] = useState(read);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onChange = () => setMobile(read());
    onChange();
    let mq = null;
    try {
      mq = typeof window.matchMedia === "function"
        ? window.matchMedia(`(max-width: ${breakpoint}px)`)
        : null;
    } catch { mq = null; }
    // Safari < 14 only has addListener on MediaQueryList
    if (mq?.addEventListener) mq.addEventListener("change", onChange);
    else if (mq?.addListener) mq.addListener(onChange);
    window.addEventListener("resize", onChange);
    return () => {
      if (mq?.removeEventListener) mq.removeEventListener("change", onChange);
      else if (mq?.removeListener) mq.removeListener(onChange);
      window.removeEventListener("resize", onChange);
    };
  }, [breakpoint]);
  return mobile;
}

function Icon({ d, size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const ICONS = {
  overview: "M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z",
  timeline: "M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
  music: "M9 18V6l12-2v12M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zm12-2a3 3 0 1 1-3-3 3 3 0 0 1 3 3z",
  questionnaire: "M9 11h6M9 15h4M7 4h10a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V6a2 2 0 0 1 2-2z",
  payments: "M3 8h18M3 12h18M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z",
  documents: "M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm7 0v5h5",
  messages: "M4 6h16v10H8l-4 4z",
  check: "M5 12.5 9.5 17 19 7.5",
  card: "M3 8h18M3 12h18M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
  download: "M12 4v12m0 0 4-4m-4 4-4-4M5 20h14",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  phone: "M6 3h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z",
  plus: "M12 5v14M5 12h14",
  arrow: "M5 12h14M13 6l6 6-6 6",
};

function WaveMark({ color, size = 36 }) {
  return <CueMark size={size} tileFill={color} barFill="#FFFFFF" />;
}

function PortalCard({ children, style, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "#FBFBFD",
        border: "1px solid #EEEEF2",
        borderRadius: CARD_R,
        boxShadow: "0 1px 3px rgba(22,22,26,0.04)",
        padding: 24,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Kicker({ children, color = "#8E8E93", style }) {
  return (
    <div style={{ ...TYPE.label, color, marginBottom: 6, ...style }}>{children}</div>
  );
}

function PrimaryBtn({ children, onClick, brand, style, disabled, type = "button" }) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        background: brand,
        color: "#fff",
        border: "none",
        borderRadius: PILL,
        padding: "12px 20px",
        fontWeight: 700,
        fontSize: 14,
        fontFamily: FONT,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        boxShadow: disabled ? "none" : `0 8px 20px ${tint(brand, 0.35)}`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function TextLink({ children, onClick, brand, style }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "none", border: "none", color: brand, fontWeight: 700, fontSize: 13,
        cursor: "pointer", fontFamily: FONT, padding: 0, display: "inline-flex", alignItems: "center", gap: 4,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function ProgressBar({ pct, brand, height = 8, gradient }) {
  return (
    <div style={{ height, background: "#EEEFF4", borderRadius: PILL, overflow: "hidden" }}>
      <div style={{
        width: `${Math.max(0, Math.min(100, pct))}%`,
        height: "100%",
        borderRadius: PILL,
        background: gradient || brand,
        transition: "width 280ms ease",
      }} />
    </div>
  );
}

function Ring({ pct, brand, size = 92, stroke = 8 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEEFF4" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={brand} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#16161A", letterSpacing: "-0.03em", lineHeight: 1 }}>{Math.round(pct)}%</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#8E8E93", marginTop: 2 }}>ready</div>
      </div>
    </div>
  );
}

function PageHead({ title, subtitle, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
      <div>
        <h1 style={{ ...TYPE.pageTitle, color: "#16161A", margin: 0 }}>{title}</h1>
        {subtitle && <div style={{ fontSize: 14, color: "#8E8E93", marginTop: 6, fontWeight: 500 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

function ChoicePills({ options, value, onChange, brand }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt) => {
        const on = String(value || "") === String(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: `1.5px solid ${on ? brand : "#E6E6EE"}`,
              background: on ? tint(brand, 0.1) : "#fff",
              color: on ? brand : "#3F3F46",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: FONT,
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, children, compact }) {
  return (
    <div>
      <label style={{
        fontSize: compact ? 12 : 13,
        fontWeight: 650,
        color: "#3F3F46",
        display: "block",
        marginBottom: compact ? 6 : 8,
        lineHeight: 1.35,
      }}>{label}</label>
      {children}
    </div>
  );
}

function PortalQuestionField({ q, value, onChange, brand, iStyle, QuestionAnswerInput }) {
  const type = String(q?.type || "text").toLowerCase();
  const options = q?.options || [];
  if (type === "yesno" || (options.length === 2 && /yes|no/i.test(options.join(" ")))) {
    return <ChoicePills options={options.length ? options : ["Yes", "No"]} value={value} onChange={onChange} brand={brand} />;
  }
  if (type === "select" && options.length > 0 && options.length <= 4) {
    return <ChoicePills options={options} value={value} onChange={onChange} brand={brand} />;
  }
  if (QuestionAnswerInput) {
    return (
      <QuestionAnswerInput
        q={q}
        value={value}
        onChange={onChange}
        inputStyle={{ ...iStyle, background: "#fff", borderRadius: FIELD_R }}
      />
    );
  }
  if (type === "textarea") {
    return (
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={q.placeholder || ""}
        style={{ ...iStyle, resize: "vertical", background: "#fff" }}
      />
    );
  }
  return (
    <input
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={q.placeholder || ""}
      style={{ ...iStyle, background: "#fff" }}
    />
  );
}

function invoiceTitle(inv) {
  return inv?.name || inv?.title || inv?.lineItems?.[0]?.description || inv?.event || "Invoice";
}

function paymentHistory(invoices) {
  const rows = [];
  (invoices || []).forEach((inv) => {
    const dep = Number(inv.depositPaid) || 0;
    const bal = Number(inv.balancePaid) || 0;
    if (dep > 0) {
      rows.push({
        id: `${inv.id}-dep`,
        title: "Retainer deposit",
        date: inv.depositPaidDate || inv.issued,
        amount: dep,
        paid: true,
        method: inv.depositPayMethod,
      });
    }
    if (bal > 0) {
      rows.push({
        id: `${inv.id}-bal`,
        title: "Second installment",
        date: inv.balancePaidDate || inv.paidDate || inv.issued,
        amount: bal,
        paid: true,
        method: inv.balancePayMethod,
      });
    }
    if (!dep && !bal) {
      rows.push({
        id: inv.id,
        title: invoiceTitle(inv),
        date: inv.status === "Paid" ? (inv.paidDate || inv.issued) : inv.issued,
        due: inv.due,
        amount: Number(inv.amount) || 0,
        paid: inv.status === "Paid",
        method: inv.payMethod,
      });
    }
  });
  return rows;
}

const FALLBACK_INCLUDES = [
  "Professional DJ & MC",
  "Dance-floor lighting",
  "Premium sound system",
  "Wireless microphone",
  "Online planning portal",
  "Custom run of show",
];

/* ------------------------------------------------------------------ */
/* Overview                                                             */
/* ------------------------------------------------------------------ */
function OverviewPage(props) {
  const {
    ev, brand, djName, headingFont, coverPhoto, couplePhoto, onCouplePhoto,
    clientName, clientInitials, days, readyPct, nextUp, tasks, snapshot, money,
    setSection, welcomeMsg, fixNotices = [], onAckFixNotices, packageInfo, isMobile = false,
  } = props;
  const dateLine = [
    formatEventDate(ev.date, { weekday: isMobile ? "short" : "long", month: "long", day: "numeric" }),
    ev.venueFull?.name || ev.venue,
  ].filter(Boolean).join(" · ");
  const daysLabel = days == null ? "Upcoming" : days === 0 ? "Today" : days === 1 ? "1 day to go" : days > 0 ? `${days} days to go` : "Event complete";
  const welcomeName = clientName && clientName !== ev.name ? clientName : (ev.name || "there");

  useEffect(() => {
    if (fixNotices.length && onAckFixNotices) {
      const t = setTimeout(() => onAckFixNotices(fixNotices.map((n) => n.id)), 1200);
      return () => clearTimeout(t);
    }
  }, [fixNotices, onAckFixNotices]);

  const todoBlock = (
    <>
      {(nextUp || tasks.length > 0) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Kicker style={{ marginBottom: 0 }}>To do</Kicker>
          <span style={{ fontSize: 12, fontWeight: 800, color: brand }}>{readyPct}% ready</span>
        </div>
      )}
      {nextUp && !isMobile && (
        <PortalCard style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 12, flexWrap: "wrap" }}>
          <Ring pct={readyPct} brand={brand} />
          <div style={{ flex: 1, minWidth: 180 }}>
            <Kicker color={brand}>Next up</Kicker>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#16161A", letterSpacing: "-0.02em" }}>{nextUp.title}</div>
            <div style={{ fontSize: 13, color: "#8E8E93", marginTop: 4 }}>{nextUp.sub}</div>
          </div>
          <PrimaryBtn brand={brand} onClick={() => setSection(nextUp.section)}>
            Continue <Icon d={ICONS.arrow} size={16} color="#fff" />
          </PrimaryBtn>
        </PortalCard>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: isMobile ? 20 : 8 }}>
        {tasks.map((t) => (
          <PortalCard key={t.id} style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, background: tint(t.color || brand, 0.12),
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: t.color || brand,
            }}>
              <Icon d={t.icon} size={18} color={t.color || brand} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#16161A" }}>{t.title}</div>
              <div style={{ fontSize: 12, color: "#8E8E93", marginTop: 2 }}>{t.sub}</div>
              {t.pct != null && <div style={{ marginTop: 8 }}><ProgressBar pct={t.pct} brand={brand} height={6} /></div>}
            </div>
            {t.cta === "button" ? (
              <PrimaryBtn brand={brand} onClick={() => setSection(t.section)} style={{ padding: "10px 16px", boxShadow: "none" }}>{t.ctaLabel}</PrimaryBtn>
            ) : (
              <TextLink brand={brand} onClick={() => setSection(t.section)}>{t.ctaLabel}</TextLink>
            )}
          </PortalCard>
        ))}
        {tasks.length === 0 && (
          <PortalCard style={{ padding: 18, color: "#8E8E93", fontSize: 13 }}>You're all caught up — {djName} has everything needed.</PortalCard>
        )}
      </div>
    </>
  );

  const eventCard = (
    <PortalCard style={{ marginBottom: isMobile ? 8 : 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{isMobile ? "Your event" : "Event Snapshot"}</div>
        {!isMobile && <TextLink brand={brand} onClick={() => setSection("timeline")}>Run of show →</TextLink>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {snapshot.map((s) => (
          <div key={s.label} style={s.fullWidth && !isMobile ? { gridColumn: "1 / -1" } : undefined}>
            <Kicker>{s.label}</Kicker>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#16161A", lineHeight: 1.35 }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: 12, color: "#8E8E93", marginTop: 3, lineHeight: 1.4 }}>{s.sub}</div>}
          </div>
        ))}
        {packageInfo?.name && (
          <div>
            <Kicker>Package</Kicker>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#16161A", lineHeight: 1.35 }}>{packageInfo.name}</div>
            {money?.total > 0 && <div style={{ fontSize: 12, color: "#8E8E93", marginTop: 3 }}>{dollars(money.total)}</div>}
          </div>
        )}
      </div>
    </PortalCard>
  );

  return (
    <div>
      <PortalCard style={{
        padding: 0, overflow: "hidden",
        background: coverPhoto
          ? `linear-gradient(100deg, ${tint(brand, 0.92)} 0%, ${tint(brand, 0.78)} 55%, ${tint(brand, 0.55)} 100%), url(${coverPhoto}) right center / cover no-repeat`
          : `linear-gradient(100deg, ${brand} 0%, #7C5CFF 55%, #5B7CFF 100%)`,
        border: "none",
        marginBottom: 18,
      }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.4fr 0.9fr", gap: 20, padding: isMobile ? "22px 20px" : "26px 28px", color: "#fff", alignItems: "center" }} className="cp-portal-split">
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
              <span style={{
                fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
                background: "rgba(255,255,255,0.18)", padding: "6px 12px", borderRadius: PILL,
              }}>{daysLabel}</span>
              {!isMobile && (
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12,
                }}>{clientInitials}</div>
              )}
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", opacity: 0.8, marginBottom: 6 }}>WELCOME BACK</div>
            <div style={{ fontSize: isMobile ? 26 : 32, fontWeight: 900, letterSpacing: "-0.04em", fontFamily: headingFont, lineHeight: 1.15 }}>
              {isMobile ? welcomeName : (ev.name || "Your event")}
            </div>
            {!isMobile && clientName && clientName !== ev.name && (
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8, opacity: 0.95 }}>{clientName}</div>
            )}
            {dateLine && <div style={{ fontSize: 14, opacity: 0.85, marginTop: 8, fontWeight: 500 }}>{dateLine}</div>}
          </div>
          <label style={{
            minHeight: isMobile ? 96 : 132, borderRadius: 16, border: "1.5px dashed rgba(255,255,255,0.45)",
            background: couplePhoto ? `center / cover no-repeat url(${couplePhoto})` : "rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 16, textAlign: "center",
          }}>
            <input type="file" accept="image/*" hidden onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (evnt) => onCouplePhoto(evnt.target.result);
              reader.readAsDataURL(file);
            }} />
            {!couplePhoto && (
              <span style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.9, fontWeight: 500 }}>
                {isMobile ? "Add a photo" : "Drop your favorite photo of the two of you or browse files"}
              </span>
            )}
          </label>
        </div>
      </PortalCard>

      {fixNotices.length > 0 && (
        <PortalCard style={{ marginBottom: 14, background: "#ECFDF5", borderColor: "#A7F3D0" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: "#047857", marginBottom: 8 }}>UPDATED BY YOUR DJ</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {fixNotices.map((n) => (
              <div key={n.id} style={{ fontSize: 13, color: "#065F46", lineHeight: 1.45 }}>
                <strong>{n.momentLabel}</strong>
                {n.resolutionNote ? ` — ${n.resolutionNote}` : " was updated"}
                {n.text ? <span style={{ display: "block", color: "#047857", marginTop: 2, fontSize: 12 }}>Your note: “{n.text}”</span> : null}
              </div>
            ))}
          </div>
        </PortalCard>
      )}

      {welcomeMsg ? (
        <PortalCard style={{ marginBottom: 14, background: tint(brand, 0.06), borderColor: tint(brand, 0.18) }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: brand, marginBottom: 6 }}>FROM YOUR DJ</div>
          <div style={{ fontSize: 14, lineHeight: 1.55, color: "#3F3F46", whiteSpace: "pre-wrap" }}>{welcomeMsg}</div>
        </PortalCard>
      ) : null}

      {/* Mobile outline: To do → Your event. Desktop keeps snapshot + paid beside next-up. */}
      {isMobile ? (
        <>
          {todoBlock}
          {eventCard}
        </>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1.35fr 0.65fr", gap: 14, marginBottom: 18 }} className="cp-portal-split">
            {eventCard}
            <PortalCard>
              <Kicker>Paid to date</Kicker>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 10 }}>
                {dollars(money.paid)} of {dollars(money.total)}
              </div>
              <ProgressBar
                pct={money.total ? (money.paid / money.total) * 100 : 0}
                brand={brand}
                height={10}
                gradient="linear-gradient(90deg, #60A5FA, #7C3AED)"
              />
              {money.due > 0 && (
                <TextLink brand={brand} onClick={() => setSection("payment")} style={{ marginTop: 12, display: "inline-block" }}>
                  View payments →
                </TextLink>
              )}
            </PortalCard>
          </div>
          {todoBlock}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Payments / billing                                                   */
/* ------------------------------------------------------------------ */
function PaymentsPage({ brand, money, invoices, allowPayments, profile, djName, payOptions = [] }) {
  const history = paymentHistory(invoices);
  const dueInv = (invoices || []).find((i) => i.status !== "Paid") || invoices?.[0];
  const depositAmt = Math.max(0, Number(money.depositAmount) || 0);
  const depositPaid = Math.max(0, Number(money.depositPaid) || 0);
  const balanceAmt = Math.max(0, (Number(money.total) || 0) - depositAmt);
  const balancePaid = Math.max(0, Number(money.balancePaid) || 0);
  const depositDone = depositAmt > 0 ? depositPaid >= depositAmt : depositPaid > 0 || money.paid > 0;
  const balanceDone = money.due <= 0 || (balanceAmt > 0 && balancePaid >= balanceAmt);
  const dueLabel = dueInv?.due
    ? formatEventDate(dueInv.due) || dueInv.due
    : formatEventDate(money.dueDate) || "your event";
  const paidPct = money.total ? Math.min(100, (money.paid / money.total) * 100) : 0;
  const paySubject = encodeURIComponent(`Payment for ${money.eventName || "our event"}`);
  const payBody = encodeURIComponent(
    `Hi ${djName},\n\nI'd like to take care of the remaining ${dollars(money.due)} for ${money.eventName || "our event"}. What's the best way to send it?\n\nThanks!`
  );
  const contactEmail = profile?.email || "";
  const contactPhone = profile?.phone || "";
  const schedule = [
    depositAmt > 0 && {
      key: "deposit",
      label: "Deposit",
      amount: depositAmt,
      due: "Due to book",
      done: depositDone,
      paidAmt: Math.min(depositPaid, depositAmt),
      date: money.depositPaidDate,
    },
    {
      key: "balance",
      label: depositAmt > 0 ? "Remaining balance" : "Event total",
      amount: depositAmt > 0 ? balanceAmt : (Number(money.total) || 0),
      due: `Due by ${dueLabel}`,
      done: balanceDone,
      paidAmt: depositAmt > 0 ? Math.min(balancePaid, balanceAmt) : money.paid,
      date: money.balancePaidDate,
    },
  ].filter(Boolean);

  const openMail = () => {
    if (!contactEmail) return;
    window.location.href = `mailto:${contactEmail}?subject=${paySubject}&body=${payBody}`;
  };
  const openCall = () => { if (contactPhone) window.location.href = `tel:${contactPhone}`; };
  const openText = () => {
    if (!contactPhone) return;
    window.location.href = `sms:${contactPhone}?&body=${encodeURIComponent(`Hi ${djName} — ready to pay the remaining ${dollars(money.due)} for ${money.eventName || "our event"}. What's best?`)}`;
  };

  return (
    <div style={{ width: "100%", maxWidth: 1120 }}>
      <PageHead
        title="Payments"
        subtitle={money.due > 0
          ? "See what’s owed, what’s paid, and how to settle up with your DJ."
          : "You’re paid in full — receipts and history live here."}
      />

      {/* Status hero — mobile outline uses filled brand card */}
      <PortalCard style={{
        marginBottom: 16,
        padding: "24px 24px",
        background: money.due > 0
          ? `linear-gradient(135deg, ${brand} 0%, #5B7CFF 100%)`
          : "linear-gradient(135deg, #16A34A 0%, #22C55E 100%)",
        border: "none",
        color: "#fff",
        boxShadow: `0 12px 28px ${tint(brand, 0.28)}`,
      }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", opacity: 0.85, marginBottom: 8 }}>
          {money.due > 0 ? "BALANCE DUE" : "PAID IN FULL"}
        </div>
        <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1 }}>
          {dollars(money.due > 0 ? money.due : money.total)}
        </div>
        <div style={{ fontSize: 13, opacity: 0.9, marginTop: 8, marginBottom: 14 }}>
          {money.due > 0
            ? <>Due {dueLabel}</>
            : <>Thank you — {dollars(money.paid)} received</>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, opacity: 0.9, marginBottom: 8 }}>
          <span>{dollars(money.paid)} paid of {dollars(money.total)}</span>
          <span>{Math.round(paidPct)}%</span>
        </div>
        <div style={{ background: "rgba(255,255,255,0.25)", borderRadius: 99, height: 8, overflow: "hidden", marginBottom: money.due > 0 ? 16 : 0 }}>
          <div style={{ height: "100%", width: `${paidPct}%`, background: "#fff", borderRadius: 99 }} />
        </div>
        {money.due > 0 && (
          <button
            type="button"
            onClick={openMail}
            style={{
              width: "100%", marginTop: 4, padding: "14px 16px", borderRadius: 14, border: "none",
              background: "#fff", color: brand, fontWeight: 800, fontSize: 15, fontFamily: FONT, cursor: "pointer",
            }}
          >
            Pay {dollars(money.due)}
          </button>
        )}
      </PortalCard>

      <div className="cp-portal-split" style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 16, marginBottom: 16 }}>
        {/* Schedule */}
        <PortalCard style={{ padding: "22px 24px" }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Payment schedule</div>
          <div style={{ fontSize: 13, color: "#8E8E93", marginBottom: 18 }}>
            How your event fee breaks down.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {schedule.map((step, i) => (
              <div
                key={step.key}
                style={{
                  display: "flex", gap: 14, alignItems: "flex-start",
                  padding: "14px 16px", borderRadius: 14,
                  background: step.done ? "rgba(22,163,74,0.06)" : "#F8F8FB",
                  border: `1px solid ${step.done ? "rgba(22,163,74,0.22)" : "#EEEEF2"}`,
                }}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: step.done ? "#16A34A" : tint(brand, 0.12),
                  color: step.done ? "#fff" : brand,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: 12,
                }}>
                  {step.done ? <Icon d={ICONS.check} size={15} color="#fff" /> : String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#16161A" }}>{step.label}</div>
                    <div style={{ fontWeight: 900, fontSize: 15, letterSpacing: "-0.02em" }}>{dollars(step.amount)}</div>
                  </div>
                  <div style={{ fontSize: 12, color: step.done ? "#16A34A" : "#8E8E93", marginTop: 4, fontWeight: 600 }}>
                    {step.done
                      ? `Paid${step.date ? ` · ${step.date}` : ""}`
                      : step.due}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </PortalCard>

        {/* How to pay */}
        <PortalCard style={{ padding: "22px 24px", display: "flex", flexDirection: "column" }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
            {money.due > 0 ? "How to pay" : "Questions?"}
          </div>
          <div style={{ fontSize: 13, color: "#8E8E93", marginBottom: 16, lineHeight: 1.5 }}>
            {money.due > 0
              ? (payOptions.length
                ? "Use one of the options your DJ set up for this event."
                : (allowPayments
                  ? "Settle your balance with the options below, or reach out if you’d rather pay another way."
                  : `Payments are arranged directly with ${djName}. Reach out and they’ll confirm the best method.`))
              : `Need a receipt or have a billing question? ${djName} can help.`}
          </div>

          {money.due > 0 && payOptions.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {payOptions.map((opt) => (
                <div key={opt.id || opt.label} style={{
                  padding: "12px 14px", borderRadius: 12, background: "#F8F8FB", border: "1px solid #EEEEF2",
                }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: "#16161A" }}>{opt.label}</div>
                  {opt.detail && <div style={{ fontSize: 12, color: "#8E8E93", marginTop: 4, lineHeight: 1.45 }}>{opt.detail}</div>}
                </div>
              ))}
            </div>
          )}

          {money.due > 0 && allowPayments && payOptions.length === 0 && (
            <PrimaryBtn brand={brand} style={{ width: "100%", marginBottom: 12 }} onClick={openMail}>
              Pay balance · {dollars(money.due)}
            </PrimaryBtn>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
            {contactEmail && (
              <button type="button" onClick={openMail} style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                background: "#F8F8FB", border: "1px solid #EEEEF2", borderRadius: 12, padding: "12px 14px",
                cursor: "pointer", fontFamily: FONT,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, background: tint(brand, 0.12), color: brand,
                  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0,
                }}>@</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: "#16161A" }}>Email {djName}</div>
                  <div style={{ fontSize: 12, color: "#8E8E93", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{contactEmail}</div>
                </div>
              </button>
            )}
            {contactPhone && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <button type="button" onClick={openCall} style={{
                  background: "#F8F8FB", border: "1px solid #EEEEF2", borderRadius: 12, padding: "12px 14px",
                  cursor: "pointer", fontFamily: FONT, fontWeight: 800, fontSize: 13, color: "#16161A",
                }}>Call</button>
                <button type="button" onClick={openText} style={{
                  background: "#F8F8FB", border: "1px solid #EEEEF2", borderRadius: 12, padding: "12px 14px",
                  cursor: "pointer", fontFamily: FONT, fontWeight: 800, fontSize: 13, color: "#16161A",
                }}>Text</button>
              </div>
            )}
            {!contactEmail && !contactPhone && payOptions.length === 0 && (
              <div style={{ fontSize: 13, color: "#8E8E93", lineHeight: 1.5 }}>
                Payment options aren’t listed yet — check your emails from {djName}.
              </div>
            )}
          </div>
        </PortalCard>
      </div>

      {/* Invoices */}
      {(invoices || []).length > 0 && (
        <PortalCard style={{ marginBottom: 16, padding: "22px 24px" }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 14 }}>Invoices</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(invoices || []).map((inv) => {
              const paid = inv.status === "Paid";
              const amt = Number(inv.amount) || 0;
              return (
                <div key={inv.id} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                  borderRadius: 14, background: "#F8F8FB", border: "1px solid #EEEEF2",
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: paid ? "#E8F8EF" : tint(brand, 0.12),
                    color: paid ? "#16A34A" : brand,
                    display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13,
                  }}>$</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{invoiceTitle(inv)}</div>
                    <div style={{ fontSize: 12, color: "#8E8E93", marginTop: 2 }}>
                      {[inv.id, inv.issued ? `Issued ${inv.issued}` : null].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 15 }}>{dollars(amt)}</div>
                    <div style={{
                      fontSize: 11, fontWeight: 800, marginTop: 2,
                      color: paid ? "#16A34A" : "#EA580C",
                    }}>{paid ? "Paid" : (inv.status || "Due")}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </PortalCard>
      )}

      {/* History */}
      <PortalCard style={{ padding: "22px 24px" }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: history.length ? 14 : 8 }}>Payment activity</div>
        {history.length === 0 ? (
          <div style={{
            fontSize: 13, color: "#8E8E93", lineHeight: 1.55, padding: "12px 14px",
            background: "#F8F8FB", borderRadius: 12, border: "1px solid #EEEEF2",
          }}>
            Nothing recorded yet. Once {djName} logs a payment, it’ll show up here.
          </div>
        ) : history.map((row, i) => (
          <div key={row.id} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "14px 0",
            borderTop: i === 0 ? "none" : "1px solid #F0F0F5",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", background: row.paid ? "#E8F8EF" : "#FFF4E8",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Icon d={ICONS.check} size={14} color={row.paid ? "#16A34A" : "#EA580C"} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{row.title}</div>
              <div style={{ fontSize: 12, color: "#8E8E93", marginTop: 2 }}>
                {[row.date, row.method].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{dollars(row.amount)}</div>
          </div>
        ))}
      </PortalCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Questionnaire                                                        */
/* ------------------------------------------------------------------ */
function QuestionnairePage({ brand, iStyle, questionnaire, QuestionAnswerInput }) {
  const { questions, sections, answers, answeredCount, total, onSave } = questionnaire;
  const fieldStyle = {
    ...iStyle,
    width: "100%",
    padding: "9px 12px",
    fontSize: 13,
    borderRadius: FIELD_R,
    background: "#fff",
    boxSizing: "border-box",
  };
  const matchSection = (q, sec) => {
    const raw = String(q?.section || "General").trim().toLowerCase();
    const id = String(sec?.id ?? "").trim().toLowerCase();
    const label = String(sec?.label ?? "").trim().toLowerCase();
    return !!raw && (raw === id || (!!label && raw === label));
  };
  const groupedIds = new Set();
  (sections || []).forEach((sec) => {
    questions.filter((q) => matchSection(q, sec)).forEach((q) => groupedIds.add(q.id));
  });
  const orphanQs = questions.filter((q) => !groupedIds.has(q.id));
  const blocks = [
    ...(sections || []).map((sec) => ({ sec, qs: questions.filter((q) => matchSection(q, sec)) })),
    ...(orphanQs.length ? [{ sec: { id: "General", label: "General" }, qs: orphanQs }] : []),
  ].filter((b) => b.qs.length);
  const isAnswered = (q) => String(answers[q.id]?.answer ?? "").trim() !== "";
  const renderBlock = (sec, qs, index) => {
    const done = qs.filter(isAnswered).length;
    const complete = done === qs.length;
    return (
      <PortalCard
        key={sec.id || sec.label}
        style={{
          padding: 0,
          overflow: "hidden",
          borderLeft: `4px solid ${complete ? "#16A34A" : brand}`,
          boxShadow: "0 2px 10px rgba(22,22,26,0.05)",
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "16px 20px",
          background: complete ? "rgba(22,163,74,0.06)" : tint(brand, 0.06),
          borderBottom: "1px solid #EEEEF2",
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: complete ? "#16A34A" : brand, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 12, letterSpacing: "0.02em",
          }}>
            {complete ? <Icon d={ICONS.check} size={16} color="#fff" /> : String(index + 1).padStart(2, "0")}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#16161A", letterSpacing: "-0.02em" }}>
              {sec.label || sec.id}
            </div>
            <div style={{ fontSize: 12, color: "#8E8E93", marginTop: 2, fontWeight: 600 }}>
              {qs.length} question{qs.length === 1 ? "" : "s"}
            </div>
          </div>
          <div style={{
            background: complete ? "#E8F8EF" : "#F6F6FA",
            color: complete ? "#16A34A" : "#8E8E93",
            fontWeight: 800, fontSize: 11, padding: "5px 10px", borderRadius: PILL,
            whiteSpace: "nowrap",
          }}>
            {complete ? "Complete" : `${done}/${qs.length}`}
          </div>
        </div>
        <div className="cp-portal-q-grid" style={{
          padding: "20px 22px 22px",
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "18px 20px",
          alignItems: "start",
        }}>
          {qs.map((q) => {
            const type = String(q?.type || "text").toLowerCase();
            const wide = type === "textarea" || type === "longtext" || type === "paragraph";
            return (
              <div
                key={q.id}
                style={{ gridColumn: wide ? "1 / -1" : "auto", minWidth: 0 }}
              >
                <Field label={q.q} compact>
                  <PortalQuestionField
                    q={q}
                    value={answers[q.id]?.answer || ""}
                    onChange={(val) => onSave(q.id, val)}
                    brand={brand}
                    iStyle={fieldStyle}
                    QuestionAnswerInput={QuestionAnswerInput}
                  />
                </Field>
              </div>
            );
          })}
        </div>
      </PortalCard>
    );
  };
  return (
    <div style={{ width: "100%", maxWidth: 1120 }}>
      <PageHead
        title="Event questionnaire"
        subtitle="The little details that make your night yours."
        right={
          <div style={{
            background: tint(brand, 0.12), color: brand, fontWeight: 800, fontSize: 12,
            padding: "6px 12px", borderRadius: PILL,
          }}>
            {answeredCount}/{total} complete
          </div>
        }
      />
      {questions.length === 0 ? (
        <PortalCard><div style={{ fontSize: 14, color: "#8E8E93" }}>Your DJ hasn’t assigned a questionnaire yet.</div></PortalCard>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {blocks.map((b, i) => renderBlock(b.sec, b.qs, i))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Documents                                                            */
/* ------------------------------------------------------------------ */
function DocumentsPage({
  brand, money, invoices, setSection, packageInfo = {},
  contracts = [], allowContract = false, allowQuestionnaire = false,
  questionnaire = null, isMobile = false,
}) {
  const addOns = packageInfo?.addOns || [];
  const includes = packageInfo?.includes || [];
  const activeContract = (contracts || [])[0] || null;
  const contractSigned = !!(activeContract && (activeContract.status === "Signed" || activeContract.signedBy));
  const qAnswered = questionnaire?.answeredCount || 0;
  const qTotal = questionnaire?.total || 0;
  const qPct = qTotal ? Math.round((qAnswered / qTotal) * 100) : 0;

  const invoiceRows = (invoices || []).map((inv, i) => {
    const paid = inv.status === "Paid";
    return (
      <button
        key={inv.id || i}
        type="button"
        onClick={() => setSection("payment")}
        style={{
          display: "flex", alignItems: "center", gap: 12, width: "100%",
          padding: "14px 0", border: "none", background: "none", cursor: "pointer",
          fontFamily: FONT, textAlign: "left",
          borderTop: i === 0 ? "none" : "1px solid #F0F0F5",
        }}
      >
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F6F6FA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon d={ICONS.documents} size={16} color="#8E8E93" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: "#16161A" }}>{invoiceTitle(inv)}</div>
          <div style={{ fontSize: 12, color: "#8E8E93", marginTop: 2 }}>
            {inv.id ? `INV-${inv.id}` : "Invoice"}
            {inv.issued ? ` · ${inv.issued}` : inv.due ? ` · Due ${inv.due}` : ""}
            {` · ${dollars(inv.amount)}`}
          </div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: PILL, flexShrink: 0,
          background: paid ? "#E8F8EF" : "#FFF4E8", color: paid ? "#15803D" : "#C2410C",
        }}>{paid ? "Paid" : "Due"}</span>
        <span style={{ color: "#C4C4CC", fontSize: 18, fontWeight: 700 }}>›</span>
      </button>
    );
  });

  return (
    <div>
      <PageHead
        title={isMobile ? "Documents" : "Documents & package"}
        subtitle={isMobile ? "Everything for your booking, in one place." : "What’s included for your event."}
      />

      {/* Contract */}
      {(allowContract || activeContract) && (
        <div style={{ marginBottom: 18 }}>
          <Kicker>Contract</Kicker>
          <PortalCard
            onClick={() => setSection("contract")}
            style={{ padding: "16px 18px", cursor: allowContract ? "pointer" : "default", display: "flex", alignItems: "center", gap: 14 }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: tint(brand, 0.12), color: brand, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon d={ICONS.documents} size={18} color={brand} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{activeContract?.name || activeContract?.title || "DJ Services Contract"}</div>
              <div style={{ fontSize: 12, color: "#8E8E93", marginTop: 2 }}>
                {contractSigned
                  ? `Signed by both${activeContract?.signed || activeContract?.signedDate ? ` · ${activeContract.signed || activeContract.signedDate}` : ""}`
                  : activeContract ? "Awaiting signature" : "No contract yet"}
              </div>
            </div>
            {activeContract && (
              <span style={{
                fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: PILL,
                background: contractSigned ? "#E8F8EF" : "#EEF2FF", color: contractSigned ? "#15803D" : brand,
              }}>{contractSigned ? "Signed" : "Open"}</span>
            )}
            {allowContract && <span style={{ color: "#C4C4CC", fontSize: 18, fontWeight: 700 }}>›</span>}
          </PortalCard>
        </div>
      )}

      {/* Invoices & receipts */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <Kicker style={{ marginBottom: 0 }}>Invoices & receipts</Kicker>
          <TextLink brand={brand} onClick={() => setSection("payment")}>Pay →</TextLink>
        </div>
        <PortalCard style={{ padding: "4px 18px" }}>
          {(invoices || []).length === 0
            ? <div style={{ fontSize: 13, color: "#8E8E93", padding: "14px 0" }}>No invoices yet.</div>
            : invoiceRows}
        </PortalCard>
      </div>

      {/* Planning forms */}
      {allowQuestionnaire && (
        <div style={{ marginBottom: 18 }}>
          <Kicker>Planning forms</Kicker>
          <PortalCard
            onClick={() => setSection("questionnaire")}
            style={{ padding: "16px 18px", cursor: "pointer" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>Event details</div>
                <div style={{ fontSize: 12, color: "#8E8E93", marginTop: 2 }}>
                  {qTotal ? `${qAnswered} of ${qTotal}` : "Questionnaire"}
                </div>
              </div>
              <span style={{ color: "#C4C4CC", fontSize: 18, fontWeight: 700 }}>›</span>
            </div>
            {qTotal > 0 && <ProgressBar pct={qPct} brand={brand} height={8} />}
          </PortalCard>
        </div>
      )}

      {/* Package & add-ons */}
      <div style={{
        borderRadius: CARD_R, padding: "22px 22px", marginBottom: 8, color: "#fff",
        background: `linear-gradient(100deg, ${brand} 0%, #5B7CFF 100%)`,
        boxShadow: `0 12px 32px ${tint(brand, 0.28)}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <div style={{ ...TYPE.label, opacity: 0.85, marginBottom: 8 }}>Your package</div>
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em" }}>{packageInfo?.name || "Your package"}</div>
            {packageInfo?.duration && <div style={{ fontSize: 14, opacity: 0.9, marginTop: 6 }}>{packageInfo.duration}</div>}
          </div>
          <div style={{ fontWeight: 800, fontSize: 14, opacity: 0.95, whiteSpace: "nowrap" }}>{dollars(money?.total)} total</div>
        </div>
        {includes.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", opacity: 0.85, marginBottom: 10 }}>INCLUDED</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "10px 24px" }}>
              {includes.map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
                  <Icon d={ICONS.check} size={15} color="#fff" /> {f}
                </div>
              ))}
            </div>
          </div>
        )}
        {addOns.length > 0 && (
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.25)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", opacity: 0.85, marginBottom: 10 }}>ADD-ONS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {addOns.map((a) => (
                <div key={a.id || a.name} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", fontSize: 13, fontWeight: 600 }}>
                  <span>{a.name}{a.qty > 1 ? ` × ${a.qty}` : ""}</span>
                  <span style={{ opacity: 0.95, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 8 }}>
                    {a.included ? (
                      <>
                        {(Number(a.price) || 0) > 0 && <span style={{ opacity: 0.85 }}>{dollars(a.price)}</span>}
                        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", opacity: 0.85 }}>INCLUDED</span>
                      </>
                    ) : (
                      (Number(a.lineTotal) || Number(a.price) || 0) > 0
                        ? `+${dollars(a.lineTotal != null ? a.lineTotal : a.price)}`
                        : null
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Run of show                                                          */
/* ------------------------------------------------------------------ */
const DEFAULT_DOT_COLORS = ["#C4B5FD", "#A78BFA", "#8B5CF6", "#7C3AED", "#6D28D9", "#DB2777"];

function TimelinePage({ brand, items, onAddComment }) {
  const [openPlaylists, setOpenPlaylists] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentOpen, setCommentOpen] = useState({});
  const musicFor = (item) => {
    const mode = item.musicMode || item.music?.mode;
    const songs = item.playlistSongs || item.music?.songs || [];
    const song = item.songData || item.music?.song || null;
    if (mode === "special" || (song?.title && mode !== "playlist" && mode !== "none")) return { kind: "special", song, songs: [] };
    if (mode === "playlist" || songs.length) return { kind: "playlist", song: null, songs };
    return { kind: "empty", song: null, songs: [] };
  };
  const togglePlaylist = (id) => setOpenPlaylists((p) => ({ ...p, [id]: !p[id] }));
  const submitComment = (item) => {
    const id = item.id;
    const text = String(commentDrafts[id] || "").trim();
    if (!text || !id) return;
    onAddComment?.(id, text);
    setCommentDrafts((p) => ({ ...p, [id]: "" }));
    setCommentOpen((p) => ({ ...p, [id]: false }));
  };
  return (
    <div>
      <PageHead
        title="Run of show"
        subtitle="How the night flows — view only. Flag anything that looks off."
      />
      <PortalCard>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: "#8E8E93" }}>View only · edited by your DJ</div>
          <div style={{ background: tint(brand, 0.12), color: brand, fontWeight: 800, fontSize: 12, padding: "5px 12px", borderRadius: PILL }}>
            Read only
          </div>
        </div>
        {(!items || items.length === 0) && (
          <div style={{ fontSize: 14, color: "#8E8E93" }}>Your DJ hasn’t published a run of show yet.</div>
        )}
        <div style={{ position: "relative" }}>
          {(items || []).map((item, idx) => {
            const id = item.id || idx;
            const color = item.dotColor || DEFAULT_DOT_COLORS[idx % DEFAULT_DOT_COLORS.length];
            const music = musicFor(item);
            const comments = (Array.isArray(item.clientComments) ? item.clientComments : []).filter((c) => !c.resolvedAt);
            const playlistOpen = !!openPlaylists[id];
            return (
              <div key={id} style={{ display: "grid", gridTemplateColumns: "88px 18px 1fr", gap: 12, paddingBottom: 22 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#8E8E93", paddingTop: 2 }}>{item.time ? formatDisplayTime(item.time) || item.time : "—"}</div>
                <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
                  {idx < items.length - 1 && (
                    <div style={{ position: "absolute", top: 12, bottom: -22, width: 2, background: "#EEEFF4" }} />
                  )}
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, marginTop: 5, position: "relative", zIndex: 1 }} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#16161A" }}>{item.event || item.label}</div>
                  {item.note && <div style={{ fontSize: 13, color: "#8E8E93", marginTop: 3 }}>{item.note}</div>}
                  {music.kind === "special" && music.song?.title && (
                    <div style={{
                      marginTop: 8, padding: "10px 12px", borderRadius: 12, background: "#F8F8FB", border: "1px solid #EEEEF2",
                      display: "flex", alignItems: "center", gap: 10,
                    }}>
                      {music.song.albumArt && <img src={music.song.albumArt} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />}
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: brand, letterSpacing: "0.04em", marginBottom: 2 }}>SPECIAL SONG</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#16161A" }}>
                          {music.song.title}{music.song.artist ? ` — ${music.song.artist}` : ""}
                        </div>
                      </div>
                    </div>
                  )}
                  {music.kind === "playlist" && (
                    <div style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        onClick={() => togglePlaylist(id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
                          background: "#F8F8FB", border: "1px solid #EEEEF2", borderRadius: 12, padding: "10px 12px",
                          cursor: "pointer", fontFamily: FONT,
                        }}
                      >
                        <span style={{
                          transform: playlistOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s",
                          color: "#8E8E93", fontSize: 14, fontWeight: 700, width: 14,
                        }}>›</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#16161A" }}>
                            Playlist · {music.songs.length} song{music.songs.length === 1 ? "" : "s"}
                          </div>
                          {!playlistOpen && music.songs[0]?.title && (
                            <div style={{ fontSize: 12, color: "#8E8E93", marginTop: 2 }}>
                              {music.songs[0].title}{music.songs.length > 1 ? ` +${music.songs.length - 1} more` : ""}
                            </div>
                          )}
                        </div>
                      </button>
                      {playlistOpen && music.songs.length > 0 && (
                        <div style={{ marginTop: 6, paddingLeft: 8 }}>
                          {music.songs.map((song, si) => (
                            <div key={song.id || si} style={{ fontSize: 12, color: "#3F3F46", padding: "5px 0", borderBottom: "1px solid #F0F0F5" }}>
                              {song.title}{song.artist ? ` — ${song.artist}` : ""}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {comments.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {comments.map((c, ci) => (
                        <div key={c.id || ci} style={{ fontSize: 12, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "8px 10px", marginBottom: 6 }}>
                          Your note: {c.text}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 8 }}>
                    {!commentOpen[id] ? (
                      <button
                        type="button"
                        onClick={() => setCommentOpen((p) => ({ ...p, [id]: true }))}
                        style={{ background: "none", border: "none", color: brand, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: FONT, padding: 0 }}
                      >
                        Flag something →
                      </button>
                    ) : (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                        <input
                          value={commentDrafts[id] || ""}
                          onChange={(e) => setCommentDrafts((p) => ({ ...p, [id]: e.target.value }))}
                          placeholder="What’s wrong with this moment?"
                          style={{
                            flex: 1, minWidth: 160, background: "#fff", border: "1px solid #E6E6EE", borderRadius: 10,
                            padding: "8px 12px", fontSize: 13, fontFamily: FONT, outline: "none",
                          }}
                        />
                        <PrimaryBtn brand={brand} onClick={() => submitComment(item)} style={{ boxShadow: "none", padding: "8px 14px" }}>Send</PrimaryBtn>
                        <button type="button" onClick={() => setCommentOpen((p) => ({ ...p, [id]: false }))} style={{ background: "none", border: "none", color: "#8E8E93", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: FONT }}>Cancel</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </PortalCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Music                                                                */
/* ------------------------------------------------------------------ */
const PORTAL_GENRES = MUSIC_PRESET_GENRES;
function momentName(it) {
  return it?.name || it?.event || it?.label || "";
}
function momentTimeKey(t) {
  const m = String(t || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return 9999;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = (m[3] || "").toUpperCase();
  if (ap === "AM" && h === 12) h = 0;
  if (ap === "PM" && h !== 12) h += 12;
  return h * 60 + min;
}

function MusicPage({
  brand, iStyle, djName, specialSections, playlistSections, timelineItems,
  onPatchMusicMeta,
  onAddRunSheetSong, onRemoveRunSheetSong, onPickRunSheetSpecial, onClearRunSheetSpecial,
  requests, onAddMust, onAddSkip, onRemoveRequest,
  mustPlay, setMustPlay, doNotPlay, setDoNotPlay, isMustPlayType, isDoNotPlayType,
  PortalSpotifySearch, eventId, token, genres = [], playlistUrl = "",
  musicMustPlay = "", musicDoNotPlay = "",
  allowMustDoNotPlay = true,
}) {
  const SongSearch = PortalSpotifySearch;
  const firstName = String(djName || "your DJ").split(" ")[0];
  const mustRef = React.useRef(null);
  const [openPlaylistId, setOpenPlaylistId] = useState(null);
  const customGenres = customMusicGenres(genres);
  const [showOtherGenre, setShowOtherGenre] = useState(() => customGenres.length > 0);
  const [otherGenreDraft, setOtherGenreDraft] = useState("");
  const [playlistDraft, setPlaylistDraft] = useState(() => playlistUrl || "");
  const [playlistSaved, setPlaylistSaved] = useState(false);
  useEffect(() => {
    if (customGenres.length > 0) setShowOtherGenre(true);
  }, [customGenres.length]);
  useEffect(() => {
    setPlaylistDraft(playlistUrl || "");
  }, [playlistUrl]);
  const savePlaylistLink = () => {
    const url = String(playlistDraft || "").trim();
    onPatchMusicMeta?.({ playlistUrl: url });
    setPlaylistSaved(true);
    setTimeout(() => setPlaylistSaved(false), 2000);
  };
  const clearPlaylistLink = () => {
    setPlaylistDraft("");
    onPatchMusicMeta?.({ playlistUrl: "" });
  };
  const playlistLooksValid = /spotify\.com\/playlist|music\.apple\.com|youtu(\.be|be\.com)/i.test(playlistDraft || "");

  const moments = useMemo(() => {
    const tl = timelineItems || [];
    if (tl.length) {
      // Only moments the DJ marked as playlist or special — not every timeline row
      return tl.map((it) => {
        const mode = it.musicMode || it.music?.mode || "none";
        const songs = it.playlistSongs || it.music?.songs || [];
        const song = it.songData || it.music?.song || null;
        const name = momentName(it) || "Moment";
        if (mode === "special" || (!!song?.title && mode !== "playlist" && mode !== "none")) {
          return {
            id: it.id,
            name,
            time: it.time || "",
            note: it.note || "",
            type: "special",
            song: song || null,
            songs: [],
            filled: !!song?.title,
            songLimit: it.songLimit ?? null,
          };
        }
        if (mode === "playlist") {
          return {
            id: it.id,
            name,
            time: it.time || "",
            note: it.note || "",
            type: "playlist",
            song: null,
            songs: songs || [],
            filled: (songs || []).length > 0,
            songLimit: it.songLimit ?? null,
          };
        }
        return null;
      }).filter(Boolean).sort((a, b) => momentTimeKey(a.time) - momentTimeKey(b.time));
    }
    const fromSpecial = (specialSections || []).map((sec) => ({
      id: sec.id,
      name: sec.name || "Moment",
      time: sec.startTime || "",
      note: sec.notes || "",
      type: "special",
      song: sec.song || null,
      songs: [],
      filled: !!sec.song?.title,
    }));
    const fromPlaylist = (playlistSections || []).map((sec) => ({
      id: sec.id,
      name: sec.name || "Playlist",
      time: sec.startTime || "",
      note: sec.notes || "",
      type: "playlist",
      song: null,
      songs: sec.songs || [],
      filled: (sec.songs || []).length > 0,
    }));
    return [...fromSpecial, ...fromPlaylist].sort((a, b) => momentTimeKey(a.time) - momentTimeKey(b.time));
  }, [specialSections, playlistSections, timelineItems]);

  useEffect(() => {
    if (!openPlaylistId) return;
    const stillThere = moments.some((m) => String(m.id) === String(openPlaylistId) && m.type === "playlist");
    if (!stillThere) setOpenPlaylistId(null);
  }, [moments, openPlaylistId]);

  const filledCount = moments.filter((m) => m.filled).length;
  const guestList = (requests || []).filter((r) => !isMustPlayType(r.type) && !isDoNotPlayType(r.type));

  const mustList = useMemo(() => {
    const fromReqs = (requests || []).filter((r) => isMustPlayType(r.type));
    const labels = new Set(fromReqs.map((r) => String(r.song || r.title || "").trim().toLowerCase()).filter(Boolean));
    const extras = splitMusicList(musicMustPlay)
      .filter((l) => !labels.has(l.toLowerCase()))
      .map((l) => ({ id: `music-must-${l}`, song: l, _fromMusic: true }));
    return [...fromReqs, ...extras];
  }, [requests, musicMustPlay, isMustPlayType]);

  const skipList = useMemo(() => {
    const fromReqs = (requests || []).filter((r) => isDoNotPlayType(r.type));
    const labels = new Set(fromReqs.map((r) => String(r.song || r.title || "").trim().toLowerCase()).filter(Boolean));
    const extras = splitMusicList(musicDoNotPlay)
      .filter((l) => !labels.has(l.toLowerCase()))
      .map((l) => ({ id: `music-dnp-${l}`, song: l, _fromMusic: true }));
    return [...fromReqs, ...extras];
  }, [requests, musicDoNotPlay, isDoNotPlayType]);

  const fieldStyle = { ...iStyle, background: "#fff", width: "100%", boxSizing: "border-box" };
  const saveGenres = (next) => {
    onPatchMusicMeta?.({ genres: next, clientGenres: customMusicGenres(next) });
  };
  const addOtherGenre = () => {
    const g = otherGenreDraft.trim();
    if (!g) return;
    const exists = (genres || []).some((x) => String(x).toLowerCase() === g.toLowerCase());
    if (!exists) saveGenres([...(genres || []), g]);
    setOtherGenreDraft("");
    setShowOtherGenre(true);
  };

  const removeMustRow = (r) => {
    if (r._fromMusic) {
      const next = splitMusicList(musicMustPlay).filter((x) => x.toLowerCase() !== String(r.song || "").toLowerCase());
      onPatchMusicMeta?.({ mustPlay: joinMusicList(next) });
      return;
    }
    onRemoveRequest?.(r.id);
  };
  const removeSkipRow = (r) => {
    if (r._fromMusic) {
      const next = splitMusicList(musicDoNotPlay).filter((x) => x.toLowerCase() !== String(r.song || "").toLowerCase());
      onPatchMusicMeta?.({ doNotPlay: joinMusicList(next) });
      return;
    }
    onRemoveRequest?.(r.id);
  };

  const songRow = (r, kind) => (
    <div key={r.id} style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 0",
      borderBottom: "1px solid #F0F0F5",
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
        background: kind === "must" ? "#16A34A" : "#DC2626",
      }} />
      {r.albumArt && <img src={r.albumArt} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{r.song || r.title}</div>
        {r.artist && <div style={{ fontSize: 11, color: "#8E8E93" }}>{r.artist}</div>}
      </div>
      <button type="button" onClick={() => (kind === "must" ? removeMustRow(r) : removeSkipRow(r))} aria-label="Remove"
        style={{ background: "none", border: "none", cursor: "pointer", color: "#A1A1AA", fontSize: 16, lineHeight: 1 }}>×</button>
    </div>
  );

  const openPlaylist = moments.find((m) => String(m.id) === String(openPlaylistId) && m.type === "playlist") || null;
  const playlistAtLimit = openPlaylist?.songLimit != null
    && (openPlaylist.songs || []).length >= Number(openPlaylist.songLimit);

  // Drill into a playlist moment: list songs + search to add
  if (openPlaylist) {
    const songs = openPlaylist.songs || [];
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpenPlaylistId(null)}
          style={{
            background: "none", border: "none", color: brand, fontWeight: 800, fontSize: 14,
            cursor: "pointer", fontFamily: FONT, padding: 0, marginBottom: 14,
            display: "inline-flex", alignItems: "center", gap: 6,
          }}
        >
          ← All music
        </button>
        <PageHead
          title={openPlaylist.name}
          subtitle={
            [
              openPlaylist.time || null,
              openPlaylist.songLimit != null
                ? `${songs.length} / ${openPlaylist.songLimit} song${Number(openPlaylist.songLimit) === 1 ? "" : "s"}`
                : `${songs.length} song${songs.length === 1 ? "" : "s"}`,
            ].filter(Boolean).join(" · ")
            || `Add songs for this part of the night.`
          }
        />
        {openPlaylist.note && (
          <PortalCard style={{ marginBottom: 14, padding: "12px 14px", background: "#F8FAF7" }}>
            <div style={{ fontSize: 13, color: "#3F3F46", lineHeight: 1.5, fontWeight: 500 }}>{openPlaylist.note}</div>
          </PortalCard>
        )}
        <PortalCard style={{ marginBottom: 14, padding: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12 }}>Songs in this playlist</div>
          {songs.length === 0 ? (
            <div style={{ fontSize: 13, color: "#8E8E93", marginBottom: 14 }}>
              Nothing here yet — search below to add the first song.
            </div>
          ) : (
            <div style={{ marginBottom: 14 }}>
              {songs.map((song, si) => (
                <div
                  key={song.id || si}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 0",
                    borderTop: si ? "1px solid #F0F0F5" : "none",
                  }}
                >
                  {song.albumArt
                    ? <img src={song.albumArt} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                    : (
                      <div style={{
                        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                        background: tint(brand, 0.12), color: brand,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                      >
                        <Icon d={ICONS.music} size={16} color={brand} />
                      </div>
                    )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{song.title}</div>
                    {song.artist && <div style={{ fontSize: 12, color: "#8E8E93", marginTop: 2 }}>{song.artist}</div>}
                  </div>
                  {song.addedBy === "client" && (
                    <button
                      type="button"
                      onClick={() => onRemoveRunSheetSong?.(openPlaylist.id, song.id)}
                      aria-label="Remove"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#A1A1AA", fontSize: 18, lineHeight: 1, padding: 4 }}
                    >×</button>
                  )}
                </div>
              ))}
            </div>
          )}
          {SongSearch && (
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, color: "#3F3F46" }}>
                {playlistAtLimit ? "Song limit reached" : "Add a song"}
              </div>
              <SongSearch
                placeholder={
                  playlistAtLimit
                    ? `Limit reached (${openPlaylist.songLimit})`
                    : `Search Spotify for ${openPlaylist.name}...`
                }
                onAdd={(song) => {
                  if (playlistAtLimit) return;
                  onAddRunSheetSong?.(openPlaylist.id, song);
                }}
                eventId={eventId}
                token={token}
                brandColor={brand}
                iStyle={fieldStyle}
              />
            </div>
          )}
        </PortalCard>
      </div>
    );
  }

  return (
    <div>
      <PageHead
        title="Music"
        subtitle={`Tell ${firstName} what to play — and what to skip.`}
        right={
          allowMustDoNotPlay ? (
            <button type="button" onClick={() => { mustRef.current?.focus(); mustRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
              style={{
                background: brand, color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px",
                fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: FONT, boxShadow: `0 8px 18px ${tint(brand, 0.28)}`,
              }}>+ Must play</button>
          ) : null
        }
      />

      {moments.length === 0 && (
        <PortalCard style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Music moments</div>
          <div style={{ fontSize: 13, color: "#8E8E93" }}>
            {firstName} hasn’t opened any playlist or key-song moments for you yet. You can still share a Spotify playlist, genres{allowMustDoNotPlay ? ", and must / do-not-play lists" : ""} below.
          </div>
        </PortalCard>
      )}
      {moments.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ ...TYPE.label, color: "#8E8E93" }}>Sections · open one to add songs</div>
            <span style={{ fontSize: 12, fontWeight: 800, color: brand }}>{filledCount}/{moments.length} ready</span>
          </div>
          <div>
            {moments.map((m, idx) => {
              const songCount = (m.songs || []).length;
              if (m.type === "playlist") {
                return (
                  <div key={m.id} style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: 14, position: "relative" }}>
                    <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
                      {idx < moments.length - 1 && (
                        <div style={{ position: "absolute", top: 30, bottom: -8, width: 2, background: "#E8E8EE" }} />
                      )}
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%", background: brand, color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 800, fontSize: 12, position: "relative", zIndex: 1, marginTop: 10,
                      }}>{idx + 1}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpenPlaylistId(m.id)}
                      style={{
                        display: "block", width: "100%", textAlign: "left", cursor: "pointer",
                        fontFamily: FONT, marginBottom: 14, padding: 18,
                        background: "#fff", border: "1px solid #E8E8EE", borderRadius: CARD_R,
                        boxShadow: "0 2px 10px rgba(22,22,26,0.05)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 16, color: "#16161A" }}>{m.name}</div>
                          <div style={{ fontSize: 12, color: "#8E8E93", fontWeight: 600, marginTop: 4 }}>
                            {[
                              m.time || null,
                              songCount > 0
                                ? `${songCount} song${songCount === 1 ? "" : "s"}`
                                : "Tap to add songs",
                            ].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          <span style={{ color: "#A1A1AA", fontSize: 22, fontWeight: 300, lineHeight: 1 }}>›</span>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              }
              return (
                <div key={m.id} style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: 14, position: "relative" }}>
                  <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
                    {idx < moments.length - 1 && (
                      <div style={{ position: "absolute", top: 30, bottom: -8, width: 2, background: "#E8E8EE" }} />
                    )}
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", background: brand, color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, fontSize: 12, position: "relative", zIndex: 1, marginTop: 10,
                    }}>{idx + 1}</div>
                  </div>
                  <PortalCard style={{ marginBottom: 14, padding: 18, boxShadow: "0 2px 10px rgba(22,22,26,0.05)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: "#16161A" }}>{m.name}</div>
                        {m.time && <div style={{ fontSize: 12, color: "#8E8E93", fontWeight: 700, marginTop: 3 }}>{m.time}</div>}
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 800, letterSpacing: "0.06em",
                        padding: "5px 10px", borderRadius: PILL, whiteSpace: "nowrap",
                        background: m.filled ? "#E8F8EF" : tint(brand, 0.12),
                        color: m.filled ? "#16A34A" : brand,
                      }}>{m.filled ? "SONG PICKED" : "PICK A SONG"}</span>
                    </div>
                    {m.song?.title && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        {m.song.albumArt && <img src={m.song.albumArt} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 14 }}>{m.song.title}</div>
                          {m.song.artist && <div style={{ fontSize: 12, color: "#8E8E93" }}>{m.song.artist}</div>}
                        </div>
                        {m.song.addedBy === "client" && onClearRunSheetSpecial && (
                          <button type="button" onClick={() => onClearRunSheetSpecial(m.id)}
                            style={{ background: "none", border: "none", color: "#8E8E93", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
                            Clear
                          </button>
                        )}
                      </div>
                    )}
                    {!m.song?.title && SongSearch && (
                      <div style={{ marginBottom: 10 }}>
                        <SongSearch
                          placeholder={`Pick a song for ${m.name}...`}
                          onAdd={(song) => onPickRunSheetSpecial?.(m.id, song)}
                          eventId={eventId}
                          token={token}
                          brandColor={brand}
                          iStyle={fieldStyle}
                        />
                      </div>
                    )}
                    {m.note && (
                      <div style={{
                        background: "#F8FAF7", borderRadius: 12, padding: "12px 14px",
                        fontSize: 13, color: "#3F3F46", lineHeight: 1.5, fontWeight: 500,
                      }}>
                        {m.note}
                      </div>
                    )}
                  </PortalCard>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
        <PortalCard style={{ padding: "16px 18px" }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Share a playlist</div>
          <div style={{ fontSize: 12, color: "#8E8E93", marginBottom: 12 }}>Spotify or Apple Music link for {firstName}.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={playlistDraft}
              onChange={(e) => { setPlaylistDraft(e.target.value); setPlaylistSaved(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); savePlaylistLink(); } }}
              placeholder="https://open.spotify.com/playlist/…"
              style={{ ...fieldStyle, flex: 1, minWidth: 180 }}
            />
            <PrimaryBtn brand={brand} onClick={savePlaylistLink} style={{ boxShadow: "none" }}>
              {playlistSaved ? "Saved" : "Save"}
            </PrimaryBtn>
          </div>
          {playlistDraft && !playlistLooksValid && (
            <div style={{ fontSize: 12, color: "#B45309", marginTop: 8 }}>Use a full playlist link.</div>
          )}
          {playlistUrl && (
            <div style={{ display: "flex", gap: 12, marginTop: 10, alignItems: "center" }}>
              <a href={playlistUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 700, color: brand, textDecoration: "none" }}>Open saved →</a>
              <button type="button" onClick={clearPlaylistLink} style={{ background: "none", border: "none", color: "#8E8E93", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: FONT }}>Clear</button>
            </div>
          )}
        </PortalCard>

        <PortalCard style={{ padding: "16px 18px" }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Genres</div>
          <div style={{ fontSize: 12, color: "#8E8E93", marginBottom: 12 }}>Tap what you love.</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {PORTAL_GENRES.map((g) => {
              const on = (genres || []).includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    const next = on ? (genres || []).filter((x) => x !== g) : [...(genres || []), g];
                    saveGenres(next);
                  }}
                  style={{
                    padding: "7px 12px", borderRadius: PILL, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
                    border: `1.5px solid ${on ? brand : "#E6E6EE"}`,
                    background: on ? brand : "#fff",
                    color: on ? "#fff" : "#3F3F46",
                  }}
                >{g}</button>
              );
            })}
            {customGenres.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => saveGenres((genres || []).filter((x) => x !== g))}
                style={{
                  padding: "7px 12px", borderRadius: PILL, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
                  border: `1.5px solid ${brand}`, background: brand, color: "#fff",
                }}
              >{g} ×</button>
            ))}
            <button
              type="button"
              onClick={() => setShowOtherGenre((v) => !v)}
              style={{
                padding: "7px 12px", borderRadius: PILL, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
                border: `1.5px dashed ${brand}`, background: tint(brand, 0.08), color: brand,
              }}
            >+ Other</button>
          </div>
          {showOtherGenre && (
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <input
                value={otherGenreDraft}
                onChange={(e) => setOtherGenreDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOtherGenre(); } }}
                placeholder="Type a genre…"
                style={{ ...fieldStyle, flex: 1, minWidth: 160 }}
              />
              <PrimaryBtn brand={brand} onClick={addOtherGenre} style={{ boxShadow: "none" }}>Add</PrimaryBtn>
            </div>
          )}
        </PortalCard>

        {allowMustDoNotPlay && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="cp-portal-split">
            <PortalCard style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16A34A" }} />
                <div style={{ fontWeight: 800, fontSize: 14 }}>Must play</div>
                <span style={{ fontSize: 12, color: "#8E8E93", marginLeft: "auto" }}>{mustList.length}</span>
              </div>
              {mustList.slice(0, 6).map((r) => songRow(r, "must"))}
              {mustList.length > 6 && <div style={{ fontSize: 12, color: "#8E8E93", padding: "6px 0" }}>+{mustList.length - 6} more</div>}
              {mustList.length === 0 && <div style={{ fontSize: 12, color: "#8E8E93", marginBottom: 8 }}>Songs you want heard.</div>}
              {SongSearch && <SongSearch placeholder="Search…" onAdd={(song) => onAddMust(song)} eventId={eventId} token={token} brandColor={brand} iStyle={fieldStyle} />}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input ref={mustRef} value={mustPlay} onChange={(e) => setMustPlay(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && mustPlay.trim()) { onAddMust({ title: mustPlay.trim() }); setMustPlay(""); } }}
                  placeholder="Or type…" style={{ ...fieldStyle, flex: 1 }} />
                <PrimaryBtn brand={brand} onClick={() => { if (mustPlay.trim()) { onAddMust({ title: mustPlay.trim() }); setMustPlay(""); } }} style={{ boxShadow: "none" }}>Add</PrimaryBtn>
              </div>
            </PortalCard>
            <PortalCard style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#DC2626" }} />
                <div style={{ fontWeight: 800, fontSize: 14 }}>Do not play</div>
                <span style={{ fontSize: 12, color: "#8E8E93", marginLeft: "auto" }}>{skipList.length}</span>
              </div>
              {skipList.slice(0, 6).map((r) => songRow(r, "skip"))}
              {skipList.length > 6 && <div style={{ fontSize: 12, color: "#8E8E93", padding: "6px 0" }}>+{skipList.length - 6} more</div>}
              {skipList.length === 0 && <div style={{ fontSize: 12, color: "#8E8E93", marginBottom: 8 }}>Songs to skip.</div>}
              {SongSearch && <SongSearch placeholder="Search…" onAdd={(song) => onAddSkip(song)} eventId={eventId} token={token} brandColor="#DC2626" iStyle={fieldStyle} />}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input value={doNotPlay} onChange={(e) => setDoNotPlay(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && doNotPlay.trim()) { onAddSkip({ title: doNotPlay.trim() }); setDoNotPlay(""); } }}
                  placeholder="Or type…" style={{ ...fieldStyle, flex: 1 }} />
                <PrimaryBtn brand="#DC2626" onClick={() => { if (doNotPlay.trim()) { onAddSkip({ title: doNotPlay.trim() }); setDoNotPlay(""); } }} style={{ boxShadow: "none" }}>Add</PrimaryBtn>
              </div>
            </PortalCard>
          </div>
        )}
      </div>

      {guestList.length > 0 ? (
        <PortalCard>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Guest requests</div>
          <div style={{ fontSize: 13, color: "#8E8E93" }}>
            {guestList.length} guest request{guestList.length === 1 ? "" : "s"} waiting for your OK.
          </div>
          {guestList.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid #F0F0F5", marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{r.song}</div>
                {r.artist && <div style={{ fontSize: 11, color: "#8E8E93" }}>{r.artist}</div>}
              </div>
              <button type="button" onClick={() => { onAddMust({ title: r.song, artist: r.artist, albumArt: r.albumArt, link: r.spotifyUrl }); onRemoveRequest(r.id); }}
                style={{ background: tint(brand, 0.1), color: brand, border: "none", borderRadius: 10, padding: "6px 10px", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: FONT }}>Must</button>
              <button type="button" onClick={() => onRemoveRequest(r.id)}
                style={{ background: "none", border: "none", color: "#A1A1AA", cursor: "pointer", fontSize: 16 }}>×</button>
            </div>
          ))}
        </PortalCard>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Messages                                                             */
/* ------------------------------------------------------------------ */
function MessagesPage({ brand, djName, profile, token, clientName, setUnread }) {
  const storageKey = `cuepoint_portal_msgs_${token}`;
  const [thread, setThread] = useState(() => {
    const saved = loadLocal(storageKey, null);
    if (saved?.length) return saved;
    return [{
      id: 1,
      from: "dj",
      text: `Hi ${clientName.split(" ")[0] || "there"} — I'm putting the last details together. Reply here anytime and I'll see it.`,
      at: new Date().toISOString(),
    }];
  });
  const [draft, setDraft] = useState("");
  const endRef = React.useRef(null);

  useEffect(() => { saveLocal(storageKey, thread); setUnread(0); }, [thread, storageKey, setUnread]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [thread]);

  const send = (text) => {
    const t = String(text || "").trim();
    if (!t) return;
    setThread((prev) => [...prev, { id: Date.now(), from: "client", text: t, at: new Date().toISOString() }]);
    setDraft("");
  };
  const fmt = (iso) => {
    try {
      return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch { return ""; }
  };

  return (
    <div>
      <PageHead title="Messages" subtitle="Everything in one thread, so nothing gets lost in email." />
      <PortalCard style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 560 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid #F0F0F5" }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
            {(djName || "R")[0]}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800 }}>{profile.fullName || profile.djName || djName}</div>
            <div style={{ fontSize: 12, color: "#16A34A", fontWeight: 600 }}>Usually replies within an hour</div>
          </div>
          {profile.phone && <TextLink brand={brand} onClick={() => { window.location.href = `tel:${profile.phone}`; }}>Call</TextLink>}
        </div>
        <div style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", gap: 14, background: "#FAFAFC" }}>
          {thread.map((m) => {
            const mine = m.from === "client";
            return (
              <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "78%" }}>
                <div style={{
                  background: mine ? brand : "#fff",
                  color: mine ? "#fff" : "#16161A",
                  border: mine ? "none" : "1px solid #EDEDF3",
                  borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  padding: "12px 14px", fontSize: 14, lineHeight: 1.5, fontWeight: 500,
                }}>{m.text}</div>
                <div style={{ fontSize: 11, color: "#A1A1AA", marginTop: 4, textAlign: mine ? "right" : "left" }}>
                  {mine ? "You" : (profile.djName || djName).split(" ")[0]} · {fmt(m.at)}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        <div style={{ padding: "12px 16px 16px", borderTop: "1px solid #F0F0F5" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {["Sounds good!", "That works", "Can we call?"].map((q) => (
              <button key={q} type="button" onClick={() => send(q)} style={{
                background: "#fff", border: "1px solid #E6E6EE", borderRadius: PILL, padding: "8px 14px",
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT, color: "#3F3F46",
              }}>{q}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(draft); }}
              placeholder={`Write a message to ${(profile.djName || djName).split(" ")[0]}...`}
              style={{
                flex: 1, background: "#F6F6FA", border: "1px solid #E6E6EE", borderRadius: 14,
                padding: "12px 16px", fontSize: 14, fontFamily: FONT, outline: "none",
              }}
            />
            <button type="button" onClick={() => send(draft)} aria-label="Send message" style={{
              width: 48, height: 48, borderRadius: 14, background: brand, border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Icon d={ICONS.send} size={18} color="#fff" />
            </button>
          </div>
        </div>
      </PortalCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                                */
/* ------------------------------------------------------------------ */
export default function ClientEventPortalUI(props) {
  const {
    section, setSection,
    ev, eventId, token, profile, brandColor, djName, logoPhoto, headingFont, coverPhoto,
    allowPayments, portalSettings = {},
    money, contract, invoices,
    pricingPackages = [],
    pricingAddOns = [],
    questionnaire,
    specialSections, playlistSections, requests,
    musicGenres = [], playlistUrl = "",
    musicMustPlay = "", musicDoNotPlay = "",
    openSections, setOpenSections,
    onPickSpecial, onClearSpecial, onAddPlaylist, onPatchMusicMeta,
    onAddRunSheetSong, onRemoveRunSheetSong, onPickRunSheetSpecial, onClearRunSheetSpecial,
    mustPlay, setMustPlay, doNotPlay, setDoNotPlay,
    onAddMust, onAddSkip, onRemoveRequest, isMustPlayType, isDoNotPlayType,
    timelineItems, onAddTimelineComment, onAckTimelineResolutions,
    showContractModal, setShowContractModal, signPortalContract,
    QuestionAnswerInput, PortalSpotifySearch, PortalContractSection,
    iStyle,
    embedded = false,
    focusedPage = null,
  } = props;
  const isFocused = !!focusedPage;
  const isMobile = useIsMobile(720);

  const brand = brandColor || "#6C4DF6";
  const allowTimeline = portalSettings.allowTimeline !== false;
  const allowQuestionnaire = portalSettings.allowQuestionnaire !== false;
  const allowContract = portalSettings.allowContract !== false;
  const allowMusicRequests = portalSettings.allowMusicRequests !== false;
  const allowMustDoNotPlay = portalSettings.allowMustDoNotPlay !== false;
  const [navOpen, setNavOpen] = useState(false);
  const [couplePhoto, setCouplePhoto] = useState(() => loadLocal(`cuepoint_portal_photo_${token}`, ""));
  const [sectionVisit, setSectionVisit] = useState(0);

  const clientName = ev?.client || ev?.name || "Your event";
  const clientInitials = initials(clientName);
  const days = daysUntil(ev?.date);
  const signedInAs = String(clientName).split(/&|\band\b/i)[0].trim().split(" ")[0] || clientName;

  const qTotal = questionnaire?.total || 0;
  const qAnswered = questionnaire?.answeredCount || 0;
  const qLeft = Math.max(0, qTotal - qAnswered);
  const specialList = Array.isArray(specialSections) ? specialSections : [];
  const specialTotal = specialList.length;
  const specialChosen = specialList.filter((s) => s.song?.title).length;
  const specialLeft = Math.max(0, specialTotal - specialChosen);
  const moneySafe = money || { paid: 0, total: 0, due: 0 };
  const contractSafe = contract || { exists: false, signed: false };

  const readyBits = [];
  if (qTotal) readyBits.push(qAnswered / qTotal);
  if (specialTotal) readyBits.push(specialChosen / specialTotal);
  if (moneySafe.total) readyBits.push(Math.min(1, (moneySafe.paid || 0) / moneySafe.total));
  if (contractSafe.exists) readyBits.push(contractSafe.signed ? 1 : 0);
  const readyPct = readyBits.length ? Math.round((readyBits.reduce((a, b) => a + b, 0) / readyBits.length) * 100) : 56;

  const tasks = [];
  if (allowQuestionnaire && qTotal && qLeft > 0) {
    tasks.push({
      id: "q", title: "Event questionnaire", sub: `${qAnswered} of ${qTotal} answered`,
      pct: qTotal ? (qAnswered / qTotal) * 100 : 0, section: "questionnaire",
      cta: "link", ctaLabel: "Resume", icon: ICONS.questionnaire, color: brand,
    });
  }
  if (moneySafe.due > 0) {
    tasks.push({
      id: "pay", title: "Final balance due", sub: `${dollars(moneySafe.due)} · due ${(invoices || []).find((i) => i.status !== "Paid")?.due || formatEventDate(ev?.date) || "soon"}`,
      section: "payment", cta: "button", ctaLabel: "Pay now", icon: ICONS.card, color: "#EA580C",
    });
  }
  if (allowMusicRequests && specialLeft > 0) {
    tasks.push({
      id: "music", title: "Pick your key-moment songs", sub: `${specialChosen} of ${specialTotal} chosen`,
      section: "music", cta: "link", ctaLabel: "Choose", icon: ICONS.music, color: brand,
    });
  }

  const nextUp = allowQuestionnaire && qLeft > 0
    ? { title: "Finish your event questionnaire", sub: `${qLeft} answer${qLeft === 1 ? "" : "s"} left — about two minutes.`, section: "questionnaire" }
    : moneySafe.due > 0
      ? { title: "Pay your remaining balance", sub: `${dollars(moneySafe.due)} still due before the event.`, section: "payment" }
      : allowMusicRequests && specialLeft > 0
        ? { title: "Pick your key-moment songs", sub: `${specialLeft} still need a song.`, section: "music" }
        : allowTimeline
          ? { title: "You're all set", sub: "Review your run of show anytime.", section: "timeline" }
          : { title: "You're all set", sub: "Your DJ will be in touch if anything else is needed.", section: "home" };

  const venueName = ev?.venueFull?.name || ev?.venue || "TBD";
  const venueAddress = [
    ev?.venueFull?.address,
    [ev?.venueFull?.city, ev?.venueFull?.state].filter(Boolean).join(", "),
    ev?.venueFull?.zip,
  ].filter(Boolean).join(", ")
    || [ev?.venueAddress, ev?.city, ev?.state, ev?.zip].filter(Boolean).join(", ")
    || "";
  const arrivalLabel = !ev?.setupTime || ev?.setupTime === "TBD"
    ? "To be determined"
    : (formatDisplayTime(ev.setupTime) || ev.setupTime);
  const snapshot = [
    { label: "Event", value: ev?.name || "Your event" },
    { label: "Date", value: formatEventDate(ev?.date, { weekday: "short", month: "long", day: "numeric", year: "numeric" }) || "TBD" },
    { label: "Venue", value: venueName, sub: venueAddress || null, fullWidth: !!venueAddress },
    { label: "DJ set", value: (ev?.startTime || ev?.endTime) ? formatTimeRange(ev.startTime, ev.endTime) : (ev?.hours || "TBD") },
    { label: "DJ arrival", value: arrivalLabel },
  ];

  const packageInfo = useMemo(() => {
    const event = ev || {};
    const pkgs = Array.isArray(pricingPackages) ? pricingPackages : [];
    const catalog = Array.isArray(pricingAddOns) ? pricingAddOns : [];
    const matchedPkg = pkgs.find((p) => String(p.id) === String(event.packageId))
      || pkgs.find((p) => p.name && (p.name === event.package || p.name === event.packageName))
      || null;
    const name = event.package || event.packageName || matchedPkg?.name || "Your package";
    const range = (event.startTime || event.endTime) ? formatTimeRange(event.startTime, event.endTime) : "";
    const duration = range
      ? `${range}${event.startTime && event.endTime ? ` · ${formatDisplayTime(event.startTime)} to ${formatDisplayTime(event.endTime)}` : ""}`
      : (event.hours || matchedPkg?.duration || "");

    const normalizeInclude = (x) => (typeof x === "string" ? x : (x?.name || x?.label || "")).trim();
    const pkgIncludes = Array.isArray(event.packageIncludes)
      ? event.packageIncludes.map(normalizeInclude).filter(Boolean)
      : [];
    const catalogIncludes = Array.isArray(matchedPkg?.includes)
      ? matchedPkg.includes.map(normalizeInclude).filter(Boolean)
      : [];
    const includesSource = pkgIncludes.length ? pkgIncludes : catalogIncludes;

    const includedIds = new Set((matchedPkg?.includedAddOnIds || []).map((id) => String(id)));
    const findCat = (id) => catalog.find((a) => String(a.id) === String(id));

    const rawSelected = (Array.isArray(event.selectedAddonsData) && event.selectedAddonsData.length)
      ? event.selectedAddonsData
      : (event.selectedAddons || []);

    const selectedRows = (() => {
      if (!rawSelected?.length) return [];
      if (typeof rawSelected[0] === "string" || typeof rawSelected[0] === "number") {
        const map = {};
        rawSelected.forEach((id) => { map[id] = (map[id] || 0) + 1; });
        return Object.entries(map).map(([id, qty]) => ({ id, qty }));
      }
      return rawSelected.map((a) => ({
        id: a.id,
        qty: Math.max(1, Number(a.qty) || 1),
        name: a.name || a.label || "",
        price: a.unitPrice ?? a.price,
        lineTotal: a.lineTotal,
      }));
    })();

    const byId = new Map();
    selectedRows.forEach((row) => {
      if (row.id == null && !row.name) return;
      const cat = row.id != null ? findCat(row.id) : null;
      const nameLabel = String(row.name || cat?.name || "").trim();
      if (!nameLabel) return;
      const qty = Math.max(1, Number(row.qty) || 1);
      const unit = Number(row.price ?? cat?.price) || 0;
      const included = row.id != null && includedIds.has(String(row.id));
      byId.set(String(row.id ?? nameLabel), {
        id: row.id,
        name: nameLabel,
        qty,
        included,
        price: unit,
        lineTotal: included ? 0 : (row.lineTotal != null ? Number(row.lineTotal) : unit * qty),
      });
    });
    includedIds.forEach((id) => {
      if (byId.has(String(id))) {
        const cur = byId.get(String(id));
        byId.set(String(id), { ...cur, included: true, lineTotal: 0 });
        return;
      }
      const cat = findCat(id);
      if (!cat?.name) return;
      byId.set(String(id), {
        id: cat.id,
        name: cat.name,
        qty: 1,
        included: true,
        price: Number(cat.price) || 0,
        lineTotal: 0,
      });
    });

    const addOnRows = [...byId.values()];
    const includes = includesSource.length
      ? includesSource
      : (addOnRows.length ? [] : FALLBACK_INCLUDES);
    return { name, duration, includes: includes.slice(0, 12), addOns: addOnRows };
  }, [ev, pricingPackages, pricingAddOns]);
  const payOptions = (() => {
    const opts = (Array.isArray(ev?.portalPayOptions) ? ev.portalPayOptions : [])
      .filter((o) => o?.label)
      .filter((o) => !/^card$/i.test(String(o.label).trim()));
    const addr = String(ev?.cashCheckAddress || "").trim();
    if (!addr) return opts;
    return opts.map((o) => {
      const label = String(o.label || "").toLowerCase();
      if (label !== "cash" && label !== "check") return o;
      if (o.detail && String(o.detail).includes(addr)) return o;
      return {
        ...o,
        detail: [o.detail, `Send to:\n${addr}`].filter(Boolean).join("\n\n"),
      };
    });
  })();

  const fixNotices = useMemo(() => {
    const out = [];
    (timelineItems || []).forEach((item) => {
      (item.clientComments || []).forEach((c) => {
        if (c?.resolvedAt && !c.seenByClientAt) {
          out.push({
            id: c.id || `${item.id}_${c.at}`,
            momentId: item.id,
            momentLabel: item.event || item.label || "Run sheet moment",
            text: c.text || "",
            resolutionNote: c.resolutionNote || "Your DJ updated this moment",
            resolvedAt: c.resolvedAt,
          });
        }
      });
    });
    return out.sort((a, b) => String(b.resolvedAt).localeCompare(String(a.resolvedAt)));
  }, [timelineItems]);

  const ackFixNotices = (ids) => {
    onAckTimelineResolutions?.(ids);
  };

  // Desktop sidebar keeps full labels; mobile bottom bar matches Home · Timeline · Music · Pay · Docs
  const nav = (isMobile
    ? [
        { id: "home", label: "Home", icon: ICONS.overview },
        allowTimeline && { id: "timeline", label: "Timeline", icon: ICONS.timeline },
        allowMusicRequests && { id: "music", label: "Music", icon: ICONS.music, badge: specialLeft || null },
        { id: "payment", label: "Pay", icon: ICONS.payments, badge: moneySafe.due > 0 ? 1 : null },
        { id: "documents", label: "Docs", icon: ICONS.documents, badge: (allowQuestionnaire && qLeft) || null },
      ]
    : [
        { id: "home", label: "Overview", icon: ICONS.overview },
        allowTimeline && { id: "timeline", label: "Run of show", icon: ICONS.timeline },
        allowMusicRequests && { id: "music", label: "Music", icon: ICONS.music, badge: specialLeft || null },
        allowQuestionnaire && { id: "questionnaire", label: "Questionnaire", icon: ICONS.questionnaire, badge: qLeft || null },
        { id: "payment", label: "Payments", icon: ICONS.payments, badge: moneySafe.due > 0 ? 1 : null },
        (allowContract || (invoices || []).length > 0 || allowQuestionnaire) && { id: "documents", label: "Documents", icon: ICONS.documents },
      ]
  ).filter(Boolean).filter((item) => !isFocused || item.id === focusedPage);

  const activeSection = (() => {
    if (section === "messages") return "home";
    if (section === "contract" && !allowContract) return "home";
    if (section === "timeline" && !allowTimeline) return "home";
    if (section === "music" && !allowMusicRequests) return "home";
    if (section === "questionnaire" && !allowQuestionnaire) return "home";
    return section;
  })();

  const go = (id) => {
    setSection(id);
    setSectionVisit((n) => n + 1);
    setNavOpen(false);
  };

  const sidebar = (
    <aside style={{
      width: 248, flexShrink: 0, background: "#fff", borderRight: "1px solid #EEEFF3",
      display: "flex", flexDirection: "column", padding: "22px 16px 16px", height: "100%",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 22px" }}>
        {logoPhoto
          ? <img src={logoPhoto} alt="" style={{ width: 36, height: 36, borderRadius: 10, objectFit: "contain" }} />
          : <WaveMark color={brand} />
        }
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#16161A", fontFamily: headingFont, lineHeight: 1.2 }}>{djName}</div>
          <div style={{ fontSize: 11, color: "#8E8E93", marginTop: 2 }}>{profile.tagline || "Events & DJ"}</div>
        </div>
      </div>

      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {nav.map((item) => {
          const active = activeSection === item.id || (item.id === "home" && activeSection === "contract");
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => go(item.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                background: active ? tint(brand, 0.12) : "transparent",
                color: active ? brand : "#3F3F46",
                border: "none", borderRadius: 12, padding: "10px 12px",
                fontWeight: active ? 800 : 600, fontSize: 14, fontFamily: FONT, cursor: "pointer", textAlign: "left",
              }}
            >
              <Icon d={item.icon} size={17} color={active ? brand : "#8E8E93"} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge ? (
                <span style={{
                  minWidth: 20, height: 20, borderRadius: PILL, background: brand, color: "#fff",
                  fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 6px",
                }}>{item.badge}</span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div style={{ background: "#F6F6FA", borderRadius: 16, padding: "14px 16px", marginTop: 16 }}>
        <div style={{ ...TYPE.label, color: "#8E8E93", marginBottom: 4 }}>Countdown</div>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.03em" }}>
          {days == null ? "—" : days === 0 ? "Today" : days > 0 ? `${days} day${days === 1 ? "" : "s"}` : "Done"}
        </div>
        <div style={{ fontSize: 12, color: "#8E8E93", marginTop: 4 }}>
          {formatEventDate(ev?.date, { weekday: "long", month: "long", day: "numeric" })}
          {ev?.startTime ? ` · ${formatDisplayTime(ev.startTime)}` : ""}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 6px 4px" }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%", background: "#16161A", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12,
        }}>{clientInitials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clientName}</div>
          <div style={{ fontSize: 11, color: "#8E8E93" }}>Signed in as {signedInAs}</div>
        </div>
      </div>
    </aside>
  );

  // iOS Safari: fixed 100vh + overflow:hidden + flex minHeight:0 can collapse the
  // scroll area to a blank white frame. Mobile uses document scroll instead.
  return (
    <div style={{
      minHeight: embedded ? "100%" : (isMobile ? "100%" : "100vh"),
      height: embedded ? "100%" : (isMobile ? "auto" : "100vh"),
      overflow: isMobile ? "visible" : "hidden",
      background: "#F4F4F8",
      fontFamily: FONT,
      color: "#16161A",
      WebkitOverflowScrolling: "touch",
    }}>
      <div style={{
        display: "flex",
        height: isMobile ? "auto" : "100%",
        minHeight: isMobile ? "100%" : 0,
        alignItems: "stretch",
      }}>
        {!isFocused && !isMobile && (
          <div className="cp-portal-sidebar" style={{ display: "flex", flexShrink: 0, height: "100%", overflowY: "auto" }}>{sidebar}</div>
        )}
        {!isFocused && !isMobile && navOpen && (
          <div onClick={() => setNavOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(22,22,26,0.35)", zIndex: 50, display: "flex" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ height: "100%" }}>{sidebar}</div>
          </div>
        )}
        <main style={{
          flex: 1, minWidth: 0,
          minHeight: isMobile ? "100%" : 0,
          overflowY: isMobile ? "visible" : "auto",
          overscrollBehavior: "contain",
          padding: isMobile ? "14px 16px 96px" : "28px 32px 80px",
          width: "100%",
        }}>
          {!isFocused && isMobile && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                {logoPhoto
                  ? <img src={logoPhoto} alt="" style={{ width: 34, height: 34, borderRadius: 10, objectFit: "contain" }} />
                  : <WaveMark color={brand} size={34} />}
                <div style={{ fontWeight: 800, fontSize: 15, fontFamily: headingFont, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{djName}</div>
              </div>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", background: "#16161A", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, flexShrink: 0,
              }}>{clientInitials}</div>
            </div>
          )}
          {isFocused && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              {logoPhoto
                ? <img src={logoPhoto} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "contain" }} />
                : <WaveMark color={brand} />}
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, fontFamily: headingFont, lineHeight: 1.2 }}>{djName}</div>
                <div style={{ fontSize: 12, color: "#8E8E93" }}>{clientName}</div>
              </div>
            </div>
          )}

          {activeSection === "home" && (
            <OverviewPage
              key={`home-${sectionVisit}`}
              ev={ev} brand={brand} djName={djName} headingFont={headingFont}
              coverPhoto={coverPhoto} couplePhoto={couplePhoto}
              onCouplePhoto={(src) => { setCouplePhoto(src); saveLocal(`cuepoint_portal_photo_${token}`, src); }}
              clientName={clientName} clientInitials={clientInitials} days={days}
              readyPct={readyPct} nextUp={nextUp} tasks={tasks} snapshot={snapshot}
              money={money} setSection={go}
              welcomeMsg={portalSettings.welcomeMsg || ""}
              fixNotices={fixNotices}
              onAckFixNotices={ackFixNotices}
              packageInfo={packageInfo}
              isMobile={isMobile}
            />
          )}
          {activeSection === "payment" && (
            <PaymentsPage key={`payment-${sectionVisit}`} brand={brand} money={money} invoices={invoices} allowPayments={allowPayments} profile={profile} djName={djName} payOptions={payOptions} />
          )}
          {activeSection === "questionnaire" && allowQuestionnaire && (
            <QuestionnairePage key={`questionnaire-${sectionVisit}`} brand={brand} iStyle={iStyle} questionnaire={questionnaire} QuestionAnswerInput={QuestionAnswerInput} />
          )}
          {activeSection === "documents" && (
            <DocumentsPage
              key={`documents-${sectionVisit}`}
              brand={brand} money={money} invoices={invoices}
              setSection={go} packageInfo={packageInfo}
              contracts={props.contracts || []}
              allowContract={allowContract}
              allowQuestionnaire={allowQuestionnaire}
              questionnaire={questionnaire}
              isMobile={isMobile}
            />
          )}
          {activeSection === "timeline" && allowTimeline && (
            <TimelinePage
              key={`timeline-${sectionVisit}`}
              brand={brand} items={timelineItems}
              onAddComment={onAddTimelineComment}
            />
          )}
          {activeSection === "music" && allowMusicRequests && (
            <MusicPage
              key={`music-${sectionVisit}`}
              brand={brand} iStyle={iStyle} eventId={eventId} token={token} djName={djName}
              specialSections={specialSections} playlistSections={playlistSections}
              timelineItems={timelineItems}
              genres={musicGenres} playlistUrl={playlistUrl}
              musicMustPlay={musicMustPlay} musicDoNotPlay={musicDoNotPlay}
              allowMustDoNotPlay={allowMustDoNotPlay}
              onPatchMusicMeta={onPatchMusicMeta}
              onAddRunSheetSong={onAddRunSheetSong} onRemoveRunSheetSong={onRemoveRunSheetSong}
              onPickRunSheetSpecial={onPickRunSheetSpecial} onClearRunSheetSpecial={onClearRunSheetSpecial}
              requests={requests} onAddMust={onAddMust} onAddSkip={onAddSkip} onRemoveRequest={onRemoveRequest}
              mustPlay={mustPlay} setMustPlay={setMustPlay} doNotPlay={doNotPlay} setDoNotPlay={setDoNotPlay}
              isMustPlayType={isMustPlayType} isDoNotPlayType={isDoNotPlayType}
              PortalSpotifySearch={PortalSpotifySearch}
            />
          )}
          {activeSection === "contract" && allowContract && PortalContractSection && (
            <PortalContractSection key={`contract-${sectionVisit}`} evContracts={props.contracts} iStyle={iStyle} brandColor={brand} onSignContract={signPortalContract} setSection={go} />
          )}
        </main>
      </div>

      {!isFocused && isMobile && (
        <nav style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 60,
          background: "rgba(255,255,255,0.96)", borderTop: "1px solid #EEEFF3",
          display: "grid", gridTemplateColumns: `repeat(${Math.max(nav.length, 1)}, 1fr)`,
          padding: "8px 6px calc(8px + env(safe-area-inset-bottom, 0px))",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}>
          {nav.map((item) => {
            const active = activeSection === item.id
              || (item.id === "documents" && (activeSection === "contract" || activeSection === "questionnaire"));
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                style={{
                  position: "relative", border: "none", background: "none", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  padding: "6px 4px", fontFamily: FONT, color: active ? brand : "#8E8E93",
                  minHeight: 52,
                }}
              >
                <span style={{ position: "relative", display: "inline-flex" }}>
                  <Icon d={item.icon} size={20} color={active ? brand : "#8E8E93"} />
                  {item.badge ? (
                    <span style={{
                      position: "absolute", top: -6, right: -10, minWidth: 16, height: 16, borderRadius: 99,
                      background: "#EF4444", color: "#fff", fontSize: 10, fontWeight: 800,
                      display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
                    }}>{item.badge > 9 ? "9+" : item.badge}</span>
                  ) : null}
                </span>
                <span style={{ fontSize: 10, fontWeight: active ? 800 : 600 }}>{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {showContractModal && PortalContractSection && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(22,22,26,0.45)", zIndex: 80, overflowY: "auto", padding: 24 }}>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <PortalContractSection evContracts={props.contracts} iStyle={iStyle} brandColor={brand} onSignContract={signPortalContract} setSection={() => setShowContractModal(false)} />
            <button type="button" onClick={() => setShowContractModal(false)} style={{
              width: "100%", marginTop: 12, padding: 12, background: "#fff", border: "1px solid #E6E6EE",
              borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FONT,
            }}>Close</button>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .cp-portal-sidebar { display: none !important; }
          .cp-portal-q-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 720px) {
          .cp-portal-split { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
