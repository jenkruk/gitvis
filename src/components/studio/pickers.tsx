import { ChartColumnBig, LayoutDashboard, Moon, PanelTop, Sun } from "lucide-react";
import type { Dispatch } from "react";
import { type ConfigAction, getFeatureVisibility, type VisualizationConfig } from "@/config/config";
import { FEATURE_GROUP_LABELS, FEATURES, type FeatureGroup } from "@/config/features";
import { getLayout, LAYOUTS, type LayoutId } from "@/config/layouts";
import type { ContributionDataset } from "@/domain/types";
import { type ColorMode, PALETTES, type PaletteId, resolveTheme } from "@/theme/palettes";
import { ControlGroup, RadioCard, Switch } from "./controls";

interface PickerProps {
  config: VisualizationConfig;
  dispatch: Dispatch<ConfigAction>;
}

const LAYOUT_ICONS: Record<LayoutId, typeof PanelTop> = {
  minimal: PanelTop,
  dashboard: LayoutDashboard,
  dataRich: ChartColumnBig,
};

export function LayoutPicker({ config, dispatch }: PickerProps) {
  return (
    <ControlGroup legend="Layout" description="Switching layouts keeps your features and colors.">
      <div className="grid gap-2">
        {LAYOUTS.map((layout) => {
          const Icon = LAYOUT_ICONS[layout.id];
          return (
            <RadioCard
              key={layout.id}
              name="layout"
              value={layout.id}
              checked={config.layout === layout.id}
              onSelect={() => dispatch({ type: "setLayout", layout: layout.id })}
              className="items-start gap-3"
            >
              <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
              <span>
                <span className="block text-sm font-medium">{layout.label}</span>
                <span className="block text-xs text-zinc-600 dark:text-zinc-400">{layout.description}</span>
              </span>
            </RadioCard>
          );
        })}
      </div>
    </ControlGroup>
  );
}

export function ModePicker({ config, dispatch }: PickerProps) {
  const modes: { id: ColorMode; label: string; icon: typeof Sun }[] = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
  ];
  return (
    <ControlGroup legend="Mode">
      <div className="grid grid-cols-2 gap-2">
        {modes.map(({ id, label, icon: Icon }) => (
          <RadioCard
            key={id}
            name="mode"
            value={id}
            checked={config.mode === id}
            onSelect={() => dispatch({ type: "setMode", mode: id })}
            className="items-center justify-center gap-2 py-2"
          >
            <Icon aria-hidden="true" className="size-4" />
            <span className="text-sm font-medium">{label}</span>
          </RadioCard>
        ))}
      </div>
    </ControlGroup>
  );
}

function PaletteSwatch({ palette, mode }: { palette: PaletteId; mode: ColorMode }) {
  const theme = resolveTheme(palette, mode);
  return (
    <span
      aria-hidden="true"
      className="flex h-8 items-center gap-1 rounded-md border px-1.5"
      style={{ background: theme.background, borderColor: theme.border }}
    >
      {theme.heatmap.slice(1).map((color) => (
        <span key={color} className="h-4 flex-1 rounded-[3px]" style={{ background: color }} />
      ))}
      <span className="ml-1 h-4 w-1.5 rounded-full" style={{ background: theme.series[0] }} />
      <span className="h-4 w-1.5 rounded-full" style={{ background: theme.series[1] }} />
    </span>
  );
}

export function PalettePicker({ config, dispatch }: PickerProps) {
  return (
    <ControlGroup legend="Palette" description={`Previewed in ${config.mode} mode.`}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
        {PALETTES.map((palette) => (
          <RadioCard
            key={palette.id}
            name="palette"
            value={palette.id}
            checked={config.palette === palette.id}
            onSelect={() => dispatch({ type: "setPalette", palette: palette.id })}
            className="flex-col gap-2 p-2"
          >
            <PaletteSwatch palette={palette.id} mode={config.mode} />
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium">{palette.name}</span>
              <span className="block truncate text-[11px] text-zinc-600 dark:text-zinc-400">{palette.description}</span>
            </span>
          </RadioCard>
        ))}
      </div>
    </ControlGroup>
  );
}

const GROUP_ORDER: FeatureGroup[] = ["visuals", "stats", "context"];

export function FeatureToggles({ config, dispatch, dataset }: PickerProps & { dataset: ContributionDataset }) {
  const layoutLabel = getLayout(config.layout).label;
  const noteFor = (visibility: ReturnType<typeof getFeatureVisibility>) => {
    if (visibility.visible) return undefined;
    if (visibility.reason === "unsupportedByLayout") return `Not shown in the ${layoutLabel} layout`;
    if (visibility.reason === "needsMultiplePlatforms") return "Shown when both platforms are connected";
    return undefined;
  };

  return (
    <div className="space-y-6">
      {GROUP_ORDER.map((group) => (
        <ControlGroup key={group} legend={FEATURE_GROUP_LABELS[group]}>
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {FEATURES.filter((f) => f.group === group).map((feature) => (
              <Switch
                key={feature.id}
                id={`feature-${feature.id}`}
                label={feature.label}
                description={feature.description}
                checked={config.features[feature.id]}
                onChange={(enabled) => dispatch({ type: "setFeature", feature: feature.id, enabled })}
                note={noteFor(getFeatureVisibility(feature.id, config, dataset))}
              />
            ))}
          </div>
        </ControlGroup>
      ))}
    </div>
  );
}
