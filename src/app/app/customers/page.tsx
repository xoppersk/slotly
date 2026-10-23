/* D-08 Customers page — server gate then live rows from the customers table.
   Reads bookings (for visits, staff, spend), services (for price tiers), and
   staff (for usual-staff names), computes visits/LTV/next-or-last visit in
   TS, and streams the same CustomersClient shell. Default filter is "all". */
import { Suspense } from "react";
import { requireOwnerBusiness } from "../../_lib/data";
import { serviceClient } from "@/lib/supabase/service-role";
import { dayBoundsIso, shiftDateKey, todayKey } from "../_lib/model";
import { CustomersClient, type CustomerView } from "./CustomersClient";

type SP = Promise<Record<string, string | string[]> | undefined>;

const one = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] ?? "" : v ?? "";

function displayDate(iso: string | null, timeZone: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
  }).formatToParts(d);
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const year = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric" }).format(d);
  return `${month} ${day}, ${year}`;
}

async function CustomersInner({
  q,
  filter,
  businessId,
}: {
  q: string;
  filter: string;
  businessId: string;
}) {
  const { business } = await requireOwnerBusiness();
  const sb = serviceClient();
  const tz = business.timeZone;
  const today = todayKey(tz);
  const { start, end } = dayBoundsIso(today, tz);
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const [bookingsRes, customersRes, servicesRes, staffRes] = await Promise.all([
    sb
      .from("bookings")
      .select("id,customer_id,start_at,end_at,status,service_id,staff_id,price_cents,deposit_paid_cents")
      .eq("business_id", businessId)
      .order("start_at", { ascending: true }),
    sb.from("customers").select("id,first_name,last_name,email,phone,created_at").eq("business_id", businessId),
    sb.from("services").select("id,price_cents").eq("business_id", businessId),
    sb.from("staff").select("id,name").eq("business_id", businessId),
  ]);
  const bookings = (bookingsRes.data ?? []) as {
    id: string; customer_id: string | null; start_at: string | null; end_at: string | null;
    status: string; service_id: string | null; staff_id: string | null;
    price_cents: number | null; deposit_paid_cents: number | null;
  }[];
  const customers = (customersRes.data ?? []) as {
    id: string; first_name: string | null; last_name: string | null;
    email: string | null; phone: string | null; created_at: string;
  }[];
  const priceByService = new Map((servicesRes.data ?? []).map((s) => [s.id as string, (s.price_cents as number) ?? 0]));
  const nameByStaff = new Map((staffRes.data ?? []).map((s) => [s.id as string, (s.name as string) ?? "—"]));

  const byCustomer = new Map<string, typeof bookings>();
  for (const b of bookings) {
    if (!b.customer_id) continue;
    const list = byCustomer.get(b.customer_id);
    if (list) list.push(b);
    else byCustomer.set(b.customer_id, [b]);
  }

  const rows: CustomerView[] = customers.map((c) => {
    const list = byCustomer.get(c.id) ?? [];
    const past = list.filter((b) => (b.start_at ?? "") < start && b.status !== "Cancelled" && b.status !== "No-show");
    const visits = past.length;
    const noShows = list.filter((b) => b.status === "No-show").length;
    const ltvCents = past.reduce((sum, b) => {
      const price = (b.price_cents ?? 0) || priceByService.get(b.service_id ?? "") || 0;
      return sum + price;
    }, 0);
    const future = list
      .filter((b) => (b.start_at ?? "") >= start && b.status !== "Cancelled" && b.status !== "No-show")
      .sort((a, b) => (a.start_at ?? "").localeCompare(b.start_at ?? ""));
    const last = past.length > 0 ? past[past.length - 1].start_at : null;
    const bookedToday = list.some(
      (b) => (b.start_at ?? "") >= start && (b.start_at ?? "") < end && b.status !== "Cancelled",
    );
    const inactive60 = visits > 0 && (!last || last < cutoff);
    const usualService = past.length > 0 ? "Repeat" : "—";
    const usualStaff =
      past.length > 0 ? nameByStaff.get(past[past.length - 1].staff_id ?? "") ?? "—" : "—";
    const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || c.phone || "Customer";
    return {
      id: c.id,
      name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      visits,
      noShows,
      isNew: visits === 0,
      nextOrLastVisit: displayDate(future[0]?.start_at ?? last, tz),
      usualService,
      usualStaff,
      ltvCents,
      bookedToday,
      inactive60,
    };
  });

  rows.sort((a, b) => a.name.localeCompare(b.name));

  return <CustomersClient q={q} filter={filter} customers={rows} />;
}

export default function CustomersPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={null}>
      <CustomersInnerReady searchParams={searchParams} />
    </Suspense>
  );
}

async function CustomersInnerReady({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = one(sp?.q);
  const filter = one(sp?.filter) || "all";
  const { business } = await requireOwnerBusiness();
  return <CustomersInner q={q} filter={filter} businessId={business.id} />;
}
