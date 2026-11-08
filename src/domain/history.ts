/**
 * Multi-year history: 12-month periods, per-platform coverage, and the honest
 * summaries built from them. Pure.
 *
 * The newest period is each platform's own published year, so its totals match
 * the numbers on the user's profiles (see `platformYear`). Older periods are
 * 365-day windows counting back from it, newest first.
 */
import { intersect } from "./combine";
import { addDays, type DateRange, diffDays, isWithinRange, oneYearBefore, startOfWeek } from "./dates";
import type { ContributionDataset, PlatformContributions, PlatformId } from "./types";

export const HISTORY_YEARS = [1, 2, 3] as const;
export type HistoryYears = (typeof HISTORY_YEARS)[number];
export const MAX_HISTORY_YEARS: HistoryYears = 3;

const PERIOD_DAYS = 365;

/**
 * The window behind each platform's own yearly total (verified November 2026):
 * - GitHub's "N contributions in the last year" counts from the Sunday of the
 *   week one year back (its calendar grid shows only 53 weeks, but the headline
 *   total covers the whole span), so it is 366–372 days long.
 * - GitLab's "N contributions in the last 12 months" counts from the same date
 *   one year back.
 */
export function platformYear(platform: PlatformId, end: DateRange["end"]): DateRange {
  const yearAgo = oneYearBefore(end);
  return { start: platform === "github" ? startOfWeek(yearAgo) : yearAgo, end };
}

/** The newest period for these platforms: the union of their own years (GitHub's starts earliest). */
export function newestPeriod(platforms: readonly PlatformId[], end: DateRange["end"]): DateRange {
  if (platforms.length === 0) return { start: addDays(end, -(PERIOD_DAYS - 1)), end };
  const start = platforms.map((p) => platformYear(p, end).start).sort()[0]!;
  return { start, end };
}

/** A dataset's newest period, clipped to the dataset (older or sample data may be shorter). */
export function newestPeriodOf(dataset: ContributionDataset): DateRange {
  const newest = newestPeriod(
    dataset.sources.map((s) => s.platform),
    dataset.range.end,
  );
  return intersect(newest, dataset.range) ?? dataset.range;
}

/** The range `years` periods cover: the newest period plus whole 365-day periods before it. */
export function historyRange(newest: DateRange, years: number): DateRange {
  return { start: addDays(newest.start, -PERIOD_DAYS * (years - 1)), end: newest.end };
}

/** Number of periods a dataset spans: its newest period plus any (possibly partial) older ones. */
export function periodCount(dataset: ContributionDataset): number {
  const before = diffDays(dataset.range.start, newestPeriodOf(dataset).start);
  return 1 + Math.max(0, Math.ceil(before / PERIOD_DAYS));
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
 * One summary per period, newest first. A platform's total is only reported
 * when it covers the WHOLE period — for the newest period, the whole of its own
 * published year — otherwise it's "unavailable", so a partial count is never
 * presented as a complete one.
 */
export function periodSummaries(dataset: ContributionDataset): PeriodSummary[] {
  const newest = newestPeriodOf(dataset);
  return Array.from({ length: periodCount(dataset) }, (_, index) => {
    const end = index === 0 ? newest.end : addDays(newest.start, -1 - PERIOD_DAYS * (index - 1));
    const start = index === 0 ? newest.start : addDays(end, -(PERIOD_DAYS - 1));
    const range = { start: start < dataset.range.start ? dataset.range.start : start, end };
    const platforms = dataset.sources.map((source): PeriodPlatformStatus => {
      const required = index === 0 ? (intersect(range, platformYear(source.platform, newest.end)) ?? range) : range;
      const covered = sourceCoverage(source, required);
      if (!covered || covered.start !== required.start || covered.end !== required.end) {
        return { platform: source.platform, status: "unavailable" };
      }
      const total = source.days.reduce((sum, d) => (isWithinRange(d.date, required) ? sum + d.count : sum), 0);
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
