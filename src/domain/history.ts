import { intersect } from "./combine";
import { addDays, type DateRange, diffDays, isWithinRange, oneYearBefore, startOfWeek } from "./dates";
import type { ContributionDataset, PlatformContributions, PlatformId } from "./types";

export const HISTORY_YEARS = [1, 2, 3] as const;
export type HistoryYears = (typeof HISTORY_YEARS)[number];
export const MAX_HISTORY_YEARS: HistoryYears = 3;

const PERIOD_DAYS = 365;

export function platformYear(platform: PlatformId, end: DateRange["end"]): DateRange {
  const yearAgo = oneYearBefore(end);
  return { start: platform === "github" ? startOfWeek(yearAgo) : yearAgo, end };
}

export function newestPeriod(platforms: readonly PlatformId[], end: DateRange["end"]): DateRange {
  if (platforms.length === 0) return { start: addDays(end, -(PERIOD_DAYS - 1)), end };
  const start = platforms.map((p) => platformYear(p, end).start).sort()[0]!;
  return { start, end };
}

export function newestPeriodOf(dataset: ContributionDataset): DateRange {
  const newest = newestPeriod(
    dataset.sources.map((s) => s.platform),
    dataset.range.end,
  );
  return intersect(newest, dataset.range) ?? dataset.range;
}

export function historyRange(newest: DateRange, years: number): DateRange {
  return { start: addDays(newest.start, -PERIOD_DAYS * (years - 1)), end: newest.end };
}

export function periodCount(dataset: ContributionDataset): number {
  const before = diffDays(dataset.range.start, newestPeriodOf(dataset).start);
  return 1 + Math.max(0, Math.ceil(before / PERIOD_DAYS));
}

export function sourceCoverage(source: PlatformContributions, range: DateRange): DateRange | null {
  if (source.coverage === undefined) return range;
  return source.coverage && intersect(source.coverage, range);
}

export function coveredSpan(dataset: ContributionDataset): DateRange | null {
  let span: DateRange | null = dataset.range;
  for (const source of dataset.sources) {
    const covered = sourceCoverage(source, dataset.range);
    span = span && covered && intersect(span, covered);
  }
  return span;
}

export type PeriodPlatformStatus =
  { platform: PlatformId; status: "complete"; total: number } | { platform: PlatformId; status: "unavailable" };

export interface PeriodSummary {
  range: DateRange;
  index: number;
  platforms: PeriodPlatformStatus[];
  total: number;
  complete: boolean;
}

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

export function periodHasData(dataset: ContributionDataset, range: DateRange): boolean {
  return dataset.sources.some((s) => sourceCoverage(s, range) !== null);
}
