/**
 * GET /api/reminders/cron — dispatch 24h and 2h booking reminders.
 *
 * Guarded by `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron); in
 * non-production, `?secret=` is also accepted for local testing. Runs every
 * 5 minutes: selects confirmed bookings whose reminder moment fell inside
 * the last 5 minutes and that haven't been sent yet. Idempotency via the
 * unique `(booking_id, kind)` guard on `notification_log` plus the
 * `reminder_*_sent_at` flags.
 *
 * "24 hours before" is business-local (via lib/timezone): the reminder
 * labels render the appointment in the business's canonical timezone so the
 * customer sees the wall time they booked. Each reminder rotates the manage
 * token so the email carries a working manage link ("latest link wins",
 * consistent with the payment webhook).
 *
 * `?dry_run=1` counts matches without sending anything.
 * 200 { sent, dryRun }
 */

import { formatInTimeZone } from "date-fns-tz";
import { NextResponse, type NextRequest } from "next/server";

import { getEnv } from "@/lib/env";
import { defaultSender, isSendSuccess } from "@/lib/notify/sender";
import {
  reminder24h,
  reminder2h,
  type NotificationTemplate,
  type TemplateContext,
} from "@/lib/notify/templates";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createManageToken, MANAGE_TOKEN_TTL_MS } from "@/lib/tokens";

import { manageUrlFor } from "../../_lib/booking-notify";
import { jsonError, jsonOk, rateLimitOr429 } from "../../_lib/http";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

interface ReminderKind {
  kind: "reminder_24h" | "reminder_2h";
  hours: number;
  enabledColumn: "reminder_24h_enabled" | "reminder_2h_enabled";
  sentColumn: "reminder_24h_sent_at" | "reminder_2h_sent_at";
  template: (ctx: TemplateContext) => NotificationTemplate;
}

const REMINDER_KINDS: ReminderKind[] = [
  {
    kind: "reminder_24h",
    hours: 24,
    enabledColumn: "reminder_24h_enabled",
    sentColumn: "reminder_24h_sent_at",
    template: reminder24h,
  },
  {
    kind: "reminder_2h",
    hours: 2,
    enabledColumn: "reminder_2h_enabled",
    sentColumn: "reminder_2h_sent_at",
    template: reminder2h,
  },
];

function authorized(request: NextRequest): boolean {
  const secret = getEnv().CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  // Local testing only — never in production.
  if (process.env.NODE_ENV !== "production") {
    return request.nextUrl.searchParams.get("secret") === secret;
  }
  return false;
}

interface DueBooking {
  id: string;
  business_id: string;
  service_id: string;
  staff_id: string;
  customer_id: string;
  starts_at: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const limited = rateLimitOr429(request, 100);
  if (limited) return limited;
  if (!authorized(request)) {
    return jsonError("unauthorized", "Unauthorized.", 401);
  }

  const dryRun = request.nextUrl.searchParams.get("dry_run") === "1";
  const svc = createServiceRoleClient();
  const nowMs = Date.now();
  let sent = 0;

  for (const reminder of REMINDER_KINDS) {
    const { data: enabledBusinesses } = await svc
      .from("businesses")
      .select("id")
      .eq(reminder.enabledColumn, true);
    const businessIds = (enabledBusinesses ?? []).map((b) => b.id);
    if (businessIds.length === 0) continue;

    const lower = new Date(
      nowMs + reminder.hours * 3_600_000 - 5 * 60_000,
    ).toISOString();
    const upper = new Date(nowMs + reminder.hours * 3_600_000).toISOString();

    const { data: due } = await svc
      .from("bookings")
      .select("id, business_id, service_id, staff_id, customer_id, starts_at")
      .eq("status", "confirmed")
      .is(reminder.sentColumn, null)
      .in("business_id", businessIds)
      .gte("starts_at", lower)
      .lte("starts_at", upper)
      .limit(200);
    if (!due || due.length === 0) continue;

    for (const booking of due as DueBooking[]) {
      if (await dispatchReminder(svc, booking, reminder, dryRun)) sent += 1;
    }
  }

  return jsonOk({ sent, dryRun });
}

/**
 * Send one reminder (or count it in dry-run). Rotates the manage token so
 * the reminder email carries a working manage link, records
 * notification_log rows, and stamps the sent flag.
 */
async function dispatchReminder(
  svc: ServiceClient,
  booking: DueBooking,
  reminder: ReminderKind,
  dryRun: boolean,
): Promise<boolean> {
  const [{ data: customer }, { data: business }, { data: service }, { data: staff }] =
    await Promise.all([
      svc
        .from("customers")
        .select("name, email, phone")
        .eq("id", booking.customer_id)
        .single(),
      svc
        .from("businesses")
        .select("name, timezone, phone, address")
        .eq("id", booking.business_id)
        .single(),
      svc.from("services").select("name").eq("id", booking.service_id).single(),
      svc.from("staff").select("name").eq("id", booking.staff_id).single(),
    ]);
  if (!customer || !business || !service || !staff) return false;
  if (!customer.email && !customer.phone) return false;

  const tz = business.timezone || "UTC";
  // Reminder labels are rendered in the business's canonical timezone
  // (business-local "24h before"), so the customer sees the wall time
  // they booked even across DST transitions.

  if (dryRun) return true;

  const fresh = createManageToken();
  await svc
    .from("bookings")
    .update({
      manage_token_hash: fresh.tokenHash,
      manage_token_expires_at: new Date(
        Date.now() + MANAGE_TOKEN_TTL_MS,
      ).toISOString(),
    })
    .eq("id", booking.id);

  const template = reminder.template({
    businessName: business.name,
    serviceName: service.name,
    staffName: staff.name,
    customerName: customer.name,
    whenLabel: formatInTimeZone(booking.starts_at, tz, "EEEE 'at' h:mm a"),
    dateTimeLabel: formatInTimeZone(
      booking.starts_at,
      tz,
      "EEEE, MMMM d 'at' h:mm a",
    ),
    bookingReference: booking.id.replace(/-/g, "").slice(0, 8).toUpperCase(),
    manageUrl: manageUrlFor(fresh.token),
    address: business.address ?? undefined,
    businessPhone: business.phone ?? undefined,
  });

  const sender = defaultSender();
  const smsOn = getEnv().NEXT_PUBLIC_ENABLE_SMS === "true";
  const attempts: Array<Promise<void>> = [];

  if (customer.email) {
    const to = customer.email;
    attempts.push(
      sender
        .sendEmail({
          to,
          subject: template.subject,
          text: template.text,
          html: template.html,
        })
        .then((r) => {
          void logReminder(svc, booking, reminder.kind, "email", to, r);
        }),
    );
  }
  if (customer.phone && smsOn) {
    const to = customer.phone;
    attempts.push(
      sender.sendSms({ to, body: template.text }).then((r) => {
        void logReminder(svc, booking, reminder.kind, "sms", to, r);
      }),
    );
  }
  await Promise.allSettled(attempts);

  const stamp =
    reminder.sentColumn === "reminder_24h_sent_at"
      ? { reminder_24h_sent_at: new Date().toISOString() }
      : { reminder_2h_sent_at: new Date().toISOString() };
  await svc.from("bookings").update(stamp).eq("id", booking.id);
  return true;
}

async function logReminder(
  svc: ServiceClient,
  booking: DueBooking,
  kind: ReminderKind["kind"],
  channel: "email" | "sms",
  recipient: string,
  result: { id: string } | { error: string },
): Promise<void> {
  try {
    // Unique (booking_id, kind) guard: a 23505 means another worker already
    // logged this reminder — treated as sent, never double-sent.
    await svc.from("notification_log").insert({
      business_id: booking.business_id,
      booking_id: booking.id,
      channel,
      kind,
      recipient,
      status: isSendSuccess(result) ? "sent" : "failed",
      provider_id: isSendSuccess(result) ? result.id : null,
      error: isSendSuccess(result) ? null : result.error,
    });
  } catch {
    // Logging failures never fail the cron run.
  }
}
