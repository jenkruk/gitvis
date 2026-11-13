"use client";

import { AlertCircle, ArrowRight, CheckCircle2, ChevronDown, Loader2, RotateCw, X } from "lucide-react";
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
import { button, callout, disclosureChevron, focusRing, focusWithin, hint, link } from "@/components/ui/recipes";

const FIELD_HINTS: Record<PlatformId, { prefix: string; example: string }> = {
  github: { prefix: "github.com/", example: "octocat" },
  gitlab: { prefix: "gitlab.com/", example: "your-name" },
};

interface ConnectPanelProps {
  state: ConnectionState;
  response: ContributionsResponse | null;
  initialValues: ConnectRequest;
  onConnect: (request: ConnectRequest) => void;
  onDisconnect: () => void;
  onContinue?: () => void;
  continueLabel?: string;
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
    if (loading) return;

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
    <div className="rounded-stage border border-line bg-surface p-4 shadow-raised sm:p-6">
      <form noValidate onSubmit={handleSubmit} aria-busy={loading}>
        <div className="grid gap-5 sm:grid-cols-2">
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
          <p id="connect-form-error" className="mt-3 flex items-start gap-1.5 text-body text-danger">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {formError}
          </p>
        )}

        <div className="mt-6">
          <button type="submit" className={`${button("primary", "lg")} w-full sm:w-auto`}>
            {loading && <Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin" />}
            {loading ? "Loading…" : "See my contributions"}
          </button>
        </div>
      </form>

      <ConnectionStatus state={state} onRetry={onConnect} />

      {(response || onUseSample) && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {response && onContinue && (
            <button type="button" onClick={onContinue} className={button("secondary")}>
              {continueLabel}
              <ArrowRight aria-hidden="true" className="size-4" />
            </button>
          )}
          {response ? (
            <button type="button" onClick={onDisconnect} className={button("ghost")}>
              <X aria-hidden="true" className="size-4" />
              Clear accounts
            </button>
          ) : (
            onUseSample && (
              <button type="button" onClick={onUseSample} className={`${link} min-h-11`}>
                Just exploring? Try it with sample data
              </button>
            )
          )}
        </div>
      )}

      <details className="group mt-5 border-t border-line pt-2 text-body">
        <summary
          className={`-mx-2 flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-control px-2 text-label font-medium text-fg-muted hover:bg-surface-hover hover:text-fg [&::-webkit-details-marker]:hidden ${focusRing}`}
        >
          How contributions are counted
          <ChevronDown aria-hidden="true" className={disclosureChevron} />
        </summary>
        <ul className="mt-1 mb-2 list-disc space-y-1.5 pl-5 text-fg-muted marker:text-fg-subtle">
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
      <label htmlFor={id} className="block text-label font-semibold text-fg">
        {PLATFORMS[platform].label} username <span className="font-normal text-fg-muted">(optional)</span>
      </label>
      <div
        className={`mt-1.5 flex min-h-11 items-center rounded-control border bg-surface-raised font-mono ${focusWithin} ${
          error ? "border-danger" : "border-line-strong"
        }`}
      >
        <span aria-hidden="true" className="pl-3 text-base text-fg-subtle select-none sm:text-code">
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
          className="min-w-0 flex-1 bg-transparent py-2 pr-3 pl-0.5 text-base text-fg outline-none placeholder:text-fg-subtle sm:text-code"
        />
      </div>
      <p id={`${id}-hint`} className={`mt-1.5 ${hint}`}>
        The name in your profile URL, {prefix}…
      </p>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-body text-danger">
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

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
        <ul className="space-y-2 text-body" aria-hidden="true">
          {PLATFORM_IDS.filter((p) => state.request[p]).map((p) => (
            <li key={p} className="flex items-center gap-2 text-fg-muted">
              <Loader2 className="size-4 shrink-0 motion-safe:animate-spin" />
              Loading {PLATFORMS[p].label} @{state.request[p]}…
            </li>
          ))}
        </ul>
      )}

      {state.phase === "failed" && (
        <div className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${callout("danger")}`}>
          <p className="flex items-start gap-2">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {state.message}
          </p>
          {retry && <RetryButton onClick={retry} label="Retry" />}
        </div>
      )}

      {state.phase === "loaded" && (
        <ul className="space-y-2 text-body">
          {state.response.results.map((result) => (
            <li key={result.platform} className="flex flex-wrap items-start gap-x-3 gap-y-1">
              <span
                className={`flex min-w-0 flex-1 items-start gap-2 ${
                  result.status === "ok" ? "text-fg" : "text-danger"
                }`}
              >
                {result.status === "ok" ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
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
    <button type="button" onClick={onClick} className={button("secondary", "sm")}>
      <RotateCw aria-hidden="true" className="size-4" />
      {label}
    </button>
  );
}
