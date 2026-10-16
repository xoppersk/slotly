"use client";
/* D-02 Bookings — totals band, Today/Upcoming/Past/Cancelled tabs,
   search + barber + status filters (all living in the URL), the 14-row
   table, the D-03 drawer (?booking=[id]) and the on-behalf drawer (?new=1). */
import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ButtonLink } from "@/components/sl/Button";
import { StatusPill } from "@/components/sl/StatusPill";
import { IconPlus } from "@/components/sl/icons";
import { formatWholeDollars, getDashboardTotals } from "@/lib/api";
import { useDashboard } from "../DashboardContext";
import { IconSearch, timeLabel, toLabel } from "../ui";
import { BookingDrawer } from "./BookingDrawer";
import { NewBookingDrawer } from "./NewBookingDrawer";

export interface BookingsQuery {
  view: string;
  q: string;
  barber: string;
  status: string;
  booking: string;
  isNew: boolean;
}

const VIEWS = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
] as const;

const STATUSES = ["Done", "In the chair", "Arrived", "Upcoming"] as const;

export function BookingsClient({ query }: { query: BookingsQuery }) {
  const router = useRouter();
  const { bookings } = useDashboard();
  const totals = getDashboardTotals(bookings);

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
    let list = [...bookings].sort((a, b) => a.start24.localeCompare(b.start24));
    if (query.view === "upcoming") list = list.filter((b) => b.status === "Upcoming" || b.status === "Confirmed");
    if (query.view === "past") list = list.filter((b) => b.status === "Done");
    if (query.view === "cancelled") list = [];
    if (query.barber) list = list.filter((b) => b.barberId === query.barber);
    if (query.status) list = list.filter((b) => b.status === query.status);
    const q = query.q.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (b) =>
          b.customer.toLowerCase().includes(q) ||
          b.code.toLowerCase().includes(q) ||
          (b.customerPhone ?? "").includes(q) ||
          b.customerEmail.toLowerCase().includes(q),
      );
    }
    return list;
  }, [bookings, query]);

  const selected = query.booking ? bookings.find((b) => b.id === query.booking) : undefined;

  return (
    <>
      <div className="sl-d-hd">
        <div>
          <p className="sl-d-eyb">Thursday, October 8 · 10:40 AM</p>
          <h1 className="sl-d-h1">Bookings</h1>
        </div>
        <div className="sl-d-acts">
          <ButtonLink href="#" size="dashboard">Export CSV</ButtonLink>
          <ButtonLink href="/app/bookings?new=1" variant="primary" size="dashPrimary">
            <IconPlus />New booking
          </ButtonLink>
        </div>
      </div>

      <div className="sl-d-ink sl-d-totals" aria-label="Today’s totals">
        <div className="sl-d-totals__cell"><b>{totals.count}</b><span>bookings</span></div>
        <div className="sl-d-totals__cell"><b>{totals.bookedLabel}</b><span>booked</span></div>
        <div className="sl-d-totals__cell"><b>{totals.depositsLabel}</b><span>in deposits</span></div>
        <div className="sl-d-totals__cell"><b>{totals.toCollectLabel}</b><span>to collect at the shop</span></div>
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
          <span className="sl-d-sr">Barber</span>
          <select className="sl-d-sel" value={query.barber} onChange={(e) => update({ barber: e.target.value })}>
            <option value="">All barbers</option>
            <option value="micah">Micah</option>
            <option value="nia">Nia</option>
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
            <tr><th>Time</th><th>Customer</th><th>Service</th><th>Barber</th><th className="r">Price</th><th>Deposit</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className={b.status === "Done" ? "sl-d-past" : b.id === query.booking ? "sl-d-pick" : undefined}>
                <td className="sl-d-tm">
                  {timeLabel(b.start24)}
                  <span className="sl-d-sub">{toLabel(b.end24)}</span>
                </td>
                <td>
                  <span className="sl-d-who">
                    <span className={`sl-d-mono${b.status === "Done" ? " sl-d-mono--off" : ""}`} aria-hidden="true">{b.customer.charAt(0)}</span>
                    <Link href={`/app/bookings?booking=${b.id}`}>{b.customer}</Link>
                  </span>
                </td>
                <td>{b.service}</td>
                <td>{b.barber}</td>
                <td className="r" style={{ fontWeight: 600 }}>{formatWholeDollars(b.priceCents)}</td>
                <td>{b.depositCents > 0 ? `${formatWholeDollars(b.depositCents)} ${b.depositStatus}` : "No deposit"}</td>
                <td><StatusPill status={b.status} /></td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: "28px 20px", color: "var(--muted)" }}>No bookings match.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selected ? (
        <BookingDrawer booking={selected} onClose={() => update({ booking: "" })} />
      ) : null}
      {query.isNew ? (
        <NewBookingDrawer onClose={() => update({ isNew: false })} />
      ) : null}
    </>
  );
}
