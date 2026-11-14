import type { Dispatch } from "react";
import { type ConfigAction, isFeatureVisible, type VisualizationConfig } from "@/config/config";
import { FEATURES } from "@/config/features";
import { type ContributionDataset, PLATFORMS } from "@/domain/types";
import { Disclosure } from "./controls";
import { overline } from "@/components/ui/recipes";
import {
  BackgroundPicker,
  DataPicker,
  historyAvailability,
  IdentityPicker,
  PanelPicker,
  PlatformColorPicker,
} from "./personalize";
import { FeatureToggles, LayoutPicker, ModePicker, PalettePicker, PresetPicker } from "./pickers";

interface DesignControlsProps {
  config: VisualizationConfig;
  dispatch: Dispatch<ConfigAction>;
  dataset: ContributionDataset;
}

const ACCORDION = "more-options";

const IDENTITY_SUMMARY = {
  none: "Off",
  compact: "Compact identity",
  full: "Full profile",
  centered: "Centered profile",
} as const;
const BACKGROUND_SUMMARY = { solid: "Solid", gradient: "Gradient", transparent: "Transparent" } as const;
const PANEL_SUMMARY = { filled: "", outlined: "Outlined panels", borderless: "Borderless panels" } as const;
const YEARS_SUMMARY = { 1: "1 year", 2: "2 years", 3: "3 years" } as const;

function arrangement({ identity }: VisualizationConfig): string {
  if (identity.style === "centered" && identity.leftPlatform !== "github") {
    return `${PLATFORMS[identity.leftPlatform].label} on the left`;
  }
  const avatarStyle = identity.style === "compact" || identity.style === "full";
  if (avatarStyle && identity.avatars.length > 0 && identity.avatarSide === "right") return "Avatars right";
  return "";
}

export function sectionSummaries(config: VisualizationConfig, dataset: ContributionDataset) {
  const shown = FEATURES.filter((f) => isFeatureVisible(f.id, config, dataset)).length;
  const custom = Object.keys(config.platformColors).length > 0;
  return {
    identity: [IDENTITY_SUMMARY[config.identity.style], arrangement(config), config.identity.name.trim()]
      .filter(Boolean)
      .join(" · "),
    colors: [BACKGROUND_SUMMARY[config.background], PANEL_SUMMARY[config.panel], custom ? "Custom colors" : ""]
      .filter(Boolean)
      .join(" · "),
    metrics: `${shown} of ${FEATURES.length} shown`,
    display: `${config.range < 365 ? `Last ${config.range} days` : YEARS_SUMMARY[config.years]} · ${
      config.density === "compact" ? "Compact" : "Spacious"
    }`,
  };
}

export function DesignControls({ config, dispatch, dataset }: DesignControlsProps) {
  const summaries = sectionSummaries(config, dataset);
  return (
    <div className="space-y-7">
      <PresetPicker config={config} dispatch={dispatch} />
      <LayoutPicker config={config} dispatch={dispatch} />
      <ModePicker config={config} dispatch={dispatch} />
      <PalettePicker config={config} dispatch={dispatch} />

      <div className="space-y-2 border-t border-line pt-6">
        <h3 className={`${overline} mb-3`}>More options</h3>
        <Disclosure name={ACCORDION} title="Identity" summary={summaries.identity}>
          <IdentityPicker config={config} dispatch={dispatch} />
        </Disclosure>
        <Disclosure name={ACCORDION} title="Colors & Background" summary={summaries.colors}>
          <BackgroundPicker config={config} dispatch={dispatch} />
          <PanelPicker config={config} dispatch={dispatch} />
          <PlatformColorPicker config={config} dispatch={dispatch} />
        </Disclosure>
        <Disclosure name={ACCORDION} title="Metrics & Charts" summary={summaries.metrics}>
          <FeatureToggles config={config} dispatch={dispatch} dataset={dataset} />
        </Disclosure>
        <Disclosure name={ACCORDION} title="Display" summary={summaries.display}>
          <DataPicker config={config} dispatch={dispatch} history={historyAvailability(dataset)} />
        </Disclosure>
      </div>
    </div>
  );
}
