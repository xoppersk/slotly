/**
 * Availability engine — timezone presentation helpers.
 *
 * Pure formatting functions. The grid itself is always computed in the
 * business's canonical timezone; these helpers render it for the customer.
 */

import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import type { DayAvailability, Slot } from './types';

export interface DualTimezoneLabel {
  /** Slot start in the customer's timezone, e.g. "10:00 AM". */
  customerLabel: string;
  /** Slot start in the business's timezone, e.g. "2:00 PM". */
  businessLabel: string;
  /** True when the two timezones differ — the UI shows both labels only then. */
  showDual: boolean;
}

/**
 * Format one slot for display. When the customer and business timezones are
 * the same zone only `customerLabel` is needed (`showDual` is false).
 */
export function formatSlotForCustomer(
  slotUtcIso: string,
  businessTimezone: string,
  customerTimezone: string,
): DualTimezoneLabel {
  const instant = Date.parse(slotUtcIso);
  if (Number.isNaN(instant)) throw new TypeError(`invalid ISO datetime: ${slotUtcIso}`);
  return {
    customerLabel: formatInTimeZone(instant, customerTimezone, 'h:mm a'),
    businessLabel: formatInTimeZone(instant, businessTimezone, 'h:mm a'),
    showDual: businessTimezone !== customerTimezone,
  };
}

/**
 * Format a business-local "YYYY-MM-DD" day for display, e.g.
 * "Thursday, Oct 8".
 */
export function formatDayLabel(dateYmd: string, businessTimezone: string): string {
  // local noon is unambiguous for every real-world zone
  const noon = fromZonedTime(new Date(`${dateYmd}T12:00:00.000Z`), businessTimezone).getTime();
  return formatInTimeZone(noon, businessTimezone, 'EEEE, MMM d');
}

/**
 * The earliest bookable slot across a day range — the "next opening" /
 * "first available" UX. Assumes each day's slots are ascending (the engine
 * generates them in order).
 */
export function nextAvailableSlot(days: DayAvailability[]): Slot | null {
  for (const day of days) {
    if (day.slots.length > 0) return day.slots[0] ?? null;
  }
  return null;
}
