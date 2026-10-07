"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business";
import { getEnv } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { formatCents } from "@/lib/format";
import {
  formatDateTimeLabel,
  formatWhenLabel,
} from "@/lib/dashboard/format";
import { defaultSender } from "@/lib/notify/sender";
import {
  bookingCancelled,
  bookingConfirmationCustomer,
  bookingRescheduled,
  staffCancellationAlert,
  type TemplateContext,
} from "@/lib/notify/templates";
import type { Database } from "@/lib/supabase/types";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type BusinessRow = Database["public"]["Tables"]["businesses"]["Row"];

type ActionResult = { ok: true } | { ok: false; error: string };

/* ------------------------------------------------------------------ */
/* guards                                                              */
/* ------------------------------------------------------------------ */

interface Guard {
  supabase: Awaited<ReturnType<typeof createClient>>;
  business: BusinessRow;
  role: "owner" | "staff";
  staffId: string | null;
}

/** Verify the caller belongs to `businessId`; throws otherwise. RLS is the
 *  real enforcement — this just produces clean errors before touching data. */
async function guardBusiness(businessId: string): Promise<Guard> {
  const ctx = await getCurrentBusiness();
  if (!ctx || ctx.business.id !== businessId) {
    throw new Error("not_authorized");
  }
  const supabase = await createClient();
  return {
    supabase,
    business: ctx.business,
    role: ctx.membership.role,
    staffId: ctx.membership.staffId,
  };
}

/** Staff members may only touch their own bookings (RLS also enforces). */
async function scopedBooking(
  guard: Guard,
  bookingId: string
): Promise<BookingRow | null> {
  let query = guard.supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .eq("business_id", guard.business.id);
  if (guard.role === "staff" && guard.staffId) {
    query = query.eq("staff_id", guard.staffId);
  }
  const { data } = await query.maybeSingle();
  return data;
}

/* ------------------------------------------------------------------ */
/* notifications (fire-and-forget; never fail the mutation)            */
/* ------------------------------------------------------------------ */

interface NotifyFacts {
  business: BusinessRow;
  serviceName: string;
  staffName: string;
  staffPhone: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  startsAt: string;
  bookingId: string;
  manageUrl?: string;
}

function templateCtx(f: NotifyFacts): TemplateContext {
  const tz = f.business.timezone;
  return {
    businessName: f.business.name,
    serviceName: f.serviceName,
    staffName: f.staffName,
    customerName: f.customerName,
    whenLabel: formatWhenLabel(f.startsAt, tz),
    dateTimeLabel: formatDateTimeLabel(f.startsAt, tz),
    bookingReference: f.bookingId.slice(0, 8).toUpperCase(),
    manageUrl: f.manageUrl ?? "",
    address: f.business.address ?? undefined,
    businessPhone: f.business.phone ?? undefined,
  };
}

async function factsFor(
  guard: Guard,
  booking: BookingRow
): Promise<NotifyFacts> {
  const { supabase, business } = guard;
  const [serviceRes, staffRes, customerRes] = await Promise.all([
    supabase
      .from("services")
      .select("name")
      .eq("id", booking.service_id)
      .maybeSingle(),
    supabase
      .from("staff")
      .select("name, phone")
      .eq("id", booking.staff_id)
      .maybeSingle(),
    supabase
      .from("customers")
      .select("name, email, phone")
      .eq("id", booking.customer_id)
      .maybeSingle(),
  ]);
  const service = serviceRes.data;
  const staff = staffRes.data;
  const customer = customerRes.data;
  return {
    business,
    serviceName: service?.name ?? "Appointment",
    staffName: staff?.name ?? "Staff",
    staffPhone: staff?.phone ?? null,
    customerName: customer?.name ?? "Customer",
    customerEmail: customer?.email ?? null,
    customerPhone: customer?.phone ?? null,
    startsAt: booking.starts_at,
    bookingId: booking.id,
  };
}

/** Best-effort notify — swallows everything so mutations never fail on it. */
async function safeNotify(work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch {
    // Notifications are advisory; the booking change already committed.
  }
}

async function notifyCustomerEmail(
  facts: NotifyFacts,
  template: (ctx: TemplateContext) => { subject: string; text: string; html: string }
): Promise<void> {
  if (!facts.customerEmail) return;
  await safeNotify(async () => {
    const sender = defaultSender();
    const msg = template(templateCtx(facts));
    await sender.sendEmail({
      to: facts.customerEmail!,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
  });
}

async function notifyStaffSms(
  facts: NotifyFacts,
  body: string
): Promise<void> {
  if (!facts.staffPhone) return;
  await safeNotify(async () => {
    const sender = defaultSender();
    await sender.sendSms({ to: facts.staffPhone!, body });
  });
}

/* ------------------------------------------------------------------ */
/* booking detail                                                      */
/* ------------------------------------------------------------------ */

export interface BookingHistoryEvent {
  at: string;
  label: string;
  detail?: string;
}

export interface BookingDetail {
  booking: BookingRow;
  service: { id: string; name: string; color: string; duration_minutes: number } | null;
  staff: { id: string; name: string } | null;
  customer: Database["public"]["Tables"]["customers"]["Row"] | null;
  payments: Database["public"]["Tables"]["payments"]["Row"][];
  refunds: Database["public"]["Tables"]["refunds"]["Row"][];
  history: BookingHistoryEvent[];
  freeCancelUntil: string | null;
  paidCents: number;
  refundedCents: number;
}

export async function getBookingDetail(
  businessId: string,
  bookingId: string
): Promise<BookingDetail | null> {
  const guard = await guardBusiness(businessId);
  const booking = await scopedBooking(guard, bookingId);
  if (!booking) return null;

  const { supabase, business } = guard;
  const [serviceRes, staffRes, customerRes, paymentsRes, refundsRes, logRes] =
    await Promise.all([
      supabase
        .from("services")
        .select("id, name, color, duration_minutes")
        .eq("id", booking.service_id)
        .maybeSingle(),
      supabase
        .from("staff")
        .select("id, name")
        .eq("id", booking.staff_id)
        .maybeSingle(),
      supabase
        .from("customers")
        .select("*")
        .eq("id", booking.customer_id)
        .maybeSingle(),
      supabase
        .from("payments")
        .select("*")
        .eq("booking_id", booking.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("refunds")
        .select("*")
        .eq("business_id", business.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("notification_log")
        .select("kind, status, created_at")
        .eq("booking_id", booking.id)
        .order("created_at", { ascending: true }),
    ]);
  const service = serviceRes.data;
  const staff = staffRes.data;
  const customer = customerRes.data;
  const payments = paymentsRes.data ?? [];
  const refunds = refundsRes.data ?? [];
  const log = logRes.data ?? [];

  const bookingRefunds = refunds.filter((r) =>
    payments.some((p) => p.id === r.payment_id)
  );
  const paidCents = payments
    .filter((p) => p.status === "succeeded")
    .reduce((sum, p) => sum + p.amount_cents, 0);
  const refundedCents = bookingRefunds
    .filter((r) => r.status === "succeeded" || r.status === "pending")
    .reduce((sum, r) => sum + r.amount_cents, 0);

  const history: BookingHistoryEvent[] = [
    { at: booking.created_at, label: "Booking created", detail: `Source: ${booking.source}` },
  ];
  if (booking.rescheduled_from_id) {
    history.push({ at: booking.created_at, label: "Rescheduled", detail: "Moved to a new time" });
  }
  for (const p of payments) {
    history.push({
      at: p.created_at,
      label:
        p.status === "succeeded"
          ? `Payment ${formatCents(p.amount_cents)} received`
          : p.status === "failed"
            ? "Payment failed"
            : `Payment ${p.status}`,
      detail: p.kind === "deposit" ? "Deposit" : "Full payment",
    });
  }
  for (const r of bookingRefunds) {
    history.push({
      at: r.created_at,
      label: `Refund ${formatCents(r.amount_cents)} ${r.status}`,
      detail: r.reason ?? undefined,
    });
  }
  for (const n of log) {
    history.push({
      at: n.created_at,
      label: `Notification: ${n.kind.replace(/_/g, " ")}`,
      detail: `Status: ${n.status}`,
    });
  }
  if (booking.cancelled_at) {
    history.push({
      at: booking.cancelled_at,
      label: "Cancelled",
      detail: booking.cancel_reason ?? undefined,
    });
  }
  history.sort((a, b) => a.at.localeCompare(b.at));

  const freeCancelUntil =
    booking.status === "confirmed" || booking.status === "pending"
      ? new Date(
          Date.parse(booking.starts_at) - business.free_cancel_hours * 3600_000
        ).toISOString()
      : null;

  return {
    booking,
    service,
    staff,
    customer,
    payments,
    refunds: bookingRefunds,
    history,
    freeCancelUntil,
    paidCents,
    refundedCents,
  };
}

/* ------------------------------------------------------------------ */
/* status mutations                                                    */
/* ------------------------------------------------------------------ */

export type BookingStatusAction =
  | "confirm"
  | "decline"
  | "cancel"
  | "complete"
  | "no_show";

/**
 * Confirm / decline / cancel / complete / mark no-show. Customers and staff
 * are auto-notified (best effort). RLS enforces staff-vs-owner scoping.
 */
export async function updateBookingStatus(
  businessId: string,
  bookingId: string,
  action: BookingStatusAction,
  reason?: string
): Promise<ActionResult> {
  let guard: Guard;
  try {
    guard = await guardBusiness(businessId);
  } catch {
    return { ok: false, error: "not_authorized" };
  }
  const booking = await scopedBooking(guard, bookingId);
  if (!booking) return { ok: false, error: "booking_not_found" };

  const now = new Date().toISOString();
  let patch: Partial<BookingRow>;
  switch (action) {
    case "confirm":
      patch = { status: "confirmed" };
      break;
    case "decline":
      if (!reason?.trim()) return { ok: false, error: "decline_reason_required" };
      patch = {
        status: "cancelled",
        cancelled_at: now,
        cancel_reason: `Declined by business: ${reason.trim()}`,
      };
      break;
    case "cancel":
      patch = {
        status: "cancelled",
        cancelled_at: now,
        cancel_reason: reason?.trim() || null,
      };
      break;
    case "complete":
      patch = { status: "completed" };
      break;
    case "no_show":
      patch = { status: "no_show" };
      break;
  }

  const { error } = await guard.supabase
    .from("bookings")
    .update(patch)
    .eq("id", booking.id);
  if (error) return { ok: false, error: "update_failed" };

  const facts = await factsFor(guard, { ...booking, ...patch });

  if (action === "confirm") {
    await notifyCustomerEmail(facts, bookingConfirmationCustomer);
    await notifyStaffSms(
      facts,
      `New booking confirmed: ${facts.customerName}, ${facts.serviceName}, ${formatWhenLabel(booking.starts_at, guard.business.timezone)}.`
    );
  } else if (action === "decline" || action === "cancel") {
    // Policy-aware cancel: inside the free-cancel window, paid bookings are
    // refunded automatically (Stripe + issue_refund) and the customer email
    // carries the refund notice. Outside the window the owner has overridden
    // deliberately — the refund stays a manual drawer action.
    let refundedCents = 0;
    if (action === "cancel") {
      refundedCents = await autoRefundInsideWindow(guard, booking);
    }
    await notifyCustomerEmail(facts, (c) =>
      bookingCancelled({
        ...c,
        refundAmount: refundedCents > 0 ? formatCents(refundedCents) : undefined,
      })
    );
    await safeNotify(async () => {
      if (!facts.staffPhone) return;
      const sender = defaultSender();
      const msg = staffCancellationAlert(templateCtx(facts));
      await sender.sendSms({ to: facts.staffPhone, body: `${msg.subject}` });
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  return { ok: true };
}

/**
 * Inside the free-cancel window, refund every succeeded payment on the
 * booking in full (best effort; failures are swallowed so the cancel
 * itself never fails). Returns the total refunded.
 */
async function autoRefundInsideWindow(
  guard: Guard,
  booking: BookingRow
): Promise<number> {
  const freeCancelUntil =
    Date.parse(booking.starts_at) - guard.business.free_cancel_hours * 3600_000;
  if (Date.now() >= freeCancelUntil) return 0;

  const { data: payments } = await guard.supabase
    .from("payments")
    .select("id, amount_cents")
    .eq("booking_id", booking.id)
    .eq("status", "succeeded");
  if (!payments || payments.length === 0) return 0;

  let total = 0;
  for (const payment of payments) {
    const result = await issueBookingRefund(
      guard.business.id,
      payment.id,
      payment.amount_cents,
      "Automatic refund: cancelled inside the free-cancel window"
    );
    if (result.ok) total += payment.amount_cents;
  }
  return total;
}

/* ------------------------------------------------------------------ */
/* reschedule                                                          */
/* ------------------------------------------------------------------ */

export interface RescheduleInput {
  staffId: string;
  startsAt: string;
  endsAt: string;
}

/**
 * Move a booking to a new slot. Validates against the booking rules via
 * `check_slot_bookable` (ignoring the booking itself), then updates in
 * place — the Postgres EXCLUDE constraint is the final race guard.
 */
export async function rescheduleBooking(
  businessId: string,
  bookingId: string,
  input: RescheduleInput
): Promise<ActionResult> {
  let guard: Guard;
  try {
    guard = await guardBusiness(businessId);
  } catch {
    return { ok: false, error: "not_authorized" };
  }
  if (guard.role === "staff" && guard.staffId !== input.staffId) {
    return { ok: false, error: "not_authorized" };
  }
  const booking = await scopedBooking(guard, bookingId);
  if (!booking) return { ok: false, error: "booking_not_found" };

  const { error: ruleError } = await guard.supabase.rpc("check_slot_bookable", {
    p_business_id: businessId,
    p_service_id: booking.service_id,
    p_staff_id: input.staffId,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_ignore_booking_id: booking.id,
  });
  if (ruleError) return { ok: false, error: friendlySlotError(ruleError.message) };

  const tz = guard.business.timezone;
  const auditLine = `Rescheduled: ${formatDateTimeLabel(booking.starts_at, tz)} -> ${formatDateTimeLabel(input.startsAt, tz)}.`;
  const { error: updateError } = await guard.supabase
    .from("bookings")
    .update({
      staff_id: input.staffId,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      internal_notes: [booking.internal_notes, auditLine]
        .filter(Boolean)
        .join("\n"),
    })
    .eq("id", booking.id);
  if (updateError) return { ok: false, error: "slot_taken" };

  const facts = await factsFor(guard, {
    ...booking,
    starts_at: input.startsAt,
  });
  await notifyCustomerEmail(facts, bookingRescheduled);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  return { ok: true };
}

function friendlySlotError(message: string): string {
  const code = message.replace(/^.*?:\s*/, "").trim();
  const map: Record<string, string> = {
    below_min_lead_time: "That slot is inside the minimum lead time.",
    beyond_max_advance: "That date is outside the booking window.",
    blackout_date: "That date is blocked (blackout).",
    slot_duration_mismatch: "Slot length does not match the service duration.",
    staff_not_available: "That staff member is not available.",
    staff_does_not_perform_service: "That staff member does not perform this service.",
    service_not_available: "That service is no longer available.",
  };
  return map[code] ?? "That slot is no longer available.";
}

/* ------------------------------------------------------------------ */
/* book on behalf (dashboard)                                          */
/* ------------------------------------------------------------------ */

export interface BookOnBehalfInput {
  businessId: string;
  serviceId: string;
  staffId: string;
  startsAt: string;
  endsAt: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerNotes?: string;
}

/**
 * Compact book-on-behalf: delegates to the SECURITY DEFINER `create_booking`
 * (which upserts the customer — dashboards cannot INSERT customers
 * directly). The customer is notified with their manage link.
 */
export async function createBookingOnBehalf(
  input: BookOnBehalfInput
): Promise<{ ok: true; bookingId: string } | { ok: false; error: string }> {
  let guard: Guard;
  try {
    guard = await guardBusiness(input.businessId);
  } catch {
    return { ok: false, error: "not_authorized" };
  }
  const staffId =
    guard.role === "staff" && guard.staffId ? guard.staffId : input.staffId;

  const { data, error } = await guard.supabase.rpc("create_booking", {
    p_business_id: input.businessId,
    p_service_id: input.serviceId,
    p_staff_id: staffId,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone ?? null,
    p_customer_email: input.customerEmail ?? null,
    p_customer_notes: input.customerNotes ?? "",
    p_source: "dashboard",
  });
  if (error || !data) {
    return { ok: false, error: friendlySlotError(error?.message ?? "create_failed") };
  }

  const result = data as {
    booking?: { id?: string };
    manage_token?: string;
    status?: string;
  };
  const bookingId = result.booking?.id;
  if (!bookingId) return { ok: false, error: "create_failed" };

  const booking = await scopedBooking(guard, bookingId);
  if (booking) {
    let appUrl = "";
    try {
      appUrl = getEnv().APP_URL;
    } catch {
      appUrl = "";
    }
    const facts = await factsFor(guard, booking);
    facts.manageUrl = appUrl && result.manage_token
      ? `${appUrl}/manage/${result.manage_token}`
      : "";
    await notifyCustomerEmail(facts, bookingConfirmationCustomer);
    await notifyStaffSms(
      facts,
      `New dashboard booking: ${facts.customerName}, ${facts.serviceName}, ${formatWhenLabel(booking.starts_at, guard.business.timezone)}.`
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  return { ok: true, bookingId };
}

/* ------------------------------------------------------------------ */
/* refunds                                                             */
/* ------------------------------------------------------------------ */

/**
 * Issue a full or partial refund: Stripe Refunds API first, then record via
 * the `issue_refund` SECURITY DEFINER function (enforces membership and
 * refund ≤ payment at the database level).
 */
export async function issueBookingRefund(
  businessId: string,
  paymentId: string,
  amountCents: number,
  reason?: string
): Promise<ActionResult> {
  let guard: Guard;
  try {
    guard = await guardBusiness(businessId);
  } catch {
    return { ok: false, error: "not_authorized" };
  }
  const { data: payment } = await guard.supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!payment || payment.status !== "succeeded") {
    return { ok: false, error: "payment_not_refundable" };
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, error: "invalid_refund_amount" };
  }

  let stripeRefundId: string;
  try {
    const stripe = getStripe();
    const refund = await stripe.refunds.create({
      payment_intent: payment.stripe_payment_intent_id,
      amount: amountCents,
      metadata: { slotly_business_id: businessId, slotly_payment_id: paymentId },
    });
    stripeRefundId = refund.id;
  } catch {
    return { ok: false, error: "stripe_refund_failed" };
  }

  const { error } = await guard.supabase.rpc("issue_refund", {
    p_payment_id: paymentId,
    p_amount_cents: amountCents,
    p_stripe_refund_id: stripeRefundId,
    p_reason: reason?.trim() || null,
  });
  if (error) {
    return { ok: false, error: "refund_record_failed" };
  }

  revalidatePath("/dashboard/bookings");
  return { ok: true };
}
