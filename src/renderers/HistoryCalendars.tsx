import type { ReactNode } from "react";
import { isWithinRange } from "@/domain/dates";
import type { PeriodSummary } from "@/domain/history";
import type { ContributionDataset, PlatformId } from "@/domain/types";
import type { ThemeTokens } from "@/theme/palettes";
import { Heatmap, measureHeatmap } from "./Heatmap";
import { heatmapThresholds } from "./heatmap-model";
import { FONT_STACK, formatNumber, Panel } from "./primitives";
import { periodCoverage, periodTotal, rangeLabel } from "./view";

const HEADER_HEIGHT = 40;
const CONTENT_GAP = 14;

export interface CardContent {
  height: number;
  render: (x: number, y: number, width: number) => ReactNode;
}

export function historyScale(view: ContributionDataset): [number, number, number] {
  return heatmapThresholds(view.days.map((d) => d.total));
}

function daysOf(view: ContributionDataset, period: PeriodSummary) {
  return view.days.filter((d) => isWithinRange(d.date, period.range));
}

export function yearCardHeight(
  view: ContributionDataset,
  period: PeriodSummary,
  width: number,
  padding: number,
  showLegend: boolean,
  content?: CardContent,
): number {
  const extra = content ? content.height + CONTENT_GAP : 0;
  return (
    padding * 2 + HEADER_HEIGHT + extra + measureHeatmap(daysOf(view, period), width - padding * 2, showLegend).height
  );
}

export function YearCard({
  view,
  period,
  theme,
  x,
  y,
  width,
  padding,
  showLegend,
  scale,
  content,
  current = false,
}: {
  view: ContributionDataset;
  period: PeriodSummary;
  theme: ThemeTokens;
  x: number;
  y: number;
  width: number;
  padding: number;
  showLegend: boolean;
  scale: readonly [number, number, number];
  content?: CardContent;
  current?: boolean;
}) {
  const inner = width - padding * 2;
  const left = x + padding;
  const top = y + padding;
  const height = yearCardHeight(view, period, width, padding, showLegend, content);
  const calendarY = top + HEADER_HEIGHT + (content ? content.height + CONTENT_GAP : 0);
  const platforms: PlatformId[] = view.sources.map((s) => s.platform);
  const strong = { fontFamily: FONT_STACK, fontSize: 13, fontWeight: 600, fill: theme.text };
  return (
    <g>
      <Panel x={x} y={y} width={width} height={height} theme={theme} />
      <text x={left} y={top + 14} {...strong}>
        {rangeLabel(period.range)}
      </text>
      {current && period.platforms.some((p) => p.status === "complete") ? (
        <text x={left + inner} y={top + 29} textAnchor="end" fontFamily={FONT_STACK}>
          <tspan fontSize={22} fontWeight={700} fill={theme.text}>
            {formatNumber(period.total)}
          </tspan>
          <tspan dx={6} fontSize={12} fill={theme.textMuted}>
            {period.total === 1 ? "contribution" : "contributions"}
          </tspan>
        </text>
      ) : (
        <text x={left + inner} y={top + 14} textAnchor="end" {...strong}>
          {periodTotal(period)}
        </text>
      )}
      <text x={left} y={top + 32} fontSize={11} fill={theme.textMuted} fontFamily={FONT_STACK}>
        {periodCoverage(period)}
      </text>
      {content?.render(left, top + HEADER_HEIGHT, inner)}
      <Heatmap
        days={daysOf(view, period)}
        theme={theme}
        x={left}
        y={calendarY}
        width={inner}
        showLegend={showLegend}
        scale={scale}
        platforms={platforms}
      />
    </g>
  );
}

const SUMMARY_ROW = 52;
const SUMMARY_GAP = 12;

export function measureYearlySummary(periods: PeriodSummary[]): number {
  return periods.length * SUMMARY_ROW + Math.max(0, periods.length - 1) * SUMMARY_GAP;
}

export function YearlySummary({
  periods,
  theme,
  x,
  y,
  width,
}: {
  periods: PeriodSummary[];
  theme: ThemeTokens;
  x: number;
  y: number;
  width: number;
}) {
  return (
    <g>
      {periods.map((period, i) => {
        const top = y + i * (SUMMARY_ROW + SUMMARY_GAP);
        return (
          <g key={period.range.end}>
            {i > 0 && (
              <line x1={x} x2={x + width} y1={top - SUMMARY_GAP / 2} y2={top - SUMMARY_GAP / 2} stroke={theme.border} />
            )}
            <text fontFamily={FONT_STACK}>
              <tspan x={x} y={top + 13} fontSize={12} fontWeight={600} fill={theme.text}>
                {rangeLabel(period.range)}
              </tspan>
              <tspan x={x} y={top + 31} fontSize={12} fontWeight={600} fill={theme.text}>
                {periodTotal(period)}
              </tspan>
              <tspan x={x} y={top + 47} fontSize={11} fill={theme.textMuted}>
                {periodCoverage(period)}
              </tspan>
            </text>
          </g>
        );
      })}
    </g>
  );
}
