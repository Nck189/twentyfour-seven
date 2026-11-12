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
/** Minnie 2026-11-12: a light pink bunny and a light brown dog. */
const BLUSH: Tone = {
  base: "var(--art-blush)",
  dark: "var(--art-blush-dark)",
  light: "var(--art-blush-light)",
};
/** Minnie 2026-11-12: the pig is a light pink with a warm orange tint. */
const PEACH: Tone = {
  base: "var(--art-peach)",
  dark: "var(--art-peach-dark)",
  light: "var(--art-peach-light)",
};
const TAN: Tone = { base: "var(--art-wood-light)", dark: "var(--art-wood)", light: "var(--art-cream)" };

type Ears = "round" | "pointy" | "floppy" | "long" | "small" | "banana" | "tipped" | "pig" | "side" | "none";
type Extra =
  | "spots"
  | "wool"
  | "horns"
  | "goatHorns"
  | "mask"
  | "neck"
  | "yuzu"
  | "beard"
  | "topknot"
  | "collie"
  | "wideSnout"
  | "fleece"
  | "shaggy"
  | "capy";
type Beast = {
  plan: "beast";
  body: Tone;
  head?: Tone;
  ears: Ears;
  snout?: Tone;
  tail?: "curl" | "up" | "stripe" | "tuft" | "puff" | "brush" | "wool" | "flick" | "none";
  extras?: Extra[];
  /** Leg color when it differs from the body's shade (red panda). */
  legs?: string;
  /** Cheek color when the default blush would vanish on the fur (pink bunny). */
  cheek?: string;
  /** The wool / fleece / shaggy coat, in its own tones so it never blends into the skin. */
  coat?: Tone;
};
type Bird = {
  plan: "bird";
  body: Tone;
  comb?: boolean;
  long?: boolean;
  sparkle?: boolean;
  /** A duck's flat bill instead of a chick's pointed beak. */
  bill?: "flat";
};
type Spec = Beast | Bird;

const SPECS: Record<AnimalId, Spec> = {
  chicken: { plan: "bird", body: WHITE, comb: true },
  duck: { plan: "bird", body: TONES.yellow, bill: "flat" },
  golden_goose: { plan: "bird", body: TONES.yellow, long: true, sparkle: true, bill: "flat" },
  bunny: { plan: "beast", body: BLUSH, ears: "long", tail: "puff", cheek: "var(--art-pink)" },
  cow: {
    plan: "beast",
    body: WHITE,
    ears: "small",
    snout: TONES.pink,
    tail: "tuft",
    extras: ["spots", "horns"],
  },
  sheep: {
    plan: "beast",
    body: CREAM,
    head: TONES.stone,
    ears: "side",
    tail: "wool",
    extras: ["wool"],
    coat: CREAM,
  },
  pig: { plan: "beast", body: PEACH, ears: "pig", snout: PEACH, tail: "curl" },
  cat: { plan: "beast", body: TONES.silver, ears: "pointy", tail: "up" }, // grey, so it never looks like Som (Minnie)
  // A chocolate border collie (Minnie 2026-11-12; no black in our palette): white blaze, muzzle,
  // ruff and tail tip, ears that stand and fold at the tip.
  dog: { plan: "beast", body: TAN, ears: "tipped", tail: "brush", extras: ["collie"] },
  // A white goat in a shaggy caramel coat (Minnie: the coat must not blend into the body).
  goat: {
    plan: "beast",
    body: WHITE,
    ears: "side",
    tail: "flick",
    extras: ["goatHorns", "beard", "shaggy"],
    coat: TAN,
  },
  capybara: {
    plan: "beast",
    body: TONES.wood,
    ears: "none",
    tail: "none",
    // A bread-loaf head, a big blunt muzzle, tiny ears up top and calm half-closed eyes.
    extras: ["yuzu", "capy"],
  },
  // A caramel face and legs under a cream fleece that covers the body and the whole neck.
  alpaca: {
    plan: "beast",
    body: TAN,
    ears: "banana",
    tail: "wool",
    extras: ["neck", "topknot", "fleece"],
    coat: CREAM,
  },
  red_panda: {
    plan: "beast",
    body: { base: "var(--art-rust)", dark: "var(--art-rust-dark)", light: "var(--art-rust-light)" },
    ears: "pointy",
    tail: "stripe",
    extras: ["mask"],
    legs: "var(--art-soil-deep)",
  },
};

/** Eyes: open dots (with a blink) or sleepy closed lids. */
function Eyes({ x, y, sleepy, r = 1.15 }: { x: number; y: number; sleepy: boolean; r?: number }) {
  if (sleepy) return <ellipse cx={x} cy={y + 0.6} rx={1.5} ry={0.45} fill={EYE} />;
  const k = r / 1.15;
  return (
    <g className="animal-blink">
      <circle cx={x} cy={y} r={r} fill={EYE} />
      <circle cx={x - 0.35 * k} cy={y - 0.4 * k} r={0.35 * k} fill="var(--art-white)" />
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

/** A lobe of a fluffy shape: [cx, cy, rx, ry = rx, rotation = 0]. */
type Lobe = readonly [number, number, number, number?, number?];

/**
 * One soft fluffy mass (wool, fleece, a shaggy coat): every lobe is drawn in the dark tone nudged
 * lower-right, then every lobe in the base tone on top, so the lobes merge into a single shape with
 * one shaded rim (never a chain of separate beads).
 */
function Fluff({ lobes, tone, d = 0.7 }: { lobes: readonly Lobe[]; tone: Tone; d?: number }) {
  const draw = (fill: string, o: number) => (
    <g fill={fill}>
      {lobes.map(([x, y, rx, ry = rx, rot = 0], i) => (
        <ellipse
          key={i}
          cx={x + o}
          cy={y + o}
          rx={rx}
          ry={ry}
          transform={rot ? `rotate(${rot} ${x + o} ${y + o})` : undefined}
        />
      ))}
    </g>
  );
  return (
    <g>
      {draw(tone.dark, d)}
      {draw(tone.base, 0)}
    </g>
  );
}

function BeastArt({ s, sleepy }: { s: Beast; sleepy: boolean }) {
  const head = s.head ?? s.body;
  const has = (e: Extra) => s.extras?.includes(e) ?? false;
  const coat = s.coat ?? s.body;
  const neck = has("neck");
  // Chibi (Minnie 2026-11-12, like Som): a big head (drawn at r 7.2, scaled by K) on a small body.
  const hx = neck ? 17 : 16;
  const hy = (neck ? 15 : 23) + (sleepy ? 1.5 : 0);
  const K = neck ? 1.3 : 1.45;
  return (
    <g>
      <Shadow cx={23} rx={15} />
      {/* tail (behind the body) */}
      {s.tail === "up" && (
        <ellipse cx={37.6} cy={25.5} rx={2} ry={5.2} fill={s.body.dark} transform="rotate(25 37.6 25.5)" />
      )}
      {s.tail === "stripe" && (
        <g transform="rotate(35 37.5 27)">
          <ellipse cx={37.5} cy={27} rx={3} ry={6.6} fill={s.body.base} />
          <rect x={34.9} y={24.2} width={5.2} height={1.8} rx={0.9} fill={s.body.light} />
          <rect x={34.9} y={28} width={5.2} height={1.8} rx={0.9} fill={s.body.light} />
        </g>
      )}
      {s.tail === "curl" && (
        <path
          d="M36.8 29.5 q2.6 .2 2.4 -1.8 q-.2 -1.6 -1.6 -1"
          fill="none"
          stroke={s.body.dark}
          strokeWidth={1.3}
          strokeLinecap="round"
        />
      )}
      {s.tail === "tuft" && (
        <g>
          <ellipse cx={38.4} cy={31.4} rx={1.4} ry={3} fill={s.body.dark} transform="rotate(20 38.4 31.4)" />
          <circle cx={37.6} cy={34.2} r={1.3} fill="var(--art-wood)" />
        </g>
      )}
      {s.tail === "puff" && <circle cx={37.8} cy={31} r={2.6} fill={WHITE.base} />}
      {s.tail === "wool" && (
        // A woolly tail: one soft puff peeking out at the back.
        <g>
          <Fluff
            tone={coat}
            lobes={[
              [38.6, 28.4, 2.3],
              [39.8, 30.2, 1.8],
              [37.6, 30.4, 2.2],
            ]}
          />
          <ellipse cx={37.8} cy={27.6} rx={1} ry={0.6} fill={coat.light} transform="rotate(-30 37.8 27.6)" />
        </g>
      )}
      {s.tail === "flick" && (
        // A goat's short tail, flicked up, in the coat's colour.
        <g>
          <ellipse cx={38.4} cy={26.8} rx={1.4} ry={2.8} fill={coat.dark} transform="rotate(35 38.4 26.8)" />
          <ellipse cx={38} cy={26.6} rx={1.1} ry={2.4} fill={coat.base} transform="rotate(35 38 26.6)" />
        </g>
      )}
      {s.tail === "brush" && (
        <g>
          <ellipse cx={38.4} cy={33.4} rx={2} ry={4.4} fill={s.body.dark} transform="rotate(-30 38.4 33.4)" />
          <circle cx={40.6} cy={37} r={1.8} fill="var(--art-cream)" />
        </g>
      )}
      {/* legs */}
      {[21.8, 25.2, 31.4, 34.8].map((x) => (
        <rect key={x} x={x - 1.6} y={34} width={3.2} height={6} rx={1.6} fill={s.legs ?? s.body.dark} />
      ))}
      {/* body: darker shape lower-right, base, top-left highlight */}
      {!has("fleece") && (
        <g>
          <ellipse cx={28.6} cy={31.6} rx={9.8} ry={6.4} fill={s.body.dark} />
          <ellipse cx={28} cy={31} rx={9.4} ry={6} fill={s.body.base} />
          <ellipse cx={27} cy={27} rx={3.6} ry={1.4} fill={s.body.light} transform="rotate(-10 27 27)" />
        </g>
      )}
      {has("spots") && (
        <g fill="var(--art-wood)">
          <ellipse cx={30.5} cy={29.4} rx={2.8} ry={2.1} />
          <ellipse cx={34.6} cy={33} rx={2} ry={1.5} />
        </g>
      )}
      {has("wool") && (
        // Sheep: lots of small curly lobes merged into one fluffy cloud over the body.
        <g>
          <Fluff
            tone={coat}
            lobes={[
              [22.4, 28.4, 2.9],
              [25.8, 25.9, 3],
              [29.8, 25.2, 3.1],
              [33.8, 26, 2.9],
              [36.6, 29, 2.6],
              [36.4, 32.4, 2.5],
              [33.2, 34, 2.6],
              [29, 34.4, 2.7],
              [24.8, 34, 2.7],
              [21.8, 31.6, 2.7],
              [29, 30, 8, 4.8],
            ]}
          />
          <ellipse cx={30} cy={23.6} rx={1.4} ry={0.55} fill={coat.light} transform="rotate(-12 30 23.6)" />
        </g>
      )}
      {has("shaggy") && (
        // Goat: a shaggy coat over the back whose hem hangs in long soft locks.
        <g>
          <Fluff
            tone={coat}
            d={0.6}
            lobes={[
              [29.8, 29, 8.4, 4.6],
              [22.8, 31.8, 1.9, 3.2, 12],
              [25.8, 33, 1.9, 3.2, 6],
              [29, 33.6, 1.9, 3.2, 0],
              [32.2, 33.2, 1.9, 3.2, -6],
              [35.2, 32, 1.8, 3, -14],
              [37.4, 29.6, 1.6, 2.6, -32],
            ]}
          />
          <ellipse cx={30.6} cy={25.5} rx={1.6} ry={0.4} fill={coat.light} transform="rotate(4 30.6 25.5)" />
        </g>
      )}
      {has("collie") && <ellipse cx={23.5} cy={32.5} rx={4.4} ry={4.6} fill="var(--art-cream)" />}
      {/* neck (alpaca) */}
      {neck && !has("fleece") && (
        <g>
          <rect x={hx - 0.6} y={hy} width={5.2} height={33 - hy} rx={2.6} fill={s.body.dark} />
          <rect x={hx - 2.2} y={hy} width={5.2} height={33 - hy} rx={2.6} fill={s.body.base} />
        </g>
      )}
      {has("fleece") && (
        // Alpaca: one soft fleece from the chin down the whole neck and over the body (no bare neck),
        // in a few big lobes so it reads as a cloud, not a stack of beads.
        <g>
          <Fluff
            tone={coat}
            d={0.8}
            lobes={[
              [hx + 0.4, hy + 11, 3.6, 7.4],
              [hx - 1.6, hy + 12.4, 2.6, 3.4],
              [hx + 2.4, hy + 11.6, 2.6, 3.4],
              [hx - 0.2, hy + 16.6, 3.8, 3.6],
              [24.6, 30.4, 3.2],
              [28.6, 28.2, 3.4],
              [33.2, 28.4, 3.4],
              [36.2, 31.2, 2.8],
              [33.6, 34.2, 3],
              [28.4, 34.6, 3.2],
              [23.6, 34, 3],
              [29.2, 31.6, 7, 3.8],
            ]}
          />
          <ellipse cx={28} cy={25.8} rx={1.6} ry={0.6} fill={coat.light} transform="rotate(-10 28 25.8)" />
        </g>
      )}
      <g transform={`translate(${hx} ${hy}) scale(${K}) translate(${-hx} ${-hy})`}>
        {/* ears */}
        {s.ears === "long" && (
          <g>
            <ellipse
              cx={hx - 3}
              cy={hy - 9}
              rx={1.9}
              ry={5}
              fill={head.base}
              transform={`rotate(-12 ${hx - 3} ${hy - 9})`}
            />
            <ellipse
              cx={hx - 3}
              cy={hy - 9}
              rx={0.8}
              ry={3.6}
              fill={TONES.pink.base}
              transform={`rotate(-12 ${hx - 3} ${hy - 9})`}
            />
            <ellipse
              cx={hx + 3}
              cy={hy - 9.5}
              rx={1.9}
              ry={5}
              fill={head.dark}
              transform={`rotate(10 ${hx + 3} ${hy - 9.5})`}
            />
          </g>
        )}
        {s.ears === "pointy" && (
          // Soft rounded ears like Som's (scaled), the near one lighter, with an inner ear.
          <g>
            <path
              d={`M${hx - 6.2} ${hy - 2.6} Q${hx - 6.8} ${hy - 8.5} ${hx - 4.6} ${hy - 7.9} Q${hx - 3} ${hy - 7.2} ${hx - 2} ${hy - 5.6}Z`}
              fill={head.base}
            />
            <path
              d={`M${hx + 6.2} ${hy - 2.6} Q${hx + 6.8} ${hy - 8.5} ${hx + 4.6} ${hy - 7.9} Q${hx + 3} ${hy - 7.2} ${hx + 2} ${hy - 5.6}Z`}
              fill={head.dark}
            />
            <path
              d={`M${hx - 5.5} ${hy - 3.9} Q${hx - 5.7} ${hy - 6.9} ${hx - 4.4} ${hy - 6.6} Q${hx - 3.6} ${hy - 6.1} ${hx - 3.1} ${hy - 5.5}Z`}
              fill={has("mask") ? "var(--art-cream)" : TONES.pink.light}
            />
            {has("mask") && (
              <path
                d={`M${hx + 5.5} ${hy - 3.9} Q${hx + 5.7} ${hy - 6.9} ${hx + 4.4} ${hy - 6.6} Q${hx + 3.6} ${hy - 6.1} ${hx + 3.1} ${hy - 5.5}Z`}
                fill="var(--art-cream)"
              />
            )}
          </g>
        )}
        {s.ears === "pig" && (
          <g fill={head.dark}>
            <ellipse
              cx={hx - 4.4}
              cy={hy - 6.2}
              rx={2.2}
              ry={2.8}
              transform={`rotate(-35 ${hx - 4.4} ${hy - 6.2})`}
            />
            <ellipse
              cx={hx + 4.4}
              cy={hy - 6.2}
              rx={2.2}
              ry={2.8}
              transform={`rotate(35 ${hx + 4.4} ${hy - 6.2})`}
            />
          </g>
        )}
        {s.ears === "side" && (
          // Goat ears: long, sticking out sideways.
          <g fill={head.dark}>
            <ellipse
              cx={hx - 7}
              cy={hy - 1.5}
              rx={3}
              ry={1.3}
              transform={`rotate(20 ${hx - 7} ${hy - 1.5})`}
            />
            <ellipse
              cx={hx + 7}
              cy={hy - 1.5}
              rx={3}
              ry={1.3}
              transform={`rotate(-20 ${hx + 7} ${hy - 1.5})`}
            />
          </g>
        )}
        {s.ears === "tipped" && (
          // Border collie ears: wide roots sunk into the head, leaning outward, a pale inner ear.
          <g>
            {[-1, 1].map((d) => (
              <g key={d} transform={`rotate(${-24 * d} ${hx + 4.4 * d} ${hy - 4})`}>
                <path
                  d={`M${hx + 1.6 * d} ${hy - 3} Q${hx + 1.8 * d} ${hy - 8} ${hx + 2.8 * d} ${hy - 9.8} Q${hx + 4.4 * d} ${hy - 11.6} ${hx + 6 * d} ${hy - 9.8} Q${hx + 7.2 * d} ${hy - 8} ${hx + 7.2 * d} ${hy - 3}Z`}
                  fill={head.dark}
                />
                <path
                  d={`M${hx + 3 * d} ${hy - 4} Q${hx + 3.2 * d} ${hy - 7.6} ${hx + 4.4 * d} ${hy - 8.8} Q${hx + 5.6 * d} ${hy - 7.6} ${hx + 5.8 * d} ${hy - 4}Z`}
                  fill={TONES.pink.light}
                />
              </g>
            ))}
          </g>
        )}
        {s.ears === "banana" && (
          <g fill={head.dark}>
            <ellipse
              cx={hx - 3.5}
              cy={hy - 7}
              rx={1.5}
              ry={3.6}
              transform={`rotate(-18 ${hx - 3.5} ${hy - 7})`}
            />
            <ellipse
              cx={hx + 3.5}
              cy={hy - 7}
              rx={1.5}
              ry={3.6}
              transform={`rotate(18 ${hx + 3.5} ${hy - 7})`}
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
        {has("horns") && (
          <g fill="var(--art-wood-light)">
            <ellipse
              cx={hx - 2.6}
              cy={hy - 7}
              rx={1.1}
              ry={1.8}
              transform={`rotate(-20 ${hx - 2.6} ${hy - 7})`}
            />
            <ellipse
              cx={hx + 2.6}
              cy={hy - 7}
              rx={1.1}
              ry={1.8}
              transform={`rotate(20 ${hx + 2.6} ${hy - 7})`}
            />
          </g>
        )}
        {has("goatHorns") && (
          <g>
            {[-1, 1].map((d) => (
              <g key={d} transform={`rotate(${28 * d} ${hx + 2.6 * d} ${hy - 8})`}>
                <ellipse cx={hx + 2.6 * d} cy={hy - 8} rx={1.2} ry={3.4} fill="var(--art-stone-dark)" />
                <ellipse cx={hx + 2.6 * d - 0.4} cy={hy - 8.6} rx={0.4} ry={2.2} fill="var(--art-stone)" />
              </g>
            ))}
          </g>
        )}
        {has("beard") && (
          // A small soft goatee hanging from under the chin (drawn behind the head).
          <g>
            {[
              [0.4, "var(--art-stone-dark)"],
              [0, "var(--art-stone)"],
            ].map(([o, fill]) => (
              <path
                key={String(o)}
                transform={`translate(${o} ${o})`}
                fill={String(fill)}
                d={`M${hx - 1.4} ${hy + 4} Q${hx - 1.5} ${hy + 8} ${hx - 0.2} ${hy + 9.2} Q${hx + 0.3} ${hy + 9.6} ${hx + 0.7} ${hy + 9} Q${hx + 1.6} ${hy + 7.6} ${hx + 1.4} ${hy + 4}Z`}
              />
            ))}
          </g>
        )}
        {/* head */}
        {/* a soft mochi head, a little wider than tall (like Som) */}
        {has("capy") ? (
          // A calm loaf: a soft squircle, wider than tall, with two tiny round ears half sunk on top.
          <g>
            {[-1, 1].map((d) => (
              <g key={d}>
                <ellipse cx={hx + 4.8 * d} cy={hy - 6.2} rx={1.7} ry={1.4} fill={head.dark} />
                <ellipse cx={hx + 4.8 * d} cy={hy - 6.3} rx={0.8} ry={0.6} fill="var(--art-wood-dark)" />
              </g>
            ))}
            {[
              [0.6, head.dark],
              [0, head.base],
            ].map(([o, fill]) => (
              <path
                key={String(o)}
                transform={`translate(${o} ${o})`}
                fill={String(fill)}
                d={`M${hx} ${hy - 6.6} C${hx + 5.4} ${hy - 6.6} ${hx + 7.8} ${hy - 5.4} ${hx + 7.8} ${hy} C${hx + 7.8} ${hy + 5.4} ${hx + 5.6} ${hy + 6.8} ${hx} ${hy + 6.8} C${hx - 5.6} ${hy + 6.8} ${hx - 7.8} ${hy + 5.4} ${hx - 7.8} ${hy} C${hx - 7.8} ${hy - 5.4} ${hx - 5.4} ${hy - 6.6} ${hx} ${hy - 6.6}Z`}
              />
            ))}
          </g>
        ) : (
          <g>
            <ellipse cx={hx} cy={hy} rx={7.6} ry={6.8} fill={head.dark} />
            <ellipse cx={hx - 0.5} cy={hy - 0.5} rx={7.1} ry={6.3} fill={head.base} />
          </g>
        )}
        <ellipse
          cx={hx - 3}
          cy={hy - 4}
          rx={2}
          ry={1.1}
          fill={head.light}
          transform={`rotate(-35 ${hx - 3} ${hy - 4})`}
        />
        {has("collie") && (
          <path
            d={`M${hx - 0.5} ${hy - 6.4} Q${hx} ${hy - 6.9} ${hx + 0.5} ${hy - 6.4} L${hx + 1.5} ${hy + 1} L${hx - 1.5} ${hy + 1}Z`}
            fill="var(--art-cream)"
          />
        )}
        {s.ears === "tipped" && (
          // ...and the tips folded forward: the darker back of the ear hangs over the top, its rounded
          // point dropping a little outward.
          <g fill="var(--art-wood-dark)">
            {[-1, 1].map((d) => (
              <path
                key={d}
                transform={`rotate(${-24 * d} ${hx + 4.4 * d} ${hy - 4})`}
                d={`M${hx + 2.75 * d} ${hy - 9.8} Q${hx + 4.4 * d} ${hy - 11.7} ${hx + 6.05 * d} ${hy - 9.8} Q${hx + 6.5 * d} ${hy - 8.2} ${hx + 5.6 * d} ${hy - 7.1} Q${hx + 4.9 * d} ${hy - 6.4} ${hx + 4.3 * d} ${hy - 7.3} Q${hx + 3 * d} ${hy - 8.4} ${hx + 2.75 * d} ${hy - 9.8}Z`}
              />
            ))}
          </g>
        )}
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
        {has("wool") && (
          // A woolly bonnet: curly lobes framing the face from ear to ear, so the head is never bald.
          <g>
            <Fluff
              tone={coat}
              d={0.5}
              lobes={[
                [hx - 6.2, hy - 1.6, 2],
                [hx - 5.2, hy - 4.6, 2.3],
                [hx - 2.4, hy - 6.4, 2.5],
                [hx + 1, hy - 6.8, 2.6],
                [hx + 4.2, hy - 5.6, 2.4],
                [hx + 6.3, hy - 2.6, 2],
                [hx, hy - 4.6, 5.4, 2.4],
                [hx - 2.6, hy - 3.2, 1.6],
                [hx + 0.4, hy - 2.8, 1.7],
                [hx + 3.3, hy - 3.3, 1.5],
              ]}
            />
            <ellipse
              cx={hx - 3}
              cy={hy - 6.8}
              rx={1.1}
              ry={0.5}
              fill={coat.light}
              transform={`rotate(-30 ${hx - 3} ${hy - 6.8})`}
            />
          </g>
        )}
        {has("topknot") && (
          // The alpaca's fluffy fringe, the same fleece as its neck.
          <g>
            <Fluff
              tone={coat}
              d={0.5}
              lobes={[
                [hx - 3.6, hy - 4.8, 2.4],
                [hx, hy - 6.2, 2.9],
                [hx + 3.6, hy - 4.8, 2.4],
                [hx, hy - 4.4, 4.6, 2],
              ]}
            />
            <ellipse
              cx={hx - 1.6}
              cy={hy - 7}
              rx={1.1}
              ry={0.5}
              fill={coat.light}
              transform={`rotate(-25 ${hx - 1.6} ${hy - 7})`}
            />
          </g>
        )}
        {has("spots") && <ellipse cx={hx + 3.4} cy={hy - 3.6} rx={2.4} ry={1.8} fill="var(--art-wood)" />}
        {has("shaggy") && (
          // A little caramel forelock between the horns, tying the face to the coat.
          <Fluff
            tone={coat}
            d={0.4}
            lobes={[
              [hx - 0.2, hy - 5.9, 1.7, 0.9, -14],
              [hx + 1.1, hy - 5.4, 0.9, 1.2, 28],
            ]}
          />
        )}
        {has("mask") && (
          // Red panda: white cheeks and muzzle, white brows, rust "tear" marks under the eyes.
          <g>
            <g fill="var(--art-white)">
              <ellipse cx={hx - 4.8} cy={hy + 2.2} rx={2} ry={2.6} />
              <ellipse cx={hx + 4.8} cy={hy + 2.2} rx={2} ry={2.6} />
              <ellipse cx={hx} cy={hy + 3.8} rx={3} ry={2.2} />
              <ellipse cx={hx - 2.8} cy={hy - 2.4} rx={1.2} ry={0.7} />
              <ellipse cx={hx + 2.8} cy={hy - 2.4} rx={1.2} ry={0.7} />
            </g>
            <g fill={head.dark}>
              <ellipse cx={hx - 3.9} cy={hy + 4} rx={0.6} ry={1} />
              <ellipse cx={hx + 3.9} cy={hy + 4} rx={0.6} ry={1} />
            </g>
          </g>
        )}
        {has("yuzu") && (
          <g>
            <Ball cx={hx + 1} cy={hy - 8} r={2.6} tone={TONES.yellow} />
            <ellipse
              cx={hx + 2.6}
              cy={hy - 10.3}
              rx={1}
              ry={0.5}
              fill="var(--art-leaf-3)"
              transform={`rotate(-30 ${hx + 2.6} ${hy - 10.3})`}
            />
          </g>
        )}
        {/* face */}
        {has("capy") ? (
          // Capybara: small calm eyes set high and wide, a big dark nose low on the loaf, a tiny smile.
          <g>
            <Eyes x={hx - 3.9} y={hy - 1.4} sleepy={sleepy} r={0.95} />
            <Eyes x={hx + 3.9} y={hy - 1.4} sleepy={sleepy} r={0.95} />
            <ellipse cx={hx - 5} cy={hy + 1.6} rx={1.4} ry={0.8} fill={CHEEK} />
            <ellipse cx={hx + 5} cy={hy + 1.6} rx={1.4} ry={0.8} fill={CHEEK} />
            <ellipse cx={hx} cy={hy + 2.2} rx={2.5} ry={1.5} fill={EYE} />
            <ellipse
              cx={hx - 0.9}
              cy={hy + 1.6}
              rx={0.8}
              ry={0.35}
              fill="var(--art-wood)"
              transform={`rotate(-15 ${hx - 0.9} ${hy + 1.6})`}
            />
            <path
              d={`M${hx - 1.3} ${hy + 4.3} Q${hx - 0.65} ${hy + 5.2} ${hx} ${hy + 4.4} Q${hx + 0.65} ${hy + 5.2} ${hx + 1.3} ${hy + 4.3}`}
              fill="none"
              stroke={EYE}
              strokeWidth={0.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ) : (
          <g>
            <Eyes x={hx - 3.6} y={hy + 0.8} sleepy={sleepy} />
            <Eyes x={hx + 3.6} y={hy + 0.8} sleepy={sleepy} />
            <ellipse cx={hx - 4.9} cy={hy + 3} rx={1.4} ry={0.8} fill={s.cheek ?? CHEEK} />
            <ellipse cx={hx + 4.9} cy={hy + 3} rx={1.4} ry={0.8} fill={s.cheek ?? CHEEK} />
          </g>
        )}
        {has("capy") ? null : has("collie") ? (
          <g>
            <ellipse cx={hx} cy={hy + 3.4} rx={3.3} ry={2.3} fill="var(--art-cream)" />
            <ellipse cx={hx} cy={hy + 2.5} rx={1.15} ry={0.8} fill="var(--art-wood-dark)" />
          </g>
        ) : s.snout ? (
          <g>
            <ellipse
              cx={hx}
              cy={hy + 3.6}
              rx={has("wideSnout") ? 3.8 : 3}
              ry={has("wideSnout") ? 2.4 : 2}
              fill={s.snout.light === s.snout.base ? s.snout.dark : s.snout.light}
            />
            <circle cx={hx - 1} cy={hy + 3.6} r={0.55} fill={s.snout.dark} />
            <circle cx={hx + 1} cy={hy + 3.6} r={0.55} fill={s.snout.dark} />
          </g>
        ) : (
          <ellipse cx={hx} cy={hy + 2.9} rx={0.9} ry={0.6} fill={TONES.pink.dark} />
        )}
      </g>
      {sleepy && <Zz x={hx + 13} y={Math.max(hy - 8, 9)} />}
    </g>
  );
}

function BirdArt({ s, sleepy }: { s: Bird; sleepy: boolean }) {
  const hx = s.long ? 19.5 : 18.5;
  const hy = (s.long ? 14 : 21.5) + (sleepy ? 1.5 : 0);
  const K = s.long ? 1.3 : 1.5;
  const legs = "var(--art-orange-dark)";
  return (
    <g>
      <Shadow cx={25} rx={10} />
      {[24.3, 29.8].map((x) => (
        <g key={x}>
          <rect x={x - 0.8} y={35.5} width={1.6} height={4} rx={0.8} fill={legs} />
          {s.bill === "flat" ? (
            // A duck's webbed paddle foot: one soft rounded fan pointing forward.
            <g>
              {[
                [0.35, "var(--art-orange-dark)"],
                [0, "var(--art-orange)"],
              ].map(([o, fill]) => (
                <path
                  key={String(o)}
                  transform={`translate(${o} ${o})`}
                  fill={String(fill)}
                  d={`M${x + 0.9} ${38.9} Q${x - 0.8} ${38.4} ${x - 2.9} ${38.7} Q${x - 3.8} ${38.9} ${x - 3.3} ${39.5} Q${x - 4} ${40} ${x - 3.1} ${40.3} Q${x - 1} ${40.6} ${x + 1.1} ${40.1} Q${x + 1.6} ${39.4} ${x + 0.9} ${38.9}Z`}
                />
              ))}
            </g>
          ) : (
            // A chicken's foot: three short rounded toes forward, one behind.
            <Fluff
              tone={TONES.orange}
              d={0.25}
              lobes={[
                [x - 1.6, 39.75, 1.7, 0.45, 6],
                [x - 1.2, 39.05, 1.5, 0.42, -24],
                [x - 0.1, 39.9, 1.1, 0.42, 40],
                [x + 1.1, 39.8, 1, 0.42, -8],
              ]}
            />
          )}
        </g>
      ))}
      {/* body */}
      <ellipse cx={27.6} cy={31.4} rx={9.6} ry={7} fill={s.body.dark} />
      <ellipse cx={27} cy={30.8} rx={9.1} ry={6.5} fill={s.body.base} />
      <ellipse cx={26} cy={26.6} rx={3} ry={1.3} fill={s.body.light} transform="rotate(-15 26 26.6)" />
      {/* tail feathers + wing */}
      {/* a short, upturned tail: two soft rounded feathers */}
      <ellipse cx={37.8} cy={27.2} rx={3.4} ry={1.7} fill={s.body.dark} transform="rotate(-38 37.8 27.2)" />
      <ellipse cx={36.8} cy={28.6} rx={2.8} ry={1.5} fill={s.body.base} transform="rotate(-24 36.8 28.6)" />
      <ellipse cx={30} cy={31.6} rx={4.6} ry={3} fill={s.body.dark} transform="rotate(-15 30 31.6)" />
      {s.long && <rect x={hx - 2.6} y={hy} width={5.2} height={32 - hy} rx={2.6} fill={s.body.base} />}
      {/* head */}
      <g transform={`translate(${hx} ${hy}) scale(${K}) translate(${-hx} ${-hy})`}>
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
        {s.bill === "flat" ? (
          <g>
            {/* lower bill tucked under (darker), the upper bill with a rounded spoon tip and a soft
                bulb where it meets the face, a ridge highlight top-left, a nostril and a smile */}
            <path
              d={`M${hx - 3.8} ${hy + 2} Q${hx - 6.8} ${hy + 2.1} ${hx - 8.2} ${hy + 2.7} Q${hx - 7.6} ${hy + 3.9} ${hx - 5.2} ${hy + 3.8} Q${hx - 3.8} ${hy + 3.7} ${hx - 3.8} ${hy + 2}Z`}
              fill="var(--art-orange-dark)"
            />
            <path
              d={`M${hx - 3.6} ${hy - 0.1} Q${hx - 6.6} ${hy - 0.8} ${hx - 8.7} ${hy + 0.4} Q${hx - 10} ${hy + 1.4} ${hx - 9} ${hy + 2.3} Q${hx - 6.4} ${hy + 3} ${hx - 3.8} ${hy + 2.6} Q${hx - 2.6} ${hy + 1.2} ${hx - 3.6} ${hy - 0.1}Z`}
              fill="var(--art-orange)"
            />
            <ellipse
              cx={hx - 6.4}
              cy={hy + 0.2}
              rx={1.9}
              ry={0.42}
              fill="var(--art-orange-light)"
              transform={`rotate(-6 ${hx - 6.4} ${hy + 0.2})`}
            />
            <ellipse cx={hx - 7.3} cy={hy + 1.1} rx={0.4} ry={0.25} fill="var(--art-orange-dark)" />
            <path
              d={`M${hx - 4.6} ${hy + 2.3} Q${hx - 3.8} ${hy + 2.7} ${hx - 3.3} ${hy + 1.9} Q${hx - 3.7} ${hy + 3.2} ${hx - 4.6} ${hy + 2.3}Z`}
              fill="var(--art-orange-dark)"
            />
          </g>
        ) : (
          <path
            d={`M${hx - 5} ${hy + 0.6} L${hx - 9} ${hy + 2} L${hx - 5} ${hy + 3}Z`}
            fill="var(--art-orange)"
          />
        )}
        {s.comb && <ellipse cx={hx - 3.8} cy={hy + 3.6} rx={1} ry={1.4} fill="var(--art-red)" />}
        <Eyes x={hx - 1.6} y={hy - 0.6} sleepy={sleepy} />
        {!sleepy && <ellipse cx={hx + 1.2} cy={hy + 2} rx={1.3} ry={0.7} fill={CHEEK} />}
      </g>
      {s.sparkle && (
        <g>
          <Sparkle cx={36} cy={14} r={2.4} fill="var(--art-yellow-dark)" />
          <Sparkle cx={8} cy={30} r={1.8} fill="var(--art-yellow-dark)" />
        </g>
      )}
      {sleepy && <Zz x={hx + 9} y={Math.max(hy - 8, 9)} />}
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
