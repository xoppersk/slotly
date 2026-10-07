/**
 * Server-only booking notification dispatch (Wave 3C).
 *
 * Loads the rows needed for the notification templates via the service-role
 * client (server-only, bypasses RLS — this is the same privilege class as
 * the reminders cron and the Stripe webhook), builds the template context,
 * and sends email/SMS fire-and-forget. Failures are swallowed and logged to
 * `notification_log` — a notification outage must never fail a booking.
 *
 * Never import from client components. Never log tokens or secrets.
 */

import { getEnv } from "@/lib/env";
import { defaultSender, isSendSuccess } from "@/lib/notify/sender";
import type {
  NotificationTemplate,
  TemplateContext,
} from "@/lib/notify/templates";
import type { NotificationKind } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { NotificationLogRow } from "@/lib/supabase/types";

export interface NotifyContact {
  name: string;
  email?: string | null;
  phone?: string | null;
}

export interface BookingNotifyContext {
  template: TemplateContext;
  businessId: string;
  businessName: string;
  customer: NotifyContact;
}

/**
 * Load everything a notification needs for one booking: business, service,
 * staff, customer rows. Returns null when the booking is missing.
 */
export async function loadNotifyContext(
  bookingId: string,
  manageUrl: string,
  refundAmount?: string,
): Promise<BookingNotifyContext | null> {
  const svc = createServiceRoleClient();

  const { data: booking } = await svc
    .from("bookings")
    .select("id, business_id, service_id, staff_id, customer_id, starts_at")
    .eq("id", bookingId)
    .single();
  if (!booking) return null;

  const [{ data: business }, { data: service }, { data: staff }, { data: customer }] =
    await Promise.all([
      svc
        .from("businesses")
        .select("id, name, timezone, phone, address, free_cancel_hours")
        .eq("id", booking.business_id)
        .single(),
      svc.from("services").select("name").eq("id", booking.service_id).single(),
      svc.from("staff").select("name").eq("id", booking.staff_id).single(),
      svc
        .from("customers")
        .select("name, email, phone")
        .eq("id", booking.customer_id)
        .single(),
    ]);
  if (!business || !service || !staff || !customer) return null;

  const tz = business.timezone || "UTC";
  const starts = booking.starts_at;
  const { formatInTimeZone } = await import("date-fns-tz");

  const freeCancelHours = business.free_cancel_hours ?? 0;

  const template: TemplateContext = {
    businessName: business.name,
    serviceName: service.name,
    staffName: staff.name,
    customerName: customer.name,
    whenLabel: formatInTimeZone(starts, tz, "EEEE 'at' h:mm a"),
    dateTimeLabel: formatInTimeZone(starts, tz, "EEEE, MMMM d 'at' h:mm a"),
    bookingReference: booking.id.replace(/-/g, "").slice(0, 8).toUpperCase(),
    manageUrl,
    address: business.address ?? undefined,
    businessPhone: business.phone ?? undefined,
    refundAmount,
    freeCancelUntilLabel:
      freeCancelHours > 0
        ? formatInTimeZone(
            new Date(Date.parse(starts) - freeCancelHours * 3_600_000),
            tz,
            "EEEE 'at' h:mm a",
          )
        : undefined,
  };

  return {
    template,
    businessId: business.id,
    businessName: business.name,
    customer: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
    },
  };
}

function smsEnabled(): boolean {
  try {
    return getEnv().NEXT_PUBLIC_ENABLE_SMS === "true";
  } catch {
    return false;
  }
}

async function logNotification(
  row: Pick<
    NotificationLogRow,
    "business_id" | "booking_id" | "channel" | "kind" | "recipient" | "status" | "provider_id" | "error"
  >,
): Promise<void> {
  try {
    const svc = createServiceRoleClient();
    await svc.from("notification_log").insert(row);
  } catch {
    // Logging must never break the caller.
  }
}

export interface SendBookingNotificationOptions {
  ctx: BookingNotifyContext;
  bookingId: string;
  /** Customer-facing template (confirmation / reschedule / cancellation). */
  customerTemplate: NotificationTemplate;
  /** Business inbox copy (optional). */
  businessTemplate?: NotificationTemplate;
  businessEmail?: string | null;
  kind: NotificationKind;
}

/**
 * Fire-and-forget notification fan-out. Sends the customer email (when an
 * address is known) and SMS (when a phone is known and SMS is enabled),
 * plus the business-side alert when a business email is supplied. Every
 * attempt is recorded in `notification_log`. Returns immediately — the
 * promise is intentionally not awaited.
 */
export function sendBookingNotification(
  options: SendBookingNotificationOptions,
): void {
  void (async () => {
    try {
      const sender = defaultSender();
      const { ctx, bookingId, customerTemplate, businessTemplate, businessEmail, kind } =
        options;
      const jobs: Array<Promise<void>> = [];

      if (ctx.customer.email) {
        const to = ctx.customer.email;
        jobs.push(
          sender
            .sendEmail({
              to,
              subject: customerTemplate.subject,
              text: customerTemplate.text,
              html: customerTemplate.html,
            })
            .then((r) =>
              logNotification({
                business_id: ctx.businessId,
                booking_id: bookingId,
                channel: "email",
                kind,
                recipient: to,
                status: isSendSuccess(r) ? "sent" : "failed",
                provider_id: isSendSuccess(r) ? r.id : null,
                error: isSendSuccess(r) ? null : r.error,
              }),
            ),
        );
      }

      if (ctx.customer.phone && smsEnabled()) {
        const to = ctx.customer.phone;
        jobs.push(
          sender
            .sendSms({ to, body: customerTemplate.text })
            .then((r) =>
              logNotification({
                business_id: ctx.businessId,
                booking_id: bookingId,
                channel: "sms",
                kind,
                recipient: to,
                status: isSendSuccess(r) ? "sent" : "failed",
                provider_id: isSendSuccess(r) ? r.id : null,
                error: isSendSuccess(r) ? null : r.error,
              }),
            ),
        );
      }

      if (businessTemplate && businessEmail) {
        const to = businessEmail;
        jobs.push(
          sender
            .sendEmail({
              to,
              subject: businessTemplate.subject,
              text: businessTemplate.text,
              html: businessTemplate.html,
            })
            .then((r) =>
              logNotification({
                business_id: ctx.businessId,
                booking_id: bookingId,
                channel: "email",
                kind: "staff_alert",
                recipient: to,
                status: isSendSuccess(r) ? "sent" : "failed",
                provider_id: isSendSuccess(r) ? r.id : null,
                error: isSendSuccess(r) ? null : r.error,
              }),
            ),
        );
      }

      await Promise.allSettled(jobs);
    } catch {
      // Notification failures never propagate to the booking flow.
    }
  })();
}

/** The public manage-URL for a raw manage token. Never logs the token. */
export function manageUrlFor(token: string): string {
  const { APP_URL } = getEnv();
  return `${APP_URL.replace(/\/$/, "")}/manage/${token}`;
}

/** Fetch just the business contact columns (server-only). */
export async function loadBusinessContact(
  businessId: string,
): Promise<{ email: string | null; phone: string | null } | null> {
  const svc = createServiceRoleClient();
  const { data } = await svc
    .from("businesses")
    .select("email, phone")
    .eq("id", businessId)
    .single();
  return data ?? null;
}
