import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { computeMetrics } from "@/metrics/metrics";
import { configWith, sampleDataset } from "@/stories/fixtures";
import { type PreviewDevice, PreviewFrame } from "./PreviewFrame";

const metrics = computeMetrics(sampleDataset);

function Interactive({ initial, responsive }: { initial: PreviewDevice; responsive: boolean }) {
  const [device, setDevice] = useState(initial);
  return (
    <PreviewFrame
      dataset={sampleDataset}
      config={configWith({ type: "setLayout", layout: "dataRich" })}
      metrics={metrics}
      device={device}
      onDeviceChange={setDevice}
      responsive={responsive}
      busy={false}
    />
  );
}

/** README preview at GitHub column widths; mobile shows the compact image when enabled. */
const meta = {
  title: "Studio/Preview modes",
  component: Interactive,
  args: { initial: "desktop", responsive: true },
  argTypes: { initial: { control: "inline-radio", options: ["desktop", "tablet", "mobile"] } },
} satisfies Meta<typeof Interactive>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {};
export const Tablet: Story = { args: { initial: "tablet" } };
export const MobileOptimized: Story = { name: "Mobile (compact image)", args: { initial: "mobile" } };
export const MobileShrunk: Story = {
  name: "Mobile without compact image (shows readability warning)",
  args: { initial: "mobile", responsive: false },
};
