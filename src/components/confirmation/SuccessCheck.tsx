import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * SuccessCheck — the confirmation screen's single draw-on stroke (no
 * confetti, per UI-DESIGN.md §2.8). An SVG circle + check that draws itself
 * via stroke-dashoffset animation.
 */
export function SuccessCheck({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-20 items-center justify-center rounded-full bg-success/10",
        className
      )}
    >
      <svg
        viewBox="0 0 52 52"
        className="size-12 text-success"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle
          cx="26"
          cy="26"
          r="24"
          className="animate-[slotly-draw_0.7s_ease-out_forwards]"
          strokeDasharray="151"
          strokeDashoffset="151"
        />
        <path
          d="M15 27l8 8 15-16"
          className="animate-[slotly-draw_0.45s_ease-out_0.55s_forwards]"
          strokeDasharray="40"
          strokeDashoffset="40"
        />
      </svg>
      <Check className="sr-only" />
      <style>{`@keyframes slotly-draw { to { stroke-dashoffset: 0; } }`}</style>
    </span>
  );
}
