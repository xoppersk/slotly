/**
 * Client-safe public-catalog types for the /b/[slug] booking flow.
 *
 * These mirror the PostgreSQL public views (`businesses_public`,
 * `services_public`, `staff_public`) plus the policy block that only the
 * `get_availability` SECURITY DEFINER function exposes. Plain serializable
 * data only — the server layout hands this to the client BookingProvider.
 */
import { formatInTimeZone } from "date-fns-tz";

export interface PublicBusiness {
  id: string;
  slug: string;
  name: string;
  description: string;
  timezone: string;
  phone: string | null;
  /** Free-text address line from the businesses table (may be null). */
  address: string | null;
  accentColor: string;
}

export interface PublicService {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
  paymentPolicy: "none" | "deposit" | "full";
  depositCents: number;
}

export interface PublicStaff {
  id: string;
  name: string;
  title: string | null;
  bio: string;
  photoUrl: string | null;
  specialties: string[];
  /** Initial rendered in the drawn avatar circle. */
  initial: string;
}

export interface PublicPolicy {
  slotStepMinutes: number;
  minLeadTimeMinutes: number;
  maxAdvanceDays: number;
  freeCancelHours: number;
}

export interface PublicCatalogData {
  business: PublicBusiness;
  services: PublicService[];
  staff: PublicStaff[];
  /** service_id → staff_ids offering it (service_staff_public, migration 00017). */
  serviceStaff: Record<string, string[]>;
  /** From get_availability's business block; null when no service exists yet. */
  policy: PublicPolicy | null;
}

/* ------------------------------------------------------------------ */
/* Formatting helpers — always in the BUSINESS timezone                */
/* ------------------------------------------------------------------ */

/** "2026-10-22"-style business-local date for an instant (default: now). */
export function todayInTz(tz: string, instant: Date = new Date()): string {
  return formatInTimeZone(instant, tz, "yyyy-MM-dd");
}

/** Add calendar days to a YYYY-MM-DD string (pure date math, no tz). */
export function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** "Thursday, October 22" for a YYYY-MM-DD business-local date. */
export function dateLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "Thu, Oct 22" for a YYYY-MM-DD business-local date. */
export function shortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "Thu" for a YYYY-MM-DD business-local date. */
export function weekdayShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

/** "9:00 AM" label for an ISO instant, in the business timezone. */
export function timeLabel(isoInstant: string, tz: string): string {
  return formatInTimeZone(new Date(isoInstant), tz, "h:mm a");
}

/** "9:00 AM" → end label after `dur` minutes (pure label math). */
export function endTimeLabel(start: string, dur: number): string {
  const m = /^(\d+):(\d+) (AM|PM)$/.exec(start);
  if (!m) return "";
  let h = Number(m[1]) % 12;
  if (m[3] === "PM") h += 12;
  const t = h * 60 + Number(m[2]) + dur;
  const eh = Math.floor(t / 60) % 24;
  const em = t % 60;
  const ap = eh >= 12 ? "PM" : "AM";
  const h12 = eh % 12 === 0 ? 12 : eh % 12;
  return `${h12}:${String(em).padStart(2, "0")} ${ap}`;
}

/** Full long label for an instant: "Thursday, October 22 at 9:00 AM". */
export function instantLabel(isoInstant: string, tz: string): string {
  return `${formatInTimeZone(new Date(isoInstant), tz, "EEEE, MMMM d")} at ${timeLabel(isoInstant, tz)}`;
}

/** Free-cancel deadline label: startsAt − freeCancelHours, business tz. */
export function freeCancelLabel(
  startsAtIso: string,
  freeCancelHours: number,
  tz: string,
): string {
  const deadline = new Date(Date.parse(startsAtIso) - freeCancelHours * 3_600_000);
  return instantLabel(deadline.toISOString(), tz);
}

/** Whole-dollar-or-cents money label is formatCents from @/lib/format. */

/** One slot as the availability API returns it (labels pre-rendered server-side). */
export interface ApiSlot {
  startsAt: string;
  endsAt: string;
  staffId: string;
  label: string;
  endLabel: string;
}

export interface ApiDay {
  date: string;
  status: "open" | "closed" | "fully_booked";
  reason?: string;
  slots: ApiSlot[];
  /** "9:00 AM – 10:30 AM"-style labels of blocking bookings (timeline). */
  bookedLabels: string[];
  openTime: string | null;
  closeTime: string | null;
}

export interface AvailabilityResponseData {
  business: { id: string; name: string; slug: string; timezone: string };
  staff: { id: string; name: string; title: string | null; photoUrl: string | null }[];
  days: ApiDay[];
}
