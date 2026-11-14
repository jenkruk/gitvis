import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AppShell } from "@/components/shell/AppShell";
import { LandingDetails } from "./LandingDetails";
import { LandingHero } from "./LandingHero";

/**
 * The landing page (`/`): the hero with the real renderer drawing the labelled sample, three small
 * showcase controls, then one short "how it works" row and the open-source/data facts.
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

/** Just the hero: the promise, the way in, and the showcase. */
export const Hero: Story = {
  render: () => <LandingHero />,
};

export const Details: Story = {
  render: () => <LandingDetails />,
};
