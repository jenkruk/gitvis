import { isFeatureVisible, type VisualizationConfig } from "@/config/config";
import { addDays, formatDate, type ISODate, monthKey, toISODate } from "@/domain/dates";
import { type ContributionDataset, PLATFORMS, type PlatformId } from "@/domain/types";
import type { ContributionMetrics } from "@/metrics/metrics";
import { formatNumber, formatPercent } from "@/renderers/primitives";
import { buildStatItem, orderedStats, type StatItem } from "@/renderers/stats";
import { describeWindows, periodName, platformsLabel, type PreparedView, rangeLabel } from "@/renderers/view";

/**
 * The "Detailed contribution data" panel's content, derived only from what the graphic already
 * shows (PreparedView + ContributionMetrics), so the two can't drift apart. Pure: no React.
 *
 * Division of labour, to avoid repeating the same facts:
 * - the summary sentence: the headline total, where it comes from, and what's missing;
 * - Contribution history: the numbers per 12-month period and platform;
 * - Summary statistics: the statistics selected for the graphic, in its order (the total is in the
 *   summary and the history);
 * - Monthly contributions: the month-by-month breakdown.
 */

type Selection = Pick<VisualizationConfig, "features" | "layout" | "metricOrder" | "range">;

const plural = (n: number, one: string, many: string) => `${formatNumber(n)} ${n === 1 ? one : many}`;
const list = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : items[0]!;

/** "in the last 12 months" for every year-based design; legacy links keep "in the last 90 days". */
function periodPhrase(config: Selection): string {
  return config.range < 365 ? `in the last ${config.range} days` : "in the last 12 months";
}

/** The newest period's name as a heading ("Last 12 months", or "Last 90 days" for legacy links). */
export function currentPeriodName(prepared: PreparedView, config: Selection): string {
  if (config.range < 365) return `Last ${config.range} days`;
  return periodName(prepared.metricsView.range, prepared.view);
}

/** Platforms that published nothing for at least one earlier period shown (e.g. GitLab). */
function unavailableEarlier(prepared: PreparedView): PlatformId[] {
  const missing = new Set<PlatformId>();
  for (const period of prepared.periods.slice(1)) {
    for (const p of period.platforms) if (p.status === "unavailable") missing.add(p.platform);
  }
  return prepared.view.sources.map((s) => s.platform).filter((p) => missing.has(p));
}

/**
 * One or two short sentences: the total for the reporting period, the accounts it covers,
 * active days when that statistic is selected, and any history that isn't available.
 */
export function dataSummary(prepared: PreparedView, metrics: ContributionMetrics, config: Selection): string {
  const { metricsView } = prepared;
  const platforms = metricsView.sources.map((s) => PLATFORMS[s.platform].label);
  const where = platforms.length ? ` on ${list(platforms)}` : "";
  const period = periodPhrase(config);
  const active = isFeatureVisible("activeDays", config, metricsView);

  const sentences: string[] = [];
  if (metricsView.provenance === "sample") sentences.push("Sample data, not real activity.");
  if (metricsView.freshness?.stale) {
    const asOf = formatDate(toISODate(metricsView.freshness.asOf.slice(0, 10)));
    sentences.push(`Last updated ${asOf}; a refresh is pending.`);
  }
  sentences.push(
    metrics.total === 0
      ? `No contributions${where} ${period} yet.`
      : `${plural(metrics.total, "contribution", "contributions")}${where}${
          active ? ` across ${plural(metrics.activeDays, "active day", "active days")}` : ""
        } ${period}.`,
  );
  const earlier = unavailableEarlier(prepared);
  if (earlier.length) {
    sentences.push(`Earlier ${list(earlier.map((p) => PLATFORMS[p].label))} history is unavailable.`);
  }
  if (prepared.historyNote) sentences.push(prepared.historyNote);
  return sentences.join(" ");
}

export interface HistoryCell {
  platform: PlatformId;
  /** null: the platform doesn't provide this period (never shown or announced as zero). */
  total: number | null;
}

export interface HistoryRow {
  key: string;
  /** "Last 12 months" for the newest period, otherwise undefined (the dates name the row). */
  name?: string;
  dates: string;
  cells: HistoryCell[];
  /** null when a platform is missing: the combined total would be incomplete. */
  total: number | null;
}

/** One row per 12-month period, newest first (a single row for one-year and legacy-range designs). */
export function historyRows(prepared: PreparedView, metrics: ContributionMetrics, config: Selection): HistoryRow[] {
  const platforms = prepared.view.sources.map((s) => s.platform);
  if (prepared.periods.length > 1) {
    return prepared.periods.map((period) => ({
      key: period.range.end,
      name: period.index === 0 ? currentPeriodName(prepared, config) : undefined,
      dates: rangeLabel(period.range),
      cells: platforms.map((platform) => {
        const status = period.platforms.find((p) => p.platform === platform);
        return { platform, total: status?.status === "complete" ? status.total : null };
      }),
      total: period.complete ? period.total : null,
    }));
  }
  return [
    {
      key: prepared.metricsView.range.end,
      name: currentPeriodName(prepared, config),
      dates: rangeLabel(prepared.metricsView.range),
      cells: platforms.map((platform) => ({
        platform,
        total: metrics.platformTotals.find((p) => p.platform === platform)?.total ?? 0,
      })),
      total: metrics.total,
    },
  ];
}

/** Notes under the history table, only when they apply: missing periods and differing start dates. */
export function historyNotes(prepared: PreparedView, rows: HistoryRow[]): string[] {
  const notes: string[] = [];
  if (rows.some((r) => r.cells.some((c) => c.total === null))) {
    notes.push(
      "“Not available” marks a period a platform doesn't provide. It isn't counted as zero, so that period's combined total is incomplete.",
    );
  }
  const windows = describeWindows(prepared.metricsView);
  if (windows) notes.push(windows);
  return notes;
}

/** "Last 12 months · GitHub + GitLab": what the summary statistics describe. */
export function statsScope(prepared: PreparedView, config: Selection): string {
  return prepared.statsLabel ?? `${currentPeriodName(prepared, config)} · ${platformsLabel(prepared.metricsView)}`;
}

/**
 * "GitHub 56% · GitLab 44%": each platform's share of the newest period. Shown only when the
 * graphic shows the platform breakdown (combined accounts with that card enabled).
 */
export function platformSplit(
  prepared: PreparedView,
  metrics: ContributionMetrics,
  config: Pick<Selection, "features" | "layout">,
): string | null {
  if (!isFeatureVisible("platformBreakdown", config, prepared.metricsView)) return null;
  if (metrics.platformTotals.length < 2 || metrics.total === 0) return null;
  return metrics.platformTotals.map((p) => `${PLATFORMS[p.platform].label} ${formatPercent(p.share)}`).join(" · ");
}

/**
 * The statistics the graphic shows, in the order the user chose, so this section mirrors the
 * stat cards. The combined total is left out: it leads the summary sentence and closes the
 * history table, which (with the monthly table) stays available whatever is selected.
 */
export function summaryStats(prepared: PreparedView, metrics: ContributionMetrics, config: Selection): StatItem[] {
  return orderedStats(config.metricOrder, (id) => isFeatureVisible(id, config, prepared.metricsView))
    .filter((id) => id !== "totalContributions")
    .map((id) => buildStatItem(id, metrics));
}

/** "Oct 31" (no year: the row header already names the month). */
const monthDay = (date: ISODate) => `${formatDate(date, "month")} ${Number(date.slice(8))}`;

export type MonthCoverage = "complete" | "partial" | "unavailable";

export interface MonthCell {
  platform: PlatformId;
  coverage: MonthCoverage;
  /** Known contributions on the days this platform covers; null when it covers none (never 0). */
  total: number | null;
  /** For partial coverage: the covered days, e.g. "from Oct 31". */
  covered?: string;
}

export interface MonthRow {
  start: ISODate;
  /** "Oct 2025" */
  label: string;
  /** When the reporting period cuts the month: "from Oct 26" / "to Nov 6". */
  span?: string;
  cells: MonthCell[];
  /** The sum of the known counts. */
  total: number;
  /** False when any platform is partial or unavailable that month: the total leaves days out. */
  complete: boolean;
}

/** "from Oct 26", "to Nov 6", or "Oct 26 – Nov 6" for a run of days inside a month. */
function spanLabel(first: ISODate, last: ISODate, monthStart: boolean, monthEnd: boolean): string | undefined {
  if (monthStart && monthEnd) return undefined;
  if (monthEnd) return `from ${monthDay(first)}`;
  if (monthStart) return `to ${monthDay(last)}`;
  return `${monthDay(first)} – ${monthDay(last)}`;
}

const isMonthStart = (date: ISODate) => date.endsWith("-01");
const isMonthEnd = (date: ISODate) => monthKey(addDays(date, 1)) !== monthKey(date);

/**
 * Monthly rows for the newest period, with each platform's coverage measured day by day: a day
 * a platform doesn't cover has no count for it (combineSources never zero-fills), so a month
 * where GitLab's window starts on the 31st reads "0 from Oct 31", not a bare 0 for the month.
 */
export function monthlyRows(prepared: PreparedView): MonthRow[] {
  const platforms = prepared.metricsView.sources.map((s) => s.platform);
  const months = new Map<string, ContributionDataset["days"]>();
  for (const day of prepared.metricsView.days) {
    const key = monthKey(day.date);
    const list = months.get(key) ?? [];
    list.push(day);
    months.set(key, list);
  }
  return [...months.values()].map((days) => {
    const first = days[0]!.date;
    const last = days.at(-1)!.date;
    const cells = platforms.map((platform): MonthCell => {
      const covered = days.filter((d) => d.byPlatform[platform] !== undefined);
      if (covered.length === 0) return { platform, coverage: "unavailable", total: null };
      const total = covered.reduce((sum, d) => sum + d.byPlatform[platform]!, 0);
      if (covered.length === days.length) return { platform, coverage: "complete", total };
      const from = covered[0]!.date;
      const to = covered.at(-1)!.date;
      return {
        platform,
        coverage: "partial",
        total,
        covered: spanLabel(from, to, from === first, to === last),
      };
    });
    return {
      start: first,
      label: formatDate(first, "monthYear"),
      span: spanLabel(first, last, isMonthStart(first), isMonthEnd(last)),
      cells,
      total: cells.reduce((sum, c) => sum + (c.total ?? 0), 0),
      complete: cells.every((c) => c.coverage === "complete"),
    };
  });
}

/** One line under the monthly table, only when a platform covers part of a month. */
export function monthlyNote(rows: MonthRow[]): string | null {
  if (!rows.some((r) => !r.complete)) return null;
  return "Where a platform covers only part of a month, its count is for the dates shown and that month's total is marked incomplete.";
}
