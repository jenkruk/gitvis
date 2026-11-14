"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useId, useMemo, useState } from "react";
import { backdropColor, PreviewStage } from "@/components/studio/PreviewStage";
import { README_COLUMN_WIDTH } from "@/components/studio/PreviewFrame";
import { button, focusWithin } from "@/components/ui/recipes";
import { STARTING_PRESETS, type StartingPresetId } from "@/config/config";
import { SITE_DESCRIPTION, SITE_HEADLINE } from "@/config/site";
import type { ContributionDataset } from "@/domain/types";
import { createSampleDataset } from "@/fixtures/sample-dataset";
import { computeMetrics } from "@/metrics/metrics";
import { prepareView } from "@/renderers/view";
import { Visualization } from "@/renderers/Visualization";
import { type ColorMode, getPalette, resolveTheme } from "@/theme/palettes";
import {
  DEFAULT_SHOWCASE,
  sampleHref,
  type ShowcaseChoice,
  showcaseConfig,
  SHOWCASE_PALETTES,
  studioHref,
} from "./showcase";

const PRESET_SHORT: Record<StartingPresetId, string> = { graphic: "Graphic", profile: "Profile card" };
const MODES: readonly { id: ColorMode; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

/**
 * The landing hero: the promise and the way in on one side, the real graphic on the other.
 * The graphic is the production renderer drawing the labelled sample dataset; the three small
 * controls only pick from a curated slice of the studio's options, and both calls to action carry
 * that choice into the studio.
 */
export function LandingHero({ sample: given }: { sample?: ContributionDataset }) {
  // Built here rather than passed from the server: it is deterministic, and this keeps ~700 days of
  // data out of the page payload.
  const sample = useMemo(() => given ?? createSampleDataset(), [given]);
  const [choice, setChoice] = useState<ShowcaseChoice>(DEFAULT_SHOWCASE);
  const update = (next: Partial<ShowcaseChoice>) => setChoice((c) => ({ ...c, ...next }));

  return (
    <div className="mx-auto grid max-w-7xl gap-x-12 gap-y-10 px-4 pt-10 pb-12 sm:px-6 sm:pt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:pt-16 lg:pb-20 xl:gap-x-16">
      <div className="max-w-xl">
        <h1 className="text-display font-semibold text-balance text-fg">{SITE_HEADLINE}</h1>
        <p className="mt-5 text-lede text-pretty text-fg-muted">{SITE_DESCRIPTION}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Link href={studioHref(choice)} className={button("primary", "lg")}>
            Create your graphic
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          <Link href={sampleHref(choice)} className={button("secondary", "lg")}>
            Explore with sample data
          </Link>
        </div>
        <p className="mt-5 text-caption text-fg-muted">Free and open source · No sign-in · Nothing to install</p>
      </div>

      <Showcase sample={sample} choice={choice} onChange={update} />
    </div>
  );
}

function Showcase({
  sample,
  choice,
  onChange,
}: {
  sample: ContributionDataset;
  choice: ShowcaseChoice;
  onChange: (next: Partial<ShowcaseChoice>) => void;
}) {
  const config = useMemo(() => showcaseConfig(choice), [choice]);
  const prepared = useMemo(() => prepareView(sample, { years: config.years, range: config.range }), [sample, config]);
  const metrics = useMemo(() => computeMetrics(prepared.metricsView), [prepared]);

  return (
    <figure aria-labelledby="showcase-caption" className="min-w-0">
      <ReadmeFrame mode={choice.mode}>
        <div style={{ maxWidth: README_COLUMN_WIDTH }} className="mx-auto w-full [&>svg]:h-auto [&>svg]:w-full">
          <Visualization dataset={prepared.view} config={config} metrics={metrics} idPrefix="showcase" />
        </div>
      </ReadmeFrame>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Segmented
          legend="Style"
          value={choice.preset}
          options={STARTING_PRESETS.map((p) => ({ id: p.id, label: PRESET_SHORT[p.id], name: p.label }))}
          onChange={(preset) => onChange({ preset })}
        />
        <Segmented
          legend="Palette"
          value={choice.palette}
          options={SHOWCASE_PALETTES.map((id) => ({
            id,
            name: getPalette(id).name,
            label: <PaletteDots palette={id} mode={choice.mode} />,
          }))}
          onChange={(palette) => onChange({ palette })}
        />
        <Segmented
          legend="Theme"
          value={choice.mode}
          options={MODES.map((m) => ({ id: m.id, label: m.label, name: `${m.label} theme` }))}
          onChange={(mode) => onChange({ mode })}
        />
      </div>
      <figcaption id="showcase-caption" className="mt-3 text-caption text-fg-muted">
        A live GitVis graphic, drawn from <strong className="font-semibold text-fg">sample data</strong>.
      </figcaption>
    </figure>
  );
}

/** A GitHub README surface (the only place a graphic lives): the page color, a hairline and a file tab. */
function ReadmeFrame({ mode, children }: { mode: ColorMode; children: ReactNode }) {
  const dark = mode === "dark";
  return (
    <div
      data-mode={mode}
      className="overflow-hidden rounded-stage border shadow-raised motion-safe:transition-colors"
      // The page color behind the stage too, so the stage's own rounded corners don't show.
      style={{ borderColor: dark ? "#3d444d" : "#d1d9e0", background: backdropColor(mode) }}
    >
      <div
        aria-hidden="true"
        className="flex items-center gap-2 border-b px-4 py-2.5 font-mono text-code motion-safe:transition-colors"
        style={{
          background: dark ? "#151b23" : "#f6f8fa",
          borderColor: dark ? "#3d444d" : "#d1d9e0",
          color: dark ? "#9198a1" : "#59636e",
        }}
      >
        <svg viewBox="0 0 16 16" className="size-4" fill="currentColor">
          <path d="M0 1.75A.75.75 0 0 1 .75 1h4.253c1.227 0 2.317.59 3 1.501A3.743 3.743 0 0 1 11.006 1h4.245a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-4.507a2.25 2.25 0 0 0-1.591.659l-.622.621a.75.75 0 0 1-1.06 0l-.622-.621A2.25 2.25 0 0 0 5.258 13H.75a.75.75 0 0 1-.75-.75Zm7.251 10.324.004-5.073-.002-2.253A2.25 2.25 0 0 0 5.003 2.5H1.5v9h3.757a3.75 3.75 0 0 1 1.994.574ZM8.755 4.75l-.004 7.322a3.752 3.752 0 0 1 1.992-.572H14.5v-9h-3.495a2.25 2.25 0 0 0-2.25 2.25Z" />
        </svg>
        README.md
      </div>
      <PreviewStage backdrop={mode}>{children}</PreviewStage>
    </div>
  );
}

function PaletteDots({ palette, mode }: { palette: (typeof SHOWCASE_PALETTES)[number]; mode: ColorMode }) {
  const theme = resolveTheme(palette, mode);
  return (
    <span aria-hidden="true" className="flex items-center -space-x-1">
      {[theme.heatmap[2], theme.series[0], theme.series[1]].map((color, i) => (
        <span key={i} className="size-3.5 rounded-full ring-2 ring-surface" style={{ background: color }} />
      ))}
    </span>
  );
}

/** A small native radio group shown as a segmented control (the BackdropPicker pattern). */
function Segmented<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: T;
  options: readonly { id: T; label: ReactNode; name: string }[];
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="flex min-w-0 items-center gap-2">
      <legend className="float-left mr-1 text-caption text-fg-muted">{legend}</legend>
      <div className="inline-flex rounded-control border border-line bg-surface p-0.5">
        {options.map((option) => {
          const checked = value === option.id;
          return (
            <label
              key={option.id}
              title={option.name}
              className={`flex min-h-9 cursor-pointer items-center rounded-[0.25rem] border px-2.5 text-caption whitespace-nowrap motion-safe:transition-colors ${focusWithin} ${
                checked
                  ? "border-accent bg-selected font-semibold text-fg"
                  : "border-transparent font-medium text-fg-muted hover:bg-surface-hover hover:text-fg"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={checked}
                onChange={() => onChange(option.id)}
                aria-label={option.name}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
