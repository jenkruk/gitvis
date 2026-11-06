import { ensureContrast, mix, ramp } from "./color";

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
  // ---- Phase 4 additions (append only: URL codes for earlier palettes are frozen) ----
  {
    id: "githubClassic",
    name: "GitHub Classic",
    description: "Green and graphite",
    light: {
      background: "#f6f8fa",
      surface: "#ffffff",
      border: "#d1d9e0",
      text: "#1f2328",
      textMuted: "#59636e",
      accent: "#1a7f37",
      heatmapEmpty: "#eff2f5",
      rampFrom: "#aceebb",
      rampTo: "#116329",
      series: ["#1a7f37", "#59636e"],
    },
    dark: {
      background: "#0d1117",
      surface: "#151b23",
      border: "#2a313c",
      text: "#f0f6fc",
      textMuted: "#9198a1",
      accent: "#3fb950",
      heatmapEmpty: "#1e252e",
      rampFrom: "#0e4429",
      rampTo: "#56d364",
      series: ["#3fb950", "#9198a1"],
    },
  },
  {
    id: "gitlabInspired",
    name: "GitLab Inspired",
    description: "Orange and plum",
    light: {
      background: "#fbfafd",
      surface: "#ffffff",
      border: "#e4e1ec",
      text: "#28272d",
      textMuted: "#5e5d66",
      accent: "#c43e1c",
      heatmapEmpty: "#f0eef4",
      rampFrom: "#fcd5b5",
      rampTo: "#5b2a86",
      series: ["#c43e1c", "#6b4fbb"],
    },
    dark: {
      background: "#17141f",
      surface: "#1f1b29",
      border: "#353046",
      text: "#f3f1f7",
      textMuted: "#aaa4ba",
      accent: "#fc6d26",
      heatmapEmpty: "#2a2536",
      rampFrom: "#4b2a6b",
      rampTo: "#fc8a4a",
      series: ["#fc6d26", "#b39ddb"],
    },
  },
  {
    id: "nordicFrost",
    name: "Nordic Frost",
    description: "Ice blue and slate",
    light: {
      background: "#f4f7fa",
      surface: "#ffffff",
      border: "#d5dde6",
      text: "#1e2a36",
      textMuted: "#4c5a68",
      accent: "#2f6f9f",
      heatmapEmpty: "#e8eef3",
      rampFrom: "#c6e2f5",
      rampTo: "#2e3d50",
      series: ["#2f6f9f", "#5b6b7c"],
    },
    dark: {
      background: "#1b2129",
      surface: "#232b35",
      border: "#36414e",
      text: "#eceff4",
      textMuted: "#a7b3c2",
      accent: "#88c0d0",
      heatmapEmpty: "#2c3540",
      rampFrom: "#3b4d63",
      rampTo: "#9ad9ea",
      series: ["#88c0d0", "#c3ccd8"],
    },
  },
  {
    id: "solarized",
    name: "Solarized",
    description: "Teal and amber",
    light: {
      background: "#fdf6e3",
      surface: "#fffbef",
      border: "#e8dfc4",
      text: "#073642",
      textMuted: "#4f6369",
      accent: "#1c7d76",
      heatmapEmpty: "#f2ead1",
      rampFrom: "#b3e2da",
      rampTo: "#7a4f00",
      series: ["#1c7d76", "#9a5f00"],
    },
    dark: {
      background: "#002b36",
      surface: "#073642",
      border: "#164b57",
      text: "#eee8d5",
      textMuted: "#a3b0b0",
      accent: "#2aa198",
      heatmapEmpty: "#0b3f4c",
      rampFrom: "#11555c",
      rampTo: "#e8b23a",
      series: ["#2aa198", "#e0aa33"],
    },
  },
  {
    id: "midnightNeon",
    name: "Midnight Neon",
    description: "Violet and electric blue",
    light: {
      background: "#f7f6ff",
      surface: "#ffffff",
      border: "#e0dcfa",
      text: "#18143a",
      textMuted: "#545078",
      accent: "#6d28d9",
      heatmapEmpty: "#eeecfb",
      rampFrom: "#d4ccff",
      rampTo: "#1d4ed8",
      series: ["#7c3aed", "#1d4ed8"],
    },
    dark: {
      background: "#07061a",
      surface: "#100d29",
      border: "#251f52",
      text: "#eeeaff",
      textMuted: "#a39dd0",
      accent: "#a78bfa",
      heatmapEmpty: "#19153a",
      rampFrom: "#3b1f8f",
      rampTo: "#38bdf8",
      series: ["#a78bfa", "#38bdf8"],
    },
  },
  {
    id: "paperInk",
    name: "Paper & Ink",
    description: "Cream and forest",
    light: {
      background: "#f8f4ea",
      surface: "#fffdf7",
      border: "#e4dccb",
      text: "#1f2a1f",
      textMuted: "#535b4c",
      accent: "#2d5a3d",
      heatmapEmpty: "#efe9db",
      rampFrom: "#d9e6c8",
      rampTo: "#1f4d2e",
      series: ["#2d5a3d", "#8a5a2b"],
    },
    dark: {
      background: "#161a14",
      surface: "#1e231b",
      border: "#333b2e",
      text: "#f3efe2",
      textMuted: "#b2b09f",
      accent: "#9cc59a",
      heatmapEmpty: "#272d23",
      rampFrom: "#2f4a33",
      rampTo: "#eadfc4",
      series: ["#9cc59a", "#d9b98a"],
    },
  },
] as const satisfies readonly PaletteDefinition[];

export type PaletteId = (typeof PALETTES)[number]["id"];

export const PALETTE_IDS: readonly PaletteId[] = PALETTES.map((p) => p.id);

/** Shown first in the studio; the rest sit behind "View all". A selection outside this list is always shown too. */
export const CURATED_PALETTE_IDS: readonly PaletteId[] = [
  "aurora",
  "githubClassic",
  "gitlabInspired",
  "nordicFrost",
  "midnightNeon",
  "paperInk",
];

export function getPalette(id: PaletteId): PaletteDefinition {
  return PALETTES.find((p) => p.id === id)!;
}

export interface ThemeOverrides {
  /** User-chosen series colors in PLATFORM_IDS order; adjusted to ≥ 3:1 against the surface. */
  series?: readonly [string | undefined, string | undefined];
}

/** Minimum non-text contrast (WCAG 1.4.11) for data series against panel surfaces. */
export const SERIES_MIN_CONTRAST = 3;

export function resolveTheme(paletteId: PaletteId, mode: ColorMode, overrides: ThemeOverrides = {}): ThemeTokens {
  const variant = getPalette(paletteId)[mode];
  const [l1, l2, l3, l4] = ramp(variant.rampFrom, variant.rampTo, 4) as [string, string, string, string];
  const custom = overrides.series;
  const series: readonly [string, string] = custom
    ? [
        custom[0] ? ensureContrast(custom[0], variant.surface, SERIES_MIN_CONTRAST) : variant.series[0],
        custom[1] ? ensureContrast(custom[1], variant.surface, SERIES_MIN_CONTRAST) : variant.series[1],
      ]
    : variant.series;
  return { ...variant, series, heatmap: [variant.heatmapEmpty, l1, l2, l3, l4] };
}

/** Second stop of the subtle diagonal background gradient (a light tint of the accent). */
export function gradientEnd(theme: Pick<PaletteVariant, "background" | "accent">): string {
  return mix(theme.background, theme.accent, 0.1);
}

/** GitHub page backgrounds a transparent graphic may sit on, per mode (light; dark and dark-dimmed). */
export const GITHUB_SURFACES: Record<ColorMode, readonly string[]> = {
  light: ["#ffffff"],
  dark: ["#0d1117", "#212830"],
};
