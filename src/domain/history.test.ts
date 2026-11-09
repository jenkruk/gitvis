import { describe, expect, it } from "vitest";
import { combineSources, sliceToRange } from "./combine";
import { addDays, toISODate, trailingYear } from "./dates";
import {
  coveredSpan,
  historyRange,
  newestPeriod,
  newestPeriodOf,
  periodCount,
  periodSummaries,
  platformYear,
} from "./history";
import type { PlatformContributions } from "./types";

const end = toISODate("2026-11-06");
const githubYear = { start: toISODate("2025-11-02"), end };
const lastYear = { start: toISODate("2025-11-06"), end };
const threeYears = historyRange(githubYear, 3);

const github: PlatformContributions = {
  platform: "github",
  username: "jenkruk",
  coverage: threeYears,
  days: [
    { date: end, count: 2 },
    { date: addDays(end, -400), count: 5 },
    { date: addDays(end, -800), count: 7 },
  ],
};
const gitlab: PlatformContributions = {
  platform: "gitlab",
  username: "contactkruk",
  coverage: lastYear,
  days: [{ date: addDays(end, -10), count: 3 }],
};

describe("platform years", () => {
  it("match each profile's own yearly window", () => {
    expect(platformYear("github", end)).toEqual(githubYear);
    expect(platformYear("gitlab", end)).toEqual(lastYear);
    expect(platformYear("github", toISODate("2026-11-07")).start).toBe("2025-11-02");
    expect(platformYear("github", toISODate("2026-11-08")).start).toBe("2025-11-02");
    expect(platformYear("gitlab", toISODate("2026-11-08")).start).toBe("2025-11-08");
  });

  it("handle leap days", () => {
    expect(platformYear("gitlab", toISODate("2028-02-29")).start).toBe("2027-02-28");
    expect(platformYear("gitlab", toISODate("2029-03-01")).start).toBe("2028-03-01");
  });

  it("start the newest period at the earliest platform's year", () => {
    expect(newestPeriod(["github", "gitlab"], end)).toEqual(githubYear);
    expect(newestPeriod(["gitlab"], end)).toEqual(lastYear);
    expect(newestPeriod([], end)).toEqual(trailingYear(end));
  });
});

describe("historyRange", () => {
  it("is the newest period for one year and adds 365-day periods before it", () => {
    expect(historyRange(githubYear, 1)).toEqual(githubYear);
    expect(historyRange(githubYear, 3)).toEqual({ start: addDays(githubYear.start, -730), end });
    expect(periodCount(combineSources([github], threeYears, "live"))).toBe(3);
    expect(periodCount(combineSources([github], githubYear, "live"))).toBe(1);
  });

  it("clips the newest period to shorter (legacy and sample) datasets", () => {
    const legacy = combineSources([{ ...github, coverage: undefined }], trailingYear(end), "live");
    expect(newestPeriodOf(legacy)).toEqual(trailingYear(end));
    expect(periodCount(legacy)).toBe(1);
  });
});

describe("coverage", () => {
  const dataset = combineSources([github, gitlab], threeYears, "live");

  it("marks days outside a platform's coverage as unknown, not zero", () => {
    const old = dataset.days.find((d) => d.date === addDays(end, -400))!;
    expect(old.byPlatform).toEqual({ github: 5 });
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
    const before = (days: number) => addDays(githubYear.start, -days);
    expect(periods.map((p) => p.range)).toEqual([
      githubYear,
      { start: before(365), end: before(1) },
      { start: before(730), end: before(366) },
    ]);
  });

  it("totals the newest period across both platforms, each over its own year", () => {
    expect(periods[0]).toMatchObject({ complete: true, total: 5 });
    const early = { ...github, days: [...github.days, { date: toISODate("2025-11-03"), count: 4 }] };
    const p = periodSummaries(combineSources([early, gitlab], threeYears, "live"));
    expect(p[0]).toMatchObject({ complete: true, total: 9 });
    expect(p[0]!.platforms).toEqual([
      { platform: "github", status: "complete", total: 6 },
      { platform: "gitlab", status: "complete", total: 3 },
    ]);
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
