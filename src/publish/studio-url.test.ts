import { describe, expect, it } from "vitest";
import { createDefaultConfig, type VisualizationConfig } from "@/config/config";
import { FEATURE_IDS } from "@/config/features";
import { STAT_FEATURE_IDS } from "@/config/features";
import { encodeCardParams } from "./card-params";
import { legacyStudioRedirects, SAMPLE_PARAM, STUDIO_PATH, STUDIO_QUERY_KEYS } from "./studio-url";

const nonDefaultDesign: VisualizationConfig = {
  ...createDefaultConfig(),
  layout: "dataRich",
  palette: "lagoon",
  mode: "light",
  features: Object.fromEntries(FEATURE_IDS.map((id) => [id, true])) as VisualizationConfig["features"],
  identity: {
    style: "full",
    handles: ["github", "gitlab"],
    avatars: ["github", "gitlab"],
    name: "Avery",
    title: "Engineer",
    leftPlatform: "gitlab",
    avatarSide: "right",
  },
  background: "gradient",
  platformColors: { github: "#112233", gitlab: "#445566" },
  metricOrder: [...STAT_FEATURE_IDS].reverse(),
  range: 365,
  density: "compact",
  panel: "outlined",
  years: 3,
};

describe("studio URLs", () => {
  it("lists every key the card encoder writes, so old `/?…` studio links are all redirected", () => {
    const written = new Set<string>();
    for (const config of [nonDefaultDesign, { ...nonDefaultDesign, years: 1 as const, range: 90 as const }]) {
      const params = encodeCardParams({ request: { github: "a", gitlab: "b" }, config, size: "compact" });
      for (const key of params.keys()) written.add(key);
    }
    expect([...written].filter((key) => !(STUDIO_QUERY_KEYS as readonly string[]).includes(key))).toEqual([]);
    expect(written.size).toBeGreaterThan(20);
  });

  it("redirects `/` to the studio only when a studio key is present, keeping the query", () => {
    const redirects = legacyStudioRedirects();
    expect(redirects).toHaveLength(STUDIO_QUERY_KEYS.length);
    for (const r of redirects) {
      expect(r).toMatchObject({ source: "/", destination: STUDIO_PATH, permanent: false });
      expect(r.has).toEqual([{ type: "query", key: expect.any(String) }]);
      // Next passes the request's query through; a destination query would replace parts of it.
      expect(r.destination).not.toContain("?");
    }
    expect(redirects.map((r) => r.has[0]!.key)).toContain(SAMPLE_PARAM);
  });
});
