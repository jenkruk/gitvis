/**
 * Feature registry. Each entry is a user-toggleable element of the graphic.
 * Layouts declare which features they can render (see layouts.ts); the
 * feature's on/off value lives in VisualizationConfig and survives layout changes.
 */

export type FeatureGroup = "visuals" | "stats" | "context";

export interface FeatureDefinition {
  id: string;
  label: string;
  description: string;
  group: FeatureGroup;
  defaultEnabled: boolean;
  /** Data condition required for the feature to be meaningful. */
  requires?: "multiplePlatforms";
  /**
   * Always on for new designs (URL v2+): not offered as a toggle. Only legacy
   * v1 URLs can carry it disabled, and they render exactly as they always did.
   */
  alwaysOn?: boolean;
}

export const FEATURES = [
  {
    id: "heatmap",
    label: "Contribution heatmap",
    description: "Daily activity grid combining every connected platform.",
    group: "visuals",
    defaultEnabled: true,
  },
  {
    id: "totalContributions",
    label: "Total contributions",
    description: "Sum of contributions reported by each platform.",
    group: "stats",
    defaultEnabled: true,
  },
  {
    id: "activeDays",
    label: "Active days",
    description: "Days with at least one contribution.",
    group: "stats",
    defaultEnabled: true,
  },
  {
    id: "longestStreak",
    label: "Longest streak",
    description: "Most consecutive active days.",
    group: "stats",
    defaultEnabled: true,
  },
  {
    id: "bestDay",
    label: "Best day",
    description: "The single day with the most contributions.",
    group: "stats",
    defaultEnabled: false,
  },
  {
    id: "currentStreak",
    label: "Current streak",
    description: "Consecutive active days up to the end of the range.",
    group: "stats",
    defaultEnabled: false,
  },
  {
    id: "platformBreakdown",
    label: "GitHub / GitLab breakdown",
    description: "Each platform's share of the combined total.",
    group: "visuals",
    defaultEnabled: true,
    requires: "multiplePlatforms",
  },
  {
    id: "activityTrends",
    label: "Activity trends",
    description: "Weekly totals and month-by-month platform comparison.",
    group: "visuals",
    defaultEnabled: true,
  },
  {
    id: "platformLabels",
    label: "Account labels & links",
    description: "The platform and username behind every contribution shown (source attribution).",
    group: "context",
    defaultEnabled: true,
    alwaysOn: true,
  },
] as const satisfies readonly FeatureDefinition[];

export type FeatureId = (typeof FEATURES)[number]["id"];
export type FeatureFlags = Record<FeatureId, boolean>;

export const FEATURE_IDS: readonly FeatureId[] = FEATURES.map((f) => f.id);

export const FEATURE_GROUP_LABELS: Record<FeatureGroup, string> = {
  visuals: "Visualizations",
  stats: "Statistics",
  context: "Context",
};

export function getFeature(id: FeatureId): FeatureDefinition {
  return FEATURES.find((f) => f.id === id)!;
}

export function defaultFeatureFlags(): FeatureFlags {
  return Object.fromEntries(FEATURES.map((f) => [f.id, f.defaultEnabled])) as FeatureFlags;
}

/** Metrics that render as stat cards / inline stats. Default order; append new metrics at the end. */
export const STAT_FEATURE_IDS = [
  "totalContributions",
  "activeDays",
  "longestStreak",
  "bestDay",
  "currentStreak",
] as const satisfies readonly FeatureId[];
export type StatFeatureId = (typeof STAT_FEATURE_IDS)[number];
