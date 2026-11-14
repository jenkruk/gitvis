import { configReducer, createDefaultConfig, type StartingPresetId, type VisualizationConfig } from "@/config/config";
import { studioSearch } from "@/publish/snippets";
import { SAMPLE_PARAM, STUDIO_PATH } from "@/publish/studio-url";
import type { ColorMode, PaletteId } from "@/theme/palettes";

/**
 * The landing page's product demonstration: a deliberately small slice of the studio's options,
 * applied with the studio's own reducer so the graphic is exactly what the studio would render.
 */

export const SHOWCASE_PALETTES = ["lagoon", "githubClassic", "terracotta"] as const satisfies readonly PaletteId[];
export type ShowcasePalette = (typeof SHOWCASE_PALETTES)[number];

export interface ShowcaseChoice {
  preset: StartingPresetId;
  palette: ShowcasePalette;
  mode: ColorMode;
}

export const DEFAULT_SHOWCASE: ShowcaseChoice = { preset: "graphic", palette: "lagoon", mode: "dark" };

/** The design the landing page shows (and hands to the studio). Dashboard layout, the default stats. */
export function showcaseConfig({ preset, palette, mode }: ShowcaseChoice): VisualizationConfig {
  let config = createDefaultConfig();
  config = configReducer(config, { type: "setPalette", palette });
  config = configReducer(config, { type: "setMode", mode });
  return configReducer(config, { type: "applyPreset", preset });
}

/** "Create your graphic": the studio's Connect step, carrying the design chosen here. */
export function studioHref(choice: ShowcaseChoice): string {
  const search = studioSearch(null, showcaseConfig(choice));
  return search ? `${STUDIO_PATH}?${search}` : STUDIO_PATH;
}

/** "Explore with sample data": the studio's Design step on the labelled sample. */
export function sampleHref(choice: ShowcaseChoice): string {
  const search = studioSearch(null, showcaseConfig(choice));
  return `${STUDIO_PATH}?${search ? `${search}&` : ""}${SAMPLE_PARAM}=1#design`;
}
