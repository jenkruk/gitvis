import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BACKGROUND_STYLES, DATE_RANGES, DENSITIES, IDENTITY_STYLES, type VisualizationConfig } from "@/config/config";
import { LAYOUT_IDS } from "@/config/layouts";
import {
  configWith,
  createSampleHistoryDataset,
  gitlabOnlyDataset,
  sampleDataset,
  storyAvatar,
} from "@/stories/fixtures";
import { PALETTE_IDS, PALETTES } from "@/theme/palettes";
import { Visualization, type VisualizationProps } from "./Visualization";

const meta = {
  title: "Graphic/Visualization",
  component: Visualization,
  decorators: [
    (Story) => (
      <div className="max-w-[860px] [&_svg]:h-auto [&_svg]:w-full">
        <Story />
      </div>
    ),
  ],
  args: { dataset: sampleDataset, config: configWith(), idPrefix: "story" },
  argTypes: { dataset: { control: false }, metrics: { control: false }, avatars: { control: false } },
} satisfies Meta<typeof Visualization>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dashboard: Story = {};

export const Minimal: Story = { args: { config: configWith({ type: "setLayout", layout: "minimal" }) } };

export const DataRich: Story = {
  args: {
    config: configWith(
      { type: "setLayout", layout: "dataRich" },
      { type: "setFeature", feature: "bestDay", enabled: true },
      { type: "setFeature", feature: "currentStreak", enabled: true },
    ),
  },
};

export const SinglePlatform: Story = { args: { dataset: gitlabOnlyDataset } };

export const MobileCompactImage: Story = {
  name: "Compact image (phones)",
  args: { size: "compact", config: configWith({ type: "setLayout", layout: "dataRich" }) },
  decorators: [(Story) => <div className="max-w-[400px]">{Story()}</div>],
};

export const CompactDensity: Story = {
  args: { config: configWith({ type: "setLayout", layout: "dataRich" }, { type: "setDensity", density: "compact" }) },
};

export const Last30Days: Story = { args: { config: configWith({ type: "setRange", range: 30 }) } };

export const CustomPlatformColors: Story = {
  name: "Custom platform colors (contrast-corrected)",
  args: {
    config: configWith(
      { type: "setPlatformColor", platform: "github", color: "#ff7a59" },
      { type: "setPlatformColor", platform: "gitlab", color: "#101a2c" },
    ),
  },
};

export const AllLayouts: Story = {
  render: (args: VisualizationProps) => (
    <div className="grid gap-6">
      {LAYOUT_IDS.map((layout) => (
        <Visualization key={layout} {...args} idPrefix={`layout-${layout}`} config={{ ...args.config, layout }} />
      ))}
    </div>
  ),
};

export const PaletteGallery: Story = {
  render: (args: VisualizationProps) => (
    <div className="grid gap-4 md:grid-cols-2">
      {PALETTE_IDS.flatMap((palette) =>
        (["light", "dark"] as const).map((mode) => (
          <figure key={`${palette}-${mode}`} className="m-0">
            <figcaption className="mb-1 text-sm">
              {PALETTES.find((p) => p.id === palette)!.name} · {mode}
            </figcaption>
            <Visualization
              {...args}
              idPrefix={`p-${palette}-${mode}`}
              config={{ ...args.config, layout: "minimal", palette, mode }}
            />
          </figure>
        )),
      )}
    </div>
  ),
};

export const Backgrounds: Story = {
  render: (args: VisualizationProps) => (
    <div className="grid gap-4">
      {BACKGROUND_STYLES.flatMap((background) =>
        (["light", "dark"] as const).map((mode) => (
          <div
            key={`${background}-${mode}`}
            className="rounded-lg p-4"
            style={{ background: mode === "light" ? "#ffffff" : "#0d1117" }}
          >
            <p className="mb-2 text-sm" style={{ color: mode === "light" ? "#1f2328" : "#f0f6fc" }}>
              {background} · GitHub {mode}
            </p>
            <Visualization
              {...args}
              idPrefix={`bg-${background}-${mode}`}
              config={{ ...args.config, layout: "minimal", background, mode, palette: "githubClassic" }}
            />
          </div>
        )),
      )}
    </div>
  ),
};

export const Ranges: Story = {
  render: (args: VisualizationProps) => (
    <div className="grid gap-4">
      {DATE_RANGES.map((range) => (
        <Visualization key={range} {...args} idPrefix={`range-${range}`} config={{ ...args.config, range }} />
      ))}
    </div>
  ),
};

export const Densities: Story = {
  render: (args: VisualizationProps) => (
    <div className="grid gap-4">
      {DENSITIES.map((density) => (
        <Visualization
          key={density}
          {...args}
          idPrefix={`density-${density}`}
          config={{ ...args.config, layout: "dataRich", density }}
        />
      ))}
    </div>
  ),
};

const identity = (style: (typeof IDENTITY_STYLES)[number]): VisualizationConfig =>
  configWith(
    { type: "setIdentityStyle", style },
    { type: "setName", name: "Avery Example" },
    { type: "setTitle", title: "Senior Frontend Engineer" },
    { type: "setAvatar", platform: "github", enabled: true },
    { type: "setAvatar", platform: "gitlab", enabled: true },
  );

export const ProfileHeaders: Story = {
  render: (args: VisualizationProps) => (
    <div className="grid gap-6">
      {IDENTITY_STYLES.map((style) => (
        <Visualization
          key={style}
          {...args}
          idPrefix={`id-${style}`}
          config={identity(style)}
          avatars={{ github: storyAvatar }}
        />
      ))}
      <div className="max-w-[400px]">
        <Visualization
          {...args}
          idPrefix="id-compact-size"
          size="compact"
          config={identity("full")}
          avatars={{ github: storyAvatar }}
        />
      </div>
    </div>
  ),
};

const history = createSampleHistoryDataset();
const threeYears = configWith({ type: "setYears", years: 3 });

export const HistoryCombined: Story = {
  name: "History · 3 years, GitHub + GitLab",
  args: { dataset: history, config: threeYears },
};

export const HistoryGitHubOnly: Story = {
  name: "History · 3 years, GitHub only (full-span stats)",
  args: { dataset: createSampleHistoryDataset(["github"]), config: threeYears },
};

export const HistoryTwoYearsDataRich: Story = {
  name: "History · 2 years, Data-rich",
  args: {
    dataset: history,
    config: configWith({ type: "setYears", years: 2 }, { type: "setLayout", layout: "dataRich" }),
  },
};

export const HistoryPhone: Story = {
  name: "History · phones (yearly summaries + recent weeks)",
  args: { dataset: history, config: threeYears, size: "compact" },
  decorators: [(Story) => <div className="max-w-[400px]">{Story()}</div>],
};

export const HistoryGitLabOnly: Story = {
  name: "History · GitLab only (explains the 12-month limit)",
  args: { dataset: gitlabOnlyDataset, config: threeYears },
};

export const HistoryYearCards: Story = {
  name: "History · year cards in every panel style",
  render: (args: VisualizationProps) => (
    <div className="grid gap-6">
      {(["filled", "outlined", "borderless"] as const).map((panel) => (
        <figure key={panel} className="m-0">
          <figcaption className="mb-1 text-sm">{panel}</figcaption>
          <Visualization
            {...args}
            idPrefix={`cards-${panel}`}
            dataset={history}
            config={configWith({ type: "setYears", years: 3 }, { type: "setPanel", panel })}
          />
        </figure>
      ))}
    </div>
  ),
};

export const AttributionLongUsername: Story = {
  name: "Attribution · long username",
  args: {
    dataset: {
      ...sampleDataset,
      sources: sampleDataset.sources.map((s) =>
        s.platform === "gitlab"
          ? { ...s, username: "a-very-long-gitlab-username-for-a-team-account-with-a-suffix" }
          : s,
      ),
    },
  },
};
