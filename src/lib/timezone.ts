/**
 * Timezone helpers for Slotly's availability engine and booking surface.
 *
 * Pure functions on `date-fns-tz` — safe to import anywhere. All datetimes
 * are UTC instants in Postgres (`timestamptz`); these helpers convert to and
 * from business-local wall time for slot grids and display.
 *
 * DST policy (per the technical requirements):
 * - Spring-forward gaps: a requested wall time that never occurs (e.g.
 *   02:30 on 2026-03-08 in America/New_York) is shifted forward past the gap
 *   by the transition's offset delta — we never emit an invalid instant.
 * - Fall-back repeats: the wall time is ambiguous; the offset the tz database
 *   assigns to that wall time wins (deterministic, round-trips cleanly).
 */

import { formatInTimeZone, getTimezoneOffset } from "date-fns-tz";

const WALL_FORMAT = "yyyy-MM-dd'T'HH:mm:ss";
const DAY_KEY_FORMAT = "yyyy-MM-dd";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function parseYmd(dateYmd: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd);
  if (!m) throw new Error(`Invalid date (expected YYYY-MM-DD): ${dateYmd}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) {
    throw new Error(`Invalid date (expected YYYY-MM-DD): ${dateYmd}`);
  }
  return [y, mo, d];
}

function parseHm(time: string): [number, number] {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) throw new Error(`Invalid time (expected HH:MM): ${time}`);
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) throw new Error(`Invalid time (expected HH:MM): ${time}`);
  return [h, mi];
}

function wallKey(y: number, mo: number, d: number, h: number, mi: number): string {
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:00`;
}

/**
 * Convert a wall-clock time in `tz` to a UTC instant, shifting forward past
 * any spring-forward gap. Always returns an instant whose wall time in `tz`
 * is a real, occurring local time.
 */
function zonedWallToUtc(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  tz: string,
): Date {
  // Interpret the components as wall time in tz; UTC = wall - offset.
  const naiveUtcMs = Date.UTC(y, mo - 1, d, h, mi, 0);
  const offsetMs = getTimezoneOffset(tz, new Date(y, mo - 1, d, h, mi, 0));
  const candidate = new Date(naiveUtcMs - offsetMs);

  if (formatInTimeZone(candidate, tz, WALL_FORMAT) === wallKey(y, mo, d, h, mi)) {
    return candidate; // normal time, or an ambiguous fall-back time (offset disambiguates)
  }

  // Spring-forward gap: the requested wall time never occurs. Shift the wall
  // clock forward by the transition's offset delta (usually 1h), then convert
  // the shifted (valid) wall time.
  const dayBefore = new Date(y, mo - 1, d - 1, h, mi, 0);
  const dayAfter = new Date(y, mo - 1, d + 1, h, mi, 0);
  const gapMs = Math.abs(getTimezoneOffset(tz, dayAfter) - getTimezoneOffset(tz, dayBefore));
  const shifted = new Date(naiveUtcMs + gapMs);
  const shiftedOffset = getTimezoneOffset(
    tz,
    new Date(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
      shifted.getUTCHours(),
      shifted.getUTCMinutes(),
      0,
    ),
  );
  return new Date(shifted.getTime() - shiftedOffset);
}

/**
 * The current instant. A `Date` is always an instant — the timezone only
 * matters when rendering it, so the argument exists for API symmetry.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function nowInTimezone(_tz: string): Date {
  return new Date();
}

/** Business-local calendar day ("YYYY-MM-DD") for a UTC instant. */
export function toBusinessDayKey(utcIso: string, tz: string): string {
  return formatInTimeZone(utcIso, tz, DAY_KEY_FORMAT);
}

export interface BusinessDayRange {
  startsAtUtc: Date;
  endsAtUtc: Date;
}

/**
 * Convert a business-local open/close window on `dateYmd` (e.g. "2026-03-09",
 * "09:00", "17:00") to UTC instants. DST gaps shift forward past the gap;
 * throws when close is not after open.
 */
export function businessLocalRangeToUtc(
  dateYmd: string,
  openTime: string,
  closeTime: string,
  tz: string,
): BusinessDayRange {
  const [y, mo, d] = parseYmd(dateYmd);
  const [oh, om] = parseHm(openTime);
  const [ch, cm] = parseHm(closeTime);
  const startsAtUtc = zonedWallToUtc(y, mo, d, oh, om, tz);
  const endsAtUtc = zonedWallToUtc(y, mo, d, ch, cm, tz);
  if (endsAtUtc.getTime() <= startsAtUtc.getTime()) {
    throw new Error(
      `closeTime (${closeTime}) must be after openTime (${openTime}) on ${dateYmd} in ${tz}`,
    );
  }
  return { startsAtUtc, endsAtUtc };
}

export interface DualTimeLabel {
  /** Slot time in the customer's timezone, e.g. "10:00 AM". */
  customer: string;
  /** Slot time in the business's timezone, e.g. "2:00 PM". */
  business: string;
  /**
   * True when the rendered labels differ — i.e. when the UI should show the
   * "10:00 AM your time (2:00 PM business time)" parenthetical.
   */
  different: boolean;
}

/**
 * Dual-timezone slot label. `different` compares the rendered labels (not the
 * zone names): zones that currently share wall time (e.g. London and Freetown
 * in winter) render identically, so the parenthetical is redundant.
 */
export function dualTimeLabel(
  slotUtcIso: string,
  businessTz: string,
  customerTz: string,
): DualTimeLabel {
  const customer = formatInTimeZone(slotUtcIso, customerTz, "h:mm a");
  const business = formatInTimeZone(slotUtcIso, businessTz, "h:mm a");
  return { customer, business, different: customer !== business };
}

/**
 * List `days` business-local day keys starting at `startYmd`, DST-safe.
 * Anchors at noon wall time (never inside a transition) and steps whole
 * 24h days, so spring-forward/fall-back never duplicate or skip a day.
 */
export function iterateBusinessDays(startYmd: string, days: number, tz: string): string[] {
  if (!Number.isInteger(days) || days < 0) {
    throw new Error(`days must be a non-negative integer (got ${days})`);
  }
  const [y, mo, d] = parseYmd(startYmd);
  const anchorUtc = zonedWallToUtc(y, mo, d, 12, 0, tz);
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    out.push(formatInTimeZone(new Date(anchorUtc.getTime() + i * 86_400_000), tz, DAY_KEY_FORMAT));
  }
  return out;
}
