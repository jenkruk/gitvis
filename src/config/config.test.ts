import { describe, expect, it } from "vitest";
import type { PlatformContributions } from "@/domain/types";
import { configReducer, createDefaultConfig, getFeatureVisibility, presetOf } from "./config";
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

describe("starting presets", () => {
  it("are derived from the identity style, so they never add URL state", () => {
    const config = createDefaultConfig();
    expect(presetOf(config)).toBe("graphic");
    expect(presetOf({ identity: { ...config.identity, style: "compact" } })).toBe("profile");
  });

  it("profile card turns on the full header and avatars, keeping every other axis", () => {
    const start = { ...createDefaultConfig(), layout: "dataRich" as const, palette: "ember" as const };
    const profile = configReducer(start, { type: "applyPreset", preset: "profile" });
    expect(profile.identity).toMatchObject({ style: "full", avatars: ["github", "gitlab"] });
    expect({ ...profile, identity: start.identity }).toEqual(start);
  });

  it("keeps an existing avatar choice and a compact header when already a profile card", () => {
    const compact = configReducer(
      configReducer(createDefaultConfig(), { type: "setIdentityStyle", style: "compact" }),
      { type: "setAvatar", platform: "gitlab", enabled: true },
    );
    expect(configReducer(compact, { type: "applyPreset", preset: "profile" })).toBe(compact);
    const fromGraphic = configReducer(configReducer(compact, { type: "applyPreset", preset: "graphic" }), {
      type: "applyPreset",
      preset: "profile",
    });
    expect(fromGraphic.identity.avatars).toEqual(["gitlab"]);
  });

  it("graphic hides the header but remembers name and title", () => {
    const named = configReducer(configReducer(createDefaultConfig(), { type: "applyPreset", preset: "profile" }), {
      type: "setName",
      name: "Avery",
    });
    const graphic = configReducer(named, { type: "applyPreset", preset: "graphic" });
    expect(graphic.identity).toMatchObject({ style: "none", name: "Avery" });
  });
});

describe("switching presets back and forth", () => {
  it("restores the user's own profile header and avatars instead of the preset defaults", () => {
    const custom = [
      { type: "applyPreset", preset: "profile" },
      { type: "setIdentityStyle", style: "compact" },
      { type: "setAvatar", platform: "github", enabled: false },
      { type: "setAvatar", platform: "gitlab", enabled: false },
      { type: "setName", name: "Avery" },
      { type: "setTitle", title: "Engineer" },
      { type: "setHandle", platform: "gitlab", enabled: false },
    ] as const;
    const profile = custom.reduce(configReducer, createDefaultConfig());
    const graphic = configReducer(profile, { type: "applyPreset", preset: "graphic" });
    const back = configReducer(graphic, {
      type: "applyPreset",
      preset: "profile",
      restore: { style: profile.identity.style as "compact", avatars: profile.identity.avatars },
    });
    expect(back.identity).toEqual(profile.identity);
  });
});
