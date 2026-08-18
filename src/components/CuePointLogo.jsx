import { BRAND_ACCENT, BRAND_INK, BRAND_FONT } from "../brand";
import { CUE_MARK_PATH, CUE_MARK_BARS, CUE_LOCKUP_GAP } from "../cueMark";

export function CueMark({ size = 32, tileFill = BRAND_ACCENT, barFill = "#FFFFFF" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 66 66"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: "block" }}
      aria-hidden="true"
    >
      <path d={CUE_MARK_PATH} fill={tileFill} />
      {CUE_MARK_BARS.map((b) => (
        <rect
          key={`${b.x}-${b.y}`}
          x={b.x}
          y={b.y}
          width={b.width}
          height={b.height}
          rx={b.width / 2}
          fill={barFill}
        />
      ))}
    </svg>
  );
}

export default function CuePointLogo({
  size = 48,
  showText = false,
  textSize = 22,
  textColor,
  variant = "light",
}) {
  const onDark = variant === "dark";
  const tileFill = onDark ? "#FFFFFF" : BRAND_ACCENT;
  const barFill = onDark ? BRAND_ACCENT : "#FFFFFF";
  const wordColor = textColor || (onDark ? "#FFFFFF" : BRAND_INK);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: showText ? size * CUE_LOCKUP_GAP : 0 }}>
      <CueMark size={size} tileFill={tileFill} barFill={barFill} />
      {showText && (
        <div style={{
          fontSize: textSize,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: wordColor,
          lineHeight: 1,
          fontFamily: BRAND_FONT,
        }}>
          CuePoint
        </div>
      )}
    </div>
  );
}
