/**
 * Authenticated owner/staff data access.
 *
 * Thin PostgREST queries against the BASE tables — PostgreSQL Row Level
 * Security (migration 00009) scopes every row to businesses where the
 * caller's JWT holds a membership (`is_business_member()` /
 * `business_role()`), so these functions can never leak another owner's
 * data even if a page passes the wrong businessId. Presentation belongs
 * to the pages; these functions only fetch and shape rows minimally.
 *
 * Every function takes the caller's client first (pass `undefined`/`null`
 * to use the default server client).
 */
import { createClient } from "@/lib/supabase/server";

import type {
  AvailabilityOverrideRow,
  AvailabilityRuleRow,
  BlackoutDateRow,
  BookingRow,
  BusinessMemberRow,
  BusinessRow,
  CustomerRow,
  DbClient,
  PaymentRow,
  ServiceRow,
  ServiceStaffRow,
  StaffRow,
  StaffTimeOffRow,
} from "./types";

async function resolveClient(client: DbClient | null | undefined): Promise<DbClient> {
  return client ?? (await createClient());
}

// ---------------------------------------------------------------------------
// Memberships & business
// ---------------------------------------------------------------------------

export interface MembershipWithBusiness {
  membership: BusinessMemberRow;
  business: BusinessRow;
}

interface MembershipJoinRow {
  id: string;
  business_id: string;
  user_id: string;
  role: BusinessMemberRow["role"];
  staff_id: string | null;
  created_at: string;
  business: BusinessRow | null;
}

/** All businesses the user belongs to, with their role in each. */
export async function getMyMemberships(
  client: DbClient | null | undefined,
  userId: string,
): Promise<MembershipWithBusiness[]> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("business_members")
    .select("*, business:businesses(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`getMyMemberships: ${error.message}`);

  const rows = (data ?? []) as unknown as MembershipJoinRow[];
  return rows
    .filter((row) => row.business !== null)
    .map((row) => ({
      membership: {
        id: row.id,
        business_id: row.business_id,
        user_id: row.user_id,
        role: row.role,
        staff_id: row.staff_id,
        created_at: row.created_at,
      },
      business: row.business as BusinessRow,
    }));
}

/** Full business row (member-only via RLS), or null when not a member. */
export async function getOwnedBusiness(
  client: DbClient | null | undefined,
  businessId: string,
): Promise<BusinessRow | null> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .maybeSingle();
  if (error) throw new Error(`getOwnedBusiness: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export interface OwnerBooking extends BookingRow {
  service_name: string | null;
  staff_name: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
}

interface BookingJoinRow extends BookingRow {
  service: { name: string } | null;
  staff: { name: string } | null;
  customer: { name: string; email: string | null; phone: string | null } | null;
}

export interface ListBookingsOptions {
  /** ISO timestamptz lower bound on starts_at (inclusive). */
  from?: string;
  /** ISO timestamptz upper bound on starts_at (exclusive). */
  to?: string;
}

/** Bookings for a business in a window, with display names joined in. */
export async function listBookings(
  client: DbClient | null | undefined,
  businessId: string,
  options: ListBookingsOptions = {},
): Promise<OwnerBooking[]> {
  const supabase = await resolveClient(client);
  let query = supabase
    .from("bookings")
    .select(
      "*, service:services(name), staff:staff(name), customer:customers(name, email, phone)",
    )
    .eq("business_id", businessId)
    .order("starts_at", { ascending: true });
  if (options.from) query = query.gte("starts_at", options.from);
  if (options.to) query = query.lt("starts_at", options.to);

  const { data, error } = await query;
  if (error) throw new Error(`listBookings: ${error.message}`);

  return ((data ?? []) as unknown as BookingJoinRow[]).map((row) => {
    const { service, staff, customer, ...booking } = row;
    return {
      ...booking,
      service_name: service?.name ?? null,
      staff_name: staff?.name ?? null,
      customer_name: customer?.name ?? null,
      customer_email: customer?.email ?? null,
      customer_phone: customer?.phone ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Customers / services / staff
// ---------------------------------------------------------------------------

export async function listCustomers(
  client: DbClient | null | undefined,
  businessId: string,
): Promise<CustomerRow[]> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("business_id", businessId)
    .order("name", { ascending: true });
  if (error) throw new Error(`listCustomers: ${error.message}`);
  return data ?? [];
}

/** All services including inactive (admin view — public pages use the view). */
export async function listServicesAdmin(
  client: DbClient | null | undefined,
  businessId: string,
): Promise<ServiceRow[]> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("business_id", businessId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`listServicesAdmin: ${error.message}`);
  return data ?? [];
}

/** All staff including inactive (admin view). */
export async function listStaffAdmin(
  client: DbClient | null | undefined,
  businessId: string,
): Promise<StaffRow[]> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("staff")
    .select("*")
    .eq("business_id", businessId)
    .order("name", { ascending: true });
  if (error) throw new Error(`listStaffAdmin: ${error.message}`);
  return data ?? [];
}

/** service_id → staff_ids from the base table (member-readable via RLS). */
export async function listServiceStaff(
  client: DbClient | null | undefined,
  businessId: string,
): Promise<Record<string, string[]>> {
  const supabase = await resolveClient(client);
  const { data: staffRows, error: staffError } = await supabase
    .from("staff")
    .select("id")
    .eq("business_id", businessId);
  if (staffError) throw new Error(`listServiceStaff: ${staffError.message}`);
  const staffIds = (staffRows ?? []).map((s) => s.id);
  if (staffIds.length === 0) return {};

  const { data, error } = await supabase
    .from("service_staff")
    .select("*")
    .in("staff_id", staffIds);
  if (error) throw new Error(`listServiceStaff: ${error.message}`);

  const mapping: Record<string, string[]> = {};
  for (const row of (data ?? []) as ServiceStaffRow[]) {
    (mapping[row.service_id] ??= []).push(row.staff_id);
  }
  return mapping;
}

// ---------------------------------------------------------------------------
// Availability configuration
// ---------------------------------------------------------------------------

export async function listAvailabilityRules(
  client: DbClient | null | undefined,
  businessId: string,
): Promise<AvailabilityRuleRow[]> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("availability_rules")
    .select("*")
    .eq("business_id", businessId)
    .order("weekday", { ascending: true });
  if (error) throw new Error(`listAvailabilityRules: ${error.message}`);
  return data ?? [];
}

export async function listAvailabilityOverrides(
  client: DbClient | null | undefined,
  businessId: string,
): Promise<AvailabilityOverrideRow[]> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("availability_overrides")
    .select("*")
    .eq("business_id", businessId)
    .order("date", { ascending: true });
  if (error) throw new Error(`listAvailabilityOverrides: ${error.message}`);
  return data ?? [];
}

export async function listBlackoutDates(
  client: DbClient | null | undefined,
  businessId: string,
): Promise<BlackoutDateRow[]> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("blackout_dates")
    .select("*")
    .eq("business_id", businessId)
    .order("date", { ascending: true });
  if (error) throw new Error(`listBlackoutDates: ${error.message}`);
  return data ?? [];
}

export async function listTimeOff(
  client: DbClient | null | undefined,
  businessId: string,
  status?: StaffTimeOffRow["status"],
): Promise<StaffTimeOffRow[]> {
  const supabase = await resolveClient(client);
  let query = supabase
    .from("staff_time_off")
    .select("*")
    .eq("business_id", businessId)
    .order("starts_at", { ascending: true });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(`listTimeOff: ${error.message}`);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Payments summary
// ---------------------------------------------------------------------------

export interface PaymentsSummary {
  count: number;
  succeededCount: number;
  /** Sum of succeeded payment amounts, integer cents. */
  succeededCents: number;
  currency: string;
}

export async function getPaymentsSummary(
  client: DbClient | null | undefined,
  businessId: string,
): Promise<PaymentsSummary> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("business_id", businessId);
  if (error) throw new Error(`getPaymentsSummary: ${error.message}`);

  const rows = (data ?? []) as PaymentRow[];
  const succeeded = rows.filter((p) => p.status === "succeeded");
  return {
    count: rows.length,
    succeededCount: succeeded.length,
    succeededCents: succeeded.reduce((sum, p) => sum + p.amount_cents, 0),
    currency: rows[0]?.currency ?? "usd",
  };
}
