"use client";
/* Dashboard-level client state (HANDOVER §10): run-sheet statuses are
   seeded from the shared bookings fixture and advanced in place, so
   Today, Bookings and Calendar agree within the session. Bookings made
   on a customer's behalf are appended here too. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { bookings as seedBookings } from "@/lib/api";
import { loadStoredBookings, saveStoredBookings } from "@/lib/dashboard-store";
import type { Booking, BookingStatus } from "@/lib/types";

const NEXT: Partial<Record<BookingStatus, BookingStatus>> = {
  Upcoming: "Arrived",
  Confirmed: "Arrived",
  Arrived: "In the chair",
  "In the chair": "Done",
};

interface DashboardState {
  bookings: Booking[];
  advance: (id: string) => void;
  setStatus: (id: string, status: BookingStatus) => void;
  addBooking: (booking: Booking) => void;
  removeBooking: (id: string) => void;
}

const Ctx = createContext<DashboardState | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [bookings, setBookings] = useState<Booking[]>(() => seedBookings.map((b) => ({ ...b })));
  const [hydrated, setHydrated] = useState(false);

  // Hydration (SL-04): initial render is the fixture seed; stored
  // bookings are applied once after mount so full reloads keep changes
  // and the staff agenda can read the same stored list. Do NOT read
  // localStorage in the state initializer (hydration mismatch).
  useEffect(() => {
    const stored = loadStoredBookings();
    if (stored) setBookings(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveStoredBookings(bookings);
  }, [bookings, hydrated]);

  const setStatus = useCallback((id: string, status: BookingStatus) => {
    setBookings((list) => list.map((b) => (b.id === id ? { ...b, status } : b)));
  }, []);

  const advance = useCallback((id: string) => {
    setBookings((list) =>
      list.map((b) => {
        if (b.id !== id) return b;
        const next = NEXT[b.status];
        return next ? { ...b, status: next } : b;
      }),
    );
  }, []);

  const addBooking = useCallback((booking: Booking) => {
    setBookings((list) => [...list, booking].sort((a, b) => a.start24.localeCompare(b.start24)));
  }, []);

  const removeBooking = useCallback((id: string) => {
    setBookings((list) => list.filter((b) => b.id !== id));
  }, []);

  const value = useMemo(
    () => ({ bookings, advance, setStatus, addBooking, removeBooking }),
    [bookings, advance, setStatus, addBooking, removeBooking],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboard(): DashboardState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDashboard must be used inside DashboardProvider");
  return ctx;
}

/** Up-next ordering (HANDOVER §2.4): person in the chair on top, then
    waiting, then upcoming by time. Done rows drop off the run sheet. */
export function upNext(list: Booking[]): Booking[] {
  const rank: Record<string, number> = { "In the chair": 0, Arrived: 1, Upcoming: 2, Confirmed: 2 };
  return list
    .filter((b) => b.status !== "Done")
    .sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || a.start24.localeCompare(b.start24));
}
