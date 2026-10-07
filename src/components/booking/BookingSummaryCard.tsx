import {
  Scissors,
  User,
  CalendarClock,
  Receipt,
  FileText,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/format";
import { Separator } from "@/components/ui/separator";

/**
 * BookingSummaryCard — service / staff / datetime / price / policy
 * line-item summary. Reused in the wizard (side panel + mobile bottom bar),
 * the review step, the confirmation screen, the manage-booking page, and
 * the dashboard booking drawer. Purely presentational: the caller owns the
 * data and formatting.
 */
export interface BookingSummaryLine {
  icon?: "service" | "staff" | "datetime" | "policy";
  label: string;
  value: string;
}

interface BookingSummaryCardProps {
  lines: BookingSummaryLine[];
  /** Total price in integer cents; null hides the total row. */
  totalCents?: number | null;
  currency?: string;
  className?: string;
}

const ICONS = {
  service: Scissors,
  staff: User,
  datetime: CalendarClock,
  policy: FileText,
} as const;

export function BookingSummaryCard({
  lines,
  totalCents = null,
  currency = "USD",
  className,
}: BookingSummaryCardProps) {
  return (
    <section
      aria-label="Booking summary"
      className={cn(
        "rounded-[0.75rem] border border-border bg-card p-4 shadow-sm",
        className
      )}
    >
      <dl className="flex flex-col gap-3">
        {lines.map((line, i) => {
          const Icon = line.icon ? ICONS[line.icon] : null;
          return (
            <div key={`${line.label}-${i}`} className="flex items-start gap-3">
              {Icon && (
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-[0.5rem] bg-primary/10 text-primary"
                >
                  <Icon className="size-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {line.label}
                </dt>
                <dd className="truncate text-sm font-medium text-foreground">
                  {line.value}
                </dd>
              </div>
            </div>
          );
        })}
      </dl>
      {totalCents !== null && (
        <>
          <Separator className="my-3" />
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Receipt className="size-4" aria-hidden />
              Total due
            </span>
            <span className="text-lg font-semibold tnum text-foreground">
              {formatCents(totalCents, currency)}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
