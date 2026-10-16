"use client";
/* D-01 Today — 60px display date, 4 KPI cards, Up next run sheet,
   last-week chart (dark panel), Needs you (hold panel). */
import Link from "next/link";
import { Button, ButtonLink } from "@/components/sl/Button";
import { StatusPill } from "@/components/sl/StatusPill";
import { IconCalendar, IconPerson, IconPlus } from "@/components/sl/icons";
import { actionForStatus } from "@/components/sl/RunSheetRow";
import { dashboard, formatWholeDollars, getDashboardTotals } from "@/lib/api";
import { upNext, useDashboard } from "./DashboardContext";
import { IconArrowRight14 } from "./ui";

export default function TodayPage() {
  const { bookings, advance } = useDashboard();
  const totals = getDashboardTotals(bookings);
  const kpis = dashboard.kpis;
  const done = bookings.filter((b) => b.status === "Done").length;
  const inChair = bookings.filter((b) => b.status === "In the chair").length;
  const waiting = bookings.filter((b) => b.status === "Arrived").length;
  const rows = upNext(bookings);
  const shown = rows.slice(0, 7);
  const rest = rows.slice(7);
  const last = [...bookings].sort((a, b) => b.start24.localeCompare(a.start24))[0];
  const chartLabel =
    `Last week booked share of bookable chair time, ${kpis.lastWeekRangeLabel}: ` +
    kpis.lastWeekDaily.map((d) => `${d.day} ${d.percent}%`).join(", ") + ".";

  return (
    <>
      <div className="sl-d-hd">
        <div>
          <h1 className="sl-d-h1">Thursday, October 8</h1>
          <p className="sl-d-meta">
            <span className="sl-d-avatars" aria-hidden="true">
              <span><span className="sl-d-mono">M</span></span>
              <span><span className="sl-d-mono">N</span></span>
              <span><span className="sl-d-mono sl-d-mono--off">A</span></span>
            </span>
            10:40 AM · Micah and Nia working · Andre away until Oct 20
          </p>
        </div>
        <div className="sl-d-acts">
          <ButtonLink href="/app/calendar" size="dashboard">Block time</ButtonLink>
          <ButtonLink href="/app/bookings?new=1" variant="primary" size="dashPrimary">
            <IconPlus />New booking
          </ButtonLink>
        </div>
      </div>

      <div className="sl-d-kpis">
        <div className="sl-d-kpi">
          <span className="k">Bookings today</span>
          <b>{totals.count}</b>
          <span className="sl-d-bar" aria-hidden="true">
            <i className="k" /><i className="k" /><i className="x" /><i className="o" />
            {Array.from({ length: 10 }).map((_, i) => <i key={i} />)}
          </span>
          <small>{done} done · {inChair} in the chair · {waiting} waiting</small>
        </div>
        <div className="sl-d-kpi">
          <span className="k">Utilization, last week</span>
          <b>{`${kpis.lastWeekPercent}%`}</b>
          <span className="sl-d-meter" aria-hidden="true"><i style={{ width: `${kpis.todayPercent}%` }} /></span>
          <small>Today: {kpis.todayPercent}% of chair time booked</small>
        </div>
        <div className="sl-d-kpi">
          <span className="k">Booked revenue today</span>
          <b>{totals.bookedLabel}</b>
          <span className="sl-d-meter" aria-hidden="true">
            <i style={{ width: `${(totals.depositsCents / Math.max(1, totals.bookedCents)) * 100}%`, background: "var(--oxblood)" }} />
          </span>
          <small>{totals.depositsLabel} in deposits collected</small>
        </div>
        <div className="sl-d-kpi sl-d-kpi--dark">
          <span className="k">Next opening</span>
          <b>{kpis.nextOpening.time}</b>
          <span className="sl-d-bar" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, i) => (
              <i key={i} style={{ background: i < 3 ? "#b9dca5" : "#4a3631" }} />
            ))}
          </span>
          <small style={{ color: "#b9dca5", fontWeight: 600 }}>{kpis.nextOpening.label}</small>
        </div>
      </div>

      <div className="sl-d-today-grid">
        <section className="sl-d-card" aria-labelledby="run" style={{ overflow: "hidden" }}>
          <div className="sl-d-card-head">
            <h2 id="run">Up next</h2>
            <ButtonLink href="/app/bookings" size="sm">
              All {totals.count} bookings<IconArrowRight14 />
            </ButtonLink>
          </div>
          <div className="sl-d-scroll">
            <table className="sl-d-tbl sl-d-tbl--tight">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Time</th><th>Customer</th><th>Service</th><th>Status</th>
                  <th className="r" style={{ width: 100 }}><span className="sl-d-sr">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((b) => {
                  const action = actionForStatus(b.status);
                  return (
                    <tr key={b.id}>
                      <td className="sl-d-tm">{b.start}</td>
                      <td>
                        <span className="sl-d-who">
                          <span className="sl-d-mono" aria-hidden="true">{b.customer.charAt(0)}</span>
                          <Link href={`/app/bookings?booking=${b.id}`}>{b.customer}</Link>
                        </span>
                      </td>
                      <td>{b.service}<span className="sl-d-sub">{b.barber}</span></td>
                      <td>
                        <StatusPill status={b.status} />
                      </td>
                      <td className="r">
                        {action ? (
                          <Button
                            size="sm"
                            variant={b.status === "Upcoming" || b.status === "Confirmed" ? "outline" : "primary"}
                            onClick={() => advance(b.id)}
                          >
                            {action}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rest.length > 0 && last ? (
            <p className="sl-d-foot" style={{ paddingLeft: 22, paddingRight: 22 }}>
              {`${rest.length} more from ${rest[0]!.start} · last appointment ${last.start} with ${last.barber}`}
            </p>
          ) : null}
        </section>

        <div className="sl-d-side-stack">
          <section className="sl-d-ink" aria-labelledby="wk" style={{ padding: 26 }}>
            <h2 id="wk" style={{ margin: 0, font: "600 28px/1.15 var(--font-display)", letterSpacing: "-.02em" }}>Last week</h2>
            <p style={{ margin: "6px 0 20px", fontSize: 14, color: "#cdb8ae" }}>
              Booked share of bookable chair time, {kpis.lastWeekRangeLabel}
            </p>
            <div className="sl-d-chart" role="img" aria-label={chartLabel}>
              {kpis.lastWeekDaily.map((d) => {
                const low = d.percent <= 50;
                const height = Math.round((d.bookedMinutes / d.bookableMinutes) * 120);
                return (
                  <div className="sl-d-chart__col" key={d.day} aria-hidden="true">
                    <span className={`sl-d-chart__pct${low ? " sl-d-chart__pct--low" : ""}`}>{d.percent}%</span>
                    <div className="sl-d-chart__track">
                      <div className={`sl-d-chart__fill${low ? " sl-d-chart__fill--low" : ""}`} style={{ height }} />
                    </div>
                    <span className="sl-d-chart__day">{d.day}</span>
                  </div>
                );
              })}
            </div>
            <p style={{ margin: "20px 0 0", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.1)", fontSize: 14, color: "#e6d9d1" }}>
              {kpis.lastWeekNote}
            </p>
          </section>

          <section className="sl-d-hold-panel" aria-labelledby="att" style={{ padding: 22 }}>
            <h2 id="att" style={{ margin: "0 0 14px", font: "600 24px/1.15 var(--font-display)", letterSpacing: "-.02em" }}>Needs you</h2>
            <ul className="sl-d-needs">
              {dashboard.needsYou.map((item) => (
                <li key={item.id}>
                  <span className="sl-d-needs__ic" aria-hidden="true">
                    {item.id === "ny-invite" ? <IconPerson width={16} height={16} /> : <IconCalendar width={16} height={16} />}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <b style={{ fontWeight: 600 }}>{item.title}</b>
                    <span className="sl-d-sub" style={{ color: "var(--ink-2)" }}>
                      {item.detail}
                      {item.actionLabel ? <> · <Link href="/app/staff" style={{ fontWeight: 600 }}>{item.actionLabel}</Link></> : null}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
      <p className="sl-d-sr">Booked revenue today {formatWholeDollars(totals.bookedCents)} in total.</p>
    </>
  );
}
