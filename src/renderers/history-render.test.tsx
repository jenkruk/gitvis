import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { configReducer, createDefaultConfig, type VisualizationConfig } from "@/config/config";
import { LAYOUT_IDS } from "@/config/layouts";
import { combineSources } from "@/domain/combine";
import { addDays, toISODate, trailingYear } from "@/domain/dates";
import { historyRange } from "@/domain/history";
import type { PlatformContributions } from "@/domain/types";
import { computeMetrics } from "@/metrics/metrics";
import { renderSvgMarkup } from "@/publish/svg-markup";
import { Visualization } from "./Visualization";
import { prepareView } from "./view";

const end = toISODate("2026-11-06");
const threeYears = historyRange(end, 3);
const lastYear = trailingYear(end);

const github: PlatformContributions = {
  platform: "github",
  username: "jenkruk",
  profileUrl: "https://github.com/jenkruk",
  coverage: threeYears,
  days: Array.from({ length: 300 }, (_, i) => ({ date: addDays(end, -i * 3), count: (i % 4) + 1 })),
};
const gitlab: PlatformContributions = {
  platform: "gitlab",
  username: "contactkruk",
  profileUrl: "https://gitlab.com/contactkruk",
  coverage: lastYear,
  days: Array.from({ length: 60 }, (_, i) => ({ date: addDays(end, -i * 5), count: 2 })),
};
const combined = combineSources([github, gitlab], threeYears, "live");
const githubOnly = combineSources([github], threeYears, "live");
const gitlabOnly = combineSources([{ ...gitlab, coverage: undefined }], lastYear, "live");

const config = (...steps: Parameters<typeof configReducer>[1][]): VisualizationConfig =>
  steps.reduce(configReducer, createDefaultConfig());
const years = (n: 1 | 2 | 3, ...rest: Parameters<typeof configReducer>[1][]) =>
  config({ type: "setYears", years: n }, ...rest);
const render = (dataset = combined, c = years(3), size: "full" | "compact" = "full") =>
  renderToStaticMarkup(<Visualization dataset={dataset} config={c} size={size} />);
const desc = (svg: string) => /<desc[^>]*>([^<]*)<\/desc>/.exec(svg)![1]!.replaceAll("&#x27;", "'");

describe("multi-year history", () => {
  it("draws one calendar per 12-month period, newest first, with a single legend", () => {
    const svg = render();
    const titles = [...svg.matchAll(/font-weight="600" fill="[^"]+"[^>]*>([A-Z][a-z]{2} \d+, \d{4} – [^<]+)</g)].map(
      (m) => m[1],
    );
    expect(titles).toEqual(["Nov 7, 2025 – Nov 6, 2026", "Nov 7, 2024 – Nov 6, 2025", "Nov 8, 2023 – Nov 6, 2024"]);
    expect(svg.match(/>More</g)).toHaveLength(1);
  });

  it("labels GitHub-only periods in words — no hatching — and never sums them with GitLab", () => {
    const svg = render();
    expect(svg).toContain("GitHub only");
    expect(svg.match(/GitLab history isn&#x27;t available for this period\./g)).toHaveLength(2);
    expect(svg).not.toMatch(/<pattern/);
    // Older cells say GitLab's count is unknown rather than zero.
    expect(svg).toMatch(/<title>\d+ contributions? on [^<]+ \(GitHub only; GitLab not available\)<\/title>/);
  });

  it("computes stats only over the span both platforms cover, and says so", () => {
    const prepared = prepareView(combined, years(3));
    expect(prepared.metricsView.range).toEqual(lastYear);
    const metrics = computeMetrics(prepared.metricsView);
    const svg = render();
    expect(svg).toContain("Stats cover Nov 7, 2025 – Nov 6, 2026, when every platform has data");
    expect(desc(svg)).toContain(`${metrics.total.toLocaleString("en-US")} contributions across`);
    expect(desc(svg)).toContain("from Nov 7, 2025 to Nov 6, 2026");
    expect(desc(svg)).toMatch(/By 12-month period, newest first: .*GitHub only; GitLab not available for this period/);
  });

  it("uses the full history for GitHub-only accounts (no scope note)", () => {
    const svg = render(githubOnly);
    expect(svg).not.toContain("Stats cover");
    expect(desc(svg)).toContain("from Nov 8, 2023 to Nov 6, 2026");
    expect(svg).not.toContain("GitHub only"); // a single platform's complete history isn't "only" anything
  });

  it("shows 2 years when asked, from the same 3-year data", () => {
    const svg = render(combined, years(2));
    expect(svg).toContain("Nov 7, 2024 – Nov 6, 2025");
    expect(svg).not.toContain("Nov 8, 2023 – Nov 6, 2024");
  });

  it("explains, rather than fakes, history GitLab can't provide", () => {
    const svg = render(gitlabOnly, years(3));
    expect(svg.match(/>More</g)).toHaveLength(1);
    expect(svg).toContain("The 2 earlier years aren&#x27;t available: GitLab publishes only the last 12 months.");
    expect(desc(svg)).toContain("GitLab publishes only the last 12 months");
  });

  it("phones get yearly summaries and a readable recent heatmap, not three tiny calendars", () => {
    const svg = render(combined, years(3), "compact");
    expect(svg).toMatch(/^<svg[^>]+width="400"/);
    expect(svg).toContain("Last 20 weeks");
    for (const label of ["Nov 7, 2025 – Nov 6, 2026", "Nov 7, 2024 – Nov 6, 2025", "Nov 8, 2023 – Nov 6, 2024"]) {
      expect(svg).toContain(label);
    }
    // One heatmap (recent weeks) — roughly 140 cells, not 1,095.
    expect(svg.match(/<rect [^>]*rx="2"[^>]*><title>/g)!.length).toBeLessThan(150);
  });

  it("works in every layout and matches React's renderer byte-for-byte", () => {
    for (const layout of LAYOUT_IDS) {
      for (const size of ["full", "compact"] as const) {
        const element = <Visualization dataset={combined} config={{ ...years(3), layout }} size={size} />;
        expect(renderSvgMarkup(element)).toBe(renderToStaticMarkup(element));
      }
    }
  });

  it("a 1-year design of a 3-year dataset equals the 1-year graphic of the last 12 months", () => {
    const oneYear = combineSources(
      [
        { ...github, coverage: undefined, days: github.days.filter((d) => d.date >= lastYear.start) },
        { ...gitlab, coverage: undefined },
      ],
      lastYear,
      "live",
    );
    expect(render(combined, years(1))).toBe(render(oneYear, years(1)));
  });
});
