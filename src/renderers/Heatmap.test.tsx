import { describe, expect, it } from "vitest";
import { createDefaultConfig } from "@/config/config";
import { createSampleDataset } from "@/fixtures/sample-dataset";
import { renderSvgMarkup } from "@/publish/svg-markup";
import { resolveTheme } from "@/theme/palettes";
import { Heatmap } from "./Heatmap";
import { Visualization } from "./Visualization";

const dataset = createSampleDataset();
const theme = resolveTheme("aurora", "dark");

const render = (tooltips: boolean, width = 760) =>
  renderSvgMarkup(
    <svg xmlns="http://www.w3.org/2000/svg">
      <Heatmap days={dataset.days} theme={theme} x={0} y={0} width={width} showLegend={false} tooltips={tooltips} />
    </svg>,
  );

type Cell = { x: number; y: number; size: number; fill: string };
const byPosition = (a: Cell, b: Cell) => a.y - b.y || a.x - b.x;

function rectCells(svg: string): Cell[] {
  return [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="\3" rx="2" fill="([^"]+)"/g)]
    .map(([, x, y, size, fill]) => ({ x: +x!, y: +y!, size: +size!, fill: fill! }))
    .sort(byPosition);
}

function pathCells(svg: string): Cell[] {
  return [...svg.matchAll(/<path d="([^"]+)" fill="([^"]+)" stroke="\2" stroke-width="4" stroke-linejoin="round"/g)]
    .flatMap(([, d, fill]) =>
      [...d!.matchAll(/M([\d.]+) ([\d.]+)h([\d.]+)v\3h-\3z/g)].map(([, x, y, side]) => ({
        x: +x! - 2,
        y: +y! - 2,
        size: +side! + 4,
        fill: fill!,
      })),
    )
    .sort(byPosition);
}

describe("heatmap cells", () => {
  it("keep a titled rect per day when tooltips are on", () => {
    const svg = render(true);
    expect(svg).not.toContain("<path");
    expect(rectCells(svg)).toHaveLength(dataset.days.length);
    expect(svg.match(/<title>/g)).toHaveLength(dataset.days.length);
  });

  it("draw one path per color for published images, with the same cells, sizes and colors", () => {
    const published = render(false);
    expect(published).not.toContain("<rect");
    expect(published).not.toContain("<title>");
    const colors = published.match(/<path /g)!.length;
    expect(colors).toBe(new Set(rectCells(render(true)).map((c) => c.fill)).size);
    expect(pathCells(published)).toEqual(rectCells(render(true)));
  });

  it("fall back to rects when cells are too small for the rounded-stroke outline", () => {
    const tiny = render(false, 300);
    expect(tiny).not.toContain("<path");
    expect(rectCells(tiny).every((c) => c.size === 4)).toBe(true);
  });

  it("make the published data-rich image less than half the size of the tooltip markup", () => {
    const config = { ...createDefaultConfig(), layout: "dataRich" as const };
    const withTooltips = renderSvgMarkup(<Visualization dataset={dataset} config={config} />);
    const published = renderSvgMarkup(<Visualization dataset={dataset} config={config} tooltips={false} />);
    expect(published.length).toBeLessThan(withTooltips.length / 2);
  });
});
