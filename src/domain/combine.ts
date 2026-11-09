import { addDays, type DateRange, eachDay, isISODate, isWithinRange, type ISODate } from "./dates";
import type { CombinedDay, ContributionDataset, DailyCount, PlatformContributions, Provenance } from "./types";

export function normalizeDailyCounts(entries: Iterable<{ date: string; count: number }>): DailyCount[] {
  const totals = new Map<ISODate, number>();
  for (const { date, count } of entries) {
    if (!isISODate(date) || !Number.isFinite(count) || count < 0) continue;
    const value = Math.floor(count);
    if (value === 0) continue;
    totals.set(date, (totals.get(date) ?? 0) + value);
  }
  return [...totals.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, count]) => ({ date, count }));
}

export function combineSources(
  sources: PlatformContributions[],
  range: DateRange,
  provenance: Provenance,
): ContributionDataset {
  const days: CombinedDay[] = eachDay(range).map((date) => ({ date, total: 0, byPlatform: {} }));
  const index = new Map(days.map((day, i) => [day.date, i]));

  for (const source of sources) {
    const covered = source.coverage === undefined ? range : source.coverage;
    if (!covered) continue;
    for (const day of days) if (isWithinRange(day.date, covered)) day.byPlatform[source.platform] ??= 0;
    for (const { date, count } of source.days) {
      if (!isWithinRange(date, range) || !isWithinRange(date, covered)) continue;
      const day = days[index.get(date)!]!;
      day.total += count;
      day.byPlatform[source.platform] = (day.byPlatform[source.platform] ?? 0) + count;
    }
  }

  return { provenance, range, sources, days };
}

export function sliceToRecentDays(dataset: ContributionDataset, days: number): ContributionDataset {
  if (dataset.days.length <= days) return dataset;
  const end = dataset.range.end;
  return sliceToRange(dataset, { start: addDays(end, -(days - 1)), end });
}

export function sliceToRange(dataset: ContributionDataset, range: DateRange): ContributionDataset {
  const start = range.start > dataset.range.start ? range.start : dataset.range.start;
  const end = range.end < dataset.range.end ? range.end : dataset.range.end;
  if (start === dataset.range.start && end === dataset.range.end) return dataset;
  const clipped = { start, end };
  return {
    ...dataset,
    range: clipped,
    days: dataset.days.filter((d) => isWithinRange(d.date, clipped)),
    sources: dataset.sources.map((s) => {
      const days = s.days.filter((d) => isWithinRange(d.date, clipped));
      if (s.coverage === undefined) return { ...s, days };
      return { ...s, days, coverage: s.coverage && intersect(s.coverage, clipped) };
    }),
  };
}

export function intersect(a: DateRange, b: DateRange): DateRange | null {
  const start = a.start > b.start ? a.start : b.start;
  const end = a.end < b.end ? a.end : b.end;
  return start <= end ? { start, end } : null;
}
