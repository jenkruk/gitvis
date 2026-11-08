"use client";

import { AlertCircle, ArrowRight, CheckCircle2, Loader2, RotateCw, X } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import {
  type ConnectRequest,
  type ContributionsResponse,
  type PlatformResult,
  USERNAME_RULES,
  validateConnectRequest,
} from "@/adapters/connect";
import { PLATFORM_IDS, PLATFORMS, type PlatformId } from "@/domain/types";
import { formatNumber } from "@/renderers/primitives";
import type { ConnectionState } from "./useContributions";

const FIELD_HINTS: Record<PlatformId, { prefix: string; example: string }> = {
  github: { prefix: "github.com/", example: "octocat" },
  gitlab: { prefix: "gitlab.com/", example: "your-name" },
};

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400";

interface ConnectPanelProps {
  state: ConnectionState;
  response: ContributionsResponse | null;
  initialValues: ConnectRequest;
  onConnect: (request: ConnectRequest) => void;
  onDisconnect: () => void;
  /** Shown once data is loaded (e.g. after a partial failure, or when revisiting this step). */
  onContinue?: () => void;
  continueLabel?: string;
  /** Lets visitors explore the designer without an account (sample data, never publishable). */
  onUseSample?: () => void;
}

export function ConnectPanel({
  state,
  response,
  initialValues,
  onConnect,
  onDisconnect,
  onContinue,
  continueLabel = "Continue to design",
  onUseSample,
}: ConnectPanelProps) {
  const [values, setValues] = useState<Record<PlatformId, string>>({
    github: initialValues.github ?? "",
    gitlab: initialValues.gitlab ?? "",
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<PlatformId, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const inputs = useRef<Partial<Record<PlatformId, HTMLInputElement | null>>>({});
  const loading = state.phase === "loading";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return; // ignore duplicate submits instead of disabling the button

    const validation = validateConnectRequest(values);
    if (!validation.ok) {
      if (validation.reason === "empty") {
        setFieldErrors({});
        setFormError("Enter a GitHub username, a GitLab username, or both.");
        inputs.current.github?.focus();
      } else {
        setFormError(null);
        setFieldErrors(
          Object.fromEntries(
            validation.fields.map((p) => [
              p,
              `That isn't a valid ${PLATFORMS[p].label} username. ${USERNAME_RULES[p]}`,
            ]),
          ),
        );
        inputs.current[validation.fields[0]!]?.focus();
      }
      return;
    }

    setFieldErrors({});
    setFormError(null);
    onConnect(validation.request);
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Enter one or both usernames. Public contribution counts only — no sign-in.
      </p>

      <form noValidate onSubmit={handleSubmit} aria-busy={loading} className="mt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {PLATFORM_IDS.map((platform) => (
            <UsernameField
              key={platform}
              platform={platform}
              value={values[platform]}
              error={fieldErrors[platform]}
              describedByForm={formError ? "connect-form-error" : undefined}
              inputRef={(el) => {
                inputs.current[platform] = el;
              }}
              onChange={(value) => setValues((v) => ({ ...v, [platform]: value }))}
            />
          ))}
        </div>

        {formError && (
          <p id="connect-form-error" className="mt-3 flex items-start gap-1.5 text-sm text-red-700 dark:text-red-400">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {formError}
          </p>
        )}

        <div className="mt-5">
          <button
            type="submit"
            className={`${buttonBase} w-full bg-zinc-900 text-white hover:bg-zinc-700 sm:w-auto dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300`}
          >
            {loading && <Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin" />}
            {loading ? "Loading…" : "See my contributions"}
          </button>
        </div>
      </form>

      <ConnectionStatus state={state} onRetry={onConnect} />

      {(response || onUseSample) && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {response && onContinue && (
            <button
              type="button"
              onClick={onContinue}
              className={`${buttonBase} border border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800`}
            >
              {continueLabel}
              <ArrowRight aria-hidden="true" className="size-4" />
            </button>
          )}
          {response ? (
            <button
              type="button"
              onClick={onDisconnect}
              className={`${buttonBase} text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800`}
            >
              <X aria-hidden="true" className="size-4" />
              Clear accounts
            </button>
          ) : (
            onUseSample && (
              <button
                type="button"
                onClick={onUseSample}
                className={`${buttonBase} px-2 text-zinc-700 underline underline-offset-4 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50`}
              >
                Just exploring? Try it with sample data
              </button>
            )
          )}
        </div>
      )}

      <details className="group mt-4 text-sm">
        <summary className="cursor-pointer rounded-sm py-3 font-medium text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-zinc-300">
          How contributions are counted
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-400">
          <li>
            Counts are <strong>contributions as each platform defines them</strong>, not raw commits. GitLab also counts
            comments, merge-request approvals and other activity; GitHub counts commits only under specific conditions.
          </li>
          <li>
            Combined totals add the platforms together and aren&apos;t deduplicated (mirrored work can count twice).
          </li>
          <li>
            Private activity appears only as anonymous counts, and only if you enabled “Include private contributions”
            in that platform&apos;s profile settings.
          </li>
          <li>Covers the last 12 months. Results are cached for up to an hour.</li>
        </ul>
      </details>
    </div>
  );
}

function UsernameField({
  platform,
  value,
  error,
  describedByForm,
  inputRef,
  onChange,
}: {
  platform: PlatformId;
  value: string;
  error?: string;
  describedByForm?: string;
  inputRef: (el: HTMLInputElement | null) => void;
  onChange: (value: string) => void;
}) {
  const id = `username-${platform}`;
  const { prefix, example } = FIELD_HINTS[platform];
  const describedBy = [`${id}-hint`, error && `${id}-error`, describedByForm].filter(Boolean).join(" ");

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-medium">
        {PLATFORMS[platform].label} username{" "}
        <span className="font-normal text-zinc-600 dark:text-zinc-400">(optional)</span>
      </label>
      <div
        className={`mt-1 flex min-h-11 items-center rounded-md border bg-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue-600 dark:bg-zinc-950 dark:has-focus-visible:outline-blue-400 ${
          error ? "border-red-600 dark:border-red-400" : "border-zinc-300 dark:border-zinc-700"
        }`}
      >
        <span aria-hidden="true" className="pl-3 text-sm text-zinc-600 select-none dark:text-zinc-400">
          {prefix}
        </span>
        <input
          ref={inputRef}
          id={id}
          name={platform}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={example}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          // 16px on small screens prevents iOS zoom-on-focus.
          className="min-w-0 flex-1 bg-transparent py-2 pr-3 pl-0.5 text-base outline-none placeholder:text-zinc-400 sm:text-sm dark:placeholder:text-zinc-500"
        />
      </div>
      <p id={`${id}-hint`} className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        The name in your profile URL, {prefix}…
      </p>
      {error && (
        <p id={`${id}-error`} className="mt-1 flex items-start gap-1.5 text-sm text-red-700 dark:text-red-400">
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

/** Each total covers the platform's own year, so it's worded the way that profile words it. */
const PROFILE_PERIOD = { github: "in the last year", gitlab: "in the last 12 months" } as const;

function describeResult(result: PlatformResult): string {
  const who = `${PLATFORMS[result.platform].label} @${result.username}`;
  if (result.status !== "ok") return `${who}: ${result.message}`;
  const period = PROFILE_PERIOD[result.platform];
  if (result.total === 0) return `${who}: no contributions ${period}.`;
  const privateNote = result.privateCount
    ? ` Includes ${formatNumber(result.privateCount)} private (counts only).`
    : "";
  return `${who}: ${formatNumber(result.total)} contributions ${period}.${privateNote}`;
}

/** Announces a short summary politely and renders per-platform detail inline. */
export function statusAnnouncement(state: ConnectionState): string {
  switch (state.phase) {
    case "idle":
      return "";
    case "loading":
      return "Loading contributions…";
    case "failed":
      return state.message;
    case "loaded":
      return state.response.results.map(describeResult).join(" ");
  }
}

function ConnectionStatus({ state, onRetry }: { state: ConnectionState; onRetry: (request: ConnectRequest) => void }) {
  const retry = state.phase === "idle" ? null : () => onRetry(state.request);

  return (
    <div className="mt-4">
      <p role="status" className="sr-only">
        {statusAnnouncement(state)}
      </p>

      {state.phase === "loading" && (
        <ul className="space-y-2 text-sm" aria-hidden="true">
          {PLATFORM_IDS.filter((p) => state.request[p]).map((p) => (
            <li key={p} className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <Loader2 className="size-4 shrink-0 motion-safe:animate-spin" />
              Loading {PLATFORMS[p].label} @{state.request[p]}…
            </li>
          ))}
        </ul>
      )}

      {state.phase === "failed" && (
        <div className="flex flex-col gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <p className="flex items-start gap-2">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {state.message}
          </p>
          {retry && <RetryButton onClick={retry} label="Retry" />}
        </div>
      )}

      {state.phase === "loaded" && (
        <ul className="space-y-2 text-sm">
          {state.response.results.map((result) => (
            <li key={result.platform} className="flex flex-wrap items-start gap-x-3 gap-y-1">
              <span
                className={`flex min-w-0 flex-1 items-start gap-2 ${
                  result.status === "ok" ? "text-zinc-800 dark:text-zinc-200" : "text-red-800 dark:text-red-300"
                }`}
              >
                {result.status === "ok" ? (
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  />
                ) : (
                  <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                )}
                <span className="min-w-0 break-words">{describeResult(result)}</span>
              </span>
              {result.status !== "ok" && result.retryable && retry && (
                <RetryButton onClick={retry} label={`Retry ${PLATFORMS[result.platform].label}`} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RetryButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${buttonBase} min-h-9 border border-current px-3 text-sm hover:bg-black/5 dark:hover:bg-white/10`}
    >
      <RotateCw aria-hidden="true" className="size-4" />
      {label}
    </button>
  );
}
