/**
 * The 20 crops, ripe (SPEC §8.2). Each draws in a 48 × 48 box, ground at y = 40, light from the
 * top-left, 2–3 tones per object, no outlines. Readable at 48 px: one big shape per crop.
 */
import type { ReactNode } from "react";
import type { CropId } from "@/content/crops";
import { Ball, Leaf, Shadow, Sparkle, Star5, Stem, TONES } from "./parts";

const { red, purple, blue, leaf } = TONES;

/** A root crop's leafy top (radish, turnip, carrot). */
function Tops({ y = 22, tall = 8 }: { y?: number; tall?: number }) {
  return (
    <g>
      <Leaf cx={19.5} cy={y - tall * 0.55} rx={3.6} ry={tall} rot={-24} fill="var(--art-leaf-3)" />
      <Leaf cx={28.5} cy={y - tall * 0.55} rx={3.6} ry={tall} rot={24} fill="var(--art-leaf-4)" />
      <Leaf cx={24} cy={y - tall * 0.8} rx={3.2} ry={tall} fill="var(--art-leaf-1)" />
    </g>
  );
}

function Radish() {
  return (
    <g>
      <Shadow rx={9} />
      <Tops y={24} />
      <path d="M22.4 38 Q24 46 25.6 38Z" fill="var(--art-red-light)" />
      <Ball cx={24} cy={31} r={8.5} tone={red} />
    </g>
  );
}

function Turnip() {
  return (
    <g>
      <Shadow rx={9.5} />
      <Tops y={23} tall={9} />
      <path d="M22.6 38.5 Q24 46 25.4 38.5Z" fill="var(--art-stone-dark)" />
      <Ball cx={24} cy={31} r={9} tone={TONES.stone} />
      <path d="M15.1 30 A9 9 0 0 1 32.9 30 Q24 33.5 15.1 30Z" fill="var(--art-purple)" />
      <path
        d="M28 23.6 A9 9 0 0 1 32.9 30 Q30.5 31 28.6 31.3 Q29.6 27 28 23.6Z"
        fill="var(--art-purple-dark)"
      />
      <ellipse
        cx={19.5}
        cy={26.5}
        rx={2.6}
        ry={1.5}
        fill="var(--art-purple-light)"
        transform="rotate(-35 19.5 26.5)"
      />
    </g>
  );
}

function Lettuce() {
  return (
    <g>
      <Shadow rx={12} />
      <circle cx={24} cy={30} r={11} fill="var(--art-leaf-4)" />
      <circle cx={23} cy={29} r={10} fill="var(--art-leaf-3)" />
      <Leaf cx={17.5} cy={29.5} rx={6} ry={8.5} rot={-22} fill="var(--art-leaf-2)" />
      <Leaf cx={30} cy={30} rx={6} ry={8} rot={22} fill="var(--art-leaf-3)" />
      <circle cx={23.5} cy={27.5} r={6} fill="var(--art-leaf-1)" />
      <circle cx={23} cy={26.5} r={3.6} fill="var(--art-leaf-light)" />
      <ellipse
        cx={20.5}
        cy={23.8}
        rx={1.8}
        ry={1.1}
        fill="var(--art-white)"
        opacity={0.7}
        transform="rotate(-35 20.5 23.8)"
      />
    </g>
  );
}

function Carrot() {
  return (
    <g>
      <Shadow rx={8} />
      <Tops y={22} tall={9.5} />
      <path d="M16.5 23.5 Q24 20.5 31.5 23.5 L25.6 41 Q24 43.5 22.4 41Z" fill="var(--art-orange-dark)" />
      <path d="M16.5 23.5 Q23 21 29.6 23 L24.4 40.4 Q23.3 42 22.4 40.6Z" fill="var(--art-orange)" />
      <ellipse
        cx={20.6}
        cy={27}
        rx={1.3}
        ry={3.8}
        fill="var(--art-orange-light)"
        transform="rotate(-18 20.6 27)"
      />
      <rect x={24.5} y={29} width={4} height={1.3} rx={0.65} fill="var(--art-orange-dark)" />
      <rect x={22} y={33.5} width={3.4} height={1.2} rx={0.6} fill="var(--art-orange-dark)" />
    </g>
  );
}

/** A heart-shaped berry (strawberry) with seeds and a leafy cap. */
function Berry({ cx, cy, s = 1 }: { cx: number; cy: number; s?: number }) {
  const p = (dx: number, dy: number) => `${cx + dx * s} ${cy + dy * s}`;
  return (
    <g>
      <path
        d={`M${p(-5.2, -2.6)} Q${p(-5.8, 4.5)} ${p(0.4, 7.6)} Q${p(6.2, 4.5)} ${p(5.2, -2.6)} Q${p(0.4, -5.6)} ${p(-5.2, -2.6)}Z`}
        fill="var(--art-red-dark)"
      />
      <path
        d={`M${p(-5.2, -2.6)} Q${p(-5.6, 4)} ${p(-0.2, 6.8)} Q${p(4.8, 3.8)} ${p(4.4, -2.8)} Q${p(-0.2, -5.4)} ${p(-5.2, -2.6)}Z`}
        fill="var(--art-red)"
      />
      <ellipse
        cx={cx - 2.8 * s}
        cy={cy - 1 * s}
        rx={1.2 * s}
        ry={0.8 * s}
        fill="var(--art-red-light)"
        transform={`rotate(-40 ${cx - 2.8 * s} ${cy - 1 * s})`}
      />
      {[
        [1, 0],
        [-1.6, 2.6],
        [1.6, 3.4],
        [-0.2, 5],
      ].map(([dx, dy]) => (
        <ellipse
          key={`${dx},${dy}`}
          cx={cx + dx! * s}
          cy={cy + dy! * s}
          rx={0.5 * s}
          ry={0.75 * s}
          fill="var(--art-yellow-light)"
        />
      ))}
      <Leaf cx={cx - 2 * s} cy={cy - 4 * s} rx={2.6 * s} ry={1.2 * s} rot={-20} fill="var(--art-leaf-3)" />
      <Leaf cx={cx + 2.2 * s} cy={cy - 4 * s} rx={2.6 * s} ry={1.2 * s} rot={20} fill="var(--art-leaf-4)" />
    </g>
  );
}

function Strawberry() {
  return (
    <g>
      <Shadow rx={13} />
      <Leaf cx={15} cy={33} rx={7} ry={4} rot={-18} fill="var(--art-leaf-3)" />
      <Leaf cx={33} cy={32} rx={7} ry={4} rot={18} fill="var(--art-leaf-4)" />
      <Leaf cx={24} cy={26} rx={6} ry={4.2} fill="var(--art-leaf-1)" />
      <Berry cx={17.5} cy={32} s={0.95} />
      <Berry cx={29} cy={30} s={1.1} />
    </g>
  );
}

function Blueberry() {
  return (
    <g>
      <Shadow rx={14} />
      <circle cx={15.5} cy={31} r={8} fill="var(--art-leaf-4)" />
      <circle cx={32.5} cy={30.5} r={8} fill="var(--art-leaf-4)" />
      <circle cx={24} cy={24} r={10} fill="var(--art-leaf-4)" />
      <circle cx={14.8} cy={30.2} r={7.2} fill="var(--art-leaf-3)" />
      <circle cx={31.6} cy={29.6} r={7.2} fill="var(--art-leaf-3)" />
      <circle cx={23.2} cy={23.2} r={9.2} fill="var(--art-leaf-3)" />
      <Leaf cx={19.5} cy={18} rx={4.5} ry={2.5} rot={-30} fill="var(--art-leaf-1)" />
      <Leaf cx={11.5} cy={26.5} rx={3} ry={1.8} rot={-30} fill="var(--art-leaf-1)" />
      <Ball cx={16.5} cy={32} r={3.4} tone={blue} />
      <Ball cx={22} cy={28.5} r={3.6} tone={blue} />
      <Ball cx={30.5} cy={31} r={3.4} tone={blue} />
      <Ball cx={27.5} cy={23} r={3.2} tone={blue} />
      <Ball cx={24.5} cy={34} r={3} tone={blue} />
    </g>
  );
}

function Tomato() {
  return (
    <g>
      <Shadow rx={12} />
      <Stem top={9} />
      <Leaf cx={16} cy={26} rx={7} ry={3.6} rot={-20} fill="var(--art-leaf-3)" />
      <Leaf cx={32} cy={21} rx={7} ry={3.6} rot={20} fill="var(--art-leaf-4)" />
      <Leaf cx={17} cy={14} rx={5.5} ry={3} rot={-30} fill="var(--art-leaf-1)" />
      <Leaf cx={31} cy={11} rx={5} ry={2.8} rot={30} fill="var(--art-leaf-2)" />
      <Ball cx={18} cy={21} r={5} tone={red} />
      <Ball cx={30.5} cy={30.5} r={5.4} tone={red} />
    </g>
  );
}

/** A corn cob in a husk; `rows` colors its kernels (rainbow corn passes six). */
function Cob({ rows }: { rows?: string[] }) {
  const kernels: ReactNode[] = [];
  for (let r = 0; r < 6; r++) {
    const y = 14 + r * 2.6;
    const fill = rows ? rows[r]! : r % 2 ? "var(--art-yellow-dark)" : "var(--art-yellow-light)";
    for (const dx of [-2.2, 0, 2.2])
      kernels.push(<circle key={`${r}${dx}`} cx={26.8 + dx} cy={y} r={1.15} fill={fill} />);
  }
  return (
    <g>
      <ellipse
        cx={27.4}
        cy={20.8}
        rx={4.6}
        ry={9.4}
        fill={rows ? "var(--art-cream)" : "var(--art-yellow-dark)"}
      />
      <ellipse cx={26.8} cy={20.2} rx={4.1} ry={8.9} fill={rows ? "var(--art-white)" : "var(--art-yellow)"} />
      {kernels}
      <Leaf cx={24.6} cy={26} rx={2.4} ry={7} rot={-14} fill="var(--art-leaf-1)" />
      <Leaf cx={30.2} cy={26.5} rx={2.2} ry={6.6} rot={16} fill="var(--art-leaf-3)" />
      <rect
        x={26.3}
        y={8}
        width={1.2}
        height={4}
        rx={0.6}
        fill="var(--art-yellow-light)"
        transform="rotate(-18 27 10)"
      />
      <rect
        x={27.3}
        y={8}
        width={1.2}
        height={4}
        rx={0.6}
        fill="var(--art-yellow-dark)"
        transform="rotate(14 28 10)"
      />
    </g>
  );
}

function CornPlant({ rows }: { rows?: string[] }) {
  return (
    <g>
      <Shadow rx={10} />
      <Stem x={21} top={6} w={3.4} />
      <Leaf cx={15} cy={27} rx={2.6} ry={10} rot={-35} fill="var(--art-leaf-3)" />
      <Leaf cx={17} cy={14} rx={2.2} ry={8} rot={-25} fill="var(--art-leaf-1)" />
      <Leaf cx={28} cy={34} rx={2.4} ry={7} rot={40} fill="var(--art-leaf-4)" />
      <Cob rows={rows} />
    </g>
  );
}

function Pumpkin() {
  return (
    <g>
      <Shadow rx={15} />
      <Leaf cx={36} cy={22} rx={6} ry={4} rot={25} fill="var(--art-leaf-3)" />
      <ellipse cx={30} cy={31} rx={9} ry={8.6} fill="var(--art-orange-dark)" />
      <ellipse cx={18} cy={31} rx={9} ry={8.6} fill="var(--art-orange-dark)" />
      <ellipse cx={17.3} cy={30.3} rx={8.2} ry={8} fill="var(--art-orange)" />
      <ellipse cx={24} cy={31} rx={8.4} ry={9} fill="var(--art-orange-dark)" />
      <ellipse cx={23.3} cy={30.3} rx={7.6} ry={8.4} fill="var(--art-orange)" />
      <ellipse
        cx={20}
        cy={25.5}
        rx={2.4}
        ry={1.4}
        fill="var(--art-orange-light)"
        transform="rotate(-35 20 25.5)"
      />
      <ellipse
        cx={13.6}
        cy={27}
        rx={1.6}
        ry={1}
        fill="var(--art-orange-light)"
        transform="rotate(-35 13.6 27)"
      />
      <rect
        x={22.4}
        y={18}
        width={3.2}
        height={5.5}
        rx={1.4}
        fill="var(--art-stem)"
        transform="rotate(12 24 21)"
      />
    </g>
  );
}

function Melon() {
  return (
    <g>
      <Shadow rx={13} />
      <Leaf cx={36} cy={24} rx={5.5} ry={3.6} rot={30} fill="var(--art-leaf-3)" />
      <Ball cx={24} cy={29} r={11} tone={leaf} />
      {[
        [19.5, 9],
        [24, 10.2],
        [28.5, 9],
      ].map(([x, ry]) => (
        <ellipse key={x} cx={x} cy={29.3} rx={1.1} ry={ry} fill="var(--art-leaf-3)" />
      ))}
      <ellipse
        cx={19}
        cy={23.5}
        rx={3}
        ry={1.8}
        fill="var(--art-leaf-light)"
        transform="rotate(-40 19 23.5)"
      />
      <rect x={23} y={16} width={2.6} height={3.6} rx={1.2} fill="var(--art-stem)" />
    </g>
  );
}

function Sunflower() {
  const petals: ReactNode[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i * 360) / 12;
    petals.push(
      <ellipse
        key={i}
        cx={24}
        cy={7.6}
        rx={2.1}
        ry={4}
        fill={i % 2 ? "var(--art-yellow-dark)" : "var(--art-yellow)"}
        transform={`rotate(${a} 24 13.5)`}
      />,
    );
  }
  return (
    <g>
      <Shadow rx={9} />
      <Stem top={14} w={3.4} />
      <Leaf cx={17.5} cy={28} rx={6} ry={3.2} rot={-25} fill="var(--art-leaf-3)" />
      <Leaf cx={30.5} cy={24} rx={6} ry={3.2} rot={25} fill="var(--art-leaf-4)" />
      {petals}
      <circle cx={24} cy={13.5} r={4.8} fill="var(--art-soil-deep)" />
      <circle cx={23.4} cy={12.9} r={3.9} fill="var(--art-soil-dark)" />
      <circle cx={22.4} cy={11.9} r={1.1} fill="var(--art-soil-light)" />
    </g>
  );
}

function Coffee() {
  const cherries: [number, number][] = [
    [17.5, 20],
    [19.5, 22.5],
    [29, 17.5],
    [31, 20],
    [21, 31],
    [28.5, 29.5],
  ];
  return (
    <g>
      <Shadow rx={12} />
      <Stem top={10} w={2.6} fill="var(--art-wood-dark)" />
      <Leaf cx={15.5} cy={16.5} rx={6} ry={3} rot={-25} fill="var(--art-leaf-4)" />
      <Leaf cx={32.5} cy={14} rx={6} ry={3} rot={25} fill="var(--art-leaf-3)" />
      <Leaf cx={15} cy={28} rx={6.5} ry={3.2} rot={-15} fill="var(--art-leaf-3)" />
      <Leaf cx={33} cy={26} rx={6.5} ry={3.2} rot={15} fill="var(--art-leaf-4)" />
      <Leaf cx={24} cy={9} rx={3} ry={5} fill="var(--art-leaf-2)" />
      {cherries.map(([x, y]) => (
        <Ball key={`${x},${y}`} cx={x} cy={y} r={2.4} tone={red} />
      ))}
    </g>
  );
}

function DragonFruit() {
  return (
    <g>
      <Shadow rx={10} />
      <rect x={20.5} y={26} width={7} height={14} rx={3.5} fill="var(--art-leaf-4)" />
      <rect x={21} y={26} width={4.6} height={13.5} rx={2.3} fill="var(--art-leaf-3)" />
      <Leaf cx={15.5} cy={33} rx={2.6} ry={6} rot={-40} fill="var(--art-leaf-3)" />
      <Leaf cx={32.5} cy={32} rx={2.6} ry={6} rot={40} fill="var(--art-leaf-4)" />
      <ellipse cx={24.6} cy={17.6} rx={9} ry={10} fill="var(--art-pink-dark)" />
      <ellipse cx={23.8} cy={16.8} rx={8.2} ry={9.3} fill="var(--art-pink)" />
      {[
        [17, 13, -50],
        [31.5, 12.5, 50],
        [16.5, 21.5, -70],
        [32.5, 21, 70],
        [24, 7.6, 0],
      ].map(([x, y, r]) => (
        <Leaf key={`${x},${y}`} cx={x!} cy={y!} rx={1.6} ry={3.2} rot={r} fill="var(--art-leaf-1)" />
      ))}
      <ellipse
        cx={20}
        cy={12.5}
        rx={2.4}
        ry={1.4}
        fill="var(--art-pink-light)"
        transform="rotate(-40 20 12.5)"
      />
    </g>
  );
}

function Lavender() {
  const spikes: [number, number, number][] = [
    [15, 15, -18],
    [20, 10, -8],
    [26, 8, 4],
    [31.5, 12, 14],
  ];
  return (
    <g>
      <Shadow rx={11} />
      {spikes.map(([x, top, rot]) => (
        <g key={x} transform={`rotate(${rot} 24 40)`}>
          <rect x={x - 0.8} y={top + 8} width={1.6} height={32 - top} rx={0.8} fill="var(--art-stem)" />
          {[0, 1, 2, 3, 4].map((i) => (
            <circle
              key={i}
              cx={x + (i % 2 ? 0.9 : -0.9)}
              cy={top + i * 2.2}
              r={1.9 - i * 0.05}
              fill={
                i === 0 ? "var(--art-purple-light)" : i % 2 ? "var(--art-purple-dark)" : "var(--art-purple)"
              }
            />
          ))}
        </g>
      ))}
      <Leaf cx={19} cy={36} rx={1.6} ry={5} rot={-30} fill="var(--art-leaf-2)" />
      <Leaf cx={29} cy={36} rx={1.6} ry={5} rot={30} fill="var(--art-leaf-3)" />
    </g>
  );
}

function Grape() {
  const bunch: [number, number][] = [
    [19, 20],
    [24, 20],
    [29, 20],
    [21.5, 24.5],
    [26.5, 24.5],
    [24, 29],
  ];
  return (
    <g>
      <Shadow rx={11} />
      <rect x={10} y={8} width={3.4} height={32} rx={1.4} fill="var(--art-wood-dark)" />
      <rect x={10} y={8} width={2.4} height={32} rx={1.2} fill="var(--art-wood)" />
      <rect x={10} y={10} width={28} height={2.6} rx={1.3} fill="var(--art-wood)" />
      <circle cx={30} cy={13} r={4} fill="var(--art-leaf-3)" />
      <circle cx={35} cy={14} r={3.4} fill="var(--art-leaf-4)" />
      <circle cx={32.5} cy={9.8} r={3} fill="var(--art-leaf-1)" />
      <rect x={23.3} y={12} width={1.4} height={5} rx={0.7} fill="var(--art-stem)" />
      {bunch.map(([x, y]) => (
        <Ball key={`${x},${y}`} cx={x} cy={y} r={3} tone={purple} />
      ))}
    </g>
  );
}

function CherryTree() {
  const pairs: [number, number][] = [
    [15, 25],
    [27, 28],
    [33, 20],
  ];
  return (
    <g>
      <Shadow rx={12} />
      <rect x={21.5} y={25} width={5} height={15} rx={2} fill="var(--art-wood-dark)" />
      <rect x={21.5} y={25} width={3.4} height={15} rx={1.7} fill="var(--art-wood)" />
      <circle cx={16.5} cy={20.5} r={8} fill="var(--art-leaf-4)" />
      <circle cx={31.5} cy={19.5} r={8} fill="var(--art-leaf-3)" />
      <circle cx={23.5} cy={15} r={9} fill="var(--art-leaf-1)" />
      <circle cx={20.5} cy={12.5} r={3.4} fill="var(--art-leaf-light)" />
      {pairs.map(([x, y]) => (
        <g key={x}>
          <path d={`M${x} ${y - 4} L${x - 2} ${y}`} stroke="var(--art-stem)" strokeWidth={0.9} />
          <path d={`M${x} ${y - 4} L${x + 2} ${y + 0.6}`} stroke="var(--art-stem)" strokeWidth={0.9} />
          <Ball cx={x - 2} cy={y + 1.2} r={2.3} tone={red} />
          <Ball cx={x + 2} cy={y + 1.8} r={2.3} tone={red} />
        </g>
      ))}
    </g>
  );
}

function StarFruit() {
  return (
    <g>
      <Shadow rx={11} />
      <Stem top={14} w={2.6} />
      <Leaf cx={16} cy={30} rx={6.5} ry={3} rot={-20} fill="var(--art-leaf-3)" />
      <Leaf cx={32} cy={27} rx={6.5} ry={3} rot={20} fill="var(--art-leaf-4)" />
      <Leaf cx={18.5} cy={15} rx={4.5} ry={2.4} rot={-30} fill="var(--art-leaf-1)" />
      <Star5 cx={30.5} cy={14.5} r={7.4} fill="var(--art-yellow-dark)" />
      <Star5 cx={29.8} cy={13.8} r={6.6} fill="var(--art-yellow)" />
      <ellipse
        cx={27.6}
        cy={11.6}
        rx={1.8}
        ry={1.1}
        fill="var(--art-yellow-light)"
        transform="rotate(-35 27.6 11.6)"
      />
      <Star5 cx={17} cy={24} r={5.4} fill="var(--art-yellow-dark)" />
      <Star5 cx={16.5} cy={23.5} r={4.8} fill="var(--art-yellow)" />
    </g>
  );
}

function MoonMelon() {
  return (
    <g>
      <circle cx={24} cy={27} r={16} fill="var(--art-purple-light)" opacity={0.45} />
      <Shadow rx={13} />
      <Leaf cx={36.5} cy={23} rx={5} ry={3.2} rot={30} fill="var(--art-leaf-3)" />
      <Ball cx={24} cy={29} r={11} tone={blue} />
      <circle cx={26} cy={27.5} r={5.4} fill="var(--sky-moon)" />
      <circle cx={28.4} cy={25.9} r={4.6} fill="var(--art-blue)" />
      <Sparkle cx={17.5} cy={32} r={1.6} fill="var(--sky-star)" />
      <Sparkle cx={31} cy={33.5} r={1.2} fill="var(--sky-star)" />
      <rect x={23} y={16} width={2.6} height={3.6} rx={1.2} fill="var(--art-stem)" />
    </g>
  );
}

function CrystalRose() {
  return (
    <g>
      <Shadow rx={9} />
      <Stem top={22} w={2.4} />
      <Leaf cx={18.5} cy={32} rx={5} ry={2.6} rot={-25} fill="var(--art-leaf-3)" />
      <Leaf cx={29.5} cy={28} rx={5} ry={2.6} rot={25} fill="var(--art-leaf-4)" />
      {/* back petals */}
      <circle cx={17.5} cy={14.5} r={6} fill="var(--art-pink-dark)" />
      <circle cx={30.5} cy={14.5} r={6} fill="var(--art-pink-dark)" />
      <circle cx={24} cy={11} r={6.5} fill="var(--art-pink)" />
      {/* the cup: front petals, one crystal-blue facet each side */}
      <path
        d="M14 15.5 Q14 25.5 24 25.5 Q34 25.5 34 15.5 Q29 19.5 24 19.5 Q19 19.5 14 15.5Z"
        fill="var(--art-pink-dark)"
      />
      <path d="M14 15.5 Q14.4 24.4 23.4 24.6 L24 19.5 Q19 19.5 14 15.5Z" fill="var(--art-pink)" />
      <path d="M24 19.5 L23.4 24.6 Q31.6 24.2 33.4 17.6 Q29 19.5 24 19.5Z" fill="var(--art-blue-light)" />
      {/* the heart of the rose: a spiral of two petals */}
      <ellipse cx={24} cy={15.5} rx={5.4} ry={4} fill="var(--art-pink-light)" />
      <path d="M20.6 15.2 Q24 11.6 27.4 15.2 Q24 13.8 20.6 15.2Z" fill="var(--art-pink-dark)" />
      <polygon points="18.5,9.5 21,7.6 22.6,10.2" fill="var(--art-white)" opacity={0.85} />
      <Sparkle cx={36} cy={8} r={2.4} fill="var(--art-white)" />
      <Sparkle cx={11.5} cy={21} r={1.6} fill="var(--art-blue-light)" />
    </g>
  );
}

const RAINBOW_ROWS = [
  "var(--art-red)",
  "var(--art-orange)",
  "var(--art-yellow)",
  "var(--art-leaf-1)",
  "var(--art-blue)",
  "var(--art-purple)",
];

export const RIPE: Record<CropId, () => ReactNode> = {
  radish: Radish,
  turnip: Turnip,
  lettuce: Lettuce,
  carrot: Carrot,
  strawberry: Strawberry,
  blueberry: Blueberry,
  tomato: Tomato,
  corn: () => <CornPlant />,
  pumpkin: Pumpkin,
  melon: Melon,
  sunflower: Sunflower,
  coffee: Coffee,
  dragon_fruit: DragonFruit,
  lavender: Lavender,
  grape: Grape,
  cherry_tree: CherryTree,
  star_fruit: StarFruit,
  moon_melon: MoonMelon,
  crystal_rose: CrystalRose,
  rainbow_corn: () => <CornPlant rows={RAINBOW_ROWS} />,
};

/** The fruit color a crop shows while young (a bud), so crops are told apart mid-growth. */
export const CROP_TONE: Record<CropId, keyof typeof TONES> = {
  radish: "red",
  turnip: "purple",
  lettuce: "leaf",
  carrot: "orange",
  strawberry: "red",
  blueberry: "blue",
  tomato: "red",
  corn: "yellow",
  pumpkin: "orange",
  melon: "leaf",
  sunflower: "yellow",
  coffee: "red",
  dragon_fruit: "pink",
  lavender: "purple",
  grape: "purple",
  cherry_tree: "red",
  star_fruit: "yellow",
  moon_melon: "blue",
  crystal_rose: "pink",
  rainbow_corn: "yellow",
};
