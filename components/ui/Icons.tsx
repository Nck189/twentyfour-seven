/**
 * Small flat UI icons (currentColor, no strokes): same rounded vocabulary as the tab icons.
 * Secondary shapes use opacity for depth. Never use emoji in place of these.
 */
import type { ReactNode } from "react";

type P = { className?: string };

const Svg = ({ className, children }: P & { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" className={className ?? "h-4 w-4"} aria-hidden="true">
    {children}
  </svg>
);

export function ClockIcon(p: P) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9.5" fill="currentColor" opacity="0.3" />
      <rect x="11" y="6" width="2.2" height="7" rx="1.1" fill="currentColor" />
      <rect x="11" y="11" width="5.5" height="2.2" rx="1.1" fill="currentColor" />
    </Svg>
  );
}

export function FlagIcon(p: P) {
  return (
    <Svg {...p}>
      <rect x="4.5" y="3" width="2.4" height="18.5" rx="1.2" fill="currentColor" />
      <path
        d="M7 4.5h10.5a1.2 1.2 0 0 1 .95 1.93L16 9.5l2.45 3.07a1.2 1.2 0 0 1-.95 1.93H7z"
        fill="currentColor"
        opacity="0.55"
      />
    </Svg>
  );
}

export function TagIcon(p: P) {
  return (
    <Svg {...p}>
      <path
        d="M3 5.5A2.5 2.5 0 0 1 5.5 3h6.1a2.5 2.5 0 0 1 1.77.73l7.4 7.4a2.5 2.5 0 0 1 0 3.54l-6.1 6.1a2.5 2.5 0 0 1-3.54 0l-7.4-7.4A2.5 2.5 0 0 1 3 11.6z"
        fill="currentColor"
        opacity="0.45"
      />
      <circle cx="8" cy="8" r="2" fill="currentColor" />
    </Svg>
  );
}

export function StepsIcon(p: P) {
  return (
    <Svg {...p}>
      {[5, 11, 17].map((y, i) => (
        <g key={y}>
          <rect x="3" y={y} width="4" height="4" rx="1.4" fill="currentColor" opacity={i === 0 ? 1 : 0.4} />
          <rect x="9" y={y + 1} width="12" height="2.2" rx="1.1" fill="currentColor" opacity="0.7" />
        </g>
      ))}
    </Svg>
  );
}

/** Carried over to another day (loop arrow). */
export function CarryIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M12 4a8 8 0 1 0 7.2 4.5l-2.1 1A5.7 5.7 0 1 1 12 6.3z" fill="currentColor" opacity="0.5" />
      <path d="M13 1.8l5 3.2-4.6 3.6z" fill="currentColor" />
    </Svg>
  );
}

export function CheckIcon(p: P) {
  return (
    <Svg {...p}>
      <rect
        x="3.5"
        y="11.5"
        width="7.5"
        height="3"
        rx="1.5"
        fill="currentColor"
        transform="rotate(45 7.25 13)"
      />
      <rect
        x="7.5"
        y="9.5"
        width="13"
        height="3"
        rx="1.5"
        fill="currentColor"
        transform="rotate(-50 14 11)"
      />
    </Svg>
  );
}

export function CloseIcon(p: P) {
  return (
    <Svg {...p}>
      <rect
        x="4"
        y="10.6"
        width="16"
        height="2.8"
        rx="1.4"
        fill="currentColor"
        transform="rotate(45 12 12)"
      />
      <rect
        x="4"
        y="10.6"
        width="16"
        height="2.8"
        rx="1.4"
        fill="currentColor"
        transform="rotate(-45 12 12)"
      />
    </Svg>
  );
}

export function MoonIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M15.5 3.2A8.8 8.8 0 1 0 20.8 15 7 7 0 0 1 15.5 3.2z" fill="currentColor" />
    </Svg>
  );
}

export function SunriseIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M5 16a7 7 0 0 1 14 0z" fill="currentColor" />
      <rect x="2.5" y="17.5" width="19" height="2.4" rx="1.2" fill="currentColor" opacity="0.45" />
      {[-60, -30, 0, 30, 60].map((a) => (
        <rect
          key={a}
          x="11"
          y="3"
          width="2"
          height="3.5"
          rx="1"
          fill="currentColor"
          transform={`rotate(${a} 12 16)`}
        />
      ))}
    </Svg>
  );
}

export function WarnIcon(p: P) {
  return (
    <Svg {...p}>
      <path
        d="M10.3 3.6a2 2 0 0 1 3.4 0l7.9 13.6a2 2 0 0 1-1.7 3H4.1a2 2 0 0 1-1.7-3z"
        fill="currentColor"
        opacity="0.4"
      />
      <rect x="10.9" y="8" width="2.2" height="6.5" rx="1.1" fill="currentColor" />
      <circle cx="12" cy="17" r="1.3" fill="currentColor" />
    </Svg>
  );
}

export function PencilIcon(p: P) {
  return (
    <Svg {...p}>
      <rect
        x="9.5"
        y="2.5"
        width="5"
        height="16"
        rx="2.2"
        fill="currentColor"
        transform="rotate(45 12 10.5)"
      />
      <path d="M4.2 19.8l1.2-4.6 3.4 3.4z" fill="currentColor" opacity="0.5" />
    </Svg>
  );
}

export function ChevronIcon(p: P & { up?: boolean }) {
  return (
    <Svg className={p.className}>
      <g transform={p.up ? "rotate(180 12 12)" : undefined}>
        <rect
          x="4.5"
          y="9"
          width="9"
          height="2.6"
          rx="1.3"
          fill="currentColor"
          transform="rotate(40 9 10.3)"
        />
        <rect
          x="10.5"
          y="9"
          width="9"
          height="2.6"
          rx="1.3"
          fill="currentColor"
          transform="rotate(-40 15 10.3)"
        />
      </g>
    </Svg>
  );
}

export function GripIcon(p: P) {
  return (
    <Svg {...p}>
      {[7, 12, 17].map((y) => (
        <g key={y}>
          <circle cx="9" cy={y} r="1.7" fill="currentColor" />
          <circle cx="15" cy={y} r="1.7" fill="currentColor" />
        </g>
      ))}
    </Svg>
  );
}

/* Miss reasons (Night ritual). */
export function SleepyIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M13.5 5.5A7.5 7.5 0 1 0 20 15a6 6 0 0 1-6.5-9.5z" fill="currentColor" />
      <rect x="15.5" y="3" width="5" height="1.8" rx="0.9" fill="currentColor" opacity="0.5" />
      <rect x="17.5" y="7" width="3.5" height="1.6" rx="0.8" fill="currentColor" opacity="0.35" />
    </Svg>
  );
}

export function PhoneIcon(p: P) {
  return (
    <Svg {...p}>
      <rect x="6.5" y="2" width="11" height="20" rx="3" fill="currentColor" />
      <rect x="8.3" y="4.5" width="7.4" height="13" rx="1.5" fill="currentColor" opacity="0.35" />
      <circle cx="12" cy="19.6" r="1" fill="currentColor" opacity="0.35" />
    </Svg>
  );
}

export function BoltIcon(p: P) {
  return (
    <Svg {...p}>
      <path d="M13.5 2 5 13.2h5.6L9.5 22 19 10h-5.8z" fill="currentColor" />
    </Svg>
  );
}

export function PeopleIcon(p: P) {
  return (
    <Svg {...p}>
      <circle cx="16" cy="8" r="3.2" fill="currentColor" opacity="0.45" />
      <path d="M10.5 20a5.5 5.5 0 0 1 11 0z" fill="currentColor" opacity="0.45" />
      <circle cx="9" cy="8.5" r="3.6" fill="currentColor" />
      <path d="M2.5 21a6.5 6.5 0 0 1 13 0z" fill="currentColor" />
    </Svg>
  );
}

export function SickIcon(p: P) {
  return (
    <Svg {...p}>
      <rect x="9.5" y="2.5" width="5" height="14" rx="2.5" fill="currentColor" opacity="0.35" />
      <rect x="11" y="8" width="2" height="9" rx="1" fill="currentColor" />
      <circle cx="12" cy="18" r="4" fill="currentColor" />
    </Svg>
  );
}

export function MoreDotsIcon(p: P) {
  return (
    <Svg {...p}>
      <circle cx="5" cy="12" r="2.4" fill="currentColor" />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
      <circle cx="19" cy="12" r="2.4" fill="currentColor" />
    </Svg>
  );
}
