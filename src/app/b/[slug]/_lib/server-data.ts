/**
 * Server-side data for the public booking flow (/b/[slug] + /api/public).
 *
 * Everything reads/writes through W1's data layer (`@/lib/db/*`), which is
 * the PostgreSQL public views + the SECURITY DEFINER RPCs from migration
 * 00010 — anon can never touch the base tables (Row Level Security).
 *
 * The `get_availability` RPC returns the slot engine's RAW inputs (rules,
 * overrides, blackouts, approved time off, blocking bookings — see
 * PROD-W3.md for the full shape), not computed slots. This module maps that
 * payload into per-staff engine inputs (ported v1 mapper, adapted: the RPC
 * payload carries no per-row status — time_off is approved-only and
 * bookings are blocking-only by construction) and generates the grid.
 */
import { cache } from "react";
import { formatInTimeZone } from "date-fns-tz";

import { getAvailability, type Availability } from "@/lib/db/availability";
import {
  getBookingReceipt,
  type BookingReceipt,
} from "@/lib/db/bookings";
import { getPublicBusiness, getPublicCatalog } from "@/lib/db/public";

import { generateDayRange, resolveWindow } from "./engine";
import type {
  DayAvailability,
  DateOverride,
  SlotInput,
  WeeklyRule,
} from "./engine-types";
import {
  addDaysYmd,
  todayInTz,
  type ApiDay,
  type AvailabilityResponseData,
  type PublicCatalogData,
} from "./types";

/* ------------------------------------------------------------------ */
/* Catalog (business + services + staff + policy)                      */
/* ------------------------------------------------------------------ */

export const loadPublicCatalog = cache(
  async (slug: string): Promise<PublicCatalogData | null> => {
    const business = await getPublicBusiness(slug);
    if (!business) return null;
    const catalog = await getPublicCatalog(business.id);

    // Policy numbers (free-cancel window, lead time, advance window, slot
    // step) are NOT on the public views — they ride in get_availability's
    // business block. Fetch once for the first service as enrichment.
    let policy: PublicCatalogData["policy"] = null;
    const firstService = catalog.services[0];
    if (firstService) {
      try {
        const today = todayInTz(business.timezone);
        const avail = await getAvailability(null, {
          businessId: business.id,
          serviceId: firstService.id,
          from: today,
          to: today,
        });
        policy = {
          slotStepMinutes: avail.business.slot_step_minutes,
          minLeadTimeMinutes: avail.business.min_lead_time_minutes,
          maxAdvanceDays: avail.business.max_advance_days,
          freeCancelHours: avail.business.free_cancel_hours,
        };
      } catch {
        policy = null;
      }
    }

    return {
      business: {
        id: business.id,
        slug: business.slug,
        name: business.name,
        description: business.description,
        timezone: business.timezone,
        phone: business.phone,
        address: business.address,
        accentColor: business.accent_color,
      },
      services: catalog.services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        durationMinutes: s.duration_minutes,
        priceCents: s.price_cents,
        paymentPolicy: s.payment_policy,
        depositCents: s.deposit_cents,
      })),
      staff: catalog.staff.map((s) => ({
        id: s.id,
        name: s.name,
        title: s.title,
        bio: s.bio,
        photoUrl: s.photo_url,
        specialties: s.specialties ?? [],
        initial: (s.name.trim()[0] ?? "?").toUpperCase(),
      })),
      serviceStaff: catalog.serviceStaff,
      policy,
    };
  },
);

/* ------------------------------------------------------------------ */
/* Availability: RPC payload → computed day grid                       */
/* ------------------------------------------------------------------ */

interface PerStaffInput {
  staffId: string;
  input: SlotInput;
}

function mapPerStaff(avail: Availability, nowIso: string): PerStaffInput[] {
  const businessRules: WeeklyRule[] = avail.rules
    .filter((r) => r.staff_id === null)
    .map((r) => ({
      weekday: r.weekday,
      openTime: r.open_time.slice(0, 5),
      closeTime: r.close_time.slice(0, 5),
      isClosed: r.is_closed,
    }));

  const businessOverrides: DateOverride[] = avail.overrides
    .filter((o) => o.staff_id === null)
    .map((o) => ({
      date: o.date,
      openTime: o.open_time ? o.open_time.slice(0, 5) : null,
      closeTime: o.close_time ? o.close_time.slice(0, 5) : null,
      isClosed: o.is_closed,
      reason: o.reason ?? undefined,
    }));

  return avail.staff.map((staff) => {
    const staffRules: WeeklyRule[] = avail.rules
      .filter((r) => r.staff_id === staff.id)
      .map((r) => ({
        weekday: r.weekday,
        openTime: r.open_time.slice(0, 5),
        closeTime: r.close_time.slice(0, 5),
        isClosed: r.is_closed,
      }));
    const overrideByDate = new Map<string, DateOverride>();
    for (const o of businessOverrides) overrideByDate.set(o.date, o);
    for (const o of avail.overrides.filter((x) => x.staff_id === staff.id)) {
      overrideByDate.set(o.date, {
        date: o.date,
        openTime: o.open_time ? o.open_time.slice(0, 5) : null,
        closeTime: o.close_time ? o.close_time.slice(0, 5) : null,
        isClosed: o.is_closed,
        reason: o.reason ?? undefined,
      });
    }
    return {
      staffId: staff.id,
      input: {
        businessTimezone: avail.business.timezone,
        serviceDurationMinutes: avail.service.duration_minutes,
        bufferBeforeMinutes: avail.service.buffer_before_minutes,
        bufferAfterMinutes: avail.service.buffer_after_minutes,
        slotStepMinutes: avail.business.slot_step_minutes,
        weeklyRules: businessRules,
        staffRules: staffRules.length > 0 ? staffRules : undefined,
        overrides: [...overrideByDate.values()],
        blackouts: avail.blackouts.map((b) => ({
          date: b.date,
          reason: b.reason ?? undefined,
        })),
        // RPC returns approved time off only.
        timeOff: avail.time_off
          .filter((t) => t.staff_id === staff.id)
          .map((t) => ({
            startsAt: t.starts_at,
            endsAt: t.ends_at,
            status: "approved" as const,
          })),
        // RPC returns blocking bookings only.
        bookings: avail.bookings
          .filter((b) => b.staff_id === staff.id)
          .map((b) => ({ startsAt: b.starts_at, endsAt: b.ends_at })),
        minLeadTimeMinutes: avail.business.min_lead_time_minutes,
        maxAdvanceDays: avail.business.max_advance_days,
        nowIso,
      } satisfies SlotInput,
    };
  });
}

export interface ComputedAvailability extends AvailabilityResponseData {
  /** Raw RPC payload (booking-route "any" resolution reuses the engine). */
  raw: Availability;
  perStaff: PerStaffInput[];
  from: string;
  to: string;
}

/**
 * Fetch get_availability and compute the merged public day grid.
 * `staffId` null/"any" merges every staff member performing the service;
 * a concrete staff id narrows the grid to that person.
 */
export async function computeAvailability(params: {
  businessId: string;
  serviceId: string;
  staffId?: string | null;
  from: string;
  to: string;
}): Promise<ComputedAvailability> {
  const nowIso = new Date().toISOString();
  const avail = await getAvailability(null, {
    businessId: params.businessId,
    serviceId: params.serviceId,
    staffId:
      params.staffId && params.staffId !== "any" ? params.staffId : null,
    from: params.from,
    to: params.to,
  });
  const tz = avail.business.timezone;
  const perStaffAll = mapPerStaff(avail, nowIso);
  const perStaff =
    params.staffId && params.staffId !== "any"
      ? perStaffAll.filter((s) => s.staffId === params.staffId)
      : perStaffAll;

  const dayCount =
    Math.round(
      (Date.parse(`${params.to}T00:00:00Z`) -
        Date.parse(`${params.from}T00:00:00Z`)) /
        86_400_000,
    ) + 1;

  const grids = perStaff.map((s) => ({
    staffId: s.staffId,
    input: s.input,
    days: generateDayRange(s.input, params.from, dayCount, s.staffId),
  }));

  const days: ApiDay[] = [];
  for (let i = 0; i < dayCount; i++) {
    const date = addDaysYmd(params.from, i);
    const slices: DayAvailability[] = grids
      .map((g) => g.days[i])
      .filter((d): d is DayAvailability => Boolean(d));
    const slots = slices
      .flatMap((d) => d.slots)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((s) => ({
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        staffId: s.staffId,
        label: formatInTimeZone(new Date(s.startsAt), tz, "h:mm a"),
        endLabel: formatInTimeZone(new Date(s.endsAt), tz, "h:mm a"),
      }));
    // Dedup identical instants offered by several staff (keep first staff).
    const seen = new Set<string>();
    const uniqueSlots = slots.filter((s) => {
      const key = `${s.startsAt}|${s.staffId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let status: ApiDay["status"] = "closed";
    let reason: string | undefined;
    if (slices.some((d) => d.status === "open")) {
      status = "open";
    } else if (slices.some((d) => d.status === "fully_booked")) {
      status = "fully_booked";
      reason = slices.find((d) => d.status === "fully_booked")?.reason;
    } else {
      reason = slices.find((d) => d.reason)?.reason;
    }

    // Window + booked labels for the timeline, from the first staff slice.
    let openTime: string | null = null;
    let closeTime: string | null = null;
    const firstInput = grids[0]?.input;
    if (firstInput) {
      const win = resolveWindow(firstInput, date);
      if (win.status === "open" && win.openMs && win.closeMs) {
        openTime = formatInTimeZone(win.openMs, tz, "h:mm a");
        closeTime = formatInTimeZone(win.closeMs, tz, "h:mm a");
      }
    }
    const bookedLabels = avail.bookings
      .filter(
        (b) =>
          (!params.staffId ||
            params.staffId === "any" ||
            b.staff_id === params.staffId) &&
          formatInTimeZone(new Date(b.starts_at), tz, "yyyy-MM-dd") === date,
      )
      .map(
        (b) =>
          `${formatInTimeZone(new Date(b.starts_at), tz, "h:mm a")} – ${formatInTimeZone(new Date(b.ends_at), tz, "h:mm a")}`,
      );

    days.push({
      date,
      status,
      ...(reason ? { reason } : {}),
      slots: uniqueSlots,
      bookedLabels,
      openTime,
      closeTime,
    });
  }

  return {
    business: {
      id: avail.business.id,
      name: avail.business.name,
      slug: avail.business.slug,
      timezone: tz,
    },
    staff: avail.staff.map((s) => ({
      id: s.id,
      name: s.name,
      title: s.title,
      photoUrl: s.photo_url,
    })),
    days,
    raw: avail,
    perStaff: perStaffAll,
    from: params.from,
    to: params.to,
  };
}

/**
 * Resolve an "any barber" request to the first staff member whose real
 * grid still contains the exact requested slot. Null when nobody can
 * take it (the slot is gone → the caller maps that to 409 slot_taken).
 */
export function resolveAnyStaff(
  computed: ComputedAvailability,
  startsAt: string,
  endsAt: string,
): string | null {
  for (const day of computed.days) {
    const hit = day.slots.find(
      (s) => s.startsAt === startsAt && s.endsAt === endsAt,
    );
    if (hit) return hit.staffId;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Receipt bundle (booked + manage pages)                              */
/* ------------------------------------------------------------------ */

export interface ReceiptBundle {
  receipt: BookingReceipt;
  /** From the availability RPC's business block; null when unavailable. */
  freeCancelHours: number | null;
}

export async function loadReceiptBundle(
  token: string,
): Promise<ReceiptBundle> {
  const receipt = await getBookingReceipt(null, token);
  let freeCancelHours: number | null = null;
  if (receipt.business && receipt.service) {
    try {
      const tz = receipt.business.timezone;
      const date = formatInTimeZone(
        new Date(receipt.booking.starts_at),
        tz,
        "yyyy-MM-dd",
      );
      const avail = await getAvailability(null, {
        businessId: receipt.business.id,
        serviceId: receipt.service.id,
        from: date,
        to: date,
      });
      freeCancelHours = avail.business.free_cancel_hours;
    } catch {
      freeCancelHours = null;
    }
  }
  return { receipt, freeCancelHours };
}

/* ------------------------------------------------------------------ */
/* Error mapping — never leak raw PostgreSQL text to the client        */
/* ------------------------------------------------------------------ */

export interface MappedError {
  status: number;
  code: string;
  message: string;
}

const ERROR_MAP: Array<{ needle: string; mapped: MappedError }> = [
  { needle: "slot_taken", mapped: { status: 409, code: "slot_taken", message: "That slot was just taken. Please pick another time." } },
  { needle: "23P01", mapped: { status: 409, code: "slot_taken", message: "That slot was just taken. Please pick another time." } },
  { needle: "exclusion", mapped: { status: 409, code: "slot_taken", message: "That slot was just taken. Please pick another time." } },
  { needle: "customer_name_required", mapped: { status: 400, code: "customer_name_required", message: "Your name is required." } },
  { needle: "customer_contact_required", mapped: { status: 400, code: "customer_contact_required", message: "Give an email or a mobile number so the shop can reach you." } },
  { needle: "invalid_manage_token", mapped: { status: 400, code: "invalid_manage_token", message: "This booking link is invalid." } },
  { needle: "manage_token_expired", mapped: { status: 410, code: "manage_token_expired", message: "This booking link has expired." } },
  { needle: "booking_not_cancellable", mapped: { status: 400, code: "booking_not_cancellable", message: "This booking can no longer be cancelled." } },
  { needle: "booking_not_reschedulable", mapped: { status: 400, code: "booking_not_reschedulable", message: "This booking can no longer be moved." } },
  { needle: "new_slot_required", mapped: { status: 400, code: "new_slot_required", message: "Pick a new time first." } },
  { needle: "below_min_lead_time", mapped: { status: 400, code: "below_min_lead_time", message: "That time is too soon — bookings need a little more lead time." } },
  { needle: "beyond_max_advance", mapped: { status: 400, code: "beyond_max_advance", message: "That date is too far ahead to book." } },
  { needle: "outside_hours", mapped: { status: 400, code: "outside_hours", message: "That time is outside the shop's hours." } },
  { needle: "service_not_available", mapped: { status: 404, code: "service_not_available", message: "That service is no longer bookable." } },
  { needle: "staff_not_available", mapped: { status: 400, code: "staff_not_available", message: "That team member is not available for this service." } },
  { needle: "business_not_found", mapped: { status: 404, code: "business_not_found", message: "That business could not be found." } },
  { needle: "booking_page_disabled", mapped: { status: 404, code: "business_not_found", message: "That business could not be found." } },
];

export function mapDbError(err: unknown, fallback = "Something went wrong. Please try again."): MappedError {
  const text = err instanceof Error ? err.message : String(err ?? "");
  for (const { needle, mapped } of ERROR_MAP) {
    if (text.includes(needle)) return mapped;
  }
  return { status: 500, code: "internal_error", message: fallback };
}
