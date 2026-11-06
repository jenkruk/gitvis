import { formatDate } from "@/domain/dates";
import { type CombinedDay, PLATFORMS, type PlatformId } from "@/domain/types";
import type { ThemeTokens } from "@/theme/palettes";
import { buildHeatmapGrid, type HeatmapGeometry, heatmapGeometry } from "./heatmap-model";
import { FONT_STACK, formatNumber } from "./primitives";

export interface HeatmapProps {
  days: readonly CombinedDay[];
  theme: ThemeTokens;
  x: number;
  y: number;
  width: number;
  showLegend?: boolean;
  /** Shared level thresholds when several calendars are shown together. */
  scale?: readonly [number, number, number];
  /** Connected platforms; when given, tooltips name platforms whose data isn't available that day. */
  platforms?: readonly PlatformId[];
}

/** Space reserved for the "More" label at the right end of the legend. */
const LEGEND_TEXT_WIDTH = 34;

const WEEKDAY_LABELS: [row: number, label: string][] = [
  [1, "Mon"],
  [3, "Wed"],
  [5, "Fri"],
];

export function measureHeatmap(days: readonly CombinedDay[], width: number, showLegend = true): HeatmapGeometry {
  return heatmapGeometry(buildHeatmapGrid(days).columns, width, showLegend);
}

function describeDay(day: CombinedDay, platforms?: readonly PlatformId[]): string {
  const noun = day.total === 1 ? "contribution" : "contributions";
  const parts = Object.entries(day.byPlatform)
    .filter(([, count]) => count > 0)
    .map(([platform, count]) => `${PLATFORMS[platform as PlatformId].label} ${formatNumber(count)}`);
  const breakdown = parts.length > 1 ? ` (${parts.join(", ")})` : "";
  // Outside a platform's coverage its count is unknown — say so rather than implying zero.
  const missing = (platforms ?? []).filter((p) => day.byPlatform[p] === undefined).map((p) => PLATFORMS[p].label);
  const known = (platforms ?? []).filter((p) => day.byPlatform[p] !== undefined).map((p) => PLATFORMS[p].label);
  const coverage = !missing.length
    ? ""
    : known.length
      ? ` (${known.join(" and ")} only; ${missing.join(" and ")} not available)`
      : " (no data available)";
  return `${formatNumber(day.total)} ${noun} on ${formatDate(day.date, "long")}${breakdown}${coverage}`;
}

/** Combined contribution calendar: weeks as columns, Sunday-first rows. */
export function Heatmap({ days, theme, x, y, width, showLegend = true, scale, platforms }: HeatmapProps) {
  const grid = buildHeatmapGrid(days, scale);
  const g = heatmapGeometry(grid.columns, width, showLegend);
  const gridTop = g.monthLabelHeight;
  const text = { fontFamily: FONT_STACK, fontSize: 10, fill: theme.textMuted };

  return (
    // Center the grid when cell-size rounding leaves spare width.
    <g transform={`translate(${x + Math.floor((width - g.gridWidth) / 2)} ${y})`}>
      {grid.monthLabels.map(({ label, column }) => (
        <text key={`${label}-${column}`} x={g.labelWidth + column * g.step} y={10} {...text}>
          {label}
        </text>
      ))}
      {WEEKDAY_LABELS.map(([row, label]) => (
        <text key={label} x={0} y={gridTop + row * g.step + g.cell - 1} {...text}>
          {label}
        </text>
      ))}
      {grid.cells.map(({ day, column, row, level }) => (
        <rect
          key={day.date}
          x={g.labelWidth + column * g.step}
          y={gridTop + row * g.step}
          width={g.cell}
          height={g.cell}
          rx={2}
          fill={theme.heatmap[level]}
        >
          <title>{describeDay(day, platforms)}</title>
        </rect>
      ))}
      {showLegend && (
        // Right-aligned to the grid: "Less ■■■■■ More"
        <g transform={`translate(${g.gridWidth} ${g.height - 6})`}>
          <text x={0} y={0} textAnchor="end" {...text}>
            More
          </text>
          {theme.heatmap.map((color, i) => (
            <rect
              key={color + i}
              x={-LEGEND_TEXT_WIDTH - (5 - i) * g.step + g.gap}
              y={-g.cell + 1}
              width={g.cell}
              height={g.cell}
              rx={2}
              fill={color}
            />
          ))}
          <text x={-LEGEND_TEXT_WIDTH - 5 * g.step + g.gap - 6} y={0} textAnchor="end" {...text}>
            Less
          </text>
        </g>
      )}
    </g>
  );
}
