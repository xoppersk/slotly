import { redirect } from "next/navigation";

import { requireOwner } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { defaultWeeklyGrid, type WeeklyDayInput } from "@/lib/management";

import {
  AvailabilityClient,
  type BlackoutRow,
  type OverrideRow,
  type StaffHoursEntry,
} from "./availability-client";
import type { BookingRulesInput } from "./actions";
import type { BookingStatus } from "@/lib/supabase/types";

const UPCOMING_STATUSES: BookingStatus[] = ["confirmed", "pending", "payment_pending"];

function rulesToGrid(
  rows: { weekday: number; open_time: string; close_time: string }[],
): WeeklyDayInput[] {
  return defaultWeeklyGrid().map((d) => {
    const rule = rows.find((r) => r.weekday === d.weekday);
    if (!rule) return { ...d, isClosed: true };
    return {
      weekday: d.weekday,
      isClosed: false,
      openTime: rule.open_time.slice(0, 5),
      closeTime: rule.close_time.slice(0, 5),
    };
  });
}

export default async function AvailabilityPage() {
  const gate = await requireOwner();
  if (!gate.ok) {
    if (gate.reason === "signed-out") redirect("/auth/sign-in");
    if (gate.reason === "no-business") redirect("/onboarding");
    redirect("/dashboard");
  }

  const { business } = gate.ctx;
  const supabase = await createClient();

  const [
    { data: ruleRows },
    { data: staffRows },
    { data: overrideRows },
    { data: blackoutRows },
    { data: serviceRows },
    { count: upcomingCount },
  ] = await Promise.all([
    supabase
      .from("availability_rules")
      .select("staff_id, weekday, open_time, close_time")
      .eq("business_id", business.id),
    supabase
      .from("staff")
      .select("id, name")
      .eq("business_id", business.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("availability_overrides")
      .select("id, date, is_closed, open_time, close_time, reason, staff_id")
      .eq("business_id", business.id)
      .order("date", { ascending: true }),
    supabase
      .from("blackout_dates")
      .select("id, date, reason")
      .eq("business_id", business.id)
      .order("date", { ascending: true }),
    supabase
      .from("services")
      .select("id")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(1),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .gt("starts_at", new Date().toISOString())
      .in("status", UPCOMING_STATUSES),
  ]);

  const staffById = new Map((staffRows ?? []).map((s) => [s.id, s.name]));

  const businessGrid = rulesToGrid(
    (ruleRows ?? []).filter((r) => r.staff_id === null),
  );

  const staffHours: Record<string, StaffHoursEntry> = {};
  for (const s of staffRows ?? []) {
    const rows = (ruleRows ?? []).filter((r) => r.staff_id === s.id);
    staffHours[s.id] = {
      inherit: rows.length === 0,
      grid: rulesToGrid(rows),
    };
  }

  const overrides: OverrideRow[] = (overrideRows ?? []).map((o) => ({
    id: o.id,
    date: o.date,
    is_closed: o.is_closed,
    open_time: o.open_time,
    close_time: o.close_time,
    reason: o.reason,
    staff_id: o.staff_id,
    staff_name: o.staff_id ? (staffById.get(o.staff_id) ?? "Unknown staff") : null,
  }));

  const blackouts: BlackoutRow[] = (blackoutRows ?? []).map((b) => ({
    id: b.id,
    date: b.date,
    reason: b.reason,
  }));

  const rules: BookingRulesInput = {
    minLeadTimeMinutes: business.min_lead_time_minutes,
    maxAdvanceDays: business.max_advance_days,
    slotStepMinutes: business.slot_step_minutes,
    bufferBeforeDefaultMinutes: business.buffer_before_default_minutes,
    bufferAfterDefaultMinutes: business.buffer_after_default_minutes,
    freeCancelHours: business.free_cancel_hours,
  };

  return (
    <AvailabilityClient
      businessId={business.id}
      businessTimezone={business.timezone}
      businessGrid={businessGrid}
      staffList={(staffRows ?? []).map((s) => ({ id: s.id, name: s.name }))}
      staffHours={staffHours}
      overrides={overrides}
      blackouts={blackouts}
      rules={rules}
      upcomingBookings={upcomingCount ?? 0}
      previewServiceId={serviceRows?.[0]?.id ?? null}
    />
  );
}
