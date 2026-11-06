import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { configReducer, createDefaultConfig, type VisualizationConfig } from "@/config/config";
import { LAYOUT_IDS } from "@/config/layouts";
import { combineSources } from "@/domain/combine";
import { toISODate } from "@/domain/dates";
import { createSampleDataset } from "@/fixtures/sample-dataset";
import { PALETTE_IDS } from "@/theme/palettes";
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

  it("is deterministic", () => {
    expect(render(createDefaultConfig())).toBe(render(createDefaultConfig()));
  });
});
