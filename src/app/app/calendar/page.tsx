/* D-04 Calendar (server): real bookings for the chosen day (?date=),
   real staff columns, real now-line. The fixture's break block and
   canned "open" block have no database source (availability rules are
   single-window; openings are computed, not stored) — see PROD-W4.md. */
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";

import {
  listAvailabilityOverrides,
  listAvailabilityRules,
  listBlackoutDates,
  listStaffAdmin,
  listTimeOff,
} from "@/lib/db/owner";
import { createClient } from "@/lib/supabase/server";

import { getDashboardContext, loadBookings } from "../_lib/data";
import { windowFor, type AvailData } from "../_lib/availability-math";
import { dayBoundsIso, todayKey } from "../_lib/model";
import { CalendarClient } from "./CalendarClient";

type SP = Promise<Record<string, string | string[] | undefined>>;

async function CalendarInner({ searchParams }: { searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx) redirect("/onboarding");
  const { business } = ctx;
  const tz = business.timezone;
  const today = todayKey(tz);

  const sp = await searchParams;
  const raw = Array.isArray(sp.date) ? sp.date[0] : sp.date;
  const date = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;

  const { fromIso, toIso } = dayBoundsIso(date, tz);
  const supabase = await createClient();
  const [bundle, staff, rules, overrides, blackouts, timeOff] = await Promise.all([
    loadBookings(business, { fromIso, toIso }),
    listStaffAdmin(supabase, business.id),
    listAvailabilityRules(supabase, business.id),
    listAvailabilityOverrides(supabase, business.id),
    listBlackoutDates(supabase, business.id),
    listTimeOff(supabase, business.id, "approved"),
  ]);
  const avail: AvailData = { rules, overrides, blackouts, timeOff };

  const activeStaff = staff.filter((s) => s.is_active);
  const windows = activeStaff.map((s) => windowFor(s.id, date, avail));
  const openMinutes = windows.reduce((min, w) => (w ? Math.min(min, w.openMinutes) : min), 9 * 60);
  const closeMinutes = windows.reduce((max, w) => (w ? Math.max(max, w.closeMinutes) : max), 18 * 60);
  const dayStart = Math.floor((windows.some(Boolean) ? openMinutes : 9 * 60) / 60) * 60;
  const dayEnd = Math.ceil((windows.some(Boolean) ? closeMinutes : 18 * 60) / 60) * 60;

  const awayByStaff: Record<string, string> = {};
  for (const t of timeOff) {
    if (new Date(t.starts_at) < new Date(toIso) && new Date(t.ends_at) > new Date(fromIso)) {
      const s = activeStaff.find((x) => x.id === t.staff_id);
      if (s) {
        const back = new Date(t.ends_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        awayByStaff[t.staff_id] = `Time off until ${back}`;
      }
    }
  }

  const now = new Date();
  const isToday = date === today;
  const nowMinutes = isToday
    ? Number(formatInTimeZone(now, tz, "H")) * 60 + Number(formatInTimeZone(now, tz, "mm"))
    : null;

  return (
    <CalendarClient
      date={date}
      today={today}
      staff={activeStaff.map((s) => ({ id: s.id, name: s.name }))}
      bookings={bundle.bookings.filter((b) => b.dbStatus !== "cancelled")}
      awayByStaff={awayByStaff}
      dayStartMinutes={dayStart}
      dayEndMinutes={dayEnd}
      nowMinutes={nowMinutes}
      nowLabel={isToday ? formatInTimeZone(now, tz, "h:mm a") : null}
    />
  );
}

export default function CalendarPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={null}>
      <CalendarInner searchParams={searchParams} />
    </Suspense>
  );
}
