import type { ReactNode } from "react";
import type { ThemeTokens } from "@/theme/palettes";

/** Web fonts don't load inside <img> embeds, so SVGs use the system stack. */
export const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

export const CANVAS_WIDTH = 840;
export const PADDING = 24;
export const CONTENT_WIDTH = CANVAS_WIDTH - PADDING * 2;
export const SECTION_GAP = 16;

const numberFormat = new Intl.NumberFormat("en-US");
export const formatNumber = (n: number) => numberFormat.format(n);
export const formatPercent = (share: number) => `${Math.round(share * 100)}%`;

export function Panel({
  x,
  y,
  width,
  height,
  theme,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  theme: ThemeTokens;
}) {
  return <rect x={x} y={y} width={width} height={height} rx={10} fill={theme.surface} stroke={theme.border} />;
}

export interface Section {
  key: string;
  height: number;
  render: (y: number) => ReactNode;
}

/** Stacks sections vertically with a fixed gap; returns nodes and the bottom edge. */
export function stackSections(
  sections: Section[],
  top: number,
  gap = SECTION_GAP,
): { nodes: ReactNode[]; bottom: number } {
  let y = top;
  const nodes = sections.map((section, i) => {
    if (i > 0) y += gap;
    const node = <g key={section.key}>{section.render(y)}</g>;
    y += section.height;
    return node;
  });
  return { nodes, bottom: y };
}
