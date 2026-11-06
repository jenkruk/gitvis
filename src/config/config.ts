import type { ContributionDataset } from "@/domain/types";
import type { ColorMode, PaletteId } from "@/theme/palettes";
import { defaultFeatureFlags, type FeatureFlags, type FeatureId, getFeature } from "./features";
import { getLayout, type LayoutId } from "./layouts";

/**
 * Everything the user chooses about presentation. Plain serializable data,
 * independent of the contribution dataset, so it can round-trip through URLs.
 */
export interface VisualizationConfig {
  layout: LayoutId;
  features: FeatureFlags;
  palette: PaletteId;
  mode: ColorMode;
}

export function createDefaultConfig(): VisualizationConfig {
  return { layout: "dashboard", features: defaultFeatureFlags(), palette: "aurora", mode: "dark" };
}

export type ConfigAction =
  | { type: "setLayout"; layout: LayoutId }
  | { type: "setFeature"; feature: FeatureId; enabled: boolean }
  | { type: "setPalette"; palette: PaletteId }
  | { type: "setMode"; mode: ColorMode }
  | { type: "reset" };

/** Each axis is updated independently; no action resets another axis. */
export function configReducer(state: VisualizationConfig, action: ConfigAction): VisualizationConfig {
  switch (action.type) {
    case "setLayout":
      return state.layout === action.layout ? state : { ...state, layout: action.layout };
    case "setFeature":
      return state.features[action.feature] === action.enabled
        ? state
        : { ...state, features: { ...state.features, [action.feature]: action.enabled } };
    case "setPalette":
      return state.palette === action.palette ? state : { ...state, palette: action.palette };
    case "setMode":
      return state.mode === action.mode ? state : { ...state, mode: action.mode };
    case "reset":
      return createDefaultConfig();
  }
}

export type FeatureVisibility =
  { visible: true } | { visible: false; reason: "disabled" | "unsupportedByLayout" | "needsMultiplePlatforms" };

/** Whether a feature is actually rendered, and if not, why. Never stored — always derived. */
export function getFeatureVisibility(
  feature: FeatureId,
  config: VisualizationConfig,
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
  config: VisualizationConfig,
  dataset: Pick<ContributionDataset, "sources">,
): boolean {
  return getFeatureVisibility(feature, config, dataset).visible;
}
