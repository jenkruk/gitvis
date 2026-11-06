import { describe, expect, it } from "vitest";
import { configReducer, createDefaultConfig, type VisualizationConfig } from "@/config/config";
import { decodeCardParams, encodeCardParams, MAX_QUERY_LENGTH } from "./card-params";

const decode = (q: string) => decodeCardParams(new URLSearchParams(q));

function fullyCustomized(): VisualizationConfig {
  let c = createDefaultConfig();
  const steps: Parameters<typeof configReducer>[1][] = [
    { type: "setPalette", palette: "midnightNeon" },
    { type: "setIdentityStyle", style: "full" },
    { type: "setHandle", platform: "gitlab", enabled: false },
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
    expect(query).toContain("hdr=full&hl=github&av=github%2Cgitlab&name=Jen+Kruk");
    expect(query).toContain(
      "bg=gradient&pc=github%3Aff7a59&ord=total%2Cactive%2Cbest%2Cstreak%2Ccurrent&range=90&den=compact",
    );
    // Feature codes follow registry order; "current" never appears in pre-Phase-4 URLs, so their f= is unchanged.
    expect(query).toContain("f=heatmap%2Ctotal%2Cactive%2Cstreak%2Ccurrent%2Cbreakdown%2Ctrends%2Clabels");
  });

  it("leave legacy-equivalent designs with byte-identical URLs (no new params written)", () => {
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
