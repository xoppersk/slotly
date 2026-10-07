/**
 * Availability engine — public API.
 *
 * Pure functions only: slot-grid generation in business-local wall time and
 * timezone presentation helpers. No imports from supabase/next/DB layers.
 */

export type {
  WeeklyRule,
  DateOverride,
  Blackout,
  TimeOffRange,
  BlockingBooking,
  SlotInput,
  Slot,
  DayAvailability,
} from './types';

export {
  generateSlotsForDay,
  generateDayRange,
  resolveWindow,
  addDaysYmd,
} from './generate';

export {
  formatSlotForCustomer,
  formatDayLabel,
  nextAvailableSlot,
} from './display';
export type { DualTimezoneLabel } from './display';
