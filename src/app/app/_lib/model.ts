/* Dashboard view models (PROD-W4).
 *
 * Thin, serializable shapes computed from real Supabase rows. All fields
 * here are derived; nothing here is a stub or fixture.
 */
import type { OwnerBooking } from "@/lib/db/owner";
import type { BusinessSettings } from "@/lib/supabase/types";

export interface DashboardOwner {
  id: string;
  businessName: string;
  businessId: string;
  businessSlug: string;
  name: string;
  email: string;
  phone: string;
  plan: string;
}

export interface DashBooking {
  id: string;
  customerId: string;
  serviceId: string;
  staffId: string;
  startIso: string;
  endIso: string;
  dateLabel: string;
  timeLabel: string;
  durationMin: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerVisits: number;
  customerNoShows: number;
  serviceName: string;
  serviceDepositCents: number;
  staffName: string;
  status: string;
  isCancelled: boolean;
  isNoShow: boolean;
  paidCents: number;
}

export interface BookingEnrichment {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerVisits: number;
  customerNoShows: number;
  serviceName: string;
  serviceDepositCents: number;
  staffName: string;
  paidCents: number;
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function fmtInTz(iso: string, tz: string, fmt: Intl.DateTimeFormat): string {
  const parts = fmt.formatToParts(new Date(iso));
  // rebuild with the target zone applied to avoid locale-zone drift
  const dtf = new Intl.DateTimeFormat("en-US", {
    ...(fmt.resolvedOptions() as object),
    timeZone: tz,
  } as Intl.DateTimeFormatOptions);
  return dtf.format(new Date(iso));
}

/** Convert a real booking row into its dashboard view model. */
export function toDashBooking(
  row: OwnerBooking,
  businessTz: string,
  enrichment: BookingEnrichment,
): DashBooking {
  const start = new Date(row.start_at);
  const end = new Date(row.end_at);
  const durationMin = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  return {
    id: row.id,
    customerId: row.customer_id,
    serviceId: row.service_id,
    staffId: row.staff_id,
    startIso: row.start_at,
    endIso: row.end_at,
    dateLabel: fmtInTz(row.start_at, businessTz, DATE_FMT),
    timeLabel: fmtInTz(row.start_at, businessTz, TIME_FMT),
    durationMin,
    customerName: enrichment.customerName,
    customerEmail: enrichment.customerEmail,
    customerPhone: enrichment.customerPhone,
    customerVisits: enrichment.customerVisits,
    customerNoShows: enrichment.customerNoShows,
    serviceName: enrichment.serviceName,
    serviceDepositCents: enrichment.serviceDepositCents,
    staffName: enrichment.staffName,
    status: row.status,
    isCancelled: row.status === "cancelled",
    isNoShow: row.status === "no_show",
    paidCents: enrichment.paidCents,
  };
}

/** Owner info shown in the dashboard chrome, derived from the membership. */
export function toDashboardOwner(args: {
  userId: string;
  userEmail: string;
  userName: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  settings: BusinessSettings | null;
}): DashboardOwner {
  return {
    id: args.userId,
    businessName: args.businessName,
    businessId: args.businessId,
    businessSlug: args.businessSlug,
    name: args.userName,
    email: args.userEmail,
    phone: args.settings?.phone ?? "",
    plan: "pro",
  };
}
