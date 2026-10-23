/**
 * Booking writes/reads via the SECURITY DEFINER RPCs in migration 00010.
 *
 * Anon callers can never touch the bookings/customers tables directly
 * (Row Level Security, no anon policies) — `create_booking`,
 * `manage_booking`, and `get_booking_receipt` validate the slot, find or
 * create the customer, snapshot the price, and issue/rotate the manage
 * token inside one transaction.
 *
 * Manage-token lifecycle: 32 random bytes, sha256 hash stored, 72h expiry.
 * The RAW token is returned exactly once per issuance (create + every
 * manage call rotates it) and is never stored — treat it like a password.
 */
import { createClient } from "@/lib/supabase/server";

import type {
  BookingRow,
  BookingSource,
  BusinessPublicRow,
  DbBookingStatus,
  DbClient,
  ServicePublicRow,
  StaffPublicRow,
} from "./types";

async function resolveClient(client?: DbClient): Promise<DbClient> {
  return client ?? (await createClient());
}

// ---------------------------------------------------------------------------
// create_booking
// ---------------------------------------------------------------------------

export interface CreateBookingPayload {
  businessId: string;
  serviceId: string;
  staffId: string;
  /** ISO timestamptz. Duration must equal the service's duration_minutes. */
  startsAt: string;
  endsAt: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerNotes?: string;
  source?: BookingSource;
}

export interface CreateBookingResult {
  booking: BookingRow;
  customer_id: string;
  /** RAW manage token — shown to the customer once, never stored. */
  manage_token: string;
  status: DbBookingStatus;
  hold_expires_at: string | null;
  amount_due_cents: number;
}

export async function createBooking(
  client: DbClient | null | undefined,
  payload: CreateBookingPayload,
): Promise<CreateBookingResult> {
  const supabase = await resolveClient(client ?? undefined);
  const { data, error } = await supabase.rpc("create_booking", {
    p_business_id: payload.businessId,
    p_service_id: payload.serviceId,
    p_staff_id: payload.staffId,
    p_starts_at: payload.startsAt,
    p_ends_at: payload.endsAt,
    p_customer_name: payload.customerName,
    p_customer_phone: payload.customerPhone ?? null,
    p_customer_email: payload.customerEmail ?? null,
    p_customer_notes: payload.customerNotes ?? "",
    p_source: payload.source ?? "online",
  });
  if (error) throw new Error(`create_booking: ${error.message}`);
  return data as unknown as CreateBookingResult;
}

// ---------------------------------------------------------------------------
// manage_booking
// ---------------------------------------------------------------------------

export type ManageBookingAction = "cancel" | "reschedule";

export interface ManageBookingOptions {
  reason?: string | null;
  newStartsAt?: string | null;
  newEndsAt?: string | null;
  newStaffId?: string | null;
}

export interface ManageBookingResult {
  booking: BookingRow;
  /** RAW manage token — ROTATED by every manage call; the old link dies. */
  manage_token: string;
}

export async function manageBooking(
  client: DbClient | null | undefined,
  token: string,
  action: ManageBookingAction,
  opts: ManageBookingOptions = {},
): Promise<ManageBookingResult> {
  const supabase = await resolveClient(client ?? undefined);
  const { data, error } = await supabase.rpc("manage_booking", {
    p_token: token,
    p_action: action,
    p_reason: opts.reason ?? null,
    p_new_starts_at: opts.newStartsAt ?? null,
    p_new_ends_at: opts.newEndsAt ?? null,
    p_new_staff_id: opts.newStaffId ?? null,
  });
  if (error) throw new Error(`manage_booking: ${error.message}`);
  return data as unknown as ManageBookingResult;
}

// ---------------------------------------------------------------------------
// get_booking_receipt
// ---------------------------------------------------------------------------

export interface BookingReceipt {
  booking: BookingRow;
  business: BusinessPublicRow | null;
  service: ServicePublicRow | null;
  staff: StaffPublicRow | null;
  customer: { id: string; name: string } | null;
  payments: {
    id: string;
    kind: "deposit" | "full_payment";
    amount_cents: number;
    status: string;
    created_at: string;
  }[];
}

export async function getBookingReceipt(
  client: DbClient | null | undefined,
  token: string,
): Promise<BookingReceipt> {
  const supabase = await resolveClient(client ?? undefined);
  const { data, error } = await supabase.rpc("get_booking_receipt", {
    p_token: token,
  });
  if (error) throw new Error(`get_booking_receipt: ${error.message}`);
  return data as unknown as BookingReceipt;
}
