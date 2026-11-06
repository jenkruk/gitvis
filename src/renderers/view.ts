import type { VisualizationConfig } from "@/config/config";
import { sliceToRange, sliceToRecentDays } from "@/domain/combine";
import { formatDate, type DateRange } from "@/domain/dates";
import {
  coveredSpan,
  historyRange,
  type PeriodSummary,
  periodCount,
  periodHasData,
  periodSummaries,
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
  /** What metrics are computed over: the span every connected platform covers. */
  metricsView: ContributionDataset;
  /** One entry per 12-month period with any data, newest first; empty for a single period. */
  periods: PeriodSummary[];
  /** Set when stats cover less than the calendars (e.g. GitLab has no history). */
  scopeNote?: string;
  /** Set when more years were requested than the data can show. */
  historyNote?: string;
}

const rangeLabel = (range: DateRange) => `${formatDate(range.start)} – ${formatDate(range.end)}`;

export function prepareView(
  dataset: ContributionDataset,
  config: Pick<VisualizationConfig, "years" | "range">,
): PreparedView {
  // Both slices return the same object when nothing changes, so legacy renders stay byte-identical.
  const yearsView = sliceToRange(dataset, historyRange(dataset.range.end, config.years));
  // Legacy 30/90-day links narrow further; 365 is already covered by the years slice.
  const view = config.range < 365 ? sliceToRecentDays(yearsView, config.range) : yearsView;
  const span = coveredSpan(view);
  const metricsView = span ? sliceToRange(view, span) : view;
  const shownPeriods = periodCount(view.range);
  const periods =
    shownPeriods > 1 ? periodSummaries(view).filter((p) => periodHasData(view, p.range)) : ([] as PeriodSummary[]);

  const prepared: PreparedView = { view, metricsView, periods };
  if (metricsView !== view) {
    const partial = view.sources
      .filter((s) => s.coverage !== undefined && (s.coverage === null || s.coverage.start > view.range.start))
      .map((s) => PLATFORMS[s.platform].label);
    prepared.scopeNote = `Stats cover ${rangeLabel(metricsView.range)}, when every platform has data${
      partial.length ? ` (${partial.join(" and ")} history isn't available earlier)` : ""
    }.`;
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

/** Short right-hand summary for a period's calendar title. */
export function periodHeadline(period: PeriodSummary): string {
  const noun = (n: number) => `${formatNumber(n)} ${n === 1 ? "contribution" : "contributions"}`;
  const known = period.platforms.filter((p) => p.status === "complete");
  if (known.length === 0) return "No data available";
  if (period.complete) return noun(period.total);
  const only = known.map((p) => PLATFORMS[p.platform].label).join(" and ");
  return `${noun(period.total)} · ${only} only`;
}

/** Explains which platforms are missing from a period (shown beneath its title). */
export function periodCoverageNote(period: PeriodSummary): string | undefined {
  const missing = period.platforms.filter((p) => p.status === "unavailable").map((p) => PLATFORMS[p.platform].label);
  if (missing.length === 0) return undefined;
  return `${missing.join(" and ")} history isn't available for this period.`;
}

export { rangeLabel };
