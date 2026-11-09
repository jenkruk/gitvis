import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createDefaultConfig, type VisualizationConfig } from "@/config/config";
import { FEATURE_IDS } from "@/config/features";
import { LAYOUT_IDS } from "@/config/layouts";
import { combineSources } from "@/domain/combine";
import { toISODate } from "@/domain/dates";
import { createSampleDataset } from "@/fixtures/sample-dataset";
import { ErrorCard } from "@/renderers/ErrorCard";
import { Visualization } from "@/renderers/Visualization";
import { PALETTE_IDS, resolveTheme } from "@/theme/palettes";
import { escapeMarkup, renderSvgMarkup } from "./svg-markup";

const datasets = {
  both: createSampleDataset(),
  gitlabOnly: createSampleDataset(["gitlab"]),
  empty: combineSources([], { start: toISODate("2026-01-01"), end: toISODate("2026-12-31") }, "live"),
  live: combineSources(
    [
      {
        platform: "github",
        username: "jenkruk",
        profileUrl: "https://github.com/jenkruk",
        days: [{ date: toISODate("2026-03-03"), count: 4 }],
        privateCount: 3,
      },
    ],
    { start: toISODate("2025-11-07"), end: toISODate("2026-11-06") },
    "live",
  ),
};

describe("renderSvgMarkup parity with react-dom/server", () => {
  it("matches for compact (mobile) images in every layout and edge dataset", () => {
    for (const layout of LAYOUT_IDS) {
      for (const dataset of Object.values(datasets)) {
        const element = (
          <Visualization dataset={dataset} config={{ ...createDefaultConfig(), layout }} size="compact" />
        );
        expect(renderSvgMarkup(element)).toBe(renderToStaticMarkup(element));
      }
    }
  });

  it("matches for every layout × palette × mode", () => {
    for (const layout of LAYOUT_IDS) {
      for (const palette of PALETTE_IDS) {
        for (const mode of ["light", "dark"] as const) {
          const element = (
            <Visualization dataset={datasets.both} config={{ ...createDefaultConfig(), layout, palette, mode }} />
          );
          expect(renderSvgMarkup(element), `${layout}/${palette}/${mode}`).toBe(renderToStaticMarkup(element));
        }
      }
    }
  });

  it("matches for every feature combination per layout and for edge datasets", () => {
    const allOn = Object.fromEntries(FEATURE_IDS.map((id) => [id, true])) as VisualizationConfig["features"];
    const allOff = Object.fromEntries(FEATURE_IDS.map((id) => [id, false])) as VisualizationConfig["features"];
    for (const layout of LAYOUT_IDS) {
      for (const features of [allOn, allOff]) {
        for (const dataset of Object.values(datasets)) {
          const element = <Visualization dataset={dataset} config={{ ...createDefaultConfig(), layout, features }} />;
          expect(renderSvgMarkup(element)).toBe(renderToStaticMarkup(element));
        }
      }
    }
  });

  it("matches for error cards, including escaping", () => {
    const element = (
      <ErrorCard theme={resolveTheme("ember", "light")} title={`Can't <load> "x" & y`} message="m" hint="h" />
    );
    expect(renderSvgMarkup(element)).toBe(renderToStaticMarkup(element));
  });
});

describe("renderSvgMarkup safety", () => {
  it("escapes text and attribute values like React", () => {
    expect(escapeMarkup(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#x27;&amp;&#x27;&lt;/a&gt;");
  });

  it("refuses props that would diverge from static output", () => {
    expect(() => renderSvgMarkup(<rect onClick={() => {}} />)).toThrow(/unsupported prop "onClick"/);
    expect(() => renderSvgMarkup(<rect style={{ fill: "red" }} />)).toThrow(/unsupported prop "style"/);
    expect(() => renderSvgMarkup(<rect className="x" />)).toThrow(/unsupported prop "className"/);
  });
});
