"use client";

import { AlertCircle, Copy, Download, ImageIcon, Loader2 } from "lucide-react";
import { useDeferredValue, useRef, useState } from "react";
import type { ConnectRequest, PlatformResult } from "@/adapters/connect";
import type { VisualizationConfig } from "@/config/config";
import { PLATFORMS } from "@/domain/types";
import type { CardParams } from "@/publish/card-params";
import { altText, cardUrl, downloadName, editUrl, type ReadmeTheme, readmeSnippet } from "@/publish/snippets";
import { CardDownloadError, fetchPublishedSvg, saveBlob, svgToPng } from "./download";

export interface PublishPanelProps {
  origin: string;
  /** The request behind the live data; null when showing sample data. */
  request: ConnectRequest | null;
  results: PlatformResult[];
  config: VisualizationConfig;
}

const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:focus-visible:outline-blue-400";
const fieldClass =
  "w-full min-w-0 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200";

export function PublishPanel({ origin, request, results, config }: PublishPanelProps) {
  const [theme, setTheme] = useState<ReadmeTheme>("selected");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<"svg" | "png" | null>(null);

  const announce = (message: string) =>
    // Alternate a trailing no-break space so repeating the same message is announced again.
    setStatus((previous) => (previous === message ? `${message} ` : message));

  return (
    <section
      id="publish"
      aria-labelledby="publish-heading"
      className="scroll-mt-6 rounded-xl border border-zinc-200 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2 id="publish-heading" className="text-lg font-semibold tracking-tight">
        Publish
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Paste one snippet into your GitHub profile README. The image updates itself about every 12 hours — no GitHub
        Actions, accounts or manual updates.
      </p>

      {request ? (
        <PublishContent
          params={{ request, config }}
          origin={origin}
          results={results}
          theme={theme}
          onThemeChange={setTheme}
          busy={busy}
          setBusy={setBusy}
          announce={announce}
        />
      ) : (
        <p className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
          Connect a GitHub or GitLab account above to publish. Sample data can&apos;t be published.
        </p>
      )}

      <p role="status" className="mt-3 min-h-5 text-sm text-zinc-700 dark:text-zinc-300">
        {status}
      </p>
    </section>
  );
}

function PublishContent({
  params,
  origin,
  results,
  theme,
  onThemeChange,
  busy,
  setBusy,
  announce,
}: {
  params: CardParams;
  origin: string;
  results: PlatformResult[];
  theme: ReadmeTheme;
  onThemeChange: (theme: ReadmeTheme) => void;
  busy: "svg" | "png" | null;
  setBusy: (busy: "svg" | "png" | null) => void;
  announce: (message: string) => void;
}) {
  const imageUrl = cardUrl(origin, params);
  // Defer the preview so rapid design changes don't fire an image request per click.
  const previewUrl = useDeferredValue(imageUrl);
  const snippet = readmeSnippet(origin, params, theme);
  const edit = editUrl(origin, params);
  const failed = results.filter((r) => r.status !== "ok");
  const modeLabel = params.config.mode === "dark" ? "Dark" : "Light";

  async function download(kind: "svg" | "png") {
    if (busy) return;
    setBusy(kind);
    announce(`Preparing ${kind.toUpperCase()}…`);
    try {
      const svg = await fetchPublishedSvg(imageUrl);
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
    <div className="mt-4 space-y-6">
      {failed.length > 0 && (
        <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            {failed.map((r) => `${PLATFORMS[r.platform].label} @${r.username}`).join(" and ")} couldn&apos;t be loaded.
            The published image shows an explanatory error until every account loads — retry above or remove that
            username.
          </span>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <fieldset>
            <legend className="text-sm font-semibold">README theme</legend>
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
                    onChange={() => onThemeChange(value)}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">{description}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <CopyField
            id="publish-markdown"
            label="README Markdown"
            buttonLabel="Copy Markdown"
            value={snippet}
            multiline
            announce={announce}
          />
          <CopyField
            id="publish-image-url"
            label="Image URL"
            buttonLabel="Copy image URL"
            value={imageUrl}
            announce={announce}
          />
          <CopyField
            id="publish-edit-url"
            label="Edit link"
            buttonLabel="Copy edit link"
            hint="Reopens GitVis with these accounts and design. The README image links here too."
            value={edit}
            announce={announce}
          />

          <div className="flex flex-col gap-2 sm:flex-row">
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
        </div>

        <PublishedPreview key={previewUrl} src={previewUrl} alt={altText(params.request)} />
      </div>
    </div>
  );
}

/** The real published image, fetched from the same URL GitHub will use. */
function PublishedPreview({ src, alt }: { src: string; alt: string }) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  // A server-rendered <img> can finish before hydration attaches onLoad/onError,
  // so read its settled state once the element is attached.
  const syncSettledState = (img: HTMLImageElement | null) => {
    if (img?.complete) setState(img.naturalWidth > 0 ? "loaded" : "error");
  };

  return (
    <figure className="min-w-0">
      <div className="relative rounded-lg border border-zinc-200 bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-2 dark:border-zinc-800 dark:bg-[repeating-conic-gradient(#18181b_0_25%,#09090b_0_50%)]">
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
