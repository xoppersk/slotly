/* D-02 Bookings (server): real bookings across a wide window, filtered
   by the URL-driven client. Totals band = today's real totals. */
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { listServiceStaff } from "@/lib/db/owner";
import { createClient } from "@/lib/supabase/server";
import { getDashboardContext, loadBookings } from "../_lib/data";
import { dayBoundsIso, shiftDateKey, todayKey } from "../_lib/model";
import { BookingsClient, type BookingsQuery } from "./BookingsClient";

type SP = Promise<Record<string, string | string[] | undefined>>;

async function BookingsInner({ searchParams }: { searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx) redirect("/onboarding");
  const { business } = ctx;
  const tz = business.timezone;
  const today = todayKey(tz);
  const fromIso = dayBoundsIso(shiftDateKey(today, -120), tz).fromIso;
  const toIso = dayBoundsIso(shiftDateKey(today, 181), tz).fromIso;
  const bundle = await loadBookings(business, { fromIso, toIso });
  const serviceStaff = await listServiceStaff(await createClient(), business.id);

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] ?? "" : v ?? "");
  const query: BookingsQuery = {
    view: one(sp.view) || "today",
    q: one(sp.q),
    barber: one(sp.barber),
    status: one(sp.status),
    booking: one(sp.booking),
    isNew: one(sp.new) === "1",
  };

  const todaysBookings = bundle.bookings.filter((b) => b.dateKey === today && b.dbStatus !== "cancelled");
  const bookedCents = todaysBookings.reduce((s, b) => s + b.priceCents, 0);
  const paidCents = todaysBookings.reduce((s, b) => s + b.depositPaidCents, 0);
  const dueCents = todaysBookings.reduce((s, b) => s + Math.max(0, b.depositCents - b.depositPaidCents), 0);

  return (
    <BookingsClient
      query={query}
      bookings={bundle.bookings}
      today={today}
      todayTotals={{
        count: todaysBookings.length,
        bookedCents,
        // Payments table wins when rows exist; otherwise deposits due at
        // the visit — never a fabricated "collected" figure.
        depositsCents: paidCents > 0 ? paidCents : dueCents,
        toCollectCents: bookedCents - paidCents,
      }}
      staffOptions={[...bundle.staffById.values()].map((s) => ({ id: s.id, name: s.name }))}
      services={[...bundle.servicesById.values()]
        .filter((s) => s.is_active)
        .map((s) => ({
          id: s.id,
          name: s.name,
          durationMinutes: s.duration_minutes,
          priceCents: s.price_cents,
          depositCents: s.deposit_cents,
          paymentPolicy: s.payment_policy,
          staffIds: serviceStaff[s.id] ?? [],
        }))}
      customers={[...bundle.customersById.values()].map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email ?? "",
        phone: c.phone ?? "",
        visits: c.total_visits,
      }))}
    />
  );
}

export default function BookingsPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={null}>
      <BookingsInner searchParams={searchParams} />
    </Suspense>
  );
}
