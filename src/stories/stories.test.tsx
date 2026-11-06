// Renderer-level API: our stories use no Next.js APIs, so the framework's Vite-only mocks aren't needed under Vitest.
import { composeStories } from "@storybook/react";
import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";
import * as StepNavStories from "@/components/shell/StepNav.stories";
import * as DesignControlsStories from "@/components/studio/DesignControls.stories";
import * as PreviewFrameStories from "@/components/studio/PreviewFrame.stories";
import * as StudioStories from "@/components/studio/Studio.stories";
import * as HeatmapStories from "@/renderers/Heatmap.stories";
import * as StatCardsStories from "@/renderers/StatCards.stories";
import * as VisualizationStories from "@/renderers/Visualization.stories";

// Smoke test: every documented story renders the production component without throwing.
const modules = {
  Visualization: VisualizationStories,
  Heatmap: HeatmapStories,
  StatCards: StatCardsStories,
  PreviewFrame: PreviewFrameStories,
};

describe.each(Object.entries(modules))("%s stories", (_name, mod) => {
  // Each story is a zero-arg component once composed; the module union defeats inference, so name the shape.
  const stories = Object.entries(composeStories(mod)) as [string, ComponentType][];
  it.each(stories)("%s renders an accessible image", async (_story, Story) => {
    render(<Story />);
    expect((await screen.findAllByRole("img")).length).toBeGreaterThan(0);
  });
});

// Studio stories: each renders its step with a level-2 heading or the step navigation.
const studioModules = {
  Studio: StudioStories,
  DesignControls: DesignControlsStories,
  StepNav: StepNavStories,
};

describe.each(Object.entries(studioModules))("%s stories", (_name, mod) => {
  const stories = Object.entries(composeStories(mod)) as [string, ComponentType][];
  it.each(stories)("%s renders", (_story, Story) => {
    window.history.replaceState(null, "", "/");
    const { container } = render(<Story />);
    expect(container.querySelector("h2, nav, fieldset")).not.toBeNull();
  });
});
