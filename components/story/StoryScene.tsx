/**
 * Cutscene backdrops (docs/STORY.md): a wide flat scene, same artist as the farm (no outlines,
 * 2–3 tones, light from the top-left). The sky is the only gradient.
 */
import type { StoryScene as SceneId } from "@/content/story";

const GROUND = 78;
/** Water scenes: the pond runs from just above the ground line to this bank. */
const BANK = 90;

function Tuft({ x, s = 1 }: { x: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${GROUND}) scale(${s})`}>
      <ellipse cx={-3} cy={-5} rx={2} ry={6} fill="var(--art-leaf-4)" transform="rotate(-20 -3 -5)" />
      <ellipse cx={0} cy={-7} rx={2.2} ry={8} fill="var(--art-leaf-3)" />
      <ellipse cx={3} cy={-5} rx={2} ry={6} fill="var(--art-leaf-2)" transform="rotate(22 3 -5)" />
    </g>
  );
}

function Fence({ from, to, gate = false }: { from: number; to: number; gate?: boolean }) {
  const posts: number[] = [];
  for (let x = from; x <= to; x += 14) posts.push(x);
  return (
    <g>
      <rect x={from} y={GROUND - 20} width={to - from + 4} height={3} rx={1.5} fill="var(--art-wood-dark)" />
      <rect x={from} y={GROUND - 11} width={to - from + 4} height={3} rx={1.5} fill="var(--art-wood-dark)" />
      {posts.map((x) => (
        <g key={x}>
          <rect x={x} y={GROUND - 26} width={5} height={26} rx={2.5} fill="var(--art-wood)" />
          <rect x={x} y={GROUND - 26} width={2} height={20} rx={1} fill="var(--art-wood-light)" />
        </g>
      ))}
      {gate && (
        <g>
          {/* a gate left ajar, overgrown with a vine */}
          <rect
            x={to + 10}
            y={GROUND - 24}
            width={22}
            height={22}
            rx={3}
            fill="var(--art-wood)"
            transform={`skewY(-8)`}
          />
          <rect
            x={to + 13}
            y={GROUND - 19}
            width={16}
            height={2.4}
            rx={1.2}
            fill="var(--art-wood-dark)"
            transform={`skewY(-8)`}
          />
          <ellipse cx={to + 16} cy={GROUND - 22} rx={4} ry={2.4} fill="var(--art-leaf-3)" />
          <ellipse cx={to + 24} cy={GROUND - 26} rx={3.4} ry={2} fill="var(--art-leaf-2)" />
        </g>
      )}
    </g>
  );
}

function Rows() {
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <ellipse cx={80} cy={GROUND + 6 + i * 7} rx={70 - i * 6} ry={3.2} fill="var(--art-soil-dark)" />
          <ellipse cx={80} cy={GROUND + 5 + i * 7} rx={68 - i * 6} ry={2.6} fill="var(--art-soil)" />
        </g>
      ))}
      {[22, 42, 118, 138].map((x) => (
        <g key={x}>
          <ellipse
            cx={x - 2}
            cy={GROUND + 1}
            rx={2}
            ry={4.5}
            fill="var(--art-leaf-3)"
            transform={`rotate(-20 ${x - 2} ${GROUND + 1})`}
          />
          <ellipse
            cx={x + 2}
            cy={GROUND + 1}
            rx={2}
            ry={4.5}
            fill="var(--art-leaf-2)"
            transform={`rotate(20 ${x + 2} ${GROUND + 1})`}
          />
        </g>
      ))}
      {/* a pulled radish */}
      <g>
        <ellipse cx={128} cy={GROUND + 12} rx={4.5} ry={5} fill="var(--art-pink-dark)" />
        <ellipse cx={127.4} cy={GROUND + 11.4} rx={4} ry={4.5} fill="var(--art-pink)" />
        <ellipse cx={126} cy={GROUND + 9.6} rx={1.4} ry={0.8} fill="var(--art-pink-light)" />
        <ellipse
          cx={126}
          cy={GROUND + 4}
          rx={1.6}
          ry={4}
          fill="var(--art-leaf-3)"
          transform={`rotate(-15 126 ${GROUND + 4})`}
        />
        <ellipse
          cx={130}
          cy={GROUND + 4}
          rx={1.6}
          ry={4}
          fill="var(--art-leaf-2)"
          transform={`rotate(15 130 ${GROUND + 4})`}
        />
      </g>
    </g>
  );
}

function Shed() {
  return (
    <g>
      <rect x={14} y={GROUND - 48} width={58} height={48} rx={3} fill="var(--art-wood-dark)" />
      <rect x={12} y={GROUND - 50} width={58} height={48} rx={3} fill="var(--art-wood)" />
      {[24, 36, 48, 60].map((x) => (
        <rect key={x} x={x} y={GROUND - 48} width={1.6} height={44} rx={0.8} fill="var(--art-wood-dark)" />
      ))}
      <path d={`M6 ${GROUND - 48} L41 ${GROUND - 66} L76 ${GROUND - 48}Z`} fill="var(--art-red-dark)" />
      <path d={`M8 ${GROUND - 49} L41 ${GROUND - 65} L72 ${GROUND - 49}Z`} fill="var(--art-red)" />
      <rect x={30} y={GROUND - 30} width={20} height={30} rx={2} fill="var(--art-soil-dark)" />
      {/* the old watering can */}
      <g>
        <rect x={104} y={GROUND - 14} width={18} height={14} rx={4} fill="var(--art-blue-dark)" />
        <rect x={103} y={GROUND - 15} width={17} height={13} rx={4} fill="var(--art-blue)" />
        <rect x={105} y={GROUND - 13} width={5} height={2} rx={1} fill="var(--art-blue-light)" />
        <path
          d={`M120 ${GROUND - 10} L132 ${GROUND - 18} L133 ${GROUND - 15} L121 ${GROUND - 6}Z`}
          fill="var(--art-blue-dark)"
        />
        <ellipse cx={111} cy={GROUND - 17} rx={5} ry={2} fill="var(--art-blue-dark)" />
      </g>
    </g>
  );
}

/** Still water from the ground line down, with soft lighter ripples (flat bands, no gradient). */
function Water({ night = false }: { night?: boolean }) {
  return (
    <g>
      <rect
        x={0}
        y={GROUND - 6}
        width={160}
        height={BANK - GROUND + 6}
        fill={night ? "var(--art-blue-dark)" : "var(--art-blue)"}
      />
      <rect
        x={0}
        y={GROUND - 6}
        width={160}
        height={2}
        fill="var(--art-blue-light)"
        opacity={night ? 0.5 : 1}
      />
      {[
        [24, 84, 14],
        [62, 87, 18],
        [118, 82, 12],
        [140, 86, 10],
      ].map(([x, y, w]) => (
        <rect
          key={x}
          x={x}
          y={y}
          width={w}
          height={1.4}
          rx={0.7}
          fill="var(--art-blue-light)"
          opacity={night ? 0.5 : 0.9}
        />
      ))}
      {/* the grassy bank in front, where Som sits */}
      <rect
        x={0}
        y={BANK}
        width={160}
        height={100 - BANK}
        fill={night ? "var(--art-leaf-4)" : "var(--art-leaf-1)"}
      />
      <rect
        x={0}
        y={BANK}
        width={160}
        height={1.6}
        fill={night ? "var(--art-leaf-3)" : "var(--art-leaf-light)"}
      />
    </g>
  );
}

/** A lily pad floating on the water. */
function Pad({ x, y, r = 7 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <ellipse cx={x + 0.6} cy={y + 0.6} rx={r} ry={r * 0.32} fill="var(--art-leaf-4)" />
      <ellipse cx={x} cy={y} rx={r} ry={r * 0.3} fill="var(--art-leaf-1)" />
      <path
        d={`M${x} ${y} L${x + r * 0.9} ${y - r * 0.1} L${x + r * 0.9} ${y + r * 0.14}Z`}
        fill="var(--art-blue)"
      />
    </g>
  );
}

/** The Candle Lotus in bloom on the pond, its tiny flame lit (the crop art, scaled). */
function PondLotus({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const petal = (rot: number, len: number, fill: string) => (
    <path
      d={`M0 0 Q${-4.6} ${-len * 0.45} 0 ${-len} Q4.6 ${-len * 0.45} 0 0Z`}
      fill={fill}
      transform={`rotate(${rot})`}
    />
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {petal(-58, 13, "var(--art-pink)")}
      {petal(58, 13, "var(--art-pink-dark)")}
      {petal(-26, 14, "var(--art-pink-light)")}
      {petal(26, 14, "var(--art-pink-dark)")}
      <circle cx={0} cy={-12} r={4.6} fill="var(--art-yellow-light)" opacity={0.6} />
      <path d="M0 -18 Q3.6 -13 2.4 -10.4 Q0 -7.8 -2.4 -10.4 Q-3.6 -13 0 -18Z" fill="var(--art-yellow-dark)" />
      <path
        d="M-0.3 -17.4 Q2.6 -13 1.6 -10.8 Q-0.3 -8.8 -2 -10.8 Q-3 -13 -0.3 -17.4Z"
        fill="var(--art-yellow)"
      />
      {petal(-44, 9.5, "var(--art-pink-light)")}
      {petal(44, 9.5, "var(--art-pink-dark)")}
      {petal(0, 9.5, "var(--art-pink)")}
    </g>
  );
}

/** A krathong: a round banana-leaf float with a flower, a candle and its tiny flame. */
function Krathong({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0.6} cy={1.4} rx={10} ry={3} fill="var(--art-leaf-4)" />
      <ellipse cx={0} cy={0.6} rx={9.4} ry={2.6} fill="var(--art-leaf-3)" />
      {[-7, -3.5, 0, 3.5, 7].map((dx) => (
        <path
          key={dx}
          d={`M${dx - 1.6} 0 L${dx} -3.4 L${dx + 1.6} 0Z`}
          fill={dx < 0 ? "var(--art-leaf-1)" : "var(--art-leaf-3)"}
        />
      ))}
      <circle cx={-3} cy={-3} r={2.6} fill="var(--art-pink-dark)" />
      <circle cx={-3.4} cy={-3.4} r={2.1} fill="var(--art-pink)" />
      <circle cx={3.2} cy={-3.2} r={2.4} fill="var(--art-yellow-dark)" />
      <circle cx={2.8} cy={-3.6} r={1.9} fill="var(--art-yellow)" />
      <rect x={-0.9} y={-9} width={1.8} height={6} rx={0.9} fill="var(--art-cream)" />
      <path d="M0 -13.4 Q1.8 -11 1.1 -9.8 Q0 -8.8 -1.1 -9.8 Q-1.8 -11 0 -13.4Z" fill="var(--art-yellow)" />
      <ellipse cx={-0.2} cy={-10.4} rx={0.5} ry={0.9} fill="var(--art-yellow-light)" />
    </g>
  );
}

/** A little market stall boat with lanterns (the krathong market on the water). */
function StallBoat({ x }: { x: number }) {
  const y = GROUND - 2;
  return (
    <g>
      <path
        d={`M${x} ${y} L${x + 44} ${y} L${x + 38} ${y + 7} L${x + 6} ${y + 7}Z`}
        fill="var(--art-wood-dark)"
      />
      <path
        d={`M${x + 1} ${y} L${x + 43} ${y} L${x + 39} ${y + 4} L${x + 5} ${y + 4}Z`}
        fill="var(--art-wood)"
      />
      <rect x={x + 6} y={y - 24} width={2.4} height={24} rx={1.2} fill="var(--art-wood-dark)" />
      <rect x={x + 36} y={y - 24} width={2.4} height={24} rx={1.2} fill="var(--art-wood-dark)" />
      <path
        d={`M${x + 2} ${y - 22} L${x + 42} ${y - 22} L${x + 40} ${y - 28} L${x + 4} ${y - 28}Z`}
        fill="var(--art-red-dark)"
      />
      <path
        d={`M${x + 3} ${y - 23} L${x + 41} ${y - 23} L${x + 39.4} ${y - 27.4} L${x + 4.6} ${y - 27.4}Z`}
        fill="var(--art-red)"
      />
      {[10, 16, 22, 28, 34].map((dx, i) => (
        <rect
          key={dx}
          x={x + dx - 2}
          y={y - 7}
          width={4}
          height={6}
          rx={1.6}
          fill={i % 2 ? "var(--art-pink)" : "var(--art-leaf-3)"}
        />
      ))}
      {[12, 22, 32].map((dx) => (
        <g key={dx}>
          <rect x={x + dx - 0.3} y={y - 22} width={0.6} height={3} fill="var(--art-wood-dark)" />
          <ellipse cx={x + dx} cy={y - 16.6} rx={2.6} ry={3} fill="var(--art-orange-dark)" />
          <ellipse cx={x + dx - 0.4} cy={y - 17} rx={2.1} ry={2.5} fill="var(--art-orange)" />
          <ellipse cx={x + dx - 1} cy={y - 18} rx={0.6} ry={0.9} fill="var(--art-yellow-light)" />
        </g>
      ))}
    </g>
  );
}

/** December's cool hills (Doi): layered misty hills and white strawberry plants. */
function MistHills() {
  return (
    <g>
      <ellipse cx={34} cy={GROUND + 4} rx={52} ry={26} fill="var(--art-leaf-2)" />
      <ellipse cx={124} cy={GROUND + 6} rx={60} ry={30} fill="var(--art-leaf-3)" />
      <ellipse cx={80} cy={GROUND - 6} rx={70} ry={5} fill="var(--art-cloud)" opacity={0.85} />
      <ellipse cx={30} cy={GROUND - 14} rx={26} ry={3.4} fill="var(--art-cloud)" opacity={0.7} />
      {[30, 52, 108, 130].map((x, i) => (
        <g key={x}>
          <ellipse cx={x - 3} cy={GROUND + 6} rx={3} ry={1.8} fill="var(--art-leaf-4)" />
          <ellipse cx={x + 3} cy={GROUND + 6} rx={3} ry={1.8} fill="var(--art-leaf-3)" />
          <ellipse cx={x} cy={GROUND + 8.6 + (i % 2)} rx={1.9} ry={2.3} fill="var(--art-stone)" />
          <ellipse cx={x - 0.4} cy={GROUND + 8.2 + (i % 2)} rx={1.6} ry={2} fill="var(--art-white)" />
          <circle cx={x - 0.6} cy={GROUND + 7.8 + (i % 2)} r={0.3} fill="var(--art-pink)" />
        </g>
      ))}
    </g>
  );
}

/** The winter-lights market: string lights between posts and a little stall. */
function WinterLights() {
  return (
    <g>
      {[8, 80, 152].map((x) => (
        <rect key={x} x={x - 1.2} y={GROUND - 42} width={2.4} height={42} rx={1.2} fill="var(--art-wood)" />
      ))}
      {[
        [8, 80],
        [80, 152],
      ].map(([a, b]) => (
        <g key={a}>
          <path
            d={`M${a} ${GROUND - 40} Q${(a! + b!) / 2} ${GROUND - 28} ${b} ${GROUND - 40}`}
            fill="none"
            stroke="var(--art-wood-dark)"
            strokeWidth={0.6}
          />
          {Array.from({ length: 7 }, (_, i) => {
            const t = (i + 1) / 8;
            const x = a! + (b! - a!) * t;
            const y = GROUND - 40 + 4 * 12 * t * (1 - t);
            const fill = ["var(--art-yellow-light)", "var(--art-pink-light)", "var(--art-blue-light)"][i % 3];
            return <circle key={i} cx={x} cy={y + 1.4} r={1.4} fill={fill} />;
          })}
        </g>
      ))}
      <rect x={52} y={GROUND - 16} width={56} height={16} rx={2} fill="var(--art-wood-dark)" />
      <rect x={50} y={GROUND - 17} width={56} height={16} rx={2} fill="var(--art-wood)" />
      <path d={`M46 ${GROUND - 17} L78 ${GROUND - 27} L110 ${GROUND - 17}Z`} fill="var(--art-red)" />
      {[60, 70, 80, 90, 100].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={GROUND - 19} rx={2.4} ry={2.8} fill="var(--art-stone)" />
          <ellipse cx={x - 0.3} cy={GROUND - 19.4} rx={2} ry={2.4} fill="var(--art-white)" />
        </g>
      ))}
    </g>
  );
}

/** The year-end cake on a little table: white strawberries on top, one candle. */
function YearCake() {
  return (
    <g>
      <rect x={46} y={GROUND - 12} width={68} height={4} rx={2} fill="var(--art-wood-dark)" />
      <rect x={44} y={GROUND - 13} width={68} height={4} rx={2} fill="var(--art-wood)" />
      <rect x={52} y={GROUND - 9} width={3} height={9} rx={1.5} fill="var(--art-wood-dark)" />
      <rect x={101} y={GROUND - 9} width={3} height={9} rx={1.5} fill="var(--art-wood-dark)" />
      <rect x={62} y={GROUND - 31} width={34} height={18} rx={5} fill="var(--art-pink-dark)" />
      <rect x={61} y={GROUND - 32} width={33} height={17} rx={5} fill="var(--art-pink-light)" />
      <rect x={61} y={GROUND - 32} width={33} height={5} rx={2.5} fill="var(--art-white)" />
      {[66, 74, 82, 90].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={GROUND - 34} rx={2} ry={2.4} fill="var(--art-stone)" />
          <ellipse cx={x - 0.3} cy={GROUND - 34.3} rx={1.7} ry={2} fill="var(--art-white)" />
        </g>
      ))}
      <rect x={77} y={GROUND - 42} width={1.6} height={7} rx={0.8} fill="var(--art-blue)" />
      <ellipse cx={77.8} cy={GROUND - 44} rx={1.2} ry={1.8} fill="var(--art-yellow)" />
      <ellipse cx={77.8} cy={GROUND - 43.6} rx={0.6} ry={0.9} fill="var(--art-yellow-light)" />
    </g>
  );
}

const SKY: Record<SceneId, string> = {
  gate: "linear-gradient(var(--sky-day-top), var(--sky-day-bottom))",
  field: "linear-gradient(var(--sky-day-top), var(--sky-day-bottom))",
  shed: "linear-gradient(var(--sky-day-top), var(--sky-day-bottom))",
  lotus_pond: "linear-gradient(var(--sky-day-top), var(--sky-day-bottom))",
  water_market: "linear-gradient(var(--sky-dusk-top), var(--sky-dusk-bottom))",
  krathong: "linear-gradient(var(--sky-night-top), var(--sky-night-bottom))",
  snow_hill: "linear-gradient(var(--sky-sunrise-top), var(--sky-sunrise-bottom))",
  winter_market: "linear-gradient(var(--sky-night-top), var(--sky-night-bottom))",
  cake: "linear-gradient(var(--sky-dusk-top), var(--sky-dusk-bottom))",
};

export function StoryScene({ scene, className = "" }: { scene: SceneId; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden ${className}`}
      style={{ background: SKY[scene] }}
    >
      <svg
        viewBox="0 0 160 100"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 h-full w-full"
      >
        {scene === "krathong" || scene === "winter_market" ? (
          <g>
            <circle cx={128} cy={22} r={9} fill="var(--sky-moon)" />
            {[
              [24, 14],
              [52, 26],
              [86, 10],
              [148, 40],
              [104, 34],
            ].map(([x, y]) => (
              <circle key={x} cx={x} cy={y} r={0.9} fill="var(--sky-star)" />
            ))}
          </g>
        ) : scene === "water_market" || scene === "cake" ? (
          <circle cx={132} cy={30} r={8} fill="var(--art-orange-light)" />
        ) : (
          <g>
            <ellipse cx={30} cy={20} rx={12} ry={5} fill="var(--art-cloud)" />
            <ellipse cx={120} cy={14} rx={16} ry={6} fill="var(--art-cloud)" />
            <circle cx={140} cy={26} r={7} fill="var(--art-sun)" />
          </g>
        )}
        <rect x={0} y={GROUND} width={160} height={100 - GROUND} fill="var(--art-leaf-1)" />
        <rect x={0} y={GROUND} width={160} height={2.5} fill="var(--art-leaf-light)" />
        {scene === "lotus_pond" && (
          <g>
            <Water />
            <Pad x={22} y={86} r={8} />
            <Pad x={108} y={86} r={7} />
            <Pad x={136} y={80} r={6} />
            <Pad x={30} y={78} r={9} />
            <PondLotus x={30} y={77} s={1.2} />
            <Pad x={124} y={84} r={7} />
            <PondLotus x={124} y={83} s={0.8} />
            <Tuft x={6} s={1.2} />
            <Tuft x={154} s={1.4} />
          </g>
        )}
        {scene === "water_market" && (
          <g>
            <Water />
            <StallBoat x={6} />
            <StallBoat x={112} />
            <Krathong x={58} y={86} s={0.9} />
            <Krathong x={100} y={82} s={0.7} />
            <Pad x={150} y={87} r={5} />
          </g>
        )}
        {scene === "krathong" && (
          <g>
            <Water night />
            <Pad x={20} y={86} r={7} />
            <Krathong x={114} y={85} s={1.3} />
            <Krathong x={142} y={79} s={0.7} />
            <Krathong x={36} y={80} s={0.5} />
            <PondLotus x={20} y={85} s={0.8} />
          </g>
        )}
        {scene === "snow_hill" && <MistHills />}
        {scene === "winter_market" && <WinterLights />}
        {scene === "cake" && <YearCake />}
        {scene === "gate" && (
          <g>
            <Fence from={4} to={70} gate />
            {[10, 30, 58, 112, 130, 150].map((x, i) => (
              <Tuft key={x} x={x} s={i % 2 ? 1.3 : 1.7} />
            ))}
          </g>
        )}
        {scene === "field" && (
          <g>
            <Fence from={2} to={158} />
            <Rows />
          </g>
        )}
        {scene === "shed" && (
          <g>
            <Shed />
            <Tuft x={92} s={1.2} />
            <Tuft x={148} s={1.5} />
          </g>
        )}
      </svg>
    </div>
  );
}
