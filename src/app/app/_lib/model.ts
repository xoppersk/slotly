/* Dashboard view models + the DB → UI status mapping (PROD-W4).
 *
 * DB booking statuses (PostgreSQL, migration 00006): pending,
 * payment_pending, payment_failed, confirmed, completed, cancelled,
 * no_show. The v2 design's run-sheet chain (Check in → Start → Finish)
 * implied arrived / in-progress states the database cannot represent,
 * so the production chain is: pending → confirmed → completed, with
 * cancelled / no_show as terminal exits. Buttons that implied the
 * unrepresentable states were removed (see PROD-W4.md).
 *
 * All date/time rendering happens in the BUSINESS timezone — real now,
 * never a pinned canon date.
 */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import type { BookingStatus as DbBookingStatus } from "@/lib/supabase/types";
import type { PillStatus } from "@/lib/types";

export type { DbBookingStatus };

/** Whole-dollar dashboard money ($672, not $672.00) — design §5.3. */
export function wholeDollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

export interface DashBooking {
  id: string;
  /** Short code as drawn (first 6 of the uuid, uppercased). */
  code: string;
  dbStatus: DbBookingStatus;
  pill: PillStatus;
  pillLabel?: string;
  /** yyyy-mm-dd in the business timezone. */
  dateKey: string;
  startLabel: string; // "9:00 AM"
  endLabel: string;
  start24: string; // "09:00" business-local
  end24: string;
  startMinutes: number; // minutes from business-local midnight
  endMinutes: number;
  startsAtIso: string;
  endsAtIso: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerVisits: number;
  customerNoShows: number;
  serviceId: string;
  serviceName: string;
  staffId: string;
  staffName: string;
  priceCents: number;
  /** Service deposit (due at the visit — no Stripe keys in production). */
  depositCents: number;
  /** Succeeded payments recorded against this booking. */
  depositPaidCents: number;
  balanceCents: number;
  customerNotes: string;
  internalNotes: string;
  source: string;
  createdAt: string;
}

/* Coordinator ruling 2026-10-22: pending family → "Pending" (label keeps
 * the payment distinction visible), confirmed → "Confirmed",
 * completed → "Done", cancelled → "Cancelled", no_show → "No-show". */
const PILL: Record<DbBookingStatus, { pill: PillStatus; label?: string }> = {
  pending: { pill: "Pending" },
  payment_pending: { pill: "Pending", label: "Payment pending" },
  payment_failed: { pill: "Pending", label: "Payment failed" },
  confirmed: { pill: "Confirmed" },
  completed: { pill: "Done" },
  cancelled: { pill: "Cancelled" },
  no_show: { pill: "No-show" },
};

export function pillFor(status: DbBookingStatus): { pill: PillStatus; label?: string } {
  return PILL[status];
}

/** Statuses that still occupy the run sheet / calendar as live work. */
export const LIVE_STATUSES: DbBookingStatus[] = [
  "pending",
  "payment_pending",
  "payment_failed",
  "confirmed",
];

/** yyyy-mm-dd "today" in the business timezone, from real now. */
export function todayKey(timezone: string, now: Date = new Date()): string {
  return formatInTimeZone(now, timezone, "yyyy-MM-dd");
}

/** UTC ISO bounds [start, end) for one business-local calendar day. */
export function dayBoundsIso(dateKey: string, timezone: string): { fromIso: string; toIso: string } {
  const start = fromZonedTime(`${dateKey}T00:00:00.000`, timezone);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  return { fromIso: start.toISOString(), toIso: end.toISOString() };
}

export function dateTitle(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "Thu, Oct 22" short label for a yyyy-mm-dd key. */
export function dateShort(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function shiftDateKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** DB weekday (0 = Sunday … 6 = Saturday) for a yyyy-mm-dd key. */
export function weekdayOf(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
}

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Map one raw bookings row (+ joined names/maps) to the view model. */
export function toDashBooking(
  row: {
    id: string;
    starts_at: string;
    ends_at: string;
    status: DbBookingStatus;
    price_cents: number;
    customer_id: string;
    service_id: string;
    staff_id: string;
    customer_notes: string;
    internal_notes: string;
    source: string;
    created_at: string;
  },
  tz: string,
  names: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    customerVisits: number;
    customerNoShows: number;
    serviceName: string;
    serviceDepositCents: number;
    staffName: string;
    paidCents: number;
  },
): DashBooking {
  const { pill, label } = pillFor(row.status);
  const start24 = formatInTimeZone(row.starts_at, tz, "HH:mm");
  const end24 = formatInTimeZone(row.ends_at, tz, "HH:mm");
  const [sh, sm] = start24.split(":").map(Number);
  const [eh, em] = end24.split(":").map(Number);
  return {
    id: row.id,
    code: row.id.replace(/-/g, "").slice(0, 6).toUpperCase(),
    dbStatus: row.status,
    pill,
    pillLabel: label,
    dateKey: formatInTimeZone(row.starts_at, tz, "yyyy-MM-dd"),
    startLabel: formatInTimeZone(row.starts_at, tz, "h:mm a"),
    endLabel: formatInTimeZone(row.ends_at, tz, "h:mm a"),
    start24,
    end24,
    startMinutes: (sh ?? 0) * 60 + (sm ?? 0),
    endMinutes: (eh ?? 0) * 60 + (em ?? 0),
    startsAtIso: row.starts_at,
    endsAtIso: row.ends_at,
    customerId: row.customer_id,
    customerName: names.customerName,
    customerEmail: names.customerEmail,
    customerPhone: names.customerPhone,
    customerVisits: names.customerVisits,
    customerNoShows: names.customerNoShows,
    serviceId: row.service_id,
    serviceName: names.serviceName,
    staffId: row.staff_id,
    staffName: names.staffName,
    priceCents: row.price_cents,
    depositCents: names.serviceDepositCents,
    depositPaidCents: names.paidCents,
    balanceCents: Math.max(0, row.price_cents - names.paidCents),
    customerNotes: row.customer_notes,
    internalNotes: row.internal_notes,
    source: row.source,
    createdAt: row.created_at,
  };
}

/** Initials for the drawn monogram chips ("Micah Reyes" → "MR"). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

/** First name only, as the design uses for staff ("Micah"). */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
