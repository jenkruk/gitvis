import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createSampleDataset } from "@/fixtures/sample-dataset";
import { computeMetrics } from "@/metrics/metrics";
import { DataView } from "./DataView";
import { labelScale, PREVIEW_DEVICES, sizeForDevice } from "./PreviewFrame";
import { Studio } from "./Studio";

describe("preview modes", () => {
  it("serves the compact image only on mobile, and only when enabled", () => {
    expect(sizeForDevice("mobile", true)).toBe("compact");
    expect(sizeForDevice("mobile", false)).toBe("full");
    expect(sizeForDevice("tablet", true)).toBe("full");
  });

  it("reports when labels would be too small to read", () => {
    expect(labelScale("mobile", "full")).toBeLessThan(0.6); // shrunken desktop graphic
    expect(labelScale("mobile", "compact")).toBeGreaterThan(0.85);
    expect(labelScale("desktop", "full")).toBeGreaterThan(0.95); // 830px column, 840px image
  });

  it("switches preview width with the keyboard and constrains the README column", async () => {
    const user = userEvent.setup();
    render(<Studio sampleDataset={createSampleDataset()} origin="https://gitvis.test" />);
    const group = screen.getByRole("group", { name: "Preview width" });
    within(group)
      .getByRole("radio", { name: /desktop/i })
      .focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");

    expect(within(group).getByRole("radio", { name: /mobile/i })).toBeChecked();
    expect(screen.getByTestId("preview-column")).toHaveStyle({ maxWidth: `${PREVIEW_DEVICES.mobile.width}px` });
    expect(screen.getByText(/mobile-optimized image/, { selector: "p" })).toBeVisible();
    expect(screen.getByRole("img", { name: "Contribution activity" })).toHaveAttribute("width", "400");
  });
});

describe("DataView", () => {
  const dataset = createSampleDataset();
  const metrics = computeMetrics(dataset);

  it("offers a text summary and an accessible monthly table", async () => {
    const user = userEvent.setup();
    render(<DataView dataset={dataset} metrics={metrics} />);
    await user.click(screen.getByText("View the data as text and a table"));

    const table = screen.getByRole("table", { name: "Contributions by month" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["Month", "GitHub", "GitLab", "Total"]);
    expect(within(table).getAllByRole("rowheader")).toHaveLength(metrics.monthly.length);
    expect(screen.getByRole("region", { name: "Contributions by month" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByText(/sample data, not real activity/i)).toBeVisible();
  });

  it("matches the graphic's totals", async () => {
    const user = userEvent.setup();
    render(<DataView dataset={dataset} metrics={metrics} />);
    await user.click(screen.getByText("View the data as text and a table"));
    const sum = metrics.monthly.reduce((s, m) => s + m.total, 0);
    expect(sum).toBe(metrics.total);
    expect(screen.getByText("Total contributions").nextSibling).toHaveTextContent(String(metrics.total));
  });

  it("is available from the studio for the default design", () => {
    render(<Studio sampleDataset={dataset} origin="https://gitvis.test" />);
    expect(screen.getByText("View the data as text and a table")).toBeInTheDocument();
  });
});
