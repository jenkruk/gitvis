import { describe, expect, it } from "vitest";
import type { VisualizationConfig } from "@/config/config";
import { combineSources } from "@/domain/combine";
import { toISODate, trailingYear } from "@/domain/dates";
import type { ContributionDataset } from "@/domain/types";
import { createSampleDataset } from "@/fixtures/sample-dataset";
import { computeMetrics } from "@/metrics/metrics";
import { formatNumber } from "@/renderers/primitives";
import { prepareView } from "@/renderers/view";
import { configWith, createSampleHistoryDataset } from "@/stories/fixtures";
import {
  dataSummary,
  historyNotes,
  historyRows,
  monthlyNote,
  monthlyRows,
  platformSplit,
  statsScope,
  summaryStats,
} from "./data-view-model";

function model(dataset: ContributionDataset, config: VisualizationConfig) {
  const prepared = prepareView(dataset, config);
  const metrics = computeMetrics(prepared.metricsView);
  const rows = historyRows(prepared, metrics, config);
  return {
    prepared,
    metrics,
    rows,
    summary: dataSummary(prepared, metrics, config),
    notes: historyNotes(prepared, rows),
    scope: statsScope(prepared, config),
  };
}

const oneYear = configWith();
const years = (n: 2 | 3) => configWith({ type: "setYears", years: n });
const days = (n: number) => `${formatNumber(n)} active ${n === 1 ? "day" : "days"}`;
const contributions = (n: number) => `${formatNumber(n)} ${n === 1 ? "contribution" : "contributions"}`;

describe("summary sentence", () => {
  it.each([
    ["combined", ["github", "gitlab"] as const, "GitHub and GitLab"],
    ["GitHub-only", ["github"] as const, "GitHub"],
    ["GitLab-only", ["gitlab"] as const, "GitLab"],
  ])("%s: total, accounts, active days and period, computed from the data", (_name, platforms, where) => {
    const { summary, metrics } = model(createSampleDataset(platforms), oneYear);
    expect(summary).toBe(
      `Sample data, not real activity. ${contributions(metrics.total)} on ${where} across ${days(metrics.activeDays)} in the last 12 months.`,
    );
  });

  it("mentions active days only when that statistic is selected", () => {
    const config = configWith({ type: "setFeature", feature: "activeDays", enabled: false });
    const { summary, metrics } = model(createSampleDataset(), config);
    expect(summary).not.toMatch(/active day/);
    expect(summary).toContain(`${contributions(metrics.total)} on GitHub and GitLab in the last 12 months.`);
  });

  it("says when earlier GitLab history is unavailable (combined, two and three years)", () => {
    for (const n of [2, 3] as const) {
      const { summary, rows } = model(createSampleHistoryDataset(), years(n));
      expect(rows).toHaveLength(n);
      expect(summary).toMatch(/ in the last 12 months\. Earlier GitLab history is unavailable\.$/);
    }
  });

  it("explains missing years for a GitLab-only account instead of showing them as zero", () => {
    const { summary, rows } = model(createSampleHistoryDataset(["gitlab"]), years(3));
    expect(rows).toHaveLength(1);
    expect(summary).toMatch(/The 2 earlier years aren't part of the sample data\.$/);
  });

  it("keeps a legacy 90-day link's period", () => {
    const { summary, rows, scope } = model(createSampleDataset(), configWith({ type: "setRange", range: 90 }));
    expect(summary).toMatch(/ in the last 90 days\.$/);
    expect(rows[0]!.name).toBe("Last 90 days");
    expect(scope).toBe("Last 90 days · GitHub + GitLab");
  });

  it("says plainly when there are no contributions yet", () => {
    const empty = combineSources(
      [{ platform: "github", username: "new", profileUrl: "https://github.com/new", days: [] }],
      trailingYear(toISODate("2026-11-06")),
      "live",
    );
    expect(model(empty, oneYear).summary).toBe("No contributions on GitHub in the last 12 months yet.");
  });
});

describe("contribution history rows", () => {
  it("one year: a single row with each platform's total and the combined total", () => {
    const { rows, metrics, notes } = model(createSampleDataset(), oneYear);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe("Last 12 months");
    expect(rows[0]!.cells.map((c) => c.total)).toEqual(metrics.platformTotals.map((p) => p.total));
    expect(rows[0]!.total).toBe(metrics.total);
    expect(notes).toEqual([]);
  });

  it("three years: newest first, unavailable platforms are null (never 0) and their totals incomplete", () => {
    const { rows, metrics, notes } = model(createSampleHistoryDataset(), years(3));
    expect(rows.map((r) => r.name)).toEqual(["Last 12 months", undefined, undefined]);
    expect(rows[0]!.total).toBe(metrics.total);
    for (const row of rows.slice(1)) {
      expect(row.cells.find((c) => c.platform === "gitlab")!.total).toBeNull();
      expect(row.cells.find((c) => c.platform === "github")!.total).toBeGreaterThan(0);
      expect(row.total).toBeNull();
    }
    expect(notes[0]).toMatch(/isn't counted as zero/);
  });
});

describe("summary statistics", () => {
  it("mirror the graphic's enabled statistics in the chosen order, and state their period", () => {
    const config = configWith(
      { type: "setYears", years: 3 },
      { type: "setFeature", feature: "bestDay", enabled: true },
      { type: "setFeature", feature: "longestStreak", enabled: false },
      { type: "moveMetric", metric: "bestDay", direction: -1 },
      { type: "moveMetric", metric: "bestDay", direction: -1 },
    );
    const { prepared, metrics, scope } = model(createSampleHistoryDataset(), config);
    expect(scope).toBe("Last 12 months · GitHub + GitLab");
    expect(prepared.statsLabel).toBe(scope);
    // Order: total, best, active, streak, current → minus the total and the disabled ones.
    expect(summaryStats(prepared, metrics, config).map((s) => s.id)).toEqual(["bestDay", "activeDays"]);
    expect(platformSplit(prepared, metrics, config)).toMatch(/^GitHub \d+% · GitLab \d+%$/);
  });

  it("show the platform split only when the graphic shows the breakdown, for two accounts", () => {
    const combined = model(createSampleDataset(), configWith());
    const minimal = configWith({ type: "setLayout", layout: "minimal" });
    const noBreakdown = model(createSampleDataset(), minimal);
    const githubOnly = model(createSampleDataset(["github"]), configWith());
    expect(platformSplit(combined.prepared, combined.metrics, configWith())).not.toBeNull();
    expect(platformSplit(noBreakdown.prepared, noBreakdown.metrics, minimal)).toBeNull();
    expect(platformSplit(githubOnly.prepared, githubOnly.metrics, configWith())).toBeNull();
  });

  it("can be empty when only the total is shown", () => {
    const config = configWith(
      { type: "setFeature", feature: "activeDays", enabled: false },
      { type: "setFeature", feature: "longestStreak", enabled: false },
      { type: "setFeature", feature: "platformBreakdown", enabled: false },
    );
    const { prepared, metrics } = model(createSampleDataset(), config);
    expect(summaryStats(prepared, metrics, config)).toEqual([]);
    expect(platformSplit(prepared, metrics, config)).toBeNull();
  });
});

describe("monthly coverage", () => {
  const end = toISODate("2026-11-06");
  const source = (platform: "github" | "gitlab", coverage?: { start: string; end: string }) => ({
    platform,
    username: platform === "github" ? "octo" : "lab",
    profileUrl: `https://${platform}.com/x`,
    days: [
      { date: toISODate("2025-12-15"), count: 2 },
      { date: toISODate("2026-03-05"), count: 3 },
      { date: toISODate("2026-03-20"), count: 4 },
      { date: toISODate("2026-10-25"), count: 5 },
    ],
    ...(coverage && { coverage: { start: toISODate(coverage.start), end: toISODate(coverage.end) } }),
  });
  const rowsFor = (dataset: ContributionDataset) => {
    const prepared = prepareView(dataset, oneYear);
    return { prepared, rows: monthlyRows(prepared), metrics: computeMetrics(prepared.metricsView) };
  };
  const month = (rows: ReturnType<typeof monthlyRows>, label: string) => rows.find((r) => r.label === label)!;
  const cell = (row: ReturnType<typeof monthlyRows>[number], platform: string) =>
    row.cells.find((c) => c.platform === platform)!;

  it("distinguishes uncovered months (null), partly covered months and genuine zeros", () => {
    // GitLab's history only starts on Mar 10: earlier months are unknown, not zero.
    const dataset = combineSources(
      [source("github"), source("gitlab", { start: "2026-03-10", end: "2026-11-06" })],
      trailingYear(end),
      "live",
    );
    const { rows, metrics } = rowsFor(dataset);

    const december = month(rows, "Dec 2025");
    expect(cell(december, "gitlab")).toEqual({ platform: "gitlab", coverage: "unavailable", total: null });
    expect(cell(december, "github")).toEqual({ platform: "github", coverage: "complete", total: 2 });
    expect(december).toMatchObject({ total: 2, complete: false });

    const march = month(rows, "Mar 2026");
    // Mar 5 is before GitLab's coverage, so only Mar 20 counts; the label says which days.
    expect(cell(march, "gitlab")).toEqual({
      platform: "gitlab",
      coverage: "partial",
      total: 4,
      covered: "from Mar 10",
    });
    expect(march).toMatchObject({ total: 7 + 4, complete: false });

    const june = month(rows, "Jun 2026");
    expect(june.cells.map((c) => c.total)).toEqual([0, 0]);
    expect(june.complete).toBe(true);

    expect(rows.reduce((sum, r) => sum + r.total, 0)).toBe(metrics.total);
    expect(monthlyNote(rows)).toMatch(/marked incomplete/);
  });

  it("labels months the reporting period cuts at either end", () => {
    const { rows } = rowsFor(createSampleDataset());
    const first = rows[0]!;
    const last = rows.at(-1)!;
    // Sample data runs Nov 1, 2025 – Oct 31, 2026: whole months, so no span labels.
    expect([first.span, last.span]).toEqual([undefined, undefined]);

    const cut = rowsFor(combineSources([source("github")], trailingYear(end), "live")).rows;
    expect(cut[0]).toMatchObject({ label: "Nov 2025", span: "from Nov 7", complete: true });
    expect(cut.at(-1)).toMatchObject({ label: "Nov 2026", span: "to Nov 6", complete: true });
  });

  it.each([
    ["GitHub-only", ["github"] as const],
    ["GitLab-only", ["gitlab"] as const],
    ["combined", ["github", "gitlab"] as const],
  ])("%s accounts with full coverage have only complete months and no note", (_name, platforms) => {
    const { rows } = rowsFor(createSampleDataset(platforms));
    expect(rows.every((r) => r.complete && r.cells.every((c) => c.coverage === "complete"))).toBe(true);
    expect(monthlyNote(rows)).toBeNull();
  });

  it("marks GitLab's later window in the newest of several years as partial, not zero", () => {
    const prepared = prepareView(createSampleHistoryDataset(), years(3));
    const october = monthlyRows(prepared)[0]!;
    expect(october).toMatchObject({ label: "Oct 2025", span: "from Oct 26", complete: false });
    expect(cell(october, "gitlab")).toMatchObject({ coverage: "partial", covered: "from Oct 31" });
    expect(cell(october, "github").coverage).toBe("complete");
  });
});
