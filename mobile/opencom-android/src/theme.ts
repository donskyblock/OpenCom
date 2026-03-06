/**
 * OpenCom design system - aligned with web frontend (styles.css)
 * --bg-app, --bg-rail, --brand, etc.
 */
export const colors = {
  background: "#0a1120",
  rail: "#0c162a",
  sidebar: "#111e35",
  chat: "#111c33",
  chatAlt: "#1a2a45",
  elev: "#1a2741",
  input: "#0d172d",
  hover: "rgba(132, 165, 255, 0.16)",
  active: "rgba(125, 164, 255, 0.28)",
  border: "rgba(152, 174, 219, 0.2)",
  text: "#edf2ff",
  textSoft: "#c6d4f5",
  textDim: "#90a5cf",
  brand: "#7386ff",
  brandStrong: "#8f8cff",
  danger: "#ef5f76",
  success: "#37cd93",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
};

export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
  full: 9999,
};

export const typography = {
  title: { fontSize: 17, fontWeight: "700" as const },
  heading: { fontSize: 16, fontWeight: "600" as const },
  body: { fontSize: 15 },
  caption: { fontSize: 13 },
  label: { fontSize: 12, fontWeight: "600" as const },
};
