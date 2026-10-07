import type {
  BusinessPublicRow,
  ServicePublicRow,
  StaffPublicRow,
} from "@/lib/supabase/types";
import type { CreateBookingResponse } from "@/lib/booking/public-api";

/** The six logical wizard steps. `payment` is skipped for `none`-policy services. */
export type WizardStepId =
  | "service"
  | "staff"
  | "datetime"
  | "details"
  | "payment"
  | "review";

export interface WizardSlot {
  startsAt: string;
  endsAt: string;
  /** Resolved staff uuid (a concrete person always books the slot). */
  staffId: string;
}

export interface WizardDetails {
  name: string;
  phone: string;
  email: string;
  notes: string;
  reminderOptIn: boolean;
}

export interface WizardPayment {
  bookingId: string;
  manageToken: string;
  holdExpiresAt: string;
  amountDueCents: number;
  amountDueKind: "deposit" | "full_payment";
  clientSecret: string | null;
}

export interface WizardState {
  serviceId: string | null;
  /** Staff uuid, or "any" for first-available. */
  staffId: string | null;
  /** Business-local day key of the selected date, e.g. "2026-10-08". */
  dayKey: string | null;
  slot: WizardSlot | null;
  details: WizardDetails;
  payment: WizardPayment | null;
  /** Set when a booking was created without payment (review-step confirm). */
  confirmedBooking: { bookingId: string; manageToken: string } | null;
  /**
   * Race notice surfaced at the datetime step (slot taken mid-flow, or the
   * payment hold expired). `missedStartsAt` anchors the nearest-alternative
   * computation; null clears the notice.
   */
  slotRaceNotice: { missedStartsAt: string; message: string } | null;
}

export const EMPTY_DETAILS: WizardDetails = {
  name: "",
  phone: "",
  email: "",
  notes: "",
  reminderOptIn: true,
};

export interface WizardContext {
  business: BusinessPublicRow;
  services: ServicePublicRow[];
  staff: StaffPublicRow[];
}

export const INITIAL_STATE: WizardState = {
  serviceId: null,
  staffId: null,
  dayKey: null,
  slot: null,
  details: { ...EMPTY_DETAILS },
  payment: null,
  confirmedBooking: null,
  slotRaceNotice: null,
};

export function createBookingResponseToPayment(
  res: CreateBookingResponse
): WizardPayment | null {
  if (res.status !== "payment_pending" || !res.holdExpiresAt || !res.amountDueKind) {
    return null;
  }
  return {
    bookingId: res.bookingId,
    manageToken: res.manageToken,
    holdExpiresAt: res.holdExpiresAt,
    amountDueCents: res.amountDueCents,
    amountDueKind: res.amountDueKind,
    clientSecret: null,
  };
}

/**
 * ConfirmationSnapshot — the wizard's in-memory booking state, persisted to
 * sessionStorage before navigating to the confirmation page.
 *
 * Why: manage tokens rotate — after payment succeeds, the Stripe webhook
 * mints a FRESH manage token for the confirmation email, so the token the
 * wizard holds may become stale and GET /api/bookings/receipt?token= can
 * return 400/410 post-payment. The confirmation page renders the full
 * success state from this snapshot and treats the receipt fetch as
 * enhancement: a failed post-payment receipt fetch never becomes an error
 * screen. The email link carries the fresh token for later management.
 */
export interface ConfirmationSnapshot {
  bookingId: string;
  /** The wizard's (possibly stale) manage token. */
  manageToken: string | null;
  serviceName: string;
  durationMinutes: number;
  priceCents: number;
  staffName: string | null;
  startsAt: string;
  endsAt: string;
  customerName: string;
  /** Cents charged online (0 for none-policy services). */
  amountPaidCents: number;
  /** Cents still due at the appointment. */
  amountDueLaterCents: number;
  businessName: string;
  businessTimezone: string;
  businessAddress: string | null;
  businessPhone: string | null;
}

const SNAP_KEY = (bookingId: string) => `slotly:confirmation:${bookingId}`;

export function saveConfirmationSnapshot(snap: ConfirmationSnapshot): void {
  try {
    sessionStorage.setItem(SNAP_KEY(snap.bookingId), JSON.stringify(snap));
  } catch {
    // Storage unavailable (private mode etc.) — the receipt fetch remains
    // the fallback path.
  }
}

export function loadConfirmationSnapshot(
  bookingId: string
): ConfirmationSnapshot | null {
  try {
    const raw = sessionStorage.getItem(SNAP_KEY(bookingId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConfirmationSnapshot;
    return parsed && parsed.bookingId === bookingId ? parsed : null;
  } catch {
    return null;
  }
}
