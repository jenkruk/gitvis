import type { VisualizationConfig } from "@/config/config";
import { sliceToRange, sliceToRecentDays } from "@/domain/combine";
import { type DateRange, formatDate } from "@/domain/dates";
import {
  historyRange,
  newestPeriodOf,
  type PeriodSummary,
  periodCount,
  periodHasData,
  periodSummaries,
  sourceCoverage,
} from "@/domain/history";
import { type ContributionDataset, PLATFORMS } from "@/domain/types";
import { formatNumber } from "./primitives";

/**
 * Everything the graphic, the studio preview and the data table derive from a
 * dataset + design, computed once in one place so their numbers can't drift.
 */
export interface PreparedView {
  /** What the calendars show: the selected years (or legacy 30/90-day range). */
  view: ContributionDataset;
  /**
   * What metrics are computed over: the newest period, where each platform
   * contributes its own published year (so totals match the profiles).
   */
  metricsView: ContributionDataset;
  /** One entry per 12-month period with any data, newest first; empty for a single period. */
  periods: PeriodSummary[];
  /**
   * Multi-year only: the reporting period of every summary statistic, as a short
   * heading — "Last 12 months · GitHub + GitLab", "Last 3 years · GitHub".
   */
  statsLabel?: string;
  /** The period part alone ("Last 12 months"), appended to chart and breakdown titles. */
  statsPeriod?: string;
  /** Set when more years were requested than the data can show. */
  historyNote?: string;
}

const rangeLabel = (range: DateRange) => `${formatDate(range.start)} – ${formatDate(range.end)}`;

export function prepareView(
  dataset: ContributionDataset,
  config: Pick<VisualizationConfig, "years" | "range">,
): PreparedView {
  // Both slices return the same object when nothing changes, so legacy renders stay byte-identical.
  const yearsView = sliceToRange(dataset, historyRange(newestPeriodOf(dataset), config.years));
  // Legacy 30/90-day links narrow further; 365 is already covered by the years slice.
  const view = config.range < 365 ? sliceToRecentDays(yearsView, config.range) : yearsView;
  const periods =
    periodCount(view) > 1 ? periodSummaries(view).filter((p) => periodHasData(view, p.range)) : ([] as PeriodSummary[]);
  // Summary statistics cover the newest period only. Each platform counts its own published
  // year there (GitHub's starts on a Sunday, a few days before GitLab's), so the combined
  // total is the sum of the two profile totals; days a platform doesn't report stay unknown.
  const metricsView = sliceToRange(view, newestPeriodOf(view));

  const prepared: PreparedView = { view, metricsView, periods };
  // Several calendars are shown: say exactly which period and accounts the summary numbers cover.
  if (periods.length > 1) {
    prepared.statsPeriod = periodName(metricsView.range, view);
    prepared.statsLabel = `${prepared.statsPeriod} · ${platformsLabel(metricsView)}`;
  }
  const missing = config.years - (periods.length || 1);
  if (config.years > 1 && missing > 0) prepared.historyNote = historyNoteFor(dataset, missing);
  return prepared;
}

function historyNoteFor(dataset: ContributionDataset, missing: number): string {
  const years = missing === 1 ? "The earlier year isn't" : `The ${missing} earlier years aren't`;
  if (dataset.provenance === "sample") return `${years} part of the sample data.`;
  if (!dataset.sources.some((s) => s.platform === "github")) {
    return `${years} available: GitLab publishes only the last 12 months.`;
  }
  return `${years} available right now.`;
}

/** Plain-text summary of one 12-month period, never presenting partial data as a complete total. */
export function describePeriod(period: PeriodSummary): string {
  const label = rangeLabel(period.range);
  const known = period.platforms.filter((p) => p.status === "complete");
  const missing = period.platforms.filter((p) => p.status === "unavailable").map((p) => PLATFORMS[p.platform].label);
  const noun = (n: number) => `${formatNumber(n)} ${n === 1 ? "contribution" : "contributions"}`;
  if (known.length === 0) return `${label}: no data available.`;
  if (period.complete) {
    if (known.length === 1) return `${label}: ${noun(period.total)}.`;
    const parts = known.map((p) => `${PLATFORMS[p.platform].label} ${formatNumber(p.total)}`).join(", ");
    return `${label}: ${noun(period.total)} (${parts}).`;
  }
  const only = known.map((p) => PLATFORMS[p.platform].label).join(" and ");
  const suffix = missing.length ? `; ${missing.join(" and ")} not available for this period` : "";
  return `${label}: ${noun(period.total)} (${only} only${suffix}).`;
}

/** "Last 12 months" for the newest period (each platform's own year); dates otherwise. */
export function periodName(range: DateRange, dataset: ContributionDataset): string {
  const newest = newestPeriodOf(dataset);
  return range.start === newest.start && range.end === newest.end ? "Last 12 months" : rangeLabel(range);
}

/**
 * When connected platforms count their years from different dates, says so —
 * e.g. "GitHub counts from Nov 2, 2025 and GitLab from Nov 8, 2025, matching
 * each profile's yearly total." Empty when they share one window.
 */
export function describeWindows(metricsView: ContributionDataset): string {
  const starts = metricsView.sources.flatMap((s) => {
    const covered = sourceCoverage(s, metricsView.range);
    return covered ? [{ label: PLATFORMS[s.platform].label, start: covered.start }] : [];
  });
  if (starts.length < 2 || starts.every((s) => s.start === starts[0]!.start)) return "";
  const [first, ...rest] = starts.map((s) => `${s.label} from ${formatDate(s.start)}`);
  return `${first!.replace(" from ", " counts from ")}${rest.map((r) => ` and ${r}`).join("")}, matching the yearly total on each profile.`;
}

/** "GitHub + GitLab" / "GitHub": the accounts a set of numbers comes from. */
export function platformsLabel(dataset: ContributionDataset): string {
  return dataset.sources.map((s) => PLATFORMS[s.platform].label).join(" + ");
}

/** A period's total, e.g. "965 contributions". */
export function periodTotal(period: PeriodSummary): string {
  if (!period.platforms.some((p) => p.status === "complete")) return "No data";
  return `${formatNumber(period.total)} ${period.total === 1 ? "contribution" : "contributions"}`;
}

/** Which accounts a period's total covers: "GitHub + GitLab", "GitHub", or "GitHub only · GitLab unavailable". */
export function periodCoverage(period: PeriodSummary): string {
  const known = period.platforms.filter((p) => p.status === "complete").map((p) => PLATFORMS[p.platform].label);
  const missing = period.platforms.filter((p) => p.status === "unavailable").map((p) => PLATFORMS[p.platform].label);
  if (known.length === 0) return `${missing.join(" + ")} unavailable`;
  if (missing.length === 0) return known.join(" + ");
  return `${known.join(" + ")} only · ${missing.join(" + ")} unavailable`;
}

export { rangeLabel };
