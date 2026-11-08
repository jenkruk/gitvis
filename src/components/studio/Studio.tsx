"use client";

import { ArrowLeft, ArrowRight, ChevronDown, Info, Loader2, RotateCcw } from "lucide-react";
import { type ReactNode, type RefObject, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { ConnectRequest, ContributionsResponse } from "@/adapters/connect";
import { ConnectPanel } from "@/components/connect/ConnectPanel";
import { useContributions } from "@/components/connect/useContributions";
import { PublishPanel } from "@/components/publish/PublishPanel";
import { isStepId, STEP_IDS, STEP_LABELS, type StepId, StepNav } from "@/components/shell/StepNav";
import { configReducer, createDefaultConfig, type VisualizationConfig, withAttribution } from "@/config/config";
import { getLayout } from "@/config/layouts";
import { MAX_HISTORY_YEARS } from "@/domain/history";
import { type ContributionDataset, PLATFORMS } from "@/domain/types";
import { computeMetrics } from "@/metrics/metrics";
import { type SnippetOptions, studioSearch } from "@/publish/snippets";
import { prepareView } from "@/renderers/view";
import { getPalette } from "@/theme/palettes";
import { DataView } from "./DataView";
import { DesignControls } from "./DesignControls";
import { type PreviewDevice, PreviewFrame } from "./PreviewFrame";
import { useAvatars } from "./useAvatars";

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
  /** Overrides the starting step (Storybook, tests). Otherwise: Design for shared links, Connect for new visitors. */
  initialStep?: StepId;
  /** Offline published-card source for Storybook (see PublishPanel). Production omits it. */
  renderCard?: (cardUrl: string) => string;
}

const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-900 px-5 text-sm font-semibold text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-blue-400";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:outline-blue-400";
const linkButton =
  "inline-flex min-h-6 items-center rounded-sm font-medium underline underline-offset-4 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:hover:text-zinc-50";

/**
 * The guided studio: Connect → Design → Publish. One reducer holds the whole
 * design and lives above the steps, so moving between them never loses a
 * setting. The query string is the Edit link; the hash records the step, so
 * reloads and the browser's Back button keep your place.
 */
export function Studio({
  sampleDataset,
  initialRequest = null,
  initialResponse = null,
  initialConfig,
  origin,
  isPreviewDeployment = false,
  initialStep,
  renderCard,
}: StudioProps) {
  // Every studio design attributes its sources, even when opened from a legacy v1 link without labels.
  const [config, dispatch] = useReducer(configReducer, initialConfig, (c) =>
    withAttribution(c ?? createDefaultConfig()),
  );
  const connection = useContributions({ request: initialRequest, response: initialResponse });
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [publishOptions, setPublishOptions] = useState<SnippetOptions>({
    theme: "selected",
    responsive: true,
    // On by default: in a README, real text links are the only way to click through to each profile.
    profileLinks: true,
  });
  const [exploringSample, setExploringSample] = useState(false);
  const [step, setStep] = useState<StepId>(
    () => initialStep ?? (initialRequest && initialResponse ? "design" : "connect"),
  );

  const dataset = connection.response?.dataset ?? sampleDataset;
  const live = Boolean(connection.response?.dataset);
  const available: Record<StepId, boolean> = {
    connect: true,
    design: connection.response !== null || exploringSample || step !== "connect",
    publish: live,
  };
  const availableRef = useRef(available);
  useEffect(() => {
    availableRef.current = available;
  });

  // Focus the new step's heading after a user-initiated step change (never on first render).
  const connectHeading = useRef<HTMLHeadingElement>(null);
  const designHeading = useRef<HTMLHeadingElement>(null);
  const publishHeading = useRef<HTMLHeadingElement>(null);
  const focusPending = useRef(false);
  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    const heading = { connect: connectHeading, design: designHeading, publish: publishHeading }[step];
    heading.current?.focus();
  }, [step]);

  const goTo = useCallback((next: StepId) => {
    focusPending.current = true;
    setStep(next);
    if (window.location.hash !== `#${next}`) {
      window.history.pushState(null, "", `${window.location.pathname}${window.location.search}#${next}`);
    }
  }, []);

  // Restore the step from the hash on load, and follow Back/Forward.
  useEffect(() => {
    function fromHash(focus: boolean) {
      const hash = window.location.hash.slice(1);
      if (!isStepId(hash) || !availableRef.current[hash]) return;
      focusPending.current = focus;
      setStep(hash);
    }
    fromHash(false);
    const onPop = () => fromHash(true);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Keep the address bar equal to the Edit link (plus the step), so a reload or shared URL restores everything.
  useEffect(() => {
    const search = studioSearch(connection.request, config);
    const next = `${window.location.pathname}${search ? `?${search}` : ""}#${step}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(null, "", next);
    }
  }, [connection.request, config, step]);

  // Multi-year designs load all available history at once, so switching 2 ↔ 3 years never refetches.
  const yearsToLoad = config.years > 1 ? MAX_HISTORY_YEARS : 1;

  async function handleConnect(request: ConnectRequest) {
    const response = await connection.connect(request, yearsToLoad);
    // Everything loaded → straight to Design. Partial failures stay here so they can be fixed or retried.
    if (response?.dataset && response.results.every((r) => r.status === "ok")) goTo("design");
  }

  // Same derivation as the published graphic: calendars show `view`, metrics cover what every platform reports.
  const prepared = useMemo(
    () => prepareView(dataset, { years: config.years, range: config.range }),
    [dataset, config.years, config.range],
  );
  const { view, metricsView } = prepared;
  const metrics = useMemo(() => computeMetrics(metricsView), [metricsView]);

  // Choosing 2 or 3 years after connecting fetches earlier GitHub history once.
  const { connect: reconnect, request: connectedRequest, response: connectedResponse } = connection;
  const needsHistory =
    config.years > 1 &&
    !!connectedRequest?.github &&
    !!connectedResponse?.dataset &&
    connectedResponse.history === undefined &&
    connection.state.phase !== "loading";
  useEffect(() => {
    if (needsHistory && connectedRequest) void reconnect(connectedRequest, MAX_HISTORY_YEARS);
  }, [needsHistory, connectedRequest, reconnect]);
  const historyFailed = connectedResponse?.history && connectedResponse.history.status !== "ok";
  const avatars = useAvatars(live ? connection.request : null, config.identity);
  const loading = connection.state.phase === "loading";
  const partial = connection.response?.results.some((r) => r.status !== "ok") ?? false;
  const summary = `${getLayout(config.layout).label} layout, ${getPalette(config.palette).name} palette, ${config.mode} mode.`;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Create your contribution graphic</h1>
        <StepNav active={step} available={available} onSelect={goTo} />
      </div>

      {/* Connect and Design stay mounted (hidden) so typed values and open sections survive navigation. */}
      <StepSection id="connect" active={step} headingRef={connectHeading} title="Connect your accounts">
        <div className="max-w-3xl">
          <ConnectPanel
            state={connection.state}
            response={connection.response}
            initialValues={initialRequest ?? {}}
            onConnect={handleConnect}
            onDisconnect={() => {
              connection.disconnect();
              setExploringSample(false);
            }}
            onContinue={live ? () => goTo("design") : undefined}
            continueLabel={partial ? "Continue with available data" : "Continue to design"}
            onUseSample={() => {
              setExploringSample(true);
              goTo("design");
            }}
          />
        </div>
      </StepSection>

      <StepSection
        id="design"
        active={step}
        headingRef={designHeading}
        title="Design your graphic"
        describedBy="design-source"
        actions={
          <button type="button" onClick={() => dispatch({ type: "reset" })} className={secondaryButton}>
            <RotateCcw aria-hidden="true" className="size-4" />
            Reset design
          </button>
        }
      >
        <SourceLine
          id="design-source"
          dataset={dataset}
          connected={connection.response !== null}
          totalIsZero={metrics.total === 0}
          onChangeAccounts={() => goTo("connect")}
        />
        {historyFailed && connectedRequest && (
          <p className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <Info aria-hidden="true" className="size-4 shrink-0" />
            <span>Earlier GitHub history couldn&apos;t be loaded, so only the last 12 months are shown.</span>
            <button
              type="button"
              onClick={() => void reconnect(connectedRequest, MAX_HISTORY_YEARS)}
              className={linkButton}
            >
              Try again
            </button>
          </p>
        )}
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(320px,400px)_1fr] lg:items-start">
          {/* Preview first in the DOM so phones see feedback above the controls; the grid moves it right on desktop. */}
          <section
            aria-labelledby="preview-heading"
            className="min-w-0 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1"
          >
            <h3 id="preview-heading" className="sr-only">
              Live preview
            </h3>
            {loading && (
              <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                <Loader2 aria-hidden="true" className="size-3.5 motion-safe:animate-spin" />
                Updating preview…
              </p>
            )}
            <CollapsiblePreview>
              <PreviewFrame
                dataset={view}
                avatars={avatars}
                config={config}
                metrics={metrics}
                device={previewDevice}
                onDeviceChange={setPreviewDevice}
                responsive={publishOptions.responsive}
                busy={loading}
              />
            </CollapsiblePreview>
            <DataView prepared={prepared} metrics={metrics} />
            <p role="status" className="sr-only">
              {summary}
            </p>
          </section>

          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <DesignControls config={config} dispatch={dispatch} dataset={view} />
            <div className="mt-8 flex flex-col-reverse gap-2 border-t border-zinc-200 pt-6 sm:flex-row sm:justify-between dark:border-zinc-800">
              <button type="button" onClick={() => goTo("connect")} className={secondaryButton}>
                <ArrowLeft aria-hidden="true" className="size-4" />
                Back
              </button>
              {live ? (
                <button type="button" onClick={() => goTo("publish")} className={primaryButton}>
                  Continue to publish
                  <ArrowRight aria-hidden="true" className="size-4" />
                </button>
              ) : (
                <button type="button" onClick={() => goTo("connect")} className={primaryButton}>
                  Connect accounts to publish
                  <ArrowRight aria-hidden="true" className="size-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </StepSection>

      {/* Publish mounts only when shown, so the real image isn't re-fetched on every design change. */}
      {step === "publish" && (
        <StepSection id="publish" active={step} headingRef={publishHeading} title="Publish to your README">
          <div className="max-w-4xl">
            <PublishPanel
              origin={origin}
              request={live ? connection.request : null}
              results={connection.response?.results ?? []}
              config={config}
              options={publishOptions}
              isPreviewDeployment={isPreviewDeployment}
              onOptionsChange={setPublishOptions}
              onEdit={() => goTo("design")}
              renderCard={renderCard}
            />
          </div>
        </StepSection>
      )}
    </div>
  );
}

function StepSection({
  id,
  active,
  headingRef,
  title,
  describedBy,
  actions,
  children,
}: {
  id: StepId;
  active: StepId;
  headingRef: RefObject<HTMLHeadingElement | null>;
  title: string;
  describedBy?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const index = STEP_IDS.indexOf(id);
  return (
    <section
      aria-labelledby={`step-${id}-heading`}
      hidden={active !== id}
      className="motion-safe:animate-[step-in_200ms_ease-out]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          ref={headingRef}
          id={`step-${id}-heading`}
          tabIndex={-1}
          aria-describedby={describedBy}
          className="rounded-sm text-xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
        >
          <span className="sr-only">
            Step {index + 1} of {STEP_IDS.length}, {STEP_LABELS[id]}:{" "}
          </span>
          {title}
        </h2>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * Below the desktop breakpoint the preview starts at a capped height with an
 * Expand button, so the controls stay close. It's never sticky on phones,
 * where a pinned preview could cover the focused control (WCAG 2.4.11).
 */
function CollapsiblePreview({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const regionId = "preview-region";
  return (
    <div>
      <div
        id={regionId}
        className={`relative ${expanded ? "" : "max-lg:max-h-[min(60vh,26rem)] max-lg:overflow-hidden"}`}
      >
        {children}
        {!expanded && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-background to-transparent lg:hidden"
          />
        )}
      </div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={regionId}
        onClick={() => setExpanded((v) => !v)}
        className={`${secondaryButton} mt-1 w-full border border-zinc-200 lg:hidden dark:border-zinc-800`}
      >
        <ChevronDown
          aria-hidden="true"
          className={`size-4 motion-safe:transition-transform ${expanded ? "rotate-180" : ""}`}
        />
        {expanded ? "Collapse preview" : "Expand preview"}
      </button>
    </div>
  );
}

/** Whose data the preview shows, with a way back to Connect. */
function SourceLine({
  id,
  dataset,
  connected,
  totalIsZero,
  onChangeAccounts,
}: {
  id: string;
  dataset: ContributionDataset;
  connected: boolean;
  totalIsZero: boolean;
  onChangeAccounts: () => void;
}) {
  const sample = dataset.provenance === "sample";
  let message: ReactNode;
  if (sample) {
    message = connected ? (
      <>
        None of the accounts could be loaded, so you&apos;re seeing <strong>sample data</strong>.
      </>
    ) : (
      <>
        You&apos;re previewing <strong>sample data</strong>.
      </>
    );
  } else {
    const who = dataset.sources.map((s) => `${PLATFORMS[s.platform].label} @${s.username}`).join(" and ");
    message = totalIsZero
      ? `No contributions in the last 12 months for ${who} yet. The graphic fills in as you contribute.`
      : `Showing contributions for ${who}.`;
  }
  const warn = sample || totalIsZero;

  return (
    <p
      className={`flex flex-wrap items-start gap-x-2 gap-y-1 text-sm ${
        warn
          ? "rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          : "text-zinc-700 dark:text-zinc-300"
      }`}
    >
      {warn && <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
      <span id={id}>{message}</span>
      <button type="button" onClick={onChangeAccounts} className={linkButton}>
        {sample ? "Connect your accounts" : "Change accounts"}
      </button>
    </p>
  );
}
