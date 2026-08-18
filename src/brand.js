// CuePoint Brand & Style Guide v1.0 — single source of truth.
// Palette, type, radius, and component tokens from the official PDF.

export const BRAND_FONT = "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif";

export const BRAND_GRADIENT = "linear-gradient(135deg, #7B5CFF 0%, #5B7CFF 50%, #49A0FF 100%)";
export const BRAND_ACCENT = "#6C4DF6";
export const BRAND_ACCENT_SOFT = "#EFEBFF";
export const BRAND_INK = "#16161A";

export const BRAND_RADIUS = {
  icon: 9,
  field: 14,
  card: 22,
  pill: 999,
};

export const BRAND_SHADOW = {
  quiet: "0 1px 3px rgba(22, 22, 26, 0.04)",
  card: "0 8px 24px rgba(22, 22, 26, 0.06)",
  glow: "0 8px 20px rgba(108, 77, 246, 0.28)",
};

export const TYPE = {
  display: { fontSize: 56, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.05 },
  kicker: { fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" },
  pageTitle: { fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1 },
  sectionTitle: { fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1 },
  cardTitle: { fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" },
  body: { fontSize: 15, fontWeight: 400, lineHeight: 1.5 },
  desc: { fontSize: 15, fontWeight: 400, lineHeight: 1.5 },
  label: { fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" },
  small: { fontSize: 13, fontWeight: 600 },
  tableHead: { fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" },
};

export const LIGHT_THEME = {
  bg: "#F1F1F6",
  surface: "#FBFBFD",
  surfaceAlt: "#FFFFFF",
  surfaceHover: "#F4F4F8",
  border: "#EEEEF2",
  borderLight: "#F3F3F7",
  accent: BRAND_ACCENT,
  accentDim: BRAND_ACCENT_SOFT,
  accentGlow: "#6C4DF628",
  accentSoft: BRAND_ACCENT_SOFT,
  green: "#2FBF6B",
  purple: "#A056E8",
  orange: "#FF7A3C",
  yellow: "#CA8A04",
  red: "#DC2626",
  pink: "#EC4899",
  info: "#34A9E0",
  text: BRAND_INK,
  muted: "#8E8E93",
  mutedLight: "#AEAEB2",
  white: "#FFFFFF",
};

export const CATEGORY_TINTS = {
  events: { bg: "#FCE8F0", text: "#D63384" },
  clients: { bg: "#E8F4FC", text: "#2563EB" },
  money: { bg: "#E8F8EF", text: "#2FBF6B" },
  contracts: { bg: "#EFEBFF", text: "#6C4DF6" },
  planning: { bg: "#FFF4E8", text: "#EA580C" },
};
