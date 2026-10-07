"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { addDaysYmd } from "@/lib/availability";
import {
  formatTimeShort,
  weekdayShort,
  dayOfMonth,
  dayHeaderLabel,
} from "@/lib/dashboard/format";
import {
  getCalendarWeek,
  createBlockTime,
  deleteBlockTime,
  deleteTimeOff,
  type CalendarWeek,
} from "../../../_actions/scheduling";

interface WeekCalendarProps {
  businessId: string;
  weekStart: string; // YYYY-MM-DD (Monday, business-local)
  timezone: string;
  todayKey: string;
  isOwner: boolean;
}

const PX_PER_HOUR = 56;

interface PositionedBlock {
  key: string;
  kind: "booking" | "timeoff";
  /** Minutes from business-local midnight, clamped to the day. */
  startMin: number;
  endMin: number;
  booking?: CalendarWeek["bookings"][number];
  timeOff?: CalendarWeek["timeOff"][number];
}

interface DayColumn {
  date: string;
  blackout: CalendarWeek["blackouts"][number] | null;
  override: CalendarWeek["overrides"][number] | null;
  blocks: PositionedBlock[];
}

/**
 * Week calendar: staff tabs, color-coded blocks (booking = service color,
 * time-off = striped, blackout/blocked = gray, payment hold = amber).
 * Click empty space → block-time quick create (owner). Click a booking →
 * its detail drawer. Day-swipe view on mobile.
 */
export function WeekCalendar({
  businessId,
  weekStart,
  timezone,
  todayKey,
  isOwner,
}: WeekCalendarProps) {
  const [data, setData] = useState<CalendarWeek | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [staffTab, setStaffTab] = useState<string>("all");
  const [mobileDay, setMobileDay] = useState<string>(() =>
    todayKeyInWeek(weekStart, todayKey)
  );
  const [blockDialog, setBlockDialog] = useState<{
    date: string;
    staffId: string | null;
  } | null>(null);
  const [detailTimeOff, setDetailTimeOff] = useState<
    CalendarWeek["timeOff"][number] | null
  >(null);
  const [detailOverride, setDetailOverride] = useState<
    CalendarWeek["overrides"][number] | null
  >(null);
  const [pending, startTransition] = useTransition();
  const touchX = useRef<number | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      const result = await getCalendarWeek(businessId, weekStart);
      if ("error" in result) {
        setError(result.error);
        setData(null);
        return;
      }
      setData(result);
    });
  }, [businessId, weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  const showStaffTabs = isOwner && (data?.staff.length ?? 0) > 1;

  const days: DayColumn[] = useMemo(
    () => (data ? buildDays(data, staffTab, timezone) : []),
    [data, staffTab, timezone]
  );

  const { gridStartHour, gridEndHour } = useMemo(() => {
    let min = 8;
    let max = 18;
    if (data) {
      const consider = (iso: string, isEnd = false) => {
        const h = hourInTz(iso, timezone);
        const m = minuteInTz(iso, timezone);
        if (isEnd && m > 0) min = Math.min(min, h);
        else if (!isEnd) min = Math.min(min, h);
        max = Math.max(max, h + (m > 0 ? 1 : 0));
      };
      for (const b of data.bookings) {
        if (staffTab !== "all" && b.staff_id !== staffTab) continue;
        consider(b.starts_at);
        consider(b.ends_at, true);
      }
      for (const t of data.timeOff) {
        if (staffTab !== "all" && t.staff_id !== staffTab) continue;
        consider(t.starts_at);
        consider(t.ends_at, true);
      }
    }
    return {
      gridStartHour: Math.max(6, Math.min(20, min)),
      gridEndHour: Math.max(10, Math.min(23, max)),
    };
  }, [data, staffTab, timezone]);

  const gridHeight = (gridEndHour - gridStartHour) * PX_PER_HOUR;
  const hours = Array.from(
    { length: gridEndHour - gridStartHour + 1 },
    (_, i) => gridStartHour + i
  );

  const swipeHandlers = {
    onTouchStart: (e: React.TouchEvent) => {
      touchX.current = e.touches[0]?.clientX ?? null;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const start = touchX.current;
      const end = e.changedTouches[0]?.clientX ?? null;
      touchX.current = null;
      if (start === null || end === null) return;
      const dx = end - start;
      if (Math.abs(dx) < 50) return;
      setMobileDay((d) => addDaysYmd(d, dx < 0 ? 1 : -1));
    },
  };

  const mobileColumn = days.find((d) => d.date === mobileDay);

  const openBlockDialog = (date: string) =>
    setBlockDialog({ date, staffId: staffTab === "all" ? null : staffTab });

  return (
    <div className="flex flex-col gap-3">
      {showStaffTabs && (
        <div className="flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Staff">
          <StaffTab
            active={staffTab === "all"}
            onClick={() => setStaffTab("all")}
            label="All staff"
          />
          {data!.staff.map((s) => (
            <StaffTab
              key={s.id}
              active={staffTab === s.id}
              onClick={() => setStaffTab(s.id)}
              label={s.name}
            />
          ))}
        </div>
      )}

      {pending && !data ? (
        <Skeleton className="h-96 w-full rounded-[0.75rem]" />
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>
            Could not load the calendar.{" "}
            <button onClick={load} className="underline underline-offset-4">
              Retry
            </button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Desktop week grid */}
          <div className="hidden overflow-x-auto md:block">
            <div className="min-w-[880px]">
              <div
                className="grid"
                style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}
              >
                <div />
                {days.map((d) => (
                  <div
                    key={d.date}
                    className={cn(
                      "border-b border-border px-2 py-2 text-center",
                      d.date === todayKey && "bg-primary/5"
                    )}
                  >
                    <p className="text-xs text-muted-foreground">
                      {weekdayShort(d.date, timezone)}
                    </p>
                    <p
                      className={cn(
                        "tnum text-sm font-semibold",
                        d.date === todayKey && "text-primary"
                      )}
                    >
                      {dayOfMonth(d.date)}
                    </p>
                  </div>
                ))}
              </div>
              <div
                className="grid"
                style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}
              >
                <TimeGutter
                  hours={hours}
                  gridStartHour={gridStartHour}
                  gridHeight={gridHeight}
                />
                {days.map((d) => (
                  <DayColumnView
                    key={d.date}
                    day={d}
                    timezone={timezone}
                    gridStartHour={gridStartHour}
                    gridEndHour={gridEndHour}
                    gridHeight={gridHeight}
                    hours={hours}
                    isToday={d.date === todayKey}
                    isOwner={isOwner}
                    onEmptyClick={() => openBlockDialog(d.date)}
                    onTimeOffClick={setDetailTimeOff}
                    onOverrideClick={setDetailOverride}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Mobile day view with swipe */}
          <div className="md:hidden" {...swipeHandlers}>
            <div className="mb-2 flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous day"
                onClick={() => setMobileDay((d) => addDaysYmd(d, -1))}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <p
                className={cn(
                  "text-sm font-semibold",
                  mobileDay === todayKey && "text-primary"
                )}
              >
                {mobileColumn
                  ? `${weekdayShort(mobileColumn.date, timezone)}, ${dayHeaderLabel(mobileColumn.date, timezone)}`
                  : ""}
              </p>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next day"
                onClick={() => setMobileDay((d) => addDaysYmd(d, 1))}
              >
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
            {mobileColumn && (
              <div className="grid" style={{ gridTemplateColumns: "56px 1fr" }}>
                <TimeGutter
                  hours={hours}
                  gridStartHour={gridStartHour}
                  gridHeight={gridHeight}
                />
                <DayColumnView
                  day={mobileColumn}
                  timezone={timezone}
                  gridStartHour={gridStartHour}
                  gridEndHour={gridEndHour}
                  gridHeight={gridHeight}
                  hours={hours}
                  isToday={mobileColumn.date === todayKey}
                  isOwner={isOwner}
                  onEmptyClick={() => openBlockDialog(mobileColumn.date)}
                  onTimeOffClick={setDetailTimeOff}
                  onOverrideClick={setDetailOverride}
                />
              </div>
            )}
          </div>
        </>
      )}

      {blockDialog && (
        <BlockTimeDialog
          businessId={businessId}
          staff={data?.staff ?? []}
          initial={blockDialog}
          onClose={() => setBlockDialog(null)}
          onSaved={() => {
            setBlockDialog(null);
            toast.success("Time blocked — the slot grid updates immediately");
            load();
          }}
        />
      )}

      <EventDetailDialog
        businessId={businessId}
        timezone={timezone}
        timeOff={detailTimeOff}
        override={detailOverride}
        staffName={(id) => data?.staff.find((s) => s.id === id)?.name ?? "Staff"}
        isOwner={isOwner}
        onClose={() => {
          setDetailTimeOff(null);
          setDetailOverride(null);
        }}
        onDeleted={() => {
          setDetailTimeOff(null);
          setDetailOverride(null);
          toast.success("Removed");
          load();
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* day column                                                          */
/* ------------------------------------------------------------------ */

function TimeGutter({
  hours,
  gridStartHour,
  gridHeight,
}: {
  hours: number[];
  gridStartHour: number;
  gridHeight: number;
}) {
  return (
    <div className="relative" style={{ height: gridHeight }}>
      {hours.map((h) => (
        <div
          key={h}
          className="tnum absolute w-full pr-2 text-right text-[11px] text-muted-foreground"
          style={{ top: (h - gridStartHour) * PX_PER_HOUR - 8 }}
        >
          {formatHourLabel(h)}
        </div>
      ))}
    </div>
  );
}

function DayColumnView({
  day,
  timezone,
  gridStartHour,
  gridEndHour,
  gridHeight,
  hours,
  isToday,
  isOwner,
  onEmptyClick,
  onTimeOffClick,
  onOverrideClick,
}: {
  day: DayColumn;
  timezone: string;
  gridStartHour: number;
  gridEndHour: number;
  gridHeight: number;
  hours: number[];
  isToday: boolean;
  isOwner: boolean;
  onEmptyClick: () => void;
  onTimeOffClick: (t: CalendarWeek["timeOff"][number]) => void;
  onOverrideClick: (o: CalendarWeek["overrides"][number]) => void;
}) {
  const blocked = day.blackout ?? day.override;
  const blockedLabel = day.blackout
    ? (day.blackout.reason ?? "Closed")
    : (day.override?.reason ?? "Blocked");

  return (
    <div
      className={cn(
        "relative border-l border-border",
        isToday && "bg-primary/[0.04]"
      )}
      style={{ height: gridHeight }}
      role="button"
      tabIndex={isOwner && !blocked ? 0 : -1}
      aria-label={blocked ? `${blockedLabel} on ${day.date}` : `Block time on ${day.date}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && isOwner && !blocked) onEmptyClick();
      }}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && isOwner && !blocked) {
          e.preventDefault();
          onEmptyClick();
        }
      }}
    >
      {/* Hour lines */}
      {hours.map((h) => (
        <div
          key={h}
          aria-hidden
          className="absolute w-full border-t border-border/60"
          style={{ top: (h - gridStartHour) * PX_PER_HOUR }}
        />
      ))}

      {/* Blackout / blocked-day overlay */}
      {blocked && (
        <button
          type="button"
          onClick={() =>
            day.blackout ? undefined : day.override && onOverrideClick(day.override)
          }
          className={cn(
            "absolute inset-0 flex items-start justify-center bg-muted/70 p-2 pt-3",
            !day.blackout && "cursor-pointer hover:bg-muted"
          )}
          aria-label={day.blackout ? blockedLabel : `Blocked: ${blockedLabel} — view details`}
        >
          <span className="rounded-full bg-muted-foreground/15 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {blockedLabel}
          </span>
        </button>
      )}

      {/* Event blocks */}
      {!blocked &&
        day.blocks.map((b) => (
          <EventBlock
            key={b.key}
            block={b}
            timezone={timezone}
            gridStartHour={gridStartHour}
            gridEndHour={gridEndHour}
            onTimeOffClick={onTimeOffClick}
          />
        ))}
    </div>
  );
}

function EventBlock({
  block,
  timezone,
  gridStartHour,
  gridEndHour,
  onTimeOffClick,
}: {
  block: PositionedBlock;
  timezone: string;
  gridStartHour: number;
  gridEndHour: number;
  onTimeOffClick: (t: CalendarWeek["timeOff"][number]) => void;
}) {
  const gridStartMin = gridStartHour * 60;
  const gridEndMin = gridEndHour * 60;
  const top = Math.max(0, ((block.startMin - gridStartMin) / 60) * PX_PER_HOUR);
  const bottom = Math.min(gridEndMin, block.endMin);
  const height = Math.max(
    26,
    ((bottom - gridStartMin) / 60) * PX_PER_HOUR - top
  );

  if (block.kind === "booking" && block.booking) {
    const b = block.booking;
    const hold = b.payment_pending;
    return (
      <Link
        href={`/dashboard/bookings?booking=${b.id}`}
        onClick={(e) => e.stopPropagation()}
        className="absolute left-1 right-1 overflow-hidden rounded-[0.5rem] border-l-4 p-1.5 text-left shadow-sm transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{
          top,
          height,
          borderLeftColor: hold ? "var(--warning)" : (b.service_color ?? "var(--primary)"),
          backgroundColor: hold
            ? "var(--slot-pending)"
            : "color-mix(in srgb, var(--card) 82%, transparent)",
        }}
        aria-label={`${b.service_name ?? "Booking"} for ${b.customer_name ?? "customer"} at ${formatTimeShort(b.starts_at, timezone)}`}
      >
        <p className="tnum truncate text-xs font-semibold">
          {formatTimeShort(b.starts_at, timezone)}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {b.customer_name ?? ""}
          {b.service_name ? ` · ${b.service_name}` : ""}
        </p>
      </Link>
    );
  }

  const t = block.timeOff!;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onTimeOffClick(t);
      }}
      className="absolute left-1 right-1 overflow-hidden rounded-[0.5rem] border border-dashed border-muted-foreground/40 p-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{
        top,
        height,
        backgroundImage:
          "repeating-linear-gradient(45deg, transparent, transparent 6px, color-mix(in srgb, var(--muted-foreground) 12%, transparent) 6px, color-mix(in srgb, var(--muted-foreground) 12%, transparent) 12px)",
      }}
      aria-label={`Time off: ${t.reason ?? "no reason given"}`}
    >
      <p className="truncate text-[11px] font-medium text-muted-foreground">
        Time off{t.reason ? ` — ${t.reason}` : ""}
      </p>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* block-time dialog                                                   */
/* ------------------------------------------------------------------ */

function BlockTimeDialog({
  businessId,
  staff,
  initial,
  onClose,
  onSaved,
}: {
  businessId: string;
  staff: Array<{ id: string; name: string }>;
  initial: { date: string; staffId: string | null };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [staffId, setStaffId] = useState<string>(initial.staffId ?? "all");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await createBlockTime({
        businessId,
        date: initial.date,
        staffId: staffId === "all" ? null : staffId,
        reason: reason.trim() || undefined,
      });
      if (!result.ok) {
        setError("Could not block that day.");
        return;
      }
      onSaved();
    });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Block time</DialogTitle>
          <DialogDescription>
            Closes{" "}
            <span className="tnum font-medium">{initial.date}</span> so no new
            bookings can land there. Existing bookings are unaffected.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label>Applies to</Label>
          <Select value={staffId} onValueChange={setStaffId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Whole business</SelectItem>
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} only
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="block-reason">Reason (optional)</Label>
          <Input
            id="block-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Staff training, private event"
          />
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={submit}>
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Block day
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* time-off / override detail                                         */
/* ------------------------------------------------------------------ */

function EventDetailDialog({
  businessId,
  timezone,
  timeOff,
  override,
  staffName,
  isOwner,
  onClose,
  onDeleted,
}: {
  businessId: string;
  timezone: string;
  timeOff: CalendarWeek["timeOff"][number] | null;
  override: CalendarWeek["overrides"][number] | null;
  staffName: (id: string) => string;
  isOwner: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, startTransition] = useTransition();
  const open = timeOff !== null || override !== null;

  const remove = () => {
    startTransition(async () => {
      const result = timeOff
        ? await deleteTimeOff(businessId, timeOff.id)
        : override
          ? await deleteBlockTime(businessId, override.id)
          : { ok: false as const };
      if (!result.ok) {
        toast.error("Could not remove it.");
        return;
      }
      onDeleted();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{timeOff ? "Time off" : "Blocked day"}</DialogTitle>
        </DialogHeader>
        {timeOff && (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Staff</dt>
              <dd className="font-medium">{staffName(timeOff.staff_id)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd className="font-medium capitalize">{timeOff.status}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">From</dt>
              <dd className="tnum">{formatTimeShort(timeOff.starts_at, timezone)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">To</dt>
              <dd className="tnum">{formatTimeShort(timeOff.ends_at, timezone)}</dd>
            </div>
            {timeOff.reason && (
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Reason</dt>
                <dd>{timeOff.reason}</dd>
              </div>
            )}
          </dl>
        )}
        {override && (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Date</dt>
              <dd className="tnum font-medium">{override.date}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Applies to</dt>
              <dd className="font-medium">
                {override.staff_id ? staffName(override.staff_id) : "Whole business"}
              </dd>
            </div>
            {override.reason && (
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Reason</dt>
                <dd>{override.reason}</dd>
              </div>
            )}
          </dl>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {isOwner && (
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={remove}
              className="gap-1.5"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-4" aria-hidden />
              )}
              Remove
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function StaffTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-primary/40"
      )}
    >
      {label}
    </button>
  );
}

function formatHourLabel(h: number): string {
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${ampm}`;
}

function tzParts(iso: string, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  return {
    dayKey: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
  };
}

function hourInTz(iso: string, tz: string): number {
  return tzParts(iso, tz).hour;
}

function minuteInTz(iso: string, tz: string): number {
  return tzParts(iso, tz).minute;
}

function todayKeyInWeek(weekStart: string, todayKey: string): string {
  for (let i = 0; i < 7; i++) {
    const d = addDaysYmd(weekStart, i);
    if (d === todayKey) return d;
  }
  return weekStart;
}

/**
 * Clip events to each business-local day: an event only appears on the
 * day(s) its business-local wall time touches.
 */
function buildDays(
  data: CalendarWeek,
  staffTab: string,
  timezone: string
): DayColumn[] {
  const days: DayColumn[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDaysYmd(data.weekStart, i);
    const blocks: PositionedBlock[] = [];

    for (const b of data.bookings) {
      if (staffTab !== "all" && b.staff_id !== staffTab) continue;
      const span = daySpan(b.starts_at, b.ends_at, timezone, date);
      if (!span) continue;
      blocks.push({
        key: `booking-${b.id}`,
        kind: "booking",
        startMin: span.startMin,
        endMin: span.endMin,
        booking: b,
      });
    }
    for (const t of data.timeOff) {
      if (staffTab !== "all" && t.staff_id !== staffTab) continue;
      const span = daySpan(t.starts_at, t.ends_at, timezone, date);
      if (!span) continue;
      blocks.push({
        key: `timeoff-${t.id}-${date}`,
        kind: "timeoff",
        startMin: span.startMin,
        endMin: span.endMin,
        timeOff: t,
      });
    }

    days.push({
      date,
      blackout: data.blackouts.find((x) => x.date === date) ?? null,
      override:
        data.overrides.find(
          (o) =>
            o.date === date &&
            (staffTab === "all" || o.staff_id === null || o.staff_id === staffTab)
        ) ?? null,
      blocks: blocks.sort((a, b) => a.startMin - b.startMin),
    });
  }
  return days;
}

/**
 * The portion of [startsAt, endsAt) falling on business-local `date`,
 * as minutes from local midnight. Null when the event misses the day.
 */
function daySpan(
  startsAt: string,
  endsAt: string,
  tz: string,
  date: string
): { startMin: number; endMin: number } | null {
  const s = tzParts(startsAt, tz);
  const e = tzParts(endsAt, tz);
  // Single-day fast path (the common case).
  if (s.dayKey === date && e.dayKey === date) {
    return {
      startMin: s.hour * 60 + s.minute,
      endMin: Math.max(s.hour * 60 + s.minute + 15, e.hour * 60 + e.minute),
    };
  }
  if (s.dayKey === date) {
    return { startMin: s.hour * 60 + s.minute, endMin: 24 * 60 };
  }
  if (e.dayKey === date) {
    return { startMin: 0, endMin: e.hour * 60 + e.minute };
  }
  // Multi-day span covering the whole day (ISO day keys compare chronologically).
  if (s.dayKey < date && e.dayKey > date) {
    return { startMin: 0, endMin: 24 * 60 };
  }
  return null;
}
