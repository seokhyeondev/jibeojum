"use client";

import { Check } from "lucide-react";
import type { Choice } from "@zipazum/shared";

type Layout = "grid" | "wrap";

interface SingleProps<T extends string | number> {
  label: string;
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  layout?: Layout;
}

/** 하나만 고르는 칩 묶음 (라디오 그룹) */
export function SingleChips<T extends string | number>({ label, choices, value, onChange, layout = "grid" }: SingleProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={layout === "wrap" ? "tags" : choices.length === 3 ? "choices three" : "choices"}
    >
      {choices.map((choice) => (
        <button
          type="button"
          role="radio"
          aria-checked={choice.value === value}
          className={choice.value === value ? "on" : ""}
          onClick={() => onChange(choice.value)}
          key={String(choice.value)}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}

interface MultiProps<T extends string> {
  label: string;
  choices: Choice<T>[];
  values: T[];
  onChange: (values: T[]) => void;
}

/** 여러 개를 고르는 칩 묶음. 같은 값은 중복으로 담기지 않는다. */
export function MultiChips<T extends string>({ label, choices, values, onChange }: MultiProps<T>) {
  const toggle = (value: T) =>
    onChange(values.includes(value) ? values.filter((x) => x !== value) : [...values, value]);
  return (
    <div role="group" aria-label={label} className="tags">
      {choices.map((choice) => {
        const on = values.includes(choice.value);
        return (
          <button
            type="button"
            aria-pressed={on}
            className={on ? "on" : ""}
            onClick={() => toggle(choice.value)}
            key={choice.value}
            title={choice.description}
          >
            {on && <Check aria-hidden />}
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
