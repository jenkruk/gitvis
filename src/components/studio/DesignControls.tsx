import type { Dispatch } from "react";
import { type ConfigAction, isFeatureVisible, type VisualizationConfig } from "@/config/config";
import { FEATURES } from "@/config/features";
import type { ContributionDataset } from "@/domain/types";
import { Disclosure } from "./controls";
import { BackgroundPicker, DataPicker, IdentityPicker, PlatformColorPicker } from "./personalize";
import { FeatureToggles, LayoutPicker, ModePicker, PalettePicker, PresetPicker } from "./pickers";

interface DesignControlsProps {
  config: VisualizationConfig;
  dispatch: Dispatch<ConfigAction>;
  /** The data being previewed (range-sliced), for feature-visibility notes. */
  dataset: ContributionDataset;
}

const IDENTITY_SUMMARY = { none: "Off", compact: "Compact identity", full: "Full profile" } as const;
const BACKGROUND_SUMMARY = { solid: "Solid", gradient: "Gradient", transparent: "Transparent" } as const;
const RANGE_SUMMARY = { 30: "30 days", 90: "90 days", 365: "1 year" } as const;

/** One-line, plain-text state of each collapsed section, so users can scan without opening them. */
export function sectionSummaries(config: VisualizationConfig, dataset: ContributionDataset) {
  const shown = FEATURES.filter((f) => isFeatureVisible(f.id, config, dataset)).length;
  const custom = Object.keys(config.platformColors).length > 0;
  return {
    identity: [IDENTITY_SUMMARY[config.identity.style], config.identity.name.trim()].filter(Boolean).join(" · "),
    colors: [
      config.mode === "dark" ? "Dark" : "Light",
      BACKGROUND_SUMMARY[config.background],
      custom ? "Custom colors" : "",
    ]
      .filter(Boolean)
      .join(" · "),
    metrics: `${shown} of ${FEATURES.length} shown`,
    display: `${RANGE_SUMMARY[config.range]} · ${config.density === "compact" ? "Compact" : "Spacious"}`,
  };
}

/**
 * Step 2 controls. The essentials (starting preset, layout, curated palettes)
 * are always visible; everything else lives in collapsed sections. All of it
 * reuses the existing pickers, so no customization feature is lost.
 */
export function DesignControls({ config, dispatch, dataset }: DesignControlsProps) {
  const summaries = sectionSummaries(config, dataset);
  return (
    <div className="space-y-8">
      <PresetPicker config={config} dispatch={dispatch} />
      <LayoutPicker config={config} dispatch={dispatch} />
      <PalettePicker config={config} dispatch={dispatch} />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">More options</h3>
        <Disclosure title="Identity" summary={summaries.identity}>
          <IdentityPicker config={config} dispatch={dispatch} />
        </Disclosure>
        <Disclosure title="Colors & Background" summary={summaries.colors}>
          <ModePicker config={config} dispatch={dispatch} />
          <BackgroundPicker config={config} dispatch={dispatch} />
          <PlatformColorPicker config={config} dispatch={dispatch} />
        </Disclosure>
        <Disclosure title="Metrics & Charts" summary={summaries.metrics}>
          <FeatureToggles config={config} dispatch={dispatch} dataset={dataset} />
        </Disclosure>
        <Disclosure title="Display" summary={summaries.display}>
          <DataPicker config={config} dispatch={dispatch} />
        </Disclosure>
      </div>
    </div>
  );
}
