import type {
  BusinessPublicRow,
  ServicePublicRow,
  StaffPublicRow,
} from "@/lib/supabase/types";

/**
 * demo-data.ts — the Slotly "truth ledger".
 *
 * Hardcoded demo content for the Flagship UI Designs (Slotly) entities:
 * the Harbor & Pine Barbershop business, its services, staff, customers,
 * and the canonical booking (Avery Lewis · Signature haircut · Micah ·
 * Thursday, October 8, 2026 · 9:00 AM · Confirmed).
 *
 * RULE: this data is a presentation-layer FALLBACK ONLY. It is rendered
 * solely when the app has no live data for a view (e.g. the public demo
 * business slug with no database row). A working live query is never
 * replaced by this module — if the query returns rows, the rows win.
 *
 * Values are reconciled 1:1 with the design artifact (Flows → truth
 * ledger, Signature UI, and the deep screens: Today, Calendar, Services,
 * Confirmation, and the three designed states).
 */

export const DEMO_SLUG = "harbor-and-pine";
export const DEMO_BUSINESS_ID = "a1b2c3d4-0000-4000-8000-000000000001";
export const DEMO_BOOKING_REF = "SLY-2026-1008-091";

/* ------------------------------------------------------------------ */
/* Business                                                            */
/* ------------------------------------------------------------------ */

export interface DemoBusiness {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  description: string;
  timezone: string;
  phone: string;
  email: string;
  address: string;
  accent_color: string;
  logo_url: string | null;
  cover_url: string | null;
}

export const demoBusiness: DemoBusiness = {
  id: DEMO_BUSINESS_ID,
  name: "Harbor & Pine Barbershop",
  shortName: "Harbor & Pine",
  slug: DEMO_SLUG,
  description:
    "Classic cuts, hot-towel shaves, and honest conversation since 2016. Walk-ins welcome, bookings preferred.",
  timezone: "America/New_York",
  phone: "+1 (215) 555-0147",
  email: "book@harborandpine.example",
  address: "1842 Pine Street, Philadelphia, PA 19147",
  accent_color: "teal",
  logo_url: null,
  cover_url: null,
};

/* ------------------------------------------------------------------ */
/* Services                                                            */
/* ------------------------------------------------------------------ */

export interface DemoService {
  id: string;
  name: string;
  description: string;
  category: string;
  duration_minutes: number;
  price_cents: number;
  payment_policy: "none" | "deposit" | "full";
  deposit_cents: number;
  bookings_count: number;
  sort_order: number;
}

export const demoServices: DemoService[] = [
  {
    id: "d10e5f4a-0000-4000-8000-000000000011",
    name: "Signature haircut",
    description:
      "Consultation, precision cut, hot-lather neck shave, and style. Our most-booked service.",
    category: "Cut",
    duration_minutes: 45,
    price_cents: 4800,
    payment_policy: "none",
    deposit_cents: 0,
    bookings_count: 126,
    sort_order: 1,
  },
  {
    id: "d10e5f4a-0000-4000-8000-000000000012",
    name: "Beard trim",
    description: "Shape, line-up, and conditioning with hot towel finish.",
    category: "Groom",
    duration_minutes: 25,
    price_cents: 2800,
    payment_policy: "none",
    deposit_cents: 0,
    bookings_count: 84,
    sort_order: 2,
  },
  {
    id: "d10e5f4a-0000-4000-8000-000000000013",
    name: "Cut + beard",
    description: "The full works — signature haircut plus a detailed beard trim.",
    category: "Package",
    duration_minutes: 60,
    price_cents: 6800,
    payment_policy: "none",
    deposit_cents: 0,
    bookings_count: 72,
    sort_order: 3,
  },
  {
    id: "d10e5f4a-0000-4000-8000-000000000014",
    name: "Kids haircut",
    description: "Patient, friendly cuts for young gentlemen (12 and under).",
    category: "Cut",
    duration_minutes: 35,
    price_cents: 3600,
    payment_policy: "none",
    deposit_cents: 0,
    bookings_count: 41,
    sort_order: 4,
  },
  {
    id: "d10e5f4a-0000-4000-8000-000000000015",
    name: "Hot towel shave",
    description: "Traditional straight-razor shave with hot towels and oils.",
    category: "Groom",
    duration_minutes: 40,
    price_cents: 4400,
    payment_policy: "deposit",
    deposit_cents: 2000,
    bookings_count: 29,
    sort_order: 5,
  },
  {
    id: "d10e5f4a-0000-4000-8000-000000000016",
    name: "Full service",
    description: "Cut, shave, facial, and style — ninety unhurried minutes.",
    category: "Package",
    duration_minutes: 90,
    price_cents: 9600,
    payment_policy: "full",
    deposit_cents: 0,
    bookings_count: 18,
    sort_order: 6,
  },
];

/* ------------------------------------------------------------------ */
/* Staff                                                               */
/* ------------------------------------------------------------------ */

export interface DemoStaffMember {
  id: string;
  name: string;
  title: string;
  specialties: string[];
  services_count: number;
  next_available: string;
  status: "active" | "away";
  photo_url: string | null;
}

export const demoStaff: DemoStaffMember[] = [
  {
    id: "d20e5f4a-0000-4000-8000-000000000021",
    name: "Micah",
    title: "Master barber",
    specialties: ["Signature haircut", "Cut + beard"],
    services_count: 5,
    next_available: "Next 2:15 PM",
    status: "active",
    photo_url: null,
  },
  {
    id: "d20e5f4a-0000-4000-8000-000000000022",
    name: "Nia",
    title: "Barber",
    specialties: ["Beard trim", "Hot towel shave"],
    services_count: 4,
    next_available: "Next October 7, 2026",
    status: "active",
    photo_url: null,
  },
  {
    id: "d20e5f4a-0000-4000-8000-000000000023",
    name: "Andre",
    title: "Barber",
    specialties: ["Kids haircut", "Full service"],
    services_count: 3,
    next_available: "Away",
    status: "away",
    photo_url: null,
  },
];

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

export interface DemoCustomer {
  name: string;
  visits: string;
  last_visit: string;
}

export const demoCustomers: DemoCustomer[] = [
  { name: "Avery Lewis", visits: "8 visits", last_visit: "October 6, 2026" },
  { name: "Morgan Reed", visits: "4 visits", last_visit: "October 6, 2026" },
  { name: "Jordan Bell", visits: "First visit", last_visit: "October 6, 2026" },
];

/* ------------------------------------------------------------------ */
/* The canonical booking (truth ledger)                                */
/* ------------------------------------------------------------------ */

export interface DemoBooking {
  ref: string;
  customer: string;
  service: string;
  serviceDurationMin: number;
  staff: string;
  /** Business-local date key. */
  dateKey: string;
  /** Business-local display. */
  dateLabel: string;
  /** Business-local display. */
  timeLabel: string;
  /** ISO-8601 UTC instant. */
  startsAtUtc: string;
  priceCents: number;
  status: "Confirmed";
}

export const demoBooking: DemoBooking = {
  ref: DEMO_BOOKING_REF,
  customer: "Avery Lewis",
  service: "Signature haircut",
  serviceDurationMin: 45,
  staff: "Micah",
  dateKey: "2026-10-08",
  dateLabel: "Thursday, October 8, 2026",
  timeLabel: "9:00 AM",
  // 9:00 AM America/New_York (EDT, UTC-4) on 2026-10-08.
  startsAtUtc: "2026-10-08T13:00:00.000Z",
  priceCents: 4800,
  status: "Confirmed",
};

/* ------------------------------------------------------------------ */
/* Today agenda (dashboard deep screen)                                */
/* ------------------------------------------------------------------ */

export interface DemoAppointment {
  time: string;
  customer: string;
  detail: string;
  status: "confirmed" | "arrived" | "unconfirmed";
  durationMin: number;
}

export const demoTodayAppointments: DemoAppointment[] = [
  { time: "9:00 AM", customer: "Avery Lewis", detail: "Signature haircut · Micah · $48", status: "confirmed", durationMin: 45 },
  { time: "10:15 AM", customer: "Morgan Reed", detail: "Beard trim · Nia · $28", status: "arrived", durationMin: 25 },
  { time: "11:00 AM", customer: "Leah Kim", detail: "Kids haircut · Andre · $36", status: "confirmed", durationMin: 35 },
  { time: "12:00 PM", customer: "Jordan Bell", detail: "Signature haircut · Micah · $48", status: "unconfirmed", durationMin: 45 },
  { time: "1:15 PM", customer: "Elena Park", detail: "Cut + beard · Andre · $68", status: "confirmed", durationMin: 60 },
  { time: "2:30 PM", customer: "Priya Shah", detail: "Hot towel shave · Nia · $44", status: "confirmed", durationMin: 40 },
  { time: "3:30 PM", customer: "Noah Williams", detail: "Signature haircut · Nia · $48", status: "unconfirmed", durationMin: 45 },
  { time: "4:30 PM", customer: "Owen Clarke", detail: "Full service · Micah · $96", status: "confirmed", durationMin: 90 },
];

/** Minutes booked / available per day, Mon–Sun (design artifact chart). */
export const demoUtilization: { label: string; booked: number; available: number }[] = [
  { label: "Mon", booked: 240, available: 420 },
  { label: "Tue", booked: 300, available: 420 },
  { label: "Wed", booked: 210, available: 420 },
  { label: "Thu", booked: 385, available: 420 },
  { label: "Fri", booked: 300, available: 420 },
  { label: "Sat", booked: 300, available: 420 },
  { label: "Sun", booked: 125, available: 420 },
];

/* ------------------------------------------------------------------ */
/* Week calendar board (dashboard deep screen)                         */
/* ------------------------------------------------------------------ */

export interface DemoWeekEvent {
  time: string;
  title: string;
  status: "confirmed" | "unconfirmed";
}

export interface DemoWeekDay {
  weekday: string;
  dayNum: string;
  isToday: boolean;
  events: DemoWeekEvent[];
}

export const demoWeekBoard: DemoWeekDay[] = [
  {
    weekday: "Mon", dayNum: "Oct 5", isToday: false,
    events: [
      { time: "9:00 AM", title: "Leah Kim · Signature haircut · Nia · $48", status: "confirmed" },
      { time: "1:30 PM", title: "Elena · Cut + beard", status: "confirmed" },
    ],
  },
  {
    weekday: "Tue", dayNum: "Oct 6", isToday: true,
    events: [
      { time: "9:00 AM", title: "Morgan · Beard trim", status: "confirmed" },
      { time: "12:45 PM", title: "Jordan · Haircut", status: "unconfirmed" },
      { time: "4:30 PM", title: "Noah · Haircut", status: "unconfirmed" },
    ],
  },
  {
    weekday: "Wed", dayNum: "Oct 7", isToday: false,
    events: [
      { time: "10:30 AM", title: "Leah · Haircut", status: "confirmed" },
      { time: "3:00 PM", title: "Avery · Groom", status: "confirmed" },
    ],
  },
  {
    weekday: "Thu", dayNum: "Oct 8", isToday: false,
    events: [
      { time: "9:00 AM", title: "Avery Lewis · Signature haircut · Micah · $48", status: "confirmed" },
      { time: "2:15 PM", title: "Micah · Cut + beard", status: "confirmed" },
    ],
  },
  {
    weekday: "Fri", dayNum: "Oct 9", isToday: false,
    events: [
      { time: "11:15 AM", title: "Priya · Haircut", status: "confirmed" },
      { time: "3:45 PM", title: "Owen · Groom", status: "unconfirmed" },
    ],
  },
  {
    weekday: "Sat", dayNum: "Oct 10", isToday: false,
    events: [
      { time: "9:45 AM", title: "Nia · Haircut", status: "confirmed" },
      { time: "1:30 PM", title: "Andre · Cut + beard", status: "confirmed" },
    ],
  },
  { weekday: "Sun", dayNum: "Oct 11", isToday: false, events: [] },
];

/* ------------------------------------------------------------------ */
/* Public-view rows for the demo business                              */
/* ------------------------------------------------------------------ */

/**
 * Demo business data shaped exactly like the `businesses_public`,
 * `services_public`, and `staff_public` view rows, for the public pages
 * ([slug], [slug]/book) when the demo slug has no live database row.
 */
export function demoPublicData(): {
  business: BusinessPublicRow;
  services: ServicePublicRow[];
  staff: StaffPublicRow[];
} {
  const business: BusinessPublicRow = {
    id: demoBusiness.id,
    name: demoBusiness.name,
    slug: demoBusiness.slug,
    description: demoBusiness.description,
    logo_url: demoBusiness.logo_url,
    cover_url: demoBusiness.cover_url,
    timezone: demoBusiness.timezone,
    phone: demoBusiness.phone,
    address: demoBusiness.address,
    accent_color: demoBusiness.accent_color,
  };
  const services: ServicePublicRow[] = demoServices.map((s) => ({
    id: s.id,
    business_id: demoBusiness.id,
    name: s.name,
    description: s.description,
    duration_minutes: s.duration_minutes,
    price_cents: s.price_cents,
    price_display: null,
    payment_policy: s.payment_policy,
    deposit_cents: s.deposit_cents,
    color: "teal",
    sort_order: s.sort_order,
  }));
  const staff: StaffPublicRow[] = demoStaff.map((m) => ({
    id: m.id,
    business_id: demoBusiness.id,
    name: m.name,
    title: m.title,
    bio: "",
    photo_url: m.photo_url,
    specialties: m.specialties,
  }));
  return { business, services, staff };
}

/* ------------------------------------------------------------------ */
/* Synthetic availability for the demo business (Signature UI)         */
/* ------------------------------------------------------------------ */

/**
 * The signature prototype's exact slot layout for Thursday, October 8,
 * 2026 (Signature haircut · Micah). Business-local times; `taken` slots
 * render as unavailable pills.
 */
const DEMO_SIGNATURE_DAY = "2026-10-08";
const DEMO_SIGNATURE_SLOTS: { time: string; taken: boolean }[] = [
  { time: "09:00", taken: false },
  { time: "09:45", taken: false },
  { time: "10:30", taken: true },
  { time: "11:15", taken: false },
  { time: "12:45", taken: false },
  { time: "13:30", taken: false },
  { time: "14:15", taken: false },
  { time: "15:45", taken: false },
  { time: "16:30", taken: true },
  { time: "17:15", taken: false },
];

/** Business hours: Tue–Sat 09:00–20:00, Sun/Mon closed (matches the seed). */
function demoDayOpen(dateKey: string): boolean {
  const d = new Date(`${dateKey}T12:00:00Z`);
  const dow = d.getUTCDay(); // 0=Sun … 6=Sat
  return dow >= 2 && dow <= 6;
}

/** Deterministic pseudo-random in [0,1) from a string seed. */
function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

export interface DemoSyntheticSlot {
  startsAt: string;
  endsAt: string;
  staffId: string;
}

/**
 * Build synthetic availability for the demo business between two
 * business-local date keys (inclusive), in the shape the wizard's
 * StepDateTime consumes. Slots are 45 minutes, 9:00 AM–5:15 PM on open
 * days. The signature day (2026-10-08) reproduces the design artifact's
 * exact slot layout; other days get a stable deterministic pattern.
 */
export function demoAvailability(
  fromKey: string,
  toKey: string,
  staffId: string
): { date: string; slots: DemoSyntheticSlot[]; closed: boolean }[] {
  const out: { date: string; slots: DemoSyntheticSlot[]; closed: boolean }[] = [];
  const from = new Date(`${fromKey}T12:00:00Z`);
  const to = new Date(`${toKey}T12:00:00Z`);
  for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    if (!demoDayOpen(key)) {
      out.push({ date: key, slots: [], closed: true });
      continue;
    }
    const times: string[] =
      key === DEMO_SIGNATURE_DAY
        ? DEMO_SIGNATURE_SLOTS.filter((s) => !s.taken).map((s) => s.time)
        : (() => {
            const list: string[] = [];
            for (let h = 9; h <= 17; h++) {
              for (const m of h === 17 ? [15] : [0, 45]) {
                if (h === 9 && m === 45) continue; // keep the grid airy
                const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                // Deterministic "taken" pattern — roughly 1 in 4 slots.
                if (hash01(`${key}|${t}`) < 0.24) continue;
                list.push(t);
              }
            }
            return list;
          })();
    const slots = times.map((t) => {
      const [h, m] = t.split(":").map(Number);
      // Business-local times; America/New_York is UTC-4 (EDT) in this window.
      const [yy = 2026, mm = 10, dd = 8] = key.split("-").map(Number);
      const s = new Date(Date.UTC(yy, mm - 1, dd, (h ?? 0) + 4, m ?? 0, 0));
      const e = new Date(s.getTime() + 45 * 60_000);
      return { startsAt: s.toISOString(), endsAt: e.toISOString(), staffId };
    });
    out.push({ date: key, slots, closed: false });
  }
  return out;
}
