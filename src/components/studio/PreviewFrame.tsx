"use client";

import { Laptop, Smartphone, Tablet } from "lucide-react";
import type { VisualizationConfig } from "@/config/config";
import type { ContributionDataset } from "@/domain/types";
import type { ContributionMetrics } from "@/metrics/metrics";
import { CANVAS_WIDTHS, type CardSize } from "@/renderers/primitives";
import { Visualization } from "@/renderers/Visualization";

export type PreviewDevice = "desktop" | "tablet" | "mobile";

/** Approximate width of a GitHub profile README's content column on each device class. */
export const PREVIEW_DEVICES: Record<PreviewDevice, { label: string; width: number; icon: typeof Laptop }> = {
  desktop: { label: "Desktop", width: 830, icon: Laptop },
  tablet: { label: "Tablet", width: 700, icon: Tablet },
  mobile: { label: "Mobile", width: 360, icon: Smartphone },
};

/** Which image variant a reader on this device would receive. */
export function sizeForDevice(device: PreviewDevice, responsive: boolean): CardSize {
  return device === "mobile" && responsive ? "compact" : "full";
}

/** Effective text scale: how large a 10px label renders at this width. */
export function labelScale(device: PreviewDevice, size: CardSize): number {
  return Math.min(1, PREVIEW_DEVICES[device].width / CANVAS_WIDTHS[size]);
}

export function PreviewFrame({
  dataset,
  config,
  metrics,
  device,
  onDeviceChange,
  responsive,
  busy,
}: {
  dataset: ContributionDataset;
  config: VisualizationConfig;
  metrics: ContributionMetrics;
  device: PreviewDevice;
  onDeviceChange: (device: PreviewDevice) => void;
  responsive: boolean;
  busy: boolean;
}) {
  const size = sizeForDevice(device, responsive);
  const scale = labelScale(device, size);
  const smallestLabelPx = Math.round(10 * scale * 10) / 10;
  const { width } = PREVIEW_DEVICES[device];

  return (
    <div>
      <fieldset className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <legend className="sr-only">Preview width</legend>
        <span aria-hidden="true" className="text-sm font-medium">
          Preview width
        </span>
        <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
          {(Object.keys(PREVIEW_DEVICES) as PreviewDevice[]).map((id) => {
            const { label, icon: Icon } = PREVIEW_DEVICES[id];
            const checked = device === id;
            return (
              <label
                key={id}
                className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md px-3 text-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue-600 motion-safe:transition-colors ${
                  checked
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                <input
                  type="radio"
                  name="preview-device"
                  value={id}
                  checked={checked}
                  onChange={() => onDeviceChange(id)}
                  className="sr-only"
                />
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div
        aria-busy={busy}
        className="relative rounded-xl border border-zinc-200 bg-zinc-100 p-3 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        {/* Simulated README column; never wider than the available space (no horizontal scroll). */}
        <div
          data-testid="preview-column"
          style={{ maxWidth: width }}
          className={`mx-auto w-full [&>svg]:h-auto [&>svg]:w-full ${busy ? "opacity-60" : ""} motion-safe:transition-opacity`}
        >
          <Visualization
            dataset={dataset}
            config={config}
            metrics={metrics}
            idPrefix="preview"
            size={size}
            links={false}
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
        ≈{width}px README column · {size === "compact" ? "mobile-optimized image" : "full image"}
        {" · smallest labels ≈"}
        {smallestLabelPx}px
        {scale < 0.6 && (
          <strong className="font-medium text-amber-800 dark:text-amber-300">
            {" "}
            — too small to read; turn on the mobile-optimized image in Publish.
          </strong>
        )}
      </p>
    </div>
  );
}
