import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const styles: Record<Variant, string> = {
  primary: "bg-primary text-on-primary",
  secondary: "bg-surface-2 text-ink",
  ghost: "bg-transparent text-primary",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`tap inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl px-4 text-base font-bold disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
