/**
 * Animals (SPEC §8.6): flat, no outlines, 2–3 same-hue tones, light from the top-left, a flat
 * ellipse shadow. Two body plans share every part (four-legged, bird), so all 13 read as one
 * artist's set at 48 px. Sleepy (hungry) animals close their eyes and lower their head; they
 * never look hurt. Idle motion is a slow bob + blink (CSS, off with reduced motion).
 */
import type { AnimalId, ProduceId } from "@/content/animals";
import { Art, Ball, Shadow, Sparkle, TONES, type Tone } from "./parts";

const WHITE: Tone = { base: "var(--art-white)", dark: "var(--art-stone)", light: "var(--art-white)" };
const CREAM: Tone = { base: "var(--art-cream)", dark: "var(--art-stone-dark)", light: "var(--art-white)" };
const EYE = "var(--art-soil-deep)";
const CHEEK = "var(--art-pink-light)";

type Ears = "round" | "pointy" | "floppy" | "long" | "small" | "none";
type Beast = {
  plan: "beast";
  body: Tone;
  head?: Tone;
  ears: Ears;
  snout?: Tone;
  tail?: "curl" | "up" | "stripe" | "tuft" | "puff" | "none";
  extra?: "spots" | "wool" | "horns" | "mask" | "neck" | "yuzu";
};
type Bird = { plan: "bird"; body: Tone; comb?: boolean; long?: boolean; sparkle?: boolean };
type Spec = Beast | Bird;

const SPECS: Record<AnimalId, Spec> = {
  chicken: { plan: "bird", body: WHITE, comb: true },
  duck: { plan: "bird", body: TONES.yellow },
  golden_goose: { plan: "bird", body: TONES.yellow, long: true, sparkle: true },
  bunny: { plan: "beast", body: TONES.silver, ears: "long", tail: "puff" },
  cow: { plan: "beast", body: WHITE, ears: "small", snout: TONES.pink, tail: "tuft", extra: "spots" },
  sheep: { plan: "beast", body: CREAM, head: TONES.stone, ears: "small", tail: "none", extra: "wool" },
  pig: { plan: "beast", body: TONES.pink, ears: "pointy", snout: TONES.pink, tail: "curl" },
  cat: { plan: "beast", body: TONES.orange, ears: "pointy", tail: "up" },
  dog: { plan: "beast", body: TONES.wood, ears: "floppy", snout: CREAM, tail: "up" },
  goat: { plan: "beast", body: TONES.stone, ears: "floppy", tail: "tuft", extra: "horns" },
  capybara: {
    plan: "beast",
    body: TONES.wood,
    ears: "small",
    snout: TONES.wood,
    tail: "none",
    extra: "yuzu",
  },
  alpaca: { plan: "beast", body: CREAM, ears: "pointy", tail: "puff", extra: "neck" },
  red_panda: { plan: "beast", body: TONES.orange, ears: "pointy", tail: "stripe", extra: "mask" },
};

/** Eyes: open dots (with a blink) or sleepy closed lids. */
function Eyes({ x, y, sleepy }: { x: number; y: number; sleepy: boolean }) {
  if (sleepy) return <ellipse cx={x} cy={y + 0.6} rx={1.5} ry={0.45} fill={EYE} />;
  return (
    <g className="animal-blink">
      <circle cx={x} cy={y} r={1.15} fill={EYE} />
      <circle cx={x - 0.35} cy={y - 0.4} r={0.35} fill="var(--art-white)" />
    </g>
  );
}

/** Three soft bubbles rising: asleep (no letters, reads at any language). */
function Zz({ x, y }: { x: number; y: number }) {
  return (
    <g fill="var(--art-blue-light)">
      <circle cx={x} cy={y} r={1.2} />
      <circle cx={x + 2.4} cy={y - 2.6} r={1.6} />
      <circle cx={x + 5.4} cy={y - 5.8} r={2.1} />
    </g>
  );
}

function BeastArt({ s, sleepy }: { s: Beast; sleepy: boolean }) {
  const head = s.head ?? s.body;
  const neck = s.extra === "neck";
  const hx = 15;
  const hy = (neck ? 13 : 22) + (sleepy ? 1.5 : 0);
  return (
    <g>
      <Shadow cx={26} rx={13} />
      {/* tail (behind the body) */}
      {s.tail === "up" && (
        <ellipse cx={38} cy={22} rx={2} ry={5.5} fill={s.body.dark} transform="rotate(25 38 22)" />
      )}
      {s.tail === "stripe" && (
        <g transform="rotate(35 38 24)">
          <ellipse cx={38} cy={24} rx={3} ry={7} fill={s.body.base} />
          <rect x={35} y={21} width={6} height={1.8} rx={0.9} fill={s.body.dark} />
          <rect x={35} y={25} width={6} height={1.8} rx={0.9} fill={s.body.dark} />
        </g>
      )}
      {s.tail === "curl" && <circle cx={38.5} cy={26} r={1.8} fill={s.body.dark} />}
      {s.tail === "tuft" && (
        <ellipse cx={39} cy={30} rx={1.4} ry={3.2} fill={s.body.dark} transform="rotate(20 39 30)" />
      )}
      {s.tail === "puff" && <circle cx={38.5} cy={27} r={2.6} fill={WHITE.base} />}
      {/* legs */}
      {[18, 22.5, 30, 34.5].map((x) => (
        <rect key={x} x={x - 1.6} y={33} width={3.2} height={7} rx={1.6} fill={s.body.dark} />
      ))}
      {/* body: darker shape lower-right, base, top-left highlight */}
      <ellipse cx={27} cy={29.5} rx={12.5} ry={8} fill={s.body.dark} />
      <ellipse cx={26.3} cy={28.8} rx={11.8} ry={7.4} fill={s.body.base} />
      <ellipse cx={22} cy={24.5} rx={4.5} ry={1.8} fill={s.body.light} transform="rotate(-12 22 24.5)" />
      {s.extra === "spots" && (
        <g fill="var(--art-wood)">
          <ellipse cx={29} cy={27} rx={3.2} ry={2.4} />
          <ellipse cx={34} cy={31} rx={2.2} ry={1.7} />
        </g>
      )}
      {s.extra === "wool" &&
        [
          [20, 25],
          [25, 23.5],
          [30, 24],
          [34.5, 26.5],
          [23, 30],
          [29, 30.5],
        ].map(([x, y]) => <circle key={`${x}`} cx={x} cy={y} r={3.2} fill={s.body.light} />)}
      {/* neck (alpaca) */}
      {neck && <rect x={13} y={14} width={6} height={16} rx={3} fill={s.body.base} />}
      {/* ears */}
      {s.ears === "long" && (
        <g>
          <ellipse
            cx={13}
            cy={hy - 9}
            rx={1.9}
            ry={5}
            fill={head.base}
            transform={`rotate(-12 13 ${hy - 9})`}
          />
          <ellipse
            cx={13}
            cy={hy - 9}
            rx={0.8}
            ry={3.6}
            fill={TONES.pink.light}
            transform={`rotate(-12 13 ${hy - 9})`}
          />
          <ellipse
            cx={17.5}
            cy={hy - 9.5}
            rx={1.9}
            ry={5}
            fill={head.dark}
            transform={`rotate(10 17.5 ${hy - 9.5})`}
          />
        </g>
      )}
      {s.ears === "pointy" && (
        <g>
          <path
            d={`M${hx - 6} ${hy - 3} L${hx - 4.5} ${hy - 9.5} L${hx - 1.5} ${hy - 5.5}Z`}
            fill={head.dark}
          />
          <path
            d={`M${hx + 1.5} ${hy - 5.5} L${hx + 4.5} ${hy - 9.5} L${hx + 6} ${hy - 3}Z`}
            fill={head.dark}
          />
        </g>
      )}
      {s.ears === "small" && (
        <g fill={head.dark}>
          <ellipse
            cx={hx - 5.5}
            cy={hy - 5}
            rx={2.2}
            ry={1.5}
            transform={`rotate(-25 ${hx - 5.5} ${hy - 5})`}
          />
          <ellipse
            cx={hx + 5.5}
            cy={hy - 5}
            rx={2.2}
            ry={1.5}
            transform={`rotate(25 ${hx + 5.5} ${hy - 5})`}
          />
        </g>
      )}
      {s.extra === "horns" && (
        <g fill="var(--art-stone-dark)">
          <ellipse
            cx={hx - 2.5}
            cy={hy - 7.5}
            rx={1.1}
            ry={2.6}
            transform={`rotate(-20 ${hx - 2.5} ${hy - 7.5})`}
          />
          <ellipse
            cx={hx + 2.5}
            cy={hy - 7.5}
            rx={1.1}
            ry={2.6}
            transform={`rotate(20 ${hx + 2.5} ${hy - 7.5})`}
          />
        </g>
      )}
      {/* head */}
      <circle cx={hx} cy={hy} r={7.2} fill={head.dark} />
      <circle cx={hx - 0.5} cy={hy - 0.5} r={6.7} fill={head.base} />
      <ellipse
        cx={hx - 3}
        cy={hy - 4}
        rx={2}
        ry={1.1}
        fill={head.light}
        transform={`rotate(-35 ${hx - 3} ${hy - 4})`}
      />
      {s.ears === "floppy" && (
        <g fill={head.dark}>
          <ellipse
            cx={hx - 6.2}
            cy={hy + 0.5}
            rx={2}
            ry={4}
            transform={`rotate(15 ${hx - 6.2} ${hy + 0.5})`}
          />
          <ellipse
            cx={hx + 6.2}
            cy={hy + 0.5}
            rx={2}
            ry={4}
            transform={`rotate(-15 ${hx + 6.2} ${hy + 0.5})`}
          />
        </g>
      )}
      {s.extra === "wool" && <circle cx={hx} cy={hy - 6} r={3.4} fill={s.body.light} />}
      {s.extra === "mask" && (
        <g fill="var(--art-cream)">
          <ellipse cx={hx - 2.8} cy={hy + 1.8} rx={2.4} ry={1.8} />
          <ellipse cx={hx + 2.8} cy={hy + 1.8} rx={2.4} ry={1.8} />
        </g>
      )}
      {s.extra === "yuzu" && <Ball cx={hx + 1} cy={hy - 8} r={2.6} tone={TONES.yellow} />}
      {/* face */}
      <Eyes x={hx - 2.6} y={hy - 0.5} sleepy={sleepy} />
      <Eyes x={hx + 2.6} y={hy - 0.5} sleepy={sleepy} />
      {!sleepy && <ellipse cx={hx - 4.6} cy={hy + 2.6} rx={1.4} ry={0.8} fill={CHEEK} />}
      {!sleepy && <ellipse cx={hx + 4.6} cy={hy + 2.6} rx={1.4} ry={0.8} fill={CHEEK} />}
      {s.snout ? (
        <g>
          <ellipse
            cx={hx}
            cy={hy + 3.2}
            rx={3}
            ry={2}
            fill={s.snout.light === s.snout.base ? s.snout.dark : s.snout.light}
          />
          <circle cx={hx - 1} cy={hy + 3.2} r={0.55} fill={s.snout.dark} />
          <circle cx={hx + 1} cy={hy + 3.2} r={0.55} fill={s.snout.dark} />
        </g>
      ) : (
        <ellipse cx={hx} cy={hy + 2.4} rx={0.9} ry={0.6} fill={TONES.pink.dark} />
      )}
      {sleepy && <Zz x={hx + 8} y={hy - 6} />}
    </g>
  );
}

function BirdArt({ s, sleepy }: { s: Bird; sleepy: boolean }) {
  const hx = s.long ? 15 : 17;
  const hy = (s.long ? 13 : 18) + (sleepy ? 1.5 : 0);
  const legs = "var(--art-orange-dark)";
  return (
    <g>
      <Shadow cx={25} rx={10} />
      <rect x={21.5} y={34} width={1.6} height={6} rx={0.8} fill={legs} />
      <rect x={27.5} y={34} width={1.6} height={6} rx={0.8} fill={legs} />
      {/* body */}
      <ellipse cx={26} cy={29} rx={11} ry={8.6} fill={s.body.dark} />
      <ellipse cx={25.3} cy={28.3} rx={10.4} ry={8} fill={s.body.base} />
      <ellipse cx={21.5} cy={23.5} rx={3.6} ry={1.6} fill={s.body.light} transform="rotate(-20 21.5 23.5)" />
      {/* tail feathers + wing */}
      <path d="M35 25 L40.5 21.5 L38.5 28Z" fill={s.body.dark} />
      <ellipse cx={28} cy={29} rx={5.5} ry={3.6} fill={s.body.dark} transform="rotate(-15 28 29)" />
      {s.long && <rect x={hx - 2.6} y={hy} width={5.2} height={12} rx={2.6} fill={s.body.base} />}
      {/* head */}
      {s.comb && (
        <g fill="var(--art-red)">
          <circle cx={hx - 1.8} cy={hy - 6} r={1.6} />
          <circle cx={hx + 0.4} cy={hy - 6.8} r={1.8} />
          <circle cx={hx + 2.4} cy={hy - 5.8} r={1.5} />
        </g>
      )}
      <circle cx={hx} cy={hy} r={5.8} fill={s.body.dark} />
      <circle cx={hx - 0.4} cy={hy - 0.4} r={5.4} fill={s.body.base} />
      <ellipse
        cx={hx - 2.4}
        cy={hy - 3.2}
        rx={1.6}
        ry={0.9}
        fill={s.body.light}
        transform={`rotate(-35 ${hx - 2.4} ${hy - 3.2})`}
      />
      <path
        d={`M${hx - 5} ${hy + 0.6} L${hx - 9} ${hy + 2} L${hx - 5} ${hy + 3}Z`}
        fill="var(--art-orange)"
      />
      {s.comb && <ellipse cx={hx - 4.4} cy={hy + 4.2} rx={1} ry={1.4} fill="var(--art-red)" />}
      <Eyes x={hx - 1.6} y={hy - 0.6} sleepy={sleepy} />
      {!sleepy && <ellipse cx={hx + 1.2} cy={hy + 2} rx={1.3} ry={0.7} fill={CHEEK} />}
      {s.sparkle && (
        <g>
          <Sparkle cx={36} cy={14} r={2.4} fill="var(--art-yellow-dark)" />
          <Sparkle cx={8} cy={30} r={1.8} fill="var(--art-yellow-dark)" />
        </g>
      )}
      {sleepy && <Zz x={hx + 6} y={hy - 6} />}
    </g>
  );
}

/** One animal. `sleepy` = hungry (closed eyes, head down, bubbles). `idle` = slow bob + blink. */
export function AnimalArt({
  species,
  sleepy = false,
  idle = true,
  className = "h-16 w-16",
  label,
}: {
  species: AnimalId;
  sleepy?: boolean;
  idle?: boolean;
  className?: string;
  label?: string;
}) {
  const s = SPECS[species];
  return (
    <Art className={className} label={label}>
      <g className={idle && !sleepy ? "animal-bob" : undefined}>
        {s.plan === "bird" ? <BirdArt s={s} sleepy={sleepy} /> : <BeastArt s={s} sleepy={sleepy} />}
      </g>
    </Art>
  );
}

/** A small pink heart (pet reaction, love meter). */
export function Heart({ className = "h-5 w-5", empty = false }: { className?: string; empty?: boolean }) {
  const tone = empty ? TONES.stone : TONES.pink;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 21 C5 16 2 12.5 2 8.5 A5 5 0 0 1 12 6 A5 5 0 0 1 22 8.5 C22 12.5 19 16 12 21Z"
        fill={tone.dark}
      />
      <path
        d="M11.4 19.6 C5.3 15.2 2.8 12 2.8 8.6 A4.4 4.4 0 0 1 11.4 6.7 A4.4 4.4 0 0 1 20.6 8.6 C20.6 12 18 15.2 11.4 19.6Z"
        fill={tone.base}
      />
      <ellipse cx={7} cy={8.5} rx={2} ry={1.2} fill={tone.light} transform="rotate(-35 7 8.5)" />
    </svg>
  );
}

/** The egg in the incubator: `progress` 0–2 workouts shows 0–2 soft cracks. */
export function EggArt({ progress = 0, className = "h-16 w-16" }: { progress?: number; className?: string }) {
  return (
    <Art className={className}>
      <Shadow rx={11} />
      {/* nest */}
      <ellipse cx={24} cy={37} rx={13} ry={4.2} fill="var(--art-wood-dark)" />
      <ellipse cx={24} cy={36} rx={12} ry={3.4} fill="var(--art-wood)" />
      {/* egg */}
      <ellipse cx={24.6} cy={24.6} rx={9.4} ry={12} fill="var(--art-stone-dark)" />
      <ellipse cx={24} cy={24} rx={8.9} ry={11.5} fill="var(--art-cream)" />
      <ellipse cx={20.5} cy={17} rx={2.4} ry={1.4} fill="var(--art-white)" transform="rotate(-30 20.5 17)" />
      <circle cx={27} cy={20} r={1.6} fill="var(--art-leaf-light)" />
      <circle cx={21} cy={27} r={1.3} fill="var(--art-pink-light)" />
      <circle cx={28} cy={30} r={1.1} fill="var(--art-blue-light)" />
      {progress >= 1 && (
        <path
          d="M17 22 L20 20.5 L22 23 L24.5 21 L24 22.6 L22 24.6 L20 22.2 L17.4 23.4Z"
          fill="var(--art-stone-dark)"
        />
      )}
      {progress >= 2 && (
        <path
          d="M25 26 L27.5 24 L29.5 26.5 L31.6 25.4 L31.2 26.8 L29.4 28 L27.4 25.8 L25.3 27.3Z"
          fill="var(--art-stone-dark)"
        />
      )}
      {/* the nest's front lip covers the egg's base */}
      <ellipse cx={24} cy={37.5} rx={12.5} ry={2.6} fill="var(--art-wood-dark)" />
    </Art>
  );
}

/** Produce icons (inventory, collect reaction). */
export function ProduceArt({ id, className = "h-8 w-8" }: { id: ProduceId; className?: string }) {
  return (
    <Art className={className}>
      <Shadow rx={9} />
      {id === "egg" && (
        <g>
          <ellipse cx={24.5} cy={29.5} rx={8} ry={10} fill="var(--art-stone-dark)" />
          <ellipse cx={24} cy={29} rx={7.5} ry={9.5} fill="var(--art-cream)" />
          <ellipse cx={21} cy={24} rx={2} ry={1.2} fill="var(--art-white)" transform="rotate(-30 21 24)" />
        </g>
      )}
      {id === "golden_egg" && (
        <g>
          <ellipse cx={24.5} cy={29.5} rx={8} ry={10} fill="var(--art-yellow-dark)" />
          <ellipse cx={24} cy={29} rx={7.5} ry={9.5} fill="var(--art-yellow)" />
          <ellipse
            cx={21}
            cy={24}
            rx={2}
            ry={1.2}
            fill="var(--art-yellow-light)"
            transform="rotate(-30 21 24)"
          />
          <Sparkle cx={35} cy={17} r={2.6} fill="var(--art-yellow-dark)" />
        </g>
      )}
      {id === "milk" && (
        <g>
          <rect x={17} y={18} width={14} height={22} rx={4} fill="var(--art-stone-dark)" />
          <rect x={17} y={18} width={13} height={21} rx={4} fill="var(--art-white)" />
          <rect x={19.5} y={11} width={9} height={8} rx={2} fill="var(--art-blue-dark)" />
          <rect x={19.5} y={11} width={8} height={7} rx={2} fill="var(--art-blue)" />
          <rect x={17} y={26} width={13} height={6} fill="var(--art-blue-light)" />
          <rect x={19} y={20} width={2.5} height={4} rx={1.2} fill="var(--art-silver-light)" />
        </g>
      )}
      {id === "wool" && (
        <g>
          <Ball cx={24} cy={30} r={9.5} tone={TONES.pink} />
          <path d="M16 28 Q24 22 32 27 L32 28.6 Q24 24 16 29.6Z" fill="var(--art-pink-dark)" />
          <path d="M17 33 Q24 28 31.5 32.5 L31 34 Q24 30 17.3 34.6Z" fill="var(--art-pink-dark)" />
        </g>
      )}
      {id === "truffle" && (
        <g>
          <ellipse cx={24.5} cy={31} rx={9} ry={7.5} fill="var(--art-soil-deep)" />
          <ellipse cx={23.8} cy={30.3} rx={8.4} ry={7} fill="var(--art-soil-dark)" />
          <circle cx={20} cy={28} r={1.2} fill="var(--art-soil)" />
          <circle cx={26} cy={26.5} r={1} fill="var(--art-soil)" />
          <circle cx={27.5} cy={32} r={1.1} fill="var(--art-soil)" />
        </g>
      )}
      {id === "gift" && (
        <g>
          <rect x={14} y={22} width={20} height={18} rx={3} fill="var(--art-purple-dark)" />
          <rect x={14} y={22} width={19} height={17} rx={3} fill="var(--art-purple)" />
          <rect x={22} y={22} width={4} height={17} fill="var(--art-yellow)" />
          <rect x={13} y={19} width={22} height={6} rx={2.5} fill="var(--art-purple-dark)" />
          <rect x={22} y={19} width={4} height={6} fill="var(--art-yellow-dark)" />
          <ellipse
            cx={20.5}
            cy={17}
            rx={4}
            ry={2.4}
            fill="var(--art-yellow)"
            transform="rotate(-25 20.5 17)"
          />
          <ellipse
            cx={27.5}
            cy={17}
            rx={4}
            ry={2.4}
            fill="var(--art-yellow-dark)"
            transform="rotate(25 27.5 17)"
          />
        </g>
      )}
    </Art>
  );
}

/** A bag of animal feed (setup reward, feed button). */
export function FeedArt({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <Art className={className}>
      <Shadow rx={11} />
      <path d="M14 40 Q12 26 16 16 L32 16 Q36 26 34 40Z" fill="var(--art-wood-dark)" />
      <path d="M14.5 39 Q12.8 26 16.4 16.6 L31 16.6 Q34.4 26 32.6 39Z" fill="var(--art-wood-light)" />
      <rect x={15} y={13} width={18} height={5} rx={2.5} fill="var(--art-wood)" />
      <ellipse
        cx={19}
        cy={23}
        rx={2.4}
        ry={1.3}
        fill="var(--art-white)"
        opacity={0.6}
        transform="rotate(-30 19 23)"
      />
      {/* grains spilling out the top */}
      <circle cx={21} cy={11.5} r={1.6} fill="var(--art-yellow)" />
      <circle cx={24.5} cy={10.5} r={1.7} fill="var(--art-yellow-dark)" />
      <circle cx={27.6} cy={11.8} r={1.5} fill="var(--art-yellow)" />
      <rect x={20} y={27} width={8} height={6} rx={3} fill="var(--art-leaf-2)" />
    </Art>
  );
}
