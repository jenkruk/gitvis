import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOGO_CELLS, logoSvg } from "./logo-mark";

describe("logo mark", () => {
  it("app/icon.svg is exactly the header mark (regenerate both from logo-mark.ts if this fails)", () => {
    const icon = readFileSync(join(process.cwd(), "src/app/icon.svg"), "utf8");
    expect(icon).toBe(logoSvg());
  });

  it("is a 3×3 grid of contribution cells inside the 24px viewBox", () => {
    expect(LOGO_CELLS).toHaveLength(9);
    for (const cell of LOGO_CELLS) {
      expect(cell.x + cell.size).toBeLessThanOrEqual(24);
      expect(cell.y + cell.size).toBeLessThanOrEqual(24);
    }
  });
});
