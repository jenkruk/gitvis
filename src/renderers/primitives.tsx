import type { ReactNode } from "react";
import type { ThemeTokens } from "@/theme/palettes";

export const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

export const CANVAS_WIDTH = 840;
export const PADDING = 24;
export const CONTENT_WIDTH = CANVAS_WIDTH - PADDING * 2;

export type CardSize = "full" | "compact";
export const CANVAS_WIDTHS: Record<CardSize, number> = { full: CANVAS_WIDTH, compact: 400 };
export const contentWidthFor = (size: CardSize) => CANVAS_WIDTHS[size] - PADDING * 2;

export const COMPACT_HEATMAP_WEEKS = 20;
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
  const fill = theme.panelFill ?? theme.surface;
  const stroke = theme.panelStroke ?? theme.border;
  if (fill === "none" && stroke === "none") return null;
  return <rect x={x} y={y} width={width} height={height} rx={10} fill={fill} stroke={stroke} />;
}

export interface Section {
  key: string;
  height: number;
  render: (y: number) => ReactNode;
}

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
