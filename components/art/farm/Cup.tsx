/**
 * Som's café cups (content/cafe.ts DRINK_COLOR): the same cup, a different drink. Hot drinks are a
 * round mug with a handle; iced ones a tall glass with ice and a straw. Flat, no outlines, light
 * from the top-left, a flat shadow — the same parts as the rest of the farm.
 */
import { DRINK_COLOR, type DrinkId } from "@/content/cafe";
import { Art, Shadow } from "./parts";

export function Cup({
  drink,
  className = "h-12 w-12",
  label,
}: {
  drink: DrinkId;
  className?: string;
  label?: string;
}) {
  const c = DRINK_COLOR[drink];
  return (
    <Art className={className} label={label}>
      <Shadow rx={9} />
      {c.iced ? (
        <>
          {/* straw */}
          <rect
            x={27}
            y={4}
            width={2.4}
            height={14}
            rx={1.2}
            fill="var(--art-pink)"
            transform="rotate(14 28 11)"
          />
          {/* glass (light, see-through tone), then the drink inside */}
          <path d="M14 12 L34 12 L31.6 39 Q24 41.4 16.4 39 Z" fill="var(--art-ice)" />
          <path d="M15.6 19 L32.4 19 L30.8 37.6 Q24 39.6 17.2 37.6 Z" fill={c.drink} />
          {c.foam && <path d="M15.4 17 L32.6 17 L32.3 21 Q24 23 15.7 21 Z" fill={c.foam} />}
          {/* ice cubes */}
          <rect x={18} y={22} width={5.4} height={5} rx={1.4} fill="var(--art-ice-light)" opacity={0.85} />
          <rect x={24.6} y={25.6} width={5} height={4.6} rx={1.4} fill="var(--art-ice-light)" opacity={0.7} />
          {/* top-left highlight on the glass */}
          <rect x={16.6} y={14} width={2} height={20} rx={1} fill="var(--art-white)" opacity={0.55} />
        </>
      ) : (
        <>
          {/* handle: a filled C (no thick strokes) */}
          <path
            d="M31 20.2 Q40.4 20 39.6 27.4 Q38.8 33.8 31 33.2 L31.2 30.4 Q36.4 30.6 36.8 27.2 Q37.2 22.8 31 23Z"
            fill="var(--art-stone-dark)"
          />
          {/* mug: shadow side, base, the drink's surface, highlight */}
          <path
            d="M12 18 L34 18 L32.4 35 Q32 39.6 27 39.6 L19 39.6 Q14 39.6 13.6 35 Z"
            fill="var(--art-stone-dark)"
          />
          <path
            d="M12 18 L33 18 L31.2 34.4 Q30.8 38.4 26.4 38.4 L19 38.4 Q14.8 38.4 14.4 34.4 Z"
            fill="var(--art-cream)"
          />
          <ellipse cx={23} cy={18.4} rx={11} ry={3} fill="var(--art-stone-dark)" />
          <ellipse cx={23} cy={18.8} rx={9.6} ry={2.2} fill={c.drink} />
          {c.foam && <ellipse cx={22.4} cy={18.6} rx={5.6} ry={1.3} fill={c.foam} />}
          <rect x={15.6} y={22} width={2} height={11} rx={1} fill="var(--art-white)" opacity={0.7} />
          {/* steam */}
          <path
            d="M20 13 Q18.6 10.4 20.4 8"
            fill="none"
            stroke="var(--art-stone)"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
          <path
            d="M26 12.6 Q24.6 10 26.4 7.4"
            fill="none"
            stroke="var(--art-stone)"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </>
      )}
    </Art>
  );
}
