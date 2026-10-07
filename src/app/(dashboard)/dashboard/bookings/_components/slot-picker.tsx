"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SlotPill } from "@/components/booking/SlotPill";
import { cn } from "@/lib/utils";
import {
  formatDayLabel,
  formatSlotForCustomer,
} from "@/lib/availability";
import { addDaysYmd } from "@/lib/availability";
import {
  getRescheduleSlots,
  getTodayKey,
  type SlotContract,
} from "../../../_actions/scheduling";

export interface PickedSlot {
  startsAt: string;
  endsAt: string;
  staffId: string;
}

interface SlotPickerProps {
  businessId: string;
  serviceId: string;
  staff: Array<{ id: string; name: string }>;
  initialStaffId?: string | null;
  onSelect: (slot: PickedSlot | null) => void;
  selectedSlot?: PickedSlot | null;
}

/**
 * Scoped slot picker for dashboard reschedules and book-on-behalf.
 * Coded against the slot data contract: `{ business, days: [{ date, status,
 * slots: [{ startsAt, endsAt, staffId }], reason? }] }`.
 */
export function SlotPicker({
  businessId,
  serviceId,
  staff,
  initialStaffId,
  onSelect,
  selectedSlot,
}: SlotPickerProps) {
  const [contract, setContract] = useState<SlotContract | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string>(initialStaffId ?? "any");
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(
    (fromYmd: string, toYmd: string, sid: string) => {
      startTransition(async () => {
        setError(null);
        const today = await getTodayKey(businessId);
        const result = await getRescheduleSlots(
          businessId,
          serviceId,
          sid === "any" ? null : sid,
          fromYmd,
          toYmd
        );
        if ("error" in result) {
          setError(result.error);
          setContract(null);
          return;
        }
        setContract(result);
        const firstOpen = result.days.find((d) => d.slots.length > 0);
        setActiveDay((prev) =>
          prev && result.days.some((d) => d.date === prev) ? prev : (firstOpen?.date ?? today)
        );
      });
    },
    [businessId, serviceId]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const today = await getTodayKey(businessId);
      if (!cancelled) load(today, addDaysYmd(today, 13), staffId);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, serviceId]);

  const changeStaff = (sid: string) => {
    setStaffId(sid);
    onSelect(null);
    (async () => {
      const today = await getTodayKey(businessId);
      load(today, addDaysYmd(today, 13), sid);
    })();
  };

  const days = useMemo(() => contract?.days ?? [], [contract]);
  const active = days.find((d) => d.date === activeDay);
  const tz = contract?.business.timezone ?? "UTC";

  const isSelected = (s: { startsAt: string; staffId: string }) =>
    selectedSlot?.startsAt === s.startsAt &&
    selectedSlot?.staffId === s.staffId;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Staff">
        <StaffChip
          active={staffId === "any"}
          onClick={() => changeStaff("any")}
          label="Any staff"
        />
        {staff.map((s) => (
          <StaffChip
            key={s.id}
            active={staffId === s.id}
            onClick={() => changeStaff(s.id)}
            label={s.name}
          />
        ))}
      </div>

      {pending && !contract ? (
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-[0.5rem]" />
          ))}
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>Could not load times — {error}.</AlertDescription>
        </Alert>
      ) : (
        <>
          <div
            className="flex gap-1.5 overflow-x-auto pb-1"
            role="tablist"
            aria-label="Days"
          >
            {days.map((d) => (
              <button
                key={d.date}
                type="button"
                role="tab"
                aria-selected={activeDay === d.date}
                onClick={() => setActiveDay(d.date)}
                className={cn(
                  "flex min-w-16 flex-col items-center rounded-[0.5rem] border px-2 py-1.5 text-xs",
                  activeDay === d.date
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                )}
              >
                <span className="font-medium">
                  {formatDayLabel(d.date, tz).split(",")[0]}
                </span>
                <span className="tnum">{d.date.slice(5).replace("-", "/")}</span>
                <span
                  className={cn(
                    "mt-0.5 size-1.5 rounded-full",
                    d.status === "open" && d.slots.length > 0
                      ? "bg-success"
                      : d.status === "fully_booked"
                        ? "bg-warning"
                        : "bg-muted"
                  )}
                  aria-label={d.status.replace("_", " ")}
                />
              </button>
            ))}
          </div>

          {active && (
            <div role="tabpanel" aria-label={`Slots for ${active.date}`}>
              {active.slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {active.status === "closed"
                    ? `No times on ${formatDayLabel(active.date, tz).split(",")[0]} — ${active.reason ?? "closed"}`
                    : `Fully booked ${formatDayLabel(active.date, tz).split(",")[0]} — pick another day`}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                  {active.slots.map((s) => {
                    const label = formatSlotForCustomer(s.startsAt, tz, tz);
                    const staffName =
                      staffId === "any"
                        ? staff.find((x) => x.id === s.staffId)?.name
                        : undefined;
                    return (
                      <SlotPill
                        key={`${s.startsAt}-${s.staffId}`}
                        state={isSelected(s) ? "selected" : "available"}
                        onClick={() =>
                          onSelect({
                            startsAt: s.startsAt,
                            endsAt: s.endsAt,
                            staffId: s.staffId,
                          })
                        }
                        aria-label={`${label.customerLabel}${staffName ? ` with ${staffName}` : ""}`}
                        className="flex-col gap-0 py-1.5"
                      >
                        <span>{label.customerLabel}</span>
                        {staffName && (
                          <span className="text-[10px] font-normal opacity-80">
                            {staffName}
                          </span>
                        )}
                      </SlotPill>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StaffChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant={active ? "primary" : "outline"}
      size="sm"
      onClick={onClick}
      className="rounded-full"
    >
      {label}
    </Button>
  );
}
