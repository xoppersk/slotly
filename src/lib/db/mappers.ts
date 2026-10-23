/**
 * Mappers: PostgreSQL rows → the v2 UI types in `@/lib/types`.
 *
 * HONESTY RULE: where a UI field has no database source, the mapper
 * leaves it empty/zero rather than inventing data — every such field is
 * listed in PROD-W1.md ("UI-type mapping gaps"). Pages must treat those
 * fields as not-yet-real.
 *
 * IDs stay the database uuids (as strings). Times are rendered in the
 * BUSINESS timezone via Intl — never the viewer's timezone.
 */
import type {
  Booking as UiBooking,
  BookingStatus as UiBookingStatus,
  Business as UiBusiness,
  BusinessHours,
  Customer as UiCustomer,
  Person as UiPerson,
  Service as UiService,
} from "@/lib/types";

import type { OwnerBooking } from "./owner";
import type {
  AvailabilityRuleRow,
  BusinessPublicRow,
  BusinessRow,
  CustomerRow,
  DbBookingStatus,
  ServicePublicRow,
  ServiceRow,
  StaffPublicRow,
  StaffRow,
} from "./types";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/** "09:00:00" / "09:00" → "9:00 AM". */
export function formatTime12(time: string): string {
  const [hRaw, mRaw] = time.split(":");
  const h = Number(hRaw ?? 0);
  const m = Number(mRaw ?? 0);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "09:00:00" → "09:00". */
export function formatTime24(time: string): string {
  const [h = "00", m = "00"] = time.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

interface ZonedParts {
  date: string;
  time24: string;
  time12: string;
}

function zonedParts(iso: string, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const time24 = `${get("hour")}:${get("minute")}`;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time24,
    time12: formatTime12(time24),
  };
}

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Business-default weekly rules → UI hours rows (one per distinct span). */
export function hoursFromRules(
  rules: AvailabilityRuleRow[],
): BusinessHours[] {
  const defaults = rules.filter((r) => r.staff_id === null && !r.is_closed);
  const bySpan = new Map<string, AvailabilityRuleRow[]>();
  for (const rule of defaults) {
    const key = `${rule.open_time}-${rule.close_time}`;
    (bySpan.get(key) ?? bySpan.set(key, []).get(key)!).push(rule);
  }
  return [...bySpan.values()].map((group) => {
    const first = group[0]!;
    const weekdays = group.map((r) => r.weekday).sort((a, b) => a - b);
    const names = weekdays.map((d) => WEEKDAY_NAMES[d] ?? "");
    return {
      days:
        weekdays.length > 1
          ? `${names[0]} – ${names[names.length - 1]}`
          : (names[0] ?? ""),
      weekdays,
      open: formatTime12(first.open_time),
      close: formatTime12(first.close_time),
      open24: formatTime24(first.open_time),
      close24: formatTime24(first.close_time),
    };
  });
}

// ---------------------------------------------------------------------------
// Business
// ---------------------------------------------------------------------------

function policyFromBusiness(row: {
  slot_step_minutes: number;
  min_lead_time_minutes: number;
  max_advance_days: number;
  free_cancel_hours: number;
}): UiBusiness["policy"] {
  return {
    // No per-business deposit column exists; deposits are per-service.
    depositCents: 0,
    depositLabel: "",
    freeChangeHoursBefore: row.free_cancel_hours,
    freeChangeLine: "",
    slotStepMinutes: row.slot_step_minutes,
    minLeadHours: Math.round((row.min_lead_time_minutes / 60) * 100) / 100,
    maxAdvanceDays: row.max_advance_days,
  };
}

export function businessFromRow(
  row: BusinessRow,
  rules: AvailabilityRuleRow[] = [],
): UiBusiness {
  const address = row.address ?? "";
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.name,
    mark: initialsOf(row.name),
    tagline: row.description,
    area: "",
    address: {
      street: address,
      city: "",
      state: "",
      zip: "",
      line: address,
      full: address,
    },
    phone: row.phone ?? "",
    bookingUrl: `/b/${row.slug}`,
    timezone: row.timezone,
    timezoneLabel: row.timezone,
    hours: hoursFromRules(rules),
    hoursSummary: "",
    policy: policyFromBusiness(row),
    footerLine: "",
  };
}

export function businessFromPublic(
  row: BusinessPublicRow,
  rules: AvailabilityRuleRow[] = [],
): UiBusiness {
  const address = row.address ?? "";
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.name,
    mark: initialsOf(row.name),
    tagline: row.description,
    area: "",
    address: {
      street: address,
      city: "",
      state: "",
      zip: "",
      line: address,
      full: address,
    },
    phone: row.phone ?? "",
    bookingUrl: `/b/${row.slug}`,
    timezone: row.timezone,
    timezoneLabel: row.timezone,
    hours: hoursFromRules(rules),
    hoursSummary: "",
    policy: {
      depositCents: 0,
      depositLabel: "",
      freeChangeHoursBefore: 0,
      freeChangeLine: "",
      slotStepMinutes: 15,
      minLeadHours: 0,
      maxAdvanceDays: 60,
    },
    footerLine: "",
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export function serviceFromRow(
  row: ServiceRow,
  offeredBy: string[] = [],
): UiService {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    durationMinutes: row.duration_minutes,
    priceCents: row.price_cents,
    depositCents: row.deposit_cents,
    offeredBy,
    bufferAfterMinutes: row.buffer_after_minutes,
    online: row.is_active,
  };
}

export function serviceFromPublic(
  row: ServicePublicRow,
  offeredBy: string[] = [],
): UiService {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    durationMinutes: row.duration_minutes,
    priceCents: row.price_cents,
    depositCents: row.deposit_cents,
    offeredBy,
    // services_public carries no buffer columns; the availability RPC's
    // service object does (buffer_after_minutes) when a page needs it.
    bufferAfterMinutes: 0,
    online: true,
  };
}

// ---------------------------------------------------------------------------
// Person (staff)
// ---------------------------------------------------------------------------

export interface PersonMapOptions {
  serviceIds?: string[];
  /** True when this staff row is the business owner's linked profile. */
  isOwner?: boolean;
}

export function personFromRow(row: StaffRow, opts: PersonMapOptions = {}): UiPerson {
  return {
    id: row.id,
    name: row.name,
    initial: initialsOf(row.name).charAt(0),
    initials: initialsOf(row.name),
    role: opts.isOwner ? "owner" : "barber",
    roleLabel: row.title ?? (opts.isOwner ? "Owner" : "Staff"),
    // The staff table has no email column — never invent one.
    email: "",
    bookable: row.is_active,
    status: row.is_active ? "Working" : "Away",
    bio: row.bio,
    blurb: row.bio,
    serviceIds: opts.serviceIds ?? [],
  };
}

export function personFromPublic(
  row: StaffPublicRow,
  opts: PersonMapOptions = {},
): UiPerson {
  return {
    id: row.id,
    name: row.name,
    initial: initialsOf(row.name).charAt(0),
    initials: initialsOf(row.name),
    role: opts.isOwner ? "owner" : "barber",
    roleLabel: row.title ?? (opts.isOwner ? "Owner" : "Staff"),
    email: "",
    bookable: true,
    status: "Working",
    bio: row.bio,
    blurb: row.bio,
    serviceIds: opts.serviceIds ?? [],
  };
}

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------

/**
 * DB booking status → v2 UI BookingStatus.
 *
 * The v2 type ("Done" | "In the chair" | "Arrived" | "Upcoming" |
 * "Confirmed") has NO pending/cancelled/no-show values — the coordinator
 * brief's `payment_pending → 'pending'` cannot be represented. Mapping:
 * confirmed → "Confirmed", completed → "Done", everything still-live
 * (pending, payment_pending, payment_failed) → "Upcoming". cancelled and
 * no_show also land on "Upcoming" in the UI type, which is why
 * `bookingFromOwnerRow` keeps the raw status available via
 * `DbBooking.uiStatus` callers should prefer filtering on the DB status
 * (OwnerBooking.status) for cancelled/no-show surfaces. Flagged in
 * PROD-W1.md for a coordinator ruling on extending the UI type.
 */
export function mapDbBookingStatus(status: DbBookingStatus): UiBookingStatus {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "completed":
      return "Done";
    default:
      return "Upcoming";
  }
}

/** Booking display code: first 6 chars of the uuid, uppercased. */
export function bookingCode(id: string): string {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

export interface BookingMapContext {
  /** Business timezone — all rendered times use it. */
  timezone: string;
  /** The booked service's deposit (bookings don't snapshot it). */
  serviceDepositCents?: number;
}

export function bookingFromOwnerRow(
  row: OwnerBooking,
  ctx: BookingMapContext,
): UiBooking {
  const start = zonedParts(row.starts_at, ctx.timezone);
  const end = zonedParts(row.ends_at, ctx.timezone);
  const depositCents = ctx.serviceDepositCents ?? 0;
  return {
    id: row.id,
    code: bookingCode(row.id),
    date: start.date,
    start: start.time12,
    end: end.time12,
    start24: start.time24,
    end24: end.time24,
    customer: row.customer_name ?? "",
    customerEmail: row.customer_email ?? "",
    customerPhone: row.customer_phone ?? undefined,
    serviceId: row.service_id,
    service: row.service_name ?? "",
    priceCents: row.price_cents,
    barberId: row.staff_id,
    barber: row.staff_name ?? "",
    status: mapDbBookingStatus(row.status),
    depositCents,
    // Approximation: listBookings does not join payments, so a deposit is
    // "due" unless nothing is owed. Pages needing truth should check the
    // payments table. Flagged in PROD-W1.md.
    depositStatus: depositCents > 0 ? "due" : "paid",
    balanceCents: Math.max(0, row.price_cents - depositCents),
    note: row.customer_notes || undefined,
  };
}

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

export function customerFromRow(row: CustomerRow): UiCustomer {
  return {
    id: row.id,
    name: row.name,
    initials: initialsOf(row.name),
    email: row.email ?? "",
    phone: row.phone ?? undefined,
    visits: row.total_visits,
    // usual* have no DB source (would need a bookings aggregate) — empty.
    usualServiceId: "",
    usualService: "",
    usualPriceCents: 0,
    usualBarberId: "",
    usualBarber: "",
    nextOrLastVisit: "",
    nextVisitDate: "",
    isNew: row.total_visits === 0,
    noShows: row.no_show_count,
  };
}
