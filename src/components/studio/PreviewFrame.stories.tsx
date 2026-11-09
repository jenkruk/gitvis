import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { computeMetrics } from "@/metrics/metrics";
import { configWith, sampleDataset } from "@/stories/fixtures";
import { PreviewFrame } from "./PreviewFrame";

const metrics = computeMetrics(sampleDataset);

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
