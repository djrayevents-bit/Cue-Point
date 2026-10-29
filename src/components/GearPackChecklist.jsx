import { groupEquipmentByCategory, idsInclude } from "../gearPack";

const LEGS = [
  {
    id: "toEvent",
    label: "Pickup rental",
    title: "Pack for pickup",
    blurb: "Pack gear going out for the renter.",
  },
  {
    id: "toHome",
    label: "Drop off",
    title: "Pack for drop-off",
    blurb: "Pack or check gear coming back.",
  },
];

export function GearPackChecklist({ C, items, leg, onLeg, loadedIds, onToggle }) {
  const list = items || [];
  const still = list.filter((item) => !idsInclude(loadedIds, item.id));
  const loaded = list.filter((item) => idsInclude(loadedIds, item.id));
  const active = LEGS.find((choice) => choice.id === leg) || null;

  if (!active) {
    return (
      <div>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>What are you doing?</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.45 }}>
          Choose pickup or drop-off first, then scan tags to check gear off the list.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {LEGS.map((choice) => (
            <button
              key={choice.id}
              type="button"
              onClick={() => onLeg(choice.id)}
              style={{
                width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                padding: "16px 16px", borderRadius: 14,
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
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 2 }}>{active.title}</div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.4 }}>{active.blurb}</div>
        </div>
        <button
          type="button"
          onClick={() => onLeg(null)}
          style={{
            flexShrink: 0, background: "none", border: "none", color: C.accent,
            fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: "4px 0",
          }}
        >Change</button>
      </div>
      <div style={{
        background: C.accent + "12", border: `1px solid ${C.accent}33`, borderRadius: 14,
        padding: "12px 14px", marginBottom: 16,
      }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Ready for tags</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.45 }}>
          {still.length === 0 && list.length > 0
            ? "Everything on this list is loaded."
            : `${still.length} still to pack · ${loaded.length} loaded. Hold the phone on a tag to check that item off.`}
        </div>
      </div>
      {list.length === 0 ? (
        <div style={{ color: C.muted, fontSize: 14, padding: "8px 0 4px" }}>
          No equipment is assigned to this event yet. Assign gear, then come back to pack it.
        </div>
      ) : (
        <>
          <PackGroup C={C} title="Still to pack" items={still} loaded={false} onToggle={onToggle} empty="Nothing left to pack." />
          <PackGroup C={C} title="Loaded" items={loaded} loaded onToggle={onToggle} empty="Loaded gear shows up here." />
        </>
      )}
    </div>
  );
}

function PackGroup({ C, title, items, loaded, onToggle, empty }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: C.muted, marginBottom: 8 }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: C.muted, padding: "4px 0 8px" }}>{empty}</div>
      ) : groupEquipmentByCategory(items).map((group) => (
        <div key={group.category} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.text, margin: "8px 0 6px" }}>{group.category}</div>
          {group.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                padding: "12px 12px", marginBottom: 8, borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                border: `1px solid ${loaded ? C.green + "55" : C.border}`,
                background: loaded ? C.green + "12" : C.surface,
              }}
            >
              <span style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                border: `2px solid ${loaded ? C.green : C.border}`,
                background: loaded ? C.green : "transparent",
                color: "#fff", fontSize: 13, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center",
              }}>{loaded ? "✓" : ""}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 700, fontSize: 15, color: C.text }}>{item.name}</span>
                <span style={{ display: "block", fontSize: 12, color: C.muted, marginTop: 2 }}>{item.location || "No location"}{item.quantity ? ` · qty ${item.quantity}` : ""}</span>
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: loaded ? C.green : C.orange }}>{loaded ? "Loaded" : "Pack"}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
