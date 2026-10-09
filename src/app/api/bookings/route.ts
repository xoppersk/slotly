/**
 * POST /api/bookings — create a booking (public, hold-then-pay).
 *
 * Defense in depth: the requested slot is re-checked against the pure TS
 * availability engine before the write, but the Postgres EXCLUDE constraint
 * inside `create_booking` is the real race guard (23P01 -> 409).
 *
 * `staffId: "any"` resolves to the first staff (service order) whose grid
 * still contains the requested slot. When the service's payment policy is
 * `none` the booking is confirmed immediately and confirmation
 * notifications fan out fire-and-forget; otherwise the booking sits in
 * `payment_pending` until the Stripe webhook confirms it.
 */

import { NextResponse, type NextRequest } from "next/server";

import {
  mapAvailabilityPayload,
  type PerStaffInput,
} from "@/lib/api/availability-mapping";
import { mapDbError } from "@/lib/api/errors";
import { CreateBookingSchema } from "@/lib/api/schemas";
import { generateSlotsForDay } from "@/lib/availability";
import {
  bookingConfirmationBusiness,
  bookingConfirmationCustomer,
} from "@/lib/notify/templates";
import { createClient } from "@/lib/supabase/server";
import { toBusinessDayKey } from "@/lib/timezone";

import {
  loadBusinessContact,
  loadNotifyContext,
  manageUrlFor,
  sendBookingNotification,
} from "../_lib/booking-notify";
import { jsonError, jsonOk, rateLimitOr429, zodError } from "../_lib/http";
import {
  DEMO_BOOKING_REF,
  DEMO_BUSINESS_ID,
  demoAvailability,
  demoServices,
  demoStaff,
} from "@/lib/demo-data";

/**
 * Demo fallback: create a synthetic (non-persisted) booking for the
 * Harbor & Pine demo business. The requested slot is validated against
 * the synthetic availability grid, so the demo funnel behaves like the
 * real one — including the slot-taken race guard — without touching the
 * database. Payment-policy services other than `none` cannot complete
 * in demo mode (no Stripe intent); the payment step surfaces its
 * designed error state instead.
 */
function demoCreateBooking({
  serviceId,
  staffId,
  startsAt,
  endsAt,
}: {
  serviceId: string;
  staffId: string;
  startsAt: string;
  endsAt: string;
}) {
  const service = demoServices.find((s) => s.id === serviceId);
  if (!service) {
    return jsonError("service_not_found", "That service was not found.", 404);
  }
  if (service.payment_policy !== "none") {
    return jsonError(
      "payment_unavailable",
      "Online payment isn't available in the demo — please choose a pay-at-visit service.",
      400,
    );
  }
  const staff =
    staffId === "any"
      ? demoStaff[0]!
      : (demoStaff.find((m) => m.id === staffId) ?? null);
  if (!staff) {
    return jsonError(
      "staff_not_found",
      "That staff member was not found.",
      404,
    );
  }
  const localDate = startsAt.slice(0, 10);
  const day = demoAvailability(localDate, localDate, staff.id)[0];
  const slotOk = day?.slots.some(
    (s) => s.startsAt === startsAt && s.endsAt === endsAt,
  );
  if (!slotOk) {
    return jsonError(
      "slot_taken",
      "That slot is no longer available. Please pick another time.",
      409,
    );
  }
  const tokenBytes = crypto.getRandomValues(new Uint8Array(24));
  const manageToken = `demo-${Buffer.from(tokenBytes).toString("hex")}`;
  return jsonOk({
    bookingId: `demo-${DEMO_BOOKING_REF}`,
    manageToken,
    status: "confirmed",
    holdExpiresAt: null,
    amountDueCents: 0,
    amountDueKind: null,
  });
}

/** Find the staff that can take this exact slot, or null when none can. */
function resolveStaff(
  perStaff: PerStaffInput[],
  requestedStaffId: string,
  localDate: string,
  startsAt: string,
  endsAt: string,
): PerStaffInput | null {
  const candidates =
    requestedStaffId === "any"
      ? perStaff
      : perStaff.filter((s) => s.staffId === requestedStaffId);
  for (const staff of candidates) {
    const slots = generateSlotsForDay(staff.input, localDate, staff.staffId);
    if (slots.some((s) => s.startsAt === startsAt && s.endsAt === endsAt)) {
      return staff;
    }
  }
  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const limited = rateLimitOr429(request, 100);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid_input", "Request body must be JSON.", 400);
  }
  const parsed = CreateBookingSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const { businessId, serviceId, staffId, startsAt, endsAt, customer } = parsed.data;

  if (businessId === DEMO_BUSINESS_ID) {
    return demoCreateBooking({ serviceId, staffId, startsAt, endsAt });
  }

  const supabase = await createClient();

  // Defense in depth: re-check the slot against the engine. p_staff_id is
  // null so the function returns every staff performing the service; the
  // "any" resolution and the concrete-staff check both happen locally.
  const rangeFrom = startsAt.slice(0, 10);
  const rangeTo = endsAt.slice(0, 10);
  const { data: availability, error: availabilityError } = await supabase.rpc(
    "get_availability",
    {
      p_business_id: businessId,
      p_service_id: serviceId,
      p_staff_id: null,
      p_from_date: rangeFrom,
      p_to_date: rangeTo,
    },
  );
  if (availabilityError || !availability) {
    return jsonError("availability_failed", "Could not verify the slot.", 500);
  }

  let mapped;
  try {
    mapped = mapAvailabilityPayload(availability, new Date().toISOString());
  } catch {
    return jsonError("availability_failed", "Could not verify the slot.", 500);
  }

  const localDate = toBusinessDayKey(startsAt, mapped.business.timezone);
  const resolved = resolveStaff(
    mapped.perStaff,
    staffId,
    localDate,
    startsAt,
    endsAt,
  );
  if (!resolved) {
    return jsonError(
      "slot_taken",
      "That slot is no longer available. Please pick another time.",
      409,
    );
  }

  // Service payment policy drives what happens after the hold is created.
  const { data: service, error: serviceError } = await supabase
    .from("services_public")
    .select("id, payment_policy, price_cents, deposit_cents")
    .eq("id", serviceId)
    .single();
  if (serviceError || !service) {
    return jsonError("service_not_found", "That service was not found.", 404);
  }
  const amountDueKind =
    service.payment_policy === "deposit"
      ? "deposit"
      : service.payment_policy === "full"
        ? "full_payment"
        : null;

  const { data: created, error: createError } = await supabase.rpc(
    "create_booking",
    {
      p_business_id: businessId,
      p_service_id: serviceId,
      p_staff_id: resolved.staffId,
      p_starts_at: startsAt,
      p_ends_at: endsAt,
      p_customer_name: customer.name,
      p_customer_phone: customer.phone ?? null,
      p_customer_email: customer.email ?? null,
      p_customer_notes: customer.notes ?? "",
      p_source: "online",
    },
  );
  if (createError || !created) {
    const mappedErr = mapDbError(createError);
    return jsonError(mappedErr.code, mappedErr.message, mappedErr.status);
  }

  const result = created as {
    booking: { id: string };
    manage_token: string;
    status: string;
    hold_expires_at: string | null;
    amount_due_cents: number;
  };

  // No-payment bookings confirm immediately: notify both sides.
  if (result.status === "confirmed") {
    const notifyCtx = await loadNotifyContext(
      result.booking.id,
      manageUrlFor(result.manage_token),
    );
    if (notifyCtx) {
      const contact = await loadBusinessContact(businessId);
      sendBookingNotification({
        ctx: notifyCtx,
        bookingId: result.booking.id,
        customerTemplate: bookingConfirmationCustomer(notifyCtx.template),
        businessTemplate: bookingConfirmationBusiness(notifyCtx.template),
        businessEmail: contact?.email ?? null,
        kind: "confirmation",
      });
    }
  }

  return NextResponse.json(
    {
      bookingId: result.booking.id,
      manageToken: result.manage_token,
      status: result.status,
      holdExpiresAt: result.hold_expires_at,
      amountDueCents: result.amount_due_cents,
      amountDueKind,
    },
    { status: 201 },
  );
}
