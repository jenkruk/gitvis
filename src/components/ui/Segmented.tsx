"use client";

import { type ReactNode, useId } from "react";
import { focusWithin } from "./recipes";

export interface SegmentedOption<T extends string> {
  id: T;
  label: ReactNode;
  name: string;
}

export function Segmented<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="flex min-w-0 items-center gap-2">
      <legend className="float-left mr-1 text-caption text-fg-muted">{legend}</legend>
      <div className="inline-flex rounded-control border border-line bg-surface p-0.5">
        {options.map((option) => {
          const checked = value === option.id;
          return (
            <label
              key={option.id}
              title={option.name}
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
                aria-label={option.name}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
