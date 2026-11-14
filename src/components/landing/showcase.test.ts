import { describe, expect, it } from "vitest";
import { createDefaultConfig } from "@/config/config";
import { decodeCardParams } from "@/publish/card-params";
import { DEFAULT_SHOWCASE, sampleHref, showcaseConfig, SHOWCASE_PALETTES, studioHref } from "./showcase";

describe("landing showcase", () => {
  it("uses the studio's own config: a default design with only palette, mode and preset changed", () => {
    const config = showcaseConfig({ preset: "graphic", palette: "terracotta", mode: "light" });
    expect(config).toEqual({ ...createDefaultConfig(), palette: "terracotta", mode: "light" });
    const profile = showcaseConfig({ ...DEFAULT_SHOWCASE, preset: "profile" });
    expect(profile.identity.style).toBe("full");
    expect(profile.identity.name).toBe("");
  });

  it("offers three palettes from the curated set", () => {
    expect(SHOWCASE_PALETTES).toHaveLength(3);
  });

  it("carries the chosen design into the studio: Connect for the main action, sample Design for the other", () => {
    const choice = { preset: "profile", palette: "githubClassic", mode: "light" } as const;
    const create = new URL(studioHref(choice), "https://gitvis.test");
    expect(create.pathname).toBe("/studio");
    expect(create.hash).toBe("");
    expect(create.searchParams.has("sample")).toBe(false);
    expect(decodeCardParams(create.searchParams)).toMatchObject({ request: null, config: showcaseConfig(choice) });

    const sample = new URL(sampleHref(choice), "https://gitvis.test");
    expect(sample.pathname).toBe("/studio");
    expect(sample.hash).toBe("#design");
    expect(sample.searchParams.get("sample")).toBe("1");
    expect(decodeCardParams(sample.searchParams).config).toEqual(showcaseConfig(choice));
  });

  it("never puts accounts in the links (sample data can't be published)", () => {
    for (const href of [studioHref(DEFAULT_SHOWCASE), sampleHref(DEFAULT_SHOWCASE)]) {
      const search = new URL(href, "https://gitvis.test").searchParams;
      expect(search.has("github")).toBe(false);
      expect(search.has("gitlab")).toBe(false);
    }
  });
});
