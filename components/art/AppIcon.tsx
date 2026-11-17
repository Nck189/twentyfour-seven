/**
 * The app icon (Minnie 2026-11-16: the sprout looked like other plant apps and wasn't inviting):
 * Som's face, big, because a character is what people tap. Same artist as the rest: flat, no
 * outlines, tokens only; the one gradient is the sky. Full-bleed 64 × 64 (the OS rounds corners);
 * `safe` shrinks the art into the middle 80% for a maskable icon.
 */
import { useId } from "react";
import { IconSky, type IconSkyVariant } from "./IconSky";
import { SomHead } from "./Som";
import { Leaf } from "./farm/parts";

export type AppIconVariant = IconSkyVariant;

export function AppIconArt({
  variant = "sunrise",
  safe = false,
}: {
  variant?: AppIconVariant;
  safe?: boolean;
}) {
  const night = variant === "night";
  return (
    <>
      <IconSky variant={variant} />
      <g transform={safe ? "translate(32 32) scale(0.8) translate(-32 -32)" : undefined}>
        {night ? (
          <g fill="var(--sky-star)">
            <circle cx="50" cy="13" r="6" fill="var(--sky-moon)" />
            <circle cx="12" cy="12" r="1.1" />
            <circle cx="22" cy="6.5" r="0.8" />
            <circle cx="39" cy="7" r="0.9" />
          </g>
        ) : (
          // The sun rising right behind Som's head.
          <circle
            cx="32"
            cy="35"
            r="27"
            fill={variant === "sunrise" ? "var(--art-sun)" : "var(--art-yellow-light)"}
          />
        )}
        {/* Som: the head fills the icon; a two-leaf sprout on top says "farm". */}
        <g transform="translate(32 35) scale(2.1) translate(-24 -22)">
          <rect x="23.4" y="8.2" width="1.2" height="5" rx="0.6" fill="var(--art-stem)" />
          <Leaf cx={21.4} cy={8.4} rx={2.7} ry={1.5} rot={-25} fill="var(--art-leaf-1)" />
          <Leaf cx={26.6} cy={7.8} rx={2.7} ry={1.5} rot={25} fill="var(--art-leaf-3)" />
          <SomHead cx={24} cy={22} mood={night ? "shut" : variant === "meadow" ? "happy" : "open"} />
        </g>
        {/* A soft hill in front, with Som's paws resting on it. */}
        <ellipse cx="32" cy="70" rx="48" ry="19" fill="var(--art-leaf-3)" />
        <ellipse cx="30" cy="70.6" rx="46" ry="18.6" fill="var(--art-leaf-2)" />
        <ellipse cx="22" cy="53.2" rx="5.4" ry="3" fill="var(--art-cream)" />
        <ellipse cx="42" cy="53.2" rx="5.4" ry="3" fill="var(--art-cream)" />
      </g>
    </>
  );
}

/** The mark used inside the app (login, pictures): rounded, on any background. */
export function AppIcon({
  className = "",
  variant = "sunrise",
}: {
  className?: string;
  variant?: AppIconVariant;
}) {
  const clip = `app-icon-clip-${useId()}`;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <clipPath id={clip}>
        <rect width="64" height="64" rx="15" />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <AppIconArt variant={variant} />
      </g>
    </svg>
  );
}
