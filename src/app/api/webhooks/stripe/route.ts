/**
 * POST /api/webhooks/stripe — Stripe event ingestion (test mode).
 *
 * Reads the RAW body (no JSON parsing first), verifies the
 * `stripe-signature` header against STRIPE_WEBHOOK_SECRET (300s tolerance),
 * then inserts into `webhook_events` keyed by `stripe_event_id` — a
 * duplicate event id is a 200 no-op, giving exactly-once processing.
 *
 * Handled events:
 * - payment_intent.succeeded   -> payment succeeded, booking confirmed,
 *                                manage token rotated (the raw token is only
 *                                known to the customer, so the confirmation
 *                                email carries a fresh manage link),
 *                                confirmation notifications fire.
 * - payment_intent.payment_failed -> payment failed, booking payment_failed
 *                                (hold released; the wizard shows the retry).
 * - charge.refunded            -> matching refund rows -> succeeded.
 * Unknown types are logged and acked (200) so Stripe stops retrying.
 *
 * Runs with the service-role client (bypasses RLS) — server only.
 */

import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import {
  bookingConfirmationBusiness,
  bookingConfirmationCustomer,
} from "@/lib/notify/templates";
import { verifyWebhookSignature } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Database, Json } from "@/lib/supabase/types";
import { createManageToken, MANAGE_TOKEN_TTL_MS } from "@/lib/tokens";
import { formatCents } from "@/lib/format";

import {
  loadBusinessContact,
  loadNotifyContext,
  manageUrlFor,
  sendBookingNotification,
} from "../../_lib/booking-notify";
import { jsonError } from "../../_lib/http";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

async function markEvent(
  svc: ServiceClient,
  eventId: string,
  status: "processed" | "failed",
): Promise<void> {
  await svc
    .from("webhook_events")
    .update({ status, processed_at: new Date().toISOString() })
    .eq("stripe_event_id", eventId);
}

async function setEventBusiness(
  svc: ServiceClient,
  eventId: string,
  businessId: string,
): Promise<void> {
  await svc
    .from("webhook_events")
    .update({ business_id: businessId })
    .eq("stripe_event_id", eventId);
}

async function handlePaymentSucceeded(
  svc: ServiceClient,
  pi: Stripe.PaymentIntent,
): Promise<void> {
  const { data: payment } = await svc
    .from("payments")
    .select("id, booking_id, business_id, amount_cents, currency, kind, status")
    .eq("stripe_payment_intent_id", pi.id)
    .single();
  if (!payment) {
    throw new Error(`No payment row for intent ${pi.id}`);
  }

  await svc.from("payments").update({ status: "succeeded" }).eq("id", payment.id);
  await svc
    .from("bookings")
    .update({ status: "confirmed", hold_expires_at: null })
    .eq("id", payment.booking_id);

  // The webhook cannot recover the customer's raw manage token (only its
  // hash is stored), so rotate it: the confirmation email carries the fresh
  // manage link. Treat payment confirmation as a token use, consistent with
  // manage_booking's rotation semantics.
  const fresh = createManageToken();
  await svc
    .from("bookings")
    .update({
      manage_token_hash: fresh.tokenHash,
      manage_token_expires_at: new Date(
        Date.now() + MANAGE_TOKEN_TTL_MS,
      ).toISOString(),
    })
    .eq("id", payment.booking_id);

  const { data: booking } = await svc
    .from("bookings")
    .select("price_cents")
    .eq("id", payment.booking_id)
    .single();

  const notifyCtx = await loadNotifyContext(
    payment.booking_id,
    manageUrlFor(fresh.token),
  );
  if (notifyCtx) {
    const dueLater = Math.max(
      0,
      (booking?.price_cents ?? payment.amount_cents) - payment.amount_cents,
    );
    notifyCtx.template.amountCharged = formatCents(
      payment.amount_cents,
      payment.currency,
    );
    if (payment.kind === "deposit" && dueLater > 0) {
      notifyCtx.template.amountDueLater = formatCents(dueLater, payment.currency);
    }
    const contact = await loadBusinessContact(payment.business_id);
    sendBookingNotification({
      ctx: notifyCtx,
      bookingId: payment.booking_id,
      customerTemplate: bookingConfirmationCustomer(notifyCtx.template),
      businessTemplate: bookingConfirmationBusiness(notifyCtx.template),
      businessEmail: contact?.email ?? null,
      kind: "confirmation",
    });
  }
}

async function handlePaymentFailed(
  svc: ServiceClient,
  pi: Stripe.PaymentIntent,
): Promise<void> {
  const { data: payment } = await svc
    .from("payments")
    .select("id, booking_id")
    .eq("stripe_payment_intent_id", pi.id)
    .single();
  if (!payment) {
    throw new Error(`No payment row for intent ${pi.id}`);
  }
  const failureCode =
    typeof pi.last_payment_error?.code === "string"
      ? pi.last_payment_error.code
      : "payment_failed";
  await svc
    .from("payments")
    .update({ status: "failed", failure_code: failureCode })
    .eq("id", payment.id);
  // Release the hold so the slot becomes bookable again.
  await svc
    .from("bookings")
    .update({ status: "payment_failed", hold_expires_at: null })
    .eq("id", payment.booking_id);
}

async function handleChargeRefunded(
  svc: ServiceClient,
  charge: Stripe.Charge,
): Promise<void> {
  const refundIds = (charge.refunds?.data ?? []).map((r) => r.id);
  for (const refundId of refundIds) {
    await svc
      .from("refunds")
      .update({ status: "succeeded" })
      .eq("stripe_refund_id", refundId);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return jsonError("missing_signature", "Missing stripe-signature header.", 400);
  }

  let event: Stripe.Event;
  try {
    event = verifyWebhookSignature(rawBody, signature);
  } catch {
    return jsonError("invalid_signature", "Invalid webhook signature.", 400);
  }

  const svc = createServiceRoleClient();

  // Dedup: the unique stripe_event_id makes replays a no-op.
  const payload = JSON.parse(JSON.stringify(event)) as Json;
  const { error: insertError } = await svc.from("webhook_events").insert({
    stripe_event_id: event.id,
    type: event.type,
    payload,
    status: "received",
  } satisfies Database["public"]["Tables"]["webhook_events"]["Insert"]);
  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ received: true, deduped: true });
    }
    return jsonError("internal_error", "Could not record the webhook event.", 500);
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSucceeded(svc, pi);
        const bizId = await businessIdForPayment(svc, pi.id);
        if (bizId) await setEventBusiness(svc, event.id, bizId);
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(svc, pi);
        const bizId = await businessIdForPayment(svc, pi.id);
        if (bizId) await setEventBusiness(svc, event.id, bizId);
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await handleChargeRefunded(svc, charge);
        break;
      }
      default:
        // Unknown types are logged and acked so Stripe stops retrying.
        break;
    }
    await markEvent(svc, event.id, "processed");
  } catch (err) {
    await markEvent(svc, event.id, "failed");
    return jsonError(
      "internal_error",
      err instanceof Error ? "Webhook handling failed." : "Webhook handling failed.",
      500,
    );
  }

  return NextResponse.json({ received: true });
}

async function businessIdForPayment(
  svc: ServiceClient,
  paymentIntentId: string,
): Promise<string> {
  const { data } = await svc
    .from("payments")
    .select("business_id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .single();
  return data?.business_id ?? "";
}
