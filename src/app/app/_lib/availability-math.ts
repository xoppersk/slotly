/* Real availability math for dashboard stats (PROD-W4): windows from
 * availability_rules / overrides / blackout_dates / approved time off,
 * openings checked against live bookings. Business timezone throughout
 * (dates are yyyy-mm-dd keys in the business tz). */
import { fromZonedTime } from "date-fns-tz";

import type {
  AvailabilityOverrideRow,
  AvailabilityRuleRow,
  BlackoutDateRow,
  BusinessRow,
  StaffRow,
  StaffTimeOffRow,
} from "@/lib/supabase/types";

import { shiftDateKey, weekdayOf, type DashBooking } from "./model";

export interface DayWindow {
  openMinutes: number;
  closeMinutes: number;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export interface AvailData {
  rules: AvailabilityRuleRow[];
  overrides: AvailabilityOverrideRow[];
  blackouts: BlackoutDateRow[];
  timeOff: StaffTimeOffRow[]; // approved only matters; pass approved rows
}

/** The bookable window for one staff member on one day, or null (closed). */
export function windowFor(
  staffId: string,
  dateKey: string,
  data: AvailData,
): DayWindow | null {
  if (data.blackouts.some((b) => b.date === dateKey)) return null;
  const override =
    data.overrides.find((o) => o.date === dateKey && o.staff_id === staffId) ??
    data.overrides.find((o) => o.date === dateKey && o.staff_id === null);
  if (override) {
    if (override.is_closed || !override.open_time || !override.close_time) return null;
    return { openMinutes: timeToMinutes(override.open_time), closeMinutes: timeToMinutes(override.close_time) };
  }
  const weekday = weekdayOf(dateKey);
  const rule =
    data.rules.find((r) => r.weekday === weekday && r.staff_id === staffId) ??
    data.rules.find((r) => r.weekday === weekday && r.staff_id === null);
  if (!rule || rule.is_closed) return null;
  return { openMinutes: timeToMinutes(rule.open_time), closeMinutes: timeToMinutes(rule.close_time) };
}

/** True when approved time off covers the whole window that day. */
export function fullyAway(
  staffId: string,
  dateKey: string,
  window: DayWindow,
  timezone: string,
  timeOff: StaffTimeOffRow[],
): boolean {
  const dayStart = fromZonedTime(`${dateKey}T00:00:00`, timezone).getTime();
  const winStart = dayStart + window.openMinutes * 60_000;
  const winEnd = dayStart + window.closeMinutes * 60_000;
  return timeOff.some(
    (t) =>
      t.staff_id === staffId &&
      new Date(t.starts_at).getTime() <= winStart &&
      new Date(t.ends_at).getTime() >= winEnd,
  );
}

export function bookableMinutes(
  staffList: StaffRow[],
  dateKey: string,
  business: BusinessRow,
  data: AvailData,
): number {
  let total = 0;
  for (const s of staffList) {
    if (!s.is_active) continue;
    const w = windowFor(s.id, dateKey, data);
    if (!w) continue;
    if (fullyAway(s.id, dateKey, w, business.timezone, data.timeOff)) continue;
    total += w.closeMinutes - w.openMinutes;
  }
  return total;
}

export interface NextOpening {
  dateKey: string;
  timeLabel: string;
  staffId: string;
  staffName: string;
  whenLabel: string; // "Today" | "Tomorrow" | "Monday"
}

/** Earliest real opening across active staff over the next 14 days. */
export function findNextOpening(
  business: BusinessRow,
  staffList: StaffRow[],
  data: AvailData,
  bookings: DashBooking[],
  today: string,
  now: Date = new Date(),
): NextOpening | null {
  const step = business.slot_step_minutes;
  const earliest = now.getTime() + business.min_lead_time_minutes * 60_000;
  const live = bookings.filter((b) => b.dbStatus !== "cancelled" && b.dbStatus !== "no_show" && b.dbStatus !== "completed");
  for (let offset = 0; offset < 14; offset++) {
    const dateKey = shiftDateKey(today, offset);
    let best: NextOpening | null = null;
    for (const s of staffList) {
      if (!s.is_active) continue;
      const w = windowFor(s.id, dateKey, data);
      if (!w) continue;
      if (fullyAway(s.id, dateKey, w, business.timezone, data.timeOff)) continue;
      const dayStart = fromZonedTime(`${dateKey}T00:00:00`, business.timezone).getTime();
      for (let mins = w.openMinutes; mins + step <= w.closeMinutes; mins += step) {
        const startMs = dayStart + mins * 60_000;
        if (startMs < earliest) continue;
        const endMs = startMs + step * 60_000;
        const clash = live.some(
          (b) =>
            b.staffId === s.id &&
            new Date(b.startsAtIso).getTime() < endMs &&
            new Date(b.endsAtIso).getTime() > startMs,
        );
        if (clash) continue;
        const h24 = Math.floor(mins / 60);
        const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
        const label = `${h12}:${String(mins % 60).padStart(2, "0")} ${h24 >= 12 ? "PM" : "AM"}`;
        const whenLabel =
          offset === 0
            ? "Today"
            : offset === 1
              ? "Tomorrow"
              : new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
        if (!best) {
          best = { dateKey, timeLabel: label, staffId: s.id, staffName: s.name, whenLabel };
        }
        break; // earliest for this staff member today
      }
    }
    if (best) return best;
  }
  return null;
}
