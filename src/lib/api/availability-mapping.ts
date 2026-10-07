/**
 * Availability mapping for GET /api/availability (Wave 3C).
 *
 * Pure functions: the `get_availability` SECURITY DEFINER function returns
 * one jsonb blob `{business, service, staff[], rules[], overrides[],
 * blackouts[], time_off[], bookings[]}`; this module turns it into
 * per-staff `SlotInput`s for the TS availability engine and merges the
 * per-staff day grids back into one public response.
 *
 * Bookings that do not block the slot grid (`payment_failed`, `cancelled`,
 * `completed`, `no_show`) are dropped here — only the statuses covered by
 * the Postgres EXCLUDE constraint reach the engine.
 */

import type {
  Blackout,
  DateOverride,
  DayAvailability,
  Slot,
  SlotInput,
  WeeklyRule,
} from "../availability/types";

/** Statuses whose ranges are excluded from double-booking by Postgres. */
export const BLOCKING_STATUSES = new Set([
  "pending",
  "payment_pending",
  "confirmed",
]);

interface RawRule {
  staff_id: string | null;
  weekday: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

interface RawOverride {
  staff_id: string | null;
  date: string;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
  reason?: string | null;
}

interface RawTimeOff {
  staff_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
}

interface RawBooking {
  staff_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
}

interface RawStaff {
  id: string;
  name: string;
}

export interface MappedBusiness {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  slotStepMinutes: number;
  minLeadTimeMinutes: number;
  maxAdvanceDays: number;
}

export interface PerStaffInput {
  staffId: string;
  staffName: string;
  input: SlotInput;
}

export interface MappedAvailability {
  business: MappedBusiness;
  perStaff: PerStaffInput[];
}

export class AvailabilityMappingError extends Error {}

/** Postgres `time` renders "HH:MM:SS"; the engine wants "HH:mm". */
function normalizeTime(value: unknown, what: string): string {
  if (typeof value !== "string" || !/^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    throw new AvailabilityMappingError(`Invalid ${what}: ${String(value)}`);
  }
  return value.slice(0, 5);
}

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AvailabilityMappingError(`Invalid ${what}: expected an object`);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new AvailabilityMappingError(`Invalid ${what}: expected an array`);
  }
  return value;
}

function reqString(row: Record<string, unknown>, key: string, what: string): string {
  const v = row[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new AvailabilityMappingError(`Invalid ${what}: missing ${key}`);
  }
  return v;
}

function optNumber(row: Record<string, unknown>, key: string, fallback: number): number {
  const v = row[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/**
 * Turn the raw `get_availability` jsonb into engine-ready per-staff inputs.
 * `nowIso` is the route's clock (injectable for tests).
 */
export function mapAvailabilityPayload(
  payload: unknown,
  nowIso: string,
): MappedAvailability {
  const root = asRecord(payload, "availability payload");

  const businessRow = asRecord(root.business, "business");
  const business: MappedBusiness = {
    id: reqString(businessRow, "id", "business"),
    name: reqString(businessRow, "name", "business"),
    slug: reqString(businessRow, "slug", "business"),
    timezone: reqString(businessRow, "timezone", "business"),
    slotStepMinutes: optNumber(businessRow, "slot_step_minutes", 15),
    minLeadTimeMinutes: optNumber(businessRow, "min_lead_time_minutes", 120),
    maxAdvanceDays: optNumber(businessRow, "max_advance_days", 60),
  };

  const serviceRow = asRecord(root.service, "service");
  const duration = optNumber(serviceRow, "duration_minutes", 30);
  const bufferBefore = optNumber(serviceRow, "buffer_before_minutes", 0);
  const bufferAfter = optNumber(serviceRow, "buffer_after_minutes", 0);

  const staffRows = asArray(root.staff ?? [], "staff").map((s) => {
    const r = asRecord(s, "staff row");
    return { id: reqString(r, "id", "staff"), name: reqString(r, "name", "staff") } as RawStaff;
  });

  const rules = asArray(root.rules ?? [], "rules").map((r) => {
    const row = asRecord(r, "rule");
    const rule: RawRule = {
      staff_id: (row.staff_id as string | null) ?? null,
      weekday: Number(row.weekday),
      open_time: normalizeTime(row.open_time, "rule.open_time"),
      close_time: normalizeTime(row.close_time, "rule.close_time"),
      is_closed: row.is_closed === true,
    };
    return rule;
  });

  const overrides = asArray(root.overrides ?? [], "overrides").map((o) => {
    const row = asRecord(o, "override");
    const ov: RawOverride = {
      staff_id: (row.staff_id as string | null) ?? null,
      date: reqString(row, "date", "override"),
      open_time:
        row.open_time === null || row.open_time === undefined
          ? null
          : normalizeTime(row.open_time, "override.open_time"),
      close_time:
        row.close_time === null || row.close_time === undefined
          ? null
          : normalizeTime(row.close_time, "override.close_time"),
      is_closed: row.is_closed === true,
      reason: typeof row.reason === "string" ? row.reason : null,
    };
    return ov;
  });

  const blackouts: Blackout[] = asArray(root.blackouts ?? [], "blackouts").map((b) => {
    const row = asRecord(b, "blackout");
    return {
      date: reqString(row, "date", "blackout"),
      reason: typeof row.reason === "string" ? row.reason : undefined,
    };
  });

  const timeOff = asArray(root.time_off ?? [], "time_off").map((t) => {
    const row = asRecord(t, "time_off");
    const range: RawTimeOff = {
      staff_id: reqString(row, "staff_id", "time_off"),
      starts_at: reqString(row, "starts_at", "time_off"),
      ends_at: reqString(row, "ends_at", "time_off"),
      status: String(row.status ?? ""),
    };
    return range;
  });

  const bookings = asArray(root.bookings ?? [], "bookings").map((b) => {
    const row = asRecord(b, "booking");
    const booking: RawBooking = {
      staff_id: reqString(row, "staff_id", "booking"),
      starts_at: reqString(row, "starts_at", "booking"),
      ends_at: reqString(row, "ends_at", "booking"),
      status: String(row.status ?? ""),
    };
    return booking;
  });

  const businessRules: WeeklyRule[] = rules
    .filter((r) => r.staff_id === null)
    .map((r) => ({
      weekday: r.weekday,
      openTime: r.open_time,
      closeTime: r.close_time,
      isClosed: r.is_closed,
    }));

  const businessOverrides: DateOverride[] = overrides
    .filter((o) => o.staff_id === null)
    .map(toDateOverride);

  const perStaff: PerStaffInput[] = staffRows.map((staff) => {
    const staffRules: WeeklyRule[] = rules
      .filter((r) => r.staff_id === staff.id)
      .map((r) => ({
        weekday: r.weekday,
        openTime: r.open_time,
        closeTime: r.close_time,
        isClosed: r.is_closed,
      }));

    // Staff-specific overrides win over business-wide ones for the same date.
    const overrideByDate = new Map<string, DateOverride>();
    for (const o of businessOverrides) overrideByDate.set(o.date, o);
    for (const o of overrides.filter((x) => x.staff_id === staff.id)) {
      overrideByDate.set(o.date, toDateOverride(o));
    }

    const input: SlotInput = {
      businessTimezone: business.timezone,
      serviceDurationMinutes: duration,
      bufferBeforeMinutes: bufferBefore,
      bufferAfterMinutes: bufferAfter,
      slotStepMinutes: business.slotStepMinutes,
      weeklyRules: businessRules,
      staffRules: staffRules.length > 0 ? staffRules : undefined,
      overrides: [...overrideByDate.values()],
      blackouts,
      timeOff: timeOff
        .filter((t) => t.staff_id === staff.id)
        .map((t) => ({ startsAt: t.starts_at, endsAt: t.ends_at, status: t.status as "pending" | "approved" | "declined" })),
      bookings: bookings
        .filter((b) => b.staff_id === staff.id && BLOCKING_STATUSES.has(b.status))
        .map((b) => ({ startsAt: b.starts_at, endsAt: b.ends_at })),
      minLeadTimeMinutes: business.minLeadTimeMinutes,
      maxAdvanceDays: business.maxAdvanceDays,
      nowIso,
    };
    return { staffId: staff.id, staffName: staff.name, input };
  });

  return { business, perStaff };
}

function toDateOverride(o: RawOverride): DateOverride {
  return {
    date: o.date,
    openTime: o.open_time,
    closeTime: o.close_time,
    isClosed: o.is_closed,
    reason: o.reason ?? undefined,
  };
}

export interface MergedDay {
  date: string;
  status: "open" | "closed" | "fully_booked";
  slots: Slot[];
  reason?: string;
}

/**
 * Merge per-staff day grids into one public day list. A slot is listed with
 * its `staffId`; a day is `open` when any staff has slots, `fully_booked`
 * when at least one staff has an open window but no surviving slots, and
 * `closed` otherwise.
 */
export function mergeDayGrids(
  grids: Array<{ staffId: string; days: DayAvailability[] }>,
): MergedDay[] {
  const first = grids[0];
  if (!first) return [];
  const dayCount = first.days.length;
  const merged: MergedDay[] = [];
  for (let i = 0; i < dayCount; i++) {
    const daySlices: DayAvailability[] = [];
    for (const g of grids) {
      const slice = g.days[i];
      if (slice) daySlices.push(slice);
    }
    const date = daySlices[0]?.date ?? "";
    const slots = daySlices
      .flatMap((d) => d.slots)
      .sort((a, b) =>
        a.startsAt < b.startsAt
          ? -1
          : a.startsAt > b.startsAt
            ? 1
            : a.staffId < b.staffId
              ? -1
              : 1,
      );
    let status: MergedDay["status"] = "closed";
    let reason: string | undefined;
    if (daySlices.some((d) => d.status === "open")) {
      status = "open";
    } else {
      const fullyBooked = daySlices.find((d) => d.status === "fully_booked");
      if (fullyBooked) {
        status = "fully_booked";
        reason = fullyBooked.reason;
      } else {
        reason = daySlices.find((d) => d.reason)?.reason;
      }
    }
    merged.push({ date, status, slots, ...(reason ? { reason } : {}) });
  }
  return merged;
}
