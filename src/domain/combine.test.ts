import { describe, expect, it } from "vitest";
import { combineSources, normalizeDailyCounts } from "./combine";
import { toISODate } from "./dates";
import type { PlatformContributions } from "./types";

const range = { start: toISODate("2026-01-01"), end: toISODate("2026-01-05") };

function source(platform: PlatformContributions["platform"], entries: [string, number][]): PlatformContributions {
  return {
    platform,
    username: "someone",
    days: normalizeDailyCounts(entries.map(([date, count]) => ({ date, count }))),
  };
}

describe("normalizeDailyCounts", () => {
  it("sorts, merges duplicates, drops zeros and invalid input", () => {
    expect(
      normalizeDailyCounts([
        { date: "2026-01-03", count: 2 },
        { date: "2026-01-01", count: 1 },
        { date: "2026-01-03", count: 3 },
        { date: "2026-01-02", count: 0 },
        { date: "2026-02-30", count: 4 },
        { date: "2026-01-04", count: -1 },
        { date: "2026-01-05", count: Number.NaN },
      ]),
    ).toEqual([
      { date: "2026-01-01", count: 1 },
      { date: "2026-01-03", count: 5 },
    ]);
  });
});

describe("combineSources", () => {
  it("produces one entry per day in range, summing platforms", () => {
    const dataset = combineSources(
      [
        source("github", [
          ["2026-01-01", 2],
          ["2026-01-03", 1],
        ]),
        source("gitlab", [
          ["2026-01-03", 4],
          ["2026-01-05", 1],
        ]),
      ],
      range,
      "live",
    );

    expect(dataset.days.map((d) => d.date)).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
      "2026-01-05",
    ]);
    expect(dataset.days.map((d) => d.total)).toEqual([2, 0, 5, 0, 1]);
    expect(dataset.days[2]!.byPlatform).toEqual({ github: 1, gitlab: 4 });
    expect(dataset.days[1]!.byPlatform).toEqual({ github: 0, gitlab: 0 });
  });

  it("ignores days outside the range", () => {
    const dataset = combineSources(
      [
        source("github", [
          ["2025-12-31", 9],
          ["2026-01-06", 9],
        ]),
      ],
      range,
      "live",
    );
    expect(dataset.days.every((d) => d.total === 0)).toBe(true);
  });

  it("only records platforms that are connected", () => {
    const dataset = combineSources([source("gitlab", [["2026-01-02", 3]])], range, "sample");
    expect(dataset.days[1]!.byPlatform).toEqual({ gitlab: 3 });
    expect("github" in dataset.days[0]!.byPlatform).toBe(false);
    expect(dataset.provenance).toBe("sample");
  });

  it("handles no sources", () => {
    const dataset = combineSources([], range, "live");
    expect(dataset.days).toHaveLength(5);
    expect(dataset.days.every((d) => d.total === 0)).toBe(true);
  });
});
