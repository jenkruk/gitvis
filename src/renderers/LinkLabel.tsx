import { ensureContrast } from "@/theme/color";
import { CANVAS_WIDTH, FONT_STACK, PADDING } from "./primitives";

export const LINK_LABEL_MODES = ["dark", "light"] as const;
export type LinkLabelMode = (typeof LINK_LABEL_MODES)[number];

export const LINK_LABEL_KINDS = {
  cta: { fontSize: 16, fontWeight: 600, align: "left" },
  gitlab: { fontSize: 13, fontWeight: 400, align: "right" },
  repo: { fontSize: 13, fontWeight: 400, align: "right" },
  repoLine: { fontSize: 14, fontWeight: 400, align: "left" },
} as const;
export type LinkLabelKind = keyof typeof LINK_LABEL_KINDS;

export const LINK_LABEL_SPANS = { half: CANVAS_WIDTH / 2, full: CANVAS_WIDTH } as const;
export type LinkLabelSpan = keyof typeof LINK_LABEL_SPANS;

const LINE_CTA_TEXT_WIDTH = 76;
export const LINE_WIDTHS = {
  cta: PADDING + LINE_CTA_TEXT_WIDTH,
  repoLine: CANVAS_WIDTH - PADDING - LINE_CTA_TEXT_WIDTH,
} as const;
const LINE_GAP = 5;

export const README_BACKGROUNDS: Record<LinkLabelMode, string> = { dark: "#0d1117", light: "#ffffff" };
const DEFAULT_COLORS: Record<LinkLabelMode, string> = { dark: "#4493f8", light: "#0969da" };

export function linkLabelColor(mode: LinkLabelMode, color?: string): string {
  return ensureContrast(color ?? DEFAULT_COLORS[mode], README_BACKGROUNDS[mode], 4.5);
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
  line = false,
}: {
  kind: LinkLabelKind;
  text: string;
  mode: LinkLabelMode;
  color?: string;
  span?: LinkLabelSpan;
  inset?: boolean;
  line?: boolean;
}) {
  const { fontSize, fontWeight, align } = LINK_LABEL_KINDS[kind];
  const width = line ? LINE_WIDTHS[kind === "cta" ? "cta" : "repoLine"] : LINK_LABEL_SPANS[span];
  const edge = line ? (kind === "cta" ? LINK_LABEL_INSET : LINE_GAP) : inset ? LINK_LABEL_INSET : 0;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={HEIGHT}
      viewBox={`0 0 ${width} ${HEIGHT}`}
      role="img"
      aria-label={text}
    >
      <title>{text}</title>
      <text
        x={align === "left" ? edge : width - edge}
        y={BASELINE}
        textAnchor={align === "left" ? "start" : "end"}
        fontSize={fontSize}
        fontWeight={fontWeight}
        fill={linkLabelColor(mode, color)}
        fontFamily={FONT_STACK}
      >
        {text}
      </text>
    </svg>
  );
}
