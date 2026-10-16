/* Inline stroke SVGs copied from the canvas HTML: 1.8px stroke, 18px,
   currentColor (HANDOVER §3). No icon fonts, no emoji. */
import type { SVGProps } from "react";

function base(props: SVGProps<SVGSVGElement>) {
  return {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export function IconClock(props: SVGProps<SVGSVGElement>) {
  return (<svg {...base(props)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
}
export function IconList(props: SVGProps<SVGSVGElement>) {
  return (<svg {...base(props)}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>);
}
export function IconCalendar(props: SVGProps<SVGSVGElement>) {
  return (<svg {...base(props)}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>);
}
export function IconCustomers(props: SVGProps<SVGSVGElement>) {
  return (<svg {...base(props)}><circle cx="9" cy="8" r="4" /><path d="M2 21c0-4 3-6 7-6s7 2 7 6M17 11a3 3 0 1 0 0-6M22 21c0-3-2-5-5-5.5" /></svg>);
}
export function IconScissors(props: SVGProps<SVGSVGElement>) {
  return (<svg {...base(props)}><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M8.1 8.1 20 20M8.1 15.9 20 4" /></svg>);
}
export function IconPerson(props: SVGProps<SVGSVGElement>) {
  return (<svg {...base(props)}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>);
}
export function IconAvailability(props: SVGProps<SVGSVGElement>) {
  return (<svg {...base(props)}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M7 12h4M7 16h8" /></svg>);
}
export function IconSettings(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
export function IconExternal(props: SVGProps<SVGSVGElement>) {
  return (<svg {...base(props)}><path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg>);
}
export function IconPlus(props: SVGProps<SVGSVGElement>) {
  return (<svg {...base(props)}><path d="M12 5v14M5 12h14" /></svg>);
}
export function IconArrowRight(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden {...props}>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}
export function IconArrowRightLg(props: SVGProps<SVGSVGElement>) {
  return (<svg {...base({ width: 16, height: 16, ...props })}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
}
export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (<svg {...base(props)}><path d="M4 12.5 9.5 18 20 6.5" /></svg>);
}
export function IconChevronLeft(props: SVGProps<SVGSVGElement>) {
  return (<svg {...base(props)}><path d="M14.5 5.5 8 12l6.5 6.5" /></svg>);
}

/** Slotly wordmark logo (from Marketing.html): oxblood tile, two bars. */
export function SlotlyMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--oxblood)" />
      <rect x="7" y="9" width="18" height="6" rx="3" fill="#FFFFFF" />
      <rect x="7" y="18" width="11" height="6" rx="3" fill="#FFFFFF" opacity=".55" />
    </svg>
  );
}

/** Hold progress ring (from Main.html): track + linen arc. */
export function HoldRing({ size = 56, fraction = 1 }: { size?: number; fraction?: number }) {
  const r = size / 2 - 2.5;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ flex: "none" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#5A3A34" strokeWidth="5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F2C9C2" strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, fraction)))}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}
