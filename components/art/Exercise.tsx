/**
 * Exercise type pictures (SPEC §6): gym, run, walk, other. Flat, no outlines, 2–3 tones,
 * light from the top-left, a flat shadow. Readable at 32–48 px.
 */
import type { ExerciseType } from "@/content/animals";
import { Art, Shadow, Sparkle, TONES } from "./farm/parts";

export function ExerciseArt({ type, className = "h-10 w-10" }: { type: ExerciseType; className?: string }) {
  return (
    <Art className={className}>
      <Shadow rx={13} />
      {type === "gym" && (
        <g>
          <rect x={14} y={22.5} width={20} height={3} rx={1.5} fill="var(--art-silver-dark)" />
          {[9, 36].map((x) => (
            <g key={x}>
              <rect x={x} y={15} width={4} height={18} rx={2} fill={TONES.blue.dark} />
              <rect x={x} y={15} width={3.4} height={17} rx={1.7} fill={TONES.blue.base} />
            </g>
          ))}
          {[13, 32].map((x) => (
            <rect key={x} x={x} y={18} width={3} height={12} rx={1.5} fill={TONES.blue.dark} />
          ))}
          <rect x={10} y={16.5} width={1.4} height={6} rx={0.7} fill={TONES.blue.light} />
        </g>
      )}
      {type === "run" && (
        <g>
          {/* a sneaker */}
          <path d="M9 34 Q9 26 15 24 L22 22 Q26 27 32 28 Q39 29 40 34 Z" fill={TONES.red.dark} />
          <path
            d="M9.6 33 Q9.6 25.8 15 24.6 L21.6 23 Q25.6 27.6 31.6 28.6 Q38 29.6 39 33 Z"
            fill={TONES.red.base}
          />
          <rect x={8} y={33} width={33} height={4} rx={2} fill="var(--art-white)" />
          <rect x={8} y={35.5} width={33} height={1.5} rx={0.75} fill="var(--art-stone-dark)" />
          <ellipse cx={14} cy={27} rx={2.6} ry={1.3} fill={TONES.red.light} transform="rotate(-25 14 27)" />
          <rect
            x={19}
            y={25}
            width={6}
            height={1.4}
            rx={0.7}
            fill="var(--art-white)"
            transform="rotate(-20 22 25.7)"
          />
          <rect
            x={21}
            y={27.5}
            width={6}
            height={1.4}
            rx={0.7}
            fill="var(--art-white)"
            transform="rotate(-20 24 28.2)"
          />
        </g>
      )}
      {type === "walk" && (
        <g>
          {/* two footprints stepping up-right */}
          {[
            [16, 31, -15],
            [30, 20, 15],
          ].map(([x, y, rot]) => (
            <g key={`${x}`} transform={`rotate(${rot} ${x} ${y})`}>
              <ellipse cx={x} cy={y} rx={4.2} ry={6.2} fill={TONES.leaf.dark} />
              <ellipse cx={x! - 0.4} cy={y! - 0.4} rx={3.8} ry={5.8} fill={TONES.leaf.base} />
              {[-2.6, -0.8, 1, 2.8].map((dx, i) => (
                <circle
                  key={dx}
                  cx={x! + dx}
                  cy={y! - 7.6 + Math.abs(i - 1.5) * 0.6}
                  r={1.05}
                  fill={TONES.leaf.base}
                />
              ))}
              <ellipse cx={x! - 1.6} cy={y! - 2.6} rx={1.2} ry={0.7} fill={TONES.leaf.light} />
            </g>
          ))}
        </g>
      )}
      {type === "other" && (
        <g>
          <circle cx={24.5} cy={25.5} r={11} fill={TONES.yellow.dark} />
          <circle cx={24} cy={25} r={10.4} fill={TONES.yellow.base} />
          <Sparkle cx={24} cy={25} r={6} fill="var(--art-white)" />
          <ellipse
            cx={19}
            cy={19}
            rx={2.4}
            ry={1.3}
            fill={TONES.yellow.light}
            transform="rotate(-35 19 19)"
          />
        </g>
      )}
    </Art>
  );
}
