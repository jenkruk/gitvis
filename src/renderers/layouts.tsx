import type { Density } from "@/config/config";
import type { FeatureId, StatFeatureId } from "@/config/features";
import type { LayoutId } from "@/config/layouts";
import { addDays, startOfWeek } from "@/domain/dates";
import type { PeriodSummary } from "@/domain/history";
import type { CombinedDay, ContributionDataset } from "@/domain/types";
import type { ContributionMetrics } from "@/metrics/metrics";
import type { ThemeTokens } from "@/theme/palettes";
import { Heatmap, measureHeatmap } from "./Heatmap";
import { HistoryCalendars, measureHistoryCalendars, measureYearlySummary, YearlySummary } from "./HistoryCalendars";
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

/** Vertical rhythm per density. "spacious" is the original (pre-Phase-4) spacing — keep it byte-identical. */
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
  /** Metrics scope: the span every connected platform covers. */
  dataset: ContributionDataset;
  /** What the calendars show (may be longer than `dataset` with multi-year history). Defaults to `dataset`. */
  calendar?: ContributionDataset;
  /** 12-month periods to draw as separate calendars (multi-year only). */
  periods?: PeriodSummary[];
  /** Explains that stats cover less than the calendars. */
  scopeNote?: string;
  /** Explains that fewer years are shown than requested. */
  historyNote?: string;
  metrics: ContributionMetrics;
  theme: ThemeTokens;
  isVisible: (feature: FeatureId) => boolean;
  size: CardSize;
  spacing: Spacing;
  metricOrder: readonly StatFeatureId[];
}

const CAPTION_HEIGHT = 18;

const isCompact = (ctx: LayoutContext) => ctx.size === "compact";
const width = (ctx: LayoutContext) => contentWidthFor(ctx.size);

function statItems({ metrics, isVisible, metricOrder }: LayoutContext) {
  return orderedStats(metricOrder, isVisible).map((id) => buildStatItem(id, metrics));
}

const calendarOf = (ctx: LayoutContext) => ctx.calendar ?? ctx.dataset;
const isHistory = (ctx: LayoutContext) => (ctx.periods?.length ?? 0) > 1;

/** Compact images show the most recent weeks so cells stay large enough to read. */
function heatmapDays(ctx: LayoutContext): CombinedDay[] {
  const { days } = calendarOf(ctx);
  if (!isCompact(ctx) || days.length === 0) return days;
  const first = addDays(startOfWeek(days.at(-1)!.date), -7 * (COMPACT_HEATMAP_WEEKS - 1));
  return days.filter((d) => d.date >= first);
}

/** The "Last N weeks" caption appears only when the compact image actually trims the range. */
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

/** A wrapped muted note (scope / history explanations). Only added when there's something to explain. */
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

/** Full-width images: one calendar per 12-month period, newest first, with yearly summaries. */
function historyBody(ctx: LayoutContext, x: number, innerWidth: number) {
  const periods = ctx.periods ?? [];
  const calendar = calendarOf(ctx);
  return {
    height: measureHistoryCalendars(periods, calendar, innerWidth),
    render: (y: number) => (
      <HistoryCalendars periods={periods} view={calendar} theme={ctx.theme} x={x} y={y} width={innerWidth} />
    ),
  };
}

/** Phones: yearly summaries (text) above the readable recent-weeks heatmap. */
function yearlySummary(ctx: LayoutContext, framed: boolean): Section | null {
  if (!isHistory(ctx) || !isCompact(ctx)) return null;
  const pad = framed ? ctx.spacing.panelPadding : 0;
  const inner = width(ctx) - pad * 2;
  const height = measureYearlySummary(ctx.periods!, inner) + pad * 2;
  return {
    key: "yearly-summary",
    height,
    render: (y) => (
      <>
        {framed && <Panel x={PADDING} y={y} width={width(ctx)} height={height} theme={ctx.theme} />}
        <YearlySummary periods={ctx.periods!} theme={ctx.theme} x={PADDING + pad} y={y + pad} width={inner} />
      </>
    ),
  };
}

function heatmapPanel(ctx: LayoutContext): Section {
  const { theme } = ctx;
  const PANEL_PADDING = ctx.spacing.panelPadding;
  if (isHistory(ctx) && !isCompact(ctx)) {
    const body = historyBody(ctx, PADDING + PANEL_PADDING, width(ctx) - PANEL_PADDING * 2);
    const panelHeight = body.height + PANEL_PADDING * 2;
    return {
      key: "heatmap",
      height: panelHeight,
      render: (y) => (
        <>
          <Panel x={PADDING} y={y} width={width(ctx)} height={panelHeight} theme={theme} />
          {body.render(y + PANEL_PADDING)}
        </>
      ),
    };
  }
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
        />
      </>
    ),
  };
}

function statCards(ctx: LayoutContext, detailed: boolean): Section | null {
  const items = statItems(ctx);
  if (items.length === 0) return null;
  // Up to 4 cards share one row (the original layout); 5 wrap into rows of 3 so labels stay readable.
  const columns = isCompact(ctx) ? 2 : items.length > 4 ? 3 : Infinity;
  const cardHeight = detailed ? ctx.spacing.statCardDetailed : ctx.spacing.statCard;
  return {
    key: "stats",
    height: statCardsHeight(detailed, items.length, columns, cardHeight),
    render: (y) => (
      <StatCards
        items={items}
        theme={ctx.theme}
        y={y}
        width={width(ctx)}
        detailed={detailed}
        columns={columns}
        cardHeight={cardHeight}
      />
    ),
  };
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

/** Each layout composes registry-driven sections; feature visibility is decided centrally. */
export const LAYOUT_SECTIONS: Record<LayoutId, (ctx: LayoutContext) => Section[]> = {
  minimal: (ctx) => {
    const items = statItems(ctx);
    const days = heatmapDays(ctx);
    const caption = showCaption(ctx, days) ? CAPTION_HEIGHT : 0;
    const { height } = measureHeatmap(days, width(ctx));
    const history = isHistory(ctx) && !isCompact(ctx) ? historyBody(ctx, PADDING, width(ctx)) : null;
    return compact([
      items.length > 0 && {
        key: "inline-stats",
        height: inlineStatsHeight(items, width(ctx)),
        render: (y) => <InlineStats items={items} theme={ctx.theme} y={y} width={width(ctx)} />,
      },
      items.length > 0 && note(ctx, "scope-note", ctx.scopeNote),
      ctx.isVisible("heatmap") && yearlySummary(ctx, false),
      ctx.isVisible("heatmap") &&
        (history
          ? { key: "heatmap", height: history.height, render: history.render }
          : {
              key: "heatmap",
              height: height + caption,
              render: (y) => (
                <>
                  {caption > 0 && <Caption ctx={ctx} x={PADDING} y={y} />}
                  <Heatmap days={days} theme={ctx.theme} x={PADDING} y={y + caption} width={width(ctx)} />
                </>
              ),
            }),
      ctx.isVisible("heatmap") && note(ctx, "history-note", ctx.historyNote),
    ]);
  },

  dashboard: (ctx) =>
    compact([
      statCards(ctx, false),
      note(ctx, "scope-note", ctx.scopeNote),
      ctx.isVisible("heatmap") && yearlySummary(ctx, true),
      ctx.isVisible("heatmap") && heatmapPanel(ctx),
      ctx.isVisible("heatmap") && note(ctx, "history-note", ctx.historyNote),
      breakdown(ctx),
      footnote(ctx),
    ]),

  dataRich: (ctx) =>
    compact([
      statCards(ctx, true),
      note(ctx, "scope-note", ctx.scopeNote),
      ctx.isVisible("heatmap") && yearlySummary(ctx, true),
      ctx.isVisible("heatmap") && heatmapPanel(ctx),
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
          />
        ),
      },
      footnote(ctx),
    ]),
};
