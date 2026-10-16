"use client";
/* D-04 Calendar day view — 96px per hour, 9 AM–6 PM, one column per
   barber, oxblood now-line at 10:40, Micah's 1:45–2:15 break hatched,
   the 2:15 PM opening, Andre's time off. Every block is a link with
   full accessible text. The date lives in the URL (?date=). */
import Link from "next/link";
import { ButtonLink } from "@/components/sl/Button";
import { IconPlus } from "@/components/sl/icons";
import { DASHBOARD_NOW, getBarbers } from "@/lib/api";
import type { Booking } from "@/lib/types";
import { useDashboard } from "../DashboardContext";
import { IconChevronLeft, IconChevronRight } from "../ui";

const DAY_START = 9 * 60; // 9:00 AM in minutes
const PX_PER_MIN = 96 / 60;

function minutes(t24: string): number {
  const [h, m] = t24.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
function topFor(t24: string): number {
  return (minutes(t24) - DAY_START) * PX_PER_MIN;
}
function heightFor(b: Booking): number {
  return Math.max(21, (minutes(b.end24) - minutes(b.start24)) * PX_PER_MIN - 3);
}
function blockClass(b: Booking): string {
  const base =
    b.status === "Done" ? " sl-d-block--done"
    : b.status === "In the chair" ? " sl-d-block--chair"
    : b.status === "Arrived" ? " sl-d-block--arrived"
    : "";
  const short = minutes(b.end24) - minutes(b.start24) <= 25 ? " sl-d-block--short" : "";
  return `sl-d-block${base}${short}`;
}
function blockLabel(b: Booking): string {
  return `${b.customer}, ${b.start} to ${b.end}, ${b.service}, ${b.status}`;
}

const HOURS = ["9 AM", "10", "11", "12 PM", "1", "2", "3", "4", "5"];

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function dateTitle(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

export function CalendarClient({ date }: { date: string }) {
  const { bookings } = useDashboard();
  const barbers = getBarbers();
  const isCanon = date === DASHBOARD_NOW.date;
  const dayBookings = isCanon ? bookings : [];
  const counts = barbers.map((b) => dayBookings.filter((x) => x.barberId === b.id).length);
  const total = dayBookings.length;
  const nowTop = 14 + (10 * 60 + 40 - DAY_START) * PX_PER_MIN;

  return (
    <>
      <div className="sl-d-hd">
        <div>
          <p className="sl-d-eyb">Day view · {total} bookings</p>
          <h1 className="sl-d-h1">{dateTitle(date)}</h1>
          <div className="sl-d-meta" style={{ gap: 8 }}>
            <Link href={`/app/calendar?date=${shiftDate(date, -1)}`} className="sl-btn sl-btn--dash sl-d-icb" aria-label="Previous day">
              <IconChevronLeft />
            </Link>
            <Link href={`/app/calendar?date=${shiftDate(date, 1)}`} className="sl-btn sl-btn--dash sl-d-icb" aria-label="Next day">
              <IconChevronRight />
            </Link>
            <ButtonLink href="/app/calendar" size="dashboard">Today</ButtonLink>
          </div>
        </div>
        <div className="sl-d-acts">
          <div className="sl-d-seg" role="navigation" aria-label="Calendar views">
            <a href="/app/calendar" aria-current="page">Day</a>
            <a href="/app/calendar">Week</a>
          </div>
          <ButtonLink href="/app/calendar" size="dashboard">Block time</ButtonLink>
          <ButtonLink href="/app/bookings?new=1" variant="primary" size="dashPrimary">
            <IconPlus />New booking
          </ButtonLink>
        </div>
      </div>

      <div className="sl-d-card sl-d-scroll">
        <div className="sl-d-cal">
          <div className="sl-d-cal__heads">
            <span />
            {barbers.map((b, i) => (
              <div className="sl-d-cal__head" key={b.id}>
                <span className={`sl-d-mono${b.status === "Away" ? " sl-d-mono--off" : ""}`} aria-hidden="true">{b.initial}</span>
                <span>
                  <b style={b.status === "Away" ? { color: "var(--ink-2)" } : undefined}>{b.name}</b>
                  <span className="sl-d-sub">{b.status === "Away" ? "Away" : `${counts[i]} bookings · 9–6`}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="sl-d-cal__grid">
            <div className="sl-d-cal__lines" aria-hidden="true">
              {Array.from({ length: 10 }).map((_, i) => (
                <i key={i} style={{ top: i * 96 }} />
              ))}
            </div>
            {isCanon ? (
              <div className="sl-d-cal__now" style={{ top: nowTop }} role="img" aria-label="Now, 10:40 AM" />
            ) : null}

            <div className="sl-d-cal__times" aria-hidden="true">
              {HOURS.map((h, i) => (
                <span key={h} style={{ top: i * 96 - 8 }}>{h}</span>
              ))}
            </div>

            {barbers.map((b) => (
              <div className="sl-d-cal__col" key={b.id}>
                {b.status === "Away" ? (
                  <div className="sl-d-away-block sl-d-hatch">
                    <span>Time off until Oct 20</span>
                  </div>
                ) : (
                  <>
                    {b.break && isCanon ? (
                      <div
                        className="sl-d-break sl-d-hatch"
                        style={{ top: topFor(b.break.start24), height: Math.max(21, (minutes(b.break.end24) - minutes(b.break.start24)) * PX_PER_MIN - 3) }}
                      >
                        Break
                      </div>
                    ) : null}
                    {b.id === "micah" && isCanon ? (
                      <Link
                        href="/app/bookings?new=1"
                        className="sl-d-open-block"
                        style={{ top: topFor("14:15"), height: 69 }}
                        aria-label="Open, book 2:15 PM with Micah"
                      >
                        Open · book 2:15
                      </Link>
                    ) : null}
                    {dayBookings
                      .filter((x) => x.barberId === b.id)
                      .map((x) => {
                        const short = minutes(x.end24) - minutes(x.start24) <= 25;
                        return (
                          <Link
                            key={x.id}
                            href={`/app/bookings?booking=${x.id}`}
                            className={blockClass(x)}
                            style={{ top: topFor(x.start24), height: heightFor(x) }}
                            aria-label={blockLabel(x)}
                          >
                            {short ? (
                              <b>{x.customer} · {x.service}</b>
                            ) : (
                              <>
                                <b>{x.customer}</b>
                                <span>{x.start.replace(/ [AP]M$/, "")} · {x.service}</span>
                              </>
                            )}
                          </Link>
                        );
                      })}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
