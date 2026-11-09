"use client";

import { AlertCircle, Copy, Download, ImageIcon, Loader2, Pencil } from "lucide-react";
import { useDeferredValue, useRef, useState } from "react";
import type { ConnectRequest, PlatformResult } from "@/adapters/connect";
import type { VisualizationConfig } from "@/config/config";
import { PLATFORMS } from "@/domain/types";
import { GITHUB_SURFACES } from "@/theme/palettes";
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

export interface PublishPanelProps {
  origin: string;
  /** The request behind the live data; null when showing sample data. */
  request: ConnectRequest | null;
  results: PlatformResult[];
  config: VisualizationConfig;
  /** README snippet options (theme matching, mobile image), shared with the preview modes. */
  options: SnippetOptions;
  onOptionsChange: (options: SnippetOptions) => void;
  /** Vercel preview deployment: show that published URLs point at production. */
  isPreviewDeployment?: boolean;
  /** Returns to the design step (settings are kept). */
  onEdit?: () => void;
  /**
   * Offline card source for environments without the /api/card route (Storybook).
   * Given a published card URL, returns its SVG markup. Production omits it.
   */
  renderCard?: (cardUrl: string) => string;
}

const svgDataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400";
const buttonClass = `inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 ${focusRing}`;
const primaryClass = `inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-zinc-900 px-5 text-base font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 ${focusRing}`;
const fieldClass = `w-full min-w-0 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 ${focusRing}`;

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
        <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
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
        <p className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
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
  // Defer the preview so rapid option changes don't fire an image request per click.
  const previewUrl = useDeferredValue(imageUrl);
  const snippet = readmeSnippet(origin, params, options);
  const edit = editUrl(origin, params);
  const failed = results.filter((r) => r.status !== "ok");
  const modeLabel = params.config.mode === "dark" ? "Dark" : "Light";
  const transparent = params.config.background === "transparent";
  const { theme } = effectiveSnippetOptions(options, params.config);

  const announce = (message: string) =>
    // Alternate a trailing space so repeating the same message is announced again.
    setStatus((previous) => (previous === message ? `${message} ` : message));

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(snippet);
      announce("README Markdown copied. Paste it into your profile README.");
    } catch {
      // Reveal and select the snippet so it can be copied by hand.
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
        <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            {failed.map((r) => `${PLATFORMS[r.platform].label} @${r.username}`).join(" and ")} couldn&apos;t be loaded.
            The published image shows an explanatory error until every account loads — retry in Connect or remove that
            username.
          </span>
        </p>
      )}

      <PublishedPreview
        key={previewUrl}
        src={renderCard ? svgDataUri(renderCard(previewUrl)) : previewUrl}
        alt={altText(params.request)}
        // Transparent cards are shown on the GitHub page they're made for, not the studio's background.
        page={transparent ? GITHUB_SURFACES[params.config.mode][0] : undefined}
      />

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="button" onClick={copyMarkdown} className={primaryClass}>
            <Copy aria-hidden="true" className="size-5" />
            Copy README Markdown
          </button>
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
          {onEdit && (
            <button type="button" onClick={onEdit} className={buttonClass}>
              <Pencil aria-hidden="true" className="size-4" />
              Edit design
            </button>
          )}
        </div>
        <p role="status" className="min-h-5 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {status}
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Paste it into your GitHub profile README. The image refreshes itself about every 12 hours — nothing to
          maintain.
        </p>
      </div>

      <CopyField
        id="publish-image-url"
        label="Image URL"
        buttonLabel="Copy image URL"
        value={imageUrl}
        announce={announce}
      />

      <details ref={details} className="group rounded-lg border border-zinc-200 dark:border-zinc-800">
        <summary
          className={`flex min-h-12 cursor-pointer items-center rounded-lg px-4 py-3 text-sm font-semibold ${focusRing}`}
        >
          Markdown and embed options
        </summary>
        <div className="space-y-5 border-t border-zinc-200 px-4 pt-4 pb-5 dark:border-zinc-800">
          <fieldset aria-describedby={transparent ? "publish-theme-hint" : undefined}>
            <legend className="text-sm font-semibold">README theme</legend>
            {transparent && (
              <p id="publish-theme-hint" className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Transparent backgrounds always match the reader&apos;s theme, so text stays readable on light and dark
                GitHub.
              </p>
            )}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
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
                  className={`flex cursor-pointer flex-col rounded-lg border p-3 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue-600 ${
                    theme === value
                      ? "border-zinc-900 ring-1 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100"
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
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
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">{description}</span>
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
    </div>
  );
}

/** The real published image, fetched from the same URL GitHub will use. */
function PublishedPreview({ src, alt, page }: { src: string; alt: string; page?: string }) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  // A server-rendered <img> can finish before hydration attaches onLoad/onError,
  // so read its settled state once the element is attached.
  const syncSettledState = (img: HTMLImageElement | null) => {
    if (img?.complete) setState(img.naturalWidth > 0 ? "loaded" : "error");
  };

  return (
    <figure className="min-w-0">
      <div
        style={page ? { background: page } : undefined}
        className="relative rounded-lg border border-zinc-200 bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-2 dark:border-zinc-800 dark:bg-[repeating-conic-gradient(#18181b_0_25%,#09090b_0_50%)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- must load the exact external-style URL GitHub embeds, unoptimized */}
        <img
          ref={syncSettledState}
          src={src}
          alt={alt}
          onLoad={() => setState("loaded")}
          onError={() => setState("error")}
          className="h-auto w-full"
        />
      </div>
      <figcaption className="mt-2 flex items-start gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
        {state === "loading" && (
          <Loader2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 motion-safe:animate-spin" />
        )}
        {state === "error" && <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-red-600" />}
        {state === "loaded" && <ImageIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />}
        <span>
          {state === "loading" && "Loading the published image…"}
          {state === "error" && "The published image couldn't be loaded. Check your connection and try again."}
          {state === "loaded" &&
            "Published image — exactly what GitHub will display. Data refreshes about every 12 hours."}
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
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        <button type="button" onClick={copy} className={`${buttonClass} min-h-9 px-3`}>
          <Copy aria-hidden="true" className="size-4" />
          {buttonLabel}
        </button>
      </div>
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
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
