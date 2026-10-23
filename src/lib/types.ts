    /* Slotly v2 — shared types for the fixture data layer (HANDOVER §9). */

export type BookingStatus =
  | "Done"
  | "In the chair"
  | "Arrived"
  | "Upcoming"
  | "Confirmed"
  /* Production additions (2026-10-22): real DB states the drawn set lacked.
     DB mapping: cancelled → "Cancelled", no_show → "No-show",
     pending/payment_pending/payment_failed → "Pending". */
  | "Cancelled"
  | "No-show"
  | "Pending";

export type PillStatus =
  | BookingStatus
  | "Working"
  | "Away"
  | "Invite sent"
  | "Not booked yet"
  | "Approved"
  | "Taken";

export interface BusinessHours {
  days: string;
  weekdays: number[];
  open: string;
  close: string;
  open24: string;
  close24: string;
}

export interface Business {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  mark: string;
  tagline: string;
  area: string;
  address: { street: string; city: string; state: string; zip: string; line: string; full: string };
  phone: string;
  bookingUrl: string;
  timezone: string;
  timezoneLabel: string;
  hours: BusinessHours[];
  hoursSummary: string;
  policy: {
    depositCents: number;
    depositLabel: string;
    freeChangeHoursBefore: number;
    freeChangeLine: string;
    slotStepMinutes: number;
    minLeadHours: number;
    maxAdvanceDays: number;
  };
  footerLine: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
  depositCents: number;
  offeredBy: string[];
  bufferAfterMinutes: number;
  online: boolean;
}

export interface Person {
  id: string;
  name: string;
  initial?: string;
  initials?: string;
  role: "owner" | "barber";
  roleLabel: string;
  email: string;
  bookable: boolean;
  status: string;
  bio?: string;
  blurb?: string;
  serviceIds: string[];
  workDays?: number[];
  workLabel?: string;
  open24?: string;
  close24?: string;
  break?: { start: string; end: string; start24: string; end24: string } | null;
  away?: { from: string; to: string; label: string; backLabel: string; nextOpening: string };
  todayBookings?: number | null;
  nextOpening?: string | null;
  nextOpeningToday?: string | null;
}

export interface PendingInvite {
  email: string;
  initial: string;
  roleLabel: string;
  sentOn: string;
  sentLabel: string;
  status: string;
  invitedBy: string;
}

export interface PeopleFile {
  owner: Person;
  barbers: Person[];
  pendingInvites: PendingInvite[];
  permissionsSummary: string;
}

export interface Booking {
  id: string;
  code: string;
  date: string;
  start: string;
  end: string;
  start24: string;
  end24: string;
  customer: string;
  customerEmail: string;
  customerPhone?: string;
  prefersText?: boolean;
  serviceId: string;
  service: string;
  priceCents: number;
  barberId: string;
  barber: string;
  status: BookingStatus;
  depositCents: number;
  depositStatus: "paid" | "due";
  balanceCents: number;
  note?: string;
  cardLabel?: string;
  freeChangesUntil?: string;
  visitNumber?: number;
  lastVisitLabel?: string;
  noShows?: number;
  reschedules?: number;
  bookedAtLabel?: string;
  reminderLabel?: string;
  overrunMinutes?: number;
  overrunLabel?: string;
}

export interface Customer {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone?: string;
  visits: number;
  usualServiceId: string;
  usualService: string;
  usualPriceCents: number;
  usualBarberId: string;
  usualBarber: string;
  nextOrLastVisit: string;
  nextVisitDate: string;
  isNew: boolean;
  noShows?: number;
  reschedules?: number;
  lastVisitLabel?: string;
}

export type DayState = "past" | "open" | "full" | "away" | "closed";

export interface AvailabilityDay {
  date: string;
  weekday: string;
  dayNumber: number;
  state: DayState;
  openCount: number;
  slots: string[];
  bookedBlocks?: string[];
  generated?: boolean;
}

export interface AvailabilityFile {
  weekStart: string;
  weekLabel: string;
  serviceId: string;
  totalSlotsPerDay: number;
  note: string;
  barbers: Record<string, { days: AvailabilityDay[] } & Record<string, unknown>>;
  fullyBooked: {
    date: string;
    barberId: string;
    nextOpening: { date: string; time: string; label: string; barberId: string; barber: string };
    sameDayOtherBarber: { barberId: string; barber: string; openCount: number };
    waitlistAhead: number;
    waitlistLine: string;
  };
}

export interface TimeOffRequest {
  id: string;
  barberId: string;
  barber: string;
  label: string;
  kind: string;
  from: string;
  fromTime?: string;
  to?: string;
  status: string;
  approvedByLabel?: string;
  affectedBookings?: { customer: string; when: string }[];
  affectedLine?: string;
}

export interface TimeOffFile {
  requests: TimeOffRequest[];
  closures: { id: string; label: string; date: string }[];
  away: { barberId: string; barber: string; from: string; to: string; label: string; backLabel: string }[];
}

export interface DashboardFile {
  date: string;
  dateLabel: string;
  nowLabel: string;
  kpis: {
    bookingsToday: number;
    done: number;
    inChair: number;
    waiting: number;
    todayBookedMinutes: number;
    todayBookableMinutes: number;
    todayPercent: number;
    lastWeekBookedMinutes: number;
    lastWeekBookableMinutes: number;
    lastWeekPercent: number;
    lastWeekRangeLabel: string;
    lastWeekDaily: { day: string; bookedMinutes: number; bookableMinutes: number; percent: number }[];
    lastWeekNote: string;
    nextOpening: { time: string; barberId: string; barber: string; label: string };
    nextOpeningByBarber: { barberId: string; barber: string; time: string }[];
  };
  needsYou: { id: string; title: string; detail: string; actionLabel?: string }[];
}
