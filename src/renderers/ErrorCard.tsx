import type { ThemeTokens } from "@/theme/palettes";
import { CANVAS_WIDTH, FONT_STACK, PADDING } from "./primitives";

export interface ErrorCardProps {
  theme: ThemeTokens;
  /** User-safe, fixed strings only — never raw upstream bodies or stack traces. */
  title: string;
  message: string;
  hint?: string;
  idPrefix?: string;
}

const HEIGHT = 120;

/** A published image that explains what went wrong instead of showing a broken-image icon. */
export function ErrorCard({ theme, title, message, hint, idPrefix = "gitvis" }: ErrorCardProps) {
  const font = { fontFamily: FONT_STACK };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={CANVAS_WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${CANVAS_WIDTH} ${HEIGHT}`}
      role="img"
      aria-labelledby={`${idPrefix}-title`}
      aria-describedby={`${idPrefix}-desc`}
    >
      <title id={`${idPrefix}-title`}>{`GitVis: ${title}`}</title>
      <desc id={`${idPrefix}-desc`}>{hint ? `${message} ${hint}` : message}</desc>
      <rect
        x={0.5}
        y={0.5}
        width={CANVAS_WIDTH - 1}
        height={HEIGHT - 1}
        rx={14}
        fill={theme.background}
        stroke={theme.border}
      />
      <rect x={PADDING} y={PADDING} width={4} height={HEIGHT - PADDING * 2} rx={2} fill={theme.accent} />
      <text x={PADDING + 18} y={PADDING + 16} fontSize={16} fontWeight={600} fill={theme.text} {...font}>
        {title}
      </text>
      <text x={PADDING + 18} y={PADDING + 40} fontSize={13} fill={theme.text} {...font}>
        {message}
      </text>
      {hint && (
        <text x={PADDING + 18} y={PADDING + 62} fontSize={11} fill={theme.textMuted} {...font}>
          {hint}
        </text>
      )}
    </svg>
  );
}
