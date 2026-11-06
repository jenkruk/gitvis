import { RotateCcw } from "lucide-react";
import type { Dispatch } from "react";
import {
  type BackgroundStyle,
  type ConfigAction,
  type DateRangeDays,
  type Density,
  type IdentityStyle,
  NAME_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  type VisualizationConfig,
} from "@/config/config";
import { PLATFORM_IDS, PLATFORMS, type PlatformId } from "@/domain/types";
import { resolveTheme } from "@/theme/palettes";
import { ControlGroup, RadioCard } from "./controls";

interface Props {
  config: VisualizationConfig;
  dispatch: Dispatch<ConfigAction>;
}

const hint = "text-xs text-zinc-600 dark:text-zinc-400";
const fieldClass =
  "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:text-sm dark:border-zinc-700 dark:bg-zinc-950";
const checkboxLabel =
  "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-zinc-200 px-3 text-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue-600 dark:border-zinc-800";

const HEADER_PRESETS: { id: IdentityStyle; label: string; description: string }[] = [
  { id: "none", label: "None", description: "Title, date range and handles." },
  { id: "compact", label: "Compact identity", description: "Small avatars, your name and handles." },
  { id: "full", label: "Full profile", description: "Large avatars, name, title and handles." },
];

/** Profile header preset plus independent handle, avatar, name and title options. */
export function IdentityPicker({ config, dispatch }: Props) {
  const { identity } = config;
  const off = identity.style === "none";
  return (
    <ControlGroup legend="Profile header" description="Everything here is optional and independent.">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        {HEADER_PRESETS.map((preset) => (
          <RadioCard
            key={preset.id}
            name="identity-style"
            value={preset.id}
            checked={identity.style === preset.id}
            onSelect={() => dispatch({ type: "setIdentityStyle", style: preset.id })}
            className="flex-col"
          >
            <span className="text-sm font-medium">{preset.label}</span>
            <span className={hint}>{preset.description}</span>
          </RadioCard>
        ))}
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Show handles</legend>
        <p className={hint}>Requires “Platform labels &amp; links” under Context.</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {PLATFORM_IDS.map((p) => (
            <label key={p} className={checkboxLabel}>
              <input
                type="checkbox"
                className="size-5 accent-zinc-900 dark:accent-zinc-100"
                checked={identity.handles.includes(p)}
                onChange={(e) => dispatch({ type: "setHandle", platform: p, enabled: e.target.checked })}
              />
              {PLATFORMS[p].label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4" aria-describedby="identity-avatars-hint">
        <legend className="text-sm font-medium">Avatars</legend>
        <p id="identity-avatars-hint" className={hint}>
          {off
            ? "Shown with the Compact or Full header."
            : "Your public profile image, embedded in the graphic (no external loading)."}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {PLATFORM_IDS.map((p) => (
            <label key={p} className={checkboxLabel}>
              <input
                type="checkbox"
                className="size-5 accent-zinc-900 dark:accent-zinc-100"
                checked={identity.avatars.includes(p)}
                onChange={(e) => dispatch({ type: "setAvatar", platform: p, enabled: e.target.checked })}
              />
              {PLATFORMS[p].label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 grid gap-3">
        <TextField
          id="identity-name"
          label="Display name"
          value={identity.name}
          max={NAME_MAX_LENGTH}
          hintText={off ? "Shown with the Compact or Full header." : "Replaces the “Contribution activity” title."}
          onChange={(name) => dispatch({ type: "setName", name })}
        />
        <TextField
          id="identity-title"
          label="Professional title"
          value={identity.title}
          max={TITLE_MAX_LENGTH}
          hintText={identity.style === "full" ? "Shown under your name." : "Shown with the Full profile header."}
          onChange={(title) => dispatch({ type: "setTitle", title })}
        />
      </div>
    </ControlGroup>
  );
}

function TextField({
  id,
  label,
  value,
  max,
  hintText,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  max: number;
  hintText: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label} <span className="font-normal text-zinc-600 dark:text-zinc-400">(optional)</span>
      </label>
      <input
        id={id}
        type="text"
        value={value}
        maxLength={max}
        autoComplete="off"
        aria-describedby={`${id}-hint`}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClass}
      />
      <p id={`${id}-hint`} className={`${hint} mt-1`}>
        {hintText} {[...value].length}/{max} characters.
      </p>
    </div>
  );
}

const BACKGROUNDS: { id: BackgroundStyle; label: string; description: string }[] = [
  { id: "solid", label: "Solid", description: "The palette background." },
  { id: "gradient", label: "Gradient", description: "A subtle diagonal tint." },
  { id: "transparent", label: "Transparent", description: "Blends into the README page." },
];

export function BackgroundPicker({ config, dispatch }: Props) {
  return (
    <ControlGroup
      legend="Background"
      description={
        config.background === "transparent"
          ? "Transparent graphics are published with “Match reader's theme”, so they stay readable on light and dark GitHub."
          : "Independent of the palette."
      }
    >
      <div className="grid grid-cols-3 gap-2">
        {BACKGROUNDS.map((bg) => (
          <RadioCard
            key={bg.id}
            name="background"
            value={bg.id}
            checked={config.background === bg.id}
            onSelect={() => dispatch({ type: "setBackground", background: bg.id })}
            className="flex-col p-2"
          >
            <span className="text-sm font-medium">{bg.label}</span>
            <span className="text-[11px] text-zinc-600 dark:text-zinc-400">{bg.description}</span>
          </RadioCard>
        ))}
      </div>
    </ControlGroup>
  );
}

/** Per-platform series colors, independent of the palette; adjusted automatically to keep 3:1 contrast. */
export function PlatformColorPicker({ config, dispatch }: Props) {
  const base = resolveTheme(config.palette, config.mode);
  const custom = config.platformColors;
  const effective = resolveTheme(config.palette, config.mode, { series: [custom.github, custom.gitlab] });
  return (
    <ControlGroup legend="Platform colors" description="Used for breakdowns, legends and chart series.">
      <div className="grid gap-2">
        {PLATFORM_IDS.map((p: PlatformId, i) => {
          const chosen = custom[p];
          const shown = effective.series[i]!;
          const adjusted = chosen && chosen.toLowerCase() !== shown.toLowerCase();
          return (
            <div key={p} className="flex flex-wrap items-center gap-3">
              <label htmlFor={`color-${p}`} className="w-16 text-sm font-medium">
                {PLATFORMS[p].label}
              </label>
              <input
                id={`color-${p}`}
                type="color"
                value={chosen ?? base.series[i]!}
                aria-describedby={`color-${p}-hint`}
                onChange={(e) => dispatch({ type: "setPlatformColor", platform: p, color: e.target.value })}
                className="h-11 w-14 cursor-pointer rounded-md border border-zinc-300 bg-white p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-zinc-700 dark:bg-zinc-950"
              />
              <span id={`color-${p}-hint`} className={`${hint} min-w-0 flex-1`}>
                {chosen ? (adjusted ? `Adjusted to ${shown} for contrast.` : `Custom ${shown}.`) : "Palette default."}
              </span>
              {chosen && (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "setPlatformColor", platform: p, color: null })}
                  className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm text-zinc-700 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <RotateCcw aria-hidden="true" className="size-4" />
                  Reset {PLATFORMS[p].label} color
                </button>
              )}
            </div>
          );
        })}
      </div>
    </ControlGroup>
  );
}

const RANGES: { id: DateRangeDays; label: string }[] = [
  { id: 30, label: "30 days" },
  { id: 90, label: "90 days" },
  { id: 365, label: "1 year" },
];
const DENSITY_OPTIONS: { id: Density; label: string }[] = [
  { id: "spacious", label: "Spacious" },
  { id: "compact", label: "Compact" },
];

export function DataPicker({ config, dispatch }: Props) {
  return (
    <div className="space-y-6">
      <ControlGroup legend="Date range" description="Metrics, heatmap and charts all follow the range.">
        <div className="grid grid-cols-3 gap-2">
          {RANGES.map((r) => (
            <RadioCard
              key={r.id}
              name="range"
              value={String(r.id)}
              checked={config.range === r.id}
              onSelect={() => dispatch({ type: "setRange", range: r.id })}
              className="items-center justify-center py-2"
            >
              <span className="text-sm font-medium">{r.label}</span>
            </RadioCard>
          ))}
        </div>
      </ControlGroup>
      <ControlGroup legend="Density">
        <div className="grid grid-cols-2 gap-2">
          {DENSITY_OPTIONS.map((d) => (
            <RadioCard
              key={d.id}
              name="density"
              value={d.id}
              checked={config.density === d.id}
              onSelect={() => dispatch({ type: "setDensity", density: d.id })}
              className="items-center justify-center py-2"
            >
              <span className="text-sm font-medium">{d.label}</span>
            </RadioCard>
          ))}
        </div>
      </ControlGroup>
    </div>
  );
}
