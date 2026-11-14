/**
 * Factory art (M13): the four machines and their products, in the farm style
 * (design/reference-style-a.svg): flat, no outlines, 2–3 same-hue tones, light from the top-left,
 * a soft flat ellipse as the only shadow. 48 × 48, ground at y = 40.
 */
import type { MachineId, ProductId } from "@/content/factory";
import { Art, Ball, Shadow, Sparkle, TONES } from "./parts";

/** A puff of steam over a working machine (stopped by the reduced-motion rule). */
function Puff({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g className="machine-puff">
      <circle cx={cx} cy={cy} r={2.4} fill="var(--art-cloud)" />
      <circle cx={cx + 2.6} cy={cy - 2} r={1.8} fill="var(--art-cloud)" />
    </g>
  );
}

export function MachineArt({
  id,
  working = false,
  className = "h-12 w-12",
  label,
}: {
  id: MachineId;
  working?: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <Art className={className} label={label}>
      <Shadow rx={15} />
      {id === "jam_jar" && (
        <g>
          {/* wooden stand */}
          <rect x={10} y={35} width={28} height={5} rx={2} fill="var(--art-wood-dark)" />
          <rect x={10} y={35} width={27} height={4} rx={2} fill="var(--art-wood)" />
          {/* glass jar with jam */}
          <rect x={13} y={14} width={22} height={22} rx={6} fill="var(--art-ice-dark)" />
          <rect x={13} y={14} width={21} height={21} rx={6} fill="var(--art-ice)" />
          <rect x={15} y={22} width={17} height={12} rx={4} fill="var(--art-red-dark)" />
          <rect x={15} y={22} width={16} height={11} rx={4} fill="var(--art-red)" />
          <rect x={16} y={17} width={3} height={8} rx={1.5} fill="var(--art-ice-light)" />
          {/* gingham lid */}
          <rect x={12} y={9} width={24} height={7} rx={3} fill="var(--art-red-dark)" />
          <rect x={12} y={9} width={23} height={6} rx={3} fill="var(--art-red-light)" />
          <rect x={17} y={9} width={3} height={6} fill="var(--art-white)" />
          <rect x={24} y={9} width={3} height={6} fill="var(--art-white)" />
          {working && <Puff cx={31} cy={6} />}
        </g>
      )}
      {id === "cheese_press" && (
        <g>
          {/* frame */}
          <rect x={10} y={12} width={4} height={28} rx={1.5} fill="var(--art-wood-dark)" />
          <rect x={34} y={12} width={4} height={28} rx={1.5} fill="var(--art-wood-dark)" />
          <rect x={8} y={9} width={32} height={6} rx={2.5} fill="var(--art-wood-dark)" />
          <rect x={8} y={9} width={31} height={5} rx={2.5} fill="var(--art-wood)" />
          {/* screw + wheel */}
          <rect x={22.5} y={4} width={3} height={14} rx={1.5} fill="var(--art-silver-dark)" />
          <rect x={17} y={3} width={14} height={3} rx={1.5} fill="var(--art-silver)" />
          {/* press plate + cheese wheel */}
          <rect x={14} y={18} width={20} height={4} rx={1.5} fill="var(--art-wood-light)" />
          <rect x={14} y={24} width={20} height={14} rx={4} fill="var(--art-yellow-dark)" />
          <rect x={14} y={24} width={19} height={13} rx={4} fill="var(--art-yellow)" />
          <rect x={16} y={26} width={8} height={2.5} rx={1.2} fill="var(--art-yellow-light)" />
          <circle cx={26} cy={32} r={1.6} fill="var(--art-yellow-dark)" />
          {working && <Puff cx={36} cy={8} />}
        </g>
      )}
      {id === "loom" && (
        <g>
          {/* frame */}
          <rect x={9} y={10} width={4} height={30} rx={1.5} fill="var(--art-wood-dark)" />
          <rect x={35} y={10} width={4} height={30} rx={1.5} fill="var(--art-wood-dark)" />
          <rect x={7} y={8} width={34} height={5} rx={2.5} fill="var(--art-wood)" />
          <rect x={7} y={28} width={34} height={4} rx={2} fill="var(--art-wood)" />
          {/* threads + woven cloth */}
          {[15, 19, 23, 27, 31].map((x) => (
            <rect key={x} x={x} y={13} width={1.4} height={15} fill="var(--art-pink-light)" />
          ))}
          <rect x={13} y={20} width={22} height={8} rx={1.5} fill="var(--art-pink-dark)" />
          <rect x={13} y={20} width={22} height={7} rx={1.5} fill="var(--art-pink)" />
          <rect x={15} y={22} width={18} height={1.6} rx={0.8} fill="var(--art-pink-light)" />
          {/* shuttle */}
          <rect x={18} y={33} width={12} height={3.5} rx={1.75} fill="var(--art-latte-dark)" />
          <rect x={18} y={33} width={11} height={3} rx={1.5} fill="var(--art-latte)" />
          {working && <Sparkle cx={38} cy={18} r={2.4} fill="var(--art-pink-dark)" />}
        </g>
      )}
      {id === "bakery" && (
        <g>
          {/* brick oven dome */}
          <path d="M8 40 L8 26 Q8 10 24 10 Q40 10 40 26 L40 40Z" fill="var(--art-rust-dark)" />
          <path d="M8 39 L8 26 Q8 11 23.5 11 Q39 11 39 26 L39 39Z" fill="var(--art-rust)" />
          <path
            d="M12 20 Q15 14 21 13"
            stroke="var(--art-rust-light)"
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
          />
          {/* opening with a glow */}
          <path d="M15 39 L15 30 Q15 23 24 23 Q33 23 33 30 L33 39Z" fill="var(--art-soil-deep)" />
          <path
            d="M17 39 L17 31 Q17 26 24 26 Q31 26 31 31 L31 39Z"
            fill={working ? "var(--art-orange)" : "var(--art-soil-dark)"}
          />
          {working && <ellipse cx={24} cy={36} rx={5} ry={2.2} fill="var(--art-yellow)" />}
          {/* chimney */}
          <rect x={30} y={4} width={5} height={9} rx={1.5} fill="var(--art-stone-dark)" />
          <rect x={30} y={4} width={4.5} height={8.5} rx={1.5} fill="var(--art-stone)" />
          {working && <Puff cx={33} cy={2} />}
        </g>
      )}
    </Art>
  );
}

/** A small jar (pickles, jam). */
function Jar({ fill, dark, lid }: { fill: string; dark: string; lid: "gingham" | "plain" }) {
  return (
    <g>
      <rect x={15} y={19} width={18} height={21} rx={5} fill="var(--art-ice-dark)" />
      <rect x={15} y={19} width={17} height={20} rx={5} fill="var(--art-ice)" />
      <rect x={17} y={24} width={13} height={13} rx={3.5} fill={dark} />
      <rect x={17} y={24} width={12} height={12} rx={3.5} fill={fill} />
      <rect x={18} y={21} width={2.5} height={6} rx={1.2} fill="var(--art-ice-light)" />
      <rect
        x={14}
        y={14}
        width={20}
        height={6}
        rx={2.5}
        fill={lid === "gingham" ? "var(--art-red-dark)" : "var(--art-silver-dark)"}
      />
      <rect
        x={14}
        y={14}
        width={19}
        height={5}
        rx={2.5}
        fill={lid === "gingham" ? "var(--art-red-light)" : "var(--art-silver)"}
      />
      {lid === "gingham" && (
        <>
          <rect x={18} y={14} width={2.5} height={5} fill="var(--art-white)" />
          <rect x={24} y={14} width={2.5} height={5} fill="var(--art-white)" />
        </>
      )}
    </g>
  );
}

export function ProductArt({ id, className = "h-8 w-8" }: { id: ProductId; className?: string }) {
  return (
    <Art className={className}>
      <Shadow rx={10} />
      {id === "pickles" && (
        <g>
          <Jar fill="var(--art-leaf-2)" dark="var(--art-leaf-4)" lid="plain" />
          <ellipse cx={21} cy={30} rx={2} ry={4} fill="var(--art-leaf-4)" transform="rotate(-15 21 30)" />
          <ellipse cx={26} cy={31} rx={2} ry={4} fill="var(--art-leaf-light)" transform="rotate(12 26 31)" />
        </g>
      )}
      {id === "strawberry_jam" && <Jar fill="var(--art-red)" dark="var(--art-red-dark)" lid="gingham" />}
      {id === "tomato_sauce" && (
        <g>
          <rect x={17} y={17} width={14} height={23} rx={5} fill="var(--art-red-dark)" />
          <rect x={17} y={17} width={13} height={22} rx={5} fill="var(--art-red)" />
          <rect x={21} y={9} width={6} height={10} rx={2} fill="var(--art-red-dark)" />
          <rect x={20.5} y={7} width={7} height={4} rx={1.5} fill="var(--art-leaf-3)" />
          <rect x={17} y={26} width={13} height={7} fill="var(--art-cream)" />
          <circle cx={23.5} cy={29.5} r={2.2} fill="var(--art-red-light)" />
          <rect x={19} y={19} width={2.5} height={5} rx={1.2} fill="var(--art-red-light)" />
        </g>
      )}
      {id === "butter" && (
        <g>
          <ellipse cx={24} cy={36} rx={14} ry={4} fill="var(--art-silver)" />
          <ellipse cx={24} cy={35.3} rx={13} ry={3.4} fill="var(--art-white)" />
          <rect x={15} y={24} width={18} height={11} rx={2.5} fill="var(--art-yellow-dark)" />
          <rect x={15} y={24} width={17} height={10} rx={2.5} fill="var(--art-yellow-light)" />
          <rect x={17} y={26} width={7} height={2} rx={1} fill="var(--art-cream)" />
        </g>
      )}
      {id === "cheese" && (
        <g>
          <path d="M10 38 L38 38 L38 26 L12 20Z" fill="var(--art-yellow-dark)" />
          <path d="M10 37 L37 37 L37 26 L11.5 20.5Z" fill="var(--art-yellow)" />
          <path d="M11.5 20.5 L37 26 L37 27.5 L11 22Z" fill="var(--art-yellow-light)" />
          <circle cx={19} cy={30} r={2.2} fill="var(--art-yellow-dark)" />
          <circle cx={29} cy={32} r={1.6} fill="var(--art-yellow-dark)" />
          <circle cx={31} cy={29} r={1} fill="var(--art-yellow-dark)" />
        </g>
      )}
      {id === "yarn" && (
        <g>
          <Ball cx={23} cy={29} r={9.5} tone={TONES.pink} />
          <path d="M15 27 Q23 21 31 26 L31 27.6 Q23 23 15 28.6Z" fill="var(--art-pink-dark)" />
          <path d="M16 32 Q23 27 30.5 31.5 L30 33 Q23 29 16.3 33.6Z" fill="var(--art-pink-dark)" />
          <path
            d="M31 33 Q36 36 38 39"
            stroke="var(--art-pink-dark)"
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
          />
        </g>
      )}
      {id === "sweater" && (
        <g>
          <path
            d="M14 14 L20 12 Q24 15 28 12 L34 14 L40 24 L35 27 L33 23 L33 40 L15 40 L15 23 L13 27 L8 24Z"
            fill="var(--art-blue-dark)"
          />
          <path
            d="M14 14 L20 12 Q24 15 28 12 L34 14 L39 23.5 L35 26 L33 22 L33 39 L15 39 L15 22 L13 26 L9 23.5Z"
            fill="var(--art-blue)"
          />
          <rect x={15} y={34} width={18} height={4} fill="var(--art-blue-dark)" />
          <path
            d="M19 20 L24 24 L29 20"
            stroke="var(--art-blue-light)"
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M19 27 L24 31 L29 27"
            stroke="var(--art-blue-light)"
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
          />
        </g>
      )}
      {id === "lavender_sachet" && (
        <g>
          <path d="M14 40 Q12 26 18 22 L30 22 Q36 26 34 40Z" fill="var(--art-purple-dark)" />
          <path d="M14.5 39 Q13 26 18.5 22.5 L29.5 22.5 Q35 26 33.5 39Z" fill="var(--art-purple-light)" />
          <path
            d="M18 22 Q20 16 17 11 M24 22 Q24 15 24 9 M30 22 Q28 16 31 11"
            stroke="var(--art-leaf-4)"
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
          />
          <circle cx={17} cy={11} r={2} fill="var(--art-purple)" />
          <circle cx={24} cy={9} r={2} fill="var(--art-purple)" />
          <circle cx={31} cy={11} r={2} fill="var(--art-purple)" />
          <rect x={16} y={21} width={16} height={3} rx={1.5} fill="var(--art-pink)" />
          <circle cx={20} cy={30} r={1.3} fill="var(--art-purple)" />
          <circle cx={27} cy={33} r={1.3} fill="var(--art-purple)" />
        </g>
      )}
      {id === "carrot_cake" && (
        <g>
          <path d="M10 38 L38 38 L38 24 L14 18Z" fill="var(--art-orange-dark)" />
          <path d="M10 37 L37 37 L37 24 L13.5 18.5Z" fill="var(--art-orange)" />
          <path d="M11 28 L37 30 L37 32 L10.5 30Z" fill="var(--art-cream)" />
          <path d="M13.5 18.5 L37 24 L37 26.5 L12.5 21Z" fill="var(--art-cream)" />
          <ellipse cx={27} cy={20} rx={2.4} ry={1.2} fill="var(--art-orange)" transform="rotate(20 27 20)" />
          <ellipse cx={29.5} cy={19} rx={1.4} ry={0.8} fill="var(--art-leaf-3)" />
        </g>
      )}
      {id === "cornbread" && (
        <g>
          <rect x={10} y={22} width={28} height={16} rx={4} fill="var(--art-yellow-dark)" />
          <rect x={10} y={22} width={27} height={15} rx={4} fill="var(--art-yellow)" />
          <path
            d="M12 25 Q24 19 36 25"
            stroke="var(--art-orange-light)"
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
          />
          <rect x={13} y={27} width={8} height={2.4} rx={1.2} fill="var(--art-yellow-light)" />
          <path
            d="M17 31 L20 34 M24 30 L27 33 M30 31 L33 34"
            stroke="var(--art-yellow-dark)"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </g>
      )}
      {id === "pumpkin_pie" && (
        <g>
          <ellipse cx={24} cy={33} rx={15} ry={6.5} fill="var(--art-wood-dark)" />
          <ellipse cx={24} cy={31.8} rx={14} ry={5.8} fill="var(--art-wood-light)" />
          <ellipse cx={24} cy={31} rx={11.5} ry={4.4} fill="var(--art-orange-dark)" />
          <ellipse cx={23.5} cy={30.5} rx={11} ry={4} fill="var(--art-orange)" />
          <ellipse cx={20} cy={29.5} rx={3} ry={1} fill="var(--art-orange-light)" />
          <ellipse cx={27} cy={30} rx={2.4} ry={1.4} fill="var(--art-cream)" />
        </g>
      )}
    </Art>
  );
}
