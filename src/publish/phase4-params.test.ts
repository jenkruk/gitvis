import { describe, expect, it } from "vitest";
import { configReducer, createDefaultConfig, type VisualizationConfig } from "@/config/config";
import { decodeCardParams, encodeCardParams, MAX_QUERY_LENGTH } from "./card-params";

const decode = (q: string) => decodeCardParams(new URLSearchParams(q));

function fullyCustomized(): VisualizationConfig {
  let c = createDefaultConfig();
  const steps: Parameters<typeof configReducer>[1][] = [
    { type: "setPalette", palette: "midnightNeon" },
    { type: "setIdentityStyle", style: "full" },
    { type: "setAvatar", platform: "gitlab", enabled: true },
    { type: "setAvatar", platform: "github", enabled: true },
    { type: "setName", name: "Jen Kruk" },
    { type: "setTitle", title: "Senior Frontend Engineer · Accessibility" },
    { type: "setBackground", background: "gradient" },
    { type: "setPlatformColor", platform: "github", color: "#FF7A59" },
    { type: "moveMetric", metric: "bestDay", direction: -1 },
    { type: "setFeature", feature: "currentStreak", enabled: true },
    { type: "setRange", range: 90 },
    { type: "setDensity", density: "compact" },
    { type: "setPanel", panel: "outlined" },
  ];
  for (const step of steps) c = configReducer(c, step);
  return c;
}

describe("Phase 4 URL params", () => {
  it("round-trip every new setting losslessly", () => {
    const config = fullyCustomized();
    const decoded = decodeCardParams(
      encodeCardParams({ request: { github: "jenkruk", gitlab: "contactkruk" }, config }),
    );
    expect(decoded.issues).toEqual([]);
    expect(decoded.config).toEqual(config);
  });

  it("encode compactly and canonically", () => {
    const query = encodeCardParams({ request: { github: "jenkruk" }, config: fullyCustomized() }).toString();
    expect(query).toContain("palette=midnight-neon");
    expect(query).toContain("hdr=full&av=github%2Cgitlab&name=Jen+Kruk");
    expect(query).toContain(
      "bg=gradient&pc=github%3Aff7a59&ord=total%2Cactive%2Cbest%2Cstreak%2Ccurrent&range=90&den=compact&pnl=outlined",
    );
    // Feature codes follow registry order; "current" never appears in pre-Phase-4 URLs, so their f= is unchanged.
    expect(query).toContain("f=heatmap%2Ctotal%2Cactive%2Cstreak%2Ccurrent%2Cbreakdown%2Ctrends%2Clabels");
  });

  it("leave legacy-equivalent designs with the same params (no new params written; same URL as before)", () => {
    const query = encodeCardParams({ request: { github: "jenkruk" }, config: createDefaultConfig() }).toString();
    expect(query).toBe(
      "v=1&github=jenkruk&layout=dashboard&palette=aurora&mode=dark&f=heatmap%2Ctotal%2Cactive%2Cstreak%2Cbreakdown%2Ctrends%2Clabels",
    );
  });

  it("fit within the query limit even with maximal multi-byte name and title", () => {
    let c = fullyCustomized();
    // 4-byte code points percent-encode to 12 characters each: the worst case for URL length.
    c = configReducer(c, { type: "setName", name: "😀".repeat(40) });
    c = configReducer(c, { type: "setTitle", title: "😀".repeat(60) });
    const query = encodeCardParams({ request: { github: "a".repeat(39), gitlab: "b".repeat(60) }, config: c });
    expect(query.toString().length).toBeLessThanOrEqual(MAX_QUERY_LENGTH);
    expect(decodeCardParams(query).issues).toEqual([]);
  });

  it.each([
    ["hdr=banner", "hdr"],
    ["hl=github,bitbucket", "hl"],
    ["av=myspace", "av"],
    ["bg=plaid", "bg"],
    ["pc=github:zzzzzz", "pc"],
    ["pc=gitlab", "pc"],
    ["ord=total,sparkles", "ord"],
    ["range=7", "range"],
    ["den=cozy", "den"],
    [`name=${"x".repeat(41)}`, "name"],
    [`title=${"y".repeat(61)}`, "title"],
  ])("reject invalid %s", (param, issue) => {
    expect(decode(`v=1&github=jenkruk&${param}`).issues.map((i) => i.param)).toContain(issue);
  });

  it("strip control and bidi-override characters from free text", () => {
    const { config } = decode(`v=1&github=jenkruk&hdr=full&name=${encodeURIComponent("Jen‮\u0000 Kruk")}`);
    expect(config.identity.name).toBe("Jen Kruk");
  });

  it("keep emoji ZWJ sequences and Persian ZWNJ intact", () => {
    const name = "Jen 🧑‍💻 می‌خواهم";
    expect(configReducer(createDefaultConfig(), { type: "setName", name }).identity.name).toBe(name);
  });

  it("complete a partial metric order with the remaining metrics", () => {
    expect(decode("v=1&github=jenkruk&ord=best,total").config.metricOrder).toEqual([
      "bestDay",
      "totalContributions",
      "activeDays",
      "longestStreak",
      "currentStreak",
    ]);
  });

  it("decode the six new palettes", () => {
    for (const code of [
      "github-classic",
      "gitlab-inspired",
      "nordic-frost",
      "solarized",
      "midnight-neon",
      "paper-ink",
    ]) {
      expect(decode(`v=1&github=jenkruk&palette=${code}`).issues).toEqual([]);
    }
  });
});

describe("centered profile header (hdr=centered)", () => {
  it("golden: v=1&github=jenkruk&hdr=centered decodes to the centered header", () => {
    const { config, issues } = decode("v=1&github=jenkruk&hdr=centered");
    expect(issues).toEqual([]);
    expect(config.identity.style).toBe("centered");
  });

  it("round-trips with avatars, name and title", () => {
    const config = [
      { type: "setIdentityStyle", style: "centered" },
      { type: "setAvatar", platform: "github", enabled: true },
      { type: "setName", name: "Combined Activity" },
      { type: "setTitle", title: "Engineer" },
    ].reduce((c, a) => configReducer(c, a as Parameters<typeof configReducer>[1]), createDefaultConfig());
    const query = encodeCardParams({ request: { github: "jenkruk", gitlab: "contactkruk" }, config }).toString();
    expect(query).toContain("hdr=centered&av=github&name=Combined+Activity&title=Engineer");
    expect(decodeCardParams(new URLSearchParams(query)).config).toEqual(config);
  });
});

describe("Phase 4.2 panel style (pnl)", () => {
  it("is absent for filled panels, so existing URLs never change", () => {
    expect(decode("v=1&github=jenkruk").config.panel).toBe("filled");
    const query = encodeCardParams({ request: { github: "jenkruk" }, config: createDefaultConfig() }).toString();
    expect(query).not.toContain("pnl");
  });

  it.each([
    ["v=1&github=jenkruk&pnl=outlined", "outlined"],
    ["v=1&github=jenkruk&pnl=borderless", "borderless"],
    ["v=1&github=jenkruk&pnl=filled", "filled"],
  ] as const)("golden: %s → %s", (query, panel) => {
    const { config, issues } = decode(query);
    expect(issues).toEqual([]);
    expect(config.panel).toBe(panel);
  });

  it("reports an unknown panel code and falls back to filled", () => {
    const { config, issues } = decode("v=1&github=jenkruk&pnl=glass");
    expect(config.panel).toBe("filled");
    expect(issues.map((i) => i.param)).toEqual(["pnl"]);
  });

  it("is independent of the background setting", () => {
    const config = { ...createDefaultConfig(), background: "transparent" as const, panel: "borderless" as const };
    const query = encodeCardParams({ request: { github: "jenkruk" }, config }).toString();
    expect(query).toContain("bg=transparent&pnl=borderless");
    expect(decode(query).config).toEqual(config);
  });
});

describe("Phase 4.2 history (yrs)", () => {
  it("is absent for one year, so existing URLs never change", () => {
    expect(decode("v=1&github=jenkruk").config.years).toBe(1);
    expect(
      encodeCardParams({ request: { github: "jenkruk" }, config: createDefaultConfig() }).toString(),
    ).not.toContain("yrs");
  });

  it.each([
    ["v=1&github=jenkruk&yrs=2", 2],
    ["v=1&github=jenkruk&yrs=3", 3],
    ["v=1&github=jenkruk&yrs=1", 1],
  ] as const)("golden: %s → %i years", (query, years) => {
    const { config, issues } = decode(query);
    expect(issues).toEqual([]);
    expect(config).toMatchObject({ years, range: 365 });
  });

  it("round-trips and keeps legacy 30/90/365-day URLs decoding exactly as before", () => {
    const config = configReducer(createDefaultConfig(), { type: "setYears", years: 3 });
    const query = encodeCardParams({ request: { github: "jenkruk" }, config }).toString();
    expect(query).toContain("yrs=3");
    expect(query).not.toContain("range=");
    expect(decode(query).config).toEqual(config);
    for (const range of [30, 90, 365] as const) {
      expect(decode(`v=1&github=jenkruk&range=${range}`).config).toMatchObject({ range, years: 1 });
    }
  });

  it("rejects unknown values and conflicting ranges", () => {
    expect(decode("v=1&github=jenkruk&yrs=5").issues.map((i) => i.param)).toEqual(["yrs"]);
    const conflict = decode("v=1&github=jenkruk&yrs=3&range=30");
    expect(conflict.issues.map((i) => i.param)).toEqual(["yrs"]);
    expect(conflict.config).toMatchObject({ years: 3, range: 365 }); // the lenient studio view
  });

  it("choosing years always uses the full 365-day range; a legacy range resets to one year", () => {
    let c = configReducer(createDefaultConfig(), { type: "setRange", range: 90 });
    c = configReducer(c, { type: "setYears", years: 2 });
    expect(c).toMatchObject({ years: 2, range: 365 });
    expect(configReducer(c, { type: "setRange", range: 30 })).toMatchObject({ years: 1, range: 30 });
  });
});
