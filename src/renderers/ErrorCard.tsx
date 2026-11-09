import type { ThemeTokens } from "@/theme/palettes";
import { CANVAS_WIDTH, FONT_STACK, PADDING } from "./primitives";
import { wrapText } from "./text";

export interface ErrorCardProps {
  theme: ThemeTokens;
  title: string;
  message: string;
  hint?: string;
  width?: number;
  idPrefix?: string;
}

const TITLE = { size: 16, lineHeight: 22 };
const MESSAGE = { size: 13, lineHeight: 18 };
const HINT = { size: 11, lineHeight: 16 };

export function ErrorCard({ theme, title, message, hint, width = CANVAS_WIDTH, idPrefix = "gitvis" }: ErrorCardProps) {
  const font = { fontFamily: FONT_STACK };
  const textX = PADDING + 18;
  const textWidth = width - textX - PADDING;
  const titleLines = wrapText(title, textWidth, TITLE.size, 2);
  const messageLines = wrapText(message, textWidth, MESSAGE.size, 4);
  const hintLines = hint ? wrapText(hint, textWidth, HINT.size, 3) : [];

  const titleY = PADDING + 16;
  const messageY = titleY + (titleLines.length - 1) * TITLE.lineHeight + 24;
  const hintY = messageY + (messageLines.length - 1) * MESSAGE.lineHeight + 22;
  const lastBaseline = hintLines.length ? hintY + (hintLines.length - 1) * HINT.lineHeight : hintY - 22;
  const height = Math.ceil(lastBaseline + PADDING);

  const lines = (items: string[], x: number, firstY: number, lineHeight: number) =>
    items.map((line, i) => (
      <tspan key={i} x={x} y={firstY + i * lineHeight}>
        {line}
      </tspan>
    ));

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-labelledby={`${idPrefix}-title`}
      aria-describedby={`${idPrefix}-desc`}
    >
      <title id={`${idPrefix}-title`}>{`GitVis: ${title}`}</title>
      <desc id={`${idPrefix}-desc`}>{hint ? `${message} ${hint}` : message}</desc>
      <rect
        x={0.5}
        y={0.5}
        width={width - 1}
        height={height - 1}
        rx={14}
        fill={theme.background}
        stroke={theme.border}
      />
      <rect x={PADDING} y={PADDING} width={4} height={height - PADDING * 2} rx={2} fill={theme.accent} />
      <text fontSize={TITLE.size} fontWeight={600} fill={theme.text} {...font}>
        {lines(titleLines, textX, titleY, TITLE.lineHeight)}
      </text>
      <text fontSize={MESSAGE.size} fill={theme.text} {...font}>
        {lines(messageLines, textX, messageY, MESSAGE.lineHeight)}
      </text>
      {hintLines.length > 0 && (
        <text fontSize={HINT.size} fill={theme.textMuted} {...font}>
          {lines(hintLines, textX, hintY, HINT.lineHeight)}
        </text>
      )}
    </svg>
  );
}
