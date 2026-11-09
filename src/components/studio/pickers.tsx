import {
  ArrowDown,
  ArrowUp,
  ChartColumnBig,
  ChevronDown,
  IdCard,
  LayoutDashboard,
  Moon,
  PanelTop,
  SquareActivity,
  Sun,
} from "lucide-react";
import { type Dispatch, useEffect, useId, useRef, useState } from "react";
import {
  type ConfigAction,
  configReducer,
  getFeatureVisibility,
  isFeatureOn,
  presetOf,
  STARTING_PRESETS,
  type StartingPresetId,
  type VisualizationConfig,
} from "@/config/config";
import {
  FEATURE_GROUP_LABELS,
  FEATURES,
  type FeatureGroup,
  type FeatureId,
  getFeature,
  type StatFeatureId,
} from "@/config/features";
import { getLayout, LAYOUTS, type LayoutId } from "@/config/layouts";
import type { ContributionDataset } from "@/domain/types";
import { type ColorMode, CURATED_PALETTE_IDS, PALETTES, type PaletteId, resolveTheme } from "@/theme/palettes";
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

const PRESET_ICONS: Record<StartingPresetId, typeof PanelTop> = {
  graphic: SquareActivity,
  profile: IdCard,
};

/** Contribution graphic vs. developer profile card: a shortcut over the identity settings. */
export function PresetPicker({ config, dispatch }: PickerProps) {
  const selected = presetOf(config);
  // Remember the last profile-card header (e.g. Compact, or avatars turned off) so switching
  // Graphic → Profile restores the user's own choices instead of the preset defaults.
  const lastProfile = useRef<Extract<ConfigAction, { type: "applyPreset" }>["restore"]>(undefined);
  const { style, avatars } = config.identity;
  useEffect(() => {
    if (style !== "none") lastProfile.current = { style, avatars };
  }, [style, avatars]);
  return (
    <ControlGroup legend="Start with">
      <div className="grid gap-2 sm:grid-cols-2">
        {STARTING_PRESETS.map((preset) => {
          const Icon = PRESET_ICONS[preset.id];
          return (
            <RadioCard
              key={preset.id}
              name="starting-preset"
              value={preset.id}
              checked={selected === preset.id}
              onSelect={() =>
                dispatch({
                  type: "applyPreset",
                  preset: preset.id,
                  restore: preset.id === "profile" ? lastProfile.current : undefined,
                })
              }
              className="items-start gap-3"
            >
              <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
              <span>
                <span className="block text-sm font-medium">{preset.label}</span>
                <span className="block text-xs text-zinc-600 dark:text-zinc-400">{preset.description}</span>
              </span>
            </RadioCard>
          );
        })}
      </div>
    </ControlGroup>
  );
}

export function LayoutPicker({ config, dispatch }: PickerProps) {
  return (
    <ControlGroup legend="Layout">
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

/**
 * Six curated palettes first; "View all" reveals the rest. The selected
 * palette is always listed, so an Edit link with any palette shows its choice.
 */
export function PalettePicker({ config, dispatch }: PickerProps) {
  const [showAll, setShowAll] = useState(false);
  const listId = useId();
  const visible = showAll
    ? PALETTES
    : PALETTES.filter((p) => CURATED_PALETTE_IDS.includes(p.id) || p.id === config.palette);
  return (
    <ControlGroup legend="Palette" description={`Previewed in ${config.mode} mode.`}>
      <div id={listId} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
        {visible.map((palette) => (
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
      <button
        type="button"
        aria-expanded={showAll}
        aria-controls={listId}
        onClick={() => setShowAll((v) => !v)}
        className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <ChevronDown
          aria-hidden="true"
          className={`size-4 motion-safe:transition-transform ${showAll ? "rotate-180" : ""}`}
        />
        {showAll ? "Show fewer palettes" : `View all ${PALETTES.length} palettes`}
      </button>
    </ControlGroup>
  );
}

const GROUP_ORDER: FeatureGroup[] = ["visuals", "stats", "context"];

/** Registry-driven: always-on features (source attribution) aren't offered as switches. */
const toggleable = (group: FeatureGroup) =>
  FEATURES.filter((f) => f.group === group && !("alwaysOn" in f && f.alwaysOn));

export function FeatureToggles({ config, dispatch, dataset }: PickerProps & { dataset: ContributionDataset }) {
  const [layoutNote, setLayoutNote] = useState("");
  const noteFor = (visibility: ReturnType<typeof getFeatureVisibility>) =>
    !visibility.visible && visibility.reason === "needsMultiplePlatforms"
      ? "Shown when both platforms are connected"
      : undefined;

  /** Turning a feature on or off can change the layout (see configReducer); say so when it does. */
  function setFeature(feature: FeatureId, enabled: boolean) {
    const action = { type: "setFeature", feature, enabled } as const;
    const next = configReducer(config, action);
    dispatch(action);
    setLayoutNote(
      next.layout === config.layout
        ? ""
        : `Layout switched to ${getLayout(next.layout).label} ${enabled ? "to show" : "after hiding"} ${getFeature(feature).label}.`,
    );
  }

  return (
    <div className="space-y-6">
      <p role="status" className={layoutNote ? "text-sm font-medium text-zinc-700 dark:text-zinc-300" : "sr-only"}>
        {layoutNote}
      </p>
      {GROUP_ORDER.map((group) =>
        group === "stats" ? (
          <MetricList
            key={group}
            config={config}
            dispatch={dispatch}
            setFeature={setFeature}
            noteFor={(id) => noteFor(getFeatureVisibility(id, config, dataset))}
          />
        ) : (
          toggleable(group).length > 0 && (
            <ControlGroup key={group} legend={FEATURE_GROUP_LABELS[group]}>
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {toggleable(group).map((feature) => (
                  <Switch
                    key={feature.id}
                    id={`feature-${feature.id}`}
                    label={feature.label}
                    description={feature.description}
                    // Off when the current layout can't show it; turning it on switches to a layout that can.
                    checked={isFeatureOn(feature.id, config)}
                    onChange={(enabled) => setFeature(feature.id, enabled)}
                    note={noteFor(getFeatureVisibility(feature.id, config, dataset))}
                  />
                ))}
              </div>
            </ControlGroup>
          )
        ),
      )}
    </div>
  );
}

/**
 * Statistics: visibility switches in display order, each with Move up / Move down
 * buttons (keyboard and screen-reader friendly; no drag-only interaction).
 */
function MetricList({
  config,
  dispatch,
  setFeature,
  noteFor,
}: PickerProps & {
  setFeature: (feature: FeatureId, enabled: boolean) => void;
  noteFor: (id: StatFeatureId) => string | undefined;
}) {
  const [announcement, setAnnouncement] = useState("");
  const order = config.metricOrder;

  function move(id: StatFeatureId, direction: -1 | 1) {
    const to = order.indexOf(id) + direction;
    if (to < 0 || to >= order.length) return;
    dispatch({ type: "moveMetric", metric: id, direction });
    setAnnouncement(`${getFeature(id).label} moved to position ${to + 1} of ${order.length}.`);
  }

  return (
    <ControlGroup legend={FEATURE_GROUP_LABELS.stats}>
      <ol className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {order.map((id, index) => {
          const feature = getFeature(id);
          return (
            <li key={id} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Switch
                  id={`feature-${id}`}
                  label={feature.label}
                  description={feature.description}
                  checked={isFeatureOn(id, config)}
                  onChange={(enabled) => setFeature(id, enabled)}
                  note={noteFor(id)}
                />
              </div>
              <div className="flex shrink-0 gap-1 pt-2">
                <button
                  type="button"
                  onClick={() => move(id, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${feature.label} up`}
                  className={iconButton}
                >
                  <ArrowUp aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(id, 1)}
                  disabled={index === order.length - 1}
                  aria-label={`Move ${feature.label} down`}
                  className={iconButton}
                >
                  <ArrowDown aria-hidden="true" className="size-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </ControlGroup>
  );
}

const iconButton =
  "inline-flex size-9 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";
