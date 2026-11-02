export function ScreenHeader({
  title,
  subtitle,
  level = 1,
}: {
  title: string;
  subtitle?: string;
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <header className="px-4 pt-4 pb-2 lg:px-6">
      <Heading className="text-2xl font-extrabold">{title}</Heading>
      {subtitle && <p className="text-muted">{subtitle}</p>}
    </header>
  );
}
