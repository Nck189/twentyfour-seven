/** Coin (economy): flat, no outline, 3 tones, light from the top-left. Readable at 16–48 px. */
export function Coin({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="13" fill="var(--art-yellow-dark)" />
      <circle cx="15" cy="15" r="12" fill="var(--art-yellow)" />
      <circle cx="15" cy="15" r="7.5" fill="var(--art-yellow-dark)" opacity="0.55" />
      <ellipse
        cx="10.5"
        cy="9.5"
        rx="3.6"
        ry="2.2"
        fill="var(--art-yellow-light)"
        transform="rotate(-35 10.5 9.5)"
      />
    </svg>
  );
}
