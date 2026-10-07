import { describe, expect, it } from "vitest";

import type { DayAvailability } from "../availability/types";
import {
  AvailabilityMappingError,
  BLOCKING_STATUSES,
  mapAvailabilityPayload,
  mergeDayGrids,
} from "./availability-mapping";

const STAFF_A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const STAFF_B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";

function fixture() {
  return {
    business: {
      id: "biz-1",
      name: "Harbor & Pine",
      slug: "harbor-pine",
      timezone: "America/New_York",
      slot_step_minutes: 15,
      min_lead_time_minutes: 120,
      max_advance_days: 60,
    },
    service: {
      id: "svc-1",
      duration_minutes: 30,
      buffer_before_minutes: 5,
      buffer_after_minutes: 10,
    },
    staff: [
      { id: STAFF_A, name: "Ada" },
      { id: STAFF_B, name: "Kwame" },
    ],
    rules: [
      // business-wide: Mon-Fri 09:00-17:00 (Postgres "HH:MM:SS" shape)
      { staff_id: null, weekday: 1, open_time: "09:00:00", close_time: "17:00:00", is_closed: false },
      // staff A: longer Mondays
      { staff_id: STAFF_A, weekday: 1, open_time: "08:00:00", close_time: "18:00:00", is_closed: false },
    ],
    overrides: [
      // business-wide early close on 2026-10-12
      { staff_id: null, date: "2026-10-12", open_time: "09:00:00", close_time: "12:00:00", is_closed: false, reason: "Staff meeting" },
      // staff A closed entirely that day (wins over business override)
      { staff_id: STAFF_A, date: "2026-10-12", open_time: null, close_time: null, is_closed: true, reason: "Day off" },
    ],
    blackouts: [{ date: "2026-10-13", reason: "Holiday" }],
    time_off: [
      { staff_id: STAFF_A, starts_at: "2026-10-14T12:00:00Z", ends_at: "2026-10-14T16:00:00Z", status: "approved" },
      { staff_id: STAFF_B, starts_at: "2026-10-14T12:00:00Z", ends_at: "2026-10-14T16:00:00Z", status: "pending" },
    ],
    bookings: [
      { staff_id: STAFF_A, starts_at: "2026-10-15T13:00:00Z", ends_at: "2026-10-15T13:30:00Z", status: "confirmed" },
      { staff_id: STAFF_A, starts_at: "2026-10-15T14:00:00Z", ends_at: "2026-10-15T14:30:00Z", status: "payment_failed" },
      { staff_id: STAFF_B, starts_at: "2026-10-15T15:00:00Z", ends_at: "2026-10-15T15:30:00Z", status: "payment_pending" },
      { staff_id: STAFF_B, starts_at: "2026-10-15T16:00:00Z", ends_at: "2026-10-15T16:30:00Z", status: "cancelled" },
    ],
  };
}

const NOW = "2026-10-07T12:00:00Z";

describe("mapAvailabilityPayload", () => {
  it("splits business vs staff weekly rules and normalizes times", () => {
    const mapped = mapAvailabilityPayload(fixture(), NOW);
    const a = mapped.perStaff.find((s) => s.staffId === STAFF_A)!;
    const b = mapped.perStaff.find((s) => s.staffId === STAFF_B)!;

    expect(a.input.weeklyRules[0]?.openTime).toBe("09:00"); // business default
    expect(a.input.staffRules).toEqual([
      { weekday: 1, openTime: "08:00", closeTime: "18:00", isClosed: false },
    ]);
    expect(b.input.staffRules).toBeUndefined(); // no staff rules -> falls back
  });

  it("lets staff-specific overrides win over business overrides", () => {
    const mapped = mapAvailabilityPayload(fixture(), NOW);
    const a = mapped.perStaff.find((s) => s.staffId === STAFF_A)!;
    const b = mapped.perStaff.find((s) => s.staffId === STAFF_B)!;
    const aOct12 = a.input.overrides.find((o) => o.date === "2026-10-12")!;
    const bOct12 = b.input.overrides.find((o) => o.date === "2026-10-12")!;
    expect(aOct12.isClosed).toBe(true);
    expect(bOct12.isClosed).toBe(false);
    expect(bOct12.closeTime).toBe("12:00");
  });

  it("drops non-blocking booking statuses before they reach the engine", () => {
    const mapped = mapAvailabilityPayload(fixture(), NOW);
    const a = mapped.perStaff.find((s) => s.staffId === STAFF_A)!;
    const b = mapped.perStaff.find((s) => s.staffId === STAFF_B)!;
    expect(a.input.bookings).toHaveLength(1); // confirmed only
    expect(b.input.bookings).toHaveLength(1); // payment_pending only
    expect(BLOCKING_STATUSES.has("payment_failed")).toBe(false);
  });

  it("keeps time-off per staff (engine filters by status itself)", () => {
    const mapped = mapAvailabilityPayload(fixture(), NOW);
    const a = mapped.perStaff.find((s) => s.staffId === STAFF_A)!;
    const b = mapped.perStaff.find((s) => s.staffId === STAFF_B)!;
    expect(a.input.timeOff).toHaveLength(1);
    expect(b.input.timeOff).toHaveLength(1);
  });

  it("carries business engine settings with sane fallbacks", () => {
    const mapped = mapAvailabilityPayload(fixture(), NOW);
    const first = mapped.perStaff[0];
    if (!first) throw new Error("expected staff");
    expect(mapped.business.slotStepMinutes).toBe(15);
    expect(first.input.slotStepMinutes).toBe(15);
    expect(first.input.serviceDurationMinutes).toBe(30);
    expect(first.input.bufferAfterMinutes).toBe(10);
  });

  it("throws AvailabilityMappingError on garbage payloads", () => {
    expect(() => mapAvailabilityPayload(null, NOW)).toThrow(
      AvailabilityMappingError,
    );
    expect(() => mapAvailabilityPayload({ business: null }, NOW)).toThrow(
      AvailabilityMappingError,
    );
  });
});

describe("mergeDayGrids", () => {
  const day = (
    date: string,
    status: DayAvailability["status"],
    slots: DayAvailability["slots"] = [],
    reason?: string,
  ): DayAvailability => ({ date, status, slots, ...(reason ? { reason } : {}) });

  it("marks a day open when any staff has slots and merges slots with staffId", () => {
    const merged = mergeDayGrids([
      {
        staffId: STAFF_A,
        days: [
          day("2026-10-08", "open", [
            { startsAt: "2026-10-08T14:00:00Z", endsAt: "2026-10-08T14:30:00Z", staffId: STAFF_A },
          ]),
        ],
      },
      {
        staffId: STAFF_B,
        days: [day("2026-10-08", "fully_booked", [], "Fully booked")],
      },
    ]);
    expect(merged[0]!.status).toBe("open");
    expect(merged[0]!.slots).toHaveLength(1);
    expect(merged[0]!.slots[0]?.staffId).toBe(STAFF_A);
    expect(merged[0]!.reason).toBeUndefined();
  });

  it("reports fully_booked when windows exist but no staff has slots", () => {
    const merged = mergeDayGrids([
      { staffId: STAFF_A, days: [day("2026-10-08", "fully_booked", [], "Fully booked")] },
      { staffId: STAFF_B, days: [day("2026-10-08", "closed", [], "Closed")] },
    ]);
    expect(merged[0]!.status).toBe("fully_booked");
    expect(merged[0]!.reason).toBe("Fully booked");
  });

  it("reports closed only when every staff is closed", () => {
    const merged = mergeDayGrids([
      { staffId: STAFF_A, days: [day("2026-10-08", "closed", [], "No hours set")] },
      { staffId: STAFF_B, days: [day("2026-10-08", "closed", [], "Holiday")] },
    ]);
    expect(merged[0]!.status).toBe("closed");
  });

  it("sorts merged slots by start time across staff", () => {
    const merged = mergeDayGrids([
      {
        staffId: STAFF_A,
        days: [
          day("2026-10-08", "open", [
            { startsAt: "2026-10-08T15:00:00Z", endsAt: "2026-10-08T15:30:00Z", staffId: STAFF_A },
          ]),
        ],
      },
      {
        staffId: STAFF_B,
        days: [
          day("2026-10-08", "open", [
            { startsAt: "2026-10-08T14:00:00Z", endsAt: "2026-10-08T14:30:00Z", staffId: STAFF_B },
          ]),
        ],
      },
    ]);
    expect(merged[0]!.slots.map((s) => s.staffId)).toEqual([STAFF_B, STAFF_A]);
  });
});
