import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { configReducer, createDefaultConfig, type VisualizationConfig } from "@/config/config";
import { LAYOUT_IDS } from "@/config/layouts";
import { combineSources } from "@/domain/combine";
import { toISODate } from "@/domain/dates";
import { createSampleDataset } from "@/fixtures/sample-dataset";
import { PALETTE_IDS } from "@/theme/palettes";
import { CANVAS_WIDTHS, COMPACT_HEATMAP_WEEKS, contentWidthFor } from "./primitives";
import { Visualization } from "./Visualization";

const sample = createSampleDataset();
const render = (config: VisualizationConfig, dataset = sample) =>
  renderToStaticMarkup(<Visualization dataset={dataset} config={config} />);
const withLayout = (layout: VisualizationConfig["layout"]) =>
  configReducer(createDefaultConfig(), { type: "setLayout", layout });

describe("Visualization (static SVG)", () => {
  it.each(LAYOUT_IDS)("renders a self-contained, accessible SVG for %s", (layout) => {
    const svg = render(withLayout(layout));
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-labelledby="gitvis-title" aria-describedby="gitvis-desc"');
    expect(svg).toMatch(/<desc id="gitvis-desc">Sample data, not real activity\./);
    expect(svg).not.toMatch(/<style|<script|class=|<foreignObject/);
  });

  it("always labels sample data in the graphic", () => {
    for (const layout of LAYOUT_IDS) expect(render(withLayout(layout))).toContain("Sample data");
  });

  it("does not show the sample badge for live data", () => {
    const live = combineSources([], { start: toISODate("2026-01-01"), end: toISODate("2026-01-31") }, "live");
    expect(render(createDefaultConfig(), live)).not.toContain("Sample data");
  });

  it("renders every palette and mode without throwing", () => {
    for (const palette of PALETTE_IDS) {
      for (const mode of ["light", "dark"] as const) {
        expect(() => render({ ...createDefaultConfig(), palette, mode })).not.toThrow();
      }
    }
  });

  it("respects feature toggles and layout support", () => {
    const dashboard = withLayout("dashboard");
    expect(render(dashboard)).toContain("Platform breakdown");
    expect(
      render(configReducer(dashboard, { type: "setFeature", feature: "platformBreakdown", enabled: false })),
    ).not.toContain("Platform breakdown");
    // Minimal does not render the breakdown even though the flag stays on.
    expect(render(withLayout("minimal"))).not.toContain("Platform breakdown");
    // Trends only appear in Data-rich.
    expect(render(dashboard)).not.toContain("Weekly contributions");
    expect(render(withLayout("dataRich"))).toContain("Weekly contributions");
  });

  it("hides the breakdown for a single platform", () => {
    expect(render(withLayout("dataRich"), createSampleDataset(["gitlab"]))).not.toContain("Platform breakdown");
  });

  it("removes the heatmap when disabled", () => {
    const config = configReducer(createDefaultConfig(), { type: "setFeature", feature: "heatmap", enabled: false });
    expect(render(config)).not.toContain("contributions on");
  });

  it("never calls contributions commits", () => {
    for (const layout of LAYOUT_IDS)
      expect(render(withLayout(layout))).not.toMatch(/\bcommits?\b(?! *\.)(?!.*not commits)/i);
  });

  describe("compact (mobile) variant", () => {
    const renderCompact = (layout: VisualizationConfig["layout"]) =>
      renderToStaticMarkup(
        <Visualization
          dataset={sample}
          config={{ ...withLayout(layout), features: { ...withLayout(layout).features, bestDay: true } }}
          size="compact"
        />,
      );

    const compactWidth = CANVAS_WIDTHS.compact;

    it.each(LAYOUT_IDS)("reflows %s to the compact width without drawing outside the canvas", (layout) => {
      const svg = renderCompact(layout);
      expect(svg).toMatch(new RegExp(`^<svg[^>]+width="${compactWidth}"`));
      // Every positioned rect stays within the canvas.
      for (const [, x, w] of svg.matchAll(/<rect x="([\d.]+)" y="[\d.-]+" width="([\d.]+)"/g)) {
        expect(Number(x) + Number(w)).toBeLessThanOrEqual(compactWidth);
      }
    });

    it("shows the most recent weeks with readable cells and says so", () => {
      const svg = renderCompact("dashboard");
      expect(svg).toContain(`Last ${COMPACT_HEATMAP_WEEKS} weeks`);
      const cellSize = Number(/<rect x="[\d.]+" y="[\d.]+" width="(\d+)" height="\1" rx="2"/.exec(svg)![1]);
      // ≈ GitHub's own 10px calendar cells once a phone scales the image into a ~360px column.
      expect(cellSize * (360 / compactWidth)).toBeGreaterThanOrEqual(9.5);
    });

    it("stacks stat cards two per row and trend charts vertically", () => {
      const svg = renderCompact("dataRich");
      const cardWidth = (contentWidthFor("compact") - 12) / 2;
      const cardRows = new Set(
        [...svg.matchAll(new RegExp(`<rect x="[\\d.]+" y="([\\d.]+)" width="${cardWidth}"`, "g"))].map((m) => m[1]),
      );
      expect(cardRows.size).toBe(2);
      expect(svg).toContain("Weekly contributions");
      expect(svg).toContain("Monthly by platform");
    });
  });

  it("is deterministic", () => {
    expect(render(createDefaultConfig())).toBe(render(createDefaultConfig()));
  });
});
