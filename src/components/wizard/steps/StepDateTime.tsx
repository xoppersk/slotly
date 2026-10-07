"use client";

import * as React from "react";
import { CalendarDays, AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { SlotPill } from "@/components/booking/SlotPill";
import { WeekStrip, type WeekStripDay } from "@/components/booking/WeekStrip";
import { TimezoneBanner } from "@/components/booking/TimezoneBanner";
import {
  apiJson,
  pickNearestAlternatives,
  type ApiDayAvailability,
  type AvailabilityResponse,
  type ApiSlot,
} from "@/lib/booking/public-api";
import {
  formatSlotForCustomer,
  formatDayLabel,
} from "@/lib/availability";

import type { StepProps } from "../BookingWizard";

const RANGE_DAYS = 60;

function ymdOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Date at browser-local noon so WeekStrip's getDate() shows the right day number. */
function dateFromYmd(dateYmd: string): Date {
  const parts = dateYmd.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(y, m - 1, d, 12, 0, 0);
}

function groupLabel(hour: number): string {
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

/**
 * Wizard Step 3 — Date & time (the signature interaction).
 *
 * Week strip + month Calendar popover; the slot grid loads per selected day
 * from /api/availability (skeleton while loading). SlotPills carry the four
 * states; closed vs fully-booked days get distinct empty states, always with
 * a next-opening action. A slot-taken race never dead-ends: an inline notice
 * offers the 3 nearest alternatives.
 */
export function StepDateTime({
  ctx,
  state,
  update,
  onNext,
  setPrimary,
  customerTimezone,
}: StepProps) {
  const { business, services } = ctx;
  const service = services.find((s) => s.id === state.serviceId);
  const staffId = state.staffId ?? "any";

  const [days, setDays] = React.useState<ApiDayAvailability[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [weekStart, setWeekStart] = React.useState(0);
  const [calendarOpen, setCalendarOpen] = React.useState(false);

  // Reset the slot grid when the step's inputs change (render-time derived
  // state — the React-endorsed alternative to setState-in-effect).
  const queryKey = `${business.id}|${service?.id ?? ""}|${staffId}`;
  const [lastQueryKey, setLastQueryKey] = React.useState(queryKey);
  if (queryKey !== lastQueryKey) {
    setLastQueryKey(queryKey);
    setDays(null);
    setLoading(true);
    setError(null);
    setWeekStart(0);
  }

  const daysByDate = React.useMemo(
    () => new Map((days ?? []).map((d) => [d.date, d])),
    [days]
  );

  // Fetch a 60-day availability window when the step mounts or its inputs change.
  // Loading/error state is reset during render above; this effect only
  // subscribes to the fetch and applies results in callbacks.
  const currentService = service;
  React.useEffect(() => {
    if (!currentService) return;
    let cancelled = false;
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + RANGE_DAYS);
    const params = new URLSearchParams({
      businessId: business.id,
      serviceId: currentService.id,
      staffId,
      from: ymdOf(from),
      to: ymdOf(to),
    });
    fetch(`/api/availability?${params.toString()}`)
      .then((res) => apiJson<AvailabilityResponse>(res, "Couldn't load times"))
      .then((data) => {
        if (!cancelled) {
          setDays(data.days);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Couldn't load times");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  // Default to the first open day once data arrives (derived, not stored).
  const firstOpenDate = React.useMemo(
    () => days?.find((d) => d.slots.length > 0)?.date ?? null,
    [days]
  );
  const effectiveDayKey = state.dayKey ?? firstOpenDate;

  React.useEffect(() => {
    setPrimary(
      state.slot
        ? { label: "Continue", onClick: onNext, disabled: false }
        : { label: "Continue", onClick: onNext, disabled: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.slot]);

  const selectedDay = effectiveDayKey ? daysByDate.get(effectiveDayKey) ?? null : null;
  const selectedSlot = state.slot;

  const tzDiffers = customerTimezone !== business.timezone;
  const dualForSelected = selectedSlot
    ? formatSlotForCustomer(
        selectedSlot.startsAt,
        business.timezone,
        customerTimezone
      )
    : null;

  const weekDays: WeekStripDay[] = React.useMemo(() => {
    const list = days ?? [];
    return list.slice(weekStart, weekStart + 7).map((d) => ({
      date: dateFromYmd(d.date),
      status:
        d.status === "closed" ? "closed" : d.slots.length === 0 ? "full" : "available",
    }));
  }, [days, weekStart]);

  const selectedDate = effectiveDayKey ? dateFromYmd(effectiveDayKey) : null;

  const nextOpenDay = React.useMemo(() => {
    const list = days ?? [];
    return list.find((d) => d.slots.length > 0) ?? null;
  }, [days]);

  const selectDay = (day: ApiDayAvailability) => {
    update({ dayKey: day.date, slot: null, slotRaceNotice: null });
  };

  const selectSlot = (slot: ApiSlot) => {
    update({
      slot: { startsAt: slot.startsAt, endsAt: slot.endsAt, staffId: slot.staffId },
      dayKey: effectiveDayKey,
      slotRaceNotice: null,
    });
  };

  const groupedSlots = React.useMemo(() => {
    if (!selectedDay) return [];
    const groups = new Map<string, ApiSlot[]>();
    for (const slot of selectedDay.slots) {
      const localHour = new Date(slot.startsAt).getHours();
      const label = groupLabel(localHour);
      const arr = groups.get(label) ?? [];
      arr.push(slot);
      groups.set(label, arr);
    }
    return ["Morning", "Afternoon", "Evening"].flatMap((label) =>
      groups.has(label) ? [{ label, slots: groups.get(label)! }] : []
    );
  }, [selectedDay]);

  const alternatives = React.useMemo(() => {
    if (!state.slotRaceNotice || !days) return [];
    return pickNearestAlternatives(days, state.slotRaceNotice.missedStartsAt, 3);
  }, [state.slotRaceNotice, days]);

  const jumpToNextOpening = () => {
    if (nextOpenDay) selectDay(nextOpenDay);
  };

  const jumpToFirstAvailable = () => {
    if (nextOpenDay) {
      selectDay(nextOpenDay);
      if (nextOpenDay.slots[0]) selectSlot(nextOpenDay.slots[0]);
    }
  };

  if (!service) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>
          No service was selected. Please go back and choose a service.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
        Pick a date &amp; time
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {service.name} · {service.duration_minutes} min
      </p>

      {/* Slot-taken race notice — inline alternatives, never a dead end */}
      {state.slotRaceNotice && (
        <Alert variant="warning" className="mt-4">
          <AlertTriangle className="size-4" aria-hidden />
          <AlertTitle>{state.slotRaceNotice.message}</AlertTitle>
          <AlertDescription>
            {alternatives.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {alternatives.map((slot) => {
                  const dual = formatSlotForCustomer(
                    slot.startsAt,
                    business.timezone,
                    customerTimezone
                  );
                  return (
                    <SlotPill
                      key={`${slot.startsAt}-${slot.staffId}`}
                      state="available"
                      onClick={() => selectSlot(slot)}
                    >
                      {dual.customerLabel}
                    </SlotPill>
                  );
                })}
              </div>
            ) : (
              <span>Please pick another day.</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Week strip + month picker */}
      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous week"
            disabled={weekStart === 0 || loading}
            onClick={() => setWeekStart((w) => Math.max(0, w - 7))}
          >
            ‹
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next week"
            disabled={loading || !days || weekStart + 7 >= days.length}
            onClick={() => setWeekStart((w) => w + 7)}
          >
            ›
          </Button>
        </div>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <CalendarDays className="mr-1.5 size-4" aria-hidden />
              More dates
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="end">
            <Calendar
              value={selectedDate}
              onSelect={(d) => {
                const key = ymdOf(d);
                const day = daysByDate.get(key);
                if (day) {
                  selectDay(day);
                  setCalendarOpen(false);
                }
              }}
              disabledDate={(d) => {
                const day = daysByDate.get(ymdOf(d));
                return !day || day.slots.length === 0;
              }}
              disabledReason={(d) => {
                const day = daysByDate.get(ymdOf(d));
                if (!day || day.status === "closed") return "Business closed";
                if (day.slots.length === 0) return "Fully booked";
                return undefined;
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      {loading ? (
        <div className="mt-3 flex gap-2" aria-label="Loading days">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-16 w-14 rounded-[0.75rem]" />
          ))}
        </div>
      ) : error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>Couldn&apos;t load times</AlertTitle>
          <AlertDescription className="flex items-center gap-2">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="shrink-0"
            >
              <RotateCcw className="mr-1 size-3.5" aria-hidden />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <WeekStrip
          days={weekDays}
          selected={selectedDate}
          onSelect={(d) => {
            const day = daysByDate.get(ymdOf(d));
            if (day && day.slots.length > 0) selectDay(day);
          }}
          className="mt-3"
        />
      )}

      {/* Timezone banner — only when the customer tz differs from the business tz */}
      {tzDiffers && dualForSelected && (
        <TimezoneBanner
          customerTime={dualForSelected.customerLabel}
          customerTimezone={customerTimezone}
          businessTime={dualForSelected.businessLabel}
          businessTimezone={business.timezone}
          className="mt-4"
        />
      )}

      {/* Slot grid / empty states */}
      <div className="mt-4">
        {loading ? (
          <div aria-label="Loading times" className="grid grid-cols-3 gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 rounded-full" />
            ))}
          </div>
        ) : !selectedDay ? (
          <p className="text-sm text-muted-foreground">
            Choose a day to see available times.
          </p>
        ) : selectedDay.slots.length === 0 ? (
          selectedDay.status === "closed" ? (
            <div className="rounded-[0.75rem] border border-border bg-card p-6 text-center">
              <p className="text-[15px] font-semibold">
                No times on {formatDayLabel(selectedDay.date, business.timezone)} — closed
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                The business isn&apos;t open that day.
              </p>
              {nextOpenDay && (
                <Button variant="outline" className="mt-4" onClick={jumpToNextOpening}>
                  Next opening:{" "}
                  {formatDayLabel(nextOpenDay.date, business.timezone)}
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-[0.75rem] border border-border bg-card p-6 text-center">
              <p className="text-[15px] font-semibold">
                Fully booked {formatDayLabel(selectedDay.date, business.timezone)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedDay.reason ?? "Every slot is taken."}
              </p>
              {nextOpenDay && (
                <Button variant="outline" className="mt-4" onClick={jumpToNextOpening}>
                  Next opening:{" "}
                  {formatDayLabel(nextOpenDay.date, business.timezone)}
                  {nextOpenDay.slots[0] && (
                    <>
                      {" "}at{" "}
                      {
                        formatSlotForCustomer(
                          nextOpenDay.slots[0].startsAt,
                          business.timezone,
                          customerTimezone
                        ).customerLabel
                      }
                    </>
                  )}
                </Button>
              )}
            </div>
          )
        ) : (
          <div className="flex flex-col gap-5">
            {groupedSlots.map(({ label, slots }) => (
              <section key={label} aria-label={label}>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </h2>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((slot) => {
                    const key = `${slot.startsAt}-${slot.staffId}`;
                    const isSelected =
                      selectedSlot?.startsAt === slot.startsAt &&
                      selectedSlot?.staffId === slot.staffId;
                    const dual = formatSlotForCustomer(
                      slot.startsAt,
                      business.timezone,
                      customerTimezone
                    );
                    return (
                      <SlotPill
                        key={key}
                        state={isSelected ? "selected" : "available"}
                        aria-pressed={isSelected}
                        onClick={() => selectSlot(slot)}
                        title={
                          dual.showDual
                            ? `${dual.customerLabel} your time · ${dual.businessLabel} business time`
                            : dual.customerLabel
                        }
                      >
                        {dual.customerLabel}
                      </SlotPill>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Empty range */}
      {!loading && !error && days && days.every((d) => d.slots.length === 0) && (
        <div className="mt-6 rounded-[0.75rem] border border-border bg-card p-6 text-center">
          <p className="text-[15px] font-semibold">
            Nothing free in the next {RANGE_DAYS} days
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {business.phone ? (
              <>
                Call us at{" "}
                <a
                  href={`tel:${business.phone.replace(/[^+\d]/g, "")}`}
                  className="underline underline-offset-2"
                >
                  {business.phone}
                </a>{" "}
                and we&apos;ll find you a time.
              </>
            ) : (
              "Please check back soon — new times open up regularly."
            )}
          </p>
        </div>
      )}

      {/* First-available shortcut */}
      {!loading && !error && nextOpenDay && !selectedSlot && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={jumpToFirstAvailable}>
            Jump to first available
          </Button>
        </div>
      )}
    </div>
  );
}
