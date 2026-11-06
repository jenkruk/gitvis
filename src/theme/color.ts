/** Minimal color math: hex parsing, interpolation and WCAG 2.x contrast. */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: string): boolean {
  return HEX_PATTERN.test(value);
}

export function parseHex(hex: string): RGB {
  const match = HEX_PATTERN.exec(hex);
  if (!match) throw new RangeError(`Invalid hex color: "${hex}"`);
  let digits = match[1]!;
  if (digits.length === 3) digits = [...digits].map((c) => c + c).join("");
  const n = Number.parseInt(digits, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function toHex({ r, g, b }: RGB): string {
  const channel = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Linear interpolation in sRGB. `t` = 0 returns `from`, 1 returns `to`. */
export function mix(from: string, to: string, t: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  return toHex({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });
}

/** `steps` evenly spaced colors from `from` to `to`, inclusive of both ends. */
export function ramp(from: string, to: string, steps: number): string[] {
  if (steps < 2) return [to];
  return Array.from({ length: steps }, (_, i) => mix(from, to, i / (steps - 1)));
}

function channelLuminance(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG contrast ratio, 1–21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
