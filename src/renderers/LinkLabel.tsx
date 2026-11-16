import { ensureContrast } from "@/theme/color";
import { GITHUB_SURFACES } from "@/theme/palettes";
import { CANVAS_WIDTH, FONT_STACK, PADDING } from "./primitives";

export const LINK_LABEL_MODES = ["dark", "light"] as const;
export type LinkLabelMode = (typeof LINK_LABEL_MODES)[number];

export const LINK_LABEL_KINDS = {
  cta: { fontSize: 16, fontWeight: 600, align: "left" },
  gitlab: { fontSize: 13, fontWeight: 400, align: "right" },
  repo: { fontSize: 13, fontWeight: 400, align: "right" },
} as const;
export type LinkLabelKind = keyof typeof LINK_LABEL_KINDS;

export const LINK_LABEL_SPANS = { half: CANVAS_WIDTH / 2, full: CANVAS_WIDTH } as const;
export type LinkLabelSpan = keyof typeof LINK_LABEL_SPANS;

const DEFAULT_COLORS: Record<LinkLabelMode, string> = { dark: "#4493f8", light: "#0969da" };

export function linkLabelColor(mode: LinkLabelMode, color?: string): string {
  return ensureContrast(color ?? DEFAULT_COLORS[mode], GITHUB_SURFACES[mode][0]!, 4.5);
}

const HEIGHT = 22;
const BASELINE = 16;
export const LINK_LABEL_INSET = PADDING;

export function LinkLabel({
  kind,
  text,
  mode,
  color,
  span = "half",
  inset = false,
}: {
  kind: LinkLabelKind;
  text: string;
  mode: LinkLabelMode;
  color?: string;
  span?: LinkLabelSpan;
  inset?: boolean;
}) {
  const { fontSize, fontWeight, align } = LINK_LABEL_KINDS[kind];
  const width = LINK_LABEL_SPANS[span];
  const edge = inset ? LINK_LABEL_INSET : 0;
  return (
    <TextImage
      text={text}
      width={width}
      height={HEIGHT}
      baseline={BASELINE}
      x={align === "left" ? edge : width - edge}
      anchor={align === "left" ? "start" : "end"}
      fontSize={fontSize}
      fontWeight={fontWeight}
      fill={linkLabelColor(mode, color)}
    />
  );
}

export type LineStyle = "card" | "fitted" | "small";
export type LinePart = "cta" | "repo";

interface LinePartSpec {
  width: number;
  x: number;
  fontSize: number;
  fontWeight: number;
}

// Text widths are the widest measured renderings in the font stack (San Francisco), plus slack.
export const LINE_STYLES: Record<
  LineStyle,
  { height: number; baseline: number; cta: LinePartSpec; repo: LinePartSpec; spacer: number }
> = {
  card: {
    height: HEIGHT,
    baseline: BASELINE,
    cta: { width: PADDING + 76, x: PADDING, fontSize: 16, fontWeight: 600 },
    repo: { width: CANVAS_WIDTH - PADDING - 76, x: 5, fontSize: 14, fontWeight: 400 },
    spacer: 0,
  },
  fitted: {
    height: HEIGHT,
    baseline: BASELINE,
    cta: { width: PADDING + 76, x: PADDING, fontSize: 16, fontWeight: 600 },
    repo: { width: 5 + 165, x: 5, fontSize: 14, fontWeight: 400 },
    spacer: 0,
  },
  small: {
    height: 20,
    baseline: 14,
    cta: { width: 14 + 70, x: 14, fontSize: 14, fontWeight: 600 },
    repo: { width: 5 + 142, x: 5, fontSize: 12, fontWeight: 400 },
    spacer: 820 - (14 + 70) - (5 + 142),
  },
};

export function LineLabel({
  part,
  style,
  text,
  mode,
  color,
}: {
  part: LinePart;
  style: LineStyle;
  text: string;
  mode: LinkLabelMode;
  color?: string;
}) {
  const { height, baseline } = LINE_STYLES[style];
  const spec = LINE_STYLES[style][part];
  return (
    <TextImage
      text={text}
      width={spec.width}
      height={height}
      baseline={baseline}
      x={spec.x}
      anchor="start"
      fontSize={spec.fontSize}
      fontWeight={spec.fontWeight}
      fill={linkLabelColor(mode, color)}
    />
  );
}

export function LineSpacer() {
  const width = LINE_STYLES.small.spacer;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={1} viewBox={`0 0 ${width} 1`} aria-hidden="true" />
  );
}

function TextImage({
  text,
  width,
  height,
  baseline,
  x,
  anchor,
  fontSize,
  fontWeight,
  fill,
}: {
  text: string;
  width: number;
  height: number;
  baseline: number;
  x: number;
  anchor: "start" | "end";
  fontSize: number;
  fontWeight: number;
  fill: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={text}
    >
      <title>{text}</title>
      <text
        x={x}
        y={baseline}
        textAnchor={anchor}
        fontSize={fontSize}
        fontWeight={fontWeight}
        fill={fill}
        fontFamily={FONT_STACK}
      >
        {text}
      </text>
    </svg>
  );
}
