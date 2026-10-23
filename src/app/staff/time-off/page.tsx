/* S-02 Time off (server): the staff member's OWN real requests from
   staff_time_off (RLS own-select). The form is the client island. */
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { StaffTimeOffRow } from "@/lib/supabase/types";

import { getStaffContext } from "../../app/_lib/data";
import { todayKey } from "../../app/_lib/model";
import { TimeOffClient } from "./TimeOffClient";

export default async function StaffTimeOffPage() {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/app");
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_time_off")
    .select("*")
    .eq("business_id", ctx.business.id)
    .eq("staff_id", ctx.staffId)
    .order("starts_at", { ascending: false });
  const requests = ((data ?? []) as StaffTimeOffRow[]).map((r) => ({
    id: r.id,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    reason: r.reason ?? "",
    status: r.status,
  }));
  return (
    <TimeOffClient
      businessName={ctx.business.name}
      timezone={ctx.business.timezone}
      today={todayKey(ctx.business.timezone)}
      requests={requests}
    />
  );
}
