/**
 * Public booking API contract types (Wave 3A).
 *
 * These mirror the HTTP contract implemented in parallel by the API wave.
 * Client-safe: no imports from server-only modules (tokens, stripe,
 * notify/sender, env). When the QA wave integrates, these types pin the
 * expected shapes for /api/availability, /api/bookings,
 * /api/payments/create-intent, and /api/bookings/manage.
 */

export type ApiSlotStatus = "open" | "closed" | "fully_booked";

/** One slot from GET /api/availability. */
export interface ApiSlot {
  /** ISO-8601 UTC instant. */
  startsAt: string;
  /** ISO-8601 UTC instant. */
  endsAt: string;
  /** Staff member this slot belongs to. */
  staffId: string;
}

/** One day from GET /api/availability. */
export interface ApiDayAvailability {
  /** Business-local YYYY-MM-DD. */
  date: string;
  status: ApiSlotStatus;
  slots: ApiSlot[];
  reason?: string;
}

export interface AvailabilityResponse {
  business: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
  days: ApiDayAvailability[];
}

export interface CreateBookingCustomer {
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface CreateBookingRequest {
  businessId: string;
  serviceId: string;
  /** Staff uuid, or "any" for first-available. */
  staffId: string;
  /** ISO-8601 UTC instants. */
  startsAt: string;
  endsAt: string;
  customer: CreateBookingCustomer;
}

export type CreateBookingStatus = "confirmed" | "payment_pending";
export type AmountDueKind = "deposit" | "full_payment";

export interface CreateBookingResponse {
  bookingId: string;
  manageToken: string;
  status: CreateBookingStatus;
  /** ISO-8601 UTC instant or null when no payment is due now. */
  holdExpiresAt: string | null;
  amountDueCents: number;
  amountDueKind: AmountDueKind | null;
}

export interface CreateIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  amountCents: number;
  kind: AmountDueKind;
}

/** Booking row as returned by GET /api/bookings/receipt (shape subset). */
export interface ReceiptBooking {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  manageToken?: string;
}

export interface ReceiptPayment {
  id: string;
  amountCents: number;
  status: string;
  paymentReference?: string | null;
}

export interface ReceiptResponse {
  booking: ReceiptBooking & { freeCancelUntil?: string | null };
  business: {
    id: string;
    name: string;
    timezone: string;
    phone?: string | null;
    address?: string | null;
  };
  service: {
    id: string;
    name: string;
    durationMinutes: number;
    priceCents: number;
  };
  staff: { id: string; name: string; photoUrl?: string | null } | null;
  customer: { name: string; phone?: string | null; email?: string | null };
  payments: ReceiptPayment[];
  receiptLines: { label: string; amountCents: number }[];
}

export type ManageAction = "cancel" | "reschedule";

export interface ManageBookingRequest {
  token: string;
  action: ManageAction;
  reason?: string;
  /** ISO-8601 UTC instants, for reschedule. */
  newStartsAt?: string;
  newEndsAt?: string;
  newStaffId?: string;
}

export interface ManageBookingResponse {
  booking: ReceiptBooking;
  /** Rotated after every manage action. */
  manageToken: string;
  refund?: {
    amountCents: number;
    reference: string;
    status: string;
  } | null;
}

export interface CustomerLookupResponse {
  name: string;
  email: string | null;
}

export interface ApiErrorBody {
  code: string;
  message?: string;
}

/**
 * Client-side shape check for manage tokens / booking ids before any
 * network call: URL-safe, at least 20 chars. Forged/expired tokens still
 * fail server-side; this just avoids pointless requests.
 */
export function isValidTokenShape(token: string): boolean {
  return /^[A-Za-z0-9_-]{20,}$/.test(token);
}

/**
 * Fetch wrapper that throws an ApiError carrying the parsed JSON error body
 * (code/message) and the HTTP status, so callers can branch on
 * `slot_taken`, `hold_expired`, etc.
 */
export class ApiError extends Error {
  code: string;
  status: number;

  constructor(status: number, body: ApiErrorBody | null, fallback: string) {
    super(body?.message ?? body?.code ?? fallback);
    this.name = "ApiError";
    this.code = body?.code ?? "unknown";
    this.status = status;
  }
}

export async function apiJson<T>(res: Response, fallback: string): Promise<T> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    throw new ApiError(res.status, (body as ApiErrorBody | null) ?? null, fallback);
  }
  return body as T;
}

/**
 * The N closest future slots to a missed slot (for the "slot taken
 * mid-flow" race notice). Slots are assumed ascending per day; returns up
 * to `count` slots strictly after `missedStartsAt`, excluding the missed one.
 */
export function pickNearestAlternatives(
  days: ApiDayAvailability[],
  missedStartsAt: string,
  count = 3,
): ApiSlot[] {
  const missed = Date.parse(missedStartsAt);
  const out: ApiSlot[] = [];
  for (const day of days) {
    for (const slot of day.slots) {
      if (Date.parse(slot.startsAt) > missed) {
        out.push(slot);
        if (out.length >= count) return out;
      }
    }
  }
  return out;
}
