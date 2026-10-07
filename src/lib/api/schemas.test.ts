import { describe, expect, it } from "vitest";

import {
  AvailabilityQuerySchema,
  CreateBookingSchema,
  CustomerLookupQuerySchema,
  ManageBookingSchema,
  RefundSchema,
} from "./schemas";

const UUID = "3f6c9d2a-1b4e-4c8a-9d3f-7a2b5c6d8e9f";

describe("AvailabilityQuerySchema", () => {
  const base = {
    businessId: UUID,
    serviceId: UUID,
    staffId: "any",
    from: "2026-10-07",
    to: "2026-10-08",
  };

  it("accepts a valid query with staffId=any", () => {
    expect(AvailabilityQuerySchema.safeParse(base).success).toBe(true);
  });

  it("accepts a staff UUID", () => {
    const r = AvailabilityQuerySchema.safeParse({ ...base, staffId: UUID });
    expect(r.success).toBe(true);
  });

  it("rejects from > to", () => {
    const r = AvailabilityQuerySchema.safeParse({
      ...base,
      from: "2026-10-09",
      to: "2026-10-07",
    });
    expect(r.success).toBe(false);
  });

  it("rejects ranges longer than 93 days", () => {
    const r = AvailabilityQuerySchema.safeParse({
      ...base,
      from: "2026-10-01",
      to: "2027-02-01",
    });
    expect(r.success).toBe(false);
  });

  it("rejects impossible calendar dates", () => {
    const r = AvailabilityQuerySchema.safeParse({
      ...base,
      from: "2026-02-30",
      to: "2026-03-01",
    });
    expect(r.success).toBe(false);
  });
});

describe("CreateBookingSchema", () => {
  const base = {
    businessId: UUID,
    serviceId: UUID,
    staffId: "any",
    startsAt: "2026-10-08T14:00:00Z",
    endsAt: "2026-10-08T14:30:00Z",
    customer: { name: "Adaeze Okafor", phone: "+15551234567" },
  };

  it("accepts a valid booking payload", () => {
    expect(CreateBookingSchema.safeParse(base).success).toBe(true);
  });

  it("requires endsAt after startsAt", () => {
    const r = CreateBookingSchema.safeParse({
      ...base,
      endsAt: "2026-10-08T13:00:00Z",
    });
    expect(r.success).toBe(false);
  });

  it("requires at least a phone or an email", () => {
    const r = CreateBookingSchema.safeParse({
      ...base,
      customer: { name: "No Contact" },
    });
    expect(r.success).toBe(false);
  });

  it("rejects junk phone characters", () => {
    const r = CreateBookingSchema.safeParse({
      ...base,
      customer: { name: "X", phone: "drop table" },
    });
    expect(r.success).toBe(false);
  });
});

describe("ManageBookingSchema", () => {
  it("accepts cancel without new times", () => {
    expect(
      ManageBookingSchema.safeParse({ token: "abc", action: "cancel" }).success,
    ).toBe(true);
  });

  it("requires new times for reschedule", () => {
    const r = ManageBookingSchema.safeParse({
      token: "abc",
      action: "reschedule",
      newStartsAt: "2026-10-09T14:00:00Z",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a full reschedule", () => {
    const r = ManageBookingSchema.safeParse({
      token: "abc",
      action: "reschedule",
      newStartsAt: "2026-10-09T14:00:00Z",
      newEndsAt: "2026-10-09T14:30:00Z",
    });
    expect(r.success).toBe(true);
  });
});

describe("RefundSchema", () => {
  it("accepts a bare payment id (full refund)", () => {
    expect(RefundSchema.safeParse({ paymentId: UUID }).success).toBe(true);
  });

  it("rejects non-positive amounts", () => {
    expect(
      RefundSchema.safeParse({ paymentId: UUID, amountCents: 0 }).success,
    ).toBe(false);
  });
});

describe("CustomerLookupQuerySchema", () => {
  it("accepts businessId + phone", () => {
    expect(
      CustomerLookupQuerySchema.safeParse({
        businessId: UUID,
        phone: "+1 (555) 123-4567",
      }).success,
    ).toBe(true);
  });

  it("rejects short phones", () => {
    expect(
      CustomerLookupQuerySchema.safeParse({ businessId: UUID, phone: "12" })
        .success,
    ).toBe(false);
  });
});
