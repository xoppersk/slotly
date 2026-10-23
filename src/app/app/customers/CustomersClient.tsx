"use client";
/* D-08 Customers — search + filter (URL) over the real customer rows.
   Default filter is "All customers" (the fixture defaulted to a pinned
   "booked today" canon day; with real data that would hide the list).
   The drawn Import button is gone — customers arrive through bookings
   (the customers table has no direct insert policy); "Add customer"
   starts a booking on their behalf instead. */
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ButtonLink } from "@/components/sl/Button";
import { StatusPill } from "@/components/sl/StatusPill";
import { IconPlus } from "@/components/sl/icons";
import { initialsOf, wholeDollars } from "../_lib/model";
import { IconSearch } from "../ui";

export interface CustomerView {
  id: string;
  name: string;
  email: string;
  phone: string;
  visits: number;
  noShows: number;
  isNew: boolean;
  nextOrLastVisit: string;
  usualService: string;
  usualStaff: string;
  ltvCents: number;
  bookedToday: boolean;
  inactive60: boolean;
}

export function CustomersClient({
  q,
  filter,
  customers,
}: {
  q: string;
  filter: string;
  customers: CustomerView[];
}) {
  const router = useRouter();

  const update = (patch: { q?: string; filter?: string }) => {
    const next = { q, filter, ...patch };
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.filter && next.filter !== "all") params.set("filter", next.filter);
    const qs = params.toString();
    router.replace(qs ? `/app/customers?${qs}` : "/app/customers", { scroll: false });
  };

  const rows = useMemo(() => {
    let list = customers;
    if (filter === "today") list = list.filter((c) => c.bookedToday);
    if (filter === "notback") list = list.filter((c) => c.inactive60);
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (c) => c.name.toLowerCase().includes(needle) || c.email.toLowerCase().includes(needle) || c.phone.includes(needle),
      );
    }
    return list;
  }, [customers, q, filter]);

  const bookedTodayCount = customers.filter((c) => c.bookedToday).length;

  return (
    <>
      <div className="sl-d-hd">
        <div>
          <h1 className="sl-d-h1">Customers</h1>
          <p className="sl-d-meta">Everyone who has booked with you</p>
        </div>
        <div className="sl-d-acts">
          <ButtonLink href="/app/bookings?new=1" variant="primary" size="dashPrimary"><IconPlus />Add customer</ButtonLink>
        </div>
      </div>

      <div className="sl-d-tools">
        <label className="sl-d-srch">
          <span className="sl-d-sr">Search customers</span>
          <IconSearch />
          <input
            className="sl-d-inp"
            placeholder="Name, email or phone"
            value={q}
            onChange={(e) => update({ q: e.target.value })}
          />
        </label>
        <label>
          <span className="sl-d-sr">Filter</span>
          <select className="sl-d-sel" value={filter} onChange={(e) => update({ filter: e.target.value })}>
            <option value="today">Booked today</option>
            <option value="all">All customers</option>
            <option value="notback">Not back in 60 days</option>
          </select>
        </label>
      </div>

      <div className="sl-d-card sl-d-scroll">
        <table className="sl-d-tbl" style={{ minWidth: 760 }}>
          <thead>
            <tr><th>Customer</th><th className="r">Visits</th><th>Next or last visit</th><th>Usual staff</th><th className="r">Lifetime value</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <span className="sl-d-who">
                    <span className="sl-d-mono" aria-hidden="true" style={{ width: 38, height: 38, fontSize: 15 }}>{initialsOf(c.name)}</span>
                    <span>
                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                      <span className="sl-d-sub">{c.email || c.phone}</span>
                    </span>
                  </span>
                </td>
                <td className="r" style={{ fontWeight: 600 }}>{c.visits}</td>
                <td>{c.nextOrLastVisit}</td>
                <td>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span className="sl-d-mono" aria-hidden="true" style={{ width: 24, height: 24, fontSize: 10 }}>{c.usualStaff.charAt(0)}</span>
                    {c.usualStaff}
                  </span>
                </td>
                <td className="r" style={{ fontFamily: "var(--font-display)", fontSize: 18, letterSpacing: "-.02em" }}>
                  {wholeDollars(c.ltvCents)}
                </td>
                <td>{c.isNew ? <StatusPill status="Arrived" label="New" /> : null}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: "28px 20px", color: "var(--muted)" }}>No customers match.</td></tr>
            ) : null}
          </tbody>
        </table>
        <p className="sl-d-foot">
          {`Showing ${rows.length} of ${customers.length} customers · ${bookedTodayCount} booked today`}
        </p>
      </div>
    </>
  );
}
