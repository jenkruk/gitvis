import { describe, expect, it } from "vitest";
import { combineSources, normalizeDailyCounts } from "@/domain/combine";
import { addDays, toISODate } from "@/domain/dates";
import type { PlatformId } from "@/domain/types";
import { computeMetrics } from "./metrics";

const START = toISODate("2026-02-22"); // a Sunday

/** Build a dataset from per-day totals starting at START, one array per platform. */
function dataset(series: Partial<Record<PlatformId, number[]>>) {
  const length = Math.max(...Object.values(series).map((s) => s.length));
  const sources = Object.entries(series).map(([platform, counts]) => ({
    platform: platform as PlatformId,
    username: "u",
    days: normalizeDailyCounts(counts.map((count, i) => ({ date: addDays(START, i), count }))),
  }));
  return combineSources(sources, { start: START, end: addDays(START, length - 1) }, "live");
}

describe("computeMetrics", () => {
  it("totals and active days", () => {
    const m = computeMetrics(dataset({ github: [1, 0, 3, 0, 0, 2], gitlab: [0, 0, 1, 0, 4, 0] }));
    expect(m.total).toBe(11);
    expect(m.activeDays).toBe(4);
    expect(m.totalDays).toBe(6);
    expect(m.averagePerActiveDay).toBeCloseTo(2.75);
  });

  it("finds the longest streak across platforms, spanning a month boundary", () => {
    // Feb 22 … : github active 25–27 Feb, gitlab active 28 Feb – 1 Mar → combined 5-day streak.
    const m = computeMetrics(dataset({ github: [1, 0, 0, 1, 1, 1, 0, 0, 0], gitlab: [0, 0, 0, 0, 0, 0, 1, 1, 0] }));
    expect(m.longestStreak).toEqual({ length: 5, start: "2026-02-25", end: "2026-03-01" });
  });

  it("prefers the earliest of equally long streaks", () => {
    const m = computeMetrics(dataset({ github: [1, 1, 0, 1, 1] }));
    expect(m.longestStreak).toEqual({ length: 2, start: "2026-02-22", end: "2026-02-23" });
  });

  it("current streak tolerates an empty final day but not an earlier gap", () => {
    expect(computeMetrics(dataset({ github: [1, 0, 1, 1, 1] })).currentStreak).toBe(3);
    expect(computeMetrics(dataset({ github: [1, 0, 1, 1, 0] })).currentStreak).toBe(2);
    expect(computeMetrics(dataset({ github: [1, 1, 0, 0] })).currentStreak).toBe(0);
  });

  it("best day resolves ties to the most recent day", () => {
    const m = computeMetrics(dataset({ github: [5, 2, 5, 1] }));
    expect(m.bestDay).toEqual({ date: "2026-02-24", count: 5 });
  });

  it("returns empty-safe values with no activity", () => {
    const m = computeMetrics(dataset({ github: [0, 0, 0] }));
    expect(m.total).toBe(0);
    expect(m.longestStreak).toBeNull();
    expect(m.bestDay).toBeNull();
    expect(m.averagePerActiveDay).toBe(0);
    expect(m.platformTotals).toEqual([{ platform: "github", total: 0, share: 0 }]);
  });

  it("platform totals and shares", () => {
    const m = computeMetrics(dataset({ github: [3, 1], gitlab: [0, 4] }));
    expect(m.platformTotals).toEqual([
      { platform: "github", total: 4, share: 0.5 },
      { platform: "gitlab", total: 4, share: 0.5 },
    ]);
  });

  it("buckets weekly (Sunday start) and monthly with partial-bucket day counts", () => {
    // 9 days: Sun Feb 22 … Mon Mar 2
    const m = computeMetrics(dataset({ github: [1, 1, 1, 1, 1, 1, 1, 2, 2], gitlab: [0, 0, 0, 0, 0, 0, 0, 0, 3] }));
    expect(m.weekly.map((w) => [w.start, w.total, w.dayCount])).toEqual([
      ["2026-02-22", 7, 7],
      ["2026-03-01", 7, 2],
    ]);
    expect(m.weekly[1]!.byPlatform).toEqual({ github: 4, gitlab: 3 });
    expect(m.monthly.map((p) => [p.start, p.total, p.dayCount])).toEqual([
      ["2026-02-01", 7, 7],
      ["2026-03-01", 7, 2],
    ]);
  });
});
