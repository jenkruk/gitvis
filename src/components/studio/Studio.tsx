"use client";

import { Info, Loader2, RotateCcw } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useReducer, useState } from "react";
import type { ConnectRequest, ContributionsResponse } from "@/adapters/connect";
import { ConnectPanel } from "@/components/connect/ConnectPanel";
import { useContributions } from "@/components/connect/useContributions";
import { PublishPanel } from "@/components/publish/PublishPanel";
import { configReducer, createDefaultConfig, type VisualizationConfig } from "@/config/config";
import { getLayout } from "@/config/layouts";
import type { ContributionDataset } from "@/domain/types";
import { computeMetrics } from "@/metrics/metrics";
import { type SnippetOptions, studioSearch } from "@/publish/snippets";
import { DataView } from "./DataView";
import { getPalette } from "@/theme/palettes";
import { FeatureToggles, LayoutPicker, ModePicker, PalettePicker } from "./pickers";
import { type PreviewDevice, PreviewFrame } from "./PreviewFrame";

export interface StudioProps {
  /** Labeled sample data shown until an account loads. */
  sampleDataset: ContributionDataset;
  /** From the URL, pre-loaded on the server so shared links render with data. */
  initialRequest?: ConnectRequest | null;
  initialResponse?: ContributionsResponse | null;
  /** Design restored from an Edit link; defaults otherwise. */
  initialConfig?: VisualizationConfig;
  /** Absolute origin used in published URLs, e.g. https://gitvis.app */
  origin: string;
  /** True on Vercel preview deployments: published URLs point at production. */
  isPreviewDeployment?: boolean;
}

export function Studio({
  sampleDataset,
  initialRequest = null,
  initialResponse = null,
  initialConfig,
  origin,
  isPreviewDeployment = false,
}: StudioProps) {
  const [config, dispatch] = useReducer(configReducer, initialConfig, (c) => c ?? createDefaultConfig());
  const connection = useContributions({ request: initialRequest, response: initialResponse });
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [publishOptions, setPublishOptions] = useState<SnippetOptions>({ theme: "selected", responsive: true });

  // Keep the address bar equal to the Edit link, so a reload or shared URL restores everything.
  useEffect(() => {
    const search = studioSearch(connection.request, config);
    const next = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(null, "", next);
    }
  }, [connection.request, config]);
  const dataset = connection.response?.dataset ?? sampleDataset;
  const metrics = useMemo(() => computeMetrics(dataset), [dataset]);
  const loading = connection.state.phase === "loading";
  const summary = `${getLayout(config.layout).label} layout, ${getPalette(config.palette).name} palette, ${config.mode} mode.`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Design your contribution graphic</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Connect your accounts, then pick a layout, palette and the details to show.
        </p>
      </div>

      <ConnectPanel
        state={connection.state}
        response={connection.response}
        initialValues={initialRequest ?? {}}
        onConnect={connection.connect}
        onDisconnect={connection.disconnect}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(320px,380px)_1fr] lg:items-start">
        {/* Preview first in DOM so small screens show feedback above controls; the grid places it right on desktop. */}
        <section
          id="preview"
          aria-labelledby="preview-heading"
          className="min-w-0 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1"
        >
          <h2 id="preview-heading" className="sr-only">
            Preview
          </h2>
          <DataNotice dataset={dataset} connected={connection.response !== null} totalIsZero={metrics.total === 0} />
          {loading && (
            <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
              <Loader2 aria-hidden="true" className="size-3.5 motion-safe:animate-spin" />
              Updating preview…
            </p>
          )}
          <PreviewFrame
            dataset={dataset}
            config={config}
            metrics={metrics}
            device={previewDevice}
            onDeviceChange={setPreviewDevice}
            responsive={publishOptions.responsive}
            busy={loading}
          />
          <DataView dataset={dataset} metrics={metrics} />
          <p role="status" className="sr-only">
            {summary}
          </p>
        </section>

        <section
          id="customize"
          aria-labelledby="customize-heading"
          className="scroll-mt-6 space-y-8 lg:col-start-1 lg:row-start-1"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 id="customize-heading" className="text-lg font-semibold tracking-tight">
              Customize
            </h2>
            <button
              type="button"
              onClick={() => dispatch({ type: "reset" })}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Reset design
            </button>
          </div>
          <LayoutPicker config={config} dispatch={dispatch} />
          <PalettePicker config={config} dispatch={dispatch} />
          <ModePicker config={config} dispatch={dispatch} />
          <FeatureToggles config={config} dispatch={dispatch} dataset={dataset} />
        </section>
      </div>

      <PublishPanel
        origin={origin}
        request={connection.response?.dataset ? connection.request : null}
        results={connection.response?.results ?? []}
        config={config}
        options={publishOptions}
        isPreviewDeployment={isPreviewDeployment}
        onOptionsChange={setPublishOptions}
      />
    </div>
  );
}

function DataNotice({
  dataset,
  connected,
  totalIsZero,
}: {
  dataset: ContributionDataset;
  connected: boolean;
  totalIsZero: boolean;
}) {
  let message: ReactNode = null;
  if (dataset.provenance === "sample") {
    message = connected ? (
      <>
        None of the accounts could be loaded, so you&apos;re still seeing <strong>sample data</strong>.
      </>
    ) : (
      <>
        You&apos;re previewing <strong>sample data</strong>. Connect an account above to see your own.
      </>
    );
  } else if (totalIsZero) {
    message =
      "No contributions in the last 12 months for the connected accounts yet. The graphic fills in as you contribute.";
  }
  if (!message) return null;

  return (
    <p className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}
