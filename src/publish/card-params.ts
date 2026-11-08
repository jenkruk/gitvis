/**
 * Versioned URL encoding for published graphics and Edit links.
 *
 * ⚠️ PUBLIC CONTRACT. Every URL ever generated must keep decoding to the same
 * design. The code tables below map frozen URL codes to internal ids so code
 * can be renamed freely. Never change or remove an existing code; add new ones.
 * Breaking changes require a new `v` with its own decoder branch.
 */
import { type ConnectRequest, validateConnectRequest } from "@/adapters/connect";
import {
  type BackgroundStyle,
  type DateRangeDays,
  type Density,
  finalText,
  type IdentityStyle,
  NAME_MAX_LENGTH,
  sanitizeText,
  TITLE_MAX_LENGTH,
  type VisualizationConfig,
  withAttribution,
} from "@/config/config";
import {
  FEATURE_IDS,
  type FeatureFlags,
  type FeatureId,
  STAT_FEATURE_IDS,
  type StatFeatureId,
} from "@/config/features";
import type { HistoryYears } from "@/domain/history";
import { PLATFORM_IDS, type PlatformId } from "@/domain/types";
import type { LayoutId } from "@/config/layouts";
import type { CardSize } from "@/renderers/primitives";
import type { ColorMode, PaletteId, PanelStyle } from "@/theme/palettes";

export const CARD_PARAMS_VERSION = "1";
/** Raised from 512 in Phase 4: worst-case percent-encoded Unicode name + title is ~1,600 chars. Camo hex-encodes URLs (~2×); still far below browser/CDN limits. */
export const MAX_QUERY_LENGTH = 2048;

const LAYOUT_CODES: Record<LayoutId, string> = {
  minimal: "minimal",
  dashboard: "dashboard",
  dataRich: "data-rich",
};

const PALETTE_CODES: Record<PaletteId, string> = {
  aurora: "aurora",
  amethyst: "amethyst",
  desertSunset: "desert-sunset",
  oceanDepths: "ocean-depths",
  forestGold: "forest-gold",
  roseQuartz: "rose-quartz",
  electricCobalt: "electric-cobalt",
  ember: "ember",
  monochrome: "monochrome",
  // Phase 4 additions
  githubClassic: "github-classic",
  gitlabInspired: "gitlab-inspired",
  nordicFrost: "nordic-frost",
  solarized: "solarized",
  midnightNeon: "midnight-neon",
  paperInk: "paper-ink",
  obsidianGold: "obsidian-gold",
  velvetPlum: "velvet-plum",
  lagoon: "lagoon",
  citrus: "citrus",
  terracotta: "terracotta",
  mocha: "mocha",
  porcelain: "porcelain",
  sageLinen: "sage-linen",
  volt: "volt",
};

const MODE_CODES: Record<ColorMode, string> = { light: "light", dark: "dark" };

/** Added in v1 as an optional param (absent = "full"), so older URLs are unaffected. */
const SIZE_CODES: Record<CardSize, string> = { full: "full", compact: "compact" };

const FEATURE_CODES: Record<FeatureId, string> = {
  heatmap: "heatmap",
  totalContributions: "total",
  activeDays: "active",
  longestStreak: "streak",
  bestDay: "best",
  platformBreakdown: "breakdown",
  activityTrends: "trends",
  platformLabels: "labels",
  currentStreak: "current", // Phase 4: off for every earlier URL (explicit enabled-list semantics)
};

/*
 * Phase 4 optional params. ABSENT = the pre-Phase-4 rendering, frozen forever:
 *   hdr=none · hl=github,gitlab · av=(none) · name/title empty · bg=solid · pc=(palette) ·
 *   ord=total,active,streak,best,current · range=365 · den=spacious
 * Phase 4.2: pnl=filled · yrs=1 (yrs=2|3 require the full 365-day range)
 * Encoders write them only when they differ, so legacy-equivalent designs keep their exact URLs.
 */
const IDENTITY_CODES: Record<IdentityStyle, string> = {
  none: "none",
  compact: "compact",
  full: "full",
  centered: "centered",
};
const BACKGROUND_CODES: Record<BackgroundStyle, string> = {
  solid: "solid",
  gradient: "gradient",
  transparent: "transparent",
};
const DENSITY_CODES: Record<Density, string> = { spacious: "spacious", compact: "compact" };
const PANEL_CODES: Record<PanelStyle, string> = { filled: "filled", outlined: "outlined", borderless: "borderless" };
const YEARS_CODES: Record<`${HistoryYears}`, string> = { "1": "1", "2": "2", "3": "3" };
const RANGE_CODES: Record<`${DateRangeDays}`, string> = { "30": "30", "90": "90", "365": "365" };
const PLATFORM_CODES: Record<PlatformId, string> = { github: "github", gitlab: "gitlab" };
const LEGACY = {
  identity: "none" as IdentityStyle,
  handles: [...PLATFORM_IDS] as PlatformId[],
  background: "solid" as BackgroundStyle,
  metricOrder: [...STAT_FEATURE_IDS] as StatFeatureId[],
  range: 365 as DateRangeDays,
  density: "spacious" as Density,
  panel: "filled" as PanelStyle,
  years: 1 as HistoryYears,
};

/** Frozen v1 defaults — deliberately NOT derived from createDefaultConfig(), which may evolve. */
const V1_DEFAULTS = {
  layout: "dashboard",
  palette: "aurora",
  mode: "dark",
  features: [
    "heatmap",
    "totalContributions",
    "activeDays",
    "longestStreak",
    "platformBreakdown",
    "activityTrends",
    "platformLabels",
  ],
} as const satisfies {
  layout: LayoutId;
  palette: PaletteId;
  mode: ColorMode;
  features: readonly FeatureId[];
};

function invert<K extends string>(table: Record<K, string>): Map<string, K> {
  return new Map(Object.entries(table).map(([id, code]) => [code as string, id as K]));
}
const LAYOUT_BY_CODE = invert(LAYOUT_CODES);
const PALETTE_BY_CODE = invert(PALETTE_CODES);
const MODE_BY_CODE = invert(MODE_CODES);
const SIZE_BY_CODE = invert(SIZE_CODES);
const FEATURE_BY_CODE = invert(FEATURE_CODES);
const IDENTITY_BY_CODE = invert(IDENTITY_CODES);
const BACKGROUND_BY_CODE = invert(BACKGROUND_CODES);
const DENSITY_BY_CODE = invert(DENSITY_CODES);
const PANEL_BY_CODE = invert(PANEL_CODES);
const YEARS_BY_CODE = invert(YEARS_CODES);
const RANGE_BY_CODE = invert(RANGE_CODES);
const PLATFORM_BY_CODE = invert(PLATFORM_CODES);
const STAT_CODES = Object.fromEntries(STAT_FEATURE_IDS.map((id) => [id, FEATURE_CODES[id]])) as Record<
  StatFeatureId,
  string
>;
const STAT_BY_CODE = invert(STAT_CODES);
const HEX6 = /^[0-9a-f]{6}$/i;

const sameList = <T>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export interface CardParams {
  request: ConnectRequest;
  config: VisualizationConfig;
  /** Image variant. Omitted = "full" (the implicit v1 default); only "compact" is written. */
  size?: CardSize;
}

export interface ParamIssue {
  param: string;
  message: string;
}

export interface DecodedCardParams {
  /** Valid usernames, or null when none were provided / any was invalid. */
  request: ConnectRequest | null;
  /** Always usable: invalid parts fall back to v1 defaults. */
  config: VisualizationConfig;
  /** Empty when the URL is fully valid. */
  issues: ParamIssue[];
  /** Present only when the URL asks for a non-default image variant. */
  size?: CardSize;
}

function flagsFrom(enabled: Iterable<FeatureId>): FeatureFlags {
  const set = new Set(enabled);
  return Object.fromEntries(FEATURE_IDS.map((id) => [id, set.has(id)])) as FeatureFlags;
}

/** Encodes every parameter explicitly so future default changes never alter published images. */
export function encodeCardParams({ request, config: design, size }: CardParams): URLSearchParams {
  const config = withAttribution(design);
  const params = new URLSearchParams({ v: CARD_PARAMS_VERSION });
  if (request.github) params.set("github", request.github);
  if (request.gitlab) params.set("gitlab", request.gitlab);
  params.set("layout", LAYOUT_CODES[config.layout]);
  params.set("palette", PALETTE_CODES[config.palette]);
  params.set("mode", MODE_CODES[config.mode]);
  params.set(
    "f",
    FEATURE_IDS.filter((id) => config.features[id])
      .map((id) => FEATURE_CODES[id])
      .join(","),
  );
  // "full" is the implicit default of every URL published before `size` existed; only write the variant.
  if (size === "compact") params.set("size", SIZE_CODES.compact);

  // Phase 4 params: only when different from the frozen legacy default.
  const { identity } = config;
  if (identity.style !== LEGACY.identity) params.set("hdr", IDENTITY_CODES[identity.style]);
  // No `hl`: every connected account is always attributed.
  if (identity.avatars.length) params.set("av", identity.avatars.map((p) => PLATFORM_CODES[p]).join(","));
  if (finalText(identity.name)) params.set("name", finalText(identity.name));
  if (finalText(identity.title)) params.set("title", finalText(identity.title));
  if (config.background !== LEGACY.background) params.set("bg", BACKGROUND_CODES[config.background]);
  const colors = PLATFORM_IDS.flatMap((p) => {
    const hex = config.platformColors[p];
    return hex ? [`${PLATFORM_CODES[p]}:${hex.replace("#", "").toLowerCase()}`] : [];
  });
  if (colors.length) params.set("pc", colors.join(","));
  if (!sameList(config.metricOrder, LEGACY.metricOrder)) {
    params.set("ord", config.metricOrder.map((id) => STAT_CODES[id]).join(","));
  }
  if (config.range !== LEGACY.range) params.set("range", RANGE_CODES[`${config.range}`]);
  if (config.density !== LEGACY.density) params.set("den", DENSITY_CODES[config.density]);
  if (config.panel !== LEGACY.panel) params.set("pnl", PANEL_CODES[config.panel]);
  if (config.years !== LEGACY.years) params.set("yrs", YEARS_CODES[`${config.years}`]);
  return params;
}

/** Decodes a card/studio query. Callers choose strictness via `issues`. */
export function decodeCardParams(search: URLSearchParams): DecodedCardParams {
  const issues: ParamIssue[] = [];

  if (search.toString().length > MAX_QUERY_LENGTH) {
    issues.push({ param: "*", message: `The URL is too long (max ${MAX_QUERY_LENGTH} characters of options).` });
  }

  const version = search.get("v");
  if (version !== null && version !== CARD_PARAMS_VERSION) {
    issues.push({ param: "v", message: `Unsupported version “${truncate(version)}”.` });
  }

  const usernames = validateConnectRequest({ github: search.get("github"), gitlab: search.get("gitlab") });
  let request: ConnectRequest | null = null;
  if (usernames.ok) request = usernames.request;
  else if (usernames.reason === "empty")
    issues.push({ param: "github", message: "Add a github and/or gitlab username." });
  else for (const field of usernames.fields) issues.push({ param: field, message: `Invalid ${field} username.` });

  const pick = <T>(param: string, table: Map<string, T>, fallback: T): T => {
    const raw = search.get(param);
    if (raw === null) return fallback;
    const value = table.get(raw);
    if (value === undefined) {
      issues.push({ param, message: `Unknown ${param} “${truncate(raw)}”.` });
      return fallback;
    }
    return value;
  };

  const layout = pick("layout", LAYOUT_BY_CODE, V1_DEFAULTS.layout);
  const palette = pick("palette", PALETTE_BY_CODE, V1_DEFAULTS.palette);
  const mode = pick("mode", MODE_BY_CODE, V1_DEFAULTS.mode);

  let enabled: FeatureId[] = [...V1_DEFAULTS.features];
  const rawFeatures = search.get("f");
  if (rawFeatures !== null) {
    const codes = rawFeatures
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 32);
    enabled = [];
    for (const code of codes) {
      const id = FEATURE_BY_CODE.get(code);
      if (id) enabled.push(id);
      else issues.push({ param: "f", message: `Unknown feature “${truncate(code)}”.` });
    }
  }

  const size = pick("size", SIZE_BY_CODE, "full" as CardSize);

  // ---- Phase 4 optional params (absent = legacy rendering) ----
  const list = <T>(param: string, table: Map<string, T>, fallback: T[]): T[] => {
    const raw = search.get(param);
    if (raw === null) return fallback;
    const out: T[] = [];
    for (const code of raw
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 8)) {
      const value = table.get(code);
      if (value === undefined) issues.push({ param, message: `Unknown ${param} value “${truncate(code)}”.` });
      else if (!out.includes(value)) out.push(value);
    }
    return out;
  };
  const text = (param: string, max: number): string => {
    const raw = search.get(param);
    if (raw === null) return "";
    const clean = sanitizeText(raw, max);
    if ([...raw.trim()].length > max) issues.push({ param, message: `The ${param} is longer than ${max} characters.` });
    return clean;
  };

  const style = pick("hdr", IDENTITY_BY_CODE, LEGACY.identity);
  const handles = PLATFORM_IDS.filter((p) => list("hl", PLATFORM_BY_CODE, LEGACY.handles).includes(p));
  const avatars = PLATFORM_IDS.filter((p) => list("av", PLATFORM_BY_CODE, []).includes(p));
  const name = text("name", NAME_MAX_LENGTH);
  const title = text("title", TITLE_MAX_LENGTH);
  const background = pick("bg", BACKGROUND_BY_CODE, LEGACY.background);
  const range = Number(pick("range", RANGE_BY_CODE, `${LEGACY.range}`)) as DateRangeDays;
  const density = pick("den", DENSITY_BY_CODE, LEGACY.density);
  const panel = pick("pnl", PANEL_BY_CODE, LEGACY.panel);
  const years = Number(pick("yrs", YEARS_BY_CODE, `${LEGACY.years}`)) as HistoryYears;
  if (years > 1 && range !== 365) {
    issues.push({ param: "yrs", message: "Multi-year history can't be combined with a 30- or 90-day range." });
  }

  const platformColors: Partial<Record<PlatformId, string>> = {};
  const rawColors = search.get("pc");
  if (rawColors !== null) {
    for (const entry of rawColors.split(",").filter(Boolean).slice(0, 4)) {
      const [code, hex] = entry.split(":");
      const platform = code ? PLATFORM_BY_CODE.get(code) : undefined;
      if (platform && hex && HEX6.test(hex)) platformColors[platform] = `#${hex.toLowerCase()}`;
      else issues.push({ param: "pc", message: `Invalid platform color “${truncate(entry)}”.` });
    }
  }

  const ordered = list("ord", STAT_BY_CODE, LEGACY.metricOrder);
  const metricOrder = [...ordered, ...STAT_FEATURE_IDS.filter((id) => !ordered.includes(id))];

  const config: VisualizationConfig = {
    layout,
    palette,
    mode,
    features: flagsFrom(enabled),
    identity: { style, handles, avatars, name, title },
    background,
    platformColors,
    metricOrder,
    range,
    density,
    panel,
    years,
  };
  if (years > 1) config.range = 365;
  // Source attribution is part of the contract: account labels can't be removed (`labels`/`hl` are ignored).
  const decoded = withAttribution(config);
  return size === "full" ? { request, config: decoded, issues } : { request, config: decoded, issues, size };
}

function truncate(value: string, max = 24): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
