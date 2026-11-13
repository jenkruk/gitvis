"use client";

import { Maximize2, X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { button, focusWithin, iconButton } from "@/components/ui/recipes";
import { type ColorMode, GITHUB_SURFACES } from "@/theme/palettes";

/**
 * The one presentation surface for a graphic (Design and Publish). The graphic brings its own
 * frame, so the stage is a flat field with no border of its own. It is always one of GitHub's
 * README pages, light or dark, because that's the only place the graphic lives. Backdrops change
 * only this container, never the configuration or the published image.
 */

export type Backdrop = ColorMode;

/** Phones show just "Light" / "Dark"; wider screens and the accessible name say "GitHub light". */
export const BACKDROPS: readonly { id: Backdrop; prefix: string; label: string }[] = [
  { id: "light", prefix: "GitHub", label: "Light" },
  { id: "dark", prefix: "GitHub", label: "Dark" },
];

/** A graphic starts on the GitHub page for its own mode: where readers with that theme see it. */
export function defaultBackdrop(mode: ColorMode): Backdrop {
  return mode;
}

export function backdropColor(backdrop: Backdrop): string {
  return GITHUB_SURFACES[backdrop][0]!;
}

export function BackdropPicker({ value, onChange }: { value: Backdrop; onChange: (backdrop: Backdrop) => void }) {
  const name = useId();
  return (
    <fieldset className="flex min-w-0 items-center gap-2">
      <legend className="float-left mr-1 text-caption text-fg-muted">Backdrop</legend>
      <div className="inline-flex rounded-control border border-line bg-surface p-0.5">
        {BACKDROPS.map((option) => {
          const checked = value === option.id;
          return (
            <label
              key={option.id}
              className={`flex min-h-8 cursor-pointer items-center rounded-[0.25rem] border px-2.5 text-caption whitespace-nowrap motion-safe:transition-colors ${focusWithin} ${
                checked
                  ? "border-accent bg-selected font-semibold text-fg"
                  : "border-transparent font-medium text-fg-muted hover:bg-surface-hover hover:text-fg"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={checked}
                onChange={() => onChange(option.id)}
                aria-label={`${option.prefix} ${option.label.toLowerCase()}`}
                className="sr-only"
              />
              {/* One inline span: the label is a flex container, which would drop the space between items. */}
              <span>
                <span className="max-sm:sr-only">{option.prefix}</span>{" "}
                <span className="sm:lowercase">{option.label}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function PreviewStage({
  backdrop,
  busy = false,
  children,
}: {
  backdrop: Backdrop;
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      aria-busy={busy}
      data-backdrop={backdrop}
      style={{ background: backdropColor(backdrop) }}
      className="relative rounded-stage p-3 motion-safe:transition-colors sm:p-6"
    >
      {children}
    </div>
  );
}

/** Opens the full-size view (desktop; phones expand the preview in place instead). */
export function FullSizeButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${button("ghost", "sm")} px-2 max-lg:hidden`}>
      <Maximize2 aria-hidden="true" className="size-4" />
      View full size
    </button>
  );
}

/**
 * The graphic at its published size in a modal dialog: tall multi-year graphics stay fully
 * inspectable without nested scrolling in the page. Esc, the close button or a click on the
 * dimmed backdrop closes it, and focus returns to the button that opened it.
 */
export function FullSizeDialog({
  open,
  onClose,
  backdrop,
  children,
}: {
  open: boolean;
  onClose: () => void;
  backdrop: Backdrop;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal?.();
    if (!open && el.open) el.close?.();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(56rem,calc(100vw-2rem))] max-w-none overflow-y-auto overscroll-contain rounded-stage border border-line bg-surface p-0 text-fg shadow-raised backdrop:bg-[rgb(8_12_16/0.6)]"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5">
        <h2 id={titleId} className="text-label font-semibold">
          Full-size preview
        </h2>
        <button type="button" onClick={onClose} aria-label="Close full-size preview" className={iconButton}>
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div className="p-4 sm:p-6">
        <PreviewStage backdrop={backdrop}>{open ? children : null}</PreviewStage>
      </div>
    </dialog>
  );
}
