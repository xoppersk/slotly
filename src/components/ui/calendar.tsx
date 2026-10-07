"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * Slotly Calendar — simple single-date month-grid picker built on the
 * design-token palette (no heavy datepicker dependency in Phase 0).
 *
 * Props:
 *  - `value` / `onSelect`: the controlled selected date (day precision).
 *  - `disabledDate(date)`: predicate — days it returns true for render at
 *    reduced opacity and are not clickable.
 *  - `disabledReason(date)`: optional tooltip text explaining WHY a date is
 *    disabled (title attr), e.g. "Business closed", "Fully booked".
 *  - `month` / `onMonthChange`: controlled visible month (defaults to the
 *    selected date's month).
 */
export interface CalendarProps {
  value?: Date | null;
  onSelect?: (date: Date) => void;
  disabledDate?: (date: Date) => boolean;
  disabledReason?: (date: Date) => string | undefined;
  month?: Date;
  onMonthChange?: (month: Date) => void;
  className?: string;
}

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function Calendar({
  value,
  onSelect,
  disabledDate,
  disabledReason,
  month,
  onMonthChange,
  className,
}: CalendarProps) {
  const anchor = value ?? new Date();
  const [innerMonth, setInnerMonth] = React.useState(
    () => new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  );
  const visible = month ?? innerMonth;

  const setVisible = (next: Date) => {
    onMonthChange?.(next);
    if (month === undefined) setInnerMonth(next);
  };

  const firstWeekday = new Date(
    visible.getFullYear(),
    visible.getMonth(),
    1
  ).getDay();
  const daysInMonth = new Date(
    visible.getFullYear(),
    visible.getMonth() + 1,
    0
  ).getDate();
  const today = startOfDay(new Date());
  const selectedDay = value ? startOfDay(value) : null;

  const monthLabel = visible.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push(<span key={`pad-${i}`} aria-hidden />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(visible.getFullYear(), visible.getMonth(), day);
    const disabled = disabledDate?.(date) ?? false;
    const selected = selectedDay ? isSameDay(date, selectedDay) : false;
    const isToday = isSameDay(date, today);
    const reason = disabled ? disabledReason?.(date) : undefined;

    cells.push(
      <button
        key={day}
        type="button"
        disabled={disabled}
        title={reason}
        aria-label={date.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        aria-pressed={selected}
        onClick={() => onSelect?.(date)}
        className={cn(
          "flex size-10 items-center justify-center rounded-full text-sm tnum transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          disabled &&
            "cursor-not-allowed text-muted-foreground opacity-40",
          !disabled && !selected && "hover:bg-muted",
          selected && "bg-primary font-semibold text-primary-foreground",
          !selected && isToday && "font-semibold text-primary"
        )}
      >
        {day}
      </button>
    );
  }

  return (
    <div className={cn("w-fit p-3", className)} role="group" aria-label="Calendar">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">{monthLabel}</p>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Previous month"
            onClick={() =>
              setVisible(
                new Date(visible.getFullYear(), visible.getMonth() - 1, 1)
              )
            }
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Next month"
            onClick={() =>
              setVisible(
                new Date(visible.getFullYear(), visible.getMonth() + 1, 1)
              )
            }
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((d) => (
          <span
            key={d}
            className="flex size-10 items-center justify-center text-xs font-medium text-muted-foreground"
          >
            {d}
          </span>
        ))}
        {cells}
      </div>
    </div>
  );
}
