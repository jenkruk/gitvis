"use client";

import type { VisualizationConfig } from "@/config/config";
import type { ContributionDataset } from "@/domain/types";
import type { ContributionMetrics } from "@/metrics/metrics";
import type { AvatarImages } from "@/renderers/IdentityHeader";
import { Visualization } from "@/renderers/Visualization";

/** Approximate width of a GitHub profile README's content column on desktop. */
export const README_COLUMN_WIDTH = 830;

/**
 * The graphic as a README shows it: the full image in a README-width column.
 * Published cards have no phone or tablet variants (GitHub scales the image to
 * fit), so there's nothing to switch; the column still shrinks with the studio
 * on small screens.
 */
export function PreviewFrame({
  dataset,
  config,
  metrics,
  busy,
  avatars = {},
}: {
  dataset: ContributionDataset;
  config: VisualizationConfig;
  metrics: ContributionMetrics;
  busy: boolean;
  avatars?: AvatarImages;
}) {
  return (
    <div
      aria-busy={busy}
      className="relative rounded-xl border border-zinc-200 bg-zinc-100 p-3 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {/* Simulated README column; never wider than the available space (no horizontal scroll). */}
      <div
        data-testid="preview-column"
        style={{ maxWidth: README_COLUMN_WIDTH }}
        className={`mx-auto w-full [&>svg]:h-auto [&>svg]:w-full ${busy ? "opacity-60" : ""} motion-safe:transition-opacity`}
      >
        <Visualization dataset={dataset} config={config} metrics={metrics} idPrefix="preview" avatars={avatars} />
      </div>
    </div>
  );
}
