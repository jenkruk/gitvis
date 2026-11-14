import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { computeMetrics } from "@/metrics/metrics";
import { prepareView } from "@/renderers/view";
import { configWith, createSampleHistoryDataset, sampleDataset } from "@/stories/fixtures";
import { PreviewFrame } from "./PreviewFrame";

const metrics = computeMetrics(sampleDataset);
const threeYears = configWith({ type: "setLayout", layout: "dataRich" }, { type: "setYears", years: 3 });
const history = createSampleHistoryDataset();
const historyMetrics = computeMetrics(prepareView(history, threeYears).metricsView);

/**
 * The preview on GitHub's light or dark README page. `fit` is the sticky Design preview: fitted to
 * the viewport height at lg+, with a full-size dialog.
 */
const meta = {
  title: "Studio/Preview",
  component: PreviewFrame,
  args: {
    dataset: sampleDataset,
    config: configWith({ type: "setLayout", layout: "dataRich" }),
    metrics,
    busy: false,
  },
} satisfies Meta<typeof PreviewFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Loading: Story = { args: { busy: true } };
export const TransparentOnGitHubDark: Story = {
  name: "Transparent · on GitHub dark",
  args: {
    config: configWith(
      { type: "setMode", mode: "dark" },
      { type: "setBackground", background: "transparent" },
      { type: "setPanel", panel: "borderless" },
    ),
  },
};
export const FittedThreeYearDataRich: Story = {
  name: "Fitted · three-year Data-rich",
  args: { dataset: history, config: threeYears, metrics: historyMetrics, fit: true },
  globals: { viewport: { value: "desktop" } },
  parameters: { layout: "fullscreen" },
};
