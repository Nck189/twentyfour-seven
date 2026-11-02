import type { ReactNode } from "react";

export function ScreenHeader({
  title,
  subtitle,
  level = 1,
  action,
}: {
  title: string;
  subtitle?: string;
  level?: 1 | 2;
  /** Optional control on the right (e.g. a "more" menu button). */
  action?: ReactNode;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-2 lg:px-6">
      <div className="min-w-0">
        <Heading className="text-2xl font-extrabold">{title}</Heading>
        {subtitle && <p className="text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
