import { describe, expect, it } from "vitest";
import { contrastRatio, ensureContrast, isHexColor } from "./color";
import {
  applyPanelStyle,
  type BackdropStyle,
  type ColorMode,
  GITHUB_SURFACES,
  gradientEnd,
  PALETTES,
  panelBackdrops,
  resolveTheme,
} from "./palettes";

const MODES: ColorMode[] = ["light", "dark"];
const cases = PALETTES.flatMap((p) => MODES.map((mode) => [p.name, mode, resolveTheme(p.id, mode)] as const));

describe("palettes", () => {
  it("includes the fifteen curated palettes with unique ids", () => {
    expect(PALETTES).toHaveLength(15);
    expect(new Set(PALETTES.map((p) => p.id)).size).toBe(15);
  });

  describe.each(cases)("%s (%s)", (_name, mode, theme) => {
    it("keeps text readable on the gradient background", () => {
      const end = gradientEnd(theme);
      expect(contrastRatio(theme.text, end)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.textMuted, end)).toBeGreaterThanOrEqual(4.5);
    });

    it("works with a transparent background on the matching GitHub theme", () => {
      // Transparent graphics are published with theme matching, so each mode meets its GitHub surfaces.
      for (const page of GITHUB_SURFACES[mode]) {
        expect(contrastRatio(theme.text, page), `text on ${page}`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(theme.textMuted, page), `muted on ${page}`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(theme.heatmap[4], page), `heatmap on ${page}`).toBeGreaterThanOrEqual(3);
      }
    });

    it("uses valid hex colors everywhere", () => {
      const colors = [
        theme.background,
        theme.surface,
        theme.border,
        theme.text,
        theme.textMuted,
        theme.accent,
        ...theme.heatmap,
        ...theme.series,
      ];
      for (const color of colors) expect(isHexColor(color), color).toBe(true);
    });

    it("keeps body text readable (WCAG AA 4.5:1)", () => {
      expect(contrastRatio(theme.text, theme.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.text, theme.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.textMuted, theme.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.textMuted, theme.background)).toBeGreaterThanOrEqual(4.5);
    });

    it("keeps graphical elements distinguishable (WCAG 1.4.11 3:1)", () => {
      expect(contrastRatio(theme.accent, theme.surface)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(theme.heatmap[4], theme.surface)).toBeGreaterThanOrEqual(3);
      for (const series of theme.series) {
        expect(contrastRatio(series, theme.surface)).toBeGreaterThanOrEqual(3);
      }
    });

    it("orders heatmap levels from least to most contrast against the surface", () => {
      const contrasts = theme.heatmap.slice(1).map((c) => contrastRatio(c, theme.surface));
      for (let i = 1; i < contrasts.length; i++) {
        expect(contrasts[i]!).toBeGreaterThan(contrasts[i - 1]!);
      }
    });

    it("gives the two platform series visibly different colors", () => {
      expect(theme.series[0]).not.toBe(theme.series[1]);
    });
  });
});

describe("custom platform colors", () => {
  it("keeps an accessible custom color unchanged", () => {
    const theme = resolveTheme("aurora", "dark", { series: ["#ff7a59", undefined] });
    expect(theme.series[0]).toBe("#ff7a59");
    expect(theme.series[1]).toBe(resolveTheme("aurora", "dark").series[1]);
  });

  it.each(PALETTES.flatMap((p) => (["light", "dark"] as const).map((m) => [p.id, m] as const)))(
    "adjusts low-contrast custom colors to ≥ 3:1 on %s (%s)",
    (id, mode) => {
      const surface = resolveTheme(id, mode).surface;
      // Worst case: a color equal to the surface itself.
      const theme = resolveTheme(id, mode, { series: [surface, "#808080"] });
      for (const color of theme.series) expect(contrastRatio(color, surface)).toBeGreaterThanOrEqual(3);
    },
  );

  it("ensureContrast moves toward black on light surfaces and white on dark ones", () => {
    expect(contrastRatio(ensureContrast("#ffff00", "#ffffff", 3), "#ffffff")).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(ensureContrast("#202020", "#0d1117", 3), "#0d1117")).toBeGreaterThanOrEqual(3);
  });
});

describe("outlined and borderless panels", () => {
  const BACKDROPS: BackdropStyle[] = ["solid", "gradient", "transparent"];
  const combos = PALETTES.flatMap((p) =>
    (["light", "dark"] as const).flatMap((mode) =>
      BACKDROPS.flatMap((bg) => (["outlined", "borderless"] as const).map((style) => [p.id, mode, bg, style] as const)),
    ),
  );

  it.each(combos)("%s (%s, %s background, %s) stays readable on what's actually underneath", (id, mode, bg, style) => {
    // Worst case custom series: a color equal to the backdrop.
    const base = resolveTheme(id, mode, { series: [resolveTheme(id, mode).background, undefined] });
    const backdrops = panelBackdrops(base, bg, mode);
    const theme = applyPanelStyle(base, style, backdrops);
    for (const backdrop of backdrops) {
      expect(contrastRatio(theme.text, backdrop), `text on ${backdrop}`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.textMuted, backdrop), `muted on ${backdrop}`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.accent, backdrop), `accent on ${backdrop}`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(theme.heatmap[4], backdrop), `heatmap on ${backdrop}`).toBeGreaterThanOrEqual(3);
      for (const series of theme.series) expect(contrastRatio(series, backdrop)).toBeGreaterThanOrEqual(3);
    }
    // The Sample badge keeps its filled surface: its text must still read there.
    expect(contrastRatio(theme.text, theme.surface)).toBeGreaterThanOrEqual(4.5);
    expect(theme.panelFill).toBe("none");
    expect(theme.panelStroke).toBe(style === "outlined" ? theme.border : "none");
  });

  it("leaves filled panels untouched (existing embeds stay byte-identical)", () => {
    const base = resolveTheme("aurora", "dark");
    expect(applyPanelStyle(base, "filled", panelBackdrops(base, "transparent", "dark"))).toBe(base);
  });
});
