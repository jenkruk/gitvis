import { isWithinRange } from "@/domain/dates";
import type { PeriodSummary } from "@/domain/history";
import type { ContributionDataset } from "@/domain/types";
import type { ThemeTokens } from "@/theme/palettes";
import { Heatmap, measureHeatmap } from "./Heatmap";
import { heatmapThresholds } from "./heatmap-model";
import { FONT_STACK } from "./primitives";
import { wrapText } from "./text";
import { periodCoverageNote, periodHeadline, rangeLabel } from "./view";

/*
 * Multi-year history: one calendar per 12-month period, newest first, each with
 * a one-line title (dates + yearly summary) and, when a platform has no data
 * for that period, a plain-text coverage note. No hatching: the words carry it.
 */

const TITLE_HEIGHT = 18;
const NOTE_LINE = 15;
const PERIOD_GAP = 14;
const NOTE_SIZE = 11;

function daysOf(view: ContributionDataset, period: PeriodSummary) {
  return view.days.filter((d) => isWithinRange(d.date, period.range));
}

function noteLines(period: PeriodSummary, width: number): string[] {
  const note = periodCoverageNote(period);
  return note ? wrapText(note, width, NOTE_SIZE) : [];
}

export function measureHistoryCalendars(periods: PeriodSummary[], view: ContributionDataset, width: number): number {
  return periods.reduce((height, period, i) => {
    const last = i === periods.length - 1;
    const calendar = measureHeatmap(daysOf(view, period), width, last).height;
    return height + TITLE_HEIGHT + noteLines(period, width).length * NOTE_LINE + calendar + (last ? 0 : PERIOD_GAP);
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
  // Precompute each period's layout (pure: no reassignment during render).
  const rows = periods.map((period, i) => ({
    period,
    last: i === periods.length - 1,
    days: daysOf(view, period),
    notes: noteLines(period, width),
  }));
  const tops = rows.reduce<number[]>((acc, row, i) => {
    if (i === 0) return [y];
    const prev = rows[i - 1]!;
    const prevHeight =
      TITLE_HEIGHT + prev.notes.length * NOTE_LINE + measureHeatmap(prev.days, width, prev.last).height + PERIOD_GAP;
    return [...acc, acc[i - 1]! + prevHeight];
  }, []);
  return (
    <g>
      {rows.map(({ period, last, days, notes }, i) => {
        const titleY = tops[i]!;
        const calendarY = titleY + TITLE_HEIGHT + notes.length * NOTE_LINE;
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
            {notes.length > 0 && (
              <text fontSize={NOTE_SIZE} fill={theme.textMuted} fontFamily={FONT_STACK}>
                {notes.map((line, n) => (
                  <tspan key={n} x={x} y={titleY + TITLE_HEIGHT + 10 + n * NOTE_LINE}>
                    {line}
                  </tspan>
                ))}
              </text>
            )}
            <Heatmap
              days={days}
              theme={theme}
              x={x}
              y={calendarY}
              width={width}
              showLegend={last}
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

const SUMMARY_LABEL = 16;
const SUMMARY_LINE = 15;
const SUMMARY_GAP = 8;

function summaryLines(period: PeriodSummary, width: number): string[] {
  const note = periodCoverageNote(period);
  return [periodHeadline(period), ...(note ? wrapText(note, width, NOTE_SIZE) : [])];
}

export function measureYearlySummary(periods: PeriodSummary[], width: number): number {
  return periods.reduce(
    (h, p, i) => h + SUMMARY_LABEL + summaryLines(p, width).length * SUMMARY_LINE + (i ? SUMMARY_GAP : 0),
    0,
  );
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
  const rows = periods.map((period) => ({ period, lines: summaryLines(period, width) }));
  const starts = rows.reduce<number[]>(
    (acc, row, i) =>
      i === 0 ? [y] : [...acc, acc[i - 1]! + SUMMARY_LABEL + rows[i - 1]!.lines.length * SUMMARY_LINE + SUMMARY_GAP],
    [],
  );
  return (
    <g>
      {rows.map(({ period, lines }, i) => {
        const start = starts[i]!;
        return (
          <text key={period.range.end} fontFamily={FONT_STACK}>
            <tspan x={x} y={start + 12} fontSize={12} fontWeight={600} fill={theme.text}>
              {rangeLabel(period.range)}
            </tspan>
            {lines.map((line, n) => (
              <tspan
                key={n}
                x={x}
                y={start + SUMMARY_LABEL + 11 + n * SUMMARY_LINE}
                fontSize={n === 0 ? 12 : NOTE_SIZE}
                fill={n === 0 ? theme.text : theme.textMuted}
              >
                {line}
              </tspan>
            ))}
          </text>
        );
      })}
    </g>
  );
}
