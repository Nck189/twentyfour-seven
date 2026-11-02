"use client";

/** Single-choice chips that wrap (radiogroup); each chip ≥ 44 px. */
export function ChipGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`tap min-h-11 min-w-11 rounded-full px-3 text-sm font-bold ${
              selected
                ? "bg-primary-soft text-primary ring-2 ring-primary ring-inset"
                : "bg-surface-2 text-muted"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
