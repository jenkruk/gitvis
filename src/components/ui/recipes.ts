export const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
export const focusWithin =
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const BUTTON_BASE = `inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-ink font-semibold text-ink-fg enabled:hover:bg-ink-hover",
  secondary: "border border-line bg-surface-raised text-fg shadow-raised enabled:hover:bg-surface-hover",
  ghost: "text-fg-muted enabled:hover:bg-surface-hover enabled:hover:text-fg",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-label",
  md: "min-h-11 px-4 text-label",
  lg: "min-h-12 px-5 text-section",
};

export function button(variant: ButtonVariant = "secondary", size: ButtonSize = "md"): string {
  return `${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]}`;
}

export const iconButton = `inline-flex size-9 shrink-0 items-center justify-center rounded-control border border-line bg-surface-raised text-fg-muted motion-safe:transition-colors enabled:hover:bg-surface-hover enabled:hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`;

export const linkButton = `inline-flex min-h-6 items-center rounded-sm font-medium underline decoration-1 underline-offset-4 hover:decoration-2 ${focusRing}`;

export const link = `inline-flex min-h-6 items-center rounded-sm font-medium text-accent underline decoration-accent/40 decoration-1 underline-offset-4 hover:decoration-accent ${focusRing}`;

export const field = `block w-full min-w-0 rounded-control border border-line-strong bg-surface-raised px-3 py-2 text-base text-fg placeholder:text-fg-subtle sm:text-label ${focusRing}`;

export const studioGrid = "grid gap-8 lg:grid-cols-[minmax(320px,400px)_1fr] lg:items-start xl:gap-10";
/** First in the DOM so phones show the preview before the controls. */
export const studioPreviewColumn = "min-w-0 lg:col-start-2 lg:row-start-1";
export const studioControlsColumn = "min-w-0 lg:col-start-1 lg:row-start-1";

export const panel = "rounded-card border border-line bg-surface";

export const label = "text-label font-medium text-fg";
export const hint = "text-caption text-fg-muted";
export const overline = "text-overline font-semibold uppercase text-fg-subtle";
export const mono = "font-mono text-code";

export function selectableCard(checked: boolean, disabled = false): string {
  const state = disabled
    ? "cursor-not-allowed border-dashed border-line bg-transparent text-fg-subtle"
    : checked
      ? "cursor-pointer border-accent bg-selected text-fg"
      : "cursor-pointer border-line bg-surface text-fg-muted hover:bg-surface-hover hover:text-fg";
  return `relative flex rounded-card border motion-safe:transition-colors ${state} ${focusWithin}`;
}

export const disclosureSummary = `flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-card px-4 py-3 hover:bg-surface-hover motion-safe:transition-colors ${focusRing} [&::-webkit-details-marker]:hidden`;
export const disclosureChevron =
  "ml-auto size-4 shrink-0 text-fg-subtle group-open:rotate-180 motion-safe:transition-transform";

export type CalloutTone = "warning" | "danger" | "success" | "neutral";

const CALLOUT_TONES: Record<CalloutTone, string> = {
  warning: "border-warning-line bg-warning-bg text-warning",
  danger: "border-danger-line bg-danger-bg text-danger",
  success: "border-success-line bg-success-bg text-success",
  neutral: "border-line bg-surface text-fg-muted",
};

export function callout(tone: CalloutTone): string {
  return `rounded-card border px-3 py-2.5 text-body ${CALLOUT_TONES[tone]}`;
}
