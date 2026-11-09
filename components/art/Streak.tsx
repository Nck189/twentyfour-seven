/**
 * Streak art (SPEC §8.7): a little sun (the streak) and the scarecrow (a freeze). Flat, no
 * outlines, 2–3 tones, light from the top-left. Readable at 20–48 px.
 */
import { Art, Shadow, TONES } from "./farm/parts";

export function StreakSun({ className = "h-6 w-6", dim = false }: { className?: string; dim?: boolean }) {
  const tone = dim ? TONES.stone : TONES.yellow;
  return (
    <Art className={className}>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return (
          <ellipse
            key={i}
            cx={24 + Math.cos(a) * 16}
            cy={24 + Math.sin(a) * 16}
            rx={2.6}
            ry={4.4}
            fill={tone.dark}
            transform={`rotate(${(i * 45 + 90) % 360} ${24 + Math.cos(a) * 16} ${24 + Math.sin(a) * 16})`}
          />
        );
      })}
      <circle cx={24.6} cy={24.6} r={11} fill={tone.dark} />
      <circle cx={24} cy={24} r={10.4} fill={tone.base} />
      <ellipse cx={19.5} cy={19.5} rx={3.2} ry={1.9} fill={tone.light} transform="rotate(-35 19.5 19.5)" />
    </Art>
  );
}

/** The scarecrow: keeps a streak alive on a missed day. `used` = a soft silhouette. */
export function ScarecrowArt({
  className = "h-10 w-10",
  used = false,
}: {
  className?: string;
  used?: boolean;
}) {
  const op = used ? 0.35 : 1;
  return (
    <Art className={className}>
      <g opacity={op}>
        <Shadow rx={8} />
        <rect x={22.6} y={18} width={3} height={22} rx={1.5} fill="var(--art-wood-dark)" />
        <rect x={10} y={22} width={28} height={3} rx={1.5} fill="var(--art-wood)" />
        {/* shirt */}
        <path d="M15 22 L33 22 L31 34 L17 34 Z" fill="var(--art-blue-dark)" />
        <path d="M15.6 22 L32.2 22 L30.4 33 L17.4 33 Z" fill="var(--art-blue)" />
        <rect x={18} y={26} width={4} height={4} rx={1} fill="var(--art-yellow)" />
        {/* straw hands */}
        <ellipse cx={10.5} cy={23.5} rx={2.4} ry={1.6} fill="var(--art-yellow-dark)" />
        <ellipse cx={37.5} cy={23.5} rx={2.4} ry={1.6} fill="var(--art-yellow-dark)" />
        {/* head + hat */}
        <circle cx={24.4} cy={15.4} r={5.6} fill="var(--art-wood-dark)" />
        <circle cx={24} cy={15} r={5.2} fill="var(--art-wood-light)" />
        <circle cx={22} cy={14.6} r={0.9} fill="var(--art-soil-deep)" />
        <circle cx={26} cy={14.6} r={0.9} fill="var(--art-soil-deep)" />
        <ellipse cx={24} cy={10.4} rx={8.5} ry={2} fill="var(--art-yellow-dark)" />
        <path d="M19 10.4 Q24 2.5 29 10.4 Z" fill="var(--art-yellow)" />
      </g>
    </Art>
  );
}
