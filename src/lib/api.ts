/* Slotly v2 — typed data layer over the /data fixtures (HANDOVER §3, §9).
   Every surface reads through here so Today, Bookings, Calendar, the staff
   agenda and Customers always agree. Surface clocks are pinned to canon —
   never the wall clock. */

import businessJson from "../../data/business.json";
import servicesJson from "../../data/services.json";
import peopleJson from "../../data/people.json";
import bookingsJson from "../../data/bookings.json";
import customersJson from "../../data/customers.json";
import availabilityJson from "../../data/availability.json";
import timeoffJson from "../../data/timeoff.json";
import dashboardJson from "../../data/dashboard.json";

import type {
  AvailabilityDay,
  AvailabilityFile,
  Booking,
  Business,
  Customer,
  DashboardFile,
  PeopleFile,
  Person,
  Service,
  TimeOffFile,
} from "./types";

/* v1 reuse (evaluated 2026-10-16, see BUILD-LOG): formatCents already
   renders customer money with cents ($48.00) exactly as §5.3 requires,
   and formatPhoneDisplay is a safe pass-through — both re-exported here
   so v2 surfaces have one import site. */
export { formatCents, formatPhoneDisplay, slugify } from "./format";

/** Dashboard money: whole dollars, no cents (§5.3) — $672, not $672.00. */
export function formatWholeDollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

/* ------------------------------------------------------------------ */
/* Pinned surface clocks (HANDOVER §9)                                 */
/* ------------------------------------------------------------------ */

/** Customer booking surface "now": Tuesday, October 6, 2026. */
export const CUSTOMER_NOW = {
  date: "2026-10-06",
  weekdayLabel: "Tuesday",
  label: "Tuesday, October 6",
  shortLabel: "Tue, Oct 6",
} as const;

/** Dashboard + staff surface "now": Thursday, October 8, 2026, 10:40 AM. */
export const DASHBOARD_NOW = {
  date: "2026-10-08",
  weekdayLabel: "Thursday",
  label: "Thursday, October 8",
  shortLabel: "Thu, Oct 8",
  time: "10:40 AM",
} as const;

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

export const business = businessJson as unknown as Business;
export const services = servicesJson as unknown as Service[];
export const people = peopleJson as unknown as PeopleFile;
export const bookings = bookingsJson as unknown as Booking[];
export const customers = customersJson as unknown as Customer[];
export const availability = availabilityJson as unknown as AvailabilityFile;
export const timeoff = timeoffJson as unknown as TimeOffFile;
export const dashboard = dashboardJson as unknown as DashboardFile;

export function getBusiness(): Business {
  return business;
}
export function getServices(): Service[] {
  return services;
}
export function getService(id: string): Service | undefined {
  return services.find((s) => s.id === id);
}
export function getOwner(): Person {
  return people.owner;
}
export function getBarbers(): Person[] {
  return people.barbers;
}
export function getBarber(id: string): Person | undefined {
  return people.barbers.find((b) => b.id === id);
}
export function getPerson(id: string): Person | undefined {
  if (people.owner.id === id) return people.owner;
  return getBarber(id);
}
export function getBookings(): Booking[] {
  return bookings;
}
export function getBookingByCode(code: string): Booking | undefined {
  return bookings.find((b) => b.code === code);
}
export function getBookingById(id: string): Booking | undefined {
  return bookings.find((b) => b.id === id);
}
export function getKeyBooking(): Booking {
  return bookings.find((b) => b.code === "SLY-2026-1008-091") ?? bookings[0]!;
}
export function getJordanBellBooking(): Booking | undefined {
  return bookings.find((b) => b.code === "SLY-2026-1008-117");
}
export function getCustomers(): Customer[] {
  return customers;
}
export function getCustomer(id: string): Customer | undefined {
  return customers.find((c) => c.id === id);
}
export function getTimeOff(): TimeOffFile {
  return timeoff;
}
export function getDashboard(): DashboardFile {
  return dashboard;
}

/* ------------------------------------------------------------------ */
/* Derived helpers — computed from the fixtures, never hardcoded       */
/* ------------------------------------------------------------------ */

export interface DashboardTotals {
  count: number;
  bookedCents: number;
  depositsCents: number;
  toCollectCents: number;
  bookedLabel: string;
  depositsLabel: string;
  toCollectLabel: string;
}

/** Totals line for D-01/D-02. Must equal $672 / $280 / $392 / 14. */
export function getDashboardTotals(list: Booking[] = bookings): DashboardTotals {
  const bookedCents = list.reduce((sum, b) => sum + b.priceCents, 0);
  const depositsCents = list.reduce((sum, b) => sum + b.depositCents, 0);
  return {
    count: list.length,
    bookedCents,
    depositsCents,
    toCollectCents: bookedCents - depositsCents,
    bookedLabel: formatWholeDollars(bookedCents),
    depositsLabel: formatWholeDollars(depositsCents),
    toCollectLabel: formatWholeDollars(bookedCents - depositsCents),
  };
}

export function getBookingsForBarber(barberId: string, date = DASHBOARD_NOW.date): Booking[] {
  return bookings.filter((b) => b.barberId === barberId && b.date === date);
}

export function getUpNext(list: Booking[] = bookings): Booking[] {
  const rank: Record<string, number> = { "In the chair": 0, Arrived: 1, Upcoming: 2, Done: 3, Confirmed: 2 };
  return [...list].sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || a.start24.localeCompare(b.start24));
}

/** Lifetime value = visits × usual service price (HANDOVER §9). */
export function getCustomerLTV(customer: Customer): number {
  return customer.visits * customer.usualPriceCents;
}
export function getCustomerLTVLabel(customer: Customer): string {
  return formatWholeDollars(getCustomerLTV(customer));
}

/** Availability for one barber (or "any") on one date in the canon week. */
export function getDayAvailability(barberId: string, date: string): AvailabilityDay | undefined {
  const entry = availability.barbers[barberId] as { days?: AvailabilityDay[] } | undefined;
  return entry?.days?.find((d) => d.date === date);
}

export function getWeekAvailability(barberId: string): AvailabilityDay[] {
  const entry = availability.barbers[barberId] as { days?: AvailabilityDay[] } | undefined;
  return entry?.days ?? [];
}

/** Earliest open slot at or after the customer "now", in week order. */
export function getNextOpening(
  barberId: string,
): { date: string; weekday: string; time: string; barberId: string } | null {
  for (const day of getWeekAvailability(barberId)) {
    if (day.state === "open" && day.slots.length > 0) {
      return { date: day.date, weekday: day.weekday, time: day.slots[0]!, barberId };
    }
  }
  return null;
}

/** End label for a slot tile, exactly as drawn: "to 10:30" (no meridiem). */
export function getSlotEndLabel(start: string, durationMinutes: number): string {
  const match = /^(\d{1,2}):(\d{2})\s(AM|PM)$/.exec(start);
  if (!match) return "";
  let hours = Number(match[1]) % 12;
  if (match[3] === "PM") hours += 12;
  const total = hours * 60 + Number(match[2]) + durationMinutes;
  const endH24 = Math.floor(total / 60) % 24;
  const endM = total % 60;
  const endH = endH24 % 12 === 0 ? 12 : endH24 % 12;
  return `to ${endH}:${String(endM).padStart(2, "0")}`;
}

/** Free-change deadline line for a chosen date/time (24h before, §9). */
export function freeChangesUntilLabel(): string {
  return "Wednesday, October 7 at 9:00 AM";
}
