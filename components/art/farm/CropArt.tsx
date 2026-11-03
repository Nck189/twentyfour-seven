/**
 * A crop in its plot at any stage and state (SPEC §8.2, §8.4): seed → sprout → growing → ripe,
 * plus weeds, wilt, dead and compost. Mutations and quality are separate overlays (Fx.tsx).
 */
import type { CropId } from "@/content/crops";
import type { Rarity } from "@/content/crops";
import { CROPS } from "@/content/crops";
import { CROP_TONE, RIPE } from "./crops";
import { Art, Ball, GROUND_Y, Leaf, Shadow, Stem, TONES } from "./parts";

/** Seed colors hint at rarity before anything has grown. */
const SEED_TONE: Record<Rarity, keyof typeof TONES> = {
  common: "wood",
  uncommon: "leaf",
  rare: "blue",
  epic: "purple",
  legendary: "yellow",
};

/** Stage 0: a little soil mound with the seed peeking out. */
export function Seed({ rarity }: { rarity: Rarity }) {
  const tone = TONES[SEED_TONE[rarity]];
  return (
    <g>
      <ellipse cx={24} cy={GROUND_Y - 0.5} rx={9} ry={4} fill="var(--art-soil-dark)" />
      <ellipse cx={23.5} cy={GROUND_Y - 1.2} rx={8} ry={3.2} fill="var(--art-soil-light)" />
      <ellipse cx={24.5} cy={GROUND_Y - 3.4} rx={3} ry={2.2} fill={tone.dark} />
      <ellipse cx={24} cy={GROUND_Y - 3.8} rx={2.6} ry={1.9} fill={tone.base} />
      <ellipse cx={23.2} cy={GROUND_Y - 4.5} rx={1} ry={0.6} fill={tone.light} />
    </g>
  );
}

/** Stage 1: a sprout (the reference's first plant). */
export function Sprout() {
  return (
    <g>
      <Shadow rx={7} />
      <Stem top={28} />
      <Leaf cx={19} cy={28} rx={5.4} ry={3} rot={-25} fill="var(--art-leaf-1)" />
      <Leaf cx={29} cy={27} rx={5.4} ry={3} rot={25} fill="var(--art-leaf-3)" />
    </g>
  );
}

/** Stage 2: a growing plant (the reference's middle plant) with a bud in the crop's color. */
export function Young({ cropId }: { cropId: CropId }) {
  const tone = TONES[CROP_TONE[cropId]];
  return (
    <g>
      <Shadow rx={10} />
      <Stem top={14} />
      <Leaf cx={16.5} cy={29} rx={7.5} ry={3.8} rot={-25} fill="var(--art-leaf-1)" />
      <Leaf cx={31.5} cy={25} rx={7.5} ry={3.8} rot={25} fill="var(--art-leaf-3)" />
      <Leaf cx={18.5} cy={18} rx={5.6} ry={3.2} rot={-35} fill="var(--art-leaf-2)" />
      <Ball cx={25} cy={13} r={3.6} tone={tone} />
    </g>
  );
}

/** Dead: a dry, drooping stalk (soil browns, never black). */
export function Dead() {
  return (
    <g>
      <Shadow rx={8} />
      <path d="M23 40 Q22 28 27 21 Q28.5 19.5 29.5 21 Q25 28 25.6 40Z" fill="var(--art-soil-dark)" />
      <Leaf cx={19} cy={31} rx={5} ry={2.4} rot={35} fill="var(--art-wilt-dark)" />
      <Leaf cx={30.5} cy={26} rx={4.6} ry={2.2} rot={50} fill="var(--art-soil-dark)" />
      <Leaf cx={31} cy={22.5} rx={3} ry={1.6} rot={70} fill="var(--art-wilt)" />
    </g>
  );
}

/** Compost: what a dead crop becomes (partial fertilizer back, SPEC §8.4). */
export function Compost() {
  return (
    <g>
      <Shadow rx={12} />
      <ellipse cx={24} cy={36} rx={11} ry={6.5} fill="var(--art-soil-deep)" />
      <ellipse cx={23} cy={35} rx={10} ry={5.6} fill="var(--art-soil-dark)" />
      <ellipse cx={20} cy={32.6} rx={4} ry={1.8} fill="var(--art-soil)" />
      <Leaf cx={28} cy={32} rx={2.6} ry={1.2} rot={-20} fill="var(--art-leaf-4)" />
      <Leaf cx={17} cy={36} rx={2.2} ry={1} rot={25} fill="var(--art-wilt)" />
      <ellipse cx={25} cy={37} rx={1.8} ry={1} fill="var(--art-orange)" />
    </g>
  );
}

/** Weeds: spiky tufts either side of the crop (a missed day, SPEC §8.4). */
export function Weeds() {
  const tuft = (x: number, flip: number) => (
    <g key={x}>
      <path d={`M${x - 3} 40 L${x - 1.6 * flip} 31 L${x} 40Z`} fill="var(--art-leaf-4)" />
      <path d={`M${x - 1.5} 40 L${x + 0.6 * flip} 29 L${x + 1.8} 40Z`} fill="var(--art-stem)" />
      <path d={`M${x} 40 L${x + 3 * flip} 33 L${x + 3} 40Z`} fill="var(--art-leaf-3)" />
    </g>
  );
  return <g>{[tuft(9, 1), tuft(39, -1)]}</g>;
}

/** Wilt spots: dry yellow patches drawn over the leaves. */
function WiltSpots() {
  return (
    <g>
      <ellipse
        cx={16.5}
        cy={28.5}
        rx={3.2}
        ry={1.8}
        fill="var(--art-wilt)"
        transform="rotate(-25 16.5 28.5)"
      />
      <ellipse cx={31} cy={24.5} rx={3} ry={1.7} fill="var(--art-wilt-dark)" transform="rotate(25 31 24.5)" />
      <ellipse
        cx={19.5}
        cy={17.5}
        rx={2.4}
        ry={1.4}
        fill="var(--art-wilt)"
        transform="rotate(-35 19.5 17.5)"
      />
      <circle cx={36} cy={36} r={1.4} fill="var(--art-wilt-dark)" />
      <circle cx={12} cy={37} r={1.1} fill="var(--art-wilt)" />
    </g>
  );
}

export type CropArtProps = {
  cropId: CropId;
  stage: 0 | 1 | 2 | 3;
  status?: "growing" | "ready" | "dead" | "compost";
  weeds?: boolean;
  wiltLevel?: number;
  className?: string;
  label?: string;
};

export function CropBody({ cropId, stage, status = "growing", weeds, wiltLevel = 0 }: CropArtProps) {
  if (status === "compost") return <Compost />;
  if (status === "dead") return <Dead />;
  const Ripe = RIPE[cropId];
  const plant =
    status === "ready" || stage === 3 ? (
      <Ripe />
    ) : stage === 2 ? (
      <Young cropId={cropId} />
    ) : stage === 1 ? (
      <Sprout />
    ) : (
      <Seed rarity={CROPS[cropId].rarity} />
    );
  const wilted = wiltLevel > 0 && stage > 0;
  return (
    <g>
      <g transform={wilted ? `rotate(${Math.min(12, 6 * wiltLevel)} 24 ${GROUND_Y})` : undefined}>
        {plant}
        {wilted && <WiltSpots />}
      </g>
      {weeds && <Weeds />}
    </g>
  );
}

export function CropArt({ className = "h-12 w-12", label, ...p }: CropArtProps) {
  return (
    <Art className={className} label={label}>
      <CropBody {...p} />
    </Art>
  );
}
