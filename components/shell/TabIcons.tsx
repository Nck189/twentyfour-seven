/** Flat, filled UI icons (currentColor). Same rounded vocabulary as the art set. */
type P = { className?: string };

export function SunIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="5" fill="currentColor" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <rect
          key={a}
          x="11"
          y="1.5"
          width="2"
          height="4"
          rx="1"
          fill="currentColor"
          transform={`rotate(${a} 12 12)`}
        />
      ))}
    </svg>
  );
}
export function CalendarIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="4" fill="currentColor" opacity="0.35" />
      <rect x="3" y="5" width="18" height="6" rx="3" fill="currentColor" />
      <rect x="7" y="2.5" width="2.5" height="5" rx="1.25" fill="currentColor" />
      <rect x="14.5" y="2.5" width="2.5" height="5" rx="1.25" fill="currentColor" />
      <rect x="7" y="14" width="4" height="4" rx="1.2" fill="currentColor" />
    </svg>
  );
}
export function SproutIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3" y="17" width="18" height="5" rx="2.5" fill="currentColor" opacity="0.35" />
      <rect x="11" y="9" width="2" height="9" rx="1" fill="currentColor" />
      <ellipse cx="7.5" cy="10" rx="4.5" ry="2.6" fill="currentColor" transform="rotate(-25 7.5 10)" />
      <ellipse cx="16.5" cy="8.5" rx="4.5" ry="2.6" fill="currentColor" transform="rotate(25 16.5 8.5)" />
    </svg>
  );
}
export function BarsIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3" y="12" width="4.5" height="9" rx="2" fill="currentColor" opacity="0.35" />
      <rect x="9.75" y="7" width="4.5" height="14" rx="2" fill="currentColor" />
      <rect x="16.5" y="3" width="4.5" height="18" rx="2" fill="currentColor" opacity="0.6" />
    </svg>
  );
}
export function DotsIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="5" cy="12" r="2.5" fill="currentColor" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      <circle cx="19" cy="12" r="2.5" fill="currentColor" />
    </svg>
  );
}
