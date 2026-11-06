/**
 * Versioned URL encoding for published graphics and Edit links.
 *
 * ⚠️ PUBLIC CONTRACT. Every URL ever generated must keep decoding to the same
 * design. The code tables below map frozen URL codes to internal ids so code
 * can be renamed freely. Never change or remove an existing code; add new ones.
 * Breaking changes require a new `v` with its own decoder branch.
 */
import { type ConnectRequest, validateConnectRequest } from "@/adapters/connect";
import type { VisualizationConfig } from "@/config/config";
import { FEATURE_IDS, type FeatureFlags, type FeatureId } from "@/config/features";
import type { LayoutId } from "@/config/layouts";
import type { ColorMode, PaletteId } from "@/theme/palettes";

export const CARD_PARAMS_VERSION = "1";
export const MAX_QUERY_LENGTH = 512;

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
};

const MODE_CODES: Record<ColorMode, string> = { light: "light", dark: "dark" };

const FEATURE_CODES: Record<FeatureId, string> = {
  heatmap: "heatmap",
  totalContributions: "total",
  activeDays: "active",
  longestStreak: "streak",
  bestDay: "best",
  platformBreakdown: "breakdown",
  activityTrends: "trends",
  platformLabels: "labels",
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
const FEATURE_BY_CODE = invert(FEATURE_CODES);

export interface CardParams {
  request: ConnectRequest;
  config: VisualizationConfig;
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
}

function flagsFrom(enabled: Iterable<FeatureId>): FeatureFlags {
  const set = new Set(enabled);
  return Object.fromEntries(FEATURE_IDS.map((id) => [id, set.has(id)])) as FeatureFlags;
}

/** Encodes every parameter explicitly so future default changes never alter published images. */
export function encodeCardParams({ request, config }: CardParams): URLSearchParams {
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

  return { request, config: { layout, palette, mode, features: flagsFrom(enabled) }, issues };
}

function truncate(value: string, max = 24): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
