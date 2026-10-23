/* D-05 Services (server): REAL CRUD over the services table (owner
   policy) incl. price / duration / deposit / payment policy / buffers /
   staff assignment (service_staff). This page is also onboarding
   step 2's target — fully functional standalone. */
import { redirect } from "next/navigation";

import { listServiceStaff, listServicesAdmin, listStaffAdmin } from "@/lib/db/owner";
import { createClient } from "@/lib/supabase/server";

import { getDashboardContext } from "../_lib/data";
import { ServicesClient, type ServiceView } from "./ServicesClient";

export default async function ServicesPage() {
  const ctx = await getDashboardContext();
  if (!ctx) redirect("/onboarding");
  const { business } = ctx;
  const supabase = await createClient();
  const [services, staff, mapping] = await Promise.all([
    listServicesAdmin(supabase, business.id),
    listStaffAdmin(supabase, business.id),
    listServiceStaff(supabase, business.id),
  ]);
  const views: ServiceView[] = services.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    durationMinutes: s.duration_minutes,
    priceCents: s.price_cents,
    depositCents: s.deposit_cents,
    paymentPolicy: s.payment_policy,
    bufferBeforeMinutes: s.buffer_before_minutes,
    bufferAfterMinutes: s.buffer_after_minutes,
    sortOrder: s.sort_order,
    isActive: s.is_active,
    staffIds: mapping[s.id] ?? [],
  }));
  return (
    <ServicesClient
      services={views}
      staff={staff.map((s) => ({ id: s.id, name: s.name, isActive: s.is_active }))}
      slug={business.slug}
      bookingPageEnabled={business.booking_page_enabled}
      canEdit={ctx.isOwner}
    />
  );
}
