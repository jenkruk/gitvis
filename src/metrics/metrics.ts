import { type ISODate, monthKey, startOfWeek } from "@/domain/dates";
import type { ContributionDataset, PlatformId } from "@/domain/types";

export interface Streak {
  length: number;
  start: ISODate;
  end: ISODate;
}

export interface PlatformTotal {
  platform: PlatformId;
  total: number;
  /** 0–1 share of combined total; 0 when the combined total is 0. */
  share: number;
}

export interface SeriesPoint {
  /** Week start (Sunday) for weekly series; first day of month for monthly series. */
  start: ISODate;
  total: number;
  byPlatform: Partial<Record<PlatformId, number>>;
  /** Number of in-range days in this bucket (partial buckets at range edges have fewer). */
  dayCount: number;
}

export interface ContributionMetrics {
  total: number;
  activeDays: number;
  totalDays: number;
  /** Longest run of consecutive active days; null when there was no activity. */
  longestStreak: Streak | null;
  /** Run ending on the last day of the range (or the day before, so today isn't penalised yet). */
  currentStreak: number;
  /** Highest single day; ties resolve to the most recent day. Null when no activity. */
  bestDay: { date: ISODate; count: number } | null;
  averagePerActiveDay: number;
  platformTotals: PlatformTotal[];
  weekly: SeriesPoint[];
  monthly: SeriesPoint[];
}

export function computeMetrics(dataset: ContributionDataset): ContributionMetrics {
  const { days, sources } = dataset;
  let total = 0;
  let activeDays = 0;
  let bestDay: ContributionMetrics["bestDay"] = null;
  let longestStreak: Streak | null = null;
  let runStartIndex = -1;

  days.forEach((day, i) => {
    total += day.total;
    if (day.total === 0) {
      runStartIndex = -1;
      return;
    }
    activeDays += 1;
    if (!bestDay || day.total >= bestDay.count) bestDay = { date: day.date, count: day.total };
    if (runStartIndex < 0) runStartIndex = i;
    const length = i - runStartIndex + 1;
    if (!longestStreak || length > longestStreak.length) {
      longestStreak = { length, start: days[runStartIndex]!.date, end: day.date };
    }
  });

  const platformTotals = sources.map(({ platform }) => {
    const platformTotal = days.reduce((sum, d) => sum + (d.byPlatform[platform] ?? 0), 0);
    return { platform, total: platformTotal, share: total > 0 ? platformTotal / total : 0 };
  });

  return {
    total,
    activeDays,
    totalDays: days.length,
    longestStreak,
    currentStreak: computeCurrentStreak(dataset),
    bestDay,
    averagePerActiveDay: activeDays > 0 ? total / activeDays : 0,
    platformTotals,
    weekly: bucket(dataset, startOfWeek),
    monthly: bucket(dataset, (date) => `${monthKey(date)}-01` as ISODate),
  };
}

function computeCurrentStreak({ days }: ContributionDataset): number {
  let i = days.length - 1;
  // Grace period: an empty final day (usually "today") doesn't break the streak yet.
  if (days[i]?.total === 0) i -= 1;
  let streak = 0;
  for (; i >= 0 && days[i]!.total > 0; i--) streak += 1;
  return streak;
}

function bucket(dataset: ContributionDataset, keyOf: (date: ISODate) => ISODate): SeriesPoint[] {
  const buckets = new Map<ISODate, SeriesPoint>();
  for (const day of dataset.days) {
    const key = keyOf(day.date);
    let point = buckets.get(key);
    if (!point) {
      point = { start: key, total: 0, byPlatform: {}, dayCount: 0 };
      buckets.set(key, point);
    }
    point.total += day.total;
    point.dayCount += 1;
    for (const [platform, count] of Object.entries(day.byPlatform) as [PlatformId, number][]) {
      point.byPlatform[platform] = (point.byPlatform[platform] ?? 0) + count;
    }
  }
  return [...buckets.values()];
}
