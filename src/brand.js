// CuePoint Brand & Style Guide v1.0 — single source of truth for tokens.

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

export const LIGHT_THEME = {
  bg: "#F1F1F6",
  surface: "#FBFBFD",
  surfaceAlt: "#FFFFFF",
  surfaceHover: "#EEEEF2",
  border: "#EEEEF2",
  borderLight: "#E4E4EA",
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

// Tinted category tokens (components guide)
export const CATEGORY_TINTS = {
  events: { bg: "#FCE8F0", text: "#D63384" },
  clients: { bg: "#E8F4FC", text: "#2563EB" },
  money: { bg: "#E8F8EF", text: "#2FBF6B" },
  contracts: { bg: "#EFEBFF", text: "#6C4DF6" },
  planning: { bg: "#FFF4E8", text: "#EA580C" },
};
