"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business";
import { businessLocalRangeToUtc } from "@/lib/timezone";

export interface RequestTimeOffInput {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  allDay: boolean;
  startTime?: string; // HH:MM (partial-day)
  endTime?: string; // HH:MM (partial-day)
  reason?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/**
 * Staff self-service: request time off. Inserts a pending
 * staff_time_off row — the owner approves/declines it from the Staff
 * page. PostgreSQL RLS (staff_time_off_own_insert) enforces that staff
 * can only request their own time off and that requests start pending.
 */
export async function requestTimeOff(
  input: RequestTimeOffInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getCurrentBusiness();
  if (!ctx) return { ok: false, error: "not_signed_in" };
  if (ctx.membership.role !== "staff" || !ctx.membership.staffId) {
    return { ok: false, error: "not_authorized" };
  }

  const { startDate, endDate, allDay } = input;
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate) || startDate > endDate) {
    return { ok: false, error: "invalid_dates" };
  }

  const tz = ctx.business.timezone;
  let startsAt: Date;
  let endsAt: Date;
  try {
    if (allDay) {
      // Whole days: 00:00 on startDate through 23:59 on endDate, business-local.
      ({ startsAtUtc: startsAt, endsAtUtc: endsAt } = businessLocalRangeToUtc(
        startDate,
        "00:00",
        "23:59",
        tz
      ));
      // Extend the end to cover endDate (the helper spans a single day).
      const endDay = businessLocalRangeToUtc(endDate, "00:00", "23:59", tz);
      endsAt = endDay.endsAtUtc;
    } else {
      if (startDate !== endDate) {
        return { ok: false, error: "partial_day_single_day_only" };
      }
      const startTime = input.startTime ?? "";
      const endTime = input.endTime ?? "";
      if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
        return { ok: false, error: "invalid_times" };
      }
      ({ startsAtUtc: startsAt, endsAtUtc: endsAt } = businessLocalRangeToUtc(
        startDate,
        startTime,
        endTime,
        tz
      ));
    }
  } catch {
    return { ok: false, error: "invalid_range" };
  }

  if (startsAt.getTime() >= endsAt.getTime()) {
    return { ok: false, error: "invalid_range" };
  }

  const reason = input.reason?.trim() ?? "";
  if (reason.length > 500) return { ok: false, error: "reason_too_long" };

  const supabase = await createClient();
  const { error } = await supabase.from("staff_time_off").insert({
    business_id: ctx.business.id,
    staff_id: ctx.membership.staffId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    reason: reason || null,
    status: "pending",
  });
  if (error) return { ok: false, error: "request_failed" };

  revalidatePath("/dashboard/staff/time-off");
  return { ok: true };
}
