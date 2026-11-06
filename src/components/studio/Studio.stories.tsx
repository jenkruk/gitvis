import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ContributionsResponse } from "@/adapters/connect";
import { sampleDataset } from "@/stories/fixtures";
import { Studio } from "./Studio";

/**
 * The guided studio (Connect → Design → Publish). Stories start on a given
 * step; use the viewport toolbar for phone, tablet and desktop states.
 */
const meta = {
  title: "Studio/Guided studio",
  component: Studio,
  args: { sampleDataset, origin: "https://gitvis.example" },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="p-4 sm:p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Studio>;

export default meta;
type Story = StoryObj<typeof meta>;

// Sample data stands in for a connected account (the graphic keeps its "Sample data" badge).
const connected: ContributionsResponse = {
  dataset: sampleDataset,
  results: [
    { platform: "github", username: "octocat", status: "ok", total: 1200 },
    { platform: "gitlab", username: "your-name", status: "ok", total: 640 },
  ],
};
const withAccounts = {
  initialRequest: { github: "octocat", gitlab: "your-name" },
  initialResponse: connected,
};

export const Step1Connect: Story = { name: "Step 1 · Connect" };

export const Step1Phone: Story = {
  name: "Step 1 · Connect (phone 320)",
  globals: { viewport: { value: "phoneSmall" } },
};

export const Step2Design: Story = { name: "Step 2 · Design", args: { ...withAccounts, initialStep: "design" } };

export const Step2SampleData: Story = {
  name: "Step 2 · Design with sample data (publish locked)",
  args: { initialStep: "design" },
};

export const Step2Phone: Story = {
  name: "Step 2 · Design (phone 375, collapsible preview)",
  args: { ...withAccounts, initialStep: "design" },
  globals: { viewport: { value: "phone" } },
};

/** The published image loads from the app's /api/card, so it shows its error state in Storybook. */
export const Step3Publish: Story = { name: "Step 3 · Publish", args: { ...withAccounts, initialStep: "publish" } };
