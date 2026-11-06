import { ramp } from "./color";

export type ColorMode = "light" | "dark";

/** Colors a palette author specifies for one mode. */
export interface PaletteVariant {
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  heatmapEmpty: string;
  /** Heatmap level 1 color; levels 2–4 interpolate toward `rampTo`. */
  rampFrom: string;
  rampTo: string;
  /** Series colors, assigned to platforms in PLATFORM_IDS order. */
  series: readonly [string, string];
}

/** Fully resolved tokens consumed by renderers. */
export interface ThemeTokens extends PaletteVariant {
  /** Five heatmap colors: index 0 = no activity, 1–4 = increasing activity. */
  heatmap: readonly [string, string, string, string, string];
}

export interface PaletteDefinition {
  id: string;
  name: string;
  description: string;
  light: PaletteVariant;
  dark: PaletteVariant;
}

export const PALETTES = [
  {
    id: "aurora",
    name: "Aurora",
    description: "Mint and blue",
    light: {
      background: "#f4faf9",
      surface: "#ffffff",
      border: "#d3e5e2",
      text: "#0b1f2a",
      textMuted: "#46606b",
      accent: "#0d8a7e",
      heatmapEmpty: "#e6efee",
      rampFrom: "#9fe8cf",
      rampTo: "#1d4ed8",
      series: ["#0d8a7e", "#2563eb"],
    },
    dark: {
      background: "#0a111e",
      surface: "#101a2c",
      border: "#1f2c45",
      text: "#e6f1ff",
      textMuted: "#94a6bd",
      accent: "#5eead4",
      heatmapEmpty: "#18243a",
      rampFrom: "#145552",
      rampTo: "#7cc4ff",
      series: ["#5eead4", "#60a5fa"],
    },
  },
  {
    id: "amethyst",
    name: "Amethyst",
    description: "Violet and pink",
    light: {
      background: "#faf7ff",
      surface: "#ffffff",
      border: "#e6dcf7",
      text: "#1e1235",
      textMuted: "#5e4f7a",
      accent: "#7c3aed",
      heatmapEmpty: "#f0eaf9",
      rampFrom: "#d9cdfd",
      rampTo: "#be185d",
      series: ["#7c3aed", "#db2777"],
    },
    dark: {
      background: "#110c1d",
      surface: "#19132d",
      border: "#2e2550",
      text: "#f3eefe",
      textMuted: "#ab9fcb",
      accent: "#c084fc",
      heatmapEmpty: "#231b3e",
      rampFrom: "#4c2a8a",
      rampTo: "#f472b6",
      series: ["#c084fc", "#f472b6"],
    },
  },
  {
    id: "desertSunset",
    name: "Desert Sunset",
    description: "Orange and rose",
    light: {
      background: "#fff8f3",
      surface: "#ffffff",
      border: "#f3dccf",
      text: "#2b1510",
      textMuted: "#7a5246",
      accent: "#c2410c",
      heatmapEmpty: "#f8ebe3",
      rampFrom: "#fdd1a3",
      rampTo: "#be123c",
      series: ["#c2410c", "#e11d48"],
    },
    dark: {
      background: "#190e0b",
      surface: "#231511",
      border: "#3d2620",
      text: "#fdf0e9",
      textMuted: "#c4a59a",
      accent: "#fb923c",
      heatmapEmpty: "#2f1d18",
      rampFrom: "#7a2e14",
      rampTo: "#fb7185",
      series: ["#fb923c", "#fb7185"],
    },
  },
  {
    id: "oceanDepths",
    name: "Ocean Depths",
    description: "Cyan and blue",
    light: {
      background: "#f2f9fc",
      surface: "#ffffff",
      border: "#cfe5ee",
      text: "#062430",
      textMuted: "#3f6473",
      accent: "#0369a1",
      heatmapEmpty: "#e3f0f5",
      rampFrom: "#a5ecf8",
      rampTo: "#1e3a8a",
      series: ["#0e7490", "#1d4ed8"],
    },
    dark: {
      background: "#06131b",
      surface: "#0b1d28",
      border: "#16323f",
      text: "#e2f6fc",
      textMuted: "#8fb3c2",
      accent: "#22d3ee",
      heatmapEmpty: "#102a37",
      rampFrom: "#0c4a6e",
      rampTo: "#22d3ee",
      series: ["#22d3ee", "#60a5fa"],
    },
  },
  {
    id: "forestGold",
    name: "Forest & Gold",
    description: "Green and gold",
    light: {
      background: "#f7f8f0",
      surface: "#ffffff",
      border: "#dfe5d2",
      text: "#142114",
      textMuted: "#4f5f48",
      accent: "#15803d",
      heatmapEmpty: "#edf1e4",
      rampFrom: "#f5dd8a",
      rampTo: "#166534",
      series: ["#15803d", "#a16207"],
    },
    dark: {
      background: "#0b130d",
      surface: "#121d15",
      border: "#233527",
      text: "#eef5e9",
      textMuted: "#a3b49c",
      accent: "#facc15",
      heatmapEmpty: "#1a2a1e",
      rampFrom: "#1d5631",
      rampTo: "#facc15",
      series: ["#4ade80", "#facc15"],
    },
  },
  {
    id: "roseQuartz",
    name: "Rose Quartz",
    description: "Pink and lavender",
    light: {
      background: "#fff7fb",
      surface: "#ffffff",
      border: "#f5dbe9",
      text: "#2a1424",
      textMuted: "#7a4f69",
      accent: "#be185d",
      heatmapEmpty: "#f9ecf3",
      rampFrom: "#fbcfe8",
      rampTo: "#6d28d9",
      series: ["#db2777", "#7c3aed"],
    },
    dark: {
      background: "#190f17",
      surface: "#221621",
      border: "#3a2638",
      text: "#fceef7",
      textMuted: "#c6a6bd",
      accent: "#f9a8d4",
      heatmapEmpty: "#2e1f2c",
      rampFrom: "#6b2558",
      rampTo: "#c4b5fd",
      series: ["#f9a8d4", "#c4b5fd"],
    },
  },
  {
    id: "electricCobalt",
    name: "Electric Cobalt",
    description: "Blue and mint",
    light: {
      background: "#f5f7ff",
      surface: "#ffffff",
      border: "#d9def5",
      text: "#0a1033",
      textMuted: "#4a5280",
      accent: "#1d4ed8",
      heatmapEmpty: "#e9edfb",
      rampFrom: "#c7d2fe",
      rampTo: "#1e3a8a",
      series: ["#1d4ed8", "#047857"],
    },
    dark: {
      background: "#070b1f",
      surface: "#0d1430",
      border: "#1c2652",
      text: "#e8edff",
      textMuted: "#9ea8d4",
      accent: "#6ee7b7",
      heatmapEmpty: "#151e44",
      rampFrom: "#1e3a8a",
      rampTo: "#6ee7b7",
      series: ["#60a5fa", "#6ee7b7"],
    },
  },
  {
    id: "ember",
    name: "Ember",
    description: "Coral and amber",
    light: {
      background: "#fffaf5",
      surface: "#ffffff",
      border: "#f5e0d0",
      text: "#2a140c",
      textMuted: "#7a5340",
      accent: "#d13f2a",
      heatmapEmpty: "#f9ede4",
      rampFrom: "#fde08a",
      rampTo: "#c2261d",
      series: ["#d13f2a", "#b45309"],
    },
    dark: {
      background: "#160c0a",
      surface: "#20120f",
      border: "#3a221b",
      text: "#fff1eb",
      textMuted: "#c9a596",
      accent: "#ff8a75",
      heatmapEmpty: "#2c1a15",
      rampFrom: "#7f1d1d",
      rampTo: "#fbbf24",
      series: ["#ff8a75", "#fbbf24"],
    },
  },
  {
    id: "monochrome",
    name: "Monochrome",
    description: "Neutral grays",
    light: {
      background: "#fafafa",
      surface: "#ffffff",
      border: "#e5e5e5",
      text: "#0a0a0a",
      textMuted: "#525252",
      accent: "#171717",
      heatmapEmpty: "#efefef",
      rampFrom: "#cfcfcf",
      rampTo: "#171717",
      series: ["#171717", "#858585"],
    },
    dark: {
      background: "#0a0a0a",
      surface: "#141414",
      border: "#2a2a2a",
      text: "#f5f5f5",
      textMuted: "#a3a3a3",
      accent: "#e5e5e5",
      heatmapEmpty: "#1f1f1f",
      rampFrom: "#404040",
      rampTo: "#f5f5f5",
      series: ["#e5e5e5", "#8a8a8a"],
    },
  },
] as const satisfies readonly PaletteDefinition[];

export type PaletteId = (typeof PALETTES)[number]["id"];

export const PALETTE_IDS: readonly PaletteId[] = PALETTES.map((p) => p.id);

export function getPalette(id: PaletteId): PaletteDefinition {
  return PALETTES.find((p) => p.id === id)!;
}

export function resolveTheme(paletteId: PaletteId, mode: ColorMode): ThemeTokens {
  const variant = getPalette(paletteId)[mode];
  const [l1, l2, l3, l4] = ramp(variant.rampFrom, variant.rampTo, 4) as [string, string, string, string];
  return { ...variant, heatmap: [variant.heatmapEmpty, l1, l2, l3, l4] };
}
