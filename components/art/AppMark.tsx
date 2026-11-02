/** App mark: a sprout on a soil bed, in the style of design/reference-style-a.svg. */
export function AppMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="0" y="0" width="64" height="64" rx="16" fill="var(--art-cream)" />
      <circle cx="49" cy="15" r="7" fill="var(--art-sun)" />
      <rect x="8" y="42" width="48" height="14" rx="5" fill="var(--art-soil)" />
      <rect x="8" y="42" width="48" height="4" rx="2" fill="var(--art-soil-light)" />
      <ellipse cx="32" cy="45" rx="9" ry="2" fill="var(--art-soil-dark)" />
      <rect x="30.5" y="26" width="3" height="19" rx="1.5" fill="var(--art-stem)" />
      <ellipse cx="24" cy="29" rx="8" ry="4.5" fill="var(--art-leaf-1)" transform="rotate(-25 24 29)" />
      <ellipse cx="40" cy="26" rx="8" ry="4.5" fill="var(--art-leaf-3)" transform="rotate(25 40 26)" />
      <circle cx="32" cy="24" r="3" fill="var(--art-leaf-light)" />
    </svg>
  );
}
