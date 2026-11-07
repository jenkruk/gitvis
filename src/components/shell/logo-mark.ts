/**
 * The GitVis mark: a 3×3 contribution grid. Single source for the header logo
 * and the app icons (src/app/icon.svg, favicon.ico, apple-icon.png — kept in
 * sync by logo-mark.test.ts).
 */
export const LOGO_VIEWBOX = 24;
/** Tailwind emerald-500, the header mark's color. */
export const LOGO_COLOR = "#10b981";

export const LOGO_CELLS = [0.35, 0.6, 1, 0.6, 1, 0.35, 1, 0.35, 0.6].map((opacity, i) => ({
  x: (i % 3) * 8 + 1,
  y: Math.floor(i / 3) * 8 + 1,
  size: 6,
  radius: 1.5,
  opacity,
}));

/** Standalone SVG markup of the mark (the source of src/app/icon.svg). */
export function logoSvg(): string {
  const rects = LOGO_CELLS.map(
    (c) =>
      `<rect x="${c.x}" y="${c.y}" width="${c.size}" height="${c.size}" rx="${c.radius}" fill="${LOGO_COLOR}" opacity="${c.opacity}"/>`,
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}">${rects}</svg>\n`;
}
