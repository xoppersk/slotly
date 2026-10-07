"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business";
import {
  generateDayRange,
  addDaysYmd,
  type SlotInput,
  type DayAvailability,
} from "@/lib/availability";
import { businessLocalRangeToUtc, toBusinessDayKey } from "@/lib/timezone";

/* ------------------------------------------------------------------ */
/* slot data contract                                                  */
/* ------------------------------------------------------------------ */

/**
 * Slot data contract (matches the API worker's GET /api/availability shape):
 * `{ business, days: [{ date, status, slots: [{ startsAt, endsAt, staffId }], reason? }] }`.
 *
 * Computed server-side with the shared availability engine (business +
 * staff rules, overrides, blackouts, approved time off, blocking bookings),
 * so the reschedule picker and calendar preview behave exactly like the
 * public slot grid.
 */
export interface SlotContract {
  business: { id: string; name: string; timezone: string };
  days: Array<{
    date: string;
    status: "open" | "closed" | "fully_booked";
    slots: Array<{ startsAt: string; endsAt: string; staffId: string }>;
    reason?: string;
  }>;
}

interface Guard {
  supabase: Awaited<ReturnType<typeof createClient>>;
  businessId: string;
  role: "owner" | "staff";
  staffId: string | null;
}

async function guardBusiness(businessId: string): Promise<Guard> {
  const ctx = await getCurrentBusiness();
  if (!ctx || ctx.business.id !== businessId) throw new Error("not_authorized");
  const supabase = await createClient();
  return {
    supabase,
    businessId,
    role: ctx.membership.role,
    staffId: ctx.membership.staffId,
  };
}

export async function getRescheduleSlots(
  businessId: string,
  serviceId: string,
  staffId: string | null,
  fromYmd: string,
  toYmd: string
): Promise<SlotContract | { error: string }> {
  let guard: Guard;
  try {
    guard = await guardBusiness(businessId);
  } catch {
    return { error: "not_authorized" };
  }
  const { supabase } = guard;
  const effectiveStaffId =
    guard.role === "staff" && guard.staffId ? guard.staffId : staffId;

  const [business, service] = await Promise.all([
    supabase.from("businesses").select("*").eq("id", businessId).single(),
    supabase
      .from("services")
      .select("id, duration_minutes, buffer_before_minutes, buffer_after_minutes, is_active")
      .eq("id", serviceId)
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);
  if (business.error || !service.data?.is_active) {
    return { error: "not_available" };
  }
  const b = business.data;
  const s = service.data;

  const days = Math.min(
    Math.max(1, dateDiffDays(fromYmd, toYmd) + 1),
    31
  );

  const [rules, overrides, blackouts, timeOff, bookings, serviceStaff, staffRows] =
    await Promise.all([
      supabase
        .from("availability_rules")
        .select("staff_id, weekday, open_time, close_time, is_closed")
        .eq("business_id", businessId),
      supabase
        .from("availability_overrides")
        .select("staff_id, date, open_time, close_time, is_closed, reason")
        .eq("business_id", businessId)
        .gte("date", fromYmd)
        .lte("date", toYmd),
      supabase
        .from("blackout_dates")
        .select("date, reason")
        .eq("business_id", businessId)
        .gte("date", fromYmd)
        .lte("date", toYmd),
      supabase
        .from("staff_time_off")
        .select("staff_id, starts_at, ends_at, status")
        .eq("business_id", businessId)
        .eq("status", "approved"),
      supabase
        .from("bookings")
        .select("staff_id, starts_at, ends_at")
        .eq("business_id", businessId)
        .in("status", ["pending", "payment_pending", "confirmed"])
        .gte("starts_at", `${fromYmd}T00:00:00Z`)
        .lte("starts_at", `${toYmd}T23:59:59Z`),
      supabase
        .from("service_staff")
        .select("staff_id")
        .eq("service_id", serviceId),
      supabase
        .from("staff")
        .select("id")
        .eq("business_id", businessId)
        .eq("is_active", true),
    ]);

  const activeStaffIds = new Set((staffRows.data ?? []).map((r) => r.id));
  const eligible = (serviceStaff.data ?? [])
    .map((r) => r.staff_id)
    .filter((id) => activeStaffIds.has(id));
  const targetStaff = effectiveStaffId
    ? eligible.filter((id) => id === effectiveStaffId)
    : eligible;
  if (targetStaff.length === 0) return { error: "no_staff_available" };

  const weeklyRules = (rules.data ?? [])
    .filter((r) => r.staff_id === null)
    .map((r) => ({
      weekday: r.weekday,
      openTime: r.open_time.slice(0, 5),
      closeTime: r.close_time.slice(0, 5),
      isClosed: r.is_closed,
    }));
  const staffRulesByStaff = new Map<string, typeof weeklyRules>();
  for (const r of rules.data ?? []) {
    if (!r.staff_id) continue;
    const list = staffRulesByStaff.get(r.staff_id) ?? [];
    list.push({
      weekday: r.weekday,
      openTime: r.open_time.slice(0, 5),
      closeTime: r.close_time.slice(0, 5),
      isClosed: r.is_closed,
    });
    staffRulesByStaff.set(r.staff_id, list);
  }
  const overridesAll = (overrides.data ?? []).map((o) => ({
    date: o.date,
    openTime: o.open_time ? o.open_time.slice(0, 5) : null,
    closeTime: o.close_time ? o.close_time.slice(0, 5) : null,
    isClosed: o.is_closed,
    reason: o.reason ?? undefined,
    staffId: o.staff_id,
  }));
  const blackoutsAll = (blackouts.data ?? []).map((x) => ({
    date: x.date,
    reason: x.reason ?? undefined,
  }));

  const baseInput: Omit<SlotInput, "staffRules"> = {
    businessTimezone: b.timezone,
    serviceDurationMinutes: s.duration_minutes,
    bufferBeforeMinutes: s.buffer_before_minutes,
    bufferAfterMinutes: s.buffer_after_minutes,
    slotStepMinutes: b.slot_step_minutes,
    weeklyRules,
    overrides: overridesAll.filter((o) => o.staffId === null),
    blackouts: blackoutsAll,
    timeOff: [],
    bookings: [],
    minLeadTimeMinutes: b.min_lead_time_minutes,
    maxAdvanceDays: b.max_advance_days,
    nowIso: new Date().toISOString(),
  };

  // Per-staff generation, then merge — each slot keeps its staffId.
  const perStaff: DayAvailability[][] = [];
  for (const sid of targetStaff) {
    const staffOverrides = overridesAll
    .filter((o) => o.staffId === sid)
    .map((o) => ({
      date: o.date,
      openTime: o.openTime,
      closeTime: o.closeTime,
      isClosed: o.isClosed,
      reason: o.reason,
    }));
    const input: SlotInput = {
      ...baseInput,
      overrides: [...baseInput.overrides, ...staffOverrides],
      staffRules: staffRulesByStaff.get(sid),
      timeOff: (timeOff.data ?? [])
        .filter((t) => t.staff_id === sid)
        .map((t) => ({ startsAt: t.starts_at, endsAt: t.ends_at, status: t.status as "approved" })),
      bookings: (bookings.data ?? [])
        .filter((bk) => bk.staff_id === sid)
        .map((bk) => ({ startsAt: bk.starts_at, endsAt: bk.ends_at })),
    };
    perStaff.push(generateDayRange(input, fromYmd, days, sid));
  }

  const merged: SlotContract["days"] = [];
  for (let i = 0; i < days; i++) {
    const date = addDaysYmd(fromYmd, i);
    const slots = perStaff
      .flatMap((d) => d[i]?.slots ?? [])
      .sort((a, c) => a.startsAt.localeCompare(c.startsAt));
    const statuses = perStaff.map((d) => d[i]?.status);
    const status = slots.length > 0
      ? "open"
      : statuses.includes("open") || statuses.includes("fully_booked")
        ? "fully_booked"
        : "closed";
    const reason =
      slots.length === 0
        ? perStaff.map((d) => d[i]?.reason).find(Boolean)
        : undefined;
    merged.push({ date, status, slots, reason });
  }

  return {
    business: { id: b.id, name: b.name, timezone: b.timezone },
    days: merged,
  };
}

function dateDiffDays(fromYmd: string, toYmd: string): number {
  const from = Date.parse(`${fromYmd}T00:00:00Z`);
  const to = Date.parse(`${toYmd}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

/* ------------------------------------------------------------------ */
/* calendar week                                                       */
/* ------------------------------------------------------------------ */

export interface CalendarWeek {
  weekStart: string;
  timezone: string;
  staff: Array<{ id: string; name: string }>;
  bookings: Array<{
    id: string;
    staff_id: string;
    starts_at: string;
    ends_at: string;
    status: string;
    customer_name: string | null;
    service_name: string | null;
    service_color: string | null;
    payment_pending: boolean;
  }>;
  timeOff: Array<{
    id: string;
    staff_id: string;
    starts_at: string;
    ends_at: string;
    reason: string | null;
    status: string;
  }>;
  blackouts: Array<{ date: string; reason: string | null }>;
  overrides: Array<{
    id: string;
    staff_id: string | null;
    date: string;
    open_time: string | null;
    close_time: string | null;
    is_closed: boolean;
    reason: string | null;
  }>;
}

export async function getCalendarWeek(
  businessId: string,
  weekStartYmd: string
): Promise<CalendarWeek | { error: string }> {
  let guard: Guard;
  try {
    guard = await guardBusiness(businessId);
  } catch {
    return { error: "not_authorized" };
  }
  const { supabase } = guard;
  const { data: business } = await supabase
    .from("businesses")
    .select("timezone")
    .eq("id", businessId)
    .single();
  if (!business) return { error: "not_found" };
  const tz = business.timezone;

  const weekEndYmd = addDaysYmd(weekStartYmd, 6);
  const { startsAtUtc: rangeStart } = businessLocalRangeToUtc(
    weekStartYmd,
    "00:00",
    "23:59",
    tz
  );
  const { endsAtUtc: rangeEnd } = businessLocalRangeToUtc(
    weekEndYmd,
    "00:00",
    "23:59",
    tz
  );

  let staffQuery = supabase
    .from("staff")
    .select("id, name")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("name");
  if (guard.role === "staff" && guard.staffId) {
    staffQuery = staffQuery.eq("id", guard.staffId);
  }

  let bookingQuery = supabase
    .from("bookings")
    .select(
      "id, staff_id, starts_at, ends_at, status, services(name, color), customers(name)"
    )
    .eq("business_id", businessId)
    .gte("starts_at", rangeStart.toISOString())
    .lt("starts_at", rangeEnd.toISOString())
    .neq("status", "cancelled")
    .order("starts_at", { ascending: true });
  if (guard.role === "staff" && guard.staffId) {
    bookingQuery = bookingQuery.eq("staff_id", guard.staffId);
  }

  let timeOffQuery = supabase
    .from("staff_time_off")
    .select("id, staff_id, starts_at, ends_at, reason, status")
    .eq("business_id", businessId)
    .lt("starts_at", rangeEnd.toISOString())
    .gt("ends_at", rangeStart.toISOString());
  if (guard.role === "staff" && guard.staffId) {
    timeOffQuery = timeOffQuery.eq("staff_id", guard.staffId);
  }

  const [staffRows, bookingRows, timeOffRows, blackoutRows, overrideRows] =
    await Promise.all([
      staffQuery,
      bookingQuery,
      timeOffQuery,
      supabase
        .from("blackout_dates")
        .select("date, reason")
        .eq("business_id", businessId)
        .gte("date", weekStartYmd)
        .lte("date", weekEndYmd),
      supabase
        .from("availability_overrides")
        .select(
          "id, staff_id, date, open_time, close_time, is_closed, reason"
        )
        .eq("business_id", businessId)
        .gte("date", weekStartYmd)
        .lte("date", weekEndYmd),
    ]);

  const first = (v: unknown) => (Array.isArray(v) ? v[0] : v) as {
    name?: string | null;
    color?: string | null;
  } | null;

  return {
    weekStart: weekStartYmd,
    timezone: tz,
    staff: staffRows.data ?? [],
    bookings: (bookingRows.data ?? []).map((b) => ({
      id: b.id,
      staff_id: b.staff_id,
      starts_at: b.starts_at,
      ends_at: b.ends_at,
      status: b.status,
      customer_name: first(b.customers)?.name ?? null,
      service_name: first(b.services)?.name ?? null,
      service_color: first(b.services)?.color ?? null,
      payment_pending: b.status === "payment_pending",
    })),
    timeOff: timeOffRows.data ?? [],
    blackouts: blackoutRows.data ?? [],
    overrides: overrideRows.data ?? [],
  };
}

/* ------------------------------------------------------------------ */
/* block time (click empty space on the calendar)                      */
/* ------------------------------------------------------------------ */

export interface BlockTimeInput {
  businessId: string;
  date: string; // YYYY-MM-DD (business-local)
  staffId: string | null; // null = whole business
  reason?: string;
}

export async function createBlockTime(
  input: BlockTimeInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  let guard: Guard;
  try {
    guard = await guardBusiness(input.businessId);
  } catch {
    return { ok: false, error: "not_authorized" };
  }
  if (guard.role !== "owner") return { ok: false, error: "not_authorized" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false, error: "invalid_date" };
  }

  // availability_overrides are day-level: a block closes the day for the
  // chosen staff member (or the whole business). The slot engine treats the
  // day as closed instantly — "Block time" never needs drag editing.
  // Partial unique indexes (staff_id null vs not-null) mean plain upsert
  // can't target the conflict, so check-then-write instead.
  let existingQuery = guard.supabase
    .from("availability_overrides")
    .select("id")
    .eq("business_id", input.businessId)
    .eq("date", input.date);
  existingQuery = input.staffId
    ? existingQuery.eq("staff_id", input.staffId)
    : existingQuery.is("staff_id", null);
  const { data: existing } = await existingQuery.maybeSingle();

  const row = {
    business_id: input.businessId,
    staff_id: input.staffId,
    date: input.date,
    open_time: null,
    close_time: null,
    is_closed: true,
    reason: input.reason?.trim() || "Blocked time",
  };

  const { error } = existing
    ? await guard.supabase
        .from("availability_overrides")
        .update(row)
        .eq("id", existing.id)
    : await guard.supabase.from("availability_overrides").insert(row);
  if (error) return { ok: false, error: "create_failed" };
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* calendar edits (owner)                                              */
/* ------------------------------------------------------------------ */

/** Delete a block-time override. */
export async function deleteBlockTime(
  businessId: string,
  overrideId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  let guard: Guard;
  try {
    guard = await guardBusiness(businessId);
  } catch {
    return { ok: false, error: "not_authorized" };
  }
  if (guard.role !== "owner") return { ok: false, error: "not_authorized" };
  const { error } = await guard.supabase
    .from("availability_overrides")
    .delete()
    .eq("id", overrideId)
    .eq("business_id", businessId);
  if (error) return { ok: false, error: "delete_failed" };
  return { ok: true };
}

/** Delete a staff time-off range (owner). */
export async function deleteTimeOff(
  businessId: string,
  timeOffId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  let guard: Guard;
  try {
    guard = await guardBusiness(businessId);
  } catch {
    return { ok: false, error: "not_authorized" };
  }
  if (guard.role !== "owner") return { ok: false, error: "not_authorized" };
  const { error } = await guard.supabase
    .from("staff_time_off")
    .delete()
    .eq("id", timeOffId)
    .eq("business_id", businessId);
  if (error) return { ok: false, error: "delete_failed" };
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* booking catalog (new-booking wizard)                                */
/* ------------------------------------------------------------------ */

export interface BookingCatalog {
  services: Array<{
    id: string;
    name: string;
    duration_minutes: number;
    price_cents: number;
    color: string;
  }>;
  staff: Array<{ id: string; name: string }>;
  serviceStaff: Record<string, string[]>;
}

export async function getBookingCatalog(
  businessId: string
): Promise<BookingCatalog | { error: string }> {
  let guard: Guard;
  try {
    guard = await guardBusiness(businessId);
  } catch {
    return { error: "not_authorized" };
  }
  const { supabase } = guard;
  const [services, staff, mapping] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, duration_minutes, price_cents, color")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("staff")
      .select("id, name")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("name"),
    supabase.from("service_staff").select("service_id, staff_id"),
  ]);

  const serviceStaff: Record<string, string[]> = {};
  for (const row of mapping.data ?? []) {
    const list = serviceStaff[row.service_id] ?? [];
    list.push(row.staff_id);
    serviceStaff[row.service_id] = list;
  }

  const visibleStaff =
    guard.role === "staff" && guard.staffId
      ? (staff.data ?? []).filter((s) => s.id === guard.staffId)
      : (staff.data ?? []);

  return {
    services: services.data ?? [],
    staff: visibleStaff,
    serviceStaff,
  };
}

/** Today (business-local) as YYYY-MM-DD — used for default date pickers. */
export async function getTodayKey(businessId: string): Promise<string> {
  const guard = await guardBusiness(businessId);
  const { data } = await guard.supabase
    .from("businesses")
    .select("timezone")
    .eq("id", businessId)
    .single();
  return toBusinessDayKey(new Date().toISOString(), data?.timezone ?? "UTC");
}
