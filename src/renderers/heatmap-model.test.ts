import { describe, expect, it } from "vitest";
import { combineSources } from "@/domain/combine";
import { toISODate } from "@/domain/dates";
import { buildHeatmapGrid, heatLevel, heatmapGeometry, heatmapThresholds } from "./heatmap-model";

describe("heatmap scale", () => {
  it("uses quartiles of active days and ignores zeros", () => {
    expect(heatmapThresholds([0, 0, 1, 2, 3, 4, 5, 6, 7, 8])).toEqual([3, 5, 7]);
    expect(heatmapThresholds([0, 0])).toEqual([0, 0, 0]);
  });

  it("maps counts to levels 0–4", () => {
    const t = [2, 4, 6] as const;
    expect([0, 1, 2, 3, 4, 5, 6, 7, 100].map((c) => heatLevel(c, t))).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it("is robust to a single outlier", () => {
    const t = heatmapThresholds([1, 2, 2, 3, 3, 3, 4, 500]);
    expect(heatLevel(3, t)).toBeGreaterThanOrEqual(2);
    expect(heatLevel(500, t)).toBe(4);
  });
});

describe("buildHeatmapGrid", () => {
  const dataset = combineSources([], { start: toISODate("2026-01-01"), end: toISODate("2026-03-31") }, "live");
  const grid = buildHeatmapGrid(dataset.days);

  it("places days in Sunday-first week columns", () => {
    // 2026-01-01 is a Thursday → column 0, row 4. 2026-01-04 (Sunday) starts column 1.
    expect(grid.cells[0]).toMatchObject({ column: 0, row: 4 });
    expect(grid.cells[3]).toMatchObject({ column: 1, row: 0 });
    expect(grid.columns).toBe(14); // week origin Sun 2025-12-28 … Tue 2026-03-31
  });

  it("labels months at the column containing the 1st", () => {
    expect(grid.monthLabels).toEqual([
      { label: "Jan", column: 0 },
      { label: "Feb", column: 5 },
      { label: "Mar", column: 9 },
    ]);
  });

  it("drops a cramped partial first-month label", () => {
    const partial = combineSources([], { start: toISODate("2026-01-28"), end: toISODate("2026-03-01") }, "live");
    expect(buildHeatmapGrid(partial.days).monthLabels.map((l) => l.label)).toEqual(["Feb", "Mar"]);
  });

  it("handles an empty series", () => {
    expect(buildHeatmapGrid([])).toEqual({ cells: [], columns: 0, monthLabels: [] });
  });
});

describe("heatmapGeometry", () => {
  it("fits a full year inside the available width", () => {
    const g = heatmapGeometry(53, 760, true);
    expect(g.gridWidth).toBeLessThanOrEqual(760);
    expect(g.cell).toBeGreaterThanOrEqual(8);
  });

  it("caps cell size for short ranges", () => {
    expect(heatmapGeometry(4, 760, false).cell).toBe(14);
  });
});
