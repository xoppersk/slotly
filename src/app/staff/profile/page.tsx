/* S-03 Staff profile (server): the member's OWN staff row + the
   services they offer (service_staff). Editing goes through the
   staff_own_update policy (migration 00016) with the app-layer column
   whitelist in staff/actions.ts. Service assignment itself is
   owner-only in RLS (service_staff_owner_all), so the services list
   is read-only here — see PROD-W4.md. */
import { redirect } from "next/navigation";

import { listServiceStaff, listServicesAdmin } from "@/lib/db/owner";
import { createClient } from "@/lib/supabase/server";

import { getStaffContext } from "../../app/_lib/data";
import { ProfileClient } from "./ProfileClient";

export default async function StaffProfilePage() {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/app");
  if (!ctx.staff) redirect("/app");
  const supabase = await createClient();
  const [services, mapping] = await Promise.all([
    listServicesAdmin(supabase, ctx.business.id),
    listServiceStaff(supabase, ctx.business.id),
  ]);
  const offeredIds = new Set(
    Object.entries(mapping)
      .filter(([, ids]) => ids.includes(ctx.staffId))
      .map(([serviceId]) => serviceId),
  );
  return (
    <ProfileClient
      slug={ctx.business.slug}
      email={ctx.user.email ?? ""}
      staff={{
        name: ctx.staff.name,
        title: ctx.staff.title ?? "",
        bio: ctx.staff.bio,
        phone: ctx.staff.phone ?? "",
        notifyNewBooking: ctx.staff.notify_new_booking,
        notifyCancellation: ctx.staff.notify_cancellation,
      }}
      services={services
        .filter((s) => s.is_active)
        .map((s) => ({ id: s.id, name: s.name, offered: offeredIds.has(s.id) }))}
    />
  );
}
