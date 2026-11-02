"use client";

/** Single-choice segmented control (radiogroup). Selected = soft green fill + green ring, visible in both themes. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  compact = false,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  compact?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-xl bg-surface-2 p-1">
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`tap min-h-11 min-w-11 flex-1 rounded-lg font-bold ${compact ? "px-2 text-sm" : "px-3"} ${
              selected ? "bg-primary-soft text-primary ring-2 ring-primary ring-inset" : "text-muted"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
