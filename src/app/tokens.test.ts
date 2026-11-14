import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/theme/color";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

const declarations = [...css.matchAll(/--gv-([a-z-]+):\s*light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\);/gi)];
const schemes = {
  light: Object.fromEntries(declarations.map((m) => [m[1]!, m[2]!])),
  dark: Object.fromEntries(declarations.map((m) => [m[1]!, m[3]!])),
};

const TEXT = ["fg", "fg-muted", "fg-subtle"];
const BACKGROUNDS = ["canvas", "surface", "surface-raised", "surface-hover", "selected"];

describe("studio token file", () => {
  it("declares every color token as light-dark(light, dark)", () => {
    const names = [...css.matchAll(/--gv-([a-z-]+):/g)].map((m) => m[1]!);
    const colorNames = names.filter((n) => !n.startsWith("shadow"));
    expect(new Set(colorNames)).toEqual(new Set(Object.keys(schemes.light)));
  });
});

describe.each(Object.entries(schemes))("studio tokens (%s)", (_scheme, t) => {
  it.each(TEXT.flatMap((fg) => BACKGROUNDS.map((bg) => [fg, bg] as const)))("%s text on %s ≥ 4.5:1", (fg, bg) => {
    expect(contrastRatio(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["ink-fg", "ink"],
    ["ink-fg", "ink-hover"],
    ["accent-fg", "accent"],
    ["success", "success-bg"],
    ["warning", "warning-bg"],
    ["danger", "danger-bg"],
    ["success", "surface"],
    ["danger", "surface"],
    ["accent", "surface"],
    ["accent", "surface-hover"],
    ["accent", "selected"],
  ])("%s on %s ≥ 4.5:1", (fg, bg) => {
    expect(contrastRatio(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["canvas", "surface", "surface-raised", "surface-hover", "selected"])(
    "focus ring, selection border and control boundaries are visible on %s (≥ 3:1)",
    (bg) => {
      expect(contrastRatio(t.focus!, t[bg]!)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(t.accent!, t[bg]!)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(t["line-strong"]!, t[bg]!)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(t.ink!, t[bg]!)).toBeGreaterThanOrEqual(3);
    },
  );

  it("switch thumbs stand out from their tracks (≥ 3:1)", () => {
    expect(contrastRatio(t.thumb!, t["line-strong"]!)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(t["thumb-on"]!, t.accent!)).toBeGreaterThanOrEqual(3);
  });

  it("keeps the surface hierarchy distinct", () => {
    const distinct = new Set([t.canvas, t.surface, t["surface-hover"]]);
    expect(distinct.size).toBe(3);
    expect(t.focus).not.toBe(t.accent);
  });
});
