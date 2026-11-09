import { ensureContrast } from "@/theme/color";
import { FONT_STACK, PADDING } from "./primitives";

/**
 * README link text drawn as a tiny SVG ("Get Yours", "GitLab @user"). GitHub
 * strips colors, sizes and layout from README HTML but keeps images (and lets
 * them float right), so this is how the links sit on one line under the card,
 * in the card's GitLab color, lined up with the card's content. Images can't
 * react to hover, so there's no hover color.
 */

export const LINK_LABEL_MODES = ["dark", "light"] as const;
export type LinkLabelMode = (typeof LINK_LABEL_MODES)[number];

export const LINK_LABEL_KINDS = {
  /** "Get Yours": the call to action, at GitHub's body size, on the left. */
  cta: { fontSize: 16, fontWeight: 600, align: "left" },
  /** The user's GitLab profile: smaller, on the right. */
  gitlab: { fontSize: 13, fontWeight: 400, align: "right" },
} as const;
export type LinkLabelKind = keyof typeof LINK_LABEL_KINDS;

/** GitHub's page backgrounds, which the labels sit on. */
export const README_BACKGROUNDS: Record<LinkLabelMode, string> = { dark: "#0d1117", light: "#ffffff" };
/** GitHub's own link blues, used when no color is given. */
const DEFAULT_COLORS: Record<LinkLabelMode, string> = { dark: "#4493f8", light: "#0969da" };

/** The label's text color: the requested color, adjusted until it's readable (4.5:1) on GitHub's page. */
export function linkLabelColor(mode: LinkLabelMode, color?: string): string {
  return ensureContrast(color ?? DEFAULT_COLORS[mode], README_BACKGROUNDS[mode], 4.5);
}
/** Shared by every label, so text in the inline and floated images shares a baseline. */
const HEIGHT = 22;
const BASELINE = 16;
/** Generous average glyph width: spare space falls on the side away from the card's edge. */
const GLYPH_EM = 0.62;
/**
 * Transparent cards: the card's own padding is invisible, so its content starts
 * PADDING in from the image edge; the labels keep the same inset to line up with it.
 */
export const LINK_LABEL_INSET = PADDING;

export function linkLabelWidth(kind: LinkLabelKind, text: string, inset: boolean): number {
  return Math.ceil([...text].length * LINK_LABEL_KINDS[kind].fontSize * GLYPH_EM) + 2 + (inset ? LINK_LABEL_INSET : 0);
}

export function LinkLabel({
  kind,
  text,
  mode,
  color,
  inset = false,
}: {
  kind: LinkLabelKind;
  text: string;
  mode: LinkLabelMode;
  /** #rrggbb; readability-adjusted for GitHub's page in this mode. */
  color?: string;
  inset?: boolean;
}) {
  const { fontSize, fontWeight, align } = LINK_LABEL_KINDS[kind];
  const width = linkLabelWidth(kind, text, inset);
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
