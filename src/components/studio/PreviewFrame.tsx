"use client";

import { type ReactNode, useState } from "react";
import type { VisualizationConfig } from "@/config/config";
import type { ContributionDataset } from "@/domain/types";
import type { ContributionMetrics } from "@/metrics/metrics";
import type { AvatarImages } from "@/renderers/IdentityHeader";
import { Visualization } from "@/renderers/Visualization";
import { GITHUB_README_WIDTH } from "@/theme/palettes";
import {
  type Backdrop,
  BackdropPicker,
  defaultBackdrop,
  FullSizeButton,
  FullSizeDialog,
  PreviewStage,
} from "./PreviewStage";

const FITTED = "lg:[&>svg]:max-h-[calc(100dvh-14rem)]";

export function PreviewFrame({
  dataset,
  config,
  metrics,
  busy,
  avatars = {},
  fit = false,
  status,
}: {
  dataset: ContributionDataset;
  config: VisualizationConfig;
  metrics: ContributionMetrics;
  busy: boolean;
  avatars?: AvatarImages;
  fit?: boolean;
  status?: ReactNode;
}) {
  const transparent = config.background === "transparent";
  const [chosen, setChosen] = useState<Backdrop | null>(null);
  const backdrop = chosen ?? defaultBackdrop(config.mode);
  const [fullSize, setFullSize] = useState(false);
  const graphic = (idPrefix: string) => (
    <Visualization dataset={dataset} config={config} metrics={metrics} idPrefix={idPrefix} avatars={avatars} />
  );

  return (
    <figure className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <BackdropPicker value={backdrop} onChange={setChosen} />
        <div className="ml-auto flex items-center gap-2">
          {status}
          {fit && <FullSizeButton onClick={() => setFullSize(true)} />}
        </div>
      </div>
      <PreviewStage backdrop={backdrop} busy={busy}>
        <div
          data-testid="preview-column"
          style={{ maxWidth: GITHUB_README_WIDTH }}
          className={`mx-auto w-full [&>svg]:h-auto [&>svg]:w-full ${fit ? FITTED : ""} ${busy ? "opacity-60" : ""} motion-safe:transition-opacity`}
        >
          {graphic("preview")}
        </div>
      </PreviewStage>
      {transparent && (
        <figcaption className="mt-2 text-caption text-fg-muted">
          Transparent background: shown on GitHub&apos;s {backdrop} page
          {backdrop === config.mode ? `, where ${config.mode}-theme readers will see it.` : "."}
        </figcaption>
      )}
      {fit && (
        <FullSizeDialog open={fullSize} onClose={() => setFullSize(false)} backdrop={backdrop}>
          <div style={{ maxWidth: GITHUB_README_WIDTH }} className="mx-auto w-full [&>svg]:h-auto [&>svg]:w-full">
            {graphic("preview-full")}
          </div>
        </FullSizeDialog>
      )}
    </figure>
  );
}
