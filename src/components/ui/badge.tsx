import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Slotly Badge — status chips with optional dot indicator.
 * Use StatusChip for booking/payment statuses; Badge for generic labels.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-transparent",
        secondary: "bg-secondary text-secondary-foreground border-transparent",
        outline: "bg-card text-foreground",
        success:
          "bg-success/10 text-success border-success/20 dark:bg-success/15",
        warning:
          "bg-warning/10 text-warning border-warning/20 dark:bg-warning/15",
        destructive:
          "bg-destructive/10 text-destructive border-destructive/20 dark:bg-destructive/15",
        info: "bg-info/10 text-info border-info/20 dark:bg-info/15",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Show a leading status dot (currentColor). */
  dot?: boolean;
}

function Badge({ className, variant, dot = false, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full bg-current"
        />
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
