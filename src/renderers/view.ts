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

export interface PreparedView {
  view: ContributionDataset;
  metricsView: ContributionDataset;
  periods: PeriodSummary[];
  statsLabel?: string;
  statsPeriod?: string;
  historyNote?: string;
}

const rangeLabel = (range: DateRange) => `${formatDate(range.start)} – ${formatDate(range.end)}`;

export function prepareView(
  dataset: ContributionDataset,
  config: Pick<VisualizationConfig, "years" | "range">,
): PreparedView {
  const yearsView = sliceToRange(dataset, historyRange(newestPeriodOf(dataset), config.years));
  const view = config.range < 365 ? sliceToRecentDays(yearsView, config.range) : yearsView;
  const periods =
    periodCount(view) > 1 ? periodSummaries(view).filter((p) => periodHasData(view, p.range)) : ([] as PeriodSummary[]);
  const metricsView = sliceToRange(view, newestPeriodOf(view));

  const prepared: PreparedView = { view, metricsView, periods };
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

export function periodName(range: DateRange, dataset: ContributionDataset): string {
  const newest = newestPeriodOf(dataset);
  return range.start === newest.start && range.end === newest.end ? "Last 12 months" : rangeLabel(range);
}

export function describeWindows(metricsView: ContributionDataset): string {
  const starts = metricsView.sources.flatMap((s) => {
    const covered = sourceCoverage(s, metricsView.range);
    return covered ? [{ label: PLATFORMS[s.platform].label, start: covered.start }] : [];
  });
  if (starts.length < 2 || starts.every((s) => s.start === starts[0]!.start)) return "";
  const [first, ...rest] = starts.map((s) => `${s.label} from ${formatDate(s.start)}`);
  return `${first!.replace(" from ", " counts from ")}${rest.map((r) => ` and ${r}`).join("")}, matching the yearly total on each profile.`;
}

export function platformsLabel(dataset: ContributionDataset): string {
  return dataset.sources.map((s) => PLATFORMS[s.platform].label).join(" + ");
}

export function periodTotal(period: PeriodSummary): string {
  if (!period.platforms.some((p) => p.status === "complete")) return "No data";
  return `${formatNumber(period.total)} ${period.total === 1 ? "contribution" : "contributions"}`;
}

export function periodCoverage(period: PeriodSummary): string {
  const known = period.platforms.filter((p) => p.status === "complete").map((p) => PLATFORMS[p.platform].label);
  const missing = period.platforms.filter((p) => p.status === "unavailable").map((p) => PLATFORMS[p.platform].label);
  if (known.length === 0) return `${missing.join(" + ")} unavailable`;
  if (missing.length === 0) return known.join(" + ");
  return `${known.join(" + ")} only · ${missing.join(" + ")} unavailable`;
}

export { rangeLabel };
