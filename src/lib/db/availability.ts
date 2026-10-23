/**
 * Availability via the `get_availability` SECURITY DEFINER RPC
 * (migration 00010). The function runs as the migration owner (bypasses
 * Row Level Security) and returns everything the slot engine needs —
 * rules, overrides, blackouts, approved time off, and blocking bookings —
 * with NO customer data. This is the only public availability path; the
 * underlying tables have no anon policies.
 *
 * Returned JSON shape (documented in PROD-W1.md):
 * {
 *   business: { id, name, slug, timezone, slot_step_minutes,
 *               min_lead_time_minutes, max_advance_days, free_cancel_hours },
 *   service:  { id, name, duration_minutes, buffer_before_minutes,
 *               buffer_after_minutes, payment_policy, price_cents,
 *               deposit_cents },
 *   staff:    [{ id, name, title, photo_url }],   // offer this service
 *   rules:    [{ staff_id|null, weekday, open_time, close_time, is_closed }],
 *   overrides:[{ staff_id|null, date, open_time, close_time, is_closed, reason }],
 *   blackouts:[{ date, reason }],
 *   time_off: [{ staff_id, starts_at, ends_at, reason }],
 *   bookings: [{ staff_id, starts_at, ends_at }]  // blocking statuses only
 * }
 */
import { createClient } from "@/lib/supabase/server";

import type { DbClient } from "./types";

export interface AvailabilityBusiness {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  slot_step_minutes: number;
  min_lead_time_minutes: number;
  max_advance_days: number;
  free_cancel_hours: number;
}

export interface AvailabilityService {
  id: string;
  name: string;
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  payment_policy: "none" | "deposit" | "full";
  price_cents: number;
  deposit_cents: number;
}

export interface AvailabilityStaff {
  id: string;
  name: string;
  title: string | null;
  photo_url: string | null;
}

export interface AvailabilityRule {
  staff_id: string | null;
  /** 0 = Sunday … 6 = Saturday (PostgreSQL extract(dow)). */
  weekday: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

export interface AvailabilityOverride {
  staff_id: string | null;
  date: string;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
  reason: string | null;
}

export interface AvailabilityBlackout {
  date: string;
  reason: string | null;
}

export interface AvailabilityTimeOff {
  staff_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

export interface AvailabilityBooking {
  staff_id: string;
  starts_at: string;
  ends_at: string;
}

export interface Availability {
  business: AvailabilityBusiness;
  service: AvailabilityService;
  staff: AvailabilityStaff[];
  rules: AvailabilityRule[];
  overrides: AvailabilityOverride[];
  blackouts: AvailabilityBlackout[];
  time_off: AvailabilityTimeOff[];
  bookings: AvailabilityBooking[];
}

export interface GetAvailabilityParams {
  businessId: string;
  serviceId: string;
  staffId?: string | null;
  /** YYYY-MM-DD, in the business timezone. Defaults server-side to today. */
  from?: string;
  /** YYYY-MM-DD. Range must be ≤ 93 days. Defaults to from + 60 days. */
  to?: string;
}

export async function getAvailability(
  client: DbClient | null | undefined,
  params: GetAvailabilityParams,
): Promise<Availability> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.rpc("get_availability", {
    p_business_id: params.businessId,
    p_service_id: params.serviceId,
    p_staff_id: params.staffId ?? null,
    p_from_date: params.from,
    p_to_date: params.to,
  });
  if (error) throw new Error(`get_availability: ${error.message}`);
  return data as unknown as Availability;
}
