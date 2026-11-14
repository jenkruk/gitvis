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
import { SAMPLE_PARAM } from "@/publish/studio-url";
import { prepareView } from "@/renderers/view";
import { getPalette } from "@/theme/palettes";
import { DataView } from "./DataView";
import { DesignControls } from "./DesignControls";
import { PreviewFrame } from "./PreviewFrame";
import { useAvatars } from "./useAvatars";
import {
  button,
  callout,
  focusRing,
  link,
  linkButton,
  mono,
  studioControlsColumn,
  studioGrid,
  studioPreviewColumn,
} from "@/components/ui/recipes";

export interface StudioProps {
  sampleDataset: ContributionDataset;
  initialRequest?: ConnectRequest | null;
  initialResponse?: ContributionsResponse | null;
  initialConfig?: VisualizationConfig;
  /** Open Design on the sample data (no accounts), as "Explore with sample data" does. */
  initialSample?: boolean;
  origin: string;
  isPreviewDeployment?: boolean;
  initialStep?: StepId;
  renderCard?: (cardUrl: string) => string;
}

const primaryButton = button("primary", "lg");
const secondaryButton = button("secondary");
const ghostButton = button("ghost", "lg");

export function Studio({
  sampleDataset,
  initialRequest = null,
  initialResponse = null,
  initialConfig,
  initialSample = false,
  origin,
  isPreviewDeployment = false,
  initialStep,
  renderCard,
}: StudioProps) {
  const [config, dispatch] = useReducer(configReducer, initialConfig, (c) =>
    withAttribution(c ?? createDefaultConfig()),
  );
  const connection = useContributions({ request: initialRequest, response: initialResponse });
  const [publishOptions, setPublishOptions] = useState<SnippetOptions>({ theme: "selected" });
  const startOnSample = initialSample && !initialRequest;
  const [exploringSample, setExploringSample] = useState(startOnSample);
  const [step, setStep] = useState<StepId>(
    () => initialStep ?? ((initialRequest && initialResponse) || startOnSample ? "design" : "connect"),
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

  const connectHeading = useRef<HTMLHeadingElement>(null);
  const designHeading = useRef<HTMLHeadingElement>(null);
  const publishHeading = useRef<HTMLHeadingElement>(null);
  const focusPending = useRef(false);
  // Moving focus to the new step's heading is for screen readers and keyboard users. After a
  // pointer click it shouldn't draw a focus ring around the heading (Safari otherwise does).
  const pointerInput = useRef(false);
  useEffect(() => {
    const onPointer = () => (pointerInput.current = true);
    const onKey = () => (pointerInput.current = false);
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, []);
  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    const heading = { connect: connectHeading, design: designHeading, publish: publishHeading }[step].current;
    if (!heading) return;
    if (pointerInput.current) heading.dataset.pointerFocus = "";
    else delete heading.dataset.pointerFocus;
    heading.focus();
  }, [step]);

  const goTo = useCallback((next: StepId) => {
    focusPending.current = true;
    setStep(next);
    if (window.location.hash !== `#${next}`) {
      window.history.pushState(null, "", `${window.location.pathname}${window.location.search}#${next}`);
    }
  }, []);

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

  useEffect(() => {
    // Sample exploration stays in the URL (a reload keeps it) until accounts are connected.
    const sampleFlag = exploringSample && !connection.request ? `${SAMPLE_PARAM}=1` : "";
    const search = [studioSearch(connection.request, config), sampleFlag].filter(Boolean).join("&");
    const next = `${window.location.pathname}${search ? `?${search}` : ""}#${step}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(null, "", next);
    }
  }, [connection.request, config, step, exploringSample]);

  const yearsToLoad = config.years > 1 ? MAX_HISTORY_YEARS : 1;

  async function handleConnect(request: ConnectRequest) {
    const response = await connection.connect(request, yearsToLoad);
    if (response?.dataset && response.results.every((r) => r.status === "ok")) goTo("design");
  }

  const prepared = useMemo(
    () => prepareView(dataset, { years: config.years, range: config.range }),
    [dataset, config.years, config.range],
  );
  const { view, metricsView } = prepared;
  const metrics = useMemo(() => computeMetrics(metricsView), [metricsView]);

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
    <div className="space-y-8">
      <div>
        <h1 className="sr-only">Create your contribution graphic</h1>
        <StepNav active={step} available={available} onSelect={goTo} />
      </div>

      <StepSection
        id="connect"
        active={step}
        headingRef={connectHeading}
        title="Connect your accounts"
        lede="Enter one or both usernames. Public contribution counts only — no sign-in."
      >
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
        lede={
          <SourceLine
            id="design-source"
            dataset={dataset}
            connected={connection.response !== null}
            totalIsZero={metrics.total === 0}
            onChangeAccounts={() => goTo("connect")}
          />
        }
      >
        {historyFailed && connectedRequest && (
          <p className={`mb-6 flex flex-wrap items-center gap-2 ${callout("warning")}`}>
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
        <div className={studioGrid}>
          {/* Sticky only beside the controls (lg+), fitted to the viewport so none of it is out of reach.
              It lets go while the data view is open, so the table scrolls with the page. */}
          <section
            aria-labelledby="preview-heading"
            className={`${studioPreviewColumn} lg:sticky lg:top-6 lg:has-[[data-data-view][open]]:static`}
          >
            <h3 id="preview-heading" className="sr-only">
              Live preview
            </h3>
            <CollapsiblePreview>
              <PreviewFrame
                dataset={view}
                avatars={avatars}
                config={config}
                metrics={metrics}
                busy={loading}
                fit
                status={
                  loading && (
                    <p className="inline-flex items-center gap-1.5 text-caption font-medium text-fg-muted">
                      <Loader2 aria-hidden="true" className="size-3.5 motion-safe:animate-spin" />
                      Updating preview…
                    </p>
                  )
                }
              />
            </CollapsiblePreview>
            <DataView prepared={prepared} metrics={metrics} config={config} />
            <p role="status" className="sr-only">
              {summary}
            </p>
          </section>

          <div className={studioControlsColumn}>
            <DesignControls config={config} dispatch={dispatch} dataset={view} />
            <div className="mt-6">
              <button
                type="button"
                onClick={() => dispatch({ type: "reset" })}
                className={`${button("ghost", "sm")} -ml-2 px-2`}
              >
                <RotateCcw aria-hidden="true" className="size-4" />
                Reset design
              </button>
            </div>
            <StepFooter
              back={{ label: "Back", onClick: () => goTo("connect") }}
              next={
                live
                  ? { label: "Continue to publish", onClick: () => goTo("publish") }
                  : { label: "Connect accounts to publish", onClick: () => goTo("connect") }
              }
            />
          </div>
        </div>
      </StepSection>

      {step === "publish" && (
        <StepSection
          id="publish"
          active={step}
          headingRef={publishHeading}
          title="Publish to your README"
          lede="Copy the Markdown into your GitHub profile README. The image refreshes itself about every 12 hours — nothing to maintain."
        >
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
        </StepSection>
      )}
    </div>
  );
}

function StepFooter({
  back,
  next,
}: {
  back: { label: string; onClick: () => void };
  next: { label: string; onClick: () => void };
}) {
  return (
    <div className="mt-8 flex flex-col-reverse gap-2 border-t border-line pt-6 sm:flex-row sm:justify-between">
      <button type="button" onClick={back.onClick} className={ghostButton}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        {back.label}
      </button>
      <button type="button" onClick={next.onClick} className={primaryButton}>
        {next.label}
        <ArrowRight aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

function StepSection({
  id,
  active,
  headingRef,
  title,
  lede,
  describedBy,
  children,
}: {
  id: StepId;
  active: StepId;
  headingRef: RefObject<HTMLHeadingElement | null>;
  title: string;
  lede?: ReactNode;
  describedBy?: string;
  children: ReactNode;
}) {
  const index = STEP_IDS.indexOf(id);
  return (
    <section
      aria-labelledby={`step-${id}-heading`}
      hidden={active !== id}
      className="motion-safe:animate-[step-in_200ms_ease-out]"
    >
      <h2
        ref={headingRef}
        id={`step-${id}-heading`}
        tabIndex={-1}
        aria-describedby={describedBy}
        className={`w-fit rounded-sm text-title font-semibold text-fg ${focusRing} focus-visible:outline-offset-4 data-pointer-focus:focus-visible:outline-none`}
      >
        <span className="sr-only">
          Step {index + 1} of {STEP_IDS.length}, {STEP_LABELS[id]}:{" "}
        </span>
        {title}
      </h2>
      {lede && <div className="mt-1.5 max-w-3xl text-body text-fg-muted">{lede}</div>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Phones and tablets: the preview starts at a capped height and expands in place (never sticky). */
function CollapsiblePreview({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const regionId = "preview-region";
  return (
    <div>
      <div
        id={regionId}
        className={
          expanded
            ? ""
            : "max-lg:max-h-[min(60vh,26rem)] max-lg:overflow-hidden max-lg:[mask-image:linear-gradient(to_bottom,black_calc(100%-3rem),transparent)]"
        }
      >
        {children}
      </div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={regionId}
        onClick={() => setExpanded((v) => !v)}
        className={`${secondaryButton} mt-2 w-full lg:hidden`}
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
        None of the accounts could be loaded, so you&apos;re seeing <strong className="text-fg">sample data</strong>.
      </>
    ) : (
      <>
        You&apos;re previewing <strong className="text-fg">sample data</strong>.
      </>
    );
  } else {
    const who = dataset.sources.map((s, i) => (
      <span key={s.platform}>
        {i > 0 && " and "}
        {PLATFORMS[s.platform].label} <span className={`${mono} text-fg`}>@{s.username}</span>
      </span>
    ));
    message = totalIsZero ? (
      <>No contributions in the last 12 months for {who} yet. The graphic fills in as you contribute.</>
    ) : (
      <>Showing contributions for {who}.</>
    );
  }
  const note = sample || totalIsZero;

  return (
    <p className="flex flex-wrap items-start gap-x-2 gap-y-1">
      {note && <Info aria-hidden="true" className="mt-1 size-4 shrink-0 text-accent" />}
      <span id={id}>{message}</span>
      <button type="button" onClick={onChangeAccounts} className={`${link} min-h-0`}>
        {sample ? "Connect your accounts" : "Change accounts"}
      </button>
    </p>
  );
}
