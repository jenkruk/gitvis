import { describe, expect, it } from "vitest";
import type { PlatformContributions } from "@/domain/types";
import { configReducer, createDefaultConfig, getFeatureVisibility } from "./config";
import { FEATURES } from "./features";
import { LAYOUTS } from "./layouts";

const gh: PlatformContributions = { platform: "github", username: "a", days: [] };
const gl: PlatformContributions = { platform: "gitlab", username: "b", days: [] };

describe("feature registry", () => {
  it("has unique ids and the expected defaults", () => {
    expect(new Set(FEATURES.map((f) => f.id)).size).toBe(FEATURES.length);
    const defaults = createDefaultConfig().features;
    expect(defaults.bestDay).toBe(false);
    expect(defaults.heatmap).toBe(true);
  });

  it("every layout only references registered features", () => {
    const ids = new Set<string>(FEATURES.map((f) => f.id));
    for (const layout of LAYOUTS) {
      for (const feature of layout.supportedFeatures) expect(ids.has(feature)).toBe(true);
    }
  });
});

describe("configReducer", () => {
  it("keeps features, palette and mode when switching layouts", () => {
    let state = createDefaultConfig();
    state = configReducer(state, { type: "setFeature", feature: "bestDay", enabled: true });
    state = configReducer(state, { type: "setFeature", feature: "heatmap", enabled: false });
    state = configReducer(state, { type: "setPalette", palette: "ember" });
    state = configReducer(state, { type: "setMode", mode: "light" });

    const switched = configReducer(configReducer(state, { type: "setLayout", layout: "minimal" }), {
      type: "setLayout",
      layout: "dataRich",
    });

    expect(switched).toEqual({ ...state, layout: "dataRich" });
  });

  it("keeps layout and features when switching palettes", () => {
    const state = configReducer(createDefaultConfig(), { type: "setLayout", layout: "minimal" });
    const next = configReducer(state, { type: "setPalette", palette: "monochrome" });
    expect(next.layout).toBe("minimal");
    expect(next.features).toBe(state.features);
  });

  it("returns the same reference for no-op updates", () => {
    const state = createDefaultConfig();
    expect(configReducer(state, { type: "setLayout", layout: state.layout })).toBe(state);
    expect(configReducer(state, { type: "setFeature", feature: "heatmap", enabled: true })).toBe(state);
  });

  it("does not mutate previous state", () => {
    const state = createDefaultConfig();
    configReducer(state, { type: "setFeature", feature: "heatmap", enabled: false });
    expect(state.features.heatmap).toBe(true);
  });

  it("reset restores defaults", () => {
    const changed = configReducer(createDefaultConfig(), { type: "setPalette", palette: "ember" });
    expect(configReducer(changed, { type: "reset" })).toEqual(createDefaultConfig());
  });
});

describe("getFeatureVisibility", () => {
  const config = createDefaultConfig();

  it("reports disabled features", () => {
    expect(getFeatureVisibility("bestDay", config, { sources: [gh, gl] })).toEqual({
      visible: false,
      reason: "disabled",
    });
  });

  it("reports features the layout cannot show, without changing the setting", () => {
    const minimal = configReducer(config, { type: "setLayout", layout: "minimal" });
    expect(getFeatureVisibility("platformBreakdown", minimal, { sources: [gh, gl] })).toEqual({
      visible: false,
      reason: "unsupportedByLayout",
    });
    expect(minimal.features.platformBreakdown).toBe(true);
  });

  it("hides the breakdown when only one platform is connected", () => {
    expect(getFeatureVisibility("platformBreakdown", config, { sources: [gl] })).toEqual({
      visible: false,
      reason: "needsMultiplePlatforms",
    });
    expect(getFeatureVisibility("platformBreakdown", config, { sources: [gh, gl] })).toEqual({ visible: true });
  });
});
