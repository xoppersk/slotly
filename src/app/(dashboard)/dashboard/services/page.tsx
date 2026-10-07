import { redirect } from "next/navigation";

import { requireOwner } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";

import type { BookingStatus } from "@/lib/supabase/types";

import { ServicesClient, type ServiceListItem } from "./services-client";

const UPCOMING_STATUSES: BookingStatus[] = ["confirmed", "pending", "payment_pending"];

export default async function ServicesPage() {
  const gate = await requireOwner();
  if (!gate.ok) {
    if (gate.reason === "signed-out") redirect("/auth/sign-in");
    if (gate.reason === "no-business") redirect("/onboarding");
    redirect("/dashboard");
  }

  const { business } = gate.ctx;
  const supabase = await createClient();

  const [{ data: services }, { data: staff }, { data: links }, { data: upcoming }] =
    await Promise.all([
      supabase
        .from("services")
        .select("*")
        .eq("business_id", business.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("staff")
        .select("id, name, is_active")
        .eq("business_id", business.id)
        .order("created_at", { ascending: true }),
      supabase.from("service_staff").select("service_id, staff_id"),
      supabase
        .from("bookings")
        .select("service_id")
        .eq("business_id", business.id)
        .gt("starts_at", new Date().toISOString())
        .in("status", UPCOMING_STATUSES),
    ]);

  const staffById = new Map((staff ?? []).map((s) => [s.id, s]));
  const staffIdsByService = new Map<string, string[]>();
  for (const link of links ?? []) {
    const arr = staffIdsByService.get(link.service_id) ?? [];
    arr.push(link.staff_id);
    staffIdsByService.set(link.service_id, arr);
  }
  const upcomingByService = new Map<string, number>();
  for (const b of upcoming ?? []) {
    upcomingByService.set(b.service_id, (upcomingByService.get(b.service_id) ?? 0) + 1);
  }

  const items: ServiceListItem[] = (services ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    duration_minutes: s.duration_minutes,
    price_cents: s.price_cents,
    buffer_before_minutes: s.buffer_before_minutes,
    buffer_after_minutes: s.buffer_after_minutes,
    payment_policy: s.payment_policy,
    deposit_cents: s.deposit_cents,
    is_active: s.is_active,
    staff: (staffIdsByService.get(s.id) ?? [])
      .map((id) => staffById.get(id))
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map((s) => ({ id: s.id, name: s.name })),
    futureBookings: upcomingByService.get(s.id) ?? 0,
  }));

  return (
    <ServicesClient
      services={items}
      staff={(staff ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        is_active: s.is_active,
      }))}
      defaultPaymentPolicy={business.default_payment_policy}
    />
  );
}
