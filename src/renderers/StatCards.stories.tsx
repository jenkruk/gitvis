import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { STAT_FEATURE_IDS } from "@/config/features";
import { computeMetrics } from "@/metrics/metrics";
import { sampleDataset } from "@/stories/fixtures";
import { type ColorMode, PALETTE_IDS, type PaletteId, resolveTheme } from "@/theme/palettes";
import { SPACING } from "./layouts";
import { CONTENT_WIDTH, PADDING } from "./primitives";
import { StatCards, statCardsHeight } from "./sections";
import { buildStatItem } from "./stats";

interface StatCardsStoryArgs {
  palette: PaletteId;
  mode: ColorMode;
  count: number;
  detailed: boolean;
  density: "spacious" | "compact";
}

const metrics = computeMetrics(sampleDataset);

/** Production StatCards with production stat items; columns follow the layout rule (≤ 4 per row, 5 → 3). */
function StatCardsFrame({ palette, mode, count, detailed, density }: StatCardsStoryArgs) {
  const theme = resolveTheme(palette, mode);
  const items = STAT_FEATURE_IDS.slice(0, count).map((id) => buildStatItem(id, metrics));
  const columns = items.length > 4 ? 3 : Infinity;
  const spacing = SPACING[density];
  const cardHeight = detailed ? spacing.statCardDetailed : spacing.statCard;
  const height = statCardsHeight(detailed, items.length, columns, cardHeight) + PADDING * 2;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${CONTENT_WIDTH + PADDING * 2} ${height}`}
      className="h-auto w-full max-w-[840px]"
      role="img"
      aria-label={`${items.length} metric cards`}
    >
      <rect width="100%" height="100%" fill={theme.background} />
      <StatCards
        items={items}
        theme={theme}
        y={PADDING}
        width={CONTENT_WIDTH}
        detailed={detailed}
        columns={columns}
        cardHeight={cardHeight}
      />
    </svg>
  );
}

const meta = {
  title: "Graphic/Metric cards",
  component: StatCardsFrame,
  args: { palette: "aurora", mode: "dark", count: 4, detailed: false, density: "spacious" },
  argTypes: {
    palette: { control: "select", options: PALETTE_IDS },
    mode: { control: "inline-radio", options: ["light", "dark"] },
    count: { control: { type: "range", min: 1, max: 5 } },
    density: { control: "inline-radio", options: ["spacious", "compact"] },
  },
} satisfies Meta<typeof StatCardsFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dashboard: Story = {};
export const Detailed: Story = { name: "Detailed (Data-rich)", args: { detailed: true } };
export const FiveMetrics: Story = { name: "Five metrics wrap into rows of 3", args: { count: 5, detailed: true } };
export const Compact: Story = { args: { density: "compact", detailed: true } };
