import { Check } from "lucide-react";
import { focusRing } from "@/components/ui/recipes";

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
  available: Record<StepId, boolean>;
  onSelect: (step: StepId) => void;
}

export function StepNav({ active, available, onSelect }: StepNavProps) {
  const activeIndex = STEP_IDS.indexOf(active);
  return (
    <nav aria-label="Progress">
      <ol className="flex items-center gap-0.5 sm:gap-2">
        {STEP_IDS.map((id, index) => {
          const current = id === active;
          const done = index < activeIndex && available[id];
          return (
            <li key={id} className="flex items-center gap-0.5 sm:gap-2">
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={`h-px w-3 shrink-0 max-[359px]:hidden sm:w-10 ${
                    index <= activeIndex ? "bg-accent" : "bg-line"
                  }`}
                />
              )}
              <button
                type="button"
                onClick={() => onSelect(id)}
                disabled={!available[id]}
                aria-current={current ? "step" : undefined}
                className={`group flex min-h-11 items-center gap-1.5 rounded-full py-1.5 pr-2 pl-1 text-caption sm:gap-2 sm:pr-3 sm:pl-1.5 sm:text-label disabled:cursor-not-allowed motion-safe:transition-colors ${focusRing} ${
                  current
                    ? "font-semibold text-fg"
                    : "font-medium text-fg-muted enabled:hover:bg-surface-hover enabled:hover:text-fg disabled:text-fg-subtle"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-overline font-semibold tabular-nums sm:size-7 ${
                    current
                      ? "border-accent bg-accent text-accent-fg"
                      : done
                        ? "border-accent bg-selected text-accent"
                        : "border-line-strong bg-surface"
                  }`}
                >
                  {done ? <Check className="size-4" /> : index + 1}
                </span>
                <span className="whitespace-nowrap">
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
