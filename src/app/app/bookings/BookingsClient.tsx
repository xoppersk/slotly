"use client";
/* D-02 Bookings — totals band, Today/Upcoming/Past/Cancelled tabs,
   search + staff + status filters (all living in the URL), the table,
   the D-03 drawer (?booking=[id]) and the on-behalf drawer (?new=1).
   Data is real (server-fetched); filters run over the real rows. */
import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ButtonLink } from "@/components/sl/Button";
import { StatusPill } from "@/components/sl/StatusPill";
import { IconPlus } from "@/components/sl/icons";
import { dateShort, LIVE_STATUSES, wholeDollars, type DashBooking } from "../_lib/model";
import { IconSearch, timeLabel, toLabel } from "../ui";
import { BookingDrawer } from "./BookingDrawer";
import { NewBookingDrawer, type NewBookingCustomer, type NewBookingService } from "./NewBookingDrawer";

export interface BookingsQuery {
  view: string;
  q: string;
  barber: string;
  status: string;
  booking: string;
  isNew: boolean;
}

export interface TodayTotals {
  count: number;
  bookedCents: number;
  depositsCents: number;
  toCollectCents: number;
}

const VIEWS = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
] as const;

const STATUSES = ["Pending", "Confirmed", "Done", "No-show", "Cancelled"] as const;

export function BookingsClient({
  query,
  bookings,
  today,
  todayTotals,
  staffOptions,
  services,
  customers,
}: {
  query: BookingsQuery;
  bookings: DashBooking[];
  today: string;
  todayTotals: TodayTotals;
  staffOptions: { id: string; name: string }[];
  services: NewBookingService[];
  customers: NewBookingCustomer[];
}) {
  const router = useRouter();
  const nowIso = useMemo(() => new Date().toISOString(), []);

  const update = (patch: Partial<BookingsQuery>) => {
    const next = { ...query, ...patch };
    const params = new URLSearchParams();
    if (next.view !== "today") params.set("view", next.view);
    if (next.q) params.set("q", next.q);
    if (next.barber) params.set("barber", next.barber);
    if (next.status) params.set("status", next.status);
    if (next.booking) params.set("booking", next.booking);
    if (next.isNew) params.set("new", "1");
    const qs = params.toString();
    router.replace(qs ? `/app/bookings?${qs}` : "/app/bookings", { scroll: false });
  };

  const rows = useMemo(() => {
    let list = [...bookings].sort((a, b) => a.startsAtIso.localeCompare(b.startsAtIso));
    if (query.view === "today") list = list.filter((b) => b.dateKey === today && b.dbStatus !== "cancelled");
    if (query.view === "upcoming") {
      list = list.filter((b) => b.startsAtIso >= nowIso && LIVE_STATUSES.includes(b.dbStatus));
    }
    if (query.view === "past") list = list.filter((b) => b.dbStatus === "completed" || b.dbStatus === "no_show");
    if (query.view === "cancelled") list = list.filter((b) => b.dbStatus === "cancelled");
    if (query.barber) list = list.filter((b) => b.staffId === query.barber);
    if (query.status) list = list.filter((b) => b.pill === query.status);
    const q = query.q.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (b) =>
          b.customerName.toLowerCase().includes(q) ||
          b.code.toLowerCase().includes(q) ||
          b.customerPhone.includes(q) ||
          b.customerEmail.toLowerCase().includes(q),
      );
    }
    return list;
  }, [bookings, query, today, nowIso]);

  const totals = todayTotals;
  const selected = query.booking ? bookings.find((b) => b.id === query.booking) : undefined;
  const selectedLastVisit = useMemo(() => {
    if (!selected) return undefined;
    const prior = bookings
      .filter((x) => x.customerId === selected.customerId && x.dbStatus === "completed" && x.id !== selected.id)
      .sort((a, b) => b.startsAtIso.localeCompare(a.startsAtIso))[0];
    return prior ? dateShort(prior.dateKey) : undefined;
  }, [bookings, selected]);

  return (
    <>
      <div className="sl-d-hd">
        <div>
          <p className="sl-d-eyb">{dateShort(today)}</p>
          <h1 className="sl-d-h1">Bookings</h1>
        </div>
        <div className="sl-d-acts">
          <ButtonLink href="/app/bookings?new=1" variant="primary" size="dashPrimary">
            <IconPlus />New booking
          </ButtonLink>
        </div>
      </div>

      <div className="sl-d-ink sl-d-totals" aria-label="Today’s totals">
        <div className="sl-d-totals__cell"><b>{totals.count}</b><span>bookings</span></div>
        <div className="sl-d-totals__cell"><b>{wholeDollars(totals.bookedCents)}</b><span>booked</span></div>
        <div className="sl-d-totals__cell"><b>{wholeDollars(totals.depositsCents)}</b><span>in deposits</span></div>
        <div className="sl-d-totals__cell"><b>{wholeDollars(totals.toCollectCents)}</b><span>to collect at the shop</span></div>
      </div>

      <div className="sl-d-tools">
        <div className="sl-d-seg" role="navigation" aria-label="Booking views">
          {VIEWS.map((v) => (
            <a
              key={v.key}
              href={v.key === "today" ? "/app/bookings" : `/app/bookings?view=${v.key}`}
              aria-current={query.view === v.key ? "page" : undefined}
              onClick={(e) => { e.preventDefault(); update({ view: v.key }); }}
            >
              {v.label}
              {v.key === "today" ? <span>{totals.count}</span> : null}
            </a>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <label className="sl-d-srch">
          <span className="sl-d-sr">Search bookings</span>
          <IconSearch />
          <input
            className="sl-d-inp"
            placeholder="Search customer, phone or booking ID"
            value={query.q}
            onChange={(e) => update({ q: e.target.value })}
          />
        </label>
        <label>
          <span className="sl-d-sr">Staff</span>
          <select className="sl-d-sel" value={query.barber} onChange={(e) => update({ barber: e.target.value })}>
            <option value="">All staff</option>
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sl-d-sr">Status</span>
          <select className="sl-d-sel" value={query.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">Any status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <div className="sl-d-card sl-d-scroll">
        <table className="sl-d-tbl" style={{ minWidth: 760 }}>
          <thead>
            <tr><th>Time</th><th>Customer</th><th>Service</th><th>Staff</th><th className="r">Price</th><th>Deposit</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className={b.dbStatus === "completed" ? "sl-d-past" : b.id === query.booking ? "sl-d-pick" : undefined}>
                <td className="sl-d-tm">
                  {timeLabel(b.start24)}
                  <span className="sl-d-sub">{toLabel(b.end24)}</span>
                  {b.dateKey !== today ? <span className="sl-d-sub">{dateShort(b.dateKey)}</span> : null}
                </td>
                <td>
                  <span className="sl-d-who">
                    <span className={`sl-d-mono${b.dbStatus === "completed" ? " sl-d-mono--off" : ""}`} aria-hidden="true">{b.customerName.charAt(0)}</span>
                    <Link href={`/app/bookings?booking=${b.id}`}>{b.customerName}</Link>
                  </span>
                </td>
                <td>{b.serviceName}</td>
                <td>{b.staffName}</td>
                <td className="r" style={{ fontWeight: 600 }}>{wholeDollars(b.priceCents)}</td>
                <td>{b.depositCents > 0 ? `${wholeDollars(b.depositCents)} ${b.depositPaidCents > 0 ? "paid" : "due"}` : "No deposit"}</td>
                <td><StatusPill status={b.pill} label={b.pillLabel} /></td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: "28px 20px", color: "var(--muted)" }}>No bookings match.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selected ? (
        <BookingDrawer booking={selected} lastVisitLabel={selectedLastVisit} today={today} onClose={() => update({ booking: "" })} />
      ) : null}
      {query.isNew ? (
        <NewBookingDrawer
          services={services}
          staffOptions={staffOptions}
          customers={customers}
          today={today}
          onClose={() => update({ isNew: false })}
        />
      ) : null}
    </>
  );
}
