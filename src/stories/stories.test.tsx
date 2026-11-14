import { composeStories } from "@storybook/react";
import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";
import * as StepNavStories from "@/components/shell/StepNav.stories";
import * as DesignControlsStories from "@/components/studio/DesignControls.stories";
import * as DataViewStories from "@/components/studio/DataView.stories";
import * as PreviewFrameStories from "@/components/studio/PreviewFrame.stories";
import * as StudioStories from "@/components/studio/Studio.stories";
import * as FoundationsStories from "@/components/ui/Foundations.stories";
import * as LandingStories from "@/components/landing/Landing.stories";
import * as HeatmapStories from "@/renderers/Heatmap.stories";
import * as StatCardsStories from "@/renderers/StatCards.stories";
import * as VisualizationStories from "@/renderers/Visualization.stories";

const modules = {
  Visualization: VisualizationStories,
  Heatmap: HeatmapStories,
  StatCards: StatCardsStories,
  PreviewFrame: PreviewFrameStories,
};

describe.each(Object.entries(modules))("%s stories", (_name, mod) => {
  const stories = Object.entries(composeStories(mod)) as [string, ComponentType][];
  it.each(stories)("%s renders an accessible image", async (_story, Story) => {
    render(<Story />);
    expect((await screen.findAllByRole("img")).length).toBeGreaterThan(0);
  });
});

const studioModules = {
  DataView: DataViewStories,
  Studio: StudioStories,
  DesignControls: DesignControlsStories,
  StepNav: StepNavStories,
  Foundations: FoundationsStories,
  Landing: LandingStories,
};

describe.each(Object.entries(studioModules))("%s stories", (_name, mod) => {
  const stories = Object.entries(composeStories(mod)) as [string, ComponentType][];
  it.each(stories)("%s renders", (_story, Story) => {
    window.history.replaceState(null, "", "/");
    const { container } = render(<Story />);
    expect(container.querySelector("h2, nav, fieldset")).not.toBeNull();
  });
});
