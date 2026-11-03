/**
 * A plot bed (the reference's soil bed) and the basic decor (SPEC §8.9: fences, paths, flowers,
 * pond). Each draws in its own 48 × 48 box so they tile in the farm grid.
 */
import { Art, Ball, Leaf, Shadow, TONES } from "./parts";

/** The soil bed a crop sits in. Locked extra plots are fenced off with a little sign. */
export function PlotBed({ locked = false }: { locked?: boolean }) {
  return (
    <g>
      <rect x={3} y={36} width={42} height={10} rx={4} fill="var(--art-soil)" />
      <rect x={3} y={36} width={42} height={3.6} rx={1.8} fill="var(--art-soil-light)" />
      <ellipse cx={14} cy={39.2} rx={6} ry={1.3} fill="var(--art-soil-dark)" />
      <ellipse cx={34} cy={39.2} rx={6} ry={1.3} fill="var(--art-soil-dark)" />
      {locked && (
        <g>
          <rect x={22.4} y={22} width={3.2} height={16} rx={1.2} fill="var(--art-wood-dark)" />
          <rect x={14} y={16} width={20} height={11} rx={3} fill="var(--art-wood-dark)" />
          <rect x={14} y={16} width={19} height={10} rx={3} fill="var(--art-wood)" />
          <rect x={20.5} y={20} width={7} height={5} rx={1.2} fill="var(--art-stone-dark)" />
          <path
            d="M21.8 20 V18.6 A2.2 2.2 0 0 1 26.2 18.6 V20"
            fill="none"
            stroke="var(--art-stone-dark)"
            strokeWidth={1.4}
          />
        </g>
      )}
    </g>
  );
}

export function Fence({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <Art className={className}>
      <Shadow rx={20} />
      <rect x={4} y={22} width={40} height={4} rx={2} fill="var(--art-wood-dark)" />
      <rect x={4} y={31} width={40} height={4} rx={2} fill="var(--art-wood-dark)" />
      {[8, 20, 32].map((x) => (
        <g key={x}>
          <path d={`M${x} 40 V17 L${x + 4} 13 L${x + 8} 17 V40Z`} fill="var(--art-wood-dark)" />
          <path d={`M${x} 40 V17 L${x + 4} 13 L${x + 6.6} 15.6 V40Z`} fill="var(--art-wood)" />
          <rect x={x + 1.2} y={18} width={1.4} height={14} rx={0.7} fill="var(--art-wood-light)" />
        </g>
      ))}
    </Art>
  );
}

export function PathTile({ className = "h-12 w-12" }: { className?: string }) {
  const stones: [number, number, number, number][] = [
    [13, 18, 8, 5],
    [33, 16, 7, 4.5],
    [22, 30, 9, 5.5],
    [38, 31, 5, 3.6],
    [10, 36, 6, 3.6],
  ];
  return (
    <Art className={className}>
      <rect x={2} y={8} width={44} height={36} rx={8} fill="var(--art-soil-light)" />
      {stones.map(([x, y, rx, ry]) => (
        <g key={`${x},${y}`}>
          <ellipse cx={x + 0.6} cy={y + 0.8} rx={rx} ry={ry} fill="var(--art-stone-dark)" />
          <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="var(--art-stone)" />
          <ellipse
            cx={x - rx * 0.35}
            cy={y - ry * 0.35}
            rx={rx * 0.3}
            ry={ry * 0.25}
            fill="var(--art-stone-light)"
          />
        </g>
      ))}
    </Art>
  );
}

export function Flowers({ className = "h-12 w-12" }: { className?: string }) {
  const heads: [number, number, keyof typeof TONES][] = [
    [14, 22, "pink"],
    [26, 16, "yellow"],
    [36, 24, "purple"],
  ];
  return (
    <Art className={className}>
      <Shadow rx={16} />
      {heads.map(([x, y]) => (
        <rect key={x} x={x - 0.9} y={y} width={1.8} height={40 - y} rx={0.9} fill="var(--art-stem)" />
      ))}
      <Leaf cx={12} cy={34} rx={4} ry={2} rot={-30} fill="var(--art-leaf-3)" />
      <Leaf cx={31} cy={33} rx={4} ry={2} rot={30} fill="var(--art-leaf-1)" />
      {heads.map(([x, y, tone]) => (
        <g key={`h${x}`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse
              key={a}
              cx={x}
              cy={y - 3.2}
              rx={2.2}
              ry={3}
              fill={TONES[tone].base}
              transform={`rotate(${a} ${x} ${y})`}
            />
          ))}
          <Ball cx={x} cy={y} r={2} tone={TONES.yellow} />
        </g>
      ))}
    </Art>
  );
}

export function Pond({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <Art className={className}>
      <ellipse cx={24} cy={30} rx={21} ry={12} fill="var(--art-stone-dark)" />
      <ellipse cx={24} cy={29} rx={20} ry={11} fill="var(--art-stone)" />
      <ellipse cx={24} cy={30} rx={17} ry={8.6} fill="var(--art-blue-dark)" />
      <ellipse cx={23} cy={29.2} rx={16} ry={7.8} fill="var(--art-blue)" />
      <ellipse cx={16} cy={27} rx={5} ry={1.4} fill="var(--art-blue-light)" />
      <ellipse cx={31} cy={32} rx={4.4} ry={2.4} fill="var(--art-leaf-3)" />
      <circle cx={31.6} cy={31.4} r={1.4} fill="var(--art-pink)" />
    </Art>
  );
}
