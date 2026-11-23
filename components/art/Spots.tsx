/**
 * Spot pictures for screens that were text only (docs/REVIEW_FIX_PLAN.md F4): empty states,
 * the Night ritual and weekly review headers, the setup steps and the offline/error pages.
 * Same artist as the farm set (design/reference-style-a.svg): flat, no outlines, 2–3 same-hue
 * tones (a darker shape lower-right, a small top-left highlight), a soft flat ellipse as the only
 * shadow, tokens only. Spots are 96 × 64 with the ground at y = 56; banners are 160 × 56.
 * Decorative: the text next to them says what they mean.
 */
import type { ReactNode } from "react";
import type { SomPose } from "@/content/story";
import { SomFigure } from "./Som";
import { Sparkle } from "./farm/parts";

export const SPOT_KINDS = [
  "chart",
  "basket",
  "nest",
  "mailbox",
  "umbrella",
  "starter",
  "week",
  "first10",
  "done",
] as const;
export type SpotKind = (typeof SPOT_KINDS)[number];
export const BANNER_KINDS = ["night", "review"] as const;
export type BannerKind = (typeof BANNER_KINDS)[number];

const GROUND = 56;

/** Som standing on this picture's ground, `x` = the left of the 48-wide frame. */
function Som({ x, pose, scale = 1 }: { x: number; pose: SomPose; scale?: number }) {
  return (
    <g transform={`translate(${x} ${GROUND - 40 * scale}) scale(${scale})`}>
      <SomFigure pose={pose} />
    </g>
  );
}

function Shadow({ cx, rx }: { cx: number; rx: number }) {
  return <ellipse cx={cx} cy={GROUND + 1} rx={rx} ry={rx * 0.11} fill="var(--art-shadow)" />;
}

/** Stats before any data: Som looks up at a blank chart on an easel. */
function Chart() {
  return (
    <>
      <Shadow cx={48} rx={30} />
      {/* easel legs (back, then front) */}
      <rect x={61} y={30} width={2.6} height={27} rx={1.3} fill="var(--art-wood-dark)" />
      <rect
        x={49}
        y={28}
        width={3}
        height={29}
        rx={1.5}
        fill="var(--art-wood)"
        transform="rotate(12 50.5 42)"
      />
      <rect
        x={72}
        y={28}
        width={3}
        height={29}
        rx={1.5}
        fill="var(--art-wood-dark)"
        transform="rotate(-12 73.5 42)"
      />
      {/* the board: a darker same-hue shape lower-right, then the face */}
      <rect x={45.6} y={13.6} width={36} height={29} rx={4} fill="var(--art-stone-dark)" />
      <rect x={44} y={12} width={36} height={29} rx={4} fill="var(--art-stone-light)" />
      <rect x={47} y={14.4} width={10} height={1.8} rx={0.9} fill="var(--art-white)" opacity={0.7} />
      {/* blank axes, and a few dots waiting for data */}
      <rect x={50} y={18} width={1.4} height={18.6} rx={0.7} fill="var(--art-stone-dark)" />
      <rect x={50} y={35.2} width={25} height={1.4} rx={0.7} fill="var(--art-stone-dark)" />
      <g fill="var(--art-stone)">
        <circle cx={56} cy={31} r={1.3} />
        <circle cx={62} cy={29} r={1.3} />
        <circle cx={68} cy={30} r={1.3} />
        <circle cx={74} cy={26.5} r={1.3} />
      </g>
      {/* ledge and a pencil */}
      <rect x={43} y={41} width={38} height={3} rx={1.5} fill="var(--art-wood)" />
      <rect x={66} y={38.8} width={10} height={2.2} rx={1.1} fill="var(--art-yellow)" />
      <rect x={66} y={38.8} width={2.4} height={2.2} rx={1.1} fill="var(--art-pink)" />
      <Som x={2} pose="lookUp" />
    </>
  );
}

/** An empty backlog: a woven basket with nothing in it yet. */
function Basket() {
  return (
    <>
      <Shadow cx={48} rx={25} />
      <path d="M25 32 H71 L66.6 53.4 Q66 56 63.4 56 H32.6 Q30 56 29.4 53.4 Z" fill="var(--art-wood)" />
      <path d="M59 32 H71 L66.6 53.4 Q66 56 63.4 56 H57 Z" fill="var(--art-wood-dark)" />
      <rect x={27.6} y={39} width={41} height={2.2} rx={1.1} fill="var(--art-wood-light)" opacity={0.8} />
      <rect x={29} y={46.4} width={38.2} height={2.2} rx={1.1} fill="var(--art-wood-light)" opacity={0.8} />
      {/* the rim and the empty inside */}
      <ellipse cx={48} cy={31.4} rx={26.6} ry={5} fill="var(--art-wood)" />
      <ellipse cx={48} cy={30.6} rx={23} ry={3.2} fill="var(--art-wood-dark)" />
      <ellipse cx={34} cy={28.2} rx={6} ry={0.9} fill="var(--art-wood-light)" />
      {/* a leaf resting on the rim */}
      <ellipse cx={69} cy={27.4} rx={5.4} ry={2.4} fill="var(--art-leaf-1)" transform="rotate(-28 69 27.4)" />
      <ellipse
        cx={74.4}
        cy={28.4}
        rx={4.2}
        ry={2}
        fill="var(--art-leaf-3)"
        transform="rotate(22 74.4 28.4)"
      />
    </>
  );
}

/** No animals yet: an empty straw nest and a feather. */
function Nest() {
  return (
    <>
      <Shadow cx={48} rx={24} />
      <ellipse cx={49.6} cy={49.6} rx={21.6} ry={7.6} fill="var(--art-wood-dark)" />
      <ellipse cx={48} cy={48} rx={21.4} ry={7.6} fill="var(--art-wood)" />
      <ellipse cx={48} cy={44.6} rx={15} ry={3.6} fill="var(--art-wood-dark)" />
      <g fill="var(--art-wood-light)">
        <rect x={30} y={47} width={11} height={1.4} rx={0.7} transform="rotate(-10 35.5 47.7)" />
        <rect x={52} y={50.6} width={12} height={1.4} rx={0.7} transform="rotate(8 58 51.3)" />
        <rect x={40} y={52} width={8} height={1.4} rx={0.7} transform="rotate(-4 44 52.7)" />
        <rect x={25} y={43} width={7} height={1.2} rx={0.6} transform="rotate(-28 28.5 43.6)" />
        <rect x={65} y={42.4} width={6} height={1.2} rx={0.6} transform="rotate(24 68 43)" />
      </g>
      {/* a feather drifting down */}
      <ellipse cx={68} cy={24} rx={6.4} ry={2.4} fill="var(--art-pink-light)" transform="rotate(-35 68 24)" />
      <ellipse
        cx={69.2}
        cy={23.2}
        rx={3.4}
        ry={1.1}
        fill="var(--art-pink)"
        transform="rotate(-35 69.2 23.2)"
      />
    </>
  );
}

/** No requests: a mailbox with its flag down. */
function Mailbox() {
  return (
    <>
      <Shadow cx={48} rx={18} />
      <rect x={45.5} y={36} width={5} height={20} rx={1.5} fill="var(--art-wood)" />
      <rect x={48.5} y={36} width={2} height={20} rx={1} fill="var(--art-wood-dark)" />
      <path
        d="M31.6 25.6 Q31.6 15.6 41.6 15.6 H57.6 Q67.6 15.6 67.6 25.6 V37.6 Q67.6 39.6 65.6 39.6 H33.6 Q31.6 39.6 31.6 37.6 Z"
        fill="var(--art-red-dark)"
      />
      <path
        d="M30 24 Q30 14 40 14 H56 Q66 14 66 24 V36 Q66 38 64 38 H32 Q30 38 30 36 Z"
        fill="var(--art-red)"
      />
      <ellipse cx={38} cy={19} rx={5} ry={1.8} fill="var(--art-red-light)" />
      <rect x={35} y={27} width={18} height={2.4} rx={1.2} fill="var(--art-red-dark)" />
      {/* the flag, down: nothing waiting */}
      <rect x={66} y={26} width={2.2} height={11} rx={1.1} fill="var(--art-yellow-dark)" />
      <rect x={67} y={31.4} width={9} height={4.4} rx={1.2} fill="var(--art-yellow)" />
      {/* two small flowers at the post */}
      <ellipse cx={40} cy={54.4} rx={3} ry={1.4} fill="var(--art-leaf-1)" />
      <circle cx={40} cy={52} r={1.8} fill="var(--art-pink)" />
      <ellipse cx={57} cy={54.6} rx={2.6} ry={1.3} fill="var(--art-leaf-3)" />
      <circle cx={57} cy={52.6} r={1.5} fill="var(--art-yellow)" />
    </>
  );
}

/** Offline or something went wrong: Som waits it out under an umbrella. */
function Umbrella() {
  return (
    <>
      <ellipse cx={46} cy={GROUND + 1} rx={30} ry={3.4} fill="var(--art-blue-light)" />
      <g fill="var(--art-blue-light)">
        <ellipse cx={12} cy={16} rx={0.9} ry={2.4} />
        <ellipse cx={20} cy={34} rx={0.9} ry={2.4} />
        <ellipse cx={8} cy={46} rx={0.9} ry={2.4} />
        <ellipse cx={84} cy={12} rx={0.9} ry={2.4} />
        <ellipse cx={88} cy={32} rx={0.9} ry={2.4} />
        <ellipse cx={78} cy={46} rx={0.9} ry={2.4} />
      </g>
      <Som x={10} pose="sit" />
      <g transform="rotate(-10 56 50)">
        {/* the shaft and its hook (filled shapes, no strokes) */}
        <rect x={55.2} y={6} width={1.8} height={42} rx={0.9} fill="var(--art-wood-dark)" />
        <path
          d="M55.2 46 H57 V49.6 A1.6 1.6 0 0 0 60.2 49.6 V48.6 H62 V49.6 A3.4 3.4 0 0 1 55.2 49.6 Z"
          fill="var(--art-wood-dark)"
        />
        {/* the canopy: base, a darker right-hand panel, a small highlight */}
        <path
          d="M28 22 C28 11 41 5 56 5 C71 5 84 11 84 22 Q79.3 18.5 74.7 22 Q70 18.5 65.3 22 Q60.7 18.5 56 22 Q51.3 18.5 46.7 22 Q42 18.5 37.3 22 Q32.7 18.5 28 22 Z"
          fill="var(--art-blue)"
        />
        <path
          d="M56 5 C71 5 84 11 84 22 Q79.3 18.5 74.7 22 Q70 18.5 65.3 22 C66 13 63 7.4 56 5 Z"
          fill="var(--art-blue-dark)"
        />
        <ellipse
          cx={41}
          cy={11.6}
          rx={6}
          ry={1.8}
          fill="var(--art-blue-light)"
          transform="rotate(-22 41 11.6)"
        />
        <circle cx={56} cy={4.4} r={1.4} fill="var(--art-blue-dark)" />
      </g>
    </>
  );
}

/** Setup, step 1: Som with a seed packet. */
function Starter() {
  return (
    <>
      <Shadow cx={48} rx={34} />
      <Som x={8} pose="carrySeed" />
      <rect x={60.6} y={29.6} width={22} height={27} rx={3} fill="var(--art-yellow-dark)" />
      <rect x={59} y={28} width={22} height={27} rx={3} fill="var(--art-yellow-light)" />
      <rect x={59} y={28} width={22} height={6} rx={3} fill="var(--art-yellow)" />
      <rect x={66} y={46} width={8} height={4} rx={2} fill="var(--art-soil)" />
      <rect x={69.3} y={39} width={1.6} height={8} rx={0.8} fill="var(--art-stem)" />
      <ellipse
        cx={66.6}
        cy={40.4}
        rx={3.2}
        ry={1.7}
        fill="var(--art-leaf-1)"
        transform="rotate(-25 66.6 40.4)"
      />
      <ellipse
        cx={73.6}
        cy={39.4}
        rx={3.2}
        ry={1.7}
        fill="var(--art-leaf-3)"
        transform="rotate(25 73.6 39.4)"
      />
    </>
  );
}

/** Setup, step 2: a week on a calendar page. */
function Week() {
  const done = [true, true, true, false, true, false, false];
  return (
    <>
      <Shadow cx={48} rx={26} />
      <rect x={27.6} y={15.6} width={44} height={40} rx={5} fill="var(--art-stone-dark)" />
      <rect x={26} y={14} width={44} height={40} rx={5} fill="var(--art-cream)" />
      <path d="M26 19 Q26 14 31 14 H65 Q70 14 70 19 V23 H26 Z" fill="var(--art-red)" />
      <rect x={30} y={16.2} width={9} height={1.6} rx={0.8} fill="var(--art-red-light)" />
      <circle cx={36} cy={14} r={1.8} fill="var(--art-stone-dark)" />
      <circle cx={60} cy={14} r={1.8} fill="var(--art-stone-dark)" />
      {done.map((d, i) => (
        <circle
          key={i}
          cx={33 + (i % 4) * 10}
          cy={31 + Math.floor(i / 4) * 11}
          r={3.4}
          fill={d ? "var(--art-leaf-1)" : "var(--art-stone)"}
        />
      ))}
      <Sparkle cx={74} cy={14} r={2.4} fill="var(--art-yellow)" />
    </>
  );
}

/** Setup, step 3: the first 10 minutes, a small timer with a sprout. */
function First10() {
  return (
    <>
      <Shadow cx={50} rx={22} />
      <rect x={46} y={9} width={6} height={5} rx={1.6} fill="var(--art-yellow-dark)" />
      <circle cx={50.8} cy={35.8} r={19} fill="var(--art-yellow-dark)" />
      <circle cx={49} cy={34} r={19} fill="var(--art-yellow)" />
      <circle cx={49} cy={34} r={15} fill="var(--art-yellow-light)" />
      {/* ten minutes: a sixth of the face */}
      <path d="M49 34 V19 A15 15 0 0 1 62 26.5 Z" fill="var(--art-leaf-1)" />
      <rect x={48.2} y={21} width={1.6} height={13.6} rx={0.8} fill="var(--art-soil-deep)" />
      <circle cx={49} cy={34} r={1.8} fill="var(--art-soil-deep)" />
      <ellipse
        cx={42}
        cy={25}
        rx={3.4}
        ry={1.2}
        fill="var(--art-white)"
        opacity={0.7}
        transform="rotate(-40 42 25)"
      />
      {/* a sprout at its foot */}
      <rect x={18} y={51} width={10} height={5} rx={2.5} fill="var(--art-soil)" />
      <rect x={22.2} y={44} width={1.6} height={8} rx={0.8} fill="var(--art-stem)" />
      <ellipse
        cx={19.6}
        cy={45.2}
        rx={3.4}
        ry={1.8}
        fill="var(--art-leaf-1)"
        transform="rotate(-25 19.6 45.2)"
      />
      <ellipse
        cx={26.4}
        cy={44.2}
        rx={3.4}
        ry={1.8}
        fill="var(--art-leaf-3)"
        transform="rotate(25 26.4 44.2)"
      />
    </>
  );
}

/** Setup done ("All set"): Som, happy, by a little flag. */
function Done() {
  return (
    <>
      <Shadow cx={50} rx={30} />
      <Som x={14} pose="happy" />
      <rect x={70} y={16} width={2.2} height={40} rx={1.1} fill="var(--art-wood-dark)" />
      <path d="M72.2 17 L88 22.4 L72.2 27.8 Z" fill="var(--art-leaf-3)" />
      <path d="M72.2 17 L80 19.7 L72.2 22.4 Z" fill="var(--art-leaf-light)" />
      <circle cx={71.1} cy={15.4} r={1.8} fill="var(--art-yellow)" />
      <Sparkle cx={84} cy={38} r={2.2} fill="var(--art-yellow)" />
      <Sparkle cx={60} cy={10} r={1.6} fill="var(--art-pink)" />
    </>
  );
}

const SPOTS: Record<SpotKind, () => ReactNode> = {
  chart: Chart,
  basket: Basket,
  nest: Nest,
  mailbox: Mailbox,
  umbrella: Umbrella,
  starter: Starter,
  week: Week,
  first10: First10,
  done: Done,
};

export function SpotArt({ kind, className = "h-24 w-36" }: { kind: SpotKind; className?: string }) {
  const Draw = SPOTS[kind];
  return (
    <svg viewBox="0 0 96 64" className={className} aria-hidden="true" data-spot-art={kind}>
      <Draw />
    </svg>
  );
}

/** The Night ritual header: a quiet farm under the moon, Som asleep on the hill. */
function NightBanner() {
  return (
    <>
      <rect width={160} height={56} fill="var(--sky-night-top)" />
      <rect y={26} width={160} height={30} fill="var(--sky-night-bottom)" />
      <g fill="var(--sky-star)">
        <Sparkle cx={22} cy={11} r={2} fill="var(--sky-star)" />
        <Sparkle cx={54} cy={19} r={1.4} fill="var(--sky-star)" />
        <Sparkle cx={92} cy={8} r={1.3} fill="var(--sky-star)" />
        <Sparkle cx={112} cy={22} r={1.1} fill="var(--sky-star)" />
        <circle cx={70} cy={10} r={0.7} />
        <circle cx={38} cy={24} r={0.6} />
        <circle cx={148} cy={28} r={0.6} />
      </g>
      <circle cx={134} cy={15} r={8} fill="var(--sky-moon)" />
      <circle cx={137.4} cy={12.6} r={6.6} fill="var(--sky-night-top)" />
      <path d="M0 40 Q40 30 80 38 Q120 46 160 35 V56 H0 Z" fill="var(--art-leaf-4)" />
      <path d="M0 47 Q50 40 100 47 Q130 51 160 45 V56 H0 Z" fill="var(--art-leaf-3)" />
      {/* the farmhouse */}
      <rect x={22} y={29} width={18} height={12} rx={2} fill="var(--art-wood)" />
      <rect x={34} y={29} width={6} height={12} rx={2} fill="var(--art-wood-dark)" />
      <path d="M19 30.4 L31 21.4 L43 30.4 Z" fill="var(--art-red-dark)" />
      <g transform="translate(98 12) scale(0.85)">
        <SomFigure pose="sleep" />
      </g>
      <rect width={160} height={56} fill="var(--sky-night-veil)" opacity={0.28} />
      {/* the window stays lit above the night veil */}
      <rect x={27.4} y={33} width={5} height={5} rx={1} fill="var(--art-yellow)" />
    </>
  );
}

/** The weekly review header: seven days of sprouts, each a little taller. */
function ReviewBanner() {
  return (
    <>
      <rect width={160} height={56} fill="var(--sky-day-top)" />
      <rect y={24} width={160} height={32} fill="var(--sky-day-bottom)" />
      <circle cx={140} cy={13} r={7} fill="var(--art-sun)" />
      <ellipse cx={34} cy={13} rx={10} ry={3.6} fill="var(--art-cloud)" />
      <ellipse cx={41} cy={10.6} rx={6} ry={3.6} fill="var(--art-cloud)" />
      <ellipse cx={96} cy={18} rx={7} ry={2.6} fill="var(--art-cloud)" />
      <rect y={44} width={160} height={12} fill="var(--art-leaf-1)" />
      <rect x={8} y={42} width={144} height={10} rx={4} fill="var(--art-soil)" />
      <rect x={8} y={42} width={144} height={3} rx={1.5} fill="var(--art-soil-light)" />
      {Array.from({ length: 7 }, (_, i) => {
        const x = 21 + i * 19.6;
        const h = 4 + i * 2.2;
        const s = 0.7 + i * 0.08;
        return (
          <g key={i}>
            <ellipse cx={x} cy={44.6} rx={4.6} ry={1.1} fill="var(--art-soil-dark)" />
            <rect x={x - 0.8} y={44 - h} width={1.6} height={h + 0.6} rx={0.8} fill="var(--art-stem)" />
            <ellipse
              cx={x - 3 * s}
              cy={44 - h + 1}
              rx={3.6 * s}
              ry={1.9 * s}
              fill="var(--art-leaf-1)"
              transform={`rotate(-25 ${x - 3 * s} ${44 - h + 1})`}
            />
            <ellipse
              cx={x + 3 * s}
              cy={44 - h}
              rx={3.6 * s}
              ry={1.9 * s}
              fill="var(--art-leaf-3)"
              transform={`rotate(25 ${x + 3 * s} ${44 - h})`}
            />
          </g>
        );
      })}
    </>
  );
}

export function BannerArt({ kind, className = "h-auto w-full" }: { kind: BannerKind; className?: string }) {
  return (
    <svg
      viewBox="0 0 160 56"
      preserveAspectRatio="xMidYMid slice"
      className={`${className} overflow-hidden rounded-2xl`}
      aria-hidden="true"
      data-banner-art={kind}
    >
      {kind === "night" ? <NightBanner /> : <ReviewBanner />}
    </svg>
  );
}
