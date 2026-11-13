import type { Density } from "@/config/config";
import type { FeatureId, StatFeatureId } from "@/config/features";
import type { LayoutId } from "@/config/layouts";
import { addDays, startOfWeek } from "@/domain/dates";
import type { PeriodSummary } from "@/domain/history";
import type { CombinedDay, ContributionDataset } from "@/domain/types";
import type { ContributionMetrics } from "@/metrics/metrics";
import type { ThemeTokens } from "@/theme/palettes";
import { Heatmap, measureHeatmap } from "./Heatmap";
import {
  type CardContent,
  historyScale,
  measureYearlySummary,
  YearCard,
  yearCardHeight,
  YearlySummary,
} from "./HistoryCalendars";
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
import { buildStatItem, orderedStats } from "./stats";
import { wrapText } from "./text";

export interface Spacing {
  sectionGap: number;
  panelPadding: number;
  statCard: number;
  statCardDetailed: number;
  breakdown: number;
  trends: number;
}
export const SPACING: Record<Density, Spacing> = {
  spacious: { sectionGap: 16, panelPadding: 16, statCard: 70, statCardDetailed: 84, breakdown: 74, trends: 170 },
  compact: { sectionGap: 10, panelPadding: 10, statCard: 58, statCardDetailed: 70, breakdown: 60, trends: 140 },
};

export interface LayoutContext {
  dataset: ContributionDataset;
  calendar?: ContributionDataset;
  periods?: PeriodSummary[];
  statsLabel?: string;
  statsPeriod?: string;
  historyNote?: string;
  metrics: ContributionMetrics;
  theme: ThemeTokens;
  isVisible: (feature: FeatureId) => boolean;
  size: CardSize;
  spacing: Spacing;
  metricOrder: readonly StatFeatureId[];
  tooltips: boolean;
}

const CAPTION_HEIGHT = 18;

const isCompact = (ctx: LayoutContext) => ctx.size === "compact";
const width = (ctx: LayoutContext) => contentWidthFor(ctx.size);

function statItems({ metrics, isVisible, metricOrder }: LayoutContext) {
  return orderedStats(metricOrder, isVisible).map((id) => buildStatItem(id, metrics));
}

const cardStatItems = (ctx: LayoutContext) => statItems(ctx).filter((item) => item.id !== "totalContributions");

const calendarOf = (ctx: LayoutContext) => ctx.calendar ?? ctx.dataset;
const isHistory = (ctx: LayoutContext) => (ctx.periods?.length ?? 0) > 1;

function heatmapDays(ctx: LayoutContext): CombinedDay[] {
  const { days } = calendarOf(ctx);
  if (!isCompact(ctx) || days.length === 0) return days;
  const first = addDays(startOfWeek(days.at(-1)!.date), -7 * (COMPACT_HEATMAP_WEEKS - 1));
  return days.filter((d) => d.date >= first);
}

function showCaption(ctx: LayoutContext, days: CombinedDay[]): boolean {
  return isCompact(ctx) && days.length < calendarOf(ctx).days.length;
}

function Caption({ ctx, x, y }: { ctx: LayoutContext; x: number; y: number }) {
  return (
    <text x={x} y={y + 10} fontSize={11} fontWeight={500} fill={ctx.theme.textMuted} fontFamily={FONT_STACK}>
      Last {COMPACT_HEATMAP_WEEKS} weeks
    </text>
  );
}

const NOTE = { fontSize: 11, lineHeight: 15 };
function note(ctx: LayoutContext, key: string, text: string | undefined): Section | null {
  if (!text) return null;
  const lines = wrapText(text, width(ctx), NOTE.fontSize);
  return {
    key,
    height: lines.length * NOTE.lineHeight,
    render: (y) => (
      <text fontSize={NOTE.fontSize} fill={ctx.theme.textMuted} fontFamily={FONT_STACK}>
        {lines.map((line, i) => (
          <tspan key={i} x={PADDING} y={y + 11 + i * NOTE.lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    ),
  };
}

function statsHeading(ctx: LayoutContext): Section | null {
  if (!ctx.statsLabel) return null;
  return {
    key: "stats-heading",
    height: 16,
    render: (y) => (
      <text x={PADDING} y={y + 12} fontSize={12} fontWeight={600} fill={ctx.theme.text} fontFamily={FONT_STACK}>
        {ctx.statsLabel}
      </text>
    ),
  };
}

function yearCards(ctx: LayoutContext, newestContent?: CardContent): Section[] {
  const periods = ctx.periods ?? [];
  const calendar = calendarOf(ctx);
  const scale = historyScale(calendar);
  const padding = ctx.spacing.panelPadding;
  return periods.map((period, i) => {
    const last = i === periods.length - 1;
    const content = i === 0 ? newestContent : undefined;
    return {
      key: `year-${period.range.end}`,
      height: yearCardHeight(calendar, period, width(ctx), padding, last, content),
      render: (y) => (
        <YearCard
          view={calendar}
          period={period}
          theme={ctx.theme}
          x={PADDING}
          y={y}
          width={width(ctx)}
          padding={padding}
          showLegend={last}
          scale={scale}
          content={content}
          current={i === 0}
          tooltips={ctx.tooltips}
        />
      ),
    };
  });
}

const statsInNewestCard = (ctx: LayoutContext) => isHistory(ctx) && !isCompact(ctx) && ctx.isVisible("heatmap");

function statCardsBlock(ctx: LayoutContext, detailed: boolean, inCard = false): CardContent | null {
  const items = inCard ? cardStatItems(ctx) : statItems(ctx);
  if (items.length === 0) return null;
  const columns = isCompact(ctx) ? 2 : items.length > 4 ? 3 : Infinity;
  const cardHeight = detailed ? ctx.spacing.statCardDetailed : ctx.spacing.statCard;
  return {
    height: statCardsHeight(detailed, items.length, columns, cardHeight),
    render: (x, y, w) => (
      <StatCards
        items={items}
        theme={ctx.theme}
        x={x}
        y={y}
        width={w}
        detailed={detailed}
        columns={columns}
        cardHeight={cardHeight}
        inset={ctx.spacing.panelPadding}
      />
    ),
  };
}

const cardInnerWidth = (ctx: LayoutContext) => width(ctx) - ctx.spacing.panelPadding * 2;

function heatmapSections(ctx: LayoutContext, detailed: boolean): (Section | null)[] {
  if (!ctx.isVisible("heatmap")) return [];
  if (isHistory(ctx) && !isCompact(ctx)) {
    return yearCards(ctx, statCardsBlock(ctx, detailed, true) ?? undefined);
  }
  return [yearlySummary(ctx, true), heatmapPanel(ctx)];
}

function yearlySummary(ctx: LayoutContext, framed: boolean): Section | null {
  if (!isHistory(ctx) || !isCompact(ctx)) return null;
  const pad = framed ? ctx.spacing.panelPadding : 0;
  const height = measureYearlySummary(ctx.periods!) + pad * 2;
  return {
    key: "yearly-summary",
    height,
    render: (y) => (
      <>
        {framed && <Panel x={PADDING} y={y} width={width(ctx)} height={height} theme={ctx.theme} />}
        <YearlySummary
          periods={ctx.periods!}
          theme={ctx.theme}
          x={PADDING + pad}
          y={y + pad}
          width={width(ctx) - pad * 2}
        />
      </>
    ),
  };
}

function heatmapPanel(ctx: LayoutContext): Section {
  const { theme } = ctx;
  const PANEL_PADDING = ctx.spacing.panelPadding;
  const days = heatmapDays(ctx);
  const innerWidth = width(ctx) - PANEL_PADDING * 2;
  const caption = showCaption(ctx, days) ? CAPTION_HEIGHT : 0;
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
          tooltips={ctx.tooltips}
        />
      </>
    ),
  };
}

function statCards(ctx: LayoutContext, detailed: boolean): Section | null {
  if (statsInNewestCard(ctx)) return null;
  const block = statCardsBlock(ctx, detailed);
  return block && { key: "stats", height: block.height, render: (y) => block.render(PADDING, y, width(ctx)) };
}

function breakdown(ctx: LayoutContext): Section | null {
  if (!ctx.isVisible("platformBreakdown")) return null;
  return {
    key: "breakdown",
    height: ctx.spacing.breakdown,
    render: (y) => (
      <PlatformBreakdown
        metrics={ctx.metrics}
        theme={ctx.theme}
        y={y}
        width={width(ctx)}
        height={ctx.spacing.breakdown}
        period={ctx.statsPeriod}
        inset={ctx.spacing.panelPadding}
      />
    ),
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

export const LAYOUT_SECTIONS: Record<LayoutId, (ctx: LayoutContext) => Section[]> = {
  minimal: (ctx) => {
    const items = statItems(ctx);
    const days = heatmapDays(ctx);
    const caption = showCaption(ctx, days) ? CAPTION_HEIGHT : 0;
    const { height } = measureHeatmap(days, width(ctx));
    const history = isHistory(ctx) && !isCompact(ctx);
    const inCard = statsInNewestCard(ctx);
    const inner = cardInnerWidth(ctx);
    const cardItems = cardStatItems(ctx);
    const inlineInCard: CardContent | undefined =
      inCard && cardItems.length > 0
        ? {
            height: inlineStatsHeight(cardItems, inner),
            render: (x, y, w) => <InlineStats items={cardItems} theme={ctx.theme} x={x} y={y} width={w} />,
          }
        : undefined;
    return compact([
      !inCard && items.length > 0 && statsHeading(ctx),
      !inCard &&
        items.length > 0 && {
          key: "inline-stats",
          height: inlineStatsHeight(items, width(ctx)),
          render: (y) => <InlineStats items={items} theme={ctx.theme} y={y} width={width(ctx)} />,
        },
      ctx.isVisible("heatmap") && yearlySummary(ctx, false),
      ...(ctx.isVisible("heatmap") && history ? yearCards(ctx, inlineInCard) : []),
      ctx.isVisible("heatmap") &&
        !history && {
          key: "heatmap",
          height: height + caption,
          render: (y) => (
            <>
              {caption > 0 && <Caption ctx={ctx} x={PADDING} y={y} />}
              <Heatmap
                days={days}
                theme={ctx.theme}
                x={PADDING}
                y={y + caption}
                width={width(ctx)}
                tooltips={ctx.tooltips}
              />
            </>
          ),
        },
      ctx.isVisible("heatmap") && note(ctx, "history-note", ctx.historyNote),
    ]);
  },

  dashboard: (ctx) =>
    compact([
      !statsInNewestCard(ctx) && statsHeading(ctx),
      statCards(ctx, false),
      ...heatmapSections(ctx, false),
      ctx.isVisible("heatmap") && note(ctx, "history-note", ctx.historyNote),
      breakdown(ctx),
      footnote(ctx),
    ]),

  dataRich: (ctx) =>
    compact([
      !statsInNewestCard(ctx) && statsHeading(ctx),
      statCards(ctx, true),
      ...heatmapSections(ctx, true),
      ctx.isVisible("heatmap") && note(ctx, "history-note", ctx.historyNote),
      breakdown(ctx),
      ctx.isVisible("activityTrends") && {
        key: "trends",
        height: trendsHeight(isCompact(ctx), ctx.spacing.trends),
        render: (y) => (
          <TrendCharts
            metrics={ctx.metrics}
            dataset={ctx.dataset}
            theme={ctx.theme}
            y={y}
            width={width(ctx)}
            stacked={isCompact(ctx)}
            panelHeight={ctx.spacing.trends}
            period={ctx.statsPeriod}
            inset={ctx.spacing.panelPadding}
          />
        ),
      },
      footnote(ctx),
    ]),
};
