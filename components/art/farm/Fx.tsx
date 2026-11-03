/**
 * Overlays on a crop: quality (a small star badge, SPEC §8.2) and mutations (tints/particles,
 * SPEC §8.3). Drawn in the same 48 × 48 box as CropArt so they stack on top of it.
 */
import type { MutationId, Quality } from "@/content/game";
import { Art, Leaf, Sparkle, Star5 } from "./parts";

const QUALITY_FILL: Record<Exclude<Quality, "normal">, [string, string]> = {
  silver: ["var(--art-silver-dark)", "var(--art-silver)"],
  gold: ["var(--art-yellow-dark)", "var(--art-yellow)"],
  prismatic: ["var(--art-purple-dark)", "var(--art-pink)"],
};

/** The quality star badge (nothing for Normal). Prismatic gets three colored facets. */
export function QualityStar({
  quality,
  cx = 40,
  cy = 11,
  r = 5.5,
}: {
  quality: Quality;
  cx?: number;
  cy?: number;
  r?: number;
}) {
  if (quality === "normal") return null;
  const [dark, base] = QUALITY_FILL[quality];
  return (
    <g>
      <Star5 cx={cx + 0.5} cy={cy + 0.5} r={r} fill={dark} />
      <Star5 cx={cx} cy={cy} r={r * 0.9} fill={base} />
      {quality === "prismatic" && (
        <Star5 cx={cx + 0.4} cy={cy + 0.6} r={r * 0.45} fill="var(--art-blue-light)" />
      )}
      <ellipse
        cx={cx - r * 0.3}
        cy={cy - r * 0.25}
        rx={r * 0.2}
        ry={r * 0.13}
        fill="var(--art-white)"
        opacity={0.85}
      />
    </g>
  );
}

/** One mutation's particles (fixed positions so a crop always looks the same). */
function MutationMark({ id }: { id: MutationId }) {
  switch (id) {
    case "sunrise_glow":
      return (
        <g>
          <circle cx={24} cy={26} r={17} fill="var(--art-yellow-light)" opacity={0.45} />
          <circle cx={8} cy={12} r={2} fill="var(--art-orange-light)" />
        </g>
      );
    case "dew":
      return (
        <g>
          {[
            [13, 22],
            [35, 18],
            [31, 33],
          ].map(([x, y]) => (
            <g key={x}>
              <path
                d={`M${x} ${y! - 2.6} Q${x! + 2} ${y! + 0.4} ${x} ${y! + 1.4} Q${x! - 2} ${y! + 0.4} ${x} ${y! - 2.6}Z`}
                fill="var(--art-blue)"
              />
              <circle cx={x! - 0.5} cy={y} r={0.5} fill="var(--art-white)" />
            </g>
          ))}
        </g>
      );
    case "moonlit":
      return (
        <g>
          <circle cx={9} cy={9} r={3.6} fill="var(--sky-moon)" />
          <circle cx={10.6} cy={8} r={3} fill="var(--art-purple-light)" />
          <Sparkle cx={15} cy={15} r={1.2} fill="var(--sky-star)" />
        </g>
      );
    case "breeze":
      return (
        <g>
          <Leaf cx={6} cy={20} rx={2.4} ry={1.1} rot={-30} fill="var(--art-leaf-light)" />
          <Leaf cx={42} cy={28} rx={2.2} ry={1} rot={25} fill="var(--art-leaf-1)" />
          <rect x={3} y={25} width={7} height={1.1} rx={0.55} fill="var(--art-leaf-light)" />
          <rect x={38} y={33} width={6} height={1.1} rx={0.55} fill="var(--art-leaf-light)" />
        </g>
      );
    case "spark":
      return (
        <g>
          <Sparkle cx={8} cy={30} r={2.6} fill="var(--art-yellow)" />
          <Sparkle cx={38} cy={20} r={2} fill="var(--art-yellow-dark)" />
          <Sparkle cx={12} cy={8} r={1.4} fill="var(--art-yellow)" />
        </g>
      );
    case "rainbow":
      return (
        <g opacity={0.8}>
          {["red", "orange", "yellow", "leaf-1", "blue", "purple"].map((c, i) => (
            <path
              key={c}
              d={`M${4 + i * 1.3} 22 A${20 - i * 1.3} ${15 - i * 1.3} 0 0 1 ${44 - i * 1.3} 22`}
              fill="none"
              stroke={`var(--art-${c})`}
              strokeWidth={1.3}
            />
          ))}
        </g>
      );
  }
}

/** Glow/rainbow sit behind the crop; the rest in front. */
export const BEHIND: MutationId[] = ["sunrise_glow", "rainbow"];

export function MutationFx({ ids, layer }: { ids: readonly MutationId[]; layer: "behind" | "front" }) {
  const shown = ids.filter((m) => BEHIND.includes(m) === (layer === "behind"));
  return (
    <g>
      {shown.map((m) => (
        <MutationMark key={m} id={m} />
      ))}
    </g>
  );
}

/** A mutation as a small standalone icon (legend, plot sheet): one centered shape each. */
function MutationGlyph({ id }: { id: MutationId }) {
  switch (id) {
    case "sunrise_glow":
      return (
        <g>
          <circle cx={24} cy={30} r={13} fill="var(--art-yellow-dark)" />
          <circle cx={23} cy={29} r={12} fill="var(--art-yellow)" />
          <ellipse
            cx={18}
            cy={23}
            rx={3.4}
            ry={2}
            fill="var(--art-yellow-light)"
            transform="rotate(-35 18 23)"
          />
          <rect x={6} y={38} width={36} height={4} rx={2} fill="var(--art-orange-light)" />
        </g>
      );
    case "dew":
      return (
        <g>
          <path d="M24 6 Q38 26 24 40 Q10 26 24 6Z" fill="var(--art-blue-dark)" />
          <path d="M23 7.5 Q35.5 26 23 38.6 Q10.5 26 23 7.5Z" fill="var(--art-blue)" />
          <ellipse
            cx={19}
            cy={25}
            rx={2.2}
            ry={4}
            fill="var(--art-blue-light)"
            transform="rotate(20 19 25)"
          />
        </g>
      );
    case "moonlit":
      return (
        <g>
          <circle cx={22} cy={24} r={15} fill="var(--sky-moon)" />
          <circle cx={29} cy={19} r={12.5} fill="var(--art-purple-light)" />
          <Sparkle cx={36} cy={36} r={3.4} fill="var(--art-yellow)" />
        </g>
      );
    case "breeze":
      return (
        <g>
          <Leaf cx={27} cy={18} rx={11} ry={6} rot={-30} fill="var(--art-leaf-3)" />
          <Leaf cx={26} cy={17} rx={9.6} ry={4.8} rot={-30} fill="var(--art-leaf-1)" />
          <rect x={6} y={30} width={26} height={3} rx={1.5} fill="var(--art-leaf-3)" />
          <rect x={12} y={37} width={24} height={3} rx={1.5} fill="var(--art-leaf-1)" />
        </g>
      );
    case "spark":
      return (
        <g>
          <Sparkle cx={22} cy={24} r={15} fill="var(--art-yellow-dark)" />
          <Sparkle cx={21} cy={23} r={13} fill="var(--art-yellow)" />
          <Sparkle cx={37} cy={10} r={4} fill="var(--art-orange)" />
        </g>
      );
    case "rainbow":
      return (
        <g>
          {["red", "orange", "yellow", "leaf-1", "blue", "purple"].map((c, i) => (
            <path
              key={c}
              d={`M${5 + i * 3} 38 A${19 - i * 3} ${19 - i * 3} 0 0 1 ${43 - i * 3} 38 L${40 - i * 3} 38 A${16 - i * 3} ${16 - i * 3} 0 0 0 ${8 + i * 3} 38Z`}
              fill={`var(--art-${c})`}
            />
          ))}
        </g>
      );
  }
}

export function MutationIcon({
  id,
  className = "h-6 w-6",
  label,
}: {
  id: MutationId;
  className?: string;
  label?: string;
}) {
  return (
    <Art className={className} label={label}>
      <MutationGlyph id={id} />
    </Art>
  );
}
