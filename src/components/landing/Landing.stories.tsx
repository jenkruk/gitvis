import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AppShell } from "@/components/shell/AppShell";
import { LandingDetails } from "./LandingDetails";
import { LandingHero } from "./LandingHero";

/**
 * The landing page (`/`) with the live sample showcase.
 */
const meta = {
  title: "Landing/Page",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Page: Story = {
  render: () => (
    <AppShell page="landing">
      <LandingHero />
      <LandingDetails />
    </AppShell>
  ),
};

export const PagePhone: Story = {
  ...Page,
  globals: { viewport: { value: "phone" } },
};

export const Hero: Story = {
  render: () => <LandingHero />,
};

export const Details: Story = {
  render: () => <LandingDetails />,
};
