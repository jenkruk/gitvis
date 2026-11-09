import { finalText, hasTitle, isFeatureVisible, type VisualizationConfig } from "@/config/config";
import { formatDate, toISODate } from "@/domain/dates";
import { type ContributionDataset, PLATFORMS } from "@/domain/types";
import { computeMetrics, type ContributionMetrics } from "@/metrics/metrics";
import { applyPanelStyle, gradientEnd, panelBackdrops, resolveTheme, withPlatformHeatmap } from "@/theme/palettes";
import { CenteredHeader, centeredHeaderHeight } from "./CenteredHeader";
import { type AvatarImages, IdentityHeader, identityHeaderHeight } from "./IdentityHeader";
import { LAYOUT_SECTIONS, SPACING } from "./layouts";
import { CANVAS_WIDTHS, type CardSize, contentWidthFor, formatNumber, PADDING, stackSections } from "./primitives";
import { Credit, CREDIT_BOTTOM, CREDIT_HEIGHT, Header, headerAttribution, headerHeight } from "./sections";
import { describePeriod, describeWindows, type PreparedView, prepareView } from "./view";

export interface VisualizationProps {
  dataset: ContributionDataset;
  config: VisualizationConfig;
  /** Pass precomputed metrics to avoid recomputation; derived from `dataset` otherwise. */
  metrics?: ContributionMetrics;
  /** Unique per page when several SVGs are rendered together (ARIA ids). */
  idPrefix?: string;
  /** "full" (840px, default) or "compact" (400px reflowed layout for narrow screens). */
  size?: CardSize;
  /** Render profile links (published files). The studio preview turns them off: links nested in role="img" are inaccessible. */
  links?: boolean;
  /** Embedded avatar images (data: URIs) for the identity header. */
  avatars?: AvatarImages;
}

/** Multi-year additions to the text alternative (empty for a single period, so legacy text is unchanged). */
export function describeHistory({
  periods,
  statsLabel,
  historyNote,
}: Pick<PreparedView, "periods" | "statsLabel" | "historyNote">): string {
  const parts = statsLabel ? [`Summary statistics: ${statsLabel.replace(" · ", ", ")}.`] : [];
  if (periods.length > 1) parts.push(`By 12-month period, newest first: ${periods.map(describePeriod).join(" ")}`);
  if (historyNote) parts.push(historyNote);
  return parts.join(" ");
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
    dataset.freshness?.stale
      ? `Showing data last updated ${formatDate(toISODate(dataset.freshness.asOf.slice(0, 10)))}; a refresh is pending.`
      : "",
    `${formatNumber(metrics.total)} contributions${where} from ${formatDate(dataset.range.start)} to ${formatDate(dataset.range.end)}.`,
    breakdown,
    describeWindows(dataset),
    `${formatNumber(metrics.activeDays)} active days.`,
    streak,
    best,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Phase 4: prefixes the description with the display name/title when set (unchanged otherwise). */
function describeIdentity(config: VisualizationConfig): string {
  const { style } = config.identity;
  const name = finalText(config.identity.name);
  const title = finalText(config.identity.title);
  if (style === "none" || !name) return "";
  return `Contribution activity for ${name}${hasTitle(style) && title ? `, ${title}` : ""}.`;
}

/**
 * The complete, self-contained SVG graphic. Pure: no hooks, no browser APIs,
 * inline presentation attributes only — safe for renderToStaticMarkup embeds.
 *
 * `dataset` may be the full year; the configured date range is applied here.
 * If `metrics` is passed it must describe the range-sliced dataset
 * (use `sliceToRecentDays(dataset, config.range)`).
 */
export function Visualization({
  dataset: fullDataset,
  config,
  metrics: provided,
  idPrefix = "gitvis",
  size = "full",
  links = true,
  avatars = {},
}: VisualizationProps) {
  const prepared = prepareView(fullDataset, config);
  // `dataset` = what the calendars and header show; metrics only cover what every platform reports.
  const { view: dataset, metricsView, periods, statsLabel, statsPeriod, historyNote } = prepared;
  const metrics = provided ?? computeMetrics(metricsView);
  const custom = config.platformColors;
  const base = resolveTheme(
    config.palette,
    config.mode,
    custom.github || custom.gitlab ? { series: [custom.github, custom.gitlab] } : {},
  );
  // Unfilled panels: content colors are checked against what's actually behind them.
  const panelled = applyPanelStyle(base, config.panel, panelBackdrops(base, config.background, config.mode));
  // Custom platform colors also color the heatmap by platform (after contrast adjustment above).
  const theme = custom.github || custom.gitlab ? withPlatformHeatmap(panelled) : panelled;
  const spacing = SPACING[config.density];
  const canvasWidth = CANVAS_WIDTHS[size];
  const compactCanvas = size === "compact";
  const showPlatformLabels = isFeatureVisible("platformLabels", config, dataset);
  const { identity } = config;
  const sections = LAYOUT_SECTIONS[config.layout]({
    dataset: metricsView,
    calendar: dataset,
    periods,
    statsLabel,
    statsPeriod,
    historyNote,
    metrics,
    theme,
    isVisible: (feature) => isFeatureVisible(feature, config, dataset),
    size,
    spacing,
    metricOrder: config.metricOrder,
  });

  const header =
    identity.style === "none"
      ? headerHeight(
          compactCanvas,
          showPlatformLabels && identity.handles.length > 0,
          headerAttribution(dataset, identity.handles, contentWidthFor(size), compactCanvas).ownLine,
        )
      : identity.style === "centered"
        ? centeredHeaderHeight(
            dataset,
            { ...identity, style: identity.style },
            compactCanvas,
            showPlatformLabels,
            contentWidthFor(size),
          )
        : identityHeaderHeight(
            dataset,
            { ...identity, style: identity.style },
            compactCanvas,
            showPlatformLabels,
            contentWidthFor(size),
          );
  const top = PADDING + header + spacing.sectionGap;
  const { nodes, bottom } = stackSections(sections, top, spacing.sectionGap);
  const creditTop = bottom - (sections.length === 0 ? spacing.sectionGap : 0);
  const height = Math.ceil(creditTop + CREDIT_HEIGHT + CREDIT_BOTTOM);
  const titleId = `${idPrefix}-title`;
  const descId = `${idPrefix}-desc`;
  const gradientId = `${idPrefix}-bg`;
  const description = [describeIdentity(config), describeVisualization(metricsView, metrics), describeHistory(prepared)]
    .filter(Boolean)
    .join(" ");

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={canvasWidth}
      height={height}
      viewBox={`0 0 ${canvasWidth} ${height}`}
      // Arrow cursor everywhere (no text cursor over labels); only profile links show the hand.
      // Profile-header designs only: the original header's output is frozen byte-for-byte.
      cursor={identity.style === "none" ? undefined : "default"}
      role="img"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <title id={titleId}>
        {identity.style !== "none" && finalText(identity.name)
          ? `Contribution activity — ${finalText(identity.name)}`
          : "Contribution activity"}
      </title>
      <desc id={descId}>{description}</desc>
      {config.background === "gradient" && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={theme.background} />
            <stop offset="1" stopColor={gradientEnd(base)} />
          </linearGradient>
        </defs>
      )}
      {config.background !== "transparent" && (
        <rect
          x={0.5}
          y={0.5}
          width={canvasWidth - 1}
          height={height - 1}
          rx={14}
          fill={config.background === "gradient" ? `url(#${gradientId})` : theme.background}
          stroke={theme.border}
        />
      )}
      {identity.style === "none" ? (
        <Header
          dataset={dataset}
          theme={theme}
          y={PADDING}
          width={contentWidthFor(size)}
          showPlatformLabels={showPlatformLabels}
          compact={compactCanvas}
          links={links}
          handles={identity.handles}
        />
      ) : identity.style === "centered" ? (
        <CenteredHeader
          dataset={dataset}
          theme={theme}
          identity={{ ...identity, style: identity.style }}
          avatars={avatars}
          y={PADDING}
          width={contentWidthFor(size)}
          compactCanvas={compactCanvas}
          showHandles={showPlatformLabels}
          links={links}
          idPrefix={idPrefix}
        />
      ) : (
        <IdentityHeader
          dataset={dataset}
          theme={theme}
          identity={{ ...identity, style: identity.style }}
          avatars={avatars}
          y={PADDING}
          width={contentWidthFor(size)}
          compactCanvas={compactCanvas}
          showHandles={showPlatformLabels}
          links={links}
          idPrefix={idPrefix}
        />
      )}
      {nodes}
      <Credit theme={theme} y={creditTop} />
    </svg>
  );
}
