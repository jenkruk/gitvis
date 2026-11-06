import type { FeatureId } from "./features";

export interface LayoutDefinition {
  id: string;
  label: string;
  description: string;
  supportedFeatures: readonly FeatureId[];
}

export const LAYOUTS = [
  {
    id: "minimal",
    label: "Minimal",
    description: "Understated typography and a heatmap, with an optional one-line summary.",
    supportedFeatures: [
      "heatmap",
      "totalContributions",
      "activeDays",
      "longestStreak",
      "bestDay",
      "currentStreak",
      "platformLabels",
    ],
  },
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Balanced stat cards, heatmap and platform breakdown.",
    supportedFeatures: [
      "heatmap",
      "totalContributions",
      "activeDays",
      "longestStreak",
      "bestDay",
      "currentStreak",
      "platformBreakdown",
      "platformLabels",
    ],
  },
  {
    id: "dataRich",
    label: "Data-rich",
    description: "Detailed stats, trends and platform comparisons.",
    supportedFeatures: [
      "heatmap",
      "totalContributions",
      "activeDays",
      "longestStreak",
      "bestDay",
      "currentStreak",
      "platformBreakdown",
      "activityTrends",
      "platformLabels",
    ],
  },
] as const satisfies readonly LayoutDefinition[];

export type LayoutId = (typeof LAYOUTS)[number]["id"];

export const LAYOUT_IDS: readonly LayoutId[] = LAYOUTS.map((l) => l.id);

export function getLayout(id: LayoutId): LayoutDefinition {
  return LAYOUTS.find((l) => l.id === id)!;
}
