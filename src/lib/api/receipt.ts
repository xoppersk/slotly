/**
 * Receipt + notification context wiring for Slotly's booking APIs.
 *
 * Pure functions over the `get_booking_receipt` jsonb shape
 * `{booking, business, service, staff, customer, payments[]}`:
 * receipt lines for the confirmation surface, and the `TemplateContext`
 * the notification templates render. No I/O, no secrets — unit-testable.
 */

import { formatInTimeZone } from "date-fns-tz";

import { formatCents } from "../format";
import { formatReceipt, type PaymentKind } from "../payments/policy";
import type { TemplateContext } from "../notify/templates";
import { toBusinessDayKey } from "../timezone";

export interface ReceiptBookingLike {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price_cents: number;
  cancelled_at?: string | null;
}

export interface ReceiptLike {
  booking: ReceiptBookingLike;
  business: {
    name: string;
    timezone: string;
    phone?: string | null;
    address?: string | null;
    free_cancel_hours?: number | null;
  };
  service: {
    name: string;
    payment_policy?: string | null;
    deposit_cents?: number | null;
    price_cents?: number | null;
  };
  staff: { name: string };
  customer: { name: string; email?: string | null; phone?: string | null };
  payments?: Array<{
    amount_cents: number;
    currency: string;
    stripe_payment_intent_id: string;
    kind: string;
    status: string;
  }>;
}

function asReceipt(value: unknown): ReceiptLike | null {
  if (typeof value !== "object" || value === null) return null;
  const r = value as Partial<ReceiptLike>;
  if (!r.booking || !r.business || !r.service || !r.staff || !r.customer) return null;
  return r as ReceiptLike;
}

function isPaymentKind(kind: string): kind is PaymentKind {
  return kind === "deposit" || kind === "full_payment";
}

/** The succeeded payment to show on the receipt, or null when unpaid. */
export function pickReceiptPayment(receipt: unknown): {
  amountCents: number;
  currency: string;
  paymentIntentId: string;
  kind: PaymentKind;
  dueLaterCents: number;
} | null {
  const r = asReceipt(receipt);
  if (!r) return null;
  const paid = (r.payments ?? []).find((p) => p.status === "succeeded");
  if (!paid || !isPaymentKind(paid.kind)) return null;
  const price = r.booking.price_cents;
  return {
    amountCents: paid.amount_cents,
    currency: paid.currency || "usd",
    paymentIntentId: paid.stripe_payment_intent_id,
    kind: paid.kind,
    dueLaterCents: Math.max(0, price - paid.amount_cents),
  };
}

/**
 * Plain-text receipt lines (via `formatReceipt`) for the confirmation
 * surface / email. Returns `[]` when the booking has no succeeded payment —
 * callers then omit the payment block entirely.
 */
export function buildReceiptLines(receipt: unknown): string[] {
  const payment = pickReceiptPayment(receipt);
  if (!payment) return [];
  return formatReceipt({
    amountCents: payment.amountCents,
    currency: payment.currency,
    paymentIntentId: payment.paymentIntentId,
    kind: payment.kind,
    dueLaterCents: payment.dueLaterCents,
  });
}

export interface ReceiptContextOptions {
  /** Magic-link manage URL (raw token already resolved by the caller). */
  manageUrl: string;
  /** Formatted refund amount for cancellation notices, e.g. "$20.00". */
  refundAmount?: string;
}

/**
 * Build the notification template context from a receipt-like payload.
 * Labels are rendered in the business's canonical timezone ("when" the
 * customer experiences the appointment), anchored on the business-local
 * day key so DST transitions never shift the displayed date.
 */
export function receiptToTemplateContext(
  receipt: unknown,
  options: ReceiptContextOptions,
): TemplateContext {
  const r = asReceipt(receipt);
  if (!r) throw new TypeError("Invalid receipt payload");
  const tz = r.business.timezone || "UTC";
  const starts = r.booking.starts_at;

  // Labels are anchored on the business-local day key (DST-safe): the
  // "when" the customer experiences the appointment.
  const whenLabel = formatInTimeZone(starts, tz, "EEEE 'at' h:mm a");
  const dateTimeLabel = formatInTimeZone(starts, tz, "EEEE, MMMM d 'at' h:mm a");

  const freeCancelHours = r.business.free_cancel_hours ?? 0;
  const freeCancelUntilLabel =
    freeCancelHours > 0
      ? formatInTimeZone(
          new Date(Date.parse(starts) - freeCancelHours * 3_600_000),
          tz,
          "EEEE 'at' h:mm a",
        )
      : undefined;

  const payment = pickReceiptPayment(receipt);
  const amountCharged = payment
    ? formatCents(payment.amountCents, payment.currency)
    : undefined;
  const amountDueLater =
    payment && payment.kind === "deposit" && payment.dueLaterCents > 0
      ? formatCents(payment.dueLaterCents, payment.currency)
      : undefined;

  return {
    businessName: r.business.name,
    serviceName: r.service.name,
    staffName: r.staff.name,
    customerName: r.customer.name,
    whenLabel,
    dateTimeLabel,
    bookingReference: shortReference(r.booking.id),
    manageUrl: options.manageUrl,
    address: r.business.address ?? undefined,
    businessPhone: r.business.phone ?? undefined,
    amountCharged,
    amountDueLater,
    refundAmount: options.refundAmount,
    freeCancelUntilLabel,
  };
}

/** Short, human-friendly booking reference from the UUID. */
export function shortReference(bookingId: string): string {
  return bookingId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

/** Anchor check used by tests: the day key behind a label. */
export function receiptDayKey(receipt: unknown): string | null {
  const r = asReceipt(receipt);
  if (!r) return null;
  return toBusinessDayKey(r.booking.starts_at, r.business.timezone || "UTC");
}
