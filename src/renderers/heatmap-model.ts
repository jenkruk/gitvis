import { dayOfWeek, diffDays, formatDate, startOfWeek } from "@/domain/dates";
import type { CombinedDay } from "@/domain/types";

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

/**
 * Quartile thresholds over *active* days, so a single outlier doesn't wash out
 * the rest of the year. Returns [q1, q2, q3]; level 4 is anything above q3.
 */
export function heatmapThresholds(counts: readonly number[]): [number, number, number] {
  const active = counts.filter((c) => c > 0).sort((a, b) => a - b);
  if (active.length === 0) return [0, 0, 0];
  const at = (p: number) => active[Math.min(active.length - 1, Math.floor(p * active.length))]!;
  return [at(0.25), at(0.5), at(0.75)];
}

export function heatLevel(count: number, [q1, q2, q3]: readonly [number, number, number]): HeatLevel {
  if (count <= 0) return 0;
  if (count <= q1) return 1;
  if (count <= q2) return 2;
  if (count <= q3) return 3;
  return 4;
}

export interface HeatmapCell {
  day: CombinedDay;
  column: number;
  /** 0 = Sunday … 6 = Saturday */
  row: number;
  level: HeatLevel;
}

export interface HeatmapGrid {
  cells: HeatmapCell[];
  columns: number;
  monthLabels: { label: string; column: number }[];
}

/** Lays days out as week columns (Sunday-first rows) with month labels. */
export function buildHeatmapGrid(
  days: readonly CombinedDay[],
  /** Shared scale across several calendars (multi-year); defaults to this calendar's own quartiles. */
  scale?: readonly [number, number, number],
): HeatmapGrid {
  const first = days[0];
  if (!first) return { cells: [], columns: 0, monthLabels: [] };

  const origin = startOfWeek(first.date);
  const thresholds = scale ?? heatmapThresholds(days.map((d) => d.total));
  const cells = days.map((day) => ({
    day,
    column: Math.floor(diffDays(origin, day.date) / 7),
    row: dayOfWeek(day.date),
    level: heatLevel(day.total, thresholds),
  }));

  const starts = cells.filter((c, i) => i === 0 || c.day.date.endsWith("-01"));
  const monthLabels = starts
    .map((c) => ({ label: formatDate(c.day.date, "month"), column: c.column }))
    // Drop a label that would collide with the next one (e.g. a partial first month).
    .filter((label, i, all) => {
      const next = all[i + 1];
      return !next || next.column - label.column >= 3;
    });

  return { cells, columns: (cells.at(-1)?.column ?? 0) + 1, monthLabels };
}

export interface HeatmapGeometry {
  cell: number;
  gap: number;
  step: number;
  labelWidth: number;
  monthLabelHeight: number;
  legendHeight: number;
  gridWidth: number;
  height: number;
}

/** Fits the grid to `width`, capping cell size so short ranges don't balloon. */
export function heatmapGeometry(columns: number, width: number, showLegend: boolean): HeatmapGeometry {
  const labelWidth = 28;
  const gap = 3;
  const cell = Math.max(4, Math.min(14, Math.floor((width - labelWidth + gap) / Math.max(columns, 1)) - gap));
  const step = cell + gap;
  const monthLabelHeight = 16;
  const legendHeight = showLegend ? 22 : 0;
  return {
    cell,
    gap,
    step,
    labelWidth,
    monthLabelHeight,
    legendHeight,
    gridWidth: labelWidth + columns * step - gap,
    height: monthLabelHeight + 7 * step - gap + legendHeight,
  };
}
