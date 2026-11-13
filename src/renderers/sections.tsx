import { formatDate, toISODate } from "@/domain/dates";
import { type ContributionDataset, PLATFORM_IDS, PLATFORMS, type PlatformId } from "@/domain/types";
import type { ContributionMetrics, SeriesPoint } from "@/metrics/metrics";
import type { ThemeTokens } from "@/theme/palettes";
import { FONT_STACK, formatNumber, formatPercent, PADDING, Panel } from "./primitives";
import type { StatItem } from "./stats";
import { type AttributionLayout, attributionLayout } from "./attribution";
import { maxCharsFor, wrapText } from "./text";

export function seriesColor(theme: ThemeTokens, platform: PlatformId): string {
  return theme.series[PLATFORM_IDS.indexOf(platform) % theme.series.length]!;
}

export const HEADER_HEIGHT = 40;

export function headerHeight(compact: boolean, showPlatformLabels: boolean, overflow = false): number {
  return (compact || overflow) && showPlatformLabels ? 58 : HEADER_HEIGHT;
}

export function headerAttribution(
  dataset: ContributionDataset,
  handles: readonly PlatformId[],
  width: number,
  compact: boolean,
): AttributionLayout {
  const sources = dataset.sources.filter((s) => handles.includes(s.platform));
  return attributionLayout(
    sources,
    `${formatDate(dataset.range.start)} – ${formatDate(dataset.range.end)}`,
    width,
    compact,
  );
}

export function Header({
  dataset,
  theme,
  y,
  width,
  showPlatformLabels,
  compact = false,
  handles = PLATFORM_IDS,
}: {
  dataset: ContributionDataset;
  theme: ThemeTokens;
  y: number;
  width: number;
  showPlatformLabels: boolean;
  compact?: boolean;
  handles?: readonly PlatformId[];
}) {
  const { range } = dataset;
  const sources = dataset.sources.filter((s) => handles.includes(s.platform));
  const rangeLabel = `${formatDate(range.start)} – ${formatDate(range.end)}`;
  const font = { fontFamily: FONT_STACK };
  const attribution = headerAttribution(dataset, handles, width, compact);
  const ownLine = attribution.ownLine;
  const labels =
    showPlatformLabels &&
    sources.map((source, i) => {
      const label = (
        <>
          <tspan dx={ownLine && i === 0 ? 0 : 10} fill={seriesColor(theme, source.platform)}>
            ●
          </tspan>
          <tspan dx={4} fill={theme.text}>
            {PLATFORMS[source.platform].label}
          </tspan>
          <tspan dx={4}>@{attribution.display(source)}</tspan>
        </>
      );
      return <tspan key={source.platform}>{label}</tspan>;
    });

  return (
    <g>
      <text x={PADDING} y={y + 15} fontSize={16} fontWeight={600} fill={theme.text} {...font}>
        Contribution activity
      </text>
      <text x={PADDING} y={y + 34} fontSize={11} fill={theme.textMuted} {...font}>
        <tspan>{rangeLabel}</tspan>
        {!ownLine && labels}
      </text>
      {ownLine && labels && (
        <text x={PADDING} y={y + 52} fontSize={11} fill={theme.textMuted} {...font}>
          {labels}
        </text>
      )}
      <StatusBadge dataset={dataset} theme={theme} x={PADDING + width} y={y} />
    </g>
  );
}

export const STATUS_BADGE_HEIGHT = 22;

export const hasStatusBadge = (dataset: ContributionDataset) =>
  dataset.provenance === "sample" || !!dataset.freshness?.stale;

export function StatusBadge({
  dataset,
  theme,
  x,
  y,
  anchor = "end",
}: {
  dataset: ContributionDataset;
  theme: ThemeTokens;
  x: number;
  y: number;
  anchor?: "end" | "middle";
}) {
  const right = (width: number) => (anchor === "middle" ? x + width / 2 : x);
  if (dataset.provenance === "sample") {
    return <Badge theme={theme} x={right(84)} y={y} width={84} text="Sample data" />;
  }
  if (dataset.freshness?.stale) {
    const text = `Data from ${formatDate(toISODate(dataset.freshness.asOf.slice(0, 10)))}`;
    return <Badge theme={theme} x={right(136)} y={y} width={136} text={text} />;
  }
  return null;
}

function Badge({
  theme,
  x,
  y,
  width,
  text,
}: {
  theme: ThemeTokens;
  x: number;
  y: number;
  width: number;
  text: string;
}) {
  const w = width;
  return (
    <g>
      <rect x={x - w} y={y} width={w} height={22} rx={11} fill={theme.surface} stroke={theme.accent} />
      <text
        x={x - w / 2}
        y={y + 15}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill={theme.text}
        fontFamily={FONT_STACK}
      >
        {text}
      </text>
    </g>
  );
}

/**
 * Panel titles ("Platform breakdown", chart titles) sit one step above stat labels: 12/600 in
 * the text color. Stat labels and axis text stay muted, so values and titles lead.
 */
export const PANEL_TITLE = { fontSize: 12, fontWeight: 600 } as const;

/** Approximate width of `text` at `fontSize` in the system stack (for laying out legend rows). */
const textWidth = (text: string, fontSize: number) => text.length * fontSize * 0.58;

/** One legend entry drawn as a real shape (circle or rounded square) followed by its label. */
function LegendKey({ x, y, color, shape }: { x: number; y: number; color: string; shape: "dot" | "square" }) {
  return shape === "dot" ? (
    <circle cx={x + 4} cy={y - 3.5} r={4} fill={color} />
  ) : (
    <rect x={x} y={y - 7.5} width={8} height={8} rx={2} fill={color} />
  );
}

const STAT_GAP = 12;

function cardHeight(detailed: boolean): number {
  return detailed ? 84 : 70;
}

export function statCardsHeight(
  detailed: boolean,
  count = 1,
  columns = Infinity,
  height = cardHeight(detailed),
): number {
  const rows = Math.ceil(count / Math.min(columns, Math.max(count, 1)));
  return rows * height + (rows - 1) * STAT_GAP;
}

export function StatCards({
  items,
  theme,
  x: left = PADDING,
  y,
  width,
  detailed,
  columns = Infinity,
  cardHeight: height = cardHeight(detailed),
  inset = 16,
}: {
  items: StatItem[];
  theme: ThemeTokens;
  x?: number;
  y: number;
  width: number;
  detailed: boolean;
  columns?: number;
  cardHeight?: number;
  /** Text inset from the card edge: the density's panel padding, like every other panel. */
  inset?: number;
}) {
  const perRow = Math.min(columns, items.length);
  const cardWidth = (width - STAT_GAP * (perRow - 1)) / perRow;
  const dense = height < cardHeight(detailed);
  const [labelY, valueY, detailY] = dense ? [18, 42, 60] : [22, 50, 70];
  const font = { fontFamily: FONT_STACK };

  return (
    <g>
      {items.map((item, index) => {
        const i = index % perRow;
        const row = Math.floor(index / perRow);
        const x = left + i * (cardWidth + STAT_GAP);
        const cardY = y + row * (height + STAT_GAP);
        return (
          <g key={item.id}>
            <Panel x={x} y={cardY} width={cardWidth} height={height} theme={theme} />
            <text x={x + inset} y={cardY + labelY} fontSize={11} fontWeight={500} fill={theme.textMuted} {...font}>
              {item.label}
            </text>
            <text x={x + inset} y={cardY + valueY} fontSize={22} fontWeight={700} fill={theme.text} {...font}>
              {item.value}
            </text>
            {detailed && (
              <text x={x + inset} y={cardY + detailY} fontSize={10} fill={theme.textMuted} {...font}>
                {item.detail}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

const INLINE_STATS = { fontSize: 13, lineHeight: 18 };

function packInlineStats(items: StatItem[], width: number): StatItem[][] {
  const limit = maxCharsFor(width, INLINE_STATS.fontSize);
  const lines: StatItem[][] = [];
  let current: StatItem[] = [];
  let length = 0;
  for (const item of items) {
    const added = (current.length ? 5 : 0) + item.inline.length;
    if (current.length && length + added > limit) {
      lines.push(current);
      current = [];
      length = 0;
    }
    length += (current.length ? 5 : 0) + item.inline.length;
    current.push(item);
  }
  if (current.length) lines.push(current);
  return lines;
}

export function inlineStatsHeight(items: StatItem[], width: number): number {
  return packInlineStats(items, width).length * INLINE_STATS.lineHeight;
}

export function InlineStats({
  items,
  theme,
  x = PADDING,
  y,
  width,
}: {
  items: StatItem[];
  theme: ThemeTokens;
  x?: number;
  y: number;
  width: number;
}) {
  return (
    <text fontSize={INLINE_STATS.fontSize} fill={theme.text} fontFamily={FONT_STACK}>
      {packInlineStats(items, width).map((line, row) => (
        <tspan key={line[0]!.id} x={x} y={y + 13 + row * INLINE_STATS.lineHeight}>
          {line.map((item, i) => (
            <tspan key={item.id}>
              {i > 0 && <tspan fill={theme.textMuted}>{"  ·  "}</tspan>}
              {item.inline}
            </tspan>
          ))}
        </tspan>
      ))}
    </text>
  );
}

export const BREAKDOWN_HEIGHT = 74;

export function PlatformBreakdown({
  metrics,
  theme,
  y,
  width,
  height = BREAKDOWN_HEIGHT,
  period,
  inset = 16,
}: {
  metrics: ContributionMetrics;
  theme: ThemeTokens;
  y: number;
  width: number;
  height?: number;
  period?: string;
  inset?: number;
}) {
  const inner = width - inset * 2;
  const left = PADDING + inset;
  const dense = height < BREAKDOWN_HEIGHT;
  const [titleY, barOffset, legendY] = dense ? [18, 26, 50] : [22, 32, 62];
  const barY = y + barOffset;
  const font = { fontFamily: FONT_STACK };
  const segments = metrics.platformTotals.map(({ platform, share }, i, all) => ({
    platform,
    x: left + inner * all.slice(0, i).reduce((sum, p) => sum + p.share, 0),
    width: inner * share,
  }));

  return (
    <g>
      <Panel x={PADDING} y={y} width={width} height={height} theme={theme} />
      <text x={left} y={y + titleY} {...PANEL_TITLE} fill={theme.text} {...font}>
        {period ? `Platform breakdown · ${period}` : "Platform breakdown"}
      </text>
      <rect x={left} y={barY} width={inner} height={10} rx={5} fill={theme.heatmapEmpty} />
      {segments.map(({ platform, x, width: w }) =>
        w > 0 ? <rect key={platform} x={x} y={barY} width={w} height={10} fill={seriesColor(theme, platform)} /> : null,
      )}
      {metrics.platformTotals.map(({ platform, total, share }, i) => {
        const x = left + i * Math.min(220, inner / 2);
        return (
          <g key={platform}>
            <LegendKey x={x} y={y + legendY} color={seriesColor(theme, platform)} shape="dot" />
            <text x={x + 14} y={y + legendY} fontSize={11} fill={theme.textMuted} {...font}>
              <tspan fill={theme.text} fontWeight={600}>
                {PLATFORMS[platform].label}
              </tspan>
              <tspan dx={6}>
                {formatNumber(total)} · {formatPercent(share)}
              </tspan>
            </text>
          </g>
        );
      })}
    </g>
  );
}

export const TRENDS_HEIGHT = 170;
const TRENDS_GAP = 16;

export function trendsHeight(stacked: boolean, panelHeight = TRENDS_HEIGHT): number {
  return stacked ? panelHeight * 2 + TRENDS_GAP : panelHeight;
}

export function TrendCharts({
  metrics,
  dataset,
  theme,
  y,
  width,
  stacked = false,
  panelHeight = TRENDS_HEIGHT,
  period,
  inset = CHART_SIDE,
}: {
  metrics: ContributionMetrics;
  dataset: ContributionDataset;
  theme: ThemeTokens;
  y: number;
  width: number;
  stacked?: boolean;
  panelHeight?: number;
  period?: string;
  inset?: number;
}) {
  const panelWidth = stacked ? width : (width - TRENDS_GAP) / 2;
  return (
    <g>
      <WeeklyTrend
        weeks={metrics.weekly}
        theme={theme}
        x={PADDING}
        y={y}
        width={panelWidth}
        height={panelHeight}
        period={period}
        inset={inset}
      />
      <MonthlyComparison
        months={metrics.monthly}
        platforms={dataset.sources.map((s) => s.platform)}
        theme={theme}
        x={stacked ? PADDING : PADDING + panelWidth + TRENDS_GAP}
        y={stacked ? y + panelHeight + TRENDS_GAP : y}
        height={panelHeight}
        width={panelWidth}
        period={period}
        inset={inset}
      />
    </g>
  );
}

interface ChartProps {
  theme: ThemeTokens;
  x: number;
  y: number;
  width: number;
  height: number;
  period?: string;
  inset: number;
}

const CHART_SIDE = 16;
const CHART = { top: 40, bottom: 26 };

function ChartTitle({
  theme,
  x,
  y,
  inset,
  children,
}: {
  theme: ThemeTokens;
  x: number;
  y: number;
  inset: number;
  children: string;
}) {
  return (
    <text x={x + inset} y={y + 22} {...PANEL_TITLE} fill={theme.text} fontFamily={FONT_STACK}>
      {children}
    </text>
  );
}

function WeeklyTrend({ weeks, theme, x, y, width, height, period, inset }: ChartProps & { weeks: SeriesPoint[] }) {
  const full = weeks.filter((w) => w.dayCount === 7);
  const plotW = width - inset * 2;
  const plotH = height - CHART.top - CHART.bottom;
  const left = x + inset;
  const baseline = y + CHART.top + plotH;
  const max = Math.max(1, ...full.map((w) => w.total));
  const points = full.map((w, i) => [
    left + (full.length > 1 ? (i / (full.length - 1)) * plotW : plotW / 2),
    baseline - (w.total / max) * plotH,
  ]);
  const line = points.map(([px, py], i) => `${i ? "L" : "M"}${px!.toFixed(1)} ${py!.toFixed(1)}`).join(" ");
  const font = { fontFamily: FONT_STACK, fontSize: 10, fill: theme.textMuted };

  return (
    <g>
      <Panel x={x} y={y} width={width} height={height} theme={theme} />
      <ChartTitle theme={theme} x={x} y={y} inset={inset}>
        {period ? `Weekly contributions · ${period}` : "Weekly contributions"}
      </ChartTitle>
      <text x={x + width - inset} y={y + 22} textAnchor="end" {...font}>
        Peak {formatNumber(max)} per week
      </text>
      <line x1={left} x2={left + plotW} y1={baseline} y2={baseline} stroke={theme.border} />
      {points.length > 1 && (
        <>
          <path
            d={`${line} L${left + plotW} ${baseline} L${left} ${baseline} Z`}
            fill={theme.accent}
            fillOpacity={0.16}
          />
          <path
            d={line}
            fill="none"
            stroke={theme.accent}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </>
      )}
      {full.length > 0 && (
        <>
          <text x={left} y={baseline + 16} {...font}>
            {formatDate(full[0]!.start)}
          </text>
          <text x={left + plotW} y={baseline + 16} textAnchor="end" {...font}>
            {formatDate(full.at(-1)!.start)}
          </text>
        </>
      )}
    </g>
  );
}

/** Right-aligned legend row (key 8px + 4px gap + label, 12px between entries) ending at `right`. */
function legendRow(platforms: PlatformId[], right: number): { platform: PlatformId; x: number }[] {
  const widths = platforms.map((p) => 12 + textWidth(PLATFORMS[p].label, 10));
  let x = right - widths.reduce((sum, w) => sum + w, 0) - 12 * (platforms.length - 1);
  return platforms.map((platform, i) => {
    const entry = { platform, x };
    x += widths[i]! + 12;
    return entry;
  });
}

function MonthlyComparison({
  months,
  platforms,
  theme,
  x,
  y,
  width,
  height,
  period,
  inset,
}: ChartProps & { months: SeriesPoint[]; platforms: PlatformId[] }) {
  const plotW = width - inset * 2;
  const plotH = height - CHART.top - CHART.bottom;
  const left = x + inset;
  const baseline = y + CHART.top + plotH;
  const max = Math.max(1, ...months.map((m) => m.total));
  const slot = plotW / Math.max(months.length, 1);
  const barW = Math.max(4, slot * 0.62);
  const font = { fontFamily: FONT_STACK, fontSize: 10, fill: theme.textMuted };

  return (
    <g>
      <Panel x={x} y={y} width={width} height={height} theme={theme} />
      <ChartTitle theme={theme} x={x} y={y} inset={inset}>
        {period ? `Monthly by platform · ${period}` : "Monthly by platform"}
      </ChartTitle>
      {legendRow(platforms, x + width - inset).map(({ platform, x: lx }) => (
        <g key={platform}>
          <LegendKey x={lx} y={y + 22} color={seriesColor(theme, platform)} shape="square" />
          <text x={lx + 12} y={y + 22} {...font}>
            {PLATFORMS[platform].label}
          </text>
        </g>
      ))}
      <line x1={left} x2={left + plotW} y1={baseline} y2={baseline} stroke={theme.border} />
      {months.map((month, i) => {
        const bx = left + i * slot + (slot - barW) / 2;
        let top = baseline;
        return (
          <g key={month.start}>
            {platforms.map((p) => {
              const h = ((month.byPlatform[p] ?? 0) / max) * plotH;
              top -= h;
              return h > 0 ? (
                <rect key={p} x={bx} y={top} width={barW} height={h} fill={seriesColor(theme, p)} />
              ) : null;
            })}
            <text x={bx + barW / 2} y={baseline + 16} textAnchor="middle" {...font}>
              {formatDate(month.start, "month").slice(0, 1)}
            </text>
            <title>{`${formatDate(month.start, "monthYear")}: ${formatNumber(month.total)} contributions`}</title>
          </g>
        );
      })}
    </g>
  );
}

const FOOTNOTE_TEXT =
  "Contributions as reported by each platform, not commits. Platforms count different activities; totals aren’t deduplicated.";
const FOOTNOTE = { fontSize: 10, lineHeight: 14 };

export function footnoteHeight(width: number): number {
  return (wrapText(FOOTNOTE_TEXT, width, FOOTNOTE.fontSize).length - 1) * FOOTNOTE.lineHeight + 12;
}

export function Footnote({ theme, y, width }: { theme: ThemeTokens; y: number; width: number }) {
  return (
    <text fontSize={FOOTNOTE.fontSize} fill={theme.textMuted} fontFamily={FONT_STACK}>
      {wrapText(FOOTNOTE_TEXT, width, FOOTNOTE.fontSize).map((line, i) => (
        <tspan key={i} x={PADDING} y={y + 10 + i * FOOTNOTE.lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/** The credit is a quiet signature, not a heading: the smallest text on the graphic, in the muted color. */
export const CREDIT_HEIGHT = 30;
export const CREDIT_BOTTOM = 16;
const CREDIT_SIZE = 10;

export function Credit({ theme, y }: { theme: ThemeTokens; y: number }) {
  return (
    <text
      x={PADDING}
      y={y + CREDIT_HEIGHT}
      fontSize={CREDIT_SIZE}
      letterSpacing={0.2}
      fill={theme.textMuted}
      fontFamily={FONT_STACK}
    >
      Made with GitVis · created by Jen Kruk
    </text>
  );
}
