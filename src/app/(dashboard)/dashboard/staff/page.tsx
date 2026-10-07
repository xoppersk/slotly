import { redirect } from "next/navigation";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { requireOwner } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";

import { StaffClient, type PendingInvite, type PendingTimeOff, type StaffCardModel } from "./staff-client";

/** Start/end of "today" in the business timezone, as ISO strings. */
function todayBounds(timezone: string): { start: string; end: string } {
  const now = new Date();
  const todayLocal = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  const start = fromZonedTime(`${todayLocal}T00:00:00`, timezone);
  const end = fromZonedTime(`${todayLocal}T23:59:59.999`, timezone);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default async function StaffPage() {
  const gate = await requireOwner();
  if (!gate.ok) {
    if (gate.reason === "signed-out") redirect("/auth/sign-in");
    if (gate.reason === "no-business") redirect("/onboarding");
    redirect("/dashboard");
  }

  const { business } = gate.ctx;
  const supabase = await createClient();

  const [{ data: staffRows }, { data: inviteRows }, { data: ruleRows }, { data: timeOffRows }] =
    await Promise.all([
      supabase
        .from("staff")
        .select("*")
        .eq("business_id", business.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("staff_invites")
        .select("id, email, role, expires_at")
        .eq("business_id", business.id)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }),
      supabase
        .from("availability_rules")
        .select("staff_id, weekday, open_time, close_time")
        .eq("business_id", business.id)
        .not("staff_id", "is", null),
      supabase
        .from("staff_time_off")
        .select("id, staff_id, starts_at, ends_at, reason")
        .eq("business_id", business.id)
        .eq("status", "pending")
        .gte("ends_at", new Date().toISOString())
        .order("starts_at", { ascending: true }),
    ]);

  const { start, end } = todayBounds(business.timezone);
  const { data: todayBookings } = await supabase
    .from("bookings")
    .select("staff_id")
    .eq("business_id", business.id)
    .gte("starts_at", start)
    .lte("starts_at", end)
    .neq("status", "cancelled");

  const loadByStaff = new Map<string, number>();
  for (const b of todayBookings ?? []) {
    loadByStaff.set(b.staff_id, (loadByStaff.get(b.staff_id) ?? 0) + 1);
  }
  const hoursByStaff = new Map<string, { weekday: number; open_time: string; close_time: string }[]>();
  for (const r of ruleRows ?? []) {
    if (!r.staff_id) continue;
    const arr = hoursByStaff.get(r.staff_id) ?? [];
    arr.push({ weekday: r.weekday, open_time: r.open_time, close_time: r.close_time });
    hoursByStaff.set(r.staff_id, arr);
  }

  const staff: StaffCardModel[] = (staffRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    title: s.title,
    bio: s.bio,
    photo_url: s.photo_url,
    specialties: s.specialties,
    phone: s.phone,
    is_active: s.is_active,
    notify_new_booking: s.notify_new_booking,
    notify_cancellation: s.notify_cancellation,
    hours: hoursByStaff.get(s.id) ?? [],
    todayLoad: loadByStaff.get(s.id) ?? 0,
  }));

  const invites: PendingInvite[] = (inviteRows ?? []).map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    expires_at: i.expires_at,
  }));

  // The Database stub declares no Relationships, so staff names are
  // resolved with a second query and mapped explicitly.
  const timeOffStaffIds = [...new Set((timeOffRows ?? []).map((r) => r.staff_id))];
  const { data: timeOffStaff } =
    timeOffStaffIds.length > 0
      ? await supabase
          .from("staff")
          .select("id, name")
          .eq("business_id", business.id)
          .in("id", timeOffStaffIds)
      : { data: [] as { id: string; name: string }[] };
  const staffNameById = new Map(
    (timeOffStaff ?? []).map((s) => [s.id, s.name])
  );

  const pendingTimeOff: PendingTimeOff[] = (timeOffRows ?? []).map((r) => ({
    id: r.id,
    staff_id: r.staff_id,
    staff_name: staffNameById.get(r.staff_id) ?? "Unknown staff",
    starts_at: r.starts_at,
    ends_at: r.ends_at,
    reason: r.reason,
  }));

  return <StaffClient staff={staff} invites={invites} pendingTimeOff={pendingTimeOff} />;
}
