/**
 * Shared story data. Uses the production sample dataset and config reducer —
 * stories never define their own rendering logic.
 */
import { configReducer, createDefaultConfig, type VisualizationConfig } from "@/config/config";
import { combineSources } from "@/domain/combine";
import { addDays, eachDay } from "@/domain/dates";
import { historyRange } from "@/domain/history";
import { createSampleDataset } from "@/fixtures/sample-dataset";
import { decodeCardParams } from "@/publish/card-params";
import { renderSvgMarkup } from "@/publish/svg-markup";
import { Visualization } from "@/renderers/Visualization";
import { createElement } from "react";

export const sampleDataset = createSampleDataset();
export const gitlabOnlyDataset = createSampleDataset(["gitlab"]);

export function configWith(...steps: Parameters<typeof configReducer>[1][]): VisualizationConfig {
  return steps.reduce(configReducer, createDefaultConfig());
}

/** Illustrative avatar for stories (an inline SVG data URI — the real app embeds the user's PNG/JPEG). */
export const storyAvatar = `data:image/svg+xml;base64,${btoa(
  `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="#7c3aed"/><circle cx="48" cy="38" r="18" fill="#f5f3ff"/><path d="M14 96c4-22 18-32 34-32s30 10 34 32z" fill="#f5f3ff"/></svg>`,
)}`;

/**
 * Stands in for /api/card in Storybook: decodes the real published URL and renders
 * it with the production renderer and serializer (sample data, so it keeps its badge).
 */
export function renderSampleCard(cardUrl: string): string {
  const url = new URL(cardUrl);
  const { config, size } = decodeCardParams(url.searchParams);
  return renderSvgMarkup(createElement(Visualization, { dataset: sampleDataset, config, size }));
}

/**
 * Three years of SAMPLE history for stories: GitHub covers the whole span, GitLab
 * (as in reality) only the last 12 months. Deterministic; always labeled sample.
 */
export function createSampleHistoryDataset(platforms: ("github" | "gitlab")[] = ["github", "gitlab"]) {
  const end = sampleDataset.range.end;
  const range = historyRange(end, 3);
  const lastYear = sampleDataset.range;
  const sources = platforms.map((platform) => {
    const recent = sampleDataset.sources.find((s) => s.platform === platform)!;
    if (platform === "gitlab") return { ...recent, coverage: lastYear };
    // Earlier GitHub years: a gentler, deterministic echo of the recent pattern.
    const earlier = eachDay({ start: range.start, end: addDays(lastYear.start, -1) }).flatMap((date, i) =>
      (i * 7) % 11 < 4 ? [{ date, count: 1 + ((i * 5) % 6) }] : [],
    );
    return { ...recent, days: [...earlier, ...recent.days], coverage: range };
  });
  return combineSources(sources, range, "sample");
}
