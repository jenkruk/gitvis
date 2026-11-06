import { formatDate } from "@/domain/dates";
import { type ContributionDataset, PLATFORMS } from "@/domain/types";
import type { ContributionMetrics } from "@/metrics/metrics";
import { formatNumber, formatPercent } from "@/renderers/primitives";
import { describeVisualization } from "@/renderers/Visualization";

/**
 * Text and table alternative to the graphic, built from the same metrics so
 * the numbers can't drift. Useful for screen readers, zoomed-in reading and
 * anyone who prefers exact values over color intensity.
 */
export function DataView({ dataset, metrics }: { dataset: ContributionDataset; metrics: ContributionMetrics }) {
  const platforms = dataset.sources.map((s) => s.platform);
  const stats: [string, string][] = [
    ["Total contributions", formatNumber(metrics.total)],
    ["Active days", `${formatNumber(metrics.activeDays)} of ${formatNumber(metrics.totalDays)}`],
    ["Longest streak", metrics.longestStreak ? `${formatNumber(metrics.longestStreak.length)} days` : "None"],
    ["Current streak", `${formatNumber(metrics.currentStreak)} days`],
    [
      "Best day",
      metrics.bestDay ? `${formatNumber(metrics.bestDay.count)} on ${formatDate(metrics.bestDay.date)}` : "None",
    ],
    ...metrics.platformTotals.map((p): [string, string] => [
      PLATFORMS[p.platform].label,
      `${formatNumber(p.total)} (${formatPercent(p.share)})`,
    ]),
  ];

  return (
    <details className="group mt-3 rounded-lg border border-zinc-200 bg-white text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <summary className="cursor-pointer rounded-lg px-3 py-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
        View the data as text and a table
      </summary>
      <div className="space-y-4 border-t border-zinc-200 p-3 dark:border-zinc-800">
        <p className="text-zinc-700 dark:text-zinc-300">{describeVisualization(dataset, metrics)}</p>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          {stats.map(([term, value]) => (
            <div key={term} className="flex justify-between gap-3 border-b border-zinc-100 py-1 dark:border-zinc-800">
              <dt className="text-zinc-600 dark:text-zinc-400">{term}</dt>
              <dd className="font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        {/* The table may be wider than a phone: it scrolls inside its own focusable region, never the page. */}
        <div
          role="region"
          aria-labelledby="data-monthly-caption"
          tabIndex={0}
          className="overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <table className="w-full min-w-[20rem] border-collapse text-left tabular-nums">
            <caption id="data-monthly-caption" className="mb-2 text-left font-medium">
              Contributions by month
            </caption>
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th scope="col" className="py-1.5 pr-4 font-medium">
                  Month
                </th>
                {platforms.length > 1 &&
                  platforms.map((p) => (
                    <th key={p} scope="col" className="py-1.5 pr-4 text-right font-medium">
                      {PLATFORMS[p].label}
                    </th>
                  ))}
                <th scope="col" className="py-1.5 text-right font-medium">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {metrics.monthly.map((month) => (
                <tr key={month.start} className="border-b border-zinc-100 dark:border-zinc-800">
                  <th scope="row" className="py-1 pr-4 font-normal">
                    {formatDate(month.start, "monthYear")}
                    {month.dayCount < 28 && <span className="text-zinc-500 dark:text-zinc-400"> (partial)</span>}
                  </th>
                  {platforms.length > 1 &&
                    platforms.map((p) => (
                      <td key={p} className="py-1 pr-4 text-right">
                        {formatNumber(month.byPlatform[p] ?? 0)}
                      </td>
                    ))}
                  <td className="py-1 text-right font-medium">{formatNumber(month.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}
