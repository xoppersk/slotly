/**
 * POST /api/payments/refund — owner/staff-issued refund (session auth).
 *
 * Requires a signed-in user; the `issue_refund` SECURITY DEFINER function
 * enforces business membership server-side and guarantees total refunds
 * never exceed the payment amount. The route additionally guards the
 * refundable remainder up front (`remainingRefundable`) so Stripe is never
 * asked for more than is refundable. Full and partial refunds supported.
 *
 * 200 { refund }
 */

import { NextResponse, type NextRequest } from "next/server";

import { mapDbError } from "@/lib/api/errors";
import { RefundSchema } from "@/lib/api/schemas";
import { remainingRefundable } from "@/lib/payments/policy";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

import { jsonError, rateLimitOr429, zodError } from "../../_lib/http";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const limited = rateLimitOr429(request, 100);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid_input", "Request body must be JSON.", 400);
  }
  const parsed = RefundSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const { paymentId, amountCents, reason } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonError("unauthorized", "Sign in to issue a refund.", 401);
  }

  // RLS: only owner/staff of the business can read this row.
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id, booking_id, business_id, amount_cents, stripe_payment_intent_id, status")
    .eq("id", paymentId)
    .single();
  if (paymentError || !payment) {
    return jsonError("payment_not_found", "That payment was not found.", 404);
  }
  if (payment.status !== "succeeded") {
    return jsonError(
      "payment_not_refundable",
      "Only succeeded payments can be refunded.",
      400,
    );
  }

  const { data: priorRefunds } = await supabase
    .from("refunds")
    .select("amount_cents")
    .eq("payment_id", paymentId)
    .in("status", ["pending", "succeeded"]);
  const refundable = remainingRefundable(
    payment.amount_cents,
    (priorRefunds ?? []).map((r) => r.amount_cents),
  );

  const requested = amountCents ?? refundable;
  if (requested <= 0) {
    return jsonError(
      "payment_not_refundable",
      "There is nothing left to refund on this payment.",
      400,
    );
  }
  if (requested > refundable) {
    return jsonError(
      "exceeds_refundable_amount",
      "The requested refund exceeds the refundable amount.",
      400,
    );
  }

  const stripe = getStripe();
  let stripeRefundId: string;
  try {
    const stripeRefund = await stripe.refunds.create(
      {
        payment_intent: payment.stripe_payment_intent_id,
        amount: requested,
        reason: "requested_by_customer",
        metadata: { payment_id: paymentId, booking_id: payment.booking_id },
      },
      { idempotencyKey: `slotly:refund:${paymentId}:${requested}` },
    );
    stripeRefundId = stripeRefund.id;
  } catch (err) {
    const mapped = mapDbError(err);
    return jsonError(mapped.code, mapped.message, mapped.status);
  }

  // Session client: issue_refund enforces the caller's membership via RLS.
  const { data: recorded, error: recordError } = await supabase.rpc(
    "issue_refund",
    {
      p_payment_id: paymentId,
      p_amount_cents: requested,
      p_stripe_refund_id: stripeRefundId,
      p_reason: reason ?? null,
    },
  );
  if (recordError || !recorded) {
    // The money moved in Stripe but the record failed — surface loudly so
    // it can be reconciled, rather than pretending the refund completed.
    return jsonError(
      "refund_record_failed",
      "The refund was issued but could not be recorded. Contact support.",
      500,
    );
  }

  return NextResponse.json({ refund: recorded });
}
