/**
 * Pure helpers for the dashboard management screens (services, staff,
 * availability, settings, onboarding). No I/O — safe to import from Client
 * Components and unit-tested here.
 *
 * Weekday convention (matches the availability engine and the DB check):
 * 0 = Sunday … 6 = Saturday. A closed day is represented by the ABSENCE of an
 * availability_rules row — buildWeeklyRuleRows() only emits rows for open
 * days.
 */

import type { PaymentPolicy } from "@/lib/supabase/types";

export interface WeekdayDef {
  value: number;
  short: string;
  label: string;
}

export const WEEKDAYS: WeekdayDef[] = [
  { value: 0, short: "Sun", label: "Sunday" },
  { value: 1, short: "Mon", label: "Monday" },
  { value: 2, short: "Tue", label: "Tuesday" },
  { value: 3, short: "Wed", label: "Wednesday" },
  { value: 4, short: "Thu", label: "Thursday" },
  { value: 5, short: "Fri", label: "Friday" },
  { value: 6, short: "Sat", label: "Saturday" },
];

/** One row of the weekly-hours editor grid. Times are "HH:MM" (24h). */
export interface WeeklyDayInput {
  weekday: number;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
}

/** Default grid: Mon–Fri 9:00–17:00, Sat–Sun closed. */
export function defaultWeeklyGrid(): WeeklyDayInput[] {
  return WEEKDAYS.map((d) => ({
    weekday: d.value,
    isClosed: d.value === 0 || d.value === 6,
    openTime: "09:00",
    closeTime: "17:00",
  }));
}

/** "09:00" → "09:00:00" for the `time` columns. */
export function toTimeString(hhmm: string): string {
  const [h = "0", m = "0"] = hhmm.split(":");
  const hh = h.padStart(2, "0");
  const mm = m.padStart(2, "0");
  return `${hh}:${mm}:00`;
}

/** "09:00" → "9:00 AM", "13:30" → "1:30 PM" (tnum-rendered in the UI). */
export function formatTimeLabel(hhmm: string): string {
  const [hRaw = "0", mRaw = "0"] = hhmm.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export interface WeeklyRuleRowInput {
  business_id: string;
  staff_id: string | null;
  weekday: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

/**
 * Convert the editor grid into availability_rules insert payloads.
 * Closed days emit no row (the engine treats a missing row as closed).
 */
export function buildWeeklyRuleRows(
  businessId: string,
  staffId: string | null,
  grid: WeeklyDayInput[],
): WeeklyRuleRowInput[] {
  return grid
    .filter((day) => !day.isClosed)
    .map((day) => ({
      business_id: businessId,
      staff_id: staffId,
      weekday: day.weekday,
      open_time: toTimeString(day.openTime),
      close_time: toTimeString(day.closeTime),
      is_closed: false,
    }));
}

/** True when a day's open/close pair is a valid non-empty range. */
export function isValidDayRange(openTime: string, closeTime: string): boolean {
  return toTimeString(closeTime) > toTimeString(openTime);
}

export interface ServicePaymentInput {
  priceCents: number;
  paymentPolicy: PaymentPolicy;
  depositCents: number;
}

/**
 * Validate the service payment-policy fields. Returns human-readable errors
 * (empty = valid). Mirrors the DB checks (deposit_cents <= price_cents) plus
 * the product rule that a deposit policy needs a positive deposit.
 */
export function validateServicePayment(
  input: ServicePaymentInput,
): string[] {
  const errors: string[] = [];
  if (input.priceCents < 0) errors.push("Price cannot be negative.");
  if (input.depositCents < 0) errors.push("Deposit cannot be negative.");
  if (input.depositCents > input.priceCents) {
    errors.push("Deposit cannot be more than the full price.");
  }
  if (input.paymentPolicy === "deposit" && input.depositCents <= 0) {
    errors.push("A deposit policy needs a deposit amount greater than $0.");
  }
  return errors;
}

/** Duration slider: 5-minute steps between 5 and 480 minutes. */
export function clampDuration(minutes: number): number {
  const stepped = Math.round(minutes / 5) * 5;
  return Math.min(480, Math.max(5, stepped));
}

/** 90 → "1h 30m", 45 → "45m". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Dollars input → integer cents, rounded. NaN / negative → 0. */
export function dollarsToCents(dollars: number): number {
  if (!Number.isFinite(dollars) || dollars < 0) return 0;
  return Math.round(dollars * 100);
}

/** Curated IANA timezone list for the settings/onboarding selectors. */
export const COMMON_TIMEZONES: string[] = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  "Atlantic/Azores",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Zurich",
  "Europe/Stockholm",
  "Europe/Athens",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "UTC",
];
