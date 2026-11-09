import { describe, expect, it } from "vitest";
import { combineSources } from "@/domain/combine";
import { addDays, toISODate, trailingYear } from "@/domain/dates";
import { createSampleDataset } from "@/fixtures/sample-dataset";
import { Visualization } from "@/renderers/Visualization";
import { decodeCardParams } from "./card-params";
import { renderSvgMarkup } from "./svg-markup";

/**
 * Published-URL compatibility guard: URLs generated before Phase 4 must keep
 * rendering byte-identical SVG. Snapshots were recorded BEFORE Phase 4 changes;
 * never update them to make a test pass — a diff here means old READMEs changed.
 *
 * One deliberate, pre-launch exception (Nov 2026, before any deployment): source
 * attribution became mandatory in v1, so "minimal-mono-light" and "no-features"
 * (which hid account labels) were re-recorded once. Nothing had been published.
 *
 * Second pre-launch exception (Nov 8, 2026, still undeployed): every card gained the
 * "Made with GitVis · created by Jen Kruk" credit line, so all snapshots
 * were re-recorded once. The only differences are the credit <text> and the taller card (+36px).
 * In the same pre-launch window the graphic lost all links (profile links live under the image in
 * the README snippet instead): header handles became plain <tspan>s and the root got cursor="default".
 */
const LEGACY_URLS: Record<string, string> = {
  "dashboard-default": "v=1&github=jenkruk&gitlab=contactkruk",
  "minimal-mono-light": "v=1&github=jenkruk&layout=minimal&palette=monochrome&mode=light&f=heatmap,total,active,streak",
  "datarich-all":
    "v=1&github=jenkruk&gitlab=contactkruk&layout=data-rich&palette=amethyst&mode=dark&f=heatmap,total,active,streak,best,breakdown,trends,labels",
  "dashboard-gitlab-ember": "v=1&gitlab=contactkruk&palette=ember&mode=light&f=heatmap,total,labels",
  "datarich-compact": "v=1&github=jenkruk&gitlab=contactkruk&layout=data-rich&palette=forest-gold&size=compact",
  "minimal-compact": "v=1&gitlab=contactkruk&layout=minimal&palette=rose-quartz&mode=light&size=compact",
  "no-features": "v=1&github=jenkruk&f=",
};

const end = toISODate("2026-11-06");
const liveDataset = combineSources(
  [
    {
      platform: "github",
      username: "jenkruk",
      profileUrl: "https://github.com/jenkruk",
      days: Array.from({ length: 40 }, (_, i) => ({ date: addDays(end, -i * 7), count: (i % 5) + 1 })),
      fetchedAt: "2026-11-06T10:00:00.000Z",
    },
    {
      platform: "gitlab",
      username: "contactkruk",
      profileUrl: "https://gitlab.com/contactkruk",
      days: Array.from({ length: 30 }, (_, i) => ({ date: addDays(end, -i * 3), count: (i % 4) + 2 })),
      fetchedAt: "2026-11-06T10:00:00.000Z",
    },
  ],
  trailingYear(end),
  "live",
);

describe("legacy v1 URLs render byte-identical SVG", () => {
  for (const [name, query] of Object.entries(LEGACY_URLS)) {
    it(name, async () => {
      const { config, size, issues } = decodeCardParams(new URLSearchParams(query));
      expect(issues).toEqual([]);
      for (const [label, dataset] of [
        ["live", liveDataset],
        ["sample", createSampleDataset()],
      ] as const) {
        const svg = renderSvgMarkup(<Visualization dataset={dataset} config={config} size={size} />);
        await expect(svg).toMatchFileSnapshot(`./__snapshots__/legacy/${name}.${label}.svg`);
      }
    });
  }
});
