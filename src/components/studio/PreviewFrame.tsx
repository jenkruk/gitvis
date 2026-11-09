"use client";

import type { VisualizationConfig } from "@/config/config";
import type { ContributionDataset } from "@/domain/types";
import type { ContributionMetrics } from "@/metrics/metrics";
import type { AvatarImages } from "@/renderers/IdentityHeader";
import { GITHUB_SURFACES } from "@/theme/palettes";
import { Visualization } from "@/renderers/Visualization";

export const README_COLUMN_WIDTH = 830;

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
  const transparent = config.background === "transparent";
  const page = transparent ? GITHUB_SURFACES[config.mode][0] : undefined;
  return (
    <figure className="min-w-0">
      <div
        aria-busy={busy}
        style={page ? { background: page } : undefined}
        className="relative rounded-xl border border-zinc-200 bg-zinc-100 p-3 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div
          data-testid="preview-column"
          style={{ maxWidth: README_COLUMN_WIDTH }}
          className={`mx-auto w-full [&>svg]:h-auto [&>svg]:w-full ${busy ? "opacity-60" : ""} motion-safe:transition-opacity`}
        >
          <Visualization dataset={dataset} config={config} metrics={metrics} idPrefix="preview" avatars={avatars} />
        </div>
      </div>
      {transparent && (
        <figcaption className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
          Transparent background: shown on GitHub&apos;s {config.mode} page, where {config.mode}-theme readers will see
          it.
        </figcaption>
      )}
    </figure>
  );
}
