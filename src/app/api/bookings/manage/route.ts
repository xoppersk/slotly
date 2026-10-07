/**
 * POST /api/bookings/manage — cancel or reschedule via magic link (no auth).
 *
 * Verifies the token shape, then delegates to the `manage_booking` SECURITY
 * DEFINER function (hash verification, expiry, rotation all in Postgres).
 * Cancelling inside the free-cancel window with a succeeded payment
 * auto-issues a full Stripe refund (service role for the Stripe call, then
 * `issue_refund`); the cancellation notice carries the refund amount.
 *
 * 200 { booking, manageToken, refund? }
 */

import { NextResponse, type NextRequest } from "next/server";

import { mapDbError } from "@/lib/api/errors";
import { ManageBookingSchema } from "@/lib/api/schemas";
import { formatCents } from "@/lib/format";
import {
  bookingCancelled,
  bookingRescheduled,
} from "@/lib/notify/templates";
import { canAutoRefund } from "@/lib/payments/policy";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { verifyManageTokenFormat } from "@/lib/tokens";

import {
  loadBusinessContact,
  loadNotifyContext,
  manageUrlFor,
  sendBookingNotification,
} from "../../_lib/booking-notify";
import { jsonError, rateLimitOr429, zodError } from "../../_lib/http";

interface ManagedBooking {
  id: string;
  business_id: string;
  status: string;
  starts_at: string;
  cancelled_at: string | null;
}

interface ManageResult {
  booking: ManagedBooking;
  manage_token: string;
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
  const parsed = ManageBookingSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const { token, action, reason, newStartsAt, newEndsAt, newStaffId } = parsed.data;

  if (!verifyManageTokenFormat(token)) {
    return jsonError("invalid_manage_token", "This manage link is invalid.", 400);
  }

  const supabase = await createClient();
  const { data: raw, error } = await supabase.rpc("manage_booking", {
    p_token: token,
    p_action: action,
    p_reason: reason ?? null,
    p_new_starts_at: newStartsAt ?? null,
    p_new_ends_at: newEndsAt ?? null,
    p_new_staff_id: newStaffId ?? null,
  });
  if (error || !raw) {
    const mapped = mapDbError(error);
    return jsonError(mapped.code, mapped.message, mapped.status);
  }
  const result = raw as unknown as ManageResult;
  const booking = result.booking;

  let refund: { id: string; amountCents: number } | undefined;

  if (action === "cancel") {
    refund = (await maybeAutoRefund(booking)) ?? undefined;

    const notifyCtx = await loadNotifyContext(
      booking.id,
      manageUrlFor(result.manage_token),
      refund ? formatCents(refund.amountCents, "usd") : undefined,
    );
    if (notifyCtx) {
      const contact = await loadBusinessContact(booking.business_id);
      sendBookingNotification({
        ctx: notifyCtx,
        bookingId: booking.id,
        customerTemplate: bookingCancelled(notifyCtx.template),
        businessEmail: contact?.email ?? null,
        kind: "cancellation",
      });
    }
  } else {
    const notifyCtx = await loadNotifyContext(
      booking.id,
      manageUrlFor(result.manage_token),
    );
    if (notifyCtx) {
      const contact = await loadBusinessContact(booking.business_id);
      sendBookingNotification({
        ctx: notifyCtx,
        bookingId: booking.id,
        customerTemplate: bookingRescheduled(notifyCtx.template),
        businessEmail: contact?.email ?? null,
        kind: "reschedule",
      });
    }
  }

  return NextResponse.json({
    booking: result.booking,
    manageToken: result.manage_token,
    ...(refund ? { refund } : {}),
  });
}

/**
 * Auto-refund when a cancellation lands inside the business's
 * free-cancel window and the booking's payment succeeded. Runs with the
 * service role (system-initiated, not a signed-in member): Stripe refund
 * first, then the `issue_refund` record. Returns the refund summary, or
 * null when no auto-refund applies.
 */
async function maybeAutoRefund(
  booking: ManagedBooking,
): Promise<{ id: string; amountCents: number } | null> {
  const svc = createServiceRoleClient();

  const { data: payment } = await svc
    .from("payments")
    .select("id, amount_cents, stripe_payment_intent_id, status")
    .eq("booking_id", booking.id)
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (!payment) return null;

  const { data: business } = await svc
    .from("businesses")
    .select("free_cancel_hours")
    .eq("id", booking.business_id)
    .single();

  const eligible = canAutoRefund({
    bookingStatus: booking.status,
    paymentStatus: payment.status,
    cancelledAt: new Date(booking.cancelled_at ?? Date.now()),
    startsAt: new Date(booking.starts_at),
    freeCancelHours: business?.free_cancel_hours ?? 0,
  });
  if (!eligible) return null;

  const stripe = getStripe();
  let stripeRefundId: string;
  try {
    const stripeRefund = await stripe.refunds.create(
      {
        payment_intent: payment.stripe_payment_intent_id,
        amount: payment.amount_cents,
        reason: "requested_by_customer",
        metadata: {
          booking_id: booking.id,
          payment_id: payment.id,
          auto_refund: "true",
        },
      },
      { idempotencyKey: `slotly:auto-refund:${payment.id}` },
    );
    stripeRefundId = stripeRefund.id;
  } catch {
    return null;
  }

  const { data: recorded, error } = await svc.rpc("issue_refund", {
    p_payment_id: payment.id,
    p_amount_cents: payment.amount_cents,
    p_stripe_refund_id: stripeRefundId,
    p_reason: "Auto-refund: cancelled inside the free-cancel window",
  });
  if (error || !recorded) return null;
  const row = recorded as unknown as { id: string };
  return { id: row.id, amountCents: payment.amount_cents };
}
