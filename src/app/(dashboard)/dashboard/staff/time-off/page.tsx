import { redirect } from "next/navigation";

import { getCurrentBusiness } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import {
  formatDateTimeLabel,
  formatWhenLabel,
  dayKey,
} from "@/lib/dashboard/format";
import { toBusinessDayKey } from "@/lib/timezone";
import { Card, CardContent } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";

import { RequestTimeOffForm } from "./request-form";

interface TimeOffRow {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  status: "pending" | "approved" | "declined";
}

function rangeLabel(row: TimeOffRow, tz: string): string {
  const startDay = dayKey(row.starts_at, tz);
  const endDay = dayKey(row.ends_at, tz);
  if (startDay === endDay) {
    return formatWhenLabel(row.starts_at, tz);
  }
  return `${formatDateTimeLabel(row.starts_at, tz)} → ${formatDateTimeLabel(row.ends_at, tz)}`;
}

/** Staff self-service: own time-off requests + request form. */
export default async function StaffTimeOffPage() {
  const ctx = await getCurrentBusiness();
  if (!ctx) redirect("/auth/sign-in");
  if (ctx.membership.role !== "staff") redirect("/dashboard/staff");
  const staffId = ctx.membership.staffId;
  if (!staffId) redirect("/dashboard");

  const tz = ctx.business.timezone;
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_time_off")
    .select("id, starts_at, ends_at, reason, status")
    .eq("business_id", ctx.business.id)
    .eq("staff_id", staffId)
    .gte("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: true });
  const rows = (data ?? []) as TimeOffRow[];

  const todayKey = toBusinessDayKey(new Date().toISOString(), tz);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Time off</h1>
        <p className="text-sm text-muted-foreground">
          Your upcoming time off at {ctx.business.name}. Requests go to the
          owner for approval — approved time off is removed from the booking
          grid.
        </p>
      </header>

      <RequestTimeOffForm minDate={todayKey} />

      <section aria-label="Upcoming time off" className="flex flex-col gap-3">
        {rows.length === 0 ? (
          <EmptyState
            title="Nothing scheduled"
            description="You have no upcoming time off. Use the form above to request some."
          />
        ) : (
          rows.map((row) => (
            <Card key={row.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="tnum truncate text-sm font-medium">
                    {rangeLabel(row, tz)}
                  </p>
                  {row.reason && (
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {row.reason}
                    </p>
                  )}
                </div>
                <StatusChip
                  // The chip's palette has no "approved" — "confirmed" is
                  // its green approval color; the label carries the meaning.
                  status={row.status === "approved" ? "confirmed" : row.status}
                  label={
                    row.status === "pending"
                      ? "Awaiting approval"
                      : row.status === "approved"
                        ? "Approved"
                        : "Declined"
                  }
                />
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
