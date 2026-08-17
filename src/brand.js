// CuePoint Brand & Style Guide v1.1 — single source of truth for tokens.
// Visual language matches Account & Brand: white cards, purple accent, uppercase labels.

export const BRAND_FONT = "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif";

export const BRAND_GRADIENT = "linear-gradient(135deg, #7B5CFF 0%, #5B7CFF 50%, #49A0FF 100%)";
export const BRAND_ACCENT = "#6C4DF6";
export const BRAND_ACCENT_SOFT = "#EFEBFF";
export const BRAND_INK = "#16161A";

export const BRAND_RADIUS = {
  icon: 10,
  field: 12,
  card: 18,
  pill: 999,
};

export const TYPE = {
  kicker: { fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" },
  pageTitle: { fontSize: 26, fontWeight: 900, letterSpacing: "-0.03em" },
  sectionTitle: { fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em" },
  cardTitle: { fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em" },
  body: { fontSize: 14, fontWeight: 500, lineHeight: 1.5 },
  desc: { fontSize: 13, fontWeight: 500, lineHeight: 1.5 },
  label: { fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" },
  small: { fontSize: 12, fontWeight: 600 },
  tableHead: { fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" },
};

export const LIGHT_THEME = {
  bg: "#F3F3F7",
  surface: "#FFFFFF",
  surfaceAlt: "#F6F6FA",
  surfaceHover: "#F0F0F5",
  border: "#E6E6EE",
  borderLight: "#ECECF2",
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
