/**
 * Studio component recipes: class strings built only from the semantic tokens in
 * src/app/globals.css. Use these instead of hand-writing button, field or card styles.
 * See docs/DESIGN_SYSTEM.md "Studio foundations".
 */

/**
 * The one focus treatment: a 2px focus-teal ring, detached by a 2px gap. Keyboard only
 * (`:focus-visible`), so pointer selection never looks like focus. Selection is drawn inside
 * the control (1px accent border), so selected + focused shows both without competing.
 */
export const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
/** For labels wrapping a visually hidden input (radio cards, switches, checkboxes). */
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

/** sm: 36px (inline actions) · md: 44px (default, touch-friendly) · lg: 48px (the step's main action). */
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-label",
  md: "min-h-11 px-4 text-label",
  lg: "min-h-12 px-5 text-section",
};

export function button(variant: ButtonVariant = "secondary", size: ButtonSize = "md"): string {
  return `${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]}`;
}

/** Square icon-only button (needs an aria-label). */
export const iconButton = `inline-flex size-9 shrink-0 items-center justify-center rounded-control border border-line bg-surface-raised text-fg-muted motion-safe:transition-colors enabled:hover:bg-surface-hover enabled:hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`;

/** Inline text action inside a sentence. Inherits the surrounding text color (works inside callouts). */
export const linkButton = `inline-flex min-h-6 items-center rounded-sm font-medium underline decoration-1 underline-offset-4 hover:decoration-2 ${focusRing}`;

/** A standalone link: mineral teal, underlined, a thicker underline on hover. */
export const link = `inline-flex min-h-6 items-center rounded-sm font-medium text-accent underline decoration-accent/40 decoration-1 underline-offset-4 hover:decoration-accent ${focusRing}`;

/** Text inputs, read-only copy fields and textareas. The line-strong boundary is ≥ 3:1 on every surface. */
export const field = `block w-full min-w-0 rounded-control border border-line-strong bg-surface-raised px-3 py-2 text-base text-fg placeholder:text-fg-subtle sm:text-label ${focusRing}`;

/** Design and Publish share one composition: controls on the left, the graphic on the right (lg+). */
export const studioGrid = "grid gap-8 lg:grid-cols-[minmax(320px,400px)_1fr] lg:items-start xl:gap-10";
/** The right-hand (preview) column of `studioGrid`; first in the DOM so phones see the graphic first. */
export const studioPreviewColumn = "min-w-0 lg:col-start-2 lg:row-start-1";
/** The left-hand (controls) column of `studioGrid`. */
export const studioControlsColumn = "min-w-0 lg:col-start-1 lg:row-start-1";

/** A raised panel on the canvas (Connect form, disclosures, data view). */
export const panel = "rounded-card border border-line bg-surface";

export const label = "text-label font-medium text-fg";
export const hint = "text-caption text-fg-muted";
/** Small uppercase group heading ("More options"). */
export const overline = "text-overline font-semibold uppercase text-fg-subtle";
/** Account handles, URLs and code. */
export const mono = "font-mono text-code";

/**
 * A label wrapping a visually hidden radio: the selectable card.
 * Default: surface with a hairline. Hover: the hover fill. Selected: a 1px teal border on a
 * faint teal fill (plus `SelectionMark` where a check helps). Disabled: dashed and subtle.
 * Focus is the detached `focusWithin` ring, so it never competes with the selected border.
 */
export function selectableCard(checked: boolean, disabled = false): string {
  const state = disabled
    ? "cursor-not-allowed border-dashed border-line bg-transparent text-fg-subtle"
    : checked
      ? "cursor-pointer border-accent bg-selected text-fg"
      : "cursor-pointer border-line bg-surface text-fg-muted hover:bg-surface-hover hover:text-fg";
  return `relative flex rounded-card border motion-safe:transition-colors ${state} ${focusWithin}`;
}

/** A native <summary>: the one disclosure header (title, optional summary, chevron on the right). */
export const disclosureSummary = `flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-card px-4 py-3 hover:bg-surface-hover motion-safe:transition-colors ${focusRing} [&::-webkit-details-marker]:hidden`;
/** The chevron inside a disclosure summary; turns when its <details class="group"> opens. */
export const disclosureChevron =
  "ml-auto size-4 shrink-0 text-fg-subtle group-open:rotate-180 motion-safe:transition-transform";

export type CalloutTone = "warning" | "danger" | "success" | "neutral";

const CALLOUT_TONES: Record<CalloutTone, string> = {
  warning: "border-warning-line bg-warning-bg text-warning",
  danger: "border-danger-line bg-danger-bg text-danger",
  success: "border-success-line bg-success-bg text-success",
  neutral: "border-line bg-surface text-fg-muted",
};

/** Inline status message box. Always pair the tone with an icon and words, never color alone. */
export function callout(tone: CalloutTone): string {
  return `rounded-card border px-3 py-2.5 text-body ${CALLOUT_TONES[tone]}`;
}
