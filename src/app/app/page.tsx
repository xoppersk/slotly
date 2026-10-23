/* D-01 Today — real bookings for today in the business timezone, real
   header stats, real run sheet. KPI math: booked minutes from real
   booking rows; bookable minutes from availability rules; deposits
   from succeeded payments when they exist, otherwise deposits due at
   the visit (labelled honestly — no fabricated "collected"). */
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";

import { ButtonLink } from "@/components/sl/Button";
import { StatusPill } from "@/components/sl/StatusPill";
import { IconCalendar, IconPerson, IconPlus } from "@/components/sl/icons";
import {
  listAvailabilityOverrides,
  listAvailabilityRules,
  listBlackoutDates,
  listStaffAdmin,
  listTimeOff,
} from "@/lib/db/owner";
import { createClient } from "@/lib/supabase/server";

import { BookingStatusButton } from "./BookingActions";
import { getDashboardContext, loadBookings } from "./_lib/data";
import { bookableMinutes, findNextOpening, type AvailData } from "./_lib/availability-math";
import {
  dateTitle,
  dayBoundsIso,
  firstName,
  initialsOf,
  LIVE_STATUSES,
  shiftDateKey,
  todayKey,
  wholeDollars,
  type DashBooking,
} from "./_lib/model";
import { IconArrowRight14 } from "./ui";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const ctx = await getDashboardContext();
  if (!ctx) redirect("/onboarding");
  const { business } = ctx;
  // Onboarding success state: /app?welcome=<slug> (set by the onboarding
  // action) — only honoured when it names the ACTIVE business's own page.
  const welcomeSlug = welcome && welcome === business.slug ? welcome : null;
  const tz = business.timezone;
  const today = todayKey(tz);
  const now = new Date();
  const { fromIso, toIso } = dayBoundsIso(today, tz);
  const weekAgo = dayBoundsIso(shiftDateKey(today, -7), tz).fromIso;
  // Load through +15 days so findNextOpening checks real future bookings.
  const horizonIso = dayBoundsIso(shiftDateKey(today, 15), tz).fromIso;

  const supabase = await createClient();
  const [bundle, staff, rules, overrides, blackouts, timeOffApproved, invitesRes] = await Promise.all([
    loadBookings(business, { fromIso: weekAgo, toIso: horizonIso }),
    listStaffAdmin(supabase, business.id),
    listAvailabilityRules(supabase, business.id),
    listAvailabilityOverrides(supabase, business.id),
    listBlackoutDates(supabase, business.id),
    listTimeOff(supabase, business.id, "approved"),
    supabase
      .from("staff_invites")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .is("accepted_at", null)
      .gt("expires_at", now.toISOString()),
  ]);
  const avail: AvailData = { rules, overrides, blackouts, timeOff: timeOffApproved };
  const activeStaff = staff.filter((s) => s.is_active);

  const allWeek = bundle.bookings;
  const todays = allWeek.filter((b) => b.dateKey === today);
  const live = todays.filter((b) => b.dbStatus !== "cancelled");
  const done = todays.filter((b) => b.dbStatus === "completed");
  const toCome = todays.filter((b) => LIVE_STATUSES.includes(b.dbStatus));
  const pendingCount = todays.filter((b) => b.dbStatus === "pending").length;

  const bookedCents = live.reduce((s, b) => s + b.priceCents, 0);
  const paidCents = todays.reduce((s, b) => s + b.depositPaidCents, 0);
  const depositsDueCents = live
    .filter((b) => b.dbStatus !== "completed")
    .reduce((s, b) => s + Math.max(0, b.depositCents - b.depositPaidCents), 0);
  const hasPayments = paidCents > 0;

  const bookedMinutesToday = live.reduce((s, b) => s + (b.endMinutes - b.startMinutes), 0);
  const bookableToday = bookableMinutes(activeStaff, today, business, avail);
  const todayPercent = bookableToday > 0 ? Math.round((bookedMinutesToday / bookableToday) * 100) : 0;

  // Last week = the 7 days ending yesterday, real rows only.
  const lastWeekDays = Array.from({ length: 7 }, (_, i) => {
    const key = shiftDateKey(today, i - 7);
    const dayBookings = allWeek.filter(
      (b) => b.dateKey === key && b.dbStatus !== "cancelled" && b.dbStatus !== "no_show",
    );
    const booked = dayBookings.reduce((s, b) => s + (b.endMinutes - b.startMinutes), 0);
    const bookable = bookableMinutes(activeStaff, key, business, avail);
    return {
      key,
      day: new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" }),
      bookedMinutes: booked,
      bookableMinutes: bookable,
      percent: bookable > 0 ? Math.round((booked / bookable) * 100) : 0,
    };
  });
  const lwBooked = lastWeekDays.reduce((s, d) => s + d.bookedMinutes, 0);
  const lwBookable = lastWeekDays.reduce((s, d) => s + d.bookableMinutes, 0);
  const lastWeekPercent = lwBookable > 0 ? Math.round((lwBooked / lwBookable) * 100) : 0;
  const lwRange = `${new Date(`${lastWeekDays[0]!.key}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${new Date(`${lastWeekDays[6]!.key}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
  const chartLabel =
    `Last week booked share of bookable chair time, ${lwRange}: ` +
    lastWeekDays.map((d) => `${d.day} ${d.percent}%`).join(", ") + ".";

  // Run sheet: still-to-come first by time, then pending, then done.
  const rank = (b: DashBooking) =>
    b.dbStatus === "confirmed" ? 0 : b.dbStatus === "pending" || b.dbStatus.startsWith("payment") ? 1 : b.dbStatus === "completed" ? 3 : 2;
  const rows = [...todays]
    .filter((b) => b.dbStatus !== "cancelled" && b.dbStatus !== "no_show")
    .sort((a, b) => rank(a) - rank(b) || a.startMinutes - b.startMinutes);
  const shown = rows.slice(0, 7);
  const rest = rows.slice(7);
  const last = [...todays].sort((a, b) => b.startMinutes - a.startMinutes)[0];

  const nextOpening = findNextOpening(business, activeStaff, avail, allWeek, today, now);

  // Working / away today, from approved time off overlapping today.
  const awayIds = new Set(
    timeOffApproved
      .filter((t) => new Date(t.starts_at) < new Date(toIso) && new Date(t.ends_at) > new Date(fromIso))
      .map((t) => t.staff_id),
  );
  const working = activeStaff.filter((s) => !awayIds.has(s.id));
  const away = activeStaff.filter((s) => awayIds.has(s.id));
  const metaLine = [
    formatInTimeZone(now, tz, "h:mm a"),
    working.length > 0 ? `${working.map((s) => firstName(s.name)).join(" and ")} working` : "Nobody scheduled",
    away.length > 0 ? `${away.map((s) => firstName(s.name)).join(", ")} away` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const { count: pendingTimeOffCount } = await supabase
    .from("staff_time_off")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id)
    .eq("status", "pending");
  const needsYou: { id: string; title: string; detail: string; href: string; actionLabel?: string }[] = [];
  if (pendingCount > 0) {
    needsYou.push({
      id: "ny-pending",
      title: `${pendingCount} booking${pendingCount === 1 ? "" : "s"} awaiting confirmation`,
      detail: "Booked outside the instant-confirm flow",
      href: "/app/bookings",
      actionLabel: "Review",
    });
  }
  if ((pendingTimeOffCount ?? 0) > 0) {
    needsYou.push({
      id: "ny-timeoff",
      title: `${pendingTimeOffCount} time-off request${pendingTimeOffCount === 1 ? "" : "s"} to review`,
      detail: "Staff are waiting on your answer",
      href: "/app/availability",
      actionLabel: "Review",
    });
  }
  if ((invitesRes.count ?? 0) > 0) {
    needsYou.push({
      id: "ny-invite",
      title: `${invitesRes.count} invite${invitesRes.count === 1 ? "" : "s"} pending`,
      detail: "Sent but not accepted yet",
      href: "/app/staff",
      actionLabel: "View staff",
    });
  }

  return (
    <>
      <div className="sl-d-hd">
        <div>
          <h1 className="sl-d-h1">{dateTitle(today)}</h1>
          <p className="sl-d-meta">
            <span className="sl-d-avatars" aria-hidden="true">
              {activeStaff.map((s) => (
                <span key={s.id}>
                  <span className={`sl-d-mono${awayIds.has(s.id) ? " sl-d-mono--off" : ""}`}>{initialsOf(s.name).charAt(0)}</span>
                </span>
              ))}
            </span>
            {metaLine}
          </p>
        </div>
        <div className="sl-d-acts">
          <ButtonLink href="/app/calendar" size="dashboard">Block time</ButtonLink>
          <ButtonLink href="/app/bookings?new=1" variant="primary" size="dashPrimary">
            <IconPlus />New booking
          </ButtonLink>
        </div>
      </div>

      {welcomeSlug ? (
        <div
          className="sl-card"
          role="status"
          style={{
            padding: 20,
            marginBottom: 20,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <p style={{ margin: 0 }}>
            <b>Your booking page is live.</b> Share it with your customers:{" "}
            <Link href={`/b/${welcomeSlug}`}>/b/{welcomeSlug}</Link>
          </p>
          <ButtonLink href={`/b/${welcomeSlug}`} size="dashboard">
            View your booking page
          </ButtonLink>
        </div>
      ) : null}

      <div className="sl-d-kpis">
        <div className="sl-d-kpi">
          <span className="k">Bookings today</span>
          <b>{live.length}</b>
          <span className="sl-d-bar" aria-hidden="true">
            <i className="k" /><i className="k" /><i className="x" /><i className="o" />
            {Array.from({ length: 10 }).map((_, i) => <i key={i} />)}
          </span>
          <small>{done.length} done · {toCome.length} still to come{pendingCount > 0 ? ` · ${pendingCount} pending` : ""}</small>
        </div>
        <div className="sl-d-kpi">
          <span className="k">Utilization, last week</span>
          <b>{`${lastWeekPercent}%`}</b>
          <span className="sl-d-meter" aria-hidden="true"><i style={{ width: `${todayPercent}%` }} /></span>
          <small>Today: {todayPercent}% of chair time booked</small>
        </div>
        <div className="sl-d-kpi">
          <span className="k">Booked revenue today</span>
          <b>{wholeDollars(bookedCents)}</b>
          <span className="sl-d-meter" aria-hidden="true">
            <i style={{ width: `${bookedCents > 0 ? ((hasPayments ? paidCents : depositsDueCents) / bookedCents) * 100 : 0}%`, background: "var(--oxblood)" }} />
          </span>
          <small>
            {hasPayments
              ? `${wholeDollars(paidCents)} in deposits collected`
              : depositsDueCents > 0
                ? `${wholeDollars(depositsDueCents)} in deposits due at the visit`
                : "No deposits on today's bookings"}
          </small>
        </div>
        <div className="sl-d-kpi sl-d-kpi--dark">
          <span className="k">Next opening</span>
          <b>{nextOpening ? nextOpening.timeLabel : "—"}</b>
          <span className="sl-d-bar" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, i) => (
              <i key={i} style={{ background: i < 3 ? "#b9dca5" : "#4a3631" }} />
            ))}
          </span>
          <small style={{ color: "#b9dca5", fontWeight: 600 }}>
            {nextOpening ? `${nextOpening.whenLabel} · with ${firstName(nextOpening.staffName)}` : "Nothing open in the next two weeks"}
          </small>
        </div>
      </div>

      <div className="sl-d-today-grid">
        <section className="sl-d-card" aria-labelledby="run" style={{ overflow: "hidden" }}>
          <div className="sl-d-card-head">
            <h2 id="run">Up next</h2>
            <ButtonLink href="/app/bookings" size="sm">
              All {live.length} bookings<IconArrowRight14 />
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
                {shown.map((b) => (
                  <tr key={b.id}>
                    <td className="sl-d-tm">{b.startLabel}</td>
                    <td>
                      <span className="sl-d-who">
                        <span className="sl-d-mono" aria-hidden="true">{b.customerName.charAt(0)}</span>
                        <Link href={`/app/bookings?booking=${b.id}`}>{b.customerName}</Link>
                      </span>
                    </td>
                    <td>{b.serviceName}<span className="sl-d-sub">{b.staffName}</span></td>
                    <td>
                      <StatusPill status={b.pill} label={b.pillLabel} />
                    </td>
                    <td className="r">
                      <BookingStatusButton bookingId={b.id} status={b.dbStatus} />
                    </td>
                  </tr>
                ))}
                {shown.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: "28px 20px", color: "var(--muted)" }}>No bookings today yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {rest.length > 0 && last ? (
            <p className="sl-d-foot" style={{ paddingLeft: 22, paddingRight: 22 }}>
              {`${rest.length} more from ${rest[0]!.startLabel} · last appointment ${last.startLabel} with ${last.staffName}`}
            </p>
          ) : null}
        </section>

        <div className="sl-d-side-stack">
          <section className="sl-d-ink" aria-labelledby="wk" style={{ padding: 26 }}>
            <h2 id="wk" style={{ margin: 0, font: "600 28px/1.15 var(--font-display)", letterSpacing: "-.02em" }}>Last week</h2>
            <p style={{ margin: "6px 0 20px", fontSize: 14, color: "#cdb8ae" }}>
              Booked share of bookable chair time, {lwRange}
            </p>
            <div className="sl-d-chart" role="img" aria-label={chartLabel}>
              {lastWeekDays.map((d) => {
                const low = d.percent <= 50;
                const height = d.bookableMinutes > 0 ? Math.round((d.bookedMinutes / d.bookableMinutes) * 120) : 0;
                return (
                  <div className="sl-d-chart__col" key={d.key} aria-hidden="true">
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
              {lwBookable > 0
                ? `${Math.round(lwBooked / 60)} of ${Math.round(lwBookable / 60)} bookable hours were booked last week.`
                : "No bookable hours were set last week — add weekly hours in Availability."}
            </p>
          </section>

          <section className="sl-d-hold-panel" aria-labelledby="att" style={{ padding: 22 }}>
            <h2 id="att" style={{ margin: "0 0 14px", font: "600 24px/1.15 var(--font-display)", letterSpacing: "-.02em" }}>Needs you</h2>
            {needsYou.length > 0 ? (
              <ul className="sl-d-needs">
                {needsYou.map((item) => (
                  <li key={item.id}>
                    <span className="sl-d-needs__ic" aria-hidden="true">
                      {item.id === "ny-invite" ? <IconPerson width={16} height={16} /> : <IconCalendar width={16} height={16} />}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <b style={{ fontWeight: 600 }}>{item.title}</b>
                      <span className="sl-d-sub" style={{ color: "var(--ink-2)" }}>
                        {item.detail}
                        {item.actionLabel ? <> · <Link href={item.href} style={{ fontWeight: 600 }}>{item.actionLabel}</Link></> : null}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink-2)" }}>Nothing needs you right now.</p>
            )}
          </section>
        </div>
      </div>
      <p className="sl-d-sr">Booked revenue today {wholeDollars(bookedCents)} in total.</p>
    </>
  );
}
