/** The farmhouse (economy v2 "House" upgrade): it grows with each level. Flat, no outlines,
 *  3 tones per shape, light from the top-left (style reference A). Level 0 draws nothing. */
import { Art, Shadow, TONES } from "./parts";

function Window({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={6} height={6} rx={1.2} fill={TONES.blue.dark} />
      <rect x={x + 0.6} y={y + 0.6} width={4.8} height={4.8} rx={1} fill={TONES.blue.base} />
      <rect x={x + 1} y={y + 1} width={2} height={2} rx={0.6} fill={TONES.blue.light} />
    </g>
  );
}

export function Farmhouse({ level, className = "h-16 w-16" }: { level: number; className?: string }) {
  if (level <= 0) return null;
  const big = level >= 3;
  const mid = level >= 2;
  // Walls get wider per level; the roof follows.
  const wx = big ? 8 : mid ? 10 : 14;
  const ww = 48 - 2 * wx;
  const wallTop = big ? 22 : 26;
  return (
    <Art className={className}>
      <Shadow rx={ww / 2 + 3} />
      {/* chimney (level 2+) */}
      {mid && (
        <g>
          <rect x={wx + ww - 9} y={wallTop - 12} width={5} height={10} rx={1} fill="var(--art-stone-dark)" />
          <rect x={wx + ww - 9} y={wallTop - 12} width={3.4} height={10} rx={1} fill="var(--art-stone)" />
        </g>
      )}
      {/* walls: shade band on the right, light on the left */}
      <rect x={wx} y={wallTop} width={ww} height={40 - wallTop} rx={1.5} fill="var(--art-wood-dark)" />
      <rect x={wx} y={wallTop} width={ww - 3} height={40 - wallTop} rx={1.5} fill="var(--art-wood)" />
      <rect
        x={wx + 1.5}
        y={wallTop + 1.5}
        width={3}
        height={40 - wallTop - 3}
        rx={1}
        fill="var(--art-wood-light)"
      />
      {/* roof */}
      <path
        d={`M${wx - 3} ${wallTop + 1} L24 ${wallTop - 13} L${51 - wx} ${wallTop + 1} Z`}
        fill="var(--art-red-dark)"
      />
      <path
        d={`M${wx - 3} ${wallTop + 1} L24 ${wallTop - 13} L${47 - wx} ${wallTop - 1} Z`}
        fill="var(--art-red)"
      />
      <path
        d={`M${wx + 1} ${wallTop - 1} L24 ${wallTop - 10} L22 ${wallTop - 6} Z`}
        fill="var(--art-red-light)"
      />
      {/* door */}
      <rect x={21} y={32} width={6} height={8} rx={1.5} fill="var(--art-wood-dark)" />
      <circle cx={25.6} cy={36.2} r={0.6} fill="var(--art-yellow)" />
      {/* windows */}
      {mid && <Window x={wx + 3} y={wallTop + 4} />}
      {mid && <Window x={wx + ww - 9} y={wallTop + 4} />}
      {big && (
        <g>
          {/* porch roof + flower box */}
          <rect x={17} y={30} width={14} height={2} rx={1} fill="var(--art-wood-dark)" />
          <rect x={wx + 3} y={wallTop + 10.5} width={6} height={2} rx={1} fill="var(--art-leaf-light)" />
          <circle cx={wx + 4.5} cy={wallTop + 10.4} r={1.1} fill={TONES.pink.base} />
          <circle cx={wx + 7.5} cy={wallTop + 10.4} r={1.1} fill={TONES.yellow.base} />
        </g>
      )}
    </Art>
  );
}
