/**
 * Som (ส้ม), the orange farm cat (docs/STORY.md). Same artist as the farm set
 * (design/reference-style-a.svg, components/art/farm/parts.tsx): few, simple, rounded shapes;
 * flat, no outlines, 3 same-hue tones (a darker shape lower-right, a top-left highlight), a flat
 * ellipse shadow, 48 × 48 with the ground at y = 40.
 * Chibi proportions (Minnie 2026-11-12: "cuter, better proportioned"): a big round head on a small
 * mochi body, dot eyes set wide and low, blush, two soft stripes, cream paws.
 */
import type { SomPose } from "@/content/story";
import { Art, Shadow, Sparkle, TONES } from "./farm/parts";

const FUR = TONES.orange;
const CREAM = "var(--art-cream)";
const EYE = "var(--art-soil-deep)";
const BLUSH = "var(--art-pink-light)";
const NOSE = "var(--art-pink-dark)";

type Mood = "open" | "up" | "happy" | "shut";

function Eyes({ cx, cy, mood }: { cx: number; cy: number; mood: Mood }) {
  const xs = [cx - 4.6, cx + 4.6];
  if (mood === "shut")
    return (
      <g fill={EYE}>
        {xs.map((x) => (
          <ellipse key={x} cx={x} cy={cy + 0.4} rx={1.5} ry={0.42} />
        ))}
      </g>
    );
  if (mood === "happy")
    // Smiling eyes: a small filled arch (no strokes).
    return (
      <g fill={EYE}>
        {xs.map((x) => (
          <path
            key={x}
            d={`M${x - 1.6} ${cy + 0.7} Q${x} ${cy - 1.5} ${x + 1.6} ${cy + 0.7} Q${x} ${cy - 0.3} ${x - 1.6} ${cy + 0.7}Z`}
          />
        ))}
      </g>
    );
  const dy = mood === "up" ? -1.1 : 0;
  return (
    <g className="animal-blink" fill={EYE}>
      {xs.map((x) => (
        <circle key={x} cx={x} cy={cy + dy} r={1.4} />
      ))}
    </g>
  );
}

/** The big round head centred on (cx, cy). */
function Head({
  cx,
  cy,
  mood,
  tilt = 0,
  seed = false,
  headband = false,
}: {
  cx: number;
  cy: number;
  mood: Mood;
  tilt?: number;
  seed?: boolean;
  headband?: boolean;
}) {
  const rx = 11.2;
  const ry = 9.6;
  return (
    <g transform={`rotate(${tilt} ${cx} ${cy + ry})`}>
      {/* soft rounded ears */}
      <path
        d={`M${cx - 9.6} ${cy - 4} Q${cx - 10.4} ${cy - 13} ${cx - 7} ${cy - 12.2} Q${cx - 4.6} ${cy - 11} ${cx - 3} ${cy - 8.6}Z`}
        fill={FUR.base}
      />
      <path
        d={`M${cx - 8.4} ${cy - 6} Q${cx - 8.8} ${cy - 10.6} ${cx - 6.8} ${cy - 10.2} Q${cx - 5.6} ${cy - 9.4} ${cx - 4.8} ${cy - 8.4}Z`}
        fill={BLUSH}
      />
      <path
        d={`M${cx + 9.6} ${cy - 4} Q${cx + 10.4} ${cy - 13} ${cx + 7} ${cy - 12.2} Q${cx + 4.6} ${cy - 11} ${cx + 3} ${cy - 8.6}Z`}
        fill={FUR.dark}
      />
      {/* face: darker lower-right, base, top-left highlight */}
      <ellipse cx={cx + 0.7} cy={cy + 0.7} rx={rx} ry={ry} fill={FUR.dark} />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={FUR.base} />
      <ellipse
        cx={cx - 6}
        cy={cy - 5}
        rx={3}
        ry={1.5}
        fill={FUR.light}
        transform={`rotate(-30 ${cx - 6} ${cy - 5})`}
      />
      {/* two soft stripes */}
      <rect x={cx - 1.9} y={cy - 9.4} width={1.4} height={3.2} rx={0.7} fill={FUR.dark} />
      <rect x={cx + 0.6} y={cy - 9.4} width={1.4} height={2.6} rx={0.7} fill={FUR.dark} />
      {headband && (
        // Exam week: a red study headband, knotted on the right.
        <g>
          <rect x={cx - 9.2} y={cy - 5.8} width={18.4} height={2.6} rx={1.3} fill="var(--art-red)" />
          <rect x={cx - 8.6} y={cy - 4.1} width={17.4} height={0.9} rx={0.45} fill="var(--art-red-dark)" />
          <ellipse
            cx={cx + 10.4}
            cy={cy - 6}
            rx={2}
            ry={1}
            fill="var(--art-red)"
            transform={`rotate(-30 ${cx + 10.4} ${cy - 6})`}
          />
          <ellipse
            cx={cx + 10.6}
            cy={cy - 3.6}
            rx={2}
            ry={0.9}
            fill="var(--art-red-dark)"
            transform={`rotate(25 ${cx + 10.6} ${cy - 3.6})`}
          />
        </g>
      )}
      <Eyes cx={cx} cy={cy + 1.4} mood={mood} />
      <ellipse cx={cx} cy={cy + 3.6} rx={0.95} ry={0.62} fill={NOSE} />
      <ellipse cx={cx - 7.2} cy={cy + 4} rx={1.9} ry={1.05} fill={BLUSH} />
      <ellipse cx={cx + 7.2} cy={cy + 4} rx={1.9} ry={1.05} fill={BLUSH} />
      {seed && (
        // A tiny seed packet held in the mouth.
        <g transform={`rotate(-10 ${cx} ${cy + 6})`}>
          <rect x={cx - 2.8} y={cy + 4.4} width={5.6} height={5} rx={1.2} fill="var(--art-wood-light)" />
          <rect x={cx - 2.8} y={cy + 4.4} width={5.6} height={1.4} rx={0.7} fill="var(--art-wood)" />
          <circle cx={cx} cy={cy + 7.5} r={1.1} fill="var(--art-leaf-3)" />
        </g>
      )}
    </g>
  );
}

/** A small mochi body: tail behind, cream paws in front. */
function SitBody({ tailUp = false }: { tailUp?: boolean }) {
  return (
    <g>
      <Shadow cx={24} rx={10} />
      {tailUp ? (
        <g>
          <ellipse cx={33.6} cy={30} rx={2} ry={6} fill={FUR.dark} transform="rotate(22 33.6 30)" />
          <circle cx={35.6} cy={24.8} r={2} fill={FUR.base} />
        </g>
      ) : (
        <g>
          <ellipse cx={32.4} cy={37.6} rx={5.4} ry={2} fill={FUR.dark} transform="rotate(-18 32.4 37.6)" />
          <circle cx={36.8} cy={35.8} r={1.9} fill={FUR.base} />
        </g>
      )}
      <ellipse cx={24.6} cy={34.2} rx={8.6} ry={6.4} fill={FUR.dark} />
      <ellipse cx={24} cy={33.6} rx={8.4} ry={6.2} fill={FUR.base} />
      <ellipse cx={20.6} cy={39.4} rx={2.4} ry={1.3} fill={CREAM} />
      <ellipse cx={27.4} cy={39.4} rx={2.4} ry={1.3} fill={CREAM} />
    </g>
  );
}

function Bubbles() {
  return (
    <g fill="var(--art-blue-light)">
      <circle cx={34} cy={20} r={1.3} />
      <circle cx={37.5} cy={15} r={1.9} />
      <circle cx={41.5} cy={9} r={2.5} />
    </g>
  );
}

export function SomArt({
  pose = "sit",
  className = "h-12 w-12",
  label,
  headband = false,
}: {
  pose?: SomPose;
  className?: string;
  label?: string;
  /** Exam week (docs/STORY.md). */
  headband?: boolean;
}) {
  return (
    <Art className={className} label={label}>
      {pose === "sleep" && (
        <g>
          <Shadow cx={25} rx={14} />
          {/* a curled loaf with the tail tucked in front, head resting on the left */}
          <ellipse cx={28.6} cy={34.6} rx={12} ry={5.8} fill={FUR.dark} />
          <ellipse cx={28} cy={34} rx={11.8} ry={5.6} fill={FUR.base} />
          <ellipse cx={30} cy={30.2} rx={4.6} ry={1.2} fill={FUR.light} />
          <ellipse cx={29} cy={39} rx={8.8} ry={1.7} fill={FUR.dark} />
          <circle cx={37.6} cy={38.4} r={1.6} fill={FUR.base} />
          <Head cx={15.5} cy={30.4} mood="shut" tilt={-6} />
          <Bubbles />
        </g>
      )}
      {pose === "stretch" && (
        <g>
          <Shadow cx={25} rx={14} />
          {/* rear up, front paws reaching forward, tail high */}
          <ellipse cx={36.6} cy={19.6} rx={1.9} ry={5.6} fill={FUR.dark} transform="rotate(28 36.6 19.6)" />
          <circle cx={39.2} cy={14.8} r={1.9} fill={FUR.base} />
          <rect x={29.6} y={30} width={3.4} height={10} rx={1.7} fill={FUR.dark} />
          <rect x={33.4} y={30} width={3.4} height={10} rx={1.7} fill={FUR.dark} />
          <ellipse cx={28} cy={30} rx={9.6} ry={5.6} fill={FUR.dark} transform="rotate(-18 28 30)" />
          <ellipse cx={27.5} cy={29.5} rx={9.3} ry={5.3} fill={FUR.base} transform="rotate(-18 27.5 29.5)" />
          <ellipse cx={4.6} cy={39.4} rx={2.6} ry={1.3} fill={CREAM} />
          <ellipse cx={9.4} cy={39.6} rx={2.6} ry={1.3} fill={CREAM} />
          <Head cx={15} cy={30.6} mood="shut" tilt={-4} />
        </g>
      )}
      {(pose === "sit" || pose === "lookUp" || pose === "happy" || pose === "carrySeed") && (
        <g>
          <SitBody tailUp={pose === "happy"} />
          <Head
            cx={24}
            cy={pose === "lookUp" ? 20.6 : 21.4}
            mood={pose === "happy" ? "happy" : pose === "lookUp" ? "up" : "open"}
            tilt={pose === "lookUp" ? -6 : 0}
            seed={pose === "carrySeed"}
            headband={headband}
          />
          {pose === "happy" && (
            <g>
              <Sparkle cx={8} cy={12} r={2.4} fill="var(--art-yellow)" />
              <Sparkle cx={41} cy={9} r={1.8} fill="var(--art-yellow-light)" />
            </g>
          )}
        </g>
      )}
    </Art>
  );
}
