"use server";
/* Staff-portal mutations (PROD-W4). Scoped to the signed-in user's own
 * staff profile via getStaffContext; PostgreSQL Row Level Security does
 * the enforcing (staff_time_off_own_insert requires status 'pending'
 * and staff_id = own_staff_id; staff_own_update from migration 00016
 * allows editing the own staff row — the app layer whitelists exactly
 * name / title / bio / specialties / phone / notify flags). */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";

import { createClient } from "@/lib/supabase/server";

import { getStaffContext } from "../app/_lib/data";

export type ActionResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): ActionResult => ({ ok: false, error });

const timeOffSchema = z.object({
  kind: z.enum(["all-day", "part-day"]),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fromTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  toTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  reason: z.string().trim().max(300).optional(),
});

export async function requestTimeOff(
  input: z.infer<typeof timeOffSchema>,
): Promise<ActionResult> {
  const ctx = await getStaffContext();
  if (!ctx) return fail("You are not signed in as staff.");
  const parsed = timeOffSchema.safeParse(input);
  if (!parsed.success) return fail("Check the dates and try again.");
  const d = parsed.data;
  const tz = ctx.business.timezone;
  const startLocal = d.kind === "all-day" ? `${d.fromDate}T00:00:00` : `${d.fromDate}T${d.fromTime ?? "09:00"}:00`;
  const endLocal = d.kind === "all-day" ? `${d.toDate}T23:59:59` : `${d.toDate}T${d.toTime ?? "17:00"}:00`;
  const startsAt = fromZonedTime(startLocal, tz);
  const endsAt = fromZonedTime(endLocal, tz);
  if (endsAt <= startsAt) return fail("The end must be after the start.");

  const supabase = await createClient();
  const { error } = await supabase.from("staff_time_off").insert({
    business_id: ctx.business.id,
    staff_id: ctx.staffId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    reason: d.reason || null,
    status: "pending",
  });
  if (error) return fail("Could not send the request. Please try again.");
  revalidatePath("/staff/time-off");
  revalidatePath("/app/availability");
  return { ok: true };
}

/** How many of my live bookings overlap a range — powers the warning
 *  that names affected bookings BEFORE a request is sent. */
export async function countAffectedBookings(
  fromIso: string,
  toIso: string,
): Promise<{ count: number; labels: string[] }> {
  const ctx = await getStaffContext();
  if (!ctx) return { count: 0, labels: [] };
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("id, starts_at, customer:customers(name)")
    .eq("business_id", ctx.business.id)
    .eq("staff_id", ctx.staffId)
    .in("status", ["pending", "payment_pending", "confirmed"])
    .lt("starts_at", toIso)
    .gt("ends_at", fromIso)
    .order("starts_at", { ascending: true })
    .limit(10);
  const rows = (data ?? []) as unknown as {
    starts_at: string;
    customer: { name: string } | null;
  }[];
  return {
    count: rows.length,
    labels: rows.map((r) => {
      const when = new Date(r.starts_at).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      return `${r.customer?.name ?? "A customer"} ${when}`;
    }),
  };
}

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  title: z.string().trim().max(120),
  bio: z.string().trim().max(1000),
  phone: z.string().trim().max(40),
  notifyNewBooking: z.boolean(),
  notifyCancellation: z.boolean(),
});

/** Own-profile update — column whitelist per migration 00016. */
export async function updateOwnProfile(
  input: z.infer<typeof profileSchema>,
): Promise<ActionResult> {
  const ctx = await getStaffContext();
  if (!ctx) return fail("You are not signed in as staff.");
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form.");
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("staff")
    .update({
      name: d.name,
      title: d.title || null,
      bio: d.bio,
      phone: d.phone || null,
      notify_new_booking: d.notifyNewBooking,
      notify_cancellation: d.notifyCancellation,
    })
    .eq("id", ctx.staffId)
    .eq("business_id", ctx.business.id);
  if (error) return fail("Could not save your profile.");
  revalidatePath("/staff/profile");
  revalidatePath("/staff");
  return { ok: true };
}
