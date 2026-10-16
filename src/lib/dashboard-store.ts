/* Shared persistence for dashboard bookings (SL-04).
   DashboardProvider (src/app/app/DashboardContext.tsx) and the staff
   agenda (src/app/staff/page.tsx) live in separate trees with separate
   providers, so localStorage is the bridge: dashboard changes are saved
   here and the staff agenda reads them on mount. Initial renders always
   use the fixture seed; stored state is applied in an effect to avoid
   hydration mismatches (same pattern as the booking flow provider). */
import type { Booking } from "./types";

const KEY = "slotly-dashboard-bookings-v1";

export function loadStoredBookings(): Booking[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as Booking[];
  } catch {
    return null;
  }
}

export function saveStoredBookings(list: Booking[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable (private mode / quota) — dashboard still
    // works in-session via the provider; persistence is best-effort.
  }
}
