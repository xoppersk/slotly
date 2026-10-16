import { Suspense } from "react";
import { BookingsClient, type BookingsQuery } from "./BookingsClient";

type SP = Promise<Record<string, string | string[] | undefined>>;

async function BookingsInner({ searchParams }: { searchParams: SP }) {
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
  return <BookingsClient query={query} />;
}

export default function BookingsPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={null}>
      <BookingsInner searchParams={searchParams} />
    </Suspense>
  );
}
