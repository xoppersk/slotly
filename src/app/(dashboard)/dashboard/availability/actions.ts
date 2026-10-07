"use server";

/**
 * Server Actions for /dashboard/availability. Owner-only (requireOwner + RLS).
 *
 * Weekly hours are stored as availability_rules rows (staff_id NULL = business
 * default). A closed day has NO row — the slot engine treats a missing rule
 * as closed (see resolveWindow in src/lib/availability/generate.ts).
 */

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import {
  buildWeeklyRuleRows,
  isValidDayRange,
  toTimeString,
  type WeeklyDayInput,
} from "@/lib/management";

export type ActionResult = { ok: true } | { ok: false; error: string };

const SLOT_STEPS = [5, 10, 15, 20, 30, 60];

function validateGrid(grid: WeeklyDayInput[]): string | null {
  if (grid.length !== 7) return "Weekly hours need all 7 days.";
  for (const day of grid) {
    if (day.isClosed) continue;
    if (!isValidDayRange(day.openTime, day.closeTime))
      return "Close time must be after open time on every open day.";
  }
  return null;
}

async function replaceRules(
  businessId: string,
  staffId: string | null,
  grid: WeeklyDayInput[],
): Promise<string | null> {
  const supabase = await createClient();
  let query = supabase
    .from("availability_rules")
    .delete()
    .eq("business_id", businessId);
  query = staffId ? query.eq("staff_id", staffId) : query.is("staff_id", null);
  const { error: delError } = await query;
  if (delError) return "Could not update weekly hours.";

  const rows = buildWeeklyRuleRows(businessId, staffId, grid);
  if (rows.length > 0) {
    const { error } = await supabase.from("availability_rules").insert(rows);
    if (error) return "Could not save weekly hours.";
  }
  return null;
}

export async function saveBusinessHours(
  grid: WeeklyDayInput[],
): Promise<ActionResult> {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false, error: "Only the business owner can edit availability." };
  const invalid = validateGrid(grid);
  if (invalid) return { ok: false, error: invalid };

  const failed = await replaceRules(gate.ctx.business.id, null, grid);
  if (failed) return { ok: false, error: failed };

  revalidatePath("/dashboard/availability");
  return { ok: true };
}

export async function saveStaffAvailability(input: {
  staffId: string;
  inherit: boolean;
  grid: WeeklyDayInput[];
}): Promise<ActionResult> {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false, error: "Only the business owner can edit availability." };
  if (!input.inherit) {
    const invalid = validateGrid(input.grid);
    if (invalid) return { ok: false, error: invalid };
  }

  const { business } = gate.ctx;
  const supabase = await createClient();
  const { data: staffRow } = await supabase
    .from("staff")
    .select("id")
    .eq("id", input.staffId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!staffRow) return { ok: false, error: "Staff member not found." };

  if (input.inherit) {
    // Back to business hours: drop every staff-specific row.
    const { error } = await supabase
      .from("availability_rules")
      .delete()
      .eq("business_id", business.id)
      .eq("staff_id", input.staffId);
    if (error) return { ok: false, error: "Could not update working hours." };
  } else {
    const failed = await replaceRules(business.id, input.staffId, input.grid);
    if (failed) return { ok: false, error: failed };
  }

  revalidatePath("/dashboard/availability");
  return { ok: true };
}

export interface OverrideInput {
  date: string; // YYYY-MM-DD
  isClosed: boolean;
  openTime: string; // HH:MM
  closeTime: string; // HH:MM
  reason: string;
  staffId: string | null; // null = everyone
}

export async function addOverride(input: OverrideInput): Promise<ActionResult> {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false, error: "Only the business owner can edit availability." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date))
    return { ok: false, error: "Pick a valid date." };
  if (!input.isClosed && !isValidDayRange(input.openTime, input.closeTime))
    return { ok: false, error: "Close time must be after open time." };

  const { business } = gate.ctx;
  const supabase = await createClient();

  // One row per (business, date) or (business, staff, date) — the partial
  // unique indexes use NULL-aware definitions that upsert's onConflict can't
  // name, so delete + insert is the reliable upsert here.
  let del = supabase
    .from("availability_overrides")
    .delete()
    .eq("business_id", business.id)
    .eq("date", input.date);
  del = input.staffId ? del.eq("staff_id", input.staffId) : del.is("staff_id", null);
  const { error: delError } = await del;
  if (delError) return { ok: false, error: "Could not save the override." };

  const { error: insError } = await supabase.from("availability_overrides").insert({
    business_id: business.id,
    staff_id: input.staffId,
    date: input.date,
    open_time: input.isClosed ? null : toTimeString(input.openTime),
    close_time: input.isClosed ? null : toTimeString(input.closeTime),
    is_closed: input.isClosed,
    reason: input.reason.trim() || null,
  });
  if (insError) return { ok: false, error: "Could not save the override." };

  revalidatePath("/dashboard/availability");
  return { ok: true };
}

export async function deleteOverride(id: string): Promise<ActionResult> {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false, error: "Only the business owner can edit availability." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("availability_overrides")
    .delete()
    .eq("id", id)
    .eq("business_id", gate.ctx.business.id);
  if (error) return { ok: false, error: "Could not delete the override." };

  revalidatePath("/dashboard/availability");
  return { ok: true };
}

export async function addBlackout(input: {
  date: string;
  reason: string;
}): Promise<ActionResult> {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false, error: "Only the business owner can edit availability." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date))
    return { ok: false, error: "Pick a valid date." };

  const supabase = await createClient();
  const { error } = await supabase.from("blackout_dates").upsert(
    {
      business_id: gate.ctx.business.id,
      date: input.date,
      reason: input.reason.trim() || null,
    },
    { onConflict: "business_id, date" },
  );
  if (error) return { ok: false, error: "Could not add the blackout date." };

  revalidatePath("/dashboard/availability");
  return { ok: true };
}

export async function deleteBlackout(id: string): Promise<ActionResult> {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false, error: "Only the business owner can edit availability." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("blackout_dates")
    .delete()
    .eq("id", id)
    .eq("business_id", gate.ctx.business.id);
  if (error) return { ok: false, error: "Could not delete the blackout date." };

  revalidatePath("/dashboard/availability");
  return { ok: true };
}

export interface BookingRulesInput {
  minLeadTimeMinutes: number;
  maxAdvanceDays: number;
  slotStepMinutes: number;
  bufferBeforeDefaultMinutes: number;
  bufferAfterDefaultMinutes: number;
  freeCancelHours: number;
}

export async function saveBookingRules(
  input: BookingRulesInput,
): Promise<ActionResult> {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false, error: "Only the business owner can edit availability." };

  if (!Number.isInteger(input.minLeadTimeMinutes) || input.minLeadTimeMinutes < 0)
    return { ok: false, error: "Lead time must be 0 or more minutes." };
  if (!Number.isInteger(input.maxAdvanceDays) || input.maxAdvanceDays < 1 || input.maxAdvanceDays > 365)
    return { ok: false, error: "Advance window must be between 1 and 365 days." };
  if (!SLOT_STEPS.includes(input.slotStepMinutes))
    return { ok: false, error: "Invalid slot step." };
  if (input.bufferBeforeDefaultMinutes < 0 || input.bufferAfterDefaultMinutes < 0)
    return { ok: false, error: "Buffers cannot be negative." };
  if (!Number.isInteger(input.freeCancelHours) || input.freeCancelHours < 0)
    return { ok: false, error: "Free-cancel window must be 0 or more hours." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      min_lead_time_minutes: input.minLeadTimeMinutes,
      max_advance_days: input.maxAdvanceDays,
      slot_step_minutes: input.slotStepMinutes,
      buffer_before_default_minutes: Math.round(input.bufferBeforeDefaultMinutes),
      buffer_after_default_minutes: Math.round(input.bufferAfterDefaultMinutes),
      free_cancel_hours: input.freeCancelHours,
    })
    .eq("id", gate.ctx.business.id);
  if (error) return { ok: false, error: "Could not save booking rules." };

  revalidatePath("/dashboard/availability");
  return { ok: true };
}
