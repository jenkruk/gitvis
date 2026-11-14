"use client";

import { Maximize2, X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { button, iconButton } from "@/components/ui/recipes";
import { Segmented } from "@/components/ui/Segmented";
import { type ColorMode, GITHUB_SURFACES } from "@/theme/palettes";

export type Backdrop = ColorMode;

export const BACKDROPS: readonly { id: Backdrop; prefix: string; label: string }[] = [
  { id: "light", prefix: "GitHub", label: "Light" },
  { id: "dark", prefix: "GitHub", label: "Dark" },
];

export function defaultBackdrop(mode: ColorMode): Backdrop {
  return mode;
}

export function backdropColor(backdrop: Backdrop): string {
  return GITHUB_SURFACES[backdrop][0]!;
}

export function BackdropPicker({ value, onChange }: { value: Backdrop; onChange: (backdrop: Backdrop) => void }) {
  return (
    <Segmented
      legend="Backdrop"
      value={value}
      onChange={onChange}
      options={BACKDROPS.map((option) => ({
        id: option.id,
        name: `${option.prefix} ${option.label.toLowerCase()}`,
        // One inline span: the label is a flex container, which would drop the space between items.
        label: (
          <span>
            <span className="max-sm:sr-only">{option.prefix}</span> <span className="sm:lowercase">{option.label}</span>
          </span>
        ),
      }))}
    />
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

export function FullSizeButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${button("ghost", "sm")} px-2 max-lg:hidden`}>
      <Maximize2 aria-hidden="true" className="size-4" />
      View full size
    </button>
  );
}

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
