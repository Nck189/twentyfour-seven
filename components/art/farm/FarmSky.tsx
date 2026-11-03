/**
 * The farm sky (SPEC §8.9): follows the current block — Down = dusk, Sleep = stars,
 * Wake = sunrise, daytime blocks = day. The only place gradients are allowed.
 */
import { useId } from "react";

export type SkyPhase = "day" | "sunrise" | "dusk" | "night";

const STARS: [number, number, number][] = [
  [30, 18, 1.4],
  [70, 40, 1],
  [110, 14, 1.6],
  [160, 34, 1.1],
  [205, 12, 1.3],
  [250, 44, 1],
  [290, 20, 1.5],
  [340, 36, 1.1],
  [372, 12, 1.3],
  [140, 60, 0.9],
  [318, 64, 0.9],
];

export function FarmSky({ phase, className }: { phase: SkyPhase; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 390 140" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`var(--sky-${phase}-top)`} />
          <stop offset="1" stopColor={`var(--sky-${phase}-bottom)`} />
        </linearGradient>
      </defs>
      <rect width="390" height="140" fill={`url(#sky${id})`} />
      {phase === "night" &&
        STARS.map(([x, y, r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="var(--sky-star)" />)}
      {phase === "night" && (
        <g>
          <circle cx={320} cy={58} r={15} fill="var(--sky-moon)" />
          <circle cx={327} cy={53} r={13} fill="var(--sky-night-top)" />
        </g>
      )}
      {phase === "day" && (
        <g>
          <circle cx={330} cy={58} r={18} fill="var(--art-sun)" />
          <ellipse cx={80} cy={62} rx={26} ry={10} fill="var(--art-cloud)" />
          <ellipse cx={98} cy={55} rx={16} ry={10} fill="var(--art-cloud)" />
          <ellipse cx={220} cy={78} rx={20} ry={7} fill="var(--art-cloud)" opacity={0.85} />
        </g>
      )}
      {phase === "sunrise" && (
        <g>
          <circle cx={300} cy={118} r={24} fill="var(--art-sun)" />
          <ellipse cx={120} cy={62} rx={24} ry={8} fill="var(--art-cloud)" opacity={0.9} />
        </g>
      )}
      {phase === "dusk" && (
        <g>
          <circle cx={70} cy={112} r={20} fill="var(--art-orange-light)" />
          <circle cx={300} cy={30} r={1.2} fill="var(--sky-star)" />
          <circle cx={340} cy={50} r={1} fill="var(--sky-star)" />
        </g>
      )}
    </svg>
  );
}
