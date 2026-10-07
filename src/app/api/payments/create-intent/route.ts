/**
 * POST /api/payments/create-intent — create (or reuse) a Stripe Payment
 * Intent for a held booking.
 *
 * The booking must be `payment_pending` with a live hold. The idempotency
 * key `slotly:{booking_id}:{kind}` makes retries and double-submits create
 * exactly one intent. When a payment row already exists for the kind in a
 * payable state, the existing intent's client secret is returned instead of
 * creating a duplicate.
 *
 * 200 { clientSecret, paymentIntentId, amountCents, kind }
 * 400 invalid_manage_token | 410 hold_expired | 409 payment_in_progress
 */

import { NextResponse, type NextRequest } from "next/server";

import { mapDbError } from "@/lib/api/errors";
import { CreateIntentSchema } from "@/lib/api/schemas";
import { getStripe } from "@/lib/stripe";
import {
  amountDueNow,
  buildIdempotencyKey,
  type PaymentKind,
} from "@/lib/payments/policy";
import { createClient } from "@/lib/supabase/server";
import { verifyManageTokenFormat } from "@/lib/tokens";

import { jsonError, rateLimitOr429, zodError } from "../../_lib/http";

interface ReceiptPaymentRow {
  kind: string;
  status: string;
  stripe_payment_intent_id: string;
  amount_cents: number;
}

interface ReceiptLike {
  booking: {
    id: string;
    business_id: string;
    status: string;
    hold_expires_at: string | null;
    price_cents: number;
  };
  service: {
    payment_policy: string;
    deposit_cents: number;
    price_cents: number;
  };
  payments?: ReceiptPaymentRow[];
}

const REUSABLE_STATUSES = new Set(["requires_payment", "processing"]);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const limited = rateLimitOr429(request, 100);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid_input", "Request body must be JSON.", 400);
  }
  const parsed = CreateIntentSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const { manageToken } = parsed.data;

  if (!verifyManageTokenFormat(manageToken)) {
    return jsonError("invalid_manage_token", "This manage link is invalid.", 400);
  }

  const supabase = await createClient();
  const { data: rawReceipt, error: receiptError } = await supabase.rpc(
    "get_booking_receipt",
    { p_token: manageToken },
  );
  if (receiptError || !rawReceipt) {
    const mapped = mapDbError(receiptError);
    return jsonError(mapped.code, mapped.message, mapped.status);
  }
  const receipt = rawReceipt as unknown as ReceiptLike;
  const booking = receipt.booking;

  if (booking.status !== "payment_pending") {
    return jsonError(
      "booking_not_payable",
      "This booking cannot be paid online.",
      400,
    );
  }
  if (
    booking.hold_expires_at &&
    Date.parse(booking.hold_expires_at) <= Date.now()
  ) {
    return jsonError(
      "hold_expired",
      "Your payment hold expired. Please book again.",
      410,
    );
  }

  const policy = receipt.service.payment_policy;
  const kind: PaymentKind | null =
    policy === "deposit" ? "deposit" : policy === "full" ? "full_payment" : null;
  if (!kind) {
    return jsonError(
      "booking_not_payable",
      "This booking does not require online payment.",
      400,
    );
  }

  const due = amountDueNow({
    paymentPolicy: policy as "deposit" | "full",
    priceCents: booking.price_cents ?? receipt.service.price_cents ?? 0,
    depositCents: receipt.service.deposit_cents ?? 0,
  });
  if (due.dueNowCents <= 0) {
    return jsonError(
      "booking_not_payable",
      "There is nothing to charge for this booking.",
      400,
    );
  }

  const stripe = getStripe();

  // Reuse: an in-flight intent for this (booking, kind) already exists —
  // return its client secret instead of creating a duplicate.
  const existing = (receipt.payments ?? []).find(
    (p) => p.kind === kind && REUSABLE_STATUSES.has(p.status),
  );
  if (existing) {
    try {
      const pi = await stripe.paymentIntents.retrieve(
        existing.stripe_payment_intent_id,
      );
      if (pi.client_secret) {
        return NextResponse.json({
          clientSecret: pi.client_secret,
          paymentIntentId: pi.id,
          amountCents: existing.amount_cents,
          kind,
        });
      }
    } catch {
      // The intent is gone server-side (or unreachable) — fall through and
      // create a fresh one under the same idempotency key.
    }
  }

  let intent;
  try {
    intent = await stripe.paymentIntents.create(
      {
        amount: due.dueNowCents,
        currency: "usd",
        metadata: {
          booking_id: booking.id,
          business_id: booking.business_id,
        },
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      },
      { idempotencyKey: buildIdempotencyKey(booking.id, kind) },
    );
  } catch (err) {
    const mapped = mapDbError(err);
    return jsonError(mapped.code, mapped.message, mapped.status);
  }

  if (!intent.client_secret) {
    return jsonError(
      "internal_error",
      "Could not start the payment. Please try again.",
      500,
    );
  }

  const { error: recordError } = await supabase.rpc("create_payment_intent", {
    p_token: manageToken,
    p_kind: kind,
    p_stripe_payment_intent_id: intent.id,
  });
  if (recordError) {
    // The intent exists in Stripe under our idempotency key; a retry of
    // this endpoint reuses it via the same key. Tell the client to retry.
    const mapped = mapDbError(recordError);
    return jsonError(mapped.code, mapped.message, mapped.status);
  }

  return NextResponse.json({
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
    amountCents: due.dueNowCents,
    kind,
  });
}
