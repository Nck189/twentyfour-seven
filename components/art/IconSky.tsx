import { useId } from "react";

/** The sky behind the app icon (the only gradient in the icon, as the art rules allow for skies). */
export type IconSkyVariant = "sunrise" | "meadow" | "dusk" | "night";

const SKY: Record<IconSkyVariant, [top: string, bottom: string]> = {
  sunrise: ["var(--sky-sunrise-top)", "var(--sky-sunrise-bottom)"],
  meadow: ["var(--sky-day-top)", "var(--sky-day-bottom)"],
  dusk: ["var(--sky-dusk-top)", "var(--sky-dusk-bottom)"],
  night: ["var(--sky-night-top)", "var(--sky-night-bottom)"],
};

export function IconSky({ variant }: { variant: IconSkyVariant }) {
  const [top, bottom] = SKY[variant];
  // Unique per copy: with a fixed id, a hidden copy earlier on the page blanks a visible one (G7 R-A-3).
  const id = `app-icon-sky-${useId()}`;
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" fill={`url(#${id})`} />
    </>
  );
}
