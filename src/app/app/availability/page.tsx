/* D-07 Availability (server): real weekly rules, overrides, blackout
   dates and time-off for the active business. */
import { Suspense } from "react";
import { redirect } from "next/navigation";

import {
  listAvailabilityOverrides,
  listAvailabilityRules,
  listBlackoutDates,
  listStaffAdmin,
  listTimeOff,
} from "@/lib/db/owner";
import { createClient } from "@/lib/supabase/server";

import { getDashboardContext } from "../_lib/data";
import { todayKey } from "../_lib/model";
import { AvailabilityClient } from "./AvailabilityClient";

type SP = Promise<Record<string, string | string[] | undefined>>;

async function AvailabilityInner({ searchParams }: { searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx) redirect("/onboarding");
  const { business } = ctx;
  const supabase = await createClient();
  const [rules, overrides, blackouts, staff, timeOff] = await Promise.all([
    listAvailabilityRules(supabase, business.id),
    listAvailabilityOverrides(supabase, business.id),
    listBlackoutDates(supabase, business.id),
    listStaffAdmin(supabase, business.id),
    listTimeOff(supabase, business.id),
  ]);

  const sp = await searchParams;
  const tab = (Array.isArray(sp.tab) ? sp.tab[0] : sp.tab) ?? "shop";
  return (
    <AvailabilityClient
      tab={tab}
      business={{
        id: business.id,
        timezone: business.timezone,
        minLeadTimeMinutes: business.min_lead_time_minutes,
        maxAdvanceDays: business.max_advance_days,
        slotStepMinutes: business.slot_step_minutes,
      }}
      staff={staff.map((s) => ({ id: s.id, name: s.name, isActive: s.is_active }))}
      rules={rules}
      overrides={overrides}
      blackouts={blackouts}
      timeOff={timeOff.map((t) => ({
        id: t.id,
        staffId: t.staff_id,
        staffName: staff.find((s) => s.id === t.staff_id)?.name ?? "Staff",
        startsAt: t.starts_at,
        endsAt: t.ends_at,
        reason: t.reason ?? "",
        status: t.status,
      }))}
      today={todayKey(business.timezone)}
      canEdit={ctx.isOwner}
    />
  );
}

export default function AvailabilityPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={null}>
      <AvailabilityInner searchParams={searchParams} />
    </Suspense>
  );
}
