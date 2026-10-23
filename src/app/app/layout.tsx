/* Dashboard layout (server): resolves the signed-in user → their
   memberships → the active business before any dashboard page renders.
   No memberships → /onboarding; signed out → /sign-in (middleware also
   guards /app/*). Dashboard state comes from the server on every load —
   the old fixture context + browser-persisted store are gone (PROD-W4). */
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { createClient } from "@/lib/supabase/server";
import { getDashboardContext, getSessionMemberships } from "./_lib/data";
import { dayBoundsIso, initialsOf, todayKey } from "./_lib/model";
import { DashboardShell } from "./DashboardShell";
import "../../styles/dashboard.css";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSessionMemberships();
  if (!session.user) redirect("/sign-in?next=/app");
  if (session.memberships.length === 0) redirect("/onboarding");

  const ctx = await getDashboardContext();
  if (!ctx) redirect("/onboarding");
  const { business, user } = ctx;

  // Nav badge: today's real booking count in the business timezone.
  const { fromIso, toIso } = dayBoundsIso(todayKey(business.timezone), business.timezone);
  const supabase = await createClient();
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id)
    .gte("starts_at", fromIso)
    .lt("starts_at", toIso)
    .not("status", "eq", "cancelled");

  const ownerName =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
    user.email ||
    "";
  return (
    <DashboardShell
      businessName={business.name}
      businessMark={initialsOf(business.name)}
      bookingPageHref={`/b/${business.slug}`}
      bookingsCount={count ?? 0}
      ownerName={ownerName}
      ownerInitials={initialsOf(ownerName || business.name)}
      ownerRoleLabel={ctx.isOwner ? "Owner" : "Staff"}
      businesses={ctx.memberships.map((m) => ({ id: m.business.id, name: m.business.name }))}
      activeBusinessId={business.id}
    >
      {children}
    </DashboardShell>
  );
}
