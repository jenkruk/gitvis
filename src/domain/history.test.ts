import { describe, expect, it } from "vitest";
import { combineSources, sliceToRange } from "./combine";
import { addDays, toISODate, trailingYear } from "./dates";
import { coveredSpan, historyRange, periodCount, periodSummaries } from "./history";
import type { PlatformContributions } from "./types";

const end = toISODate("2026-11-06");
const threeYears = historyRange(end, 3);
const lastYear = trailingYear(end);

const github: PlatformContributions = {
  platform: "github",
  username: "jenkruk",
  coverage: threeYears,
  days: [
    { date: end, count: 2 },
    { date: addDays(end, -400), count: 5 }, // period 2
    { date: addDays(end, -800), count: 7 }, // period 3
  ],
};
const gitlab: PlatformContributions = {
  platform: "gitlab",
  username: "contactkruk",
  coverage: lastYear,
  days: [{ date: addDays(end, -10), count: 3 }],
};

describe("historyRange", () => {
  it("equals the trailing year for one period and spans 365-day periods otherwise", () => {
    expect(historyRange(end, 1)).toEqual(trailingYear(end));
    expect(historyRange(end, 3)).toEqual({ start: addDays(end, -1094), end });
    expect(periodCount(historyRange(end, 3))).toBe(3);
    expect(periodCount(trailingYear(end))).toBe(1);
  });
});

describe("coverage", () => {
  const dataset = combineSources([github, gitlab], threeYears, "live");

  it("marks days outside a platform's coverage as unknown, not zero", () => {
    const old = dataset.days.find((d) => d.date === addDays(end, -400))!;
    expect(old.byPlatform).toEqual({ github: 5 }); // no gitlab key at all
    const recentQuiet = dataset.days.find((d) => d.date === addDays(end, -1))!;
    expect(recentQuiet.byPlatform).toEqual({ github: 0, gitlab: 0 });
  });

  it("ignores reported days outside coverage instead of counting them", () => {
    const leaky = { ...gitlab, days: [...gitlab.days, { date: addDays(end, -500), count: 99 }] };
    const combined = combineSources([leaky], threeYears, "live");
    expect(combined.days.find((d) => d.date === addDays(end, -500))!.total).toBe(0);
  });

  it("limits complete cross-platform metrics to the span every platform covers", () => {
    expect(coveredSpan(dataset)).toEqual(lastYear);
    expect(coveredSpan(combineSources([github], threeYears, "live"))).toEqual(threeYears);
  });

  it("keeps legacy datasets (no coverage) untouched", () => {
    const legacy = combineSources([{ ...github, coverage: undefined }], lastYear, "live");
    expect(coveredSpan(legacy)).toEqual(lastYear);
    expect(sliceToRange(legacy, lastYear)).toBe(legacy);
  });
});

describe("periodSummaries", () => {
  const dataset = combineSources([github, gitlab], threeYears, "live");
  const periods = periodSummaries(dataset);

  it("lists 12-month periods newest first", () => {
    expect(periods.map((p) => p.range)).toEqual([
      lastYear,
      { start: addDays(end, -729), end: addDays(end, -365) },
      { start: addDays(end, -1094), end: addDays(end, -730) },
    ]);
  });

  it("totals the newest period across both platforms", () => {
    expect(periods[0]).toMatchObject({ complete: true, total: 5 });
  });

  it("never presents GitHub-only history as a complete cross-platform total", () => {
    expect(periods[1]).toMatchObject({ complete: false, total: 5 });
    expect(periods[1]!.platforms).toEqual([
      { platform: "github", status: "complete", total: 5 },
      { platform: "gitlab", status: "unavailable" },
    ]);
    expect(periods[2]!.platforms[1]).toEqual({ platform: "gitlab", status: "unavailable" });
  });

  it("treats a platform covering only part of a period as unavailable for it", () => {
    const partial = { ...gitlab, coverage: { start: addDays(end, -400), end } };
    const p = periodSummaries(combineSources([github, partial], threeYears, "live"));
    expect(p[1]!.platforms[1]).toEqual({ platform: "gitlab", status: "unavailable" });
  });
});
