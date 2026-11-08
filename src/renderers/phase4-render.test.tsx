import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { configReducer, createDefaultConfig, type VisualizationConfig } from "@/config/config";
import { LAYOUT_IDS } from "@/config/layouts";
import { combineSources } from "@/domain/combine";
import { addDays, toISODate, trailingYear } from "@/domain/dates";
import { renderSvgMarkup } from "@/publish/svg-markup";
import { contrastRatio } from "@/theme/color";
import { PALETTE_IDS, resolveTheme, withPlatformHeatmap } from "@/theme/palettes";
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

describe("centered profile header", () => {
  const centered = with_(
    { type: "setIdentityStyle", style: "centered" },
    { type: "setName", name: "Combined Activity" },
    { type: "setTitle", title: "Engineer" },
    { type: "setAvatar", platform: "github", enabled: true },
    { type: "setAvatar", platform: "gitlab", enabled: true },
  );
  const avatarX = (svg: string, platform: string) =>
    Number(
      new RegExp(`<image href="[^"]*" x="([\\d.]+)"[^>]*clip-path="url\\(#gitvis-avatar-${platform}\\)"`).exec(svg)![1],
    );

  it("centers the name, title and date range on the card", () => {
    const svg = render(centered);
    const middle = CANVAS_WIDTHS.full / 2;
    expect(svg).toContain(`<text x="${middle}" y="`);
    expect(svg).toMatch(new RegExp(`x="${middle}"[^>]*text-anchor="middle"[^>]*>Combined Activity</text>`));
    expect(svg).toMatch(new RegExp(`x="${middle}"[^>]*text-anchor="middle"[^>]*>Engineer</text>`));
    expect(svg).toMatch(new RegExp(`x="${middle}"[^>]*text-anchor="middle"[^>]*>Nov 7, 2025 – Nov 6, 2026</text>`));
  });

  it("puts GitHub's avatar and handle on the left and GitLab's on the right", () => {
    const svg = render(centered, { avatars: { github: AVATAR, gitlab: AVATAR } });
    expect(avatarX(svg, "github")).toBe(24);
    expect(avatarX(svg, "gitlab")).toBe(CANVAS_WIDTHS.full - 24 - 44);
    expect(svg).toMatch(/x="24"[^>]*text-anchor="start"[^>]*>.*@jenkruk/);
    expect(svg).toMatch(new RegExp(`x="${CANVAS_WIDTHS.full - 24}"[^>]*text-anchor="end"[^>]*>.*@contactkruk`));
  });

  it("shows the arrow cursor everywhere except over profile links", () => {
    const svg = render(centered);
    expect(svg).toMatch(/^<svg [^>]*cursor="default"/);
    expect(svg.match(/cursor="pointer"/g)).toHaveLength(2); // the GitHub and GitLab sections only
    // Compact/Full headers: the username links get the hand too.
    const compact = render(with_({ type: "setIdentityStyle", style: "compact" }));
    expect(compact).toMatch(/<a href="https:\/\/gitlab\.com\/contactkruk" target="_blank"><tspan cursor="pointer">/);
    // The original header's output is frozen, so it's left unchanged.
    expect(render(createDefaultConfig())).not.toContain("cursor=");
  });

  it("makes each account section one link to its profile, with a pointer cursor, except in the preview", () => {
    const svg = render(centered, { avatars: { github: AVATAR, gitlab: AVATAR } });
    for (const [url, platform, handle] of [
      ["https://github.com/jenkruk", "github", "@jenkruk"],
      ["https://gitlab.com/contactkruk", "gitlab", "@contactkruk"],
    ]) {
      const link = new RegExp(
        `<a href="${url!.replaceAll(".", "\\.")}" target="_blank"><g cursor="pointer">(.*?)</g></a>`,
      ).exec(svg);
      expect(link).not.toBeNull();
      // Invisible hit area + avatar + label, all inside the one link.
      expect(link![1]).toMatch(/^<rect [^>]*fill="#000" fill-opacity="0"/);
      expect(link![1]).toContain(`clip-path="url(#gitvis-avatar-${platform})"`);
      expect(link![1]).toContain(handle);
    }
    const preview = render(centered, { avatars: { github: AVATAR, gitlab: AVATAR }, links: false });
    expect(preview).not.toContain("<a ");
    expect(preview).not.toContain('cursor="pointer"');
    expect(preview).not.toContain('fill-opacity="0"');
    // The other profile headers link their avatars too.
    const full = render(
      with_({ type: "setIdentityStyle", style: "full" }, { type: "setAvatar", platform: "gitlab", enabled: true }),
    );
    expect(full).toMatch(/<a href="https:\/\/gitlab\.com\/contactkruk" target="_blank"><g cursor="pointer"><g><circle/);
  });

  it("links each handle to its profile and keeps attribution without avatars", () => {
    const svg = render(with_({ type: "setIdentityStyle", style: "centered" }));
    expect(svg).toContain('href="https://github.com/jenkruk"');
    expect(svg).toContain('href="https://gitlab.com/contactkruk"');
    expect(svg).not.toContain("<image");
  });

  it("describes the identity for screen readers, including the title", () => {
    expect(desc(render(centered))).toMatch(/^Contribution activity for Combined Activity, Engineer\. /);
  });

  it("stacks the accounts below the text and stays inside the compact image", () => {
    const svg = render(configReducer(centered, { type: "setName", name: "W".repeat(40) }), {
      size: "compact",
      avatars: { github: AVATAR, gitlab: AVATAR },
    });
    expect(avatarX(svg, "github")).toBe(24);
    expect(avatarX(svg, "gitlab")).toBe(CANVAS_WIDTHS.compact - 24 - 32);
    const nameLine = /<text[^>]*font-size="17"[^>]*>([^<]*)<\/text>/.exec(svg)![1]!;
    expect(nameLine.endsWith("…")).toBe(true);
  });

  it("shortens only an over-long username, keeping the full one in the description", () => {
    const long = {
      ...dataset,
      sources: dataset.sources.map((s) => ({ ...s, username: `${s.username}${"x".repeat(50)}` })),
    };
    const svg = renderToStaticMarkup(<Visualization dataset={long} config={centered} size="compact" />);
    const visible = svg.replace(/<desc[^>]*>[^<]*<\/desc>/, "");
    expect(visible).toMatch(/@jenkrukx+…/);
    expect(desc(svg)).toContain(`@jenkruk${"x".repeat(50)}`);
  });

  it("centers the sample-data badge under the dates", () => {
    const svg = renderToStaticMarkup(
      <Visualization dataset={{ ...dataset, provenance: "sample" }} config={centered} />,
    );
    const middle = CANVAS_WIDTHS.full / 2;
    expect(svg).toMatch(new RegExp(`<rect x="${middle - 42}" y="[\\d.]+" width="84" height="22"`));
  });
});

describe("credit line", () => {
  const credit = (svg: string) => /<text[^>]*>(<tspan>Made with GitVis[\s\S]*?)<\/text><\/svg>$/.exec(svg)?.[1];

  it("is on every card, at the bottom, and only 'Get yours!' links to GitVis (new tab, hand cursor)", () => {
    for (const layout of LAYOUT_IDS) {
      for (const size of ["full", "compact"] as const) {
        const svg = render({ ...createDefaultConfig(), layout }, { size, siteUrl: "https://gitvis.example" });
        const line = credit(svg);
        expect(line).toBe(
          '<tspan>Made with GitVis · created by Jen Kruk ·</tspan><a href="https://gitvis.example" target="_blank"><tspan cursor="pointer"><tspan dx="4" fill="' +
            /fill="(#[0-9a-f]{6})" font-weight="600"/.exec(line!)![1] +
            '" font-weight="600" text-decoration="underline">Get yours!</tspan></tspan></a>',
        );
        expect(svg.match(/href="https:\/\/gitvis\.example"/g)).toHaveLength(1);
      }
    }
  });

  it("is plain text without a site URL or in the studio preview (no links there)", () => {
    expect(credit(render(createDefaultConfig()))).not.toContain("<a ");
    const preview = render(createDefaultConfig(), { siteUrl: "https://gitvis.example", links: false });
    expect(credit(preview)).toContain("Get yours!");
    expect(preview).not.toContain("gitvis.example");
  });

  it("keeps readable contrast for the call to action in every palette and mode", () => {
    for (const palette of PALETTE_IDS) {
      for (const mode of ["light", "dark"] as const) {
        const svg = render({ ...createDefaultConfig(), palette, mode }, { siteUrl: "https://gitvis.example" });
        const fill =
          /<tspan dx="4" fill="(#[0-9a-f]{6})" font-weight="600" text-decoration="underline">Get yours!/.exec(svg)![1]!;
        expect(contrastRatio(fill, resolveTheme(palette, mode).background)).toBeGreaterThanOrEqual(4.5);
      }
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
    with_(
      { type: "setIdentityStyle", style: "centered" },
      { type: "setName", name: "Centered" },
      { type: "setTitle", title: "Engineer" },
      { type: "setAvatar", platform: "github", enabled: true },
      { type: "setAvatar", platform: "gitlab", enabled: true },
    ),
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

describe("heatmap colored by platform (custom platform colors)", () => {
  const custom = with_({ type: "setPlatformColor", platform: "gitlab", color: "#a7562a" });
  const cells = (svg: string) =>
    [...svg.matchAll(/<rect [^>]*rx="2" fill="(#[0-9a-f]{6})"><title>([^<]*)<\/title>/g)].map((m) => ({
      fill: m[1]!,
      title: m[2]!,
    }));

  it("leaves the default (no custom colors) on the palette's single ramp", () => {
    const svg = render(createDefaultConfig());
    const theme = resolveTheme("aurora", "dark");
    for (const { fill } of cells(svg)) expect(theme.heatmap).toContain(fill);
    expect(svg).not.toMatch(/>GitLab<\/text><rect/);
  });

  it("colors each day by the platform that contributed most, and labels both ramps", () => {
    const svg = render(custom);
    const theme = withPlatformHeatmap(resolveTheme("aurora", "dark", { series: [undefined, "#a7562a"] }));
    const [githubRamp, gitlabRamp] = theme.platformHeatmap!;
    const gitlabOnly = cells(svg).find((c) => /\(GitLab \d+\)$/.test(c.title))!;
    const githubOnly = cells(svg).find((c) => /\(GitHub \d+\)$/.test(c.title))!;
    expect(gitlabRamp.slice(1)).toContain(gitlabOnly.fill);
    expect(githubRamp.slice(1)).toContain(githubOnly.fill);
    // Single-platform days now name their platform in the tooltip.
    expect(gitlabOnly.title).toMatch(/ on .+ \(GitLab \d+\)$/);
    // The legend labels each hue.
    expect(svg).toMatch(/>Less<\/text>.*>GitHub<\/text>.*>GitLab<\/text>.*>More<\/text>/s);
  });

  it("keeps each platform ramp ordered and its top level readable on the surface (3:1)", () => {
    for (const mode of ["light", "dark"] as const) {
      const theme = withPlatformHeatmap(resolveTheme("mocha", mode, { series: ["#d9a46c", "#a7562a"] }));
      for (const ramp of theme.platformHeatmap!) {
        expect(ramp[0]).toBe(theme.heatmapEmpty);
        const contrasts = ramp.slice(1).map((c) => contrastRatio(c, theme.surface));
        for (let i = 1; i < contrasts.length; i++) expect(contrasts[i]!).toBeGreaterThan(contrasts[i - 1]!);
        expect(contrasts.at(-1)!).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("blends the two hues on days where both platforms tie", () => {
    const tie = combineSources(
      [
        { platform: "github", username: "a", days: [{ date: end, count: 3 }] },
        { platform: "gitlab", username: "b", days: [{ date: end, count: 3 }] },
      ],
      trailingYear(end),
      "live",
    );
    const svg = renderToStaticMarkup(<Visualization dataset={tie} config={custom} />);
    const theme = withPlatformHeatmap(resolveTheme("aurora", "dark", { series: [undefined, "#a7562a"] }));
    const today = cells(svg).find((c) => c.title.includes("Nov 6, 2026"))!;
    const [gh, gl] = theme.platformHeatmap!;
    expect(gh).not.toContain(today.fill);
    expect(gl).not.toContain(today.fill);
  });
});
