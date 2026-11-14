import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createSampleDataset } from "@/fixtures/sample-dataset";
import { computeMetrics } from "@/metrics/metrics";
import { GITHUB_README_WIDTH } from "@/theme/palettes";
import { PreviewFrame } from "./PreviewFrame";
import { createDefaultConfig, type VisualizationConfig } from "@/config/config";
import { Studio } from "./Studio";

describe("preview", () => {
  it("shows the full image in a README-width column, with no device switcher", () => {
    render(<Studio sampleDataset={createSampleDataset()} origin="https://gitvis.test" initialStep="design" />);
    expect(screen.queryByRole("group", { name: "Preview width" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /mobile|tablet/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("preview-column")).toHaveStyle({ maxWidth: `${GITHUB_README_WIDTH}px` });
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

  it("shows every card on the GitHub page for its mode, and explains only transparent ones", () => {
    expect(frame({ ...createDefaultConfig(), mode: "light" }).style.background).toBe(hexToRgb("#ffffff"));
    expect(screen.queryByText(/shown on GitHub's/)).not.toBeInTheDocument();
  });
});

describe("preview backdrops", () => {
  const dataset = createSampleDataset();
  const metrics = computeMetrics(dataset);

  it("inspects the graphic on GitHub's light and dark pages without changing the design", async () => {
    const user = userEvent.setup();
    const config = { ...createDefaultConfig(), mode: "dark" as const };
    const { container } = render(<PreviewFrame dataset={dataset} config={config} metrics={metrics} busy={false} />);
    const stage = () => container.querySelector("[data-backdrop]") as HTMLElement;
    const backdrops = screen.getByRole("group", { name: "Backdrop" });
    expect(
      within(backdrops)
        .getAllByRole("radio")
        .map((r) => r.getAttribute("value")),
    ).toEqual(["light", "dark"]);
    expect(within(backdrops).getByRole("radio", { name: "GitHub dark" })).toBeChecked();
    expect(stage().style.background).toBe(hexToRgb("#0d1117"));

    await user.click(within(backdrops).getByRole("radio", { name: "GitHub light" }));
    expect(stage().style.background).toBe(hexToRgb("#ffffff"));
    await user.click(within(backdrops).getByRole("radio", { name: "GitHub dark" }));
    expect(stage().style.background).toBe(hexToRgb("#0d1117"));
    expect(screen.getByRole("img", { name: "Contribution activity" })).toHaveAttribute("width", "840");
  });

  it("offers a full-size view for the fitted (sticky) preview only", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <PreviewFrame dataset={dataset} config={createDefaultConfig()} metrics={metrics} busy={false} />,
    );
    expect(screen.queryByRole("button", { name: "View full size" })).not.toBeInTheDocument();
    rerender(<PreviewFrame dataset={dataset} config={createDefaultConfig()} metrics={metrics} busy={false} fit />);
    await user.click(screen.getByRole("button", { name: "View full size" }));
    expect(document.getElementById("preview-full-title")).not.toBeNull();
    expect(document.getElementById("preview-title")).not.toBeNull();
  });
});

const hexToRgb = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};
