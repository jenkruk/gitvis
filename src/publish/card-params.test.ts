import { describe, expect, it } from "vitest";
import { createDefaultConfig, type VisualizationConfig, withAttribution } from "@/config/config";
import { FEATURE_IDS, type FeatureFlags } from "@/config/features";
import { LAYOUT_IDS } from "@/config/layouts";
import { PALETTE_IDS } from "@/theme/palettes";
import { decodeCardParams, encodeCardParams, MAX_QUERY_LENGTH } from "./card-params";

const decode = (query: string) => decodeCardParams(new URLSearchParams(query));
const flags = (...on: string[]) => Object.fromEntries(FEATURE_IDS.map((id) => [id, on.includes(id)])) as FeatureFlags;

describe("card params: round trip", () => {
  it("round-trips every layout × palette × mode", () => {
    for (const layout of LAYOUT_IDS) {
      for (const palette of PALETTE_IDS) {
        for (const mode of ["light", "dark"] as const) {
          const config: VisualizationConfig = { ...createDefaultConfig(), layout, palette, mode };
          const decoded = decodeCardParams(encodeCardParams({ request: { github: "jenkruk" }, config }));
          expect(decoded).toEqual({ request: { github: "jenkruk" }, config, issues: [] });
        }
      }
    }
  });

  it("round-trips every single-feature and empty feature set", () => {
    const sets = [[], ...FEATURE_IDS.map((id) => [id])];
    for (const on of sets) {
      const config = { ...createDefaultConfig(), features: flags(...on) };
      expect(decodeCardParams(encodeCardParams({ request: { gitlab: "contactkruk" }, config })).config).toEqual(
        withAttribution(config),
      );
    }
  });

  it("supports GitHub-only, GitLab-only and combined usernames", () => {
    for (const request of [
      { github: "jenkruk" },
      { gitlab: "contactkruk" },
      { github: "jenkruk", gitlab: "contactkruk" },
    ]) {
      expect(decodeCardParams(encodeCardParams({ request, config: createDefaultConfig() })).request).toEqual(request);
    }
  });

  it("encodes every parameter explicitly, in a stable order", () => {
    const query = encodeCardParams({
      request: { github: "jenkruk", gitlab: "contactkruk" },
      config: { ...createDefaultConfig(), layout: "dataRich", palette: "desertSunset", mode: "light" },
    }).toString();
    expect(query).toBe(
      "v=1&github=jenkruk&gitlab=contactkruk&layout=data-rich&palette=desert-sunset&mode=light&f=heatmap%2Ctotal%2Cactive%2Cstreak%2Cbreakdown%2Ctrends%2Clabels",
    );
  });
});

const LEGACY_EXTRAS = {
  identity: { style: "none", handles: ["github", "gitlab"], avatars: [], name: "", title: "" },
  background: "solid",
  platformColors: {},
  metricOrder: ["totalContributions", "activeDays", "longestStreak", "bestDay", "currentStreak"],
  range: 365,
  density: "spacious",
  panel: "filled",
  years: 1,
} as const satisfies Omit<VisualizationConfig, "layout" | "palette" | "mode" | "features">;
const legacy = (c: Pick<VisualizationConfig, "layout" | "palette" | "mode" | "features">): VisualizationConfig =>
  ({
    ...structuredClone(LEGACY_EXTRAS),
    ...c,
  }) as VisualizationConfig;

describe("card params: v1 compatibility (golden URLs)", () => {
  const golden: [string, VisualizationConfig][] = [
    [
      "v=1&github=jenkruk&layout=minimal&palette=monochrome&mode=light&f=heatmap,total",
      legacy({
        layout: "minimal",
        palette: "monochrome",
        mode: "light",
        features: flags("heatmap", "totalContributions"),
      }),
    ],
    [
      "v=1&gitlab=contactkruk&layout=data-rich&palette=forest-gold&mode=dark&f=heatmap,total,active,streak,best,breakdown,trends,labels",
      legacy({
        layout: "dataRich",
        palette: "forestGold",
        mode: "dark",
        features: flags(
          "heatmap",
          "totalContributions",
          "activeDays",
          "longestStreak",
          "bestDay",
          "platformBreakdown",
          "activityTrends",
          "platformLabels",
        ),
      }),
    ],
    [
      "github=jenkruk",
      legacy({
        layout: "dashboard",
        palette: "aurora",
        mode: "dark",
        features: flags(
          "heatmap",
          "totalContributions",
          "activeDays",
          "longestStreak",
          "platformBreakdown",
          "activityTrends",
          "platformLabels",
        ),
      }),
    ],
    ["v=1&github=jenkruk&f=", legacy({ layout: "dashboard", palette: "aurora", mode: "dark", features: flags() })],
  ];

  it.each(golden)("%s", (query, config) => {
    expect(decode(query)).toEqual({ request: expect.any(Object), config: withAttribution(config), issues: [] });
  });

  it("treats the optional size param as a non-breaking addition", () => {
    expect(decode("v=1&github=jenkruk").size).toBeUndefined();
    expect(decode("v=1&github=jenkruk&size=full")).toMatchObject({ issues: [] });
    expect(decode("v=1&github=jenkruk&size=compact")).toMatchObject({ size: "compact", issues: [] });
    expect(decode("v=1&github=jenkruk&size=huge").issues).toEqual([{ param: "size", message: "Unknown size “huge”." }]);
    const config = createDefaultConfig();
    expect(encodeCardParams({ request: { github: "jenkruk" }, config }).has("size")).toBe(false);
    expect(encodeCardParams({ request: { github: "jenkruk" }, config, size: "compact" }).get("size")).toBe("compact");
  });

  it("ignores unknown parameters (room for future optional params such as colors)", () => {
    expect(decode("v=1&github=jenkruk&colors=abc&utm_source=readme").issues).toEqual([]);
  });

  it("uses the first value of repeated parameters", () => {
    expect(decode("github=jenkruk&layout=minimal&layout=dashboard").config.layout).toBe("minimal");
  });
});

describe("card params: validation", () => {
  it("requires at least one username", () => {
    const decoded = decode("layout=minimal");
    expect(decoded.request).toBeNull();
    expect(decoded.issues).toEqual([{ param: "github", message: "Add a github and/or gitlab username." }]);
  });

  it("rejects invalid usernames", () => {
    const decoded = decode("github=../admin&gitlab=contactkruk");
    expect(decoded.request).toBeNull();
    expect(decoded.issues).toEqual([{ param: "github", message: "Invalid github username." }]);
  });

  it("reports unknown codes but still returns a usable config", () => {
    const decoded = decode("github=jenkruk&layout=fancy&palette=neon&mode=sepia&f=heatmap,sparkles");
    expect(decoded.issues.map((i) => i.param)).toEqual(["layout", "palette", "mode", "f"]);
    expect(decoded.config).toMatchObject({ layout: "dashboard", palette: "aurora", mode: "dark" });
    expect(decoded.config.features.heatmap).toBe(true);
  });

  it("rejects unsupported versions", () => {
    expect(decode("v=2&github=jenkruk").issues).toEqual([{ param: "v", message: "Unsupported version “2”." }]);
  });

  it("rejects overly long queries and truncates echoed values", () => {
    const decoded = decode(`github=jenkruk&layout=${"x".repeat(MAX_QUERY_LENGTH)}`);
    expect(decoded.issues[0]).toMatchObject({ param: "*" });
    expect(decoded.issues.find((i) => i.param === "layout")!.message.length).toBeLessThan(60);
  });

  it("does not use internal ids as URL codes", () => {
    expect(decode("github=jenkruk&layout=dataRich").issues).toEqual([
      { param: "layout", message: "Unknown layout “dataRich”." },
    ]);
  });
});

describe("card params: source attribution", () => {
  it("always shows every connected account, whatever f and hl say", () => {
    for (const query of [
      "v=1&github=jenkruk&gitlab=contactkruk&f=heatmap",
      "v=1&github=jenkruk&gitlab=contactkruk&f=",
      "v=1&github=jenkruk&gitlab=contactkruk&hl=github",
      "github=jenkruk&gitlab=contactkruk&hl=",
    ]) {
      const { config, issues } = decode(query);
      expect(issues).toEqual([]);
      expect(config.features.platformLabels).toBe(true);
      expect(config.identity.handles).toEqual(["github", "gitlab"]);
    }
  });

  it("never writes hl, and a design that tried to hide accounts encodes like the default", () => {
    const hidden = withAttribution(createDefaultConfig());
    const query = encodeCardParams({
      request: { github: "jenkruk" },
      config: {
        ...hidden,
        features: { ...hidden.features, platformLabels: false },
        identity: { ...hidden.identity, handles: [] },
      },
    }).toString();
    expect(query).toBe(
      "v=1&github=jenkruk&layout=dashboard&palette=aurora&mode=dark&f=heatmap%2Ctotal%2Cactive%2Cstreak%2Cbreakdown%2Ctrends%2Clabels",
    );
  });

  it("decodes the nine new palette codes", () => {
    for (const code of [
      "obsidian-gold",
      "velvet-plum",
      "lagoon",
      "citrus",
      "terracotta",
      "mocha",
      "porcelain",
      "sage-linen",
      "volt",
    ]) {
      expect(decode(`v=1&github=jenkruk&palette=${code}`).issues).toEqual([]);
    }
  });
});
