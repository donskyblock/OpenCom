import { Platform } from "react-native";

/**
 * OpenCom design system - aligned with the desktop frontend tokens and layout
 * language, but adapted for touch-first spacing and mobile readability.
 */
export const colors = {
  background: "#0a1120",
  backgroundDeep: "#070d19",
  rail: "#0c162a",
  sidebar: "#111e35",
  sidebarStrong: "#101a31",
  chat: "#111c33",
  chatAlt: "#1a2a45",
  elev: "#1a2741",
  elevStrong: "#16233d",
  panel: "rgba(17, 30, 53, 0.88)",
  panelAlt: "rgba(20, 32, 57, 0.86)",
  input: "#0d172d",
  hover: "rgba(132, 165, 255, 0.16)",
  active: "rgba(125, 164, 255, 0.28)",
  brandMuted: "rgba(115, 134, 255, 0.16)",
  brandGlow: "rgba(115, 134, 255, 0.28)",
  overlay: "rgba(5, 10, 19, 0.82)",
  border: "rgba(152, 174, 219, 0.2)",
  borderStrong: "rgba(181, 196, 255, 0.36)",
  text: "#edf2ff",
  textSoft: "#c6d4f5",
  textDim: "#90a5cf",
  brand: "#7386ff",
  brandStrong: "#8f8cff",
  danger: "#ef5f76",
  success: "#37cd93",
  warning: "#f0b429",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  xxl: 32,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  full: 9999,
};

export const typography = {
  hero: { fontSize: 28, fontWeight: "800" as const, letterSpacing: -0.6 },
  title: { fontSize: 18, fontWeight: "700" as const, letterSpacing: -0.2 },
  heading: { fontSize: 16, fontWeight: "700" as const },
  body: { fontSize: 15 },
  caption: { fontSize: 13 },
  label: { fontSize: 12, fontWeight: "600" as const },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 0.9,
  },
};

export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: "#020919",
      shadowOpacity: 0.32,
      shadowOffset: { width: 0, height: 14 },
      shadowRadius: 24,
    },
    android: {
      elevation: 8,
    },
    default: {},
  }),
  floating: Platform.select({
    ios: {
      shadowColor: "#020919",
      shadowOpacity: 0.4,
      shadowOffset: { width: 0, height: 18 },
      shadowRadius: 28,
    },
    android: {
      elevation: 12,
    },
    default: {},
  }),
};
