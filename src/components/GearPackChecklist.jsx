import React, { useEffect, useMemo, useRef, useState } from "react";
import { groupEquipmentByCategory, idsInclude } from "../gearPack";
import { listEquipmentTags } from "../equipmentTagsApi";

const EVENT_LEGS = [
  {
    id: "toEvent",
    label: "Packing to Event",
    title: "Packing to Event",
    blurb: "Check off gear going out to the venue.",
  },
  {
    id: "toHome",
    label: "Packing to Office",
    title: "Packing to Office",
    blurb: "Check off gear coming back from the event.",
  },
];

const RENTAL_LEGS = [
  {
    id: "toEvent",
    label: "Pickup rental",
    title: "Pack for pickup",
    blurb: "Pack gear going out for the renter.",
  },
  {
    id: "toHome",
    label: "Drop off",
    title: "Pack for drop-off / return",
    blurb: "Pack or check gear coming back from the rental.",
  },
];

function formatNfcLabel(tagId) {
  const id = String(tagId || "").trim();
  if (!id) return null;
  const short = id.length > 4 ? id.slice(-4).toUpperCase() : id.toUpperCase();
  return `NFC · CP-${short}`;
}

function NfcGlyph({ size = 28, color = "#A78BFA" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 8.5c2.2-2.2 5.8-2.2 8 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.2 11c1.3-1.3 3.3-1.3 4.6 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10.3 13.5c.6-.6 1.6-.6 2.2 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.2" r="1.2" fill={color} />
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke={color} strokeWidth="1.4" opacity="0.35" />
    </svg>
  );
}

function PhoneGlyph({ size = 18, color = "#16161A" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" stroke={color} strokeWidth="1.7" />
      <path d="M10 5.5h4" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="18.2" r="1" fill={color} />
    </svg>
  );
}

export function GearPackChecklist({
  C,
  items,
  leg,
  onLeg,
  loadedIds,
  onToggle,
  variant = "event",
  onAddItem,
}) {
  const LEGS = variant === "rental" ? RENTAL_LEGS : EVENT_LEGS;
  const list = items || [];
  const still = list.filter((item) => !idsInclude(loadedIds, item.id));
  const loaded = list.filter((item) => idsInclude(loadedIds, item.id));
  const active = LEGS.find((choice) => choice.id === leg) || null;
  const packedCount = loaded.length;
  const totalCount = list.length;
  const pct = totalCount ? Math.round((packedCount / totalCount) * 100) : 0;

  const [scanOpen, setScanOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState("idle"); // idle | listening | got | unsupported | error
  const [scanMessage, setScanMessage] = useState("");
  const [tagByEquipmentId, setTagByEquipmentId] = useState({});
  const ndefRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    listEquipmentTags()
      .then((tags) => {
        if (cancelled) return;
        const map = {};
        (tags || []).forEach((tag) => {
          if (tag?.equipmentId) map[String(tag.equipmentId)] = tag;
        });
        setTagByEquipmentId(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!scanOpen) {
      try { ndefRef.current?.stop?.(); } catch { /* ignore */ }
      ndefRef.current = null;
      return undefined;
    }

    setScanStatus("listening");
    setScanMessage("Hold the top of your iPhone near the gear tag.");

    // Web NFC (Android Chrome). iOS uses system NFC → /t/:id while pack listen is active.
    const NDEF = typeof window !== "undefined" ? window.NDEFReader : null;
    if (!NDEF) {
      setScanStatus("listening");
      setScanMessage("Hold the top of your iPhone near the gear tag.");
      return undefined;
    }

    let cancelled = false;
    const reader = new NDEF();
    ndefRef.current = reader;
    (async () => {
      try {
        await reader.scan();
        if (cancelled) return;
        setScanStatus("listening");
        setScanMessage("Ready — hold near the gear tag.");
        reader.onreading = (event) => {
          const records = event?.message?.records || [];
          let url = "";
          for (const rec of records) {
            try {
              if (rec.recordType === "url" || rec.recordType === "absolute-url") {
                url = new TextDecoder().decode(rec.data);
              } else if (rec.recordType === "text") {
                url = new TextDecoder().decode(rec.data);
              }
            } catch { /* ignore */ }
          }
          const match = String(url || "").match(/\/t\/([a-z0-9]{10})/i)
            || String(url || "").match(/equipment-tag\/([a-z0-9]{10})/i);
          if (!match) {
            setScanStatus("error");
            setScanMessage("That tag isn’t a CuePoint gear tag.");
            return;
          }
          setScanStatus("got");
          setScanMessage("Tag read — checking it off…");
          window.location.hash = `#/equipment-tag/${match[1]}/work`;
        };
        reader.onreadingerror = () => {
          setScanStatus("error");
          setScanMessage("Couldn’t read that tag. Try again.");
        };
      } catch (err) {
        if (cancelled) return;
        setScanStatus("unsupported");
        setScanMessage(err?.message || "NFC isn’t available here. Tap the physical tag — CuePoint will check it off.");
      }
    })();

    return () => {
      cancelled = true;
      try { reader.onreading = null; reader.onreadingerror = null; } catch { /* ignore */ }
    };
  }, [scanOpen]);

  const groups = useMemo(
    () => groupEquipmentByCategory(list),
    [list],
  );

  if (!active) {
    return (
      <div>
        <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: "-0.03em", marginBottom: 6, color: C.text }}>
          Gear pack
        </div>
        <div style={{ fontSize: 14, color: C.muted, marginBottom: 18, lineHeight: 1.45 }}>
          {variant === "rental"
            ? "Choose pickup or drop-off, then scan tags to check gear off."
            : "Choose packing to event or office, then scan tags to check gear off."}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {LEGS.map((choice) => (
            <button
              key={choice.id}
              type="button"
              onClick={() => onLeg(choice.id)}
              style={{
                width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                padding: "16px 16px", borderRadius: 16,
                border: `1.5px solid ${C.border}`,
                background: C.surface,
              }}
            >
              <span style={{ display: "block", fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 4 }}>{choice.label}</span>
              <span style={{ display: "block", fontSize: 13, color: C.muted, lineHeight: 1.4 }}>{choice.blurb}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 26, letterSpacing: "-0.04em", color: C.text, lineHeight: 1.15 }}>Gear pack</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 1.4 }}>{active.blurb}</div>
        </div>
        <button
          type="button"
          onClick={() => onLeg(null)}
          style={{
            flexShrink: 0, background: "none", border: "none", color: C.accent,
            fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: "6px 0",
          }}
        >Change</button>
      </div>

      {/* Scan card */}
      <div style={{
        background: "#0B0B10",
        borderRadius: 22,
        padding: "20px 18px 16px",
        marginBottom: 18,
        color: "#fff",
        boxShadow: "0 16px 40px rgba(11,11,16,0.28)",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: "rgba(167,139,250,0.16)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 14,
        }}>
          <NfcGlyph size={26} color="#C4B5FD" />
        </div>
        <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.02em", marginBottom: 6 }}>Scan to pack</div>
        <div style={{ fontSize: 13, lineHeight: 1.45, color: "rgba(255,255,255,0.68)", marginBottom: 16 }}>
          Hold your iPhone near each case’s NFC tag to check it off.
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.75)" }}>
            Packed {packedCount} of {totalCount}
          </span>
          <span style={{ fontSize: 12, fontWeight: 800, color: packedCount === totalCount && totalCount ? "#4ADE80" : "#C4B5FD" }}>
            {pct}%
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 99, background: "rgba(255,255,255,0.12)", overflow: "hidden", marginBottom: 16 }}>
          <div style={{
            height: "100%", width: `${pct}%`, borderRadius: 99,
            background: packedCount === totalCount && totalCount
              ? "linear-gradient(90deg, #22C55E, #4ADE80)"
              : "linear-gradient(90deg, #7C3AED, #A78BFA)",
            transition: "width 0.25s ease",
          }} />
        </div>
        <button
          type="button"
          onClick={() => setScanOpen(true)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            padding: "14px 16px", borderRadius: 14, border: "none", cursor: "pointer",
            background: "#fff", color: "#16161A", fontWeight: 800, fontSize: 15, fontFamily: "inherit",
            minHeight: 48,
          }}
        >
          <PhoneGlyph /> Scan tag
        </button>
      </div>

      {list.length === 0 ? (
        <div style={{ color: C.muted, fontSize: 14, padding: "8px 0 4px", lineHeight: 1.45 }}>
          {variant === "rental"
            ? "No gear on this rental yet. Add gear, then come back to pack it."
            : "No equipment is assigned to this event yet. Assign gear, then come back to pack it."}
        </div>
      ) : (
        groups.map((group) => {
          const packedInGroup = group.items.filter((item) => idsInclude(loadedIds, item.id)).length;
          return (
            <div key={group.category} style={{ marginBottom: 20 }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "baseline",
                marginBottom: 10, gap: 10,
              }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{group.category}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>
                  {packedInGroup}/{group.items.length} packed
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {group.items.map((item) => {
                  const isPacked = idsInclude(loadedIds, item.id);
                  const tag = tagByEquipmentId[String(item.id)];
                  const nfcLabel = formatNfcLabel(tag?.id);
                  const sub = [
                    item.location || null,
                    item.quantity ? `Qty ${item.quantity}` : null,
                    nfcLabel,
                  ].filter(Boolean).join(" · ");
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onToggle(item.id)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                        padding: "14px 14px", borderRadius: 16, cursor: "pointer", fontFamily: "inherit",
                        border: `1px solid ${isPacked ? C.green + "40" : C.border}`,
                        background: isPacked ? C.green + "10" : C.surface,
                        minHeight: 64,
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontWeight: 800, fontSize: 15, color: C.text }}>{item.name}</span>
                        {sub ? (
                          <span style={{ display: "block", fontSize: 12, color: C.muted, marginTop: 3 }}>{sub}</span>
                        ) : (
                          <span style={{ display: "block", fontSize: 12, color: C.muted, marginTop: 3 }}>
                            {tag ? "NFC linked" : "No NFC tag yet"}
                          </span>
                        )}
                      </span>
                      <span style={{
                        flexShrink: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.02em",
                        padding: "6px 10px", borderRadius: 99,
                        background: isPacked ? C.green + "22" : C.surfaceAlt || "#F3F4F6",
                        color: isPacked ? C.green : C.muted,
                      }}>{isPacked ? "Packed" : "To pack"}</span>
                    </button>
                  );
                })}
              </div>
              {onAddItem && (
                <button
                  type="button"
                  onClick={onAddItem}
                  style={{
                    marginTop: 10, background: "none", border: "none", color: C.accent,
                    fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
                    display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 0", minHeight: 44,
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add item
                </button>
              )}
            </div>
          );
        })
      )}

      {still.length === 0 && list.length > 0 && (
        <div style={{
          marginTop: 4, padding: "14px 16px", borderRadius: 14,
          background: C.green + "14", border: `1px solid ${C.green}33`,
          fontWeight: 700, fontSize: 14, color: C.green,
        }}>
          Everything on this list is packed.
        </div>
      )}

      {scanOpen && (
        <ScanSheet
          C={C}
          status={scanStatus}
          message={scanMessage}
          onClose={() => setScanOpen(false)}
        />
      )}
    </div>
  );
}

function ScanSheet({ C, status, message, onClose }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan gear tag"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 400,
        background: "rgba(11,11,16,0.55)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: "16px 12px calc(16px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 420, background: "#fff", borderRadius: 24,
          padding: "28px 22px 22px", textAlign: "center",
          boxShadow: "0 24px 64px rgba(0,0,0,0.28)",
        }}
      >
        <div style={{ position: "relative", width: 140, height: 140, margin: "0 auto 18px" }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                position: "absolute", inset: i * 16,
                borderRadius: "50%",
                border: `2px solid ${C.accent}`,
                opacity: 0.22 + i * 0.18,
                animation: status === "listening" ? `cpNfcPulse 1.8s ease-out ${i * 0.25}s infinite` : "none",
              }}
            />
          ))}
          <div style={{
            position: "absolute", inset: 42, borderRadius: "50%",
            background: C.accent + "18",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <NfcGlyph size={36} color={C.accent} />
          </div>
        </div>
        <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: "-0.03em", color: C.text, marginBottom: 8 }}>
          {status === "got" ? "Got it" : status === "error" ? "Try again" : "Ready to scan"}
        </div>
        <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.5, marginBottom: 20 }}>
          {message || "Hold the top of your iPhone near the gear tag."}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: "100%", padding: "14px 16px", borderRadius: 14, border: "none",
            background: C.accent, color: "#fff", fontWeight: 800, fontSize: 15,
            cursor: "pointer", fontFamily: "inherit", minHeight: 48,
          }}
        >
          {status === "got" ? "Done" : "Close"}
        </button>
        <style>{`
          @keyframes cpNfcPulse {
            0% { transform: scale(0.92); opacity: 0.55; }
            70% { transform: scale(1.06); opacity: 0.12; }
            100% { transform: scale(1.1); opacity: 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            * { animation: none !important; }
          }
        `}</style>
      </div>
    </div>
  );
}
