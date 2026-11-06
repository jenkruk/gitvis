import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { sliceToRecentDays } from "@/domain/combine";
import { sampleDataset } from "@/stories/fixtures";
import { type ColorMode, PALETTE_IDS, type PaletteId, resolveTheme } from "@/theme/palettes";
import { Heatmap, measureHeatmap } from "./Heatmap";

interface HeatmapStoryArgs {
  palette: PaletteId;
  mode: ColorMode;
  days: 30 | 90 | 365;
  width: number;
  showLegend: boolean;
}

/** The production heatmap, wrapped in the minimal SVG it needs to render on its own. */
function HeatmapFrame({ palette, mode, days, width, showLegend }: HeatmapStoryArgs) {
  const theme = resolveTheme(palette, mode);
  const data = sliceToRecentDays(sampleDataset, days).days;
  const { height } = measureHeatmap(data, width, showLegend);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width + 32}
      height={height + 32}
      role="img"
      aria-label={`Contribution heatmap, last ${days} days`}
    >
      <rect width={width + 32} height={height + 32} rx={12} fill={theme.surface} />
      <Heatmap days={data} theme={theme} x={16} y={16} width={width} showLegend={showLegend} />
    </svg>
  );
}

const meta = {
  title: "Graphic/Heatmap",
  component: HeatmapFrame,
  args: { palette: "aurora", mode: "dark", days: 365, width: 760, showLegend: true },
  argTypes: {
    palette: { control: "select", options: PALETTE_IDS },
    mode: { control: "inline-radio", options: ["light", "dark"] },
    days: { control: "inline-radio", options: [30, 90, 365] },
    width: { control: { type: "range", min: 240, max: 800, step: 20 } },
  },
} satisfies Meta<typeof HeatmapFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Year: Story = {};
export const Quarter: Story = { args: { days: 90 } };
export const Month: Story = { args: { days: 30 } };
export const NarrowWidth: Story = { name: "Narrow (cells shrink, never overflow)", args: { width: 300 } };
export const LightMode: Story = { args: { mode: "light", palette: "githubClassic" } };
