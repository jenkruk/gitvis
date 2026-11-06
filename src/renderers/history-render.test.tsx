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
import { resolveTheme } from "@/theme/palettes";
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

  it("gives every year its own card whose header pairs the dates with that year's total", () => {
    const svg = render();
    const prepared = prepareView(combined, years(3));
    for (const period of prepared.periods) {
      const total = `${period.total.toLocaleString("en-US")} contribution${period.total === 1 ? "" : "s"}`;
      // Dates and total share one header row (same y), so the total can't be read as another year's.
      const header = new RegExp(
        `y="(\\d+)"[^>]*>${period.range.end === "2026-11-06" ? "Nov 7, 2025" : "Nov"}[^<]*</text><text[^>]*y="\\1"[^>]*text-anchor="end"[^>]*>${total}<`,
      );
      expect(svg).toMatch(header);
    }
    // Filled panels: one framed card per year (plus stat cards and breakdown).
    const theme = resolveTheme("aurora", "dark");
    const cards = svg.match(
      new RegExp(`<rect x="24" y="\\d+" width="792" height="\\d+" rx="10" fill="${theme.surface}"`, "g"),
    );
    expect(cards!.length).toBeGreaterThanOrEqual(4); // 3 year cards + breakdown
  });

  it("year cards follow the panel style; Borderless keeps no boxes and uses hairline separators", () => {
    const outlined = render(combined, years(3, { type: "setPanel", panel: "outlined" }));
    expect(
      outlined.match(/<rect x="24" y="\d+" width="792" height="\d+" rx="10" fill="none"/g)!.length,
    ).toBeGreaterThanOrEqual(4);
    const borderless = render(combined, years(3, { type: "setPanel", panel: "borderless" }));
    expect(borderless).not.toMatch(/rx="10"/);
    expect(borderless.match(/<line x1="24" x2="816"/g)).toHaveLength(2); // between the three years
  });

  it("labels GitHub-only periods in words — no hatching — and never sums them with GitLab", () => {
    const svg = render();
    expect(svg.match(/>GitHub \+ GitLab</g)).toHaveLength(1); // newest card's coverage
    expect(svg.match(/>GitHub only · GitLab unavailable</g)).toHaveLength(2); // both older cards
    expect(svg).not.toMatch(/<pattern/);
    // Older cells say GitLab's count is unknown rather than zero.
    expect(svg).toMatch(/<title>\d+ contributions? on [^<]+ \(GitHub only; GitLab not available\)<\/title>/);
  });

  it("computes stats only over the span both platforms cover, and says so", () => {
    const prepared = prepareView(combined, years(3));
    expect(prepared.metricsView.range).toEqual(lastYear);
    const metrics = computeMetrics(prepared.metricsView);
    const svg = render();
    expect(svg).toContain(">Last 12 months · GitHub + GitLab<");
    expect(svg).toContain(">Platform breakdown · Last 12 months<");
    expect(desc(svg)).toContain("Summary statistics: Last 12 months, GitHub + GitLab.");
    expect(desc(svg)).toContain(`${metrics.total.toLocaleString("en-US")} contributions across`);
    expect(desc(svg)).toContain("from Nov 7, 2025 to Nov 6, 2026");
    expect(desc(svg)).toMatch(/By 12-month period, newest first: .*GitHub only; GitLab not available for this period/);
  });

  it("uses the full history for GitHub-only accounts, and labels that period", () => {
    const svg = render(githubOnly);
    expect(svg).toContain(">Last 3 years · GitHub<");
    expect(desc(svg)).toContain("Summary statistics: Last 3 years, GitHub.");
    expect(desc(svg)).toContain("from Nov 8, 2023 to Nov 6, 2026");
    expect(svg).not.toContain("GitHub only"); // a single platform's complete history isn't "only" anything
    expect(svg.match(/>GitHub</g)!.length).toBeGreaterThanOrEqual(3); // each card names its source
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

describe("source attribution", () => {
  it("one-year graphics keep their design: no period heading", () => {
    const svg = render(combined, years(1));
    expect(svg).not.toContain("Last 12 months");
    expect(svg).toContain("@jenkruk");
    expect(svg).toContain("@contactkruk");
  });

  it("moves labels to their own line, then shortens very long usernames, so attribution always fits", () => {
    const long = "a".repeat(120);
    const dataset = combineSources(
      [
        { ...gitlab, username: long, coverage: undefined },
        { ...github, coverage: undefined },
      ],
      lastYear,
      "live",
    );
    for (const size of ["full", "compact"] as const) {
      const svg = render(dataset, years(1), size);
      const visible = svg.replace(/<desc[\s\S]*?<\/desc>/, "");
      expect(visible).toContain("@jenkruk");
      expect(visible).toMatch(/@a+…</);
      expect(desc(svg)).toContain(`@${long}`); // full name in the text alternative
    }
  });
});
