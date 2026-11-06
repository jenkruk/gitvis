import { ChevronDown } from "lucide-react";
import { type ReactNode, useId } from "react";

/**
 * Native form controls styled with Tailwind. Native radios and checkboxes give
 * us keyboard support (Tab / arrows / Space) and correct screen-reader
 * semantics without custom ARIA widgets.
 */

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
    // The description is linked so screen readers announce it on entering the group (e.g. why options are disabled).
    <fieldset className="min-w-0" aria-describedby={description ? descriptionId : undefined}>
      <legend className="text-sm font-semibold">{legend}</legend>
      {description && (
        <p id={descriptionId} className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
      )}
      <div className="mt-3">{children}</div>
    </fieldset>
  );
}

const focusRing =
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue-600 dark:has-focus-visible:outline-blue-400";

export function RadioCard({
  name,
  value,
  checked,
  onSelect,
  children,
  className = "",
  disabled = false,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: (value: string) => void;
  children: ReactNode;
  className?: string;
  /** Native disabled radio; explain why in the group's description. */
  disabled?: boolean;
}) {
  return (
    <label
      className={`relative flex rounded-lg border bg-white p-3 motion-safe:transition-colors dark:bg-zinc-900 ${
        disabled
          ? "cursor-not-allowed border-dashed border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
          : checked
            ? "cursor-pointer border-zinc-900 ring-1 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100"
            : "cursor-pointer border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
      } ${focusRing} ${className}`}
    >
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
    </label>
  );
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
  /** Explains why an enabled feature isn't currently rendered. */
  note?: string;
}) {
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;
  return (
    // The whole row is the click target; aria-labelledby keeps the accessible name to the label text only.
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start justify-between gap-4 rounded-md py-2 ${focusRing}`}
    >
      <span className="min-w-0">
        <span id={labelId} className="block text-sm font-medium">
          {label}
        </span>
        <span id={descriptionId} className="block text-xs text-zinc-600 dark:text-zinc-400">
          {description}
          {note && <span className="mt-0.5 block font-medium text-amber-700 dark:text-amber-400">{note}</span>}
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
      <span
        aria-hidden="true"
        className="relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-zinc-300 peer-checked:bg-zinc-900 motion-safe:transition-colors dark:bg-zinc-700 dark:peer-checked:bg-zinc-100 [&>span]:translate-x-0.5 peer-checked:[&>span]:translate-x-4.5"
      >
        <span className="size-4 rounded-full bg-white shadow-sm motion-safe:transition-transform dark:bg-zinc-900" />
      </span>
    </label>
  );
}

/**
 * A collapsed section built on native <details>/<summary>: keyboard (Enter /
 * Space), expanded state and screen-reader semantics come for free.
 */
export function Disclosure({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  /** Short current-state hint shown beside the title, e.g. "Dark · Solid". */
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      // Uncontrolled: the browser owns the open state, so a section opened before hydration stays open.
      open={defaultOpen || undefined}
      className="group rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400 [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-semibold">{title}</span>
        {summary && <span className="min-w-0 flex-1 truncate text-xs text-zinc-600 dark:text-zinc-400">{summary}</span>}
        <ChevronDown
          aria-hidden="true"
          className="ml-auto size-4 shrink-0 text-zinc-500 group-open:rotate-180 motion-safe:transition-transform"
        />
      </summary>
      <div className="space-y-6 border-t border-zinc-200 px-4 pt-4 pb-5 dark:border-zinc-800">{children}</div>
    </details>
  );
}
