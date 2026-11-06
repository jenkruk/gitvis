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
  const platforms = dataset.sources.map((s) => PLATFORMS[s.platform].label);
  const across = platforms.length > 0 ? ` across ${platforms.join(" and ")}` : "";
  const streak = metrics.longestStreak ? ` Longest streak: ${metrics.longestStreak.length} days.` : "";
  return [
    dataset.provenance === "sample" ? "Sample data, not real activity." : "",
    `${formatNumber(metrics.total)} contributions${across} from ${formatDate(dataset.range.start)} to ${formatDate(dataset.range.end)}.`,
    `${formatNumber(metrics.activeDays)} active days.${streak}`,
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
