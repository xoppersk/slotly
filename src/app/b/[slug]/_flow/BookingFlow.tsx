"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { formatInTimeZone } from "date-fns-tz";
import { useRouter } from "next/navigation";

import {
  todayInTz,
  type PublicCatalogData,
  type PublicService,
  type PublicStaff,
} from "../_lib/types";

export interface FlowDetails {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  note: string;
  reminder: boolean;
}

export interface FlowState {
  serviceId: string;
  /** Staff uuid, or "any" for first-available. */
  barberId: string;
  /** Business-local YYYY-MM-DD of the chosen slot. */
  date: string;
  /** ISO instants of the chosen slot (null until a time is picked). */
  startsAt: string | null;
  endsAt: string | null;
  /** Concrete staff for the chosen slot when barberId === "any". */
  slotStaffId: string | null;
  details: FlowDetails;
  /** Client-side soft hold (UI countdown only — the real booking is only
      created by create_booking at Review; policy 'none' confirms instantly
      and holds no row). */
  holdExpiresAt: number | null;
  holdTime: string | null;
  /** True once the customer has explicitly picked a barber (step 2). */
  barberTouched: boolean;
}

const EMPTY_DETAILS: FlowDetails = {
  firstName: "",
  lastName: "",
  email: "",
  mobile: "",
  note: "",
  reminder: true,
};

interface Ctx extends FlowState {
  slug: string;
  /** "/b/<slug>" — every internal link is built from the REAL slug. */
  base: string;
  catalog: PublicCatalogData;
  service: PublicService | undefined;
  barber: PublicStaff | undefined;
  /** "9:00 AM" label for the chosen slot, business timezone. */
  timeLabel: string | null;
  setFlow: (p: Partial<FlowState>) => void;
  setDetails: (p: Partial<FlowDetails>) => void;
  /** Pick a slot: records the instants + starts the 10-minute soft hold. */
  pickSlot: (slot: {
    startsAt: string;
    endsAt: string;
    staffId: string;
    label: string;
    date: string;
  }) => void;
  clearSelection: () => void;
  secondsLeft: number | null;
  /** False until the sessionStorage hydration effect has run. */
  hydrated: boolean;
}

const C = createContext<Ctx | null>(null);
export function useBookingFlow(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error("BookingProvider missing");
  return v;
}

export function BookingProvider({
  slug,
  catalog,
  children,
}: {
  slug: string;
  catalog: PublicCatalogData;
  children: ReactNode;
}) {
  const tz = catalog.business.timezone;
  const storageKey = `slotly-booking-flow-v2:${slug}`;
  const defaults = useMemo<FlowState>(
    () => ({
      serviceId: catalog.services[0]?.id ?? "",
      barberId: "any",
      date: todayInTz(tz),
      startsAt: null,
      endsAt: null,
      slotStaffId: null,
      details: EMPTY_DETAILS,
      holdExpiresAt: null,
      holdTime: null,
      barberTouched: false,
    }),
    [catalog.services, tz],
  );
  const [state, setState] = useState<FlowState>(defaults);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Hydration syncs state FROM an external system (sessionStorage) — the
  // one-way read on mount is deliberate; SSR renders the defaults.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FlowState>;
        // Only restore selections that still exist in the live catalog.
        const serviceOk = parsed.serviceId
          ? catalog.services.some((s) => s.id === parsed.serviceId)
          : false;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-way sessionStorage hydration (see above)
        setState({
          ...defaults,
          ...parsed,
          serviceId: serviceOk ? parsed.serviceId! : defaults.serviceId,
          details: { ...EMPTY_DETAILS, ...(parsed.details ?? {}) },
        });
      }
    } catch {}
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (hydrated) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(state));
      } catch {}
    }
  }, [state, hydrated, storageKey]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const setFlow = useCallback(
    (p: Partial<FlowState>) => setState((s) => ({ ...s, ...p })),
    [],
  );
  const setDetails = useCallback(
    (p: Partial<FlowDetails>) =>
      setState((s) => ({ ...s, details: { ...s.details, ...p } })),
    [],
  );
  const pickSlot = useCallback(
    (slot: {
      startsAt: string;
      endsAt: string;
      staffId: string;
      label: string;
      date: string;
    }) =>
      setState((s) => ({
        ...s,
        date: slot.date,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        slotStaffId: slot.staffId,
        holdTime: slot.label,
        holdExpiresAt: Date.now() + 600_000,
      })),
    [],
  );
  const clearSelection = useCallback(
    () =>
      setState((s) => ({
        ...s,
        startsAt: null,
        endsAt: null,
        slotStaffId: null,
        holdTime: null,
        holdExpiresAt: null,
      })),
    [],
  );

  const secondsLeft = state.holdExpiresAt
    ? Math.max(0, Math.round((state.holdExpiresAt - now) / 1000))
    : null;
  const service = catalog.services.find((s) => s.id === state.serviceId);
  const barber =
    state.barberId === "any"
      ? undefined
      : catalog.staff.find((s) => s.id === state.barberId);
  const timeLabel = state.startsAt
    ? formatInTimeZone(new Date(state.startsAt), tz, "h:mm a")
    : null;

  const value = useMemo<Ctx>(
    () => ({
      ...state,
      slug,
      base: `/b/${slug}`,
      catalog,
      service,
      barber,
      timeLabel,
      setFlow,
      setDetails,
      pickSlot,
      clearSelection,
      secondsLeft,
      hydrated,
    }),
    [
      state,
      slug,
      catalog,
      service,
      barber,
      timeLabel,
      setFlow,
      setDetails,
      pickSlot,
      clearSelection,
      secondsLeft,
      hydrated,
    ],
  );
  return <C.Provider value={value}>{children}</C.Provider>;
}

/** Shared query-string builder: selections travel in the URL (§10). */
export function flowQuery(s: {
  serviceId?: string;
  barberId?: string;
  date?: string;
  startsAt?: string | null;
}): string {
  const p = new URLSearchParams();
  if (s.serviceId) p.set("service", s.serviceId);
  if (s.barberId) p.set("barber", s.barberId);
  if (s.date) p.set("date", s.date);
  if (s.startsAt) p.set("startsAt", s.startsAt);
  const q = p.toString();
  return q ? `?${q}` : "";
}

export function stepHrefs(
  base: string,
  flow: { serviceId: string; barberId: string; date: string; startsAt: string | null },
): string[] {
  const q = flowQuery(flow);
  return [
    `${base}/book/service${q}`,
    `${base}/book/barber${q}`,
    `${base}/book/time${q}`,
    `${base}/book/details${q}`,
    `${base}/book/deposit${q}`,
    `${base}/book/review${q}`,
  ];
}

/** Build a real .ics for a confirmed booking (booked/manage pages). */
export function downloadICSFor(booking: {
  businessName: string;
  serviceName: string;
  staffName: string | null;
  startsAt: string;
  endsAt: string;
  address: string | null;
  bookingId: string;
  slug: string;
}) {
  const stamp = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/,/g, "\\,");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//Slotly//${booking.businessName}//EN`,
    "BEGIN:VEVENT",
    `UID:${booking.bookingId}@slotly.app`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(booking.startsAt)}`,
    `DTEND:${stamp(booking.endsAt)}`,
    `SUMMARY:${esc(`${booking.serviceName}${booking.staffName ? ` with ${booking.staffName}` : ""} — ${booking.businessName}`)}`,
    ...(booking.address ? [`LOCATION:${esc(booking.address)}`] : []),
    `DESCRIPTION:Booking ${booking.bookingId}.`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([lines], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${booking.slug}-booking.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * When the client-side soft hold runs out mid-flow, route to the Time
 * step's real F-08 conflict state. No-op without an active hold.
 */
export function useHoldExpiryRedirect(active: boolean) {
  const flow = useBookingFlow();
  const router = useRouter();
  const fired = useRef(false);
  useEffect(() => {
    if (active && flow.secondsLeft === 0 && flow.holdTime && !fired.current) {
      fired.current = true;
      router.push(
        `${flow.base}/book/time?conflict=1${flowQuery(flow).replace("?", "&")}`,
      );
    }
  }, [active, flow, router]);
  return flow;
}
