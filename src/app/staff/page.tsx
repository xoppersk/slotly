/* S-01 Staff agenda (server): the signed-in staff member's OWN real
   bookings — today plus what's coming up. Scoping is by the membership's
   staff_id and PostgreSQL Row Level Security (bookings_staff_select
   only ever returns their own bookings). The fixture's break row and
   canned "open · book someone" row have no database source and are
   gone; the Check-in button is gone with the check-in state itself
   (PROD-W4.md). */
import { redirect } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";

import { PhoneShell } from "@/components/sl/shells/PhoneShell";
import { AgendaRow } from "@/components/sl/RunSheetRow";
import { IconCalendar } from "@/components/sl/icons";
import {
  listAvailabilityOverrides,
  listAvailabilityRules,
  listBlackoutDates,
  listTimeOff,
} from "@/lib/db/owner";
import { createClient } from "@/lib/supabase/server";

import { getStaffContext, loadBookings } from "../app/_lib/data";
import { windowFor, type AvailData } from "../app/_lib/availability-math";
import {
  dateShort,
  dayBoundsIso,
  firstName,
  shiftDateKey,
  todayKey,
} from "../app/_lib/model";
import { ChairSection } from "./ChairSection";

const stripMeridiem = (t: string) => t.replace(/\s[AP]M$/, "");

export default async function StaffAgendaPage() {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/app");
  const { business, staff, staffId } = ctx;
  const tz = business.timezone;
  const today = todayKey(tz);
  const { fromIso } = dayBoundsIso(today, tz);
  const horizonIso = dayBoundsIso(shiftDateKey(today, 31), tz).fromIso;

  const supabase = await createClient();
  const [bundle, rules, overrides, blackouts, timeOff] = await Promise.all([
    loadBookings(business, { fromIso, toIso: horizonIso, staffId }),
    listAvailabilityRules(supabase, business.id),
    listAvailabilityOverrides(supabase, business.id),
    listBlackoutDates(supabase, business.id),
    listTimeOff(supabase, business.id, "approved"),
  ]);
  const mine = bundle.bookings;
  const todays = mine.filter((b) => b.dateKey === today && b.dbStatus !== "cancelled" && b.dbStatus !== "no_show");
  const now = new Date();
  const nowIso = now.toISOString();
  const inChair = todays.find(
    (b) => b.dbStatus === "confirmed" && b.startsAtIso <= nowIso && b.endsAtIso > nowIso,
  );
  const next = todays.filter((b) => b.startsAtIso > nowIso && (b.dbStatus === "confirmed" || b.dbStatus === "pending" || b.dbStatus.startsWith("payment")));
  const doneCount = todays.filter((b) => b.dbStatus === "completed").length;
  const comingUp = mine.filter((b) => b.dateKey > today && b.dbStatus !== "cancelled" && b.dbStatus !== "no_show").slice(0, 3);

  const avail: AvailData = { rules, overrides, blackouts, timeOff };
  const win = staff ? windowFor(staffId, today, avail) : null;
  const fmtMin = (mins: number) => {
    const h = Math.floor(mins / 60);
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(mins % 60).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  };
  const overrunLabel =
    inChair && nowIso > inChair.endsAtIso
      ? `Ran ${Math.max(1, Math.round((now.getTime() - new Date(inChair.endsAtIso).getTime()) / 60000))} min over`
      : undefined;

  return (
    <PhoneShell
      current="agenda"
      header={
        <>
          <span className="sl-staff-hdtitle">
            {new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}
          </span>
          <span className="sl-staff-hdmeta">
            {staff ? firstName(staff.name) : "Staff"} · {todays.length} booking{todays.length === 1 ? "" : "s"}
            {win ? ` · ${stripMeridiem(fmtMin(win.openMinutes))} – ${fmtMin(win.closeMinutes)}` : ""}
            {` · ${formatInTimeZone(now, tz, "h:mm a")}`}
          </span>
        </>
      }
      headerAction={
        <span className="sl-staff-hbtn" aria-hidden="true">
          <IconCalendar />
        </span>
      }
    >
      {inChair ? (
        <ChairSection
          bookingId={inChair.id}
          customer={inChair.customerName}
          service={inChair.serviceName}
          windowLabel={`${stripMeridiem(inChair.startLabel)} – ${stripMeridiem(inChair.endLabel)}`}
          balanceCents={inChair.balanceCents}
          overrunLabel={overrunLabel}
        />
      ) : null}

      <p className="sl-staff-lbl">Next</p>
      <div className="sl-card" style={{ overflow: "hidden" }}>
        {next.map((b) => (
          <AgendaRow
            key={b.id}
            start={b.startLabel}
            end={b.endLabel}
            title={b.customerName}
            sub={b.customerNotes ? `“${b.customerNotes}”` : b.serviceName}
          />
        ))}
        {next.length === 0 && !inChair ? (
          <div className="sl-agenda-row">
            <span style={{ fontSize: 14, color: "var(--muted)" }}>Nothing else booked today.</span>
          </div>
        ) : null}
      </div>

      {comingUp.length > 0 ? (
        <>
          <p className="sl-staff-lbl">Coming up</p>
          <div className="sl-card" style={{ overflow: "hidden" }}>
            {comingUp.map((b) => (
              <AgendaRow
                key={b.id}
                start={b.startLabel}
                end={b.endLabel}
                title={b.customerName}
                sub={`${dateShort(b.dateKey)} · ${b.serviceName}`}
              />
            ))}
          </div>
        </>
      ) : null}

      <p className="sl-staff-foot">
        {doneCount} done today{next.length > 0 ? ` · ${next.length} still to come` : ""}
      </p>
    </PhoneShell>
  );
}
