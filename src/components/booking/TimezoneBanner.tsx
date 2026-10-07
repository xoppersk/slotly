"use client";

import { Globe } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * TimezoneBanner — dual-timezone note on the booking wizard's time step:
 * "10:00 AM your time · 2:00 PM business time". Shown when the customer's
 * timezone differs from the business's, so the booked time is unambiguous.
 *
 * Times are pre-formatted strings (the wizard phase owns formatting with
 * date-fns-tz); this component only presents them.
 */
interface TimezoneBannerProps {
  customerTime: string;
  customerTimezone: string;
  businessTime: string;
  businessTimezone: string;
  className?: string;
}

export function TimezoneBanner({
  customerTime,
  customerTimezone,
  businessTime,
  businessTimezone,
  className,
}: TimezoneBannerProps) {
  return (
    <div
      role="note"
      aria-label="Timezone conversion"
      className={cn(
        "flex items-center gap-2 rounded-[0.5rem] border border-info/25 bg-info/10 px-3 py-2 text-sm text-foreground dark:bg-info/15",
        className
      )}
    >
      <Globe className="size-4 shrink-0 text-info" aria-hidden />
      <p className="tnum">
        <span className="font-medium">{customerTime}</span>{" "}
        <span className="text-muted-foreground">your time</span>
        <span aria-hidden className="mx-1.5 text-muted-foreground">
          ·
        </span>
        <span className="font-medium">{businessTime}</span>{" "}
        <span className="text-muted-foreground">
          business time ({businessTimezone})
        </span>
      </p>
      <span className="sr-only">
        {customerTime} in {customerTimezone} equals {businessTime} in {businessTimezone}
      </span>
    </div>
  );
}
