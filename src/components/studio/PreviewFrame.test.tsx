import { prepareView } from "@/renderers/view";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createSampleDataset } from "@/fixtures/sample-dataset";
import { computeMetrics } from "@/metrics/metrics";
import { DataView } from "./DataView";
import { PreviewFrame, README_COLUMN_WIDTH } from "./PreviewFrame";
import { createDefaultConfig, type VisualizationConfig } from "@/config/config";
import { Studio } from "./Studio";

describe("preview", () => {
  it("shows the full image in a README-width column, with no device switcher", () => {
    render(<Studio sampleDataset={createSampleDataset()} origin="https://gitvis.test" initialStep="design" />);
    expect(screen.queryByRole("group", { name: "Preview width" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /mobile|tablet/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("preview-column")).toHaveStyle({ maxWidth: `${README_COLUMN_WIDTH}px` });
    expect(screen.getByRole("img", { name: "Contribution activity" })).toHaveAttribute("width", "840");
  });
});

describe("transparent backgrounds", () => {
  const dataset = createSampleDataset();
  const metrics = computeMetrics(dataset);
  const frame = (config: VisualizationConfig) => {
    const { container } = render(<PreviewFrame dataset={dataset} config={config} metrics={metrics} busy={false} />);
    return container.querySelector("[aria-busy]") as HTMLElement;
  };

  it.each([
    ["light", "#ffffff"],
    ["dark", "#0d1117"],
  ] as const)("shows a transparent %s card on GitHub's %s page, and says so", (mode, page) => {
    const el = frame({ ...createDefaultConfig(), background: "transparent", mode });
    expect(el.style.background).toBe(hexToRgb(page));
    expect(screen.getByText(new RegExp(`shown on GitHub's ${mode} page`))).toBeVisible();
  });

  it("keeps the studio's own background for cards with a background", () => {
    expect(frame({ ...createDefaultConfig(), mode: "light" }).style.background).toBe("");
    expect(screen.queryByText(/shown on GitHub's/)).not.toBeInTheDocument();
  });
});

const hexToRgb = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};

describe("DataView", () => {
  const dataset = createSampleDataset();
  const metrics = computeMetrics(dataset);

  it("offers a text summary and an accessible monthly table", async () => {
    const user = userEvent.setup();
    render(<DataView prepared={prepareView(dataset, { years: 1, range: 365 })} metrics={metrics} />);
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
    render(<DataView prepared={prepareView(dataset, { years: 1, range: 365 })} metrics={metrics} />);
    await user.click(screen.getByText("View the data as text and a table"));
    const sum = metrics.monthly.reduce((s, m) => s + m.total, 0);
    expect(sum).toBe(metrics.total);
    expect(screen.getByText("Total contributions").nextSibling).toHaveTextContent(String(metrics.total));
  });

  it("is available from the studio for the default design", () => {
    render(<Studio sampleDataset={dataset} origin="https://gitvis.test" initialStep="design" />);
    expect(screen.getByText("View the data as text and a table")).toBeInTheDocument();
  });
});
