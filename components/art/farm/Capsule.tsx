/**
 * Seed capsule machine + capsules (SPEC §8.5). Flat, no outlines, 2–3 tones, light top-left.
 * Rarity colors: common stone, uncommon leaf, rare blue, epic purple, legendary yellow.
 */
import type { Rarity } from "@/content/crops";
import { Art, Ball, Shadow, Sparkle, TONES, type Tone } from "./parts";

export const RARITY_TONE: Record<Rarity, Tone> = {
  common: TONES.stone,
  uncommon: TONES.leaf,
  rare: TONES.blue,
  epic: TONES.purple,
  legendary: TONES.yellow,
};

/** A capsule: two halves; `open` lifts the top half (0 = closed … 1 = fully open). */
export function CapsuleShape({ rarity, open = 0 }: { rarity: Rarity; open?: number }) {
  const tone = RARITY_TONE[rarity];
  const lift = open * 10;
  const tilt = open * -25;
  return (
    <g>
      <Shadow rx={11} cy={42} />
      {/* bottom half */}
      <path d="M12 26 A12 12 0 0 0 36 26Z" fill="var(--art-cream)" />
      <path d="M24 26 L36 26 A12 12 0 0 1 24 38Z" fill="var(--art-stone)" />
      {/* top half */}
      <g transform={`translate(0 ${-lift}) rotate(${tilt} 12 26)`}>
        <path d="M12 26 A12 12 0 0 1 36 26Z" fill={tone.dark} />
        <path d="M12 26 A12 12 0 0 1 34.5 21.5 Q24 24 12 26Z" fill={tone.base} />
        <ellipse cx={18} cy={18} rx={3.2} ry={1.9} fill={tone.light} transform="rotate(-35 18 18)" />
      </g>
    </g>
  );
}

export function Capsule({
  rarity,
  open = 0,
  className = "h-16 w-16",
}: {
  rarity: Rarity;
  open?: number;
  className?: string;
}) {
  return (
    <Art className={className}>
      <CapsuleShape rarity={rarity} open={open} />
    </Art>
  );
}

/** The machine: a glass dome full of capsules, a body, a crank and a chute. */
export function CapsuleMachine({ className = "h-40 w-40" }: { className?: string }) {
  const inside: [number, number, Rarity][] = [
    [17, 17, "uncommon"],
    [24, 13, "rare"],
    [31, 17, "common"],
    [20, 22, "epic"],
    [28, 22, "legendary"],
    [24, 19, "common"],
  ];
  return (
    <Art className={className}>
      <Shadow rx={16} cy={45} />
      {/* dome */}
      <circle cx={24} cy={17} r={13} fill="var(--art-blue-light)" />
      {inside.map(([x, y, r]) => (
        <Ball key={`${x},${y}`} cx={x} cy={y} r={3.4} tone={RARITY_TONE[r]} />
      ))}
      <ellipse
        cx={18}
        cy={9.5}
        rx={4}
        ry={2}
        fill="var(--art-white)"
        opacity={0.75}
        transform="rotate(-30 18 9.5)"
      />
      {/* body */}
      <rect x={11} y={27} width={26} height={17} rx={4} fill="var(--art-red-dark)" />
      <rect x={11} y={27} width={24.5} height={15.5} rx={4} fill="var(--art-red)" />
      <rect x={13} y={28.5} width={8} height={2} rx={1} fill="var(--art-red-light)" />
      {/* crank */}
      <circle cx={30} cy={34} r={3.6} fill="var(--art-yellow-dark)" />
      <circle cx={29.6} cy={33.6} r={3} fill="var(--art-yellow)" />
      <rect x={29} y={30} width={1.8} height={4} rx={0.9} fill="var(--art-yellow-dark)" />
      {/* chute */}
      <rect x={15} y={35} width={8} height={6} rx={2} fill="var(--art-red-dark)" />
      <rect x={16} y={36} width={6} height={4} rx={1.5} fill="var(--art-cream)" />
    </Art>
  );
}

/** The rarity light behind an opening capsule (flat rings, no blur). */
export function RarityLight({ rarity, className = "h-40 w-40" }: { rarity: Rarity; className?: string }) {
  const tone = RARITY_TONE[rarity];
  return (
    <Art className={className}>
      <circle cx={24} cy={24} r={22} fill={tone.light} opacity={0.5} />
      <circle cx={24} cy={24} r={15} fill={tone.light} opacity={0.7} />
      <circle cx={24} cy={24} r={9} fill={tone.base} opacity={0.5} />
      {(rarity === "epic" || rarity === "legendary") && (
        <g>
          <Sparkle cx={8} cy={10} r={3} fill={tone.base} />
          <Sparkle cx={40} cy={12} r={2.4} fill={tone.dark} />
          <Sparkle cx={38} cy={38} r={3} fill={tone.base} />
          <Sparkle cx={9} cy={37} r={2} fill={tone.dark} />
        </g>
      )}
    </Art>
  );
}
