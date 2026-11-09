import { formatDate } from "@/domain/dates";
import { type CombinedDay, PLATFORM_IDS, PLATFORMS, type PlatformId } from "@/domain/types";
import { mix } from "@/theme/color";
import type { ThemeTokens } from "@/theme/palettes";
import { buildHeatmapGrid, type HeatLevel, type HeatmapGeometry, heatmapGeometry } from "./heatmap-model";
import { FONT_STACK, formatNumber } from "./primitives";

export interface HeatmapProps {
  days: readonly CombinedDay[];
  theme: ThemeTokens;
  x: number;
  y: number;
  width: number;
  showLegend?: boolean;
  scale?: readonly [number, number, number];
  platforms?: readonly PlatformId[];
  tooltips?: boolean;
}

const LEGEND_TEXT_WIDTH = 34;

const WEEKDAY_LABELS: [row: number, label: string][] = [
  [1, "Mon"],
  [3, "Wed"],
  [5, "Fri"],
];

export function measureHeatmap(days: readonly CombinedDay[], width: number, showLegend = true): HeatmapGeometry {
  return heatmapGeometry(buildHeatmapGrid(days).columns, width, showLegend);
}

function describeDay(day: CombinedDay, platforms?: readonly PlatformId[], namePlatform = false): string {
  const noun = day.total === 1 ? "contribution" : "contributions";
  const parts = Object.entries(day.byPlatform)
    .filter(([, count]) => count > 0)
    .map(([platform, count]) => `${PLATFORMS[platform as PlatformId].label} ${formatNumber(count)}`);
  const breakdown = parts.length > 1 || (namePlatform && parts.length === 1) ? ` (${parts.join(", ")})` : "";
  const missing = (platforms ?? []).filter((p) => day.byPlatform[p] === undefined).map((p) => PLATFORMS[p].label);
  const known = (platforms ?? []).filter((p) => day.byPlatform[p] !== undefined).map((p) => PLATFORMS[p].label);
  const coverage = !missing.length
    ? ""
    : known.length
      ? ` (${known.join(" and ")} only; ${missing.join(" and ")} not available)`
      : " (no data available)";
  return `${formatNumber(day.total)} ${noun} on ${formatDate(day.date, "long")}${breakdown}${coverage}`;
}

function cellColor(day: CombinedDay, level: HeatLevel, theme: ThemeTokens): string {
  const ramps = theme.platformHeatmap;
  if (!ramps || level === 0) return theme.heatmap[level];
  const counts = PLATFORM_IDS.map((p) => day.byPlatform[p] ?? 0);
  const max = Math.max(...counts);
  const leaders = PLATFORM_IDS.flatMap((_, i) => (counts[i] === max ? [i] : []));
  const colors = leaders.map((i) => ramps[i % ramps.length]![level]);
  return colors.length === 1 ? colors[0]! : mix(colors[0]!, colors[1]!, 0.5);
}

function platformsIn(days: readonly CombinedDay[]): PlatformId[] {
  return PLATFORM_IDS.filter((p) => days.some((d) => d.byPlatform[p] !== undefined));
}

export function Heatmap({
  days,
  theme,
  x,
  y,
  width,
  showLegend = true,
  scale,
  platforms,
  tooltips = true,
}: HeatmapProps) {
  const grid = buildHeatmapGrid(days, scale);
  const g = heatmapGeometry(grid.columns, width, showLegend);
  const gridTop = g.monthLabelHeight;
  const text = { fontFamily: FONT_STACK, fontSize: 10, fill: theme.textMuted };

  return (
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
          fill={cellColor(day, level, theme)}
        >
          {tooltips && <title>{describeDay(day, platforms, !!theme.platformHeatmap)}</title>}
        </rect>
      ))}
      {showLegend && theme.platformHeatmap && (
        <PlatformLegend theme={theme} platforms={platformsIn(days)} g={g} text={text} />
      )}
      {showLegend && !theme.platformHeatmap && (
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

const LEGEND_GLYPH = 5.8;

function PlatformLegend({
  theme,
  platforms,
  g,
  text,
}: {
  theme: ThemeTokens;
  platforms: PlatformId[];
  g: HeatmapGeometry;
  text: { fontFamily: string; fontSize: number; fill: string };
}) {
  const ramps = theme.platformHeatmap!;
  const rampOf = (p: PlatformId) => ramps[PLATFORM_IDS.indexOf(p) % ramps.length]!;
  const named = platforms.length > 1;
  const groups = platforms.map((p) => ({
    platform: p,
    label: named ? PLATFORMS[p].label : "",
    colors: named ? rampOf(p).slice(1) : rampOf(p),
  }));
  const textWidth = (s: string) => s.length * LEGEND_GLYPH;
  const groupWidth = (grp: (typeof groups)[number]) =>
    (grp.label ? textWidth(grp.label) + 4 : 0) + grp.colors.length * g.step - g.gap;
  const width =
    textWidth("Less") + 6 + groups.reduce((w, grp, i) => w + groupWidth(grp) + (i ? 10 : 0), 0) + 6 + textWidth("More");
  const starts = groups.reduce<number[]>(
    (acc, grp, i) => [...acc, i === 0 ? textWidth("Less") + 6 : acc[i - 1]! + groupWidth(groups[i - 1]!) + 10],
    [],
  );
  return (
    <g transform={`translate(${g.gridWidth - width} ${g.height - 6})`}>
      <text x={0} y={0} {...text}>
        Less
      </text>
      {groups.map((grp, i) => {
        const cellsX = starts[i]! + (grp.label ? textWidth(grp.label) + 4 : 0);
        return (
          <g key={grp.platform}>
            {grp.label && (
              <text x={starts[i]} y={0} {...text}>
                {grp.label}
              </text>
            )}
            {grp.colors.map((color, c) => (
              <rect
                key={color + c}
                x={cellsX + c * g.step}
                y={-g.cell + 1}
                width={g.cell}
                height={g.cell}
                rx={2}
                fill={color}
              />
            ))}
          </g>
        );
      })}
      <text x={width} y={0} textAnchor="end" {...text}>
        More
      </text>
    </g>
  );
}
