"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * WeekStrip — 7-day horizontal snap-scroll date chips for the booking
 * wizard's date step. Each chip shows the weekday label, day number, and a
 * small status dot: closed (gray) / fully booked (hollow amber) / available
 * (teal). The selected day is the primary-filled chip.
 *
 * Days are day-precision `Date`s. `statusByDay` is keyed by
 * `yyyy-MM-dd` in the business timezone.
 */
export type DayStatus = "available" | "closed" | "full";

export interface WeekStripDay {
  date: Date;
  status: DayStatus;
}

interface WeekStripProps {
  days: WeekStripDay[];
  selected?: Date | null;
  onSelect?: (date: Date) => void;
  className?: string;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

const DOT_CLASS: Record<DayStatus, string> = {
  available: "bg-primary",
  closed: "bg-muted-foreground/40",
  full: "border-2 border-warning bg-transparent",
};

const CHIP_TITLE: Record<DayStatus, string> = {
  available: "Available",
  closed: "Closed",
  full: "Fully booked",
};

export function WeekStrip({
  days,
  selected,
  onSelect,
  className,
}: WeekStripProps) {
  const stripRef = React.useRef<HTMLDivElement>(null);

  // Scroll the selected chip into view when it changes.
  React.useEffect(() => {
    if (!selected) return;
    const el = stripRef.current?.querySelector<HTMLElement>(
      `[data-day="${dayKey(selected)}"]`
    );
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selected]);

  return (
    <div
      ref={stripRef}
      role="listbox"
      aria-label="Choose a day"
      className={cn(
        "flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2",
        className
      )}
    >
      {days.map(({ date, status }) => {
        const isSelected = selected ? isSameDay(date, selected) : false;
        const disabled = status === "closed" || status === "full";
        return (
          <button
            key={dayKey(date)}
            type="button"
            role="option"
            aria-selected={isSelected}
            disabled={disabled}
            data-day={dayKey(date)}
            title={CHIP_TITLE[status]}
            onClick={() => onSelect?.(date)}
            className={cn(
              "flex min-h-[64px] min-w-[56px] snap-center flex-col items-center justify-center gap-1 rounded-[0.75rem] border px-2 py-2 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:border-primary/50",
              disabled && "cursor-not-allowed opacity-50"
            )}
          >
            <span className="text-[11px] font-medium uppercase tracking-wide tnum">
              {date.toLocaleDateString("en-US", { weekday: "short" })}
            </span>
            <span className="text-lg font-semibold tnum leading-none">
              {date.getDate()}
            </span>
            <span
              aria-hidden
              title={CHIP_TITLE[status]}
              className={cn("size-1.5 rounded-full", DOT_CLASS[status], {
                "bg-primary-foreground/80": isSelected,
              })}
            />
          </button>
        );
      })}
    </div>
  );
}
