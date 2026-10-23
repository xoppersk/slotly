/* D-06 Staff (server): real staff rows, real today's counts, real next
   openings (computed from rules + bookings), real pending invites.
   Cards keep the drawn layout; the owner row resolves from the owner
   membership (the owner only appears as a person when they have a
   linked staff profile — create_business_setup does not create one). */
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  listAvailabilityOverrides,
  listAvailabilityRules,
  listBlackoutDates,
  listServiceStaff,
  listStaffAdmin,
  listTimeOff,
} from "@/lib/db/owner";
import type { StaffInviteRow } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/server";

import { getDashboardContext, loadBookings } from "../_lib/data";
import { findNextOpening, type AvailData } from "../_lib/availability-math";
import { dayBoundsIso, initialsOf, shiftDateKey, todayKey } from "../_lib/model";
import { IconArrowRight14 } from "../ui";
import { InvitePanel, type PendingInviteView } from "./InvitePanel";
import { StaffCardActions } from "./StaffCardActions";
import { ButtonLink } from "@/components/sl/Button";
import { StatusPill } from "@/components/sl/StatusPill";

export default async function StaffPage() {
  const ctx = await getDashboardContext();
  if (!ctx) redirect("/onboarding");
  const { business } = ctx;
  const tz = business.timezone;
  const today = todayKey(tz);
  const { fromIso, toIso } = dayBoundsIso(today, tz);
  const horizonIso = dayBoundsIso(shiftDateKey(today, 15), tz).fromIso;

  const supabase = await createClient();
  const [staff, mapping, bundle, rules, overrides, blackouts, timeOffApproved, invitesRes] = await Promise.all([
    listStaffAdmin(supabase, business.id),
    listServiceStaff(supabase, business.id),
    loadBookings(business, { fromIso, toIso: horizonIso }),
    listAvailabilityRules(supabase, business.id),
    listAvailabilityOverrides(supabase, business.id),
    listBlackoutDates(supabase, business.id),
    listTimeOff(supabase, business.id, "approved"),
    ctx.isOwner
      ? supabase
          .from("staff_invites")
          .select("*")
          .eq("business_id", business.id)
          .is("accepted_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as StaffInviteRow[] }),
  ]);
  const avail: AvailData = { rules, overrides, blackouts, timeOff: timeOffApproved };
  const now = new Date();
  const awayIds = new Set(
    timeOffApproved
      .filter((t) => new Date(t.starts_at) < new Date(toIso) && new Date(t.ends_at) > new Date(fromIso))
      .map((t) => t.staff_id),
  );
  const servicesByStaff = new Map<string, number>();
  for (const ids of Object.values(mapping)) {
    for (const id of ids) servicesByStaff.set(id, (servicesByStaff.get(id) ?? 0) + 1);
  }
  const todayCount = (staffId: string) =>
    bundle.bookings.filter((b) => b.staffId === staffId && b.dateKey === today && b.dbStatus !== "cancelled").length;

  const invites: PendingInviteView[] = ((invitesRes.data ?? []) as StaffInviteRow[]).map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    sentLabel: new Date(i.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    expiresLabel: new Date(i.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  // Owner row: the owner membership's linked staff profile, if any.
  let ownerName = business.name;
  let ownerSub = "Owner";
  if (ctx.isOwner) {
    const { data: ownerMembership } = await supabase
      .from("business_members")
      .select("staff_id")
      .eq("business_id", business.id)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();
    const ownerStaff = ownerMembership?.staff_id ? staff.find((s) => s.id === ownerMembership.staff_id) : undefined;
    const metaName = typeof ctx.user.user_metadata?.full_name === "string" ? ctx.user.user_metadata.full_name : "";
    ownerName = ownerStaff?.name ?? (metaName || ctx.user.email || business.name);
    ownerSub = ownerStaff ? (ownerStaff.title ?? "Owner") : "Owner";
  }

  return (
    <>
      <div className="sl-d-hd">
        <div>
          <h1 className="sl-d-h1">Staff</h1>
          <p className="sl-d-meta">
            {staff.filter((s) => s.is_active).length} active · {invites.length} invite{invites.length === 1 ? "" : "s"} pending
          </p>
        </div>
      </div>

      <div className="sl-d-staff-grid">
        {staff.map((s) => {
          const away = awayIds.has(s.id);
          const opening = s.is_active && !away
            ? findNextOpening(business, [s], avail, bundle.bookings, today, now)
            : null;
          const serviceCount = servicesByStaff.get(s.id) ?? 0;
          return (
            <article key={s.id} className="sl-d-card sl-d-staff-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span className={`sl-d-mono${away || !s.is_active ? " sl-d-mono--off" : ""}`} aria-hidden="true">{initialsOf(s.name)}</span>
                {!s.is_active ? (
                  <StatusPill status="Not booked yet" label="Inactive" />
                ) : away ? (
                  <StatusPill status="Away" />
                ) : (
                  <StatusPill status="Working" />
                )}
              </div>
              <div>
                <span className="sl-d-staff-name">{s.name}</span>
                <span className="sl-d-sub" style={{ marginTop: 6 }}>{s.title ?? "Staff"}</span>
              </div>
              <dl className="sl-d-dl2">
                <div><dt>Services</dt><dd>{serviceCount === 0 ? "None assigned" : `${serviceCount}`}</dd></div>
                <div><dt>Today</dt><dd>{todayCount(s.id)} bookings</dd></div>
                <div>
                  <dt>Next opening</dt>
                  <dd style={{ color: away || !s.is_active ? "var(--muted)" : "var(--open)" }}>
                    {opening ? `${opening.whenLabel} ${opening.timeLabel}` : "—"}
                  </dd>
                </div>
              </dl>
              <span style={{ display: "flex", gap: 8, alignItems: "center", marginTop: "auto" }}>
                <ButtonLink href={`/app/availability?tab=${s.id}`} size="sm">
                  Hours<IconArrowRight14 />
                </ButtonLink>
                {ctx.isOwner ? <StaffCardActions staffId={s.id} isActive={s.is_active} /> : null}
              </span>
            </article>
          );
        })}
        {staff.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 15 }}>No staff yet. Invite your first team member below.</p>
        ) : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, marginTop: 16 }} className="sl-d-two-col">
        <div className="sl-d-card sl-d-staff-row">
          <span className="sl-d-mono" aria-hidden="true">{initialsOf(ownerName)}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: 16, color: "var(--ink)" }}>{ownerName}</span>
            <span className="sl-d-sub">{ownerSub}</span>
            <span className="sl-d-sub" style={{ marginTop: 2, fontSize: 12 }}>Runs the business · not a bookable staff profile unless linked</span>
          </span>
          <StatusPill status="Not booked yet" label="Owner" />
        </div>
      </div>

      {ctx.isOwner ? <InvitePanel invites={invites} /> : null}

      <section className="sl-d-ink" style={{ padding: "28px 32px", marginTop: 24, display: "flex", justifyContent: "space-between", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, font: "600 28px/1.15 var(--font-display)", letterSpacing: "-.02em" }}>What staff can do</h2>
          <p style={{ margin: "8px 0 0", fontSize: 15, color: "#cdb8ae", maxWidth: 640 }}>
            See their own agenda, complete their own bookings, ask for time off, and book on a customer’s behalf.
            Only the owner changes prices, hours and payouts.
          </p>
        </div>
        <Link href="/app/settings" className="sl-btn sl-btn--linen" style={{ height: 52, padding: "0 24px", fontSize: 15, width: "auto" }}>
          Change permissions
        </Link>
      </section>
    </>
  );
}
