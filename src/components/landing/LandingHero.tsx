"use client";

import { ArrowRight, ArrowUpRight, BookOpen } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import { backdropColor, PreviewStage } from "@/components/studio/PreviewStage";
import { button, link } from "@/components/ui/recipes";
import { Segmented } from "@/components/ui/Segmented";
import { STARTING_PRESETS, type StartingPresetId } from "@/config/config";
import { LIVE_EXAMPLE_URL, SITE_DESCRIPTION, SITE_HEADLINE } from "@/config/site";
import type { ContributionDataset } from "@/domain/types";
import { createSampleDataset } from "@/fixtures/sample-dataset";
import { computeMetrics } from "@/metrics/metrics";
import { prepareView } from "@/renderers/view";
import { Visualization } from "@/renderers/Visualization";
import { type ColorMode, getPalette, GITHUB_FILE_HEADER, GITHUB_README_WIDTH, resolveTheme } from "@/theme/palettes";
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

export function LandingHero({ sample: given }: { sample?: ContributionDataset }) {
  // Created on the client: deterministic, and it keeps ~700 days of data out of the RSC payload.
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
        <div style={{ maxWidth: GITHUB_README_WIDTH }} className="mx-auto w-full [&>svg]:h-auto [&>svg]:w-full">
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
      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-caption text-fg-muted">
        <span id="showcase-caption">
          A live GitVis graphic, drawn from <strong className="font-semibold text-fg">sample data</strong>.
        </span>
        <a href={LIVE_EXAMPLE_URL} target="_blank" rel="noopener noreferrer" className={`${link} gap-1`}>
          View a live example on GitHub
          <ArrowUpRight aria-hidden="true" className="size-3.5" /> <span className="sr-only">(opens in a new tab)</span>
        </a>
      </figcaption>
    </figure>
  );
}

function ReadmeFrame({ mode, children }: { mode: ColorMode; children: ReactNode }) {
  const header = GITHUB_FILE_HEADER[mode];
  return (
    <div
      data-mode={mode}
      className="overflow-hidden rounded-stage border shadow-raised motion-safe:transition-colors"
      // Matches the stage so its rounded corners don't show.
      style={{ borderColor: header.border, background: backdropColor(mode) }}
    >
      <div
        aria-hidden="true"
        className="flex items-center gap-2 border-b px-4 py-2.5 font-mono text-code motion-safe:transition-colors"
        style={{ background: header.background, borderColor: header.border, color: header.text }}
      >
        <BookOpen className="size-4" />
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
