import { isWithinRange } from "@/domain/dates";
import type { PeriodSummary } from "@/domain/history";
import type { ContributionDataset } from "@/domain/types";
import type { ThemeTokens } from "@/theme/palettes";
import { Heatmap, measureHeatmap } from "./Heatmap";
import { heatmapThresholds } from "./heatmap-model";
import { FONT_STACK } from "./primitives";
import { periodHeadline, rangeLabel } from "./view";

/*
 * Multi-year history: one calendar per 12-month period, newest first, each with
 * a one-line title (dates + yearly summary, e.g. "965 contributions · GitHub only").
 * Missing platform history is explained ONCE, in the scope note under the stats —
 * repeating it per calendar added clutter without information (verified on
 * real-data screenshots). Tooltips, the description and the data table keep the
 * per-period detail. No hatching: words carry coverage.
 */

const TITLE_HEIGHT = 18;
const PERIOD_GAP = 14;

function daysOf(view: ContributionDataset, period: PeriodSummary) {
  return view.days.filter((d) => isWithinRange(d.date, period.range));
}

function periodHeight(view: ContributionDataset, period: PeriodSummary, width: number, last: boolean): number {
  return TITLE_HEIGHT + measureHeatmap(daysOf(view, period), width, last).height;
}

export function measureHistoryCalendars(periods: PeriodSummary[], view: ContributionDataset, width: number): number {
  return periods.reduce((height, period, i) => {
    const last = i === periods.length - 1;
    return height + periodHeight(view, period, width, last) + (last ? 0 : PERIOD_GAP);
  }, 0);
}

export function HistoryCalendars({
  periods,
  view,
  theme,
  x,
  y,
  width,
}: {
  periods: PeriodSummary[];
  view: ContributionDataset;
  theme: ThemeTokens;
  x: number;
  y: number;
  width: number;
}) {
  // One color scale across every year, so a dark cell means the same in each calendar.
  const scale = heatmapThresholds(view.days.map((d) => d.total));
  const platforms = view.sources.map((s) => s.platform);
  const tops = periods.reduce<number[]>(
    (acc, _period, i) =>
      i === 0 ? [y] : [...acc, acc[i - 1]! + periodHeight(view, periods[i - 1]!, width, false) + PERIOD_GAP],
    [],
  );
  return (
    <g>
      {periods.map((period, i) => {
        const titleY = tops[i]!;
        return (
          <g key={period.range.end}>
            <text x={x} y={titleY + 12} fontSize={12} fontWeight={600} fill={theme.text} fontFamily={FONT_STACK}>
              {rangeLabel(period.range)}
            </text>
            <text
              x={x + width}
              y={titleY + 12}
              textAnchor="end"
              fontSize={12}
              fill={theme.textMuted}
              fontFamily={FONT_STACK}
            >
              {periodHeadline(period)}
            </text>
            <Heatmap
              days={daysOf(view, period)}
              theme={theme}
              x={x}
              y={titleY + TITLE_HEIGHT}
              width={width}
              showLegend={i === periods.length - 1}
              scale={scale}
              platforms={platforms}
            />
          </g>
        );
      })}
    </g>
  );
}

/* Phones: a readable list of yearly summaries instead of three shrunken calendars. */

const SUMMARY_ROW = 34;
const SUMMARY_GAP = 8;

export function measureYearlySummary(periods: PeriodSummary[]): number {
  return periods.length * SUMMARY_ROW + Math.max(0, periods.length - 1) * SUMMARY_GAP;
}

export function YearlySummary({
  periods,
  theme,
  x,
  y,
}: {
  periods: PeriodSummary[];
  theme: ThemeTokens;
  x: number;
  y: number;
}) {
  return (
    <g>
      {periods.map((period, i) => {
        const top = y + i * (SUMMARY_ROW + SUMMARY_GAP);
        return (
          <text key={period.range.end} fontFamily={FONT_STACK} fontSize={12}>
            <tspan x={x} y={top + 12} fontWeight={600} fill={theme.text}>
              {rangeLabel(period.range)}
            </tspan>
            <tspan x={x} y={top + 29} fill={theme.textMuted}>
              {periodHeadline(period)}
            </tspan>
          </text>
        );
      })}
    </g>
  );
}
