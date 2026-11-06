import { Check } from "lucide-react";

export const STEP_IDS = ["connect", "design", "publish"] as const;
export type StepId = (typeof STEP_IDS)[number];

export const STEP_LABELS: Record<StepId, string> = {
  connect: "Connect",
  design: "Design",
  publish: "Publish",
};

export function isStepId(value: string): value is StepId {
  return (STEP_IDS as readonly string[]).includes(value);
}

interface StepNavProps {
  active: StepId;
  /** Steps the user may open right now (completed or currently reachable). */
  available: Record<StepId, boolean>;
  onSelect: (step: StepId) => void;
}

/**
 * Progress through Connect → Design → Publish. Each step is a real button:
 * reachable steps can be revisited, unreachable ones are disabled, and the
 * current one carries aria-current="step".
 */
export function StepNav({ active, available, onSelect }: StepNavProps) {
  const activeIndex = STEP_IDS.indexOf(active);
  return (
    <nav aria-label="Progress">
      <ol className="flex items-center gap-1 sm:gap-2">
        {STEP_IDS.map((id, index) => {
          const current = id === active;
          const done = index < activeIndex && available[id];
          return (
            <li key={id} className="flex min-w-0 items-center gap-1 sm:gap-2">
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={`h-px w-4 shrink-0 sm:w-10 ${
                    index <= activeIndex ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-300 dark:bg-zinc-700"
                  }`}
                />
              )}
              <button
                type="button"
                onClick={() => onSelect(id)}
                disabled={!available[id]}
                aria-current={current ? "step" : undefined}
                className={`group flex min-h-11 min-w-0 items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed motion-safe:transition-colors dark:focus-visible:outline-blue-400 ${
                  current
                    ? "font-semibold text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-700 enabled:hover:bg-zinc-100 disabled:text-zinc-500 dark:text-zinc-300 dark:enabled:hover:bg-zinc-800 dark:disabled:text-zinc-500"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums ${
                    current
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : done
                        ? "border-emerald-700 bg-emerald-700 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-zinc-950"
                        : "border-zinc-400 dark:border-zinc-600"
                  }`}
                >
                  {done ? <Check className="size-4" /> : index + 1}
                </span>
                <span className="truncate">
                  <span className="sr-only">Step {index + 1}: </span>
                  {STEP_LABELS[id]}
                  {done && <span className="sr-only"> (completed)</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
