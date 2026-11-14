import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { VisualizationConfig } from "@/config/config";
import type { ContributionDataset } from "@/domain/types";
import { createSampleDataset } from "@/fixtures/sample-dataset";
import { computeMetrics } from "@/metrics/metrics";
import { formatNumber } from "@/renderers/primitives";
import { prepareView } from "@/renderers/view";
import { configWith, createSampleHistoryDataset } from "@/stories/fixtures";
import { DataView } from "./DataView";
import { Studio } from "./Studio";

function open(dataset: ContributionDataset, config: VisualizationConfig = configWith()) {
  const user = userEvent.setup();
  const prepared = prepareView(dataset, config);
  const metrics = computeMetrics(prepared.metricsView);
  render(<DataView prepared={prepared} metrics={metrics} config={config} />);
  return { user, metrics, toggle: () => user.click(screen.getByText("Detailed contribution data")) };
}

const cells = (row: HTMLElement) =>
  within(row)
    .getAllByRole("cell")
    .map((c) => c.textContent);

describe("Detailed contribution data", () => {
  it("is a collapsed disclosure named for what it holds", async () => {
    const { toggle } = open(createSampleDataset());
    const details = screen.getByText("Detailed contribution data").closest("details")!;
    expect(details).not.toHaveAttribute("open");
    await toggle();
    expect(details).toHaveAttribute("open");
  });

  it("leads with a short summary instead of repeating every statistic", async () => {
    const { toggle, metrics } = open(createSampleDataset());
    await toggle();
    const summary = screen.getByText(/contributions on GitHub and GitLab/);
    expect(summary).toHaveTextContent(`${formatNumber(metrics.total)} contributions`);
    expect(summary.textContent).not.toMatch(/Longest streak|Best day/);
  });

  it("captions the history table with its scope, with column and row headers", async () => {
    const { toggle, metrics } = open(createSampleDataset());
    await toggle();
    const table = screen.getByRole("table", { name: /^Contribution history/ });
    expect(table).toHaveAccessibleName("Contribution history Last 12 months, by platform.");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["Period", "GitHub", "GitLab", "Total"]);
    const [row] = within(table).getAllByRole("row").slice(1);
    expect(within(row!).getByRole("rowheader")).toHaveTextContent(/^Last 12 months/);
    expect(cells(row!).at(-1)).toBe(formatNumber(metrics.total));
  });

  it("drops the redundant Total column for a single account", async () => {
    const { toggle } = open(createSampleDataset(["gitlab"]));
    await toggle();
    const table = screen.getByRole("table", { name: /^Contribution history/ });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["Period", "GitLab"]);
  });

  it("shows unavailable periods as 'Not available' and their totals as 'Incomplete', never 0", async () => {
    const { toggle } = open(createSampleHistoryDataset(), configWith({ type: "setYears", years: 3 }));
    await toggle();
    const table = screen.getByRole("table", { name: /^Contribution history Each 12-month period, newest first/ });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    for (const row of rows.slice(1)) {
      const [github, gitlab, total] = cells(row);
      expect(github).toMatch(/^[\d,]+$/);
      expect(gitlab).toBe("Not available");
      expect(total).toBe("Incomplete");
    }
    expect(screen.getByText(/isn't counted as zero/)).toBeVisible();
    expect(screen.getByText(/Earlier GitLab history is unavailable\./)).toBeVisible();
  });

  it("states the period the summary statistics cover", async () => {
    const { toggle } = open(createSampleHistoryDataset(), configWith({ type: "setYears", years: 2 }));
    await toggle();
    const stats = screen.getByRole("region", { name: "Summary statistics" });
    expect(stats).toHaveTextContent("Last 12 months · GitHub + GitLab");
    expect(
      within(stats)
        .getAllByRole("term")
        .map((t) => t.textContent),
    ).toEqual(["Active days", "Longest streak", "Platform split"]);
    expect(within(stats).getByText("Platform split").nextElementSibling).toHaveTextContent(
      /^GitHub \d+% · GitLab \d+%$/,
    );
  });

  it("lists only the statistics enabled on the graphic, in the chosen order", async () => {
    const config = configWith(
      { type: "setFeature", feature: "currentStreak", enabled: true },
      { type: "moveMetric", metric: "currentStreak", direction: -1 },
      { type: "moveMetric", metric: "currentStreak", direction: -1 },
      { type: "moveMetric", metric: "currentStreak", direction: -1 },
      { type: "setFeature", feature: "platformBreakdown", enabled: false },
    );
    const { toggle } = open(createSampleDataset(["github"]), config);
    await toggle();
    const stats = screen.getByRole("region", { name: "Summary statistics" });
    expect(
      within(stats)
        .getAllByRole("term")
        .map((t) => t.textContent),
    ).toEqual(["Current streak", "Active days", "Longest streak"]);
  });

  it("leaves out the statistics section when the graphic shows only the total, but keeps the tables", async () => {
    const config = configWith(
      { type: "setFeature", feature: "activeDays", enabled: false },
      { type: "setFeature", feature: "longestStreak", enabled: false },
      { type: "setFeature", feature: "platformBreakdown", enabled: false },
    );
    const { toggle } = open(createSampleDataset(["gitlab"]), config);
    await toggle();
    expect(screen.queryByRole("region", { name: "Summary statistics" })).not.toBeInTheDocument();
    expect(screen.getByRole("table", { name: /^Contribution history/ })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /^Monthly contributions/ })).toBeInTheDocument();
  });

  it("reads a partly covered month as known counts with their dates, and its total as incomplete", async () => {
    const { toggle, user } = open(createSampleHistoryDataset(), configWith({ type: "setYears", years: 3 }));
    await toggle();
    await user.click(screen.getByText("Monthly contributions"));
    const table = screen.getByRole("table", { name: "Monthly contributions · Last 12 months" });
    const october = within(table).getByRole("rowheader", { name: "Oct 2025 (from Oct 26)" }).closest("tr")!;
    const [github, gitlab, total] = cells(october);
    expect(github).toMatch(/^[\d,]+$/);
    expect(gitlab).toMatch(/^[\d,]+ from Oct 31$/);
    expect(total).toMatch(/^[\d,]+ incomplete$/);
    const rows = within(table).getAllByRole("row").slice(2);
    for (const row of rows) expect(cells(row).join(" ")).not.toMatch(/incomplete|from|Not available/);
    expect(screen.getByText(/that month's total is marked incomplete/)).toBeVisible();
  });

  it("keeps the monthly table one keyboard step away in its own disclosure", async () => {
    const { toggle, metrics, user } = open(createSampleDataset());
    await toggle();
    const monthly = screen.getByText("Monthly contributions").closest("details")!;
    expect(monthly).not.toHaveAttribute("open");
    await user.click(screen.getByText("Monthly contributions"));
    expect(monthly).toHaveAttribute("open");
    const table = screen.getByRole("table", { name: "Monthly contributions · Last 12 months" });
    expect(within(table).getAllByRole("rowheader")).toHaveLength(metrics.monthly.length);
    expect(screen.getByRole("heading", { name: "Contribution history" })).toBeVisible();
    const sum = metrics.monthly.reduce((s, m) => s + m.total, 0);
    expect(sum).toBe(metrics.total);
  });

  it("is available from the studio, below the preview", () => {
    render(<Studio sampleDataset={createSampleDataset()} origin="https://gitvis.test" initialStep="design" />);
    expect(screen.getByText("Detailed contribution data")).toBeInTheDocument();
  });
});
