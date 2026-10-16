"use client";
/* Shared dashboard bits: switch, small icons drawn on the dashboard
   screens but not in the foundation icon set (same 1.8px/18px stroke
   spec), and the drawer focus-trap hook. */
import { useEffect, useRef, type RefObject } from "react";
import type { SVGProps } from "react";

function base(props: SVGProps<SVGSVGElement>) {
  return {
    width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    "aria-hidden": true, ...props,
  };
}
export function IconSearch(props: SVGProps<SVGSVGElement>) {
  return (<svg {...base(props)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
}
export function IconClose(props: SVGProps<SVGSVGElement>) {
  return (<svg {...base(props)}><path d="M18 6 6 18M6 6l12 12" /></svg>);
}
export function IconChevronLeft(props: SVGProps<SVGSVGElement>) {
  return (<svg {...base(props)}><path d="M15 6l-6 6 6 6" /></svg>);
}
export function IconChevronRight(props: SVGProps<SVGSVGElement>) {
  return (<svg {...base(props)}><path d="M9 6l6 6-6 6" /></svg>);
}
export function IconArrowRight14(props: SVGProps<SVGSVGElement>) {
  return (<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
}
export function IconGrip(props: SVGProps<SVGSVGElement>) {
  return (<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></svg>);
}

/** Switch — role="switch" with a label (HANDOVER §11), geometry from screens. */
export function Toggle({
  checked, label, onChange,
}: {
  checked: boolean;
  label: string;
  onChange?: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="sl-d-tog"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange?.(!checked)}
    />
  );
}

/** Focus trap + Esc for the booking drawer (HANDOVER §11). Returns a ref
    to attach to the dialog element; onClose fires on Escape. */
export function useDrawerTrap<T extends HTMLElement>(onClose: () => void): RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prev = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter((n) => n.offsetParent !== null);
    (focusables()[0] ?? el).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return ref;
}

/** "9:45 AM" style label from a 24h "09:45" string. */
export function timeLabel(t24: string): string {
  const [h, m] = t24.split(":").map(Number);
  const meridiem = (h ?? 0) >= 12 ? "PM" : "AM";
  const h12 = (h ?? 0) % 12 === 0 ? 12 : (h ?? 0) % 12;
  return `${h12}:${String(m ?? 0).padStart(2, "0")} ${meridiem}`;
}
/** "to 9:45" sub-label as drawn in the Bookings table. */
export function toLabel(t24: string): string {
  const [h, m] = t24.split(":").map(Number);
  const h12 = (h ?? 0) % 12 === 0 ? 12 : (h ?? 0) % 12;
  return `to ${h12}:${String(m ?? 0).padStart(2, "0")}`;
}
