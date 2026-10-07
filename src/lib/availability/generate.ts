/**
 * Availability engine — slot grid generation.
 *
 * Pure functions. All arithmetic happens in business-local wall-clock time
 * (via date-fns-tz); slots are returned as UTC instants.
 *
 * Judgement calls baked into this implementation (see repo report):
 *  1. Candidate starts begin at the day's open time and advance by
 *     `slotStepMinutes` (the grid is step-aligned, anchored at window open).
 *  2. Only the service interval [start, start+duration) must fit inside the
 *     open window; a candidate's own `bufferAfter` may spill into closed
 *     time (buffers are enforced against *other* blocks, not the window).
 *  3. A blackout closes the day even if an override exists for that date.
 *  4. Ambiguous fall-back wall times resolve to the earlier occurrence
 *     (offset disambiguation); nonexistent spring-forward wall times are
 *     skipped entirely.
 *  5. Dates before business-local today or beyond `maxAdvanceDays` return no
 *     slots and are reported as `closed` by `generateDayRange` (reason
 *     explains why), never `fully_booked`.
 */

import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import type {
  BlockingBooking,
  DayAvailability,
  Slot,
  SlotInput,
  TimeOffRange,
} from './types';

const MS_PER_MIN = 60_000;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/* ------------------------------------------------------------------ */
/* small calendar helpers (pure, no tz database needed)                */
/* ------------------------------------------------------------------ */

function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) throw new TypeError(`invalid YYYY-MM-DD date: ${ymd}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** Add calendar days to a "YYYY-MM-DD" string. */
export function addDaysYmd(ymd: string, n: number): string {
  const { y, m, d } = parseYmd(ymd);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

function parseTime(hhmm: string): { h: number; m: number } {
  const match = TIME_RE.exec(hhmm);
  if (!match) throw new TypeError(`invalid HH:mm time: ${hhmm}`);
  return { h: Number(match[1]), m: Number(match[2]) };
}

/* ------------------------------------------------------------------ */
/* wall-clock <-> instant conversion with DST handling                 */
/* ------------------------------------------------------------------ */

/**
 * Convert a business-local wall time to a UTC instant (ms), or `null` when
 * the local time does not exist (spring-forward gap). Ambiguous fall-back
 * times resolve to the *earlier* occurrence (date-fns-tz behavior) — the
 * round-trip check below confirms the wall clock still reads the same.
 */
function wallToInstantMsOrNull(
  dateYmd: string,
  hhmm: string,
  tz: string,
): number | null {
  const probe = new Date(`${dateYmd}T${hhmm}:00.000Z`); // wall fields as UTC
  const instant = fromZonedTime(probe, tz).getTime();
  const roundTrip = formatInTimeZone(instant, tz, 'yyyy-MM-dd HH:mm');
  return roundTrip === `${dateYmd} ${hhmm}` ? instant : null;
}

/**
 * Same as above, but nudges the wall clock forward/backward until a valid
 * instant is found (used for window boundaries, which are pathological but
 * must never crash). `dir`: +1 nudge later, -1 nudge earlier.
 */
function clampBoundary(
  dateYmd: string,
  hhmm: string,
  tz: string,
  dir: 1 | -1,
): number | null {
  const { h, m } = parseTime(hhmm);
  let mins = h * 60 + m;
  for (let i = 0; i <= 240; i++) {
    const cand = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    const instant = wallToInstantMsOrNull(dateYmd, cand, tz);
    if (instant !== null) return instant;
    mins += dir;
    if (mins < 0 || mins >= 24 * 60) return null;
  }
  return null;
}

/** Business-local weekday of a "YYYY-MM-DD" date: 0 = Sunday … 6 = Saturday. */
function localWeekday(dateYmd: string, tz: string): number {
  // local noon never falls in a transition gap for real-world zones
  const noon = fromZonedTime(new Date(`${dateYmd}T12:00:00.000Z`), tz).getTime();
  const isoDay = Number(formatInTimeZone(noon, tz, 'i')); // 1=Mon … 7=Sun
  return isoDay % 7;
}

/* ------------------------------------------------------------------ */
/* window resolution                                                   */
/* ------------------------------------------------------------------ */

export interface ResolvedWindow {
  status: 'open' | 'closed';
  reason?: string;
  /** UTC ms, present when open. */
  openMs?: number;
  closeMs?: number;
}

function validateInput(input: SlotInput): void {
  if (input.serviceDurationMinutes <= 0) throw new TypeError('serviceDurationMinutes must be > 0');
  if (input.slotStepMinutes <= 0) throw new TypeError('slotStepMinutes must be > 0');
  if (input.bufferBeforeMinutes < 0 || input.bufferAfterMinutes < 0)
    throw new TypeError('buffers must be >= 0');
  if (input.minLeadTimeMinutes < 0) throw new TypeError('minLeadTimeMinutes must be >= 0');
  if (input.maxAdvanceDays < 1) throw new TypeError('maxAdvanceDays must be >= 1');
  if (Number.isNaN(Date.parse(input.nowIso))) throw new TypeError('nowIso must be a valid ISO datetime');
}

/**
 * Resolve the day's open window. Precedence:
 * blackout → override → staff rule (for the weekday) → business weekly rule.
 */
export function resolveWindow(input: SlotInput, dateYmd: string): ResolvedWindow {
  validateInput(input);
  const tz = input.businessTimezone;

  const blackout = input.blackouts.find((b) => b.date === dateYmd);
  if (blackout) {
    return { status: 'closed', reason: blackout.reason ?? 'Closed for a blackout date' };
  }

  const override = input.overrides.find((o) => o.date === dateYmd);
  if (override) {
    if (override.isClosed || override.openTime === null || override.closeTime === null) {
      return { status: 'closed', reason: override.reason ?? 'Closed' };
    }
    return buildWindow(dateYmd, override.openTime, override.closeTime, tz);
  }

  const weekday = localWeekday(dateYmd, tz);
  const staffRule = input.staffRules?.find((r) => r.weekday === weekday);
  const rule = staffRule ?? input.weeklyRules.find((r) => r.weekday === weekday);
  if (!rule) return { status: 'closed', reason: 'No hours set for this day' };
  if (rule.isClosed) return { status: 'closed', reason: 'Closed' };
  return buildWindow(dateYmd, rule.openTime, rule.closeTime, tz);
}

function buildWindow(
  dateYmd: string,
  openTime: string,
  closeTime: string,
  tz: string,
): ResolvedWindow {
  const openWall = parseTime(openTime);
  const closeWall = parseTime(closeTime);
  const openWallMins = openWall.h * 60 + openWall.m;
  const closeWallMins = closeWall.h * 60 + closeWall.m;
  if (closeWallMins <= openWallMins) {
    return { status: 'closed', reason: 'Invalid hours for this day' };
  }
  const openMs = clampBoundary(dateYmd, openTime, tz, 1);
  const closeMs = clampBoundary(dateYmd, closeTime, tz, -1);
  if (openMs === null || closeMs === null || closeMs <= openMs) {
    return { status: 'closed', reason: 'Invalid hours for this day' };
  }
  return { status: 'open', openMs, closeMs };
}

/* ------------------------------------------------------------------ */
/* blocking intervals                                                  */
/* ------------------------------------------------------------------ */

interface Block {
  startMs: number;
  endMs: number;
}

/**
 * Build the blocked intervals relevant to the day's window: approved
 * time-off ranges (raw) plus blocking bookings expanded by
 * bufferBefore/bufferAfter.
 */
function blockedIntervals(
  input: SlotInput,
  openMs: number,
  closeMs: number,
): Block[] {
  const blocks: Block[] = [];
  const push = (startIso: string, endIso: string, expandBeforeMs: number, expandAfterMs: number) => {
    const s = Date.parse(startIso) - expandBeforeMs;
    const e = Date.parse(endIso) + expandAfterMs;
    if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return;
    if (e > openMs && s < closeMs) blocks.push({ startMs: s, endMs: e });
  };
  for (const t of input.timeOff) {
    if (t.status !== 'approved') continue;
    push(t.startsAt, t.endsAt, 0, 0);
  }
  const bb = input.bufferBeforeMinutes * MS_PER_MIN;
  const ba = input.bufferAfterMinutes * MS_PER_MIN;
  for (const b of input.bookings) {
    push(b.startsAt, b.endsAt, bb, ba);
  }
  blocks.sort((a, b) => a.startMs - b.startMs);
  return blocks;
}

function overlaps(aStart: number, aEnd: number, b: Block): boolean {
  return aStart < b.endMs && b.startMs < aEnd;
}

/* ------------------------------------------------------------------ */
/* slot generation                                                     */
/* ------------------------------------------------------------------ */

/**
 * Generate bookable slots for one business-local day.
 *
 * - Computes in business-local wall time: candidates start at the window's
 *   open time and advance by `slotStepMinutes`.
 * - Skips nonexistent wall times (spring-forward DST gap); disambiguates
 *   fall-back repeats by offset (earlier occurrence).
 * - Drops candidates overlapping (buffer-expanded) bookings or approved
 *   time-off, candidates starting before now+minLeadTime, and any date
 *   before today or beyond maxAdvanceDays (business-local).
 * - Returns UTC ISO instants, ascending, deterministic for identical input.
 */
export function generateSlotsForDay(
  input: SlotInput,
  dateYmd: string,
  staffId: string,
): Slot[] {
  const window = resolveWindow(input, dateYmd);
  if (window.status !== 'open' || window.openMs === undefined || window.closeMs === undefined) {
    return [];
  }
  const tz = input.businessTimezone;
  const nowMs = Date.parse(input.nowIso);
  const todayLocal = formatInTimeZone(nowMs, tz, 'yyyy-MM-dd');
  if (dateYmd < todayLocal) return [];
  if (dateYmd > addDaysYmd(todayLocal, input.maxAdvanceDays)) return [];

  const leadCutoffMs = nowMs + input.minLeadTimeMinutes * MS_PER_MIN;
  const durMs = input.serviceDurationMinutes * MS_PER_MIN;
  const blocks = blockedIntervals(input, window.openMs, window.closeMs);

  const openWall = formatInTimeZone(window.openMs, tz, 'HH:mm');
  const closeWall = formatInTimeZone(window.closeMs, tz, 'HH:mm');
  const openWallMins = parseTime(openWall).h * 60 + parseTime(openWall).m;
  const closeWallMins = parseTime(closeWall).h * 60 + parseTime(closeWall).m;

  const slots: Slot[] = [];
  for (let wallMins = openWallMins; wallMins + input.serviceDurationMinutes <= closeWallMins; ) {
    const hhmm = `${String(Math.floor(wallMins / 60)).padStart(2, '0')}:${String(wallMins % 60).padStart(2, '0')}`;
    const startMs = wallToInstantMsOrNull(dateYmd, hhmm, tz);
    if (startMs !== null) {
      const endMs = startMs + durMs;
      const blocked = blocks.some((b) => overlaps(startMs, endMs, b));
      if (!blocked && startMs >= leadCutoffMs) {
        slots.push({
          startsAt: new Date(startMs).toISOString(),
          endsAt: new Date(endMs).toISOString(),
          staffId,
        });
      }
    }
    wallMins += input.slotStepMinutes;
  }
  return slots;
}

/* ------------------------------------------------------------------ */
/* day range                                                           */
/* ------------------------------------------------------------------ */

/**
 * Generate availability for a range of business-local days starting at
 * `startYmd` (inclusive), `days` days long. Per-day status:
 * - `closed` when the day has no open window (blackout / override / weekly
 *   rule closed), with the specific reason,
 * - `fully_booked` when the window is open but zero slots survive clipping,
 * - `open` otherwise.
 */
export function generateDayRange(
  input: SlotInput,
  startYmd: string,
  days: number,
  staffId: string,
): DayAvailability[] {
  if (!Number.isInteger(days) || days < 1) throw new TypeError('days must be a positive integer');
  const tz = input.businessTimezone;
  const todayLocal = formatInTimeZone(Date.parse(input.nowIso), tz, 'yyyy-MM-dd');
  const lastLocal = addDaysYmd(todayLocal, input.maxAdvanceDays);

  const out: DayAvailability[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDaysYmd(startYmd, i);
    if (date < todayLocal || date > lastLocal) {
      out.push({
        date,
        status: 'closed',
        slots: [],
        reason: date < todayLocal ? 'Past date' : 'Outside the booking window',
      });
      continue;
    }
    const window = resolveWindow(input, date);
    if (window.status === 'closed') {
      out.push({ date, status: 'closed', slots: [], reason: window.reason ?? 'Closed' });
      continue;
    }
    const slots = generateSlotsForDay(input, date, staffId);
    if (slots.length === 0) {
      out.push({
        date,
        status: 'fully_booked',
        slots: [],
        reason: 'Fully booked — no openings on this day',
      });
    } else {
      out.push({ date, status: 'open', slots });
    }
  }
  return out;
}

// Re-export types used in signatures for convenience of deep imports.
export type { BlockingBooking, TimeOffRange };
