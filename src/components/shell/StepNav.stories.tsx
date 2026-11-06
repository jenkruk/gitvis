import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { type StepId, StepNav } from "./StepNav";

function Interactive({ initial, publishAvailable }: { initial: StepId; publishAvailable: boolean }) {
  const [active, setActive] = useState(initial);
  return (
    <StepNav
      active={active}
      available={{ connect: true, design: initial !== "connect", publish: publishAvailable }}
      onSelect={setActive}
    />
  );
}

/** Progress through the three steps; unreachable steps are disabled, completed ones show a check. */
const meta = {
  title: "Studio/Step navigation",
  component: Interactive,
  args: { initial: "connect", publishAvailable: false },
  argTypes: { initial: { control: "inline-radio", options: ["connect", "design", "publish"] } },
} satisfies Meta<typeof Interactive>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewVisitor: Story = {};
export const Designing: Story = { args: { initial: "design", publishAvailable: true } };
export const SampleDataOnly: Story = { name: "Designing with sample data", args: { initial: "design" } };
export const Publishing: Story = { args: { initial: "publish", publishAvailable: true } };
export const Phone: Story = {
  args: { initial: "design", publishAvailable: true },
  globals: { viewport: { value: "phoneSmall" } },
};
