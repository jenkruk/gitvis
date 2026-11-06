import type { FeatureId } from "@/config/features";
import type { LayoutId } from "@/config/layouts";
import { addDays, startOfWeek } from "@/domain/dates";
import type { CombinedDay, ContributionDataset } from "@/domain/types";
import type { ContributionMetrics } from "@/metrics/metrics";
import type { ThemeTokens } from "@/theme/palettes";
import { Heatmap, measureHeatmap } from "./Heatmap";
import {
  type CardSize,
  COMPACT_HEATMAP_WEEKS,
  contentWidthFor,
  FONT_STACK,
  PADDING,
  Panel,
  type Section,
} from "./primitives";
import {
  BREAKDOWN_HEIGHT,
  Footnote,
  footnoteHeight,
  InlineStats,
  inlineStatsHeight,
  PlatformBreakdown,
  StatCards,
  statCardsHeight,
  TrendCharts,
  trendsHeight,
} from "./sections";
import { buildStatItem, STAT_FEATURES } from "./stats";

export interface LayoutContext {
  dataset: ContributionDataset;
  metrics: ContributionMetrics;
  theme: ThemeTokens;
  isVisible: (feature: FeatureId) => boolean;
  size: CardSize;
}

const PANEL_PADDING = 16;
const CAPTION_HEIGHT = 18;

const isCompact = (ctx: LayoutContext) => ctx.size === "compact";
const width = (ctx: LayoutContext) => contentWidthFor(ctx.size);

function statItems({ metrics, isVisible }: LayoutContext) {
  return STAT_FEATURES.filter(isVisible).map((id) => buildStatItem(id, metrics));
}

/** Compact images show the most recent weeks so cells stay large enough to read. */
function heatmapDays(ctx: LayoutContext): CombinedDay[] {
  const { days } = ctx.dataset;
  if (!isCompact(ctx) || days.length === 0) return days;
  const first = addDays(startOfWeek(days.at(-1)!.date), -7 * (COMPACT_HEATMAP_WEEKS - 1));
  return days.filter((d) => d.date >= first);
}

function Caption({ ctx, x, y }: { ctx: LayoutContext; x: number; y: number }) {
  return (
    <text x={x} y={y + 10} fontSize={11} fontWeight={500} fill={ctx.theme.textMuted} fontFamily={FONT_STACK}>
      Last {COMPACT_HEATMAP_WEEKS} weeks
    </text>
  );
}

function heatmapPanel(ctx: LayoutContext): Section {
  const { theme } = ctx;
  const days = heatmapDays(ctx);
  const innerWidth = width(ctx) - PANEL_PADDING * 2;
  const caption = isCompact(ctx) ? CAPTION_HEIGHT : 0;
  const { height } = measureHeatmap(days, innerWidth);
  const panelHeight = height + caption + PANEL_PADDING * 2;
  return {
    key: "heatmap",
    height: panelHeight,
    render: (y) => (
      <>
        <Panel x={PADDING} y={y} width={width(ctx)} height={panelHeight} theme={theme} />
        {caption > 0 && <Caption ctx={ctx} x={PADDING + PANEL_PADDING} y={y + PANEL_PADDING} />}
        <Heatmap
          days={days}
          theme={theme}
          x={PADDING + PANEL_PADDING}
          y={y + PANEL_PADDING + caption}
          width={innerWidth}
        />
      </>
    ),
  };
}

function statCards(ctx: LayoutContext, detailed: boolean): Section | null {
  const items = statItems(ctx);
  if (items.length === 0) return null;
  const columns = isCompact(ctx) ? 2 : Infinity;
  return {
    key: "stats",
    height: statCardsHeight(detailed, items.length, columns),
    render: (y) => (
      <StatCards items={items} theme={ctx.theme} y={y} width={width(ctx)} detailed={detailed} columns={columns} />
    ),
  };
}

function breakdown(ctx: LayoutContext): Section | null {
  if (!ctx.isVisible("platformBreakdown")) return null;
  return {
    key: "breakdown",
    height: BREAKDOWN_HEIGHT,
    render: (y) => <PlatformBreakdown metrics={ctx.metrics} theme={ctx.theme} y={y} width={width(ctx)} />,
  };
}

function footnote(ctx: LayoutContext): Section {
  return {
    key: "footnote",
    height: footnoteHeight(width(ctx)),
    render: (y) => <Footnote theme={ctx.theme} y={y} width={width(ctx)} />,
  };
}

const compact = (sections: (Section | null | false)[]): Section[] => sections.filter((s): s is Section => !!s);

/** Each layout composes registry-driven sections; feature visibility is decided centrally. */
export const LAYOUT_SECTIONS: Record<LayoutId, (ctx: LayoutContext) => Section[]> = {
  minimal: (ctx) => {
    const items = statItems(ctx);
    const days = heatmapDays(ctx);
    const caption = isCompact(ctx) ? CAPTION_HEIGHT : 0;
    const { height } = measureHeatmap(days, width(ctx));
    return compact([
      items.length > 0 && {
        key: "inline-stats",
        height: inlineStatsHeight(items, width(ctx)),
        render: (y) => <InlineStats items={items} theme={ctx.theme} y={y} width={width(ctx)} />,
      },
      ctx.isVisible("heatmap") && {
        key: "heatmap",
        height: height + caption,
        render: (y) => (
          <>
            {caption > 0 && <Caption ctx={ctx} x={PADDING} y={y} />}
            <Heatmap days={days} theme={ctx.theme} x={PADDING} y={y + caption} width={width(ctx)} />
          </>
        ),
      },
    ]);
  },

  dashboard: (ctx) =>
    compact([statCards(ctx, false), ctx.isVisible("heatmap") && heatmapPanel(ctx), breakdown(ctx), footnote(ctx)]),

  dataRich: (ctx) =>
    compact([
      statCards(ctx, true),
      ctx.isVisible("heatmap") && heatmapPanel(ctx),
      breakdown(ctx),
      ctx.isVisible("activityTrends") && {
        key: "trends",
        height: trendsHeight(isCompact(ctx)),
        render: (y) => (
          <TrendCharts
            metrics={ctx.metrics}
            dataset={ctx.dataset}
            theme={ctx.theme}
            y={y}
            width={width(ctx)}
            stacked={isCompact(ctx)}
          />
        ),
      },
      footnote(ctx),
    ]),
};
