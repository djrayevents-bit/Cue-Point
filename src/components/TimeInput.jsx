import { useEffect, useState } from "react";
import {
  TIME_FORMAT_24,
  to24HourString,
  parseToParts,
  partsTo24Hour,
} from "../timeFormat";
import { LIGHT_THEME as C, BRAND_FONT } from "../brand";

const defaultInputStyle = {
  background: C.surfaceAlt,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: "10px 14px",
  color: C.text,
  fontSize: 14,
  fontFamily: BRAND_FONT,
  outline: "none",
  boxSizing: "border-box",
};

const TwelveHourPicker = ({ value, onChange, disabled, iStyle }) => {
  const [parts, setParts] = useState(() => parseToParts(value));

  useEffect(() => {
    setParts(parseToParts(value));
  }, [value]);

  const emit = (next) => {
    setParts(next);
    onChange(partsTo24Hour(next));
  };

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", opacity: disabled ? 0.45 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      <input
        value={parts.hour}
        onChange={(e) => emit({ ...parts, hour: e.target.value })}
        placeholder="6"
        maxLength={2}
        disabled={disabled}
        style={{ ...iStyle, width: 44, padding: "8px 6px", textAlign: "center", fontSize: 14, fontWeight: 700 }}
      />
      <span style={{ color: C.muted, fontWeight: 700, fontSize: 16 }}>:</span>
      <input
        value={parts.minute}
        onChange={(e) => emit({ ...parts, minute: e.target.value })}
        placeholder="00"
        maxLength={2}
        disabled={disabled}
        style={{ ...iStyle, width: 44, padding: "8px 6px", textAlign: "center", fontSize: 14, fontWeight: 700 }}
      />
      <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}`, flexShrink: 0 }}>
        {["AM", "PM"].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => emit({ ...parts, ampm: p })}
            disabled={disabled}
            style={{
              padding: "8px 10px",
              fontSize: 12,
              fontWeight: 700,
              cursor: disabled ? "not-allowed" : "pointer",
              background: parts.ampm === p ? C.accent : C.surfaceAlt,
              color: parts.ampm === p ? "#fff" : C.muted,
              border: "none",
              fontFamily: BRAND_FONT,
              transition: "all 0.1s",
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
};

export default function TimeInput({ value, onChange, disabled, style, inputStyle, timeFormat }) {
  const iStyle = { ...defaultInputStyle, ...inputStyle };

  if (timeFormat === TIME_FORMAT_24) {
    return (
      <input
        type="time"
        value={to24HourString(value) || ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{ ...iStyle, ...style }}
      />
    );
  }

  return (
    <TwelveHourPicker
      value={value}
      onChange={onChange}
      disabled={disabled}
      iStyle={iStyle}
    />
  );
}
