/**
 * Shared story data. Uses the production sample dataset and config reducer —
 * stories never define their own rendering logic.
 */
import { configReducer, createDefaultConfig, type VisualizationConfig } from "@/config/config";
import { createSampleDataset } from "@/fixtures/sample-dataset";

export const sampleDataset = createSampleDataset();
export const gitlabOnlyDataset = createSampleDataset(["gitlab"]);

export function configWith(...steps: Parameters<typeof configReducer>[1][]): VisualizationConfig {
  return steps.reduce(configReducer, createDefaultConfig());
}

/** Illustrative avatar for stories (an inline SVG data URI — the real app embeds the user's PNG/JPEG). */
export const storyAvatar = `data:image/svg+xml;base64,${btoa(
  `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="#7c3aed"/><circle cx="48" cy="38" r="18" fill="#f5f3ff"/><path d="M14 96c4-22 18-32 34-32s30 10 34 32z" fill="#f5f3ff"/></svg>`,
)}`;
