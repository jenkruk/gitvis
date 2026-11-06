import { describe, expect, it } from "vitest";
import { contrastRatio, isHexColor } from "./color";
import { type ColorMode, PALETTES, resolveTheme } from "./palettes";

const MODES: ColorMode[] = ["light", "dark"];
const cases = PALETTES.flatMap((p) => MODES.map((mode) => [p.name, mode, resolveTheme(p.id, mode)] as const));

describe("palettes", () => {
  it("includes the nine curated palettes with unique ids", () => {
    expect(PALETTES).toHaveLength(9);
    expect(new Set(PALETTES.map((p) => p.id)).size).toBe(9);
  });

  describe.each(cases)("%s (%s)", (_name, _mode, theme) => {
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
