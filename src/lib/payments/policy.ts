/**
 * Payment policy math for Slotly's hold-then-pay flow.
 *
 * Pure functions — safe to import from client or server code. Money is
 * always integer cents; display formatting goes through `formatCents`.
 */

import { formatCents } from "../format";

/** Per-service payment policy (mirrors the `services.payment_policy` column). */
export type PaymentPolicy = "none" | "deposit" | "full";

/** Stripe Payment Intent kind — also the idempotency-key kind suffix. */
export type PaymentKind = "deposit" | "full_payment";

export interface AmountDue {
  /** Cents charged right now via the Payment Intent. */
  dueNowCents: number;
  /** Cents still owed (at the appointment, or never for `none`). */
  dueLaterCents: number;
  /** Which intent kind to create, or null when no payment is taken online. */
  kind: PaymentKind | null;
}

function assertCents(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer of cents (got ${value})`);
  }
}

/**
 * Split a service price into what's due now vs later, per payment policy.
 *
 * - `none`    → no online payment; the full price stays due later (at the visit).
 * - `deposit` → charge `depositCents` now, remainder later.
 * - `full`    → charge the whole price now.
 *
 * Throws on invalid input: negative/non-integer amounts, or a deposit
 * larger than the price.
 */
export function amountDueNow({
  paymentPolicy,
  priceCents,
  depositCents,
}: {
  paymentPolicy: PaymentPolicy;
  priceCents: number;
  depositCents: number;
}): AmountDue {
  assertCents("priceCents", priceCents);
  assertCents("depositCents", depositCents);
  if (depositCents > priceCents) {
    throw new Error(
      `depositCents (${depositCents}) cannot exceed priceCents (${priceCents})`,
    );
  }

  switch (paymentPolicy) {
    case "none":
      return { dueNowCents: 0, dueLaterCents: priceCents, kind: null };
    case "deposit":
      return {
        dueNowCents: depositCents,
        dueLaterCents: priceCents - depositCents,
        kind: "deposit",
      };
    case "full":
      return { dueNowCents: priceCents, dueLaterCents: 0, kind: "full_payment" };
    default:
      throw new Error(`Unknown payment policy: ${String(paymentPolicy)}`);
  }
}

/**
 * Build the Stripe idempotency key for a Payment Intent (or refund) attempt.
 * Reusing the same key across retries/double-submits creates exactly one intent.
 */
export function buildIdempotencyKey(bookingId: string, kind: PaymentKind): string {
  if (!bookingId) throw new Error("bookingId is required");
  return `slotly:${bookingId}:${kind}`;
}

/**
 * Cents still refundable on a payment after prior refunds. Never negative —
 * over-refund attempts clamp to 0 (the DB also enforces total ≤ amount).
 */
export function remainingRefundable(
  paymentAmountCents: number,
  priorRefundsCents: number[],
): number {
  assertCents("paymentAmountCents", paymentAmountCents);
  for (const r of priorRefundsCents) assertCents("prior refund", r);
  const refunded = priorRefundsCents.reduce((sum, r) => sum + r, 0);
  return Math.max(0, paymentAmountCents - refunded);
}

export interface AutoRefundCheck {
  bookingStatus: string;
  paymentStatus: string;
  /** When the booking was cancelled. */
  cancelledAt: Date;
  /** When the appointment starts. */
  startsAt: Date;
  /** Free-cancellation window in hours (business booking rule). */
  freeCancelHours: number;
}

/**
 * Whether cancelling this booking should auto-issue a full Stripe refund:
 * the booking is cancelled, its payment succeeded, and the cancellation
 * happened at least `freeCancelHours` before the appointment starts.
 */
export function canAutoRefund({
  bookingStatus,
  paymentStatus,
  cancelledAt,
  startsAt,
  freeCancelHours,
}: AutoRefundCheck): boolean {
  if (bookingStatus !== "cancelled") return false;
  if (paymentStatus !== "succeeded") return false;
  if (!Number.isFinite(freeCancelHours) || freeCancelHours < 0) {
    throw new Error(`freeCancelHours must be >= 0 (got ${freeCancelHours})`);
  }
  const msBeforeStart = startsAt.getTime() - cancelledAt.getTime();
  if (msBeforeStart < 0) return false; // cancelled after the appointment started
  return msBeforeStart >= freeCancelHours * 3_600_000;
}

export interface ReceiptInput {
  amountCents: number;
  currency: string;
  paymentIntentId: string;
  kind: PaymentKind;
  /** Remainder owed at the appointment (deposits only). */
  dueLaterCents?: number;
}

/**
 * Plain-text receipt lines for the confirmation screen / email, e.g.
 * ["Amount charged: $20.00", "Payment reference: pi_3P…", "Paid in full"].
 */
export function formatReceipt({
  amountCents,
  currency,
  paymentIntentId,
  kind,
  dueLaterCents = 0,
}: ReceiptInput): string[] {
  assertCents("amountCents", amountCents);
  assertCents("dueLaterCents", dueLaterCents);
  if (!paymentIntentId) throw new Error("paymentIntentId is required");

  const lines = [
    `Amount charged: ${formatCents(amountCents, currency)}`,
    `Payment reference: ${paymentIntentId}`,
  ];
  if (kind === "deposit") {
    lines.push(
      dueLaterCents > 0
        ? `Due at your appointment: ${formatCents(dueLaterCents, currency)}`
        : "Deposit paid in full — nothing due at your appointment",
    );
  } else {
    lines.push("Paid in full — nothing due at your appointment");
  }
  return lines;
}
