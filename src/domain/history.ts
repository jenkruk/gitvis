/**
 * Multi-year history: 12-month periods, per-platform coverage, and the honest
 * summaries built from them. Pure.
 *
 * Periods are rolling 365-day windows ending on the dataset's last day, newest
 * first, so period 1 is exactly the familiar "last 12 months" calendar.
 */
import { intersect } from "./combine";
import { addDays, type DateRange, diffDays, isWithinRange } from "./dates";
import type { ContributionDataset, PlatformContributions, PlatformId } from "./types";

export const HISTORY_YEARS = [1, 2, 3] as const;
export type HistoryYears = (typeof HISTORY_YEARS)[number];
export const MAX_HISTORY_YEARS: HistoryYears = 3;

const PERIOD_DAYS = 365;

/** The range `years` 12-month periods cover, ending at `end`. `years = 1` equals `trailingYear(end)`. */
export function historyRange(end: DateRange["end"], years: number): DateRange {
  return { start: addDays(end, -(PERIOD_DAYS * years - 1)), end };
}

/** Number of (possibly partial) 12-month periods a range spans. */
export function periodCount(range: DateRange): number {
  return Math.max(1, Math.ceil((diffDays(range.start, range.end) + 1) / PERIOD_DAYS));
}

/** The dates a source covers within `range` (undefined coverage = all of it). */
export function sourceCoverage(source: PlatformContributions, range: DateRange): DateRange | null {
  if (source.coverage === undefined) return range;
  return source.coverage && intersect(source.coverage, range);
}

/**
 * The span every connected platform covers — the only span where combined,
 * cross-platform metrics are complete. Null when the platforms never overlap.
 */
export function coveredSpan(dataset: ContributionDataset): DateRange | null {
  let span: DateRange | null = dataset.range;
  for (const source of dataset.sources) {
    const covered = sourceCoverage(source, dataset.range);
    span = span && covered && intersect(span, covered);
  }
  return span;
}

export type PeriodPlatformStatus =
  | { platform: PlatformId; status: "complete"; total: number }
  /** Some or all of the period lies outside what the platform publishes. */
  | { platform: PlatformId; status: "unavailable" };

export interface PeriodSummary {
  range: DateRange;
  /** 0 = most recent. */
  index: number;
  platforms: PeriodPlatformStatus[];
  /** Sum over platforms with complete data. */
  total: number;
  /** True only when every connected platform covers the whole period. */
  complete: boolean;
}

/**
 * One summary per 12-month period, newest first. A platform's total is only
 * reported when it covers the WHOLE period; otherwise it's "unavailable", so a
 * partial count is never presented as a complete one.
 */
export function periodSummaries(dataset: ContributionDataset): PeriodSummary[] {
  const count = periodCount(dataset.range);
  return Array.from({ length: count }, (_, index) => {
    const end = addDays(dataset.range.end, -PERIOD_DAYS * index);
    const start = addDays(end, -(PERIOD_DAYS - 1));
    const range = { start: start < dataset.range.start ? dataset.range.start : start, end };
    const platforms = dataset.sources.map((source): PeriodPlatformStatus => {
      const covered = sourceCoverage(source, range);
      if (!covered || covered.start !== range.start || covered.end !== range.end) {
        return { platform: source.platform, status: "unavailable" };
      }
      const total = source.days.reduce((sum, d) => (isWithinRange(d.date, range) ? sum + d.count : sum), 0);
      return { platform: source.platform, status: "complete", total };
    });
    const total = platforms.reduce((sum, p) => (p.status === "complete" ? sum + p.total : sum), 0);
    return { range, index, platforms, total, complete: platforms.every((p) => p.status === "complete") };
  });
}

/** True when at least one platform has data for some day of the period. */
export function periodHasData(dataset: ContributionDataset, range: DateRange): boolean {
  return dataset.sources.some((s) => sourceCoverage(s, range) !== null);
}
