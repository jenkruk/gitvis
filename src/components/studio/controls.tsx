import { Check, ChevronDown } from "lucide-react";
import { type ReactNode, useId, useRef } from "react";
import { disclosureChevron, disclosureSummary, focusWithin, hint, selectableCard } from "@/components/ui/recipes";

export function ControlGroup({
  legend,
  description,
  children,
}: {
  legend: string;
  description?: string;
  children: ReactNode;
}) {
  const descriptionId = useId();
  return (
    <fieldset className="min-w-0" aria-describedby={description ? descriptionId : undefined}>
      <legend className="text-section font-semibold text-fg">{legend}</legend>
      {description && (
        <p id={descriptionId} className={`mt-0.5 ${hint}`}>
          {description}
        </p>
      )}
      <div className="mt-2.5">{children}</div>
    </fieldset>
  );
}

/** The small teal check in a selected card's corner: a second, non-color cue for selection. */
export function SelectionMark({ checked, inline = false }: { checked: boolean; inline?: boolean }) {
  if (!checked) return null;
  return (
    <span
      aria-hidden="true"
      className={`flex size-4 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg ${
        inline ? "" : "absolute top-2 right-2"
      }`}
    >
      <Check className="size-3" strokeWidth={3} />
    </span>
  );
}

export function RadioCard({
  name,
  value,
  checked,
  onSelect,
  children,
  className = "",
  disabled = false,
  mark = false,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: (value: string) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  /** Show the corner check when selected (cards with a title); segmented options use weight instead. */
  mark?: boolean;
}) {
  return (
    <label className={`${selectableCard(checked, disabled)} p-3 ${className}`}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      {children}
      {mark && <SelectionMark checked={checked} />}
    </label>
  );
}

/**
 * A segmented option's label: semibold when selected, so the state never rests on color alone.
 * Its color comes from the card (muted when unselected, subtle when disabled).
 */
export function SegmentLabel({ checked, children }: { checked: boolean; children: ReactNode }) {
  return <span className={`text-label ${checked ? "font-semibold" : "font-medium"}`}>{children}</span>;
}

export function Switch({
  label,
  description,
  checked,
  onChange,
  note,
  id,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  note?: string;
}) {
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start justify-between gap-4 rounded-control py-2.5 ${focusWithin}`}
    >
      <span className="min-w-0">
        <span id={labelId} className="block text-label font-medium text-fg">
          {label}
        </span>
        <span id={descriptionId} className={`mt-0.5 block ${hint}`}>
          {description}
          {note && <span className="mt-0.5 block font-medium text-warning">{note}</span>}
        </span>
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      {/* Off: a line-strong track (≥ 3:1) with a light thumb. On: a teal track, thumb moved right. */}
      <span
        aria-hidden="true"
        className="relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-line-strong peer-checked:bg-accent motion-safe:transition-colors [&>span]:translate-x-0.5 [&>span]:bg-thumb peer-checked:[&>span]:translate-x-4.5 peer-checked:[&>span]:bg-thumb-on"
      >
        <span className="size-4 rounded-full shadow-sm motion-safe:transition-transform" />
      </span>
    </label>
  );
}

/**
 * A collapsible section (native <details>/<summary>), with a one-line summary of its current
 * state that stays visible when collapsed. Disclosures sharing a `name` form a native
 * single-open accordion: opening one closes the others, and any can be closed. Content stays
 * mounted, so closing never loses a setting.
 *
 * When a section above closes, the clicked header would jump up; browsers with scroll
 * anchoring keep it in place, and the toggle handler does the same where they don't.
 */
export function Disclosure({
  title,
  summary,
  children,
  defaultOpen = false,
  name,
}: {
  title: string;
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  name?: string;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const anchor = useRef<number | null>(null);

  function holdPosition() {
    const before = anchor.current;
    anchor.current = null;
    const el = details.current;
    if (before === null || !el?.open) return;
    const delta = el.getBoundingClientRect().top - before;
    if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: "instant" });
  }

  return (
    <details
      ref={details}
      name={name}
      open={defaultOpen || undefined}
      onToggle={holdPosition}
      className="group rounded-card border border-line bg-surface open:bg-surface-raised"
    >
      <summary
        onClick={() => {
          anchor.current = details.current?.getBoundingClientRect().top ?? null;
        }}
        className={`${disclosureSummary} group-open:rounded-b-none`}
      >
        <span className="text-label font-semibold text-fg">{title}</span>
        {summary && <span className="min-w-0 flex-1 truncate text-caption text-fg-muted">{summary}</span>}
        <ChevronDown aria-hidden="true" className={disclosureChevron} />
      </summary>
      <div className="space-y-6 border-t border-line px-4 pt-5 pb-5">{children}</div>
    </details>
  );
}
