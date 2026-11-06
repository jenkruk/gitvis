import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { configReducer, createDefaultConfig, type VisualizationConfig } from "@/config/config";
import { LAYOUT_IDS } from "@/config/layouts";
import { combineSources } from "@/domain/combine";
import { addDays, toISODate, trailingYear } from "@/domain/dates";
import { renderSvgMarkup } from "@/publish/svg-markup";
import { contrastRatio } from "@/theme/color";
import { resolveTheme } from "@/theme/palettes";
import { CANVAS_WIDTHS } from "./primitives";
import { Visualization } from "./Visualization";

const end = toISODate("2026-11-06");
const dataset = combineSources(
  [
    {
      platform: "github",
      username: "jenkruk",
      profileUrl: "https://github.com/jenkruk",
      days: Array.from({ length: 120 }, (_, i) => ({ date: addDays(end, -i * 3), count: (i % 6) + 1 })),
    },
    {
      platform: "gitlab",
      username: "contactkruk",
      profileUrl: "https://gitlab.com/contactkruk",
      days: Array.from({ length: 60 }, (_, i) => ({ date: addDays(end, -i * 5), count: (i % 3) + 1 })),
    },
  ],
  trailingYear(end),
  "live",
);
const AVATAR = "data:image/png;base64,iVBORw0KGgo=";

function with_(...steps: Parameters<typeof configReducer>[1][]): VisualizationConfig {
  return steps.reduce(configReducer, createDefaultConfig());
}
const render = (config: VisualizationConfig, extra: Partial<Parameters<typeof Visualization>[0]> = {}) =>
  renderToStaticMarkup(<Visualization dataset={dataset} config={config} {...extra} />);
const desc = (svg: string) => /<desc[^>]*>([^<]*)<\/desc>/.exec(svg)![1]!;

describe("profile identity", () => {
  const full = with_(
    { type: "setIdentityStyle", style: "full" },
    { type: "setName", name: "Jen Kruk" },
    { type: "setTitle", title: "Senior Frontend Engineer" },
    { type: "setAvatar", platform: "github", enabled: true },
    { type: "setAvatar", platform: "gitlab", enabled: true },
  );

  it("renders name, title, handles and embedded (data: URI) avatars in the full profile", () => {
    const svg = render(full, { avatars: { github: AVATAR } });
    expect(svg).toContain(">Jen Kruk</text>");
    expect(svg).toContain("Senior Frontend Engineer");
    expect(svg).toContain(`href="${AVATAR}"`);
    expect(svg).not.toMatch(/href="https?:\/\/[^"]*\.(png|jpe?g)/); // never an external image
    expect(svg).toContain('clip-path="url(#gitvis-avatar-github)"');
    // GitLab avatar missing → monogram initial, not a broken image.
    expect(svg).toMatch(/<text[^>]*>C<\/text>/);
  });

  it("describes the identity for screen readers and titles the graphic with the name", () => {
    const svg = render(full);
    expect(svg).toContain('<title id="gitvis-title">Contribution activity — Jen Kruk</title>');
    expect(desc(svg)).toMatch(/^Contribution activity for Jen Kruk, Senior Frontend Engineer\. /);
  });

  it("compact identity omits the title but always attributes every account", () => {
    const svg = render(
      with_(
        { type: "setIdentityStyle", style: "compact" },
        { type: "setName", name: "Jen" },
        { type: "setTitle", title: "Hidden in compact" },
      ),
    );
    const visible = svg.replace(/<desc[^>]*>[^<]*<\/desc>/, "");
    expect(visible).toContain("@jenkruk");
    expect(visible).toContain("@contactkruk");
    expect(desc(svg)).toContain("GitLab @contactkruk");
    expect(svg).not.toContain("Hidden in compact");
  });

  it("keeps a 40-character name on one line without overflowing the compact image", () => {
    const svg = render(with_({ type: "setIdentityStyle", style: "full" }, { type: "setName", name: "W".repeat(40) }), {
      size: "compact",
    });
    const nameLine = /<text[^>]*font-size="17"[^>]*>([^<]*)<\/text>/.exec(svg)![1]!;
    expect(nameLine.endsWith("…")).toBe(true);
    for (const [, x, w] of svg.matchAll(/<rect x="([\d.]+)" y="[\d.-]+" width="([\d.]+)"/g)) {
      expect(Number(x) + Number(w)).toBeLessThanOrEqual(CANVAS_WIDTHS.compact);
    }
  });
});

describe("background styles", () => {
  it("gradient uses a unique, self-contained linear gradient", () => {
    const svg = render(with_({ type: "setBackground", background: "gradient" }), { idPrefix: "x1" });
    expect(svg).toContain('<linearGradient id="x1-bg"');
    expect(svg).toContain('fill="url(#x1-bg)"');
  });

  it("transparent draws no canvas fill or border", () => {
    const svg = render(with_({ type: "setBackground", background: "transparent" }));
    expect(svg).not.toMatch(/<rect x="0.5" y="0.5"/);
  });
});

describe("platform colors", () => {
  it("applies custom colors to series and corrects inaccessible ones", () => {
    const surface = resolveTheme("aurora", "dark").surface;
    const config = with_(
      { type: "setPlatformColor", platform: "github", color: "#ff7a59" },
      { type: "setPlatformColor", platform: "gitlab", color: surface }, // invisible on the surface
    );
    const svg = render(config);
    expect(svg).toContain('fill="#ff7a59"');
    const fixed = resolveTheme("aurora", "dark", { series: [undefined, surface] }).series[1];
    expect(contrastRatio(fixed, surface)).toBeGreaterThanOrEqual(3);
    expect(svg).toContain(`fill="${fixed}"`);
  });
});

describe("date range, density and metric order", () => {
  it.each([30, 90] as const)("limits everything to the last %i days", (days) => {
    const svg = render(with_({ type: "setRange", range: days }));
    const start = addDays(end, -(days - 1));
    expect(desc(svg)).toContain(
      `from ${new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${start}T00:00:00Z`))}`,
    );
    expect(svg.match(/contributions? on /g)!.length).toBe(days); // one heatmap cell tooltip per day
  });

  it("compact density produces a shorter graphic than spacious", () => {
    const height = (svg: string) => Number(/height="(\d+)"/.exec(svg)![1]);
    const base = with_({ type: "setLayout", layout: "dataRich" });
    expect(height(render(configReducer(base, { type: "setDensity", density: "compact" })))).toBeLessThan(
      height(render(base)),
    );
  });

  it("orders stat cards as configured and wraps 5 cards into rows of 3", () => {
    const config = with_(
      { type: "setFeature", feature: "bestDay", enabled: true },
      { type: "setFeature", feature: "currentStreak", enabled: true },
      { type: "moveMetric", metric: "currentStreak", direction: -1 },
      { type: "moveMetric", metric: "currentStreak", direction: -1 },
      { type: "moveMetric", metric: "currentStreak", direction: -1 },
      { type: "moveMetric", metric: "currentStreak", direction: -1 },
    );
    const svg = render(config);
    const labels = [
      ...svg.matchAll(/font-weight="500"[^>]*>(Contributions|Active days|Longest streak|Best day|Current streak)</g),
    ].map((m) => m[1]);
    expect(labels).toEqual(["Current streak", "Contributions", "Active days", "Longest streak", "Best day"]);
    const cardWidth = (792 - 2 * 12) / 3;
    expect(svg).toContain(`width="${cardWidth}"`);
  });
});

describe("parity with React for every Phase 4 option", () => {
  const variants: VisualizationConfig[] = [
    with_({ type: "setIdentityStyle", style: "compact" }, { type: "setAvatar", platform: "github", enabled: true }),
    with_(
      { type: "setIdentityStyle", style: "full" },
      { type: "setName", name: `A <b>"bold"</b> & 'name'` },
      { type: "setTitle", title: "Engineer" },
    ),
    with_({ type: "setBackground", background: "gradient" }, { type: "setPalette", palette: "paperInk" }),
    with_({ type: "setBackground", background: "transparent" }, { type: "setMode", mode: "light" }),
    with_({ type: "setRange", range: 30 }, { type: "setDensity", density: "compact" }),
    with_({ type: "setPlatformColor", platform: "gitlab", color: "#123456" }),
    with_({ type: "setPanel", panel: "outlined" }, { type: "setBackground", background: "gradient" }),
    with_({ type: "setPanel", panel: "borderless" }, { type: "setBackground", background: "transparent" }),
  ];

  it("matches renderToStaticMarkup byte-for-byte (all layouts, both sizes)", () => {
    for (const base of variants) {
      for (const layout of LAYOUT_IDS) {
        for (const size of ["full", "compact"] as const) {
          const element = (
            <Visualization dataset={dataset} config={{ ...base, layout }} size={size} avatars={{ github: AVATAR }} />
          );
          expect(renderSvgMarkup(element)).toBe(renderToStaticMarkup(element));
        }
      }
    }
  });

  it("escapes user-supplied names safely", () => {
    const svg = renderSvgMarkup(<Visualization dataset={dataset} config={variants[1]!} />);
    expect(svg).toContain("A &lt;b&gt;&quot;bold&quot;&lt;/b&gt; &amp; &#x27;name&#x27;");
    expect(svg).not.toContain("<b>");
  });
});

describe("panel styles (Phase 4.2)", () => {
  const panels = (svg: string) => [...svg.matchAll(/<rect [^>]*rx="10"[^>]*>/g)].map((m) => m[0]);
  const dataRich = (panel: "filled" | "outlined" | "borderless") =>
    with_({ type: "setLayout", layout: "dataRich" }, { type: "setPanel", panel });

  it("filled draws every panel with the surface fill and border", () => {
    const theme = resolveTheme("aurora", "dark");
    const rects = panels(render(dataRich("filled")));
    expect(rects.length).toBeGreaterThanOrEqual(6); // 4 stat cards, heatmap, breakdown, charts
    for (const rect of rects) expect(rect).toContain(`fill="${theme.surface}" stroke="${theme.border}"`);
  });

  it("outlined keeps the border and drops the fill, consistently for every panel", () => {
    const theme = resolveTheme("aurora", "dark");
    const rects = panels(render(dataRich("outlined")));
    expect(rects).toHaveLength(panels(render(dataRich("filled"))).length);
    for (const rect of rects) expect(rect).toContain(`fill="none" stroke="${theme.border}"`);
  });

  it("borderless draws no panel shapes but keeps every section's content", () => {
    const svg = render(dataRich("borderless"));
    expect(panels(svg)).toEqual([]);
    for (const label of [">Contributions<", "Platform breakdown", ">Less<", ">More<"]) expect(svg).toContain(label);
    // Same geometry: sections keep their spacing, so the graphic's height doesn't change.
    const height = (markup: string) => /height="(\d+)"/.exec(markup)![1];
    expect(height(svg)).toBe(height(render(dataRich("filled"))));
  });

  it("is independent of the canvas background", () => {
    const svg = render(
      with_({ type: "setPanel", panel: "outlined" }, { type: "setBackground", background: "transparent" }),
    );
    expect(svg).not.toMatch(/<rect x="0.5" y="0.5"/); // no canvas
    expect(panels(svg).length).toBeGreaterThan(0);
  });
});
