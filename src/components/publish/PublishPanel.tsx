"use client";

import { AlertCircle, ArrowLeft, ChevronDown, Copy, Download, ImageIcon, Loader2 } from "lucide-react";
import { useDeferredValue, useRef, useState } from "react";
import type { ConnectRequest, PlatformResult } from "@/adapters/connect";
import type { VisualizationConfig } from "@/config/config";
import { PLATFORMS } from "@/domain/types";
import type { CardParams } from "@/publish/card-params";
import {
  altText,
  cardUrl,
  downloadName,
  editUrl,
  effectiveSnippetOptions,
  readmeSnippet,
  type SnippetOptions,
} from "@/publish/snippets";
import { CardDownloadError, fetchPublishedSvg, saveBlob, svgToPng } from "./download";
import { type Backdrop, BackdropPicker, defaultBackdrop, PreviewStage } from "@/components/studio/PreviewStage";
import {
  button,
  callout,
  disclosureChevron,
  disclosureSummary,
  focusRing,
  selectableCard,
  studioControlsColumn,
  studioGrid,
  studioPreviewColumn,
} from "@/components/ui/recipes";
import { GITHUB_README_WIDTH } from "@/theme/palettes";

export interface PublishPanelProps {
  origin: string;
  request: ConnectRequest | null;
  results: PlatformResult[];
  config: VisualizationConfig;
  options: SnippetOptions;
  onOptionsChange: (options: SnippetOptions) => void;
  isPreviewDeployment?: boolean;
  onEdit?: () => void;
  renderCard?: (cardUrl: string) => string;
}

const svgDataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const buttonClass = button("secondary");
const primaryClass = button("primary", "lg");
const fieldClass = `block w-full min-w-0 rounded-control border border-line-strong bg-surface-hover px-3 py-2 font-mono text-code text-fg ${focusRing}`;

const MARKDOWN_ID = "publish-markdown";

export function PublishPanel({
  origin,
  request,
  results,
  config,
  options,
  onOptionsChange,
  isPreviewDeployment = false,
  onEdit,
  renderCard,
}: PublishPanelProps) {
  return (
    <div className="space-y-4">
      {isPreviewDeployment && (
        <p className={`flex items-start gap-2 ${callout("warning")}`}>
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            This is a preview deployment. Published URLs point to production (<strong>{new URL(origin).host}</strong>),
            so options that only exist in this preview may not render there yet.
          </span>
        </p>
      )}

      {request ? (
        <PublishContent
          params={{ request, config }}
          origin={origin}
          results={results}
          options={options}
          onOptionsChange={onOptionsChange}
          onEdit={onEdit}
          renderCard={renderCard}
        />
      ) : (
        <p className={callout("neutral")}>
          Connect a GitHub or GitLab account to publish. Sample data can&apos;t be published.
        </p>
      )}
    </div>
  );
}

function PublishContent({
  params,
  origin,
  results,
  options,
  onOptionsChange,
  onEdit,
  renderCard,
}: {
  params: CardParams;
  origin: string;
  results: PlatformResult[];
  options: SnippetOptions;
  onOptionsChange: (options: SnippetOptions) => void;
  onEdit?: () => void;
  renderCard?: (cardUrl: string) => string;
}) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<"svg" | "png" | null>(null);
  const details = useRef<HTMLDetailsElement>(null);
  const imageUrl = cardUrl(origin, params);
  const previewUrl = useDeferredValue(imageUrl);
  const snippet = readmeSnippet(origin, params, options);
  const edit = editUrl(origin, params);
  const failed = results.filter((r) => r.status !== "ok");
  const modeLabel = params.config.mode === "dark" ? "Dark" : "Light";
  const transparent = params.config.background === "transparent";
  const { theme } = effectiveSnippetOptions(options, params.config);

  const announce = (message: string) => setStatus((previous) => (previous === message ? `${message} ` : message));

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(snippet);
      announce("README Markdown copied. Paste it into your profile README.");
    } catch {
      if (details.current) details.current.open = true;
      const field = document.getElementById(MARKDOWN_ID) as HTMLTextAreaElement | null;
      field?.focus();
      field?.select();
      announce("Couldn't access the clipboard. The README Markdown is selected — press Ctrl+C or ⌘C to copy.");
    }
  }

  async function download(kind: "svg" | "png") {
    if (busy) return;
    setBusy(kind);
    announce(`Preparing ${kind.toUpperCase()}…`);
    try {
      const svg = renderCard ? renderCard(imageUrl) : await fetchPublishedSvg(imageUrl);
      const blob = kind === "svg" ? new Blob([svg], { type: "image/svg+xml" }) : await svgToPng(svg);
      saveBlob(blob, downloadName(params.request, kind));
      announce(`${kind.toUpperCase()} downloaded.`);
    } catch (error) {
      announce(
        error instanceof CardDownloadError
          ? error.message
          : `Couldn't create the ${kind.toUpperCase()}. Please try again.`,
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {failed.length > 0 && (
        <p className={`flex items-start gap-2 ${callout("warning")}`}>
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            {failed.map((r) => `${PLATFORMS[r.platform].label} @${r.username}`).join(" and ")} couldn&apos;t be loaded.
            The published image shows an explanatory error until every account loads — retry in Connect or remove that
            username.
          </span>
        </p>
      )}

      <div className={studioGrid}>
        <div className={studioPreviewColumn}>
          <PublishedPreview
            key={previewUrl}
            src={renderCard ? svgDataUri(renderCard(previewUrl)) : previewUrl}
            alt={altText(params.request)}
            mode={params.config.mode}
          />
        </div>

        <div className={`${studioControlsColumn} space-y-6`}>
          <div className="space-y-2">
            <button type="button" onClick={copyMarkdown} className={`${primaryClass} w-full`}>
              <Copy aria-hidden="true" className="size-5" />
              Copy README Markdown
            </button>
            <div className="flex flex-wrap gap-2 [&>button]:min-w-fit [&>button]:flex-1">
              {(["svg", "png"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => download(kind)}
                  aria-busy={busy === kind}
                  className={buttonClass}
                >
                  {busy === kind ? (
                    <Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin" />
                  ) : (
                    <Download aria-hidden="true" className="size-4" />
                  )}
                  Download {kind.toUpperCase()}
                </button>
              ))}
            </div>
            <p role="status" className="min-h-5 text-body font-medium text-fg">
              {status}
            </p>
          </div>

          <CopyField
            id="publish-image-url"
            label="Image URL"
            buttonLabel="Copy image URL"
            value={imageUrl}
            announce={announce}
          />

          <details ref={details} className="group rounded-card border border-line bg-surface open:bg-surface-raised">
            <summary className={`${disclosureSummary} group-open:rounded-b-none`}>
              <span className="text-label font-semibold text-fg">Markdown and embed options</span>
              <ChevronDown aria-hidden="true" className={disclosureChevron} />
            </summary>
            <div className="space-y-6 border-t border-line px-4 pt-5 pb-5">
              <fieldset aria-describedby={transparent ? "publish-theme-hint" : undefined}>
                <legend className="text-label font-semibold">README theme</legend>
                {transparent && (
                  <p id="publish-theme-hint" className="mt-0.5 text-caption text-fg-muted">
                    Transparent backgrounds always match the reader&apos;s theme, so text stays readable on light and
                    dark GitHub.
                  </p>
                )}
                <div className="mt-2 grid gap-2">
                  {(
                    [
                      [
                        "selected",
                        `Always ${modeLabel.toLowerCase()}`,
                        `Uses your selected ${modeLabel.toLowerCase()} mode.`,
                      ],
                      ["auto", "Match reader's theme", "Light or dark, following the reader's GitHub theme."],
                    ] as const
                  ).map(([value, label, description]) => (
                    <label
                      key={value}
                      className={`${selectableCard(theme === value, transparent && value === "selected")} flex-col p-3`}
                    >
                      <input
                        type="radio"
                        name="readme-theme"
                        value={value}
                        checked={theme === value}
                        disabled={transparent && value === "selected"}
                        onChange={() => onOptionsChange({ ...options, theme: value })}
                        className="sr-only"
                      />
                      <span className={`text-label ${theme === value ? "font-semibold text-fg" : "font-medium"}`}>
                        {label}
                      </span>
                      <span className="mt-0.5 text-caption text-fg-muted">{description}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <CopyField
                id={MARKDOWN_ID}
                label="README Markdown"
                buttonLabel="Copy Markdown"
                hint="Ends with a “Get Yours” link to GitVis. The image itself isn’t a link."
                value={snippet}
                multiline
                announce={announce}
              />
              <CopyField
                id="publish-edit-url"
                label="Edit link"
                buttonLabel="Copy edit link"
                hint="Reopens GitVis with these accounts and design."
                value={edit}
                announce={announce}
              />
            </div>
          </details>

          {onEdit && (
            <div className="border-t border-line pt-6">
              <button type="button" onClick={onEdit} className={button("ghost", "lg")}>
                <ArrowLeft aria-hidden="true" className="size-4" />
                Edit design
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PublishedPreview({ src, alt, mode }: { src: string; alt: string; mode: VisualizationConfig["mode"] }) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const [chosen, setChosen] = useState<Backdrop | null>(null);
  const backdrop = chosen ?? defaultBackdrop(mode);
  const syncSettledState = (img: HTMLImageElement | null) => {
    if (img?.complete) setState(img.naturalWidth > 0 ? "loaded" : "error");
  };

  return (
    <figure className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <BackdropPicker value={backdrop} onChange={setChosen} />
      </div>
      <PreviewStage backdrop={backdrop}>
        {/* eslint-disable-next-line @next/next/no-img-element -- must load the exact external-style URL GitHub embeds, unoptimized */}
        <img
          ref={syncSettledState}
          src={src}
          alt={alt}
          onLoad={() => setState("loaded")}
          onError={() => setState("error")}
          style={{ maxWidth: GITHUB_README_WIDTH }}
          className="mx-auto h-auto w-full"
        />
      </PreviewStage>
      <figcaption className="mt-2 flex items-start gap-1.5 text-caption text-fg-muted">
        {state === "loading" && (
          <Loader2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 motion-safe:animate-spin" />
        )}
        {state === "error" && <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-danger" />}
        {state === "loaded" && <ImageIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />}
        <span>
          {state === "loading" && "Loading the published image…"}
          {state === "error" && "The published image couldn't be loaded. Check your connection and try again."}
          {state === "loaded" && "Published image — exactly what GitHub will display."}
        </span>
      </figcaption>
    </figure>
  );
}

function CopyField({
  id,
  label,
  buttonLabel,
  value,
  hint,
  multiline = false,
  announce,
}: {
  id: string;
  label: string;
  buttonLabel: string;
  value: string;
  hint?: string;
  multiline?: boolean;
  announce: (message: string) => void;
}) {
  const field = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      announce(`${label} copied to clipboard.`);
    } catch {
      field.current?.focus();
      field.current?.select();
      announce(`Couldn't access the clipboard. The ${label.toLowerCase()} is selected — press Ctrl+C or ⌘C to copy.`);
    }
  }

  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="min-w-0">
      <div className="flex items-end justify-between gap-3">
        <label htmlFor={id} className="text-label font-semibold">
          {label}
        </label>
        <button type="button" onClick={copy} className={button("secondary", "sm")}>
          <Copy aria-hidden="true" className="size-4" />
          {buttonLabel}
        </button>
      </div>
      {hint && (
        <p id={hintId} className="mt-0.5 text-caption text-fg-muted">
          {hint}
        </p>
      )}
      {multiline ? (
        <textarea
          ref={field}
          id={id}
          readOnly
          value={value}
          rows={value.includes("\n") ? 7 : 5}
          spellCheck={false}
          aria-describedby={hintId}
          className={`${fieldClass} mt-2 resize-y`}
        />
      ) : (
        <input
          ref={field}
          id={id}
          type="text"
          readOnly
          value={value}
          spellCheck={false}
          aria-describedby={hintId}
          className={`${fieldClass} mt-2`}
        />
      )}
    </div>
  );
}
