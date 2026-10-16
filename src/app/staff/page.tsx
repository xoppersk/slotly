"use client";
import { useEffect, useState } from "react";
import { PhoneShell } from "@/components/sl/shells/PhoneShell";
import { ChairCard, ChairCardNext } from "@/components/sl/ChairCard";
import { AgendaRow } from "@/components/sl/RunSheetRow";
import { IconCalendar } from "@/components/sl/icons";
import { DASHBOARD_NOW, bookings as seedBookings, getBarber } from "@/lib/api";
import { loadStoredBookings } from "@/lib/dashboard-store";
import type { Booking } from "@/lib/types";

const stripMeridiem = (t: string) => t.replace(/\s[AP]M$/, "");

/* S-01 — Micah's own agenda for the dashboard day (Thu Oct 8, 10:40 AM).
   Everything is read from the shared fixtures so the agenda agrees with
   Today / Bookings / Calendar: Sam in the chair (5 min over, $40 left),
   next opening 2:15 PM after Micah's 1:45–2:15 break. */
export default function StaffAgendaPage() {
  const micah = getBarber("micah")!;
  // SL-04: state starts from the fixture list (same first render as
  // before), then a mount effect swaps in the dashboard's stored
  // bookings when present so run-sheet changes show up here.
  const [allBookings, setAllBookings] = useState<Booking[]>(() => seedBookings.map((b) => ({ ...b })));
  useEffect(() => {
    const stored = loadStoredBookings();
    if (stored) setAllBookings(stored);
  }, []);
  const day = allBookings.filter((b) => b.barberId === "micah" && b.date === DASHBOARD_NOW.date);
  const chair = day.find((b) => b.status === "In the chair");
  const next = day.filter((b) => b.status === "Upcoming").slice(0, 4);
  const later = day.filter((b) => b.status === "Upcoming").slice(4);
  const doneCount = day.filter((b) => b.status === "Done").length;

  const subFor = (b: Booking) =>
    b.customer === "Jordan Bell" ? "“#2 on the sides”" : b.service;

  return (
    <PhoneShell
      current="agenda"
      header={
        <>
          <span className="sl-staff-hdtitle">Thursday, Oct 8</span>
          <span className="sl-staff-hdmeta">
            Micah · {micah.todayBookings} bookings · 9 AM – 6 PM
          </span>
        </>
      }
      headerAction={
        <button type="button" className="sl-staff-hbtn" aria-label="Pick a day">
          <IconCalendar />
        </button>
      }
    >
      {chair ? (
        <ChairCard
          customer={chair.customer}
          service={chair.service}
          windowLabel={`${stripMeridiem(chair.start)} – ${stripMeridiem(chair.end)}`}
          balanceCents={chair.balanceCents}
          overrunLabel={chair.overrunLabel}
        />
      ) : next[0] ? (
        <ChairCardNext customer={next[0].customer} time={stripMeridiem(next[0].start)} />
      ) : null}

      <p className="sl-staff-lbl">Next</p>
      <div className="sl-card" style={{ overflow: "hidden" }}>
        {next.map((b, i) => (
          <AgendaRow
            key={b.id}
            start={b.start}
            end={b.end}
            title={b.customer}
            sub={subFor(b)}
            action={
              i === 0 ? (
                <button type="button" className="sl-staff-btn">
                  Check in
                </button>
              ) : undefined
            }
          />
        ))}

        <div className="sl-agenda-row sl-agenda-row--break">
          <span className="sl-agenda-row__t" style={{ color: "var(--muted)" }}>
            {stripMeridiem(micah.break!.start)}
            <small>to {stripMeridiem(micah.break!.end)}</small>
          </span>
          <span className="sl-hatch sl-staff-hatch">
            <span>Break</span>
          </span>
        </div>

        <div className="sl-agenda-row sl-agenda-row--open">
          <span className="sl-agenda-row__t" style={{ color: "var(--open-ink)" }}>
            {stripMeridiem(micah.nextOpening!)}
            <small style={{ color: "var(--open-ink)" }}>to 3:00</small>
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="sl-staff-open-label">
              <i className="sl-staff-open-dot" aria-hidden="true" />
              Open
            </span>
          </span>
          <button type="button" className="sl-staff-btn sl-staff-btn--primary">
            Book someone
          </button>
        </div>
      </div>

      <p className="sl-staff-foot">
        {later.length} more later: {later.map((b) => `${b.customer} ${stripMeridiem(b.start)}`).join(", ")} · {doneCount} done today
      </p>
    </PhoneShell>
  );
}
