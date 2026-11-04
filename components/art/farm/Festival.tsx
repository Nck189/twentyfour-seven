/**
 * Festival decor (SPEC §8.8): one limited item per festival month. Flat, no outlines, 2–3
 * tones, light from the top-left, a flat shadow — the same parts as the rest of the farm.
 */
import { Art, Ball, Leaf, Shadow, Sparkle, Star5, TONES } from "./parts";

/** January: a little firework burst on a stick. */
export function Fireworks({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <Art className={className}>
      <Shadow rx={6} />
      <rect x={23} y={24} width={2.4} height={16} rx={1.2} fill="var(--art-wood-dark)" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => (
        <ellipse
          key={a}
          cx={24 + Math.cos((a * Math.PI) / 180) * 9}
          cy={16 + Math.sin((a * Math.PI) / 180) * 9}
          rx={1.4}
          ry={3.2}
          fill={i % 2 ? "var(--art-pink)" : "var(--art-yellow)"}
          transform={`rotate(${a + 90} ${24 + Math.cos((a * Math.PI) / 180) * 9} ${16 + Math.sin((a * Math.PI) / 180) * 9})`}
        />
      ))}
      <Sparkle cx={24} cy={16} r={4} fill="var(--art-yellow-dark)" />
      <Sparkle cx={37} cy={7} r={2} fill="var(--art-blue)" />
    </Art>
  );
}

/** February (Lunar New Year): a red paper lantern. */
export function RedLantern({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <Art className={className}>
      <Shadow rx={7} />
      <rect x={23.2} y={4} width={1.6} height={8} rx={0.8} fill="var(--art-wood-dark)" />
      <rect x={19} y={10} width={10} height={3} rx={1.5} fill="var(--art-yellow-dark)" />
      <ellipse cx={24.6} cy={22.6} rx={10.6} ry={9.6} fill={TONES.red.dark} />
      <ellipse cx={24} cy={22} rx={10} ry={9} fill={TONES.red.base} />
      <ellipse cx={24} cy={22} rx={3.6} ry={9} fill={TONES.red.dark} opacity={0.5} />
      <ellipse
        cx={19.5}
        cy={17.5}
        rx={2.6}
        ry={1.4}
        fill={TONES.red.light}
        transform="rotate(-30 19.5 17.5)"
      />
      <rect x={19} y={30.5} width={10} height={3} rx={1.5} fill="var(--art-yellow-dark)" />
      {[21, 24, 27].map((x) => (
        <rect key={x} x={x - 0.7} y={33} width={1.4} height={6} rx={0.7} fill="var(--art-yellow)" />
      ))}
    </Art>
  );
}

/** April (Songkran): a silver water bowl with jasmine floating in it. */
export function WaterBowl({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <Art className={className}>
      <Shadow rx={12} />
      <path d="M9 26 Q24 46 39 26 Z" fill="var(--art-silver-dark)" />
      <path d="M10 26 Q24 44 37.4 26 Z" fill="var(--art-silver)" />
      <ellipse cx={24} cy={26} rx={15} ry={4} fill="var(--art-silver-dark)" />
      <ellipse cx={24} cy={26} rx={13.5} ry={3.2} fill="var(--art-blue-light)" />
      {[18, 24, 30].map((x) => (
        <g key={x}>
          <circle cx={x} cy={25.4} r={1.9} fill="var(--art-white)" />
          <circle cx={x} cy={25.4} r={0.7} fill="var(--art-yellow)" />
        </g>
      ))}
      <ellipse
        cx={15}
        cy={31}
        rx={2.4}
        ry={1.2}
        fill="var(--art-silver-light)"
        transform="rotate(30 15 31)"
      />
    </Art>
  );
}

/** August (Mother's Day): a jasmine garland (phuang malai). */
export function Jasmine({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <Art className={className}>
      <Shadow rx={8} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = Math.PI * 0.15 + (i / 7) * Math.PI * 0.7;
        return (
          <circle
            key={i}
            cx={24 + Math.cos(a) * 11}
            cy={12 + Math.sin(a) * 13}
            r={2.6}
            fill="var(--art-white)"
          />
        );
      })}
      <circle cx={24} cy={27} r={4} fill={TONES.pink.base} />
      <circle cx={23.4} cy={26.4} r={1.4} fill={TONES.pink.light} />
      <Leaf cx={20} cy={33} rx={2} ry={4} rot={20} fill="var(--art-leaf-3)" />
      <Leaf cx={28} cy={33} rx={2} ry={4} rot={-20} fill="var(--art-leaf-4)" />
      <rect x={23.2} y={31} width={1.6} height={8} rx={0.8} fill="var(--art-yellow-dark)" />
    </Art>
  );
}

/** November (Loy Krathong): a banana-leaf float with a flower and a candle. */
export function Krathong({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <Art className={className}>
      <ellipse cx={24} cy={40} rx={16} ry={3} fill="var(--art-blue-light)" />
      <path d="M9 32 Q24 42 39 32 L36 28 L12 28 Z" fill="var(--art-leaf-4)" />
      {[13, 18, 23, 28, 33].map((x) => (
        <path
          key={x}
          d={`M${x - 2.6} 29 L${x} 22 L${x + 2.6} 29 Z`}
          fill={x % 2 ? "var(--art-leaf-2)" : "var(--art-leaf-3)"}
        />
      ))}
      <Ball cx={24} cy={23} r={4.4} tone={TONES.pink} />
      <rect x={28.6} y={12} width={2.4} height={10} rx={1.2} fill="var(--art-cream)" />
      <ellipse cx={29.8} cy={10.4} rx={1.4} ry={2.4} fill="var(--art-yellow)" />
      <rect x={17} y={14} width={1.4} height={9} rx={0.7} fill="var(--art-wood)" />
    </Art>
  );
}

/** December: a small pine with a star and lights. */
export function StarTree({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <Art className={className}>
      <Shadow rx={9} />
      <rect x={22} y={33} width={4} height={7} rx={1.4} fill="var(--art-wood-dark)" />
      <path d="M10 35 L24 18 L38 35 Z" fill="var(--art-leaf-4)" />
      <path d="M13 26 L24 12 L35 26 Z" fill="var(--art-leaf-3)" />
      <path d="M15 27 L24 15 L26 18 L18 27 Z" fill="var(--art-leaf-2)" />
      {[
        [17, 31, "var(--art-red)"],
        [29, 30, "var(--art-yellow)"],
        [22, 24, "var(--art-blue)"],
        [27, 22, "var(--art-pink)"],
      ].map(([x, y, f]) => (
        <circle key={`${x}`} cx={x as number} cy={y as number} r={1.5} fill={f as string} />
      ))}
      <Star5 cx={24} cy={10} r={4} fill="var(--art-yellow-dark)" />
    </Art>
  );
}
