/**
 * Shared shapes for farm art (style = design/reference-style-a.svg): flat, no outlines, 2–3
 * same-hue tones per object, light from the top-left, a soft flat ellipse as the only shadow.
 * Everything here draws inside a 48 × 48 viewBox with the ground line at y = 40.
 */
import type { ReactNode } from "react";

export type Tone = { base: string; dark: string; light: string };

const t = (name: string): Tone => ({
  base: `var(--art-${name})`,
  dark: `var(--art-${name}-dark)`,
  light: `var(--art-${name}-light)`,
});

export const TONES = {
  red: t("red"),
  orange: t("orange"),
  yellow: t("yellow"),
  purple: t("purple"),
  blue: t("blue"),
  pink: t("pink"),
  silver: t("silver"),
  wood: t("wood"),
  stone: t("stone"),
  leaf: { base: "var(--art-leaf-1)", dark: "var(--art-leaf-4)", light: "var(--art-leaf-light)" },
  soil: { base: "var(--art-soil)", dark: "var(--art-soil-dark)", light: "var(--art-soil-light)" },
} satisfies Record<string, Tone>;
export type ToneName = keyof typeof TONES;

export const GROUND_Y = 40;

/** The soft flat ellipse under an object (the only "shadow" allowed). */
export function Shadow({ cx = 24, rx = 11, cy = GROUND_Y + 1 }: { cx?: number; rx?: number; cy?: number }) {
  // On a soil bed the plot sets --shadow-on to a darker soil, so the shadow never reads paler.
  return <ellipse cx={cx} cy={cy} rx={rx} ry={rx * 0.22} fill="var(--shadow-on, var(--art-shadow))" />;
}

/**
 * A round fruit in 3 tones: the dark shape peeks out lower-right, the base sits up-left of it,
 * and a small highlight sits top-left.
 */
export function Ball({ cx, cy, r, tone }: { cx: number; cy: number; r: number; tone: Tone }) {
  const o = r * 0.1;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={tone.dark} />
      <circle cx={cx - o} cy={cy - o} r={r - o} fill={tone.base} />
      {r >= 2.5 && (
        <ellipse
          cx={cx - r * 0.42}
          cy={cy - r * 0.42}
          rx={r * 0.32}
          ry={r * 0.2}
          fill={tone.light}
          transform={`rotate(-40 ${cx - r * 0.42} ${cy - r * 0.42})`}
        />
      )}
    </g>
  );
}

/** A leaf: a rotated ellipse (as in the reference). */
export function Leaf({
  cx,
  cy,
  rx,
  ry,
  rot = 0,
  fill = "var(--art-leaf-3)",
}: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rot?: number;
  fill?: string;
}) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={fill} transform={`rotate(${rot} ${cx} ${cy})`} />;
}

/** A plant stem from the ground up to `top` (rounded, 3 px like the reference). */
export function Stem({
  x = 24,
  top,
  w = 3,
  fill = "var(--art-stem)",
}: {
  x?: number;
  top: number;
  w?: number;
  fill?: string;
}) {
  return <rect x={x - w / 2} y={top} width={w} height={GROUND_Y - top} rx={w / 2} fill={fill} />;
}

/** A small 4-point sparkle (used by mutations and the crystal rose). */
export function Sparkle({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  const k = r * 0.28;
  return (
    <path
      d={`M${cx} ${cy - r} Q${cx + k} ${cy - k} ${cx + r} ${cy} Q${cx + k} ${cy + k} ${cx} ${cy + r} Q${cx - k} ${cy + k} ${cx - r} ${cy} Q${cx - k} ${cy - k} ${cx} ${cy - r}Z`}
      fill={fill}
    />
  );
}

/** A 5-point star with softly rounded tips (a same-color 1.5 px join, not an outline). */
export function Star5({
  cx,
  cy,
  r,
  fill,
  inner = 0.5,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  inner?: number;
}) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * inner;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return (
    <polygon points={pts.join(" ")} fill={fill} stroke={fill} strokeWidth={1.5} strokeLinejoin="round" />
  );
}

export function Art({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {children}
    </svg>
  );
}
