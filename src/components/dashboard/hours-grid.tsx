"use client";

import { Copy } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  WEEKDAYS,
  formatTimeLabel,
  isValidDayRange,
  type WeeklyDayInput,
} from "@/lib/management";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** 30-minute option list for the open/close selects ("HH:MM" values). */
export const TIME_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

interface HoursGridProps {
  value: WeeklyDayInput[];
  onChange: (next: WeeklyDayInput[]) => void;
  idPrefix?: string;
}

/**
 * HoursEditor — 7-day weekly hours grid (UI-DESIGN §4). Per-day open toggle +
 * open/close time selects + "copy to all days" shortcut. A closed day is a day
 * with isClosed=true; persistence layers turn that into "no row" (the engine
 * treats a missing rule as closed).
 */
export function HoursGrid({ value, onChange, idPrefix = "hours" }: HoursGridProps) {
  const setDay = (weekday: number, patch: Partial<WeeklyDayInput>) => {
    onChange(value.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
  };

  const copyToAllDays = () => {
    const source =
      value.find((d) => !d.isClosed) ?? value.find((d) => d.weekday === 1) ?? value[0];
    if (!source) return;
    onChange(
      value.map((d) => ({
        ...d,
        isClosed: false,
        openTime: source.openTime,
        closeTime: source.closeTime,
      })),
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Weekly hours</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={copyToAllDays}
          className="gap-1.5"
        >
          <Copy className="size-3.5" aria-hidden />
          Copy to all days
        </Button>
      </div>
      <div
        role="group"
        aria-label="Weekly hours"
        className="divide-y divide-border rounded-[0.75rem] border border-border"
      >
        {WEEKDAYS.map((day) => {
          const row = value.find((d) => d.weekday === day.value);
          if (!row) return null;
          const invalid =
            !row.isClosed && !isValidDayRange(row.openTime, row.closeTime);
          return (
            <div
              key={day.value}
              className="flex items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-4"
            >
              <span className="w-10 shrink-0 text-sm font-medium sm:w-24">
                <span className="sm:hidden">{day.short}</span>
                <span className="hidden sm:inline">{day.label}</span>
              </span>
              <Switch
                id={`${idPrefix}-open-${day.value}`}
                aria-label={`${day.label} open`}
                checked={!row.isClosed}
                onCheckedChange={(checked) =>
                  setDay(day.value, { isClosed: !checked })
                }
              />
              {row.isClosed ? (
                <span className="text-sm text-muted-foreground">Closed</span>
              ) : (
                <div className="flex flex-1 items-center gap-2">
                  <Select
                    value={row.openTime}
                    onValueChange={(v) => setDay(day.value, { openTime: v })}
                    aria-label={`${day.label} opens at`}
                  >
                    <SelectTrigger
                      className={cn("tnum flex-1", invalid && "border-destructive")}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t} className="tnum">
                          {formatTimeLabel(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground" aria-hidden>
                    –
                  </span>
                  <Select
                    value={row.closeTime}
                    onValueChange={(v) => setDay(day.value, { closeTime: v })}
                    aria-label={`${day.label} closes at`}
                  >
                    <SelectTrigger
                      className={cn("tnum flex-1", invalid && "border-destructive")}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t} className="tnum">
                          {formatTimeLabel(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {invalid && (
                <span role="alert" className="text-xs text-destructive">
                  Close must be after open
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
