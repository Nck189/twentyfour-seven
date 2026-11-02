"use client";

/** Large tappable check row (≥ 44px), flat style, no outlines. */
export function CheckRow({
  checked,
  label,
  onToggle,
  emphasis = false,
  disabled = false,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
  emphasis?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      disabled={disabled}
      className={`tap flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left ${
        emphasis ? "bg-warn-soft" : "bg-surface-2"
      } disabled:opacity-60`}
    >
      <span
        aria-hidden="true"
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
          checked ? "bg-primary text-on-primary" : "bg-surface"
        }`}
      >
        {checked && (
          <svg viewBox="0 0 16 16" className="h-4 w-4">
            <rect
              x="2.5"
              y="7.5"
              width="5"
              height="2.4"
              rx="1.2"
              transform="rotate(45 5 8.7)"
              fill="currentColor"
            />
            <rect
              x="5"
              y="6.6"
              width="9"
              height="2.4"
              rx="1.2"
              transform="rotate(-50 9.5 7.8)"
              fill="currentColor"
            />
          </svg>
        )}
      </span>
      <span className={`flex-1 ${checked ? "text-muted line-through" : "font-bold"}`}>{label}</span>
    </button>
  );
}
