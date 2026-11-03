/**
 * The farm sky (SPEC §8.9): follows the current block — Down = dusk, Sleep = stars,
 * Wake = sunrise, daytime blocks = day. The only place gradients are allowed.
 * A gradient band of any width; the sun/moon and clouds keep their size, anchored to the edges
 * and kept in the top part (the field covers the bottom of the band).
 */
import type { SkyPhase } from "@/lib/farm/sky";

export type { SkyPhase };

const STARS: [number, number, number][] = [
  [30, 10, 1.4],
  [70, 26, 1],
  [110, 8, 1.6],
  [160, 22, 1.1],
  [205, 6, 1.3],
  [250, 28, 1],
  [290, 12, 1.5],
  [340, 24, 1.1],
  [372, 6, 1.3],
  [140, 34, 0.9],
];

export function FarmSky({ phase, className = "" }: { phase: SkyPhase; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`overflow-hidden ${className.includes("absolute") ? "" : "relative"} ${className}`}
      style={{ background: `linear-gradient(var(--sky-${phase}-top), var(--sky-${phase}-bottom))` }}
    >
      {phase === "night" && (
        <svg
          viewBox="0 0 390 70"
          preserveAspectRatio="xMidYMin slice"
          className="absolute inset-0 h-full w-full"
        >
          {STARS.map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="var(--sky-star)" />
          ))}
        </svg>
      )}
      {/* Sun / moon top right; the setting sun at dusk sits low on the left. */}
      <svg
        viewBox="0 0 80 70"
        preserveAspectRatio="xMaxYMin meet"
        className={`absolute top-0 h-full ${phase === "dusk" ? "left-[4%]" : "right-[4%]"}`}
      >
        {phase === "day" && <circle cx={46} cy={24} r={13} fill="var(--art-sun)" />}
        {phase === "sunrise" && <circle cx={40} cy={40} r={16} fill="var(--art-sun)" />}
        {phase === "dusk" && <circle cx={40} cy={40} r={15} fill="var(--art-orange-light)" />}
        {phase === "night" && (
          <g>
            <circle cx={46} cy={22} r={11} fill="var(--sky-moon)" />
            <circle cx={51} cy={18} r={9.5} fill="var(--sky-night-top)" />
          </g>
        )}
      </svg>
      {(phase === "day" || phase === "sunrise") && (
        <svg
          viewBox="0 0 160 70"
          preserveAspectRatio="xMinYMin meet"
          className="absolute top-0 left-[6%] h-full"
        >
          <ellipse
            cx={40}
            cy={26}
            rx={20}
            ry={7.5}
            fill="var(--art-cloud)"
            opacity={phase === "day" ? 1 : 0.85}
          />
          <ellipse
            cx={54}
            cy={20}
            rx={12}
            ry={7.5}
            fill="var(--art-cloud)"
            opacity={phase === "day" ? 1 : 0.85}
          />
          <ellipse cx={128} cy={34} rx={14} ry={5} fill="var(--art-cloud)" opacity={0.8} />
        </svg>
      )}
    </div>
  );
}
