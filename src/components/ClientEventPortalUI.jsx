import React, { useEffect, useMemo, useState } from "react";
import { BRAND_FONT, BRAND_RADIUS, TYPE } from "../brand";
import { formatDisplayTime, formatTimeRange } from "../timeFormat";

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
  return (
    <div style={{
      width: size, height: size, borderRadius: 10, background: color, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 12h2l2-6 3 12 3-9 2 6h6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function PortalCard({ children, style, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "#fff",
        border: "1px solid #EDEDF3",
        borderRadius: CARD_R,
        boxShadow: "0 8px 28px rgba(22,22,26,0.05)",
        padding: 24,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Kicker({ children, color = "#8E8E93" }) {
  return (
    <div style={{ ...TYPE.label, color, marginBottom: 6 }}>{children}</div>
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
        borderRadius: 12,
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

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 650, color: "#3F3F46", display: "block", marginBottom: 8 }}>{label}</label>
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
    ev, brand, djName, profile, headingFont, coverPhoto, couplePhoto, onCouplePhoto,
    clientName, clientInitials, days, readyPct, nextUp, tasks, snapshot, money,
    contract, latestMessage, setSection,
  } = props;
  const dateLine = [
    formatEventDate(ev.date, { weekday: "long", month: "long", day: "numeric" }),
    ev.venue || ev.venueFull?.name,
  ].filter(Boolean).join(" · ");
  const daysLabel = days == null ? "Upcoming" : days === 0 ? "Today" : days === 1 ? "1 day to go" : days > 0 ? `${days} days to go` : "Event complete";

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
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.9fr", gap: 20, padding: "26px 28px", color: "#fff", alignItems: "center" }} className="cp-portal-split">
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
              <span style={{
                fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
                background: "rgba(255,255,255,0.18)", padding: "6px 12px", borderRadius: PILL,
              }}>{daysLabel}</span>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12,
              }}>{clientInitials}</div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", opacity: 0.8, marginBottom: 6 }}>WELCOME BACK</div>
            <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.04em", fontFamily: headingFont, lineHeight: 1.1 }}>{clientName}</div>
            {dateLine && <div style={{ fontSize: 14, opacity: 0.85, marginTop: 8, fontWeight: 500 }}>{dateLine}</div>}
          </div>
          <label style={{
            minHeight: 132, borderRadius: 16, border: "1.5px dashed rgba(255,255,255,0.45)",
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
                Drop your favorite photo of the two of you or browse files
              </span>
            )}
          </label>
        </div>
      </PortalCard>

      {nextUp && (
        <PortalCard style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 22, flexWrap: "wrap" }}>
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

      <Kicker>A few things need you</Kicker>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
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
              <TextLink brand={brand} onClick={() => setSection(t.section)}>{t.ctaLabel} →</TextLink>
            )}
          </PortalCard>
        ))}
        {tasks.length === 0 && (
          <PortalCard style={{ padding: 18, color: "#8E8E93", fontSize: 13 }}>You're all caught up — {djName} has everything needed.</PortalCard>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 14, marginBottom: 14 }} className="cp-portal-split">
        <PortalCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Event snapshot</div>
            <TextLink brand={brand} onClick={() => setSection("timeline")}>Run of show →</TextLink>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {snapshot.map((s) => (
              <div key={s.label}>
                <Kicker>{s.label}</Kicker>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#16161A" }}>{s.value}</div>
                {s.sub && <div style={{ fontSize: 12, color: "#8E8E93", marginTop: 3 }}>{s.sub}</div>}
              </div>
            ))}
          </div>
        </PortalCard>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
          </PortalCard>
          <PortalCard style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: contract.signed ? "#E8F8EF" : tint(brand, 0.12),
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon d={ICONS.check} size={16} color={contract.signed ? "#16A34A" : brand} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{contract.signed ? "Contract signed" : "Contract"}</div>
              <div style={{ fontSize: 12, color: contract.signed ? "#16A34A" : "#8E8E93" }}>{contract.sub}</div>
            </div>
            <button type="button" onClick={() => setSection("documents")} aria-label="Open documents" style={{ background: "none", border: "none", cursor: "pointer", color: "#8E8E93" }}>
              <Icon d={ICONS.download} size={18} />
            </button>
          </PortalCard>
        </div>
      </div>

      {latestMessage && (
        <PortalCard style={{ marginBottom: 14 }}>
          <Kicker>Latest from {djName.split(" ")[0] || "your DJ"}</Kicker>
          <div style={{ fontSize: 14, color: "#3F3F46", lineHeight: 1.55 }}>{latestMessage}</div>
          <TextLink brand={brand} onClick={() => setSection("messages")} style={{ marginTop: 10 }}>Reply →</TextLink>
        </PortalCard>
      )}

      <PortalCard style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px" }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: brand,
          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800,
        }}>{initials(djName)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>{profile.fullName || profile.djName || djName}</div>
          <div style={{ fontSize: 12, color: "#8E8E93" }}>
            {[profile.phone, profile.email].filter(Boolean).join(" · ") || "Your DJ for this event"}
          </div>
        </div>
        {profile.phone && (
          <TextLink brand={brand} onClick={() => { window.location.href = `tel:${profile.phone}`; }}>Call</TextLink>
        )}
      </PortalCard>

      <button
        type="button"
        onClick={() => setSection("messages")}
        style={{
          position: "fixed", right: 28, bottom: 28, zIndex: 40,
          background: brand, color: "#fff", border: "none", borderRadius: PILL,
          padding: "14px 22px", fontWeight: 800, fontSize: 14, fontFamily: FONT, cursor: "pointer",
          boxShadow: `0 12px 28px ${tint(brand, 0.4)}`,
          display: "inline-flex", alignItems: "center", gap: 8,
        }}
      >
        <Icon d={ICONS.messages} size={16} color="#fff" /> Message
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Payments                                                             */
/* ------------------------------------------------------------------ */
function PaymentsPage({ brand, money, invoices, allowPayments, profile, djName }) {
  const history = paymentHistory(invoices);
  const dueInv = (invoices || []).find((i) => i.status !== "Paid") || invoices?.[0];
  return (
    <div>
      <PageHead title="Payments" subtitle="Your balance, history, and receipts — all in one place." />
      <PortalCard style={{ marginBottom: 16 }}>
        <Kicker>Balance due</Kicker>
        <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1 }}>{dollars(money.due)}</div>
        <div style={{ fontSize: 13, color: "#8E8E93", marginTop: 6 }}>
          {money.due > 0
            ? `Due by ${dueInv?.due || formatEventDate(money.dueDate) || "your event"}`
            : "You're paid in full"}
        </div>
        <div style={{ margin: "18px 0 8px" }}>
          <ProgressBar pct={money.total ? (money.paid / money.total) * 100 : 0} brand={brand} height={10} gradient="linear-gradient(90deg, #60A5FA, #2563EB)" />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#8E8E93", marginBottom: 18 }}>
          <span>Paid <strong style={{ color: "#16161A" }}>{dollars(money.paid)}</strong></span>
          <span>Total <strong style={{ color: "#16161A" }}>{dollars(money.total)}</strong></span>
        </div>
        {money.due > 0 && (
          allowPayments ? (
            <PrimaryBtn brand={brand} style={{ width: "100%" }} onClick={() => {
              if (profile.email) window.location.href = `mailto:${profile.email}?subject=${encodeURIComponent("Payment for " + (money.eventName || "event"))}`;
              else if (profile.phone) window.location.href = `tel:${profile.phone}`;
            }}>
              Pay balance · {dollars(money.due)}
            </PrimaryBtn>
          ) : (
            <div style={{
              background: "#F6F6FA", borderRadius: 12, padding: "12px 14px", fontSize: 13, color: "#5A5A62", lineHeight: 1.5,
            }}>
              Online checkout isn’t enabled yet. Contact {djName} to pay the remaining {dollars(money.due)}.
            </div>
          )
        )}
      </PortalCard>

      <PortalCard>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Payment history</div>
        {history.length === 0 && <div style={{ fontSize: 13, color: "#8E8E93", padding: "8px 0" }}>No payments recorded yet.</div>}
        {history.map((row, i) => (
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
            {row.paid && (
              <TextLink brand={brand} onClick={() => window.print()}>Receipt</TextLink>
            )}
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
  return (
    <div>
      <PageHead
        title="Event questionnaire"
        subtitle="The little details that make your night yours."
        right={
          <div style={{
            background: tint(brand, 0.12), color: brand, fontWeight: 800, fontSize: 13,
            padding: "8px 14px", borderRadius: PILL,
          }}>
            {answeredCount}/{total} complete
          </div>
        }
      />
      {questions.length === 0 ? (
        <PortalCard><div style={{ fontSize: 14, color: "#8E8E93" }}>Your DJ hasn’t assigned a questionnaire yet.</div></PortalCard>
      ) : (
        <PortalCard style={{ padding: "28px 28px 32px" }}>
          {(sections || []).map((sec) => {
            const qs = questions.filter((q) => (q.section || "General") === sec.id);
            if (!qs.length) return null;
            return (
              <div key={sec.id} style={{ marginBottom: 28 }}>
                <Kicker>{sec.label || sec.id}</Kicker>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 10 }} className="cp-portal-split">
                  {qs.map((q) => {
                    const wide = String(q.type || "").toLowerCase() === "textarea" || String(q.q || "").length > 42;
                    return (
                      <div key={q.id} style={{ gridColumn: wide ? "1 / -1" : "auto" }}>
                        <Field label={q.q}>
                          <PortalQuestionField
                            q={q}
                            value={answers[q.id]?.answer || ""}
                            onChange={(val) => onSave(q.id, val)}
                            brand={brand}
                            iStyle={iStyle}
                            QuestionAnswerInput={QuestionAnswerInput}
                          />
                        </Field>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </PortalCard>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Documents                                                            */
/* ------------------------------------------------------------------ */
function DocumentsPage({ brand, money, contract, invoices, setSection, setShowContractModal, packageInfo }) {
  return (
    <div>
      <PageHead title="Documents & package" subtitle="Your coverage, contract, and invoices." />
      <div style={{
        borderRadius: CARD_R, padding: "26px 28px", marginBottom: 16, color: "#fff",
        background: `linear-gradient(100deg, ${brand} 0%, #5B7CFF 100%)`,
        boxShadow: `0 12px 32px ${tint(brand, 0.28)}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div>
            <div style={{ ...TYPE.label, opacity: 0.85, marginBottom: 8 }}>Your package</div>
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.03em" }}>{packageInfo.name}</div>
            {packageInfo.duration && <div style={{ fontSize: 14, opacity: 0.9, marginTop: 6 }}>{packageInfo.duration}</div>}
          </div>
          <div style={{ fontWeight: 800, fontSize: 14, opacity: 0.95, whiteSpace: "nowrap" }}>{dollars(money.total)} total · all in</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px", marginTop: 18 }}>
          {packageInfo.includes.map((f) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
              <Icon d={ICONS.check} size={15} color="#fff" /> {f}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 14 }} className="cp-portal-split">
        <PortalCard>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 14 }}>Contract</div>
          <div style={{ background: "#F6F6FA", borderRadius: 14, padding: 16, marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{contract.title}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, color: contract.signed ? "#16A34A" : "#8E8E93", fontSize: 13, fontWeight: 700 }}>
              <Icon d={ICONS.check} size={14} color={contract.signed ? "#16A34A" : "#8E8E93"} />
              {contract.sub}
            </div>
            {contract.date && <div style={{ fontSize: 12, color: "#8E8E93", marginTop: 6 }}>{contract.date}</div>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setShowContractModal(true)} style={{
              flex: 1, background: tint(brand, 0.1), color: brand, border: "none", borderRadius: 12,
              padding: "11px 12px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FONT,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <Icon d={ICONS.eye} size={15} color={brand} /> View
            </button>
            <button type="button" onClick={() => setShowContractModal(true)} style={{
              flex: 1, background: tint(brand, 0.1), color: brand, border: "none", borderRadius: 12,
              padding: "11px 12px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FONT,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <Icon d={ICONS.download} size={15} color={brand} /> Download
            </button>
          </div>
        </PortalCard>

        <PortalCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Invoices</div>
            <TextLink brand={brand} onClick={() => setSection("payment")}>Go to payments →</TextLink>
          </div>
          {(invoices || []).length === 0 && <div style={{ fontSize: 13, color: "#8E8E93", padding: "12px 0" }}>No invoices yet.</div>}
          {(invoices || []).map((inv, i) => {
            const paid = inv.status === "Paid";
            return (
              <div key={inv.id || i} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 0",
                borderTop: i === 0 ? "none" : "1px solid #F0F0F5",
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#F6F6FA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon d={ICONS.documents} size={15} color="#8E8E93" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{invoiceTitle(inv)}</div>
                  <div style={{ fontSize: 11, color: "#8E8E93" }}>{inv.id ? `INV ${inv.id}` : ""}{inv.issued ? ` · ${inv.issued}` : ""}</div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: PILL,
                  background: paid ? "#E8F8EF" : "#FFF4E8", color: paid ? "#15803D" : "#C2410C",
                }}>{paid ? "Paid" : "Due"}</span>
                <div style={{ fontWeight: 800, fontSize: 14, minWidth: 64, textAlign: "right" }}>{dollars(inv.amount)}</div>
              </div>
            );
          })}
        </PortalCard>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Run of show                                                          */
/* ------------------------------------------------------------------ */
function TimelinePage({ brand, items, onRequestChange, editingId, setEditingId, buf, setBuf, onSave, iStyle }) {
  const dots = ["#C4B5FD", "#A78BFA", "#8B5CF6", "#7C3AED", "#6D28D9", "#DB2777"];
  return (
    <div>
      <PageHead
        title="Run of show"
        subtitle="How the night flows. Review it and tell your DJ anything you'd change."
        right={
          <button type="button" onClick={onRequestChange} style={{
            background: "#fff", border: "1px solid #E6E6EE", borderRadius: 12, padding: "10px 14px",
            fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FONT, color: "#16161A",
          }}>Request a change</button>
        }
      />
      <PortalCard>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: "#8E8E93" }}>Locks 7 days before the event · last edited by your DJ</div>
          <div style={{ background: tint(brand, 0.12), color: brand, fontWeight: 800, fontSize: 12, padding: "5px 12px", borderRadius: PILL }}>
            Draft · please review
          </div>
        </div>
        {(!items || items.length === 0) && (
          <div style={{ fontSize: 14, color: "#8E8E93" }}>Your DJ hasn’t published a run of show yet.</div>
        )}
        <div style={{ position: "relative" }}>
          {items.map((item, idx) => {
            const id = item.id || idx;
            const isEditing = editingId === id;
            const color = dots[idx % dots.length];
            return (
              <div key={id} style={{ display: "grid", gridTemplateColumns: "88px 18px 1fr", gap: 12, paddingBottom: 22 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#8E8E93", paddingTop: 2 }}>{item.time || "—"}</div>
                <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
                  {idx < items.length - 1 && (
                    <div style={{ position: "absolute", top: 12, bottom: -22, width: 2, background: "#EEEFF4" }} />
                  )}
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, marginTop: 5, position: "relative", zIndex: 1 }} />
                </div>
                <div>
                  {!isEditing ? (
                    <div onClick={() => { setEditingId(id); setBuf({ ...item }); }} style={{ cursor: "pointer" }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "#16161A" }}>{item.event}</div>
                      {item.note && <div style={{ fontSize: 13, color: "#8E8E93", marginTop: 3 }}>{item.note}</div>}
                      {item.song && <div style={{ fontSize: 12, color: "#8E8E93", marginTop: 3 }}>♫ {item.song}</div>}
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <input value={buf.time || ""} onChange={(e) => setBuf((p) => ({ ...p, time: e.target.value }))} placeholder="Time" style={{ ...iStyle, width: 100 }} />
                        <input value={buf.event || ""} onChange={(e) => setBuf((p) => ({ ...p, event: e.target.value }))} placeholder="Moment" style={{ ...iStyle, flex: 1 }} />
                      </div>
                      <input value={buf.note || ""} onChange={(e) => setBuf((p) => ({ ...p, note: e.target.value }))} placeholder="Note" style={{ ...iStyle, marginBottom: 8 }} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <PrimaryBtn brand={brand} onClick={() => onSave(id)} style={{ padding: "8px 14px", boxShadow: "none" }}>Save</PrimaryBtn>
                        <button type="button" onClick={() => setEditingId(null)} style={{ background: "#F6F6FA", border: "1px solid #E6E6EE", borderRadius: 10, padding: "8px 14px", fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>Cancel</button>
                      </div>
                    </div>
                  )}
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
function MusicPage({
  brand, iStyle, specialSections, playlistSections, openSections, setOpenSections,
  onPickSpecial, onClearSpecial, onAddPlaylist, requests, onAddMust, onAddSkip, onRemoveRequest,
  mustPlay, setMustPlay, doNotPlay, setDoNotPlay, isMustPlayType, isDoNotPlayType,
  PortalSpotifySearch, eventId, token,
}) {
  const SongSearch = PortalSpotifySearch;
  return (
    <div>
      <PageHead title="Music" subtitle="Key-moment songs, playlists, and must / do-not-play lists." />
      {specialSections.length > 0 && (
        <PortalCard style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Key-moment songs</div>
          <div style={{ fontSize: 13, color: "#8E8E93", marginBottom: 16 }}>Pick the songs that mark the night.</div>
          {specialSections.map((sec) => (
            <div key={sec.id} style={{ marginBottom: 12, padding: 14, background: "#F8F8FB", borderRadius: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>{sec.name}</div>
              {sec.song?.title ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {sec.song.albumArt && <img src={sec.song.albumArt} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{sec.song.title}</div>
                    {sec.song.artist && <div style={{ fontSize: 12, color: "#8E8E93" }}>{sec.song.artist}</div>}
                  </div>
                  <button type="button" onClick={() => onClearSpecial(sec.id)} style={{ background: "none", border: "none", color: "#A1A1AA", cursor: "pointer", fontSize: 18 }}>×</button>
                </div>
              ) : (
                <SongSearch
                  placeholder={`Search for your ${sec.name} song...`}
                  onAdd={(song) => onPickSpecial(sec.id, song)}
                  eventId={eventId}
                  token={token}
                  brandColor={brand}
                  iStyle={iStyle}
                />
              )}
            </div>
          ))}
        </PortalCard>
      )}

      {playlistSections.map((sec) => (
        <PortalCard key={sec.id} style={{ marginBottom: 14 }}>
          <button type="button" onClick={() => setOpenSections((p) => ({ ...p, [sec.id]: !p[sec.id] }))} style={{
            width: "100%", background: "none", border: "none", display: "flex", justifyContent: "space-between",
            fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: FONT, padding: 0, color: "#16161A",
          }}>
            {sec.name} <span style={{ color: "#A1A1AA" }}>{openSections[sec.id] !== false ? "▲" : "▼"}</span>
          </button>
          {openSections[sec.id] !== false && (
            <div style={{ marginTop: 12 }}>
              {(sec.songs || []).map((song) => (
                <div key={song.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
                  {song.albumArt && <img src={song.albumArt} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{song.title}</div>
                    {song.artist && <div style={{ fontSize: 11, color: "#8E8E93" }}>{song.artist}</div>}
                  </div>
                </div>
              ))}
              <SongSearch
                placeholder={`Add a song to ${sec.name}...`}
                onAdd={(song) => onAddPlaylist(sec.id, song)}
                eventId={eventId}
                token={token}
                brandColor={brand}
                iStyle={iStyle}
              />
            </div>
          )}
        </PortalCard>
      ))}

      <PortalCard>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Must play & skip</div>
        <div style={{ fontSize: 13, color: "#8E8E93", marginBottom: 16 }}>Your DJ sees these in real time.</div>
        <Kicker color="#16A34A">Must play</Kicker>
        <SongSearch placeholder="Search Spotify..." onAdd={(song) => onAddMust(song)} eventId={eventId} token={token} brandColor={brand} iStyle={iStyle} />
        <div style={{ display: "flex", gap: 8, margin: "8px 0 16px" }}>
          <input value={mustPlay} onChange={(e) => setMustPlay(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && mustPlay.trim()) { onAddMust({ title: mustPlay.trim() }); setMustPlay(""); } }}
            placeholder="Or type a song..." style={{ ...iStyle, flex: 1 }} />
          <PrimaryBtn brand={brand} onClick={() => { if (mustPlay.trim()) { onAddMust({ title: mustPlay.trim() }); setMustPlay(""); } }} style={{ boxShadow: "none" }}>Add</PrimaryBtn>
        </div>
        <Kicker color="#DC2626">Do not play</Kicker>
        <SongSearch placeholder="Search a song to skip..." onAdd={(song) => onAddSkip(song)} eventId={eventId} token={token} brandColor="#DC2626" iStyle={iStyle} />
        <div style={{ display: "flex", gap: 8, margin: "8px 0 16px" }}>
          <input value={doNotPlay} onChange={(e) => setDoNotPlay(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && doNotPlay.trim()) { onAddSkip({ title: doNotPlay.trim() }); setDoNotPlay(""); } }}
            placeholder="Or type a song..." style={{ ...iStyle, flex: 1 }} />
          <PrimaryBtn brand="#DC2626" onClick={() => { if (doNotPlay.trim()) { onAddSkip({ title: doNotPlay.trim() }); setDoNotPlay(""); } }} style={{ boxShadow: "none" }}>Add</PrimaryBtn>
        </div>
        {(requests || []).map((r) => (
          <div key={r.id} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, marginBottom: 6,
            background: isMustPlayType(r.type) ? "#F0FDF4" : "#FEF2F2",
          }}>
            {r.albumArt && <img src={r.albumArt} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{r.song}</div>
              {r.artist && <div style={{ fontSize: 11, color: "#8E8E93" }}>{r.artist}</div>}
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, color: isMustPlayType(r.type) ? "#16A34A" : "#DC2626" }}>
              {isMustPlayType(r.type) ? "MUST" : isDoNotPlayType(r.type) ? "SKIP" : "REQ"}
            </span>
            <button type="button" onClick={() => onRemoveRequest(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#A1A1AA", fontSize: 16 }}>×</button>
          </div>
        ))}
      </PortalCard>
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
    allowPayments,
    money, contract, invoices,
    questionnaire,
    specialSections, playlistSections, requests,
    openSections, setOpenSections,
    onPickSpecial, onClearSpecial, onAddPlaylist,
    mustPlay, setMustPlay, doNotPlay, setDoNotPlay,
    onAddMust, onAddSkip, onRemoveRequest, isMustPlayType, isDoNotPlayType,
    timelineItems, editingTimelineItem, setEditingTimelineItem, timelineEditBuf, setTimelineEditBuf, onSaveTimeline,
    showContractModal, setShowContractModal, signPortalContract,
    QuestionAnswerInput, PortalSpotifySearch, PortalContractSection,
    iStyle,
  } = props;

  const brand = brandColor || "#6C4DF6";
  const [navOpen, setNavOpen] = useState(false);
  const [unread, setUnread] = useState(1);
  const [couplePhoto, setCouplePhoto] = useState(() => loadLocal(`cuepoint_portal_photo_${token}`, ""));

  const clientName = ev.client || ev.name || "Your event";
  const clientInitials = initials(clientName);
  const days = daysUntil(ev.date);
  const signedInAs = String(clientName).split(/&|\band\b/i)[0].trim().split(" ")[0] || clientName;

  const qTotal = questionnaire.total || 0;
  const qAnswered = questionnaire.answeredCount || 0;
  const qLeft = Math.max(0, qTotal - qAnswered);
  const specialTotal = specialSections.length;
  const specialChosen = specialSections.filter((s) => s.song?.title).length;
  const specialLeft = Math.max(0, specialTotal - specialChosen);

  const readyBits = [];
  if (qTotal) readyBits.push(qAnswered / qTotal);
  if (specialTotal) readyBits.push(specialChosen / specialTotal);
  if (money.total) readyBits.push(Math.min(1, money.paid / money.total));
  if (contract.exists) readyBits.push(contract.signed ? 1 : 0);
  const readyPct = readyBits.length ? Math.round((readyBits.reduce((a, b) => a + b, 0) / readyBits.length) * 100) : 56;

  const tasks = [];
  if (qTotal && qLeft > 0) {
    tasks.push({
      id: "q", title: "Event questionnaire", sub: `${qAnswered} of ${qTotal} answered`,
      pct: qTotal ? (qAnswered / qTotal) * 100 : 0, section: "questionnaire",
      cta: "link", ctaLabel: "Resume", icon: ICONS.questionnaire, color: brand,
    });
  }
  if (money.due > 0) {
    tasks.push({
      id: "pay", title: "Final balance due", sub: `${dollars(money.due)} · due ${(invoices || []).find((i) => i.status !== "Paid")?.due || formatEventDate(ev.date) || "soon"}`,
      section: "payment", cta: "button", ctaLabel: "Pay now", icon: ICONS.card, color: "#EA580C",
    });
  }
  if (specialLeft > 0) {
    tasks.push({
      id: "music", title: "Pick your key-moment songs", sub: `${specialChosen} of ${specialTotal} chosen`,
      section: "music", cta: "link", ctaLabel: "Choose", icon: ICONS.music, color: brand,
    });
  }

  const nextUp = qLeft > 0
    ? { title: "Finish your event questionnaire", sub: `${qLeft} answer${qLeft === 1 ? "" : "s"} left — about two minutes.`, section: "questionnaire" }
    : money.due > 0
      ? { title: "Pay your remaining balance", sub: `${dollars(money.due)} still due before the event.`, section: "payment" }
      : specialLeft > 0
        ? { title: "Pick your key-moment songs", sub: `${specialLeft} still need a song.`, section: "music" }
        : { title: "You're all set", sub: "Review your run of show anytime.", section: "timeline" };

  const venue = ev.venueFull?.name || ev.venue || "TBD";
  const venueSub = [ev.venueFull?.city, ev.venueFull?.state].filter(Boolean).join(", ") || ev.city || "";
  const snapshot = [
    { label: "Venue", value: venue, sub: venueSub },
    { label: "Date", value: formatEventDate(ev.date, { weekday: "short", month: "long", day: "numeric", year: "numeric" }) || "TBD", sub: ev.startTime ? `Doors ${formatDisplayTime(ev.startTime)}` : "" },
    { label: "DJ set", value: (ev.startTime || ev.endTime) ? formatTimeRange(ev.startTime, ev.endTime) : (ev.hours || "TBD") },
    { label: "Your DJ", value: profile.fullName || profile.djName || djName },
  ];

  const packageInfo = useMemo(() => {
    const name = ev.package || ev.packageName || "Your reception package";
    const range = (ev.startTime || ev.endTime) ? formatTimeRange(ev.startTime, ev.endTime) : "";
    const duration = range
      ? `${range}${ev.startTime && ev.endTime ? ` · ${formatDisplayTime(ev.startTime)} to ${formatDisplayTime(ev.endTime)}` : ""}`
      : ev.hours || "";
    const includes = [
      ...(ev.selectedAddons || []).map((a) => a.name || a).filter(Boolean),
    ];
    const list = includes.length ? includes : FALLBACK_INCLUDES;
    return { name, duration, includes: list.slice(0, 8) };
  }, [ev]);

  const nav = [
    { id: "home", label: "Overview", icon: ICONS.overview },
    { id: "timeline", label: "Run of show", icon: ICONS.timeline },
    { id: "music", label: "Music", icon: ICONS.music, badge: specialLeft || null },
    { id: "questionnaire", label: "Questionnaire", icon: ICONS.questionnaire, badge: qLeft || null },
    { id: "payment", label: "Payments", icon: ICONS.payments, badge: money.due > 0 ? 1 : null },
    { id: "documents", label: "Documents", icon: ICONS.documents },
    { id: "messages", label: "Messages", icon: ICONS.messages, badge: unread || null },
  ];

  const go = (id) => { setSection(id); setNavOpen(false); };

  const sidebar = (
    <aside style={{
      width: 248, flexShrink: 0, background: "#fff", borderRight: "1px solid #EEEFF3",
      display: "flex", flexDirection: "column", padding: "22px 16px 16px", minHeight: "100%",
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
          const active = section === item.id || (item.id === "home" && section === "contract");
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
          {formatEventDate(ev.date, { weekday: "long", month: "long", day: "numeric" })}
          {ev.startTime ? ` · ${formatDisplayTime(ev.startTime)}` : ""}
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
        <button type="button" onClick={() => go("messages")} aria-label="Open messages" style={{
          width: 32, height: 32, borderRadius: 10, background: tint(brand, 0.12), border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", color: brand,
        }}>
          <Icon d={ICONS.messages} size={15} color={brand} />
        </button>
      </div>
    </aside>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F4F4F8", fontFamily: FONT, color: "#16161A" }}>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <div className="cp-portal-sidebar" style={{ display: "flex" }}>{sidebar}</div>
        {navOpen && (
          <div onClick={() => setNavOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(22,22,26,0.35)", zIndex: 50, display: "flex" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ height: "100%" }}>{sidebar}</div>
          </div>
        )}
        <main style={{ flex: 1, minWidth: 0, padding: "28px 32px 80px" }}>
          <button type="button" className="cp-portal-menu" onClick={() => setNavOpen(true)} style={{
            display: "none", marginBottom: 16, background: "#fff", border: "1px solid #E6E6EE",
            borderRadius: 10, padding: "8px 12px", fontWeight: 700, fontFamily: FONT, cursor: "pointer",
          }}>Menu</button>

          {section === "home" && (
            <OverviewPage
              ev={ev} brand={brand} djName={djName} profile={profile} headingFont={headingFont}
              coverPhoto={coverPhoto} couplePhoto={couplePhoto}
              onCouplePhoto={(src) => { setCouplePhoto(src); saveLocal(`cuepoint_portal_photo_${token}`, src); }}
              clientName={clientName} clientInitials={clientInitials} days={days}
              readyPct={readyPct} nextUp={nextUp} tasks={tasks} snapshot={snapshot}
              money={money} contract={contract} setSection={setSection} allowPayments={allowPayments}
              latestMessage={(loadLocal(`cuepoint_portal_msgs_${token}`, []) || []).filter((m) => m.from === "dj").slice(-1)[0]?.text || ""}
            />
          )}
          {section === "payment" && (
            <PaymentsPage brand={brand} money={money} invoices={invoices} allowPayments={allowPayments} profile={profile} djName={djName} />
          )}
          {section === "questionnaire" && (
            <QuestionnairePage brand={brand} iStyle={iStyle} questionnaire={questionnaire} QuestionAnswerInput={QuestionAnswerInput} />
          )}
          {section === "documents" && (
            <DocumentsPage
              brand={brand} money={money} contract={contract} invoices={invoices}
              setSection={setSection} setShowContractModal={setShowContractModal} packageInfo={packageInfo}
            />
          )}
          {section === "timeline" && (
            <TimelinePage
              brand={brand} items={timelineItems} iStyle={iStyle}
              editingId={editingTimelineItem} setEditingId={setEditingTimelineItem}
              buf={timelineEditBuf} setBuf={setTimelineEditBuf}
              onSave={onSaveTimeline}
              onRequestChange={() => setSection("messages")}
            />
          )}
          {section === "music" && (
            <MusicPage
              brand={brand} iStyle={iStyle} eventId={eventId} token={token}
              specialSections={specialSections} playlistSections={playlistSections}
              openSections={openSections} setOpenSections={setOpenSections}
              onPickSpecial={onPickSpecial} onClearSpecial={onClearSpecial} onAddPlaylist={onAddPlaylist}
              requests={requests} onAddMust={onAddMust} onAddSkip={onAddSkip} onRemoveRequest={onRemoveRequest}
              mustPlay={mustPlay} setMustPlay={setMustPlay} doNotPlay={doNotPlay} setDoNotPlay={setDoNotPlay}
              isMustPlayType={isMustPlayType} isDoNotPlayType={isDoNotPlayType}
              PortalSpotifySearch={PortalSpotifySearch}
            />
          )}
          {section === "messages" && (
            <MessagesPage brand={brand} djName={djName} profile={profile} token={token} clientName={clientName} setUnread={setUnread} />
          )}
          {section === "contract" && PortalContractSection && (
            <PortalContractSection evContracts={props.contracts} iStyle={iStyle} brandColor={brand} onSignContract={signPortalContract} setSection={setSection} />
          )}
        </main>
      </div>

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
          .cp-portal-menu { display: inline-flex !important; }
        }
        @media (max-width: 720px) {
          main { padding: 16px 14px 88px !important; }
          .cp-portal-split { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
