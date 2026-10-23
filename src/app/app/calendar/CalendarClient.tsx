"use client";
/* D-04 Calendar day view — 96px per hour, one column per staff member,
   real bookings as blocks (links to the booking drawer), a real
   now-line on today, approved time off as the hatched away block.
   The drawn hour window comes from the day's real availability
   windows. The fixture's per-barber break block and canned opening
   block are gone: breaks are not in the schema and openings are
   computed on Today, not stored (PROD-W4.md). */
import Link from "next/link";
import { ButtonLink } from "@/components/sl/Button";
import { IconPlus } from "@/components/sl/icons";
import { dateTitle, shiftDateKey, type DashBooking } from "../_lib/model";
import { IconChevronLeft, IconChevronRight } from "../ui";

const PX_PER_MIN = 96 / 60;

function blockClass(b: DashBooking, inWindow: boolean): string {
  const base =
    b.dbStatus === "completed" ? " sl-d-block--done"
    : inWindow ? " sl-d-block--chair"
    : b.dbStatus === "confirmed" ? " sl-d-block--arrived"
    : "";
  const short = b.endMinutes - b.startMinutes <= 25 ? " sl-d-block--short" : "";
  return `sl-d-block${base}${short}`;
}
function blockLabel(b: DashBooking): string {
  return `${b.customerName}, ${b.startLabel} to ${b.endLabel}, ${b.serviceName}, ${b.pillLabel ?? b.pill}`;
}
function hourLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  if (mins % 60 !== 0) return `${h12}:${String(mins % 60).padStart(2, "0")}`;
  return h === 0 ? "12 AM" : h < 12 ? `${h12} AM` : h === 12 ? "12 PM" : `${h12} PM`;
}

export function CalendarClient({
  date,
  today,
  staff,
  bookings,
  awayByStaff,
  dayStartMinutes,
  dayEndMinutes,
  nowMinutes,
  nowLabel,
}: {
  date: string;
  today: string;
  staff: { id: string; name: string }[];
  bookings: DashBooking[];
  awayByStaff: Record<string, string>;
  dayStartMinutes: number;
  dayEndMinutes: number;
  nowMinutes: number | null;
  nowLabel: string | null;
}) {
  const dayBookings = bookings.filter((b) => b.dateKey === date);
  const counts = staff.map((s) => dayBookings.filter((x) => x.staffId === s.id).length);
  const hours: number[] = [];
  for (let m = dayStartMinutes; m < dayEndMinutes; m += 60) hours.push(m);
  const topFor = (mins: number) => (mins - dayStartMinutes) * PX_PER_MIN;
  const gridHeight = (dayEndMinutes - dayStartMinutes) * PX_PER_MIN;
  const nowTop = nowMinutes !== null ? 14 + topFor(nowMinutes) : null;

  return (
    <>
      <div className="sl-d-hd">
        <div>
          <p className="sl-d-eyb">Day view · {dayBookings.length} bookings</p>
          <h1 className="sl-d-h1">{dateTitle(date)}</h1>
          <div className="sl-d-meta" style={{ gap: 8 }}>
            <Link href={`/app/calendar?date=${shiftDateKey(date, -1)}`} className="sl-btn sl-btn--dash sl-d-icb" aria-label="Previous day">
              <IconChevronLeft />
            </Link>
            <Link href={`/app/calendar?date=${shiftDateKey(date, 1)}`} className="sl-btn sl-btn--dash sl-d-icb" aria-label="Next day">
              <IconChevronRight />
            </Link>
            <ButtonLink href={`/app/calendar?date=${today}`} size="dashboard">Today</ButtonLink>
          </div>
        </div>
        <div className="sl-d-acts">
          <ButtonLink href="/app/bookings?new=1" variant="primary" size="dashPrimary">
            <IconPlus />New booking
          </ButtonLink>
        </div>
      </div>

      <div className="sl-d-card sl-d-scroll">
        <div className="sl-d-cal">
          <div className="sl-d-cal__heads">
            <span />
            {staff.map((s, i) => (
              <div className="sl-d-cal__head" key={s.id}>
                <span className={`sl-d-mono${awayByStaff[s.id] ? " sl-d-mono--off" : ""}`} aria-hidden="true">{s.name.charAt(0)}</span>
                <span>
                  <b style={awayByStaff[s.id] ? { color: "var(--ink-2)" } : undefined}>{s.name}</b>
                  <span className="sl-d-sub">{awayByStaff[s.id] ? "Away" : `${counts[i]} bookings`}</span>
                </span>
              </div>
            ))}
            {staff.length === 0 ? (
              <div className="sl-d-cal__head"><span>No active staff yet — add staff in Availability.</span></div>
            ) : null}
          </div>

          <div className="sl-d-cal__grid" style={{ minHeight: gridHeight }}>
            <div className="sl-d-cal__lines" aria-hidden="true">
              {hours.map((h, i) => (
                <i key={h} style={{ top: i * 96 }} />
              ))}
            </div>
            {nowTop !== null && nowLabel ? (
              <div className="sl-d-cal__now" style={{ top: nowTop }} role="img" aria-label={`Now, ${nowLabel}`} />
            ) : null}

            <div className="sl-d-cal__times" aria-hidden="true">
              {hours.map((h, i) => (
                <span key={h} style={{ top: i * 96 - 8 }}>{hourLabel(h)}</span>
              ))}
            </div>

            {staff.map((s) => (
              <div className="sl-d-cal__col" key={s.id}>
                {awayByStaff[s.id] ? (
                  <div className="sl-d-away-block sl-d-hatch">
                    <span>{awayByStaff[s.id]}</span>
                  </div>
                ) : (
                  dayBookings
                    .filter((x) => x.staffId === s.id)
                    .map((x) => {
                      const short = x.endMinutes - x.startMinutes <= 25;
                      const inWindow =
                        nowMinutes !== null && x.startMinutes <= nowMinutes && nowMinutes < x.endMinutes && x.dbStatus === "confirmed";
                      return (
                        <Link
                          key={x.id}
                          href={`/app/bookings?booking=${x.id}`}
                          className={blockClass(x, inWindow)}
                          style={{ top: topFor(x.startMinutes), height: Math.max(21, (x.endMinutes - x.startMinutes) * PX_PER_MIN - 3) }}
                          aria-label={blockLabel(x)}
                        >
                          {short ? (
                            <b>{x.customerName} · {x.serviceName}</b>
                          ) : (
                            <>
                              <b>{x.customerName}</b>
                              <span>{x.startLabel.replace(/ [AP]M$/, "")} · {x.serviceName}</span>
                            </>
                          )}
                        </Link>
                      );
                    })
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
