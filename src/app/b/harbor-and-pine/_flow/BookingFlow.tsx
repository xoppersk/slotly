"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export interface FlowDetails { firstName: string; lastName: string; email: string; mobile: string; note: string; reminder: boolean; }
export interface FlowState {
  serviceId: string; barberId: string; date: string; time: string | null;
  details: FlowDetails; cardLast4: string;
  holdExpiresAt: number | null; holdTime: string | null;
  /** True once the customer has explicitly picked a barber (P-03) — before
      that, P-02's summary draws Barber as "Next step" (SL-07). */
  barberTouched: boolean;
}
const DEFAULTS: FlowState = {
  serviceId: "signature-haircut", barberId: "micah", date: "2026-10-08", time: null,
  details: { firstName: "Avery", lastName: "Lewis", email: "avery.lewis@sevynlabs.io", mobile: "(215) 555-0192", note: "Keeping length on top, tidy the sides.", reminder: true },
  cardLast4: "4242", holdExpiresAt: null, holdTime: null, barberTouched: false,
};
const KEY = "slotly-booking-flow-v1";
interface Ctx extends FlowState {
  setFlow: (p: Partial<FlowState>) => void;
  setDetails: (p: Partial<FlowDetails>) => void;
  startHold: (time: string, seconds?: number) => void;
  /** SL-05: seed the drawn mid-flow narrative (Thu Oct 8, 9:00 AM held,
      9:58 on the clock — the F-01 hero picker's default) when a step at
      Time or later mounts with no hold on record. No-op when a hold
      exists, active OR expired (expired routes to F-08 via the guard). */
  ensureNarrativeHold: () => void;
  secondsLeft: number | null;
  /** False until the sessionStorage hydration effect has run. */
  hydrated: boolean;
}
const C = createContext<Ctx | null>(null);
export function useBookingFlow(): Ctx { const v = useContext(C); if (!v) throw new Error("BookingProvider missing"); return v; }

export function BookingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FlowState>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { try { const raw = sessionStorage.getItem(KEY); if (raw) setState({ ...DEFAULTS, ...JSON.parse(raw) }); } catch {} setHydrated(true); }, []);
  useEffect(() => { if (hydrated) try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch {} }, [state, hydrated]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const setFlow = useCallback((p: Partial<FlowState>) => setState((s) => ({ ...s, ...p })), []);
  const setDetails = useCallback((p: Partial<FlowDetails>) => setState((s) => ({ ...s, details: { ...s.details, ...p } })), []);
  const startHold = useCallback((time: string, seconds = 600) => setState((s) => ({ ...s, time, holdTime: time, holdExpiresAt: Date.now() + seconds * 1000 })), []);
  const ensureNarrativeHold = useCallback(() => {
    setState((s) => {
      if (s.holdExpiresAt !== null || s.holdTime !== null) return s;
      const time = s.time ?? "9:00 AM";
      return { ...s, time, date: s.time ? s.date : "2026-10-08", holdTime: time, holdExpiresAt: Date.now() + 598_000 };
    });
  }, []);
  const secondsLeft = state.holdExpiresAt ? Math.max(0, Math.round((state.holdExpiresAt - now) / 1000)) : null;
  const value = useMemo(() => ({ ...state, setFlow, setDetails, startHold, ensureNarrativeHold, secondsLeft, hydrated }), [state, setFlow, setDetails, startHold, ensureNarrativeHold, secondsLeft, hydrated]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

/** Shared query-string builder: selections travel in the URL (§10). */
export function flowQuery(s: { serviceId?: string; barberId?: string; date?: string; time?: string | null }): string {
  const p = new URLSearchParams();
  if (s.serviceId) p.set("service", s.serviceId);
  if (s.barberId) p.set("barber", s.barberId);
  if (s.date) p.set("date", s.date);
  if (s.time) p.set("time", s.time);
  const q = p.toString(); return q ? `?${q}` : "";
}
export const BASE = "/b/harbor-and-pine";
export function stepHrefs(flow: { serviceId: string; barberId: string; date: string; time: string | null }): string[] {
  const q = flowQuery(flow);
  return [`${BASE}/book/service${q}`, `${BASE}/book/barber${q}`, `${BASE}/book/time${q}`, `${BASE}/book/details${q}`, `${BASE}/book/deposit${q}`, `${BASE}/book/review${q}`];
}
export const POLICY_LINE = "Free to cancel or move until Wednesday, October 7 at 9:00 AM. After that the deposit is kept. No account needed.";
export function downloadICS() {
  const ics = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Slotly//Harbor and Pine//EN","BEGIN:VEVENT","UID:SLY-2026-1008-091@slotly.app","DTSTAMP:20261006T140000Z","DTSTART:20261008T130000Z","DTEND:20261008T134500Z","SUMMARY:Signature haircut with Micah — Harbor & Pine Barbershop","LOCATION:214 Fairmount Ave\\, Philadelphia\\, PA 19123","DESCRIPTION:Booking SLY-2026-1008-091. $20.00 deposit paid; $28.00 at the shop.","END:VEVENT","END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a"); a.href = url; a.download = "harbor-and-pine-booking.ics"; a.click(); URL.revokeObjectURL(url);
}
export function useHoldExpiryRedirect(active: boolean) {
  const flow = useBookingFlow(); const fired = useRef(false);
  useEffect(() => { if (active && flow.secondsLeft === 0 && !fired.current) { fired.current = true; window.location.href = `${BASE}/book/time?state=conflict`; } }, [active, flow.secondsLeft]);
  return flow;
}
