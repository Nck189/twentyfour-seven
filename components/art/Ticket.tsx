/** Sunrise ticket: flat, no outlines, light from the top-left (style reference A). */
export function TicketArt({
  className = "",
  kind = "sunrise",
}: {
  className?: string;
  kind?: "sunrise" | "night";
}) {
  const body = kind === "sunrise" ? "var(--art-yellow)" : "var(--art-purple)";
  const shade = kind === "sunrise" ? "var(--art-yellow-dark)" : "var(--art-purple-dark)";
  const light = kind === "sunrise" ? "var(--art-yellow-light)" : "var(--art-purple-light)";
  return (
    <svg viewBox="0 0 96 64" className={className} aria-hidden="true">
      <ellipse cx="48" cy="60" rx="34" ry="3" fill="var(--art-shadow)" />
      {/* body with side notches */}
      <path
        d="M14 8 h68 a6 6 0 0 1 6 6 v10 a8 8 0 0 0 0 16 v10 a6 6 0 0 1 -6 6 h-68 a6 6 0 0 1 -6 -6 v-10 a8 8 0 0 0 0 -16 v-10 a6 6 0 0 1 6 -6 z"
        fill={body}
      />
      {/* lower shadow band */}
      <path d="M8 44 v6 a6 6 0 0 0 6 6 h68 a6 6 0 0 0 6 -6 v-6 z" fill={shade} />
      {/* top-left highlight */}
      <rect x="16" y="12" width="30" height="4" rx="2" fill={light} />
      {/* perforation */}
      {[16, 24, 32, 40, 48].map((y) => (
        <circle key={y} cx="64" cy={y} r="1.6" fill={shade} />
      ))}
      {kind === "sunrise" ? (
        <>
          <circle cx="36" cy="32" r="9" fill="var(--art-orange)" />
          <circle cx="33.5" cy="29.5" r="3" fill="var(--art-orange-light)" />
          <rect x="22" y="38" width="28" height="4" rx="2" fill="var(--art-soil)" />
        </>
      ) : (
        <>
          <circle cx="36" cy="30" r="9" fill="var(--art-white)" />
          <circle cx="40" cy="27" r="8" fill={body} />
        </>
      )}
      <circle cx="76" cy="32" r="5" fill={light} />
    </svg>
  );
}
