import { configReducer, createDefaultConfig, type StartingPresetId, type VisualizationConfig } from "@/config/config";
import { studioSearch } from "@/publish/snippets";
import { SAMPLE_PARAM, STUDIO_PATH } from "@/publish/studio-url";
import type { ColorMode, PaletteId } from "@/theme/palettes";

export const SHOWCASE_PALETTES = ["lagoon", "githubClassic", "terracotta"] as const satisfies readonly PaletteId[];
export type ShowcasePalette = (typeof SHOWCASE_PALETTES)[number];

export interface ShowcaseChoice {
  preset: StartingPresetId;
  palette: ShowcasePalette;
  mode: ColorMode;
}

export const DEFAULT_SHOWCASE: ShowcaseChoice = { preset: "graphic", palette: "lagoon", mode: "dark" };

export function showcaseConfig({ preset, palette, mode }: ShowcaseChoice): VisualizationConfig {
  let config = createDefaultConfig();
  config = configReducer(config, { type: "setPalette", palette });
  config = configReducer(config, { type: "setMode", mode });
  return configReducer(config, { type: "applyPreset", preset });
}

export function studioHref(choice: ShowcaseChoice): string {
  const search = studioSearch(null, showcaseConfig(choice));
  return search ? `${STUDIO_PATH}?${search}` : STUDIO_PATH;
}

export function sampleHref(choice: ShowcaseChoice): string {
  const search = studioSearch(null, showcaseConfig(choice));
  return `${STUDIO_PATH}?${search ? `${search}&` : ""}${SAMPLE_PARAM}=1#design`;
}
