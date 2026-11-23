/**
 * Yard visitors (docs/FARM_YARD_PLAN.md): a butterfly and a small bird, flat, no outlines, tokens
 * only, light from the top-left. Readable at 16–24 px; they drift slowly (CSS `visitor-drift`),
 * and stand still under reduced motion.
 */
export function ButterflyArt({
  className = "h-5 w-5",
  tint = "pink",
}: {
  className?: string;
  tint?: "pink" | "sun";
}) {
  const [base, dark] =
    tint === "pink"
      ? ["var(--art-pink-light)", "var(--art-pink)"]
      : ["var(--art-yellow-light)", "var(--art-sun)"];
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <ellipse cx="7.5" cy="9" rx="5" ry="6" fill={base} transform="rotate(-20 7.5 9)" />
      <ellipse cx="16.5" cy="9" rx="5" ry="6" fill={base} transform="rotate(20 16.5 9)" />
      <ellipse cx="8.5" cy="16.5" rx="3.2" ry="3.8" fill={dark} transform="rotate(20 8.5 16.5)" />
      <ellipse cx="15.5" cy="16.5" rx="3.2" ry="3.8" fill={dark} transform="rotate(-20 15.5 16.5)" />
      <rect x="11.2" y="6" width="1.6" height="13" rx="0.8" fill="var(--art-soil-dark)" />
      <ellipse cx="6" cy="7.5" rx="1.6" ry="1.1" fill="var(--art-white)" opacity="0.55" />
    </svg>
  );
}

export function BirdArt({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <ellipse cx="12" cy="14" rx="7.5" ry="6" fill="var(--art-blue-light)" />
      <ellipse cx="13.5" cy="15.5" rx="4.5" ry="3.2" fill="var(--art-blue)" />
      <circle cx="17" cy="9.5" r="4" fill="var(--art-blue-light)" />
      <path d="M20.4 9.2 L23 10.2 L20.4 11.1 Z" fill="var(--art-orange)" />
      <circle cx="18" cy="8.8" r="0.9" fill="var(--art-soil-deep)" />
      <ellipse cx="9" cy="11" rx="2.4" ry="1.4" fill="var(--art-white)" opacity="0.5" />
    </svg>
  );
}
