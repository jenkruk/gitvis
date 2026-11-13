import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { VisualizationConfig } from "@/config/config";
import type { ContributionDataset } from "@/domain/types";
import { computeMetrics } from "@/metrics/metrics";
import { prepareView } from "@/renderers/view";
import { configWith, createSampleHistoryDataset, gitlabOnlyDataset, sampleDataset } from "@/stories/fixtures";
import { createSampleDataset } from "@/fixtures/sample-dataset";
import { DataView } from "./DataView";

/**
 * "Detailed contribution data": the text-and-table alternative under the preview. Shown expanded
 * here; in the studio it starts collapsed. Toggle the toolbar theme to review light and dark.
 */
function Panel({ dataset, config }: { dataset: ContributionDataset; config: VisualizationConfig }) {
  const prepared = prepareView(dataset, config);
  return (
    <div className="max-w-3xl">
      <h2 className="sr-only">Detailed contribution data</h2>
      <DataView prepared={prepared} metrics={computeMetrics(prepared.metricsView)} config={config} defaultOpen />
    </div>
  );
}

const meta = {
  title: "Studio/Detailed contribution data",
  component: Panel,
  args: { dataset: sampleDataset, config: configWith() },
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Combined: Story = { name: "GitHub + GitLab · 1 year" };
export const GitHubOnly: Story = { name: "GitHub only · 1 year", args: { dataset: createSampleDataset(["github"]) } };
export const GitLabOnly: Story = { name: "GitLab only · 1 year", args: { dataset: gitlabOnlyDataset } };
export const ThreeYears: Story = {
  name: "GitHub + GitLab · 3 years (earlier GitLab unavailable)",
  args: { dataset: createSampleHistoryDataset(), config: configWith({ type: "setYears", years: 3 }) },
};
export const GitLabOnlyThreeYears: Story = {
  name: "GitLab only · 3 years requested",
  args: { dataset: createSampleHistoryDataset(["gitlab"]), config: configWith({ type: "setYears", years: 3 }) },
};
export const Phone: Story = {
  name: "3 years · phone 320",
  args: ThreeYears.args,
  globals: { viewport: { value: "phoneSmall" } },
};
