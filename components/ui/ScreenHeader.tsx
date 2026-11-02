export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="px-4 pt-4 pb-2 lg:px-6">
      <h1 className="text-2xl font-extrabold">{title}</h1>
      {subtitle && <p className="text-muted">{subtitle}</p>}
    </header>
  );
}
