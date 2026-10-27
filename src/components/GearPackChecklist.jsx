import { groupEquipmentByCategory, idsInclude } from "../gearPack";

const LEGS = [
  { id: "toEvent", label: "To the event" },
  { id: "toHome", label: "Home" },
];

export function GearPackChecklist({ C, items, leg, onLeg, loadedIds, onToggle }) {
  const list = items || [];
  const still = list.filter((item) => !idsInclude(loadedIds, item.id));
  const loaded = list.filter((item) => idsInclude(loadedIds, item.id));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {LEGS.map((choice) => {
          const active = leg === choice.id;
          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => onLeg(choice.id)}
              style={{
                flex: 1, minHeight: 44, borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                fontWeight: 800, fontSize: 14,
                border: `1.5px solid ${active ? C.accent : C.border}`,
                background: active ? C.accent + "18" : C.surfaceAlt,
                color: active ? C.accent : C.muted,
              }}
            >{choice.label}</button>
          );
        })}
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
