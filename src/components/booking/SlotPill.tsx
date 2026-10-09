"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * SlotPill — Slotly's signature time-slot pill.
 *
 * States:
 *  - `available` — outline pill, clickable.
 *  - `selected` — primary fill (white text).
 *  - `unavailable` — muted + strikethrough, not clickable.
 *  - `pending` — amber tint (slot held by someone else / hold countdown).
 *
 * Always ≥ 48px tall (touch target) and rendered with tabular numerals so
 * slot grids align. Pass `as="span"` when rendering inside non-interactive
 * contexts (legend, summary).
 */
const slotPillVariants = cva(
  "inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium tnum transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      state: {
        available:
          "border-border bg-card text-foreground hover:border-primary hover:text-primary",
        selected:
          "border-primary bg-primary font-bold text-primary-foreground shadow-[inset_0_0_0_2px_var(--card)] hover:bg-primary-hover",
        unavailable:
          "cursor-not-allowed border-transparent bg-slot-unavailable text-muted-foreground line-through decoration-muted-foreground/60",
        pending:
          "cursor-not-allowed border-warning/30 bg-slot-pending text-warning dark:text-accent",
      },
    },
    defaultVariants: {
      state: "available",
    },
  }
);

export type SlotPillState = VariantProps<typeof slotPillVariants>["state"];

interface SlotPillProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "disabled">,
    VariantProps<typeof slotPillVariants> {
  as?: "button" | "span";
}

const SlotPill = React.forwardRef<HTMLElement, SlotPillProps>(
  (
    { className, state, as = "button", children, "aria-label": ariaLabel, ...props },
    ref
  ) => {
    const disabled = state === "unavailable" || state === "pending";
    const Comp = (as === "span" ? "span" : "button") as "button";
    return (
      <Comp
        ref={ref as React.Ref<HTMLButtonElement>}
        type={as === "button" ? "button" : undefined}
        disabled={as === "button" ? disabled : undefined}
        aria-disabled={disabled}
        aria-label={ariaLabel}
        className={cn(slotPillVariants({ state }), className)}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);
SlotPill.displayName = "SlotPill";

export { SlotPill, slotPillVariants };
