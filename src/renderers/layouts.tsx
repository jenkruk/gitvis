import type { FeatureId } from "@/config/features";
import type { LayoutId } from "@/config/layouts";
import type { ContributionDataset } from "@/domain/types";
import type { ContributionMetrics } from "@/metrics/metrics";
import type { ThemeTokens } from "@/theme/palettes";
import { Heatmap, measureHeatmap } from "./Heatmap";
import { CONTENT_WIDTH, PADDING, Panel, type Section } from "./primitives";
import {
  BREAKDOWN_HEIGHT,
  Footnote,
  FOOTNOTE_HEIGHT,
  InlineStats,
  PlatformBreakdown,
  StatCards,
  statCardsHeight,
  TrendCharts,
  TRENDS_HEIGHT,
} from "./sections";
import { buildStatItem, STAT_FEATURES } from "./stats";

export interface LayoutContext {
  dataset: ContributionDataset;
  metrics: ContributionMetrics;
  theme: ThemeTokens;
  isVisible: (feature: FeatureId) => boolean;
}

const PANEL_PADDING = 16;

function statItems({ metrics, isVisible }: LayoutContext) {
  return STAT_FEATURES.filter(isVisible).map((id) => buildStatItem(id, metrics));
}

function heatmapPanel({ dataset, theme }: LayoutContext): Section {
  const innerWidth = CONTENT_WIDTH - PANEL_PADDING * 2;
  const { height } = measureHeatmap(dataset.days, innerWidth);
  return {
    key: "heatmap",
    height: height + PANEL_PADDING * 2,
    render: (y) => (
      <>
        <Panel x={PADDING} y={y} width={CONTENT_WIDTH} height={height + PANEL_PADDING * 2} theme={theme} />
        <Heatmap
          days={dataset.days}
          theme={theme}
          x={PADDING + PANEL_PADDING}
          y={y + PANEL_PADDING}
          width={innerWidth}
        />
      </>
    ),
  };
}

function statCards(ctx: LayoutContext, detailed: boolean): Section | null {
  const items = statItems(ctx);
  if (items.length === 0) return null;
  return {
    key: "stats",
    height: statCardsHeight(detailed),
    render: (y) => <StatCards items={items} theme={ctx.theme} y={y} width={CONTENT_WIDTH} detailed={detailed} />,
  };
}

function breakdown(ctx: LayoutContext): Section | null {
  if (!ctx.isVisible("platformBreakdown")) return null;
  return {
    key: "breakdown",
    height: BREAKDOWN_HEIGHT,
    render: (y) => <PlatformBreakdown metrics={ctx.metrics} theme={ctx.theme} y={y} width={CONTENT_WIDTH} />,
  };
}

function footnote(ctx: LayoutContext): Section {
  return { key: "footnote", height: FOOTNOTE_HEIGHT, render: (y) => <Footnote theme={ctx.theme} y={y} /> };
}

const compact = (sections: (Section | null | false)[]): Section[] => sections.filter((s): s is Section => !!s);

/** Each layout composes registry-driven sections; feature visibility is decided centrally. */
export const LAYOUT_SECTIONS: Record<LayoutId, (ctx: LayoutContext) => Section[]> = {
  minimal: (ctx) => {
    const items = statItems(ctx);
    const { height } = measureHeatmap(ctx.dataset.days, CONTENT_WIDTH);
    return compact([
      items.length > 0 && {
        key: "inline-stats",
        height: 18,
        render: (y) => <InlineStats items={items} theme={ctx.theme} y={y} />,
      },
      ctx.isVisible("heatmap") && {
        key: "heatmap",
        height,
        render: (y) => <Heatmap days={ctx.dataset.days} theme={ctx.theme} x={PADDING} y={y} width={CONTENT_WIDTH} />,
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
        height: TRENDS_HEIGHT,
        render: (y) => (
          <TrendCharts metrics={ctx.metrics} dataset={ctx.dataset} theme={ctx.theme} y={y} width={CONTENT_WIDTH} />
        ),
      },
      footnote(ctx),
    ]),
};
