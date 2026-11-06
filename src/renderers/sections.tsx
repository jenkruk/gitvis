import { formatDate } from "@/domain/dates";
import { type ContributionDataset, PLATFORM_IDS, PLATFORMS, type PlatformId } from "@/domain/types";
import type { ContributionMetrics, SeriesPoint } from "@/metrics/metrics";
import type { ThemeTokens } from "@/theme/palettes";
import { FONT_STACK, formatNumber, formatPercent, PADDING, Panel } from "./primitives";
import type { StatItem } from "./stats";

/** Platform → series color, stable regardless of which platforms are connected. */
export function seriesColor(theme: ThemeTokens, platform: PlatformId): string {
  return theme.series[PLATFORM_IDS.indexOf(platform) % theme.series.length]!;
}

/* ------------------------------------------------------------------ Header */

export const HEADER_HEIGHT = 40;

export function Header({
  dataset,
  theme,
  y,
  width,
  showPlatformLabels,
}: {
  dataset: ContributionDataset;
  theme: ThemeTokens;
  y: number;
  width: number;
  showPlatformLabels: boolean;
}) {
  const { range, sources, provenance } = dataset;
  const rangeLabel = `${formatDate(range.start)} – ${formatDate(range.end)}`;
  const font = { fontFamily: FONT_STACK };

  return (
    <g>
      <text x={PADDING} y={y + 15} fontSize={16} fontWeight={600} fill={theme.text} {...font}>
        Contribution activity
      </text>
      <text x={PADDING} y={y + 34} fontSize={11} fill={theme.textMuted} {...font}>
        <tspan>{rangeLabel}</tspan>
        {showPlatformLabels &&
          sources.map((source) => {
            const label = (
              <>
                <tspan dx={10} fill={seriesColor(theme, source.platform)}>
                  ●
                </tspan>
                <tspan dx={4} fill={theme.text}>
                  {PLATFORMS[source.platform].label}
                </tspan>
                <tspan dx={4}>@{source.username}</tspan>
              </>
            );
            return source.profileUrl ? (
              <a key={source.platform} href={source.profileUrl} target="_blank">
                {label}
              </a>
            ) : (
              <tspan key={source.platform}>{label}</tspan>
            );
          })}
      </text>
      {provenance === "sample" && <SampleBadge theme={theme} x={PADDING + width} y={y} />}
    </g>
  );
}

/** Non-removable label shown whenever the dataset is synthetic. */
function SampleBadge({ theme, x, y }: { theme: ThemeTokens; x: number; y: number }) {
  const w = 84;
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
        Sample data
      </text>
    </g>
  );
}

/* --------------------------------------------------------------- Stat cards */

export function statCardsHeight(detailed: boolean): number {
  return detailed ? 84 : 70;
}

export function StatCards({
  items,
  theme,
  y,
  width,
  detailed,
}: {
  items: StatItem[];
  theme: ThemeTokens;
  y: number;
  width: number;
  detailed: boolean;
}) {
  const gap = 12;
  const cardWidth = (width - gap * (items.length - 1)) / items.length;
  const height = statCardsHeight(detailed);
  const font = { fontFamily: FONT_STACK };

  return (
    <g>
      {items.map((item, i) => {
        const x = PADDING + i * (cardWidth + gap);
        return (
          <g key={item.id}>
            <Panel x={x} y={y} width={cardWidth} height={height} theme={theme} />
            <text x={x + 16} y={y + 22} fontSize={11} fontWeight={500} fill={theme.textMuted} {...font}>
              {item.label}
            </text>
            <text x={x + 16} y={y + 50} fontSize={22} fontWeight={700} fill={theme.text} {...font}>
              {item.value}
            </text>
            {detailed && (
              <text x={x + 16} y={y + 70} fontSize={10} fill={theme.textMuted} {...font}>
                {item.detail}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

/* ------------------------------------------------------------- Inline stats */

export function InlineStats({ items, theme, y }: { items: StatItem[]; theme: ThemeTokens; y: number }) {
  return (
    <text x={PADDING} y={y + 13} fontSize={13} fill={theme.text} fontFamily={FONT_STACK}>
      {items.map((item, i) => (
        <tspan key={item.id}>
          {i > 0 && <tspan fill={theme.textMuted}>{"  ·  "}</tspan>}
          {item.inline}
        </tspan>
      ))}
    </text>
  );
}

/* ------------------------------------------------------- Platform breakdown */

export const BREAKDOWN_HEIGHT = 74;

export function PlatformBreakdown({
  metrics,
  theme,
  y,
  width,
}: {
  metrics: ContributionMetrics;
  theme: ThemeTokens;
  y: number;
  width: number;
}) {
  const inner = width - 32;
  const barY = y + 32;
  const font = { fontFamily: FONT_STACK };
  const segments = metrics.platformTotals.map(({ platform, share }, i, all) => ({
    platform,
    x: PADDING + 16 + inner * all.slice(0, i).reduce((sum, p) => sum + p.share, 0),
    width: inner * share,
  }));

  return (
    <g>
      <Panel x={PADDING} y={y} width={width} height={BREAKDOWN_HEIGHT} theme={theme} />
      <text x={PADDING + 16} y={y + 22} fontSize={11} fontWeight={500} fill={theme.textMuted} {...font}>
        Platform breakdown
      </text>
      <rect x={PADDING + 16} y={barY} width={inner} height={10} rx={5} fill={theme.heatmapEmpty} />
      {segments.map(({ platform, x, width: w }) =>
        w > 0 ? <rect key={platform} x={x} y={barY} width={w} height={10} fill={seriesColor(theme, platform)} /> : null,
      )}
      {metrics.platformTotals.map(({ platform, total, share }, i) => (
        <text key={platform} x={PADDING + 16 + i * 220} y={y + 62} fontSize={11} fill={theme.textMuted} {...font}>
          <tspan fill={seriesColor(theme, platform)}>●</tspan>
          <tspan dx={6} fill={theme.text} fontWeight={600}>
            {PLATFORMS[platform].label}
          </tspan>
          <tspan dx={6}>
            {formatNumber(total)} · {formatPercent(share)}
          </tspan>
        </text>
      ))}
    </g>
  );
}

/* ----------------------------------------------------------- Trend charts */

export const TRENDS_HEIGHT = 170;

export function TrendCharts({
  metrics,
  dataset,
  theme,
  y,
  width,
}: {
  metrics: ContributionMetrics;
  dataset: ContributionDataset;
  theme: ThemeTokens;
  y: number;
  width: number;
}) {
  const gap = 16;
  const panelWidth = (width - gap) / 2;
  return (
    <g>
      <WeeklyTrend weeks={metrics.weekly} theme={theme} x={PADDING} y={y} width={panelWidth} />
      <MonthlyComparison
        months={metrics.monthly}
        platforms={dataset.sources.map((s) => s.platform)}
        theme={theme}
        x={PADDING + panelWidth + gap}
        y={y}
        width={panelWidth}
      />
    </g>
  );
}

interface ChartProps {
  theme: ThemeTokens;
  x: number;
  y: number;
  width: number;
}

const CHART = { top: 40, bottom: 26, side: 16 };

function ChartTitle({ theme, x, y, children }: { theme: ThemeTokens; x: number; y: number; children: string }) {
  return (
    <text x={x + CHART.side} y={y + 22} fontSize={11} fontWeight={500} fill={theme.textMuted} fontFamily={FONT_STACK}>
      {children}
    </text>
  );
}

/** Weekly totals as an area + line. Partial edge weeks are excluded so they don't read as dips. */
function WeeklyTrend({ weeks, theme, x, y, width }: ChartProps & { weeks: SeriesPoint[] }) {
  const full = weeks.filter((w) => w.dayCount === 7);
  const plotW = width - CHART.side * 2;
  const plotH = TRENDS_HEIGHT - CHART.top - CHART.bottom;
  const left = x + CHART.side;
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
      <Panel x={x} y={y} width={width} height={TRENDS_HEIGHT} theme={theme} />
      <ChartTitle theme={theme} x={x} y={y}>
        Weekly contributions
      </ChartTitle>
      <text x={x + width - CHART.side} y={y + 22} textAnchor="end" {...font}>
        peak {formatNumber(max)}/week
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

/** Stacked monthly bars, one segment per connected platform. */
function MonthlyComparison({
  months,
  platforms,
  theme,
  x,
  y,
  width,
}: ChartProps & { months: SeriesPoint[]; platforms: PlatformId[] }) {
  const plotW = width - CHART.side * 2;
  const plotH = TRENDS_HEIGHT - CHART.top - CHART.bottom;
  const left = x + CHART.side;
  const baseline = y + CHART.top + plotH;
  const max = Math.max(1, ...months.map((m) => m.total));
  const slot = plotW / Math.max(months.length, 1);
  const barW = Math.max(4, slot * 0.62);
  const font = { fontFamily: FONT_STACK, fontSize: 10, fill: theme.textMuted };

  return (
    <g>
      <Panel x={x} y={y} width={width} height={TRENDS_HEIGHT} theme={theme} />
      <ChartTitle theme={theme} x={x} y={y}>
        Monthly by platform
      </ChartTitle>
      <text x={x + width - CHART.side} y={y + 22} textAnchor="end" {...font}>
        {platforms.map((p, i) => (
          <tspan key={p} dx={i ? 10 : 0}>
            <tspan fill={seriesColor(theme, p)}>■</tspan> {PLATFORMS[p].label}
          </tspan>
        ))}
      </text>
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

/* ----------------------------------------------------------------- Footnote */

export const FOOTNOTE_HEIGHT = 12;

export function Footnote({ theme, y }: { theme: ThemeTokens; y: number }) {
  return (
    <text x={PADDING} y={y + 10} fontSize={10} fill={theme.textMuted} fontFamily={FONT_STACK}>
      Contributions as reported by each platform, not commits. Platforms count different activities; totals aren’t
      deduplicated.
    </text>
  );
}
