/**
 * Cutscene backdrops (docs/STORY.md): a wide flat scene, same artist as the farm (no outlines,
 * 2–3 tones, light from the top-left). The sky is the only gradient.
 */
import type { StoryScene as SceneId } from "@/content/story";

const GROUND = 78;

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
          <rect x={to + 10} y={GROUND - 24} width={22} height={22} rx={3} fill="var(--art-wood)" transform={`skewY(-8)`} />
          <rect x={to + 13} y={GROUND - 19} width={16} height={2.4} rx={1.2} fill="var(--art-wood-dark)" transform={`skewY(-8)`} />
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
          <ellipse cx={x - 2} cy={GROUND + 1} rx={2} ry={4.5} fill="var(--art-leaf-3)" transform={`rotate(-20 ${x - 2} ${GROUND + 1})`} />
          <ellipse cx={x + 2} cy={GROUND + 1} rx={2} ry={4.5} fill="var(--art-leaf-2)" transform={`rotate(20 ${x + 2} ${GROUND + 1})`} />
        </g>
      ))}
      {/* a pulled radish */}
      <g>
        <ellipse cx={128} cy={GROUND + 12} rx={4.5} ry={5} fill="var(--art-pink-dark)" />
        <ellipse cx={127.4} cy={GROUND + 11.4} rx={4} ry={4.5} fill="var(--art-pink)" />
        <ellipse cx={126} cy={GROUND + 9.6} rx={1.4} ry={0.8} fill="var(--art-pink-light)" />
        <ellipse cx={126} cy={GROUND + 4} rx={1.6} ry={4} fill="var(--art-leaf-3)" transform={`rotate(-15 126 ${GROUND + 4})`} />
        <ellipse cx={130} cy={GROUND + 4} rx={1.6} ry={4} fill="var(--art-leaf-2)" transform={`rotate(15 130 ${GROUND + 4})`} />
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
        <path d={`M120 ${GROUND - 10} L132 ${GROUND - 18} L133 ${GROUND - 15} L121 ${GROUND - 6}Z`} fill="var(--art-blue-dark)" />
        <ellipse cx={111} cy={GROUND - 17} rx={5} ry={2} fill="var(--art-blue-dark)" />
      </g>
    </g>
  );
}

export function StoryScene({ scene, className = "" }: { scene: SceneId; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden ${className}`}
      style={{ background: "linear-gradient(var(--sky-day-top), var(--sky-day-bottom))" }}
    >
      <svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
        <ellipse cx={30} cy={20} rx={12} ry={5} fill="var(--art-cloud)" />
        <ellipse cx={120} cy={14} rx={16} ry={6} fill="var(--art-cloud)" />
        <circle cx={140} cy={26} r={7} fill="var(--art-sun)" />
        <rect x={0} y={GROUND} width={160} height={100 - GROUND} fill="var(--art-leaf-1)" />
        <rect x={0} y={GROUND} width={160} height={2.5} fill="var(--art-leaf-light)" />
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
