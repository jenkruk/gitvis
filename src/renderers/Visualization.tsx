import { isFeatureVisible, type VisualizationConfig } from "@/config/config";
import { formatDate } from "@/domain/dates";
import { type ContributionDataset, PLATFORMS } from "@/domain/types";
import { computeMetrics, type ContributionMetrics } from "@/metrics/metrics";
import { resolveTheme } from "@/theme/palettes";
import { LAYOUT_SECTIONS } from "./layouts";
import { CANVAS_WIDTH, CONTENT_WIDTH, formatNumber, PADDING, SECTION_GAP, stackSections } from "./primitives";
import { Header, HEADER_HEIGHT } from "./sections";

export interface VisualizationProps {
  dataset: ContributionDataset;
  config: VisualizationConfig;
  /** Pass precomputed metrics to avoid recomputation; derived from `dataset` otherwise. */
  metrics?: ContributionMetrics;
  /** Unique per page when several SVGs are rendered together (ARIA ids). */
  idPrefix?: string;
}

/** Text alternative summarising the data the graphic shows. */
export function describeVisualization(dataset: ContributionDataset, metrics: ContributionMetrics): string {
  const labelFor = (s: ContributionDataset["sources"][number]) => `${PLATFORMS[s.platform].label} @${s.username}`;
  const names = dataset.sources.map(labelFor);
  const where =
    names.length === 0
      ? ""
      : names.length === 1
        ? ` on ${names[0]}`
        : ` across ${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  const breakdown =
    metrics.platformTotals.length > 1
      ? `${metrics.platformTotals.map((p) => `${PLATFORMS[p.platform].label} ${formatNumber(p.total)}`).join(", ")}.`
      : "";
  const streak = metrics.longestStreak ? `Longest streak: ${formatNumber(metrics.longestStreak.length)} days.` : "";
  const best = metrics.bestDay
    ? `Best day: ${formatNumber(metrics.bestDay.count)} on ${formatDate(metrics.bestDay.date)}.`
    : "";
  return [
    dataset.provenance === "sample" ? "Sample data, not real activity." : "",
    `${formatNumber(metrics.total)} contributions${where} from ${formatDate(dataset.range.start)} to ${formatDate(dataset.range.end)}.`,
    breakdown,
    `${formatNumber(metrics.activeDays)} active days.`,
    streak,
    best,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * The complete, self-contained SVG graphic. Pure: no hooks, no browser APIs,
 * inline presentation attributes only — safe for renderToStaticMarkup embeds.
 */
export function Visualization({ dataset, config, metrics: provided, idPrefix = "gitvis" }: VisualizationProps) {
  const metrics = provided ?? computeMetrics(dataset);
  const theme = resolveTheme(config.palette, config.mode);
  const sections = LAYOUT_SECTIONS[config.layout]({
    dataset,
    metrics,
    theme,
    isVisible: (feature) => isFeatureVisible(feature, config, dataset),
  });
  const { nodes, bottom } = stackSections(sections, PADDING + HEADER_HEIGHT + SECTION_GAP);
  const height = Math.ceil(bottom + PADDING - (sections.length === 0 ? SECTION_GAP : 0));
  const titleId = `${idPrefix}-title`;
  const descId = `${idPrefix}-desc`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={CANVAS_WIDTH}
      height={height}
      viewBox={`0 0 ${CANVAS_WIDTH} ${height}`}
      role="img"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <title id={titleId}>Contribution activity</title>
      <desc id={descId}>{describeVisualization(dataset, metrics)}</desc>
      <rect
        x={0.5}
        y={0.5}
        width={CANVAS_WIDTH - 1}
        height={height - 1}
        rx={14}
        fill={theme.background}
        stroke={theme.border}
      />
      <Header
        dataset={dataset}
        theme={theme}
        y={PADDING}
        width={CONTENT_WIDTH}
        showPlatformLabels={isFeatureVisible("platformLabels", config, dataset)}
      />
      {nodes}
    </svg>
  );
}
