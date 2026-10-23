/* Server data layer for the owner dashboard + staff portal (PROD-W4).
 *
 * Every read is scoped to a business the signed-in user actually belongs
 * to (business_members), and PostgreSQL Row Level Security enforces the
 * same scoping at the database level — a wrong business id returns no
 * rows, never another business's data. List reads go through W1's
 * `@/lib/db/owner` functions; membership resolution goes through W2's
 * `getCurrentUserAndMemberships`.
 */
import { cache } from "react";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

import { getCurrentUserAndMemberships } from "@/lib/auth-actions";
import {
  getPaymentsSummary,
  listBookings,
  listCustomers,
  listServicesAdmin,
  listStaffAdmin,
  type MembershipWithBusiness,
  type OwnerBooking,
} from "@/lib/db/owner";
import { createClient } from "@/lib/supabase/server";
import type {
  BusinessRow,
  CustomerRow,
  PaymentRow,
  ServiceRow,
  StaffRow,
} from "@/lib/supabase/types";

import { toDashBooking, type DashBooking } from "./model";

export const ACTIVE_BUSINESS_COOKIE = "slotly_active_business";

export interface SessionMemberships {
  user: User | null;
  memberships: MembershipWithBusiness[];
}

/** Signed-in user + all their memberships (empty when signed out). */
export const getSessionMemberships = cache(async (): Promise<SessionMemberships> => {
  const { user, memberships } = await getCurrentUserAndMemberships();
  return { user, memberships: memberships as MembershipWithBusiness[] };
});

async function pickActive(
  memberships: MembershipWithBusiness[],
  predicate?: (m: MembershipWithBusiness) => boolean,
): Promise<MembershipWithBusiness | null> {
  const pool = predicate ? memberships.filter(predicate) : memberships;
  if (pool.length === 0) return null;
  const cookieStore = await cookies();
  const wanted = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value;
  return pool.find((m) => m.membership.business_id === wanted) ?? pool[0]!;
}

export interface DashboardContextData {
  user: User;
  memberships: MembershipWithBusiness[];
  active: MembershipWithBusiness;
  business: BusinessRow;
  role: "owner" | "staff";
  isOwner: boolean;
}

/** Active dashboard business for /app/*, or null (signed out / no memberships). */
export const getDashboardContext = cache(async (): Promise<DashboardContextData | null> => {
  const { user, memberships } = await getSessionMemberships();
  if (!user || memberships.length === 0) return null;
  const active = await pickActive(memberships);
  if (!active) return null;
  return {
    user,
    memberships,
    active,
    business: active.business,
    role: active.membership.role,
    isOwner: active.membership.role === "owner",
  };
});

export interface StaffContextData {
  user: User;
  membership: MembershipWithBusiness;
  business: BusinessRow;
  staffId: string;
  staff: StaffRow | null;
}

/** The signed-in user's staff membership for /staff/*, or null. */
export const getStaffContext = cache(async (): Promise<StaffContextData | null> => {
  const { user, memberships } = await getSessionMemberships();
  if (!user) return null;
  const active = await pickActive(memberships, (m) => m.membership.staff_id !== null);
  if (!active || !active.membership.staff_id) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff")
    .select("*")
    .eq("id", active.membership.staff_id)
    .maybeSingle();
  return {
    user,
    membership: active,
    business: active.business,
    staffId: active.membership.staff_id,
    staff: (data as StaffRow | null) ?? null,
  };
});

/** Succeeded payments per booking id, for a set of bookings. */
async function paidCentsByBooking(
  businessId: string,
  bookingIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (bookingIds.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "succeeded")
    .in("booking_id", bookingIds);
  for (const p of (data ?? []) as PaymentRow[]) {
    map.set(p.booking_id, (map.get(p.booking_id) ?? 0) + p.amount_cents);
  }
  return map;
}

export interface BookingBundle {
  bookings: DashBooking[];
  customersById: Map<string, CustomerRow>;
  servicesById: Map<string, ServiceRow>;
  staffById: Map<string, StaffRow>;
}

/** Real bookings in a window, mapped to dashboard view models. */
export async function loadBookings(
  business: BusinessRow,
  range: { fromIso?: string; toIso?: string; staffId?: string } = {},
): Promise<BookingBundle> {
  const supabase = await createClient();
  const [rows, customers, services, staff] = await Promise.all([
    listBookings(supabase, business.id, { from: range.fromIso, to: range.toIso }),
    listCustomers(supabase, business.id),
    listServicesAdmin(supabase, business.id),
    listStaffAdmin(supabase, business.id),
  ]);
  const customersById = new Map(customers.map((c) => [c.id, c]));
  const servicesById = new Map(services.map((s) => [s.id, s]));
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const filtered = range.staffId ? rows.filter((r) => r.staff_id === range.staffId) : rows;
  const paid = await paidCentsByBooking(
    business.id,
    filtered.map((r) => r.id),
  );
  const bookings = filtered.map((row: OwnerBooking) => {
    const customer = customersById.get(row.customer_id);
    const service = servicesById.get(row.service_id);
    return toDashBooking(row, business.timezone, {
      customerName: row.customer_name ?? customer?.name ?? "Customer",
      customerEmail: row.customer_email ?? customer?.email ?? "",
      customerPhone: row.customer_phone ?? customer?.phone ?? "",
      customerVisits: customer?.total_visits ?? 0,
      customerNoShows: customer?.no_show_count ?? 0,
      serviceName: row.service_name ?? service?.name ?? "Service",
      serviceDepositCents: service?.deposit_cents ?? 0,
      staffName: row.staff_name ?? staffById.get(row.staff_id)?.name ?? "Staff",
      paidCents: paid.get(row.id) ?? 0,
    });
  });
  return { bookings, customersById, servicesById, staffById };
}

export { getPaymentsSummary };
export type { MembershipWithBusiness };
