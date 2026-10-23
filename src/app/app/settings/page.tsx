/* D-09 Settings (server): real business profile + booking policies
   from the businesses row; plan section reads PLANS from config.
   Fields with no database column from the fixture design (shop-wide
   deposit amount, refund/no-show deposit toggles) are removed — see
   PROD-W4.md. Free cancellation is the real free_cancel_hours column;
   reminders map to reminder_24h_enabled / reminder_2h_enabled. */
import { redirect } from "next/navigation";

import { PLANS, PLANS_ARE_PLACEHOLDER } from "@/lib/config";

import { getDashboardContext } from "../_lib/data";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const ctx = await getDashboardContext();
  if (!ctx) redirect("/onboarding");
  const b = ctx.business;
  return (
    <SettingsClient
      business={{
        name: b.name,
        description: b.description,
        phone: b.phone ?? "",
        email: b.email ?? "",
        address: b.address ?? "",
        timezone: b.timezone,
        slug: b.slug,
        minLeadTimeMinutes: b.min_lead_time_minutes,
        maxAdvanceDays: b.max_advance_days,
        slotStepMinutes: b.slot_step_minutes,
        freeCancelHours: b.free_cancel_hours,
        reminder24hEnabled: b.reminder_24h_enabled,
        reminder2hEnabled: b.reminder_2h_enabled,
      }}
      plans={PLANS.map((p) => ({
        id: p.id,
        name: p.name,
        monthlyPriceCents: p.monthlyPriceCents,
        blurb: p.blurb,
      }))}
      plansArePlaceholder={PLANS_ARE_PLACEHOLDER}
      canEdit={ctx.isOwner}
    />
  );
}
