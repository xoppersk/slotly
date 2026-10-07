import * as React from "react";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business";
import {
  businessLocalRangeToUtc,
  toBusinessDayKey,
} from "@/lib/timezone";
import { addDaysYmd } from "@/lib/availability";
import { formatCents } from "@/lib/format";
import type { Database } from "@/lib/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  formatDateLong,
  formatDateShort,
  greetingForHour,
  noShowRate,
} from "@/lib/dashboard/format";

import { TodayRealtime } from "../_components/today-realtime";
import { AgendaBookingCard } from "../_components/agenda-booking-card";
import { AgendaEmptyState } from "../_components/agenda-empty-state";

interface TodayPageProps {
  searchParams: Promise<{ date?: string }>;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function TodayPage({ searchParams }: TodayPageProps) {
  const ctx = await getCurrentBusiness();
  if (!ctx) return null; // layout redirects
  const { business, membership } = ctx;
  const tz = business.timezone;
  const isStaff = membership.role === "staff";

  const params = await searchParams;
  const todayKey = toBusinessDayKey(new Date().toISOString(), tz);
  const dateKey =
    params.date && DATE_RE.test(params.date) ? params.date : todayKey;
  const hour = Number(formatInTimeZone(new Date(), tz, "H"));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greetingForHour(hour)}
            {isStaff ? "" : `, ${business.name}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isStaff ? "Your day" : "Today's agenda"} ·{" "}
            {formatDateLong(`${dateKey}T12:00:00Z`, tz)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <TodayRealtime businessId={business.id} />
          <Button variant="ghost" size="icon" asChild aria-label="Previous day">
            <Link href={`/dashboard?date=${addDaysYmd(dateKey, -1)}`}>
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">Today</Link>
          </Button>
          <Button variant="ghost" size="icon" asChild aria-label="Next day">
            <Link href={`/dashboard?date=${addDaysYmd(dateKey, 1)}`}>
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </header>

      <StatChips businessId={business.id} timezone={tz} dateKey={dateKey} />

      <AlertsPanel businessId={business.id} isStaff={isStaff} staffId={membership.staffId} />

      <section aria-label="Agenda">
        <React.Suspense fallback={<AgendaSkeleton />}>
          <AgendaSection
            businessId={business.id}
            businessSlug={business.slug}
            timezone={tz}
            dateKey={dateKey}
            isStaff={isStaff}
            staffId={membership.staffId}
          />
        </React.Suspense>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* stat chips                                                          */
/* ------------------------------------------------------------------ */

async function StatChips({
  businessId,
  timezone,
  dateKey,
}: {
  businessId: string;
  timezone: string;
  dateKey: string;
}) {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const { startsAtUtc: dayStart, endsAtUtc: dayEnd } = businessLocalRangeToUtc(
    dateKey,
    "00:00",
    "23:59",
    timezone
  );

  // Week: last 7 business-local days including today — revenue + no-show
  // window share the same range for a coherent story.
  const weekStartKey = addDaysYmd(dateKey, -6);
  const { startsAtUtc: weekStart } = businessLocalRangeToUtc(
    weekStartKey,
    "00:00",
    "23:59",
    timezone
  );

  const [todayCount, pendingCount, payments, history] = await Promise.all([
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .gte("starts_at", dayStart.toISOString())
      .lte("starts_at", dayEnd.toISOString()),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "pending")
      .gte("starts_at", nowIso),
    supabase
      .from("payments")
      .select("amount_cents")
      .eq("business_id", businessId)
      .eq("status", "succeeded")
      .gte("created_at", weekStart.toISOString()),
    supabase
      .from("bookings")
      .select("status")
      .eq("business_id", businessId)
      .in("status", ["completed", "no_show"])
      .gte("starts_at", weekStart.toISOString()),
  ]);

  const revenue = (payments.data ?? []).reduce(
    (sum, p) => sum + p.amount_cents,
    0
  );
  const noShows = (history.data ?? []).filter(
    (b) => b.status === "no_show"
  ).length;
  const completed = (history.data ?? []).filter(
    (b) => b.status === "completed"
  ).length;

  const chips = [
    {
      label: "Bookings today",
      value: String(todayCount.count ?? 0),
      sub: formatDateShort(`${dateKey}T12:00:00Z`, timezone),
    },
    {
      label: "Pending requests",
      value: String(pendingCount.count ?? 0),
      sub: "awaiting confirmation",
    },
    {
      label: "7-day revenue",
      value: formatCents(revenue),
      sub: "succeeded payments",
    },
    {
      label: "No-show rate",
      value: `${noShowRate(noShows, completed)}%`,
      sub: "last 7 days",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {chips.map((chip) => (
        <Card key={chip.label} className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {chip.label}
            </p>
            <p className="tnum mt-1 text-2xl font-semibold tracking-tight">
              {chip.value}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{chip.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* alerts                                                              */
/* ------------------------------------------------------------------ */

async function AlertsPanel({
  businessId,
  isStaff,
  staffId,
}: {
  businessId: string;
  isStaff: boolean;
  staffId: string | null;
}) {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const soonIso = new Date(Date.parse(nowIso) + 30 * 60_000).toISOString();

  const base = () =>
    supabase.from("bookings").select("id, starts_at, customer_id").eq("business_id", businessId);

  let pendingQuery = base().eq("status", "pending").gte("starts_at", nowIso).order("starts_at", { ascending: true }).limit(5);
  let holdQuery = base()
    .eq("status", "payment_pending")
    .lt("hold_expires_at", soonIso)
    .order("hold_expires_at", { ascending: true })
    .limit(5);
  if (isStaff && staffId) {
    pendingQuery = pendingQuery.eq("staff_id", staffId);
    holdQuery = holdQuery.eq("staff_id", staffId);
  }
  const [pending, holds] = await Promise.all([pendingQuery, holdQuery]);

  const pendingCount = pending.data?.length ?? 0;
  const holdCount = holds.data?.length ?? 0;
  if (pendingCount === 0 && holdCount === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {pendingCount > 0 && (
        <Alert>
          <AlertDescription>
            <Link
              href="/dashboard/bookings?status=pending"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {pendingCount} pending {pendingCount === 1 ? "request" : "requests"}
            </Link>{" "}
            awaiting confirmation.
          </AlertDescription>
        </Alert>
      )}
      {holdCount > 0 && (
        <Alert>
          <AlertDescription>
            <span className="tnum font-medium">
              {holdCount} payment {holdCount === 1 ? "hold" : "holds"}
            </span>{" "}
            expiring within 30 minutes —{" "}
            <Link
              href="/dashboard/bookings?status=payment_pending"
              className="text-primary underline-offset-4 hover:underline"
            >
              review
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* agenda                                                              */
/* ------------------------------------------------------------------ */

function AgendaSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-20 w-full rounded-[0.75rem]" />
      ))}
    </div>
  );
}

async function AgendaSection({
  businessId,
  businessSlug,
  timezone,
  dateKey,
  isStaff,
  staffId,
}: {
  businessId: string;
  businessSlug: string;
  timezone: string;
  dateKey: string;
  isStaff: boolean;
  staffId: string | null;
}) {
  const supabase = await createClient();
  const { startsAtUtc, endsAtUtc } = businessLocalRangeToUtc(
    dateKey,
    "00:00",
    "23:59",
    timezone
  );

  let query = supabase
    .from("bookings")
    .select(
      "id, starts_at, ends_at, status, customer_notes, internal_notes, price_cents, services(id, name, color), staff(id, name), customers(id, name)"
    )
    .eq("business_id", businessId)
    .gte("starts_at", startsAtUtc.toISOString())
    .lte("starts_at", endsAtUtc.toISOString())
    .order("starts_at", { ascending: true });

  if (isStaff && staffId) query = query.eq("staff_id", staffId);

  const { data, error } = await query;
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Could not load the agenda.{" "}
          <Link href="/dashboard" className="underline underline-offset-4">
            Retry
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  // The Database stub declares no Relationships, so joined rows are cast
  // explicitly (PostgREST resolves the FK joins at runtime).
  interface AgendaRow {
    id: string;
    starts_at: string;
    status: Database["public"]["Tables"]["bookings"]["Row"]["status"];
    customer_notes: string;
    internal_notes: string;
    price_cents: number;
    services: { id: string; name: string; color: string } | null;
    staff: { id: string; name: string } | null;
    customers: { id: string; name: string } | null;
  }
  const rows = ((data ?? []) as unknown as AgendaRow[]).map((b) => ({
    ...b,
    services: Array.isArray(b.services) ? (b.services[0] ?? null) : b.services,
    staff: Array.isArray(b.staff) ? (b.staff[0] ?? null) : b.staff,
    customers: Array.isArray(b.customers)
      ? (b.customers[0] ?? null)
      : b.customers,
  }));
  if (rows.length === 0) {
    return <AgendaEmptyState businessSlug={businessSlug} />;
  }

  // Group by staff for the owner; staff role sees one group ("Your day").
  const groups = new Map<string, typeof rows>();
  for (const b of rows) {
    const key = b.staff?.id ?? "unknown";
    const list = groups.get(key) ?? [];
    list.push(b);
    groups.set(key, list);
  }

  return (
    <div className="flex flex-col gap-6">
      {[...groups.entries()].map(([staffKey, list]) => {
        const staffName = list[0]?.staff?.name ?? "Unassigned";
        return (
          <section key={staffKey} aria-label={staffName}>
            {!isStaff && (
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                {staffName}
              </h2>
            )}
            <ol className="flex flex-col gap-2">
              {list.map((b) => (
                <AgendaBookingCard
                  key={b.id}
                  bookingId={b.id}
                  startsAt={b.starts_at}
                  timezone={timezone}
                  serviceName={b.services?.name}
                  serviceColor={b.services?.color}
                  customerName={b.customers?.name}
                  status={b.status}
                  priceCents={b.price_cents}
                  hasNotes={Boolean(b.customer_notes || b.internal_notes)}
                />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
