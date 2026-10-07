/**
 * Dashboard formatting helpers — pure functions, client-safe.
 *
 * Business-local rendering uses date-fns-tz so every time is shown in the
 * business's canonical timezone. Times and prices are rendered for the
 * `tnum` utility (tabular numerals) at the call site.
 */

import { formatInTimeZone } from "date-fns-tz";

/** "2:00 PM" in the business timezone. */
export function formatTimeShort(utcIso: string, tz: string): string {
  return formatInTimeZone(utcIso, tz, "h:mm a");
}

/** "Thursday, March 12" in the business timezone. */
export function formatDateLong(utcIso: string, tz: string): string {
  return formatInTimeZone(utcIso, tz, "EEEE, MMMM d");
}

/** "Thursday at 2:00 PM" — matches the notify template voice. */
export function formatWhenLabel(utcIso: string, tz: string): string {
  return formatInTimeZone(utcIso, tz, "EEEE 'at' h:mm a");
}

/** "Thursday, March 12 at 2:00 PM" — full label for emails/drawers. */
export function formatDateTimeLabel(utcIso: string, tz: string): string {
  return formatInTimeZone(utcIso, tz, "EEEE, MMMM d 'at' h:mm a");
}

/** "Mar 12" — compact day label for tables and chips. */
export function formatDateShort(utcIso: string, tz: string): string {
  return formatInTimeZone(utcIso, tz, "MMM d");
}

/** "YYYY-MM-DD" day key for an instant in a timezone. */
export function dayKey(utcIso: string, tz: string): string {
  return formatInTimeZone(utcIso, tz, "yyyy-MM-dd");
}

/** "Thu" weekday label for a day key ("YYYY-MM-DD") at noon local. */
export function weekdayShort(dayYmd: string, tz: string): string {
  return formatInTimeZone(`${dayYmd}T12:00:00Z`, tz, "EEE");
}

/** Day-of-month number for a day key, e.g. 8. */
export function dayOfMonth(dayYmd: string): number {
  return Number(dayYmd.slice(8, 10));
}

/** "Oct 8" header label for a day key. */
export function dayHeaderLabel(dayYmd: string, tz: string): string {
  return formatInTimeZone(`${dayYmd}T12:00:00Z`, tz, "MMM d");
}

/** Morning/afternoon/evening greeting for the dashboard header. */
export function greetingForHour(hour24: number): string {
  if (hour24 < 12) return "Good morning";
  if (hour24 < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * No-show rate as a 0–100 percentage: no-shows / (completed + no-shows).
 * Returns 0 when there is no history to judge by.
 */
export function noShowRate(noShows: number, completed: number): number {
  const total = noShows + completed;
  if (total === 0) return 0;
  return Math.round((noShows / total) * 100);
}
