import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

import type { WizardStepId } from "./types";

export const STEP_LABELS: Record<WizardStepId, string> = {
  service: "Service",
  staff: "Staff",
  datetime: "Date & time",
  details: "Details",
  payment: "Payment",
  review: "Review",
};

/**
 * WizardProgress — numbered-step progress indicator with checkmarks for
 * completed steps (UI-DESIGN.md §2.2). Compact horizontal layout that fits
 * 360px; completed steps show a check, the current step is highlighted.
 */
export function WizardProgress({
  steps,
  currentIndex,
}: {
  steps: WizardStepId[];
  currentIndex: number;
}) {
  return (
    <ol
      aria-label="Booking progress"
      className="flex items-center gap-1 sm:gap-2"
    >
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        return (
          <li key={step} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
            <span
              aria-hidden
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tnum",
                done && "bg-primary text-primary-foreground",
                current && "bg-primary/15 text-primary ring-1 ring-primary",
                !done && !current && "bg-muted text-muted-foreground"
              )}
            >
              {done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "truncate text-xs font-medium",
                current ? "text-foreground" : "text-muted-foreground",
                "hidden min-[400px]:block"
              )}
              aria-current={current ? "step" : undefined}
            >
              {STEP_LABELS[step]}
            </span>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "h-px flex-1",
                  done || current ? "bg-primary/40" : "bg-border"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
