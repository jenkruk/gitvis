import type { HistoryYears } from "@/domain/history";
import { type ContributionDataset, PLATFORM_IDS, type PlatformId } from "@/domain/types";
import type { ColorMode, PaletteId, PanelStyle } from "@/theme/palettes";
import {
  defaultFeatureFlags,
  FEATURE_IDS,
  FEATURES,
  type FeatureFlags,
  type FeatureId,
  getFeature,
  STAT_FEATURE_IDS,
  type StatFeatureId,
} from "./features";
import { getLayout, LAYOUT_IDS, type LayoutId } from "./layouts";

/** Header presets. "none" is the original header (title, date range, handles). */
export type IdentityStyle = "none" | "compact" | "full" | "centered";
export type BackgroundStyle = "solid" | "gradient" | "transparent";
export type DateRangeDays = 30 | 90 | 365;
export type Density = "compact" | "spacious";

export const IDENTITY_STYLES: readonly IdentityStyle[] = ["none", "compact", "full", "centered"];
export const BACKGROUND_STYLES: readonly BackgroundStyle[] = ["solid", "gradient", "transparent"];
export const DATE_RANGES: readonly DateRangeDays[] = [30, 90, 365];
export const DENSITIES: readonly Density[] = ["spacious", "compact"];
export const PANEL_STYLES: readonly PanelStyle[] = ["filled", "outlined", "borderless"];
export type { PanelStyle };

/** Header styles that show the professional title under the name. */
export const hasTitle = (style: IdentityStyle): boolean => style === "full" || style === "centered";

export const NAME_MAX_LENGTH = 40;
export const TITLE_MAX_LENGTH = 60;

export interface IdentityConfig {
  style: IdentityStyle;
  /** Which connected platforms show their @handle (when the "Platform labels" feature is on). */
  handles: PlatformId[];
  /** Which connected platforms show an avatar (compact and full headers only). */
  avatars: PlatformId[];
  /** Optional display name; "" = none. */
  name: string;
  /** Optional professional title (full header); "" = none. */
  title: string;
}

/**
 * Everything the user chooses about presentation. Plain serializable data,
 * independent of the contribution dataset, so it can round-trip through URLs.
 * Every Phase 4 field defaults to the pre-Phase-4 rendering.
 */
export interface VisualizationConfig {
  layout: LayoutId;
  features: FeatureFlags;
  palette: PaletteId;
  mode: ColorMode;
  identity: IdentityConfig;
  background: BackgroundStyle;
  /** Optional per-platform series colors (#rrggbb), independent of the palette. */
  platformColors: Partial<Record<PlatformId, string>>;
  /** Display order of stat metrics. */
  metricOrder: StatFeatureId[];
  range: DateRangeDays;
  density: Density;
  /** Panel appearance (stat cards, heatmap, breakdown, charts); independent of `background`. */
  panel: PanelStyle;
  /**
   * 12-month periods shown (1–3), newest first. Years > 1 always use the full
   * 365-day range; `range` 30/90 survive only for links that already use them.
   */
  years: HistoryYears;
}

/**
 * Starting presets are views over existing config, not stored state: the
 * preset is derived from `identity.style`, so nothing new enters the URL and
 * every v1 URL keeps rendering exactly as before.
 */
export const STARTING_PRESETS = [
  {
    id: "graphic",
    label: "Contribution graphic",
    description: "Your activity and numbers, nothing else.",
  },
  {
    id: "profile",
    label: "Developer profile card",
    description: "Adds your avatar, name and title above your activity.",
  },
] as const;

export type StartingPresetId = (typeof STARTING_PRESETS)[number]["id"];

export function presetOf(config: Pick<VisualizationConfig, "identity">): StartingPresetId {
  return config.identity.style === "none" ? "graphic" : "profile";
}

/**
 * Source attribution: every connected account's platform and username are
 * shown whenever its contributions are, and so is the combined total (the
 * point of GitVis). Applied when decoding every URL and to every studio design.
 */
export function withAttribution(config: VisualizationConfig): VisualizationConfig {
  const allHandles = PLATFORM_IDS.every((p) => config.identity.handles.includes(p));
  // Always-on features (attribution, the combined total) are forced on too.
  const required = FEATURES.filter((f) => "alwaysOn" in f && f.alwaysOn).map((f) => f.id);
  if (allHandles && required.every((id) => config.features[id])) return config;
  return {
    ...config,
    features: { ...config.features, ...Object.fromEntries(required.map((id) => [id, true])) },
    identity: { ...config.identity, handles: [...PLATFORM_IDS] },
  };
}

export function defaultIdentity(): IdentityConfig {
  return { style: "none", handles: ["github", "gitlab"], avatars: [], name: "", title: "" };
}

export function createDefaultConfig(): VisualizationConfig {
  return {
    layout: "dashboard",
    features: defaultFeatureFlags(),
    palette: "aurora",
    mode: "dark",
    identity: defaultIdentity(),
    background: "solid",
    platformColors: {},
    metricOrder: [...STAT_FEATURE_IDS],
    range: 365,
    density: "spacious",
    panel: "filled",
    years: 1,
  };
}

/**
 * Normalizes free text for display in the graphic: Unicode NFC, no control or
 * bidi-override characters (which could spoof text), collapsed whitespace,
 * capped at `max` code points.
 */
export function sanitizeText(value: string, max: number, { finalize = true } = {}): string {
  let cleaned = value
    .normalize("NFC")
    // Drop controls, private-use/unassigned code points and bidi overrides/isolates (text spoofing);
    // keep joiners (ZWJ/ZWNJ) so emoji sequences and scripts like Persian render correctly.
    .replace(/[\p{Cc}\p{Co}\p{Cn}\u202A-\u202E\u2066-\u2069\u200E\u200F\uFEFF]/gu, "")
    .replace(/[^\S ]/g, " ");
  // While typing, spaces must survive (a trailing space is the start of the next word).
  if (finalize) cleaned = cleaned.replace(/ +/g, " ").trim();
  return [...cleaned].slice(0, max).join("");
}

/** Display/serialization form of a free-text field (trimmed, single-spaced). */
export function finalText(value: string): string {
  return value.replace(/ +/g, " ").trim();
}

export type ConfigAction =
  | { type: "setLayout"; layout: LayoutId }
  | { type: "setFeature"; feature: FeatureId; enabled: boolean }
  | { type: "setPalette"; palette: PaletteId }
  | { type: "setMode"; mode: ColorMode }
  | { type: "setIdentityStyle"; style: IdentityStyle }
  | { type: "setAvatar"; platform: PlatformId; enabled: boolean }
  | { type: "setName"; name: string }
  | { type: "setTitle"; title: string }
  | { type: "setBackground"; background: BackgroundStyle }
  | { type: "setPlatformColor"; platform: PlatformId; color: string | null }
  | { type: "moveMetric"; metric: StatFeatureId; direction: -1 | 1 }
  | { type: "setRange"; range: DateRangeDays }
  | { type: "setDensity"; density: Density }
  | { type: "setPanel"; panel: PanelStyle }
  | { type: "setYears"; years: HistoryYears }
  | {
      type: "applyPreset";
      preset: StartingPresetId;
      /** The profile header the user last had, restored when switching back from the graphic preset. */
      restore?: { style: Exclude<IdentityStyle, "none">; avatars: PlatformId[] };
    }
  | { type: "reset" };

function toggle(list: PlatformId[], platform: PlatformId, enabled: boolean): PlatformId[] {
  const set = new Set(list);
  if (enabled) set.add(platform);
  else set.delete(platform);
  // Stable order regardless of click order (keeps URLs canonical).
  return (["github", "gitlab"] as const).filter((p) => set.has(p));
}

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Each axis is updated independently; no action resets another axis. The one
 * coupling: turning a visualization on or off can move the layout (see withFeature),
 * but never changes another feature.
 */
export function configReducer(state: VisualizationConfig, action: ConfigAction): VisualizationConfig {
  const identity = (patch: Partial<IdentityConfig>) => ({ ...state, identity: { ...state.identity, ...patch } });
  switch (action.type) {
    case "setLayout":
      return state.layout === action.layout ? state : { ...state, layout: action.layout };
    case "setFeature":
      // Always-on features (attribution, the combined total) can't be switched off (see withAttribution).
      if (!action.enabled && getFeature(action.feature).alwaysOn) return state;
      return withFeature(state, action.feature, action.enabled);
    case "setPalette":
      return state.palette === action.palette ? state : { ...state, palette: action.palette };
    case "setMode":
      return state.mode === action.mode ? state : { ...state, mode: action.mode };
    case "setIdentityStyle":
      return state.identity.style === action.style ? state : identity({ style: action.style });
    case "setAvatar":
      return identity({ avatars: toggle(state.identity.avatars, action.platform, action.enabled) });
    case "setName":
      return identity({ name: sanitizeText(action.name, NAME_MAX_LENGTH, { finalize: false }) });
    case "setTitle":
      return identity({ title: sanitizeText(action.title, TITLE_MAX_LENGTH, { finalize: false }) });
    case "setBackground":
      return state.background === action.background ? state : { ...state, background: action.background };
    case "setPlatformColor": {
      const platformColors = { ...state.platformColors };
      if (action.color && HEX.test(action.color)) platformColors[action.platform] = action.color.toLowerCase();
      else delete platformColors[action.platform];
      return { ...state, platformColors };
    }
    case "moveMetric": {
      const order = [...state.metricOrder];
      const from = order.indexOf(action.metric);
      const to = from + action.direction;
      if (from < 0 || to < 0 || to >= order.length) return state;
      [order[from], order[to]] = [order[to]!, order[from]!];
      return { ...state, metricOrder: order };
    }
    case "setRange":
      // Legacy 30/90/365-day ranges are single-period by definition.
      return state.range === action.range && state.years === 1 ? state : { ...state, range: action.range, years: 1 };
    case "setYears":
      return state.years === action.years && state.range === 365
        ? state
        : { ...state, years: action.years, range: 365 };
    case "setDensity":
      return state.density === action.density ? state : { ...state, density: action.density };
    case "setPanel":
      return state.panel === action.panel ? state : { ...state, panel: action.panel };
    case "applyPreset":
      // Only identity changes; layout, palette, features and the rest are untouched.
      if (presetOf(state) === action.preset) return state;
      // Name, title and handles are never touched, so nothing typed is lost either way.
      if (action.preset === "graphic") return identity({ style: "none" });
      if (action.restore) return identity({ style: action.restore.style, avatars: [...action.restore.avatars] });
      return identity({
        style: "full",
        avatars: state.identity.avatars.length ? state.identity.avatars : ["github", "gitlab"],
      });
    case "reset":
      return createDefaultConfig();
  }
}

const supports = (layout: LayoutId, feature: FeatureId) => getLayout(layout).supportedFeatures.includes(feature);

/**
 * Whether a feature's switch shows as on: enabled AND part of the current layout.
 * A feature the layout can't show reads as off, even if it stays enabled for
 * other layouts (switching layouts never discards a choice).
 */
export function isFeatureOn(feature: FeatureId, config: Pick<VisualizationConfig, "features" | "layout">): boolean {
  return config.features[feature] && supports(config.layout, feature);
}

/**
 * Features follow the switches, and the layout follows the features:
 * - Turning on a feature the layout can't show moves to the smallest layout that
 *   shows it and everything currently shown (Minimal → Dashboard → Data-rich).
 * - Turning off the last shown feature that Minimal lacks (breakdown, trends)
 *   moves to Minimal. Other features (statistics) never change the layout.
 */
function withFeature(state: VisualizationConfig, feature: FeatureId, enabled: boolean): VisualizationConfig {
  const features = { ...state.features, [feature]: enabled };
  let layout = state.layout;
  if (enabled && !supports(layout, feature)) {
    const shown = FEATURE_IDS.filter((f) => isFeatureOn(f, state));
    layout = LAYOUT_IDS.find((id) => supports(id, feature) && shown.every((f) => supports(id, f))) ?? layout;
  }
  if (!enabled && !supports("minimal", feature) && layout !== "minimal") {
    const needsMore = FEATURE_IDS.some((f) => isFeatureOn(f, { features, layout }) && !supports("minimal", f));
    if (!needsMore) layout = "minimal";
  }
  if (features[feature] === state.features[feature] && layout === state.layout) return state;
  return { ...state, features, layout };
}

export type FeatureVisibility =
  { visible: true } | { visible: false; reason: "disabled" | "unsupportedByLayout" | "needsMultiplePlatforms" };

/** Whether a feature is actually rendered, and if not, why. Never stored — always derived. */
export function getFeatureVisibility(
  feature: FeatureId,
  config: Pick<VisualizationConfig, "features" | "layout">,
  dataset: Pick<ContributionDataset, "sources">,
): FeatureVisibility {
  if (!config.features[feature]) return { visible: false, reason: "disabled" };
  if (!getLayout(config.layout).supportedFeatures.includes(feature)) {
    return { visible: false, reason: "unsupportedByLayout" };
  }
  if (getFeature(feature).requires === "multiplePlatforms" && dataset.sources.length < 2) {
    return { visible: false, reason: "needsMultiplePlatforms" };
  }
  return { visible: true };
}

export function isFeatureVisible(
  feature: FeatureId,
  config: Pick<VisualizationConfig, "features" | "layout">,
  dataset: Pick<ContributionDataset, "sources">,
): boolean {
  return getFeatureVisibility(feature, config, dataset).visible;
}
