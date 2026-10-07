import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business";
import { businessLocalRangeToUtc, toBusinessDayKey } from "@/lib/timezone";
import { addDaysYmd } from "@/lib/availability";
import { formatCents } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatTimeShort, formatDateShort } from "@/lib/dashboard/format";
import { BookingStatusChip } from "../../_components/booking-status-chip";
import { BookingFilters } from "./_components/booking-filters";
import { BookingDrawer } from "./_components/booking-drawer";
import { NewBookingWizard } from "./_components/new-booking-wizard";
import type { Database } from "@/lib/supabase/types";

interface BookingsPageProps {
  searchParams: Promise<{
    q?: string;
    from?: string;
    to?: string;
    staff?: string;
    service?: string;
    status?: string;
    booking?: string;
  }>;
}

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function BookingsPage({ searchParams }: BookingsPageProps) {
  const ctx = await getCurrentBusiness();
  if (!ctx) return null;
  const { business, membership } = ctx;
  const tz = business.timezone;
  const isStaff = membership.role === "staff";
  const params = await searchParams;

  const q = (params.q ?? "").trim();
  const from = params.from && DATE_RE.test(params.from) ? params.from : null;
  const to = params.to && DATE_RE.test(params.to) ? params.to : null;
  const staffFilter = params.staff && params.staff !== "all" ? params.staff : null;
  const serviceFilter = params.service && params.service !== "all" ? params.service : null;
  const statusFilter = params.status && params.status !== "all" ? params.status : null;
  const todayKey = toBusinessDayKey(new Date().toISOString(), tz);
  // Operational default: the last 7 days plus the next 30 — recent history
  // and the upcoming bookable stretch.
  const effectiveFrom = from ?? addDaysYmd(todayKey, -7);
  const effectiveTo = to ?? (from ? from : addDaysYmd(todayKey, 30));

  const supabase = await createClient();

  const [staffList, serviceList] = await Promise.all([
    supabase
      .from("staff")
      .select("id, name")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("services")
      .select("id, name")
      .eq("business_id", business.id)
      .order("sort_order"),
  ]);

  const { startsAtUtc: fromUtc } = businessLocalRangeToUtc(effectiveFrom, "00:00", "23:59", tz);
  const { endsAtUtc: toUtc } = businessLocalRangeToUtc(effectiveTo, "00:00", "23:59", tz);

  let query = supabase
    .from("bookings")
    .select(
      "id, starts_at, ends_at, status, price_cents, services(id, name), staff(id, name), customers(id, name, phone)"
    )
    .eq("business_id", business.id)
    .gte("starts_at", fromUtc.toISOString())
    .lte("starts_at", toUtc.toISOString())
    .order("starts_at", { ascending: false })
    .limit(200);

  if (isStaff && membership.staffId) query = query.eq("staff_id", membership.staffId);
  if (staffFilter && !isStaff) query = query.eq("staff_id", staffFilter);
  if (serviceFilter) query = query.eq("service_id", serviceFilter);
  if (statusFilter) {
    query = query.eq(
      "status",
      statusFilter as Database["public"]["Tables"]["bookings"]["Row"]["status"]
    );
  }
  if (q) {
    const safe = q.replace(/[%_(),]/g, "");
    query = query.or(
      `customers.name.ilike.%${safe}%,customers.phone.ilike.%${safe}%`,
      { foreignTable: "customers" }
    );
  }

  const { data, error } = await query;
  // Joined rows are cast explicitly (see Today agenda): the Database stub
  // declares no Relationships, PostgREST resolves the FK joins at runtime.
  const bookings = (data ?? []) as unknown as BookingListRow[];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
          <p className="text-sm text-muted-foreground">
            Find and act on any booking.
          </p>
        </div>
        <NewBookingWizard businessId={business.id} timezone={tz} />
      </header>

      <BookingFilters
        staff={(staffList.data ?? []).map((s) => ({ id: s.id, name: s.name }))}
        services={(serviceList.data ?? []).map((s) => ({ id: s.id, name: s.name }))}
        hideStaff={isStaff}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            Could not load bookings.{" "}
            <Link href="/dashboard/bookings" className="underline underline-offset-4">
              Clear filters and retry
            </Link>
          </AlertDescription>
        </Alert>
      ) : bookings.length === 0 ? (
        <EmptyState
          title={hasFilters(params) ? "No bookings match those filters" : "No bookings yet"}
          description={
            hasFilters(params)
              ? "Try widening the date range or clearing a filter."
              : "Your bookings appear here the moment customers start booking."
          }
        />
      ) : (
        <>
          <BookingsTable bookings={bookings} timezone={tz} />
          <BookingsCards bookings={bookings} timezone={tz} />
        </>
      )}

      {params.booking && (
        <BookingDrawer
          key={params.booking}
          businessId={business.id}
          bookingId={params.booking}
          timezone={tz}
          role={membership.role}
          freeCancelHours={business.free_cancel_hours}
        />
      )}
    </div>
  );
}

function hasFilters(params: Record<string, string | undefined>) {
  return Boolean(params.q || params.staff || params.service || params.status || params.from || params.to);
}

type BookingListRow = Pick<
  BookingRow,
  "id" | "starts_at" | "status" | "price_cents"
> & {
  services: { id: string; name: string } | { id: string; name: string }[] | null;
  staff: { id: string; name: string } | { id: string; name: string }[] | null;
  customers: { id: string; name: string; phone: string | null } | { id: string; name: string; phone: string | null }[] | null;
};

function first<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function rowHref(id: string) {
  return `/dashboard/bookings?booking=${id}`;
}

function BookingsTable({
  bookings,
  timezone,
}: {
  bookings: BookingListRow[];
  timezone: string;
}) {
  return (
    <Card className="hidden shadow-sm md:block">
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Service</th>
              <th className="px-4 py-3 font-medium">Staff</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                <td className="px-4 py-3">
                  <Link href={rowHref(b.id)} className="block">
                    <span className="tnum font-medium">
                      {formatTimeShort(b.starts_at, timezone)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDateShort(b.starts_at, timezone)}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={rowHref(b.id)} className="block">
                    <span className="font-medium">{first(b.customers)?.name ?? "Customer"}</span>
                    {first(b.customers)?.phone && (
                      <span className="tnum block text-xs text-muted-foreground">
                        {first(b.customers)?.phone}
                      </span>
                    )}
                  </Link>
                </td>
                <td className="px-4 py-3">{first(b.services)?.name ?? "—"}</td>
                <td className="px-4 py-3">{first(b.staff)?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <BookingStatusChip status={b.status} />
                </td>
                <td className="tnum px-4 py-3 text-right">
                  {formatCents(b.price_cents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function BookingsCards({
  bookings,
  timezone,
}: {
  bookings: BookingListRow[];
  timezone: string;
}) {
  return (
    <div className="flex flex-col gap-2 md:hidden">
      {bookings.map((b) => (
        <Link key={b.id} href={rowHref(b.id)}>
          <Card className="shadow-sm transition-colors hover:border-primary/40">
            <CardContent className="flex items-center gap-3 p-3">
              <span className="tnum w-20 shrink-0 text-sm font-semibold">
                {formatTimeShort(b.starts_at, timezone)}
                <span className="block text-xs font-normal text-muted-foreground">
                  {formatDateShort(b.starts_at, timezone)}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="truncate text-sm font-medium">
                  {first(b.customers)?.name ?? "Customer"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {first(b.services)?.name ?? "—"} · {first(b.staff)?.name ?? "—"}
                </span>
              </span>
              <BookingStatusChip status={b.status} />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
