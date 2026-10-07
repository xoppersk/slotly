/**
 * Availability engine — public types.
 *
 * Everything in `src/lib/availability/` is pure TypeScript: no imports from
 * supabase/next/DB layers. Datetimes cross the module boundary as ISO-8601
 * UTC strings; business-local dates as "YYYY-MM-DD"; wall-clock times as
 * "HH:mm".
 */

/** Weekly recurring hours. `weekday`: 0 = Sunday … 6 = Saturday. */
export interface WeeklyRule {
  weekday: number; // 0-6, 0 = Sunday
  openTime: string; // "HH:mm" business-local wall clock
  closeTime: string; // "HH:mm" business-local wall clock
  isClosed: boolean;
}

/**
 * Date-specific hours. Wins over weekly rules for its date (business-local).
 * `openTime`/`closeTime` are null when the whole day is closed.
 */
export interface DateOverride {
  date: string; // "YYYY-MM-DD" (business-local)
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
  reason?: string;
}

/** Whole-day closure (holiday etc.). Business-local date. */
export interface Blackout {
  date: string; // "YYYY-MM-DD" (business-local)
  reason?: string;
}

/** A staff time-off request/range. Only `approved` ranges block slots. */
export interface TimeOffRange {
  startsAt: string; // ISO-8601 UTC
  endsAt: string; // ISO-8601 UTC
  status: 'pending' | 'approved' | 'declined';
}

/**
 * An existing booking that blocks the range. Callers pass only bookings in
 * blocking statuses (`pending`, `payment_pending`, `confirmed` — the statuses
 * covered by the Postgres EXCLUDE constraint); all other statuses are
 * dropped upstream and never reach this engine.
 */
export interface BlockingBooking {
  startsAt: string; // ISO-8601 UTC
  endsAt: string; // ISO-8601 UTC
}

/** Everything the slot grid needs for one staff member + one service. */
export interface SlotInput {
  businessTimezone: string; // IANA, e.g. "America/New_York"
  serviceDurationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  slotStepMinutes: number; // grid step in minutes (5, 10, 15, 20, 30, 60)
  weeklyRules: WeeklyRule[]; // business default hours
  /** Per-staff rules. When a rule exists for the weekday it wins over business rules. */
  staffRules?: WeeklyRule[];
  overrides: DateOverride[];
  blackouts: Blackout[];
  timeOff: TimeOffRange[];
  bookings: BlockingBooking[];
  minLeadTimeMinutes: number;
  maxAdvanceDays: number;
  nowIso: string; // injectable clock — ISO-8601 UTC
}

/** One bookable start time. Instants in UTC; customers see them via display.ts. */
export interface Slot {
  startsAt: string; // ISO-8601 UTC
  endsAt: string; // ISO-8601 UTC
  staffId: string;
}

/** One day of the availability range, with a UX-ready empty state. */
export interface DayAvailability {
  date: string; // "YYYY-MM-DD" (business-local)
  status: 'open' | 'closed' | 'fully_booked';
  slots: Slot[];
  /** Human-readable empty reason: distinct for "Closed" vs "Fully booked". */
  reason?: string;
}
