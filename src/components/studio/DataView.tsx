import { ChevronDown } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useId, useRef, useState } from "react";
import type { VisualizationConfig } from "@/config/config";
import { PLATFORMS } from "@/domain/types";
import type { ContributionMetrics } from "@/metrics/metrics";
import { formatNumber } from "@/renderers/primitives";
import type { PreparedView } from "@/renderers/view";
import { disclosureChevron, disclosureSummary, focusRing, panel } from "@/components/ui/recipes";
import {
  currentPeriodName,
  dataSummary,
  historyNotes,
  historyRows,
  monthlyNote,
  monthlyRows,
  platformSplit,
  statsScope,
  summaryStats,
} from "./data-view-model";

/** Section headings inside the panel: one step below the disclosure title. */
const sectionTitle = "text-label font-semibold text-fg";
const scope = "text-caption text-fg-muted";
const numeric = "text-right tabular-nums";
const headerCell = "py-2 font-medium text-fg-muted";

/**
 * "Detailed contribution data": the graphic's data as text and tables, for screen readers,
 * keyboard users and anyone who wants the numbers. Collapsed by default and visually secondary.
 *
 * A short summary leads; then Contribution history (one row per 12-month period), Summary
 * statistics, and Monthly contributions in a nested disclosure. Every table is a real <table>
 * with a caption, column headers and row headers; unavailable data reads "Not available", never 0.
 * The SVG keeps its own <title>/<desc>, because a README embed has none of this.
 */
export function DataView({
  prepared,
  metrics,
  config,
  defaultOpen = false,
}: {
  prepared: PreparedView;
  metrics: ContributionMetrics;
  config: Pick<VisualizationConfig, "features" | "layout" | "metricOrder" | "range">;
  /** Stories only: start expanded. The studio always starts collapsed. */
  defaultOpen?: boolean;
}) {
  const ids = useId();
  const platforms = prepared.view.sources.map((s) => s.platform);
  const combined = platforms.length > 1;
  const rows = historyRows(prepared, metrics, config);
  const notes = historyNotes(prepared, rows);
  const stats = summaryStats(prepared, metrics, config);
  const period = currentPeriodName(prepared, config);
  const split = platformSplit(prepared, metrics, config);
  const months = monthlyRows(prepared);
  const monthNote = monthlyNote(months);

  return (
    <details data-data-view open={defaultOpen || undefined} className={`group mt-3 text-body ${panel}`}>
      <summary className={`${disclosureSummary} min-h-11 py-2.5 group-open:rounded-b-none`}>
        <span className="text-label font-medium text-fg">Detailed contribution data</span>
        <ChevronDown aria-hidden="true" className={disclosureChevron} />
      </summary>

      <div className="space-y-7 border-t border-line px-4 pt-4 pb-5">
        <p className="max-w-[65ch] text-fg">{dataSummary(prepared, metrics, config)}</p>

        <TableScroll labelledBy={`${ids}-history`}>
          <table className="w-full border-collapse text-left">
            {/* The caption is the section's heading and its scope (a heading inside a caption is valid). */}
            <caption id={`${ids}-history`} className="mb-1 text-left">
              <h4 className={sectionTitle}>Contribution history</h4>{" "}
              <span className={`block ${scope}`}>
                {rows.length > 1 ? "Each 12-month period, newest first." : `${period}, by platform.`}
              </span>
            </caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={headerCell}>
                  Period
                </th>
                {platforms.map((p) => (
                  <th key={p} scope="col" className={`${headerCell} pl-2 sm:pl-3 ${numeric}`}>
                    {PLATFORMS[p].label}
                  </th>
                ))}
                {combined && (
                  <th scope="col" className={`${headerCell} pl-2 sm:pl-3 ${numeric}`}>
                    Total
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-line last:border-b-0">
                  <th scope="row" className="py-2 pr-2 align-top font-normal">
                    {row.name && <span className="block font-medium text-fg">{row.name}</span>}{" "}
                    <span className={`block ${row.name ? scope : "text-caption text-fg"}`}>
                      <Unbroken parts={row.dates.split(" – ")} separator=" – " />
                    </span>
                  </th>
                  {row.cells.map((cell) => (
                    <td key={cell.platform} className={`py-2 pl-2 sm:pl-3 align-top ${numeric}`}>
                      {cell.total === null ? <span className={scope}>Not available</span> : formatNumber(cell.total)}
                    </td>
                  ))}
                  {combined && (
                    <td className={`py-2 pl-2 sm:pl-3 align-top font-semibold ${numeric}`}>
                      {row.total === null ? (
                        <span className={`font-normal ${scope}`}>Incomplete</span>
                      ) : (
                        formatNumber(row.total)
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
        {notes.length > 0 && (
          <div className={`-mt-5 space-y-1 ${scope}`}>
            {notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        )}

        {/* Mirrors the graphic's stat cards: only the enabled statistics, in the chosen order. */}
        {(stats.length > 0 || split) && (
          <section aria-labelledby={`${ids}-stats`}>
            <h4 id={`${ids}-stats`} className={sectionTitle}>
              Summary statistics
            </h4>
            <p className={scope}>{statsScope(prepared, config)}</p>
            <dl className="mt-2 grid gap-x-6 sm:grid-cols-2">
              {stats.map((item) => (
                <div key={item.id} className="flex items-baseline justify-between gap-3 border-b border-line py-2">
                  <dt className="text-fg-muted">{item.label}</dt>
                  <dd className="text-right">
                    <span className="font-semibold tabular-nums">{item.value}</span>
                    <span className={`block ${scope}`}>
                      <Unbroken parts={item.detail.split(" – ")} separator=" – " />
                    </span>
                  </dd>
                </div>
              ))}
              {split && (
                <div className="flex items-baseline justify-between gap-3 border-b border-line py-2">
                  <dt className="text-fg-muted">Platform split</dt>
                  <dd className="text-right font-semibold tabular-nums">
                    <Unbroken parts={split.split(" · ")} separator=" · " />
                  </dd>
                </div>
              )}
            </dl>
          </section>
        )}

        <details className="group/monthly">
          <summary
            className={`-mx-2 flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-control px-2 hover:bg-surface-hover [&::-webkit-details-marker]:hidden ${focusRing}`}
          >
            <span className={sectionTitle}>Monthly contributions</span>
            <span className={`${scope} max-[400px]:sr-only`}>{period}</span>
            <ChevronDown
              aria-hidden="true"
              className="ml-auto size-4 shrink-0 text-fg-subtle group-open/monthly:rotate-180 motion-safe:transition-transform"
            />
          </summary>
          <TableScroll labelledBy={`${ids}-monthly`}>
            <table className="mt-2 w-full border-collapse text-left">
              <caption id={`${ids}-monthly`} className="sr-only">
                Monthly contributions · {period}
              </caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className={headerCell}>
                    Month
                  </th>
                  {combined &&
                    platforms.map((p) => (
                      <th key={p} scope="col" className={`${headerCell} pl-2 sm:pl-3 ${numeric}`}>
                        {PLATFORMS[p].label}
                      </th>
                    ))}
                  <th scope="col" className={`${headerCell} pl-2 sm:pl-3 ${numeric}`}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {months.map((month) => (
                  <tr key={month.start} className="border-b border-line last:border-b-0">
                    <th scope="row" className="py-1.5 pr-2 align-top font-normal">
                      <span className="whitespace-nowrap">{month.label}</span>
                      {month.span && (
                        <>
                          {" "}
                          <span className="text-fg-muted sm:whitespace-nowrap">({month.span})</span>
                        </>
                      )}
                    </th>
                    {combined &&
                      month.cells.map((cell) => (
                        <td key={cell.platform} className={`py-1.5 pl-2 sm:pl-3 align-top ${numeric}`}>
                          {cell.total === null ? (
                            <span className={scope}>Not available</span>
                          ) : (
                            <>
                              {formatNumber(cell.total)}
                              {cell.covered && (
                                <>
                                  {" "}
                                  <span className={`block ${scope}`}>{cell.covered}</span>
                                </>
                              )}
                            </>
                          )}
                        </td>
                      ))}
                    <td className={`py-1.5 pl-2 sm:pl-3 align-top font-medium ${numeric}`}>
                      {formatNumber(month.total)}
                      {!month.complete && (
                        <>
                          {" "}
                          <span className={`block font-normal ${scope}`}>incomplete</span>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          {monthNote && <p className={`mt-2 ${scope}`}>{monthNote}</p>}
        </details>
      </div>
    </details>
  );
}

/**
 * Joins parts so a column breaks only between them ("Oct 26, 2025 –" / "Oct 31, 2026"), never
 * inside a date or a "GitLab 43%" entry. On phones the parts may wrap too, so the tables fit a
 * 320px screen. The text (and accessible name) is unchanged.
 */
function Unbroken({ parts, separator }: { parts: string[]; separator: string }) {
  const joint = separator.trimEnd();
  return parts.map((part, i) => (
    <Fragment key={part}>
      <span className="sm:whitespace-nowrap">
        {part}
        {i < parts.length - 1 ? joint : ""}
      </span>
      {i < parts.length - 1 ? " " : ""}
    </Fragment>
  ));
}

/**
 * Data tables may scroll sideways rather than reflow (WCAG 1.4.10 exempts them). They fit from
 * 320px up, so this is a safety net (large text, 400% zoom): only while the table actually
 * overflows does the wrapper become a labelled, focusable region that keyboard users can scroll.
 * Otherwise it adds no tab stop.
 */
function TableScroll({ labelledBy, children }: { labelledBy: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      role={overflowing ? "region" : undefined}
      aria-labelledby={overflowing ? labelledBy : undefined}
      tabIndex={overflowing ? 0 : undefined}
      className={`overflow-x-auto rounded-control ${focusRing}`}
    >
      {children}
    </div>
  );
}
