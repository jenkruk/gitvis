import { ensureContrast } from "@/theme/color";
import { CANVAS_WIDTH, FONT_STACK, PADDING } from "./primitives";

/**
 * README link text drawn as a tiny SVG ("Get Yours", "GitLab @user"). GitHub
 * strips colors, sizes, widths and layout from README HTML but keeps images, so
 * the links are images sized as halves of the card: side by side and centered,
 * they're exactly as wide as the card, with "Get Yours" at its left content edge
 * and the GitLab link at its right, in the card's GitLab color. Images can't
 * react to hover, so there's no hover color.
 */

export const LINK_LABEL_MODES = ["dark", "light"] as const;
export type LinkLabelMode = (typeof LINK_LABEL_MODES)[number];

export const LINK_LABEL_KINDS = {
  /** "Get Yours": the call to action, at GitHub's body size, at the card's left edge. */
  cta: { fontSize: 16, fontWeight: 600, align: "left" },
  /** The user's GitLab profile: smaller, at the card's right edge. */
  gitlab: { fontSize: 13, fontWeight: 400, align: "right" },
} as const;
export type LinkLabelKind = keyof typeof LINK_LABEL_KINDS;

/** How much of the card's width a label spans: half (beside the other link) or all of it (alone). */
export const LINK_LABEL_SPANS = { half: CANVAS_WIDTH / 2, full: CANVAS_WIDTH } as const;
export type LinkLabelSpan = keyof typeof LINK_LABEL_SPANS;

/** GitHub's page backgrounds, which the labels sit on. */
export const README_BACKGROUNDS: Record<LinkLabelMode, string> = { dark: "#0d1117", light: "#ffffff" };
/** GitHub's own link blues, used when no color is given. */
const DEFAULT_COLORS: Record<LinkLabelMode, string> = { dark: "#4493f8", light: "#0969da" };

/** The label's text color: the requested color, adjusted until it's readable (4.5:1) on GitHub's page. */
export function linkLabelColor(mode: LinkLabelMode, color?: string): string {
  return ensureContrast(color ?? DEFAULT_COLORS[mode], README_BACKGROUNDS[mode], 4.5);
}

/** Shared by every label, so text in side-by-side images shares a baseline. */
const HEIGHT = 22;
const BASELINE = 16;
/**
 * Transparent cards: the card's own padding is invisible, so its content starts
 * PADDING in from the image edge; the labels keep the same inset to line up with it.
 */
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
  /** #rrggbb; readability-adjusted for GitHub's page in this mode. */
  color?: string;
  span?: LinkLabelSpan;
  inset?: boolean;
}) {
  const { fontSize, fontWeight, align } = LINK_LABEL_KINDS[kind];
  const width = LINK_LABEL_SPANS[span];
  const edge = inset ? LINK_LABEL_INSET : 0;
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
