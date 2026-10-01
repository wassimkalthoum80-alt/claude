import type { SVGProps } from 'react';

/** Minimal line icons (24×24, currentColor). */
type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const IconCpr = (p: IconProps) => (
  <svg {...base} {...p}>
    <path
      d="M12 20s-7-4.4-7-9.6A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.4C19 15.6 12 20 12 20Z"
      fill="currentColor"
      fillOpacity={0.25}
    />
    <path d="M9 3.5h6M12 3.5v4" />
    <path d="M8.5 7h7" />
  </svg>
);

export const IconPulse = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M2 12h4l2-5 3.5 11 3-8 1.5 2H22" />
  </svg>
);

export const IconBolt = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M13 2 5 13.5h6L10 22l9-12h-6l1-8Z" fill="currentColor" fillOpacity={0.2} />
  </svg>
);

export const IconLungs = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M12 3v8M12 11c-1 1.5-2.5 2-4 2M12 11c1 1.5 2.5 2 4 2" />
    <path d="M8.5 7C5 7 3 12 3 16.5 3 19 4.5 20 6.5 19.5 9 19 9.5 17 9.5 14V9c0-1.2-.4-2-1-2ZM15.5 7C19 7 21 12 21 16.5c0 2.5-1.5 3.5-3.5 3-2.5-.5-3-2.5-3-5.5V9c0-1.2.4-2 1-2Z" />
  </svg>
);

export const IconSyringe = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="m18 2 4 4M17 7l3-3M19 9 8.5 19.5 4.5 15.5 15 5l4 4ZM4.5 15.5 2 22l6.5-2.5M11 9l4 4M8 12l2 2" />
  </svg>
);

export const IconDrip = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M8 2h8v9a4 4 0 0 1-8 0V2ZM8 6h8" />
    <path d="M12 15v3M10.5 18h3v2h-3zM12 20v2" />
  </svg>
);

export const IconProbe = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M9 3h6l1 9a4 4 0 0 1-4 4 4 4 0 0 1-4-4l1-9Z" />
    <path d="M12 16v3a2 2 0 0 0 2 2h4" />
    <path d="M9.5 8h5" />
  </svg>
);

export const IconFlask = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3" />
    <path d="M7.5 15h9" />
  </svg>
);

export const IconTools = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M14.5 6.5a4 4 0 0 0 5 5L21 13l-8 8-3-3 5.5-5.5M9.5 17.5 3 11l2-2 6.5 6.5" />
    <path d="m4 4 3 3M6 2 2 6" />
  </svg>
);

export const IconPause = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
    <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconStop = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none" />
  </svg>
);

export const IconLock = (p: IconProps) => (
  <svg {...base} width={12} height={12} {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

export const IconSliders = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </svg>
);

export const IconSpeaker = ({ muted, ...p }: IconProps & { muted?: boolean }) => (
  <svg {...base} {...p}>
    <path d="M4 9h4l5-4v14l-5-4H4z" />
    {muted ? (
      <path d="m17 9 5 6M22 9l-5 6" />
    ) : (
      <path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" />
    )}
  </svg>
);
