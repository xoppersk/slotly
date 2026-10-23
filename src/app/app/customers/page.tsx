/* D-08 Customers (server): real customers rows — visits / no-shows are
   the database-maintained counters (trigger in migration 00005),
   displayed only. Usual service/staff and lifetime value are computed
   from the business's real bookings (LTV = sum of completed booking
   prices; the fixture's visits × usual-price shortcut is not used). */
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { listCustomers } from "@/lib/db/owner";
import { createClient } from "@/lib/supabase/server";

import { getDashboardContext, loadBookings } from "../_lib/data";
import { dateShort, dayBoundsIso, shiftDateKey, todayKey } from "../_lib/model";
import { CustomersClient, type CustomerView } from "./CustomersClient";

type SP = Promise<Record<string, string | string[] | undefined>>;

async function CustomersInner({ searchParams }: { searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx) redirect("/onboarding");
  const { business } = ctx;
  const tz = business.timezone;
  const today = todayKey(tz);
  const fromIso = dayBoundsIso(shiftDateKey(today, -365), tz).fromIso;
  const toIso = dayBoundsIso(shiftDateKey(today, 181), tz).fromIso;

  const supabase = await createClient();
  const [customers, bundle] = await Promise.all([
    listCustomers(supabase, business.id),
    loadBookings(business, { fromIso, toIso }),
  ]);
  const bookings = bundle.bookings;
  const nowIso = new Date().toISOString();
  const sixtyDaysAgo = dayBoundsIso(shiftDateKey(today, -60), tz).fromIso;

  const views: CustomerView[] = customers.map((c) => {
    const mine = bookings.filter((b) => b.customerId === c.id);
    const live = mine.filter((b) => b.dbStatus !== "cancelled");
    const upcoming = live
      .filter((b) => b.startsAtIso >= nowIso)
      .sort((a, b) => a.startsAtIso.localeCompare(b.startsAtIso))[0];
    const past = live
      .filter((b) => b.startsAtIso < nowIso)
      .sort((a, b) => b.startsAtIso.localeCompare(a.startsAtIso))[0];
    const anchor = upcoming ?? past;
    // Usual = most frequent service/staff across non-cancelled bookings.
    const freq = <K extends string>(items: K[]) => {
      const counts = new Map<K, number>();
      for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    };
    const usualService = freq(live.map((b) => b.serviceName));
    const usualStaff = freq(live.map((b) => b.staffName));
    const ltvCents = mine
      .filter((b) => b.dbStatus === "completed")
      .reduce((s, b) => s + b.priceCents, 0);
    const lastActivity = live.sort((a, b) => b.startsAtIso.localeCompare(a.startsAtIso))[0];
    return {
      id: c.id,
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      visits: c.total_visits,
      noShows: c.no_show_count,
      isNew: c.total_visits === 0 && mine.length > 0,
      nextOrLastVisit: anchor
        ? `${anchor === upcoming ? "Next" : "Last"} · ${dateShort(anchor.dateKey)} · ${anchor.serviceName}`
        : "No bookings yet",
      usualService: usualService ?? "—",
      usualStaff: usualStaff ?? "—",
      ltvCents,
      bookedToday: mine.some((b) => b.dateKey === today && b.dbStatus !== "cancelled"),
      inactive60: !lastActivity || lastActivity.startsAtIso < sixtyDaysAgo,
    };
  });

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] ?? "" : v ?? "");
  return <CustomersClient q={one(sp.q)} filter={one(sp.filter) || "all"} customers={views} />;
}

export default function CustomersPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={null}>
      <CustomersInner searchParams={searchParams} />
    </Suspense>
  );
}
