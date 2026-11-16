/** The sky behind the app icon (the only gradient in the icon, as the art rules allow for skies). */
export type IconSkyVariant = "sunrise" | "meadow" | "night";

const SKY: Record<IconSkyVariant, [top: string, bottom: string]> = {
  sunrise: ["var(--sky-sunrise-top)", "var(--sky-sunrise-bottom)"],
  meadow: ["var(--sky-day-top)", "var(--sky-day-bottom)"],
  night: ["var(--sky-night-top)", "var(--sky-night-bottom)"],
};

export function IconSky({ variant }: { variant: IconSkyVariant }) {
  const [top, bottom] = SKY[variant];
  const id = `app-icon-sky-${variant}`;
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
