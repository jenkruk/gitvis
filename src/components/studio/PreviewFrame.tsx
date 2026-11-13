"use client";

import { type ReactNode, useState } from "react";
import type { VisualizationConfig } from "@/config/config";
import type { ContributionDataset } from "@/domain/types";
import type { ContributionMetrics } from "@/metrics/metrics";
import type { AvatarImages } from "@/renderers/IdentityHeader";
import { Visualization } from "@/renderers/Visualization";
import {
  type Backdrop,
  BackdropPicker,
  defaultBackdrop,
  FullSizeButton,
  FullSizeDialog,
  PreviewStage,
} from "./PreviewStage";

export const README_COLUMN_WIDTH = 830;

/**
 * On wide screens (beside the controls, where the preview is sticky) the graphic is fitted to
 * the viewport height, so no part of it is ever out of reach; "View full size" shows it at its
 * published size. Below lg the preview is full width and expands in place.
 */
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
  /** Fit the graphic to the viewport height at lg and up (the sticky Design preview). */
  fit?: boolean;
  /** Shown at the end of the toolbar (e.g. "Updating preview…"). */
  status?: ReactNode;
}) {
  const transparent = config.background === "transparent";
  const [chosen, setChosen] = useState<Backdrop | null>(null);
  // Follows the graphic's mode until a backdrop is picked explicitly.
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
          style={{ maxWidth: README_COLUMN_WIDTH }}
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
          <div style={{ maxWidth: README_COLUMN_WIDTH }} className="mx-auto w-full [&>svg]:h-auto [&>svg]:w-full">
            {graphic("preview-full")}
          </div>
        </FullSizeDialog>
      )}
    </figure>
  );
}
