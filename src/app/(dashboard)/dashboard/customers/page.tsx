import Link from "next/link";
import { Phone } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { formatDateShort } from "@/lib/dashboard/format";
import { CustomerDrawer } from "./_components/customer-drawer";

interface CustomersPageProps {
  searchParams: Promise<{ q?: string; customer?: string }>;
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const ctx = await getCurrentBusiness();
  if (!ctx) return null;
  const { business } = ctx;
  const tz = business.timezone;
  const params = await searchParams;
  const q = (params.q ?? "").trim();

  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select("id, name, phone, email, total_visits, no_show_count, created_at")
    .eq("business_id", business.id)
    .order("name", { ascending: true })
    .limit(200);
  if (q) {
    const safe = q.replace(/[%_(),]/g, "");
    query = query.or(`name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%`);
  }
  const { data: customers, error } = await query;

  // Last visit per customer (one extra query, mapped client-side).
  const ids = (customers ?? []).map((c) => c.id);
  const lastVisit = new Map<string, string>();
  if (ids.length > 0) {
    const { data: visits } = await supabase
      .from("bookings")
      .select("customer_id, starts_at")
      .in("customer_id", ids)
      .order("starts_at", { ascending: false });
    for (const v of visits ?? []) {
      if (!lastVisit.has(v.customer_id)) lastVisit.set(v.customer_id, v.starts_at);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">
          Your customer list builds itself as people book.
        </p>
      </header>

      <form action="/dashboard/customers" className="flex max-w-sm gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search name, phone, or email"
            aria-label="Search customers"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            Could not load customers.{" "}
            <Link href="/dashboard/customers" className="underline underline-offset-4">
              Retry
            </Link>
          </AlertDescription>
        </Alert>
      ) : (customers ?? []).length === 0 ? (
        <EmptyState
          title={q ? "No customers match" : "No customers yet"}
          description={
            q
              ? "Try a different search."
              : "Customers appear here automatically after their first booking."
          }
        />
      ) : (
        <>
          <CustomersTable
            customers={customers ?? []}
            lastVisit={lastVisit}
            timezone={tz}
          />
          <CustomersCards customers={customers ?? []} />
        </>
      )}

      {params.customer && (
        <CustomerDrawer
          key={params.customer}
          businessId={business.id}
          customerId={params.customer}
          timezone={tz}
        />
      )}
    </div>
  );
}

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  total_visits: number;
  no_show_count: number;
  created_at: string;
};

function CustomersTable({
  customers,
  lastVisit,
  timezone,
}: {
  customers: CustomerRow[];
  lastVisit: Map<string, string>;
  timezone: string;
}) {
  return (
    <Card className="hidden shadow-sm md:block">
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="tnum px-4 py-3 text-right font-medium">Visits</th>
              <th className="tnum px-4 py-3 text-right font-medium">No-shows</th>
              <th className="px-4 py-3 text-right font-medium">Last visit</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/customers?customer=${c.id}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {c.name}
                  </Link>
                </td>
                <td className="tnum px-4 py-3 text-muted-foreground">
                  {c.phone ? (
                    <span className="flex items-center gap-1.5">
                      <Phone className="size-3.5" aria-hidden />
                      {c.phone}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="tnum px-4 py-3 text-right">{c.total_visits}</td>
                <td
                  className={`tnum px-4 py-3 text-right ${
                    c.no_show_count > 0 ? "font-medium text-destructive" : ""
                  }`}
                >
                  {c.no_show_count}
                </td>
                <td className="tnum px-4 py-3 text-right text-muted-foreground">
                  {lastVisit.get(c.id)
                    ? formatDateShort(lastVisit.get(c.id)!, timezone)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function CustomersCards({ customers }: { customers: CustomerRow[] }) {
  return (
    <div className="flex flex-col gap-2 md:hidden">
      {customers.map((c) => (
        <Link key={c.id} href={`/dashboard/customers?customer=${c.id}`}>
          <Card className="shadow-sm transition-colors hover:border-primary/40">
            <CardContent className="flex items-center gap-3 p-3">
              <span className="min-w-0 flex-1">
                <span className="truncate text-sm font-medium">{c.name}</span>
                <span className="tnum truncate text-xs text-muted-foreground">
                  {c.phone ?? c.email ?? "No contact"}
                </span>
              </span>
              <span className="tnum text-right text-xs text-muted-foreground">
                {c.total_visits} visits
                {c.no_show_count > 0 && (
                  <span className="block font-medium text-destructive">
                    {c.no_show_count} no-shows
                  </span>
                )}
              </span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
