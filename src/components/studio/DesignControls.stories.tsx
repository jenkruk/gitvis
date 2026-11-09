import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useReducer } from "react";
import { configReducer, createDefaultConfig, type VisualizationConfig } from "@/config/config";
import { configWith, sampleDataset } from "@/stories/fixtures";
import { DesignControls } from "./DesignControls";

function Controls({ initial }: { initial: VisualizationConfig }) {
  const [config, dispatch] = useReducer(configReducer, initial);
  return (
    <div className="max-w-[400px]">
      <DesignControls config={config} dispatch={dispatch} dataset={sampleDataset} />
    </div>
  );
}

const meta = {
  title: "Studio/Design controls",
  component: Controls,
  args: { initial: createDefaultConfig() },
  argTypes: { initial: { control: false } },
} satisfies Meta<typeof Controls>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaults: Story = {};

export const ProfileCard: Story = {
  name: "Developer profile card preset",
  args: {
    initial: configWith(
      { type: "applyPreset", preset: "profile" },
      { type: "setName", name: "Avery Example" },
      { type: "setTitle", title: "Senior Frontend Engineer" },
    ),
  },
};

export const NonCuratedPalette: Story = {
  name: "Selected palette outside the curated six",
  args: { initial: configWith({ type: "setPalette", palette: "ember" }) },
};
